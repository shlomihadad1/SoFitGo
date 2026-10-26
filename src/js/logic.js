/* Pure logic (no DOM): nutrition math, targets, workout versions, durations, step sequences.
   Loaded by the app and by the Node test suite. */
(function (root) {
const N = () => root.NUTRI, P = () => root.PROGRAM;
const r1 = x => Math.round(x * 10) / 10;

function ingMacros(ing) {
  const fd = N().FOODS[ing.f]; const k = ing.g / 100;
  return { k: fd.k * k, p: fd.p * k, c: fd.c * k, f: fd.f * k, fb: fd.fb * k };
}
function sumMacros(list) {
  const t = { k: 0, p: 0, c: 0, f: 0, fb: 0 };
  list.forEach(m => { t.k += m.k; t.p += m.p; t.c += m.c; t.f += m.f; t.fb += m.fb; });
  return t;
}
function roundM(m) { return { k: Math.round(m.k), p: r1(m.p), c: r1(m.c), f: r1(m.f), fb: r1(m.fb) }; }
/* ingredients may be overridden: overrides = { index: {f, g} } */
function recipeIngredients(r, overrides) {
  return r.ing.map((x, idx) => (overrides && overrides[idx]) ? Object.assign({}, x, overrides[idx]) : x);
}
function recipeMacros(r, scale, overrides) {
  const s = scale == null ? 1 : scale;
  const m = sumMacros(recipeIngredients(r, overrides).map(ingMacros));
  return roundM({ k: m.k * s, p: m.p * s, c: m.c * s, f: m.f * s, fb: m.fb * s });
}
/* Nutrition Calculation Trace: how a dish's numbers were computed — per ingredient: food id, grams, per-100 g values used,
   contribution, source and verification code. Deterministic (same inputs → same trace). FORMULA bumps when the method changes. */
const FORMULA = 'ingredients×per100g·v1';
function recipeTrace(r, scale, overrides) {
  const s = scale == null ? 1 : scale, F = N().FOODS, rows = [], missing = [], ms = [];
  recipeIngredients(r, overrides).forEach(x => { const fd = F[x.f]; if (!fd) { missing.push(x.f); return; } const g = x.g * s, m = ingMacros({ f: x.f, g }); ms.push(m);
    rows.push({ f: x.f, he: fd.he, st: fd.st, g: Math.round(g * 10) / 10, per100: { k: fd.k, p: fd.p, c: fd.c, f: fd.f, fb: fd.fb }, got: roundM(m), src: fd.src || null, chk: fd.chk || null }); });
  const raw = sumMacros(ms);
  return { formula: FORMULA, recipe: r.id, scale: s, rows, total: roundM(raw), missing };
}
const RB = () => { const o = {}; N().RECIPES.forEach(r => { o[r.id] = r; }); return o; };
let _rb = null; function recipe(id) { if (!_rb) _rb = RB(); return _rb[id]; }
function _resetRecipeIndex() { _rb = null; } /* Admin CMS: a published new recipe joins the index */

/* Mifflin–St Jeor. Sex constant: male +5, female −161; when not given, the midpoint (−78) is used and flagged as an
   estimate. Activity factor 1.55 = training ~5×/week + ~8–10k steps. deficit: share below maintenance (negative = surplus). */
const SEX_K = { m: 5, f: -161 };
function computeTargets(pr) {
  const w = pr.weight, h = pr.height, a = pr.age;
  const sk = SEX_K[pr.sex] != null ? SEX_K[pr.sex] : -78;
  const bmr = 10 * w + 6.25 * h - 5 * a + sk;
  const af = pr.activity || 1.55;
  const tdee = bmr * af;
  const deficit = pr.deficit == null ? 0.2 : pr.deficit;
  let kcal = Math.round(tdee * (1 - deficit) / 50) * 50; const kcalRaw = kcal;
  /* Stage H1 safety floor (only when a deficit is applied): not below max(BMR, 1200 women / 1500 men and unknown) —
     Harvard Health: intake "should not fall below 1,200 a day in women or 1,500 a day in men" except under supervision —
     and never above maintenance (a floor above TDEE simply means: no deficit). */
  let floored = false;
  if (deficit > 0) { const floor = Math.min(Math.round(tdee / 50) * 50, Math.max(Math.ceil(bmr / 50) * 50, pr.sex === 'f' ? 1200 : 1500)); if (kcal < floor) { kcal = floor; floored = true; } }
  const protein = Math.round(w * (pr.proteinPerKg || 1.8) / 5) * 5;
  const fat = Math.round(kcal * 0.25 / 9 / 5) * 5;
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4 / 5) * 5);
  return { bmr: Math.round(bmr), tdee: Math.round(tdee), tdeeLow: Math.round(tdee * 0.9), tdeeHigh: Math.round(tdee * 1.1), af, deficit, kcal, floored, kcalRaw, protein, fat, carbs, fiber: 30, sex: SEX_K[pr.sex] != null ? pr.sex : null, sexK: sk };
}

