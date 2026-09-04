import { searchWord } from "@/lib/addWord";
import { lookupWord, probeDictionary } from "@/lib/dictionary";
import { errMessage } from "@/lib/generate";
import { pingLLM } from "@/lib/llm";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

/**
 * GET /api/generate — diagnostics. Function region + whether each upstream
 * (Merriam-Webster + Anthropic) is reachable. Auth-gated.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  const [dict, llm, lookup] = await Promise.all([
    probeDictionary(),
    pingLLM(),
    lookupWord("test").then(
      (r) => (r.ok ? "ok" : `not ok (${r.reason})`),
      (e) => `threw — ${errMessage(e)}`,
    ),
  ]);

  return Response.json(
    {
      region: process.env.VERCEL_REGION ?? "local",
      config: {
        MERRIAM_WEBSTER_KEY: process.env.MERRIAM_WEBSTER_KEY ? "set" : "MISSING",
        ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL ?? "(default)",
      },
      dictionary: { ...dict, lookup_result: lookup },
      anthropic: llm.ok ? `ok (${llm.model})` : `failed — ${llm.detail}`,
    },
    { headers: { "cache-control": "no-store" } },
  );
}

/**
 * POST /api/generate  { "word": "explicable" }  — search step (SPEC 1.1).
 *
 * Checks the shared `words` table first; only calls Merriam-Webster for a
 * genuinely new word, rate-limited to CONFIG.DAILY_NEW_WORD_LIMIT lookups per
 * user per day. No LLM here — that waits for POST /api/generate/save.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  let body: { word?: unknown };
  try {
    body = await request.json();
  } catch {
    return new Response("bad_request", { status: 400 });
  }
  const raw = typeof body.word === "string" ? body.word : "";
  if (!raw.trim()) return new Response("bad_request", { status: 400 });

  try {
    const result = await searchWord(raw, user.id);
    return Response.json(result, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    console.error("[generate] search failed", err);
    return Response.json({ status: "error", detail: errMessage(err) });
  }
}
