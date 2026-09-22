-- ==============================================================================
-- DUNGEON LEGENDS — COMPLETE MASTER DATABASE SCHEMA
-- ==============================================================================
-- Paste and run this script in your Supabase SQL Editor.
-- This script resets and rebuilds all game tables, RLS policies, and realtime sync.
-- ==============================================================================

-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Clean up previous tables (safe cascade)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP TABLE IF EXISTS public.session_players CASCADE;
DROP TABLE IF EXISTS public.game_sessions CASCADE;
DROP TABLE IF EXISTS public.player_saves CASCADE;
DROP TABLE IF EXISTS public.player_stats CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.login_attempts CASCADE;
DROP TABLE IF EXISTS public.test CASCADE;

-- ------------------------------------------------------------------------------
-- 3. Profiles Table (Player Identity)
-- ------------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username    TEXT NOT NULL,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view profiles" 
  ON public.profiles FOR SELECT 
  TO authenticated, anon 
  USING (true);

CREATE POLICY "Users can insert their own profile" 
  ON public.profiles FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
  ON public.profiles FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = id);

-- ------------------------------------------------------------------------------
-- 4. Player Stats Table (Level, Coins, Experience)
-- ------------------------------------------------------------------------------
CREATE TABLE public.player_stats (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  hunter_level INTEGER NOT NULL DEFAULT 1,
  experience   INTEGER NOT NULL DEFAULT 0,
  coins        INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.player_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own stats" 
  ON public.player_stats FOR SELECT 
  TO authenticated 
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own stats" 
  ON public.player_stats FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own stats" 
  ON public.player_stats FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = id);

-- ------------------------------------------------------------------------------
-- 5. Player Saves Table (Inventory, Equipment, Online Cloud Save)
-- ------------------------------------------------------------------------------
CREATE TABLE public.player_saves (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  inventory  JSONB NOT NULL DEFAULT '[]'::jsonb,
  equipment  JSONB NOT NULL DEFAULT '{}'::jsonb,
  gold       INTEGER NOT NULL DEFAULT 100 CHECK (gold >= 0),
  stats      JSONB NOT NULL DEFAULT '{}'::jsonb,
  data_hash  TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_player_saves_updated_at ON public.player_saves (updated_at);

ALTER TABLE public.player_saves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own save" 
  ON public.player_saves FOR SELECT 
  TO authenticated 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own save" 
  ON public.player_saves FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own save" 
  ON public.player_saves FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own save" 
  ON public.player_saves FOR DELETE 
  TO authenticated 
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 6. Real-Time Multiplayer Tables
-- ------------------------------------------------------------------------------
CREATE TABLE public.game_sessions (
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

CREATE INDEX idx_game_sessions_mode ON public.game_sessions (mode);

CREATE TABLE public.session_players (
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

CREATE INDEX idx_session_players_session ON public.session_players (session_id);
CREATE INDEX idx_session_players_player ON public.session_players (player_id);

ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_players ENABLE ROW LEVEL SECURITY;

-- Multiplayer RLS
CREATE POLICY "Anyone can view public game sessions" 
  ON public.game_sessions FOR SELECT 
  TO authenticated, anon 
  USING (NOT is_private);

CREATE POLICY "Authenticated users can create game sessions" 
  ON public.game_sessions FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Creators can update game sessions" 
  ON public.game_sessions FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = creator_id);

CREATE POLICY "Creators can delete game sessions" 
  ON public.game_sessions FOR DELETE 
  TO authenticated 
  USING (auth.uid() = creator_id);

CREATE POLICY "Anyone can view session players" 
  ON public.session_players FOR SELECT 
  TO authenticated, anon 
  USING (true);

CREATE POLICY "Players can insert their own presence" 
  ON public.session_players FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = player_id);

CREATE POLICY "Players can update their own presence" 
  ON public.session_players FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = player_id);

CREATE POLICY "Players can delete their own presence" 
  ON public.session_players FOR DELETE 
  TO authenticated 
  USING (auth.uid() = player_id);

-- Enable Supabase Realtime for Multiplayer
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_players;

-- ------------------------------------------------------------------------------
-- 7. Test DB Table (for /test-db route verification)
-- ------------------------------------------------------------------------------
CREATE TABLE public.test (
  id         BIGSERIAL PRIMARY KEY,
  status     TEXT NOT NULL DEFAULT 'connected',
  message    TEXT NOT NULL DEFAULT 'Database is online and working!',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.test ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read test table" 
  ON public.test FOR SELECT 
  TO authenticated, anon 
  USING (true);

INSERT INTO public.test (status, message) 
VALUES ('connected', 'Dungeon Legends Database is fully operational!');

-- ------------------------------------------------------------------------------
-- 8. Automatic Profile and Stats Initializer Trigger
-- ------------------------------------------------------------------------------
-- Automatically creates a profile and player_stats row when a user signs up!
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 9. Multiplayer Helper Functions
-- ------------------------------------------------------------------------------
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.leave_game_session(p_session_id UUID)
RETURNS VOID AS $$
BEGIN
  DELETE FROM public.session_players
  WHERE session_id = p_session_id AND player_id = auth.uid();

  -- If creator leaves or session is empty, delete session
  IF NOT EXISTS (SELECT 1 FROM public.session_players WHERE session_id = p_session_id) THEN
    DELETE FROM public.game_sessions WHERE id = p_session_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.create_game_session(TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_game_session(UUID) TO authenticated;

-- ==============================================================================
-- DONE! All game tables, real-time sync, and auth triggers are ready!
-- ==============================================================================
