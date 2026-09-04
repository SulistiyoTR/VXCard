"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { daysBetween, today } from "@/lib/date";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { PageTitle, Screen } from "@/components/ui";

interface Row {
  id: string;
  word: string;
  pos: string;
  definition: string;
  level: number;
  streak: number;
  due_date: string;
  created_at: string;
}

type Filter = "All" | "L1" | "L2" | "L3" | "L4" | "Finished";
const FILTERS: Filter[] = ["All", "L1", "L2", "L3", "L4", "Finished"];
const SORT_KEY = "vx.wordSort";

function dueLabel(due: string): string {
  const d = daysBetween(today(), due);
  if (d <= 0) return "due now";
  if (d === 1) return "tomorrow";
  return `in ${d}d`;
}

function levelTag(level: number, streak: number): string {
  if (level >= 5) return "✓";
  const target = ({ 1: 2, 2: 2, 3: 3, 4: 3 } as Record<number, number>)[level] ?? 3;
  return `L${level} ${Array.from({ length: target }, (_, i) => (i < streak ? "●" : "○")).join("")}`;
}

export function WordsClient({ words }: { words: Row[] }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("All");
  const [storedSort, setStoredSort] = useLocalStorage(SORT_KEY);
  const sort: "az" | "new" = storedSort === "new" ? "new" : "az";

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { All: words.length, L1: 0, L2: 0, L3: 0, L4: 0, Finished: 0 };
    for (const w of words) {
      if (w.level >= 5) c.Finished++;
      else c[`L${w.level}` as Filter]++;
    }
    return c;
  }, [words]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = words.filter((w) => {
      if (filter === "Finished" && w.level < 5) return false;
      if (filter.startsWith("L") && `L${w.level}` !== filter) return false;
      if (needle && !w.word.toLowerCase().includes(needle) && !w.definition.toLowerCase().includes(needle))
        return false;
      return true;
    });
    list = list.sort((a, b) =>
      sort === "az" ? a.word.localeCompare(b.word) : b.created_at.localeCompare(a.created_at),
    );
    return list;
  }, [words, q, filter, sort]);

  return (
    <Screen>
      <PageTitle right={String(words.length)}>My words</PageTitle>

      <div className="px-5">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search"
          autoCorrect="off"
          className="w-full rounded-[var(--r-input)] border border-border bg-surface px-4 py-3 outline-none focus:border-accent"
        />
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto px-5 pb-1">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`whitespace-nowrap rounded-full border px-3 py-1 text-sm ${
              filter === f ? "border-accent bg-accent/10" : "border-border text-text-dim"
            }`}
          >
            {f}
            {f !== "All" && counts[f] > 0 ? ` (${counts[f]})` : ""}
          </button>
        ))}
      </div>

      <div className="flex justify-end px-5 py-2">
        <button
          onClick={() => setStoredSort(sort === "az" ? "new" : "az")}
          className="text-sm text-text-dim"
        >
          ⇅ {sort === "az" ? "A–Z" : "Newest"}
        </button>
      </div>

      <ul className="flex-1 divide-y divide-border">
        {shown.length === 0 && <li className="px-5 py-8 text-text-faint">No words here yet.</li>}
        {shown.map((w) => (
          <li key={w.id}>
            <Link href={`/words/${w.id}`} className="flex items-center justify-between px-5 py-3">
              <div>
                <div className="font-medium">{w.word}</div>
                <div className="text-sm text-text-faint">{w.pos}</div>
              </div>
              <div className="text-right text-sm text-text-dim">
                <div>{levelTag(w.level, w.streak)}</div>
                <div className="text-text-faint">{dueLabel(w.due_date)}</div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </Screen>
  );
}
