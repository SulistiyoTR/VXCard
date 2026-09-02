"use client";

import { useAppData } from "@/lib/store/provider";
import { WordsClient } from "./WordsClient";

export default function MyWordsPage() {
  const { deck } = useAppData();
  return (
    <WordsClient
      words={deck.map((w) => ({
        id: w.id,
        word: w.word,
        pos: w.pos,
        definition: w.definition,
        level: w.level,
        streak: w.streak,
        due_date: w.due_date,
        created_at: w.created_at,
      }))}
    />
  );
}
