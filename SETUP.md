# Setup — manual steps

Everything the code can't do for you. Roughly BUILD-PLAN Fase 0 + the dashboard
parts of Sesi 1–2.

## 1. Local

```bash
npm install
cp .env.example .env.local   # then fill it in (see below)
npm run dev                  # http://localhost:3000
npm test                     # pure-logic unit tests
```

## 2. Supabase

1. Create a project at supabase.com (free tier).
2. **SQL editor** → run, in order:
   - `supabase/migrations/0001_init.sql` (tables `words` + `reviews`, indexes, RLS)
   - `supabase/migrations/0002_sessions.sql` (`sessions` table — backs streak + calendar)
   - `supabase/migrations/0003_sync.sql` (`updated_at` + triggers for LWW sync, `push_subscriptions`)
3. **Authentication → Providers → Google**: enable it.
   - In Google Cloud Console create an OAuth 2.0 Client ID (Web application).
   - Authorized redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback`
   - Paste the client ID + secret into Supabase.
4. **Authentication → URL Configuration**:
   - Site URL: your Vercel URL (and add `http://localhost:3000` under redirect URLs for local dev).
   - Add `http://localhost:3000/auth/callback` and `https://<vercel-url>/auth/callback`.
5. **Project Settings → API**: copy the Project URL and the `anon` public key into
   `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).

RLS check: both `words` and `reviews` should show "RLS enabled" with an "own rows" policy.

   Also copy the **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (server-only; the
   daily cron job needs to read across the single user's rows, bypassing RLS).

## 3. Anthropic

- console.anthropic.com → add ~$5 credit → create an API key.
- Put it in `.env.local` as `ANTHROPIC_API_KEY`. It is only ever read server-side
  (`src/lib/llm.ts`).

## 3b. Web Push (for reminders — SPEC 6.3)

```bash
npx web-push generate-vapid-keys
```

Put the public key in `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, the private in `VAPID_PRIVATE_KEY`,
set `VAPID_SUBJECT=mailto:you@example.com`, and pick any long random string for
`CRON_SECRET`. Reminders only fire once the PWA is installed to the home screen (iOS).

## 4. Vercel

1. Import the GitHub repo.
2. Add **all** env vars from `.env.example` (`NEXT_PUBLIC_SITE_URL` = the deployed URL).
3. Deploy. `vercel.json` registers the daily `/api/cron/notify` cron automatically.
4. Open the URL on your iPhone → Safari → Share → **Add to Home Screen**.

> ⚠️ Per BUILD-PLAN: don't move past this until the Vercel URL opens from your phone.

## 5. curl-test the generate endpoint

You need a session cookie (log in via the browser, copy the `sb-…-auth-token`
cookies) — the endpoint is auth-gated on purpose (single user).

```bash
curl -X POST http://localhost:3000/api/generate \
  -H 'content-type: application/json' \
  -b 'sb-<ref>-auth-token=...' \
  -d '{"word":"explicable"}'
```

Expect: full package JSON. `"zxcvb"` → 404 `not_found` (or `suggestion`).
`"climb up"` → 422 `phrase`.

## What's built vs. deferred

| Phase | Status |
|---|---|
| V0 (Fase 1): scaffold, DB, auth, generate, add word, scheduler + session logic, quiz L1–2, feedback, home/setup/complete, PWA | ✅ in this PR |
| V1 (Fase 2): quiz L3–4 (cloze, typed, hints, fuzzy), deck distractors, my words + detail, Hard Mode, practice more | ✅ in this PR |
| V2 (Fase 3): streak, stats, calendar, waiting indicator, regenerate sentences | ✅ |
| V3 (Fase 4): offline-first (IndexedDB source of truth + LWW sync), web push | ✅ |

Calibrate `src/lib/config.ts` after ~2 weeks of real use (BUILD-PLAN "BERHENTI" section).

Deviations from SPEC, all minor:
- Spelling suggestions (SPEC 1.5) use a tiny Haiku call — dictionaryapi.dev returns none.
- Service worker is hand-written (`public/sw.js`) instead of `next-pwa` (unmaintained for Next 16).
- `sentences.used_count` is bumped when an answer is submitted, not at the exact
  moment of display (SPEC 1.6) — indistinguishable in practice for one user.
- Added `sessions` + `push_subscriptions` tables and `words.updated_at` /
  `words.review_count` columns (beyond SPEC §5) — needed for streak/calendar,
  last-write-wins sync, and offline Word detail.
- Offline review history is kept as a rolling 35-day window in IndexedDB (enough
  for the 30-day accuracy stat); older reviews live only on the server.
