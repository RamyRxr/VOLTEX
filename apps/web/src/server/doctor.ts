import {
  ageOn,
  pregnancyWeek,
  triageSort,
  type AlertListItem,
  type EvaluationResult,
  type PatientFile,
  type TriageRow,
} from "shared";
import { db } from "./db";
import { ApiError } from "./http";
import {
  alertDto,
  dateOnly,
  iso,
  noteDto,
  questionnaireDto,
  riskResultDto,
  riskRowDto,
  sessionDto,
  toQuestionnaireRecord,
  toSessionRecord,
} from "./mappers";
import { currentState, type PatientData } from "./pipeline";

const TRIAGE_SESSIONS = 60;
const FILE_SESSIONS = 200;
const FILE_QUESTIONNAIRES = 90;
const FILE_RISKS = 100;
const ALERT_LIST_LIMIT = 200;
const QUESTIONNAIRE_DAYS = 8;

const linkedTo = (doctorId: string) => ({ links: { some: { doctorId, status: "ACCEPTED" as const } } });

const bpAt = (s: { sys: number; dia: number; takenAt: Date }) => ({ sys: s.sys, dia: s.dia, takenAt: iso(s.takenAt) });

/** Reason shown on the triage row: the top finding, or the unconfirmed severe reading (spec §6.5 group 3). */
function rowReason(result: EvaluationResult): string | null {
  const top = result.findings[0];
  const urgent = result.level === "EMERGENCY" || result.level === "SEVERE";
  if (!urgent && result.unconfirmedSevere) {
    const s = result.unconfirmedSevere;
    return `Mesure sévère non confirmée : ${s.sys}/${s.dia}`;
  }
  return top?.reason ?? null;
}

/** GET /api/doctor/patients — only patients with an ACCEPTED link, sorted per spec §6.5. */
export async function triage(doctorId: string, now: Date): Promise<TriageRow[]> {
  const since = new Date(now.getTime() - QUESTIONNAIRE_DAYS * 86_400_000);
  const patients = await db.patient.findMany({
    where: linkedTo(doctorId),
    include: {
      profile: { select: { fullName: true } },
      sessions: { orderBy: { takenAt: "desc" }, take: TRIAGE_SESSIONS },
      questionnaires: { where: { answeredAt: { gte: since } }, orderBy: { answeredAt: "desc" } },
      alerts: { where: { status: "OPEN" }, select: { id: true } },
    },
  });

  const rows = patients.map((p) => {
    const data: PatientData = {
      patient: p,
      sessions: p.sessions.map(toSessionRecord),
      questionnaires: p.questionnaires.map(toQuestionnaireRecord),
    };
    const { risk, result } = currentState(data, now);
    const last = p.sessions[0];
    const lastQuestionnaire = p.questionnaires[0];
    const activity = [last?.takenAt, lastQuestionnaire?.answeredAt].filter((d): d is Date => d != null);
    const row: TriageRow = {
      patientId: p.id,
      fullName: p.profile.fullName,
      pregnancyWeek: pregnancyWeek(p, now),
      level: result.level,
      silent: result.silent,
      unconfirmedSevere: result.unconfirmedSevere ? bpAt(result.unconfirmedSevere) : null,
      lastSession: last ? bpAt(last) : null,
      riskCategory: risk.category,
      reason: rowReason(result),
      openAlerts: p.alerts.length,
    };
    return {
      row,
      level: result.level,
      hasUnconfirmedSevere: result.unconfirmedSevere != null,
      lastActivityAt: activity.length ? new Date(Math.max(...activity.map((d) => d.getTime()))) : null,
    };
  });
  return triageSort(rows).map((r) => r.row);
}

