"use client";

import Link from "next/link";
import { statsOverview } from "@/lib/statsCalc";
import { useAppData } from "@/lib/store/provider";
import { EnableReminders } from "@/components/EnableReminders";
import { PageTitle, Screen, SectionLabel, Tally } from "@/components/ui";
import { IconChevronRight, IconCheck, IconClose, IconSlow } from "@/components/icons";
import { SignOutButton } from "./SignOutButton";

const LEVEL_ROWS: { key: number; label: React.ReactNode }[] = [
  { key: 1, label: "L1" },
  { key: 2, label: "L2" },
  { key: 3, label: "L3" },
  { key: 4, label: "L4" },
  { key: 5, label: <IconCheck /> },
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
        className="mt-5 flex items-center justify-between border border-border border-t-2 border-t-border-strong bg-surface px-4 py-3.5"
      >
        <span className="text-sm text-text-dim">View calendar</span>
        <span className="flex items-center gap-1.5 text-text-faint">
          <span className="flex gap-[3px]" aria-hidden="true">
            {[0.25, 0.6, 0.35, 0.9, 0.5, 0.25, 0.7].map((o, i) => (
              <i key={i} className="block h-3 w-2 bg-current" style={{ opacity: o }} />
            ))}
          </span>
          <IconChevronRight />
        </span>
      </Link>

      <Divider />
      <div className="flex justify-between">
        <span>{s.total} words</span>
        <span className="text-text-dim">{s.finished} finished</span>
      </div>

      <Divider />
      <SectionLabel>Level breakdown</SectionLabel>
      <div className="mt-3 space-y-1">
        {LEVEL_ROWS.map(({ key, label }) => (
          <div key={key} className="flex items-center gap-3 text-sm">
            <span className="flex w-6 items-center text-text-dim">{label}</span>
            <div className="h-3 flex-1 overflow-hidden border border-border bg-surface-2">
              <div
                className="h-full bg-accent"
                style={{ width: `${((s.levels[key] ?? 0) / maxLevel) * 100}%` }}
              />
            </div>
            <span className="w-8 text-right tabular-nums text-text-dim">{s.levels[key] ?? 0}</span>
          </div>
        ))}
      </div>

      <Divider />
      <SectionLabel>Accuracy · 30 days</SectionLabel>
      {s.accuracy ? (
        <div className="mt-3 flex justify-around text-sm tabular-nums">
          <span className="inline-flex items-center gap-1.5 text-good">
            <IconCheck /> {s.accuracy.correct}%
          </span>
          <span className="inline-flex items-center gap-1.5 text-slow">
            <IconSlow /> {s.accuracy.slow}%
          </span>
          <span className="inline-flex items-center gap-1.5 text-text-dim">
            <IconClose /> {s.accuracy.wrong}%
          </span>
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
