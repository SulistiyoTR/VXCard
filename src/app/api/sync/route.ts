import { NextResponse } from "next/server";
import { requireUser, rowToWord, type WordRow } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import type { Review, SessionRow, Word } from "@/lib/types";

export const runtime = "nodejs";

/**
 * GET /api/sync?since=<iso>  — remote changes since `since` (SPEC 6.4).
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const since = new URL(request.url).searchParams.get("since") ?? "1970-01-01T00:00:00.000Z";
  const serverTime = new Date().toISOString();
  const reviewWindow = new Date(Date.now() - 35 * 86_400_000).toISOString();
  const reviewsSince = since > reviewWindow ? since : reviewWindow;

  const isFullSeed = since === "1970-01-01T00:00:00.000Z";

  const [wordsRes, sessionsRes, reviewsRes] = await Promise.all([
    isFullSeed
      ? supabase.from("words").select("*").eq("user_id", user.id)
      : supabase.from("words").select("*").eq("user_id", user.id).gt("updated_at", since),
    isFullSeed
      ? supabase.from("sessions").select("*").eq("user_id", user.id)
      : supabase.from("sessions").select("*").eq("user_id", user.id).gt("updated_at", since),
    supabase.from("reviews").select("*").eq("user_id", user.id).gt("reviewed_at", reviewsSince),
  ]);

  return NextResponse.json({
    words: ((wordsRes.data ?? []) as WordRow[]).map(rowToWord),
    sessions: (sessionsRes.data ?? []) as SessionRow[],
    reviews: reviewsRes.data ?? [],
    serverTime,
  });
}

interface PushBody {
  reviews?: Review[];
  words?: Word[];
  sessions?: SessionRow[];
  deletions?: string[];
}

/**
 * POST /api/sync — apply the client outbox. Words/sessions use last-write-wins
 * on `updated_at`; reviews are inserted idempotently by their client id.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const user = await requireUser();

  let body: PushBody;
  try {
    body = (await request.json()) as PushBody;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const reviews = body.reviews ?? [];
  const words = body.words ?? [];
  const sessions = body.sessions ?? [];
  const deletions = body.deletions ?? [];

  if (deletions.length) {
    await supabase.from("words").delete().eq("user_id", user.id).in("id", deletions);
  }

  if (reviews.length) {
    await supabase.from("reviews").upsert(
      reviews.map((r) => ({
        id: r.id,
        user_id: user.id,
        word_id: r.word_id,
        reviewed_at: r.reviewed_at,
        level: r.level,
        result: r.result,
        duration_ms: r.duration_ms,
        help_used: r.help_used,
        source: r.source,
      })),
      { onConflict: "id", ignoreDuplicates: true },
    );
  }

  // Words — last-write-wins.
  if (words.length) {
    const ids = words.map((w) => w.id);
    const { data: existing } = await supabase
      .from("words")
      .select("id, updated_at")
      .eq("user_id", user.id)
      .in("id", ids);
    const stamps = new Map((existing ?? []).map((r) => [r.id as string, r.updated_at as string]));

    for (const w of words) {
      const prev = stamps.get(w.id);
      if (prev && prev > w.updated_at) continue; // remote is newer — keep it
      const payload = {
        id: w.id,
        user_id: user.id,
        word: w.word,
        created_at: w.created_at,
        phonetic: w.phonetic,
        audio_url: w.audio_url,
        pos: w.pos,
        definition: w.definition,
        origin: w.origin,
        other_meanings: w.other_meanings,
        sentences: w.sentences,
        distractor_defs: w.distractor_defs,
        distractor_words: w.distractor_words,
        level: w.level,
        streak: w.streak,
        due_date: w.due_date,
        lapse_count: w.lapse_count,
        review_count: w.review_count,
        last_seen_date: w.last_seen_date,
        updated_at: w.updated_at,
      };
      await supabase.from("words").upsert(payload, { onConflict: "id" });
    }
  }

  // Sessions — last-write-wins.
  if (sessions.length) {
    const ids = sessions.map((s) => s.id);
    const { data: existing } = await supabase
      .from("sessions")
      .select("id, updated_at")
      .eq("user_id", user.id)
      .in("id", ids);
    const stamps = new Map((existing ?? []).map((r) => [r.id as string, r.updated_at as string]));

    for (const s of sessions) {
      const prev = stamps.get(s.id);
      if (prev && prev > s.updated_at) continue;
      await supabase.from("sessions").upsert(
        {
          id: s.id,
          user_id: user.id,
          started_at: s.started_at,
          finished_at: s.finished_at,
          completed: s.completed,
          planned: s.planned,
          answered: s.answered,
          source: s.source,
          updated_at: s.updated_at,
        },
        { onConflict: "id" },
      );
    }
  }

  return NextResponse.json({ ok: true, serverTime: new Date().toISOString() });
}
