/* RC5 · Plan B hub, NOW shortcuts and Beta Feedback — Playwright Chromium, iPhone 13 emulation (NOT Safari).
   Usage: node tools/e2e_planb_feedback.js [URL] */
const { chromium, devices } = require('playwright'); const fs = require('fs');
const URL0 = process.argv[2] || 'http://localhost:8096/';
const res = []; let G = ''; const ok = (c, m, i) => res.push({ g: G, ok: !!c, m: m + (i !== undefined && !c ? ' → ' + JSON.stringify(i).slice(0, 240) : '') });
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'he-IL', serviceWorkers: 'block', permissions: ['clipboard-read', 'clipboard-write'] }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const go = async h => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(600); };
  await p.goto(URL0); await p.waitForTimeout(700); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(700);
  await p.evaluate(() => { const pr = Store.load('profile'); Object.assign(pr, { age: 34, height: 172, weight: 78.4, startWeight: 78.4, sex: 'f', experience: 'beginner', onboarded: true }); Store.save('profile'); Core.eatSlot(Store.today(), 'm1', 1); });
  G = 'NOW shortcuts'; await go('#/'); const sc = await p.locator('[data-now-shortcuts] a').evaluateAll(a => a.map(x => x.getAttribute('href')));
  /* since SLL-33 the card holds at most 4 chips and contextual ones (evening water, tomorrow's workout) come first, so the
     steps chip depends on the clock; the rendered card always keeps Plan B and fridge, and at a fixed 10:00 clock all three fit */
  ok(['#/planb', '#/fridge'].every(h => sc.includes(h)), 'NOW card always offers Plan B and fridge shortcuts', sc);
  const sc10 = await p.evaluate(() => Screens.nowShortcuts(Store.today(), new Date(Store.today() + 'T10:00:00')).map(x => (x.html.match(/href="([^"]+)"/) || [])[1]).filter(Boolean));
  ok(['#/planb', '#/fridge', '#/activity'].every(h => sc10.includes(h)), 'at 10:00 (fixed clock) the NOW shortcuts include Plan B, fridge and steps', sc10);
  G = 'Plan B'; await go('#/planb');
  ok(await p.locator('[data-planb-stop]').count() === 1 && /עוצרים את האימון/.test(await p.locator('[data-planb-stop]').innerText()), 'safe-stop guidance shown first');
  const links = await p.locator('[data-planb]').evaluateAll(a => a.map(x => ({ k: x.dataset.planb, h: x.getAttribute('href') })));
  ok(links.length === 6, 'six situations offered', links);
  const before = await p.evaluate(() => localStorage.getItem('fit30.workouts') + localStorage.getItem('fit30.nutrition'));
  for (const l of links) { await go(l.h); const t = await p.locator('main').innerText(); ok(t.length > 40 && !/אירעה שגיאה/.test(t), `"${l.k}" opens a working screen (${l.h})`); }
  ok(await p.evaluate(() => localStorage.getItem('fit30.workouts') + localStorage.getItem('fit30.nutrition')) === before, 'visiting Plan B options changes no data');
  G = 'feedback'; await go('#/settings'); ok(await p.locator('[data-feedback-link]').count() === 1, 'feedback entry in settings');
  await go('#/feedback'); await p.fill('#fb-t', 'הכפתור לא מגיב'); await p.selectOption('#fb-s', 'תזונה'); await p.waitForTimeout(200);
  const pv = await p.locator('[data-fb-preview]').innerText();
  ok(/הכפתור לא מגיב/.test(pv) && /מסך: תזונה/.test(pv) && /גרסה: /.test(pv), 'preview shows the text, screen and build');
  const name = await p.evaluate(() => { const r = Core.entries(Store.today())[0]; return r ? r.name : ''; });
  ok(!/78[.,]4|78\.4/.test(pv) && !(name && pv.includes(name)) && !/גיל|משקל: \d/.test(pv), 'no personal data by default (no weight, no journal entries)', pv.slice(0, 200));
  await p.locator('#fb-tech').uncheck(); await p.waitForTimeout(150); ok(!/פרטים טכניים/.test(await p.locator('[data-fb-preview]').innerText()), 'technical details can be left out');
  await p.locator('[data-act=fcopy]').click(); await p.waitForTimeout(300);
  const clip = await p.evaluate(() => navigator.clipboard.readText()).catch(() => null);
  ok(clip === await p.locator('[data-fb-preview]').innerText(), 'copied text = exactly the preview');
  G = 'SLL-07 Plan B by what changed (signals stored on the device + local clock)';
  { const T = await p.evaluate(() => Store.today()), sig = iso => p.evaluate(iso => Screens.planbSignals(new Date(iso)).map(x => ({ k: x.k, why: x.why })), iso);
    await p.evaluate(() => { localStorage.removeItem('fit30.session'); const nu = Store.load('nutrition'); if (nu.shopping) nu.shopping.state = {}; Store.save('nutrition'); });
    const s10 = await sig(T + 'T10:00:00'); ok(!s10.some(x => ['time', 'ingredient', 'parked'].includes(x.k)), 'morning, nothing pending: no time / ingredient / parked suggestion', s10);
    const wDone = await p.evaluate(d => { const w = (Core.dailyProgress(d).tasks || []).find(x => x.k === 'workout'); return w ? w.v : null; }, T);
    const s20 = await sig(T + 'T20:00:00'); ok(wDone == null || wDone >= 1 ? !s20.some(x => x.k === 'time') : s20.some(x => x.k === 'time' && /20:00/.test(x.why)), '20:00 and today\'s workout not done → "אין לי זמן" suggested, with the time in the reason', { s20, wDone });
    ok(JSON.stringify(await sig(T + 'T20:00:00')) === JSON.stringify(s20), 'deterministic for the same state and clock');
    await p.evaluate(() => { const nu = Store.load('nutrition'); nu.shopping = nu.shopping || { checked: {} }; nu.shopping.state = { tomato: 'notfound', onion: 'notfound' }; Store.save('nutrition'); });
    const sN = await sig(T + 'T10:00:00'); ok(sN.some(x => x.k === 'ingredient' && /2 פריטים/.test(x.why)), '2 shopping items marked "לא נמצא" → "חסר לי מרכיב" suggested with the count', sN);
    await go('#/planb'); const keys = await p.locator('[data-planb]').evaluateAll(a => a.map(x => x.dataset.planb));
    ok(keys.filter(k => k === 'ingredient').length === 1 && await p.locator('[data-planb-now] [data-planb=ingredient]').getAttribute('href') === '#/shopping', 'the ingredient option moves to "מומלץ עכשיו", points to the shopping list, and appears only once', keys);
    ok(new Set(keys).size === keys.length, 'no option is listed twice', keys);
    ok(await p.locator('[data-planb-why=ingredient]').count() === 1, 'the reason is shown under the suggestion');
    await p.evaluate(() => { const nu = Store.load('nutrition'); nu.shopping.state = {}; Store.save('nutrition'); });
    await p.evaluate(() => localStorage.setItem('fit30.session', JSON.stringify({ day: 1, version: 'std', stepIdx: 2, total: 10, log: { 0: { done: true }, 1: { done: true } }, startedAt: Date.now() - 600000, activeMs: 300000, lastResume: null, seenAt: Date.now(), paused: true, parked: true, rest: null, work: null, finished: false })));
    await p.reload(); await p.waitForTimeout(900); await go('#/planb');
    ok(await p.locator('[data-planb-now] [data-act=resume]').count() === 1, 'a workout saved midway → "להמשיך את האימון ששמרתי" at the top');
    const before2 = await p.evaluate(() => localStorage.getItem('fit30.session'));
    ok(JSON.parse(before2).parked === true, 'showing the suggestion does not resume anything by itself');
    await p.locator('[data-planb-now] [data-act=resume]').click(); await p.waitForTimeout(900);
    ok(await p.locator('.run').count() === 1 && (await p.evaluate(() => JSON.parse(localStorage.getItem('fit30.session')))).stepIdx === 2, 'tapping it reopens the workout at the same step');
    await p.evaluate(() => { Run.close(); localStorage.removeItem('fit30.session'); });
    /* missed sessions: a personal plan that started 10 days ago (stored start moved back, as an older install would have) */
    const miss = await p.evaluate(() => { const pr = Store.load('profile'); Object.assign(pr, { aims: { primary: 'general', secondary: [] } }); pr.availability = { days: [0, 1, 2, 3, 4, 5, 6], sessions: 6, prefMin: null, maxMin: 30 }; Store.save('profile');
      const pl = Plans.activate(Plans.create('general_90', Plans.paramsFromProfile(Store.load('profile')), Store.today()));
      const st = Store.load('plans'); st.list[pl.id].start = Store.addDays(Store.today(), -10); Store.save('plans');
      return Plans.days(Plans.active()).filter(d => d.status === 'missed' && d.date >= Store.addDays(Store.today(), -7)).length; });
    const sM = await sig(T + 'T10:00:00'); ok(miss > 0 ? sM.some(x => x.k === 'missed') : true, 'missed sessions in the last 7 days → "פספסתי אימונים" suggested', { miss, sM });
    await go('#/'); await go('#/planb'); if (miss > 0) ok(await p.locator('[data-planb-now] [data-planb=missed]').getAttribute('href') === '#/plan', '"פספסתי אימונים" opens the plan screen (move or skip there, by choice)');
  }
  ok(errs.length === 0, 'no page errors', errs.slice(0, 3));
  await b.close(); const pass = res.filter(r => r.ok).length, fail = res.length - pass;
  fs.mkdirSync('dist/reports', { recursive: true }); fs.writeFileSync('dist/reports/e2e-planb-feedback.json', JSON.stringify({ url: URL0, at: new Date().toISOString(), pass, fail, results: res }, null, 1));
  res.forEach(r => console.log((r.ok ? 'PASS ' : 'FAIL ') + '[' + r.g + '] ' + r.m)); console.log(`planb/feedback e2e: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { res.forEach(r => console.log((r.ok ? 'PASS ' : 'FAIL ') + '[' + r.g + '] ' + r.m)); console.error('planb/feedback e2e crashed in [' + G + ']: ' + e.message.split('\n')[0]); process.exit(2); });
