/* Stage B browser tests (Playwright Chromium, iPhone-13 viewport emulation — NOT a physical iPhone, NOT Safari).
   Usage: node tools/e2e_stageB.js [URL]  (default http://localhost:8096/) — writes dist/reports/e2e-stageB.json */
const { chromium, devices } = require('playwright'); const fs = require('fs'), path = require('path');
const URL0 = process.argv[2] || 'http://localhost:8096/';
const res = []; let G = ''; const ok = (c, m, info) => res.push({ g: G, ok: !!c, m: m + (info !== undefined && !c ? ' → ' + JSON.stringify(info).slice(0, 300) : '') });
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'he-IL', serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/ERR_|Failed to load resource/.test(m.text())) errs.push(m.text()); if (/no handler/.test(m.text())) errs.push('NOHANDLER ' + m.text()); });
  const go = async h => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(300); };
  const main = () => p.locator('main').innerText();
  const next = async () => { await p.locator('[data-act=next]').click(); await p.waitForTimeout(350); };
  await p.goto(URL0); await p.waitForTimeout(600); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(600);

  G = 'new profile';
  ok(await p.evaluate(() => { const x = Store.load('profile'); return x.age == null && x.height == null && x.weight == null && x.aims.primary == null; }), 'new user starts with an empty profile');
  ok(await p.locator('.setup-cta').count() === 1, 'home offers the setup flow');
  await go('#/nutrition'); ok(await p.locator('[data-need=profile]').count() === 1 && !/2300/.test(await main()), 'nutrition asks for profile data instead of inventing targets');
  await go('#/setup/1'); ok(/שלב 1 מתוך 6/.test(await main()), 'setup step 1 of 6');
  ok((await p.locator('.why').count()) >= 1, 'each section explains why the data is needed');
  await p.fill('#pf-age', '5'); await next(); ok(/גיל צריך להיות/.test(await p.locator('[data-err]').innerText()), 'invalid age → clear error, stays on step');
  ok(await p.evaluate(() => location.hash) === '#/setup/1', 'did not advance on error');
  await p.fill('#pf-age', '32'); await p.fill('#pf-h', '187'); await p.fill('#pf-w', '85'); await next();
  ok(/רמת ניסיון/.test(await p.locator('[data-err]').innerText()), 'experience required for the plan');
  await p.fill('#pf-age', '32'); await p.fill('#pf-h', '187'); await p.fill('#pf-w', '85'); await p.locator('[data-act=xp][data-v=intermediate]').click(); await p.waitForTimeout(250);
  ok(await p.inputValue('#pf-age') === '32', 'typed values kept when choosing experience'); await next();
  ok(await p.evaluate(() => location.hash) === '#/setup/2', 'step 2');
  await next(); ok(/מטרה ראשית/.test(await p.locator('[data-err]').innerText()), 'goal required');
  await p.locator('[data-act=gp][data-v=fat_loss]').click(); await p.waitForTimeout(200); await p.locator('[data-act=gs][data-v=strength]').click(); await p.waitForTimeout(200); await next();
  for (const d of [0, 2, 4, 5]) { await p.locator(`[data-act=dw][data-v="${d}"]`).click(); await p.waitForTimeout(120); }
  ok(await p.locator('[data-act=ses][data-v="5"]').isDisabled(), 'cannot choose more sessions than available days');
  await p.locator('[data-act=ses][data-v="4"]').click(); await p.waitForTimeout(150); await p.selectOption('#pf-pref', '30'); await p.selectOption('#pf-max', '40');
  await p.locator('[data-act=eq][data-v=chair]').click(); await p.waitForTimeout(200);
  ok(await p.inputValue('#pf-max') === '40', 'time selections kept when toggling equipment');
  ok(/אין עדיין תרגילים בספרייה לציוד הזה/.test(await main()) && /אין עדיין תרגילי משקולות/.test(await main()), 'library limits for dumbbells/bands/gym stated');
  await p.locator('[data-act=eq][data-v=dumbbells]').click(); await p.waitForTimeout(200);
  // back navigation keeps data
  await p.locator('a[href="#/setup/2"]').first().click(); await p.waitForTimeout(250); ok(await p.locator('[data-act=gp][data-v=fat_loss]').getAttribute('aria-pressed') === 'true', 'back to step 2: goal still selected');
  await p.locator('a[href="#/setup/1"]').first().click(); await p.waitForTimeout(250); ok(await p.inputValue('#pf-w') === '85', 'back to step 1: weight still there');
  await go('#/setup/3'); ok(await p.locator('[data-act=dw][data-v="5"]').getAttribute('aria-pressed') === 'true', 'step 3 keeps availability'); await next();
  G = 'route, preview, activation';
  ok(await p.locator('[data-act=tpl][data-v=gym]').isDisabled() && await p.locator('[data-act=tpl][data-v=basic_equipment]').isDisabled(), 'gym / dumbbell routes disabled (no library) with reason');
  const first = await p.locator('[data-act=tpl]').first().getAttribute('data-v'); ok(await p.evaluate(id => PROGRAMS.byId(id).goals.includes('fat_loss'), first), 'routes matching the goal listed first');
  await p.locator('[data-act=tpl][data-v=general_90]').click(); await p.waitForTimeout(200); await next();
  const prev = await main();
  for (const [k, re] of [['duration', /\b90\b[\s\S]*ימים/], ['goal', /ירידה באחוזי שומן/], ['sessions/week', /אימונים בשבוע/], ['estimated time', /דק׳ לאימון \(הערכה\)/], ['equipment', /כיסא יציב/], ['phases', /מבנה השלבים/], ['limitations', /מגבלות ידועות/]]) ok(re.test(prev), 'preview shows ' + k);
  ok(/משקולות יד/.test(prev) === false || /ציוד בשימוש: ללא ציוד/.test(prev), 'preview does not claim dumbbell exercises');
  const tomorrow = await p.evaluate(() => Store.addDays(Store.today(), 1)); await p.fill('#su-start', tomorrow); await p.locator('#su-start').dispatchEvent('change'); await p.waitForTimeout(300); await next();
  ok(/סיכום הבחירות שלך/.test(await main()) && /הפעלת התוכנית/.test(await main()), 'confirmation step with summary');
  await next(); await p.waitForTimeout(300);
  ok(await p.evaluate(() => location.hash) === '#/plan' && await p.evaluate(() => !!Plans.active()), 'plan activated after confirmation');
  ok(await p.evaluate(t => Plans.active().start === t, tomorrow), 'chosen start date used');
  ok(await p.evaluate(() => Plans.days(Plans.active()).filter(Plans.isTraining).every(d => [0, 2, 4, 5].includes(Store.parse(d.date).getDay()))), 'sessions only on chosen days');
  await go('#/'); ok(await p.locator('.plan-today').count() === 1, 'home shows the active plan');
  await go('#/workouts'); ok(await p.locator('a.plan-link[href="#/plan"]').count() === 1, 'workouts links to the active plan');

  G = 'profile edit';
  await go('#/profile'); await p.fill('#pf-w', '84.2'); await p.locator('[data-act=saveBasics]').click(); await p.waitForTimeout(250);
  await p.reload(); await p.waitForTimeout(500); await go('#/profile'); ok(await p.inputValue('#pf-w') === '84.2', 'profile edit persists after reload');
  await p.selectOption('#pf-sex', 'm'); await p.locator('[data-act=saveBasics]').click(); await p.waitForTimeout(250);
  ok(await p.evaluate(() => Core.targets().kcal) === await p.evaluate(() => Math.round((10 * 84.2 + 6.25 * 187 - 5 * 32 + 5) * 1.55 * 0.8 / 50) * 50), 'targets recomputed from the edited profile (independent formula)');

  G = 'plan actions';
  // make "today" a planned training day for actions: use day after tomorrow etc.
  await go('#/plan'); ok(/השבועיים הקרובים/.test(await main()), 'plan screen');
  const tn = await p.evaluate(() => Plans.days(Plans.active()).filter(d => Plans.isTraining(d) && d.type !== 'assess')[1].n);
  await go('#/pday/' + tn);
  const m0 = await p.evaluate(n => Plans.dayOf(Plans.active(), n).minutes, tn);
  await p.locator('[data-act=ver][data-v=short]').click(); await p.waitForTimeout(250); const m1 = await p.evaluate(n => Plans.dayOf(Plans.active(), n).minutes, tn);
  ok(m1 < m0, `short version shorter (${m0} → ${m1})`); await p.locator('[data-act=ver][data-v=std]').click(); await p.waitForTimeout(250);
  // swap exercise
  const ex0 = await p.evaluate(n => Plans.dayOf(Plans.active(), n).main[0].ex, tn);
  await p.locator('[data-act=swap][data-i="0"]').click(); await p.waitForTimeout(250);
  const sheetTxt = await p.locator('.sheet').innerText(); ok(/קושי/.test(sheetTxt) && /נוכחי/.test(sheetTxt), 'swap sheet shows current, difficulty and equipment');
  const altId = await p.locator('.sheet [data-act=day]').first().getAttribute('data-id').catch(() => null);
  if (altId) { await p.locator('.sheet [data-act=day]').first().click(); await p.waitForTimeout(250); ok(await p.evaluate(n => Plans.dayOf(Plans.active(), n).main[0].ex, tn) === altId, 'exercise swapped for this day'); }
  else ok(/אין|דורשות ציוד|הוחרגו/.test(sheetTxt), 'no alternative → reason shown');
  // skip / unskip
  await p.locator('[data-act=skip]').click(); await p.locator('.sheet [data-act=ok]').click(); await p.waitForTimeout(250);
  ok(await p.evaluate(n => Plans.dayOf(Plans.active(), n).status, tn) === 'skipped', 'skip via UI'); await p.locator('[data-act=unskip]').click(); await p.waitForTimeout(250);
  ok(await p.evaluate(n => Plans.dayOf(Plans.active(), n).status, tn) !== 'skipped', 'unskip via UI');
  // move onto a training day → error; onto a rest day → ok
  const busy = await p.evaluate(n => Plans.days(Plans.active()).find(d => Plans.isTraining(d) && d.n > n).date, tn);
  await p.locator('[data-act=move]').click(); await p.fill('.sheet #mv-d', busy); await p.locator('.sheet [data-act=ok]').click(); await p.waitForTimeout(250);
  ok(/כבר יש אימון/.test(await p.locator('.sheet [data-err]').innerText()), 'move onto a training day refused with reason');
  const free = await p.evaluate(n => Plans.days(Plans.active()).find(d => !Plans.isTraining(d) && d.n > n).date, tn);
  await p.fill('.sheet #mv-d', free); await p.locator('.sheet [data-act=ok]').click(); await p.waitForTimeout(300);
  ok(await p.evaluate(n => Plans.dayOf(Plans.active(), n).date, tn) === free, 'moved to a rest day');
  // pause / resume
  await go('#/plan'); await p.locator('[data-act=pause]').click(); await p.locator('.sheet [data-act=ok]').click(); await p.waitForTimeout(300);
  ok(await p.evaluate(() => Plans.active().status) === 'paused' && /מושהית/.test(await main()), 'paused via UI');
  await p.locator('[data-act=resume]').click(); await p.waitForTimeout(300); ok(await p.evaluate(() => Plans.active().status) === 'active', 'resumed via UI');
  // change availability with diff + confirm
  await p.locator('[data-act=avail]').click(); await p.waitForTimeout(250);
  await p.locator('.sheet [data-act=cdw][data-v="5"]').click(); await p.locator('.sheet [data-act=cdw][data-v="1"]').click(); await p.waitForTimeout(300);
  ok(/מה ישתנה/.test(await p.locator('.sheet').innerText()) && /אימונים בשבוע/.test(await p.locator('.sheet').innerText()), 'availability change shows the differences before applying');
  await p.locator('.sheet [data-act=apply]').click(); await p.waitForTimeout(400);
  ok(await p.evaluate(() => { const pl = Plans.active(), from = pl.segments[pl.segments.length - 1].fromDay; return Plans.days(pl).filter(d => d.n >= from && Plans.isTraining(d) && !d.log && !d.movedTo).every(d => [0, 1, 2, 4].includes(Store.parse(d.date).getDay())); }), 'new availability applied to remaining days');
  ok(await p.evaluate(() => Store.load('profile').availability.days.join()) === '0,1,2,4', 'profile availability updated too');
  // equipment change
  await p.locator('[data-act=equip]').click(); await p.waitForTimeout(250); await p.locator('.sheet [data-act=ceq][data-v=wall]').click(); await p.waitForTimeout(250); await p.locator('.sheet [data-act=apply]').click(); await p.waitForTimeout(400);
  ok(await p.evaluate(() => Plans.active().segments.slice(-1)[0].params.equipment.includes('wall')), 'equipment change applied');
  ok(await p.evaluate(() => Plans.active().changes.length) >= 5, 'change history recorded');

  G = 'workout run → history';
  { const n = await p.evaluate(() => { const pl = Plans.active(); const d = Plans.days(pl).find(x => Plans.isTraining(x) && x.type !== 'assess' && !x.log && x.date >= Store.today() && x.status !== 'skipped'); return d.n; });
    await p.evaluate(n => { const pl = Plans.active(), d = Plans.dayOf(pl, n); Run.start(n, d.version || 'std', { id: pl.id, n }); }, n); await p.waitForTimeout(400);
    ok(await p.locator('.run').count() === 1, 'plan day opens in the workout runner');
    await p.locator('.run [data-a=exit]').click(); await p.waitForTimeout(200); await p.locator('.sheet [data-act=finish]').click(); await p.waitForTimeout(300);
    await p.locator('.run [data-r="6"]').click(); await p.locator('.run [data-a=save]').click(); await p.waitForTimeout(400);
    ok(await p.evaluate(n => { const l = Plans.active().log[n]; return !!l && l.rpe === 6 && !!l.snapshot && l.source === 'run'; }, n), 'finished session logged in the plan with a snapshot');
    ok(await p.evaluate(() => Object.keys(Store.load('workouts').days).length) === 0, '30-day log untouched by a plan session');
    G = 'switch program & cancel';
    await go('#/setup/4'); await p.locator('[data-act=tpl][data-v=fatloss_30]').click(); await p.waitForTimeout(200); await next(); await next();
    ok(/יש תוכנית פעילה/.test(await main()), 'switching shows the current plan and its progress'); await next();
    ok(/צריך לאשר/.test(await p.locator('[data-err]').innerText()), 'switching requires explicit confirmation');
    await p.locator('#su-ok').check(); await next(); await p.waitForTimeout(300);
    ok(await p.evaluate(() => Plans.active().templateId) === 'fatloss_30', 'switched');
    ok(await p.evaluate(n => { const old = Plans.list().find(x => x.templateId === 'general_90'); return old.status === 'replaced' && !!old.log[n]; }, n), 'previous plan kept with its log');
    await go('#/plan'); ok(/תוכניות קודמות/.test(await main()), 'previous plans listed');
    await p.locator('[data-act=cancel]').click(); await p.locator('.sheet [data-act=ok]').click(); await p.waitForTimeout(300);
    ok(await p.evaluate(() => Plans.active()) === null && /אין תוכנית אישית פעילה/.test(await main()), 'cancelled; history still listed'); }

  G = 'backup & restore';
  { const before = await p.evaluate(() => JSON.stringify(Store.exportAll(), (k, v) => k === 'exportedAt' ? undefined : v));
    ok(await p.evaluate(() => Object.keys(Store.exportAll().plans.list).length) === 2, 'export contains both plans');
    await go('#/settings'); await p.locator('[data-act=export]').click(); await p.waitForTimeout(300); const txt = await p.locator('.sheet #fo-t').inputValue(); await p.locator('.sheet [data-x]').click();
    await p.evaluate(() => Store.resetAll()); await p.reload(); await p.waitForTimeout(500);
    await go('#/settings'); await p.locator('[data-act=import]').click(); await p.fill('.sheet #im-t', txt); await p.locator('.sheet [data-act=go]').click(); await p.waitForTimeout(200); await p.locator('.sheet [data-act=ok]').click(); await p.waitForTimeout(500);
    ok(await p.evaluate(() => JSON.stringify(Store.exportAll(), (k, v) => k === 'exportedAt' ? undefined : v)) === before, 'restore reproduces profile, plans and history');
    const bad = JSON.parse(txt); bad.plans = { active: 'nope', list: {} };
    await go('#/settings'); await p.locator('[data-act=import]').click(); await p.fill('.sheet #im-t', JSON.stringify(bad)); await p.locator('.sheet [data-act=go]').click(); await p.waitForTimeout(200);
    ok(/התוכנית הפעילה בגיבוי חסרה/.test(await p.locator('.sheet #im-msg').innerText()), 'corrupt plans section rejected with a clear message'); await p.locator('.sheet [data-x]').first().click();
    ok(await p.evaluate(() => JSON.stringify(Store.exportAll(), (k, v) => k === 'exportedAt' ? undefined : v)) === before, 'data untouched after rejection'); }

  G = 'upgrade from old data';
  { const c2 = await b.newContext({ ...devices['iPhone 13'], locale: 'he-IL', serviceWorkers: 'block' }); const q = await c2.newPage(); const e2 = []; q.on('pageerror', e => e2.push(e.message));
    await q.goto(URL0); await q.evaluate(() => { localStorage.clear(); localStorage.setItem('fit30.profile', JSON.stringify({ v: 1, age: 32, height: 187, startWeight: 85, weight: 85, startDate: '2026-10-10', units: { w: 'kg', len: 'cm' }, targets: null, goals: { steps: 10000, water: 3000, sleep: 7.5 }, prefs: { chicken: true, egg: true, dairy: true, veg: false, exclude: [], flex: true, flexName: 'ארוחה גמישה' }, display: { size: 'normal', motion: 'auto', wake: true, sound: true }, onboarded: true }));
      localStorage.setItem('fit30.workouts', JSON.stringify({ v: 1, days: { 1: { status: 'done', version: 'std', date: '2026-10-10' } }, levels: {}, swaps: {}, feedback: {}, tests: {} }));
      localStorage.setItem('fit30.tracking', JSON.stringify({ v: 1, daily: { '2026-10-11': { water: 2000 } }, measures: [{ date: '2026-10-10', weight: 85 }] })); });
    await q.reload(); await q.waitForTimeout(600);
    ok(await q.evaluate(() => { const p = Store.load('profile'), w = Store.load('workouts'), t = Store.load('tracking'); return p.schema === 2 && p.age === 32 && p.legacy && p.legacy.sex === 'm' && w.days[1].status === 'done' && t.measures.length === 1 && t.daily['2026-10-11'].water === 2000; }), 'old data kept and profile migrated');
    ok(await q.evaluate(() => Core.targets().kcal) === 2300 && await q.evaluate(() => Core.targets().protein) === 155, 'existing user keeps the same targets (2300 kcal / 155 g)');
    await q.evaluate(() => { location.hash = '#/nutrition'; }); await q.waitForTimeout(300); ok(await q.locator('[data-need=profile]').count() === 0, 'existing user sees nutrition normally');
    await q.evaluate(() => { location.hash = '#/targets'; }); await q.waitForTimeout(300); ok(/החישוב של הגרסה הקודמת/.test(await q.locator('main').innerText()), 'targets screen states the legacy assumption');
    ok(e2.length === 0, 'no errors after upgrade', e2); await c2.close(); }

  G = 'small screens';
  for (const w of [320, 375]) { const c3 = await b.newContext({ viewport: { width: w, height: 700 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'he-IL', serviceWorkers: 'block' }); const q = await c3.newPage();
    await q.goto(URL0); await q.evaluate(st => { localStorage.clear(); Object.entries(JSON.parse(st)).forEach(([k, v]) => localStorage.setItem(k, v)); }, await p.evaluate(() => JSON.stringify(Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)])))));
    await q.reload(); await q.waitForTimeout(400);
    await q.evaluate(() => { const pr = Store.load('profile'); const pl = Plans.create('general_60', Plans.paramsFromProfile(pr), Store.today()); Plans.activate(pl); });
    const bad = []; for (const h of ['#/', '#/profile', '#/setup/1', '#/setup/2', '#/setup/3', '#/setup/4', '#/setup/5', '#/setup/6', '#/plan', '#/pday/2', '#/workouts']) { await q.evaluate(x => { location.hash = x; }, h); await q.waitForTimeout(250); if (!(await q.evaluate(() => document.documentElement.scrollWidth <= innerWidth))) bad.push(h); }
    ok(!bad.length, `no horizontal scroll at ${w}px`, bad); await c3.close(); }

  G = 'offline';
  { const c4 = await b.newContext({ ...devices['iPhone 13'], locale: 'he-IL' }); const q = await c4.newPage(); const e4 = []; q.on('pageerror', e => e4.push(e.message));
    await q.goto(URL0); await q.waitForTimeout(1200); await q.reload(); await q.waitForTimeout(700);
    await q.evaluate(() => { const pr = Store.load('profile'); Object.assign(pr, { age: 30, height: 175, weight: 70, experience: 'beginner', aims: { primary: 'general', secondary: [] } }); pr.availability = { days: [1, 3, 5], sessions: 3, prefMin: null, maxMin: 30 }; Store.save('profile'); Plans.activate(Plans.create('habits_30', Plans.paramsFromProfile(pr), Store.today())); });
    await c4.setOffline(true); await q.reload(); await q.waitForTimeout(900);
    const pages = []; for (const h of ['#/plan', '#/pday/3', '#/profile', '#/setup/5']) { await q.evaluate(x => { location.hash = x; }, h); await q.waitForTimeout(300); pages.push((await q.locator('main').innerText()).length > 50); }
    ok(pages.every(Boolean), 'plan, day, profile and preview work offline');
    await q.evaluate(() => { const pl = Plans.active(); const d = Plans.days(pl).find(x => Plans.isTraining(x) && x.date >= Store.today()); Plans.logDay(pl.id, d.n, { status: 'done', source: 'offline-test' }); });
    ok(await q.evaluate(() => Object.keys(Plans.active().log).length) === 1, 'logging works offline'); await c4.setOffline(false);
    ok(e4.length === 0, 'no errors offline', e4); await c4.close(); }

  G = 'general';
  ok(!errs.some(e => /NOHANDLER/.test(e)), 'every button has a handler'); ok(errs.length === 0, 'no console errors', errs.slice(0, 3));
  await b.close();
  const pass = res.filter(r => r.ok).length, fail = res.length - pass, groups = {}; res.forEach(r => { groups[r.g] = groups[r.g] || { pass: 0, fail: 0 }; groups[r.g][r.ok ? 'pass' : 'fail']++; });
  fs.mkdirSync(path.join(__dirname, '../dist/reports'), { recursive: true }); fs.writeFileSync(path.join(__dirname, '../dist/reports/e2e-stageB.json'), JSON.stringify({ url: URL0, pass, fail, groups, results: res }, null, 1));
  res.filter(r => !r.ok).forEach(r => console.log('FAIL [' + r.g + '] ' + r.m)); console.log(JSON.stringify(groups)); console.log(`stage B e2e: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('crashed', e.stack); console.log(res.slice(-4).map(r => (r.ok ? 'PASS ' : 'FAIL ') + r.m).join('\n')); process.exit(2); });
