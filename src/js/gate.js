/* M12 · Plan Integrity Gate — ONE independent validator for workouts and meals, used before a plan is activated, a workout is
   started, an exercise or a meal is swapped, and by Sofit. It re-checks the user's stated constraints with its own simple rules
   (not the generator's code), so a generator defect is not reproduced by the check.
   issue = { sev: 'block'|'warn'|'info', kind, text, why, ex?, n?, slot?, rid? }. 'block' = contradicts a hard constraint the user
   stated (equipment they don't have, an excluded exercise, a restricted food); 'warn' = a soft limit (time, impact, dislike, prep).
   It never changes data and never fills in missing data: unknown constraints are simply not checked (listed in `unknown`). */
(function (root) {
'use strict';
const C = () => root.Core, CT = () => root.CATALOG, L = () => root.Logic;
const EQ_HE = k => ((CT().EQUIPMENT || {})[k] || {}).he || k;
/* constraints in force for a classic day (profile) or a personal-plan day (the plan segment that covers day n) */
function trip(date) { const t = (C().profile().travel) || {}; date = date || root.Store.today(); return t.from && t.to && date >= t.from && date <= t.to ? t : null; }
function ctxFor(plan, n, date) {
  const p = C().profile(), tr = trip(date);
  if (tr) { const base = ctxFor0(plan, n, p); return Object.assign(base, { equipment: ['none'].concat(tr.eq || []), maxMin: tr.minutes || base.maxMin, src: 'travel', trip: tr }); }
  return ctxFor0(plan, n, p);
}
function ctxFor0(plan, n, p) {
  if (plan) { const seg = (plan.segments || []).filter(s => s.fromDay <= (n || 1)).pop(), q = (seg && seg.params) || {};
    return { equipment: ['none'].concat(q.equipment || []), exclude: q.exclude || [], noJump: !!q.noJump, maxMin: q.maxMin || null, src: 'plan' }; }
  const env = p.environment || {}, ep = p.exercisePrefs || {};
  return { equipment: env.place || (env.equipment || []).length ? ['none'].concat(env.equipment || []) : null /* unknown → not checked */, exclude: ep.exclude || [], noJump: !!ep.noJump, maxMin: (p.availability || {}).maxMin || null, src: 'profile' };
}
function exIssues(exId, ctx) {
  const e = root.EX_BY_ID[exId]; if (!e) return [{ sev: 'block', kind: 'unknown-ex', ex: exId, text: 'תרגיל לא מוכר', why: 'התרגיל לא נמצא בספרייה.' }];
  const out = [], m = CT().exMeta(exId);
  if (ctx.equipment && !CT().usableWith(e, ctx.equipment)) { const miss = m.eq.filter(t => !ctx.equipment.includes(t)), homeOnly = miss.every(t => ((CT().EQUIPMENT || {})[t] || {}).home); /* a chair or a wall is usually there → warning; real gear → block */
    out.push({ sev: homeOnly ? 'warn' : 'block', kind: 'equipment', ex: exId, text: `${e.he} דורש ${miss.map(EQ_HE).join(', ')}`, why: ctx.src === 'travel' ? 'בנסיעה הגדרת ציוד אחר.' : 'הציוד הזה לא מופיע בציוד שהגדרת.' }); }
  if (ctx.exclude.includes(exId)) out.push({ sev: 'block', kind: 'excluded', ex: exId, text: `${e.he} ברשימת התרגילים שביקשת להוציא`, why: 'סימנת את התרגיל כלא מתאים לך.' });
  if (ctx.noJump && m.impact === 'high') out.push({ sev: 'warn', kind: 'impact', ex: exId, text: `${e.he} כולל קפיצות`, why: 'ביקשת אימונים בלי קפיצות.' });
  return out;
}
/* def = { main:[{ex}], warm, cool, ... } (Core.dayDef / Plans.runDef); version for the time estimate */
function checkWorkout(def, opt) {
  opt = opt || {}; const ctx = opt.ctx || ctxFor(opt.plan, opt.n, opt.date), issues = [], seen = new Set();
  if (!def) return { ok: false, issues: [{ sev: 'block', kind: 'no-day', text: 'אין אימון ביום הזה', why: '' }], ctx };
  ['warm', 'main', 'finisher', 'cool'].forEach(k => (def[k] || []).forEach(it => { const id = opt.exFor ? opt.exFor(it.ex) : it.ex; if (seen.has(id)) return; seen.add(id); exIssues(id, ctx).forEach(x => issues.push(x)); }));
  const maxMin = opt.minutes || ctx.maxMin;
  let est0 = null; try { est0 = def.main && def.main.length ? L().estimateMinutes(Object.assign({ warm: [], cool: [], finisher: [] }, def), opt.version || 'std') : null; } catch (e) { est0 = null; /* malformed day → no time claim */ }
  if (maxMin && est0 != null) { const est = est0;
    if (est > maxMin) issues.push({ sev: 'warn', kind: 'time', text: `האימון (~${est} דק׳) ארוך מהזמן שיש לך (${maxMin} דק׳)`, why: opt.minutes ? 'לפי הזמן שציינת עכשיו.' : ctx.src === 'travel' ? 'לפי הזמן שהגדרת לימי הנסיעה.' : 'לפי הזמן לאימון שבפרופיל.', est, maxMin }); }
  const unknown = ctx.equipment ? [] : ['ציוד'];
  return { ok: !issues.some(x => x.sev === 'block'), issues, ctx, unknown };
}
/* a whole personal plan before activation (preview days): issues grouped by kind+exercise, with the day numbers */
function checkPlan(plan, days) {
  const map = new Map(); (days || []).forEach(d => { if (!d || !(d.main || []).length) return;
    checkWorkout({ warm: d.warm, main: d.main, finisher: d.finisher, cool: d.cool }, { plan, n: d.n, version: d.version || 'std' }).issues.forEach(x => {
      const k = x.kind + ':' + (x.ex || ''); const cur = map.get(k); if (cur) cur.days.push(d.n); else map.set(k, Object.assign({ days: [d.n] }, x)); }); });
  const issues = [...map.values()]; return { ok: !issues.some(x => x.sev === 'block'), issues };
}
/* a meal: restrictions are hard; dislikes / prep time are soft; cuisine is information */
function checkMeal(r, ov) {
  if (!r) return { ok: false, issues: [{ sev: 'block', kind: 'no-meal', text: 'אין מנה', why: '' }] };
  const c = C(), pf = c.normPrefs(c.profile().prefs), out = [], cs = c.conflicts(r, ov || null);
  if (cs.length) out.push({ sev: 'block', kind: 'restriction', rid: r.id, text: `${r.he}: ${c.conflictText(cs)}`, why: 'מכילה מזון שהגבלת.' });
  if ((c.profile().nutritionDislike || []).includes(r.id)) out.push({ sev: 'warn', kind: 'dislike', rid: r.id, text: `${r.he} מסומנת "לא אוהב/ת"`, why: 'סימנת את המנה.' });
  const m = (r.prep || 0) + (r.cook || 0); if (pf.maxPrep && m > pf.maxPrep) out.push({ sev: 'warn', kind: 'prep', rid: r.id, text: `${r.he}: ~${m} דק׳ הכנה (הגדרת עד ${pf.maxPrep})`, why: 'זמן ההכנה שהגדרת.' });
  if (!c.cuisineAllowed(r, pf)) out.push({ sev: 'info', kind: 'cuisine', rid: r.id, text: `${r.he} ממטבח אחר מזה שבחרת`, why: 'העדפת מטבח.' });
  if (r.est) out.push({ sev: 'info', kind: 'estimate', rid: r.id, text: 'ערכים משוערים (מנת מסעדה)', why: '' });
  return { ok: !out.some(x => x.sev === 'block'), issues: out };
}
/* the menu of a date as shown (Core.plan output) */
function checkMenu(date) {
  const c = C(), pl = c.plan(date), out = [];
  ['m1', 'm2', 'snack', 'extra'].forEach(k => { const s = pl[k]; if (!s || s.off) return;
    if (s.missing) { out.push({ sev: 'block', kind: 'no-valid-meal', slot: k, text: `${c.slotNames[k]}: אין מנה שמתאימה להגבלות`, why: s.blockedNone || '' }); return; }
    if (!s.rid || (k === 'extra' && !pl.extra.on)) return; checkMeal(L().recipe(s.rid), s.ov).issues.filter(x => x.sev !== 'info').forEach(x => out.push(Object.assign({ slot: k }, x))); });
  return { ok: !out.some(x => x.sev === 'block'), issues: out };
}
/* profile-level contradictions (never fixed silently — the user decides) */
function checkGoals() {
  const p = C().profile(), g = (p.aims || {}).primary, sec = (p.aims || {}).secondary || [], w = +p.weight, tw = +p.targetWeight, av = p.availability || {}, out = [];
  const loss = ['fat_loss', 'weight_loss'], gain = ['muscle', 'gain'];
  if (w && tw && loss.includes(g) && tw > w) out.push({ sev: 'warn', kind: 'goal-weight', text: 'המטרה היא ירידה, אבל משקל היעד גבוה מהמשקל הנוכחי', why: `משקל ${w} ק״ג, יעד ${tw} ק״ג.`, ask: 'מה נכון: המטרה או משקל היעד?' });
  if (w && tw && g === 'gain' && tw < w) out.push({ sev: 'warn', kind: 'goal-weight', text: 'המטרה היא עלייה במשקל, אבל משקל היעד נמוך מהנוכחי', why: `משקל ${w} ק״ג, יעד ${tw} ק״ג.`, ask: 'מה נכון: המטרה או משקל היעד?' });
  if ((loss.includes(g) && sec.some(x => x === 'gain')) || (g === 'gain' && sec.some(x => loss.includes(x)))) out.push({ sev: 'warn', kind: 'goal-mix', text: 'מטרות סותרות: ירידה במשקל ועלייה במשקל יחד', why: 'אי אפשר לכוון את הקלוריות לשתיהן בבת אחת.', ask: 'איזו מטרה קודמת עכשיו?' });
  if (av.sessions && av.days && av.days.length && av.sessions > av.days.length) out.push({ sev: 'warn', kind: 'sessions', text: `ביקשת ${av.sessions} אימונים בשבוע אבל סימנת ${av.days.length} ימים`, why: 'אין מספיק ימים פנויים.', ask: 'להוסיף ימים או להוריד אימונים?' });
  if (av.maxMin && av.maxMin < 10) out.push({ sev: 'warn', kind: 'too-short', text: `${av.maxMin} דקות קצר מכל גרסת אימון`, why: 'הגרסה הקצרה ביותר היא כ־10–15 דקות.' });
  return { ok: true, issues: out };
}
const worst = issues => issues.some(x => x.sev === 'block') ? 'block' : issues.some(x => x.sev === 'warn') ? 'warn' : 'ok';
root.Gate = { trip, ctxFor, exIssues, checkWorkout, checkPlan, checkMeal, checkMenu, checkGoals, worst };
})(window);
