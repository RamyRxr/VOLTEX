import { randomUUID } from "node:crypto";
import {
  applyUpdates,
  patientEvaluation,
  registerSession,
  type ProfileInput,
  type QuestionnaireInput,
  type QuestionnaireOutput,
  type RiskDto,
  type SessionInput,
  type SessionOutput,
} from "shared";
import { db } from "./db";
import { ApiError } from "./http";
import { riskResultDto, sessionDto, toSessionRecord } from "./mappers";
import { assess, expireAndSave, loadPatientData, saveSessionUpdates } from "./pipeline";

/** Readings may be back-dated, not dated in the future (small clock skew allowed). */
const MAX_FUTURE_MS = 5 * 60_000;

const day = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

function patientFields(input: ProfileInput) {
  return {
    birthDate: day(input.birthDate),
    dueDate: input.dueDate ? day(input.dueDate) : null,
    lmpDate: input.lmpDate ? day(input.lmpDate) : null,
    firstPregnancy: input.firstPregnancy,
    multiplePregnancy: input.multiplePregnancy,
    chronicHypertension: input.chronicHypertension,
    previousPreeclampsia: input.previousPreeclampsia,
    preexistingDiabetes: input.preexistingDiabetes,
    gestationalDiabetes: input.gestationalDiabetes,
    kidneyDisease: input.kidneyDisease,
    autoimmuneDisease: input.autoimmuneDisease,
    familyPreeclampsia: input.familyPreeclampsia,
    familyHypertension: input.familyHypertension,
    ivfPregnancy: input.ivfPregnancy,
    heightCm: input.heightCm ?? null,
    weightKg: input.weightKg ?? null,
    treatments: input.treatments ?? null,
  };
}

/** POST /api/patient/profile — creates or updates Profile + Patient, then the risk (spec §4.1.2–3). */
export async function saveProfile(userId: string, input: ProfileInput, now: Date): Promise<{ risk: RiskDto }> {
  const existing = await db.profile.findUnique({ where: { id: userId }, select: { role: true } });
  if (existing && existing.role !== "PATIENT") throw new ApiError("FORBIDDEN", "Réservé aux patientes");

  const fields = patientFields(input);
  const profile = { fullName: input.fullName, phone: input.phone ?? null };
  await db.profile.upsert({
    where: { id: userId },
    create: { id: userId, role: "PATIENT", ...profile },
    update: profile,
  });
  const patient = await db.patient.upsert({
    where: { profileId: userId },
    create: { profileId: userId, consentAt: now, ...fields },
    update: fields,
  });

  const { risk } = await assess(await loadPatientData(patient.id, now), "PROFILE", now);
  return { risk: riskResultDto(risk, now) };
}

/** POST /api/patient/sessions — store, confirm / resolve severe readings, assess (spec §6.4). */
export async function recordSession(
  patientId: string,
  input: SessionInput,
  now: Date,
  demoMode: boolean,
): Promise<SessionOutput> {
  const takenAt = input.takenAt ? new Date(input.takenAt) : now;
  if (takenAt.getTime() > now.getTime() + MAX_FUTURE_MS) throw new ApiError("INVALID", "Date de mesure dans le futur");

  const data = await loadPatientData(patientId, now);
  const existing = await expireAndSave(data.sessions, now);
  const id = randomUUID();
  const { status, updates } = registerSession(existing, { id, sys: input.sys, dia: input.dia, takenAt });

  const row = await db.bpSession.create({
    data: {
      id,
      patientId,
      sys: input.sys,
      dia: input.dia,
      pulse: input.pulse ?? null,
      takenAt,
      source: input.source ?? "MANUAL",
      status,
    },
  });
  await saveSessionUpdates(updates);

  const sessions = applyUpdates([toSessionRecord(row), ...existing], updates);
  const { risk, result } = await assess({ ...data, sessions }, "SESSION", now);
  return {
    session: sessionDto(row),
    evaluation: patientEvaluation(result, { newSessionStatus: status, demoMode }),
    risk: riskResultDto(risk, now),
  };
}

/** POST /api/patient/questionnaires — a danger answer is an emergency whatever the BP (spec §6.4 step 1). */
export async function recordQuestionnaire(
  patientId: string,
  input: QuestionnaireInput,
  now: Date,
  demoMode: boolean,
): Promise<QuestionnaireOutput> {
  await db.questionnaire.create({ data: { patientId, answers: { ...input.answers }, answeredAt: now } });
  const data = await loadPatientData(patientId, now);
  const sessions = await expireAndSave(data.sessions, now);
  const { risk, result } = await assess({ ...data, sessions }, "QUESTIONNAIRE", now);
  return { evaluation: patientEvaluation(result, { demoMode }), risk: riskResultDto(risk, now) };
}
