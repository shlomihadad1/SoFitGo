/* Stage F tests (Node, simulated clock): Adaptive Fitness Engine. Each rule is exercised with logs built from the
   plan's own targets; expected outcomes are computed in the test (levels/sets/dates), not copied from the engine.
   Also checks what must NOT happen: no load increase from completion alone, none at high effort, no change to logged
   history, no change without approval, every approval reversible. Writes dist/reports/stageF-test.json. */
const fs = require('fs'), path = require('path'); const ROOT = path.join(__dirname, '..');
for (const f of ['src/js/figure.js', 'src/data/exercises.js', 'src/data/workouts.js', 'src/data/nutrition.js', 'src/data/recipes_intl.js', 'src/data/recipes_med.js', 'src/data/catalog.js', 'src/data/programs.js', 'src/js/logic.js', 'src/js/planner.js', 'src/js/plans.js', 'src/js/mealplanner.js', 'src/js/store.js', 'src/js/core.js', 'src/js/insights.js', 'src/js/adapt.js']) require(path.join(ROOT, f));
const { Store: S, Core: C, Plans: PS, Adapt: A } = globalThis;
let pass = 0, fail = 0; const fails = [], sec = {}; let cur = '';
const T = n => { cur = n; sec[n] = { pass: 0, fail: 0 }; }, ok = (c, m, info) => { if (c) { pass++; sec[cur].pass++; } else { fail++; sec[cur].fail++; if (fails.length < 80) fails.push(cur + ': ' + m + (info !== undefined ? ' → ' + JSON.stringify(info).slice(0, 300) : '')); } };
let NOW = '2026-10-19'; S.today = () => NOW;
const LV = ['easy', 'normal', 'hard'];
const setUser = (o) => { S.resetAll(); NOW = '2026-10-19'; const p = S.load('profile'); Object.assign(p, { age: 32, height: 187, weight: 85, startWeight: 85, sex: 'm', experience: 'beginner', aims: { primary: 'fat_loss', secondary: [] } }, o || {}); p.availability = { days: [1, 3, 5], sessions: 3, prefMin: null, maxMin: 45 }; S.save('profile'); return p; };
const activate = tid => PS.activate(PS.create(tid, PS.paramsFromProfile(S.load('profile')), NOW), { confirmReplace: true });
const tr = pl => PS.days(PS.get(pl.id)).filter(d => PS.isTraining(d) && d.type !== 'assess' && d.type !== 'active');
const strengthEx = d => (d.main || []).filter(it => !it.circuit && (typeof it.reps === 'number' || typeof it.sec === 'number'));
/* log day d at its own date with every set of `ex` at value v(target) and everything else on target */
function logAt(pl, d, opt) {
  opt = opt || {}; NOW = d.date; const dd = PS.dayOf(PS.get(pl.id), d.n), sets = [];
  (dd.main || []).concat(dd.finisher || []).forEach(it => { for (let k = 1; k <= (it.sets || 1); k++) { const tgt = typeof it.reps === 'number' ? it.reps : typeof it.sec === 'number' ? it.sec : null;
    let v = tgt; if (opt.ex === it.ex && opt.f) v = opt.f(tgt, k); const rec = { done: !(opt.ex === it.ex && opt.undone && k === it.sets), ex: it.ex, sec: 'main', set: k }; if (typeof it.reps === 'number') rec.reps = v; else rec.secs = v; sets.push(rec); } });
  PS.logDay(pl.id, d.n, { status: 'done', rpe: opt.rpe === undefined ? 6 : opt.rpe, durationSec: opt.dur || Math.round((dd.minutes || 20) * 60), sets, feedback: opt.fb || {}, source: 'run' });
}
const futureState = pl => JSON.stringify(PS.days(PS.get(pl.id)).filter(d => !d.log && d.date >= NOW).map(d => [d.n, d.date, d.version, (d.main || []).map(it => [it.ex, it.sets, it.lvl, it.adjLvl || null])]));
const loggedState = pl => JSON.stringify(PS.days(PS.get(pl.id)).filter(d => d.log).map(d => [d.n, d.log, d.main]));
/* pick an exercise that appears in the first two training sessions and again later */
/* returns { ex, t } where t = the training sessions that contain ex (≥4), in date order */
function commonEx(pl) { const all = tr(pl); for (const d0 of all.slice(0, 3)) for (const it of strengthEx(d0)) { const t = all.filter(d => strengthEx(d).some(x => x.ex === it.ex)); if (t.length >= 4) return { ex: it.ex, t }; } return null; }

