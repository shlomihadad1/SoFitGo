/* SLL-13 · One-Day Autopilot — Playwright Chromium, iPhone 13 emulation (NOT Safari). Three proposals for today from what is already
   planned; choosing one changes only today's workout version (30-day program: stored choice used by the start button; personal plan:
   the day's version override) with exact undo; meals, water and steps are never changed; "לא היום" hides it for today.
   Usage: node tools/e2e_autopilot.js [URL] */
const { chromium, devices } = require('playwright'); const fs = require('fs');
const URL0 = process.argv[2] || 'http://localhost:8096/';
const res = []; let G = ''; const ok = (c, m, i) => res.push({ g: G, ok: !!c, m: m + (i !== undefined && !c ? ' → ' + JSON.stringify(i).slice(0, 300) : '') });
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'he-IL', serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const go = async h => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(800); };
  const st = () => p.evaluate(() => JSON.stringify({ n: localStorage.getItem('fit30.nutrition'), p: localStorage.getItem('fit30.profile'), t: localStorage.getItem('fit30.tracking'), pl: localStorage.getItem('fit30.plans') }));
  await p.goto(URL0); await p.waitForTimeout(700); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(700);
  await p.evaluate(() => { const pr = Store.load('profile'); Object.assign(pr, { age: 34, height: 172, weight: 78, startWeight: 78, sex: 'f', experience: 'beginner', onboarded: true, startDate: Store.addDays(Store.today(), -2) }); Store.save('profile'); });
  const n = await p.evaluate(() => { for (let k = 0; k < 7; k++) { const pr = Store.load('profile'); pr.startDate = Store.addDays(Store.today(), -k); Store.save('profile'); const n = Core.todayN(); if (Core.isTraining(n) && Logic.hasVersions(Core.dayDef(n))) return n; } return null; });

  G = '30-day program';
  ok(n != null, 'test setup: today is a training day with versions', n);
  await go('#/'); ok(await p.locator('[data-today-link] a[href="#/today"]').count() === 1, 'the NOW card offers "הצעה ליום שלי"');
  const s0 = await st(); await go('#/today');
  ok(await st() === s0, 'opening the proposals writes nothing');
  const mins = await p.locator('[data-ap]').evaluateAll(a => a.map(x => ({ k: x.dataset.ap, m: +((x.textContent.match(/~(\d+) דק׳/) || [])[1]) })));
  ok(mins.length === 3 && mins[0].k === 'min' && mins[0].m < mins[1].m && mins[1].m < mins[2].m, 'three proposals — minimum < balanced < full (minutes from the real day)', mins);
  ok(await p.locator('[data-ap-same]').count() === 1, 'meals, water and steps are shown as the same in all three');
  await p.locator('[data-act=apGo][data-l=min]').click(); await p.waitForTimeout(500);
  const after = await p.evaluate(() => ({ ver: Core.daily(Store.today()).dayVer, lvl: (Core.daily(Store.today()).autopilot || {}).level, sel: Screens.selectedVersion.v }));
  ok(after.ver === 'min' && after.lvl === 'min' && after.sel === 'min', 'choosing "מינימום" sets today\'s version, and the home start button uses it', after);
  const s1 = JSON.parse(await st()), s0j = JSON.parse(s0);
  ok(s1.n === s0j.n && s1.p === s0j.p && s1.pl === s0j.pl, 'meals, profile and plans are untouched (only today\'s choice in the daily log)');
  await go('#/'); ok(/היום שלי: מינימום/.test(await p.locator('[data-today-link]').textContent()), 'the NOW card shows the choice');
  await go('#/today'); await p.locator('[data-act=apGo][data-l=bal]').click(); await p.waitForTimeout(400); await p.locator('.toast button').first().click(); await p.waitForTimeout(400);
  ok(await p.evaluate(() => Core.daily(Store.today()).dayVer) === 'min', '"ביטול" restores the previous choice exactly');
  await go('#/'); await go('#/today'); await p.locator('[data-act=apNo]').click(); await p.waitForTimeout(600);
  ok(await p.evaluate(() => location.hash) === '#/' && await p.locator('[data-today-link]').count() === 0, '"לא היום" hides the proposal for today');

  G = 'personal plan';
  const pl = await p.evaluate(() => { const pr = Store.load('profile'); pr.startDate = Store.today(); pr.aims = { primary: 'general', secondary: [] }; pr.availability = { days: [0, 1, 2, 3, 4, 5, 6], sessions: 6, prefMin: null, maxMin: 45 }; Store.save('profile');
    Core.setDaily(Store.today(), { autopilot: null, dayVer: null });
    const P = Plans.activate(Plans.create('general_90', Plans.paramsFromProfile(Store.load('profile')), Store.today()), { confirmReplace: true });
    for (let k = 1; k <= 14; k++) { const s = Store.load('plans'); s.list[P.id].start = Store.addDays(Store.today(), -k); Store.save('plans');
      const d = Plans.days(Plans.active()).find(x => x.date === Store.today()); if (d && Plans.isTraining(d) && !['assess', 'active'].includes(d.type)) return { k, n: d.n, type: d.type }; }
    return null; });
  ok(!!pl, 'test setup: a personal plan whose day today is a regular training day', pl);
  await go('#/'); await go('#/today');
  const model = await p.evaluate(() => Screens.today.model());
  ok(model.workout && !model.workout.fixed, 'today\'s plan workout can take a version', model.workout);
  if (model.workout && !model.workout.fixed) {
    const nut0 = await p.evaluate(() => localStorage.getItem('fit30.nutrition'));
    await p.locator('[data-act=apGo][data-l=full]').click(); await p.waitForTimeout(500);
    const v = await p.evaluate(n2 => Plans.dayOf(Plans.active(), n2).version, model.workout.n);
    ok(v === 'long', 'plan day: "מלא" sets the day\'s version to long (the plan\'s own override)', { v, model: model.workout });
    ok(await p.evaluate(() => localStorage.getItem('fit30.nutrition')) === nut0, 'the menu is not changed');
    const pl1 = await p.evaluate(() => localStorage.getItem('fit30.plans')); await p.locator('.toast button').first().click(); await p.waitForTimeout(400);
    ok(await p.evaluate(n2 => Plans.dayOf(Plans.active(), n2).version || 'std', model.workout.n) === model.workout.cur && await p.evaluate(() => localStorage.getItem('fit30.plans')) !== pl1, '"ביטול" restores the plan day\'s version');
  }

  ok(errs.length === 0, 'no page errors', errs.slice(0, 3));
  await b.close();
  const pass = res.filter(r => r.ok).length, fail = res.length - pass;
  res.forEach(r => console.log((r.ok ? 'PASS' : 'FAIL') + ' [' + r.g + '] ' + r.m));
  fs.mkdirSync('dist', { recursive: true }); fs.writeFileSync('dist/e2e_autopilot.json', JSON.stringify(res, null, 1));
  console.log(`autopilot e2e: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('autopilot e2e crashed in [' + G + ']: ' + (e.stack || e.message).slice(0, 600)); process.exit(1); });
