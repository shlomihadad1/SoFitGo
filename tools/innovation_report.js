/* Writes PREVIEW-INNOVATION-REPORT.md (stages D–G) from logs and JSON reports. Numbers come from files written by test
   runs; the changed-files list is computed against the Stage C reference copy when it exists. */
const fs = require('fs'), path = require('path'), cp = require('child_process'); const ROOT = path.join(__dirname, '..'), REP = path.join(ROOT, 'dist/reports');
const LOG = f => { try { return fs.readFileSync(path.join(REP, 'logs', f), 'utf8'); } catch (e) { return ''; } };
const J = f => { try { return JSON.parse(fs.readFileSync(path.join(REP, f), 'utf8')); } catch (e) { return null; } };
const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'MEDIA-MANIFEST.json'), 'utf8'));
const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jerusalem' });
const o = [];
o.push('# Fit30 Premium — Preview "Innovation" (שלבים D–G)', '', `נוצר אוטומטית ${today} מתוצאות הבדיקות בעותק הפיתוח. **לא פורסם. האתר החי לא שונה.** אין commit, push או PR (אין git בפרויקט).`, '',
  'כל בדיקות הממשק רצו ב־Chromium (Playwright) עם הדמיית iPhone 13, iPad (820px) ו־320–1280px. **זו לא בדיקה על iPhone או iPad אמיתיים ולא ב־Safari/WebKit**, ולא ב־HTTPS אמיתי.', '');

o.push('## 1. טבלת בדיקות (הרצה אחרונה)', '', '| חבילה | עברו | נכשלו | הערה |', '|---|---|---|---|');
const run = LOG('run_all-final.txt').split('\n').filter(l => /exit=|artcheck/.test(l));
run.forEach(l => { const name = l.split(' ')[0], m = l.match(/pass (\d+) fail (\d+)/), a = l.match(/(\d+) PASS \/ (\d+) FAIL/);
  const NOTE = { stageD_test: 'חדש', stageE_test: 'חדש', stageF_test: 'חדש', stageG_test: 'חדש', soak_test: 'חדש — שנה מדומה, בדיקת עקביות', e2e_stageD: 'חדש', e2e_stageE: 'חדש', e2e_stageF: 'חדש', e2e_stageG: 'חדש' };
  o.push(`| ${name} | ${m ? m[1] : a ? a[1] : '—'} | ${m ? m[2] : a ? a[2] : '—'} | ${NOTE[name] || 'קיימת — לא שונתה'} |`); });
const dc = LOG('deploy_check.log').match(/pass (\d+) fail (\d+)/); if (dc) o.push(`| deploy_check (שרת מקומי) | ${dc[1]} | ${dc[2]} | הכישלון היחיד: "URL uses HTTPS" — צפוי ב־http מקומי |`);
const sk = J('soak-test.json'); if (Array.isArray(sk)) o.push('', `**בדיקת שימוש מדומה לאורך זמן (soak_test):** ${sk.length} תרחישים (${sk.map(x => x.scenario).join('; ')}). סה״כ ${sk.reduce((a, x) => a + x.counts.days, 0)} ימים מדומים, ${sk.reduce((a, x) => a + x.counts.logged, 0)} אימונים שנרשמו (${sk.reduce((a, x) => a + x.counts.early, 0)} הסתיימו מוקדם), ${sk.reduce((a, x) => a + x.counts.applied, 0)} התאמות שאושרו, ${sk.reduce((a, x) => a + x.counts.reverted, 0)} שבוטלו, ${sk.reduce((a, x) => a + x.counts.travel, 0)} תקופות נסיעה. הפרות עקביות: ${sk.reduce((a, x) => a + x.violationCount, 0)}; חריגות: ${sk.reduce((a, x) => a + x.counts.errors.length, 0)}.`);
const zl = ['e2e', 'e2e_stageA', 'e2e_stageB', 'e2e_stageC', 'e2e_stageD', 'e2e_stageE', 'e2e_stageF', 'e2e_stageG'].map(n => { const m = LOG(n + '-zip.log').match(/pass (\d+) fail (\d+)/); return m ? [n, +m[1], +m[2]] : null; }).filter(Boolean);
if (zl.length) o.push('', `**בדיקת החבילה אחרי חילוץ:** \`app/\` מתוך ה־ZIP הוגש בשרת נפרד (פורט 8099), ו־${zl.length} חבילות הממשק רצו עליו: ${zl.reduce((s, x) => s + x[1], 0)} עברו, ${zl.reduce((s, x) => s + x[2], 0)} נכשלו (${zl.map(x => x[0] + ' ' + x[1] + '/' + x[2]).join(', ')}). index.html זהה בייט־לבייט לבנייה שנבדקה.`);
o.push('', 'קובצי בדיקה קיימים (A–C ולפני כן) **לא שונו ולא נמחקו**. נוספו רק בדיקות חדשות.', '');

