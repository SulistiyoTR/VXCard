import "server-only";
import { CONFIG } from "./config";
import { generateSentences } from "./llm";
import { freshCount, poolSize } from "./sentencePool";
import { createAdminClient } from "./supabase/admin";
import type { Sentence } from "./types";

/**
 * Sentence-pool auto-grow (SPEC 1.6 / UPDATE-PLAN Sesi 5). Runs in the background
 * after a quiz session's results screen is shown. Two sequential steps:
 *
 *   1. DEPOSIT — for each level 3-4 word from the session that still needs more
 *      sentences for this user (fresh < FRESH_THRESHOLD, pool not full), write a
 *      ticket. `sentence_requests.word_id` is UNIQUE, so a second deposit is a
 *      no-op.
 *   2. WORK — claim up to MAX_TICKETS_PER_SESSION idle tickets (FOR UPDATE SKIP
 *      LOCKED), generate a SENTENCE_BATCH for each, append, delete the ticket.
 *      Whoever runs this does the work — even for words not in their own deck.
 *
 * Deposit before work, in one pass. Failures are silent; a stuck ticket's lock
 * ages out after TICKET_TIMEOUT_MINUTES and the next run picks it up.
 */
export async function runTickets(
  userId: string,
  wordIds: string[],
): Promise<{ deposited: number; generated: number }> {
  const admin = createAdminClient();
  const ids = [...new Set(wordIds.filter(Boolean))].slice(0, 50);
  if (ids.length === 0) return { deposited: 0, generated: 0 };

  // ---------------------------------------------------------------- 1. DEPOSIT
  const [wordsRes, cardsRes] = await Promise.all([
    admin.from("words").select("id, sentences, pool_full").in("id", ids),
    admin
      .from("user_cards")
      .select("word_id, sentence_usage, hidden_sentences")
      .eq("user_id", userId)
      .in("word_id", ids),
  ]);

  const cardBy = new Map(
    (cardsRes.data ?? []).map((c) => [
      c.word_id as string,
      c as { sentence_usage: number[] | null; hidden_sentences: number[] | null },
    ]),
  );

  const toDeposit: string[] = [];
  for (const w of (wordsRes.data ?? []) as {
    id: string;
    sentences: Sentence[];
    pool_full: boolean;
  }[]) {
    if (w.pool_full || poolSize(w.sentences) >= CONFIG.MAX_SENTENCE_POOL) continue;
    const card = cardBy.get(w.id);
    const fresh = freshCount(
      w.sentences,
      card?.sentence_usage ?? [],
      card?.hidden_sentences ?? [],
    );
    if (fresh < CONFIG.FRESH_THRESHOLD) toDeposit.push(w.id);
  }

  if (toDeposit.length) {
    await admin
      .from("sentence_requests")
      .upsert(toDeposit.map((word_id) => ({ word_id })), {
        onConflict: "word_id",
        ignoreDuplicates: true,
      });
  }

  // ------------------------------------------------------------------- 2. WORK
  const { data: claimed } = await admin.rpc("claim_sentence_tickets", {
    max_tickets: CONFIG.MAX_TICKETS_PER_SESSION,
    timeout_minutes: CONFIG.TICKET_TIMEOUT_MINUTES,
  });

  let generated = 0;
  for (const { word_id } of (claimed ?? []) as { word_id: string }[]) {
    try {
      const { data: w } = await admin
        .from("words")
        .select("word, pos, definition, sentences, pool_full")
        .eq("id", word_id)
        .single();

      if (!w) {
        await admin.from("sentence_requests").delete().eq("word_id", word_id);
        continue;
      }

      const current = poolSize(w.sentences as Sentence[]);
      if (w.pool_full || current >= CONFIG.MAX_SENTENCE_POOL) {
        await admin.from("sentence_requests").delete().eq("word_id", word_id);
        continue;
      }

      const want = Math.min(CONFIG.SENTENCE_BATCH, CONFIG.MAX_SENTENCE_POOL - current);
      const fresh = await generateSentences(
        { word: w.word as string, pos: w.pos as string, definition: w.definition as string },
        { count: want, avoid: (w.sentences as Sentence[]).map((s) => s.text) },
      );
      if (fresh.length === 0) continue; // leave the ticket; a later run retries

      await admin.rpc("complete_sentence_ticket", {
        word_id,
        new_sentences: fresh,
        max_pool: CONFIG.MAX_SENTENCE_POOL,
      });
      generated += fresh.length;
    } catch {
      // leave the ticket locked; its lock ages out after TICKET_TIMEOUT_MINUTES
    }
  }

  return { deposited: toDeposit.length, generated };
}
