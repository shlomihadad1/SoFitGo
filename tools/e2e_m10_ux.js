/* M10 · UX fixes: setup Continue bar vs. the on-screen keyboard, nutrition-only mode (zero workouts), simplified meal card
   (one primary "החלף מנה"). Playwright Chromium with iPhone emulation — NOT Safari, NOT a real device. The real keyboard
   cannot be opened in emulation; the keyboard state is the app's own body.kb flag (set on focus), and a shorter viewport
   stands in for the space the keyboard takes.
   Usage: node tools/e2e_m10_ux.js [URL] */
const { chromium, devices } = require('playwright');
const URL0 = process.argv[2] || 'http://localhost:8096/';
const res = []; let G = ''; const ok = (c, m, i) => res.push({ g: G, ok: !!c, m: m + (i !== undefined && !c ? ' → ' + JSON.stringify(i).slice(0, 400) : '') });
const BASICS = () => { Store.resetAll(); localStorage.clear(); const pr = Store.load('profile'); Object.assign(pr, { age: 34, height: 176, weight: 80, startWeight: 80, sex: 'm', experience: 'beginner', aims: { primary: 'general', secondary: [] } }); Store.save('profile'); };
const SEED_PLAN = () => { const pr = Store.load('profile'); pr.availability = { days: [0, 1, 2, 3, 4, 5, 6], sessions: 3, prefMin: null, maxMin: 45 }; Store.save('profile');
  Plans.activate(Plans.create('general_90', Plans.paramsFromProfile(pr), Store.today()), { confirmReplace: true }); };
