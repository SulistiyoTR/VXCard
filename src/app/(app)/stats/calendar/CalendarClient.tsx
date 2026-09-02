"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { calendarMonth } from "@/lib/actions";
import type { CalendarDay } from "@/lib/stats";
import { Screen } from "@/components/ui";

interface MonthData {
  days: CalendarDay[];
  firstEverMonth: string | null;
}

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
  month: initialMonth,
  initial,
  todayISO,
}: {
  month: string;
  initial: MonthData;
  todayISO: string;
}) {
  const [month, setMonth] = useState(initialMonth);
  const [data, setData] = useState<MonthData>(initial);
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const currentMonth = todayISO.slice(0, 7);
  const byDay = useMemo(() => new Map(data.days.map((d) => [d.date, d])), [data.days]);

  const canNext = month < currentMonth;
  const canPrev = !data.firstEverMonth || month > data.firstEverMonth;

  function go(delta: number) {
    const next = shiftMonth(month, delta);
    if (delta > 0 && !canNext) return;
    if (delta < 0 && !canPrev) return;
    setMonth(next);
    setSelected(null);
    startTransition(async () => {
      setData(await calendarMonth(next));
    });
  }

  const [y, m] = month.split("-").map(Number);
  const total = daysInMonth(month);
  const pad = firstWeekday(month);
  const activeDays = data.days.filter((d) => d.sessions > 0);
  const totalSessions = data.days.reduce((s, d) => s + d.sessions, 0);

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
        <button
          onClick={() => go(-1)}
          disabled={!canPrev}
          className="px-3 text-lg disabled:opacity-25"
        >
          ‹
        </button>
        <span className={pending ? "opacity-50" : ""}>
          {MONTH_NAMES[m - 1]} {y}
        </span>
        <button
          onClick={() => go(1)}
          disabled={!canNext}
          className="px-3 text-lg disabled:opacity-25"
        >
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

      {selectedData && (
        <div className="mt-3 rounded-2xl border border-border bg-surface p-3 text-sm">
          {Number(selected!.slice(-2))} {MONTH_NAMES[m - 1].slice(0, 3)} ·{" "}
          {selectedData.sessions} session{selectedData.sessions === 1 ? "" : "s"} ·{" "}
          {selectedData.words} words
        </div>
      )}
      {selected && !selectedData && (
        <div className="mt-3 text-sm text-text-faint">
          {Number(selected.slice(-2))} {MONTH_NAMES[m - 1].slice(0, 3)} · no activity
        </div>
      )}

      <div className="mt-6 flex items-center gap-2 text-xs text-text-faint">
        Less <span>░</span> <span>▒</span> <span>▓</span> More
      </div>
    </Screen>
  );
}
