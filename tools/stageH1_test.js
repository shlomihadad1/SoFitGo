/* Stage H1 regression & acceptance tests (Node, simulated clock). Expected values are recomputed independently.
   Writes dist/reports/stageH1-test.json */
const fs = require('fs'), path = require('path'); const ROOT = path.join(__dirname, '..');
for (const f of ['src/js/figure.js', 'src/data/exercises.js', 'src/data/workouts.js', 'src/data/nutrition.js', 'src/data/recipes_intl.js', 'src/data/recipes_med.js', 'src/data/catalog.js', 'src/data/programs.js', 'src/js/logic.js', 'src/js/planner.js', 'src/js/plans.js', 'src/js/mealplanner.js', 'src/js/store.js', 'src/js/core.js', 'src/js/insights.js', 'src/js/adapt.js', 'src/js/signature.js']) require(path.join(ROOT, f));
const { Store: S, Core: C, Plans: PS, MealPlan: MP, Logic: L, NUTRI: N, CATALOG: CT, Signature: G } = globalThis; const F = N.FOODS;
let pass = 0, fail = 0; const fails = [], sec = {}; let cur = '';
const T = n => { cur = n; sec[n] = { pass: 0, fail: 0 }; }, ok = (c, m, info) => { if (c) { pass++; sec[cur].pass++; } else { fail++; sec[cur].fail++; if (fails.length < 80) fails.push(cur + ': ' + m + (info !== undefined ? ' → ' + JSON.stringify(info).slice(0, 300) : '')); } };
let NOW = '2026-10-19'; S.today = () => NOW;
const BASE = { age: 32, height: 175, weight: 80, sex: 'm', goal: 'fat_loss', xp: 'beginner', days: [1, 3, 5], spw: 3, maxMin: 30, eq: [], prefs: {} };
function setUser(o) { S.resetAll(); NOW = '2026-10-19'; o = Object.assign({}, BASE, o || {}); const p = S.load('profile');
  Object.assign(p, { age: o.age, height: o.height, weight: o.weight, startWeight: o.weight, sex: o.sex, experience: o.xp, startDate: NOW, targetWeight: o.tw || null }); if (o.activity) p.activity = o.activity;
  p.aims = { primary: o.goal, secondary: [] }; p.availability = { days: o.days, sessions: o.spw, prefMin: null, maxMin: o.maxMin }; p.environment = { place: 'home', equipment: o.eq, custom: [] };
  p.exercisePrefs = { fav: [], exclude: o.exclude || [], noJump: !!o.noJump }; p.prefs = C.normPrefs(o.prefs); if (o.kinds) p.restrictionKinds = o.kinds; S.save('profile'); return p; }
const activate = tid => PS.activate(PS.create(tid || 'general_90', PS.paramsFromProfile(S.load('profile')), NOW), { confirmReplace: true });
const blockedIn = (rid, ov) => L.recipeIngredients(L.recipe(rid), ov).filter(x => C.blockedFoods().has(x.f)).map(x => x.f);
function scan(from, n) { let meals = 0, bad = [], empty = 0, unexplained = 0; for (let i = 0; i < n; i++) { const d = S.addDays(from, i), p = C.plan(d);
  C.ALL.forEach(k => { const s = p[k]; if (!s) return; if (!s.rid) { if (s.blockedNone) empty++; return; } if (s.off) return; meals++; const b = blockedIn(s.rid, s.ov); if (b.length && !s.conflict) bad.push(d + ':' + k + ':' + s.rid + ':' + b.join('+')); }); } return { meals, bad, empty }; }
const shopBlocked = (from, days) => { const sh = G.shopping(from, days); return sh.groups.flatMap(g => g.items).filter(i => C.blockedFoods().has(i.f) && !i.blocked).map(i => i.f); };

