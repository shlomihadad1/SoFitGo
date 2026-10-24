/* Content & logic tests (Node). Expected values are computed independently from the raw data tables,
   not by calling the same app function that is being checked. Writes a durations report to dist/reports. */
for (const f of ['src/js/figure.js', 'src/data/exercises.js', 'src/data/workouts.js', 'src/data/nutrition.js', 'src/data/recipes_intl.js', 'src/data/recipes_med.js', 'src/data/catalog.js', 'src/js/logic.js', 'src/js/store.js', 'src/js/core.js']) require('../' + f);
const fs = require('fs'), path = require('path');
const { Logic: L, PROGRAM: P, NUTRI: N, EXERCISES: EX, EX_BY_ID: E, Figure, Store: S, Core: C } = globalThis;
let pass = 0, fail = 0; const fails = [];
/* Stage B: a new profile is empty (no personal defaults). These tests enter the user's own values explicitly — the same
   values the app used before (32 y, 187 cm, 85 kg, male formula, fat-loss goal = 20% deficit) — so every expected number is unchanged. */
const seedUser = p => Object.assign(p, { age: 32, height: 187, weight: 85, startWeight: 85, sex: 'm', aims: { primary: 'fat_loss', secondary: [] } });
const ok = (c, m) => { if (c) pass++; else { fail++; fails.push(m); } };
const sec = {}; const T = name => { sec[name] = { p: pass, f: fail }; };
const done = name => { sec[name] = { pass: pass - sec[name].p, fail: fail - sec[name].f }; };

/* ── 1. food table ── */
T('food table');
const F = N.FOODS;
const EXPECT_STATE = { rice: 'dry', atta: 'dry', maida: 'dry', noodles: 'dry', poha: 'dry', oats: 'dry', masoor: 'dry', moong: 'dry', toor: 'dry', rajma: 'dry', chana: 'dry', kala_chana: 'dry', besan: 'dry', soya: 'dry', chicken_breast: 'raw', chicken_thigh: 'raw', chicken_mince: 'raw', egg: 'raw', egg_white: 'raw', potato: 'raw', sweet_potato: 'raw' };
for (const [id, f] of Object.entries(F)) {
  ['k', 'p', 'c', 'f', 'fb'].forEach(k => ok(typeof f[k] === 'number' && f[k] >= 0 && isFinite(f[k]), `food ${id}.${k} numeric`));
  ok(f.p + f.c + f.f <= 100.5, `food ${id} macros ≤100g/100g`);
  const atw = 4 * f.p + 4 * f.c + 9 * f.f; // independent energy check (Atwater factors)
  ok(Math.abs(atw - f.k) <= Math.max(15, f.k * 0.15), `food ${id} energy ${f.k} vs Atwater ${atw.toFixed(0)}`);
  ok(['raw', 'dry', 'ready'].includes(f.st), `food ${id} has weight state`);
  if (EXPECT_STATE[id]) ok(f.st === EXPECT_STATE[id], `food ${id} weighed ${EXPECT_STATE[id]}`);
}
done('food table');

