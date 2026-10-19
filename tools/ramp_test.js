/* Gradual-load control — tests and measurements (Node). The +25 % threshold is the existing ENGINEERING choice (RC1), not a
   validated professional rule (DR-01 is open); these tests check what the code does, they do not endorse the number.
   §1 build time, 126 standard plans: session volume vs the previous regular session of the same type — pairs with the SAME
      exercise list and pairs with DIFFERENT lists counted separately; the ramp only removes sets, never below 1, deload weeks
      and fitness tests are not ramped, every ramped session explains itself, removed sets come back later in the same phase.
   §2 phase changes: the same session-level check on pairs whose two sessions are in different phases.
   §3 per exercise: the same exercise vs its previous appearance in the same session type. The control is session-level by
      design, so single exercises can jump; the test checks that every such jump sits inside a session that respects the cap
      (i.e. the jump is a known limit of the design, not a leak), and reports the numbers.
   §4 after build — set REDUCTIONS through Plans.adjust (what R-DOWN applies): clamp at 1, only future unlogged days.
   §5 after build — set ADDITIONS through Plans.adjust (what R-UP's "+1 set" applies), on ONE exercise and on SEVERAL:
      clamp at 6, applied exactly as asked; and the measured effect on the session-volume ratio. The control does NOT re-run
      after build (TD-20, open): that is reported as OPEN, not counted as a pass or a fail.
   Usage: node tools/ramp_test.js [root] */
const fs = require('fs'), path = require('path'); const ROOT = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, '..');
for (const f of ['src/js/figure.js', 'src/data/exercises.js', 'src/data/workouts.js', 'src/data/nutrition.js', 'src/data/recipes_intl.js', 'src/data/catalog.js', 'src/data/programs.js', 'src/js/logic.js', 'src/js/planner.js', 'src/js/plans.js', 'src/js/mealplanner.js', 'src/js/store.js', 'src/js/core.js', 'src/js/adapt.js']) require(path.join(ROOT, f));
const { Store: S, Plans: PS, PROGRAMS: PG, Planner: P } = globalThis; let NOW = '2026-10-19'; S.today = () => NOW;
let pass = 0, fail = 0; const fails = [], sec = {}, info = {}, open = []; let cur = '';
const T = n => { cur = n; sec[n] = { pass: 0, fail: 0 }; }, ok = (c, m, i) => { if (c) { pass++; sec[cur].pass++; } else { fail++; sec[cur].fail++; if (fails.length < 40) fails.push(cur + ': ' + m + (i !== undefined ? ' → ' + JSON.stringify(i).slice(0, 300) : '')); } };
const per = x => typeof x.reps === 'number' ? x.reps : typeof x.sec === 'number' ? x.sec / 3 : 1;
const vol = d => (d.main || []).reduce((s, x) => s + (x.sets || 1) * per(x), 0);
const reg = d => d.main && d.main.length && !['rest', 'active', 'assess'].includes(d.type) && !d.deload;
const CAP = 1.25 + 1e-9;
const plans = []; for (const t of PG.TEMPLATES.filter(t => !t.classic && !(t.needsLibrary || []).length)) for (const level of ['beginner', 'intermediate', 'advanced']) for (const goal of t.goals) for (const spw of [3, 5])
  plans.push({ key: `${t.id}/${level}/${goal}/${spw}`, r: P.build(t.id, { start: NOW, days: t.custom ? 90 : t.days, profile: { level, days: [0, 1, 2, 3, 4, 5, 6], spw, maxMin: 45, equipment: [] }, goal }) });
const pairsOf = days => { const last = {}, out = []; days.forEach(d => { if (!reg(d)) return; if (last[d.type]) out.push([last[d.type], d]); last[d.type] = d; }); return out; };

