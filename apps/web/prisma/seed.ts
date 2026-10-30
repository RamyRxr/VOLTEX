/**
 * Idempotent demo seed (spec §12): `pnpm --filter web db:seed`.
 * Creates the Supabase Auth accounts, then resets and refills each demo patient.
 * Statuses, risk and alerts come from the shared rules through the API pipeline.
 */
import { randomUUID } from "node:crypto";
import { estimateRisk, registerSession, type SessionRecord, type SessionUpdate } from "shared";
import { db } from "../src/server/db";
import { toRiskProfile } from "../src/server/mappers";
import { reassess } from "../src/server/pipeline";
import { supabaseAdmin } from "../src/server/supabase";
import { PLANS, type PatientPlan } from "./seed/plans";

/** Public demo password (spec §12): only for fictional @demo.dz accounts on a demo project. */
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "Demo1234!";
const DOCTOR = { email: "docteur@demo.dz", fullName: "Dr Karima Benali" };
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const ago = (now: Date, hours: number): Date => new Date(now.getTime() - hours * HOUR);
const midnight = (d: Date): Date => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

async function existingUsers(): Promise<Map<string, string>> {
  const { data, error } = await supabaseAdmin().auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  return new Map(data.users.flatMap((u) => (u.email ? [[u.email, u.id] as const] : [])));
}

/** Supabase Auth account; the demo password is set only when the account is created, never reset. */
async function ensureUser(users: Map<string, string>, email: string, fullName: string): Promise<string> {
  const known = users.get(email);
  if (known) return known;
  const { data, error } = await supabaseAdmin().auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { fullName },
  });
  if (error || !data.user) throw error ?? new Error(`createUser failed for ${email}`);
  return data.user.id;
}

async function ensureDoctor(users: Map<string, string>): Promise<string> {
  const id = await ensureUser(users, DOCTOR.email, DOCTOR.fullName);
  await db.profile.upsert({
    where: { id },
    create: { id, role: "DOCTOR", fullName: DOCTOR.fullName },
    update: { role: "DOCTOR", fullName: DOCTOR.fullName },
  });
  const doctor = await db.doctor.upsert({ where: { profileId: id }, create: { profileId: id }, update: {} });
  return doctor.id;
}

/** Delete everything a demo patient produced, so the seed can run again. */
async function resetPatient(patientId: string): Promise<void> {
  const links = await db.linkRequest.findMany({ where: { patientId }, select: { id: true } });
  await db.$transaction([
    db.message.deleteMany({ where: { linkId: { in: links.map((l) => l.id) } } }),
    db.linkRequest.deleteMany({ where: { patientId } }),
    db.alert.deleteMany({ where: { patientId } }),
    db.riskAssessment.deleteMany({ where: { patientId } }),
    db.questionnaire.deleteMany({ where: { patientId } }),
    db.bpSession.deleteMany({ where: { patientId } }),
    db.doctorNote.deleteMany({ where: { patientId } }),
  ]);
}

/** Readings in time order through registerSession, like the API would have stored them. */
function resolveReadings(plan: PatientPlan, now: Date) {
  const ordered = [...plan.readings].sort((a, b) => b.hoursAgo - a.hoursAgo);
  return ordered.reduce<{ records: SessionRecord[]; confirmedBy: Map<string, string> }>(
    (acc, r) => {
      const reading = { id: randomUUID(), sys: r.sys, dia: r.dia, takenAt: ago(now, r.hoursAgo) };
      const { status, updates } = registerSession(acc.records, reading);
      const byId = new Map(updates.map((u: SessionUpdate) => [u.id, u]));
      const records = [...acc.records.map((s) => (byId.has(s.id) ? { ...s, status: byId.get(s.id)!.status } : s)), { ...reading, status }];
      const confirmedBy = new Map(acc.confirmedBy);
      updates.forEach((u) => u.confirmedBySessionId && confirmedBy.set(u.id, u.confirmedBySessionId));
      return { records, confirmedBy };
    },
    { records: [], confirmedBy: new Map() },
  );
}

