import { lookupWord } from "./dictionary";
import { generateDistractors, generateSentences, suggestSpelling } from "./llm";
import type { GeneratedPackage } from "./types";

export type GenerateOutcome =
  | { status: "ok"; package: GeneratedPackage }
  | { status: "phrase" }
  | { status: "not_found"; word: string }
  | { status: "suggestion"; word: string; suggestion: string }
  | { status: "unavailable" };

const SINGLE_WORD = /^[a-z][a-z'-]*[a-z]$|^[a-z]$/;

export function normalizeInput(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Full pipeline (SPEC 1.1): validate → dictionary → 2× LLM → package. */
export async function generatePackage(raw: string): Promise<GenerateOutcome> {
  const word = normalizeInput(raw);

  if (/\s/.test(word)) return { status: "phrase" };
  if (!SINGLE_WORD.test(word)) {
    const suggestion = await suggestSpelling(word);
    return suggestion
      ? { status: "suggestion", word, suggestion }
      : { status: "not_found", word };
  }

  const lookup = await lookupWord(word);
  if (!lookup.ok) {
    if (lookup.reason === "unavailable") return { status: "unavailable" };
    const suggestion = await suggestSpelling(word);
    return suggestion
      ? { status: "suggestion", word, suggestion }
      : { status: "not_found", word };
  }

  const facts = lookup.facts;
  const llmInput = { word: facts.word, pos: facts.pos, definition: facts.definition };

  let sentences: GeneratedPackage["sentences"];
  let distractors: { distractor_defs: string[]; distractor_words: string[] };
  try {
    [sentences, distractors] = await Promise.all([
      generateSentences(llmInput),
      generateDistractors(llmInput),
    ]);
  } catch {
    return { status: "unavailable" };
  }

  return {
    status: "ok",
    package: {
      word: facts.word,
      phonetic: facts.phonetic,
      audio_url: facts.audio_url,
      pos: facts.pos,
      definition: facts.definition,
      origin: facts.origin,
      other_meanings: facts.other_meanings,
      sentences,
      distractor_defs: distractors.distractor_defs,
      distractor_words: distractors.distractor_words,
    },
  };
}
