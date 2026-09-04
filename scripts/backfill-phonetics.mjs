// Backfills words.phonetic for rows left null by the src/lib/dictionary.ts bug
// (it only read hwi.prs[0].mw, but this MW plan only returns .ipa). One-off,
// idempotent — only touches rows where phonetic IS NULL, safe to re-run.
//
// Run: node --env-file=.env.local scripts/backfill-phonetics.mjs
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MW_KEY = process.env.MERRIAM_WEBSTER_KEY;

if (!SUPABASE_URL || !SERVICE_KEY || !MW_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / MERRIAM_WEBSTER_KEY in env.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const MW_API = "https://www.dictionaryapi.com/api/v3/references/learners/json";

async function lookupPhonetic(word) {
  const res = await fetch(`${MW_API}/${encodeURIComponent(word)}?key=${encodeURIComponent(MW_KEY)}`, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0 || typeof data[0] === "string") {
    return { ok: false, reason: "not found / suggestions only" };
  }
  const prs = data[0]?.hwi?.prs?.[0];
  const raw = prs?.mw ?? prs?.ipa;
  if (!raw) return { ok: false, reason: "no pronunciation in response" };
  return { ok: true, phonetic: `/${raw}/` };
}

async function main() {
  const { data: rows, error } = await supabase
    .from("words")
    .select("id, word")
    .is("phonetic", null)
    .order("word");
  if (error) throw error;

  if (rows.length === 0) {
    console.log("Nothing to backfill — no words with phonetic = null.");
    return;
  }
  console.log(`${rows.length} word(s) to backfill:\n`);

  for (const { id, word } of rows) {
    const result = await lookupPhonetic(word);
    if (!result.ok) {
      console.log(`  ${word.padEnd(16)} skipped — ${result.reason}`);
      continue;
    }
    const { error: updateError } = await supabase
      .from("words")
      .update({ phonetic: result.phonetic })
      .eq("id", id);
    if (updateError) {
      console.log(`  ${word.padEnd(16)} FAILED to write — ${updateError.message}`);
      continue;
    }
    console.log(`  ${word.padEnd(16)} null -> ${result.phonetic}`);
    // Courtesy delay — well within MW's 1000 req/day, just being polite.
    await new Promise((r) => setTimeout(r, 200));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
