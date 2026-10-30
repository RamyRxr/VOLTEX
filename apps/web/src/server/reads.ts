import { pregnancyWeek, type Me, type QuestionnaireDto, type RangeQuery, type RiskDto, type SessionDto } from "shared";
import type { Viewer } from "./auth";
import { db } from "./db";
import { ApiError } from "./http";
import { questionnaireDto, riskResultDto, sessionDto } from "./mappers";
import { currentState, loadPatientData } from "./pipeline";

/** Read-only routes of the patient app and /api/me. */

const LIST_LIMIT = 500;

export async function me(viewer: Viewer, now: Date): Promise<Me> {
  const profile = await db.profile.findUniqueOrThrow({ where: { id: viewer.profileId }, select: { phone: true } });
  const patient = viewer.patientId
    ? await db.patient.findUnique({ where: { id: viewer.patientId }, select: { id: true, dueDate: true, lmpDate: true } })
    : null;
  return {
    id: viewer.profileId,
    role: viewer.role,
    fullName: viewer.fullName,
    phone: profile.phone,
    patient: patient ? { id: patient.id, pregnancyWeek: pregnancyWeek(patient, now), hasProfile: true } : null,
    doctor: viewer.doctorId ? { id: viewer.doctorId } : null,
  };
}

/** Latest risk, recomputed so it comes with its reasons (stored rows keep factors only). */
export async function currentRisk(patientId: string, now: Date): Promise<RiskDto> {
  const latest = await db.riskAssessment.findFirst({ where: { patientId }, orderBy: { createdAt: "desc" } });
  if (!latest) throw new ApiError("NOT_FOUND", "Aucune estimation pour l'instant");
  const { risk } = currentState(await loadPatientData(patientId, now), now);
  return riskResultDto(risk, latest.createdAt);
}

function range(q: RangeQuery): { gte?: Date; lte?: Date } {
  return { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lte: new Date(q.to) } : {}) };
}

export async function listSessions(patientId: string, q: RangeQuery): Promise<SessionDto[]> {
  const rows = await db.bpSession.findMany({
    where: { patientId, takenAt: range(q) },
    orderBy: { takenAt: "desc" },
    take: LIST_LIMIT,
  });
  return rows.map(sessionDto);
}

export async function listQuestionnaires(patientId: string, q: RangeQuery): Promise<QuestionnaireDto[]> {
  const rows = await db.questionnaire.findMany({
    where: { patientId, answeredAt: range(q) },
    orderBy: { answeredAt: "desc" },
    take: LIST_LIMIT,
  });
  return rows.map(questionnaireDto);
}
