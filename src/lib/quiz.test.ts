import { describe, expect, it } from "vitest";
import {
  buildQuestion,
  deckDistractors,
  editDistance,
  hintBudget,
  hintMask,
  inflectLike,
  matchTyped,
  nextHintPosition,
  pickSentence,
} from "./quiz";
import { seededRng } from "./random";
import { makeWord } from "./testutil";

describe("buildQuestion", () => {
  it("level 1: word prompt, 4 options incl. the real definition", () => {
    const w = makeWord({ word: "explicable", definition: "able to be accounted for" });
    const q = buildQuestion(w, 1, [], seededRng(1));
    expect(q.prompt).toBe("explicable");
    expect(q.options).toHaveLength(4);
    expect(q.options).toContain("able to be accounted for");
    expect(q.answer).toBe("able to be accounted for");
  });
  it("level 2: definition prompt, options are words", () => {
    const w = makeWord({ word: "explicable", definition: "able to be accounted for" });
    const q = buildQuestion(w, 2, [], seededRng(1));
    expect(q.prompt).toBe("able to be accounted for");
    expect(q.options).toContain("explicable");
  });
  it("level 3: blanks the target in the sentence and offers 4 options", () => {
    const w = makeWord({
      word: "relegate",
      sentences: [{ text: "They relegated the team after a poor season here.", form: "relegated", used_count: 0 }],
    });
    const q = buildQuestion(w, 3, [], seededRng(1));
    expect(q.sentence).toContain("______");
    expect(q.sentence).not.toMatch(/relegated/i);
    expect(q.options).toContain("relegated");
  });
  it("level 4: no options, answer is the base word", () => {
    const w = makeWord({ word: "relegate" });
    const q = buildQuestion(w, 4, [], seededRng(1));
    expect(q.options).toHaveLength(0);
    expect(q.answer).toBe("relegate");
  });
});

describe("pickSentence (SPEC 1.6 rotation)", () => {
  it("returns the least-used sentence", () => {
    const sentences = [
      { text: "a", form: "x", used_count: 3 },
      { text: "b", form: "x", used_count: 1 },
      { text: "c", form: "x", used_count: 5 },
    ];
    expect(pickSentence(sentences, seededRng(1))?.index).toBe(1);
  });
});

describe("matchTyped (SPEC 2.6 fuzzy)", () => {
  it("exact match", () => expect(matchTyped("explicable", "explicable")).toBe("exact"));
  it("one-letter typo is 'almost'", () => {
    expect(matchTyped("explicible", "explicable")).toBe("almost");
    expect(matchTyped("explicabl", "explicable")).toBe("almost");
  });
  it("two errors is wrong", () => expect(matchTyped("explacible", "explicable")).toBe("wrong"));
  it("empty is wrong", () => expect(matchTyped("  ", "explicable")).toBe("wrong"));
});

describe("editDistance", () => {
  it("caps at 2", () => expect(editDistance("abcdef", "uvwxyz")).toBe(2));
  it("counts a single substitution", () => expect(editDistance("cat", "cot")).toBe(1));
});

describe("hints (SPEC 2.6)", () => {
  it("short words get 1 hint, longer words 2", () => {
    expect(hintBudget("cat")).toBe(1);
    expect(hintBudget("explicable")).toBe(2);
  });
  it("never reveals first or last letter", () => {
    const rng = seededRng(5);
    for (let i = 0; i < 50; i++) {
      const pos = nextHintPosition("explicable", [], rng);
      expect(pos).toBeGreaterThan(0);
      expect(pos).toBeLessThan("explicable".length - 1);
    }
  });
  it("does not re-reveal a taken position and returns -1 when exhausted", () => {
    const word = "abcd"; // eligible inner positions: 1, 2
    expect(nextHintPosition(word, [1, 2])).toBe(-1);
  });
  it("mask always shows first + last + revealed", () => {
    expect(hintMask("explicable", [3])).toBe("e _ _ l _ _ _ _ _ e");
  });
});

describe("deckDistractors (SPEC 2.4)", () => {
  it("pulls same-POS words from the deck, falls back when short", () => {
    const target = makeWord({ word: "relegate", pos: "verb" });
    const deck = [
      target,
      makeWord({ word: "delegate", pos: "verb" }),
      makeWord({ word: "renovate", pos: "verb" }),
      makeWord({ word: "table", pos: "noun" }),
    ];
    const d = deckDistractors(target, deck, "relegate", seededRng(1));
    expect(d).toHaveLength(3);
    expect(d).not.toContain("relegate");
  });
  it("falls back entirely to distractor_words with a bare deck", () => {
    const target = makeWord({ word: "relegate", pos: "verb", distractor_words: ["a", "b", "c", "d", "e", "f"] });
    const d = deckDistractors(target, [target], "relegate", seededRng(1));
    expect(d).toHaveLength(3);
  });
});

describe("inflectLike", () => {
  it("copies an -ed inflection", () => {
    expect(inflectLike("delegate", "relegate", "relegated")).toBe("delegated");
  });
  it("leaves the base alone when form == base", () => {
    expect(inflectLike("delegate", "relegate", "relegate")).toBe("delegate");
  });
});
