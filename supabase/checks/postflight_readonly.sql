-- SoFitGo — POST-FLIGHT (read-only). Run AFTER the migration. Changes nothing.
-- Expected: 4 rows with rls_enabled = true; 11 policies (4 profiles, 4 user_state, 2 bug_reports, 1 app_config);
-- anon has only SELECT on app_config; app_config has beta_open = true.
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('profiles', 'user_state', 'bug_reports', 'app_config')
order by 1;

select tablename, policyname, cmd, roles
from pg_policies where schemaname = 'public'
  and tablename in ('profiles', 'user_state', 'bug_reports', 'app_config')
order by tablename, policyname;

select grantee, table_name, string_agg(privilege_type, ',' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon', 'authenticated')
  and table_name in ('profiles', 'user_state', 'bug_reports', 'app_config')
group by grantee, table_name order by grantee, table_name;

select key, value from public.app_config order by key;
