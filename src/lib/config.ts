/**
 * All tunable numbers live here (SPEC §8). These are first-pass guesses —
 * calibrate against real `reviews` data after ~2 weeks of use.
 */
export const CONFIG = {
  /** Correct answers needed to advance out of each level (SPEC 2.3). */
  LEVEL_TARGETS: { 1: 2, 2: 2, 3: 3, 4: 3 } as Record<number, number>,
  /** Interval ladder in days, indexed by scheduler "step" (SPEC 3.2). */
  INTERVALS: [2, 2, 4, 8, 15, 25, 45, 90, 180],
  /** Above this (ms) a correct answer counts as "slow" (SPEC 2.5). */
  SLOW_THRESHOLD: { 1: 5000, 2: 6000, 3: 10000, 4: 15000 } as Record<number, number>,
  /** Above this (ms) the duration is discarded; scored as plain `correct`. */
  MAX_DURATION: 60000,
  /** Fraction of a session drawn from the due pool (SPEC 3.3). */
  DUE_RATIO: 0.8,
  /** Over-fetch factor for the due pool before random pick (SPEC 3.3). */
  POOL_MULTIPLIER: 1.5,
  /** Words at level >= 4 needed to unlock Hard Mode (SPEC 3.7). */
  HARD_MODE_MIN: 10,
  /** Max level demotions per Hard Mode session (SPEC 3.7). */
  HARD_MODE_MAX_DEMOTION: 2,
  SENTENCES_PER_WORD: 5,
  DISTRACTORS_PER_WORD: 6,
  HINT_COUNT: 2,
  HINT_COUNT_SHORT: 1,
  /** Words shorter than this get only one hint (SPEC 2.6). */
  SHORT_WORD_LEN: 6,
  /** A sentence used this many times becomes eligible for refresh (SPEC 1.6). */
  REFRESH_THRESHOLD: 3,
  REFRESH_BATCH_MAX: 50,
  /** Safety cap against generate loops/bugs (SPEC 5.6). */
  DAILY_NEW_WORD_LIMIT: 50,
} as const;

export type Config = typeof CONFIG;
