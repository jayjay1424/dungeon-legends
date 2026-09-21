-- Dungeon Legends — Real-time Multiplayer
-- Run in Supabase SQL editor

-- ── 1. Game Sessions ─────────────────────────────────────────────────────────
create table if not exists game_sessions (
  id            uuid primary key default gen_random_uuid(),
  mode          text    not null check (mode in ('survival', 'defence', 'hunt')),
  name          text    not null default 'Lobby',
  creator_id    uuid    not null references auth.users(id) on delete cascade,
  max_players   integer not null default 8 check (max_players between 2 and 16),
  is_private    boolean not null default false,
  is_full       boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_game_sessions_mode on game_sessions (mode);
create index if not exists idx_game_sessions_created on game_sessions (created_at);

-- ── 2. Session Players ───────────────────────────────────────────────────────
create table if not exists session_players (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid    not null references game_sessions(id) on delete cascade,
  player_id    uuid    not null references auth.users(id) on delete cascade,
  display_name text    not null default 'Adventurer',
  level        integer not null default 1,
  hp          integer not null default 100,
  gold        integer not null default 0,
  joined_at    timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique(session_id, player_id)
);

create index if not exists idx_session_players_session on session_players (session_id);
create index if not exists idx_session_players_player on session_players (player_id);

-- ── 3. Row Level Security ─────────────────────────────────────────────────────
alter table game_sessions enable row level security;
alter table session_players enable row level security;

-- Anyone can view public sessions
create policy "anyone can view public sessions" on game_sessions
  for select using (not is_private);

-- Authenticated users can create sessions
create policy "authenticated can create sessions" on game_sessions
  for insert with check (auth.uid() = creator_id);

-- Creators can update/delete their sessions
create policy "creator can update session" on game_sessions
  for update using (auth.uid() = creator_id);

create policy "creator can delete session" on game_sessions
  for delete using (auth.uid() = creator_id);

-- Session players: authenticated users manage their own presence
create policy "players can view session members" on session_players
  for select using (auth.uid() = player_id or exists (
    select 1 from game_sessions where id = session_id and not is_private
  ));

create policy "players can insert own presence" on session_players
  for insert with check (auth.uid() = player_id);

create policy "players can update own presence" on session_players
  for update using (auth.uid() = player_id);

create policy "players can delete own presence" on session_players
  for delete using (auth.uid() = player_id);

-- ── 4. Helper Functions ───────────────────────────────────────────────────────
-- Create a new public session and return it
create or replace function create_game_session(
  p_mode       text,
  p_max_players integer default 8
) returns uuid as $$
declare
  v_session_id uuid;
begin
  insert into game_sessions (mode, creator_id, max_players)
  values (p_mode, auth.uid(), p_max_players)
  returning id into v_session_id;

  -- Auto-join creator
  insert into session_players (session_id, player_id, display_name, level)
  select v_session_id, auth.uid(),
    coalesce((select username from profiles where id = auth.uid()), 'Adventurer'),
    coalesce((select hunter_level from player_stats where id = auth.uid()), 1);

  return v_session_id;
end;
$$ language plpgsql security definer;

-- Leave a session (remove player)
create or replace function leave_game_session(p_session_id uuid)
returns void as $$
begin
  delete from session_players where session_id = p_session_id and player_id = auth.uid();

  -- Mark session as not full if players dropped below max
  update game_sessions set is_full = false
  where id = p_session_id and is_full = true
  and (select count(*) from session_players where session_id = p_session_id) < max_players;
end;
$$ language plpgsql security definer;

-- Get active session count per mode
create or replace function active_session_count(p_mode text)
returns integer as $$
declare
  cnt integer;
begin
  select count(*) into cnt from game_sessions
  where mode = p_mode and not is_private;
  return cnt;
end;
$$ language sql security definer;

-- ── 5. Realtime Broadcasts via Supabase Broadcast ────────────────────────────
-- UseSupabaseRealtime channel: 'public:sessions'
-- Events:
--   'session:created'  → new session available
--   'session:join'     → player joined
--   'session:leave'    → player left
--   'session:update'   → player stats updated

