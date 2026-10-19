/* End-to-end tests: iPhone 13 viewport, built PWA served over HTTP. Expected nutrition numbers are
   recomputed in the test from the raw food table (window.NUTRI.FOODS), not read from the app's own totals. */
const { chromium, devices } = require('playwright');
const URL0 = process.env.URL || 'http://localhost:8091/';
let pass = 0, fail = 0; const res = [], resG = []; const groups = {}; let G = 'general';
const ok = (c, m) => { groups[G] = groups[G] || { pass: 0, fail: 0 }; resG.push({ g: G, ok: !!c, m }); if (c) { pass++; groups[G].pass++; res.push('PASS ' + m); } else { fail++; groups[G].fail++; res.push('FAIL ' + m); } };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'he-IL', acceptDownloads: true });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|ERR_FAILED|fonts\.g/.test(m.text())) errs.push(m.text()); if (/no handler/.test(m.text())) errs.push('NOHANDLER ' + m.text()); });
  const go = async h => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(300); };
  const state = k => p.evaluate(k => JSON.parse(localStorage.getItem('fit30.' + k) || 'null'), k);
  // independent calculator in page context: sums FOODS × grams for a plan slot as currently stored
  const indepSlot = (date, slot) => p.evaluate(([d, s]) => { const pl = Core.plan(d)[s], r = Logic.recipe(pl.rid); const ings = r.ing.map((x, i) => (pl.ov && pl.ov[i]) ? Object.assign({}, x, pl.ov[i]) : x);
    return ings.reduce((t, x) => { const f = NUTRI.FOODS[x.f]; t.k += f.k * x.g / 100 * pl.scale; t.p += f.p * x.g / 100 * pl.scale; return t; }, { k: 0, p: 0 }); }, [date, slot]);
  await p.goto(URL0); await p.waitForTimeout(700);
  await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(700);
  // Stage B: a new profile is empty; the test user enters their own data (same values as before → same expected numbers)
  await p.evaluate(() => { const pr = Store.load('profile'); Object.assign(pr, { age: 32, height: 187, weight: 85, startWeight: 85, sex: 'm', aims: { primary: 'fat_loss', secondary: [] } }); Store.save('profile'); }); await p.reload(); await p.waitForTimeout(500);
  const today = await p.evaluate(() => Store.today());

  G = 'nutrition';
  await go('#/nutrition');
  const base3 = (await indepSlot(today, 'm1')).k + (await indepSlot(today, 'm2')).k + (await indepSlot(today, 'snack')).k;
  const shownBase = await p.evaluate(() => Core.plannedTotals(Store.today(), 'selected'));
  ok(Math.abs(shownBase.k - base3) <= 2, `day without add-on: planned = 3 meals (${shownBase.k} vs ${Math.round(base3)})`);
  ok((await p.locator('main').innerText()).includes('לא נבחרה — לא נכללת'), 'add-on shown as not included');
  const tgt = await p.evaluate(() => Core.targets().protein);
  const bp = (await indepSlot(today, 'm1')).p + (await indepSlot(today, 'm2')).p + (await indepSlot(today, 'snack')).p;
  ok(bp >= tgt, `base menu reaches protein target without add-on (${bp.toFixed(1)} ≥ ${tgt})`);
  ok(!(await p.locator('main').innerText()).includes('חסרים'), 'no shortfall warning when base meets target');
  ok(!(await p.locator('main').innerText()).includes('יעד החלבון הושג'), 'target not shown as achieved before eating');
  // raise the protein target: shortfall must now be shown
  await p.evaluate(() => { const pr = Store.load('profile'); pr.targets = { protein: 200 }; Store.save('profile'); }); await go('#/'); await go('#/nutrition');
  ok((await p.locator('main').innerText()).includes('חסרים'), 'shortfall shown when target above base');
  await p.evaluate(() => { const pr = Store.load('profile'); pr.targets = null; Store.save('profile'); }); await go('#/'); await go('#/nutrition');
  await p.locator('[data-act=extraOn]').click(); await p.waitForTimeout(250);
  const ex = await indepSlot(today, 'extra');
  const withEx = await p.evaluate(() => Core.plannedTotals(Store.today(), 'selected'));
  ok(Math.abs(withEx.k - (base3 + ex.k)) <= 2, `day with add-on: planned includes it (${withEx.k})`);
  await p.locator('[data-act=extraOff]').click(); await p.waitForTimeout(250);
  ok(Math.abs((await p.evaluate(() => Core.plannedTotals(Store.today(), 'selected'))).k - base3) <= 2, 'removing add-on restores base');
  // meal swap
  await p.locator('[data-act=swapMeal][data-slot=m2]').click(); await p.waitForTimeout(250);
  ok(await p.locator('.sheet [data-act=pick]').count() >= 3, 'meal swap offers ≥3 alternatives');
  const newId = await p.locator('.sheet [data-act=pick]').first().getAttribute('data-id');
  await p.locator('.sheet [data-act=pick]').first().click(); await p.waitForTimeout(250);
  // Stage C: a swap is confirmed after the calorie/protein/carb/fat differences are shown
  ok(await p.locator('.sheet [data-diff]').count() === 1 && /הפרש/.test(await p.locator('.sheet').innerText()), 'meal swap shows kcal/protein/carbs/fat differences before confirming');
  await p.locator('.sheet [data-act=ok]').click(); await p.waitForTimeout(250);
  ok(await p.evaluate(() => Core.plan(Store.today()).m2.rid) === newId, 'meal swap stored');
  const afterSwap = (await indepSlot(today, 'm1')).k + (await indepSlot(today, 'm2')).k + (await indepSlot(today, 'snack')).k;
  ok(Math.abs((await p.evaluate(() => Core.plannedTotals(Store.today(), 'selected'))).k - afterSwap) <= 2, 'totals after meal swap match independent sum (no stale values)');
  // ingredient swap
  await p.locator('[data-act=swapIng][data-slot=m1]').click(); await p.locator('.sheet [data-act=pickIng]').first().click(); await p.waitForTimeout(200);
  await p.selectOption('.sheet #sw-f', { index: 1 }); await p.locator('.sheet [data-act=saveIng]').click(); await p.waitForTimeout(250);
  const afterIng = (await indepSlot(today, 'm1')).k + (await indepSlot(today, 'm2')).k + (await indepSlot(today, 'snack')).k;
  ok(Math.abs((await p.evaluate(() => Core.plannedTotals(Store.today(), 'selected'))).k - afterIng) <= 2, 'totals after ingredient swap match independent sum');
  // eat / quantity / remove
  await p.locator('[data-act=eat][data-slot=snack]').click(); await p.locator('.sheet [data-act=p][data-p="75"]').click(); await p.locator('.sheet [data-act=ok]').click(); await p.waitForTimeout(250);
  const sn = await indepSlot(today, 'snack');
  ok(Math.abs((await p.evaluate(() => Core.eatenTotals(Store.today()).k)) - sn.k * 0.75) <= 2, 'eaten 75% = 0.75 × recipe');
  await p.locator('[data-act=editEat][data-slot=snack]').click(); await p.locator('.sheet [data-act=p][data-p="100"]').click(); await p.locator('.sheet [data-act=ok]').click(); await p.waitForTimeout(250);
  ok(Math.abs((await p.evaluate(() => Core.eatenTotals(Store.today()).k)) - sn.k) <= 2, 'quantity changed to 100%');
  ok((await p.evaluate(() => Core.entries(Store.today()).length)) === 1, 'no duplicate entry after editing');
  await p.reload(); await p.waitForTimeout(600);
  ok(Math.abs((await p.evaluate(() => Core.eatenTotals(Store.today()).k)) - sn.k) <= 2, 'eaten value persists after reload');
  ok(await p.evaluate(() => Core.plan(Store.today()).m2.rid) === newId, 'meal swap persists after reload');
  await go('#/nutrition'); await p.locator('[data-act=uneat][data-slot=snack]').click(); await p.waitForTimeout(250);
  ok((await p.evaluate(() => Core.eatenTotals(Store.today()).k)) === 0, 'removing from log returns to 0');
  // home screen consistency
  await go('#/'); await p.locator('[data-act=eat][data-slot=m1]').click(); await p.waitForTimeout(250);
  const m1 = await indepSlot(today, 'm1');
  ok(Math.abs((await p.evaluate(() => Core.eatenTotals(Store.today()).k)) - m1.k) <= 2, 'home check-off = recipe sum');
  ok(await p.locator('[data-act=eat][data-slot=extra]').count() === 0, 'home does not list unselected add-on');
  await go('#/progress'); ok(await p.locator('.chart .bar').count() >= 1, 'kcal chart reflects eaten food');

  G = 'preferences';
  await go('#/settings'); await p.locator('#pf-d').check(); await p.locator('[data-act=savePrefs]').click(); await p.waitForTimeout(400);
  ok((await p.locator('.sheet').innerText()).includes('מנות שהוחלפו'), 'preference change shows summary');
  await p.locator('.sheet [data-x]').click();
  const conflictsLeft = await p.evaluate(() => { const b = Core.blockedFoods(); let n = 0; for (let d = 2; d <= 30; d++) { const date = Core.dateOfDay(d); ['m1', 'm2', 'snack'].forEach(s => { const pl = Core.plan(date)[s]; if (Logic.recipeIngredients(Logic.recipe(pl.rid), pl.ov).some(x => b.has(x.f))) n++; }); } return n; });
  ok(conflictsLeft === 0, 'no dairy left in planned meals (days 2–30)');
  ok((await p.evaluate(() => Core.entries(Store.today()).length)) === 1, 'eaten history untouched by preference change');
  await go('#/nutrition/' + await p.evaluate(() => Core.dateOfDay(3)));
  ok((await p.locator('main').innerText()).includes('הותאם להעדפות'), 'adapted meals are labelled');
  await go('#/recipes'); await p.locator('[data-act=rf][data-f=ok]').click(); await p.waitForTimeout(200);
  const okCount = await p.locator('.rcard').count(); ok(okCount >= 10 && !(await p.locator('main').innerText()).includes('לא תואם להעדפות'), `recipe filter "matches me" (${okCount})`);
  await go('#/settings'); await p.locator('#pf-d').uncheck(); await p.locator('[data-act=savePrefs]').click(); await p.waitForTimeout(400); await p.locator('.sheet [data-x]').click();
  ok(await p.evaluate(() => { for (let d = 2; d <= 30; d++) { const pl = Core.plan(Core.dateOfDay(d)); const m = NUTRI.MENU[d - 1]; if (pl.m2.rid !== m[1] && d !== 1) return false; } return true; }), 'turning preference off restores the original menu');
  // custom exclusion
  await p.selectOption('#pf-add', 'peanuts'); await p.locator('[data-act=exclude]').click(); await p.waitForTimeout(250);
  await p.locator('[data-act=savePrefs]').click(); await p.waitForTimeout(400); await p.locator('.sheet [data-x]').click();
  ok(await p.evaluate(() => { for (let d = 2; d <= 30; d++) { const date = Core.dateOfDay(d); for (const s of ['m1', 'm2', 'snack']) { const pl = Core.plan(date)[s]; if (Logic.recipeIngredients(Logic.recipe(pl.rid), pl.ov).some(x => x.f === 'peanuts')) return false; } } return true; }), 'custom excluded food removed from plan');
  await p.locator('[data-act=unexclude][data-f=peanuts]').click(); await p.waitForTimeout(200); await p.locator('[data-act=savePrefs]').click(); await p.waitForTimeout(300); await p.locator('.sheet [data-x]').click();

  G = 'workouts';
  await go('#/day/3');
  const segs = await p.locator('.seg [data-v] small').allInnerTexts();
  ok(segs.length === 3 && /1[45]|16/.test(segs[0]) && /(29|30|31)/.test(segs[1]) && /(59|60|61)/.test(segs[2]), 'version buttons show ~15 / ~30 / ~60 (' + segs.join(' | ') + ')');
  ok((await p.locator('main').innerText()).includes('הערכה') && (await p.locator('main').innerText()).includes('זמן מתוכנן'), 'planned time shown and labelled as estimate');
  await p.locator('[data-act=swap][data-ex=reverse_lunge]').click(); await p.locator('.sheet [data-act=pick][data-id=split_squat]').click(); await p.waitForTimeout(200);
  ok((await state('workouts')).swaps[3].reverse_lunge === 'split_squat', 'exercise swap');
  await p.locator('.seg [data-v=std]').click(); await p.locator('[data-act=start]').click(); await p.waitForTimeout(400);
  ok(await p.locator('.run').count() === 1 && !(await state('workouts')).days[3], 'workout mode opens, not marked done');
  await p.locator('.run [data-a=done]').click(); await p.waitForTimeout(200);
  ok((await state('session')).log[0].done === true, 'set marked done');
  for (let i = 0; i < 8; i++) { const sec = await p.evaluate(() => { const s = Store.load('session'); return Logic.buildSteps(Core.dayDef(s.day), s.version)[s.stepIdx].sec; }); if (sec === 'main') break; await p.locator('.run [data-a=done]').click(); await p.waitForTimeout(100); if (await p.locator('.run [data-a=skipRest]').count()) await p.locator('.run [data-a=skipRest]').click(); }
  await p.locator('.run [data-a=done]').click(); await p.waitForTimeout(300);
  ok(!!(await state('session')).rest, 'rest timer started');
  const t1 = await p.locator('[data-rest]').innerText(); await p.waitForTimeout(1300); ok(t1 !== await p.locator('[data-rest]').innerText(), 'rest timer counts down');
  await p.locator('.run-top [data-a=pause]').click(); await p.waitForTimeout(150); const a1 = (await state('session')).activeMs; await p.waitForTimeout(700);
  ok((await state('session')).paused && (await state('session')).activeMs === a1, 'pause stops the clock');
  await p.locator('.run-top [data-a=resume]').click(); await p.waitForTimeout(150); ok(!(await state('session')).paused, 'resume');
  const idx = (await state('session')).stepIdx; await p.reload(); await p.waitForTimeout(700);
  ok(await p.locator('.run').count() === 1 && (await state('session')).stepIdx === idx, 'workout resumes at same step after reload');
  if (await p.locator('.run [data-a=skipRest]').count()) await p.locator('.run [data-a=skipRest]').click();
  const i0 = (await state('session')).stepIdx; await p.locator('.run [data-a=nextEx]').click(); await p.waitForTimeout(150); ok((await state('session')).stepIdx > i0, 'next exercise');
  await p.locator('.run [data-a=exit]').click(); await p.locator('.sheet [data-act=finish]').click(); await p.waitForTimeout(250);
  await p.locator('.run [data-r="6"]').click(); await p.locator('.run [data-a=save]').click(); await p.waitForTimeout(400);
  ok((await state('workouts')).days[3] && (await state('workouts')).days[3].rpe === 6, 'workout saved with difficulty');

  G = 'fitness tests';
  await go('#/day/1');
  ok((await p.locator('main').innerText()).includes('מבחן כושר סטנדרטי'), 'test card on day 1');
  await p.locator('[data-act=startTest]').click(); await p.waitForTimeout(400);
  ok((await state('session')).version === 'test', 'test session is separate from workout');
  // go to the push-up test step, enter a result, skip the rest
  for (let i = 0; i < 12; i++) { if (await p.locator('#run-test').count()) break; await p.locator('.run [data-a=done]').click(); await p.waitForTimeout(80); if (await p.locator('.run [data-a=skipRest]').count()) await p.locator('.run [data-a=skipRest]').click(); }
  await p.fill('#run-test', '19'); await p.locator('.run [data-a=done]').click(); await p.waitForTimeout(150);
  await p.locator('.run [data-a=exit]').click(); await p.locator('.sheet [data-act=finish]').click(); await p.waitForTimeout(250);
  await p.locator('.run [data-a=saveTest]').click(); await p.waitForTimeout(400);
  const t = (await state('workouts')).tests[1];
  ok(t && t.results.pushup === 19 && t.date === today, 'test result saved with date');
  ok(t.results.plank === undefined && t.results.burpee60 === undefined, 'tests not performed stay empty');
  ok(!(await state('workouts')).days[1], 'test does not mark the day-1 workout as done');
  await go('#/day/29'); await p.locator('[data-act=manualTest]').click(); await p.fill('.sheet #mt-pushup', '25'); await p.locator('.sheet [data-act=save]').click(); await p.waitForTimeout(250);
  await go('#/progress'); const txt = await p.locator('main').innerText();
  ok(txt.includes('+6') && txt.includes('לא מוכיח'), 'comparison day 1 vs 29 with caveat');
  await p.reload(); await p.waitForTimeout(500); ok((await state('workouts')).tests[29].results.pushup === 25, 'test results persist');

  G = 'swap after eating';
  await go('#/nutrition');
  if (await p.locator('[data-act=uneat][data-slot=m2]').count()) { await p.locator('[data-act=uneat][data-slot=m2]').click(); await p.waitForTimeout(250); if (await p.locator('.sheet [data-act=ok]').count()) { await p.locator('.sheet [data-act=ok]').click(); await p.waitForTimeout(250); } }
  await p.locator('[data-act=eat][data-slot=m2]').click(); await p.locator('.sheet [data-act=p][data-p="100"]').click(); await p.locator('.sheet [data-act=ok]').click(); await p.waitForTimeout(250);
  const eatenRid = await p.evaluate(() => Core.slotEntry(Store.today(), 'm2').rid), eatenK = await p.evaluate(() => Core.slotEntry(Store.today(), 'm2').k);
  const eatenTot = await p.evaluate(() => Core.eatenTotals(Store.today()).k);
  await p.locator('[data-act=swapMeal][data-slot=m2]').click(); await p.waitForTimeout(250);
  const pick2 = p.locator(`.sheet [data-act=pick]:not([data-id="${eatenRid}"])`).first(); const swapRid = await pick2.getAttribute('data-id'); await pick2.click(); await p.waitForTimeout(250); await p.locator('.sheet [data-act=ok]').click(); await p.waitForTimeout(250);
  ok(await p.evaluate(() => Core.plan(Store.today()).m2.rid) === swapRid, 'swap after eating: plan changed');
  ok(Math.abs((await p.evaluate(() => Core.eatenTotals(Store.today()).k)) - eatenTot) < 0.5, 'swap after eating: eaten totals unchanged');
  ok((await p.locator('main').innerText()).includes('(לפני ההחלפה)'), 'swap after eating: slot shows what was actually eaten');
  await p.locator('[data-act=editEat][data-slot=m2]').click(); await p.locator('.sheet [data-act=p][data-p="50"]').click(); await p.locator('.sheet [data-act=ok]').click(); await p.waitForTimeout(250);
  const ed = await p.evaluate(() => Core.slotEntry(Store.today(), 'm2'));
  ok(ed.rid === eatenRid && Math.abs(ed.k - eatenK * 0.5) <= 1, `edit portion after swap uses eaten recipe (${ed.k} vs ${eatenK * 0.5})`);

  G = 'recipe day context';
  const adjSlot = await p.evaluate(() => { const st = Store.load('profile').startDate; for (let n = 1; n <= 30; n++) { const d = Store.addDays(st, n - 1), pl = Core.plan(d); for (const k of ['m1', 'm2', 'snack']) if (pl[k].adjusted) return { d, k, rid: pl[k].rid, m: Core.slotMacros(pl[k]), b: Logic.recipeMacros(Logic.recipe(pl[k].rid)) }; } return null; });
  ok(!!adjSlot, 'found a day with an adjusted (BASE_ADJ) slot');
  await go('#/nutrition/' + adjSlot.d);
  ok(await p.locator(`a[href="#/recipe/${adjSlot.rid}/${adjSlot.d}/${adjSlot.k}"]`).count() === 1, 'slot recipe link carries date and slot');
  ok((await p.locator('main').textContent()).includes('(במתכון'), 'slot ingredient list (collapsed details) shows adjusted and recipe grams');
  await go(`#/recipe/${adjSlot.rid}/${adjSlot.d}/${adjSlot.k}`);
  ok(await p.locator('[data-ctx=day]').count() === 1, 'recipe opened from plan shows day-context banner');
  const shownK = +(await p.locator('.macro-grid .v').nth(4).innerText());
  ok(shownK === adjSlot.m.k, `recipe in day context shows planned kcal (${shownK} = ${adjSlot.m.k})`);
  ok((await p.locator('main').innerText()).includes('(במתכון'), 'recipe in day context lists original grams');
  await go(`#/recipe/${adjSlot.rid}`);
  ok(await p.locator('[data-ctx=day]').count() === 0 && +(await p.locator('.macro-grid .v').nth(4).innerText()) === adjSlot.b.k, 'plain recipe view shows base amounts');
  await go(`#/recipe/${adjSlot.rid}/${adjSlot.d}/m9`);
  ok(await p.locator('[data-ctx=day]').count() === 0, 'invalid slot in URL falls back to base recipe');

  G = 'tracking';
  await go('#/'); await p.locator('[data-act=water][data-ml="500"]').click(); await p.waitForTimeout(150);
  await p.fill('#h-steps', '10450'); await p.locator('[data-act=saveSteps]').click(); await p.fill('#h-sleep', '7.25'); await p.locator('#h-sleep').dispatchEvent('change'); await p.waitForTimeout(200);
  const dl = (await state('tracking')).daily[today]; ok(dl.water === 500 && dl.steps === 10450 && dl.sleep === 7.25, 'water/steps/sleep saved');
  await go('#/progress'); await p.fill('#m-w', '84.4'); await p.fill('#m-wa', '90.5'); await p.locator('[data-act=saveM]').click(); await p.waitForTimeout(250);
  await p.fill('#m-d', await p.evaluate(() => Store.addDays(Store.today(), -4))); await p.fill('#m-w', '85'); await p.locator('[data-act=saveM]').click(); await p.waitForTimeout(250);
  ok((await state('tracking')).measures.length === 2 && await p.locator('.chart .ln').count() >= 1, 'measurements + weight chart');
  for (const h of ['#/', '#/calendar', '#/workouts', '#/nutrition', '#/progress']) { await go(h); }
  ok((await state('tracking')).daily[today].steps === 10450, 'data survives navigation');

  G = 'photos (local only)';
  await go('#/progress');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGP8z4APMOGVHbHSAEEsAQ8Y9e4dAAAAAElFTkSuQmCC', 'base64');
  await p.setInputFiles('#ph-in', { name: 'p.png', mimeType: 'image/png', buffer: png }); await p.waitForTimeout(800);
  ok((await p.evaluate(() => Store.photoAll().then(x => x.length))) === 1, 'progress photo saved on device (IndexedDB)');
  ok(!JSON.stringify(await p.evaluate(() => Store.exportAll())).includes('data:image'), 'backup file contains no photo data');

  G = 'backup';
  await go('#/settings'); await p.locator('[data-act=export]').click(); await p.waitForTimeout(300);
  ok((await p.locator('.sheet').innerText()).includes('לא נכללות בגיבוי'), 'export states photos are not included');
  const [dlf] = await Promise.all([p.waitForEvent('download', { timeout: 4000 }).catch(() => null), p.locator('.sheet [data-act=dl]').click()]);
  ok(!!dlf && /fit30-backup/.test(dlf.suggestedFilename()), 'backup file downloaded');
  const backup = await p.locator('.sheet #fo-t').inputValue(); await p.locator('.sheet [data-x]').click();
  const before = await p.evaluate(() => JSON.stringify(Store.exportAll(), (k, v) => k === 'exportedAt' ? undefined : v));
  await p.evaluate(() => Store.resetAll()); await p.reload(); await p.waitForTimeout(500);
  await go('#/settings'); await p.locator('[data-act=import]').click(); await p.fill('.sheet #im-t', backup); await p.locator('.sheet [data-act=go]').click(); await p.waitForTimeout(200); await p.locator('.sheet [data-act=ok]').click(); await p.waitForTimeout(500);
  const after = await p.evaluate(() => JSON.stringify(Store.exportAll(), (k, v) => k === 'exportedAt' ? undefined : v));
  ok(before === after, 'restore reproduces all data exactly');
  await p.reload(); await p.waitForTimeout(500); ok((await state('workouts')).tests[1].results.pushup === 19, 'restored data persists after reload');

  ok((await p.evaluate(() => Store.photoAll().then(x => x.length))) === 1, 'restore does not delete on-device photos');

  G = 'backup negative (UI)';
  const snap = () => p.evaluate(() => JSON.stringify(['profile', 'workouts', 'nutrition', 'tracking'].map(k => localStorage.getItem('fit30.' + k))));
  const good = JSON.parse(backup);
  const bad = {
    'invalid JSON': '{"app":"fit30", "profile": {',
    'not a fit30 file': JSON.stringify({ app: 'other', profile: {} }),
    'future version': JSON.stringify(Object.assign({}, good, { version: 99 })),
    'profile is an array': JSON.stringify(Object.assign({}, good, { profile: [1, 2] })),
    'missing section': JSON.stringify({ app: 'fit30', version: 1, profile: good.profile }),
    'corrupt log entry': JSON.stringify(Object.assign({}, good, { nutrition: Object.assign({}, good.nutrition, { log: { '2026-10-17': { entries: [{ k: 'x' }] } } }) })),
    'bad start date': JSON.stringify(Object.assign({}, good, { profile: Object.assign({}, good.profile, { startDate: 'yesterday' }) })),
    'truncated file': backup.slice(0, Math.floor(backup.length / 2))
  };
  for (const [name, txt] of Object.entries(bad)) {
    const s0 = await snap();
    await go('#/settings'); await p.locator('[data-act=import]').click(); await p.fill('.sheet #im-t', txt); await p.locator('.sheet [data-act=go]').click(); await p.waitForTimeout(200);
    const msg = await p.locator('.sheet #im-msg').innerText().catch(() => '');
    ok(msg.length > 5 && await p.locator('.sheet [data-act=go]').count() === 1, `rejected with message: ${name}`);
    ok((await snap()) === s0, `existing data untouched: ${name}`);
    await p.locator('.sheet [data-x]').first().click(); await p.waitForTimeout(150);
  }
  // old-version (v1) backup: tests inside day logs → migrated immediately after restore, no reload needed
  const v1 = JSON.parse(backup); v1.version = 1; v1.workouts = { v: 1, days: { 1: { status: 'done', version: 'std', date: today, tests: { pushup: 18, plank: 70 } } }, levels: {}, swaps: {}, feedback: {} };
  await go('#/settings'); await p.locator('[data-act=import]').click(); await p.fill('.sheet #im-t', JSON.stringify(v1)); await p.locator('.sheet [data-act=go]').click(); await p.waitForTimeout(200); await p.locator('.sheet [data-act=ok]').click(); await p.waitForTimeout(400);
  ok(await p.evaluate(() => { const t = Store.load('workouts').tests[1]; return !!t && t.results.pushup === 18 && t.results.plank === 70; }), 'v1 backup: test results migrated on restore');
  // partial backup (sections present, optional fields missing) → defaults filled
  const part = { app: 'fit30', version: good.version, profile: { startDate: good.profile.startDate, weight: 85 }, workouts: {}, nutrition: {}, tracking: {} };
  await go('#/settings'); await p.locator('[data-act=import]').click(); await p.fill('.sheet #im-t', JSON.stringify(part)); await p.locator('.sheet [data-act=go]').click(); await p.waitForTimeout(200); await p.locator('.sheet [data-act=ok]').click(); await p.waitForTimeout(400);
  ok(await p.evaluate(() => Array.isArray(Store.load('nutrition').favorites) && typeof Store.load('workouts').days === 'object' && Array.isArray(Store.load('tracking').measures)), 'partial backup: missing fields get defaults');
  for (const h of ['#/', '#/nutrition', '#/progress', '#/workouts']) await go(h);
  ok(errs.length === 0, 'partial backup: app renders without errors');
  // put the full backup back for the remaining tests
  await go('#/settings'); await p.locator('[data-act=import]').click(); await p.fill('.sheet #im-t', backup); await p.locator('.sheet [data-act=go]').click(); await p.waitForTimeout(200); await p.locator('.sheet [data-act=ok]').click(); await p.waitForTimeout(400);
  ok((await p.evaluate(() => JSON.stringify(Store.exportAll(), (k, v) => k === 'exportedAt' ? undefined : v))) === after, 'full backup restored again after negative tests');

  G = 'mobile UI';
  for (const h of ['#/', '#/calendar', '#/workouts', '#/day/11', '#/day/1', '#/ex/burpee', '#/nutrition', '#/recipes', '#/recipe/madra_chicken', '#/targets', '#/progress', '#/settings', '#/install']) { await go(h); ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal scroll ' + h); }
  ok(await p.evaluate(() => getComputedStyle(document.body).direction === 'rtl'), 'RTL');
  const nb = await p.locator('.nav a').first().boundingBox(); ok(nb.height >= 44, 'tap targets ≥44px');
  await go('#/workouts'); await p.locator('[data-t=library]').click(); await p.waitForTimeout(150); ok(await p.locator('#lib-list .li').count() === 57, 'library lists 57 exercises');
  ok(!errs.some(e => /NOHANDLER/.test(e)), 'every button has a handler');
  ok(errs.length === 0, 'no console errors ' + JSON.stringify(errs.slice(0, 3)));

  G = 'other viewports';
  for (const vp of [{ n: '375×667 (iPhone SE size)', w: 375, h: 667 }, { n: '430×932 (Pro Max size)', w: 430, h: 932 }, { n: '320×568 (narrow)', w: 320, h: 568 }]) {
    const c2 = await b.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'he-IL' }); const q = await c2.newPage(); const qe = []; q.on('pageerror', e => qe.push(e.message));
    await q.goto(URL0); await q.waitForTimeout(600); let bad = [];
    for (const h of ['#/', '#/calendar', '#/workouts', '#/day/11', '#/nutrition', '#/recipes', '#/recipe/madra_chicken', '#/targets', '#/progress', '#/settings']) { await q.evaluate(x => { location.hash = x; }, h); await q.waitForTimeout(200); if (!(await q.evaluate(() => document.documentElement.scrollWidth <= innerWidth))) bad.push(h); }
    ok(bad.length === 0, `no horizontal scroll at ${vp.n} ${bad.join(' ')}`);
    ok(qe.length === 0, `no page errors at ${vp.n}`); await c2.close();
  }

  G = 'PWA';
  const p2 = await ctx.newPage(); await p2.goto(URL0); await p2.waitForTimeout(1500); await p2.reload(); await p2.waitForTimeout(700);
  ok(await p2.evaluate(() => !!navigator.serviceWorker.controller), 'service worker active');
  await ctx.setOffline(true); await p2.reload(); await p2.waitForTimeout(700); ok((await p2.locator('main').innerText()).length > 50, 'loads offline'); await ctx.setOffline(false);
  const man = await (await p2.request.get(URL0 + 'manifest.webmanifest')).json(); ok(man.display === 'standalone' && man.icons.length >= 3 && man.dir === 'rtl', 'manifest');

  require('fs').mkdirSync('dist/reports', { recursive: true }); require('fs').writeFileSync('dist/reports/e2e-results.json', JSON.stringify({ pass, fail, groups, results: resG }, null, 1));
  console.log(res.filter(x => x.startsWith('FAIL')).join('\n'));
  console.log(JSON.stringify(groups));
  console.log(`E2E: pass ${pass} fail ${fail}`);
  await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('E2E crashed', e.message); console.log(res.slice(-5).join('\n')); process.exit(2); });
