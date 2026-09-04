"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { Review, SessionRow, Word } from "@/lib/types";
import { useOnline } from "@/lib/useOnline";
import {
  addCardLocal,
  deleteCardLocal,
  enqueueReview,
  isSeeded,
  loadDeck,
  loadReviews,
  loadSessions,
  patchCardLocal,
  upsertSessionLocal,
} from "./local";
import { seedFromServer, seedFromSnapshot, sync } from "./sync";

export interface AppData {
  ready: boolean;
  online: boolean;
  syncing: boolean;
  deck: Word[];
  sessions: SessionRow[];
  reviews: Review[];
  refresh: () => Promise<void>;
  addWord: (word: Word) => Promise<void>;
  patchWord: (id: string, patch: Partial<Word>) => Promise<void>;
  removeWord: (id: string) => Promise<void>;
  recordReview: (review: Review) => Promise<void>;
  upsertSession: (session: SessionRow) => Promise<void>;
}

const Ctx = createContext<AppData | null>(null);

export function AppDataProvider({
  children,
  snapshot,
}: {
  children: React.ReactNode;
  snapshot: { deck: Word[]; sessions: SessionRow[] };
}) {
  const online = useOnline();
  const [ready, setReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [deck, setDeck] = useState<Word[]>(snapshot.deck);
  const [sessions, setSessions] = useState<SessionRow[]>(snapshot.sessions);
  const [reviews, setReviews] = useState<Review[]>([]);
  const snapshotRef = useRef(snapshot);

  const reload = useCallback(async () => {
    const [d, s, r] = await Promise.all([loadDeck(), loadSessions(), loadReviews()]);
    setDeck(d);
    setSessions(s);
    setReviews(r);
  }, []);

  const refresh = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    setSyncing(true);
    try {
      const res = await sync();
      if (res.changed) await reload();
    } finally {
      setSyncing(false);
    }
  }, [reload]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!(await isSeeded())) {
          if (navigator.onLine) await seedFromServer();
          else await seedFromSnapshot(snapshotRef.current.deck, snapshotRef.current.sessions);
        }
      } catch {
        try {
          await seedFromSnapshot(snapshotRef.current.deck, snapshotRef.current.sessions);
        } catch {
          /* nothing we can do — render empty */
        }
      }
      if (cancelled) return;
      await reload();
      setReady(true);
      void refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [reload, refresh]);

  useEffect(() => {
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  // Sync when connectivity returns (deferred so it isn't a render-phase cascade).
  useEffect(() => {
    if (!(online && ready)) return;
    const t = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(t);
  }, [online, ready, refresh]);

  const addWord = useCallback(
    async (word: Word) => {
      await addCardLocal(word);
      await reload();
      void refresh();
    },
    [reload, refresh],
  );

  const patchWord = useCallback(
    async (id: string, patch: Partial<Word>) => {
      await patchCardLocal(id, patch);
      await reload();
      void refresh();
    },
    [reload, refresh],
  );

  const removeWord = useCallback(
    async (id: string) => {
      await deleteCardLocal(id);
      await reload();
      void refresh();
    },
    [reload, refresh],
  );

  const recordReview = useCallback(async (review: Review) => {
    await enqueueReview(review);
    setReviews(await loadReviews());
  }, []);

  const upsertSession = useCallback(
    async (session: SessionRow) => {
      await upsertSessionLocal(session);
      setSessions(await loadSessions());
      void refresh();
    },
    [refresh],
  );

  return (
    <Ctx.Provider
      value={{
        ready,
        online,
        syncing,
        deck,
        sessions,
        reviews,
        refresh,
        addWord,
        patchWord,
        removeWord,
        recordReview,
        upsertSession,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAppData(): AppData {
  const value = useContext(Ctx);
  if (!value) throw new Error("useAppData must be used within AppDataProvider");
  return value;
}
