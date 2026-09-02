import { CONFIG } from "./config";
import { addDays, today as todayISO } from "./date";
import type { CardState, ReviewResult } from "./types";

const FINISHED_LEVEL = 5;

/** Score a raw answer into a ReviewResult (SPEC 2.5). */
export function scoreAnswer(opts: {
  correct: boolean;
  dontKnow: boolean;
  durationMs: number;
  level: number;
  helpUsed: number;
}): ReviewResult {
  if (opts.dontKnow) return "dontknow";
  if (!opts.correct) return "wrong";
  // Correct from here on.
  if (opts.durationMs > CONFIG.MAX_DURATION) return "correct"; // duration discarded
  const threshold = CONFIG.SLOW_THRESHOLD[opts.level] ?? Infinity;
  const slow = opts.durationMs > threshold || opts.helpUsed > 0;
  return slow ? "slow" : "correct";
}

const isPositive = (r: ReviewResult) => r === "correct" || r === "slow";

/** Map a resulting (level, streak) to its position on the interval ladder (SPEC 3.2). */
export function intervalStep(level: number, streak: number): number {
  if (level <= 1) return 0;
  if (level === 2) return 1;
  if (level === 3) return 2 + clamp(streak, 0, 2); // 2,3,4
  if (level === 4) return 5 + clamp(streak, 0, 2); // 5,6,7
  return 8; // finished
}

/** Days until next review given the post-answer state and result (SPEC 3.2). */
export function nextInterval(level: number, streak: number, result: ReviewResult): number {
  if (result === "wrong" || result === "dontknow") return 1; // due tomorrow
  const step = intervalStep(level, streak);
  if (result === "slow") return step > 0 ? CONFIG.INTERVALS[step - 1] : 1; // one step back, min 1
  return CONFIG.INTERVALS[step];
}

/**
 * Pure card update (SPEC 2.3 + 3.2). Given the current scheduling state and a
 * scored result, returns the new state. Never mutates its input.
 */
export function updateCard(
  card: CardState,
  result: ReviewResult,
  now: Date = new Date(),
): CardState {
  let { level, streak } = card;
  let lapse_count = card.lapse_count;

  if (isPositive(result)) {
    streak += 1;
    const target = CONFIG.LEVEL_TARGETS[level];
    if (target !== undefined && streak >= target) {
      level += 1;
      streak = 0;
    }
    if (level > FINISHED_LEVEL) level = FINISHED_LEVEL;
  } else {
    // wrong / dontknow
    lapse_count += 1;
    streak -= 1;
    if (streak < 0) {
      if (level > 1) {
        level -= 1;
        streak = (CONFIG.LEVEL_TARGETS[level] ?? 1) - 1;
      } else {
        streak = 0; // level 1 floor
      }
    }
  }

  const interval = nextInterval(level, streak, result);
  const due_date = addDays(todayISO(now), interval);

  return { level, streak, due_date, lapse_count };
}

/**
 * Hard Mode update (SPEC 3.7). Correct answers do nothing. Wrong answers count
 * fully, but at most `HARD_MODE_MAX_DEMOTION` cards may drop a level per session.
 */
export function updateCardHardMode(
  card: CardState,
  result: ReviewResult,
  demotionsSoFar: number,
  now: Date = new Date(),
): { card: CardState; demoted: boolean } {
  if (isPositive(result)) {
    return { card: { ...card }, demoted: false }; // no effect at all
  }

  let { level, streak } = card;
  const lapse_count = card.lapse_count + 1;
  let demoted = false;
  streak -= 1;
  if (streak < 0) {
    const brakeAvailable = demotionsSoFar < CONFIG.HARD_MODE_MAX_DEMOTION;
    if (level > 1 && brakeAvailable) {
      level -= 1;
      streak = (CONFIG.LEVEL_TARGETS[level] ?? 1) - 1;
      demoted = true;
    } else {
      streak = 0; // brake hit or level-1 floor — recorded but not demoted
    }
  }

  return {
    card: { level, streak, due_date: addDays(todayISO(now), 1), lapse_count },
    demoted,
  };
}

export function isFinished(level: number): boolean {
  return level >= FINISHED_LEVEL;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
