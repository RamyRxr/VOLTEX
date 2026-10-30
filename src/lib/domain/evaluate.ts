import { averageReadings, findPendingInWindow, resolveConfirmation, type SessionAverage } from "./session";
import { dangerSymptomsIn, needsConfirmation, patientTarget } from "./thresholds";
import type {
  Channel,
  DomainSession,
  PatientProfile,
  PillStatus,
  ReadingValue,
  SessionStatus,
  SymptomType,
} from "./types";

export interface NewSessionInput {
  readonly channel: Channel;
  readonly readings: readonly ReadingValue[];
  readonly pillStatus: PillStatus;
  readonly symptoms: readonly SymptomType[];
}

/** What the patient is told right after sending. */
export type PatientOutcome = "CALL_14" | "REMEASURE" | "RECORDED";

export interface SessionEvaluation {
  readonly average: SessionAverage;
  readonly status: SessionStatus;
  readonly outcome: PatientOutcome;
  /** The earlier PENDING session this one resolved, if any. */
  readonly resolved: { readonly sessionId: string; readonly status: "CONFIRMED" | "NOT_CONFIRMED" } | null;
}

/**
 * spec §6.3 — never change this order:
 * 1. danger symptoms, 2. confirmation, 3. new pending, 4. (level, done by assessPatient).
 */
export function evaluateSession(args: {
  readonly input: NewSessionInput;
  readonly history: readonly DomainSession[];
  readonly patient: Pick<PatientProfile, "targetSys" | "targetDia">;
  readonly now: Date;
  readonly windowMs: number;
}): SessionEvaluation {
  const { input, history, patient, now, windowMs } = args;
  const average = averageReadings(input.readings);
  const bp = { sys: average.avgSys, dia: average.avgDia };
  const target = patientTarget(patient);

  // 1. Danger symptom: stop. No confirmation, whatever the reading.
  if (dangerSymptomsIn(input.symptoms).length > 0) {
    return { average, status: "DANGER", outcome: "CALL_14", resolved: null };
  }

  // 2. A PENDING session in the window is resolved by this one.
  const pending = findPendingInWindow(history, now, windowMs);
  if (pending) {
    const outcome = resolveConfirmation(bp, pending, target);
    return {
      average,
      status: outcome.newStatus,
      outcome: outcome.newStatus === "PENDING" ? "REMEASURE" : "RECORDED",
      resolved: { sessionId: pending.id, status: outcome.pendingStatus },
    };
  }

  // 3. Out of range with no pending: ask for a re-measure, no alert yet.
  if (needsConfirmation(bp, target)) {
    return { average, status: "PENDING", outcome: "REMEASURE", resolved: null };
  }

  return { average, status: "NORMAL", outcome: "RECORDED", resolved: null };
}
