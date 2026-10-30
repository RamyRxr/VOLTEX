import { describe, expect, it } from "vitest";
import {
  applyUpdates,
  classifyReading,
  expirePending,
  isValidSession,
  registerSession,
  twoOfLastThree,
} from "../sessions";
import { minutesAgo, NOW, session } from "./fixtures";

describe("classifyReading — systolic OR diastolic against 140/90 and 160/110", () => {
  it.each([
    [139, 89, "NORMAL"],
    [140, 70, "HYPERTENSIVE"],
    [120, 90, "HYPERTENSIVE"],
    [159, 109, "HYPERTENSIVE"],
    [160, 80, "SEVERE_PENDING"],
    [130, 110, "SEVERE_PENDING"],
  ])("%i/%i → %s", (sys, dia, expected) => {
    expect(classifyReading({ sys, dia })).toBe(expected);
  });
});

describe("registerSession — confirmation of a severe reading (spec §6.4 steps 2–3)", () => {
  it("a lone severe reading stays pending", () => {
    const result = registerSession([], { id: "new", sys: 165, dia: 112, takenAt: NOW });
    expect(result).toEqual({ status: "SEVERE_PENDING", updates: [] });
  });

  it("a second severe reading within 60 min confirms both", () => {
    const pending = session(165, 112, minutesAgo(15));
    const result = registerSession([pending], { id: "new", sys: 162, dia: 111, takenAt: NOW });
    expect(result.status).toBe("SEVERE_CONFIRMED");
    expect(result.updates).toEqual([{ id: pending.id, status: "SEVERE_CONFIRMED", confirmedBySessionId: "new" }]);
  });

  it("a lower second reading marks the first as not confirmed and is classified alone", () => {
    const pending = session(165, 112, minutesAgo(15));
    const result = registerSession([pending], { id: "new", sys: 145, dia: 92, takenAt: NOW });
    expect(result.status).toBe("HYPERTENSIVE");
    expect(result.updates).toEqual([{ id: pending.id, status: "SEVERE_NOT_CONFIRMED", confirmedBySessionId: "new" }]);
  });

  it("a pending reading older than the window is not resolved", () => {
    const old = session(165, 112, minutesAgo(61));
    const result = registerSession([old], { id: "new", sys: 165, dia: 112, takenAt: NOW });
    expect(result).toEqual({ status: "SEVERE_PENDING", updates: [] });
  });
});

describe("expirePending", () => {
  it("expires pending readings past the 60-minute window only", () => {
    const old = session(165, 112, minutesAgo(61));
    const fresh = session(165, 112, minutesAgo(10));
    expect(expirePending([old, fresh], NOW)).toEqual([{ id: old.id, status: "SEVERE_EXPIRED" }]);
  });

  it("applyUpdates returns new records without mutating the input", () => {
    const old = session(165, 112, minutesAgo(61));
    const input = [old];
    const out = applyUpdates(input, expirePending(input, NOW));
    expect(out[0]?.status).toBe("SEVERE_EXPIRED");
    expect(old.status).toBe("SEVERE_PENDING");
  });
});

describe("valid sessions and the 2-of-3 rule", () => {
  it("pending, not confirmed and expired readings are excluded", () => {
    expect(["SEVERE_PENDING", "SEVERE_NOT_CONFIRMED", "SEVERE_EXPIRED"].map((status) =>
      isValidSession({ status: status as never }),
    )).toEqual([false, false, false]);
    expect(isValidSession({ status: "SEVERE_CONFIRMED" })).toBe(true);
  });

  it("fires when 2 of the last 3 valid sessions are ≥ 140/90", () => {
    const s = [session(142, 85, minutesAgo(30)), session(125, 80, minutesAgo(600)), session(120, 92, minutesAgo(1200))];
    expect(twoOfLastThree(s, NOW)).toHaveLength(2);
  });

  it("ignores an unconfirmed severe reading when counting", () => {
    const s = [
      session(170, 112, minutesAgo(10), "SEVERE_EXPIRED"),
      session(142, 85, minutesAgo(30)),
      session(125, 80, minutesAgo(600)),
      session(118, 75, minutesAgo(1200)),
    ];
    expect(twoOfLastThree(s, NOW)).toBeNull();
  });
});
