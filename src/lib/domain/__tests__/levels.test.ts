import { describe, expect, it } from "vitest";
import { describeReason } from "../describe";
import { assessPatient, mergeAlertLevel, toPatientStatus } from "../levels";
import type { DomainSession, PatientProfile } from "../types";
import { DAY, NOW, WINDOW, confirmedPair, profile, session } from "./helpers";

const assess = (sessions: DomainSession[], p: PatientProfile = profile(), closed?: Set<string>) =>
  assessPatient({ patient: p, sessions, now: NOW, windowMs: WINDOW, closedRedSessionIds: closed });

const daily = (days: number[], sys = 128, dia = 80) => days.map((d) => session({ daysAgo: d, avgSys: sys, avgDia: dia }));

describe("assessPatient — levels of spec §6.4", () => {
  it("GREEN when the 7-day average is within target", () => {
    const a = assess(daily([1, 2, 3, 4]));
    expect(a.level).toBe("GREEN");
    expect(describeReason(a)).toBe("Moyenne 7 jours 128/80, dans la cible 135/85");
  });

  it("RED_EMERGENCY for a danger symptom, whatever the reading", () => {
    const a = assess([...daily([2, 3]), session({ status: "DANGER", avgSys: 128, avgDia: 79, symptoms: ["CHEST_PAIN"] })]);
    expect(a.level).toBe("RED_EMERGENCY");
    expect(describeReason(a)).toBe("Signe de danger (douleur dans la poitrine) avec 128/79 : patient invité à appeler le 14");
  });

  it("a red rule stops once the doctor closed its alert", () => {
    const danger = session({ status: "DANGER", symptoms: ["VISION"] });
    expect(assess([danger], profile(), new Set([danger.id])).level).not.toBe("RED_EMERGENCY");
  });

  it("RED_CRISIS for a confirmed session ≥ 180/120", () => {
    const a = assess([...daily([2, 3, 4]), ...confirmedPair(0, { sys: 182, dia: 118 })]);
    expect(a.level).toBe("RED_CRISIS");
    expect(describeReason(a)).toBe("Confirmé 182/118, niveau crise");
  });

  it("no crisis when the re-measure came back lower", () => {
    const first = session({ minutesAgo: 10, avgSys: 195, avgDia: 125, status: "NOT_CONFIRMED" });
    const second = session({ avgSys: 150, avgDia: 92, status: "CONFIRMED" });
    expect(assess([...daily([2, 3]), first, second]).level).not.toBe("RED_CRISIS");
  });

  it("a single unconfirmed high reading never raises an alert", () => {
    const a = assess([...daily([1, 2, 3]), session({ status: "PENDING", avgSys: 165, avgDia: 100, minutesAgo: 3 })]);
    expect(a.level).toBe("GREEN");
  });

  it("ORANGE when 2 of the last 3 occasions are ≥ 160/100", () => {
    const sessions = [
      ...confirmedPair(3, { sys: 158, dia: 98 }),
      ...confirmedPair(2, { sys: 162, dia: 101 }),
      ...confirmedPair(1, { sys: 166, dia: 98 }),
    ];
    const a = assess(sessions);
    expect(a.level).toBe("ORANGE");
    expect(describeReason(a)).toBe("2 des 3 dernières mesures ≥ 160/100 (162/101, 166/98)");
  });

  it("one confirmed high occasion is not '2 of 3' (a pair counts once)", () => {
    const a = assess([...daily([3, 2]), ...confirmedPair(1, { sys: 165, dia: 100 })]);
    expect(a.level).toBe("YELLOW");
    expect(a.primary?.kind).toBe("AVERAGE");
  });

  it("ORANGE for 2 of 3 low readings with dizziness", () => {
    const low = (d: number) => confirmedPair(d, { sys: 86, dia: 56 }, { sys: 87, dia: 57 }, { symptoms: ["DIZZINESS"] });
    expect(assess([...low(2), ...low(1), session()]).primary?.kind).toBe("LOW_REPEATED");
  });

  it("low readings without dizziness are not ORANGE", () => {
    const low = (d: number) => confirmedPair(d, { sys: 86, dia: 56 });
    expect(assess([...low(2), ...low(1), session()]).level).not.toBe("ORANGE");
  });

  it("YELLOW when the 7-day average is above target", () => {
    const sessions = [3, 2, 1].flatMap((d) => confirmedPair(d, { sys: 145, dia: 90 }));
    const a = assess(sessions);
    expect(a.level).toBe("YELLOW");
    expect(describeReason(a)).toBe("Moyenne 7 jours 145/90, au-dessus de la cible 135/85");
  });

  it("YELLOW for a rising 14-day trend before the average crosses the target", () => {
    const rising = Array.from({ length: 14 }, (_, i) => session({ daysAgo: 14 - i, avgSys: 122 + Math.round(i * 0.45), avgDia: 80 }));
    const a = assess(rising);
    expect(a.level).toBe("YELLOW");
    expect(a.primary?.kind).toBe("TREND");
    expect(describeReason(a)).toMatch(/^Systolique en hausse de \+\d+,\d mmHg\/semaine ; cible probablement dépassée dans ~\d+ jours$/);
  });

  it("no trend with fewer than 5 sessions in 14 days", () => {
    const four = [8, 6, 4, 2].map((d, i) => session({ daysAgo: d, avgSys: 120 + i * 4 }));
    expect(assess(four).trend).toBeNull();
  });

  it("YELLOW for the missed-pill pattern (NOT_REPORTED excluded)", () => {
    const sessions = [
      ...[12, 10, 8].map((d) => session({ daysAgo: d, avgSys: 126, pillStatus: "TAKEN" })),
      ...[11, 9, 7].map((d) => session({ daysAgo: d, avgSys: 134, avgDia: 84, pillStatus: "MISSED" })),
      ...[6, 5].map((d) => session({ daysAgo: d, avgSys: 200, avgDia: 84, pillStatus: "NOT_REPORTED", status: "EXPIRED" })),
    ];
    const a = assess(sessions, profile({ expectedReadingsPerWeek: 2 }));
    expect(a.missedPill?.deltaSys).toBe(8);
    expect(a.missedPill?.flagged).toBe(false);

    const strong = [
      ...[12, 10, 8].map((d) => session({ daysAgo: d, avgSys: 124, pillStatus: "TAKEN" })),
      ...[11, 9, 7].map((d) => session({ daysAgo: d, avgSys: 134, avgDia: 84, pillStatus: "MISSED" })),
      ...[6, 5].map((d) => session({ daysAgo: d, avgSys: 128, pillStatus: "NOT_REPORTED" })),
    ];
    const b = assess(strong, profile({ expectedReadingsPerWeek: 2 }));
    expect(b.missedPill).toMatchObject({ deltaSys: 10, flagged: true, missedCount: 3, takenCount: 3 });
    expect(b.findings.map((f) => f.kind)).toContain("MISSED_PILL");
  });

  it("missed-pill pattern needs at least 3 sessions in each group", () => {
    const sessions = [
      ...[6, 4, 2].map((d) => session({ daysAgo: d, avgSys: 124 })),
      ...[5, 3].map((d) => session({ daysAgo: d, avgSys: 150, avgDia: 84, pillStatus: "MISSED" })),
    ];
    expect(assess(sessions).missedPill).toBeNull();
  });

  it("GREY_SILENT after 2× the expected interval", () => {
    const p = profile({ expectedReadingsPerWeek: 2 });
    const a = assess(daily([18, 15, 12, 9]), p);
    expect(a.level).toBe("GREY_SILENT");
    expect(describeReason(a)).toBe("Silencieux : aucune mesure depuis 9 jours (seuil 7)");
    expect(assess(daily([12, 6]), p).level).toBe("GREEN");
  });

  it("silence is a tag when a more severe rule matches; high-risk patients after 3 days", () => {
    const sessions = [
      ...confirmedPair(6, { sys: 162, dia: 101 }),
      ...confirmedPair(5, { sys: 166, dia: 98 }),
    ];
    const a = assess(sessions, profile({ expectedReadingsPerWeek: 2 }));
    expect(a.level).toBe("ORANGE");
    expect(a.silence).toMatchObject({ silent: true, thresholdDays: 3 });
  });

  it("silence before the first reading counts from enrolment", () => {
    const a = assess([], profile({ expectedReadingsPerWeek: 2, enrolledAt: new Date(NOW.getTime() - 10 * DAY) }));
    expect(a.level).toBe("GREY_SILENT");
    expect(a.silence.neverMeasured).toBe(true);
  });
});

