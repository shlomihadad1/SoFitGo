/* Fit30 RC1 browser acceptance (Playwright Chromium; iPhone SE / 13 / iPad emulation; fixed clock). NOT Safari, NOT a real device.
   Note: Playwright's Chromium build has no proprietary H.264 decoder, so MP4 playback itself cannot be verified here — the test
   accepts "playing" OR the player's labelled error state, and checks everything around playback. Real playback = manual iPhone check.
   Usage: node tools/e2e_rc1.js [URL] → dist/reports/e2e-rc1.json */
const { chromium, devices } = require('playwright'); const fs = require('fs'), path = require('path');
const URL0 = process.argv[2] || 'http://localhost:8096/';
const res = []; let G = ''; const ok = (c, m, info) => res.push({ g: G, ok: !!c, m: m + (info !== undefined && !c ? ' → ' + JSON.stringify(info).slice(0, 300) : '') });
const SEED = () => { localStorage.clear(); Store.resetAll(); const pr = Store.load('profile'); Object.assign(pr, { age: 34, height: 172, weight: 78, startWeight: 78, sex: 'f', experience: 'beginner', onboarded: true, startDate: Store.today() });
  pr.aims = { primary: 'general', secondary: [] }; pr.availability = { days: [1, 3, 5], sessions: 3, maxMin: 30 }; pr.environment = { place: 'home', equipment: [], custom: [] }; pr.prefs = Core.normPrefs({}); Store.save('profile');
  Plans.activate(Plans.create('general_90', Plans.paramsFromProfile(pr), Store.today()), { confirmReplace: true }); };
