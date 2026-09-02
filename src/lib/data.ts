import "server-only";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { SessionRow, Word } from "@/lib/types";

export interface WordRow {
  id: string;
  user_id: string;
  word: string;
  created_at: string;
  updated_at: string;
  phonetic: string | null;
  audio_url: string | null;
  pos: string;
  definition: string;
  origin: string | null;
  other_meanings: Word["other_meanings"];
  sentences: Word["sentences"];
  distractor_defs: string[];
  distractor_words: string[];
  level: number;
  streak: number;
  due_date: string;
  lapse_count: number;
  review_count: number;
  last_seen_date: string | null;
}

export function rowToWord(r: WordRow): Word {
  return {
    id: r.id,
    user_id: r.user_id,
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
    level: r.level,
    streak: r.streak,
    due_date: r.due_date,
    lapse_count: r.lapse_count,
    review_count: r.review_count ?? 0,
    last_seen_date: r.last_seen_date,
  };
}

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

export async function requireUser(): Promise<User> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user;
}

/** Full deck — used for the first-paint snapshot and the sync endpoint. */
export async function getDeck(): Promise<Word[]> {
  const supabase = await createClient();
  const user = await requireUser();
  const { data, error } = await supabase
    .from("words")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as WordRow[]).map(rowToWord);
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