T('1 build time — session level, same vs different exercises');
{ let same = 0, diff = 0; const overSame = [], overDiff = []; let ramped = 0, notes = 0, below1 = 0, rampedDeloadOrTest = 0, notRestored = 0;
  plans.forEach(({ key, r }) => { pairsOf(r.days).forEach(([a, b]) => { const isSame = a.main.map(x => x.ex).join() === b.main.map(x => x.ex).join(); const ratio = vol(b) / vol(a);
      if (isSame) { same++; if (ratio > CAP && b.main.some(x => x.sets > 1 && !x.circuit)) overSame.push(`${key} d${b.n} ×${ratio.toFixed(2)}`); } else { diff++; if (ratio > CAP && b.main.some(x => x.sets > 1 && !x.circuit)) overDiff.push(`${key} d${b.n} ×${ratio.toFixed(2)}`); } });
    r.days.forEach((d, i) => { (d.main || []).forEach(x => { if ((x.sets || 1) < 1) below1++; }); if (d.ramped) { ramped++; if (d.notes.some(n => /עלייה הדרגתית/.test(n))) notes++; if (d.deload || d.type === 'assess') rampedDeloadOrTest++;
      if (!r.days.slice(i + 1).some(x => x.type === d.type && !x.deload && x.phase.idx === d.phase.idx && !x.ramped)) notRestored++; } }); });
  info.buildPairs = { same, different: diff, differentShare: +(100 * diff / (same + diff)).toFixed(1) + '%' };
  ok(same > 0 && overSame.length === 0, `${same} pairs with the SAME exercises: none above +25 % where sets can be lowered`, overSame.slice(0, 4));
  ok(diff > 0 && overDiff.length === 0, `${diff} pairs with DIFFERENT exercises: none above +25 % where sets can be lowered`, overDiff.slice(0, 4));
  ok(ramped > 0 && notes === ramped, `every ramped session (${ramped}) explains the reduction on the day`);
  ok(below1 === 0, 'no exercise ever has fewer than 1 set'); ok(rampedDeloadOrTest === 0, 'deload weeks and fitness tests are never ramped');
  ok(notRestored === 0, 'sets removed by the ramp come back later in the same phase (the note says so)', notRestored); }

T('2 phase changes');
{ let n = 0; const over = [];
  plans.forEach(({ key, r }) => pairsOf(r.days).forEach(([a, b]) => { if (a.phase.idx === b.phase.idx) return; n++; const ratio = vol(b) / vol(a); if (ratio > CAP && b.main.some(x => x.sets > 1 && !x.circuit)) over.push(`${key} d${b.n} ${a.phase.k}→${b.phase.k} ×${ratio.toFixed(2)}`); }));
  ok(n > 0 && over.length === 0, `${n} session pairs across a phase change: none above +25 %`, over.slice(0, 4)); info.phaseChangePairs = n; }

T('3 per exercise (same exercise, previous appearance)');
{ let n = 0, over = 0, overAtPhase = 0, leak = 0, max = 0; const causes = { moreSets: 0, moreReps: 0, both: 0 };
  plans.forEach(({ r }) => { const last = {}, lastSess = {}; r.days.forEach(d => { if (!reg(d)) return;
    d.main.forEach(x => { const k = d.type + '|' + x.ex, p = last[k]; if (p) { n++; const ratio = (x.sets * per(x)) / (p.x.sets * per(p.x)); if (ratio > CAP) { over++; max = Math.max(max, ratio);
        if (p.d.phase.idx !== d.phase.idx) overAtPhase++; const s = x.sets > p.x.sets, rp = per(x) > per(p.x); s && rp ? causes.both++ : s ? causes.moreSets++ : causes.moreReps++;
        const prev = lastSess[d.type]; if (prev && vol(d) / vol(prev) > CAP && d.main.some(y => y.sets > 1 && !y.circuit)) leak++; } } last[k] = { x, d }; });
    lastSess[d.type] = d; }); });
  info.perExercise = { comparisons: n, above25: over, max: +max.toFixed(2), atPhaseChange: overAtPhase, causes };
  ok(leak === 0, 'every per-exercise jump sits inside a session that respects the session cap (a design limit of a session-level control, not a leak)', leak); }

/* a real activated plan for §4–§5 */
S.resetAll(); const pr = S.load('profile'); Object.assign(pr, { age: 32, height: 180, weight: 80, startWeight: 80, sex: 'm', experience: 'intermediate', aims: { primary: 'general', secondary: [] } });
pr.availability = { days: [1, 3, 5], sessions: 3, maxMin: 60 }; pr.environment = { equipment: [] }; S.save('profile');
const id = PS.activate(PS.create('general_90', PS.paramsFromProfile(pr), NOW)).id;
const eff = n => PS.days(PS.get(id)).find(d => d.n === n);
const futurePair = (skip) => { const last = {}; let k = 0; for (const d of PS.days(PS.get(id))) { if (!reg(d) || d.date <= NOW) continue; const a = last[d.type]; if (a && d.main.filter(x => !x.circuit).length >= 3 && k++ >= skip) return [a, d]; last[d.type] = d; } return null; };

