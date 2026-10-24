/* Admin CMS · full app control end to end (local only): texts, screens & layout, design tokens, app settings, audit log, preview,
   cached / offline behaviour and "no flash of built-in content". App = beta build of THIS source pointed at tools/supa_local.js (real
   PostgreSQL 16 + RLS + the role-checked functions). Browser: Playwright Chromium, iPhone 13 emulation + a 1280 px desktop context —
   NOT Safari (see BROWSER=webkit), NOT a device. Not a test of the hosted project.
   Usage: node tools/e2e_app_control.js   (BROWSER=webkit to run the same flow on Playwright WebKit) */
const pw = require('playwright'); const { devices } = pw; const fs = require('fs'), path = require('path'), { spawn, execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..'), APP = 'http://localhost:8098/', API = 'http://localhost:54323', KEY = 'sb_publishable_LOCALTESTKEY_not_a_secret', PW = 'Admin-pass-2026';
const ENGINE = process.env.BROWSER === 'webkit' ? pw.webkit : pw.chromium;
const res = []; let G = ''; const ok = (c, m, i) => res.push({ g: G, ok: !!c, m: m + (i !== undefined && !c ? ' → ' + JSON.stringify(i).slice(0, 500) : '') });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const call = async (p, o, tok) => { const r = await fetch(API + p, Object.assign({ headers: Object.assign({ apikey: KEY, 'content-type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}) }, o || {})); const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) { } return { status: r.status, j }; };
const su = async q => (await fetch(API + '/__test/sql', { method: 'POST', body: q })).json();
const procs = [];
const SEED = () => { localStorage.clear(); Store.resetAll(); const pr = Store.load('profile'); Object.assign(pr, { age: 34, height: 172, weight: 78, startWeight: 78, sex: 'f', experience: 'beginner', onboarded: true, startDate: Store.today() }); Store.save('profile'); };
(async () => {
  try {
    execFileSync('sh', [path.join(ROOT, 'tools/pg_local.sh')], { stdio: 'ignore' });
    execFileSync('sh', [path.join(ROOT, 'tools/supa_local_db.sh')], { stdio: 'ignore', env: Object.assign({}, process.env, { SUPA_DB: 'sofitgo_app_e2e' }) });
    execFileSync('node', [path.join(ROOT, 'tools/build.js')], { stdio: 'ignore', env: Object.assign({}, process.env, { SOFITGO_SUPABASE_URL: API, SOFITGO_SUPABASE_PUBLISHABLE_KEY: KEY, FIT30_OUT: 'dist/pwa-app-local' }) });
    procs.push(spawn('node', [path.join(ROOT, 'tools/supa_local.js'), '54323'], { env: Object.assign({}, process.env, { SUPA_DB: 'sofitgo_app_e2e' }), stdio: 'ignore' }));
    procs.push(spawn('python3', ['-m', 'http.server', '8098', '-d', path.join(ROOT, 'dist/pwa-app-local')], { stdio: 'ignore' }));
    await sleep(1800);
  } catch (e) { console.error('setup failed: ' + e.message); procs.forEach(p => p.kill()); process.exit(2); }
  const b = await ENGINE.launch();
  const mk = async (dev, opt) => { const ctx = await b.newContext(Object.assign(dev === 'desktop' ? { viewport: { width: 1280, height: 900 } } : { ...devices['iPhone 13'] }, { locale: 'he-IL', serviceWorkers: (opt && opt.sw) ? 'allow' : 'block' })); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); await p.goto(APP); await p.waitForTimeout(700); return { ctx, p, errs }; };
  const go = async (p, h, ms) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(ms || 500); };
  const waitFor = async (p, fn, arg, ms) => { const t0 = Date.now(); while (Date.now() - t0 < (ms || 8000)) { if (await p.evaluate(fn, arg).catch(() => false)) return true; await p.waitForTimeout(150); } return false; };
  const login = async (p, email) => { await go(p, '#/account/login', 700); await waitFor(p, () => !!window.Account && !!window.Screens.account); await p.evaluate(() => App.render()); await p.waitForTimeout(200);
    await p.fill('#ac-email', email); await p.fill('#ac-pw', PW); await p.locator('[data-act=login]').click(); await waitFor(p, () => !!(window.Account && Account.state().signedIn)); await p.waitForTimeout(400); await p.evaluate(() => document.querySelectorAll('.sheet [data-x]').forEach(x => x.click())); };
  const admin = async (p, tab) => { await go(p, '#/admin', 600); await waitFor(p, () => !!window.Screens.admin && !!window.AdminApp); await waitFor(p, () => !document.querySelector('[data-cms-loading]'), null, 10000);
    if (tab) { await p.evaluate(t => { AdminCMS.state.tab = t; AdminCMS.state.edit = null; App.render(); }, tab); await waitFor(p, () => !document.querySelector('[data-cms-loading]'), null, 10000); await p.waitForTimeout(300); } };
  const publish = async p => { await p.locator('[data-act=apPub]').first().click(); await p.waitForTimeout(500); await p.check('#pub-ok'); await p.locator('.sheet [data-act=go]').click(); await p.waitForTimeout(1300); };
  const user = async (dev, opt) => { const u = await mk(dev, opt); await u.p.evaluate(SEED); await u.p.reload(); await u.p.waitForTimeout(900); await waitFor(u.p, () => !!window.CMS); await u.p.evaluate(() => CMS.refresh()); await u.p.waitForTimeout(500); return u; };

  const tok = {};
  for (const who of ['owner', 'admin', 'editor', 'user']) { const r = await call('/auth/v1/signup', { method: 'POST', body: JSON.stringify({ email: who + '@app.test', password: PW }) }); tok[who] = r.j && r.j.access_token; }
  await su(`insert into public.cms_members (user_id, role) select id, 'owner' from auth.users where email = 'owner@app.test';`);
  for (const [who, role] of [['admin', 'admin'], ['editor', 'editor']]) await call('/rest/v1/rpc/cms_set_role', { method: 'POST', body: JSON.stringify({ p_email: who + '@app.test', p_role: role }) }, tok.owner);

  G = 'permissions (server)';
  ok((await call('/rest/v1/cms_drafts', { method: 'POST', body: JSON.stringify({ kind: 'theme', item_id: 'active', data: { name: 'x', tokens: {} }, base_version: 0 }) }, tok.user)).status >= 400, 'a regular user cannot write a design draft through the API');
  ok((await call('/rest/v1/rpc/cms_set_role', { method: 'POST', body: JSON.stringify({ p_email: 'user@app.test', p_role: 'admin' }) }, tok.user)).status === 403, 'a regular user cannot grant themselves admin (403 from the server)');
  ok((await call('/rest/v1/rpc/cms_audit_list', { method: 'POST', body: JSON.stringify({ p_limit: 5 }) }, tok.user)).status === 403, 'a regular user cannot read the audit log');

  G = 'baseline';
  const { p: u0, ctx: uc0 } = await user();
  const base = await u0.evaluate(() => ({ eat: [...document.querySelectorAll('[data-act=eat]')].length, accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() }));
  await go(u0, '#/', 600); const order0 = await u0.evaluate(() => [...document.querySelectorAll('#view > section')].map(s => s.dataset.sec || (s.matches('[data-now]') ? 'now' : s.matches('[data-week-chart]') ? 'week' : '')).filter(Boolean));
  ok(order0.includes('nutrition') && order0.includes('trackers') && order0.includes('now'), 'home shows the registered sections (classic 30-day profile)', order0); await uc0.close();

  /* ── texts ── */
  G = 'texts: search, edit, draft, publish';
  const { p, ctx, errs } = await mk(); await login(p, 'editor@app.test'); await admin(p, 'texts');
  ok(await p.locator('[data-cms-tabs] [data-t=texts]').count() === 1 && await p.locator('[data-cms-tabs] [data-t=design]').count() === 1 && await p.locator('[data-cms-tabs] [data-t=audit]').count() === 1, 'new areas present: texts, layout, design, settings, audit');
  const nCat = +(await p.locator('[data-cms-ttotal]').innerText()).match(/\d+/)[0]; ok(nCat > 1500, 'the catalog lists the app-owned texts', nCat);
  await p.fill('#ap-tq', 'סמן שאכלתי'); await p.waitForTimeout(600);
  ok(await p.locator('[data-cms-tlist] .li').count() >= 1, 'search by text finds "סמן שאכלתי"');
  await p.locator('[data-cms-tlist] .li', { has: p.locator('.t', { hasText: /^סמן שאכלתי$/ }) }).first().click(); await p.waitForTimeout(300);
  ok(await p.locator('[data-cms-teditor]').count() === 1 && /סמן שאכלתי/.test(await p.locator('[data-t-orig]').innerText()) && /תזונה/.test(await p.locator('[data-t-where]').innerText()), 'editor shows the original and where it is used');
  await p.fill('#ap-the', 'סימון <b>'); await p.waitForTimeout(200); ok(/תגיות/.test(await p.locator('[data-t-live]').innerText()), 'markup is refused live');
  await p.fill('#ap-the', 'אכלתי את זה'); await p.waitForTimeout(200); ok(/תקין/.test(await p.locator('[data-t-live]').innerText()) && /אכלתי את זה/.test(await p.locator('[data-t-after]').innerText()), 'valid wording → preview "after" updates without re-render');
  await p.locator('[data-act=apSave]').click(); await p.waitForTimeout(800);
  ok(await p.locator('[data-act=apPub]').count() === 0, 'editor: no publish button (publishing needs admin)');
  ok((await su(`select count(*) from public.cms_drafts where kind = 'text'`)).out === '1', 'the draft is stored on the server');
  { const { p: u, ctx: uc } = await user(); await go(u, '#/nutrition', 600); ok(!/אכלתי את זה/.test(await u.locator('#view').innerText()), 'a draft never reaches users'); await uc.close(); }
  await ctx.close();
  const { p: a, ctx: actx, errs: aerr } = await mk(); await login(a, 'admin@app.test'); await admin(a, 'texts');
  await a.fill('#ap-tq', 'סמן שאכלתי'); await a.waitForTimeout(600); await a.locator('[data-cms-tlist] .li', { has: a.locator('.t', { hasText: /^אכלתי את זה$/ }) }).first().click(); await a.waitForTimeout(300);
  ok(/אכלתי את זה/.test(await a.inputValue('#ap-the')), 'admin opens the same draft');
  await publish(a); ok((await su(`select version from public.cms_content where kind = 'text'`)).out === '1', 'admin publishes (v1)');
  G = 'texts: reach users, history, rollback';
  { const { p: u, ctx: uc } = await user(); await go(u, '#/nutrition', 600); const t = await u.locator('#view').innerText();
    ok(/אכלתי את זה/.test(t) && !/סמן שאכלתי/.test(t), 'the published wording replaces the original on the nutrition screen');
    ok(await u.evaluate(() => [...document.querySelectorAll('[data-act=eat]')].every(x => x.textContent.trim() === 'אכלתי את זה')), 'every use of the string changed (same text in all places)');
    await u.locator('[data-act=eat]').first().click(); await u.waitForTimeout(400); ok(await u.locator('.sheet').count() === 1, 'the button still works after its text changed'); await u.evaluate(() => document.querySelectorAll('.sheet [data-x]').forEach(x => x.click()));
    await a.fill('#ap-the', 'סומן — אכלתי'); await a.waitForTimeout(200); await a.locator('[data-act=apSave]').click(); await a.waitForTimeout(800); await publish(a);
    await u.evaluate(() => CMS.refresh()); await u.waitForTimeout(600); ok(/סומן — אכלתי/.test(await u.locator('#view').innerText()), 'v2 reaches the app');
    await a.locator('[data-act=apHist]').click(); await a.waitForTimeout(700); ok(await a.locator('[data-cms-history] .li').count() === 2, 'history lists both versions');
    await a.locator('.sheet [data-act=rb]').first().click(); await a.waitForTimeout(1300);
    await u.evaluate(() => CMS.refresh()); await u.waitForTimeout(600); ok(/אכלתי את זה/.test(await u.locator('#view').innerText()), 'rollback to v1 is reflected in the app');
    await a.locator('[data-act=apReset]').click(); await a.waitForTimeout(400); await a.check('#rs-ok'); await a.locator('.sheet [data-act=go]').click(); await a.waitForTimeout(1200);
    await u.evaluate(() => CMS.refresh()); await u.waitForTimeout(600); ok(/סמן שאכלתי/.test(await u.locator('#view').innerText()), 'reset to default brings the original wording back'); await uc.close(); }
  G = 'texts: bulk';
  await a.fill('#ap-bf', 'ארוחת ביניים'); await a.fill('#ap-br', 'נשנוש'); await a.waitForTimeout(900);
  const nb = +((await a.locator('[data-bulk-n]').innerText()).match(/\d+/) || [0])[0]; ok(nb >= 1, 'bulk replace previews the affected texts', nb);
  await a.locator('[data-act=tBulk]').click(); await a.waitForTimeout(400); await a.locator('.sheet [data-act=go]').click(); await a.waitForTimeout(2500);
  ok(+(await su(`select count(*) from public.cms_drafts where kind = 'text'`)).out >= 1 && (await su(`select count(*) from public.cms_content where kind = 'text' and status = 'published' and data->>'he' like '%נשנוש%'`)).out === '0', 'bulk creates drafts only — nothing published');
  await a.evaluate(() => { const d = AdminCMS.state.drafts; Object.keys(d).filter(k => k.startsWith('text:')).forEach(k => delete d[k]); }); await su(`delete from public.cms_drafts where kind = 'text'`);

  /* ── layout ── */
  G = 'layout: reorder, hide, preview, publish';
  await admin(a, 'layout');
  ok(await a.locator('[data-cms-comps] [data-comp]').count() === 8 && /מוגדרים בקוד/.test(await a.locator('[data-cms-layout]').innerText()), 'home registry: 8 editable components; code-defined ones listed separately');
  ok(await a.locator('[data-cms-pv] iframe').count() === 1, 'live preview frame present');
  const firstBefore = await a.locator('[data-cms-comps] [data-comp]').first().getAttribute('data-comp');
  await a.locator('[data-act=lMove][data-id=nutrition][data-d="-1"]').click(); await a.waitForTimeout(250);
  ok(await a.evaluate(() => document.activeElement && document.activeElement.dataset.act === 'lMove'), 'keyboard: focus stays on the move button after moving');
  for (let i = 0; i < 6; i++) { const bt = a.locator('[data-act=lMove][data-id=nutrition][data-d="-1"]'); if (await bt.isDisabled()) break; await bt.click(); await a.waitForTimeout(150); }
  ok(await a.locator('[data-cms-comps] [data-comp]').first().getAttribute('data-comp') === 'nutrition' && firstBefore !== 'nutrition', 'nutrition moved to the top');
  await a.locator('[data-show=week]').uncheck(); await a.waitForTimeout(300); await a.locator('[data-sp=trackers]').selectOption('compact'); await a.waitForTimeout(300);
  await waitFor(a, () => { const f = document.querySelector('[data-cms-frame]'); return f && f.contentWindow && f.contentWindow.CMS && f.contentWindow.App && f.contentWindow.App.rendered; }, null, 10000);
  await a.waitForTimeout(800);
  { const pv = await a.evaluate(() => { const d = document.querySelector('[data-cms-frame]').contentDocument; return [...d.querySelectorAll('#view > section:not([hidden])')].map(s => s.dataset.sec || (s.matches('[data-now]') ? 'now' : '')).filter(Boolean); });
    const want = await a.evaluate(() => AdminApp.layoutData('home').order);
    ok(pv.length >= 2 && JSON.stringify(pv) === JSON.stringify(want.filter(x => pv.includes(x))) && !pv.includes('week'), 'the live preview (iframe) already shows the unsaved order and hides the unchecked section', { pv, want }); }
  await a.locator('[data-act=apSave]').click(); await a.waitForTimeout(800); await publish(a);
  { const { p: u, ctx: uc } = await user(); await go(u, '#/', 700);
    const o = await u.evaluate(() => [...document.querySelectorAll('#view > section:not([hidden])')].map(s => s.dataset.sec || (s.matches('[data-now]') ? 'now' : s.matches('[data-week-chart]') ? 'week' : '')).filter(Boolean));
    ok(o[0] === 'nutrition', 'users see nutrition first on home', o);
    ok(await u.locator('#view [data-sec=week][hidden], #view [data-week-chart][hidden]').count() === 1 && !o.includes('week'), 'the hidden section is hidden');
    ok(await u.locator('#view [data-sec=trackers][data-cms-space=compact]').count() === 1, 'spacing option applied');
    ok(await u.locator('[data-act=saveSteps]').count() === 1, 'the moved/compacted tracker still works (controls present)'); await uc.close(); }
  G = 'layout: navigation';
  await a.locator('#ap-ls').selectOption('nav'); await a.waitForTimeout(300);
  ok(await a.locator('[data-comp=home] [data-show]').count() === 0, 'the home tab cannot be hidden (no switch)');
  await a.locator('[data-act=lMove][data-id=nutrition][data-d="-1"]').click(); await a.waitForTimeout(200); await a.locator('[data-show=calendar]').uncheck(); await a.waitForTimeout(300);
  await a.locator('[data-act=apSave]').click(); await a.waitForTimeout(800); await publish(a);
  { const { p: u, ctx: uc } = await user(); const nav = await u.evaluate(() => [...document.querySelectorAll('#nav a[data-nav]:not([hidden])')].map(x => x.dataset.nav));
    ok(nav.indexOf('nutrition') < nav.indexOf('workouts') && !nav.includes('calendar') && nav[0] === 'home', 'bottom navigation reordered; calendar hidden; home kept', nav); await uc.close(); }

  /* ── design ── */
  G = 'design: tokens, contrast, publish';
  await admin(a, 'design');
  ok(await a.locator('[data-cms-design] [data-tok]').count() >= 25, 'token editor lists the central tokens');
  await a.fill('[data-tokx="--text"]', '#2A2E39'); await a.waitForTimeout(300);
  ok(/ניגודיות נמוכה/.test(await a.locator('[data-d-live]').innerText()) && await a.locator('[data-cms-contrast] .pill.warn').count() >= 1, 'unreadable text colour flagged by the contrast check');
  await a.fill('[data-tokx="--text"]', '#FFFFFF'); await a.fill('[data-tokx="--accent"]', '#22C55E'); await a.waitForTimeout(300);
  ok(await a.evaluate(() => getComputedStyle(document.querySelector('[data-cms-sample]')).getPropertyValue('--accent').trim().toLowerCase()) === '#22c55e', 'live sample follows the edit');
  await a.locator('[data-tok="--r"]').fill('6'); await a.locator('[data-tok="--r"]').dispatchEvent('input'); await a.waitForTimeout(200);
  await a.locator('[data-act=apSave]').click(); await a.waitForTimeout(800);
  ok(await a.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()) !== '#22C55E', 'saving a draft does not change the admin\'s own app');
  await publish(a);
  { const { p: u, ctx: uc } = await user(); const v = await u.evaluate(() => { const s = getComputedStyle(document.documentElement); return { a: s.getPropertyValue('--accent').trim(), rgb: s.getPropertyValue('--accent-rgb').trim(), r: s.getPropertyValue('--r').trim() }; });
    ok(v.a.toLowerCase() === '#22c55e' && v.rgb === '34 197 94' && v.r === '6px', 'users get the new tokens (incl. derived rgb for soft tints)', v);
    { const bg = await u.evaluate(() => { const x = document.querySelector('#view .btn.primary'); return x && getComputedStyle(x).backgroundColor; }); ok(bg === 'rgb(34, 197, 94)', 'components pick up the token (primary button colour)', bg); }
    await uc.close(); }
  await a.locator('[data-act=dSavePreset]').click(); await a.waitForTimeout(300); await a.fill('#ps-id', 'green'); await a.locator('.sheet [data-act=go]').click(); await a.waitForTimeout(900);
  ok((await su(`select count(*) from public.cms_drafts where kind = 'theme' and item_id = 'preset_green'`)).out === '1', 'theme saved as a named preset (draft)');

  /* ── settings ── */
  G = 'settings: modules, defaults, notice';
  await admin(a, 'settings');
  await a.locator('[data-mod=fridge]').uncheck(); await a.selectOption('#ap-cmeals', '2'); await a.fill('#ap-cnt', 'גרסה חדשה בדרך'); await a.waitForTimeout(300);
  ok(/תקין/.test(await a.locator('[data-cms-valid]').innerText()) && await a.locator('[data-cms-timing] .li').count() === 3, 'settings valid; effect timing explained (immediate / rebuild / external)');
  await a.locator('[data-act=apSave]').click(); await a.waitForTimeout(800); await publish(a);
  { const { p: u, ctx: uc } = await user(); await go(u, '#/', 700);
    ok(await u.locator('[data-cms-notice]').count() === 1 && /גרסה חדשה בדרך/.test(await u.locator('[data-cms-notice]').innerText()), 'notice shown on home');
    ok(await u.locator('#view a[href^="#/fridge"]:not([hidden])').count() === 0, 'links to the switched-off module are hidden');
    await go(u, '#/fridge', 700); ok(await u.locator('[data-cms-module-off]').count() === 1, 'the module screen says it is off (data kept)');
    ok(await u.evaluate(() => Core.normPrefs(Core.profile().prefs).meals) === 2, 'default meals applied to a user who never chose'); await uc.close(); }

  /* ── audit ── */
  G = 'audit log';
  await admin(a, 'audit'); await waitFor(a, () => !!document.querySelector('[data-cms-audit-list]'), null, 8000);
  const au = await a.locator('[data-cms-audit-list]').innerText(); ok(/admin@app\.test/.test(au) && /פרסום/.test(au) && /owner@app\.test/.test(au) && /הענקת הרשאה/.test(au), 'audit shows who published and who granted roles');

  /* ── cache, offline, no flash ── */
  G = 'cache, offline and first paint';
  { const { p: u, ctx: uc } = await user(undefined, { sw: true }); await go(u, '#/', 600); await u.evaluate(() => navigator.serviceWorker && navigator.serviceWorker.ready); await u.reload(); await u.waitForTimeout(900);
    ok(await u.evaluate(() => !!localStorage.getItem('fit30.cms')), 'published content cached on the device');
    await u.addInitScript(() => { window.__first = null; new MutationObserver((ms, o) => { const v = document.getElementById('view'); if (v && v.children.length && !window.__first) { window.__first = { notice: !!v.querySelector('[data-cms-notice]'), accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(), nav: [...document.querySelectorAll('#nav a[data-nav]:not([hidden])')].map(x => x.dataset.nav).join(',') }; o.disconnect(); } }).observe(document, { childList: true, subtree: true }); });
    await u.reload(); await u.waitForTimeout(1200); const f = await u.evaluate(() => window.__first);
    ok(f && f.notice && f.accent.toLowerCase() === '#22c55e' && !/calendar/.test(f.nav), 'first paint already shows the published content (no flash of built-in texts/colours/layout)', f);
    await uc.setOffline(true); await u.reload().catch(() => { }); await u.waitForTimeout(1500);
    const off = await u.evaluate(() => ({ n: !!document.querySelector('[data-cms-notice]'), a: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() })).catch(() => null);
    ok(!!off && off.n && off.a.toLowerCase() === '#22c55e', 'offline: the cached copy is applied (server not reachable)', off);
    await uc.setOffline(false);
    await su(`update public.cms_content set data = '{"name":"x","tokens":{"--accent":"red;}body{display:none"}}'::jsonb where kind = 'theme' and item_id = 'active'`); /* simulate a corrupted row written behind the API */
    await u.goto(APP); await u.waitForTimeout(900); await u.evaluate(() => CMS.refresh()); await u.waitForTimeout(500);
    ok(await u.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim().toUpperCase()) === '#CCFF00' && await u.locator('#view').isVisible(), 'a corrupted published item is rejected by the app; built-in values used, nothing half-applied');
    await uc.close(); }

  G = 'mobile, RTL, desktop';
  for (const t of ['texts', 'layout', 'design', 'settings', 'audit']) { await admin(a, t); const w = await a.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, dir: getComputedStyle(document.querySelector('[data-cms]')).direction }));
    ok(w.sw <= w.iw + 1 && w.dir === 'rtl', `${t}: no horizontal scroll at 390 px, RTL`, w); }
  { const { p: d, ctx: dc } = await mk('desktop'); await login(d, 'admin@app.test'); await admin(d, 'design'); ok(await d.locator('[data-cms-design]').count() === 1, 'desktop: design area renders'); await dc.close(); }
  ok(aerr.length === 0, 'no JS errors (admin)', aerr); ok(errs.length === 0, 'no JS errors (editor)', errs);
  await actx.close(); await b.close(); procs.forEach(pr => pr.kill());
  let pass = 0, fail = 0; res.forEach(x => { console.log((x.ok ? 'PASS ' : 'FAIL ') + '[' + x.g + '] ' + x.m); x.ok ? pass++ : fail++; });
  console.log(`app control e2e${process.env.BROWSER === 'webkit' ? ' (webkit)' : ''}: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { res.forEach(x => console.log((x.ok ? 'PASS ' : 'FAIL ') + '[' + x.g + '] ' + x.m)); console.error('app control e2e crashed in [' + G + ']: ' + e.message.split('\n')[0]); procs.forEach(pr => pr.kill()); process.exit(2); });
