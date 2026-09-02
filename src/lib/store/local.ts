"use client";

import { db } from "./idb";
import type { Review, SessionRow, Word } from "@/lib/types";

/* ------------------------------------------------------------------ reads */

export async function loadDeck(): Promise<Word[]> {
  const all = await (await db()).getAll("words");
  return all.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function loadSessions(): Promise<SessionRow[]> {
  return (await db()).getAll("sessions");
}

export async function loadReviews(): Promise<Review[]> {
  return (await db()).getAll("reviews");
}

/** Merge reviews into the local window and drop anything older than `keepSince`. */
export async function putReviews(reviews: Review[], keepSince: string): Promise<void> {
  const d = await db();
  const tx = d.transaction("reviews", "readwrite");
  await Promise.all(reviews.map((r) => tx.store.put(r)));
  let cursor = await tx.store.openCursor();
  while (cursor) {
    if (cursor.value.reviewed_at < keepSince) await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}

export async function getWordLocal(id: string): Promise<Word | undefined> {
  return (await db()).get("words", id);
}

/* --------------------------------------------------------- writes (merge) */

/** Bulk write from a server pull — does NOT mark the rows dirty. */
export async function putServerWords(words: Word[]): Promise<void> {
  const tx = (await db()).transaction("words", "readwrite");
  await Promise.all(words.map((w) => tx.store.put(w)));
  await tx.done;
}

export async function putServerSessions(sessions: SessionRow[]): Promise<void> {
  const tx = (await db()).transaction("sessions", "readwrite");
  await Promise.all(sessions.map((s) => tx.store.put(s)));
  await tx.done;
}

export async function deleteWordLocalOnly(id: string): Promise<void> {
  await (await db()).delete("words", id);
}

/* ------------------------------------------------------ writes (local op) */

export async function addWordLocal(word: Word): Promise<void> {
  const d = await db();
  await d.put("words", word);
  await d.put("wordDirty", { id: word.id });
}

/** Apply a scheduling/sentence patch, stamp updated_at, mark dirty. */
export async function patchWordLocal(id: string, patch: Partial<Word>): Promise<Word | undefined> {
  const d = await db();
  const current = await d.get("words", id);
  if (!current) return undefined;
  const next: Word = { ...current, ...patch, updated_at: new Date().toISOString() };
  await d.put("words", next);
  await d.put("wordDirty", { id });
  return next;
}

export async function deleteWordLocal(id: string): Promise<void> {
  const d = await db();
  await d.delete("words", id);
  await d.delete("wordDirty", id);
  await d.put("wordTombstone", { id });
}

export async function enqueueReview(review: Review): Promise<void> {
  const d = await db();
  await d.put("reviewOutbox", review);
  await d.put("reviews", review); // reflect it in the local window immediately
}

export async function upsertSessionLocal(session: SessionRow): Promise<void> {
  const d = await db();
  await d.put("sessions", session);
  await d.put("sessionDirty", { id: session.id });
}

/* --------------------------------------------------------- outbox access */

export interface Outbox {
  reviews: Review[];
  words: Word[];
  sessions: SessionRow[];
  deletions: string[];
}

export async function readOutbox(): Promise<Outbox> {
  const d = await db();
  const [reviews, dirtyWordIds, dirtySessionIds, tombstones] = await Promise.all([
    d.getAll("reviewOutbox"),
    d.getAllKeys("wordDirty"),
    d.getAllKeys("sessionDirty"),
    d.getAllKeys("wordTombstone"),
  ]);
  const words = (await Promise.all(dirtyWordIds.map((id) => d.get("words", id)))).filter(
    (w): w is Word => Boolean(w),
  );
  const sessions = (await Promise.all(dirtySessionIds.map((id) => d.get("sessions", id)))).filter(
    (s): s is SessionRow => Boolean(s),
  );
  return { reviews, words, sessions, deletions: tombstones as string[] };
}

/** Clear exactly the entries that were successfully pushed (not a blind clear). */
export async function clearOutbox(sent: {
  reviewIds: string[];
  wordIds: string[];
  sessionIds: string[];
  deletions: string[];
}): Promise<void> {
  const d = await db();
  const tx = d.transaction(
    ["reviewOutbox", "wordDirty", "sessionDirty", "wordTombstone"],
    "readwrite",
  );
  await Promise.all([
    ...sent.reviewIds.map((id) => tx.objectStore("reviewOutbox").delete(id)),
    ...sent.wordIds.map((id) => tx.objectStore("wordDirty").delete(id)),
    ...sent.sessionIds.map((id) => tx.objectStore("sessionDirty").delete(id)),
    ...sent.deletions.map((id) => tx.objectStore("wordTombstone").delete(id)),
  ]);
  await tx.done;
}

export async function isSeeded(): Promise<boolean> {
  return Boolean(await (await db()).get("meta", "seeded"));
}
