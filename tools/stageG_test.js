/* Stage G tests (Node, simulated clock): Explain My Plan, Weekly Review, Shopping list & meal prep, Records & milestones,
   Travel mode. Expected values are recomputed independently from the stored data. Writes dist/reports/stageG-test.json. */
const fs = require('fs'), path = require('path'); const ROOT = path.join(__dirname, '..');
for (const f of ['src/js/figure.js', 'src/data/exercises.js', 'src/data/workouts.js', 'src/data/nutrition.js', 'src/data/recipes_intl.js', 'src/data/catalog.js', 'src/data/programs.js', 'src/js/logic.js', 'src/js/planner.js', 'src/js/plans.js', 'src/js/mealplanner.js', 'src/js/store.js', 'src/js/core.js', 'src/js/insights.js', 'src/js/adapt.js', 'src/js/signature.js']) require(path.join(ROOT, f));
const { Store: S, Core: C, Plans: PS, Signature: G, NUTRI: N, Logic: L, CATALOG: CT } = globalThis; const F = N.FOODS;
let pass = 0, fail = 0; const fails = [], sec = {}; let cur = '';
const T = n => { cur = n; sec[n] = { pass: 0, fail: 0 }; }, ok = (c, m, info) => { if (c) { pass++; sec[cur].pass++; } else { fail++; sec[cur].fail++; if (fails.length < 80) fails.push(cur + ': ' + m + (info !== undefined ? ' → ' + JSON.stringify(info).slice(0, 300) : '')); } };
let NOW = '2026-10-19'; S.today = () => NOW;
const setUser = (o, env) => { S.resetAll(); NOW = '2026-10-19'; const p = S.load('profile'); Object.assign(p, { age: 32, height: 187, weight: 85, startWeight: 85, sex: 'm', experience: 'beginner', aims: { primary: 'fat_loss', secondary: [] } }, o || {}); p.availability = { days: [1, 3, 5], sessions: 3, prefMin: null, maxMin: 30 }; if (env) p.environment = { equipment: env }; S.save('profile'); return p; };
const activate = tid => PS.activate(PS.create(tid, PS.paramsFromProfile(S.load('profile')), NOW), { confirmReplace: true });
const tr = pl => PS.days(PS.get(pl.id)).filter(d => PS.isTraining(d) && d.type !== 'assess' && d.type !== 'active');
const logFull = (pl, d, extra) => { NOW = d.date; const dd = PS.dayOf(PS.get(pl.id), d.n), sets = []; (dd.main || []).forEach(it => { for (let k = 1; k <= (it.sets || 1); k++) { const r = { done: true, ex: it.ex, sec: 'main', set: k }; if (typeof it.reps === 'number') r.reps = it.reps + ((extra && extra.plus) || 0); else r.secs = typeof it.sec === 'number' ? it.sec : 30; sets.push(r); } });
  PS.logDay(pl.id, d.n, Object.assign({ status: 'done', rpe: 6, durationSec: 1500, sets, source: 'run' }, extra && extra.data)); };

T('G1 explain my plan');
setUser(); ok(G.explain() === null, 'no plan → nothing to explain (no generic text)');
{ const pl = activate('general_90'), ex = G.explain(), k = ex.map(s => s.k);
  ok(['template', 'phases', 'schedule', 'exercises', 'targets', 'menu', 'adapt'].every(x => k.includes(x)), 'all explanation sections present', k);
  const p = S.load('profile'), bmr = Math.round(10 * p.weight + 6.25 * p.height - 5 * p.age + 5), tdee = Math.round((10 * p.weight + 6.25 * p.height - 5 * p.age + 5) * 1.55), kcal = Math.round((10 * p.weight + 6.25 * p.height - 5 * p.age + 5) * 1.55 * 0.8 / 50) * 50;
  const tx = ex.find(s => s.k === 'targets').items.join(' ');
  ok(tx.includes(String(bmr)) && tx.includes(String(tdee)) && tx.includes(String(kcal)) && tx.includes(String(Math.round(p.weight * 1.8 / 5) * 5)), 'targets explanation shows the real formula numbers (independently recomputed)', { bmr, tdee, kcal });
  const sessions = PS.days(pl).filter(PS.isTraining).length, sx = ex.find(s => s.k === 'schedule').items.join(' ');
  ok(sx.includes(`${sessions} אימונים`), `schedule explanation uses the real session count (${sessions})`);
  const exs = new Set(PS.days(pl).filter(PS.isTraining).flatMap(d => (d.main || []).map(it => it.ex))).size; ok(ex.find(s => s.k === 'exercises').items[0].startsWith(String(exs)), `exercise count matches the plan (${exs})`);
  ok(ex.find(s => s.k === 'phases').items.length >= PS.preview(pl).summary.phases.length, 'one line per plan phase');
  const pr = S.load('profile'); pr.targets = { kcal: 2000 }; S.save('profile'); ok(/שינית ידנית/.test(G.explain().find(s => s.k === 'targets').items.join(' ')), 'manually edited targets are reported as such'); }

