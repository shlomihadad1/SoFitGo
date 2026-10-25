/* Workout session state machine + progress preservation — end to end on the built PWA (Playwright Chromium, iPhone 13 emulation;
   BROWSER=webkit for WebKit). NOT a device: screen lock / OS background suspension are not reproducible here; "interrupted" is
   reproduced by a reload with the last-seen time moved back, which is what a closed / killed app leaves behind.
   Usage: node tools/e2e_run_state.js [URL]  (default http://localhost:8096/) */
const pw = require('playwright'); const { devices } = pw;
const URL0 = process.argv[2] || 'http://localhost:8096/', ENGINE = process.env.BROWSER === 'webkit' ? pw.webkit : pw.chromium;
const res = []; let G = ''; const ok = (c, m, i) => res.push({ g: G, ok: !!c, m: m + (i !== undefined && !c ? ' → ' + JSON.stringify(i).slice(0, 400) : '') });
(async () => {
  const b = await ENGINE.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'he-IL' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const W = ms => p.waitForTimeout(ms);
  const S = () => p.evaluate(() => JSON.parse(localStorage.getItem('fit30.session') || 'null'));
  const state = () => p.evaluate(() => Run.state ? Run.state() : null);
  await p.goto(URL0); await W(700);
  await p.evaluate(() => { localStorage.clear(); Store.resetAll(); const pr = Store.load('profile'); Object.assign(pr, { age: 34, height: 172, weight: 78, startWeight: 78, sex: 'f', experience: 'beginner', onboarded: true, startDate: Store.today() }); Store.save('profile'); });
  await p.reload(); await W(800);

  G = 'first load: the runner is not part of it';
  ok(await p.evaluate(() => !!(window.Run && Run.stub) && !window.RunState), 'initial page has only the small Run stub (workout mode loads on demand)');

  G = 'start → ready → in progress → resting';
  await p.evaluate(() => { location.hash = '#/day/1'; }); await W(500);
  await p.evaluate(() => Run.start(1, 'std')); await W(900);
  ok(await p.evaluate(() => !!(Run.real && window.RunState)), 'Run.start loaded the workout chunk and replaced the stub');
  await p.locator('.sheet [data-act=go]').click(); await W(500);
  ok(await state() === 'ready' && (await S()).stepIdx === 0, 'after the setup sheet: ready');
  await p.locator('.run [data-a=done]').click(); await W(150);
  const st1 = await state(); ok(['resting', 'in_progress'].includes(st1), 'a set done → resting / in progress', st1);
  const idx1 = (await S()).stepIdx;
  await p.evaluate(() => { const b = document.querySelector('.run [data-a=done]'); b.disabled = false; b.click(); b.disabled = false; b.click(); }); await W(150);
  ok((await S()).stepIdx <= idx1 + 1, 'repeated taps complete at most one more set (double-advance guard)', { idx1, now: (await S()).stepIdx });

  G = 'pause / resume / invalid transitions';
  await p.locator('.run-top [data-a=pause]').click(); await W(150); ok(await state() === 'paused', 'pause → paused');
  const a0 = (await S()).activeMs; await W(1200); ok((await S()).activeMs === a0, 'paused: active time does not grow');
  await p.evaluate(() => Run._.act('pause')); await W(100); ok(await state() === 'paused' && (await S()).activeMs === a0, 'pause again is ignored (invalid transition, no change)');
  await p.evaluate(() => Run._.act('skipRest')); await W(100); ok(await state() === 'paused', 'rest_end while paused is ignored');
  await p.locator('.run-top [data-a=resume]').click(); await W(150); ok(['in_progress', 'resting', 'ready'].includes(await state()) && !(await S()).paused, 'resume → running');
  await p.evaluate(() => Run._.act('resume')); await W(100); ok(!(await S()).paused, 'resume while running is ignored');

  G = 'refresh / reopen';
  const before = await S(); await p.reload(); await W(1300);
  const after = await S(); ok(await p.locator('.run').count() === 1 && after.stepIdx === before.stepIdx && JSON.stringify(after.log) === JSON.stringify(before.log), 'reload: the runner reopens at the same step with the same logged sets');
  ok(await state() !== 'interrupted', 'a quick reload is not an interruption');

  G = 'interrupted (app closed while running)';
  /* simulate a killed app: stop this page's runner (no more heartbeats / unload saves), then move the record back in time */
  await p.evaluate(() => { Run.close(); const s = JSON.parse(localStorage.getItem('fit30.session')); s.paused = false; s.hold = null; s.activeMs = 300000; s.lastResume = Date.now() - 2 * 3600e3; s.seenAt = Date.now() - 2 * 3600e3 + 60000; localStorage.setItem('fit30.session', JSON.stringify(s)); });
  await p.reload(); await W(1500);
  const si = await S(); ok(await state() === 'interrupted' && si.paused && si.hold === 'interrupted', 'reopened after 2 h → interrupted (paused at the last-seen time)');
  ok(si.activeMs === 360000, 'active time = time until the app was last seen (5:00 + 1:00), not +2 h', si.activeMs);
  ok(/6:0\d/.test(await p.locator('[data-el]').innerText()) && await p.locator('[data-run-interrupted]').count() === 1, 'timer shows 6:0x and the screen explains the interruption');
  ok(JSON.stringify(si.log) === JSON.stringify(after.log), 'no set was marked done by the interruption');
  await p.locator('[data-run-interrupted] [data-a=resume]').click(); await W(200); ok(['in_progress', 'resting', 'ready'].includes(await state()) && !(await S()).hold, 'continue → running again');

  G = 'offline during the workout';
  await ctx.setOffline(true); await p.locator('.run [data-a=done]').click(); await W(300);
  ok(Object.keys((await S()).log).length >= Object.keys(si.log).length + 1, 'offline: the set is saved on the device');
  G = 'completion (once) and abandonment';
  await p.locator('.run [data-a=exit]').click(); await W(300); await p.locator('.sheet [data-act=finish]').click(); await W(300);
  ok(await state() === 'completed', 'finish → completed (summary)');
  await p.evaluate(() => Run._.act('done')); await W(100); ok(await state() === 'completed', 'set_done after completion is ignored');
  await p.evaluate(() => { const b = document.querySelector('.run [data-a=save]'); b.click(); b.click(); }); await W(500);
  const w = await p.evaluate(() => Store.load('workouts').days[1]); ok(w && w.status && !(await S()), 'saved once (offline, on the device); the session record is removed');
  ok(await p.evaluate(() => document.querySelectorAll('.toast').length) <= 1, 'one confirmation only');
  await ctx.setOffline(false);
  await p.evaluate(() => Run.start(2, 'std')); await W(700); if (await p.locator('.sheet [data-act=go]').count()) await p.locator('.sheet [data-act=go]').click(); await W(300);
  await p.locator('.run [data-a=done]').click(); await W(200); await p.locator('.run [data-a=exit]').click(); await W(300); await p.locator('.sheet [data-act=discard]').click(); await W(300); await p.locator('.sheet [data-act=ok]').click(); await W(400);
  ok(!(await S()) && !(await p.evaluate(() => Store.load('workouts').days[2])) && await state() === 'not_started', 'discard → abandoned: record removed, nothing logged');

  G = 'workout mode never loaded and the network is gone';
  { const c2 = await b.newContext({ ...devices['iPhone 13'], locale: 'he-IL', serviceWorkers: 'block' }); const q = await c2.newPage(); const e2 = []; q.on('pageerror', e => e2.push(e.message));
    await q.goto(URL0); await q.waitForTimeout(700); await q.evaluate(() => { const pr = Store.load('profile'); Object.assign(pr, { age: 30, height: 170, weight: 70, sex: 'm', experience: 'beginner', onboarded: true, startDate: Store.today() }); Store.save('profile'); });
    await c2.setOffline(true); await q.evaluate(() => Run.start(1, 'std')); await q.waitForTimeout(800);
    ok(/חיבור/.test(await q.evaluate(() => (document.querySelector('.toast') || {}).textContent || '')) && e2.length === 0, 'clear message, no crash (online once, the service worker keeps it for offline use)');
    await c2.close(); }
  ok(errs.length === 0, 'no page errors', errs.slice(0, 3));
  await b.close();
  let pass = 0, fail = 0; for (const r of res) { console.log(`${r.ok ? 'PASS' : 'FAIL'} [${r.g}] ${r.m}`); r.ok ? pass++ : fail++; }
  console.log(`run state e2e${process.env.BROWSER === 'webkit' ? ' (webkit)' : ''}: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { res.forEach(r => console.log((r.ok ? 'PASS ' : 'FAIL ') + '[' + r.g + '] ' + r.m)); console.error('run state e2e crashed in [' + G + ']: ' + e.message.split('\n')[0]); process.exit(2); });
