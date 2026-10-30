import { CONFIG } from "./config";
import { answeredYes, DANGER_ITEMS, labelsOf, WATCH_ITEMS } from "./questionnaire";
import { RISK_LABELS, riskRank, type RiskResult } from "./risk";
import { twoOfLastThree } from "./sessions";
import { computeSilence } from "./silence";
import { computeTrend } from "./trend";
import { DAY, hoursToMs, LEVELS, within } from "./types";
import type { AlertLevel, Evidence, Level, QuestionnaireRecord, SessionRecord } from "./types";

export interface EvaluateInput {
  /** All the patient's sessions, statuses already resolved (registerSession / expirePending). */
  readonly sessions: readonly SessionRecord[];
  readonly questionnaires: readonly QuestionnaireRecord[];
  readonly expectedSessionsPerDay: number;
  /** Start of the follow-up (consent), for silence when nothing was ever measured. */
  readonly followUpStart: Date;
  /** Current risk estimate, to detect a category above the initial one. */
  readonly risk?: RiskResult | null;
}

export interface Finding {
  readonly level: AlertLevel;
  readonly evidence: Evidence;
  /** French, human readable. */
  readonly reason: string;
  /** Session or questionnaire id behind the finding. */
  readonly sourceId?: string;
}

export interface EvaluationResult {
  /** Most severe level (spec §6.4); OK when nothing applies. */
  readonly level: Level;
  /** SILENT shown as an extra tag when another level applies. */
  readonly silent: boolean;
  /** A SEVERE_PENDING or SEVERE_EXPIRED reading in the acute window (triage group 3). */
  readonly unconfirmedSevere: SessionRecord | null;
  /** Every rule that fired, most severe first — one alert each (de-duplicated by the API). */
  readonly findings: readonly Finding[];
}

const bp = (s: SessionRecord): string => `${s.sys}/${s.dia}`;
const levelRank = (l: Level): number => LEVELS.indexOf(l);

function dangerFinding(questionnaires: readonly QuestionnaireRecord[], now: Date): Finding | null {
  const recent = within(questionnaires, (q) => q.answeredAt, now, hoursToMs(CONFIG.acuteWindowHours));
  for (const q of recent) {
    const items = answeredYes(q.answers, DANGER_ITEMS);
    if (items.length > 0) {
      return { level: "EMERGENCY", evidence: "DANGER_ITEM", reason: `Signe de danger déclaré : ${labelsOf(items)}`, sourceId: q.id };
    }
  }
  return null;
}

function severeFinding(sessions: readonly SessionRecord[], now: Date): Finding | null {
  const confirmed = within(sessions, (s) => s.takenAt, now, hoursToMs(CONFIG.acuteWindowHours)).filter(
    (s) => s.status === "SEVERE_CONFIRMED",
  );
  const [latest] = confirmed;
  if (!latest) return null;
  const readings = [...confirmed].reverse().map(bp).join(" puis ");
  return { level: "SEVERE", evidence: "CONFIRMED_SEVERE", reason: `Tension sévère confirmée : ${readings}`, sourceId: latest.id };
}

function highFinding(sessions: readonly SessionRecord[], now: Date): Finding | null {
  const high = twoOfLastThree(sessions, now);
  const latest = high?.[0];
  if (!high || !latest) return null;
  return {
    level: "HIGH",
    evidence: "TWO_OF_THREE",
    reason: `2 des 3 dernières mesures ≥ ${CONFIG.bp.hypertension.sys}/${CONFIG.bp.hypertension.dia} (${high.map(bp).join(", ")})`,
    sourceId: latest.id,
  };
}

function watchFindings(input: EvaluateInput, now: Date): Finding[] {
  const trend = computeTrend(input.sessions, now);
  const trendF: Finding[] = trend?.rising
    ? [{ level: "WATCH", evidence: "TREND", reason: `Systolique en hausse : +${trend.perWeek.toFixed(1)} mmHg/semaine sur ${CONFIG.trend.windowDays} jours` }]
    : [];
  const risk = input.risk;
  const riskF: Finding[] =
    risk && riskRank(risk.category) > riskRank(risk.initialCategory)
      ? [{ level: "WATCH", evidence: "RISK_INCREASED", reason: `Risque augmenté : ${RISK_LABELS[risk.initialCategory]} → ${RISK_LABELS[risk.category]}` }]
      : [];
  const recent = within(input.questionnaires, (q) => q.answeredAt, now, CONFIG.watchItemsWindowDays * DAY);
  const withWatch = recent.find((q) => answeredYes(q.answers, WATCH_ITEMS).length > 0);
  const itemF: Finding[] = withWatch
    ? [{ level: "WATCH", evidence: "WATCH_ITEM", reason: `Symptôme à surveiller : ${labelsOf(answeredYes(withWatch.answers, WATCH_ITEMS))}`, sourceId: withWatch.id }]
    : [];
  return [...trendF, ...riskF, ...itemF];
}

/** Latest unconfirmed severe reading (pending or expired) in the acute window. */
export function unconfirmedSevereOf(sessions: readonly SessionRecord[], now: Date): SessionRecord | null {
  return (
    within(sessions, (s) => s.takenAt, now, hoursToMs(CONFIG.acuteWindowHours)).find(
      (s) => s.status === "SEVERE_PENDING" || s.status === "SEVERE_EXPIRED",
    ) ?? null
  );
}

/**
 * Detection (spec §6.4), independent from the risk category except for the
 * "risk increased" watch rule. A danger answer stops the evaluation.
 */
export function evaluate(input: EvaluateInput, now: Date): EvaluationResult {
  const unconfirmedSevere = unconfirmedSevereOf(input.sessions, now);
  const silence = computeSilence(input.sessions, input.expectedSessionsPerDay, input.followUpStart, now);

  const danger = dangerFinding(input.questionnaires, now);
  if (danger) return { level: "EMERGENCY", silent: silence.silent, unconfirmedSevere, findings: [danger] };

  const silenceF: Finding[] = silence.silent
    ? [{
        level: "SILENT",
        evidence: "SILENCE",
        reason: silence.neverMeasured
          ? `Aucune mesure depuis le début du suivi (${silence.hours} h)`
          : `Aucune mesure depuis ${silence.hours} h (attendu : toutes les ${24 / Math.max(input.expectedSessionsPerDay, 1)} h)`,
      }]
    : [];
  const severe = severeFinding(input.sessions, now);
  const high = highFinding(input.sessions, now);
  const findings = [...(severe ? [severe] : []), ...(high ? [high] : []), ...watchFindings(input, now), ...silenceF];

  const level = findings.reduce<Level>((acc, f) => (levelRank(f.level) < levelRank(acc) ? f.level : acc), "OK");
  return { level, silent: silence.silent, unconfirmedSevere, findings };
}
