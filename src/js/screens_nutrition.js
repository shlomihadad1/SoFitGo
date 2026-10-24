/* Nutrition: daily plan + log, meal & ingredient swaps, flexible meal, recipes, targets */
(function (root) {
const { esc, icon, meter } = root.UI;
const S = root.Store, C = root.Core, L = root.Logic, N = root.NUTRI;
const Screens = root.Screens;
const st = { tab: 'day', rf: 'all', fav: false };
const F = N.FOODS;
const ST_HE = { raw: 'נא', dry: 'יבש/לפני בישול', ready: 'מוכן לאכילה' };
const COST_HE = { 1: '₹ זול', 2: '₹₹ בינוני', 3: '₹₹₹ יקר יחסית' };
const fmt = m => `<span>${m.k} קק״ל</span><span>חלבון <b>${m.p}</b></span><span>פחמ׳ <b>${m.c}</b></span><span>שומן <b>${m.f}</b></span>`;

/* before/after table for calories, protein, carbs and fat (shown before any swap or portion change is confirmed) */
const diffTable = (a, b) => { const d = (x, y) => { const v = Math.round((y - x) * 10) / 10; return `<span class="v ${v > 0 ? 'up' : v < 0 ? 'down' : ''}">${v > 0 ? '+' : ''}${v}</span>`; };
  return `<div class="macro-grid diff-grid" data-diff><span class="h"></span><span class="h v">קק״ל</span><span class="h v">חלבון</span><span class="h v">פחמ׳</span><span class="h v">שומן</span>
    <span class="muted">לפני</span><span class="v">${a.k}</span><span class="v">${a.p}</span><span class="v">${a.c}</span><span class="v">${a.f}</span>
    <span class="muted">אחרי</span><span class="v">${b.k}</span><span class="v">${b.p}</span><span class="v">${b.c}</span><span class="v">${b.f}</span>
    <span class="muted">הפרש</span>${d(a.k, b.k)}${d(a.p, b.p)}${d(a.c, b.c)}${d(a.f, b.f)}</div>${L.compareMacros(a, b).length ? `<p class="tiny warn">שינוי מהותי ב: ${L.compareMacros(a, b).join(', ')} — הערכים אינם שווים.</p>` : '<p class="tiny faint">ערכים קרובים (הפרש קטן).</p>'}`; };
function prefBlocked(r, ov) { const cs = C.conflicts(r, ov || null); return cs.length ? C.conflictText(cs) : null; }
Screens.prefBlocked = prefBlocked;
const ingLine = (x, scale, baseG) => { const fd = F[x.f], g = Math.round(x.g * (scale || 1)); const bs = baseG != null && Math.round(baseG * (scale || 1)) !== g ? ` <span class="tiny faint">(במתכון ${Math.round(baseG * (scale || 1))} g)</span>` : ''; const u = fd.unit ? ` <span class="faint">(≈${+(g / fd.unit).toFixed(1)} ${fd.unitHe})</span>` : ''; return `<div class="ing"><span>${esc(fd.he)}${u}${x.side ? ' <span class="pill">רשות · ניתן להחלפה</span>' : ''}</span><span class="tiny faint">${ST_HE[fd.st]}</span><span class="g">${g} g${bs}</span></div>`; };

Screens.nutrition = function (date) {
  date = date || S.today();
  if (!C.targets()) return { title: 'תזונה', html: `<div class="seg" role="group" aria-label="תצוגה"><button aria-pressed="true">תפריט ויומן</button><button data-act="tab" data-t="recipes" aria-pressed="false">מתכונים</button><button data-act="tab" data-t="targets" aria-pressed="false">יעדים</button></div>${Screens.needProfile('אין עדיין יעדי תזונה')}<p class="tiny faint">המתכונים זמינים גם בלי פרופיל.</p>`, handlers: { tab: el => { location.hash = el.dataset.t === 'recipes' ? '#/recipes' : '#/targets'; } } };
  const t = C.targets(), plan = C.plan(date), eaten = C.eatenTotals(date), planned = C.plannedTotals(date, 'selected'), base = C.plannedTotals(date, 'base'), extraM = C.slotMacros(plan.extra), n = C.programDay(date), locked = C.locked(date);
  const ents = C.entries(date), prefs = C.profile().prefs;
  const html = [];
  html.push(`<div class="seg" role="group" aria-label="תצוגה"><button data-act="tab" data-t="day" aria-pressed="${st.tab === 'day'}">תפריט ויומן</button><button data-act="tab" data-t="recipes" aria-pressed="false">מתכונים</button><button data-act="tab" data-t="targets" aria-pressed="false">יעדים</button></div>`);
  html.push(`<div class="row between"><a class="btn sm ghost" href="#/nutrition/${S.addDays(date, -1)}" aria-label="יום קודם">${icon('back')}</a><div class="stack tight" style="align-items:center;text-align:center"><b>${esc(S.fmtDate(date, true))}</b><span class="small muted">${n >= 1 && n <= 30 ? 'יום ' + n + ' בתוכנית' : n < 1 ? 'לפני תחילת התוכנית' : 'אחרי סיום התוכנית (תפריט חוזר)'}</span></div><a class="btn sm ghost" href="#/nutrition/${S.addDays(date, 1)}" aria-label="יום הבא">${icon('chev')}</a></div>`);
  if (date !== S.today()) html.push(`<a class="btn sm" href="#/nutrition/${S.today()}">חזרה להיום</a>`);
  if (date >= S.today()) html.push(Screens.targetWarnings({ only: ['bad', 'warn'] }));
  { const ap = root.Plans.active(); if (ap && date >= S.today() && root.Plans.profileDiff(ap.id).some(x => x.key === 'goal')) html.push(Screens.syncBanner(ap, { compact: true })); }
  if (plan.source === 'auto') html.push(`<div class="banner info small" data-menu-source="auto">${icon('food')}<div class="grow">התפריט של היום מחושב מהיעדים שלך (${t.kcal} קק״ל · ${t.protein} ג׳ חלבון) ומההעדפות: ${['m1', 'm2', 'm3'].filter(k => plan[k].rid && !plan[k].off).length} ארוחות לפי ההגדרה${['snack', 'snack2'].filter(k => plan[k].rid && !plan[k].off).length ? ` ו־${['snack', 'snack2'].filter(k => plan[k].rid && !plan[k].off).length} ארוחות ביניים כדי להגיע ליעד` : ''}. כל מנה בגודל מנה רגיל (הכמויות זזות רק בטווח מוגבל). הערכים מחושבים מהרכיבים ומשוערים.</div></div>`);
  if (plan.source === 'plan' || plan.source === 'auto') { const pp = plan.source === 'plan' ? root.Plans.get(plan.planId) : null, dn = pp ? Math.max(1, S.diffDays(pp.start, date) + 1) : null;
    if (pp) html.push(`<div class="banner info small" data-menu-source="plan">${icon('route')}<div class="grow">תפריט אישי של התוכנית <b>${esc(root.PROGRAMS.byId(pp.templateId).he)}</b> · יום ${dn} · מחושב ליעדים ולהעדפות שלך.${pp.status === 'replaced' || pp.status === 'cancelled' ? ' (תוכנית קודמת — מוצג כפי שתוכנן)' : ''}</div></div>`);
    if (plan.gap && (plan.gap.p || plan.gap.kLow || plan.gap.kHigh)) html.push(`<div class="banner warn small" data-menu-gap>${icon('info')}<div>${plan.gapEdited ? 'אחרי השינויים בתפריט של היום: ' : ''}${plan.gap.p ? `${plan.gapEdited ? 'חסרים' : 'התפריט שנבנה ליום הזה חסר'} כ־<b>${plan.gap.p} ג׳ חלבון</b> ליעד${plan.gapEdited ? '' : ' (במגבלות גודל מנה סבירות)'}. ` : ''}${plan.gap.kLow ? `חסרות כ־${plan.gap.kLow} קק״ל ליעד. ` : ''}${plan.gap.kHigh ? `מעל היעד בכ־${plan.gap.kHigh} קק״ל. ` : ''}זה פער אמיתי — לא מוצג "יעד הושג".</div></div>`);
    const act = root.Plans.active(); if (act && act.id === plan.planId && date >= S.today()) { const pc = root.MealPlan.pending(act); if (pc) html.push(`<div class="banner acc small" data-menu-pending>${icon('info')}<div class="grow">היעדים או העדפות התזונה השתנו מאז שהתפריט נבנה. אפשר לעדכן את התפריט מ־${esc(S.fmtDate(pc.fromDate))} והלאה; ימים קודמים וארוחות שנרשמו לא ישתנו.</div><button class="btn sm" data-act="menuUpdate">עדכון התפריט</button></div>`); } }
  if (C.isPast(date)) html.push(`<div class="banner ${locked ? 'warn' : 'info'}">${icon('lock')}<div class="grow small">${locked ? 'יום שעבר — נעול כדי לא לשנות היסטוריה בטעות.' : 'עריכת יום שעבר פתוחה לעכשיו.'}</div><button class="btn sm" data-act="lock">${locked ? 'ערוך יום' : 'נעל'}</button></div>`);
  const row = (lbl, m, cls) => `<span class="${cls || ''}">${lbl}</span><span class="v">${m.k}</span><span class="v">${Math.round(m.p)}</span><span class="v">${Math.round(m.c)}</span><span class="v">${Math.round(m.f)}</span>`;
  const rem = { k: t.kcal - eaten.k, p: t.protein - eaten.p, c: t.carbs - eaten.c, f: t.fat - eaten.f };
  html.push(`<section class="card" data-sec="summary"><div class="card-h"><h3>סיכום היום</h3><span class="tiny faint">ערכים משוערים</span></div>
    <div class="macro-grid"><span class="h"></span><span class="h v">קק״ל</span><span class="h v">חלבון</span><span class="h v">פחמ׳</span><span class="h v">שומן</span>
    ${row('יעד', { k: t.kcal, p: t.protein, c: t.carbs, f: t.fat }, 'muted')}${row('תפריט בסיסי', base, 'muted')}${plan.extra.on ? row('+ נשנוש חלבון שהוספת', extraM, 'muted') : ''}${row('סה״כ מתוכנן', planned, '')}${row('נצרך בפועל', eaten, 'acc')}${row('נשאר ליעד', { k: Math.max(0, rem.k), p: Math.max(0, rem.p), c: Math.max(0, rem.c), f: Math.max(0, rem.f) }, 'muted')}</div>
    <div class="stack tight"><div class="row between small"><span>קלוריות</span><span class="num">${eaten.k} / ${t.kcal}</span></div>${meter(eaten.k, t.kcal)}<div class="row between small"><span>חלבון</span><span class="num">${Math.round(eaten.p)} / ${t.protein} ג׳</span></div>${meter(eaten.p, t.protein, 'gl')}</div>
    ${(() => { /* fat & carb targets are guides (energy and protein are the primary targets); a deviation over ±15% is stated, never hidden */
      const dv = [['שומן', planned.f, t.fat, 'f'], ['פחמימות', planned.c, t.carbs, 'c']].filter(([, v, tg]) => tg > 0 && Math.abs(v - tg) > tg * 0.15);
      return dv.length ? `<div class="banner info small" data-macro-dev="${dv.map(x => x[3]).join('')}">${icon('info')}<div>${dv.map(([n, v, tg]) => `${n} בתפריט: <b>${Math.round(v)} ג׳</b> לעומת יעד ${tg} ג׳ (${v > tg ? 'מעל' : 'מתחת'} ב־${Math.round(Math.abs(v - tg) / tg * 100)}%)`).join(' · ')}. יעדי קלוריות וחלבון הם העיקריים; שומן ופחמימות הם הנחיה, והסטייה מוצגת כפי שהיא.</div></div>` : ''; })()}
    <div class="kv"><span>סיבים מתוכננים: <b>${Math.round(planned.fb)} ג׳</b></span><span>נצרך: <b>${Math.round(eaten.fb)} ג׳</b> (יעד ${t.fiber})</span><span>פער נצרך מול מתוכנן: <b>${eaten.k - planned.k > 0 ? '+' : ''}${eaten.k - planned.k}</b> קק״ל</span>${eaten.p >= t.protein ? '<span class="good">✓ יעד החלבון הושג</span>' : ''}</div></section>`);
  if (planned.p < t.protein) {
    const gap = Math.round(t.protein - planned.p);
    const opts = N.RECIPES.filter(r => r.meal === 'extra' && !prefBlocked(r) && (plan.extra.on && plan.extra.rid === r.id || !C.extraRepeats(r, plan))).map(r => ({ r, m: L.recipeMacros(r) })).sort((a, b) => b.m.p - a.m.p);
    html.push(`<section class="card"><div class="banner warn small">${icon('info')}<div>התפריט ${plan.extra.on ? 'שנבחר' : 'הבסיסי'} מספק <b>${Math.round(planned.p)} ג׳</b> חלבון — <b>חסרים ${gap} ג׳</b> ליעד ${t.protein}. היעד לא יוצג כמושג עד שהצריכה שנרשמה תגיע אליו.</div></div>
      <h4 data-protein-suggest>המלצה (רשות) — ${plan.extra.on ? 'החלפת נשנוש החלבון שהוספת' : 'נשנוש חלבון להשלמת היעד'}</h4><p class="tiny muted">לא חובה ולא נספר בסיכום עד שמוסיפים. מוצגות רק אפשרויות שלא חוזרות על מקור חלבון שכבר יש בארוחות היום.</p><div class="list">${opts.map(o => `<div class="li"><div class="grow"><div class="t">${esc(o.r.he)}</div><div class="s num">+${Math.round(o.m.p)} ג׳ חלבון · +${o.m.k} קק״ל</div></div><button class="btn sm" data-act="pickExtra" data-id="${o.r.id}" ${locked ? 'disabled' : ''}>${plan.extra.on && plan.extra.rid === o.r.id ? 'נבחרה' : 'הוספה'}</button></div>`).join('') || '<p class="muted small">אין תוספת שתואמת להעדפות שלך.</p>'}</div>
      <p class="tiny faint">אפשר גם: להגדיל את מקור החלבון בארוחה ("החלף רכיב" ושינוי כמות), להוסיף ביצים קשות, דהי מסונן, חומוס קלוי או נבטים דרך "מזון נוסף".</p></section>`);
  }
  // flex meal
  if (prefs.flex && n >= 1 && n <= 30) {
    const used = C.flexUsedInWeek(date), suggested = N.FLEX_DAYS.includes(n);
    if (suggested || used) html.push(`<section class="card" data-sec="flex"><div class="card-h"><h3>${esc(prefs.flexName)} (רשות)</h3>${used ? '<span class="pill acc">נוצלה השבוע</span>' : '<span class="pill">זמינה השבוע</span>'}</div><p class="small muted">פעם בשבוע, במקום ארוחה שנייה. ארוחה אחת — לא יום שלם. אחריה ממשיכים כרגיל: בלי צום מפצה ובלי אימון "עונש".</p>${!used ? `<button class="btn" data-act="flex">${icon('flame')} בחירת ${esc(prefs.flexName)}</button>` : ''}</section>`);
  }
  // slots
  html.push(`<section class="card" data-day-meals>${C.ALL.filter(k => k !== 'extra' ? !plan[k].off || C.slotEntry(date, k) : (plan.extra.on && plan.extra.rid) || C.slotEntry(date, 'extra')).map(k => { /* the day in order: breakfast, snack, lunch, snack, dinner — only the meals in today's menu */ /* P0: the add-on is not a meal — it appears here only after the user added it (or logged it) */
    const s0 = plan[k];
    if (s0.off && !C.slotEntry(date, k)) return `<div class="slot stack tight" data-off="${k}"><span class="eyebrow">${C.slotNames[k]}</span><p class="small muted">לא בתפריט — בחרת 2 ארוחות ביום. ${locked ? '' : `<button class="btn sm ghost" data-act="swapMeal" data-slot="${k}">הוספת ארוחה</button>`}</p></div>`;
    if (s0.missing && !C.slotEntry(date, k)) return `<div class="slot stack tight" data-missing="${k}"><span class="eyebrow">${C.slotNames[k]}</span><div class="banner warn small" data-no-valid-meal>${icon('info')}<div>אין במאגר מנה שמתאימה לכל ההגבלות שהגדרת לארוחה הזו${s0.blockedNone ? ` (המנה המתוכננת ${esc(L.recipe(s0.from).he)} ${esc(s0.blockedNone)} — ${esc(C.KIND_HE[s0.guardKind])})` : ''} — לא הוצבה מנה במקומה כדי לא להציג מזון אסור. אפשר לבחור ידנית מתוך מנות שמתאימות, או לשנות את ההגבלות.</div></div>${locked ? '' : `<button class="btn sm" data-act="swapMeal" data-slot="${k}">בחירה ידנית</button>`}</div>`;
    const s = s0, r = L.recipe(s.rid), m = C.slotMacros(s), e = C.slotEntry(date, k), blocked = prefBlocked(r, s.ov);
    const ings = L.recipeIngredients(r, s.ov);
    return `<div class="slot stack tight"><div class="row between top-al"><div class="grow"><span class="eyebrow">${C.slotNames[k]}</span>${t && t.kcal && k !== 'extra' ? `<span class="tiny faint" data-meal-share> · כ־${Math.round(m.k / t.kcal * 100)}% מיעד הקלוריות היומי</span>` : ''}<h3>${esc(r.he)}</h3><span class="tiny faint ltr">${esc(r.en)}</span></div>${e ? `<span class="pill good" data-eaten="${esc(e.rid || '')}">נאכל ✓${Math.round(e.portion * 100) !== 100 ? ' · ' + Math.round(e.portion * 100) + '%' : ''}${e.rid && e.rid !== s.rid ? ' · ' + esc(e.name) + ' (לפני ההחלפה)' : ''}</span>` : ''}</div>
      <div class="kv">${fmt(m)}${r.est ? '<span class="pill acc">הערכה ±' + Math.round(r.range * 100) + '%</span>' : ''}${s.auto === 'guard' ? `<span class="pill gl" data-guard="${esc(s.guardKind)}">הוחלף אוטומטית · ${esc(L.recipe(s.from).he)} ${esc(s.guardWhy)} (${esc(C.KIND_HE[s.guardKind])})</span>` : (s.auto === 'cuisine' || (s.auto === 'pref' && s.cuisine)) && s.from ? `<span class="pill gl" data-cuisine-swap>${s.disliked || s.cuisine === 'disliked' ? 'במקום מנה שסימנת "לא אוהב/ת"' : 'הותאם להעדפת המטבח'} · במקום ${esc(L.recipe(s.from).he)}</span>` : s.auto === 'pref' ? `<span class="pill gl">הותאם להעדפות${s.from && s.from !== s.rid ? ' · במקום ' + esc(L.recipe(s.from).he) : ''}</span>` : s.changed ? '<span class="pill gl">שונה מהתוכנית</span>' : s.adjusted ? `<span class="pill" data-adjusted title="${plan.source === 'plan' ? 'כמויות הרכיבים שונו מהמתכון המקורי כדי שסך התפריט של כל היום יתקרב ליעד הקלוריות והחלבון. זו הערכה, לא הבטחה.' : 'כמויות הרכיבים שונו מהמתכון המקורי כדי ששלוש הארוחות הבסיסיות של היום יגיעו ליעד החלבון, ובחלק מהימים גם יתקרבו ליעד האנרגיה. זו הערכה, לא הבטחה.'}">כמות המנה חושבה בהתאם לתכנון התזונתי היומי</span>` : ''}<span data-time>⏱ ${timeLong(r)}</span>${s.cuisineMiss ? `<span class="pill warn" data-cuisine-miss>אין מנה מתאימה מהמטבח שבחרת — זו מנה ממטבח ${esc(root.CATALOG.CUISINE_HE[C.cuisineOf(r)] || 'אחר')}</span>` : ''}</div>
      ${blocked ? `<div class="banner ${C.worstKind(C.conflicts(r, s.ov).map(c => c.f)) === 'allergy' ? 'bad' : 'warn'} small" data-user-conflict>${icon('info')}<div><b>${esc(C.KIND_HE[C.worstKind(C.conflicts(r, s.ov).map(c => c.f))])}:</b> ${blocked}. ${e ? 'נרשם כנאכל.' : 'בחרת במנה הזו בעצמך ולכן היא לא הוחלפה אוטומטית — מומלץ "החלף מנה" או "החלף רכיב".'}</div></div>` : ''}
      <details class="more" data-meal-detail><summary>מרכיבים, כמויות ושלבי הכנה</summary><div>${ings.map((x, i) => ingLine(x, s.scale, r.ing[i] && r.ing[i].f === x.f ? r.ing[i].g : null)).join('')}</div>${(r.steps || []).length ? `<ol class="steps" data-meal-steps>${r.steps.map(t => `<li>${esc(t)}</li>`).join('')}</ol>${s.ov || (s.scale && s.scale !== 1) ? '<p class="tiny muted" data-steps-note>הכמויות שבשלבים הן של המתכון הבסיסי — לתפריט של היום השתמשו בכמויות שברשימה למעלה.</p>' : ''}` : ''}${r.notes ? `<p class="tiny muted">${esc(r.notes)}</p>` : ''}</details>
      ${k === 'extra' && s.on && !e ? `<button class="btn sm ghost" data-act="extraOff" ${locked ? 'disabled' : ''}>הסרת הנשנוש מהתפריט</button>` : ''}
      <div class="btns">${e ? `<button class="btn sm" data-act="editEat" data-slot="${k}" ${locked ? 'disabled' : ''}>עריכת כמות</button><button class="btn sm ghost" data-act="uneat" data-slot="${k}" ${locked ? 'disabled' : ''}>ביטול סימון</button>` : `<button class="btn sm" data-act="eat" data-slot="${k}" aria-pressed="false" ${locked ? 'disabled' : ''}>סמן שאכלתי</button>`}
        <button class="btn sm${e ? '' : ' primary'}" data-act="swapMeal" data-slot="${k}" ${locked ? 'disabled' : ''}>${icon('swap')} החלף מנה</button></div>
      <div class="btns meal-more" data-meal-more><button class="btn sm ghost" data-act="swapIng" data-slot="${k}" ${locked ? 'disabled' : ''}>החלף רכיב</button>${k !== 'extra' && !e ? `<button class="btn sm ghost" data-act="portion" data-slot="${k}" ${locked ? 'disabled' : ''}>גודל מנה</button>` : ''}<a class="btn sm ghost" href="#/recipe/${r.id}/${date}/${k}">מתכון</a></div></div>`; /* M10: one primary action per meal ("החלף מנה"); fine-tuning is secondary */
  }).join('')}</section>`);
  // other entries
  const others = ents.filter(e => e.source !== 'plan');
  html.push(`<a class="card plan-link" href="#/nearby" data-nearby-link><span class="eyebrow">${icon('food')} אוכל בקרבתי</span><b>מצא אוכל בקרבתי</b><span class="tiny muted">חיפוש במפות לפי מיקום (רק אחרי אישור שלך) או לפי עיר. המיקום לא נשמר.</span></a>`); /* M10.4 issue 2 */
  if (!(C.normPrefs(C.profile().prefs).cuisines || []).length) html.push(`<a class="card plan-link" href="#/settings" data-cuisine-prompt><span class="eyebrow">${icon('food')} העדפות מטבח</span><b>התפריט מותאם כרגע לברירת המחדל: ישראלי, ים־תיכוני ומערבי</b><span class="tiny muted">אפשר לבחור מטבח אחר (גם הודי, אסייתי או מגוון) בהגדרות. המיקום לא משנה את הבחירה.</span></a>`); /* M10.4 */
  html.push(`<a class="card plan-link" href="#/shopping" data-shop-link><span class="eyebrow">${icon('list')} רשימת קניות והכנה מראש</span><b>כל המרכיבים לימים הקרובים לפי התפריט</b><span class="tiny muted">3, 7 או 14 ימים · מה לבשל פעם אחת</span></a><a class="card plan-link" href="#/fridge" data-fridge-link><span class="eyebrow">${icon('food')} מה יש במקרר?</span><b>מנות ממה שכבר יש בבית</b><span class="tiny muted">בוחרים רכיבים ומקבלים הצעות · גם "בלי קניות"</span></a>`);
  html.push(`<section class="card" data-sec="extrafood"><div class="card-h"><h3>מזון נוסף שנאכל</h3><button class="btn sm" data-act="addFood" ${locked ? 'disabled' : ''}>${icon('plus')} הוספה</button></div>${others.length ? `<div class="list">${others.map(e => `<div class="li"><div class="grow"><div class="t">${esc(e.name)}${e.source === 'flex' ? ' <span class="pill acc">' + esc(prefs.flexName) + '</span>' : ''}</div><div class="s num">${e.k} קק״ל · ח ${e.p} · פ ${e.c} · ש ${e.f}${e.grams ? ' · ' + e.grams + ' ג׳' : ''}</div></div><button class="icon-btn" data-act="delEntry" data-id="${e.id}" aria-label="מחיקה" ${locked ? 'disabled' : ''}>${icon('trash')}</button></div>`).join('')}</div>` : '<p class="muted small">לא נוספו מזונות מחוץ לתפריט.</p>'}</section>`);
  html.push(`<p class="tiny faint">הערכים מחושבים מסכום המרכיבים לפי ערכי ייחוס ממוצעים (בסגנון IFCT/USDA) ומעוגלים. בפועל הם משתנים לפי מותג, כמות שמן ושיטת הכנה.</p>`);

  return {
    title: 'תזונה', html: html.join(''), handlers: { ...Screens.syncHandlers(),
      tab: el => { st.tab = el.dataset.t; if (st.tab === 'recipes') location.hash = '#/recipes'; else if (st.tab === 'targets') location.hash = '#/targets'; },
      lock: () => { C.unlocked[date] = !C.unlocked[date]; root.App.render(); },
      eat: el => portionSheet(date, el.dataset.slot, null),
      editEat: el => portionSheet(date, el.dataset.slot, C.slotEntry(date, el.dataset.slot)),
      uneat: el => { const e = C.slotEntry(date, el.dataset.slot); if (!e) return; C.removeEntry(date, e.id); root.App.render(); undoToast('הסימון בוטל', () => { if (!C.slotEntry(date, e.slot)) C.addEntry(date, Object.assign({}, e)); }); },
      swapMeal: el => { const sl = el.dataset.slot; if (root.MealOpt) return root.MealOpt.sheet(date, sl); /* M11.3: swap sheet lives in the on-demand chunk */
        root.App.loadChunk('extra.js').then(() => root.MealOpt.sheet(date, sl), () => root.UI.toast('החלפת מנה זמינה אחרי טעינה ראשונה עם חיבור לאינטרנט')); },
      portion: el => portionPlanSheet(date, el.dataset.slot),
      menuUpdate: () => menuUpdateSheet(),
      swapIng: el => swapIngSheet(date, el.dataset.slot),
      addFood: () => addFoodSheet(date),
      delEntry: el => { C.removeEntry(date, el.dataset.id); root.App.render(); },
      flex: () => flexSheet(date),
      extraOn: () => { C.setExtraOn(date, true); root.UI.toast('התוספת נכללת עכשיו בסיכום'); root.App.render(); },
      extraOff: () => { C.setExtraOn(date, false); root.UI.toast('הנשנוש הוסר מהתפריט ומהסיכום'); root.App.render(); },
      pickExtra: el => { C.setPlanSlot(date, 'extra', { rid: el.dataset.id, ov: null, scale: 1, on: true }); root.UI.toast('נשנוש החלבון נוסף והסיכום עודכן'); root.App.render(); }
    }
  };
};
/* RC5 (P0-A/B): every journal change can be undone once from the toast; undo re-renders from stored data. */
const undoToast = (msg, undo) => root.UI.toast(msg, 0, { label: 'ביטול', fn: () => { undo(); root.App.render(); root.UI.toast('בוטל'); } });
/* Same recipe already in today's journal (planned slot or extra food)? Ask before adding a second record, so an accidental
   double entry cannot happen silently, while a real second serving stays one tap away. Matching is by stable recipe id. */
function addRecipeEntry(date, r, rec) {
  const dups = C.entries(date).filter(e => e.rid === r.id);
  const add = repeat => { const ne = C.addEntry(date, Object.assign(rec, repeat ? { repeat: true } : {})); root.App.render(); undoToast('נרשם ביומן', () => C.removeEntry(date, ne.id)); };
  if (!dups.length) return add(false);
  root.UI.sheet('המנה כבר רשומה היום', `<div class="banner warn small" data-dup-warning>${icon('info')}<div><b>${esc(r.he)}</b> כבר רשומה ביומן של ${esc(S.fmtDate(date))}: ${dups.map(d => esc(d.slot ? C.slotNames[d.slot] : 'מזון נוסף') + (d.portion && d.portion !== 1 ? ' (' + Math.round(d.portion * 100) + '%)' : '')).join(', ')}.</div></div>
    <p class="small">אכלת מנה נוספת? אם כן, היא תיספר בנפרד. אם לא, אין צורך להוסיף — כך הסכום לא נספר פעמיים.</p>
    <div class="btns"><button class="btn primary" data-act="again">כן, אכלתי מנה נוספת</button><button class="btn" data-act="no">לא להוסיף</button></div>`,
    { again: (el, e, close) => { close(); add(true); }, no: (el, e, close) => close() });
}
/* RC5 (P0-D): recipe time labels come only from the recipe's own prep/cook fields (minutes). Restaurant meals have neither. */
const timeLong = r => !r.prep && !r.cook ? (r.est ? 'ארוחת מסעדה — אין זמן הכנה' : 'לא רשום זמן הכנה') : !r.cook ? `${r.prep} דקות הכנה · בלי בישול` : !r.prep ? `${r.cook} דקות בישול` : `${r.prep + r.cook} דקות בסך הכול (הערכה) · ${r.prep} דקות הכנה + ${r.cook} דקות בישול`; /* M10.2: authored estimates, not measured */
const timeShort = r => !r.prep && !r.cook ? 'בלי זמן הכנה' : `~${r.prep + r.cook} דק׳ בסך הכול (הכנה + בישול)`;
function portionSheet(date, slot, entry) {
  /* editing an eaten entry uses what was actually eaten (its own recipe/amounts), not the slot's current plan,
     which may have been swapped after eating */
  const ps = C.plan(date)[slot], er = entry && entry.rid && L.recipe(entry.rid);
  const s = er ? { rid: entry.rid, scale: entry.scale || 1, ov: entry.ov || null } : ps, r = L.recipe(s.rid);
  let pct = entry ? Math.round(entry.portion * 100) : 100;
  const body = () => { const m = L.recipeMacros(r, s.scale * pct / 100, s.ov); return `<div class="kv">${fmt(m)}</div>`; };
  const sh = root.UI.sheet('כמה אכלת? — ' + r.he, `<p class="small muted">בחר את החלק מהמנה המתוכננת שנאכל בפועל.</p><div class="chips" style="flex-wrap:wrap">${[25, 50, 75, 100, 125, 150].map(p => `<button class="chip" data-act="p" data-p="${p}" aria-pressed="${p === pct}">${p}%</button>`).join('')}</div>
    <label class="field">אחוז מדויק<input type="number" id="pp" inputmode="numeric" min="5" max="300" value="${pct}"></label><div id="pm">${body()}</div><button class="btn primary" data-act="ok">שמירה</button>`,
    { p: (el, e, close, b) => { pct = +el.dataset.p; b.querySelector('#pp').value = pct; b.querySelectorAll('[data-act=p]').forEach(c => c.setAttribute('aria-pressed', c === el)); b.querySelector('#pm').innerHTML = body(); },
      ok: (el, e, close, b) => { pct = +b.querySelector('#pp').value || 100; const m = L.recipeMacros(r, s.scale * pct / 100, s.ov);
        if (entry) { C.updateEntry(date, entry.id, { portion: pct / 100, k: m.k, p: m.p, c: m.c, f: m.f, fb: m.fb }); close(); root.UI.toast('נשמר ביומן'); root.App.render(); return; }
        const had = C.slotEntry(date, slot), ne = C.eatSlot(date, slot, pct / 100); close(); root.App.render(); /* eatSlot never adds a second entry for the same slot */
        if (!had) undoToast('סומן כנאכל ✓', () => { C.removeEntry(date, ne.id); }); else root.UI.toast('נשמר ביומן'); } });
  sh.body.querySelector('#pp').addEventListener('input', ev => { pct = +ev.target.value || 0; sh.body.querySelector('#pm').innerHTML = body(); });
}
function portionPlanSheet(date, slot) {
  const s = C.plan(date)[slot], r = L.recipe(s.rid), before = C.slotMacros(s); let sc = s.scale || 1;
  const body = () => diffTable(before, L.recipeMacros(r, sc, s.ov));
  const sh = root.UI.sheet('גודל מנה — ' + r.he, `<p class="small muted">משנה את הכמות המתוכננת לארוחה הזו בלבד (לא את מה שכבר נרשם).</p><div class="chips">${[0.5, 0.75, 1, 1.25, 1.5].map(v => `<button class="chip" data-act="sc" data-v="${v}" aria-pressed="${v === sc}">×${v}</button>`).join('')}</div><div id="ps-d">${body()}</div><button class="btn primary" data-act="ok">שמירה</button>`,
    { sc: (el, e, close, b) => { sc = +el.dataset.v; b.querySelectorAll('[data-act=sc]').forEach(x => x.setAttribute('aria-pressed', x === el)); b.querySelector('#ps-d').innerHTML = body(); },
      ok: (el, e, close) => { C.setPlanSlot(date, slot, { rid: s.rid, ov: s.ov, scale: sc }); close(); root.UI.toast('גודל המנה עודכן'); root.App.render(); } });
}
function menuUpdateSheet() {
  const p = root.Plans.active(); if (!p) return; const pv = root.MealPlan.previewChange(p); if (!pv) { root.UI.toast('אין שינוי לעדכן'); return; }
  const row = (lbl, a, b) => `<div class="li"><div class="grow">${lbl}</div><b class="num">${a} ← ${b}</b></div>`;
  root.UI.sheet('עדכון התפריט העתידי', `<p class="small">מ־<b>${esc(S.fmtDate(pv.fromDate))}</b> והלאה. ימים קודמים וארוחות שכבר נרשמו לא ישתנו.</p>
    <div class="list">${row('יעד קלוריות', pv.from.kcal ?? '—', pv.to.kcal ?? '—')}${row('יעד חלבון (ג׳)', pv.from.protein ?? '—', pv.to.protein ?? '—')}${row('ממוצע מתוכנן ל־14 יום — קק״ל', pv.before.kcal, pv.after.kcal)}${row('ממוצע מתוכנן ל־14 יום — חלבון', pv.before.protein, pv.after.protein)}${row('ימים עם פער חלבון (14 יום)', pv.before.gaps, pv.after.gaps)}${row('מנות שונות (14 יום)', pv.before.distinct, pv.after.distinct)}</div>
    <button class="btn primary" data-act="ok">עדכון התפריט</button><button class="btn ghost" data-act="no">לא עכשיו</button>`,
    { ok: (el, e, close) => { const d = root.MealPlan.applyChange(p); close(); root.UI.toast('התפריט עודכן מ־' + S.fmtDate(d)); root.App.render(); }, no: (el, e, close) => close() });
}
function swapIngSheet(date, slot) {
  const s = C.plan(date)[slot], r = L.recipe(s.rid), ings = L.recipeIngredients(r, s.ov);
  const sh = root.UI.sheet('החלפת רכיב — ' + r.he, `<p class="small muted">בחרו רכיב להחלפה (חלבון, פחמימה, ירק, תוספת או רוטב).</p><div class="list">${ings.map((x, i) => `<button class="li li-btn" data-act="pickIng" data-i="${i}"><div class="grow"><div class="t">${esc(F[x.f].he)}</div><div class="s">${x.g} ג׳ · ${ST_HE[F[x.f].st]}${s.ov && s.ov[i] ? ' · הוחלף' : ''}</div></div>${icon('chev', 'chev')}</button>`).join('')}</div>${s.ov ? '<button class="btn sm" data-act="resetIng">שחזור כל הרכיבים המקוריים</button>' : ''}`,
    { pickIng: (el, e, close, b) => step2(+el.dataset.i, b, close),
      resetIng: (el, e, close) => { C.setPlanSlot(date, slot, { rid: s.rid, ov: null }); close(); root.App.render(); } });
  function step2(idx, b, close) {
    const from = ings[idx], grp = Object.keys(N.SWAP).find(g => N.SWAP[g].includes(from.f)) || F[from.f].grp;
    const blk = C.blockedFoods(); const opts = (N.SWAP[grp] || []).filter(f => f !== from.f && !blk.has(f));
    if (!opts.length) { b.innerHTML = '<p>אין רכיב חלופי באותה קבוצה שתואם להעדפות שלך. נסו "החלף מנה".</p>'; return; }
    let cur = opts[0], grams = L.suggestSwapGrams(from, cur).g;
    const preview = () => { const ov = Object.assign({}, s.ov || {}); ov[idx] = { f: cur, g: grams }; const before = L.recipeMacros(r, s.scale, s.ov), after = L.recipeMacros(r, s.scale, ov); const flags = L.compareMacros(before, after);
      return diffTable(before, after); };
    b.innerHTML = `<p><b>${esc(F[from.f].he)}</b> ${from.g} ג׳ ← </p><label class="field">רכיב חלופי<select id="sw-f">${opts.map(f => `<option value="${f}">${esc(F[f].he)}</option>`).join('')}</select></label>
      <label class="field">כמות (גרם, ${'<span id="sw-st">' + ST_HE[F[cur].st] + '</span>'})<input type="number" id="sw-g" inputmode="numeric" min="1" max="1000" value="${grams}"></label><p class="tiny faint" id="sw-hint">הכמות הוצעה כדי לשמור על ערך ${grp === 'carb' ? 'הפחמימות' : grp === 'veg' || grp === 'fat' || grp === 'fruit' ? 'הקלורי' : 'החלבון'} דומה. אפשר לשנות.</p><div id="sw-p">${preview()}</div><button class="btn primary" data-act="saveIng">שמירת ההחלפה</button>`;
    const fSel = b.querySelector('#sw-f'), gIn = b.querySelector('#sw-g');
    fSel.addEventListener('change', () => { cur = fSel.value; grams = L.suggestSwapGrams(from, cur).g; gIn.value = grams; b.querySelector('#sw-st').textContent = ST_HE[F[cur].st]; b.querySelector('#sw-p').innerHTML = preview(); });
    gIn.addEventListener('input', () => { grams = +gIn.value || 0; b.querySelector('#sw-p').innerHTML = preview(); });
    b.querySelector('[data-act=saveIng]').addEventListener('click', () => { const ov = Object.assign({}, s.ov || {}); ov[idx] = { f: cur, g: grams }; C.setPlanSlot(date, slot, { rid: s.rid, ov }); close(); root.UI.toast('הרכיב הוחלף והערכים עודכנו'); root.App.render(); });
  }
}
function addFoodSheet(date) {
  const foods = Object.entries(F).sort((a, b) => a[1].he.localeCompare(b[1].he, 'he'));
  const sh = root.UI.sheet('הוספת מזון ליומן', `<div class="seg" role="group"><button data-act="m" data-m="db" aria-pressed="true">ממאגר המזונות</button><button data-act="m" data-m="manual" aria-pressed="false">הזנה ידנית</button><button data-act="m" data-m="recipe" aria-pressed="false">ממתכון</button></div><div id="af"></div>`,
    { m: (el, e, close, b) => { b.querySelectorAll('[data-act=m]').forEach(x => x.setAttribute('aria-pressed', x === el)); mode(el.dataset.m, b, close); } });
  mode('db', sh.body, sh.close);
  function mode(m, b, close) {
    const box = b.querySelector('#af');
    if (m === 'db') {
      const blk = C.blockedFoods();
      box.innerHTML = `<div class="stack"><label class="field">מזון<select id="af-f">${foods.map(([k, f]) => `<option value="${k}">${esc(f.he)}${blk.has(k) ? ' ⚠ (' + C.KIND_HE[C.worstKind([k])] + ' — מוחרג אצלך)' : ''}</option>`).join('')}</select></label><p class="tiny bad" id="af-warn" hidden></p><label class="field">כמות בגרמים<input id="af-g" type="number" inputmode="numeric" min="1" value="100"></label><div id="af-p" class="kv"></div><button class="btn primary" id="af-ok">הוספה</button></div>`;
      const upd = () => { const f = box.querySelector('#af-f').value, g = +box.querySelector('#af-g').value || 0; const mm = L.roundM(L.ingMacros({ f, g })); const w = box.querySelector('#af-warn'); w.hidden = !blk.has(f); if (blk.has(f)) w.textContent = `${F[f].he.split(' (')[0]} מוגדר אצלך כ${C.KIND_HE[C.worstKind([f])]}. אפשר לרשום אותו אם אכלת — הרישום לא משנה את ההגבלה.`; box.querySelector('#af-p').innerHTML = fmt(mm) + `<span>${ST_HE[F[f].st]}</span>`; return { f, g, mm }; };
      box.querySelector('#af-f').addEventListener('change', upd); box.querySelector('#af-g').addEventListener('input', upd); upd();
      box.querySelector('#af-ok').addEventListener('click', () => { const { f, g, mm } = upd(); if (!g) return; if (blk.has(f) && !window.confirm(`${F[f].he.split(' (')[0]} מוגדר אצלך כ${C.KIND_HE[C.worstKind([f])]}. לרשום ביומן בכל זאת?`)) return; C.addEntry(date, { slot: null, source: 'custom', name: F[f].he.split(' (')[0] + ' ' + g + ' ג׳', grams: g, k: mm.k, p: mm.p, c: mm.c, f: mm.f, fb: mm.fb }); close(); root.App.render(); });
    } else if (m === 'manual') {
      box.innerHTML = `<div class="stack"><label class="field">שם המזון<input id="mn-n" type="text" placeholder="למשל: צ׳אי עם סוכר"></label><div class="grid2"><label class="field">קלוריות<input id="mn-k" type="number" inputmode="numeric" min="0"></label><label class="field">חלבון (ג׳)<input id="mn-p" type="number" inputmode="decimal" min="0"></label><label class="field">פחמימות (ג׳)<input id="mn-c" type="number" inputmode="decimal" min="0"></label><label class="field">שומן (ג׳)<input id="mn-f" type="number" inputmode="decimal" min="0"></label></div><p class="tiny faint">אם לא ידוע — השאירו 0. רק הקלוריות חובה.</p><button class="btn primary" id="mn-ok">הוספה</button></div>`;
      box.querySelector('#mn-ok').addEventListener('click', () => { const v = id => +box.querySelector(id).value || 0; const name = box.querySelector('#mn-n').value.trim(); if (!name || !v('#mn-k')) { root.UI.toast('נדרש שם וקלוריות'); return; } C.addEntry(date, { slot: null, source: 'custom', name, k: Math.round(v('#mn-k')), p: v('#mn-p'), c: v('#mn-c'), f: v('#mn-f'), fb: 0 }); close(); root.App.render(); });
    } else {
      box.innerHTML = `<div class="stack"><label class="field">מתכון<select id="rc-r">${N.RECIPES.map(r => { const cs = C.conflicts(r, null); return `<option value="${r.id}">${esc(r.he)}${cs.length ? ' ⚠ (' + esc(C.conflictText(cs)) + ')' : ''}</option>`; }).join('')}</select></label><label class="field">מנות<input id="rc-s" type="number" inputmode="decimal" step="0.25" min="0.25" value="1"></label><div id="rc-p" class="kv"></div><button class="btn primary" id="rc-ok">הוספה</button></div>`;
      const upd = () => { const r = L.recipe(box.querySelector('#rc-r').value), sc = +box.querySelector('#rc-s').value || 1, mm = L.recipeMacros(r, sc); box.querySelector('#rc-p').innerHTML = fmt(mm); return { r, sc, mm }; };
      box.querySelector('#rc-r').addEventListener('change', upd); box.querySelector('#rc-s').addEventListener('input', upd); upd();
      box.querySelector('#rc-ok').addEventListener('click', () => { const { r, sc, mm } = upd(); const cs = C.conflicts(r, null); if (cs.length && !window.confirm(`${r.he} ${C.conflictText(cs)} (${C.KIND_HE[C.worstKind(cs.map(c => c.f))]}). לרשום ביומן בכל זאת?`)) return; close(); addRecipeEntry(date, r, { slot: null, source: 'recipe', rid: r.id, name: r.he + (sc !== 1 ? ' ×' + sc : ''), k: mm.k, p: mm.p, c: mm.c, f: mm.f, fb: mm.fb }); });
    }
  }
}
function flexSheet(date) {
  const prefs = C.profile().prefs;
  root.UI.sheet(prefs.flexName, `<p class="small muted">בחרו ארוחה והזינו הערכה. הטווחים משוערים ומשתנים מאוד בין מקומות.</p><div class="list">${N.FLEX.map(f => `<button class="li li-btn" data-act="pick" data-id="${f.id}"><div class="grow"><div class="t">${esc(f.he)}</div>${f.range ? `<div class="s">≈ ${f.range[0]}–${f.range[1]} קק״ל · חלבון ${f.p[0]}–${f.p[1]} ג׳</div>` : '<div class="s">הזנת ערכים בעצמכם</div>'}</div></button>`).join('')}</div>`,
    { pick: (el, e, close, b) => { const f = N.FLEX.find(x => x.id === el.dataset.id);
        const mid = f.range ? Math.round((f.range[0] + f.range[1]) / 2) : '', pm = f.p ? Math.round((f.p[0] + f.p[1]) / 2) : '';
        b.innerHTML = `<h4>${esc(f.he)}</h4>${C.slotEntry(date, 'm2') ? `<div class="banner warn small" data-flex-m2>${icon('info')}<div>הארוחה השנייה של היום כבר מסומנת כנאכלה. הארוחה הגמישה תיספר <b>בנוסף</b> אליה. אם היא באה במקומה, בטלו קודם את הסימון של הארוחה השנייה.</div></div>` : ''}<label class="field">שם<input id="fx-n" type="text" value="${esc(f.range ? f.he : '')}"></label><div class="grid2"><label class="field">קלוריות (הערכה)<input id="fx-k" type="number" inputmode="numeric" value="${mid}"></label><label class="field">חלבון (ג׳)<input id="fx-p" type="number" inputmode="numeric" value="${pm}"></label></div><p class="tiny faint">${f.range ? 'הוצע אמצע הטווח. אפשר לעדכן.' : ''} הפחמימות והשומן מוערכים מהקלוריות (50% / 35%).</p><button class="btn primary" id="fx-ok">הוספה ליומן</button>`;
        b.querySelector('#fx-ok').addEventListener('click', () => { const k = +b.querySelector('#fx-k').value, p = +b.querySelector('#fx-p').value || 0, name = b.querySelector('#fx-n').value.trim() || prefs.flexName; if (!k) { root.UI.toast('נדרשות קלוריות'); return; }
          C.addEntry(date, { slot: null, source: 'flex', name, k, p, c: Math.round(k * 0.5 / 4), f: Math.round(k * 0.35 / 9), fb: 0, est: true }); close(); root.UI.toast('נרשם. ממשיכים כרגיל מהארוחה הבאה.'); root.App.render(); }); } });
}

/* recipes */
const RF = { all: 'הכל', ok: 'מתאים להעדפות שלי', fav: 'מועדפים', intl: 'בינלאומי', gf: 'ללא גלוטן (לפי מרכיבים)', indian: 'הודי', chicken: 'עוף', fish: 'דגים', egg: 'ביצים', veg: 'צמחוני (ללא עוף, בשר, דגים וביצים)', vegan: 'טבעוני', mealprep: 'הכנה מראש', quick: 'מהיר', local: 'מקומי', restaurant: 'מסעדה', m1: 'ארוחה 1', m2: 'ארוחה 2', snack: 'ביניים', extra: 'תוספות' };
/* Stage D: recipe list paging + search. All cards stay in the DOM (filters, counts and lazy images keep working);
   cards beyond the current page or not matching the search are hidden — the page is ~24 cards long instead of 133. */
const RC_PAGE = 24;
const rcText = r => [r.he, r.en, ...r.ing.map(x => (F[x.f] ? F[x.f].he + ' ' + x.f.replace(/_/g, ' ') : x.f))].join(' ').toLowerCase();
function rcApply() {
  const box = document.querySelector('[data-rc-list]'); if (!box) return;
  const q = (st.rq || '').trim().toLowerCase(), cards = [...box.querySelectorAll('.rcard')], shown = st.rcShown || RC_PAGE;
  const match = cards.filter(c => !q || q.split(/\s+/).every(w => c.dataset.q.includes(w)));
  cards.forEach(c => { c.hidden = true; }); match.slice(0, shown).forEach(c => { c.hidden = false; });
  const more = document.querySelector('[data-act=rcMore]'), none = document.querySelector('[data-rc-none]'), cnt = document.getElementById('rc-count');
  if (more) { more.hidden = match.length <= shown; more.textContent = `הצגת עוד ${Math.min(RC_PAGE, match.length - shown)} (מוצגים ${Math.min(shown, match.length)} מתוך ${match.length})`; }
  if (none) none.hidden = !(cards.length && !match.length);
  if (cnt) cnt.textContent = (q ? `${match.length} מתוך ${cards.length} מתכונים תואמים לחיפוש` : `${cards.length} מתכונים`) + '. כל הערכים למנה אחת, מחושבים מהמרכיבים.';
}
function rcPage() {
  const inp = document.getElementById('rc-q'); rcApply();
  if (inp) inp.addEventListener('input', () => { st.rq = inp.value; st.rcShown = RC_PAGE; rcApply(); });
}
/* M10.4: #/recipes and #/recipe moved to screens_recipes.js (on-demand chunk extra.js, first-load budget); shared helpers via Screens._nu */
Screens._nu = { fmt, diffTable, st, COST_HE, timeShort, ingLine, addRecipeEntry, prefBlocked, rcApply, rcPage, rcText, RC_PAGE, RF };
Screens.targetWarnings = function (opt) { opt = opt || {}; const w = C.targetWarnings().filter(x => !opt.only || opt.only.includes(x.level));
  return (w.length ? `<div class="stack tight" data-target-warnings>${w.map(x => `<div class="banner ${x.level === 'bad' ? 'bad' : x.level === 'warn' ? 'warn' : 'info'} small" data-tw="${x.k}">${icon('info')}<div>${esc(x.text)}</div></div>`).join('')}</div>` : '') + (opt.disclaimer ? `<p class="tiny faint" data-disclaimer>${esc(C.DISCLAIMER)}</p>` : ''); };
Screens.targets = function () {
  const p = C.profile(), a = C.autoTargets(), t = C.targets();
  if (!a) return { title: 'יעדים תזונתיים', back: '#/nutrition', html: Screens.needProfile('אי אפשר לחשב יעדים בלי גיל, גובה ומשקל'), handlers: {} };
  const prot = ['chicken_breast', 'egg', 'egg_white', 'paneer', 'soya', 'hung_curd', 'masoor', 'rajma', 'chana', 'milk'].map(f => ({ f, per: F[f].p }));
  return { title: 'יעדים תזונתיים', back: '#/nutrition', html: `<div class="seg" role="group" aria-label="תצוגה"><button data-act="tab" data-t="day" aria-pressed="false">תפריט ויומן</button><button data-act="tab" data-t="recipes" aria-pressed="false">מתכונים</button><button aria-pressed="true">יעדים</button></div>
    ${Screens.targetWarnings()}<section class="card hero"><span class="eyebrow">היעדים הפעילים${t.custom ? ' (הותאמו ידנית)' : ''}</span><div class="grid2"><div class="stat"><span class="v">${t.kcal}</span><span class="l">קק״ל ליום</span></div><div class="stat"><span class="v">${t.protein} ג׳</span><span class="l">חלבון</span></div><div class="stat"><span class="v">${t.carbs} ג׳</span><span class="l">פחמימות</span></div><div class="stat"><span class="v">${t.fat} ג׳</span><span class="l">שומן</span></div></div><a class="btn sm" href="#/settings">עריכת יעדים</a></section>
    <section class="card"><h3>איך חושב</h3><ul class="bul small">
      <li>BMR (מיפלין–סנט ג׳ור): 10×${p.weight} + 6.25×${p.height} − 5×${p.age} ${a.sexK >= 0 ? '+ ' + a.sexK : '− ' + Math.abs(a.sexK)} = <b>${a.bmr}</b> קק״ל. ${a.inputs.sexFrom === 'user' ? '' : a.inputs.sexFrom === 'legacy' ? '<span class="warn">הנוסחה לזכר נלקחה מהחישוב של הגרסה הקודמת — אפשר לעדכן בפרופיל.</span>' : '<span class="warn">מין לא הוזן — נעשה שימוש בממוצע בין הנוסחאות (הערכה פחות מדויקת).</span>'}</li>
      <li data-activity>מקדם פעילות ${a.af} — ${a.inputs.afFrom === 'user' ? `לפי רמת הפעילות שבחרת: <b>${esc(C.ACTIVITY_HE[a.inputs.activity][0])}</b>` : '<span class="warn">הנחה: לא נבחרה רמת פעילות, נעשה שימוש באמצע הטווח "יושבני" (1.40–1.69)</span> — <a href="#/profile">בחירה בפרופיל</a>'} ⇐ הוצאה משוערת <b>${a.tdee}</b> קק״ל. טווח סביר: ${a.tdeeLow}–${a.tdeeHigh}. המקדם מתאר את כל היום — עבודה, הליכה <b>ואימונים</b> — לפי קטגוריות FAO/WHO/UNU; מספר האימונים בתוכנית לא מתווסף אליו בנפרד.</li>
      <li>${a.deficit > 0 ? `גירעון מתון של ${Math.round(a.deficit * 100)}%` : a.deficit < 0 ? `עודף מתון של ${Math.round(-a.deficit * 100)}%` : 'ללא גירעון (שימור)'} ⇐ <b>${a.kcal}</b> קק״ל (מעוגל). ${a.inputs.deficitFrom === 'minor' ? 'גיל מתחת ל־18 — שימור בלבד (ראו למעלה).' : a.inputs.deficitFrom === 'underweight' ? 'BMI מתחת ל־18.5 — ללא גירעון (ראו למעלה).' : a.inputs.deficitFrom === 'goal' ? 'לפי המטרה שבחרת.' : a.inputs.deficitFrom === 'legacy' ? 'לפי ההנחה של הגרסה הקודמת (ירידה בשומן) — בחירת מטרה בפרופיל תעדכן.' : 'לא נבחרה מטרה.'} זו הערכה של המערכת, לא הבטחה לקצב ירידה או עלייה.</li>
      <li>חלבון ~1.8 ג׳ לק״ג משקל (${p.weight} ק״ג) ⇐ <b>${a.protein}</b> ג׳ — טווח מקובל (1.6–2.2) לשמירה על מסת שריר ובנייתה בגירעון.</li>
      <li>שומן ~25% מהקלוריות ⇐ <b>${a.fat}</b> ג׳. פחמימות — היתרה ⇐ <b>${a.carbs}</b> ג׳ (דלק לאימונים). סיבים: 30 ג׳ ומעלה.</li></ul>
      ${a.floored ? `<p class="small warn">לפני ההגבלה: ${a.kcalRaw} קק״ל ⇐ הוגבל ל־${a.kcal} (ראו למעלה).</p>` : ''}<p class="tiny faint" data-disclaimer>${esc(C.DISCLAIMER)}</p><div class="banner warn small">${icon('info')}<div>זו הערכה התחלתית. ההוצאה האמיתית יכולה להיות שונה ב־10% ויותר. אין הבטחה לירידה של מספר ק״ג מסוים ב־30 יום. בודקים מגמה של 2–3 שבועות (ממוצע שקילות + היקף מותניים), ולא יום בודד, ורק אז מעדכנים.</div></div></section>
    <section class="card"><h3>איך מגיעים ל־${t.protein} ג׳ חלבון</h3><p class="small">התפריט הבסיסי (שתי ארוחות עיקריות וארוחת ביניים, בלי תוספת) מתוכנן כך שבכל אחד מ־30 הימים הוא מגיע ל־${t.protein} ג׳ חלבון לפחות, לפי היעד שחושב מהפרופיל. בחלק מהימים כמויות מותאמות לאותו יום — זה מסומן "כמות המנה חושבה בהתאם לתכנון התזונתי היומי": מקור החלבון (עוף, סויה, קטניות, פניר, יוגורט מסונן) מוגדל כדי להגיע ליעד החלבון, ובחלק מהימים גם פחמימה (אורז, פוהה, שיבולת שועל, תפוח אדמה, נודלס), פרי או אפונה מוגדלים כדי לקרב את האנרגיה היומית ל־2,200 קק״ל (ובלי לעבור 2,450). ההגדלות מוגבלות בתקרה לכל מרכיב. בפתיחת המתכון מתוך התפריט מוצגות הכמויות של אותו יום, ולצידן הכמות המקורית במתכון. החלפת ארוחה, שינוי העדפות או שינוי היעד בהגדרות עלולים להוריד את הסכום — אז הפער מוצג ביומן, עם הצעות להשלמה. תוספת החלבון נשארת רשות ונספרת רק כשבוחרים בה.</p><div class="tbl-wrap"><table class="tbl"><tr><th>מקור</th><th>חלבון ל־100 ג׳</th></tr>${prot.map(x => `<tr><td>${esc(F[x.f].he)} <span class="faint tiny">(${ST_HE[F[x.f].st]})</span></td><td class="n">${x.per}</td></tr>`).join('')}</table></div></section>`,
    handlers: { tab: el => { location.hash = el.dataset.t === 'day' ? '#/nutrition' : '#/recipes'; } } };
};
})(window);
