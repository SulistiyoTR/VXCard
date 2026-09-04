"use client";

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Review, SessionRow, UserCard, WordContent } from "@/lib/types";

interface VXDB extends DBSchema {
  /** Shared word content — a read-only cache of the `words` table (SPEC 6.4). */
  words: { key: string; value: WordContent };
  /** Per-user learning state — keyed by `word_id`. The two-way-synced entity. */
  cards: { key: string; value: UserCard };
  /** Local session records (read by Stats / Calendar). */
  sessions: { key: string; value: SessionRow };
  /** Rolling ~35-day window of reviews — backs the offline accuracy stat. */
  reviews: { key: string; value: Review };
  /** Reviews awaiting push — append-only, never conflicts. */
  reviewOutbox: { key: string; value: Review };
  /** `word_id`s of cards changed locally since the last successful push. */
  cardDirty: { key: string; value: { id: string } };
  /** Ids of sessions changed locally since the last successful push. */
  sessionDirty: { key: string; value: { id: string } };
  /** `word_id`s of cards removed locally (card only — shared content stays), awaiting a push. */
  cardTombstone: { key: string; value: { id: string } };
  meta: { key: string; value: unknown };
}

let promise: Promise<IDBPDatabase<VXDB>> | null = null;

export function db(): Promise<IDBPDatabase<VXDB>> {
  if (!promise) {
    promise = openDB<VXDB>("vxcard", 2, {
      upgrade(d) {
        // v2 is a hard reset from the single-user schema. Wipe every store
        // (including `meta`, so `seeded` clears) and let the app re-seed.
        for (const name of Array.from(d.objectStoreNames)) d.deleteObjectStore(name);
        d.createObjectStore("words", { keyPath: "id" });
        d.createObjectStore("cards", { keyPath: "word_id" });
        d.createObjectStore("sessions", { keyPath: "id" });
        d.createObjectStore("reviews", { keyPath: "id" });
        d.createObjectStore("reviewOutbox", { keyPath: "id" });
        d.createObjectStore("cardDirty", { keyPath: "id" });
        d.createObjectStore("sessionDirty", { keyPath: "id" });
        d.createObjectStore("cardTombstone", { keyPath: "id" });
        d.createObjectStore("meta");
      },
    });
  }
  return promise;
}

export async function metaGet<T>(key: string): Promise<T | undefined> {
  return (await db()).get("meta", key) as Promise<T | undefined>;
}

export async function metaSet(key: string, value: unknown): Promise<void> {
  await (await db()).put("meta", value, key);
}
