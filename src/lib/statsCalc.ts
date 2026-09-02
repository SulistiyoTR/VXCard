import { addDays, today } from "./date";
import { bestStreak, currentStreak } from "./streak";
import type { Review, SessionRow, Word } from "./types";

export interface StatsOverview {
  streak: number;
  best: number;
  total: number;
  finished: number;
  levels: Record<number, number>;
  accuracy: { correct: number; slow: number; wrong: number } | null;
  refreshReady: number;
}

export function activeDays(sessions: readonly SessionRow[]): string[] {
  return sessions.filter((s) => s.completed).map((s) => s.started_at.slice(0, 10));
}

export function statsOverview(
  deck: readonly Word[],
  sessions: readonly SessionRow[],
  reviews: readonly Review[],
  now: string = today(),
): StatsOverview {
  const days = activeDays(sessions);
  const levels: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let refreshReady = 0;
  for (const w of deck) {
    levels[w.level] = (levels[w.level] ?? 0) + 1;
    if (w.sentences.some((s) => s.used_count >= 3)) refreshReady += 1;
  }

  const cutoff = addDays(now, -30);
  const recent = reviews.filter((r) => r.reviewed_at.slice(0, 10) >= cutoff);
  const n = recent.length;
  const accuracy =
    n === 0
      ? null
      : {
          correct: Math.round((recent.filter((r) => r.result === "correct").length / n) * 100),
          slow: Math.round((recent.filter((r) => r.result === "slow").length / n) * 100),
          wrong:
            Math.round(
              (recent.filter((r) => r.result === "wrong" || r.result === "dontknow").length / n) *
                100,
            ),
        };

  return {
    streak: currentStreak(days, now),
    best: bestStreak(days),
    total: deck.length,
    finished: levels[5] ?? 0,
    levels,
    accuracy,
    refreshReady,
  };
}

export interface CalendarDay {
  date: string;
  sessions: number;
  words: number;
}

export function monthActivity(
  sessions: readonly SessionRow[],
  month: string,
): { days: CalendarDay[]; firstEverMonth: string | null } {
  const inMonth = sessions.filter((s) => s.started_at.slice(0, 7) === month);
  const byDay = new Map<string, { sessions: number; words: number }>();
  for (const s of inMonth) {
    const key = s.started_at.slice(0, 10);
    const cur = byDay.get(key) ?? { sessions: 0, words: 0 };
    cur.sessions += 1;
    cur.words += s.answered ?? 0;
    byDay.set(key, cur);
  }
  const first = sessions
    .map((s) => s.started_at.slice(0, 7))
    .sort()
    .at(0);
  return {
    days: [...byDay.entries()].map(([date, v]) => ({ date, ...v })),
    firstEverMonth: first ?? null,
  };
}
