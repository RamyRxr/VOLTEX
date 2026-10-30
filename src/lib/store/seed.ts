import { alertCandidate } from "@/lib/domain/alerts";
import { isRed } from "@/lib/domain/levels";
import { normalizePhone } from "@/lib/domain/phone";
import type { Channel, PillStatus, SymptomType } from "@/lib/domain/types";
import type { Ctx } from "@/lib/services/context";
import { ingestSession, type IngestReading } from "@/lib/services/ingest";
import { runSilenceJob } from "@/lib/services/jobs";
import { loadPatientState } from "@/lib/services/patientState";
import {
  ADVICE_FR,
  DEMO_DOCTOR,
  SEED_MESSAGES,
  STABLE_SPECS,
  STORY_PATIENTS,
  TREATMENTS,
  type SeedEvent,
  type SeedPatient,
  type StableSpec,
} from "./seedData";
import type { AlertRow, Repo } from "./types";

const DAY = 86_400_000;
const HOUR = 3_600_000;
const MINUTE = 60_000;
const HISTORY_DAYS = 56;
const CONFIRM_GAP_MINUTES = 10;
/** Hours the doctor took on past non-red alerts (deterministic, for realism). */
const NON_RED_ACK_HOURS = [3, 9, 20, 5, 14] as const;
const DEFAULT_RED_ACK_MINUTES = 6;

/** Deterministic generator: the demo is identical every time it is reset. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const phone = (raw: string): string => {
  const p = normalizePhone(raw);
  if (!p) throw new Error(`Invalid seed phone ${raw}`);
  return p;
};
const pad2 = (n: number) => String(n).padStart(2, "0");

/* ----------------------------------------------------- stable patients -- */

const JITTER_SYS = [0, 1, -1, 1, 0, -1] as const;
const JITTER_DIA = [0, -1, 1, 0, 1, -1] as const;
const WEEK_PATTERN: Readonly<Record<number, readonly number[]>> = { 2: [1, 4], 3: [0, 2, 5], 4: [0, 2, 4, 6] };
const IMPROVED_SINCE_DAYS = 28;

function stableEvents(spec: StableSpec, index: number, expected: number, base: { sys: number; dia: number }, rnd: () => number) {
  const events: SeedEvent[] = [];
  let k = 0;
  for (let week = 0; week < HISTORY_DAYS / 7; week += 1) {
    for (const off of WEEK_PATTERN[expected]) {
      const d = HISTORY_DAYS - week * 7 - Math.min(6, off + (index % 2));
      if (d < 1 || spec.redEvent?.d === d) continue;
      const lift = spec.improving && d > IMPROVED_SINCE_DAYS ? { sys: 20, dia: 10 } : { sys: 0, dia: 0 };
      const sys = base.sys + lift.sys + JITTER_SYS[k % JITTER_SYS.length];
      const dia = base.dia + lift.dia + JITTER_DIA[k % JITTER_DIA.length];
      const r = rnd();
      const pill: PillStatus = r < 0.05 ? "MISSED" : r < 0.07 ? "NOT_REPORTED" : "TAKEN";
      const channel: Channel = rnd() < 0.25 ? "SMS" : "WEB";
      const confirm = lift.sys > 0 ? { sys: sys - 1, dia } : undefined;
      events.push({ d, h: k % 2 === 0 ? 1 + (k % 3) : 11 + (k % 2), sys, dia, pulse: 66 + ((k * 7) % 14), pill, channel, confirm });
      k += 1;
    }
  }
  return spec.redEvent ? [...events, spec.redEvent] : events;
}

function stablePatients(): SeedPatient[] {
  const rnd = lcg(42);
  return STABLE_SPECS.map((spec, i) => {
    const age = 45 + Math.floor(rnd() * 34);
    const expected = 2 + Math.floor(rnd() * 3);
    const base = { sys: 118 + Math.floor(rnd() * 11), dia: 72 + Math.floor(rnd() * 9) };
    const office = { sys: base.sys + 2 + Math.floor(rnd() * 4), dia: base.dia + 1 + Math.floor(rnd() * 3) };
    return {
      key: `stable-${i}`,
      name: spec.name,
      age,
      sex: spec.sex,
      phone: `05550001${pad2(i)}`,
      treatment: [TREATMENTS[i % TREATMENTS.length]],
      expected,
      office,
      emergency: `06610001${pad2(i)}`,
      notes: null,
      events: stableEvents(spec, i, expected, base, rnd),
    };
  });
}

/* ------------------------------------------------------------- replay -- */

interface TimedSession {
  readonly at: Date;
  readonly patientId: string;
  readonly channel: Channel;
  readonly readings: readonly IngestReading[];
  readonly pill: PillStatus;
  readonly symptoms: readonly SymptomType[];
}

function readingsOf(channel: Channel, sys: number, dia: number, pulse: number): IngestReading[] {
  // Two web readings average exactly to (sys, dia); an SMS carries one reading.
  return channel === "SMS"
    ? [{ sys, dia, pulse }]
    : [
        { sys: sys + 1, dia, pulse },
        { sys: sys - 1, dia, pulse: pulse + 2 },
      ];
}

function expand(e: SeedEvent, patientId: string, now: Date): TimedSession[] {
  const at = new Date(now.getTime() - e.d * DAY - e.h * HOUR);
  const channel = e.channel ?? "WEB";
  const base = { patientId, channel, pill: e.pill ?? "TAKEN", symptoms: e.symptoms ?? [] };
  const first: TimedSession = { ...base, at, readings: readingsOf(channel, e.sys, e.dia, e.pulse) };
  if (!e.confirm) return [first];
  const second: TimedSession = {
    ...base,
    symptoms: [],
    at: new Date(at.getTime() + CONFIRM_GAP_MINUTES * MINUTE),
    readings: readingsOf(channel, e.confirm.sys, e.confirm.dia, e.pulse - 2),
  };
  return [first, second];
}

