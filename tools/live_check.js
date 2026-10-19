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
  /* safety: only dedicated test accounts — never a real user's account */
  if (![E.LIVE_A_EMAIL, E.LIVE_B_EMAIL].every(x => /(^|[.+_-])test(er)?[s0-9._+-]|^tester|^test/i.test(x.split('@')[0]))) { ok(false, 'refusing: LIVE_A/B_EMAIL must be dedicated test accounts (local part starting with "test"/"tester")'); return; }
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

  G = 'profile persistence (server is the store)';
  const pmark = 'live_' + Date.now();
  const profA = { name: 'בודק א', age: 33, height: 170, weight: 70, targetWeight: 66, availability: { days: [0, 2, 4], sessions: 3, prefMin: null, maxMin: 45 }, onboarded: true, live_mark: pmark };
  const exP = await call('/rest/v1/user_state?select=rev&section=eq.profile', { token: A.access_token });
  const wp = rows(exP) && rows(exP).length
    ? await call(`/rest/v1/user_state?section=eq.profile&rev=eq.${rows(exP)[0].rev}`, { method: 'PATCH', token: A.access_token, headers: { Prefer: 'return=representation' }, body: { data: profA } })
    : await call('/rest/v1/user_state', { method: 'POST', token: A.access_token, headers: { Prefer: 'return=representation' }, body: { section: 'profile', data: profA } });
  ok((wp.status === 200 || wp.status === 201) && rows(wp) && rows(wp)[0] && rows(wp)[0].user_id === A.user.id, 'A saves a profile (age, weights, training days, onboarding) to the server', wp.status);
  const pn = await call('/rest/v1/profiles', { method: 'POST', token: A.access_token, headers: { Prefer: 'resolution=merge-duplicates,return=representation' }, body: { id: A.user.id, first_name: 'בודק' } });
  ok(pn.status === 201 || pn.status === 200, 'A saves the display name (profiles table)', pn.status);
  const A2 = await login(E.LIVE_A_EMAIL, E.LIVE_A_PASSWORD); /* a brand-new session = what a reload / another browser gets */
  const rp = A2 && await call('/rest/v1/user_state?select=data&section=eq.profile', { token: A2.access_token });
  ok(rp && rows(rp) && rows(rp)[0] && rows(rp)[0].data.live_mark === pmark && rows(rp)[0].data.age === 33 && JSON.stringify(rows(rp)[0].data.availability.days) === '[0,2,4]', 'new session (reload / new browser): A\'s profile comes back from the server intact');
  G = 'isolation: B attacks A\'s profile through the API';
  const bpr = await call(`/rest/v1/user_state?select=data&user_id=eq.${A.user.id}&section=eq.profile`, { token: B.access_token });
  ok(rows(bpr) && rows(bpr).length === 0, 'B cannot read A\'s profile');
  const bpn = await call(`/rest/v1/profiles?select=first_name&id=eq.${A.user.id}`, { token: B.access_token });
  ok(rows(bpn) && rows(bpn).length === 0, 'B cannot read A\'s display name');
  const bup = await call(`/rest/v1/user_state?user_id=eq.${A.user.id}&section=eq.profile`, { method: 'PATCH', token: B.access_token, headers: { Prefer: 'return=representation' }, body: { data: { hacked: true } } });
  ok(rows(bup) && rows(bup).length === 0, 'B cannot change A\'s profile (0 rows)', bup.status);
  const bun = await call(`/rest/v1/profiles?id=eq.${A.user.id}`, { method: 'PATCH', token: B.access_token, headers: { Prefer: 'return=representation' }, body: { first_name: 'hacked' } });
  ok(rows(bun) && rows(bun).length === 0, 'B cannot change A\'s display name (0 rows)', bun.status);
  const bdl = await call(`/rest/v1/user_state?user_id=eq.${A.user.id}&section=eq.profile`, { method: 'DELETE', token: B.access_token, headers: { Prefer: 'return=representation' } });
  ok(!rows(bdl) || rows(bdl).length === 0, 'B cannot delete A\'s profile (0 rows)', bdl.status);
  const bimp = await call('/rest/v1/profiles', { method: 'POST', token: B.access_token, body: { id: A.user.id, first_name: 'impostor' } });
  ok(bimp.status === 401 || bimp.status === 403 || bimp.status === 409, 'B cannot create/overwrite a profile row with A\'s id (impersonation)', bimp.status);
  const bmove = await call(`/rest/v1/user_state?section=eq.tracking`, { method: 'PATCH', token: B.access_token, headers: { Prefer: 'return=representation' }, body: { user_id: A.user.id } });
  ok(bmove.status >= 400 || (rows(bmove) && rows(bmove).length === 0), 'B cannot move its own row onto A (changing user_id is refused)', bmove.status);
  const still = await call('/rest/v1/user_state?select=data&section=eq.profile', { token: A2.access_token }); const nm = await call('/rest/v1/profiles?select=first_name', { token: A2.access_token });
  ok(rows(still)[0].data.live_mark === pmark && !rows(still)[0].data.hacked && rows(nm)[0].first_name === 'בודק', 'after all of B\'s attempts, A\'s profile and name are unchanged');

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
  G = 'logout → login restores A';
  if (A2) await call('/auth/v1/logout', { method: 'POST', token: A2.access_token });
  const A3 = await login(E.LIVE_A_EMAIL, E.LIVE_A_PASSWORD); const back = A3 && await call('/rest/v1/user_state?select=data&section=eq.profile', { token: A3.access_token });
  ok(back && rows(back)[0] && rows(back)[0].data.live_mark === pmark, 'after logging out of every session, A logs in again and gets the same profile back');
  if (A3) await call('/auth/v1/logout', { method: 'POST', token: A3.access_token });
  /* the test profile is left in the TEST account on purpose (only rows of this run are ever deleted; nothing else is touched) */
})().then(() => { const f = res.filter(r => !r.ok).length; console.log(`live check (${URL_.replace(/^https?:\/\//, '')}): pass ${res.length - f} fail ${f}`); process.exit(f ? 1 : 0); },
  e => { console.error('live check crashed in [' + G + ']: ' + e.message); process.exit(2); });
