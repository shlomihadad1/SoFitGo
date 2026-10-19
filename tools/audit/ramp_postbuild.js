/* Does adding sets AFTER the plan is built bypass the gradual-load control? (read-only; runs against <root>)
   Usage: node tools/audit/ramp_postbuild.js <root>
   Part A — structural: activate a real plan, add +1 set (the R-UP "already hard → +1 set" step) through Plans.adjust to every
            eligible exercise of one future session, read the effective day back with Plans.days, and check whether anything
            re-applies the ramp.
   Part B — bound: over all 126 standard plans, for every consecutive same-type pair, the volume ratio if R-UP's +1 set were
            applied to ONE exercise, or to EVERY eligible exercise (non-circuit, sets < 5 — the R-UP limits in adapt.js), of the
            later session. This is an upper bound of what the rules allow, not a frequency (Adapt also needs 2 logged sessions
            that met target, effort ≤ 7, the exercise already at "hard", and ≤ 1 step per exercise per 14 days). */
const path = require('path'); const ROOT = path.resolve(process.argv[2]);
for (const f of ['src/js/figure.js', 'src/data/exercises.js', 'src/data/workouts.js', 'src/data/nutrition.js', 'src/data/recipes_intl.js', 'src/data/catalog.js', 'src/data/programs.js', 'src/js/logic.js', 'src/js/planner.js', 'src/js/plans.js', 'src/js/mealplanner.js', 'src/js/store.js', 'src/js/core.js', 'src/js/adapt.js']) require(path.join(ROOT, f));
const { Store: S, Plans: PS, PROGRAMS: PG, Planner: P } = globalThis;
const vol = d => (d.main || []).reduce((s, x) => s + (x.sets || 1) * (typeof x.reps === 'number' ? x.reps : typeof x.sec === 'number' ? x.sec / 3 : 1), 0);
const reg = d => d.main && d.main.length && !['rest', 'active', 'assess'].includes(d.type) && !d.deload;
const elig = x => !x.circuit && (x.sets || 1) < 5;
const res = {};
/* Part A */
{ let NOW = '2026-10-19'; S.today = () => NOW; S.resetAll(); const pr = S.load('profile');
  Object.assign(pr, { age: 32, height: 180, weight: 80, startWeight: 80, sex: 'm', experience: 'intermediate', aims: { primary: 'general', secondary: [] } });
  pr.availability = { days: [1, 3, 5], sessions: 3, maxMin: 60 }; pr.environment = { equipment: [] }; S.save('profile');
  const pl = PS.activate(PS.create('general_90', PS.paramsFromProfile(pr), NOW)); const id = pl.id;
  const ds = PS.days(PS.get(id)); const last = {}; let pair = null;
  for (const d of ds) { if (!reg(d)) continue; const a = last[d.type]; if (a && d.date > NOW && a.date > NOW && d.main.filter(elig).length >= 3) { pair = [a, d]; break; } last[d.type] = d; }
  const before = vol(pair[1]) / vol(pair[0]); pair[1].main.filter(elig).forEach(x => PS.adjust(id, pair[1].n, x.ex, { sets: 1, rule: 'up' }));
  const eff = PS.days(PS.get(id)).find(d => d.n === pair[1].n), prev = PS.days(PS.get(id)).find(d => d.n === pair[0].n);
  res.structural = { plan: 'general_90 / intermediate / 3×week', previousDay: pair[0].n, day: pair[1].n, exercisesAdjusted: pair[1].main.filter(elig).length,
    ratioBefore: +before.toFixed(2), ratioAfter: +(vol(eff) / vol(prev)).toFixed(2), rampReappliedAfterAdjust: !!(eff.ramped && eff.ramped !== pair[1].ramped) || eff.notes.some(n => /עלייה הדרגתית/.test(n) && !pair[1].notes.includes(n)),
    adjustedMarked: eff.main.filter(x => x.adjusted).length }; }
/* Part B */
{ const one = [], all = []; let pairs = 0;
  for (const t of PG.TEMPLATES.filter(t => !t.classic && !(t.needsLibrary || []).length)) for (const level of ['beginner', 'intermediate', 'advanced']) for (const goal of t.goals) for (const spw of [3, 5]) {
    const r = P.build(t.id, { start: '2026-10-19', days: t.custom ? 90 : t.days, profile: { level, days: [0, 1, 2, 3, 4, 5, 6], spw, maxMin: 45, equipment: [] }, goal }); const last = {};
    r.days.forEach(d => { if (!reg(d)) return; const a = last[d.type]; if (a) { pairs++; const base = vol(d), E = d.main.filter(elig);
      const per = x => typeof x.reps === 'number' ? x.reps : typeof x.sec === 'number' ? x.sec / 3 : 1;
      if (E.length) { one.push((base + Math.max(...E.map(per))) / vol(a)); all.push((base + E.reduce((s, x) => s + per(x), 0)) / vol(a)); } }
      last[d.type] = d; }); }
  const st = a => { const s = a.slice().sort((x, y) => x - y); return { n: a.length, over25: a.filter(v => v > 1.25 + 1e-9).length, median: +s[Math.floor(s.length / 2)].toFixed(2), max: +s[s.length - 1].toFixed(2) }; };
  res.upperBound = { pairs, plusOneSetOnOneExercise: st(one), plusOneSetOnEveryEligibleExercise: st(all) }; }
console.log(JSON.stringify(res, null, 1));
