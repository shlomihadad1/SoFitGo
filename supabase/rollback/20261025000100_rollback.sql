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
