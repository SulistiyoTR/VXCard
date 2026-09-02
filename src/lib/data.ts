import "server-only";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { GeneratedPackage, Review, Word } from "@/lib/types";
import { addDays, today } from "@/lib/date";

export interface WordRow {
  id: string;
  user_id: string;
  word: string;
  created_at: string;
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
  last_seen_date: string | null;
}

export function rowToWord(r: WordRow): Word {
  return {
    ...r,
    other_meanings: r.other_meanings ?? [],
    sentences: r.sentences ?? [],
    distractor_defs: r.distractor_defs ?? [],
    distractor_words: r.distractor_words ?? [],
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

export async function getWord(id: string): Promise<Word | null> {
  const supabase = await createClient();
  const user = await requireUser();
  const { data } = await supabase
    .from("words")
    .select("*")
    .eq("user_id", user.id)
    .eq("id", id)
    .maybeSingle();
  return data ? rowToWord(data as WordRow) : null;
}

export async function getWordReviewCounts(id: string): Promise<{ reviewed: number; missed: number }> {
  const supabase = await createClient();
  const user = await requireUser();
  const { data } = await supabase
    .from("reviews")
    .select("result")
    .eq("user_id", user.id)
    .eq("word_id", id);
  const rows = (data ?? []) as { result: Review["result"] }[];
  return {
    reviewed: rows.length,
    missed: rows.filter((r) => r.result === "wrong" || r.result === "dontknow").length,
  };
}

export async function insertWord(pkg: GeneratedPackage): Promise<Word> {
  const supabase = await createClient();
  const user = await requireUser();
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
      due_date: addDays(today(), 1), // new word = due tomorrow (SPEC 3.4)
      lapse_count: 0,
    })
    .select("*")
    .single();
  if (error) throw error;
  return rowToWord(data as WordRow);
}
