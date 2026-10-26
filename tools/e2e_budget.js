/* SLL-16 · Budget mode — Playwright Chromium, iPhone 13 emulation (NOT Safari). Relative cost only (1–3; no prices). With budget mode the
   generated menu drops expensive dishes and leans cheaper, while restrictions still hold and calorie targets stay as close as before;
   the setting is saved and recorded; the shopping list shows the cost mix. Usage: node tools/e2e_budget.js [URL] */
const { chromium, devices } = require('playwright'); const fs = require('fs');
const URL0 = process.argv[2] || 'http://localhost:8096/';
const res = []; let G = ''; const ok = (c, m, i) => res.push({ g: G, ok: !!c, m: m + (i !== undefined && !c ? ' → ' + JSON.stringify(i).slice(0, 300) : '') });
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'he-IL', serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const go = async h => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(800); };
  await p.goto(URL0); await p.waitForTimeout(700); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(700);
  await p.evaluate(() => { const pr = Store.load('profile'); Object.assign(pr, { age: 34, height: 172, weight: 78, startWeight: 78, sex: 'f', experience: 'beginner', onboarded: true, aims: { primary: 'general', secondary: [] } }); pr.prefs = Core.normPrefs({ exclude: ['peanuts'] }); Store.save('profile'); });
  const menu = () => p.evaluate(() => { const o = []; for (let i = 0; i < 14; i++) { const d = Store.addDays(Store.today(), i), pl = Core.plan(d), a = MealPlan.autoFor(d);
    Core.DAY.forEach(k => { if (pl[k] && pl[k].rid && !pl[k].off) { const r = Logic.recipe(pl[k].rid); o.push({ c: r.cost || 2, conf: Core.conflicts(r, pl[k].ov).length }); } }); if (a && a.totals && a.target) o.push({ dk: Math.abs(a.totals.k - a.target.k) }); } return o; });
  G = 'menu';
  const off = await menu(); await p.evaluate(() => { const pr = Store.load('profile'); pr.prefs = Core.normPrefs(Object.assign({}, pr.prefs, { budget: true })); Store.save('profile'); }); const on = await menu();
  const avg = a => a.filter(x => x.c).reduce((s, x) => s + x.c, 0) / a.filter(x => x.c).length, n3 = a => a.filter(x => x.c === 3).length, dk = a => { const d = a.filter(x => x.dk != null); return d.reduce((s, x) => s + x.dk, 0) / (d.length || 1); };
  ok(off.filter(x => x.c).length > 20 && on.filter(x => x.c).length > 20, 'test setup: 14 days of generated menus', { off: off.length, on: on.length });
  ok(n3(on) === 0 && avg(on) < avg(off), 'budget mode: no expensive dishes and a lower average relative cost', { avgOff: avg(off).toFixed(2), avgOn: avg(on).toFixed(2), expensiveOff: n3(off), expensiveOn: n3(on) });
  ok(on.every(x => !x.conf), 'restrictions still hold in every dish');
  ok(dk(on) <= dk(off) * 1.25 + 50, 'calorie targets stay about as close as before (avg daily gap)', { off: Math.round(dk(off)), on: Math.round(dk(on)) });
  G = 'setting and list';
  await p.evaluate(() => { const pr = Store.load('profile'); pr.prefs.budget = false; Store.save('profile'); });
  await go('#/settings'); ok(await p.locator('#pf-budget').count() === 1 && !(await p.locator('#pf-budget').isChecked()), 'Settings has "מצב חיסכון", off by default');
  await p.locator('#pf-budget').check(); await p.locator('[data-act=savePrefs]').click(); await p.waitForTimeout(800);
  ok(await p.evaluate(() => Core.normPrefs(Store.load('profile').prefs).budget) === true && await p.evaluate(() => (Store.load('changelog').items || []).some(x => x.path === 'prefs.budget' && x.to === true)), 'saved with the nutrition preferences and recorded in the change log');
  await go('#/shopping'); const mix = await p.locator('[data-cost-mix]').textContent().catch(() => '');
  ok(/זולות/.test(mix) && /יקרות/.test(mix) && await p.locator('[data-budget-on]').count() === 1 && !/₪|\$|מחיר/.test(mix), 'the shopping list shows the relative cost mix (no prices) and that budget mode is on', mix);
  ok(errs.length === 0, 'no page errors', errs.slice(0, 3));
  await b.close();
  const pass = res.filter(r => r.ok).length, fail = res.length - pass;
  res.forEach(r => console.log((r.ok ? 'PASS' : 'FAIL') + ' [' + r.g + '] ' + r.m));
  fs.mkdirSync('dist', { recursive: true }); fs.writeFileSync('dist/e2e_budget.json', JSON.stringify(res, null, 1));
  console.log(`budget e2e: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('budget e2e crashed in [' + G + ']: ' + (e.stack || e.message).slice(0, 600)); process.exit(1); });
