import { getDeck } from "@/lib/data";
import { WordsClient } from "./WordsClient";

export const dynamic = "force-dynamic";

export default async function MyWordsPage() {
  const deck = await getDeck();
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
