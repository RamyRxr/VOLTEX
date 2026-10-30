import { describe, expect, it } from "vitest";
import { isCompleteInviteCode, normalizeInviteCode } from "../inviteCode";

describe("invite codes", () => {
  it("uppercases and drops characters that never appear in a code", () => {
    expect(normalizeInviteCode("k7 m4-pq")).toBe("K7M4PQ");
    expect(normalizeInviteCode("O0I1AB")).toBe("AB");
  });

  it("caps the length at 6", () => {
    expect(normalizeInviteCode("ABCDEFGH")).toBe("ABCDEF");
  });

  it("is complete only with 6 allowed characters", () => {
    expect(isCompleteInviteCode("K7M4PQ")).toBe(true);
    expect(isCompleteInviteCode("K7M4P")).toBe(false);
    expect(isCompleteInviteCode("K7M4P0")).toBe(false);
  });
});