(async () => {
  const b = await chromium.launch();
  { G = 'help & tutorials (lazy chunk)';
    const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'he-IL', serviceWorkers: 'block' }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    const reqs = []; p.on('request', r => reqs.push(r.url())); await p.clock.install({ time: new Date('2026-10-19T08:00:00').getTime() });
    await p.goto(URL0); await p.waitForTimeout(500); await p.evaluate(SEED); await p.reload(); await p.waitForTimeout(500);
    ok(!reqs.some(u => /help\.js/.test(u)), 'help.js is not part of the first load');
    await p.evaluate(() => { location.hash = '#/settings'; }); await p.waitForTimeout(300); await p.locator('[data-help-link] a').click(); await p.waitForTimeout(800);
    ok(reqs.some(u => /help\.js/.test(u)) && await p.locator('[data-tut]').count() === 12, 'opening help loads help.js once and shows 12 tutorials');
    ok(await p.locator('[data-tut] [data-mp]').count() === 12 && await p.locator('video').count() === 0, '12 players, no <video> element before a tap (nothing preloaded, no autoplay)');
    ok(await p.locator('[data-tut] [data-tut-steps] li').count() >= 36, 'text steps for every tutorial');
    /* RC1 review: the help screen once overflowed sideways on iPhone (poster wider than the player) */
    for (const w of [320, 390, 820]) { await p.setViewportSize({ width: w, height: 844 }); await p.waitForTimeout(200); ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `help screen fits ${w}px without horizontal scroll`); }
    await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(200);
    ok(await p.evaluate(() => { const b = document.querySelector('[data-tut=log-meal] [data-mpa=play]'); b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(); const t = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return b.contains(t); }), 'play button is the top element at its centre (not covered by the poster)');
    ok(await p.evaluate(() => { const f = document.querySelector('[data-tut=log-meal] .mp-stage'), r = f.getBoundingClientRect(); return r.height > r.width; }), 'portrait recording shown in a portrait frame');
    ok(await p.evaluate(() => getComputedStyle(document.querySelector('.mp-t')).direction) === 'ltr', 'time display reads left-to-right (0:00 / 0:09)');
    ok((await p.locator('[data-tut] figcaption').first().innerText()).includes('ללא קול') && (await p.locator('[data-tut] figcaption').first().innerText()).includes('דורש אינטרנט'), 'caption: original recording, no sound, needs internet');
    await p.locator('[data-tut=log-meal] [data-mpa=play]').click(); await p.waitForTimeout(1500); const st = await p.locator('[data-tut=log-meal] [data-mp]').getAttribute('data-mstate');
    ok(['playing', 'ready', 'loading', 'error'].includes(st) && (st !== 'error' || await p.locator('[data-tut=log-meal] .mp-err').isVisible()), `tap on play → player state "${st}" (error state is labelled; H.264 not decodable in this Chromium)`);
    ok(await p.evaluate(() => { const v = document.querySelector('[data-tut=log-meal] video'); return !!v && v.hasAttribute('playsinline') && !v.autoplay; }), 'video created on tap with playsinline, no autoplay');
    const vreq = await p.evaluate(() => [...document.querySelectorAll('video source')].map(s => s.src)); ok(vreq.length > 0 && vreq.every(u => u.startsWith(new URL(URL0).origin)), 'videos are served from the app itself (no third-party player)', vreq);
    await p.locator('[data-tut=swap-meal] a.btn').click(); await p.waitForTimeout(400); ok(await p.evaluate(() => location.hash) === '#/nutrition', '"to the screen" link opens the right screen');
    await p.evaluate(() => { location.hash = '#/'; }); await p.waitForTimeout(300); ok(await p.locator('.sig-links a[href="#/help"]').count() === 1, 'home links to tutorials');
    ok(errs.length === 0, 'no page errors', errs.slice(0, 3)); await ctx.close(); }

  { G = 'offline (service worker)';
    const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'he-IL' }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(URL0); await p.waitForTimeout(500); await p.evaluate(SEED); await p.reload();
    await p.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 15000 }).catch(() => {}); await p.waitForTimeout(800);
    const cached = await p.evaluate(async () => { const ks = await caches.keys(); for (const k of ks) { const c = await caches.open(k); if (await c.match('help.js')) return true; } return false; }); ok(cached, 'help.js precached on install');
    await ctx.setOffline(true); await p.reload(); await p.waitForTimeout(800); const pl = await p.evaluate(() => !!Plans.active()); ok(pl, 'offline reload: app and data load');
    await p.evaluate(() => { location.hash = '#/help'; }); await p.waitForTimeout(1200); ok(await p.locator('[data-tut]').count() === 12 && await p.locator('[data-tut] [data-tut-steps] li').count() >= 36, 'offline: help and all text steps available');
    await p.locator('[data-tut=backup] [data-mpa=play]').click(); await p.waitForTimeout(1500); ok(await p.locator('[data-tut=backup] [data-mp]').getAttribute('data-mstate') === 'error' && /הסרטון לא נטען/.test(await p.locator('[data-tut=backup] .mp-err').innerText()), 'offline: video shows a clear "not loaded" message (no false offline promise)');
    await p.evaluate(() => { location.hash = '#/nutrition'; }); await p.waitForTimeout(500); await p.locator('[data-act=eat][data-slot=m1]').click(); await p.waitForTimeout(300); await p.locator('.sheet [data-act=ok]').click(); await p.waitForTimeout(300);
    await p.reload(); await p.waitForTimeout(800); ok(await p.evaluate(() => Core.entries(Store.today()).length) === 1, 'offline: a meal logged offline survives a reload');
    ok(errs.length === 0, 'no page errors offline', errs.slice(0, 3)); await ctx.close(); }

  { G = 'RC1 fixes in the UI';
    const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'he-IL', serviceWorkers: 'block' }); const p = await ctx.newPage(); p.on('dialog', d => d.accept()); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.clock.install({ time: new Date('2026-10-19T08:00:00').getTime() }); await p.goto(URL0); await p.waitForTimeout(400); await p.evaluate(SEED); await p.reload(); await p.waitForTimeout(400);
    const rid = await p.evaluate(() => Core.plan(Store.today()).m2.rid); await p.evaluate(r => { location.hash = '#/recipe/' + r; }, rid); await p.waitForTimeout(400);
    await p.locator('[data-act=dislike]').click(); await p.waitForTimeout(400); ok(await p.evaluate(r => Store.load('profile').nutritionDislike.includes(r) && Core.plan(Store.today()).m2.rid !== r, rid), 'recipe "don\'t like": saved and today\'s personal menu no longer serves it');
    await p.evaluate(() => { location.hash = '#/settings'; }); await p.waitForTimeout(300); ok(await p.locator('[data-dislikes] [data-act=undislike]').count() === 1, 'settings list the disliked dish with a remove button');
    await p.fill('#t-k', '2600'); await p.locator('[data-act=saveTargets]').click(); await p.waitForTimeout(300); await p.evaluate(() => { const pr = Store.load('profile'); pr.weight = 85; Store.save('profile'); }); await p.reload(); await p.waitForTimeout(400);
    await p.evaluate(() => { location.hash = '#/targets'; }); await p.waitForTimeout(300); ok(await p.locator('[data-tw=manualStale]').count() === 1, 'manual target after a weight change: recheck warning shown');
    await p.evaluate(() => { const r = EXERCISES[0].id; location.hash = '#/ex/' + r; }); await p.waitForTimeout(300); ok(/לא נבדקו ולא אושרו/.test(await p.locator('[data-ex-safety]').innerText()), 'exercise page states the instructions are not professionally approved');
    ok(errs.length === 0, 'no page errors', errs.slice(0, 3)); await ctx.close(); }

  { G = 'screen sizes (iPhone SE, iPhone 13, iPad portrait & landscape)';
    for (const [name, vp] of [['iPhone SE', { width: 375, height: 667 }], ['iPhone 13', { width: 390, height: 844 }], ['iPad', { width: 820, height: 1180 }], ['iPad landscape', { width: 1180, height: 820 }]]) {
      const ctx = await b.newContext({ viewport: vp, isMobile: vp.width < 800, hasTouch: true, serviceWorkers: 'block' }); const p = await ctx.newPage(); await p.clock.install({ time: new Date('2026-10-19T08:00:00').getTime() });
      await p.goto(URL0); await p.waitForTimeout(400); await p.evaluate(SEED); await p.reload(); await p.waitForTimeout(400); const wide = [];
      for (const h of ['#/', '#/plan', '#/nutrition', '#/shopping', '#/progress', '#/settings', '#/profile', '#/targets', '#/explain', '#/help', '#/recipes', '#/workouts']) { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(h === '#/help' ? 900 : 250); if (await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) wide.push(h); }
      await p.evaluate(() => { location.hash = '#/help'; }); await p.waitForTimeout(600);
      const small = await p.evaluate(() => [...document.querySelectorAll('main button, main a.btn')].filter(e => { const r = e.getBoundingClientRect(); return r.width && r.height && r.height < 36; }).length);
      ok(!wide.length, `${name}: 12 screens without horizontal overflow`, wide); ok(small === 0, `${name}: help screen buttons ≥ 36 px tall`, { small }); await ctx.close(); } }

  await b.close();
  const pass = res.filter(r => r.ok).length, fail = res.length - pass, groups = {}; res.forEach(r => { groups[r.g] = groups[r.g] || { pass: 0, fail: 0 }; groups[r.g][r.ok ? 'pass' : 'fail']++; });
  fs.mkdirSync(path.join(__dirname, '../dist/reports'), { recursive: true }); fs.writeFileSync(path.join(__dirname, '../dist/reports/e2e-rc1.json'), JSON.stringify({ url: URL0, pass, fail, groups, results: res }, null, 1));
  res.filter(r => !r.ok).forEach(r => console.log('FAIL [' + r.g + '] ' + r.m)); console.log(JSON.stringify(groups)); console.log(`rc1 e2e: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('crashed', e.stack); console.log(res.slice(-4).map(r => (r.ok ? 'PASS ' : 'FAIL ') + r.m).join('\n')); process.exit(2); });
