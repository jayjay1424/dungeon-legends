-- Dungeon Legends — Auth Security: Rate Limiting & Integrity (FIXED)
-- Run in Supabase SQL editor
-- Fixes: search_path, digest() qualification, missing trigger function, grants

BEGIN;

-- ── 1. Login attempt tracking (rate limiting) ──────────────────────────
CREATE TABLE IF NOT EXISTS login_attempts (
  id          BIGSERIAL PRIMARY KEY,
  email       TEXT    NOT NULL,
  success     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_email_created
  ON login_attempts (email, created_at);

-- Helper: count failed attempts in last 15 minutes
CREATE OR REPLACE FUNCTION count_failed_logins(p_email TEXT)
RETURNS INTEGER AS $$
DECLARE
  cnt INTEGER;
BEGIN
  SELECT COUNT(*) INTO cnt
  FROM login_attempts
  WHERE email = p_email
    AND success = FALSE
    AND created_at > NOW() - INTERVAL '15 minutes';
  RETURN cnt;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions;

-- Helper: record a login attempt
CREATE OR REPLACE FUNCTION record_login_attempt(p_email TEXT, p_success BOOLEAN)
RETURNS VOID AS $$
BEGIN
  INSERT INTO login_attempts (email, success)
  VALUES (p_email, p_success);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions;

-- Helper: check if account is temporarily locked
CREATE OR REPLACE FUNCTION is_account_locked(p_email TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  failed_cnt INTEGER;
BEGIN
  failed_cnt := count_failed_logins(p_email);
  RETURN failed_cnt >= 5;  -- lock after 5 failed attempts in 15 min
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions;

-- ── 2. Save data integrity ──────────────────────────────────────────────
ALTER TABLE player_saves
  ADD COLUMN IF NOT EXISTS data_hash TEXT;

-- Compute hash for save data (qualified with pgcrypto.)
CREATE OR REPLACE FUNCTION compute_save_hash(
  p_inventory JSONB,
  p_equipment JSONB,
  p_gold      INTEGER,
  p_stats     JSONB
) RETURNS TEXT AS $$
BEGIN
  RETURN ENCODE(
    PGCRYPTO.DIGEST(
      JSONB_BUILD_OBJECT(
        'inv', p_inventory,
        'equip', p_equipment,
        'gold', p_gold,
        'stats', p_stats
      )::TEXT,
      'sha256'
    ),
    'hex'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions;

-- The trigger function that set_save_hash() calls
CREATE OR REPLACE FUNCTION set_save_hash()
RETURNS TRIGGER AS $$
BEGIN
  NEW.data_hash := compute_save_hash(
    NEW.inventory,
    NEW.equipment,
    NEW.gold,
    NEW.stats
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions;

-- Drop and recreate trigger (idempotent)
DROP TRIGGER IF EXISTS trg_compute_save_hash ON player_saves;
CREATE TRIGGER trg_compute_save_hash
  BEFORE INSERT OR UPDATE ON player_saves
  FOR EACH ROW
  EXECUTE FUNCTION set_save_hash();

-- ── 3. Updated RLS policies ──────────────────────────────────────────────
DROP POLICY IF EXISTS "users can view own save" ON player_saves;
CREATE POLICY "users can view own save" ON player_saves
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users can insert own save" ON player_saves;
CREATE POLICY "users can insert own save" ON player_saves
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users can update own save" ON player_saves;
CREATE POLICY "users can update own save" ON player_saves
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users can delete own save" ON player_saves;
CREATE POLICY "users can delete own save" ON player_saves
  FOR DELETE USING (auth.uid() = user_id);

-- ── 4. Email confirmation enforcement ───────────────────────────────────
CREATE OR REPLACE FUNCTION has_confirmed_email(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  email_confirmed BOOLEAN;
BEGIN
  SELECT email_confirmed INTO email_confirmed
  FROM auth.users
  WHERE id = p_user_id;
  RETURN email_confirmed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions;

-- ── 5. Username sanitization ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sanitize_username()
RETURNS TEXT AS $$
BEGIN
  RETURN REGEXP_REPLACE(
    $1,
    '<[^>]*>',
    '',
    'g'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions;

-- ── 6. Grants for browser RPC calls ─────────────────────────────────────
-- Allow authenticated users to call rate-limit functions via RPC
GRANT EXECUTE ON FUNCTION is_account_locked(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION record_login_attempt(TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION count_failed_logins(TEXT) TO authenticated;

-- Also grant compute_save_hash for server-side integrity checks
GRANT EXECUTE ON FUNCTION compute_save_hash(JSONB, JSONB, INTEGER, JSONB) TO authenticated;

-- ── 7. RLS on login_attempts (internal table, no client access) ─────────
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;

-- Revoke direct table access (the recording function still works via security definer)
REVOKE ALL ON login_attempts FROM PUBLIC;
REVOKE ALL ON login_attempts FROM authenticated;

COMMIT;
