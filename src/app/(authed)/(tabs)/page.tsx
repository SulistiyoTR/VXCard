"use client";

import { CONFIG } from "@/lib/config";
import { today } from "@/lib/date";
import { dueCount, hardModeEligible, hardModeUnlocked } from "@/lib/session";
import { activeDays } from "@/lib/statsCalc";
import { bestStreak, currentStreak } from "@/lib/streak";
import { useAppData } from "@/lib/store/provider";
import { waitingIndicator } from "@/lib/waiting";
import { Button, ButtonLink, Screen, Tally } from "@/components/ui";
import { IconPlay, IconPlus, IconWarning } from "@/components/icons";

const DEFAULT_QUOTA = 15;

export default function HomePage() {
  const { deck, sessions, firstName, online, ready } = useAppData();

  const days = activeDays(sessions);
  const streak = currentStreak(days, today());
  const best = bestStreak(days);
  const empty = deck.length === 0;
  const due = dueCount(deck);
  const waiting = waitingIndicator(due, DEFAULT_QUOTA);
  const eligible = hardModeEligible(deck).length;
  const hmUnlocked = hardModeUnlocked(deck);

  const reviewHref = deck.length < 10 ? "/session?mode=due" : "/session/setup";

  const streakLine =
    streak > 0
      ? `${streak} ${streak === 1 ? "day" : "days"} running · best ${best}`
      : "No streak yet — one session starts it";

  return (
    <Screen className="px-5 pb-4 pt-12 safe-b">
      <div className="flex min-h-[1rem] items-center justify-between text-[11px] font-semibold uppercase tracking-[0.16em]">
        <span className="text-accent">{firstName ??" "}</span>
        {!online && <span className="text-text-faint">offline</span>}
      </div>

      <div className="mt-5">
        <Tally count={streak} className="text-[26px]" />
        <p className="mt-3 font-serif text-[15px] text-text-dim">{streakLine}</p>
      </div>

      <div className="my-6 h-px bg-border" />

      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-faint">
          Today
        </div>
        <div className="mt-2.5 flex items-baseline gap-2 font-serif text-[30px] font-bold leading-tight tracking-[-0.01em]">
          <span>{!ready ? "…" : empty ? "Nothing to review yet" : waiting.message}</span>
          {ready && !empty && waiting.tone === "warn" && (
            <IconWarning className="text-base text-slow" />
          )}
        </div>
        {ready &&
          (empty ? (
            <p className="mt-2 text-sm text-text-faint">Your deck is empty. Add a word to get started.</p>
          ) : (
            waiting.hint && <p className="mt-2 text-sm text-text-faint">{waiting.hint}</p>
          ))}
      </div>

      <div className="mt-auto space-y-3 pb-2">
        {empty ? (
          <>
            <Button disabled>
              <IconPlay /> Review
            </Button>
            <p className="text-center text-[12.5px] text-text-faint">
              Add your first word before you can review
            </p>
            <ButtonLink href="/add">
              <IconPlus /> Add word
            </ButtonLink>
          </>
        ) : (
          <>
            <ButtonLink href={reviewHref}>
              <IconPlay /> Review
            </ButtonLink>

            {hmUnlocked ? (
              <ButtonLink href="/session?mode=hardmode" variant="secondary">
                Hard Mode
              </ButtonLink>
            ) : (
              <p className="text-center text-[12.5px] text-text-faint">
                Hard Mode unlocks at {CONFIG.HARD_MODE_MIN} eligible words — you have {eligible}
              </p>
            )}

            <ButtonLink href="/add" variant="secondary">
              <IconPlus /> Add word
            </ButtonLink>
          </>
        )}
      </div>
    </Screen>
  );
}
