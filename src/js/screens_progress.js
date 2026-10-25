/* Progress tracking, settings, backup and install */
(function (root) {
const { esc, icon, lineChart, barChart, U } = root.UI;
const S = root.Store, C = root.Core, L = root.Logic, P = root.PROGRAM;
const Screens = root.Screens;
const st = { range: 14, logDate: null };

Screens.progress = function () {
  const p = C.profile(), u = p.units, ms = C.measures(), t = S.load('tracking'), today = S.today(), tg = C.targets();
  const logDate = st.logDate || today, dl = C.daily(logDate);
  const html = [];
  html.push(`<section class="card"><h2>מדידה חדשה</h2><div class="grid2"><label class="field">תאריך<input type="date" id="m-d" value="${today}"></label><label class="field">משקל (${U.wl(u.w)})<input type="number" id="m-w" inputmode="decimal" step="0.1" min="30" max="400"></label><label class="field">היקף מותניים (${U.ll(u.len)})<input type="number" id="m-wa" inputmode="decimal" step="0.1" min="40" max="200"></label><label class="field">הערה<input type="text" id="m-n" placeholder="למשל: בבוקר, אחרי שירותים"></label></div><button class="btn primary" data-act="saveM">שמירת מדידה</button><p class="tiny faint">שקילה באותם תנאים (בוקר, לפני אוכל) נותנת השוואה אמינה יותר. שינוי יומי במשקל מושפע ממים, מלח ופחמימות — זה לא שינוי בשומן.</p></section>`);
  html.push(`<section class="card"><div class="card-h"><h2>יומן יומי</h2><input type="date" id="dl-d" value="${logDate}" data-act="logDate" style="max-width:170px"></div>
    <div class="grid2"><label class="field">צעדים<input type="number" id="dl-s" inputmode="numeric" min="0" value="${dl.steps || ''}"></label><label class="field">שינה (שעות)<input type="number" id="dl-sl" inputmode="decimal" step="0.25" min="0" max="16" value="${dl.sleep || ''}"></label><label class="field">מים (ליטר)<input type="number" id="dl-w" inputmode="decimal" min="0" step="0.25" max="10" dir="ltr" value="${dl.water ? C.fmtL(dl.water) : ''}"></label><label class="field">אנרגיה (1–5)<select id="dl-e"><option value="">—</option>${[1, 2, 3, 4, 5].map(x => `<option ${dl.energy == x ? 'selected' : ''}>${x}</option>`).join('')}</select></label></div>
    <label class="field">איכות שינה / הערות<input type="text" id="dl-sn" value="${esc(dl.sleepNote || '')}" placeholder="למשל: התעוררתי פעמיים"></label><label class="field">הערות אישיות<textarea id="dl-n">${esc(dl.notes || '')}</textarea></label><button class="btn" data-act="saveDaily">שמירה</button></section>`);
  // charts
  const wPts = ms.filter(m => m.weight).map(m => ({ x: S.diffDays(p.startDate, m.date), y: U.w(m.weight, u.w), d: m.date }));
  const waPts = ms.filter(m => m.waist).map(m => ({ x: S.diffDays(p.startDate, m.date), y: U.len(m.waist, u.len), d: m.date }));
  const xl = pts => pts.length ? [pts[0], pts[pts.length - 1]].map(q => ({ x: q.x, t: S.fmtShort(q.d) })) : [];
  const lw = C.latestWeight ? C.latestWeight() : null, cw = (lw && (lw.weight || lw)) || p.weight;
  const twLine = p.targetWeight ? `<p class="small" data-target-weight>משקל יעד: <b class="num">${U.w(p.targetWeight, u.w)}</b> ${U.wl(u.w)}${typeof cw === 'number' ? ` · ${Math.abs(cw - p.targetWeight) < 0.05 ? 'הגעת ליעד' : (cw > p.targetWeight ? 'נותרו ' : 'חסרים ') + U.w(Math.abs(cw - p.targetWeight), u.w) + ' ' + U.wl(u.w)}` : ''}. <span class="tiny faint">לתיעוד ולמעקב; לא משנה את היעד הקלורי.</span></p>` : '';
  html.push(`<section class="card"><div class="card-h"><h3>משקל</h3><span class="muted small">${U.wl(u.w)}</span></div>${twLine}${lineChart(wPts, { label: 'גרף משקל', xlabels: xl(wPts), empty: 'הוסיפו שקילה ראשונה כדי לראות גרף' })}${wPts.length >= 2 ? `<p class="small muted">שינוי מהמדידה הראשונה: <b class="num">${(wPts[wPts.length - 1].y - wPts[0].y > 0 ? '+' : '')}${(wPts[wPts.length - 1].y - wPts[0].y).toFixed(1)}</b> ${U.wl(u.w)}. זה שינוי במשקל הגוף — הוא לא מוכיח שינוי בשומן.</p>` : ''}</section>`);
  html.push(`<section class="card"><div class="card-h"><h3>היקף מותניים</h3><span class="muted small">${U.ll(u.len)}</span></div>${lineChart(waPts, { label: 'גרף היקף מותניים', cls: 'gl', xlabels: xl(waPts), empty: 'הוסיפו מדידת מותניים (מעל הטבור, בנשיפה רגילה)' })}</section>`);
  const days = []; for (let i = st.range - 1; i >= 0; i--) days.push(S.addDays(today, -i));
  html.push(`<div class="seg" role="group" aria-label="טווח"><button data-act="range" data-r="14" aria-pressed="${st.range === 14}">14 יום</button><button data-act="range" data-r="30" aria-pressed="${st.range === 30}">30 יום</button></div>`);
  const dd = d => t.daily[d] || {};
  { const A = root.Activity, tgt = A.targetOn(today), vals = days.map(d => A.day(d)), kinds = new Set(vals.filter(v => v.kind !== 'none').map(v => v.kind));
    html.push(`<section class="card" data-steps-chart><div class="card-h"><h3>צעדים</h3><span class="muted small">${tgt ? 'יעד אישי ' + tgt.toLocaleString('he-IL') : 'יעד: לא נקבע'}</span></div>${barChart(vals.map((v, k) => ({ v: v.value || 0, t: S.fmtShort(days[k]), cls: tgt && (v.value || 0) >= tgt ? 'good' : '' })), { target: tgt || null, fmt: v => (v / 1000).toFixed(1) + 'K', label: 'צעדים יומיים', empty: 'אין עדיין צעדים' })}<p class="tiny faint" data-steps-kinds>מקור: ${kinds.size ? [...kinds].map(k => A.KIND_HE[k]).join(' · ') : 'אין נתונים'} · <a href="#/activity">פרטים, מקור הנתונים ו־MoveScore</a></p></section>`); }
  html.push(`<section class="card"><div class="card-h"><h3>שינה</h3><span class="muted small">יעד ${p.goals.sleep} שע׳</span></div>${barChart(days.map(d => ({ v: dd(d).sleep || 0, t: S.fmtShort(d), cls: 'gl' })), { target: p.goals.sleep, fmt: v => v.toFixed(0), label: 'שעות שינה', empty: 'אין עדיין שינה מתועדת' })}</section>`);
  html.push(`<section class="card"><div class="card-h"><h3>קלוריות שנצרכו</h3><span class="muted small">${tg ? 'יעד ' + tg.kcal : 'אין יעד — הפרופיל לא הושלם'}</span></div>${barChart(days.map(d => ({ v: C.entries(d).length ? C.eatenTotals(d).k : 0, t: S.fmtShort(d) })), { target: tg ? tg.kcal : null, label: 'קלוריות ליום', empty: 'אין עדיין רישומי תזונה' })}</section>`);
  html.push(`<section class="card"><div class="card-h"><h3>חלבון שנצרך</h3><span class="muted small">${tg ? 'יעד ' + tg.protein + ' ג׳' : 'אין יעד'}</span></div>${barChart(days.map(d => ({ v: C.entries(d).length ? C.eatenTotals(d).p : 0, t: S.fmtShort(d), cls: 'gl' })), { target: tg ? tg.protein : null, label: 'חלבון ליום', empty: 'אין עדיין רישומי תזונה' })}</section>`);
  // Stage D: the active personal plan's own weeks (never mixed with the classic program or with older plans)
  const ap = root.Plans.active();
  if (ap) html.splice(0, 0, Screens.planProgressCard(ap));
  html.splice(0, 0, `<nav class="chips sig-links" aria-label="סיכומים"><a class="chip" href="#/review">${icon('cal')} סיכום שבועי</a><a class="chip" href="#/records">${icon('star')} שיאים ואבני דרך</a></nav>`);
  // weekly summaries
  const ws = [1, 2, 3, 4].map(C.weekSummary), w1 = ws[0];
  const classicData = Object.keys(S.load('workouts').days).length > 0 || Object.keys(S.load('workouts').tests || {}).length > 0;
  if (ap) html.push(`<details class="card more classic-box" ${classicData ? 'open' : ''}><summary>תוכנית 30 היום הקלאסית — סיכומים ומבחנים${classicData ? '' : ' (אין רישומים)'}</summary>`);
  const f = (v, d) => v == null ? '—' : v.toFixed(d || 0);
  const delta = (v, b, d) => v == null || b == null ? '' : ` <span class="tiny ${v - b >= 0 ? 'good' : 'bad'}">(${v - b >= 0 ? '+' : ''}${(v - b).toFixed(d || 0)})</span>`;
  html.push(`<section class="card"><h3>סיכום שבועי והשוואה לשבוע 1</h3><div class="tbl-wrap"><table class="tbl"><tr><th></th>${ws.map(w => `<th>שבוע ${w.w}</th>`).join('')}</tr>
    <tr><td>אימונים</td>${ws.map(w => `<td class="n">${w.wDone}/${w.wTot}</td>`).join('')}</tr>
    <tr><td>צעדים (ממוצע)</td>${ws.map((w, i) => `<td class="n">${f(w.steps)}${i ? delta(w.steps, w1.steps) : ''}</td>`).join('')}</tr>
    <tr><td>שינה (ממוצע)</td>${ws.map((w, i) => `<td class="n">${f(w.sleep, 1)}${i ? delta(w.sleep, w1.sleep, 1) : ''}</td>`).join('')}</tr>
    <tr><td>קלוריות (ממוצע)</td>${ws.map(w => `<td class="n">${f(w.kcal)}</td>`).join('')}</tr>
    <tr><td>חלבון (ממוצע)</td>${ws.map((w, i) => `<td class="n">${f(w.prot)}${i ? delta(w.prot, w1.prot) : ''}</td>`).join('')}</tr>
    <tr><td>משקל (ממוצע)</td>${ws.map(w => `<td class="n">${w.weight == null ? '—' : U.w(w.weight, u.w)}</td>`).join('')}</tr>
    <tr><td>קושי ממוצע</td>${ws.map(w => `<td class="n">${f(w.rpe, 1)}</td>`).join('')}</tr></table></div>
    <p class="tiny faint">ממוצעים מחושבים רק מימים עם נתונים. שינה, התאוששות וביצועים יכולים להיות קשורים, אבל הטבלה מציגה מגמות — לא הוכחה לסיבה ותוצאה.</p></section>`);
  // tests
  const tr = C.testResults();
  const fmtD = d => d ? S.fmtShort(d) : '';
  html.push(`<section class="card"><h3>מבחן כושר: פתיחה מול סיום</h3><div class="tbl-wrap"><table class="tbl"><tr><th>מבחן</th><th>יום 1${tr[1]._date ? ' (' + fmtD(tr[1]._date) + ')' : ''}</th><th>יום 29${tr[29]._date ? ' (' + fmtD(tr[29]._date) + ')' : ''}</th><th>שינוי</th></tr>${Object.entries(P.TESTS).map(([k, x]) => { const a = tr[1][k], b = tr[29][k]; return `<tr><td>${esc(x.name)} <span class="tiny faint">(${esc(x.unit)})</span></td><td class="n">${a != null ? a : 'לא בוצע'}</td><td class="n">${b != null ? b : 'לא בוצע'}</td><td class="n">${a != null && b != null ? `<span class="${b - a >= 0 ? 'good' : 'bad'}">${b - a >= 0 ? '+' : ''}${b - a}</span>` : '—'}</td></tr>`; }).join('')}</table></div>
    ${tr[1]._var && tr[29]._var && tr[1]._var !== tr[29]._var ? '<div class="banner warn small"><div>גרסת שכיבות הסמיכה שונה בין המבחנים — ההשוואה בשורה הזו לא ישירה.</div></div>' : ''}
    <p class="tiny faint">שינוי בתוצאות משקף ביצוע במבחן (כוח, סיבולת, טכניקה, קצב). הוא לא מוכיח בהכרח עלייה במסת שריר או ירידה בשומן. התוצאות נרשמות ב"מבחן כושר" בימים 1 ו־29 או ברישום ידני.</p></section>`);
  if (ap) html.push('</details>');
  // exercise progress
  const hist = C.exerciseHistory(), exs = Object.keys(hist).filter(k => hist[k].length);
  html.push(`<section class="card" data-ex-progress><h3>התקדמות בתרגילים</h3>${exs.length ? `<div class="tbl-wrap"><table class="tbl"><tr><th>תרגיל</th><th>ראשון</th><th>אחרון</th><th>שיא</th><th>אימונים</th></tr>${exs.map(k => { const l = hist[k], u = l[0].unit === 'sec' ? ' שנ׳' : '', mx = Math.max(...l.map(x => x.v)); return `<tr><td>${esc(root.EX_BY_ID[k].he)}</td><td class="n">${l[0].v}${u}</td><td class="n">${l[l.length - 1].v}${u}</td><td class="n">${mx}${u}</td><td class="n">${l.length}</td></tr>`; }).join('')}</table></div><p class="tiny faint">הערך = החזרות/השניות הגבוהות ביותר בסט באותו אימון, מתוכנית 30 היום ומהתוכניות האישיות, לפי תאריך הרישום.</p>` : '<div class="empty">נתונים יופיעו אחרי שתסמנו סטים במצב אימון</div>'}</section>`);
  // measures history
  html.push(`<section class="card"><h3>היסטוריית מדידות</h3>${ms.length ? `<div class="list">${ms.slice().reverse().map(m => `<div class="li"><div class="grow"><div class="t num">${S.fmtShort(m.date)}</div><div class="s">${m.weight ? U.w(m.weight, u.w) + ' ' + U.wl(u.w) : ''}${m.weight && m.waist ? ' · ' : ''}${m.waist ? 'מותניים ' + U.len(m.waist, u.len) + ' ' + U.ll(u.len) : ''}${m.note ? ' · ' + esc(m.note) : ''}</div></div><button class="icon-btn" data-act="delM" data-id="${m.id}" aria-label="מחיקת מדידה">${icon('trash')}</button></div>`).join('')}</div>` : '<p class="muted small">אין עדיין מדידות.</p>'}</section>`);
  html.push(`<section class="card"><div class="card-h"><h3>תמונות התקדמות (רשות)</h3><label class="btn sm">${icon('plus')} הוספה<input type="file" accept="image/*" id="ph-in" hidden></label></div><p class="tiny faint">נשמרות רק במכשיר הזה (IndexedDB), לא נכללות בקובץ הגיבוי ולא נשלחות לשום מקום.</p><div class="photo-grid" id="ph-grid"></div></section>`);
  return {
    title: 'מעקב', html: html.join(''), handlers: {
      saveM: () => { const d = document.getElementById('m-d').value, w = parseFloat(document.getElementById('m-w').value), wa = parseFloat(document.getElementById('m-wa').value), note = document.getElementById('m-n').value.trim();
        if (!d || (!(w > 0) && !(wa > 0))) { root.UI.toast('הזינו משקל או היקף מותניים'); return; }
        const tt = S.load('tracking'); tt.measures = tt.measures.filter(m => m.date !== d); tt.measures.push({ id: 'm' + Date.now().toString(36), date: d, weight: w > 0 ? U.wIn(w, u.w) : null, waist: wa > 0 ? U.lenIn(wa, u.len) : null, note });
        S.save('tracking'); root.UI.toast('המדידה נשמרה'); root.App.render(); },
      delM: el => root.UI.confirmSheet('מחיקת מדידה', 'למחוק את המדידה?', 'מחיקה', () => { const tt = S.load('tracking'); tt.measures = tt.measures.filter(m => m.id !== el.dataset.id); S.save('tracking'); root.App.render(); }, true),
      logDate: el => { st.logDate = el.value || today; root.App.render(); },
      saveDaily: () => { const n = id => { const v = document.getElementById(id).value; return v === '' ? null : +v; };
        C.setDaily(logDate, Object.assign(n('dl-s') != null ? { steps: n('dl-s'), stepsSrc: 'user' } : { steps: null }, { sleep: n('dl-sl'), water: n('dl-w') == null ? null : Math.round(n('dl-w') * 1000) /* M10: liters on screen, ml stored */, ...(n('dl-w') != null && !C.daily(logDate).waterGoal ? { waterGoal: C.waterGoalOn(logDate).ml } : {}), energy: n('dl-e'), sleepNote: document.getElementById('dl-sn').value.trim(), notes: document.getElementById('dl-n').value.trim() })); root.UI.toast('נשמר'); root.App.render(); },
      range: el => { st.range = +el.dataset.r; root.App.render(); }
    },
    after: v => {
      const grid = v.querySelector('#ph-grid');
      const draw = () => S.photoAll().then(ps => { grid.innerHTML = ps.length ? ps.map(p => `<figure><img src="${p.data}" alt="תמונת התקדמות ${esc(S.fmtShort(p.date))}"><figcaption><span>${esc(S.fmtShort(p.date))}</span><button data-id="${p.id}" aria-label="מחיקת תמונה">${icon('trash')}</button></figcaption></figure>`).join('') : '<p class="muted small">אין תמונות.</p>';
        grid.querySelectorAll('button[data-id]').forEach(b => b.addEventListener('click', () => root.UI.confirmSheet('מחיקת תמונה', 'למחוק את התמונה מהמכשיר?', 'מחיקה', () => S.photoDel(b.dataset.id).then(draw), true))); })
        .catch(() => { grid.innerHTML = '<p class="muted small">אחסון התמונות לא זמין בדפדפן הזה.</p>'; });
      draw();
      v.querySelector('#ph-in').addEventListener('change', ev => { const f = ev.target.files[0]; if (!f) return; const img = new Image(); const url = URL.createObjectURL(f);
        img.onload = () => { const sc = Math.min(1, 900 / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = img.width * sc; c.height = img.height * sc; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
          S.photoPut({ id: 'p' + Date.now().toString(36), date: S.today(), data: c.toDataURL('image/jpeg', 0.8) }).then(() => { root.UI.toast('התמונה נשמרה במכשיר'); draw(); }).catch(() => root.UI.toast('לא ניתן לשמור תמונה כאן')); };
        img.onerror = () => root.UI.toast('לא ניתן לקרוא את הקובץ'); img.src = url; });
    }
  };
};

Screens.planProgressCard = function (ap) {
  const I = root.Insights, ws = I.planWeeks(ap).filter(w => w.from <= S.today()), cs = I.consistency(ap), tpl = root.PROGRAMS.byId(ap.templateId), T = root.PROGRAM.TESTS, pt = I.planTests(ap);
  const bars = ws.map(w => ({ v: w.planned ? Math.round((w.done + w.partial) / w.planned * 100) : 0, t: 'ש' + w.w, cls: w.current ? '' : 'good' }));
  const rows = ws.slice(-8);
  return `<section class="card" data-plan-progress><div class="card-h"><h2>התוכנית הפעילה</h2><span class="pill good">${esc(tpl.he)}</span></div>
    <p class="tiny muted">רק אימונים של התוכנית הזו, לפי שבועות התוכנית (שבוע 1 מתחיל ב־${esc(S.fmtDate(ap.start))}). תוכניות קודמות והתוכנית הקלאסית לא מעורבבות כאן.</p>
    ${ws.length ? root.UI.barChart(bars, { label: 'אחוז האימונים שבוצעו בכל שבוע בתוכנית', fmt: v => Math.round(v) + '%', empty: 'אין עדיין אימונים שבוצעו בתוכנית' }) : '<div class="empty">התוכנית עוד לא התחילה</div>'}
    ${rows.length ? `<div class="tbl-wrap"><table class="tbl"><tr><th>שבוע</th><th>בוצעו</th><th>דילוג</th><th>לא בוצעו</th><th>דקות</th><th>מאמץ ממוצע</th></tr>${rows.map(w => `<tr><td>${w.w}${w.deload ? ' <span class="pill">קל</span>' : ''}${w.current ? ' <span class="pill gl">נוכחי</span>' : ''}</td><td class="n">${w.done + w.partial}/${w.planned}</td><td class="n">${w.skipped}</td><td class="n">${w.missed}</td><td class="n">${w.minutes || '—'}</td><td class="n">${w.rpe != null ? w.rpe + '/10' : '—'}</td></tr>`).join('')}</table></div>` : ''}
    <p class="small">שבועות שנשמרו: <b class="num">${cs.weeksKept}</b> מתוך ${cs.weeksPast} שהסתיימו · רצף נוכחי: <b class="num">${cs.streak}</b></p><p class="tiny faint">${esc(cs.rule)}</p>
    <h3>מבחני כושר בתוכנית</h3>${pt ? `<div class="tbl-wrap"><table class="tbl"><tr><th>מבחן</th><th>ראשון (${esc(S.fmtShort(pt.first.date))})</th><th>${pt.last ? 'אחרון (' + esc(S.fmtShort(pt.last.date)) + ')' : 'אחרון'}</th><th>שינוי</th></tr>${Object.entries(T).map(([k, x]) => { const a = pt.first.r[k], b = pt.last ? pt.last.r[k] : null; return `<tr><td>${esc(x.name)}</td><td class="n">${a != null ? a : 'לא בוצע'}</td><td class="n">${b != null ? b : '—'}</td><td class="n">${a != null && b != null ? `<span class="${b - a >= 0 ? 'good' : 'bad'}">${b - a >= 0 ? '+' : ''}${b - a}</span>` : '—'}</td></tr>`; }).join('')}</table></div>${pt.last && pt.first.v && pt.last.v && pt.first.v !== pt.last.v ? '<p class="tiny warn">גרסת שכיבות הסמיכה שונה בין המבחנים — ההשוואה בשורה הזו לא ישירה.</p>' : ''}` : '<p class="small muted">עוד לא נרשם מבחן כושר בתוכנית. ימי המבחן מסומנים בלוח בסגול.</p>'}
    <p class="tiny faint">שינוי בתוצאות משקף ביצוע במבחן. הוא לא מוכיח בהכרח עלייה במסת שריר או ירידה בשומן.</p></section>`;
};
/* M10 · Settings always has an account area. Without an account server (or before the account chunk loads) it says so honestly. */
Screens.accountCardOff = () => root.FIT30_BACKEND ? '' : `<section class="card" data-account-card data-account-off><div class="card-h"><h2>חשבון</h2><span class="pill">לא הופעל</span></div><p class="small">חשבונות הענן עוד לא הופעלו בגרסת הבטא הזו — הנתונים נשמרים רק במכשיר הזה. לגיבוי: ייצוא גיבוי (למטה).</p><a class="btn" href="#/account">הרשמה / התחברות</a></section>`;
Screens.settings = function () {
  const p = C.profile(), a = C.autoTargets(), t = C.targets(), meta = S.load('meta'), u = p.units;
  const kb = Math.round(S.usageBytes() / 1024);
  return { title: 'הגדרות', html: `
    <section class="card"><h2>פרופיל</h2><div class="grid2"><label class="field">גיל<input type="number" id="s-age" inputmode="numeric" value="${p.age ?? ''}"></label><label class="field">גובה (ס״מ)<input type="number" id="s-h" inputmode="numeric" value="${p.height ?? ''}"></label><label class="field">משקל התחלתי (${U.wl(u.w)})<input type="number" id="s-sw" inputmode="decimal" step="0.1" value="${p.startWeight != null ? U.w(p.startWeight, u.w) : ''}"></label><label class="field">משקל נוכחי לחישוב (${U.wl(u.w)})<input type="number" id="s-w" inputmode="decimal" step="0.1" value="${p.weight != null ? U.w(p.weight, u.w) : ''}"></label></div>
      <label class="field">תאריך תחילת התוכנית (יום 1)<input type="date" id="s-start" value="${p.startDate}"></label><p class="tiny faint">שינוי תאריך מזיז את מיפוי הימים בלוח; רישומי אימונים נשמרים לפי מספר יום, ויומני תזונה ומעקב לפי תאריך — שום נתון לא נמחק.</p>
      <button class="btn primary" data-act="saveProfile">שמירת פרופיל</button></section>
    ${!a ? Screens.needProfile('יעדים תזונתיים — חסרים גיל, גובה או משקל') : `<section class="card"><div class="card-h"><h2>יעדים תזונתיים</h2>${t.custom ? '<span class="pill acc">מותאם ידנית</span>' : '<span class="pill">אוטומטי</span>'}</div><p class="small muted">חישוב אוטומטי: ${a.kcal} קק״ל · ${a.protein} ג׳ חלבון · ${a.carbs} ג׳ פחמ׳ · ${a.fat} ג׳ שומן. <a href="#/targets">איך חושב?</a></p>
      <div class="grid2"><label class="field">קלוריות<input type="number" id="t-k" inputmode="numeric" value="${t.kcal}"></label><label class="field">חלבון (ג׳)<input type="number" id="t-p" inputmode="numeric" value="${t.protein}"></label><label class="field">פחמימות (ג׳)<input type="number" id="t-c" inputmode="numeric" value="${t.carbs}"></label><label class="field">שומן (ג׳)<input type="number" id="t-f" inputmode="numeric" value="${t.fat}"></label></div>
      <div class="btns"><button class="btn" data-act="saveTargets">שמירת יעדים</button><button class="btn ghost" data-act="autoTargets">חזרה לחישוב האוטומטי</button></div><p class="tiny faint">היעדים לא משתנים אוטומטית לפי יום חריג. מסך הבית יציע בדיקה מחדש רק כשיש מגמה במשקל.</p></section>`}
    <section class="card"><h2>יעדי מעקב</h2><div class="grid3"><label class="field">צעדים (יעד אישי)<input type="number" id="g-s" inputmode="numeric" step="500" min="0" placeholder="לא נקבע" value="${p.goals.steps > 0 ? p.goals.steps : ''}"></label><label class="field">מים (ליטר ליום)<input type="number" id="g-w" inputmode="decimal" step="0.25" min="0.5" max="6" value="${C.fmtL(C.waterGoalOn(S.today()).ml)}" dir="ltr"></label><label class="field">שינה (שע׳)<input type="number" id="g-sl" inputmode="decimal" step="0.25" value="${p.goals.sleep}"></label></div>
      <p class="tiny faint">צעדים: אין מספר שמתאים לכולם. אפשר להשאיר ריק, או להתחיל קרוב לממוצע שלך — במסך "צעדים ו־MoveScore" יש הצעה לפי הנתונים שלך. </p>${(() => { const s = C.waterSuggest(S.today()), man = C.waterManual(p); return `<div class="stack tight" data-water-goal><label class="toggle"><input type="checkbox" id="g-wm" ${man ? 'checked' : ''}> יעד מים ידני (במקום ההצעה המחושבת)</label>
      <p class="small">הצעה ${s.est ? 'כללית' : 'אישית'} להיום: <b><bdi>${C.fmtL(s.ml)}</bdi> ליטר</b> לשתייה <span class="pill">הערכה</span>${man ? ` · היעד שלך: <b><bdi>${C.fmtL(p.goals.water)}</bdi> ליטר</b>` : ''}</p>
      <details class="more"><summary>איך זה מחושב</summary><ul class="bul tiny">${s.parts.map(x => `<li>${esc(x)}</li>`).join('')}<li>מעוגל ל־0.25 ליטר, בין 1.5 ל־4 ליטר. בלי התאמה למזג אוויר — אין מקור נתונים אמין.</li></ul></details>
      ${s.est ? '<p class="tiny">להצעה אישית: <a href="#/profile">משקל וגיל בפרופיל</a>.</p>' : ''}
      <p class="tiny faint">ההצעה היא הערכה כללית ולא הוראה רפואית. אנשים עם הגבלת נוזלים (למשל במחלת לב או כליות) — לפי הנחיית הרופא/ה. עדיף לשתות לאורך היום ולא כמות גדולה בבת אחת; צמא וצבע שתן בהיר הם מדד טוב. היעד עוסק בשתייה בלבד — האוכל מוסיף נוזלים משלו.</p></div>`; })()}<button class="btn" data-act="saveGoals">שמירה</button></section>
    <section class="card"><h2>העדפות תזונה</h2>
      <div class="stack tight" data-cuisine><h3>העדפות מטבח</h3><div data-fp-slot><p class="small muted">טוען…</p></div></div>
      ${(() => { setTimeout(() => root.App.loadChunk('extra.js').then(() => { const el = document.querySelector('[data-fp-slot]'); if (el && root.FoodPrefs) root.FoodPrefs.mount(el, 'settings'); }, () => { const el = document.querySelector('[data-fp-slot]'); if (el) el.innerHTML = '<p class="small warn">העדפות המטבח נטענות עם חיבור לאינטרנט בפעם הראשונה.</p>'; }), 0); return ''; })()}
      ${(() => { const pf = C.normPrefs(p.prefs); return `
      <label class="switch"><span>ללא מוצרי חלב</span><input type="checkbox" id="pf-d" ${!pf.dairy ? 'checked' : ''}></label>
      <label class="switch"><span>ללא ביצים</span><input type="checkbox" id="pf-e" ${!pf.egg ? 'checked' : ''}></label>
      <label class="switch"><span>ללא עוף</span><input type="checkbox" id="pf-c" ${!pf.chicken ? 'checked' : ''}></label>
      <label class="switch"><span>ללא דגים</span><input type="checkbox" id="pf-fi" ${!pf.fish ? 'checked' : ''}></label>
      <label class="switch"><span>ללא בשר בקר/הודו</span><input type="checkbox" id="pf-m" ${!pf.meat ? 'checked' : ''}></label>
      <label class="switch"><span>תזונה צמחונית (ללא עוף, בשר, דגים וביצים)</span><input type="checkbox" id="pf-v" ${pf.veg ? 'checked' : ''}></label>
      <label class="switch"><span>טבעוני (גם ללא מוצרי חלב)</span><input type="checkbox" id="pf-vg" ${pf.vegan ? 'checked' : ''}></label>
      <label class="switch"><span>ללא סויה (טופו, משקה סויה, רוטב סויה)</span><input type="checkbox" id="pf-soy" ${pf.exclude.includes('soya') ? 'checked' : ''}></label>
      <label class="switch"><span>ללא בוטנים (כולל חמאת בוטנים)</span><input type="checkbox" id="pf-pn" ${pf.exclude.includes('peanuts') ? 'checked' : ''}></label>
      <label class="switch"><span>ללא גלוטן (לפי המרכיבים: חיטה, לחם, פסטה, קוסקוס, בורגול, רוטב סויה, שיבולת שועל)</span><input type="checkbox" id="pf-gf" ${pf.glutenFree ? 'checked' : ''}></label>
      <div class="grid2"><label class="field">ארוחות ביום (תפריט אישי)<select id="pf-meals"><option value="3" ${pf.meals !== 2 ? 'selected' : ''}>3 (שתי ארוחות + ביניים)</option><option value="2" ${pf.meals === 2 ? 'selected' : ''}>2</option></select></label>
        <label class="field">זמן הכנה מקסימלי<select id="pf-prep"><option value="">ללא הגבלה</option>${[15, 20, 30, 45].map(m => `<option value="${m}" ${pf.maxPrep === m ? 'selected' : ''}>${m} דק׳</option>`).join('')}</select></label></div>
      <div class="stack tight"><span class="small muted">מזונות להחרגה</span><div class="chips" style="flex-wrap:wrap" id="pf-ex">${pf.exclude.map(f => `<button class="chip" aria-pressed="true" data-act="unexclude" data-f="${f}">${esc(root.NUTRI.FOODS[f].he.split(' (')[0])} ✕</button>`).join('') || '<span class="tiny faint">לא נבחרו</span>'}</div>
        <div class="row"><select id="pf-add" aria-label="בחירת מזון להחרגה"><option value="">בחירת מזון…</option>${Object.entries(root.NUTRI.FOODS).filter(([k]) => !pf.exclude.includes(k)).sort((x, y) => x[1].he.localeCompare(y[1].he, 'he')).map(([k, f]) => `<option value="${k}">${esc(f.he.split(' (')[0])}</option>`).join('')}</select><button class="btn sm" data-act="exclude">הוספה</button></div></div>
      ${(() => { const K = p.restrictionKinds || {}, items = [];
        [['dairy', 'ללא מוצרי חלב'], ['egg', 'ללא ביצים'], ['chicken', 'ללא עוף'], ['fish', 'ללא דגים'], ['meat', 'ללא בשר']].forEach(([k, t]) => { if (pf[k] === false) items.push([k, t]); });
        if (pf.glutenFree) items.push(['glutenFree', 'ללא גלוטן']); if (pf.vegan) items.push(['vegan', 'טבעוני']); else if (pf.veg) items.push(['veg', 'צמחוני']);
        pf.exclude.forEach(f => items.push([f, 'ללא ' + root.NUTRI.FOODS[f].he.split(' (')[0]]));
        return items.length ? `<div class="stack tight" data-kinds><span class="small muted">סוג כל הגבלה — משפיע רק על נוסח האזהרות. החסימה זהה בכל המקרים: מזון מוגבל לא ייכנס לתפריט ולא יוחלף בו בשקט.</span>${items.map(([k, t]) => `<label class="field row between"><span class="small">${esc(t)}</span><select data-rk="${k}" aria-label="סוג ההגבלה: ${esc(t)}">${['pref', 'intolerance', 'allergy'].map(v => `<option value="${v}" ${(K[k] || (['veg', 'vegan'].includes(k) ? 'pref' : '')) === v ? 'selected' : ''}>${C.KIND_HE[v]}</option>`).join('')}<option value="" ${!K[k] && !['veg', 'vegan'].includes(k) ? 'selected' : ''}>לא צוין</option></select></label>`).join('')}<p class="tiny faint">באלרגיה: האפליקציה בודקת מרכיבים לפי מאגר המזונות שלה בלבד. היא לא בודקת תוויות של מוצרים, עקבות או זיהום צולב, ואינה תחליף להנחיות הרופא.</p></div>` : ''; })()}
      ${(p.nutritionDislike || []).length ? `<div class="stack tight" data-dislikes><span class="small muted">מנות שסימנת "לא אוהב/ת" (לא יוצעו בתפריט האישי):</span><div class="chips wrap">${p.nutritionDislike.map(id => root.Logic.recipe(id) ? `<button class="chip" data-act="undislike" data-id="${id}" aria-label="החזרה: ${esc(root.Logic.recipe(id).he)}">${esc(root.Logic.recipe(id).he)} ✕</button>` : '').join('')}</div></div>` : ''}
      <button class="btn primary" data-act="savePrefs">שמירה והתאמת התפריט</button>
      <p class="tiny faint">ההגבלות חלות על כל יום בתפריט — בתוכנית הקלאסית (גם אחרי יום 30), בתוכנית אישית ואחרי שהיא מסתיימת: תוספות שניתן להחליף (דהי, חלב, ביצים בצד, גהי) מוחלפות ברכיב מתאים, ומנות אחרות מוחלפות במנה הקרובה ביותר שמתאימה; אם אין מנה מתאימה, הארוחה מוצגת ריקה עם הסבר. מה שכבר נרשם כנאכל — לא משתנה. מוצרי חלב בתפריט הבסיסי מסומנים "רשות" כשאפשר להחליף אותם.</p>`; })()}
      <div class="divider"></div>
      <label class="switch"><span>ארוחה גמישה שבועית</span><input type="checkbox" id="pf-f" ${p.prefs.flex ? 'checked' : ''} data-act="prefs"></label>
      <label class="field">שם התצוגה<select id="pf-fn" data-act="prefs"><option ${p.prefs.flexName === 'ארוחה גמישה' ? 'selected' : ''}>ארוחה גמישה</option><option ${p.prefs.flexName === 'Cheat Meal' ? 'selected' : ''}>Cheat Meal</option></select></label></section>
    <section class="card"><h2>יחידות ותצוגה</h2><div class="grid2"><label class="field">משקל<select id="u-w" data-act="units"><option value="kg" ${u.w === 'kg' ? 'selected' : ''}>קילוגרם</option><option value="lb" ${u.w === 'lb' ? 'selected' : ''}>פאונד</option></select></label><label class="field">אורך<select id="u-l" data-act="units"><option value="cm" ${u.len === 'cm' ? 'selected' : ''}>סנטימטר</option><option value="in" ${u.len === 'in' ? 'selected' : ''}>אינץ׳</option></select></label></div>
      <label class="field">גודל טקסט<select id="d-size" data-act="display"><option value="normal" ${p.display.size === 'normal' ? 'selected' : ''}>רגיל</option><option value="large" ${p.display.size === 'large' ? 'selected' : ''}>גדול</option></select></label>
      <label class="switch"><span>הפחתת אנימציות</span><input type="checkbox" id="d-mo" ${p.display.motion === 'reduce' ? 'checked' : ''} data-act="display"></label>
      <label class="switch"><span>מסך דולק במהלך אימון (אם נתמך)</span><input type="checkbox" id="d-wake" ${p.display.wake ? 'checked' : ''} data-act="display"></label>
      <label class="field">רמת הסבר<select id="d-exp" data-act="display"><option value="short" ${(p.display.explain || 'short') === 'short' ? 'selected' : ''}>קצר — עיקר ההוראה</option><option value="detail" ${p.display.explain === 'detail' ? 'selected' : ''}>מפורט — כולל "למה" וחישובים</option></select></label>
      <label class="switch"><span>צליל בסוף מנוחה</span><input type="checkbox" id="d-snd" ${p.display.sound ? 'checked' : ''} data-act="display"></label></section>
    <section class="card"><h2>תזכורות</h2><p class="small">התראות דחיפה מאפליקציית ווב באייפון דורשות שרת התראות — לא מומש באפליקציה הזו. במקום זה אפשר להעתיק את לוח האימונים כקובץ יומן (iCalendar) ולייבא ליומן של האייפון עם התראה יומית.</p>
      <div class="grid2"><label class="field">שעת אימון<input type="time" id="ics-t" value="07:00"></label><label class="field">התראה לפני (דק׳)<input type="number" id="ics-a" inputmode="numeric" value="15"></label></div><button class="btn" data-act="ics">${icon('cal')} ${root.Plans && root.Plans.active() ? 'יצירת קובץ יומן לתוכנית האישית' : 'יצירת קובץ יומן ל־30 הימים'}</button></section>
    <section class="card"><h2>גיבוי ושחזור</h2>
      <div class="banner info small">${icon('info')}<div>${root.FIT30_BACKEND ? 'הנתונים נשמרים <b>במכשיר ובדפדפן הזה</b> (Local Storage). עותק בשרת נשמר רק אם התחברת לחשבון והסנכרון פעיל (פרטים ב<a href="#/privacy">מרכז הפרטיות</a>). בלי חשבון,' : 'כל הנתונים נשמרים <b>רק במכשיר ובדפדפן הזה</b> (Local Storage). אין שרת ואין ענן.'} מחיקת נתוני האתר ב־Safari, או מעבר לטלפון אחר, ימחקו אותם — לכן חשוב לגבות. גיבוי אחרון: <b>${meta.lastBackup ? esc(S.fmtDate(meta.lastBackup.slice(0, 10))) : 'עדיין לא'}</b>. נפח בשימוש: ~${kb} KB.</div></div>
      <div class="btns"><button class="btn primary" data-act="export">${icon('share')} ייצוא גיבוי</button><button class="btn" data-act="import">שחזור מגיבוי</button></div><p class="small"><a href="#/privacy" data-privacy-link>מרכז פרטיות וייצוא נתונים (CSV)</a></p>${root.FIT30_BACKEND ? `<p class="tiny"><a href="#/admin" data-admin-link>ניהול תוכן (לצוות מורשה בלבד)</a></p>` : ''}
      <p class="tiny faint">הגיבוי כולל פרופיל, הגדרות, אימונים, יומן תזונה ומדידות. לא כולל תמונות.</p></section>
    <section class="card"><h2>התקנה במסך הבית</h2><a class="btn" href="#/install">${icon('phone')} הוראות התקנה ומצב לא מקוון</a></section>
    <section class="card"><h2>פרופיל ותוכנית אישית</h2><div class="btns"><a class="btn" href="#/profile">${icon('edit')} הפרופיל שלי</a><a class="btn" href="#/plan">${icon('route')} התוכנית שלי</a></div></section>
    <section class="card" data-help-link><h2>עזרה והדרכות</h2><p class="small muted">הדרכות קצרות לכל פעולה מרכזית — הוראות כתובות והקלטות מסך.</p><a class="btn" href="#/help">${icon('book')} לעזרה ולהדרכות</a></section>
    ${Screens.accountCard ? Screens.accountCard() : Screens.accountCardOff()}
    <section class="card" data-feedback-card><h2>דיווח לבטא</h2><p class="small muted">באג או רעיון — האפליקציה מכינה טקסט בלי מידע אישי, ואתם מעתיקים או משתפים אותו.</p><a class="btn" href="#/feedback" data-feedback-link>לכתיבת דיווח</a></section>
    <section class="card"><h2>מסלולים ומדיה</h2><div class="btns"><a class="btn" href="#/programs">${icon('route')} מסלולי אימון (תצוגה מקדימה)</a><a class="btn" href="#/media">${icon('image')} מצב מדיה ורישיונות</a></div></section>
    <section class="card"><h2>איפוס</h2><button class="btn danger" data-act="reset">מחיקת כל הנתונים</button></section>
    <p class="tiny faint">האפליקציה מספקת תוכנית כושר ותזונה כללית ואינה ייעוץ רפואי. הערכים התזונתיים הם הערכות.</p>`,
    handlers: {
      saveProfile: () => { const v = id => parseFloat(document.getElementById(id).value);
        const age = v('s-age'), h = v('s-h'), sw = v('s-sw'), w = v('s-w'), sd = document.getElementById('s-start').value;
        /* Stage H1: same ranges as the profile screen (screens_plan.js readBasics) */
        const wk = U.wIn(w, u.w), swk = U.wIn(sw, u.w);
        if (!(age >= 14 && age <= 100)) { root.UI.toast('גיל צריך להיות בין 14 ל־100.'); return; }
        if (!(h >= 120 && h <= 230)) { root.UI.toast('גובה צריך להיות בין 120 ל־230 ס״מ.'); return; }
        if (!(wk > 30 && wk < 300 && swk > 30 && swk < 300)) { root.UI.toast('משקל לא סביר (30–300 ק״ג).'); return; }
        if (!sd) { root.UI.toast('חסר תאריך התחלה.'); return; }
        Object.assign(p, { age, height: h, startWeight: U.wIn(sw, u.w), weight: U.wIn(w, u.w), startDate: sd }); S.save('profile'); root.UI.toast('הפרופיל נשמר. היסטוריה לא נמחקה.'); root.App.render(); },
      saveTargets: () => { const v = id => Math.round(+document.getElementById(id).value); const o = { kcal: v('t-k'), protein: v('t-p'), carbs: v('t-c'), fat: v('t-f') };
        if (o.kcal < 1200 || o.kcal > 5000) { root.UI.toast('ערך קלורי לא סביר'); return; } if (o.kcal < a.bmr) root.UI.toast('שימו לב: היעד נמוך מה־BMR המשוער', 3500);
        p.targets = Object.assign(o, { ctx: { weight: p.weight, goal: p.aims && p.aims.primary || null, activity: p.activity || null } }); /* RC1 (H-12): what the manual target was based on */ S.save('profile'); root.UI.toast('היעדים נשמרו'); root.App.render(); },
      autoTargets: () => { p.targets = null; S.save('profile'); root.UI.toast('חזרה לחישוב האוטומטי'); root.App.render(); },
      saveGoals: () => { const v = id => +document.getElementById(id).value; const ns = v('g-s') > 0 ? Math.max(1000, v('g-s')) : null; if (ns !== (p.goals.steps > 0 ? p.goals.steps : null)) root.Activity.setTarget(ns); const man = document.getElementById('g-wm').checked, wl = v('g-w'); /* M10: the field is in liters; stored in ml */
        p.goals = { steps: ns, stepsHistory: p.goals.stepsHistory, waterMode: man ? 'manual' : 'auto', water: man ? Math.min(6000, Math.max(500, Math.round((wl || 2) * 1000 / 50) * 50)) : p.goals.water, sleep: Math.max(4, v('g-sl') || 7.5) }; S.save('profile'); root.UI.toast('היעדים נשמרו'); },
      prefs: () => { const pf = C.normPrefs(p.prefs); pf.flex = document.getElementById('pf-f').checked; pf.flexName = document.getElementById('pf-fn').value; p.prefs = pf; S.save('profile'); root.UI.toast('נשמר'); },
      exclude: () => { const v = document.getElementById('pf-add').value; if (!v) return; const pf = C.normPrefs(p.prefs); if (!pf.exclude.includes(v)) pf.exclude.push(v); p.prefs = pf; S.save('profile'); root.App.render(); root.UI.toast('נוסף לרשימה — לחצו "שמירה והתאמת התפריט"'); },
      undislike: el => { p.nutritionDislike = (p.nutritionDislike || []).filter(x => x !== el.dataset.id); S.save('profile'); const ap = root.Plans.active(); if (ap && root.MealPlan.pending(ap)) root.MealPlan.applyChange(ap, 'עדכון מנות לא אהובות'); root.UI.toast('המנה חזרה לאפשרויות'); root.App.render(); },
      unexclude: el => { const pf = C.normPrefs(p.prefs); pf.exclude = pf.exclude.filter(f => f !== el.dataset.f); p.prefs = pf; S.save('profile'); root.App.render(); root.UI.toast('הוסר — לחצו "שמירה והתאמת התפריט"'); },
      savePrefs: () => { const pf = C.normPrefs(p.prefs); const g = id => document.getElementById(id);
        /* cuisine / region are saved live by FoodPrefs (one state for chips, favourite and region) */ Object.assign(pf, { dairy: !g('pf-d').checked, egg: !g('pf-e').checked, chicken: !g('pf-c').checked, fish: !g('pf-fi').checked, meat: !g('pf-m').checked, veg: g('pf-v').checked, vegan: g('pf-vg').checked, meals: +g('pf-meals').value === 2 ? 2 : 3, maxPrep: g('pf-prep').value ? +g('pf-prep').value : null });
        [['pf-soy', 'soya'], ['pf-pn', 'peanuts']].forEach(([id, f]) => { pf.exclude = pf.exclude.filter(x => x !== f); if (g(id).checked) pf.exclude.push(f); });
        if (g('pf-gf') && g('pf-gf').checked) pf.glutenFree = true; else delete pf.glutenFree;
        p.restrictionKinds = Object.assign({}, p.restrictionKinds || {}); document.querySelectorAll('[data-rk]').forEach(el => { if (el.value) p.restrictionKinds[el.dataset.rk] = el.value; else delete p.restrictionKinds[el.dataset.rk]; });
        p.prefs = pf; S.save('profile'); const r = C.applyPrefs(pf);
        /* saving preferences is the user's approval: an active personal plan regenerates its menu from the next open date */
        const ap = root.Plans.active(); let planUpd = null; if (ap && root.MealPlan.pending(ap)) { const pv = root.MealPlan.previewChange(ap); planUpd = { from: root.MealPlan.applyChange(ap, 'עדכון העדפות תזונה'), pv }; }
        root.UI.sheet('התפריט הותאם להעדפות', `<div class="kv"><span>ימים שנסרקו: <b>${r.days}</b></span><span>ארוחות שנבדקו: <b>${r.checked}</b></span><span>רכיבים שהוחלפו: <b>${r.ing}</b></span><span>מנות שהוחלפו: <b>${r.meal}</b></span><span>ארוחות שכמות החלבון בהן הוגדלה: <b>${r.boosted}</b></span></div>
          ${r.short.length ? `<div class="banner warn small"><div><b>${r.short.length} ימים</b> שבהם התפריט הבסיסי עדיין מתחת ליעד החלבון גם אחרי ההתאמה (${r.short.slice(0, 8).map(x => 'יום ' + x.n + ': ' + x.p + ' ג׳').join(' · ')}${r.short.length > 8 ? '…' : ''}). ביומן יוצעו תוספות להשלמה.</div></div>` : '<div class="banner info small"><div>התפריט הבסיסי מגיע ליעד החלבון בכל הימים שנסרקו.</div></div>'}
          ${r.none.length ? `<div class="banner warn small"><div><b>${r.none.length} ארוחות ללא חלופה מתאימה</b> — הן יוצגו ריקות עם הסבר (לא תוצג מנה עם מזון מוגבל):<ul class="bul">${r.none.slice(0, 12).map(x => `<li>יום ${x.n} · ${esc(C.slotNames[x.slot])}: ${esc(x.name)} (${esc(x.why)})</li>`).join('')}</ul>אפשר לבחור ידנית מנה מתאימה ביומן. בשילובי העדפות מסוימים אין במאגר מנה שתואמת לכל ההגבלות יחד.</div></div>` : '<div class="banner info small"><div>כל הארוחות המתוכננות תואמות עכשיו להעדפות.</div></div>'}
          ${planUpd ? `<div class="banner info small" data-plan-menu-updated><div><b>התפריט של התוכנית האישית עודכן מ־${esc(S.fmtDate(planUpd.from))}.</b> ממוצע ל־14 יום: ${planUpd.pv.after.kcal} קק״ל · ${planUpd.pv.after.protein} ג׳ חלבון · ${planUpd.pv.after.gaps} ימים עם פער חלבון · ${planUpd.pv.after.distinct} מנות שונות.</div></div>` : ''}
          <p class="tiny faint">הערכים התזונתיים חושבו מחדש. ימים שעברו ומזון שכבר נרשם כנאכל לא שונו.</p>`); },
      units: () => { p.units = { w: document.getElementById('u-w').value, len: document.getElementById('u-l').value }; S.save('profile'); root.App.render(); },
      display: () => { p.display = Object.assign({}, p.display, { size: document.getElementById('d-size').value, motion: document.getElementById('d-mo').checked ? 'reduce' : 'auto', wake: document.getElementById('d-wake').checked, sound: document.getElementById('d-snd').checked, explain: document.getElementById('d-exp') ? document.getElementById('d-exp').value : 'short' }); /* keeps display.run (workout prefs) */ S.save('profile'); root.App.applyDisplay(); },
      ics: () => { const t = document.getElementById('ics-t').value || '07:00', a = +document.getElementById('ics-a').value || 0; if (!(root.Plans && root.Plans.active())) return root.App.exportICS(t, a);
        root.App.loadChunk('extra.js').then(() => root.SyncTools.exportPlanICS(t, a), () => root.UI.toast('נדרש חיבור לאינטרנט בפעם הראשונה')); }, /* M11.4: an active personal plan exports ITS days */
      export: () => root.App.exportBackup(),
      import: () => root.App.importBackup(),
      reset: () => { root.UI.sheet('מחיקת כל הנתונים', `<p>פעולה זו מוחקת מהמכשיר את כל הרישומים, המדידות וההגדרות. לא ניתן לבטל. מומלץ לייצא גיבוי קודם.</p><label class="field">הקלידו "מחק" לאישור<input type="text" id="rs-c"></label><button class="btn danger" data-act="ok">מחיקה סופית</button>`,
        { ok: (el, e, close, b) => { if (b.querySelector('#rs-c').value.trim() !== 'מחק') { root.UI.toast('יש להקליד "מחק"'); return; } S.resetAll(); close(); location.hash = '#/'; location.reload(); } }); }
    } };
};

})(window);
