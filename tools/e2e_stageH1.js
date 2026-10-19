/* Stage H1 browser tests (Playwright Chromium, iPhone-13 / 320 px emulation, fixed clock — NOT a real device).
   Usage: node tools/e2e_stageH1.js [URL] — writes dist/reports/e2e-stageH1.json; SHOT=<prefix> also saves screenshots */
const { chromium, devices } = require('playwright'); const fs = require('fs'), path = require('path');
const URL0 = process.argv[2] || 'http://localhost:8096/';
const res = []; let G = ''; const ok = (c, m, info) => res.push({ g: G, ok: !!c, m: m + (info !== undefined && !c ? ' → ' + JSON.stringify(info).slice(0, 300) : '') });
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'he-IL', serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/ERR_|Failed to load resource/.test(m.text())) errs.push(m.text()); if (/no handler/.test(m.text())) errs.push('NOHANDLER ' + m.text()); });
  p.on('dialog', d => d.accept());
  await p.clock.install({ time: new Date('2026-10-19T08:00:00').getTime() });
  const go = async h => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(350); };
  const main = () => p.locator('main').innerText();
  const shot = async n => { if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT + '-' + n + '.png', fullPage: true }); };
  await p.goto(URL0); await p.waitForTimeout(500);
  const seed = o => p.evaluate(o => { localStorage.clear(); Store.resetAll(); const pr = Store.load('profile'); Object.assign(pr, { age: 32, height: 175, weight: 80, startWeight: 80, sex: 'm', experience: 'beginner', onboarded: true, startDate: Store.today() }, o.p || {});
    pr.aims = { primary: o.goal || 'fat_loss', secondary: [] }; pr.availability = { days: [1, 3, 5], sessions: 3, maxMin: 30, prefMin: null }; pr.environment = { place: o.place || 'home', equipment: o.eq || [], custom: [] }; pr.prefs = Core.normPrefs(o.prefs || {}); if (o.kinds) pr.restrictionKinds = o.kinds; Store.save('profile');
    if (o.plan) Plans.activate(Plans.create(o.plan, Plans.paramsFromProfile(pr), Store.today()), { confirmReplace: true }); }, o);
  const reload = async () => { await p.reload(); await p.waitForTimeout(450); };

  G = 'P0: restricted foods (classic day 31+)';
  await seed({ prefs: { exclude: ['peanuts'] }, kinds: { peanuts: 'allergy' } }); await reload(); await p.evaluate(() => Core.applyPrefs());
  { let leak = 0, guarded = 0; for (const d of ['2026-11-18', '2026-11-21', '2026-12-10', '2027-01-15']) { await go('#/nutrition/' + d);
      leak += await p.evaluate(d => ['m1', 'm2', 'snack'].filter(k => { const s = Core.plan(d)[k]; return s.rid && Logic.recipeIngredients(Logic.recipe(s.rid), s.ov).some(x => Core.blockedFoods().has(x.f)); }).length, d);
      guarded += await p.locator('[data-guard]').count(); }
    ok(leak === 0, 'days 31, 34, 53, 89 of the classic program: no meal with peanuts'); ok(guarded > 0, 'replaced meals carry a visible "replaced automatically · reason (allergy)" label', { guarded });
    await go('#/nutrition/2026-11-21'); const t = await main(); ok(!/לא נמצאה חלופה אוטומטית/.test(t), 'the old misleading warning text is gone'); await shot('guard');
    await p.clock.setFixedTime(new Date('2026-11-21T08:00:00').getTime()); await reload(); await go('#/shopping/14'); ok(!/בוטנים/.test(await main()) && await p.locator('[data-shop-blocked]').count() === 0, 'shopping list from day 34 (14 days): no peanuts');
    await p.clock.setFixedTime(new Date('2026-10-19T08:00:00').getTime()); await reload(); }

  G = 'P0: explicit user choice, add-food, kinds UI';
  await seed({ prefs: { exclude: ['peanuts'] }, kinds: { peanuts: 'allergy' } }); await reload();
  { const rid = await p.evaluate(() => { const r = NUTRI.RECIPES.find(r => r.meal === 'm1' && !r.est && Logic.recipeIngredients(r).some(x => x.f === 'peanut_butter' || x.f === 'peanuts')); Core.setPlanSlot(Store.today(), 'm1', { rid: r.id, ov: null }); return r.id; });
    await go('#/nutrition'); ok(await p.locator('[data-user-conflict].bad').count() === 1 && /אלרגיה/.test(await p.locator('[data-user-conflict]').innerText()), 'a peanut dish the user picked: red "allergy" warning on the card', { rid });
    await go('#/shopping/3'); ok(await p.locator('[data-shop-warn]').count() === 1 && await p.locator('[data-shop-blocked]').count() >= 1, 'shopping list: warning banner + the item marked "allergy — restricted for you"'); await shot('shop-flag');
    await go('#/nutrition'); await p.locator('[data-act=addFood]').click(); await p.waitForTimeout(250); const opt = await p.locator('#af-f option[value=peanuts]').innerText(); ok(/מוחרג/.test(opt) && /אלרגיה/.test(opt), 'add-food list marks peanuts as restricted (allergy)', opt);
    await p.selectOption('#af-f', 'peanuts'); await p.waitForTimeout(150); ok(await p.locator('#af-warn').isVisible(), 'selecting a restricted food shows an inline warning'); await p.locator('.sheet [data-x]').first().click();
    await go('#/settings'); ok(await p.locator('[data-kinds] select[data-rk=peanuts]').count() === 1, 'preferences show a kind selector for each restriction');
    await p.selectOption('[data-rk=peanuts]', 'intolerance'); await p.locator('[data-act=savePrefs]').click(); await p.waitForTimeout(400); ok(await p.evaluate(() => Store.load('profile').restrictionKinds.peanuts) === 'intolerance', 'kind is saved'); await p.locator('.sheet [data-x]').first().click().catch(() => {}); }

  G = 'safeguards shown in the UI';
  await seed({ p: { age: 15, height: 165, weight: 55 } }); await reload();
  { await go('#/targets'); ok(await p.locator('[data-tw=minor]').count() === 1 && /שימור/.test(await main()), 'age 15: minor warning on the targets screen, maintenance'); ok(await p.locator('[data-disclaimer]').count() >= 1, 'disclaimer (not a diagnostic tool) on the targets screen'); await shot('minor');
    await go('#/profile'); ok(await p.locator('[data-sec=basics] [data-tw=minor]').count() === 1, 'warning also on the profile'); await go('#/nutrition'); ok(await p.locator('[data-tw=minor]').count() === 1, 'and on the nutrition day'); }
  await seed({ p: { age: 70, height: 150, weight: 45, sex: 'f' } }); await reload(); await go('#/targets'); ok(await p.locator('[data-tw=floor]').count() === 1 && /1,?200/.test(await main()), '70y 45kg: floor applied and explained (1200)');
  await seed({ p: { age: 30, height: 165, weight: 48, sex: 'f' } }); await reload(); await go('#/targets'); ok(await p.locator('[data-tw=underweight]').count() === 1, 'BMI 17.6 + fat loss: underweight warning');
  await go('#/explain'); ok(await p.locator('[data-empty-state]').count() === 1, 'explain without a plan shows its empty state (no crash with warnings present)');
  await seed({ plan: 'general_90' }); await reload(); await go('#/targets'); ok(await p.locator('[data-target-warnings]').count() === 0, 'ordinary adult: no warnings shown');

  G = 'activity level';
  { await go('#/profile'); const k0 = await p.evaluate(() => Core.targets().kcal); await p.selectOption('#pf-act', 'moderate'); await p.locator('[data-act=saveBasics]').click(); await p.waitForTimeout(300);
    const k1 = await p.evaluate(() => Core.targets().kcal); ok(k1 > k0, `choosing "active" raises the estimate (${k0} → ${k1})`); await go('#/targets'); ok(/לפי רמת הפעילות שבחרת/.test(await main()) && /ואימונים/.test(await main()), 'targets screen names the chosen level and says it includes training');
    await go('#/nutrition'); ok(await p.locator('[data-menu-pending]').count() === 1, 'menu update offered after the change (approval)'); }

  G = 'profile ↔ plan sync';
  await seed({ plan: 'general_90' }); await reload();
  { await go('#/profile'); ok(await p.locator('[data-plan-sync]').count() === 0, 'no banner while profile and plan match');
    await p.locator('[data-act=gp][data-v=muscle]').click(); await p.waitForTimeout(300); ok(await p.locator('[data-plan-sync]').count() === 1 && /האימונים עדיין בנויים/.test(await p.locator('[data-plan-sync]').innerText()), 'goal change: banner explains nutrition follows the new goal, workouts do not yet');
    for (const h of ['#/', '#/plan', '#/nutrition']) { await go(h); ok(await p.locator('[data-plan-sync]').count() === 1, `banner also on ${h}`); }
    await go('#/profile'); await p.locator('[data-act=dw][data-v="0"]').click(); await p.waitForTimeout(250); ok(/ימים זמינים/.test(await p.locator('[data-plan-sync]').innerText()), 'day change listed in the banner');
    ok(/רק אחרי "עדכון התוכנית"/.test(await p.locator('[data-sec=avail]').innerText()), 'availability text no longer claims the plan follows automatically');
    await go('#/plan'); await shot('sync'); await p.locator('[data-plan-sync] [data-act=syncPlan]').click(); await p.waitForTimeout(350); ok(await p.locator('.sheet [data-sync-diff]').count() === 1, 'update sheet shows what will change before approval'); await shot('sync-sheet');
    const logs0 = await p.evaluate(() => JSON.stringify(Plans.active().log)); await p.locator('.sheet [data-act=ok]').click(); await p.waitForTimeout(400);
    ok(await p.locator('[data-plan-sync]').count() === 0 && await p.evaluate(() => Plans.active().segments.slice(-1)[0].params.goal) === 'muscle', 'after approval: plan updated, banner gone');
    ok(await p.evaluate(() => JSON.stringify(Plans.active().log)) === logs0, 'history unchanged'); }

  G = 'fields: place, target weight, equipment gap, settings validation';
  await seed({ eq: ['dumbbells', 'bands'], goal: 'muscle', plan: 'strength_90', place: 'gym' }); await reload();
  { await go('#/plan'); ok(await p.locator('[data-equip-gap]').count() === 1 && /משקולות/.test(await p.locator('[data-equip-gap]').innerText()), 'plan screen: declared dumbbells/bands are named as not used (gap)'); await shot('equip');
    await go('#/profile'); ok(/לתיעוד בלבד/.test(await p.locator('[data-place-note]').innerText()), 'place labelled "documentation only"');
    await p.fill('#pf-tw', '72'); await p.locator('[data-act=saveBasics]').click(); await p.waitForTimeout(300); await go('#/progress'); ok(/משקל יעד: 72/.test(await p.locator('[data-target-weight]').innerText()) && /נותרו 8/.test(await p.locator('[data-target-weight]').innerText()), 'target weight shown in progress with the distance (80 → 72: 8 kg)');
    await go('#/settings'); await p.fill('#s-age', '12'); await p.locator('[data-act=saveProfile]').click(); await p.waitForTimeout(250); ok(await p.evaluate(() => Store.load('profile').age) === 32, 'settings: age 12 rejected (same 14–100 rule as the profile)');
    await p.fill('#s-age', '32'); await p.fill('#s-w', '400'); await p.locator('[data-act=saveProfile]').click(); await p.waitForTimeout(250); ok(await p.evaluate(() => Store.load('profile').weight) === 80, 'settings: weight 400 rejected'); }

  G = 'vegan without soy & peanuts';
  await seed({ goal: 'recomp', prefs: { vegan: true, exclude: ['soya', 'peanuts'] }, plan: 'general_90' }); await reload();
  { await go('#/nutrition'); ok(await p.locator('[data-missing=m1]').count() === 0 && await p.locator('[data-missing=m2], [data-missing=snack]').count() === 0, 'today has a breakfast, a main meal and a snack (breakfast was always empty)'); /* the optional add-on may stay empty: no soy-free vegan add-on exists */ }

  G = 'small screens';
  { const c3 = await b.newContext({ viewport: { width: 320, height: 700 }, isMobile: true, hasTouch: true }); const q = await c3.newPage(); await q.clock.install({ time: new Date('2026-10-19T08:00:00').getTime() }); await q.goto(URL0); await q.waitForTimeout(500);
    await q.evaluate(() => { const pr = Store.load('profile'); Object.assign(pr, { age: 15, height: 165, weight: 55, sex: 'm', experience: 'beginner', onboarded: true }); pr.aims = { primary: 'fat_loss', secondary: [] }; pr.availability = { days: [1, 3, 5], sessions: 3, maxMin: 30 }; pr.environment = { place: 'gym', equipment: ['dumbbells'], custom: [] }; pr.prefs = Core.normPrefs({ exclude: ['peanuts'] }); Store.save('profile'); Plans.activate(Plans.create('general_90', Plans.paramsFromProfile(pr), Store.today()), { confirmReplace: true }); pr.aims.primary = 'muscle'; Store.save('profile'); });
    await q.reload(); await q.waitForTimeout(500); const wide = [];
    for (const h of ['#/', '#/profile', '#/plan', '#/targets', '#/nutrition', '#/settings', '#/shopping', '#/progress']) { await q.evaluate(x => { location.hash = x; }, h); await q.waitForTimeout(250); if (await q.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) wide.push(h); }
    ok(!wide.length, '320 px: new banners/warnings fit without horizontal scroll', wide); await c3.close(); }

  G = 'general'; ok(!errs.some(e => /NOHANDLER/.test(e)), 'every button has a handler'); ok(errs.length === 0, 'no console errors', errs.slice(0, 3));
  await b.close();
  const pass = res.filter(r => r.ok).length, fail = res.length - pass, groups = {}; res.forEach(r => { groups[r.g] = groups[r.g] || { pass: 0, fail: 0 }; groups[r.g][r.ok ? 'pass' : 'fail']++; });
  fs.mkdirSync(path.join(__dirname, '../dist/reports'), { recursive: true }); fs.writeFileSync(path.join(__dirname, '../dist/reports/e2e-stageH1.json'), JSON.stringify({ url: URL0, pass, fail, groups, results: res }, null, 1));
  res.filter(r => !r.ok).forEach(r => console.log('FAIL [' + r.g + '] ' + r.m)); console.log(JSON.stringify(groups)); console.log(`stage H1 e2e: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('crashed', e.stack); console.log(res.slice(-4).map(r => (r.ok ? 'PASS ' : 'FAIL ') + r.m).join('\n')); process.exit(2); });
