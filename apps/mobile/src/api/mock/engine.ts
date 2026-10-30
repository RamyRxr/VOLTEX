/**
 * DEMO STAND-IN for the server engine (packages/shared evaluate / estimateRisk, CLAUDE.md §6).
 * It exists only so the interface can be used before the API is live, and is deleted when
 * EXPO_PUBLIC_API_URL points at the real backend. Thresholds come from `shared`, never from here.
 */
import { CONFIG, isHypertensive, isSevere } from "shared";
import type { Answers, BpSession, Evaluation, PatientProfile, Questionnaire, Risk, RiskCategory, RiskFactor, SessionStatus } from "../types";
import { DANGER_ITEMS, WATCH_ITEMS } from "@/lib/questionnaireItems";
import { ageInYears } from "@/lib/pregnancy";

const MIN = 60_000;
const DAY = 24 * 60 * MIN;
const VALID: readonly SessionStatus[] = ["NORMAL", "HYPERTENSIVE", "SEVERE_CONFIRMED"];

const time = (iso: string) => new Date(iso).getTime();

const MESSAGES = {
  EMERGENCY: { word: "Urgent", text: "Allez aux urgences de la maternité ou appelez le 14 maintenant." },
  SEVERE: {
    word: "Urgent",
    text: "Votre tension reste très élevée. Allez aux urgences de la maternité ou appelez le 14 maintenant.",
  },
  REMEASURE: {
    word: "À refaire",
    text: "Votre tension est très élevée. Restez assise au calme, puis mesurez à nouveau à la fin du compte à rebours.",
  },
  HIGH: {
    word: "Attention",
    text: "Votre tension est élevée sur plusieurs mesures. Votre médecin est prévenu. Continuez vos mesures comme prévu.",
  },
  WATCH: {
    word: "À surveiller",
    text: "Continuez vos mesures. Si un symptôme apparaît ou s'aggrave, répondez au questionnaire.",
  },
  OK: { word: "Bon", text: "Votre tension est dans les valeurs attendues. Continuez comme ça." },
} as const;

function evaluation(level: Evaluation["level"], key: keyof typeof MESSAGES, extra: Partial<Evaluation> = {}): Evaluation {
  return { level, patientWord: MESSAGES[key].word, message: MESSAGES[key].text, icon: level, color: level, ...extra };
}

export function validSessions(sessions: readonly BpSession[]): BpSession[] {
  return sessions.filter((s) => VALID.includes(s.status));
}

/** 2 of the last 3 valid sessions at or above 140/90. */
export function twoOfLastThreeHigh(sessions: readonly BpSession[]): boolean {
  const lastThree = validSessions(sessions).slice(-3);
  return lastThree.filter((s) => isHypertensive(s)).length >= 2;
}

/** Linear regression of systolic over the trend window, in mmHg per week. */
export function risingTrend(sessions: readonly BpSession[], now: Date): boolean {
  const since = now.getTime() - CONFIG.trend.windowDays * DAY;
  const points = validSessions(sessions).filter((s) => time(s.takenAt) >= since);
  if (points.length < CONFIG.trend.minSessions) return false;
  const xs = points.map((s) => time(s.takenAt) / (7 * DAY));
  const ys = points.map((s) => s.sys);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let den = 0;
  xs.forEach((x, i) => {
    num += (x - mx) * ((ys[i] ?? my) - my);
    den += (x - mx) ** 2;
  });
  return den > 0 && num / den >= CONFIG.trend.minSlopeSysPerWeek;
}

function recentWatchAnswer(questionnaires: readonly Questionnaire[], now: Date, days: number): boolean {
  const since = now.getTime() - days * DAY;
  return questionnaires.some((q) => time(q.answeredAt) >= since && WATCH_ITEMS.some((item) => q.answers[item]));
}

/** Level from the patient's recent data, once danger and severe cases are ruled out. */
function classify(sessions: readonly BpSession[], questionnaires: readonly Questionnaire[], now: Date): Evaluation {
  if (twoOfLastThreeHigh(sessions)) return evaluation("HIGH", "HIGH");
  if (risingTrend(sessions, now) || recentWatchAnswer(questionnaires, now, 1)) return evaluation("WATCH", "WATCH");
  return evaluation("OK", "OK");
}

export interface SessionOutcome {
  readonly status: SessionStatus;
  /** A previously pending severe session resolved by this one. */
  readonly resolved: { readonly id: string; readonly status: SessionStatus } | null;
  readonly evaluation: Evaluation;
}

export function evaluateSession(
  previous: readonly BpSession[],
  questionnaires: readonly Questionnaire[],
  bp: { sys: number; dia: number },
  now: Date,
  demoMode: boolean,
): SessionOutcome {
  const windowStart = now.getTime() - CONFIG.confirmationWindowMinutes * MIN;
  const pending = [...previous].reverse().find((s) => s.status === "SEVERE_PENDING" && time(s.takenAt) >= windowStart);

  if (pending) {
    if (isSevere(bp)) {
      return {
        status: "SEVERE_CONFIRMED",
        resolved: { id: pending.id, status: "SEVERE_CONFIRMED" },
        evaluation: evaluation("SEVERE", "SEVERE", { action: "CALL_EMERGENCY" }),
      };
    }
    const status: SessionStatus = isHypertensive(bp) ? "HYPERTENSIVE" : "NORMAL";
    const next = previous.map((s) => (s.id === pending.id ? { ...s, status: "SEVERE_NOT_CONFIRMED" as const } : s));
    return {
      status,
      resolved: { id: pending.id, status: "SEVERE_NOT_CONFIRMED" },
      evaluation: classify([...next, fakeSession(bp, now, status)], questionnaires, now),
    };
  }

  if (isSevere(bp)) {
    const seconds = demoMode ? CONFIG.demoMode.confirmSevereAfterSeconds : CONFIG.confirmSevereAfterMinutes * 60;
    return {
      status: "SEVERE_PENDING",
      resolved: null,
      evaluation: evaluation("HIGH", "REMEASURE", { action: "REMEASURE", remeasureInSeconds: seconds }),
    };
  }

  const status: SessionStatus = isHypertensive(bp) ? "HYPERTENSIVE" : "NORMAL";
  return { status, resolved: null, evaluation: classify([...previous, fakeSession(bp, now, status)], questionnaires, now) };
}

