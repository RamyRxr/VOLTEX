import { resultAdvice, type AdviceSituation } from "@/lib/domain/advice";
import { evaluateSession, type SessionEvaluation } from "@/lib/domain/evaluate";
import { toPatientStatus, type Assessment, type PatientStatus } from "@/lib/domain/levels";
import type { Channel, PillStatus, SymptomType } from "@/lib/domain/types";
import type { PatientRow, SessionWithDetails } from "@/lib/store/types";
import { ServiceError, minGapMs, toDomainSession, windowMs, type Ctx } from "./context";
import { expirePending, refreshPatient } from "./patientState";
import { adviceText } from "./advice";

export interface IngestReading {
  readonly sys: number;
  readonly dia: number;
  readonly pulse: number | null;
  readonly takenAt?: Date;
}

export interface IngestInput {
  readonly patientId: string;
  readonly channel: Channel;
  readonly readings: readonly IngestReading[];
  readonly pillStatus: PillStatus;
  readonly symptoms: readonly SymptomType[];
  readonly rawSms?: string | null;
}

export interface IngestResult {
  readonly patient: PatientRow;
  readonly session: SessionWithDetails;
  readonly evaluation: SessionEvaluation;
  readonly assessment: Assessment;
  readonly status: PatientStatus;
  readonly advice: { readonly situation: AdviceSituation; readonly text: string };
}

/** A reading time sent by the client is kept only if it is plausible. */
const MAX_CLIENT_SKEW_MS = 60_000;
const MAX_READING_AGE_MS = 30 * 60_000;

function readingTime(ctx: Ctx, takenAt: Date | undefined): Date {
  if (!takenAt) return ctx.now;
  const age = ctx.now.getTime() - takenAt.getTime();
  return age >= -MAX_CLIENT_SKEW_MS && age <= MAX_READING_AGE_MS ? takenAt : ctx.now;
}

/**
 * The one ingestion path for every channel (spec rule 2): the web page,
 * the SMS webhook, the SMS simulator and the seed all come through here.
 */
export async function ingestSession(ctx: Ctx, input: IngestInput): Promise<IngestResult> {
  const patient = await ctx.repo.getPatient(input.patientId);
  if (!patient) throw new ServiceError("NOT_FOUND", "Patient not found");
  if (input.readings.length < 1 || input.readings.length > 2) {
    throw new ServiceError("INVALID", "A session has one or two readings");
  }

  const history = await expirePending(ctx, patient.id);
  const evaluation = evaluateSession({
    input,
    history: history.map(toDomainSession),
    patient,
    now: ctx.now,
    windowMs: windowMs(ctx),
    minGapMs: minGapMs(ctx),
  });

  const session = await ctx.repo.createSession({
    session: {
      patientId: patient.id,
      channel: input.channel,
      startedAt: ctx.now,
      ...evaluation.average,
      pillStatus: input.pillStatus,
      status: evaluation.status,
      confirmedBySessionId: null,
      rawSms: input.rawSms ?? null,
    },
    readings: input.readings.map((r, i) => ({
      readingIndex: i + 1,
      sys: r.sys,
      dia: r.dia,
      pulse: r.pulse,
      takenAt: readingTime(ctx, r.takenAt),
    })),
    symptoms: [...new Set(input.symptoms)],
  });

  if (evaluation.resolved) {
    await ctx.repo.updateSession(evaluation.resolved.sessionId, {
      status: evaluation.resolved.status,
      confirmedBySessionId: session.id,
    });
  }

  const state = await refreshPatient(ctx, patient);
  const situation = resultAdvice({
    evaluation,
    assessment: state.assessment,
    bp: { sys: session.avgSys, dia: session.avgDia },
    pillStatus: input.pillStatus,
  });
  const user = await ctx.repo.getUser(patient.userId);

  return {
    patient,
    session,
    evaluation,
    assessment: state.assessment,
    status: toPatientStatus(state.assessment.level),
    advice: { situation, text: await adviceText(ctx, situation, user?.language ?? "FR") },
  };
}
