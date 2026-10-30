import { ageOn, pregnancyWeek as pregnancyWeekOn } from "shared";

/**
 * Date helpers for the profile form. The pregnancy and age rules come from "shared";
 * here we only turn "YYYY-MM-DD" strings and the phone's calendar day into the UTC dates they expect.
 */

/** Input sanity limit for a pregnancy date (not a medical threshold). */
export const MAX_WEEKS = 42;

/** Parses "YYYY-MM-DD" as that calendar day at 00:00 UTC; null when the date does not exist. */
export function parseIsoDate(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const [, y, m, d] = match.map(Number) as [number, number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date;
}

/** The phone's current calendar day at 00:00 UTC, to compare with parsed dates. */
const today = (now: Date) => new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

/** Completed weeks of pregnancy, or null when the dates are missing or not an ongoing pregnancy. */
export function pregnancyWeek(dates: { dueDate: string | null; lmpDate: string | null }, now: Date): number | null {
  const week = pregnancyWeekOn(
    { dueDate: dates.dueDate ? parseIsoDate(dates.dueDate) : null, lmpDate: dates.lmpDate ? parseIsoDate(dates.lmpDate) : null },
    today(now),
  );
  return week && week.weeks <= MAX_WEEKS ? week.weeks : null;
}

/** Age in full years at `now`. */
export function ageInYears(birthDate: string, now: Date): number | null {
  const birth = parseIsoDate(birthDate);
  return birth ? ageOn(birth, today(now)) : null;
}

/** Formats a local Date as "YYYY-MM-DD". */
export function toIsoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
