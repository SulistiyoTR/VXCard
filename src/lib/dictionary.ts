import type { Meaning } from "./types";

/**
 * Factual layer of a word (SPEC 1.2). Single source: **Merriam-Webster
 * Learner's Dictionary** — needs a free key (`MERRIAM_WEBSTER_KEY`), 1000
 * req/day for the whole app. No fallback: if MW is unreachable or the key is
 * missing, the caller surfaces a clear error. Language content (sentences,
 * distractors) comes from the LLM, never here.
 */

const MW_API = "https://www.dictionaryapi.com/api/v3/references/learners/json";

export interface DictionaryFacts {
  word: string;
  phonetic: string | null;
  audio_url: string | null;
  pos: string;
  definition: string;
  origin: string | null;
  other_meanings: Meaning[];
}

export type DictionaryLookup =
  | { ok: true; facts: DictionaryFacts }
  | { ok: false; reason: "not_found"; suggestion?: string }
  | { ok: false; reason: "unavailable" };

async function fetchWithTimeout(url: string, ms: number, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

const stripMarkup = (s: string) => s.replace(/\{[^}]*\}/g, "").replace(/\s+/g, " ").trim();

interface MwEntry {
  meta?: { id?: string };
  fl?: string;
  shortdef?: string[];
  hwi?: { hw?: string; prs?: { mw?: string; sound?: { audio?: string } }[] };
  et?: unknown[];
}

function mwAudioUrl(audio: string): string {
  let sub: string;
  if (audio.startsWith("bix")) sub = "bix";
  else if (audio.startsWith("gg")) sub = "gg";
  else if (/^[^a-z]/i.test(audio)) sub = "number";
  else sub = audio[0];
  return `https://media.merriam-webster.com/audio/prons/en/us/mp3/${sub}/${audio}.mp3`;
}

function mwEtymology(et: unknown[] | undefined): string | null {
  if (!Array.isArray(et)) return null;
  for (const part of et) {
    if (Array.isArray(part) && part[0] === "text" && typeof part[1] === "string") {
      const text = stripMarkup(part[1]);
      if (text) return text;
    }
  }
  return null;
}

function parseMw(data: MwEntry[], word: string): DictionaryFacts | null {
  const usable = data.filter((e) => e.fl && (e.shortdef?.length ?? 0) > 0);
  if (usable.length === 0) return null;

  const meanings: Meaning[] = [];
  for (const e of usable) {
    for (const d of e.shortdef ?? []) {
      const clean = stripMarkup(d);
      if (clean) meanings.push({ pos: e.fl ?? "", definition: clean });
    }
  }
  if (meanings.length === 0) return null;

  const head = usable[0];
  const prs = head.hwi?.prs?.[0];
  const audio = prs?.sound?.audio;
  const [primary, ...rest] = meanings;

  return {
    word: (head.meta?.id ?? word).split(":")[0].toLowerCase(),
    phonetic: prs?.mw ? `/${prs.mw}/` : null,
    audio_url: audio ? mwAudioUrl(audio) : null,
    pos: primary.pos,
    definition: primary.definition,
    origin: mwEtymology(head.et),
    other_meanings: rest,
  };
}

/* ----------------------------------------------------------------- lookup */

export async function lookupWord(word: string): Promise<DictionaryLookup> {
  const key = process.env.MERRIAM_WEBSTER_KEY;
  if (!key) return { ok: false, reason: "unavailable" };

  let data: unknown[];
  try {
    const res = await fetchWithTimeout(
      `${MW_API}/${encodeURIComponent(word)}?key=${encodeURIComponent(key)}`,
      8000,
      { headers: { accept: "application/json" } },
    );
    if (!res.ok) return { ok: false, reason: "unavailable" };
    data = (await res.json()) as unknown[];
  } catch {
    return { ok: false, reason: "unavailable" };
  }

  if (!Array.isArray(data) || data.length === 0) return { ok: false, reason: "not_found" };
  // MW returns a string array of spelling suggestions when the word is unknown.
  if (typeof data[0] === "string") {
    const suggestion = (data as string[]).find((s) => /^[a-z][a-z'-]*$/i.test(s));
    return suggestion
      ? { ok: false, reason: "not_found", suggestion: suggestion.toLowerCase() }
      : { ok: false, reason: "not_found" };
  }

  const facts = parseMw(data as MwEntry[], word);
  return facts ? { ok: true, facts } : { ok: false, reason: "not_found" };
}

/** Per-source diagnostics for GET /api/generate. */
export async function probeDictionary(): Promise<Record<string, string>> {
  const key = process.env.MERRIAM_WEBSTER_KEY;
  if (!key) return { merriam_webster: "MERRIAM_WEBSTER_KEY not set" };
  try {
    const res = await fetchWithTimeout(
      `${MW_API}/test?key=${encodeURIComponent(key)}`,
      8000,
      { headers: { accept: "application/json" } },
    );
    if (!res.ok) return { merriam_webster: `HTTP ${res.status}` };
    const data = (await res.json()) as unknown[];
    return { merriam_webster: Array.isArray(data) ? "ok" : "unexpected response" };
  } catch (e) {
    return { merriam_webster: `unreachable — ${e instanceof Error ? e.message : String(e)}` };
  }
}
