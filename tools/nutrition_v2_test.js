/* Nutrition DB v2 — quality tests (Node, simulated clock). Expected values are recomputed independently from the food table.
   1 recipe data completeness · 2 realistic single servings (portion sanity) · 3 value consistency (Atwater, sums)
   4 menu engine: 4 profiles × 30 days vs targets (kcal, protein, fat, carbs), dish size limits, no repeats, meal types, totals
   5 preferences: default cuisine, explicit cuisine, allergies/restrictions · 6 swap keeps the day consistent.
   Writes dist/reports/nutrition-v2-test.json (incl. the 4-profile table). Usage: node tools/nutrition_v2_test.js */
const fs = require('fs'), path = require('path'); const ROOT = path.join(__dirname, '..');
for (const f of ['src/js/figure.js', 'src/data/exercises.js', 'src/data/workouts.js', 'src/data/nutrition.js', 'src/data/recipes_intl.js', 'src/data/recipes_med.js', 'src/data/catalog.js', 'src/data/programs.js', 'src/js/logic.js', 'src/js/planner.js', 'src/js/plans.js', 'src/js/mealplanner.js', 'src/js/store.js', 'src/js/core.js', 'src/js/insights.js', 'src/js/adapt.js', 'src/js/signature.js']) require(path.join(ROOT, f));
const { Store: S, Core: C, MealPlan: MP, Logic: L, NUTRI: N, CATALOG: CT } = globalThis; const F = N.FOODS;
let pass = 0, fail = 0; const fails = [], sec = {}; let cur = '';
const T = n => { cur = n; sec[n] = { pass: 0, fail: 0 }; }, ok = (c, m, info) => { if (c) { pass++; sec[cur].pass++; } else { fail++; sec[cur].fail++; if (fails.length < 80) fails.push(cur + ': ' + m + (info !== undefined ? ' → ' + JSON.stringify(info).slice(0, 400) : '')); } };
let NOW = '2026-10-19'; S.today = () => NOW;
const V2 = N.RECIPES.filter(r => r.v2);
const indep = ings => ings.reduce((s, x) => { const f = F[x.f]; return { k: s.k + f.k * x.g / 100, p: s.p + f.p * x.g / 100, c: s.c + f.c * x.g / 100, f: s.f + f.f * x.g / 100, fb: s.fb + f.fb * x.g / 100 }; }, { k: 0, p: 0, c: 0, f: 0, fb: 0 });
const KC = { m1: [250, 650], m2: [350, 750], snack: [100, 350] }, PMIN = { m1: 15, m2: 20, snack: 0 };
/* sensible single-serving maxima by food (g); based on BDA portion sizes with headroom for one generous serving */
const MAXG = f => { const x = F[f]; if (['chicken_breast', 'chicken_thigh', 'chicken_mince', 'turkey', 'beef_lean'].includes(f)) return 160; if (['salmon', 'white_fish'].includes(f)) return 180; if (['tuna_can', 'sardines'].includes(f)) return 110;
  if (x.grp === 'fat') return ['olive_oil', 'oil'].includes(f) ? 12 : f === 'avocado' ? 60 : f === 'olives' ? 30 : 30; if (x.grp === 'carb' && x.st === 'dry') return 90; if (f === 'tortilla') return 128; if (['bread', 'pita_ww'].includes(f)) return 60;
  if (['potato', 'sweet_potato'].includes(f)) return 300; if (x.grp === 'legume' && x.st === 'dry') return 90; if (x.grp === 'legume') return 200; if (f === 'egg') return 150; if (['milk', 'soy_milk'].includes(f)) return 300; if (x.grp === 'dairy') return 200; return 300; };