/* ── 2. recipes ── */
T('recipes');
const indep = (ings) => ings.reduce((t, x) => { const f = F[x.f]; const k = x.g / 100; t.k += f.k * k; t.p += f.p * k; t.c += f.c * k; t.f += f.f * k; t.fb += f.fb * k; return t; }, { k: 0, p: 0, c: 0, f: 0, fb: 0 });
const ids = new Set();
for (const r of N.RECIPES) {
  ok(!ids.has(r.id), 'unique recipe id ' + r.id); ids.add(r.id);
  ok(r.he && r.en, 'names ' + r.id); ok(r.ing.length >= 1, 'has ingredients ' + r.id);
  r.ing.forEach(x => { ok(!!F[x.f], `ingredient exists ${r.id}:${x.f}`); ok(x.g > 0, `quantity > 0 ${r.id}:${x.f}`); });
  const fdup = r.ing.map(x => x.f); ok(new Set(fdup).size === fdup.length, `no duplicate ingredient (double-count) ${r.id}`);
  ok(r.steps.length >= 1, 'preparation steps ' + r.id); ok(typeof r.prep === 'number' && typeof r.cook === 'number', 'times ' + r.id);
  const a = L.recipeMacros(r), b = indep(r.ing);
  ok(Math.abs(a.k - b.k) <= 1 && Math.abs(a.p - b.p) <= 0.15 && Math.abs(a.c - b.c) <= 0.15 && Math.abs(a.f - b.f) <= 0.15, `recipe totals = sum of ingredients ${r.id}`);
  const s2 = L.recipeMacros(r, 2); ok(Math.abs(s2.k - 2 * b.k) <= 2, `scaling ×2 ${r.id}`);
  { const stepsTxt = r.steps.join(' '), grams = f => r.ing.filter(x => x.f === f).reduce((a, x) => a + x.g, 0);
    const chk = (re, f, per, label) => { for (const mm of stepsTxt.matchAll(re)) { const n = +mm[1]; const tot = grams(f); ok(tot > 0 && Math.abs(n - tot / per) <= 0.51, `${r.id}: step says ${n} ${label}, ingredients give ${(tot / per).toFixed(1)}`); } };
    chk(/(\d+) ביצים/g, 'egg', 50, 'eggs'); chk(/(\d+) חלבונים/g, 'egg_white', 33, 'egg whites'); chk(/(\d+) רוטי/g, 'atta', 35, 'roti'); chk(/(\d+) פרוסות/g, 'bread', 30, 'bread slices'); }
  if (r.est) ok(r.range > 0 && /הערכה/.test(r.notes), `restaurant estimate flagged ${r.id}`);
}
// step text vs ingredient list: quoted grams of oil / flour / curd / rice / paneer must equal the ingredient amount;
// dietary tags must agree with the actual ingredients
{ const QUOTE = { 'שמן': ['oil'], 'אטה': ['atta'], 'דהי': ['curd'], 'אורז': ['rice'], 'פניר': ['paneer'] };
  const DAIRY = ['curd', 'hung_curd', 'milk', 'paneer', 'ghee'], EGG = ['egg', 'egg_white'], CH = ['chicken_breast', 'chicken_thigh', 'chicken_mince'];
  for (const r of N.RECIPES) { const txt = r.steps.join(' '), g = fs_ => r.ing.filter(x => fs_.includes(x.f)).reduce((a, x) => a + x.g, 0);
    for (const [w, fs_] of Object.entries(QUOTE)) { const pieces = +((txt.match(/לחלק ל[־-](\d+)/) || [])[1] || 1); // "N g per piece" × number of pieces
      const ms = [...txt.matchAll(new RegExp('(\\d+)\\s*ג׳\\s*' + w + '( לכל)?', 'g'))].map(m => +m[1] * (m[2] ? pieces : 1)); if (!ms.length) continue;
      const tot = ms.reduce((a, b) => a + b, 0); ok(w === 'שמן' ? tot === g(fs_) : ms.every(n => n === g(fs_)), `${r.id}: steps quote ${ms.join('+')} g ${w}, ingredient list has ${g(fs_)} g`); }
    const fl = r.ing.map(x => x.f), has = G => fl.some(f => G.includes(f));
    if (r.tags.includes('veg')) ok(!has(EGG) && !has(CH), `${r.id}: tag 'veg' but contains egg/chicken`);
    if (r.tags.includes('vegan')) ok(!has(EGG) && !has(CH) && !has(DAIRY), `${r.id}: tag 'vegan' but contains animal products`);
    if (r.tags.includes('chicken')) ok(has(CH), `${r.id}: tag 'chicken' without chicken`);
    if (r.tags.includes('egg')) ok(has(EGG), `${r.id}: tag 'egg' without egg`); } }
