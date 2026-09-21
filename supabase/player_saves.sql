-- Dungeon Legends — player_saves table
-- Run this in your Supabase SQL editor (or via supabase db push)
-- Requires: auth schema (default with Supabase)

CREATE TABLE IF NOT EXISTS player_saves (
  user_id   UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  inventory JSONB NOT NULL DEFAULT '[]',
  equipment JSONB NOT NULL DEFAULT '{}',
  gold      INTEGER NOT NULL DEFAULT 100 CHECK (gold >= 0),
  stats     JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per player; upsert pattern uses ON CONFLICT (user_id)
CREATE INDEX IF NOT EXISTS idx_player_saves_updated_at ON player_saves (updated_at);

-- Enable Row Level Security
ALTER TABLE player_saves ENABLE ROW LEVEL SECURITY;

-- Policies: users can only read/write their own row
CREATE POLICY "users can view own save" ON player_saves
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users can insert own save" ON player_saves
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users can update own save" ON player_saves
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "users can delete own save" ON player_saves
  FOR DELETE USING (auth.uid() = user_id);
