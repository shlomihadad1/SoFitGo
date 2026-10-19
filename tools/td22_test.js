/* TD-22 regression tests (Node, deterministic: Math.random and the clock are seeded before the app loads).
   The calorie/protein gap must follow the day AS IT IS NOW — right after a meal swap, a portion change or a restriction-guard
   replacement — and agree with the totals the screen shows. Thresholds are the existing rule (MealPlan.gapOf), unchanged.
   §1 the reported case: swap the main meal to the lightest dish → displayed ≈56 % of 3,000 kcal → a calorie gap immediately.
   §2 undo the swap → back to the generated day (same gap as generated, not marked as edited).
   §3 portion change (scale) → gap follows.
   §4 unedited days: the re-checked gap equals the generated gap on every day of 12 plans (no behaviour change there).
   §5 random swaps on every day of 6 plans: gap shown ⇔ displayed total outside ±7 % (and protein), both directions.
   §6 a restriction added after the menu was built: guard replacements are re-checked too.
   Usage: node tools/td22_test.js [root] */
const fs = require('fs'), path = require('path'); const ROOT = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, '..');
let seed = 2210; Math.random = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648; let clock = Date.UTC(2026, 9, 19, 9); Date.now = () => (clock += 997);
for (const f of ['src/js/figure.js', 'src/data/exercises.js', 'src/data/workouts.js', 'src/data/nutrition.js', 'src/data/recipes_intl.js', 'src/data/catalog.js', 'src/data/programs.js', 'src/js/logic.js', 'src/js/planner.js', 'src/js/plans.js', 'src/js/mealplanner.js', 'src/js/store.js', 'src/js/core.js']) require(path.join(ROOT, f));
const { Store: S, Core: C, Plans: PS, MealPlan: MP, NUTRI: N, Logic: L } = globalThis; S.today = () => '2026-10-19';
let pass = 0, fail = 0; const fails = [], sec = {}; let cur = '';
const T = n => { cur = n; sec[n] = { pass: 0, fail: 0 }; }, ok = (c, m, i) => { if (c) { pass++; sec[cur].pass++; } else { fail++; sec[cur].fail++; if (fails.length < 40) fails.push(cur + ': ' + m + (i !== undefined ? ' → ' + JSON.stringify(i).slice(0, 300) : '')); } };
const user = (K, pf) => { S.resetAll(); const p = S.load('profile'); Object.assign(p, { age: 30, height: 178, weight: 80, startWeight: 80, sex: 'm', experience: 'intermediate', startDate: '2026-10-19' });
  p.aims = { primary: 'muscle', secondary: [] }; p.availability = { days: [1, 3, 5], sessions: 3, maxMin: 45 }; p.environment = { equipment: [] }; p.prefs = C.normPrefs(pf || {}); p.targets = { kcal: K, protein: Math.round(K * 0.055 / 5) * 5 }; S.save('profile');
  return PS.activate(PS.create('general_90', PS.paramsFromProfile(S.load('profile')), '2026-10-19'), { confirmReplace: true }); };
const shown = d => C.plannedTotals(d, 'base'), gapOn = d => C.plan(d).gap || {};
const agree = (d, t) => { const s = shown(d), g = gapOn(d), outK = s.k < t.kcal * 0.93 || s.k > t.kcal * 1.07, shortP = s.p < t.protein - 0.5; return { outK, flagK: !!(g.kLow || g.kHigh), shortP, flagP: !!g.p, s, g }; };
const mains = N.RECIPES.filter(r => r.meal === 'm2').map(r => ({ id: r.id, k: L.recipeMacros(r).k })).sort((a, b) => a.k - b.k);
const lightest = mains[0].id;

T('1 swap to the lightest main meal → gap at once');
{ user(3000); const d = '2026-10-21', t = C.targets(); const before = shown(d);
  C.setPlanSlot(d, 'm2', { rid: lightest }); const a = agree(d, t), pct = Math.round(100 * a.s.k / t.kcal);
  ok(a.outK && a.flagK, `after the swap the day shows ${a.s.k} of ${t.kcal} kcal (${pct} %) and carries a calorie gap`, a);
  ok(a.g.kLow === Math.round(t.kcal - a.s.k), 'the gap amount = target − displayed total', a.g);
  ok(C.plan(d).gapEdited === true, 'the day is marked as edited (screen words it "after your changes")');
  ok(before.k !== a.s.k, 'displayed totals changed immediately'); }

