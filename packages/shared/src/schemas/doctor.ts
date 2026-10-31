import { z } from "zod";
import {
  alertLevelSchema,
  alertSchema,
  isoDate,
  isoDateTime,
  levelSchema,
  questionnaireSchema,
  riskCategorySchema,
  riskSchema,
  sessionSchema,
} from "./common";

const pregnancyWeekSchema = z.object({ weeks: z.number().int(), days: z.number().int() }).nullable();

/** POST / GET /api/doctor/invites */
export const inviteSchema = z.object({ code: z.string(), expiresAt: isoDateTime });
export const invitesSchema = z.array(inviteSchema);

/** GET /api/doctor/link-requests — name and date only, no health data before acceptance (spec §3). */
export const linkRequestSchema = z.object({
  id: z.uuid(),
  patientName: z.string(),
  createdAt: isoDateTime,
});
export const linkRequestsSchema = z.array(linkRequestSchema);

/** PATCH /api/doctor/link-requests/:id */
export const linkDecisionSchema = z.object({ action: z.enum(["ACCEPT", "REFUSE"]) });

/** GET /api/doctor/patients — one triage row (spec §4.2.3), sorted per §6.5. */
export const triageRowSchema = z.object({
  patientId: z.uuid(),
  fullName: z.string(),
  pregnancyWeek: pregnancyWeekSchema,
  level: levelSchema,
  silent: z.boolean(),
  unconfirmedSevere: z.object({ sys: z.number().int(), dia: z.number().int(), takenAt: isoDateTime }).nullable(),
  lastSession: z.object({ sys: z.number().int(), dia: z.number().int(), takenAt: isoDateTime }).nullable(),
  riskCategory: riskCategorySchema.nullable(),
  reason: z.string().nullable(),
  openAlerts: z.number().int(),
});
export const triageSchema = z.array(triageRowSchema);

export const noteSchema = z.object({ id: z.uuid(), body: z.string(), createdAt: isoDateTime });

/**
 * GET /api/doctor/conversations — patients who wrote, sorted by urgency (spec §6.5)
 * then by most recent message. `unanswered` = patient messages after the doctor's last one.
 */
export const conversationSchema = z.object({
  patientId: z.uuid(),
  linkId: z.uuid(),
  fullName: z.string(),
  level: levelSchema,
  unconfirmedSevere: z.boolean(),
  lastMessage: z.object({ body: z.string(), createdAt: isoDateTime, fromPatient: z.boolean() }),
  unanswered: z.number().int(),
});
export const conversationsSchema = z.array(conversationSchema);

/** Experimental learned risk, doctor only (see ml/README.md). */
export const learnedRiskSchema = z.discriminatedUnion("applicable", [
  z.object({
    applicable: z.literal(true),
    probability: z.number(),
    averageRisk: z.number(),
    factors: z.array(z.object({ code: z.string(), label: z.string(), oddsRatio: z.number() })),
    model: z.string(),
    testRocAuc: z.number(),
    testBirths: z.number().int(),
  }),
  z.object({ applicable: z.literal(false), reason: z.literal("CHRONIC_HYPERTENSION"), model: z.string() }),
]);

/** GET /api/doctor/patients/:id — the full file. */
export const patientFileSchema = z.object({
  id: z.uuid(),
  fullName: z.string(),
  phone: z.string().nullable(),
  birthDate: isoDate,
  age: z.number().int(),
  dueDate: isoDate.nullable(),
  lmpDate: isoDate.nullable(),
  pregnancyWeek: pregnancyWeekSchema,
  profile: z.record(z.string(), z.union([z.boolean(), z.number(), z.string(), z.null()])),
  expectedSessionsPerDay: z.number().int(),
  level: levelSchema,
  silent: z.boolean(),
  /** Severe reading never confirmed, still flagged (spec §6.5 group 3). */
  unconfirmedSevere: z.object({ sys: z.number().int(), dia: z.number().int(), takenAt: isoDateTime }).nullable(),
  findings: z.array(z.object({ level: alertLevelSchema, evidence: z.string(), reason: z.string() })),
  risk: riskSchema.nullable(),
  learnedRisk: learnedRiskSchema,
  risks: z.array(riskSchema),
  sessions: z.array(sessionSchema),
  questionnaires: z.array(questionnaireSchema),
  alerts: z.array(alertSchema),
  notes: z.array(noteSchema),
  aiSummary: z.string().nullable(),
  linkId: z.uuid(),
});

/** PATCH /api/doctor/patients/:id */
export const patientSettingsSchema = z.object({ expectedSessionsPerDay: z.number().int().min(1).max(6).optional() });

/** PATCH /api/doctor/alerts/:id */
export const alertActionSchema = z.object({ action: z.enum(["ACK", "CLOSE"]) });
export const alertsQuerySchema = z.object({ status: z.enum(["OPEN", "ACKNOWLEDGED", "CLOSED"]).optional() });
export const alertsListSchema = z.array(alertSchema.extend({ patientName: z.string() }));

/** POST /api/doctor/patients/:id/notes */
export const noteInputSchema = z.object({ body: z.string().trim().min(1).max(2000) });

/** POST /api/doctor/patients/:id/summary and /draft-advice */
/** AI = written by the model; FALLBACK = static text built from the facts (model unavailable). */
export const textSourceSchema = z.enum(["AI", "FALLBACK"]);
/** POST body of /summary: `refresh` asks for a new summary instead of the stored one. */
export const summaryRequestSchema = z.object({ refresh: z.boolean().optional() });
export const summarySchema = z.object({
  text: z.string(),
  /** null for a stored summary (its date is not kept). */
  generatedAt: isoDateTime.nullable(),
  fromCache: z.boolean(),
  source: textSourceSchema.optional(),
});
export const draftAdviceSchema = z.object({ text: z.string(), source: textSourceSchema.optional() });

export type Invite = z.infer<typeof inviteSchema>;
export type LinkRequestDto = z.infer<typeof linkRequestSchema>;
export type LinkDecision = z.infer<typeof linkDecisionSchema>;
export type TriageRow = z.infer<typeof triageRowSchema>;
export type PatientFile = z.infer<typeof patientFileSchema>;
export type LearnedRiskDto = z.infer<typeof learnedRiskSchema>;
export type PatientSettings = z.infer<typeof patientSettingsSchema>;
export type AlertAction = z.infer<typeof alertActionSchema>;
export type AlertListItem = z.infer<typeof alertsListSchema>[number];
export type NoteInput = z.infer<typeof noteInputSchema>;
export type NoteDto = z.infer<typeof noteSchema>;
export type ConversationDto = z.infer<typeof conversationSchema>;
export type Summary = z.infer<typeof summarySchema>;
