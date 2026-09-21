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
$$ language plpgsql security definer;

-- Helper: record a login attempt
create or replace function record_login_attempt(p_email text, p_success boolean)
returns void as $$
begin
  insert into login_attempts (email, success)
  values (p_email, p_success);
end;
$$ language plpgsql security definer;

-- Helper: check if account is temporarily locked
create or replace function is_account_locked(p_email text)
returns boolean as $$
declare
  failed_cnt integer;
begin
  failed_cnt := count_failed_logins(p_email);
  return failed_cnt >= 5;  -- lock after 5 failed attempts in 15 min
end;
$$ language plpgsql security definer;

-- ── 2. Save data integrity ──────────────────────────────────────────────
alter table player_saves
  add column if not exists data_hash text;

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

drop trigger if exists trg_compute_save_hash on player_saves;
create trigger trg_compute_save_hash
  before insert or update on player_saves
  for each row
  execute function set_save_hash();

-- ── 3. Updated RLS policies ──────────────────────────────────────────────
drop policy if exists "users can view own save";
create policy "users can view own save" on player_saves
  for select using (
    auth.uid() = user_id
  );

drop policy if exists "users can insert own save";
create policy "users can insert own save" on player_saves
  for insert with check (auth.uid() = user_id);

drop policy if exists "users can update own save";
create policy "users can update own save" on player_saves
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "users can delete own save";
create policy "users can delete own save" on player_saves
  for delete using (auth.uid() = user_id);

-- ── 4. Email confirmation enforcement ───────────────────────────────────
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
$$ language plpgsql security definer;

-- ── 5. Username sanitization ────────────────────────────────────────────
create or replace function sanitize_username()
returns text as $$
begin
  return regexp_replace(
    $1,
    '<[^>]*>',
    '',
    'g'
  );
end;
$$ language plpgsql security definer;
