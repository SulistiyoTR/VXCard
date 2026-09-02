-- VX Card — offline-first sync + push (SPEC 6.3 / 6.4)

-- ---------------------------------------------------------------------------
-- updated_at for last-write-wins conflict resolution
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

alter table public.words    add column if not exists updated_at   timestamptz not null default now();
alter table public.words    add column if not exists review_count int         not null default 0;
alter table public.sessions add column if not exists updated_at   timestamptz not null default now();

drop trigger if exists words_touch on public.words;
create trigger words_touch before update on public.words
  for each row execute function public.touch_updated_at();

drop trigger if exists sessions_touch on public.sessions;
create trigger sessions_touch before update on public.sessions
  for each row execute function public.touch_updated_at();

create index if not exists idx_words_updated on public.words (user_id, updated_at);
create index if not exists idx_sessions_updated on public.sessions (user_id, updated_at);

-- ---------------------------------------------------------------------------
-- push_subscriptions (SPEC 6.3)
-- ---------------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  endpoint    text not null,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now(),
  constraint push_endpoint_unique unique (user_id, endpoint)
);

alter table public.push_subscriptions enable row level security;
drop policy if exists "own rows" on public.push_subscriptions;
create policy "own rows" on public.push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
