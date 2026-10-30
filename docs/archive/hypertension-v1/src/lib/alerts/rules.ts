/**
 * TensioCare — alert rule engine
 *
 * PURE. No Prisma, no fetch, no Date.now(), no process.env.
 * `now` is always injected. Same input -> same output, forever.
 *
 * This file is the ONLY place a blood-pressure number may appear.
 * See ALERT-RULES.md for the normative spec and the test table.
 */

/* ------------------------------------------------------------------ */
/* Thresholds — single source of truth                                */
/* ------------------------------------------------------------------ */

export const T = {
  HOME_TARGET: { sys: 135, dia: 85 }, // default when the patient has no personal target
  ORANGE_READING: { sys: 160, dia: 100 },
  CRISIS_READING: { sys: 180, dia: 120 },
  LOW: { sys: 90, dia: 60 },

  CONFIRM_MINUTES: 30,
  RECHECK_MINUTES: 5,

  TREND_MIN_PER_WEEK: 2.0,
  TREND_HORIZON_DAYS: 21,
  TREND_MIN_SESSIONS: 5,
  TREND_WINDOW_DAYS: 14,

  PATTERN_MIN_DIFF: 5,
  PATTERN_MIN_GROUP: 2,

  WHITECOAT_DIFF: 10,

  SILENCE_MULTIPLIER: 2,
  SILENCE_MIN_DAYS: 3,
} as const;

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

export type Symptom =
  | 'HEADACHE'
  | 'DIZZINESS'
  | 'NOSEBLEED'
  | 'CHEST_PAIN'
  | 'VISION'
  | 'CONFUSION'
  | 'WEAKNESS'
  | 'SPEECH';

export const DANGER_SYMPTOMS: readonly Symptom[] = [
  'CHEST_PAIN',
  'VISION',
  'CONFUSION',
  'WEAKNESS',
  'SPEECH',
];

export const SYMPTOM_LABEL: Record<Symptom, string> = {
  HEADACHE: 'headache',
  DIZZINESS: 'dizziness',
  NOSEBLEED: 'nosebleed',
  CHEST_PAIN: 'chest pain',
  VISION: 'vision problems',
  CONFUSION: 'confusion',
  WEAKNESS: 'weakness on one side',
  SPEECH: 'difficulty speaking',
};

export type Level =
  | 'EMERGENCY'
  | 'CRISIS'
  | 'PENDING'
  | 'ORANGE'
  | 'YELLOW'
  | 'SILENT'
  | 'GREEN';

export interface Session {
  id: string;
  startedAt: Date;
  avgSys: number;
  avgDia: number;
  avgPulse?: number | null;
  channel?: 'WEB' | 'SMS';
  status: 'PENDING' | 'CONFIRMED';
  /** null = not reported. Never treat null as "missed". */
  pillTaken?: boolean | null;
  symptoms?: Symptom[];
  /** Set on the second session once it has been folded into the first. */
  supersededBySessionId?: string | null;
  confirmedAt?: Date | null;
}

export interface PatientContext {
  targetSys?: number | null;
  targetDia?: number | null;
  expectedReadingsPerWeek?: number;
  highRisk?: boolean;
  lastOfficeSys?: number | null;
  lastOfficeDia?: number | null;
}

export interface EvalInput {
  patient: PatientContext;
  sessions: Session[];
  now: Date;
}

export interface Insight {
  id: 'WHITE_COAT' | 'MASKED' | 'MISSED_PILL' | 'TREND' | 'ADHERENCE';
  title: string;
  body: string;
}

export interface EvalResult {
  level: Level;
  rank: number;
  ruleId: string;
  evidence: string;
  patientMessage: string;
  notifyDoctorNow: boolean;
  insights: Insight[];
  stats: {
    avg7: { sys: number; dia: number } | null;
    trendPerWeek: number | null;
    adherence: number | null;
    silentDays: number | null;
    lastSessionAt: Date | null;
  };
}

