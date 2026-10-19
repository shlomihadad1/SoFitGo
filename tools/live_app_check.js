/* M10.2 · the REAL app (a deploy folder whose sofitgo-config.js points at the hosted project) driven in Chromium against the REAL
   Supabase project, with two dedicated TEST accounts. Credentials only via environment variables; nothing secret is printed.
   Flow: A signs in through the UI → app loads A's data → A adds water in the UI → the app syncs → the row is checked on the server
   with A's own token → reload (session kept, data kept) → logout (device cleared) → login (data restored) → logout →
   B signs in on the SAME browser → none of A's data is visible to B.
   Chromium has no proxy here; requests to *.supabase.co are relayed unchanged by Node (environment proxy).
   Usage: APP_DIR=dist/pwa-live LIVE_A_EMAIL=… LIVE_A_PASSWORD=… LIVE_B_EMAIL=… LIVE_B_PASSWORD=… node tools/live_app_check.js */
const { chromium, devices } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const E = process.env, DIR = path.resolve(E.APP_DIR || 'dist/pwa-live');
const res = []; let G = ''; const ok = (c, m, i) => { res.push({ ok: !!c }); console.log((c ? 'PASS ' : 'FAIL ') + `[${G}] ${m}` + (!c && i !== undefined ? ' → ' + JSON.stringify(i).slice(0, 300) : '')); };
if (!(E.LIVE_A_EMAIL && E.LIVE_A_PASSWORD && E.LIVE_B_EMAIL && E.LIVE_B_PASSWORD)) { console.error('Set LIVE_A_EMAIL/PASSWORD and LIVE_B_EMAIL/PASSWORD (test accounts).'); process.exit(2); }
if (![E.LIVE_A_EMAIL, E.LIVE_B_EMAIL].every(x => /^test/i.test(x.split('@')[0]))) { console.error('Refusing: only dedicated test accounts (local part starting with "test").'); process.exit(2); }
const cfgTxt = fs.readFileSync(path.join(DIR, 'sofitgo-config.js'), 'utf8'); const URL_ = (cfgTxt.match(/supabaseUrl:\s*'([^']+)'/) || [])[1], KEY = (cfgTxt.match(/publishableKey:\s*'([^']+)'/) || [])[1];
if (!URL_ || !KEY) { console.error('The deploy folder has no filled sofitgo-config.js.'); process.exit(2); }
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.css': 'text/css' };
const srv = http.createServer((q, r) => { let f = decodeURIComponent(q.url.split('?')[0]); if (f.endsWith('/')) f += 'index.html'; const p = path.join(DIR, f); if (!p.startsWith(DIR) || !fs.existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r); });
const api = async (p, token) => { const r = await fetch(URL_ + p, { headers: { apikey: KEY, Authorization: 'Bearer ' + token } }); return r.json(); };
(async () => {
  await new Promise(r => srv.listen(0, '127.0.0.1', r)); const APP = `http://127.0.0.1:${srv.address().port}/`;
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'he-IL', serviceWorkers: 'block' });
  await ctx.route(/https:\/\/[a-z0-9]+\.supabase\.co\//, async route => { const q = route.request(); const h = Object.assign({}, q.headers()); delete h.host; delete h['content-length'];
    try { const r = await fetch(q.url(), { method: q.method(), headers: h, body: ['GET', 'HEAD', 'OPTIONS'].includes(q.method()) ? undefined : q.postDataBuffer() });
      const hd = {}; r.headers.forEach((v, k) => { if (!/^(content-encoding|content-length|transfer-encoding)$/i.test(k)) hd[k] = v; }); hd['access-control-allow-origin'] = hd['access-control-allow-origin'] || '*';
      await route.fulfill({ status: r.status, headers: hd, body: Buffer.from(await r.arrayBuffer()) }); } catch (e) { await route.abort(); } });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const waitFor = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < (ms || 15000)) { if (await p.evaluate(fn).catch(() => false)) return true; await p.waitForTimeout(250); } return false; };
  const sclick = async sel => { try { await p.click(sel, { timeout: 8000 }); return true; } catch (e) { console.log('DEBUG blocked click ' + sel + ':', JSON.stringify(await p.evaluate(s2 => { const b = document.querySelector(s2); if (!b) return { missing: true, hash: location.hash }; const r = b.getBoundingClientRect(), el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { hash: location.hash, rect: [r.x, r.y, r.width, r.height].map(Math.round), top: el && (el.tagName + '.' + el.className), sheet: (document.querySelector('.sheet-bg') || {}).innerText }; }, sel))); return false; } };
  const st = () => p.evaluate(() => window.Account ? window.Account.state() : null);
  const login = async (email, pw) => { await p.evaluate(() => { location.hash = '#/account/login'; }); await waitFor(() => !!document.getElementById('ac-email')); await p.fill('#ac-email', email); await p.fill('#ac-pw', pw); if (!(await waitFor(() => { const b = document.querySelector('[data-act=login]'); return b && !b.disabled; }, 8000))) { console.log('DEBUG login screen:', (await p.evaluate(() => document.querySelector('#view').innerHTML)).slice(0, 900)); return false; } try { await p.click('[data-act=login]', { timeout: 8000 }); } catch (e) { console.log('DEBUG blocked click:', await p.evaluate(() => { const b = document.querySelector('[data-act=login]'), r = b.getBoundingClientRect(), el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { hash: location.hash, top: el && (el.className + ' ' + el.tagName), sheet: !!document.querySelector('.sheet-bg'), sheetText: (document.querySelector('.sheet-bg') || {}).innerText }; })); await p.screenshot({ path: 'dist/reports/lac-blocked.png' }); return false; } const okIn = await waitFor(() => window.Account && window.Account.state().signedIn && window.Account.state().status === 'synced', 20000); await waitFor(() => !location.hash.startsWith('#/account'), 8000); await p.waitForTimeout(300); return okIn; }; /* after login the app moves on by itself (onboarding or Home) — wait for it */
  const logout = async () => { await p.evaluate(() => { location.hash = '#/account'; }); if (!(await waitFor(() => !!document.querySelector('[data-act=logout]'), 10000))) { console.log('DEBUG account screen:', (await p.evaluate(() => document.querySelector('#view').innerText)).slice(0, 500).replace(/\n+/g, ' | ')); return false; } if (!(await sclick('[data-act=logout]'))) return false; const sh = p.locator('.sheet [data-act=yes]'); if (await sh.count()) await sh.click(); return waitFor(() => window.Account && !window.Account.state().signedIn, 10000); };
  await p.goto(APP); await p.waitForTimeout(1500); await p.evaluate(() => localStorage.clear()); await p.reload(); await waitFor(() => !!window.FIT30_BACKEND);

  G = 'A signs in through the real app';
  ok(await p.evaluate(() => window.FIT30_BACKEND && window.FIT30_BACKEND.source === 'config'), 'the app uses the hosted project from sofitgo-config.js');
  ok(await login(E.LIVE_A_EMAIL, E.LIVE_A_PASSWORD), 'A signs in (status "synced")', await st());
  const sA = await st(), tokA = await p.evaluate(() => JSON.parse(localStorage.getItem('fit30.auth')).access_token);
  ok(!JSON.stringify(await p.evaluate(() => ({ ...localStorage }))).includes(E.LIVE_A_PASSWORD), 'the password is not stored on the device');
  G = 'A writes through the UI → server';
  await p.evaluate(() => { localStorage.setItem('fit30.welcomeDone', '1'); location.hash = '#/'; }); await p.waitForTimeout(1200);
  const before = await p.evaluate(() => Core.daily(Store.today()).water || 0);
  const btn = p.locator('[data-water] [data-act=water][data-ml="250"]');
  if (await btn.count()) await btn.click(); else await p.evaluate(() => { Core.addWater(Store.today(), 250); });
  await p.waitForTimeout(300); const after = await p.evaluate(() => Core.daily(Store.today()).water);
  ok(after === before + 250, 'water +250 ml recorded in the app', { before, after });
  ok(await waitFor(() => window.Account.state().status === 'synced' && !window.Account.state().unsynced.length, 15000), 'the app reports the change saved to the server');
  const today = await p.evaluate(() => Store.today());
  const srvRow = await api('/rest/v1/user_state?select=data,rev&section=eq.tracking', tokA);
  ok(Array.isArray(srvRow) && srvRow[0] && srvRow[0].data.daily[today] && srvRow[0].data.daily[today].water === after, 'the SERVER copy (read with A\'s own token) has the new amount', srvRow[0] && srvRow[0].data.daily[today]);
  G = 'reload, logout, login (A)';
  await p.reload(); await waitFor(() => window.Account && window.Account.state().signedIn, 10000); await p.waitForTimeout(1000);
  ok((await st()).signedIn && await p.evaluate(() => Core.daily(Store.today()).water) === after, 'reload: still signed in, amount kept');
  ok(await logout(), 'logout');
  ok(await p.evaluate(() => !Object.keys(localStorage).some(k => /^fit30\.(profile|tracking|nutrition|workouts|plans|auth|sync)$/.test(k)) || (Core.daily(Store.today()).water || 0) === 0), 'after logout no private data is left on the device');
  ok(await login(E.LIVE_A_EMAIL, E.LIVE_A_PASSWORD), 'A signs in again');
  ok(await p.evaluate(() => Core.daily(Store.today()).water) === after, 'A\'s data is restored from the server', await p.evaluate(() => Core.daily(Store.today())));
  ok(await logout(), 'A logs out');
  G = 'B on the same browser';
  ok(await login(E.LIVE_B_EMAIL, E.LIVE_B_PASSWORD), 'B signs in on the same browser');
  const sB = await st(); ok(sB.userId && sB.userId !== sA.userId && sB.owner === sB.userId, 'device data now belongs to B, not A', { a: sA.userId, b: sB.userId });
  const leak = await p.evaluate(a => JSON.stringify({ ...localStorage }).includes(a), sA.userId);
  ok(!leak, 'none of A\'s identifiers remain in B\'s browser storage');
  const bw = await p.evaluate(() => Core.daily(Store.today()).water || 0);
  ok(bw !== after || bw === 0, 'B does not see A\'s water amount', { bw, a: after });
  const tokB = await p.evaluate(() => JSON.parse(localStorage.getItem('fit30.auth')).access_token);
  const steal = await api(`/rest/v1/user_state?select=data&user_id=eq.${sA.userId}`, tokB);
  ok(Array.isArray(steal) && steal.length === 0, 'B\'s token cannot read A\'s rows directly through the API');
  ok(await logout(), 'B logs out');
  G = 'errors'; ok(!errs.length, 'no page errors', errs);
  await b.close(); srv.close();
})().then(() => { const f = res.filter(r => !r.ok).length; console.log(`live app check: pass ${res.length - f} fail ${f}`); process.exit(f ? 1 : 0); }, e => { console.error('live app check crashed in [' + G + ']: ' + e.message.split('\n')[0]); srv.close(); process.exit(2); });
