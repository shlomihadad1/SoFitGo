/* RC5 · Fridge-to-Meal (first slice) — Playwright Chromium, iPhone 13 emulation (NOT Safari).
   Ranking by missing ingredients (food ids), "without shopping", restrictions respected, equipment filters, persistence.
   Usage: node tools/e2e_fridge.js [URL] */
const { chromium, devices } = require('playwright'); const fs = require('fs');
const URL0 = process.argv[2] || 'http://localhost:8096/';
const res = []; let G = ''; const ok = (c, m, i) => res.push({ g: G, ok: !!c, m: m + (i !== undefined && !c ? ' → ' + JSON.stringify(i).slice(0, 240) : '') });
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'he-IL', serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const go = async h => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(600); };
  await p.goto(URL0); await p.waitForTimeout(700); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(700);
  G = 'entry and ranking';
  await p.evaluate(() => { const pr = Store.load('profile'); Object.assign(pr, { age: 34, height: 172, weight: 78, startWeight: 78, sex: 'f', experience: 'beginner', onboarded: true }); Store.save('profile'); }); /* setup: a profile, so the nutrition screen shows the day's menu */
  await go('#/nutrition'); ok(await p.locator('[data-fridge-link]').count() === 1 && await p.locator('[data-shop-link]').count() === 1, 'entry point on the nutrition screen, next to the shopping list');
  await go('#/fridge'); ok(await p.locator('[data-act=fh]').count() > 30, 'ingredient chips from the app\'s food database');
  const target = await p.evaluate(() => { const r = NUTRI.RECIPES.find(x => !x.est && !Core.conflicts(x, null).length && Screens.fridge.needs(x).size === 0 && x.ing.length >= 4); return { id: r.id, foods: [...new Set(r.ing.map(i => i.f))].filter(f => !['oil', 'ghee', 'olive_oil'].includes(f)) }; });
  for (const f of target.foods) { await p.locator(`[data-act=fh][data-f="${f}"]`).click(); await p.waitForTimeout(200); }
  const first = await p.locator('[data-fr-recipe]').first().getAttribute('data-missing');
  ok(first === '0' && await p.locator(`[data-fr-recipe="${target.id}"][data-missing="0"]`).count() === 1, 'a recipe whose ingredients were all selected is offered with nothing missing', target);
  const miss = await p.locator('[data-fr-recipe]').evaluateAll(a => a.map(x => +x.dataset.missing)); ok(miss.every((v, i) => !i || v >= miss[i - 1]), 'results sorted by fewest missing ingredients', miss);
  await p.locator('[data-act=fns]').click(); await p.waitForTimeout(300);
  ok((await p.locator('[data-fr-recipe]').evaluateAll(a => a.map(x => x.dataset.missing))).every(v => v === '0'), '"רק בלי קניות" shows only complete recipes');
  G = 'rules';
  const r1 = await p.evaluate(have => { const all = Screens.fridge.rank(have, {}); return { n: all.length, restaurant: all.some(x => x.r.est) }; }, target.foods);
  ok(!r1.restaurant, 'restaurant estimates are never offered for cooking');
  const ovenOnly = await p.evaluate(() => NUTRI.RECIPES.filter(r => Screens.fridge.needs(r).has('oven')).map(r => r.id));
  const altOk = await p.evaluate(() => Screens.fridge.needs({ equip: ['תנור או מחבת'] }).size === 0 && Screens.fridge.needs({ equip: ['תנור/מחבת פסים/מחבת'] }).size === 0 && Screens.fridge.needs({ equip: ['תנור'] }).has('oven'));
  ok(altOk, 'equipment: "תנור או מחבת" does not require an oven; "תנור" does');
  const hidden = await p.evaluate(ids => { const have = Object.keys(NUTRI.FOODS); const a = Screens.fridge.rank(have, { noOven: true }).map(x => x.r.id); return ids.filter(id => a.includes(id)); }, ovenOnly);
  ok(ovenOnly.length > 0 && hidden.length === 0, '"אין תנור" hides oven-only recipes', { ovenOnly: ovenOnly.length, hidden });
  await p.evaluate(() => { const pr = Store.load('profile'); pr.prefs = Object.assign({}, pr.prefs, { egg: false }); Store.save('profile'); });
  const eggs = await p.evaluate(() => Screens.fridge.rank(Object.keys(NUTRI.FOODS), {}).filter(x => x.r.ing.some(i => i.f === 'egg' || i.f === 'egg_white') && Core.conflicts(x.r, null).length).length);
  ok(eggs === 0, 'with "no eggs" set, no offered recipe conflicts with it');
  G = 'persistence';
  await p.reload(); await p.waitForTimeout(800); await go('#/fridge');
  ok(await p.locator('[data-act=fh][aria-pressed=true]').count() === target.foods.length, 'selection persists after reload');
  await p.locator('[data-act=fclr]').click(); await p.waitForTimeout(300); ok(await p.locator('[data-act=fh][aria-pressed=true]').count() === 0, 'clear removes the selection');
  ok(errs.length === 0, 'no page errors', errs.slice(0, 3));
  await b.close(); const pass = res.filter(r => r.ok).length, fail = res.length - pass;
  fs.mkdirSync('dist/reports', { recursive: true }); fs.writeFileSync('dist/reports/e2e-fridge.json', JSON.stringify({ url: URL0, at: new Date().toISOString(), pass, fail, results: res }, null, 1));
  res.forEach(r => console.log((r.ok ? 'PASS ' : 'FAIL ') + '[' + r.g + '] ' + r.m)); console.log(`fridge e2e: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { res.forEach(r => console.log((r.ok ? 'PASS ' : 'FAIL ') + '[' + r.g + '] ' + r.m)); console.error('fridge e2e crashed in [' + G + ']: ' + e.message.split('\n')[0]); process.exit(2); });