function fakeSession(bp: { sys: number; dia: number }, now: Date, status: SessionStatus): BpSession {
  return { id: "new", sys: bp.sys, dia: bp.dia, pulse: null, takenAt: now.toISOString(), source: "MANUAL", status };
}

export function evaluateQuestionnaire(
  sessions: readonly BpSession[],
  previous: readonly Questionnaire[],
  answers: Answers,
  now: Date,
): Evaluation {
  if (DANGER_ITEMS.some((item) => answers[item])) return evaluation("EMERGENCY", "EMERGENCY", { action: "CALL_EMERGENCY" });
  const q: Questionnaire = { id: "new", answers, answeredAt: now.toISOString() };
  return classify(sessions, [...previous, q], now);
}

const HIGH_FACTORS: readonly [keyof PatientProfile, string, string][] = [
  ["previousPreeclampsia", "PREVIOUS_PREECLAMPSIA", "Pré-éclampsie lors d'une grossesse précédente"],
  ["chronicHypertension", "CHRONIC_HYPERTENSION", "Hypertension avant la grossesse"],
  ["preexistingDiabetes", "PREEXISTING_DIABETES", "Diabète avant la grossesse"],
  ["kidneyDisease", "KIDNEY_DISEASE", "Maladie des reins"],
  ["autoimmuneDisease", "AUTOIMMUNE_DISEASE", "Maladie auto-immune"],
  ["multiplePregnancy", "MULTIPLE_PREGNANCY", "Grossesse multiple"],
];

const MODERATE_FACTORS: readonly [keyof PatientProfile, string, string][] = [
  ["firstPregnancy", "FIRST_PREGNANCY", "Première grossesse"],
  ["familyPreeclampsia", "FAMILY_PREECLAMPSIA", "Pré-éclampsie chez la mère ou une sœur"],
  ["ivfPregnancy", "IVF_PREGNANCY", "Grossesse obtenue par FIV"],
];

const ORDER: readonly RiskCategory[] = ["LOW", "MODERATE", "HIGH"];
const raise = (c: RiskCategory): RiskCategory => ORDER[Math.min(ORDER.indexOf(c) + 1, 2)] ?? "HIGH";
const atLeast = (c: RiskCategory, min: RiskCategory): RiskCategory => (ORDER.indexOf(c) >= ORDER.indexOf(min) ? c : min);

export function estimateRisk(
  profile: PatientProfile,
  sessions: readonly BpSession[],
  questionnaires: readonly Questionnaire[],
  trigger: Risk["trigger"],
  now: Date,
): Risk {
  const factors: RiskFactor[] = [];
  for (const [field, code, label] of HIGH_FACTORS) if (profile[field] === true) factors.push({ code, label, weight: "HIGH" });
  for (const [field, code, label] of MODERATE_FACTORS) if (profile[field] === true) factors.push({ code, label, weight: "MODERATE" });

  const age = ageInYears(profile.birthDate, now);
  if (age !== null && age >= CONFIG.risk.ageHigh) factors.push({ code: "AGE", label: `Âge de ${age} ans`, weight: "MODERATE" });
  if (profile.heightCm && profile.weightKg) {
    const bmi = profile.weightKg / (profile.heightCm / 100) ** 2;
    if (bmi >= CONFIG.risk.bmiHigh) factors.push({ code: "BMI", label: `IMC de ${Math.round(bmi)}`, weight: "MODERATE" });
  }

  const high = factors.filter((f) => f.weight === "HIGH").length;
  const moderate = factors.length - high;
  let category: RiskCategory = high >= 1 || moderate >= 2 ? "HIGH" : moderate === 1 ? "MODERATE" : "LOW";
  const reasons: string[] = [];

  if (twoOfLastThreeHigh(sessions)) {
    category = atLeast(category, "HIGH");
    factors.push({ code: "HYPERTENSIVE_SESSIONS", label: "Tension élevée sur 2 des 3 dernières mesures", weight: "HIGH" });
    reasons.push("Vos dernières mesures sont élevées.");
  }
  if (risingTrend(sessions, now)) {
    category = raise(category);
    factors.push({ code: "RISING_TREND", label: "Tension en hausse ces deux dernières semaines", weight: "MODERATE" });
    reasons.push("Votre tension augmente doucement.");
  }
  if (recentWatchAnswer(questionnaires, now, 7)) {
    category = raise(category);
    factors.push({ code: "WATCH_SYMPTOMS", label: "Symptômes signalés cette semaine", weight: "MODERATE" });
    reasons.push("Vous avez signalé des symptômes cette semaine.");
  }

  return { category, factors, reasons, trigger, createdAt: now.toISOString() };
}