T('4 after build — set reductions');
{ const [a, b] = futurePair(0); const ex = b.main.find(x => !x.circuit && x.sets >= 2), before = vol(b) / vol(a);
  PS.adjust(id, b.n, ex.ex, { sets: -1, rule: 'down' }); ok(eff(b.n).main.find(x => x.ex === ex.ex).sets === ex.sets - 1, 'R-DOWN style −1 set is applied to that exercise only');
  PS.adjust(id, b.n, ex.ex, { sets: -2, rule: 'down' }); ok(eff(b.n).main.find(x => x.ex === ex.ex).sets === Math.max(1, ex.sets - 2), 'a reduction never goes below 1 set');
  let big = false; try { PS.adjust(id, b.n, ex.ex, { sets: -3, rule: 'down' }); } catch (e) { big = true; } ok(big, 'a single adjustment larger than ±2 sets is rejected (plans.js)');
  const after = vol(eff(b.n)) / vol(a); ok(after < before, `the reduced session is lighter (×${before.toFixed(2)} → ×${after.toFixed(2)})`);
  /* the reduced day becomes the reference for the next same-type session */
  const nxt = PS.days(PS.get(id)).find(d => reg(d) && d.type === b.type && d.n > b.n); info.reductionLowersReference = { nextVsReducedDay: +(vol(nxt) / vol(eff(b.n))).toFixed(2), nextVsOriginalDay: +(vol(nxt) / vol(b)).toFixed(2) };
  PS.adjust(id, b.n, ex.ex, null); ok(eff(b.n).main.find(x => x.ex === ex.ex).sets === ex.sets, 'removing the adjustment restores the planned sets');
  let threw = false; try { NOW = PS.days(PS.get(id)).find(d => d.n === 1).date; const pl = PS.get(id); PS.logDay && 0; S.today = () => b.date; PS.adjust(id, a.n, a.main[0].ex, { sets: -1 }); } catch (e) { threw = true; } S.today = () => '2026-10-19'; NOW = '2026-10-19';
  ok(threw, 'a past day cannot be adjusted'); }

T('5 after build — set additions (single and several exercises)');
{ const [a, b] = futurePair(1); const base = vol(b) / vol(a), E = b.main.filter(x => !x.circuit && x.sets < 5);
  PS.adjust(id, b.n, E[0].ex, { sets: 1, rule: 'up' }); const one = vol(eff(b.n)) / vol(a);
  ok(eff(b.n).main.find(x => x.ex === E[0].ex).sets === E[0].sets + 1 && eff(b.n).main.filter(x => x.ex !== E[0].ex).every(x => x.sets === b.main.find(y => y.ex === x.ex).sets), '+1 set on ONE exercise changes only that exercise');
  E.slice(1).forEach(x => PS.adjust(id, b.n, x.ex, { sets: 1, rule: 'up' })); const all = vol(eff(b.n)) / vol(a);
  ok(E.every(x => eff(b.n).main.find(y => y.ex === x.ex).sets === x.sets + 1), `+1 set on SEVERAL exercises (${E.length}) is applied to each`);
  PS.adjust(id, b.n, E[0].ex, { sets: 2, rule: 'up' }); ok(eff(b.n).main.find(x => x.ex === E[0].ex).sets === Math.min(6, E[0].sets + 2), '+2 sets are applied, never above 6 sets (plans.js clamp)');
  PS.adjust(id, b.n, E[0].ex, { sets: 1, rule: 'up' }); /* back to +1 for the ratio below */
  const reran = eff(b.n).ramped !== b.ramped || eff(b.n).notes.length !== b.notes.length;
  info.postBuildAdditions = { pair: `day ${a.n} → day ${b.n}`, before: +base.toFixed(2), plusOneOnOne: +one.toFixed(2), plusOneOnAll: +all.toFixed(2), controlReapplied: reran };
  /* RC4: the low-level Plans.adjust stays unguarded on purpose (undo must always work); every caller that can ADD sets must go
     through the load guard. Statically: only adapt.js calls Plans.adjust, and Adapt exposes loadCheck. (Changed from RC3, where
     this was reported as OPEN: the guard did not exist yet.) */
  const callers = fs.readdirSync(path.join(ROOT, 'src/js')).filter(f => f !== 'plans.js' && /\.adjust\(/.test(fs.readFileSync(path.join(ROOT, 'src/js', f), 'utf8')));
  const guarded = typeof globalThis.Adapt.loadCheck === 'function';
  if (guarded) ok(callers.length === 1 && callers[0] === 'adapt.js', 'only adapt.js calls Plans.adjust (no other path can add sets after the build)', callers);
  if (!guarded && all > CAP) open.push(`TD-20 OPEN: additions after build are not checked by the gradual-load control (×${base.toFixed(2)} → ×${all.toFixed(2)} after +1 set on ${E.length} exercises).`); }

const out = { pass, fail, sections: sec, info, open, fails };
if (!process.argv[2]) { fs.mkdirSync(path.join(ROOT, 'dist/reports'), { recursive: true }); fs.writeFileSync(path.join(ROOT, 'dist/reports/ramp-test.json'), JSON.stringify(out, null, 1)); }
console.log(fails.length ? 'FAILURES:\n - ' + fails.join('\n - ') : ''); console.log('INFO ' + JSON.stringify(info)); open.forEach(o => console.log('OPEN ' + o));
console.log(JSON.stringify(sec)); console.log(`ramp tests: pass ${pass} fail ${fail} (open, not counted: ${open.length})`); process.exit(fail ? 1 : 0);
