import type { Patient, Prisma } from "@prisma/client";
import {
  applyUpdates,
  estimateRisk,
  evaluate,
  expirePending,
  type EvaluationResult,
  type Finding,
  type QuestionnaireRecord,
  type RiskResult,
  type SessionRecord,
  type SessionUpdate,
} from "shared";
import { db } from "./db";
import { toQuestionnaireRecord, toRiskProfile, toSessionRecord } from "./mappers";

/**
 * The one place the API runs the shared rules on database data (spec §2 rule 1).
 * Used by the routes, the silence job and the seed.
 */

/** Enough history for the 14-day trend, the 2-of-3 rule and silence. */
const SESSION_HISTORY = 200;
const QUESTIONNAIRE_HISTORY_DAYS = 8;

export interface PatientData {
  readonly patient: Patient;
  readonly sessions: readonly SessionRecord[];
  readonly questionnaires: readonly QuestionnaireRecord[];
}

export async function loadPatientData(patientId: string, now: Date): Promise<PatientData> {
  const since = new Date(now.getTime() - QUESTIONNAIRE_HISTORY_DAYS * 86_400_000);
  const [patient, sessions, questionnaires] = await Promise.all([
    db.patient.findUniqueOrThrow({ where: { id: patientId } }),
    db.bpSession.findMany({ where: { patientId }, orderBy: { takenAt: "desc" }, take: SESSION_HISTORY }),
    db.questionnaire.findMany({ where: { patientId, answeredAt: { gte: since } }, orderBy: { answeredAt: "desc" } }),
  ]);
  return { patient, sessions: sessions.map(toSessionRecord), questionnaires: questionnaires.map(toQuestionnaireRecord) };
}

export async function saveSessionUpdates(updates: readonly SessionUpdate[]): Promise<void> {
  await Promise.all(
    updates.map((u) =>
      db.bpSession.update({
        where: { id: u.id },
        data: { status: u.status, ...(u.confirmedBySessionId ? { confirmedBySessionId: u.confirmedBySessionId } : {}) },
      }),
    ),
  );
}

/** Pending severe readings past their window become SEVERE_EXPIRED, in the database too. */
export async function expireAndSave(sessions: readonly SessionRecord[], now: Date): Promise<SessionRecord[]> {
  const updates = expirePending(sessions, now);
  await saveSessionUpdates(updates);
  return applyUpdates(sessions, updates);
}

/**
 * Spec §6.4 de-duplication: one active alert per patient per level + evidence.
 * Same source already alerted (open or acknowledged) → nothing; an OPEN one with
 * another source → updated; otherwise a new alert.
 */
export async function upsertAlerts(patientId: string, findings: readonly Finding[]): Promise<number> {
  if (findings.length === 0) return 0;
  const active = await db.alert.findMany({
    where: { patientId, status: { in: ["OPEN", "ACKNOWLEDGED"] } },
    select: { id: true, level: true, evidence: true, sourceId: true, status: true },
  });
  const writes = findings.flatMap((f): Prisma.PrismaPromise<unknown>[] => {
    const sourceId = f.sourceId ?? null;
    const same = active.filter((a) => a.level === f.level && a.evidence === f.evidence);
    if (same.some((a) => a.sourceId === sourceId)) return [];
    const open = same.find((a) => a.status === "OPEN");
    if (open) return [db.alert.update({ where: { id: open.id }, data: { reason: f.reason, sourceId } })];
    return [db.alert.create({ data: { patientId, level: f.level, evidence: f.evidence, reason: f.reason, sourceId } })];
  });
  await db.$transaction(writes);
  return writes.length;
}

export type AssessmentTrigger = "PROFILE" | "SESSION" | "QUESTIONNAIRE" | "JOB";

export interface Assessment {
  readonly risk: RiskResult;
  readonly result: EvaluationResult;
  readonly alertsWritten: number;
}

/**
 * Risk estimate (stored as a RiskAssessment row unless it is the background
 * job), detection, and alerts.
 */
export async function assess(
  data: PatientData,
  trigger: AssessmentTrigger,
  now: Date,
): Promise<Assessment> {
  const recent = { sessions: data.sessions, questionnaires: data.questionnaires };
  const risk = estimateRisk(toRiskProfile(data.patient), recent, now);
  if (trigger !== "JOB") {
    await db.riskAssessment.create({
      data: {
        patientId: data.patient.id,
        category: risk.category,
        factors: risk.factors.map((f) => ({ ...f })),
        trigger,
        createdAt: now,
      },
    });
  }
  const result = evaluate(
    {
      ...recent,
      expectedSessionsPerDay: data.patient.expectedSessionsPerDay,
      followUpStart: data.patient.consentAt,
      risk,
    },
    now,
  );
  const alertsWritten = trigger === "PROFILE" ? 0 : await upsertAlerts(data.patient.id, result.findings);
  return { risk, result, alertsWritten };
}

/** Current state for display (triage, file) without writing: pending readings expired in memory. */
export function currentState(data: PatientData, now: Date): { risk: RiskResult; result: EvaluationResult } {
  const sessions = applyUpdates(data.sessions, expirePending(data.sessions, now));
  const recent = { sessions, questionnaires: data.questionnaires };
  const risk = estimateRisk(toRiskProfile(data.patient), recent, now);
  const result = evaluate(
    { ...recent, expectedSessionsPerDay: data.patient.expectedSessionsPerDay, followUpStart: data.patient.consentAt, risk },
    now,
  );
  return { risk, result };
}
