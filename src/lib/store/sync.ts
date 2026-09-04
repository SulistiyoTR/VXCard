"use client";

import type { Review, SessionRow, UserCard, Word, WordContent } from "@/lib/types";
import { db, metaGet, metaSet } from "./idb";
import { mergeCard } from "./merge";
import {
  clearOutbox,
  putReviews,
  putServerCards,
  putServerContent,
  putServerSessions,
  readOutbox,
  splitWord,
} from "./local";

const EPOCH = "1970-01-01T00:00:00.000Z";
const REVIEW_WINDOW_DAYS = 35;

interface PullResponse {
  /** Shared content — server-authoritative, overwritten wholesale. */
  words: WordContent[];
  cards: UserCard[];
  sessions: SessionRow[];
  reviews: Review[];
  serverTime: string;
}

function windowStart(serverTime: string): string {
  return new Date(new Date(serverTime).getTime() - REVIEW_WINDOW_DAYS * 86_400_000).toISOString();
}

export interface SyncResult {
  ok: boolean;
  offline?: boolean;
  changed: boolean;
}

let inFlight: Promise<SyncResult> | null = null;

/** push local changes, then pull remote ones. Coalesces concurrent calls. */
export function sync(): Promise<SyncResult> {
  if (inFlight) return inFlight;
  inFlight = run().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function run(): Promise<SyncResult> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { ok: false, offline: true, changed: false };
  }
  try {
    await push();
    const changed = await pull();
    return { ok: true, changed };
  } catch {
    return { ok: false, changed: false };
  }
}

/** Send everything in the outbox. Only clears entries the server acknowledged. */
export async function push(): Promise<void> {
  const outbox = await readOutbox();
  if (
    outbox.reviews.length === 0 &&
    outbox.cards.length === 0 &&
    outbox.sessions.length === 0 &&
    outbox.deletions.length === 0
  ) {
    return;
  }

  const res = await fetch("/api/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(outbox),
  });
  if (!res.ok) throw new Error(`push failed: ${res.status}`);

  await clearOutbox({
    reviewIds: outbox.reviews.map((r) => r.id!).filter(Boolean),
    cardWordIds: outbox.cards.map((c) => c.word_id),
    sessionIds: outbox.sessions.map((s) => s.id),
    deletions: outbox.deletions,
  });
}

/** Pull remote changes since the last sync and merge them. Returns whether anything changed. */
export async function pull(): Promise<boolean> {
  const since = (await metaGet<string>("lastSync")) ?? EPOCH;
  const res = await fetch(`/api/sync?since=${encodeURIComponent(since)}`);
  if (!res.ok) throw new Error(`pull failed: ${res.status}`);
  const data = (await res.json()) as PullResponse;

  let changed = false;
  const d = await db();

  // Shared content — no conflicts, just refresh the cache.
  if (data.words.length) {
    await putServerContent(data.words);
    changed = true;
  }

  // Per-user cards — last-write-wins against local + pending edits.
  if (data.cards.length) {
    const tx = d.transaction(["cards", "cardDirty"], "readwrite");
    for (const remote of data.cards) {
      const [local, dirty] = await Promise.all([
        tx.objectStore("cards").get(remote.word_id),
        tx.objectStore("cardDirty").get(remote.word_id),
      ]);
      const decision = mergeCard(local, remote, Boolean(dirty));
      if (decision.take) {
        await tx.objectStore("cards").put(remote);
        changed = true;
      }
      if (decision.dropDirty) await tx.objectStore("cardDirty").delete(remote.word_id);
    }
    await tx.done;
  }

  if (data.sessions.length) {
    await putServerSessions(data.sessions);
    changed = true;
  }

  if (data.reviews.length) {
    await putReviews(data.reviews, windowStart(data.serverTime));
    changed = true;
  }

  await metaSet("lastSync", data.serverTime);
  return changed;
}

/** First-run: pull the whole deck from scratch. */
export async function seedFromServer(): Promise<void> {
  await metaSet("lastSync", EPOCH);
  await pull();
  await metaSet("seeded", true);
}

/** Fallback seed when the first launch is offline but SSR gave us data. */
export async function seedFromSnapshot(deck: Word[], sessions: SessionRow[]): Promise<void> {
  const content: WordContent[] = [];
  const cards: UserCard[] = [];
  for (const w of deck) {
    const parts = splitWord(w);
    content.push(parts.content);
    cards.push(parts.card);
  }
  await Promise.all([putServerContent(content), putServerCards(cards), putServerSessions(sessions)]);
  await metaSet("seeded", true);
  // leave lastSync at epoch so the next online sync reconciles fully
}