T('G2 weekly review');
setUser(); { const pl = activate('general_90'), t = tr(pl);
  ok(G.review().w === 1 && G.review().current, 'first week: review of the current week, marked as in progress');
  const w1 = t.filter(d => d.week === 1); logFull(pl, w1[0]); if (w1[1]) { NOW = w1[1].date; PS.logDay(pl.id, w1[1].n, { status: 'partial', rpe: 8, durationSec: 900, sets: [], source: 'manual' }); }
  NOW = '2026-10-20'; C.eatSlot('2026-10-20', 'm1', 1); C.eatSlot('2026-10-20', 'm2', 1);
  const dl = S.load('tracking'); dl.daily['2026-10-20'] = { steps: 8000, sleep: 7 }; dl.daily['2026-10-21'] = { steps: 10000 }; S.save('tracking');
  NOW = S.addDays(w1[w1.length - 1].date, 7); const r = G.review(pl, 1), wdays = PS.days(PS.get(pl.id)).filter(d => d.week === 1 && PS.isTraining(d));
  ok(r.training.done === wdays.filter(d => d.status === 'done').length && r.training.partial === wdays.filter(d => d.status === 'partial').length, 'training counts = plan days of that week');
  ok(r.training.minutes === Math.round((1500 + (w1[1] ? 900 : 0)) / 60), 'minutes = measured durations only');
  const e = C.eatenTotals('2026-10-20'); ok(r.nutrition.daysLogged === 1 && r.nutrition.kcal === Math.round(e.k), 'nutrition average uses only days with logged meals (1 day, not ÷7)', r.nutrition);
  ok(r.tracking.steps.avg === 9000 && r.tracking.steps.days === 2 && r.tracking.sleep.days === 1, 'steps/sleep averages over days that have values');
  ok(r.weight === null, 'no weigh-in → no weight claim');
  const m = S.load('tracking'); m.measures.push({ id: 'x', date: '2026-10-21', weight: 84.4 }); S.save('tracking'); ok(G.review(pl, 1).weight.last === 84.4, 'weigh-in inside the week reported');
  ok(G.review(pl, 1).next && G.review(pl, 1).next.w === 2, 'next-week preview present'); }

T('G3 shopping list & meal prep');
setUser(); { const pl = activate('general_90'); C.eatSlot(NOW, 'm1', 1); C.setExtraOn(S.addDays(NOW, 1), true);
  const sh = G.shopping(NOW, 7), exp = {};
  for (let i = 0; i < 7; i++) { const d = S.addDays(NOW, i), p = C.plan(d); ['m1', 'm2', 'snack', 'extra'].forEach(k => { const s = p[k]; if (!s.rid || s.off || s.missing || (k === 'extra' && !s.on) || C.slotEntry(d, k)) return; const r = L.recipe(s.rid); if (r.est) return; L.recipeIngredients(r, s.ov).forEach(x => { exp[x.f] = (exp[x.f] || 0) + x.g * (s.scale || 1); }); }); }
  const got = {}; sh.groups.forEach(g => g.items.forEach(i => { got[i.f] = i.g; }));
  ok(Object.keys(exp).length === Object.keys(got).length && Object.keys(exp).every(f => Math.abs(Math.round(exp[f]) - got[f]) <= 1), `every ingredient total = independent sum over the planned slots (${Object.keys(got).length} items)`);
  ok(!sh.groups.some(g => g.items.some(i => F[i.f].grp !== g.k)), 'items grouped by food group');
  const eg = sh.groups.flatMap(g => g.items).find(i => F[i.f].unit); ok(!eg || eg.units === Math.ceil(eg.g / F[eg.f].unit - 0.05), 'unit foods shown as whole units');
  const eatenRid = C.plan(NOW).m1.rid; const without = G.shopping(NOW, 1); const m1ings = new Set(L.recipeIngredients(L.recipe(eatenRid), C.plan(NOW).m1.ov).map(x => x.f)), otherIngs = new Set(['m2', 'snack'].filter(k => C.plan(NOW)[k].rid && !C.plan(NOW)[k].missing).flatMap(k => L.recipeIngredients(L.recipe(C.plan(NOW)[k].rid), C.plan(NOW)[k].ov).map(x => x.f)));
  ok(without.recipeCount === ['m2', 'snack'].filter(k => C.plan(NOW)[k].rid && !C.plan(NOW)[k].missing).length && [...m1ings].filter(f => !otherIngs.has(f)).every(f => !without.groups.some(g => g.items.some(i => i.f === f))), 'already-eaten meal (and its own ingredients) is not on the list');
  ok(sh.batch.every(b => b.g === got[b.f] && b.meals >= 2 && ['raw', 'dry'].includes(F[b.f].st)), 'batch-cook suggestions = list totals of raw/dry bases used in ≥2 meals');
  G.toggleCheck(Object.keys(got)[0], true); ok(!!G.shoppingChecks().checked[Object.keys(got)[0]], 'checked items are saved'); const bk = S.exportAll(); S.resetAll(); S.importAll(JSON.parse(JSON.stringify(bk))); ok(!!G.shoppingChecks().checked[Object.keys(got)[0]], 'checks survive backup & restore');
  const txt = G.shoppingText(sh, {}); ok(sh.groups.every(g => g.items.every(i => txt.includes(i.he))), 'copied text contains every item');
  setUser({ prefs: C.normPrefs({ vegan: true }) }); activate('general_90'); const vg = G.shopping(NOW, 14), animal = ['chicken_breast', 'chicken_thigh', 'chicken_mince', 'egg', 'egg_white', 'curd', 'milk', 'paneer', 'ghee', 'greek_yogurt', 'cottage', 'feta', 'mozzarella', 'salmon', 'white_fish', 'tuna_can', 'beef_lean', 'turkey', 'hung_curd'];
  ok(!vg.groups.some(g => g.items.some(i => animal.includes(i.f))), 'vegan user: no animal products on a 14-day list'); }

