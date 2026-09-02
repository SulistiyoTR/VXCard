import { CONFIG } from "./config";
import { lateness, today as todayISO } from "./date";
import { isFinished } from "./scheduler";
import { shuffle, type Rng } from "./random";
import type { SessionItem, Word } from "./types";

/**
 * Build a study session (SPEC 3.3).
 *
 * - up to `slot * DUE_RATIO` come from the due pool (the most overdue cards),
 *   over-fetched by `POOL_MULTIPLIER` then randomly narrowed;
 * - the rest are pure-random draws from the whole deck (finished + not-yet-due
 *   included), minus cards already picked;
 * - due and random are shuffled together, never grouped.
 */
export function buildSession(
  deck: readonly Word[],
  slot: number,
  opts: { now?: Date; rng?: Rng } = {},
): SessionItem[] {
  const rng = opts.rng ?? Math.random;
  const ref = todayISO(opts.now ?? new Date());

  const due = deck
    .filter((w) => lateness(w.due_date, ref) >= 0)
    .sort((a, b) => a.due_date.localeCompare(b.due_date)); // most overdue first

  const dueCount = Math.min(due.length, Math.floor(slot * CONFIG.DUE_RATIO));
  const randomCount = Math.max(0, slot - dueCount);

  const poolSize = Math.ceil(dueCount * CONFIG.POOL_MULTIPLIER);
  const chosenDue = shuffle(due.slice(0, poolSize), rng).slice(0, dueCount);

  const chosenIds = new Set(chosenDue.map((w) => w.id));
  const remaining = deck.filter((w) => !chosenIds.has(w.id));
  const chosenRandom = shuffle(remaining, rng).slice(0, randomCount);

  const items: SessionItem[] = [
    ...chosenDue.map((word) => ({ word, source: "due" as const })),
    ...chosenRandom.map((word) => ({ word, source: "random" as const })),
  ];
  return shuffle(items, rng);
}

/**
 * Practice-more session (SPEC 3.6): leftover due first, then re-draw from cards
 * already seen today. Never pulls not-yet-due cards.
 */
export function buildPracticeSession(
  deck: readonly Word[],
  slot: number,
  seenTodayIds: readonly string[],
  opts: { now?: Date; rng?: Rng } = {},
): SessionItem[] {
  const rng = opts.rng ?? Math.random;
  const ref = todayISO(opts.now ?? new Date());
  const seen = new Set(seenTodayIds);

  const leftoverDue = shuffle(
    deck.filter((w) => lateness(w.due_date, ref) >= 0 && !seen.has(w.id)),
    rng,
  );
  const seenPool = shuffle(
    deck.filter((w) => seen.has(w.id)),
    rng,
  );

  const chosen = [...leftoverDue, ...seenPool].slice(0, slot);
  return shuffle(
    chosen.map((word) => ({ word, source: "practice" as const })),
    rng,
  );
}

/** Hard Mode session (SPEC 3.7): level 4 + finished cards only. */
export function buildHardModeSession(
  deck: readonly Word[],
  slot: number,
  opts: { rng?: Rng } = {},
): SessionItem[] {
  const rng = opts.rng ?? Math.random;
  const pool = deck.filter((w) => w.level >= 4);
  return shuffle(
    shuffle(pool, rng)
      .slice(0, slot)
      .map((word) => ({ word, source: "hardmode" as const })),
    rng,
  );
}

export function hardModeEligible(deck: readonly Word[]): Word[] {
  return deck.filter((w) => w.level >= 4);
}

export function hardModeUnlocked(deck: readonly Word[]): boolean {
  return hardModeEligible(deck).length >= CONFIG.HARD_MODE_MIN;
}

/** Count of cards due on `ref` — the "N words waiting" number (SPEC 4.2). */
export function dueCount(deck: readonly Word[], ref: string = todayISO()): number {
  return deck.filter((w) => lateness(w.due_date, ref) >= 0).length;
}

export function finishedCount(deck: readonly Word[]): number {
  return deck.filter((w) => isFinished(w.level)).length;
}
