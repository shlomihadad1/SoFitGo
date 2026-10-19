/* Stage C browser tests (Playwright Chromium, iPhone-13 viewport emulation — NOT a physical iPhone, NOT Safari).
   Usage: node tools/e2e_stageC.js [URL]  (default http://localhost:8096/) — writes dist/reports/e2e-stageC.json */
const { chromium, devices } = require('playwright'); const fs = require('fs'), path = require('path');
const URL0 = process.argv[2] || 'http://localhost:8096/';
const res = []; let G = ''; const ok = (c, m, info) => res.push({ g: G, ok: !!c, m: m + (info !== undefined && !c ? ' → ' + JSON.stringify(info).slice(0, 300) : '') });
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'he-IL', serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/ERR_|Failed to load resource/.test(m.text())) errs.push(m.text()); if (/no handler/.test(m.text())) errs.push('NOHANDLER ' + m.text()); });
  const go = async h => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(350); };
  const main = () => p.locator('main').innerText();
  await p.goto(URL0); await p.waitForTimeout(600);
  const seed = (prefs) => p.evaluate(pf => { Store.resetAll(); localStorage.clear(); const pr = Store.load('profile'); Object.assign(pr, { age: 32, height: 187, weight: 85, startWeight: 85, sex: 'm', experience: 'beginner', aims: { primary: 'fat_loss', secondary: [] } }); pr.availability = { days: [1, 3, 5], sessions: 3, prefMin: null, maxMin: 30 }; if (pf) pr.prefs = Core.normPrefs(pf); Store.save('profile'); Plans.activate(Plans.create('general_90', Plans.paramsFromProfile(pr), Store.today()), { confirmReplace: true }); }, prefs || null);
  await seed(); await p.reload(); await p.waitForTimeout(500);

  G = 'plan menu on screen';
  await go('#/nutrition');
  ok(await p.locator('[data-menu-source=plan]').count() === 1, 'nutrition shows the personal plan menu');
  ok(await p.locator('.slot').count() >= 4, 'meals + optional add-on shown');
  const tot = await p.evaluate(() => ({ base: Core.plannedTotals(Store.today(), 'base'), sel: Core.plannedTotals(Store.today(), 'selected'), t: Core.targets() }));
  ok(tot.base.k === tot.sel.k, 'add-on not counted until chosen');
  ok(Math.abs(tot.base.k - tot.t.kcal) <= tot.t.kcal * 0.07 && tot.base.p >= tot.t.protein - 0.5, `today's menu fits the targets (${tot.base.k}/${tot.t.kcal} kcal, ${tot.base.p}/${tot.t.protein} g)`);
  const next7 = await p.evaluate(() => Array.from({ length: 7 }, (_, i) => Core.plan(Store.addDays(Store.today(), i)).m2.rid));
  ok(new Set(next7).size === 7, 'seven different main meals in the next 7 days');
  ok(await p.evaluate(() => Array.from({ length: 90 }, (_, i) => Core.plan(Store.addDays(Store.today(), i)).source).every(s => s === 'plan')), 'every day of the 90-day plan has its own menu');

  G = 'swaps show differences';
  await p.locator('[data-act=swapMeal][data-slot=m2]').click(); await p.waitForTimeout(250); await p.locator('.sheet [data-act=pick]').first().click(); await p.waitForTimeout(250);
  const sheet = await p.locator('.sheet').innerText(); ok(/קק״ל/.test(sheet) && /חלבון/.test(sheet) && /פחמ׳/.test(sheet) && /שומן/.test(sheet) && /הפרש/.test(sheet), 'meal swap: kcal, protein, carbs, fat and difference shown before confirming');
  const newId = await p.evaluate(() => null); await p.locator('.sheet [data-act=ok]').click(); await p.waitForTimeout(300);
  ok(await p.evaluate(() => Core.plan(Store.today()).m2.changed), 'meal swapped after confirmation');
  await p.locator('[data-act=swapIng][data-slot=m1]').click(); await p.locator('.sheet [data-act=pickIng]').first().click(); await p.waitForTimeout(250);
  ok(await p.locator('.sheet [data-diff]').count() === 1, 'ingredient swap: difference table'); await p.locator('.sheet [data-x]').first().click();
  await p.locator('[data-act=portion][data-slot=snack]').click(); await p.waitForTimeout(200); await p.locator('.sheet [data-act=sc][data-v="1.5"]').click(); await p.waitForTimeout(150);
  ok(/הפרש/.test(await p.locator('.sheet').innerText()), 'portion size: difference table'); const before = await p.evaluate(() => Core.slotMacros(Core.plan(Store.today()).snack).k);
  await p.locator('.sheet [data-act=ok]').click(); await p.waitForTimeout(250); ok(await p.evaluate(() => Core.slotMacros(Core.plan(Store.today()).snack).k) > before, 'portion size changed');

  G = 'eating log & target change';
  await p.locator('[data-act=eat][data-slot=m1]').click(); await p.locator('.sheet [data-act=ok]').click(); await p.waitForTimeout(250);
  const eaten = await p.evaluate(() => JSON.stringify(Core.entries(Store.today())));
  const fut = await p.evaluate(() => JSON.stringify(Core.plan(Store.addDays(Store.today(), 3))));
  await go('#/profile'); await p.fill('#pf-w', '75'); await p.locator('[data-act=saveBasics]').click(); await p.waitForTimeout(300);
  ok(await p.evaluate(() => JSON.stringify(Core.plan(Store.addDays(Store.today(), 3)))) === fut, 'target change does not change menus by itself');
  await go('#/nutrition/' + await p.evaluate(() => Store.addDays(Store.today(), 1))); ok(await p.locator('[data-menu-pending]').count() === 1, 'banner offers to update the future menu');
  await p.locator('[data-act=menuUpdate]').click(); await p.waitForTimeout(300);
  const us = await p.locator('.sheet').innerText(); ok(/יעד קלוריות/.test(us) && /ממוצע מתוכנן/.test(us) && /לא ישתנו/.test(us), 'update sheet shows old → new and what stays');
  await p.locator('.sheet [data-act=ok]').click(); await p.waitForTimeout(400);
  ok(await p.evaluate(() => JSON.stringify(Core.plan(Store.addDays(Store.today(), 3)))) !== fut && await p.locator('[data-menu-pending]').count() === 0, 'future menu recalculated after approval');
  ok(await p.evaluate(() => JSON.stringify(Core.entries(Store.today()))) === eaten, 'eating log unchanged');

  G = 'preferences change the menu itself';
  await go('#/settings'); await p.locator('#pf-vg').check(); await p.locator('#pf-soy').check(); await p.locator('[data-act=savePrefs]').click(); await p.waitForTimeout(500);
  ok(await p.locator('.sheet [data-plan-menu-updated]').count() === 1, 'saving preferences updates the plan menu and says from when'); await p.locator('.sheet [data-x]').first().click();
  const viol = await p.evaluate(() => { const bad = new Set(['curd', 'hung_curd', 'milk', 'paneer', 'ghee', 'greek_yogurt', 'cottage', 'feta', 'mozzarella', 'egg', 'egg_white', 'chicken_breast', 'chicken_thigh', 'chicken_mince', 'salmon', 'white_fish', 'tuna_can', 'beef_lean', 'turkey', 'soya', 'tofu', 'edamame', 'soy_milk', 'soy_sauce']); let n = 0, slots = 0;
    for (let i = 1; i < 60; i++) { const d = Store.addDays(Store.today(), i), pl = Core.plan(d); ['m1', 'm2', 'snack', 'extra'].forEach(k => { const s = pl[k]; if (!s.rid || s.missing || s.off) return; slots++; Logic.recipeIngredients(Logic.recipe(s.rid), s.ov).forEach(x => { if (bad.has(x.f)) n++; }); }); } return { n, slots }; });
  ok(viol.n === 0 && viol.slots > 100, 'vegan + no soy: no excluded food in the next 59 days of menus', viol);
  await go('#/nutrition/' + await p.evaluate(() => Store.addDays(Store.today(), 2))); const t2 = await main();
  ok(/חסר|פער|אין במאגר/.test(t2), 'remaining gaps shown on the day (not "target reached")');

  G = 'recipes';
  await go('#/recipes'); await p.locator('[data-act=rf][data-f=intl]').click(); await p.waitForTimeout(250);
  const nIntl = await p.locator('.rcard').count(); ok(nIntl >= 60, nIntl + ' international recipes listed');
  await p.locator('[data-act=rf][data-f=fish]').click(); await p.waitForTimeout(250); ok(await p.locator('.rcard').count() >= 8, 'fish filter');
  await go('#/recipe/salmon_quinoa_edamame'); const rt = await main();
  ok(/אלרגנים: .*דגים/.test(rt) && /סויה/.test(rt) && /אסייתי/.test(rt) && /מחושבים מסכום המרכיבים/.test(rt) && /מנה אחת/.test(rt), 'recipe shows description facts: cuisine, allergens, serving, calculation method');
  ok(/אין עדיין צילום/.test(rt), 'missing photo shown as a labelled illustration');

  G = 'switch plan & history';
  await seed(); await p.reload(); await p.waitForTimeout(400);
  const d1 = await p.evaluate(() => Store.today()); await p.evaluate(() => Core.eatSlot(Store.today(), 'm2', 1)); const ev = await p.evaluate(() => JSON.stringify(Core.entries(Store.today())));
  await p.evaluate(() => Plans.activate(Plans.create('fatloss_30', Plans.paramsFromProfile(Store.load('profile')), Store.addDays(Store.today(), 1)), { confirmReplace: true }));
  ok(await p.evaluate(() => JSON.stringify(Core.entries(Store.today()))) === ev, 'switching plans keeps the eating log');
  ok(await p.evaluate(() => Core.plan(Store.addDays(Store.today(), 1)).planId === Plans.active().id), 'new plan menu from its start date');
  ok(await p.evaluate(() => Core.plan(Store.today()).source === 'plan'), 'today (before the new plan starts) keeps the previous plan menu, not the classic one');

  G = 'backup, offline, small screens';
  { const before = await p.evaluate(() => JSON.stringify(Array.from({ length: 5 }, (_, i) => Core.plan(Store.addDays(Store.today(), i)))));
    await go('#/settings'); await p.locator('[data-act=export]').click(); await p.waitForTimeout(300); const txt = await p.locator('.sheet #fo-t').inputValue(); await p.locator('.sheet [data-x]').click();
    await p.evaluate(() => Store.resetAll()); await p.reload(); await p.waitForTimeout(400);
    await go('#/settings'); await p.locator('[data-act=import]').click(); await p.fill('.sheet #im-t', txt); await p.locator('.sheet [data-act=go]').click(); await p.waitForTimeout(200); await p.locator('.sheet [data-act=ok]').click(); await p.waitForTimeout(500);
    ok(await p.evaluate(() => JSON.stringify(Array.from({ length: 5 }, (_, i) => Core.plan(Store.addDays(Store.today(), i))))) === before, 'restore reproduces the same menus'); }
  { const c4 = await b.newContext({ ...devices['iPhone 13'], locale: 'he-IL' }); const q = await c4.newPage(); const e4 = []; q.on('pageerror', e => e4.push(e.message));
    await q.goto(URL0); await q.waitForTimeout(1200); await q.reload(); await q.waitForTimeout(600);
    await q.evaluate(() => { const pr = Store.load('profile'); Object.assign(pr, { age: 30, height: 175, weight: 70, sex: 'f', experience: 'beginner', aims: { primary: 'general', secondary: [] } }); pr.availability = { days: [1, 3, 5], sessions: 3, maxMin: 30 }; Store.save('profile'); Plans.activate(Plans.create('annual', Plans.paramsFromProfile(pr), Store.today())); });
    await c4.setOffline(true); await q.reload(); await q.waitForTimeout(900);
    await q.evaluate(() => { location.hash = '#/nutrition/' + Store.addDays(Store.today(), 200); }); await q.waitForTimeout(500);
    ok(await q.locator('[data-menu-source=plan]').count() === 1 && await q.locator('.slot').count() >= 3, 'offline: menu for day 201 of a year plan');
    await q.evaluate(() => Core.eatSlot(Store.today(), 'snack', 1)); ok(await q.evaluate(() => Core.entries(Store.today()).length) === 1, 'offline: logging a meal works');
    await c4.setOffline(false); ok(e4.length === 0, 'no errors offline', e4); await c4.close(); }
  for (const w of [320, 375]) { const c3 = await b.newContext({ viewport: { width: w, height: 700 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'he-IL', serviceWorkers: 'block' }); const q = await c3.newPage();
    await q.goto(URL0); await q.evaluate(st => { localStorage.clear(); Object.entries(JSON.parse(st)).forEach(([k, v]) => localStorage.setItem(k, v)); }, await p.evaluate(() => JSON.stringify(Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)])))));
    await q.reload(); await q.waitForTimeout(400); const bad = [];
    for (const h of ['#/nutrition', '#/recipes', '#/recipe/fish_tacos', '#/settings', '#/setup/5']) { await q.evaluate(x => { location.hash = x; }, h); await q.waitForTimeout(300); if (!(await q.evaluate(() => document.documentElement.scrollWidth <= innerWidth))) bad.push(h); }
    await q.evaluate(() => { location.hash = '#/nutrition'; }); await q.waitForTimeout(300); await q.locator('[data-act=swapMeal][data-slot=m1]').click(); await q.waitForTimeout(200); await q.locator('.sheet [data-act=pick]:visible').first().click(); await q.waitForTimeout(200);
    if (!(await q.evaluate(() => document.documentElement.scrollWidth <= innerWidth))) bad.push('swap-confirm');
    ok(!bad.length, `no horizontal scroll at ${w}px`, bad); await c3.close(); }

  G = 'general';
  ok(!errs.some(e => /NOHANDLER/.test(e)), 'every button has a handler'); ok(errs.length === 0, 'no console errors', errs.slice(0, 3));
  await b.close();
  const pass = res.filter(r => r.ok).length, fail = res.length - pass, groups = {}; res.forEach(r => { groups[r.g] = groups[r.g] || { pass: 0, fail: 0 }; groups[r.g][r.ok ? 'pass' : 'fail']++; });
  fs.mkdirSync(path.join(__dirname, '../dist/reports'), { recursive: true }); fs.writeFileSync(path.join(__dirname, '../dist/reports/e2e-stageC.json'), JSON.stringify({ url: URL0, pass, fail, groups, results: res }, null, 1));
  res.filter(r => !r.ok).forEach(r => console.log('FAIL [' + r.g + '] ' + r.m)); console.log(JSON.stringify(groups)); console.log(`stage C e2e: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('crashed', e.stack); console.log(res.slice(-4).map(r => (r.ok ? 'PASS ' : 'FAIL ') + r.m).join('\n')); process.exit(2); });