const fullRecipes = N.RECIPES.filter(r => !r.est && r.meal !== 'extra' && r.steps.length >= 2 && r.ing.length >= 3 && r.equip.length);
ok(fullRecipes.length >= 20, '≥20 full recipes (' + fullRecipes.length + ')');
N.FLEX.forEach(f => ok(f.range === null || (f.range[0] < f.range[1]), 'flex meal has estimate range ' + f.id));
// swap alternatives carry their own values and ≥3 options
N.RECIPES.filter(r => ['m1', 'm2', 'snack'].includes(r.meal)).forEach(r => { const c = L.swapCandidates(r, N.RECIPES); ok(c.length >= 3, 'swap options ≥3 ' + r.id); c.slice(0, 3).forEach(o => { const b = indep(o.r.ing); ok(Math.abs(o.m.k - b.k) <= 1, `swap option own values ${r.id}→${o.r.id}`); }); });
// ingredient swap recalculates from the new food
{ const r = L.recipe('chicken_curry_rice'), idx = r.ing.findIndex(x => x.f === 'chicken_breast'); const g = L.suggestSwapGrams(r.ing[idx], 'paneer').g;
  const after = L.recipeMacros(r, 1, { [idx]: { f: 'paneer', g } }); const exp = indep(r.ing.map((x, i) => i === idx ? { f: 'paneer', g } : x));
  ok(Math.abs(after.k - exp.k) <= 1 && Math.abs(after.p - exp.p) <= 0.15, 'ingredient swap recalculated'); ok(L.compareMacros(L.recipeMacros(r), after).includes('שומן'), 'ingredient swap flags material fat change'); }
const vegan = N.RECIPES.filter(r => !r.est && r.meal !== 'extra' && C.conflicts(r, null, { dairy: false, egg: false, chicken: false }).length === 0);
ok(vegan.filter(r => r.steps.length >= 3 && r.ing.length >= 4).length >= 20, 'dairy-free vegetarian full recipes ≥20 (' + vegan.length + ')');
done('recipes');

