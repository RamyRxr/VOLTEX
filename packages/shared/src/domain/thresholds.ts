import { CONFIG } from "./config";

export interface BP {
  readonly sys: number;
  readonly dia: number;
}

/** "≥ threshold" means systolic ≥ sys OR diastolic ≥ dia (spec §6.1). */
export const isAtOrAbove = (bp: BP, threshold: BP): boolean => bp.sys >= threshold.sys || bp.dia >= threshold.dia;

/** Hypertensive range or above: ≥ 140/90. */
export const isHypertensive = (bp: BP): boolean => isAtOrAbove(bp, CONFIG.bp.hypertension);

/** Severe range: ≥ 160/110. */
export const isSevere = (bp: BP): boolean => isAtOrAbove(bp, CONFIG.bp.severe);
