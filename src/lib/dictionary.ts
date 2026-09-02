import type { Meaning } from "./types";

/**
 * Factual layer of a word (SPEC 1.2). Two sources:
 *  1. dictionaryapi.dev — free, no key, real IPA. Flaky from some regions.
 *  2. Merriam-Webster Learner's — needs a free key (MERRIAM_WEBSTER_KEY),
 *     1000 req/day, much more reliable. Used as a fallback, or as the primary
 *     source when DICTIONARY_PRIMARY=mw.
 * Language content (sentences, distractors) comes from the LLM, never here.
 */

const FREE_API = "https://api.dictionaryapi.dev/api/v2/entries/en";
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
  | { ok: false; reason: "not_found" | "unavailable" };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

/* ------------------------------------------------------------- free API */

interface FreeEntry {
  word?: string;
  phonetic?: string;
  phonetics?: { text?: string; audio?: string }[];
  origin?: string;
  meanings?: { partOfSpeech?: string; definitions?: { definition?: string }[] }[];
}

function parseFree(entries: FreeEntry[], fallbackWord: string): DictionaryFacts | null {
  if (!Array.isArray(entries) || entries.length === 0) return null;
  const first = entries[0];
  const phonetic = first.phonetic || first.phonetics?.find((p) => p.text)?.text || null;
  const audio = first.phonetics?.find((p) => p.audio && p.audio.length > 0)?.audio || null;

  const meanings: Meaning[] = [];
  for (const entry of entries) {
    for (const m of entry.meanings ?? []) {
      for (const d of m.definitions ?? []) {
        if (d.definition) meanings.push({ pos: m.partOfSpeech ?? "", definition: d.definition });
      }
    }
  }
  if (meanings.length === 0) return null;

  const [primary, ...rest] = meanings;
  return {
    word: first.word?.toLowerCase() ?? fallbackWord,
    phonetic: phonetic ?? null,
    audio_url: audio ? (audio.startsWith("//") ? `https:${audio}` : audio) : null,
    pos: primary.pos,
    definition: primary.definition,
    origin: first.origin ?? null,
    other_meanings: rest,
  };
}

/** null = source unreachable (caller should fall through); otherwise a verdict. */
async function tryFree(word: string): Promise<DictionaryLookup | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetchWithTimeout(`${FREE_API}/${encodeURIComponent(word)}`, 7000, {
        headers: { accept: "application/json" },
      });
      if (res.status === 404) return { ok: false, reason: "not_found" };
      if (!res.ok) {
        if (attempt === 0) {
          await sleep(400);
          continue;
        }
        return null;
      }
      const facts = parseFree((await res.json()) as FreeEntry[], word);
      return facts ? { ok: true, facts } : { ok: false, reason: "not_found" };
    } catch {
      if (attempt === 0) {
        await sleep(400);
        continue;
      }
      return null;
    }
  }
  return null;
}

/* --------------------------------------------------- Merriam-Webster Learner's */

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

async function tryMw(word: string): Promise<DictionaryLookup | null> {
  const key = process.env.MERRIAM_WEBSTER_KEY;
  if (!key) return null;
  try {
    const res = await fetchWithTimeout(
      `${MW_API}/${encodeURIComponent(word)}?key=${encodeURIComponent(key)}`,
      8000,
      { headers: { accept: "application/json" } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as unknown[];
    if (!Array.isArray(data) || data.length === 0) return { ok: false, reason: "not_found" };
    if (typeof data[0] === "string") return { ok: false, reason: "not_found" }; // spelling suggestions
    const facts = parseMw(data as MwEntry[], word);
    return facts ? { ok: true, facts } : { ok: false, reason: "not_found" };
  } catch {
    return null;
  }
}

/* ----------------------------------------------------------------- lookup */

/** Per-source diagnostics for GET /api/generate. */
export async function probeDictionary(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};

  try {
    const res = await fetchWithTimeout(`${FREE_API}/test`, 7000, {
      headers: { accept: "application/json" },
    });
    out.dictionaryapi_dev = res.ok ? "ok" : `HTTP ${res.status}`;
  } catch (e) {
    out.dictionaryapi_dev = `unreachable — ${e instanceof Error ? e.message : String(e)}`;
  }

  const key = process.env.MERRIAM_WEBSTER_KEY;
  if (!key) {
    out.merriam_webster = "MERRIAM_WEBSTER_KEY not set";
  } else {
    try {
      const res = await fetchWithTimeout(
        `${MW_API}/test?key=${encodeURIComponent(key)}`,
        8000,
        { headers: { accept: "application/json" } },
      );
      if (!res.ok) out.merriam_webster = `HTTP ${res.status}`;
      else {
        const data = (await res.json()) as unknown[];
        out.merriam_webster = Array.isArray(data) ? "ok" : "unexpected response";
      }
    } catch (e) {
      out.merriam_webster = `unreachable — ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  out.primary = process.env.DICTIONARY_PRIMARY === "mw" && key ? "merriam_webster" : "dictionaryapi_dev";
  return out;
}

export async function lookupWord(word: string): Promise<DictionaryLookup> {
  const mwFirst =
    Boolean(process.env.MERRIAM_WEBSTER_KEY) && process.env.DICTIONARY_PRIMARY === "mw";
  const sources = mwFirst ? [tryMw, tryFree] : [tryFree, tryMw];

  let sawNotFound = false;
  for (const source of sources) {
    const result = await source(word);
    if (result === null) continue; // source unreachable — try the next one
    if (result.ok) return result;
    sawNotFound = true; // a real "not found" — but let the other source have a go too
  }
  return { ok: false, reason: sawNotFound ? "not_found" : "unavailable" };
}