/* ── 3. 30-day menus: base vs add-on vs eaten ── */
T('menus');
const menuRows = [];
S.resetAll(); const pr = seedUser(S.load('profile')); pr.startDate = S.today(); pr.prefs = Object.assign(C.normPrefs(pr.prefs), { cuisines: ['international'] }); /* checks the authored 30-day menu = 'מגוון בינלאומי' */ S.save('profile');
const tg = C.targets();
ok(N.MENU.length === 30 && N.EXTRA_DAY.length === 30, '30 menus');
ok(new Set(N.MENU.map(m => m.join())).size === 30, 'all 30 menus differ');
for (let i = 0; i < 30; i++) {
  const date = S.addDays(S.today(), i), m = N.MENU[i];
  m.forEach(id => ok(!!L.recipe(id), 'menu recipe exists ' + id));
  const adj = N.BASE_ADJ[i] || {}; const slotIngs = (id, k) => L.recipe(id).ing.map((x, j) => (adj[k] && adj[k][j] != null) ? { f: x.f, g: adj[k][j] } : x);
  const base = indep([...slotIngs(m[0], 'm1'), ...slotIngs(m[1], 'm2'), ...slotIngs(m[2], 'snack')]), ex = indep(L.recipe(N.EXTRA_DAY[i]).ing);
  ok(base.p >= tg.protein, `day ${i + 1}: base menu reaches protein target without add-on (${base.p.toFixed(1)} ≥ ${tg.protein})`);
  ok(base.k >= 2050 && base.k <= 2450, `day ${i + 1}: base calories reasonable (${Math.round(base.k)})`);
  Object.entries(adj).forEach(([k, o]) => Object.entries(o).forEach(([j, g]) => { const x = L.recipe(m[['m1', 'm2', 'snack'].indexOf(k)]).ing[j];
    ok(!['egg', 'egg_white', 'atta', 'bread', 'oil', 'ghee'].includes(x.f), `day ${i + 1}: adjusted food is not counted in steps/fat (${x.f})`);
    ok(g >= x.g && g <= x.g * 1.8 + 1, `day ${i + 1}: adjustment within limits (${x.f} ${x.g}→${g})`); }));
  Object.entries(adj).forEach(([k, o]) => { const r = L.recipe(m[['m1', 'm2', 'snack'].indexOf(k)]), txt = r.steps.join(' ');
    Object.entries(o).forEach(([j, g]) => { const x = r.ing[j]; const w = F[x.f].he.split(' (')[0].split(' ')[0];
      ok(!new RegExp('(^|\\D)' + x.g + '\\s*ג׳\\s*' + w).test(txt), `day ${i + 1}: step text does not quote the pre-adjustment amount of ${x.f} (${x.g} g, planned ${g} g)`);
      ok(['protein', 'legume', 'dairy', 'carb', 'fruit', 'veg'].includes(F[x.f].grp), `day ${i + 1}: adjusted food ${x.f} is a protein/legume/dairy/carb/fruit/veg source (not fat) (grp ${F[x.f].grp})`); }); });
  const cBase = C.plannedTotals(date, 'base'), cSel = C.plannedTotals(date, 'selected');
  ok(Math.abs(cBase.k - base.k) <= 2 && Math.abs(cBase.p - base.p) <= 0.3, `day ${i + 1} base = 3 meals only`);
  ok(Math.abs(cSel.k - base.k) <= 2, `day ${i + 1} add-on not counted until selected`);
  C.setExtraOn(date, true); const on = C.plannedTotals(date, 'selected'), exS = C.slotMacros(C.plan(date).extra); /* P0: the suggestion shown (never repeating a protein food of the day) is what gets counted */
  ok(Math.abs(on.k - (base.k + exS.k)) <= 2 && Math.abs(on.p - (base.p + exS.p)) <= 0.3, `day ${i + 1} add-on counted when selected`);
  C.setExtraOn(date, false); ok(Math.abs(C.plannedTotals(date, 'selected').k - base.k) <= 2, `day ${i + 1} add-on removed → back to base`);
  menuRows.push({ day: i + 1, menu: m, adjusted: Object.keys(adj).length > 0, base: { k: Math.round(base.k), p: +base.p.toFixed(1) }, withAddOn: { k: Math.round(base.k + ex.k), p: +(base.p + ex.p).toFixed(1) }, proteinGap: Math.round(tg.protein - base.p) });
}
// eating, quantity change, removal, no double count
{ const d = S.today(); const before = C.eatenTotals(d).k; C.eatSlot(d, 'm1', 1); C.eatSlot(d, 'm1', 1); // second call must not add a second entry
  ok(C.entries(d).filter(e => e.slot === 'm1').length === 1, 'no double entry for one slot');
  const pm1 = C.plan(d).m1; const m1 = indep(L.recipeIngredients(L.recipe(pm1.rid), pm1.ov)); ok(Math.abs(C.eatenTotals(d).k - (before + m1.k)) <= 2, 'eaten = recipe sum');
  C.eatSlot(d, 'm1', 0.5); ok(Math.abs(C.eatenTotals(d).k - m1.k * 0.5) <= 2, 'quantity change to 50%');
  C.removeEntry(d, C.slotEntry(d, 'm1').id); ok(C.eatenTotals(d).k === 0, 'remove from log → 0');
  // meal swap after eating keeps the logged snapshot
  C.eatSlot(d, 'm2', 1); const logged = C.slotEntry(d, 'm2').k; C.setPlanSlot(d, 'm2', { rid: 'soya_matar_rice', ov: null, scale: 1 });
  ok(C.slotEntry(d, 'm2').k === logged, 'meal swap does not change eaten history');
  { const pl = C.plan(d); ok(Math.abs(C.plannedTotals(d, 'base').k - indep([...L.recipeIngredients(L.recipe(pl.m1.rid), pl.m1.ov), ...L.recipe('soya_matar_rice').ing, ...L.recipeIngredients(L.recipe(pl.snack.rid), pl.snack.ov)]).k) <= 2, 'meal swap updates planned base (new meal at recipe amounts)'); }
}
done('menus');