T('not enough data');
setUser(); { const pl = activate('general_90'); const r = A.proposals();
  ok(r.info && r.info.kind === 'insufficient' && r.logged === 0, 'new plan → explicit "not enough data" with the count');
  ok(!r.list.some(x => ['up', 'down'].includes(x.rule)), 'no performance proposals without data');
  const t = tr(pl); logAt(pl, t[0]); NOW = S.addDays(t[0].date, 1); ok(A.proposals().info && A.proposals().info.logged === 1, 'one logged session is still not enough'); }

T('progression only from real performance');
setUser(); { const pl = activate('general_90'), c = commonEx(pl); ok(!!c, 'test setup: an exercise repeats across sessions'); const { ex, t } = c;
  // completion without set data (manual "mark as done") twice → no increase
  [t[0], t[1]].forEach(d => { NOW = d.date; PS.logDay(pl.id, d.n, { status: 'done', rpe: 5, source: 'manual' }); }); NOW = S.addDays(t[1].date, 1);
  ok(!A.proposals().list.some(x => x.rule === 'up'), 'completing sessions (no sets logged) never raises load');
  setUser(); const pl2 = activate('general_90'), c2 = commonEx(pl2), t2 = c2.t;
  logAt(pl2, t2[0], { rpe: 8 }); logAt(pl2, t2[1], { rpe: 8 }); NOW = S.addDays(t2[1].date, 1);
  ok(!A.proposals().list.some(x => x.rule === 'up' && x.target === c2.ex), 'full target but effort 8/10 → no increase');
  setUser(); const pl3 = activate('general_90'), c3 = commonEx(pl3), t3 = c3.t;
  logAt(pl3, t3[0], { rpe: 6 }); logAt(pl3, t3[1], { rpe: 6 }); NOW = S.addDays(t3[1].date, 1);
  const before = futureState(pl3), up = A.proposals().list.find(x => x.rule === 'up' && x.target === c3.ex);
  ok(!!up, 'full target in 2 sessions at effort ≤7 → one-step increase proposed', A.proposals().list.map(x => x.key));
  ok(futureState(pl3) === before, 'proposing changes nothing (approval required)');
  const fut = PS.days(PS.get(pl3.id)).filter(d => !d.log && d.date >= NOW && PS.isTraining(d) && (d.main || []).some(it => it.ex === c3.ex)).slice(0, 2);
  const exp = fut.map(d => { const it = d.main.find(x => x.ex === c3.ex), l = it.lvl || 'normal'; return l !== 'hard' ? ['lvl', d.n, LV[LV.indexOf(l) + 1]] : ['sets', d.n, it.sets + 1]; });
  ok(JSON.stringify(up.changes.map(ch => [ch.kind, ch.n, ch.to])) === JSON.stringify(exp), 'increase = one step on the next ≤2 sessions with that exercise only', { got: up.changes, exp });
  ok(up.why.includes('6') && /יעד/.test(up.why), 'explanation quotes the logged numbers');
  const logged = loggedState(pl3); A.apply(up.key);
  const after = PS.days(PS.get(pl3.id)); exp.forEach(([k, n, to]) => { const it = after.find(d => d.n === n).main.find(x => x.ex === c3.ex); ok(k === 'lvl' ? it.lvl === to && it.adjLvl === to : it.sets === to, `day ${n}: ${k} → ${to}`); });
  const untouched = after.filter(d => !d.log && d.date >= NOW && !exp.some(e => e[1] === d.n)); ok(untouched.every(d => (d.main || []).every(it => !it.adjusted)), 'all other future days unchanged');
  ok(loggedState(pl3) === logged, 'logged sessions unchanged by the approval');
  ok(C.levelFor(c3.ex, after.find(d => d.n === exp[0][1]).main.find(x => x.ex === c3.ex)) === (exp[0][0] === 'lvl' ? exp[0][2] : C.levelFor(c3.ex)), 'runner level follows the approved adaptation');
  ok(!A.proposals().list.some(x => x.rule === 'up' && x.target === c3.ex), 'no second increase for the same exercise right away');
  const rec = A.history()[0]; A.revert(rec.id); ok(futureState(pl3) === before, 'undo restores the original future plan exactly'); ok(A.history()[0].status === 'reverted', 'history keeps the reverted record');
  ok((PS.get(pl3.id).changes || []).some(ch => ch.type === 'adapt') && PS.get(pl3.id).changes.some(ch => ch.type === 'adapt-revert'), 'plan change log records approval and undo'); }

