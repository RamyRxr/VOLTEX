import { z } from "zod";
import { INVITE_CODE_PATTERN } from "../domain/invite";
import {
  answersSchema,
  evaluationSchema,
  isoDate,
  isoDateTime,
  linkStatusSchema,
  measureSourceSchema,
  riskSchema,
  roleSchema,
  sessionSchema,
} from "./common";

/** POST /api/patient/profile — consent is required (spec §4.1.1). */
export const profileInputSchema = z
  .object({
    fullName: z.string().trim().min(2).max(120),
    phone: z.string().trim().max(30).optional(),
    birthDate: isoDate,
    dueDate: isoDate.optional(),
    lmpDate: isoDate.optional(),
    firstPregnancy: z.boolean(),
    multiplePregnancy: z.boolean(),
    chronicHypertension: z.boolean(),
    previousPreeclampsia: z.boolean(),
    preexistingDiabetes: z.boolean(),
    gestationalDiabetes: z.boolean(),
    kidneyDisease: z.boolean(),
    autoimmuneDisease: z.boolean(),
    familyPreeclampsia: z.boolean(),
    familyHypertension: z.boolean(),
    ivfPregnancy: z.boolean(),
    heightCm: z.number().int().min(120).max(220).optional(),
    weightKg: z.number().min(30).max(250).optional(),
    treatments: z.string().trim().max(1000).optional(),
    consent: z.literal(true),
  })
  .refine((p) => p.dueDate != null || p.lmpDate != null, {
    message: "Date prévue d'accouchement ou date des dernières règles requise",
    path: ["dueDate"],
  });

export const profileOutputSchema = z.object({ risk: riskSchema });

/** POST /api/patient/sessions */
export const sessionInputSchema = z
  .object({
    sys: z.number().int().min(60).max(300),
    dia: z.number().int().min(30).max(200),
    pulse: z.number().int().min(30).max(250).optional(),
    takenAt: isoDateTime.optional(),
    source: measureSourceSchema.optional(),
  })
  .refine((s) => s.sys > s.dia, { message: "La systolique doit être supérieure à la diastolique", path: ["sys"] });

export const sessionOutputSchema = z.object({
  session: sessionSchema,
  evaluation: evaluationSchema,
  risk: riskSchema,
});

/** POST /api/patient/questionnaires */
export const questionnaireInputSchema = z.object({ answers: answersSchema });
export const questionnaireOutputSchema = z.object({ evaluation: evaluationSchema, risk: riskSchema });

/** POST /api/patient/link */
export const linkInputSchema = z.object({
  code: z
    .string()
    .trim()
    .transform((c) => c.toUpperCase())
    .pipe(z.string().regex(INVITE_CODE_PATTERN)),
});
export const linkOutputSchema = z.object({ status: z.literal("PENDING") });

/** GET /api/patient/link */
export const linkStateSchema = z.object({
  status: linkStatusSchema.nullable(),
  doctorName: z.string().nullable(),
  linkId: z.uuid().nullable(),
});

/** POST /api/patient/assistant */
export const assistantInputSchema = z.object({ question: z.string().trim().min(1).max(500) });
export const assistantOutputSchema = z.object({ answer: z.string() });

/** GET /api/me */
export const meSchema = z.object({
  id: z.uuid(),
  role: roleSchema,
  fullName: z.string(),
  phone: z.string().nullable(),
  patient: z
    .object({
      id: z.uuid(),
      pregnancyWeek: z.object({ weeks: z.number().int(), days: z.number().int() }).nullable(),
      hasProfile: z.boolean(),
    })
    .nullable(),
  doctor: z.object({ id: z.uuid() }).nullable(),
});

export type ProfileInput = z.infer<typeof profileInputSchema>;
export type SessionInput = z.infer<typeof sessionInputSchema>;
export type SessionOutput = z.infer<typeof sessionOutputSchema>;
export type QuestionnaireInput = z.infer<typeof questionnaireInputSchema>;
export type QuestionnaireOutput = z.infer<typeof questionnaireOutputSchema>;
export type LinkInput = z.infer<typeof linkInputSchema>;
export type LinkState = z.infer<typeof linkStateSchema>;
export type AssistantInput = z.infer<typeof assistantInputSchema>;
export type Me = z.infer<typeof meSchema>;
