import { describe, expect, it } from "vitest";
import { maskPhone, normalizePhone } from "../phone";
import { formatSmsBody, parseSms } from "../sms/parse";
import { smsReplyText, type SmsReplyKind } from "../sms/reply";

describe("parseSms — grammar of CLAUDE.md §4.3", () => {
  it("TA 145 92 78", () => {
    expect(parseSms("TA 145 92 78")).toEqual({
      ok: true,
      value: { sys: 145, dia: 92, pulse: 78, pillStatus: "NOT_REPORTED", symptoms: [], ignored: [] },
    });
  });

  it("TA 165 100 78 MP — missed pill", () => {
    const r = parseSms("TA 165 100 78 MP");
    expect(r.ok && r.value).toMatchObject({ sys: 165, dia: 100, pulse: 78, pillStatus: "MISSED" });
  });

  it("ta 182 118 cp — lower case, no pulse, danger code", () => {
    const r = parseSms("ta 182 118 cp");
    expect(r.ok && r.value).toMatchObject({ sys: 182, dia: 118, pulse: null, symptoms: ["CHEST_PAIN"] });
  });

  it("tolerates extra spaces and a slash", () => {
    expect(parseSms("   TA   145   92  ").ok).toBe(true);
    const r = parseSms("TA 145/92 78 PP");
    expect(r.ok && r.value).toMatchObject({ sys: 145, dia: 92, pulse: 78, pillStatus: "TAKEN" });
  });

  it("maps every symptom code", () => {
    const r = parseSms("TA 150 95 80 CP VU CF FB PA MT VE SN");
    expect(r.ok && r.value.symptoms).toEqual([
      "CHEST_PAIN",
      "VISION",
      "CONFUSION",
      "WEAKNESS",
      "SPEECH",
      "HEADACHE",
      "DIZZINESS",
      "NOSEBLEED",
    ]);
  });

  it("a typo never drops a danger code", () => {
    const r = parseSms("TA 180 110 CP XX");
    expect(r.ok && r.value).toMatchObject({ symptoms: ["CHEST_PAIN"], ignored: ["XX"] });
  });

  it("contradictory pill codes are not reported", () => {
    const r = parseSms("TA 140 90 MP PP");
    expect(r.ok && r.value.pillStatus).toBe("NOT_REPORTED");
  });

  it("rejects what is not a reading, never throws", () => {
    expect(parseSms("Bonjour docteur")).toEqual({ ok: false, reason: "NOT_A_READING" });
    expect(parseSms("")).toEqual({ ok: false, reason: "NOT_A_READING" });
    expect(parseSms("TA 145")).toEqual({ ok: false, reason: "MISSING_VALUES" });
    expect(parseSms("TA abc def")).toEqual({ ok: false, reason: "MISSING_VALUES" });
    expect(parseSms("TA 400 92")).toEqual({ ok: false, reason: "OUT_OF_RANGE" });
    expect(parseSms("TA 90 140")).toEqual({ ok: false, reason: "OUT_OF_RANGE" });
  });

  it("formats the pre-filled body of the 'Envoyer par SMS' button", () => {
    expect(formatSmsBody({ sys: 145, dia: 92, pulse: 78, pillStatus: "MISSED", symptoms: ["CHEST_PAIN"] })).toBe(
      "TA 145 92 78 MP CP",
    );
    expect(formatSmsBody({ sys: 145, dia: 92, pulse: null, pillStatus: "NOT_REPORTED", symptoms: [] })).toBe("TA 145 92");
  });
});

describe("SMS replies", () => {
  it("echo the exact numbers received (CLAUDE.md examples)", () => {
    expect(smsReplyText("REMEASURE_HIGH", { sys: 165, dia: 100 })).toBe(
      "Tension élevée (165/100). Reposez-vous 5 minutes et renvoyez une mesure.",
    );
    expect(smsReplyText("NORMAL", { sys: 128, dia: 82 })).toBe("Mesure reçue (128/82). Bon, continuez ainsi.");
    expect(smsReplyText("DANGER", { sys: 182, dia: 118 })).toMatch(/^Appelez le 14 maintenant\./);
  });

  it("never leave a placeholder, never carry a name", () => {
    const kinds: SmsReplyKind[] = ["HELP", "UNKNOWN", "DANGER", "REMEASURE_HIGH", "REMEASURE_LOW", "NORMAL", "CRISIS", "HIGH", "ABOVE_TARGET", "LOW"];
    for (const kind of kinds) {
      const text = smsReplyText(kind, { sys: 150, dia: 95 });
      expect(text).not.toMatch(/[{}]/);
      expect(text.length).toBeLessThanOrEqual(160);
    }
  });
});

describe("phone numbers", () => {
  it("normalises Algerian formats to E.164", () => {
    expect(normalizePhone("0550000000")).toBe("+213550000000");
    expect(normalizePhone("0550 00 00 00")).toBe("+213550000000");
    expect(normalizePhone("+213 550-00-00-00")).toBe("+213550000000");
    expect(normalizePhone("00213550000000")).toBe("+213550000000");
    expect(normalizePhone("abc")).toBeNull();
    expect(normalizePhone("0550")).toBeNull();
  });

  it("masks numbers for display", () => {
    expect(maskPhone("+213550000006")).toBe("+213 •• •• 00 06");
  });
});
