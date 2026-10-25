/* Workout Builder, Smart Exercise Substitution, Privacy Center + CSV export — end to end on the built PWA.
   Playwright Chromium with iPhone 13 emulation (BROWSER=webkit for Playwright WebKit) — NOT a physical device.
   Usage: node tools/e2e_builder.js [URL]  — needs the PWA served (default http://localhost:8096/) */
const pw = require('playwright'); const { devices } = pw; const fs = require('fs');
const URL0 = process.argv[2] || 'http://localhost:8096/', ENGINE = process.env.BROWSER === 'webkit' ? pw.webkit : pw.chromium;
const res = []; let G = ''; const ok = (c, m, i) => res.push({ g: G, ok: !!c, m: m + (i !== undefined && !c ? ' → ' + JSON.stringify(i).slice(0, 400) : '') });
(async () => {
  const b = await ENGINE.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'he-IL', acceptDownloads: true }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const go = async (h, ms) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(ms || 500); };
  const waitFor = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < (ms || 6000)) { if (await p.evaluate(fn).catch(() => false)) return true; await p.waitForTimeout(150); } return false; };
  await p.goto(URL0); await p.waitForTimeout(700);
  await p.evaluate(() => { localStorage.clear(); Store.resetAll(); const pr = Store.load('profile'); Object.assign(pr, { age: 34, height: 172, weight: 78, startWeight: 78, sex: 'f', experience: 'beginner', onboarded: true, startDate: Store.today(), exercisePrefs: { fav: [], exclude: ['burpee'], noJump: false } }); pr.environment.equipment = ['chair']; Store.save('profile'); });
  await p.reload(); await p.waitForTimeout(800);

  G = 'builder · entry and empty state';
  await go('#/workouts', 600); ok(await p.locator('[data-builder-link]').count() === 1, 'workouts screen links to the builder');
  await p.locator('[data-builder-link]').click(); await waitFor(() => !!document.querySelector('[data-builder-list]'));
  ok(await p.locator('[data-builder-empty]').count() === 1, 'empty state explains what to do');

  G = 'builder · choices → suggestion';
  await p.locator('[data-builder-new]').click(); await waitFor(() => !!document.querySelector('[data-builder-form]'));
  ok(await p.evaluate(() => Screens._builder.form.level === 'beginner' && Screens._builder.form.equipment.includes('chair') && Screens._builder.form.exclude.includes('burpee')), 'form pre-filled from the profile (level, equipment, excluded exercise)');
  await p.locator('[data-act=fGoal][data-v=strength]').click(); await p.waitForTimeout(200); await p.locator('[data-act=fMin][data-v="30"]').click(); await p.waitForTimeout(200);
  await p.locator('[data-act=fFocus][data-v=legs]').click(); await p.waitForTimeout(200);
  await p.locator('[data-act=fGen]').click(); await waitFor(() => !!document.querySelector('[data-builder-editor]'));
  const est = +(await p.locator('[data-builder-time] b').first().innerText()).replace(/\D/g, '');
  ok(est > 0 && est <= 30 && /הערכה/.test(await p.locator('[data-builder-time]').innerText()), 'estimated time within 30 min and labelled as an estimate', est);
  ok(await p.locator('[data-builder-main] [data-bi^="main:"]').count() >= 3 && await p.locator('[data-builder-main] [data-why]').count() >= 3, 'exercises listed, each with "why this exercise"');
  ok(await p.locator('[data-builder-gate="ok"]').count() === 1, 'Plan Integrity Gate: fits equipment, exclusions and time');
  ok(!(await p.evaluate(() => Screens._builder.draft.main.concat(Screens._builder.draft.warm, Screens._builder.draft.cool).some(x => x.ex === 'burpee'))), 'excluded exercise not used');

  G = 'builder · edit, substitute, add';
  const first = await p.evaluate(() => Screens._builder.draft.main.map(x => x.ex));
  await p.locator('[data-act=bMove][data-i="0"][data-d="1"]').click(); await p.waitForTimeout(250);
  ok(await p.evaluate(() => Screens._builder.draft.main[1].ex) === first[0], 'reorder (▼) moves the exercise');
  ok(await p.evaluate(() => document.activeElement && document.activeElement.dataset.act === 'bMove'), 'keyboard focus stays on the move control');
  await p.locator('[data-bf=sets][data-i="0"]').fill('3'); await p.locator('[data-bf=sets][data-i="0"]').dispatchEvent('change'); await p.waitForTimeout(250);
  ok(await p.evaluate(() => Screens._builder.draft.main[0].sets) === 3, 'sets edited');
  await p.locator('[data-bf=sets][data-i="0"]').fill('-4'); await p.locator('[data-bf=sets][data-i="0"]').dispatchEvent('change'); await p.waitForTimeout(250);
  ok(await p.locator('[data-builder-errs]').count() === 1 && await p.locator('[data-act=bSave]').isDisabled(), 'negative sets → error shown and save disabled');
  await p.locator('[data-bf=sets][data-i="0"]').fill('2'); await p.locator('[data-bf=sets][data-i="0"]').dispatchEvent('change'); await p.waitForTimeout(250);
  const before = await p.evaluate(() => Screens._builder.draft.main.map(x => x.ex)), others = before.filter((_, k) => k !== 1);
  await p.locator('[data-act=bAlt][data-ph=main][data-i="1"]').click(); await p.waitForTimeout(300);
  const nAlt = await p.locator('.sheet [data-alt]').count(), noneMsg = await p.locator('.sheet [data-alt-none]').count();
  ok(nAlt > 0 || noneMsg === 1, 'substitution sheet: ranked alternatives, or an explicit "no suitable alternative"');
  if (nAlt) { ok(/·/.test(await p.locator('.sheet [data-alt] .tiny.muted').first().innerText()), 'each alternative explains why (muscles, pattern, equipment)');
    const pick = await p.locator('.sheet [data-alt]').first().getAttribute('data-alt'); await p.locator('.sheet [data-alt] [data-act=pick]').first().click(); await p.waitForTimeout(300);
    const after = await p.evaluate(() => Screens._builder.draft.main.map(x => x.ex));
    ok(after[1] === pick && JSON.stringify(after.filter((_, k) => k !== 1)) === JSON.stringify(others), 'only the chosen exercise changed'); ok(new Set(after).size === after.length, 'no duplicate after substitution'); }
  else await p.evaluate(() => document.querySelectorAll('.sheet [data-x]').forEach(x => x.click()));
  await p.locator('[data-act=bAdd]').click(); await p.waitForTimeout(300); await p.fill('.sheet #ba-q', 'ישבן'); await p.waitForTimeout(300);
  ok(await p.locator('.sheet #ba-list .li').count() >= 1, 'add-exercise search by muscle (Hebrew)');
  const nBefore = await p.evaluate(() => Screens._builder.draft.main.length); await p.locator('.sheet #ba-list [data-act=add]').first().click(); await p.waitForTimeout(300);
  ok(await p.evaluate(() => Screens._builder.draft.main.length) === nBefore + 1, 'exercise added');

  G = 'builder · save, reload, start, history';
  await p.fill('#be-name', 'רגליים וכוח — בדיקה'); await p.locator('[data-act=bSave]').click(); await p.waitForTimeout(600);
  const wid = await p.evaluate(() => location.hash.split('/')[2]); ok(/^cw/.test(wid || ''), 'saved → URL of the saved workout', wid);
  await p.reload(); await p.waitForTimeout(900); await waitFor(() => !!document.querySelector('[data-builder-editor]'));
  ok(await p.inputValue('#be-name') === 'רגליים וכוח — בדיקה' && await p.locator('[data-builder-main] [data-bi^="main:"]').count() === nBefore + 1, 'after reload: same workout, same exercises');
  await go('#/builder', 500); ok(await p.locator(`[data-builder-item="${wid}"]`).count() === 1, 'listed in "my workouts"');
  await go('#/builder/' + wid, 500); await p.locator('[data-act=bStart]').click(); await p.waitForTimeout(800);
  if (await p.locator('.sheet [data-act=go]').count()) { await p.locator('.sheet [data-act=go]').click(); await p.waitForTimeout(500); }
  ok(await p.locator('.run').count() === 1 && /אימון שבניתי/.test(await p.locator('.run-top').innerText()), 'starts in the existing workout runner');
  const sess = await p.evaluate(() => JSON.parse(localStorage.getItem('fit30.session'))); ok(sess && sess.custom && sess.custom.id === wid && sess.custom.def && sess.custom.def.main.length === nBefore + 1, 'session saved with the workout (resumable after reload)');
  await p.reload(); await p.waitForTimeout(1200); ok(await p.locator('.run').count() === 1, 'reload mid-workout → the runner reopens where it stopped');
  await p.locator('.run [data-a=exit]').click(); await p.waitForTimeout(300); await p.locator('.sheet [data-act=finish]').click(); await p.waitForTimeout(400);
  await p.locator('.run [data-a=save]').click(); await p.waitForTimeout(700);
  const log = await p.evaluate(() => Store.load('workouts').customLog); ok(log.length === 1 && log[0].wid === wid && log[0].snapshot && log[0].status === 'partial', 'run logged once with a snapshot; early stop = partial', log);
  ok(await p.evaluate(() => Object.keys(Store.load('workouts').days).length) === 0 && await p.evaluate(() => location.hash) === '#/builder/' + wid, '30-day log untouched; back to the workout');
  await p.evaluate(() => { const s = Store.load('workouts').customLog[0]; Builder.logRun(s.wid, { runId: s.runId }); }); ok(await p.evaluate(() => Store.load('workouts').customLog.length) === 1, 'the same run cannot be logged twice');
  await go('#/builder/' + wid, 500); await p.locator('[data-act=bDelW]').click(); await p.waitForTimeout(300); await p.locator('.sheet [data-act=ok]').click(); await p.waitForTimeout(500);
  ok(await p.evaluate(id => !Builder.get(id), wid) && await p.locator('[data-builder-history] .li').count() === 1, 'delete needs confirmation; history is kept');

  G = 'restart over an open session keeps what was chosen (bug fixed 25.10.2026: the plan/workout was dropped)';
  { const id2 = await p.evaluate(() => { const g = Builder.generate({ goal: 'general', minutes: 15, level: 'beginner' }); g.name = 'קצר'; return Builder.save(g).id; });
    await p.evaluate(() => localStorage.setItem('fit30.session', JSON.stringify({ day: 3, version: 'std', stepIdx: 0, total: 5, log: {}, startedAt: 1, activeMs: 0, lastResume: 1, paused: true })));
    await p.reload(); await p.waitForTimeout(900); await p.evaluate(() => { Run.close && Run.close(); document.querySelectorAll('.sheet [data-x]').forEach(x => x.click()); });
    await p.evaluate(id => Run.start(0, 'std', null, { id }), id2); await p.waitForTimeout(400);
    ok(await p.locator('.sheet [data-act=ok]').count() === 1, 'an open session asks before replacing it');
    await p.locator('.sheet [data-act=ok]').click(); await p.waitForTimeout(500); if (await p.locator('.sheet [data-act=go]').count()) { await p.locator('.sheet [data-act=go]').click(); await p.waitForTimeout(400); }
    const s2 = await p.evaluate(() => JSON.parse(localStorage.getItem('fit30.session') || 'null')); ok(s2 && s2.custom && s2.custom.id === id2, 'after "restart" the new session is the chosen builder workout (not the 30-day day)', s2 && { day: s2.day, custom: s2.custom && s2.custom.id });
    await p.evaluate(() => { localStorage.removeItem('fit30.session'); Store.clearSession && Store.clearSession(); Run.close && Run.close(); }); await go('#/', 300); }

  G = 'privacy centre';
  await p.evaluate(() => { const C = Core; C.addEntry(Store.today(), { slot: 'm1', name: 'שקשוקה, "ביתית"', k: 420, p: 20, c: 30, f: 22, fb: 5 }); C.setDaily(Store.today(), { water: 1250, waterGoal: 3000 }); });
  await go('#/settings', 500); ok(await p.locator('[data-privacy-link]').count() === 1, 'settings link to the privacy centre');
  await go('#/privacy', 300); await waitFor(() => !!document.querySelector('[data-privacy-data]'));
  const tx = await p.locator('#view').innerText();
  ok(/במכשיר בלבד/.test(tx) && /בגרסה הזו אין שרת/.test(tx), 'no-backend build: says data stays on the device and nothing is sent');
  ok(/ספק AI[\s\S]*לא מוגדר/.test(tx) && /אנליטיקה[\s\S]*לא קיים/.test(tx) && /Health[\s\S]*לא מחובר/.test(tx), 'services: AI not configured, no analytics, Health not connected');
  ok(/Google Fonts/.test(tx) && /מיקום/.test(tx), 'discloses font requests and the location permission (only on tap)');
  ok(+(await p.locator('[data-export-list] .li', { hasText: 'יומן אכילה' }).locator('[data-rows]').getAttribute('data-rows')) === 1, 'export scope shown per file (rows)');

  G = 'CSV export (download content)';
  const [dl] = await Promise.all([p.waitForEvent('download'), p.locator('[data-export-list] .li', { hasText: 'יומן אכילה' }).locator('[data-act=csv1]').click()]);
  const fp = await dl.path(), buf = fs.readFileSync(fp), txt = buf.toString('utf8');
  ok(dl.suggestedFilename() === 'sofitgo-nutrition_journal.csv', 'file name', dl.suggestedFilename());
  ok(buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF, 'UTF-8 BOM (Hebrew opens correctly in spreadsheets)');
  const lines = txt.slice(1).split('\r\n'); ok(lines[0] === 'date,meal_slot,name,source,portion,grams,kcal,protein_g,carbs_g,fat_g,fiber_g,repeat,logged_at' && lines.length === 3 && lines[2] === '', 'stable header + 1 data row + CRLF', lines);
  ok(lines[1].includes('"שקשוקה, ""ביתית"""') && lines[1].includes(',420,20,30,22,5,'), 'content: Hebrew, comma and quotes escaped; values exact', lines[1]);
  ok(await p.locator('[data-export-ok]').count() === 1, 'success message with the exported scope');
  const [d2] = await Promise.all([p.waitForEvent('download'), p.locator('[data-export-list] .li', { hasText: 'אימוני תוכנית 30' }).locator('[data-act=csv1]').click()]);
  const t2 = fs.readFileSync(await d2.path(), 'utf8'); ok(t2.slice(1).split('\r\n').filter(Boolean).length === 1, 'empty category → header row only');
  G = 'CSV export · another account\'s data on the device is never exported';
  await p.evaluate(() => { window.FIT30_BACKEND = { url: 'http://x.invalid', key: 'k' }; window.Account = { SECTIONS: ['profile'], state: () => ({ signedIn: true, userId: 'user-B', owner: 'user-A', status: 'foreign' }) }; App.render(); }); await p.waitForTimeout(300);
  ok(await p.locator('[data-export-foreign]').count() === 1 && await p.locator('[data-act=csvAll]').isDisabled() && await p.locator('[data-act=csv1]').first().isDisabled(), 'foreign owner → export blocked with an explanation (account state simulated in the page)');

  G = 'mobile layout';
  for (const h of ['#/builder', '#/builder/new', '#/privacy']) { await go(h, 400); const w = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth })); ok(w.sw <= w.iw + 1, h + ': no horizontal scroll at 390 px', w); }
  G = 'workout edited or deleted while its session is open (bugs fixed 25.10.2026: the open session switched to the edited workout; deleting it crashed the runner)';
  for (const mode of ['edit', 'delete']) {
    await p.evaluate(() => { localStorage.removeItem('fit30.session'); Run.close && Run.close(); });
    const id = await p.evaluate(() => { const g = Builder.generate({ goal: 'general', minutes: 15, level: 'beginner' }); g.name = 'מקורי'; return Builder.save(g).id; });
    const orig = await p.evaluate(id => Builder.get(id).main.map(x => x.ex), id);
    await p.evaluate(id => Run.start(0, 'std', null, { id }), id); await p.waitForTimeout(600); await p.locator('.sheet [data-act=go]').click(); await p.waitForTimeout(300);
    await p.locator('.run [data-a=done]').click(); await p.waitForTimeout(200); const total = await p.evaluate(() => JSON.parse(localStorage.getItem('fit30.session')).total);
    await p.evaluate(() => Run.close());
    await p.evaluate(([id, mode]) => { if (mode === 'delete') Builder.remove(id); else { const w = Builder.get(id); w.name = 'נערך'; w.main = w.main.slice(0, 1); Builder.save(w); } }, [id, mode]);
    await p.evaluate(() => Run.open()); await p.waitForTimeout(500);
    ok(/מקורי/.test(await p.locator('.run').innerText()) && await p.evaluate(() => JSON.parse(localStorage.getItem('fit30.session')).total) === total, mode + ': the open session keeps the workout as it was started');
    await p.locator('.run [data-a=exit]').click(); await p.waitForTimeout(200); await p.locator('.sheet [data-act=finish]').click(); await p.waitForTimeout(300); await p.locator('.run [data-a=save]').click(); await p.waitForTimeout(400);
    const l = await p.evaluate(() => Store.load('workouts').customLog.slice(-1)[0]);
    ok(l && l.snapshot && l.snapshot.name === 'מקורי' && JSON.stringify(l.snapshot.main.map(x => x.ex)) === JSON.stringify(orig) && l.sets.length === total, mode + ': history records what was actually done', l && l.snapshot);
  }
  ok(errs.length === 0, 'no page errors', errs.slice(0, 3));
  await b.close();
  let pass = 0, fail = 0; for (const r of res) { console.log(`${r.ok ? 'PASS' : 'FAIL'} [${r.g}] ${r.m}`); r.ok ? pass++ : fail++; }
  console.log(`builder e2e${process.env.BROWSER === 'webkit' ? ' (webkit)' : ''}: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { res.forEach(r => console.log((r.ok ? 'PASS ' : 'FAIL ') + '[' + r.g + '] ' + r.m)); console.error('builder e2e crashed in [' + G + ']: ' + e.message.split('\n')[0]); process.exit(2); });
