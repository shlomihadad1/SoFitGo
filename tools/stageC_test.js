/* Stage C tests (Node): international recipes, daily menus for whole plans (7–365 days), nutrition math, preferences,
   swaps, eating log, target changes, plan switching/pausing, backup. Independent re-computation wherever possible.
   Writes dist/reports/stageC-test.json and dist/reports/stageC-data.json (30-day table, variety stats). */
const fs = require('fs'), path = require('path'); const ROOT = path.join(__dirname, '..');
for (const f of ['src/js/figure.js', 'src/data/exercises.js', 'src/data/workouts.js', 'src/data/nutrition.js', 'src/data/recipes_intl.js', 'src/data/catalog.js', 'src/data/programs.js', 'src/js/logic.js', 'src/js/planner.js', 'src/js/plans.js', 'src/js/mealplanner.js', 'src/js/store.js', 'src/js/core.js']) require(path.join(ROOT, f));
const { Store: S, Core: C, Plans: PS, MealPlan: MP, NUTRI: N, Logic: L, CATALOG: CT } = globalThis; const F = N.FOODS;
let pass = 0, fail = 0; const fails = [], sec = {}; let cur = '';
const T = n => { cur = n; sec[n] = { pass: 0, fail: 0 }; }, ok = (c, m) => { if (c) { pass++; sec[cur].pass++; } else { fail++; sec[cur].fail++; if (fails.length < 80) fails.push(cur + ': ' + m); } };
const REAL = S.today; let NOW = '2026-10-19'; S.today = () => NOW;
const sum = ings => ings.reduce((t, x) => { const f = F[x.f], k = x.g / 100; t.k += f.k * k; t.p += f.p * k; t.c += f.c * k; t.f += f.f * k; return t; }, { k: 0, p: 0, c: 0, f: 0 });
const ingsOf = s => { const r = N.RECIPES.find(x => x.id === s.rid); return r.ing.map((x, i) => (s.ov && s.ov[i]) ? Object.assign({}, x, s.ov[i]) : x).map(x => Object.assign({}, x, { g: x.g * (s.scale || 1) })); };
/* independent blocked-food computation (does not call Core) */
const G = { dairy: ['curd', 'hung_curd', 'milk', 'paneer', 'ghee', 'greek_yogurt', 'cottage', 'feta', 'mozzarella'], egg: ['egg', 'egg_white'], chicken: ['chicken_breast', 'chicken_thigh', 'chicken_mince'], fish: ['salmon', 'white_fish', 'tuna_can'], meat: ['beef_lean', 'turkey'] };
const FAM = { soya: ['soya', 'tofu', 'edamame', 'soy_milk', 'soy_sauce'], peanuts: ['peanuts', 'peanut_butter'] };
const blockedOf = p => { const b = new Set(); const v = p.veg || p.vegan; if (p.dairy === false || p.vegan) G.dairy.forEach(x => b.add(x)); if (p.egg === false || v) G.egg.forEach(x => b.add(x)); if (p.chicken === false || v) G.chicken.forEach(x => b.add(x)); if (p.fish === false || v) G.fish.forEach(x => b.add(x)); if (p.meat === false || v) G.meat.forEach(x => b.add(x)); (p.exclude || []).forEach(x => (FAM[x] || [x]).forEach(y => b.add(y))); return b; };
const setUser = (o) => { S.resetAll(); NOW = '2026-10-19'; const p = S.load('profile'); Object.assign(p, { age: 32, height: 187, weight: 85, startWeight: 85, sex: 'm', experience: 'beginner', aims: { primary: 'fat_loss', secondary: [] } }, o || {}); p.availability = { days: [1, 3, 5], sessions: 3, prefMin: null, maxMin: 30 }; S.save('profile'); return p; };
const activate = (tid, len, start) => PS.activate(PS.create(tid, PS.paramsFromProfile(S.load('profile')), start || NOW, len), { confirmReplace: true });
const datesOf = pl => { const ds = PS.days(pl); const out = []; for (let d = pl.start; d <= ds[ds.length - 1].date; d = S.addDays(d, 1)) out.push(d); return out; };

