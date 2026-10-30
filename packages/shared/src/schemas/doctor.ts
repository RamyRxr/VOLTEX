import { z } from "zod";
import {
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

/** GET /api/doctor/link-requests */
export const linkRequestSchema = z.object({
  id: z.uuid(),
  patientId: z.uuid(),
  patientName: z.string(),
  pregnancyWeek: pregnancyWeekSchema,
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
  findings: z.array(z.object({ level: z.string(), evidence: z.string(), reason: z.string() })),
  risk: riskSchema.nullable(),
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
export const summarySchema = z.object({ text: z.string(), generatedAt: isoDateTime, fromCache: z.boolean() });
export const draftAdviceSchema = z.object({ text: z.string() });

export type Invite = z.infer<typeof inviteSchema>;
export type LinkRequestDto = z.infer<typeof linkRequestSchema>;
export type LinkDecision = z.infer<typeof linkDecisionSchema>;
export type TriageRow = z.infer<typeof triageRowSchema>;
export type PatientFile = z.infer<typeof patientFileSchema>;
export type PatientSettings = z.infer<typeof patientSettingsSchema>;
export type AlertAction = z.infer<typeof alertActionSchema>;
export type AlertListItem = z.infer<typeof alertsListSchema>[number];
export type NoteInput = z.infer<typeof noteInputSchema>;
export type NoteDto = z.infer<typeof noteSchema>;
export type Summary = z.infer<typeof summarySchema>;
