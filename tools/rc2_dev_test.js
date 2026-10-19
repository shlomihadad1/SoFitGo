/* RC2-dev regression tests (Node). TD-19: the plan summary shown in the program preview ("N different sessions",
   most repeated session) must describe the sessions actually generated — i.e. after the gradual-load ramp.
   Usage: node tools/rc2_dev_test.js [root]   (pass another copy's root to check it; RC1 is expected to FAIL §1). */
const fs = require('fs'), path = require('path'); const ROOT = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, '..');
for (const f of ['src/js/figure.js', 'src/data/exercises.js', 'src/data/workouts.js', 'src/data/nutrition.js', 'src/data/recipes_intl.js', 'src/data/catalog.js', 'src/data/programs.js', 'src/js/logic.js', 'src/js/planner.js']) require(path.join(ROOT, f));
const { PROGRAMS: PG, Planner: P } = globalThis; const NOW = '2026-10-19';
let pass = 0, fail = 0; const fails = []; const ok = (c, m, info) => { if (c) pass++; else { fail++; fails.push(m + (info !== undefined ? ' → ' + JSON.stringify(info).slice(0, 300) : '')); } };
const sigOf = d => d.type + ':' + d.main.map(x => x.ex + (x.reps || x.sec) + 'x' + x.sets).join(',');

/* §1 summary matches the generated sessions, for every standard template × level × goal × 3/5 sessions a week */
{ let plans = 0; const bad = [];
  for (const t of PG.TEMPLATES.filter(t => !t.classic && !(t.needsLibrary || []).length)) for (const level of ['beginner', 'intermediate', 'advanced']) for (const goal of t.goals) for (const spw of [3, 5]) {
    const r = P.build(t.id, { start: NOW, days: t.custom ? 90 : t.days, profile: { level, days: [0, 1, 2, 3, 4, 5, 6], spw, maxMin: 45, equipment: [] }, goal }); plans++;
    const m = new Map(); r.days.filter(d => d.main && d.type !== 'active').forEach(d => m.set(sigOf(d), (m.get(sigOf(d)) || 0) + 1));
    const most = m.size ? Math.max(...m.values()) : 0;
    if (m.size !== r.summary.distinctSessions || most !== r.summary.mostRepeated) bad.push(`${t.id}/${level}/${goal}/${spw}: shown ${r.summary.distinctSessions}/${r.summary.mostRepeated}, actual ${m.size}/${most}`); }
  ok(bad.length === 0, `${plans} plans: "distinct sessions" and "most repeated" in the preview match the generated sessions`, bad.slice(0, 5)); }

/* §2 sanity: the build stays deterministic and ramp notes are kept. (That the generated DAYS are byte-identical to RC1 for all
   126 plans was checked once by hashing both copies' output — see RC2-DEV-CHANGES.md; it cannot be asserted from one copy.) */
{ const a = P.build('general_90', { start: NOW, profile: { level: 'intermediate', days: [1, 3, 5], spw: 3, maxMin: 45, equipment: [] }, goal: 'general' }),
    b = P.build('general_90', { start: NOW, profile: { level: 'intermediate', days: [1, 3, 5], spw: 3, maxMin: 45, equipment: [] }, goal: 'general' });
  ok(JSON.stringify(a.days) === JSON.stringify(b.days), 'build is deterministic (same inputs → same days)');
  ok(a.days.some(d => d.ramped) ? a.days.filter(d => d.ramped).every(d => d.notes.some(n => /עלייה הדרגתית/.test(n))) : true, 'ramped sessions still carry their explanation'); }

console.log(fails.length ? 'FAILURES:\n - ' + fails.join('\n - ') : ''); console.log(`rc2-dev tests: pass ${pass} fail ${fail}`);
if (!process.argv[2]) { fs.mkdirSync(path.join(ROOT, 'dist/reports'), { recursive: true }); fs.writeFileSync(path.join(ROOT, 'dist/reports/rc2-dev-test.json'), JSON.stringify({ pass, fail, fails }, null, 1)); }
process.exit(fail ? 1 : 0);
