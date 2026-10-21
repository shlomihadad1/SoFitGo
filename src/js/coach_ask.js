/* M11.2 · Sofit coach engine ("שאלו את Sofit") — on-demand chunk extra.js.
   LOCAL provider only: a question is matched to a fixed topic by keywords, and the answer is computed from data the app already
   stores (profile, plan, workout log, food journal, water, steps, measures) with the same functions the screens use. Nothing is
   generated, sent or stored. A question with no matching topic gets "no grounded answer" — never a guess. Safety words always win.
   Actions reuse the existing systems: a workout opens in the existing runner (Run.start → pre-start sheet, manual/auto mode), a
   meal swap writes through Core.setPlanSlot exactly like the nutrition screen, exercise swaps go to the day screen.
   Provider interface: CoachAsk.provider = { id, label, ask(q, ctx) → Promise<answer> }. A future AI provider must run on a server
   (no API key in the client) and must be approved; until then only 'local' exists and every answer is labelled as local. */
(function (root) {
'use strict';
const S = root.Store, C = root.Core, L = root.Logic, N = () => root.NUTRI;
const norm = q => String(q || '').replace(/[֑-ׇ]/g, '').replace(/[״"'׳?!.,:;()]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
const r1 = x => Math.round(x);
const ap = () => root.Plans && root.Plans.active();
/* ---- context: only what the app stores. Missing = null (shown as "לא הוזן", never guessed) ---- */
function context() {
  const p = C.profile(), G = (root.PROGRAMS && root.PROGRAMS.GOALS) || {}, EQ = (root.CATALOG && root.CATALOG.EQUIPMENT) || {}, LV = { beginner: 'מתחיל/ה', intermediate: 'בינוני/ת', advanced: 'מתקדם/ת' };
  const pf = C.normPrefs(p.prefs), no = [['dairy', 'חלב'], ['egg', 'ביצים'], ['chicken', 'עוף'], ['fish', 'דגים'], ['meat', 'בשר']].filter(([k]) => pf[k] === false).map(x => x[1]);
  if (pf.veg) no.push('צמחוני'); if (pf.vegan) no.push('טבעוני'); if (pf.glutenFree) no.push('ללא גלוטן'); (pf.exclude || []).forEach(f => no.push((N().FOODS[f] || {}).he || f));
  const eq = (p.environment && p.environment.equipment || []).map(k => (EQ[k] || {}).he || k);
  return [
    ['מטרה', p.aims && p.aims.primary ? G[p.aims.primary] || p.aims.primary : null, '#/profile'],
    ['רמת כושר', p.experience ? LV[p.experience] || p.experience : null, '#/profile'],
    ['ציוד', eq.length ? eq.join(', ') : (p.environment && p.environment.place ? 'ללא ציוד מוגדר' : null), '#/profile'],
    ['זמן לאימון', p.availability && p.availability.maxMin ? `עד ${p.availability.maxMin} דק׳` : null, '#/profile'],
    ['ימי אימון', p.availability && p.availability.days && p.availability.days.length ? p.availability.days.map(d => S.HE_DAYS[d]).join(', ') : null, '#/profile'],
    ['הגבלות תזונה', no.length ? no.join(', ') : 'ללא', '#/settings'],
    ['מטבח מועדף', (pf.cuisines || []).length ? pf.cuisines.map(k => (C.CUISINE_GROUPS[k] || {}).he || k).join(', ') : null, '#/settings'],
    ['תוכנית פעילה', ap() ? ap().name || 'תוכנית אישית' : 'תוכנית 30 הימים', '#/plan']
  ].map(([k, v, h]) => ({ k, v, h }));
}
/* ---- today's workout through the existing systems (classic day or personal-plan day), with versions + estimates ---- */
function todayWorkout(d) {
  const a = ap();
  if (a) { const td = root.Plans.todayDay(a); if (!td || !root.Plans.isTraining || !root.Plans.isTraining(td)) return td ? { rest: true } : null;
    const n = td.n, v0 = td.version || 'std', def = root.Plans.runDef(a.id, n), logged = !!td.log;
    return { plan: { id: a.id, n }, n, def, title: td.title || (def && def.title), versions: [[v0, L.estimateMinutes(def, v0)]], logged, href: '#/pday/' + n }; }
  const n = C.clampDay(C.todayN()), def = C.dayDef(n); if (!def) return null; if (!C.isTraining(n)) return { rest: true, href: '#/day/' + n };
  const vs = L.hasVersions(def) ? ['short', 'std', 'long'] : ['std'];
  return { n, def, title: def.title, versions: vs.map(v => [v, L.estimateMinutes(def, v)]), logged: !!(S.load('workouts').days[n]), href: '#/day/' + n };
}
const minsIn = n => { const m = n.match(/(\d{1,3})\s*(דק|דקות|min)/) || n.match(/(חצי שעה)|(שעה)/); if (!m) return null; return m[1] && /^\d/.test(m[1]) ? +m[1] : /חצי שעה/.test(m[0]) ? 30 : 60; };
function buildWorkout(d, n, mode) {
  const w = todayWorkout(d), said = minsIn(n), p = C.profile(), max = said || (p.availability && p.availability.maxMin) || null;
  if (!w) return { lines: ['לא מצאתי אימון לתכנן להיום.'], acts: [{ href: '#/workouts', label: 'לאימונים' }] };
  if (w.rest) return { lines: ['היום יום מנוחה בתוכנית. מנוחה היא חלק מהאימון.', 'אם בכל זאת בא לך לזוז — הליכה קלה או מתיחות.'], acts: [{ href: w.href || '#/workouts', label: 'לתוכנית' }] };
  const sorted = w.versions.slice().sort((a, z) => a[1] - z[1]);
  let pick = max ? sorted.filter(([, m]) => m <= max).pop() || sorted[0] : (mode === 'short' ? sorted[0] : sorted.find(x => x[0] === 'std') || sorted[0]);
  if (mode === 'short' && !said) pick = sorted[0];
  const VH = L.VERSIONS, lines = [`האימון של היום: ${w.title || 'אימון'}.`];
  if (w.logged) lines.push('שים/י לב: האימון של היום כבר נרשם. פתיחה מחדש תעדכן את הרישום.');
  lines.push(`הצעה: גרסה ${VH[pick[0]] || pick[0]} — כ־${pick[1]} דק׳ (הערכה).` + (sorted.length > 1 ? ` גרסאות: ${sorted.map(([v, m]) => `${VH[v]} ~${m}`).join(' · ')}.` : ''));
  if (max && pick[1] > max) lines.push(`אפילו הגרסה הקצרה ארוכה מ־${max} דק׳. אפשר להתחיל ולעצור באמצע — מה שבוצע נשמר כ"חלקי".`);
  const eq = (p.environment && p.environment.equipment || []); lines.push(w.plan ? 'התוכנית האישית שלך כבר בנויה לציוד ולמטרה שבפרופיל.' : `תוכנית 30 הימים היא בעיקר במשקל גוף${eq.length ? '' : ' — מתאים גם בלי ציוד'}. תרגיל לא מתאים? אפשר להחליף אותו במסך היום.`);
  return { lines, acts: [{ act: 'coachRun', data: { day: w.n, v: pick[0], plan: w.plan ? w.plan.n : '' }, label: `פתיחה במצב אימון (${VH[pick[0]] || pick[0]})` }, { href: w.href, label: 'לפרטי היום ולהחלפת תרגילים' }],
    chat: said ? `${said} דקות — לפי מה שכתבת עכשיו (לא נשמר בפרופיל)` : null, src: 'התוכנית של היום והפרופיל' };
}
function findEx(n) { const all = Object.values(root.EX_BY_ID || {}); let best = null; all.forEach(e => { const h = norm(e.he); if (h.length >= 3 && n.includes(h) && (!best || h.length > norm(best.he).length)) best = e; }); return best; }
function explainEx(e, d, wantAlt) {
  const lines = [], w = todayWorkout(d), it = w && !w.rest && w.def ? [].concat(w.def.main || [], w.def.finisher || []).find(x => x.ex === e.id) : null;
  if (wantAlt) { const alts = (e.alts || []).map(id => root.EX_BY_ID[id]).filter(Boolean); lines.push(alts.length ? `חלופות ל${e.he}: ${alts.map(x => x.he).join(', ')}.` : `אין חלופה מוגדרת ל${e.he}.`); if (alts.length) lines.push('ההחלפה נעשית במסך היום (חלה על אותו יום בלבד; המקור נשמר).'); }
  else { lines.push(`${e.he}: ${e.start || ''}`.trim()); (e.steps || []).slice(0, 4).forEach((s, i) => lines.push(`${i + 1}. ${s}`)); if (e.breath) lines.push(`נשימה: ${e.breath}`); if ((e.mistakes || []).length) lines.push(`להימנע: ${e.mistakes.slice(0, 3).join(' · ')}`); }
  if (it) lines.push(`בתוכנית של היום: ${it.sets || 1} סטים × ${it.reps ? it.reps + ' חזרות' : it.sec + ' שניות'}${it.rest ? `, מנוחה ${it.rest} שנ׳` : ''}.`);
  return { lines, acts: [{ href: w && w.href ? w.href : '#/workouts', label: wantAlt ? 'למסך היום (החלפה)' : 'לאימון של היום' }, { href: '#/ex/' + e.id, label: 'לדף התרגיל' }], src: 'ספריית התרגילים והתוכנית' };
}
function mealAdjust(d, n) {
  n = n || ''; const MO = root.MealOpt, m = root.Screens.nowModel(d), ctx = context();
  const mode = /חלבון/.test(n) ? 'protein' : /לבשל|בישול|מהיר|זמן|קל להכנה/.test(n) ? 'quick' : /קליל|פחות קלוריות|דיאט/.test(n) ? 'light' : null;
  const lines = [`ההעדפות שנלקחות בחשבון: הגבלות — ${ctx[5].v}; מטבח — ${ctx[6].v || 'לא נבחר'}${C.normPrefs(C.profile().prefs).maxPrep ? `; זמן הכנה עד ${C.normPrefs(C.profile().prefs).maxPrep} דק׳` : ''}.`];
  const nxt = m.done.find(x => ['m1', 'm2', 'snack'].includes(x.k) && !x.ok);
  if (!nxt || !MO) return { lines: lines.concat('כל הארוחות של היום כבר סומנו. אפשר לשנות מנות לימים הבאים במסך התזונה.'), acts: [{ href: '#/nutrition', label: 'לתפריט' }, { href: '#/settings', label: 'לעדכון העדפות' }] };
  const o = MO.options(d, nxt.k, mode || undefined), r = o.cur;
  if (/לא אוהב|לא טעים|לא בא לי/.test(n) && r) {
    lines.push(`הארוחה הבאה (${C.slotNames[nxt.k]}): ${r.he}. לסמן אותה "לא אוהב/ת"? היא לא תוצע יותר, ואז תבחרו חלופה.`);
    return { lines, acts: [{ act: 'coachDislike', data: { slot: nxt.k, rid: r.id }, label: `סימון "לא אוהב/ת": ${r.he}` }, { act: 'coachOpts', data: { slot: nxt.k, s: o.sort }, label: 'רק להחליף הפעם' }], src: 'התפריט של היום והעדפות התזונה' }; }
  if (r) { const mm = o.base; lines.push(`הארוחה הבאה (${C.slotNames[nxt.k]}): ${r.he} — כ־${Math.round(mm.k)} קק״ל, ${Math.round(mm.p)} ג׳ חלבון, ${(r.prep || 0) + (r.cook || 0)} דק׳.`); }
  const top = o.list.slice(0, 3);
  if (!top.length) lines.push('לא מצאתי חלופה שמתאימה להגבלות, למטבח ולמנות שסימנת. אפשר לפתוח את כל החלופות או לשנות העדפות.');
  else lines.push(`חלופות (${MO.SORTS[o.sort]}), ערכים מחושבים מהמרכיבים — לחיצה מציגה את ההשוואה לפני השמירה:`);
  return { lines, acts: top.map(x => ({ act: 'coachSwap', data: { slot: nxt.k, rid: x.r.id }, label: `${x.r.he} · ${Math.round(x.m.k)} קק״ל · ${Math.round(x.m.p)} ג׳ חלבון · ${(x.r.prep || 0) + (x.r.cook || 0)} דק׳` }))
    .concat([{ act: 'coachOpts', data: { slot: nxt.k, s: o.sort }, label: 'כל החלופות' }]), src: 'התפריט של היום והעדפות התזונה' };
}
function lastWorkout() {
  const out = []; const w = S.load('workouts'); Object.entries(w.days || {}).forEach(([n, x]) => x && x.date && out.push({ date: x.date, title: 'יום ' + n, x }));
  const a = ap(); if (a && a.log) Object.entries(a.log).forEach(([n, x]) => x && x.date && out.push({ date: x.date, title: (x.snapshot && x.snapshot.title) || 'יום ' + n, x }));
  out.sort((p, q) => p.date < q.date ? 1 : -1); return out[0] || null;
}
function summary() {
  const lw = lastWorkout(); if (!lw) return { lines: ['עוד לא נרשם אף אימון — אין מה לסכם.'], acts: [{ href: '#/workouts', label: 'לאימונים' }] };
  const x = lw.x, sets = (x.sets || []).filter(s => s.sec === 'main'), done = sets.filter(s => s.done).length, mins = x.durationSec ? Math.round(x.durationSec / 60) : null;
  const ST = { done: 'הושלם', partial: 'הושלם חלקית', skipped: 'דולג' };
  const lines = [`האימון האחרון: ${lw.title} (${S.fmtShort(lw.date)}) — ${ST[x.status] || x.status || ''}.`];
  if (sets.length) lines.push(`${done}/${sets.length} סטים עיקריים${mins ? `, ${mins} דק׳ בפועל` : ''}${x.mode === 'auto' ? ', במצב אוטומטי' : ''}${x.rpe ? `, קושי ${x.rpe}/10` : ''}.`);
  const fb = sets.map(s => s.fb).filter(Boolean); if (fb.length) lines.push(`משוב סטים: ${fb.filter(f => f === 'hard' || f === 'fail').length} קשה/לא הושלם מתוך ${fb.length}.`);
  return { lines, acts: [{ href: '#/progress', label: 'להתקדמות' }], src: 'יומן האימונים' };
}
function need() { return { lines: ['כדי לחשב יעדים צריך גיל, גובה ומשקל בפרופיל.'], acts: [{ href: '#/profile', label: 'השלמת הפרופיל' }] }; }
function nextMeal(d) { const m = root.Screens.nowModel(d), n = m.done.find(x => ['m1', 'm2', 'snack'].includes(x.k) && !x.ok); if (!n) return ''; const pl = C.plan(d)[n.k];
  if (!pl || !pl.rid) return ''; const r = L.recipe(pl.rid), mm = L.recipeMacros(r, pl.scale || 1, pl.ov); return `הארוחה הבאה בתפריט: ${r.he} (כ־${r1(mm.p)} ג׳ חלבון, ${r1(mm.k)} קק״ל).`; }
/* order = priority */
const T = [
  { id: 'safety', he: 'כאב או סחרחורת', re: /כאב (חד|בחזה|חזק)|לחץ בחזה|סחרחור|התעלפ|עילפון|קוצר נשימה|לא מצליח לנשום|דופק (מהיר|לא סדיר)|דפיקות לב|נפצעתי|פציעה/,
    a: () => ({ lines: ['עוצרים את האימון עכשיו. אני לא יכולה לאבחן או לטפל.', 'כאב בחזה, לחץ בחזה, קוצר נשימה, עילפון או דופק לא סדיר — פנו מיד לעזרה רפואית (מספר החירום המקומי).', 'כאב חד או פציעה — לא ממשיכים את התרגיל; אם זה לא חולף, לרופא/ה.'], acts: [{ href: '#/planb', label: 'הנחיות עצירה ו־Plan B' }], safety: true }) },
  { id: 'alt', he: 'חלופה לתרגיל', re: /חלופה|במקום|להחליף תרגיל|אחר במקום|לא יכול לעשות|לא יכולה לעשות/, ex: true,
    a: (d, n) => { const e = findEx(n); return e ? explainEx(e, d, true) : { lines: ['לאיזה תרגיל? כתבו את שם התרגיל, למשל "חלופה לסקוואט".', 'אפשר גם להחליף ישירות במסך היום.'], acts: [{ href: (todayWorkout(d) || {}).href || '#/workouts', label: 'למסך היום' }] }; } },
  { id: 'meals', he: 'התאמת ארוחות', re: /התאמת ארוח|להתאים ארוח|ארוחה|ארוחות|מה לאכול|להחליף מנה|החלפת מנה|לא אוהב|לא טעים|תפריט|לבשל|בישול|יותר חלבון|מנה /,
    a: (d, n) => mealAdjust(d, n) },
  { id: 'tired', he: 'התאמת האימון להיום', re: /עייפ|אין לי (זמן|כוח)|לא מתחשק|מותש|לדלג|דילוג|חולה|לא ישנתי|רק \d+ דק|יש לי \d+ דק|קצר יותר|להתאים את האימון|התאמת האימון/,
    a: (d, n) => { const b = buildWorkout(d, n, 'short'); return Object.assign(b, { lines: ['אפשר גרסה קצרה, להזיז או לדלג — בלי אשמה. גם מנוחה היא בחירה לגיטימית. חולה (חום, חולשה)? מנוחה עדיפה.'].concat(b.lines), acts: (b.acts || []).concat([{ href: '#/planb', label: 'Plan B — עוד אפשרויות' }]) }); } },
  { id: 'summary', he: 'סיכום האימון האחרון', re: /סיכום|האימון האחרון|איך היה האימון|אתמול/, a: () => summary() },
  { id: 'build', he: 'בניית אימון להיום', re: /בנה|בני לי|תבני|אימון של \d+|אימון ל ?\d+|\d+ דק|חצי שעה|לבנות אימון|בניית אימון/,
    a: (d, n) => buildWorkout(d, n) },
  { id: 'workout', he: 'מה האימון היום?', re: /אימון|להתאמן|מתאמנ|מה (יש )?היום/, a: (d, n) => buildWorkout(d, n) },
  { id: 'protein', he: 'כמה חלבון נשאר לי?', re: /חלבון|פרוטאין|protein/,
    a: d => { const t = C.targets(); if (!t) return need(); const e = C.eatenTotals(d), left = r1(t.protein - e.p);
      return { lines: [`היום רשמת ${r1(e.p)} ג׳ חלבון מתוך יעד של ${t.protein} ג׳.`, left > 0 ? `נשארו כ־${left} ג׳. ${nextMeal(d)}` : 'הגעת ליעד החלבון של היום.'], acts: [{ href: '#/nutrition', label: 'ליומן התזונה' }], src: 'היומן של היום והיעד שבפרופיל' }; } },
  { id: 'kcal', he: 'כמה קלוריות נשארו?', re: /קלורי|קק ?ל|אכלתי|נשאר לי לאכול/,
    a: d => { const t = C.targets(); if (!t) return need(); const e = C.eatenTotals(d), left = r1(t.kcal - e.k);
      return { lines: [`היום רשמת ${r1(e.k)} קק״ל מתוך יעד של ${t.kcal}.`, left >= 0 ? `נשארו כ־${left} קק״ל. ${nextMeal(d)}` : `עברת את היעד בכ־${-left} קק״ל — זה קורה; לא צריך "לפצות" מחר.`], acts: [{ href: '#/nutrition', label: 'ליומן התזונה' }], src: 'היומן של היום והיעד שבפרופיל' }; } },
  { id: 'water', he: 'כמה מים שתיתי?', re: /מים|שתיתי|לשתות|שתייה|ליטר/,
    a: d => { const g = C.waterGoalOn(d).ml, w = C.daily(d).water || 0;
      return { lines: [`שתית היום ${C.fmtL(w)} ליטר מתוך ${C.fmtL(g)}.`, w >= g ? 'הגעת ליעד המים של היום.' : `נשארו כ־${C.fmtL(g - w)} ליטר — עדיף בהדרגה לאורך היום.`], acts: [{ act: 'water', data: { ml: 250 }, label: '+0.25 ל׳' }], src: 'רישום המים של היום' }; } },
  { id: 'steps', he: 'כמה צעדים עשיתי?', re: /צעד|הליכה|הלכתי|steps/,
    a: d => { const A = root.Activity; if (!A) return { lines: ['מעקב הצעדים לא זמין בגרסה הזו.'], acts: [] }; const v = A.day(d), tg = A.targetOn(d);
      if (v.value == null) return { lines: ['עוד לא נרשמו צעדים היום.', A.envText()], acts: [{ href: '#/activity', label: 'רישום צעדים' }] };
      return { lines: [`היום: ${v.value.toLocaleString('he-IL')} צעדים (${A.label(v)}).`, tg ? (v.value >= tg ? 'הגעת ליעד הצעדים.' : `היעד: ${tg.toLocaleString('he-IL')} — נשארו ${(tg - v.value).toLocaleString('he-IL')}.`) : 'אין יעד צעדים מוגדר.'], acts: [{ href: '#/activity', label: 'לפעילות' }], src: v.kind === 'measured' ? 'נתון שנמדד' : 'רישום ידני' }; } },
  { id: 'progress', he: 'איך ההתקדמות שלי?', re: /התקדמות|משקל|ירדתי|עליתי|שקילה|רצף|השבוע/,
    a: () => { const ms = C.measures().filter(x => x.weight), st = C.streak(), lines = [];
      if (ms.length >= 2) { const a = ms[0], b = ms[ms.length - 1], dlt = Math.round((b.weight - a.weight) * 10) / 10; lines.push(`משקל: ${a.weight} ← ${b.weight} ק״ג (${dlt > 0 ? '+' : ''}${dlt}) בין ${S.fmtShort(a.date)} ל־${S.fmtShort(b.date)}. שינוי של יום־יומיים הוא בעיקר מים.`); }
      else lines.push('יש פחות משתי שקילות, אז עוד אין מגמת משקל.');
      lines.push(st ? `רצף אימונים: ${st}.` : 'עוד אין רצף אימונים פעיל — כל אימון מתחיל אחד חדש.');
      const s = summary(); if (lastWorkout()) lines.push(s.lines[0]);
      return { lines, acts: [{ href: '#/progress', label: 'למסך ההתקדמות' }], src: 'שקילות ואימונים שנרשמו' }; } },
  { id: 'terms', he: 'מה זה סט, חזרות ומנוחה?', re: /מה זה סט|סטים|חזרות|מנוחה בין|כמה מנוחה|מה זה חזרה/,
    a: () => ({ lines: ['חזרה = ביצוע אחד של התנועה. סט = רצף חזרות בלי הפסקה (למשל 10 חזרות).', 'מנוחה = ההפסקה בין סטים; היא נותנת לשריר להתאושש כדי שהסט הבא יהיה איכותי. מנוחה ארוכה יותר מתאימה לתרגילים כבדים.', 'אפשר לקבוע מנוחה בין סטים ובין תרגילים לפני כל אימון, ולשנות גם באמצע.'], acts: [] }) },
  { id: 'explain', he: 'הסבר תרגיל', re: /איך עושים|איך מבצעים|הסבר|מה זה|תסבירי|תסביר/, ex: true,
    a: (d, n) => { const e = findEx(n); if (e) return explainEx(e, d, false); if (/למה|תוכנית/.test(n)) return { lines: ['יש מסך שמסביר איך התוכנית נבנתה: המטרה, הימים, הציוד וההגבלות שבחרת.'], acts: [{ href: '#/explain', label: 'למה ככה?' }] };
      return { lines: ['איזה תרגיל להסביר? כתבו את השם, למשל "איך עושים שכיבות סמיכה".'], acts: [{ href: '#/library', label: 'לספריית התרגילים' }] }; } },
  { id: 'food', he: 'לאכול בחוץ', re: /מסעדה|בחוץ|אוכל בקרבת|מטבח/,
    a: () => ({ lines: ['העדפות מטבח (ישראלי, ים־תיכוני ועוד) נקבעות בהגדרות. לאכול בחוץ: "אוכל בקרבתי" פותח חיפוש במפות (אצל ספק חיצוני).'], acts: [{ href: '#/nearby', label: 'אוכל בקרבתי' }, { href: '#/settings', label: 'העדפות מטבח' }] }) },
  { id: 'why', he: 'למה התוכנית ככה?', re: /למה/,
    a: () => ({ lines: ['יש מסך שמסביר איך התוכנית נבנתה: המטרה, הימים, הציוד וההגבלות שבחרת.'], acts: [{ href: '#/explain', label: 'למה ככה?' }] }) }
];
function answer(q, date) {
  const n = norm(q); date = date || S.today();
  if (!n) return null;
  /* a named exercise + "alternative"/"how" wins over the generic topics (exercise names can contain words like "משקל") */
  const e = T[0].re.test(n) ? null : findEx(n);
  if (e) { const alt = T.find(x => x.id === 'alt').re.test(n), how = /איך|הסבר|מה זה|תסביר|ביצוע|לבצע/.test(n);
    if (alt || how || norm(e.he) === n) return Object.assign({ id: alt ? 'alt' : 'explain' }, explainEx(e, date, alt)); }
  const t = T.find(x => x.re.test(n));
  if (!t) return { id: 'none', lines: ['על זה אין לי תשובה מבוססת. אני עונה רק מתוך הנתונים שבאפליקציה, על הנושאים שלמטה.'], acts: [], topics: true };
  return Object.assign({ id: t.id }, t.a(date, n));
}
const local = { id: 'local', label: 'תשובה מקומית מהנתונים שלך · לא AI', ask: q => new Promise((res, rej) => { try { res(answer(q)); } catch (e) { rej(e); } }) };
const QUICK = ['build', 'tired', 'meals', 'summary', 'progress', 'protein', 'water', 'steps', 'alt', 'terms'];
root.CoachAsk = { answer, context, provider: local, providers: { local }, TOPICS: QUICK.map(id => { const t = T.find(x => x.id === id); return { id, he: t.he }; }), norm };
})(window);
