/* Dumps, for a fixed seeded set of plans, every generated menu day: dishes+portions (slots), totals and gap.
   Usage: node tools/audit/menu_diff_dump.js <root> > out.json   — compare two copies with menu_diff_compare.js */
const path = require('path'); const ROOT = path.resolve(process.argv[2]);
let seed = 4242; Math.random = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648; let clock = Date.UTC(2026, 9, 19, 7); Date.now = () => (clock += 1013);
for (const f of ['src/js/figure.js', 'src/data/exercises.js', 'src/data/workouts.js', 'src/data/nutrition.js', 'src/data/recipes_intl.js', 'src/data/recipes_med.js', 'src/data/catalog.js', 'src/data/programs.js', 'src/js/logic.js', 'src/js/planner.js', 'src/js/plans.js', 'src/js/mealplanner.js', 'src/js/store.js', 'src/js/core.js']) require(path.join(ROOT, f));
const { Store: S, Core: C, Plans: PS, MealPlan: MP } = globalThis; S.today = () => '2026-10-19'; const out = [];
const PROF = [[1800, 'f', 'fat_loss'], [2200, 'm', 'maintain'], [2500, 'm', 'muscle'], [3000, 'm', 'muscle'], [3500, 'm', 'muscle'], [3700, 'm', 'muscle']];
const PREFS = [{}, { veg: true }, { vegan: true, exclude: ['soya', 'peanuts'] }, { exclude: ['milk'] }, { glutenFree: true }];
for (const [K, sex, goal] of PROF) for (const pf of PREFS) for (const meals of [3, 2]) for (let i = 0; i < 4; i++) {
  S.resetAll(); const p = S.load('profile'); Object.assign(p, { age: 31, height: 176, weight: 78, startWeight: 78, sex, experience: 'beginner', startDate: '2026-10-19' });
  p.aims = { primary: goal, secondary: [] }; p.availability = { days: [1, 3, 5], sessions: 3, maxMin: 40, prefMin: null }; p.environment = { place: 'home', equipment: [], custom: [] };
  p.prefs = C.normPrefs(Object.assign({ mealsPerDay: meals }, pf)); p.targets = { kcal: K, protein: Math.round(K * 0.055 / 5) * 5 }; S.save('profile');
  const pl = PS.activate(PS.create(['general_90', 'habits_30', 'progress_6m'][i % 3], PS.paramsFromProfile(S.load('profile')), '2026-10-19'), { confirmReplace: true });
  const m = MP.menus(PS.get(pl.id)); Object.keys(m.byDate).sort().forEach(d => { const x = m.byDate[d]; out.push({ c: `${K}/${JSON.stringify(pf)}/${meals}/${i}`, d, slots: JSON.stringify(x.slots), off: JSON.stringify(x.off || null), totals: x.totals, gap: x.gap || null }); }); }
process.stdout.write(JSON.stringify(out));
