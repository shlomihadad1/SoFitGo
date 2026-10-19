/* M10 · #/account (sign up, sign in, reset, account & sync status, device-data migration, conflicts, sign out, delete) and
   #/legal (privacy notice + beta terms — DRAFTS, marked as such). Part of the account.js chunk. */
(function (root) {
const { esc, icon } = root.UI; const S = root.Store; const Screens = root.Screens; const A = () => root.Account;
const ui = { tab: 'login', busy: false, err: '', info: '', email: '' };
const SEC_HE = { profile: 'פרופיל והגדרות', workouts: 'אימונים', nutrition: 'תזונה', tracking: 'מעקב (משקל, מים, צעדים)', plans: 'תוכנית האימונים' };
const ST_HE = { idle: 'מחובר', synced: 'מסונכרן', pending: 'יש שינויים שממתינים לסנכרון', syncing: 'מסנכרן…', offline: 'אין חיבור — יסונכרן כשהחיבור יחזור', error: 'הסנכרון נכשל', conflict: 'יש התנגשות שדורשת החלטה', expired: 'החיבור לחשבון פג — התחברו שוב', foreign: 'במכשיר יש נתונים של חשבון אחר', paused: 'הבטא מושהית — הסנכרון עוצר' };
const ago = t => { if (!t) return ''; const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'עכשיו' : m < 60 ? `לפני ${m} דק׳` : `לפני ${Math.round(m / 60)} שע׳`; };
const field = (id, label, type, extra) => `<label class="field">${label}<input id="${id}" type="${type}" ${extra || ''}></label>`;
const pwToggle = () => `<button type="button" class="btn sm ghost" data-act="pwShow" aria-pressed="false" aria-label="הצגת הסיסמה">הצגת הסיסמה</button>`;
/* M10 · after sign-up / sign-in: no profile yet → onboarding (setup step 1); profile complete → the main screen */
const nextScreen = () => { const C = root.Core; return C && C.hasBasics(C.profile()) ? '#/' : '#/setup/1'; };
const errBox = () => ui.err ? `<p class="banner bad small" role="alert" data-acct-error>${icon('info')}<span>${esc(ui.err)}</span></p>` : '';
const infoBox = () => ui.info ? `<p class="banner info small" role="status" data-acct-info>${icon('info')}<span>${esc(ui.info)}</span></p>` : '';
async function run(fn) { if (ui.busy) return; ui.busy = true; ui.err = ''; ui.info = ''; root.App.render(); try { await fn(); } catch (e) { ui.err = e.he || A().message(e); } finally { ui.busy = false; root.App.render(); } }
const val = id => (document.getElementById(id) || {}).value || '';

function signedOutHtml(st) {
  const t = ui.tab, b = ui.busy ? 'disabled aria-busy="true"' : '';
  const tabs = `<div class="seg" role="group" aria-label="חשבון">${[['login', 'התחברות'], ['signup', 'הרשמה'], ['forgot', 'שכחתי סיסמה']].map(([k, l]) => `<button data-act="tab" data-t="${k}" aria-pressed="${t === k}">${l}</button>`).join('')}</div>`;
  let form = '';
  if (t === 'signup') form = `<form class="stack" data-form="signup" novalidate>${field('ac-name', 'שם פרטי (רשות — לברכה בבית)', 'text', 'maxlength="30" autocomplete="given-name"')}${field('ac-email', 'אימייל', 'email', `autocomplete="email" inputmode="email" dir="ltr" value="${esc(ui.email)}" required`)}${field('ac-pw', 'סיסמה (לפחות 8 תווים)', 'password', 'autocomplete="new-password" minlength="8" dir="ltr" required')}${field('ac-pw2', 'אימות סיסמה', 'password', 'autocomplete="new-password" minlength="8" dir="ltr" required')}${pwToggle()}
      <label class="toggle small"><input type="checkbox" id="ac-ok"> <span>קראתי את <a href="#/legal">הודעת הפרטיות ותנאי הבטא</a> ואני מסכים/ה להם</span></label>
      <button type="submit" class="btn primary" data-act="signup" ${b}>${ui.busy ? 'יוצר חשבון…' : 'יצירת חשבון'}</button></form>`;
  else if (t === 'forgot') form = `<form class="stack" data-form="forgot" novalidate><p class="small muted">נשלח קישור לאיפוס הסיסמה. הקישור מחזיר לאפליקציה, ושם בוחרים סיסמה חדשה.</p>${field('ac-email', 'אימייל', 'email', `autocomplete="email" inputmode="email" dir="ltr" value="${esc(ui.email)}"`)}<button type="submit" class="btn primary" data-act="forgot" ${b}>${ui.busy ? 'שולח…' : 'שליחת קישור'}</button></form>`;
  else form = `<form class="stack" data-form="login" novalidate>${field('ac-email', 'אימייל', 'email', `autocomplete="email" inputmode="email" dir="ltr" value="${esc(ui.email || st.email || '')}"`)}${field('ac-pw', 'סיסמה', 'password', 'autocomplete="current-password" dir="ltr"')}${pwToggle()}
      <button type="submit" class="btn primary" data-act="login" ${b}>${ui.busy ? 'מתחבר…' : 'התחברות'}</button>${ui.needConfirm ? `<button type="button" class="btn ghost sm" data-act="resend" ${b}>שליחה חוזרת של מייל האישור</button>` : ''}</form>`;
  return `<section class="card" data-acct="signed-out"><h2>חשבון SoFitGo${st.channel === 'beta' ? ' <span class="pill acc">בטא</span>' : ''}</h2>
    <p class="small muted">עם חשבון, הנתונים נשמרים גם בשרת ואפשר לחזור אליהם אחרי יציאה, החלפת מכשיר או מחיקת הדפדפן. בלי חשבון — הכול נשאר רק במכשיר הזה.</p>
    ${st.status === 'expired' ? `<p class="banner warn small" data-acct-expired>${icon('info')}<span>החיבור לחשבון ${esc(st.email || '')} פג. הנתונים במכשיר נשמרו; התחברו שוב כדי להמשיך לסנכרן.</span></p>` : ''}
    ${st.config && st.config.beta_open === false ? `<p class="banner warn small" data-acct-paused>${icon('info')}<span>הבטא מושהית כרגע. אפשר להמשיך להשתמש באפליקציה במכשיר.</span></p>` : ''}
    ${tabs}${errBox()}${infoBox()}${form}</section>`;
}
function signedInHtml(st) {
  const h = [];
  h.push(`<section class="card" data-acct="signed-in"><div class="card-h"><h2>החשבון שלי</h2>${st.channel === 'beta' ? '<span class="pill acc">בטא</span>' : ''}</div>
    <p class="small"><span class="muted">מחובר/ת כ:</span> <b dir="ltr">${esc(st.email || '')}</b></p>
    <p class="small" data-sync-status="${st.status}"><span class="muted">סנכרון:</span> <b>${esc(ST_HE[st.status] || st.status)}</b>${st.status === 'synced' && st.lastSyncAt ? ` · ${ago(st.lastSyncAt)}` : ''}${st.unsynced.length && st.status !== 'synced' ? ` · ממתינים: ${st.unsynced.map(s => SEC_HE[s]).join(', ')}` : ''}</p>
    ${st.lastError && ['error', 'offline'].includes(st.status) ? `<p class="tiny warn">${esc(st.lastError)}</p>` : ''}
    <div class="btns"><button class="btn" data-act="syncNow" ${ui.busy ? 'disabled' : ''}>${icon('share')} סנכרון עכשיו</button></div>
    <p class="tiny muted">נשמרים בחשבון: פרופיל והעדפות, תוכנית ואימונים, תפריט ויומן אכילה, מדידות ומעקב יומי. <b>לא נשמרים בחשבון:</b> תמונת הפרופיל ותמונות ההתקדמות — הן נשארות רק במכשיר הזה.</p></section>`);
  if (st.migration && st.migration.state !== 'done') h.push(migrationHtml(st));
  if (st.conflict) h.push(`<section class="card" data-acct-conflict><h3>${icon('info')} יש גרסה אחרת בחשבון</h3><p class="small">מכשיר אחר שמר שינויים ב: <b>${st.conflict.sections.map(s => SEC_HE[s]).join(', ')}</b>, בזמן שגם כאן היו שינויים שלא סונכרנו. כלום לא נדרס — בחרו מה לשמור:</p>
    <div class="btns"><button class="btn" data-act="cAccount">להשתמש בגרסה שבחשבון</button><button class="btn" data-act="cDevice">לשמור את הגרסה מהמכשיר הזה</button></div><p class="tiny muted">הגרסה שלא נבחרה נשמרת במכשיר כגיבוי, ואפשר לשחזר אותה מכאן.</p></section>`);
  if (st.status === 'foreign') h.push(`<section class="card" data-acct-foreign><h3>במכשיר יש נתונים של חשבון אחר</h3><p class="small">כדי לא לערבב בין חשבונות, הנתונים האלה לא ישויכו לחשבון שלך. אם הם כבר סונכרנו לחשבון ההוא, אפשר למחוק אותם מהמכשיר ולהמשיך. אם לא — התחברו קודם לחשבון ההוא כדי לסנכרן אותם.</p><div class="btns"><button class="btn danger" data-act="wipeForeign">מחיקת הנתונים מהמכשיר והמשך</button></div></section>`);
  if (st.backup) h.push(`<section class="card" data-acct-backup><h3>גיבוי מקומי</h3><p class="small muted">נשמר ${esc(new Date(st.backup.at).toLocaleString('he-IL'))} לפני ${st.backup.kind.includes('conflict') ? 'פתרון התנגשות' : 'חיבור הנתונים לחשבון'}.</p><button class="btn sm" data-act="restore">שחזור הגיבוי למכשיר (וסנכרון לחשבון)</button></section>`);
  h.push(`<section class="card"><h3>יציאה ומחיקה</h3><div class="btns"><button class="btn" data-act="logout" ${ui.busy ? 'disabled' : ''}>יציאה מהחשבון</button></div>
    <p class="tiny muted">ביציאה, כל נתוני האפליקציה נמחקים מהמכשיר הזה (כדי שמי שיתחבר אחריך לא יראה אותם) — כולל תמונות ההתקדמות ותמונת הפרופיל, שלא נשמרות בחשבון. הנתונים בחשבון נשארים.</p>
    <div class="divider"></div><button class="btn danger" data-act="delete" ${ui.busy ? 'disabled' : ''}>מחיקת החשבון לצמיתות</button>
    <p class="tiny muted">מוחק את החשבון, את כל הנתונים שבו ואת דיווחי הבאגים שלך מהשרת, וגם את הנתונים במכשיר. אי אפשר לבטל.</p></section>`);
  if (ui.recovery) h.unshift(`<section class="card" data-acct-recovery><h3>בחירת סיסמה חדשה</h3>${errBox()}${field('ac-newpw', 'סיסמה חדשה (לפחות 8 תווים)', 'password', 'autocomplete="new-password" minlength="8" dir="ltr"')}<button class="btn primary" data-act="setpw" ${ui.busy ? 'disabled' : ''}>שמירת הסיסמה</button></section>`);
  return (ui.recovery ? '' : errBox()) + infoBox() + h.join('');
}
function migrationHtml(st) {
  const m = st.migration, has = m.remoteHas;
  return `<section class="card" data-acct-migration="${m.state}"><h3>${icon('info')} יש במכשיר נתונים שעוד לא שייכים לחשבון</h3>
    ${m.state === 'failed' ? `<p class="banner warn small">${icon('info')}<span>השיוך לא הושלם (אין חיבור או שגיאת שרת). שום דבר לא נמחק. אפשר לנסות שוב.</span></p>` : ''}
    <p class="small">${has ? `גם בחשבון ${esc(st.email || '')} כבר יש נתונים (${(m.remoteSections || []).map(s => SEC_HE[s]).join(', ')}). איזו גרסה לשמור?` : `החשבון ${esc(st.email || '')} עוד ריק. לשייך אליו את הנתונים שכבר הזנת במכשיר הזה?`}</p>
    <div class="stack tight">${has ? `<button class="btn primary" data-act="mig" data-c="use-account">להשתמש בנתונים מהחשבון</button><button class="btn" data-act="mig" data-c="replace-account">להחליף את נתוני החשבון בנתונים מהמכשיר</button>`
      : `<button class="btn primary" data-act="mig" data-c="upload">שיוך הנתונים לחשבון</button><button class="btn" data-act="mig" data-c="fresh">להתחיל חשבון נקי</button>`}</div>
    <p class="tiny muted">לפני כל שינוי נשמר במכשיר גיבוי של הנתונים הנוכחיים, ואפשר לשחזר אותו מהמסך הזה. נתונים לא ישויכו לחשבון בלי בחירה שלך.</p></section>`;
}

/* account entry points on Home and in Settings (only when this build has a backend configured) */
const peek = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
Screens.accountCard = function () {
  if (!root.FIT30_BACKEND) return Screens.accountCardOff();
  const a = peek('fit30.auth'), s = peek('fit30.sync') || {}, line = a ? `מחובר/ת כ־<b dir="ltr">${esc(a.user && a.user.email || '')}</b>` : s.owner ? '<span class="warn">החיבור לחשבון פג — התחברו שוב</span>' : 'לא מחובר/ת — הנתונים נשמרים רק במכשיר';
  return `<section class="card" data-account-card><div class="card-h"><h2>חשבון וסנכרון</h2>${root.FIT30_BACKEND.channel === 'beta' ? '<span class="pill acc">בטא</span>' : ''}</div><p class="small">${line}</p><a class="btn" href="#/account">${a ? 'פרטי החשבון והסנכרון' : 'הרשמה / התחברות'}</a><p class="tiny muted">גרסה <span dir="ltr">${esc(root.FIT30_BUILD || '')}</span></p></section>`;
};
Screens.accountPrompt = function () {
  if (!root.FIT30_BACKEND || peek('fit30.acctCardHidden')) return '';
  const a = peek('fit30.auth'), s = peek('fit30.sync') || {};
  if (a || (Screens.welcomeVisible && Screens.welcomeVisible())) return '';
  if (s.owner) return `<div class="banner warn small" data-account-expired>${icon('info')}<div class="grow">החיבור לחשבון פג. הנתונים במכשיר שמורים. <a href="#/account/login">התחברות מחדש</a></div></div>`;
  return `<section class="card" data-account-prompt><div class="card-h"><h3>שמירה בחשבון</h3>${root.FIT30_BACKEND.channel === 'beta' ? '<span class="pill acc">בטא</span>' : ''}</div><p class="small muted">צרו חשבון כדי שהנתונים יישמרו גם בשרת ויחזרו אליכם בכל מכשיר. אפשר גם להמשיך בלי חשבון — הכול יישאר במכשיר הזה.</p>
    <div class="btns"><a class="btn primary" href="#/account/signup">הרשמה</a><a class="btn" href="#/account/login">התחברות</a><button class="btn ghost sm" data-act="hideAcct">לא עכשיו</button></div></section>`;
};
Screens.account = function (arg) {
  const Ac = A(); if (!Ac) return { title: 'חשבון וסנכרון', back: '#/settings', html: '<section class="card"><p class="small muted">טוען…</p></section>', handlers: {} };
  const st = Ac.state();
  if (arg && ['login', 'signup', 'forgot'].includes(arg)) ui.tab = arg;
  const red = Ac.lastRedirect; if (red) { Ac.lastRedirect = null; if (red.error) ui.err = red.error; if (red.recovery) ui.recovery = true; if (red.signedIn) ui.info = 'האימייל אושר וההתחברות הצליחה.'; }
  let html;
  if (!st.available) html = `<section class="card" data-acct="unavailable"><h2>${arg === 'login' ? 'התחברות' : arg === 'signup' ? 'הרשמה' : 'הרשמה והתחברות'}</h2>
    <div class="banner warn small" role="status">${icon('info')}<div><b>חשבונות הענן עוד לא הופעלו בגרסת הבטא הזו.</b> לא נוצר חשבון ולא נשלח מייל. ההרשמה וההתחברות ייפתחו כאן כשהשרת יופעל.</div></div>
    <p class="small">בינתיים אפשר להשתמש בכל האפליקציה. הנתונים נשמרים במכשיר הזה, וכשהחשבונות יופעלו אפשר יהיה לשייך אותם לחשבון בלי לאבד דבר. לגיבוי: <a href="#/settings">הגדרות ← ייצוא גיבוי</a>.</p>
    <div class="btns"><button class="btn primary" data-act="noAcct">להמשיך בלי חשבון</button><a class="btn" href="#/setup/1">הגדרת פרופיל ותוכנית</a></div></section>`;
  else html = st.signedIn ? signedInHtml(st) : signedOutHtml(st);
  html += `<p class="tiny muted center"><a href="#/legal">הודעת פרטיות ותנאי הבטא (טיוטה)</a> · גרסה <span dir="ltr">${esc(root.FIT30_BUILD || '')}</span></p>`;
  return { title: 'חשבון וסנכרון', back: '#/settings', html, handlers: {
    noAcct: () => { try { localStorage.setItem('fit30.welcomeDone', '1'); } catch (e) { } location.hash = '#/'; },
    pwShow: el => { const on = el.getAttribute('aria-pressed') !== 'true'; ['ac-pw', 'ac-pw2'].forEach(id => { const i = document.getElementById(id); if (i) i.type = on ? 'text' : 'password'; }); el.setAttribute('aria-pressed', String(on)); el.setAttribute('aria-label', on ? 'הסתרת הסיסמה' : 'הצגת הסיסמה'); el.textContent = on ? 'הסתרת הסיסמה' : 'הצגת הסיסמה'; },
    tab: el => { ui.email = val('ac-email') || ui.email; ui.tab = el.dataset.t; ui.err = ''; ui.info = ''; root.App.render(); },
    login: (el, e) => { e && e.preventDefault(); const em = val('ac-email'), pw = val('ac-pw'); ui.email = em; run(async () => { ui.needConfirm = false; try { const r = await Ac.signIn(em, pw); ui.info = r.next === 'migration' ? '' : 'התחברת בהצלחה.'; if (r.next !== 'migration' && Ac.state().signedIn) { location.hash = nextScreen(); root.UI.toast(nextScreen() === '#/' ? 'התחברת בהצלחה' : 'התחברת. נמשיך להגדרת הפרופיל'); } } catch (er) { if (er.code === 'email_not_confirmed') ui.needConfirm = true; throw er; } }); },
    signup: (el, e) => { e && e.preventDefault(); const em = val('ac-email'), pw = val('ac-pw'), nm = val('ac-name'); ui.email = em;
      if (pw !== val('ac-pw2')) { ui.err = 'הסיסמאות לא תואמות. הקלידו את אותה סיסמה פעמיים.'; root.App.render(); return; }
      if (!document.getElementById('ac-ok').checked) { ui.err = 'כדי ליצור חשבון צריך לאשר את הודעת הפרטיות ותנאי הבטא.'; root.App.render(); return; }
      run(async () => { const r = await Ac.signUp(em, pw, nm); if (r.confirm) { ui.tab = 'login'; ui.info = 'נשלח אליך מייל לאישור הכתובת. אחרי לחיצה על הקישור תחזור/י לכאן מחובר/ת.'; } else { ui.info = 'החשבון נוצר והתחברת.'; if (Ac.state().signedIn && !(Ac.state().migration && Ac.state().migration.state === 'pending')) { location.hash = nextScreen(); root.UI.toast('החשבון נוצר. נמשיך להגדרת הפרופיל'); } } }); },
    forgot: (el, e) => { e && e.preventDefault(); const em = val('ac-email'); ui.email = em; run(async () => { await Ac.recover(em); ui.info = 'אם הכתובת רשומה, נשלח אליה קישור לאיפוס. בדקו גם בספאם.'; }); },
    resend: () => run(async () => { await Ac.resend(ui.email || val('ac-email')); ui.info = 'מייל האישור נשלח שוב.'; }),
    setpw: () => { const pw = val('ac-newpw'); run(async () => { await Ac.updatePassword(pw); ui.recovery = false; ui.info = 'הסיסמה עודכנה.'; }); },
    syncNow: () => run(async () => { const ok = await Ac.syncNow(); ui.info = ok ? 'הסנכרון הושלם.' : ''; if (!ok && !Ac.state().conflict) ui.err = Ac.state().lastError || 'הסנכרון לא הושלם.'; }),
    mig: el => { const c = el.dataset.c; const go = () => run(async () => { const ok = await Ac.migrate(c); if (ok) ui.info = c === 'use-account' ? 'הנתונים מהחשבון נטענו. הגרסה הקודמת מהמכשיר נשמרה כגיבוי.' : c === 'fresh' ? 'החשבון מתחיל נקי. הנתונים הקודמים מהמכשיר נשמרו כגיבוי.' : 'הנתונים שויכו לחשבון וסונכרנו.'; else ui.err = 'השיוך לא הושלם. שום דבר לא נמחק — אפשר לנסות שוב.'; });
      if (c === 'replace-account') root.UI.confirmSheet('להחליף את נתוני החשבון?', 'הנתונים שכבר בחשבון יוחלפו בנתונים מהמכשיר הזה. עותק של נתוני החשבון יישמר במכשיר כגיבוי.', 'להחליף', go, true); else go(); },
    cAccount: () => { Ac.resolveConflict('account'); ui.info = 'נטענה הגרסה מהחשבון. הגרסה מהמכשיר נשמרה כגיבוי.'; root.App.render(); },
    cDevice: () => { Ac.resolveConflict('device'); ui.info = 'הגרסה מהמכשיר נשלחת לחשבון.'; root.App.render(); },
    restore: () => root.UI.confirmSheet('שחזור הגיבוי', 'הנתונים במכשיר יוחלפו בגיבוי, ואז יסונכרנו לחשבון.', 'לשחזר', () => { if (Ac.restoreBackup()) { ui.info = 'הגיבוי שוחזר.'; } root.App.render(); }),
    wipeForeign: () => root.UI.confirmSheet('מחיקת הנתונים מהמכשיר', 'הנתונים של החשבון הקודם יימחקו מהמכשיר (מה שכבר סונכרן לחשבון ההוא נשאר שם). אחר כך תתחבר/י מחדש.', 'למחוק ולהמשיך', () => run(async () => { await Ac.signOut(true); ui.tab = 'login'; ui.info = 'המכשיר נוקה. התחברו שוב.'; }), true),
    logout: () => run(async () => { const photos = await Ac.photoCount(); const r = await Ac.signOut(false);
      if (r.unsynced) { root.UI.confirmSheet('יש שינויים שלא סונכרנו', `השינויים ב${r.unsynced.map(s => SEC_HE[s]).join(', ')} עוד לא נשמרו בחשבון (אין חיבור?). ביציאה עכשיו הם יאבדו. מומלץ לחזור כשיש חיבור.`, 'לצאת בכל זאת', () => run(async () => { await Ac.signOut(true); ui.tab = 'login'; ui.info = 'יצאת מהחשבון. המכשיר נוקה.'; }), true); return; }
      ui.tab = 'login'; ui.info = 'יצאת מהחשבון. הנתונים נמחקו מהמכשיר' + (photos ? ` (כולל ${photos} תמונות התקדמות)` : '') + ' ונשארו בחשבון.'; }),
    delete: () => root.UI.sheet('מחיקת החשבון', `<p class="small">החשבון, כל הנתונים שבו ודיווחי הבאגים שלך יימחקו מהשרת, וגם כל הנתונים במכשיר. <b>אי אפשר לבטל.</b></p><label class="field">כדי לאשר, הקלידו: מחיקה<input id="del-ok" type="text" autocomplete="off"></label><div class="btns"><button class="btn danger" data-act="yes">מחיקה לצמיתות</button><button class="btn ghost" data-act="no">ביטול</button></div>`,
      { yes: (el, e, close, b) => { if (b.querySelector('#del-ok').value.trim() !== 'מחיקה') { root.UI.toast('הקלידו "מחיקה" כדי לאשר'); return; } close(); run(async () => { await Ac.deleteAccount(); ui.tab = 'signup'; ui.info = 'החשבון נמחק.'; }); }, no: (el, e, close) => close() }) },
    after: v => { v.querySelectorAll('form[data-form]').forEach(f => f.addEventListener('submit', e => e.preventDefault())); } }; /* primary buttons are type=submit (keyboard "Go" works); their handlers preventDefault */
};

/* ── beta reports to the server (signed in) ── */
const rf = { category: 'bug', severity: 'medium', title: '', description: '', steps: '', expected: '', actual: '', screen: '', tech: true, busy: false, err: '', done: null, cid: null, list: null, listErr: '' };
const CAT_HE = { bug: 'באג', usability: 'בעיית שימוש', idea: 'הצעה', other: 'אחר' }, SEV_HE = { low: 'נמוכה', medium: 'בינונית', high: 'גבוהה', critical: 'קריטית' };
const RST_HE = { received: 'התקבל', reviewing: 'בבדיקה', in_progress: 'בטיפול', resolved: 'נפתר' };
Screens.feedbackOnline = function (techInfo) {
  const Ac = A(); if (rf.list === null) { rf.list = []; Ac.myReports().then(l => { rf.list = l; rf.listErr = ''; root.App.render(); }, e => { rf.listErr = Ac.message(e); root.App.render(); }); }
  const opt = (o, sel) => Object.entries(o).map(([k, l]) => `<option value="${k}" ${sel === k ? 'selected' : ''}>${l}</option>`).join('');
  const ta = (id, label, v, max) => `<label class="field">${label}<textarea id="${id}" rows="3" maxlength="${max}">${esc(v)}</textarea></label>`;
  return { title: 'דיווח לבטא', back: '#/settings', html: `
    ${rf.done ? `<p class="banner info small" role="status" data-fb-sent>${icon('check')}<span>הדיווח נשמר בשרת (מזהה <span dir="ltr">${esc(String(rf.done.id).slice(0, 8))}</span>). תודה!</span></p>` : ''}
    <section class="card" data-fb-online><p class="small muted">הדיווח נשמר בשרת הבטא ומשויך לחשבון שלך, כדי שנוכל לחזור אליך ולעדכן סטטוס. רק את/ה והצוות רואים אותו. אל תכתבו סיסמאות או מידע רפואי.</p>
      <div class="grid2"><label class="field">סוג<select id="rf-cat">${opt(CAT_HE, rf.category)}</select></label><label class="field">חומרה משוערת<select id="rf-sev">${opt(SEV_HE, rf.severity)}</select></label></div>
      <label class="field">כותרת קצרה<input id="rf-title" type="text" maxlength="120" value="${esc(rf.title)}" placeholder="למשל: כפתור השמירה לא מגיב"></label>
      ${ta('rf-desc', 'תיאור', rf.description, 4000)}${ta('rf-steps', 'צעדים לשחזור (אם ידוע)', rf.steps, 4000)}
      <div class="grid2">${ta('rf-exp', 'מה ציפית שיקרה', rf.expected, 2000)}${ta('rf-act', 'מה קרה בפועל', rf.actual, 2000)}</div>
      <label class="field">באיזה מסך? (רשות)<input id="rf-screen" type="text" maxlength="60" value="${esc(rf.screen)}"></label>
      <label class="row small"><input type="checkbox" id="rf-tech" ${rf.tech ? 'checked' : ''}> לצרף פרטים טכניים (גרסה, מכשיר, דפדפן, גודל מסך)</label>
      ${rf.err ? `<p class="banner bad small" role="alert" data-fb-error>${icon('info')}<span>${esc(rf.err)}</span></p>` : ''}
      <button class="btn primary" data-act="rfSend" ${rf.busy ? 'disabled aria-busy="true"' : ''}>${rf.busy ? 'שולח…' : 'שליחת הדיווח'}</button></section>
    <section class="card" data-my-reports><h3>הדיווחים שלי</h3>${rf.listErr ? `<p class="small warn">${esc(rf.listErr)}</p>` : rf.list.length ? `<div class="list">${rf.list.map(r => `<div class="li" data-report="${esc(r.id)}"><div class="grow"><div class="t">${esc(r.title)}</div><div class="s">${CAT_HE[r.category] || ''} · ${SEV_HE[r.severity] || ''} · ${esc(new Date(r.created_at).toLocaleDateString('he-IL'))}</div></div><span class="pill">${RST_HE[r.status] || esc(r.status)}</span></div>`).join('')}</div>` : '<p class="small muted">עוד לא שלחת דיווחים.</p>'}</section>`,
    handlers: { rfSend: () => {
      const g = id => (document.getElementById(id) || {}).value || '';
      Object.assign(rf, { category: g('rf-cat'), severity: g('rf-sev'), title: g('rf-title'), description: g('rf-desc'), steps: g('rf-steps'), expected: g('rf-exp'), actual: g('rf-act'), screen: g('rf-screen'), tech: document.getElementById('rf-tech').checked, done: null });
      if (rf.title.trim().length < 3) { rf.err = 'כתבו כותרת של 3 תווים לפחות.'; root.App.render(); return; }
      if (!rf.description.trim()) { rf.err = 'כתבו תיאור קצר של מה שקרה.'; root.App.render(); return; }
      if (rf.busy) return; rf.busy = true; rf.err = ''; rf.cid = rf.cid || ((crypto.randomUUID && crypto.randomUUID()) || 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10)); root.App.render();
      Ac.submitReport({ client_report_id: rf.cid, category: rf.category, severity: rf.severity, title: rf.title, description: rf.description, steps: rf.steps, expected: rf.expected, actual: rf.actual, screen: rf.screen, platform: rf.tech ? techInfo().replace(/\n/g, ' | ') : '' })
        .then(row => { rf.done = row; Object.assign(rf, { title: '', description: '', steps: '', expected: '', actual: '', screen: '', cid: null, list: null }); root.UI.toast('הדיווח נשמר'); }, e => { rf.err = Ac.message(e); /* same cid on retry → no duplicate */ })
        .finally(() => { rf.busy = false; root.App.render(); }); } } };
};

Screens.legal = function () {
  return { title: 'פרטיות ותנאי הבטא', back: '#/account', html: `
    <section class="card" data-legal><p class="banner warn small">${icon('info')}<span><b>טיוטה לבטא סגורה.</b> לא נבדקה משפטית. פרטי הגורם המפעיל ודרכי הפנייה יושלמו לפני הפצה רחבה.</span></p>
      <h2>הודעת פרטיות (טיוטה)</h2>
      <h4>מה נשמר בחשבון</h4><ul class="bul small"><li>אימייל וסיסמה — מנוהלים בשירות האימות של Supabase. האפליקציה לא רואה ולא שומרת את הסיסמה.</li><li>שם פרטי (רשות).</li><li>הנתונים שהזנת באפליקציה: פרופיל (גיל, גובה, משקל, מטרות, העדפות מזון והגבלות שבחרת לציין), תוכנית ורישומי אימונים, תפריט ויומן אכילה, מדידות, מים, שינה, צעדים שהוזנו.</li><li>דיווחי באגים ששלחת, כולל פרטים טכניים: גרסת האפליקציה, סוג מכשיר ודפדפן.</li></ul>
      <h4>מה לא נשמר בחשבון</h4><ul class="bul small"><li>תמונת הפרופיל ותמונות ההתקדמות — רק במכשיר.</li><li>אין מיקום, אין אנשי קשר, אין חיבור ל־Apple Health או לשעון.</li><li>אין שירות בינה מלאכותית; Sofit פועלת לפי כללים קבועים במכשיר.</li></ul>
      <h4>איפה ומי רואה</h4><ul class="bul small"><li>הנתונים נשמרים בפרויקט Supabase של מפעיל הבטא [להשלים: שם המפעיל ואזור האחסון].</li><li>כל משתמש יכול לקרוא ולשנות רק את הנתונים שלו (הרשאות ברמת מסד הנתונים).</li><li>למפעיל הבטא יש גישה ניהולית למסד הנתונים לצורך תפעול ותיקון תקלות.</li><li>הנתונים לא נמכרים ולא משמשים לפרסום.</li></ul>
      <h4>מחיקה</h4><p class="small">"מחיקת החשבון" במסך החשבון מוחקת את החשבון, את הנתונים ואת דיווחי הבאגים מהשרת, ואת הנתונים מהמכשיר. גיבויים אוטומטיים של ספק השירות, אם קיימים בתוכנית, נמחקים לפי מדיניות הספק [להשלים].</p>
      <h4>פנייה</h4><p class="small">[להשלים: כתובת לפניות בנושא פרטיות]</p></section>
    <section class="card"><h2>תנאי שימוש לבטא (טיוטה)</h2><ul class="bul small"><li>זו גרסת בטא לבדיקה. ייתכנו תקלות, שינויים במבנה הנתונים ואובדן נתונים — מומלץ לייצא גיבוי מדי פעם.</li><li>האפליקציה נותנת הכוונה כללית לכושר ולתזונה. היא אינה ייעוץ רפואי או תזונתי ואינה תחליף לאיש מקצוע. ערכי התזונה הם הערכות.</li><li>בכאב, סחרחורת, לחץ בחזה או קוצר נשימה — עוצרים את האימון ופונים לגורם רפואי.</li><li>הגישה לבטא ניתנת למוזמנים ויכולה להיות מושהית או מופסקת.</li><li>[להשלים: גיל מינימלי, הדין החל, פרטי המפעיל]</li></ul></section>`, handlers: {} };
};
})(window);
