import { completeWord } from "@/lib/addWord";
import { errMessage } from "@/lib/generate";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * POST /api/generate/save  { "word_id": "uuid" }  — Save step (SPEC 1.1).
 *
 * Advances a `dictionary_only` word by ONE sub-step per call (sentences, then
 * distractors + flip to `complete`) — see completeWord() — so the client can
 * show real per-step progress instead of one static "Saving…" state. It calls
 * this repeatedly until the response comes back `complete`. Idempotent: a word
 * that is already complete comes straight back. The client then creates the
 * local `user_cards` row, which syncs through /api/sync.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  let body: { word_id?: unknown };
  try {
    body = await request.json();
  } catch {
    return new Response("bad_request", { status: 400 });
  }
  const wordId = typeof body.word_id === "string" ? body.word_id : "";
  if (!wordId) return new Response("bad_request", { status: 400 });

  try {
    const result = await completeWord(wordId);
    return Response.json(result, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    console.error("[generate/save] failed", err);
    return Response.json({ status: "error", detail: errMessage(err) });
  }
}
