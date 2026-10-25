/* Privacy Center (#/privacy, on-demand chunk extra.js). Every statement here is derived from what the code actually does in THIS
   build and on THIS device (store keys, account state, configured services) — nothing is claimed that the code does not do.
   What is available, what is not configured and what needs more infrastructure are shown separately. Export: JSON backup (existing)
   and CSV per category (export_csv.js), generated on the device; nothing is uploaded. */
(function (root) {
'use strict';
const { esc, icon } = root.UI; const S = root.Store, Screens = root.Screens;
const st = Screens._privacy = Screens._privacy || { busy: false, last: null, err: null };
const size = k => { try { const v = localStorage.getItem(k); return v ? v.length : 0; } catch (e) { return 0; } };
function facts() {
  const be = !!root.FIT30_BACKEND, A = root.Account && root.Account.state ? root.Account.state() : null, signed = !!(A && A.signedIn);
  const synced = signed ? ((root.Account && root.Account.SECTIONS) || ['profile', 'workouts', 'nutrition', 'tracking', 'plans']) : [];
  const where = k => synced.includes(k) ? 'במכשיר + עותק בשרת (Supabase) כי התחברת לחשבון' : 'במכשיר בלבד';
  const cats = [
    ['profile', 'fit30.profile', 'פרופיל: גיל, גובה, משקל, מין, מטרה, ניסיון, זמינות, ציוד, העדפות תזונה ויעדים', 'חישוב יעדי קלוריות וחלבון, בניית תוכנית ותפריט'],
    ['workouts', 'fit30.workouts', 'אימונים שבוצעו, סטים, דירוג קושי, הערות, החלפות תרגילים ואימונים שבניתי', 'היסטוריה, התאמת עומס, שיאים'],
    ['plans', 'fit30.plans', 'תוכניות אישיות ושינויים שאישרת', 'לוח האימונים שלך'],
    ['nutrition', 'fit30.nutrition', 'יומן אכילה, תפריט, מועדפים', 'סיכום יומי מול היעדים'],
    ['tracking', 'fit30.tracking', 'מים, צעדים, שינה, אנרגיה ומדידות גוף', 'מעקב והתקדמות'],
    ['photos', 'IndexedDB fit30-photos', 'תמונות התקדמות (אם הוספת)', 'השוואה ויזואלית — לא נשלחות לשום מקום'],
    ['avatar', 'fit30.avatar', 'תמונת פרופיל (אם הוספת)', 'תצוגה בלבד'],
    ['session', 'fit30.session', 'אימון שבתהליך', 'חזרה לאימון אחרי סגירת האפליקציה'],
    ['meta', 'fit30.meta', 'מתי בוצע גיבוי אחרון', 'תזכורת לגיבוי']];
  /* the device data belongs to ANOTHER account (signed in as B while A's data is on the device): never export it as B's */
  const foreign = !!(A && A.signedIn && A.owner && A.owner !== A.userId);
  return { be, A, signed, synced, where, cats, foreign };
}
Screens.privacy = function () {
  if (root.FIT30_BACKEND && !root.Account) { root.App.loadChunk('account.js').then(() => root.App.render(), () => root.App.render()); } /* account state decides what is on the server */
  const F = facts(), ex = root.ExportCSV, fs = ex ? ex.summary(ex.files()) : [];
  const svc = [
    ['שרת חשבונות וסנכרון (Supabase)', F.be ? (F.signed ? 'מחובר — את/ה מחובר/ת לחשבון' : 'זמין, לא מחובר/ת') : 'לא מוגדר בגרסה הזו', F.signed ? 'good' : '', 'רק אחרי התחברות: הפרופיל, האימונים, התזונה, המעקב והתוכניות. תמונות לא נשלחות.'],
    ['גופנים (Google Fonts)', 'פעיל', '', 'הדפדפן מוריד קובצי גופן מ־Google; Google רואה את כתובת ה־IP כמו בכל אתר. לא נשלח מידע אישי מהאפליקציה.'],
    ['חיפוש "אוכל בקרבתי" (קישור למפות)', 'רק בלחיצה', '', 'נפתח קישור חיצוני. המיקום נשלח רק אם בחרת לשתף אותו באותו רגע.'],
    ['ספק AI', 'לא מוגדר', 'warn', 'אין מודל מחובר. Sofit עונה מכללים מקומיים במכשיר; שום נתון לא נשלח לספק AI.'],
    ['אנליטיקה ומעקב שימוש', 'לא קיים', 'warn', 'האפליקציה לא אוספת נתוני שימוש.'],
    ['Apple Health / Health Connect', 'לא מחובר', 'warn', 'דורש אפליקציה נייטיב. צעדים: הזנה ידנית או קובץ CSV.']];
  const perms = [['מיקום', 'מתבקש רק כשלוחצים "אוכל בקרבתי"; לא נשמר'], ['מצלמה / קבצים', 'רק כשבוחרים תמונה בעצמך'], ['התראות', 'האפליקציה לא מבקשת הרשאת התראות'], ['אחסון קבוע', 'הדפדפן מתבקש לא למחוק את הנתונים (persist); זו לא הרשאה למידע']];
  return { title: 'מרכז פרטיות', back: '#/settings', html: `
    <section class="card stack" data-privacy-data><h2>איזה מידע נשמר ואיפה</h2><p class="small muted">נכון לגרסה הזו ולמכשיר הזה. הנתונים שלך לא נמכרים ולא מועברים לשום צד שלישי מלבד מה שמפורט למטה.</p>
      <div class="list">${F.cats.map(([k, key, what, why]) => `<div class="li" data-cat="${k}"><div class="grow"><div class="t">${esc(what)}</div><div class="s">למה: ${esc(why)} · איפה: ${esc(k === 'photos' || k === 'avatar' || k === 'session' || k === 'meta' ? 'במכשיר בלבד' : F.where(k))}${key.startsWith('fit30.') && size(key) ? ` · ~${Math.max(1, Math.round(size(key) / 1024))} KB` : ''}</div></div></div>`).join('')}</div>
      <p class="tiny muted" data-privacy-sync>${F.signed ? `סנכרון: ${esc(F.A.status || 'פעיל')}${F.A.lastSyncAt ? ' · אחרון: ' + esc(String(F.A.lastSyncAt).slice(0, 16).replace('T', ' ')) : ''}${F.A.unsynced ? ' · יש שינויים שעוד לא נשלחו לשרת' : ''}.` : F.be ? 'לא התחברת לחשבון — שום דבר לא נשלח לשרת.' : 'בגרסה הזו אין שרת — שום דבר לא נשלח.'}</p></section>
    <section class="card stack" data-privacy-services><h2>שירותים חיצוניים</h2><div class="list">${svc.map(([a, b, c, d]) => `<div class="li"><div class="grow"><div class="t">${esc(a)}</div><div class="s">${esc(d)}</div></div><span class="pill ${c}" data-svc-state>${esc(b)}</span></div>`).join('')}</div></section>
    <section class="card stack" data-privacy-perms><h2>הרשאות</h2><div class="list">${perms.map(([a, b]) => `<div class="li"><div class="grow"><div class="t">${esc(a)}</div><div class="s">${esc(b)}</div></div></div>`).join('')}</div></section>
    <section class="card stack" data-privacy-export><h2>ייצוא הנתונים שלך</h2>
      <p class="small">קבצי CSV נפתחים ב־Excel, Numbers ו־Google Sheets (קובץ לכל נושא, עברית נתמכת). הקבצים נוצרים <b>במכשיר</b> ולא נשלחים לשום שרת. אסימוני התחברות וסודות לא נכללים לעולם.</p>
      ${F.foreign ? `<div class="banner bad small" data-export-foreign>${icon('lock')}<div>הנתונים במכשיר שייכים לחשבון אחר מזה שמחובר עכשיו, ולכן הייצוא חסום. התנתקו, או התחברו לחשבון שהנתונים שייכים לו.</div></div>` : ''}
      <div class="list" data-export-list>${fs.map(f => `<div class="li"><div class="grow"><div class="t">${esc(f.he)}</div><div class="s ltr">${esc(f.name)}</div></div><span class="pill" data-rows="${f.rows}">${f.rows ? f.rows + ' שורות' : 'אין נתונים'}</span><button class="btn sm" data-act="csv1" data-f="${esc(f.name)}" aria-label="ייצוא ${esc(f.he)}" ${F.foreign ? 'disabled' : ''}>ייצוא</button></div>`).join('')}</div>
      <div class="btns"><button class="btn primary" data-act="csvAll" ${st.busy || F.foreign ? 'disabled' : ''}>${st.busy ? 'מכין…' : 'ייצוא כל הקבצים'}</button><button class="btn" data-act="json">גיבוי מלא (JSON, לשחזור)</button></div>
      ${st.err ? `<div class="banner bad small" data-export-err>${icon('info')}<div>${esc(st.err)}</div></div>` : st.last ? `<div class="banner good small" data-export-ok>${icon('check')}<div>${esc(st.last)}</div></div>` : ''}
      <p class="tiny muted">תמונות לא נכללות בייצוא. קבצים בלי נתונים מכילים רק שורת כותרת.</p></section>
    <section class="card stack" data-privacy-delete><h2>מחיקה</h2><div class="list">
      <div class="li"><div class="grow"><div class="t">מחיקת כל הנתונים מהמכשיר</div><div class="s">מוחק את כל הרשומות, ההגדרות והתמונות מהדפדפן הזה. ${F.signed ? 'העותק בשרת לא נמחק בפעולה הזו.' : ''} לא ניתן לבטל — כדאי לייצא קודם.</div></div><a class="btn sm ghost" href="#/settings">להגדרות</a></div>
      ${F.be ? `<div class="li"><div class="grow"><div class="t">מחיקת החשבון</div><div class="s">מוחק בשרת את החשבון, הפרופיל, הנתונים המסונכרנים ודיווחי התקלות שלך (מחיקה מדורגת במסד הנתונים), ואז את הנתונים במכשיר. דורש התחברות.</div></div><a class="btn sm ghost" href="#/account">לחשבון</a></div>` : ''}
      <div class="li"><div class="grow"><div class="t">מה לא נמחק אוטומטית</div><div class="s">קבצים שייצאת או גיבויים ששמרת — הם אצלך ובשליטתך. גיבויים של ספק השרת (אם קיימים) כפופים למדיניות הספק; לא בדקנו אותם מכאן.</div></div></div></div></section>
    <p class="tiny faint">אין כאן ייעוץ משפטי. מסמך הפרטיות המלא (טיוטה): <a href="#/legal">פרטיות ותנאים</a>.</p>`,
    handlers: {
      csv1: el => { if (facts().foreign) return; dl(el.dataset.f); },
      csvAll: async () => { if (facts().foreign) return; st.busy = true; st.err = null; root.App.render(); try { const all = root.ExportCSV.files(); for (const f of all) await save(f); st.last = `יוצאו ${all.length} קבצים (${all.reduce((a, f) => a + f.n, 0)} שורות נתונים).`; } catch (e) { st.err = 'הייצוא נכשל: ' + (e.message || e) + '. הנתונים לא השתנו; אפשר לנסות שוב.'; } st.busy = false; root.App.render(); },
      json: () => root.App.exportBackup()
    } };
};
async function save(f) {
  const nv = root.App.nativeSave && root.App.nativeSave('sofitgo-' + f.name, f.csv, 'text/csv'); if (nv) { if (!nv.ok) throw new Error(nv.error); return; } /* Android test app: into Downloads */
  const blob = new Blob([f.csv], { type: 'text/csv;charset=utf-8' });
  if (root.FIT30_ENV === 'artifact' && root.App.dl) return root.App.dl.save({ filename: f.name, data: f.csv });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'sofitgo-' + f.name; a.dataset.csvDownload = f.name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
function dl(name) { st.err = null; const fail = e => { st.err = 'הייצוא נכשל: ' + (e.message || e); st.last = null; root.App.render(); }; /* the save result is awaited: a failed save is never reported as exported */
  try { const f = root.ExportCSV.files().find(x => x.name === name); if (!f) throw new Error('קובץ לא מוכר'); Promise.resolve(save(f)).then(() => { st.last = `יוצא ${f.he}: ${f.n} שורות.`; root.App.render(); }, fail); } catch (e) { fail(e); } }
})(window);
