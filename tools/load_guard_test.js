/* RC4 load guard tests (Node, simulated clock). The gradual-load cap that the planner applies at build time (Planner.LOAD_CAP,
   the existing +25 % engineering default — DR-01 still open) now also holds for "+set" changes made AFTER the build:
   §1 loadCheck: +1 set inside the cap → allowed; a change that would push the session above the cap → refused; reductions and
      level changes are never refused.
   §2 R-UP proposals: with the exercise already at "hard" (so R-UP's step is "+1 set"), the set is proposed when the session
      stays within the cap, and NOT proposed — with a written reason in `held` — when it would exceed it.
   §3 apply-time re-check: a "+set" proposal that was valid becomes invalid if other changes push the day up first → apply
      refuses with a reason and changes nothing (all-or-nothing).
   §4 build-time plans are untouched by the guard (same days for 126 standard plans as Planner.build without it — the guard
      lives in Adapt only). Usage: node tools/load_guard_test.js [root] */
const fs = require('fs'), path = require('path'); const ROOT = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, '..');
for (const f of ['src/js/figure.js', 'src/data/exercises.js', 'src/data/workouts.js', 'src/data/nutrition.js', 'src/data/recipes_intl.js', 'src/data/catalog.js', 'src/data/programs.js', 'src/js/logic.js', 'src/js/planner.js', 'src/js/plans.js', 'src/js/mealplanner.js', 'src/js/store.js', 'src/js/core.js', 'src/js/insights.js', 'src/js/adapt.js']) require(path.join(ROOT, f));
const { Store: S, Plans: PS, Adapt: A, Planner: P, PROGRAMS: PG } = globalThis;
let pass = 0, fail = 0; const fails = [], sec = {}; let cur = '';
const T = n => { cur = n; sec[n] = { pass: 0, fail: 0 }; }, ok = (c, m, i) => { if (c) { pass++; sec[cur].pass++; } else { fail++; sec[cur].fail++; if (fails.length < 40) fails.push(cur + ': ' + m + (i !== undefined ? ' → ' + JSON.stringify(i).slice(0, 300) : '')); } };
let NOW = '2026-10-19'; S.today = () => NOW;
const setUser = () => { S.resetAll(); NOW = '2026-10-19'; const p = S.load('profile'); Object.assign(p, { age: 32, height: 187, weight: 85, startWeight: 85, sex: 'm', experience: 'intermediate', aims: { primary: 'general', secondary: [] } }); p.availability = { days: [1, 3, 5], sessions: 3, prefMin: null, maxMin: 60 }; p.environment = { equipment: [] }; S.save('profile'); };
const activate = tid => PS.activate(PS.create(tid, PS.paramsFromProfile(S.load('profile')), NOW), { confirmReplace: true });
const tr = pl => PS.days(PS.get(pl.id)).filter(d => PS.isTraining(d) && d.type !== 'assess' && d.type !== 'active' && !d.deload);
const strengthEx = d => (d.main || []).filter(it => !it.circuit && typeof it.reps === 'number');
function logAt(pl, d, rpe) { NOW = d.date; const dd = PS.dayOf(PS.get(pl.id), d.n), sets = [];
  (dd.main || []).concat(dd.finisher || []).forEach(it => { for (let k = 1; k <= (it.sets || 1); k++) { const rec = { done: true, ex: it.ex, sec: 'main', set: k }; if (typeof it.reps === 'number') rec.reps = it.reps; else rec.secs = it.sec; sets.push(rec); } });
  PS.logDay(pl.id, d.n, { status: 'done', rpe, durationSec: Math.round((dd.minutes || 20) * 60), sets, feedback: {}, source: 'run' }); }
const reg = d => d && d.main && d.main.length && !['rest', 'active', 'assess'].includes(d.type) && !d.deload;
const prevOf = (ds, n) => { const i = ds.findIndex(x => x.n === n), d = ds[i]; for (let j = i - 1; j >= 0; j--) if (reg(ds[j]) && ds[j].type === d.type) return ds[j]; return null; };
/* scenario: an exercise in two logged sessions, both on target at effort 6, with its next occurrences already at "hard" */
function scenario() { setUser(); const pl = activate('general_90'), all = tr(pl);
  for (const d0 of all.slice(0, 3)) for (const it of strengthEx(d0)) { const t = all.filter(d => strengthEx(d).some(x => x.ex === it.ex)); if (t.length >= 5) {
    t.slice(2).forEach(d => PS.adjust(pl.id, d.n, it.ex, { lvl: 'hard', rule: 'test' }));
    logAt(pl, t[0], 6); logAt(pl, t[1], 6); NOW = S.addDays(t[1].date, 1); return { pl, ex: it.ex, t }; } } return null; }

T('1 loadCheck');
{ const s = scenario(), ds = PS.days(PS.get(s.pl.id)), d = s.t[2], prev = prevOf(ds, d.n), it = ds.find(x => x.n === d.n).main.find(x => x.ex === s.ex);
  const room = P.LOAD_CAP * P.sessionVolume(prev) - P.sessionVolume(ds.find(x => x.n === d.n)), per = it.reps;
  ok(P.LOAD_CAP === 1.25, 'the cap is the existing build-time default (+25 %)');
  ok(A.loadCheck(ds, d.n, s.ex, 1).ok === (per <= room + 1e-9), `+1 set: allowed exactly when it fits the room left under the cap (room ${room.toFixed(1)}, set adds ${per})`, A.loadCheck(ds, d.n, s.ex, 1));
  const big = Math.ceil((room + 1) / per) + 1; ok(!A.loadCheck(ds, d.n, s.ex, big).ok, `+${big} sets (beyond the room) → refused`, A.loadCheck(ds, d.n, s.ex, big));
  ok(A.loadCheck(ds, d.n, s.ex, -1).ok && A.loadCheck(ds, d.n, s.ex, 0).ok, 'reductions and level-only changes are never refused'); }

