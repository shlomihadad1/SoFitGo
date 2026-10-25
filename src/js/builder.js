/* Workout Builder — the user builds a single workout (or asks for a suggestion), edits it, saves it, and starts it in the existing
   runner. It reuses the existing training model; nothing here is a second engine:
     - exercise facts from CATALOG (pattern, muscles, equipment, difficulty, impact) — nothing is invented when a fact is missing;
     - doses (sets / reps / seconds / rest) from Planner.dose / condDose, warm-up and cool-down from Planner.WARM / COOL;
     - duration from Logic.durationBreakdown (built from the runner's own steps: work, rests, transitions);
     - substitution from Plans.rank (shared with personal plans);
     - the Plan Integrity Gate re-checks a workout before it starts.
   Storage: Store 'workouts' → custom { id: workout } (saved workouts) and customLog [ runs with a frozen snapshot ]. Editing or
   deleting a saved workout never rewrites a run that was already logged. All of it is part of the existing backup and sync. */
(function (root) {
'use strict';
const S = () => root.Store, CT = () => root.CATALOG, PL = () => root.Planner, L = () => root.Logic, PR = () => root.PROGRAMS;
const GOALS = { fat_loss: 'ירידה בשומן', strength: 'כוח', muscle: 'היפרטרופיה (מסת שריר)', general: 'כושר כללי', endurance: 'סיבולת', mobility: 'ניידות' };
const LEVELS = { beginner: 'מתחיל/ה', intermediate: 'בינוני/ת', advanced: 'מתקדם/ת' };
const FOCUS = { legs: 'רגליים וישבן', push: 'חזה, כתפיים ויד אחורית (דחיפה)', pull: 'גב ויד קדמית (משיכה)', core: 'בטן וליבה', cardio: 'לב־ריאה', mobility: 'ניידות' };
const FOCUS_PATTERNS = { legs: ['squat', 'lunge', 'hinge', 'bridge'], push: ['push_h', 'push_v', 'dip'], pull: ['pull_h', 'pull_scap', 'back_ext', 'curl'], core: ['core_anti_ext', 'core_anti_rot', 'core_lat', 'core_flex', 'core_rot'], cardio: ['cardio_low', 'cardio_high'], mobility: ['mobility'] };
const MINUTES = [15, 30, 60], MIN_MIN = 10, MAX_MIN = 90;
const LIMITS = { sets: [1, 8], reps: [1, 50], sec: [5, 600], rest: [0, 300] };
const clone = o => JSON.parse(JSON.stringify(o));
const uid = () => 'cw' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/* parameters: from what the user chose; unknown values stay unknown (the profile fills only what it actually holds) */
function normParams(p) {
  p = Object.assign({ goal: 'general', minutes: 30, level: null, equipment: [], focus: [], fav: [], exclude: [], noJump: false, perWeek: null, variant: 0 }, p || {});
  if (!GOALS[p.goal]) p.goal = 'general';
  p.minutes = Math.max(MIN_MIN, Math.min(MAX_MIN, Math.round(+p.minutes || 30)));
  if (!LEVELS[p.level]) p.level = null;
  p.equipment = (p.equipment || []).filter(e => CT().EQUIPMENT[e] && e !== 'none');
  p.focus = (p.focus || []).filter(f => FOCUS[f]).slice(0, 3);
  ['fav', 'exclude'].forEach(k => { p[k] = (p[k] || []).filter(id => root.EX_BY_ID[id]); });
  p.noJump = !!p.noJump; p.variant = Math.max(0, +p.variant || 0);
  return p;
}
function fromProfile() {
  const pr = S().load('profile'), a = pr.availability || {}, env = pr.environment || {}, xp = pr.exercisePrefs || {}, aim = (pr.aims || {}).primary;
  const goal = { fat_loss: 'fat_loss', weight_loss: 'fat_loss', muscle: 'muscle', gain: 'muscle', strength: 'strength', endurance: 'endurance', mobility: 'mobility' }[aim] || 'general';
  const m = a.prefMin || a.maxMin; return normParams({ goal, minutes: m ? +m : 30, level: pr.experience || null, equipment: env.equipment || [], fav: xp.fav || [], exclude: xp.exclude || [], noJump: !!xp.noJump, perWeek: a.sessions || null });
}
const lvlIdx = p => ({ beginner: 0, intermediate: 1, advanced: 2 })[p.level] ?? 0;
const capD = p => [1, 2, 3][lvlIdx(p)]; /* beginner: difficulty ≤1 … advanced ≤3; unknown level → beginner limits */
function pool(p) {
  const have = ['none', ...p.equipment];
  return root.EXERCISES.filter(e => CT().usableWith(e, have) && !p.exclude.includes(e.id)).map(e => CT().exFacts(e)).filter(m => !(p.noJump && m.impact === 'high'));
}
/* the slot plan: which movement patterns, in which order, for the goal + focus + time */
function slotsFor(p) {
  if (p.goal === 'mobility') { const n = pool(p).filter(m => m.type === 'mobility').length; return Array.from({ length: Math.max(1, n) }, () => ['mobility']).concat([['breathing']]); } /* every available mobility move; warm-up / cool-down take what is left */
  const base = PL().SLOTS.fb.map(x => x.slice()), count = p.minutes <= 15 ? 4 : p.minutes <= 30 ? 5 : 7;
  let slots = base.slice();
  if (p.focus.length) { const extra = p.focus.flatMap(f => [FOCUS_PATTERNS[f]]); slots = extra.concat(base.filter(s => !p.focus.some(f => s.some(pt => FOCUS_PATTERNS[f].includes(pt))))).concat(base.filter(s => p.focus.some(f => s.some(pt => FOCUS_PATTERNS[f].includes(pt))))); }
  if (p.goal === 'endurance' || p.goal === 'fat_loss') slots.push(['cardio_low', 'cardio_high']);
  while (slots.length < count) slots.push(p.focus.length ? FOCUS_PATTERNS[p.focus[slots.length % p.focus.length]] : base[slots.length % base.length]);
  return slots.slice(0, count);
}
function why(m, p, slot) {
  const out = [];
  const pat = CT().PATTERN_HE[m.pattern]; if (pat) out.push('דפוס ' + pat);
  out.push(m.primary.length ? 'עובד על ' + m.primary.slice(0, 3).join(', ') : 'אין בקטלוג פירוט שרירים לתרגיל הזה');
  if (p.focus.some(f => FOCUS_PATTERNS[f].includes(m.pattern))) out.push('בקבוצה שביקשת להדגיש');
  if (p.fav.includes(m.id)) out.push('ברשימת המועדפים שלך');
  out.push(m.eq.length ? 'ציוד: ' + m.eq.map(e => CT().EQUIPMENT[e].he).join(', ') : 'בלי ציוד');
  out.push('רמת קושי ' + m.d + ' מתוך 3' + (p.level ? '' : ' (רמת הניסיון לא הוגדרה — נבחרו תרגילים ברמה בסיסית)'));
  return out.join(' · ');
}
/* generate a workout. Deterministic for the same params (variant = "another suggestion"). */
function generate(params) {
  const p = normParams(params), P = pool(p), cap = capD(p), used = new Set(), notes = [], main = [];
  const ctx = { lvl: lvlIdx(p), weekInPhase: 0, kind: PR().PHASE_KINDS.base, deload: false, goal: p.goal === 'muscle' ? 'muscle' : p.goal };
  const muscleLoad = {};
  slotsFor(p).forEach((pats, si) => {
    let c = P.filter(m => pats.includes(m.pattern) && !used.has(m.id) && m.d <= cap);
    if (!c.length) c = P.filter(m => pats.includes(m.pattern) && !used.has(m.id) && m.d <= cap + 1).map(m => Object.assign({}, m, { above: true }));
    /* avoid a 4th exercise on the same primary muscle when another candidate exists */
    const light = c.filter(m => m.primary.every(x => (muscleLoad[x] || 0) < 3)); if (light.length) c = light;
    if (!c.length) { notes.push('אין תרגיל מתאים ל' + pats.map(x => CT().PATTERN_HE[x]).filter(Boolean).join('/') + ' עם הציוד, הרמה וההחרגות שבחרת — המקום נשאר ריק.'); return; }
    const fav = c.filter(m => p.fav.includes(m.id)); const list = (fav.length ? fav : c).sort((a, b) => b.d - a.d || (a.id < b.id ? -1 : 1));
    const m = list[(p.variant + si) % list.length]; used.add(m.id); m.primary.forEach(x => { muscleLoad[x] = (muscleLoad[x] || 0) + 1; });
    const it = (m.type === 'cardio' || m.type === 'plyometric') ? PL().condDose(m, ctx) : PL().dose(m, ctx);
    delete it.circuit; it.why = why(m, p, pats) + (m.above ? ' · מעל הרמה הרגילה כי אין חלופה ברמה שלך' : '');
    main.push(it);
  });
  const usable = it => P.some(m => m.id === it.ex) && !used.has(it.ex);
  let warm = PL().WARM.filter(usable).map(clone), cool = PL().COOL.filter(usable).map(clone);
  if (p.goal === 'mobility') { warm = warm.slice(0, 2); cool = cool.slice(0, 2); }
  const w = { warm, main, cool, finisher: [] };
  fit(w, p, notes);
  return { params: p, warm: w.warm, main: w.main, cool: w.cool, finisher: [], notes, minutes: minutes(w), breakdown: breakdown(w) };
}
const def = w => ({ warm: w.warm || [], main: (w.main || []).concat(w.finisher || []), cool: w.cool || [] });
function breakdown(w) { const b = L().durationBreakdown(def(w), 'std'); return { warm: Math.round(b.warm / 60 * 10) / 10, work: Math.round(b.work / 60 * 10) / 10, rest: Math.round(b.rest / 60 * 10) / 10, trans: Math.round(b.trans / 60 * 10) / 10, cool: Math.round(b.cool / 60 * 10) / 10, total: Math.round(b.total / 60) }; }
const minutes = w => def(w).main.length ? L().estimateMinutes(def(w), 'std') : 0;
/* fit the requested time, transparently: trim cool-down, then sets, then warm-up, then the last exercise; or add sets toward it */
function fit(w, p, notes) {
  const T = p.minutes, cut = []; let g = 0;
  while (minutes(w) > T && g++ < 60) {
    /* order: extra sets (keep ≥2) → shorter cool-down / warm-up → drop the last exercise (keep ≥3) → down to 1 set */
    const big = w.main.filter(x => x.sets > 2).sort((a, b) => b.sets - a.sets)[0]; if (big) { big.sets--; cut.push('סט אחד פחות ב' + root.EX_BY_ID[big.ex].he); continue; }
    if (w.cool.length > 2) { w.cool.pop(); cut.push('שחרור קצר יותר'); continue; }
    if (w.warm.length > 2) { w.warm.pop(); cut.push('חימום קצר יותר'); continue; }
    if (w.main.length > 3) { const x = w.main.pop(); cut.push('הוסר ' + root.EX_BY_ID[x.ex].he); continue; }
    const one = w.main.filter(x => x.sets > 1).sort((a, b) => b.sets - a.sets)[0]; if (one) { one.sets--; cut.push('סט אחד פחות ב' + root.EX_BY_ID[one.ex].he); continue; }
    break;
  }
  if (cut.length) notes.push(`קוצר כדי להיכנס ל־${T} דק׳: ${[...new Set(cut)].slice(0, 4).join(', ')}${cut.length > 4 ? '…' : ''}.`);
  if (!cut.length) { let added = 0, guard = 0; while (minutes(w) < T - 3 && guard++ < 40) { const it = w.main.filter(x => x.sets < (['mobility', 'breathing'].includes(CT().exFacts(root.EX_BY_ID[x.ex]).type) ? 2 : 4) && (x.reps || typeof x.sec === 'number')).sort((a, b) => a.sets - b.sets)[0]; if (!it) break; it.sets++; if (minutes(w) > T) { it.sets--; break; } added++; }
    if (added) notes.push(`נוספו ${added} סטים כדי להתקרב ל־${T} דק׳.`);
    /* still short and the goal allows steady cardio: one brisk-walk block fills the gap (a real exercise, sized to the time left) */
    if (p.goal === 'mobility' && T - minutes(w) >= 3) { w.main.forEach(x => { if (typeof x.sec === 'number' && x.sec < 60) x.sec = 60; }); if (minutes(w) > T) w.main.forEach(x => { if (x.sec === 60) x.sec = 45; }); notes.push('ההחזקות הוארכו (45–60 שנ׳) כדי להתקרב לזמן שבחרת.'); }
    const bw = w.main.find(x => x.ex === 'brisk_walk'), gap0 = T - minutes(w);
    if (bw && gap0 >= 5 && p.goal !== 'mobility') { const tot = Math.min(1200, (bw.sets || 1) * (bw.sec || 0) + (gap0 - 1) * 60); bw.sets = 1; bw.sec = tot; bw.rest = 0; bw.why = 'הליכה מהירה רציפה · משלימה את הזמן שבחרת (לב־ריאה, בלי ציוד)'; notes.push('ההליכה המהירה הפכה לבלוק רציף כדי להשלים את הזמן.'); }
    const gap = T - minutes(w); if (gap >= 5 && p.goal !== 'mobility' && !p.exclude.includes('brisk_walk') && !w.main.some(x => x.ex === 'brisk_walk') && root.EX_BY_ID.brisk_walk) {
      w.main.push({ ex: 'brisk_walk', sets: 1, sec: Math.min(1200, Math.max(180, (gap - 1) * 60)), rest: 0, why: 'הליכה מהירה במקום חזרה על אותם תרגילים — משלימה את הזמן שבחרת (לב־ריאה, בלי ציוד)' }); notes.push('נוספה הליכה מהירה כדי להשלים את הזמן.'); } }
  if (minutes(w) > T) notes.push(`גם אחרי קיצור האימון נמשך כ־${minutes(w)} דק׳ — יותר מ־${T}. אפשר לבחור זמן ארוך יותר או להסיר תרגיל.`);
  else if (minutes(w) < T - 5) notes.push(`האימון קצר מהזמן שבחרת (~${minutes(w)} דק׳): אין מספיק תרגילים מתאימים עם הציוד, הרמה וההחרגות שבחרת.`);
}
/* validation before saving — a saved workout never holds an unknown exercise or an unrealistic value */
function validate(w) {
  const e = [];
  if (!w || typeof w !== 'object') return ['אין אימון.'];
  if (!w.name || !String(w.name).trim() || String(w.name).length > 60) e.push('צריך שם לאימון (עד 60 תווים).');
  if (!Array.isArray(w.main) || !w.main.length) e.push('צריך לפחות תרגיל אחד באימון.');
  if ((w.main || []).length > 15) e.push('עד 15 תרגילים באימון.');
  ['warm', 'main', 'cool'].forEach(k => (w[k] || []).forEach((it, i) => { const nm = (root.EX_BY_ID[it.ex] || {}).he || it.ex;
    if (!root.EX_BY_ID[it.ex]) e.push(`תרגיל לא מוכר: ${it.ex}.`);
    const r = (key, [lo, hi]) => { if (it[key] == null) return; if (typeof it[key] !== 'number' || !isFinite(it[key]) || it[key] < lo || it[key] > hi) e.push(`${nm}: ${({ sets: 'סטים', reps: 'חזרות', sec: 'שניות', rest: 'מנוחה' })[key]} בין ${lo} ל־${hi}.`); };
    r('sets', LIMITS.sets); r('reps', LIMITS.reps); r('sec', LIMITS.sec); r('rest', LIMITS.rest);
    if (it.reps == null && it.sec == null) e.push(`${nm}: חסרות חזרות או שניות.`); }));
  const ids = (w.main || []).map(x => x.ex); if (new Set(ids).size !== ids.length) e.push('אותו תרגיל מופיע פעמיים באימון — אפשר להוסיף לו סטים במקום.');
  return e;
}
/* constraint check with the Plan Integrity Gate (equipment, exclusions, jumping, time) — the builder's own params as context */
function check(w) {
  const p = normParams(w.params || {}); if (!root.Gate) return { ok: true, issues: [] };
  return root.Gate.checkWorkout(def(w), { ctx: { equipment: ['none', ...p.equipment], exclude: p.exclude, noJump: p.noJump, maxMin: p.minutes, src: 'builder' } });
}
/* ── storage (Store 'workouts') ── */
const W = () => { const w = S().load('workouts'); if (!w.custom || typeof w.custom !== 'object') w.custom = {}; if (!Array.isArray(w.customLog)) w.customLog = []; return w; };
const list = () => Object.values(W().custom).sort((a, b) => (b.fav - a.fav) || String(b.updatedAt).localeCompare(String(a.updatedAt)));
const get = id => W().custom[id] || null;
function save(w) {
  const errs = validate(w); if (errs.length) { const er = new Error(errs[0]); er.list = errs; throw er; }
  const store = W(), now = new Date().toISOString(), id = w.id && store.custom[w.id] ? w.id : (w.id || uid());
  const prev = store.custom[id];
  const rec = { id, name: String(w.name).trim(), params: normParams(w.params), warm: clean(w.warm), main: clean(w.main), cool: clean(w.cool), notes: (w.notes || []).slice(0, 8),
    original: prev ? prev.original : clone({ warm: clean(w.original ? w.original.warm : w.warm), main: clean(w.original ? w.original.main : w.main), cool: clean(w.original ? w.original.cool : w.cool) }),
    fav: !!(prev ? prev.fav : w.fav), createdAt: prev ? prev.createdAt : now, updatedAt: now, v: 1 };
  store.custom[id] = rec; if (!S().save('workouts')) throw new Error('השמירה נכשלה — ייתכן שהאחסון במכשיר מלא. האימון לא נשמר.'); return rec;
}
const clean = arr => (arr || []).map(it => { const o = { ex: it.ex, sets: it.sets }; ['reps', 'sec', 'rest', 'side', 'lvl', 'why'].forEach(k => { if (it[k] != null) o[k] = it[k]; }); return o; });
function remove(id) { const s = W(); if (!s.custom[id]) return false; delete s.custom[id]; S().save('workouts'); return true; } /* logged runs keep their snapshot */
function duplicate(id) { const w = get(id); if (!w) throw new Error('האימון לא נמצא'); const c = clone(w); delete c.id; c.name = (w.name + ' (עותק)').slice(0, 60); c.fav = false; c.original = clone(w.original); return save(c); }
function toggleFav(id) { const s = W(), w = s.custom[id]; if (!w) return null; w.fav = !w.fav; S().save('workouts'); return w.fav; }
function revert(id) { const s = W(), w = s.custom[id]; if (!w || !w.original) throw new Error('אין גרסה מקורית'); Object.assign(w, clone(w.original), { updatedAt: new Date().toISOString() }); S().save('workouts'); return w; }
/* runner integration: the existing runner plays { warm, main, cool } */
function runDef(id) { const w = get(id); if (!w) return null; return { title: w.name, type: 'custom', warm: w.warm || [], main: w.main || [], cool: w.cool || [], custom: true }; }
function logRun(id, data) {
  const w = get(id), s = W(); const snap = w ? { name: w.name, warm: clone(w.warm), main: clone(w.main), cool: clone(w.cool), minutes: minutes(w) } : null;
  const runId = (data && data.runId) || ('r' + Date.now().toString(36));
  if (s.customLog.some(r => r.runId === runId)) return null; /* idempotent: the same run is never logged twice */
  const rec = Object.assign({ runId, wid: id, date: S().today(), at: new Date().toISOString(), snapshot: snap }, data || {});
  s.customLog.push(rec); if (s.customLog.length > 500) s.customLog.splice(0, s.customLog.length - 500); S().save('workouts'); return rec;
}
const history = id => W().customLog.filter(r => !id || r.wid === id).slice().reverse();
/* substitution inside a builder workout: the shared ranking with this workout's own constraints */
function alternatives(w, phase, idx) {
  const it = (w[phase] || [])[idx]; if (!it) return { list: [], reason: 'אין תרגיל במקום הזה' };
  const p = normParams(w.params), inSession = new Set(['warm', 'main', 'cool'].flatMap(k => (w[k] || []).map(x => x.ex)));
  return root.Plans.rank(it, { have: ['none', ...p.equipment], exclude: p.exclude, noJump: p.noJump, inSession, fav: p.fav, level: p.level, phase });
}
function substitute(w, phase, idx, toId) {
  const a = alternatives(w, phase, idx), alt = a.list.find(x => x.id === toId); if (!alt) throw new Error('התרגיל אינו חלופה מתאימה');
  const from = w[phase][idx].ex, it = Object.assign({}, alt.item); it.why = 'הוחלף מ' + root.EX_BY_ID[from].he + ': ' + alt.why.join(' · ') + (alt.diffs.length ? ' · שינויים: ' + alt.diffs.join(', ') : '');
  w[phase][idx] = it; return { from, to: toId, diffs: alt.diffs, minutes: minutes(w) };
}
/* manual edits (the UI works on a copy; save() validates) */
function move(w, idx, d) { const j = idx + d; if (j < 0 || j >= w.main.length) return false; [w.main[idx], w.main[j]] = [w.main[j], w.main[idx]]; return true; }
function addExercise(w, id) {
  const m = root.EX_BY_ID[id]; if (!m) throw new Error('תרגיל לא מוכר'); if (w.main.some(x => x.ex === id)) throw new Error('התרגיל כבר באימון');
  const f = CT().exFacts(m), p = normParams(w.params), ctx = { lvl: lvlIdx(p), weekInPhase: 0, kind: PR().PHASE_KINDS.base, deload: false, goal: p.goal };
  const it = (f.type === 'cardio' || f.type === 'plyometric') ? PL().condDose(f, ctx) : PL().dose(f, ctx); delete it.circuit; it.why = 'נוסף על ידך · ' + why(f, p); w.main.push(it); return it;
}
function search(q, opt) {
  opt = opt || {}; const n = String(q || '').trim().toLowerCase(), have = opt.equipment ? ['none', ...opt.equipment] : null;
  return root.EXERCISES.map(e => CT().exFacts(e)).filter(m => {
    const e = root.EX_BY_ID[m.id]; if (opt.cat && m.cat !== opt.cat) return false; if (opt.maxD && m.d > opt.maxD) return false; if (have && !CT().usableWith(e, have)) return false;
    return !n || [e.he, e.en, m.id, m.primary.join(' '), m.secondary.join(' '), CT().PATTERN_HE[m.pattern] || ''].join(' ').toLowerCase().includes(n);
  }).map(m => ({ id: m.id, he: root.EX_BY_ID[m.id].he, cat: m.cat, d: m.d, eq: m.eq, primary: m.primary }));
}
root.Builder = { GOALS, LEVELS, FOCUS, MINUTES, LIMITS, normParams, fromProfile, generate, validate, check, minutes, breakdown, def, list, get, save, remove, duplicate, toggleFav, revert, runDef, logRun, history, alternatives, substitute, move, addExercise, search };
})(typeof window !== 'undefined' ? window : globalThis);
