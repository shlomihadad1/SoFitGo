/* SLL-10 · Life Score — Playwright Chromium, iPhone 13 emulation (NOT Safari), fixed clock. Components computed from the last 7 completed
   days against an independent count; missing data is "אין נתון" and left out of the average (not 0); today is excluded; the score is the
   plain average shown with every formula. Usage: node tools/e2e_lifescore.js [URL] */
const { chromium, devices } = require('playwright'); const fs = require('fs');
const URL0 = process.argv[2] || 'http://localhost:8096/';
const res = []; let G = ''; const ok = (c, m, i) => res.push({ g: G, ok: !!c, m: m + (i !== undefined && !c ? ' → ' + JSON.stringify(i).slice(0, 300) : '') });
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'he-IL', serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.clock.install({ time: new Date('2026-10-26T10:00:00') });
  const go = async h => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(800); };
  await p.goto(URL0); await p.waitForTimeout(700); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(700);
  await p.evaluate(() => App.loadChunk('extra.js')); /* friction / life score live in the on-demand chunk (first-load budget) */
  await p.evaluate(() => { const pr = Store.load('profile'); Object.assign(pr, { age: 34, height: 172, weight: 78, startWeight: 78, sex: 'f', experience: 'beginner', onboarded: true, startDate: Store.addDays(Store.today(), -10) }); pr.goals.sleep = 7; Store.save('profile'); });
  G = 'no data';
  let ls = await p.evaluate(() => Core.lifeScore());
  ok(['water', 'sleep'].every(k => ls.comps.find(c => c.k === k).v === null), 'water and sleep without any log → "אין נתון", not 0', ls.comps.map(c => [c.k, c.v]));
  ok(ls.comps.find(c => c.k === 'meals').v === 0, 'meal logging is "of 7 days", so no logged meal is honestly 0%');
  G = 'with data';
  await p.evaluate(() => { const D = i => Store.addDays(Store.today(), -i);
    [1, 2, 3, 4].forEach(i => Core.setDaily(D(i), { sleep: i <= 2 ? 8 : 6 })); /* 4 nights logged, 2 ≥ goal */
    [1, 2, 3].forEach(i => Core.setDaily(D(i), { water: i === 1 ? 5000 : 300 })); /* 3 days logged, 1 at goal */
    [1, 2].forEach(i => { const pl = Core.plan(D(i)); const k = Core.DAY.find(x => pl[x] && pl[x].rid); Core.eatSlot(D(i), k, 1); }); /* meals on 2 days */
    Core.setDaily(Store.today(), { sleep: 9, water: 9000 }); /* today must not count */ });
  ls = await p.evaluate(() => Core.lifeScore());
  const c = k => ls.comps.find(x => x.k === k);
  ok(c('sleep').v === 50 && c('sleep').n === 4, 'sleep: 2 of 4 logged nights ≥ goal → 50 (today ignored)', c('sleep'));
  ok(c('water').v === 33 && c('water').n === 3, 'water: 1 of 3 logged days at goal → 33', c('water'));
  ok(c('meals').v === 29, 'meals: 2 of 7 days → 29', c('meals'));
  const wk = await p.evaluate(() => { let pl = 0, got = 0; for (let i = 1; i <= 7; i++) { const w = (Core.dailyProgress(Store.addDays(Store.today(), -i)).tasks || []).find(x => x.k === 'workout'); if (w) { pl++; got += w.v >= 1 ? 1 : w.v > 0 ? 0.5 : 0; } } return pl ? Math.round(got / pl * 100) : null; });
  ok(c('workouts').v === wk, 'workouts: matches an independent count of planned sessions', { model: c('workouts'), wk });
  const have = ls.comps.filter(x => x.v != null), avg = Math.round(have.reduce((a, x) => a + x.v, 0) / have.length);
  ok(ls.score === avg && ls.used === have.length, 'the score is the plain average of the components that have data', { score: ls.score, avg, used: ls.used });
  G = 'screen';
  await go('#/progress'); ok(+(await p.locator('[data-life-score]').textContent()) === ls.score && await p.locator('[data-life-c]').count() === ls.comps.length && await p.locator('[data-life] [data-src=calc]').count() === 1, 'the tracking screen shows the score, every component with its formula, labelled "לפי הנתונים שלך"');
  ok(/לא מדד רפואי/.test(await p.locator('[data-life]').textContent()), 'says it is not a medical measure');
  ok(errs.length === 0, 'no page errors', errs.slice(0, 3));
  await b.close();
  const pass = res.filter(r => r.ok).length, fail = res.length - pass;
  res.forEach(r => console.log((r.ok ? 'PASS' : 'FAIL') + ' [' + r.g + '] ' + r.m));
  fs.mkdirSync('dist', { recursive: true }); fs.writeFileSync('dist/e2e_lifescore.json', JSON.stringify(res, null, 1));
  console.log(`life score e2e: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('life score e2e crashed in [' + G + ']: ' + (e.stack || e.message).slice(0, 600)); process.exit(1); });
