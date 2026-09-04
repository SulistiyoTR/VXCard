import { CONFIG } from "./config";
import { pick, shuffle, type Rng } from "./random";
import type { Sentence, Word } from "./types";

export type QuizLevel = 1 | 2 | 3 | 4;

export interface Question {
  wordId: string;
  level: QuizLevel;
  /** Prompt shown above the options. */
  prompt: string;
  /** For cloze levels, the sentence with the target blanked. */
  sentence?: string;
  /** Multiple-choice options (levels 1–3). Empty for level 4 (typed). */
  options: string[];
  /** The correct option / spelling. */
  answer: string;
  /** Index in `sentences` that was shown, so the caller can bump `sentence_usage`. */
  sentenceIndex?: number;
}

/** Level a card's `level` maps to for quiz purposes (5 → practised as 4). */
export function quizLevel(level: number): QuizLevel {
  return Math.min(4, Math.max(1, level)) as QuizLevel;
}

/**
 * Rotate example sentences (SPEC 1.6): skip flagged/hidden ones, then pick the
 * one this user has seen least; ties broken at random. `usage` is the per-user
 * `sentence_usage` array (parallel to `sentences`; missing entries read as 0).
 */
export function pickSentence(
  sentences: readonly Sentence[],
  usage: readonly number[] = [],
  hidden: readonly number[] = [],
  rng: Rng = Math.random,
): { sentence: Sentence; index: number } | null {
  if (sentences.length === 0) return null;
  const hiddenSet = new Set(hidden);
  const available = sentences
    .map((s, i) => ({ s, i }))
    .filter(({ s, i }) => !s.flagged && !hiddenSet.has(i));
  const pool = available.length > 0 ? available : sentences.map((s, i) => ({ s, i }));
  const use = (i: number) => usage[i] ?? 0;
  const min = Math.min(...pool.map(({ i }) => use(i)));
  const candidates = pool.filter(({ i }) => use(i) === min);
  const chosen = candidates[Math.floor(rng() * candidates.length)];
  return { sentence: chosen.s, index: chosen.i };
}

function blank(text: string, form: string): string {
  const re = new RegExp(`\\b${escapeRegExp(form)}\\b`, "i");
  return text.replace(re, "______");
}

/**
 * Deck-sourced distractors for levels 3 & 4 (SPEC 2.4): other words with the
 * same POS. Falls back to the card's own `distractor_words` when fewer than 3.
 */
export function deckDistractors(
  word: Word,
  deck: readonly Word[],
  targetForm: string,
  rng: Rng = Math.random,
): string[] {
  const sameP = deck.filter((w) => w.id !== word.id && w.pos === word.pos);
  let picks = pick(sameP, 3, rng).map((w) => inflectLike(w.word, word.word, targetForm));
  if (picks.length < 3) {
    const extra = pick(word.distractor_words, 3 - picks.length, rng);
    picks = [...picks, ...extra];
  }
  return picks.slice(0, 3);
}

/** Build the question for a card at a given quiz level. */
export function buildQuestion(
  word: Word,
  level: QuizLevel,
  deck: readonly Word[],
  rng: Rng = Math.random,
): Question {
  if (level === 1) {
    const distractors = pick(word.distractor_defs, 3, rng);
    return {
      wordId: word.id,
      level,
      prompt: word.word,
      options: shuffle([word.definition, ...distractors], rng),
      answer: word.definition,
    };
  }
  if (level === 2) {
    const distractors = pick(word.distractor_words, 3, rng);
    return {
      wordId: word.id,
      level,
      prompt: word.definition,
      options: shuffle([word.word, ...distractors], rng),
      answer: word.word,
    };
  }

  // Levels 3 & 4 — cloze
  const picked = pickSentence(word.sentences, word.sentence_usage, word.hidden_sentences, rng);
  const sentenceText = picked?.sentence.text ?? word.definition;
  const form = picked?.sentence.form ?? word.word;
  const sentence = picked ? blank(sentenceText, form) : sentenceText;

  if (level === 3) {
    const distractors = deckDistractors(word, deck, form, rng);
    return {
      wordId: word.id,
      level,
      prompt: "Fill the blank",
      sentence,
      options: shuffle([form, ...distractors], rng),
      answer: form,
      sentenceIndex: picked?.index,
    };
  }
  return {
    wordId: word.id,
    level: 4,
    prompt: "Type the word",
    sentence,
    options: [],
    answer: word.word,
    sentenceIndex: picked?.index,
  };
}

/** Levenshtein distance capped at 2 (we only care about <= 1). */
export function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (Math.abs(m - n) > 1) return 2;
  const prev = new Array(n + 1).fill(0).map((_, i) => i);
  for (let i = 1; i <= m; i++) {
    const curr = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return Math.min(2, prev[n]);
}

export type MatchVerdict = "exact" | "almost" | "wrong";

/** Level-4 fuzzy match (SPEC 2.6): a one-letter typo still counts. */
export function matchTyped(input: string, answer: string): MatchVerdict {
  const a = input.trim().toLowerCase();
  const b = answer.trim().toLowerCase();
  if (a === b) return "exact";
  if (a.length > 0 && editDistance(a, b) <= 1) return "almost";
  return "wrong";
}

/** How many hints this word gets (SPEC 2.6). */
export function hintBudget(word: string): number {
  return word.length < CONFIG.SHORT_WORD_LEN ? CONFIG.HINT_COUNT_SHORT : CONFIG.HINT_COUNT;
}

/**
 * Choose a letter position to reveal (SPEC 2.6): never the first, last, or an
 * already-revealed position. Returns -1 when nothing is left to reveal.
 */
export function nextHintPosition(
  word: string,
  revealed: readonly number[],
  rng: Rng = Math.random,
): number {
  const taken = new Set(revealed);
  const eligible: number[] = [];
  for (let i = 1; i < word.length - 1; i++) {
    if (!taken.has(i)) eligible.push(i);
  }
  if (eligible.length === 0) return -1;
  return eligible[Math.floor(rng() * eligible.length)];
}

/** Render the hint mask, e.g. `e _ _ l _ _ _ _ _ e`. */
export function hintMask(word: string, revealed: readonly number[]): string {
  const shown = new Set([0, word.length - 1, ...revealed]);
  return word
    .split("")
    .map((ch, i) => (shown.has(i) ? ch : "_"))
    .join(" ");
}

/**
 * Best-effort morphology: copy the inflection pattern of `targetForm`
 * (relative to `targetBase`) onto `distractorBase` (SPEC 2.4). Heuristic only.
 */
export function inflectLike(distractorBase: string, targetBase: string, targetForm: string): string {
  const base = targetBase.toLowerCase();
  const form = targetForm.toLowerCase();
  if (form === base) return distractorBase;
  for (const suffix of ["ing", "ed", "es", "s", "d"]) {
    if (form === base + suffix) return distractorBase + suffix;
    // consonant-doubling / drop-e variants
    if (form === base.slice(0, -1) + suffix) return distractorBase.slice(0, -1) + suffix;
    if (form === base + base.slice(-1) + suffix) return distractorBase + distractorBase.slice(-1) + suffix;
  }
  return distractorBase;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
