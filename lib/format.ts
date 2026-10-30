const MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

const DAYS = [
  "dimanche",
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
];

const pad = (n: number) => String(n).padStart(2, "0");

/** "30 octobre 2026" */
export const longDate = (d: Date) =>
  `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

/** "jeudi 30 octobre" */
export const weekdayDate = (d: Date) =>
  `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;

/** "30/10" */
export const shortDate = (d: Date) =>
  `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;

/** "14:05" */
export const time = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** "30/10 · 14:05" */
export const stamp = (d: Date) => `${shortDate(d)} · ${time(d)}`;

/** "il y a 3 j", "il y a 2 h", "à l'instant" */
export function elapsed(d: Date, now: Date): string {
  const mins = Math.max(0, Math.round((now.getTime() - d.getTime()) / 60_000));
  if (mins < 2) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(mins / 1440);
  if (days === 1) return "hier";
  if (days < 31) return `il y a ${days} j`;
  const months = Math.floor(days / 30);
  return `il y a ${months} mois`;
}

/** Days before `now`, as a Date at a given hour. */
export function daysAgo(now: Date, offset: number, hour = 8, minute = 0): Date {
  const d = new Date(now);
  d.setDate(d.getDate() - offset);
  d.setHours(hour, minute, 0, 0);
  return d;
}

/** Minutes before `now`. */
export function minutesAgo(now: Date, minutes: number): Date {
  return new Date(now.getTime() - minutes * 60_000);
}

export const pct = (x: number) => `${Math.round(x * 100)} %`;
