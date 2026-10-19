-- LOCAL TEST ONLY — never run on the Supabase project.
-- Recreates the parts of a Supabase database that the SoFitGo migration depends on, on a plain PostgreSQL 16:
--   roles anon / authenticated / service_role, schema auth, auth.users, and auth.uid() / auth.role() with the same
--   definitions Supabase uses (they read the JWT claims that PostgREST puts in request.jwt.claims).
-- With this, the migration's RLS policies are exercised by the real PostgreSQL policy engine.
do $$ begin
  if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit bypassrls; end if;
end $$;
create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  encrypted_password text,
  email_confirmed_at timestamptz,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists auth.refresh_tokens (
  token text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);
create or replace function auth.uid() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
                  (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid
$$;
create or replace function auth.role() returns text language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''),
                  (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'))::text
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
grant execute on function auth.uid(), auth.role() to anon, authenticated, service_role;
-- Supabase's default: new public tables are fully granted to these roles; the migration then revokes/regrants.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
