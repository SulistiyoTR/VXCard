/** Domain types shared across the app. Field names mirror the DB columns (SPEC §5). */

export interface Sentence {
  text: string;
  /** Inflected form of the target word used in this sentence (e.g. "relegated"). */
  form: string;
  /** How many distinct users have hidden this sentence (global consensus signal). */
  hide_count: number;
  /** Retired from every user's pool once hide_count hits FLAG_THRESHOLD. */
  flagged: boolean;
}

export interface Meaning {
  pos: string;
  definition: string;
}

/**
 * Shared word content — the `words` table (SPEC 5.1). No `user_id`: one row per
 * word globally. The client treats this as a read-only cache; every write goes
 * through the backend.
 */
export interface WordContent {
  id: string;
  word: string;
  created_at: string;
  /** Bumped by the DB trigger on every content change; drives sync cache-refresh. */
  updated_at: string;

  phonetic: string | null;
  audio_url: string | null;
  pos: string;
  definition: string;
  origin: string | null;
  other_meanings: Meaning[];

  /** Append-only (SPEC 1.6). `sentence_usage` indexes into this by position. */
  sentences: Sentence[];
  distractor_defs: string[];
  distractor_words: string[];

  status: "dictionary_only" | "complete";
  pool_full: boolean;
}

/**
 * Per-user learning state — the `user_cards` table (SPEC 5.2). One row per
 * (user, word). `updated_at` is set by the client and preserved on sync (LWW).
 */
export interface UserCard {
  id: string;
  user_id: string;
  word_id: string;

  /** 1–4 in progress, 5 = finished (SPEC 2.3). */
  level: number;
  streak: number;
  /** ISO date (YYYY-MM-DD). */
  due_date: string;
  lapse_count: number;
  /** ISO date; anti-duplicate marker within a session. */
  last_seen_date: string | null;

  /** Parallel to `WordContent.sentences` by index; missing entries read as 0. */
  sentence_usage: number[];
  /** Indices this user has hidden via "Change this sentence". */
  hidden_sentences: number[];

  /** Total reviews of this card — denormalised so Word detail works offline. */
  review_count: number;

  created_at: string;
  /** ISO timestamp; drives last-write-wins sync (SPEC 6.4). */
  updated_at: string;
}

/**
 * Joined view of `WordContent` + `UserCard` that every screen consumes via
 * `useAppData().deck`. `id` is the word/content id (= `UserCard.word_id`);
 * scheduling fields come from the card.
 */
export interface Word {
  id: string;
  word: string;
  /** Card creation time ("when I added it") — used for the Newest sort. */
  created_at: string;
  /** Card `updated_at` — the LWW target for local edits. */
  updated_at: string;

  phonetic: string | null;
  audio_url: string | null;
  pos: string;
  definition: string;
  origin: string | null;
  other_meanings: Meaning[];

  sentences: Sentence[];
  distractor_defs: string[];
  distractor_words: string[];
  status: WordContent["status"];
  pool_full: boolean;

  level: number;
  streak: number;
  due_date: string;
  lapse_count: number;
  last_seen_date: string | null;
  sentence_usage: number[];
  hidden_sentences: number[];
  review_count: number;
}

/** The `Word` fields that live on `user_cards` (everything else is content). */
export const CARD_FIELDS = [
  "level",
  "streak",
  "due_date",
  "lapse_count",
  "last_seen_date",
  "sentence_usage",
  "hidden_sentences",
  "review_count",
] as const satisfies readonly (keyof UserCard & keyof Word)[];

export interface SessionRow {
  id: string;
  started_at: string;
  finished_at: string | null;
  completed: boolean;
  planned: number;
  answered: number;
  source: ReviewSource | "mixed";
  updated_at: string;
}

export type ReviewResult = "correct" | "slow" | "wrong" | "dontknow";
export type ReviewSource = "due" | "random" | "practice" | "hardmode";

export interface Review {
  id?: string;
  user_id?: string;
  word_id: string;
  reviewed_at: string;
  level: number;
  result: ReviewResult;
  duration_ms: number;
  help_used: number;
  source: ReviewSource;
}

/** The mutable scheduling state of a card — the slice `updateCard` operates on. */
export interface CardState {
  level: number;
  streak: number;
  due_date: string;
  lapse_count: number;
}

export interface SessionItem {
  word: Word;
  source: ReviewSource;
}