T('1b the RC3 case: lightest dish as the main meal (≈56–60 % of target)');
{ user(3000); const d = '2026-10-21', t = C.targets(); const any = N.RECIPES.filter(r => r.meal !== 'snack').map(r => ({ id: r.id, k: L.recipeMacros(r).k })).sort((a, b) => a.k - b.k)[0].id;
  C.setPlanSlot(d, 'm2', { rid: any }); const a = agree(d, t), pct = Math.round(100 * a.s.k / t.kcal);
  ok(pct <= 60 && a.flagK && a.g.kLow === t.kcal - a.s.k, `displayed ${a.s.k} of ${t.kcal} kcal (${pct} %) → calorie gap of ${a.g.kLow} shown`, a);
  const nu = S.load('nutrition'); delete nu.plan[d].m2; S.save('nutrition'); }

T('2 undo → back to the generated day');
{ const d = '2026-10-21', gen = MP.forDate(d); const nu = S.load('nutrition'); delete nu.plan[d].m2; S.save('nutrition');
  ok(JSON.stringify(C.plan(d).gap || null) === JSON.stringify(gen.gap || null), 'gap equals the generated gap again', { now: C.plan(d).gap, gen: gen.gap });
  ok(!C.plan(d).gapEdited, 'no longer marked as edited'); }

T('3 portion change follows');
{ const d = '2026-10-22', t = C.targets(); const p0 = C.plan(d); C.setPlanSlot(d, 'm1', { rid: p0.m1.rid, scale: 0.5 }); const a = agree(d, t);
  ok(a.outK === a.flagK && a.shortP === a.flagP, 'half portion of the first meal: gap ⇔ displayed totals out of range', a);
  C.setPlanSlot(d, 'm1', { rid: p0.m1.rid, scale: 2 }); const b = agree(d, t); ok(b.outK === b.flagK && b.shortP === b.flagP, 'double portion: same agreement', b); }

T('4 unedited days: same gap as generated');
{ let days = 0, diff = 0; const ex = [];
  for (const K of [2500, 3000, 3500, 3700]) for (const pf of [{}, { veg: true }, { vegan: true, exclude: ['soya', 'peanuts'] }]) { const pl = user(K, pf);
    PS.days(PS.get(pl.id)).forEach(d => { days++; const g = MP.forDate(d.date); if (JSON.stringify(C.plan(d.date).gap || null) !== JSON.stringify(g.gap || null)) { diff++; if (ex.length < 3) ex.push({ d: d.date, now: C.plan(d.date).gap, gen: g.gap }); } }); }
  ok(diff === 0, `${days} unedited days: re-checked gap = generated gap`, ex); }

T('5 random swaps on every day — no silent miss, no false alarm');
{ let days = 0, bad = 0; const ex = [];
  for (const K of [2500, 3000, 3700]) for (const pf of [{}, { vegan: true, exclude: ['soya', 'peanuts'] }]) { const pl = user(K, pf); const t = C.targets(); const pool = N.RECIPES.filter(r => !C.conflicts(r).length);
    PS.days(PS.get(pl.id)).forEach(d => { days++; const slot = ['m1', 'm2', 'snack'][Math.floor(Math.random() * 3)]; C.setPlanSlot(d.date, slot, { rid: pool[Math.floor(Math.random() * pool.length)].id });
      const a = agree(d.date, t); if (a.outK !== a.flagK || a.shortP !== a.flagP) { bad++; if (ex.length < 3) ex.push({ d: d.date, ...a }); } }); }
  ok(bad === 0, `${days} days with a random swap: gap shown ⇔ displayed totals out of range (calories and protein)`, ex); }

T('6 restriction added after the menu was built');
{ const pl = user(3000); const t = C.targets(); const p = S.load('profile'); p.prefs = C.normPrefs({ exclude: ['milk', 'egg', 'chicken_breast'] }); S.save('profile');
  let days = 0, bad = 0, guarded = 0; PS.days(PS.get(pl.id)).filter(d => d.date >= '2026-10-19').forEach(d => { days++; const pd = C.plan(d.date); if (['m1', 'm2', 'snack'].some(k => pd[k].auto === 'guard' || pd[k].missing)) guarded++;
    const a = agree(d.date, t); if (a.outK !== a.flagK || a.shortP !== a.flagP) bad++; });
  ok(guarded > 0 && bad === 0, `${days} days after adding restrictions (${guarded} with guard replacements): gap ⇔ displayed totals`, { guarded, bad }); }

console.log(fails.length ? 'FAILURES:\n - ' + fails.join('\n - ') : ''); console.log(JSON.stringify(sec)); console.log(`td22 tests: pass ${pass} fail ${fail}`);
if (!process.argv[2]) { fs.mkdirSync(path.join(ROOT, 'dist/reports'), { recursive: true }); fs.writeFileSync(path.join(ROOT, 'dist/reports/td22-test.json'), JSON.stringify({ pass, fail, sections: sec, fails }, null, 1)); }
process.exit(fail ? 1 : 0);
