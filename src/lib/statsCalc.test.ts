import { describe, expect, it } from "vitest";
import { monthActivity, statsOverview } from "./statsCalc";
import { makeWord } from "./testutil";
import type { Review, SessionRow } from "./types";

const session = (over: Partial<SessionRow>): SessionRow => ({
  id: over.id ?? crypto.randomUUID(),
  started_at: over.started_at ?? "2026-09-02T10:00:00.000Z",
  finished_at: null,
  completed: over.completed ?? true,
  planned: 10,
  answered: over.answered ?? 10,
  source: "mixed",
  updated_at: "2026-09-02T10:05:00.000Z",
});

const review = (result: Review["result"], daysAgoISO: string): Review => ({
  id: crypto.randomUUID(),
  word_id: "w",
  reviewed_at: `${daysAgoISO}T12:00:00.000Z`,
  level: 1,
  result,
  duration_ms: 3000,
  help_used: 0,
  source: "due",
});

describe("statsOverview", () => {
  it("counts levels and finished", () => {
    const deck = [makeWord({ level: 1 }), makeWord({ level: 3 }), makeWord({ level: 5 })];
    const s = statsOverview(deck, [], [], "2026-09-02");
    expect(s.total).toBe(3);
    expect(s.finished).toBe(1);
    expect(s.levels[1]).toBe(1);
    expect(s.levels[5]).toBe(1);
  });

  it("computes 30-day accuracy percentages", () => {
    const reviews = [
      review("correct", "2026-09-01"),
      review("correct", "2026-09-01"),
      review("slow", "2026-09-01"),
      review("wrong", "2026-09-01"),
    ];
    const s = statsOverview([], [], reviews, "2026-09-02");
    expect(s.accuracy).toEqual({ correct: 50, slow: 25, wrong: 25 });
  });

  it("ignores reviews older than 30 days", () => {
    const s = statsOverview([], [], [review("correct", "2026-07-01")], "2026-09-02");
    expect(s.accuracy).toBeNull();
  });

  it("streak reflects completed sessions", () => {
    const sessions = [
      session({ started_at: "2026-09-02T09:00:00.000Z" }),
      session({ started_at: "2026-09-01T09:00:00.000Z" }),
    ];
    expect(statsOverview([], sessions, [], "2026-09-02").streak).toBe(2);
  });
});

describe("monthActivity", () => {
  it("aggregates sessions per day and finds the first month", () => {
    const sessions = [
      session({ started_at: "2026-09-02T09:00:00.000Z", answered: 10 }),
      session({ started_at: "2026-09-02T18:00:00.000Z", answered: 5 }),
      session({ started_at: "2026-07-15T09:00:00.000Z" }),
    ];
    const { days, firstEverMonth } = monthActivity(sessions, "2026-09");
    expect(days).toHaveLength(1);
    expect(days[0]).toEqual({ date: "2026-09-02", sessions: 2, words: 15 });
    expect(firstEverMonth).toBe("2026-07");
  });
});
