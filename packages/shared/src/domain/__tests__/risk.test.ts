import { describe, expect, it } from "vitest";
import { estimateRisk, initialCategory, profileFactors } from "../risk";
import { BASE_PROFILE, daysAgo, hoursAgo, NOW, questionnaire, session, stableSessions } from "./fixtures";

const none = { sessions: [], questionnaires: [] };

describe("initial risk from the profile (spec §6.6)", () => {
  it("LOW without any factor", () => {
    const r = estimateRisk(BASE_PROFILE, none, NOW);
    expect(r.category).toBe("LOW");
    expect(r.factors).toEqual([]);
  });

  it("MODERATE with one moderate factor", () => {
    const r = estimateRisk({ ...BASE_PROFILE, firstPregnancy: true }, none, NOW);
    expect(r.category).toBe("MODERATE");
    expect(r.factors.map((f) => f.code)).toEqual(["FIRST_PREGNANCY"]);
  });

  it("HIGH with two moderate factors (age ≥ 40 and BMI ≥ 35)", () => {
    const profile = { ...BASE_PROFILE, birthDate: new Date("1985-01-01T00:00:00Z"), heightCm: 160, weightKg: 92 };
    const codes = profileFactors(profile, NOW).map((f) => f.code);
    expect(codes).toEqual(["AGE", "BMI"]);
    expect(estimateRisk(profile, none, NOW).category).toBe("HIGH");
  });

  it.each(["previousPreeclampsia", "chronicHypertension", "preexistingDiabetes", "kidneyDisease", "autoimmuneDisease", "multiplePregnancy"])(
    "HIGH with the high-weight factor %s",
    (flag) => {
      expect(estimateRisk({ ...BASE_PROFILE, [flag]: true }, none, NOW).category).toBe("HIGH");
    },
  );

  it("age just under 40 is not a factor", () => {
    const profile = { ...BASE_PROFILE, birthDate: new Date("1986-10-31T00:00:00Z") };
    expect(profileFactors(profile, NOW)).toEqual([]);
  });

  it("initialCategory counts weights", () => {
    expect(initialCategory([{ code: "A", label: "a", weight: "MODERATE" }])).toBe("MODERATE");
  });
});

describe("dynamic re-evaluation", () => {
  it("2 of the last 3 sessions ≥ 140/90 raise to at least HIGH", () => {
    const sessions = [session(145, 92, hoursAgo(1)), session(142, 88, hoursAgo(13)), session(120, 80, hoursAgo(25))];
    const r = estimateRisk(BASE_PROFILE, { sessions, questionnaires: [] }, NOW);
    expect(r.category).toBe("HIGH");
    expect(r.initialCategory).toBe("LOW");
    expect(r.factors.map((f) => f.code)).toContain("OBS_HYPERTENSIVE");
  });

  it("a rising trend raises one level", () => {
    const sessions = Array.from({ length: 10 }, (_, i) => session(110 + (9 - i) * 2, 75, daysAgo(i * 1.3)));
    const r = estimateRisk(BASE_PROFILE, { sessions, questionnaires: [] }, NOW);
    expect(r.category).toBe("MODERATE");
    expect(r.factors.map((f) => f.code)).toContain("OBS_TREND");
  });

  it("watch items in the last 7 days raise one level, capped at HIGH", () => {
    const qs = [questionnaire(["SWELLING_LEGS"], daysAgo(2))];
    expect(estimateRisk(BASE_PROFILE, { sessions: [], questionnaires: qs }, NOW).category).toBe("MODERATE");
    expect(estimateRisk({ ...BASE_PROFILE, kidneyDisease: true }, { sessions: [], questionnaires: qs }, NOW).category).toBe("HIGH");
  });

  it("watch items older than 7 days do not count", () => {
    const qs = [questionnaire(["SWELLING_LEGS"], daysAgo(8))];
    expect(estimateRisk(BASE_PROFILE, { sessions: [], questionnaires: qs }, NOW).category).toBe("LOW");
  });

  it("never lowers below the initial category", () => {
    const profile = { ...BASE_PROFILE, previousPreeclampsia: true };
    const r = estimateRisk(profile, { sessions: stableSessions(7), questionnaires: [] }, NOW);
    expect(r.category).toBe("HIGH");
    expect(r.reasons.length).toBeGreaterThan(0);
  });
});
