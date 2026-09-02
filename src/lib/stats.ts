import "server-only";
import { addDays, today } from "@/lib/date";
import { requireUser } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { bestStreak, currentStreak } from "@/lib/streak";
import type { ReviewResult } from "@/lib/types";

export interface StatsOverview {
  streak: number;
  best: number;
  total: number;
  finished: number;
  levels: Record<number, number>;
  accuracy: { correct: number; slow: number; wrong: number } | null; // percentages, 30d
  refreshReady: number;
}

async function activeDays(): Promise<string[]> {
  const supabase = await createClient();
  const user = await requireUser();
  const { data } = await supabase
    .from("sessions")
    .select("started_at")
    .eq("user_id", user.id)
    .eq("completed", true);
  return (data ?? []).map((r) => (r.started_at as string).slice(0, 10));
}

export async function getStreak(): Promise<{ streak: number; best: number }> {
  const days = await activeDays();
  return { streak: currentStreak(days, today()), best: bestStreak(days) };
}

export async function getStatsOverview(): Promise<StatsOverview> {
  const supabase = await createClient();
  const user = await requireUser();

  const [{ data: words }, { data: reviews }, days] = await Promise.all([
    supabase.from("words").select("level, sentences").eq("user_id", user.id),
    supabase
      .from("reviews")
      .select("result")
      .eq("user_id", user.id)
      .gte("reviewed_at", addDays(today(), -30)),
    activeDays(),
  ]);

  const levels: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let refreshReady = 0;
  for (const w of (words ?? []) as { level: number; sentences: { used_count: number }[] }[]) {
    levels[w.level] = (levels[w.level] ?? 0) + 1;
    if ((w.sentences ?? []).some((s) => s.used_count >= 3)) refreshReady += 1;
  }

  const results = (reviews ?? []).map((r) => r.result as ReviewResult);
  const n = results.length;
  const accuracy =
    n === 0
      ? null
      : {
          correct: Math.round((results.filter((r) => r === "correct").length / n) * 100),
          slow: Math.round((results.filter((r) => r === "slow").length / n) * 100),
          wrong: Math.round((results.filter((r) => r === "wrong" || r === "dontknow").length / n) * 100),
        };

  return {
    streak: currentStreak(days, today()),
    best: bestStreak(days),
    total: (words ?? []).length,
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

/** Session activity for a given month (SPEC 4.11). `month` is `YYYY-MM`. */
export async function getMonthActivity(month: string): Promise<{
  days: CalendarDay[];
  firstEverMonth: string | null;
}> {
  const supabase = await createClient();
  const user = await requireUser();

  const start = `${month}-01`;
  const end = addDays(`${month}-01`, 31).slice(0, 7) + "-01";

  const [{ data: sessions }, { data: firstReview }] = await Promise.all([
    supabase
      .from("sessions")
      .select("started_at, answered")
      .eq("user_id", user.id)
      .gte("started_at", start)
      .lt("started_at", end),
    supabase
      .from("sessions")
      .select("started_at")
      .eq("user_id", user.id)
      .order("started_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  const byDay = new Map<string, { sessions: number; words: number }>();
  for (const s of (sessions ?? []) as { started_at: string; answered: number }[]) {
    const key = s.started_at.slice(0, 10);
    const cur = byDay.get(key) ?? { sessions: 0, words: 0 };
    cur.sessions += 1;
    cur.words += s.answered ?? 0;
    byDay.set(key, cur);
  }

  return {
    days: [...byDay.entries()].map(([date, v]) => ({ date, ...v })),
    firstEverMonth: firstReview ? (firstReview.started_at as string).slice(0, 7) : null,
  };
}
