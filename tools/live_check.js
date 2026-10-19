/* M10 · LIVE check of the HOSTED Supabase project (or any Supabase-compatible URL), run AFTER the owner applied the migration.
   It talks to the real API exactly like the app does (GoTrue + PostgREST over fetch, publishable key only).

   Part 1 — anonymous (needs only the public URL + publishable key):
     anon cannot read profiles / user_state / bug_reports; anon can read app_config; anon cannot write anything.
   Part 2 — two dedicated TEST accounts (optional, recommended). Create them yourself in the dashboard
     (Authentication → Users → Add user → "Auto Confirm User"), and pass their credentials ONLY as environment
     variables on your own machine — never paste passwords into a chat or a file:
       LIVE_A_EMAIL, LIVE_A_PASSWORD, LIVE_B_EMAIL, LIVE_B_PASSWORD
     It checks sign-in, session refresh, own-data write/read, A↔B isolation (read/update/delete/forged user_id),
     server-controlled rev, bug-report isolation, sign-out (refresh token revoked).
     It writes only to the test accounts: section 'tracking' (deleted again at the end) and ONE bug report titled
     "live_check — please ignore" per run (testers cannot delete reports; delete it in the Table Editor if you like).

   Usage:
     SOFITGO_SUPABASE_URL=https://<ref>.supabase.co SOFITGO_SUPABASE_PUBLISHABLE_KEY=sb_publishable_... \
     LIVE_A_EMAIL=... LIVE_A_PASSWORD=... LIVE_B_EMAIL=... LIVE_B_PASSWORD=... node tools/live_check.js
   Prints no token, password or key. Exit code 0 = all checks passed. */
const URL_ = (process.env.SOFITGO_SUPABASE_URL || '').replace(/\/+$/, ''), KEY = process.env.SOFITGO_SUPABASE_PUBLISHABLE_KEY || '';
if (!/^https?:\/\/[^/]+$/.test(URL_) || !KEY) { console.error('Set SOFITGO_SUPABASE_URL and SOFITGO_SUPABASE_PUBLISHABLE_KEY.'); process.exit(2); }
if (/^sb_secret_/.test(KEY) || /service_role/.test(Buffer.from((KEY.split('.')[1] || ''), 'base64').toString())) { console.error('Refusing: that is a SECRET key. Use the publishable key.'); process.exit(2); }
const res = []; let G = ''; const ok = (c, m, i) => { res.push({ g: G, ok: !!c, m }); console.log((c ? 'PASS ' : 'FAIL ') + `[${G}] ${m}` + (!c && i !== undefined ? ' → ' + String(typeof i === 'string' ? i : JSON.stringify(i)).slice(0, 200) : '')); };
async function call(path, { method = 'GET', token, body, headers = {} } = {}) {
  const h = { apikey: KEY, 'Content-Type': 'application/json', ...headers }; if (token) h.Authorization = 'Bearer ' + token;
  let r; try { r = await fetch(URL_ + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000) }); }
  catch (e) { return { status: 0, data: String(e.message) }; }
  const t = await r.text(); let data = t; try { data = t ? JSON.parse(t) : null; } catch (e) { /* text */ }
  return { status: r.status, data };
}
const rows = r => Array.isArray(r.data) ? r.data : null;
const denied = r => r.status === 401 || r.status === 403 || (r.status === 200 && Array.isArray(r.data) && r.data.length === 0) || r.status === 404;

