import { getDeck, getSessions } from "@/lib/data";
import { AppDataProvider } from "@/lib/store/provider";
import type { SessionRow, Word } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Fetches a first-paint snapshot from the server, then hands control to the
 * IndexedDB-backed store (SPEC 6.4) — the client is the source of truth from here.
 */
export default async function AuthedLayout({ children }: { children: React.ReactNode }) {
  let deck: Word[] = [];
  let sessions: SessionRow[] = [];
  try {
    [deck, sessions] = await Promise.all([getDeck(), getSessions()]);
  } catch {
    // Offline SSR / transient error — the store seeds from IndexedDB or a later sync.
  }
  return <AppDataProvider snapshot={{ deck, sessions }}>{children}</AppDataProvider>;
}
