# VX Card

English vocabulary flashcards with spaced repetition. Single user, installed as a
PWA on iPhone. UI in English.

- **What** to build: [SPEC.md](SPEC.md)
- **When / how**: [BUILD-PLAN.md](BUILD-PLAN.md)
- **Manual setup** (Supabase, Google OAuth, Anthropic, Vercel): [SETUP.md](SETUP.md)

## Stack

Next.js 16 (App Router) · Supabase (Postgres + Auth) · Anthropic Haiku (generation) ·
dictionaryapi.dev (facts) · Tailwind v4 · Vitest.

## Commands

```bash
npm run dev     # local dev server
npm test        # unit tests for the scheduling / quiz logic
npm run build   # production build
npm run lint
```

## Layout

```
src/lib/            pure logic (no framework) + tested
  config.ts         all tunable numbers (SPEC §8)
  scheduler.ts      updateCard(), intervals, scoring, Hard Mode  (SPEC 2.3, 3.2)
  session.ts        buildSession() 80/20 composition             (SPEC 3.3, 3.6, 3.7)
  quiz.ts           questions, distractors, fuzzy match, hints   (SPEC 2.2–2.6)
  streak.ts         streak / best-streak
  statsCalc.ts      Stats / Calendar aggregation (client-side)
  generate.ts       dictionary + 2× LLM pipeline                 (SPEC 1.1)
  store/            offline-first: IndexedDB source of truth + LWW sync (SPEC 6.4)
  data.ts           Supabase reads — first-paint snapshot + sync endpoint
  actions.ts        Server Actions — LLM-only writes (regenerate / refresh)
src/app/
  (authed)/         data provider; every screen reads useAppData()
    (tabs)/         home, add, words, stats, calendar
    session/        fullscreen quiz flow (setup → quiz → complete)
  api/generate/     the only place the Anthropic key is used
  api/sync/         push/pull the client outbox
  api/cron/notify/  daily Web Push reminder (Vercel Cron)
supabase/migrations/  SQL — run these by hand (SETUP.md)
```

See [CLAUDE.md](CLAUDE.md) for working notes.
