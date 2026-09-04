-- ============================================================================
-- VX Card — shared-content schema (UPDATE-PLAN.md Sesi 2)
-- ============================================================================
-- Run this ONCE, whole file, in the Supabase SQL Editor (as the default
-- postgres role).
--
-- public.words / public.reviews / public.sessions were dropped manually
-- already. The DROP statements below are defensive so the script is
-- re-runnable; every one is public.-prefixed so the built-in auth.sessions
-- table is never touched. public.push_subscriptions is left untouched.
--
-- Six tables:
--   words             shared content, NO user_id, word unique globally
--   user_cards        per-user learning state (level/streak/due/usage)
--   reviews           answer history, keyed by word_id + user_id
--   sessions          streak accounting
--   sentence_requests ticket queue for background sentence auto-grow
--   mw_lookups        per-user daily Merriam-Webster lookup counter
--
-- All tunable numbers (MAX_SENTENCE_POOL, TICKET_TIMEOUT_MINUTES,
-- MAX_TICKETS_PER_SESSION, DAILY_NEW_WORD_LIMIT, ...) stay in
-- src/lib/config.ts and are passed into the functions as arguments — none
-- are hardcoded here.
-- ============================================================================

begin;

create extension if not exists "pgcrypto";  -- gen_random_uuid()

-- ---------------------------------------------------------------- drop (defensive)
-- (the words_touch_updated_at trigger drops automatically with public.words below)
drop function if exists public.claim_sentence_tickets(integer, integer);
drop function if exists public.complete_sentence_ticket(uuid, jsonb, integer);
drop function if exists public.increment_mw_lookup(uuid, date);
drop function if exists public.touch_updated_at();

drop table if exists public.reviews            cascade;
drop table if exists public.user_cards         cascade;
drop table if exists public.sessions           cascade;
drop table if exists public.sentence_requests  cascade;
drop table if exists public.mw_lookups         cascade;
drop table if exists public.words              cascade;

-- ============================================================================
-- 1. words — shared content
-- ============================================================================
create table public.words (
  id              uuid        primary key default gen_random_uuid(),
  word            text        not null unique,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  phonetic        text,
  audio_url       text,
  pos             text        not null,
  definition      text        not null,
  origin          text,
  other_meanings  jsonb       not null default '[]'::jsonb,

  -- append-only: elements are { text, form, hide_count, flagged }
  sentences       jsonb       not null default '[]'::jsonb,

  -- null until status = 'complete'; then arrays of 6
  distractor_defs   jsonb,
  distractor_words  jsonb,

  status          text        not null default 'dictionary_only'
                              check (status in ('dictionary_only', 'complete')),
  pool_full       boolean     not null default false
);

comment on table  public.words is
  'Shared word content. No user_id — one row per word globally. Client reads only; all writes go through the backend service-role client.';
comment on column public.words.sentences is
  'Append-only array of { text, form, hide_count, flagged }. Never deleted/reordered — user_cards.sentence_usage indexes into it.';
comment on column public.words.updated_at is
  'Bumped by the words_touch_updated_at trigger on every UPDATE. Drives the sync cache-refresh (pull rows where updated_at > since).';

-- ============================================================================
-- 2. user_cards — per-user learning state
-- ============================================================================
create table public.user_cards (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references auth.users(id) on delete cascade,
  word_id           uuid        not null references public.words(id) on delete cascade,

  level             int         not null default 1 check (level between 1 and 5),
  streak            int         not null default 0,
  due_date          date        not null,
  lapse_count       int         not null default 0,
  last_seen_date    date,

  -- parallel to words.sentences by index; shorter is fine (missing = 0)
  sentence_usage    jsonb       not null default '[]'::jsonb,
  hidden_sentences  jsonb       not null default '[]'::jsonb,

  -- denormalised total review count so Word detail works offline (SPEC 4.9)
  review_count      int         not null default 0,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  unique (user_id, word_id)
);

comment on table public.user_cards is
  'One row per (user, word). updated_at is set by the client and preserved on sync (last-write-wins) — deliberately NOT touched by a trigger.';

