/* Silent calorie misses vs plan id (read-only). The menu seed includes plan.id, which Plans.create builds from Date.now() and
   Math.random() (plans.js line 13), so rc1_test §1 sees a different menu every run. This scan makes the id reproducible by
   seeding Math.random and the clock, then runs N plan ids per case and counts days that miss the target by > 7 % WITHOUT a
   calorie gap flag (same rule as rc1_test §1). Usage: node tools/audit/silent_gap_scan.js <root> [N] */
const path = require('path'); const ROOT = path.resolve(process.argv[2]), N = +(process.argv[3] || 40);
let seed = 7; Math.random = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648; let clock = Date.UTC(2026, 9, 19); Date.now = () => (clock += 997);
for (const f of ['src/js/figure.js', 'src/data/exercises.js', 'src/data/workouts.js', 'src/data/nutrition.js', 'src/data/recipes_intl.js', 'src/data/recipes_med.js', 'src/data/catalog.js', 'src/data/programs.js', 'src/js/logic.js', 'src/js/planner.js', 'src/js/plans.js', 'src/js/mealplanner.js', 'src/js/store.js', 'src/js/core.js']) require(path.join(ROOT, f));
const { Store: S, Core: C, Plans: PS } = globalThis; let NOW = '2026-10-19'; S.today = () => NOW;
function setUser(o) { S.resetAll(); o = Object.assign({ age: 30, height: 178, weight: 80, sex: 'm', goal: 'muscle', prefs: {} }, o); const p = S.load('profile');
  Object.assign(p, { age: o.age, height: o.height, weight: o.weight, startWeight: o.weight, sex: o.sex, experience: 'intermediate', startDate: NOW });
  p.aims = { primary: o.goal, secondary: [] }; p.availability = { days: [0, 1, 3, 5], sessions: 4, maxMin: 45, prefMin: null }; p.environment = { place: 'home', equipment: [], custom: [] };
  p.exercisePrefs = { fav: [], exclude: [], noJump: false }; p.prefs = C.normPrefs(o.prefs); if (o.targets) p.targets = o.targets; S.save('profile'); }
const res = {};
for (const K of [2500, 3000, 3500, 3700]) for (const [lbl, pf] of [['omnivore', {}], ['vegetarian', { veg: true }], ['vegan-no-soy-peanut', { vegan: true, exclude: ['soya', 'peanuts'] }]]) {
  let plansWithSilent = 0, silentDays = 0, days = 0; const ex = [];
  for (let i = 0; i < N; i++) { setUser({ targets: { kcal: K, protein: Math.round(K * 0.055 / 5) * 5 }, prefs: pf }); const pl = PS.activate(PS.create('general_90', PS.paramsFromProfile(S.load('profile')), NOW), { confirmReplace: true });
    const t = C.targets(); let s = 0; PS.days(PS.get(pl.id)).forEach(d => { days++; const p = C.plan(d.date), k = C.plannedTotals(d.date, 'base').k, g = p.gap || {};
      if (!(Math.abs(k - t.kcal) <= t.kcal * 0.07) && !(g.kLow || g.kHigh)) { s++; if (ex.length < 3) ex.push({ plan: pl.id, date: d.date, kcal: Math.round(k), target: t.kcal, pct: +(100 * k / t.kcal).toFixed(1), gap: p.gap || null }); } });
    silentDays += s; if (s) plansWithSilent++; }
  res[`${K} ${lbl}`] = { plans: N, plansWithSilentDay: plansWithSilent, silentDays, days, examples: ex }; }
console.log(JSON.stringify(res, null, 1));
