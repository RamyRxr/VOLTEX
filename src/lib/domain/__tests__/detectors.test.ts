import { describe, expect, it } from "vitest";
import { describeFinding, describeMissedPill, describeOffice, describePendingCrisis } from "../describe";
import { computeAdherence } from "../missedPill";
import { computeSilence, silenceThresholdDays } from "../silence";
import { computeTrend, slope } from "../trend";
import { compareOfficeHome } from "../whiteCoat";
import { DAY, NOW, profile, session } from "./helpers";

const target = { sys: 135, dia: 85 };

describe("trend", () => {
  it("fits the least-squares slope", () => {
    expect(slope([{ x: 0, y: 1 }, { x: 1, y: 3 }, { x: 2, y: 5 }])).toBe(2);
  });

  it("projects the days until the 7-day average reaches the target", () => {
    const rising = Array.from({ length: 14 }, (_, i) => session({ daysAgo: 14 - i, avgSys: 120 + i * 0.5 }));
    const tr = computeTrend(rising, NOW, target, 128);
    expect(tr?.rising).toBe(true);
    expect(tr?.perWeek).toBeCloseTo(3.5, 5);
    expect(tr?.daysToTarget).toBe(14);
  });

  it("a flat series is not rising", () => {
    const flat = Array.from({ length: 6 }, (_, i) => session({ daysAgo: 12 - i * 2, avgSys: 128 }));
    expect(computeTrend(flat, NOW, target, 128)).toMatchObject({ rising: false, direction: "flat" });
  });
});

describe("silence", () => {
  it("threshold is 2 × the expected interval", () => {
    expect(silenceThresholdDays(2, false)).toBe(7);
    expect(silenceThresholdDays(7, false)).toBe(2);
    expect(silenceThresholdDays(2, true)).toBe(3);
  });

  it("counts whole days since the last session of any status", () => {
    const sessions = [session({ daysAgo: 9 }), session({ daysAgo: 12, status: "EXPIRED" })];
    expect(computeSilence(sessions, profile({ expectedReadingsPerWeek: 2 }), NOW, false)).toMatchObject({
      silent: true,
      days: 9,
      thresholdDays: 7,
    });
  });
});

describe("white-coat and masked hypertension", () => {
  it("office above home by ≥ 10 systolic → white-coat", () => {
    const o = compareOfficeHome({ sys: 131, dia: 83 }, { lastOfficeSys: 148, lastOfficeDia: 92 }, target);
    expect(o?.kind).toBe("WHITE_COAT");
    expect(describeOffice(o!)).toBe("Domicile 131/83 contre cabinet 148/92 : possible effet blouse blanche");
  });

  it("office above home by ≥ 5 diastolic → white-coat", () => {
    expect(compareOfficeHome({ sys: 128, dia: 80 }, { lastOfficeSys: 132, lastOfficeDia: 85 }, target)?.kind).toBe("WHITE_COAT");
  });

  it("home above target with office below 140/90 → masked", () => {
    const o = compareOfficeHome({ sys: 142, dia: 88 }, { lastOfficeSys: 134, lastOfficeDia: 86 }, target);
    expect(o?.kind).toBe("MASKED");
  });

  it("nothing without an office reading or a home average", () => {
    expect(compareOfficeHome(null, { lastOfficeSys: 148, lastOfficeDia: 92 }, target)).toBeNull();
    expect(compareOfficeHome({ sys: 131, dia: 83 }, { lastOfficeSys: null, lastOfficeDia: null }, target)).toBeNull();
  });
});

describe("adherence", () => {
  it("TAKEN / (TAKEN + MISSED), NOT_REPORTED excluded", () => {
    const sessions = [
      session({ daysAgo: 1, pillStatus: "TAKEN" }),
      session({ daysAgo: 2, pillStatus: "TAKEN" }),
      session({ daysAgo: 3, pillStatus: "MISSED" }),
      session({ daysAgo: 4, pillStatus: "NOT_REPORTED" }),
      session({ daysAgo: 40, pillStatus: "MISSED" }),
    ];
    expect(computeAdherence(sessions, NOW)).toBeCloseTo(2 / 3, 5);
    expect(computeAdherence([session({ pillStatus: "NOT_REPORTED" })], NOW)).toBeNull();
  });
});

describe("generated wording (spec examples)", () => {
  it("trend", () => {
    expect(describeFinding({ kind: "TREND", level: "YELLOW", perWeek: 2.1, daysToTarget: 10 })).toBe(
      "Systolique en hausse de +2,1 mmHg/semaine ; cible probablement dépassée dans ~10 jours",
    );
  });

  it("missed pill", () => {
    expect(describeFinding({ kind: "MISSED_PILL", level: "YELLOW", deltaSys: 15 })).toBe("+15 mmHg les jours sans médicament");
    expect(
      describeMissedPill({
        deltaSys: 15,
        missed: { sys: 152, dia: 95 },
        taken: { sys: 137, dia: 86 },
        missedCount: 4,
        takenCount: 6,
        flagged: true,
      }),
    ).toBe("+15 mmHg les jours sans médicament (152/95 contre 137/86 ; 4 oublis, 6 prises)");
  });

  it("silence", () => {
    expect(
      describeFinding({ kind: "SILENCE", level: "GREY_SILENT", days: 9, thresholdDays: 7, neverMeasured: false }),
    ).toBe("Silencieux : aucune mesure depuis 9 jours (seuil 7)");
    expect(
      describeFinding({ kind: "SILENCE", level: "GREY_SILENT", days: 5, thresholdDays: 14 / 3, neverMeasured: false }),
    ).toBe("Silencieux : aucune mesure depuis 5 jours (seuil 4,7)");
  });

  it("unconfirmed crisis", () => {
    expect(
      describePendingCrisis({ sessionId: "x", bp: { sys: 195, dia: 125 }, startedAt: new Date(NOW.getTime() - DAY), awaiting: false }),
    ).toBe("Non confirmé 195/125, le patient n'a pas remesuré");
  });
});
