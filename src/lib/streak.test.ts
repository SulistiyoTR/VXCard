import { describe, expect, it } from "vitest";
import { bestStreak, currentStreak } from "./streak";

describe("currentStreak", () => {
  it("counts back from today", () => {
    expect(currentStreak(["2026-09-02", "2026-09-01", "2026-08-31"], "2026-09-02")).toBe(3);
  });
  it("survives on yesterday when today is not done yet", () => {
    expect(currentStreak(["2026-09-01", "2026-08-31"], "2026-09-02")).toBe(2);
  });
  it("is zero after a gap", () => {
    expect(currentStreak(["2026-08-30", "2026-08-29"], "2026-09-02")).toBe(0);
  });
  it("ignores duplicates", () => {
    expect(currentStreak(["2026-09-02", "2026-09-02", "2026-09-01"], "2026-09-02")).toBe(2);
  });
});

describe("bestStreak", () => {
  it("finds the longest historical run", () => {
    expect(
      bestStreak(["2026-01-01", "2026-01-02", "2026-01-03", "2026-02-01", "2026-02-02"]),
    ).toBe(3);
  });
  it("is zero with no activity", () => {
    expect(bestStreak([])).toBe(0);
  });
});