T('high effort / fatigue');
setUser(); { const pl = activate('general_90'), c = commonEx(pl), t = c.t;
  logAt(pl, t[0], { rpe: 6 }); logAt(pl, t[1], { rpe: 9 }); NOW = t[1].date;
  const r = A.proposals().list; ok(!r.some(x => x.rule === 'up'), 'last session rated 9/10 → no increase anywhere');
  const nx = PS.days(PS.get(pl.id)).filter(d => !d.log && PS.isTraining(d) && d.date >= NOW && d.type !== 'assess' && d.type !== 'active')[0];
  if (S.diffDays(t[1].date, nx.date) <= 2) ok(r.some(x => x.rule === 'recover' && x.changes[0].n === nx.n && x.changes[0].to === 'short'), 'next session within 2 days → short-version proposal for that session only');
  else ok(!r.some(x => x.rule === 'recover'), 'next session > 2 days away → no recovery proposal');
  setUser(); const p2 = activate('general_90'); const t2 = tr(p2); NOW = t2[0].date; const tt = S.load('tracking'); tt.daily[NOW] = { energy: 2 }; S.save('tracking');
  ok(A.proposals().list.some(x => x.rule === 'recover' && x.changes[0].n === t2[0].n), 'energy 2/5 reported on a training day → short version for today'); }

T('decrease when sets are not completed');
setUser(); { const pl = activate('general_90'), c = commonEx(pl), t = c.t;
  logAt(pl, t[0], { rpe: 6 }); logAt(pl, t[1], { rpe: 7, ex: c.ex, f: v => Math.floor(v * 0.5) }); NOW = S.addDays(t[1].date, 1);
  const dn = A.proposals().list.find(x => x.rule === 'down' && x.target === c.ex); ok(!!dn, 'reps < 70 % of target → decrease proposed');
  ok(dn && dn.changes.every(ch => ch.kind === 'lvl' ? LV.indexOf(ch.to) === LV.indexOf(ch.from) - 1 : ch.to === ch.from - 1), 'decrease is exactly one step');
  setUser(); const p2 = activate('general_90'), c2 = commonEx(p2); logAt(p2, c2.t[0]); logAt(p2, c2.t[1], { fb: { [c2.ex]: 'fail' } }); NOW = S.addDays(c2.t[1].date, 1);
  ok(A.proposals().list.some(x => x.rule === 'down' && x.target === c2.ex), 'feedback "failed" → decrease proposed');
  setUser(); const p3 = activate('general_90'), c3 = commonEx(p3); logAt(p3, c3.t[0], { fb: { [c3.ex]: 'easy' }, rpe: 8 }); logAt(p3, c3.t[1], { fb: { [c3.ex]: 'easy' }, rpe: 8 }); NOW = S.addDays(c3.t[1].date, 1);
  ok(A.proposals().list.some(x => x.rule === 'up' && x.target === c3.ex), '"too easy" twice → increase proposed'); }

T('session ended early is not a failure (regression)');
setUser(); { const pl = activate('general_90'), c = commonEx(pl), t = c.t; logAt(pl, t[0]);
  NOW = t[1].date; const d = PS.dayOf(PS.get(pl.id), t[1].n), all = []; let k = 0;
  (d.main || []).concat(d.finisher || []).forEach(it => { for (let j = 1; j <= (it.sets || 1); j++) all.push({ key: k++, ex: it.ex, sec: 'main', set: j, it }); });
  const firstEx = all[0].ex, sets = all.map(x => { const r = { key: x.key, done: x.ex === firstEx, ex: x.ex, sec: 'main', set: x.set }; if (r.done) { if (typeof x.it.reps === 'number') r.reps = x.it.reps; else r.secs = x.it.sec; } return r; });
  PS.logDay(pl.id, t[1].n, { status: 'partial', rpe: 6, sets, source: 'run' }); NOW = S.addDays(t[1].date, 1);
  const downs = A.proposals().list.filter(x => x.rule === 'down');
  ok(!downs.some(x => x.target !== firstEx), 'exercises never reached in a session that ended early produce no "decrease" proposal', downs.map(x => x.target)); }

