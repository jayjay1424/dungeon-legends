-- ==============================================================================
-- DUNGEON LEGENDS — MULTIPLAYER & PROFILES FIX (SAFE / IDEMPOTENT)
-- ==============================================================================
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql
-- ==============================================================================

-- 1. Profiles: Allow authenticated users to search profiles for adding friends
DROP POLICY IF EXISTS "Authenticated users can search all profiles" ON public.profiles;
CREATE POLICY "Authenticated users can search all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can update own profile" ON public.profiles;
CREATE POLICY "Authenticated users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 2. Realtime: Enable realtime presence on profiles
DO $$
BEGIN
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

-- 3. Player Saves: Safe drop existing policies before re-creating to avoid conflict 42710
ALTER TABLE IF EXISTS public.player_saves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users can view own save" ON public.player_saves;
DROP POLICY IF EXISTS "Users can view own save" ON public.player_saves;
CREATE POLICY "users can view own save" ON public.player_saves
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users can insert own save" ON public.player_saves;
DROP POLICY IF EXISTS "Users can insert own save" ON public.player_saves;
CREATE POLICY "users can insert own save" ON public.player_saves
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users can update own save" ON public.player_saves;
DROP POLICY IF EXISTS "Users can update own save" ON public.player_saves;
CREATE POLICY "users can update own save" ON public.player_saves
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users can delete own save" ON public.player_saves;
DROP POLICY IF EXISTS "Users can delete own save" ON public.player_saves;
CREATE POLICY "users can delete own save" ON public.player_saves
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
