import type { Word } from "./types";

let n = 0;

export function makeWord(over: Partial<Word> = {}): Word {
  n += 1;
  return {
    id: over.id ?? `w${n}`,
    user_id: "u1",
    word: over.word ?? `word${n}`,
    created_at: "2026-09-01T00:00:00Z",
    phonetic: null,
    audio_url: null,
    pos: over.pos ?? "noun",
    definition: over.definition ?? `definition ${n}`,
    origin: null,
    other_meanings: [],
    sentences: over.sentences ?? [
      { text: `A sentence using word${n} in the middle of it here.`, form: `word${n}`, used_count: 0 },
    ],
    distractor_defs: over.distractor_defs ?? ["dd1", "dd2", "dd3", "dd4", "dd5", "dd6"],
    distractor_words: over.distractor_words ?? ["dw1", "dw2", "dw3", "dw4", "dw5", "dw6"],
    level: over.level ?? 1,
    streak: over.streak ?? 0,
    due_date: over.due_date ?? "2026-09-02",
    lapse_count: 0,
    last_seen_date: null,
    ...over,
  };
}

/** Build a deck of `count` words all due on `dueDate`. */
export function makeDeck(count: number, dueDate = "2026-09-01"): Word[] {
  return Array.from({ length: count }, (_, i) =>
    makeWord({ id: `d${i}`, word: `deckword${i}`, due_date: dueDate }),
  );
}
