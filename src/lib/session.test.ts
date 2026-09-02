import { describe, expect, it } from "vitest";
import { buildHardModeSession, buildPracticeSession, buildSession, dueCount } from "./session";
import { seededRng } from "./random";
import { makeDeck, makeWord } from "./testutil";

const NOW = new Date(2026, 8, 2); // 2026-09-02

function compose(dueAvail: number, slot: number) {
  // dueAvail cards overdue, plus a big cushion of not-yet-due cards
  const due = makeDeck(dueAvail, "2026-08-20");
  const future = Array.from({ length: 50 }, (_, i) =>
    makeWord({ id: `f${i}`, due_date: "2026-12-01" }),
  );
  const items = buildSession([...due, ...future], slot, { now: NOW, rng: seededRng(1) });
  return {
    total: items.length,
    due: items.filter((i) => i.source === "due").length,
    random: items.filter((i) => i.source === "random").length,
  };
}

describe("buildSession composition (SPEC 3.3 table)", () => {
  it("due=40, slot=15 → 12 due + 3 random", () => {
    expect(compose(40, 15)).toEqual({ total: 15, due: 12, random: 3 });
  });
  it("due=12, slot=15 → 12 due + 3 random", () => {
    expect(compose(12, 15)).toEqual({ total: 15, due: 12, random: 3 });
  });
  it("due=5, slot=15 → 5 due + 10 random", () => {
    expect(compose(5, 15)).toEqual({ total: 15, due: 5, random: 10 });
  });
  it("due=0, slot=15 → 15 random", () => {
    expect(compose(0, 15)).toEqual({ total: 15, due: 0, random: 15 });
  });
});

describe("buildSession invariants", () => {
  it("never repeats a word within a session", () => {
    const deck = makeDeck(60, "2026-08-01");
    const items = buildSession(deck, 20, { now: NOW, rng: seededRng(7) });
    expect(new Set(items.map((i) => i.word.id)).size).toBe(items.length);
  });
  it("draws the most-overdue cards into the due pool", () => {
    const deck = [
      makeWord({ id: "old", due_date: "2026-08-01" }),
      makeWord({ id: "mid", due_date: "2026-08-25" }),
      makeWord({ id: "recent", due_date: "2026-09-02" }),
      ...makeDeck(10, "2026-12-31"),
    ];
    // slot 2 → dueCount = min(4, floor(1.6)) = 1, pool = ceil(1.5) = 2 (old, mid)
    const seen = new Set<string>();
    for (let s = 0; s < 40; s++) {
      const items = buildSession(deck, 2, { now: NOW, rng: seededRng(s) });
      items.filter((i) => i.source === "due").forEach((i) => seen.add(i.word.id));
    }
    expect(seen).toContain("old");
    expect(seen).toContain("mid");
    expect(seen.has("recent")).toBe(false);
  });
  it("caps at deck size when slot exceeds it", () => {
    const deck = makeDeck(4, "2026-08-01");
    const items = buildSession(deck, 20, { now: NOW, rng: seededRng(3) });
    expect(items.length).toBe(4);
  });
});

describe("buildPracticeSession (SPEC 3.6)", () => {
  it("prefers leftover due, never pulls not-yet-due", () => {
    const deck = [
      makeWord({ id: "seen1", due_date: "2026-08-01" }),
      makeWord({ id: "dueLeft", due_date: "2026-08-01" }),
      makeWord({ id: "future", due_date: "2027-01-01" }),
    ];
    const items = buildPracticeSession(deck, 5, ["seen1"], { now: NOW, rng: seededRng(1) });
    const ids = items.map((i) => i.word.id);
    expect(ids).toContain("dueLeft");
    expect(ids).toContain("seen1");
    expect(ids).not.toContain("future");
  });
});

describe("buildHardModeSession (SPEC 3.7)", () => {
  it("only level 4+ cards enter the pool", () => {
    const deck = [
      ...Array.from({ length: 6 }, (_, i) => makeWord({ id: `hi${i}`, level: 4 })),
      ...Array.from({ length: 6 }, (_, i) => makeWord({ id: `lo${i}`, level: 2 })),
    ];
    const items = buildHardModeSession(deck, 10, { rng: seededRng(2) });
    expect(items.every((i) => i.word.level >= 4)).toBe(true);
    expect(items.every((i) => i.source === "hardmode")).toBe(true);
  });
});

describe("dueCount", () => {
  it("counts overdue and due-today, not future", () => {
    const deck = [
      makeWord({ due_date: "2026-08-01" }),
      makeWord({ due_date: "2026-09-02" }),
      makeWord({ due_date: "2026-09-03" }),
    ];
    expect(dueCount(deck, "2026-09-02")).toBe(2);
  });
});
