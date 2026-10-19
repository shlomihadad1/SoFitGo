-- SoFitGo — PRE-FLIGHT (read-only). Run in the SQL Editor BEFORE the migration. Changes nothing.
-- Expected on a fresh project: the first query returns 0 rows (no name clash), auth.users exists,
-- and the server version is 15 or newer.
select table_name as existing_table_with_same_name
from information_schema.tables
where table_schema = 'public' and table_name in ('profiles', 'user_state', 'bug_reports', 'app_config');

select routine_name as existing_function_with_same_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('delete_my_account', 'tg_touch_updated_at', 'tg_user_state_rev', 'tg_bug_report_insert');

select to_regclass('auth.users') is not null as auth_users_exists,
       current_setting('server_version') as postgres_version;