T('international recipes');
const intl = N.RECIPES.filter(r => r.intl), base = intl.filter(r => r.meal !== 'extra');
ok(base.length >= 60 || intl.length >= 60, `≥60 new international recipes (${intl.length} incl. ${intl.length - base.length} add-ons)`);
ok(N.RECIPES.filter(r => !r.intl).length === 70, 'the 70 existing recipes are kept');
ok(new Set(N.RECIPES.map(r => r.id)).size === N.RECIPES.length, 'recipe ids unique');
const cuis = {}; intl.forEach(r => { cuis[r.cuisine] = (cuis[r.cuisine] || 0) + 1; }); ok(Object.keys(cuis).length >= 8, 'at least 8 cuisines (' + Object.keys(cuis).join(', ') + ')');
for (const r of intl) {
  ok(r.he && r.en && r.desc && r.desc.length > 5, r.id + ': name and description'); ok(r.servings === 1 && r.calc === 'ingredients', r.id + ': one serving, values calculated from ingredients');
  ok(r.steps.length >= 1 && typeof r.prep === 'number' && typeof r.cook === 'number', r.id + ': steps and times');
  ok(r.ing.every(x => F[x.f] && x.g > 0 && ['raw', 'dry', 'ready'].includes(F[x.f].st)), r.id + ': ingredients exist, weight state stated');
  const a = L.recipeMacros(r), b = sum(r.ing); ok(Math.abs(a.k - b.k) <= 1 && Math.abs(a.p - b.p) <= 0.15 && Math.abs(a.c - b.c) <= 0.15 && Math.abs(a.f - b.f) <= 0.15, r.id + ': nutrition = sum of ingredients');
  const fs_ = r.ing.map(x => x.f), fx = CT.recipeFacts(r);
  ok(fx.diet.vegan === !fs_.some(x => [...G.dairy, ...G.egg, ...G.chicken, ...G.fish, ...G.meat].includes(x)), r.id + ': vegan flag from ingredients');
  if (r.tags.includes('vegan')) ok(fx.diet.vegan, r.id + ': tagged vegan is vegan');
  ok(fx.allergens.includes('fish') === fs_.some(x => G.fish.includes(x)) && fx.allergens.includes('soy') === fs_.some(x => FAM.soya.includes(x)) && fx.allergens.includes('peanut') === fs_.some(x => FAM.peanuts.includes(x)), r.id + ': fish/soy/peanut allergens');
  const st = r.steps.join(' '); for (const m of st.matchAll(/(\d+) ביצים/g)) ok(Math.abs(+m[1] - fs_.reduce((s, f, i) => s + (f === 'egg' ? r.ing[i].g : 0), 0) / 50) <= 0.51 || /ועוד \d+ ביצים שמהן/.test(st), r.id + ': egg count in steps matches');
  ok(!/(\d+)\s*ג׳\s*(שמן|אורז|פסטה|קינואה)/.test(st), r.id + ': steps refer to the ingredient list instead of quoting grams');
  ok(r.meal === 'extra' || L.swapCandidates(r, N.RECIPES).length >= 3, r.id + ': ≥3 swap options');
}
ok(Object.entries(F).filter(([, f]) => f.chk).every(([, f]) => ['x', 'y', 'a'].includes(f.chk)), 'every new food states how its values were checked');
const media = JSON.parse(fs.readFileSync(path.join(ROOT, 'MEDIA-MANIFEST.json'), 'utf8'));
ok(intl.every(r => ['photo', 'prep-video', 'steps'].every(k => media.items.some(i => i.id === `rc:${r.id}:${k}` && ['available', 'missing'].includes(i.status) && 'alt' in i))), 'media fields (photo, prep video, step photos, status) exist for every new recipe');
ok(media.items.filter(i => i.role === 'recipe-photo' && i.status === 'available').length === 0 || media.items.filter(i => i.role === 'recipe-photo' && i.status === 'available').every(i => i.source && i.license), 'no photo marked available without source and license');

