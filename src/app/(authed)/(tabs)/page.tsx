"use client";

import { CONFIG } from "@/lib/config";
import { today } from "@/lib/date";
import { dueCount, hardModeEligible, hardModeUnlocked } from "@/lib/session";
import { activeDays } from "@/lib/statsCalc";
import { currentStreak } from "@/lib/streak";
import { useAppData } from "@/lib/store/provider";
import { waitingIndicator } from "@/lib/waiting";
import { ButtonLink, Screen } from "@/components/ui";

const DEFAULT_QUOTA = 15;

export default function HomePage() {
  const { deck, sessions, online, ready } = useAppData();

  const streak = currentStreak(activeDays(sessions), today());
  const due = dueCount(deck);
  const waiting = waitingIndicator(due, DEFAULT_QUOTA);
  const eligible = hardModeEligible(deck).length;
  const hmUnlocked = hardModeUnlocked(deck);

  const reviewHref =
    deck.length === 0 ? "/add" : deck.length < 10 ? "/session?mode=due" : "/session/setup";

  return (
    <Screen className="px-5 pb-4 pt-12 safe-b">
      <div className="flex items-center justify-between text-text-dim">
        <span className="text-[15px]">
          🔥 <b className="font-semibold text-text">{streak}</b>{" "}
          {streak === 1 ? "day" : "days"}
        </span>
        {!online && <span className="text-xs text-slow">offline</span>}
      </div>

      <div className="mt-6">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-faint">
          Today
        </div>
        <div className="mt-2.5 flex items-baseline gap-2 font-serif text-[30px] font-medium leading-tight tracking-[-0.015em]">
          <span>{ready ? waiting.message : "…"}</span>
          {ready && waiting.tone === "warn" && (
            <span className="text-base text-text-faint">⚠</span>
          )}
        </div>
        {ready && waiting.hint && <p className="mt-2 text-sm text-text-faint">{waiting.hint}</p>}
      </div>

      <div className="mt-auto space-y-3 pb-2">
        <ButtonLink href={reviewHref}>▶ Review</ButtonLink>

        {hmUnlocked ? (
          <ButtonLink href="/session?mode=hardmode" variant="secondary">
            ⚡ Hard Mode
          </ButtonLink>
        ) : (
          <div className="edge pointer-events-none flex w-full items-center justify-center gap-2 rounded-[14px] border border-border bg-surface px-5 py-4 font-serif text-[17px] font-medium text-text-faint">
            🔒 Hard Mode · {eligible}/{CONFIG.HARD_MODE_MIN}
          </div>
        )}

        <ButtonLink href="/add" variant="secondary">
          ＋ Add word
        </ButtonLink>
      </div>
    </Screen>
  );
}
