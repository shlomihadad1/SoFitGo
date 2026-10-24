/* Stage D tests (Node): plan-aware data behind the redesigned screens. Independent recomputation from Plans.days().
   Covers the gaps found in the audit: daily task progress and exercise history must follow the ACTIVE plan (and keep
   older plans' logs), the week strip / month grid must show the plan's real dates, consistency must follow its stated rule.
   Writes dist/reports/stageD-test.json */
const fs = require('fs'), path = require('path'); const ROOT = path.join(__dirname, '..');
for (const f of ['src/js/figure.js', 'src/data/exercises.js', 'src/data/workouts.js', 'src/data/nutrition.js', 'src/data/recipes_intl.js', 'src/data/recipes_med.js', 'src/data/catalog.js', 'src/data/programs.js', 'src/js/logic.js', 'src/js/planner.js', 'src/js/plans.js', 'src/js/mealplanner.js', 'src/js/store.js', 'src/js/core.js', 'src/js/insights.js']) require(path.join(ROOT, f));
const { Store: S, Core: C, Plans: PS, Insights: I } = globalThis;
let pass = 0, fail = 0; const fails = [], sec = {}; let cur = '';
const T = n => { cur = n; sec[n] = { pass: 0, fail: 0 }; }, ok = (c, m) => { if (c) { pass++; sec[cur].pass++; } else { fail++; sec[cur].fail++; fails.push(cur + ': ' + m); } };
let NOW = '2026-10-19'; S.today = () => NOW;
const user = () => { S.resetAll(); NOW = '2026-10-19'; const p = S.load('profile'); Object.assign(p, { age: 32, height: 187, weight: 85, startWeight: 85, sex: 'm', experience: 'beginner', aims: { primary: 'fat_loss', secondary: [] } }); p.availability = { days: [1, 3, 5], sessions: 3, prefMin: null, maxMin: 30 }; S.save('profile'); return p; };
const act = (tid, start, len) => PS.activate(PS.create(tid, PS.paramsFromProfile(S.load('profile')), start || NOW, len), { confirmReplace: true });
const sets = (d, reps) => (d.main || []).map((it, i) => ({ key: i, done: true, ex: it.ex, sec: 'main', set: 1, reps: it.reps ? reps : undefined, secs: it.reps ? undefined : 30 }));

T('week strip & month grid');
user(); { const p = act('general_90'); const ds = PS.days(p);
  for (const probe of ['2026-10-19', '2026-11-04', '2026-12-31']) { NOW = probe; const w = I.weekStrip(p, probe);
    ok(w.length === 7 && S.parse(w[0].date).getDay() === 0 && w.some(c => c.date === probe && c.isToday), `week strip ${probe}: 7 days, Sunday first, contains today`);
    ok(w.every(c => { const exp = ds.filter(d => d.date === c.date); return exp.length ? (c.day && exp.some(e => e.n === c.day.n)) : !c.day; }), `week strip ${probe}: every cell is the plan day on that date (or none)`); }
  NOW = '2026-10-19'; const months = I.planMonths(p);
  ok(months[0] === '2026-10' && months[months.length - 1] === ds[ds.length - 1].date.slice(0, 7), 'plan months span start → end (' + months.join(',') + ')');
  let cells = 0, wrong = 0; months.forEach(ym => I.monthGrid(p, ym).forEach(r => { ok(r.length === 7, ym + ': rows have 7 cells'); r.forEach(c => { if (!c.inMonth || !c.day) return; cells++; if (c.day.date !== c.date) wrong++; }); }));
  ok(cells === ds.length && wrong === 0, `month grids show all ${ds.length} plan days exactly once on their dates (${cells})`); }

T('calendar follows the active plan after switching');
user(); { const a = act('general_90'); NOW = '2026-10-25'; const b = act('fatloss_30', '2026-10-26');
  const g = I.monthGrid(PS.active(), '2026-10'); const cell = g.flat().find(c => c.date === '2026-10-27');
  ok(PS.active().id === b.id && cell.day && PS.days(b).some(d => d.n === cell.day.n && d.date === '2026-10-27'), 'after switching, the calendar shows the new plan days');
  ok(!g.flat().some(c => c.inMonth && c.date < '2026-10-26' && c.day), 'days before the new plan start are not attributed to it'); }

T('daily task progress is plan-aware');
user(); { const p = act('general_90'); const ds = PS.days(p); const rest = ds.find(d => !PS.isTraining(d) && d.date >= NOW), tr = ds.find(d => PS.isTraining(d) && d.date >= NOW);
  ok(!C.dailyProgress(rest.date).tasks.some(t => t.k === 'workout'), 'plan rest day: no workout task (classic program ignored)');
  ok(C.dailyProgress(tr.date).tasks.some(t => t.k === 'workout' && t.v === 0), 'plan training day: one workout task, not done yet');
  NOW = tr.date; PS.logDay(p.id, tr.n, { status: 'done', sets: sets(tr, 10) }); ok(C.dailyProgress(tr.date).tasks.find(t => t.k === 'workout').v === 1, 'logging the plan workout completes the task');
  const t2 = PS.days(p).find(d => PS.isTraining(d) && d.date > NOW); PS.skip(p.id, t2.n); ok(!C.dailyProgress(t2.date).tasks.some(t => t.k === 'workout'), 'a skipped plan workout is not counted as an open task');
  S.resetAll(); const pr = S.load('profile'); pr.startDate = '2026-10-19'; S.save('profile'); NOW = '2026-10-19';
  ok(C.dailyProgress('2026-10-19').tasks.some(t => t.k === 'workout') === C.isTraining(1), 'without a plan, the classic program behaviour is unchanged'); }

