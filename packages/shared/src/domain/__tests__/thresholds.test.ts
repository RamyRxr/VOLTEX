import { describe, expect, it } from "vitest";
import { isHypertensive, isSevere } from "../thresholds";

describe("thresholds (CLAUDE.md §6.1): systolic OR diastolic", () => {
  it("hypertensive from 140/90", () => {
    expect(isHypertensive({ sys: 140, dia: 70 })).toBe(true);
    expect(isHypertensive({ sys: 120, dia: 90 })).toBe(true);
    expect(isHypertensive({ sys: 139, dia: 89 })).toBe(false);
  });

  it("severe from 160/110", () => {
    expect(isSevere({ sys: 160, dia: 80 })).toBe(true);
    expect(isSevere({ sys: 130, dia: 110 })).toBe(true);
    expect(isSevere({ sys: 159, dia: 109 })).toBe(false);
  });
});
