import { notFound } from "next/navigation";
import { getWord, getWordReviewCounts } from "@/lib/data";
import { WordDetailClient } from "./WordDetailClient";

export const dynamic = "force-dynamic";

export default async function WordDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [word, counts] = await Promise.all([getWord(id), getWordReviewCounts(id)]);
  if (!word) notFound();
  return <WordDetailClient word={word} counts={counts} />;
}