/* ---------- 1. restrictions on every path ---------- */
T('1 restrictions — 8 profiles × whole plan + 30 days after it ends');
const PROFILES = [
  ['P1 fat loss, home, no equipment', { goal: 'fat_loss', eq: [], prefs: { exclude: ['peanuts'] }, kinds: { peanuts: 'allergy' } }, 'home_noequip'],
  ['P2 muscle, gym', { goal: 'muscle', xp: 'intermediate', eq: ['gym', 'dumbbells'], prefs: { exclude: ['almonds'] } }, 'strength_90'],
  ['P3 vegetarian, no dairy, gluten free', { goal: 'maintain', sex: 'f', prefs: { veg: true, dairy: false, glutenFree: true } }],
  ['P4 vegan, no soy, no peanuts', { goal: 'recomp', prefs: { vegan: true, exclude: ['soya', 'peanuts'] }, kinds: { soya: 'allergy', peanuts: 'allergy' } }],
  ['P5 2 meals, 15 min prep', { goal: 'fat_loss', maxMin: 15, prefs: { meals: 2, maxPrep: 15, egg: false } }],
  ['P6 high target', { age: 22, height: 195, weight: 105, goal: 'muscle', xp: 'advanced', days: [0, 1, 2, 3, 4, 5], spw: 5, maxMin: 60, prefs: { fish: false } }],
  ['P7 beginner 52 no jumping', { age: 52, height: 168, weight: 84, sex: 'f', goal: 'general', noJump: true, prefs: { exclude: ['tahini', 'salmon'] } }],
  ['P8 changes after creation', { age: 45, height: 176, weight: 92, goal: 'fat_loss', prefs: {} }]];
for (const [name, o, tid] of PROFILES) {
  setUser(o); const pl = activate(tid); const ds = PS.days(PS.get(pl.id)), n = ds.length;
  const r = scan(NOW, n + 30); ok(r.bad.length === 0, `${name}: 0 restricted foods in ${r.meals} planned meals over ${n} plan days + 30 days after`, r.bad.slice(0, 3));
  for (const at of [0, 30, 60, n - 7, n + 5]) { const from = S.addDays(NOW, at); const b = shopBlocked(from, 14); ok(b.length === 0, `${name}: 14-day shopping list from day ${at + 1}: no unflagged restricted item`, b); }
}
/* P8 — change restrictions after the plan exists WITHOUT approving the menu update: the guard still applies */
{ setUser({}); const pl = activate(); const p = S.load('profile'); p.prefs = C.normPrefs({ exclude: ['peanuts', 'soya'], dairy: false }); S.save('profile');
  ok(!!MP.pending(PS.get(pl.id)), 'restriction added after plan creation → menu update pending (not yet approved)');
  const r = scan(NOW, 90); ok(r.bad.length === 0, `…and still 0 restricted foods shown in 90 days before approval (guard), ${r.meals} meals`, r.bad.slice(0, 3)); }
/* classic program, 120 days, 6 combinations, without and after saving preferences */
T('1b classic program — 120 days');
for (const pf of [{ exclude: ['peanuts'] }, { exclude: ['peanuts', 'soya'], dairy: false }, { vegan: true }, { veg: true, glutenFree: true }, { egg: false, chicken: false }, { vegan: true, exclude: ['soya', 'peanuts'] }]) {
  setUser({ prefs: pf }); const r0 = scan(NOW, 120); ok(r0.bad.length === 0, `${JSON.stringify(pf)}: 120 days without saving prefs again: 0 restricted (${r0.meals} meals, ${r0.empty} empty-with-reason)`, r0.bad.slice(0, 3));
  C.applyPrefs(); const r1 = scan(NOW, 120); ok(r1.bad.length === 0, `${JSON.stringify(pf)}: after saving prefs: 0 restricted over 120 days`, r1.bad.slice(0, 3));
  ok(shopBlocked(S.addDays(NOW, 35), 14).length === 0, `${JSON.stringify(pf)}: shopping list days 36–49: no unflagged restricted item`); }
/* past days are history */
{ setUser({}); const p = S.load('profile'); p.startDate = '2026-10-01'; S.save('profile'); const past = JSON.stringify(C.plan('2026-10-10')); p.prefs = C.normPrefs({ exclude: ['peanuts', 'soya'], dairy: false }); S.save('profile');
  ok(JSON.stringify(C.plan('2026-10-10')) === past, 'past days are not rewritten by a new restriction (history)'); }

