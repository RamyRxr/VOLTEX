import { describe, expect, it } from "vitest";
import { activeFactors, learnedRisk, type LearnedRiskInput } from "../learnedRisk";
import vectors from "./hdpLogisticVectors.json";

const base: LearnedRiskInput = {
  age: 28,
  bmi: 22,
  firstPregnancy: false,
  multiplePregnancy: false,
  ivfPregnancy: false,
  preexistingDiabetes: false,
  gestationalDiabetes: false,
  chronicHypertension: false,
};

describe("learned risk (logistic, CDC natality)", () => {
  it("matches Python on 500 reference cases from the 2023 test year", () => {
    const worst = vectors.reduce((max, v) => {
      const r = learnedRisk({ ...v, chronicHypertension: false });
      if (!r.applicable) throw new Error("unexpected");
      return Math.max(max, Math.abs(r.probability - v.probability));
    }, 0);
    expect(worst).toBeLessThan(1e-6);
  });

  it("is not applicable with chronic hypertension", () => {
    expect(learnedRisk({ ...base, chronicHypertension: true })).toMatchObject({ applicable: false, reason: "CHRONIC_HYPERTENSION" });
  });

  it("a profile without factors is below the average; factors raise it", () => {
    const low = learnedRisk(base);
    const high = learnedRisk({ ...base, bmi: 37, firstPregnancy: true, gestationalDiabetes: true });
    if (!low.applicable || !high.applicable) throw new Error("unexpected");
    expect(low.probability).toBeLessThan(low.averageRisk);
    expect(high.probability).toBeGreaterThan(2 * high.averageRisk);
    expect(high.factors.map((f) => f.code)).toEqual(["bmi_35_plus", "first_pregnancy", "gestational_diabetes"]);
  });

  it("encodes bands like the training script", () => {
    expect(activeFactors({ ...base, age: 19, bmi: null })).toEqual(["age_under_20", "bmi_unknown"]);
    expect(activeFactors({ ...base, age: 35, bmi: 30 })).toEqual(["age_35_39", "bmi_30_35"]);
    expect(activeFactors({ ...base, age: 40, bmi: 35 })).toEqual(["age_40_plus", "bmi_35_plus"]);
  });
});
