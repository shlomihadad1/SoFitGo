/* RC5 F-8 — a failed save must be visible and the screen must show only what is really stored.
   Playwright Chromium, iPhone 13 emulation (NOT Safari). Storage failure is simulated by making localStorage.setItem throw
   QuotaExceededError for one data area. Usage: node tools/e2e_savefail.js [URL] */
const { chromium, devices } = require('playwright'); const fs = require('fs');
const URL0 = process.argv[2] || 'http://localhost:8096/';
const res = []; let G = ''; const ok = (c, m, i) => res.push({ g: G, ok: !!c, m: m + (i !== undefined && !c ? ' → ' + JSON.stringify(i).slice(0, 240) : '') });
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'he-IL', serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const go = async h => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(400); };
  const next = async () => { await p.locator('[data-act=next]').click(); await p.waitForTimeout(350); };
  await p.goto(URL0); await p.waitForTimeout(700); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(700);
  await go('#/setup/1'); await p.fill('#pf-age', '34'); await p.fill('#pf-h', '172'); await p.fill('#pf-w', '78'); await p.locator('[data-act=xp][data-v=beginner]').click(); await p.waitForTimeout(250); await next();
  await p.locator('[data-act=gp][data-v=general]').click(); await p.waitForTimeout(200); await next();
  for (const d of [1, 3, 5]) { await p.locator(`[data-act=dw][data-v="${d}"]`).click(); await p.waitForTimeout(120); }
  await p.locator('[data-act=ses][data-v="3"]').click(); await p.waitForTimeout(150); await p.selectOption('#pf-pref', '30'); await p.selectOption('#pf-max', '45'); await next();
  await p.locator('[data-act=tpl][data-v=general_90]').click(); await p.waitForTimeout(200); await next(); await next(); await next(); await p.waitForTimeout(400);
  const today = await p.evaluate(() => Store.today());
  const raw = k => p.evaluate(k => localStorage.getItem(k), k);
  const failOn = key => p.evaluate(key => { window.__origSet = window.__origSet || Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === key) throw new DOMException('full', 'QuotaExceededError'); return window.__origSet.call(this, k, v); }; }, key);
  const heal = () => p.evaluate(() => { if (window.__origSet) Storage.prototype.setItem = window.__origSet; });
  const toast = () => p.evaluate(() => (document.querySelector('.toast') || {}).textContent || '');

  G = 'meal journal save fails';
  await go('#/nutrition'); const before = await raw('fit30.nutrition'); await failOn('fit30.nutrition');
  await p.locator('[data-act=eat][data-slot=m1]').click(); await p.waitForTimeout(250); await p.locator('.sheet [data-act=ok]').click(); await p.waitForTimeout(500);
  ok(/השמירה נכשלה/.test(await toast()) && /יומן התזונה/.test(await toast()), 'a specific error names the journal', await toast());
  ok(await raw('fit30.nutrition') === before, 'stored journal unchanged');
  ok(await p.locator('[data-eaten]').count() === 0 && await p.locator('[data-act=eat][data-slot=m1]').count() === 1, 'screen shows the meal as NOT eaten (what is stored), not a phantom ✓');
  ok(await p.evaluate(d => Core.entries(d).length, today) === 0, 'in-memory data rolled back to the stored state');
  await heal(); await p.locator('[data-act=eat][data-slot=m1]').click(); await p.waitForTimeout(250); await p.locator('.sheet [data-act=ok]').click(); await p.waitForTimeout(400);
  ok(JSON.parse(await raw('fit30.nutrition')).log[today].entries.length === 1 && await p.locator('[data-eaten]').count() === 1, 'after storage recovers the same action saves normally');

  G = 'tracking save fails (water)';
  await go('#/'); const tBefore = await raw('fit30.tracking'); await failOn('fit30.tracking');
  const wBtn = p.locator('[data-act=water][data-ml="250"]').first(); await wBtn.click(); await p.waitForTimeout(500);
  ok(/השמירה נכשלה/.test(await toast()) && /מעקב/.test(await toast()), 'a specific error names tracking data', await toast());
  ok(await raw('fit30.tracking') === tBefore && await p.evaluate(d => Core.daily(d).water || 0, today) === 0, 'water not stored and not shown as added');
  await heal();
  ok(errs.length === 0, 'no page errors', errs.slice(0, 3));
  await b.close(); const pass = res.filter(r => r.ok).length, fail = res.length - pass;
  fs.mkdirSync('dist/reports', { recursive: true }); fs.writeFileSync('dist/reports/e2e-savefail.json', JSON.stringify({ url: URL0, at: new Date().toISOString(), pass, fail, results: res }, null, 1));
  res.forEach(r => console.log((r.ok ? 'PASS ' : 'FAIL ') + '[' + r.g + '] ' + r.m)); console.log(`save-fail e2e: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { res.forEach(r => console.log((r.ok ? 'PASS ' : 'FAIL ') + '[' + r.g + '] ' + r.m)); console.error('save-fail e2e crashed in [' + G + ']: ' + e.message.split('\n')[0]); process.exit(2); });
