import { describe, expect, it } from "vitest";
import type { BpSession, PatientProfile } from "../../types";
import { estimateRisk, evaluateQuestionnaire, evaluateSession } from "../engine";

const now = new Date(2026, 9, 30, 12, 0);
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000).toISOString();

const session = (sys: number, dia: number, status: BpSession["status"], at: string, id = `${sys}-${at}`): BpSession => ({
  id,
  sys,
  dia,
  pulse: null,
  takenAt: at,
  source: "MANUAL",
  status,
});

const profile = (overrides: Partial<PatientProfile> = {}): PatientProfile => ({
  id: "p",
  birthDate: "1997-03-14",
  dueDate: "2027-01-01",
  lmpDate: null,
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
  heightCm: 165,
  weightKg: 65,
  treatments: null,
  phone: null,
  consentAt: now.toISOString(),
  expectedSessionsPerDay: 2,
  ...overrides,
});

describe("demo engine — sessions", () => {
  it("asks to re-measure a first severe reading, with the demo delay", () => {
    const out = evaluateSession([], [], { sys: 165, dia: 112 }, now, true);
    expect(out.status).toBe("SEVERE_PENDING");
    expect(out.evaluation.action).toBe("REMEASURE");
    expect(out.evaluation.remeasureInSeconds).toBe(10);
  });

  it("confirms a severe reading measured again within the window", () => {
    const pending = session(165, 112, "SEVERE_PENDING", minutesAgo(15), "pending");
    const out = evaluateSession([pending], [], { sys: 168, dia: 111 }, now, false);
    expect(out.evaluation.level).toBe("SEVERE");
    expect(out.evaluation.action).toBe("CALL_EMERGENCY");
    expect(out.resolved).toEqual({ id: "pending", status: "SEVERE_CONFIRMED" });
  });

  it("marks the pending reading not confirmed when the second one is lower", () => {
    const pending = session(165, 112, "SEVERE_PENDING", minutesAgo(15), "pending");
    const out = evaluateSession([pending], [], { sys: 128, dia: 82 }, now, false);
    expect(out.resolved?.status).toBe("SEVERE_NOT_CONFIRMED");
    expect(out.evaluation.level).toBe("OK");
  });

  it("raises HIGH when 2 of the last 3 sessions are at or above 140/90", () => {
    const prev = [session(120, 80, "NORMAL", minutesAgo(600)), session(142, 92, "HYPERTENSIVE", minutesAgo(300))];
    expect(evaluateSession(prev, [], { sys: 145, dia: 88 }, now, false).evaluation.level).toBe("HIGH");
  });
});

describe("demo engine — questionnaire", () => {
  it("any danger item is an emergency, whatever the BP", () => {
    const out = evaluateQuestionnaire([], [], { VISION_PROBLEMS: true }, now);
    expect(out.level).toBe("EMERGENCY");
    expect(out.action).toBe("CALL_EMERGENCY");
  });

  it("a watch item gives WATCH", () => {
    expect(evaluateQuestionnaire([], [], { SWELLING_LEGS: true }, now).level).toBe("WATCH");
  });
});

describe("demo engine — risk", () => {
  it("is LOW without factors and lists none", () => {
    const risk = estimateRisk(profile(), [], [], "PROFILE", now);
    expect(risk.category).toBe("LOW");
    expect(risk.factors).toEqual([]);
  });

  it("one moderate factor gives MODERATE, two give HIGH", () => {
    expect(estimateRisk(profile({ firstPregnancy: true }), [], [], "PROFILE", now).category).toBe("MODERATE");
    expect(estimateRisk(profile({ firstPregnancy: true, ivfPregnancy: true }), [], [], "PROFILE", now).category).toBe("HIGH");
  });

  it("one high-weight factor gives HIGH with its label", () => {
    const risk = estimateRisk(profile({ previousPreeclampsia: true }), [], [], "PROFILE", now);
    expect(risk.category).toBe("HIGH");
    expect(risk.factors.map((f) => f.code)).toContain("PREVIOUS_PREECLAMPSIA");
  });
});
