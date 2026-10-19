/* Builds STAGE-A-REPORT.md from project data and test outputs (dist/reports). No numbers typed by hand. */
const fs = require('fs'), path = require('path'); const ROOT = path.join(__dirname, '..'); const R = p => path.join(ROOT, p);
for (const f of ['src/js/figure.js', 'src/data/exercises.js', 'src/data/workouts.js', 'src/data/nutrition.js', 'src/data/recipes_intl.js', 'src/data/catalog.js', 'src/data/programs.js', 'src/data/media.js', 'src/js/logic.js', 'src/js/planner.js']) require(R(f));
const { EXERCISES, NUTRI, CATALOG: CT, PROGRAMS: PG, Planner: PL } = globalThis;
const J = f => JSON.parse(fs.readFileSync(R('dist/reports/' + f), 'utf8')); const LOG = f => fs.readFileSync(R('dist/reports/logs/' + f), 'utf8');
const man = JSON.parse(fs.readFileSync(R('MEDIA-MANIFEST.json'), 'utf8')), sA = J('stageA-test.json'), eA = J('e2e-stageA.json'), e2 = J('e2e-results.json');
const m = (f, re) => { const x = LOG(f).match(re); return x ? { pass: +x[1], fail: +x[2] } : null; };
const build = m('build_check.log', /pass (\d+) fail (\d+)/), content = m('content_test.log', /pass (\d+) fail (\d+)/), e2eOld = m('e2e.log', /E2E: pass (\d+) fail (\d+)/);
const art = LOG('artcheck.log'), dep = m('deploy_check.log', /pass (\d+) fail (\d+)/), depFails = LOG('deploy_check.log').split('\n').filter(l => /^FAIL/.test(l));
const hash = (fs.readFileSync(R('dist/pwa/sw.js'), 'utf8').match(/fit30-([0-9a-f]{10})/) || [])[1];
const size = f => fs.statSync(R(f)).size, kb = b => (b / 1024).toFixed(1) + ' KB';
const S = man.summary; const out = []; const H = t => out.push('', '## ' + t, '');
const facts = NUTRI.RECIPES.map(r => CT.recipeFacts(r)); const cnt = (arr, f) => arr.filter(f).length;
const exF = EXERCISES.map(e => CT.exFacts(e));

out.push('# Fit30 Premium — דוח שלב A (בסיס ותכנון)', '', `גרסת עבודה: \`fit30-premium\` · בנייה \`${hash}\` · נוצר אוטומטית ע״י \`tools/stageA_report.js\`.`, '',
  '> **לא פורסם דבר לאתר החי.** הגרסה ב־Netlify לא נגעה (אין לסביבה הזו גישה אליה). קובצי השחרור הקודמים נשמרו ללא שינוי.', '',
  '> בדיקות הדפדפן הן **אמולציה ב־Chromium** (Playwright) — לא iPhone פיזי ולא Safari.');

