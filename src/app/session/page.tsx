import { redirect } from "next/navigation";
import { createSession } from "@/lib/actions";
import { getDeck } from "@/lib/data";
import { buildHardModeSession, buildSession, hardModeUnlocked } from "@/lib/session";
import { buildQuestion, quizLevel } from "@/lib/quiz";
import { SessionRunner } from "./SessionRunner";

export const dynamic = "force-dynamic";

export default async function SessionPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; slot?: string }>;
}) {
  const { mode = "due", slot } = await searchParams;
  const deck = await getDeck();
  if (deck.length === 0) redirect("/add");

  const isHard = mode === "hardmode";
  if (isHard && !hardModeUnlocked(deck)) redirect("/");

  const slotN = slot ? Math.max(1, Number(slot)) : Math.min(deck.length, 15);
  const items = isHard
    ? buildHardModeSession(deck, slotN)
    : buildSession(deck, slotN);

  if (items.length === 0) redirect("/");

  const entries = items.map((item) => ({
    item,
    question: buildQuestion(item.word, quizLevel(item.word.level), deck),
  }));

  const sessionId = await createSession(entries.length, isHard ? "hardmode" : "mixed");

  return (
    <SessionRunner
      sessionId={sessionId}
      entries={entries}
      deck={deck}
      hardMode={isHard}
    />
  );
}
