-- SoFitGo closed beta — core schema (Supabase, PostgreSQL 15+). Migration 20261020000100.
-- Design (docs/BACKEND-ARCHITECTURE.md):
--   * Supabase Auth owns identities (auth.users.id = the unique account id). No passwords are stored by the app.
--   * The app's existing data model is kept: each data area the app already backs up (profile, workouts, nutrition,
--     tracking, plans) is stored as ONE versioned JSON document per user in public.user_state. No screen rewrite, same
--     validation as the app's backup restore; `rev` gives optimistic concurrency (conflicts are detected, never overwritten).
--   * Every table holding personal data has RLS enabled with explicit per-command policies scoped to auth.uid().
--   * anon has no access to personal tables. No service_role key is needed by the app.
--   * Photos (profile photo, progress photos) stay on the device in this beta; there is no storage bucket.
-- Safe to run once on an empty project: creates objects only; no DROP, no data deletion.

begin;

-- ── profiles: display data only (first name). id = auth.users.id ──────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text check (first_name is null or char_length(first_name) between 1 and 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── user_state: the app's data areas as versioned JSON documents ───────────────────────────────────────────────
create table if not exists public.user_state (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  section text not null check (section in ('profile', 'workouts', 'nutrition', 'tracking', 'plans')),
  data jsonb not null check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 1048576),
  rev integer not null default 1 check (rev > 0),
  client_build text check (client_build is null or client_build ~ '^[0-9a-f]{6,20}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, section)
);

-- ── bug_reports: beta feedback; a tester sees only their own reports ───────────────────────────────────────────
create table if not exists public.bug_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_report_id text not null check (client_report_id ~ '^[A-Za-z0-9-]{8,40}$'),
  category text not null check (category in ('bug', 'idea', 'usability', 'other')),
  title text not null check (char_length(btrim(title)) between 3 and 120),
  description text not null check (char_length(btrim(description)) between 1 and 4000),
  steps text check (steps is null or char_length(steps) <= 4000),
  expected text check (expected is null or char_length(expected) <= 2000),
  actual text check (actual is null or char_length(actual) <= 2000),
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  screen text check (screen is null or char_length(screen) <= 60),
  app_build text check (app_build is null or app_build ~ '^[0-9a-f]{6,20}$'),
  platform text check (platform is null or char_length(platform) <= 300),
  status text not null default 'received' check (status in ('received', 'reviewing', 'in_progress', 'resolved')),
  created_at timestamptz not null default now(),
  unique (user_id, client_report_id)
);
create index if not exists bug_reports_user_created_idx on public.bug_reports (user_id, created_at desc);

-- ── app_config: public, read-only switches for the beta (e.g. pause the beta, show a notice) ──────────────────
create table if not exists public.app_config (
  key text primary key check (key ~ '^[a-z_]{2,40}$'),
  value jsonb not null,
  updated_at timestamptz not null default now()
);
insert into public.app_config (key, value) values
  ('beta_open', 'true'::jsonb),
  ('notice', 'null'::jsonb)
on conflict (key) do nothing;

-- ── triggers: server-owned columns cannot be forged by a client ────────────────────────────────────────────────
create or replace function public.tg_touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' then new.created_at := old.created_at; end if;
  return new;
end $$;

create or replace function public.tg_user_state_rev() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.rev := 1; new.created_at := now(); new.updated_at := now();
  else
    if new.user_id <> old.user_id or new.section <> old.section then
      raise exception 'user_state key is immutable' using errcode = '42501';
    end if;
    new.rev := old.rev + 1; new.created_at := old.created_at; new.updated_at := now();
  end if;
  return new;
end $$;

create or replace function public.tg_bug_report_insert() returns trigger
language plpgsql set search_path = '' as $$
declare recent integer;
begin
  new.status := 'received';          -- a tester cannot file a report as "resolved"
  new.created_at := now();
  select count(*) into recent from public.bug_reports
    where user_id = new.user_id and created_at > now() - interval '1 hour';
  if recent >= 20 then
    raise exception 'rate_limited: too many reports in the last hour' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before insert or update on public.profiles
  for each row execute function public.tg_touch_updated_at();
drop trigger if exists user_state_rev on public.user_state;
create trigger user_state_rev before insert or update on public.user_state
  for each row execute function public.tg_user_state_rev();
drop trigger if exists bug_reports_insert on public.bug_reports;
create trigger bug_reports_insert before insert on public.bug_reports
  for each row execute function public.tg_bug_report_insert();

-- ── Row Level Security ─────────────────────────────────────────────────────────────────────────────────────────
alter table public.profiles    enable row level security;
alter table public.user_state  enable row level security;
alter table public.bug_reports enable row level security;
alter table public.app_config  enable row level security;

-- profiles: own row only
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
drop policy if exists profiles_delete_own on public.profiles;
create policy profiles_select_own on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy profiles_insert_own on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy profiles_delete_own on public.profiles for delete to authenticated using ((select auth.uid()) = id);

-- user_state: own rows only
drop policy if exists user_state_select_own on public.user_state;
drop policy if exists user_state_insert_own on public.user_state;
drop policy if exists user_state_update_own on public.user_state;
drop policy if exists user_state_delete_own on public.user_state;
create policy user_state_select_own on public.user_state for select to authenticated using ((select auth.uid()) = user_id);
create policy user_state_insert_own on public.user_state for insert to authenticated with check ((select auth.uid()) = user_id);
create policy user_state_update_own on public.user_state for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy user_state_delete_own on public.user_state for delete to authenticated using ((select auth.uid()) = user_id);

-- bug_reports: create and read own; no update/delete by testers (status is managed by the owner in the dashboard)
drop policy if exists bug_reports_select_own on public.bug_reports;
drop policy if exists bug_reports_insert_own on public.bug_reports;
create policy bug_reports_select_own on public.bug_reports for select to authenticated using ((select auth.uid()) = user_id);
create policy bug_reports_insert_own on public.bug_reports for insert to authenticated with check ((select auth.uid()) = user_id);

-- app_config: everyone may read; nobody may write through the API
drop policy if exists app_config_read on public.app_config;
create policy app_config_read on public.app_config for select to anon, authenticated using (true);

-- ── privileges: least privilege on top of RLS ─────────────────────────────────────────────────────────────────
revoke all on public.profiles, public.user_state, public.bug_reports, public.app_config from anon, authenticated;
grant select, insert, update, delete on public.profiles   to authenticated;
grant select, insert, update, delete on public.user_state to authenticated;
grant select, insert                 on public.bug_reports to authenticated;
grant select                         on public.app_config  to anon, authenticated;
revoke execute on function public.tg_touch_updated_at(), public.tg_user_state_rev(), public.tg_bug_report_insert() from public, anon, authenticated;

-- ── account deletion (self-service). Deletes the auth user; ON DELETE CASCADE removes profiles, user_state and
--    bug_reports. SECURITY DEFINER with an empty search_path; acts only on the caller's own id. ─────────────────
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  delete from auth.users where id = me;
end $$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

commit;
