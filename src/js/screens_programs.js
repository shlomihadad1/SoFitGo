/* Stage A screens: program catalog + read-only preview (nothing is activated or changed), and media status. */
(function (root) {
const { esc, icon } = root.UI;
const S = root.Store, C = root.Core;
const Screens = root.Screens;
const PG = () => root.PROGRAMS, PL = () => root.Planner, CT = () => root.CATALOG;
const st = { days: 4, level: 'beginner', min: null, goal: null, eq: [], showWeeks: 2 };
const DOW_HE = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
const LEN = d => d == null ? 'לבחירה (1–365 ימים)' : d % 7 === 0 && d >= 28 ? `${d / 7} שבועות (${d} ימים)` : `${d} ימים`;
const EQ = t => t.equipment.map(e => CT().EQUIPMENT[e] ? CT().EQUIPMENT[e].he : e).join(', ');

Screens.programs = function () {
  const list = PG().TEMPLATES, ap = root.Plans && root.Plans.active();
  const nm = t => t.he.replace(/\s*\(התוכנית הנוכחית\)$/, ''); /* the data label says "(current)" for the classic program; the "פעילה" pill now shows the real active one */ /* M8: the note named the classic program even when a personal plan was active, and said activation "comes later" although setup already activates plans */
  return { title: 'מסלולים', back: '#/workouts', html: `
    <div class="banner info small" data-programs-note>${icon('info')}<div>קטלוג מסלולים — <b>תצוגה מקדימה בלבד</b>: צפייה כאן לא משנה את ${ap ? `התוכנית הפעילה שלך (<b>${esc((PG().byId(ap.templateId) || {}).he || 'תוכנית אישית')}</b>)` : 'התוכנית הנוכחית (התוכנית הקלאסית, 30 יום)'}. הפעלת מסלול נעשית דרך <a href="#/setup/1">בניית תוכנית אישית</a>, עם תצוגה מקדימה ואישור לפני כל שינוי.</div></div>
    <div class="list prog-list">${list.map(t => `<a class="pcard" href="#/program/${t.id}"><div class="pc-h"><span class="pc-len">${t.days == null ? 'אישי' : t.days >= 28 ? Math.round(t.days / 7) + ' שב׳' : t.days + ' ימים'}</span><div class="grow"><b>${esc(nm(t))}</b>${(ap ? ap.templateId === t.id : t.classic) ? ' <span class="pill good" data-active-program>פעילה</span>' : ''}<div class="tiny muted">${esc(t.audience)}</div></div>${icon('chev', 'chev')}</div>
      <div class="kv tiny"><span>${t.spw} אימונים בשבוע</span><span>עד ${t.minutes} דק׳</span><span>${esc(EQ(t))}</span>${t.needsLibrary ? '<span class="pill warn">ספרייה חסרה</span>' : ''}</div></a>`).join('')}</div>` , handlers: {} };
};

Screens.program = function (id) {
  const t = PG().byId(id); if (!t) return { title: 'לא נמצא', html: '<div class="empty">המסלול לא נמצא</div>', handlers: {} };
  const apD = root.Plans && root.Plans.active();
  const head = `<section class="card"><h1>${esc(t.he.replace(/\s*\(התוכנית הנוכחית\)$/, ''))}</h1><p class="small muted">${esc(t.audience)}</p>
    <div class="kv"><span>משך: <b>${LEN(t.days)}</b></span><span>אימונים בשבוע: <b>${t.spw}</b></span><span>זמן מקסימלי לאימון: <b>${t.minutes} דק׳</b></span></div>
    <dl class="pdl"><dt>מטרות</dt><dd>${t.goals.map(g => esc(PG().GOALS[g])).join(' · ')}</dd><dt>ציוד</dt><dd>${esc(EQ(t))}</dd><dt>עקרונות תזונה</dt><dd>${esc(t.nutrition)}</dd><dt>אפשרויות התאמה</dt><dd>${esc(t.adapt)}</dd><dt>מגבלות</dt><dd>${esc(t.limits)}</dd></dl></section>`;
  if (t.classic) return { title: 'מסלול', back: '#/programs', html: head + `<section class="card"><p>${apD ? 'התוכנית הקלאסית: 30 יום קבועים עם גרסאות של 15, 30 ו־60 דקות. כרגע פעילה אצלך תוכנית אישית אחרת, ולכן היא לא בשימוש.' : 'זו התוכנית הפעילה: 30 יום קבועים עם גרסאות של 15, 30 ו־60 דקות.'}</p><a class="btn ${apD ? '' : 'primary'}" href="#/workouts">${icon('dumbbell')} ${apD ? 'לאימונים' : 'לתוכנית 30 היום'}</a></section>`, handlers: {} };
  const p = C.profile ? C.profile() : {};
  const allDays = [0, 1, 2, 3, 4, 5, 6], n = Math.min(6, st.days);
  const prof = { level: st.level, maxMin: st.min || t.minutes, days: allDays, spw: n, equipment: st.eq, goal: st.goal || t.goals[0], exclude: [] };
  let plan, err = null;
  try { plan = PL().build(t.id, { start: S.today(), days: t.custom ? 84 : undefined, profile: prof, goal: prof.goal }); } catch (e) { err = e.message; }
  if (err) return { title: 'מסלול', back: '#/programs', html: head + `<div class="banner warn">${esc(err)}</div>`, handlers: {} };
  const s = plan.summary, total = s.days;
  const PH_COL = { intro: 'var(--glacier)', base: 'var(--good)', volume: 'var(--carb)', advanced: 'var(--accent)', assess: 'var(--fat)', maintain: '#7aa2ff' };
  const timeline = `<div class="ptl" role="img" aria-label="שלבי המסלול">${s.phases.map(ph => `<div class="ptl-s" style="flex:${ph.endDay - ph.startDay + 1};background:${PH_COL[ph.k]}" title="${esc(ph.he)}"></div>`).join('')}</div>
    <ol class="ptl-l">${s.phases.map(ph => `<li><i style="background:${PH_COL[ph.k]}"></i><div><b>${esc(ph.he)}</b> <span class="tiny muted">ימים ${ph.startDay}–${ph.endDay} · ${ph.weeks} שב׳</span><div class="tiny faint">${esc(ph.focus)}</div></div></li>`).join('')}</ol>`;
  const weeks = []; for (let w = 1; w <= Math.min(st.showWeeks, Math.ceil(total / 7)); w++) weeks.push(plan.days.filter(d => d.week === w));
  const dayRow = d => `<li class="pday t-${d.type}"><div class="pd-h"><span class="pd-n num">${d.n}</span><b>${esc(d.title)}</b>${d.minutes ? `<span class="tiny muted">~${Math.round(d.minutes)} דק׳</span>` : ''}</div>${d.main && d.main.length ? `<div class="tiny muted">${d.main.map(x => esc(root.EX_BY_ID[x.ex].he) + ' ' + esc(Screens.target(x))).join(' · ')}</div>` : ''}${d.finisher && d.finisher.length ? `<div class="tiny faint">סיום: ${d.finisher.map(x => esc(root.EX_BY_ID[x.ex].he)).join(', ')}</div>` : ''}${d.notes.length ? `<div class="tiny warn">${d.notes.map(esc).join(' ')}</div>` : ''}</li>`;
  const html = head + `
    <section class="card"><h3>התאמה לתצוגה המקדימה</h3><p class="tiny faint">משנה רק את התצוגה כאן — לא נשמר ולא משנה את התוכנית שלך.</p>
      <div class="field-row"><span class="small">אימונים בשבוע</span><div class="chips">${[2, 3, 4, 5, 6].map(k => `<button class="chip" data-act="pd" data-v="${k}" aria-pressed="${k === n}">${k}</button>`).join('')}</div></div>
      <div class="field-row"><span class="small">רמה</span><div class="chips">${['beginner', 'intermediate', 'advanced'].map(l => `<button class="chip" data-act="pl" data-v="${l}" aria-pressed="${l === st.level}">${PL().LEVEL_HE[l]}</button>`).join('')}</div></div>
      <div class="field-row"><span class="small">זמן מקסימלי</span><div class="chips">${[15, 20, 30, 45, 60].map(m => `<button class="chip" data-act="pm" data-v="${m}" aria-pressed="${m === prof.maxMin}">${m}′</button>`).join('')}</div></div>
      <div class="field-row"><span class="small">מטרה</span><div class="chips" style="flex-wrap:wrap">${t.goals.map(g => `<button class="chip" data-act="pg" data-v="${g}" aria-pressed="${g === prof.goal}">${esc(PG().GOALS[g])}</button>`).join('')}</div></div></section>
    ${s.gaps.length ? `<div class="banner warn small">${icon('info')}<div>${s.gaps.map(esc).join('<br>')}</div></div>` : ''}
    <section class="card"><h3>שלבים</h3>${timeline}</section>
    <section class="card"><h3>סיכום</h3><div class="grid3 pstats">
      <div class="stat"><span class="v num">${s.sessions}</span><span class="l">אימונים</span></div><div class="stat"><span class="v num">${s.rest}</span><span class="l">ימי מנוחה</span></div><div class="stat"><span class="v num">${s.active}</span><span class="l">התאוששות (רשות)</span></div>
      <div class="stat"><span class="v num">${s.assess}</span><span class="l">מבחני כושר</span></div><div class="stat"><span class="v num">${s.deloadWeeks}</span><span class="l">שבועות קלים</span></div><div class="stat"><span class="v num">${s.avgMinutes}</span><span class="l">דק׳ בממוצע</span></div></div>
      <p class="tiny faint">${s.exercisesUsed} תרגילים שונים · ${s.distinctSessions} אימונים שונים מתוך ${s.sessions}. זמנים מחושבים (3.5 שנ׳ לחזרה, 8 שנ׳ מעבר, מנוחות) — הערכה.</p></section>
    <section class="card"><h3>שבועות ראשונים</h3>${weeks.map((w, i) => `<h4>שבוע ${i + 1}${w.some(d => d.deload) ? ' · קל' : ''}</h4><ol class="pdays">${w.map(dayRow).join('')}</ol>`).join('')}
      ${st.showWeeks < Math.ceil(total / 7) ? '<button class="btn sm ghost" data-act="more">עוד שבועיים</button>' : ''}</section>
    <p class="tiny faint">אחרי הפעלה, לכל יום בתוכנית נבנה תפריט אישי לפי היעדים וההעדפות שלך.</p>`;
  const set = (k, v) => { st[k] = v; root.App.render(); };
  return { title: 'מסלול', back: '#/programs', html, handlers: {
    pd: el => set('days', +el.dataset.v), pl: el => set('level', el.dataset.v), pm: el => set('min', +el.dataset.v), pg: el => set('goal', el.dataset.v), more: () => set('showWeeks', st.showWeeks + 2) } };
};

Screens.media = function () {
  const s = root.Media.stats(), M = root.MEDIA || { ex: {}, rc: {}, credits: {} }, tab = Screens._mtab || 'ex';
  const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
  const row = (label, a, b, note) => `<div class="mrow"><span>${label}</span><div class="meter ${a === b ? 'good' : ''}"><i style="width:${pct(a, b)}%"></i></div><b class="num">${a}/${b}</b>${note ? `<span class="tiny faint">${note}</span>` : ''}</div>`;
  const off = !root.Media.enabled();
  const exList = root.EXERCISES.map(e => { const m = M.ex[e.id] || {}; return `<a class="li" href="#/ex/${e.id}">${m.poster && !off ? root.Media.image(m.poster, e.he, { aspect: '16/9', cls: 'mthumb', sizes: '120px', fallback: Screens.thumb(e.id) }) : Screens.thumb(e.id)}<div class="grow"><div class="t">${esc(e.he)}</div><div class="kv tiny"><span class="pill good">הוראות: ${(e.steps || []).length} שלבים</span><span class="pill ${m.poster ? 'good' : ''}">איור: ${m.poster ? 'קיים' : 'אין'}</span><span class="pill">סרטון: ${m.video ? 'קיים' : 'אין'}</span></div></div></a>`; }).join('');
  const rcList = root.NUTRI.RECIPES.map(r => { const m = M.rc[r.id] || {}; return `<a class="li" href="#/recipe/${r.id}"><div class="dish-art mthumb">${root.UI.dishArt(r)}</div><div class="grow"><div class="t">${esc(r.he)}</div><div class="kv tiny"><span class="pill good">הוראות: ${r.steps.length} שלבים</span><span class="pill">צילום: ${m.photo ? 'קיים' : 'אין'}</span><span class="pill">סרטון הכנה: ${m.prep ? 'קיים' : 'אין'}</span><span class="pill">תמונות שלבים: ${m.steps && m.steps.length ? m.steps.length : 'אין'}</span></div></div></a>`; }).join('');
  const credits = Object.entries(M.credits || {});
  return { title: 'מצב מדיה', back: '#/settings', html: `
    ${off ? '<div class="banner warn small"><div>בגרסה שמתארחת בתוך Claude אין תיקיית מדיה — מוצגים איורים בלבד.</div></div>' : ''}
    <section class="card"><h3>מה קיים בפועל</h3>
      ${row('הוראות ביצוע מלאות לתרגילים', root.EXERCISES.filter(e => e.start && (e.steps || []).length >= 3 && e.breath && (e.mistakes || []).length && e.levels).length, s.exercises, 'תנוחת התחלה, שלבים, נשימה, טעויות נפוצות ורמות')}
      ${row('הוראות הכנה מלאות למתכונים', root.NUTRI.RECIPES.filter(r => (r.ing || []).length && (r.steps || []).length >= (r.est ? 1 : 2)).length, s.recipes, 'מרכיבים עם כמויות ושלבים ממוספרים')}
      ${row('תמונות שער לתרגילים', s.covers, s.exercises, 'איורים מקוריים שנוצרו מהדמות של האפליקציה')}
      ${row('סרטוני הדגמה לתרגילים', s.videos, s.exercises)}
      ${row('צילומי מנות', s.photos, s.recipes)}
      ${row('סרטוני הכנה', s.prep, s.recipes)}
      ${row('תמונות שלבי הכנה', s.stepSets, s.recipes)}
      <p class="tiny faint">כשאין סרטון או צילום מוצג איור שמסומן "איור" — לעולם לא כאילו הוא סרטון או צילום. סרטונים לא נשמרים לשימוש ללא חיבור; תמונות שנצפו נשמרות במטמון מוגבל.</p></section>
    <div class="seg" role="group" aria-label="רשימה"><button data-act="mt" data-v="ex" aria-pressed="${tab === 'ex'}">תרגילים (${s.exercises})</button><button data-act="mt" data-v="rc" aria-pressed="${tab === 'rc'}">מתכונים (${s.recipes})</button><button data-act="mt" data-v="cr" aria-pressed="${tab === 'cr'}">מקורות (${credits.length})</button></div>
    <section class="card"><div class="list">${tab === 'ex' ? exList : tab === 'rc' ? rcList : (credits.length ? credits.map(([k, c]) => `<div class="li"><div class="grow"><div class="t ltr">${esc(k)}</div><div class="tiny">${esc(c.author)} · ${esc(c.license)}${c.licenseUrl ? ` · <a href="${esc(c.licenseUrl)}" target="_blank" rel="noopener">רישיון</a>` : ''}</div><div class="tiny faint">${esc(c.source)}</div></div></div>`).join('') : '<div class="empty">אין עדיין מדיה של צד שלישי. תמונות השער הן יצירה מקורית שנוצרה בקוד האפליקציה.</div>')}</div></section>`,
    handlers: { mt: el => { Screens._mtab = el.dataset.v; root.App.render(); } } };
};
})(window);
