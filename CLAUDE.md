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
  the single call site is `src/lib/llm.ts` (via `src/lib/addWord.ts` +
  `src/lib/actions.ts`). Merriam-Webster is the only dictionary source
  (`MERRIAM_WEBSTER_KEY`), server-only, no fallback.
- Test on a phone, not just the laptop browser.

## Architecture

- **Pure logic** in `src/lib/*.ts` (no `next/*`, no React) — `scheduler`, `session`,
  `quiz`, `streak`, `statsCalc`, `store/merge`, `store/shape`. Most have `*.test.ts`; `npm test`.
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
    the `CARD_FIELDS`; shared content is never touched from the client.
  - Sentence rotation (SPEC 1.6): `pickSentence` skips flagged/hidden, picks the
    least-used per this user's `sentence_usage`. `bumpSentenceUsage(wordId, idx)` fires
    when a level 3/4 sentence is **shown** (SessionRunner effect keyed on queue pos),
    not when answered. "Change this sentence" = `patchWord({hidden_sentences})` +
    `POST /api/sentence/hide` (global `hide_count` bump / auto-flag at `FLAG_THRESHOLD`).
- **Sync endpoint**: `src/app/api/sync/route.ts` — GET returns per-user `cards` /
  `sessions` / `reviews` changed since `?since`, plus the shared `words` content behind
  this user's cards whose `updated_at > since` (so a growing sentence pool reaches the
  phone). POST applies the outbox: `cards` (LWW on `updated_at`, `onConflict user_id,word_id`)
  and `sessions` LWW, `reviews` idempotent by client uuid, card deletions honoured.
  Shared `words` is never written here.
- **Add word** (`src/lib/addWord.ts`, service-role): `POST /api/generate` = search —
  check the shared `words` table, only call MW for a genuinely new word (rate-limited
  via `mw_lookups`, counter bumped **before** the call), store facts as
  `dictionary_only`, no LLM. `POST /api/generate/save` = complete — 2 LLM calls on Save,
  append sentences + distractors, flip to `complete`. Cancel keeps the dictionary row.
  The client then creates the local `user_cards` row (`addCardLocal`), which syncs.
  "In your deck" (client `deck` + server `user_cards` check) vs "in the global table"
  are distinct.
- **Other server-only writes**: `POST /api/sentence/hide` (service-role, `hide_sentence`
  RPC). `src/lib/actions.ts` is just `signOut` now. Everything else is local.
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
RPCs (service-role only): `claim_sentence_tickets` (`FOR UPDATE SKIP LOCKED`) +
`complete_sentence_ticket` for the ticket queue; `increment_mw_lookup(user_id, day)`
for the Add-word rate limit; `hide_sentence(word_id, index, flag_threshold)` for
"Change this sentence".

## Gotchas

- Next.js 16: `middleware.ts` → `proxy.ts` (exports `proxy`). `params` / `searchParams`
  are Promises. See `node_modules/next/dist/docs/` before using unfamiliar APIs.
- Dates are plain `YYYY-MM-DD` strings throughout (`src/lib/date.ts`), local-day based.
- New word = `due_date` tomorrow, level 1 (SPEC 3.4). No inbox. Quota is a per-user
  daily MW-lookup cap (`mw_lookups` / `increment_mw_lookup` RPC), not a per-word one.
- Lint enforces the React purity rules — no `setState` in an effect, no `Date.now()`
  in a ref initializer, no `ref.current` in render. Use `src/lib/useLocalStorage.ts`
  / `src/lib/useOnline.ts` (both `useSyncExternalStore`) for that class of state.
- IDs for offline-created rows are `crypto.randomUUID()` client-side; the sync
  POST fills `user_id`. Bump `updated_at` on every local card edit (`patchCardLocal` does).
- **Sesi 1–4 done; Sesi 5 next** — the ticket auto-grow system (`sentence_requests`,
  the two RPCs, a post-session background endpoint). Per-user sentence rotation +
  hide/flag are live; the pool doesn't grow on its own yet.