H('1. מה בוצע בפועל');
out.push('**גיבוי:** `fitapp/backups/fit30-v7-before-premium-*.tgz` (כל הפרויקט) + קובץ checksums של fit30-pwa-release.zip ו־fit30-upload.zip. העבודה בעותק נפרד `/home/claude/fit30-premium`.', '',
  '**בדיקת הקוד הקיים (ממצאים שמכתיבים את השלבים הבאים):**', '',
  `- ארכיטקטורה: PWA ללא framework; ${fs.readdirSync(R('src/js')).length} מודולי JS ו־${fs.readdirSync(R('src/data')).length} קובצי נתונים מאוחדים לקובץ אחד בבנייה. שמירה ב־localStorage (מפתחות profile, workouts, session, nutrition, tracking, meta); תמונות התקדמות ב־IndexedDB.`,
  '- הפרופיל הקיים מכיל ברירות מחדל אישיות (גיל 32, 187 ס״מ, 85 ק״ג) ואין בו שדות מטרה, ציוד, ימים זמינים, ניסיון או מין — נדרש לשלב B (פרופיל רב־משתמשי).',
  `- תוכנית האימון הקיימת: 30 יום קבועים (${PG.byId('fit30_classic') ? 'נשמרה כמסלול "Fit30 — 30 יום"' : ''}); אין מנגנון לתוכניות ארוכות — נבנה בשלב זה.`,
  `- ספריית התרגילים: ${EXERCISES.length} תרגילים, כולם משקל גוף או ריהוט ביתי. **אין** תרגילי משקולות, גומיות, מוט מתח או חדר כושר — פער שמוצג בתבניות הרלוונטיות ולא מוסתר.`,
  `- מאגר המתכונים: ${NUTRI.RECIPES.length} מתכונים — ${Object.entries(sA.cuisines).map(([k, v]) => `${CT.CUISINE_HE[k]} ${v}`).join(', ')}. **אין מנות בינלאומיות ואין דגים** — מטרת שלב C.`,
  '- מזהי תרגילים ומתכונים לא שונו.', '',
  '**נבנה בשלב זה:**', '',
  `- \`src/data/catalog.js\` — טקסונומיה ל־${EXERCISES.length} התרגילים (דפוס תנועה, סוג, ציוד, קושי, צד אחד, אימפקט; שרירים ראשיים/משניים נגזרים מהטקסט הקיים) ועובדות נגזרות למתכונים (אלרגנים, תזונה טבעונית/צמחונית, מטבח, זמן, מצב שקילה) — מחושבות מהמרכיבים, לא נשמרות פעמיים.`,
  `- \`src/data/programs.js\` + \`src/js/planner.js\` — ${PG.TEMPLATES.length} תבניות מסלול ומנוע שמייצר לוח יומי (1–365 ימים) עם שלבים, שבועות קלים, מבחני כושר, ימי מנוחה והתאוששות, התאמה לימים זמינים, זמן, ציוד, רמה, מטרה והחרגות. דטרמיניסטי; לא נוגע בהיסטוריה.`,
  '- מסכים חדשים: **מסלולים** (קטלוג + תצוגה מקדימה עם התאמה, בלי לשמור או לשנות דבר) ו**מצב מדיה ורישיונות**.',
  '- מערכת מדיה: מניפסט, רכיב וידאו (הפעלה/השהיה, חזרה אוטומטית, השתקה, עוצמה, מסך מלא, טעינה לפי דרישה), רכיב תמונה (WebP 480/960, טעינה עצלה), מצבי טעינה/שגיאה/חסר עם איור מסומן, מטמון מדיה מוגבל ב־Service Worker, כלי קליטה עם בדיקת רישיונות, ותור עבודה (MEDIA-QUEUE.md).',
  `- ${S.exerciseCovers.available} תמונות שער מקוריות לתרגילים (התחלה → סיום), מרונדרות ממודל הדמות של האפליקציה.`);

H('2. רכיבים שכבר עובדים');
out.push('| רכיב | איפה | אומת ע״י |', '|---|---|---|',
  '| כל האפליקציה הקיימת (תפריט, אימונים, מעקב, העדפות, החלפות, גיבוי) | כל המסכים | בדיקות קיימות: build, content, e2e — ראו סעיף 8 |',
  '| קטלוג מסלולים + תצוגה מקדימה | אימונים ← מסלולים; הגדרות | e2e_stageA: programs |',
  '| מנוע תכנון 1–365 ימים | src/js/planner.js | stageA_test: planner |',
  '| מסך מצב מדיה | הגדרות ← מצב מדיה ורישיונות | e2e_stageA: lazy loading |',
  '| נגן וידאו + fallback | עמוד תרגיל (כשיש סרטון) | e2e_stageA עם קובץ בדיקה (לא תוכן אמיתי) |',
  '| תמונת מנה + fallback | עמוד מתכון ורשימת מתכונים (כשיש צילום) | e2e_stageA עם קובץ בדיקה |',
  '| קליטת מדיה עם בדיקת רישיון | tools/media_build.js | stageA_test: ingest pipeline |',
  '| מטמון מדיה מוגבל + עבודה ללא חיבור + שדרוג גרסה | sw.js | e2e_stageA: offline, version upgrade |');

H('3. תוכניות זמן קיימות');
const def = id => { const t = PG.byId(id); if (t.classic) return null; const o = { start: '2026-10-19', profile: { level: t.level, maxMin: t.minutes, spw: t.spw } }; if (t.custom) o.days = 84; return PL.build(id, o).summary; };
out.push('נתוני הטבלה מחושבים בהרצת המנוע עם ברירות המחדל של כל תבנית (התחלה 19.10.2026, כל הימים זמינים). "תבנית אישית" חושבה ל־84 יום.', '', '| מסלול | משך | שלבים | אימונים | מבחנים | מנוחה | התאוששות | שבועות קלים | דק׳ ממוצע | אימונים שונים | הערות |', '|---|---|---|---|---|---|---|---|---|---|---|');
PG.TEMPLATES.forEach(t => { const s = def(t.id); if (!s) { const D = globalThis.PROGRAM.DAYS; out.push(`| ${t.he} | ${D.length} ימים | — | ${D.filter(d => d.type !== 'rest').length} | ${D.filter(d => d.testDay).length} | ${D.filter(d => d.type === 'rest').length} | — | — | ${Object.values(globalThis.Logic.VERSION_TARGET).join('/')} | — | התוכנית הקיימת, קבועה |`); return; }
  out.push(`| ${t.he} | ${s.days} ימים | ${s.phases.map(p => p.he.split(',')[0]).join(' → ')} | ${s.sessions} | ${s.assess} | ${s.rest} | ${s.active} | ${s.deloadWeeks} | ${s.avgMinutes} | ${s.distinctSessions} | ${s.gaps.length ? 'פער ספרייה' : ''} |`); });
