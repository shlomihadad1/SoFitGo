/* TD-21 regression tests (Node, deterministic). The calorie/protein gap message must agree with the totals the user sees.
   §1 boundary: MealPlan.gapOf(totals, kcalTarget, proteinTarget) — just below / exactly at / just above the 93 % and 107 %
      lines, and the protein rule (short by more than 0.5 g). Fails on code that has no single gap rule (RC2).
   §2 consistency, fixed plan ids: Math.random and Date.now are seeded BEFORE the app code loads, so Plans.create always makes
      the same plan ids and the same menus (no dependence on chance). 12 cases (2,500–3,700 kcal × omnivore / vegetarian /
      vegan without soy and peanuts) × 20 plans × 90 days. For every day: the displayed planned totals (C.plannedTotals 'base')
      are outside ±7 % ⇔ the day carries a calorie gap, and protein short ⇔ protein gap. Silent misses and false alarms both fail.
   The thresholds (93 % / 107 %, 0.5 g) are NOT changed here — they are the existing rule; whether they are right is DR-21's
   professional question. Usage: node tools/td21_test.js [root]   (pass another copy's root to check it) */
const fs = require('fs'), path = require('path'); const ROOT = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, '..');
let seed = 20261019; Math.random = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
let clock = Date.UTC(2026, 9, 19, 6); Date.now = () => (clock += 1009);
for (const f of ['src/js/figure.js', 'src/data/exercises.js', 'src/data/workouts.js', 'src/data/nutrition.js', 'src/data/recipes_intl.js', 'src/data/catalog.js', 'src/data/programs.js', 'src/js/logic.js', 'src/js/planner.js', 'src/js/plans.js', 'src/js/mealplanner.js', 'src/js/store.js', 'src/js/core.js']) require(path.join(ROOT, f));
const { Store: S, Core: C, Plans: PS, MealPlan: MP } = globalThis; let NOW = '2026-10-19'; S.today = () => NOW;
let pass = 0, fail = 0; const fails = [], sec = {}; let cur = '';
const T = n => { cur = n; sec[n] = { pass: 0, fail: 0 }; }, ok = (c, m, info) => { if (c) { pass++; sec[cur].pass++; } else { fail++; sec[cur].fail++; if (fails.length < 40) fails.push(cur + ': ' + m + (info !== undefined ? ' → ' + JSON.stringify(info).slice(0, 300) : '')); } };

T('1 boundary of the gap rule');
if (typeof MP.gapOf !== 'function') ok(false, 'MealPlan.gapOf exists (one gap rule shared by generation and display)');
else {
  const g = (k, p, K, P) => MP.gapOf({ k, p }, K, P) || {};
  ok(g(2789, 200, 3000, 150).kLow === 211, '3,000 kcal: 2,789 (93.0 % − 1 kcal) → calorie gap of 211', g(2789, 200, 3000, 150));
  ok(!g(2790, 200, 3000, 150).kLow, '3,000 kcal: 2,790 (exactly 93.0 %) → no gap (rule is "below 93 %")', g(2790, 200, 3000, 150));
  ok(!g(2791, 200, 3000, 150).kLow, '3,000 kcal: 2,791 → no gap');
  ok(!g(3210, 200, 3000, 150).kHigh, '3,000 kcal: 3,210 (exactly 107.0 %) → no gap');
  ok(g(3211, 200, 3000, 150).kHigh === 211, '3,000 kcal: 3,211 → over-target gap of 211', g(3211, 200, 3000, 150));
  ok(g(2324, 200, 2500, 150).kLow === 176 && !g(2325, 200, 2500, 150).kLow, '2,500 kcal: 2,324 flagged, 2,325 (93.0 %) not');
  ok(g(3440, 200, 3700, 150).kLow === 260 && !g(3441, 200, 3700, 150).kLow, '3,700 kcal: 3,440 flagged, 3,441 (93.0 %) not');
  ok(g(3000, 149.4, 3000, 150).p === 1 && !g(3000, 149.5, 3000, 150).p, 'protein: 149.4 of 150 → gap; 149.5 (short by exactly 0.5 g) → no gap');
  ok(MP.gapOf({ k: 3000, p: 150 }, 3000, 150) === null, 'a day on target has no gap object');
}

