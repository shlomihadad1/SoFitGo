/* Stage B tests (Node): profile schema/migration, targets, plans (activation, pause/resume, skip, move, versions,
   swaps, availability/equipment changes, switching, cancel, history), backup/restore incl. old backups, planner
   compliance for 30/60/90/180/365/custom. Time is simulated by replacing Store.today. Writes dist/reports/stageB-test.json */
const fs = require('fs'), path = require('path'); const ROOT = path.join(__dirname, '..');
for (const f of ['src/js/figure.js', 'src/data/exercises.js', 'src/data/workouts.js', 'src/data/nutrition.js', 'src/data/recipes_intl.js', 'src/data/recipes_med.js', 'src/data/catalog.js', 'src/data/programs.js', 'src/js/logic.js', 'src/js/planner.js', 'src/js/plans.js', 'src/js/store.js', 'src/js/core.js']) require(path.join(ROOT, f));
const { Store: S, Core: C, Plans: PS, Planner: PL, PROGRAMS: PG, CATALOG: CT, EXERCISES } = globalThis;
let pass = 0, fail = 0; const fails = [], sec = {}; let cur = '';
const T = n => { cur = n; sec[n] = { pass: 0, fail: 0 }; }, ok = (c, m) => { if (c) { pass++; sec[cur].pass++; } else { fail++; sec[cur].fail++; fails.push(cur + ': ' + m); } };
const throws = (f, re) => { try { f(); return false; } catch (e) { return re ? re.test(e.message) || re.test(e.code || '') : true; } };
const REAL = S.today; let NOW = null; S.today = () => NOW || REAL(); const setNow = d => { NOW = d; };
const dow = d => new Date(d + 'T12:00:00Z').getUTCDay();
const mifflin = (w, h, a, k) => 10 * w + 6.25 * h - 5 * a + k;
const kcalOf = (w, h, a, k, def) => Math.round(mifflin(w, h, a, k) * 1.55 * (1 - def) / 50) * 50;
const reset = () => { S.resetAll(); setNow('2026-10-19'); };
const user = (o) => { const p = S.load('profile'); Object.assign(p, { age: 32, height: 187, weight: 85, startWeight: 85, experience: 'beginner', aims: { primary: 'general', secondary: [] } }, o || {}); p.availability = Object.assign({ days: [1, 3, 5], sessions: 3, prefMin: null, maxMin: 30 }, (o || {}).availability || {}); S.save('profile'); return p; };

T('profile & migration');
reset(); { const p = S.load('profile');
  ok([p.age, p.height, p.weight, p.startWeight, p.sex, p.aims.primary, p.experience].every(v => v == null), 'new profile has no personal values');
  ok(p.availability.days.length === 0 && p.environment.equipment.length === 0 && p.legacy == null, 'new profile: no availability/equipment/legacy assumptions');
  ok(C.targets() === null && !C.hasBasics(), 'no targets without age/height/weight'); }
{ // use the public migrate on a raw object (load() calls the same function)
  const v1 = { v: 1, age: 32, height: 187, startWeight: 85, weight: 84, startDate: '2026-10-10', units: { w: 'kg', len: 'cm' }, targets: { protein: 160 }, goals: { steps: 9000, water: 3000, sleep: 7.5 }, prefs: { chicken: false, egg: true, dairy: true, veg: false, exclude: ['peanuts'], flex: true, flexName: 'x' }, display: { size: 'large', motion: 'auto', wake: true, sound: true }, onboarded: true };
  const m = S.migrateProfile(JSON.parse(JSON.stringify(v1)));
  ok(m.schema === 2 && m.v === S.VERSION, 'schema-1 profile migrated to schema 2');
  ok(m.age === 32 && m.weight === 84 && m.startDate === '2026-10-10' && m.targets.protein === 160 && m.goals.steps === 9000 && m.prefs.chicken === false && m.prefs.exclude[0] === 'peanuts' && m.display.size === 'large', 'all existing values kept');
  ok(m.legacy && m.legacy.sex === 'm' && m.legacy.deficit === 0.2, 'old calculation assumptions recorded as legacy');
  ok(m.aims.primary === null && Array.isArray(m.availability.days) && Array.isArray(m.environment.equipment) && Array.isArray(m.exercisePrefs.exclude), 'new fields added empty');
  const m2 = S.migrateProfile({ v: 1, startDate: '2026-10-10' }); ok(m2.legacy === null && m2.age == null, 'old profile without body data: no legacy assumptions');
  const again = S.migrateProfile(JSON.parse(JSON.stringify(m))); ok(JSON.stringify(again) === JSON.stringify(m), 'migration is idempotent');
  reset(); const p = S.load('profile'); Object.assign(p, m, { targets: null }); S.save('profile');
  const t = C.targets(); ok(t.kcal === kcalOf(84, 187, 32, 5, 0.2) && t.protein === Math.round(84 * 1.8 / 5) * 5, `migrated user keeps previous targets (${t.kcal} kcal, ${t.protein} g)`);
  p.sex = 'f'; S.save('profile'); ok(C.targets().bmr === Math.round(mifflin(84, 187, 32, -161)), 'sex set by user replaces legacy assumption (female formula)');
  p.sex = null; p.legacy = null; S.save('profile'); ok(C.targets().bmr === Math.round(mifflin(84, 187, 32, -78)) && C.targetInputs().sexFrom === 'unknown', 'sex not given → midpoint formula, flagged');
  p.aims.primary = 'muscle'; S.save('profile'); ok(C.targets().deficit === -0.1 && C.targetInputs().deficitFrom === 'goal', 'goal muscle → 10% surplus (system estimate)');
  p.aims.primary = 'maintain'; S.save('profile'); ok(C.targets().deficit === 0, 'goal maintain → no deficit'); }

