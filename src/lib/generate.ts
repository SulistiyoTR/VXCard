/** Small shared helpers for the Add-word pipeline. The orchestration lives in
 *  `src/lib/addWord.ts` (server-only); the DB-free bits stay here. */

export function normalizeInput(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Single ASCII word, optionally with an internal hyphen/apostrophe. */
export const SINGLE_WORD = /^[a-z][a-z'-]*[a-z]$|^[a-z]$/;

/** Turn any thrown value into a short, safe-to-show message (with an HTTP status when present). */
export function errMessage(e: unknown): string {
  if (e && typeof e === "object") {
    const o = e as {
      status?: number;
      message?: string;
      error?: { error?: { message?: string } };
    };
    const m = o.error?.error?.message ?? o.message ?? String(e);
    return o.status ? `${o.status} — ${m}` : m;
  }
  return String(e);
}
