/* M10 · RLS and data-isolation tests for supabase/migrations/*.sql on a REAL PostgreSQL 16 server.
   The Supabase-specific pieces (roles anon/authenticated, auth.users, auth.uid()) come from supabase/test/local_supabase_shim.sql,
   which reproduces Supabase's own definitions. Each statement runs as the API role with JWT claims set exactly the way PostgREST
   does (SET LOCAL ROLE + request.jwt.claims), so the policies are enforced by PostgreSQL itself — not by app code.
   This is NOT a test of the hosted Supabase project; tools/live_check.js does that once the owner has applied the migration.
   Usage: PGHOST=/tmp PGPORT=54329 node tools/rls_test.js */
const { execFileSync } = require('child_process'); const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), DB = 'sofitgo_rls_test';
const PG = { host: process.env.PGHOST || '/tmp', port: process.env.PGPORT || '54329', user: process.env.PGUSER || 'postgres' };
const res = []; let G = ''; const ok = (c, m, i) => res.push({ g: G, ok: !!c, m: m + (i !== undefined && !c ? ' → ' + JSON.stringify(i).slice(0, 300) : '') });
const psql = (db, sql) => { try { return { out: execFileSync('psql', ['-h', PG.host, '-p', PG.port, '-U', PG.user, '-d', db, '-v', 'ON_ERROR_STOP=1', '-Atq', '-X'], { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim(), err: null }; } catch (e) { return { out: null, err: String(e.stderr || e.message).trim() }; } };
const lit = s => "'" + String(s).replace(/'/g, "''") + "'";
/* run one statement as an API role. claims = null → no JWT (anonymous request / expired session) */
const as = (role, sub, stmt) => psql(DB, `begin;\nset local role ${role};\nset local request.jwt.claims to ${lit(sub ? JSON.stringify({ sub, role }) : '')};\n${stmt};\ncommit;`);
const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222';
const asA = s => as('authenticated', A, s), asB = s => as('authenticated', B, s), anon = s => as('anon', null, s), noJwt = s => as('authenticated', null, s);
const denied = r => !!r.err && /row-level security|permission denied|violates|immutable|rate_limited|42501/i.test(r.err);

(() => {
  G = 'setup';
  psql('postgres', `drop database if exists ${DB};`); ok(!psql('postgres', `create database ${DB};`).err, 'fresh test database');
  const shim = psql(DB, fs.readFileSync(path.join(ROOT, 'supabase/test/local_supabase_shim.sql'), 'utf8')); ok(!shim.err, 'Supabase shim (roles, auth schema, auth.uid) applied', shim.err);
  const migs = fs.readdirSync(path.join(ROOT, 'supabase/migrations')).filter(f => f.endsWith('.sql')).sort();
  for (const m of migs) { const r = psql(DB, fs.readFileSync(path.join(ROOT, 'supabase/migrations', m), 'utf8')); ok(!r.err, `migration ${m} applies cleanly`, r.err); }
  for (const m of migs) { const r = psql(DB, fs.readFileSync(path.join(ROOT, 'supabase/migrations', m), 'utf8')); ok(!r.err, `migration ${m} can be re-run without error (no duplicate objects)`, r.err); }
  const rls = psql(DB, `select string_agg(relname || ':' || relrowsecurity, ',' order by relname) from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r';`).out;
  ok(rls === 'app_config:true,bug_reports:true,cms_content:true,cms_drafts:true,cms_members:true,cms_revisions:true,profiles:true,user_state:true', 'RLS is enabled on every public table (incl. the 4 CMS tables, tested in rls_cms_test.js)', rls);
  const pol = psql(DB, `select count(*) from pg_policies where schemaname = 'public';`).out; ok(+pol === 18, '18 explicit policies exist (11 accounts + 7 CMS)', pol);
  const noPolicyTables = psql(DB, `select string_agg(c.relname, ',') from pg_class c where c.relnamespace='public'::regnamespace and c.relkind='r' and c.relrowsecurity and not exists (select 1 from pg_policies p where p.schemaname='public' and p.tablename=c.relname);`).out;
  ok(!noPolicyTables, 'no table has RLS enabled without a policy', noPolicyTables);
  psql(DB, `insert into auth.users (id, email) values ('${A}', 'a@test.invalid'), ('${B}', 'b@test.invalid');`);

  G = 'profiles';
  ok(!asA(`insert into public.profiles (id, first_name) values ('${A}', 'אלה')`).err, 'A creates own profile');
  ok(!asB(`insert into public.profiles (id, first_name) values ('${B}', 'בני')`).err, 'B creates own profile');
  ok(denied(asA(`insert into public.profiles (id, first_name) values ('${B}', 'hijack')`)), 'A cannot create a profile with B\'s id');
  ok(asA(`select string_agg(first_name, ',') from public.profiles`).out === 'אלה', 'A reads only own profile');
  ok(asA(`select count(*) from public.profiles where id = '${B}'`).out === '0', 'A asking for B\'s id gets nothing');
  ok(asA(`with u as (update public.profiles set first_name = 'x' where id = '${B}' returning 1) select count(*) from u`).out === '0', 'A cannot update B\'s profile (0 rows)');
  ok(asA(`with d as (delete from public.profiles where id = '${B}' returning 1) select count(*) from d`).out === '0', 'A cannot delete B\'s profile (0 rows)');
  ok(denied(asA(`update public.profiles set id = '${B}' where id = '${A}'`)), 'A cannot re-key own profile to B');
  ok(denied(asA(`insert into public.profiles (id, first_name) values ('${A}', repeat('x', 31))`)), 'first name longer than 30 is rejected by the database');

  G = 'user_state (app data)';
  ok(!asA(`insert into public.user_state (section, data) values ('profile', '{"name":"אלה","weight":70}')`).err, 'A inserts own section (user_id defaults to auth.uid())');
  ok(!asB(`insert into public.user_state (section, data) values ('profile', '{"name":"בני","weight":90}')`).err, 'B inserts own section');
  ok(denied(asA(`insert into public.user_state (user_id, section, data) values ('${B}', 'nutrition', '{}')`)), 'A cannot insert a row for B (forged user_id)');
  ok(asA(`select string_agg(data->>'name', ',') from public.user_state`).out === 'אלה', 'A sees only own data');
  ok(asB(`select string_agg(data->>'name', ',') from public.user_state`).out === 'בני', 'B sees only own data');
  ok(asA(`select count(*) from public.user_state where user_id = '${B}'`).out === '0', 'filtering by B\'s id returns nothing for A');
  ok(asA(`with u as (update public.user_state set data = '{"pwned":true}' where user_id = '${B}' returning 1) select count(*) from u`).out === '0', 'A cannot update B\'s data');
  ok(asA(`with d as (delete from public.user_state where user_id = '${B}' returning 1) select count(*) from d`).out === '0', 'A cannot delete B\'s data');
  ok(psql(DB, `select data->>'name' from public.user_state where user_id = '${B}'`).out === 'בני', 'B\'s row is unchanged after A\'s attempts (checked as superuser)');
  ok(denied(asA(`update public.user_state set user_id = '${B}' where user_id = '${A}'`)), 'A cannot move own row to B');
  const r1 = asA(`update public.user_state set data = '{"name":"אלה","weight":69}', rev = 99 where section = 'profile' returning rev`).out;
  ok(r1 === '2', 'rev is server-controlled: a client-sent rev is ignored and becomes old+1', r1);
  ok(asA(`with u as (update public.user_state set data = '{}' where section = 'profile' and rev = 1 returning 1) select count(*) from u`).out === '0', 'stale conditional update (rev=1 after rev 2) changes nothing → conflict detectable');
  ok(denied(asA(`insert into public.user_state (section, data) values ('passwords', '{}')`)), 'unknown section is rejected');
  ok(denied(asA(`insert into public.user_state (section, data) values ('tracking', '[1,2]')`)), 'non-object JSON is rejected');
  ok(denied(asA(`insert into public.user_state (section, data) values ('tracking', jsonb_build_object('x', repeat('y', 1100000)))`)), 'documents over 1 MB are rejected');
  ok(denied(asA(`insert into public.user_state (section, data) values ('profile', '{}')`)), 'duplicate section insert fails (primary key) — client must update instead');

  G = 'no session / anonymous';
  ok(denied(anon(`select count(*) from public.user_state`)), 'anon: no access to user_state at all');
  ok(denied(anon(`select count(*) from public.profiles`)), 'anon: no access to profiles');
  ok(denied(anon(`insert into public.bug_reports (client_report_id, category, title, description) values ('anon-0001', 'bug', 'abc', 'x')`)), 'anon: cannot file bug reports');
  ok(anon(`select value::text from public.app_config where key = 'beta_open'`).out === 'true', 'anon: may read the public beta switch');
  ok(noJwt(`select count(*) from public.user_state`).out === '0', 'authenticated role without a JWT subject sees nothing');
  ok(denied(noJwt(`insert into public.user_state (section, data) values ('plans', '{}')`)), 'authenticated role without a subject cannot write');
  ok(denied(asA(`update public.app_config set value = 'false' where key = 'beta_open'`)), 'testers cannot change app_config');

  G = 'bug reports';
  ok(!asA(`insert into public.bug_reports (client_report_id, category, title, description, severity, status) values ('rep-a-0001', 'bug', 'כפתור לא מגיב', 'תיאור', 'high', 'resolved')`).err, 'A files a report');
  ok(asA(`select status from public.bug_reports where client_report_id = 'rep-a-0001'`).out === 'received', 'status forced to "received" (client cannot mark resolved)');
  ok(asB(`select count(*) from public.bug_reports`).out === '0', 'B cannot see A\'s report');
  ok(denied(asA(`update public.bug_reports set status = 'resolved'`)), 'A cannot change a report\'s status');
  ok(denied(asA(`delete from public.bug_reports`)), 'A cannot delete reports');
  ok(denied(asA(`insert into public.bug_reports (client_report_id, category, title, description) values ('rep-a-0001', 'bug', 'שוב', 'כפילות')`)), 'resubmitting the same client_report_id is rejected (no duplicates)');
  ok(denied(asA(`insert into public.bug_reports (client_report_id, category, title, description) values ('rep-a-0002', 'spam', 'abc', 'x')`)), 'invalid category rejected');
  ok(denied(asA(`insert into public.bug_reports (client_report_id, category, title, description) values ('rep-a-0003', 'bug', 'ab', 'x')`)), 'title shorter than 3 rejected');
  ok(denied(asA(`insert into public.bug_reports (user_id, client_report_id, category, title, description) values ('${B}', 'rep-a-0004', 'bug', 'abc', 'x')`)), 'A cannot file a report as B');
  let rl = null; for (let i = 0; i < 25; i++) { const r = asA(`insert into public.bug_reports (client_report_id, category, title, description) values ('rate-${String(i).padStart(4, '0')}', 'idea', 'רעיון', 'x')`); if (r.err) { rl = { i, err: r.err }; break; } }
  ok(rl && /rate_limited/.test(rl.err) && rl.i === 19, 'rate limit: the 21st report within an hour is refused (1 + 19 accepted)', rl);

  G = 'account deletion';
  ok(denied(anon(`select public.delete_my_account()`)), 'anon cannot call delete_my_account');
  ok(denied(asA(`select public.tg_user_state_rev()`)), 'trigger functions are not callable by clients');
  ok(!asA(`select public.delete_my_account()`).err, 'A deletes own account');
  ok(psql(DB, `select (select count(*) from auth.users where id = '${A}') || ',' || (select count(*) from public.profiles where id = '${A}') || ',' || (select count(*) from public.user_state where user_id = '${A}') || ',' || (select count(*) from public.bug_reports where user_id = '${A}')`).out === '0,0,0,0', 'A\'s auth user, profile, data and reports are all gone (cascade)');
  ok(psql(DB, `select (select count(*) from auth.users where id = '${B}') || ',' || (select count(*) from public.profiles where id = '${B}') || ',' || (select count(*) from public.user_state where user_id = '${B}')`).out === '1,1,1', 'B is untouched');
  ok(asA(`select count(*) from public.user_state`).out === '0', 'a deleted account\'s old token sees nothing');

  const pass = res.filter(r => r.ok).length, fail = res.length - pass;
  fs.mkdirSync(path.join(ROOT, 'dist/reports'), { recursive: true }); fs.writeFileSync(path.join(ROOT, 'dist/reports/rls-test.json'), JSON.stringify({ env: 'PostgreSQL ' + psql('postgres', 'show server_version').out + ' (local) + Supabase auth shim', at: new Date().toISOString(), pass, fail, results: res }, null, 1));
  psql('postgres', `drop database if exists ${DB};`);
  res.forEach(r => console.log((r.ok ? 'PASS ' : 'FAIL ') + '[' + r.g + '] ' + r.m)); console.log(`rls tests: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
})();
