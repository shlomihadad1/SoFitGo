/* Workout Builder + Smart Exercise Substitution + CSV export — unit / integration tests (Node, real modules, no browser).
   Usage: node tools/builder_test.js */
const path = require('path'); const ROOT = path.join(__dirname, '..');
global.window = globalThis; global.localStorage = { _: {}, getItem(k) { return this._[k] == null ? null : this._[k]; }, setItem(k, v) { this._[k] = String(v); }, removeItem(k) { delete this._[k]; }, key(i) { return Object.keys(this._)[i]; }, get length() { return Object.keys(this._).length; } };
for (const f of ['src/js/figure.js', 'src/data/exercises.js', 'src/data/workouts.js', 'src/data/nutrition.js', 'src/data/recipes_intl.js', 'src/data/recipes_med.js', 'src/data/catalog.js', 'src/data/programs.js', 'src/js/logic.js', 'src/js/planner.js', 'src/js/plans.js', 'src/js/mealplanner.js', 'src/js/store.js', 'src/js/core.js', 'src/js/builder.js', 'src/js/export_csv.js', 'src/js/gate.js']) require(path.join(ROOT, f));
const { Builder: B, Plans, CATALOG: CT, EX_BY_ID, Store: S, Logic: L, ExportCSV: X } = globalThis;
const res = []; let G = ''; const ok = (c, m, i) => res.push({ g: G, ok: !!c, m: m + (i !== undefined && !c ? ' → ' + JSON.stringify(i).slice(0, 300) : '') });
const all = w => ['warm', 'main', 'cool'].flatMap(k => w[k].map(x => x.ex));
const usable = (w, eq) => all(w).every(id => CT.usableWith(EX_BY_ID[id], ['none', ...eq]));

G = 'builder · 15 / 30 / 60 minutes × levels × equipment';
const EQS = [[], ['chair', 'towel'], ['dumbbells', 'bench', 'doorframe', 'table', 'wall', 'step']];
let n = 0, timeOk = 0, eqOk = 0, dupOk = 0, lvlOk = 0, why = 0;
for (const goal of Object.keys(B.GOALS)) for (const minutes of [15, 30, 60]) for (const level of ['beginner', 'intermediate', 'advanced', null]) for (const eq of EQS) {
  const w = B.generate({ goal, minutes, level, equipment: eq }); n++;
  const m = B.minutes(w); if (m <= minutes && (m >= minutes - 6 || w.notes.some(x => /קצר מהזמן/.test(x)))) timeOk++;
  if (usable(w, eq)) eqOk++;
  if (new Set(w.main.map(x => x.ex)).size === w.main.length && !w.main.some(x => w.warm.concat(w.cool).some(y => y.ex === x.ex))) dupOk++;
  const cap = { beginner: 1, intermediate: 2, advanced: 3 }[level] || 1; if (w.main.every(x => CT.exFacts(EX_BY_ID[x.ex]).d <= cap || /מעל הרמה/.test(x.why || ''))) lvlOk++;
  if (w.main.every(x => x.why && x.why.length > 10)) why++;
}
ok(timeOk === n, `every generated workout fits the chosen time (or says why it is shorter) — ${timeOk}/${n}`);
ok(eqOk === n, `only exercises the chosen equipment allows — ${eqOk}/${n}`);
ok(dupOk === n, `no exercise twice in a workout (main, warm-up, cool-down) — ${dupOk}/${n}`);
ok(lvlOk === n, `difficulty within the level (or labelled when no alternative exists) — ${lvlOk}/${n}`);
ok(why === n, 'every exercise carries a short reason for its choice');
{ const w = B.generate({ goal: 'general', minutes: 30, level: 'intermediate' }), b = L.durationBreakdown(B.def(w), 'std');
  ok(b.warm > 0 && b.rest > 0 && b.trans > 0 && b.cool > 0 && Math.round(b.total / 60) === B.minutes(w), 'time = warm-up + work + rests + transitions + cool-down (the runner\'s own steps), not a sum of sets', b); }
{ const a = B.generate({ goal: 'strength', minutes: 30, level: 'beginner' }), b = B.generate({ goal: 'strength', minutes: 30, level: 'beginner' });
  ok(JSON.stringify(a.main) === JSON.stringify(b.main), 'deterministic: the same choices give the same workout');
  const c = B.generate({ goal: 'strength', minutes: 30, level: 'beginner', variant: 1 }); ok(JSON.stringify(c.main.map(x => x.ex)) !== JSON.stringify(a.main.map(x => x.ex)), '"another suggestion" (variant) changes exercises'); }
{ const w15 = B.generate({ goal: 'muscle', minutes: 15, level: 'advanced', equipment: ['bench', 'chair'] }); ok(w15.notes.some(x => /קוצר/.test(x)) && B.minutes(w15) <= 15, 'a workout that does not fit is shortened transparently (note says what was cut)', w15.notes); }