(async () => {
  const b = await chromium.launch();
  const mk = async (h) => { const ctx = await b.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: h || 844 }, locale: 'he-IL', serviceWorkers: 'block' }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); return { ctx, p, errs }; };
  const go = async (p, h, ms) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(ms || 450); };
  const allErrs = [];

  /* ── keyboard / Continue bar ── */
  let { ctx, p, errs } = await mk(420); /* ~844 minus a typical iPhone keyboard */
  await p.goto(URL0); await p.waitForTimeout(700); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(800);
  G = 'keyboard: setup Continue bar';
  await go(p, '#/setup/1', 700);
  const navPos = () => p.evaluate(() => getComputedStyle(document.querySelector('.setup-nav')).position);
  ok(await navPos() === 'sticky', 'without the keyboard the Continue bar stays reachable (sticky)');
  const fields = await p.evaluate(() => [...document.querySelectorAll('#view input:not([type=checkbox]):not([type=radio]):not([type=file]), #view select, #view textarea')].filter(e => e.offsetParent && e.tagName !== 'SELECT').map(e => '#' + e.id).filter(x => x !== '#'));
  ok(fields.length >= 3, 'setup step 1 has text fields to test', fields);
  let covered = [], hidden = [];
  for (const f of fields) {
    await p.focus(f); await p.waitForTimeout(450);
    const r = await p.evaluate(sel => { const el = document.querySelector(sel), n = document.querySelector('.setup-nav'), a = el.getBoundingClientRect(), c = n.getBoundingClientRect(), vh = window.innerHeight;
      return { kb: document.body.classList.contains('kb'), pos: getComputedStyle(n).position, overlap: !(c.bottom <= a.top || c.top >= a.bottom), inView: a.top >= 0 && a.bottom <= vh, nav: getComputedStyle(document.querySelector('.nav')).display }; }, f);
    if (!r.kb || r.pos !== 'static' || r.nav !== 'none') covered.push({ f, r });
    if (r.overlap) covered.push({ f, overlap: true }); if (!r.inView) hidden.push({ f, r });
  }
  ok(!covered.length, 'while typing: keyboard state on, Continue bar not sticky, bottom tabs hidden, bar never overlaps the field', covered);
  ok(!hidden.length, 'the focused field is scrolled into the visible area', hidden);
  await p.evaluate(() => document.activeElement.blur()); await p.waitForTimeout(600);
  ok(await navPos() === 'sticky' && !(await p.evaluate(() => document.body.classList.contains('kb'))), 'after the keyboard closes the Continue bar is sticky again');
  allErrs.push(...errs); await ctx.close();

  /* ── nutrition-only mode ── */
  ({ ctx, p, errs } = await mk());
  await p.goto(URL0); await p.waitForTimeout(700); await p.evaluate(BASICS); await p.reload(); await p.waitForTimeout(800);
  G = 'nutrition-only: choose zero workouts';
  await go(p, '#/setup/3', 700);
  ok(await p.locator('[data-nowo-off] [data-act=nowo]').count() === 1, 'setup step 3 offers "תזונה בלבד"');
  await p.locator('[data-nowo-off] [data-act=nowo]').click(); await p.waitForTimeout(400);
  ok(await p.locator('[data-nowo-on]').count() === 1 && await p.locator('.dows').count() === 0, 'with "תזונה בלבד" the days/sessions questions disappear');
  ok((await p.locator('[data-act=next]').textContent()).includes('סיום — תזונה בלבד'), 'Continue becomes "סיום — תזונה בלבד" (no workout questions are required)');
  await p.locator('[data-act=next]').click(); await p.waitForTimeout(600);
  const st = await p.evaluate(() => ({ hash: location.hash, mode: Store.load('profile').mode, onb: Store.load('profile').onboarded, plans: Plans.active() }));
  ok((st.hash === '#/' || st.hash === '') && st.mode === 'nutrition' && st.onb === true && !st.plans, 'setup finishes on Home, mode saved, no plan created', st);
  G = 'nutrition-only: Home and NOW';
  const home = await p.evaluate(() => ({ card: !!document.querySelector('[data-nutrition-only]'), start: document.querySelectorAll('[data-act=start],[data-act=planStart]').length, txt: document.querySelector('#view').textContent,
    tasks: Core.dailyProgress(Store.today()).tasks.map(t => t.k), next: Screens.nowModel(Store.today()).next }));
  ok(home.card, 'Home shows the nutrition-only card');
  ok(home.start === 0 && !/התחל אימון|האימון של היום/.test(home.txt), 'no workout card and no "start workout" button on Home', home.start);
  ok(!home.tasks.includes('workout') && home.tasks.includes('m1'), 'daily progress counts meals/water/sleep — no workout task', home.tasks);
  ok(!home.next || home.next.k !== 'workout', 'NOW never suggests a workout', home.next);
  await p.reload(); await p.waitForTimeout(800);
  ok(await p.locator('[data-nutrition-only]').count() === 1, 'the choice survives a reload');
  const bk = await p.evaluate(() => { const o = Store.exportAll(), good = Store.validateBackup(o); o.profile.mode = 'hack'; return { good, bad: Store.validateBackup(o) }; });
  ok(!bk.good && typeof bk.bad === 'string', 'backups keep the mode; an invalid mode value is rejected on restore', bk);
  G = 'nutrition-only: add workouts later';
  await p.locator('[data-add-workouts]').click(); await p.waitForTimeout(600);
  ok(await p.evaluate(() => location.hash) === '#/setup/3' && await p.locator('[data-nowo-on]').count() === 1, '"להוסיף אימונים" opens setup step 3');
  await p.locator('[data-nowo-on] [data-act=nowo]').click(); await p.waitForTimeout(400);
  ok(await p.evaluate(() => Store.load('profile').mode) === undefined && await p.locator('.dows').count() === 1, 'switching back restores the workout questions; mode cleared');
  await p.evaluate(() => { const pr = Store.load('profile'); pr.mode = 'nutrition'; Store.save('profile'); });
  await p.evaluate(SEED_PLAN); await go(p, '#/', 600);
  ok(await p.evaluate(() => !Core.nutritionOnly()) && await p.locator('[data-nutrition-only]').count() === 0, 'an activated personal plan always wins over the nutrition-only flag');
  await go(p, '#/setup/3', 600);
  ok(await p.locator('[data-nowo-off],[data-nowo-on]').count() === 0, 'with an active plan the option is not offered (pause the plan instead)');

  G = 'meal card: one primary action';
  await go(p, '#/nutrition', 900);
  const mc = await p.evaluate(() => [...document.querySelectorAll('.slot')].filter(s => s.querySelector('[data-act=swapMeal]') && s.querySelector('[data-act=eat]')).map(s => ({
    prim: [...s.querySelectorAll('.btn.primary')].map(x => x.dataset.act), swapTxt: s.querySelector('[data-act=swapMeal]').textContent.trim(),
    more: [...s.querySelectorAll('[data-meal-more] .btn')].map(x => (x.dataset.act || 'recipe') + ':' + x.classList.contains('ghost')) })));
  ok(mc.length >= 2, 'menu has meal cards', mc.length);
  ok(mc.every(m => m.prim.length === 1 && m.prim[0] === 'swapMeal'), 'each meal card has exactly one primary button: "החלף מנה"', mc);
  ok(mc.every(m => /החלף מנה/.test(m.swapTxt)), 'label is "החלף מנה"', mc.map(m => m.swapTxt));
  ok(mc.every(m => m.more.includes('swapIng:true') && m.more.includes('recipe:true')), 'fine-tuning (ingredient, portion, recipe) stays available as quiet secondary buttons', mc.map(m => m.more));
  await p.locator('.slot [data-act=eat]').first().click(); await p.waitForTimeout(600);
  const sh = await p.evaluate(() => !!document.querySelector('.sheet-bg')); if (sh) { const y = p.locator('.sheet-bg [data-act=yes], .sheet-bg .btn.primary').first(); if (await y.count()) await y.click(); await p.waitForTimeout(500); }
  const eaten = await p.evaluate(() => { const s = [...document.querySelectorAll('.slot')].find(x => x.querySelector('[data-eaten]')); return s ? s.querySelectorAll('.btn.primary').length : -1; });
  ok(eaten === 0, 'after "סמן שאכלתי" the swap is no longer primary on that meal', eaten);
  allErrs.push(...errs); await ctx.close();

  G = 'errors'; ok(!allErrs.length, 'no page errors', allErrs);
  await b.close();
  const fail = res.filter(r => !r.ok); res.forEach(r => console.log((r.ok ? 'PASS ' : 'FAIL ') + `[${r.g}] ${r.m}`));
  console.log(`m10 ux e2e: pass ${res.length - fail.length} fail ${fail.length}`); process.exit(fail.length ? 1 : 0);
})().catch(e => { console.error('m10 ux e2e crashed in [' + G + ']: ' + e.message.split('\n')[0]); process.exit(2); });