T('1 recipe data completeness');
ok(V2.length >= 200, `≥200 recipes in the v2 library (${V2.length})`);
ok(new Set(N.RECIPES.map(r => r.id)).size === N.RECIPES.length, 'recipe ids unique');
const counts = {}; V2.forEach(r => { counts[r.meal] = (counts[r.meal] || 0) + 1; });
ok(counts.m1 >= 40 && counts.m2 >= 90 && counts.snack >= 40, 'categories: ≥40 breakfasts, ≥90 main meals (lunch/dinner), ≥40 snacks', counts);
const missing = V2.filter(r => !(r.he && r.en && r.ing.length >= 1 && r.steps.length >= 2 && typeof r.prep === 'number' && typeof r.cook === 'number' && r.servings === 1 && (r.subs || []).length >= 1 && (r.equip || []).length >= 1 && r.desc && CT.CUISINE_HE[r.cuisine])).map(r => r.id);
ok(!missing.length, 'every recipe: Hebrew+English name, ingredients, ≥2 numbered steps, prep & cook times, 1 serving, ingredient swaps, equipment, description, known cuisine', missing);
ok(V2.every(r => r.ing.every(x => F[x.f] && x.g > 0 && ['raw', 'dry', 'ready'].includes(F[x.f].st))), 'every ingredient exists with grams > 0 and a stated weight state (raw / dry / ready)');
ok(V2.every(r => new Set(r.ing.map(x => x.f)).size === r.ing.length), 'no ingredient listed twice in a recipe (no double count)');
ok(V2.every(r => Array.isArray(CT.recipeFacts(r).allergens)), 'allergens derived for every recipe');
const tagged = k => V2.filter(r => r.tags.includes(k)).length;
ok(tagged('high_protein') >= 60 && tagged('vegan') >= 30 && tagged('veg_base') >= 60 && tagged('quick') >= 40 && tagged('cheap') >= 40 && tagged('mealprep') >= 30, 'tags: high-protein, vegan, vegetarian, quick, budget and meal-prep groups are all populated',
  { hp: tagged('high_protein'), vegan: tagged('vegan'), veg: tagged('veg_base'), quick: tagged('quick'), cheap: tagged('cheap'), prep: tagged('mealprep') });
ok(V2.filter(r => r.tags.includes('vegan')).every(r => CT.recipeFacts(r).diet.vegan), 'vegan tag agrees with the ingredients');
ok(V2.filter(r => r.tags.includes('quick')).every(r => r.prep + r.cook <= 15), 'quick = ≤15 minutes');

T('2 realistic single servings');
const outR = V2.filter(r => { const m = indep(r.ing); return m.k < KC[r.meal][0] || m.k > KC[r.meal][1] || m.p < PMIN[r.meal]; }).map(r => [r.id, r.meal, Math.round(indep(r.ing).k), Math.round(indep(r.ing).p)]);
ok(!outR.length, 'kcal per serving: breakfast 250–650, main 350–750, snack 100–350; protein ≥15 g breakfast, ≥20 g main', outR);
const big = []; V2.forEach(r => r.ing.forEach(x => { if (x.g > MAXG(x.f)) big.push(`${r.id}:${x.f}:${x.g}`); }));
ok(!big.length, 'no ingredient above an ordinary single-serving amount (e.g. meat ≤160 g raw, oil ≤12 g, dry grains ≤90 g, nuts ≤30 g)', big);
ok(V2.every(r => !/(\d+)\s*ג׳/.test(r.steps.join(' '))), 'steps refer to the ingredient list instead of quoting grams');

T('3 value consistency');
const newFoods = Object.entries(F).filter(([, f]) => f.v2);
ok(newFoods.every(([, f]) => Math.abs(f.k - (4 * f.p + 4 * f.c + 9 * f.f)) <= f.k * (['veg', 'fruit'].includes(f.grp) ? 0.2 : 0.1)), 'new foods: kcal agrees with 4/4/9 (≤10%; fruit/veg ≤20% — USDA uses food-specific factors)', newFoods.map(([k, f]) => [k, f.k, Math.round(4 * f.p + 4 * f.c + 9 * f.f)]));
ok(newFoods.every(([, f]) => f.chk === 'x' && /USDA SR Legacy (FDC|NDB) \d+/.test(f.src || '')), 'new foods: verified against a USDA SR Legacy record, id stated (chk x + src)');
const incons = V2.filter(r => { const a = L.recipeMacros(r), b = indep(r.ing); return Math.abs(a.k - b.k) > 1 || Math.abs(a.p - b.p) > 0.15 || Math.abs(a.c - b.c) > 0.15 || Math.abs(a.f - b.f) > 0.15; }).map(r => r.id);
ok(!incons.length, 'recipe values = sum of ingredient values (calculated, not typed in)', incons);
const atw = V2.filter(r => { const b = indep(r.ing); return Math.abs(b.k - (4 * b.p + 4 * b.c + 9 * b.f)) > b.k * 0.12; }).map(r => r.id);
ok(!atw.length, 'every recipe: kcal within 12% of 4×protein + 4×carbs + 9×fat', atw);