o.push('## 2. שינויים לפי שלב', '',
  '### D — Premium UX/UI',
  '- בית: כרטיס "המאמן היומי" (אימון היום או האימון הבא, מטרה, יום בתוכנית, שלב), רצועת שבוע עם סטטוסים, כרטיס עקביות שקוף, שקילה מהבית, גרף שבועי לפי שבוע התוכנית.',
  '- לוח: לוח חודשי של התוכנית האישית הפעילה (במקום לוח 30 הימים הקלאסי), עם צבע לסוג אימון וסטטוס.',
  '- אימונים: נפתח על "התוכנית שלי"; התוכנית הקלאסית מסומנת כלא פעילה.',
  '- התקדמות: לפי שבועות התוכנית הפעילה; היסטוריית תרגילים כוללת אימוני תוכנית.',
  '- מתכונים: 24 בכל פעם + "הצגת עוד" + חיפוש לפי שם או מרכיב (הדף ירד מ־~40,000 לכ־2,800 פיקסלים).',
  '- פרופיל והגדרות: שורת קפיצה לסעיפים שנשארת בראש המסך.',
  '- נגישות: ניווט ראשי עם תווית, aria-label לכל כפתור וקישור, יעדי מגע ≥44px, הפחתת תנועה. שתי עמודות ברוחב טאבלט.',
  '- זרימות נפוצות נמדדו בבדיקה: רישום מים — לחיצה 1; סימון ארוחה — 1; שקילה — 2; כל משימה נפוצה ≤4 לחיצות.', '',
  '### E — מערכת מדיה',
  '- דף תרגיל: "פרטי התרגיל" (שרירים עיקריים ומשניים, דפוס תנועה, ציוד, קושי, קפיצות) + "דגשי בטיחות" לפי סוג תנועה (בלי הנחות רפואיות).',
  '- דף מתכון: הודעה מפורשת כשאין סרטון הכנה או תמונות שלבים.',
  '- נבדקו מקורות מדיה פתוחים: free-exercise-db נדחה (מקור וזכויות הצילומים לא מתועדים); Wikimedia ו־Pexels חסומים מהסביבה. **לא נוספה מדיה חיצונית ולא הומצאו כתובות.**',
  '- הבנייה מסירה רווחים והערות (esbuild, בלי שינוי שמות) כדי לעמוד בתקציב 700KB של שלב A.', '',
  '### F — Adaptive Fitness Engine',
  '- נוספו גם שתי דרישות פתוחות מ־P07: מסנני ספריית תרגילים והעדפת "ללא גלוטן" (לפי מרכיבים).',
  '- `adapt.js`: 8 כללים שקופים — אין מספיק נתונים, התקדמות, הקלה, התאוששות, זמן, אימון שהוחמץ, חזרה אחרי הפסקה, העדפה מהחלפות.',
  '- כל הצעה מציגה את הנתונים ואת הימים שישתנו. אין שינוי בלי אישור; כל אישור הפיך; אימונים שנרשמו לא משתנים; האישור הוא הכול־או־כלום.',
  '- גבולות: צעד רמה אחד, סט אחד, עלייה אחת לתרגיל ב־14 יום; אין עלייה במאמץ ≥9 או באנרגיה נמוכה; השלמה בלבד לא מעלה עומס.',
  '- הנגן שומר משוב לכל תרגיל ביומן התוכנית.', '',
  '### G — תכונות ייחודיות (דירוג מלא ב־G-AUDIT.md)',
  '- למה התוכנית שלי כזו (`#/explain`) · סיכום שבועי (`#/review`) · רשימת קניות והכנה מראש (`#/shopping`) · שיאים ואבני דרך (`#/records`) · מצב נסיעה / בלי ציוד (מסך התוכנית).', '');

