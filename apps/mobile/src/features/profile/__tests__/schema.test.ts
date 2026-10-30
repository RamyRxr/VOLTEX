import { profileInputSchema } from "shared";
import { describe, expect, it } from "vitest";
import { buildProfileSchema, emptyForm, toProfileInput, type ProfileForm } from "../schema";

const now = new Date(2026, 9, 30);

const filled = (overrides: Partial<ProfileForm> = {}): ProfileForm => ({
  ...emptyForm("Amina Test"),
  birthDate: "1997-03-12",
  dateKind: "due",
  pregnancyDate: "2026-12-30",
  firstPregnancy: true,
  multiplePregnancy: false,
  ivfPregnancy: false,
  chronicHypertension: false,
  preexistingDiabetes: false,
  gestationalDiabetes: false,
  kidneyDisease: false,
  autoimmuneDisease: false,
  familyPreeclampsia: false,
  familyHypertension: true,
  ...overrides,
});

/** The body the form sends must pass the API's own schema (packages/shared). */
describe("toProfileInput", () => {
  it("builds a body accepted by profileInputSchema", () => {
    const form = filled({ heightCm: "165", weightKg: "68,5", phone: " 0550 12 34 56 ", treatments: "Fer" });
    expect(buildProfileSchema(now).safeParse(form).success).toBe(true);
    const body = toProfileInput(form);
    expect(profileInputSchema.safeParse(body).success).toBe(true);
    expect(body).toMatchObject({ fullName: "Amina Test", dueDate: "2026-12-30", heightCm: 165, weightKg: 68.5, consent: true });
    expect(body).not.toHaveProperty("lmpDate");
  });

  it("leaves out empty optional fields instead of sending null", () => {
    const body = toProfileInput(filled({ dateKind: "lmp", pregnancyDate: "2026-04-01" }));
    expect(profileInputSchema.safeParse(body).success).toBe(true);
    for (const key of ["phone", "heightCm", "weightKg", "treatments", "dueDate"]) expect(body).not.toHaveProperty(key);
  });

  it("never sends a previous pre-eclampsia for a first pregnancy", () => {
    expect(toProfileInput(filled({ firstPregnancy: true, previousPreeclampsia: true })).previousPreeclampsia).toBe(false);
  });
});
