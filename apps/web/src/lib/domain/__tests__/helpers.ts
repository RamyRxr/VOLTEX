import type { DomainSession, PatientProfile } from "../types";

export const NOW = new Date("2026-10-30T09:00:00Z");
export const DAY = 86_400_000;
export const MINUTE = 60_000;
export const WINDOW = 120 * MINUTE;

let seq = 0;

type SessionOverrides = Partial<DomainSession> & { daysAgo?: number; minutesAgo?: number };

/** A valid NORMAL web session at 128/80, pill taken, unless overridden. */
export function session(overrides: SessionOverrides = {}): DomainSession {
  const { daysAgo = 0, minutesAgo = 0, ...rest } = overrides;
  seq += 1;
  return {
    id: `s${seq}`,
    startedAt: new Date(NOW.getTime() - daysAgo * DAY - minutesAgo * MINUTE),
    channel: "WEB",
    avgSys: 128,
    avgDia: 80,
    avgPulse: 72,
    pillStatus: "TAKEN",
    status: "NORMAL",
    confirmedBySessionId: null,
    symptoms: [],
    ...rest,
  };
}

/** A confirmed pair: a session and its confirming re-measure 10 minutes later. */
export function confirmedPair(
  daysAgo: number,
  first: { sys: number; dia: number },
  second: { sys: number; dia: number } = first,
  extra: Partial<DomainSession> = {},
): DomainSession[] {
  const confirming = session({ daysAgo, avgSys: second.sys, avgDia: second.dia, status: "CONFIRMED", ...extra });
  const confirmed = session({
    daysAgo,
    minutesAgo: 10,
    avgSys: first.sys,
    avgDia: first.dia,
    status: "CONFIRMED",
    confirmedBySessionId: confirming.id,
    ...extra,
  });
  return [confirmed, confirming];
}

export function profile(overrides: Partial<PatientProfile> = {}): PatientProfile {
  return {
    targetSys: null,
    targetDia: null,
    expectedReadingsPerWeek: 7,
    lastOfficeSys: null,
    lastOfficeDia: null,
    enrolledAt: new Date(NOW.getTime() - 90 * DAY),
    ...overrides,
  };
}