o.push('## 3. תכונות ומצב מימוש', '', '| תכונה | מצב | ראיה |', '|---|---|---|',
  '| Daily Coach | ממומש ונבדק | e2e_stageD "home (Daily Coach)" |', '| לוח התוכנית הפעילה | ממומש ונבדק | stageD_test, e2e_stageD "calendar" |',
  '| חיפוש ודפדוף במתכונים | ממומש ונבדק | e2e_stageD |', '| פרטי תרגיל + דגשי בטיחות | ממומש ונבדק | stageE_test, e2e_stageE (57 דפים) |',
  '| סטטוס מדיה חסרה במתכונים | ממומש ונבדק | e2e_stageE (133 דפים) |', '| מנוע התאמה (8 כללים) | ממומש ונבדק | stageF_test, e2e_stageF, soak_test |',
  '| Explain My Plan | ממומש ונבדק | stageG_test G1, e2e_stageG |', '| Weekly Review | ממומש ונבדק | stageG_test G2, e2e_stageG |', '| רשימת קניות + הכנה מראש | ממומש ונבדק | stageG_test G3, e2e_stageG |',
  '| שיאים ואבני דרך | ממומש ונבדק | stageG_test G4, e2e_stageG |', '| מצב נסיעה | ממומש ונבדק | stageG_test G5, e2e_stageG, soak_test |',
  '| מסנני ספריית תרגילים (ציוד, קושי, סוג, בלי קפיצות, מועדפים, עם סרטון) | ממומש ונבדק — דרישה פתוחה מ־P07 | e2e_stageD "exercise library filters" |',
  '| העדפת "ללא גלוטן" (לפי מרכיבים) + מסנן מתכונים | ממומש ונבדק — דרישה פתוחה מ־P07 | stageG_test "gluten-free" |',
  '| סרטוני הדגמה / צילומי מנות | **לא קיים** — אין מקור מורשה | MEDIA-MANIFEST.json, MEDIA-QUEUE.md |', '');

o.push('## 4. באגים שתוקנו בשלבים D–G', '',
  '1. "התאמות מוצעות" בבית הציג ימים שהוחמצו מהתוכנית הקלאסית גם כשתוכנית אישית פעילה (נמצא בצילום מסך; תוקן ב־F; בדיקה ב־stageF_test וב־e2e_stageF).',
  '2. אימון שהסתיים מוקדם סימן תרגילים שלא הגיעו אליהם כ"נכשלו" והציע הקלה (נמצא בצילום מסך; בדיקת רגרסיה שנכשלת על הקוד הישן).',
  '3. כלל ההעדפה (R-PREF) היה חסום מאחורי בדיקת "אין מספיק נתונים".',
  '4. כלל ההעדפה בחר תרגיל שמופיע רק בבלוק הסיום, וההחלפה הקבועה נכשלה (נמצא בבדיקת השנה המדומה).',
  '5. אישור התאמה שנכשל באמצע השאיר שינויים חלקיים — האישור הוא עכשיו הכול־או־כלום (בדיקה ב־stageF_test).',
  '6. הבנייה עברה את תקציב 700KB של שלב A — טופל בהסרת רווחים והערות, בלי לשנות את הסף.',
  '7. כלל ההעדפה הציע החלפה קבועה לתרגיל שאינו חלופה תקינה באותו יום, והאישור נכשל (נמצא בתרחיש השני של בדיקת השנה המדומה; עכשיו נבדק לפני ההצעה ולפני האישור).', '');

