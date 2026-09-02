"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { monthActivity } from "@/lib/statsCalc";
import type { SessionRow } from "@/lib/types";
import { Screen } from "@/components/ui";

const WEEK = ["M", "T", "W", "T", "F", "S", "S"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

/** 0 = Monday … 6 = Sunday */
function firstWeekday(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return (new Date(y, m - 1, 1).getDay() + 6) % 7;
}

function glyph(sessions: number): string {
  if (sessions >= 3) return "▓";
  if (sessions === 2) return "▒";
  if (sessions === 1) return "░";
  return "";
}

export function CalendarClient({
  sessions,
  todayISO,
}: {
  sessions: SessionRow[];
  todayISO: string;
}) {
  const currentMonth = todayISO.slice(0, 7);
  const [month, setMonth] = useState(currentMonth);
  const [selected, setSelected] = useState<string | null>(null);

  const { data, byDay } = useMemo(() => {
    const d = monthActivity(sessions, month);
    return { data: d, byDay: new Map(d.days.map((x) => [x.date, x])) };
  }, [sessions, month]);

  const canNext = month < currentMonth;
  const canPrev = !data.firstEverMonth || month > data.firstEverMonth;

  function go(delta: number) {
    if (delta > 0 && !canNext) return;
    if (delta < 0 && !canPrev) return;
    setSelected(null);
    setMonth((m) => shiftMonth(m, delta));
  }

  const [y, m] = month.split("-").map(Number);
  const total = daysInMonth(month);
  const pad = firstWeekday(month);
  const activeDays = data.days.filter((d) => d.sessions > 0);
  const totalSessions = data.days.reduce((sum, d) => sum + d.sessions, 0);
  const selectedData = selected ? byDay.get(selected) : null;

  return (
    <Screen className="px-5 pb-8">
      <div className="flex items-center gap-3 py-4">
        <Link href="/stats" className="text-text-dim">
          ←
        </Link>
        <h1 className="text-xl font-bold">Activity</h1>
      </div>

      <div className="flex items-center justify-between py-2">
        <button onClick={() => go(-1)} disabled={!canPrev} className="px-3 text-lg disabled:opacity-25">
          ‹
        </button>
        <span>
          {MONTH_NAMES[m - 1]} {y}
        </span>
        <button onClick={() => go(1)} disabled={!canNext} className="px-3 text-lg disabled:opacity-25">
          ›
        </button>
      </div>

      <div className="mt-2 grid grid-cols-7 gap-1 text-center text-xs text-text-faint">
        {WEEK.map((d, i) => (
          <div key={i}>{d}</div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1 text-center">
        {Array.from({ length: pad }, (_, i) => (
          <div key={`p${i}`} />
        ))}
        {Array.from({ length: total }, (_, i) => {
          const date = `${month}-${String(i + 1).padStart(2, "0")}`;
          const day = byDay.get(date);
          const isToday = date === todayISO;
          const isFuture = date > todayISO;
          return (
            <button
              key={date}
              onClick={() => setSelected(date)}
              className={`flex aspect-square flex-col items-center justify-center rounded-lg text-[10px] ${
                isToday ? "border border-accent" : ""
              } ${selected === date ? "bg-surface-2" : ""}`}
            >
              <span className="text-text-faint">{i + 1}</span>
              <span className="text-sm leading-none">
                {isFuture ? <span className="text-text-faint">·</span> : glyph(day?.sessions ?? 0)}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-6 text-sm text-text-dim">
        {MONTH_NAMES[m - 1]} {y}
        <br />
        {activeDays.length} days active · {totalSessions} sessions
      </div>

      {selected && (
        <div className="mt-3 text-sm text-text-dim">
          {Number(selected.slice(-2))} {MONTH_NAMES[m - 1].slice(0, 3)} ·{" "}
          {selectedData
            ? `${selectedData.sessions} session${selectedData.sessions === 1 ? "" : "s"} · ${selectedData.words} words`
            : "no activity"}
        </div>
      )}

      <div className="mt-6 flex items-center gap-2 text-xs text-text-faint">
        Less <span>░</span> <span>▒</span> <span>▓</span> More
      </div>
    </Screen>
  );
}
