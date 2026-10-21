/* M12 · Plan Integrity Gate + Constraint Conflict Resolver + explanation mode + extended Travel Mode.
   Usage: [BROWSER=webkit] node tools/e2e_m12_gate.js [URL] */
const pw = require('playwright'), { devices } = pw; const ENGINE = process.env.BROWSER || 'chromium';
const URL0 = process.argv[2] || 'http://localhost:8096/';
const res = []; let G = ''; const ok = (c, m, i) => res.push({ g: G, ok: !!c, m: m + (i !== undefined && !c ? ' → ' + JSON.stringify(i).slice(0, 500) : '') });
const BASICS = () => { Store.resetAll(); localStorage.clear(); const pr = Store.load('profile'); Object.assign(pr, { age: 34, height: 176, weight: 80, startWeight: 80, sex: 'm', experience: 'beginner', aims: { primary: 'general', secondary: [] }, environment: { place: 'home', equipment: [], custom: [] } }); Store.save('profile'); };
(async () => {
  const b = await pw[ENGINE].launch(); console.log('engine: ' + ENGINE); const errs = [];
  const ctx = await b.newContext({ ...devices['iPhone 13'], viewport: { width: 375, height: 760 }, locale: 'he-IL', serviceWorkers: 'block' }); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL0); await p.waitForTimeout(700); await p.evaluate(BASICS); await p.reload(); await p.waitForTimeout(800);
  const go = async (h, ms) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(ms || 900); };
  const loadExtra = () => p.evaluate(() => App.loadChunk('extra.js')); await loadExtra();

  G = 'gate rules';
  const r1 = await p.evaluate(() => { const dumb = EXERCISES.find(e => CATALOG.exMeta(e.id).eq.includes('chair')), jump = EXERCISES.find(e => CATALOG.exMeta(e.id).impact === 'high'), sq = 'squat';
    const pr = Core.profile(); pr.exercisePrefs = { fav: [], exclude: [sq], noJump: true }; pr.availability = Object.assign({}, pr.availability, { maxMin: 12 }); Store.save('profile');
    const def = { title: 't', warm: [], main: [{ ex: dumb.id, sets: 2, reps: 10 }, { ex: sq, sets: 3, reps: 10 }, { ex: jump.id, sets: 2, reps: 10 }].concat(Array.from({ length: 5 }, () => ({ ex: 'pushup', sets: 4, reps: 12, rest: 60 }))), cool: [] };
    const g = Gate.checkWorkout(def, {}); return { kinds: g.issues.map(x => x.kind + ':' + x.sev), ok: g.ok }; });
  ok(r1.kinds.includes('equipment:warn') && r1.kinds.includes('excluded:block') && r1.kinds.includes('impact:warn') && r1.kinds.includes('time:warn') && !r1.ok, 'excluded = block; home item not ticked (chair) / no-jump / time = warning', r1);
  ok(await p.evaluate(() => { const e = { id: 'x_fake' }; const r = Gate.exIssues('pushup', { equipment: ['none'], exclude: [], noJump: false }); return r.length === 0; }), 'bodyweight exercise passes');
  const unk = await p.evaluate(() => { const pr = Core.profile(); const env0 = pr.environment; pr.environment = { place: null, equipment: [], custom: [] }; Store.save('profile'); const g = Gate.checkWorkout(Core.dayDef(3), {}); pr.environment = env0; pr.exercisePrefs = { fav: [], exclude: [], noJump: false }; pr.availability = Object.assign({}, pr.availability, { maxMin: null }); Store.save('profile'); return g; });
  ok(unk.unknown.includes('ציוד') && !unk.issues.some(x => x.kind === 'equipment'), 'equipment never set → not checked, listed as unknown (nothing invented)', unk);
  const meal = await p.evaluate(() => { const pr = Core.profile(); pr.prefs = Object.assign(Core.normPrefs(pr.prefs), { dairy: false }); Store.save('profile'); const r = NUTRI.RECIPES.find(x => x.ing.some(i => i.f === 'paneer')); const g = Gate.checkMeal(r); pr.prefs = Core.normPrefs({}); Store.save('profile'); return g; });
  ok(!meal.ok && meal.issues[0].kind === 'restriction', 'restricted food = block for meals', meal);
  const goals = await p.evaluate(() => { const pr = Core.profile(); pr.aims = { primary: 'fat_loss', secondary: [] }; pr.targetWeight = 90; Store.save('profile'); const g = Gate.checkGoals(); return { g, html: GateUI.panel(g, {}) }; });
  ok(goals.g.issues.some(x => x.kind === 'goal-weight' && x.ask) && /data-gate-ask/.test(goals.html) && /לא משנים כלום בלי ההחלטה שלך/.test(goals.html), 'contradicting goal → one focused question, nothing changed', goals.g);
  ok(await p.evaluate(() => Core.profile().aims.primary === 'fat_loss' && Core.profile().targetWeight === 90), 'profile untouched by the check');
  await p.evaluate(() => { const pr = Core.profile(); pr.aims = { primary: 'general', secondary: [] }; pr.targetWeight = null; Store.save('profile'); });

  G = 'workout start: resolver';
  const ex3 = await p.evaluate(() => Core.dayDef(3).main[0].ex);
  await p.evaluate(ex => { const pr = Core.profile(); pr.exercisePrefs = { fav: [], exclude: [ex], noJump: false }; Store.save('profile'); }, ex3);
  await go('#/day/3'); await p.locator('.seg [data-v=std]').click(); await p.locator('[data-act=start]').click(); await p.locator('.sheet [data-run-gate]').waitFor({ timeout: 5000 });
  ok(await p.locator('.sheet [data-gate-kind=excluded]').count() === 1, 'excluded exercise found before the workout starts');
  ok(/להתחיל בכל זאת/.test(await p.locator('.sheet [data-act=go]').innerText()), 'start is still possible, labelled "start anyway"');
  const fix = p.locator('.sheet [data-gate-kind=excluded] [data-fix=swap]').first();
  ok(await fix.count() === 1, 'a concrete alternative is offered');
  const to = await fix.getAttribute('data-to'); await fix.click(); await p.locator('.sheet [data-run-gate]').waitFor({ timeout: 5000 }); await p.waitForTimeout(300);
  ok(await p.evaluate(([ex, t]) => (Store.load('workouts').swaps[3] || {})[ex] === t, [ex3, to]), 'swap saved through the existing per-day swap');
  ok(await p.locator('.sheet [data-gate-kind=excluded]').count() === 0 && await p.locator('.sheet [data-gate=block]').count() === 0 && /התחלת אימון/.test(await p.locator('.sheet [data-act=go]').innerText()), 're-checked: the conflict is gone (remaining notes are warnings only)', await p.locator('.sheet [data-run-gate]').innerText());
  await p.evaluate(() => document.querySelectorAll('.sheet-bg').forEach(x => x.remove()));
  await p.evaluate(() => { const pr = Core.profile(); pr.exercisePrefs = { fav: [], exclude: [], noJump: false }; pr.availability = Object.assign({}, pr.availability, { maxMin: 12 }); Store.save('profile'); });
  await go('#/day/4'); await go('#/day/3'); await p.locator('.seg [data-v=std]').click(); await p.locator('[data-act=start]').click(); await p.locator('.sheet [data-run-gate]').waitFor();
  ok(await p.locator('.sheet [data-gate-kind=time] [data-fix=short]').count() === 1, 'not enough time → "shorter version" offered');
  await p.locator('.sheet [data-gate-kind=time] [data-fix=short]').click(); await p.locator('.sheet [data-run-setup]').waitFor(); await p.locator('.sheet [data-mode=manual]').click(); await p.locator('.sheet [data-act=go]').click(); await p.waitForTimeout(400);
  ok(await p.evaluate(() => (Store.load('session') || {}).version === 'short'), 'workout runs as the short version');
  await p.evaluate(() => { Store.clearSession(); document.querySelector('.run') && document.querySelector('.run').remove(); document.body.style.overflow = ''; const pr = Core.profile(); pr.availability = Object.assign({}, pr.availability, { maxMin: null }); Store.save('profile'); });

  G = 'plan check before activation';
  const pc = await p.evaluate(() => { const pr = Store.load('profile'); pr.availability = { days: [0, 1, 2, 3, 4, 5, 6], sessions: 3, prefMin: null, maxMin: 45 }; Store.save('profile');
    const plan = Plans.create('general_90', Plans.paramsFromProfile(pr), Store.today()), pv = Plans.preview(plan), clean = Gate.checkPlan(plan, pv.days);
    const t = pv.days.find(d => (d.main || []).length), victim = t.main[0].ex; const p2 = JSON.parse(JSON.stringify(plan)); p2.segments[0].params.exclude = [victim]; /* the user's constraint says "no <victim>", the generated days still contain it */
    const broken = Gate.checkPlan(p2, pv.days); return { clean: clean.ok, cleanN: clean.issues.filter(x => x.sev === 'block').length, broken: broken.ok, kinds: broken.issues.map(x => x.kind), days: (broken.issues.find(x => x.kind === 'excluded') || {}).days }; });
  ok(pc.clean && pc.cleanN === 0, 'a generated plan passes the independent check', pc);
  ok(!pc.broken && pc.kinds.includes('excluded') && pc.days && pc.days.length >= 1, 'a plan that contradicts a constraint is caught (with its day numbers)', pc);

  G = 'meals through the gate + why';
  await go('#/nutrition'); await p.locator('[data-act=swapMeal][data-slot=m2]').click(); await p.locator('.sheet [data-meal-opts]').waitFor();
  await p.locator('.sheet [data-opt-list] [data-act=pick]').first().click(); await p.waitForTimeout(250);
  const why = await p.locator('.sheet [data-why-meal]').innerText();
  ok(/למה המנה הזו/.test(why) && /מתאימה להגבלות/.test(why) && await p.locator('.sheet [data-why-meal] [data-tag=data]').count() === 1, '"why this dish" from real data, tagged as based on your settings', why);
  await p.locator('.sheet [data-act=no]').click();

  G = 'explanation mode';
  await p.evaluate(() => { const pr = Core.profile(); pr.display = Object.assign({}, pr.display, { run: { mode: 'auto', setRest: 30, exRest: null, countdown: 3, voice: false } }); Store.save('profile'); });
  await go('#/settings'); await p.selectOption('#d-exp', 'detail'); await p.waitForTimeout(250);
  const dsp = await p.evaluate(() => Core.profile().display);
  ok(dsp.explain === 'detail' && dsp.run && dsp.run.mode === 'auto', 'saved; workout preferences kept (bug fixed: display settings used to drop them)', dsp);
  const det = await p.evaluate(() => GateUI.panel(Gate.checkWorkout({ main: [{ ex: 'squat', sets: 9, reps: 30, rest: 90 }].concat(Array(8).fill({ ex: 'pushup', sets: 6, reps: 20, rest: 90 })) }, { minutes: 5 }), {}));
  ok(/למה: /.test(det) && !/<summary>למה\?/.test(det), 'detail mode: reasons shown inline');
  await p.evaluate(() => { Core.profile().display.explain = 'short'; Store.save('profile'); });
  const sh = await p.evaluate(() => GateUI.panel(Gate.checkWorkout({ main: [{ ex: 'squat', sets: 9, reps: 30, rest: 90 }].concat(Array(8).fill({ ex: 'pushup', sets: 6, reps: 20, rest: 90 })) }, { minutes: 5 }), {}));
  ok(/<summary>למה\?/.test(sh), 'short mode: reasons behind "למה?"');

  G = 'travel mode';
  await go('#/travel', 1300);
  const t0 = await p.evaluate(() => Store.today()), t3 = await p.evaluate(() => Store.addDays(Store.today(), 3));
  await p.fill('#tr-from', t0); await p.fill('#tr-to', t3); await p.selectOption('#tr-min', '10'); await p.locator('[data-act=tripSave]').click(); await p.waitForTimeout(400);
  ok(await p.evaluate(() => !!Gate.trip() && Gate.trip().minutes === 10 && Gate.trip().eq.length === 0), 'trip saved (dates, 10 min, no equipment)');
  ok(await p.locator('[data-trip-on]').count() === 1 && await p.locator('[data-travel-today] [data-today-states]').count() === 1, 'original / updated / done shown for today');
  const tg = await p.locator('[data-travel-today] [data-gate]').getAttribute('data-gate');
  ok(['warn', 'block'].includes(tg) && await p.locator('[data-travel-today] [data-gate-kind=time]').count() === 1, 'today checked against the trip\'s 10 minutes', tg);
  ok(await p.evaluate(() => MealOpt.defaultSort()) === 'quick', 'meal options: quick dishes first while traveling');
  /* personal plan: late → moved to tomorrow; original kept */
  await p.evaluate(() => { const pr = Store.load('profile'); Plans.activate(Plans.create('general_90', Plans.paramsFromProfile(pr), Store.today()), { confirmReplace: true }); });
  await go('#/home', 400); await go('#/travel', 1200);
  const ap0 = await p.evaluate(() => { const ap = Plans.active(), td = Plans.todayDay(ap); return { n: td && td.n, training: td && Plans.isTraining(td), total: Plans.days(ap).length }; });
  if (ap0.training) {
    await p.locator('[data-act=dayLate]').click(); await p.waitForTimeout(400);
    const mv = await p.evaluate(n => { const ap = Plans.active(), d = Plans.dayOf(ap, n); return { movedTo: d.movedTo, total: Plans.days(ap).length, title: d.title }; }, ap0.n);
    ok(mv.movedTo === await p.evaluate(() => Store.addDays(Store.today(), 1)) && mv.total === ap0.total, 'late → moved to tomorrow via the existing move; plan length unchanged', mv);
  } else ok(/אין אימון היום/.test(await p.locator('[data-travel-today]').innerText()), 'rest day today → says so');
  await p.locator('[data-travel-link=nearby]').count();
  await p.evaluate(() => { const pr = Store.load('profile'); pr.travel = Object.assign({}, pr.travel, { dest: 'Berlin' }); Store.save('profile'); });
  await go('#/home', 300); await go('#/travel', 1000);
  ok(await p.locator('[data-travel-link=nearby]').getAttribute('href') === '#/nearby/Berlin', 'food at the destination → nearby search with the typed destination');
  await p.evaluate(() => { window.__geo = 0; const g = navigator.geolocation; if (g) g.getCurrentPosition = () => { window.__geo++; }; });
  await p.locator('[data-travel-link=nearby]').click(); await p.waitForTimeout(1000);
  ok((await p.getAttribute('[data-near-google]', 'href') || '').includes('Berlin') && await p.evaluate(() => window.__geo) === 0, 'search prepared for "Berlin" without asking for location');
  await go('#/coach', 1100); await p.fill('#ask-q', 'אני בנסיעה השבוע'); await p.locator('[data-chat] [data-act=ask]').click(); await p.waitForTimeout(300);
  ok(await p.locator('[data-ask-a=travel] a[href="#/travel"]').count() === 1 && /נסיעה פעילה/.test(await p.locator('[data-ask-a=travel]').innerText()), 'Sofit knows the trip and links to Travel Mode');
  await go('#/travel', 1000); await p.locator('[data-act=tripEnd]').click(); await p.waitForTimeout(300);
  ok(await p.evaluate(() => !Gate.trip()), 'trip ended → normal limits again');
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no sideways scroll');

  G = 'errors'; ok(!errs.length, 'no JS errors', errs);
  await b.close();
  let pass = 0, fail = 0; for (const r of res) { console.log(`${r.ok ? 'PASS' : 'FAIL'} [${r.g}] ${r.m}`); r.ok ? pass++ : fail++; }
  console.log(`\nm12 gate tests: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
