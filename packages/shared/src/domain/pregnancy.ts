import { CONFIG } from "./config";
import { DAY } from "./types";

export interface PregnancyDates {
  readonly dueDate?: Date | null;
  readonly lmpDate?: Date | null;
}

export interface PregnancyWeek {
  /** Completed weeks of amenorrhoea (e.g. 31 for 31 SA + 4 j). */
  readonly weeks: number;
  readonly days: number;
}

/** Last menstrual period, from itself or from the due date (LMP + 280 days). */
export function lmpOf(dates: PregnancyDates): Date | null {
  if (dates.lmpDate) return dates.lmpDate;
  if (dates.dueDate) return new Date(dates.dueDate.getTime() - CONFIG.pregnancyDays * DAY);
  return null;
}

/** Pregnancy week computed on `now`; null without a date or before the LMP. */
export function pregnancyWeek(dates: PregnancyDates, now: Date): PregnancyWeek | null {
  const lmp = lmpOf(dates);
  if (!lmp) return null;
  const elapsedDays = Math.floor((now.getTime() - lmp.getTime()) / DAY);
  if (elapsedDays < 0) return null;
  return { weeks: Math.floor(elapsedDays / 7), days: elapsedDays % 7 };
}

/** Age in whole years on `now`. */
export function ageOn(birthDate: Date, now: Date): number {
  let age = now.getUTCFullYear() - birthDate.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < birthDate.getUTCMonth() ||
    (now.getUTCMonth() === birthDate.getUTCMonth() && now.getUTCDate() < birthDate.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

/** Body mass index, or null without height and weight. */
export function bmiOf(heightCm?: number | null, weightKg?: number | null): number | null {
  if (!heightCm || !weightKg) return null;
  const m = heightCm / 100;
  return weightKg / (m * m);
}
