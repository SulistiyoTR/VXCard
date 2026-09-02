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
    <Screen className="gap-6 px-5 pt-10">
      <div className="flex items-center justify-between text-text-dim">
        <span className="text-lg">
          🔥 {streak} {streak === 1 ? "day" : "days"}
        </span>
        {!online && <span className="text-xs text-slow">offline</span>}
      </div>

      <div>
        <div className="text-sm uppercase tracking-wide text-text-faint">Today</div>
        <div className="mt-1 flex items-center gap-2 text-xl">
          <span>{ready ? waiting.message : "…"}</span>
          {ready && waiting.tone === "warn" && <span className="text-text-faint">⚠</span>}
        </div>
        {ready && waiting.hint && <p className="mt-1 text-sm text-text-faint">{waiting.hint}</p>}
      </div>

      <div className="mt-2 space-y-3">
        <ButtonLink href={reviewHref}>▶ Review</ButtonLink>

        {hmUnlocked ? (
          <ButtonLink href="/session?mode=hardmode" variant="secondary">
            ⚡ Hard Mode
          </ButtonLink>
        ) : (
          <div className="pointer-events-none flex w-full items-center justify-center gap-2 rounded-2xl bg-surface-2 px-5 py-4 text-base font-semibold text-text-faint">
            🔒 Hard Mode · {eligible}/{CONFIG.HARD_MODE_MIN} words
          </div>
        )}

        <ButtonLink href="/add" variant="secondary">
          + Add word
        </ButtonLink>
      </div>
    </Screen>
  );
}
