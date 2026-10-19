/* Stage E browser tests (Playwright Chromium, iPhone-13 emulation — NOT a physical iPhone, NOT Safari).
   Every exercise page and every recipe page is opened; media states must be honest and the content complete.
   Usage: node tools/e2e_stageE.js [URL] — writes dist/reports/e2e-stageE.json */
const { chromium, devices } = require('playwright'); const fs = require('fs'), path = require('path');
const URL0 = process.argv[2] || 'http://localhost:8096/';
const res = []; let G = ''; const ok = (c, m, info) => res.push({ g: G, ok: !!c, m: m + (info !== undefined && !c ? ' → ' + JSON.stringify(info).slice(0, 300) : '') });
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'he-IL', serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/ERR_|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await p.goto(URL0); await p.waitForTimeout(500);
  const exIds = await p.evaluate(() => EXERCISES.map(e => e.id)), rcIds = await p.evaluate(() => NUTRI.RECIPES.map(r => r.id));

  G = 'every exercise page';
  const exBad = { facts: [], safety: [], label: [], status: [], fakeVideo: [], steps: [] };
  for (const id of exIds) {
    await p.evaluate(x => { location.hash = '#/ex/' + x; }, id); await p.waitForTimeout(60);
    const r = await p.evaluate(() => { const v = document.getElementById('view'); return { facts: !!v.querySelector('[data-ex-facts]') && /שרירים עיקריים/.test(v.querySelector('[data-ex-facts]').textContent) && /ציוד/.test(v.querySelector('[data-ex-facts]').textContent),
      safety: v.querySelectorAll('[data-ex-safety] li').length, label: /אנימציית איור/.test(v.textContent), status: !!v.querySelector('[data-media-status=missing]'), video: v.querySelectorAll('video').length, steps: v.querySelectorAll('ol.steps li').length, mist: /טעויות נפוצות/.test(v.textContent) }; });
    if (!r.facts) exBad.facts.push(id); if (r.safety < 3) exBad.safety.push(id); if (!r.label) exBad.label.push(id); if (!r.status) exBad.status.push(id); if (r.video) exBad.fakeVideo.push(id); if (r.steps < 2 || !r.mist) exBad.steps.push(id);
  }
  ok(!exBad.facts.length, `${exIds.length} exercise pages show muscles + equipment`, exBad.facts);
  ok(!exBad.safety.length, 'every exercise page shows ≥3 safety cues', exBad.safety);
  ok(!exBad.steps.length, 'every exercise page shows steps and common mistakes', exBad.steps);
  ok(!exBad.label.length, 'the demo is labelled "illustration animation" on every page', exBad.label);
  ok(!exBad.status.length && !exBad.fakeVideo.length, 'no video exists → explicit "no demo video yet" status, and no <video> element is shown', { status: exBad.status, video: exBad.fakeVideo });

  G = 'every recipe page';
  const rcBad = { steps: [], status: [], art: [], video: [] };
  for (const id of rcIds) {
    await p.evaluate(x => { location.hash = '#/recipe/' + x; }, id); await p.waitForTimeout(50);
    const r = await p.evaluate(() => { const v = document.getElementById('view'); return { steps: v.querySelectorAll('ol.steps li').length, status: !!v.querySelector('[data-rc-media][data-media-status=missing]'), art: /איור .*אין עדיין צילום/.test(v.textContent), video: v.querySelectorAll('video').length }; });
    if (r.steps < 1) rcBad.steps.push(id); if (!r.status) rcBad.status.push(id); if (!r.art) rcBad.art.push(id); if (r.video) rcBad.video.push(id);
  }
  ok(!rcBad.steps.length, `${rcIds.length} recipe pages show numbered preparation steps`, rcBad.steps);
  ok(!rcBad.art.length, 'missing dish photo → labelled illustration ("no photo yet")', rcBad.art);
  ok(!rcBad.status.length && !rcBad.video.length, 'missing prep video / step photos → explicit status, no video element', rcBad);

  G = 'performance & layout';
  { const c2 = await b.newContext({ viewport: { width: 320, height: 700 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' }); const q = await c2.newPage();
    await q.goto(URL0); await q.waitForTimeout(400); const wide = [];
    for (const h of ['#/ex/squat', '#/ex/burpee', '#/ex/bulgarian_split_squat', '#/recipe/salmon_quinoa_edamame', '#/recipe/chicken_curry_rice', '#/media']) { await q.evaluate(x => { location.hash = x; }, h); await q.waitForTimeout(200); if (!(await q.evaluate(() => document.documentElement.scrollWidth <= innerWidth))) wide.push(h); }
    ok(!wide.length, 'exercise/recipe/media pages fit 320px', wide); await c2.close(); }
  { const reqs = []; const c3 = await b.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block' }); const q = await c3.newPage(); q.on('request', r => reqs.push(r.url()));
    await q.goto(URL0 + '#/workouts'); await q.waitForTimeout(800); const media = reqs.filter(u => /\/media\//.test(u));
    ok(media.length <= 12, `lazy loading: opening a list loads only visible covers (${media.length} media requests)`); await c3.close(); }

  G = 'general'; ok(errs.length === 0, 'no console errors', errs.slice(0, 3));
  await b.close();
  const pass = res.filter(r => r.ok).length, fail = res.length - pass, groups = {}; res.forEach(r => { groups[r.g] = groups[r.g] || { pass: 0, fail: 0 }; groups[r.g][r.ok ? 'pass' : 'fail']++; });
  fs.mkdirSync(path.join(__dirname, '../dist/reports'), { recursive: true }); fs.writeFileSync(path.join(__dirname, '../dist/reports/e2e-stageE.json'), JSON.stringify({ url: URL0, pass, fail, groups, results: res }, null, 1));
  res.filter(r => !r.ok).forEach(r => console.log('FAIL [' + r.g + '] ' + r.m)); console.log(JSON.stringify(groups)); console.log(`stage E e2e: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('crashed', e.stack); process.exit(2); });
