/* Stage F — Adaptive Fitness Engine (rule-based, not AI).
   Reads ONLY what the user actually logged in the active plan (sets/reps/seconds vs. target, session effort 1–10,
   duration, per-exercise feedback, skipped/missed sessions, today's reported energy, exercise swaps) plus the profile's
   time limit. Produces PROPOSALS. Nothing changes until the user approves one; every approved change is recorded in
   plan.adapt.items with the previous state, so it can be undone. Logged sessions are never modified.

   Rules (each proposal carries its rule id, the numbers it was based on, and the exact days/exercises it changes):
     R-DATA     fewer than 2 logged sessions → no performance-based proposals ("not enough data").
     R-UP       an exercise met its full target (all sets, ≥ target reps/seconds) in its last 2 logged sessions, with
                session effort ≤ 7/10 — or was marked "too easy" twice → next ≤2 sessions with it: one level up
                (easy→normal→hard); already "hard" → +1 set (max 5). At most one step per exercise per 14 days, never
                while the last session was rated ≥ 9 or today's energy is low. Completion alone never raises load.
     R-DOWN     in its last logged session the exercise had an unfinished set or < 70 % of target reps, or was marked
                "hard"/"failed" → next ≤2 sessions with it: one level down; already "easy" → −1 set (min 1).
                Sets after the last completed set of a session (session ended early) are not evidence, and an
                exercise with no completed set is ignored — "not reached" is never treated as "failed".
     R-RECOVER  last session rated ≥ 9/10 and the next session is within 2 days, or energy ≤ 2/5 reported today on a
                training day → next session in the short version.
     R-TIME     the last 3 timed sessions ran > 25 % over their planned minutes, or the next session is longer than the
                user's maximum time → next 2 sessions in the short version.
     R-MISSED   a training session in the last 7 days was missed and nothing was logged after it → move that ONE
                session to the next free day (≤ 7 days ahead). The rest of the plan does not move.
     R-COMEBACK ≥ 10 days without any logged session (plan running ≥ 10 days) → next 2 sessions short + one level easier.
     R-PREF     the same exercise was swapped out on ≥ 2 different days → replace it from the next open day with the
                replacement chosen most often (permanent swap, reversible). */