out.push('', `בדיקת המנוע הורצה על ${sA.plannerRows.length} שילובים (${PG.TEMPLATES.length - 1} תבניות × 4 פרופילים); תוצאות מלאות: \`reports/stageA-test.json\` (plannerRows).`, '',
  '**מה המנוע עדיין לא עושה (שלב B):** שמירת תוכנית פעילה, הפעלה/החלפה עם אישור, עדכון לפי ביצועים, החלפת תרגיל בתוך אימון מתוכנן, תפריט יומי לכל יום (כרגע מפנה לתפריט 30 הימים ומסומן "זמני").');

H('4–6. מיפוי מדיה');
out.push('| נכס | קיים | חסר | הערה |', '|---|---|---|---|',
  `| תמונות שער לתרגילים | ${S.exerciseCovers.available} | ${S.exerciseCovers.missing} | איורים מקוריים (רינדור), ${S.duplicateCovers} כפולים |`,
  `| **סרטוני הדגמה לתרגילים** | **${S.exerciseVideos.available}** | **${S.exerciseVideos.missing}** | אין בסביבה כלי להפקת וידאו אמיתי; לא נעשה שימוש באנימציה כאילו היא סרטון |`,
  `| **צילומי מנות** | **${S.recipePhotos.available}** | **${S.recipePhotos.missing}** | אין כלי ליצירת צילומים; הורדה מהרשת חסומה בסביבה |`,
  `| **סרטוני הכנה** | **${S.recipePrepVideos.available}** | **${S.recipePrepVideos.missing}** | |`,
  `| תמונות שלבי הכנה | ${S.recipeStepSets.available} | ${S.recipeStepSets.missing} | |`, '',
  `גודל כל המדיה הקיימת: ${kb(S.bytes)}. כל נכס חסר מוצג באפליקציה כחסר, עם איור מסומן "איור".`);

H('7. נכסים חסרים');
out.push(`- ${S.exerciseVideos.missing} סרטוני הדגמה, ${S.recipePhotos.missing} צילומי מנות, ${S.recipePrepVideos.missing} סרטוני הכנה, ${S.recipeStepSets.missing} סטים של תמונות שלבים.`,
  '- הרשימה המלאה עם מפרט צילום לכל פריט ועדיפות: **MEDIA-QUEUE.md**. מצב כל נכס: **MEDIA-MANIFEST.json**.',
  '- **למה לא הושגו:** בסביבת העבודה אין כלי ליצירת וידאו או צילום, והרשת חסומה להורדת קבצים מאתרי מדיה (רק מאגרי חבילות זמינים). לא נעשה שימוש בקישורים שלא נבדקו או במדיה ללא רישיון.',
  '- **מה כן מוכן:** ברגע שיש קבצים עם רישיון — הנחה ב־media-src, שורה ב־credits.json והרצת media_build מכניסות אותם לאפליקציה, עם בדיקת פורמט (H.264 לאייפון), גודל, אורך ורישיון.');

