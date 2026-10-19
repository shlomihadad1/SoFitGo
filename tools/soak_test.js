/* Final-QA soak test (Node, simulated clock): one user, a 12-month plan, ~1 year of irregular use. Each simulated day:
   maybe log the session (full / partial / ended early / skipped), sometimes report low energy, sometimes approve, dismiss
   or undo an adaptation, a travel week twice a year, plan-day swaps. After every action the invariants are checked:
   logged history never changes, every applied change is on a future unlogged day, menus exist for every plan day,
   no exceptions. Deterministic (seeded PRNG). Writes dist/reports/soak-test.json. */
const fs = require('fs'), path = require('path'); const ROOT = path.join(__dirname, '..');
for (const f of ['src/js/figure.js', 'src/data/exercises.js', 'src/data/workouts.js', 'src/data/nutrition.js', 'src/data/recipes_intl.js', 'src/data/catalog.js', 'src/data/programs.js', 'src/js/logic.js', 'src/js/planner.js', 'src/js/plans.js', 'src/js/mealplanner.js', 'src/js/store.js', 'src/js/core.js', 'src/js/insights.js', 'src/js/adapt.js', 'src/js/signature.js']) require(path.join(ROOT, f));
const { Store: S, Core: C, Plans: PS, Adapt: A, Signature: G } = globalThis;
/* three scenarios: different equipment, experience, goal, availability, food preferences and random seeds */
const SCEN = [
  { name: 'home furniture, beginner, fat loss', seed: 20261018, tpl: 'annual', xp: 'beginner', goal: 'fat_loss', days: [0, 2, 4], spw: 3, maxMin: 40, eq: ['chair', 'table', 'bench', 'step', 'wall', 'doorframe'], prefs: null },
  { name: 'no equipment, intermediate, vegan, 4×/week', seed: 77, tpl: 'annual', xp: 'intermediate', goal: 'general', days: [0, 1, 3, 5], spw: 4, maxMin: 30, eq: [], prefs: { vegan: true } },
  { name: 'chair+table, advanced, strength, 6-month plan', seed: 4242, tpl: 'progress_6m', xp: 'advanced', goal: 'recomp', days: [1, 2, 4, 6], spw: 4, maxMin: 45, eq: ['chair', 'table'], prefs: { egg: false } }];
