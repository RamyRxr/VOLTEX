import { requirePatient } from "@/lib/auth/server";
import type { PatientOutcome } from "@/lib/domain/evaluate";
import type { PatientStatus } from "@/lib/domain/levels";
import { serviceContext, timings } from "@/lib/demo";
import { handle, ok, readJson, tooManyRequests } from "@/lib/http";
import { LIMITS, allow } from "@/lib/rateLimit";
import { ingestSession } from "@/lib/services/ingest";
import { sessionDto, type SessionDto } from "@/lib/services/views";
import { sessionSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export interface SessionResultDto {
  readonly session: SessionDto;
  readonly outcome: PatientOutcome;
  readonly status: PatientStatus;
  readonly advice: string;
  /** Rest before the confirmation session (shortened in demo mode). */
  readonly restSeconds: number;
}

/** Web session: 1–2 readings, pill status, symptoms → evaluation result. */
export async function POST(req: Request) {
  return handle(async () => {
    const viewer = await requirePatient();
    if (!allow(`session:${viewer.patientId}`, LIMITS.session.max, LIMITS.session.windowMs)) return tooManyRequests();
    const body = await readJson(req, sessionSchema);
    const ctx = await serviceContext();
    const result = await ingestSession(ctx, {
      patientId: viewer.patientId,
      channel: "WEB",
      readings: body.readings.map((r) => ({ ...r, takenAt: r.takenAt ? new Date(r.takenAt) : undefined })),
      pillStatus: body.pillStatus,
      symptoms: body.symptoms,
    });
    return ok<SessionResultDto>(
      {
        session: sessionDto(result.session),
        outcome: result.evaluation.outcome,
        status: result.status,
        advice: result.advice.text,
        restSeconds: timings(ctx.demoMode).restSeconds,
      },
      201,
    );
  });
}
