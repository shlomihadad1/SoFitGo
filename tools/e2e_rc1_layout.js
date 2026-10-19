/* RC1 layout sweep — every route at iPhone and iPad sizes (Playwright Chromium emulation; NOT Safari, NOT a real device).
   Checks: no horizontal overflow, tappable controls ≥ 40×40 px (inline text links excepted), no page errors.
   Also: large-text mode, and the restriction guard working offline. Writes dist/reports/e2e-rc1-layout.json */
const { chromium, devices } = require('playwright'); const fs = require('fs'), path = require('path');
const URL0 = process.argv[2] || 'http://localhost:8096/';
const res = []; let G = ''; const ok = (c, m, info) => res.push({ g: G, ok: !!c, m: m + (info !== undefined && !c ? ' → ' + JSON.stringify(info).slice(0, 300) : '') });
const SIZES = [['iPhone SE', 375, 667], ['320 narrow', 320, 640], ['iPhone 13', 390, 844], ['iPhone Pro Max', 430, 932], ['iPad mini', 768, 1024], ['iPad Air', 820, 1180], ['iPad landscape', 1180, 820]];
(async () => {
  const b = await chromium.launch(); const errs = [];
  const seed = async p => p.evaluate(() => { localStorage.clear(); Store.resetAll(); const pr = Store.load('profile'); Object.assign(pr, { age: 16, height: 172, weight: 64, startWeight: 66, targetWeight: 60, sex: 'f', experience: 'beginner', onboarded: true, startDate: Store.today() });
    pr.aims = { primary: 'fat_loss', secondary: [] }; pr.availability = { days: [1, 3, 5], sessions: 3, maxMin: 30, prefMin: null }; pr.environment = { place: 'gym', equipment: ['chair', 'dumbbells'], custom: [] }; pr.prefs = Core.normPrefs({ exclude: ['peanuts'] }); pr.restrictionKinds = { peanuts: 'allergy' }; Store.save('profile');
    const pl = Plans.activate(Plans.create('general_90', Plans.paramsFromProfile(pr), Store.today()), { confirmReplace: true }); const d = Plans.days(pl).find(x => Plans.isTraining(x));
    Plans.logDay(pl.id, d.n, { status: 'done', rpe: 6, durationSec: 1500, sets: d.main.map(x => ({ done: true, ex: x.ex, sec: 'main', set: 1, reps: x.reps || 10 })), source: 'run' }); Core.eatSlot(Store.today(), 'm1', 1);
    const t = Store.load('tracking'); t.measures.push({ id: 'a', date: Store.today(), weight: 64 }); Store.save('tracking'); pr.aims.primary = 'general'; Store.save('profile'); /* goal differs from the plan → sync banner */ });
  const routes = async p => { const ex = await p.evaluate(() => EXERCISES[0].id), rc = await p.evaluate(() => NUTRI.RECIPES[0].id), n = await p.evaluate(() => Plans.days(Plans.active()).find(x => Plans.isTraining(x)).n), pid = await p.evaluate(() => PROGRAMS.TEMPLATES[2].id);
    return ['#/', '#/calendar', '#/workouts', '#/plan', '#/pday/' + n, '#/ex/' + ex, '#/nutrition', '#/recipes', '#/recipe/' + rc, '#/targets', '#/shopping', '#/progress', '#/review', '#/records', '#/explain', '#/settings', '#/profile', '#/programs', '#/program/' + pid, '#/media', '#/install', '#/help', '#/setup/1']; };
  const check = async (p, label) => p.evaluate(label => { const o = []; const W = innerWidth; if (document.documentElement.scrollWidth > W + 1) o.push('overflow ' + document.documentElement.scrollWidth + '>' + W);
    document.querySelectorAll('main button, main a.btn, main [role=button], main input[type=checkbox], main select, nav.tabs a, main .chip').forEach(el => { const r = el.getBoundingClientRect(); if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') return; if (el.closest('.mp-bar') && r.width >= 36) return; if (el.tagName === 'INPUT' && el.closest('label') && el.closest('label').getBoundingClientRect().height >= 40) return; if (r.width < 40 || r.height < 40) o.push(`small ${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]} "${(el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 18)}" ${Math.round(r.width)}×${Math.round(r.height)}`); });
    return o; }, label);
  for (const [name, w, h] of SIZES) {
    G = name; const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: w < 700, hasTouch: true, locale: 'he-IL', serviceWorkers: 'block' }); const p = await c.newPage(); p.on('pageerror', e => errs.push(name + ': ' + e.message));
    await p.clock.install({ time: new Date('2026-10-19T09:00:00').getTime() }); await p.goto(URL0); await p.waitForTimeout(500); await seed(p); await p.reload(); await p.waitForTimeout(500);
    const bad = {}; for (const r of await routes(p)) { await p.evaluate(x => { location.hash = x; }, r); await p.waitForTimeout(r === '#/help' ? 900 : 300); const o = await check(p, r); if (o.length) bad[r] = o.slice(0, 4); }
    const ov = Object.entries(bad).filter(([, o]) => o.some(x => x.startsWith('overflow'))), sm = Object.entries(bad).filter(([, o]) => o.some(x => x.startsWith('small')));
    ok(ov.length === 0, `${name} (${w}×${h}): no horizontal overflow on ${(await routes(p)).length} screens`, ov); ok(sm.length === 0, `${name}: tappable controls ≥ 40×40 px`, sm.slice(0, 6));
    await c.close(); }
  G = 'large text';
  { const c = await b.newContext({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' }); const p = await c.newPage(); await p.clock.install({ time: new Date('2026-10-19T09:00:00').getTime() }); await p.goto(URL0); await p.waitForTimeout(400); await seed(p);
    await p.evaluate(() => { const pr = Store.load('profile'); pr.display.size = 'large'; Store.save('profile'); }); await p.reload(); await p.waitForTimeout(500); const wide = [];
    for (const r of await routes(p)) { await p.evaluate(x => { location.hash = x; }, r); await p.waitForTimeout(r === '#/help' ? 900 : 250); if (await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) wide.push(r); }
    ok(!wide.length, 'large text (375 px): no horizontal overflow on any screen', wide); await c.close(); }
  G = 'offline guard';
  { const c = await b.newContext({ ...devices['iPhone 13'] }); const p = await c.newPage(); await p.goto(URL0); await p.waitForTimeout(1500);
    await p.evaluate(() => { localStorage.clear(); Store.resetAll(); const pr = Store.load('profile'); Object.assign(pr, { age: 30, height: 175, weight: 75, sex: 'm', experience: 'beginner', onboarded: true, startDate: Store.addDays(Store.today(), -40) }); pr.aims = { primary: 'fat_loss', secondary: [] }; pr.prefs = Core.normPrefs({ exclude: ['peanuts'], dairy: false }); Store.save('profile'); });
    await c.setOffline(true); await p.reload(); await p.waitForTimeout(800);
    const leak = await p.evaluate(() => { let n = 0; for (let i = 0; i < 30; i++) { const d = Store.addDays(Store.today(), i), pl = Core.plan(d); ['m1', 'm2', 'snack'].forEach(k => { const s = pl[k]; if (s.rid && Logic.recipeIngredients(Logic.recipe(s.rid), s.ov).some(x => Core.blockedFoods().has(x.f))) n++; }); } return n; });
    ok(leak === 0 && await p.evaluate(() => navigator.onLine) === false, 'offline, classic program days 41–70: restrictions still enforced (0 restricted meals)', { leak }); await c.close(); }
  G = 'general'; ok(errs.length === 0, 'no page errors on any screen/size', errs.slice(0, 4));
  await b.close();
  const pass = res.filter(r => r.ok).length, fail = res.length - pass;
  fs.mkdirSync(path.join(__dirname, '../dist/reports'), { recursive: true }); fs.writeFileSync(path.join(__dirname, '../dist/reports/e2e-rc1-layout.json'), JSON.stringify({ url: URL0, pass, fail, results: res }, null, 1));
  res.filter(r => !r.ok).forEach(r => console.log('FAIL [' + r.g + '] ' + r.m)); console.log(`rc1 layout e2e: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('crashed', e.stack); process.exit(2); });
