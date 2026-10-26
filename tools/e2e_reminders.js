/* SLL-21 · In-app reminders with quiet hours — Playwright Chromium, iPhone 13 emulation (NOT Safari), fixed clocks.
   Off by default; due only when the logged data says so (workout not done, meals not marked, water behind pace, weigh-in day);
   nothing during quiet hours (incl. across midnight); "לא היום" hides one reminder for the day; rendering writes nothing; settings
   are saved and recorded in the change log. Usage: node tools/e2e_reminders.js [URL] */
const { chromium, devices } = require('playwright'); const fs = require('fs');
const URL0 = process.argv[2] || 'http://localhost:8096/';
const res = []; let G = ''; const ok = (c, m, i) => res.push({ g: G, ok: !!c, m: m + (i !== undefined && !c ? ' → ' + JSON.stringify(i).slice(0, 260) : '') });
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'he-IL', serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const D = '2026-10-23'; /* a Friday */
  await p.clock.install({ time: new Date(D + 'T19:00:00') });
  const go = async h => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(700); };
  const due = hm => p.evaluate(t => Core.remindersDue(new Date(t)).map(x => x.k), D + 'T' + hm + ':00');
  await p.goto(URL0); await p.waitForTimeout(700); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(700);
  await p.evaluate(() => { const pr = Store.load('profile'); Object.assign(pr, { age: 34, height: 172, weight: 78, startWeight: 78, sex: 'f', experience: 'beginner', onboarded: true, startDate: Store.today() }); Store.save('profile'); });

  G = 'off by default';
  ok(JSON.stringify(await due('19:00')) === '[]' && JSON.stringify(await due('21:00')) === '[]', 'no reminder at all until the user turns them on');
  await go('#/'); ok(await p.locator('[data-reminders]').count() === 0, 'no reminders card on home');

  G = 'settings';
  await go('#/settings'); ok(await p.locator('[data-rem-settings]').count() === 1, 'Settings has "תזכורות בתוך האפליקציה"');
  await p.locator('#rem-on').check(); await p.locator('#rem-g').check(); await p.locator('#rem-g-dow').selectOption('5'); await p.locator('[data-act=remSave]').click(); await p.waitForTimeout(500);
  const rs = await p.evaluate(() => Store.load('profile').reminders);
  ok(rs.on && rs.weigh.on && rs.weigh.dow === 5 && rs.workout.at === '18:00' && rs.quiet.from === '22:00' && rs.quiet.to === '07:00', 'saved: on, weigh-in Friday, defaults for the rest', rs);
  ok(await p.evaluate(() => (Store.load('changelog').items || []).some(x => x.path === 'reminders.on' && x.to === true)), 'recorded in the change log');

  G = 'due only when the data says so';
  const st = await p.evaluate(t => { const pr = Core.dailyProgress(t); return { workout: (pr.tasks.find(x => x.k === 'workout') || {}).v, meals: pr.tasks.filter(x => Core.DAY.includes(x.k)).length }; }, D);
  const d17 = await due('17:00'), d19 = await due('19:00'), d21 = await due('21:00');
  ok(!d17.includes('workout') && (st.workout === 0 ? d19.includes('workout') : !d19.includes('workout')), 'workout: not before the chosen time (18:00); after it only if today has an undone session', { st, d17, d19 });
  ok(!d19.includes('meals') && (st.meals ? d21.includes('meals') : !d21.includes('meals')), 'meals: only after 20:30, and only when planned meals are unmarked', { st, d19, d21 });
  await p.evaluate(t => { const pl = Core.plan(t); Core.DAY.forEach(k => { if (pl[k] && pl[k].rid && !pl[k].off) Core.eatSlot(t, k, 1); }); }, D);
  ok(!(await due('21:00')).includes('meals'), 'after marking the meals, the meals reminder is gone');
  ok(!(await due('08:30')).includes('water'), 'water: not in the first 2 hours after waking (07:00)');
  ok((await due('15:00')).includes('water'), 'water: at 15:00 with nothing logged → behind the pace');
  await p.evaluate(t => Core.setDaily(t, { water: 2500 }), D); ok(!(await due('15:00')).includes('water'), 'after logging enough water → not due');
  ok((await due('09:00')).includes('weigh') && !(await due('07:30')).includes('weigh'), 'weigh-in: on the chosen weekday after the chosen time');
  await p.evaluate(t => { const tt = Store.load('tracking'); tt.measures.push({ id: 'm1', date: t, weight: 77.5 }); Store.save('tracking'); }, D);
  ok(!(await due('09:00')).includes('weigh'), 'after entering today\'s weight → not due');
  ok(JSON.stringify(await due('23:00')) === '[]' && JSON.stringify(await due('01:30')) === '[]', 'quiet hours 22:00–07:00 (across midnight): nothing');
  ok(await p.evaluate(t => { const a = JSON.stringify(Core.remindersDue(new Date(t))); location.hash = '#/nutrition'; return a === JSON.stringify(Core.remindersDue(new Date(t))) && a.length > 2; }, D + 'T21:00:00'), 'deterministic for the same data and clock (non-empty result compared twice)');

  G = 'home card';
  await p.evaluate(t => { Core.setDaily(t, { water: 0 }); }, D);
  const s0 = await p.evaluate(() => JSON.stringify(Object.fromEntries(Object.keys(localStorage).filter(k => k.startsWith('fit30.')).map(k => [k, localStorage.getItem(k)]))));
  await go('#/settings'); await go('#/');
  const ks = await p.locator('[data-reminders] [data-rem]').evaluateAll(a => a.map(x => x.dataset.rem));
  ok(ks.includes('water'), 'at 19:00 the home card shows the due reminders', ks);
  ok(await p.evaluate(() => JSON.stringify(Object.fromEntries(Object.keys(localStorage).filter(k => k.startsWith('fit30.')).map(k => [k, localStorage.getItem(k)])))) === s0, 'showing reminders writes nothing');
  await p.locator('[data-rem=water] [data-act=water]').click(); await p.waitForTimeout(500);
  ok(await p.evaluate(t => Core.daily(t).water, D) === 250, 'the water reminder\'s button adds 0.25 L');
  await p.locator('[data-rem=water] [data-act=remOff]').click(); await p.waitForTimeout(500);
  ok(await p.locator('[data-rem=water]').count() === 0 && await p.evaluate(t => Core.daily(t).remOff.water === true, D), '"לא היום" hides it for the rest of today');
  ok(await p.evaluate(t => Core.remindersDue(new Date(t.replace('T19', 'T20'))).every(x => x.k !== 'water'), D + 'T19:00:00'), '... and it stays hidden later today');
  ok(await p.evaluate(() => Core.remindersDue(new Date('2026-10-24T15:00:00')).some(x => x.k === 'water')), 'the next day starts fresh: "לא היום" applied to one day only');

  ok(errs.length === 0, 'no page errors', errs.slice(0, 3));
  await b.close();
  const pass = res.filter(r => r.ok).length, fail = res.length - pass;
  res.forEach(r => console.log((r.ok ? 'PASS' : 'FAIL') + ' [' + r.g + '] ' + r.m));
  fs.mkdirSync('dist', { recursive: true }); fs.writeFileSync('dist/e2e_reminders.json', JSON.stringify(res, null, 1));
  console.log(`reminders e2e: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('reminders e2e crashed in [' + G + ']: ' + (e.stack || e.message).slice(0, 600)); process.exit(1); });
