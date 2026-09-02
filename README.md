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
  generate.ts       dictionary + 2× LLM pipeline                 (SPEC 1.1)
  data.ts           Supabase reads (server-only)
  actions.ts        Server Actions (writes)
  stats.ts          Stats / Calendar aggregation
src/app/
  (app)/            tab-bar screens: home, add, words, stats
  session/          fullscreen quiz flow (setup → quiz → complete)
  api/generate/     the only place the Anthropic key is used
supabase/migrations/  SQL — run these by hand (SETUP.md)
```

See [CLAUDE.md](CLAUDE.md) for working notes.
