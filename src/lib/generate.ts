import { lookupWord } from "./dictionary";
import { generateDistractors, generateSentences, suggestSpelling } from "./llm";
import type { GeneratedPackage } from "./types";

/** Progress ticks streamed to the Add-word screen. */
export type GenStage = "lookup" | "sentences" | "distractors";

export type GenerateResult =
  | { status: "ok"; package: GeneratedPackage }
  | { status: "phrase" }
  | { status: "not_found"; word: string }
  | { status: "suggestion"; word: string; suggestion: string }
  | { status: "error"; detail: string };

const SINGLE_WORD = /^[a-z][a-z'-]*[a-z]$|^[a-z]$/;

export function normalizeInput(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Turn any thrown value into a short, safe-to-show message (with an HTTP status when present). */
export function errMessage(e: unknown): string {
  if (e && typeof e === "object") {
    const o = e as {
      status?: number;
      message?: string;
      error?: { error?: { message?: string } };
    };
    const m = o.error?.error?.message ?? o.message ?? String(e);
    return o.status ? `${o.status} — ${m}` : m;
  }
  return String(e);
}

/**
 * Full pipeline (SPEC 1.1): validate → dictionary → 2× LLM → package.
 * Emits a stage tick before each slow step so the UI can show progress.
 */
export async function runGenerate(
  raw: string,
  emit: (stage: GenStage) => void,
): Promise<GenerateResult> {
  const word = normalizeInput(raw);

  if (/\s/.test(word)) return { status: "phrase" };

  emit("lookup");

  if (!SINGLE_WORD.test(word)) {
    const suggestion = await suggestSpelling(word).catch(() => null);
    return suggestion
      ? { status: "suggestion", word, suggestion }
      : { status: "not_found", word };
  }

  let lookup;
  try {
    lookup = await lookupWord(word);
  } catch (e) {
    console.error("[generate] dictionary threw", e);
    return { status: "error", detail: `Dictionary lookup failed: ${errMessage(e)}` };
  }

  if (!lookup.ok) {
    if (lookup.reason === "unavailable") {
      return { status: "error", detail: "The dictionary service didn't respond. Try again." };
    }
    const suggestion = await suggestSpelling(word).catch(() => null);
    return suggestion
      ? { status: "suggestion", word, suggestion }
      : { status: "not_found", word };
  }

  const facts = lookup.facts;
  const input = { word: facts.word, pos: facts.pos, definition: facts.definition };

  let sentences: GeneratedPackage["sentences"];
  let distractors: { distractor_defs: string[]; distractor_words: string[] };
  try {
    emit("sentences");
    sentences = await generateSentences(input);
    emit("distractors");
    distractors = await generateDistractors(input);
  } catch (e) {
    console.error("[generate] model call failed", e);
    return { status: "error", detail: `The model call failed: ${errMessage(e)}` };
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