T('G4 records & milestones');
setUser(); { ok(G.records().length === 0 && G.milestones().length === 0, 'no data → no records, no milestones'); const pl = activate('general_90'), t = tr(pl);
  logFull(pl, t[0]); logFull(pl, t[1], { plus: 2 }); NOW = S.addDays(t[1].date, 1);
  const rec = G.records(), exp = {}; [t[0], t[1]].forEach(d => { const lg = PS.get(pl.id).log[d.n], lv = {}; lg.snapshot.main.forEach(it => { lv[it.ex] = lv[it.ex] || it.lvl || 'normal'; }); lg.sets.forEach(s => { const v = s.reps != null ? s.reps : s.secs, k = s.ex + '|' + lv[s.ex] + '|' + (s.reps != null ? 'reps' : 'sec'); exp[k] = Math.max(exp[k] || 0, v); }); });
  ok(rec.length === Object.keys(exp).length && rec.every(r => exp[r.ex + '|' + r.lvl + '|' + r.unit] === r.v), `records = best set per exercise+level (${rec.length})`);
  const w = S.load('workouts'); w.days[3] = { status: 'done', date: '2026-10-10', sets: [{ done: true, sec: 'main', ex: 'squat', set: 1, reps: 40 }] }; S.save('workouts');
  ok(G.records().some(r => r.ex === 'squat' && r.lvl === null && r.v === 40), 'classic-program log kept as its own record (level unknown), not merged with plan levels');
  const ms = G.milestones(); ok(ms.some(m => m.k === 'sessions1' && m.date === '2026-10-10'), 'first-session milestone dated from the earliest log');
  ok(!ms.some(m => m.k === 'sessions5'), 'no "5 sessions" milestone with 3 logs');
  ok(!ms.some(m => m.k === 'min60'), '50 measured minutes → no "1 hour" milestone yet', ms.map(m => m.k));
  logFull(pl, t[2]); NOW = S.addDays(t[2].date, 1); ok(G.milestones().some(m => m.k === 'min60' && m.date === t[2].date), 'third 25-min session → 1-hour milestone dated on the day it was reached'); }

