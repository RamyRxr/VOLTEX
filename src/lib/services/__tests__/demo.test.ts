import { beforeAll, describe, expect, it } from "vitest";
import { normalizePhone } from "@/lib/domain/phone";
import { createMemoryRepo, emptyDb } from "@/lib/store/memory";
import { seedDemo } from "@/lib/store/seed";
import type { Repo } from "@/lib/store/types";
import { updateAlertStatus } from "../alerts";
import type { Ctx, Viewer } from "../context";
import { getIndicators } from "../indicators";
import { ingestSession } from "../ingest";
import { getThread, sendMessage } from "../messages";
import { getDoctorPatientView } from "../patients";
import { handleInboundSms } from "../sms";
import { getTriage } from "../triage";
import type { TriageDto, TriageRowDto } from "../views";

const SEEDED_AT = new Date("2026-10-30T09:30:00Z");
let repo: Repo;
let doctor: Viewer;

const ctxAt = (offsetSeconds: number, demoMode = true): Ctx => ({
  repo,
  now: new Date(SEEDED_AT.getTime() + offsetSeconds * 1000),
  demoMode,
});

const rowOf = (triage: TriageDto, name: string): TriageRowDto => {
  const row = triage.rows.find((r) => r.name === name);
  if (!row) throw new Error(`No row for ${name}`);
  return row;
};

async function patientIdOf(rawPhone: string): Promise<string> {
  const user = await repo.findUserByPhone(normalizePhone(rawPhone) as string);
  const patient = user ? await repo.getPatientByUserId(user.id) : null;
  if (!patient) throw new Error(`No patient ${rawPhone}`);
  return patient.id;
}

beforeAll(async () => {
  repo = createMemoryRepo(emptyDb());
  await seedDemo(repo, SEEDED_AT);
  const user = await repo.findUserByPhone("+213550000000");
  const doc = user ? await repo.getDoctorByUserId(user.id) : null;
  if (!user || !doc) throw new Error("Demo doctor missing");
  doctor = { role: "DOCTOR", userId: user.id, doctorId: doc.id };
});

describe("seeded demo (CLAUDE.md §12) — produced by the rules", () => {
  it("30 patients sorted by risk", async () => {
    const triage = await getTriage(ctxAt(0), (doctor as { doctorId: string }).doctorId);
    expect(triage.rows).toHaveLength(30);
    expect(triage.rows.slice(0, 4).map((r) => [r.name, r.group])).toEqual([
      ["Fatima Boudiaf", "ORANGE"],
      ["Mohamed Cherif", "YELLOW"],
      ["Nadia Bensalem", "UNCONFIRMED"],
      ["Zohra Meziane", "SILENT"],
    ]);
    expect(triage.rows.slice(4).every((r) => r.group === "GREEN")).toBe(true);
    expect(triage.openRedAlerts).toHaveLength(0);
  });

  it("Fatima: ORANGE (2 of 3) + missed-pill line", async () => {
    const triage = await getTriage(ctxAt(0), "");
    expect(triage.rows).toHaveLength(0); // another doctor sees nobody
    const view = await getDoctorPatientView(ctxAt(0), doctor, await patientIdOf("0555000002"));
    expect(view.level).toBe("ORANGE");
    expect(view.reason).toBe("2 des 3 dernières mesures ≥ 160/100 (162/101, 166/102)");
    const pill = view.info.find((i) => i.id === "missedPill");
    expect(pill?.emphasis).toBe(true);
    expect(pill?.text).toMatch(/^\+\d+ mmHg les jours sans médicament/);
  });

  it("Mohamed: YELLOW trend", async () => {
    const row = rowOf(await getTriage(ctxAt(0), (doctor as { doctorId: string }).doctorId), "Mohamed Cherif");
    expect(row.level).toBe("YELLOW");
    expect(row.reason).toMatch(/^Systolique en hausse de \+\d,\d mmHg\/semaine ; cible probablement dépassée dans ~\d+ jours$/);
    expect(row.trend?.direction).toBe("up");
  });

  it("Karim: GREEN + white-coat line", async () => {
    const view = await getDoctorPatientView(ctxAt(0), doctor, await patientIdOf("0555000004"));
    expect(view.level).toBe("GREEN");
    expect(view.info.find((i) => i.id === "office")?.text).toBe(
      "Domicile 131/83 contre cabinet 148/92 : possible effet blouse blanche",
    );
  });

  it("Zohra: GREY_SILENT after 9 days (threshold 7)", async () => {
    const row = rowOf(await getTriage(ctxAt(0), (doctor as { doctorId: string }).doctorId), "Zohra Meziane");
    expect(row.level).toBe("GREY_SILENT");
    expect(row.reason).toBe("Silencieux : aucune mesure depuis 9 jours (seuil 7)");
  });

  it("Ahmed: GREEN before the demo", async () => {
    const row = rowOf(await getTriage(ctxAt(0), (doctor as { doctorId: string }).doctorId), "Ahmed Saidi");
    expect(row.level).toBe("GREEN");
    expect(row.reason).toBe("Moyenne 7 jours 132/84, dans la cible 135/85");
  });

  it("Nadia: unconfirmed 195/125 visible to the doctor, never red", async () => {
    const row = rowOf(await getTriage(ctxAt(0), (doctor as { doctorId: string }).doctorId), "Nadia Bensalem");
    expect(row.level).toBe("GREEN");
    expect(row.reason).toBe("Non confirmé 195/125, le patient n'a pas remesuré");
  });

  it("stable patients are GREEN with no flag line", async () => {
    const triage = await getTriage(ctxAt(0), (doctor as { doctorId: string }).doctorId);
    const story = new Set(["Fatima Boudiaf", "Mohamed Cherif", "Karim Haddad", "Zohra Meziane", "Ahmed Saidi", "Nadia Bensalem"]);
    const stable = triage.rows.filter((r) => !story.has(r.name));
    expect(stable).toHaveLength(24);
    for (const row of stable) {
      const view = await getDoctorPatientView(ctxAt(0), doctor, row.patientId);
      expect(view.level, row.name).toBe("GREEN");
      expect(view.info.filter((i) => i.emphasis), row.name).toEqual([]);
    }
  });

  it("indicators are computed from the data", async () => {
    const ind = await getIndicators(ctxAt(0), doctor, 8);
    expect(ind.patients).toBe(30);
    expect(ind.response).toMatchObject({ value: 6, count: 4 });
    expect(ind.frequency.value).toBeGreaterThan(2);
    expect(ind.control.value).toBeGreaterThan(0.8);
    expect(ind.regularity.silentNow).toBe(1);
  });
});

