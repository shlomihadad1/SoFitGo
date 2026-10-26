/* SLL-19 + SLL-01 · Workout by feeling, one step — Playwright Chromium, iPhone 13 emulation (NOT Safari). Energy / desired feel / place
   map transparently onto the builder's existing choices; "לבנות עכשיו" builds in one tap; low energy never raises load; the hotel
   choice means no equipment and no jumping; "למלא ולערוך" leaves the form editable. Usage: node tools/e2e_feel.js [URL] */
const { chromium, devices } = require('playwright'); const fs = require('fs');
const URL0 = process.argv[2] || 'http://localhost:8096/';
const res = []; let G = ''; const ok = (c, m, i) => res.push({ g: G, ok: !!c, m: m + (i !== undefined && !c ? ' → ' + JSON.stringify(i).slice(0, 300) : '') });
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'he-IL', serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const go = async h => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(800); };
  await p.goto(URL0); await p.waitForTimeout(700); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(700);
  await p.evaluate(() => { const pr = Store.load('profile'); Object.assign(pr, { age: 34, height: 172, weight: 78, startWeight: 78, sex: 'f', experience: 'intermediate', onboarded: true }); pr.availability = { days: [1, 3, 5], sessions: 3, prefMin: 30, maxMin: 45 }; pr.environment = { place: 'home', equipment: ['chair', 'dumbbells'], custom: [] }; Store.save('profile'); });
  const pick = async (q, v) => { await p.locator(`[data-act=feel][data-q=${q}][data-v=${v}]`).click(); await p.waitForTimeout(250); };

  G = 'one step';
  await go('#/builder/new'); ok(await p.locator('[data-feel]').count() === 1 && await p.locator('[data-feel-map]').count() === 0, '"לפי ההרגשה" is on top; no mapping until all three are chosen');
  await pick('energy', 'low'); await pick('feel', 'calm'); await pick('place', 'hotel');
  const map = await p.locator('[data-feel-map]').textContent();
  ok(/ניידות/.test(map) && /15 דק׳/.test(map) && /מתחיל/.test(map) && /בלי ציוד/.test(map) && /בלי קפיצות/.test(map), 'the mapping is shown before building: mobility, 15 min, one level easier, no equipment, no jumping', map);
  await p.locator('[data-act=feelGo]').click(); await p.waitForTimeout(900);
  const d = await p.evaluate(() => { const s = Screens._builder; return s.draft && { goal: s.draft.params.goal, min: s.draft.params.minutes, lvl: s.draft.params.level, eq: s.draft.params.equipment, nj: s.draft.params.noJump, main: s.draft.main.map(x => x.ex) }; });
  ok(d && d.goal === 'mobility' && d.min === 15 && d.lvl === 'beginner' && d.eq.length === 0 && d.nj === true && d.main.length > 0, '"לבנות עכשיו" builds a workout in one tap with those choices', d);
  const bad = await p.evaluate(ids => ids.filter(id => { const m = CATALOG.exMeta(id) || {}; return m.impact === 'high' || (m.eq || []).some(e => e !== 'none'); }), d ? d.main : []);
  ok(bad.length === 0, 'hotel: no high-impact and no equipment exercises in the result', bad);

  G = 'energy never raises load when low';
  await p.evaluate(() => { Screens._builder.feel = {}; Screens._builder.form = null; }); await go('#/builder'); await go('#/builder/new'); await pick('energy', 'low'); await pick('feel', 'strong'); await pick('place', 'mine');
  await p.locator('[data-act=feelFill]').click(); await p.waitForTimeout(600);
  const f1 = await p.evaluate(() => ({ ...Screens._builder.form }));
  ok(f1.goal === 'strength' && f1.minutes === 15 && f1.level === 'beginner' && JSON.stringify(f1.equipment) === '["chair","dumbbells"]', 'low energy + strength + my equipment → filled form: 15 min, one level easier, my equipment', f1);
  ok(await p.locator('[data-builder-form]').count() === 1 && await p.locator('[data-act=fGen]').count() === 1, '"למלא ולערוך" leaves the full form editable before building');
  await pick('energy', 'low'); await pick('energy', 'high'); await p.locator('[data-act=feelFill]').click(); await p.waitForTimeout(500);
  const f2 = await p.evaluate(() => ({ ...Screens._builder.form }));
  ok(f2.minutes === 45 && f2.level === 'intermediate', 'high energy → +15 min on the profile time (30 → 45), level unchanged', f2);

  ok(errs.length === 0, 'no page errors', errs.slice(0, 3));
  await b.close();
  const pass = res.filter(r => r.ok).length, fail = res.length - pass;
  res.forEach(r => console.log((r.ok ? 'PASS' : 'FAIL') + ' [' + r.g + '] ' + r.m));
  fs.mkdirSync('dist', { recursive: true }); fs.writeFileSync('dist/e2e_feel.json', JSON.stringify(res, null, 1));
  console.log(`feel e2e: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('feel e2e crashed in [' + G + ']: ' + (e.stack || e.message).slice(0, 600)); process.exit(1); });
