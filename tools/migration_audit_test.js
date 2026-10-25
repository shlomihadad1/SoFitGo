/* Migration audit for the live activation (admin CMS): replays the exact production order on a REAL PostgreSQL 16 that mirrors the
   live schema (Supabase shim + 20261020000100 only, as the hosted project has today), with existing user data in it. Proves:
   1. the three admin migrations apply on top of the live schema without touching existing rows;
   2. each one re-runs cleanly (idempotent) — a repeated paste in the SQL editor does no harm;
   3. a partial run (only 0100) followed by the rest works;
   4. rollback in reverse order (0300 → 0200 → 0100) returns the schema to EXACTLY the pre-migration state (pg_dump --schema-only
      compared byte for byte, after removing dump noise) and keeps every existing row (checksums of the tables' contents);
   5. what a rollback does lose is exactly what is documented: CMS content / roles / audit (0100) and the team's handling notes on
      reports (0200) — measured, not assumed;
   6. rolling back in the WRONG order is refused or harmless (0100 before 0200).
   Usage: PGHOST=/tmp PGPORT=54329 node tools/migration_audit_test.js */
const { execFileSync } = require('child_process'); const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), DB = 'sofitgo_migration_audit';
const PG = { host: process.env.PGHOST || '/tmp', port: process.env.PGPORT || '54329', user: process.env.PGUSER || 'postgres' };
const res = []; let G = ''; const ok = (c, m, i) => res.push({ g: G, ok: !!c, m: m + (i !== undefined && !c ? ' → ' + String(typeof i === 'string' ? i : JSON.stringify(i)).slice(0, 600) : '') });
const psql = (db, sql) => { try { return { out: execFileSync('psql', ['-h', PG.host, '-p', PG.port, '-U', PG.user, '-d', db, '-v', 'ON_ERROR_STOP=1', '-Atq', '-X'], { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim() }; } catch (e) { return { err: String(e.stderr || e.message).trim() }; } };
const file = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const M = { core: 'supabase/migrations/20261020000100_sofitgo_beta_core.sql', cms: 'supabase/migrations/20261025000100_sofitgo_cms.sql', fb: 'supabase/migrations/20261025000200_sofitgo_admin_feedback.sql', acc: 'supabase/migrations/20261025000300_sofitgo_admin_accounts.sql' };
const RB = { cms: 'supabase/rollback/20261025000100_rollback.sql', fb: 'supabase/rollback/20261025000200_rollback.sql', acc: 'supabase/rollback/20261025000300_rollback.sql' };
const run = k => psql(DB, file(M[k])), back = k => psql(DB, file(RB[k]));
/* schema dump without noise (comments, SET lines, blank lines); sorted is NOT used: order differences would hide real changes */
const schema = () => execFileSync('pg_dump', ['-h', PG.host, '-p', PG.port, '-U', PG.user, '-d', DB, '--schema-only', '--no-owner', '--no-privileges', '--schema=public'], { encoding: 'utf8' })
  .split('\n').filter(l => l && !l.startsWith('--') && !/^SET |^SELECT pg_catalog|^\\(un)?restrict /.test(l)).join('\n');
const grants = () => psql(DB, `select string_agg(format('%s:%s:%s', table_name, grantee, privilege_type), ',' order by table_name, grantee, privilege_type) from information_schema.role_table_grants where table_schema = 'public'`).out;
const policies = () => psql(DB, `select string_agg(format('%s.%s:%s:%s', tablename, policyname, cmd, coalesce(qual, '') || '|' || coalesce(with_check, '')), E'\\n' order by tablename, policyname) from pg_policies where schemaname = 'public'`).out;
const data = () => psql(DB, `select md5(coalesce((select string_agg(t::text, '|' order by t::text) from public.profiles t), '')) || md5(coalesce((select string_agg(t::text, '|' order by t::text) from public.user_state t), '')) || md5(coalesce((select string_agg(t::text, '|' order by t::text) from (select id, user_id, client_report_id, category, title, description, severity, status, created_at from public.bug_reports) t), '')) || md5(coalesce((select string_agg(t::text, '|' order by t::text) from public.app_config t), '')) || md5(coalesce((select string_agg(t::text, '|' order by t::text) from auth.users t), ''))`).out;
const A = '20000000-0000-4000-8000-00000000000a', B = '20000000-0000-4000-8000-00000000000b';
(() => {
  G = 'live-like baseline (shim + 20261020000100, existing users and data)';
  psql('postgres', `drop database if exists ${DB};`); ok(!psql('postgres', `create database ${DB};`).err, 'fresh database');
  ok(!psql(DB, file('supabase/test/local_supabase_shim.sql')).err && !run('core').err, 'live schema recreated (Supabase shim + 20261020000100)');
  const seed = psql(DB, `insert into auth.users (id, email, email_confirmed_at) values ('${A}', 'a@audit.invalid', now()), ('${B}', 'b@audit.invalid', null);
    insert into public.profiles (id, first_name) values ('${A}', 'אבי');
    insert into public.user_state (user_id, section, data) values ('${A}', 'profile', '{"age":34}'), ('${A}', 'workouts', '{"days":{"1":{"status":"done"}}}'), ('${B}', 'nutrition', '{"log":{}}');
    insert into public.bug_reports (user_id, client_report_id, category, title, description, severity) values ('${A}', 'audit-rep-0001', 'bug', 'שמירה לא עובדת', 'תיאור', 'high'), ('${B}', 'audit-rep-0002', 'idea', 'מצב לילה', 'תיאור', 'low');`);
  ok(!seed.err, 'existing data inserted (2 users, profile, 3 state sections, 2 reports)', seed.err);
  const S0 = schema(), G0 = grants(), P0 = policies(), D0 = data();
  ok(S0.length > 1000 && D0.length === 160, 'baseline captured: schema, grants, policies, data checksums');

  G = 'apply in production order, then re-run (idempotency)';
  for (const k of ['cms', 'fb', 'acc']) { const r = run(k); ok(!r.err, `${path.basename(M[k])} applies on the live-like schema`, r.err); }
  ok(data() === D0, 'existing users, profiles, state and reports unchanged after the three migrations');
  const S1 = schema();
  for (const k of ['cms', 'fb', 'acc']) { const r = run(k); ok(!r.err, `${path.basename(M[k])} re-runs cleanly (pasted twice)`, r.err); }
  ok(schema() === S1 && data() === D0, 're-running changes neither the schema nor the data');
  ok(psql(DB, `select count(*) from public.cms_members`).out === '0', 'no owner or admin is created by the migrations (the first owner is one manual SQL statement)');
  ok(psql(DB, `select count(*) from public.bug_reports where admin_note is not null or handled_at is not null`).out === '0', 'existing reports get empty handling columns (nothing invented)');
  ok(psql(DB, `select bool_and(relrowsecurity) from pg_class where relname in ('cms_content','cms_drafts','cms_revisions','cms_members') and relnamespace = 'public'::regnamespace`).out === 't', 'row-level security is ON for every new table');
  ok(!/cms_/.test(psql(DB, `select string_agg(table_name || ':' || privilege_type, ',') from information_schema.role_table_grants where table_schema = 'public' and grantee in ('anon','authenticated') and privilege_type in ('INSERT','UPDATE','DELETE') and table_name in ('cms_content','cms_revisions','cms_members')`).out || ''), 'no write grant to anon / authenticated on published content, history or roles (writes only through checked functions)');
  ok(psql(DB, `select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname like 'cms_%' and prosecdef and not (array_to_string(proconfig, ',') like '%search_path=%')`).out === '0', 'every SECURITY DEFINER function pins search_path');
  ok(psql(DB, `select count(*) from information_schema.routine_privileges where routine_schema = 'public' and routine_name like 'cms_%' and grantee = 'anon' and routine_name in ('cms_publish','cms_set_status','cms_rollback','cms_set_role','cms_feedback_list','cms_feedback_set_status','cms_accounts_overview')`).out === '0', 'anon cannot execute any privileged admin function');

  G = 'partial activation (only 0100), then the rest';
  { for (const k of ['acc', 'fb', 'cms']) back(k);
    ok(schema() === S0, 'clean state again'); ok(!run('cms').err && data() === D0, 'only the CMS migration: works alone, data unchanged');
    ok(!run('fb').err && !run('acc').err, 'the other two applied later'); ok(schema() === S1, 'same end state as applying all three at once'); }

  G = 'what a rollback loses (measured)';
  { const own = psql(DB, `insert into public.cms_members (user_id, role) values ('${A}', 'owner');
      insert into public.cms_content (kind, item_id, version, status, data) values ('text', 'home_title', 1, 'published', '{"he":"שלום"}'::jsonb);
      update public.bug_reports set status = 'in_progress', admin_note = 'בטיפול', handled_at = now() where client_report_id = 'audit-rep-0001';`);
    ok(!own.err, 'simulated use: an owner, one published text, one handled report', own.err);
    const rbA = back('acc'); ok(!rbA.err && psql(DB, `select count(*) from public.cms_members`).out === '1', 'rollback 0300: removes only the overview function; roles and content stay', rbA.err);
    const rbF = back('fb'); ok(!rbF.err && psql(DB, `select status from public.bug_reports where client_report_id = 'audit-rep-0001'`).out === 'in_progress' && psql(DB, `select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'bug_reports' and column_name in ('admin_note','handled_at','handled_by')`).out === '0', 'rollback 0200: the report and its status stay; the team note and handling time are removed (documented loss)', rbF.err);
    const wrong = back('acc'); ok(!wrong.err, 'running a rollback twice is harmless', wrong.err);
    const rbC = back('cms'); ok(!rbC.err && psql(DB, `select to_regclass('public.cms_content') is null and to_regclass('public.cms_members') is null`).out === 't', 'rollback 0100: CMS content, roles and audit history are removed (documented loss — export first)', rbC.err);
    ok(psql(DB, `select count(*) from public.bug_reports`).out === '2' && psql(DB, `select status from public.bug_reports where client_report_id = 'audit-rep-0001'`).out === 'in_progress', 'reports and their status survive the full rollback'); }

  G = 'full rollback restores the exact pre-migration schema';
  { const S2 = schema(), G2 = grants(), P2 = policies();
    const diff = (a, b) => { const x = a.split('\n'), y = b.split('\n'); return x.filter(l => !y.includes(l)).concat(y.filter(l => !x.includes(l)).map(l => '+ ' + l)).slice(0, 12).join('\n'); };
    ok(S2 === S0, 'pg_dump --schema-only identical to the baseline', diff(S0, S2));
    ok(G2 === G0, 'table grants identical to the baseline', diff(G0 || '', G2 || ''));
    ok(P2 === P0, 'RLS policies identical to the baseline', diff(P0 || '', P2 || ''));
    const D2 = psql(DB, `select md5(coalesce((select string_agg(t::text, '|' order by t::text) from public.profiles t), '')) || md5(coalesce((select string_agg(t::text, '|' order by t::text) from public.user_state t), ''))`).out;
    ok(D2 === D0.slice(0, 64), 'profiles and synced user data byte-identical after the full cycle');
    ok(psql(DB, `select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname like 'cms_%'`).out === '0', 'no admin function left behind'); }

  G = 'wrong rollback order';
  { for (const k of ['cms', 'fb', 'acc']) run(k);
    const r = back('cms'); /* 0100 rollback while 0200 / 0300 are still applied */
    ok(!!r.err && /rollback order/.test(r.err) && schema() === S1, 'rolling back 0100 first is REFUSED with a clear message and changes nothing', r.err || 'no error');
    for (const k of ['acc', 'fb', 'cms']) back(k); ok(schema() === S0, 'after the correct order the schema is back to the baseline'); }

  G = 'one-paste files: supabase/activation (activate_admin / make_owner / undo_admin)';
  { const act = file('supabase/activation/activate_admin.sql'), undo = file('supabase/activation/undo_admin.sql');
    ok(['20261025000100_sofitgo_cms.sql', '20261025000200_sofitgo_admin_feedback.sql', '20261025000300_sofitgo_admin_accounts.sql'].every(f => act.includes(file('supabase/migrations/' + f))), 'activate_admin.sql contains the three migrations unchanged');
    ok(['20261025000300', '20261025000200', '20261025000100'].every(f => undo.includes(file(`supabase/rollback/${f}_rollback.sql`))) && undo.indexOf(file('supabase/rollback/20261025000300_rollback.sql')) < undo.indexOf(file('supabase/rollback/20261025000100_rollback.sql')), 'undo_admin.sql contains the three rollbacks unchanged, in reverse order');
    const S1x = (() => { for (const k of ['cms', 'fb', 'acc']) run(k); const s = schema(); for (const k of ['acc', 'fb', 'cms']) back(k); return s; })();
    ok(schema() === S0, 'clean baseline before the one-paste test');
    const broken = act.replace(/\ncommit;\s*$/, '\nselect 1/0;\ncommit;'); ok(!!psql(DB, broken).err && schema() === S0 && data().slice(0, 64) === D0.slice(0, 64), 'a failure anywhere in the activation changes nothing (all-or-nothing)');
    ok(!psql(DB, act).err && schema() === S1x && data().slice(0, 64) === D0.slice(0, 64), 'activate_admin.sql = the same result as the three migrations one by one; user data unchanged');
    ok(!psql(DB, act).err && schema() === S1x, 'pasting it twice changes nothing');
    const own = file('supabase/activation/make_owner.sql').replace(/YOUR-EMAIL/g, 'a@audit.invalid');
    ok(/a@audit\.invalid\|owner\|/.test(psql(DB, own).out || '') && !psql(DB, own).err && psql(DB, `select count(*) from public.cms_members`).out === '1', 'make_owner.sql: exactly one owner, idempotent, and the check line shows it');
    ok(!psql(DB, file('supabase/activation/make_owner.sql').replace(/YOUR-EMAIL/g, 'nobody@audit.invalid')).err && psql(DB, `select count(*) from public.cms_members`).out === '1', 'make_owner.sql with an unknown e-mail adds nothing');
    ok(!psql(DB, undo).err && schema() === S0 && data().slice(0, 64) === D0.slice(0, 64), 'undo_admin.sql returns the exact baseline schema; profiles and synced data intact'); }

  psql('postgres', `drop database if exists ${DB};`);
  let pass = 0, fail = 0; res.forEach(x => { console.log((x.ok ? 'PASS ' : 'FAIL ') + '[' + x.g + '] ' + x.m); x.ok ? pass++ : fail++; });
  console.log(`migration audit: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
})();
