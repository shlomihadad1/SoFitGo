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
