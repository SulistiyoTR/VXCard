"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { WordContent } from "@/lib/types";
import { useAppData } from "@/lib/store/provider";
import { Button, Card, Screen } from "@/components/ui";
import { WordPackage } from "@/components/WordPackage";

type GenResult =
  | { status: "ok"; content: WordContent }
  | { status: "duplicate"; word: { id: string; word: string; level: number; due_date: string } }
  | { status: "suggestion"; word: string; suggestion: string }
  | { status: "not_found"; word: string }
  | { status: "phrase" }
  | { status: "rate_limited"; limit: number }
  | { status: "error"; detail: string }
  | { status: "unavailable" }; // client-side: offline or the request failed

export default function AddWordPage() {
  const { addWord, online, deck } = useAppData();
  const [term, setTerm] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "preview">("idle");
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

    // Local deck check first — instant, works offline.
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
      if (!res.ok) {
        setResult({ status: "unavailable" });
        setState("idle");
        return;
      }
      const data = (await res.json()) as GenResult;
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
      let content = result.content;

      // Dictionary-only word → run the LLM now (SPEC 1.1 step 4).
      if (content.status === "dictionary_only") {
        const res = await fetch("/api/generate/save", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ word_id: content.id }),
        });
        const data = (await res.json().catch(() => null)) as
          | { status: "ok"; content: WordContent }
          | { status: "error"; detail?: string }
          | null;
        if (!res.ok || !data || data.status !== "ok") {
          const detail = data && "detail" in data ? data.detail : undefined;
          setToast(detail ? `Save failed: ${detail}` : "Could not save. Try again.");
          return;
        }
        content = data.content;
      }

      await addWord(content);
      setToast(`${content.word} saved`);
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
        {state === "loading" && (
          <p className="flex items-center gap-2 text-sm text-text-dim">
            <span className="inline-block animate-spin text-accent">◐</span>
            Looking up “{term.trim().toLowerCase()}”
          </p>
        )}

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
              word={result.content.word}
              phonetic={result.content.phonetic}
              audioUrl={result.content.audio_url}
              pos={result.content.pos}
              definition={result.content.definition}
              origin={result.content.origin}
              otherMeanings={result.content.other_meanings}
              sentences={result.content.sentences}
              expandableSentences
            />
            {result.content.status === "dictionary_only" && (
              <p className="mt-3 text-sm text-text-faint">
                Example sentences and quiz options are written when you save.
              </p>
            )}
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
      return <Card>Daily limit of {result.limit} new-word lookups reached. Try again tomorrow.</Card>;
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
