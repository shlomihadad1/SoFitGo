/* SLL-02 · Minimum Mode — Playwright Chromium, iPhone 13 emulation (NOT Safari). The "min" version is built only from the day's own
   exercises (≤2, 1 set, easy level, quick warm-up / cool-down), is shorter than "short", is never offered on test / recovery days,
   works for the 30-day program and for personal plans, and is always logged as PARTIAL ("done" cannot be chosen).
   Usage: node tools/e2e_minimum.js [URL] */
const { chromium, devices } = require('playwright'); const fs = require('fs');
const URL0 = process.argv[2] || 'http://localhost:8096/';
const res = []; let G = ''; const ok = (c, m, i) => res.push({ g: G, ok: !!c, m: m + (i !== undefined && !c ? ' → ' + JSON.stringify(i).slice(0, 300) : '') });
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'he-IL', serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const go = async h => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(700); };
  await p.goto(URL0); await p.waitForTimeout(700); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(700);
  await p.evaluate(() => { const pr = Store.load('profile'); Object.assign(pr, { age: 34, height: 172, weight: 78, startWeight: 78, sex: 'f', experience: 'beginner', onboarded: true, startDate: Store.today() }); Store.save('profile'); });

  G = '30-day program: built from the day only';
  const prog = await p.evaluate(() => PROGRAM.DAYS.map(d => { if (!Logic.hasVersions(d)) return { day: d.day, none: true };
    const own = new Set([].concat(d.main || [], d.short || []).map(x => x.ex)), m = Logic.versionParts(d, 'min');
    return { day: d.day, n: m.main.length, sets1: m.main.every(x => x.sets === 1), easy: m.main.every(x => x.ex === 'brisk_walk' || x.lvl === 'easy'), own: m.main.every(x => own.has(x.ex)),
      min: Logic.estimateMinutes(d, 'min'), short: Logic.estimateMinutes(d, 'short') }; }));
  const withV = prog.filter(x => !x.none);
  ok(withV.length > 0 && withV.every(x => x.n >= 1 && x.n <= 2 && x.sets1 && x.own), `every day with versions: 1–2 of the day's own exercises, 1 set each (${withV.length} days)`, withV.filter(x => !(x.n >= 1 && x.n <= 2 && x.sets1 && x.own)));
  ok(withV.every(x => x.easy), 'easy level for every exercise');
  ok(withV.every(x => x.min < x.short && x.min <= 10), 'always shorter than the short version, at most ~10 minutes', withV.map(x => [x.day, x.min, x.short]));
  ok(await p.evaluate(() => !Logic.hasVersions({ main: [], type: 'rest' }) && Logic.versionParts(PROGRAM.DAYS[0], 'test').warm !== undefined), 'rest days have no versions; the test protocol is separate');

  G = 'offered in the version picker';
  await go('#/'); const seg = await p.locator('[data-v=min]').first().textContent().catch(() => '');
  ok(/מינימום/.test(seg) && /דק׳/.test(seg), 'home offers "מינימום" with its estimated minutes', seg);

  G = 'the "5 minutes" shortcut and Plan B';
  { const T = await p.evaluate(() => Store.today());
    const chip = hm => p.evaluate(t => { const c = Screens.nowShortcuts(t.slice(0, 10), new Date(t)).find(x => x.k === 'five'); return c ? (c.html.match(/href="([^"]+)"/) || [])[1] : null; }, T + 'T' + hm + ':00');
    const wv = await p.evaluate(t => (Core.dailyProgress(t).tasks.find(x => x.k === 'workout') || {}).v, T);
    ok(wv === 0 && (await chip('10:00')) === null && /^#\/day\/\d+$/.test(await chip('17:30') || ''), 'today\'s workout not done: no chip at 10:00, "יש לי 5 דקות" from 17:00 linking to today\'s workout', { wv, at10: await chip('10:00'), at1730: await chip('17:30') });
    await go('#/planb'); ok(/מינימום/.test(await p.locator('[data-planb=time]').first().textContent()), 'Plan B "אין לי זמן" points to the minimum version'); }
  G = 'always logged as partial';
  const n = await p.evaluate(() => Core.clampDay(Core.todayN()));
  await p.evaluate(nn => { Run.start(nn, 'min'); }, n); await p.locator('.sheet [data-act=go]').click({ timeout: 8000 }); await p.waitForTimeout(900);
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('fit30.session')); for (let i = 0; i < s.total; i++) s.log[i] = { done: true }; localStorage.setItem('fit30.session', JSON.stringify(s)); });
  await p.locator('.run [data-a=exit]').click(); await p.waitForTimeout(500); await p.locator('.sheet [data-act=finish]').click(); await p.waitForTimeout(900);
  const opts = await p.locator('#sm-st option').evaluateAll(a => a.map(x => x.value));
  ok(JSON.stringify(opts) === '["partial"]' && await p.locator('[data-min-note]').count() === 1, 'summary: only "הושלם חלקית" can be chosen, with the reason', opts);
  await p.locator('[data-a=save]').click(); await p.waitForTimeout(900);
  const lg = await p.evaluate(nn => Store.load('workouts').days[nn], n);
  ok(lg && lg.status === 'partial' && lg.version === 'min', 'saved as partial, version min', lg && { st: lg.status, v: lg.version });
  ok(await p.evaluate(t => (Core.dailyProgress(t).tasks.find(x => x.k === 'workout') || {}).v, await p.evaluate(() => Store.today())) === 0.5, 'today counts it as half a workout (not a miss, not a full session)');

  G = 'personal plans';
  const pl = await p.evaluate(() => { const pr = Store.load('profile'); pr.aims = { primary: 'general', secondary: [] }; pr.availability = { days: [0, 1, 2, 3, 4, 5, 6], sessions: 6, prefMin: null, maxMin: 30 }; Store.save('profile');
    const P = Plans.activate(Plans.create('general_90', Plans.paramsFromProfile(Store.load('profile')), Store.today()), { confirmReplace: true });
    const d = Plans.days(P).find(x => Plans.isTraining(x) && !['assess', 'active'].includes(x.type) && x.date > Store.today()); const std = Plans.runDef(P.id, d.n);
    Plans.setVersion(P.id, d.n, 'min'); const mn = Plans.runDef(P.id, d.n), steps = Logic.buildSteps(mn, 'min').filter(s => s.sec === 'main');
    let assessErr = null; const a = Plans.days(P).find(x => x.type === 'assess' && x.date >= Store.today()); if (a) { try { Plans.setVersion(P.id, a.n, 'min'); } catch (e) { assessErr = e.message; } }
    return { stdMain: std.main.length, minMain: mn.main.length, sets1: mn.main.every(x => x.sets === 1), own: mn.main.every(x => std.main.some(y => y.ex === x.ex)), steps: steps.length, assess: !!a, assessErr }; });
  ok(pl.minMain >= 1 && pl.minMain <= 2 && pl.sets1 && pl.own && pl.steps === pl.minMain, 'a plan day in "min": 1–2 of its own exercises, 1 set, and not reduced twice', pl);
  ok(!pl.assess || !!pl.assessErr, 'an assessment day cannot be set to minimum', pl);

  ok(errs.length === 0, 'no page errors', errs.slice(0, 3));
  await b.close();
  const pass = res.filter(r => r.ok).length, fail = res.length - pass;
  res.forEach(r => console.log((r.ok ? 'PASS' : 'FAIL') + ' [' + r.g + '] ' + r.m));
  fs.mkdirSync('dist', { recursive: true }); fs.writeFileSync('dist/e2e_minimum.json', JSON.stringify(res, null, 1));
  console.log(`minimum e2e: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('minimum e2e crashed in [' + G + ']: ' + (e.stack || e.message).slice(0, 600)); process.exit(1); });
