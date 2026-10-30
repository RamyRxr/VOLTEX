import { describe, expect, it } from "vitest";
import { evaluateSession, type NewSessionInput } from "../evaluate";
import { averageReadings, episodes, resolveConfirmation, staleSessionIds } from "../session";
import { isAbove, isBelowLow, patientTarget, reachesTier, tierOf } from "../thresholds";
import { MINUTE, NOW, WINDOW, confirmedPair, profile, session } from "./helpers";

const web = (sys: number, dia: number, extra: Partial<NewSessionInput> = {}): NewSessionInput => ({
  channel: "WEB",
  readings: [
    { sys, dia, pulse: 76 },
    { sys, dia, pulse: 78 },
  ],
  pillStatus: "TAKEN",
  symptoms: [],
  ...extra,
});

const run = (input: NewSessionInput, history = [] as ReturnType<typeof session>[], p = profile()) =>
  evaluateSession({ input, history, patient: p, now: NOW, windowMs: WINDOW });

describe("thresholds", () => {
  it("is above when systolic OR diastolic reaches the threshold", () => {
    expect(isAbove({ sys: 135, dia: 70 }, { sys: 135, dia: 85 })).toBe(true);
    expect(isAbove({ sys: 120, dia: 85 }, { sys: 135, dia: 85 })).toBe(true);
    expect(isAbove({ sys: 134, dia: 84 }, { sys: 135, dia: 85 })).toBe(false);
  });

  it("is below low when systolic OR diastolic is under 90/60", () => {
    expect(isBelowLow({ sys: 89, dia: 70 })).toBe(true);
    expect(isBelowLow({ sys: 100, dia: 59 })).toBe(true);
    expect(isBelowLow({ sys: 90, dia: 60 })).toBe(false);
  });

  it("uses the patient's own target, else the default", () => {
    expect(patientTarget({ targetSys: null, targetDia: null })).toEqual({ sys: 135, dia: 85 });
    expect(patientTarget({ targetSys: 130, targetDia: 80 })).toEqual({ sys: 130, dia: 80 });
  });

  it("ranks tiers and only confirms at the same tier or higher", () => {
    const target = { sys: 135, dia: 85 };
    expect(tierOf({ sys: 182, dia: 110 }, target)).toBe("CRISIS");
    expect(tierOf({ sys: 150, dia: 100 }, target)).toBe("HIGH");
    expect(tierOf({ sys: 140, dia: 80 }, target)).toBe("ABOVE_TARGET");
    expect(tierOf({ sys: 85, dia: 55 }, target)).toBe("LOW");
    expect(reachesTier("HIGH", "CRISIS")).toBe(true);
    expect(reachesTier("CRISIS", "HIGH")).toBe(false);
    expect(reachesTier("LOW", "LOW")).toBe(true);
    expect(reachesTier("LOW", "ABOVE_TARGET")).toBe(false);
  });
});

describe("sessions", () => {
  it("averages the two web readings, rounded", () => {
    const avg = averageReadings([
      { sys: 182, dia: 118, pulse: 84 },
      { sys: 181, dia: 116, pulse: 86 },
    ]);
    expect(avg).toEqual({ avgSys: 182, avgDia: 117, avgPulse: 85 });
  });

  it("an SMS session's average is its single reading", () => {
    expect(averageReadings([{ sys: 165, dia: 100, pulse: null }])).toEqual({ avgSys: 165, avgDia: 100, avgPulse: null });
  });

  it("a crisis value reached on the re-measure asks for its own confirmation", () => {
    const out = resolveConfirmation({ sys: 183, dia: 119 }, { avgSys: 165, avgDia: 100 }, { sys: 135, dia: 85 });
    expect(out).toEqual({ pendingStatus: "CONFIRMED", newStatus: "PENDING" });
  });

  it("expires PENDING sessions older than the window", () => {
    const old = session({ status: "PENDING", minutesAgo: 121 });
    const fresh = session({ status: "PENDING", minutesAgo: 30 });
    expect(staleSessionIds([old, fresh], NOW, WINDOW)).toEqual([old.id]);
  });

  it("folds a confirmed pair into one episode", () => {
    const pair = confirmedPair(1, { sys: 162, dia: 101 });
    const eps = episodes([session({ daysAgo: 3 }), ...pair]);
    expect(eps).toHaveLength(2);
    expect(eps[1].id).toBe(pair[0].id);
  });
});