(function (root) {
  'use strict';
  const S = () => root.Store, PS = () => root.Plans, C = () => root.Core, PL = () => root.Planner;
  /* RC4 — load guard for changes after the build (TD-20). A "+N sets" change on day n is allowed only if that session's volume,
     WITH the change and with every adjustment already applied, stays within Planner.LOAD_CAP of the previous regular session of
     the same type (same reference as the build-time ramp: deload weeks, tests, rest and active days are skipped). Reductions and
     level changes are never blocked. Default ON with the existing +25 % cap (conservative: it only ever prevents increases). */
  const LOAD_GUARD = true;
  const regDay = d => d && d.main && d.main.length && !['rest', 'active', 'assess'].includes(d.type) && !d.deload;
  function loadCheck(ds, n, ex, addSets) {
    const P = PL(); if (!LOAD_GUARD || !P || !P.LOAD_CAP || addSets <= 0) return { ok: true };
    const i = ds.findIndex(x => x.n === n), d = ds[i]; if (!regDay(d)) return { ok: true };
    let prev = null; for (let j = i - 1; j >= 0; j--) if (regDay(ds[j]) && ds[j].type === d.type) { prev = ds[j]; break; } if (!prev) return { ok: true };
    const it = (d.main || []).find(x => x.ex === ex); if (!it) return { ok: true };
    const per = typeof it.reps === 'number' ? it.reps : typeof it.sec === 'number' ? it.sec / 3 : 1, after = P.sessionVolume(d) + addSets * per, base = P.sessionVolume(prev), ratio = base ? after / base : 1;
    return { ok: ratio <= P.LOAD_CAP + 1e-9, ratio: Math.round(ratio * 100) / 100, prevN: prev.n, cap: P.LOAD_CAP };
  }
  const LV = ['easy', 'normal', 'hard'], LV_HE = { easy: 'מתחיל', normal: 'בינוני', hard: 'מתקדם' };
  const RULE_HE = { up: 'התקדמות', down: 'הקלה', recover: 'התאוששות', time: 'זמן', missed: 'אימון שהוחמץ', comeback: 'חזרה לשגרה', pref: 'העדפת תרגיל' };
  const exHe = id => (root.EX_BY_ID[id] || { he: id }).he;
  const MIN_SESSIONS = 2;

  function store(p) { p.adapt = p.adapt || { items: [], dismissed: {} }; p.adapt.items = p.adapt.items || []; p.adapt.dismissed = p.adapt.dismissed || {}; return p.adapt; }

  /* per exercise: one record per logged session that contained it, oldest → newest */
  function exerciseLogs(plan, ds) {
    const out = {};
    ds.filter(d => d.log && d.log.sets && d.log.snapshot).sort((a, b) => (a.log.date || a.date) < (b.log.date || b.date) ? -1 : 1).forEach(d => {
      const lg = d.log, items = (lg.snapshot.main || []).concat(lg.snapshot.finisher || []);
      const byEx = {}; items.forEach(it => { if (it.circuit) return; byEx[it.ex] = byEx[it.ex] || it; });
      /* sets after the last completed set were never reached (session ended early) → not evidence of anything */
      const lastDone = Math.max(-1, ...lg.sets.map((s, i) => s.done ? (s.key != null ? s.key : i) : -1));
      const reached = lg.sets.filter((s, i) => (s.key != null ? s.key : i) <= lastDone);
      Object.entries(byEx).forEach(([ex, it]) => {
        const sets = reached.filter(s => s.ex === ex && s.sec === 'main'); if (!sets.length || !sets.some(s => s.done)) return; /* not performed → no evidence */
        const tgt = typeof it.reps === 'number' ? { u: 'reps', v: it.reps } : typeof it.sec === 'number' ? { u: 'sec', v: it.sec } : null;
        const val = s => tgt && tgt.u === 'reps' ? s.reps : s.secs;
        const done = sets.filter(s => s.done), full = done.length === sets.length;
        const met = !!tgt && full && done.every(s => val(s) != null && val(s) >= tgt.v);
        const low = !!tgt && (done.length < sets.length || done.some(s => val(s) != null && val(s) < tgt.v * 0.7));
        (out[ex] = out[ex] || []).push({ n: d.n, date: lg.date || d.date, rpe: lg.rpe || null, fb: (lg.feedback || {})[ex] || null, sets: sets.length, done: done.length, met, low, tgt, best: Math.max(0, ...done.map(val).filter(v => v != null)), lvl: it.adjLvl || it.lvl || 'normal' });
      });
    });
    return out;
  }
  const upcoming = (ds, today, pred) => ds.filter(d => PS().isTraining(d) && !d.log && d.status !== 'skipped' && (d.movedTo || d.date) >= today && (!pred || pred(d))).sort((a, b) => (a.movedTo || a.date) < (b.movedTo || b.date) ? -1 : 1);
  const itemOf = (d, ex) => (d.main || []).concat(d.finisher || []).find(it => it.ex === ex);

  function proposals(plan) {
    plan = plan || PS().active(); if (!plan || plan.status !== 'active') return { list: [], info: null, logged: 0, held: [] };
    const held = []; /* RC4: '+set' steps not proposed because of the load guard, with the reason */
    const ad = store(JSON.parse(JSON.stringify(plan))), ds = PS().days(plan), today = S().today(), out = [];
    const logged = ds.filter(d => d.log && PS().isTraining(d)).sort((a, b) => (a.log.date || a.date) < (b.log.date || b.date) ? -1 : 1), last = logged[logged.length - 1] || null;
    const energy = (C().daily(today) || {}).energy || null, next = upcoming(ds, today)[0] || null;
    const recentApplied = (rule, key) => ad.items.some(it => it.status === 'applied' && it.rule === rule && it.target === key && S().diffDays(it.appliedOn, today) < 14);
    const pending = key => ad.items.some(it => it.key === key && it.status === 'applied') || ad.dismissed[key];
    const add = pr => { if (!pending(pr.key)) out.push(pr); };

    // R-MISSED (independent of performance data)
    const missed = ds.filter(d => d.status === 'missed' && PS().isTraining(d) && S().diffDays(d.date, today) <= 7).sort((a, b) => a.date < b.date ? 1 : -1)[0];
    if (missed && !logged.some(l => (l.log.date || l.date) > missed.date)) {
      const busy = new Set(ds.filter(d => PS().isTraining(d) && d.status !== 'skipped').map(d => d.movedTo || d.date)); let to = null;
      for (let i = 0; i <= 7 && !to; i++) { const dt = S().addDays(today, i); if (!busy.has(dt) && dt <= S().addDays(ds[ds.length - 1].date, 7)) to = dt; }
      if (to) add({ key: `missed:${missed.n}`, rule: 'missed', target: String(missed.n), material: true, title: `להעביר את "${missed.title}" שהוחמץ ל־${S().fmtDate(to, true)}?`,
        why: `האימון של ${S().fmtDate(missed.date)} לא נרשם, ואין אימון רשום מאז. במקום להזיז את כל התוכנית — רק האימון הזה עובר ליום הפנוי הקרוב. שאר הימים נשארים במקומם.`,
        evidence: [`תאריך מקורי: ${missed.date}`, `יום פנוי ראשון: ${to}`], changes: [{ kind: 'move', n: missed.n, from: missed.date, to }] });
    }
    // R-COMEBACK
    const started = S().diffDays(plan.start, today) >= 10, lastDate = last ? (last.log.date || last.date) : null, gap = lastDate ? S().diffDays(lastDate, today) : S().diffDays(plan.start, today);
    if (started && gap >= 10) {
      const nx = upcoming(ds, today, d => d.type !== 'assess').slice(0, 2);
      if (nx.length) add({ key: `comeback:${nx[0].n}`, rule: 'comeback', target: String(nx[0].n), material: true, title: 'חזרה הדרגתית: שני האימונים הבאים בגרסה קצרה וברמה קלה יותר',
        why: `${lastDate ? `האימון האחרון נרשם לפני ${gap} ימים` : `לא נרשם אף אימון מאז תחילת התוכנית (${gap} ימים)`}. אחרי הפסקה לא מניחים שממשיכים מאותה נקודה: מתחילים קצר וקל, ובודקים איך הגוף מגיב.`,
        evidence: [`ימים בלי אימון רשום: ${gap}`], changes: nx.flatMap(d => [{ kind: 'version', n: d.n, from: d.version || 'std', to: 'short' }].concat((d.main || []).filter(it => !it.circuit).map(it => ({ kind: 'lvl', n: d.n, ex: it.ex, from: it.adjLvl || it.lvl || 'normal', to: LV[Math.max(0, LV.indexOf(it.adjLvl || it.lvl || 'normal') - 1)] })).filter(c => c.from !== c.to))) });
    }
    // R-TIME (availability limit or repeated overruns)
    const maxMin = (C().profile().availability || {}).maxMin || null;
    const timed = logged.filter(d => d.log.durationSec && d.log.snapshot && d.log.snapshot.minutes && (d.log.version || 'std') !== 'short').slice(-3);
    const over = timed.length === 3 && timed.every(d => d.log.durationSec / 60 > d.log.snapshot.minutes * 1.25);
    const nx2 = upcoming(ds, today, d => (d.version || 'std') !== 'short' && d.type !== 'assess' && d.type !== 'active').slice(0, 2);
    if (nx2.length && (over || (maxMin && nx2[0].minutes > maxMin + 2))) add({ key: `time:${nx2[0].n}`, rule: 'time', target: String(nx2[0].n), material: false, title: 'גרסה קצרה לשני האימונים הבאים',
      why: over ? `שלושת האימונים האחרונים נמשכו בפועל ${timed.map(d => Math.round(d.log.durationSec / 60)).join(', ')} דק׳ — יותר מ־25% מעל הזמן המתוכנן (${timed.map(d => Math.round(d.log.snapshot.minutes)).join(', ')} דק׳).` : `האימון הבא מתוכנן לכ־${Math.round(nx2[0].minutes)} דק׳, יותר מהזמן המקסימלי שהגדרת (${maxMin} דק׳).`,
      evidence: [], changes: nx2.map(d => ({ kind: 'version', n: d.n, from: d.version || 'std', to: 'short' })) });
    // R-RECOVER
    if (next && next.type !== 'assess' && next.type !== 'active' && (next.version || 'std') !== 'short') {
      const hardLast = last && last.log.rpe >= 9 && S().diffDays(last.log.date || last.date, next.movedTo || next.date) <= 2;
      const lowToday = energy && energy <= 2 && (next.movedTo || next.date) === today;
      if (hardLast || lowToday) add({ key: `recover:${next.n}`, rule: 'recover', target: String(next.n), material: false, title: `גרסה קצרה ל"${next.title}"`,
        why: lowToday ? `דיווחת היום על אנרגיה ${energy}/5. אפשר לבצע את האימון בגרסה הקצרה במקום לוותר עליו.` : `האימון הקודם דורג ${last.log.rpe}/10, והבא בעוד ${S().diffDays(last.log.date || last.date, next.movedTo || next.date)} ימים — גרסה קצרה נותנת יותר התאוששות.`,
        evidence: [], changes: [{ kind: 'version', n: next.n, from: next.version || 'std', to: 'short' }] });
    }
    // performance rules need data
    const info = logged.length < MIN_SESSIONS ? { kind: 'insufficient', logged: logged.length, need: MIN_SESSIONS,
      text: `אין עדיין מספיק נתונים להתאמת עומס: נרשמו ${logged.length} אימונים בתוכנית (צריך לפחות ${MIN_SESSIONS} עם רישום סטים). ההצעות יופיעו אחרי אימונים שנרשמים דרך "התחלת אימון".` } : null;
    if (!info) {
      const xl = exerciseLogs(plan, ds), lastRpe = last && last.log.rpe, blockUp = (lastRpe && lastRpe >= 9) || (energy && energy <= 2);
      let ups = 0;
      Object.entries(xl).forEach(([ex, l]) => {
        const a = l[l.length - 1], b = l[l.length - 2]; const fut = upcoming(ds, today, d => !!itemOf(d, ex) && d.type !== 'assess').slice(0, 2); if (!fut.length) return;
        // R-DOWN first (safety wins)
        if (a.low || ['hard', 'fail'].includes(a.fb)) {
          const ch = fut.map(d => { const it = itemOf(d, ex), cur = it.adjLvl || it.lvl || 'normal'; return cur !== 'easy' ? { kind: 'lvl', n: d.n, ex, from: cur, to: LV[LV.indexOf(cur) - 1] } : it.sets > 1 ? { kind: 'sets', n: d.n, ex, from: it.sets, to: it.sets - 1 } : null; }).filter(Boolean);
          if (ch.length) add({ key: `down:${ex}:${a.n}`, rule: 'down', target: ex, material: false, title: `הקלה ב"${exHe(ex)}" ב־${ch.length} האימונים הבאים`,
            why: a.fb === 'fail' || a.fb === 'hard' ? `באימון האחרון סימנת את "${exHe(ex)}" כ"${a.fb === 'fail' ? 'לא הצלחתי' : 'קשה'}".` : `באימון האחרון הושלמו ${a.done}/${a.sets} סטים${a.tgt ? ` והתוצאה הטובה הייתה ${a.best} מתוך יעד ${a.tgt.v} ${a.tgt.u === 'reps' ? 'חזרות' : 'שנ׳'}` : ''}.`,
            evidence: [`אימון ${a.n} (${a.date})`], changes: ch });
          return;
        }
        if (blockUp || ups >= 3 || !b || recentApplied('up', ex)) return;
        const metBoth = a.met && b.met && a.rpe && b.rpe && a.rpe <= 7 && b.rpe <= 7, easyBoth = a.fb === 'easy' && b.fb === 'easy';
        if (!metBoth && !easyBoth) return;
        const ch = fut.map(d => { const it = itemOf(d, ex), cur = it.adjLvl || it.lvl || 'normal'; if (cur !== 'hard') return { kind: 'lvl', n: d.n, ex, from: cur, to: LV[LV.indexOf(cur) + 1] };
          if (!(it.sets < 5 && !it.circuit)) return null; const lc = loadCheck(ds, d.n, ex, 1);
          if (!lc.ok) { held.push({ ex, n: d.n, ratio: lc.ratio, prevN: lc.prevN, text: `לא הוצע סט נוסף ב"${exHe(ex)}" באימון ${d.n}: הנפח היה עולה פי ${lc.ratio} לעומת האימון הקודם מאותו סוג (${lc.prevN}), מעל הגבול של עלייה הדרגתית (+${Math.round((lc.cap - 1) * 100)}%).` }); return null; }
          return { kind: 'sets', n: d.n, ex, from: it.sets, to: it.sets + 1 }; }).filter(Boolean);
        if (!ch.length) return; ups++;
        add({ key: `up:${ex}:${a.n}`, rule: 'up', target: ex, material: false, title: `התקדמות ב"${exHe(ex)}" ב־${ch.length} האימונים הבאים`,
          why: metBoth ? `בשני האימונים האחרונים עם "${exHe(ex)}" הושלמו כל הסטים ביעד המלא (${b.best} ו־${a.best} מול יעד ${a.tgt.v} ${a.tgt.u === 'reps' ? 'חזרות' : 'שנ׳'}), והמאמץ דורג ${b.rpe} ו־${a.rpe} מתוך 10. העלייה היא צעד אחד בלבד, רק לאימונים הקרובים.` : `סימנת את "${exHe(ex)}" "קל מדי" בשני אימונים רצופים. העלייה היא צעד אחד בלבד, רק לאימונים הקרובים.`,
          evidence: [`אימונים ${b.n} ו־${a.n}`], changes: ch });
      });
    }
    // R-PREF: repeated swaps of the same exercise
    const raw = PS().days(Object.assign({}, plan, { overrides: {}, replace: [] })), byN = new Map(raw.map(d => [d.n, d])), outs = {};
    Object.entries(plan.overrides || {}).forEach(([n, ov]) => Object.entries(ov.swaps || {}).forEach(([i, to]) => { const d0 = byN.get(+n); const from = d0 && d0.main && d0.main[i] && d0.main[i].ex; if (from) (outs[from] = outs[from] || []).push({ n: +n, to }); }));
    Object.entries(outs).forEach(([from, l]) => { if (new Set(l.map(x => x.n)).size < 2 || (plan.replace || []).some(r => r.from === from)) return;
      const cnt = {}; l.forEach(x => { cnt[x.to] = (cnt[x.to] || 0) + 1; }); const to = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0][0];
      const fut = upcoming(ds, today, d => (d.main || []).some(it => it.ex === from)); if (!fut.length) return; /* main block only: a permanent swap replaces main-block items */
      if (!PS().alternatives(plan, fut[0].n, fut[0].main.findIndex(it => it.ex === from)).list.some(a => a.id === to)) return; /* the chosen replacement must be a valid alternative on that day */
      add({ key: `pref:${from}`, rule: 'pref', target: from, material: true, title: `להחליף את "${exHe(from)}" ב"${exHe(to)}" מעכשיו והלאה?`,
        why: `החלפת את "${exHe(from)}" ב־${l.length} ימים שונים (${l.map(x => 'יום ' + x.n).join(', ')}). אפשר להחליף אותו קבוע ב"${exHe(to)}" — החלופה שבחרת הכי הרבה. ${fut.length} אימונים עתידיים יושפעו; אימונים שכבר נרשמו לא משתנים.`,
        evidence: [], changes: [{ kind: 'replace', n: fut[0].n, from, to, count: fut.length }] });
    });
    return { list: out, info, logged: logged.length, held };
  }

  /* apply / revert / dismiss — every apply stores what it replaced */
  function apply(key) {
    const plan = PS().active(); if (!plan) throw new Error('אין תוכנית פעילה');
    const pr = proposals(plan).list.find(x => x.key === key); if (!pr) throw new Error('ההצעה כבר לא בתוקף (הנתונים השתנו)');
    /* validate every change first — apply is all-or-nothing */
    const p0 = PS().get(plan.id);
    for (const c of pr.changes) { const d = PS().dayOf(p0, c.n); if (!d || d.log) throw new Error('ההצעה כבר לא בתוקף (היום כבר נרשם)');
      if (c.kind !== 'move' && (d.movedTo || d.date) < S().today()) throw new Error('ההצעה כבר לא בתוקף (היום עבר)');
      if ((c.kind === 'lvl' || c.kind === 'sets') && !itemOf(d, c.ex)) throw new Error('ההצעה כבר לא בתוקף (התרגיל לא נמצא ביום)');
      if (c.kind === 'sets' && c.to > c.from) { const lc = loadCheck(PS().days(p0), c.n, c.ex, c.to - c.from); if (!lc.ok) throw new Error(`ההצעה כבר לא בתוקף: הנפח באימון ${c.n} היה עולה פי ${lc.ratio} לעומת האימון הקודם מאותו סוג — מעל הגבול של עלייה הדרגתית`); }
      if (c.kind === 'replace' && (!(d.main || []).some(it => it.ex === c.from) || !PS().alternatives(p0, c.n, d.main.findIndex(it => it.ex === c.from)).list.some(a => a.id === c.to))) throw new Error('ההצעה כבר לא בתוקף (ההחלפה לא מתאימה ליום)'); }
    const rec = { id: 'a' + Date.now().toString(36), key, rule: pr.rule, target: pr.target, title: pr.title, why: pr.why, appliedOn: S().today(), at: new Date().toISOString(), status: 'applied', changes: [] };
    for (const c of pr.changes) {
      const p = PS().get(plan.id), ov = (p.overrides || {})[c.n] || {};
      if (c.kind === 'lvl' || c.kind === 'sets') { const prev = ov.adj && ov.adj[c.ex] ? JSON.parse(JSON.stringify(ov.adj[c.ex])) : null; const a = Object.assign({}, prev || {}, { rule: pr.rule });
        if (c.kind === 'lvl') a.lvl = c.to; else a.sets = (a.sets || 0) + (c.to - c.from); PS().adjust(plan.id, c.n, c.ex, a); rec.changes.push(Object.assign({ prev }, c)); }
      else if (c.kind === 'version') { const prev = ov.version || 'std'; PS().setVersion(plan.id, c.n, c.to); rec.changes.push(Object.assign({ prev }, c)); }
      else if (c.kind === 'move') { PS().move(plan.id, c.n, c.to); rec.changes.push(Object.assign({}, c)); }
      else if (c.kind === 'replace') { const ix = PS().dayOf(PS().get(plan.id), c.n).main.findIndex(it => it.ex === c.from); if (ix < 0) throw new Error('ההצעה כבר לא בתוקף (התרגיל לא נמצא ביום)'); PS().swap(plan.id, c.n, ix, c.to, 'future'); const r = PS().get(plan.id).replace; rec.changes.push(Object.assign({ at: r[r.length - 1].at }, c)); }
    }
    PS().update(plan.id, p => { store(p).items.push(rec); (p.changes = p.changes || []).push({ at: rec.at, date: rec.appliedOn, type: 'adapt', text: 'התאמה אושרה: ' + pr.title }); });
    return rec;
  }
  function revert(id) {
    const plan = PS().active(); const rec = plan && store(plan).items.find(x => x.id === id); if (!rec || rec.status !== 'applied') throw new Error('אין התאמה פעילה לביטול');
    const kept = [];
    for (const c of rec.changes.slice().reverse()) {
      const d = PS().dayOf(PS().get(plan.id), c.n);
      if (c.kind !== 'replace' && (!d || d.log || (d.movedTo || d.date) < S().today())) { kept.push(c.n); continue; } // history is never rewritten
      if (c.kind === 'lvl' || c.kind === 'sets') PS().adjust(plan.id, c.n, c.ex, c.prev);
      else if (c.kind === 'version') PS().setVersion(plan.id, c.n, c.prev);
      else if (c.kind === 'move') PS().unmove(plan.id, c.n);
      else if (c.kind === 'replace') PS().unreplace(plan.id, c.at);
    }
    PS().update(plan.id, p => { const r = store(p).items.find(x => x.id === id); r.status = 'reverted'; r.revertedOn = S().today(); r.keptDays = [...new Set(kept)]; (p.changes = p.changes || []).push({ at: new Date().toISOString(), date: S().today(), type: 'adapt-revert', text: 'התאמה בוטלה: ' + rec.title + (kept.length ? ` (ימים שכבר נרשמו או עברו נשארו: ${[...new Set(kept)].join(', ')})` : '') }); });
    return { kept: [...new Set(kept)] };
  }
  function dismiss(key) { const plan = PS().active(); if (!plan) return; PS().update(plan.id, p => { store(p).dismissed[key] = S().today(); }); }
  function history(plan) { plan = plan || PS().active(); return plan ? store(JSON.parse(JSON.stringify(plan))).items.slice().reverse() : []; }
  /* human-readable change line */
  function changeText(c, plan) {
    const d = plan ? PS().dayOf(plan, c.n) : null, day = d ? `יום ${c.n} (${S().fmtShort(d.movedTo || d.date)})` : `יום ${c.n}`;
    if (c.kind === 'lvl') return `${day}: ${exHe(c.ex)} — רמה ${LV_HE[c.from]} ← ${LV_HE[c.to]}`;
    if (c.kind === 'sets') return `${day}: ${exHe(c.ex)} — ${c.from} ← ${c.to} סטים`;
    if (c.kind === 'version') return `${day}: גרסה ${PL().VERSION_HE[c.from] || c.from} ← ${PL().VERSION_HE[c.to] || c.to}`;
    if (c.kind === 'move') return `יום ${c.n}: ${S().fmtDate(c.from)} ← ${S().fmtDate(c.to)}`;
    if (c.kind === 'replace') return `${exHe(c.from)} ← ${exHe(c.to)} מיום ${c.n} והלאה (${c.count} אימונים)`;
    return '';
  }
  root.Adapt = { loadCheck, LOAD_GUARD, proposals, apply, revert, dismiss, history, changeText, exerciseLogs, RULE_HE, MIN_SESSIONS };
})(typeof window !== 'undefined' ? window : globalThis);
