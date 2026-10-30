import type { Alert, BpSession, DoctorNote, Patient, Questionnaire, RiskAssessment } from "@prisma/client";
import {
  answersSchema,
  riskFactorSchema,
  type AlertDto,
  type NoteDto,
  type QuestionnaireDto,
  type QuestionnaireRecord,
  type RiskDto,
  type RiskFactor,
  type RiskProfile,
  type RiskResult,
  type SessionDto,
  type SessionRecord,
} from "shared";
import { z } from "zod";

/** Prisma rows → domain records (for the rules) and → JSON shapes (spec §8). */

export const iso = (d: Date): string => d.toISOString();
export const isoOrNull = (d: Date | null): string | null => (d ? d.toISOString() : null);
/** Date-only fields (birth date, due date) as YYYY-MM-DD. */
export const dateOnly = (d: Date): string => d.toISOString().slice(0, 10);

export const toSessionRecord = (s: BpSession): SessionRecord => ({
  id: s.id,
  sys: s.sys,
  dia: s.dia,
  takenAt: s.takenAt,
  status: s.status,
});

const storedAnswers = answersSchema.partial();

/** Stored JSON is re-validated; unknown keys or bad values are dropped. */
export function toAnswers(value: unknown): Record<string, boolean> {
  const parsed = storedAnswers.safeParse(value);
  if (!parsed.success) return {};
  return Object.fromEntries(Object.entries(parsed.data).filter((e): e is [string, boolean] => typeof e[1] === "boolean"));
}

export const toQuestionnaireRecord = (q: Questionnaire): QuestionnaireRecord => ({
  id: q.id,
  answers: toAnswers(q.answers),
  answeredAt: q.answeredAt,
});

export const toRiskProfile = (p: Patient): RiskProfile => ({
  birthDate: p.birthDate,
  firstPregnancy: p.firstPregnancy,
  multiplePregnancy: p.multiplePregnancy,
  chronicHypertension: p.chronicHypertension,
  previousPreeclampsia: p.previousPreeclampsia,
  preexistingDiabetes: p.preexistingDiabetes,
  kidneyDisease: p.kidneyDisease,
  autoimmuneDisease: p.autoimmuneDisease,
  familyPreeclampsia: p.familyPreeclampsia,
  ivfPregnancy: p.ivfPregnancy,
  heightCm: p.heightCm,
  weightKg: p.weightKg,
});

export const sessionDto = (s: BpSession): SessionDto => ({
  id: s.id,
  sys: s.sys,
  dia: s.dia,
  pulse: s.pulse,
  takenAt: iso(s.takenAt),
  source: s.source,
  status: s.status,
  confirmedBySessionId: s.confirmedBySessionId,
});

export const questionnaireDto = (q: Questionnaire): QuestionnaireDto => ({
  id: q.id,
  answers: toAnswers(q.answers),
  answeredAt: iso(q.answeredAt),
});

export const alertDto = (a: Alert): AlertDto => ({
  id: a.id,
  patientId: a.patientId,
  level: a.level,
  evidence: a.evidence,
  reason: a.reason,
  sourceId: a.sourceId,
  status: a.status,
  createdAt: iso(a.createdAt),
  ackAt: isoOrNull(a.ackAt),
});

export const noteDto = (n: DoctorNote): NoteDto => ({ id: n.id, body: n.body, createdAt: iso(n.createdAt) });

const TRIGGERS = ["PROFILE", "SESSION", "QUESTIONNAIRE"] as const;
const storedFactors = z.array(riskFactorSchema);

/** A stored assessment (risk timeline); reasons are not stored, only factors. */
export function riskRowDto(r: RiskAssessment): RiskDto {
  const factors = storedFactors.safeParse(r.factors);
  const trigger = TRIGGERS.find((t) => t === r.trigger);
  return {
    category: r.category,
    factors: factors.success ? factors.data : [],
    reasons: [],
    ...(trigger ? { trigger } : {}),
    createdAt: iso(r.createdAt),
  };
}

/** A fresh estimate, with its reasons. */
export const riskResultDto = (r: RiskResult, createdAt?: Date): RiskDto => ({
  category: r.category,
  factors: r.factors.map((f: RiskFactor) => ({ ...f })),
  reasons: [...r.reasons],
  ...(createdAt ? { createdAt: iso(createdAt) } : {}),
});
