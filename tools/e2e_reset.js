/* SLL-25 · One-Tap Weekly Reset — Playwright Chromium, iPhone 13 emulation (NOT Safari).
   Preview shows exactly what changes; defaults change no plan and no meal; the user's own items are removed only when ticked;
   "usually at home" survives; a pending menu update is applied only when ticked; undo restores the shopping list AND the plan
   exactly (storage comparison); past workouts are never touched. Usage: node tools/e2e_reset.js [URL] */
const { chromium, devices } = require('playwright'); const fs = require('fs');
const URL0 = process.argv[2] || 'http://localhost:8096/';
const res = []; let G = ''; const ok = (c, m, i) => res.push({ g: G, ok: !!c, m: m + (i !== undefined && !c ? ' → ' + JSON.stringify(i).slice(0, 240) : '') });
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'he-IL', serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const go = async h => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(700); };
  const snap = () => p.evaluate(() => JSON.stringify({ n: localStorage.getItem('fit30.nutrition'), p: localStorage.getItem('fit30.plans'), w: localStorage.getItem('fit30.workouts') }));
  await p.goto(URL0); await p.waitForTimeout(700); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(700);
  await p.evaluate(() => { const pr = Store.load('profile'); Object.assign(pr, { age: 34, height: 172, weight: 78, startWeight: 78, sex: 'f', experience: 'beginner', onboarded: true, aims: { primary: 'general', secondary: [] } }); Store.save('profile'); });

  G = 'nothing to reset';
  await go('#/reset'); ok(await p.locator('[data-reset-empty]').count() === 1, 'a fresh start says there is nothing to reset');

  G = 'shopping list';
  await p.evaluate(() => { const nu = Store.load('nutrition'); nu.shopping = { checked: { tomato: Store.today(), onion: Store.today() }, state: { rice: 'home', lemon: 'notfound' }, custom: [{ id: 'c1', text: 'נייר אפייה', done: true }, { id: 'c2', text: 'סבון', done: false }], usual: { salt: Store.today() } }; Store.save('nutrition'); });
  const s0 = await snap(); await go('#/nutrition'); await go('#/reset');
  ok(await snap() === s0, 'opening the preview writes nothing');
  const rows = await p.locator('[data-reset]').evaluateAll(a => a.map(x => ({ k: x.dataset.reset, on: x.querySelector('input').checked, s: x.querySelector('.s').textContent })));
  const mk = rows.find(r => r.k === 'marks'), cd = rows.find(r => r.k === 'cdone');
  ok(mk && mk.on && /4 סימונים/.test(mk.s), 'preview: "clear the marks" with the exact count, pre-ticked', mk);
  ok(cd && !cd.on && /נייר אפייה/.test(cd.s) && !/סבון/.test(cd.s), 'preview: removing bought own items is listed by name and NOT pre-ticked', cd);
  ok(!rows.some(r => r.k === 'menu'), 'no menu item without a personal plan');
  await p.locator('[data-act=resetGo]').click(); await p.waitForTimeout(500);
  let sh = await p.evaluate(() => Store.load('nutrition').shopping);
  ok(!Object.keys(sh.checked).length && !Object.keys(sh.state).length && sh.custom.length === 2 && sh.usual.salt, 'reset with the defaults: marks cleared; own items and "usually at home" kept', sh);
  await p.locator('.toast button').first().click(); await p.waitForTimeout(400);
  ok(await snap() === s0, '"ביטול" restores everything exactly (storage comparison)');
  await go('#/nutrition'); await go('#/reset'); await p.locator('[data-reset-k=cdone]').check(); await p.waitForTimeout(150); await p.locator('[data-act=resetGo]').click(); await p.waitForTimeout(500);
  sh = await p.evaluate(() => Store.load('nutrition').shopping);
  ok(sh.custom.length === 1 && sh.custom[0].text === 'סבון', 'when ticked: only the own item already bought is removed', sh.custom);

  G = 'plan and menu';
  const setup = await p.evaluate(() => { const pr = Store.load('profile'); pr.availability = { days: [0, 1, 2, 3, 4, 5, 6], sessions: 6, prefMin: null, maxMin: 30 }; Store.save('profile');
    const pl = Plans.activate(Plans.create('general_90', Plans.paramsFromProfile(Store.load('profile')), Store.today()));
    const st = Store.load('plans'); st.list[pl.id].start = Store.addDays(Store.today(), -10); Store.save('plans');
    const pr2 = Store.load('profile'); pr2.weight = 70; Store.save('profile'); /* targets move → the plan menu has a pending update */
    return { pending: !!MealPlan.pending(Plans.active()), missed: Plans.days(Plans.active()).filter(d => d.status === 'missed' && d.date >= Store.addDays(Store.today(), -7)).length }; });
  await go('#/nutrition'); await go('#/reset');
  const mn = await p.locator('[data-reset=menu]').count() ? await p.locator('[data-reset=menu] input').isChecked() : null;
  ok(setup.pending ? mn === false : mn === null, 'a pending menu update is offered with its before/after averages, NOT pre-ticked', { setup, mn });
  if (setup.missed) ok(await p.locator('[data-reset-info=missed]').getAttribute('href') === '#/plan', 'missed sessions are shown as a link to the plan screen, not changed here');
  const s1 = await snap(); const logs0 = await p.evaluate(() => JSON.stringify(Store.load('workouts')));
  if (setup.pending) { await p.locator('[data-reset-k=menu]').check(); await p.waitForTimeout(150); }
  await p.locator('[data-act=resetGo]').click(); await p.waitForTimeout(700);
  const ch = await p.evaluate(() => ({ t: (Plans.active().changes || []).filter(c => c.type === 'nutrition').map(c => c.text), still: !!MealPlan.pending(Plans.active()) }));
  if (setup.pending) ok(ch.t.some(t => /איפוס שבועי/.test(t)) && !ch.still, 'when ticked: the menu is updated and recorded in the plan history as "איפוס שבועי"', ch);
  ok(await p.evaluate(() => JSON.stringify(Store.load('workouts'))) === logs0, 'workout history is untouched');
  await p.locator('.toast button').first().click(); await p.waitForTimeout(500);
  ok(await snap() === s1, '"ביטול" restores the plan and the shopping list exactly');

  G = 'entry points';
  await go('#/shopping'); ok(await p.locator('[data-reset-link]').count() === 1, 'reachable from the shopping list');
  await go('#/review'); ok(await p.locator('[data-reset-link]').count() === 1, 'reachable from the weekly review');

  ok(errs.length === 0, 'no page errors', errs.slice(0, 3));
  await b.close();
  const pass = res.filter(r => r.ok).length, fail = res.length - pass;
  res.forEach(r => console.log((r.ok ? 'PASS' : 'FAIL') + ' [' + r.g + '] ' + r.m));
  fs.mkdirSync('dist', { recursive: true }); fs.writeFileSync('dist/e2e_reset.json', JSON.stringify(res, null, 1));
  console.log(`reset e2e: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('reset e2e crashed in [' + G + ']: ' + (e.stack || e.message).slice(0, 900)); process.exit(1); });