describe("pending crisis item", () => {
  it("an expired session ≥ crisis is shown to the doctor, never red", () => {
    const a = assess([...daily([4, 3, 2]), session({ daysAgo: 1, avgSys: 195, avgDia: 125, status: "EXPIRED" })]);
    expect(a.level).toBe("GREEN");
    expect(a.pendingCrisis?.awaiting).toBe(false);
    expect(describeReason(a)).toBe("Non confirmé 195/125, le patient n'a pas remesuré");
  });

  it("a crisis value inside the window reads 'awaiting confirmation'", () => {
    const a = assess([...daily([2, 1]), session({ minutesAgo: 2, avgSys: 182, avgDia: 118, status: "PENDING" })]);
    expect(describeReason(a)).toBe("En attente de confirmation : 182/118");
  });

  it("disappears once the patient measures again", () => {
    const sessions = [session({ daysAgo: 3, avgSys: 195, avgDia: 125, status: "EXPIRED" }), ...daily([2, 1])];
    expect(assess(sessions).pendingCrisis).toBeNull();
  });
});

describe("status mapping", () => {
  it("maps doctor levels to patient icon, tone and word", () => {
    expect(toPatientStatus("RED_CRISIS")).toEqual({ word: "URGENT", icon: "alert-octagon", tone: "red" });
    expect(toPatientStatus("ORANGE")).toEqual({ word: "ATTENTION", icon: "alert-triangle", tone: "orange" });
    expect(toPatientStatus("YELLOW")).toEqual({ word: "ATTENTION", icon: "alert-triangle", tone: "yellow" });
    expect(toPatientStatus("GREY_SILENT")).toEqual({ word: "FOLLOW_UP", icon: "clock", tone: "grey" });
    expect(toPatientStatus("GREEN")).toEqual({ word: "GOOD", icon: "check-circle", tone: "green" });
  });

  it("an unresolved red alert keeps the patient red", () => {
    expect(mergeAlertLevel("GREEN", ["RED_CRISIS", "YELLOW"])).toBe("RED_CRISIS");
    expect(mergeAlertLevel("ORANGE", ["YELLOW"])).toBe("ORANGE");
  });
});
