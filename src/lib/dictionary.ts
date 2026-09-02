import type { Meaning } from "./types";

const API = "https://api.dictionaryapi.dev/api/v2/entries/en";

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

interface RawDefinition {
  definition: string;
}
interface RawMeaning {
  partOfSpeech?: string;
  definitions?: RawDefinition[];
}
interface RawPhonetic {
  text?: string;
  audio?: string;
}
interface RawEntry {
  word?: string;
  phonetic?: string;
  phonetics?: RawPhonetic[];
  origin?: string;
  meanings?: RawMeaning[];
}

/** Fetch the factual layer of a word (SPEC 1.2). Language content comes from the LLM. */
export async function lookupWord(word: string): Promise<DictionaryLookup> {
  let res: Response;
  try {
    res = await fetch(`${API}/${encodeURIComponent(word)}`, {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
  } catch {
    return { ok: false, reason: "unavailable" };
  }

  if (res.status === 404) return { ok: false, reason: "not_found" };
  if (!res.ok) return { ok: false, reason: "unavailable" };

  let entries: RawEntry[];
  try {
    entries = (await res.json()) as RawEntry[];
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  if (!Array.isArray(entries) || entries.length === 0) {
    return { ok: false, reason: "not_found" };
  }

  const first = entries[0];
  const phonetic =
    first.phonetic || first.phonetics?.find((p) => p.text)?.text || null;
  const audio =
    first.phonetics?.find((p) => p.audio && p.audio.length > 0)?.audio || null;

  const meanings: Meaning[] = [];
  for (const entry of entries) {
    for (const m of entry.meanings ?? []) {
      const pos = m.partOfSpeech ?? "";
      for (const d of m.definitions ?? []) {
        if (d.definition) meanings.push({ pos, definition: d.definition });
      }
    }
  }

  if (meanings.length === 0) return { ok: false, reason: "not_found" };

  const [primary, ...rest] = meanings;
  return {
    ok: true,
    facts: {
      word: first.word?.toLowerCase() ?? word,
      phonetic: phonetic ?? null,
      audio_url: audio ? (audio.startsWith("//") ? `https:${audio}` : audio) : null,
      pos: primary.pos,
      definition: primary.definition,
      origin: first.origin ?? null,
      other_meanings: rest,
    },
  };
}
