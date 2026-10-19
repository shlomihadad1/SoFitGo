/* Ramp re-check (read-only; runs against a copy given as <root>; writes only to <outdir>).
   Usage: node tools/audit/ramp_recheck.js <root> <outdir>
   Part 1 — at build time, over all 126 standard plans: split consecutive same-type regular sessions into pairs with the SAME
            exercise list vs DIFFERENT lists; also a per-exercise comparison (same exercise, previous same-type session).
   Part 2 — after build: runs the existing soak scenarios (a scratch copy of tools/soak_test.js with a probe inserted, so the
            original file is untouched) and measures, on the EFFECTIVE plan days (Plans.days, i.e. with approved adaptations),
            how many consecutive same-type pairs exceed +25 %, and how many of those exceed it only because of adaptations. */
const fs = require('fs'), path = require('path'); const ROOT = path.resolve(process.argv[2]), OUT = path.resolve(process.argv[3] || '.');
const vol = d => (d.main || []).reduce((s, x) => s + (x.sets || 1) * (typeof x.reps === 'number' ? x.reps : typeof x.sec === 'number' ? x.sec / 3 : 1), 0);
const reg = d => d.main && d.main.length && !['rest', 'active', 'assess'].includes(d.type) && !d.deload;
const pairsOf = days => { const last = {}, out = []; days.forEach(d => { if (!reg(d)) return; if (last[d.type]) out.push([last[d.type], d]); last[d.type] = d; }); return out; };
const stat = a => { if (!a.length) return { n: 0 }; const s = a.slice().sort((x, y) => x - y); return { n: a.length, over25: a.filter(r => r > 1.25 + 1e-9).length, max: +s[s.length - 1].toFixed(2), p95: +s[Math.floor(s.length * 0.95)].toFixed(2), median: +s[Math.floor(s.length / 2)].toFixed(2) }; };
const res = {};
/* Part 1 */
{ for (const f of ['src/js/figure.js', 'src/data/exercises.js', 'src/data/workouts.js', 'src/data/nutrition.js', 'src/data/recipes_intl.js', 'src/data/catalog.js', 'src/data/programs.js', 'src/js/logic.js', 'src/js/planner.js']) require(path.join(ROOT, f));
  const { PROGRAMS: PG, Planner: P } = globalThis; const same = [], diff = [], perEx = []; let perExOverWithRamp = 0;
  for (const t of PG.TEMPLATES.filter(t => !t.classic && !(t.needsLibrary || []).length)) for (const level of ['beginner', 'intermediate', 'advanced']) for (const goal of t.goals) for (const spw of [3, 5]) {
    const r = P.build(t.id, { start: '2026-10-19', days: t.custom ? 90 : t.days, profile: { level, days: [0, 1, 2, 3, 4, 5, 6], spw, maxMin: 45, equipment: [] }, goal });
    pairsOf(r.days).forEach(([a, b]) => { const ratio = vol(b) / vol(a); (a.main.map(x => x.ex).join() === b.main.map(x => x.ex).join() ? same : diff).push(ratio); });
    const lastEx = {}; r.days.forEach(d => { if (!reg(d)) return; d.main.forEach(x => { const k = d.type + '|' + x.ex, v = (x.sets || 1) * (typeof x.reps === 'number' ? x.reps : typeof x.sec === 'number' ? x.sec / 3 : 1);
      if (lastEx[k]) { perEx.push(v / lastEx[k]); if (v / lastEx[k] > 1.25 + 1e-9 && d.ramped) perExOverWithRamp++; } lastEx[k] = v; }); }); }
  res.buildTime = { sameExercisePairs: stat(same), differentExercisePairs: stat(diff), perExercise: stat(perEx), perExerciseOver25InRampedSessions: perExOverWithRamp }; }
/* Part 2 */
{ let src = fs.readFileSync(path.join(ROOT, 'tools/soak_test.js'), 'utf8');
  src = src.replace("path.join(__dirname, '..')", JSON.stringify(ROOT)).replace("const st = PS.stats(PS.get(id)),", "globalThis.__probe && globalThis.__probe(PS.get(id), sc.name);\nconst st = PS.stats(PS.get(id)),")
    .replace(/fs\.mkdirSync\(path\.join\(ROOT, 'dist\/reports'\)[^\n]*/, `fs.writeFileSync(${JSON.stringify(path.join(OUT, 'soak-probe-copy.json'))}, JSON.stringify(all, null, 1));`);
  if (!src.includes('__probe')) throw new Error('probe not inserted'); const tmp = path.join(OUT, 'soak_probe_copy.js'); fs.writeFileSync(tmp, src);
  res.afterAdaptation = []; const origExit = process.exit; process.exit = () => {};
  globalThis.__probe = (plan, name) => { const PS = globalThis.Plans; const eff = PS.days(plan); const raw = PS.days(Object.assign({}, plan, { overrides: Object.fromEntries(Object.entries(plan.overrides || {}).map(([k, v]) => [k, Object.assign({}, v, { adj: {} })])) }));
    const rawBy = new Map(raw.map(d => [d.n, d])); let pairs = 0, over = 0, overOnlyBecauseAdj = 0, adjDays = 0; const ex = [];
    eff.forEach(d => { if (d.adapted || (d.main || []).some(x => x.adjusted)) adjDays++; });
    const cause = {}; pairsOf(eff).forEach(([a, b]) => { pairs++; const r = vol(b) / vol(a); if (r > 1.25 + 1e-9) { over++;
      const c = a.version === 'short' ? 'previous session in the SHORT version' : b.version === 'long' ? 'this session in the LONG version' : (b.adapted || (b.main || []).some(x => x.adjusted)) ? 'adaptation (+sets/level) on this session' : (a.overridden || b.overridden) ? 'exercise swap' : (a.log || b.log) ? 'logged snapshot differs from plan' : 'other'; cause[c] = (cause[c] || 0) + 1; const rr = vol(rawBy.get(b.n)) / vol(rawBy.get(a.n)); if (rr <= 1.25 + 1e-9) { overOnlyBecauseAdj++; if (ex.length < 3) ex.push(`day ${b.n}: ×${r.toFixed(2)} (without adaptations ×${rr.toFixed(2)})${b.log ? ' [logged]' : ''}`); } } });
    res.afterAdaptation.push({ scenario: name, causesOfOver25: cause, pairs, over25: over, over25OnlyBecauseOfAdaptations: overOnlyBecauseAdj, daysWithAdaptations: adjDays, examples: ex }); };
  require(tmp); process.exit = origExit; }
fs.writeFileSync(path.join(OUT, 'ramp-recheck.json'), JSON.stringify(res, null, 1)); console.log(JSON.stringify(res, null, 1));
