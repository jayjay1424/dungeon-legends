-- Dungeon Legends — player_saves table
-- Run this in your Supabase SQL editor (or via supabase db push)
-- Requires: auth schema (default with Supabase)

create table if not exists player_saves (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  inventory jsonb not null default '[]',
  equipment jsonb not null default '{}',
  gold      integer not null default 100 check (gold >= 0),
  stats     jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- One row per player; upsert pattern uses ON CONFLICT (user_id)
create index if not exists idx_player_saves_updated_at on player_saves (updated_at);

-- Enable Row Level Security
alter table player_saves enable row level security;

-- Policies: users can only read/write their own row
create policy "users can view own save" on player_saves
  for select using (auth.uid() = user_id);

create policy "users can insert own save" on player_saves
  for insert with check (auth.uid() = user_id);

create policy "users can update own save" on player_saves
  for update using (auth.uid() = user_id);

create policy "users can delete own save" on player_saves
  for delete using (auth.uid() = user_id);

-- Storage: keep JSON human-readable in the dashboard
comment on table player_saves is '
  Per-player persistent game state.
  inventory: array of InventoryEntry (id, amount, …)
  equipment: record of EquipmentSlot → InventoryEntry
  gold: current gold balance
  stats: full stats object (hp, maxHp, level, xp, attack, …)
';
