-- SoFitGo · ACTIVATE ADMIN (build 74bdd9483f). One paste in the Supabase SQL Editor. All-or-nothing: if any statement fails,
-- nothing is changed. Contains, in order: 20261025000100_sofitgo_cms.sql, 20261025000200_sofitgo_admin_feedback.sql,
-- 20261025000300_sofitgo_admin_accounts.sql (unchanged). Creates NO user, password or owner. Safe to run twice.
begin;

-- ════════ 20261025000100_sofitgo_cms.sql ════════
-- SoFitGo · Admin CMS (content management) — recipes and exercises managed in Supabase, published to the app without a rebuild.
-- NOT applied to any live project. Owner applies it after review (see docs/CMS.md). Re-runnable (idempotent).
--
-- Security model (enforced by PostgreSQL row-level security and SECURITY DEFINER functions — never by the browser):
--   • roles: owner > admin > editor > reviewer, stored in public.cms_members. Nobody can grant a role to themselves; only an owner
--     can grant or revoke roles; the FIRST owner is created once by the project owner with one SQL statement in the dashboard
--     (docs/CMS.md) — there is no API path that creates an owner.
--   • public.cms_content: what users receive. Everyone (anon/authenticated) may read rows with status published or archived
--     (archived rows tell the app to stop offering an item). Only members may read anything else. No direct writes at all:
--     every change goes through cms_publish / cms_archive / cms_restore / cms_rollback, which check the caller's role.
--   • public.cms_drafts: working copies — members only. Editors, admins and owners may write; reviewers read only.
--   • public.cms_revisions: append-only history written by the functions; members may read it.
--   • No service-role key is needed by the app or the admin screens.

create table if not exists public.cms_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'editor', 'reviewer')),
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now()
);
create table if not exists public.cms_content (
  kind text not null check (kind in ('recipe', 'exercise', 'text', 'layout', 'theme', 'config')),
  item_id text not null check (item_id ~ '^[a-z0-9_]{2,64}$'),
  status text not null check (status in ('published', 'archived')),
  data jsonb not null check (jsonb_typeof(data) = 'object' and pg_column_size(data) < 65536),
  version integer not null check (version > 0),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (kind, item_id)
);
create table if not exists public.cms_drafts (
  kind text not null check (kind in ('recipe', 'exercise', 'text', 'layout', 'theme', 'config')),
  item_id text not null check (item_id ~ '^[a-z0-9_]{2,64}$'),
  data jsonb not null check (jsonb_typeof(data) = 'object' and pg_column_size(data) < 65536),
  base_version integer not null default 0,
  note text check (note is null or length(note) <= 500),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (kind, item_id)
);
create table if not exists public.cms_revisions (
  id bigserial primary key,
  kind text not null,
  item_id text not null,
  version integer not null,
  action text not null check (action in ('publish', 'archive', 'restore', 'rollback', 'grant', 'revoke')),
  data jsonb not null,
  note text,
  actor uuid references auth.users (id) on delete set null,
  at timestamptz not null default now()
);
create index if not exists cms_revisions_item on public.cms_revisions (kind, item_id, version);

alter table public.cms_members enable row level security;
alter table public.cms_content enable row level security;
alter table public.cms_drafts enable row level security;
alter table public.cms_revisions enable row level security;

-- the caller's CMS role (null for everyone else). SECURITY DEFINER so policies can read cms_members without recursion.
create or replace function public.cms_role() returns text
language sql stable security definer set search_path = '' as $$
  select m.role from public.cms_members m where m.user_id = (select auth.uid());
$$;
create or replace function public.cms_rank(r text) returns integer
language sql immutable set search_path = '' as $$
  select case r when 'owner' then 4 when 'admin' then 3 when 'editor' then 2 when 'reviewer' then 1 else 0 end;
$$;

drop policy if exists cms_members_read on public.cms_members;
create policy cms_members_read on public.cms_members for select to authenticated
  using (user_id = (select auth.uid()) or public.cms_rank(public.cms_role()) >= 3);

drop policy if exists cms_content_read on public.cms_content;
create policy cms_content_read on public.cms_content for select to anon, authenticated
  using (status in ('published', 'archived'));

drop policy if exists cms_drafts_read on public.cms_drafts;
create policy cms_drafts_read on public.cms_drafts for select to authenticated using (public.cms_rank(public.cms_role()) >= 1);
drop policy if exists cms_drafts_insert on public.cms_drafts;
create policy cms_drafts_insert on public.cms_drafts for insert to authenticated
  with check (public.cms_rank(public.cms_role()) >= 2 and updated_by = (select auth.uid()));