T('plan creation & activation');
reset(); user();
ok(throws(() => PS.create('general_90', Object.assign(PS.paramsFromProfile(S.load('profile')), { goal: null }), '2026-10-19'), /מטרה/), 'missing goal → clear error');
ok(throws(() => PS.create('gym', PS.paramsFromProfile(S.load('profile')), '2026-10-19'), /ציוד/), 'gym template cannot be activated (library gap stated)');
ok(throws(() => PS.create('fit30_classic', PS.paramsFromProfile(S.load('profile')), '2026-10-19')), 'classic program is not re-created');
ok(throws(() => PS.create('general_90', PS.paramsFromProfile(S.load('profile')), '2026-10-01'), /עבר/), 'start in the past rejected');
const params = PS.paramsFromProfile(S.load('profile'));
let plan = PS.create('general_90', params, '2026-10-19'); ok(plan.status === 'draft' && !PS.active(), 'create does not activate');
const pv = PS.preview(plan); ok(pv.summary.days === 90 && pv.summary.sessionsPerWeek === 3, 'preview: 90 days, 3/week');
PS.activate(plan); ok(PS.active() && PS.active().id === plan.id && S.load('profile').onboarded === true, 'activated');
{ const ch = PS.active().changes.length; PS.activate(plan, { confirmReplace: true }); ok(PS.active().status === 'active' && !PS.active().endedAt && PS.active().changes.length === ch && PS.list().length === 1, 'activating the same plan again (double tap) changes nothing'); }
let ds = PS.days(PS.active());
ok(ds.filter(PS.isTraining).every(d => [1, 3, 5].includes(dow(d.date))), 'training only on the chosen weekdays');
ok(ds.filter(d => d.status === 'today' || d.status === 'planned').length === 90, 'all days planned at start');

T('skip, move, version');
{ const p = PS.active(), tr = PS.days(p).filter(PS.isTraining), a = tr[1], b = tr[2];
  PS.skip(p.id, a.n); ok(PS.dayOf(PS.get(p.id), a.n).status === 'skipped', 'skip');
  PS.unskip(p.id, a.n); ok(PS.dayOf(PS.get(p.id), a.n).status !== 'skipped', 'unskip');
  ok(throws(() => PS.move(p.id, a.n, b.date), /כבר יש אימון/), 'move onto a training day refused with reason');
  const restDate = PS.days(PS.get(p.id)).find(d => d.date > a.date && !PS.isTraining(d)).date;
  PS.move(p.id, a.n, restDate); const moved = PS.dayOf(PS.get(p.id), a.n); ok(moved.date === restDate && moved.plannedDate === a.date, 'move to a rest day');
  ok(throws(() => PS.move(p.id, b.n, '2026-10-01'), /מהיום/), 'move into the past refused');
  const mins = v => { PS.setVersion(p.id, b.n, v); return PS.dayOf(PS.get(p.id), b.n).minutes; };
  const ms = mins('short'), mstd = mins('std'), ml = mins('long'); ok(ms < mstd && mstd < ml, `versions: short ${ms} < std ${mstd} < long ${ml}`);
  ok(throws(() => PS.setVersion(p.id, tr[0].n, 'short'), /מבחן/), 'assessment has no versions'); }