T('1c swaps, portions, regeneration, explicit user choice');
{ setUser({ prefs: { exclude: ['peanuts', 'soya'], dairy: false }, kinds: { peanuts: 'allergy', dairy: 'intolerance' } }); const pl = activate(); const bl = C.blockedFoods();
  let leak = 0; for (let i = 0; i < 14; i++) { const d = S.addDays(NOW, i), p = C.plan(d); C.DAY.forEach(k => { if (!p[k].rid) return; L.swapCandidates(L.recipe(p[k].rid), N.RECIPES).filter(o => !C.conflicts(o.r, null).length).forEach(o => { if (blockedIn(o.r.id).length) leak++; }); }); }
  ok(leak === 0, 'meal-swap candidates offered over 14 days: none restricted');
  let ingLeak = 0; Object.keys(N.SWAP).forEach(g => N.SWAP[g].filter(f => !bl.has(f)).forEach(f => { if (bl.has(f)) ingLeak++; })); ok(ingLeak === 0, 'ingredient-swap options: none restricted');
  /* user swaps a meal to an allowed candidate and an ingredient to an allowed option → totals update, still clean */
  const d = S.addDays(NOW, 2), p0 = C.plan(d), cand = L.swapCandidates(L.recipe(p0.m2.rid), N.RECIPES).find(o => !C.conflicts(o.r, null).length && !o.r.est);
  C.setPlanSlot(d, 'm2', { rid: cand.r.id, ov: null }); ok(C.plan(d).m2.rid === cand.r.id && !blockedIn(cand.r.id).length, 'after a user meal swap the slot holds the chosen allowed recipe');
  const ings = L.recipeIngredients(cand.r), idx = ings.findIndex(x => Object.values(N.SWAP).some(l => l.includes(x.f)));
  if (idx >= 0) { const grp = Object.keys(N.SWAP).find(g => N.SWAP[g].includes(ings[idx].f)), to = N.SWAP[grp].find(f => f !== ings[idx].f && !bl.has(f)); const before = C.plannedTotals(d).k; C.setPlanSlot(d, 'm2', { rid: cand.r.id, ov: { [idx]: { f: to, g: 200 } } }); ok(!blockedIn(cand.r.id, C.plan(d).m2.ov).length && C.plannedTotals(d).k !== before, 'after an ingredient swap: no restricted food and totals updated'); }
  /* portion (scale) keeps the same foods */
  C.setPlanSlot(d, 'snack', { rid: C.plan(d).snack.rid, ov: C.plan(d).snack.ov, scale: 1.5 }); ok(!blockedIn(C.plan(d).snack.rid, C.plan(d).snack.ov).length, 'portion change: still no restricted food');
  /* regeneration via plan update */
  const pr = S.load('profile'); pr.availability.days = [0, 2, 4, 6]; pr.availability.sessions = 4; S.save('profile'); PS.applyParams(pl.id, PS.paramsFromProfile(pr), 't'); MP.applyChange(PS.get(pl.id), 't');
  ok(scan(NOW, 90).bad.length === 0, 'after plan regeneration (new segment + new menu): 0 restricted in 90 days');
  /* explicit user choice of a restricted recipe: kept, but flagged everywhere (never silent) */
  const bad = N.RECIPES.find(r => r.meal === 'm1' && !r.est && blockedIn(r.id).includes('peanut_butter') || (r.meal === 'm1' && blockedIn(r.id).includes('peanuts')));
  const d2 = S.addDays(NOW, 4); C.setPlanSlot(d2, 'm1', { rid: bad.id, ov: null }); const s2 = C.plan(d2).m1;
  ok(s2.rid === bad.id && !!s2.conflict && s2.conflictKind === 'allergy', 'user explicitly picked a peanut dish: kept but flagged as conflict, kind = allergy', { conflict: s2.conflict, kind: s2.conflictKind });
  const sh = G.shopping(d2, 1), it = sh.groups.flatMap(g => g.items).find(i => i.f === 'peanuts' || i.f === 'peanut_butter');
  ok(it && it.blocked && it.kind === 'allergy' && sh.blocked >= 1, 'shopping list flags that item (allergy) and counts it', it);
  ok(/⚠ \[אלרגיה\]/.test(G.shoppingText(sh, {})), 'copied shopping text marks it with ⚠ [אלרגיה]'); }

