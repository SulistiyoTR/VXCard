-- VX Card — initial schema (SPEC §5)
-- Run in the Supabase SQL editor, or `supabase db push` with the CLI.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- words
-- ---------------------------------------------------------------------------
create table if not exists public.words (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  word             text not null,
  created_at       timestamptz not null default now(),

  phonetic         text,
  audio_url        text,
  pos              text not null default '',
  definition       text not null default '',
  origin           text,
  other_meanings   jsonb not null default '[]'::jsonb,
  sentences        jsonb not null default '[]'::jsonb,
  distractor_defs  jsonb not null default '[]'::jsonb,
  distractor_words jsonb not null default '[]'::jsonb,

  level            int  not null default 1,   -- 1–4 in progress, 5 = finished
  streak           int  not null default 0,
  due_date         date not null default (current_date + 1),
  lapse_count      int  not null default 0,
  last_seen_date   date,

  constraint words_word_per_user unique (user_id, word)
);

create index if not exists idx_words_due on public.words (user_id, due_date);

-- ---------------------------------------------------------------------------
-- reviews
-- ---------------------------------------------------------------------------
create table if not exists public.reviews (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  word_id      uuid not null references public.words (id) on delete cascade,
  reviewed_at  timestamptz not null default now(),
  level        int  not null,
  result       text not null check (result in ('correct','slow','wrong','dontknow')),
  duration_ms  int  not null default 0,
  help_used    int  not null default 0,
  source       text not null check (source in ('due','random','practice','hardmode'))
);

create index if not exists idx_reviews_word on public.reviews (word_id);
create index if not exists idx_reviews_user_time on public.reviews (user_id, reviewed_at);

-- ---------------------------------------------------------------------------
-- Row Level Security (SPEC 5.6)
-- ---------------------------------------------------------------------------
alter table public.words   enable row level security;
alter table public.reviews enable row level security;

drop policy if exists "own rows" on public.words;
create policy "own rows" on public.words
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own rows" on public.reviews;
create policy "own rows" on public.reviews
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Generate rate limit (SPEC 5.6): max 50 new words per day, enforced server-side.
-- ---------------------------------------------------------------------------
create or replace function public.new_words_today(uid uuid)
returns int
language sql
stable
as $$
  select count(*)::int
  from public.words
  where user_id = uid
    and created_at >= date_trunc('day', now());
$$;
