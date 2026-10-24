/* Admin CMS · full app control — validation and loader unit tests (Node, no browser): texts keep tokens and refuse markup, layout
   refuses hiding required components, design tokens accept only listed variables with checked values (no CSS injection) and pass the
   contrast rules, app settings accept only known modules / defaults, apply() rebuilds the maps and a reset returns to built-in values.
   Usage: node tools/cms_app_test.js */
const path = require('path'); const ROOT = path.join(__dirname, '..');
global.localStorage = { _: {}, getItem(k) { return this._[k] == null ? null : this._[k]; }, setItem(k, v) { this._[k] = String(v); }, removeItem(k) { delete this._[k]; } };
for (const f of ['src/js/figure.js', 'src/data/exercises.js', 'src/data/workouts.js', 'src/data/nutrition.js', 'src/data/recipes_intl.js', 'src/data/recipes_med.js', 'src/data/catalog.js', 'src/data/programs.js', 'src/js/logic.js', 'src/js/planner.js', 'src/js/plans.js', 'src/js/mealplanner.js', 'src/js/store.js', 'src/js/core.js', 'src/js/cms_content.js']) require(path.join(ROOT, f));
const { CMS, Core } = globalThis;
let pass = 0, fail = 0; const ok = (c, m, i) => { if (c) pass++; else { fail++; console.log('FAIL ' + m + (i !== undefined ? ' → ' + JSON.stringify(i).slice(0, 300) : '')); } };
const T = (o, he, en) => ({ orig: o, he, en }), tid = CMS.textId;
/* texts */
ok(CMS.check('text', tid('סמן שאכלתי'), T('סמן שאכלתי', 'אכלתי את זה')).length === 0, 'text: a plain rewording passes');
ok(CMS.check('text', tid('נשארו 3 ימים'), T('נשארו 3 ימים', 'עוד ימים ספורים')).includes('t_tok'), 'text: dropping a number from the original is refused');
ok(CMS.check('text', tid('שלום {name}'), T('שלום {name}', 'היי')).includes('t_tok') && CMS.check('text', tid('שלום {name}'), T('שלום {name}', 'היי {name}')).length === 0, 'text: interpolation tokens must be kept');
ok(CMS.check('text', tid('בית'), T('בית', '<b>בית</b>')).includes('t_html'), 'text: markup refused');
ok(CMS.check('text', 't_wrong_3', T('בית', 'הבית')).includes('t_id'), 'text: id must belong to the original string');
ok(CMS.check('text', tid('בית'), T('בית', '', '')).includes('t_empty'), 'text: empty override refused');
/* layout */
ok(CMS.check('layout', 'home', { order: ['nutrition', 'now', 'coach'], hidden: ['week'], space: { now: 'compact' } }).length === 0, 'layout: reorder + hide + spacing passes');
ok(CMS.check('layout', 'nutrition', { order: ['meals'], hidden: ['meals'] }).includes('l_hide'), 'layout: a required component (the day\'s meals) cannot be hidden');
ok(CMS.check('layout', 'nav', { order: ['home'], hidden: ['home'] }).includes('l_hide'), 'layout: the home tab cannot be hidden');
ok(CMS.check('layout', 'home', { order: ['coach', 'coach'] }).includes('l_order'), 'layout: duplicate ids refused');
ok(CMS.check('layout', 'admin', { order: [] }).includes('l_screen'), 'layout: unsupported screen refused');
ok(CMS.check('layout', 'home', { order: ['now'], space: { now: 'gigantic' } }).includes('l_space'), 'layout: unknown spacing refused');
/* design */
ok(CMS.check('theme', 'active', { name: 'ירוק', tokens: { '--accent': '#22C55E', '--r': '8px', '--font-body': 'rubik' } }).length === 0, 'design: listed tokens with valid values pass');
ok(CMS.check('theme', 'active', { name: 'x', tokens: { '--accent': 'red;} body{display:none' } }).some(c => /^th_value/.test(c)), 'design: CSS injection in a value refused');
ok(CMS.check('theme', 'active', { name: 'x', tokens: { 'background': '#000000' } }).some(c => /^th_unknown/.test(c)), 'design: properties outside the token list refused');
ok(CMS.check('theme', 'active', { name: 'x', tokens: { '--fs': '40px' } }).some(c => /^th_value/.test(c)), 'design: size outside its range refused');
ok(CMS.check('theme', 'active', { name: 'x', tokens: { '--text': '#20232A' } }).some(c => /^th_contrast:--text/.test(c)), 'design: unreadable text colour refused (contrast)');
ok(Math.abs(CMS.contrast('#FFFFFF', '#000000') - 21) < 0.01 && CMS.contrastIssues({}).length === 0, 'design: contrast maths (21:1) and the shipped theme passes every pair');
ok(CMS.check('theme', 'preset_ocean', { name: 'אוקיינוס', tokens: {} }).length === 0 && CMS.check('theme', 'preset_Bad!', { name: 'x', tokens: {} }).includes('th_id'), 'design: named presets');
/* settings */
ok(CMS.check('config', 'app', { off: ['fridge'], defaults: { meals: 2 }, notice: { text: 'עדכון גרסה בקרוב', level: 'info' } }).length === 0, 'settings: known module, default and notice pass');
ok(CMS.check('config', 'app', { off: ['payments'] }).includes('c_off') && CMS.check('config', 'app', { defaults: { kcal: 900 } }).includes('c_def'), 'settings: unknown module / unsupported default (e.g. calorie target) refused');
ok(CMS.check('config', 'app', { notice: { text: '<script>', level: 'info' } }).includes('c_notice'), 'settings: markup in the notice refused');
/* apply */
const rows = [{ kind: 'text', item_id: tid('סמן שאכלתי'), status: 'published', version: 1, data: T('סמן שאכלתי', 'אכלתי ✓') },
  { kind: 'text', item_id: tid('בית'), status: 'published', version: 1, data: T('בית', '<i>x</i>') },
  { kind: 'layout', item_id: 'home', status: 'published', version: 2, data: { order: ['nutrition', 'now'], hidden: [] } },
  { kind: 'theme', item_id: 'active', status: 'published', version: 1, data: { name: 'x', tokens: { '--accent': '#22C55E' } } },
  { kind: 'theme', item_id: 'preset_a', status: 'published', version: 1, data: { name: 'a', tokens: { '--accent': '#3B82F6' } } },
  { kind: 'config', item_id: 'app', status: 'published', version: 1, data: { off: ['fridge'], defaults: { meals: 2 } } }];