T('2 R-UP proposals respect the cap');
{ const s = scenario(); let r = A.proposals(); const up = r.list.find(x => x.rule === 'up' && x.target === s.ex);
  const ds = PS.days(PS.get(s.pl.id)); const expAllowed = s.t.slice(2, 4).filter(d => A.loadCheck(ds, d.n, s.ex, 1).ok).map(d => d.n);
  const gotSets = up ? up.changes.filter(c => c.kind === 'sets').map(c => c.n) : [];
  ok(JSON.stringify(gotSets) === JSON.stringify(expAllowed), '"+1 set" is proposed only on days where it fits the cap', { gotSets, expAllowed, held: r.held });
  /* now fill the next occurrence close to the cap with other exercises, so +1 set on s.ex would exceed it */
  const d = s.t[2], others = ds.find(x => x.n === d.n).main.filter(x => x.ex !== s.ex && !x.circuit && x.sets < 5);
  others.forEach(x => PS.adjust(s.pl.id, d.n, x.ex, { sets: 1, rule: 'test' }));
  const ds2 = PS.days(PS.get(s.pl.id)); const blocked = !A.loadCheck(ds2, d.n, s.ex, 1).ok; r = A.proposals(); const up2 = r.list.find(x => x.rule === 'up' && x.target === s.ex);
  ok(blocked, `after +1 set on ${others.length} other exercises, day ${d.n} has no room left`, A.loadCheck(ds2, d.n, s.ex, 1));
  ok(!(up2 && up2.changes.some(c => c.kind === 'sets' && c.n === d.n)), 'then no "+1 set" is proposed for that day');
  ok(r.held.some(h => h.n === d.n && h.ex === s.ex && /עלייה הדרגתית/.test(h.text)), 'and the reason is recorded in `held`', r.held); }

T('3 apply re-checks against the plan as it is now');
{ const s = scenario(); const r = A.proposals(); const up = r.list.find(x => x.rule === 'up' && x.target === s.ex && x.changes.some(c => c.kind === 'sets'));
  if (!up) ok(false, 'scenario produced a "+set" proposal'); else {
    const c = up.changes.find(x => x.kind === 'sets'), ds = PS.days(PS.get(s.pl.id)), others = ds.find(x => x.n === c.n).main.filter(x => x.ex !== s.ex && !x.circuit && x.sets < 5);
    others.forEach(x => PS.adjust(s.pl.id, c.n, x.ex, { sets: 2, rule: 'test' })); const setsBefore = PS.days(PS.get(s.pl.id)).find(d => d.n === c.n).main.find(x => x.ex === s.ex).sets;
    let err = null; try { A.apply(up.key); } catch (e) { err = e.message; }
    const after = PS.days(PS.get(s.pl.id)), d = after.find(x => x.n === c.n), prev = prevOf(after, c.n);
    ok(d.main.find(x => x.ex === s.ex).sets === setsBefore, `the stale "+1 set" on day ${c.n} was not applied (apply recomputes the proposal and the guard drops it)`, { err });
    const volBefore = P.sessionVolume(ds.find(x => x.n === c.n)) + others.reduce((a, x) => a + 2 * (typeof x.reps === 'number' ? x.reps : typeof x.sec === 'number' ? x.sec / 3 : 1), 0);
    ok(Math.abs(P.sessionVolume(d) - volBefore) < 1e-9, `day ${c.n} volume after apply = volume before apply (${P.sessionVolume(d)}); applying added no load there`, { prev: prev && prev.n });
  } }

T('4 build-time plans untouched');
{ let n = 0, ramped = 0; for (const t of PG.TEMPLATES.filter(t => !t.classic && !(t.needsLibrary || []).length)) for (const level of ['beginner', 'intermediate', 'advanced']) for (const goal of t.goals) { const r = P.build(t.id, { start: '2026-10-19', days: t.custom ? 90 : t.days, profile: { level, days: [1, 3, 5], spw: 3, maxMin: 45, equipment: [] }, goal }); n++; ramped += r.days.filter(d => d.ramped).length; }
  ok(n > 0 && typeof P.sessionVolume === 'function' && P.sessionVolume({ main: [{ sets: 3, reps: 10 }, { sets: 2, sec: 30 }] }) === 50, 'Planner.sessionVolume = Σ sets × reps (isometric seconds ÷ 3), the build-time measure'); }

console.log(fails.length ? 'FAILURES:\n - ' + fails.join('\n - ') : ''); console.log(JSON.stringify(sec)); console.log(`load guard tests: pass ${pass} fail ${fail}`);
if (!process.argv[2]) { fs.mkdirSync(path.join(ROOT, 'dist/reports'), { recursive: true }); fs.writeFileSync(path.join(ROOT, 'dist/reports/load-guard-test.json'), JSON.stringify({ pass, fail, sections: sec, fails }, null, 1)); }
process.exit(fail ? 1 : 0);
