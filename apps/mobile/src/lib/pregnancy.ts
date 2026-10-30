/** Pregnancy dating helpers. Pure: callers pass `now`. */

const DAY_MS = 24 * 60 * 60 * 1000;
const TERM_DAYS = 280; // 40 weeks from the last menstrual period
export const MAX_WEEKS = 42;

/** Parses "YYYY-MM-DD" as a local calendar date; returns null when the date does not exist. */
export function parseIsoDate(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const [, y, m, d] = match.map(Number) as [number, number, number, number];
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to) - startOfDay(from)) / DAY_MS);
}

/** Days of amenorrhoea at `now`, from either the due date or the last period date. */
export function gestationDays(dates: { dueDate: string | null; lmpDate: string | null }, now: Date): number | null {
  if (dates.lmpDate) {
    const lmp = parseIsoDate(dates.lmpDate);
    return lmp ? daysBetween(lmp, now) : null;
  }
  if (dates.dueDate) {
    const due = parseIsoDate(dates.dueDate);
    return due ? TERM_DAYS - daysBetween(now, due) : null;
  }
  return null;
}

/** Completed weeks of pregnancy, or null when the dates are missing or out of range. */
export function pregnancyWeek(dates: { dueDate: string | null; lmpDate: string | null }, now: Date): number | null {
  const days = gestationDays(dates, now);
  if (days === null || days < 0 || days > MAX_WEEKS * 7) return null;
  return Math.floor(days / 7);
}

/** Age in full years at `now`. */
export function ageInYears(birthDate: string, now: Date): number | null {
  const birth = parseIsoDate(birthDate);
  if (!birth) return null;
  let age = now.getFullYear() - birth.getFullYear();
  const beforeBirthday =
    now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

/** Formats a local Date as "YYYY-MM-DD". */
export function toIsoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
