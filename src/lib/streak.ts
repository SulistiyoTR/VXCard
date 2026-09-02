import { addDays } from "./date";

/**
 * Current streak (SPEC 4.10): consecutive days with a completed session, ending
 * today — or yesterday, so the streak survives until the day is out.
 */
export function currentStreak(activeDays: readonly string[], todayISO: string): number {
  const set = new Set(activeDays);
  let cursor: string;
  if (set.has(todayISO)) cursor = todayISO;
  else if (set.has(addDays(todayISO, -1))) cursor = addDays(todayISO, -1);
  else return 0;

  let n = 0;
  while (set.has(cursor)) {
    n += 1;
    cursor = addDays(cursor, -1);
  }
  return n;
}

/** Longest run of consecutive active days ever (SPEC 4.10 "best"). */
export function bestStreak(activeDays: readonly string[]): number {
  const sorted = [...new Set(activeDays)].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const day of sorted) {
    run = prev && addDays(prev, 1) === day ? run + 1 : 1;
    best = Math.max(best, run);
    prev = day;
  }
  return best;
}
