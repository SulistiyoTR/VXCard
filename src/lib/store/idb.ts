"use client";

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Review, SessionRow, Word } from "@/lib/types";

interface VXDB extends DBSchema {
  /** Canonical local deck — the primary data source (SPEC 6.4). */
  words: { key: string; value: Word };
  /** Local session records (read by Stats / Calendar). */
  sessions: { key: string; value: SessionRow };
  /** Rolling ~35-day window of reviews — backs the offline accuracy stat. */
  reviews: { key: string; value: Review };
  /** Reviews awaiting push — append-only, never conflicts. */
  reviewOutbox: { key: string; value: Review };
  /** Ids of words changed locally since the last successful push. */
  wordDirty: { key: string; value: { id: string } };
  /** Ids of sessions changed locally since the last successful push. */
  sessionDirty: { key: string; value: { id: string } };
  /** Ids of words deleted locally, awaiting a push. */
  wordTombstone: { key: string; value: { id: string } };
  meta: { key: string; value: unknown };
}

let promise: Promise<IDBPDatabase<VXDB>> | null = null;

export function db(): Promise<IDBPDatabase<VXDB>> {
  if (!promise) {
    promise = openDB<VXDB>("vxcard", 1, {
      upgrade(d) {
        d.createObjectStore("words", { keyPath: "id" });
        d.createObjectStore("sessions", { keyPath: "id" });
        d.createObjectStore("reviews", { keyPath: "id" });
        d.createObjectStore("reviewOutbox", { keyPath: "id" });
        d.createObjectStore("wordDirty", { keyPath: "id" });
        d.createObjectStore("sessionDirty", { keyPath: "id" });
        d.createObjectStore("wordTombstone", { keyPath: "id" });
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