T('exercise swap');
{ const p = PS.active(), d = PS.days(p).find(x => PS.isTraining(x) && x.type !== 'assess' && x.date > '2026-10-20');
  const a = PS.alternatives(p, d.n, 0), m0 = CT.exMeta(d.main[0].ex);
  ok(a.list.length > 0, 'alternatives offered for ' + d.main[0].ex);
  ok(a.list.every(x => CT.exMeta(x.id).eq.every(e => ['none', ...params.equipment].includes(e))), 'alternatives respect equipment');
  ok(a.list.every(x => x.id !== d.main[0].ex && !d.main.some(it => it.ex === x.id)), 'alternatives exclude exercises already in the session');
  const samePatUsable = EXERCISES.some(e => e.id !== d.main[0].ex && CT.exMeta(e.id).pattern === m0.pattern && CT.exMeta(e.id).eq.every(q => ['none', ...params.equipment].includes(q)));
  ok(samePatUsable ? CT.exMeta(a.list[0].id).pattern === m0.pattern : (a.hiddenByEquipment.length > 0 || !EXERCISES.some(e => e.id !== d.main[0].ex && CT.exMeta(e.id).pattern === m0.pattern)), 'same movement pattern first when usable; otherwise equipment-locked options are named (' + a.hiddenByEquipment.join('; ') + ')');
  ok(a.list.every(x => Array.isArray(x.diffs) && x.d >= 1 && x.d <= 3), 'alternatives list difficulty and differences');
  PS.swap(p.id, d.n, 0, a.list[0].id, 'day'); ok(PS.dayOf(PS.get(p.id), d.n).main[0].ex === a.list[0].id, 'swap for one day');
  const later = PS.days(PS.get(p.id)).filter(x => x.n > d.n && (x.main || []).some(it => it.ex === d.main[0].ex));
  ok(later.length > 0, 'other days keep the original exercise after a one-day swap');
  ok(throws(() => PS.swap(p.id, d.n, 1, 'burpee', 'day')), 'non-alternative rejected');
  // no alternative → reason
  const p2 = JSON.parse(JSON.stringify(PS.get(p.id))); const dd = PS.days(p2).find(x => (x.main || []).some(it => it.ex === 'calf_raise'));
  if (dd) { const r = PS.alternatives(PS.get(p.id), dd.n, dd.main.findIndex(it => it.ex === 'calf_raise')); ok(r.list.length > 0 || !!r.reason, 'calf raise: alternatives or an explicit reason'); } }
{ // explicit "no alternative" case: exclude every other exercise of the pattern
  reset(); user({ exercisePrefs: { fav: [], exclude: [], noJump: false } }); const pr = PS.paramsFromProfile(S.load('profile'));
  const pl = PS.activate(PS.create('general_90', pr, '2026-10-19')); const d = PS.days(pl).find(x => x.type !== 'assess' && (x.main || []).length && x.date > '2026-10-20');
  const m0 = CT.exMeta(d.main[0].ex); const same = EXERCISES.filter(e => CT.exMeta(e.id).pattern === m0.pattern && e.id !== d.main[0].ex).map(e => e.id);
  pl.segments[0].params.exclude = EXERCISES.filter(e => e.id !== d.main[0].ex && (CT.exFacts(e).cat === CT.exFacts(EXERCISES.find(x => x.id === d.main[0].ex)).cat || same.includes(e.id))).map(e => e.id); S.save('plans');
  const r = PS.alternatives(PS.get(pl.id), d.n, 0); ok(r.list.length === 0 && /הוחרגו|ציוד|אין בספרייה/.test(r.reason || ''), 'no alternative → explained (' + (r.reason || '') + ')'); }