T('2 displayed totals and gap agree — fixed plan ids');
{ const setUser = (K, pf) => { S.resetAll(); const p = S.load('profile');
    Object.assign(p, { age: 30, height: 178, weight: 80, startWeight: 80, sex: 'm', experience: 'intermediate', startDate: NOW });
    p.aims = { primary: 'muscle', secondary: [] }; p.availability = { days: [0, 1, 3, 5], sessions: 4, maxMin: 45, prefMin: null }; p.environment = { place: 'home', equipment: [], custom: [] };
    p.exercisePrefs = { fav: [], exclude: [], noJump: false }; p.prefs = C.normPrefs(pf); p.targets = { kcal: K, protein: Math.round(K * 0.055 / 5) * 5 }; S.save('profile'); };
  const ids = [];
  for (const K of [2500, 3000, 3500, 3700]) for (const [lbl, pf] of [['omnivore', {}], ['vegetarian', { veg: true }], ['vegan, no soy/peanuts', { vegan: true, exclude: ['soya', 'peanuts'] }]]) {
    let days = 0, silentK = 0, falseK = 0, silentP = 0, falseP = 0; const ex = [];
    for (let i = 0; i < 20; i++) { setUser(K, pf); const pl = PS.activate(PS.create('general_90', PS.paramsFromProfile(S.load('profile')), NOW), { confirmReplace: true }); ids.push(pl.id);
      const t = C.targets();
      PS.days(PS.get(pl.id)).forEach(d => { days++; const p = C.plan(d.date), shown = C.plannedTotals(d.date, 'base'), gp = p.gap || {};
        const outK = shown.k < t.kcal * 0.93 || shown.k > t.kcal * 1.07, flagK = !!(gp.kLow || gp.kHigh), shortP = shown.p < t.protein - 0.5, flagP = !!gp.p;
        if (outK && !flagK) { silentK++; if (ex.length < 3) ex.push({ plan: pl.id, date: d.date, shown: shown.k, target: t.kcal, gap: p.gap }); }
        if (!outK && flagK) { falseK++; if (ex.length < 3) ex.push({ plan: pl.id, date: d.date, shown: shown.k, target: t.kcal, gap: p.gap, kind: 'false alarm' }); }
        if (shortP && !flagP) silentP++; if (!shortP && flagP) falseP++; }); }
    ok(silentK === 0 && falseK === 0, `${K} kcal ${lbl}: calorie gap shown ⇔ displayed total outside ±7 % (${days} days: ${silentK} silent, ${falseK} false alarms)`, ex);
    ok(silentP === 0 && falseP === 0, `${K} kcal ${lbl}: protein gap shown ⇔ displayed protein short by > 0.5 g (${silentP} silent, ${falseP} false alarms)`); }
  ok(new Set(ids).size === ids.length && ids[0] === 'p' + (Date.UTC(2026, 9, 19, 6) + 1009).toString(36) + ids[0].slice(-4), 'plan ids are reproducible (seeded clock and random) and unique', ids.slice(0, 2)); }

console.log(fails.length ? 'FAILURES:\n - ' + fails.join('\n - ') : ''); console.log(JSON.stringify(sec)); console.log(`td21 tests: pass ${pass} fail ${fail}`);
if (!process.argv[2]) { fs.mkdirSync(path.join(ROOT, 'dist/reports'), { recursive: true }); fs.writeFileSync(path.join(ROOT, 'dist/reports/td21-test.json'), JSON.stringify({ pass, fail, sections: sec, fails }, null, 1)); }
process.exit(fail ? 1 : 0);
