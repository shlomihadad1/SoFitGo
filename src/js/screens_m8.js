/* M8 · #/coach (Sofit coach screen) and #/travel (Travel & changed-plans hub) — on-demand chunk extra.js.
   Coach: Sofit is the app's DIGITAL coach. Everything she "says" here is built by fixed rules from the user's own plan and
   journal on this device (the same model as the NOW card). There is no AI service, so there is no chat: the input is shown
   disabled with the reason, and no answer is ever generated or simulated. She is not a dietitian, doctor or therapist.
   Travel: reuses what exists (plan travel mode = no-equipment swaps + short version; today's short version / skip; fridge;
   offline shell). The destination is ONLY a label the user types — the app never reads location. The offline check reports
   what the browser actually has in its caches right now; it never claims "ready" without finding the files.
   M9: the media cache holds images only — the service worker never caches videos (range requests go to the network) — so the
   check no longer calls cached items "videos", and says plainly that tutorial videos need a connection. */
(function (root) {
const { esc, icon } = root.UI; const S = root.Store, C = root.Core;
const Screens = root.Screens;
/* avatar shown at 64 CSS px: the only approved source is 192 px, so 64 px × 3 (iPhone DPR) is the largest size that is not
   upscaled. A larger hero needs a higher-resolution approved Sofit image (see the M8 asset inventory). */
/* screen-specific styles live with the screens (on-demand chunk), using the tokens from styles.css */
(function () { if (document.getElementById('m8-css')) return; const st = document.createElement('style'); st.id = 'm8-css'; st.textContent =
  '.coach-say .btns{flex-wrap:wrap}.coach-say .btns .btn{white-space:normal;height:auto;min-height:40px;max-width:100%;text-align:start;line-height:1.3;padding-block:8px}.coach-say p{overflow-wrap:anywhere}.chat-on{gap:8px;flex-wrap:nowrap}.chat-on input{flex:1;min-width:0}.ask-q{align-self:flex-start;background:var(--surface-3);border-radius:var(--r) var(--r) 4px var(--r);padding:6px 10px}.coach-say.warn{border-color:var(--warn,#c96)}' +
  '.coach-hero{display:grid;grid-template-columns:64px minmax(0,1fr);gap:var(--sp-4);align-items:center}' +
  '.coach-hero img,.coach-av-ph{width:64px;height:64px;border-radius:50%;object-fit:cover;border:2px solid var(--line-strong);background:var(--surface-2)}' +
  '.coach-say{background:var(--surface-2);border:1px solid var(--line);border-radius:var(--r) var(--r) var(--r) 4px;padding:var(--sp-3);display:flex;flex-direction:column;gap:var(--sp-2)}' +
  '.chat-off{display:flex;gap:var(--sp-2);align-items:center}.chat-off input{flex:1}' +
  '.tr-check{display:flex;align-items:center;gap:var(--sp-2);font-size:var(--fs-sm)}.tr-check svg{width:16px;height:16px;flex:none}.tr-check[data-ok="true"] svg{color:var(--good)}.tr-check[data-ok="false"] svg{color:var(--warn)}';
  document.head.appendChild(st); })();

/* ---------- Sofit coach ---------- */
const askLog = []; let askBusy = false; /* M11.2: this screen's conversation — memory only, cleared on reload, never stored */
function askPush(q) { const A = root.CoachAsk; if (!A || askBusy) return; q = String(q || '').trim(); if (!q) { root.UI.toast('כתבו שאלה או בחרו נושא'); return; }
  const item = { q, a: null, busy: true, err: null, by: A.provider.label }; askLog.push(item); if (askLog.length > 10) askLog.shift(); askBusy = true; root.App.render();
  A.provider.ask(q).then(a => { item.a = a; }, e => { item.err = 'לא הצלחתי לענות על זה כרגע. נסו שוב, או בחרו נושא מהרשימה.'; try { console.warn('coach', e); } catch (x) { } })
    .then(() => { item.busy = false; askBusy = false; if (location.hash === '#/coach') { root.App.render(); setTimeout(() => { const l = document.querySelectorAll('[data-ask-turn]'); if (l.length) l[l.length - 1].scrollIntoView({ block: 'nearest' }); }, 30); } }); }
function actBtn(x) { if (x.href) return `<a class="btn sm secondary" href="${x.href}">${esc(x.label)}</a>`;
  return `<button class="btn sm${x.act === 'coachRun' ? ' primary' : ''}" data-act="${x.act}" ${Object.entries(x.data || {}).map(([k, v]) => `data-${k}="${esc(String(v))}"`).join(' ')}>${esc(x.label)}</button>`; }
function askTurn(x) { const a = x.a;
  return `<div class="stack tight" data-ask-turn><div class="ask-q small" data-ask-q><b>את/ה:</b> ${esc(x.q)}</div>${x.busy ? `<div class="coach-say" data-ask-busy aria-busy="true"><p class="muted">רגע…</p></div>` : x.err ? `<div class="coach-say warn" data-ask-err role="alert"><p>${esc(x.err)}</p></div>` : `<div class="coach-say${a.safety ? ' warn' : ''}" data-ask-a="${a.id}">${a.lines.map(l => `<p>${esc(l)}</p>`).join('')}${a.chat ? `<p class="tiny" data-ask-chatctx>${esc(a.chat)}</p>` : ''}${(a.acts || []).length ? `<div class="btns">${a.acts.map(actBtn).join('')}</div>` : ''}<span class="tiny faint">${esc(x.by)}${a.src ? ' · מבוסס על: ' + esc(a.src) : ''}</span></div>`}</div>`; }
function coachLines(today) {
  const m = Screens.nowModel(today), done = m.done.filter(d => d.ok).length, total = m.done.length;
  const lines = [];
  if (!m.next) lines.push('כל מה שתוכנן להיום בוצע. מנוחה טובה היא חלק מהאימון — מחר ממשיכים מאותה נקודה.');
  else if (m.next.k === 'workout') lines.push(done ? `כבר סימנת ${done} מתוך ${total} דברים היום. הצעד הבא: ${m.next.he}.` : `הצעד הבא שלך היום: ${m.next.he}.`);
  else lines.push(`הצעד הבא: ${m.next.he}.`);
  if (m.small) lines.push(m.small.he);
  return { m, lines };
}
Screens.coach = function () {
  const today = S.today(), coach = root.FIT30_COACH, name = coach ? coach.name : 'המאמן הדיגיטלי', { m, lines } = coachLines(today), ap = root.Plans && root.Plans.active();
  const act = [];
  if (m.next && m.next.btn) act.push(m.next.btn);
  const link = (h, t, ic) => `<a class="btn secondary" href="${h}">${ic ? icon(ic) : ''}${t}</a>`;
  return { title: name, back: '#/', html: `
    <section class="card" data-coach-screen><div class="coach-hero">${coach ? `<img src="${esc(coach.avatar)}" alt="${esc(name)} — המאמנת הדיגיטלית" width="64" height="64">` : `<div class="coach-av-ph" aria-hidden="true"></div>`}
      <div class="stack tight"><h2>${esc(name)}</h2><span class="small muted">${coach ? 'המאמנת הדיגיטלית של SoFitGo — כושר ותזונה' : 'המאמן הדיגיטלי של האפליקציה'}</span>
      <span class="pill" data-coach-method>מבוססת כללים · לא צ׳אט AI</span></div></div>
      <div class="coach-say" data-coach-say>${lines.map(l => `<p>${esc(l)}</p>`).join('')}</div>
      ${act.length ? `<div class="btns">${act.join('')}</div>` : ''}
      <p class="tiny faint">ההודעה נבנית מהתוכנית ומהיומן שבמכשיר הזה, לפי כללים קבועים — אותם כללים של כרטיס "עכשיו" בבית. שום דבר לא נשלח לשרת.</p></section>
    <section class="card"><h3>היום עד עכשיו</h3><div class="chips now-done">${m.done.map(d => `<span class="chip" data-done="${d.k}" aria-pressed="${d.ok}">${d.ok ? '✓ ' : d.part ? '◐ ' : ''}${esc(d.he)}</span>`).join('')}</div></section>
    <section class="card"><h3>במה אפשר להיעזר</h3><div class="btns">${link('#/planb', 'Plan B — משהו לא מסתדר', 'info')}${link('#/travel', 'נסיעה / שינוי בלו״ז', 'route')}${link('#/fridge', 'מה לאכול ממה שיש', 'food')}${ap ? link('#/review', 'סיכום שבועי', 'chart') : ''}${link('#/explain', 'למה התוכנית בנויה ככה?', 'info')}</div></section>
    <section class="card" data-chat="local"><h3>שאלו את ${esc(name)}</h3>
      <p class="tiny muted" data-ask-method>תשובות מקומיות לפי נושא, מחושבות מהנתונים שלך במכשיר הזה. זה <b>לא</b> צ׳אט בינה מלאכותית: שאלה שאין לה נושא מתאים לא מקבלת תשובה מומצאת. שום דבר לא נשלח, והשיחה לא נשמרת.</p>
      <div class="chips wrap" role="group" aria-label="הצעות מהירות">${(root.CoachAsk ? root.CoachAsk.TOPICS : []).map(t => `<button class="chip" data-act="askT" data-t="${t.id}">${esc(t.he)}</button>`).join('')}</div>
      <div class="ask-log stack" data-ask-log aria-live="polite">${askLog.length ? askLog.map(askTurn).join('') : `<p class="small muted" data-ask-empty>עוד אין שיחה. בחרו הצעה למעלה או כתבו שאלה — למשל "יש לי 20 דקות", "חלופה לסקוואט", "מה לאכול עכשיו".</p>`}</div>
      <div class="chat-on row"><input type="text" id="ask-q" maxlength="120" placeholder="שאלה ל־${esc(name)}…" aria-label="שאלה ל־${esc(name)}" ${askBusy ? 'disabled' : ''}><button class="btn primary" data-act="ask" ${askBusy ? 'disabled' : ''}>שליחה</button></div>
      <details class="more" data-coach-ctx><summary>מה ${esc(name)} יודעת עליך</summary><p class="tiny muted">רק מה ששמור באפליקציה. מה שכותבים בשיחה משמש לתשובה אחת ולא נשמר — לעדכון קבוע, ערכו כאן:</p>
        <div class="list">${(root.CoachAsk ? root.CoachAsk.context() : []).map(c => `<div class="li"><div class="grow"><div class="s">${esc(c.k)}</div><div class="t${c.v ? '' : ' muted'}">${c.v ? esc(c.v) : 'לא הוזן'}</div></div><a class="btn sm ghost" href="${c.h}">${c.v ? 'עריכה' : 'הוספה'}</a></div>`).join('')}</div></details></section>
    <section class="card"><h3>מה ${esc(name)} לא עושה</h3><ul class="bul small"><li>לא דיאטנית, לא רופאה ולא מטפלת, ולא נותנת אבחנה או טיפול.</li><li>לא משנה את התוכנית בלי שתאשרו.</li><li>בלי אשמה ובלי "עונש": דילוג, מנוחה וגרסה קצרה הם בחירות לגיטימיות.</li><li>כאב חד, סחרחורת או לחץ בחזה — עוצרים ופונים לגורם רפואי. <a href="#/planb">הנחיות עצירה</a></li></ul></section>`,
    handlers: {
      planStart: el => { const n2 = +el.dataset.n, d2 = root.Plans.dayOf(ap, n2); root.Run.start(n2, d2.type === 'assess' ? 'test' : (d2.version || 'std'), { id: ap.id, n: n2 }); },
      start: el => root.Run.start(+el.dataset.day, root.Logic.hasVersions(C.dayDef(+el.dataset.day)) ? Screens.selectedVersion.v : 'std'),
      eat: el => { Screens.toggleEat(today, el.dataset.slot); },
      water: el => { C.addWater(today, +el.dataset.ml); root.UI.toast('נוספו ' + C.fmtL(+el.dataset.ml) + ' ל׳'); root.App.render(); },
      askT: el => { const t = (root.CoachAsk.TOPICS.find(x => x.id === el.dataset.t) || {}).he; if (t) askPush(t); },
      coachRun: el => { const pn = el.dataset.plan; if (pn && ap) root.Run.start(+pn, el.dataset.v, { id: ap.id, n: +pn }); else root.Run.start(+el.dataset.day, el.dataset.v); },
      coachSwap: el => { const sl = el.dataset.slot, r = root.Logic.recipe(el.dataset.rid); if (!root.MealOpt || !r) return;
        root.MealOpt.confirmSwap(today, sl, r.id, saved => { if (!saved) return; askLog.push({ q: 'החלפה: ' + r.he, a: { id: 'done', lines: [`נשמר בתפריט של היום: ${C.slotNames[sl]} — ${r.he}.`], acts: [{ href: '#/nutrition', label: 'לתפריט' }] }, by: 'פעולה באפליקציה' }); root.App.render(); }); },
      coachOpts: el => root.MealOpt && root.MealOpt.sheet(today, el.dataset.slot, el.dataset.s),
      coachDislike: el => { const r = root.Logic.recipe(el.dataset.rid); if (!r) return; root.UI.confirmSheet('לא אוהב/ת', `לסמן את "${r.he}" כמנה שלא אוהבים? היא לא תוצע יותר בתפריט. אפשר לבטל בהגדרות.`, 'סימון', () => {
        if (!root.MealOpt || !root.MealOpt.dislike(today, el.dataset.slot, r.id)) { root.UI.toast('השמירה נכשלה — הסימון לא נשמר'); return; }
        askLog.push({ q: 'לא אוהב/ת: ' + r.he, a: { id: 'done', lines: [`נשמר: "${r.he}" לא תוצע יותר. התפריט של היום מוחלף אוטומטית למנה מתאימה; אפשר לבחור אחרת.`], acts: [{ act: 'coachOpts', data: { slot: el.dataset.slot }, label: 'בחירת חלופה' }, { href: '#/nutrition', label: 'לתפריט' }] }, by: 'פעולה באפליקציה' }); root.App.render(); }); },
      ask: () => { const i = document.getElementById('ask-q'); const q = (i && i.value || '').trim(); if (i) i.value = ''; askPush(q); } },
    after: v => { const i = v.querySelector('#ask-q'); if (i) i.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); const q = i.value.trim(); i.value = ''; askPush(q); } }); } };
};