T('exercise history includes plan workouts');
user(); { const a = act('general_90'); const d1 = PS.days(a).find(d => PS.isTraining(d) && d.main && d.main.some(it => it.reps));
  NOW = d1.date; PS.logDay(a.id, d1.n, { status: 'done', sets: sets(d1, 8) });
  NOW = S.addDays(d1.date, 2); const b = act('fatloss_30', NOW); const d2 = PS.days(b).find(d => PS.isTraining(d) && d.main && d.main.some(it => it.reps) && d.date >= NOW);
  NOW = d2.date; PS.logDay(b.id, d2.n, { status: 'done', sets: sets(d2, 12) });
  const w = S.load('workouts'); w.days[3] = { status: 'done', date: '2026-10-10', sets: [{ done: true, ex: d1.main.find(it => it.reps).ex, sec: 'main', set: 1, reps: 5 }] }; S.save('workouts');
  const h = C.exerciseHistory(), ex1 = d1.main.find(it => it.reps).ex;
  ok(h[ex1] && h[ex1].some(x => x.src === 'plan' && x.v === 8), 'workout from the replaced plan is kept in the history');
  ok(h[ex1] && h[ex1].some(x => x.src === 'classic' && x.v === 5), 'classic 30-day log is included');
  ok(Object.values(h).every(l => l.every((x, i) => !i || l[i - 1].date <= x.date)), 'history ordered by date');
  const ex2 = d2.main.find(it => it.reps).ex; ok(h[ex2] && h[ex2].some(x => x.v === 12), 'active plan workout included'); }

T('consistency rule');
user(); { const p = act('general_90'); const ws0 = I.planWeeks(p);
  const indep = PS.days(p).filter(PS.isTraining).length; ok(ws0.reduce((s, w) => s + w.sessions, 0) === indep, 'plan weeks cover every training day once');
  // week 1: do all; week 2: do 1 of 3 (not kept); week 3: do 2 of 3 (kept), with one skip in week 4 that should not count
  const byW = w => PS.days(p).filter(d => d.week === w && PS.isTraining(d));
  const doN = (w, k) => byW(w).slice(0, k).forEach(d => { NOW = d.date; PS.logDay(p.id, d.n, { status: 'done' }); });
  doN(1, byW(1).length); doN(2, 1); doN(3, Math.ceil(byW(3).length * 2 / 3));
  NOW = S.addDays(byW(3)[byW(3).length - 1].date, 1); const w4 = byW(4); PS.skip(p.id, w4[0].n);
  NOW = S.addDays(PS.days(p).filter(d => d.week === 3).pop().date, 1);
  const cs = I.consistency(p);
  ok(cs.weeksPast === 3 && cs.weeksKept === 2 && cs.streak === 1, `kept weeks 2/3, streak 1 (got ${cs.weeksKept}/${cs.weeksPast}, ${cs.streak})`);
  const w4s = I.planWeeks(p).find(w => w.w === 4); ok(w4s.planned === w4s.sessions - 1 && w4s.skipped === 1, 'a deliberate skip is removed from "planned", not counted as failure');
  ok(/2\/3/.test(cs.rule), 'the rule is stated in the result'); }

T('next training & tests');
user(); { const p = act('general_90'); const nx = I.nextTraining(p); const exp = PS.days(p).filter(d => PS.isTraining(d) && d.date >= NOW).sort((a, b) => a.date < b.date ? -1 : 1)[0];
  ok(nx && nx.n === exp.n, 'next training = first open training day');
  ok(I.planTests(p) === null, 'no plan tests → null (nothing invented)');
  const as = PS.days(p).filter(d => d.type === 'assess'); NOW = as[0].date; PS.logDay(p.id, as[0].n, { status: 'done', tests: { pushup: 12, plank: 40 } });
  const t1 = I.planTests(p); ok(t1.first.r.pushup === 12 && t1.last === null, 'one test logged: shown as first, no comparison');
  if (as[1]) { NOW = as[1].date; PS.logDay(p.id, as[1].n, { status: 'done', tests: { pushup: 15 } }); const t2 = I.planTests(p); ok(t2.last.r.pushup === 15 && t2.last.r.plank == null, 'second test compared; missing result stays missing'); } }

T('greeting');
ok(I.greeting(7) === 'בוקר טוב' && I.greeting(13) === 'צהריים טובים' && I.greeting(19) === 'ערב טוב' && I.greeting(23) === 'לילה טוב', 'greeting by hour');

fs.mkdirSync(path.join(ROOT, 'dist/reports'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'dist/reports/stageD-test.json'), JSON.stringify({ pass, fail, sections: sec, fails }, null, 1));
if (fails.length) console.log('FAILURES:\n' + fails.join('\n')); console.log(JSON.stringify(sec)); console.log(`stage D tests: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
