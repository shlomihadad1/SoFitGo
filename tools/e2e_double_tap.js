/* Quality pass · double actions — Playwright Chromium, iPhone 13 emulation (NOT Safari). A real double-click (two click events)
   on: the generic bind guard (async handler runs once while pending, again after it settles; sync handler unchanged), marking a
   meal as eaten (one journal entry), adding an own shopping item (one item). Usage: node tools/e2e_double_tap.js [URL] */
const { chromium, devices } = require('playwright'); const fs = require('fs');
const URL0 = process.argv[2] || 'http://localhost:8096/';
const res = []; let G = ''; const ok = (c, m, i) => res.push({ g: G, ok: !!c, m: m + (i !== undefined && !c ? ' → ' + JSON.stringify(i).slice(0, 240) : '') });
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'he-IL', serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const go = async h => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(700); };
  await p.goto(URL0); await p.waitForTimeout(700); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(700);
  await p.evaluate(() => { const pr = Store.load('profile'); Object.assign(pr, { age: 34, height: 172, weight: 78, startWeight: 78, sex: 'f', experience: 'beginner', onboarded: true, startDate: Store.today() }); Store.save('profile'); });

  G = 'the guard';
  await p.evaluate(() => { const d = document.createElement('div'); d.id = 'dt'; d.innerHTML = '<button data-act="slow" id="dt-a">a</button><button data-act="fast" id="dt-s">s</button>'; (document.querySelector('main') || document.body).prepend(d); d.style.cssText = 'position:relative;z-index:9999';
    window.__n = { slow: 0, fast: 0 }; UI.bind(d, { slow: () => { __n.slow++; return new Promise(r => setTimeout(r, 400)); }, fast: () => { __n.fast++; } }); });
  await p.locator('#dt-a').dblclick(); await p.waitForTimeout(80);
  ok(await p.evaluate(() => __n.slow) === 1 && await p.locator('#dt-a').getAttribute('aria-busy') === 'true', 'async action: a double tap runs it once, and the control says it is busy');
  await p.waitForTimeout(500); await p.locator('#dt-a').click(); await p.waitForTimeout(50);
  ok(await p.evaluate(() => __n.slow) === 2, 'after it finished, the next tap runs it again');
  await p.locator('#dt-s').dblclick(); await p.waitForTimeout(50);
  ok(await p.evaluate(() => __n.fast) === 2, 'a synchronous action is unchanged (two taps = two runs, e.g. +0.25 L twice)');
  await p.evaluate(() => document.getElementById('dt').remove());

  G = 'real flows';
  await go('#/nutrition'); const eat = p.locator('[data-act=eat]').first();
  ok(await eat.count() === 1, 'test setup: a meal to mark exists');
  await eat.dblclick(); await p.waitForTimeout(700);
  const sheets = await p.locator('.sheet').count(); ok(sheets === 1, 'double tap on "סמן שאכלתי" opens ONE portion sheet', sheets);
  await p.locator('.sheet [data-act=ok]').first().dblclick(); await p.waitForTimeout(800);
  const n = await p.evaluate(() => Core.entries(Store.today()).length); ok(n === 1 && await p.locator('.sheet').count() === 0, 'double tap on "confirm" → exactly one journal entry, sheet closed', n);
  await go('#/shopping'); await p.fill('#c-add', 'נייר אפייה'); await p.locator('[data-act=cadd]').dblclick(); await p.waitForTimeout(600);
  ok(await p.evaluate(() => Store.load('nutrition').shopping.custom.filter(c => c.text === 'נייר אפייה').length) === 1, 'double tap on "add" → the item is added once');

  await p.waitForTimeout(800); const before = await p.evaluate(() => Store.load('nutrition').shopping.custom.length);
  await p.locator('[data-act=cdel]').first().click(); await p.waitForTimeout(500);
  ok(await p.evaluate(() => Store.load('nutrition').shopping.custom.length) === before - 1, 'a deliberate tap on "מחיקה" (after it has been on screen) still deletes');
  ok(errs.length === 0, 'no page errors', errs.slice(0, 3));
  await b.close();
  const pass = res.filter(r => r.ok).length, fail = res.length - pass;
  res.forEach(r => console.log((r.ok ? 'PASS' : 'FAIL') + ' [' + r.g + '] ' + r.m));
  fs.mkdirSync('dist', { recursive: true }); fs.writeFileSync('dist/e2e_double_tap.json', JSON.stringify(res, null, 1));
  console.log(`double tap e2e: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('double tap e2e crashed in [' + G + ']: ' + (e.stack || e.message).slice(0, 500)); process.exit(1); });
