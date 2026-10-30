/** Domain types shared by the rules. They mirror the Prisma enums (spec §7). */

export const SESSION_STATUSES = [
  "NORMAL",
  "HYPERTENSIVE",
  "SEVERE_PENDING",
  "SEVERE_CONFIRMED",
  "SEVERE_NOT_CONFIRMED",
  "SEVERE_EXPIRED",
] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const RISK_CATEGORIES = ["LOW", "MODERATE", "HIGH"] as const;
export type RiskCategory = (typeof RISK_CATEGORIES)[number];

export const ALERT_LEVELS = ["EMERGENCY", "SEVERE", "HIGH", "WATCH", "SILENT"] as const;
export type AlertLevel = (typeof ALERT_LEVELS)[number];

/** Patient level (spec §6.4): an alert level, or OK. */
export const LEVELS = [...ALERT_LEVELS, "OK"] as const;
export type Level = (typeof LEVELS)[number];

export type Evidence =
  | "DANGER_ITEM"
  | "CONFIRMED_SEVERE"
  | "TWO_OF_THREE"
  | "TREND"
  | "RISK_INCREASED"
  | "WATCH_ITEM"
  | "SILENCE";

export interface SessionRecord {
  readonly id: string;
  readonly sys: number;
  readonly dia: number;
  readonly takenAt: Date;
  readonly status: SessionStatus;
}

export interface QuestionnaireRecord {
  readonly id: string;
  readonly answers: Readonly<Record<string, boolean>>;
  readonly answeredAt: Date;
}

const HOUR = 3_600_000;
export const DAY = 24 * HOUR;

export const hoursToMs = (hours: number): number => hours * HOUR;

/** Records with `at(record)` in (now − ms, now], newest first. */
export function within<T>(records: readonly T[], at: (r: T) => Date, now: Date, ms: number): T[] {
  const from = now.getTime() - ms;
  return records
    .filter((r) => at(r).getTime() > from && at(r).getTime() <= now.getTime())
    .sort((a, b) => at(b).getTime() - at(a).getTime());
}
