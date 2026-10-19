/* Stage G browser tests (Playwright Chromium, iPhone-13 emulation with a controlled clock — NOT a physical iPhone).
   Usage: node tools/e2e_stageG.js [URL] — writes dist/reports/e2e-stageG.json */
const { chromium, devices } = require('playwright'); const fs = require('fs'), path = require('path');
const URL0 = process.argv[2] || 'http://localhost:8096/';
const res = []; let G = ''; const ok = (c, m, info) => res.push({ g: G, ok: !!c, m: m + (info !== undefined && !c ? ' → ' + JSON.stringify(info).slice(0, 300) : '') });
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'he-IL', serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/ERR_|Failed to load resource/.test(m.text())) errs.push(m.text()); if (/no handler/.test(m.text())) errs.push('NOHANDLER ' + m.text()); });
  const T0 = new Date('2026-10-19T08:00:00').getTime(); await p.clock.install({ time: T0 });
  const go = async h => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(300); };
  const main = () => p.locator('main').innerText();
  await p.goto(URL0); await p.waitForTimeout(500);

  G = 'empty states (new user)';
  await p.evaluate(() => { Store.resetAll(); localStorage.clear(); }); await p.reload(); await p.waitForTimeout(400);
  for (const h of ['#/explain', '#/review']) { await go(h); ok(await p.locator('[data-empty-state]').count() === 1 && /בניית תוכנית/.test(await main()), `${h}: explains it needs a plan, offers setup`); }
  await go('#/records'); ok(await p.locator('[data-records] [data-empty-state]').count() === 1 && await p.locator('[data-milestones] [data-empty-state]').count() === 1, 'records: empty states, no invented records');

  G = 'entry points';
  await p.evaluate(() => { const pr = Store.load('profile'); Object.assign(pr, { age: 32, height: 187, weight: 85, startWeight: 85, sex: 'm', experience: 'beginner', aims: { primary: 'fat_loss', secondary: [] } }); pr.availability = { days: [1, 3, 5], sessions: 3, maxMin: 30 }; pr.environment = { equipment: ['chair', 'table', 'bench', 'step', 'wall', 'doorframe', 'towel'] }; Store.save('profile');
    Plans.activate(Plans.create('general_90', Plans.paramsFromProfile(pr), Store.today())); });
  await p.reload(); await p.waitForTimeout(400);
  await go('#/'); /* RC1: a 5th link (tutorials) was added; was a count of 4 — now each link is checked by its target */ ok((await Promise.all(['#/explain', '#/review', '#/records', '#/shopping', '#/help'].map(h => p.locator(`.sig-links a[href="${h}"]`).count()))).every(n => n === 1), 'home: links to explain / weekly review / records / shopping / tutorials');
  await go('#/nutrition'); ok(await p.locator('[data-shop-link]').count() === 1, 'nutrition: shopping list entry');
  await go('#/progress'); ok(await p.locator('.sig-links a[href="#/review"]').count() === 1 && await p.locator('.sig-links a[href="#/records"]').count() === 1, 'progress: review + records entries');
  await go('#/plan'); ok(await p.locator('[data-act=travel]').count() === 1 && await p.locator('a[href="#/explain"]').count() >= 1, 'plan: travel mode + explain entries');

  G = 'explain my plan';
  await go('#/explain'); const ex = await main(); const sessions = await p.evaluate(() => Plans.days(Plans.active()).filter(Plans.isTraining).length);
  ok(await p.locator('[data-explain]').count() >= 6, 'explanation sections rendered'); ok(ex.includes(`${sessions} אימונים`) && /Mifflin/.test(ex) && /2300/.test(ex), 'shows the real session count and target calculation');

  G = 'shopping list';
  await go('#/shopping'); const nItems = await p.locator('[data-shop]').count(); ok(nItems > 10, `7-day list with ${nItems} items`);
  const first = await p.locator('[data-shop]').first().getAttribute('data-shop'); await p.locator('[data-shop]').first().check(); await p.waitForTimeout(150);
  ok(new RegExp(`^1/${nItems}$`).test((await p.locator('[data-shop-progress]').innerText()).trim()), 'progress counter updates on check');
  await p.reload(); await p.waitForTimeout(400); await go('#/shopping'); ok(await p.locator(`[data-shop="${first}"]`).isChecked(), 'check survives reload');
  await p.locator('[data-act=days][data-d="3"]').click(); await p.waitForTimeout(300); ok(await p.locator('[data-shop]').count() < nItems && /3 ימים/.test(await p.locator('[aria-pressed=true]').first().innerText()), '3-day range gives a shorter list');
  ok(await p.evaluate(() => { const sh = Signature.shopping(Store.today(), 3); return sh.groups.reduce((s, g) => s + g.items.length, 0); }) === await p.locator('[data-shop]').count(), 'screen shows exactly the computed items');

  G = 'travel mode';
  await go('#/plan'); await p.locator('[data-act=travel]').click(); await p.waitForTimeout(300);
  ok(await p.locator('.sheet [data-travel-diff]').count() === 1, 'sheet previews the changes before applying');
  const before = await p.evaluate(() => JSON.stringify(Plans.days(Plans.active()).map(d => (d.main || []).map(it => it.ex))));
  await p.locator('.sheet [data-act=ok]').click(); await p.waitForTimeout(400);
  ok(await p.locator('[data-travel-active]').count() === 1, 'plan shows the active travel mode with an undo button');
  ok(await p.evaluate(() => { const t = Store.today(), to = Store.addDays(t, 6); return Plans.days(Plans.active()).filter(d => d.date >= t && d.date <= to && Plans.isTraining(d)).every(d => (d.main || []).every(it => CATALOG.usableWith(EX_BY_ID[it.ex], ['none']))); }), 'workouts in the travel week need no equipment');
  await p.locator('[data-act=travelOff]').click(); await p.waitForTimeout(200); await p.locator('.sheet [data-act=ok]').click(); await p.waitForTimeout(400);
  ok(await p.evaluate(() => JSON.stringify(Plans.days(Plans.active()).map(d => (d.main || []).map(it => it.ex)))) === before, 'undo restores the plan exactly');
  await p.locator('[data-act=travel]').click(); await p.waitForTimeout(200); await p.fill('.sheet #tr-t', await p.evaluate(() => Store.addDays(Store.today(), 60))); await p.locator('.sheet #tr-t').dispatchEvent('change'); await p.waitForTimeout(200);
  ok(await p.locator('.sheet [data-travel-err]').count() === 1, 'a range over 4 weeks shows an error instead of applying'); await p.locator('.sheet [data-x]').first().click();

  G = 'weekly review & records with data';
  await p.evaluate(() => { const pl = Plans.active(), d = Plans.days(pl).find(x => Plans.isTraining(x) && x.type !== 'assess' && x.date === Store.today()) || Plans.days(pl).find(x => Plans.isTraining(x) && x.type !== 'assess');
    return d.date; }).then(async dt => { await p.clock.setFixedTime(new Date(dt + 'T08:00:00').getTime()); await p.reload(); await p.waitForTimeout(400); });
  await p.evaluate(() => { const pl = Plans.active(), d = Plans.todayDay(pl) && Plans.isTraining(Plans.todayDay(pl)) ? Plans.todayDay(pl) : Plans.days(pl).find(x => Plans.isTraining(x) && x.date === Store.today()), sets = [];
    (d.main || []).forEach(it => { for (let k = 1; k <= it.sets; k++) { const r = { done: true, ex: it.ex, sec: 'main', set: k }; if (typeof it.reps === 'number') r.reps = it.reps; else r.secs = typeof it.sec === 'number' ? it.sec : 30; sets.push(r); } });
    Plans.logDay(pl.id, d.n, { status: 'done', rpe: 6, durationSec: 1800, sets, source: 'run' }); Core.eatSlot(Store.today(), 'm1', 1); });
  await go('#/review'); ok(await p.locator('[data-review=training]').count() === 1 && /1\/\d/.test(await p.locator('[data-review=training]').innerText()), 'weekly review shows the logged workout');
  ok(/1 מתוך/.test(await p.locator('[data-review=nutrition]').innerText()), 'nutrition section counts only days with logged meals');
  await go('#/records'); ok(await p.locator('[data-records] tr').count() > 1 && /האימון הראשון/.test(await p.locator('[data-milestones]').innerText()), 'records table + first-session milestone after a logged workout');

  G = 'small screens & offline';
  const c3 = await b.newContext({ viewport: { width: 320, height: 700 }, isMobile: true, hasTouch: true }); const q = await c3.newPage(); const e3 = []; q.on('pageerror', e => e3.push(e.message));
  await q.goto(URL0); await q.waitForTimeout(1200); await q.evaluate(st => { Object.entries(JSON.parse(st)).forEach(([k, v]) => localStorage.setItem(k, v)); }, await p.evaluate(() => JSON.stringify(Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)])))));
  await q.reload(); await q.waitForTimeout(800); await c3.setOffline(true); await q.reload(); await q.waitForTimeout(800); const wide = [];
  for (const h of ['#/explain', '#/review', '#/shopping', '#/records', '#/plan']) { await q.evaluate(x => { location.hash = x; }, h); await q.waitForTimeout(250); if (!(await q.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.querySelector('main').innerText.length > 50))) wide.push(h); }
  ok(!wide.length, 'all Stage G screens work offline and fit 320px', wide); ok(!e3.length, 'no errors offline', e3); await c3.close();

  G = 'general'; ok(!errs.some(e => /NOHANDLER/.test(e)), 'every button has a handler'); ok(errs.length === 0, 'no console errors', errs.slice(0, 3));
  await b.close();
  const pass = res.filter(r => r.ok).length, fail = res.length - pass, groups = {}; res.forEach(r => { groups[r.g] = groups[r.g] || { pass: 0, fail: 0 }; groups[r.g][r.ok ? 'pass' : 'fail']++; });
  fs.mkdirSync(path.join(__dirname, '../dist/reports'), { recursive: true }); fs.writeFileSync(path.join(__dirname, '../dist/reports/e2e-stageG.json'), JSON.stringify({ url: URL0, pass, fail, groups, results: res }, null, 1));
  res.filter(r => !r.ok).forEach(r => console.log('FAIL [' + r.g + '] ' + r.m)); console.log(JSON.stringify(groups)); console.log(`stage G e2e: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('crashed', e.stack); console.log(res.slice(-4).map(r => (r.ok ? 'PASS ' : 'FAIL ') + r.m).join('\n')); process.exit(2); });
