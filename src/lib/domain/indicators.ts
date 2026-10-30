import { assessPatient } from "./levels";
import { validSessions } from "./session";
import { isAbove } from "./thresholds";
import type { AlertLevel, BP, DomainSession, PatientProfile } from "./types";

const DAY = 86_400_000;
const WEEK = 7 * DAY;

export interface IndicatorPatient {
  readonly profile: PatientProfile;
  readonly sessions: readonly DomainSession[];
}

export interface IndicatorAlert {
  readonly level: AlertLevel;
  readonly createdAt: Date;
  readonly ackAt: Date | null;
}

export interface IndicatorInput {
  readonly patients: readonly IndicatorPatient[];
  readonly alerts: readonly IndicatorAlert[];
  readonly to: Date;
  readonly weeks: number;
  readonly windowMs: number;
}

export interface Week {
  readonly start: Date;
  readonly end: Date;
}

export interface Indicators {
  readonly weeks: readonly Week[];
  /** Valid sessions per patient per week. */
  readonly frequency: { readonly value: number | null; readonly series: readonly (number | null)[] };
  /** Group average systolic and diastolic per week. */
  readonly evolution: { readonly value: BP | null; readonly series: readonly (BP | null)[] };
  /** Alerts per level per week. */
  readonly alerts: {
    readonly total: number;
    readonly byLevel: Readonly<Record<AlertLevel, number>>;
    readonly series: readonly number[];
  };
  /** % of patients not silent at the end of each week; silent count today. */
  readonly regularity: { readonly value: number | null; readonly silentNow: number; readonly series: readonly (number | null)[] };
  /** % of evaluated patients whose 7-day average is within their own target. */
  readonly control: { readonly value: number | null; readonly evaluated: number; readonly series: readonly (number | null)[] };
  /** Median minutes from RED alert creation to acknowledgement. */
  readonly response: { readonly value: number | null; readonly count: number; readonly series: readonly (number | null)[] };
}

const inRange = (d: Date, w: Week) => d.getTime() >= w.start.getTime() && d.getTime() < w.end.getTime();
const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function median(xs: readonly number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function buildWeeks(to: Date, count: number): Week[] {
  return Array.from({ length: count }, (_, i) => {
    const end = new Date(to.getTime() - (count - 1 - i) * WEEK);
    return { start: new Date(end.getTime() - WEEK), end };
  });
}

function snapshot(patients: readonly IndicatorPatient[], at: Date, windowMs: number) {
  const enrolled = patients.filter((p) => p.profile.enrolledAt.getTime() <= at.getTime());
  const assessed = enrolled.map((p) => assessPatient({ patient: p.profile, sessions: p.sessions, now: at, windowMs }));
  const evaluated = assessed.filter((a) => a.avg7 != null);
  const controlled = evaluated.filter((a) => a.avg7 && !isAbove(a.avg7, a.target));
  const silent = assessed.filter((a) => a.silence.silent).length;
  return {
    enrolled: enrolled.length,
    silent,
    evaluated: evaluated.length,
    regularity: enrolled.length ? (enrolled.length - silent) / enrolled.length : null,
    control: evaluated.length ? controlled.length / evaluated.length : null,
  };
}

const isRedLevel = (l: AlertLevel) => l === "RED_EMERGENCY" || l === "RED_CRISIS";
const responseMinutes = (alerts: readonly IndicatorAlert[]) =>
  alerts
    .filter((a) => isRedLevel(a.level) && a.ackAt)
    .map((a) => ((a.ackAt as Date).getTime() - a.createdAt.getTime()) / 60_000);

/** spec §8: the brief's four indicators, then control rate and response time. Pure. */
export function computeIndicators(input: IndicatorInput): Indicators {
  const weeks = buildWeeks(input.to, input.weeks);
  const period: Week = { start: weeks[0].start, end: input.to };
  const valid = input.patients.flatMap((p) => validSessions(p.sessions));
  const patientCount = Math.max(input.patients.length, 1);

  const perWeek = weeks.map((w) => valid.filter((s) => inRange(s.startedAt, w)));
  const snapshots = weeks.map((w) => snapshot(input.patients, w.end, input.windowMs));
  const now = snapshots[snapshots.length - 1];

  const alertsInPeriod = input.alerts.filter((a) => inRange(a.createdAt, { ...period, end: new Date(input.to.getTime() + 1) }));
  const byLevel: Record<AlertLevel, number> = { RED_EMERGENCY: 0, RED_CRISIS: 0, ORANGE: 0, YELLOW: 0, GREY_SILENT: 0 };
  for (const a of alertsInPeriod) byLevel[a.level] += 1;

  const evolutionSeries = perWeek.map((ss) => {
    const sys = mean(ss.map((s) => s.avgSys));
    const dia = mean(ss.map((s) => s.avgDia));
    return sys == null || dia == null ? null : { sys: Math.round(sys), dia: Math.round(dia) };
  });

  const responseSeries = weeks.map((w) => median(responseMinutes(input.alerts.filter((a) => inRange(a.createdAt, w)))));
  const allResponses = responseMinutes(alertsInPeriod);

  return {
    weeks,
    frequency: {
      value: perWeek.reduce((n, ss) => n + ss.length, 0) / patientCount / weeks.length,
      series: perWeek.map((ss) => ss.length / patientCount),
    },
    evolution: { value: [...evolutionSeries].reverse().find((x) => x != null) ?? null, series: evolutionSeries },
    alerts: {
      total: alertsInPeriod.length,
      byLevel,
      series: weeks.map((w) => input.alerts.filter((a) => inRange(a.createdAt, w)).length),
    },
    regularity: { value: now.regularity, silentNow: now.silent, series: snapshots.map((s) => s.regularity) },
    control: { value: now.control, evaluated: now.evaluated, series: snapshots.map((s) => s.control) },
    response: { value: median(allResponses), count: allResponses.length, series: responseSeries },
  };
}
