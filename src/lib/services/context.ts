import { confirmationMinGapMs, confirmationWindowMs } from "@/lib/domain/session";
import type { DomainSession, PatientProfile } from "@/lib/domain/types";
import type { PatientRow, Repo, SessionWithDetails } from "@/lib/store/types";

/** Everything a service needs. `now` is injected so the seed can replay history. */
export interface Ctx {
  readonly repo: Repo;
  readonly now: Date;
  readonly demoMode: boolean;
}

/** Who is asking. Every doctor query is scoped by doctorId (spec §3). */
export type Viewer =
  | { readonly role: "DOCTOR"; readonly userId: string; readonly doctorId: string }
  | { readonly role: "PATIENT"; readonly userId: string; readonly patientId: string };

export type ServiceErrorCode = "NOT_FOUND" | "FORBIDDEN" | "INVALID" | "UNAUTHORIZED";

export class ServiceError extends Error {
  constructor(
    readonly code: ServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

export const windowMs = (ctx: Ctx) => confirmationWindowMs(ctx.demoMode);
export const minGapMs = (ctx: Ctx) => confirmationMinGapMs(ctx.demoMode);

export function toDomainSession(s: SessionWithDetails): DomainSession {
  return {
    id: s.id,
    startedAt: s.startedAt,
    channel: s.channel,
    avgSys: s.avgSys,
    avgDia: s.avgDia,
    avgPulse: s.avgPulse,
    pillStatus: s.pillStatus,
    status: s.status,
    confirmedBySessionId: s.confirmedBySessionId,
    symptoms: s.symptoms,
  };
}

export function toProfile(p: PatientRow): PatientProfile {
  return {
    targetSys: p.targetSys,
    targetDia: p.targetDia,
    expectedReadingsPerWeek: p.expectedReadingsPerWeek,
    lastOfficeSys: p.lastOfficeSys,
    lastOfficeDia: p.lastOfficeDia,
    enrolledAt: p.consentAt,
  };
}

/** A doctor sees only their own patients; a patient sees only themself. */
export async function patientForViewer(ctx: Ctx, viewer: Viewer, patientId: string): Promise<PatientRow> {
  const patient = await ctx.repo.getPatient(patientId);
  const allowed =
    patient != null &&
    ((viewer.role === "DOCTOR" && patient.doctorId === viewer.doctorId) ||
      (viewer.role === "PATIENT" && patient.id === viewer.patientId));
  // Same answer for "missing" and "not yours": never confirm another doctor's patient exists.
  if (!patient || !allowed) throw new ServiceError("NOT_FOUND", "Patient not found");
  return patient;
}