/* Workout versions.
   short (target 15 min): quick warm-up + the day's own short circuit (d.short), d.shortRounds rounds + quick cool-down.
   std   (target 30 min): the day's warm-up + the explicitly selected main exercises (d.std indices) + the day's cool-down.
   long  (target 60 min): the day's warm-up + all main exercises + the first d.longExtra extra exercises + cool-down (+ mobility flow if d.longFlow).
   Walk-based days set the walk length per version in d.walkMin. 'test' = the standardized fitness test (days 1 and 29). */
const VERSIONS = { min: 'מינימום', short: 'קצר', std: 'רגיל', long: 'ארוך', test: 'מבחן' };
const VERSION_TARGET = { min: 5, short: 15, std: 30, long: 60 };
/* SLL-02 · Minimum Mode ("min", ~5 minutes): built ONLY from what the day already contains — the quick warm-up, the first two work
   exercises of the day (the short version's when it exists) at 1 set each on the easy level, and the quick cool-down. No new
   exercise content. Never on test / recovery days. Logged as PARTIAL (it never counts as a full workout). A personal-plan day that
   Planner.versioned already reduced (d.version === 'min') passes through unchanged. */
const MIN_ITEMS = 2;
const withWalk = (items, min) => items.map(it => it.ex === 'brisk_walk' && min != null ? Object.assign({}, it, { sec: min * 60, note: (it.note && !/^\d|דקות/.test(it.note) ? it.note + ' ' : '') + min + ' דקות.' }) : it);
function versionParts(d, v) {
  if (v === 'test') { const T = root.PROGRAM.TEST_PROTOCOL; return { warm: T.warm, main: T.items, cool: T.cool, circuit: 0 }; }
  if (!d.main.length) return { warm: [], main: [], cool: [], circuit: 0 };
  const W = root.PROGRAM_W, Cc = root.PROGRAM_C, wm = d.walkMin || {};
  if (v === 'min' && d.version !== 'min') { const src = (d.short || d.main).filter(it => it.ex !== 'brisk_walk' && (it.reps || typeof it.sec === 'number'));
    if (d.walkOnly || !src.length) return { warm: W.quick, main: withWalk(d.main.filter(it => it.ex === 'brisk_walk').slice(0, 1), 3), cool: Cc.quick, circuit: 0 };
    return { warm: W.quick, main: src.slice(0, MIN_ITEMS).map(it => Object.assign({}, it, { sets: 1, lvl: 'easy' })), cool: Cc.quick, circuit: 0 }; }
  if (d.walkOnly) return { warm: d.warm, main: withWalk(d.main, wm[v] != null ? wm[v] : wm.std), cool: v === 'short' ? Cc.shortFlow : d.cool.concat(v === 'long' && d.longFlow ? Cc.longFlow : []), circuit: 0 };
  if (v === 'short' && d.short) {
    const r = d.shortRounds || 3;
    return { warm: W.quick, main: withWalk(d.short.map(it => Object.assign({}, it, { sets: it.ex === 'brisk_walk' ? 1 : r })), wm.short), cool: Cc.quick, circuit: d.short.every(it => it.ex !== 'brisk_walk') ? r : 0, roundRest: d.shortRoundRest || 60 };
  }
  if (v === 'long' && d.extra) {
    const ex = d.extra.slice(0, d.longExtra == null ? d.extra.length : d.longExtra).filter(it => !(d.walkMin && it.ex === 'brisk_walk')).map(it => d.longExtraSets && it.ex !== 'brisk_walk' ? Object.assign({}, it, { sets: d.longExtraSets }) : it.ex === 'brisk_walk' && d.longWalkMin ? withWalk([it], d.longWalkMin)[0] : it);
    return { warm: d.warm, main: withWalk(d.main, wm.long).concat(ex), cool: d.cool.concat(d.longFlow ? Cc.longFlow : []), circuit: d.circuit || 0, roundRest: d.roundRest, extraFrom: d.main.length };
  }
  const core = d.std ? d.std.map(k => d.stdSets && d.stdSets[k] ? Object.assign({}, d.main[k], { sets: d.stdSets[k] }) : d.main[k]) : d.main;
  return { warm: d.warm, main: withWalk(core, wm.std), cool: d.cool, circuit: d.circuit || 0, roundRest: d.roundRest };
}
function hasVersions(d) { return !!((d.short && d.extra) || d.walkOnly); }
/* Timing assumptions (shown to the user): 3.5 s per controlled rep, 5.5 s per rep for slow-tempo sets,
   'max' reps ≈ 20 reps, 'max' hold ≈ 60 s, 8 s to get into position for each set (none for walks). */
