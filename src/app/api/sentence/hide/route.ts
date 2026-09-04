import { CONFIG } from "@/lib/config";
import { errMessage } from "@/lib/generate";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/sentence/hide  { "word_id": "uuid", "index": 2 }  — SPEC 1.6.
 *
 * Bumps the global `hide_count` on one sentence of a shared `words` row and
 * flags it once CONFIG.FLAG_THRESHOLD distinct users have hidden it. The
 * per-user hide (user_cards.hidden_sentences) is written client-side and syncs
 * separately — this endpoint only touches shared content.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  let body: { word_id?: unknown; index?: unknown };
  try {
    body = await request.json();
  } catch {
    return new Response("bad_request", { status: 400 });
  }
  const wordId = typeof body.word_id === "string" ? body.word_id : "";
  const index = typeof body.index === "number" ? body.index : NaN;
  if (!wordId || !Number.isInteger(index) || index < 0) {
    return new Response("bad_request", { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("hide_sentence", {
      p_word_id: wordId,
      p_index: index,
      p_flag_threshold: CONFIG.FLAG_THRESHOLD,
    });
    if (error) return Response.json({ status: "error", detail: error.message }, { status: 500 });
    if (data == null) return Response.json({ status: "error", detail: "no such sentence" }, { status: 404 });
    return Response.json({ status: "ok" }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    console.error("[sentence/hide] failed", err);
    return Response.json({ status: "error", detail: errMessage(err) }, { status: 500 });
  }
}
