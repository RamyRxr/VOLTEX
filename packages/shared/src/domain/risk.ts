import { CONFIG } from "./config";
import { ageOn, bmiOf } from "./pregnancy";
import { answeredYes, WATCH_ITEMS } from "./questionnaire";
import { twoOfLastThree } from "./sessions";
import { computeTrend } from "./trend";
import { DAY, RISK_CATEGORIES, within, type QuestionnaireRecord, type RiskCategory, type SessionRecord } from "./types";

/** Profile fields read by the risk rules (spec §6.6). Factors TO VALIDATE. */
export interface RiskProfile {
  readonly birthDate: Date;
  readonly firstPregnancy: boolean;
  readonly multiplePregnancy: boolean;
  readonly chronicHypertension: boolean;
  readonly previousPreeclampsia: boolean;
  readonly preexistingDiabetes: boolean;
  readonly kidneyDisease: boolean;
  readonly autoimmuneDisease: boolean;
  readonly familyPreeclampsia: boolean;
  readonly ivfPregnancy: boolean;
  readonly heightCm?: number | null;
  readonly weightKg?: number | null;
}

export type FactorWeight = "HIGH" | "MODERATE";

export interface RiskFactor {
  readonly code: string;
  readonly label: string;
  readonly weight: FactorWeight;
}

export interface RiskResult {
  readonly category: RiskCategory;
  /** Category from the profile alone; the result is never below it. */
  readonly initialCategory: RiskCategory;
  readonly factors: readonly RiskFactor[];
  readonly reasons: readonly string[];
}

export interface RecentData {
  readonly sessions: readonly SessionRecord[];
  readonly questionnaires: readonly QuestionnaireRecord[];
}

type Flag = keyof Omit<RiskProfile, "birthDate" | "heightCm" | "weightKg">;

const PROFILE_FACTORS: readonly { flag: Flag; code: string; label: string; weight: FactorWeight }[] = [
  { flag: "previousPreeclampsia", code: "PREVIOUS_PREECLAMPSIA", label: "Antécédent de pré-éclampsie", weight: "HIGH" },
  { flag: "chronicHypertension", code: "CHRONIC_HYPERTENSION", label: "Hypertension chronique", weight: "HIGH" },
  { flag: "preexistingDiabetes", code: "PREEXISTING_DIABETES", label: "Diabète avant la grossesse", weight: "HIGH" },
  { flag: "kidneyDisease", code: "KIDNEY_DISEASE", label: "Maladie rénale", weight: "HIGH" },
  { flag: "autoimmuneDisease", code: "AUTOIMMUNE_DISEASE", label: "Maladie auto-immune", weight: "HIGH" },
  { flag: "multiplePregnancy", code: "MULTIPLE_PREGNANCY", label: "Grossesse multiple", weight: "HIGH" },
  { flag: "firstPregnancy", code: "FIRST_PREGNANCY", label: "Première grossesse", weight: "MODERATE" },
  { flag: "familyPreeclampsia", code: "FAMILY_PREECLAMPSIA", label: "Pré-éclampsie dans la famille", weight: "MODERATE" },
  { flag: "ivfPregnancy", code: "IVF_PREGNANCY", label: "Grossesse par FIV", weight: "MODERATE" },
];

export const RISK_LABELS: Readonly<Record<RiskCategory, string>> = { LOW: "faible", MODERATE: "modéré", HIGH: "élevé" };

const rank = (c: RiskCategory): number => RISK_CATEGORIES.indexOf(c);
const atLeast = (a: RiskCategory, b: RiskCategory): RiskCategory => (rank(a) >= rank(b) ? a : b);
const oneUp = (c: RiskCategory): RiskCategory => RISK_CATEGORIES[rank(c) + 1] ?? "HIGH";

export const riskRank = rank;

/** Factors known from the profile on `now`. */
export function profileFactors(profile: RiskProfile, now: Date): RiskFactor[] {
  const flags = PROFILE_FACTORS.filter((f) => profile[f.flag]).map(({ code, label, weight }) => ({ code, label, weight }));
  const age = ageOn(profile.birthDate, now);
  const bmi = bmiOf(profile.heightCm, profile.weightKg);
  const ageFactor: RiskFactor[] =
    age >= CONFIG.risk.ageHigh ? [{ code: "AGE", label: `Âge ${age} ans (≥ ${CONFIG.risk.ageHigh})`, weight: "MODERATE" }] : [];
  const bmiFactor: RiskFactor[] =
    bmi != null && bmi >= CONFIG.risk.bmiHigh
      ? [{ code: "BMI", label: `IMC ${bmi.toFixed(1)} (≥ ${CONFIG.risk.bmiHigh})`, weight: "MODERATE" }]
      : [];
  return [...flags, ...ageFactor, ...bmiFactor];
}

/** HIGH if ≥ 1 high-weight or ≥ 2 moderate factors; MODERATE if 1 moderate; else LOW. */
export function initialCategory(factors: readonly RiskFactor[]): RiskCategory {
  const high = factors.filter((f) => f.weight === "HIGH").length;
  const moderate = factors.filter((f) => f.weight === "MODERATE").length;
  if (high >= 1 || moderate >= 2) return "HIGH";
  if (moderate === 1) return "MODERATE";
  return "LOW";
}

/** Explainable, rule-based risk estimate (spec §6.6). Never lowers below the initial category. */
export function estimateRisk(profile: RiskProfile, recent: RecentData, now: Date): RiskResult {
  const base = profileFactors(profile, now);
  const initial = initialCategory(base);

  const hypertensive = twoOfLastThree(recent.sessions, now) != null;
  const trend = computeTrend(recent.sessions, now);
  const recentWatch = within(recent.questionnaires, (q) => q.answeredAt, now, CONFIG.watchItemsWindowDays * DAY).some(
    (q) => answeredYes(q.answers, WATCH_ITEMS).length > 0,
  );

  let category = initial;
  const observed: RiskFactor[] = [];
  const reasons: string[] = [];
  if (hypertensive) {
    category = atLeast(category, "HIGH");
    observed.push({ code: "OBS_HYPERTENSIVE", label: "2 des 3 dernières mesures ≥ 140/90", weight: "HIGH" });
    reasons.push("Mesures en zone hypertensive : risque au moins élevé");
  }
  if (trend?.rising) {
    category = oneUp(category);
    observed.push({ code: "OBS_TREND", label: `Systolique en hausse (+${trend.perWeek.toFixed(1)} mmHg/semaine)`, weight: "MODERATE" });
    reasons.push("Tendance de la tension à la hausse : risque relevé d'un niveau");
  }
  if (recentWatch) {
    category = oneUp(category);
    observed.push({ code: "OBS_WATCH_ITEMS", label: "Symptômes à surveiller ces 7 derniers jours", weight: "MODERATE" });
    reasons.push("Symptômes à surveiller déclarés : risque relevé d'un niveau");
  }

  const profileReason = base.length === 0 ? "Aucun facteur de risque dans le profil" : `${base.length} facteur(s) dans le profil`;
  return {
    category: atLeast(category, initial),
    initialCategory: initial,
    factors: [...base, ...observed],
    reasons: [profileReason, ...reasons],
  };
}
