import { isRed } from "@/lib/domain/levels";
import type { AlertStatus } from "@/lib/domain/types";
import { ServiceError, type Ctx, type Viewer } from "./context";
import { refreshPatient } from "./patientState";
import { alertDto, type AlertDto } from "./views";

async function doctorScope(ctx: Ctx, viewer: Viewer) {
  if (viewer.role !== "DOCTOR") throw new ServiceError("FORBIDDEN", "Doctors only");
  const patients = await ctx.repo.listPatients(viewer.doctorId);
  const users = await Promise.all(patients.map((p) => ctx.repo.getUser(p.userId)));
  return { patients, nameOf: new Map(patients.map((p, i) => [p.id, users[i]?.name ?? ""])) };
}

/** The alert inbox: the doctor's own patients only, newest first. */
export async function listDoctorAlerts(ctx: Ctx, viewer: Viewer, status: AlertStatus | null): Promise<AlertDto[]> {
  const { patients, nameOf } = await doctorScope(ctx, viewer);
  const alerts = await ctx.repo.listAlerts(patients.map((p) => p.id));
  return alerts
    .filter((a) => status == null || a.status === status)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((a) => alertDto(a, nameOf.get(a.patientId) ?? ""));
}

/**
 * Acknowledge (OPEN → ACKNOWLEDGED, stamps ackAt) or close. Closing a red
 * alert ends that red rule; the patient is then re-assessed by the rules.
 */
export async function updateAlertStatus(
  ctx: Ctx,
  viewer: Viewer,
  alertId: string,
  status: Extract<AlertStatus, "ACKNOWLEDGED" | "CLOSED">,
): Promise<AlertDto> {
  const { nameOf } = await doctorScope(ctx, viewer);
  const alert = await ctx.repo.getAlert(alertId);
  if (!alert || !nameOf.has(alert.patientId)) throw new ServiceError("NOT_FOUND", "Alert not found");
  if (alert.status === "CLOSED") throw new ServiceError("INVALID", "Alert already closed");
  if (status === "ACKNOWLEDGED" && alert.status === "ACKNOWLEDGED") return alertDto(alert, nameOf.get(alert.patientId) ?? "");

  // Red: ackAt keeps the first response time (indicator). Non-red close: ackAt marks the close,
  // so the same alert only comes back with a newer reading (planAlert).
  const closesNonRed = status === "CLOSED" && !isRed(alert.level);
  const updated = await ctx.repo.updateAlert(alert.id, { status, ackAt: closesNonRed ? ctx.now : (alert.ackAt ?? ctx.now) });
  if (status === "CLOSED") {
    const patient = await ctx.repo.getPatient(alert.patientId);
    if (patient) await refreshPatient(ctx, patient);
  }
  return alertDto(updated, nameOf.get(alert.patientId) ?? "");
}
