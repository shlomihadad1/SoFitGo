/* SLL-12 · Friction Radar — Playwright Chromium, iPhone 13 emulation (NOT Safari), fixed clock. Each rule fires only with enough
   data and shows its numbers; one suggestion at a time; "לא רלוונטי" hides it for 30 days; nothing changes automatically.
   Usage: node tools/e2e_friction.js [URL] */
const { chromium, devices } = require('playwright'); const fs = require('fs');
const URL0 = process.argv[2] || 'http://localhost:8096/';
const res = []; let G = ''; const ok = (c, m, i) => res.push({ g: G, ok: !!c, m: m + (i !== undefined && !c ? ' → ' + JSON.stringify(i).slice(0, 300) : '') });
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'he-IL', serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.clock.install({ time: new Date('2026-10-26T10:00:00') });
  const go = async h => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(700); };
  const fr = () => p.evaluate(() => Core.friction().map(x => x.k));
  await p.goto(URL0); await p.waitForTimeout(700); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(700);
  await p.evaluate(() => App.loadChunk('extra.js')); /* friction / life score live in the on-demand chunk (first-load budget) */
  await p.evaluate(() => { const pr = Store.load('profile'); Object.assign(pr, { age: 34, height: 172, weight: 78, startWeight: 78, sex: 'f', experience: 'beginner', onboarded: true, startDate: Store.addDays(Store.today(), -20) }); Store.save('profile'); });

  G = 'no data, no suggestion';
  ok(JSON.stringify(await fr()) === '[]', 'a new user gets no suggestion');
  await go('#/progress'); ok(await p.locator('[data-friction]').count() === 0, 'no card on the tracking screen');

  G = 'water';
  await p.evaluate(() => { for (let i = 1; i <= 4; i++) Core.setDaily(Store.addDays(Store.today(), -i), { water: 500 }); });
  ok(!(await fr()).includes('water'), '4 low days only → below the minimum of data, no suggestion');
  await p.evaluate(() => Core.setDaily(Store.addDays(Store.today(), -5), { water: 400 }));
  ok((await fr()).includes('water'), '5 of the last 7 logged days under half the goal → water suggestion');
  await p.evaluate(() => { const pr = Store.load('profile'); pr.reminders = { on: true, water: { on: true } }; Store.save('profile'); });
  ok(!(await fr()).includes('water'), 'with the water reminder already on → no suggestion');
  await p.evaluate(() => { const pr = Store.load('profile'); pr.reminders = { on: false }; Store.save('profile'); });

  G = 'meal slot';
  const slot = await p.evaluate(() => { const pl = Core.plan(Store.today()); return Core.DAY.find(k => pl[k] && pl[k].rid && !pl[k].off) ; });
  await p.evaluate(() => { for (let i = 1; i <= 9; i++) { const d = Store.addDays(Store.today(), -i), pl = Core.plan(d); const ks = Core.DAY.filter(k => pl[k] && pl[k].rid && !pl[k].off); ks.slice(1).forEach(k => Core.eatSlot(d, k, 1)); } });
  const ks = await fr(); ok(ks.includes('slot:' + slot), `a planned meal unmarked on ≥8 of the days with logging → suggestion for that meal (${slot})`, ks);

  G = 'one at a time, dismissable';
  await go('#/nutrition'); await go('#/progress');
  ok(await p.locator('[data-friction]').count() === 1 && /למה:/.test(await p.locator('[data-friction-why]').textContent()), 'exactly one card, with its reason and numbers');
  const first = await p.locator('[data-friction]').getAttribute('data-friction');
  const before = await p.evaluate(() => JSON.stringify({ p: localStorage.getItem('fit30.profile'), n: localStorage.getItem('fit30.nutrition'), pl: localStorage.getItem('fit30.plans') }));
  await p.locator('[data-act=frOff]').click(); await p.waitForTimeout(500);
  ok(await p.locator('[data-friction]').getAttribute('data-friction') !== first, '"לא רלוונטי" → the next suggestion (or none) is shown');
  ok(await p.evaluate(() => JSON.stringify({ p: localStorage.getItem('fit30.profile'), n: localStorage.getItem('fit30.nutrition'), pl: localStorage.getItem('fit30.plans') })) === before, 'dismissing changes no setting, meal or plan');
  ok(await p.evaluate(k => !Core.friction(Store.addDays(Store.today(), 10)).some(x => x.k === k) && !!(Store.load('meta').frictionOff || {})[k], first), 'hidden for 30 days (stored with its date on this device)');

  G = 'weekday';
  const wk = await p.evaluate(() => { const pr = Store.load('profile'); pr.aims = { primary: 'general', secondary: [] }; pr.availability = { days: [1, 3, 5], sessions: 3, prefMin: null, maxMin: 30 }; Store.save('profile');
    const pl = Plans.activate(Plans.create('general_90', Plans.paramsFromProfile(Store.load('profile')), Store.today())); const s = Store.load('plans'); s.list[pl.id].start = Store.addDays(Store.today(), -27); Store.save('plans');
    const by = {}; Plans.days(Plans.active()).filter(d => Plans.isTraining(d) && d.date < Store.today() && d.date >= Store.addDays(Store.today(), -28)).forEach(d => { const w = new Date(d.date + 'T12:00:00').getDay(); by[w] = by[w] || { n: 0, miss: 0 }; by[w].n++; if (d.status === 'missed') by[w].miss++; }); return by; });
  const expect = Object.keys(wk).filter(k => wk[k].miss >= 2 && wk[k].miss / wk[k].n >= 0.5);
  const got = (await fr()).filter(k => k.startsWith('weekday:'));
  ok(expect.length >= 1, 'test setup: the plan has a weekday with repeated missed sessions', wk);
  ok(expect.length ? got.length === 1 && expect.includes(got[0].split(':')[1]) : got.length === 0, 'weekday rule matches an independent count of missed sessions per weekday', { wk, got });

  ok(errs.length === 0, 'no page errors', errs.slice(0, 3));
  await b.close();
  const pass = res.filter(r => r.ok).length, fail = res.length - pass;
  res.forEach(r => console.log((r.ok ? 'PASS' : 'FAIL') + ' [' + r.g + '] ' + r.m));
  fs.mkdirSync('dist', { recursive: true }); fs.writeFileSync('dist/e2e_friction.json', JSON.stringify(res, null, 1));
  console.log(`friction e2e: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('friction e2e crashed in [' + G + ']: ' + (e.stack || e.message).slice(0, 500)); process.exit(1); });