T('missed session');
setUser(); { const pl = activate('general_90'), t = tr(pl); logAt(pl, t[0]); NOW = S.addDays(t[1].date, 1);
  const before = PS.days(PS.get(pl.id)).map(d => [d.n, d.date]);
  const ms = A.proposals().list.find(x => x.rule === 'missed'); ok(!!ms && ms.changes[0].n === t[1].n, 'missed session → proposal to move that one session');
  const busy = new Set(PS.days(PS.get(pl.id)).filter(d => PS.isTraining(d) && d.status !== 'skipped').map(d => d.date)); let free = null; for (let i = 0; i <= 7 && !free; i++) { const x = S.addDays(NOW, i); if (!busy.has(x)) free = x; }
  ok(ms && ms.changes[0].to === free, 'target = first free day from today (independently computed)', { got: ms && ms.changes[0].to, free });
  A.apply(ms.key); const after = PS.days(PS.get(pl.id)).map(d => [d.n, d.date]);
  ok(after.filter((x, i) => x[1] !== before[i][1]).length === 1 && after.find(x => x[0] === t[1].n)[1] === free, 'only that session moved; the rest of the plan kept its dates');
  A.revert(A.history()[0].id); ok(JSON.stringify(PS.days(PS.get(pl.id)).map(d => [d.n, d.date])) === JSON.stringify(before), 'undo puts it back'); }

T('comeback after a break');
setUser(); { const pl = activate('general_90'), t = tr(pl); logAt(pl, t[0]); NOW = S.addDays(t[0].date, 12);
  const cb = A.proposals().list.find(x => x.rule === 'comeback'); ok(!!cb, '12 days without a logged session → comeback proposal');
  ok(cb && cb.changes.filter(c => c.kind === 'version').length === 2 && cb.changes.filter(c => c.kind === 'version').every(c => c.to === 'short'), 'next 2 sessions short');
  ok(cb && cb.changes.filter(c => c.kind === 'lvl').every(c => LV.indexOf(c.to) === LV.indexOf(c.from) - 1), 'levels one step easier, never more'); }

T('time');
setUser(); { const pl = activate('general_90'), t = tr(pl); [0, 1, 2].forEach(i => logAt(pl, t[i], { dur: Math.round(PS.dayOf(PS.get(pl.id), t[i].n).minutes * 60 * 1.6) })); NOW = S.addDays(t[2].date, 1);
  ok(A.proposals().list.some(x => x.rule === 'time'), '3 sessions > 25 % over plan → short-version proposal');
  setUser(); const p2 = activate('general_90'); const pr = S.load('profile'); pr.availability.maxMin = 10; S.save('profile');
  ok(A.proposals().list.some(x => x.rule === 'time' && /מקסימלי/.test(x.why)), 'next session longer than the user\'s max time → short-version proposal'); }

T('preferences from swaps');
setUser(); { const pl = activate('general_90'); const t = tr(pl).filter(d => d.date >= NOW); let done = null;
  outer: for (const d0 of t.slice(0, 4)) for (const it of strengthEx(d0)) { const days2 = t.filter(d => strengthEx(d).some(x => x.ex === it.ex)); if (days2.length < 4) continue;
    const idx = d => PS.dayOf(PS.get(pl.id), d.n).main.findIndex(x => x.ex === it.ex);
    const a0 = PS.alternatives(PS.get(pl.id), days2[0].n, idx(days2[0])).list.map(a => a.id), a1 = PS.alternatives(PS.get(pl.id), days2[1].n, idx(days2[1])).list.map(a => a.id);
    const to = a0.find(x => a1.includes(x)); if (!to) continue;
    PS.swap(pl.id, days2[0].n, idx(days2[0]), to, 'day'); PS.swap(pl.id, days2[1].n, idx(days2[1]), to, 'day'); done = { from: it.ex, to, days2 }; break outer; }
  ok(!!done, 'test setup: same exercise swapped on 2 days'); if (process.env.DBG) console.log('DBG', done && done.from, done && done.to, JSON.stringify(PS.get(pl.id).overrides), JSON.stringify(A.proposals().list.map(x => x.key)));
  const pf = A.proposals().list.find(x => x.rule === 'pref' && x.target === done.from); ok(!!pf && pf.changes[0].to === done.to, 'repeated swap → permanent replacement proposed with the chosen exercise');
  A.apply(pf.key); const later = PS.days(PS.get(pl.id)).filter(d => !d.log && d.date >= NOW && d.n > done.days2[1].n && (d.main || []).length);
  ok(!later.some(d => d.main.some(x => x.ex === done.from)), 'after approval the exercise no longer appears in future sessions');
  A.revert(A.history()[0].id); ok(PS.get(pl.id).replace.length === 0, 'undo removes the permanent replacement'); }

