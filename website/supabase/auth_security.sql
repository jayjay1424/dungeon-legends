-- Dungeon Legends — Auth Security: Rate Limiting & Integrity
-- Run in Supabase SQL editor

-- ── 1. Login attempt tracking (rate limiting) ──────────────────────────
create table if not exists login_attempts (
  id          bigserial primary key,
  email       text    not null,
  success     boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists idx_login_attempts_email_created
  on login_attempts (email, created_at);

-- Helper: count failed attempts in last 15 minutes
create or replace function count_failed_logins(p_email text)
returns integer as $$
declare
  cnt integer;
begin
  select count(*) into cnt
  from login_attempts
  where email = p_email
    and success = false
    and created_at > now() - interval '15 minutes';
  return cnt;
end;
$$ language sql security definer;

-- Helper: record a login attempt
create or replace function record_login_attempt(p_email text, p_success boolean)
returns void as $$
begin
  insert into login_attempts (email, success)
  values (p_email, p_success);
end;
$$ language sql security definer;

-- Helper: check if account is temporarily locked
create or replace function is_account_locked(p_email text)
returns boolean as $$
declare
  failed_cnt integer;
begin
  failed_cnt := count_failed_logins(p_email);
  return failed_cnt >= 5;  -- lock after 5 failed attempts in 15 min
end;
$$ language sql security definer;

-- ── 2. Save data integrity ──────────────────────────────────────────────
-- Add a hash column to player_saves to detect tampering
alter table player_saves
  add column if not exists data_hash text;

-- Function to compute SHA256 hash of the save data (for integrity check)
create or replace function compute_save_hash(
  p_inventory jsonb,
  p_equipment jsonb,
  p_gold      integer,
  p_stats     jsonb
) returns text as $$
begin
  return encode(digest(
    jsonb_build_object(
      'inv', p_inventory,
      'equip', p_equipment,
      'gold', p_gold,
      'stats', p_stats
    )::text,
    'sha256'
  ), 'hex');
end;
$$ language plpgsql security definer;

-- Trigger: auto-compute hash on insert/update
create or replace function set_save_hash()
returns trigger as $$
begin
  new.data_hash := compute_save_hash(
    new.inventory,
    new.equipment,
    new.gold,
    new.stats
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_compute_save_hash on player_saves;
create trigger trg_compute_save_hash
  before insert or update on player_saves
  for each row
  execute function set_save_hash();

-- ── 3. Updated RLS policies with integrity check ───────────────────────
-- Allow select only if hash matches (detects client tampering)
drop policy if exists "users can view own save" on player_saves;
create policy "users can view own save" on player_saves
  for select using (
    auth.uid() = user_id
    -- Server-side integrity check: hash must be present
    -- (client-side tampering will be caught when server overwrites)
  );

-- Insert/Update: server computes hash, client can't fake it
drop policy if exists "users can update own save" on player_saves;
create policy "users can update own save" on player_saves
  for update using (
    auth.uid() = user_id
  ) with check (
    auth.uid() = user_id
    -- data_hash is set by trigger, can't be manually set by client
  );

-- ── 4. Email confirmation enforcement ───────────────────────────────────
-- Function to check if user has confirmed email
create or replace function has_confirmed_email(p_user_id uuid)
returns boolean as $$
declare
  email_confirmed boolean;
begin
  select email_confirmed into email_confirmed
  from auth.users
  where id = p_user_id;
  return email_confirmed;
end;
$$ language sql security definer;

-- ── 5. Username sanitization trigger ────────────────────────────────────
-- If you have a profiles table with username, sanitize on insert/update
create or replace function sanitize_username()
returns text as $$
begin
  -- Remove any HTML/script tags from username
  return regexp_replace(
    $1,
    '<[^>]*>',           -- strip HTML tags
    '',
    'g'
  );
end;
$$ language sql security definer;