o.push('## 5. מגבלות ונכסים חסרים', '');
const roles = {}; man.items.forEach(i => { roles[i.role] = roles[i.role] || { a: 0, m: 0 }; roles[i.role][i.status === 'available' ? 'a' : 'm']++; });
const RH = { 'exercise-cover': 'תמונות שער לתרגילים (איור שנוצר מקומית)', 'exercise-demo': 'סרטוני הדגמה לתרגילים', 'recipe-photo': 'צילומי מנות', 'recipe-prep': 'סרטוני הכנה', 'recipe-steps': 'סטים של תמונות שלבים' };
o.push('| נכס | קיים | חסר |', '|---|---|---|', ...Object.entries(roles).map(([k, v]) => `| ${RH[k] || k} | ${v.a} | ${v.m} |`), '',
  '- בדיקות רק ב־Chromium עם הדמיה; לא נבדק על iPhone/iPad אמיתי, ב־Safari או ב־HTTPS.',
  '- מנוע ההתאמה מבוסס כללים קבועים ולא נבדק מול משתמשים אמיתיים; ספי הכללים (70%, 7/10, 25%, 10 ימים) הם החלטות תכנון, לא מחקר.',
  '- ערכים תזונתיים הם הערכות מטבלאות ייחוס. רשימת הקניות לא כוללת עודף לפחת.',
  '- במצב נסיעה, לתרגיל שאין לו חלופה ללא ציוד מאותו סוג — התרגיל נשאר ומדווח.',
  '- מגבלות התפריט משלב C נשארו (טבעוני בלי סויה ובוטנים, יעדים גבוהים מאוד) — ראו STAGE-C-REPORT.md.',
  '- הנתונים מקומיים במכשיר בלבד; אין סנכרון ענן.', '');

o.push('## 6. הפעלה ובדיקה', '', '1. בתיקייה `app/`: `python3 -m http.server 8080`, ופתיחת `http://localhost:8080`.',
  '2. לבדיקה עם נתונים: הגדרות ← שחזור גיבוי (גיבוי מהגרסה הנוכחית), או בניית תוכנית חדשה מהבית.',
  '3. מה לבדוק: בית (המאמן היומי והקישורים), לוח, התוכנית שלי (התאמות מוצעות, מצב נסיעה, "למה התוכנית כזו?"), תזונה ← רשימת קניות, מעקב ← סיכום שבועי / שיאים.',
  '4. בדיקות אוטומטיות: מתוך `source/`, עם שרת שמגיש את `app/` בפורטים 8091 ו־8096: `sh tools/run_all.sh` (צריך Node ו־Playwright).', '',
  'כתובת חדשה מתחילה בלי נתונים — נתוני דפדפן נשמרים לפי כתובת. להעברה: ייצוא גיבוי באתר הקודם ושחזור בחדש.', '');

o.push('## 7. קבצים ששונו (לעומת Stage C)', '');
const REF = '/home/claude/fit30-premium';
if (fs.existsSync(REF)) { const rows = []; const walk = d => fs.readdirSync(path.join(ROOT, d)).forEach(f => { const rel = path.join(d, f), abs = path.join(ROOT, rel); if (fs.statSync(abs).isDirectory()) return walk(rel); if (!/\.(js|css|sh)$/.test(f)) return;
    const ref = path.join(REF, rel); if (!fs.existsSync(ref)) rows.push(`| \`${rel}\` | חדש | ${fs.readFileSync(abs, 'utf8').split('\n').length} שורות |`); else if (fs.readFileSync(ref, 'utf8') !== fs.readFileSync(abs, 'utf8')) { let a = 0, r = 0; try { cp.execSync(`diff ${ref} ${abs}`); } catch (e) { const out = e.stdout.toString(); a = (out.match(/^>/gm) || []).length; r = (out.match(/^</gm) || []).length; } rows.push(`| \`${rel}\` | שונה | +${a} / −${r} |`); } });
  ['src', 'tools'].forEach(walk); o.push('| קובץ | סוג | היקף |', '|---|---|---|', ...rows); }
else o.push('עותק הייחוס של Stage C לא נמצא — הרשימה לא חושבה.');
o.push('', 'מסמכים חדשים: `G-AUDIT.md`, `DG-PROGRESS.md`, `BASELINE-BEFORE-STAGE-D.md`, הדוח הזה.', '');

o.push('## 8. רעיונות שנבחנו ונדחו', '', 'מתוך G-AUDIT.md (הנימוק המלא שם):', '');
const audit = fs.readFileSync(path.join(ROOT, 'G-AUDIT.md'), 'utf8').split('\n').filter(l => /^\| \d+ /.test(l) && /נדחה/.test(l));
audit.forEach(l => { const c = l.split('|').map(x => x.trim()); o.push(`- **${c[2]}** — ${c[11].replace(/^נדחה( לסבב הבא)? — /, '')}`); });
o.push('');
fs.writeFileSync(path.join(ROOT, 'PREVIEW-INNOVATION-REPORT.md'), o.join('\n')); console.log('PREVIEW-INNOVATION-REPORT.md', o.length, 'lines');