/* ── engine ── */
function user(o) { S.resetAll(); NOW = '2026-10-19'; const p = S.load('profile'); Object.assign(p, { age: o.age, height: o.height, weight: o.weight, startWeight: o.weight, sex: o.sex, startDate: NOW }); p.prefs = C.normPrefs(o.prefs || {}); S.save('profile'); return C.targets(); }
const PROFILES = [['גבר 80 ק״ג', { sex: 'm', weight: 80, height: 176, age: 34 }], ['אישה 60 ק״ג', { sex: 'f', weight: 60, height: 163, age: 30 }], ['אישה 75 ק״ג', { sex: 'f', weight: 75, height: 165, age: 45 }], ['גבר 100 ק״ג', { sex: 'm', weight: 100, height: 182, age: 40 }]];
const table = [];
T('4 menu engine — 4 profiles × 30 days');
for (const [lbl, pf] of PROFILES) {
  const t = user(pf); const A = { k: [], p: [], f: [], c: [] }; let inK = 0, inP = 0, inF = 0, inC = 0, gapShown = 0, silent = 0, dup = 0, wrongMeal = 0, sumBad = 0, oversize = [], indian = 0, extraCounted = 0, mainsBad = 0; const reasons = [];
  for (let i = 0; i < 30; i++) {
    const d = S.addDays(NOW, i), pl = C.plan(d), ks = C.DAY.filter(k => pl[k].rid && !pl[k].off), x = C.plannedTotals(d, 'base');
    const sm = indep(ks.flatMap(k => L.recipeIngredients(L.recipe(pl[k].rid), pl[k].ov).map(y => Object.assign({}, y, { g: y.g * (pl[k].scale || 1) }))));
    if (Math.abs(sm.k - x.k) > 0.5 * ks.length + 0.5 || Math.abs(sm.p - x.p) > 0.3) sumBad++;
    if (Math.abs(C.plannedTotals(d, 'selected').k - x.k) > 0.5) extraCounted++;
    const ids = ks.map(k => pl[k].rid); if (new Set(ids).size !== ids.length) dup++;
    ks.forEach(k => { const r = L.recipe(pl[k].rid); if (r.meal !== C.mealOf(k)) wrongMeal++; if (['indian', 'himachali'].includes(C.cuisineOf(r))) indian++;
      const base = L.recipeMacros(r).k, now = C.slotMacros(pl[k]).k, hi = Math.min(1.6, Math.max(1.35, t.kcal / 2000 * 1.15)) + 0.12; if (now > base * hi || now > 1100) oversize.push(`${d}:${k}:${r.id}:${base}→${now}`); });
    if (['m1', 'm2', 'm3'].some(k => !pl[k].rid || pl[k].off)) mainsBad++;
    A.k.push(x.k); A.p.push(x.p); A.f.push(x.f); A.c.push(x.c);
    const okK = x.k >= t.kcal * 0.93 && x.k <= t.kcal * 1.07, okP = x.p >= t.protein - 0.5;
    if (okK) inK++; if (okP) inP++; if (Math.abs(x.f - t.fat) <= t.fat * 0.15) inF++; if (Math.abs(x.c - t.carbs) <= t.carbs * 0.15) inC++;
    if (pl.gap) gapShown++; if ((!okK || !okP) && !pl.gap) silent++;
    if (!okK || !okP) reasons.push({ d, k: x.k, p: Math.round(x.p), gap: pl.gap });
  }
  const mm = a => [Math.round(Math.min(...a)), Math.round(a.reduce((s, v) => s + v, 0) / a.length), Math.round(Math.max(...a))];
  table.push({ profile: lbl, target: { kcal: t.kcal, protein: t.protein, fat: t.fat, carbs: t.carbs }, kcal: mm(A.k), protein: mm(A.p), fat: mm(A.f), carbs: mm(A.c), daysKcal7: inK, daysProtein: inP, daysFat15: inF, daysCarbs15: inC, daysGapShown: gapShown, missed: reasons });
  ok(mainsBad === 0, `[${lbl}] 3 main meals every day (user setting = 3)`);
  ok(sumBad === 0, `[${lbl}] day totals = independent sum of the dishes as planned`);
  ok(extraCounted === 0, `[${lbl}] optional add-on not counted until added`);
  ok(dup === 0 && wrongMeal === 0, `[${lbl}] no dish twice in a day; every dish is of its meal's type (no snack as a main meal)`, { dup, wrongMeal });
  ok(!oversize.length, `[${lbl}] no oversized dish (≤ the energy-scaled limit ×1.35–1.6 of the recipe's own serving, +rounding, and ≤1,100 kcal)`, oversize.slice(0, 5));
  ok(indian === 0, `[${lbl}] default menu has no Indian dishes`);
  ok(silent === 0, `[${lbl}] every day that misses kcal (±7%) or protein shows the gap`, reasons);
  ok(inK >= 25 && inP >= 28, `[${lbl}] kcal within ±7% on ≥25/30 days (${inK}) and protein met on ≥28/30 (${inP})`);
  ok(inF >= 15 && inC >= 15, `[${lbl}] fat (${inF}) and carbs (${inC}) within ±15% on ≥15/30 days`);
}
T('4b meals per day follow the user setting');
{ user({ sex: 'm', weight: 80, height: 176, age: 34, prefs: { meals: 2 } }); let bad = 0; for (let i = 0; i < 14; i++) { const pl = C.plan(S.addDays(NOW, i)); if (!pl.m3.off || !pl.m1.rid || !pl.m2.rid) bad++; }
  ok(bad === 0, '2 meals set → breakfast + lunch, no dinner slot (snacks only if needed)'); }

