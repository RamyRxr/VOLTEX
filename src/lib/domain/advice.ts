import { tierOf } from "./thresholds";
import type { SessionEvaluation } from "./evaluate";
import type { Assessment } from "./levels";
import type { BP, PillStatus } from "./types";

/**
 * The rules engine picks the advice; the text comes from the reviewed
 * AdviceItem library (CLAUDE.md §9). Nothing is generated freely.
 */
export type AdviceSituation =
  | "DANGER"
  | "HIGH_UNCONFIRMED"
  | "LOW_UNCONFIRMED"
  | "CRISIS_CONFIRMED"
  | "HIGH_CONFIRMED"
  | "LOW_CONFIRMED"
  | "ABOVE_TARGET"
  | "MISSED_PILL"
  | "SILENT"
  | "GREEN";

function byLevel(a: Assessment): AdviceSituation | null {
  switch (a.level) {
    case "RED_EMERGENCY":
      return "DANGER";
    case "RED_CRISIS":
      return "CRISIS_CONFIRMED";
    case "ORANGE":
      return a.primary?.kind === "LOW_REPEATED" ? "LOW_CONFIRMED" : "HIGH_CONFIRMED";
    case "YELLOW":
      return a.primary?.kind === "MISSED_PILL" ? "MISSED_PILL" : "ABOVE_TARGET";
    default:
      return null;
  }
}

/** Advice for the patient home screen. */
export function homeAdvice(a: Assessment): AdviceSituation {
  return byLevel(a) ?? (a.level === "GREY_SILENT" ? "SILENT" : "GREEN");
}

/** Advice on the result screen, right after a session. */
export function resultAdvice(args: {
  readonly evaluation: SessionEvaluation;
  readonly assessment: Assessment;
  readonly bp: BP;
  readonly pillStatus: PillStatus;
}): AdviceSituation {
  const { evaluation, assessment, bp, pillStatus } = args;
  if (evaluation.outcome === "CALL_14") return "DANGER";

  const tier = tierOf(bp, assessment.target);
  if (evaluation.outcome === "REMEASURE") return tier === "LOW" ? "LOW_UNCONFIRMED" : "HIGH_UNCONFIRMED";

  const fromLevel = assessment.level === "GREY_SILENT" ? null : byLevel(assessment);
  if (fromLevel && fromLevel !== "ABOVE_TARGET") return fromLevel;
  if (pillStatus === "MISSED") return "MISSED_PILL";
  if (fromLevel) return fromLevel;
  if (tier === "CRISIS" || tier === "HIGH") return "HIGH_CONFIRMED";
  if (tier === "ABOVE_TARGET") return "ABOVE_TARGET";
  if (tier === "LOW") return "LOW_CONFIRMED";
  return "GREEN";
}
