import { NextResponse } from "next/server";
import { CONFIG } from "@/lib/config";
import { generatePackage, normalizeInput } from "@/lib/generate";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * POST /api/generate  { "word": "explicable" }
 *
 * Returns the generated package (SPEC 1.4) or an error state (SPEC 1.5 / 4.3).
 * The Anthropic key never leaves this handler.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { word?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (typeof body.word !== "string" || body.word.trim() === "") {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const word = normalizeInput(body.word);

  // Duplicate check (SPEC 1.1 step 2 / 4.3).
  const { data: existing } = await supabase
    .from("words")
    .select("id, word, level, streak, due_date")
    .eq("user_id", user.id)
    .eq("word", word)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ status: "duplicate", word: existing });
  }

  // Daily rate limit (SPEC 5.6).
  const { count } = await supabase
    .from("words")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString());
  if ((count ?? 0) >= CONFIG.DAILY_NEW_WORD_LIMIT) {
    return NextResponse.json({ status: "rate_limited", limit: CONFIG.DAILY_NEW_WORD_LIMIT }, { status: 429 });
  }

  const outcome = await generatePackage(word);

  switch (outcome.status) {
    case "ok":
      return NextResponse.json({ status: "ok", package: outcome.package });
    case "phrase":
      return NextResponse.json({ status: "phrase" }, { status: 422 });
    case "not_found":
      return NextResponse.json({ status: "not_found", word: outcome.word }, { status: 404 });
    case "suggestion":
      return NextResponse.json(
        { status: "suggestion", word: outcome.word, suggestion: outcome.suggestion },
        { status: 404 },
      );
    case "unavailable":
      return NextResponse.json({ status: "unavailable" }, { status: 503 });
  }
}