/* ---------- Travel & changed plans ---------- */
const trSt = { check: null, busy: false };
async function offlineCheck() {
  const out = { online: navigator.onLine !== false, sw: false, controlled: false, appFiles: null, appTotal: null, extra: false, media: null, error: null };
  try {
    if ('serviceWorker' in navigator) { const reg = await navigator.serviceWorker.getRegistration(); out.sw = !!reg; out.controlled = !!navigator.serviceWorker.controller; }
    if (root.caches) {
      const build = root.FIT30_BUILD, names = await caches.keys(), appName = names.find(n => n === 'fit30-' + build);
      const want = ['./', 'index.html', 'help.js', 'extra.js', 'manifest.webmanifest'];
      if (appName) { const c = await caches.open(appName), keys = await c.keys(); out.appTotal = keys.length; let have = 0;
        for (const w of want) { if (await c.match(new URL(w, location.href).href)) have++; else if (w === 'extra.js') continue; }
        out.appFiles = have; out.extra = !!(await c.match(new URL('extra.js', location.href).href)); }
      const mediaName = names.find(n => n === 'fit30-media-v1'); if (mediaName) out.media = (await (await caches.open(mediaName)).keys()).length; else out.media = 0;
    } else out.error = 'no-caches';
  } catch (e) { out.error = String(e && e.message || e).slice(0, 120); }
  out.ready = out.controlled && out.appFiles === 5;
  return out;
}
/* M12 · Travel Mode (extended): trip dates, minutes per day and equipment where you stay (profile.travel). While a trip is active
   the Plan Integrity Gate checks today's workout against THOSE limits; the original plan is never rewritten — changes go through
   the existing per-day mechanisms (shorter version, skip, move, swap) and the screen shows original / updated / done side by side. */
