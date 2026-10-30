import { db } from "./db";
import { assess, expireAndSave, loadPatientData } from "./pipeline";

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
    const data = await loadPatientData(id, now);
    const sessions = await expireAndSave(data.sessions, now);
    const { alertsWritten: written } = await assess({ ...data, sessions }, "JOB", now);
    alertsWritten += written;
  }
  return { patients: patients.length, alertsWritten };
}
