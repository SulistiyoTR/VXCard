# CLAUDE.md

@AGENTS.md


Working notes for this repo. Read `SPEC.md` (what) and `BUILD-PLAN.md` (order) first
— **do not edit either of those files.**

## Ground rules

- One BUILD-PLAN session per working session. Ask for a plan before writing files.
- Commit when a session's checklist passes.
- All tunable numbers live in `src/lib/config.ts` — never hardcode them elsewhere.
- The Anthropic API key is server-only. It must never appear in a client bundle;
  the single call site is `src/lib/llm.ts` via `src/app/api/generate/route.ts`.
- Test on a phone, not just the laptop browser.

## Architecture

- **Pure logic** in `src/lib/*.ts` (no `next/*`, no React) — `scheduler`, `session`,
  `quiz`, `streak`, `statsCalc`, `store/merge`, `generate`. All have `*.test.ts`; `npm test`.
- **Offline-first (SPEC 6.4)**: IndexedDB is the source of truth. `src/lib/store/`
  — `idb` (schema), `local` (CRUD + outbox), `sync` (push→pull, LWW via `merge.ts`),
  `provider` (`AppDataProvider` / `useAppData`). `src/app/(authed)/layout.tsx`
  fetches a first-paint snapshot server-side, then the client store takes over.
  Every screen under `(authed)` is a client component reading `useAppData()`.
- **Sync endpoint**: `src/app/api/sync/route.ts` — GET returns rows changed since
  `?since`; POST applies the outbox (words/sessions LWW on `updated_at`, reviews
  inserted idempotently by client uuid, deletions honoured).
- **Server writes that must stay online** (LLM): `src/lib/actions.ts` —
  `regenerateSentence`, `refreshSentences`, `signOut`. Everything else is local.
- **Auth**: Supabase Google OAuth. `src/proxy.ts` gates routes; `/api`, `/auth`,
  `/login` are public.
- **Notifications (SPEC 6.3)**: `/api/push/subscribe` stores a subscription;
  `/api/cron/notify` (Vercel Cron in `vercel.json`, Bearer `CRON_SECRET`, service-role
  client) sends the daily reminder. `public/sw.js` handles `push` / `notificationclick`.
- **PWA**: `src/app/manifest.ts` + `public/sw.js` (app-shell cache), registered by
  `src/components/ServiceWorker.tsx` in prod.

## Database

Three hand-run migrations in `supabase/migrations/`. `words` + `reviews` are from
SPEC §5; `sessions`, `words.updated_at`/`review_count`, `sessions.updated_at`, and
`push_subscriptions` are additions for streak/calendar, sync (LWW), and push.
`sentences` / `distractor_*` are `jsonb` on `words`.

## Gotchas

- Next.js 16: `middleware.ts` → `proxy.ts` (exports `proxy`). `params` / `searchParams`
  are Promises. See `node_modules/next/dist/docs/` before using unfamiliar APIs.
- Dates are plain `YYYY-MM-DD` strings throughout (`src/lib/date.ts`), local-day based.
- New word = `due_date` tomorrow, level 1 (SPEC 3.4). No inbox, no new-word quota.
- Lint enforces the React purity rules — no `setState` in an effect, no `Date.now()`
  in a ref initializer, no `ref.current` in render. Use `src/lib/useLocalStorage.ts`
  / `src/lib/useOnline.ts` (both `useSyncExternalStore`) for that class of state.
- IDs for offline-created rows are `crypto.randomUUID()` client-side; the sync
  POST fills `user_id`. Bump `updated_at` on every local edit (`patchWordLocal` does).
