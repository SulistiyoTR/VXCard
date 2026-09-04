import "server-only";
import { CONFIG } from "@/lib/config";
import { contentRowToContent, type WordContentRow } from "@/lib/data";
import { lookupWord } from "@/lib/dictionary";
import { errMessage, normalizeInput, SINGLE_WORD } from "@/lib/generate";
import { generateDistractors, generateSentences, suggestSpelling } from "@/lib/llm";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Sentence, WordContent } from "@/lib/types";

/**
 * Add-word server flow (SPEC 1.1 / UPDATE-PLAN Sesi 3).
 *
 *  search:  normalise → check the shared `words` table → only call Merriam-Webster
 *           (rate-limited, counter bumped first) when the word is genuinely new,
 *           then store the dictionary facts as `dictionary_only`. No LLM here.
 *  complete: run on Save — 2 LLM calls, append sentences + distractors, flip
 *           status to `complete`. Cancelling never reaches this, so the dictionary
 *           row is kept at zero LLM cost.
 *
 * All writes use the service-role client (shared `words` is backend-write-only).
 */

export type SearchResult =
  | { status: "ok"; content: WordContent }
  | { status: "duplicate"; word: { id: string; word: string; level: number; due_date: string } }
  | { status: "suggestion"; word: string; suggestion: string }
  | { status: "not_found"; word: string }
  | { status: "phrase" }
  | { status: "rate_limited"; limit: number }
  | { status: "error"; detail: string };

export type CompleteResult =
  | { status: "ok"; content: WordContent }
  | { status: "error"; detail: string };

type Admin = ReturnType<typeof createAdminClient>;

async function findByWord(admin: Admin, word: string): Promise<WordContentRow | null> {
  const { data } = await admin.from("words").select("*").eq("word", word).maybeSingle();
  return (data as WordContentRow | null) ?? null;
}

async function userCard(
  admin: Admin,
  userId: string,
  wordId: string,
): Promise<{ level: number; due_date: string } | null> {
  const { data } = await admin
    .from("user_cards")
    .select("level, due_date")
    .eq("user_id", userId)
    .eq("word_id", wordId)
    .maybeSingle();
  return (data as { level: number; due_date: string } | null) ?? null;
}

/** `row` that the user doesn't yet have → ok; that they do → duplicate. */
async function previewOrDuplicate(
  admin: Admin,
  userId: string,
  row: WordContentRow,
): Promise<SearchResult> {
  const dup = await userCard(admin, userId, row.id);
  if (dup) {
    return {
      status: "duplicate",
      word: { id: row.id, word: row.word, level: dup.level, due_date: dup.due_date },
    };
  }
  return { status: "ok", content: contentRowToContent(row) };
}