T('full menu for every plan day');
const lengths = [['start_7'], ['habits_30'], ['general_60'], ['general_90'], ['progress_6m'], ['annual'], ['custom', 45]];
const varietyRows = []; let seedRobust = null;
for (const [tid, len] of lengths) {
  setUser(); const pl = activate(tid, len); const t = C.targets(); const dates = datesOf(pl);
  let missing = 0, notPlan = 0, extraCounted = 0, sumBad = 0, withinK = 0, protOk = 0, gapDays = 0, gapWrong = 0, capBad = 0, unitBad = 0;
  const seq = [];
  for (const d of dates) {
    const p = C.plan(d); if (p.source !== 'plan') notPlan++; if (['m1', 'm2', 'snack'].some(k => !p[k].rid)) missing++;
    const indep = sum(['m1', 'm2', 'snack'].flatMap(k => ingsOf(p[k]))), cb = C.plannedTotals(d, 'base');
    if (Math.abs(cb.k - indep.k) > 2 || Math.abs(cb.p - indep.p) > 0.3) sumBad++;
    if (Math.abs(C.plannedTotals(d, 'selected').k - cb.k) > 0.5) extraCounted++;
    if (Math.abs(indep.k - t.kcal) <= t.kcal * 0.07) withinK++; if (indep.p >= t.protein - 0.5) protOk++;
    const gp = p.gap && p.gap.p; if (gp) gapDays++; if (!!gp !== (indep.p < t.protein - 0.5) && Math.abs(indep.p - (t.protein - 0.5)) > 0.1) gapWrong++; /* 0.1 g rounding tolerance at the threshold */
    ['m1', 'm2', 'snack'].forEach(k => { const r = L.recipe(p[k].rid); ingsOf(p[k]).forEach((x, i) => { if (F[x.f].unit && x.g !== r.ing[i].g && !(p[k].ov && p[k].ov[i] && p[k].ov[i].f !== r.ing[i].f)) unitBad++; if (x.g > 500) capBad++; }); });
    seq.push(['m1', 'm2', 'snack'].map(k => p[k].rid));
  }
  const L_ = `${tid}${len ? ':' + len : ''}`;
  ok(dates.length >= (len || PS.stats(pl).total), `${L_}: menu dates cover the plan (${dates.length})`);
  ok(notPlan === 0 && missing === 0, `${L_}: every date has its own plan menu with 3 meals`);
  ok(sumBad === 0, `${L_}: planned totals = independent ingredient sums`);
  ok(extraCounted === 0, `${L_}: optional add-on not counted until selected`);
  ok(gapWrong === 0, `${L_}: protein gap flag matches the numbers (${gapDays} gap days)`);
  ok(unitBad === 0, `${L_}: eggs/slices/tortillas keep the recipe count (steps stay correct)`); ok(capBad === 0, `${L_}: no ingredient above 500 g in a serving`);
  let consec = 0; for (let i = 1; i < seq.length; i++) for (let k = 0; k < 3; k++) if (seq[i][k] === seq[i - 1][k]) consec++;
  ok(consec === 0, `${L_}: no meal repeated on consecutive days`);
  let week = 0; for (let i = 0; i + 7 <= seq.length; i += 7) { const m2 = new Set(seq.slice(i, i + 7).map(x => x[1])); if (m2.size < 6) week++; }
  ok(week === 0, `${L_}: ≥6 different main meals in every 7 days`);
  const all = seq.flat(), cnt = {}; all.forEach(id => { cnt[id] = (cnt[id] || 0) + 1; });
  varietyRows.push({ plan: L_, days: dates.length, distinct: Object.keys(cnt).length, maxUses: Math.max(...Object.values(cnt)), meanUses: +(all.length / Object.keys(cnt).length).toFixed(1), intlShare: +(all.filter(id => L.recipe(id).intl).length / all.length).toFixed(2), withinKcal7pct: withinK, proteinMet: protOk, gapDays, consecutiveRepeats: consec, cuisines: new Set(all.map(id => L.recipe(id).cuisine || 'indian')).size });
  ok(protOk / dates.length >= 0.95, `${L_}: protein target met on ≥95% of days (${protOk}/${dates.length})`);
  ok(withinK / dates.length >= 0.85, `${L_}: calories within ±7% on ≥85% of days (${withinK}/${dates.length})`);
}
ok(varietyRows.find(r => r.plan === 'annual').distinct >= 80, 'annual plan uses ≥80 different dishes');
/* menus are seeded by the (random) plan id — the quality bar must hold for any seed, not just the one this run drew */
setUser(); { const prm = MP.currentParams(), t = C.targets(); let worstK = 30, worstP = 30;
  for (let s = 0; s < 60; s++) { const g = MP.generate(prm, NOW, 30, 'robust' + s); worstK = Math.min(worstK, g.days.filter(d => Math.abs(d.totals.k - t.kcal) <= t.kcal * 0.07).length); worstP = Math.min(worstP, g.days.filter(d => d.totals.p >= t.protein - 0.5).length); }
  seedRobust = { seeds: 60, worstKcalWithin7pct: worstK, worstProteinMet: worstP };
  ok(worstK >= 26 && worstP >= 29, `60 different seeds: worst 30-day menu still has calories within ±7% on ${worstK}/30 days and protein met on ${worstP}/30`); }