const all = []; let totalFail = 0;
for (const sc of SCEN) {
let seed = sc.seed; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
let NOW = '2026-10-19'; S.today = () => NOW;
const counts = { days: 0, logged: 0, early: 0, skipped: 0, applied: 0, reverted: 0, dismissed: 0, travel: 0, swaps: 0, proposals: 0, errors: [] };
let violations = [];
S.resetAll(); const pr = S.load('profile'); Object.assign(pr, { age: 32, height: 187, weight: 85, startWeight: 85, sex: 'm', experience: sc.xp, aims: { primary: sc.goal, secondary: [] } }); pr.availability = { days: sc.days, sessions: sc.spw, maxMin: sc.maxMin }; pr.environment = { equipment: sc.eq }; if (sc.prefs) pr.prefs = C.normPrefs(sc.prefs); S.save('profile');
const pl = PS.activate(PS.create(sc.tpl, PS.paramsFromProfile(pr), NOW)); const id = pl.id; const end = PS.stats(pl).end;
const snapLogs = () => JSON.stringify(PS.get(id).log);
let prevLogs = snapLogs();
const check = (what) => { const cur = PS.get(id).log, prev = JSON.parse(prevLogs); for (const n of Object.keys(prev)) if (JSON.stringify(prev[n]) !== JSON.stringify(cur[n])) violations.push(`${NOW} ${what}: logged day ${n} changed`); prevLogs = snapLogs(); };
while (NOW <= end) {
  counts.days++;
  try {
    const p = PS.get(id), td = PS.days(p).find(d => d.date === NOW && PS.isTraining(d) && !d.log && d.status !== 'skipped');
    if (rnd() < 0.15) { const t = S.load('tracking'); t.daily[NOW] = Object.assign(t.daily[NOW] || {}, { energy: 2 }); S.save('tracking'); }
    const pause = NOW >= '2027-02-01' && NOW < '2027-02-15'; // a two-week break
    if (td && !pause) {
      const r = rnd();
      if (r < 0.08) { PS.skip(id, td.n); counts.skipped++; }
      else if (r < 0.82) { const sets = []; let k = 0; const early = rnd() < 0.12, cut = early ? Math.floor(rnd() * 8) + 1 : 1e9;
        (td.main || []).concat(td.finisher || []).forEach(it => { for (let j = 1; j <= (it.sets || 1); j++, k++) { const done = k < cut && rnd() > 0.05, tgt = typeof it.reps === 'number' ? it.reps : typeof it.sec === 'number' ? it.sec : 30;
          const v = Math.max(1, Math.round(tgt * (0.6 + rnd() * 0.6))); const s = { key: k, done, ex: it.ex, sec: 'main', set: j }; if (done) { if (typeof it.reps === 'number') s.reps = v; else s.secs = v; } sets.push(s); } });
        const fb = {}; (td.main || []).forEach(it => { const q = rnd(); if (q < 0.1) fb[it.ex] = 'easy'; else if (q < 0.15) fb[it.ex] = 'hard'; });
        PS.logDay(id, td.n, { status: early ? 'partial' : 'done', rpe: 4 + Math.floor(rnd() * 6), durationSec: Math.round((td.minutes || 25) * 60 * (0.8 + rnd() * 0.7)), sets, feedback: fb, source: 'run' });
        counts.logged++; if (early) counts.early++; }
      check('log');
    }
    // swaps on future days now and then (feeds R-PREF)
    if (rnd() < 0.05) { const fd = PS.days(PS.get(id)).find(d => d.date > NOW && PS.isTraining(d) && !d.log && (d.main || []).length && d.type !== 'assess');
      if (fd) { const i = Math.floor(rnd() * fd.main.length), alts = PS.alternatives(PS.get(id), fd.n, i).list; if (alts.length) { PS.swap(id, fd.n, i, alts[0].id, 'day'); counts.swaps++; } } check('swap'); }
    // adaptation engine
    const pr2 = A.proposals(); counts.proposals += pr2.list.length;
    for (const x of pr2.list) { for (const c of x.changes) { const d = PS.dayOf(PS.get(id), c.n); if (c.kind !== 'replace' && c.kind !== 'move' && (!d || d.log || (d.movedTo || d.date) < NOW)) violations.push(`${NOW} proposal ${x.key} targets a logged/past day ${c.n}`); } }
    if (pr2.list.length && rnd() < 0.5) { const x = pr2.list[Math.floor(rnd() * pr2.list.length)]; if (rnd() < 0.8) { A.apply(x.key); counts.applied++; } else { A.dismiss(x.key); counts.dismissed++; } check('adapt'); }
    if (rnd() < 0.04) { const h = A.history().find(z => z.status === 'applied'); if (h) { A.revert(h.id); counts.reverted++; check('revert'); } }
    // travel weeks
    if (['2027-04-04', '2027-08-01'].includes(NOW)) { const pv = G.Travel.preview(PS.get(id), NOW, S.addDays(NOW, 6), { short: true }); G.Travel.apply(pv); counts.travel++; check('travel'); }
    if (['2027-04-12', '2027-08-09'].includes(NOW)) { const t = G.Travel.list().find(z => z.status === 'active'); if (t) G.Travel.revert(t.id); check('travel-off'); }
    // menus exist for today
    if (C.plan(NOW).source !== 'plan') violations.push(`${NOW} no plan menu`);
    if (NOW.endsWith('-01')) { G.review(); G.records(); G.milestones(); G.shopping(NOW, 7); G.explain(); }
  } catch (e) { counts.errors.push(NOW + ': ' + e.message); if (counts.errors.length > 20) break; }
  NOW = S.addDays(NOW, 1);
}
const st = PS.stats(PS.get(id)), out = { scenario: sc.name, counts, stats: st, adaptations: A.history().length, violations: violations.slice(0, 30), violationCount: violations.length };
all.push(out); const fail = violations.length + counts.errors.length; totalFail += fail;
console.log(sc.name, JSON.stringify(counts)); if (violations.length) console.log('VIOLATIONS', violations.slice(0, 10));
}
fs.mkdirSync(path.join(ROOT, 'dist/reports'), { recursive: true }); fs.writeFileSync(path.join(ROOT, 'dist/reports/soak-test.json'), JSON.stringify(all, null, 1));
const days = all.reduce((s, o) => s + o.counts.days, 0), ap = all.reduce((s, o) => s + o.counts.applied, 0), rv = all.reduce((s, o) => s + o.counts.reverted, 0);
console.log(`soak test: ${all.length} scenarios, ${days} simulated days, ${ap} adaptations applied, ${rv} undone — pass ${all.length - all.filter(o => o.violationCount + o.counts.errors.length).length} fail ${all.filter(o => o.violationCount + o.counts.errors.length).length}`); process.exit(totalFail ? 1 : 0);
