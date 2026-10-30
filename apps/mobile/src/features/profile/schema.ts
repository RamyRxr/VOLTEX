import { z } from "zod";
import type { PatientProfile, PatientProfileInput } from "@/api/types";
import { t } from "@/i18n";
import { ageInYears, parseIsoDate, pregnancyWeek } from "@/lib/pregnancy";

/** Sanity limits for typed values (input checks, not medical thresholds). */
const AGE = { min: 12, max: 60 };
const HEIGHT = { min: 120, max: 220 };
const WEIGHT = { min: 30, max: 250 };

const answer = z
  .boolean()
  .nullable()
  .refine((v) => v !== null, { error: t("validation.answer") });

const optionalNumber = (min: number, max: number) =>
  z
    .string()
    .trim()
    .refine((s) => s === "" || (/^\d+([.,]\d+)?$/.test(s) && Number(s.replace(",", ".")) >= min && Number(s.replace(",", ".")) <= max), {
      error: t("validation.number"),
    });

export const BOOLEAN_FIELDS = [
  "firstPregnancy",
  "multiplePregnancy",
  "ivfPregnancy",
  "chronicHypertension",
  "previousPreeclampsia",
  "preexistingDiabetes",
  "gestationalDiabetes",
  "kidneyDisease",
  "autoimmuneDisease",
  "familyPreeclampsia",
  "familyHypertension",
] as const;
export type BooleanField = (typeof BOOLEAN_FIELDS)[number];

export function buildProfileSchema(now: Date) {
  return z
    .object({
      birthDate: z.string().refine(
        (s) => {
          const age = parseIsoDate(s) ? ageInYears(s, now) : null;
          return age !== null && age >= AGE.min && age <= AGE.max;
        },
        { error: t("validation.birthDate") },
      ),
      phone: z.string().trim(),
      dateKind: z.enum(["due", "lmp"]),
      pregnancyDate: z.string(),
      firstPregnancy: answer,
      multiplePregnancy: answer,
      ivfPregnancy: answer,
      chronicHypertension: answer,
      previousPreeclampsia: z.boolean().nullable(),
      preexistingDiabetes: answer,
      gestationalDiabetes: answer,
      kidneyDisease: answer,
      autoimmuneDisease: answer,
      familyPreeclampsia: answer,
      familyHypertension: answer,
      heightCm: optionalNumber(HEIGHT.min, HEIGHT.max),
      weightKg: optionalNumber(WEIGHT.min, WEIGHT.max),
      treatments: z.string().trim().max(500),
    })
    .superRefine((v, ctx) => {
      if (!parseIsoDate(v.pregnancyDate)) {
        ctx.addIssue({ code: "custom", path: ["pregnancyDate"], message: t("validation.date") });
      } else if (pregnancyWeek(datesOf(v), now) === null) {
        ctx.addIssue({ code: "custom", path: ["pregnancyDate"], message: t("validation.pregnancyDate") });
      }
      // A previous pre-eclampsia only makes sense when this is not the first pregnancy.
      if (v.firstPregnancy === false && v.previousPreeclampsia === null) {
        ctx.addIssue({ code: "custom", path: ["previousPreeclampsia"], message: t("validation.answer") });
      }
    });
}

export type ProfileForm = z.input<ReturnType<typeof buildProfileSchema>>;

export function datesOf(v: Pick<ProfileForm, "dateKind" | "pregnancyDate">) {
  return v.dateKind === "due"
    ? { dueDate: v.pregnancyDate, lmpDate: null }
    : { dueDate: null, lmpDate: v.pregnancyDate };
}

export function emptyForm(): ProfileForm {
  return {
    birthDate: "",
    phone: "",
    dateKind: "due",
    pregnancyDate: "",
    firstPregnancy: null,
    multiplePregnancy: null,
    ivfPregnancy: null,
    chronicHypertension: null,
    previousPreeclampsia: null,
    preexistingDiabetes: null,
    gestationalDiabetes: null,
    kidneyDisease: null,
    autoimmuneDisease: null,
    familyPreeclampsia: null,
    familyHypertension: null,
    heightCm: "",
    weightKg: "",
    treatments: "",
  };
}

export function formFromProfile(p: PatientProfile): ProfileForm {
  return {
    birthDate: p.birthDate,
    phone: p.phone ?? "",
    dateKind: p.dueDate ? "due" : "lmp",
    pregnancyDate: p.dueDate ?? p.lmpDate ?? "",
    firstPregnancy: p.firstPregnancy,
    multiplePregnancy: p.multiplePregnancy,
    ivfPregnancy: p.ivfPregnancy,
    chronicHypertension: p.chronicHypertension,
    previousPreeclampsia: p.firstPregnancy ? null : p.previousPreeclampsia,
    preexistingDiabetes: p.preexistingDiabetes,
    gestationalDiabetes: p.gestationalDiabetes,
    kidneyDisease: p.kidneyDisease,
    autoimmuneDisease: p.autoimmuneDisease,
    familyPreeclampsia: p.familyPreeclampsia,
    familyHypertension: p.familyHypertension,
    heightCm: p.heightCm ? String(p.heightCm) : "",
    weightKg: p.weightKg ? String(p.weightKg) : "",
    treatments: p.treatments ?? "",
  };
}

const num = (s: string) => (s.trim() === "" ? null : Number(s.trim().replace(",", ".")));

/** Form values → POST /api/patient/profile body. Call only after validation. */
export function toProfileInput(v: ProfileForm, consentAt: string): PatientProfileInput {
  const yes = (field: BooleanField) => v[field] === true;
  const height = num(v.heightCm);
  return {
    birthDate: v.birthDate,
    ...datesOf(v),
    firstPregnancy: yes("firstPregnancy"),
    multiplePregnancy: yes("multiplePregnancy"),
    ivfPregnancy: yes("ivfPregnancy"),
    chronicHypertension: yes("chronicHypertension"),
    previousPreeclampsia: v.firstPregnancy === true ? false : yes("previousPreeclampsia"),
    preexistingDiabetes: yes("preexistingDiabetes"),
    gestationalDiabetes: yes("gestationalDiabetes"),
    kidneyDisease: yes("kidneyDisease"),
    autoimmuneDisease: yes("autoimmuneDisease"),
    familyPreeclampsia: yes("familyPreeclampsia"),
    familyHypertension: yes("familyHypertension"),
    heightCm: height === null ? null : Math.round(height),
    weightKg: num(v.weightKg),
    treatments: v.treatments.trim() === "" ? null : v.treatments.trim(),
    phone: v.phone.trim() === "" ? null : v.phone.trim(),
    consentAt,
  };
}