/* ── 4. preferences engine ── */
T('preferences');
const combos = [{ dairy: false }, { egg: false }, { chicken: false }, { veg: true }, { veg: true, dairy: false }, { exclude: ['peanuts', 'soya'] },
  { dairy: false, egg: false }, { egg: false, chicken: false }, { dairy: false, chicken: false }, { exclude: ['peanuts'] }, { exclude: ['soya'] }, { veg: true, exclude: ['soya'] }, { veg: true, dairy: false, exclude: ['peanuts', 'soya'] }];
const prefRows = [];
for (const c of combos) {
  S.resetAll(); const p2 = seedUser(S.load('profile')); p2.startDate = S.addDays(S.today(), -2); p2.prefs = Object.assign(C.normPrefs(p2.prefs), { cuisines: ['international'] }); S.save('profile');
  const yday = S.addDays(S.today(), -1), pastBefore = JSON.stringify(C.plan(yday));
  C.eatSlot(S.today(), 'm1', 1); const eatenSnap = JSON.stringify(C.entries(S.today()));
  const pf = C.normPrefs(Object.assign({ cuisines: ['international'] }, c)); p2.prefs = pf; S.save('profile');
  const res = C.applyPrefs(pf); const blocked = C.blockedFoods(pf);
  /* Stage H1 (approved spec change): a meal with no valid replacement is shown EMPTY with an explanation — it no longer
     keeps the forbidden recipe. Previously: "remaining conflicts === reported unresolved". Now: 0 conflicts remain and
     the number of empty slots equals the number reported unresolved. */
  let remaining = 0, empty = 0;
  for (let n = 3; n <= 30; n++) { const d = C.dateOfDay(n); ['m1', 'm2', 'snack', 'extra'].forEach(slot => { if (n === 3 && slot === 'm1') return; const s = C.plan(d)[slot]; if (!s.rid) { if (s.blockedNone) empty++; return; } const ingsNow = L.recipeIngredients(L.recipe(s.rid), s.ov); if (ingsNow.some(x => blocked.has(x.f))) remaining++; }); }
  ok(remaining === 0, `${JSON.stringify(c)}: no planned meal contains a restricted food (${remaining})`);
  ok(empty === res.none.length, `${JSON.stringify(c)}: every unresolved meal is shown empty with an explanation (${empty}/${res.none.length})`);
  ok(JSON.stringify(C.plan(yday)) === pastBefore, `${JSON.stringify(c)}: past days untouched`);
  ok(JSON.stringify(C.entries(S.today())) === eatenSnap, `${JSON.stringify(c)}: eaten food untouched`);
  // replaced meals keep their own recomputed values
  const d5 = C.dateOfDay(5); ['m1', 'm2', 'snack'].forEach(slot => { const s = C.plan(d5)[slot]; if (!s.rid) { ok(!!s.blockedNone, `${JSON.stringify(c)}: empty ${slot} carries an explanation (H1)`); return; } ok(Math.abs(C.slotMacros(s).k - indep(L.recipeIngredients(L.recipe(s.rid), s.ov)).k * s.scale) <= 2, `${JSON.stringify(c)}: recomputed ${slot}`); });
  // revert: turning all prefs back on restores the original menu
  const pfAll = C.normPrefs({ cuisines: ['international'] }); p2.prefs = pfAll; S.save('profile'); C.applyPrefs(pfAll);
  let restored = true; const nuR = S.load('nutrition'); for (let n = 4; n <= 30; n++) { const dd = C.dateOfDay(n), pl = C.plan(dd); const m = N.MENU[n - 1]; const st = nuR.plan[dd] || {}; if (pl.m1.rid !== m[0] || pl.m2.rid !== m[1] || pl.snack.rid !== m[2] || st.m1 || st.m2 || st.snack || pl.m1.changed || pl.m2.changed || pl.snack.changed) restored = false; }
  ok(restored, `${JSON.stringify(c)}: reverting preferences restores original menu`);
  const distinct = new Set(); for (let n = 3; n <= 30; n++) { /* variety measured on re-applied prefs */ }
  p2.prefs = pf; S.save('profile'); C.applyPrefs(pf); for (let n = 3; n <= 30; n++) { const pl = C.plan(C.dateOfDay(n)); ['m1', 'm2', 'snack'].forEach(k => distinct.add(pl[k].rid)); }
  const pp = []; for (let n = 3; n <= 30; n++) pp.push(C.plannedTotals(C.dateOfDay(n), 'base'));
  prefRows.push({ prefs: c, ingredientSwaps: res.ing, mealSwaps: res.meal, unresolved: res.none.length, distinctMealsAfter: distinct.size, baseProteinMin: Math.min(...pp.map(x => x.p)), baseProteinAvg: +(pp.reduce((a, x) => a + x.p, 0) / pp.length).toFixed(1), baseKcalAvg: Math.round(pp.reduce((a, x) => a + x.k, 0) / pp.length), daysBelowTarget: pp.filter(x => x.p < tg.protein).length, baseKcalMin: Math.min(...pp.map(x => x.k)), baseKcalMax: Math.max(...pp.map(x => x.k)) });
}
done('preferences');

