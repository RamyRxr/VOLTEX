import type { Ctx } from "./context";
import { refreshPatient } from "./patientState";

export interface JobReport {
  readonly patients: number;
  readonly silent: number;
}

/**
 * Cron (CLAUDE.md §10): expire PENDING sessions past the window, detect
 * silence, and keep every patient's alerts in step with the rules.
 */
export async function runSilenceJob(ctx: Ctx): Promise<JobReport> {
  const patients = await ctx.repo.listPatients();
  const states = await Promise.all(patients.map((p) => refreshPatient(ctx, p)));
  return { patients: patients.length, silent: states.filter((s) => s.assessment.silence.silent).length };
}
