-- ==============================================================================
-- DUNGEON LEGENDS — SAFE NON-DESTRUCTIVE MIGRATION (IDEMPOTENT)
-- ==============================================================================
-- Preserves existing tables and data! Safe to run repeatedly.
-- ==============================================================================

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Tables (Non-destructive: CREATE TABLE IF NOT EXISTS)

-- Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username    TEXT NOT NULL,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Player Stats
CREATE TABLE IF NOT EXISTS public.player_stats (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  hunter_level INTEGER NOT NULL DEFAULT 1,
  experience   INTEGER NOT NULL DEFAULT 0,
  coins        INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Player Saves
CREATE TABLE IF NOT EXISTS public.player_saves (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  inventory  JSONB NOT NULL DEFAULT '[]'::jsonb,
  equipment  JSONB NOT NULL DEFAULT '{}'::jsonb,
  gold       INTEGER NOT NULL DEFAULT 100 CHECK (gold >= 0),
  stats      JSONB NOT NULL DEFAULT '{}'::jsonb,
  data_hash  TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure data_hash column exists if player_saves already existed
ALTER TABLE public.player_saves ADD COLUMN IF NOT EXISTS data_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_player_saves_updated_at ON public.player_saves (updated_at);

-- Game Sessions
CREATE TABLE IF NOT EXISTS public.game_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mode        TEXT NOT NULL CHECK (mode IN ('survival', 'defence', 'hunt')),
  name        TEXT NOT NULL DEFAULT 'Lobby',
  creator_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  max_players INTEGER NOT NULL DEFAULT 8 CHECK (max_players BETWEEN 2 AND 16),
  is_private  BOOLEAN NOT NULL DEFAULT FALSE,
  is_full     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_game_sessions_mode ON public.game_sessions (mode);
CREATE INDEX IF NOT EXISTS idx_game_sessions_created ON public.game_sessions (created_at);

-- Session Players
CREATE TABLE IF NOT EXISTS public.session_players (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  player_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT 'Adventurer',
  level        INTEGER NOT NULL DEFAULT 1,
  hp           INTEGER NOT NULL DEFAULT 100,
  gold         INTEGER NOT NULL DEFAULT 0,
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(session_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_session_players_session ON public.session_players (session_id);
CREATE INDEX IF NOT EXISTS idx_session_players_player ON public.session_players (player_id);

-- Test Table
CREATE TABLE IF NOT EXISTS public.test (
  id         BIGSERIAL PRIMARY KEY,
  status     TEXT NOT NULL DEFAULT 'connected',
  message    TEXT NOT NULL DEFAULT 'Database is online and working!',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test ENABLE ROW LEVEL SECURITY;

-- 4. Idempotent Policies (DROP IF EXISTS before CREATE)

-- Profiles
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
CREATE POLICY "Anyone can view profiles" ON public.profiles FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Player Stats
DROP POLICY IF EXISTS "Users can view their own stats" ON public.player_stats;
CREATE POLICY "Users can view their own stats" ON public.player_stats FOR SELECT TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own stats" ON public.player_stats;
CREATE POLICY "Users can insert their own stats" ON public.player_stats FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own stats" ON public.player_stats;
CREATE POLICY "Users can update their own stats" ON public.player_stats FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Player Saves
DROP POLICY IF EXISTS "Users can view own save" ON public.player_saves;
CREATE POLICY "Users can view own save" ON public.player_saves FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own save" ON public.player_saves;
CREATE POLICY "Users can insert own save" ON public.player_saves FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own save" ON public.player_saves;
CREATE POLICY "Users can update own save" ON public.player_saves FOR UPDATE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own save" ON public.player_saves;
CREATE POLICY "Users can delete own save" ON public.player_saves FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Game Sessions
DROP POLICY IF EXISTS "Anyone can view public game sessions" ON public.game_sessions;
CREATE POLICY "Anyone can view public game sessions" ON public.game_sessions FOR SELECT TO authenticated, anon USING (NOT is_private);

DROP POLICY IF EXISTS "Authenticated users can create game sessions" ON public.game_sessions;
CREATE POLICY "Authenticated users can create game sessions" ON public.game_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "Creators can update game sessions" ON public.game_sessions;
CREATE POLICY "Creators can update game sessions" ON public.game_sessions FOR UPDATE TO authenticated USING (auth.uid() = creator_id);

DROP POLICY IF EXISTS "Creators can delete game sessions" ON public.game_sessions;
CREATE POLICY "Creators can delete game sessions" ON public.game_sessions FOR DELETE TO authenticated USING (auth.uid() = creator_id);

-- Session Players
DROP POLICY IF EXISTS "Anyone can view session players" ON public.session_players;
CREATE POLICY "Anyone can view session players" ON public.session_players FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "Players can insert their own presence" ON public.session_players;
CREATE POLICY "Players can insert their own presence" ON public.session_players FOR INSERT TO authenticated WITH CHECK (auth.uid() = player_id);

DROP POLICY IF EXISTS "Players can update their own presence" ON public.session_players;
CREATE POLICY "Players can update their own presence" ON public.session_players FOR UPDATE TO authenticated USING (auth.uid() = player_id);

DROP POLICY IF EXISTS "Players can delete their own presence" ON public.session_players;
CREATE POLICY "Players can delete their own presence" ON public.session_players FOR DELETE TO authenticated USING (auth.uid() = player_id);

-- Test table
DROP POLICY IF EXISTS "Anyone can read test table" ON public.test;
CREATE POLICY "Anyone can read test table" ON public.test FOR SELECT TO authenticated, anon USING (true);

-- 5. Table Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_stats TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_saves TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_sessions TO authenticated;
GRANT SELECT ON public.game_sessions TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_players TO authenticated;
GRANT SELECT ON public.session_players TO anon;

GRANT SELECT ON public.test TO authenticated, anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon;

-- 6. Functions (Security Definer with search_path)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1), 'Adventurer')
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.player_stats (id, hunter_level, experience, coins)
  VALUES (NEW.id, 1, 0, 0)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.player_saves (user_id, inventory, equipment, gold, stats)
  VALUES (NEW.id, '[]'::jsonb, '{}'::jsonb, 100, '{}'::jsonb)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions;

-- Drop and recreate user signup trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Multiplayer helper functions
CREATE OR REPLACE FUNCTION public.create_game_session(
  p_mode TEXT,
  p_max_players INTEGER DEFAULT 8
) RETURNS UUID AS $$
DECLARE
  v_session_id UUID;
  v_username TEXT;
  v_level INTEGER;
BEGIN
  INSERT INTO public.game_sessions (mode, creator_id, max_players)
  VALUES (p_mode, auth.uid(), p_max_players)
  RETURNING id INTO v_session_id;

  SELECT COALESCE(username, 'Adventurer') INTO v_username
  FROM public.profiles WHERE id = auth.uid();

  SELECT COALESCE(hunter_level, 1) INTO v_level
  FROM public.player_stats WHERE id = auth.uid();

  INSERT INTO public.session_players (session_id, player_id, display_name, level)
  VALUES (v_session_id, auth.uid(), COALESCE(v_username, 'Adventurer'), COALESCE(v_level, 1))
  ON CONFLICT (session_id, player_id) DO NOTHING;

  RETURN v_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions;

CREATE OR REPLACE FUNCTION public.leave_game_session(p_session_id UUID)
RETURNS VOID AS $$
BEGIN
  DELETE FROM public.session_players
  WHERE session_id = p_session_id AND player_id = auth.uid();

  IF NOT EXISTS (SELECT 1 FROM public.session_players WHERE session_id = p_session_id) THEN
    DELETE FROM public.game_sessions WHERE id = p_session_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions;

GRANT EXECUTE ON FUNCTION public.create_game_session(TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_game_session(UUID) TO authenticated;

-- 7. Idempotent Realtime Publication Setup
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'game_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.game_sessions;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'session_players'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.session_players;
  END IF;
END $$;

-- 8. Seed test table if empty
INSERT INTO public.test (status, message)
SELECT 'connected', 'Dungeon Legends Database is fully operational!'
WHERE NOT EXISTS (SELECT 1 FROM public.test);
