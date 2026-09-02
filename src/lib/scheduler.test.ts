import { describe, expect, it } from "vitest";
import {
  intervalStep,
  nextInterval,
  scoreAnswer,
  updateCard,
  updateCardHardMode,
} from "./scheduler";
import type { CardState } from "./types";

const NOW = new Date(2026, 8, 2); // 2026-09-02, local
const card = (over: Partial<CardState> = {}): CardState => ({
  level: 1,
  streak: 0,
  due_date: "2026-09-02",
  lapse_count: 0,
  ...over,
});

describe("scoreAnswer", () => {
  it("flags a slow-but-correct answer by time", () => {
    expect(scoreAnswer({ correct: true, dontKnow: false, durationMs: 7000, level: 1, helpUsed: 0 })).toBe("slow");
  });
  it("flags slow when a hint was used regardless of time", () => {
    expect(scoreAnswer({ correct: true, dontKnow: false, durationMs: 500, level: 4, helpUsed: 1 })).toBe("slow");
  });
  it("discards the duration past MAX_DURATION and scores plain correct", () => {
    expect(scoreAnswer({ correct: true, dontKnow: false, durationMs: 90_000, level: 1, helpUsed: 0 })).toBe("correct");
  });
  it("separates dontknow from wrong", () => {
    expect(scoreAnswer({ correct: false, dontKnow: true, durationMs: 1000, level: 1, helpUsed: 0 })).toBe("dontknow");
    expect(scoreAnswer({ correct: false, dontKnow: false, durationMs: 1000, level: 1, helpUsed: 0 })).toBe("wrong");
  });
});

describe("updateCard — level up / down (SPEC 2.3 trace table)", () => {
  it("L2 streak 1 + wrong → L2 streak 0 (does not drop)", () => {
    const r = updateCard(card({ level: 2, streak: 1 }), "wrong", NOW);
    expect(r.level).toBe(2);
    expect(r.streak).toBe(0);
    expect(r.lapse_count).toBe(1);
  });
  it("L2 streak 0 + wrong → L1 streak 1 (drops, one correct returns)", () => {
    const r = updateCard(card({ level: 2, streak: 0 }), "wrong", NOW);
    expect(r.level).toBe(1);
    expect(r.streak).toBe(1);
  });
  it("L3 streak 2 + correct → L4 streak 0", () => {
    const r = updateCard(card({ level: 3, streak: 2 }), "correct", NOW);
    expect(r.level).toBe(4);
    expect(r.streak).toBe(0);
  });
  it("L1 streak 0 + wrong stays at L1 streak 0 (floor)", () => {
    const r = updateCard(card({ level: 1, streak: 0 }), "dontknow", NOW);
    expect(r.level).toBe(1);
    expect(r.streak).toBe(0);
  });
  it("L4 streak 2 + correct → finished (L5)", () => {
    const r = updateCard(card({ level: 4, streak: 2 }), "correct", NOW);
    expect(r.level).toBe(5);
  });
  it("slow still advances the streak like correct", () => {
    const r = updateCard(card({ level: 1, streak: 1 }), "slow", NOW);
    expect(r.level).toBe(2);
    expect(r.streak).toBe(0);
  });
});

describe("intervals (SPEC 3.2)", () => {
  it("maps level/streak to the ladder step", () => {
    expect(intervalStep(1, 0)).toBe(0);
    expect(intervalStep(2, 0)).toBe(1);
    expect(intervalStep(3, 0)).toBe(2);
    expect(intervalStep(3, 2)).toBe(4);
    expect(intervalStep(4, 1)).toBe(6);
    expect(intervalStep(5, 0)).toBe(8);
  });
  it("correct takes the full step, slow steps one back", () => {
    expect(nextInterval(3, 2, "correct")).toBe(15);
    expect(nextInterval(3, 2, "slow")).toBe(8);
    expect(nextInterval(1, 0, "slow")).toBe(1);
  });
  it("wrong / dontknow is always tomorrow", () => {
    expect(nextInterval(4, 2, "wrong")).toBe(1);
    expect(nextInterval(2, 0, "dontknow")).toBe(1);
  });
  it("writes the due_date forward from today", () => {
    const r = updateCard(card({ level: 3, streak: 1 }), "correct", NOW); // → L3 streak 2, step 4 = 15d
    expect(r.due_date).toBe("2026-09-17");
  });
});

describe("updateCardHardMode (SPEC 3.7)", () => {
  it("correct answers change nothing", () => {
    const before = card({ level: 4, streak: 1, due_date: "2027-01-01" });
    const { card: after, demoted } = updateCardHardMode(before, "correct", 0, NOW);
    expect(after).toEqual(before);
    expect(demoted).toBe(false);
  });
  it("wrong answer sets due tomorrow and bumps lapse_count", () => {
    const { card: after } = updateCardHardMode(card({ level: 4, streak: 2 }), "wrong", 0, NOW);
    expect(after.due_date).toBe("2026-09-03");
    expect(after.lapse_count).toBe(1);
    expect(after.streak).toBe(1);
  });
  it("demotes on streak underflow while the brake has room", () => {
    const { card: after, demoted } = updateCardHardMode(card({ level: 4, streak: 0 }), "wrong", 1, NOW);
    expect(demoted).toBe(true);
    expect(after.level).toBe(3);
    expect(after.streak).toBe(2);
  });
  it("brake stops the 3rd demotion but still records the lapse", () => {
    const { card: after, demoted } = updateCardHardMode(card({ level: 4, streak: 0 }), "wrong", 2, NOW);
    expect(demoted).toBe(false);
    expect(after.level).toBe(4);
    expect(after.streak).toBe(0);
    expect(after.lapse_count).toBe(1);
  });
});
