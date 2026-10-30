/** French formatting for the dashboard. Pure: `now` is passed in. */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const dateTime = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const dateOnly = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const timeOnly = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
const dayMonth = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

/** "il y a 5 min", "il y a 3 h", "hier", "il y a 4 j". */
export function relativeTime(iso: string, now: Date): string {
  const diff = now.getTime() - new Date(iso).getTime();
  if (diff < 0) return "à l'instant";
  if (diff < MINUTE) return "à l'instant";
  if (diff < HOUR) return `il y a ${Math.floor(diff / MINUTE)} min`;
  if (diff < DAY) return `il y a ${Math.floor(diff / HOUR)} h`;
  const days = Math.floor(diff / DAY);
  return days === 1 ? "hier" : `il y a ${days} j`;
}

/** Time until a future instant: "dans 23 h", "dans 12 min". */
export function untilTime(iso: string, now: Date): string {
  const diff = new Date(iso).getTime() - now.getTime();
  if (diff <= 0) return "expiré";
  if (diff < HOUR) return `dans ${Math.max(1, Math.floor(diff / MINUTE))} min`;
  return `dans ${Math.floor(diff / HOUR)} h`;
}

export const formatDateTime = (iso: string): string => dateTime.format(new Date(iso));
/** A date-only field (YYYY-MM-DD) shown as "12 mars 2026". */
export const formatDate = (isoDate: string): string => dateOnly.format(new Date(`${isoDate}T00:00:00Z`));
export const formatTime = (iso: string): string => timeOnly.format(new Date(iso));
export const formatDayMonth = (d: Date): string => dayMonth.format(d);

export const formatBp = (bp: { sys: number; dia: number }): string => `${bp.sys}/${bp.dia}`;

/** "31 SA + 4 j" (semaines d'aménorrhée). */
export function formatWeek(week: { weeks: number; days: number } | null): string {
  if (!week) return "—";
  return week.days === 0 ? `${week.weeks} SA` : `${week.weeks} SA + ${week.days} j`;
}

export function bmi(heightCm: number | null, weightKg: number | null): string | null {
  if (!heightCm || !weightKg) return null;
  const m = heightCm / 100;
  return (weightKg / (m * m)).toFixed(1);
}

/** Initials for an avatar: "Amina Bensalem" → "AB". */
export function initials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
