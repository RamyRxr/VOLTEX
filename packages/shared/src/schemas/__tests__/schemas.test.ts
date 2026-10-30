import { describe, expect, it } from "vitest";
import { QUESTIONNAIRE_ITEMS } from "../../domain/questionnaire";
import { linkInputSchema, profileInputSchema, questionnaireInputSchema, sessionInputSchema } from "../patient";

const profile = {
  fullName: "Amina B.",
  birthDate: "1997-03-10",
  dueDate: "2026-12-25",
  firstPregnancy: true,
  multiplePregnancy: false,
  chronicHypertension: false,
  previousPreeclampsia: false,
  preexistingDiabetes: false,
  gestationalDiabetes: false,
  kidneyDisease: false,
  autoimmuneDisease: false,
  familyPreeclampsia: false,
  familyHypertension: false,
  ivfPregnancy: false,
  consent: true,
};

describe("API input schemas", () => {
  it("profile needs a due date or a last menstrual period, and consent", () => {
    expect(profileInputSchema.safeParse(profile).success).toBe(true);
    expect(profileInputSchema.safeParse({ ...profile, dueDate: undefined }).success).toBe(false);
    expect(profileInputSchema.safeParse({ ...profile, consent: false }).success).toBe(false);
  });

  it("session values are bounded and systolic > diastolic", () => {
    expect(sessionInputSchema.safeParse({ sys: 120, dia: 80, pulse: 80 }).success).toBe(true);
    expect(sessionInputSchema.safeParse({ sys: 80, dia: 120 }).success).toBe(false);
    expect(sessionInputSchema.safeParse({ sys: 400, dia: 80 }).success).toBe(false);
    expect(sessionInputSchema.safeParse({ sys: 120.5, dia: 80 }).success).toBe(false);
  });

  it("questionnaire requires every item", () => {
    const all = Object.fromEntries(QUESTIONNAIRE_ITEMS.map((i) => [i, false]));
    expect(questionnaireInputSchema.safeParse({ answers: all }).success).toBe(true);
    expect(questionnaireInputSchema.safeParse({ answers: { SEVERE_HEADACHE: true } }).success).toBe(false);
  });

  it("link code is upper-cased and checked against the alphabet", () => {
    expect(linkInputSchema.parse({ code: " ab3k7m " })).toEqual({ code: "AB3K7M" });
    expect(linkInputSchema.safeParse({ code: "AB0K7M" }).success).toBe(false);
  });
});
