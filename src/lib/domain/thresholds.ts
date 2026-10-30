import { CONFIG } from "./config";
import type { BP, PatientProfile, SymptomType } from "./types";

export const DANGER_SYMPTOMS: readonly SymptomType[] = [
  "CHEST_PAIN",
  "VISION",
  "CONFUSION",
  "WEAKNESS",
  "SPEECH",
];

export const ALL_SYMPTOMS: readonly SymptomType[] = [
  "HEADACHE",
  "DIZZINESS",
  "NOSEBLEED",
  ...DANGER_SYMPTOMS,
];

/** The patient's own target, or the default. Use this everywhere, including indicators. */
export function patientTarget(p: Pick<PatientProfile, "targetSys" | "targetDia">): BP {
  return {
    sys: p.targetSys ?? CONFIG.defaultTarget.sys,
    dia: p.targetDia ?? CONFIG.defaultTarget.dia,
  };
}

/** "Above" a threshold: systolic ≥ sys OR diastolic ≥ dia. */
export function isAbove(bp: BP, threshold: BP): boolean {
  return bp.sys >= threshold.sys || bp.dia >= threshold.dia;
}

/** "Below low": systolic < sys OR diastolic < dia. */
export function isBelowLow(bp: BP): boolean {
  return bp.sys < CONFIG.low.sys || bp.dia < CONFIG.low.dia;
}

export function isDangerSymptom(s: SymptomType): boolean {
  return DANGER_SYMPTOMS.includes(s);
}

export function dangerSymptomsIn(symptoms: readonly SymptomType[]): SymptomType[] {
  return symptoms.filter(isDangerSymptom);
}

/** Above target or below low: the reading needs a confirmation session. */
export function needsConfirmation(bp: BP, target: BP): boolean {
  return isAbove(bp, target) || isBelowLow(bp);
}

/**
 * The highest threshold a reading crosses. A confirmation must reach the
 * same tier as the session it confirms ("also above the same threshold").
 */
export type Tier = "CRISIS" | "HIGH" | "ABOVE_TARGET" | "LOW" | "NONE";

export function tierOf(bp: BP, target: BP): Tier {
  if (isAbove(bp, CONFIG.crisis)) return "CRISIS";
  if (isAbove(bp, CONFIG.high)) return "HIGH";
  if (isAbove(bp, target)) return "ABOVE_TARGET";
  if (isBelowLow(bp)) return "LOW";
  return "NONE";
}

const HIGH_SIDE: readonly Tier[] = ["ABOVE_TARGET", "HIGH", "CRISIS"];

/** Does `second` reach the tier of `first`? */
export function reachesTier(first: Tier, second: Tier): boolean {
  if (first === "LOW") return second === "LOW";
  const need = HIGH_SIDE.indexOf(first);
  return need >= 0 && HIGH_SIDE.indexOf(second) >= need;
}