T('history is frozen');
reset(); user(); plan = PS.activate(PS.create('general_90', PS.paramsFromProfile(S.load('profile')), '2026-10-19'));
{ const tr = PS.days(plan).filter(PS.isTraining); const d0 = tr[1];
  setNow(d0.date); PS.logDay(plan.id, d0.n, { status: 'done', rpe: 6, source: 'test' }); const snap = JSON.stringify(PS.dayOf(PS.get(plan.id), d0.n).main);
  ok(throws(() => PS.skip(plan.id, d0.n), /נרשם/) && throws(() => PS.swap(plan.id, d0.n, 0, 'x', 'day'), /נרשם/), 'logged day cannot be changed');
  setNow(S.addDays(d0.date, 1));
  const ex0 = PS.dayOf(PS.get(plan.id), d0.n).main[0].ex, nd = PS.days(PS.get(plan.id)).find(x => x.n > d0.n && (x.main || []).some(it => it.ex === ex0) && x.type !== 'assess');
  const alt = PS.alternatives(PS.get(plan.id), nd.n, nd.main.findIndex(it => it.ex === ex0)).list[0];
  PS.swap(plan.id, nd.n, nd.main.findIndex(it => it.ex === ex0), alt.id, 'future');
  ok(JSON.stringify(PS.dayOf(PS.get(plan.id), d0.n).main) === snap, 'future replacement does not change the logged day');
  ok(PS.days(PS.get(plan.id)).filter(x => x.n >= nd.n && !x.log).every(x => !(x.main || []).some(it => it.ex === ex0)), 'future replacement applied to all later days');
  // availability change from next open day
  const before = PS.days(PS.get(plan.id)); const np = Object.assign({}, PS.get(plan.id).segments[0].params, { days: [0, 2, 4, 6], spw: 4 });
  const diff = PS.diffParams(plan.id, np); ok(diff.after.perWeek > diff.before.perWeek, `diff shows more sessions per week (${diff.before.perWeek} → ${diff.after.perWeek})`);
  const from = PS.applyParams(plan.id, np, 'test'); const after = PS.days(PS.get(plan.id));
  ok(after.filter(d => d.n < from).every((d, i) => JSON.stringify([d.date, d.type, (d.main || []).map(x => x.ex)]) === JSON.stringify([before[i].date, before[i].type, (before[i].main || []).map(x => x.ex)])), 'days before the change are identical');
  ok(after.filter(d => d.n >= from && PS.isTraining(d) && !d.log).every(d => [0, 2, 4, 6].includes(dow(d.date))), 'after the change: only the new weekdays');
  ok(PS.dayOf(PS.get(plan.id), d0.n).log.status === 'done', 'log kept through the change');
  // equipment change
  const np2 = Object.assign({}, np, { equipment: ['chair', 'wall', 'doorframe'] }); PS.applyParams(plan.id, np2, 'eq');
  ok(PS.days(PS.get(plan.id)).filter(d => !d.log).flatMap(d => (d.main || []).concat(d.finisher || [])).every(it => CT.exMeta(it.ex).eq.every(e => ['none', 'chair', 'wall', 'doorframe'].includes(e))), 'equipment change respected');
  ok(PS.get(plan.id).changes.length >= 4, 'changes recorded in history'); }

T('pause & resume');
reset(); user(); plan = PS.activate(PS.create('general_90', PS.paramsFromProfile(S.load('profile')), '2026-10-19'));
{ const d1 = PS.days(plan).filter(PS.isTraining)[0]; setNow(d1.date); PS.logDay(plan.id, d1.n, { status: 'done' });
  setNow('2026-10-21'); const nextBefore = PS.days(PS.get(plan.id)).find(d => d.n > d1.n && PS.isTraining(d));
  PS.pause(plan.id); ok(PS.get(plan.id).status === 'paused' && PS.days(PS.get(plan.id)).some(d => d.status === 'paused'), 'paused: remaining days marked');
  setNow('2026-10-30'); PS.resume(plan.id); const p = PS.get(plan.id);
  ok(p.status === 'active' && p.shifts.length === 1 && p.shifts[0].add > 0, 'resume records the delay (' + (p.shifts[0] && p.shifts[0].add) + ' days)');
  const ds2 = PS.days(p); ok(ds2.filter(d => d.n >= p.shifts[0].fromDay && PS.isTraining(d)).every(d => d.date >= '2026-10-30' && [1, 3, 5].includes(dow(d.date))), 'after resume: no session in the past, weekdays kept');
  ok(ds2.length === 90 && ds2[89].date > PS.days(Object.assign({}, p, { shifts: [] }))[89].date, 'program length kept; end date moved later');
  ok(PS.dayOf(p, d1.n).log.status === 'done' && PS.dayOf(p, d1.n).date === d1.date, 'completed day untouched by pause');
  setNow('2026-10-30'); PS.pause(plan.id); PS.resume(plan.id); ok(PS.get(plan.id).shifts.length === 1, 'pause and resume on the same day → no extra delay'); }

