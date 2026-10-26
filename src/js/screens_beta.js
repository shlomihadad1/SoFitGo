/* RC5 · #/planb (Plan B hub, INN-07 first slice) and #/feedback (Beta Feedback, INN-43) — on-demand chunk extra.js.
   Plan B links to what the app ALREADY does (short version, exercise swap, meal/ingredient swap, fridge, travel); it adds no new
   training content (Minimum Mode needs professional review first) and never marks anything as done.
   Feedback builds a local text report. By default it contains NO personal data: no profile, journal, weight or plan — only the
   app build, screen, device class and what the user typed. Nothing is sent anywhere by the app; the user copies or shares it. */
(function (root) {
const { esc, icon } = root.UI; const S = root.Store, C = root.Core;
const Screens = root.Screens;
/* SLL-07 · Plan B by what changed. Only signals that are stored and reliable on this device; deterministic for a given state and
   clock; each suggestion says why it is shown; the same option is never listed twice; nothing changes without a tap.
     missed  — sessions of the active plan marked "missed" in the last 7 days (not logged)
     late    — 19:00 or later and today's workout is not done
     notfound— shopping-list items marked "לא נמצא" (they now have alternatives)
     travel  — an active travel mode that covers today
     parked  — a workout saved midway ("save and exit") */
Screens.planbSignals = function (now) {
  now = now || new Date(); const out = [], t = S.today(), ap = root.Plans && root.Plans.active();
  const ss = S.load('session'); if (ss && ss.parked && !ss.finished) out.push({ k: 'parked', why: 'יש אימון ששמרת באמצע. אפשר להמשיך מאותה נקודה.' });
  if (ap) { const wk = S.addDays(t, -7), miss = root.Plans.days(ap).filter(d => d.status === 'missed' && !d.log && d.date >= wk && d.date < t);
    if (miss.length) out.push({ k: 'missed', why: `${miss.length === 1 ? 'אימון אחד' : miss.length + ' אימונים'} מהשבוע האחרון לא בוצעו. אפשר להעביר אימון להיום או לדלג, בלי "להשלים הכול".` });
    const tv = ((ap.travel || []).find(x => x.status === 'active' && x.from <= t && t <= x.to)); if (tv) out.push({ k: 'travel', why: `מצב נסיעה פעיל עד ${S.fmtShort(tv.to)}.` }); }
  const w = (C.dailyProgress(t).tasks || []).find(x => x.k === 'workout'); if (w && w.v < 1 && now.getHours() >= 19) out.push({ k: 'time', why: `השעה ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} והאימון של היום עוד לא בוצע.` });
  const nu = S.load('nutrition'), nf = Object.values((nu.shopping && nu.shopping.state) || {}).filter(v => v === 'notfound').length;
  { const ci = C.daily(t).checkin || {}, CI = 'סימנת היום ב"מה יש לך היום?": '; /* SLL-07: user-reported, today only */
    if (ci.energy === 'low') out.push({ k: 'energy', why: CI + 'אנרגיה נמוכה.' });
    if (ci.eq === 'none') out.push({ k: 'equip', why: CI + 'אין ציוד.' });
    if (ci.space === 'quiet' || ci.space === 'small') out.push({ k: 'quiet', why: CI + (ci.space === 'quiet' ? 'צריך שקט.' : 'מקום קטן.') });
    if ((ci.time === '5' || ci.time === '15') && !out.some(x => x.k === 'time') && w && w.v < 1) out.push({ k: 'time', why: CI + `יש לך כ־${ci.time} דקות.` }); }
  if (nf) out.push({ k: 'ingredient', why: `${nf === 1 ? 'פריט אחד' : nf + ' פריטים'} ברשימת הקניות ${nf === 1 ? 'סומן' : 'סומנו'} "לא נמצא". לכל אחד יש "חלופות".` });
  return out;
};
/* SLL-07 · "מה יש לך היום?" — an OPTIONAL check-in inside Plan B (not a step before every workout). Answers are kept for today only
   (tracking.daily.checkin) and become Plan B signals with their reason. The recommendation uses only existing versions:
   energy low or ~5 minutes → "מינימום"; ~15 minutes → "קצר"; otherwise the regular version. Applying it changes only today's workout
   version (same mechanism as "היום שלי"), with undo. No equipment → the no-equipment options; quiet / small space → the "שקט" preset. */
const CI_Q = [['time', 'זמן', [['5', '~5 דק׳'], ['15', '~15 דק׳'], ['30', '30+ דק׳']]], ['energy', 'אנרגיה', [['low', 'נמוכה'], ['ok', 'רגילה'], ['high', 'גבוהה']]],
  ['eq', 'ציוד', [['none', 'אין'], ['some', 'יש']]], ['space', 'מקום', [['ok', 'רגיל'], ['small', 'קטן'], ['quiet', 'צריך שקט']]]];
function ciRecommend(ci) { if (!ci) return null; if (ci.energy === 'low' || ci.time === '5') return 'min'; if (ci.time === '15') return 'short'; if (ci.time || ci.energy) return 'std'; return null; }
function setTodayVersion(v) {
  const t = S.today(), ap = root.Plans && root.Plans.active(), before = { daily: JSON.stringify(C.daily(t)), plans: JSON.stringify(S.load('plans')) };
  let d = null; if (ap) { d = (root.Plans.days(ap) || []).find(x => (x.movedTo || x.date) === t && root.Plans.isTraining(x) && !x.log); if (!d) throw new Error('אין היום אימון פתוח בתוכנית'); root.Plans.setVersion(ap.id, d.n, v); }
  else C.setDaily(t, { dayVer: v });
  if (root.Screens.selectedVersion) root.Screens.selectedVersion._v = null;
  return { undo: () => { const tr = S.load('tracking'); tr.daily[t] = JSON.parse(before.daily); S.save('tracking'); if (d) { const cur = S.load('plans'); Object.keys(cur).forEach(k => delete cur[k]); Object.assign(cur, JSON.parse(before.plans)); S.save('plans'); } if (root.Screens.selectedVersion) root.Screens.selectedVersion._v = null; } };
}
function checkinCard(dayHref) {
  const ci = C.daily(S.today()).checkin || {}, rec = ciRecommend(ci), w = (C.dailyProgress(S.today()).tasks || []).find(x => x.k === 'workout');
  return `<section class="card" data-checkin><h3>מה יש לך היום? <span class="tiny muted">(רשות)</span></h3>
    ${CI_Q.map(([q, he, opts]) => `<div class="row wrap" data-ci-q="${q}"><span class="small" style="min-width:4.5em">${he}</span><div class="chips">${opts.map(([v, l]) => `<button class="chip" data-act="ciSet" data-q="${q}" data-v="${v}" aria-pressed="${ci[q] === v}">${l}</button>`).join('')}</div></div>`).join('')}
    ${rec && w && w.v < 1 ? `<p class="small" data-ci-rec="${rec}"><b>הצעה:</b> גרסת "${esc(root.Logic.VERSIONS[rec])}" לאימון של היום${rec === 'min' ? ' (נרשמת כ"בוצע חלקית")' : ''}.</p><div class="btns"><button class="btn sm primary" data-act="ciApply" data-v="${rec}">להחיל להיום</button><a class="btn sm" href="${dayHref}">לאימון</a></div>` : ''}
    ${Object.keys(ci).some(k => ci[k]) ? '<button class="btn sm ghost" data-act="ciClear">ניקוי התשובות</button>' : ''}
    <p class="tiny faint">התשובות נשמרות להיום בלבד, במכשיר הזה. הן לא משנות כלום עד שבוחרים פעולה.</p></section>`;
}
Screens.planb = function () {
  const ap = root.Plans && root.Plans.active(), td = ap ? root.Plans.todayDay(ap) : null, n = ap ? (td && td.n) : C.clampDay(C.todayN()), dayHref = ap ? (n ? '#/pday/' + n : '#/plan') : '#/day/' + n;
  const opt = (k, t, s, href, lbl) => `<a class="li" href="${href}" data-planb="${k}"><div class="grow"><div class="t">${t}</div><div class="s">${s}</div></div><span class="pill">${lbl}</span></a>`;
  return { title: 'Plan B — משהו לא מסתדר?', back: '#/', html: `
    ${checkinCard(dayHref)}
    <section class="card" data-planb-stop><div class="banner bad small">${icon('info')}<div><b>כאב חד, סחרחורת, לחץ בחזה או קוצר נשימה חריג?</b> עוצרים את האימון. לא ממשיכים "דרך הכאב". אם זה חמור או לא עובר — פונים לגורם רפואי או לשירותי החירום המקומיים.</div></div></section>
${(() => { const sig = Screens.planbSignals(), ks = sig.map(x => x.k), nfN = ks.includes('ingredient');
      const ALL = { parked: () => `<button class="li li-btn" data-act="resume" data-planb="parked"><div class="grow"><div class="t">להמשיך את האימון ששמרתי</div><div class="s">ממשיך מאותו שלב, עם הסטים שכבר סומנו.</div></div><span class="pill">אימון</span></button>`,
        missed: () => opt('missed', 'פספסתי אימונים', 'במסך התוכנית: להעביר אימון שפוספס להיום, או לדלג עליו.', '#/plan', 'תוכנית'),
        time: () => opt('time', 'אין לי זמן לאימון המלא', 'בחרו "מינימום" (~5 דק׳, נרשם כ"בוצע חלקית") או "קצר" באימון של היום — או דילוג, בלי אשמה.', dayHref, 'אימון'),
        equip: () => opt('equip', 'חסר ציוד / תרגיל לא מתאים', 'החלפת תרגיל בתוך האימון של היום.', dayHref, 'אימון'),
        energy: () => opt('energy', 'אין לי כוח היום', 'מדווחים אנרגיה ביומן היומי; מנוחה היא בחירה לגיטימית ולא מורידה כלום.', '#/progress', 'מעקב'),
        ingredient: () => nfN ? opt('ingredient', 'חסר לי מרכיב', 'ברשימת הקניות: "חלופות" ליד מה שלא נמצא.', '#/shopping', 'קניות') : opt('ingredient', 'חסר לי מרכיב', 'ביומן התזונה: "החלף רכיב" במנה.', '#/nutrition', 'תזונה'),
        meal: () => opt('meal', 'אין את הארוחה / לא מתחשק', 'החלפת ארוחה, או מנה ממה שיש בבית.', '#/fridge', 'תזונה'),
        quiet: () => opt('quiet', 'צריך שקט / מקום קטן', 'ערכת "שקט": בלי תרגילי קפיצה. אפשר גם גרסה קצרה של האימון.', '#/presets', 'העדפות'),
        travel: () => opt('travel', 'אני בנסיעה', ap ? 'מצב נסיעה בתוכנית: אימונים קצרים בלי ציוד לטווח שתבחרו.' : 'מצב נסיעה זמין בתוכנית אישית.', '#/travel', 'נסיעה') };
      const rest = ['time', 'equip', 'energy', 'ingredient', 'meal', 'travel'].filter(k => !ks.includes(k));
      return (sig.length ? `<section class="card" data-planb-now><h3>מומלץ עכשיו</h3><div class="list">${sig.map(x => ALL[x.k]() + `<p class="tiny muted" data-planb-why="${x.k}">למה: ${esc(x.why)}</p>`).join('')}</div></section>` : '')
        + `<section class="card"><h3>${sig.length ? 'עוד אפשרויות' : 'מה קרה?'}</h3><div class="list">${rest.map(k => ALL[k]()).join('')}</div>`; })()}<p class="tiny faint">כל מעבר כאן פותח פעולה קיימת. שום דבר לא מסומן כבוצע ושום דבר לא משתנה בלי שתאשרו. ההמלצות למעלה נבחרות לפי מה שרשום במכשיר והשעה.</p></section>`, handlers: { resume: () => { const ss = S.load('session'); if (ss && root.Run) root.Run.open(); },
      ciSet: el => { const t = S.today(), ci = Object.assign({}, C.daily(t).checkin || {}); ci[el.dataset.q] = ci[el.dataset.q] === el.dataset.v ? undefined : el.dataset.v; C.setDaily(t, { checkin: ci }); root.App.render(); },
      ciClear: () => { C.setDaily(S.today(), { checkin: null }); root.App.render(); },
      ciApply: el => { try { const r = setTodayVersion(el.dataset.v); root.App.render(); root.UI.toast(`הגרסה של היום: ${root.Logic.VERSIONS[el.dataset.v]}`, 0, { label: 'ביטול', fn: () => { r.undo(); root.App.render(); } }); } catch (e) { root.UI.toast(e.message); } } } };
};
/* SLL-42 · #/changes — the settings change log recorded by Store.recordChanges (see store.js). Read-only list, newest first;
   "מחיקת היומן" empties only the log (never a setting), with undo. Plan changes have their own history in the plan screen. */
const CH_HE = { 'aims.primary': 'מטרה עיקרית', 'aims.secondary': 'מטרות נוספות', experience: 'ניסיון', 'availability.days': 'ימי אימון', 'availability.sessions': 'אימונים בשבוע',
  'availability.prefMin': 'משך אימון מועדף (דק׳)', 'availability.maxMin': 'משך אימון מרבי (דק׳)', 'environment.place': 'מקום אימון', 'environment.equipment': 'ציוד',
  'exercisePrefs.exclude': 'תרגילים מוחרגים', 'exercisePrefs.noJump': 'בלי קפיצות', 'goals.steps': 'יעד צעדים', 'goals.water': 'יעד מים (מ״ל)', 'goals.sleep': 'יעד שינה (שעות)',
  targetWeight: 'משקל יעד (ק״ג)', 'prefs.chicken': 'עוף בתפריט', 'prefs.egg': 'ביצים בתפריט', 'prefs.dairy': 'מוצרי חלב בתפריט', 'prefs.veg': 'צמחוני', 'prefs.exclude': 'מזונות מוחרגים',
  'prefs.flex': 'ארוחה גמישה', restrictionKinds: 'סוג ההגבלה (אלרגיה / רגישות / העדפה)', mode: 'מצב שימוש', 'units.w': 'יחידת משקל', 'display.size': 'גודל טקסט',
  'display.motion': 'אנימציות', 'display.sound': 'צלילים', 'display.wake': 'מסך דולק באימון', 'display.lowData': 'חיסכון בנתונים', 'mediaPrefs.autoplay': 'ניגון אוטומטי של סרטונים',
  'targets.kcal': 'יעד קלוריות ידני', 'targets.protein': 'יעד חלבון ידני (ג׳)', 'targets.carbs': 'יעד פחמימות ידני (ג׳)', 'targets.fat': 'יעד שומן ידני (ג׳)', 'goals.waterMode': 'אופן קביעת יעד המים',
  'auto.kcal': 'יעד קלוריות אוטומטי', 'auto.protein': 'יעד חלבון אוטומטי (ג׳)' };
/* plan change types (Plans / Adapt / meal planner / travel) → who initiated it */
const PLAN_SRC = { adapt: 'הצעת האפליקציה, אישרת', 'adapt-revert': 'ביטלת התאמה של האפליקציה', nutrition: 'עדכון תפריט אחרי שינוי יעדים', travel: 'מצב נסיעה', 'travel-revert': 'מצב נסיעה בוטל' };
const DAY_HE = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
function chVal(path, v) {
  if (path === 'display.lowData' && v == null) return 'לפי הדפדפן';
  if (path === 'places' && v && typeof v === 'object') return Object.keys(v).map(k => ({ home: 'בית', gym: 'חדר כושר', work: 'עבודה', hotel: 'מלון / נסיעה' }[k] || k) + ': ' + ((v[k].equipment || []).length || 'בלי') + ' פריטי ציוד').join(' · ') || '—';
  if (path.startsWith('reminders.') && v && typeof v === 'object') return path === 'reminders.quiet' ? `${v.from}–${v.to}` : (v.on ? 'פעיל' : 'כבוי') + (v.at ? ' · ' + v.at : '') + (v.dow != null ? ' · יום ' + ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'][v.dow] : '');
  if (v == null || (Array.isArray(v) && !v.length) || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'כן' : 'לא';
  const F = (root.NUTRI && root.NUTRI.FOODS) || {}, EQ = (root.CATALOG && root.CATALOG.EQUIPMENT) || {}, G = (root.PROGRAMS && root.PROGRAMS.GOALS) || {}, LV = (root.Planner && root.Planner.LEVEL_HE) || {};
  const one = x => (path === 'availability.days' || path === 'shopDay') ? (DAY_HE[x] || x) : path === 'environment.equipment' ? ((EQ[x] || {}).he || x) : path === 'prefs.exclude' ? ((F[x] || {}).he || C.PREF_HE[x] || x).split(' (')[0]
    : path.startsWith('aims.') ? (G[x] || x) : path === 'experience' ? (LV[x] || x) : path === 'environment.place' ? ({ home: 'בבית', gym: 'חדר כושר', outdoor: 'בחוץ', mixed: 'משולב' }[x] || x)
    : path === 'exercisePrefs.exclude' ? (((root.EX_BY_ID || {})[x] || {}).he || ((root.EX_BY_ID || {})[x] || {}).name || x) : path === 'mode' ? ({ nutrition: 'תזונה בלבד' }[x] || x)
    : path === 'display.tone' ? ({ std: 'רגיל', brief: 'תמציתי', warm: 'מעודד' }[x] || x) : path === 'goals.waterMode' ? ({ manual: 'ידני', auto: 'אוטומטי' }[x] || x) : path === 'units.w' ? ({ kg: 'ק״ג', lb: 'ליברות' }[x] || x) : path === 'display.motion' ? ({ auto: 'רגיל', reduce: 'מופחת' }[x] || x) : String(x);
  if (Array.isArray(v)) return v.map(one).join(', ');
  if (typeof v === 'object') return Object.keys(v).length ? Object.keys(v).map(k => `${one(k)}: ${v[k]}`).join(', ') : '—';
  return one(v);
}
Screens.changes = function () {
  const items = (S.load('changelog').items || []).slice().reverse(), byDay = {};
  const day = at => { const x = new Date(at); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); }; /* local calendar day */
  items.forEach(i => { const d = day(i.at); (byDay[d] = byDay[d] || []).push(i); });
  const tm = at => { const x = new Date(at); return String(x.getHours()).padStart(2, '0') + ':' + String(x.getMinutes()).padStart(2, '0'); };
  const ap = root.Plans && root.Plans.active(), pch = ap ? (ap.changes || []).slice(-60).reverse() : [];
  return { title: 'יומן שינויים בהגדרות', back: '#/settings', html: `
    <section class="card"><p class="small">כל שינוי שנשמר בהגדרות הפרופיל אחרי ההגדרה הראשונה: מתי, מה היה ומה נהיה. נשמר רק במכשיר הזה; לא נשלח ולא מסונכרן.</p>
      <p class="tiny muted">לא נרשמים: גיל, גובה, משקל, מין, שם ותמונה. כמה שינויים באותה הגדרה בתוך 2 דקות נרשמים כשינוי אחד. שורה עם "האפליקציה" היא שינוי שהאפליקציה חישבה בעצמה, עם הסיבה.</p></section>
    ${items.length ? Object.keys(byDay).map(d => `<section class="card" data-ch-day="${d}"><h3>${esc(S.fmtDate(d, true))}</h3><div class="list">${byDay[d].map(i => `<div class="li" data-ch="${esc(i.path)}" data-ch-src="${i.src === 'app' ? 'app' : 'user'}"><div class="grow"><div class="t">${esc(CH_HE[i.path] || i.path)}${i.src === 'app' ? ' <span class="pill" data-ch-app>האפליקציה</span>' : ''}</div><div class="s"><span data-ch-from>${esc(chVal(i.path, i.from))}</span> ← <span data-ch-to>${esc(chVal(i.path, i.to))}</span></div>${i.why ? `<div class="tiny muted" data-ch-why>${esc(i.why)}</div>` : ''}</div><span class="tiny muted">${tm(i.at)}</span></div>`).join('')}</div></section>`).join('')
      + '<div class="btns"><button class="btn ghost" data-act="chClear">מחיקת היומן</button></div><p class="tiny faint">המחיקה מוחקת רק את היומן, לא אף הגדרה.</p>'
      : '<div class="empty" data-ch-empty>עוד לא נשמרו שינויים בהגדרות.</div>'}
    ${pch.length ? `<section class="card" data-plan-changes><h3>שינויים בתוכנית "${esc(((root.PROGRAMS && root.PROGRAMS.byId(ap.templateId)) || {}).he || 'התוכנית הפעילה')}"</h3><div class="list">${pch.map(c => `<div class="li" data-pch="${esc(c.type || '')}"><div class="grow"><div class="t">${esc(c.text || '')}</div><div class="s">${esc(PLAN_SRC[c.type] || 'שינוי שלך')}</div></div><span class="tiny muted">${c.date ? esc(S.fmtShort(c.date)) : ''}</span></div>`).join('')}</div><p class="tiny faint">היסטוריית התוכנית לא נמחקת; ביטול התאמה נעשה ב<a href="#/plan">מסך התוכנית</a>.</p></section>` : ''}`,
    handlers: { chClear: () => { const cl = S.load('changelog'), keep = JSON.stringify(cl.items || []); cl.items = []; S.save('changelog'); root.App.render();
      root.UI.toast('היומן נמחק', 0, { label: 'ביטול', fn: () => { S.load('changelog').items = JSON.parse(keep); S.save('changelog'); root.App.render(); } }); } } };
};
/* SLL-25 · #/reset — One-Tap Weekly Reset. One screen that previews EXACTLY what a fresh start for the week would change, using
   only existing actions; the user ticks what to include and confirms once; "ביטול" restores the shopping list and the plan exactly.
     marks  — clear the shopping-list marks (bought / at home / not found / buy this time). "פריטים שלי", "בדרך כלל בבית" and the
              carry-over offers stay. Pre-ticked: it changes no plan and no meal.
     cdone  — remove "פריטים שלי" already marked bought. NOT pre-ticked (the user's own items are removed only by explicit choice).
     menu   — the active plan's menu has a pending update (targets or preferences changed): apply it from the first open day, with
              the same before/after averages the nutrition screen shows. NOT pre-ticked (it changes upcoming meals).
   Past workouts are never changed here (history is never rewritten); missed sessions and pending adjustments are shown as links
   to the plan screen, where moving or skipping stays a separate choice. Nothing to reset → the screen says so. */
function resetItems() {
  const nu = S.load('nutrition'), sh = nu.shopping || {}, ap = root.Plans && root.Plans.active(), out = [], info = [];
  const marks = Object.keys(sh.checked || {}).length + Object.keys(sh.state || {}).length;
  if (marks) out.push({ k: 'marks', def: true, he: 'ניקוי סימוני רשימת הקניות', s: `${marks === 1 ? 'סימון אחד' : marks + ' סימונים'} (נקנה / יש בבית / לא נמצא / צריך לקנות הפעם) יימחקו. "פריטים שלי" ו"בדרך כלל בבית" נשארים.` });
  const cd = (sh.custom || []).filter(c => c.done);
  if (cd.length) out.push({ k: 'cdone', def: false, he: 'הסרת "פריטים שלי" שכבר נקנו', s: cd.map(c => c.text).join(', ') });
  if (ap && root.MealPlan && root.MealPlan.pending(ap)) { const pv = root.MealPlan.previewChange(ap);
    out.push({ k: 'menu', def: false, he: 'עדכון התפריט לפי היעדים וההעדפות הנוכחיים', s: `מ־${S.fmtDate(pv.fromDate)}. ממוצע ל־14 ימים: ${pv.before.kcal} → ${pv.after.kcal} קק״ל, ${pv.before.protein} → ${pv.after.protein} ג׳ חלבון. ארוחות שכבר נאכלו לא משתנות.` }); }
  if (ap) { const t = S.today(), miss = root.Plans.days(ap).filter(d => d.status === 'missed' && !d.log && d.date >= S.addDays(t, -7) && d.date < t).length;
    if (miss) info.push(`<a href="#/plan" data-reset-info="missed">${miss === 1 ? 'אימון אחד' : miss + ' אימונים'} מהשבוע האחרון לא בוצעו — להעביר או לדלג במסך התוכנית</a>`);
    const pr = root.Adapt ? (root.Adapt.proposals(ap).list || []).length : 0; if (pr) info.push(`<a href="#/plan" data-reset-info="adapt">${pr === 1 ? 'הצעת התאמה אחת' : pr + ' הצעות התאמה'} לתוכנית מחכות לאישור</a>`); }
  return { items: out, info };
}
function resetApply(keys) {
  const before = { nutrition: JSON.stringify(S.load('nutrition')), plans: JSON.stringify(S.load('plans')) }, done = [];
  const nu = S.load('nutrition'); nu.shopping = nu.shopping || { checked: {} };
  if (keys.includes('marks')) { nu.shopping.checked = {}; nu.shopping.state = {}; done.push('marks'); }
  if (keys.includes('cdone')) { nu.shopping.custom = (nu.shopping.custom || []).filter(c => !c.done); done.push('cdone'); }
  if (done.length) S.save('nutrition');
  if (keys.includes('menu')) { const ap = root.Plans && root.Plans.active(); if (ap && root.MealPlan.pending(ap)) { root.MealPlan.applyChange(ap, 'איפוס שבועי'); done.push('menu'); } }
  const back = (name, json) => { const cur = S.load(name); Object.keys(cur).forEach(k => delete cur[k]); Object.assign(cur, JSON.parse(json)); S.save(name); };
  return { done, undo: () => { /* restore only what this reset changed, so an untouched store is not rewritten */
    if (done.includes('marks') || done.includes('cdone')) back('nutrition', before.nutrition); if (done.includes('menu')) back('plans', before.plans); } };
}
Screens.reset = function () {
  const R = resetItems();
  return { title: 'איפוס שבועי', back: '#/review', html: `
    <section class="card"><p class="small">התחלה נקייה לשבוע: מסמנים מה לכלול, רואים בדיוק מה ישתנה, ומאשרים פעם אחת. אפשר לבטל מיד אחרי.</p><p class="tiny muted">אימונים שכבר עברו לא משתנים כאן — ההיסטוריה לא נמחקת.</p></section>
    ${R.items.length ? `<section class="card" data-reset-list><h3>מה ישתנה</h3><div class="list">${R.items.map(x => `<label class="li" data-reset="${x.k}"><input type="checkbox" data-reset-k="${x.k}" ${x.def ? 'checked' : ''}><div class="grow"><div class="t">${esc(x.he)}</div><div class="s">${esc(x.s)}</div></div></label>`).join('')}</div>
      <div class="btns"><button class="btn primary" data-act="resetGo">איפוס</button></div></section>` : '<div class="empty" data-reset-empty>אין מה לאפס השבוע — הכול מסודר.</div>'}
    ${R.info.length ? `<section class="card" data-reset-infos><h3>שווה להציץ</h3><ul class="bul small">${R.info.map(x => `<li>${x}</li>`).join('')}</ul></section>` : ''}`,
    handlers: { resetGo: () => { const keys = [...document.querySelectorAll('[data-reset-k]:checked')].map(x => x.dataset.resetK); if (!keys.length) { root.UI.toast('לא סומן אף פריט'); return; }
      const r = resetApply(keys); root.App.render(); root.UI.toast(`בוצע: ${r.done.length} ${r.done.length === 1 ? 'פעולה' : 'פעולות'}`, 0, { label: 'ביטול', fn: () => { r.undo(); root.App.render(); } }); } } };
};
Screens.reset.items = resetItems; Screens.reset.apply = resetApply;
/* SLL-40 · #/presets — Preference presets. Each preset sets ONLY existing settings, shows current → new before applying, and
   one "ביטול" restores the profile exactly. Every changed setting is also recorded in the change log (SLL-42, as the user's own).
   Equipment you own is never changed by a preset. The workout plan and the menu do NOT change here: if the profile now differs
   from the active plan, the screen links to the existing "update by profile" flow on the plan screen (preview + approval), and a
   changed prep-time limit becomes the existing pending menu update. Values are defaults chosen for this release (documented in
   docs/OVERNIGHT_LOG.md); they are plain settings, so the user can fine-tune any of them afterwards in Settings / Profile. */
const PRESETS = [
  { k: 'workday', he: 'יום עבודה', s: 'אימון עד 30 דקות, מנות עד 20 דקות הכנה.', set: { 'availability.maxMin': 30, 'prefs.maxPrep': 20 } },
  { k: 'weekend', he: 'סוף שבוע', s: 'יותר זמן: אימון עד 45 דקות, בלי הגבלת זמן הכנה.', set: { 'availability.maxMin': 45, 'prefs.maxPrep': null } },
  { k: 'nocook', he: 'בלי בישול', s: 'מנות מהירות בלבד: עד 15 דקות הכנה ובישול.', set: { 'prefs.maxPrep': 15 } },
  { k: 'quiet', he: 'שקט (שכנים, ילדים ישנים)', s: 'בלי תרגילי קפיצה.', set: { 'exercisePrefs.noJump': true } },
  { k: 'hotel', he: 'חדר במלון', s: 'אימון קצר ושקט: עד 30 דקות, בלי קפיצות. לנסיעה של כמה ימים יש גם מצב נסיעה.', set: { 'availability.maxMin': 30, 'exercisePrefs.noJump': true }, link: ['#/travel', 'למצב נסיעה'] }];
const pGet = (o, p) => p.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
const pSet = (o, p, v) => { const ks = p.split('.'), last = ks.pop(); const t = ks.reduce((a, k) => (a[k] = a[k] && typeof a[k] === 'object' ? a[k] : {}), o); t[last] = v; };
function presetDiff(k) { const pr = PRESETS.find(x => x.k === k), prof = S.load('profile'); if (!pr) return [];
  return Object.keys(pr.set).map(path => { const from = pGet(prof, path); return { path, from: from === undefined ? null : from, to: pr.set[path] }; }).filter(x => JSON.stringify(x.from) !== JSON.stringify(x.to)); }
function presetApply(k) { const d = presetDiff(k); if (!d.length) return { n: 0 }; const before = JSON.stringify(S.load('profile')), prof = S.load('profile');
  d.forEach(x => pSet(prof, x.path, x.to)); S.save('profile');
  return { n: d.length, undo: () => { const cur = S.load('profile'); Object.keys(cur).forEach(q => delete cur[q]); Object.assign(cur, JSON.parse(before)); S.save('profile'); } }; }
CH_HE['prefs.maxPrep'] = 'זמן הכנה מרבי למנה (דק׳)'; CH_HE['prefs.budget'] = 'מצב חיסכון (מנות זולות)'; CH_HE.places = 'ציוד לפי מקום'; CH_HE['patterns.consent'] = 'חיפוש דפוסים אישיים'; CH_HE['display.tone'] = 'סגנון המאמנת';
Object.assign(CH_HE, { shopDay: 'יום קניות קבוע', 'reminders.on': 'תזכורות בתוך האפליקציה', 'reminders.workout': 'תזכורת אימון', 'reminders.meals': 'תזכורת ארוחות', 'reminders.water': 'תזכורת מים', 'reminders.weigh': 'תזכורת שקילה', 'reminders.quiet': 'שעות שקט' });
/* SLL-17 · Equipment Passport: the equipment you have, saved per place (profile.places = { home|gym|work|hotel: { equipment, place } }).
   "שמירת הציוד הנוכחי כ…" stores the current profile equipment under a place; "מעבר ל…" shows current → new and applies that place's
   equipment to the profile (one undo). The plan is NOT rebuilt here — the existing preview-and-approve update on the plan screen does
   that, exactly as for presets. A place that was never saved cannot be switched to (nothing is assumed about what it has). */
const PLACES = [['home', 'בית'], ['gym', 'חדר כושר'], ['work', 'עבודה'], ['hotel', 'מלון / נסיעה']];
const eqName = k => ((root.CATALOG && root.CATALOG.EQUIPMENT[k]) || {}).he || k;
function passportCard() { const pr = S.load('profile'), pl = pr.places || {}, cur = (pr.environment || {}).equipment || [], same = a => JSON.stringify((a || []).slice().sort()) === JSON.stringify(cur.slice().sort());
  return `<section class="card" data-passport><h3>הציוד לפי מקום</h3><p class="small muted">שומרים את הציוד שיש בכל מקום, ומחליפים בלחיצה. הציוד הנוכחי בפרופיל: ${cur.length ? cur.map(k => esc(eqName(k))).join(', ') : 'בלי ציוד'}.</p>
    <div class="list">${PLACES.map(([k, he]) => { const x = pl[k]; return `<div class="li" data-place="${k}"><div class="grow"><div class="t">${he}${x && same(x.equipment) ? ' <span class="pill good">נוכחי</span>' : ''}</div><div class="s">${x ? (x.equipment.length ? x.equipment.map(e => esc(eqName(e))).join(', ') : 'בלי ציוד') : 'עוד לא נשמר'}</div></div>
      <button class="btn sm ghost" data-act="plSave" data-k="${k}">${x ? 'עדכון מהנוכחי' : 'שמירת הנוכחי'}</button>${x && !same(x.equipment) ? `<button class="btn sm" data-act="plGo" data-k="${k}">מעבר</button>` : ''}</div>`; }).join('')}</div>
    <p class="tiny faint">המעבר משנה רק את הציוד בפרופיל. התוכנית מתעדכנת רק אחרי שתאשרו במסך התוכנית.</p></section>`; }
Screens.presets = function () {
  const ap = root.Plans && root.Plans.active(), planDiff = ap && root.Plans.profileDiff ? (root.Plans.profileDiff(ap.id) || []) : [];
  const menuPending = !!(ap && root.MealPlan && root.MealPlan.pending(ap));
  return { title: 'ערכות העדפות', back: '#/settings', html: `
    <section class="card"><p class="small">קיצור לכמה הגדרות יחד, לפי המצב שלך. רואים מה ישתנה לפני ההחלה, ואפשר לבטל מיד. הציוד שיש לך לא משתנה.</p></section>
    ${(planDiff.length || menuPending) ? `<div class="banner info small" data-presets-plan>${icon('info')}<div>${planDiff.length ? 'הפרופיל שונה מהתוכנית הפעילה. התוכנית לא מתעדכנת לבד — <a href="#/plan">במסך התוכנית</a> אפשר לראות מה ישתנה ולאשר.' : ''}${menuPending ? ' יש עדכון תפריט שמחכה לאישור (בתזונה או ב<a href="#/reset">איפוס השבועי</a>).' : ''}</div></div>` : ''}
    ${passportCard()}
    ${PRESETS.map(pr => { const d = presetDiff(pr.k); return `<section class="card" data-preset="${pr.k}"><div class="card-h"><h3>${esc(pr.he)}</h3>${d.length ? `<button class="btn sm primary" data-act="presetGo" data-k="${pr.k}">החלה</button>` : '<span class="pill" data-preset-same>כבר מוגדר כך</span>'}</div>
      <p class="small muted">${esc(pr.s)}</p>${d.length ? `<ul class="bul small" data-preset-diff>${d.map(x => `<li data-preset-row="${esc(x.path)}">${esc(CH_HE[x.path] || x.path)}: ${esc(chVal(x.path, x.from))} ← ${esc(chVal(x.path, x.to))}</li>`).join('')}</ul>` : ''}${pr.link ? `<p class="tiny"><a href="${pr.link[0]}">${esc(pr.link[1])}</a></p>` : ''}</section>`; }).join('')}`,
    handlers: { plSave: el => { const pr = S.load('profile'); pr.places = Object.assign({}, pr.places || {}, { [el.dataset.k]: { equipment: ((pr.environment || {}).equipment || []).slice(), place: (pr.environment || {}).place || null, at: S.today() } }); S.save('profile'); root.App.render(); root.UI.toast('נשמר'); },
      plGo: el => { const pr = S.load('profile'), x = (pr.places || {})[el.dataset.k]; if (!x) return; const before = JSON.stringify(pr), from = ((pr.environment || {}).equipment || []).map(eqName).join(', ') || 'בלי ציוד';
        pr.environment = Object.assign({}, pr.environment || {}, { equipment: x.equipment.slice() }); S.save('profile'); root.App.render();
        root.UI.toast(`הציוד עודכן (${from} ← ${x.equipment.map(eqName).join(', ') || 'בלי ציוד'})`, 0, { label: 'ביטול', fn: () => { const cur = S.load('profile'); Object.keys(cur).forEach(q => delete cur[q]); Object.assign(cur, JSON.parse(before)); S.save('profile'); root.App.render(); } }); },
      presetGo: el => { const pr = PRESETS.find(x => x.k === el.dataset.k), r = presetApply(el.dataset.k); root.App.render();
      if (r.n) root.UI.toast(`"${pr.he}": ${r.n === 1 ? 'הגדרה אחת עודכנה' : r.n + ' הגדרות עודכנו'}`, 0, { label: 'ביטול', fn: () => { r.undo(); root.App.render(); } }); } } };
};
Screens.presets.list = PRESETS; Screens.presets.diff = presetDiff; Screens.presets.apply = presetApply;
/* SLL-13 · #/today — One-Day Autopilot. Three proposals for TODAY built only from what is already planned:
     מינימום → the workout in the "min" version (SLL-02) · מאוזן → the regular version · מלא → the long version (when the day has one)
   plus, identical in all three and never changed here, today's planned meals, the water target and the step target.
   Choosing a level changes ONLY today's workout version — a personal plan through Plans.setVersion (the day's override), the 30-day
   program through today's stored choice (tracking.daily.dayVer, used by the home start button) — and can be undone. "לא היום"
   hides the proposal for today. Test / recovery days keep their workout as it is. */
const AP_LV = { min: { he: 'מינימום', v: 'min', s: 'כמה דקות שומרות על הרגל. נרשם כ"בוצע חלקית".' }, bal: { he: 'מאוזן', v: 'std', s: 'האימון כפי שתוכנן.' }, full: { he: 'מלא', v: 'long', s: 'יותר זמן ונפח, כשיש כוח וזמן.' } };
function apModel(date) {
  date = date || S.today(); const ap = root.Plans && root.Plans.active(), out = { date, workout: null, meals: [], kcal: 0, water: C.waterGoalOn(date).ml, steps: (C.profile().goals || {}).steps || null };
  if (ap) { const d = (root.Plans.days(ap) || []).find(x => (x.movedTo || x.date) === date && root.Plans.isTraining(x) && x.status !== 'skipped' && !x.log);
    if (d) { const fixed = ['assess', 'active'].includes(d.type), base = Object.assign({}, ap, { overrides: Object.assign({}, ap.overrides, { [d.n]: Object.assign({}, ap.overrides[d.n] || {}, { version: undefined }) }) }), raw = root.Plans.days(base).find(z => z.n === d.n);
      out.workout = { kind: 'plan', id: ap.id, n: d.n, title: d.title || ('יום ' + d.n), fixed, cur: d.version || 'std', min: Object.fromEntries(Object.entries(AP_LV).map(([k, L0]) => [k, fixed ? Math.round(raw.minutes || 0) : Math.round(root.Planner.versioned(raw, L0.v).minutes || 0)])) }; } }
  else if (!C.nutritionOnly()) { const n = C.programDay(date); if (n >= 1 && n <= 30 && C.isTraining(n) && C.status(n) !== 'done') { const d = C.dayDef(n), hv = root.Logic.hasVersions(d);
      out.workout = { kind: 'prog', n, title: d.title, fixed: !hv, cur: C.daily(date).dayVer || 'std', min: Object.fromEntries(Object.entries(AP_LV).map(([k, L0]) => [k, root.Logic.estimateMinutes(d, hv ? L0.v : 'std')])) }; } }
  const pl = C.plan(date); C.DAY.forEach(k => { const s = pl[k]; if (s && s.rid && !s.off && !s.missing) { const r = root.Logic.recipe(s.rid); if (r) { const m = root.Logic.recipeMacros(r, s.scale, s.ov); out.meals.push({ k, he: r.he, kcal: Math.round(m.k), eaten: !!C.slotEntry(date, k) }); out.kcal += Math.round(m.k); } } });
  return out;
}
function apApply(level, date) {
  date = date || S.today(); const m = apModel(date), w = m.workout, before = { daily: JSON.stringify(C.daily(date)), plans: JSON.stringify(S.load('plans')) };
  if (w && !w.fixed) { if (w.kind === 'plan') root.Plans.setVersion(w.id, w.n, AP_LV[level].v); else C.setDaily(date, { dayVer: AP_LV[level].v }); }
  C.setDaily(date, { autopilot: { level, at: new Date().toISOString() } }); if (root.Screens.selectedVersion) root.Screens.selectedVersion._v = null;
  return { undo: () => { const t = S.load('tracking'); t.daily[date] = JSON.parse(before.daily); S.save('tracking'); if (w && w.kind === 'plan') { const cur = S.load('plans'); Object.keys(cur).forEach(k => delete cur[k]); Object.assign(cur, JSON.parse(before.plans)); S.save('plans'); } if (root.Screens.selectedVersion) root.Screens.selectedVersion._v = null; } };
}
Screens.today = function () {
  const m = apModel(), w = m.workout, chosen = (C.daily(m.date).autopilot || {}).level;
  const dayHref = w ? (w.kind === 'plan' ? '#/pday/' + w.n : '#/day/' + w.n) : null;
  return { title: 'היום שלי', back: '#/', html: `
    <section class="card"><p class="small">שלוש הצעות ליום, מתוך מה שכבר מתוכנן. בוחרים אחת — היא משנה רק את גרסת האימון של היום, ואפשר לבטל. התפריט, המים והצעדים לא משתנים כאן.</p></section>
    ${w ? Object.entries(AP_LV).map(([k, L0]) => `<section class="card" data-ap="${k}"${chosen === k ? ' data-ap-chosen' : ''}><div class="card-h"><h3>${esc(L0.he)}${chosen === k ? ' <span class="pill good">נבחר</span>' : ''}</h3>${chosen === k ? '' : `<button class="btn sm primary" data-act="apGo" data-l="${k}">לבחור</button>`}</div>
      <p class="small"><b>אימון:</b> ${esc(w.title)} — ${w.fixed ? `כפי שתוכנן (~${w.min.bal} דק׳; לימי מבחן והתאוששות אין גרסאות)` : `~${w.min[k]} דק׳`}</p><p class="tiny muted">${esc(L0.s)}</p></section>`).join('')
      : '<div class="empty" data-ap-noworkout>אין היום אימון פתוח — ההצעה כוללת רק את התפריט והיעדים.</div>'}
    <section class="card" data-ap-same><h3>זהה בכל ההצעות</h3><ul class="bul small"><li>ארוחות מתוכננות: ${m.meals.length ? m.meals.map(x => esc(x.he) + (x.eaten ? ' ✓' : '')).join(' · ') + ` (כ־${m.kcal} קק״ל)` : 'אין'} ${root.UI.srcTag('est')}</li><li>מים: ${C.fmtL(m.water)} ליטר</li>${m.steps ? `<li>צעדים: ${Number(m.steps).toLocaleString('he-IL')}</li>` : ''}</ul></section>
    <div class="btns">${dayHref ? `<a class="btn" href="${dayHref}">לאימון של היום</a>` : ''}<button class="btn ghost" data-act="apNo">לא היום</button></div>`,
    handlers: { apGo: el => { try { const r = apApply(el.dataset.l); root.App.render(); root.UI.toast(`נבחר: ${AP_LV[el.dataset.l].he}`, 0, { label: 'ביטול', fn: () => { r.undo(); root.App.render(); } }); } catch (e) { root.UI.toast(e.message); } },
      apNo: () => { C.setDaily(S.today(), { autopilot: { rejected: true, at: new Date().toISOString() } }); location.hash = '#/'; } } };
};
Screens.today.model = apModel; Screens.today.apply = apApply;
/* SLL-06 · Personal Pattern Finder + SLL-11 · Ripple Effect — #/patterns. OFF until the user turns it on (profile.patterns.consent);
   computed on this device from the last 56 completed days, nothing stored but the switch. Each pattern compares workout completion
   (done 1, partial ½) between two groups of days and shows both groups' sizes:
     sleep — days after a logged night with sleep ≥ the goal vs. a logged night below it
     water — days with water at the day's goal vs. logged below it
   Fewer than 5 days in a group → "not enough data" (no numbers drawn as a conclusion). A difference counts as clear only with ≥8 days
   in each group AND ≥20 points; otherwise "no clear difference". Every pattern says it is a correlation, not proof of a cause.
   SLL-11: a clear pattern offers ONE constructive next step — an existing feature (a reminder, or a 14-day experiment to check it). */
const PAT_MIN = 5, PAT_CLEAR_N = 8, PAT_CLEAR_D = 20;
function patterns(date) {
  date = date || S.today(); const days = []; for (let i = 1; i <= 56; i++) days.push(S.addDays(date, -i));
  const g = C.profile().goals || {}, wv = d => { const w = (C.dailyProgress(d).tasks || []).find(x => x.k === 'workout'); return w ? (w.v >= 1 ? 1 : w.v > 0 ? 0.5 : 0) : null; };
  const cmp = (k, he, aHe, bHe, inA, inB, step) => { const A = [], B = []; days.forEach(d => { const v = wv(d); if (v == null) return; if (inA(d)) A.push(v); else if (inB(d)) B.push(v); });
    const pc = a => a.length ? Math.round(a.reduce((s, x) => s + x, 0) / a.length * 100) : null, a = pc(A), b = pc(B);
    const enough = A.length >= PAT_MIN && B.length >= PAT_MIN, clear = enough && A.length >= PAT_CLEAR_N && B.length >= PAT_CLEAR_N && Math.abs(a - b) >= PAT_CLEAR_D;
    return { k, he, aHe, bHe, nA: A.length, nB: B.length, a, b, enough, clear, step: clear && a > b ? step : null }; };
  const sleepGoal = g.sleep || 7.5;
  return [
    cmp('sleep', 'שינה ואימונים', `אחרי לילה של ${sleepGoal}+ שעות`, `אחרי לילה קצר יותר`, d => C.daily(d).sleep >= sleepGoal, d => C.daily(d).sleep > 0 && C.daily(d).sleep < sleepGoal,
      { he: 'אפשר לבדוק את זה בניסוי של 14 יום: לכוון לשינה של ' + sleepGoal + '+ שעות ולראות אם ההשלמה משתנה.', href: '#/experiments', act: 'לניסוי' }),
    cmp('water', 'מים ואימונים', 'בימים שהגעת ליעד המים', 'בימים שנרשמו פחות מים', d => (C.daily(d).water || 0) >= C.waterGoalOn(d).ml && C.daily(d).water > 0, d => C.daily(d).water > 0 && C.daily(d).water < C.waterGoalOn(d).ml,
      { he: 'תזכורת מים בתוך האפליקציה מופיעה רק כשמאחורי הקצב — אפשר להפעיל ולבדוק.', href: '#/settings', act: 'לתזכורות' }) ];
}
Screens.patterns = function () {
  const on = !!((C.profile().patterns || {}).consent), list = on ? patterns() : [];
  return { title: 'דפוסים אישיים', back: '#/progress', html: `
    <section class="card" data-pat-consent><p class="small">האפליקציה יכולה לחפש קשרים בין הרגלים לבין השלמת האימונים — מתוך מה שרשמת ב־56 הימים האחרונים. החישוב נעשה רק במכשיר הזה, לא נשמר ולא נשלח. ${on ? '' : '<b>כבוי.</b>'}</p>
      <label class="switch"><span>חיפוש דפוסים</span><input type="checkbox" id="pat-on" data-act="patOn" ${on ? 'checked' : ''}></label></section>
    ${on ? list.map(x => `<section class="card" data-pat="${x.k}" data-pat-state="${x.clear ? 'clear' : x.enough ? 'unclear' : 'little'}"><h3>${esc(x.he)} ${root.UI.srcTag('calc')}</h3>
      ${x.enough ? `<ul class="bul small"><li>${esc(x.aHe)}: השלמת <b>${x.a}%</b> מהאימונים (${x.nA} ימים)</li><li>${esc(x.bHe)}: <b>${x.b}%</b> (${x.nB} ימים)</li></ul>
        <p class="small">${x.clear ? `<b>הבדל ברור</b> של ${Math.abs(x.a - x.b)} נקודות.` : `<b>אין הבדל ברור</b>${x.nA < PAT_CLEAR_N || x.nB < PAT_CLEAR_N ? ' — המדגם עוד קטן, ייתכן שזה מקרי' : ''}.`} זה <b>מתאם, לא הוכחה</b> שאחד גורם לשני.</p>
        ${x.step ? `<div class="banner info small" data-pat-step>${icon('info')}<div>${esc(x.step.he)} <a href="${x.step.href}">${esc(x.step.act)}</a></div></div>` : ''}`
      : `<p class="small muted" data-pat-little>עוד אין מספיק נתונים: ${x.nA} ו־${x.nB} ימים (צריך לפחות ${PAT_MIN} בכל קבוצה).</p>`}</section>`).join('') : ''}`,
    handlers: { patOn: el => { const pr = S.load('profile'); pr.patterns = Object.assign({}, pr.patterns || {}, { consent: el.checked, at: S.today() }); S.save('profile'); root.App.render(); } } };
};
Screens.patterns.compute = patterns;
/* SLL-29 · User-Controlled Experiments — #/experiments. The user chooses ONE change and a duration (7 / 14 days); one at a time.
   The app never changes anything by itself: it only counts how often the change happened (adherence, from the log) and compares workout
   completion during the experiment with the same number of days just before it, both with their sample sizes and the correlation note.
   It ends when the period is over or when the user ends it; the user then decides — keep the change, stop, or run it again — and the
   decision is kept in the history. Stored in profile.experiments = { current, history[] }. */
const EXP_CH = { sleep: { he: 'לישון לפחות לפי יעד השינה', ok: (d, g) => C.daily(d).sleep >= (g.sleep || 7.5), has: d => C.daily(d).sleep > 0 },
  water: { he: 'להגיע ליעד המים', ok: d => (C.daily(d).water || 0) >= C.waterGoalOn(d).ml, has: d => C.daily(d).water > 0 },
  meals: { he: 'לסמן כל יום את הארוחות ביומן', ok: d => C.entries(d).length > 0, has: () => true } };
function expEval(x, today) {
  today = today || S.today(); const g = C.profile().goals || {}, ch = EXP_CH[x.change], end = S.addDays(x.start, x.days - 1), last = end < today ? end : S.addDays(today, -1);
  const span = (a, b) => { const o = []; for (let d = a; d <= b; d = S.addDays(d, 1)) o.push(d); return o; };
  const during = last >= x.start ? span(x.start, last) : [], before = span(S.addDays(x.start, -x.days), S.addDays(x.start, -1));
  const comp = ds => { const v = ds.map(d => (C.dailyProgress(d).tasks || []).find(t => t.k === 'workout')).filter(Boolean).map(w => w.v >= 1 ? 1 : w.v > 0 ? 0.5 : 0); return { n: v.length, p: v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length * 100) : null }; };
  const logged = during.filter(ch.has); return { day: Math.min(x.days, S.diffDays(x.start, today) + 1), over: end < today, end, adh: { n: logged.length, ok: logged.filter(d => ch.ok(d, g)).length }, now: comp(during), base: comp(before) };
}
Screens.experiments = function () {
  const pr = S.load('profile'), E = pr.experiments || { current: null, history: [] }, x = E.current, ev = x ? expEval(x) : null;
  return { title: 'ניסויים אישיים', back: '#/progress', html: `
    <section class="card"><p class="small">בוחרים שינוי אחד לתקופה קצרה ובודקים מה קורה. האפליקציה רק סופרת מתוך מה שנרשם — היא לא משנה שום דבר בעצמה, ובסוף ההחלטה שלך.</p></section>
    ${x ? `<section class="card" data-exp-current="${x.change}"><h3>${esc(EXP_CH[x.change].he)}</h3><p class="small">יום ${ev.day} מתוך ${x.days} · מ־${esc(S.fmtShort(x.start))} עד ${esc(S.fmtShort(ev.end))}</p>
      <ul class="bul small"><li data-exp-adh>השינוי קרה ב־${ev.adh.ok} מתוך ${ev.adh.n} ימים עם רישום</li>
      <li data-exp-cmp>השלמת אימונים: ${ev.now.p != null ? ev.now.p + '%' : '—'} עכשיו (${ev.now.n} אימונים) לעומת ${ev.base.p != null ? ev.base.p + '%' : '—'} ב־${x.days} הימים שלפני (${ev.base.n} אימונים)</li></ul>
      <p class="tiny muted">${ev.now.n < 5 || ev.base.n < 5 ? 'מדגם קטן — קשה להסיק. ' : ''}גם הבדל ברור הוא מתאם, לא הוכחה שהשינוי גרם לו.</p>
      ${ev.over ? `<div class="banner info small" data-exp-over>${icon('info')}<div><b>הניסוי הסתיים.</b> מה עכשיו?</div></div><div class="btns"><button class="btn sm primary" data-act="expEnd" data-d="keep">להמשיך עם השינוי</button><button class="btn sm" data-act="expEnd" data-d="stop">להפסיק</button><button class="btn sm ghost" data-act="expEnd" data-d="again">לנסות שוב</button></div>`
        : '<div class="btns"><button class="btn sm ghost" data-act="expEnd" data-d="early">לסיים עכשיו</button></div>'}</section>`
    : `<section class="card" data-exp-new><h3>ניסוי חדש</h3><label class="field">השינוי<select id="exp-ch">${Object.entries(EXP_CH).map(([k, v]) => `<option value="${k}">${esc(v.he)}</option>`).join('')}</select></label>
      <label class="field">משך<select id="exp-days"><option value="7">7 ימים</option><option value="14" selected>14 ימים</option></select></label><button class="btn primary" data-act="expGo">התחלה</button></section>`}
    ${(E.history || []).length ? `<section class="card" data-exp-history><h3>ניסויים קודמים</h3><ul class="bul small">${E.history.slice().reverse().map(h => `<li>${esc(EXP_CH[h.change].he)} · ${h.days} ימים מ־${esc(S.fmtShort(h.start))} · השלמה ${h.now != null ? h.now + '%' : '—'} לעומת ${h.base != null ? h.base + '%' : '—'} · ההחלטה: ${({ keep: 'להמשיך', stop: 'להפסיק', again: 'לנסות שוב', early: 'הסתיים מוקדם' })[h.decision]}</li>`).join('')}</ul></section>` : ''}`,
    handlers: {
      expGo: () => { const p = S.load('profile'), e = p.experiments = p.experiments || { current: null, history: [] }; if (e.current) return; e.current = { id: 'x' + Date.now().toString(36), change: document.getElementById('exp-ch').value, days: +document.getElementById('exp-days').value === 7 ? 7 : 14, start: S.today() }; S.save('profile'); root.App.render(); },
      expEnd: el => { const p = S.load('profile'), e = p.experiments; if (!e || !e.current) return; const v = expEval(e.current);
        e.history = (e.history || []).concat(Object.assign({}, e.current, { ended: S.today(), decision: el.dataset.d, now: v.now.p, base: v.base.p, adh: v.adh }));
        e.current = el.dataset.d === 'again' ? Object.assign({}, e.current, { id: 'x' + Date.now().toString(36), start: S.today() }) : null; S.save('profile'); root.App.render(); } } };
};
Screens.experiments.eval = expEval;
/* moved from core.js on 26.10.2026 to keep the first load under its budget (820 KB): only the tracking screen uses these */
/* SLL-12 · Friction Radar: repeated obstacles found in what was logged, ONE suggestion at a time, each with its numbers and a
   link to the existing setting; nothing changes automatically. Each rule needs a minimum amount of data:
     weekday — last 28 days of the active plan: a weekday with ≥2 missed sessions that are ≥50% of that weekday's past sessions
     slot    — last 14 days, counting only days with at least one marked meal: a planned meal left unmarked on ≥8 of them
     water   — last 7 days with water logged: under half the day's goal on ≥5 of them, while the water reminder is off
   "לא רלוונטי" hides that suggestion for 30 days (meta.frictionOff, this device only). Deterministic for a given log and date. */
C.friction = date => {
  date = date || S.today(); const out = [], off = (S.load('meta').frictionOff) || {}, fresh = k => !(off[k] && S.diffDays(off[k], date) < 30);
  const DOW = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  const ap = root.Plans && root.Plans.active();
  if (ap) { const by = {}; root.Plans.days(ap).filter(d => root.Plans.isTraining(d) && d.date < date && d.date >= S.addDays(date, -28) && d.status !== 'skipped').forEach(d => { const w = new Date(d.date + 'T12:00:00').getDay(); const o = by[w] = by[w] || { n: 0, miss: 0 }; o.n++; if (d.status === 'missed') o.miss++; });
    const w = Object.keys(by).filter(k => by[k].miss >= 2 && by[k].miss / by[k].n >= 0.5).sort((a, b) => by[b].miss - by[a].miss)[0];
    if (w != null) out.push({ k: 'weekday:' + w, he: `בימי ${DOW[w]} פספסת ${by[w].miss} מתוך ${by[w].n} אימונים בארבעת השבועות האחרונים.`, sug: 'אולי יום אחר מתאים יותר לאימון הזה? אפשר לשנות את ימי האימון בתוכנית.', href: '#/plan', act: 'לשינוי הימים' }); }
  { const days = []; for (let i = 1; i <= 14; i++) days.push(S.addDays(date, -i)); const logged = days.filter(d => C.entries(d).length);
    if (logged.length >= 8) { const miss = {}; logged.forEach(d => { const pl = C.plan(d); C.DAY.forEach(k => { if (pl[k] && pl[k].rid && !pl[k].off && !C.slotEntry(d, k)) miss[k] = (miss[k] || 0) + 1; }); });
      const k = Object.keys(miss).filter(x => miss[x] >= 8).sort((a, b) => miss[b] - miss[a])[0];
      if (k) out.push({ k: 'slot:' + k, he: `את ה${C.slotNames[k]} לא סימנת ב־${miss[k]} מתוך ${logged.length} הימים שבהם רשמת ארוחות.`, sug: 'אם היא לא מתאימה ליום שלך, אפשר לבחור פחות ארוחות ביום — התפריט יתעדכן רק באישור.', href: '#/settings', act: 'להגדרת הארוחות' }); } }
  { const days = []; for (let i = 1; i <= 7; i++) days.push(S.addDays(date, -i)); const w = days.filter(d => (C.daily(d).water || 0) > 0); const r = C.remSettings();
    if (w.length >= 5 && !(r.on && r.water.on)) { const low = w.filter(d => C.daily(d).water < C.waterGoalOn(d).ml / 2).length;
      if (low >= 5) out.push({ k: 'water', he: `ב־${low} מתוך ${w.length} הימים האחרונים ששתית פחות מחצי מיעד המים.`, sug: 'תזכורת מים בתוך האפליקציה מופיעה רק כשמאחורי הקצב, ואפשר לכבות אותה בכל רגע.', href: '#/settings', act: 'להפעלת תזכורת' }); } }
  return out.filter(x => fresh(x.k));
};
C.frictionOff = (k, date) => { const m = S.load('meta'); m.frictionOff = Object.assign({}, m.frictionOff || {}, { [k]: date || S.today() }); S.save('meta'); };
/* SLL-10 · Life Score — transparent, from the last 7 COMPLETED days (today excluded: it is not over). Each component is 0–100 with its
   formula and the number of days it rests on; a component without data is "אין נתון" and is left OUT of the average (never counted as
   0). Score = plain average of the available components. Not medical, not a comparison with anyone.
     workouts — planned sessions: done = 1, partial = ½ (incl. minimum), missed = 0; rest days ignored
     meals    — days with at least one meal marked in the journal, of 7
     water    — of the days with water logged: days that reached that day's goal
     sleep    — of the days with sleep logged: days with sleep ≥ the sleep goal
     steps    — only with a step target: days that reached it, of the days with steps */
C.lifeScore = date => {
  date = date || S.today(); const days = []; for (let i = 1; i <= 7; i++) days.push(S.addDays(date, -i));
  const g = C.profile().goals || {}, comps = [], pct = (a, b) => b ? Math.round(a / b * 100) : null;
  { let pl = 0, got = 0; days.forEach(d => { const w = (C.dailyProgress(d).tasks || []).find(x => x.k === 'workout'); if (w) { pl++; got += w.v >= 1 ? 1 : w.v > 0 ? 0.5 : 0; } });
    comps.push({ k: 'workouts', he: 'אימונים', v: pct(got, pl), n: pl, how: `בוצע = 1, חלקי = ½; ${got} מתוך ${pl} אימונים מתוכננים` }); }
  { const n = days.filter(d => C.entries(d).length).length; comps.push({ k: 'meals', he: 'רישום ארוחות', v: pct(n, 7), n: 7, how: `${n} מתוך 7 ימים עם ארוחה מסומנת` }); }
  { const wd = days.filter(d => (C.daily(d).water || 0) > 0), ok = wd.filter(d => C.daily(d).water >= C.waterGoalOn(d).ml).length; comps.push({ k: 'water', he: 'מים', v: pct(ok, wd.length), n: wd.length, how: wd.length ? `${ok} מתוך ${wd.length} ימים עם רישום הגיעו ליעד` : 'לא נרשמו מים' }); }
  { const sd = days.filter(d => C.daily(d).sleep > 0), goal = g.sleep || 7.5, ok = sd.filter(d => C.daily(d).sleep >= goal).length; comps.push({ k: 'sleep', he: 'שינה', v: pct(ok, sd.length), n: sd.length, how: sd.length ? `${ok} מתוך ${sd.length} לילות עם רישום — ${goal} שעות ומעלה` : 'לא נרשמה שינה' }); }
  { const A = root.Activity; if (A) { const td = days.filter(d => A.targetOn(d) && A.day(d).value != null), ok = td.filter(d => A.day(d).value >= A.targetOn(d)).length; if (days.some(d => A.targetOn(d))) comps.push({ k: 'steps', he: 'צעדים', v: pct(ok, td.length), n: td.length, how: td.length ? `${ok} מתוך ${td.length} ימים הגיעו ליעד` : 'לא נרשמו צעדים' }); } }
  const have = comps.filter(c => c.v != null); return { from: days[6], to: days[0], comps, score: have.length ? Math.round(have.reduce((a, c) => a + c.v, 0) / have.length) : null, used: have.length };
};
Screens.lifeCard = function () { const ls = C.lifeScore(); return (`<section class="card" data-life><div class="card-h"><h2>Life Score — 7 הימים האחרונים</h2>${root.UI.srcTag('calc')}</div>${ls.score != null ? `<div class="row" style="align-items:baseline;gap:10px"><span class="num" style="font-size:2em;font-weight:700" data-life-score>${ls.score}</span><span class="small muted">ממוצע של ${ls.used} ${ls.used === 1 ? 'רכיב' : 'רכיבים'} עם נתונים</span></div>` : '<p class="small muted" data-life-none>עוד אין מספיק נתונים לשבוע האחרון.</p>'}
    <div class="list">${ls.comps.map(c => `<div class="li" data-life-c="${c.k}"><div class="grow"><div class="t">${esc(c.he)}</div><div class="s">${esc(c.how)}</div></div><b class="num">${c.v != null ? c.v : UI.srcTag('none')}</b></div>`).join('')}</div>
    <p class="small"><a href="#/patterns" data-patterns-link>דפוסים אישיים</a> · <a href="#/experiments" data-experiments-link>ניסויים אישיים</a></p><p class="tiny faint">${esc(S.fmtShort(ls.from))}–${esc(S.fmtShort(ls.to))} (היום לא נכלל — הוא עוד לא נגמר). רכיב בלי נתונים לא נספר כאפס. זה סיכום של הרגלים, לא מדד רפואי ולא השוואה לאחרים.</p></section>`); };
Screens.frictionCard = function () { const fr = C.friction(); if (!fr.length) return ''; const x = fr[0]; return (`<section class="card" data-friction="${esc(x.k)}"><h3>מה מקשה? <span class="tiny muted">(${fr.length === 1 ? 'הצעה אחת' : '1 מתוך ' + fr.length})</span></h3><p class="small" data-friction-why><b>למה:</b> ${esc(x.he)}</p><p class="small">${esc(x.sug)}</p><div class="btns"><a class="btn sm" href="${x.href}">${esc(x.act)}</a><button class="btn sm ghost" data-act="frOff" data-k="${esc(x.k)}">לא רלוונטי</button></div><p class="tiny faint">לפי מה שנרשם בלבד. שום דבר לא משתנה בלי שתבחרו.</p></section>`); };
function techInfo() {
  const e = root.Activity ? root.Activity.env() : { native: false }, vv = root.visualViewport;
  let standalone = false; try { standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch (x) { }
  const ua = navigator.userAgent, dev = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : 'מחשב/אחר';
  const br = /CriOS/.test(ua) ? 'Chrome (iOS)' : /FxiOS/.test(ua) ? 'Firefox (iOS)' : /Version\/[\d.]+.*Safari/.test(ua) ? 'Safari ' + ((ua.match(/Version\/([\d.]+)/) || [])[1] || '') : /Chrome\/([\d]+)/.test(ua) ? 'Chrome ' + ua.match(/Chrome\/([\d]+)/)[1] : 'אחר';
  const os = (ua.match(/OS (\d+[_\d]*) like Mac/) || [])[1];
  return [`גרסה: ${root.FIT30_BUILD || '?'}`, `סביבה: ${e.native ? 'אפליקציה ' + e.platform : standalone ? 'PWA מותקנת' : 'דפדפן'}`, `מכשיר: ${dev}${os ? ' · iOS ' + os.replace(/_/g, '.') : ''} · ${br}`, `מסך: ${innerWidth}×${innerHeight}${vv ? ' (נראה ' + Math.round(vv.width) + '×' + Math.round(vv.height) + ')' : ''} · ‏DPR ${devicePixelRatio}`, `Service Worker: ${root.App && root.App.swState || '?'} · אחסון: ${S.storageOK ? 'תקין' : 'חסום'}`].join('\n');
}
const fb = { kind: 'bug', text: '', screen: '', tech: true };
function report() { return [`SoFitGo — ${fb.kind === 'bug' ? 'דיווח באג' : 'רעיון'}`, `מסך: ${fb.screen || 'לא צוין'}`, '', fb.text.trim() || '(ללא תיאור)', ...(fb.tech ? ['', '— פרטים טכניים —', techInfo()] : []), '', 'הדיווח לא כולל פרופיל, יומן, משקל או תוכנית.'].join('\n'); }
Screens.feedback = function () {
  /* M10: with an account backend, signed-in testers send structured reports to the server (screens_account.js) */
  if (root.FIT30_BACKEND) { if (!root.Account) { root.App.loadChunk('account.js').then(() => root.App.render(), () => { }); } else if (root.Account.state().signedIn && Screens.feedbackOnline) return Screens.feedbackOnline(techInfo); }
  const screens = ['בית', 'לוח', 'אימונים', 'אימון פעיל', 'תזונה', 'מתכונים', 'רשימת קניות', 'מעקב', 'צעדים ו־MoveScore', 'הגדרות', 'אחר'];
  return { title: 'דיווח לבטא', back: '#/settings', html: `
    ${root.FIT30_BACKEND ? `<div class="banner info small" data-fb-login>${icon('info')}<div>כדי לשלוח דיווח ישירות לצוות ולעקוב אחרי הסטטוס שלו — <a href="#/account/login">התחברו לחשבון</a>. בינתיים אפשר להעתיק את הדיווח ולשלוח אותו בעצמכם.</div></div>` : ''}
    <section class="card"><p class="small">כותבים מה קרה או מה הרעיון. האפליקציה מכינה טקסט, ואתם מעתיקים או משתפים אותו בעצמכם — שום דבר לא נשלח אוטומטית.</p>
      <div class="seg" role="group" aria-label="סוג"><button data-act="fk" data-k="bug" aria-pressed="${fb.kind === 'bug'}">באג</button><button data-act="fk" data-k="idea" aria-pressed="${fb.kind === 'idea'}">רעיון</button></div>
      <label class="field">באיזה מסך?<select id="fb-s"><option value="">לא צוין</option>${screens.map(s => `<option ${fb.screen === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
      <label class="field">${fb.kind === 'bug' ? 'מה עשית, מה ציפית ומה קרה בפועל?' : 'מה הרעיון?'}<textarea id="fb-t" rows="5" maxlength="2000">${esc(fb.text)}</textarea></label>
      <label class="row small"><input type="checkbox" id="fb-tech" ${fb.tech ? 'checked' : ''}> לצרף פרטים טכניים (גרסה, סוג מכשיר ודפדפן, גודל מסך — בלי מידע אישי)</label></section>
    <section class="card"><h3>מה ייכלל בדיווח</h3><pre class="small" data-fb-preview style="white-space:pre-wrap;margin:0">${esc(report())}</pre>
      <div class="btns"><button class="btn primary" data-act="fcopy">${icon('share')} העתקה</button>${navigator.share ? '<button class="btn" data-act="fshare">שיתוף…</button>' : ''}</div></section>`,
    handlers: {
      fk: el => { fb.kind = el.dataset.k; root.App.render(); },
      fcopy: () => { try { navigator.clipboard.writeText(report()).then(() => root.UI.toast('הדיווח הועתק'), () => root.UI.toast('ההעתקה לא זמינה — סמנו את הטקסט והעתיקו ידנית')); } catch (e) { root.UI.toast('ההעתקה לא זמינה — סמנו את הטקסט והעתיקו ידנית'); } },
      fshare: () => { navigator.share({ title: 'SoFitGo — דיווח', text: report() }).catch(() => { }); } },
    after: v => { const upd = () => { fb.text = v.querySelector('#fb-t').value; fb.screen = v.querySelector('#fb-s').value; fb.tech = v.querySelector('#fb-tech').checked; v.querySelector('[data-fb-preview]').textContent = report(); };
      ['#fb-t', '#fb-s', '#fb-tech'].forEach(s => { const el = v.querySelector(s); el.addEventListener('input', upd); el.addEventListener('change', upd); }); } };
};
Screens.feedback.report = report; Screens.feedback.state = fb;
})(window);
