/* RC5 · #/activity — steps: data source status, personal target, MoveScore (proposal v0) and a 14-day provenance list. */
(function (root) {
const { esc, icon } = root.UI;
const S = root.Store, C = root.Core, A = root.Activity;
const Screens = root.Screens;
const STATE_HE = { never: 'לא מחובר', connected: 'מחובר — הקריאה האחרונה הצליחה', 'connected-empty': 'הקריאה הצליחה אבל לא התקבלו צעדים', denied: 'ההרשאה לא ניתנה', error: 'שגיאה בקריאה' };
const PART_HE = { progress: 'התקדמות ליעד', consistency: 'עקביות', trend: 'מגמה' };
function restSet(today, n) { /* rest = a day of the user's plan without training; no plan → no rest days assumed */
  const out = new Set(), ap = root.Plans && root.Plans.active();
  for (let i = 0; i < n; i++) { const d = S.addDays(today, -i);
    if (ap) { const pd = root.Insights && root.Insights.mainOn ? root.Insights.mainOn(ap, d) : null; if (pd && !root.Plans.isTraining(pd)) out.add(d); }
    else { const k = C.programDay(d); if (k >= 1 && k <= 30 && !C.isTraining(k)) out.add(d); } }
  return out;
}
Screens.activity = function () {
  const today = S.today(), e = A.env(), h = A.health(), tg = A.targetOn(today), hist = A.history(today, 35, restSet(today, 35)), ms = A.moveScore(hist, tg), sug = A.suggestTarget(hist), html = [];
  const t = S.load('tracking'), hasMeasured = t.measured && Object.keys(t.measured).length > 0, srcName = A.SRC_HE[e.src] || 'Apple Health';
  html.push(`<section class="card" data-health-source><h2>מקור נתוני הצעדים</h2>
    <div class="kv"><span class="pill" data-env="${e.native ? e.platform : (e.standalone ? 'pwa' : 'browser')}">${e.native ? (e.platform === 'ios' ? 'אפליקציית iPhone' : 'אפליקציית Android') : e.standalone ? 'אפליקציית רשת (PWA)' : 'דפדפן'}</span><span class="pill ${h.state === 'connected' ? 'good' : ''}" data-health-state="${h.state}">${e.native ? esc(srcName) + ': ' + STATE_HE[h.state] : 'Apple Health: לא זמין כאן'}</span></div>
    <p class="small">${esc(A.envText(e))}</p>
    ${h.lastOkAt ? `<p class="tiny muted">סנכרון אחרון שהצליח: ${esc(new Date(h.lastOkAt).toLocaleString('he-IL'))}</p>` : ''}${h.state === 'error' && h.lastError ? `<p class="tiny bad">${esc(h.lastError)}</p>` : ''}${h.state === 'connected-empty' && e.platform === 'ios' ? '<p class="tiny muted">ב־iPhone אי אפשר לדעת מתוך האפליקציה אם ההרשאה נדחתה — במקרה כזה פשוט לא מתקבלים נתונים. אפשר לבדוק ב: הגדרות ← בריאות ← גישה לנתונים ומכשירים.</p>' : ''}
    ${e.native && e.plugin ? `<div class="btns">${h.state === 'never' || h.state === 'denied' || h.state === 'error' ? `<button class="btn primary" data-act="hConnect">${icon('steps')} חיבור ${esc(srcName)} (קריאת צעדים בלבד)</button>` : `<button class="btn" data-act="hSync">סנכרון עכשיו</button><button class="btn ghost" data-act="hOff">הפסקת שימוש במקור</button>`}</div>` : ''}
    <details class="more"><summary>מה נקרא, איפה זה נשמר ומה עוד חסר</summary><ul class="bul small"><li>נקרא רק מספר הצעדים היומי (ללא כתיבה, ללא נתוני בריאות אחרים). הנתונים נשמרים רק במכשיר הזה ולא נשלחים לשום שרת.</li><li>הסכום היומי מגיע מהחישוב של ${esc(srcName)} עצמו, שמאחד טלפון ושעון, ולכן אין ספירה כפולה. סנכרון חוזר מחליף את ערך היום ולא מוסיף עליו.</li><li>ביום שיש בו נתון שנמדד, הוא קובע; הזנה ידנית נשמרת ומסומנת "הוזן ידנית".</li><li>${e.native ? 'סנכרון ברקע לא מופעל — הסנכרון קורה כשהאפליקציה פתוחה.' : 'חיבור אמיתי דורש את אפליקציית ה־iPhone/Android (בהכנה), ובדיקה במכשיר. באתר הזה החיבור לא יוצג כמחובר.'}</li></ul></details>
    ${hasMeasured ? '<button class="btn sm ghost" data-act="hDel">מחיקת הצעדים שיובאו (מהמכשיר או מקובץ)</button>' : ''}</section>`);
  html.push(`<section class="card" data-steps-file><h3>ייבוא צעדים מקובץ</h3><p class="small">יש לך צעדים באפליקציה אחרת? מייצאים משם קובץ CSV (תאריך, צעדים) ומייבאים כאן. הנתונים מסומנים "יובא מקובץ"; ייבוא חוזר של אותם תאריכים מחליף ולא מוסיף.</p><button class="btn" data-act="stepsFile">${icon('plus')} ייבוא מקובץ</button></section>`); /* M11.4 */
  html.push(`<section class="card" data-burned-info><h3>קלוריות שנשרפו</h3><p class="small">האפליקציה <b>לא מציגה</b> קלוריות שנשרפו, כי אין לה מדידה של זה: אין חיבור לשעון או לאנרגיה פעילה מ־${esc(srcName)}, והיא לא מנחשת לפי אימונים.</p><p class="tiny muted">בגרסת האפליקציה ל־iPhone אפשר יהיה בעתיד לבקש הרשאה לקריאת "אנרגיה פעילה" — זה עוד לא מומש ולא נבדק. הקלוריות ש"נצרכו" בבית הן הערכה לפי המתכונים שסימנתם ביומן.</p></section>`);
  html.push(`<section class="card" data-step-target><h2>יעד צעדים אישי</h2><p class="small">${tg ? `היעד הנוכחי: <b class="num">${tg.toLocaleString('he-IL')}</b>` : 'לא נקבע יעד. אין מספר אחד שמתאים לכולם, ולכן לא נקבע יעד מראש.'}</p>
    <div class="row"><input id="st-v" type="number" inputmode="numeric" min="0" step="500" placeholder="למשל 6000" value="${tg || ''}"><button class="btn sm" data-act="stSave">שמירה</button>${tg ? '<button class="btn sm ghost" data-act="stClear">ללא יעד</button>' : ''}</div>
    ${sug ? `<p class="small muted" data-target-suggestion>הצעה לפי 14 הימים האחרונים שלך (חציון × 1.05): <b class="num">${sug.toLocaleString('he-IL')}</b> <button class="btn sm ghost" data-act="stSug" data-v="${sug}">להשתמש בהצעה</button></p>` : '<p class="tiny faint">הצעה ליעד תופיע אחרי 7 ימים עם נתוני צעדים.</p>'}
    <p class="tiny faint">שינוי יעד חל מהיום והלאה; ימים קודמים נמדדים מול היעד שהיה אז.</p></section>`);
  const why = { 'no-target': 'צריך יעד אישי כדי לחשב.', 'not-enough-data': `צריך נתוני צעדים לפחות ב־4 מתוך 7 הימים האחרונים (יש ${ms.have || 0}). יום בלי נתון לא נחשב כיום בלי תנועה.`, 'only-rest-days': 'בשבוע האחרון היו רק ימי מנוחה — אין מה למדוד, וזה בסדר.' };
  html.push(`<section class="card" data-movescore><div class="card-h"><h2>MoveScore</h2><span class="pill acc">גרסת הצעה v0</span></div>
    ${ms.score != null ? `<div class="row" style="gap:16px;align-items:center"><span class="num" style="font-size:2.2em;font-weight:700" data-ms-value>${ms.score}</span><span class="small muted">מתוך 100 · ${ms.daysWithData} ימים עם נתונים${ms.restDays ? ` · ${ms.restDays} ימי מנוחה (לא נספרו)` : ''} · מקור: ${ms.kinds.map(k => A.KIND_HE[k]).join(', ')}</span></div>
      <div class="facts small">${Object.keys(ms.parts).map(k => `<div class="row between"><span>${PART_HE[k]}${ms.weightsUsed[k] != null ? ` (משקל ${Math.round(ms.weightsUsed[k] * 100)}%)` : ' (לא נכלל — אין עדיין 7 ימי השוואה)'}</span><b class="num">${ms.parts[k] != null ? ms.parts[k] : '—'}</b></div>`).join('')}</div>` : `<p class="small" data-ms-none>${why[ms.reason] || 'אין מספיק נתונים.'}</p>`}
    <details class="more"><summary>איך מחושב</summary><ul class="bul tiny"><li><b>התקדמות (50%)</b>: ממוצע של צעדים ÷ יעד בימים שאינם מנוחה, עד 120%.</li><li><b>עקביות (30%)</b>: חלק הימים שאינם מנוחה שבהם הגעת ל־60% מהיעד.</li><li><b>מגמה (20%)</b>: ממוצע 7 הימים מול 28 הימים שלפניהם (±20%). בלי 7 ימי השוואה היא לא נכללת והמשקלות מתחלקים מחדש.</li><li>ימי מנוחה לא מורידים ציון. ימים בלי נתון לא נחשבים כאפס. נתוני הדגמה לא נספרים.</li><li>המשקלות הם הצעה לבחינה — לא תקן מדעי ולא המלצה רפואית.</li></ul></details></section>`);
  html.push(`<section class="card" data-steps-list><h3>14 הימים האחרונים</h3><div class="list">${hist.slice(-14).reverse().map(d => { const v = A.day(d.date); return `<div class="li small"><div class="grow">${esc(S.fmtDate(d.date, true))}${d.rest ? ' <span class="pill">מנוחה</span>' : ''}</div><span class="num">${v.value != null ? v.value.toLocaleString('he-IL') : '—'}</span>${root.UI.srcTag(A.srcKind(v), A.label(v), 'data-kind="' + v.kind + '"')}</div>`; }).join('')}</div></section>`);
  return { title: 'צעדים ו־MoveScore', back: '#/progress', html: html.join(''), handlers: {
    stSave: () => { const v = +document.getElementById('st-v').value; if (!(v > 0)) { root.UI.toast('הזינו מספר צעדים, או בחרו "ללא יעד"'); return; } if (A.setTarget(Math.max(1000, v))) root.UI.toast('היעד נשמר מהיום והלאה'); root.App.render(); },
    stepsFile: () => root.SyncTools && root.SyncTools.importSheet(),
    stClear: () => { if (A.setTarget(null)) root.UI.toast('אין יעד צעדים'); root.App.render(); },
    stSug: el => { if (A.setTarget(+el.dataset.v)) root.UI.toast('היעד נשמר'); root.App.render(); },
    hConnect: async () => { root.UI.toast('מבקש הרשאה…'); const r = await A.connect(); root.UI.toast(r.ok ? `נקראו נתונים (${r.rows} ימים)` : r.reason === 'web' ? 'לא זמין בדפדפן' : 'החיבור לא הצליח — הפרטים במסך'); root.App.render(); },
    hSync: async () => { const r = await A.sync(); root.UI.toast(r.ok ? 'סונכרן' : 'הסנכרון לא הצליח'); root.App.render(); },
    hOff: () => root.UI.confirmSheet('הפסקת שימוש במקור', 'האפליקציה תפסיק לקרוא צעדים. הצעדים שכבר יובאו יישארו מסומנים "נמדד" עד שתמחקו אותם. ההרשאה עצמה מבוטלת בהגדרות המכשיר.', 'הפסקה', () => { A.disconnect(); root.App.render(); }),
    hDel: () => root.UI.confirmSheet('מחיקת צעדים שיובאו', 'יימחקו רק הצעדים שיובאו (מהמכשיר או מקובץ). הזנות ידניות נשארות.', 'מחיקה', () => { A.deleteMeasured(); root.App.render(); }) } };
};
})(window);
