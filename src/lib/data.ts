import "server-only";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { joinWord } from "@/lib/store/shape";
import type { SessionRow, UserCard, Word, WordContent } from "@/lib/types";

/* ------------------------------------------------------------- word content */

export interface WordContentRow {
  id: string;
  word: string;
  created_at: string;
  updated_at: string;
  phonetic: string | null;
  audio_url: string | null;
  pos: string;
  definition: string;
  origin: string | null;
  other_meanings: WordContent["other_meanings"];
  sentences: WordContent["sentences"];
  distractor_defs: string[] | null;
  distractor_words: string[] | null;
  status: WordContent["status"];
  pool_full: boolean;
}

export function contentRowToContent(r: WordContentRow): WordContent {
  return {
    id: r.id,
    word: r.word,
    created_at: r.created_at,
    updated_at: r.updated_at,
    phonetic: r.phonetic,
    audio_url: r.audio_url,
    pos: r.pos,
    definition: r.definition,
    origin: r.origin,
    other_meanings: r.other_meanings ?? [],
    sentences: r.sentences ?? [],
    distractor_defs: r.distractor_defs ?? [],
    distractor_words: r.distractor_words ?? [],
    status: r.status,
    pool_full: r.pool_full,
  };
}

/* ---------------------------------------------------------------- user card */

export interface UserCardRow {
  id: string;
  user_id: string;
  word_id: string;
  level: number;
  streak: number;
  due_date: string;
  lapse_count: number;
  last_seen_date: string | null;
  sentence_usage: number[] | null;
  hidden_sentences: number[] | null;
  review_count: number;
  created_at: string;
  updated_at: string;
}

export function cardRowToCard(r: UserCardRow): UserCard {
  return {
    id: r.id,
    user_id: r.user_id,
    word_id: r.word_id,
    level: r.level,
    streak: r.streak,
    due_date: r.due_date,
    lapse_count: r.lapse_count,
    last_seen_date: r.last_seen_date,
    sentence_usage: r.sentence_usage ?? [],
    hidden_sentences: r.hidden_sentences ?? [],
    review_count: r.review_count ?? 0,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

/* ------------------------------------------------------------------ session */

export interface SessionDbRow {
  id: string;
  started_at: string;
  finished_at: string | null;
  completed: boolean;
  planned: number;
  answered: number;
  source: SessionRow["source"];
  updated_at: string;
}

export function rowToSession(r: SessionDbRow): SessionRow {
  return {
    id: r.id,
    started_at: r.started_at,
    finished_at: r.finished_at,
    completed: r.completed,
    planned: r.planned,
    answered: r.answered,
    source: r.source,
    updated_at: r.updated_at,
  };
}

/* -------------------------------------------------------------------- reads */

export async function requireUser(): Promise<User> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Full deck — the first-paint snapshot. Joins this user's `user_cards` to the
 * shared `words` content. Cards whose content is missing are skipped.
 */
export async function getDeck(): Promise<Word[]> {
  const supabase = await createClient();
  const user = await requireUser();

  const { data: cardRows, error } = await supabase
    .from("user_cards")
    .select("*")
    .eq("user_id", user.id);
  if (error) throw error;
  const cards = ((cardRows ?? []) as UserCardRow[]).map(cardRowToCard);
  if (cards.length === 0) return [];

  const wordIds = [...new Set(cards.map((c) => c.word_id))];
  const { data: contentRows, error: contentError } = await supabase
    .from("words")
    .select("*")
    .in("id", wordIds);
  if (contentError) throw contentError;
  const byId = new Map(
    ((contentRows ?? []) as WordContentRow[]).map((r) => [r.id, contentRowToContent(r)]),
  );

  return cards
    .map((card) => {
      const content = byId.get(card.word_id);
      return content ? joinWord(content, card) : null;
    })
    .filter((w): w is Word => w !== null)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getSessions(): Promise<SessionRow[]> {
  const supabase = await createClient();
  const user = await requireUser();
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("user_id", user.id)
    .order("started_at", { ascending: false });
  if (error) throw error;
  return (data as SessionDbRow[]).map(rowToSession);
}
