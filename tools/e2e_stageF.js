/* Stage F browser tests (Playwright Chromium, iPhone-13 emulation with a controlled clock — NOT a physical iPhone).
   The adaptive engine end-to-end in the UI: insufficient-data state, proposal card with reasons, approval sheet with the
   exact changes, adapted day marked, undo, and the runner saving per-exercise feedback into the plan log.
   Usage: node tools/e2e_stageF.js [URL] — writes dist/reports/e2e-stageF.json */
const { chromium, devices } = require('playwright'); const fs = require('fs'), path = require('path');
const URL0 = process.argv[2] || 'http://localhost:8096/';
const res = []; let G = ''; const ok = (c, m, info) => res.push({ g: G, ok: !!c, m: m + (info !== undefined && !c ? ' → ' + JSON.stringify(info).slice(0, 300) : '') });
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'he-IL', serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/ERR_|Failed to load resource/.test(m.text())) errs.push(m.text()); if (/no handler/.test(m.text())) errs.push('NOHANDLER ' + m.text()); });
  const T0 = new Date('2026-10-19T08:00:00').getTime(); await p.clock.install({ time: T0 });
  const go = async h => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(300); };
  const at = async date => { await p.clock.setFixedTime(new Date(date + 'T08:00:00').getTime()); await p.reload(); await p.waitForTimeout(400); };
  await p.goto(URL0); await p.waitForTimeout(500);
  await p.evaluate(() => { Store.resetAll(); localStorage.clear(); const pr = Store.load('profile'); Object.assign(pr, { age: 32, height: 187, weight: 85, startWeight: 85, sex: 'm', experience: 'beginner', aims: { primary: 'fat_loss', secondary: [] } }); pr.availability = { days: [1, 3, 5], sessions: 3, maxMin: 45 }; Store.save('profile');
    Plans.activate(Plans.create('general_90', Plans.paramsFromProfile(pr), Store.today())); });
  await p.reload(); await p.waitForTimeout(400);

  G = 'no data yet';
  await go('#/plan'); ok(await p.locator('[data-adapt-card] [data-adapt-info]').count() === 1 && /אין עדיין מספיק נתונים/.test(await p.locator('[data-adapt-card]').innerText()), 'plan screen says there is not enough data (with the count)');
  ok(/לא בינה מלאכותית/.test(await p.locator('[data-adapt-card] details').textContent()), '"how it works" describes a rule system, not AI');

  G = 'runner saves feedback';
  const ses = await p.evaluate(() => { const pl = Plans.active(), t = Plans.days(pl).filter(d => Plans.isTraining(d) && d.type !== 'assess' && d.type !== 'active');
    for (const d0 of t.slice(0, 3)) for (const it of d0.main.filter(x => !x.circuit && typeof x.reps === 'number')) { const l = t.filter(d => d.main.some(x => x.ex === it.ex && !x.circuit)); if (l.length >= 4) return { ex: it.ex, days: l.map(d => ({ n: d.n, date: d.date })) }; } return null; });
  ok(!!ses, 'setup: an exercise that repeats in ≥4 sessions');
  await at(ses.days[0].date);
  await p.evaluate(n => { const pl = Plans.active(), d = Plans.dayOf(pl, n); Run.start(n, d.version || 'std', { id: pl.id, n }); }, ses.days[0].n); await p.locator('.sheet [data-act=go]').click(); await p.waitForTimeout(300);
  for (let i = 0; i < 3; i++) { if (await p.locator('.run [data-a=skipRest]').count()) await p.locator('.run [data-a=skipRest]').click(); await p.locator('.run [data-a=done]').click(); await p.waitForTimeout(60); }
  await p.locator('.run [data-a=exit]').click(); await p.waitForTimeout(200); await p.locator('.sheet [data-act=finish]').click(); await p.waitForTimeout(300);
  ok(await p.locator('.run [data-a=save]').count() === 1, 'workout runner reaches the summary');
  await p.locator(`.run [data-fb="${ses.ex}"][data-v=easy]`).click(); await p.locator('.run [data-r="6"]').click(); await p.locator('.run [data-a=save]').click(); await p.waitForTimeout(400);
  const lg = await p.evaluate(n => Plans.active().log[n], ses.days[0].n);
  ok(lg && lg.feedback && lg.feedback[ses.ex] === 'easy' && lg.rpe === 6 && lg.sets.filter(s => s.done).length >= 1, 'plan log keeps sets, effort and per-exercise feedback');

  ok(await p.evaluate(n => { const lg = Plans.active().log[n], doneEx = new Set(lg.sets.filter(x => x.done).map(x => x.ex)); return !Adapt.proposals().list.some(x => x.rule === 'down' && !doneEx.has(x.target)); }, ses.days[0].n), 'ending a workout early does not mark unreached exercises as failed (regression)');
  G = 'proposal → approve → adapted day → undo';
  const logFull = async (date, n) => { await at(date); await p.evaluate(({ n, ex }) => { const pl = Plans.active(), d = Plans.dayOf(pl, n), sets = []; d.main.concat(d.finisher || []).forEach(it => { for (let k = 1; k <= (it.sets || 1); k++) { const r = { done: true, ex: it.ex, sec: 'main', set: k }; if (typeof it.reps === 'number') r.reps = it.reps; else r.secs = it.sec; sets.push(r); } });
    Plans.logDay(pl.id, n, { status: 'done', rpe: 6, sets, feedback: { [ex]: 'easy' }, source: 'run' }); }, { n, ex: ses.ex }); };
  await logFull(ses.days[0].date, ses.days[0].n); /* the early-ended runner session above is not evidence for an exercise it never reached */
  await at(ses.days[1].date);
  await p.evaluate(({ n, ex }) => { const pl = Plans.active(), d = Plans.dayOf(pl, n), sets = []; d.main.concat(d.finisher || []).forEach(it => { for (let k = 1; k <= (it.sets || 1); k++) { const r = { done: true, ex: it.ex, sec: 'main', set: k }; if (typeof it.reps === 'number') r.reps = it.reps; else r.secs = it.sec; sets.push(r); } });
    Plans.logDay(pl.id, n, { status: 'done', rpe: 6, sets, feedback: { [ex]: 'easy' }, source: 'run' }); }, { n: ses.days[1].n, ex: ses.ex });
  await at(new Date(new Date(ses.days[1].date).getTime() + 864e5).toISOString().slice(0, 10));
  await go('#/'); ok(await p.locator('[data-adapt-card] [data-adapt]').count() >= 1, 'home shows adaptation proposals for the active plan');
  ok(!/ימים שהוחמצו השבוע/.test(await p.locator('main').innerText()), 'home no longer shows classic-program missed days during a plan (bug fixed)');
  const key = await p.evaluate(ex => Adapt.proposals().list.find(x => x.rule === 'up' && x.target === ex).key, ses.ex);
  await p.locator(`[data-adapt-card] [data-act=adaptView][data-k="${key}"]`).click(); await p.waitForTimeout(300);
  if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT + '-sheet.png' });
  const sh = await p.locator('.sheet').innerText(); ok(await p.locator('.sheet [data-adapt-diff] li').count() >= 1 && /רמה|סטים/.test(sh) && /אפשר לבטל/.test(sh), 'approval sheet lists the exact changes and says it can be undone');
  const before = await p.evaluate(() => JSON.stringify(Plans.days(Plans.active()).filter(d => !d.log).map(d => (d.main || []).map(it => [it.ex, it.sets, it.lvl]))));
  await p.locator('.sheet [data-act=ok]').click(); await p.waitForTimeout(400);
  const ch = await p.evaluate(() => Adapt.history()[0].changes[0]);
  await go('#/pday/' + ch.n); ok(await p.locator('[data-adjusted]').count() >= 1, 'adapted plan day shows an "adjusted" marker');
  await go('#/plan'); if (process.env.SHOT) { await p.locator('[data-adapt-card]').scrollIntoViewIfNeeded(); await p.screenshot({ path: process.env.SHOT + '-plan.png' }); }
  ok(await p.locator('[data-adapt-hist=applied]').count() === 1, 'plan screen lists the approved adaptation');
  await p.locator('[data-act=adaptRevert]').click(); await p.waitForTimeout(200); await p.locator('.sheet [data-act=ok]').click(); await p.waitForTimeout(400);
  ok(await p.evaluate(() => JSON.stringify(Plans.days(Plans.active()).filter(d => !d.log).map(d => (d.main || []).map(it => [it.ex, it.sets, it.lvl])))) === before, 'undo restores the future plan exactly');
  ok(await p.locator('[data-adapt-hist=reverted]').count() === 1, 'undo is kept in the history');

  G = 'dismiss & small screens';
  await go('#/'); const k2 = await p.evaluate(() => (Adapt.proposals().list[0] || {}).key);
  if (k2) { await p.locator(`[data-act=adaptView][data-k="${k2}"]`).click(); await p.waitForTimeout(200); await p.locator('.sheet [data-act=no]').click(); await p.waitForTimeout(300); ok(await p.locator(`[data-adapt="${k2}"]`).count() === 0, '"not now" hides the proposal'); }
  else ok(true, 'no second proposal to dismiss');
  const c3 = await b.newContext({ viewport: { width: 320, height: 700 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' }); const q = await c3.newPage();
  await q.clock.install({ time: await p.evaluate(() => Date.now()) }); await q.goto(URL0); await q.evaluate(st => { localStorage.clear(); Object.entries(JSON.parse(st)).forEach(([k, v]) => localStorage.setItem(k, v)); }, await p.evaluate(() => JSON.stringify(Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)])))));
  await q.reload(); await q.waitForTimeout(400); const wide = []; for (const h of ['#/', '#/plan']) { await q.evaluate(x => { location.hash = x; }, h); await q.waitForTimeout(250); if (!(await q.evaluate(() => document.documentElement.scrollWidth <= innerWidth))) wide.push(h); }
  ok(!wide.length, 'adaptation cards fit 320px', wide); await c3.close();

  G = 'general'; ok(!errs.some(e => /NOHANDLER/.test(e)), 'every button has a handler'); ok(errs.length === 0, 'no console errors', errs.slice(0, 3));
  await b.close();
  const pass = res.filter(r => r.ok).length, fail = res.length - pass, groups = {}; res.forEach(r => { groups[r.g] = groups[r.g] || { pass: 0, fail: 0 }; groups[r.g][r.ok ? 'pass' : 'fail']++; });
  fs.mkdirSync(path.join(__dirname, '../dist/reports'), { recursive: true }); fs.writeFileSync(path.join(__dirname, '../dist/reports/e2e-stageF.json'), JSON.stringify({ url: URL0, pass, fail, groups, results: res }, null, 1));
  res.filter(r => !r.ok).forEach(r => console.log('FAIL [' + r.g + '] ' + r.m)); console.log(JSON.stringify(groups)); console.log(`stage F e2e: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('crashed', e.stack); console.log(res.slice(-4).map(r => (r.ok ? 'PASS ' : 'FAIL ') + r.m).join('\n')); process.exit(2); });
