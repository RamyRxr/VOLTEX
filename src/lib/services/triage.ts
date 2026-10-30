import { describeFinding, describeReason } from "@/lib/domain/describe";
import { isRed, SEVERITY } from "@/lib/domain/levels";
import { validSessions } from "@/lib/domain/session";
import { sameDay } from "@/lib/format";
import type { AlertRow } from "@/lib/store/types";
import { toDomainSession, type Ctx } from "./context";
import { loadPatientState, type PatientState } from "./patientState";
import { GROUP_ORDER } from "./triageOrder";
import { alertDto, type TriageDto, type TriageGroup, type TriageRowDto } from "./views";

export { GROUP_ORDER };

function groupOf(state: PatientState): TriageGroup {
  switch (state.level) {
    case "RED_EMERGENCY":
      return "EMERGENCY";
    case "RED_CRISIS":
      return "CRISIS";
    case "ORANGE":
      return "ORANGE";
    case "YELLOW":
      return "YELLOW";
    default:
      if (state.assessment.pendingCrisis) return "UNCONFIRMED";
      return state.level === "GREY_SILENT" ? "SILENT" : "GREEN";
  }
}

/** The unresolved alert that best explains the row: most severe, then newest. */
function mainAlert(alerts: readonly AlertRow[]): AlertRow | null {
  const unresolved = alerts
    .filter((a) => a.status !== "CLOSED")
    .sort((a, b) => SEVERITY[a.level] - SEVERITY[b.level] || b.createdAt.getTime() - a.createdAt.getTime());
  return unresolved[0] ?? null;
}

function rowOf(state: PatientState, name: string): TriageRowDto {
  const { assessment: a, patient } = state;
  const alert = mainAlert(state.alerts);
  const last = state.sessions.at(-1) ?? null;
  const redFromAlert = alert && isRed(alert.level) && SEVERITY[alert.level] < SEVERITY[a.level];
  const silence = a.findings.find((f) => f.kind === "SILENCE");

  return {
    patientId: patient.id,
    name,
    age: patient.age,
    sex: patient.sex,
    level: state.level,
    group: groupOf(state),
    reason: redFromAlert ? alert.reason : describeReason(a),
    silent: silence ? { days: a.silence.days, text: describeFinding(silence) } : null,
    unconfirmed: a.pendingCrisis ? { bp: a.pendingCrisis.bp, awaiting: a.pendingCrisis.awaiting } : null,
    last: last
      ? { sys: last.avgSys, dia: last.avgDia, at: last.startedAt.toISOString(), status: last.status, channel: last.channel }
      : null,
    avg7: a.avg7,
    trend: a.trend ? { direction: a.trend.direction, perWeek: Math.round(a.trend.perWeek * 10) / 10 } : null,
    adherence: a.adherence,
    spark: validSessions(state.sessions.map(toDomainSession)).slice(-10).map((s) => s.avgSys),
    alert: alert ? { id: alert.id, level: alert.level, status: alert.status, createdAt: alert.createdAt.toISOString() } : null,
  };
}

const lastAt = (r: TriageRowDto) => (r.last ? Date.parse(r.last.at) : 0);

/** Red groups: unacknowledged alerts first, newest first. Then most recent session first. */
function compareRows(a: TriageRowDto, b: TriageRowDto): number {
  const byGroup = GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group);
  if (byGroup !== 0) return byGroup;
  if (a.group === "EMERGENCY" || a.group === "CRISIS") {
    const openA = a.alert?.status === "OPEN" ? 0 : 1;
    const openB = b.alert?.status === "OPEN" ? 0 : 1;
    if (openA !== openB) return openA - openB;
    const byAlert = Date.parse(b.alert?.createdAt ?? "0") - Date.parse(a.alert?.createdAt ?? "0");
    if (byAlert !== 0) return byAlert;
  }
  return lastAt(b) - lastAt(a) || a.name.localeCompare(b.name, "fr");
}

export async function getTriage(ctx: Ctx, doctorId: string): Promise<TriageDto> {
  const patients = await ctx.repo.listPatients(doctorId);
  const states = await Promise.all(patients.map((p) => loadPatientState(ctx, p)));
  const users = await Promise.all(patients.map((p) => ctx.repo.getUser(p.userId)));
  const nameOf = new Map(patients.map((p, i) => [p.id, users[i]?.name ?? ""]));

  const rows = states.map((s) => rowOf(s, nameOf.get(s.patient.id) ?? "")).sort(compareRows);
  const counts = Object.fromEntries(GROUP_ORDER.map((g) => [g, rows.filter((r) => r.group === g).length])) as Record<TriageGroup, number>;

  const receivedToday = states.reduce((n, s) => n + s.sessions.filter((x) => sameDay(x.startedAt, ctx.now)).length, 0);
  const doctor = await ctx.repo.getDoctor(doctorId);

  const openRedAlerts = states
    .flatMap((s) => s.alerts.filter((a) => a.status === "OPEN" && isRed(a.level)))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((a) => alertDto(a, nameOf.get(a.patientId) ?? ""));

  return { rows, counts, receivedToday, openRedAlerts, digestTime: doctor?.digestTime ?? "", generatedAt: ctx.now.toISOString() };
}