T('switch & cancel');
{ const p = PS.active(); const done = Object.keys(p.log).length;
  const np = PS.create('fatloss_30', PS.paramsFromProfile(S.load('profile')), '2026-10-30');
  ok(throws(() => PS.activate(np), /NEEDS_CONFIRM|לאשר/), 'switching requires confirmation');
  PS.activate(np, { confirmReplace: true }); ok(PS.get(p.id).status === 'replaced' && Object.keys(PS.get(p.id).log).length === done && PS.active().id === np.id, 'old plan replaced, its history kept');
  PS.cancel(np.id); ok(PS.active() === null && PS.get(np.id).status === 'cancelled' && PS.list().length === 2, 'cancel keeps the plan and history; no active plan'); }

T('backup & restore');
{ const exp = S.exportAll(); ok(exp.version === S.VERSION && exp.plans && Object.keys(exp.plans.list).length === 2, 'export includes plans');
  const json = JSON.stringify(exp); S.resetAll(); S.importAll(JSON.parse(json)); ok(JSON.stringify(S.exportAll(), (k, v) => k === 'exportedAt' ? undefined : v) === JSON.stringify(JSON.parse(json), (k, v) => k === 'exportedAt' ? undefined : v), 'restore reproduces everything incl. plans');
  const old = JSON.parse(json); old.version = 1; delete old.plans; old.profile = { v: 1, age: 30, height: 180, startWeight: 80, weight: 80, startDate: '2026-10-01', units: { w: 'kg', len: 'cm' }, goals: { steps: 10000, water: 3000, sleep: 7.5 }, prefs: { chicken: true, egg: true, dairy: true, veg: false, exclude: [], flex: true, flexName: 'x' }, display: { size: 'normal', motion: 'auto', wake: true, sound: true }, onboarded: true };
  ok(S.validateBackup(old) === null, 'old (v1) backup without plans is valid'); S.importAll(old);
  const p = S.load('profile'); ok(p.schema === 2 && p.age === 30 && p.legacy && p.legacy.sex === 'm' && Array.isArray(p.availability.days), 'old backup: profile migrated, new fields filled');
  ok(S.load('plans').active === null && Object.keys(S.load('plans').list).length === 0, 'old backup: plans start empty (the backup has none)');
  const snap = JSON.stringify(S.exportAll(), (k, v) => k === 'exportedAt' ? undefined : v);
  const bad = [['plans not an object', Object.assign({}, exp, { plans: [1] })], ['plan without segments', Object.assign({}, exp, { plans: { active: null, list: { x: { templateId: 'annual', start: '2026-10-01', segments: [] } } } })], ['active plan missing', Object.assign({}, exp, { plans: { active: 'zz', list: {} } })], ['future version', Object.assign({}, exp, { version: S.VERSION + 1 })], ['bad age', Object.assign({}, exp, { profile: Object.assign({}, exp.profile, { age: 3 }) })], ['aims not object', Object.assign({}, exp, { profile: Object.assign({}, exp.profile, { aims: 'x' }) })]];
  bad.forEach(([n, o]) => { const e = S.validateBackup(o); ok(!!e && e.length > 5, 'rejected with message: ' + n); let threw = false; try { S.importAll(o); } catch (x) { threw = true; } ok(threw && JSON.stringify(S.exportAll(), (k, v) => k === 'exportedAt' ? undefined : v) === snap, 'data untouched: ' + n); }); }