async function createPatient(repo: Repo, doctorId: string, p: SeedPatient, now: Date): Promise<string> {
  const first = Math.max(...p.events.map((e) => e.d), 1);
  const consentAt = new Date(now.getTime() - (first + 1) * DAY);
  const user = await repo.createUser({ role: "PATIENT", phone: phone(p.phone), name: p.name, language: "FR", createdAt: consentAt });
  const patient = await repo.createPatient({
    userId: user.id,
    doctorId,
    age: p.age,
    sex: p.sex,
    treatmentNames: p.treatment,
    targetSys: null,
    targetDia: null,
    expectedReadingsPerWeek: p.expected,
    emergencyContactPhone: p.emergency ? phone(p.emergency) : null,
    lastOfficeSys: p.office?.sys ?? null,
    lastOfficeDia: p.office?.dia ?? null,
    doctorNotes: p.notes,
    consentAt,
    summary: null,
  });
  return patient.id;
}

/** Replay sessions and a daily cron job in time order, exactly as production would have. */
async function replay(repo: Repo, sessions: readonly TimedSession[], now: Date): Promise<void> {
  const jobs = Array.from({ length: HISTORY_DAYS }, (_, i) => new Date(now.getTime() - (HISTORY_DAYS - i) * DAY));
  const timeline = [
    ...sessions.map((s) => ({ at: s.at, session: s })),
    ...jobs.map((at) => ({ at, session: null })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  for (const item of timeline) {
    const ctx: Ctx = { repo, now: item.at, demoMode: false };
    if (item.session) {
      const s = item.session;
      await ingestSession(ctx, { patientId: s.patientId, channel: s.channel, readings: s.readings, pillStatus: s.pill, symptoms: s.symptoms });
    } else {
      await runSilenceJob(ctx);
    }
  }
  await runSilenceJob({ repo, now, demoMode: false });
}

/**
 * Past alerts were handled by the doctor; the alert explaining each patient's
 * current level stays open. Red response times come from the seed events.
 */
async function simulateDoctorHandling(repo: Repo, now: Date, redDelays: Map<string, number[]>): Promise<void> {
  const ctx: Ctx = { repo, now, demoMode: false };
  const patients = await repo.listPatients();
  const current = new Set<string>();
  for (const p of patients) {
    const state = await loadPatientState(ctx, p);
    const c = alertCandidate(state.assessment.primary);
    if (c) current.add(`${p.id}|${c.level}|${c.evidence}`);
  }

  const alerts = [...(await repo.listAlerts(patients.map((p) => p.id)))].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );
  for (const [i, alert] of alerts.entries()) {
    if (alert.status === "CLOSED" || current.has(`${alert.patientId}|${alert.level}|${alert.evidence}`)) continue;
    const ackAt = new Date(alert.createdAt.getTime() + handlingDelayMs(alert, i, redDelays));
    if (ackAt <= now) await repo.updateAlert(alert.id, { status: "CLOSED", ackAt });
  }
}

function handlingDelayMs(alert: AlertRow, index: number, redDelays: Map<string, number[]>): number {
  if (!isRed(alert.level)) return NON_RED_ACK_HOURS[index % NON_RED_ACK_HOURS.length] * HOUR;
  const queue = redDelays.get(alert.patientId) ?? [];
  return (queue.shift() ?? DEFAULT_RED_ACK_MINUTES) * MINUTE;
}

/** Builds the whole demo (spec §12). Deterministic for a given `now`. */
export async function seedDemo(repo: Repo, now: Date): Promise<void> {
  for (const [situation, text] of Object.entries(ADVICE_FR)) {
    await repo.createAdvice({ situation, language: "FR", text, darijaExample: null, reviewedBy: null });
  }

  const doctorUser = await repo.createUser({
    role: "DOCTOR",
    phone: phone(DEMO_DOCTOR.phone),
    name: DEMO_DOCTOR.name,
    language: "FR",
    createdAt: new Date(now.getTime() - 365 * DAY),
  });
  const doctor = await repo.createDoctor({
    userId: doctorUser.id,
    inviteCode: DEMO_DOCTOR.inviteCode,
    backupContactPhone: phone(DEMO_DOCTOR.backupContactPhone),
    digestTime: DEMO_DOCTOR.digestTime,
  });

  const all = [...STORY_PATIENTS, ...stablePatients()];
  const ids = new Map<string, string>();
  const sessions: TimedSession[] = [];
  const redDelays = new Map<string, number[]>();
  for (const p of all) {
    const id = await createPatient(repo, doctor.id, p, now);
    ids.set(p.key, id);
    sessions.push(...p.events.flatMap((e) => expand(e, id, now)));
    const delays = p.events.filter((e) => e.ackAfterMinutes != null).sort((a, b) => b.d - a.d).map((e) => e.ackAfterMinutes as number);
    if (delays.length) redDelays.set(id, delays);
  }

  await replay(repo, sessions, now);
  await simulateDoctorHandling(repo, now, redDelays);

  for (const m of SEED_MESSAGES) {
    const patient = await repo.getPatient(ids.get(m.patientKey) ?? "");
    if (!patient) continue;
    const [fromUserId, toUserId] = m.fromDoctor ? [doctorUser.id, patient.userId] : [patient.userId, doctorUser.id];
    await repo.createMessage({ fromUserId, toUserId, body: m.body, createdAt: new Date(now.getTime() - m.d * DAY - m.h * HOUR) });
  }
}