/** GET /api/doctor/patients/:id — full file; the caller checked the link. */
export async function patientFile(patientId: string, linkId: string, now: Date): Promise<PatientFile> {
  const p = await db.patient.findUnique({
    where: { id: patientId },
    include: {
      profile: { select: { fullName: true, phone: true } },
      sessions: { orderBy: { takenAt: "desc" }, take: FILE_SESSIONS },
      questionnaires: { orderBy: { answeredAt: "desc" }, take: FILE_QUESTIONNAIRES },
      risks: { orderBy: { createdAt: "desc" }, take: FILE_RISKS },
      alerts: { orderBy: { createdAt: "desc" }, take: ALERT_LIST_LIMIT },
      notes: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!p) throw new ApiError("NOT_FOUND", "Patiente introuvable");

  const recentFrom = now.getTime() - QUESTIONNAIRE_DAYS * 86_400_000;
  const data: PatientData = {
    patient: p,
    sessions: p.sessions.map(toSessionRecord),
    questionnaires: p.questionnaires.filter((q) => q.answeredAt.getTime() >= recentFrom).map(toQuestionnaireRecord),
  };
  const { risk, result } = currentState(data, now);

  return {
    id: p.id,
    fullName: p.profile.fullName,
    phone: p.profile.phone,
    birthDate: dateOnly(p.birthDate),
    age: ageOn(p.birthDate, now),
    dueDate: p.dueDate ? dateOnly(p.dueDate) : null,
    lmpDate: p.lmpDate ? dateOnly(p.lmpDate) : null,
    pregnancyWeek: pregnancyWeek(p, now),
    profile: {
      firstPregnancy: p.firstPregnancy,
      multiplePregnancy: p.multiplePregnancy,
      chronicHypertension: p.chronicHypertension,
      previousPreeclampsia: p.previousPreeclampsia,
      preexistingDiabetes: p.preexistingDiabetes,
      gestationalDiabetes: p.gestationalDiabetes,
      kidneyDisease: p.kidneyDisease,
      autoimmuneDisease: p.autoimmuneDisease,
      familyPreeclampsia: p.familyPreeclampsia,
      familyHypertension: p.familyHypertension,
      ivfPregnancy: p.ivfPregnancy,
      heightCm: p.heightCm,
      weightKg: p.weightKg,
      treatments: p.treatments,
    },
    expectedSessionsPerDay: p.expectedSessionsPerDay,
    level: result.level,
    silent: result.silent,
    unconfirmedSevere: result.unconfirmedSevere ? bpAt(result.unconfirmedSevere) : null,
    findings: result.findings.map((f) => ({ level: f.level, evidence: f.evidence, reason: f.reason })),
    risk: riskResultDto(risk, now),
    risks: p.risks.map(riskRowDto),
    sessions: p.sessions.map(sessionDto),
    questionnaires: p.questionnaires.map(questionnaireDto),
    alerts: p.alerts.map(alertDto),
    notes: p.notes.map(noteDto),
    aiSummary: p.aiSummary,
    linkId,
  };
}

export async function updateSettings(patientId: string, expectedSessionsPerDay: number | undefined): Promise<void> {
  if (expectedSessionsPerDay == null) return;
  await db.patient.update({ where: { id: patientId }, data: { expectedSessionsPerDay } });
}

export async function addNote(doctorId: string, patientId: string, body: string, now: Date) {
  return noteDto(await db.doctorNote.create({ data: { doctorId, patientId, body, createdAt: now } }));
}

/** GET /api/doctor/alerts — alerts of linked patients only. */
export async function listAlerts(
  doctorId: string,
  status: "OPEN" | "ACKNOWLEDGED" | "CLOSED" | undefined,
): Promise<AlertListItem[]> {
  const alerts = await db.alert.findMany({
    where: { patient: linkedTo(doctorId), ...(status ? { status } : {}) },
    orderBy: { createdAt: "desc" },
    take: ALERT_LIST_LIMIT,
    include: { patient: { select: { profile: { select: { fullName: true } } } } },
  });
  return alerts.map((a) => ({ ...alertDto(a), patientName: a.patient.profile.fullName }));
}

/** PATCH /api/doctor/alerts/:id — ackAt keeps the first acknowledgement (response time, spec §10). */
export async function actOnAlert(doctorId: string, alertId: string, action: "ACK" | "CLOSE", now: Date) {
  const alert = await db.alert.findFirst({ where: { id: alertId, patient: linkedTo(doctorId) } });
  if (!alert) throw new ApiError("NOT_FOUND", "Alerte introuvable");
  const updated = await db.alert.update({
    where: { id: alertId },
    data: { status: action === "ACK" ? "ACKNOWLEDGED" : "CLOSED", ackAt: alert.ackAt ?? now },
  });
  return alertDto(updated);
}
