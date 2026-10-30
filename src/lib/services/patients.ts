import { homeAdvice } from "@/lib/domain/advice";
import {
  describeAdherence,
  describeFinding,
  describeMissedPill,
  describeOffice,
  describeReason,
  describeTrend,
} from "@/lib/domain/describe";
import { SEVERITY, toPatientStatus } from "@/lib/domain/levels";
import { sessionsWithinDays, validSessions } from "@/lib/domain/session";
import { bpText, t } from "@/lib/i18n";
import type { PatientPatch, PatientRow } from "@/lib/store/types";
import { adviceText } from "./advice";
import { ServiceError, patientForViewer, toDomainSession, type Ctx, type Viewer } from "./context";
import { listThread } from "./messages";
import { loadPatientState, refreshPatient, type PatientState } from "./patientState";
import {
  alertDto,
  sessionDto,
  type DoctorPatientView,
  type InfoLineDto,
  type PatientSelfView,
  type SessionDto,
  type UnconfirmedDto,
} from "./views";

const HISTORY_DAYS = 90;
const DAY = 86_400_000;

function infoLines(state: PatientState): InfoLineDto[] {
  const a = state.assessment;
  const flagged = new Set(a.findings.map((f) => f.kind));
  const lines: InfoLineDto[] = [];
  if (a.missedPill) lines.push({ id: "missedPill", text: describeMissedPill(a.missedPill), emphasis: a.missedPill.flagged });
  if (a.office) lines.push({ id: "office", text: describeOffice(a.office), emphasis: true });
  const silence = a.findings.find((f) => f.kind === "SILENCE");
  if (silence) lines.push({ id: "silence", text: describeFinding(silence), emphasis: true });
  if (a.trend) lines.push({ id: "trend", text: describeTrend(a.trend), emphasis: flagged.has("TREND") });
  if (a.adherence != null) lines.push({ id: "adherence", text: describeAdherence(a.adherence), emphasis: false });
  return lines;
}

const UNCONFIRMED_KEY = {
  PENDING: "unconfirmed.PENDING",
  EXPIRED: "unconfirmed.EXPIRED",
  NOT_CONFIRMED: "unconfirmed.NOT_CONFIRMED",
} as const;

function unconfirmedSessions(state: PatientState, now: Date): UnconfirmedDto[] {
  return state.sessions
    .filter((s): s is typeof s & { status: keyof typeof UNCONFIRMED_KEY } => s.status in UNCONFIRMED_KEY)
    .filter((s) => now.getTime() - s.startedAt.getTime() <= HISTORY_DAYS * DAY)
    .reverse()
    .map((s) => {
      const bp = { sys: s.avgSys, dia: s.avgDia };
      return { id: s.id, startedAt: s.startedAt.toISOString(), bp, status: s.status, text: t(UNCONFIRMED_KEY[s.status], { bp: bpText(bp) }) };
    });
}

const recentSessions = (state: PatientState, now: Date) =>
  state.sessions.filter((s) => now.getTime() - s.startedAt.getTime() <= HISTORY_DAYS * DAY).map(sessionDto);

