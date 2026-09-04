import type { Sentence } from "./types";

/**
 * The three numbers behind sentence rotation + pool growth (SPEC 1.6). All pure —
 * shared by the quiz (`pickSentence`) and the ticket system (`runTickets`).
 */

/** Active (non-flagged) sentence count — the pool size for growth decisions. */
export function poolSize(sentences: readonly Pick<Sentence, "flagged">[]): number {
  return sentences.reduce((n, s) => (s.flagged ? n : n + 1), 0);
}

/** Indices this user can still be shown: not flagged, not in their `hidden`. */
export function availableIndices(
  sentences: readonly Sentence[],
  hidden: readonly number[],
): number[] {
  const h = new Set(hidden);
  const out: number[] = [];
  sentences.forEach((s, i) => {
    if (!s.flagged && !h.has(i)) out.push(i);
  });
  return out;
}

/** How many available sentences this user hasn't seen yet (`usage` 0 or absent). */
export function freshCount(
  sentences: readonly Sentence[],
  usage: readonly number[],
  hidden: readonly number[],
): number {
  return availableIndices(sentences, hidden).filter((i) => (usage[i] ?? 0) === 0).length;
}
