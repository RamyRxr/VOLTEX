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
import { forgetViewer } from "./auth";
import { db } from "./db";
import { ApiError } from "./http";
import { riskResultDto, sessionDto, toSessionRecord } from "./mappers";
import { assess, expireAndSave, loadPatientData, saveSessionUpdates, withPatientLock } from "./pipeline";

/** Readings may be back-dated up to 7 days, not dated in the future (small clock skew allowed). */
const MAX_FUTURE_MS = 5 * 60_000;
const MAX_PAST_MS = 7 * 86_400_000;

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

const WEEK_MS = 7 * 86_400_000;
const YEAR_MS = 365.25 * 86_400_000;
const AGE_RANGE = { min: 12, max: 60 };
const MAX_PREGNANCY_WEEKS = 45;

/** Plausibility of the dates against the server clock (the Zod schema checks formats only). */
function checkDates(fields: { birthDate: Date; dueDate: Date | null; lmpDate: Date | null }, now: Date): void {
  const age = (now.getTime() - fields.birthDate.getTime()) / YEAR_MS;
  if (age < AGE_RANGE.min || age > AGE_RANGE.max) throw new ApiError("INVALID", "Date de naissance invalide");
  const lmp = fields.lmpDate ?? (fields.dueDate ? new Date(fields.dueDate.getTime() - 40 * WEEK_MS) : null);
  if (!lmp) return;
  const weeks = (now.getTime() - lmp.getTime()) / WEEK_MS;
  if (weeks < 0 || weeks > MAX_PREGNANCY_WEEKS) throw new ApiError("INVALID", "Dates de grossesse invalides");
}

/** POST /api/patient/profile — creates or updates Profile + Patient, then the risk (spec §4.1.2–3). */
export async function saveProfile(userId: string, input: ProfileInput, now: Date): Promise<{ risk: RiskDto }> {
  const existing = await db.profile.findUnique({ where: { id: userId }, select: { role: true } });
  if (existing && existing.role !== "PATIENT") throw new ApiError("FORBIDDEN", "Réservé aux patientes");

  const fields = patientFields(input);
  checkDates(fields, now);
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
  forgetViewer(userId);

  const { risk } = await withPatientLock(patient.id, async (tx) =>
    assess(tx, await loadPatientData(tx, patient.id, now), "PROFILE", now),
  );
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
  if (takenAt.getTime() < now.getTime() - MAX_PAST_MS) throw new ApiError("INVALID", "Date de mesure trop ancienne");

  return withPatientLock(patientId, async (tx) => {
    const data = await loadPatientData(tx, patientId, now);
    const existing = await expireAndSave(tx, data.sessions, now);
    const id = randomUUID();
    const { status, updates } = registerSession(existing, { id, sys: input.sys, dia: input.dia, takenAt });

    const row = await tx.bpSession.create({
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
    await saveSessionUpdates(tx, updates);

    const sessions = applyUpdates([toSessionRecord(row), ...existing], updates);
    const { risk, result } = await assess(tx, { ...data, sessions }, "SESSION", now);
    return {
      session: sessionDto(row),
      evaluation: patientEvaluation(result, { newSessionStatus: status, demoMode }),
      risk: riskResultDto(risk, now),
    };
  });
}

/** POST /api/patient/questionnaires — a danger answer is an emergency whatever the BP (spec §6.4 step 1). */
export async function recordQuestionnaire(
  patientId: string,
  input: QuestionnaireInput,
  now: Date,
  demoMode: boolean,
): Promise<QuestionnaireOutput> {
  return withPatientLock(patientId, async (tx) => {
    await tx.questionnaire.create({ data: { patientId, answers: { ...input.answers }, answeredAt: now } });
    const data = await loadPatientData(tx, patientId, now);
    const sessions = await expireAndSave(tx, data.sessions, now);
    const { risk, result } = await assess(tx, { ...data, sessions }, "QUESTIONNAIRE", now);
    return { evaluation: patientEvaluation(result, { demoMode }), risk: riskResultDto(risk, now) };
  });
}
