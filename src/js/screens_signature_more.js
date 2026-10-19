/* RC5 · Stage G screens moved out of the first load: Explain My Plan (#/explain), Weekly Review (#/review[/w]),
   Records & milestones (#/records). Unchanged code from screens_signature.js; logic lives in signature.js. On-demand chunk extra.js. */
(function (root) {
'use strict';
const { esc, icon } = root.UI; const S = root.Store, C = root.Core, G = () => root.Signature, PS = () => root.Plans;
const Screens = root.Screens;
const noPlan = (title, what) => ({ title, back: '#/', html: `<section class="card" data-empty-state><h2>${esc(what)}</h2><p class="small muted">המסך הזה מבוסס על תוכנית אישית פעילה. אפשר לבנות תוכנית לפי מטרה, ציוד וזמינות.</p><a class="btn primary" href="#/setup/1">${icon('route')} בניית תוכנית</a></section>`, handlers: {} });
const fmtN = n => n == null ? '—' : Number(n).toLocaleString('he-IL');

Screens.explain = function () {
  const p = PS().active(); if (!p) return noPlan('למה ככה?', 'אין עדיין תוכנית להסביר');
  const ex = G().explain(p);
  return { title: 'למה התוכנית שלי כזו', back: '#/plan', html: `<section class="card hero"><span class="eyebrow">הסבר התוכנית</span><h2>${esc(root.PROGRAMS.byId(p.templateId).he)}</h2><p class="small muted">כל משפט כאן מחושב מההגדרות שלך ומהתוכנית שנוצרה — אין כאן טקסט כללי.</p></section>
    ${ex.map(s => `<section class="card" data-explain="${s.k}"><h3>${esc(s.h)}</h3><ul class="bul small">${s.items.map(x => `<li>${esc(x)}</li>`).join('')}</ul></section>`).join('')}
    <div class="btns"><a class="btn" href="#/plan">${icon('route')} לתוכנית</a><a class="btn" href="#/targets">${icon('food')} היעדים</a></div>`, handlers: {} };
};

/* G2 */
Screens.review = function (arg) {
  const p = PS().active(); if (!p) return noPlan('סיכום שבועי', 'אין עדיין שבועות לסכם');
  const r = G().review(p, arg ? +arg : null); if (!r) return noPlan('סיכום שבועי', 'אין עדיין שבועות לסכם');
  const i = r.weeks.indexOf(r.w), t = r.training, nu = r.nutrition, tk = r.tracking;
  const line = (l, v) => `<span class="l">${l}</span><span>${v}</span>`;
  return { title: 'סיכום שבועי', back: '#/progress', html: `
    <div class="row between month-nav"><a class="btn sm" ${i > 0 ? `href="#/review/${r.weeks[i - 1]}"` : 'aria-disabled="true"'} aria-label="השבוע הקודם">${icon('back')}</a><h2 class="num">שבוע ${r.w} בתוכנית</h2><a class="btn sm" ${i < r.weeks.length - 1 && r.weeks[i + 1] && r.next && r.next.from <= S.today() ? `href="#/review/${r.weeks[i + 1]}"` : 'aria-disabled="true"'} aria-label="השבוע הבא">${icon('chev')}</a></div>
    <p class="small muted center">${esc(S.fmtDate(r.from))} – ${esc(S.fmtDate(r.to))} · ${esc(r.phase ? r.phase.he : '')}${r.deload ? ' · שבוע קל' : ''}${r.current ? ' · <b>השבוע הנוכחי — עדיין לא הסתיים</b>' : ''}</p>
    <section class="card" data-review="training"><h3>אימונים</h3><div class="grid3"><div class="stat"><span class="v num">${t.done + t.partial}/${t.planned}</span><span class="l">בוצעו${t.partial ? ` (${t.partial} חלקית)` : ''}</span></div><div class="stat"><span class="v num">${t.minutes || '—'}</span><span class="l">דקות שנמדדו</span></div><div class="stat"><span class="v num">${t.rpe != null ? t.rpe : '—'}</span><span class="l">מאמץ ממוצע /10</span></div></div>
      <p class="tiny muted">${t.skipped ? `דילוג מכוון: ${t.skipped}. ` : ''}${t.missed ? `לא בוצעו: ${t.missed}. ` : ''}${!t.done && !t.partial ? 'לא נרשמו אימונים בשבוע הזה.' : ''}</p>
      ${r.bests.length ? `<h4>שיאים חדשים השבוע</h4><ul class="bul small">${r.bests.map(b => `<li>${esc(root.EX_BY_ID[b.ex].he)}: ${b.from} ← <b>${b.to}</b> ${b.unit === 'sec' ? 'שנ׳' : 'חזרות'}</li>`).join('')}</ul>` : ''}</section>
    <section class="card" data-review="nutrition"><h3>תזונה — מה שנרשם בפועל</h3>${nu.daysLogged ? `<div class="facts">${line('ימים עם רישום', `${nu.daysLogged} מתוך ${nu.ofDays}`)}${line('ממוצע קלוריות', `${fmtN(nu.kcal)}${nu.target ? ' / יעד ' + fmtN(nu.target.kcal) : ''}`)}${line('ממוצע חלבון', `${fmtN(nu.protein)} ג׳${nu.target ? ' / יעד ' + nu.target.protein : ''}`)}</div><p class="tiny faint">ממוצע רק על ימים שבהם נרשמה ארוחה. ימים בלי רישום לא נספרים כאפס.</p>` : '<div class="empty">לא נרשמו ארוחות בשבוע הזה.</div>'}</section>
    <section class="card" data-review="tracking"><h3>צעדים, שינה ומים</h3>${tk.steps || tk.sleep || tk.water ? `<div class="facts">${tk.steps ? line('צעדים', `${fmtN(tk.steps.avg)} בממוצע (${tk.steps.days} ימים)`) : ''}${tk.sleep ? line('שינה', `${tk.sleep.avg} שע׳ בממוצע (${tk.sleep.days} לילות)`) : ''}${tk.water ? line('מים', `${fmtN(tk.water.avg)} מ״ל בממוצע (${tk.water.days} ימים)`) : ''}</div>` : '<div class="empty">לא נרשמו צעדים, שינה או מים.</div>'}</section>
    <section class="card" data-review="weight"><h3>משקל</h3>${r.weight ? `<p class="small">${r.weight.n} שקילות. אחרונה: <b class="num">${r.weight.last}</b> ק״ג${r.weight.prev != null ? ` (לפני השבוע: ${r.weight.prev})` : ''}.</p><p class="tiny faint">שינוי משקל בשבוע אחד מושפע ממים, מלח ועיכול — הוא לא מדד לשינוי בשומן. כדאי להסתכל על מגמה של כמה שבועות.</p>` : '<div class="empty">אין שקילה בשבוע הזה.</div>'}</section>
    ${r.next ? `<section class="card" data-review="next"><h3>השבוע הבא</h3><p class="small">${r.next.sessions} אימונים, כ־${r.next.minutes} דק׳ בסך הכול${r.next.deload ? ' · שבוע קל מתוכנן' : ''}${r.next.phase && (!r.phase || r.next.phase.k !== r.phase.k) ? ` · מתחיל שלב חדש: ${esc(r.next.phase.he)}` : ''}.</p>${r.adapt ? `<p class="small">יש ${r.adapt} התאמות מוצעות לאישורך. <a href="#/plan">לצפייה</a></p>` : ''}</section>` : ''}`, handlers: {} };
};

/* G3 */
/* RC5: Screens.shopping moved to screens_shopping.js (on-demand chunk extra.js) */

/* G4 */
Screens.records = function () {
  const rec = G().records(), ms = G().milestones(), LV = C.LEVEL_HE;
  const byEx = {}; rec.forEach(r => { (byEx[r.ex] = byEx[r.ex] || []).push(r); });
  return { title: 'שיאים ואבני דרך', back: '#/progress', html: `
    <section class="card" data-records><h3>שיאים אישיים</h3>${rec.length ? `<div class="tbl-wrap"><table class="tbl"><tr><th>תרגיל</th><th>רמה</th><th>שיא</th><th>ראשון</th><th>מתי</th></tr>${Object.entries(byEx).map(([ex, l]) => l.map((r, i) => `<tr><td>${i ? '' : `<a href="#/ex/${ex}">${esc(root.EX_BY_ID[ex].he)}</a>`}</td><td>${r.lvl ? esc(LV[r.lvl]) : 'קלאסית'}</td><td class="n"><b>${r.v}</b>${r.unit === 'sec' ? ' שנ׳' : ''}</td><td class="n">${r.first.v}</td><td class="tiny">${esc(S.fmtShort(r.date))}</td></tr>`).join('')).join('')}</table></div>
      <p class="tiny faint">השיא = מספר החזרות או השניות הגבוה ביותר בסט אחד. שיאים נספרים בנפרד לכל רמת קושי, כי 10 שכיבות סמיכה על הברכיים ו־10 רגילות הן לא אותו הישג. בתוכנית הקלאסית הרמה לא נשמרה באימונים ישנים.</p>` : '<div class="empty" data-empty-state>השיאים יופיעו אחרי אימונים שנרשמים דרך "התחלת אימון" עם סימון סטים.</div>'}</section>
    <section class="card" data-milestones><h3>אבני דרך</h3>${ms.length ? `<div class="list">${ms.map(m => `<div class="li"><span class="pill good">✓</span><div class="grow"><div class="t small">${esc(m.he)}</div><div class="s">${esc(S.fmtDate(m.date))}</div></div></div>`).join('')}</div>` : '<div class="empty" data-empty-state>עוד אין אבני דרך. הראשונה: האימון הראשון שנרשם.</div>'}
      <p class="tiny faint">כל אבן דרך מחושבת מרישומים שלך (אימונים, זמן שנמדד, שבועות שנשמרו ומבחנים). אין השוואה למשתמשים אחרים.</p></section>`, handlers: {} };
};

})(window);