const r = CMS.apply(rows);
ok(r.applied === 5 && r.rejected === 1, 'apply: valid items applied, the item with markup rejected whole', r);
ok(CMS.app.text['סמן שאכלתי'].he === 'אכלתי ✓' && !CMS.app.text['בית'], 'apply: text map holds only the valid override');
ok(CMS.app.layout.home.order[0] === 'nutrition' && CMS.isOff('fridge') && !CMS.isOff('nutrition'), 'apply: layout and module switches');
ok(Core.normPrefs({}).meals === 2 && Core.normPrefs({ meals: 3 }).meals === 3, 'settings default: used only when the user did not choose (meals 2 by default, the user\'s 3 kept)');
ok(/text:t_/.test(globalThis.NUTRI.CMS_V) && /config:app@1/.test(globalThis.NUTRI.CMS_V), 'apply: content version includes app-control items (menus are rebuilt after a settings change)');
CMS.apply(rows.map(x => x.kind === 'config' ? Object.assign({}, x, { status: 'archived', version: 2 }) : x));
ok(!CMS.isOff('fridge') && Core.normPrefs({}).meals === 3 && !globalThis.FIT30_DEFAULTS, 'reset to default (archived settings): modules back on, built-in defaults back');
CMS.apply([]);
ok(!CMS.app.ntext && !Object.keys(CMS.app.layout).length, 'nothing served → built-in texts and layout');
console.log(`cms app-control tests: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