T('different targets per user'); const targetRows = [];
for (const [o, lbl] of [[{ weight: 62, height: 165, age: 28, sex: 'f', aims: { primary: 'fat_loss', secondary: [] } }, 'smaller woman, fat loss'], [{ weight: 95, height: 190, age: 25, sex: 'm', aims: { primary: 'muscle', secondary: [] } }, 'larger man, muscle']]) {
  setUser(o); const pl = activate('habits_30'); const t = C.targets(); const ds = datesOf(pl); const tots = ds.map(d => C.plannedTotals(d, 'base'));
  const avgK = tots.reduce((s, x) => s + x.k, 0) / tots.length, avgP = tots.reduce((s, x) => s + x.p, 0) / tots.length;
  const short = ds.filter((d, i) => tots[i].k < t.kcal * 0.93), flagged = short.filter(d => C.plan(d).gap && C.plan(d).gap.kLow);
  ok(Math.abs(avgK - t.kcal) / t.kcal <= 0.06 || flagged.length === short.length, `${lbl}: average planned ${Math.round(avgK)} kcal vs target ${t.kcal}; every day under 93% is flagged as a gap (${flagged.length}/${short.length})`);
  targetRows.push({ profile: lbl, kcalTarget: t.kcal, proteinTarget: t.protein, avgKcal: Math.round(avgK), avgProtein: Math.round(avgP), daysUnder93pct: short.length, days: ds.length });
  ok(avgP >= t.protein - 1, `${lbl}: average protein ${avgP.toFixed(0)} vs target ${t.protein}`);
}

T('preferences across whole plans');
const combos = [{ vegan: true }, { veg: true }, { dairy: false }, { egg: false }, { chicken: false }, { fish: false }, { exclude: ['soya'] }, { exclude: ['peanuts'] }, { veg: true, exclude: ['soya'] }, { vegan: true, exclude: ['soya', 'peanuts'] }, { dairy: false, egg: false }, { fish: false, chicken: false, meat: false }, { vegan: true, exclude: ['peanuts'] }, { meals: 2 }, { maxPrep: 15 }, { dairy: false, exclude: ['soya'] }];
const prefRows = [];
for (const c of combos) {
  setUser({ prefs: C.normPrefs(c) }); const pl = activate('general_90'); const ds = datesOf(pl); const bl = blockedOf(c); const t = C.targets();
  let bad = 0, missing = 0, gaps = 0, off = 0; const ids = new Set(); let pMin = 1e9, kMin = 1e9, kMax = 0;
  for (const d of ds) { const p = C.plan(d); ['m1', 'm2', 'snack', 'extra'].forEach(k => { if (p[k].missing || p[k].off) { if (p[k].missing) missing++; if (p[k].off) off++; return; } if (ingsOf(p[k]).some(x => bl.has(x.f))) bad++; if (k !== 'extra') ids.add(p[k].rid); });
    const bt = C.plannedTotals(d, 'base'); pMin = Math.min(pMin, bt.p); kMin = Math.min(kMin, bt.k); kMax = Math.max(kMax, bt.k); if (p.gap && (p.gap.p || p.gap.kLow)) gaps++; }
  const L_ = JSON.stringify(c);
  ok(bad === 0, `${L_}: no meal with an excluded food anywhere in the 90-day menu`);
  if (c.meals === 2) ok(off === ds.length, `${L_}: snack switched off on every day`);
  const pool = MP.pool(Object.assign(MP.currentParams(), { prefs: C.normPrefs(c) }));
  if (['m1', 'm2', 'snack'].some(k => !pool[k].length)) ok(missing > 0, `${L_}: empty pool → slot left empty and reported (not filled with a non-matching dish)`);
  prefRows.push({ prefs: c, days: ds.length, distinctMeals: ids.size, missingSlots: missing, gapDays: gaps, proteinMin: Math.round(pMin), kcalRange: [Math.round(kMin), Math.round(kMax)], target: [t.kcal, t.protein], poolSizes: { m1: pool.m1.length, m2: pool.m2.length, snack: pool.snack.length } });
}

