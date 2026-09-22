-- ==============================================================================
-- DUNGEON LEGENDS — FRIENDS SYSTEM & 20-PLAYER CAPACITY MIGRATION
-- ==============================================================================
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql
-- ==============================================================================

-- 1. Create the Friends Table (Safe & Idempotent)
CREATE TABLE IF NOT EXISTS public.friends (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'accepted' CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_friends_user_friend UNIQUE (user_id, friend_id)
);

-- 2. Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_friends_user_id ON public.friends (user_id);
CREATE INDEX IF NOT EXISTS idx_friends_friend_id ON public.friends (friend_id);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for Friends
DROP POLICY IF EXISTS "Users can view their own friends" ON public.friends;
CREATE POLICY "Users can view their own friends" ON public.friends
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can add friends" ON public.friends;
CREATE POLICY "Users can add friends" ON public.friends
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own friends" ON public.friends;
CREATE POLICY "Users can delete their own friends" ON public.friends
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their friends" ON public.friends;
CREATE POLICY "Users can update their friends" ON public.friends
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- 5. Expand game_sessions capacity to 20 players
ALTER TABLE public.game_sessions DROP CONSTRAINT IF EXISTS game_sessions_max_players_check;
ALTER TABLE public.game_sessions ADD CONSTRAINT game_sessions_max_players_check CHECK (max_players BETWEEN 2 AND 20);

-- 6. Ensure Realtime is enabled for friends table (Safe block)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'friends'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.friends;
    END IF;
  END IF;
END $$;
