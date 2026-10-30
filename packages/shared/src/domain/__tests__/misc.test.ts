import { describe, expect, it } from "vitest";
import { generateInviteCode, INVITE_CODE_PATTERN, inviteExpiresAt, isInviteUsable } from "../invite";
import { patientEvaluation, remeasureSeconds } from "../messages";
import { ageOn, bmiOf, pregnancyWeek } from "../pregnancy";
import { computeSilence, silenceThresholdHours } from "../silence";
import { computeTrend, slope } from "../trend";
import { triageSort, type TriageItem } from "../triage";
import { daysAgo, hoursAgo, NOW, session } from "./fixtures";

describe("pregnancy dates", () => {
  it("week from the last menstrual period", () => {
    expect(pregnancyWeek({ lmpDate: new Date(NOW.getTime() - (31 * 7 + 4) * 86_400_000) }, NOW)).toEqual({ weeks: 31, days: 4 });
  });

  it("week from the due date (LMP + 280 days)", () => {
    const due = new Date(NOW.getTime() + 9 * 7 * 86_400_000);
    expect(pregnancyWeek({ dueDate: due }, NOW)).toEqual({ weeks: 31, days: 0 });
  });

  it("null without dates", () => {
    expect(pregnancyWeek({}, NOW)).toBeNull();
  });

  it("age and BMI", () => {
    expect(ageOn(new Date("1997-10-31T00:00:00Z"), NOW)).toBe(28);
    expect(ageOn(new Date("1997-10-30T00:00:00Z"), NOW)).toBe(29);
    expect(bmiOf(160, 64)).toBeCloseTo(25);
    expect(bmiOf(null, 64)).toBeNull();
  });
});

describe("trend and silence", () => {
  it("slope of a straight line", () => {
    expect(slope([{ x: 0, y: 1 }, { x: 1, y: 3 }, { x: 2, y: 5 }])).toBe(2);
  });

  it("needs at least 5 valid sessions in 14 days", () => {
    expect(computeTrend([session(120, 80, daysAgo(1)), session(130, 80, daysAgo(2))], NOW)).toBeNull();
  });

  it("threshold is 2 × 24 h / sessions per day", () => {
    expect(silenceThresholdHours(2)).toBe(24);
    expect(silenceThresholdHours(1)).toBe(48);
  });

  it("not silent just under the threshold", () => {
    expect(computeSilence([session(120, 80, hoursAgo(23))], 2, daysAgo(30), NOW).silent).toBe(false);
  });
});

describe("patient result screen", () => {
  it("emergency asks to call 14", () => {
    const e = patientEvaluation({ level: "EMERGENCY" }, { demoMode: false });
    expect(e).toMatchObject({ patientWord: "Urgent", action: "CALL_EMERGENCY" });
    expect(e.message).toContain("appelez le 14");
  });

  it("a new pending severe reading asks to re-measure in 15 min, 10 s in demo mode", () => {
    const e = patientEvaluation({ level: "OK" }, { newSessionStatus: "SEVERE_PENDING", demoMode: false });
    expect(e).toMatchObject({ action: "REMEASURE", remeasureInSeconds: 900 });
    expect(e.message).toContain("15 minutes");
    expect(remeasureSeconds(true)).toBe(10);
  });

  it("a danger answer wins over a re-measure", () => {
    const e = patientEvaluation({ level: "EMERGENCY" }, { newSessionStatus: "SEVERE_PENDING", demoMode: true });
    expect(e.action).toBe("CALL_EMERGENCY");
  });

  it("every level gives a word, an icon and a colour; low levels still point to help", () => {
    for (const level of ["HIGH", "WATCH", "SILENT", "OK"] as const) {
      const e = patientEvaluation({ level }, { demoMode: false });
      expect(e.patientWord && e.icon && e.color).toBeTruthy();
      expect(e.message).toContain("appelez le 14");
    }
  });
});

describe("triage sort (spec §6.5)", () => {
  const item = (level: TriageItem["level"], hasUnconfirmedSevere: boolean, hours: number) => ({
    level,
    hasUnconfirmedSevere,
    lastActivityAt: hoursAgo(hours),
    tag: `${level}${hasUnconfirmedSevere ? "+U" : ""}@${hours}`,
  });

  it("orders groups, then most recent first", () => {
    const sorted = triageSort([
      item("OK", false, 1),
      item("SILENT", false, 70),
      item("WATCH", false, 3),
      item("HIGH", false, 5),
      item("OK", true, 2),
      item("SEVERE", false, 4),
      item("EMERGENCY", false, 9),
      item("HIGH", false, 1),
    ]);
    expect(sorted.map((i) => i.tag)).toEqual([
      "EMERGENCY@9",
      "SEVERE@4",
      "OK+U@2",
      "HIGH@1",
      "HIGH@5",
      "WATCH@3",
      "SILENT@70",
      "OK@1",
    ]);
  });
});

describe("invite codes (spec §3)", () => {
  it("6 characters without 0, O, 1 or I", () => {
    let i = 0;
    const code = generateInviteCode((n) => (i++ * 7) % n);
    expect(code).toMatch(INVITE_CODE_PATTERN);
    expect("ABCDEF0".match(INVITE_CODE_PATTERN)).toBeNull();
    expect(INVITE_CODE_PATTERN.test("AB1DEF")).toBe(false);
  });

  it("valid 24 h, single use", () => {
    const expiresAt = inviteExpiresAt(NOW);
    expect(isInviteUsable({ expiresAt, usedAt: null }, NOW)).toBe(true);
    expect(isInviteUsable({ expiresAt, usedAt: NOW }, NOW)).toBe(false);
    expect(isInviteUsable({ expiresAt, usedAt: null }, new Date(expiresAt.getTime() + 1))).toBe(false);
  });
});
