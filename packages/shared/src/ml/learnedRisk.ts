import { z } from "zod";
import rawModel from "./hdpLogisticModel.json";

/**
 * Experimental learned risk (doctor only): logistic regression trained on CDC
 * natality data (2022 train, 2023 test), see ml/README.md. It never changes the
 * rule-based levels, alerts or risk (spec §2 rule 1): it is an extra indicator.
 *
 * The weights come from ml/models/hdp_logistic.json; after retraining, copy that
 * file here and run the tests (they compare with Python on 500 reference cases).
 */

const modelSchema = z.object({
  model: z.string(),
  average_risk: z.number(),
  intercept: z.number(),
  factors: z.array(z.object({ code: z.string(), label: z.string(), weight: z.number() })),
  test_2023: z.object({ births: z.number(), roc_auc: z.number() }),
});

const MODEL = modelSchema.parse(rawModel);
const WEIGHTS: ReadonlyMap<string, { label: string; weight: number }> = new Map(
  MODEL.factors.map((f) => [f.code, { label: f.label, weight: f.weight }]),
);

export interface LearnedRiskInput {
  readonly age: number;
  readonly bmi: number | null;
  readonly firstPregnancy: boolean;
  readonly multiplePregnancy: boolean;
  readonly ivfPregnancy: boolean;
  readonly preexistingDiabetes: boolean;
  readonly gestationalDiabetes: boolean;
  readonly chronicHypertension: boolean;
}

export interface LearnedFactor {
  readonly code: string;
  readonly label: string;
  /** Odds multiplier of this factor (e.g. 2.3 = "×2,3"). */
  readonly oddsRatio: number;
}

export type LearnedRisk =
  | {
      readonly applicable: true;
      readonly probability: number;
      /** Average risk of the training population, for comparison. */
      readonly averageRisk: number;
      /** Active factors, strongest first (only those that raise the risk). */
      readonly factors: readonly LearnedFactor[];
      readonly model: string;
      readonly testRocAuc: number;
      readonly testBirths: number;
    }
  | { readonly applicable: false; readonly reason: "CHRONIC_HYPERTENSION"; readonly model: string };

/** Profile → active factor codes, exactly as ml/scripts/train_logistic.py encodes it. */
export function activeFactors(input: LearnedRiskInput): string[] {
  const { age, bmi } = input;
  const bands: [string, boolean][] = [
    ["age_under_20", age < 20],
    ["age_35_39", age >= 35 && age < 40],
    ["age_40_plus", age >= 40],
    ["bmi_25_30", bmi != null && bmi >= 25 && bmi < 30],
    ["bmi_30_35", bmi != null && bmi >= 30 && bmi < 35],
    ["bmi_35_plus", bmi != null && bmi >= 35],
    ["bmi_unknown", bmi == null],
    ["first_pregnancy", input.firstPregnancy],
    ["multiple_pregnancy", input.multiplePregnancy],
    ["infertility_treatment", input.ivfPregnancy],
    ["preexisting_diabetes", input.preexistingDiabetes],
    ["gestational_diabetes", input.gestationalDiabetes],
  ];
  return bands.filter(([, on]) => on).map(([code]) => code);
}

const sigmoid = (x: number): number => 1 / (1 + Math.exp(-x));

/** Probability for a profile; not applicable with chronic hypertension (the data cannot describe it). */
export function learnedRisk(input: LearnedRiskInput): LearnedRisk {
  if (input.chronicHypertension) return { applicable: false, reason: "CHRONIC_HYPERTENSION", model: MODEL.model };
  const codes = activeFactors(input);
  const logit = codes.reduce((sum, code) => sum + (WEIGHTS.get(code)?.weight ?? 0), MODEL.intercept);
  const factors = codes
    .map((code) => ({ code, label: WEIGHTS.get(code)?.label ?? code, oddsRatio: Math.exp(WEIGHTS.get(code)?.weight ?? 0) }))
    .filter((f) => f.oddsRatio > 1)
    .sort((a, b) => b.oddsRatio - a.oddsRatio);
  return {
    applicable: true,
    probability: sigmoid(logit),
    averageRisk: MODEL.average_risk,
    factors,
    model: MODEL.model,
    testRocAuc: MODEL.test_2023.roc_auc,
    testBirths: MODEL.test_2023.births,
  };
}