T('swaps and eating log');
setUser(); { const pl = activate('habits_30'); const d0 = S.today(), d1 = S.addDays(d0, 1), d2 = S.addDays(d0, 2);
  const before1 = JSON.stringify(C.plan(d1)), before2 = JSON.stringify(C.plan(d2));
  const alt = L.swapCandidates(L.recipe(C.plan(d1).m2.rid), N.RECIPES).filter(o => !C.conflicts(o.r, null).length)[0].r.id;
  C.setPlanSlot(d1, 'm2', { rid: alt, ov: null, scale: 1 }); ok(C.plan(d1).m2.rid === alt && JSON.stringify(C.plan(d2)) === before2, 'meal swap changes only that meal on that date');
  const s0 = C.plan(d2).m1, r0 = L.recipe(s0.rid), idx = r0.ing.findIndex(x => ['protein', 'legume', 'dairy'].includes(F[x.f].grp)); const sub = (N.SWAP.protein.concat(N.SWAP.legume)).find(f => f !== r0.ing[idx].f && !C.blockedFoods().has(f));
  const ov = Object.assign({}, s0.ov || {}, { [idx]: { f: sub, g: 100 } }); C.setPlanSlot(d2, 'm1', { rid: s0.rid, ov }); ok(ingsOf(C.plan(d2).m1)[idx].f === sub && Math.abs(C.slotMacros(C.plan(d2).m1).k - sum(ingsOf(C.plan(d2).m1)).k) <= 1, 'ingredient swap recalculated');
  C.setPlanSlot(d2, 'snack', { rid: C.plan(d2).snack.rid, ov: C.plan(d2).snack.ov, scale: 1.5 }); ok(Math.abs(C.slotMacros(C.plan(d2).snack).k - sum(ingsOf(C.plan(d2).snack)).k) <= 1, 'portion size change recalculated');
  C.eatSlot(d0, 'm1', 1); const eaten = JSON.stringify(C.entries(d0));
  const alt0 = L.swapCandidates(L.recipe(C.plan(d0).m1.rid), N.RECIPES).filter(o => !C.conflicts(o.r, null).length)[0].r.id; C.setPlanSlot(d0, 'm1', { rid: alt0, ov: null, scale: 1 });
  ok(JSON.stringify(C.entries(d0)) === eaten, 'swapping a meal after eating does not change the eating log');
  // target change → pending → apply from first open date (today has an eaten meal → tomorrow)
  const p = S.load('profile'); const oldT = C.targets().kcal; const menuToday = JSON.stringify(C.plan(d0)), menu3 = JSON.stringify(C.plan(S.addDays(d0, 3)));
  p.weight = 75; S.save('profile'); ok(C.targets().kcal !== oldT, 'target changed with the profile');
  ok(!!MP.pending(PS.active()) && JSON.stringify(C.plan(S.addDays(d0, 3))) === menu3, 'target change does not alter the menu until approved');
  const pv = MP.previewChange(PS.active()); ok(pv.fromDate === d1 && pv.after.kcal < pv.before.kcal, `preview: from ${pv.fromDate}, avg kcal ${pv.before.kcal} → ${pv.after.kcal}`);
  MP.applyChange(PS.active()); ok(JSON.stringify(C.plan(d0)) === menuToday && JSON.stringify(C.entries(d0)) === eaten, 'today (already eaten from) and its log unchanged after the update');
  ok(JSON.stringify(C.plan(S.addDays(d0, 3))) !== menu3 && !MP.pending(PS.active()), 'future menus recalculated after approval');
  // time passes, pause → menus of past dates keep their meals; log kept
  NOW = S.addDays(d0, 4); const past = JSON.stringify(C.plan(d1).m2); PS.pause(pl.id); NOW = S.addDays(d0, 9); PS.resume(pl.id);
  ok(JSON.stringify(C.plan(d1).m2) === past && JSON.stringify(C.entries(d0)) === eaten, 'pause/resume: past menus and eating log unchanged');
  const last = datesOf(PS.get(pl.id)).pop(); ok(C.plan(last).source === 'plan', 'pause extends the menu to the new end date');
  // switch plan
  const np = activate('fatloss_30'); ok(C.plan(d1).source === 'plan' && C.plan(d1).planId === pl.id && JSON.stringify(C.plan(d1).m2) === past, 'after switching, earlier dates keep the old plan menu');
  ok(C.plan(NOW).planId === np.id, 'new plan menu from its start date'); ok(JSON.stringify(C.entries(d0)) === eaten, 'eating log kept after switching');
  PS.cancel(np.id); ok(C.plan(d1).planId === pl.id, 'after cancelling, history menus remain'); }
