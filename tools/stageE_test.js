/* Stage E tests (Node): exercise & food media system — content completeness per exercise/recipe, stable media mapping,
   honest availability (no invented URLs, no shared assets, no illustration counted as video), files on disk.
   Writes dist/reports/stageE-test.json. */
const fs = require('fs'), path = require('path'); const ROOT = path.join(__dirname, '..');
for (const f of ['src/js/figure.js', 'src/data/exercises.js', 'src/data/workouts.js', 'src/data/nutrition.js', 'src/data/recipes_intl.js', 'src/data/catalog.js', 'src/js/logic.js']) require(path.join(ROOT, f));
const { EXERCISES, NUTRI: N, CATALOG: CT } = globalThis;
let pass = 0, fail = 0; const fails = [], sec = {}; let cur = '';
const T = n => { cur = n; sec[n] = { pass: 0, fail: 0 }; }, ok = (c, m) => { if (c) { pass++; sec[cur].pass++; } else { fail++; sec[cur].fail++; if (fails.length < 60) fails.push(cur + ': ' + m); } };
const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'MEDIA-MANIFEST.json'), 'utf8'));

T('exercise content');
for (const e of EXERCISES) {
  const f = CT.exFacts(e);
  ok(e.he && e.en && e.start && e.end && e.dir && e.breath, e.id + ': names, start/end position, direction, breathing');
  ok(e.steps.length >= 2, e.id + ': numbered steps');
  ok(e.mistakes.length >= 1 && e.bad.length >= 1, e.id + ': common mistakes + signs of incorrect execution');
  ok(f.primary.length >= 1, e.id + ': primary muscles');
  ok(Array.isArray(f.eq) && f.eq.every(x => CT.EQUIPMENT[x]), e.id + ': equipment resolved (' + (f.eq.join(',') || 'none') + ')');
  const sf = CT.exSafety(e); ok(sf.length >= 3 && sf.every(s => typeof s === 'string' && s.length > 10), e.id + ': ≥3 safety cues');
  ok(!sf.some(s => /בקע|ניתוח|אבחנ|רפוא/.test(s)), e.id + ': safety cues contain no medical assumptions');
  ok(e.levels && e.levels.easy && e.levels.normal && e.levels.hard, e.id + ': easy / normal / hard variants');
}
ok(Object.keys(CT.PATTERN_HE).every(k => CT.SAFETY_BY_PATTERN[k] && CT.SAFETY_BY_PATTERN[k].length), 'every movement pattern has safety cues');

T('recipe content');
for (const r of N.RECIPES) {
  ok(r.steps.length >= 1 && r.steps.every(s => s.trim().length > 3), r.id + ': step-by-step instructions');
  ok(r.ing.length >= 1 && r.ing.every(x => N.FOODS[x.f] && x.g > 0), r.id + ': ingredients with amounts');
  ok(typeof r.prep === 'number' && typeof r.cook === 'number', r.id + ': prep and cook time');
}

T('media mapping');
const byRole = role => man.items.filter(i => i.role === role);
ok(byRole('exercise-cover').length === EXERCISES.length && byRole('exercise-demo').length === EXERCISES.length, 'every exercise has a cover entry and a demo-video entry');
ok(byRole('recipe-photo').length === N.RECIPES.length && byRole('recipe-prep').length === N.RECIPES.length && byRole('recipe-steps').length === N.RECIPES.length, 'every recipe has photo / prep-video / step-photo entries');
ok(new Set(man.items.map(i => i.id)).size === man.items.length, 'media ids unique');
const ids = new Set(EXERCISES.map(e => e.id)), rids = new Set(N.RECIPES.map(r => r.id));
ok(man.items.every(i => (i.target.type === 'exercise' ? ids : rids).has(i.target.id)), 'every media entry targets an existing exercise/recipe id');
const avail = man.items.filter(i => i.status === 'available');
ok(avail.every(i => i.path && fs.existsSync(path.join(ROOT, 'dist/pwa', i.path))), 'every "available" asset exists on disk in the build');
const paths = avail.map(i => i.path); ok(new Set(paths).size === paths.length, 'no asset file is shared between two items');
ok(man.items.filter(i => i.status === 'missing').every(i => !i.path || !/^https?:/.test(i.path)), 'missing items carry no invented URL');
ok(avail.every(i => i.license && i.source && i.origin), 'every available asset records source, origin and license');
ok(byRole('exercise-demo').filter(i => i.status === 'available').every(i => i.kind === 'video'), 'only real video files count as exercise videos (illustrations never do)');
ok(avail.filter(i => i.role === 'exercise-cover').every(i => i.origin === 'generated' && /איור/.test(i.alt)), 'generated exercise covers are labelled as illustrations');
ok(man.items.every(i => !/^https?:/.test(i.path || '') && Object.values(i.sizes || {}).every(x => !/^https?:/.test(x))), 'manifest paths are relative (no external hotlinks)');

T('availability summary (documented, not a pass/fail on missing assets)');
const sum = {}; man.items.forEach(i => { sum[i.role] = sum[i.role] || { available: 0, missing: 0 }; sum[i.role][i.status === 'available' ? 'available' : 'missing']++; });
ok(true, 'summary ' + JSON.stringify(sum));

fs.mkdirSync(path.join(ROOT, 'dist/reports'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'dist/reports/stageE-test.json'), JSON.stringify({ pass, fail, sections: sec, fails, mediaSummary: sum }, null, 1));
if (fails.length) { console.log('FAILURES:'); fails.forEach(f => console.log(' - ' + f)); }
console.log(JSON.stringify(sec)); console.log(`stage E tests: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
