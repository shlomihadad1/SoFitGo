/* SLL-20 · Progress Story — Playwright Chromium, iPhone 13 emulation (NOT Safari). The weekly review separates facts (from the
   log), interpretation (labelled, rule-based) and what got in the way (the plan's missed / skipped / partial days, with dates);
   each section carries its provenance label. Usage: node tools/e2e_story.js [URL] */
const { chromium, devices } = require('playwright'); const fs = require('fs');
const URL0 = process.argv[2] || 'http://localhost:8096/';
const res = []; let G = ''; const ok = (c, m, i) => res.push({ g: G, ok: !!c, m: m + (i !== undefined && !c ? ' → ' + JSON.stringify(i).slice(0, 260) : '') });
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'he-IL', serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const go = async h => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(800); };
  await p.goto(URL0); await p.waitForTimeout(700); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(700);
  const st = await p.evaluate(() => { const pr = Store.load('profile'); Object.assign(pr, { age: 34, height: 172, weight: 78, startWeight: 78, sex: 'f', experience: 'beginner', onboarded: true, aims: { primary: 'general', secondary: [] } }); pr.availability = { days: [0, 1, 2, 3, 4, 5, 6], sessions: 6, prefMin: null, maxMin: 30 }; Store.save('profile');
    const pl = Plans.activate(Plans.create('general_90', Plans.paramsFromProfile(Store.load('profile')), Store.today())); const s = Store.load('plans'); s.list[pl.id].start = Store.addDays(Store.today(), -9); Store.save('plans');
    const r = Signature.review(Plans.active()); return { w: r.w, t: r.training, br: r.barriers }; });
  G = 'facts, interpretation, barriers';
  await go('#/review/' + st.w);
  ok(await p.locator('[data-review=story]').count() === 1, 'the weekly review starts with "הסיפור של השבוע"');
  const facts = await p.locator('[data-story-facts] li').allTextContents();
  ok(facts.some(x => new RegExp(`${st.t.done + st.t.partial} מתוך ${st.t.planned} אימונים`).test(x)), 'facts: the session count straight from the log', { facts, t: st.t });
  ok(await p.locator('[data-review=story] [data-src=rec]').count() === 1 && await p.locator('[data-story-interp] li').count() >= 1, 'interpretation is a separate list, labelled "פרשנות"');
  const pct = st.t.planned ? (st.t.done + st.t.partial) / st.t.planned : null, interp = (await p.locator('[data-story-interp]').textContent());
  ok(pct == null || (pct < 0.5 ? /קשה להתמדה/.test(interp) && await p.locator('[data-story-interp] a[href="#/planb"]').count() === 1 : !/קשה להתמדה/.test(interp)), 'the rule matches the numbers (below 50% → "קשה להתמדה" + Plan B link)', { pct, interp });
  const bs = await p.locator('[data-barrier]').count(); ok(st.br.length >= 1 && bs === st.br.length, 'what got in the way: one line per missed / skipped / partial day, with its date', { model: st.br.length, shown: bs });
  G = 'labels';
  ok(await p.locator('[data-review=training] h3 [data-src=user]').count() === 1 && await p.locator('[data-review=nutrition] h3 [data-src=est]').count() === 1, 'workouts are "נרשם על ידך"; nutrition averages are an estimate');
  ok(errs.length === 0, 'no page errors', errs.slice(0, 3));
  await b.close();
  const pass = res.filter(r => r.ok).length, fail = res.length - pass;
  res.forEach(r => console.log((r.ok ? 'PASS' : 'FAIL') + ' [' + r.g + '] ' + r.m));
  fs.mkdirSync('dist', { recursive: true }); fs.writeFileSync('dist/e2e_story.json', JSON.stringify(res, null, 1));
  console.log(`story e2e: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('story e2e crashed in [' + G + ']: ' + (e.stack || e.message).slice(0, 500)); process.exit(1); });
