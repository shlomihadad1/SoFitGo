/* Admin CMS · content loader unit tests (Node): validation rules, override / add / archive / revert, and that invalid content is
   never half-applied. Usage: node tools/cms_content_test.js */
const path = require('path'); const ROOT = path.join(__dirname, '..');
global.localStorage = { _: {}, getItem(k) { return this._[k] == null ? null : this._[k]; }, setItem(k, v) { this._[k] = String(v); }, removeItem(k) { delete this._[k]; } };
for (const f of ['src/js/figure.js', 'src/data/exercises.js', 'src/data/workouts.js', 'src/data/nutrition.js', 'src/data/recipes_intl.js', 'src/data/recipes_med.js', 'src/data/catalog.js', 'src/data/programs.js', 'src/js/logic.js', 'src/js/planner.js', 'src/js/plans.js', 'src/js/mealplanner.js', 'src/js/store.js', 'src/js/core.js', 'src/js/cms_content.js']) require(path.join(ROOT, f));
const { CMS, NUTRI: N, Logic: L, EX_BY_ID } = globalThis;
let pass = 0, fail = 0; const ok = (c, m, i) => { if (c) pass++; else { fail++; console.log('FAIL ' + m + (i !== undefined ? ' → ' + JSON.stringify(i).slice(0, 300) : '')); } };
const good = { he: 'קערת בדיקה', en: 'Test Bowl', meal: 'm2', cuisine: 'israeli', ing: [{ f: 'chicken_breast', g: 140 }, { f: 'bulgur', g: 60 }], steps: ['א', 'ב'], prep: 10, cook: 15 };
ok(CMS.checkRecipe('t_bowl', good).length === 0, 'a complete recipe passes');
ok(CMS.checkRecipe('Bad Id', good).length > 0, 'bad id refused');
ok(CMS.checkRecipe('t', Object.assign({}, good, { ing: [{ f: 'unicorn', g: 10 }] })).some(x => /^ing_food/.test(x)), 'unknown food refused');
ok(CMS.checkRecipe('tt', Object.assign({}, good, { ing: [{ f: 'bulgur', g: 60 }, { f: 'bulgur', g: 20 }] })).some(x => /^ing_dup/.test(x)), 'duplicate ingredient refused (no double count)');
ok(CMS.checkRecipe('tt', Object.assign({}, good, { steps: ['לבשל 60 ג׳ אורז', 'ב'] })).includes('steps_grams'), 'grams quoted in steps refused');
ok(CMS.checkRecipe('tt', Object.assign({}, good, { meal: 'lunch' })).length > 0, 'unknown meal type refused');
ok(CMS.checkRecipe('tt', Object.assign({}, good, { ing: [{ f: 'bulgur', g: 5000 }] })).length > 0, 'absurd grams refused');
const n0 = N.RECIPES.length, base = L.recipeMacros(L.recipe('md_shakshuka'));
let r = CMS.apply([{ kind: 'recipe', item_id: 't_bowl', status: 'published', version: 1, data: good }, { kind: 'recipe', item_id: 'md_shakshuka', status: 'published', version: 1, data: Object.assign({}, require('util').inspect && {}, { he: 'שקשוקה', en: 'Shakshuka', meal: 'm1', cuisine: 'israeli', ing: [{ f: 'egg', g: 100 }, { f: 'tomato', g: 250 }], steps: ['א', 'ב'], prep: 5, cook: 10 }) },
  { kind: 'recipe', item_id: 'evil', status: 'published', version: 1, data: { he: 'x' } }, { kind: 'exercise', item_id: 'squat', status: 'published', version: 2, data: Object.assign({}, EX_BY_ID.squat, { steps: EX_BY_ID.squat.steps.concat('צעד נוסף') }) }]);
ok(r.applied === 3 && r.rejected === 1, 'valid items applied, invalid item rejected whole', r);
ok(N.RECIPES.length === n0 + 1 && L.recipe('t_bowl') && L.recipe('t_bowl').cms === 1, 'a new recipe is added and resolvable');
ok(!L.recipe('evil'), 'the invalid item was not half-applied');
ok(L.recipeMacros(L.recipe('md_shakshuka')).k < base.k, 'an override replaces the built-in recipe (values recalculated from the new ingredients)');
ok(L.recipe('t_bowl').tags.includes('chicken') && !L.recipe('t_bowl').tags.includes('vegan'), 'diet tags follow the ingredients');
ok(EX_BY_ID.squat.steps[EX_BY_ID.squat.steps.length - 1] === 'צעד נוסף' && Array.isArray(EX_BY_ID.squat.bad), 'exercise instructions override keeps field types');
ok(!!N.CMS_V && /recipe:t_bowl@1/.test(N.CMS_V), 'content version recorded (menu caches are keyed on it)');
CMS.apply([{ kind: 'recipe', item_id: 't_bowl', status: 'archived', version: 2, data: good }, { kind: 'recipe', item_id: 'md_shakshuka', status: 'published', version: 1, data: { he: 'שקשוקה', en: 'Shakshuka', meal: 'm1', cuisine: 'israeli', ing: [{ f: 'egg', g: 100 }, { f: 'tomato', g: 250 }], steps: ['א', 'ב'], prep: 5, cook: 10 } }]);
const P = globalThis.MealPlan.pool({ kcal: 2400, protein: 140, prefs: globalThis.Core.normPrefs({}), meals: 3, maxPrep: null, dislike: [] });
ok(L.recipe('t_bowl').archived && !P.m2.some(x => x.r.id === 't_bowl'), 'archived: resolvable for history, not offered in menus');
ok(EX_BY_ID.squat.steps[EX_BY_ID.squat.steps.length - 1] !== 'צעד נוסף', 'an override that is no longer served reverts to the built-in original');
CMS.apply([]);
ok(Math.abs(L.recipeMacros(L.recipe('md_shakshuka')).k - base.k) < 0.5, 'built-in recipe fully restored when its override disappears');
console.log(`cms content tests: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
