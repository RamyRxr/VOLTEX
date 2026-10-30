import { CONFIG } from "../config";
import { tierOf } from "../thresholds";
import type { SessionEvaluation } from "../evaluate";
import type { Assessment } from "../levels";
import type { BP } from "../types";
import { bpText, t, type Lang, type MessageKey } from "../../i18n";

/**
 * SMS replies echo the exact numbers received and never contain the
 * patient's name (spec §4.3). No template has a name placeholder.
 */
export type SmsReplyKind =
  | "HELP"
  | "UNKNOWN"
  | "DANGER"
  | "REMEASURE_HIGH"
  | "REMEASURE_LOW"
  | "NORMAL"
  | "CRISIS"
  | "HIGH"
  | "ABOVE_TARGET"
  | "LOW";

const KEY: Record<SmsReplyKind, MessageKey> = {
  HELP: "sms.help",
  UNKNOWN: "sms.unknown",
  DANGER: "sms.danger",
  REMEASURE_HIGH: "sms.remeasureHigh",
  REMEASURE_LOW: "sms.remeasureLow",
  NORMAL: "sms.normal",
  CRISIS: "sms.crisis",
  HIGH: "sms.high",
  ABOVE_TARGET: "sms.aboveTarget",
  LOW: "sms.low",
};

export function smsReplyKind(evaluation: SessionEvaluation, assessment: Assessment, received: BP): SmsReplyKind {
  if (evaluation.outcome === "CALL_14") return "DANGER";
  const tier = tierOf(received, assessment.target);
  if (evaluation.outcome === "REMEASURE") return tier === "LOW" ? "REMEASURE_LOW" : "REMEASURE_HIGH";
  if (assessment.level === "RED_CRISIS" && evaluation.resolved?.status === "CONFIRMED") return "CRISIS";
  if (tier === "CRISIS" || tier === "HIGH") return "HIGH";
  if (tier === "ABOVE_TARGET") return "ABOVE_TARGET";
  if (tier === "LOW") return "LOW";
  return "NORMAL";
}

export function smsReplyText(kind: SmsReplyKind, received: BP | null, lang: Lang = "FR"): string {
  return t(
    KEY[kind],
    { bp: received ? bpText(received) : "", minutes: Math.round(CONFIG.restBeforeConfirmSeconds / 60) },
    lang,
  );
}
