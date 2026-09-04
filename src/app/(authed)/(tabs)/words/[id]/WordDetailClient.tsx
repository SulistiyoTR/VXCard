"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { addDays, daysBetween, today } from "@/lib/date";
import { useAppData } from "@/lib/store/provider";
import type { Word } from "@/lib/types";
import { LevelDots, Screen } from "@/components/ui";
import { Speak } from "@/components/Speak";

export function WordDetailClient({ word }: { word: Word }) {
  const router = useRouter();
  const { patchWord, removeWord, hideSentence } = useAppData();
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [busyIdx, setBusyIdx] = useState<number | null>(null);
  const [showMeanings, setShowMeanings] = useState(false);
  const [showOrigin, setShowOrigin] = useState(false);

  const days = daysBetween(today(), word.due_date);
  const nextLabel = days <= 0 ? "now" : days === 1 ? "tomorrow" : `in ${days} days`;

  // Sentences this user still sees: not flagged out globally, not hidden by them.
  const available = word.sentences
    .map((s, idx) => ({ s, idx }))
    .filter(({ s, idx }) => !s.flagged && !word.hidden_sentences.includes(idx));
  const visible = showAll ? available : available.slice(0, 2);

  // "Change this sentence" (SPEC 1.6): hide for this user + queue the global bump.
  async function hide(idx: number) {
    setBusyIdx(idx);
    try {
      await hideSentence(word.id, idx);
    } finally {
      setBusyIdx(null);
    }
  }

  async function reset() {
    await patchWord(word.id, {
      level: 1,
      streak: 0,
      lapse_count: 0,
      due_date: addDays(today(), 1),
    });
    setMenu(false);
  }

  return (
    <Screen className="px-5 pb-10">
      <div className="flex items-center justify-between py-2">
        <button
          onClick={() => router.back()}
          aria-label="Back"
          className="press -ml-2 flex h-10 w-10 items-center justify-center text-lg text-text-dim"
        >
          ←
        </button>
        <button
          onClick={() => setMenu((v) => !v)}
          aria-label="Word options"
          className="press -mr-2 flex h-10 w-10 items-center justify-center text-xl text-text-dim"
        >
          ⋯
        </button>
      </div>

      {menu && (
        <div className="mb-4 space-y-1 rounded-[var(--r-input)] border border-border bg-surface p-2 text-sm">
          <button
            className="w-full rounded-xl px-3 py-2 text-left text-bad active:bg-surface-2"
            onClick={() => {
              setMenu(false);
              setConfirm(true);
            }}
          >
            Delete word
          </button>
          <button
            className="w-full rounded-xl px-3 py-2 text-left active:bg-surface-2"
            onClick={reset}
          >
            Reset progress
          </button>
        </div>
      )}

      <div className="font-serif text-[28px] font-medium tracking-[-0.01em]">{word.word}</div>
      {word.phonetic && (
        <div className="flex items-center gap-1 text-text-dim">
          <span className="font-mono text-sm">{word.phonetic}</span>
          <Speak word={word.word} audioUrl={word.audio_url} />
        </div>
      )}

      <div className="mt-3 font-serif text-[15px] italic text-text-faint">{word.pos}</div>
      <div>{word.definition}</div>

      {word.other_meanings.length > 0 && (
        <div className="mt-2">
          <button className="text-sm text-accent" onClick={() => setShowMeanings((v) => !v)}>
            {showMeanings ? "▾" : "▸"} {word.other_meanings.length} more meaning
            {word.other_meanings.length > 1 ? "s" : ""}
          </button>
          {showMeanings && (
            <ul className="mt-1 space-y-1 text-sm text-text-dim">
              {word.other_meanings.map((m, i) => (
                <li key={i}>
                  <span className="text-text-faint">{m.pos}</span> {m.definition}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {word.origin && (
        <div className="mt-1">
          <button className="text-sm text-accent" onClick={() => setShowOrigin((v) => !v)}>
            {showOrigin ? "▾" : "▸"} Origin
          </button>
          {showOrigin && <p className="mt-1 text-sm text-text-dim">{word.origin}</p>}
        </div>
      )}

      <div className="my-5 h-px bg-border" />
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-faint">
        Examples
      </div>
      <ul className="mt-2 space-y-3">
        {visible.map(({ s, idx }) => (
          <li key={idx} className="flex items-start justify-between gap-3">
            <span className="italic text-text-dim">&ldquo;{s.text}&rdquo;</span>
            <button
              onClick={() => hide(idx)}
              disabled={busyIdx === idx}
              title="Hide this sentence"
              className="shrink-0 text-accent disabled:opacity-30"
            >
              {busyIdx === idx ? "…" : "✎"}
            </button>
          </li>
        ))}
        {visible.length === 0 && <li className="text-sm text-text-faint">No example sentences.</li>}
      </ul>
      {available.length > 2 && !showAll && (
        <button className="mt-2 text-sm text-accent" onClick={() => setShowAll(true)}>
          (+{available.length - 2} more)
        </button>
      )}

      <div className="my-5 h-px bg-border" />
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-faint">
        Progress
      </div>
      <div className="mt-2 space-y-1 text-sm">
        <div>
          <LevelDots level={word.level} streak={word.streak} />
        </div>
        <Line label="Next review" value={nextLabel} />
        <Line label="Added" value={word.created_at.slice(0, 10)} />
        <Line label="Reviewed" value={`${word.review_count} times`} />
        <Line label="Missed" value={`${word.lapse_count} times`} />
      </div>

      {confirm && (
        <div className="fixed inset-0 z-20 flex items-end bg-black/60 p-5 safe-b">
          <div className="edge w-full rounded-[var(--r-card)] border border-border bg-surface p-5">
            <p className="font-serif text-xl font-medium">Delete &ldquo;{word.word}&rdquo;?</p>
            <p className="mt-1 text-sm text-text-dim">This can&rsquo;t be undone.</p>
            <div className="mt-4 flex gap-2">
              <button
                className="flex-1 rounded-[var(--r-control)] bg-surface-2 py-3"
                onClick={() => setConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="flex-1 rounded-[var(--r-control)] bg-bad/20 py-3 text-bad"
                onClick={async () => {
                  await removeWord(word.id);
                  router.push("/words");
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <Link href="/words" className="mt-6 text-sm text-text-faint">
        ← All words
      </Link>
    </Screen>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-text-faint">{label}</span>
      <span>{value}</span>
    </div>
  );
}
