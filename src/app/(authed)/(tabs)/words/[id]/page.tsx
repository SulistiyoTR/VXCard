"use client";

import { use } from "react";
import Link from "next/link";
import { useAppData } from "@/lib/store/provider";
import { Screen } from "@/components/ui";
import { WordDetailClient } from "./WordDetailClient";

export default function WordDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { deck, ready } = useAppData();
  const word = deck.find((w) => w.id === id);

  if (!word) {
    return (
      <Screen className="px-5 pt-10">
        <p className="text-text-dim">{ready ? "Word not found." : "Loading…"}</p>
        <Link href="/words" className="mt-4 text-sm text-accent">
          ← All words
        </Link>
      </Screen>
    );
  }
  return <WordDetailClient word={word} />;
}