describe("the stage loop (CLAUDE.md §14), demo mode", () => {
  it("Ahmed 182/118 → re-measure → confirmed crisis → red row → acknowledge → message", async () => {
    const ahmed = await patientIdOf("0555000006");
    const twice = (sys: number, dia: number) => [
      { sys, dia, pulse: 84 },
      { sys, dia, pulse: 86 },
    ];

    const first = await ingestSession(ctxAt(60), { patientId: ahmed, channel: "WEB", readings: twice(182, 118), pillStatus: "TAKEN", symptoms: [] });
    expect(first.evaluation.outcome).toBe("REMEASURE");
    const waiting = rowOf(await getTriage(ctxAt(61), (doctor as { doctorId: string }).doctorId), "Ahmed Saidi");
    expect(waiting.group).toBe("UNCONFIRMED");
    expect(waiting.reason).toBe("En attente de confirmation : 182/118");

    const second = await ingestSession(ctxAt(80), { patientId: ahmed, channel: "WEB", readings: twice(182, 118), pillStatus: "TAKEN", symptoms: [] });
    expect(second.evaluation.resolved?.status).toBe("CONFIRMED");
    expect(second.status.word).toBe("URGENT");

    const triage = await getTriage(ctxAt(81), (doctor as { doctorId: string }).doctorId);
    expect(triage.rows[0]).toMatchObject({ name: "Ahmed Saidi", level: "RED_CRISIS", reason: "Confirmé 182/118, niveau crise" });
    expect(triage.openRedAlerts.map((a) => a.reason)).toEqual(["Confirmé 182/118, niveau crise"]);

    const alertId = triage.openRedAlerts[0].id;
    const acked = await updateAlertStatus(ctxAt(120), doctor, alertId, "ACKNOWLEDGED");
    expect(acked.status).toBe("ACKNOWLEDGED");
    const after = await getTriage(ctxAt(121), (doctor as { doctorId: string }).doctorId);
    expect(after.rows[0]).toMatchObject({ name: "Ahmed Saidi", level: "RED_CRISIS" });
    expect(after.openRedAlerts).toHaveLength(0);

    await sendMessage(ctxAt(130), doctor, ahmed, "Venez au cabinet aujourd'hui.");
    const user = await repo.getPatient(ahmed);
    const patientViewer: Viewer = { role: "PATIENT", userId: user?.userId ?? "", patientId: ahmed };
    const thread = await getThread(ctxAt(131), patientViewer, ahmed);
    expect(thread.at(-1)).toMatchObject({ from: "DOCTOR", body: "Venez au cabinet aujourd'hui." });
  });

  it("a basic phone sends TA 165 100 78 MP: stored, echoed, asked to re-measure", async () => {
    const out = await handleInboundSms(ctxAt(200), { from: "+213555000005", body: "TA 165 100 78 MP" });
    expect(out.reply).toBe("Tension élevée (165/100). Reposez-vous 5 minutes et renvoyez une mesure.");
    expect(out.reply).not.toContain("Zohra");
    const row = rowOf(await getTriage(ctxAt(201), (doctor as { doctorId: string }).doctorId), "Zohra Meziane");
    expect(row.last).toMatchObject({ sys: 165, dia: 100, status: "PENDING", channel: "SMS" });
    expect(row.silent).toBeNull();
  });

  it("a danger code by SMS answers 'Appelez le 14' and puts the patient on top", async () => {
    const out = await handleInboundSms(ctxAt(300), { from: "0555000004", body: "ta 150 95 cp" });
    expect(out.reply.startsWith("Appelez le 14 maintenant.")).toBe(true);
    const triage = await getTriage(ctxAt(301), (doctor as { doctorId: string }).doctorId);
    expect(triage.rows[0]).toMatchObject({ name: "Karim Haddad", level: "RED_EMERGENCY" });
  });

  it("unknown numbers and gibberish store nothing clinical and never throw", async () => {
    const unknown = await handleInboundSms(ctxAt(400), { from: "0699999999", body: "TA 140 90" });
    expect(unknown).toMatchObject({ kind: "UNKNOWN", sessionId: null });
    const help = await handleInboundSms(ctxAt(401), { from: "0555000003", body: "bonjour" });
    expect(help).toMatchObject({ kind: "HELP", sessionId: null });
  });
});