-- ============================================================================
-- 3. reviews — answer history
-- ============================================================================
create table public.reviews (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  word_id      uuid        not null references public.words(id) on delete cascade,
  reviewed_at  timestamptz not null default now(),
  level        int         not null,
  result       text        not null check (result in ('correct', 'slow', 'wrong', 'dontknow')),
  duration_ms  int         not null,
  help_used    int         not null default 0,
  source       text        not null check (source in ('due', 'random', 'practice', 'hardmode'))
);

comment on table public.reviews is
  'Keyed by word_id + user_id directly (no FK to user_cards). Inserted idempotently by client uuid on sync.';

-- ============================================================================
-- 4. sessions — streak accounting (SPEC 4.7)
-- ============================================================================
create table public.sessions (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  completed    boolean     not null default false,
  planned      int         not null,
  answered     int         not null default 0,
  source       text        not null check (source in ('review', 'practice', 'hardmode', 'mixed')),
  updated_at   timestamptz not null default now()
);

-- ============================================================================
-- 5. sentence_requests — ticket queue (UPDATE-PLAN Sesi 5)
-- ============================================================================
create table public.sentence_requests (
  word_id     uuid        primary key references public.words(id) on delete cascade,
  created_at  timestamptz not null default now(),
  locked_at   timestamptz
);

comment on table public.sentence_requests is
  'word_id is the PK (unique) — anti-conflict layer 1. Deposit: INSERT ... ON CONFLICT DO NOTHING. Claim: claim_sentence_tickets() (FOR UPDATE SKIP LOCKED). Stale lock (locked_at older than the timeout) is reclaimable.';

-- ============================================================================
-- 6. mw_lookups — per-user daily Merriam-Webster lookup counter
-- ============================================================================
create table public.mw_lookups (
  user_id  uuid  not null references auth.users(id) on delete cascade,
  day      date  not null,
  count    int   not null default 0,
  primary key (user_id, day)
);

comment on table public.mw_lookups is
  'Incremented BEFORE each MW call (failed/timed-out requests still consume MW quota). Endpoint rejects when count >= DAILY_NEW_WORD_LIMIT.';

-- ============================================================================
-- Indexes (SPEC 5.8 + sync support)
-- ============================================================================
create index idx_user_cards_due     on public.user_cards (user_id, due_date);
create index idx_user_cards_updated  on public.user_cards (user_id, updated_at);
create index idx_reviews_word        on public.reviews (word_id);
create index idx_reviews_user_time   on public.reviews (user_id, reviewed_at);
create index idx_sessions_user_updated on public.sessions (user_id, updated_at);
create index idx_words_updated        on public.words (updated_at);
-- words.word uniqueness + sentence_requests.word_id uniqueness are covered by
-- the UNIQUE constraint / PRIMARY KEY declared above.

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.words             enable row level security;
alter table public.user_cards        enable row level security;
alter table public.reviews           enable row level security;
alter table public.sessions          enable row level security;
alter table public.sentence_requests enable row level security;
alter table public.mw_lookups        enable row level security;

-- words: any signed-in user may READ. No write policy → only the service-role
-- client (which bypasses RLS) can insert/update/delete.
create policy words_select_authenticated on public.words
  for select to authenticated
  using (true);

-- user_cards / reviews / sessions: a user sees and writes only their own rows.
create policy user_cards_own on public.user_cards
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy reviews_own on public.reviews
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy sessions_own on public.sessions
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- sentence_requests / mw_lookups: RLS enabled, NO policies. Backend
-- (service-role) only — anon/authenticated get zero rows and cannot write.

-- ============================================================================
-- Grants (additive; Supabase default privileges usually cover these already)
-- ============================================================================
grant select on public.words to authenticated;
grant select, insert, update, delete on public.user_cards to authenticated;
grant select, insert, update, delete on public.reviews    to authenticated;
grant select, insert, update, delete on public.sessions   to authenticated;

grant all on public.words             to service_role;
grant all on public.user_cards        to service_role;
grant all on public.reviews           to service_role;
grant all on public.sessions          to service_role;
grant all on public.sentence_requests to service_role;
grant all on public.mw_lookups        to service_role;

