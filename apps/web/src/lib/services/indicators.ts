import { computeIndicators, type Indicators } from "@/lib/domain/indicators";
import { ServiceError, toDomainSession, toProfile, windowMs, type Ctx, type Viewer } from "./context";

import type { IndicatorPeriod } from "./indicatorPeriods";

export { INDICATOR_PERIODS, type IndicatorPeriod } from "./indicatorPeriods";

export interface IndicatorsDto {
  readonly weeks: readonly { readonly start: string; readonly end: string }[];
  readonly patients: number;
  readonly frequency: Indicators["frequency"];
  readonly evolution: Indicators["evolution"];
  readonly alerts: Indicators["alerts"];
  readonly regularity: Indicators["regularity"];
  readonly control: Indicators["control"];
  readonly response: Indicators["response"];
  readonly generatedAt: string;
}

/** CLAUDE.md §8, for the doctor's own patients, computed from stored data only. */
export async function getIndicators(ctx: Ctx, viewer: Viewer, weeks: IndicatorPeriod): Promise<IndicatorsDto> {
  if (viewer.role !== "DOCTOR") throw new ServiceError("FORBIDDEN", "Doctors only");
  const patients = await ctx.repo.listPatients(viewer.doctorId);
  const sessions = await Promise.all(patients.map((p) => ctx.repo.listSessions(p.id)));
  const alerts = await ctx.repo.listAlerts(patients.map((p) => p.id));

  const ind = computeIndicators({
    patients: patients.map((p, i) => ({ profile: toProfile(p), sessions: sessions[i].map(toDomainSession) })),
    alerts,
    to: ctx.now,
    weeks,
    windowMs: windowMs(ctx),
  });

  return {
    weeks: ind.weeks.map((w) => ({ start: w.start.toISOString(), end: w.end.toISOString() })),
    patients: patients.length,
    frequency: ind.frequency,
    evolution: ind.evolution,
    alerts: ind.alerts,
    regularity: ind.regularity,
    control: ind.control,
    response: ind.response,
    generatedAt: ctx.now.toISOString(),
  };
}
