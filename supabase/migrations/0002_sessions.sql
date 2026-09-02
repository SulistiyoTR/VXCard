-- VX Card — sessions (backs Stats streak + Calendar, SPEC 4.7 / 4.10 / 4.11)
-- Not in SPEC §5's table list, but streak & the calendar need a per-session record
-- and reviews alone can't tell a completed session from an abandoned one.

create table if not exists public.sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  -- true only when the user reached the last question (SPEC 4.7)
  completed    boolean not null default false,
  planned      int not null default 0,
  answered     int not null default 0,
  source       text not null default 'due' check (source in ('due','random','practice','hardmode','mixed'))
);

create index if not exists idx_sessions_user_day on public.sessions (user_id, started_at);

alter table public.sessions enable row level security;
drop policy if exists "own rows" on public.sessions;
create policy "own rows" on public.sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
