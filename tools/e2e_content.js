/* Content screens: every exercise page shows full written instructions (start, numbered steps, breathing, common mistakes,
   levels, alternatives) plus the illustration; every recipe page shows ingredients with amounts, numbered steps and times; the
   in-workout "how to" opens; the media status screen reports real coverage without "missing" labels on written guidance.
   Usage: [BROWSER=webkit] node tools/e2e_content.js [URL] */
const pw = require('playwright'), { devices } = pw; const ENGINE = process.env.BROWSER || 'chromium';
const URL0 = process.argv[2] || 'http://localhost:8096/';
const res = []; let G = ''; const ok = (c, m, i) => res.push({ g: G, ok: !!c, m: m + (i !== undefined && !c ? ' → ' + JSON.stringify(i).slice(0, 600) : '') });
(async () => {
  const b = await pw[ENGINE].launch(); console.log('engine: ' + ENGINE); const errs = [];
  const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'he-IL', serviceWorkers: 'block' }); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL0); await p.waitForTimeout(700); await p.evaluate(() => { Store.resetAll(); localStorage.clear(); const pr = Store.load('profile'); Object.assign(pr, { age: 34, height: 176, weight: 80, startWeight: 80, sex: 'm' }); Store.save('profile'); }); await p.reload(); await p.waitForTimeout(800);
  const go = async h => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(120); };
  G = 'exercise pages (all)';
  const ids = await p.evaluate(() => EXERCISES.map(e => e.id)), badEx = [];
  for (const id of ids) { await go('#/ex/' + id);
    const r = await p.evaluate(id => { const e = EX_BY_ID[id], v = document.getElementById('view'), t = v.innerText;
      return { steps: v.querySelectorAll('ol.steps li').length, want: e.steps.length, start: t.includes(e.start), breath: t.includes(e.breath), mistake: t.includes(e.mistakes[0]), fig: !!v.querySelector('[data-fig]'), honest: !!v.querySelector('[data-media-status]') || !!v.querySelector('video'), noMissingWord: !/חסר/.test(v.querySelector('[data-media-status]') ? v.querySelector('[data-media-status]').innerText : '') }; }, id);
    if (!(r.steps >= r.want && r.start && r.breath && r.mistake && r.fig && r.honest && r.noMissingWord)) badEx.push({ id, r }); }
  ok(!badEx.length, `all ${ids.length} exercise pages: start position, numbered steps, breathing, mistakes, illustration, honest media note`, badEx.slice(0, 4));
  G = 'recipe pages (all)';
  const rids = await p.evaluate(() => NUTRI.RECIPES.map(r => r.id)), badRc = [];
  for (const id of rids) { await go('#/recipe/' + id); await p.waitForTimeout(id === rids[0] ? 900 : 60);
    const r = await p.evaluate(id => { const x = Logic.recipe(id), v = document.getElementById('view'), t = v.innerText, F = NUTRI.FOODS;
      return { steps: v.querySelectorAll('ol.steps li').length, want: x.steps.length, ing: x.ing.every(i => t.includes(F[i.f].he.split(' (')[0])), time: /דק׳/.test(t), missing: /אין עדיין סרטון הכנה/.test(t) }; }, id);
    if (!(r.steps === r.want && r.ing && r.time && !r.missing)) badRc.push({ id, r }); }
  ok(!badRc.length, `all ${rids.length} recipe pages: ingredients, every numbered step, times; no "guidance missing" banner`, badRc.slice(0, 4));
  G = 'buttons';
  await go('#/day/3'); await p.waitForTimeout(400); await p.locator('.seg [data-v=std]').click(); await p.locator('[data-act=start]').click(); await p.locator('.sheet [data-act=go]').click(); await p.waitForTimeout(400);
  await p.locator('.run [data-howto] summary').click(); await p.waitForTimeout(150);
  ok(await p.evaluate(() => { const d = document.querySelector('.run [data-howto]'); return d.open && d.querySelectorAll('ol.steps li').length >= 3; }), '"איך מבצעים" in the workout opens the steps');
  await p.evaluate(() => { Store.clearSession(); document.querySelector('.run').remove(); document.body.style.overflow = ''; });
  await go('#/recipes'); await p.waitForTimeout(1200); const first = p.locator('#view a[href^="#/recipe/"]').first(); const href = await first.getAttribute('href'); await first.click(); await p.waitForTimeout(500);
  ok(await p.evaluate(() => location.hash) === href && await p.locator('#view ol.steps li').count() >= 1, 'opening a recipe from the list shows its steps');
  await go('#/workouts'); await p.waitForTimeout(500); await p.locator('[data-act=tab][data-t=library]').first().click(); await p.waitForTimeout(500); const ex1 = p.locator('#view a[href^="#/ex/"]').first(); const exh = await ex1.getAttribute('href'); await ex1.click(); await p.waitForTimeout(400);
  ok(await p.evaluate(() => location.hash) === exh && await p.locator('#view ol.steps li').count() >= 3, 'opening an exercise from the library shows its steps');
  G = 'media status';
  await go('#/media'); await p.waitForTimeout(1200); const mt = await p.locator('main').innerText();
  ok(/הוראות ביצוע מלאות לתרגילים[\s\S]{0,40}57\/57/.test(mt) && /הוראות הכנה מלאות למתכונים[\s\S]{0,40}144\/144/.test(mt), 'coverage rows: 57/57 exercises, 144/144 recipes with full written guidance', mt.slice(0, 400));
  ok(/סרטוני הדגמה לתרגילים[\s\S]{0,20}0\/57/.test(mt), 'video count reported as it is (0/57) — nothing fake');
  ok(!/: חסר/.test(mt), 'no "חסר" labels on items that have written guidance');
  G = 'errors'; ok(!errs.length, 'no JS errors', errs);
  await b.close();
  let pass = 0, fail = 0; for (const r of res) { console.log(`${r.ok ? 'PASS' : 'FAIL'} [${r.g}] ${r.m}`); r.ok ? pass++ : fail++; }
  console.log(`\ncontent e2e: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
