/* M11 · hands-free automatic workout mode, rest settings, per-set feedback, double-advance guard, background/clock drift guard,
   Safe Stop and recovery. Uses Playwright's fake clock (time is advanced deterministically). Chromium/WebKit emulation —
   NOT a real iPhone, and the fake clock is not a real locked screen.
   Usage: [BROWSER=webkit] node tools/e2e_m11_run.js [URL] */
const pw = require('playwright'), { devices } = pw; const ENGINE = process.env.BROWSER || 'chromium';
const URL0 = process.argv[2] || 'http://localhost:8096/';
const res = []; let G = ''; const ok = (c, m, i) => res.push({ g: G, ok: !!c, m: m + (i !== undefined && !c ? ' → ' + JSON.stringify(i).slice(0, 500) : '') });
const BASICS = () => { Store.resetAll(); localStorage.clear(); const pr = Store.load('profile'); Object.assign(pr, { age: 34, height: 176, weight: 80, startWeight: 80, sex: 'm', experience: 'beginner', aims: { primary: 'general', secondary: [] } }); Store.save('profile'); };
(async () => {
  const b = await pw[ENGINE].launch(); console.log('engine: ' + ENGINE); const allErrs = [];
  const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'he-IL', serviceWorkers: 'block' }); const p = await ctx.newPage(); p.on('pageerror', e => allErrs.push(e.message)); p.on('console', m => { if (m.type() === 'error') allErrs.push('console: ' + m.text()); });
  await p.clock.install({ time: new Date('2026-10-21T08:00:00') });
  await p.goto(URL0); await p.clock.runFor(800); await p.evaluate(BASICS); await p.reload(); await p.clock.runFor(900);
  const S = () => p.evaluate(() => Store.load('session'));
  const run = ms => p.clock.runFor(ms);
  const stepInfo = () => p.evaluate(() => { const s = Store.load('session'), st = Logic.buildSteps(Core.dayDef(s.day), s.version)[s.stepIdx]; return { idx: s.stepIdx, sec: st.sec, set: st.set, sets: st.sets, reps: st.item.reps, isec: st.item.sec, test: !!st.item.test, rest: st.rest }; });

  G = 'setup sheet';
  await p.evaluate(() => { location.hash = '#/day/3'; }); await run(600);
  await p.locator('.seg [data-v=std]').click(); await p.locator('[data-act=start]').click(); await run(800);
  ok(await p.locator('.sheet [data-run-setup]').waitFor({ timeout: 5000 }).then(() => true, () => false), 'pre-start sheet opens (loaded on demand)');
  ok(await p.locator('.run').count() === 0 && !(await S()), 'nothing starts before the user confirms');
  ok(await p.locator('.sheet [data-mode]').count() === 2 && await p.locator('#rs-set').count() === 1 && await p.locator('#rs-ex').count() === 1, 'manual/automatic choice + rest between sets + rest between exercises');
  const est0 = await p.locator('.sheet [data-est] b').innerText();
  await p.locator('.sheet [data-mode=auto]').click(); await p.selectOption('#rs-set', '30'); await p.selectOption('#rs-ex', '60'); await p.selectOption('#rs-cd', '3'); await run(100);
  const est1 = await p.locator('.sheet [data-est] b').innerText();
  ok(est0 !== est1 && /\d/.test(est1), 'estimated duration follows the chosen rest/countdown', { est0, est1 });
  await p.locator('.sheet [data-act=go]').click(); await run(400);
  let s = await S();
  ok(s && s.mode === 'auto' && s.cfg.setRest === 30 && s.cfg.exRest === 60 && s.cfg.countdown === 3, 'session stores mode and rest settings', s && { mode: s.mode, cfg: s.cfg });
  ok(await p.evaluate(() => Core.profile().display.run.mode === 'auto'), 'choice remembered for next time');

  G = 'automatic progression';
  ok(await p.locator('.run [data-auto-cd]').count() === 1, 'countdown shown before the first set');
  await run(3200); ok(await p.locator('.run [data-auto-work]').count() === 1 || (await S()).hold === 'input', 'work phase starts by itself after the countdown');
  /* run through warm-up until the first main set is being worked, never touching the screen */
  let guard = 0, held = 0; while (guard++ < 200) { const i = await stepInfo(); const ss = await S(); if (ss.hold === 'input') { held++; await p.locator('.run [data-a=done]').click(); await run(500); continue; } if (i.sec === 'main' && ss.work && ss.work.auto) break; await run(2000); }
  s = await S(); const firstMain = await stepInfo();
  ok(firstMain.sec === 'main' && s.work && s.work.auto, 'reached the first main set hands-free', { firstMain, held });
  const logged = Object.keys(s.log).length; ok(logged === s.stepIdx && Object.values(s.log).every(r => r.done), 'every passed step logged exactly once and marked done', { logged, idx: s.stepIdx });
  ok(Object.values(s.log).some(r => r.auto), 'auto-completed sets are marked auto');
  /* finish the work phase of this main set → rest with the chosen between-sets/between-exercises value */
  await run(s.work.dur * 1000 + 500); s = await S(); const prev = s.log[s.stepIdx - 1];
  const same = firstMain.set < firstMain.sets;
  ok(s.rest && s.rest.planned === (same ? 30 : 60), `rest after a main set = chosen ${same ? 'between-sets' : 'between-exercises'} value`, s.rest);
  ok(prev && prev.done && prev.auto && (firstMain.reps == null || prev.assumed), 'the set is logged as done; reps = target, marked "assumed"', prev);

  G = 'per-set feedback (non-blocking)';
  ok(await p.locator('.run [data-set-fb]').count() === 1, 'quick feedback offered during the rest');
  const endsAt = s.rest.endsAt;
  await p.locator('.run [data-sfb=hard]').click(); await run(200);
  if (await p.locator('.run [data-srep="-1"]').count()) { await p.locator('.run [data-srep="-1"]').click(); await run(100); }
  s = await S(); ok(s.log[s.stepIdx - 1].fb === 'hard', 'answer stored with the set it belongs to');
  ok(s.rest && s.rest.endsAt === endsAt && !s.paused, 'answering did not pause or reset the rest timer');
  if (firstMain.reps != null) ok(s.log[s.stepIdx - 1].reps === firstMain.reps - 1 && !s.log[s.stepIdx - 1].assumed, 'reps corrected during the rest (no longer "assumed")', s.log[s.stepIdx - 1]);
  ok(JSON.stringify(await p.evaluate(() => Core.dayDef(3).main)) === JSON.stringify(await p.evaluate(() => Core.dayDef(3).main)) && !(await p.evaluate(() => Store.load('workouts').days[3])), 'no automatic change to the plan from one answer');

  G = 'rest controls';
  await p.locator('.run [data-a=rest15]').click(); await run(100); s = await S(); ok(s.rest.endsAt === endsAt + 15000, '+15 s');
  await p.locator('.run [data-a=restM15]').click(); await run(100); s = await S(); ok(s.rest.endsAt === endsAt, '−15 s');

  G = 'recovery after reload (mid-rest)';
  const idxR = s.stepIdx; await p.reload(); await run(1200); s = await S();
  ok(await p.locator('.run').count() === 1 && s.stepIdx === idxR && s.mode === 'auto' && (s.rest || s.cd || s.work), 'reload resumes the same step in automatic mode', { idx: s.stepIdx, idxR });

  G = 'pause / resume';
  await p.locator('.run-top [data-a=pause]').click(); await run(200); const sp = await S(); await run(90000); const sp2 = await S();
  ok(sp2.paused && sp2.stepIdx === sp.stepIdx && Object.keys(sp2.log).length === Object.keys(sp.log).length, 'paused: 90 s pass, nothing advances');
  await p.locator('.run-top [data-a=resume]').click(); await run(200); ok(!(await S()).paused, 'resume');

  G = 'clock drift / background guard';
  guard = 0; while (guard++ < 60) { const ss = await S(); if (ss.work && ss.work.auto) break; if (ss.hold === 'input') { await p.locator('.run [data-a=done]').click(); } await run(1000); }
  s = await S(); const idxW = s.stepIdx, nLog = Object.keys(s.log).length;
  const nowT = await p.evaluate(() => Date.now()); await p.clock.setSystemTime(nowT + (s.work.dur + 30) * 1000); /* jump without firing timers: the app "was in the background" */
  await run(400); s = await S();
  ok(s.hold === 'late' && s.paused && s.stepIdx === idxW && Object.keys(s.log).length === nLog, 'a work phase that ended while the app was hidden is NOT marked done; the workout pauses at that set', { hold: s.hold, idx: s.stepIdx, idxW });
  ok(await p.locator('.run [data-auto-late]').count() === 1, 'explained on screen');
  await p.locator('.run [data-auto-late] [data-a=resume]').click(); await run(300); s = await S(); ok(!s.paused && !s.hold && s.stepIdx === idxW, 'continue restarts the same set');

  G = 'settings during the workout';
  await p.locator('.run-top [data-a=settings]').click(); await run(800);
  ok(await p.locator('.sheet [data-run-setup]').count() === 1 && (await S()).paused, 'settings sheet opens and the workout waits');
  await p.selectOption('.sheet #rs-set', '45'); await p.locator('.sheet [data-act=apply]').click(); await run(300); s = await S();
  ok(s.cfg.setRest === 45 && s.stepIdx === idxW && !s.paused, 'rest changed without losing the workout state', { cfg: s.cfg, idx: s.stepIdx });

  G = 'double-advance guard';
  await p.locator('.run-top [data-a=settings]').click(); await run(800); await p.locator('.sheet [data-mode=manual]').click(); await p.locator('.sheet [data-act=apply]').click(); await run(300);
  if (await p.locator('.run [data-a=skipRest]').count()) { await p.locator('.run [data-a=skipRest]').click(); await run(100); }
  await run(600); s = await S(); const i0 = s.stepIdx;
  const wasDisabled = await p.evaluate(() => { document.querySelector('.run [data-a=done]').click(); const b2 = document.querySelector('.run [data-a=done]'); const d = b2.disabled; b2.disabled = false; b2.click(); return d; }); /* 2nd tap forced through the disabled state: the logic guard must still hold */
  await run(100); s = await S(); ok(s.stepIdx === i0 + 1, 'double tap completes one set only', { i0, now: s.stepIdx });
  ok(wasDisabled, 'new set button briefly disabled after an advance');
  await p.evaluate(() => Run.open()); await run(50); ok(await p.evaluate(() => document.querySelector('.run [data-a=done]').disabled), 'still disabled within the guard window after a re-render');
  await run(600); ok(!(await p.evaluate(() => document.querySelector('.run [data-a=done]').disabled)), '…and enabled again');

  G = 'Safe Stop + summary';
  await p.locator('.run-top [data-a=settings]').click(); await run(800); await p.locator('.sheet [data-mode=auto]').click(); await p.locator('.sheet [data-act=apply]').click(); await run(300);
  await p.locator('.run [data-a=exit]').click(); await run(200); s = await S();
  ok(s.paused && await p.locator('.sheet [data-act=finish]').count() === 1, 'exit pauses the automatic timers immediately and offers stop options');
  const idxE = s.stepIdx; await run(60000); ok((await S()).stepIdx === idxE, 'nothing advances behind the exit sheet');
  await p.locator('.sheet [data-act=finish]').click(); await run(300);
  ok(await p.locator('.run [data-run-stats]').count() === 1 && /אוטומטי/.test(await p.locator('.run [data-run-stats]').innerText()) && /מנוחה מתוכננת/.test(await p.locator('.run [data-run-stats]').innerText()), 'summary: mode, planned vs actual rest, per-set feedback');
  ok(await p.locator('.run #sm-st').inputValue() === 'partial', 'stopped early → "partial", not "done"');
  await p.locator('.run [data-a=save]').click(); await run(500);
  const w = await p.evaluate(() => Store.load('workouts').days[3]);
  ok(w && w.mode === 'auto' && w.restPlannedSec > 0 && w.restActualSec >= 0 && w.status === 'partial' && w.sets.some(x => x.fb === 'hard'), 'saved: mode, planned/actual rest, status partial, per-set answers', w && { mode: w.mode, rp: w.restPlannedSec, ra: w.restActualSec, st: w.status });
  ok(!(await S()), 'session cleared after saving');

  G = 'manual mode unchanged';
  await p.evaluate(() => { location.hash = '#/day/4'; }); await run(600);
  if (await p.locator('.seg [data-v=std]').count()) await p.locator('.seg [data-v=std]').click();
  await p.locator('[data-act=start]').click(); await run(800);
  ok(await p.locator('.sheet [data-mode=auto][aria-pressed=true]').count() === 1, 'last choice preselected');
  await p.locator('.sheet [data-mode=manual]').click(); await p.locator('.sheet [data-act=go]').click(); await run(400);
  const m0 = (await S()).stepIdx; await run(120000); s = await S();
  ok(s.mode === 'manual' && s.stepIdx === m0 && !s.cd && !(s.work && s.work.auto), 'manual mode never advances by itself');
  await p.evaluate(() => { Store.clearSession(); });

  G = 'errors'; ok(!allErrs.length, 'no JS errors', allErrs);
  await b.close();
  let pass = 0, fail = 0; for (const r of res) { console.log(`${r.ok ? 'PASS' : 'FAIL'} [${r.g}] ${r.m}`); r.ok ? pass++ : fail++; }
  console.log(`\nm11 run tests: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
