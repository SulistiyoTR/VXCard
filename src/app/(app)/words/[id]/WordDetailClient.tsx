"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { deleteWord, regenerateSentence, resetWord } from "@/lib/actions";
import { daysBetween, today } from "@/lib/date";
import type { Word } from "@/lib/types";
import { LevelDots, Screen } from "@/components/ui";
import { Speak } from "@/components/Speak";

export function WordDetailClient({
  word,
  counts,
}: {
  word: Word;
  counts: { reviewed: number; missed: number };
}) {
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState<null | "delete">(null);
  const [sentences, setSentences] = useState(word.sentences);
  const [showAll, setShowAll] = useState(false);
  const [busyIdx, setBusyIdx] = useState<number | null>(null);
  const [showMeanings, setShowMeanings] = useState(false);
  const [showOrigin, setShowOrigin] = useState(false);

  const days = daysBetween(today(), word.due_date);
  const nextLabel = days <= 0 ? "now" : days === 1 ? "tomorrow" : `in ${days} days`;
  const visible = showAll ? sentences : sentences.slice(0, 2);

  async function regen(i: number) {
    setBusyIdx(i);
    try {
      const fresh = await regenerateSentence(word.id, i);
      setSentences((s) => s.map((x, idx) => (idx === i ? fresh : x)));
    } finally {
      setBusyIdx(null);
    }
  }

  return (
    <Screen className="px-5 pb-10">
      <div className="flex items-center justify-between py-4">
        <button onClick={() => router.back()} className="text-text-dim">
          ←
        </button>
        <button onClick={() => setMenu((v) => !v)} className="text-text-dim text-xl">
          ⋯
        </button>
      </div>

      {menu && (
        <div className="mb-4 space-y-1 rounded-2xl border border-border bg-surface p-2 text-sm">
          <button
            className="w-full rounded-xl px-3 py-2 text-left text-bad active:bg-surface-2"
            onClick={() => {
              setMenu(false);
              setConfirm("delete");
            }}
          >
            Delete word
          </button>
          <button
            className="w-full rounded-xl px-3 py-2 text-left active:bg-surface-2"
            onClick={async () => {
              setMenu(false);
              await resetWord(word.id);
              router.refresh();
            }}
          >
            Reset progress
          </button>
        </div>
      )}

      <div className="text-3xl font-bold">{word.word}</div>
      {word.phonetic && (
        <div className="flex items-center gap-1 text-text-dim">
          <span className="font-mono text-sm">{word.phonetic}</span>
          <Speak word={word.word} audioUrl={word.audio_url} />
        </div>
      )}

      <div className="mt-3 text-sm text-text-faint">{word.pos}</div>
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
      <div className="text-sm uppercase tracking-wide text-text-faint">Examples</div>
      <ul className="mt-2 space-y-3">
        {visible.map((s, i) => (
          <li key={i} className="flex items-start justify-between gap-3">
            <span className="italic text-text-dim">&ldquo;{s.text}&rdquo;</span>
            <button
              onClick={() => regen(i)}
              disabled={busyIdx === i}
              className="shrink-0 text-accent disabled:opacity-40"
            >
              {busyIdx === i ? "…" : "✎"}
            </button>
          </li>
        ))}
      </ul>
      {sentences.length > 2 && !showAll && (
        <button className="mt-2 text-sm text-accent" onClick={() => setShowAll(true)}>
          (+{sentences.length - 2} more)
        </button>
      )}

      <div className="my-5 h-px bg-border" />
      <div className="text-sm uppercase tracking-wide text-text-faint">Progress</div>
      <div className="mt-2 space-y-1 text-sm">
        <div>
          <LevelDots level={word.level} streak={word.streak} />
        </div>
        <div className="flex justify-between">
          <span className="text-text-faint">Next review</span>
          <span>{nextLabel}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-faint">Added</span>
          <span>{word.created_at.slice(0, 10)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-faint">Reviewed</span>
          <span>{counts.reviewed} times</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-faint">Missed</span>
          <span>{counts.missed} times</span>
        </div>
      </div>

      {confirm === "delete" && (
        <div className="fixed inset-0 z-20 flex items-end bg-black/60 p-5 safe-b">
          <div className="w-full rounded-3xl border border-border bg-surface p-5">
            <p className="font-semibold">Delete &ldquo;{word.word}&rdquo;?</p>
            <p className="mt-1 text-sm text-text-dim">This can&rsquo;t be undone.</p>
            <div className="mt-4 flex gap-2">
              <button
                className="flex-1 rounded-2xl bg-surface-2 py-3"
                onClick={() => setConfirm(null)}
              >
                Cancel
              </button>
              <button
                className="flex-1 rounded-2xl bg-bad/20 py-3 text-bad"
                onClick={async () => {
                  await deleteWord(word.id);
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
