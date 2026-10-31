import {
  CONFIG,
  ITEM_LABELS,
  QUESTIONNAIRE_ITEMS,
  computeTrend,
  pregnancyWeek,
  validNewestFirst,
  type QuestionnaireItem,
} from "shared";
import { currentState, loadPatientData } from "@/server/pipeline";
import { db } from "@/server/db";

/**
 * The computed facts an AI text may use (spec §9.1): nothing else reaches the
 * model — no name, no phone, no free text written by the patient.
 */
export interface PatientFacts {
  readonly pregnancyWeek: { weeks: number; days: number } | null;
  readonly level: string;
  readonly findings: readonly string[];
  readonly unconfirmedSevere: { sys: number; dia: number; hoursAgo: number } | null;
  readonly lastReadings: readonly { sys: number; dia: number; hoursAgo: number; status: string }[];
  readonly average7Days: { sys: number; dia: number; count: number } | null;
  readonly trendSysPerWeek: number | null;
  readonly symptoms7Days: readonly string[];
  readonly riskCategory: string;
  readonly riskFactors: readonly string[];
  readonly expectedPerDay: number;
}

const HOUR = 3_600_000;
const LAST_READINGS = 6;
const SEVEN_DAYS = 7 * 24 * HOUR;
const hoursAgo = (d: Date, now: Date): number => Math.max(0, Math.round((now.getTime() - d.getTime()) / HOUR));

export async function patientFacts(patientId: string, now: Date): Promise<PatientFacts> {
  const data = await loadPatientData(db, patientId, now);
  const { risk, result } = currentState(data, now);
  const valid = validNewestFirst(data.sessions, now);
  const week = valid.filter((s) => now.getTime() - s.takenAt.getTime() <= SEVEN_DAYS);
  const trend = computeTrend(data.sessions, now);
  const yes = new Set<QuestionnaireItem>();
  for (const q of data.questionnaires) {
    if (now.getTime() - q.answeredAt.getTime() > SEVEN_DAYS) continue;
    for (const item of QUESTIONNAIRE_ITEMS) if (q.answers[item] === true) yes.add(item);
  }
  const unconfirmed = result.unconfirmedSevere;
  return {
    pregnancyWeek: pregnancyWeek(data.patient, now),
    level: result.level,
    findings: result.findings.map((f) => f.reason),
    unconfirmedSevere: unconfirmed ? { sys: unconfirmed.sys, dia: unconfirmed.dia, hoursAgo: hoursAgo(unconfirmed.takenAt, now) } : null,
    lastReadings: [...data.sessions]
      .sort((a, b) => b.takenAt.getTime() - a.takenAt.getTime())
      .slice(0, LAST_READINGS)
      .map((s) => ({ sys: s.sys, dia: s.dia, hoursAgo: hoursAgo(s.takenAt, now), status: s.status })),
    average7Days: week.length
      ? {
          sys: Math.round(week.reduce((a, s) => a + s.sys, 0) / week.length),
          dia: Math.round(week.reduce((a, s) => a + s.dia, 0) / week.length),
          count: week.length,
        }
      : null,
    trendSysPerWeek: trend ? Math.round(trend.perWeek * 10) / 10 : null,
    symptoms7Days: [...yes].map((item) => ITEM_LABELS[item]),
    riskCategory: risk.category,
    riskFactors: risk.factors.map((f) => f.label),
    expectedPerDay: data.patient.expectedSessionsPerDay ?? CONFIG.expectedSessionsPerDay,
  };
}
