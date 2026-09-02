"use server";

import { CONFIG } from "@/lib/config";
import { requireUser } from "@/lib/data";
import { generateSentences } from "@/lib/llm";
import { createClient } from "@/lib/supabase/server";
import type { Sentence } from "@/lib/types";

interface SentenceSubject {
  id: string;
  word: string;
  pos: string;
  definition: string;
}

/**
 * Regenerate one example sentence (SPEC 1.6). Online-only (LLM). The caller
 * applies the result to its local card, which then syncs.
 */
export async function regenerateSentence(subject: Omit<SentenceSubject, "id">): Promise<Sentence> {
  await requireUser();
  const fresh = await generateSentences(subject);
  return { ...fresh[0], used_count: 0 };
}

/**
 * Bulk sentence refresh (SPEC 1.6). Online-only. Returns fresh sentence sets
 * keyed by word id; the caller patches each card locally.
 */
export async function refreshSentences(
  subjects: SentenceSubject[],
): Promise<{ id: string; sentences: Sentence[] }[]> {
  await requireUser();
  const batch = subjects.slice(0, CONFIG.REFRESH_BATCH_MAX);
  const out: { id: string; sentences: Sentence[] }[] = [];
  for (const s of batch) {
    try {
      const sentences = await generateSentences({
        word: s.word,
        pos: s.pos,
        definition: s.definition,
      });
      out.push({ id: s.id, sentences });
    } catch {
      // skip this one
    }
  }
  return out;
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
