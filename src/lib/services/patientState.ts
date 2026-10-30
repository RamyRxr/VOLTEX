import { alertCandidate, planAlert, silenceAlertsToClose } from "@/lib/domain/alerts";
import { describeFinding } from "@/lib/domain/describe";
import { assessPatient, isRed, mergeAlertLevel, type Assessment } from "@/lib/domain/levels";
import { staleSessionIds } from "@/lib/domain/session";
import type { Level } from "@/lib/domain/types";
import type { AlertRow, PatientRow, SessionWithDetails } from "@/lib/store/types";
import { toDomainSession, toProfile, windowMs, type Ctx } from "./context";

export interface PatientState {
  readonly patient: PatientRow;
  readonly sessions: readonly SessionWithDetails[];
  readonly alerts: readonly AlertRow[];
  readonly assessment: Assessment;
  /** Assessment level, kept red while a red alert is unresolved. */
  readonly level: Level;
}

/** PENDING sessions past the confirmation window become EXPIRED (idempotent). */
export async function expirePending(ctx: Ctx, patientId: string): Promise<SessionWithDetails[]> {
  const sessions = await ctx.repo.listSessions(patientId);
  const stale = staleSessionIds(sessions.map(toDomainSession), ctx.now, windowMs(ctx));
  if (stale.length === 0) return sessions;
  await Promise.all(stale.map((id) => ctx.repo.updateSession(id, { status: "EXPIRED" })));
  return ctx.repo.listSessions(patientId);
}

const closedRedSessionIds = (alerts: readonly AlertRow[]) =>
  new Set(
    alerts
      .filter((a) => a.status === "CLOSED" && isRed(a.level) && a.sessionId)
      .map((a) => a.sessionId as string),
  );

export async function loadPatientState(ctx: Ctx, patient: PatientRow): Promise<PatientState> {
  const sessions = await expirePending(ctx, patient.id);
  const alerts = await ctx.repo.listAlerts([patient.id]);
  const assessment = assessPatient({
    patient: toProfile(patient),
    sessions: sessions.map(toDomainSession),
    now: ctx.now,
    windowMs: windowMs(ctx),
    closedRedSessionIds: closedRedSessionIds(alerts),
  });
  const unresolved = alerts.filter((a) => a.status !== "CLOSED").map((a) => a.level);
  return { patient, sessions, alerts, assessment, level: mergeAlertLevel(assessment.level, unresolved) };
}

/**
 * Keep alerts in step with the assessment (spec §6.7): one alert for the
 * rule that set the level, de-duplicated; silence alerts close on a new reading.
 */
export async function syncAlerts(ctx: Ctx, state: PatientState): Promise<void> {
  const { assessment, alerts, patient } = state;
  const toClose = silenceAlertsToClose(alerts, assessment);
  await Promise.all(toClose.map((id) => ctx.repo.updateAlert(id, { status: "CLOSED" })));

  const candidate = alertCandidate(assessment.primary);
  if (!candidate || !assessment.primary) return;
  const reason = describeFinding(assessment.primary);
  const plan = planAlert(candidate, alerts);
  if (plan.action === "create") {
    await ctx.repo.createAlert({
      patientId: patient.id,
      sessionId: candidate.sessionId,
      level: candidate.level,
      evidence: candidate.evidence,
      reason,
      status: "OPEN",
      createdAt: ctx.now,
      ackAt: null,
    });
  } else if (plan.action === "update") {
    await ctx.repo.updateAlert(plan.alertId, { reason, sessionId: candidate.sessionId });
  }
}

/** Load, re-evaluate alerts, and return the fresh state. */
export async function refreshPatient(ctx: Ctx, patient: PatientRow): Promise<PatientState> {
  const before = await loadPatientState(ctx, patient);
  await syncAlerts(ctx, before);
  return { ...before, alerts: await ctx.repo.listAlerts([patient.id]) };
}
