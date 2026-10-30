import { describe, expect, it } from "vitest";
import { ageInYears, parseIsoDate, pregnancyWeek, toIsoDate } from "../pregnancy";

const now = new Date(2026, 9, 30); // 30 Oct 2026

describe("parseIsoDate", () => {
  it("accepts real dates and rejects impossible ones", () => {
    expect(parseIsoDate("2026-02-28")).not.toBeNull();
    expect(parseIsoDate("2026-02-30")).toBeNull();
    expect(parseIsoDate("30/10/2026")).toBeNull();
  });
});

describe("pregnancyWeek", () => {
  it("counts completed weeks from the last period", () => {
    expect(pregnancyWeek({ lmpDate: "2026-10-02", dueDate: null }, now)).toBe(4);
  });

  it("works back from the due date (40 weeks at term)", () => {
    expect(pregnancyWeek({ dueDate: toIsoDate(new Date(2026, 9, 30)), lmpDate: null }, now)).toBe(40);
    // 63 days before term = 217 days = 31 weeks
    expect(pregnancyWeek({ dueDate: toIsoDate(new Date(2027, 0, 1)), lmpDate: null }, now)).toBe(31);
  });

  it("rejects dates that are not an ongoing pregnancy", () => {
    expect(pregnancyWeek({ lmpDate: "2027-01-01", dueDate: null }, now)).toBeNull();
    expect(pregnancyWeek({ dueDate: "2025-01-01", lmpDate: null }, now)).toBeNull();
    expect(pregnancyWeek({ dueDate: null, lmpDate: null }, now)).toBeNull();
  });
});

describe("ageInYears", () => {
  it("counts full years only", () => {
    expect(ageInYears("1997-10-30", now)).toBe(29);
    expect(ageInYears("1997-10-31", now)).toBe(28);
  });
});