export async function getDoctorPatientView(ctx: Ctx, viewer: Viewer, patientId: string): Promise<DoctorPatientView> {
  if (viewer.role !== "DOCTOR") throw new ServiceError("FORBIDDEN", "Doctors only");
  const patient = await patientForViewer(ctx, viewer, patientId);
  const state = await loadPatientState(ctx, patient);
  const user = await ctx.repo.getUser(patient.userId);
  const name = user?.name ?? "";
  const a = state.assessment;

  return {
    patient: {
      id: patient.id,
      name,
      age: patient.age,
      sex: patient.sex,
      phone: user?.phone ?? "",
      language: user?.language ?? "FR",
      treatmentNames: patient.treatmentNames,
      target: a.target,
      targetSys: patient.targetSys,
      targetDia: patient.targetDia,
      expectedReadingsPerWeek: patient.expectedReadingsPerWeek,
      lastOfficeSys: patient.lastOfficeSys,
      lastOfficeDia: patient.lastOfficeDia,
      emergencyContactPhone: patient.emergencyContactPhone,
      doctorNotes: patient.doctorNotes,
      consentAt: patient.consentAt.toISOString(),
    },
    level: state.level,
    reason: describeReason(a),
    followUp: SEVERITY[state.level] <= SEVERITY.ORANGE || Boolean(a.trend?.rising),
    info: infoLines(state),
    unconfirmed: unconfirmedSessions(state, ctx.now),
    avg7: a.avg7,
    sessions: recentSessions(state, ctx.now),
    alerts: [...state.alerts]
      .sort((x, y) => y.createdAt.getTime() - x.createdAt.getTime())
      .map((al) => alertDto(al, name)),
    messages: await listThread(ctx, patient),
    generatedAt: ctx.now.toISOString(),
  };
}

export async function getPatientSelfView(ctx: Ctx, viewer: Viewer): Promise<PatientSelfView> {
  if (viewer.role !== "PATIENT") throw new ServiceError("FORBIDDEN", "Patients only");
  const patient = await patientForViewer(ctx, viewer, viewer.patientId);
  const state = await loadPatientState(ctx, patient);
  const [user, doctor] = await Promise.all([ctx.repo.getUser(patient.userId), ctx.repo.getDoctor(patient.doctorId)]);
  const doctorUser = doctor ? await ctx.repo.getUser(doctor.userId) : null;
  const valid = validSessions(state.sessions.map(toDomainSession));
  const lang = user?.language ?? "FR";

  return {
    patientId: patient.id,
    firstName: (user?.name ?? "").split(" ")[0] ?? "",
    status: toPatientStatus(state.assessment.level),
    advice: await adviceText(ctx, homeAdvice(state.assessment), lang),
    target: state.assessment.target,
    expectedReadingsPerWeek: patient.expectedReadingsPerWeek,
    weekCount: sessionsWithinDays(valid, ctx.now, 7).length,
    last: state.sessions.length ? sessionDto(state.sessions[state.sessions.length - 1]) : null,
    sessions: recentSessions(state, ctx.now),
    doctor: { name: doctorUser?.name ?? "", phone: doctorUser?.phone ?? "" },
    messages: await listThread(ctx, patient),
    generatedAt: ctx.now.toISOString(),
  };
}

/** Names and phones of the doctor's patients, for the SMS simulator. */
export async function listPatientContacts(ctx: Ctx, viewer: Viewer): Promise<{ name: string; phone: string }[]> {
  if (viewer.role !== "DOCTOR") throw new ServiceError("FORBIDDEN", "Doctors only");
  const patients = await ctx.repo.listPatients(viewer.doctorId);
  const users = await Promise.all(patients.map((p) => ctx.repo.getUser(p.userId)));
  return users
    .filter((u): u is NonNullable<typeof u> => u != null)
    .map((u) => ({ name: u.name, phone: u.phone }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

/** History for the doctor (own patient) or the patient themself. */
export async function listPatientSessions(ctx: Ctx, viewer: Viewer, patientId: string, days: number): Promise<SessionDto[]> {
  const patient = await patientForViewer(ctx, viewer, patientId);
  const sessions = await ctx.repo.listSessions(patient.id);
  return sessions.filter((s) => ctx.now.getTime() - s.startedAt.getTime() <= days * DAY).map(sessionDto);
}

/** Doctor edits target, expected frequency, office reading, notes; levels follow. */
export async function updatePatientSettings(
  ctx: Ctx,
  viewer: Viewer,
  patientId: string,
  patch: PatientPatch,
): Promise<PatientRow> {
  if (viewer.role !== "DOCTOR") throw new ServiceError("FORBIDDEN", "Doctors only");
  await patientForViewer(ctx, viewer, patientId);
  const updated = await ctx.repo.updatePatient(patientId, patch);
  await refreshPatient(ctx, updated);
  return updated;
}