const TRIP_EQ = [['bands', 'גומיות'], ['dumbbells', 'משקולות'], ['gym', 'חדר כושר במלון'], ['outdoor', 'מקום לאימון בחוץ']];
function tripCard(tr) { const on = root.Gate && root.Gate.trip ? root.Gate.trip() : null, eq = tr.eq || [];
  return `<section class="card" data-trip><h3>פרטי הנסיעה</h3>${on ? `<p class="small good" data-trip-on>נסיעה פעילה עד ${esc(S.fmtDate(tr.to))}: האימונים נבדקים מול ${tr.minutes ? tr.minutes + ' דק׳ ביום ו' : ''}${eq.length ? 'הציוד: ' + esc(eq.map(k => (TRIP_EQ.find(x => x[0] === k) || [k, k])[1]).join(', ')) : 'בלי ציוד'}.</p>` : ''}
    <div class="grid2"><label class="field">מתאריך<input type="date" id="tr-from" value="${esc(tr.from || '')}"></label><label class="field">עד תאריך<input type="date" id="tr-to" value="${esc(tr.to || '')}"></label></div>
    <label class="field">זמן לאימון ביום הנסיעה<select id="tr-min"><option value="">כמו בפרופיל</option>${[10, 15, 20, 30, 45].map(m => `<option value="${m}" ${+tr.minutes === m ? 'selected' : ''}>${m} דק׳</option>`).join('')}</select></label>
    <div class="stack tight"><span class="small muted">מה יש במקום? (בלי סימון = בלי ציוד)</span><div class="chips">${TRIP_EQ.map(([k, h]) => `<button class="chip" data-act="trEq" data-k="${k}" aria-pressed="${eq.includes(k)}">${h}</button>`).join('')}</div></div>
    <div class="btns"><button class="btn primary" data-act="tripSave">שמירת הנסיעה</button>${tr.from ? '<button class="btn ghost" data-act="tripEnd">סיום הנסיעה</button>' : ''}</div>
    <p class="tiny faint">נשמר רק במכשיר. האפליקציה לא מזהה מיקום; היעד הוא טקסט שהזנת.</p></section>`; }
