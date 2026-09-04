"use client";

import Link from "next/link";
import { statsOverview } from "@/lib/statsCalc";
import { useAppData } from "@/lib/store/provider";
import { EnableReminders } from "@/components/EnableReminders";
import { PageTitle, Screen, Tally } from "@/components/ui";
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

  return (
    <Screen className="px-5 pb-6">
      <PageTitle right={online ? undefined : "offline"}>Stats</PageTitle>

      <div className="flex flex-col items-center text-center">
        <Tally count={s.streak} className="justify-center text-[30px]" />
        <div className="mt-3.5 font-serif text-[15px] text-text-dim">
          {s.streak > 0
            ? `${s.streak}-day streak · best ${s.best}`
            : `No streak yet · best ${s.best}`}
        </div>
      </div>

      <Link
        href="/stats/calendar"
        className="mt-5 flex items-center justify-between rounded-[var(--r-input)] border border-border bg-surface px-4 py-3.5"
      >
        <span className="text-sm text-text-dim">View calendar</span>
        <span className="font-mono tracking-[2px] text-text-faint">░░▒░▓▒░▓░░▒▓</span>
      </Link>

      <Divider />
      <div className="flex justify-between">
        <span>{s.total} words</span>
        <span className="text-text-dim">{s.finished} finished</span>
      </div>

      <Divider />
      <Label>Level breakdown</Label>
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
      <Label>Accuracy · 30 days</Label>
      {s.accuracy ? (
        <div className="mt-2 flex justify-around text-sm tabular-nums">
          <span className="text-good">✓ {s.accuracy.correct}%</span>
          <span className="text-slow">~ {s.accuracy.slow}%</span>
          <span className="text-text-dim">✕ {s.accuracy.wrong}%</span>
        </div>
      ) : (
        <p className="mt-2 text-sm text-text-faint">No reviews yet.</p>
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

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-faint">
      {children}
    </div>
  );
}
