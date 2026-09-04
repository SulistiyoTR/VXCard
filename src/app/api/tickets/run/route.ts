import { errMessage } from "@/lib/generate";
import { createClient } from "@/lib/supabase/server";
import { runTickets } from "@/lib/tickets";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * POST /api/tickets/run  { "word_ids": [...] }  — SPEC 1.6 / UPDATE-PLAN Sesi 5.
 *
 * Fired by the client after a quiz results screen renders (fire-and-forget).
 * Deposits sentence-pool tickets for the level 3-4 words that appeared, then
 * works up to MAX_TICKETS_PER_SESSION of them. Safe to hit concurrently.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  let body: { word_ids?: unknown };
  try {
    body = await request.json();
  } catch {
    return new Response("bad_request", { status: 400 });
  }
  const wordIds = Array.isArray(body.word_ids)
    ? body.word_ids.filter((x): x is string => typeof x === "string")
    : [];

  try {
    const result = await runTickets(user.id, wordIds);
    return Response.json({ status: "ok", ...result }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    console.error("[tickets/run] failed", err);
    return Response.json({ status: "error", detail: errMessage(err) }, { status: 500 });
  }
}
