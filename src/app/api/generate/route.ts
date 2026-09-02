import { CONFIG } from "@/lib/config";
import { errMessage, normalizeInput, runGenerate } from "@/lib/generate";
import { lookupWord } from "@/lib/dictionary";
import { pingLLM } from "@/lib/llm";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * GET /api/generate — diagnostics. Confirms the dictionary API and the Anthropic
 * key/model both work, in isolation. Auth-gated.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  let dictionary: string;
  try {
    const r = await lookupWord("test");
    dictionary = r.ok ? "ok" : `not ok (${r.reason})`;
  } catch (e) {
    dictionary = `threw — ${errMessage(e)}`;
  }

  const llm = await pingLLM();
  return Response.json({
    dictionary,
    anthropic: llm.ok ? `ok (${llm.model})` : `failed — ${llm.detail}`,
  });
}

/**
 * POST /api/generate  { "word": "explicable" }
 *
 * Responds with a Server-Sent Events stream so the Add-word screen can show
 * progress. Events (one JSON object per `data:` line):
 *   { "type": "stage",  "stage": "lookup" | "sentences" | "distractors" }
 *   { "type": "result", "result": { "status": "ok" | "duplicate" | "not_found"
 *        | "suggestion" | "phrase" | "rate_limited" | "error", ... } }
 *
 * The Anthropic key never leaves this handler.
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
  const word = normalizeInput(raw);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      try {
        // Duplicate check (SPEC 1.1 / 4.3).
        const { data: existing } = await supabase
          .from("words")
          .select("id, word, level, streak, due_date")
          .eq("user_id", user.id)
          .eq("word", word)
          .maybeSingle();
        if (existing) {
          send({ type: "result", result: { status: "duplicate", word: existing } });
          return;
        }

        // Daily rate limit (SPEC 5.6).
        const startOfDay = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
        const { count } = await supabase
          .from("words")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .gte("created_at", startOfDay);
        if ((count ?? 0) >= CONFIG.DAILY_NEW_WORD_LIMIT) {
          send({
            type: "result",
            result: { status: "rate_limited", limit: CONFIG.DAILY_NEW_WORD_LIMIT },
          });
          return;
        }

        const result = await runGenerate(word, (stage) => send({ type: "stage", stage }));
        send({ type: "result", result });
      } catch (err) {
        console.error("[generate] unexpected", err);
        send({ type: "result", result: { status: "error", detail: errMessage(err) } });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}
