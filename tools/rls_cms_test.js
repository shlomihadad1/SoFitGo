/* Admin CMS · server-side authorization tests on a REAL PostgreSQL 16 (same harness as rls_test.js): every statement runs as the
   API role (anon / authenticated + JWT claims), so row-level security and the role-checked functions decide — not app code.
   Roles: owner, admin, editor, reviewer, plain user. Proves: public sees only published/archived content; drafts, revisions and
   the member list are private; editors draft but cannot publish; reviewers read only; nobody can grant themselves a role or
   create an owner through the API; publish / archive / restore / rollback keep a complete history; stale drafts are refused.
   Usage: PGHOST=/tmp PGPORT=54329 node tools/rls_cms_test.js */
const { execFileSync } = require('child_process'); const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), DB = 'sofitgo_cms_test';
const PG = { host: process.env.PGHOST || '/tmp', port: process.env.PGPORT || '54329', user: process.env.PGUSER || 'postgres' };
const res = []; let G = ''; const ok = (c, m, i) => res.push({ g: G, ok: !!c, m: m + (i !== undefined && !c ? ' → ' + JSON.stringify(i).slice(0, 300) : '') });
const psql = (db, sql) => { try { return { out: execFileSync('psql', ['-h', PG.host, '-p', PG.port, '-U', PG.user, '-d', db, '-v', 'ON_ERROR_STOP=1', '-Atq', '-X'], { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim() }; } catch (e) { return { err: String(e.stderr || e.message) }; } };
const lit = s => "'" + String(s).replace(/'/g, "''") + "'";
const as = (role, sub, stmt) => psql(DB, `begin;\nset local role ${role};\nset local request.jwt.claims to ${lit(sub ? JSON.stringify({ sub, role }) : '')};\n${stmt};\ncommit;`);
const U = { owner: '10000000-0000-4000-8000-000000000001', admin: '10000000-0000-4000-8000-000000000002', editor: '10000000-0000-4000-8000-000000000003', reviewer: '10000000-0000-4000-8000-000000000004', user: '10000000-0000-4000-8000-000000000005' };
const by = (who, s) => as('authenticated', U[who], s), anon = s => as('anon', null, s);
const denied = r => !!r.err && /row-level security|permission denied|42501|needs the|role needed|role must be|only the owner|cannot change|cannot be changed/i.test(r.err);
const R1 = JSON.stringify({ he: 'סלט עדשים', en: 'Lentil Salad', meal: 'm2', cuisine: 'israeli', ing: [{ f: 'lentils', g: 60 }], steps: ['א', 'ב'], prep: 5, cook: 20 });
const R2 = JSON.stringify({ he: 'סלט עדשים ולימון', en: 'Lentil Lemon Salad', meal: 'm2', cuisine: 'israeli', ing: [{ f: 'lentils', g: 70 }], steps: ['א', 'ב'], prep: 5, cook: 20 });
const draft = (who, id, data, base) => by(who, `insert into public.cms_drafts (kind, item_id, data, base_version, updated_by) values ('recipe', ${lit(id)}, ${lit(data)}::jsonb, ${base || 0}, ${lit(U[who])}) on conflict (kind, item_id) do update set data = excluded.data, base_version = excluded.base_version, updated_by = excluded.updated_by`);

(() => {
  G = 'setup';
  psql('postgres', `drop database if exists ${DB};`); ok(!psql('postgres', `create database ${DB};`).err, 'fresh test database');
  ok(!psql(DB, fs.readFileSync(path.join(ROOT, 'supabase/test/local_supabase_shim.sql'), 'utf8')).err, 'Supabase shim applied');
  const migs = fs.readdirSync(path.join(ROOT, 'supabase/migrations')).filter(f => f.endsWith('.sql')).sort();
  for (const m of migs) { const r = psql(DB, fs.readFileSync(path.join(ROOT, 'supabase/migrations', m), 'utf8')); ok(!r.err, `migration ${m} applies`, r.err); }
  for (const m of migs) { const r = psql(DB, fs.readFileSync(path.join(ROOT, 'supabase/migrations', m), 'utf8')); ok(!r.err, `migration ${m} re-runs cleanly`, r.err); }
  psql(DB, `insert into auth.users (id, email) values ${Object.entries(U).map(([k, id]) => `('${id}', '${k}@test.invalid')`).join(', ')};`);
  const rls = psql(DB, `select string_agg(relname || ':' || relrowsecurity, ',' order by relname) from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' and relname like 'cms_%';`).out;
  ok(rls === 'cms_content:true,cms_drafts:true,cms_members:true,cms_revisions:true', 'RLS enabled on every CMS table', rls);

  G = 'bootstrap: no API path to become owner or admin';
  ok(denied(by('user', `insert into public.cms_members (user_id, role) values ('${U.user}', 'owner')`)), 'a user cannot insert themselves as owner');
  ok(denied(by('user', `select public.cms_set_role('user@test.invalid', 'admin')`)), 'a non-owner cannot grant roles');
  ok(denied(anon(`select public.cms_set_role('user@test.invalid', 'admin')`)), 'anonymous cannot call role management');
  psql(DB, `insert into public.cms_members (user_id, role) values ('${U.owner}', 'owner');`); /* the one documented manual step (dashboard SQL) */
  ok(by('owner', `select public.cms_role()`).out === 'owner', 'the owner row was created by the documented manual step only');
  ok(denied(by('owner', `select public.cms_set_role('owner@test.invalid', 'admin')`)), 'the owner cannot change their own role');
  ok(denied(by('owner', `select public.cms_set_role('user@test.invalid', 'owner')`)), '"owner" cannot be granted through the API');
  for (const r of ['admin', 'editor', 'reviewer']) ok(!by('owner', `select public.cms_set_role('${r}@test.invalid', '${r}')`).err, `owner grants ${r}`);
  ok(denied(by('admin', `select public.cms_set_role('user@test.invalid', 'editor')`)), 'an admin cannot grant roles');
  ok(denied(by('editor', `update public.cms_members set role = 'admin' where user_id = '${U.editor}'`)) || by('editor', `select role from public.cms_members where user_id = '${U.editor}'`).out === 'editor', 'an editor cannot promote themselves');
  ok(by('editor', `select role from public.cms_members where user_id = '${U.editor}'`).out === 'editor', 'editor role unchanged');
  ok(by('user', `select count(*) from public.cms_members`).out === '0', 'a plain user sees no member rows');
  ok(by('admin', `select count(*) from public.cms_members`).out === '4', 'an admin sees the member list');
  ok(!by('admin', `select public.cms_members_list()`).err && denied(by('editor', `select public.cms_members_list()`)), 'member list with e-mails: admin yes, editor no');

  G = 'drafts';
  ok(!draft('editor', 'lentil_salad', R1).err, 'editor saves a draft');
  ok(denied(draft('reviewer', 'x_rev', R1)), 'reviewer cannot write drafts');
  ok(denied(draft('user', 'x_user', R1)), 'plain user cannot write drafts');
  ok(denied(as('authenticated', U.editor, `insert into public.cms_drafts (kind, item_id, data, updated_by) values ('recipe', 'spoof', '{}'::jsonb, '${U.admin}')`)), 'a draft cannot be saved under someone else\'s name');
  ok(by('reviewer', `select count(*) from public.cms_drafts`).out === '1', 'reviewer can read drafts');
  ok(by('user', `select count(*) from public.cms_drafts`).out === '0' && anon(`select count(*) from public.cms_drafts`).err, 'plain user and anonymous cannot read drafts');

  G = 'publish';
  ok(denied(by('editor', `select public.cms_publish('recipe', 'lentil_salad')`)), 'editor cannot publish');
  ok(denied(by('user', `select public.cms_publish('recipe', 'lentil_salad')`)), 'plain user cannot publish');
  ok(denied(anon(`select public.cms_publish('recipe', 'lentil_salad')`)), 'anonymous cannot publish');
  ok(anon(`select count(*) from public.cms_content`).out === '0', 'nothing public before publishing');
  const p1 = by('admin', `select public.cms_publish('recipe', 'lentil_salad', 'first')`); ok(!p1.err && /"version" : 1/.test(p1.out), 'admin publishes v1', p1);
  ok(anon(`select data->>'he' from public.cms_content where item_id = 'lentil_salad'`).out === 'סלט עדשים', 'anonymous reads the published item');
  ok(by('admin', `select count(*) from public.cms_drafts where item_id = 'lentil_salad'`).out === '0', 'the draft is cleared after publishing');
  ok(denied(by('admin', `update public.cms_content set data = '{}'::jsonb`)) || by('admin', `select count(*) from public.cms_content where data = '{}'::jsonb`).out === '0', 'no direct writes to published content, even for an admin');
  ok(denied(anon(`delete from public.cms_content`)) || anon(`select count(*) from public.cms_content`).out === '1', 'anonymous cannot delete content');
  ok(denied(by('user', `insert into public.cms_content (kind, item_id, status, data, version) values ('recipe', 'evil', 'published', '{}'::jsonb, 1)`)), 'plain user cannot inject content');
  ok(by('user', `select count(*) from public.cms_revisions`).out === '0' && by('reviewer', `select count(*) from public.cms_revisions where kind <> 'role'`).out === '1' /* role changes are audited in the same log since the app-control release */, 'history: hidden from users, visible to reviewers');
  /* stale draft: based on v0 while v1 exists */
  draft('editor', 'lentil_salad', R2, 0);
  const stale = by('admin', `select public.cms_publish('recipe', 'lentil_salad')`); ok(!!stale.err && /older version/.test(stale.err), 'a draft based on an older version is refused (no silent overwrite)', stale);
  draft('editor', 'lentil_salad', R2, 1);
  ok(/"version" : 2/.test(by('admin', `select public.cms_publish('recipe', 'lentil_salad', 'second')`).out || ''), 'publish v2 from a current draft');

  G = 'archive, restore, rollback';
  ok(denied(by('editor', `select public.cms_set_status('recipe', 'lentil_salad', 'archived')`)), 'editor cannot archive');
  ok(!by('admin', `select public.cms_set_status('recipe', 'lentil_salad', 'archived')`).err && anon(`select status from public.cms_content where item_id = 'lentil_salad'`).out === 'archived', 'admin archives; the public sees status archived (app stops offering it)');
  ok(!by('admin', `select public.cms_set_status('recipe', 'lentil_salad', 'published')`).err, 'admin restores');
  ok(denied(by('editor', `select public.cms_rollback('recipe', 'lentil_salad', 1)`)), 'editor cannot roll back');
  const rb = by('admin', `select public.cms_rollback('recipe', 'lentil_salad', 1)`); ok(!rb.err && /"version" : 5/.test(rb.out), 'rollback to v1 is published as a NEW version (5)', rb);
  ok(anon(`select data->>'he' from public.cms_content where item_id = 'lentil_salad'`).out === 'סלט עדשים', 'after rollback the public sees the v1 data again');
  ok(by('admin', `select string_agg(action || ':' || version, ',' order by version) from public.cms_revisions where kind <> 'role'`).out === 'publish:1,publish:2,archive:3,restore:4,rollback:5', 'complete history: nothing deleted, every action recorded', by('admin', `select string_agg(action || ':' || version, ',' order by version) from public.cms_revisions where kind <> 'role'`).out);
  ok(+by('admin', `select count(*) from public.cms_revisions where kind = 'role' and action = 'grant'`).out >= 3, 'audit: every role grant is recorded with its actor');
  ok(denied(by('admin', `delete from public.cms_revisions`)) || by('admin', `select count(*) from public.cms_revisions`).out === '5', 'history cannot be deleted through the API');
  ok(denied(by('owner', `select public.cms_set_role('editor@test.invalid', null)`)) === false && by('editor', `select public.cms_role()`).out === '', 'owner revokes a role; the person immediately loses access');
  ok(denied(draft('editor', 'after_revoke', R1)), 'a revoked editor can no longer write');

  G = 'full app control: texts, layout, design, settings, audit';
  by('owner', `select public.cms_set_role('editor@test.invalid', 'editor')`);
  const dk = (who, kind, id, data) => by(who, `insert into public.cms_drafts (kind, item_id, data, base_version, updated_by) values (${lit(kind)}, ${lit(id)}, ${lit(JSON.stringify(data))}::jsonb, 0, ${lit(U[who])}) on conflict (kind, item_id) do update set data = excluded.data, updated_by = excluded.updated_by`);
  const tid = 't_abc_3';
  ok(denied(dk('user', 'text', tid, { orig: 'בית', he: 'הבית' })), 'a plain user cannot draft a text change');
  ok(!dk('editor', 'text', tid, { orig: 'בית', he: 'הבית' }).err, 'an editor drafts a text change');
  ok(denied(by('editor', `select public.cms_publish('text', ${lit(tid)})`)), 'an editor cannot publish it');
  ok(denied(by('reviewer', `select public.cms_publish('text', ${lit(tid)})`)), 'a reviewer cannot publish it');
  ok(/"version" : 1/.test(by('admin', `select public.cms_publish('text', ${lit(tid)})`).out || ''), 'an admin publishes it');
  ok(anon(`select data->>'he' from public.cms_content where kind = 'text' and item_id = ${lit(tid)}`).out === 'הבית', 'the public (app) reads the published text');
  dk('editor', 'text', 't_xyz_3', { orig: 'בית', he: '<img src=x onerror=alert(1)>' });
  const xs = by('admin', `select public.cms_publish('text', 't_xyz_3')`); ok(!!xs.err && /server check/.test(xs.err), 'server refuses a text with markup even when the app is bypassed', xs.err);
  dk('editor', 'theme', 'active', { name: 'x', tokens: { '--accent': 'red;}body{display:none' } });
  const th = by('admin', `select public.cms_publish('theme', 'active')`); ok(!!th.err && /server check/.test(th.err), 'server refuses CSS injection in a design token');
  dk('editor', 'theme', 'active', { name: 'x', tokens: { 'background-image': 'url(x)' } });
  ok(!!by('admin', `select public.cms_publish('theme', 'active')`).err, 'server refuses a property outside the token pattern');
  dk('editor', 'theme', 'active', { name: 'ירוק', tokens: { '--accent': '#22C55E', '--r': '8px', '--font-body': 'rubik' } });
  ok(!by('admin', `select public.cms_publish('theme', 'active')`).err, 'valid design tokens publish');
  dk('editor', 'layout', 'home', { order: ['nutrition', 'now'], hidden: ['week'] });
  ok(!by('admin', `select public.cms_publish('layout', 'home')`).err, 'layout publishes');
  dk('editor', 'layout', 'evil', { order: [] });
  ok(!!by('admin', `select public.cms_publish('layout', 'evil')`).err, 'layout for an unsupported screen refused by the server');
  dk('editor', 'config', 'app', { off: ['fridge'], defaults: { meals: 2 } });
  ok(!by('admin', `select public.cms_publish('config', 'app')`).err && !by('admin', `select public.cms_set_status('config', 'app', 'archived')`).err, 'settings publish and reset (archive) by an admin');
  ok(denied(dk('user', 'config', 'app', { off: [] })), 'a plain user cannot draft settings');
  ok(!!by('user', `update public.cms_content set status = 'archived' where kind = 'theme'`).err && !!by('admin', `update public.cms_content set data = '{}'::jsonb where kind = 'theme'`).err, 'nobody changes published content directly — only through the checked functions (no table grant, even for admins)');
  const au = by('reviewer', `select public.cms_audit_list(50)`); let aj = []; try { aj = JSON.parse(au.out || '[]'); } catch (e) { }
  ok(aj.some(x => x.kind === 'text' && x.action === 'publish' && x.actor_email === 'admin@test.invalid') && aj.some(x => x.kind === 'role' && x.action === 'grant' && x.actor_email === 'owner@test.invalid'), 'audit log: who published what, and who granted roles (readable by members)', aj.slice(0, 3));
  ok(denied(by('user', `select public.cms_audit_list(10)`)) && denied(anon(`select public.cms_audit_list(10)`)), 'audit log hidden from users and anonymous');

  G = 'feedback review (admin): 20261025000200';
  { const rep = (who, cid, title) => by(who, `insert into public.bug_reports (client_report_id, category, title, description, severity) values ('${cid}', 'bug', ${lit(title)}, 'תיאור', 'high')`);
    ok(!rep('user', 'rep-user-0001', 'הכפתור לא עובד').err && !rep('editor', 'rep-edit-0001', 'טקסט חתוך').err, 'testers file reports (their own rows)');
    ok(by('user', `select count(*) from public.bug_reports`).out === '1', 'a tester still sees only their own report');
    ok(denied(by('user', `update public.bug_reports set status = 'resolved'`)) || by('user', `select status from public.bug_reports`).out === 'received', 'a tester cannot change the status');
    ok(denied(anon(`select public.cms_feedback_list()`)), 'anonymous cannot list reports');
    ok(denied(by('user', `select public.cms_feedback_list()`)), 'a plain user cannot list reports');
    ok(denied(by('editor', `select public.cms_feedback_list()`)) && denied(by('reviewer', `select public.cms_feedback_list()`)), 'editor and reviewer cannot list reports (personal content: admin only)');
    const L = by('admin', `select public.cms_feedback_list()`); const lj = L.out ? JSON.parse(L.out) : {};
    ok(!L.err && lj.total === 2 && lj.items.length === 2 && lj.counts.received === 2, 'admin lists all reports with totals per status', L);
    ok(lj.items && lj.items.every(x => /^[0-9a-f]{8}$/.test(x.reporter) && !('email' in x) && !('user_id' in x)) && !/@test\.invalid/.test(L.out), 'reporter shown as a short pseudonymous id — no e-mail, no full user id');
    const id = lj.items && lj.items.find(x => x.title === 'הכפתור לא עובד').id;
    ok(denied(by('editor', `select public.cms_feedback_set_status('${id}', 'resolved', null)`)) && denied(by('user', `select public.cms_feedback_set_status('${id}', 'resolved', null)`)), 'editor and user cannot change a status');
    ok(by('admin', `select public.cms_feedback_set_status('${id}', 'bogus', null)`).err && by('admin', `select public.cms_feedback_set_status('${id}', 'resolved', '${'x'.repeat(1001)}')`).err, 'unknown status and a too-long note are refused');
    ok(!by('admin', `select public.cms_feedback_set_status('${id}', 'in_progress', 'שוחזר, בטיפול')`).err, 'admin sets a status with a note');
    ok(by('user', `select status from public.bug_reports`).out === 'in_progress', 'the reporter sees the new status of their report');
    ok(by('owner', `select (public.cms_feedback_list('in_progress'))->>'total'`).out === '1' && by('owner', `select json_array_length((public.cms_feedback_list(null, null, 1, 1))->'items')`).out === '1', 'owner: filter by status and paging work');
    ok(/feedback:status/.test(by('admin', `select string_agg(kind || ':' || action, ',') from public.cms_revisions where kind = 'feedback'`).out || ''), 'the change is in the audit history (kind feedback, action status)');
    ok(by('admin', `select public.cms_feedback_set_status('00000000-0000-4000-8000-00000000abcd', 'resolved', null)`).err, 'an unknown report id is refused');
    const rb = psql(DB, fs.readFileSync(path.join(ROOT, 'supabase/rollback/20261025000200_rollback.sql'), 'utf8'));
    ok(!rb.err && psql(DB, `select count(*) from public.bug_reports`).out === '2' && psql(DB, `select count(*) from pg_proc where proname like 'cms_feedback%'`).out === '0', 'rollback removes the feedback functions and keeps every report', rb.err);
    const re = psql(DB, fs.readFileSync(path.join(ROOT, 'supabase/migrations/20261025000200_sofitgo_admin_feedback.sql'), 'utf8')); ok(!re.err, 're-applying the migration after rollback works', re.err); }

  G = 'accounts overview (admin): 20261025000300';
  { ok(denied(anon(`select public.cms_accounts_overview()`)) && denied(by('user', `select public.cms_accounts_overview()`)), 'anonymous and a plain user cannot read the accounts overview');
    ok(denied(by('editor', `select public.cms_accounts_overview()`)) && denied(by('reviewer', `select public.cms_accounts_overview()`)), 'editor and reviewer cannot read it (admin / owner only)');
    const O = by('admin', `select public.cms_accounts_overview()`); const oj = O.out ? JSON.parse(O.out) : {};
    const nU = +psql(DB, `select count(*) from auth.users`).out, nS = +psql(DB, `select count(distinct user_id) from public.user_state`).out, nB = +psql(DB, `select count(*) from public.bug_reports`).out;
    ok(!O.err && oj.accounts_total === nU && oj.accounts_with_synced_data === nS && oj.reports_total === nB && oj.staff && oj.staff.owner === 1, 'admin gets counts that match the tables', { oj, nU, nS, nB });
    ok(!/@test\.invalid/.test(O.out || '') && !/[0-9a-f]{8}-[0-9a-f]{4}-/.test(O.out || ''), 'aggregate only: no e-mail and no user id in the result');
    const rb = psql(DB, fs.readFileSync(path.join(ROOT, 'supabase/rollback/20261025000300_rollback.sql'), 'utf8'));
    ok(!rb.err && psql(DB, `select count(*) from pg_proc where proname = 'cms_accounts_overview'`).out === '0' && +psql(DB, `select count(*) from auth.users`).out === nU, 'rollback removes the function and touches no data', rb.err);
    const re = psql(DB, fs.readFileSync(path.join(ROOT, 'supabase/migrations/20261025000300_sofitgo_admin_accounts.sql'), 'utf8')); ok(!re.err, 're-applying the migration after rollback works', re.err); }

  G = 'no secrets needed';
  const defs = psql(DB, `select string_agg(prosrc, ' ') from pg_proc where proname like 'cms_%'`).out || '';
  ok(!/service_role|secret/i.test(defs), 'CMS functions rely on the caller\'s token, not a service key');
  ok(psql(DB, `select bool_and(prosecdef) from pg_proc where proname in ('cms_publish','cms_set_status','cms_rollback','cms_set_role','cms_members_list','cms_role','cms_feedback_list','cms_feedback_set_status','cms_accounts_overview')`).out === 't', 'privileged functions are SECURITY DEFINER with role checks inside');
  ok(psql(DB, `select bool_and(array_to_string(proconfig, ',') like '%search_path=%') from pg_proc where proname like 'cms_%' and prosecdef`).out === 't', 'every SECURITY DEFINER function pins search_path');

  if (!process.env.KEEP) psql('postgres', `drop database if exists ${DB};`);
  let pass = 0, fail = 0; const groups = {}; for (const r of res) { console.log(`${r.ok ? 'PASS' : 'FAIL'} [${r.g}] ${r.m}`); r.ok ? pass++ : fail++; }
  console.log(`\ncms rls tests: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
})();
