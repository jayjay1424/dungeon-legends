-- ==============================================================================
-- DUNGEON LEGENDS — MULTIPLAYER & PROFILES FIX MIGRATION
-- ==============================================================================
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql
-- ==============================================================================

-- 1. Allow authenticated users to search ALL profiles (needed for friend search)
DROP POLICY IF EXISTS "Authenticated users can search all profiles" ON public.profiles;
CREATE POLICY "Authenticated users can search all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (true);

-- 2. Ensure the friends table also allows looking up profiles via join
--    (The above policy covers this, but be explicit about UPDATE too)
DROP POLICY IF EXISTS "Authenticated users can update own profile" ON public.profiles;
CREATE POLICY "Authenticated users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 3. Enable Realtime broadcast for game channels (no table needed for broadcast,
--    but ensure the realtime extension is properly enabled)
DO $$
BEGIN
  -- Add profiles to realtime if not already there (for presence features)
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'profiles'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
    END IF;
  END IF;
END $$;

-- 4. Add game_saves table for cloud persistence (if not exists)
CREATE TABLE IF NOT EXISTS public.game_saves (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  save_data   JSONB NOT NULL DEFAULT '{}',
  data_hash   TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_game_saves_user UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_game_saves_user_id ON public.game_saves (user_id);

ALTER TABLE public.game_saves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own save" ON public.game_saves;
CREATE POLICY "Users can view their own save" ON public.game_saves
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can upsert their own save" ON public.game_saves;
CREATE POLICY "Users can upsert their own save" ON public.game_saves
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
