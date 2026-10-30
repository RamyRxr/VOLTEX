import { normalizePhone } from "@/lib/domain/phone";
import { parseSms } from "@/lib/domain/sms/parse";
import { smsReplyKind, smsReplyText, type SmsReplyKind } from "@/lib/domain/sms/reply";
import type { Ctx } from "./context";
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

  const parsed = parseSms(sms.body);
  if (!parsed.ok) {
    return { reply: smsReplyText("HELP", null, user.language), kind: "HELP", patientId: patient.id, sessionId: null };
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
