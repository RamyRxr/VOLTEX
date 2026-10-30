import { beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { readJson } from "@/lib/http";
import { allow } from "@/lib/rateLimit";
import { createMemoryRepo, emptyDb } from "@/lib/store/memory";
import { seedDemo } from "@/lib/store/seed";
import type { Repo } from "@/lib/store/types";
import { updateAlertStatus } from "../alerts";
import { registerPatient } from "../auth";
import { ServiceError, type Ctx, type Viewer } from "../context";
import { sendMessage } from "../messages";
import { getDoctorPatientView, getPatientSelfView } from "../patients";
import { handleSimulatedSms } from "../sms";

const NOW = new Date("2026-10-30T09:30:00Z");
let repo: Repo;
let ctx: Ctx;
let doctorA: Viewer;
let doctorB: Viewer;
let fatimaId: string;

const notFound = (p: Promise<unknown>) => expect(p).rejects.toSatisfy((e) => e instanceof ServiceError && e.code === "NOT_FOUND");

beforeAll(async () => {
  repo = createMemoryRepo(emptyDb());
  await seedDemo(repo, NOW);
  ctx = { repo, now: NOW, demoMode: true };
  const userA = await repo.findUserByPhone("+213550000000");
  const docA = userA ? await repo.getDoctorByUserId(userA.id) : null;
  const userB = await repo.createUser({ role: "DOCTOR", phone: "+213550000123", name: "Dr B", language: "FR", createdAt: NOW });
  const docB = await repo.createDoctor({ userId: userB.id, inviteCode: "OTHER1", backupContactPhone: null, digestTime: "08:00" });
  if (!userA || !docA) throw new Error("seed doctor missing");
  doctorA = { role: "DOCTOR", userId: userA.id, doctorId: docA.id };
  doctorB = { role: "DOCTOR", userId: userB.id, doctorId: docB.id };
  const fatimaUser = await repo.findUserByPhone("+213555000002");
  fatimaId = (fatimaUser && (await repo.getPatientByUserId(fatimaUser.id))?.id) || "";
});

describe("a doctor never sees another doctor's patients (CLAUDE.md §3)", () => {
  it("patient page, alerts and messages answer NOT_FOUND for doctor B", async () => {
    await expect(getDoctorPatientView(ctx, doctorA, fatimaId)).resolves.toBeTruthy();
    await notFound(getDoctorPatientView(ctx, doctorB, fatimaId));
    const alert = (await repo.listAlerts([fatimaId])).find((a) => a.status === "OPEN");
    await notFound(updateAlertStatus(ctx, doctorB, alert?.id ?? "", "CLOSED"));
    await notFound(sendMessage(ctx, doctorB, fatimaId, "Bonjour"));
  });

  it("the simulator only accepts the signed-in doctor's own patients", async () => {
    const out = await handleSimulatedSms(ctx, doctorB, { from: "0555000002", body: "TA 150 95" });
    expect(out).toMatchObject({ kind: "UNKNOWN", sessionId: null });
    const mine = await handleSimulatedSms(ctx, doctorA, { from: "0555000002", body: "bonjour" });
    expect(mine.kind).toBe("HELP");
  });

  it("a patient sees only themself", async () => {
    const ahmedUser = await repo.findUserByPhone("+213555000006");
    const ahmed = ahmedUser ? await repo.getPatientByUserId(ahmedUser.id) : null;
    const viewer: Viewer = { role: "PATIENT", userId: ahmedUser?.id ?? "", patientId: ahmed?.id ?? "" };
    await expect(getPatientSelfView(ctx, viewer)).resolves.toMatchObject({ firstName: "Ahmed" });
    await expect(getDoctorPatientView(ctx, viewer, fatimaId)).rejects.toBeInstanceOf(ServiceError);
    await notFound(sendMessage(ctx, viewer, fatimaId, "Bonjour"));
  });

  it("registration needs a known invite code", async () => {
    const base = { code: "1234", consent: true as const, name: "Test Patient", age: 50, sex: "F" as const, treatmentNames: [], emergencyContactPhone: null, language: "FR" as const };
    await notFound(registerPatient(ctx, { ...base, phone: "0555999001", inviteCode: "NOPE00" }));
    await expect(registerPatient(ctx, { ...base, phone: "0555999002", inviteCode: "demo01" })).resolves.toMatchObject({ role: "PATIENT" });
  });
});

describe("CSRF guard on JSON bodies", () => {
  const schema = z.object({ a: z.number() });
  const post = (headers: Record<string, string>) =>
    readJson(new Request("http://localhost/api/x", { method: "POST", headers, body: '{"a":1}' }), schema);

  it("accepts exactly application/json from the same origin", async () => {
    await expect(post({ "content-type": "application/json" })).resolves.toEqual({ a: 1 });
    await expect(post({ "content-type": "application/json; charset=utf-8", "sec-fetch-site": "same-origin" })).resolves.toEqual({ a: 1 });
  });

  it.each([
    ["text/plain;x=application/json"],
    ["multipart/form-data; boundary=application/json"],
    ["application/x-www-form-urlencoded"],
    ["text/plain"],
  ])("refuses %s", async (type) => {
    await expect(post({ "content-type": type })).rejects.toBeInstanceOf(ServiceError);
  });

  it("refuses cross-site and same-site browser requests", async () => {
    await expect(post({ "content-type": "application/json", "sec-fetch-site": "cross-site" })).rejects.toBeInstanceOf(ServiceError);
    await expect(post({ "content-type": "application/json", "sec-fetch-site": "same-site" })).rejects.toBeInstanceOf(ServiceError);
  });
});

describe("rate limiter", () => {
  it("allows up to max calls per window, then resets", () => {
    const t0 = 1_000_000;
    const results = Array.from({ length: 4 }, (_, i) => allow("test:key", 3, 60_000, t0 + i));
    expect(results).toEqual([true, true, true, false]);
    expect(allow("test:key", 3, 60_000, t0 + 60_001)).toBe(true);
  });
});