T('planner compliance (30/60/90/180/365/custom)');
const combos = [{ days: [1, 3, 5], spw: 3, maxMin: 30, equipment: [] }, { days: [0, 1, 2, 3, 4], spw: 5, maxMin: 45, equipment: ['chair', 'wall', 'doorframe', 'towel'] }, { days: [6], spw: 1, maxMin: 20, equipment: ['table'] }, { days: [0, 1, 2, 3, 4, 5, 6], spw: 6, maxMin: 60, equipment: ['bench', 'step'], noJump: true, level: 'advanced' }, { days: [2, 4], spw: 2, maxMin: 15, equipment: [], exclude: ['squat', 'pushup', 'plank'] }];
const rowsB = [];
for (const [tid, len] of [['habits_30'], ['general_60'], ['general_90'], ['progress_6m'], ['annual'], ['custom', 45], ['custom', 365]]) for (const c of combos) {
  reset(); user(); const pr = Object.assign(PS.paramsFromProfile(S.load('profile')), { level: 'intermediate', exclude: [], noJump: false }, c);
  const pl = PS.create(tid, pr, '2026-10-19', len), d = PS.preview(pl).days, L = `${tid}${len ? ':' + len : ''} ${JSON.stringify(c.days)}×${c.spw}`;
  const tr = d.filter(PS.isTraining), have = ['none', ...c.equipment];
  ok(tr.every(x => c.days.includes(dow(x.date))), L + ': only available weekdays');
  const wk = {}; d.forEach(x => { wk[x.week] = (wk[x.week] || 0) + (PS.isTraining(x) ? 1 : 0); }); ok(Object.values(wk).every(v => v <= c.spw), L + ': ≤ sessions/week chosen');
  ok(d.flatMap(x => (x.main || []).concat(x.finisher || [], x.warm || [], x.cool || [])).every(it => CT.exMeta(it.ex).eq.every(e => have.includes(e))), L + ': equipment respected');
  ok(!d.flatMap(x => x.main || []).some(it => (c.exclude || []).includes(it.ex)), L + ': exclusions respected');
  if (c.noJump) ok(!d.flatMap(x => (x.main || []).concat(x.finisher || [])).some(it => CT.exMeta(it.ex).impact === 'high'), L + ': no jumping');
  ok(tr.filter(x => x.type !== 'assess').every(x => x.minutes <= c.maxMin + 0.01 || x.notes.some(n => /מעל/.test(n))), L + ': time limit or explicit note');
  if (d.length >= 7 * 2) ok(Object.keys(wk).filter(k => d.filter(x => x.week === +k).length === 7).every(k => d.filter(x => x.week === +k && !PS.isTraining(x)).length >= 1), L + ': rest day every week');
  // no unexplained load jumps: same exercise in consecutive weeks of a phase gains at most 1 rep per week (deload and phase changes excepted)
  const seq = {}; tr.filter(x => x.type !== 'assess' && !x.deload).forEach(x => (x.main || []).forEach(it => { if (it.reps && typeof it.reps === 'number') { const k = it.ex + '|' + x.phase.idx; (seq[k] = seq[k] || []).push({ w: x.weekInPhase, r: it.reps }); } }));
  ok(Object.values(seq).every(a => a.every((v, i) => i === 0 || v.w === a[i - 1].w || v.r - a[i - 1].r <= (v.w - a[i - 1].w))), L + ': reps rise ≤1 per week within a phase');
  const s = PS.preview(pl).summary; rowsB.push({ template: tid + (len ? ':' + len : ''), days: d.length, weekdays: c.days.join(''), spw: c.spw, maxMin: c.maxMin, eq: c.equipment.join(',') || 'none', sessions: s.sessions, deloadWeeks: s.deloadWeeks, avgMin: s.avgMinutes, exercises: s.exercisesUsed, phases: s.phases.length });
}
{ // variety across phases when alternatives exist
  const pl = PL.build('annual', { start: '2026-10-19', profile: { level: 'intermediate', spw: 4, maxMin: 45, equipment: ['chair', 'wall', 'doorframe', 'towel', 'table', 'bench', 'step'] } });
  const byPhase = {}; pl.days.filter(d => d.main && !['assess', 'active'].includes(d.type)).forEach(d => { (byPhase[d.phase.idx] = byPhase[d.phase.idx] || new Set()); d.main.forEach(it => byPhase[d.phase.idx].add(it.ex)); });
  const ph = Object.values(byPhase); let changed = 0; for (let i = 1; i < ph.length; i++) { const a = ph[i - 1], b = ph[i]; changed += [...b].filter(x => !a.has(x)).length / b.size; }
  ok(changed / (ph.length - 1) >= 0.2, `annual: on average ${(changed / (ph.length - 1) * 100).toFixed(0)}% of exercises change from phase to phase`);
  ok(pl.summary.deloadWeeks >= 8, 'annual: recovery weeks kept (' + pl.summary.deloadWeeks + ')'); }

S.today = REAL;
fs.mkdirSync(path.join(ROOT, 'dist/reports'), { recursive: true }); fs.writeFileSync(path.join(ROOT, 'dist/reports/stageB-test.json'), JSON.stringify({ pass, fail, sections: sec, fails, complianceRows: rowsB }, null, 1));
console.log(JSON.stringify(sec)); if (fails.length) console.log('FAILURES:\n' + fails.slice(0, 40).join('\n')); console.log(`stage B tests: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
