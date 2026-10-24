/* P0 menu structure: the daily menu is shown as real meals (ארוחת בוקר / ארוחת צהריים / ארוחת ערב קלה), each a full dish with
   ingredients+amounts, preparation steps, kcal and protein. The protein add-on is never a meal of its own: it is not shown and not
   counted until the user adds it, it is offered only as an optional recommendation when protein is short, it never repeats a protein
   food the day already contains, and once added it is counted exactly once. Swapping keeps the day consistent. Cuisine choice still
   changes the dishes. Usage: [BROWSER=webkit] node tools/e2e_menu_structure.js [URL] [screenshot.png] */
const pw = require('playwright'), { devices } = pw; const ENGINE = process.env.BROWSER || 'chromium';
const URL0 = process.argv[2] || 'http://localhost:8096/', SHOT = process.argv[3] || '';
const res = []; let G = ''; const ok = (c, m, i) => res.push({ g: G, ok: !!c, m: m + (i !== undefined && !c ? ' → ' + JSON.stringify(i).slice(0, 700) : '') });
(async () => {
  const b = await pw[ENGINE].launch(); console.log('engine: ' + ENGINE); const errs = [];
  const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'he-IL', serviceWorkers: 'block' }); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL0); await p.waitForTimeout(700);
  const reset = async prefs => { await p.evaluate(pf => { Store.resetAll(); localStorage.clear(); const pr = Store.load('profile'); Object.assign(pr, { age: 34, height: 176, weight: 80, startWeight: 80, sex: 'm' }); if (pf) pr.prefs = Object.assign(pr.prefs || {}, pf); Store.save('profile'); }, prefs || null); await p.reload(); await p.waitForTimeout(800); };
  const go = async h => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(250); };
  await reset();
  const today = await p.evaluate(() => Store.today());

  G = 'model (30 days × 3 cuisine settings)';
  for (const pf of [null, { cuisines: ['international'] }, { cuisines: ['indian'] }]) {
    await reset(pf);
    const r = await p.evaluate(() => { const bad = [], rep = [], tot = []; const t = Store.today();
      for (let i = 0; i < 30; i++) { const d = Store.addDays(t, i), pl = Core.plan(d);
        Core.ALL.forEach(k => { const s = pl[k]; if (s && s.rid && !s.off && Logic.recipe(s.rid).meal !== Core.mealOf(k)) bad.push([d, k, s.rid]); });
        if (pl.extra.rid && Core.extraRepeats(Logic.recipe(pl.extra.rid), pl)) rep.push([d, pl.extra.rid]);
        const sum = Logic.roundM(Logic.sumMacros(Core.DAY.filter(k => pl[k].rid && !pl[k].off && !pl[k].missing).map(k => Core.slotMacros(pl[k])))), pt = Core.plannedTotals(d);
        if (pl.extra.on || ['k', 'p', 'c', 'f', 'fb'].some(x => Math.abs(sum[x] - pt[x]) > 0.05)) tot.push([d, sum, pt]); }
      return { bad, rep, tot }; });
    const lbl = pf ? pf.cuisines[0] : 'default';
    ok(!r.bad.length, `[${lbl}] every meal holds a dish of its own meal type (no snack as lunch)`, r.bad);
    ok(!r.rep.length, `[${lbl}] the suggested protein add-on never repeats a protein food already in the day`, r.rep);
    ok(!r.tot.length, `[${lbl}] add-on is off by default and the planned total = breakfast + lunch + dinner exactly`, r.tot);
  }

  G = 'targets (nutrition engine)';
  for (const [lbl, pf] of [['m80', { sex: 'm', weight: 80, height: 176, age: 34 }], ['f60', { sex: 'f', weight: 60, height: 163, age: 30 }], ['f75', { sex: 'f', weight: 75, height: 165, age: 45 }], ['m100', { sex: 'm', weight: 100, height: 182, age: 40 }]]) {
    const r = await p.evaluate(pf => { Store.resetAll(); localStorage.clear(); const pr = Store.load('profile'); Object.assign(pr, pf, { startWeight: pf.weight }); Store.save('profile');
      const t = Core.targets(), T = Store.today(); let inT = 0, gapShown = 0, bad = [], dup = 0;
      for (let i = 0; i < 30; i++) { const d = Store.addDays(T, i), pl = Core.plan(d), x = Core.plannedTotals(d, 'base'), okK = x.k >= t.kcal * 0.93 && x.k <= t.kcal * 1.07, okP = x.p >= t.protein - 0.5;
        if (pl.source !== 'auto') bad.push([d, 'source ' + pl.source]); { const sm = Logic.roundM(Logic.sumMacros(Core.DAY.filter(k => pl[k].rid && !pl[k].off).map(k => Logic.recipeMacros(Logic.recipe(pl[k].rid), pl[k].scale || 1, pl[k].ov)))); if (['k', 'p', 'c', 'f'].some(q => Math.abs(sm[q] - x[q]) > 0.05)) bad.push([d, 'sum', sm, x]); if (Math.abs(x.k - (x.p * 4 + x.c * 4 + x.f * 9)) > x.k * 0.12) bad.push([d, 'atwater', x]); } if (okK && okP) inT++; else if (pl.gap) gapShown++; else bad.push([d, x.k, x.p]);
        const ids = Core.DAY.filter(k => !pl[k].off).map(k => pl[k].rid).filter(Boolean); if (new Set(ids).size !== ids.length) dup++; }
      return { kcal: t.kcal, protein: t.protein, inT, gapShown, bad, dup }; }, pf);
    ok(!r.bad.length && r.inT + r.gapShown === 30 && r.inT >= 23, `[${lbl}] default menu built from the user's targets (${r.kcal} kcal / ${r.protein} g): ${r.inT}/30 days within ±7% kcal and protein met; the rest show the real gap (${r.gapShown})`, r);
    ok(!r.dup, `[${lbl}] no dish repeated within a day`, r.dup);
  }
  { const r = await p.evaluate(() => { const pr = Store.load('profile'); pr.prefs = Object.assign(pr.prefs || {}, { meals: 2 }); Store.save('profile'); const pl = Core.plan(Store.today()); return { off: !!pl.m3.off, n: ['m1', 'm2', 'm3'].filter(k => pl[k].rid && !pl[k].off).length }; });
    ok(r.off && r.n === 2, 'the number of main meals follows the user setting (2 → breakfast + lunch, no dinner slot; snacks only when needed)', r); }
  { const r = await p.evaluate(() => { const T = Store.today(), y = Store.addDays(T, -1), nu = Store.load('nutrition'); nu.autoSince = Store.addDays(T, -5); Store.save('nutrition');
      const days = [-3, -1, 0, 1, 5].map(i => Store.addDays(T, i)), before = days.map(d => JSON.stringify(Core.DAY.map(k => [Core.plan(d)[k].rid, Core.plan(d)[k].ov])));
      const pr = Store.load('profile'); pr.weight = 62; pr.startWeight = 62; Store.save('profile');
      const after = days.map(d => JSON.stringify(Core.DAY.map(k => [Core.plan(d)[k].rid, Core.plan(d)[k].ov]))), kc = days.map(d => Core.plannedTotals(d, 'base').k);
      return { pastSame: before[0] === after[0] && before[1] === after[1], futureChanged: before[2] !== after[2] && before[3] !== after[3], src: Core.plan(y).source, seg: (Store.load('nutrition').autoSeg || []).length, kc, t: Core.targets().kcal }; });
    ok(r.pastSame && r.src === 'auto', 'past days keep the menu they were shown with after the targets change', r);
    ok(r.futureChanged && r.seg === 2, 'today and later days are rebuilt for the new targets', r); }
  await reset();
  G = 'screen structure';
  await reset(); await go('#/nutrition'); await p.waitForTimeout(500);
  const scr = await p.evaluate(() => { const box = document.querySelector('[data-day-meals]'), cards = [...box.querySelectorAll('.slot')], pl = Core.plan(Store.today()), PRS = Core.DAY.filter(k => pl[k].rid && !pl[k].off);
    return { names: cards.map(c => c.querySelector('.eyebrow').innerText.trim()), txt: document.getElementById('view').innerText,
      want: PRS.map(k => Core.slotNames[k]), cards: cards.map((c, i) => { const k = PRS[i], s = pl[k], r = Logic.recipe(s.rid), m = Core.slotMacros(s), t = c.innerText;
        return { k, h: c.querySelector('h3').innerText, he: r.he, ing: c.querySelectorAll('[data-meal-detail] .ing, [data-meal-detail] > div > *').length, steps: c.querySelectorAll('[data-meal-steps] li').length, want: r.steps.length, kcal: t.includes(m.k + ' קק״ל'), prot: t.includes('חלבון ' + m.p) }; }),
      extraCard: !!document.querySelector('[data-act=extraOn]'), extraEyebrow: cards.some(c => /נשנוש חלבון|תוספת/.test(c.querySelector('.eyebrow').innerText)) }; });
  ok(JSON.stringify(scr.names) === JSON.stringify(scr.want) && scr.names[0] === 'ארוחת בוקר' && scr.names.includes('ארוחת צהריים') && scr.names.includes('ארוחת ערב') && scr.names.indexOf('ארוחת צהריים') < scr.names.indexOf('ארוחת ערב'), 'the day in order: ארוחת בוקר → (ביניים) → ארוחת צהריים → (ביניים) → ארוחת ערב', scr.names);
  ok(!/ארוחה ראשונה|ארוחה שנייה/.test(scr.txt), 'no "ארוחה ראשונה / ארוחה שנייה" anywhere on the screen');
  ok(!scr.extraCard && !scr.extraEyebrow, 'no protein add-on card / mandatory add-on in the day before the user adds one');
  ok(scr.cards.every(c => c.h === c.he && c.ing >= 2 && c.steps === c.want && c.want >= 2 && c.kcal && c.prot), 'each meal is a full dish: name, ingredients with amounts, all preparation steps, kcal and protein', scr.cards);

  G = 'add-on: optional, counted once';
  ok(!(await p.locator('[data-protein-suggest]').count()) || await p.evaluate(() => Core.plannedTotals(Store.today()).p < Core.targets().protein), 'no add-on recommendation while the protein target is met');
  await p.evaluate(() => { const pr = Store.load('profile'); pr.targets = { protein: 320 }; Store.save('profile'); }); await p.reload(); await p.waitForTimeout(800); await go('#/nutrition'); await p.waitForTimeout(400); /* a manual protein target beyond realistic portions → a real protein gap */
  const N0 = await p.locator('[data-day-meals] .slot').count();
  const t0 = await p.evaluate(() => ({ pt: Core.plannedTotals(Store.today()), tgt: Core.targets().protein, sug: !!document.querySelector('[data-protein-suggest]'), btns: [...document.querySelectorAll('[data-act=pickExtra]')].map(x => x.dataset.id) }));
  if (t0.pt.p < t0.tgt) {
    ok(t0.sug && t0.btns.length > 0, 'protein below target → an optional recommendation is offered', t0);
    const rep = await p.evaluate(ids => { const pl = Core.plan(Store.today()); return ids.filter(id => Core.extraRepeats(Logic.recipe(id), pl)); }, t0.btns);
    ok(!rep.length, 'recommended add-ons do not repeat a protein food of the day', rep);
    await p.locator(`[data-act=pickExtra][data-id="${t0.btns[0]}"]`).click(); await p.waitForTimeout(300);
    const t1 = await p.evaluate(id => { const d = Store.today(), pl = Core.plan(d), ex = Core.slotMacros(pl.extra), pt = Core.plannedTotals(d), base = Core.plannedTotals(d, 'base');
      return { on: pl.extra.on, rid: pl.extra.rid, id, ex, pt, base, cards: document.querySelectorAll('[data-day-meals] .slot').length, extraCards: [...document.querySelectorAll('[data-day-meals] .slot .eyebrow')].filter(e => /נשנוש חלבון/.test(e.innerText)).length }; }, t0.btns[0]);
    ok(t1.on && t1.rid === t1.id && t1.cards === N0 + 1 && t1.extraCards === 1, 'after adding: shown once in the day', t1);
    ok(Math.abs(t1.pt.k - (t1.base.k + t1.ex.k)) <= 1 && Math.abs(t1.pt.p - (t1.base.p + t1.ex.p)) <= 1, 'after adding: counted exactly once in the planned total', t1);
    await p.locator('[data-act=extraOff]').click(); await p.waitForTimeout(300);
    const t2 = await p.evaluate(() => { const d = Store.today(); return { pt: Core.plannedTotals(d), base: Core.plannedTotals(d, 'base'), cards: document.querySelectorAll('[data-day-meals] .slot').length }; });
    ok(t2.pt.k === t2.base.k && t2.pt.p === t2.base.p && t2.cards === N0, 'after removing: not counted and not shown', t2);
  } else ok(!t0.sug, 'protein target met → no add-on recommendation shown', t0);

  G = 'swap';
  const sw = await p.evaluate(() => { const d = Store.today(), pl = Core.plan(d), cur = Logic.recipe(pl.m2.rid), c = Logic.swapCandidates(cur, NUTRI.RECIPES).filter(o => !Core.conflicts(o.r, null).length && !o.r.est)[0];
    Core.setPlanSlot(d, 'm2', { rid: c.r.id, ov: null, scale: 1, auto: false }); const p2 = Core.plan(d), sum = Logic.roundM(Logic.sumMacros(Core.DAY.filter(k => p2[k].rid && !p2[k].off).map(k => Core.slotMacros(p2[k])))), pt = Core.plannedTotals(d);
    const allSame = Logic.swapCandidates(cur, NUTRI.RECIPES).every(o => o.r.meal === 'm2');
    return { to: c.r.id, now: p2.m2.rid, sum, pt, extraOn: p2.extra.on, allSame, ids: Core.DAY.filter(k => p2[k].rid && !p2[k].off).map(k => p2[k].rid) }; });
  ok(sw.allSame, '"החלף מנה" offers only dishes of the same meal (lunch → lunch dishes)');
  ok(sw.now === sw.to && sw.sum.k === sw.pt.k && sw.sum.p === sw.pt.p && !sw.extraOn, 'after a swap the day summary = sum of the three meals; no orphan add-on is switched on', sw);
  ok(new Set(sw.ids).size === sw.ids.length, 'no dish repeated in the day after the swap', sw.ids);
  await p.evaluate(() => App.render()); await p.waitForTimeout(300);
  const sumRow = await p.evaluate(() => { const g = [...document.querySelectorAll('.macro-grid span')], i = g.findIndex(x => x.innerText.trim() === 'סה״כ מתוכנן'); return { k: +g[i + 1].innerText, p: +g[i + 2].innerText, pt: Core.plannedTotals(Store.today()) }; });
  ok(sumRow.k === sumRow.pt.k && sumRow.p === Math.round(sumRow.pt.p), 'the summary row on screen shows the same planned total', sumRow);

  G = 'legacy data';
  const lg = await p.evaluate(() => { const d = Store.addDays(Store.today(), 1), nu = Store.load('nutrition'); nu.plan[d] = { m2: { rid: 'cottage_strawberries', ov: null, scale: 1 }, extra: { rid: 'x_cottage', on: false } }; Store.save('nutrition'); const pl = Core.plan(d); return { m2: pl.m2.rid, meal: Logic.recipe(pl.m2.rid).meal, on: pl.extra.on, k: Core.plannedTotals(d).k, base: Core.plannedTotals(d, 'base').k }; });
  ok(lg.m2 !== 'cottage_strawberries' && lg.meal === 'm2', 'a snack stored as lunch by an older build is not shown as lunch', lg);
  ok(!lg.on && lg.k === lg.base, 'an add-on that was never added is not counted', lg);
  await go('#/recipe/cottage_strawberries'); await p.waitForTimeout(400);
  const btn = p.locator('[data-act=toPlan]'); if (await btn.count()) { await btn.first().click(); await p.waitForTimeout(250);
    const opts = await p.evaluate(() => [...document.querySelectorAll('#tp-s option')].map(o => o.value)); ok(JSON.stringify(opts) === '["snack","snack2"]', '"הוספה לתפריט" offers only meals of the dish\'s own type (a snack → the snack slots)', opts);
    await p.keyboard.press('Escape'); await p.waitForTimeout(200); }

  G = 'cuisine still applies';
  await reset({ cuisines: ['indian'] }); const ind = await p.evaluate(() => { const t = Store.today(); let n = 0; for (let i = 0; i < 7; i++) { const pl = Core.plan(Store.addDays(t, i)); ['m1', 'm2'].forEach(k => { if (Core.cuisineOf(Logic.recipe(pl[k].rid)) === 'indian') n++; }); } return n; });
  await reset(); const def = await p.evaluate(() => { const t = Store.today(); let n = 0; for (let i = 0; i < 7; i++) { const pl = Core.plan(Store.addDays(t, i)); ['m1', 'm2'].forEach(k => { if (Core.cuisineOf(Logic.recipe(pl[k].rid)) === 'indian') n++; }); } return n; });
  ok(ind >= 10 && def === 0, 'cuisine choice still decides the dishes (Indian chosen → Indian meals; default → none)', { ind, def });

  if (SHOT) { await go('#/plan'); await go('#/nutrition'); await p.waitForTimeout(500); const el = p.locator('[data-day-meals]'); await el.screenshot({ path: SHOT.replace('.png', '-day.png') }); }
  if (SHOT) { await go('#/nutrition'); await p.waitForTimeout(500); await p.evaluate(() => { const c = document.querySelector('[data-day-meals]'); c.querySelectorAll('[data-meal-detail]')[0].open = true; c.scrollIntoView(); }); await p.waitForTimeout(200); await p.screenshot({ path: SHOT, fullPage: false }); }
  G = 'errors'; ok(!errs.length, 'no JS errors', errs);
  await b.close();
  let pass = 0, fail = 0; for (const r of res) { console.log(`${r.ok ? 'PASS' : 'FAIL'} [${r.g}] ${r.m}`); r.ok ? pass++ : fail++; }
  console.log(`\nmenu structure tests: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