G = 'builder · preferences and limits';
{ const ex = ['squat', 'pushup', 'knee_pushup', 'glute_bridge'], w = B.generate({ goal: 'general', minutes: 30, level: 'intermediate', exclude: ex }); ok(!all(w).some(id => ex.includes(id)), 'excluded exercises never appear (main, warm-up, cool-down)', all(w)); }
{ const w = B.generate({ goal: 'fat_loss', minutes: 30, level: 'advanced', noJump: true }); ok(!all(w).some(id => CT.exFacts(EX_BY_ID[id]).impact === 'high'), '"no jumping" removes high-impact moves'); }
{ const w = B.generate({ goal: 'general', minutes: 30, level: 'intermediate', fav: ['split_squat'] }); ok(w.main.some(x => x.ex === 'split_squat' && /מועדפים/.test(x.why)), 'a favourite exercise is chosen for its slot and the reason says so'); }
{ const w = B.generate({ goal: 'general', minutes: 30, level: 'intermediate', focus: ['legs'] }); const legs = w.main.filter(x => ['squat', 'lunge', 'hinge', 'bridge'].includes(CT.exFacts(EX_BY_ID[x.ex]).pattern)).length; /* by movement pattern: glute bridges are catalogued under core */ ok(legs >= 2 && /להדגיש/.test(w.main[0].why), 'focus muscle group comes first and is emphasised', w.main.map(x => x.ex)); }
{ const w = B.generate({ goal: 'muscle', minutes: 60, level: 'advanced', equipment: ['bench', 'chair', 'towel', 'doorframe', 'dumbbells'] }), load = {};
  w.main.forEach(x => CT.exFacts(EX_BY_ID[x.ex]).primary.forEach(m => { load[m] = (load[m] || 0) + 1; })); ok(Object.values(load).every(v => v <= 3), 'no primary muscle carries more than 3 exercises in one workout', load); }
{ const w = B.generate({ goal: 'mobility', minutes: 15, level: 'beginner' }); ok(w.main.every(x => ['mobility', 'breathing'].includes(CT.exFacts(EX_BY_ID[x.ex]).type)), 'mobility goal → mobility work only'); }
{ const w = B.generate({ goal: 'general', minutes: 30, exclude: root_all_but(['squat', 'march', 'cat_cow']) }); ok(w.main.length >= 1 && w.notes.some(x => /המקום נשאר ריק|קצר מהזמן/.test(x)), 'tiny catalogue (all but 3 excluded): builds what exists and says what is missing, never invents', w.notes); }
function root_all_but(keep) { return globalThis.EXERCISES.map(e => e.id).filter(id => !keep.includes(id)); }

