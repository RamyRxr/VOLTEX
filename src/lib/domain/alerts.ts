import type { Assessment, Finding } from "./levels";
import type { AlertEvidence, AlertLevel, AlertStatus } from "./types";

export const EVIDENCE_OF: Record<Finding["kind"], AlertEvidence> = {
  DANGER: "DANGER_SYMPTOM",
  CRISIS: "CONFIRMED_SESSION",
  HIGH_REPEATED: "TWO_OF_THREE",
  LOW_REPEATED: "TWO_OF_THREE",
  AVERAGE: "SEVEN_DAY_AVG",
  TREND: "TREND",
  MISSED_PILL: "MISSED_PILL",
  SILENCE: "SILENCE",
};

export interface AlertCandidate {
  readonly level: AlertLevel;
  readonly evidence: AlertEvidence;
  /** The session that triggered it; null for computed evidence (averages, trend, silence). */
  readonly sessionId: string | null;
}

/**
 * One alert per evaluation: the rule that set the level. Lower rules that also
 * match stay visible on the patient page, so the doctor is not flooded.
 */
export function alertCandidate(primary: Finding | null): AlertCandidate | null {
  if (!primary) return null;
  const sessionId = primary.kind === "DANGER" || primary.kind === "CRISIS" ? primary.sessionId : null;
  return { level: primary.level, evidence: EVIDENCE_OF[primary.kind], sessionId };
}

export interface ExistingAlert {
  readonly id: string;
  readonly level: AlertLevel;
  readonly evidence: AlertEvidence;
  readonly sessionId: string | null;
  readonly status: AlertStatus;
}

export type AlertPlan =
  | { readonly action: "create" }
  | { readonly action: "update"; readonly alertId: string }
  | { readonly action: "none" };

/**
 * De-duplicate (spec §6.7): at most one unresolved alert per patient per
 * level and evidence; update it instead of stacking. A new triggering session
 * after the doctor acknowledged the previous one is a new event: create.
 */
export function planAlert(candidate: AlertCandidate, existing: readonly ExistingAlert[]): AlertPlan {
  const same = existing.filter(
    (a) => a.status !== "CLOSED" && a.level === candidate.level && a.evidence === candidate.evidence,
  );
  const open = same.find((a) => a.status === "OPEN");
  if (open) return { action: "update", alertId: open.id };

  const acknowledged = same.find((a) => a.status === "ACKNOWLEDGED");
  if (!acknowledged) return { action: "create" };
  if (candidate.sessionId && acknowledged.sessionId !== candidate.sessionId) return { action: "create" };
  return { action: "update", alertId: acknowledged.id };
}

/** A silence alert is over once the patient measures again. */
export function silenceAlertsToClose(existing: readonly ExistingAlert[], assessment: Assessment): string[] {
  if (assessment.silence.silent) return [];
  return existing.filter((a) => a.evidence === "SILENCE" && a.status !== "CLOSED").map((a) => a.id);
}
