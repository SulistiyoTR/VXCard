"use client";

import type { Review, SessionRow, Word } from "@/lib/types";
import { db, metaGet, metaSet } from "./idb";
import { mergeWord } from "./merge";
import { clearOutbox, putReviews, putServerSessions, readOutbox } from "./local";

const EPOCH = "1970-01-01T00:00:00.000Z";
const REVIEW_WINDOW_DAYS = 35;

interface PullResponse {
  words: Word[];
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
    outbox.words.length === 0 &&
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
    wordIds: outbox.words.map((w) => w.id),
    sessionIds: outbox.sessions.map((s) => s.id),
    deletions: outbox.deletions,
  });
}

/** Pull remote changes since the last sync and merge them (LWW). Returns whether anything changed. */
export async function pull(): Promise<boolean> {
  const since = (await metaGet<string>("lastSync")) ?? EPOCH;
  const res = await fetch(`/api/sync?since=${encodeURIComponent(since)}`);
  if (!res.ok) throw new Error(`pull failed: ${res.status}`);
  const data = (await res.json()) as PullResponse;

  let changed = false;
  const d = await db();

  if (data.words.length) {
    const tx = d.transaction(["words", "wordDirty"], "readwrite");
    for (const remote of data.words) {
      const [local, dirty] = await Promise.all([
        tx.objectStore("words").get(remote.id),
        tx.objectStore("wordDirty").get(remote.id),
      ]);
      const decision = mergeWord(local, remote, Boolean(dirty));
      if (decision.take) {
        await tx.objectStore("words").put(remote);
        changed = true;
      }
      if (decision.dropDirty) await tx.objectStore("wordDirty").delete(remote.id);
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
export async function seedFromSnapshot(words: Word[], sessions: SessionRow[]): Promise<void> {
  const d = await db();
  const tx = d.transaction(["words", "sessions"], "readwrite");
  await Promise.all([
    ...words.map((w) => tx.objectStore("words").put(w)),
    ...sessions.map((s) => tx.objectStore("sessions").put(s)),
  ]);
  await tx.done;
  await metaSet("seeded", true);
  // leave lastSync at epoch so the next online sync reconciles fully
}