G = 'builder · validation, save, reload, edit, history';
{ const w = B.generate({ goal: 'strength', minutes: 30, level: 'beginner' }); w.name = 'כוח בבית';
  ok(B.validate(Object.assign({}, w, { main: w.main.concat([{ ex: 'flying_kick', sets: 3, reps: 10 }]) })).some(e => /לא מוכר/.test(e)), 'saving a workout with an unknown exercise is refused');
  ok(B.validate(Object.assign({}, w, { main: [Object.assign({}, w.main[0], { sets: -2 })] })).length > 0 && B.validate(Object.assign({}, w, { main: [Object.assign({}, w.main[0], { reps: 500 })] })).length > 0, 'negative / unrealistic values are refused');
  ok(B.validate(Object.assign({}, w, { main: w.main.concat([Object.assign({}, w.main[0])]) })).some(e => /פעמיים/.test(e)), 'the same exercise twice is refused');
  const saved = B.save(w); ok(saved.id && B.get(saved.id).name === 'כוח בבית', 'saved');
  const raw = JSON.parse(localStorage.getItem('fit30.workouts')); ok(raw.custom[saved.id] && raw.custom[saved.id].main.length === w.main.length, 'persisted in the store (survives reload; part of backup and sync)');
  Object.keys(require.cache).filter(k => /store\.js$/.test(k)).forEach(k => delete require.cache[k]); require(path.join(ROOT, 'src/js/store.js'));
  ok(globalThis.Builder.get(saved.id) && globalThis.Builder.get(saved.id).main[0].ex === w.main[0].ex, 'reloaded from storage with the same content');
  const ed = JSON.parse(JSON.stringify(B.get(saved.id))); B.move(ed, 0, 1); ed.main[0].sets = 4; B.save(ed);
  ok(B.get(saved.id).main[0].sets === 4 && B.get(saved.id).original.main[0].ex === w.main[0].ex, 'edit + reorder saved; the original version is kept');
  const run = B.logRun(saved.id, { runId: 'r1', status: 'done', durationSec: 1500 }); ok(run && run.snapshot.main[0].sets === 4, 'a run is logged with a frozen snapshot');
  ok(B.logRun(saved.id, { runId: 'r1', status: 'done' }) === null && B.history(saved.id).length === 1, 'idempotent: the same run is never logged twice');
  B.revert(saved.id); ok(B.get(saved.id).main[0].ex === w.main[0].ex && B.history(saved.id)[0].snapshot.main[0].sets === 4, 'revert restores the original; the logged run is unchanged');
  const dup = B.duplicate(saved.id); ok(dup.id !== saved.id && /עותק/.test(dup.name) && B.list().length === 2, 'duplicate'); ok(B.toggleFav(dup.id) === true && B.list()[0].id === dup.id, 'favourite sorts first');
  B.remove(saved.id); ok(!B.get(saved.id) && B.history(saved.id).length === 1, 'delete keeps history');
  const rd = B.runDef(dup.id); ok(rd && rd.main.length === dup.main.length && rd.custom, 'runDef → the existing runner format');
  ok(B.check(dup).ok, 'Plan Integrity Gate check of a generated workout passes (equipment, exclusions, time)'); }
{ const w = B.generate({ goal: 'general', minutes: 30, level: 'beginner' }); w.name = 'x'; w.main.push({ ex: 'pullup_negative' in EX_BY_ID ? 'pullup_negative' : 'doorframe_row', sets: 2, reps: 8 }); const c = B.check(w); ok(c.issues.some(i => i.kind === 'equipment' && i.sev === 'warn'), 'Gate: household equipment that was not chosen (door frame) is flagged before the start (warning, as for plans)', c.issues);
  const w2 = JSON.parse(JSON.stringify(w)); w2.main.pop(); w2.params.exclude = [w2.main[0].ex]; const c2 = B.check(w2); ok(!c2.ok && c2.issues.some(i => i.kind === 'excluded' && i.sev === 'block'), 'Gate: an exercise the user excluded blocks the start', c2.issues); }

