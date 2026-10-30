import { CONFIG } from "./config";
import { sessionsWithinDays } from "./session";
import type { BP, DomainSession } from "./types";

export interface MissedPillResult {
  /** Mean systolic on missed days minus mean systolic on taken days, rounded. */
  readonly deltaSys: number;
  readonly missed: BP;
  readonly taken: BP;
  readonly missedCount: number;
  readonly takenCount: number;
  /** Difference ≥ CONFIG.missedPill.minDeltaSys: the YELLOW pattern rule fires. */
  readonly flagged: boolean;
}

const meanBp = (xs: readonly DomainSession[]): BP => ({
  sys: Math.round(xs.reduce((a, s) => a + s.avgSys, 0) / xs.length),
  dia: Math.round(xs.reduce((a, s) => a + s.avgDia, 0) / xs.length),
});

/**
 * Compare measurement occasions with the pill MISSED vs TAKEN.
 * NOT_REPORTED is excluded from both groups: an unanswered question is not a missed pill.
 */
export function computeMissedPill(episodes: readonly DomainSession[]): MissedPillResult | null {
  const missed = episodes.filter((s) => s.pillStatus === "MISSED");
  const taken = episodes.filter((s) => s.pillStatus === "TAKEN");
  const min = CONFIG.missedPill.minSessionsEachGroup;
  if (missed.length < min || taken.length < min) return null;

  const rawDelta =
    missed.reduce((a, s) => a + s.avgSys, 0) / missed.length -
    taken.reduce((a, s) => a + s.avgSys, 0) / taken.length;
  const deltaSys = Math.round(rawDelta);

  return {
    deltaSys,
    missed: meanBp(missed),
    taken: meanBp(taken),
    missedCount: missed.length,
    takenCount: taken.length,
    flagged: deltaSys >= CONFIG.missedPill.minDeltaSys,
  };
}

/** TAKEN / (TAKEN + MISSED) over recent occasions; NOT_REPORTED excluded. Null without data. */
export function computeAdherence(episodes: readonly DomainSession[], now: Date): number | null {
  const recent = sessionsWithinDays(episodes, now, CONFIG.adherenceWindowDays);
  const answered = recent.filter((s) => s.pillStatus !== "NOT_REPORTED");
  if (answered.length === 0) return null;
  return answered.filter((s) => s.pillStatus === "TAKEN").length / answered.length;
}
