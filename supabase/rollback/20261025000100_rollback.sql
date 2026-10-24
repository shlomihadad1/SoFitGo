-- Rollback of 20261025000100_sofitgo_cms.sql — removes the CMS objects only. Published CMS content is lost (the app falls back to
-- its built-in content, which is always shipped). Accounts, profiles, user_state, bug_reports and app_config are untouched.
drop function if exists public.cms_publish(text, text, text);
drop function if exists public.cms_set_status(text, text, text, text);
drop function if exists public.cms_rollback(text, text, integer, text);
drop function if exists public.cms_set_role(text, text);
drop function if exists public.cms_members_list();
drop table if exists public.cms_revisions;
drop table if exists public.cms_drafts;
drop table if exists public.cms_content;
drop table if exists public.cms_members;
drop function if exists public.cms_role();
drop function if exists public.cms_rank(text);
