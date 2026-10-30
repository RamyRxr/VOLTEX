import { CONFIG } from "./config";
import type { DomainSession, PatientProfile } from "./types";

const DAY = 86_400_000;

export interface SilenceResult {
  readonly silent: boolean;
  /** Whole days since the last session (or since enrolment). */
  readonly days: number;
  readonly thresholdDays: number;
  readonly neverMeasured: boolean;
}

/** Silent after multiplier × expected interval; high-risk patients after at most highRiskMaxDays. */
export function silenceThresholdDays(expectedPerWeek: number, highRisk: boolean): number {
  const interval = 7 / Math.max(expectedPerWeek, 1);
  const base = CONFIG.silence.multiplier * interval;
  return highRisk ? Math.min(base, CONFIG.silence.highRiskMaxDays) : base;
}

/** Any session counts as activity, even one still waiting for confirmation. */
export function computeSilence(
  sessions: readonly DomainSession[],
  patient: Pick<PatientProfile, "expectedReadingsPerWeek" | "enrolledAt">,
  now: Date,
  highRisk: boolean,
): SilenceResult {
  const last = sessions.reduce<Date | null>(
    (acc, s) => (acc == null || s.startedAt > acc ? s.startedAt : acc),
    null,
  );
  const since = last ?? patient.enrolledAt;
  const elapsedDays = Math.max(0, (now.getTime() - since.getTime()) / DAY);
  const thresholdDays = silenceThresholdDays(patient.expectedReadingsPerWeek, highRisk);
  return {
    silent: elapsedDays > thresholdDays,
    days: Math.floor(elapsedDays),
    thresholdDays,
    neverMeasured: last == null,
  };
}