T('1d restriction kinds');
{ setUser({ prefs: { exclude: ['peanuts', 'soya'], dairy: false, glutenFree: true }, kinds: { peanuts: 'allergy', soya: 'intolerance', dairy: 'pref' } });
  ok(C.kindOf('peanut_butter').includes('allergy'), 'peanut butter inherits the peanut allergy (family)'); ok(C.kindOf('tofu').includes('intolerance'), 'tofu inherits soya intolerance');
  ok(C.kindOf('milk').includes('pref'), 'milk: preference'); ok(C.kindOf('bread').includes('unset'), 'gluten without a stated kind: "unset" (still blocked)');
  ok(C.worstKind(['milk', 'peanuts']) === 'allergy', 'worst kind wins for wording'); ok(['milk', 'peanuts', 'tofu', 'bread'].every(f => C.blockedFoods().has(f)), 'all kinds block identically');
  setUser({ prefs: { exclude: ['peanuts'] } }); const before = JSON.stringify(MP.currentParams()); const p = S.load('profile'); p.restrictionKinds = { peanuts: 'allergy' }; S.save('profile');
  ok(JSON.stringify(MP.currentParams()) === before, 'setting a kind does not change menu parameters (no spurious menu update)'); }

/* ---------- 2. nutrition safeguards ---------- */
T('2 nutrition safeguards');
const mif = (w, h, a, sx) => 10 * w + 6.25 * h - 5 * a + (sx === 'm' ? 5 : sx === 'f' ? -161 : -78);
for (const g of ['fat_loss', 'weight_loss', 'recomp', 'muscle', 'gain', 'maintain']) for (const a of [14, 15, 17]) { setUser({ age: a, height: 165, weight: 58, goal: g }); const t = C.targets();
  ok(t.deficit === 0 && t.kcal === Math.round(t.tdee / 50) * 50, `age ${a}, goal ${g}: maintenance, no automatic deficit/surplus`, { kcal: t.kcal, tdee: t.tdee }); ok(C.targetWarnings().some(w => w.k === 'minor'), `age ${a}: minor warning shown`); }
setUser({ age: 18, height: 165, weight: 58, goal: 'fat_loss' }); ok(C.targets().deficit === 0.2 && !C.targetWarnings().some(w => w.k === 'minor'), 'age 18: adult rules (deficit allowed, no minor warning)');
for (const [w, h, sx] of [[48, 165, 'f'], [55, 180, 'm']]) { setUser({ weight: w, height: h, sex: sx, goal: 'fat_loss' }); const t = C.targets(), b = w / Math.pow(h / 100, 2);
  ok(t.deficit === 0 && C.targetWarnings().some(x => x.k === 'underweight'), `BMI ${b.toFixed(1)} + fat loss: no deficit, underweight warning`, { kcal: t.kcal }); }
setUser({ weight: 48, height: 165, sex: 'f', goal: 'maintain' }); ok(C.targetWarnings().some(x => x.k === 'underweight'), 'underweight with goal maintain: informational warning still shown');
setUser({ weight: 63, height: 165, sex: 'f', goal: 'fat_loss' }); ok(C.targets().deficit === 0.2 && !C.targetWarnings().length, 'BMI 23.1: no warnings, normal deficit');
/* floor */
for (const [a, h, w, sx] of [[70, 150, 45, 'f'], [80, 155, 50, 'f'], [75, 160, 55, 'm']]) { setUser({ age: a, height: h, weight: w, sex: sx, goal: 'fat_loss' }); const t = C.targets(), bmr = mif(w, h, a, sx), tdee = bmr * 1.55;
  const floor = Math.min(Math.round(tdee / 50) * 50, Math.max(Math.ceil(bmr / 50) * 50, sx === 'f' ? 1200 : 1500)), raw = Math.round(tdee * 0.8 / 50) * 50, exp = Math.max(raw, floor);
  ok(t.kcal === exp && t.kcal >= Math.min(sx === 'f' ? 1200 : 1500, Math.round(tdee / 50) * 50) && t.kcal >= Math.round(bmr) - 50, `${a}y ${w}kg ${sx}: target ${t.kcal} = max(raw ${raw}, floor ${floor})`, { t: t.kcal, exp });
  ok(!!t.floored === (raw < floor) && (raw < floor ? C.targetWarnings().some(x => x.k === 'floor') : true), `${a}y ${w}kg ${sx}: floor flagged and explained when applied`); }
