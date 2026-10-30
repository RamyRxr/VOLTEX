import { CONFIG } from "./config";
import { needsConfirmation, reachesTier, tierOf } from "./thresholds";
import type { BP, DomainSession, ReadingValue, SessionStatus } from "./types";

const MINUTE = 60_000;

export interface SessionAverage {
  readonly avgSys: number;
  readonly avgDia: number;
  readonly avgPulse: number | null;
}

const mean = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Web: mean of the 2 readings, rounded. SMS: the single reading. */
export function averageReadings(readings: readonly ReadingValue[]): SessionAverage {
  if (readings.length === 0) throw new Error("A session needs at least one reading");
  const pulses = readings.map((r) => r.pulse).filter((p): p is number => p != null);
  return {
    avgSys: Math.round(mean(readings.map((r) => r.sys))),
    avgDia: Math.round(mean(readings.map((r) => r.dia))),
    avgPulse: pulses.length ? Math.round(mean(pulses)) : null,
  };
}

/** Confirmation window, shortened in demo mode (spec §6.8). */
export function confirmationWindowMs(demoMode: boolean): number {
  return demoMode
    ? CONFIG.demoModeSeconds.confirmationWindow * 1000
    : CONFIG.confirmationWindowMinutes * MINUTE;
}

/** Latest PENDING session started within the window before `now`. */
export function findPendingInWindow(
  sessions: readonly DomainSession[],
  now: Date,
  windowMs: number,
): DomainSession | null {
  const candidates = sessions
    .filter((s) => s.status === "PENDING")
    .filter((s) => {
      const age = now.getTime() - s.startedAt.getTime();
      return age >= 0 && age <= windowMs;
    })
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  return candidates[0] ?? null;
}

export interface ConfirmationOutcome {
  /** New status of the earlier, pending session. */
  readonly pendingStatus: "CONFIRMED" | "NOT_CONFIRMED";
  /** Status of the confirming session itself. */
  readonly newStatus: SessionStatus;
}

/**
 * The confirming session is a validated re-measure: it is CONFIRMED when it
 * is itself out of range, NORMAL otherwise, and counts in statistics.
 * One exception: a crisis value is never accepted unconfirmed. If the
 * re-measure jumps to the crisis tier, it becomes PENDING in its turn
 * (at most one extra measure, since there is no tier above crisis).
 */
export function resolveConfirmation(
  newBp: BP,
  previousPending: Pick<DomainSession, "avgSys" | "avgDia">,
  target: BP,
): ConfirmationOutcome {
  const first = tierOf({ sys: previousPending.avgSys, dia: previousPending.avgDia }, target);
  const second = tierOf(newBp, target);
  const escalates = second === "CRISIS" && first !== "CRISIS";
  return {
    pendingStatus: reachesTier(first, second) ? "CONFIRMED" : "NOT_CONFIRMED",
    newStatus: escalates ? "PENDING" : needsConfirmation(newBp, target) ? "CONFIRMED" : "NORMAL",
  };
}

/** PENDING sessions older than the window: ids to mark EXPIRED. */
export function staleSessionIds(
  sessions: readonly DomainSession[],
  now: Date,
  windowMs: number,
): string[] {
  return sessions
    .filter((s) => s.status === "PENDING" && now.getTime() - s.startedAt.getTime() > windowMs)
    .map((s) => s.id);
}

/** NORMAL, CONFIRMED and DANGER count in statistics (confirming sessions are NORMAL or CONFIRMED). */
export function isValidForStats(s: Pick<DomainSession, "status">): boolean {
  return s.status === "NORMAL" || s.status === "CONFIRMED" || s.status === "DANGER";
}

export const byTimeAsc = (a: DomainSession, b: DomainSession) =>
  a.startedAt.getTime() - b.startedAt.getTime();

export function validSessions(sessions: readonly DomainSession[]): DomainSession[] {
  return sessions.filter(isValidForStats).sort(byTimeAsc);
}

const isConfirmedLink = (s: DomainSession) => s.status === "CONFIRMED" && s.confirmedBySessionId != null;

const firstReportedPill = (members: readonly DomainSession[]) =>
  members.find((m) => m.pillStatus !== "NOT_REPORTED")?.pillStatus ?? "NOT_REPORTED";

const unionSymptoms = (members: readonly DomainSession[]) => [
  ...new Set(members.flatMap((m) => m.symptoms)),
];

/**
 * One entry per measurement occasion. A confirmation chain (pending session
 * + the session(s) that confirmed it) is a single episode, represented by the
 * last session that was itself confirmed, i.e. the highest confirmed value.
 * Counting rules ("2 of the last 3", missed-pill groups, adherence) use
 * episodes so one occasion is never counted twice. Averages and trends use
 * every valid session, as spec §6.2 says.
 */
export function episodes(sessions: readonly DomainSession[]): DomainSession[] {
  const byId = new Map(sessions.map((s) => [s.id, s]));
  const folded = new Set(
    sessions.filter(isConfirmedLink).map((s) => s.confirmedBySessionId as string),
  );

  return validSessions(sessions)
    .filter((s) => !folded.has(s.id))
    .map((head) => {
      const members: DomainSession[] = [head];
      let rep = head;
      let cur = head;
      while (isConfirmedLink(cur)) {
        const next = byId.get(cur.confirmedBySessionId as string);
        if (!next || members.includes(next)) break;
        members.push(next);
        if (isConfirmedLink(next)) rep = next;
        cur = next;
      }
      return { ...rep, pillStatus: firstReportedPill(members), symptoms: unionSymptoms(members) };
    });
}

export function sessionsWithinDays(
  sessions: readonly DomainSession[],
  now: Date,
  days: number,
): DomainSession[] {
  const from = now.getTime() - days * 86_400_000;
  return sessions.filter((s) => s.startedAt.getTime() > from && s.startedAt.getTime() <= now.getTime());
}
