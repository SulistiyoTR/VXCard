import Anthropic from "@anthropic-ai/sdk";
import { CONFIG } from "./config";
import { env } from "./env";
import type { Sentence } from "./types";

function client() {
  return new Anthropic({ apiKey: env.anthropicKey() });
}

function textOf(msg: Anthropic.Message): string {
  return msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

/** Pull the first JSON value out of a model response, tolerating code fences. */
function parseJson<T>(raw: string): T {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced ? fenced[1] : raw).trim();
  const start = body.search(/[[{]/);
  if (start === -1) throw new Error("No JSON in LLM response");
  const end = Math.max(body.lastIndexOf("]"), body.lastIndexOf("}"));
  return JSON.parse(body.slice(start, end + 1)) as T;
}

/** One tiny call to confirm the key + model work (used by the diagnostics route). */
export async function pingLLM(): Promise<{ ok: boolean; model: string; detail?: string }> {
  const model = env.llmModel();
  try {
    const msg = await client().messages.create({
      model,
      max_tokens: 5,
      messages: [{ role: "user", content: "Reply with the word OK." }],
    });
    return { ok: true, model: msg.model || model };
  } catch (e) {
    const o = e as { status?: number; message?: string; error?: { error?: { message?: string } } };
    const m = o.error?.error?.message ?? o.message ?? String(e);
    return { ok: false, model, detail: o.status ? `${o.status} — ${m}` : m };
  }
}

async function ask(system: string, user: string, maxTokens: number): Promise<string> {
  const msg = await client().messages.create({
    model: env.llmModel(),
    max_tokens: maxTokens,
    temperature: 0.3,
    system,
    messages: [{ role: "user", content: user }],
  });
  return textOf(msg);
}

const JSON_ONLY = "Respond with pure JSON only — no prose, no code fences.";

/**
 * Call A (SPEC 1.3): example sentences, varied contexts, target mid-sentence,
 * 10–20 words, with the inflected `form` used. Defaults to `SENTENCES_PER_WORD`;
 * the ticket system passes a smaller `count` and the existing texts to `avoid`.
 */
export async function generateSentences(
  input: { word: string; pos: string; definition: string },
  opts: { count?: number; avoid?: string[] } = {},
): Promise<Sentence[]> {
  const count = opts.count ?? CONFIG.SENTENCES_PER_WORD;
  const system = [
    "You write natural example sentences that teach an English word in context.",
    "Rules:",
    `- Produce exactly ${count} sentences.`,
    "- Each sentence 10–20 words.",
    "- The target word appears in the MIDDLE of the sentence, never the first word.",
    "- Every sentence a genuinely different context — not restatements of one idea.",
    '- Report the exact inflected form used as "form" (e.g. "relegated", not "relegate").',
    JSON_ONLY,
    'Schema: {"sentences":[{"text": string, "form": string}]}',
  ].join("\n");

  const avoid = opts.avoid?.length
    ? `\n\nDo NOT reuse the contexts of these existing sentences:\n${opts.avoid
        .map((t) => `- ${t}`)
        .join("\n")}`
    : "";
  const user = `word: ${input.word}\npos: ${input.pos}\ndefinition: ${input.definition}${avoid}`;
  const parsed = parseJson<{ sentences: { text: string; form?: string }[] }>(
    await ask(system, user, 200 + count * 140),
  );

  return parsed.sentences.slice(0, count).map((s) => ({
    text: s.text.trim(),
    form: (s.form || input.word).trim(),
    hide_count: 0,
    flagged: false,
  }));
}

/**
 * Call B (SPEC 1.3): near-miss definition distractors + same-POS word distractors.
 */
export async function generateDistractors(input: {
  word: string;
  pos: string;
  definition: string;
}): Promise<{ distractor_defs: string[]; distractor_words: string[] }> {
  const n = CONFIG.DISTRACTORS_PER_WORD;
  const system = [
    "You design multiple-choice distractors for a vocabulary quiz.",
    `- "distractor_defs": ${n} FALSE definitions that are near-misses — each should`,
    "  plausibly belong to a different word that looks or sounds similar to the target.",
    `- "distractor_words": ${n} real English words, same part of speech, similar difficulty,`,
    "  none synonymous with the target.",
    JSON_ONLY,
    'Schema: {"distractor_defs": string[], "distractor_words": string[]}',
  ].join("\n");

  const user = `word: ${input.word}\npos: ${input.pos}\ndefinition: ${input.definition}`;
  const parsed = parseJson<{ distractor_defs?: string[]; distractor_words?: string[] }>(
    await ask(system, user, 700),
  );

  return {
    distractor_defs: (parsed.distractor_defs ?? []).map((s) => s.trim()).slice(0, n),
    distractor_words: (parsed.distractor_words ?? [])
      .map((s) => s.trim().toLowerCase())
      .filter((w) => w && w !== input.word)
      .slice(0, n),
  };
}

/**
 * Cheap spelling fallback (SPEC 1.5): the dictionary API gives no suggestions,
 * so we ask the model whether the input is a near-miss of a real English word.
 */
export async function suggestSpelling(word: string): Promise<string | null> {
  try {
    const out = await ask(
      'If the input is a misspelling of a common English word, reply with just that word. Otherwise reply "NONE". One token only.',
      word,
      12,
    );
    const guess = out.trim().toLowerCase().replace(/[^a-z'-]/g, "");
    if (!guess || guess === "none" || guess === word.toLowerCase()) return null;
    return guess;
  } catch {
    return null;
  }
}