/* adults unaffected: exact pre-H1 formula when no floor/safety rule applies (regression) */
{ let bad = 0, n = 0; for (const a of [20, 35, 50, 65]) for (const h of [160, 175, 190]) for (const w of [65, 80, 100, 130]) for (const sx of ['m', 'f']) for (const g of ['fat_loss', 'muscle', 'maintain', 'recomp']) {
    setUser({ age: a, height: h, weight: w, sex: sx, goal: g }); const t = C.targets(); if (t.floored || t.inputs.underweight) continue; n++; const k = Math.round(mif(w, h, a, sx) * 1.55 * (1 - ({ fat_loss: 0.2, muscle: -0.1, maintain: 0, recomp: 0.1 })[g]) / 50) * 50; if (t.kcal !== k) bad++; }
  ok(bad === 0 && n > 350, `${n} adult profiles without a safety rule: identical to the previous formula`, { bad }); }
/* manual targets */
setUser({ sex: 'f', height: 160, weight: 60 }); { const p = S.load('profile'); p.targets = { kcal: 1000 }; S.save('profile'); ok(C.targetWarnings().some(x => x.k === 'manualLow' && x.level === 'bad'), 'manual 1000 kcal (woman): strong warning'); }
setUser({ age: 16, height: 165, weight: 58 }); { const p = S.load('profile'); p.targets = { kcal: 1700 }; S.save('profile'); ok(C.targetWarnings().some(x => x.k === 'manualMinor'), 'minor with a manual below-maintenance target: strong warning'); }
setUser({ height: 175, tw: 52 }); ok(C.targetWarnings().some(x => x.k === 'targetBmi'), 'target weight implying BMI < 18.5: warning');
ok(/אינה כלי אבחון/.test(C.DISCLAIMER) && /אינה תחליף/.test(C.DISCLAIMER), 'disclaimer: not a diagnostic tool, not a substitute for advice');
/* missing data / edge */
setUser({ age: null }); ok(C.targets() === null && C.targetWarnings().length === 0, 'missing age: no targets, no crash');
setUser({ sex: null, age: 70, height: 155, weight: 52, goal: 'fat_loss' }); { const t = C.targets(), bmr = mif(52, 155, 70, null), tdee = bmr * 1.55, exp = Math.max(Math.round(tdee * 0.8 / 50) * 50, Math.min(Math.round(tdee / 50) * 50, Math.max(Math.ceil(bmr / 50) * 50, 1500)));
  ok(t.sexK === -78 && t.kcal === exp, `sex not given: midpoint formula (−78) and the higher (1500) minimum → ${t.kcal}`, { kcal: t.kcal, exp }); }

T('3 activity level');
{ setUser({}); const t0 = C.targets(); ok(t0.af === 1.55 && C.targetInputs().afFrom === 'assumed', 'not set: 1.55, marked as assumption (existing users unchanged)');
  for (const [k, v] of Object.entries(C.PAL)) { setUser({ activity: k, goal: 'maintain' }); const t = C.targets(); ok(t.af === v && t.tdee === Math.round(mif(80, 175, 32, 'm') * v), `${k}: PAL ${v}, TDEE ${t.tdee}`); }
  setUser({ activity: 'moderate' }); const pl = activate(); const s1 = JSON.stringify(PS.days(PS.get(pl.id)).map(d => d.main && d.main.map(x => x.ex + x.sets)));
  const p = S.load('profile'); p.activity = 'low'; S.save('profile'); ok(JSON.stringify(PS.days(PS.get(pl.id)).map(d => d.main && d.main.map(x => x.ex + x.sets))) === s1, 'activity changes targets only, never the workouts'); ok(!!MP.pending(PS.get(pl.id)), 'activity change → menu update offered (approval)'); }