export const RANK: Record<Level, number> = {
  EMERGENCY: 0,
  CRISIS: 1,
  PENDING: 2,
  ORANGE: 3,
  YELLOW: 4,
  SILENT: 5,
  GREEN: 6,
};

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

const DAY = 86_400_000;
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const r0 = (n: number) => Math.round(n);
const r1 = (n: number) => Math.round(n * 10) / 10;
const days = (ms: number) => ms / DAY;
const byTimeAsc = (a: Session, b: Session) => a.startedAt.getTime() - b.startedAt.getTime();

/** Sessions that count for statistics: confirmed, and not folded into another. */
const statistical = (sessions: Session[]) =>
  sessions
    .filter((s) => s.status === 'CONFIRMED' && !s.supersededBySessionId)
    .sort(byTimeAsc);

const crossesHigh = (sys: number, dia: number, t: { sys: number; dia: number }) =>
  sys >= t.sys || dia >= t.dia;

const isLow = (sys: number, dia: number) =>
  sys < T.LOW.sys || dia < T.LOW.dia;

function silenceWindowDays(expectedPerWeek = 3): number {
  const interval = 7 / Math.max(expectedPerWeek, 1);
  return Math.max(T.SILENCE_MIN_DAYS, Math.round(T.SILENCE_MULTIPLIER * interval));
}

/** Ordinary least squares on (daysSinceFirst, value). */
function slopePerDay(points: { x: number; y: number }[]): number {
  const n = points.length;
  if (n < 2) return 0;
  const mx = mean(points.map((p) => p.x));
  const my = mean(points.map((p) => p.y));
  let sxy = 0;
  let sxx = 0;
  for (const p of points) {
    sxy += (p.x - mx) * (p.y - my);
    sxx += (p.x - mx) ** 2;
  }
  return sxx === 0 ? 0 : sxy / sxx;
}

/* ------------------------------------------------------------------ */
/* Patient-facing copy (FR). Arabic lives in the i18n dictionary.     */
/* ------------------------------------------------------------------ */

const MSG: Record<Level, string> = {
  EMERGENCY: 'Appelez le 14 maintenant.',
  CRISIS:
    "Reposez-vous 30 minutes, remesurez, et contactez votre medecin aujourd'hui.",
  PENDING: 'Reposez-vous 5 minutes et remesurez.',
  ORANGE: 'Votre tension est elevee. Votre medecin a ete informe.',
  YELLOW: 'Continuez a mesurer. Pensez a votre traitement et au sel.',
  SILENT: "Vous n'avez pas mesure recemment.",
  GREEN: 'Bon, continuez comme ca.',
};

/* ------------------------------------------------------------------ */
/* Evidence strings — always generated, never typed by a component    */
/* ------------------------------------------------------------------ */

const ev = {
  emergency: (sys: number, dia: number, symptoms: Symptom[]) =>
    `Danger sign (${symptoms.map((s) => SYMPTOM_LABEL[s]).join(', ')}) with ${sys}/${dia}. Call 14 now.`,

  pending: (sys: number, dia: number) =>
    `Unconfirmed ${sys}/${dia} — patient did not re-measure.`,

  crisis: (sys: number, dia: number) =>
    `Confirmed ${sys}/${dia}: crisis level (>=180/120).`,

  orangeHigh: (hits: { sys: number; dia: number }[], n: number) =>
    `${n} of the last 3 readings above 160/100 (${hits
      .map((h) => `${h.sys}/${h.dia}`)
      .join(', ')}).`,

  orangeLow: (hits: { sys: number; dia: number }[], n: number) =>
    `${n} of the last 3 readings below 90/60 with dizziness (${hits
      .map((h) => `${h.sys}/${h.dia}`)
      .join(', ')}).`,

  avg: (
    a: { sys: number; dia: number },
    t: { sys: number; dia: number },
    window: '7-day home average' | 'last 3 readings' = '7-day home average',
  ) => `${window} ${a.sys}/${a.dia}, above target ${t.sys}/${t.dia}.`,

  trend: (perWeek: number, daysToTarget: number) =>
    `Systolic rising ${r1(perWeek)} mmHg/week over 14 days; likely above target in about ${r0(
      daysToTarget,
    )} days.`,

  pattern: (diff: number, missed: { sys: number; dia: number }, taken: { sys: number; dia: number }, n: number) =>
    `Readings ${r0(diff)} mmHg higher on days with a missed pill (${missed.sys}/${missed.dia} vs ${taken.sys}/${taken.dia}, ${n} sessions).`,

  silent: (n: number, expected: number) =>
    `Silent: no readings for ${n} days, expected ${expected} per week.`,

  green: (a: { sys: number; dia: number }, t: { sys: number; dia: number }) =>
    `Within target (${a.sys}/${a.dia} vs ${t.sys}/${t.dia}).`,
};