drop policy if exists cms_drafts_update on public.cms_drafts;
create policy cms_drafts_update on public.cms_drafts for update to authenticated
  using (public.cms_rank(public.cms_role()) >= 2) with check (public.cms_rank(public.cms_role()) >= 2 and updated_by = (select auth.uid()));
drop policy if exists cms_drafts_delete on public.cms_drafts;
create policy cms_drafts_delete on public.cms_drafts for delete to authenticated using (public.cms_rank(public.cms_role()) >= 2);

drop policy if exists cms_revisions_read on public.cms_revisions;
create policy cms_revisions_read on public.cms_revisions for select to authenticated using (public.cms_rank(public.cms_role()) >= 1);

revoke all on public.cms_members, public.cms_content, public.cms_drafts, public.cms_revisions from anon, authenticated;
grant select on public.cms_content to anon, authenticated;
grant select on public.cms_members, public.cms_revisions to authenticated;
grant select, insert, update, delete on public.cms_drafts to authenticated;

-- Full app control: server-side shape checks for texts, layout, design tokens and app settings. The app validates every item
-- again before applying it; this guard makes sure nothing that could carry markup or CSS ever reaches the published table.
create or replace function public.cms_valid(p_kind text, p_item text, p_data jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare k text; v text;
begin
  if p_kind = 'text' then
    return p_item ~ '^t_[a-z0-9]+_[0-9]+$' and jsonb_typeof(p_data->'orig') = 'string'
      and coalesce(p_data->>'he', '') !~ '[<>]' and coalesce(p_data->>'en', '') !~ '[<>]'
      and length(coalesce(p_data->>'he', '')) <= 600 and length(coalesce(p_data->>'en', '')) <= 600;
  elsif p_kind = 'layout' then
    return p_item in ('home', 'nutrition', 'nav') and jsonb_typeof(p_data->'order') = 'array'
      and not exists (select 1 from jsonb_path_query(p_data, 'strict $.**') j(x) where jsonb_typeof(j.x) = 'string' and j.x #>> '{}' !~ '^[a-z]{1,20}$');
  elsif p_kind = 'theme' then
    if not (p_item = 'active' or p_item ~ '^preset_[a-z0-9_]{1,40}$') or jsonb_typeof(p_data->'tokens') <> 'object' then return false; end if;
    for k, v in select key, value from jsonb_each_text(p_data->'tokens') loop
      if k !~ '^--[a-z0-9-]{1,30}$' or v !~ '^(#[0-9a-fA-F]{6}|[0-9]{1,2}px|[5-8]00|heebo|rubik|system|none|soft|strong)$' then return false; end if;
    end loop;
    return coalesce(p_data->>'name', '') !~ '[<>]';
  elsif p_kind = 'config' then
    return p_item = 'app' and p_data::text !~ '[<>]';
  end if;
  return true;
end $$;

-- publish the draft of (kind, item_id). admin/owner only. Optimistic check: the draft must be based on the current version.
create or replace function public.cms_publish(p_kind text, p_item text, p_note text default null) returns json
language plpgsql security definer set search_path = '' as $$
declare d public.cms_drafts; c public.cms_content; v integer;
begin
  if public.cms_rank(public.cms_role()) < 3 then raise exception using errcode = '42501', message = 'cms: publishing needs the admin role'; end if;
  select * into d from public.cms_drafts where kind = p_kind and item_id = p_item;
  if not found then raise exception using errcode = 'P0001', message = 'cms: no draft to publish'; end if;
  if not public.cms_valid(p_kind, p_item, d.data) then raise exception using errcode = 'P0001', message = 'cms: content refused by the server check (markup, CSS or unknown fields)'; end if;
  select * into c from public.cms_content where kind = p_kind and item_id = p_item for update;
  v := coalesce(c.version, 0);
  if d.base_version <> v then raise exception using errcode = 'P0001', message = 'cms: the draft is based on an older version — reload and review'; end if;
  insert into public.cms_content (kind, item_id, status, data, version, updated_by, updated_at)
    values (p_kind, p_item, 'published', d.data, v + 1, auth.uid(), now())
    on conflict (kind, item_id) do update set status = 'published', data = excluded.data, version = excluded.version, updated_by = excluded.updated_by, updated_at = now();
  insert into public.cms_revisions (kind, item_id, version, action, data, note, actor) values (p_kind, p_item, v + 1, 'publish', d.data, coalesce(p_note, d.note), auth.uid());
  delete from public.cms_drafts where kind = p_kind and item_id = p_item;
  return json_build_object('kind', p_kind, 'item_id', p_item, 'version', v + 1);
end $$;

-- archive (users stop receiving the item; history is kept) / restore (published again, same data). admin/owner only.
create or replace function public.cms_set_status(p_kind text, p_item text, p_status text, p_note text default null) returns json
language plpgsql security definer set search_path = '' as $$
declare c public.cms_content;
begin
  if public.cms_rank(public.cms_role()) < 3 then raise exception using errcode = '42501', message = 'cms: archiving needs the admin role'; end if;
  if p_status not in ('published', 'archived') then raise exception using errcode = 'P0001', message = 'cms: bad status'; end if;
  select * into c from public.cms_content where kind = p_kind and item_id = p_item for update;
  if not found then raise exception using errcode = 'P0001', message = 'cms: item is not published'; end if;
  if c.status = p_status then return json_build_object('kind', p_kind, 'item_id', p_item, 'version', c.version); end if;
  update public.cms_content set status = p_status, version = c.version + 1, updated_by = auth.uid(), updated_at = now() where kind = p_kind and item_id = p_item;
  insert into public.cms_revisions (kind, item_id, version, action, data, note, actor)
    values (p_kind, p_item, c.version + 1, case p_status when 'archived' then 'archive' else 'restore' end, c.data, p_note, auth.uid());
  return json_build_object('kind', p_kind, 'item_id', p_item, 'version', c.version + 1, 'status', p_status);
end $$;

-- roll back to an earlier revision: its data is published again as a NEW version (nothing is deleted). admin/owner only.
create or replace function public.cms_rollback(p_kind text, p_item text, p_version integer, p_note text default null) returns json
language plpgsql security definer set search_path = '' as $$
declare r public.cms_revisions; c public.cms_content;
begin
  if public.cms_rank(public.cms_role()) < 3 then raise exception using errcode = '42501', message = 'cms: rollback needs the admin role'; end if;
  select * into r from public.cms_revisions where kind = p_kind and item_id = p_item and version = p_version order by id desc limit 1;
  if not found then raise exception using errcode = 'P0001', message = 'cms: no such version'; end if;
  select * into c from public.cms_content where kind = p_kind and item_id = p_item for update;
  update public.cms_content set status = 'published', data = r.data, version = c.version + 1, updated_by = auth.uid(), updated_at = now() where kind = p_kind and item_id = p_item;
  insert into public.cms_revisions (kind, item_id, version, action, data, note, actor) values (p_kind, p_item, c.version + 1, 'rollback', r.data, coalesce(p_note, 'rollback to v' || p_version), auth.uid());
  delete from public.cms_drafts where kind = p_kind and item_id = p_item;
  return json_build_object('kind', p_kind, 'item_id', p_item, 'version', c.version + 1);
end $$;

-- role management: owner only; never on oneself; 'owner' cannot be granted through the API.
create or replace function public.cms_set_role(p_email text, p_role text) returns json
language plpgsql security definer set search_path = '' as $$
declare uid uuid;
begin
  if public.cms_role() is distinct from 'owner' then raise exception using errcode = '42501', message = 'cms: only the owner manages roles'; end if;
  if p_role is not null and p_role not in ('admin', 'editor', 'reviewer') then raise exception using errcode = 'P0001', message = 'cms: role must be admin, editor or reviewer'; end if;
  select id into uid from auth.users where lower(email) = lower(p_email);
  if uid is null then raise exception using errcode = 'P0001', message = 'cms: no account with this e-mail (the person must sign up first)'; end if;
  if uid = auth.uid() then raise exception using errcode = '42501', message = 'cms: you cannot change your own role'; end if;
  if exists (select 1 from public.cms_members where user_id = uid and role = 'owner') then raise exception using errcode = '42501', message = 'cms: an owner cannot be changed here'; end if;
  if p_role is null then delete from public.cms_members where user_id = uid;
  else insert into public.cms_members (user_id, role, granted_by) values (uid, p_role, auth.uid())
       on conflict (user_id) do update set role = excluded.role, granted_by = excluded.granted_by, granted_at = now(); end if;
  insert into public.cms_revisions (kind, item_id, version, action, data, note, actor)
    values ('role', uid::text, 0, case when p_role is null then 'revoke' else 'grant' end, json_build_object('email', lower(p_email), 'role', p_role)::jsonb, null, auth.uid());
  return json_build_object('user_id', uid, 'role', p_role);
end $$;

-- members list with e-mail (admin/owner only), for the roles screen
create or replace function public.cms_members_list() returns json
language plpgsql stable security definer set search_path = '' as $$
begin
  if public.cms_rank(public.cms_role()) < 3 then raise exception using errcode = '42501', message = 'cms: admin role needed'; end if;
  return coalesce((select json_agg(json_build_object('email', u.email, 'role', m.role, 'granted_at', m.granted_at) order by m.granted_at)
    from public.cms_members m join auth.users u on u.id = m.user_id), '[]'::json);
end $$;

-- audit log: who changed what and when (every publish / archive / restore / rollback / role change). Members only.
create or replace function public.cms_audit_list(p_limit integer default 100) returns json
language plpgsql stable security definer set search_path = '' as $$
begin
  if public.cms_rank(public.cms_role()) < 1 then raise exception using errcode = '42501', message = 'cms: member role needed'; end if;
  return coalesce((select json_agg(x order by x.at desc) from (select r.kind, r.item_id, r.version, r.action, r.note, r.at, u.email as actor_email
    from public.cms_revisions r left join auth.users u on u.id = r.actor order by r.at desc limit least(greatest(coalesce(p_limit, 100), 1), 500)) x), '[]'::json);
end $$;

revoke all on function public.cms_publish(text, text, text), public.cms_set_status(text, text, text, text), public.cms_rollback(text, text, integer, text),
  public.cms_set_role(text, text), public.cms_members_list(), public.cms_role(), public.cms_audit_list(integer), public.cms_valid(text, text, jsonb) from public, anon;
grant execute on function public.cms_publish(text, text, text), public.cms_set_status(text, text, text, text), public.cms_rollback(text, text, integer, text),
  public.cms_set_role(text, text), public.cms_members_list(), public.cms_role(), public.cms_audit_list(integer) to authenticated;

-- ════════ 20261025000200_sofitgo_admin_feedback.sql ════════
-- SoFitGo admin · feedback and issue review (25.10.2026). Depends on 20261020000100 (bug_reports) and 20261025000100 (CMS roles).
-- NOT applied to the live project — the owner applies it after review, together with or after the CMS migration.
-- Rollback: supabase/rollback/20261025000200_rollback.sql
--
-- What it adds:
--   • bug_reports.admin_note / handled_at / handled_by — the team's handling of a report (the reporter already sees `status`).
--   • public.cms_feedback_list(...)  admin / owner only: reports of all testers, newest first, filter + paging. The reporter is
--     shown as a short pseudonymous id (first 8 hex of the user id) — never an e-mail address.
--   • public.cms_feedback_set_status(...) admin / owner only: status + note; every change is written to cms_revisions
--     (kind 'feedback', action 'status') and so appears in the CMS audit log.
-- Security: SECURITY DEFINER with a pinned search_path; the role is checked on the server (cms_rank(cms_role()) >= 3). bug_reports
-- RLS is unchanged: testers still read only their own rows and cannot update them; no table grant is added.

alter table public.bug_reports add column if not exists admin_note text check (admin_note is null or char_length(admin_note) <= 1000);
alter table public.bug_reports add column if not exists handled_at timestamptz;
alter table public.bug_reports add column if not exists handled_by uuid references auth.users (id) on delete set null;
create index if not exists bug_reports_status_created_idx on public.bug_reports (status, created_at desc);

alter table public.cms_revisions drop constraint if exists cms_revisions_action_check;
alter table public.cms_revisions add constraint cms_revisions_action_check
  check (action in ('publish', 'archive', 'restore', 'rollback', 'grant', 'revoke', 'status'));

create or replace function public.cms_feedback_list(p_status text default null, p_category text default null, p_limit integer default 50, p_offset integer default 0)
returns json language plpgsql stable security definer set search_path = '' as $$
declare lim integer := least(greatest(coalesce(p_limit, 50), 1), 200); off integer := greatest(coalesce(p_offset, 0), 0);
begin
  if public.cms_rank(public.cms_role()) < 3 then raise exception using errcode = '42501', message = 'cms: admin role needed'; end if;
  if p_status is not null and p_status not in ('received', 'reviewing', 'in_progress', 'resolved') then raise exception using errcode = '22023', message = 'cms: unknown status'; end if;
  if p_category is not null and p_category not in ('bug', 'idea', 'usability', 'other') then raise exception using errcode = '22023', message = 'cms: unknown category'; end if;
  return json_build_object(
    'total', (select count(*) from public.bug_reports b where (p_status is null or b.status = p_status) and (p_category is null or b.category = p_category)),
    'counts', (select coalesce(json_object_agg(s.status, s.n), '{}'::json) from (select b.status, count(*) as n from public.bug_reports b group by b.status) s),
    'items', coalesce((select json_agg(x order by x.created_at desc) from (
      select b.id, b.category, b.title, b.description, b.steps, b.expected, b.actual, b.severity, b.screen, b.app_build, b.platform, b.status,
             b.created_at, b.admin_note, b.handled_at, substr(replace(b.user_id::text, '-', ''), 1, 8) as reporter
      from public.bug_reports b
      where (p_status is null or b.status = p_status) and (p_category is null or b.category = p_category)
      order by b.created_at desc limit lim offset off) x), '[]'::json));
end $$;

create or replace function public.cms_feedback_set_status(p_id uuid, p_status text, p_note text default null)
returns json language plpgsql security definer set search_path = '' as $$
declare prev text;
begin
  if public.cms_rank(public.cms_role()) < 3 then raise exception using errcode = '42501', message = 'cms: admin role needed'; end if;
  if p_status not in ('received', 'reviewing', 'in_progress', 'resolved') then raise exception using errcode = '22023', message = 'cms: unknown status'; end if;
  if p_note is not null and char_length(p_note) > 1000 then raise exception using errcode = '22023', message = 'cms: note too long'; end if;
  select b.status into prev from public.bug_reports b where b.id = p_id for update;
  if prev is null then raise exception using errcode = 'P0002', message = 'cms: report not found'; end if;
  update public.bug_reports set status = p_status, admin_note = nullif(btrim(coalesce(p_note, '')), ''), handled_at = now(), handled_by = (select auth.uid()) where id = p_id;
  insert into public.cms_revisions (kind, item_id, version, action, data, note, actor)
    values ('feedback', p_id::text, 0, 'status', json_build_object('from', prev, 'to', p_status)::jsonb, nullif(btrim(coalesce(p_note, '')), ''), (select auth.uid()));
  return json_build_object('id', p_id, 'status', p_status, 'previous', prev);
end $$;

revoke all on function public.cms_feedback_list(text, text, integer, integer), public.cms_feedback_set_status(uuid, text, text) from public, anon;
grant execute on function public.cms_feedback_list(text, text, integer, integer), public.cms_feedback_set_status(uuid, text, text) to authenticated;

-- ════════ 20261025000300_sofitgo_admin_accounts.sql ════════
-- SoFitGo admin · accounts overview (25.10.2026). Depends on 20261020000100 (user_state, bug_reports) and 20261025000100 (CMS roles).
-- NOT applied to the live project — the owner applies it after review, after the CMS migration.
-- Rollback: supabase/rollback/20261025000300_rollback.sql
--
-- What it adds:
--   • public.cms_accounts_overview()  admin / owner only. AGGREGATE COUNTS ONLY — never a row, an e-mail, a name or a user id:
--     accounts registered / confirmed / new in 7 and 30 days, accounts that keep a synced copy and that synced in the last 7 days,
--     feedback totals, staff per role. "Synced in the last 7 days" is reported as exactly that — it is NOT "active users"
--     (the app works offline and without an account, so usage is not visible to the server).
-- Security: SECURITY DEFINER with a pinned search_path (it must count auth.users, which users cannot read); the role is checked on
-- the server (cms_rank(cms_role()) >= 3). No table grant is added; no existing policy changes.

create or replace function public.cms_accounts_overview()
returns json language plpgsql stable security definer set search_path = '' as $$
begin
  if public.cms_rank(public.cms_role()) < 3 then raise exception using errcode = '42501', message = 'cms: admin role needed'; end if;
  return json_build_object(
    'generated_at', now(),
    'accounts_total', (select count(*) from auth.users),
    'accounts_confirmed', (select count(*) from auth.users u where u.email_confirmed_at is not null),
    'accounts_new_7d', (select count(*) from auth.users u where u.created_at > now() - interval '7 days'),
    'accounts_new_30d', (select count(*) from auth.users u where u.created_at > now() - interval '30 days'),
    'accounts_with_synced_data', (select count(distinct s.user_id) from public.user_state s),
    'accounts_synced_7d', (select count(distinct s.user_id) from public.user_state s where s.updated_at > now() - interval '7 days'),
    'reports_total', (select count(*) from public.bug_reports),
    'reports_open', (select count(*) from public.bug_reports b where b.status <> 'resolved'),
    'staff', (select coalesce(json_object_agg(m.role, m.n), '{}'::json) from (select c.role, count(*) as n from public.cms_members c group by c.role) m));
end $$;

revoke all on function public.cms_accounts_overview() from public, anon;
grant execute on function public.cms_accounts_overview() to authenticated;

commit;