G = 'substitution · ranking, filters, integrity';
{ const w = B.generate({ goal: 'general', minutes: 30, level: 'intermediate' }), i = w.main.findIndex(x => CT.exFacts(EX_BY_ID[x.ex]).pattern === 'push_h'), cur = w.main[i];
  const a = B.alternatives(w, 'main', i); ok(a.list.length >= 1, 'alternatives exist for a horizontal push', a.reason);
  ok(a.list.every(x => !all(w).includes(x.id)), 'never offers an exercise already in the workout');
  ok(a.list.every(x => CT.usableWith(EX_BY_ID[x.id], ['none'])), 'only exercises the equipment allows');
  ok(a.list[0].why.some(s => /אותו דפוס|עובד על/.test(s)) && a.list.every(x => Array.isArray(x.diffs)), 'each alternative has a reason and its differences, from catalogue facts');
  const before = JSON.stringify(w.main.filter((_, k) => k !== i)), r = B.substitute(w, 'main', i, a.list[0].id);
  ok(JSON.stringify(w.main.filter((_, k) => k !== i)) === before && w.main[i].ex === a.list[0].id, 'substitution changes only that exercise');
  ok(w.main[i].sets === cur.sets && w.main[i].rest === cur.rest, 'sets and rest are kept'); ok(typeof r.minutes === 'number', 'duration is recalculated'); }
{ const w = B.generate({ goal: 'general', minutes: 30, level: 'intermediate', noJump: true, exclude: ['pushup'] }), i = w.main.findIndex(x => CT.exFacts(EX_BY_ID[x.ex]).pattern === 'push_h');
  const a = B.alternatives(w, 'main', i); ok(!a.list.some(x => x.id === 'pushup' || CT.exFacts(EX_BY_ID[x.id]).impact === 'high'), 'never offers an excluded or a jumping exercise'); }
{ const w = { params: { equipment: [], level: 'beginner' }, warm: [{ ex: 'march', sets: 1, sec: 60 }], main: [{ ex: 'squat', sets: 2, reps: 10, rest: 60 }], cool: [{ ex: 'childs_pose', sets: 1, sec: 45 }] };
  const aw = B.alternatives(w, 'warm', 0), ac = B.alternatives(w, 'cool', 0);
  ok(aw.list.concat(ac.list).every(x => { const f = CT.exFacts(EX_BY_ID[x.id]); return ['mobility', 'breathing'].includes(f.type) || f.pattern === 'cardio_low'; }), 'warm-up / cool-down accept only mobility, breathing and light cardio');
  const am = B.alternatives(w, 'main', 0); ok(am.list.every(x => !['mobility', 'breathing'].includes(CT.exFacts(EX_BY_ID[x.id]).type)), 'strength slot is not offered a stretch'); }
{ const w = { params: { equipment: [], exclude: root_all_but(['pike_pushup']) }, warm: [], main: [{ ex: 'pike_pushup', sets: 2, reps: 8, rest: 60 }], cool: [] };
  const a = B.alternatives(w, 'main', 0); ok(!a.list.length && /אין|הוחרגו/.test(a.reason), 'no safe alternative → says so instead of inventing one', a.reason); }
{ const w = { params: { equipment: [] }, warm: [], main: [{ ex: 'doorframe_row', sets: 2, reps: 8, rest: 60 }], cool: [] };
  const a = B.alternatives(w, 'main', 0); ok(a.list.every(x => CT.usableWith(EX_BY_ID[x.id], ['none'])), 'limited equipment: only no-equipment alternatives'); }
{ const w = { params: { equipment: [], fav: ['knee_pushup', 'incline_pushup'] }, warm: [], main: [{ ex: 'pushup', sets: 2, reps: 8, rest: 60 }, { ex: 'knee_pushup', sets: 2, reps: 8, rest: 60 }], cool: [] };
  const a = B.alternatives(w, 'main', 0); ok(!a.list.some(x => x.id === 'knee_pushup'), 'favourites already in use are not offered twice'); }
{ const a = Plans.rank({ ex: 'no_such_exercise', sets: 2, reps: 8 }, { phase: 'main' }); ok(!a.list.length && /לא נמצא/.test(a.reason), 'unclassified / unknown exercise → no invented alternative'); }
{ const a = Plans.rank({ ex: 'squat', sets: 2, reps: 10, rest: 60 }, { have: ['none'], level: 'beginner', phase: 'main' }); const hard = a.list.filter(x => x.d > 2); ok(hard.every(x => x.diffs.includes('מעל הרמה שהגדרת')), 'harder-than-level alternatives are labelled'); }

