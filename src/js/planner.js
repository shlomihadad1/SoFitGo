/* Planner (Stage A): turns a program template + profile into a day-by-day calendar.
   Pure and deterministic (same input → same output; no randomness), so a generated plan can be stored as
   {templateId, params, version} and regenerated, and the original plan, user-approved changes and the
   performance history stay separate (history lives in the existing Store 'workouts'; never touched here).
   Items use the existing session format {ex, sets, reps|sec, side, rest, lvl} so the existing runner can play them.
   Duration model = the one used for the 30-day program: 3.5 s per rep, 8 s transition per set, plus rests. */
(function (root) {
  'use strict';
  const VERSION = 1;
  const PR = () => root.PROGRAMS, CT = () => root.CATALOG;
  const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const dow = iso => new Date(iso + 'T12:00:00Z').getUTCDay();
  const diffDays = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000);
  const LEVELS = ['beginner', 'intermediate', 'advanced'];
  const LEVEL_HE = { beginner: 'מתחיל', intermediate: 'בינוני', advanced: 'מתקדם' };
  const TYPE_HE = { fb: 'כל הגוף', upper: 'פלג גוף עליון', lower: 'פלג גוף תחתון', cond: 'לב־ריאה (אינטרוולים)', mob: 'ניידות והתאוששות', active: 'התאוששות פעילה (רשות)', assess: 'מבחן כושר והערכה', rest: 'מנוחה' };
  const SLOTS = {
    fb: [['squat', 'lunge'], ['push_h', 'push_v', 'dip'], ['hinge', 'bridge'], ['pull_h', 'pull_scap'], ['core_anti_ext', 'core_anti_rot', 'core_lat']],
    upper: [['push_h'], ['pull_h', 'pull_scap'], ['push_v', 'dip', '|', 'push_h'], ['pull_scap', 'curl', 'back_ext'], ['core_anti_rot', 'core_lat', 'core_flex', 'core_rot']],
    lower: [['squat'], ['hinge', 'bridge'], ['lunge'], ['calf', 'bridge'], ['core_anti_ext', 'core_flex']],
    cond: [['cardio_low', 'cardio_high'], ['cardio_low', 'cardio_high'], ['cardio_low', 'cardio_high'], ['cardio_low', 'cardio_high'], ['core_anti_ext', 'core_anti_rot', 'core_flex', 'core_rot']],
    mob: [['mobility'], ['mobility'], ['mobility'], ['mobility'], ['mobility'], ['breathing']]
  };
  const WARM = [{ ex: 'march', sets: 1, sec: 60 }, { ex: 'arm_circles', sets: 1, sec: 30 }, { ex: 'cat_cow', sets: 1, sec: 30 }, { ex: 'hip_hinge', sets: 1, reps: 10, lvl: 'easy' }, { ex: 'squat', sets: 1, reps: 8, lvl: 'easy' }];
  const COOL = [{ ex: 'hip_flexor_stretch', sets: 1, sec: 30, side: true }, { ex: 'hamstring_stretch', sets: 1, sec: 30, side: true }, { ex: 'chest_stretch', sets: 1, sec: 30 }, { ex: 'childs_pose', sets: 1, sec: 45 }, { ex: 'breathing_90', sets: 1, reps: 5 }];

  function normProfile(p) {
    p = Object.assign({ level: 'beginner', goal: 'general', days: [0, 1, 2, 3, 4, 5, 6], maxMin: 30, prefMin: null, equipment: [], exclude: [], fav: [], noJump: false, spw: null }, p || {});
    p.days = [...new Set(p.days)].filter(d => d >= 0 && d <= 6).sort((a, b) => a - b); if (!p.days.length) p.days = [1, 3, 5];
    p.maxMin = Math.max(10, Math.min(120, +p.maxMin || 30)); if (!LEVELS.includes(p.level)) p.level = 'beginner';
    return p;
  }
  /* phases for a length in days; boundaries on whole weeks, last phase takes the remainder */
  function phasesFor(t, days) {
    let ph = t.phases;
    if (!ph || t.custom) ph = days < 14 ? [{ k: 'intro', w: 1 }] : days < 42 ? [{ k: 'intro', w: 1 }, { k: 'base', w: 2 }] : days < 120 ? [{ k: 'intro', w: 2 }, { k: 'base', w: 4 }, { k: 'volume', w: 4 }, { k: 'assess', w: 1 }] : PR().byId('annual').phases;
    const total = ph.reduce((s, p) => s + p.w, 0); const out = []; let start = 0, cum = 0;
    ph.forEach((p, i) => { cum += p.w; let end = i === ph.length - 1 ? days : Math.round(cum / total * days / 7) * 7; end = Math.min(days, Math.max(end, start + Math.min(7, days - start)));
      if (end > start) out.push({ idx: out.length, k: p.k, he: PR().PHASE_KINDS[p.k].he, focus: PR().PHASE_KINDS[p.k].focus, start, end, weeks: Math.ceil((end - start) / 7) }); start = end; });
    return out;
  }
  function weekTypes(n, goal, phaseK) {
    const fat = ['fat_loss', 'weight_loss', 'endurance'].includes(goal);
    const T = { 1: ['fb'], 2: ['fb', 'fb'], 3: fat ? ['fb', 'cond', 'fb'] : ['fb', 'fb', 'fb'],
      4: phaseK === 'intro' ? ['fb', 'fb', 'cond', 'fb'] : fat ? ['fb', 'cond', 'fb', 'cond'] : ['upper', 'lower', 'upper', 'lower'],
      5: ['upper', 'lower', 'cond', 'upper', 'lower'], 6: ['upper', 'lower', 'cond', 'upper', 'lower', 'mob'] };
    const out = T[Math.min(6, Math.max(1, n))].slice(); if (goal === 'mobility' && n >= 3) out[out.length - 1] = 'mob'; return out;
  }
  const spreadDays = (avail, n) => { const out = []; for (let k = 0; k < n; k++) out.push(avail[Math.floor(k * avail.length / n)]); return [...new Set(out)]; };
  function dose(meta, ctx) {
    const L = ctx.lvl, wk = Math.min(4, ctx.weekInPhase), vol = ctx.kind.vol, g = ctx.goal;
    let sets = Math.max(1, Math.round([2, 3, 3][L] * vol + ((g === 'muscle' || g === 'gain') && vol > 1 ? 1 : 0)));
    const rest = g === 'strength' ? 75 : ['fat_loss', 'weight_loss', 'endurance'].includes(g) ? 45 : 60;
    const it = { ex: meta.id, sets, rest, lvl: ctx.kind === PR().PHASE_KINDS.intro ? 'easy' : 'normal' };
    if (meta.type === 'isometric') it.sec = [20, 30, 40][L] + 5 * wk;
    else if (meta.type === 'mobility') { it.sec = 30; it.sets = 1; it.rest = 0; }
    else if (meta.type === 'breathing') { it.reps = 5; it.sets = 1; it.rest = 0; }
    else { let reps = [8, 10, 12][L] + wk + (g === 'endurance' ? 2 : 0) - (g === 'strength' && meta.d >= 2 ? 2 : 0); if (meta.uni) reps -= 2; it.reps = Math.max(5, reps); }
    if (meta.uni) it.side = true;
    if (ctx.deload) { it.sets = Math.max(1, it.sets - 1); if (it.reps && meta.type === 'strength') it.reps = Math.max(5, it.reps - 2); if (it.sec && meta.type === 'isometric') it.sec = Math.max(15, it.sec - 10); }
    return it;
  }
  const condDose = (meta, ctx) => ({ ex: meta.id, sets: 3 + (ctx.kind.vol > 1 ? 1 : 0) - (ctx.deload ? 1 : 0), sec: [30, 35, 40][ctx.lvl], rest: [30, 25, 20][ctx.lvl], circuit: true });
  const itemSec = it => { const per = it.reps === 'max' || it.sec === 'max' ? 60 : it.reps ? it.reps * 3.5 : (it.sec || 0); /* 'max' test efforts estimated at 60 s */ return it.sets * (per * (it.side ? 2 : 1) + 8) + (it.sets - 1) * (it.rest || 0); };
  const blockMin = items => items.reduce((s, it) => s + itemSec(it) + (it.rest || 0), 0) / 60;
  function sessionMinutes(s) { return Math.round((blockMin(s.warm) + blockMin(s.main) + blockMin(s.finisher || []) + blockMin(s.cool)) * 10) / 10; }

  function build(templateId, opts) {
    const t = PR().byId(templateId); if (!t) throw new Error('unknown template ' + templateId);
    if (t.classic) throw new Error('fit30_classic is the existing fixed program; it is not generated');
    opts = opts || {}; const prof = normProfile(opts.profile);
    const start = opts.start; if (!/^\d{4}-\d{2}-\d{2}$/.test(start || '')) throw new Error('start date YYYY-MM-DD required');
    let days = t.days; if (t.custom) { days = opts.end ? diffDays(start, opts.end) + 1 : opts.days; if (!(days >= 1 && days <= 365)) throw new Error('custom length must be 1–365 days'); }
    const have = t.equipLock ? t.equipLock.slice() : ['none', ...prof.equipment];
    const gaps = []; (t.needsLibrary || []).forEach(eq => gaps.push(`אין עדיין בספרייה תרגילים ל"${CT().EQUIPMENT[eq].he}" — האימונים נבנו מתרגילי בית בלבד.`));
    const lvl = LEVELS.indexOf(prof.level);
    const goal = opts.goal || prof.goal || t.goals[0];
    const pool = root.EXERCISES.filter(e => CT().usableWith(e, have) && !prof.exclude.includes(e.id)).map(e => CT().exFacts(e))
      .filter(m => !(prof.noJump && m.impact === 'high'));
    const phases = phasesFor(t, days);
    const spw = Math.min(prof.spw || t.spw, prof.days.length, 6);
    const trainDows = spreadDays(prof.days, spw);
    const out = []; const sig = new Map();
    let occurrence = 0;
    const shifts = (opts.shifts || []).filter(x => x && x.fromDay >= 1 && x.add > 0); /* pauses: days from fromDay move later by add */
    const shiftAt = n => shifts.reduce((a, x) => a + (x.fromDay <= n ? x.add : 0), 0);
    const cache = new Map(), usage = new Map(); /* exercise choice per (phase, session type, A/B variant), reused inside the phase */
    const typeCount = {};
    for (let i = 0; i < days; i++) {
      const date = addDays(start, i + shiftAt(i + 1)), ph = phases.find(p => i >= p.start && i < p.end), kind = PR().PHASE_KINDS[ph.k];
      const weekInPhase = Math.floor((i - ph.start) / 7), progWeek = Math.floor(i / 7);
      const deload = ph.weeks >= 4 && (weekInPhase + 1) % 4 === 0 && i < days - 7;
      const wd = dow(date), ti = trainDows.indexOf(wd);
      const day = { date, n: i + 1, week: progWeek + 1, phase: { idx: ph.idx, k: ph.k, he: ph.he }, weekInPhase: weekInPhase + 1, deload, type: 'rest', notes: [] }; /* the day's menu comes from MealPlan (Stage C), by date */
      if (ti >= 0) {
        const types = weekTypes(trainDows.length, goal, ph.k); let type = types[ti % types.length];
        const firstOfPhase = !out.some(d => d.phase.idx === ph.idx && d.type !== 'rest' && d.type !== 'active');
        if (days >= 28 && firstOfPhase && (ph.idx === 0 || ph.k === 'assess')) type = 'assess';
        if (days >= 28 && i >= days - 7 && !out.some((d, j) => j >= days - 7 && d.type === 'assess') && dow(date) === trainDows[trainDows.length - 1]) type = 'assess';
        const tk = ph.idx + '|' + type; typeCount[tk] = (typeCount[tk] || 0) + 1;
        day.type = type; Object.assign(day, session(type, { kind, lvl, cap: Math.min(3, 1 + lvl + kind.dcap), weekInPhase, deload, goal, rot: ph.idx * 5 + ti, pool, have, prof, phaseK: ph.k, cache, usage, key: tk + '|' + ((typeCount[tk] - 1) % 2) }));
        occurrence++;
      } else {
        const restCount = 7 - trainDows.length; const prevTrain = trainDows.includes((wd + 6) % 7);
        const activeThisWeek = out.some(d => d.week === progWeek + 1 && d.type === 'active'); /* at most one optional active-recovery day per week */
        if (!activeThisWeek && restCount >= 2 && prevTrain && ['fat_loss', 'weight_loss', 'general', 'endurance', 'habits', 'beginner', 'return'].includes(goal)) { day.type = 'active'; Object.assign(day, session('active', { kind, lvl, pool, have, prof })); }
      }
      day.title = TYPE_HE[day.type] + (day.deload ? ' · שבוע קל' : '');
      if (day.main) day.minutes = sessionMinutes(day);
      if (day.type === 'assess' && day.minutes > prof.maxMin) day.notes.push(`מבחן הכושר הסטנדרטי נמשך כ־${Math.round(day.minutes)} דק׳ — מעל ${prof.maxMin} דק׳ שבחרת. הוא לא מקוצר כדי שהתוצאות יהיו ברות השוואה; אפשר לבצע אותו ביום שיש בו יותר זמן.`);
      out.push(day);
    }
    /* RC1 — gradual load: a regular session's volume (Σ sets × reps, isometric seconds ÷ 3) may rise at most RAMP above the
       last regular session of the same type; extra sets are removed (largest first, never below 1) and come back over the
       following sessions. Deload weeks and fitness tests are not limited and do not count as the reference. The threshold is a
       conservative engineering choice, not a validated clinical rule — it is listed as an open professional decision. */
    const RAMP = 1.25, vol = d => d.main.reduce((s, x) => s + x.sets * (typeof x.reps === 'number' ? x.reps : typeof x.sec === 'number' ? x.sec / 3 : 1), 0), lastOf = {};
    for (const d of out) {
      if (!d.main || !d.main.length || ['rest', 'active', 'assess'].includes(d.type) || d.deload) continue;
      const ref = lastOf[d.type]; let cut = 0;
      if (ref) { const cap = ref * RAMP; let guard = 0; while (vol(d) > cap && guard++ < 30) { const big = d.main.filter(x => x.sets > 1 && !x.circuit).sort((a, b) => b.sets - a.sets)[0]; if (!big) break; big.sets--; cut++; } }
      if (cut) { d.minutes = sessionMinutes(d); d.ramped = cut; d.notes.push(`עלייה הדרגתית: ${cut} סטים פחות מהמתוכנן לשלב, כדי שהנפח לא יעלה ביותר מ־${Math.round((RAMP - 1) * 100)}% מהאימון הקודם מאותו סוג. הם יחזרו באימונים הבאים.`); }
      lastOf[d.type] = vol(d);
    }
    /* RC2-dev (TD-19): session signatures are counted after the ramp, so "distinct sessions" in the preview matches the
       sessions actually generated (before this, 26 of 126 standard plans showed a count from before sets were removed). */
    for (const d of out) if (d.main && d.type !== 'active') { const k = d.type + ':' + d.main.map(x => x.ex + (x.reps || x.sec) + 'x' + x.sets).join(','); sig.set(k, (sig.get(k) || 0) + 1); }
    const train = out.filter(d => !['rest', 'active'].includes(d.type));
    const summary = {
      template: t.id, version: VERSION, start, end: addDays(start, days - 1), days, goal, level: prof.level, sessionsPerWeek: trainDows.length, trainWeekdays: trainDows, maxMin: prof.maxMin,
      phases: phases.map(p => ({ k: p.k, he: p.he, focus: p.focus, startDay: p.start + 1, endDay: p.end, weeks: p.weeks })),
      sessions: train.length, assess: out.filter(d => d.type === 'assess').length, rest: out.filter(d => d.type === 'rest').length, active: out.filter(d => d.type === 'active').length,
      deloadWeeks: new Set(out.filter(d => d.deload).map(d => d.week)).size,
      avgMinutes: train.length ? Math.round(train.reduce((s, d) => s + d.minutes, 0) / train.length * 10) / 10 : 0, maxMinutes: train.length ? Math.max(...train.map(d => d.minutes)) : 0,
      distinctSessions: sig.size, mostRepeated: sig.size ? Math.max(...sig.values()) : 0, exercisesUsed: new Set(train.flatMap(d => d.main.map(x => x.ex))).size,
      trimmed: train.filter(d => d.notes.some(n => /קוצר/.test(n))).length, gaps
    };
    return { summary, days: out };
  }
  function pick(patterns, ctx, used, rot) {
    const cut = patterns.indexOf('|'); // patterns after '|' are a fallback used only when the preferred ones have no candidate
    if (cut >= 0) return pick(patterns.slice(0, cut), ctx, used, rot) || pick(patterns.slice(cut + 1), ctx, used, rot);
    const c = ctx.pool.filter(m => patterns.includes(m.pattern) && !used.has(m.id) && m.d <= (ctx.cap || 1) && !(ctx.phaseK === 'intro' && m.impact === 'high'))
      .sort((a, b) => b.d - a.d || (a.id < b.id ? -1 : 1));
    const band = c.filter(m => m.d >= (ctx.cap || 1) - 1); /* progress: stay in the top difficulty band the phase allows */
    const list = band.length ? band : c; if (!list.length) return null;
    if (!ctx.usage) return list[rot % list.length];
    const minU = Math.min(...list.map(m => ctx.usage.get(m.id) || 0)); /* fewer repeats when alternatives exist */
    const least = list.filter(m => (ctx.usage.get(m.id) || 0) === minU); const fav = least.filter(m => (ctx.prof.fav || []).includes(m.id)); /* favourites first among equals */
    return (fav.length ? fav : least)[rot % (fav.length || least.length)];
  }
  function session(type, ctx) {
    const notes = []; const usable = it => ctx.pool.some(m => m.id === it.ex);
    const warm = WARM.filter(usable), cool = COOL.filter(usable);
    if (type === 'active') { const walk = ctx.pool.find(m => m.id === 'brisk_walk'); return { warm: [], main: (walk ? [{ ex: 'brisk_walk', sets: 1, sec: Math.min(1200, Math.max(300, (ctx.prof.maxMin - 3) * 60)), rest: 0 }] : []).concat(['cat_cow', 'hip_flexor_stretch', 'childs_pose'].filter(id => ctx.pool.some(m => m.id === id)).map(id => ({ ex: id, sets: 1, sec: 30, rest: 0, side: !!CT().exMeta(id).uni }))), cool: [], finisher: [], notes: ['יום רשות: הליכה קלה וניידות. אפשר לדלג.'] }; }
    if (type === 'assess') { // the existing standardized test protocol (same conditions every time); tests the profile excludes are left out
      const tp = root.PROGRAM.TEST_PROTOCOL; const items = tp.items.filter(usable).map(x => Object.assign({}, x));
      if (items.length < tp.items.length) notes.push('חלק ממבחני הכושר הושמטו בגלל ההגדרות (למשל ללא קפיצות).');
      return { warm: tp.warm.filter(usable), main: items, cool: tp.cool.filter(usable), finisher: [], notes: notes.concat(['מבחן כושר סטנדרטי: אותם תנאים בכל מבחן. מבחן שלא בוצע נשאר ריק.']) }; }
    let ch = ctx.cache && ctx.cache.get(ctx.key);
    if (!ch) { /* first session of this kind in the phase: choose, preferring exercises used least so far in the program */
      const used = new Set(); ch = { main: SLOTS[type].map((pats, si) => { const m = pick(pats, ctx, used, ctx.rot + si * 3); if (m) used.add(m.id); return m ? m.id : { missing: pats }; }), fin: null };
      if (['fb', 'upper', 'lower'].includes(type) && ['fat_loss', 'weight_loss', 'endurance'].includes(ctx.goal)) { const f = pick(['cardio_low', 'cardio_high'], ctx, used, ctx.rot); ch.fin = f ? f.id : null; }
      if (ctx.cache) { ctx.cache.set(ctx.key, ch); ch.main.concat(ch.fin || []).forEach(id => { if (typeof id === 'string') ctx.usage.set(id, (ctx.usage.get(id) || 0) + 1); }); }
    }
    const main = [], meta = id => ctx.pool.find(m => m.id === id);
    ch.main.forEach(id => { if (typeof id !== 'string') { notes.push('אין תרגיל מתאים לדפוס ' + id.missing.filter(p => p !== '|').map(p => CT().PATTERN_HE[p]).join('/') + ' עם הציוד והרמה שנבחרו — המקום נשאר ריק.'); return; } const m = meta(id); main.push(type === 'cond' && (m.type === 'cardio' || m.type === 'plyometric') ? condDose(m, ctx) : dose(m, ctx)); });
    let finisher = ch.fin ? [Object.assign(condDose(meta(ch.fin), ctx), { sets: 2 })] : [];
    const s = { warm, main, finisher, cool, notes };
    // fit the user's time: drop finisher, then sets, then the last exercise — and say so
    const max = ctx.prof.maxMin; let guard = 0;
    while (sessionMinutes(s) > max && guard++ < 40) {
      if (s.finisher.length) { s.finisher = []; continue; }
      const big = s.main.filter(x => x.sets > 1).sort((a, b) => b.sets - a.sets)[0]; if (big) { big.sets--; continue; }
      if (s.cool.length > 2) { s.cool.pop(); continue; }
      if (s.main.length > 3) { s.main.pop(); continue; }
      break;
    }
    if (guard > 0) notes.push(`האימון קוצר כדי להתאים ל־${max} דק׳ (נפח נמוך מהתבנית).`);
    const pref = ctx.prof.prefMin;
    if (pref && guard === 0 && !ctx.deload && ctx.phaseK !== 'intro' && sessionMinutes(s) < pref - 2) { /* toward the preferred length: +1 set, max 4, never above the max */
      let added = 0; for (const it of s.main) { if (!(it.reps || typeof it.sec === 'number') || it.sets >= 4 || it.circuit) continue; it.sets++; if (sessionMinutes(s) > Math.min(pref + 2, max)) { it.sets--; break; } added++; if (sessionMinutes(s) >= pref - 2) break; }
      if (added) notes.push(`נוסף סט ל־${added} תרגילים כדי להתקרב לזמן המועדף (${pref} דק׳).`);
    }
    if (sessionMinutes(s) > max) notes.push(`גם אחרי קיצור האימון נמשך כ־${Math.round(sessionMinutes(s))} דק׳ — מעל ${max} דק׳.`);
    return s;
  }
  /* short / standard / long variant of a planned session (standard = as planned). Tests and recovery days have no variants. */
  const VERSION_HE = { short: 'קצרה', std: 'רגילה', long: 'ארוכה' };
  function versioned(day, v) {
    if (!day.main || !v || v === 'std' || ['assess', 'active', 'rest'].includes(day.type)) return day;
    const d = JSON.parse(JSON.stringify(day)); const work = it => it.reps || typeof it.sec === 'number';
    if (v === 'short') { d.warm = d.warm.slice(0, 3); d.main.forEach(it => { if (work(it) && it.sets > 1) it.sets--; }); d.finisher = []; d.cool = d.cool.slice(0, 2); }
    if (v === 'long') { d.main.forEach(it => { if (work(it) && it.sets < 4 && it.rest) it.sets++; }); }
    d.minutes = sessionMinutes(d); d.version = v; d.notes = (d.notes || []).concat(['גרסה ' + VERSION_HE[v] + ' של האימון המתוכנן.']); return d;
  }
  /* RC4: the build-time gradual-load cap and volume measure, shared so changes made AFTER the build (Adapt "+1 set") are held to
     the same rule. The value is the existing RC1 engineering default (+25 %), not a validated professional rule (DR-01). */
  const LOAD_CAP = 1.25, sessionVolume = d => (d.main || []).reduce((s, x) => s + (x.sets || 1) * (typeof x.reps === 'number' ? x.reps : typeof x.sec === 'number' ? x.sec / 3 : 1), 0);
  root.Planner = { VERSION, VERSION_HE, versioned, build, phasesFor, normProfile, sessionMinutes, itemSec, TYPE_HE, LEVEL_HE, LOAD_CAP, sessionVolume };
})(typeof window !== 'undefined' ? window : globalThis);
