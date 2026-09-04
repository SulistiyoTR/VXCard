"use client";

import { addDays, today } from "@/lib/date";
import { db } from "./idb";
import { joinWord } from "./shape";
import {
  CARD_FIELDS,
  type Review,
  type SessionRow,
  type UserCard,
  type Word,
  type WordContent,
} from "@/lib/types";

export { joinWord, splitWord } from "./shape";

/* ------------------------------------------------------------------ reads */

export async function loadDeck(): Promise<Word[]> {
  const d = await db();
  const [cards, contents] = await Promise.all([d.getAll("cards"), d.getAll("words")]);
  const byId = new Map(contents.map((c) => [c.id, c]));
  return cards
    .map((card) => {
      const content = byId.get(card.word_id);
      return content ? joinWord(content, card) : null;
    })
    .filter((w): w is Word => w !== null)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
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
  const d = await db();
  const [card, content] = await Promise.all([d.get("cards", id), d.get("words", id)]);
  return card && content ? joinWord(content, card) : undefined;
}

export async function getCardLocal(wordId: string): Promise<UserCard | undefined> {
  return (await db()).get("cards", wordId);
}

/* --------------------------------------------------------- writes (cache) */

/** Bulk write shared content from a server pull — never marked dirty. */
export async function putServerContent(items: WordContent[]): Promise<void> {
  const tx = (await db()).transaction("words", "readwrite");
  await Promise.all(items.map((c) => tx.store.put(c)));
  await tx.done;
}

/** Bulk write cards from the first-run seed — not marked dirty. */
export async function putServerCards(cards: UserCard[]): Promise<void> {
  const tx = (await db()).transaction("cards", "readwrite");
  await Promise.all(cards.map((c) => tx.store.put(c)));
  await tx.done;
}

export async function putServerSessions(sessions: SessionRow[]): Promise<void> {
  const tx = (await db()).transaction("sessions", "readwrite");
  await Promise.all(sessions.map((s) => tx.store.put(s)));
  await tx.done;
}

/* ------------------------------------------------------ writes (local op) */

/**
 * Add flow (SPEC 1.1 step 4): cache the shared content (already persisted
 * server-side) and create a fresh dirty card for this user pointing at it.
 * New word = level 1, due tomorrow (SPEC 3.4).
 */
export async function addCardLocal(content: WordContent): Promise<void> {
  const now = new Date().toISOString();
  const card: UserCard = {
    id: crypto.randomUUID(),
    user_id: "", // filled by the sync POST
    word_id: content.id,
    level: 1,
    streak: 0,
    due_date: addDays(today(), 1),
    lapse_count: 0,
    last_seen_date: null,
    sentence_usage: [],
    hidden_sentences: [],
    review_count: 0,
    created_at: now,
    updated_at: now,
  };
  const d = await db();
  const tx = d.transaction(["words", "cards", "cardDirty"], "readwrite");
  await Promise.all([
    tx.objectStore("words").put(content),
    tx.objectStore("cards").put(card),
    tx.objectStore("cardDirty").put({ id: card.word_id }),
  ]);
  await tx.done;
}

/** Apply a card patch (scheduling / usage), stamp updated_at, mark dirty. */
export async function patchCardLocal(
  wordId: string,
  patch: Partial<Word>,
): Promise<Word | undefined> {
  const d = await db();
  const current = await d.get("cards", wordId);
  if (!current) return undefined;

  const cardPatch: Partial<UserCard> = {};
  for (const key of CARD_FIELDS) {
    if (key in patch) (cardPatch as Record<string, unknown>)[key] = patch[key];
  }

  const next: UserCard = { ...current, ...cardPatch, updated_at: new Date().toISOString() };
  await d.put("cards", next);
  await d.put("cardDirty", { id: wordId });
  return getWordLocal(wordId);
}

/**
 * Bump `sentence_usage[index]` for this user's card — called when a level 3/4
 * sentence is *shown* (SPEC 1.6). Grows the array with zeros as needed, stamps
 * updated_at, marks dirty. Race-free: one read-modify-write on the live card.
 */
export async function bumpSentenceUsageLocal(
  wordId: string,
  index: number,
): Promise<void> {
  const d = await db();
  const card = await d.get("cards", wordId);
  if (!card) return;
  const usage = [...(card.sentence_usage ?? [])];
  while (usage.length <= index) usage.push(0);
  usage[index] += 1;
  await d.put("cards", { ...card, sentence_usage: usage, updated_at: new Date().toISOString() });
  await d.put("cardDirty", { id: wordId });
}

/** Remove this user's card for a word. Shared content is left in the cache. */
export async function deleteCardLocal(wordId: string): Promise<void> {
  const d = await db();
  const tx = d.transaction(["cards", "cardDirty", "cardTombstone"], "readwrite");
  await Promise.all([
    tx.objectStore("cards").delete(wordId),
    tx.objectStore("cardDirty").delete(wordId),
    tx.objectStore("cardTombstone").put({ id: wordId }),
  ]);
  await tx.done;
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
  cards: UserCard[];
  sessions: SessionRow[];
  /** `word_id`s of removed cards. */
  deletions: string[];
}

export async function readOutbox(): Promise<Outbox> {
  const d = await db();
  const [reviews, dirtyCardIds, dirtySessionIds, tombstones] = await Promise.all([
    d.getAll("reviewOutbox"),
    d.getAllKeys("cardDirty"),
    d.getAllKeys("sessionDirty"),
    d.getAllKeys("cardTombstone"),
  ]);
  const cards = (await Promise.all(dirtyCardIds.map((id) => d.get("cards", id)))).filter(
    (c): c is UserCard => Boolean(c),
  );
  const sessions = (await Promise.all(dirtySessionIds.map((id) => d.get("sessions", id)))).filter(
    (s): s is SessionRow => Boolean(s),
  );
  return { reviews, cards, sessions, deletions: tombstones as string[] };
}

/** Clear exactly the entries that were successfully pushed (not a blind clear). */
export async function clearOutbox(sent: {
  reviewIds: string[];
  cardWordIds: string[];
  sessionIds: string[];
  deletions: string[];
}): Promise<void> {
  const d = await db();
  const tx = d.transaction(
    ["reviewOutbox", "cardDirty", "sessionDirty", "cardTombstone"],
    "readwrite",
  );
  await Promise.all([
    ...sent.reviewIds.map((id) => tx.objectStore("reviewOutbox").delete(id)),
    ...sent.cardWordIds.map((id) => tx.objectStore("cardDirty").delete(id)),
    ...sent.sessionIds.map((id) => tx.objectStore("sessionDirty").delete(id)),
    ...sent.deletions.map((id) => tx.objectStore("cardTombstone").delete(id)),
  ]);
  await tx.done;
}

export async function isSeeded(): Promise<boolean> {
  return Boolean(await (await db()).get("meta", "seeded"));
}