-- ============================================================================
-- Functions
-- ============================================================================

-- updated_at auto-bump — words only. user_cards/sessions keep the client's
-- updated_at for last-write-wins, so they get NO such trigger.
create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger words_touch_updated_at
  before update on public.words
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- claim_sentence_tickets(max_tickets, timeout_minutes)
--
-- Ticket queue "worker" step. Atomically claims up to `max_tickets` idle or
-- stale tickets, stamps locked_at = now() on them, and returns their word_ids.
-- FOR UPDATE SKIP LOCKED means two workers running concurrently never grab the
-- same ticket. A ticket whose locked_at is older than `timeout_minutes` is
-- treated as idle again (previous worker died mid-job).
--
-- Call with CONFIG.MAX_TICKETS_PER_SESSION and CONFIG.TICKET_TIMEOUT_MINUTES.
-- The caller then generates sentences per word_id and finishes each with
-- complete_sentence_ticket().
-- ----------------------------------------------------------------------------
create function public.claim_sentence_tickets(max_tickets integer, timeout_minutes integer)
returns table (word_id uuid)
language plpgsql
set search_path = public, pg_temp
as $$
begin
  return query
  update public.sentence_requests sr
     set locked_at = now()
   where sr.word_id in (
     select cand.word_id
       from public.sentence_requests cand
      where cand.locked_at is null
         or cand.locked_at < now() - make_interval(mins => timeout_minutes)
      order by cand.created_at
      limit max_tickets
      for update skip locked
   )
  returning sr.word_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- complete_sentence_ticket(word_id, new_sentences, max_pool)
--
-- Ticket "finish" step, atomic: append the freshly generated sentences to
-- words.sentences, flip pool_full when the active (non-flagged) count reaches
-- `max_pool`, and delete the ticket. updated_at is bumped by the trigger.
--
-- Call with CONFIG.MAX_SENTENCE_POOL as max_pool. `new_sentences` is a JSON
-- array of { text, form, hide_count: 0, flagged: false }.
-- ----------------------------------------------------------------------------
create function public.complete_sentence_ticket(word_id uuid, new_sentences jsonb, max_pool integer)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  active_count integer;
begin
  update public.words w
     set sentences = w.sentences || new_sentences
   where w.id = complete_sentence_ticket.word_id;

  select count(*) into active_count
    from public.words w,
         lateral jsonb_array_elements(w.sentences) elem
   where w.id = complete_sentence_ticket.word_id
     and coalesce((elem->>'flagged')::boolean, false) = false;

  if active_count >= max_pool then
    update public.words
       set pool_full = true
     where id = complete_sentence_ticket.word_id;
  end if;

  delete from public.sentence_requests
   where sentence_requests.word_id = complete_sentence_ticket.word_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- increment_mw_lookup(user_id, day)
--
-- Atomically bumps this user's Merriam-Webster lookup counter for `day` and
-- returns the new value. The Add-word endpoint checks the current count first,
-- then calls this right before the MW request (failed requests still count).
-- ----------------------------------------------------------------------------
create function public.increment_mw_lookup(p_user_id uuid, p_day date)
returns integer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  new_count integer;
begin
  insert into public.mw_lookups (user_id, day, count)
  values (p_user_id, p_day, 1)
  on conflict (user_id, day)
  do update set count = public.mw_lookups.count + 1
  returning count into new_count;
  return new_count;
end;
$$;

-- These functions run from the backend with the service-role key. Keep them
-- off the client roles.
revoke execute on function public.claim_sentence_tickets(integer, integer)      from public, anon, authenticated;
revoke execute on function public.complete_sentence_ticket(uuid, jsonb, integer) from public, anon, authenticated;
revoke execute on function public.increment_mw_lookup(uuid, date)               from public, anon, authenticated;
grant  execute on function public.claim_sentence_tickets(integer, integer)      to service_role;
grant  execute on function public.complete_sentence_ticket(uuid, jsonb, integer) to service_role;
grant  execute on function public.increment_mw_lookup(uuid, date)               to service_role;

commit;