// regression (found by e2e): switching to a plan that starts tomorrow must not leave today on the classic menu
setUser({ prefs: C.normPrefs({ vegan: true, exclude: ['soya'] }) }); { const a = activate('general_90'); const b = activate('fatloss_30', null, S.addDays(NOW, 1));
  ok(C.plan(NOW).source === 'plan' && C.plan(NOW).planId === a.id, 'switch to a plan starting tomorrow: today keeps the previous plan menu');
  ok(C.plan(S.addDays(NOW, 1)).planId === b.id, 'the new plan menu starts on its own start date');
  ok(C.plan(S.addDays(NOW, 2)).planId === b.id && !datesOf(PS.get(a.id)).slice(2).some(d => C.plan(d).planId === a.id), 'the replaced plan does not cover dates after the new plan starts');
  const bad = ['m1', 'm2', 'snack', 'extra'].filter(k => { const s = C.plan(NOW)[k]; return s.rid && !s.missing && !s.off && C.conflicts(L.recipe(s.rid), s.ov).length; });
  ok(!bad.length, 'today\'s menu still respects vegan + no soy after the switch', bad); }

T('backup & restore');
setUser(); { activate('general_60'); const ex = S.exportAll(); ok(!!ex.plans.list[ex.plans.active].nutrition, 'backup contains the plan menu settings');
  const js = JSON.stringify(ex); const snap = JSON.stringify(Array.from({ length: 10 }, (_, i) => C.plan(S.addDays(NOW, i))));
  S.resetAll(); S.importAll(JSON.parse(js)); ok(JSON.stringify(Array.from({ length: 10 }, (_, i) => C.plan(S.addDays(NOW, i)))) === snap, 'restored plan produces the same menus');
  const old = JSON.parse(js); delete old.plans.list[old.plans.active].nutrition; S.resetAll(); S.importAll(old); ok(C.plan(NOW).source === 'plan' && !!PS.active().nutrition, 'plan from an older backup gets menu settings on first use'); }

T('classic program unchanged');
setUser(); { const s = S.load('profile'); s.startDate = NOW; S.save('profile');
  for (let i = 0; i < 30; i++) { const d = S.addDays(NOW, i), p = C.plan(d); ok(p.source === 'classic' && p.m1.rid === N.MENU[i][0] && p.m2.rid === N.MENU[i][1] && p.snack.rid === N.MENU[i][2], 'day ' + (i + 1) + ' uses the fixed 30-day menu without a personal plan'); } }

/* data for the report: 30-day table for the default profile */
setUser(); const plR = activate('habits_30'); const tR = C.targets(); const table = datesOf(plR).slice(0, 30).map((d, i) => { const p = C.plan(d), slot = k => ({ id: p[k].rid, he: L.recipe(p[k].rid).he, k: Math.round(C.slotMacros(p[k]).k), p: C.slotMacros(p[k]).p }), b = C.plannedTotals(d, 'base'), w = C.plannedTotals(d, 'withExtra');
  return { day: i + 1, date: d, m1: slot('m1'), m2: slot('m2'), snack: slot('snack'), extra: slot('extra'), base: { k: b.k, p: b.p, c: b.c, f: b.f }, withExtra: { k: w.k, p: w.p }, gap: p.gap || null }; });
S.today = REAL;
fs.mkdirSync(path.join(ROOT, 'dist/reports'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'dist/reports/stageC-test.json'), JSON.stringify({ pass, fail, sections: sec, fails }, null, 1));
fs.writeFileSync(path.join(ROOT, 'dist/reports/stageC-data.json'), JSON.stringify({ targets: { kcal: tR.kcal, protein: tR.protein, carbs: tR.carbs, fat: tR.fat }, table, variety: varietyRows, targetsByProfile: targetRows, prefs: prefRows, cuisines: cuis, intlCount: intl.length, seedRobust }, null, 1));
console.log(JSON.stringify(sec)); if (fails.length) console.log('FAILURES:\n' + fails.join('\n')); console.log(`stage C tests: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