async function seedPatient(plan: PatientPlan, doctorId: string, users: Map<string, string>, now: Date): Promise<void> {
  const email = `${plan.key}@demo.dz`;
  const profileId = await ensureUser(users, email, plan.fullName);
  await db.profile.upsert({
    where: { id: profileId },
    create: { id: profileId, role: "PATIENT", fullName: plan.fullName },
    update: { role: "PATIENT", fullName: plan.fullName },
  });

  const consentAt = ago(now, plan.followUpDays * 24);
  const fields = {
    birthDate: midnight(new Date(now.getTime() - (plan.age * 365.25 + 100) * DAY)),
    lmpDate: midnight(new Date(now.getTime() - (plan.weeks * 7 + 2) * DAY)),
    dueDate: null,
    firstPregnancy: false,
    multiplePregnancy: false,
    chronicHypertension: false,
    previousPreeclampsia: false,
    preexistingDiabetes: false,
    gestationalDiabetes: false,
    kidneyDisease: false,
    autoimmuneDisease: false,
    familyPreeclampsia: false,
    familyHypertension: false,
    ivfPregnancy: false,
    ...plan.flags,
    heightCm: plan.heightCm,
    weightKg: plan.weightKg,
    treatments: plan.treatments ?? null,
    expectedSessionsPerDay: 2,
    consentAt,
    aiSummary: plan.aiSummary ?? null,
  };
  const patient = await db.patient.upsert({ where: { profileId }, create: { profileId, ...fields }, update: fields });
  await resetPatient(patient.id);

  await db.linkRequest.create({
    data: {
      patientId: patient.id,
      doctorId,
      status: plan.link,
      createdAt: consentAt,
      decidedAt: plan.link === "ACCEPTED" ? consentAt : null,
    },
  });

  const { records, confirmedBy } = resolveReadings(plan, now);
  await db.bpSession.createMany({
    data: records.map((s, i) => ({
      id: s.id,
      patientId: patient.id,
      sys: s.sys,
      dia: s.dia,
      pulse: plan.readings.length ? 80 + (i % 7) : null,
      takenAt: s.takenAt,
      status: s.status,
      confirmedBySessionId: confirmedBy.get(s.id) ?? null,
    })),
  });
  await db.questionnaire.createMany({
    data: plan.answers.map((a) => ({
      patientId: patient.id,
      answers: Object.fromEntries(a.yes.map((item) => [item, true])),
      answeredAt: ago(now, a.hoursAgo),
    })),
  });

  // Risk timeline: the profile estimate when the follow-up started.
  const initial = estimateRisk(toRiskProfile(patient), { sessions: [], questionnaires: [] }, consentAt);
  await db.riskAssessment.create({
    data: { patientId: patient.id, category: initial.category, factors: initial.factors.map((f) => ({ ...f })), trigger: "PROFILE", createdAt: consentAt },
  });
  if (plan.note) await db.doctorNote.create({ data: { patientId: patient.id, doctorId, body: plan.note, createdAt: ago(now, 48) } });
  if (plan.link !== "ACCEPTED" || records.length === 0) return;

  // Same path as the API after a new reading: expire, assess, alert.
  const { result, risk } = await reassess(patient.id, "SESSION", now);
  console.log(`  ${plan.key.padEnd(8)} level=${result.level.padEnd(9)} risk=${risk.category}${result.unconfirmedSevere ? " +unconfirmed severe" : ""}`);
}

/** The seed deletes demo patients' data and creates accounts with a public password: never by accident. */
function assertDemoTarget(): void {
  if (process.env.ALLOW_DEMO_SEED !== "true" || process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed: set ALLOW_DEMO_SEED=true (demo project only, never with NODE_ENV=production)");
  }
}

async function main(): Promise<void> {
  assertDemoTarget();
  const now = new Date();
  const users = await existingUsers();
  const doctorId = await ensureDoctor(users);
  console.log(`Doctor ready: ${DOCTOR.email}`);
  for (const plan of PLANS) await seedPatient(plan, doctorId, users, now);
  console.log(`Seeded ${PLANS.length} patients (password for every demo account: ${DEMO_PASSWORD}).`);
}

main()
  .catch((error: unknown) => {
    console.error("Seed failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
