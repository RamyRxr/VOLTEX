import { z } from "zod";
import { QUESTIONNAIRE_ITEMS } from "../domain/questionnaire";
import { ALERT_LEVELS, LEVELS, RISK_CATEGORIES, SESSION_STATUSES } from "../domain/types";

/** Shapes used by both apps (spec §8). Dates travel as ISO strings. */

export const isoDateTime = z.iso.datetime({ offset: true });
export const isoDate = z.iso.date();

export const roleSchema = z.enum(["PATIENT", "DOCTOR"]);
export const linkStatusSchema = z.enum(["PENDING", "ACCEPTED", "REFUSED"]);
export const measureSourceSchema = z.enum(["MANUAL", "DEVICE"]);
export const sessionStatusSchema = z.enum(SESSION_STATUSES);
export const riskCategorySchema = z.enum(RISK_CATEGORIES);
export const alertLevelSchema = z.enum(ALERT_LEVELS);
export const alertStatusSchema = z.enum(["OPEN", "ACKNOWLEDGED", "CLOSED"]);
export const levelSchema = z.enum(LEVELS);

export const riskFactorSchema = z.object({
  code: z.string(),
  label: z.string(),
  weight: z.enum(["HIGH", "MODERATE"]),
});

export const riskSchema = z.object({
  category: riskCategorySchema,
  factors: z.array(riskFactorSchema),
  reasons: z.array(z.string()),
  trigger: z.enum(["PROFILE", "SESSION", "QUESTIONNAIRE"]).optional(),
  createdAt: isoDateTime.optional(),
});

export const evaluationSchema = z.object({
  level: levelSchema,
  patientWord: z.string(),
  icon: z.string(),
  color: z.string(),
  message: z.string(),
  action: z.enum(["CALL_EMERGENCY", "REMEASURE"]).optional(),
  remeasureInSeconds: z.number().int().positive().optional(),
});

export const sessionSchema = z.object({
  id: z.uuid(),
  sys: z.number().int(),
  dia: z.number().int(),
  pulse: z.number().int().nullable(),
  takenAt: isoDateTime,
  source: measureSourceSchema,
  status: sessionStatusSchema,
  confirmedBySessionId: z.uuid().nullable(),
});

/** Every item answered yes / no. */
export const answersSchema = z.object(
  Object.fromEntries(QUESTIONNAIRE_ITEMS.map((item) => [item, z.boolean()])) as Record<
    (typeof QUESTIONNAIRE_ITEMS)[number],
    z.ZodBoolean
  >,
);

export const questionnaireSchema = z.object({
  id: z.uuid(),
  answers: answersSchema.partial(),
  answeredAt: isoDateTime,
});

export const alertSchema = z.object({
  id: z.uuid(),
  patientId: z.uuid(),
  level: alertLevelSchema,
  evidence: z.string(),
  reason: z.string(),
  sourceId: z.uuid().nullable(),
  status: alertStatusSchema,
  createdAt: isoDateTime,
  ackAt: isoDateTime.nullable(),
});

export const rangeQuerySchema = z.object({
  from: isoDateTime.optional(),
  to: isoDateTime.optional(),
});

/** Error body of every route. */
export const apiErrorSchema = z.object({ error: z.string(), message: z.string() });

export type RiskDto = z.infer<typeof riskSchema>;
export type EvaluationDto = z.infer<typeof evaluationSchema>;
export type SessionDto = z.infer<typeof sessionSchema>;
export type Answers = z.infer<typeof answersSchema>;
export type QuestionnaireDto = z.infer<typeof questionnaireSchema>;
export type AlertDto = z.infer<typeof alertSchema>;
export type RangeQuery = z.infer<typeof rangeQuerySchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