/* ── 5. workouts: 30 days, 90 versions ── */
T('workouts');
ok(P.DAYS.length === 30, '30 days');
const reqEx = ['he', 'en', 'muscles', 'start', 'steps', 'dir', 'end', 'mistakes', 'breath', 'bad', 'levels', 'progress', 'alts', 'A', 'B'];
EX.forEach(e => { reqEx.forEach(k => ok(e[k] != null && e[k] !== '', `exercise field ${e.id}.${k}`)); e.alts.forEach(a => ok(!!E[a], `alt exists ${e.id}→${a}`));
  const a = Figure.staticSvg(e, 'A'), b = Figure.staticSvg(e, 'B'); ok(/<line/.test(a.fig) && /<circle/.test(b.fig) && !/NaN/.test(a.fig + b.fig), 'illustration renders ' + e.id); });
ok(EX.length === 57, '57 exercises (' + EX.length + ')');
const durRows = []; const TOL = { short: 1.25, std: 1.25, long: 1.5 };
const own = it => { // independent duration model: same documented assumptions, computed here
  const rs = it.tempo ? 5.5 : 3.5; const per = it.sec === 'max' ? 60 : it.sec ? it.sec : (it.reps === 'max' ? 20 : it.reps) * rs; return per * (it.side ? 2 : 1); };
