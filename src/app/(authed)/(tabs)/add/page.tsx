"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { addDays, today } from "@/lib/date";
import type { GeneratedPackage, Word } from "@/lib/types";
import { useAppData } from "@/lib/store/provider";
import { Button, Card, Screen } from "@/components/ui";
import { WordPackage } from "@/components/WordPackage";

function packageToWord(pkg: GeneratedPackage): Word {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    user_id: "",
    word: pkg.word,
    created_at: now,
    updated_at: now,
    phonetic: pkg.phonetic,
    audio_url: pkg.audio_url,
    pos: pkg.pos,
    definition: pkg.definition,
    origin: pkg.origin,
    other_meanings: pkg.other_meanings,
    sentences: pkg.sentences,
    distractor_defs: pkg.distractor_defs,
    distractor_words: pkg.distractor_words,
    level: 1,
    streak: 0,
    due_date: addDays(today(), 1),
    lapse_count: 0,
    review_count: 0,
    last_seen_date: null,
  };
}

type GenResponse =
  | { status: "ok"; package: GeneratedPackage }
  | { status: "duplicate"; word: { id: string; word: string; level: number; due_date: string } }
  | { status: "suggestion"; word: string; suggestion: string }
  | { status: "not_found"; word: string }
  | { status: "phrase" }
  | { status: "unavailable" }
  | { status: "rate_limited"; limit: number };

export default function AddWordPage() {
  const { addWord, online, deck } = useAppData();
  const [term, setTerm] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "preview">("idle");
  const [result, setResult] = useState<GenResponse | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  async function search(word: string) {
    const q = word.trim().toLowerCase();
    if (!q) return;
    const local = deck.find((w) => w.word === q);
    if (local) {
      setResult({
        status: "duplicate",
        word: { id: local.id, word: local.word, level: local.level, due_date: local.due_date },
      });
      return;
    }
    if (!online) {
      setResult({ status: "unavailable" });
      return;
    }
    setState("loading");
    setResult(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ word: q }),
      });
      const data = (await res.json()) as GenResponse;
      setResult(data);
      setState(data.status === "ok" ? "preview" : "idle");
    } catch {
      setResult({ status: "unavailable" });
      setState("idle");
    }
  }

  async function save() {
    if (result?.status !== "ok") return;
    setSaving(true);
    try {
      await addWord(packageToWord(result.package));
      setToast(`${result.package.word} saved`);
      setTerm("");
      setResult(null);
      setState("idle");
      inputRef.current?.focus();
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen className="px-5 pt-6">
      <div className="flex items-center gap-3">
        <Link href="/" className="text-text-dim">
          ←
        </Link>
        <h1 className="text-xl font-bold">Add word</h1>
      </div>

      <form
        className="mt-5 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void search(term);
        }}
      >
        <input
          ref={inputRef}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          autoComplete="off"
          enterKeyHint="search"
          placeholder="a single word"
          className="flex-1 rounded-2xl border border-border bg-surface px-4 py-3 text-lg outline-none focus:border-accent"
        />
        <Button type="submit" className="w-auto px-5" disabled={state === "loading"}>
          {state === "loading" ? "…" : "Search"}
        </Button>
      </form>

      <div className="mt-5 flex-1">
        {state === "loading" && <p className="text-text-dim">Building the card… (3–5s)</p>}

        {result && result.status !== "ok" && (
          <ErrorState result={result} onPick={(w) => { setTerm(w); void search(w); }} />
        )}

        {state === "preview" && result?.status === "ok" && (
          <Card>
            <WordPackage
              word={result.package.word}
              phonetic={result.package.phonetic}
              audioUrl={result.package.audio_url}
              pos={result.package.pos}
              definition={result.package.definition}
              origin={result.package.origin}
              otherMeanings={result.package.other_meanings}
              sentences={result.package.sentences}
              expandableSentences
            />
          </Card>
        )}
      </div>

      {state === "preview" && (
        <div className="sticky bottom-0 space-y-2 bg-bg pt-3 safe-b">
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setResult(null);
              setState("idle");
            }}
          >
            Cancel
          </Button>
        </div>
      )}

      {toast && (
        <div className="fixed inset-x-0 bottom-24 mx-auto w-fit rounded-full bg-surface-2 px-4 py-2 text-sm">
          {toast}
        </div>
      )}
    </Screen>
  );
}

function ErrorState({
  result,
  onPick,
}: {
  result: Exclude<GenResponse, { status: "ok" }>;
  onPick: (word: string) => void;
}) {
  switch (result.status) {
    case "duplicate":
      return (
        <Card>
          <p>
            &ldquo;{result.word.word}&rdquo; is already in your deck. Level {result.word.level} · due{" "}
            {result.word.due_date}
          </p>
          <Link href={`/words/${result.word.id}`} className="mt-3 inline-block text-accent">
            View
          </Link>
        </Card>
      );
    case "suggestion":
      return (
        <Card>
          <p>Did you mean {result.suggestion}?</p>
          <div className="mt-3 flex gap-2">
            <Button className="w-auto px-4" onClick={() => onPick(result.suggestion)}>
              Yes
            </Button>
          </div>
        </Card>
      );
    case "not_found":
      return <Card>&ldquo;{result.word}&rdquo; not found. Check the spelling.</Card>;
    case "phrase":
      return <Card>Only single words for now.</Card>;
    case "rate_limited":
      return <Card>Daily limit of {result.limit} new words reached. Try again tomorrow.</Card>;
    case "unavailable":
      return <Card>No connection. Try again later.</Card>;
  }
}
