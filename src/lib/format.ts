import { t } from "@/lib/i18n";

/**
 * Dates are always shown in Algerian time, on the server and in the browser,
 * so server-rendered HTML and the hydrated page agree to the minute.
 */
export const APP_TIME_ZONE = "Africa/Algiers";

const fmt = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("fr-FR", { timeZone: APP_TIME_ZONE, ...options });

const LONG = fmt({ day: "numeric", month: "long", year: "numeric" });
const WEEKDAY = fmt({ weekday: "long", day: "numeric", month: "long" });
const SHORT = fmt({ day: "2-digit", month: "2-digit" });
const CLOCK = fmt({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const DAY_KEY = fmt({ year: "numeric", month: "2-digit", day: "2-digit" });

const asDate = (d: Date | string) => (typeof d === "string" ? new Date(d) : d);

/** "30 octobre 2026" */
export const longDate = (d: Date | string) => LONG.format(asDate(d));
/** "vendredi 30 octobre" */
export const weekdayDate = (d: Date | string) => WEEKDAY.format(asDate(d));
/** "30/10" */
export const shortDate = (d: Date | string) => SHORT.format(asDate(d));
/** "09:05" */
export const clock = (d: Date | string) => CLOCK.format(asDate(d));
/** "30/10 · 09:05" */
export const stamp = (d: Date | string) => `${shortDate(d)} · ${clock(d)}`;
/** Same calendar day in Algeria. */
export const sameDay = (a: Date | string, b: Date | string) => DAY_KEY.format(asDate(a)) === DAY_KEY.format(asDate(b));

const MINUTE = 60_000;

/** "à l'instant", "il y a 12 min", "hier"… relative to the data's own clock. */
export function elapsed(d: Date | string, now: Date | string): string {
  const mins = Math.max(0, Math.round((asDate(now).getTime() - asDate(d).getTime()) / MINUTE));
  if (mins < 2) return t("time.now");
  if (mins < 60) return t("time.minutes", { n: mins });
  const hours = Math.round(mins / 60);
  if (hours < 24) return t("time.hours", { n: hours });
  const days = Math.floor(mins / 1440);
  if (days === 1) return t("time.yesterday");
  if (days < 31) return t("time.days", { n: days });
  return t("time.months", { n: Math.floor(days / 30) });
}

/** "+213555000006" → "0555 00 00 06" (national format, easier to read and dial). */
export function displayPhone(phone: string): string {
  if (!phone.startsWith("+213")) return phone;
  const national = `0${phone.slice(4)}`;
  return national.length === 10 ? national.replace(/^(\d{4})(\d{2})(\d{2})(\d{2})$/, "$1 $2 $3 $4") : national;
}

/** 0.6 → "60 %" */
export const pct = (x: number) => `${Math.round(x * 100)} %`;

/** "Ahmed Saidi" → "AS" */
export const initials = (name: string) =>
  name
    .replace(/^Dr\.?\s+/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
