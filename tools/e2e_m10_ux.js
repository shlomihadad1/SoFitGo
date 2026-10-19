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
  const bk = await p.evaluate(() => { const o = JSON.parse(JSON.stringify(Store.exportAll())), good = Store.validateBackup(o); o.profile.mode = 'hack'; return { good, bad: Store.validateBackup(o) }; });
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

  /* ── Home header: no redundant visible "בית" ── */
  ({ ctx, p, errs } = await mk());
  await p.goto(URL0); await p.waitForTimeout(800);
  G = 'Home header';
  const hdr = async () => p.evaluate(() => { const h = document.querySelector('#top h1'), logo = document.querySelector('#top .brand-logo'), gear = document.querySelector('#top a[href="#/settings"]');
    const shown = h ? [...h.childNodes].filter(n => !(n.nodeType === 1 && n.classList.contains('sr-only') && n.getBoundingClientRect().width <= 1)).map(n => n.textContent).join('').trim() : null; /* text a sighted user can see (sr-only = 1px clipped) */
    return { visible: shown, a11y: h ? h.textContent.trim() : null, logo: !!logo, gear: !!gear, navHome: [...document.querySelectorAll('#nav a span')].map(x => x.textContent)[0], homeCur: !!document.querySelector('#nav a[href="#/"][aria-current=page]'), title: document.title, w: h ? Math.round(h.getBoundingClientRect().width) : 0 }; });
  let H = await hdr();
  ok(H.visible === '', 'Home: no visible "בית" in the top header', H);
  ok(H.a11y === 'בית', 'Home: the h1 keeps "בית" for screen readers only', H);
  ok(H.logo && H.gear && H.w > 20, 'Home: logo, settings and header layout unchanged', H);
  ok(H.navHome === 'בית' && H.homeCur, 'bottom navigation still has the "בית" tab, marked current', H);
  ok(/^בית · /.test(H.title), 'browser tab title unchanged', H.title);
  const vis = await p.evaluate(() => [...document.querySelectorAll('#top, #top *')].filter(e => e.children.length === 0 && e.offsetParent !== null && getComputedStyle(e).clip === 'auto' && /בית/.test(e.textContent)).length);
  ok(vis === 0, 'no other visible "בית" label in the header', vis);
  for (const [h, t] of [['#/nutrition', 'תזונה'], ['#/settings', 'הגדרות']]) { await go(p, h, 500); H = await hdr(); ok(H.visible.includes(t), `${h}: other screens still show their title`, H); }
  await go(p, '#/', 500); ok((await hdr()).visible === '', 'back on Home: still no visible label');
  allErrs.push(...errs); await ctx.close();

  /* ── water in liters + personal hydration target ── */
  ({ ctx, p, errs } = await mk());
  await ctx.addInitScript(() => { window.__geo = 0; try { const g = navigator.geolocation; if (g) { g.getCurrentPosition = () => { window.__geo++; }; g.watchPosition = () => { window.__geo++; return 0; }; } } catch (e) { } });
  await p.goto(URL0); await p.waitForTimeout(700);
  G = 'water: ml → liters';
  const conv = await p.evaluate(() => [0, 250, 500, 750, 1000, 1250, 2500, 3000].map(v => Core.fmtL(v)));
  ok(JSON.stringify(conv) === JSON.stringify(['0', '0.25', '0.5', '0.75', '1', '1.25', '2.5', '3']), '250 ml = 0.25 L, 500 = 0.5, 1000 = 1, 2500 = 2.5 (no trailing zeros)', conv);
  G = 'water: personal target';
  const T = await p.evaluate(() => { const set = o => { Store.resetAll(); localStorage.clear(); const pr = Store.load('profile'); Object.assign(pr, { startDate: Store.addDays(Store.today(), 30) }, o); Store.save('profile'); return Core.waterGoalOn(Store.today()); };
    return { none: set({}), m80: set({ weight: 80, age: 34, sex: 'm' }), vig: set({ weight: 80, age: 34, sex: 'm', activity: 'vigorous' }), old: set({ weight: 80, age: 70, sex: 'm' }), noAge: set({ weight: 60, sex: 'f' }), heavy: set({ weight: 160, age: 30 }),
      legacy: set({ weight: 80, age: 34, goals: { steps: null, water: 2500, sleep: 7.5 } }), manual: set({ weight: 80, age: 34, goals: { steps: null, water: 3200, waterMode: 'manual', sleep: 7.5 } }), auto3000: set({ weight: 80, age: 34, goals: { steps: null, water: 3000, sleep: 7.5 } }) }; });
  ok(T.none.ml === 1500 && T.none.est && !T.none.manual, 'no profile data → conservative general estimate (1.5 L), labelled as estimate', T.none);
  ok(T.m80.ml === 2250 && !T.m80.est, '80 kg, 34 y: 80×35 ml ×0.8 (food) = 2.24 → 2.25 L', T.m80);
  ok(T.vig.ml === 2750, 'very active: +0.5 L → 2.75 L', T.vig);
  ok(T.old.ml === 1500, 'age 70: 25 ml/kg → 1.6 → 1.5 L', T.old);
  ok(T.noAge.ml === 1500 && T.noAge.suggested.parts[0].includes('גיל לא ידוע'), '60 kg, age unknown: 30 ml/kg, says the age is missing', T.noAge);
  ok(T.heavy.ml === 4000, 'never above 4 L (no push to drink excessive amounts)', T.heavy);
  ok(T.legacy.manual && T.legacy.ml === 2500, 'a target typed before M10 (2500 ml) is kept as the user\'s own', T.legacy);
  ok(T.manual.manual && T.manual.ml === 3200 && T.manual.suggested.ml === 2250, 'manual target wins; the suggestion is still shown separately', T.manual);
  ok(!T.auto3000.manual && T.auto3000.ml === 2250, 'the untouched old default (3000) becomes the personal suggestion', T.auto3000);
  const wk = await p.evaluate(() => { Store.resetAll(); localStorage.clear(); const pr = Store.load('profile'); Object.assign(pr, { weight: 80, age: 34, sex: 'm', startDate: Store.today() }); Store.save('profile'); return { m: Core.workoutMinutesOn(Store.today()), g: Core.waterGoalOn(Store.today()) }; });
  ok(wk.m === 0 || wk.g.ml > 2250 && wk.g.suggested.parts.some(x => /אימון היום/.test(x)), 'on a workout day the target adds water for the session (and says so)', wk);
  G = 'water: Home, logging, remaining';
  await p.evaluate(() => { Store.resetAll(); localStorage.clear(); const pr = Store.load('profile'); Object.assign(pr, { weight: 80, age: 34, sex: 'm', startDate: Store.addDays(Store.today(), 30) }); Store.save('profile'); localStorage.setItem('fit30.welcomeDone', '1'); });
  await p.reload(); await p.waitForTimeout(800);
  const wt = () => p.evaluate(() => ({ total: document.querySelector('[data-water-total]').innerText.trim(), left: document.querySelector('[data-water-left]').innerText.trim(), kind: document.querySelector('[data-water-goal-kind]').innerText.trim(), stored: Core.daily(Store.today()).water || 0, dir: getComputedStyle(document.querySelector('[data-water]')).direction, btn: [...document.querySelectorAll('[data-water] [data-act=water]')].map(b => b.innerText.trim()) }));
  let W = await wt();
  ok(W.total === '0 מתוך 2.25 ליטר' && W.left === 'נותרו 2.25 ליטר' && /הצעה אישית/.test(W.kind), 'Home: "0 מתוך 2.25 ליטר", remaining, labelled as a personal suggestion', W);
  ok(W.btn.includes('+250 מ״ל') && W.btn.includes('+500 מ״ל'), 'quick-add stays in ml (+250 / +500 מ״ל)', W.btn);
  ok(W.dir === 'rtl', 'water block is right-to-left', W.dir);
  await p.locator('[data-water] [data-act=water][data-ml="250"]').click(); await p.waitForTimeout(300);
  await p.locator('[data-water] [data-act=water][data-ml="500"]').click(); await p.waitForTimeout(300);
  W = await wt();
  ok(W.total === '0.75 מתוך 2.25 ליטר' && W.left === 'נותרו 1.5 ליטר' && W.stored === 750, 'after +250 and +500: 0.75 L shown, 1.5 L remaining, stored as 750 ml (no double conversion)', W);
  const tp = await p.evaluate(() => Core.dailyProgress(Store.today()).tasks.find(t => t.k === 'water').v);
  ok(Math.abs(tp - 750 / 2250) < 1e-9, 'daily progress uses the same target (750/2250)', tp);
  ok(await p.evaluate(() => Core.daily(Store.today()).waterGoal) === 2250, 'the target in force is recorded with the day');
  G = 'water: history is not rewritten';
  const hist = await p.evaluate(() => { const y = Store.addDays(Store.today(), -1); Core.setDaily(y, { water: 1000, waterGoal: 2000 }); const pr = Store.load('profile'); pr.weight = 100; Store.save('profile');
    return { past: Core.waterGoalOn(y).ml, pastV: Core.dailyProgress(y).tasks.find(t => t.k === 'water').v, today: Core.waterGoalOn(Store.today()).ml, stored: Core.daily(y).water }; });
  ok(hist.past === 2000 && hist.pastV === 0.5 && hist.stored === 1000, 'yesterday keeps its own target (2 L) and amount after the profile changes', hist);
  ok(hist.today === 2750, 'today\'s target is recalculated from the new weight (100 kg → 2.75 L)', hist);
  G = 'water: manual target in Settings';
  await go(p, '#/settings', 700);
  ok(await p.evaluate(() => document.getElementById('g-w').value) === '2.75' && !(await p.isChecked('#g-wm')), 'Settings shows the target in liters (2.75), suggestion mode');
  ok(await p.evaluate(() => /הוראה רפואית/.test(document.querySelector('[data-water-goal]').innerText) && /הגבלת נוזלים/.test(document.querySelector('[data-water-goal]').innerText)), 'Settings: not a medical prescription; fluid-restriction caution shown');
  await p.check('#g-wm'); await p.fill('#g-w', '3.5'); await p.locator('[data-act=saveGoals]').click(); await p.waitForTimeout(400);
  const mg = await p.evaluate(() => ({ g: Store.load('profile').goals, on: Core.waterGoalOn(Store.today()) }));
  ok(mg.g.waterMode === 'manual' && mg.g.water === 3500 && mg.on.ml === 3500 && mg.on.manual, 'manual 3.5 L saved as 3500 ml and used', mg);
  await go(p, '#/', 600); ok((await wt()).total === '0.75 מתוך 3.5 ליטר' && /שקבעת/.test((await wt()).kind), 'Home shows the user\'s own target');
  await go(p, '#/settings', 700); await p.uncheck('#g-wm'); await p.locator('[data-act=saveGoals]').click(); await p.waitForTimeout(400);
  ok(await p.evaluate(() => Core.waterGoalOn(Store.today()).ml) === 2750, 'back to the personal suggestion');
  G = 'water: daily log in liters';
  await go(p, '#/progress', 900);
  if (await p.locator('#dl-w').count()) { ok(await p.evaluate(() => document.getElementById('dl-w').value) === '0.75', 'daily log shows 0.75 (liters)'); await p.fill('#dl-w', '1.5'); await p.locator('[data-act=saveDaily]').click(); await p.waitForTimeout(400);
    ok(await p.evaluate(() => Core.daily(Store.today()).water) === 1500, '1.5 L typed → 1500 ml stored'); } else ok(false, 'daily log field found');

  G = 'workout tips: no fake location';
  await go(p, '#/workouts', 900);
  const wtxt = await p.evaluate(() => document.querySelector('#view').innerText);
  ok(!/מנאלי|2,000|גובה של/.test(wtxt), 'workout screen has no city/altitude-specific tip (location is unknown)');
  ok(await p.evaluate(() => !PROGRAM.GENERAL_RULES.some(r => /מנאלי|גובה|מזג|חום/.test(r))), 'general workout rules contain no city, altitude or weather claim');
  for (const h of ['#/', '#/day/1', '#/nutrition', '#/progress', '#/settings']) await go(p, h, 400);
  ok(await p.evaluate(() => window.__geo) === 0, 'the app never asks for the device location');
  allErrs.push(...errs); await ctx.close();

  /* ── onboarding: field alignment, no flicker, values kept, full journey ── */
  for (const [w, h] of [[320, 640], [390, 844], [820, 1180]]) {
    const c = await b.newContext({ ...devices['iPhone 13'], viewport: { width: w, height: h }, locale: 'he-IL', serviceWorkers: 'block' }); const q = await c.newPage();
    await q.goto(URL0); await q.waitForTimeout(600); await q.evaluate(() => { localStorage.clear(); }); await q.reload(); await q.waitForTimeout(600);
    await q.evaluate(() => { location.hash = '#/setup/1'; }); await q.waitForTimeout(600);
    G = `onboarding fields aligned (${w}px)`;
    const al = await q.evaluate(() => { const r = id => document.getElementById(id).getBoundingClientRect(); const a = r('pf-age'), hh = r('pf-h'), cw = r('pf-w'), tw = r('pf-tw');
      return { rowTop1: Math.abs(a.top - hh.top), rowTop2: Math.abs(cw.top - tw.top), widths: [a.width, hh.width, cw.width, tw.width].map(Math.round), heights: [a.height, hh.height, cw.height, tw.height].map(Math.round), overflow: document.documentElement.scrollWidth > innerWidth, rtl: getComputedStyle(document.getElementById('pf-age').closest('.grid2')).direction }; });
    ok(al.rowTop1 < 1 && al.rowTop2 < 1, 'age/height and current/target weight inputs start on the same line', al);
    ok(new Set(al.widths).size === 1 && new Set(al.heights).size === 1, 'all four inputs have the same width and height', al);
    ok(!al.overflow && al.rtl === 'rtl', 'no sideways scroll; right-to-left', al);
    await c.close();
  }
  ({ ctx, p, errs } = await mk());
  await p.goto(URL0); await p.waitForTimeout(600); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(700);
  G = 'onboarding: no flicker, nothing lost';
  await go(p, '#/setup/1', 600);
  await p.fill('#pf-name', 'נועה'); await p.fill('#pf-age', '34'); await p.fill('#pf-h', '168'); await p.fill('#pf-w', '64.5'); await p.fill('#pf-tw', '60');
  const watch = () => p.evaluate(() => { window.__mut = { top: 0, view: 0, nav: 0 }; const o = (id, k) => new MutationObserver(m => { window.__mut[k] += m.length; }).observe(document.getElementById(id), { childList: true, subtree: true }); o('top', 'top'); o('nav', 'nav'); new MutationObserver(m => { window.__mut.view += m.filter(x => x.target.id === 'view').length; }).observe(document.getElementById('view'), { childList: true }); document.querySelector('#view section').__mark = 1; });
  await watch(); await p.locator('[data-act=xp][data-v=beginner]').click(); await p.waitForTimeout(300);
  let m1 = await p.evaluate(() => ({ mut: window.__mut, same: document.querySelector('#view section').__mark === 1, vals: ['pf-name', 'pf-age', 'pf-h', 'pf-w', 'pf-tw'].map(id => document.getElementById(id).value), pressed: document.querySelector('[data-act=xp][data-v=beginner]').getAttribute('aria-pressed'), xp: Store.load('profile').experience }));
  ok(m1.mut.top === 0 && m1.mut.nav === 0 && m1.mut.view === 0 && m1.same, 'choosing the experience level does not rebuild the screen, header or navigation', m1);
  ok(JSON.stringify(m1.vals) === JSON.stringify(['נועה', '34', '168', '64.5', '60']) && m1.pressed === 'true' && m1.xp === 'beginner', 'typed details stay; the choice is saved and shown', m1);
  await p.locator('[data-act=next]').click(); await p.waitForTimeout(500);
  ok(await p.evaluate(() => location.hash) === '#/setup/2', 'valid details → step 2');
  await p.locator('[data-act=gp]').first().click(); await p.waitForTimeout(300); await p.locator('[data-act=next]').click(); await p.waitForTimeout(500);
  await p.selectOption('#pf-max', '45'); await p.selectOption('#pf-pref', '30');
  await watch();
  for (const d of [0, 2, 4, 2]) { await p.locator(`[data-act=dw][data-v="${d}"]`).click(); await p.waitForTimeout(120); }
  await p.locator('[data-act=ses][data-v="2"]').click(); await p.waitForTimeout(200);
  const m3 = await p.evaluate(() => ({ mut: window.__mut, same: document.querySelector('#view section').__mark === 1, days: Store.load('profile').availability.days, ses: Store.load('profile').availability.sessions, max: document.getElementById('pf-max').value, pref: document.getElementById('pf-pref').value, y: scrollY,
    pressed: [...document.querySelectorAll('[data-act=dw]')].filter(b => b.getAttribute('aria-pressed') === 'true').map(b => +b.dataset.v), dis: [...document.querySelectorAll('[data-act=ses]')].filter(b => b.disabled).map(b => +b.dataset.v) }));
  ok(m3.mut.top === 0 && m3.mut.nav === 0 && m3.mut.view === 0 && m3.same, 'selecting / deselecting days and sessions: no re-render of the screen, header or navigation (no flicker)', m3);
  ok(JSON.stringify(m3.days) === '[0,4]' && JSON.stringify(m3.pressed) === '[0,4]' && m3.ses === 2, 'days 0,2,4 then deselect 2 → [0,4]; sessions 2 saved and shown', m3);
  ok(m3.max === '45' && m3.pref === '30', 'chosen times are not reset by day taps', m3);
  ok(JSON.stringify(m3.dis) === '[3,4,5,6]', 'sessions above the number of days are disabled in place', m3.dis);
  await p.locator('.setup-nav a.btn').click(); await p.waitForTimeout(500); ok(await p.evaluate(() => location.hash) === '#/setup/2', 'back → step 2');
  await p.locator('[data-act=next]').click(); await p.waitForTimeout(500);
  const back3 = await p.evaluate(() => ({ pressed: [...document.querySelectorAll('[data-act=dw]')].filter(b => b.getAttribute('aria-pressed') === 'true').map(b => +b.dataset.v), max: document.getElementById('pf-max').value }));
  ok(JSON.stringify(back3.pressed) === '[0,4]' && back3.max === '45', 'forward again: days and times are still there', back3);
  await go(p, '#/setup/1', 500); ok(await p.evaluate(() => ['pf-age', 'pf-h', 'pf-w', 'pf-tw'].map(id => document.getElementById(id).value).join()) === '34,168,64.5,60', 'back to step 1: personal details intact');
  G = 'onboarding: complete and persist';
  await go(p, '#/setup/3', 500); await p.locator('[data-act=next]').click(); await p.waitForTimeout(500);
  await p.locator('[data-act=tpl]:not([disabled])').first().click(); await p.waitForTimeout(300); await p.locator('[data-act=next]').click(); await p.waitForTimeout(900);
  await p.locator('[data-act=next]').click(); await p.waitForTimeout(900);
  ok(await p.evaluate(() => location.hash) === '#/setup/6', 'preview → confirmation step');
  await p.locator('[data-act=next]').click(); await p.waitForTimeout(900);
  const fin = await p.evaluate(() => ({ hash: location.hash, plan: !!Plans.active(), pr: (({ name, age, height, weight, targetWeight, experience, onboarded }) => ({ name, age, height, weight, targetWeight, experience, onboarded }))(Store.load('profile')) }));
  ok(fin.hash === '#/plan' && fin.plan && fin.pr.onboarded, 'finishing creates the plan and opens it', fin);
  await p.reload(); await p.waitForTimeout(900);
  const rl = await p.evaluate(() => ({ pr: (({ name, age, height, weight, targetWeight }) => ({ name, age, height, weight, targetWeight }))(Store.load('profile')), plan: !!Plans.active() }));
  ok(JSON.stringify(rl.pr) === JSON.stringify({ name: 'נועה', age: 34, height: 168, weight: 64.5, targetWeight: 60 }) && rl.plan, 'after reload the saved profile and plan are still there (device storage in this build)', rl);
  await go(p, '#/', 600); ok(await p.locator('[data-welcome]').count() === 0, 'a completed profile is not sent through the welcome again');
  G = 'profile screen: typed values survive day taps';
  await go(p, '#/profile', 1200);
  await p.fill('#pf-age', '41'); await p.locator('[data-act=dw][data-v="1"]').click(); await p.waitForTimeout(400);
  ok(await p.evaluate(() => document.getElementById('pf-age').value) === '41', 'an unsaved age is kept when a workout day is toggled (was lost before M10)');
  allErrs.push(...errs); await ctx.close();

  G = 'errors'; ok(!allErrs.length, 'no page errors', allErrs);
  await b.close();
  const fail = res.filter(r => !r.ok); res.forEach(r => console.log((r.ok ? 'PASS ' : 'FAIL ') + `[${r.g}] ${r.m}`));
  console.log(`m10 ux e2e: pass ${res.length - fail.length} fail ${fail.length}`); process.exit(fail.length ? 1 : 0);
})().catch(e => { console.error('m10 ux e2e crashed in [' + G + ']: ' + e.message.split('\n')[0]); process.exit(2); });
