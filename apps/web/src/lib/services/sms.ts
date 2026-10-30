import { normalizePhone } from "@/lib/domain/phone";
import { parseSms } from "@/lib/domain/sms/parse";
import { smsReplyKind, smsReplyText, type SmsReplyKind } from "@/lib/domain/sms/reply";
import { ServiceError, type Ctx, type Viewer } from "./context";
import { ingestSession } from "./ingest";

export interface InboundSms {
  readonly from: string;
  readonly body: string;
}

export interface SmsOutcome {
  readonly reply: string;
  readonly kind: SmsReplyKind;
  /** Set when a session was stored. Never sent back to the gateway. */
  readonly patientId: string | null;
  readonly sessionId: string | null;
}

/** A gateway retry or an impatient re-send of the same text within a minute. */
const DUPLICATE_WINDOW_MS = 60_000;

async function recentDuplicate(ctx: Ctx, patientId: string, body: string) {
  const last = (await ctx.repo.listSessions(patientId)).at(-1);
  if (!last || last.channel !== "SMS" || last.rawSms?.trim() !== body.trim()) return null;
  if (ctx.now.getTime() - last.startedAt.getTime() >= DUPLICATE_WINDOW_MS) return null;
  return { bp: { sys: last.avgSys, dia: last.avgDia }, danger: last.status === "DANGER" };
}

/**
 * The one SMS handler, shared by the gateway webhook and /dev/sms-simulator.
 * Patients are matched by phone number. Unknown numbers and unparseable
 * messages store nothing clinical and never throw.
 */
export async function handleInboundSms(ctx: Ctx, sms: InboundSms): Promise<SmsOutcome> {
  const phone = normalizePhone(sms.from);
  const user = phone ? await ctx.repo.findUserByPhone(phone) : null;
  const patient = user?.role === "PATIENT" ? await ctx.repo.getPatientByUserId(user.id) : null;
  if (!user || !patient) {
    return { reply: smsReplyText("UNKNOWN", null), kind: "UNKNOWN", patientId: null, sessionId: null };
  }

  const repeat = await recentDuplicate(ctx, patient.id, sms.body);
  if (repeat) {
    const kind = repeat.danger ? "DANGER" : "DUPLICATE";
    return { reply: smsReplyText(kind, repeat.bp, user.language), kind, patientId: patient.id, sessionId: null };
  }

  const parsed = parseSms(sms.body);
  if (!parsed.ok) {
    const kind = parsed.hasDanger ? "DANGER_UNPARSED" : "HELP";
    return { reply: smsReplyText(kind, null, user.language), kind, patientId: patient.id, sessionId: null };
  }

  const { sys, dia, pulse, pillStatus, symptoms } = parsed.value;
  const result = await ingestSession(ctx, {
    patientId: patient.id,
    channel: "SMS",
    readings: [{ sys, dia, pulse }],
    pillStatus,
    symptoms,
    rawSms: sms.body,
  });
  const kind = smsReplyKind(result.evaluation, result.assessment, { sys, dia });
  return { reply: smsReplyText(kind, { sys, dia }, user.language), kind, patientId: patient.id, sessionId: result.session.id };
}

/**
 * The simulator stands in for the gateway, but only for the signed-in
 * doctor's own patients: another doctor's numbers answer like unknown ones.
 */
export async function handleSimulatedSms(ctx: Ctx, viewer: Viewer, sms: InboundSms): Promise<SmsOutcome> {
  if (viewer.role !== "DOCTOR") throw new ServiceError("FORBIDDEN", "Doctors only");
  const phone = normalizePhone(sms.from);
  const user = phone ? await ctx.repo.findUserByPhone(phone) : null;
  const patient = user?.role === "PATIENT" ? await ctx.repo.getPatientByUserId(user.id) : null;
  if (!patient || patient.doctorId !== viewer.doctorId) {
    return { reply: smsReplyText("UNKNOWN", null), kind: "UNKNOWN", patientId: null, sessionId: null };
  }
  return handleInboundSms(ctx, sms);
}
