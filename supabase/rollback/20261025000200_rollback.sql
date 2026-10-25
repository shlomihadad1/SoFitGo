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