T('5 preferences, cuisines, allergies');
{ user({ sex: 'm', weight: 80, height: 176, age: 34, prefs: { cuisines: ['indian'] } }); let ind = 0, n = 0; for (let i = 0; i < 14; i++) { const pl = C.plan(S.addDays(NOW, i)); C.DAY.filter(k => pl[k].rid && !pl[k].off).forEach(k => { n++; if (['indian', 'himachali'].includes(C.cuisineOf(L.recipe(pl[k].rid)))) ind++; }); }
  ok(ind >= n * 0.6, `explicit Indian cuisine → mostly Indian dishes (${ind}/${n})`); }
{ user({ sex: 'm', weight: 80, height: 176, age: 34, prefs: { cuisines: ['italian'] } }); const pl = C.plan(NOW); ok(['m2', 'm3'].some(k => ['italian', 'mediterranean', 'greek', 'middle_eastern'].includes(C.cuisineOf(L.recipe(pl[k].rid)))), 'explicit Mediterranean-family choice changes the main dishes'); }
for (const [lbl, prefs] of [['no fish', { fish: false }], ['vegan', { vegan: true }], ['gluten-free', { glutenFree: true }], ['no dairy, no egg', { dairy: false, egg: false }], ['nut allergy', { exclude: ['almonds', 'walnuts', 'peanuts'] }]]) {
  user({ sex: 'f', weight: 65, height: 165, age: 35, prefs }); const bl = C.blockedFoods(); let bad = 0, empty = 0;
  for (let i = 0; i < 21; i++) { const pl = C.plan(S.addDays(NOW, i)); C.ALL.forEach(k => { const s = pl[k]; if (!s.rid || s.off) { if (s.missing) empty++; return; } if (L.recipeIngredients(L.recipe(s.rid), s.ov).some(x => bl.has(x.f))) bad++; }); }
  ok(bad === 0, `${lbl}: no planned dish contains a restricted food (21 days)`); ok(empty === 0, `${lbl}: every meal still has a dish`, empty);
}

T('6 swap keeps the day consistent');
{ user({ sex: 'm', weight: 80, height: 176, age: 34 }); const d = S.addDays(NOW, 1), pl = C.plan(d), cur0 = L.recipe(pl.m3.rid);
  const alt = L.swapCandidates(cur0, N.RECIPES).filter(o => o.r.v2 && !C.conflicts(o.r, null).length && !C.DAY.some(k => pl[k].rid === o.r.id))[0];
  ok(alt && alt.r.meal === 'm2', 'dinner swap offers main dishes');
  C.setPlanSlot(d, 'm3', { rid: alt.r.id, ov: null, scale: 1, auto: false }); const p2 = C.plan(d), ks = C.DAY.filter(k => p2[k].rid && !p2[k].off);
  const sum = L.roundM(L.sumMacros(ks.map(k => C.slotMacros(p2[k])))), pt = C.plannedTotals(d);
  ok(p2.m3.rid === alt.r.id && Math.abs(sum.k - pt.k) < 0.01 && !p2.extra.on, 'after swapping dinner the day total = sum of its dishes; no add-on switched on');
  ok(new Set(ks.map(k => p2[k].rid)).size === ks.length, 'no duplicate dish after the swap'); }

fs.mkdirSync(path.join(ROOT, 'dist/reports'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'dist/reports/nutrition-v2-test.json'), JSON.stringify({ pass, fail, sections: sec, fails, profiles: table, recipes: { total: V2.length, byMeal: counts } }, null, 1));
if (fails.length) { console.log('FAILURES:'); fails.forEach(f => console.log(' - ' + f)); }
table.forEach(r => console.log(JSON.stringify(Object.assign({}, r, { missed: r.missed.length }))));
console.log(JSON.stringify(sec)); console.log(`nutrition v2 tests: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
