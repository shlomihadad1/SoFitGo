/* M10 · tests the pre-flight / post-flight checks and every rollback level on a REAL local PostgreSQL 16 server
   (Supabase shim, see rls_test.js). Not a test of the hosted project.
   Usage: PGHOST=/tmp PGPORT=54329 node tools/rollback_test.js */
const { execFileSync } = require('child_process'); const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), DB = 'sofitgo_rollback_test';
const PG = { host: process.env.PGHOST || '/tmp', port: process.env.PGPORT || '54329', user: process.env.PGUSER || 'postgres' };
const res = []; const ok = (c, m, i) => res.push({ ok: !!c, m: m + (i !== undefined && !c ? ' → ' + JSON.stringify(i).slice(0, 300) : '') });
const psql = (sql, db = DB) => { try { return { out: execFileSync('psql', ['-h', PG.host, '-p', PG.port, '-U', PG.user, '-d', db, '-v', 'ON_ERROR_STOP=1', '-Atq', '-X'], { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim(), err: null }; } catch (e) { return { out: null, err: String(e.stderr || e.message).trim() }; } };
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const MIG = rd('supabase/migrations/20261020000100_sofitgo_beta_core.sql'), RB = rd('supabase/rollback/20261020000100_rollback.sql');
/* extract one LEVEL block from the rollback file and un-comment it */
const level = n => RB.split(/^-- LEVEL /m).find(b => b.startsWith(n + ' ')).split('\n').filter(l => l.startsWith('-- ')).map(l => l.slice(3)).filter(l => /^\s*[a-z]/.test(l)).join('\n');
const A = '11111111-1111-4111-8111-111111111111';
const asA = s => psql(`begin; set local role authenticated; set local request.jwt.claims to '{"sub":"${A}","role":"authenticated"}'; ${s}; commit;`);
const anon = s => psql(`begin; set local role anon; ${s}; commit;`);

psql(`drop database if exists ${DB};`, 'postgres'); ok(!psql(`create database ${DB};`, 'postgres').err, 'fresh database');
ok(!psql(rd('supabase/test/local_supabase_shim.sql')).err, 'shim applied');

const pre = psql(rd('supabase/checks/preflight_readonly.sql'));
ok(!pre.err && pre.out === 't|' + psql('show server_version').out, 'pre-flight on an empty project: no name clashes, auth.users exists', pre);
ok(!psql(MIG).err, 'migration applied');
const post = psql(rd('supabase/checks/postflight_readonly.sql'));
ok(!post.err, 'post-flight runs read-only', post.err);
const lines = post.out.split('\n');
ok(lines.filter(l => /\|t$/.test(l)).length === 4, 'post-flight: 4 tables with RLS on', lines);
ok(lines.filter(l => /_own\||app_config_read\|/.test(l)).length === 11, 'post-flight: 11 policies listed');
ok(lines.includes('anon|app_config|SELECT') && !lines.some(l => /^anon\|(profiles|user_state|bug_reports)/.test(l)), 'post-flight: anon only reads app_config');
ok(lines.includes('beta_open|true'), 'post-flight: beta_open = true');
const preAgain = psql(rd('supabase/checks/preflight_readonly.sql')).out.split('\n');
ok(preAgain.includes('profiles') && preAgain.includes('delete_my_account'), 'pre-flight detects an existing install (would warn before a second run)');

psql(`insert into auth.users (id, email) values ('${A}', 'a@test.invalid');`);
ok(!asA(`insert into public.user_state (section, data) values ('profile', '{"name":"אלה"}')`).err, 'tester data exists before rollback');

const L1 = level(1); ok(/update public\.app_config/.test(L1), 'level 1 block extracted');
ok(!psql(L1).err && psql(`select value from public.app_config where key='beta_open'`).out === 'false', 'LEVEL 1: beta paused (beta_open=false)');
ok(asA(`select data->>'name' from public.user_state`).out === 'אלה', 'LEVEL 1: data untouched and still readable by its owner');

const L2 = level(2); ok(/revoke all/.test(L2), 'level 2 block extracted');
ok(!psql(L2).err, 'LEVEL 2 runs');
ok(/permission denied/.test(asA(`select * from public.user_state`).err || ''), 'LEVEL 2: authenticated API access removed');
ok(/permission denied/.test(asA(`select public.delete_my_account()`).err || ''), 'LEVEL 2: delete_my_account no longer callable');
ok(psql(`select data->>'name' from public.user_state`).out === 'אלה', 'LEVEL 2: data kept (owner view)');
ok(anon(`select value from public.app_config where key='beta_open'`).out === 'false', 'LEVEL 2: app can still read the pause switch');
ok(!psql(MIG).err && asA(`select data->>'name' from public.user_state`).out === 'אלה', 'undo LEVEL 2: re-running the migration restores access, data intact');
psql(`update public.app_config set value='true'::jsonb where key='beta_open'`);

const L3 = level(3); ok(/drop table if exists public\.user_state/.test(L3), 'level 3 block extracted');
const g = psql(L3); ok(g.err && /not confirmed/.test(g.err), 'LEVEL 3 refuses to run until the guard is edited', g);
ok(psql(`select count(*) from public.user_state`).out === '1', 'LEVEL 3 guard: nothing was dropped');
ok(!psql(L3.replace("select 'NOT-CONFIRMED'", "select 'I-HAVE-EXPORTED'")).err, 'LEVEL 3 with confirmed guard runs');
ok(psql(rd('supabase/checks/preflight_readonly.sql')).out.split('\n').length === 1, 'LEVEL 3: all beta tables and functions removed');
ok(psql(`select count(*) from auth.users`).out === '1', 'LEVEL 3: auth users are NOT deleted (documented)');
ok(!psql(MIG).err, 'after LEVEL 3 the migration can be applied again cleanly');

psql(`drop database if exists ${DB};`, 'postgres');
const fail = res.filter(r => !r.ok);
res.forEach(r => console.log((r.ok ? 'PASS ' : 'FAIL ') + r.m));
console.log(`rollback test: pass ${res.length - fail.length} fail ${fail.length}`); process.exit(fail.length ? 1 : 0);
