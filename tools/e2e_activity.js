/* RC5 · steps / health source / MoveScore UI — Playwright Chromium, iPhone 13 emulation (NOT Safari, NOT a device).
   Part 1 (web, the real situation of the beta): honest status, no connect button, manual entry labelled, no default target,
   existing users keep their target, MoveScore only with enough data.
   Part 2 (SIMULATED native bridge — a fake window.Capacitor injected by this test only, never shipped): checks the adapter's
   state machine: connected only after a successful read, idempotent re-sync, Android denial, errors. This does NOT prove a
   real HealthKit / Health Connect connection; that needs the native app on a device.
   Usage: node tools/e2e_activity.js [URL] */
const { chromium, devices } = require('playwright'); const fs = require('fs');
const URL0 = process.argv[2] || 'http://localhost:8096/';
const res = []; let G = ''; const ok = (c, m, i) => res.push({ g: G, ok: !!c, m: m + (i !== undefined && !c ? ' → ' + JSON.stringify(i).slice(0, 240) : '') });
(async () => {
  const b = await chromium.launch(); const errs = [];
  const mkPage = async (init) => { const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'he-IL', serviceWorkers: 'block' }); if (init) await ctx.addInitScript(init); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); return { ctx, p }; };
  const go = async (p, h) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(500); };
  let { ctx, p } = await mkPage(); await p.goto(URL0); await p.waitForTimeout(700); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(700);
  const today = await p.evaluate(() => Store.today());

  G = 'web: honest status';
  await go(p, '#/activity');
  ok(await p.locator('[data-health-source]').count() === 1, 'activity screen loads (on-demand chunk)');
  ok(await p.locator('[data-env="browser"]').count() === 1 && /לדפדפן אין גישה ל־Apple Health/.test(await p.locator('[data-health-source]').innerText()), 'says plainly that the browser cannot reach Apple Health');
  ok(await p.locator('[data-act=hConnect]').count() === 0 && await p.locator('[data-health-state="never"]').count() === 1 && !/מחובר —/.test(await p.locator('[data-health-source]').innerText()), 'no connect button and never shown as connected on the web');
  G = 'targets';
  ok(await p.evaluate(() => Store.load('profile').goals.steps) == null && /לא נקבע/.test(await p.locator('[data-step-target]').innerText()), 'new user: no step target, no 10,000 default');
  await go(p, '#/'); ok(/יעד אישי לא נקבע/.test(await p.locator('[data-steps-card]').innerText()) && await p.locator('[data-steps-card] .meter').count() === 0, 'home: no target → no progress bar to fall short of');
  ok(!(await p.evaluate(d => Core.dailyProgress(d).tasks.some(t => t.k === 'steps'), today)), 'no steps task in daily progress without a target');
  await p.fill('#h-steps', '4200'); await p.locator('[data-act=saveSteps]').click(); await p.waitForTimeout(350);
  ok(await p.locator('[data-steps-kind="user"]').count() === 1 && /הוזן ידנית/.test(await p.locator('[data-steps-card]').innerText()), 'manual steps labelled "הוזן ידנית"');
  ok(await p.evaluate(d => Store.load('tracking').daily[d].stepsSrc, today) === 'user', 'stored with source "user"');
  G = 'MoveScore';
  await go(p, '#/activity'); ok(/צריך יעד אישי/.test(await p.locator('[data-movescore]').innerText()) && await p.locator('[data-ms-value]').count() === 0, 'no target → explains that a personal target is needed, no score');
  await p.fill('#st-v', '6000'); await p.locator('[data-act=stSave]').click(); await p.waitForTimeout(400);
  ok(await p.evaluate(() => Store.load('profile').goals.steps) === 6000, 'target saved from the activity screen');
  ok(/לפחות ב־4 מתוך 7/.test(await p.locator('[data-movescore]').innerText()) && await p.locator('[data-ms-value]').count() === 0, 'one day of data → explains (missing days are not zeros), no score');
  for (const i of [1, 2, 3]) await p.evaluate(([d, v]) => Activity.setUserSteps(Store.addDays(d, -v), 5000 + v * 100), [today, i]); /* setup via the same API the UI uses */
  await go(p, '#/progress'); await go(p, '#/activity');
  const msTxt = await p.locator('[data-movescore]').innerText(); const val = await p.locator('[data-ms-value]').innerText().catch(() => null);
  ok(val != null && +val >= 0 && +val <= 100 && /גרסת הצעה/.test(msTxt), 'score 0–100 shown with "proposal v0" label', { val, msTxt: msTxt.slice(0, 120) });
  for (const i of [4, 5, 6]) await p.evaluate(([d, v]) => Activity.setUserSteps(Store.addDays(d, -v), 6000), [today, i]); await go(p, '#/progress'); await go(p, '#/activity');
  ok(await p.locator('[data-target-suggestion]').count() === 1, 'target suggestion appears after 7 days of data');
  ok(await p.locator('[data-steps-list] [data-kind="user"]').count() === 7, '14-day list labels each value\'s source');
  await ctx.close();

  G = 'existing user keeps 10,000';
  ({ ctx, p } = await mkPage()); await p.goto(URL0); await p.waitForTimeout(600);
  await p.evaluate(() => { localStorage.clear(); const pr = Store.load('profile'); pr.goals = { steps: 10000, water: 3000, sleep: 7.5 }; Store.save('profile'); }); await p.reload(); await p.waitForTimeout(700);
  ok(/10,000/.test(await p.locator('[data-steps-card]').innerText()) && await p.evaluate(() => Activity.targetOn(Store.today())) === 10000, 'a saved 10,000 target is kept (no silent change)');
  await ctx.close();

  /* ---- SIMULATED native bridge ---- */
  const fake = mode => `window.__fakeMode=${JSON.stringify(mode)}; window.Capacitor = { isNativePlatform: () => true, getPlatform: () => window.__fakeMode.platform, Plugins: { Health: {
      isAvailable: async () => ({ available: window.__fakeMode.available !== false, platform: window.__fakeMode.platform, reason: '' }),
      requestAuthorization: async () => { window.__asked = (window.__asked || 0) + 1; return {}; },
      checkAuthorization: async () => ({ readAuthorized: window.__fakeMode.denied ? [] : ['steps'], readDenied: window.__fakeMode.denied ? ['steps'] : [], writeAuthorized: [], writeDenied: [] }),
      queryAggregated: async (o) => { if (window.__fakeMode.throws) throw new Error('simulated plugin error'); window.__q = o; const out = []; const e = new Date(o.endDate); for (let i = 0; i < 3; i++) { const d = new Date(e.getFullYear(), e.getMonth(), e.getDate() - i); out.push({ startDate: d.toISOString(), endDate: new Date(d.getTime() + 864e5).toISOString(), value: window.__fakeMode.zero ? 0 : 7000 + i, unit: 'count' }); } return { samples: out }; } } } };`;
  G = 'SIMULATED native iOS';
  ({ ctx, p } = await mkPage(fake({ platform: 'ios' }))); await p.goto(URL0); await p.waitForTimeout(600); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(600);
  await go(p, '#/activity'); ok(await p.locator('[data-act=hConnect]').count() === 1 && await p.locator('[data-health-state="never"]').count() === 1, 'native: connect offered, state "never" before any read');
  await p.locator('[data-act=hConnect]').click(); await p.waitForTimeout(800);
  ok(await p.evaluate(() => window.__asked) === 1 && (await p.evaluate(() => window.__q)).dataType === 'steps', 'asks permission once, reads only steps');
  ok(await p.locator('[data-health-state="connected"]').count() === 1 && await p.evaluate(d => Activity.day(d).kind, today) === 'measured', 'connected only after the read returned data; values labelled measured');
  const v1 = await p.evaluate(d => Activity.day(d).value, today); await p.locator('[data-act=hSync]').click(); await p.waitForTimeout(600); await p.locator('[data-act=hSync]').click(); await p.waitForTimeout(600);
  ok(await p.evaluate(d => Activity.day(d).value, today) === v1, 're-sync twice: same daily value (replaced, not added)', v1);
  await ctx.close();
  ({ ctx, p } = await mkPage(fake({ platform: 'ios', zero: true }))); await p.goto(URL0); await p.waitForTimeout(600); await p.evaluate(() => { localStorage.clear(); }); await p.reload(); await p.waitForTimeout(600);
  await p.evaluate(d => Activity.setUserSteps(d, 3333), today); await go(p, '#/activity'); await p.locator('[data-act=hConnect]').click(); await p.waitForTimeout(700);
  ok(await p.locator('[data-health-state="connected-empty"]').count() === 1 && await p.evaluate(d => Activity.day(d).value, today) === 3333, 'iOS empty/zero read (denied or no data): not "connected", manual 3,333 kept (not overwritten by 0)');
  await ctx.close();
  G = 'SIMULATED native Android';
  ({ ctx, p } = await mkPage(fake({ platform: 'android', denied: true }))); await p.goto(URL0); await p.waitForTimeout(600); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(600);
  await go(p, '#/activity'); await p.locator('[data-act=hConnect]').click(); await p.waitForTimeout(700);
  ok(await p.locator('[data-health-state="denied"]').count() === 1 && await p.evaluate(() => !Store.load('tracking').measured || !Object.keys(Store.load('tracking').measured).length), 'Android denial → "denied", nothing imported');
  await ctx.close();
  ({ ctx, p } = await mkPage(fake({ platform: 'android', throws: true }))); await p.goto(URL0); await p.waitForTimeout(600); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(600);
  await go(p, '#/activity'); await p.locator('[data-act=hConnect]').click(); await p.waitForTimeout(700);
  ok(await p.locator('[data-health-state="error"]').count() === 1 && /simulated plugin error/.test(await p.locator('[data-health-source]').innerText()), 'plugin error → "error" with the message, not connected');
  await ctx.close();
  ok(errs.length === 0, 'no page errors', errs.slice(0, 3));
  await b.close(); const pass = res.filter(r => r.ok).length, fail = res.length - pass;
  fs.mkdirSync('dist/reports', { recursive: true }); fs.writeFileSync('dist/reports/e2e-activity.json', JSON.stringify({ url: URL0, at: new Date().toISOString(), pass, fail, results: res }, null, 1));
  res.forEach(r => console.log((r.ok ? 'PASS ' : 'FAIL ') + '[' + r.g + '] ' + r.m)); console.log(`activity e2e: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { res.forEach(r => console.log((r.ok ? 'PASS ' : 'FAIL ') + '[' + r.g + '] ' + r.m)); console.error('activity e2e crashed in [' + G + ']: ' + e.message.split('\n')[0]); process.exit(2); });