T('dismiss, history, backup');
setUser(); { const pl = activate('general_90'), t = tr(pl); logAt(pl, t[0]); NOW = S.addDays(t[1].date, 1);
  const k = A.proposals().list[0].key; A.dismiss(k); ok(!A.proposals().list.some(x => x.key === k), 'dismissed proposal is not shown again');
  const c = commonEx(pl); // apply + log the adapted day, then undo → logged day keeps what was done
  setUser(); const p2 = activate('general_90'), c2 = commonEx(p2); logAt(p2, c2.t[0]); logAt(p2, c2.t[1]); NOW = S.addDays(c2.t[1].date, 1);
  const up = A.proposals().list.find(x => x.rule === 'up'); A.apply(up.key); const n1 = up.changes[0].n, d1 = PS.dayOf(PS.get(p2.id), n1);
  logAt(p2, d1); const snap = JSON.stringify(PS.dayOf(PS.get(p2.id), n1).main); NOW = S.addDays(d1.date, 1);
  const rv = A.revert(A.history()[0].id); ok(rv.kept.includes(n1) && JSON.stringify(PS.dayOf(PS.get(p2.id), n1).main) === snap, 'undo after the adapted day was logged: that day keeps what was done');
  const ex = S.exportAll(); S.resetAll(); S.importAll(JSON.parse(JSON.stringify(ex))); ok(A.history().length === 1 && A.history()[0].status === 'reverted', 'adaptation history survives backup & restore');
  ok(PS.adjust.length >= 4 && (() => { try { PS.adjust(p2.id, n1, c2.ex, { lvl: 'hard' }); return false; } catch (e) { return true; } })(), 'a logged day cannot be adjusted');
  const fd = PS.days(PS.get(p2.id)).find(d => !d.log && d.date > NOW && (d.main || []).length); ok((() => { try { PS.adjust(p2.id, fd.n, fd.main[0].ex, { sets: 4 }); return false; } catch (e) { return true; } })(), 'sets changes are bounded (±2 max)'); }

T('apply is all-or-nothing');
setUser(); { const pl = activate('general_90'), t = tr(pl); logAt(pl, t[0]); NOW = S.addDays(t[1].date, 1); const ms = A.proposals().list.find(x => x.rule === 'missed');
  const before = JSON.stringify(PS.get(pl.id)); ok((() => { try { A.apply('no-such-key'); return false; } catch (e) { return true; } })() && JSON.stringify(PS.get(pl.id)) === before, 'unknown/stale proposal → error, plan untouched');
  if (ms) { logAt(pl, PS.dayOf(PS.get(pl.id), ms.changes[0].n)); NOW = S.addDays(ms.changes[0].from, 2); const b2 = JSON.stringify(PS.get(pl.id).overrides); ok((() => { try { A.apply(ms.key); return false; } catch (e) { return true; } })() && JSON.stringify(PS.get(pl.id).overrides) === b2, 'proposal whose day got logged meanwhile → refused, nothing changed'); } }

T('classic suggestions while a plan runs');
setUser(); { activate('general_90'); const w = S.load('workouts'); w.feedback = { squat: ['easy', 'easy'] }; S.save('workouts'); ok(!C.suggestions().some(s => ['up', 'down', 'missed', 'fatigue'].includes(s.kind)), 'classic-program suggestions are not shown during a personal plan (the home-screen bug)'); }

fs.mkdirSync(path.join(ROOT, 'dist/reports'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'dist/reports/stageF-test.json'), JSON.stringify({ pass, fail, sections: sec, fails }, null, 1));
if (fails.length) { console.log('FAILURES:'); fails.forEach(f => console.log(' - ' + f)); }
console.log(JSON.stringify(sec)); console.log(`stage F tests: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