const REP_SEC = 3.5, TEMPO_SEC = 5.5, TRANS_SEC = 8;
function setWork(it) {
  const rs = it.tempo ? TEMPO_SEC : REP_SEC;
  const per = it.sec === 'max' ? 60 : it.sec ? it.sec : (it.reps === 'max' ? 20 : it.reps) * rs;
  return per * (it.side ? 2 : 1);
}
/* Ordered steps for workout mode. Each step = one set of one item. */
function buildSteps(d, v) {
  const parts = versionParts(d, v); const steps = [];
  const push = (sec, it, idx, set, rest) => steps.push({ sec, idx, ex: it.ex, set, sets: it.sets, item: it, rest });
  parts.warm.forEach((it, idx) => { for (let s = 1; s <= it.sets; s++) push('warm', it, idx, s, it.rest || 10); });
  const circ = parts.circuit;
  const circItems = circ ? parts.main.slice(0, parts.extraFrom || parts.main.length) : [];
  if (circ) {
    const rounds = Math.max(...circItems.map(x => x.sets));
    for (let r = 1; r <= rounds; r++) circItems.forEach((it, idx) => { if (r <= it.sets) push('main', it, idx, r, idx === circItems.length - 1 ? (parts.roundRest || 90) : (it.rest != null ? it.rest : 15)); });
    parts.main.slice(circItems.length).forEach((it, k) => { const idx = circItems.length + k; for (let s = 1; s <= it.sets; s++) push('main', it, idx, s, it.rest || 45); });
  } else parts.main.forEach((it, idx) => { for (let s = 1; s <= it.sets; s++) push('main', it, idx, s, it.rest == null ? 45 : it.rest); });
  parts.cool.forEach((it, idx) => { for (let s = 1; s <= it.sets; s++) push('cool', it, idx, s, it.rest || 5); });
  return steps;
}
/* Duration breakdown in seconds: warm-up work, main work, rests (between all steps, none after the last), cool-down work, transitions. */
function durationBreakdown(d, v) {
  const st = buildSteps(d, v); const b = { warm: 0, work: 0, rest: 0, cool: 0, trans: 0, total: 0 };
  st.forEach((s, i) => {
    const w = setWork(s.item);
    if (s.sec === 'warm') b.warm += w; else if (s.sec === 'cool') b.cool += w; else b.work += w;
    if (i < st.length - 1) b.rest += s.rest;
    if (s.item.ex !== 'brisk_walk') b.trans += TRANS_SEC;
  });
  b.total = b.warm + b.work + b.rest + b.cool + b.trans; return b;
}
function estimateMinutes(d, v) { const b = durationBreakdown(d, v); return Math.round(b.total / 60); }
function exerciseUsage() {
  const map = {};
  P().DAYS.forEach(d => ['warm', 'main', 'short', 'extra', 'cool'].forEach(k => (d[k] || []).forEach(it => { (map[it.ex] = map[it.ex] || new Set()).add(d.day); })));
  const out = {}; for (const k in map) out[k] = Array.from(map[k]).sort((a, b) => a - b); return out;
}
/* Ingredient swap: suggest grams of new food matching the role's key nutrient. */
function suggestSwapGrams(fromIng, toFood) {
  const F = N().FOODS, a = F[fromIng.f], b = F[toFood];
  const key = (fromIng.role === 'protein' || a.grp === 'protein' || a.grp === 'legume' || a.grp === 'dairy') ? 'p' : (a.grp === 'carb' ? 'c' : 'k');
  const target = a[key] * fromIng.g / 100;
  let g = b[key] > 0 ? target / b[key] * 100 : fromIng.g;
  g = Math.max(5, Math.round(g / 5) * 5);
  if (b.grp === 'fat') g = Math.max(2, Math.round(target / b.k * 100));
  return { g, key };
}
function compareMacros(a, b) { // returns warning flags if materially different
  const flags = [];
  if (Math.abs(b.k - a.k) > Math.max(60, a.k * 0.15)) flags.push('קלוריות');
  if (Math.abs(b.p - a.p) > Math.max(5, a.p * 0.2)) flags.push('חלבון');
  if (Math.abs(b.f - a.f) > Math.max(6, a.f * 0.3)) flags.push('שומן');
  return flags;
}
function swapCandidates(slotRecipe, all) {
  const base = recipeMacros(slotRecipe);
  return all.filter(r => r.meal === slotRecipe.meal && r.id !== slotRecipe.id && !r.archived)
    .map(r => ({ r, m: recipeMacros(r) }))
    .map(o => Object.assign(o, { score: Math.abs(o.m.k - base.k) / 100 + Math.abs(o.m.p - base.p) / 8, flags: compareMacros(base, o.m) }))
    .sort((x, y) => x.score - y.score);
}
root.Logic = { _resetRecipeIndex, recipeTrace, FORMULA, ingMacros, sumMacros, roundM, recipeIngredients, recipeMacros, recipe, computeTargets, VERSIONS, VERSION_TARGET, versionParts, hasVersions, buildSteps, estimateMinutes, durationBreakdown, setWork, REP_SEC, TEMPO_SEC, TRANS_SEC, exerciseUsage, suggestSwapGrams, compareMacros, swapCandidates };
})(typeof window !== 'undefined' ? window : globalThis);
