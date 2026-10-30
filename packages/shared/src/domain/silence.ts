import { CONFIG } from "./config";
import { hoursToMs, type SessionRecord } from "./types";

export interface SilenceResult {
  readonly silent: boolean;
  /** Whole hours since the last session (or since the follow-up started). */
  readonly hours: number;
  readonly thresholdHours: number;
  readonly neverMeasured: boolean;
}

/** Silent after multiplier × expected interval (24 h / sessions per day). */
export function silenceThresholdHours(expectedSessionsPerDay: number): number {
  return CONFIG.silence.multiplier * (24 / Math.max(expectedSessionsPerDay, 1));
}

/** Any session counts as activity, even one waiting for confirmation. */
export function computeSilence(
  sessions: readonly SessionRecord[],
  expectedSessionsPerDay: number,
  followUpStart: Date,
  now: Date,
): SilenceResult {
  const last = sessions.reduce<Date | null>(
    (acc, s) => (s.takenAt <= now && (acc == null || s.takenAt > acc) ? s.takenAt : acc),
    null,
  );
  const since = last ?? followUpStart;
  const elapsed = Math.max(0, now.getTime() - since.getTime());
  const thresholdHours = silenceThresholdHours(expectedSessionsPerDay);
  return {
    silent: elapsed > hoursToMs(thresholdHours),
    hours: Math.floor(elapsed / hoursToMs(1)),
    thresholdHours,
    neverMeasured: last == null,
  };
}