T('G5 travel mode');
setUser({}, ['chair', 'table', 'bench', 'step', 'wall', 'doorframe', 'towel']); { const pl = activate('general_90'); const from = NOW, to = S.addDays(NOW, 13);
  const before = JSON.stringify(PS.days(PS.get(pl.id)).map(d => [d.n, (d.main || []).map(it => it.ex), d.version]));
  const pv = G.Travel.preview(pl, from, to, { short: true });
  const inRange = PS.days(PS.get(pl.id)).filter(d => PS.isTraining(d) && d.date >= from && d.date <= to), needs = inRange.flatMap(d => (d.main || []).filter(it => !CT.usableWith(EX_BY_ID[it.ex], ['none'])).map(it => d.n + ':' + it.ex));
  ok(pv.changes.length + pv.stuck.length === needs.length, `every equipment exercise in range is either replaced or reported (${needs.length})`);
  ok(pv.changes.every(c => CT.usableWith(EX_BY_ID[c.to], ['none'])), 'every replacement needs no equipment');
  ok(pv.changes.every(c => c.date >= from && c.date <= to), 'only days inside the range');
  ok(JSON.stringify(PS.days(PS.get(pl.id)).map(d => [d.n, (d.main || []).map(it => it.ex), d.version])) === before, 'preview changes nothing');
  const rec = G.Travel.apply(pv); const after = PS.days(PS.get(pl.id));
  ok(after.filter(d => d.date >= from && d.date <= to && PS.isTraining(d)).every(d => (d.main || []).every(it => CT.usableWith(EX_BY_ID[it.ex], ['none']) || pv.stuck.some(s => s.n === d.n && s.ex === it.ex))), 'after apply: days in range use no equipment (except reported ones)');
  ok(JSON.stringify(after.filter(d => d.date > to).map(d => [d.n, (d.main || []).map(it => it.ex)])) === JSON.stringify(JSON.parse(before).filter(x => PS.dayOf(PS.get(pl.id), x[0]).date > to).map(x => [x[0], x[1]])), 'days after the range unchanged');
  ok(pv.shortDays.every(n => PS.dayOf(PS.get(pl.id), n).version === 'short'), 'optional short version applied in range');
  const d0 = after.find(d => d.date >= from && PS.isTraining(d) && d.type !== 'assess'); logFull(pl, d0); const snap = JSON.stringify(PS.get(pl.id).log[d0.n].snapshot.main); NOW = S.addDays(d0.date, 1);
  const rv = G.Travel.revert(rec.id); ok(JSON.stringify(PS.get(pl.id).log[d0.n].snapshot.main) === snap && (rv.kept.includes(d0.n) || !pv.changes.some(c => c.n === d0.n)), 'undo keeps the logged travel workout as done');
  ok(JSON.stringify(PS.days(PS.get(pl.id)).filter(d => !d.log && d.date >= NOW).map(d => [d.n, (d.main || []).map(it => it.ex), d.version])) === JSON.stringify(JSON.parse(before).filter(x => { const dd = PS.dayOf(PS.get(pl.id), x[0]); return !dd.log && dd.date >= NOW; })), 'undo restores every future day exactly');
  ok((() => { try { G.Travel.preview(pl, S.addDays(NOW, -2), NOW); return false; } catch (e) { return true; } })() && (() => { try { G.Travel.preview(pl, NOW, S.addDays(NOW, 40)); return false; } catch (e) { return true; } })(), 'range validation: no past start, max 4 weeks');
  ok(PS.get(pl.id).changes.some(c => c.type === 'travel') && PS.get(pl.id).changes.some(c => c.type === 'travel-revert'), 'plan change log records travel mode on/off'); }

T('open requirement closed: gluten-free preference (P07)');
setUser(); { const pl = activate('general_90'); ok(!globalThis.MealPlan.pending(PS.get(pl.id)), 'existing plan: no spurious menu update after the new preference was introduced (absent = off)');
  const GL = Object.keys(F).filter(f => { const a = [].concat(CT.ALLERGEN_OF[f] || []); return a.includes('gluten') || a.includes('gluten_may'); });
  ok(GL.length >= 8 && ['atta', 'bread', 'pasta', 'oats', 'soy_sauce'].every(f => GL.includes(f)), `gluten foods identified from the catalog (${GL.length})`);
  const pr = S.load('profile'); pr.prefs = Object.assign(C.normPrefs(pr.prefs), { glutenFree: true }); S.save('profile');
  ok(!!globalThis.MealPlan.pending(PS.get(pl.id)), 'turning gluten-free on → menu update offered (needs approval)'); globalThis.MealPlan.applyChange(PS.get(pl.id), 'test');
  let bad = 0, slots = 0; PS.days(PS.get(pl.id)).forEach(d => { const p = C.plan(d.date); ['m1', 'm2', 'snack', 'extra'].forEach(k => { const s = p[k]; if (!s || !s.rid || s.missing || s.off) return; slots++; L.recipeIngredients(L.recipe(s.rid), s.ov).forEach(x => { if (GL.includes(x.f)) bad++; }); }); });
  ok(bad === 0 && slots > 200, `gluten-free: no gluten food in ${slots} planned meals across the whole plan`);
  const gfR = N.RECIPES.filter(r => !r.ing.some(x => GL.includes(x.f))).length; ok(N.RECIPES.filter(r => !C.conflicts(r, null, { glutenFree: true }).length).length === gfR, `recipe filter count = independent count (${gfR})`); }

fs.mkdirSync(path.join(ROOT, 'dist/reports'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'dist/reports/stageG-test.json'), JSON.stringify({ pass, fail, sections: sec, fails }, null, 1));
if (fails.length) { console.log('FAILURES:'); fails.forEach(f => console.log(' - ' + f)); }
console.log(JSON.stringify(sec)); console.log(`stage G tests: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