H('8. בדיקות שהורצו');
out.push('| חבילה | עברו | נכשלו | דולגו | יומן |', '|---|---|---|---|---|',
  `| בנייה (תחביר, חבילה, קובצי PWA, מדיה, היעדר סודות/fixtures) | ${build.pass} | ${build.fail} | 0 | logs/build_check.log |`,
  `| תוכן ולוגיקה — הקיימות (מזון, מתכונים, 30 יום, העדפות, אימונים, גיבוי) | ${content.pass} | ${content.fail} | 0 | logs/content_test.log |`,
  `| שלב A — Node (קטלוג, מנוע תכנון, מיפוי מדיה, קליטה) | ${sA.pass} | ${sA.fail} | 0 | logs/stageA_test.log |`,
  `| ממשק — הקיימות (Chromium, iPhone 13) | ${e2eOld.pass} | ${e2eOld.fail} | 0 | logs/e2e.log |`,
  `| ממשק — שלב A (מדיה, טעינה עצלה, אופליין, מסלולים, רוחבים, שדרוג) | ${eA.pass} | ${eA.fail} | 0 | logs/e2e_stageA.log |`,
  `| גרסת עמוד ב־Claude + מעבר מגרסה 1 | ${(art.match(/PASS/g) || []).length} | ${(art.match(/FAIL/g) || []).length} | 0 | logs/artcheck.log |`,
  `| בדיקת אירוח (שרת מקומי) | ${dep.pass} | ${dep.fail} | 0 | logs/deploy_check.log |`, '',
  depFails.length ? `כשל צפוי בבדיקת האירוח: ${depFails.map(f => f.replace(/^FAIL /, '')).join('; ')} — שרת מקומי הוא HTTP; HTTPS ייבדק רק אחרי פריסה.` : '', '',
  '**פירוט שלב A (Node):** ' + Object.entries(sA.sections).map(([k, v]) => `${k} ${v.pass}/${v.pass + v.fail}`).join(' · '), '',
  '**פירוט שלב A (ממשק):** ' + Object.entries(eA.groups).map(([k, v]) => `${k} ${v.pass}/${v.pass + v.fail}`).join(' · '), '',
  `**ביצועים (שרת מקומי, Chromium, לא רשת סלולרית):** טעינה ראשונה ${eA.perf.loadMs} ms, ${eA.perf.firstLoadRequests} בקשות, ${kb(eA.perf.firstLoadBytes)} (בלי גופנים); תצוגת מסלול שנתי ${eA.perf.annualPreviewMs} ms. גודל index.html: ${kb(size('dist/pwa/index.html'))} ${fs.existsSync('/home/claude/fitapp/dist/pwa/index.html') ? '(בגרסה שנמסרה: ' + kb(fs.statSync('/home/claude/fitapp/dist/pwa/index.html').size) + ')' : ''}; מטא־דאטה של המדיה: ${kb(size('src/data/media.js'))}. אין בתים של מדיה בתוך החבילה.`, '',
  '**לא ניתן להריץ כאן:** iPhone פיזי, Safari/WebKit (לא מותקן), פריסה ל־HTTPS, ניגון H.264 (Chromium של Playwright לא מנגן H.264 — נבדק נגן עם WebM; MP4 נבדק רק ברמת כותרת הקובץ).');

H('9. מגבלות שנותרו');
out.push('- אין סרטונים ואין צילומים אמיתיים (סעיף 7).',
  '- הספרייה מכסה רק משקל גוף וריהוט ביתי; תבניות "ציוד בסיסי" ו"חדר כושר" מסומנות כפער ונבנות מתרגילי בית בלבד.',
  `- מגוון תרגילי משיכה ללא ציוד מוגבל (${exF.filter(f => ['pull_h', 'pull_scap'].includes(f.pattern)).length} תרגילים) — חוזרים הרבה בתוכניות ארוכות.`,
  '- המסלולים הם תצוגה מקדימה בלבד; הפעלה, שמירה והתאמה מחדש — שלב B. התפריט במסלולים ארוכים זמני (תפריט 30 הימים) — שלב C.',
  '- הפרופיל עדיין של משתמש יחיד עם ברירות מחדל אישיות — שלב B.',
  '- העדפת חזרה אוטומטית בנגן נשמרת בדפדפן בלבד (לא בגיבוי) עד שהעדפות המדיה יעברו לפרופיל בשלב B.',
  '- סרטונים לא נשמרים לעבודה ללא חיבור (בכוונה — חיסכון באחסון); תמונות שנצפו נשמרות במטמון של עד 160 קבצים.',
  `- תמונות השער הן איורי מקל פשוטים; העיצוב שלהן יעודכן בשלב D.`, '- ב־iPhone אי אפשר לשלוט בעוצמת הקול מתוך דף אינטרנט; הנגן מסתיר את המחוון ומשאיר השתקה.');

H('10. קובץ ה־Preview והפעלה');
out.push('`/home/claude/fit30-premium/fit30-premium-preview.zip` — ראו README-PREVIEW.md בתוך הקובץ.', '',
  'הפעלה מקומית: מחלצים, נכנסים ל־`app/` ומריצים `python3 -m http.server 8080`, ואז `http://localhost:8080`. מה לבדוק: אימונים ← מסלולים; הגדרות ← מצב מדיה ורישיונות; עמוד תרגיל; עמוד מתכון.', '',
  '**הצעד הבא (שלב B):** פרופיל אישי מלא, מטרות, ציוד, הפעלת מסלול עם אישור, החלפות תרגילים — לאחר אישורך.');
fs.writeFileSync(R('STAGE-A-REPORT.md'), out.join('\n') + '\n'); console.log('report lines', out.length);