export async function searchWord(rawInput: string, userId: string): Promise<SearchResult> {
  const word = normalizeInput(rawInput);
  if (!word) return { status: "not_found", word };
  if (/\s/.test(word)) return { status: "phrase" };

  const admin = createAdminClient();

  if (!SINGLE_WORD.test(word)) {
    const suggestion = await suggestSpelling(word).catch(() => null);
    return suggestion ? { status: "suggestion", word, suggestion } : { status: "not_found", word };
  }

  // 1. Already in the shared table? (zero API, zero LLM — for both statuses)
  const existing = await findByWord(admin, word);
  if (existing) return previewOrDuplicate(admin, userId, existing);

  // 2. New word — this needs Merriam-Webster. Check the daily cap, then bump the
  //    counter *before* the call so a failed/timed-out request still counts.
  const day = new Date().toISOString().slice(0, 10);
  const { data: usage } = await admin
    .from("mw_lookups")
    .select("count")
    .eq("user_id", userId)
    .eq("day", day)
    .maybeSingle();
  if ((usage?.count ?? 0) >= CONFIG.DAILY_NEW_WORD_LIMIT) {
    return { status: "rate_limited", limit: CONFIG.DAILY_NEW_WORD_LIMIT };
  }
  await admin.rpc("increment_mw_lookup", { p_user_id: userId, p_day: day });

  let lookup;
  try {
    lookup = await lookupWord(word);
  } catch (e) {
    return { status: "error", detail: `Dictionary lookup failed: ${errMessage(e)}` };
  }

  if (!lookup.ok) {
    if (lookup.reason === "unavailable") {
      return { status: "error", detail: "The dictionary didn't respond. Try again." };
    }
    const suggestion = lookup.suggestion ?? (await suggestSpelling(word).catch(() => null));
    return suggestion ? { status: "suggestion", word, suggestion } : { status: "not_found", word };
  }

  const facts = lookup.facts;

  // MW may canonicalise ("running" → "run") — reuse the row for the canonical form.
  if (facts.word !== word) {
    const canonical = await findByWord(admin, facts.word);
    if (canonical) return previewOrDuplicate(admin, userId, canonical);
  }

  // 3. Store the dictionary facts. No LLM — sentences/distractors stay empty.
  const { data: inserted, error } = await admin
    .from("words")
    .insert({
      word: facts.word,
      phonetic: facts.phonetic,
      audio_url: facts.audio_url,
      pos: facts.pos,
      definition: facts.definition,
      origin: facts.origin,
      other_meanings: facts.other_meanings,
      sentences: [],
      distractor_defs: null,
      distractor_words: null,
      status: "dictionary_only",
      pool_full: false,
    })
    .select("*")
    .single();

  if (error) {
    // Lost the race on the unique `word` — return the winning row.
    const winner = await findByWord(admin, facts.word);
    if (winner) return previewOrDuplicate(admin, userId, winner);
    return { status: "error", detail: `Could not save the word: ${error.message}` };
  }
  return { status: "ok", content: contentRowToContent(inserted as WordContentRow) };
}

/**
 * Save step: fill in the LLM content for a `dictionary_only` word.
 *
 * Does ONE sub-step per call — sentences first, then distractors + flip to
 * `complete` — instead of both in one round trip. That's what lets the
 * client show real per-step progress (SPEC 1.1 / add-word "staged saving")
 * instead of a single static "Saving…" state: it calls this repeatedly,
 * driven by the returned `content.status`, until it comes back `complete`.
 * Idempotent either way: a word that's already complete comes straight back.
 */
export async function completeWord(wordId: string): Promise<CompleteResult> {
  const admin = createAdminClient();

  const { data: row } = await admin
    .from("words")
    .select("*")
    .eq("id", wordId)
    .maybeSingle();
  if (!row) return { status: "error", detail: "Word not found." };

  const current = contentRowToContent(row as WordContentRow);
  if (current.status === "complete") return { status: "ok", content: current };

  const input = { word: current.word, pos: current.pos, definition: current.definition };

  // Step 1: example sentences — only if not written yet.
  if (current.sentences.length === 0) {
    let sentences: Sentence[];
    try {
      sentences = await generateSentences(input);
    } catch (e) {
      return { status: "error", detail: `The model call failed: ${errMessage(e)}` };
    }
    const { data: updated, error } = await admin
      .from("words")
      .update({ sentences })
      .eq("id", wordId)
      .select("*")
      .maybeSingle();
    if (error) return { status: "error", detail: error.message };
    // Still `dictionary_only` — the caller makes one more call for distractors.
    return { status: "ok", content: contentRowToContent((updated ?? row) as WordContentRow) };
  }

  // Step 2: quiz distractors, then flip to complete.
  let distractors: { distractor_defs: string[]; distractor_words: string[] };
  try {
    distractors = await generateDistractors(input);
  } catch (e) {
    return { status: "error", detail: `The model call failed: ${errMessage(e)}` };
  }

  const { data: updated, error } = await admin
    .from("words")
    .update({
      distractor_defs: distractors.distractor_defs,
      distractor_words: distractors.distractor_words,
      status: "complete",
    })
    .eq("id", wordId)
    .eq("status", "dictionary_only") // no-op if another Save already completed it
    .select("*")
    .maybeSingle();

  if (error) return { status: "error", detail: error.message };
  if (updated) return { status: "ok", content: contentRowToContent(updated as WordContentRow) };

  // Someone else completed it first — return their version.
  const { data: fresh } = await admin
    .from("words")
    .select("*")
    .eq("id", wordId)
    .single();
  return { status: "ok", content: contentRowToContent(fresh as WordContentRow) };
}
