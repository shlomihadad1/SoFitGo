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
