/* SLL-06 / SLL-11 / SLL-29 · Patterns and experiments — Playwright Chromium, iPhone 13 emulation (NOT Safari), fixed clock.
   Patterns are off until consent; with data they show both groups and their sizes, call a difference clear only with enough days, always
   say "correlation, not proof", and offer one constructive step. Experiments only count (never change anything), end on time or by the
   user, and keep the user's decision. Usage: node tools/e2e_patterns.js [URL] */
const { chromium, devices } = require('playwright'); const fs = require('fs');
const URL0 = process.argv[2] || 'http://localhost:8096/';
const res = []; let G = ''; const ok = (c, m, i) => res.push({ g: G, ok: !!c, m: m + (i !== undefined && !c ? ' → ' + JSON.stringify(i).slice(0, 300) : '') });
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'he-IL', serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.clock.install({ time: new Date('2026-10-26T10:00:00') });
  const go = async h => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(800); };
  await p.goto(URL0); await p.waitForTimeout(700); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(700);
  await p.evaluate(() => { const pr = Store.load('profile'); Object.assign(pr, { age: 34, height: 172, weight: 78, startWeight: 78, sex: 'f', experience: 'beginner', onboarded: true, aims: { primary: 'general', secondary: [] } }); pr.goals.sleep = 7; pr.availability = { days: [0, 1, 2, 3, 4, 5, 6], sessions: 6, prefMin: null, maxMin: 30 }; Store.save('profile');
    const P = Plans.activate(Plans.create('general_90', Plans.paramsFromProfile(Store.load('profile')), Store.today())); const s = Store.load('plans'); s.list[P.id].start = Store.addDays(Store.today(), -45); Store.save('plans'); });

  G = 'consent';
  await go('#/progress'); ok(await p.locator('[data-patterns-link]').count() === 1 && await p.locator('[data-experiments-link]').count() === 1, 'the tracking screen links to patterns and experiments');
  await go('#/patterns'); ok(await p.locator('[data-pat]').count() === 0 && !(await p.locator('#pat-on').isChecked()), 'off until the user turns it on — nothing is shown');
  await p.locator('#pat-on').check(); await p.waitForTimeout(500);
  ok(await p.evaluate(() => Store.load('profile').patterns.consent) === true && await p.locator('[data-pat][data-pat-state=little]').count() === 2, 'on, with no data: "not enough data" for both patterns, with the counts');

  G = 'a clear pattern';
  const seed = await p.evaluate(() => { const P = Plans.active(); let A = 0, B = 0;
    for (let i = 1; i <= 40; i++) { const d = Store.addDays(Store.today(), -i), day = Plans.days(P).find(x => x.date === d && Plans.isTraining(x)); const good = i % 2 === 0;
      Core.setDaily(d, { sleep: good ? 8 : 5 }); if (day && good && !['assess'].includes(day.type)) { try { Plans.logDay(P.id, day.n, { status: 'done', version: 'std', date: d, sets: [] }); } catch (e) { } } }
    return true; });
  const indep = await p.evaluate(() => { const A = [], B = []; for (let i = 1; i <= 56; i++) { const d = Store.addDays(Store.today(), -i), w = (Core.dailyProgress(d).tasks || []).find(x => x.k === 'workout'); if (!w) continue; const v = w.v >= 1 ? 1 : w.v > 0 ? 0.5 : 0, s = Core.daily(d).sleep; if (s >= 7) A.push(v); else if (s > 0) B.push(v); }
    const pc = a => Math.round(a.reduce((x, y) => x + y, 0) / a.length * 100); return { nA: A.length, nB: B.length, a: pc(A), b: pc(B) }; });
  const m = await p.evaluate(() => Screens.patterns.compute().find(x => x.k === 'sleep'));
  ok(m.nA === indep.nA && m.nB === indep.nB && m.a === indep.a && m.b === indep.b, 'sleep pattern = an independent count of both groups', { m, indep });
  ok(m.clear && m.a > m.b && m.nA >= 8 && m.nB >= 8, 'enough days and a big difference → "clear"', m);
  await go('#/progress'); await go('#/patterns');
  const card = await p.locator('[data-pat=sleep]').textContent();
  ok(/מתאם, לא הוכחה/.test(card) && new RegExp(`${m.nA} ימים`).test(card) && new RegExp(`${m.nB} ימים`).test(card), 'the card shows both group sizes and says "correlation, not proof"');
  ok(await p.locator('[data-pat=sleep] [data-pat-step] a[href="#/experiments"]').count() === 1, 'one constructive next step: check it with an experiment');
  ok(await p.locator('[data-pat=water][data-pat-state=little]').count() === 1, 'water without data stays "not enough data"');
  await p.locator('#pat-on').uncheck(); await p.waitForTimeout(400);
  ok(await p.locator('[data-pat]').count() === 0 && await p.evaluate(() => (Store.load('changelog').items || []).some(x => x.path === 'patterns.consent' && x.to === false)), 'turning it off hides everything, and the change is in the log');

  G = 'experiments';
  await go('#/experiments'); const before = await p.evaluate(() => JSON.stringify({ n: localStorage.getItem('fit30.nutrition'), t: localStorage.getItem('fit30.tracking'), pl: localStorage.getItem('fit30.plans') }));
  await p.locator('#exp-ch').selectOption('sleep'); await p.locator('#exp-days').selectOption('7'); await p.locator('[data-act=expGo]').click(); await p.waitForTimeout(500);
  ok(await p.locator('[data-exp-current=sleep]').count() === 1 && /יום 1 מתוך 7/.test(await p.locator('[data-exp-current]').textContent()), 'started: one experiment, day 1 of 7');
  ok(await p.evaluate(() => JSON.stringify({ n: localStorage.getItem('fit30.nutrition'), t: localStorage.getItem('fit30.tracking'), pl: localStorage.getItem('fit30.plans') })) === before, 'starting changes nothing in the plan, menu or log');
  ok(await p.locator('[data-exp-new]').count() === 0, 'only one experiment at a time');
  await p.evaluate(() => { const pr = Store.load('profile'); pr.experiments.current.start = Store.addDays(Store.today(), -8); Store.save('profile'); });
  await go('#/progress'); await go('#/experiments');
  const ev = await p.evaluate(() => Screens.experiments.eval(Store.load('profile').experiments.current));
  ok(await p.locator('[data-exp-over]').count() === 1 && ev.over && ev.adh.n === 7, 'after 7 days: over, with adherence counted from the log', ev.adh);
  await p.locator('[data-act=expEnd][data-d=keep]').click(); await p.waitForTimeout(500);
  const h = await p.evaluate(() => Store.load('profile').experiments);
  ok(!h.current && h.history.length === 1 && h.history[0].decision === 'keep' && h.history[0].now === ev.now.p && h.history[0].base === ev.base.p, 'the user decides; the decision and the numbers are kept in the history', h.history[0]);
  ok(await p.locator('[data-exp-history]').count() === 1 && await p.locator('[data-exp-new]').count() === 1, 'history shown; a new experiment can start');
  ok(errs.length === 0, 'no page errors', errs.slice(0, 3));
  await b.close();
  const pass = res.filter(r => r.ok).length, fail = res.length - pass;
  res.forEach(r => console.log((r.ok ? 'PASS' : 'FAIL') + ' [' + r.g + '] ' + r.m));
  fs.mkdirSync('dist', { recursive: true }); fs.writeFileSync('dist/e2e_patterns.json', JSON.stringify(res, null, 1));
  console.log(`patterns e2e: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('patterns e2e crashed in [' + G + ']: ' + (e.stack || e.message).slice(0, 600)); process.exit(1); });
