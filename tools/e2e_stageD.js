/* Stage D browser tests (Playwright Chromium with device emulation — NOT a physical iPhone/iPad, NOT Safari).
   Usage: node tools/e2e_stageD.js [URL]  — writes dist/reports/e2e-stageD.json (incl. measured task-flow tap counts) */
const { chromium, devices } = require('playwright'); const fs = require('fs'), path = require('path');
const URL0 = process.argv[2] || 'http://localhost:8096/';
const res = []; let G = ''; const ok = (c, m, info) => res.push({ g: G, ok: !!c, m: m + (info !== undefined && !c ? ' → ' + JSON.stringify(info).slice(0, 300) : '') });
const flows = [];
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'he-IL', serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/ERR_|Failed to load resource/.test(m.text())) errs.push(m.text()); if (/no handler/.test(m.text())) errs.push('NOHANDLER ' + m.text()); });
  const go = async h => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(300); };
  await p.goto(URL0); await p.waitForTimeout(500);
  const seed = () => p.evaluate(() => { Store.resetAll(); localStorage.clear(); const pr = Store.load('profile'); Object.assign(pr, { age: 32, height: 187, weight: 85, startWeight: 85, sex: 'm', experience: 'beginner', aims: { primary: 'fat_loss', secondary: [] } }); pr.availability = { days: [1, 3, 5], sessions: 3, prefMin: null, maxMin: 30 }; Store.save('profile'); Plans.activate(Plans.create('general_90', Plans.paramsFromProfile(pr), Store.today()), { confirmReplace: true }); });
  await seed(); await p.reload(); await p.waitForTimeout(400);

  G = 'home (Daily Coach)';
  await go('#/');
  ok(await p.locator('[data-coach]').count() === 1, 'coach card shown for an active plan');
  const coach = await p.locator('[data-coach]').innerText();
  ok(/מטרה: ירידה באחוזי שומן/.test(coach) && /יום 1 מתוך 90/.test(coach), 'coach shows goal and plan day from real data', coach.slice(0, 120));
  const td = await p.evaluate(() => { const d = Plans.todayDay(Plans.active()); return d ? { t: d.title, tr: Plans.isTraining(d) } : null; });
  ok(td && (td.tr ? coach.includes(td.t) && await p.locator('[data-coach] [data-act=planStart]').count() === 1 : /יום מנוחה|התאוששות/.test(coach) && /האימון הבא/.test(coach)), 'today = the plan day (start button on training days; next workout on rest days)', td);
  const strip = await p.evaluate(() => [...document.querySelectorAll('[data-coach] .ws-d')].map(a => ({ h: a.getAttribute('href'), l: a.getAttribute('aria-label') })));
  const expStrip = await p.evaluate(() => Insights.weekStrip(Plans.active(), Store.today()).map(c => c.day ? '#/pday/' + c.day.n : null));
  ok(strip.length === 7 && strip.every((s, i) => s.h === expStrip[i]), 'week strip: 7 days linking to the right plan days', { strip, expStrip });
  ok(strip.every(s => s.l && s.l.length > 5), 'week strip cells have accessible labels');
  ok(await p.locator('[data-plan-stats]').count() === 1 && /שבועות רצופים/.test(await p.locator('[data-plan-stats]').innerText()), 'plan stats card with consistency');
  ok(await p.locator('[data-week-chart]').count() === 1, 'weekly chart follows the calendar week of the plan');
  ok(!/מתוך 30/.test(await p.locator('main').innerText()), 'no classic "day X of 30" cards while a personal plan is active');

  G = 'quick log';
  await p.fill('#h-w', '84.6'); await p.locator('[data-act=saveWeight]').click(); await p.waitForTimeout(250);
  ok(await p.evaluate(() => { const m = Core.measures().find(x => x.date === Store.today()); return m && Math.abs(m.weight - 84.6) < 0.01; }), 'weight saved from home as today\'s measurement');
  await p.fill('#h-w', '84.4'); await p.locator('[data-act=saveWeight]').click(); await p.waitForTimeout(250);
  ok(await p.evaluate(() => Core.measures().filter(x => x.date === Store.today()).length === 1 && Core.measures()[0].weight === 84.4), 'second save replaces the same day (no duplicates)');
  await p.locator('[data-act=water][data-ml="250"]').first().click(); await p.waitForTimeout(150); ok(await p.evaluate(() => Core.daily(Store.today()).water === 250), 'water +250 in one tap');

  G = 'calendar';
  await go('#/calendar');
  ok(/לוח התוכנית/.test(await p.locator('#top').innerText()), 'calendar opens on the active plan');
  const calOk = await p.evaluate(() => { const ds = Plans.days(Plans.active()); return [...document.querySelectorAll('.pc-d[href]')].every(a => { const n = +a.getAttribute('href').split('/').pop(); const d = ds.find(x => x.n === n); return d && a.getAttribute('aria-label').includes(d.title); }); });
  /* RC4 (TD-23): the expected number of linked cells is the number of plan days in the displayed month — computed from the plan,
     not a fixed 14. The old ">= 14" assumed at least 14 plan days are left in the current month, which is false from the 19th of
     a 31-day month when the plan starts today (13 days left on 2026-10-19). Product expectation unchanged: every plan day of the
     month is a linked cell whose label matches the plan, and there are no extra links. */
  const calExp = await p.evaluate(() => { const ym = Store.today().slice(0, 7); return Insights.monthGrid(Plans.active(), ym).flat().filter(c => c.inMonth && c.day).length; });
  const calN = await p.locator('.pc-d[href]').count();
  ok(calOk && calExp > 0 && calN === calExp, `every calendar cell = plan day on that date (label matches the plan); ${calN} linked cells = ${calExp} plan days in the displayed month`, { calN, calExp });
  ok(await p.locator('.pc-d.today').count() === 1, 'today highlighted once');
  const m0 = await p.locator('.month-nav h2').innerText(); await p.locator('[data-act=mnext]').click(); await p.waitForTimeout(200); const m1 = await p.locator('.month-nav h2').innerText();
  ok(m0 !== m1, 'month navigation', [m0, m1]); await p.locator('[data-act=mprev]').click(); await p.waitForTimeout(200);
  await p.locator('.pc-d[href]').nth(2).click(); await p.waitForTimeout(250); ok(/^#\/pday\/\d+$/.test(await p.evaluate(() => location.hash)), 'tap on a day opens the plan day');
  ok(await p.locator('[data-day-menu]').count() === 1, 'plan day links to that day\'s menu'); await p.locator('[data-day-menu]').click(); await p.waitForTimeout(250);
  ok(/^#\/nutrition\/\d{4}-\d{2}-\d{2}$/.test(await p.evaluate(() => location.hash)) && await p.locator('[data-menu-source=plan]').count() === 1, 'day menu opens on the plan menu');
  await go('#/calendar'); await p.locator('[data-act=classic]').click(); await p.waitForTimeout(200); ok(/לוח 30 יום/.test(await p.locator('#top').innerText()) && await p.locator('.banner.info [data-act=toPlan]').count() === 1, 'classic calendar still reachable and labelled as such');
  await p.locator('[data-act=toPlan]').click(); await p.waitForTimeout(200);

  G = 'workouts & progress';
  await go('#/workouts'); ok(await p.locator('.seg button[data-t=plan][aria-pressed=true]').count() === 1, 'workouts opens on "my plan"');
  ok(await p.locator('main .wstrip').count() === 1 && await p.locator('main .pdrow').count() >= 1, 'this week of the plan listed');
  await p.locator('[data-act=tab][data-t=program]').click(); await p.waitForTimeout(200);
  ok(/לא פעילה כרגע/.test(await p.locator('main').innerText()) && await p.locator('main .pill:text("היום")').count() === 0, 'classic program marked inactive, no competing "today"');
  await go('#/progress'); ok(await p.locator('[data-plan-progress]').count() === 1, 'progress shows the active plan section');
  ok(await p.evaluate(() => document.querySelector('[data-plan-progress]').compareDocumentPosition(document.querySelector('.classic-box')) & Node.DOCUMENT_POSITION_FOLLOWING), 'plan section first, classic summaries grouped after');

  G = 'task flows (taps measured)';
  const tap = async (sel, n) => { await p.locator(sel).first().click(); await p.waitForTimeout(220); return n + 1; };
  { await go('#/'); let n = 0; n = await tap('[data-act=water][data-ml="500"]', n); flows.push({ task: 'רישום מים', taps: n, from: 'בית' }); }
  { await go('#/'); let n = 0; n = await tap('[data-act=eat]', n); flows.push({ task: 'סימון ארוחה כנאכלה', taps: n, from: 'בית' }); ok(await p.evaluate(() => Core.entries(Store.today()).length >= 1), 'meal marked from home in 1 tap'); }
  { await go('#/'); await p.fill('#h-w', '84.1'); let n = 1; n = await tap('[data-act=saveWeight]', n); flows.push({ task: 'שקילה (הקלדה + שמירה)', taps: n, from: 'בית', before: 4 }); }
  { await go('#/'); let n = 0; const tr = await p.locator('[data-coach] [data-act=planStart]').count();
    if (tr) { n = await tap('[data-coach] [data-act=planStart]', n); flows.push({ task: 'התחלת אימון היום', taps: n, from: 'בית' }); await p.evaluate(() => { Store.clearSession(); }); await p.reload(); await p.waitForTimeout(300); }
    else { n = await tap('[data-coach] .next-up a', n); flows.push({ task: 'פתיחת האימון הבא (ביום מנוחה)', taps: n, from: 'בית' }); } }
  { await go('#/'); let n = 0; n = await tap('a[href="#/nutrition"]', n); n = await tap('[data-act=swapMeal][data-slot=m2]', n); n = await tap('.sheet [data-act=pick]', n); n = await tap('.sheet [data-act=ok]', n); flows.push({ task: 'החלפת ארוחה עם תצוגת הפרשים', taps: n, from: 'בית' }); }
  { await go('#/'); let n = 0; n = await tap('#nav a[href="#/calendar"]', n); n = await tap('.pc-d[href]', n); flows.push({ task: 'פתיחת יום בלוח', taps: n, from: 'בית' }); }
  ok(flows.every(f => f.taps <= 4), 'every common task ≤ 4 taps', flows);

  G = 'accessibility & layout';
  await go('#/');
  ok(await p.evaluate(() => document.documentElement.dir === 'rtl' || getComputedStyle(document.body).direction === 'rtl'), 'RTL');
  ok(await p.locator('#nav [role=navigation][aria-label]').count() === 1, 'bottom navigation is a labelled landmark');
  const small = await p.evaluate(() => [...document.querySelectorAll('main .btn, #nav a, main .chip, .icon-btn, main .ws-d, main .check')].filter(e => e.offsetParent).map(e => ({ h: Math.round(e.getBoundingClientRect().height), t: (e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 20) })).filter(x => x.h < 40));
  ok(!small.length, 'touch targets on home ≥ 40px tall (buttons 44px)', small);
  const unl = await p.evaluate(() => [...document.querySelectorAll('main button, main a')].filter(e => e.offsetParent && !(e.innerText || '').trim() && !e.getAttribute('aria-label')).length);
  ok(unl === 0, 'every button/link has text or an aria-label', unl);
  const vp = { iPhoneSE: [320, 568], iPhone13: [390, 844], iPhoneMax: [430, 932], iPadMini: [768, 1024], iPadAir: [820, 1180], iPadPro: [1024, 1366], desktop: [1280, 800] };
  const state = await p.evaluate(() => JSON.stringify(Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)]))));
  for (const [name, [w, h]] of Object.entries(vp)) {
    const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: w < 1000, hasTouch: w < 1100, locale: 'he-IL', serviceWorkers: 'block' }); const q = await c.newPage(); const e2 = []; q.on('pageerror', e => e2.push(e.message));
    await q.goto(URL0); await q.evaluate(st => { localStorage.clear(); Object.entries(JSON.parse(st)).forEach(([k, v]) => localStorage.setItem(k, v)); }, state); await q.reload(); await q.waitForTimeout(300);
    const bad = [];
    for (const hh of ['#/', '#/calendar', '#/workouts', '#/plan', '#/nutrition', '#/recipes', '#/progress', '#/profile', '#/settings', '#/ex/pushup', '#/pday/2', '#/setup/3']) { await q.evaluate(x => { location.hash = x; }, hh); await q.waitForTimeout(220); if (!(await q.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))) bad.push(hh); }
    if (w >= 900) { await q.evaluate(() => { location.hash = '#/'; }); await q.waitForTimeout(250); const cols = await q.evaluate(() => getComputedStyle(document.querySelector('main#view')).gridTemplateColumns.split(' ').length); ok(cols === 2, `${name}: dashboard uses 2 columns`, cols); }
    ok(!bad.length && !e2.length, `${name} ${w}px: no horizontal scroll, no errors on 12 screens`, { bad, e2 }); await c.close();
  }
  { const c = await b.newContext({ ...devices['iPhone 13'], reducedMotion: 'reduce', serviceWorkers: 'block' }); const q = await c.newPage(); await q.goto(URL0); await q.waitForTimeout(300);
    ok(await q.evaluate(() => getComputedStyle(document.querySelector('#view > *')).animationName === 'none'), 'prefers-reduced-motion disables the entrance animation'); await c.close(); }

  G = 'new user & states';
  await p.evaluate(() => { Store.resetAll(); localStorage.clear(); }); await p.reload(); await p.waitForTimeout(400);
  ok(await p.locator('.setup-cta a[href="#/setup/1"]').count() === 1, 'new user: clear onboarding entry on home');
  ok(await p.locator('[data-need=profile]').count() === 1, 'missing data state explains what is missing (no invented targets)');
  await go('#/calendar'); ok(/לוח 30 יום/.test(await p.locator('#top').innerText()) && await p.locator('.banner.info [data-act=toPlan]').count() === 0, 'new user calendar = classic program, no plan banner');
  await go('#/progress'); ok(await p.locator('.empty').count() >= 3, 'empty states in progress');
  await go('#/nosuchscreen'); ok(await p.locator('[data-coach], .setup-cta').count() >= 1, 'unknown route falls back to home');

  G = 'recipes paging, search, section index';
  { const vis = () => p.evaluate(() => [...document.querySelectorAll('.rcard')].filter(x => !x.hidden).length);
    await go('#/recipes'); const all = await p.locator('.rcard').count(), v0 = await vis(), h0 = await p.evaluate(() => document.documentElement.scrollHeight);
    const nR = await p.evaluate(() => NUTRI.RECIPES.length); /* H1: was a hard-coded 133; 11 recipes were added in H1 */ ok(all === nR && v0 === 24, `recipe list pages 24 at a time (all ${all} of ${nR} reachable)`, { all, v0, nR }); ok(h0 < 6000, `recipes page is short (${h0}px, was ~40,000px)`);
    await p.locator('[data-act=rcMore]').click(); ok(await vis() === 48, '"show more" adds the next 24');
    await p.fill('#rc-q', 'טופו'); const tq = await vis(), expect = await p.evaluate(() => NUTRI.RECIPES.filter(r => r.ing.some(x => /טופו/.test(NUTRI.FOODS[x.f].he)) || /טופו/.test(r.he)).length);
    ok(tq === expect && tq > 0, `search by ingredient matches the data (${tq}/${expect})`);
    await p.fill('#rc-q', 'zzqq'); ok(await vis() === 0 && await p.locator('[data-rc-none]').isVisible(), 'no-result state shown');
    await p.fill('#rc-q', ''); await p.locator('[data-act=rf][data-f=fish]').click(); await p.waitForTimeout(250);
    const fishN = await p.evaluate(() => NUTRI.RECIPES.filter(r => r.ing.some(x => ['salmon', 'white_fish', 'tuna_can', 'sardines'].includes(x.f))).length);
    ok(await p.locator('.rcard').count() === fishN, 'filters still apply to the full list');
    for (const h of ['#/profile', '#/settings']) { await go(h); const n = await p.locator('[data-sec-index] a').count(); ok(n >= 5, `${h}: section index with ${n} links`);
      await p.locator('[data-sec-index] a').nth(n - 1).click(); await p.waitForTimeout(700); ok(await p.evaluate(() => scrollY > 500 && location.hash), `${h}: index link jumps to the section without changing the route`); } }

  G = 'exercise library filters';
  { await go('#/workouts'); await p.locator('[data-act=tab][data-t=library]').click(); await p.waitForTimeout(250);
    const cnt = () => p.locator('#lib-list .li').count(), all = await cnt();
    await p.locator('[data-act=lf][data-f=noeq]').click(); await p.waitForTimeout(200); const noeq = await cnt();
    ok(noeq === await p.evaluate(() => EXERCISES.filter(e => !CATALOG.exFacts(e).eq.length).length) && noeq < all, `"no equipment" filter = independent count (${noeq}/${all})`);
    await p.locator('[data-act=lf][data-f=d3]').click(); await p.waitForTimeout(200);
    ok(await cnt() === await p.evaluate(() => EXERCISES.filter(e => { const f = CATALOG.exFacts(e); return !f.eq.length && f.d === 3; }).length), 'filters combine (no equipment AND challenging)');
    await p.locator('[data-act=lfclear]').click(); await p.waitForTimeout(200); await p.locator('[data-act=lf][data-f=video]').click(); await p.waitForTimeout(200);
    ok(await cnt() === 0 && /אין עדיין סרטוני הדגמה/.test(await p.locator('[data-lib-count]').innerText()), '"with video" filter honestly shows none exist yet');
    await p.locator('[data-act=lfclear]').click(); await p.waitForTimeout(200); ok(await cnt() === all, 'clear restores the full library'); }

  G = 'general';
  ok(!errs.some(e => /NOHANDLER/.test(e)), 'every button has a handler'); ok(errs.length === 0, 'no console errors', errs.slice(0, 3));
  await b.close();
  const pass = res.filter(r => r.ok).length, fail = res.length - pass, groups = {}; res.forEach(r => { groups[r.g] = groups[r.g] || { pass: 0, fail: 0 }; groups[r.g][r.ok ? 'pass' : 'fail']++; });
  fs.mkdirSync(path.join(__dirname, '../dist/reports'), { recursive: true }); fs.writeFileSync(path.join(__dirname, '../dist/reports/e2e-stageD.json'), JSON.stringify({ url: URL0, pass, fail, groups, flows, results: res }, null, 1));
  res.filter(r => !r.ok).forEach(r => console.log('FAIL [' + r.g + '] ' + r.m)); console.log(JSON.stringify(flows)); console.log(JSON.stringify(groups)); console.log(`stage D e2e: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('crashed', e.stack); console.log(res.slice(-4).map(r => (r.ok ? 'PASS ' : 'FAIL ') + r.m).join('\n')); process.exit(2); });
