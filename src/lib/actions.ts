"use server";

import { revalidatePath } from "next/cache";
import { CONFIG } from "@/lib/config";
import { addDays, today } from "@/lib/date";
import { requireUser } from "@/lib/data";
import { generateSentences } from "@/lib/llm";
import { getMonthActivity, type CalendarDay } from "@/lib/stats";
import { createClient } from "@/lib/supabase/server";
import type { GeneratedPackage, Review, ReviewSource, Sentence } from "@/lib/types";

/** Persist a generated package as a new card (SPEC 4.3). */
export async function addWord(pkg: GeneratedPackage): Promise<{ id: string }> {
  const supabase = await createClient();
  const user = await requireUser();

  const { count } = await supabase
    .from("words")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString());
  if ((count ?? 0) >= CONFIG.DAILY_NEW_WORD_LIMIT) {
    throw new Error(`Daily limit of ${CONFIG.DAILY_NEW_WORD_LIMIT} new words reached.`);
  }

  const { data, error } = await supabase
    .from("words")
    .insert({
      user_id: user.id,
      word: pkg.word,
      phonetic: pkg.phonetic,
      audio_url: pkg.audio_url,
      pos: pkg.pos,
      definition: pkg.definition,
      origin: pkg.origin,
      other_meanings: pkg.other_meanings,
      sentences: pkg.sentences,
      distractor_defs: pkg.distractor_defs,
      distractor_words: pkg.distractor_words,
      level: 1,
      streak: 0,
      due_date: addDays(today(), 1),
      lapse_count: 0,
    })
    .select("id")
    .single();
  if (error) throw error;

  revalidatePath("/");
  revalidatePath("/words");
  return { id: data.id as string };
}

export interface AnswerPayload {
  review: Omit<Review, "id" | "user_id" | "reviewed_at">;
  card: {
    id: string;
    level: number;
    streak: number;
    due_date: string;
    lapse_count: number;
  };
  /** Index of the example sentence that was shown, to bump used_count (SPEC 1.6). */
  sentenceShownIndex?: number;
}

/**
 * Background write of one answer (SPEC 5.5): insert the review, patch the card,
 * bump the shown sentence's used_count. Client retries on failure.
 */
export async function submitAnswer(payload: AnswerPayload): Promise<void> {
  const supabase = await createClient();
  const user = await requireUser();

  const { review, card, sentenceShownIndex } = payload;

  await supabase.from("reviews").insert({
    user_id: user.id,
    word_id: review.word_id,
    level: review.level,
    result: review.result,
    duration_ms: review.duration_ms,
    help_used: review.help_used,
    source: review.source,
    reviewed_at: new Date().toISOString(),
  });

  let sentences: Sentence[] | undefined;
  if (sentenceShownIndex !== undefined) {
    const { data } = await supabase
      .from("words")
      .select("sentences")
      .eq("id", card.id)
      .eq("user_id", user.id)
      .maybeSingle();
    const current = (data?.sentences ?? []) as Sentence[];
    if (current[sentenceShownIndex]) {
      current[sentenceShownIndex] = {
        ...current[sentenceShownIndex],
        used_count: current[sentenceShownIndex].used_count + 1,
      };
      sentences = current;
    }
  }

  await supabase
    .from("words")
    .update({
      level: card.level,
      streak: card.streak,
      due_date: card.due_date,
      lapse_count: card.lapse_count,
      last_seen_date: today(),
      ...(sentences ? { sentences } : {}),
    })
    .eq("id", card.id)
    .eq("user_id", user.id);
}

export async function createSession(planned: number, source: ReviewSource | "mixed"): Promise<string> {
  const supabase = await createClient();
  const user = await requireUser();
  const { data, error } = await supabase
    .from("sessions")
    .insert({ user_id: user.id, planned, source })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function finishSession(
  id: string,
  opts: { answered: number; completed: boolean },
): Promise<void> {
  const supabase = await createClient();
  const user = await requireUser();
  await supabase
    .from("sessions")
    .update({
      answered: opts.answered,
      completed: opts.completed,
      finished_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id);
  revalidatePath("/");
  revalidatePath("/stats");
}

export async function deleteWord(id: string): Promise<void> {
  const supabase = await createClient();
  const user = await requireUser();
  await supabase.from("words").delete().eq("id", id).eq("user_id", user.id);
  revalidatePath("/words");
  revalidatePath("/");
}

/** Reset progress — back to L1, streak 0, due tomorrow (SPEC 4.9). */
export async function resetWord(id: string): Promise<void> {
  const supabase = await createClient();
  const user = await requireUser();
  await supabase
    .from("words")
    .update({ level: 1, streak: 0, lapse_count: 0, due_date: addDays(today(), 1) })
    .eq("id", id)
    .eq("user_id", user.id);
  revalidatePath("/words");
  revalidatePath(`/words/${id}`);
}

/** Regenerate a single example sentence (SPEC 1.6). */
export async function regenerateSentence(wordId: string, index: number): Promise<Sentence> {
  const supabase = await createClient();
  const user = await requireUser();
  const { data } = await supabase
    .from("words")
    .select("word, pos, definition, sentences")
    .eq("id", wordId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data) throw new Error("Word not found");

  const fresh = await generateSentences({
    word: data.word as string,
    pos: data.pos as string,
    definition: data.definition as string,
  });
  const replacement: Sentence = { ...fresh[0], used_count: 0 };

  const sentences = [...((data.sentences ?? []) as Sentence[])];
  sentences[index] = replacement;
  await supabase.from("words").update({ sentences }).eq("id", wordId).eq("user_id", user.id);

  revalidatePath(`/words/${wordId}`);
  return replacement;
}

/** Bulk sentence refresh for cards with a stale sentence (SPEC 1.6). */
export async function refreshStaleSentences(): Promise<{ refreshed: number }> {
  const supabase = await createClient();
  const user = await requireUser();
  const { data } = await supabase
    .from("words")
    .select("id, word, pos, definition, sentences")
    .eq("user_id", user.id);

  const stale = ((data ?? []) as {
    id: string;
    word: string;
    pos: string;
    definition: string;
    sentences: Sentence[];
  }[])
    .filter((w) => (w.sentences ?? []).some((s) => s.used_count >= CONFIG.REFRESH_THRESHOLD))
    .slice(0, CONFIG.REFRESH_BATCH_MAX);

  let refreshed = 0;
  for (const w of stale) {
    try {
      const fresh = await generateSentences({ word: w.word, pos: w.pos, definition: w.definition });
      await supabase
        .from("words")
        .update({ sentences: fresh })
        .eq("id", w.id)
        .eq("user_id", user.id);
      refreshed += 1;
    } catch {
      // skip and continue
    }
  }

  revalidatePath("/stats");
  return { refreshed };
}

export async function calendarMonth(
  month: string,
): Promise<{ days: CalendarDay[]; firstEverMonth: string | null }> {
  await requireUser();
  return getMonthActivity(month);
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
