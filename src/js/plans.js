/* Personal plans (Stage B). Store key 'fit30.plans' = { v, active, list: { id: Plan } }.
   A Plan is NOT a stored calendar: it is the template + parameters (+ approved changes); the calendar is regenerated
   deterministically by the Planner. This keeps four things separate:
     - the original plan         → segments[0].params (+ template)
     - approved changes          → later segments (from a given day), replacements, per-day overrides, pauses
     - the change history        → changes[] (what, when, from which day)
     - performance history       → log[n] with a snapshot of what was actually done — never rewritten by later changes. */
(function (root) {
  'use strict';
  const S = () => root.Store, PL = () => root.Planner, PG = () => root.PROGRAMS, CT = () => root.CATALOG;
  const st = () => S().load('plans'), save = () => S().save('plans');
  const today = () => S().today();
  const uid = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const clone = o => JSON.parse(JSON.stringify(o));
  const SCHEMA = 1;

  /* planner parameters from the profile; every value comes from what the user entered */
  function paramsFromProfile(p, over) {
    const a = p.availability || {}, env = p.environment || {}, xp = p.exercisePrefs || {};
    return Object.assign({ level: p.experience || null, days: (a.days || []).slice().sort(), spw: a.sessions || null, maxMin: a.maxMin || null, prefMin: a.prefMin || null,
      equipment: (env.equipment || []).filter(e => CT().EQUIPMENT[e] && e !== 'none'), goal: (p.aims && p.aims.primary) || null, secondary: ((p.aims && p.aims.secondary) || []).slice(),
      exclude: (xp.exclude || []).slice(), fav: (xp.fav || []).slice(), noJump: !!xp.noJump }, over || {});
  }
  /* what is missing before a plan can be generated, in the order the setup flow asks for it */
  function missing(params) {
    const m = [];
    if (!params.goal) m.push('מטרה ראשית');
    if (!params.level) m.push('רמת ניסיון');
    if (!params.days || !params.days.length) m.push('ימים זמינים');
    if (!params.maxMin) m.push('זמן מקסימלי לאימון');
    return m;
  }
  /* template availability vs the exercise library (no pretending) */
  function templateGaps(t) { return (t.needsLibrary || []).filter(eq => !root.EXERCISES.some(e => CT().exMeta(e.id).eq.includes(eq))); }
  const activatable = t => !t.classic && templateGaps(t).length === 0;

  function plannerOpts(plan, params, shifts) {
    const o = { start: plan.start, profile: { level: params.level || 'beginner', days: params.days, spw: params.spw, maxMin: params.maxMin, prefMin: params.prefMin, equipment: params.equipment, exclude: params.exclude, fav: params.fav, noJump: params.noJump }, goal: params.goal || undefined, shifts };
    if (PG().byId(plan.templateId).custom) o.days = plan.days;
    return o;
  }
  /* nominal date of day n without pause k and later pauses, and the add of an ongoing pause (as if resumed tomorrow) */
  function resolvedShifts(plan) {
    const out = [];
    (plan.shifts || []).forEach(sh => {
      if (sh.add != null) { out.push({ fromDay: sh.fromDay, add: sh.add }); return; }
      const nominal = S().addDays(plan.start, sh.fromDay - 1 + out.reduce((a, x) => a + (x.fromDay <= sh.fromDay ? x.add : 0), 0));
      out.push({ fromDay: sh.fromDay, add: Math.max(0, S().diffDays(nominal, today()) + 1), ongoing: true });
    });
    return out;
  }
  const memo = new Map();
  function rawDays(plan) {
    const shifts = resolvedShifts(plan);
    const key = JSON.stringify([plan.templateId, plan.start, plan.days, plan.segments, shifts]);
    if (memo.has(key)) return memo.get(key);
    const builds = plan.segments.map(sg => PL().build(plan.templateId, plannerOpts(plan, sg.params, shifts)));
    const days = builds[0].days.map((d, i) => { let k = 0; plan.segments.forEach((sg, j) => { if (sg.fromDay <= d.n) k = j; }); return Object.assign(builds[k].days[i], { seg: k }); });
    const r = { days, summary: builds[0].summary, summaries: builds.map(b => b.summary) }; memo.set(key, r); if (memo.size > 20) memo.delete(memo.keys().next().value); return r;
  }
  function convertItem(it, toId) {
    const m = CT().exMeta(toId), n = Object.assign({}, it, { ex: toId });
    if ((m.type === 'isometric' || m.type === 'mobility') && n.reps && n.reps !== 'max') { delete n.reps; n.sec = 30; }
    else if (['strength', 'plyometric'].includes(m.type) && typeof n.sec === 'number' && !n.reps && !n.circuit) { delete n.sec; n.reps = 10; }
    if (m.uni) n.side = true; else delete n.side;
    return n;
  }
  /* the effective calendar: generated days + replacements + per-day overrides; logged days show what was logged */
  function days(plan) {
    const t = today(), base = rawDays(plan).days;
    return base.map(d0 => {
      const n = d0.n, lg = (plan.log || {})[n], ov = (plan.overrides || {})[n] || {};
      let d = clone(d0); d.plannedDate = d.date;
      if (lg && lg.snapshot) { d = Object.assign(d, clone(lg.snapshot)); }
      else if (d.main) {
        (plan.replace || []).filter(r => r.fromDay <= n).forEach(r => { ['main', 'finisher'].forEach(k => { d[k] = (d[k] || []).map(it => it.ex === r.from ? convertItem(it, r.to) : it); }); });
        Object.entries(ov.swaps || {}).forEach(([i, ex]) => { if (d.main[i]) d.main[i] = convertItem(d.main[i], ex); });
        if (ov.version) d = PL().versioned(d, ov.version); else d.minutes = PL().sessionMinutes(d);
        /* Stage F: approved per-day adaptations {ex: {lvl?, sets?, rule}} — level and ±sets, bounded; never on logged days */
        if (ov.adj && Object.keys(ov.adj).length) { ['main', 'finisher'].forEach(k => { d[k] = (d[k] || []).map(it => { const a = ov.adj[it.ex]; if (!a) return it;
          const x = Object.assign({}, it); if (a.lvl) { x.lvl = a.lvl; x.adjLvl = a.lvl; } if (a.sets) x.sets = Math.max(1, Math.min(6, (it.sets || 1) + a.sets)); x.adjusted = a.rule || 'adapt'; return x; }); }); d.minutes = PL().sessionMinutes(d); d.adapted = true; }
      }
      if (ov.moveTo && !lg) d.date = ov.moveTo;
      const training = !['rest', 'active'].includes(d.type);
      d.status = lg ? lg.status : ov.skip ? 'skipped' : (training && d.date < t) ? 'missed' : d.date === t ? 'today' : 'planned';
      if (plan.status === 'paused' && !lg && d.date >= t && (plan.shifts || []).some(sh => sh.add == null && sh.fromDay <= n)) d.status = 'paused';
      d.movedTo = ov.moveTo || null; d.version = ov.version || d.version || 'std'; d.log = lg || null; d.overridden = !!(ov.swaps && Object.keys(ov.swaps).length);
      return d;
    });
  }
  const isTraining = d => d && !['rest', 'active'].includes(d.type);

  /* ---------- store helpers ---------- */
  const get = id => st().list[id] || null;
  const active = () => { const s = st(); return s.active ? s.list[s.active] || null : null; };
  function addChange(plan, type, text, extra) { plan.changes = plan.changes || []; plan.changes.push(Object.assign({ at: new Date().toISOString(), date: today(), type, text }, extra || {})); }
  function firstOpenDay(plan) { const ds = days(plan); const d = ds.find(x => x.date >= today() && !x.log); return d ? d.n : ds.length + 1; }

  function create(templateId, params, start, length) {
    const t = PG().byId(templateId); if (!t) throw new Error('מסלול לא קיים');
    if (t.classic) throw new Error('תוכנית 30 היום הקיימת פעילה כבר דרך מסך האימונים.');
    const gaps = templateGaps(t); if (gaps.length) throw new Error('המסלול דורש ציוד שאין לו עדיין תרגילים בספרייה: ' + gaps.map(g => CT().EQUIPMENT[g].he).join(', '));
    const m = missing(params); if (m.length) throw new Error('חסר בפרופיל: ' + m.join(', '));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start || '')) throw new Error('תאריך התחלה לא תקין');
    if (start < today()) throw new Error('תאריך ההתחלה כבר עבר');
    const plan = { id: uid(), schema: SCHEMA, templateId, start, days: t.custom ? length : t.days, createdAt: new Date().toISOString(), status: 'draft', plannerVersion: PL().VERSION,
      segments: [{ fromDay: 1, params: clone(params), at: new Date().toISOString() }], shifts: [], overrides: {}, replace: [], log: {}, changes: [] };
    if (t.custom && !(length >= 1 && length <= 365)) throw new Error('אורך תוכנית אישית: 1–365 ימים');
    PL().build(templateId, plannerOpts(plan, params, [])); // throws on invalid input
    return plan;
  }
  function preview(plan) { const r = rawDays(plan); return { summary: r.summary, days: days(plan), gaps: r.summary.gaps }; }
  /* activation; replacing an active plan requires explicit confirmation (confirmReplace) */
  function activate(plan, opts) {
    const s = st(), cur = active();
    /* fixed 25.10.2026: idempotent — a second tap on "activate" used to mark the plan it had just activated as replaced (endedAt + a bogus change) */
    if (cur && cur.id === plan.id) return cur;
    if (cur && ['active', 'paused'].includes(cur.status) && !(opts && opts.confirmReplace)) { const e = new Error('יש תוכנית פעילה. צריך לאשר את ההחלפה.'); e.code = 'NEEDS_CONFIRM'; throw e; }
    if (cur && ['active', 'paused'].includes(cur.status)) { cur.status = 'replaced'; cur.endedAt = today(); addChange(cur, 'replaced', 'הוחלפה בתוכנית ' + PG().byId(plan.templateId).he); }
    plan.status = 'active'; plan.activatedAt = new Date().toISOString(); addChange(plan, 'activated', 'התוכנית הופעלה, מתחילה ' + S().fmtDate(plan.start));
    s.list[plan.id] = plan; s.active = plan.id; if (root.MealPlan) root.MealPlan.ensure(plan); /* menu settings recorded at activation */ save(); const pr = S().load('profile'); if (!pr.onboarded) { pr.onboarded = true; S().save('profile'); } return plan;
  }
  function pause(id) { const p = get(id); if (!p || p.status !== 'active') throw new Error('אפשר להשהות רק תוכנית פעילה'); const n = firstOpenDay(p); p.shifts.push({ fromDay: n, add: null, from: today() }); p.status = 'paused'; addChange(p, 'paused', 'הושהתה מיום ' + n); save(); }
  function resume(id) {
    const p = get(id); if (!p || p.status !== 'paused') throw new Error('התוכנית לא מושהית');
    const rs = resolvedShifts(p), k = p.shifts.findIndex(x => x.add == null); let add = 0;
    if (k >= 0) { add = Math.max(0, rs[k].add - 1); /* resumes today; the ongoing projection assumed tomorrow */ if (add) Object.assign(p.shifts[k], { add, to: today() }); else p.shifts.splice(k, 1); }
    p.status = 'active'; addChange(p, 'resumed', 'חודשה; הימים הבאים נדחו ב־' + add + ' ימים'); save();
  }
  function cancel(id) { const s = st(), p = get(id); if (!p) return; p.status = 'cancelled'; p.endedAt = today(); addChange(p, 'cancelled', 'בוטלה — ההיסטוריה נשמרה'); if (s.active === id) s.active = null; save(); }
  function dayOf(p, n) { return days(p).find(d => d.n === n) || null; }
  function assertFuture(p, d, what) { if (!d) throw new Error('יום לא קיים'); if (d.log) throw new Error('אי אפשר ' + what + ' יום שכבר נרשם'); if ((d.movedTo || d.date) < today()) throw new Error('אי אפשר ' + what + ' יום שעבר'); }
  function skip(id, n) { const p = get(id), d = dayOf(p, n); assertFuture(p, d, 'לדלג על'); if (!isTraining(d)) throw new Error('אין אימון ביום הזה');
    p.overrides[n] = Object.assign(p.overrides[n] || {}, { skip: true }); addChange(p, 'skip', `דילוג על יום ${n}`); save(); }
  function unskip(id, n) { const p = get(id); if (p.overrides[n]) delete p.overrides[n].skip; addChange(p, 'unskip', `ביטול דילוג ביום ${n}`); save(); }
  function move(id, n, to) {
    const p = get(id), d = dayOf(p, n); if (!(d && d.status === 'missed' && !d.log)) assertFuture(p, d, 'להעביר'); /* a missed (unlogged) session may be moved forward to today or later */ if (!isTraining(d)) throw new Error('אין אימון להעביר ביום הזה');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(to || '') || to < today()) throw new Error('בחרו תאריך מהיום והלאה');
    const ds = days(p); const last = ds[ds.length - 1].date; if (to > S().addDays(last, 7)) throw new Error('התאריך מחוץ לטווח התוכנית');
    const busy = ds.find(x => x.n !== n && isTraining(x) && x.status !== 'skipped' && (x.date === to));
    if (busy) throw new Error(`ב־${S().fmtDate(to)} כבר יש אימון (${busy.title}). בחרו יום מנוחה, או דלגו על אחד מהם.`);
    p.overrides[n] = Object.assign(p.overrides[n] || {}, { moveTo: to }); addChange(p, 'move', `יום ${n} הועבר ל־${S().fmtDate(to)}`); save();
  }
  function setVersion(id, n, v) { const p = get(id), d = dayOf(p, n); assertFuture(p, d, 'לשנות'); if (!['short', 'std', 'long'].includes(v)) throw new Error('גרסה לא תקינה');
    if (['assess', 'active'].includes(d.type)) throw new Error('למבחן ולהתאוששות אין גרסאות'); p.overrides[n] = Object.assign(p.overrides[n] || {}, { version: v === 'std' ? undefined : v }); save(); }

  /* Smart Exercise Substitution — ONE ranking shared by personal plans (alternatives below) and the Workout Builder.
     ctx = { have: equipment ids incl. 'none', exclude: [ids], noJump, inSession: Set(ids already in the workout), fav: [ids],
             level: 'beginner'|'intermediate'|'advanced'|null, phase: 'warm'|'main'|'cool' }.
     Ranking: same movement pattern (+3), shared primary muscles (≤ +2), same exercise type (+1), shared secondary muscles (+0.5),
     favourite (+0.5), difficulty distance (−1 per level), above the user's level (−1). Hard filters: equipment, exclusions,
     "no jumping", already in the workout, phase (warm-up / cool-down accept only mobility, breathing and light cardio).
     Nothing is invented: every reason and difference comes from the catalogue facts; no candidate → the reason is stated. */
  const LVL_CAP = { beginner: 2, intermediate: 3, advanced: 3 };
  const LIGHT = m => ['mobility', 'breathing'].includes(m.type) || m.pattern === 'cardio_low';
  function rank(it, ctx) {
    const e0 = root.EX_BY_ID[it.ex]; if (!e0) return { list: [], reason: 'התרגיל לא נמצא בספרייה — אין נתונים לבחירת חלופה.', hiddenByEquipment: [], current: null };
    const m0 = CT().exFacts(e0), have = ctx.have || ['none'], inSession = ctx.inSession || new Set(), ex = ctx.exclude || [], fav = ctx.fav || [];
    const words = list => new Set((list || []).flatMap(x => x.split(/\s+/)).filter(w => w.length > 2));
    const w0 = words(m0.primary), s0 = words(m0.secondary); const all = root.EXERCISES.map(e => CT().exFacts(e)).filter(m => m.id !== it.ex);
    const phaseOk = m => ctx.phase === 'warm' || ctx.phase === 'cool' ? LIGHT(m) : (LIGHT(m0) || !['mobility', 'breathing'].includes(m.type));
    const sameKind = all.filter(m => phaseOk(m) && (m.pattern === m0.pattern || (m.cat === m0.cat && [...words(m.primary)].some(w => w0.has(w)))));
    const ok = sameKind.filter(m => CT().usableWith(root.EX_BY_ID[m.id], have) && !ex.includes(m.id) && !(ctx.noJump && m.impact === 'high') && !inSession.has(m.id));
    const t0 = PL().itemSec(it), cap = LVL_CAP[ctx.level] || null;
    const list = ok.map(m => {
      const overlap = [...words(m.primary)].filter(w => w0.has(w)).length, sec = [...words(m.secondary)].some(w => s0.has(w) || w0.has(w));
      const score = (m.pattern === m0.pattern ? 3 : 0) + Math.min(2, overlap) + (m.type === m0.type ? 1 : 0) - Math.abs(m.d - m0.d) + (sec ? 0.5 : 0) + (fav.includes(m.id) ? 0.5 : 0) - (cap && m.d > cap ? 1 : 0);
      const conv = convertItem(it, m.id), dt = Math.round(PL().itemSec(conv) - t0), diffs = [], why = [];
      if (m.d !== m0.d) diffs.push(m.d > m0.d ? 'קשה יותר' : 'קל יותר');
      if (cap && m.d > cap) diffs.push('מעל הרמה שהגדרת');
      if (m.pattern !== m0.pattern) diffs.push('דפוס תנועה אחר: ' + CT().PATTERN_HE[m.pattern]);
      if (m.type !== m0.type) diffs.push(CT().TYPE_HE[m.type] + ' במקום ' + CT().TYPE_HE[m0.type]);
      if (conv.sec && it.reps) diffs.push(`נמדד בשניות (${conv.sec} שנ׳) במקום חזרות`); if (conv.reps && typeof it.sec === 'number' && !it.reps) diffs.push(`נמדד בחזרות (${conv.reps}) במקום שניות`);
      if (m.uni && !m0.uni) diffs.push('כל צד בנפרד');
      if (m.impact === 'high' && m0.impact !== 'high') diffs.push('כולל קפיצות');
      if (Math.abs(dt) >= 20) diffs.push((dt > 0 ? '+' : '−') + Math.abs(Math.round(dt / 6) / 10) + ' דק׳ לאימון');
      if (m.pattern === m0.pattern) why.push('אותו דפוס תנועה (' + CT().PATTERN_HE[m.pattern] + ')');
      const shared = m.primary.filter(x => m0.primary.includes(x)); if (shared.length) why.push('עובד על ' + shared.join(', ')); else if (m.primary.length) why.push('שרירים: ' + m.primary.join(', ')); else why.push('אין בקטלוג פירוט שרירים לתרגיל הזה');
      why.push(m.eq.length ? 'ציוד: ' + m.eq.map(e => CT().EQUIPMENT[e].he).join(', ') : 'בלי ציוד'); if (fav.includes(m.id)) why.push('ברשימת המועדפים שלך');
      return { id: m.id, he: root.EX_BY_ID[m.id].he, d: m.d, eq: m.eq.map(e => CT().EQUIPMENT[e].he), primary: m.primary, score, diffs, why, keeps: conv.sets === it.sets && conv.rest === it.rest && !!conv.reps === !!it.reps, item: conv };
    }).filter(x => x.score >= 2).sort((a, b) => b.score - a.score || a.d - b.d || (a.id < b.id ? -1 : 1)).slice(0, 6);
    let reason = null;
    if (!list.length) {
      const needEq = sameKind.filter(m => !CT().usableWith(root.EX_BY_ID[m.id], have));
      reason = !sameKind.length ? `אין בספרייה תרגיל נוסף מאותו סוג (${CT().PATTERN_HE[m0.pattern]}).`
        : needEq.length === sameKind.length ? 'החלופות הקיימות דורשות ציוד שלא סימנת: ' + [...new Set(needEq.flatMap(m => m.eq.map(e => CT().EQUIPMENT[e].he)))].join(', ') + '.'
        : 'החלופות הקיימות כבר נמצאות באימון, הוחרגו או כוללות קפיצות שביקשת להימנע מהן.';
    }
    const hidden = [...new Set(sameKind.filter(m => m.pattern === m0.pattern && !CT().usableWith(root.EX_BY_ID[m.id], have)).map(m => root.EX_BY_ID[m.id].he + ' (' + m.eq.map(e => CT().EQUIPMENT[e].he).join(', ') + ')'))];
    return { list, reason, hiddenByEquipment: hidden, current: { id: it.ex, he: e0.he, d: m0.d, eq: m0.eq.map(e => CT().EQUIPMENT[e].he) } };
  }
  /* exercise alternatives for a personal-plan day (the shared ranking with the plan's own constraints) */
  function alternatives(p, n, idx) {
    const d = dayOf(p, n), it = d && d.main && d.main[idx]; if (!it) return { list: [], reason: 'אין תרגיל במקום הזה' };
    const params = p.segments.filter(s => s.fromDay <= n).pop().params;
    return rank(it, { have: ['none', ...params.equipment], exclude: params.exclude, noJump: params.noJump, inSession: new Set(d.main.map(x => x.ex)), fav: params.fav || [], level: params.level, phase: 'main' });
  }
  function swap(id, n, idx, toId, scope) {
    const p = get(id), d = dayOf(p, n); assertFuture(p, d, 'לשנות'); const from = d.main[idx] && d.main[idx].ex; if (!from) throw new Error('אין תרגיל במקום הזה');
    if (!alternatives(p, n, idx).list.some(a => a.id === toId)) throw new Error('התרגיל אינו חלופה מתאימה');
    if (scope === 'future') { p.replace.push({ fromDay: n, from, to: toId, at: new Date().toISOString() }); addChange(p, 'replace', `${root.EX_BY_ID[from].he} ← ${root.EX_BY_ID[toId].he} מיום ${n} והלאה`); }
    else { p.overrides[n] = p.overrides[n] || {}; p.overrides[n].swaps = Object.assign(p.overrides[n].swaps || {}, { [idx]: toId }); addChange(p, 'swap', `יום ${n}: ${root.EX_BY_ID[from].he} ← ${root.EX_BY_ID[toId].he}`); }
    save();
  }
  /* availability / equipment / time changes: preview the difference for the remaining days, then apply from the next open day */
  function diffParams(id, newParams) {
    const p = get(id), fromDay = firstOpenDay(p);
    const after = clone(p); after.segments.push({ fromDay, params: clone(newParams) });
    const pick = pl => days(pl).filter(d => d.n >= fromDay), A = pick(p), B = pick(after);
    const tr = ds => ds.filter(d => isTraining(d) && d.status !== 'skipped');
    const exs = ds => new Set(tr(ds).flatMap(d => (d.main || []).map(x => x.ex)));
    const ea = exs(A), eb = exs(B), weeks = Math.max(1, A.length / 7);
    const avg = ds => { const t = tr(ds).filter(d => d.minutes); return t.length ? Math.round(t.reduce((s, d) => s + d.minutes, 0) / t.length) : 0; };
    return { fromDay, remainingDays: A.length, before: { perWeek: +(tr(A).length / weeks).toFixed(1), sessions: tr(A).length, avgMin: avg(A) }, after: { perWeek: +(tr(B).length / weeks).toFixed(1), sessions: tr(B).length, avgMin: avg(B) },
      removed: [...ea].filter(x => !eb.has(x)), added: [...eb].filter(x => !ea.has(x)), datesChanged: B.filter((d, i) => isTraining(d) !== isTraining(A[i])).length };
  }
  /* Stage H1: what the profile says now vs. what the active plan runs with (its latest settings segment). Edits made in
     the profile are saved to the profile only; the plan changes only after the user approves (history is never touched).
     Every key here changes the generated plan; only keys whose value differs are returned. */
  const DIFF_HE = { goal: 'מטרה', level: 'רמת ניסיון', days: 'ימים זמינים', spw: 'אימונים בשבוע', maxMin: 'זמן מקסימלי', prefMin: 'זמן מועדף', equipment: 'ציוד', exclude: 'תרגילים מוחרגים', noJump: 'בלי קפיצות', fav: 'תרגילים מועדפים' };
  function profileDiff(id) {
    const p = get(id); if (!p) return []; const cur = p.segments[p.segments.length - 1].params, np = paramsFromProfile(root.Store.load('profile'));
    const norm = v => Array.isArray(v) ? JSON.stringify(v.slice().sort()) : JSON.stringify(v == null ? null : v);
    return Object.keys(DIFF_HE).filter(k => norm(cur[k]) !== norm(np[k])).map(k => ({ key: k, he: DIFF_HE[k], from: cur[k], to: np[k] }));
  }
  function applyParams(id, newParams, label) {
    const p = get(id); const m = missing(newParams); if (m.length) throw new Error('חסר: ' + m.join(', '));
    const fromDay = firstOpenDay(p); p.segments.push({ fromDay, params: clone(newParams), at: new Date().toISOString() });
    addChange(p, 'params', (label || 'עדכון הגדרות') + ` מיום ${fromDay} והלאה`); save(); return fromDay;
  }
  /* performance log; snapshot freezes what was done */
  function logDay(id, n, data) {
    const p = get(id), d = dayOf(p, n); if (!d) throw new Error('יום לא קיים');
    const snap = { title: d.title, type: d.type, main: d.main || [], finisher: d.finisher || [], warm: d.warm || [], cool: d.cool || [], minutes: d.minutes || 0, version: d.version || 'std', phase: d.phase };
    p.log[n] = Object.assign({ status: 'done', date: today(), at: new Date().toISOString(), snapshot: snap }, data || {}); delete (p.overrides[n] || {}).skip; save();
  }
  /* Stage F helpers (used by the Adapt engine after the user approves; each reversible) */
  function adjust(id, n, ex, a) { const p = get(id), d = dayOf(p, n); assertFuture(p, d, 'לשנות');
    if (!(d.main || []).concat(d.finisher || []).some(it => it.ex === ex)) throw new Error('התרגיל לא נמצא ביום הזה');
    if (a && a.lvl && !['easy', 'normal', 'hard'].includes(a.lvl)) throw new Error('רמה לא תקינה'); if (a && a.sets && Math.abs(a.sets) > 2) throw new Error('שינוי סטים מוגבל ל־±2');
    p.overrides[n] = p.overrides[n] || {}; const adj = p.overrides[n].adj = p.overrides[n].adj || {}; if (a) adj[ex] = a; else delete adj[ex]; save(); }
  function unmove(id, n) { const p = get(id), d = dayOf(p, n); if (!d || d.log) throw new Error('אי אפשר לשנות יום שכבר נרשם'); if (p.overrides[n]) delete p.overrides[n].moveTo; save(); }
  function unreplace(id, at) { const p = get(id), k = (p.replace || []).findIndex(r => r.at === at); if (k < 0) return false; p.replace.splice(k, 1); save(); return true; }
  function update(id, fn) { const p = get(id); if (!p) throw new Error('תוכנית לא קיימת'); const r = fn(p); save(); return r; }
  function unlog(id, n) { const p = get(id); delete p.log[n]; save(); }
  function todayDay(p) { const t = today(); const ds = days(p); return ds.find(d => d.date === t && isTraining(d)) || ds.find(d => d.date === t) || null; }
  function stats(p) { const ds = days(p), tr = ds.filter(isTraining); return { total: ds.length, sessions: tr.length, done: tr.filter(d => d.status === 'done').length, partial: tr.filter(d => d.status === 'partial').length, skipped: tr.filter(d => d.status === 'skipped').length, missed: tr.filter(d => d.status === 'missed').length, end: ds[ds.length - 1].date, dayN: Math.max(0, Math.min(ds.length, (ds.find(d => d.date >= today()) || { n: ds.length + 1 }).n)) }; }
  /* runner definition for a plan day (session format of the existing workout runner) */
  function runDef(id, n) { const p = get(id), d = dayOf(p, n); if (!d) return null; return { title: d.title, type: d.type, warm: d.warm || [], main: (d.main || []).concat(d.finisher || []), cool: d.cool || [], plan: true }; }

  root.Plans = { SCHEMA, rank, convertItem, paramsFromProfile, missing, templateGaps, activatable, create, preview, activate, pause, resume, cancel, skip, unskip, move, setVersion, alternatives, swap, diffParams, applyParams, profileDiff, DIFF_HE, logDay, unlog, adjust, unmove, unreplace, update, days, dayOf, todayDay, stats, runDef, get, active, isTraining, list: () => Object.values(st().list) };
})(typeof window !== 'undefined' ? window : globalThis);
