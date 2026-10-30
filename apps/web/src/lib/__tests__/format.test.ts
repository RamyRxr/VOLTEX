import { describe, expect, it } from "vitest";
import { bmi, formatBp, formatWeek, initials, relativeTime, untilTime } from "../format";
import { isUrgent, levelDisplay, riskTone } from "../status";

const NOW = new Date("2026-10-30T12:00:00Z");
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();

describe("relative and remaining time", () => {
  it.each([
    [0.5, "à l'instant"],
    [5, "il y a 5 min"],
    [180, "il y a 3 h"],
    [24 * 60 + 5, "hier"],
    [4 * 24 * 60, "il y a 4 j"],
  ])("%f min ago → %s", (minutes, expected) => {
    expect(relativeTime(minutesAgo(minutes), NOW)).toBe(expected);
  });

  it("time until expiry", () => {
    expect(untilTime(new Date(NOW.getTime() + 23.5 * 3_600_000).toISOString(), NOW)).toBe("dans 23 h");
    expect(untilTime(new Date(NOW.getTime() + 12 * 60_000).toISOString(), NOW)).toBe("dans 12 min");
    expect(untilTime(minutesAgo(1), NOW)).toBe("expiré");
  });
});

describe("clinical formatting", () => {
  it("blood pressure and pregnancy week", () => {
    expect(formatBp({ sys: 165, dia: 112 })).toBe("165/112");
    expect(formatWeek({ weeks: 31, days: 4 })).toBe("31 SA + 4 j");
    expect(formatWeek({ weeks: 22, days: 0 })).toBe("22 SA");
    expect(formatWeek(null)).toBe("—");
  });

  it("BMI and initials", () => {
    expect(bmi(160, 64)).toBe("25.0");
    expect(bmi(null, 64)).toBeNull();
    expect(initials("Karima  Benali")).toBe("KB");
  });
});

describe("status display — icon + colour + word (spec rule 12)", () => {
  it("every level has a word, a tone and an icon", () => {
    for (const level of ["EMERGENCY", "SEVERE", "HIGH", "WATCH", "SILENT", "OK"] as const) {
      const d = levelDisplay(level);
      expect(d.word && d.tone && d.icon).toBeTruthy();
    }
  });

  it("an unconfirmed severe reading outranks HIGH and below, not EMERGENCY / SEVERE", () => {
    expect(levelDisplay("OK", true).word).toBe("Sévère non confirmée");
    expect(levelDisplay("HIGH", true).tone).toBe("danger");
    expect(levelDisplay("SEVERE", true).word).toBe("Sévère");
    expect(isUrgent("OK", true)).toBe(true);
    expect(isUrgent("HIGH")).toBe(false);
  });

  it("risk tones", () => {
    expect([riskTone("LOW"), riskTone("MODERATE"), riskTone("HIGH")]).toEqual(["ok", "watch", "warning"]);
  });
});
