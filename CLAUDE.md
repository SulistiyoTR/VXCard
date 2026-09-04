# CLAUDE.md

@AGENTS.md


Working notes for this repo. Read `SPEC.md` (what) and `UPDATE-PLAN.md` (current
order) first.

> **Migration in progress: single-user → shared content.** `UPDATE-PLAN.md` is the
> active plan (Sesi 1–6), superseding `BUILD-PLAN.md`. During this migration, editing
> `SPEC.md` is allowed **only** as directed by `UPDATE-PLAN.md` Sesi 1 (done) or when
> the user explicitly asks. `BUILD-PLAN.md` stays read-only. Once the migration lands,
> restore the "do not edit SPEC.md" rule.

## Ground rules

- One `UPDATE-PLAN.md` session per working session. Ask for a plan before writing files.
- Commit when a session's checklist passes.
- `words` is **shared content** (no `user_id`, one row per word globally, backend-write
  only). Personal learning state lives in `user_cards`. See `UPDATE-PLAN.md`.
- All tunable numbers live in `src/lib/config.ts` — never hardcode them elsewhere.
- The Anthropic API key is server-only. It must never appear in a client bundle;
  the single call site is `src/lib/llm.ts` via `src/app/api/generate/route.ts`.
- Test on a phone, not just the laptop browser.

## Architecture

- **Pure logic** in `src/lib/*.ts` (no `next/*`, no React) — `scheduler`, `session`,
  `quiz`, `streak`, `statsCalc`, `store/merge`, `generate`. All have `*.test.ts`; `npm test`.
- **Offline-first (SPEC 6.4)**: IndexedDB backs the client. `src/lib/store/`
  — `idb` (schema v2), `shape` (pure `joinWord` / `splitWord`), `local` (CRUD + outbox),
  `sync` (push→pull, LWW via `merge.ts`), `provider` (`AppDataProvider` / `useAppData`).
  `src/app/(authed)/layout.tsx` fetches a first-paint snapshot server-side, then the
  client store takes over. Every screen under `(authed)` is a client component reading
  `useAppData()`.
  - IDB stores: `words` is a **read-only cache** of shared content (never written from
    the phone, no dirty tracking). `cards` (keyed by `word_id`), `sessions`, `reviews`
    are the two-way-synced entities, with `cardDirty` / `sessionDirty` / `cardTombstone`
    / `reviewOutbox`.
  - `useAppData().deck` is `Word[]` — a **joined view** of `WordContent` + `UserCard`
    (`Word.id` = word id; scheduling fields come from the card). `patchWord` only writes
    the `CARD_FIELDS`; content edits are ignored (append-only pool, Sesi 4).
- **Sync endpoint**: `src/app/api/sync/route.ts` — GET returns per-user `cards` /
  `sessions` / `reviews` changed since `?since`, plus the shared `words` content behind
  this user's cards whose `updated_at > since` (so a growing sentence pool reaches the
  phone). POST applies the outbox: `cards` (LWW on `updated_at`, `onConflict user_id,word_id`)
  and `sessions` LWW, `reviews` idempotent by client uuid, card deletions honoured.
  Shared `words` is never written here.
- **Server writes that must stay online** (LLM): `src/lib/actions.ts` —
  `regenerateSentence` (inert until Sesi 4/6), `signOut`. Everything else is local.
- **Auth**: Supabase Google OAuth. `src/proxy.ts` gates routes; `/api`, `/auth`,
  `/login` are public.
- **Notifications (SPEC 6.3)**: `/api/push/subscribe` stores a subscription;
  `/api/cron/notify` (Vercel Cron in `vercel.json`, Bearer `CRON_SECRET`, service-role
  client) sends the daily reminder. `public/sw.js` handles `push` / `notificationclick`.
- **PWA**: `src/app/manifest.ts` + `public/sw.js` (app-shell cache), registered by
  `src/components/ServiceWorker.tsx` in prod.

## Database

Hand-run migrations. `supabase/migrations/0001`–`0003` are the old single-user schema
(historical). The shared-content schema is **`/migration.sql`** at the repo root — one
whole file, run manually in the Supabase SQL Editor (create-only; any defensive
`drop ... if exists` is `public.`-prefixed so `auth.sessions` is never touched).

Six tables (SPEC §5): `words` (shared, no `user_id`), `user_cards`, `reviews`,
`sessions`, `sentence_requests` (ticket queue, `word_id` unique), `mw_lookups`
(per-user daily MW lookup counter). `push_subscriptions` unchanged. `sentences` /
`distractor_*` / `sentence_usage` / `hidden_sentences` are `jsonb`; `sentences` is
append-only (index-referenced by `user_cards.sentence_usage`). `words.updated_at` is
bumped by a trigger; `user_cards.updated_at` is set by the client (LWW), no trigger.
Ticket functions: `claim_sentence_tickets` (`FOR UPDATE SKIP LOCKED`) and
`complete_sentence_ticket` — call via `supabase.rpc()` with the service-role key.

## Gotchas

- Next.js 16: `middleware.ts` → `proxy.ts` (exports `proxy`). `params` / `searchParams`
  are Promises. See `node_modules/next/dist/docs/` before using unfamiliar APIs.
- Dates are plain `YYYY-MM-DD` strings throughout (`src/lib/date.ts`), local-day based.
- New word = `due_date` tomorrow, level 1 (SPEC 3.4). No inbox. Quota is now a MW
  lookup cap (`mw_lookups`, Sesi 3), not a per-word one.
- Lint enforces the React purity rules — no `setState` in an effect, no `Date.now()`
  in a ref initializer, no `ref.current` in render. Use `src/lib/useLocalStorage.ts`
  / `src/lib/useOnline.ts` (both `useSyncExternalStore`) for that class of state.
- IDs for offline-created rows are `crypto.randomUUID()` client-side; the sync
  POST fills `user_id`. Bump `updated_at` on every local card edit (`patchCardLocal` does).
- **Sesi 2 done; Sesi 3 next.** `/api/generate` still queries `words.user_id` (Sesi 3
  rework) — Add-word won't persist yet. The app otherwise runs on an empty deck with
  sync working.
