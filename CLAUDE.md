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
  `quiz`, `streak`, `generate`. These have `*.test.ts` files; run `npm test`.
- **Data**: `src/lib/data.ts` (`"server-only"`, reads) and `src/lib/actions.ts`
  (`"use server"`, writes + revalidate).
- **Auth**: Supabase Google OAuth. `src/proxy.ts` refreshes the session and
  redirects unauthenticated users to `/login` (except `/api`, `/auth`, `/login`).
- **Quiz session** (SPEC 5.5): the whole session is built server-side in
  `src/app/session/page.tsx`, then `SessionRunner` (client) runs it and posts each
  answer in the background via `submitAnswer` with a retry.
- **PWA**: `src/app/manifest.ts` + hand-written `public/sw.js` (app-shell cache only;
  real offline is V3). Registered by `src/components/ServiceWorker.tsx` in prod.

## Database

Two hand-run migrations in `supabase/migrations/`. `words` + `reviews` are from
SPEC §5; `sessions` is an addition (streak + calendar need to tell a completed
session from an abandoned one). `sentences` / `distractor_*` are `jsonb` on `words`.

## Gotchas

- Next.js 16: `middleware.ts` → `proxy.ts` (exports `proxy`). `params` / `searchParams`
  are Promises. See `node_modules/next/dist/docs/` before using unfamiliar APIs.
- Dates are plain `YYYY-MM-DD` strings throughout (`src/lib/date.ts`), local-day based.
- New word = `due_date` tomorrow, level 1 (SPEC 3.4). No inbox, no new-word quota.
- Lint enforces the React purity rules — no `setState` in an effect, no `Date.now()`
  in a ref initializer. Use `src/lib/useLocalStorage.ts` for persisted UI prefs.
