import type { UserCard, Word, WordContent } from "@/lib/types";

/**
 * Pure join/split helpers between the shared `words` content and the per-user
 * `user_cards` state. No React, no IndexedDB — safe to use on the server too.
 */

/** Merge shared content + per-user card into the view every screen consumes. */
export function joinWord(content: WordContent, card: UserCard): Word {
  return {
    id: content.id,
    word: content.word,
    created_at: card.created_at,
    updated_at: card.updated_at,
    phonetic: content.phonetic,
    audio_url: content.audio_url,
    pos: content.pos,
    definition: content.definition,
    origin: content.origin,
    other_meanings: content.other_meanings ?? [],
    sentences: content.sentences ?? [],
    distractor_defs: content.distractor_defs ?? [],
    distractor_words: content.distractor_words ?? [],
    status: content.status,
    pool_full: content.pool_full,
    level: card.level,
    streak: card.streak,
    due_date: card.due_date,
    lapse_count: card.lapse_count,
    last_seen_date: card.last_seen_date,
    sentence_usage: card.sentence_usage ?? [],
    hidden_sentences: card.hidden_sentences ?? [],
    review_count: card.review_count ?? 0,
  };
}

/** Split a joined `Word` back into its two rows (first-run seed / Add flow). */
export function splitWord(w: Word): { content: WordContent; card: UserCard } {
  const now = new Date().toISOString();
  return {
    content: {
      id: w.id,
      word: w.word,
      created_at: w.created_at,
      updated_at: w.updated_at,
      phonetic: w.phonetic,
      audio_url: w.audio_url,
      pos: w.pos,
      definition: w.definition,
      origin: w.origin,
      other_meanings: w.other_meanings,
      sentences: w.sentences,
      distractor_defs: w.distractor_defs,
      distractor_words: w.distractor_words,
      status: w.status,
      pool_full: w.pool_full,
    },
    card: {
      id: crypto.randomUUID(),
      user_id: "", // filled by the sync POST
      word_id: w.id,
      level: w.level,
      streak: w.streak,
      due_date: w.due_date,
      lapse_count: w.lapse_count,
      last_seen_date: w.last_seen_date,
      sentence_usage: w.sentence_usage ?? [],
      hidden_sentences: w.hidden_sentences ?? [],
      review_count: w.review_count ?? 0,
      created_at: w.created_at || now,
      updated_at: w.updated_at || now,
    },
  };
}