/* ------------------------------------------------------------------ */
/* Engine                                                             */
/* ------------------------------------------------------------------ */

export function evaluatePatient(input: EvalInput): EvalResult {
  const { now } = input;
  const target = {
    sys: input.patient.targetSys ?? T.HOME_TARGET.sys,
    dia: input.patient.targetDia ?? T.HOME_TARGET.dia,
  };
  const expected = input.patient.expectedReadingsPerWeek ?? 3;

  const all = [...input.sessions].sort(byTimeAsc);
  const stats = statistical(all);
  const latestAny = all.length ? all[all.length - 1] : null;
  const latestConfirmed = stats.length ? stats[stats.length - 1] : null;
  const last3 = stats.slice(-3);

  /* ---- shared stats & insights (always computed) ---- */

  const in7 = stats.filter((s) => days(now.getTime() - s.startedAt.getTime()) <= 7);
  const avgWindow = in7.length >= 3 ? in7 : stats.length >= 3 ? last3 : null;
  const avg7 = avgWindow
    ? { sys: r0(mean(avgWindow.map((s) => s.avgSys))), dia: r0(mean(avgWindow.map((s) => s.avgDia))) }
    : null;

  const silentDays = latestConfirmed
    ? Math.floor(days(now.getTime() - latestConfirmed.startedAt.getTime()))
    : null;

  const pillSessions = stats.filter((s) => s.pillTaken === true || s.pillTaken === false);
  const adherence = pillSessions.length
    ? pillSessions.filter((s) => s.pillTaken === true).length / pillSessions.length
    : null;

  // trend over the last 14 days
  const trendWindow = stats.filter(
    (s) => days(now.getTime() - s.startedAt.getTime()) <= T.TREND_WINDOW_DAYS,
  );
  let trendPerWeek: number | null = null;
  let daysToTarget: number | null = null;
  if (trendWindow.length >= T.TREND_MIN_SESSIONS) {
    const t0 = trendWindow[0].startedAt.getTime();
    const pts = trendWindow.map((s) => ({ x: days(s.startedAt.getTime() - t0), y: s.avgSys }));
    const m = slopePerDay(pts);
    trendPerWeek = m * 7;
    const xNow = days(now.getTime() - t0);
    const valueNow = mean(pts.map((p) => p.y)) + m * (xNow - mean(pts.map((p) => p.x)));
    if (m > 0) daysToTarget = (target.sys - valueNow) / m;
  }

  // missed-pill pattern (nulls excluded on purpose)
  const takenGroup = pillSessions.filter((s) => s.pillTaken === true);
  const missedGroup = pillSessions.filter((s) => s.pillTaken === false);
  let pattern:
    | { diff: number; missed: { sys: number; dia: number }; taken: { sys: number; dia: number }; n: number }
    | null = null;
  if (
    takenGroup.length >= T.PATTERN_MIN_GROUP &&
    missedGroup.length >= T.PATTERN_MIN_GROUP &&
    pillSessions.length >= T.PATTERN_MIN_GROUP * 2
  ) {
    const missed = {
      sys: r0(mean(missedGroup.map((s) => s.avgSys))),
      dia: r0(mean(missedGroup.map((s) => s.avgDia))),
    };
    const taken = {
      sys: r0(mean(takenGroup.map((s) => s.avgSys))),
      dia: r0(mean(takenGroup.map((s) => s.avgDia))),
    };
    pattern = { diff: missed.sys - taken.sys, missed, taken, n: pillSessions.length };
  }

  const insights: Insight[] = [];
  if (pattern && pattern.diff >= T.PATTERN_MIN_DIFF) {
    insights.push({
      id: 'MISSED_PILL',
      title: 'Missed pill',
      body: ev.pattern(pattern.diff, pattern.missed, pattern.taken, pattern.n),
    });
  }
  if (avg7 && input.patient.lastOfficeSys != null) {
    const officeSys = input.patient.lastOfficeSys;
    const officeDia = input.patient.lastOfficeDia ?? avg7.dia;
    const homeHigh = avg7.sys > target.sys || avg7.dia > target.dia;
    if (officeSys - avg7.sys >= T.WHITECOAT_DIFF && !homeHigh) {
      insights.push({
        id: 'WHITE_COAT',
        title: 'White-coat effect',
        body: `Home ${avg7.sys}/${avg7.dia} vs office ${officeSys}/${officeDia}: possible white-coat effect.`,
      });
    } else if (avg7.sys - officeSys >= T.WHITECOAT_DIFF && homeHigh) {
      insights.push({
        id: 'MASKED',
        title: 'Masked hypertension',
        body: `Home ${avg7.sys}/${avg7.dia} vs office ${officeSys}/${officeDia}: possible masked hypertension.`,
      });
    }
  }
  if (trendPerWeek != null) {
    insights.push({
      id: 'TREND',
      title: 'Trend',
      body:
        trendPerWeek > 0
          ? `Systolic rising ${r1(trendPerWeek)} mmHg/week over the last 14 days.`
          : `Systolic stable (${r1(trendPerWeek)} mmHg/week over the last 14 days).`,
    });
  }
  if (adherence != null) {
    insights.push({
      id: 'ADHERENCE',
      title: 'Adherence',
      body: `${r0(adherence * 100)}% of readings tagged "took my pill".`,
    });
  }

  const finish = (
    level: Level,
    ruleId: string,
    evidence: string,
  ): EvalResult => ({
    level,
    rank: RANK[level],
    ruleId,
    evidence,
    patientMessage: MSG[level],
    notifyDoctorNow: level === 'EMERGENCY' || level === 'CRISIS',
    insights,
    stats: {
      avg7,
      trendPerWeek: trendPerWeek == null ? null : r1(trendPerWeek),
      adherence,
      silentDays,
      lastSessionAt: latestConfirmed?.startedAt ?? null,
    },
  });

  /* ---- S0: nothing at all ---- */
  if (!latestAny) {
    return finish('SILENT', 'NEW', 'No readings yet.');
  }

  /* ---- S1: EMERGENCY — danger symptom wins over everything ---- */
  const latestSymptoms = latestAny.symptoms ?? [];
  const danger = latestSymptoms.filter((s) => DANGER_SYMPTOMS.includes(s));
  if (danger.length > 0) {
    return finish(
      'EMERGENCY',
      'EMERGENCY_SYMPTOM',
      ev.emergency(latestAny.avgSys, latestAny.avgDia, danger),
    );
  }

  /* ---- S2: PENDING — an unconfirmed high reading is never invisible ---- */
  if (latestAny.status === 'PENDING' && crossesHigh(latestAny.avgSys, latestAny.avgDia, T.ORANGE_READING)) {
    const ageMinutes = (now.getTime() - latestAny.startedAt.getTime()) / 60_000;
    return ageMinutes > T.CONFIRM_MINUTES
      ? finish('PENDING', 'PENDING_UNCONFIRMED', ev.pending(latestAny.avgSys, latestAny.avgDia))
      : finish(
          'PENDING',
          'PENDING_AWAITING',
          `Awaiting confirmation of ${latestAny.avgSys}/${latestAny.avgDia}.`,
        );
  }

  /* ---- S3: CRISIS on the last confirmed session ---- */
  if (latestConfirmed && crossesHigh(latestConfirmed.avgSys, latestConfirmed.avgDia, T.CRISIS_READING)) {
    return finish('CRISIS', 'CRISIS_CONFIRMED', ev.crisis(latestConfirmed.avgSys, latestConfirmed.avgDia));
  }

  /* ---- S4: ORANGE — 2 of the last 3 high ---- */
  const highHits = last3.filter((s) => crossesHigh(s.avgSys, s.avgDia, T.ORANGE_READING));
  if (highHits.length >= 2) {
    return finish(
      'ORANGE',
      'ORANGE_REPEATED_HIGH',
      ev.orangeHigh(highHits.map((s) => ({ sys: s.avgSys, dia: s.avgDia })), highHits.length),
    );
  }

  /* ---- S5: ORANGE — 2 of the last 3 low, with dizziness ---- */
  const lowHits = last3.filter(
    (s) => isLow(s.avgSys, s.avgDia) && (s.symptoms ?? []).includes('DIZZINESS'),
  );
  if (lowHits.length >= 2) {
    return finish(
      'ORANGE',
      'ORANGE_REPEATED_LOW',
      ev.orangeLow(lowHits.map((s) => ({ sys: s.avgSys, dia: s.avgDia })), lowHits.length),
    );
  }

  /* ---- S6: SILENT ---- */
  if (!latestConfirmed) {
    return finish('SILENT', 'NEW', 'No confirmed readings yet.');
  }
  const windowDays = silenceWindowDays(expected);
  if (silentDays != null && silentDays >= windowDays) {
    return finish('SILENT', 'SILENT', ev.silent(silentDays, expected));
  }

  /* ---- S7: YELLOW — average above target ---- */
  if (avgWindow && avg7) {
    const windowLabel = in7.length >= 3 ? '7-day home average' : 'last 3 readings';
    if (avg7.sys > target.sys || avg7.dia > target.dia) {
      return finish('YELLOW', 'YELLOW_AVG', ev.avg(avg7, target, windowLabel));
    }
  }

  /* ---- S8: YELLOW — rising trend before the average crosses ---- */
  if (trendPerWeek != null && trendPerWeek >= T.TREND_MIN_PER_WEEK && daysToTarget != null) {
    if (daysToTarget > 0 && daysToTarget <= T.TREND_HORIZON_DAYS) {
      return finish('YELLOW', 'YELLOW_TREND', ev.trend(trendPerWeek, daysToTarget));
    }
  }

  /* ---- S9: YELLOW — missed-pill pattern ---- */
  if (pattern && pattern.diff >= T.PATTERN_MIN_DIFF) {
    return finish(
      'YELLOW',
      'YELLOW_PATTERN',
      ev.pattern(pattern.diff, pattern.missed, pattern.taken, pattern.n),
    );
  }

  /* ---- S10: GREEN ---- */
  if (avg7) {
    return finish('GREEN', 'GREEN', ev.green(avg7, target));
  }
  return finish('GREEN', 'GREEN_INSUFFICIENT', 'Not enough readings yet.');
}

/**
 * Should this session trigger a confirmation prompt?
 * True when the session is unconfirmed and above the orange threshold.
 */
export function needsRecheck(session: Pick<Session, 'avgSys' | 'avgDia' | 'status'>): boolean {
  return session.status === 'PENDING' && crossesHigh(session.avgSys, session.avgDia, T.ORANGE_READING);
}
