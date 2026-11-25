create table if not exists public.poker_game_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  computer_count smallint not null check (computer_count between 1 and 5),
  session_status text not null default 'active'
    check (session_status in ('active', 'paused', 'completed')),
  game_state jsonb not null check (jsonb_typeof(game_state) = 'object'),
  chip_stacks jsonb not null default '[]'::jsonb
    check (jsonb_typeof(chip_stacks) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists poker_game_sessions_status_updated_idx
  on public.poker_game_sessions (session_status, updated_at desc);

alter table public.poker_game_sessions enable row level security;

grant select, insert, update
  on table public.poker_game_sessions
  to authenticated;

create policy "Players can read their own poker session"
  on public.poker_game_sessions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Players can create their own poker session"
  on public.poker_game_sessions
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Players can update their own poker session"
  on public.poker_game_sessions
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function public.set_poker_game_sessions_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_poker_game_sessions_updated_at
  before update on public.poker_game_sessions
  for each row
  execute function public.set_poker_game_sessions_updated_at();
