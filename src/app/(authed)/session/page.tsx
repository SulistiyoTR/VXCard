"use client";

import { useMemo } from "react";
import { redirect, useSearchParams } from "next/navigation";
import { buildHardModeSession, buildSession, hardModeUnlocked } from "@/lib/session";
import { buildQuestion, quizLevel, type Question } from "@/lib/quiz";
import { useAppData } from "@/lib/store/provider";
import type { SessionItem } from "@/lib/types";
import { Screen } from "@/components/ui";
import { SessionRunner } from "./SessionRunner";

interface Entry {
  item: SessionItem;
  question: Question;
}
type Built = { kind: "redirect"; to: string } | { kind: "run"; entries: Entry[] } | null;

export default function SessionPage() {
  const params = useSearchParams();
  const { deck, ready } = useAppData();

  const mode = params.get("mode") ?? "due";
  const slotParam = params.get("slot");
  const isHard = mode === "hardmode";

  // Built once when the store becomes ready; the memo keeps the same value on
  // later renders (e.g. a background sync) so the quiz never rebuilds mid-session.
  const built = useMemo<Built>(() => {
    if (!ready) return null;
    if (deck.length === 0) return { kind: "redirect", to: "/add" };
    if (isHard && !hardModeUnlocked(deck)) return { kind: "redirect", to: "/" };

    const slot = slotParam ? Math.max(1, Number(slotParam)) : Math.min(deck.length, 15);
    const items = isHard ? buildHardModeSession(deck, slot) : buildSession(deck, slot);
    if (items.length === 0) return { kind: "redirect", to: "/" };

    return {
      kind: "run",
      entries: items.map((item) => ({
        item,
        question: buildQuestion(item.word, quizLevel(item.word.level), deck),
      })),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  if (built?.kind === "redirect") redirect(built.to);

  if (built?.kind !== "run") {
    return (
      <Screen className="items-center justify-center">
        <p className="text-text-dim">Loading…</p>
      </Screen>
    );
  }

  return <SessionRunner entries={built.entries} deck={deck} hardMode={isHard} />;
}
