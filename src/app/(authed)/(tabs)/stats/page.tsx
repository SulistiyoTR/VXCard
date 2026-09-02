"use client";

import Link from "next/link";
import { CONFIG } from "@/lib/config";
import { statsOverview } from "@/lib/statsCalc";
import { useAppData } from "@/lib/store/provider";
import { EnableReminders } from "@/components/EnableReminders";
import { PageTitle, Screen } from "@/components/ui";
import { RefreshSentencesButton } from "./RefreshSentencesButton";
import { SignOutButton } from "./SignOutButton";

const LEVEL_ROWS: { key: number; label: string }[] = [
  { key: 1, label: "L1" },
  { key: 2, label: "L2" },
  { key: 3, label: "L3" },
  { key: 4, label: "L4" },
  { key: 5, label: "✓" },
];

export default function StatsPage() {
  const { deck, sessions, reviews, online } = useAppData();
  const s = statsOverview(deck, sessions, reviews);
  const maxLevel = Math.max(1, ...Object.values(s.levels));

  const staleSubjects = deck
    .filter((w) => w.sentences.some((x) => x.used_count >= CONFIG.REFRESH_THRESHOLD))
    .map((w) => ({ id: w.id, word: w.word, pos: w.pos, definition: w.definition }));

  return (
    <Screen className="px-5 pb-6">
      <PageTitle right={online ? undefined : "offline"}>Stats</PageTitle>

      <div className="text-center">
        <div className="text-4xl">🔥 {s.streak}</div>
        <div className="text-text-dim">day streak</div>
        <div className="text-sm text-text-faint">best: {s.best} days</div>
      </div>

      <Link
        href="/stats/calendar"
        className="mt-4 block rounded-2xl border border-border bg-surface py-3 text-center"
      >
        📅 Calendar
      </Link>

      <Divider />
      <div className="flex justify-between">
        <span>{s.total} words</span>
        <span className="text-text-dim">{s.finished} finished</span>
      </div>

      <Divider />
      <div className="text-sm uppercase tracking-wide text-text-faint">Level breakdown</div>
      <div className="mt-2 space-y-1">
        {LEVEL_ROWS.map(({ key, label }) => (
          <div key={key} className="flex items-center gap-3 text-sm">
            <span className="w-6 text-text-dim">{label}</span>
            <div className="h-3 flex-1 overflow-hidden rounded bg-surface-2">
              <div
                className="h-full bg-accent/70"
                style={{ width: `${((s.levels[key] ?? 0) / maxLevel) * 100}%` }}
              />
            </div>
            <span className="w-8 text-right tabular-nums text-text-dim">{s.levels[key] ?? 0}</span>
          </div>
        ))}
      </div>

      <Divider />
      <div className="text-sm uppercase tracking-wide text-text-faint">Accuracy (30 days)</div>
      {s.accuracy ? (
        <div className="mt-2 flex justify-around text-sm">
          <span>✅ {s.accuracy.correct}%</span>
          <span>🐢 {s.accuracy.slow}%</span>
          <span>❌ {s.accuracy.wrong}%</span>
        </div>
      ) : (
        <p className="mt-2 text-sm text-text-faint">No reviews yet.</p>
      )}

      {staleSubjects.length > 0 && (
        <>
          <Divider />
          <RefreshSentencesButton subjects={staleSubjects} disabled={!online} />
        </>
      )}

      <Divider />
      <EnableReminders />

      <Divider />
      <SignOutButton />
    </Screen>
  );
}

function Divider() {
  return <div className="my-4 h-px bg-border" />;
}
