"use server";

import { requireUser } from "@/lib/data";
import { generateSentences } from "@/lib/llm";
import { createClient } from "@/lib/supabase/server";
import type { Sentence } from "@/lib/types";

interface SentenceSubject {
  word: string;
  pos: string;
  definition: string;
}

/**
 * Regenerate one example sentence. Online-only (LLM).
 *
 * TODO(Sesi 4/6): the per-sentence ✎ becomes "hide for this user + bump the
 * global hide_count" and no longer calls the model. Kept here so the current
 * screens compile; the shared `words` pool is append-only, so a caller can no
 * longer overwrite a sentence in place.
 */
export async function regenerateSentence(subject: SentenceSubject): Promise<Sentence> {
  await requireUser();
  const fresh = await generateSentences(subject);
  return fresh[0];
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
