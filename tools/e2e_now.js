/* RC5 · SofitGo NOW (first slice) — Playwright Chromium, iPhone 13 emulation (NOT Safari, NOT a device).
   The card must reflect stored data: what is done, the next step in the documented order (workout → first unmarked planned
   meal → water), a smallest-step hint, and it must not claim AI or professional credentials.
   Usage: node tools/e2e_now.js [URL] */
const { chromium, devices } = require('playwright'); const fs = require('fs');
const URL0 = process.argv[2] || 'http://localhost:8096/';
const res = []; let G = ''; const ok = (c, m, i) => res.push({ g: G, ok: !!c, m: m + (i !== undefined && !c ? ' → ' + JSON.stringify(i).slice(0, 300) : '') });
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'he-IL', serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const go = async h => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(400); };
  const next = async () => { await p.locator('[data-act=next]').click(); await p.waitForTimeout(350); };
  await p.goto(URL0); await p.waitForTimeout(700); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(700);
  G = 'classic program (fresh install)';
  /* a fresh install runs the classic 30-day program from today (home shows "יום 1 מתוך 30"), so the card belongs there too */
  { const c = await p.evaluate(() => { const c = document.querySelector('[data-now]'); const nx = c && c.querySelector('[data-now-next]'); const t = Core.dailyProgress(Store.today()).tasks;
      return { shown: !!c, next: nx ? nx.dataset.nowNext : null, workout: (t.find(x => x.k === 'workout') || {}).v, n: Core.todayN() }; });
    ok(c.shown === (c.n >= 1 && c.n <= 30), 'NOW card shown exactly when the classic program has a current day', c);
    if (c.shown) ok(c.workout == null || c.workout >= 1 || c.next === 'workout', 'classic day: an unfinished workout is the next step', c); }
  await go('#/setup/1'); await p.fill('#pf-age', '34'); await p.fill('#pf-h', '172'); await p.fill('#pf-w', '78'); await p.locator('[data-act=xp][data-v=beginner]').click(); await p.waitForTimeout(250); await next();
  await p.locator('[data-act=gp][data-v=general]').click(); await p.waitForTimeout(200); await next();
  for (const d of [1, 3, 5]) { await p.locator(`[data-act=dw][data-v="${d}"]`).click(); await p.waitForTimeout(120); }
  await p.locator('[data-act=ses][data-v="3"]').click(); await p.waitForTimeout(150); await p.selectOption('#pf-pref', '30'); await p.selectOption('#pf-max', '45'); await next();
  await p.locator('[data-act=tpl][data-v=general_90]').click(); await p.waitForTimeout(200); await next(); await next(); await next(); await p.waitForTimeout(400);
  await go('#/'); const today = await p.evaluate(() => Store.today());
  const st = () => p.evaluate(() => { const c = document.querySelector('[data-now]'); if (!c) return null; const nx = c.querySelector('[data-now-next]');
    return { next: nx ? nx.dataset.nowNext : null, nextText: nx ? nx.textContent : '', q: c.querySelector('.now-q').textContent, done: [...c.querySelectorAll('[data-done]')].map(x => ({ k: x.dataset.done, ok: x.getAttribute('aria-pressed') === 'true' })), small: (c.querySelector('[data-now-small]') || {}).textContent || '', text: c.textContent }; });
  const truth = () => p.evaluate(d => { const t = Core.dailyProgress(d).tasks; const pl = Core.plan(d); return { workout: (t.find(x => x.k === 'workout') || {}).v, meals: ['m1', 'm2', 'snack'].filter(k => pl[k] && pl[k].rid && !pl[k].off && !pl[k].missing).map(k => ({ k, eaten: !!Core.slotEntry(d, k) })), water: Core.daily(d).water || 0, goal: Core.profile().goals.water }; }, today);
  G = 'card reflects stored data';
  let s = await st(), t = await truth();
  ok(!!s, 'NOW card shown on home once a plan is active');
  const expect = tr => tr.workout != null && tr.workout < 1 ? 'workout' : (tr.meals.find(m => !m.eaten) || {}).k || (tr.water < tr.goal ? 'water' : null);
  ok(s.next === expect(t), 'next step follows the documented order', { s: s.next, exp: expect(t), t });
  ok(s.done.every(d => !d.ok), 'nothing shown as done on a fresh day', s.done);
  ok(s.small.length > 10, 'a smallest-step hint is offered', s.small);
  ok(/Sofit/.test(s.text) && /לא על ידי מודל בינה מלאכותית/.test(s.text) && /לא דיאטנית או רופאה/.test(s.text), 'coach named, method disclosed, no AI or credential claim');
  const av = await p.evaluate(() => { const i = document.querySelector('.coach-av'); return i ? { nw: i.naturalWidth, w: i.getBoundingClientRect().width, dpr: devicePixelRatio } : null; });
  ok(av && av.nw >= av.w * av.dpr, 'coach avatar is not upscaled (source px ≥ displayed px × DPR)', av);
  G = 'acting from the card';
  if (s.next === 'workout') { await p.evaluate(d => { const ap = Plans.active(), td = Plans.todayDay(ap); Plans.skip(ap.id, td.n); }, today).catch(e => null); await go('#/calendar'); await go('#/'); s = await st(); t = await truth();
    ok(s.next === expect(t), 'after the workout is skipped (API setup), next moves on', { s: s.next, t }); }
  for (let i = 0; i < 4 && s && s.next && s.next !== 'water' && s.next !== 'workout'; i++) { const k = s.next; await p.locator('[data-now-next] [data-act=eat]').click(); await p.waitForTimeout(400); s = await st(); t = await truth();
    ok(t.meals.find(m => m.k === k).eaten && s.done.find(d => d.k === k).ok, `"סמן שאכלתי" in the card stores ${k} and the chip turns done`); ok(s.next === expect(t), 'next step advances in order', { s: s.next, t }); }
  if (s && s.next === 'water') { const w0 = (await truth()).water; await p.locator('[data-now-next] [data-act=water]').click(); await p.waitForTimeout(300); ok((await truth()).water === w0 + 250, 'water button adds 250 ml');
    await p.evaluate(d => Core.setDaily(d, { water: Core.profile().goals.water }), today); await go('#/calendar'); await go('#/'); s = await st();
    ok(s.next === null && /בוצע ✓/.test(s.q), 'when everything planned is done the card says so and recommends rest'); }
  ok(errs.length === 0, 'no page errors', errs.slice(0, 3));
  await b.close(); const pass = res.filter(r => r.ok).length, fail = res.length - pass;
  fs.mkdirSync('dist/reports', { recursive: true }); fs.writeFileSync('dist/reports/e2e-now.json', JSON.stringify({ url: URL0, at: new Date().toISOString(), pass, fail, results: res }, null, 1));
  res.forEach(r => console.log((r.ok ? 'PASS ' : 'FAIL ') + '[' + r.g + '] ' + r.m)); console.log(`now e2e: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { res.forEach(r => console.log((r.ok ? 'PASS ' : 'FAIL ') + '[' + r.g + '] ' + r.m)); console.error('now e2e crashed in [' + G + ']: ' + e.message.split('\n')[0]); process.exit(2); });
