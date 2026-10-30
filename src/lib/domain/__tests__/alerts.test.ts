import { describe, expect, it } from "vitest";
import { alertCandidate, planAlert, silenceAlertsToClose, type ExistingAlert } from "../alerts";
import { computeIndicators, median } from "../indicators";
import { assessPatient } from "../levels";
import { DAY, NOW, WINDOW, profile, session } from "./helpers";

const alert = (overrides: Partial<ExistingAlert>): ExistingAlert => ({
  id: "a1",
  level: "RED_CRISIS",
  evidence: "CONFIRMED_SESSION",
  sessionId: "s1",
  status: "OPEN",
  ...overrides,
});

describe("alert de-duplication (CLAUDE.md §6.7)", () => {
  const crisis = { level: "RED_CRISIS", evidence: "CONFIRMED_SESSION", sessionId: "s1" } as const;

  it("creates the first alert", () => {
    expect(planAlert(crisis, [])).toEqual({ action: "create" });
  });

  it("updates the open alert instead of stacking a new one", () => {
    expect(planAlert({ ...crisis, sessionId: "s2" }, [alert({})])).toEqual({ action: "update", alertId: "a1" });
  });

  it("a new triggering session after acknowledgement is a new event", () => {
    expect(planAlert({ ...crisis, sessionId: "s2" }, [alert({ status: "ACKNOWLEDGED" })])).toEqual({ action: "create" });
    expect(planAlert(crisis, [alert({ status: "ACKNOWLEDGED" })])).toEqual({ action: "update", alertId: "a1" });
  });

  it("closed alerts never block a new one", () => {
    expect(planAlert(crisis, [alert({ status: "CLOSED" })])).toEqual({ action: "create" });
  });

  it("computed evidence carries no session", () => {
    expect(alertCandidate({ kind: "TREND", level: "YELLOW", perWeek: 2, daysToTarget: 9 })).toEqual({
      level: "YELLOW",
      evidence: "TREND",
      sessionId: null,
    });
  });

  it("closes silence alerts once the patient measures again", () => {
    const a = assessPatient({ patient: profile(), sessions: [session()], now: NOW, windowMs: WINDOW });
    const silence = alert({ id: "z", level: "GREY_SILENT", evidence: "SILENCE", sessionId: null });
    expect(silenceAlertsToClose([silence], a)).toEqual(["z"]);
  });
});

describe("indicators (CLAUDE.md §8)", () => {
  it("median of an even list", () => {
    expect(median([4, 10, 6, 8])).toBe(7);
    expect(median([])).toBeNull();
  });

  it("computes frequency, control and response time from data", () => {
    const p = profile({ expectedReadingsPerWeek: 2 });
    const patients = [
      { profile: p, sessions: [1, 3, 8, 10].map((d) => session({ daysAgo: d })) },
      { profile: p, sessions: [2, 9].map((d) => session({ daysAgo: d, avgSys: 150, avgDia: 95, status: "CONFIRMED" })) },
    ];
    const alerts = [
      { level: "RED_CRISIS" as const, createdAt: new Date(NOW.getTime() - 3 * DAY), ackAt: new Date(NOW.getTime() - 3 * DAY + 6 * 60_000) },
      { level: "RED_EMERGENCY" as const, createdAt: new Date(NOW.getTime() - 2 * DAY), ackAt: new Date(NOW.getTime() - 2 * DAY + 4 * 60_000) },
      { level: "YELLOW" as const, createdAt: new Date(NOW.getTime() - 2 * DAY), ackAt: null },
    ];
    const ind = computeIndicators({ patients, alerts, to: NOW, weeks: 2, windowMs: WINDOW });

    expect(ind.frequency.value).toBe(1.5);
    expect(ind.control).toMatchObject({ value: 0.5, evaluated: 2 });
    expect(ind.response).toMatchObject({ value: 5, count: 2 });
    expect(ind.alerts.byLevel).toMatchObject({ RED_CRISIS: 1, RED_EMERGENCY: 1, YELLOW: 1 });
    expect(ind.regularity.silentNow).toBe(0);
    expect(ind.evolution.series).toHaveLength(2);
  });
});
