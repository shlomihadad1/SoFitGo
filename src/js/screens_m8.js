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
  '.coach-hero{display:grid;grid-template-columns:64px minmax(0,1fr);gap:var(--sp-4);align-items:center}' +
  '.coach-hero img,.coach-av-ph{width:64px;height:64px;border-radius:50%;object-fit:cover;border:2px solid var(--line-strong);background:var(--surface-2)}' +
  '.coach-say{background:var(--surface-2);border:1px solid var(--line);border-radius:var(--r) var(--r) var(--r) 4px;padding:var(--sp-3);display:flex;flex-direction:column;gap:var(--sp-2)}' +
  '.chat-off{display:flex;gap:var(--sp-2);align-items:center}.chat-off input{flex:1}' +
  '.tr-check{display:flex;align-items:center;gap:var(--sp-2);font-size:var(--fs-sm)}.tr-check svg{width:16px;height:16px;flex:none}.tr-check[data-ok="true"] svg{color:var(--good)}.tr-check[data-ok="false"] svg{color:var(--warn)}';
  document.head.appendChild(st); })();

/* ---------- Sofit coach ---------- */
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
    <section class="card" data-chat="unavailable"><h3>שאלה ל־${esc(name)}</h3>
      <div class="chat-off"><input type="text" disabled aria-disabled="true" placeholder="צ׳אט עדיין לא זמין" aria-label="צ׳אט — לא זמין"><button class="btn" disabled aria-disabled="true">שליחה</button></div>
      <p class="small muted">אין עדיין צ׳אט. תשובות אמיתיות דורשות שירות בינה מלאכותית אמיתי, והחלטה על עלות ופרטיות עוד פתוחה. עד אז לא מוצגות כאן תשובות — גם לא לדוגמה.</p></section>
    <section class="card"><h3>מה ${esc(name)} לא עושה</h3><ul class="bul small"><li>לא דיאטנית, לא רופאה ולא מטפלת, ולא נותנת אבחנה או טיפול.</li><li>לא משנה את התוכנית בלי שתאשרו.</li><li>בלי אשמה ובלי "עונש": דילוג, מנוחה וגרסה קצרה הם בחירות לגיטימיות.</li><li>כאב חד, סחרחורת או לחץ בחזה — עוצרים ופונים לגורם רפואי. <a href="#/planb">הנחיות עצירה</a></li></ul></section>`,
    handlers: {
      planStart: el => { const n2 = +el.dataset.n, d2 = root.Plans.dayOf(ap, n2); root.Run.start(n2, d2.type === 'assess' ? 'test' : (d2.version || 'std'), { id: ap.id, n: n2 }); },
      start: el => root.Run.start(+el.dataset.day, root.Logic.hasVersions(C.dayDef(+el.dataset.day)) ? Screens.selectedVersion.v : 'std'),
      eat: el => { Screens.toggleEat(today, el.dataset.slot); },
      water: el => { C.addWater(today, +el.dataset.ml); root.App.render(); } } };
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
    <section class="card" data-travel-train><h3>אימונים בדרכים</h3>
      ${ap ? `<p class="small muted">מצב נסיעה בתוכנית: לטווח תאריכים (עד 4 שבועות) תרגילים שדורשים ציוד מוחלפים בחלופות בלי ציוד, ואפשר גם גרסה קצרה. רואים מה ישתנה לפני האישור, ואפשר לבטל.</p>
        ${Screens.travelCard ? Screens.travelCard(ap) : ''}<div class="btns"><button class="btn primary" data-act="travelMode">${icon('route')} הגדרת מצב נסיעה</button></div>`
      : `<p class="small muted">מצב נסיעה (החלפת תרגילים לטווח תאריכים) קיים בתוכנית אישית. בתוכנית 30 היום הקלאסית יש גרסה קצרה לכל אימון.</p><div class="btns"><a class="btn" href="#/setup/1">בניית תוכנית אישית</a></div>`}
      <div class="list"><a class="li" href="${dayHref}" data-travel-link="today"><div class="grow"><div class="t">היום בלבד: גרסה קצרה, החלפת תרגיל או דילוג</div><div class="s">באימון של היום — בלי אשמה.</div></div>${icon('chev')}</a></div></section>
    <section class="card" data-travel-food><h3>אוכל בדרכים</h3><div class="list">
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
      offCheck: async () => { trSt.busy = true; root.App.render(); try { trSt.check = await offlineCheck(); } finally { trSt.busy = false; root.App.render(); } } } };
};
Screens.travel.offlineCheck = offlineCheck;
})(window);