for (const d of P.DAYS) {
  ok(['full', 'lower', 'upper', 'cardio', 'recovery', 'rest'].includes(d.type), 'day type ' + d.day);
  if (d.type === 'rest') { ok(!d.main.length && d.goal, 'rest day planned ' + d.day); ['short', 'std', 'long'].forEach(v => durRows.push({ day: d.day, version: v, target: L.VERSION_TARGET[v], note: 'יום מנוחה מתוכנן — אין אימון' })); continue; }
  ok(L.hasVersions(d), 'three versions ' + d.day);
  const sets = {};
  for (const v of ['short', 'std', 'long']) {
    const st = L.buildSteps(d, v), parts = L.versionParts(d, v);
    ok(parts.warm.length > 0 && parts.cool.length > 0, `day ${d.day} ${v}: has warm-up and cool-down`);
    ok(parts.main.length > 0, `day ${d.day} ${v}: has exercises`);
    let warm = 0, work = 0, rest = 0, cool = 0, trans = 0;
    st.forEach((s, i) => { const w = own(s.item); if (s.sec === 'warm') warm += w; else if (s.sec === 'cool') cool += w; else work += w; if (i < st.length - 1) rest += s.rest; if (s.item.ex !== 'brisk_walk') trans += 8; });
    const total = (warm + work + rest + cool + trans) / 60, b = L.durationBreakdown(d, v);
    ok(Math.abs(b.total / 60 - total) < 0.01, `day ${d.day} ${v}: app duration matches independent calculation`);
    const gap = total - L.VERSION_TARGET[v];
    ok(Math.abs(gap) <= TOL[v], `day ${d.day} ${v}: ${total.toFixed(1)} min vs ${L.VERSION_TARGET[v]} (gap ${gap.toFixed(1)})`);
    durRows.push({ day: d.day, version: v, target: L.VERSION_TARGET[v], warm: +(warm / 60).toFixed(1), work: +(work / 60).toFixed(1), rest: +(rest / 60).toFixed(1), cool: +(cool / 60).toFixed(1), transitions: +(trans / 60).toFixed(1), total: +total.toFixed(1), gap: +gap.toFixed(1), displayed: L.estimateMinutes(d, v) });
    sets[v] = parts.main.map(x => x.ex + ':' + x.sets + ':' + (x.sec || x.reps)).join('|') + '#' + parts.cool.length;
    parts.main.forEach(it => ok(!!E[it.ex], `exercise exists ${d.day}:${it.ex}`));
  }
  ok(sets.short !== sets.std && sets.std !== sets.long, `day ${d.day}: versions differ in content`);
  if (d.std && !d.walkOnly) ok(d.std.includes(0), `day ${d.day}: standard keeps the day's first (key) exercise`);
}
const sig = P.DAYS.filter(d => d.main.length).map(d => JSON.stringify(d.main)); ok(new Set(sig).size === sig.length, 'no duplicated workout days');
for (let w = 2; w <= 3; w++) { const ex = n => new Set(P.DAYS.filter(d => d.week === n).flatMap(d => d.main.map(x => x.ex))); ok([...ex(w)].some(x => !ex(w - 1).has(x)), `week ${w} introduces new exercises`); }
// walk notes shown to the user quote the same minutes the timer uses, in every version
{ let walkNotes = 0; for (const d of P.DAYS) for (const v of ['short', 'std', 'long']) { let st; try { st = L.buildSteps(d, v); } catch (e) { continue; } if (!Array.isArray(st)) continue;
    st.filter(x => x.item && x.item.ex === 'brisk_walk' && x.item.note && /(\d+) דקות/.test(x.item.note)).forEach(x => { walkNotes++; const n = +x.item.note.match(/(\d+) דקות/)[1]; ok(n === x.item.sec / 60, `day ${d.day} ${v}: walk note says ${n} min, timer ${x.item.sec / 60} min`); }); }
  ok(walkNotes >= 20, 'walk notes checked: ' + walkNotes); console.log('walk notes checked', walkNotes); }
done('workouts');

/* ── 6. fitness tests ── */
T('fitness tests');
const TP = P.TEST_PROTOCOL;
ok(P.DAYS[0].testDay && P.DAYS[28].testDay, 'tests on day 1 and day 29');
ok(TP.items.length === 4 && TP.items.every(i => P.TESTS[i.test] && P.TESTS[i.test].how), 'four tests with instructions');
ok(JSON.stringify(L.versionParts(P.DAYS[0], 'test')) === JSON.stringify(L.versionParts(P.DAYS[28], 'test')), 'day 1 and day 29 tests identical (same order and rests)');
ok(!P.DAYS[0].main.some(i => i.test) && !P.DAYS[28].main.some(i => i.test), 'tests separated from the regular workout');
['short', 'std', 'long'].forEach(v => ok(!L.buildSteps(P.DAYS[0], v).some(s => s.item.test), 'no test items inside workout version ' + v));
S.resetAll(); { const w = S.load('workouts'); w.tests[1] = { date: S.today(), results: { pushup: 20, plank: 70 }, source: 'manual' }; S.save('workouts');
  const r = C.testResults(); ok(r[1].pushup === 20 && r[1].squat60 === undefined, 'test not performed stays empty (no invented value)');
  ok(r[29].pushup === undefined, 'final test empty until recorded'); }
