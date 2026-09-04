import { describe, expect, it } from "vitest";
import { availableIndices, freshCount, poolSize } from "./sentencePool";
import type { Sentence } from "./types";

const s = (over: Partial<Sentence> = {}): Sentence => ({
  text: "t",
  form: "t",
  hide_count: 0,
  flagged: false,
  ...over,
});

describe("sentencePool", () => {
  it("poolSize counts only non-flagged sentences", () => {
    expect(poolSize([s(), s({ flagged: true }), s()])).toBe(2);
  });

  it("availableIndices drops flagged + hidden", () => {
    expect(availableIndices([s(), s({ flagged: true }), s(), s()], [2])).toEqual([0, 3]);
  });

  it("freshCount = available sentences with usage 0", () => {
    // idx 0,1,2,3; flag 1; hide 3; usage [2,0,0,0] → available 0,2 → fresh (usage 0) = just 2
    expect(freshCount([s(), s({ flagged: true }), s(), s()], [2, 0, 0, 0], [3])).toBe(1);
  });

  it("freshCount treats a short usage array as zeros", () => {
    expect(freshCount([s(), s(), s()], [], [])).toBe(3);
  });
});
