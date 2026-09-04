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
    status: "complete",
    pool_full: false,
    level: 1,
    streak: 0,
    due_date: addDays(today(), 1),
    lapse_count: 0,
    review_count: 0,
    last_seen_date: null,
    sentence_usage: [],
    hidden_sentences: [],
  };
}

type Stage = "lookup" | "sentences" | "distractors";

type GenResult =
  | { status: "ok"; package: GeneratedPackage }
  | { status: "duplicate"; word: { id: string; word: string; level: number; due_date: string } }
  | { status: "suggestion"; word: string; suggestion: string }
  | { status: "not_found"; word: string }
  | { status: "phrase" }
  | { status: "rate_limited"; limit: number }
  | { status: "error"; detail: string }
  | { status: "unavailable" }; // client-side: offline or the stream never arrived

export default function AddWordPage() {
  const { addWord, online, deck } = useAppData();
  const [term, setTerm] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "preview">("idle");
  const [stage, setStage] = useState<Stage>("lookup");
  const [result, setResult] = useState<GenResult | null>(null);
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

  async function search(raw: string) {
    const q = raw.trim().toLowerCase();
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
    setStage("lookup");
    setResult(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ word: q }),
      });
      if (!res.ok || !res.body) {
        setResult({ status: "unavailable" });
        setState("idle");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let final: GenResult | null = null;

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = buffer.indexOf("\n\n")) !== -1) {
          const chunk = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 2);
          if (!chunk.startsWith("data:")) continue;
          const ev = JSON.parse(chunk.slice(5).trim());
          if (ev.type === "stage") setStage(ev.stage as Stage);
          else if (ev.type === "result") final = ev.result as GenResult;
        }
      }

      if (!final) {
        setResult({ status: "unavailable" });
        setState("idle");
        return;
      }
      setResult(final);
      setState(final.status === "ok" ? "preview" : "idle");
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
        <Link href="/" className="text-lg text-text-dim">
          ←
        </Link>
        <h1 className="font-serif text-[22px] font-medium">Add word</h1>
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
          className="flex-1 rounded-[14px] border border-border bg-surface px-4 py-3 font-serif text-lg outline-none focus:border-accent"
        />
        <Button type="submit" className="w-auto px-5" disabled={state === "loading"}>
          {state === "loading" ? "…" : "Search"}
        </Button>
      </form>

      <div className="mt-6 flex-1">
        {state === "loading" && <GenProgress term={term.trim().toLowerCase()} stage={stage} />}

        {result && result.status !== "ok" && (
          <ResultCard
            result={result}
            onPick={(w) => {
              setTerm(w);
              void search(w);
            }}
            onRetry={() => void search(term)}
          />
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

function GenProgress({ term, stage }: { term: string; stage: Stage }) {
  const idx = stage === "lookup" ? 0 : stage === "sentences" ? 1 : 2;
  const steps = [
    `Looking up “${term}”`,
    "Writing 5 example sentences",
    "Building the answer options",
  ];
  return (
    <ul className="space-y-3">
      {steps.map((s, i) => (
        <li key={i} className="flex items-center gap-3 text-sm">
          <span className="w-4 text-center">
            {i < idx ? (
              <span className="text-good">✓</span>
            ) : i === idx ? (
              <span className="inline-block animate-spin text-accent">◐</span>
            ) : (
              <span className="text-text-faint">○</span>
            )}
          </span>
          <span className={i <= idx ? "text-text" : "text-text-faint"}>{s}</span>
        </li>
      ))}
    </ul>
  );
}

function ResultCard({
  result,
  onPick,
  onRetry,
}: {
  result: Exclude<GenResult, { status: "ok" }>;
  onPick: (word: string) => void;
  onRetry: () => void;
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
          <Button className="mt-3 w-auto px-4" onClick={() => onPick(result.suggestion)}>
            Yes
          </Button>
        </Card>
      );
    case "not_found":
      return <Card>&ldquo;{result.word}&rdquo; not found. Check the spelling.</Card>;
    case "phrase":
      return <Card>Only single words for now.</Card>;
    case "rate_limited":
      return <Card>Daily limit of {result.limit} new words reached. Try again tomorrow.</Card>;
    case "error":
      return (
        <Card>
          <p>Couldn&rsquo;t build the card.</p>
          <p className="mt-2 break-words text-sm text-text-faint">{result.detail}</p>
          <Button variant="secondary" className="mt-3" onClick={onRetry}>
            Try again
          </Button>
        </Card>
      );
    case "unavailable":
      return <Card>No connection. Try again later.</Card>;
  }
}
