import { CONFIG } from "./config";
import { isHypertensive, isSevere, type BP } from "./thresholds";
import type { SessionRecord, SessionStatus } from "./types";

const MINUTE = 60_000;
const windowMs = (): number => CONFIG.confirmationWindowMinutes * MINUTE;

/** Statuses used in averages, trends and the 2-of-3 rule (spec §6.2). */
const VALID: ReadonlySet<SessionStatus> = new Set(["NORMAL", "HYPERTENSIVE", "SEVERE_CONFIRMED"]);

export const isValidSession = (s: Pick<SessionRecord, "status">): boolean => VALID.has(s.status);

/** Status of a reading on its own, before any confirmation logic. */
export function classifyReading(bp: BP): SessionStatus {
  if (isSevere(bp)) return "SEVERE_PENDING";
  if (isHypertensive(bp)) return "HYPERTENSIVE";
  return "NORMAL";
}

export interface SessionUpdate {
  readonly id: string;
  readonly status: SessionStatus;
  readonly confirmedBySessionId?: string;
}

export interface RegisterResult {
  /** Status of the new session. */
  readonly status: SessionStatus;
  /** Changes to earlier sessions (a pending severe reading resolved by this one). */
  readonly updates: readonly SessionUpdate[];
}

/** Latest SEVERE_PENDING session taken in the confirmation window before `at`. */
export function pendingBefore(sessions: readonly SessionRecord[], at: Date): SessionRecord | null {
  const from = at.getTime() - windowMs();
  return (
    sessions
      .filter((s) => s.status === "SEVERE_PENDING")
      .filter((s) => s.takenAt.getTime() >= from && s.takenAt.getTime() <= at.getTime())
      .sort((a, b) => b.takenAt.getTime() - a.takenAt.getTime())[0] ?? null
  );
}

/**
 * Spec §6.4 steps 2–3 for a new reading: resolve a pending severe reading in
 * the window (confirmed / not confirmed), otherwise classify the reading alone.
 */
export function registerSession(
  existing: readonly SessionRecord[],
  reading: { readonly id: string; readonly sys: number; readonly dia: number; readonly takenAt: Date },
): RegisterResult {
  const own = classifyReading(reading);
  const pending = pendingBefore(existing, reading.takenAt);
  if (!pending) return { status: own, updates: [] };

  if (own === "SEVERE_PENDING") {
    return {
      status: "SEVERE_CONFIRMED",
      updates: [{ id: pending.id, status: "SEVERE_CONFIRMED", confirmedBySessionId: reading.id }],
    };
  }
  return {
    status: own,
    updates: [{ id: pending.id, status: "SEVERE_NOT_CONFIRMED", confirmedBySessionId: reading.id }],
  };
}

/** Pending severe readings whose confirmation window has passed → SEVERE_EXPIRED. */
export function expirePending(sessions: readonly SessionRecord[], now: Date): SessionUpdate[] {
  return sessions
    .filter((s) => s.status === "SEVERE_PENDING" && now.getTime() - s.takenAt.getTime() > windowMs())
    .map((s) => ({ id: s.id, status: "SEVERE_EXPIRED" as const }));
}

/** Apply updates without mutating the input. */
export function applyUpdates(sessions: readonly SessionRecord[], updates: readonly SessionUpdate[]): SessionRecord[] {
  const byId = new Map(updates.map((u) => [u.id, u]));
  return sessions.map((s) => {
    const u = byId.get(s.id);
    return u ? { ...s, status: u.status } : s;
  });
}

/** Valid sessions up to `now`, newest first. */
export function validNewestFirst(sessions: readonly SessionRecord[], now: Date): SessionRecord[] {
  return sessions
    .filter((s) => isValidSession(s) && s.takenAt.getTime() <= now.getTime())
    .sort((a, b) => b.takenAt.getTime() - a.takenAt.getTime());
}

/** At least 2 of the last 3 valid sessions ≥ 140/90 (spec §6.4 HIGH). */
export function twoOfLastThree(sessions: readonly SessionRecord[], now: Date): SessionRecord[] | null {
  const last3 = validNewestFirst(sessions, now).slice(0, 3);
  const high = last3.filter((s) => isHypertensive(s));
  return high.length >= 2 ? high : null;
}
