-- SoFitGo · UNDO ADMIN ACTIVATION. All-or-nothing. Removes the admin tables and functions: content published through the admin,
-- roles, the admin audit log and the team's notes on reports are LOST. Reports, accounts and user data stay.
begin;

-- ════════ 20261025000300_rollback.sql ════════
-- Rollback of 20261025000300_sofitgo_admin_accounts.sql. Removes the read-only accounts overview function. No data is touched.
drop function if exists public.cms_accounts_overview();

-- ════════ 20261025000200_rollback.sql ════════
-- Rollback of 20261025000200_sofitgo_admin_feedback.sql. Removes the admin feedback functions and the handling columns.
-- Reports themselves, their status and the testers' access are untouched. Audit rows with action 'status' are deleted so the
-- original check constraint can be restored (they only record feedback status changes).
drop function if exists public.cms_feedback_set_status(uuid, text, text);
drop function if exists public.cms_feedback_list(text, text, integer, integer);
drop index if exists public.bug_reports_status_created_idx;
alter table public.bug_reports drop column if exists handled_by;
alter table public.bug_reports drop column if exists handled_at;
alter table public.bug_reports drop column if exists admin_note;
do $$ begin
  if to_regclass('public.cms_revisions') is not null then
    delete from public.cms_revisions where action = 'status';
    alter table public.cms_revisions drop constraint if exists cms_revisions_action_check;
    alter table public.cms_revisions add constraint cms_revisions_action_check check (action in ('publish', 'archive', 'restore', 'rollback', 'grant', 'revoke'));
  end if;
end $$;

-- ════════ 20261025000100_rollback.sql ════════
-- Rollback of 20261025000100_sofitgo_cms.sql — removes the CMS objects only. Published CMS content is lost (the app falls back to
-- its built-in content, which is always shipped). Accounts, profiles, user_state, bug_reports and app_config are untouched.
-- Order guard: the later admin migrations depend on this one. Rolling this back first would leave their functions orphaned (they
-- would fail closed, but the schema would be half removed). Roll back 20261025000300 and 20261025000200 first.
do $$ begin
  if to_regprocedure('public.cms_accounts_overview()') is not null or to_regprocedure('public.cms_feedback_list(text, text, integer, integer)') is not null then
    raise exception using errcode = '55000', message = 'rollback order: run supabase/rollback/20261025000300_rollback.sql and 20261025000200_rollback.sql first — nothing was changed';
  end if;
end $$;
drop function if exists public.cms_publish(text, text, text);
drop function if exists public.cms_set_status(text, text, text, text);
drop function if exists public.cms_rollback(text, text, integer, text);
drop function if exists public.cms_set_role(text, text);
drop function if exists public.cms_members_list();
drop function if exists public.cms_audit_list(integer);
drop function if exists public.cms_valid(text, text, jsonb);
drop table if exists public.cms_revisions;
drop table if exists public.cms_drafts;
drop table if exists public.cms_content;
drop table if exists public.cms_members;
drop function if exists public.cms_role();
drop function if exists public.cms_rank(text);

commit;
