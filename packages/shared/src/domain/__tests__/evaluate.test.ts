import { describe, expect, it } from "vitest";
import { evaluate, type EvaluateInput } from "../evaluate";
import { BASE_PROFILE, daysAgo, hoursAgo, minutesAgo, NOW, questionnaire, session, stableSessions } from "./fixtures";
import { estimateRisk } from "../risk";

const input = (over: Partial<EvaluateInput>): EvaluateInput => ({
  sessions: stableSessions(3),
  questionnaires: [],
  expectedSessionsPerDay: 2,
  followUpStart: daysAgo(30),
  ...over,
});

describe("evaluate — fixed order (spec §6.4)", () => {
  it("OK with recent normal sessions", () => {
    const r = evaluate(input({}), NOW);
    expect(r.level).toBe("OK");
    expect(r.findings).toEqual([]);
  });

  it("a danger item is EMERGENCY and stops, whatever the BP", () => {
    const sessions = [session(170, 115, minutesAgo(5), "SEVERE_CONFIRMED"), ...stableSessions(2)];
    const r = evaluate(input({ sessions, questionnaires: [questionnaire(["VISION_PROBLEMS"], minutesAgo(1))] }), NOW);
    expect(r.level).toBe("EMERGENCY");
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0]).toMatchObject({ evidence: "DANGER_ITEM", reason: "Signe de danger déclaré : troubles de la vue" });
  });

  it("a danger answer older than the acute window no longer counts", () => {
    const r = evaluate(input({ questionnaires: [questionnaire(["VISION_PROBLEMS"], hoursAgo(25))] }), NOW);
    expect(r.level).toBe("OK");
  });

  it("a confirmed severe reading is SEVERE", () => {
    const sessions = [
      session(162, 111, minutesAgo(5), "SEVERE_CONFIRMED"),
      session(165, 112, minutesAgo(20), "SEVERE_CONFIRMED"),
      ...stableSessions(2),
    ];
    const r = evaluate(input({ sessions }), NOW);
    expect(r.level).toBe("SEVERE");
    expect(r.findings[0]?.reason).toBe("Tension sévère confirmée : 165/112 puis 162/111");
  });

  it("an unconfirmed severe reading is flagged but is not a level by itself", () => {
    const pending = session(165, 112, minutesAgo(90), "SEVERE_EXPIRED");
    const r = evaluate(input({ sessions: [pending, ...stableSessions(2)] }), NOW);
    expect(r.unconfirmedSevere?.id).toBe(pending.id);
    expect(r.level).toBe("OK");
  });

  it("2 of the last 3 valid sessions ≥ 140/90 is HIGH", () => {
    const sessions = [session(146, 94, hoursAgo(1)), session(144, 91, hoursAgo(13)), ...stableSessions(2)];
    const r = evaluate(input({ sessions }), NOW);
    expect(r.level).toBe("HIGH");
    expect(r.findings.map((f) => f.evidence)).toContain("TWO_OF_THREE");
  });

  it("a rising systolic trend is WATCH", () => {
    const sessions = Array.from({ length: 10 }, (_, i) => session(112 + (9 - i) * 2.5, 76, hoursAgo(2 + i * 30)));
    const r = evaluate(input({ sessions }), NOW);
    expect(r.level).toBe("WATCH");
    expect(r.findings.map((f) => f.evidence)).toEqual(["TREND"]);
  });

  it("a watch item in the last 7 days is WATCH", () => {
    const r = evaluate(input({ questionnaires: [questionnaire(["UNUSUAL_FATIGUE"], daysAgo(1))] }), NOW);
    expect(r.level).toBe("WATCH");
    expect(r.findings[0]?.reason).toBe("Symptôme à surveiller : fatigue inhabituelle");
  });

  it("a risk category above the initial one is WATCH", () => {
    const qs = [questionnaire(["SWELLING_LEGS"], daysAgo(2))];
    const risk = estimateRisk(BASE_PROFILE, { sessions: [], questionnaires: qs }, NOW);
    const r = evaluate(input({ risk }), NOW);
    expect(r.findings.map((f) => f.evidence)).toEqual(["RISK_INCREASED"]);
    expect(r.findings[0]?.reason).toBe("Risque augmenté : faible → modéré");
  });

  it("no session for 2× the expected interval is SILENT", () => {
    const sessions = [session(120, 78, daysAgo(3))];
    const r = evaluate(input({ sessions }), NOW);
    expect(r.level).toBe("SILENT");
    expect(r.silent).toBe(true);
  });

  it("SILENT stays a tag when a more severe level applies", () => {
    const sessions = [session(146, 94, daysAgo(2)), session(144, 91, daysAgo(2.5)), session(120, 80, daysAgo(3))];
    const r = evaluate(input({ sessions }), NOW);
    expect(r.level).toBe("HIGH");
    expect(r.silent).toBe(true);
  });

  it("a patient who never measured is silent from the start of the follow-up", () => {
    const r = evaluate(input({ sessions: [], followUpStart: daysAgo(2) }), NOW);
    expect(r.level).toBe("SILENT");
    expect(r.findings[0]?.reason).toContain("depuis le début du suivi");
  });
});