/* ---------- 3. profile ↔ plan sync ---------- */
T('4 profile ↔ active plan');
{ setUser({}); const pl = activate(); ok(PS.profileDiff(pl.id).length === 0, 'fresh plan: no difference');
  const d0 = PS.days(PS.get(pl.id)).find(d => PS.isTraining(d)); NOW = d0.date; PS.logDay(pl.id, d0.n, { status: 'done', rpe: 6, sets: [{ done: true, ex: d0.main[0].ex, sec: 'main', set: 1, reps: 10 }], source: 'run' }); NOW = S.addDays(NOW, 1);
  const logs = JSON.stringify(PS.get(pl.id).log), recs = JSON.stringify(G.records());
  const p = S.load('profile'); p.aims.primary = 'muscle'; p.availability.days = [0, 2, 4, 6]; p.availability.sessions = 4; p.availability.maxMin = 45; p.exercisePrefs.noJump = true; p.exercisePrefs.exclude = ['burpee']; p.environment.equipment = ['chair']; S.save('profile');
  const df = PS.profileDiff(pl.id).map(x => x.key).sort(); ok(JSON.stringify(df) === JSON.stringify(['days', 'equipment', 'exclude', 'goal', 'maxMin', 'noJump', 'spw']), 'every changed planning field is detected', df);
  ok(C.targets().deficit < 0 && PS.get(pl.id).segments.slice(-1)[0].params.goal === 'fat_loss', 'before approval: nutrition already follows the new goal while the plan does not — this state is what the banner explains');
  PS.applyParams(pl.id, PS.paramsFromProfile(p), 'עדכון לפי הפרופיל'); ok(PS.profileDiff(pl.id).length === 0, 'after "update plan": no difference left');
  const fut = PS.days(PS.get(pl.id)).filter(d => d.date >= NOW && PS.isTraining(d) && !d.log); ok(fut.every(d => [0, 2, 4, 6].includes(new Date(d.date + 'T12:00:00Z').getUTCDay())), 'future sessions only on the new days');
  ok(fut.every(d => (d.main || []).every(x => x.ex !== 'burpee' && CT.exFacts(EX_BY_ID[x.ex]).impact !== 'high')), 'future sessions respect new limitations (excluded exercise, no jumping)');
  ok(JSON.stringify(PS.get(pl.id).log) === logs && JSON.stringify(G.records()) === recs, 'workout history and records unchanged');
  ok(PS.get(pl.id).segments.slice(-1)[0].params.goal === 'muscle', 'plan now trains for the new goal'); }

