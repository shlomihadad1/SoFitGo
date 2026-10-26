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
  if (nf) out.push({ k: 'ingredient', why: `${nf === 1 ? 'פריט אחד' : nf + ' פריטים'} ברשימת הקניות ${nf === 1 ? 'סומן' : 'סומנו'} "לא נמצא". לכל אחד יש "חלופות".` });
  return out;
};
Screens.planb = function () {
  const ap = root.Plans && root.Plans.active(), td = ap ? root.Plans.todayDay(ap) : null, n = ap ? (td && td.n) : C.clampDay(C.todayN()), dayHref = ap ? (n ? '#/pday/' + n : '#/plan') : '#/day/' + n;
  const opt = (k, t, s, href, lbl) => `<a class="li" href="${href}" data-planb="${k}"><div class="grow"><div class="t">${t}</div><div class="s">${s}</div></div><span class="pill">${lbl}</span></a>`;
  return { title: 'Plan B — משהו לא מסתדר?', back: '#/', html: `
    <section class="card" data-planb-stop><div class="banner bad small">${icon('info')}<div><b>כאב חד, סחרחורת, לחץ בחזה או קוצר נשימה חריג?</b> עוצרים את האימון. לא ממשיכים "דרך הכאב". אם זה חמור או לא עובר — פונים לגורם רפואי או לשירותי החירום המקומיים.</div></div></section>
${(() => { const sig = Screens.planbSignals(), ks = sig.map(x => x.k), nfN = ks.includes('ingredient');
      const ALL = { parked: () => `<button class="li li-btn" data-act="resume" data-planb="parked"><div class="grow"><div class="t">להמשיך את האימון ששמרתי</div><div class="s">ממשיך מאותו שלב, עם הסטים שכבר סומנו.</div></div><span class="pill">אימון</span></button>`,
        missed: () => opt('missed', 'פספסתי אימונים', 'במסך התוכנית: להעביר אימון שפוספס להיום, או לדלג עליו.', '#/plan', 'תוכנית'),
        time: () => opt('time', 'אין לי זמן לאימון המלא', 'גרסה קצרה של האימון של היום, או דילוג — בלי אשמה.', dayHref, 'אימון'),
        equip: () => opt('equip', 'חסר ציוד / תרגיל לא מתאים', 'החלפת תרגיל בתוך האימון של היום.', dayHref, 'אימון'),
        energy: () => opt('energy', 'אין לי כוח היום', 'מדווחים אנרגיה ביומן היומי; מנוחה היא בחירה לגיטימית ולא מורידה כלום.', '#/progress', 'מעקב'),
        ingredient: () => nfN ? opt('ingredient', 'חסר לי מרכיב', 'ברשימת הקניות: "חלופות" ליד מה שלא נמצא.', '#/shopping', 'קניות') : opt('ingredient', 'חסר לי מרכיב', 'ביומן התזונה: "החלף רכיב" במנה.', '#/nutrition', 'תזונה'),
        meal: () => opt('meal', 'אין את הארוחה / לא מתחשק', 'החלפת ארוחה, או מנה ממה שיש בבית.', '#/fridge', 'תזונה'),
        travel: () => opt('travel', 'אני בנסיעה', ap ? 'מצב נסיעה בתוכנית: אימונים קצרים בלי ציוד לטווח שתבחרו.' : 'מצב נסיעה זמין בתוכנית אישית.', '#/travel', 'נסיעה') };
      const rest = ['time', 'equip', 'energy', 'ingredient', 'meal', 'travel'].filter(k => !ks.includes(k));
      return (sig.length ? `<section class="card" data-planb-now><h3>מומלץ עכשיו</h3><div class="list">${sig.map(x => ALL[x.k]() + `<p class="tiny muted" data-planb-why="${x.k}">למה: ${esc(x.why)}</p>`).join('')}</div></section>` : '')
        + `<section class="card"><h3>${sig.length ? 'עוד אפשרויות' : 'מה קרה?'}</h3><div class="list">${rest.map(k => ALL[k]()).join('')}</div>`; })()}<p class="tiny faint">כל מעבר כאן פותח פעולה קיימת. שום דבר לא מסומן כבוצע ושום דבר לא משתנה בלי שתאשרו. ההמלצות למעלה נבחרות לפי מה שרשום במכשיר והשעה.</p></section>`, handlers: { resume: () => { const ss = S.load('session'); if (ss && root.Run) root.Run.open(); } } };
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
  if (v == null || (Array.isArray(v) && !v.length) || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'כן' : 'לא';
  const F = (root.NUTRI && root.NUTRI.FOODS) || {}, EQ = (root.CATALOG && root.CATALOG.EQUIPMENT) || {}, G = (root.PROGRAMS && root.PROGRAMS.GOALS) || {}, LV = (root.Planner && root.Planner.LEVEL_HE) || {};
  const one = x => path === 'availability.days' ? (DAY_HE[x] || x) : path === 'environment.equipment' ? ((EQ[x] || {}).he || x) : path === 'prefs.exclude' ? ((F[x] || {}).he || C.PREF_HE[x] || x).split(' (')[0]
    : path.startsWith('aims.') ? (G[x] || x) : path === 'experience' ? (LV[x] || x) : path === 'environment.place' ? ({ home: 'בבית', gym: 'חדר כושר', outdoor: 'בחוץ', mixed: 'משולב' }[x] || x)
    : path === 'exercisePrefs.exclude' ? (((root.EX_BY_ID || {})[x] || {}).he || ((root.EX_BY_ID || {})[x] || {}).name || x) : path === 'mode' ? ({ nutrition: 'תזונה בלבד' }[x] || x)
    : path === 'goals.waterMode' ? ({ manual: 'ידני', auto: 'אוטומטי' }[x] || x) : path === 'units.w' ? ({ kg: 'ק״ג', lb: 'ליברות' }[x] || x) : path === 'display.motion' ? ({ auto: 'רגיל', reduce: 'מופחת' }[x] || x) : String(x);
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
CH_HE['prefs.maxPrep'] = 'זמן הכנה מרבי למנה (דק׳)';
Screens.presets = function () {
  const ap = root.Plans && root.Plans.active(), planDiff = ap && root.Plans.profileDiff ? (root.Plans.profileDiff(ap.id) || []) : [];
  const menuPending = !!(ap && root.MealPlan && root.MealPlan.pending(ap));
  return { title: 'ערכות העדפות', back: '#/settings', html: `
    <section class="card"><p class="small">קיצור לכמה הגדרות יחד, לפי המצב שלך. רואים מה ישתנה לפני ההחלה, ואפשר לבטל מיד. הציוד שיש לך לא משתנה.</p></section>
    ${(planDiff.length || menuPending) ? `<div class="banner info small" data-presets-plan>${icon('info')}<div>${planDiff.length ? 'הפרופיל שונה מהתוכנית הפעילה. התוכנית לא מתעדכנת לבד — <a href="#/plan">במסך התוכנית</a> אפשר לראות מה ישתנה ולאשר.' : ''}${menuPending ? ' יש עדכון תפריט שמחכה לאישור (בתזונה או ב<a href="#/reset">איפוס השבועי</a>).' : ''}</div></div>` : ''}
    ${PRESETS.map(pr => { const d = presetDiff(pr.k); return `<section class="card" data-preset="${pr.k}"><div class="card-h"><h3>${esc(pr.he)}</h3>${d.length ? `<button class="btn sm primary" data-act="presetGo" data-k="${pr.k}">החלה</button>` : '<span class="pill" data-preset-same>כבר מוגדר כך</span>'}</div>
      <p class="small muted">${esc(pr.s)}</p>${d.length ? `<ul class="bul small" data-preset-diff>${d.map(x => `<li data-preset-row="${esc(x.path)}">${esc(CH_HE[x.path] || x.path)}: ${esc(chVal(x.path, x.from))} ← ${esc(chVal(x.path, x.to))}</li>`).join('')}</ul>` : ''}${pr.link ? `<p class="tiny"><a href="${pr.link[0]}">${esc(pr.link[1])}</a></p>` : ''}</section>`; }).join('')}`,
    handlers: { presetGo: el => { const pr = PRESETS.find(x => x.k === el.dataset.k), r = presetApply(el.dataset.k); root.App.render();
      if (r.n) root.UI.toast(`"${pr.he}": ${r.n === 1 ? 'הגדרה אחת עודכנה' : r.n + ' הגדרות עודכנו'}`, 0, { label: 'ביטול', fn: () => { r.undo(); root.App.render(); } }); } } };
};
Screens.presets.list = PRESETS; Screens.presets.diff = presetDiff; Screens.presets.apply = presetApply;
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
