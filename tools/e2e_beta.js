/* RC4 beta smoke test — the core user journey, through the UI, on emulated phones (Playwright Chromium with device emulation;
   NOT Safari, NOT a physical device). Flow: new user → setup steps 1–6 → plan active → view plan and a day → nutrition: swap a
   meal (totals and gap banner agree) → update data (weight, water) → reopen (reload + new tab in the same browser profile) →
   everything kept. Plus RTL/Hebrew and "no sideways scroll" on 320 / 390 / 430 px widths, and the TD-22 banner wording.
   Usage: node tools/e2e_beta.js [URL]  — writes dist/reports/e2e-beta.json */
const { chromium, devices } = require('playwright'); const fs = require('fs'), path = require('path');
const URL0 = process.argv[2] || 'http://localhost:8096/';
const res = []; let G = ''; const ok = (c, m, i) => res.push({ g: G, ok: !!c, m: m + (i !== undefined && !c ? ' → ' + JSON.stringify(i).slice(0, 300) : '') });
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'he-IL', serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const go = async h => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(350); };
  const main = () => p.locator('main').innerText(); const next = async () => { await p.locator('[data-act=next]').click(); await p.waitForTimeout(350); };
  await p.goto(URL0); await p.waitForTimeout(600); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(600);

  G = 'Hebrew / RTL';
  ok(await p.evaluate(() => document.documentElement.dir === 'rtl' && document.documentElement.lang === 'he'), 'document is dir=rtl, lang=he');
  ok(await p.evaluate(() => getComputedStyle(document.body).direction === 'rtl'), 'body renders right-to-left');

  G = 'create a plan (setup 1–6)';
  await go('#/setup/1'); await p.fill('#pf-age', '34'); await p.fill('#pf-h', '172'); await p.fill('#pf-w', '78'); await p.locator('[data-act=xp][data-v=beginner]').click(); await p.waitForTimeout(250); await next();
  ok(await p.evaluate(() => location.hash) === '#/setup/2', 'step 1 → 2');
  await p.locator('[data-act=gp][data-v=general]').click(); await p.waitForTimeout(200); await next();
  for (const d of [1, 3, 5]) { await p.locator(`[data-act=dw][data-v="${d}"]`).click(); await p.waitForTimeout(120); }
  await p.locator('[data-act=ses][data-v="3"]').click(); await p.waitForTimeout(150); await p.selectOption('#pf-pref', '30'); await p.selectOption('#pf-max', '45'); await next();
  ok(await p.evaluate(() => location.hash) === '#/setup/4', 'step 3 → 4', { hash: await p.evaluate(() => location.hash), err: await p.locator('[data-err]').allInnerTexts() });
  await p.locator('[data-act=tpl][data-v=general_90]').click(); await p.waitForTimeout(200); await next();
  ok(/מבנה השלבים/.test(await main()), 'plan preview shown before activation'); await next();
  ok(/הפעלת התוכנית/.test(await main()), 'confirmation step'); await next(); await p.waitForTimeout(300);
  ok(await p.evaluate(() => !!Plans.active() && location.hash === '#/plan'), 'plan active, opened on the plan screen');

  G = 'view the plan';
  const n1 = await p.evaluate(() => Plans.days(Plans.active()).find(d => Plans.isTraining(d)).n);
  ok((await main()).length > 50 && await p.locator('a[href^="#/pday/"]').count() > 0, 'plan screen lists plan days');
  await go('#/pday/' + n1); ok(/סט|חזרות|שנ׳/.test(await main()), `training day ${n1} opens with exercises`);
  await go('#/calendar'); ok(await p.locator('.pc-d[href]').count() > 0, 'calendar shows plan days');

  G = 'swap a meal';
  await go('#/nutrition'); const today = await p.evaluate(() => Store.today());
  const before = await p.evaluate(d => ({ rid: Core.plan(d).m2.rid, k: Core.plannedTotals(d, 'base').k }), today);
  await p.locator('[data-act=swapMeal][data-slot=m2]').click(); await p.waitForTimeout(300);
  const pick = p.locator('.sheet [data-act=pickMeal], .sheet [data-act=pick]').first(); if (await pick.count()) { await pick.click(); await p.waitForTimeout(350); }
  const ok2 = p.locator('.sheet [data-act=ok], .sheet [data-act=confirm]').first(); if (await ok2.count()) { await ok2.click(); await p.waitForTimeout(350); }
  const after = await p.evaluate(d => ({ rid: Core.plan(d).m2.rid, k: Core.plannedTotals(d, 'base').k, gap: Core.plan(d).gap, t: Core.targets() }), today);
  ok(after.rid !== before.rid, 'the main meal was replaced through the UI', { before, after });
  const banner = await p.locator('[data-menu-gap]').count(), out = after.k < after.t.kcal * 0.93 || after.k > after.t.kcal * 1.07;
  ok(!!(after.gap && (after.gap.kLow || after.gap.kHigh)) === out, 'calorie gap ⇔ displayed total outside ±7 % (right after the swap)', after);
  ok((banner > 0) === !!(after.gap && (after.gap.p || after.gap.kLow || after.gap.kHigh)), 'gap banner on screen ⇔ gap on the day');
  /* TD-22 wording: force a large shortfall on a future day, open it, check the banner says "after your changes" */
  const day2 = await p.evaluate(() => Store.addDays(Store.today(), 2));
  await p.evaluate(d => { const light = NUTRI.RECIPES.filter(r => r.meal === 'm2' && !r.est).map(r => ({ id: r.id, k: Logic.recipeMacros(r).k })).sort((a, b) => a.k - b.k)[0].id; Core.setPlanSlot(d, 'm2', { rid: light }); }, day2);
  await p.reload(); await p.waitForTimeout(500); await go('#/nutrition/' + day2);
  const bannerTxt = (await p.locator('[data-menu-gap]').allInnerTexts()).join(' ');
  ok(/אחרי השינויים בתפריט של היום/.test(bannerTxt) && /חסרות כ־/.test(bannerTxt), 'the gap banner is on screen and worded "after your changes"', bannerTxt.slice(0, 160));
  const d2 = await p.evaluate(d => ({ k: Core.plannedTotals(d, 'base').k, gap: Core.plan(d).gap, edited: Core.plan(d).gapEdited, t: Core.targets().kcal }), day2);
  ok(d2.gap && d2.gap.kLow === d2.t - d2.k && d2.edited === true, `after a swap to the lightest dish: ${d2.k} of ${d2.t} kcal → calorie gap ${d2.gap && d2.gap.kLow}, marked "edited"`, d2);

  G = 'update data';
  await go('#/'); await p.fill('#h-w', '77.6'); await p.locator('[data-act=saveWeight]').click(); await p.waitForTimeout(250);
  await p.locator('[data-act=water][data-ml="250"]').first().click(); await p.waitForTimeout(200);
  ok(await p.evaluate(() => Core.measures().some(m => m.date === Store.today() && Math.abs(m.weight - 77.6) < 0.01) && Core.daily(Store.today()).water === 250), 'weight and water saved');

  G = 'reopen';
  const snap = await p.evaluate(d => JSON.stringify({ plan: Plans.active().id, m2: Core.plan(d).m2.rid, w: Core.measures().find(m => m.date === Store.today()).weight }), today);
  await p.reload(); await p.waitForTimeout(600);
  ok(await p.evaluate(d => JSON.stringify({ plan: Plans.active().id, m2: Core.plan(d).m2.rid, w: Core.measures().find(m => m.date === Store.today()).weight }), today) === snap, 'after reload: same plan, swapped meal and weight');
  const p2 = await ctx.newPage(); await p2.goto(URL0); await p2.waitForTimeout(700);
  ok(await p2.evaluate(d => JSON.stringify({ plan: Plans.active().id, m2: Core.plan(d).m2.rid, w: Core.measures().find(m => m.date === Store.today()).weight }), today) === snap, 'new tab in the same browser profile: everything kept');
  ok(await p2.locator('.plan-today, [data-coach]').count() > 0, 'home opens on the active plan'); await p2.close();

  G = 'mobile layout';
  for (const w of [320, 390, 430]) { await p.setViewportSize({ width: w, height: 800 });
    for (const h of ['#/', '#/plan', '#/nutrition', '#/calendar', '#/profile']) { await go(h); const o = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); ok(o <= 1, `${w}px ${h}: no sideways scroll`, o); } }

  G = 'general'; ok(errs.length === 0, 'no page errors', errs.slice(0, 3));
  await b.close();
  const pass = res.filter(r => r.ok).length, fail = res.length - pass; res.filter(r => !r.ok).forEach(r => console.log('FAIL [' + r.g + '] ' + r.m));
  const out2 = path.join(__dirname, '..', 'dist/reports'); fs.mkdirSync(out2, { recursive: true }); fs.writeFileSync(path.join(out2, 'e2e-beta.json'), JSON.stringify({ url: URL0, pass, fail, res }, null, 1));
  console.log(`beta e2e: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