function todayCard(ap, n) {
  const today = S.today(), G = root.Gate; if (!n) return '';
  const pl = ap ? root.Plans.dayOf(ap, n) : null, def = ap ? root.Plans.runDef(ap.id, n) : C.dayDef(n), cls = !ap, w = S.load('workouts');
  if (!def || !(def.main || []).length || (pl && !root.Plans.isTraining(pl))) return `<section class="card" data-travel-today><h3>היום</h3><p class="small">אין אימון היום בתוכנית.</p></section>`;
  const orig = `${def.title || 'אימון'} · גרסה רגילה ~${root.Logic.estimateMinutes(def, 'std')} דק׳`;
  const upd = pl ? (pl.status === 'skipped' ? 'דילוג (נשמר)' : pl.movedTo && pl.movedTo !== today ? `הועבר ל־${S.fmtDate(pl.movedTo)}` : `גרסה ${root.Logic.VERSIONS[pl.version || 'std']} ~${root.Logic.estimateMinutes(def, pl.version || 'std')} דק׳`) : 'כמו המקור (בתוכנית 30 היום בוחרים גרסה בהתחלה)';
  const lg = pl ? pl.log : (w.days[n] && w.days[n].date === today ? w.days[n] : null), done = lg ? ({ done: 'בוצע', partial: 'בוצע חלקית', skipped: 'דולג' }[lg.status] || lg.status) : 'עוד לא';
  const g = G ? G.checkWorkout(def, { plan: ap, n, version: pl ? pl.version || 'std' : 'std', exFor: cls ? id => C.exFor(n, id) : null }) : null;
  const t = C.targets(), e = C.eatenTotals(today), pt = C.plannedTotals(today, 'selected');
  return `<section class="card" data-travel-today><h3>היום — מקורי, מעודכן ובפועל</h3>
    <dl class="pdl small" data-today-states><dt>מקורי</dt><dd>${esc(orig)}</dd><dt>מעודכן</dt><dd data-today-upd>${esc(upd)}</dd><dt>בפועל</dt><dd>${esc(done)}</dd></dl>
    ${g && root.GateUI ? root.GateUI.panel(g, { what: G.trip() ? 'לזמן ולציוד של הנסיעה' : 'לזמן ולציוד שהגדרת', plan: ap, n, canShort: !lg && (cls ? root.Logic.hasVersions(def) : !['assess', 'active'].includes(pl.type)) }) : ''}
    ${lg ? '' : `<div class="stack tight"><span class="small muted">משהו השתנה היום?</span><div class="btns">
      <button class="btn sm" data-act="dayTired">עייף/ה — גרסה קצרה</button><button class="btn sm" data-act="dayLate">מתעכב/ת — ${ap ? 'להעביר למחר' : 'מחר'}</button><button class="btn sm" data-act="dayUnwell">לא מרגיש/ה טוב — מנוחה</button></div></div>`}
    <div class="kv small" data-today-food>${t ? `<span>תזונה מתוכננת: ${Math.round(pt.k)}/${t.kcal} קק״ל · ${Math.round(pt.p)}/${t.protein} ג׳ חלבון</span>` : '<span>אין יעדים (חסרים נתוני פרופיל)</span>'}<span>נאכל בפועל: ${Math.round(e.k)} קק״ל · ${Math.round(e.p)} ג׳ חלבון</span></div>
    <p class="tiny faint">התוכנית המקורית נשמרת; שינוי חל על היום בלבד ואפשר לבטל אותו במסך התוכנית.</p></section>`;
}
Screens.travel = function () {
  const p = S.load('profile'), tr = p.travel || {}, ap = root.Plans && root.Plans.active(), td = ap ? root.Plans.todayDay(ap) : null;
  const n = ap ? (td && td.n) : C.clampDay(C.todayN()), dayHref = ap ? (n ? '#/pday/' + n : '#/plan') : '#/day/' + n, ck = trSt.check;
  const row = (ok, t) => `<div class="tr-check" data-ok="${ok}">${icon(ok ? 'check' : 'info')}<span>${t}</span></div>`;
  return { title: 'נסיעה ושינוי בתוכניות', back: '#/planb', html: `
    <section class="card" data-travel-hub><p class="small">כשהלו״ז משתנה, הציוד חסר או שאתם בדרכים — כאן מרוכזות הפעולות שכבר קיימות באפליקציה. שום דבר לא משתנה בלי שתאשרו.</p></section>
    <section class="card" data-travel-dest><h3>לאן? (רשות)</h3>
      <p class="tiny muted">האפליקציה <b>לא מזהה מיקום</b> ולא מבקשת הרשאת מיקום. אם תרצו, כתבו יעד — הוא נשמר רק כתווית במכשיר הזה ולא משנה את התפריט או האימונים.</p>
      <div class="row"><input id="tr-dest" type="text" maxlength="60" placeholder="למשל: אילת, כנס בברלין" value="${esc(tr.dest || '')}" aria-label="יעד (טקסט חופשי)"><button class="btn sm" data-act="destSave">שמירה</button>${tr.dest ? '<button class="btn sm ghost" data-act="destClear">ניקוי</button>' : ''}</div>
      ${tr.dest ? `<p class="small" data-dest-label>יעד שנרשם: <b>${esc(tr.dest)}</b> <span class="tiny muted">(הוזן ידנית)</span></p>` : ''}</section>
    ${tripCard(tr)}${todayCard(ap, n)}
    <section class="card" data-travel-train><h3>אימונים בדרכים</h3>
      ${ap ? `<p class="small muted">מצב נסיעה בתוכנית: לטווח תאריכים (עד 4 שבועות) תרגילים שדורשים ציוד מוחלפים בחלופות בלי ציוד, ואפשר גם גרסה קצרה. רואים מה ישתנה לפני האישור, ואפשר לבטל.</p>
        ${Screens.travelCard ? Screens.travelCard(ap) : ''}<div class="btns"><button class="btn primary" data-act="travelMode">${icon('route')} הגדרת מצב נסיעה</button></div>`
      : `<p class="small muted">מצב נסיעה (החלפת תרגילים לטווח תאריכים) קיים בתוכנית אישית. בתוכנית 30 היום הקלאסית יש גרסה קצרה לכל אימון.</p><div class="btns"><a class="btn" href="#/setup/1">בניית תוכנית אישית</a></div>`}
      <div class="list"><a class="li" href="${dayHref}" data-travel-link="today"><div class="grow"><div class="t">היום בלבד: גרסה קצרה, החלפת תרגיל או דילוג</div><div class="s">באימון של היום — בלי אשמה.</div></div>${icon('chev')}</a></div></section>
    <section class="card" data-travel-food><h3>אוכל בדרכים</h3><div class="list">
      <a class="li" href="#/nearby${tr.dest ? '/' + encodeURIComponent(tr.dest) : ''}" data-travel-link="nearby"><div class="grow"><div class="t">אוכל ${tr.dest ? 'ב' + esc(tr.dest) : 'בקרבתי'}</div><div class="s">חיפוש אצל ספק מפות חיצוני — לפי מיקום (רק באישור) או לפי היעד שהזנת.</div></div>${icon('chev')}</a>
      <a class="li" href="#/fridge" data-travel-link="fridge"><div class="grow"><div class="t">מה אפשר להכין ממה שיש</div><div class="s">למשל במטבחון של דירה או מלון.</div></div>${icon('chev')}</a>
      <a class="li" href="#/nutrition" data-travel-link="nutrition"><div class="grow"><div class="t">החלפת ארוחה ביומן</div><div class="s">כולל ארוחות מסעדה כלליות — ערכים משוערים בלבד.</div></div>${icon('chev')}</a></div>
      <p class="tiny faint">אין כאן מסעדות אמיתיות או תפריטים מקומיים — אלה דורשים נתונים חיצוניים שעוד לא קיימים.</p></section>
    <section class="card" data-travel-offline><h3>בלי אינטרנט</h3>
      <p class="small muted">האפליקציה שומרת עותק של עצמה במכשיר. לפני טיסה כדאי לבדוק שהעותק באמת שמור.</p>
      <button class="btn" data-act="offCheck" ${trSt.busy ? 'disabled' : ''}>${trSt.busy ? 'בודק…' : 'בדיקה עכשיו'}</button>
      ${ck ? `<div class="stack tight" data-offline-result="${ck.ready ? 'ready' : 'not-ready'}">
        ${row(ck.online, ck.online ? 'יש חיבור כרגע' : 'אין חיבור כרגע')}
        ${ck.error === 'no-caches' ? row(false, 'בסביבה הזו אין מטמון דפדפן — הבדיקה לא אפשרית') : ''}
        ${row(ck.controlled, ck.controlled ? 'עותק לא־מקוון פעיל בדף הזה' : 'העותק הלא־מקוון עוד לא פעיל בדף הזה (טענו מחדש פעם אחת כשיש חיבור)')}
        ${ck.appFiles != null ? row(ck.appFiles === 5, `קבצי האפליקציה בגרסה הנוכחית: ${ck.appFiles} מתוך 5 נמצאו`) : (ck.error !== 'no-caches' ? row(false, 'לא נמצא עותק של הגרסה הנוכחית') : '')}
        ${ck.media != null ? row(ck.media > 0, ck.media ? `${ck.media} תמונות ואיורים שמורים במכשיר` : 'עוד אין תמונות ואיורים שמורים במכשיר (הם נשמרים בפעם הראשונה שרואים אותם)') : ''}
        ${row(false, 'סרטוני הדרכה: נטענים רק עם חיבור — הם לא נשמרים במכשיר')}
        <p class="small ${ck.ready ? 'good' : 'warn'}"><b>${ck.ready ? 'מוכן לעבודה בלי אינטרנט (האימונים, התפריט והיומן).' : 'עדיין לא מוכן לגמרי — ראו למעלה.'}</b></p>
        ${ck.error && ck.error !== 'no-caches' ? `<p class="tiny bad">${esc(ck.error)}</p>` : ''}</div>` : ''}</section>`,
    handlers: {
      destSave: () => { const v = document.getElementById('tr-dest').value.trim().slice(0, 60), pr = S.load('profile'); pr.travel = Object.assign({}, pr.travel, { dest: v || null, at: new Date().toISOString() }); if (S.save('profile')) root.UI.toast(v ? 'היעד נשמר כתווית' : 'היעד נוקה'); root.App.render(); },
      destClear: () => { const pr = S.load('profile'); pr.travel = Object.assign({}, pr.travel, { dest: null, at: new Date().toISOString() }); if (S.save('profile')) root.UI.toast('היעד נוקה'); root.App.render(); },
      travelMode: () => { if (ap && Screens.travelSheet) Screens.travelSheet(ap); },
      trEq: el => el.setAttribute('aria-pressed', el.getAttribute('aria-pressed') !== 'true'),
      tripSave: () => { const f = document.getElementById('tr-from').value, t2 = document.getElementById('tr-to').value, mn = document.getElementById('tr-min').value;
        if (!f || !t2 || t2 < f) { root.UI.toast('בחרו תאריך התחלה וסיום (הסיום אחרי ההתחלה)'); return; }
        const eq = [...document.querySelectorAll('[data-act=trEq][aria-pressed=true]')].map(b => b.dataset.k), pr = S.load('profile');
        pr.travel = Object.assign({}, pr.travel, { from: f, to: t2, minutes: mn ? +mn : null, eq, at: new Date().toISOString() });
        if (S.save('profile') === false && S.storageOKAtStart) { root.UI.toast('השמירה נכשלה'); return; } root.UI.toast('הנסיעה נשמרה'); root.App.render(); },
      tripEnd: () => { const pr = S.load('profile'); pr.travel = Object.assign({}, pr.travel, { from: null, to: null, minutes: null, eq: [] }); S.save('profile'); root.UI.toast('הנסיעה הסתיימה'); root.App.render(); },
      dayTired: () => { try { if (ap) { root.Plans.setVersion(ap.id, n, 'short'); root.UI.toast('היום: גרסה קצרה'); root.App.render(); } else root.Run.start(n, 'short'); } catch (e) { root.UI.toast(e.message); } },
      dayLate: () => { if (!ap) { root.UI.toast('בתוכנית 30 היום אפשר להתאמן מחר; היום יישאר לא מסומן ואפשר להשלים אותו.'); return; }
        try { root.Plans.move(ap.id, n, S.addDays(S.today(), 1)); root.UI.toast('האימון הועבר למחר'); root.App.render(); } catch (e) { root.UI.toast(e.message); } },
      dayUnwell: () => { if (!ap) { root.UI.toast('מנוחה היום. אין צורך לסמן — אפשר להשלים כשמרגישים טוב.'); return; }
        root.UI.confirmSheet('מנוחה היום', 'לסמן דילוג על האימון של היום? אפשר לבטל במסך התוכנית. אם יש חום, כאב בחזה או סחרחורת — לפנות לגורם רפואי.', 'דילוג', () => { try { root.Plans.skip(ap.id, n); root.UI.toast('דילוג נשמר. החלמה מהירה.'); root.App.render(); } catch (e) { root.UI.toast(e.message); } }); },
      ...(root.GateUI ? root.GateUI.handlers({ plan: ap, n, date: S.today(), onShort: () => { try { if (ap) root.Plans.setVersion(ap.id, n, 'short'); root.UI.toast('היום: גרסה קצרה'); root.App.render(); } catch (e) { root.UI.toast(e.message); } } }) : {}),
      offCheck: async () => { trSt.busy = true; root.App.render(); try { trSt.check = await offlineCheck(); } finally { trSt.busy = false; root.App.render(); } } } };
};
Screens.travel.offlineCheck = offlineCheck;
})(window);