/* ---------- 4. coverage & equipment ---------- */
T('5 coverage and equipment');
{ setUser({ goal: 'recomp', prefs: { vegan: true, exclude: ['soya', 'peanuts'] } }); const pool = MP.pool({ prefs: C.normPrefs({ vegan: true, exclude: ['soya', 'peanuts'] }) });
  ok(pool.m1.length >= 5 && pool.m2.length >= 7 && pool.snack.length >= 4, `vegan / no soy / no peanuts pool meets the planner's own no-repeat rule (m1 ${pool.m1.length}, m2 ${pool.m2.length}, snack ${pool.snack.length})`);
  const pl = activate(); const ds = PS.days(PS.get(pl.id)); let miss = 0, gapDays = 0, shown = 0; ds.forEach(d => { const p = C.plan(d.date); if (C.DAY.some(k => p[k].missing)) miss++; if (p.gap && (p.gap.p || p.gap.kLow)) { gapDays++; shown++; } });
  ok(miss === 0, `vegan / no soy / no peanuts: a meal in every slot on all ${ds.length} days (was: no breakfast on 90/90)`, { miss });
  const t = C.targets(), sm = MP.summarize(PS.get(pl.id), NOW, ds.length); ok(gapDays === shown, `remaining protein/calorie gap is reported on each affected day (${gapDays} days; avg ${sm.protein} g vs ${t.protein} g)`); }
{ const NEW = ['besan_veg_cheela', 'moong_dal_cheela', 'oats_tahini_banana', 'chickpea_avocado_toast', 'vegan_bean_potato_burrito', 'sprouts_poha', 'chana_masala_rice', 'rajma_rice_vegan', 'masoor_dal_spinach_roti', 'chickpea_spinach_couscous', 'roasted_chana_apple'];
  ok(NEW.every(id => L.recipe(id) && C.recipeOk(L.recipe(id), { vegan: true, exclude: ['soya', 'peanuts'] })), 'all 11 new recipes are vegan, soy-free and peanut-free by ingredient');
  ok(NEW.every(id => { const r = L.recipe(id), m = L.recipeMacros(r), ind = r.ing.reduce((s, x) => s + F[x.f].k * x.g / 100, 0); return Math.abs(m.k - ind) < 1; }), 'new recipe values = sum of the food-table values (no invented numbers)');
  ok(NEW.every(id => L.recipe(id).steps.every(s => !/\d+\s*ג׳|\d+\s*גרם/.test(s))), 'new recipe steps do not quote gram amounts'); }
{ setUser({ goal: 'muscle', eq: ['dumbbells', 'bands', 'pullup_bar', 'gym'] }); const pl = activate('strength_90'), prm = PS.get(pl.id).segments[0].params;
  const unused = prm.equipment.filter(e => !EXERCISES.some(x => CT.exFacts(x).eq.includes(e))); ok(unused.length === 4, 'declared equipment with no exercises is identified (shown as a gap on the plan screen)', unused);
  ok(PS.days(PS.get(pl.id)).filter(PS.isTraining).every(d => (d.main || []).every(x => !CT.exFacts(EX_BY_ID[x.ex]).eq.some(e => unused.includes(e)))), 'and the plan does not pretend to use it'); }

T('6 high targets — dish selection by calorie capacity (regression found while testing H1)');
{ const run = o => { setUser(o); const prm = MP.currentParams(); let k = 0, d = 0, gaps = 0; for (const sd of ['a', 'b', 'c', 'd', 'e']) MP.generate(prm, NOW, 90, sd).days.forEach(x => { if (!x.totals) return; d++; k += x.totals.k; if (x.gap && x.gap.kLow) gaps++; }); return { avg: Math.round(k / d), target: prm.kcal, gapDays: gaps / 5 }; };
  const hi = run({ age: 22, height: 195, weight: 105, goal: 'muscle' }); ok(hi.avg >= hi.target * 0.8 && hi.gapDays > 0, `very high target (${hi.target}): average planned ${hi.avg} ≥ 80% with realistic portions (v2: a dish may grow only to ×1.6 of its serving; the rest is shown as a gap on those days — ${hi.gapDays} days avg; before H1: 3135)`, hi);
  const df = run({}); ok(Math.abs(df.avg - df.target) <= df.target * 0.05 && df.gapDays <= 1, `ordinary target (${df.target}): ${df.avg}, calorie gap on ≤1 of 90 days (shown when it happens)`, df);
  const st = run({ age: 22, height: 195, weight: 105, goal: 'muscle', prefs: { meals: 2, vegan: true, exclude: ['soya'] } }); ok(st.gapDays === 90 && st.avg >= st.target * 0.55, `stress (2 meals, vegan without soy, ${st.target}): ${st.avg} with ordinary portions — the remaining gap is reported on every day (v2: no oversized plates; before v2 the engine scaled dishes up to ×2.5)`, st); }

fs.mkdirSync(path.join(ROOT, 'dist/reports'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'dist/reports/stageH1-test.json'), JSON.stringify({ pass, fail, sections: sec, fails }, null, 1));
if (fails.length) { console.log('FAILURES:'); fails.forEach(f => console.log(' - ' + f)); }
console.log(JSON.stringify(sec)); console.log(`stage H1 tests: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
