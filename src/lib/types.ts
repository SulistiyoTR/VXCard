/** Domain types shared across the app. Field names mirror the DB columns (SPEC §5). */

export interface Sentence {
  text: string;
  /** Inflected form of the target word used in this sentence (e.g. "relegated"). */
  form: string;
  used_count: number;
}

export interface Meaning {
  pos: string;
  definition: string;
}

export interface Word {
  id: string;
  user_id: string;
  word: string;
  created_at: string;

  phonetic: string | null;
  audio_url: string | null;
  pos: string;
  definition: string;
  origin: string | null;
  other_meanings: Meaning[];

  sentences: Sentence[];
  distractor_defs: string[];
  distractor_words: string[];

  /** 1–4 in progress, 5 = finished (SPEC 2.3). */
  level: number;
  streak: number;
  /** ISO date (YYYY-MM-DD). */
  due_date: string;
  lapse_count: number;
  /** ISO date; anti-duplicate marker within a session. */
  last_seen_date: string | null;
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

/** What the LLM + dictionary pipeline produces before a card is persisted (SPEC 1.4). */
export interface GeneratedPackage {
  word: string;
  phonetic: string | null;
  audio_url: string | null;
  pos: string;
  definition: string;
  origin: string | null;
  other_meanings: Meaning[];
  sentences: Sentence[];
  distractor_defs: string[];
  distractor_words: string[];
}