describe("evaluateSession — order of CLAUDE.md §6.3", () => {
  it("1. a danger symptom wins over any reading and skips confirmation", () => {
    const pending = session({ status: "PENDING", avgSys: 170, avgDia: 100, minutesAgo: 5 });
    const out = run(web(128, 79, { symptoms: ["CHEST_PAIN"] }), [pending]);
    expect(out).toMatchObject({ status: "DANGER", outcome: "CALL_14", resolved: null });
  });

  it("3. a high reading without danger becomes PENDING and asks to re-measure", () => {
    expect(run(web(182, 118))).toMatchObject({ status: "PENDING", outcome: "REMEASURE", resolved: null });
  });

  it("3. a low reading also needs confirmation", () => {
    expect(run(web(85, 55))).toMatchObject({ status: "PENDING", outcome: "REMEASURE" });
  });

  it("a reading within target is NORMAL", () => {
    expect(run(web(128, 80))).toMatchObject({ status: "NORMAL", outcome: "RECORDED" });
  });

  it("2. a second high session in the window confirms the first", () => {
    const pending = session({ status: "PENDING", avgSys: 182, avgDia: 118, minutesAgo: 6 });
    const out = run(web(182, 118), [pending]);
    expect(out).toMatchObject({ status: "CONFIRMED", outcome: "RECORDED", resolved: { sessionId: pending.id, status: "CONFIRMED" } });
  });

  it("2. a lower second session leaves the first NOT_CONFIRMED", () => {
    const pending = session({ status: "PENDING", avgSys: 195, avgDia: 125, minutesAgo: 6 });
    const out = run(web(150, 92), [pending]);
    expect(out.resolved).toEqual({ sessionId: pending.id, status: "NOT_CONFIRMED" });
    expect(out.status).toBe("CONFIRMED");
  });

  it("2. a normal second session is stored NORMAL", () => {
    const pending = session({ status: "PENDING", avgSys: 150, avgDia: 92, minutesAgo: 6 });
    expect(run(web(128, 80), [pending])).toMatchObject({ status: "NORMAL", resolved: { status: "NOT_CONFIRMED" } });
  });

  it("confirmation is channel-agnostic: a web session confirms an SMS session", () => {
    const sms = session({ channel: "SMS", status: "PENDING", avgSys: 165, avgDia: 100, minutesAgo: 8 });
    expect(run(web(166, 101), [sms]).resolved?.status).toBe("CONFIRMED");
  });

  it("a pending session outside the window is not matched", () => {
    const old = session({ status: "PENDING", avgSys: 165, avgDia: 100, minutesAgo: 121 });
    expect(run(web(166, 101), [old])).toMatchObject({ status: "PENDING", resolved: null });
  });

  it("respects a personal target set by the doctor", () => {
    const strict = profile({ targetSys: 130, targetDia: 80 });
    expect(run(web(132, 78), [], strict).status).toBe("PENDING");
    expect(run(web(132, 78)).status).toBe("NORMAL");
  });

  it("a re-measure that jumps to crisis asks for one more measure", () => {
    const pending = session({ status: "PENDING", avgSys: 165, avgDia: 100, minutesAgo: 6 });
    expect(run(web(183, 119), [pending])).toMatchObject({
      status: "PENDING",
      outcome: "REMEASURE",
      resolved: { status: "CONFIRMED" },
    });
  });

  it("an earlier re-send never confirms itself (minimum gap, review finding)", () => {
    const pending = session({ status: "PENDING", avgSys: 185, avgDia: 122, minutesAgo: 0.03 });
    const out = evaluateSession({ input: web(185, 122), history: [pending], patient: profile(), now: NOW, windowMs: WINDOW, minGapMs: 60_000 });
    expect(out).toMatchObject({ status: "PENDING", resolved: null });
  });

  it("uses the window it is given (demo mode shortens it)", () => {
    const pending = session({ status: "PENDING", avgSys: 165, avgDia: 100, minutesAgo: 6 });
    const out = evaluateSession({ input: web(166, 101), history: [pending], patient: profile(), now: NOW, windowMs: 5 * MINUTE });
    expect(out.resolved).toBeNull();
  });
});
