/* App shell: router, navigation, rendering, backup/export, PWA registration */
(function (root) {
const { esc, icon } = root.UI;
const S = root.Store, C = root.Core, P = root.PROGRAM;
const Screens = root.Screens;
const App = root.App = { swState: 'none', figStops: [] };
/* RC1: the help chunk is loaded on first use (precached by the service worker for offline use) */
let helpReq = null;
function helpLoading() {
  if (!helpReq) { helpReq = new Promise((res, rej) => { const sc = document.createElement('script'); sc.src = 'help.js'; sc.onload = res; sc.onerror = rej; document.head.appendChild(sc); })
    .then(() => { if (location.hash.startsWith('#/help')) App.render(); }).catch(() => { helpReq = null; const v = document.querySelector('[data-help-loading]'); if (v) v.innerHTML = '<p class="small warn">לא ניתן לטעון את ההדרכות כרגע. בפעם הראשונה נדרש חיבור לאינטרנט; אחרי זה הן זמינות גם בלי חיבור.</p>'; }); }
  return { title: 'עזרה והדרכות', back: '#/settings', html: '<section class="card" data-help-loading><p class="small muted">טוען הדרכות…</p></section>', handlers: {} };
}
/* M10: any on-demand chunk by file name (account.js); one request per chunk, retried after a failure */
const chunks = {};
App.loadChunk = name => chunks[name] || (chunks[name] = new Promise((res, rej) => { const sc = document.createElement('script'); sc.src = name; sc.onload = res; sc.onerror = () => { delete chunks[name]; rej(new Error('chunk ' + name)); }; document.head.appendChild(sc); }));
/* Workout mode (run.js + run_state.js) lives in extra.js with its setup sheet; until it is loaded, this stub loads it and forwards the
   call, so every screen keeps calling Run.start / Run.open as before. In the single-file artifact the chunk is inline and replaces it. */
if (!root.Run) { const later = n => (...a) => App.loadChunk('extra.js').then(() => { if (root.Run.real) return root.Run[n](...a); }, () => root.UI.toast('מצב אימון נטען בפעם הראשונה רק עם חיבור לאינטרנט. נסו שוב כשיש חיבור.'));
  root.Run = { stub: true, start: later('start'), open: later('open'), close: () => { }, state: () => null }; }
function accountLoading(title, back) {
  App.loadChunk('account.js').then(() => App.render(), () => { const v = document.querySelector('[data-extra-loading]'); if (v) v.innerHTML = '<p class="small warn">לא ניתן לטעון את המסך כרגע. בפעם הראשונה נדרש חיבור לאינטרנט.</p>'; });
  return { title, back, html: '<section class="card" data-extra-loading><p class="small muted">טוען…</p></section>', handlers: {} };
}
/* RC5: generic on-demand chunk (extra.js) — same pattern as help.js */
let extraReq = null;
function extraLoading(title, back) {
  if (!extraReq) { extraReq = App.loadChunk('extra.js') /* one loader for extra.js (before: a second <script> could run the chunk twice) */
    .then(() => App.render()).catch(() => { extraReq = null; const v = document.querySelector('[data-extra-loading]'); if (v) v.innerHTML = '<p class="small warn">לא ניתן לטעון את המסך כרגע. בפעם הראשונה נדרש חיבור לאינטרנט; אחרי זה הוא זמין גם בלי חיבור.</p>'; }); }
  return { title, back, html: '<section class="card" data-extra-loading><p class="small muted">טוען…</p></section>', handlers: {} };
}
const ENV = root.FIT30_ENV || 'pwa';

const tr = k => (root.I18N ? root.I18N.t(k) : k);
const NAV = [ { h: '#/', k: 'home', i: 'home' }, { h: '#/calendar', k: 'calendar', i: 'cal' }, { h: '#/workouts', k: 'workouts', i: 'dumbbell' }, { h: '#/nutrition', k: 'nutrition', i: 'food' }, { h: '#/progress', k: 'progress', i: 'chart' } ];
const SECTION = { builder: 'workouts', privacy: 'settings', admin: 'settings', account: 'settings', legal: 'settings', coach: 'home', travel: 'home', planb: 'home', feedback: 'settings', fridge: 'nutrition', activity: 'progress', help: 'settings', explain: 'workouts', review: 'progress', records: 'progress', shopping: 'nutrition', home: 'home', calendar: 'calendar', workouts: 'workouts', day: 'workouts', library: 'workouts', ex: 'workouts', nutrition: 'nutrition', recipes: 'nutrition', recipe: 'nutrition', 'nearby': 'nutrition', targets: 'nutrition', progress: 'progress', settings: 'settings', programs: 'workouts', program: 'workouts', media: 'settings', profile: 'settings', setup: 'workouts', plan: 'workouts', pday: 'workouts', install: 'settings' };

function route() {
  const h = (location.hash || '#/').replace(/^#\/?/, ''); const [name, arg, ...rest] = h.split('/');
  return { name: name || 'home', arg: arg ? decodeURIComponent(arg) : null, rest: rest.map(decodeURIComponent) };
}
function pdayToday() { const ap = root.Plans && root.Plans.active(), td = ap ? root.Plans.todayDay(ap) : null; return td ? String(td.n) : null; }
function screenFor(r) {
  switch (r.name) {
    case 'home': return Screens.home();
    case 'calendar': return Screens.calendar();
    case 'workouts': return Screens.workouts();
    case 'day': return Screens.day(r.arg || C.clampDay(C.todayN()));
    case 'ex': return Screens.exercise(r.arg);
    case 'nutrition': return Screens.nutrition(r.arg && /^\d{4}-\d{2}-\d{2}$/.test(r.arg) ? r.arg : null);
    case 'recipes': return Screens.recipes ? Screens.recipes() : extraLoading('מתכונים', '#/nutrition'); /* M10.4: extra.js */
    case 'recipe': return Screens.recipe ? Screens.recipe(r.arg, r.rest[0], r.rest[1]) : extraLoading('מתכון', '#/nutrition'); /* M10.4: extra.js */
    case 'nearby': return Screens.foodNear ? Screens.foodNear(r.arg) : extraLoading('אוכל בקרבתי', '#/nutrition'); /* M10.4: extra.js, location only on tap */
    case 'targets': return Screens.targets();
    case 'progress': return Screens.progress();
    case 'settings': return Screens.settings();
    case 'install': return Screens.install ? Screens.install() : extraLoading('התקנה ועבודה בלי חיבור', '#/settings'); /* M10: moved to extra.js */
    case 'builder': return Screens.builder ? Screens.builder(r.arg) : extraLoading('בניית אימון', '#/workouts'); /* Workout Builder (extra.js) */
    case 'privacy': return Screens.privacy ? Screens.privacy() : extraLoading('מרכז פרטיות', '#/settings'); /* Privacy Center (extra.js) */
    case 'experiments': return Screens.experiments ? Screens.experiments() : extraLoading('ניסויים אישיים', '#/progress'); /* SLL-29 (extra.js) */
    case 'patterns': return Screens.patterns ? Screens.patterns() : extraLoading('דפוסים אישיים', '#/progress'); /* SLL-06 / SLL-11 (extra.js) */
    case 'today': return Screens.today ? Screens.today() : extraLoading('היום שלי', '#/'); /* SLL-13 (extra.js) */
    case 'presets': return Screens.presets ? Screens.presets() : extraLoading('ערכות העדפות', '#/settings'); /* SLL-40 (extra.js) */
    case 'reset': return Screens.reset ? Screens.reset() : extraLoading('איפוס שבועי', '#/review'); /* SLL-25 (extra.js) */
    case 'changes': return Screens.changes ? Screens.changes() : extraLoading('יומן שינויים בהגדרות', '#/settings'); /* SLL-42 (extra.js) */
    case 'programs': return Screens.programs ? Screens.programs() : extraLoading('מסלולים', '#/workouts'); /* M8: moved to extra.js (first-load budget) */
    case 'program': return Screens.program ? Screens.program(r.arg) : extraLoading('מסלול', '#/programs');
    case 'media': return Screens.media ? Screens.media() : extraLoading('סרטוני הדרכה', '#/settings');
    case 'profile': return Screens.profile ? Screens.profile() : extraLoading('פרופיל', '#/settings'); /* M10: moved to extra.js */
    case 'setup': return Screens.setup(r.arg);
    case 'plan': return Screens.plan();
    case 'pday': return Screens.pday ? Screens.pday(r.arg || pdayToday()) : extraLoading('יום בתוכנית', '#/plan'); /* M10.2: moved to extra.js */ /* M8: '#/pday' without a day opens today's plan day instead of "not found" */
    case 'explain': return Screens.explain ? Screens.explain() : extraLoading('למה ככה?', '#/workouts');
    case 'review': return Screens.review ? Screens.review(r.arg) : extraLoading('סיכום שבועי', '#/progress');
    case 'shopping': return Screens.shopping ? Screens.shopping(r.arg) : extraLoading('רשימת קניות', '#/nutrition');
    case 'records': return Screens.records ? Screens.records() : extraLoading('שיאים ואבני דרך', '#/progress');
    case 'planb': return Screens.planb ? Screens.planb() : extraLoading('Plan B', '#/');
    case 'feedback': return Screens.feedback ? Screens.feedback() : extraLoading('דיווח לבטא', '#/settings');
    case 'fridge': return Screens.fridge ? Screens.fridge() : extraLoading('מה יש במקרר?', '#/nutrition');
    case 'activity': return Screens.activity ? Screens.activity() : extraLoading('צעדים ו־MoveScore', '#/progress');
    case 'coach': return Screens.coach ? Screens.coach() : extraLoading(root.FIT30_COACH ? root.FIT30_COACH.name : 'המאמן הדיגיטלי', '#/');
    case 'travel': return Screens.travel ? Screens.travel() : extraLoading('נסיעה ושינוי בתוכניות', '#/planb');
    case 'help': return Screens.help ? Screens.help() : helpLoading();
    case 'account': return Screens.account ? Screens.account(r.arg) : accountLoading('חשבון וסנכרון', '#/settings');
    case 'admin': if (Screens.admin) return Screens.admin(r.arg); App.loadChunk('account.js').then(() => App.loadChunk('cms.js')).then(() => App.loadChunk('admin.js')).then(() => App.render(), () => { const v = document.querySelector('[data-extra-loading]'); if (v) v.innerHTML = '<p class="small warn">לא ניתן לטעון את ממשק הניהול כרגע. נדרש חיבור לאינטרנט.</p>'; }); return { title: 'ניהול תוכן', back: '#/settings', html: '<section class="card" data-extra-loading><p class="small muted">טוען…</p></section>', handlers: {} }; /* Admin CMS */
    case 'legal': return Screens.legal ? Screens.legal(r.arg) : accountLoading('פרטיות ותנאי הבטא', '#/account');
    default: return Screens.home();
  }
}
App.mountFig = function (box, still, keep) {
  if (!box) return null; const id = box.getAttribute('data-fig') || null; const ex = root.EX_BY_ID[id || box.dataset.ex];
  let exObj = ex;
  if (!exObj) { // run mode: figure exercise from session
    const s = S.load('session'); if (s) { const st = root.Logic.buildSteps(C.dayDef(s.day), s.version)[s.stepIdx]; exObj = root.EX_BY_ID[C.exFor(s.day, st.ex)]; }
  }
  if (!exObj) return null;
  const tag = box.querySelector('.tag') ? box.querySelector('.tag').outerHTML : '', ph = box.querySelector('.phase') ? '<span class="phase" data-phase></span>' : '';
  const holder = document.createElement('div'); holder.style.position = 'absolute'; holder.style.inset = '0';
  box.innerHTML = ''; box.appendChild(holder); box.insertAdjacentHTML('beforeend', tag + ph);
  const reduce = C.profile().display.motion === 'reduce' || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const stop = root.Figure.mount(holder, exObj, { still: still || null, reduceMotion: reduce, phaseEl: box.querySelector('[data-phase]') });
  if (!keep) App.figStops.push(stop);
  if (still && box.querySelector('[data-phase]')) box.querySelector('[data-phase]').textContent = still === 'A' ? 'תנוחת התחלה' : 'תנוחת סיום';
  return stop;
};
App.applyDisplay = function () {
  const d = C.profile().display; document.documentElement.dataset.size = d.size; document.documentElement.dataset.motion = d.motion === 'reduce' ? 'reduce' : '';
};
let lastName = null;
/* SoFitGo candidate mark C2 (two chevrons, cut spine). Source: sofitgo-brand/candidates-v2. Swap here when the logo is approved. */
const BRAND_MARK_C2 = `<span class="brand" role="img" aria-label="${esc(root.FIT30_BRAND || 'כושר 30')}"><svg class="brand-mark" viewBox="0 0 100 100" aria-hidden="true"><path d="M86 16H44L19 36l21 14h5m10 0h5l23 15-25 19H14" transform="translate(50 50) skewX(-12) translate(-50 -50)" fill="none" stroke="currentColor" stroke-width="21" stroke-miterlimit="10"/></svg></span>`;
/* M9: SoFitGo wordmark (≥ 360 px wide) / symbol only (narrower), from the supplied logo package — PROVISIONAL rasters until the
   vector original arrives. <picture> fetches only the one that is shown. Without logo files (legacy brand) the C2 mark stays. */
const LOGO = root.FIT30_LOGO;
const BRAND_MARK = LOGO ? `<span class="brand" role="img" aria-label="${esc(root.FIT30_BRAND || 'SoFitGo')}"><picture><source media="(max-width: 359px)" srcset="${esc(LOGO.sym)}"><img class="brand-logo" src="${esc(LOGO.word)}" alt="" height="26"></picture></span>` : BRAND_MARK_C2;
/* M10.4 · the sticky stack (header + section-index chips, incl. the safe-area inset) is MEASURED, not assumed: --sticky-h feeds
   html { scroll-padding-top } so the browser (also Safari when the keyboard opens and when a chip jumps to a section) never parks
   a field or a heading underneath it. Before, the field-focus fix assumed 70px while the settings index ends at ~119px. */
App.stickyH = function () { const t = document.getElementById('top'), ix = document.querySelector('[data-sec-index]'); let h = t ? t.getBoundingClientRect().bottom : 0;
  if (ix && getComputedStyle(ix).position === 'sticky') h = Math.max(h, Math.round(parseFloat(getComputedStyle(ix).top) || 0) + ix.getBoundingClientRect().height);
  document.documentElement.style.setProperty('--sticky-h', Math.round(h) + 'px'); document.documentElement.style.setProperty('--top-h', Math.round(t ? t.getBoundingClientRect().height : 54) + 'px'); return h; };
window.addEventListener('resize', () => App.stickyH());
App.render = function () {
  App.figStops.forEach(f => f && f()); App.figStops = [];
  const r = route(); let scr;
  try { scr = root.CMS && root.CMS.isOff(r.name) ? { title: 'לא זמין', back: '#/', html: `<div class="banner info" data-cms-module-off>${icon('info')}<div>האזור הזה כבוי כרגע בהגדרות האפליקציה. הנתונים שלך לא נמחקו.</div></div><a class="btn" href="#/">לבית</a>`, handlers: {} } : screenFor(r); } catch (e) { console.error(e); scr = { title: 'שגיאה', html: `<div class="banner bad">${icon('info')}<div>אירעה שגיאה בהצגת המסך: ${esc(e.message)}. הנתונים שלכם לא נפגעו.</div></div><a class="btn" href="#/">לבית</a>`, handlers: {} }; }
  const sec = SECTION[r.name] || 'home';
  const back = scr.back ? `<a class="icon-btn" href="${scr.back}" aria-label="חזרה">${icon('back')}</a>` : BRAND_MARK;
  /* M10: on Home the logo is the header — the redundant visible "בית" is dropped; the h1 stays (layout + screen readers) */
  const topEl = document.getElementById('top'), navEl = document.getElementById('nav'); /* M10: header/nav are rewritten only when they change (no logo flash on every tap) */
  const topHtml = `<div class="top-in">${back}<h1>${r.name === 'home' ? `<span class="sr-only">${esc(scr.title)}</span>` : esc(scr.title)}</h1><a class="icon-btn" href="#/settings" aria-label="הגדרות" ${sec === 'settings' ? 'aria-current="page"' : ''}>${icon('gear')}</a></div>`;
  if (topEl.__html !== topHtml) { topEl.innerHTML = topHtml; topEl.__html = topHtml; }
  const navHtml = `<div class="nav-in" role="navigation" aria-label="ניווט ראשי">${NAV.map(n => `<a href="${n.h}" data-nav="${n.k}" ${n.k === sec ? 'aria-current="page"' : ''}>${icon(n.i)}<span>${esc(tr('nav.' + n.k))}</span></a>`).join('')}</div>`;
  if (navEl.__html !== navHtml) { navEl.innerHTML = navHtml; navEl.__html = navHtml; }
  const v = document.getElementById('view'); const keepScroll = lastName === location.hash; const y = window.scrollY;
  v.dataset.screen = r.name; v.innerHTML = scr.html;
  root.UI.bind(v, scr.handlers || {});
  v.querySelectorAll('[data-fig]').forEach(b => App.mountFig(b));
  if (scr.after) scr.after(v);
  /* Stage D: long settings-type screens get a section index (chips that jump to each card heading) */
  if (['profile', 'settings'].includes(r.name)) { const hs = [...v.querySelectorAll('section.card')].map(sc => sc.querySelector(':scope > h2, :scope > h3, :scope > .card-h > h2, :scope > .card-h > h3')).filter(Boolean); if (hs.length >= 5) {
    const nav = document.createElement('nav'); nav.className = 'chips sec-index'; nav.setAttribute('aria-label', 'קפיצה לסעיף'); nav.dataset.secIndex = '';
    hs.forEach((h, i) => { const sec = h.closest('section'); sec.id = sec.id || 'sec-' + i; /* M10.4: no fixed 70px — html scroll-padding-top follows the measured sticky stack (see stickyH) */ const a = document.createElement('a'); a.className = 'chip'; a.href = '#' + location.hash.slice(1); a.textContent = h.textContent.trim().slice(0, 28);
      a.addEventListener('click', ev => { ev.preventDefault(); sec.scrollIntoView({ behavior: document.documentElement.dataset.motion === 'reduce' ? 'auto' : 'smooth', block: 'start' }); const f = h; if (f) { f.tabIndex = -1; f.focus({ preventScroll: true }); } }); nav.appendChild(a); });
    v.insertBefore(nav, v.firstChild); } }
  if (root.CMS && root.CMS.post) { try { root.CMS.post(r.name); } catch (e) { console.error(e); } } /* Admin CMS: layout, module switches, notice, texts */
  App.rendered = true; updOffline(); App.stickyH();
  document.title = scr.title + ' · ' + (root.FIT30_BRAND || 'כושר 30');
  if (keepScroll) window.scrollTo(0, y); else window.scrollTo(0, 0);
  lastName = location.hash;
};

/* M8 · offline state. Shown only when the browser reports no connection; the app itself keeps working from its stored copy.
   Toggled in place (no re-render), so typing in a field is never interrupted. */
function updOffline() {
  const v = document.getElementById('view'); if (!v) return; const off = ENV !== 'artifact' && navigator.onLine === false, cur = v.querySelector(':scope > [data-offline]');
  if (off && !cur) v.insertAdjacentHTML('afterbegin', `<div class="offline-bar" role="status" data-offline>${icon('info')}<span>אין חיבור לאינטרנט. האימונים, התפריט והיומן ממשיכים לעבוד; סרטוני ההדרכה זמינים רק עם חיבור.</span></div>`);
  else if (!off && cur) cur.remove();
}
/* ── export helpers ── */
/* Android test app (native/android-webview): a WebView cannot save blob downloads, so files go through the app's bridge into
   Downloads. Returns null when not in that app (the browser path is used), else { ok, where | error }. */
App.nativeSave = (name, text, mime) => { const N = root.SoFitGoAndroid; if (!N || !N.saveFile) return null; try { const r = String(N.saveFile(name, mime || 'text/plain', text)); return r.startsWith('ok:') ? { ok: true, where: r.slice(3) } : { ok: false, error: r.replace(/^error:/, '') }; } catch (e) { return { ok: false, error: e.message || String(e) }; } };
function fileOut(name, text, mime, title, onDone, note) {
  const canShare = (() => { try { return navigator.canShare && navigator.canShare({ files: [new File([text], name, { type: mime })] }); } catch (e) { return false; } })();
  root.UI.sheet(title, `${note ? `<div class="banner info small"><div>${note}</div></div>` : ''}
    <p class="small muted">${ENV === 'artifact' && !(App.dl && /\.json$/.test(name)) ? 'בגרסה שפתוחה בתוך Claude אי אפשר לשמור את סוג הקובץ הזה — השתמשו ב"העתקה" ושמרו את הטקסט (למשל בפתקים), או השתמשו בגרסת ה־PWA.' : 'שמרו את הקובץ במקום בטוח (למשל אפליקציית "קבצים" או iCloud Drive).'}</p>
    <div class="btns">${ENV !== 'artifact' || (App.dl && /\.json$/.test(name)) ? `<button class="btn primary" data-act="dl">${icon('share')} שמירת קובץ</button>` : ''}${canShare ? `<button class="btn" data-act="sh">שיתוף</button>` : ''}<button class="btn" data-act="cp">העתקה</button></div>
    <label class="field">תוכן (${Math.round(text.length / 1024)} KB)<textarea id="fo-t" readonly style="min-height:140px;direction:ltr;font-size:12px">${esc(text)}</textarea></label>`,
    { dl: (el, e, close) => { const nv = App.nativeSave(name, text, mime); if (nv) { if (nv.ok) { onDone && onDone(); root.UI.toast('נשמר ב־' + nv.where); } else root.UI.toast('השמירה נכשלה: ' + nv.error + ' — השתמשו ב"העתקה"'); return; } if (ENV === 'artifact') { App.dl.save({ filename: name, data: text }).then(() => { onDone && onDone(); root.UI.toast('הקובץ נשמר'); }).catch(er => root.UI.toast(er && er.code === 'declined' ? 'השמירה בוטלה' : 'השמירה לא זמינה כאן — השתמשו ב"העתקה"')); return; } try { const b = new Blob([text], { type: mime }); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); onDone && onDone(); root.UI.toast('הקובץ נוצר: ' + name); } catch (er) { root.UI.toast('השמירה נכשלה — נסו "העתקה"'); } },
      sh: () => { navigator.share({ files: [new File([text], name, { type: mime })], title: name }).then(() => { onDone && onDone(); }).catch(() => {}); },
      cp: (el, e, close, b) => { const ta = b.querySelector('#fo-t'); const fallback = () => { ta.focus(); ta.select(); root.UI.toast('הטקסט מסומן — העתיקו ידנית'); };
        try { navigator.clipboard.writeText(text).then(() => { onDone && onDone(); root.UI.toast('הועתק'); }, fallback); } catch (er) { fallback(); } } });
}
App.exportBackup = function () {
  const data = S.exportAll(); const txt = JSON.stringify(data);
  const done = () => { const m = S.load('meta'); m.lastBackup = new Date().toISOString(); S.save('meta'); };
  const inc = 'הגיבוי כולל: פרופיל והגדרות, העדפות, רישומי אימונים ומבחני כושר, תפריט מותאם, יומן אכילה, מים, צעדים, שינה ומדידות.';
  S.photoAll().then(ps => fileOut('fit30-backup-' + S.today() + '.json', txt, 'application/json', 'ייצוא גיבוי', done, inc + (ps.length ? ` <b>תמונות ההתקדמות (${ps.length}) לא נכללות בגיבוי</b> — הן נשארות רק במכשיר הזה.` : ' תמונות ההתקדמות לא נכללות בגיבוי (נשארות רק במכשיר).')))
    .catch(() => fileOut('fit30-backup-' + S.today() + '.json', txt, 'application/json', 'ייצוא גיבוי', done, inc + ' תמונות ההתקדמות לא נכללות בגיבוי (נשארות רק במכשיר).'));
};
App.importBackup = function () {
  root.UI.sheet('שחזור מגיבוי', `<p class="small muted">השחזור מחליף את כל הנתונים הנוכחיים במכשיר בנתוני הגיבוי.</p><label class="btn">${icon('plus')} בחירת קובץ גיבוי<input type="file" accept="application/json,.json,text/plain" id="im-f" hidden></label><label class="field">או הדביקו את תוכן הגיבוי<textarea id="im-t" style="direction:ltr;font-size:12px" placeholder='{"app":"fit30",...}'></textarea></label><p id="im-msg" class="small"></p><button class="btn primary" data-act="go">שחזור</button>`,
    { go: (el, e, close, b) => { let o; try { o = JSON.parse(b.querySelector('#im-t').value); } catch (er) { b.querySelector('#im-msg').textContent = 'הטקסט אינו JSON תקין.'; return; }
        const err = S.validateBackup(o); if (err) { b.querySelector('#im-msg').textContent = err; return; }
        close(); root.UI.confirmSheet('לאשר שחזור?', `גיבוי מתאריך ${o.exportedAt ? o.exportedAt.slice(0, 10) : 'לא ידוע'} יחליף את הנתונים הנוכחיים.`, 'שחזור', () => { try { S.importAll(o); App.applyDisplay(); root.UI.toast('השחזור הושלם'); location.hash = '#/'; App.render(); } catch (er) { root.UI.toast(er.message); } }, true); } });
  const f = document.getElementById('im-f'); f.addEventListener('change', () => { const file = f.files[0]; if (!file) return; const rd = new FileReader(); rd.onload = () => { document.getElementById('im-t').value = rd.result; document.getElementById('im-msg').textContent = 'הקובץ נטען. לחצו "שחזור".'; }; rd.readAsText(file); });
};
App.fileOut = fileOut; /* M11.4: used by the on-demand sync tools */
App.exportICS = function (time, alarm) {
  const [hh, mm] = time.split(':').map(Number); const pad = n => String(n).padStart(2, '0');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//fit30//HE', 'CALSCALE:GREGORIAN'];
  const L = root.Logic;
  P.DAYS.forEach(d => {
    const date = C.dateOfDay(d.day).replace(/-/g, ''); const mins = d.main.length ? L.estimateMinutes(d, 'std') : 15;
    const st = new Date(+date.slice(0, 4), +date.slice(4, 6) - 1, +date.slice(6, 8), hh, mm); const en = new Date(st.getTime() + mins * 60000);
    const f = x => x.getFullYear() + pad(x.getMonth() + 1) + pad(x.getDate()) + 'T' + pad(x.getHours()) + pad(x.getMinutes()) + '00';
    lines.push('BEGIN:VEVENT', 'UID:fit30-day' + d.day + '-' + date + '@local', 'DTSTAMP:' + f(new Date()), 'DTSTART:' + f(st), 'DTEND:' + f(en),
      'SUMMARY:' + (`יום ${d.day}: ${d.title}`).replace(/[,;]/g, ' '), 'DESCRIPTION:' + (d.goal + (d.main.length ? ' · ~' + mins + ' דק׳' : '')).replace(/[,;\n]/g, ' '));
    if (alarm > 0) lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:אימון', 'TRIGGER:-PT' + alarm + 'M', 'END:VALARM');
    lines.push('END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  fileOut('fit30-schedule.ics', lines.join('\r\n'), 'text/calendar', 'קובץ יומן ל־30 הימים');
};

/* ── boot ── */
/* M10: Supabase e-mail links (sign-up confirmation, password reset) return with #access_token=…&type=… or #error=… in the URL.
   Capture it before the router sees it, keep it only for this tab, and remove the tokens from the address bar/history. */
function captureAuthRedirect() {
  const h = location.hash || ''; if (!/^#(access_token|error|error_code)=/.test(h) && !/[#&](access_token|error_description)=/.test(h)) return false;
  try { sessionStorage.setItem('fit30.authRedirect', h.slice(1)); } catch (e) { }
  try { history.replaceState(null, '', location.pathname + location.search + '#/account'); } catch (e) { location.hash = '#/account'; }
  return true;
}
function boot() {
  const fromAuthLink = captureAuthRedirect();
  const I = root.I18N; document.documentElement.setAttribute('dir', I ? I.dir() : 'rtl'); document.documentElement.setAttribute('lang', I ? I.lang : 'he'); if (I && I.lang !== 'he') document.body.style.direction = 'ltr'; /* RC5: i18n dev preview */
  App.applyDisplay();
  window.addEventListener('hashchange', () => { root.UI.closeAllSheets(); if (root.FIT30_BACKEND && captureAuthRedirect()) { App.loadChunk('account.js').then(() => root.Account.handleRedirect(), () => { }); return; } App.render(); });
  window.addEventListener('online', updOffline); window.addEventListener('offline', updOffline);
  /* M8 · keyboard: hide the bottom nav while a text field has focus (see styles.css body.kb); delayed restore on blur */
  const isText = el => el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !/^(checkbox|radio|range|button|submit|file|color)$/.test(el.type)));
  let kbT = null;
  document.addEventListener('focusin', e => { if (isText(e.target)) { clearTimeout(kbT); document.body.classList.add('kb'); const el = e.target; setTimeout(() => { if (document.activeElement !== el) return; const vv = window.visualViewport, h = vv ? vv.height : window.innerHeight, r = el.getBoundingClientRect(); if (r.bottom > h - 16 || r.top < App.stickyH() + 8) el.scrollIntoView({ block: 'center' }); }, 320); } }); /* M10: keep the focused field visible above the keyboard */
  document.addEventListener('focusout', e => { if (isText(e.target)) { clearTimeout(kbT); kbT = setTimeout(() => { if (!isText(document.activeElement)) document.body.classList.remove('kb'); App.stickyH(); }, 400); } });
  /* Admin CMS: with published content cached on this device, wait (≤ 1.5 s) for the loader chunk so the first screen already shows
     it — no flash of built-in texts, layout or colours. Without a cache nothing waits; with a backend the chunk loads after paint. */
  let cmsCached = false; try { cmsCached = !!localStorage.getItem('fit30.cms'); } catch (e) { }
  if (cmsCached) Promise.race([App.loadChunk('cms.js'), new Promise(r => setTimeout(r, 1500))]).then(() => start(), () => start()); else { start(); if (root.FIT30_BACKEND) setTimeout(() => { App.loadChunk('cms.js').catch(() => { }); }, 0); }
  function start() {
  App.render();
  /* M10: with accounts configured, resume the session (refresh token, pull/push) in the background after first paint */
  if (root.FIT30_BACKEND) setTimeout(() => App.loadChunk('account.js').then(() => { if (['home', 'settings'].includes(route().name) || fromAuthLink) App.render(); }, () => { }), 0);
  const ss = S.load('session'); if (ss && !ss.parked) root.Run.open(); // app closed mid-workout → reopen where it stopped
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().then(ok => { const m = S.load('meta'); m.persisted = ok; S.save('meta'); }); } catch (e) { }
  if (ENV === 'artifact' && window.claude && window.claude.use) { window.claude.use('downloads').then(d => { App.dl = d; }).catch(() => {}); }
  if ((root.Capacitor && root.Capacitor.isNativePlatform && root.Capacitor.isNativePlatform()) || root.SoFitGoAndroid) { App.swState = 'native'; return; } /* RC5: native app — files are bundled in the app, no service worker */
  if (ENV === 'artifact' || !('serviceWorker' in navigator) || location.protocol === 'file:') { App.swState = 'unsupported'; return; }
  App.swState = 'pending';
  navigator.serviceWorker.register('sw.js').then(reg => { App.swState = reg.active ? 'active' : 'pending'; navigator.serviceWorker.ready.then(() => { App.swState = 'active'; }); }).catch(() => { App.swState = 'unsupported'; });
  // a page that was opened before an update keeps running its own (complete) version; offer a reload instead of mixing versions
  let hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController) root.UI.toast('גרסה חדשה של האפליקציה הותקנה — סגרו ופתחו מחדש כדי לעבור אליה.', 6000); hadController = true; });
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
/* F-8 (RC5): a specific, visible error when a save fails. Store already rolled the data back, so re-rendering shows what is really stored. */
const SAVE_HE = { auth: 'פרטי ההתחברות', avatar: 'תמונת הפרופיל', profile: 'הפרופיל וההגדרות', workouts: 'רישום האימונים', nutrition: 'יומן התזונה והתפריט', tracking: 'נתוני המעקב (משקל, מים, צעדים)', plans: 'התוכנית', session: 'האימון שבתהליך' };
root.addEventListener('fit30:savefail', ev => { const n = ev.detail && ev.detail.name; setTimeout(() => { try { App.render(); } catch (e) { } root.UI.toast(`השמירה נכשלה — השינוי ב${SAVE_HE[n] || 'נתונים'} לא נשמר. ייתכן שהאחסון במכשיר מלא. הנתונים שכבר נשמרו לא נפגעו.`, 8000); document.body.dataset.saveFail = n || '1'; }, 0); });
/* RC5: on-device layout diagnostics, only with ?debug=layout (separate file; never loaded otherwise) */
if (/[?&]debug=layout\b/.test(location.search) && root.FIT30_ENV === 'pwa') { const d = document.createElement('script'); d.src = 'debug-layout.js'; document.head.appendChild(d); }
})(window);
