import { triageGroup, type ConversationDto } from "shared";
import { db } from "./db";
import { triage } from "./doctor";
import { iso } from "./mappers";

/** Messages read per poll: enough for every recent conversation of a doctor. */
const MESSAGE_SCAN = 2000;
const PREVIEW_LENGTH = 160;

const preview = (body: string): string =>
  body.length > PREVIEW_LENGTH ? `${body.slice(0, PREVIEW_LENGTH - 1).trimEnd()}…` : body;

/**
 * Patients of this doctor who wrote at least one message, most urgent first
 * (same groups as the triage list), then most recent message first.
 */
export async function conversations(doctorId: string, doctorProfileId: string, now: Date): Promise<ConversationDto[]> {
  const accepted = { doctorId, status: "ACCEPTED" } as const;
  // Independent reads in parallel: each database round trip is the main cost of this poll.
  const [links, messages, rows] = await Promise.all([
    db.linkRequest.findMany({ where: accepted, select: { id: true, patientId: true } }),
    db.message.findMany({
      where: { link: accepted },
      orderBy: { createdAt: "desc" },
      take: MESSAGE_SCAN,
      select: { linkId: true, senderId: true, body: true, createdAt: true },
    }),
    triage(doctorId, now),
  ]);
  if (messages.length === 0) return [];
  const byPatient = new Map(rows.map((r) => [r.patientId, r]));

  const list = links.flatMap((link): ConversationDto[] => {
    const thread = messages.filter((m) => m.linkId === link.id); // newest first
    const last = thread[0];
    const row = byPatient.get(link.patientId);
    if (!last || !row) return [];
    const lastDoctorIndex = thread.findIndex((m) => m.senderId === doctorProfileId);
    const pending = lastDoctorIndex === -1 ? thread : thread.slice(0, lastDoctorIndex);
    return [
      {
        patientId: link.patientId,
        linkId: link.id,
        fullName: row.fullName,
        level: row.level,
        unconfirmedSevere: row.unconfirmedSevere != null,
        lastMessage: { body: preview(last.body), createdAt: iso(last.createdAt), fromPatient: last.senderId !== doctorProfileId },
        unanswered: pending.filter((m) => m.senderId !== doctorProfileId).length,
      },
    ];
  });

  const group = (c: ConversationDto): number =>
    triageGroup({ level: c.level, hasUnconfirmedSevere: c.unconfirmedSevere, lastActivityAt: null });
  const time = (c: ConversationDto): number => new Date(c.lastMessage.createdAt).getTime();
  return [...list].sort((a, b) => group(a) - group(b) || time(b) - time(a));
}
