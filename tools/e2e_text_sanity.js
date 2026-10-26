/* Quality pass · empty and edge states — Playwright Chromium, iPhone 13 emulation (NOT Safari). Every main screen for (a) a
   brand-new install with no profile, (b) a profile without a plan, (c) a user with a personal plan: no visible "undefined", "NaN",
   "[object Object]", "null" or "Infinity", and no page errors. Usage: node tools/e2e_text_sanity.js [URL] */
const { chromium, devices } = require('playwright'); const fs = require('fs');
const URL0 = process.argv[2] || 'http://localhost:8096/';
const res = []; let G = ''; const ok = (c, m, i) => res.push({ g: G, ok: !!c, m: m + (i !== undefined && !c ? ' → ' + JSON.stringify(i).slice(0, 500) : '') });
const ROUTES = ['#/', '#/calendar', '#/workouts', '#/plan', '#/nutrition', '#/recipes', '#/targets', '#/shopping', '#/progress', '#/review', '#/records', '#/explain', '#/settings', '#/profile', '#/programs', '#/media', '#/help',
  '#/planb', '#/travel', '#/changes', '#/reset', '#/presets', '#/activity', '#/privacy', '#/fridge', '#/feedback', '#/install', '#/today'];
(async () => {
  const b = await chromium.launch();
  const states = {
    'brand-new install': () => {},
    'profile, no plan': () => { const pr = Store.load('profile'); Object.assign(pr, { age: 34, height: 172, weight: 78, startWeight: 78, sex: 'f', experience: 'beginner', onboarded: true, startDate: Store.today() }); Store.save('profile'); },
    'personal plan': () => { const pr = Store.load('profile'); Object.assign(pr, { age: 34, height: 172, weight: 78, startWeight: 78, sex: 'f', experience: 'beginner', onboarded: true, startDate: Store.today(), aims: { primary: 'general', secondary: [] } }); pr.availability = { days: [1, 3, 5], sessions: 3, prefMin: null, maxMin: 30 }; Store.save('profile');
      Plans.activate(Plans.create('general_90', Plans.paramsFromProfile(pr), Store.today()), { confirmReplace: true }); } };
  for (const [name, fn] of Object.entries(states)) {
    G = name; const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'he-IL', serviceWorkers: 'block' }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(URL0); await p.waitForTimeout(700); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(700); await p.evaluate(fn); await p.reload(); await p.waitForTimeout(800);
    const bad = {};
    for (const r of ROUTES) { await p.evaluate(x => { location.hash = x; }, r); await p.waitForTimeout(600);
      const hits = await p.evaluate(() => { const txt = (document.querySelector('main') || document.body).innerText; return (txt.match(/\b(undefined|NaN|Infinity|null)\b|\[object Object\]/g) || []).slice(0, 3); });
      if (hits.length) bad[r] = hits; }
    ok(Object.keys(bad).length === 0, `${ROUTES.length} screens: no "undefined" / "NaN" / "null" / "[object Object]" shown`, bad);
    ok(errs.length === 0, 'no page errors', errs.slice(0, 3)); await ctx.close();
  }
  G = 'English preview (LTR): no horizontal overflow';
  { const ctx = await b.newContext({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true, locale: 'en-US', serviceWorkers: 'block' }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(URL0 + '?lang=en'); await p.waitForTimeout(700); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(700); await p.evaluate(states['personal plan']); await p.reload(); await p.waitForTimeout(800);
    const over = {}; for (const r of ROUTES) { await p.evaluate(x => { location.hash = x; }, r); await p.waitForTimeout(550); const w = await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth]); if (w[0] > w[1] + 1) over[r] = w; }
    ok(Object.keys(over).length === 0, `${ROUTES.length} screens at 375 px, LTR: nothing wider than the screen`, over); ok(errs.length === 0, 'no page errors', errs.slice(0, 3)); await ctx.close(); }
  await b.close();
  const pass = res.filter(r => r.ok).length, fail = res.length - pass;
  res.forEach(r => console.log((r.ok ? 'PASS' : 'FAIL') + ' [' + r.g + '] ' + r.m));
  fs.mkdirSync('dist', { recursive: true }); fs.writeFileSync('dist/e2e_text_sanity.json', JSON.stringify(res, null, 1));
  console.log(`text sanity e2e: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('text sanity crashed in [' + G + ']: ' + (e.stack || e.message).slice(0, 500)); process.exit(1); });
