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
