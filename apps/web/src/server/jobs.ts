import { db } from "./db";
import { reassess } from "./pipeline";

export interface SilenceJobResult {
  readonly patients: number;
  readonly alertsWritten: number;
}

/**
 * Cron (spec §8 /api/jobs/silence): expire pending severe readings and run
 * detection for every linked patient, so SILENT alerts appear without a new reading.
 */
export async function runSilenceJob(now: Date): Promise<SilenceJobResult> {
  const patients = await db.patient.findMany({
    where: { links: { some: { status: "ACCEPTED" } } },
    select: { id: true },
  });
  let alertsWritten = 0;
  for (const { id } of patients) {
    const { alertsWritten: written } = await reassess(id, "JOB", now);
    alertsWritten += written;
  }
  return { patients: patients.length, alertsWritten };
}