(async () => {
  G = 'anonymous';
  const cfg = await call('/rest/v1/app_config?select=key,value');
  ok(cfg.status === 200 && rows(cfg) && rows(cfg).some(x => x.key === 'beta_open'), 'anon can read app_config (beta switch) — migration is applied', cfg.status + ' ' + JSON.stringify(cfg.data));
  if (rows(cfg)) { const b = rows(cfg).find(x => x.key === 'beta_open'); console.log('       beta_open =', b && JSON.stringify(b.value)); }
  for (const t of ['profiles', 'user_state', 'bug_reports']) {
    const r = await call(`/rest/v1/${t}?select=*&limit=1`); ok(denied(r), `anon cannot read ${t}`, r.status);
  }
  const w = await call('/rest/v1/user_state', { method: 'POST', body: { section: 'profile', data: {} } }); ok(w.status === 401 || w.status === 403, 'anon cannot write user_state', w.status);
  const wc = await call('/rest/v1/app_config?key=eq.beta_open', { method: 'PATCH', body: { value: false }, headers: { Prefer: 'return=representation' } });
  ok(wc.status === 401 || wc.status === 403 || (wc.status === 200 && rows(wc) && !rows(wc).length), 'anon cannot change app_config', wc.status);
  const del = await call('/rest/v1/rpc/delete_my_account', { method: 'POST', body: {} }); ok(del.status >= 400, 'anon cannot call delete_my_account', del.status);

  const E = process.env; if (!(E.LIVE_A_EMAIL && E.LIVE_A_PASSWORD && E.LIVE_B_EMAIL && E.LIVE_B_PASSWORD)) { console.log('Part 2 skipped (LIVE_A_*/LIVE_B_* not set).'); return; }
  G = 'auth';
  const login = async (email, password) => { const r = await call('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } }); return r.status === 200 && r.data && r.data.access_token ? r.data : (ok(false, 'sign-in ' + email.replace(/(.).*@/, '$1…@'), r.status + ' ' + JSON.stringify(r.data && (r.data.error_code || r.data.msg || r.data.error))), null); };
  const A = await login(E.LIVE_A_EMAIL, E.LIVE_A_PASSWORD), B = await login(E.LIVE_B_EMAIL, E.LIVE_B_PASSWORD);
  if (!A || !B) return; ok(true, 'both test accounts can sign in with email + password');
  ok(A.user.id !== B.user.id, 'accounts have different ids');
  const bad = await call('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: E.LIVE_A_EMAIL, password: E.LIVE_A_PASSWORD + 'x' } });
  ok(bad.status === 400 && !bad.data.access_token, 'wrong password is rejected', bad.status);
  const rf = await call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: A.refresh_token } });
  ok(rf.status === 200 && rf.data.access_token, 'session refresh works (persistent session)', rf.status); if (rf.status === 200) Object.assign(A, rf.data);
  const reuse = await call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: A.refresh_token } });
  if (reuse.status === 200) Object.assign(A, reuse.data);
  const me = await call('/auth/v1/user', { token: A.access_token }); ok(me.status === 200 && me.data.id === A.user.id, '/auth/v1/user returns the signed-in account');

  G = 'data isolation';
  const mark = 'live_check_' + Date.now();
  for (const [U, n] of [[A, 'A'], [B, 'B']]) {
    await call(`/rest/v1/user_state?section=eq.tracking`, { method: 'DELETE', token: U.access_token });
    const p = await call('/rest/v1/user_state', { method: 'POST', token: U.access_token, headers: { Prefer: 'return=representation' }, body: { section: 'tracking', data: { mark, who: n } } });
    ok(p.status === 201 && rows(p)[0].rev === 1 && rows(p)[0].user_id === U.user.id, `${n} writes own data; server sets user_id and rev=1`, p.status + ' ' + JSON.stringify(p.data));
  }
  const ra = await call('/rest/v1/user_state?select=user_id,section,data', { token: A.access_token });
  ok(rows(ra) && rows(ra).every(x => x.user_id === A.user.id) && rows(ra).some(x => x.data.who === 'A'), 'A reads only own rows', ra.data);
  const rb = await call(`/rest/v1/user_state?select=*&user_id=eq.${B.user.id}`, { token: A.access_token });
  ok(rows(rb) && rows(rb).length === 0, 'A asking for B\'s rows by id gets nothing');
  const ub = await call(`/rest/v1/user_state?user_id=eq.${B.user.id}&section=eq.tracking`, { method: 'PATCH', token: A.access_token, headers: { Prefer: 'return=representation' }, body: { data: { pwned: true } } });
  ok(rows(ub) && rows(ub).length === 0, 'A cannot update B\'s data (0 rows)', ub.status);
  const dbB = await call(`/rest/v1/user_state?user_id=eq.${B.user.id}`, { method: 'DELETE', token: A.access_token, headers: { Prefer: 'return=representation' } });
  ok(!rows(dbB) || rows(dbB).length === 0, 'A cannot delete B\'s data (0 rows)', dbB.status);
  const forged = await call('/rest/v1/user_state', { method: 'POST', token: A.access_token, body: { user_id: B.user.id, section: 'plans', data: {} } });
  ok(forged.status === 401 || forged.status === 403, 'A cannot insert a row for B (forged user_id → RLS)', forged.status);
  const bStill = await call('/rest/v1/user_state?select=data&section=eq.tracking', { token: B.access_token });
  ok(rows(bStill) && rows(bStill)[0] && rows(bStill)[0].data.who === 'B' && !rows(bStill)[0].data.pwned, 'B\'s data is unchanged after A\'s attempts');
  const up = await call(`/rest/v1/user_state?section=eq.tracking&rev=eq.1`, { method: 'PATCH', token: A.access_token, headers: { Prefer: 'return=representation' }, body: { data: { mark, who: 'A', v: 2 }, rev: 99 } });
  ok(rows(up) && rows(up)[0] && rows(up)[0].rev === 2, 'rev is server-controlled (client rev 99 ignored → 2)', up.data);
  const stale = await call(`/rest/v1/user_state?section=eq.tracking&rev=eq.1`, { method: 'PATCH', token: A.access_token, headers: { Prefer: 'return=representation' }, body: { data: { stale: true } } });
  ok(rows(stale) && rows(stale).length === 0, 'stale write (old rev) changes nothing → conflict is detectable');

  G = 'bug reports';
  const rep = await call('/rest/v1/bug_reports', { method: 'POST', token: A.access_token, headers: { Prefer: 'return=representation' }, body: { client_report_id: 'live-' + Date.now(), category: 'other', title: 'live_check — please ignore', description: 'automated live check', severity: 'low', status: 'resolved' } });
  ok(rep.status === 201 && rows(rep)[0].status === 'received', 'A files a report; status forced to "received"', rep.status + ' ' + JSON.stringify(rep.data));
  const repB = await call('/rest/v1/bug_reports?select=id,user_id', { token: B.access_token });
  ok(rows(repB) && rows(repB).every(x => x.user_id === B.user.id), 'B cannot see A\'s reports');
  const repDel = await call('/rest/v1/bug_reports?select=id', { method: 'DELETE', token: A.access_token, headers: { Prefer: 'return=representation' } });
  ok(repDel.status >= 400 || (rows(repDel) && rows(repDel).length === 0), 'testers cannot delete reports', repDel.status);

  G = 'cleanup & sign-out';
  for (const U of [A, B]) await call(`/rest/v1/user_state?section=eq.tracking`, { method: 'DELETE', token: U.access_token });
  const left = await call('/rest/v1/user_state?select=section&section=eq.tracking', { token: A.access_token }); ok(rows(left) && rows(left).length === 0, 'test rows removed');
  const out = await call('/auth/v1/logout', { method: 'POST', token: A.access_token }); ok(out.status === 204 || out.status === 200, 'sign-out accepted', out.status);
  const after = await call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: A.refresh_token } });
  ok(after.status >= 400, 'after sign-out the refresh token no longer works', after.status);
  await call('/auth/v1/logout', { method: 'POST', token: B.access_token });
})().then(() => { const f = res.filter(r => !r.ok).length; console.log(`live check (${URL_.replace(/^https?:\/\//, '')}): pass ${res.length - f} fail ${f}`); process.exit(f ? 1 : 0); },
  e => { console.error('live check crashed in [' + G + ']: ' + e.message); process.exit(2); });
