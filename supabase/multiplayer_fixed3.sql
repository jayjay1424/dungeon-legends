-- Dungeon Legends — Real-time Multiplayer (FIXED)
-- Run in Supabase SQL editor
-- Fixes: SET search_path on all security-definer functions

BEGIN;

-- ── 1. Game Sessions ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS game_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mode          TEXT    NOT NULL CHECK (mode IN ('survival', 'defence', 'hunt')),
  name          TEXT    NOT NULL DEFAULT 'Lobby',
  creator_id    UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  max_players   INTEGER NOT NULL DEFAULT 8 CHECK (max_players BETWEEN 2 AND 16),
  is_private    BOOLEAN NOT NULL DEFAULT FALSE,
  is_full       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_game_sessions_mode ON game_sessions (mode);
CREATE INDEX IF NOT EXISTS idx_game_sessions_created ON game_sessions (created_at);

-- ── 2. Session Players ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS session_players (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID    NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  player_id    UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT    NOT NULL DEFAULT 'Adventurer',
  level        INTEGER NOT NULL DEFAULT 1,
  hp          INTEGER NOT NULL DEFAULT 100,
  gold        INTEGER NOT NULL DEFAULT 0,
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(session_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_session_players_session ON session_players (session_id);
CREATE INDEX IF NOT EXISTS idx_session_players_player ON session_players (player_id);

-- ── 3. Row Level Security ─────────────────────────────────────────────────────
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone can view public sessions" ON game_sessions;
CREATE POLICY "anyone can view public sessions" ON game_sessions
  FOR SELECT USING (NOT is_private);

DROP POLICY IF EXISTS "authenticated can create sessions" ON game_sessions;
CREATE POLICY "authenticated can create sessions" ON game_sessions
  FOR INSERT WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "creator can update session" ON game_sessions;
CREATE POLICY "creator can update session" ON game_sessions
  FOR UPDATE USING (auth.uid() = creator_id);

DROP POLICY IF EXISTS "creator can delete session" ON game_sessions;
CREATE POLICY "creator can delete session" ON game_sessions
  FOR DELETE USING (auth.uid() = creator_id);

DROP POLICY IF EXISTS "players can view session members" ON session_players;
CREATE POLICY "players can view session members" ON session_players
  FOR SELECT USING (auth.uid() = player_id OR EXISTS (
    SELECT 1 FROM game_sessions WHERE id = session_id AND NOT is_private
  ));

DROP POLICY IF EXISTS "players can insert own presence" ON session_players;
CREATE POLICY "players can insert own presence" ON session_players
  FOR INSERT WITH CHECK (auth.uid() = player_id);

DROP POLICY IF EXISTS "players can update own presence" ON session_players;
CREATE POLICY "players can update own presence" ON session_players
  FOR UPDATE USING (auth.uid() = player_id);

DROP POLICY IF EXISTS "players can delete own presence" ON session_players;
CREATE POLICY "players can delete own presence" ON session_players
  FOR DELETE USING (auth.uid() = player_id);

-- ── 4. Helper Functions ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION create_game_session(
  p_mode       TEXT,
  p_max_players INTEGER DEFAULT 8
) RETURNS UUID AS $$
DECLARE
  v_session_id UUID;
BEGIN
  INSERT INTO game_sessions (mode, creator_id, max_players)
  VALUES (p_mode, auth.uid(), p_max_players)
  RETURNING id INTO v_session_id;

  INSERT INTO session_players (session_id, player_id, display_name, level)
  SELECT v_session_id, auth.uid(),
    COALESCE((SELECT username FROM profiles WHERE id = auth.uid()), 'Adventurer'),
    COALESCE((SELECT hunter_level FROM player_stats WHERE id = auth.uid()), 1);

  RETURN v_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions;

CREATE OR REPLACE FUNCTION leave_game_session(p_session_id UUID)
RETURNS VOID AS $$
BEGIN
  DELETE FROM session_players WHERE session_id = p_session_id AND player_id = auth.uid();

  UPDATE game_sessions SET is_full = FALSE
  WHERE id = p_session_id AND is_full = TRUE
  AND (SELECT COUNT(*) FROM session_players WHERE session_id = p_session_id) < max_players;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions;

CREATE OR REPLACE FUNCTION active_session_count(p_mode TEXT)
RETURNS INTEGER AS $$
DECLARE
  cnt INTEGER;
BEGIN
  SELECT COUNT(*) INTO cnt FROM game_sessions
  WHERE mode = p_mode AND NOT is_private;
  RETURN cnt;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions;

COMMIT;
