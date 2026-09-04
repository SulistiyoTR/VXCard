import { NextResponse } from "next/server";
import { CONFIG } from "@/lib/config";
import {
  cardRowToCard,
  contentRowToContent,
  requireUser,
  type UserCardRow,
  type WordContentRow,
} from "@/lib/data";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Review, SessionRow, UserCard } from "@/lib/types";

export const runtime = "nodejs";

const EPOCH = "1970-01-01T00:00:00.000Z";

/**
 * GET /api/sync?since=<iso>  — remote changes since `since` (SPEC 6.4).
 *
 * `words` is shared content: we return the rows behind this user's cards whose
 * content changed since `since` (so a growing sentence pool reaches the phone
 * even when the card itself didn't move). `cards` / `sessions` / `reviews` are
 * per-user.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const since = new URL(request.url).searchParams.get("since") ?? EPOCH;
  const serverTime = new Date().toISOString();
  const reviewWindow = new Date(Date.now() - 35 * 86_400_000).toISOString();
  const reviewsSince = since > reviewWindow ? since : reviewWindow;
  const isFullSeed = since === EPOCH;

  // Every word_id this user has a card for — drives the content query.
  const { data: cardRefs } = await supabase
    .from("user_cards")
    .select("word_id")
    .eq("user_id", user.id);
  const wordIds = [...new Set((cardRefs ?? []).map((r) => r.word_id as string))];
  // A sentinel keeps `.in()` non-empty when the deck has no cards yet.
  const contentIds = wordIds.length ? wordIds : ["00000000-0000-0000-0000-000000000000"];

  const cardsQuery = supabase.from("user_cards").select("*").eq("user_id", user.id);
  const sessionsQuery = supabase.from("sessions").select("*").eq("user_id", user.id);
  const contentQuery = supabase.from("words").select("*").in("id", contentIds);

  const [cardsRes, sessionsRes, reviewsRes, contentRes] = await Promise.all([
    isFullSeed ? cardsQuery : cardsQuery.gt("updated_at", since),
    isFullSeed ? sessionsQuery : sessionsQuery.gt("updated_at", since),
    supabase.from("reviews").select("*").eq("user_id", user.id).gt("reviewed_at", reviewsSince),
    isFullSeed ? contentQuery : contentQuery.gt("updated_at", since),
  ]);

  return NextResponse.json({
    words: ((contentRes.data ?? []) as WordContentRow[]).map(contentRowToContent),
    cards: ((cardsRes.data ?? []) as UserCardRow[]).map(cardRowToCard),
    sessions: (sessionsRes.data ?? []) as SessionRow[],
    reviews: reviewsRes.data ?? [],
    serverTime,
  });
}

interface PushBody {
  reviews?: Review[];
  cards?: UserCard[];
  sessions?: SessionRow[];
  /** `word_id`s of removed cards. */
  deletions?: string[];
  /** "Change this sentence" global hide_count bumps. */
  hides?: { word_id: string; index: number }[];
}

/**
 * POST /api/sync — apply the client outbox. Cards/sessions use last-write-wins
 * on `updated_at`; reviews are inserted idempotently by their client id.
 * Shared `words` content is never written here.
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
  const cards = body.cards ?? [];
  const sessions = body.sessions ?? [];
  const deletions = body.deletions ?? [];
  const hides = body.hides ?? [];

  // Global hide_count bumps — service-role (shared `words` is backend-write-only).
  if (hides.length) {
    const admin = createAdminClient();
    for (const h of hides) {
      if (typeof h?.word_id !== "string" || !Number.isInteger(h?.index) || h.index < 0) continue;
      await admin.rpc("hide_sentence", {
        p_word_id: h.word_id,
        p_index: h.index,
        p_flag_threshold: CONFIG.FLAG_THRESHOLD,
      });
    }
  }

  if (deletions.length) {
    await supabase
      .from("user_cards")
      .delete()
      .eq("user_id", user.id)
      .in("word_id", deletions);
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

  // Cards — last-write-wins on (user_id, word_id).
  if (cards.length) {
    const wordIds = cards.map((c) => c.word_id);
    const { data: existing } = await supabase
      .from("user_cards")
      .select("word_id, updated_at")
      .eq("user_id", user.id)
      .in("word_id", wordIds);
    const stamps = new Map(
      (existing ?? []).map((r) => [r.word_id as string, r.updated_at as string]),
    );

    for (const c of cards) {
      const prev = stamps.get(c.word_id);
      if (prev && prev > c.updated_at) continue; // remote is newer — keep it
      await supabase.from("user_cards").upsert(
        {
          id: c.id,
          user_id: user.id,
          word_id: c.word_id,
          level: c.level,
          streak: c.streak,
          due_date: c.due_date,
          lapse_count: c.lapse_count,
          last_seen_date: c.last_seen_date,
          sentence_usage: c.sentence_usage,
          hidden_sentences: c.hidden_sentences,
          review_count: c.review_count,
          created_at: c.created_at,
          updated_at: c.updated_at,
        },
        { onConflict: "user_id,word_id" },
      );
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