// migration of v1 logs
S.resetAll(); globalThis.localStorage && 0;
done('fitness tests');

/* ── 7. persistence + backup/restore ── */
T('backup');
S.resetAll(); { const d = S.today(); C.eatSlot(d, 'snack', 0.75); C.setDaily(d, { water: 1250, steps: 9100, sleep: 7 }); const tr = S.load('tracking'); tr.measures.push({ id: 'm1', date: d, weight: 84.6, waist: 91 }); S.save('tracking');
  const w = S.load('workouts'); w.days[3] = { status: 'done', version: 'std', durationSec: 1800 }; w.tests[1] = { date: d, results: { pushup: 21 } }; w.levels.squat = 'hard'; S.save('workouts');
  const pf = S.load('profile'); pf.prefs = C.normPrefs({ dairy: false }); S.save('profile'); C.applyPrefs(pf.prefs);
  const snap = JSON.stringify(S.exportAll(), (k, v) => k === 'exportedAt' ? undefined : v);
  const backup = JSON.parse(JSON.stringify(S.exportAll()));
  S.resetAll(); ok(!C.entries(d).length, 'reset clears data');
  S.importAll(backup);
  ok(JSON.stringify(S.exportAll(), (k, v) => k === 'exportedAt' ? undefined : v) === snap, 'restore reproduces every exported section exactly');
  ok(C.eatenTotals(d).k > 0 && S.load('workouts').tests[1].results.pushup === 21 && C.normPrefs(C.profile().prefs).dairy === false, 'restored values readable');
  let bad = false; try { S.importAll({ app: 'x' }); } catch (e) { bad = true; } ok(bad, 'invalid backup rejected');
  ok(['profile', 'workouts', 'nutrition', 'tracking'].every(k => backup[k]), 'backup includes profile, workouts, nutrition, tracking'); }
done('backup');

/* report */
const outDir = path.join(__dirname, '..', 'dist', 'reports'); fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'durations.json'), JSON.stringify(durRows, null, 1));
const md = ['| יום | גרסה | יעד | חימום | עבודה | מנוחות | שחרור | מעברים | סה״כ מחושב | פער |', '|---|---|---|---|---|---|---|---|---|---|']
  .concat(durRows.map(r => r.note ? `| ${r.day} | ${r.version} | ${r.target} | — | — | — | — | — | — | ${r.note} |` : `| ${r.day} | ${r.version} | ${r.target} | ${r.warm} | ${r.work} | ${r.rest} | ${r.cool} | ${r.transitions} | ${r.total} | ${r.gap > 0 ? '+' : ''}${r.gap} |`));
fs.writeFileSync(path.join(outDir, 'durations.md'), md.join('\n'));
fs.writeFileSync(path.join(outDir, 'menus.json'), JSON.stringify({ targets: { kcal: tg.kcal, protein: tg.protein }, days: menuRows, preferences: prefRows }, null, 1));
const tr = durRows.filter(r => !r.note), gaps = v => tr.filter(r => r.version === v).map(r => Math.abs(r.gap));
console.log(JSON.stringify(sec));
console.log('versions measured', tr.length, 'rest-day slots', durRows.length - tr.length, 'max |gap| short/std/long', ['short', 'std', 'long'].map(v => Math.max(...gaps(v)).toFixed(2)).join(' / '));
console.log('base menu kcal', Math.min(...menuRows.map(r => r.base.k)), '-', Math.max(...menuRows.map(r => r.base.k)), 'protein', Math.min(...menuRows.map(r => r.base.p)), '-', Math.max(...menuRows.map(r => r.base.p)), '| days below protein target (base):', menuRows.filter(r => r.proteinGap > 0).length);
console.log('preferences', JSON.stringify(prefRows));
if (fails.length) console.log('FAILURES:\n' + fails.slice(0, 40).join('\n'));
console.log(`content tests: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