G = 'CSV export';
ok(X.cell('a,b') === '"a,b"' && X.cell('he said "hi"') === '"he said ""hi"""' && X.cell('line1\nline2') === '"line1\nline2"', 'RFC 4180 quoting: comma, quotes, newline');
ok(X.cell('=HYPERLINK("x")') === '"\'=HYPERLINK(""x"")"' && X.cell('+1') === "'+1" && X.cell('-cmd') === "'-cmd" && X.cell('@SUM(A1)') === "'@SUM(A1)" && X.cell(-5) === '-5', 'formula injection guarded for text (= + - @), numbers stay numbers');
localStorage._ = {}; ['profile', 'workouts', 'nutrition', 'tracking', 'plans', 'meta'].forEach(k => { delete require.cache[require.resolve(path.join(ROOT, 'src/js/store.js'))]; });
require(path.join(ROOT, 'src/js/store.js'));
{ const fs = X.files(); ok(fs.length === 8 && fs.every(f => f.csv.startsWith(X.BOM) && f.csv.endsWith('\r\n')), 'empty data: 8 valid files with BOM and CRLF'); ok(fs.filter(f => f.name !== 'profile.csv').every(f => f.n === 0 && f.csv.split('\r\n').length === 2), 'empty categories → header row only (nothing invented)'); }
{ const pr = globalThis.Store.load('profile'); Object.assign(pr, { name: '=cmd|"/c calc"!A1', age: 34, height: 172, weight: 78, sex: 'f' }); globalThis.Store.save('profile');
  const C = globalThis.Core; C.addEntry('2026-10-20', { slot: 'm1', name: 'שקשוקה, "חריפה"\nעם לחם', k: 450.4, p: 22.1, c: 40, f: 20, fb: 6 });
  C.setDaily('2026-10-20', { water: 1500, waterGoal: 3000 }); C.setDaily('2026-10-21', { sleep: 7.5 });
  localStorage.setItem('fit30.account', JSON.stringify({ access_token: 'eyJSECRET', refresh_token: 'REFRESHSECRET' })); localStorage.setItem('sb-local-auth-token', 'SECRET2');
  const fs = X.files(), txt = fs.map(f => f.csv).join('\n');
  ok(!/SECRET|access_token|refresh_token/.test(txt), 'no tokens or account secrets in any file');
  const prof = fs.find(f => f.name === 'profile.csv').csv; ok(/name,"'=cmd\|""\/c calc""!A1"/.test(prof), 'a user name that looks like a formula is neutralised and quoted', prof.split('\r\n')[1]);
  const nj = fs.find(f => f.name === 'nutrition_journal.csv'); ok(nj.n === 1 && nj.csv.includes('"שקשוקה, ""חריפה""\nעם לחם"') && nj.csv.includes(',450.4,22.1,'), 'Hebrew, comma, quotes and newline survive; numbers exact');
  const dt = fs.find(f => f.name === 'daily_tracking.csv'); ok(dt.n === 2 && /2026-10-20,1500,3000,,,,/.test(dt.csv) && /2026-10-21,,,,,7\.5,/.test(dt.csv), 'partial data: missing values are empty, never 0', dt.csv);
  ok(/T.*Z/.test(nj.csv.split('\r\n')[1].split(',').pop()), 'timestamps are ISO-8601 UTC; dates are the app\'s local calendar day'); }
{ const C = globalThis.Core; for (let i = 0; i < 600; i++) C.addEntry('2026-09-' + String(1 + i % 28).padStart(2, '0'), { slot: 'm2', name: 'מנה ' + i, k: i, p: 1, c: 1, f: 1, fb: 0 });
  const nj = X.files().find(f => f.name === 'nutrition_journal.csv'), lines = nj.csv.slice(1).trim().split('\r\n'); ok(nj.n === 601 && lines.length === 602 && lines.every(l => l.split(',').length >= 13 || l.includes('"')), 'larger data (600+ rows): every row exported with the full column set'); }
{ const src = require('fs').readFileSync(path.join(ROOT, 'src/js/export_csv.js'), 'utf8'); ok(!/fetch\(|XMLHttpRequest|sendBeacon|\/rest\/v1/.test(src), 'export code makes no network request (built from the local store only — it cannot contain another user\'s data)'); }

let pass = 0, fail = 0; for (const r of res) { console.log(`${r.ok ? 'PASS' : 'FAIL'} [${r.g}] ${r.m}`); r.ok ? pass++ : fail++; }
console.log(`builder tests: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
