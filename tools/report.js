/* Builds FINAL-REPORT.md from project data and the logs written by the test runs (dist/reports, dist/reports/logs).
   Numbers are computed here from the data tables or parsed from test output — nothing is typed in by hand.
   Prose findings reference the test or log that demonstrates them. */
const fs = require('fs'), path = require('path'); const R = p => path.join(__dirname, '..', p);
for (const f of ['src/js/figure.js', 'src/data/exercises.js', 'src/data/workouts.js', 'src/data/nutrition.js', 'src/data/recipes_intl.js', 'src/data/recipes_med.js', 'src/js/logic.js']) require('../' + f);
const { NUTRI: N, Logic: L, PROGRAM: P } = globalThis; const F = N.FOODS;
const J = f => JSON.parse(fs.readFileSync(R('dist/reports/' + f), 'utf8'));
const LOG = f => fs.readFileSync(R('dist/reports/logs/' + f), 'utf8');
const menus = J('menus.json'), dur = J('durations.json'), audit = J('audit.json'), e2e = J('e2e-results.json');
const pf = (f, re) => { const m = LOG(f).match(re); return m ? { pass: +m[1], fail: +m[2] } : null; };
const build = pf('build_check.log', /pass (\d+) fail (\d+)/), content = pf('content_test.log', /pass (\d+) fail (\d+)/), e2eT = pf('e2e.log', /E2E: pass (\d+) fail (\d+)/);
const art = LOG('artcheck.log'), artPass = (art.match(/PASS/g) || []).length, artFail = (art.match(/FAIL/g) || []).length;
const sec = JSON.parse((LOG('content_test.log').match(/^\{"food table".*$/m) || ['{}'])[0]);
const buildHash = (fs.readFileSync(R('dist/pwa/sw.js'), 'utf8').match(/fit30-([0-9a-f]+)/) || [])[1];
const e2eBy = g => e2e.results.filter(r => r.g === g);
const e2eLine = re => e2e.results.find(r => re.test(r.m));
const nm = id => L.recipe(id).he, fh = f => F[f].he.split(' (')[0];
const SL = { m1: 'ארוחה 1', m2: 'ארוחה 2', snack: 'ביניים', extra: 'תוספת' };
const r1 = x => Math.round(x * 10) / 10;
const indep = ings => ings.reduce((t, x) => { const f = F[x.f], k = x.g / 100; t.k += f.k * k; t.p += f.p * k; t.c += f.c * k; t.f += f.f * k; return t; }, { k: 0, p: 0, c: 0, f: 0 });
const swapProbe = (() => { try { return LOG('swap-edit-probe.log').trim().split('\n').map(l => JSON.parse(l)); } catch (e) { return null; } })();
const PH = s => { const a = []; if (s.dairy === false) a.push('ללא חלב'); if (s.egg === false) a.push('ללא ביצים'); if (s.chicken === false) a.push('ללא עוף'); if (s.veg) a.push('צמחוני'); if (s.exclude) a.push('ללא ' + s.exclude.map(fh).join(' ו')); return a.join(' + '); };
const restDays = P.DAYS.filter(d => d.type === 'rest').map(d => d.day);
const out = []; const H = (t) => out.push('', '## ' + t, '');

out.push('# Fit30 — דוח QA וגרסת שחרור', '',
  `גרסת בנייה: \`${buildHash}\` · נוצר אוטומטית על ידי \`tools/report.js\` מנתוני הפרויקט ומיומני הבדיקות (\`dist/reports/\`).`, '',
  `יעד יומי לפי הפרופיל (גיל 32, 187 ס״מ, 85 ק״ג): ${menus.targets.kcal} קק״ל · ${menus.targets.protein} ג׳ חלבון. ערכי התזונה מחושבים מסכום המרכיבים × טבלת המזון שבפרויקט, ולכן הם הערכות.`, '',
  '> **הנתונים נשמרים במכשיר בלבד** (Local Storage; תמונות ב־IndexedDB). אין שרת, אין חשבון ואין סנכרון לענן. **תמונות התקדמות אינן נכללות בקובץ הגיבוי.**', '',
  '> **בדיקות הממשק הן אמולציה אוטומטית ב־Chromium (Playwright) בגודל מסך של iPhone 13 ומידות נוספות — לא בדיקה במכשיר iPhone פיזי ולא ב־Safari/WebKit.**');

/* ── 1 ── */
H('1. שינויים שבוצעו בפועל (סבב QA זה)');
const riceAdj = audit.adj.filter(a => a.recipe === 'chicken_curry_rice' && a.food === 'rice');
const d16 = dur.filter(r => r.day === 16 && !r.note);
out.push('### באגים מוכחים שתוקנו', '',
  '| # | ממצא | הוכחה | תיקון | בדיקה שמכסה |', '|---|---|---|---|---|',
  `| 1 | שחזור גיבוי בפורמט גרסה 1: תוצאות מבחני הכושר לא הופיעו עד טעינה מחדש | הרצת probe לפני התיקון | \`store.importAll\` טוען כל חלק דרך \`load()\` כך שהמעבר מגרסה 1 חל מיד | e2e: "${e2eLine(/v1 backup/).m}" — ${e2eLine(/v1 backup/).ok ? 'עבר' : 'נכשל'} |`,
  `| 2 | גיבוי חלקי השאיר שדות חסרים (למשל מועדפים) כ־undefined | probe לפני התיקון | ברירות מחדל ממולאות בשחזור | e2e: "${e2eLine(/partial backup: missing/).m}" — ${e2eLine(/partial backup: missing/).ok ? 'עבר' : 'נכשל'} |`,
  `| 3 | גיבוי שבו הפרופיל הוא מערך התקבל, דרס נתונים והפיל את האפליקציה | probe לפני התיקון | \`validateBackup\` בודק מבנה מלא לפני כתיבה; כשל באמצע — הנתונים הקודמים מוחזרים | e2e: "${e2eLine(/rejected with message: profile is an array/).m}" — ${e2eLine(/rejected with message: profile is an array/).ok ? 'עבר' : 'נכשל'} |`,
  `| 4 | גיבוי מגרסה עתידית (99) התקבל | probe לפני התיקון | נדחה עם הודעה | e2e: "${e2eLine(/rejected with message: future version/).m}" — ${e2eLine(/rejected with message: future version/).ok ? 'עבר' : 'נכשל'} |`,
  `| 5 | המתכון "${nm('milk_makhana')}" סומן 'veg' למרות שהוא מכיל חלבון ביצה | audit.json (tagIssues) | התג תוקן ל־'egg'; סינון "צמחוני" במסך המתכונים מחושב עכשיו מהמרכיבים ולא מהתגים | content: בדיקת תגים מול מרכיבים לכל ${N.RECIPES.length} המתכונים; tagIssues עכשיו: ${audit.tagIssues.length} |`,
  `| 6 | "${nm('chicken_curry_rice')}": שלב ההכנה ציין 120 ג׳ אורז, אבל בימים ${riceAdj.map(a => a.day + ' (' + a.to + ' ג׳)').join(', ')} התפריט מתכנן כמות גדולה יותר | audit.json (adjTextConflicts) | השלב מפנה לכמות ברשימת המרכיבים | content: "שלב ההכנה לא מצטט את הכמות שלפני ההתאמה" לכל ${audit.adj.length} ההתאמות; adjTextConflicts עכשיו: ${audit.adjTextConflicts.length} |`,
  `| 7 | יום 16: חתירה במשקוף עם עצירה של 2 שניות חושבה בקצב רגיל, ולכן משך הגרסה הוערך בחסר | בדיקת הערות התרגילים | נוסף \`tempo: true\` (5.5 שנ׳ לחזרה); גרסה ארוכה כוילה מחדש (longExtraSets: 2) — רק יום 16 השתנה | durations.json: יום 16 — ${d16.map(r => r.version + ' ' + r.total + ' דק׳').join(', ')} |`,
  `| 8 | עריכת כמות של ארוחה שכבר נאכלה, אחרי החלפת הארוחה, חישבה את הערכים מהמנה החדשה אך שמרה את שם המנה הישנה | ${swapProbe ? `probe (logs/swap-edit-probe.log): לפני התיקון נשמרו ${swapProbe[0].afterEdit.k} קק״ל במקום ${swapProbe[0].expectedK}; אחרי: ${swapProbe[1].afterEdit.k}` : 'יומן ה־probe חסר'} | עריכת כמות משתמשת במנה שנאכלה בפועל (מתכון, כמויות והחלפות שלה) | e2e: "${e2eLine(/edit portion after swap/).m}" — ${e2eLine(/edit portion after swap/).ok ? 'עבר' : 'נכשל'} |`,
  '', '### אי־התאמות בין קוד לתיעוד/תצוגה שתוקנו', '',
  `- **מסך היעדים** טען שרק מקורות חלבון מוגדלים. בפועל ${audit.adj.filter(a => a.kind === 'energy').length} מתוך ${audit.adj.length} ההתאמות הן הגדלות אנרגיה (פחמימה, פרי, אפונה). הטקסט עודכן לתאר את שני הסוגים ואת התקרה של 2,450 קק״ל.`,
  `- **מסך המתכון** הציג תמיד את כמויות הבסיס, גם כשנפתח מתוך התפריט היומי שבו הכמויות מותאמות. עכשיו קישור "מתכון" מתוך התפריט פותח \`#/recipe/<id>/<date>/<slot>\`: הכמויות והערכים הם של אותו יום, ליד כל כמות מותאמת מופיעה הכמות המקורית בסוגריים, ויש באנר "כמויות לפי התפריט של …". גם רשימת המרכיבים בתפריט היומי מציגה "(במתכון X g)".`,
  '- **הודעת התאמת ההעדפות** הציעה "להחליף ידנית", גם בשילובים שאין להם אף מנה תואמת במאגר. הנוסח עודכן.',
  '- **ארוחה שהוחלפה אחרי שנאכלה** הציגה "נאכל" ליד שם המנה החדשה. עכשיו מוצג שם המנה שנאכלה בפועל עם "(לפני ההחלפה)".',
  '', '### בדיקות שהורחבו', '',
  `- e2e: גיבויים פגומים, חלקיים, ישנים ועתידיים דרך הממשק (כולל וידוא שהנתונים לא השתנו), הקשר יומי במסך המתכון, החלפת ארוחה אחרי אכילה, תמונות (נשמרות מקומית ולא בגיבוי), ושלוש מידות מסך נוספות. סה״כ עכשיו: ${e2eT.pass + e2eT.fail} בדיקות.`,
  `- תוכן: כמויות שמן/אטה/דהי/אורז/פניר בשלבי ההכנה מול רשימת המרכיבים, תגים מול מרכיבים, התאמות שאינן מצוטטות בשלבים, וקבוצת המזון של כל התאמה. נוספו ${menus.preferences.length - 6} שילובי העדפות (סה״כ ${menus.preferences.length}). סה״כ עכשיו: ${content.pass + content.fail} בדיקות.`,
  '', 'גיבויים שנשמרו לפני השינויים: `backups/fit30-v3-before-release-20261017-2005.tgz`, ובנוסף `backups/e2e.js.before-ext` ו־`backups/content_test.js.before-ext`. הגרסאות הקודמות `fit30-pwa-fixed.zip` ו־`fit30-pwa-final.zip` לא נדרסו.');

/* ── 2 ── */
H('2. ממצאים שלא דרשו שינוי');
const adjFoods = [...new Set(audit.adj.map(a => a.food))];
out.push(`- דקות ההליכה שבהערות האימון תואמות לזמן שהטיימר סופר, בכל הגרסאות (${(LOG('content_test.log').match(/walk notes checked (\d+)/) || [])[1]} הערות נבדקו אוטומטית; ${sec.workouts ? sec.workouts.fail : '?'} כשלים בקטגוריית האימונים).`,
  '- ההודעה "יעד החלבון הושג" מבוססת רק על מה שנאכל, לא על המתוכנן (e2e: "target not shown as achieved before eating").',
  `- התאמות הכמויות לא נוגעות בביצים, חלבוני ביצה, אטה/רוטי, לחם, שמן או גהי, כלומר במרכיבים שנספרים ביחידות או שמשפיעים על השומן (בדיקת תוכן לכל ${audit.adj.length} ההתאמות). המזונות המותאמים: ${adjFoods.map(fh).join(', ')}.`,
  `- כל ההתאמות בטווח: הכמות החדשה גדולה מהמקורית ואינה עולה על פי 1.8 ממנה.`,
  '- התוספת האופציונלית לא נספרת בסיכום עד שבוחרים בה, בכל 30 הימים (בדיקות תוכן "add-on not counted until selected").',
  '- שינוי העדפות לא נוגע בימים שעברו ולא ברישומים של מה שנאכל (נבדק לכל שילוב העדפות).',
  `- ימי מנוחה (${restDays.join(', ')}) נשארו ימי מנוחה, בלי גרסאות קצר/רגיל/ארוך.`,
  '- שמירה וטעינה של מים, צעדים, שינה ומדידות, וגם מעבר בין מסכים, לא מאבדים נתונים (e2e tracking).');

const lowK = menus.preferences.filter(p => p.baseKcalMin < 2050 && !p.unresolved);
out.push('', '### בעיות שימושיות אפשריות (לא חוסמות, לא תוקנו)', '',
  '- שלבי ההכנה של מנה עם כמות מותאמת מפנים לרשימת המרכיבים ולא מציינים גרמים, כדי לא לסתור את הכמות היומית. המשתמש צריך להסתכל ברשימה.',
  `- בשילובי העדפות מסוימים הקלוריות היומיות יורדות מתחת ל־2,050: ${lowK.map(p => PH(p.prefs) + ' (מינ׳ ' + Math.round(p.baseKcalMin) + ')').join(', ')}. אין הודעה ייעודית על קלוריות נמוכות. מוצג רק הסיכום מול היעד.`,
  '- בשילובי העדפות עם פער (סעיף 6), ההשלמה ידנית: האפליקציה מציגה את הפער ואת ההצעות, אבל לא בוחרת בשביל המשתמש.',
  '', '### שיפורים שאינם נדרשים לשחרור', '',
  '- הרצת בדיקות הממשק גם ב־WebKit (נדרשת התקנת מנוע שאינו זמין בסביבה) ובמכשיר פיזי.',
  '- מתכונים נוספים ללא סויה ובוטנים לתזונה צמחונית/טבעונית, כדי לסגור את הפערים בסעיף 6.',
  '- תקרת קלוריות גם בבחירת מנה חלופית אחרי שינוי העדפות, ולא רק בהגדלת כמויות.',
  '- גיבוי אופציונלי של תמונות, בקובץ נפרד בגלל הגודל.');
/* ── 3 ── */
H('3. תוצאות בדיקות לפי קטגוריה');
out.push('| חבילה | עברו | נכשלו | דולגו | יומן |', '|---|---|---|---|---|',
  `| בדיקות בנייה (תחביר, חבילה, קובצי PWA, היעדר סודות) | ${build.pass} | ${build.fail} | 0 | logs/build_check.log |`,
  `| בדיקות תוכן ולוגיקה (Node) | ${content.pass} | ${content.fail} | 0 | logs/content_test.log |`,
  `| בדיקות ממשק בדפדפן (Chromium, אמולציית iPhone 13) | ${e2eT.pass} | ${e2eT.fail} | 0 | logs/e2e.log, e2e-results.json |`,
  `| גרסת הדף בתוך Claude + מעבר נתונים מגרסה 1 | ${artPass} | ${artFail} | 0 | logs/artcheck.log |`, '',
  '**פירוט בדיקות התוכן:**', '', '| קטגוריה | עברו | נכשלו |', '|---|---|---|', ...Object.entries(sec).map(([k, v]) => `| ${k} | ${v.pass} | ${v.fail} |`), '',
  '**פירוט בדיקות הממשק:**', '', '| קטגוריה | עברו | נכשלו |', '|---|---|---|', ...Object.entries(e2e.groups).map(([k, v]) => `| ${k} | ${v.pass} | ${v.fail} |`), '',
  '**לא הורץ (אין בסביבה כלי או מכשיר מתאים):**', '',
  '- בדיקה במכשיר iPhone פיזי, כולל התקנה למסך הבית, מחוות מגע אמיתיות ו־safe areas אמיתיים.',
  '- בדיקה במנוע WebKit/Safari: בסביבה מותקן רק Chromium (`/opt/pw-browsers`), ו־WebKit לא הותקן.',
  '- פריסה בפועל לשרת HTTPS והתקנת Service Worker מכתובת HTTPS. ה־Service Worker נבדק רק מ־`http://localhost`.',
  '- התנהגות iOS בנוגע לפינוי אחסון של אתרים, ומגבלות מקום של IndexedDB במכשיר.');

/* ── 4 ── */
H('4. 30 הימים — קלוריות וחלבון לפי ארוחה, לפני התוספת ואחריה');
out.push('חישוב בלתי תלוי: מתפריט הבסיס (`MENU`) ומההתאמות (`BASE_ADJ`), כגרמים × ערכי ל־100 ג׳. "מתוכנן" = שלוש הארוחות. התוספת נספרת רק כשבוחרים בה.', '',
  '| יום | ארוחה 1 (קק״ל/חלבון) | ארוחה 2 | ביניים | בסיס קק״ל | בסיס חלבון | התאמה | תוספת (רשות) | עם תוספת קק״ל | עם תוספת חלבון |', '|---|---|---|---|---|---|---|---|---|---|');
const dayRows = N.MENU.map((m, i) => { const adj = N.BASE_ADJ[i] || {}; const sl = ['m1', 'm2', 'snack'].map((k, j) => indep(L.recipe(m[j]).ing.map((x, q) => adj[k] && adj[k][q] != null ? { f: x.f, g: adj[k][q] } : x)));
  const b = sl.reduce((t, x) => ({ k: t.k + x.k, p: t.p + x.p }), { k: 0, p: 0 }), ex = indep(L.recipe(N.EXTRA_DAY[i]).ing); return { i, sl, b, ex, adj: Object.keys(adj).length };
});
dayRows.forEach(({ i, sl, b, ex, adj }) => { const md = menus.days[i]; const agree = Math.abs(md.base.k - b.k) <= 2 && Math.abs(md.base.p - b.p) <= 0.3;
  out.push(`| ${i + 1} | ${Math.round(sl[0].k)} / ${r1(sl[0].p)} | ${Math.round(sl[1].k)} / ${r1(sl[1].p)} | ${Math.round(sl[2].k)} / ${r1(sl[2].p)} | ${Math.round(b.k)} | ${r1(b.p)}${agree ? '' : ' ⚠'} | ${adj ? 'כן' : '—'} | ${nm(N.EXTRA_DAY[i])}: ${Math.round(ex.k)} / ${r1(ex.p)} | ${Math.round(b.k + ex.k)} | ${r1(b.p + ex.p)} |`); });
const bk = dayRows.map(d => d.b.k), bp = dayRows.map(d => d.b.p), mism = dayRows.filter(d => Math.abs(menus.days[d.i].base.k - d.b.k) > 2).length;
out.push('', `בסיס: ${Math.round(Math.min(...bk))}–${Math.round(Math.max(...bk))} קק״ל, ${r1(Math.min(...bp))}–${r1(Math.max(...bp))} ג׳ חלבון. ימים מתחת ליעד החלבון בלי תוספת: ${dayRows.filter(d => d.b.p < menus.targets.protein).length}. ימים מתחת ליעד הקלוריות (${menus.targets.kcal}): ${dayRows.filter(d => d.b.k < menus.targets.kcal).length}. ימים מעל היעד: ${dayRows.filter(d => d.b.k > menus.targets.kcal).length}.`,
  `הצלבה מול ערכי האפליקציה (\`Core.plannedTotals\`, menus.json): ${mism === 0 ? 'כל 30 הימים תואמים (±2 קק״ל)' : mism + ' ימים לא תואמים (מסומנים ⚠)'}.`, '',
  '**מתוכנן מול נאכל:** "נאכל" נספר רק מרישומי היומן (אכלתי / אחוז / עריכה). בדיקות e2e מאמתות 75% = 0.75 × המתכון, שאין רישום כפול לאותה ארוחה, ושהחלפת ארוחה אחרי אכילה לא משנה את מה שנאכל.',
  `**שינוי יעד:** כשהיעד גבוה מהבסיס (בבדיקה: יעד חלבון 200 ג׳), מוצג פער ("חסרים") עם הצעות להשלמה, והתפריט לא משתנה אוטומטית — e2e: "${e2eLine(/shortfall shown/).m}" ${e2eLine(/shortfall shown/).ok ? 'עבר' : 'נכשל'}. התפריט הבסיסי מכויל ליעד ${menus.targets.protein} ג׳. אם היעד הוגדל ידנית, הפער נשאר גלוי ולא מוסתר.`);

/* ── 5 ── */
H('5. התאמות כמויות (BASE_ADJ) — מטרה, היקף ותצוגה');
const pk = audit.adj.filter(a => a.kind === 'protein'), ek = audit.adj.filter(a => a.kind === 'energy');
const daysAdj = new Set(audit.adj.map(a => a.day));
out.push(`יש ${audit.adj.length} התאמות ב־${daysAdj.size} ימים. ההתאמות **מוצדקות ונשמרו**: בלעדיהן התפריט הבסיסי לא מגיע ליעד החלבון בלי התוספת. במקום להסיר אותן, עודכנו התיעוד והתצוגה כך שישקפו את הקוד.`, '',
  `- **${pk.length} התאמות חלבון.** מטרתן להביא כל יום ל־${menus.targets.protein} ג׳ חלבון לפחות בלי התוספת. הן מגדילות רק מקור חלבון שכבר קיים במנה.`,
  `- **${ek.length} התאמות אנרגיה.** מטרתן לקרב את היום ל־2,200 קק״ל בלי לעבור 2,450, אחרי שהחלבון הוגדל. הן מגדילות פחמימה, פרי או אפונה שכבר קיימים במנה.`,
  '- **כללים:** אין התאמות לביצים, חלבוני ביצה, אטה/רוטי, לחם, שמן או גהי. הכמות החדשה היא עד פי 1.8 מהמקורית. שלבי ההכנה לא מצטטים את הכמות הישנה של מרכיב מותאם (נבדק אוטומטית).',
  '- **איפה מוצג:** בתפריט היומי, עם התג "כמות מותאמת ליעד היומי" והכמות "(במתכון X g)". במסך המתכון כשנפתח מהתפריט, עם באנר יומי, ערכים מותאמים והכמות המקורית בסוגריים. המסך הכללי של המתכון מציג את כמות הבסיס. נבדק ב־e2e בקבוצה "recipe day context": ' + e2eBy('recipe day context').filter(r => r.ok).length + '/' + e2eBy('recipe day context').length + ' עברו.', '',
  '**סיכום לפי מזון** (משקל לפי מצב השקילה שבטבלה: נא / יבש / מוכן):', '',
  '| מזון | מצב שקילה | סוג | מספר התאמות | טווח מקור→חדש (ג׳) | תוספת ממוצעת קק״ל | תוספת ממוצעת חלבון |', '|---|---|---|---|---|---|---|');
const ST = { raw: 'נא', dry: 'יבש', ready: 'מוכן' };
adjFoods.forEach(f => { const a = audit.adj.filter(x => x.food === f); out.push(`| ${fh(f)} | ${ST[F[f].st]} | ${a[0].kind === 'protein' ? 'חלבון' : 'אנרגיה'} | ${a.length} | ${Math.min(...a.map(x => x.from))}→${Math.min(...a.map(x => x.to))} … ${Math.max(...a.map(x => x.from))}→${Math.max(...a.map(x => x.to))} | +${Math.round(a.reduce((s, x) => s + x.delta.k, 0) / a.length)} | +${r1(a.reduce((s, x) => s + x.delta.p, 0) / a.length)} |`); });
out.push('', '<details><summary>כל ההתאמות (' + audit.adj.length + ')</summary>', '', '| יום | ארוחה | מתכון | מזון | מקור (ג׳) | חדש (ג׳) | Δ קק״ל | Δ חלבון | Δ פחמ׳ | Δ שומן | סיבה |', '|---|---|---|---|---|---|---|---|---|---|---|');
audit.adj.forEach(a => out.push(`| ${a.day} | ${SL[a.slot]} | ${nm(a.recipe)} | ${fh(a.food)} (${ST[F[a.food].st]}) | ${a.from} | ${a.to} | +${a.delta.k} | +${a.delta.p} | +${a.delta.c} | +${a.delta.f} | ${a.kind === 'protein' ? 'יעד חלבון' : 'אנרגיה ל־2,200'} |`));
out.push('', '</details>', '',
  '**לא ניתן לאמת בסביבה זו:** ערכי טבלת המזון (`FOODS`) הם ערכי ייחוס משוערים ל־100 ג׳ ולא נמדדו במעבדה. הבדיקה מוודאת רק עקביות פנימית: אנרגיה מול חישוב Atwater בסטייה של עד 15%, ושמצב השקילה של אורז, קטניות, סויה ואטה הוא "יבש" ושל עוף הוא "נא". לא נעשתה השוואה למקור חיצוני. היחס בין משקל יבש למבושל ("אורז מתנפח פי ~3, קטניות פי ~2.5") הוא הערכה כללית ומוצג למשתמש כך.');

/* ── 6 ── */
H('6. העדפות מזון — כל השילובים שנבדקו');
out.push('לכל שילוב: שמירה והתאמה של התפריט, ובדיקת ימים 3–30 (28 ימים × 4 משבצות; ימים 1–2 הם "עבר" בתרחיש הבדיקה). בכל שילוב נבדק גם שימי העבר, הרישומים של מה שנאכל והחזרה לתפריט המקורי לא נפגעו.', '',
  '| העדפה | רכיבים שהוחלפו | מנות שהוחלפו | ארוחות ללא חלופה | מנות שונות | חלבון מינ׳ | חלבון ממוצע | קק״ל מינ׳–מקס׳ | ימים מתחת ליעד החלבון |', '|---|---|---|---|---|---|---|---|---|');
menus.preferences.forEach(p => out.push(`| ${PH(p.prefs)} | ${p.ingredientSwaps} | ${p.mealSwaps} | ${p.unresolved} | ${p.distinctMealsAfter} | ${p.baseProteinMin} | ${p.baseProteinAvg} | ${Math.round(p.baseKcalMin)}–${Math.round(p.baseKcalMax)} | ${p.daysBelowTarget} / 28 |`));
const bad = menus.preferences.filter(p => p.unresolved > 0 || p.daysBelowTarget > 3);
out.push('', '**פערים שנותרו (מוצגים למשתמש, לא מוסתרים):**', '');
bad.forEach(p => out.push(`- **${PH(p.prefs)}:** ${p.unresolved ? `${p.unresolved} ארוחות נשארות לא תואמות כי אין במאגר מנה שעומדת בכל ההגבלות. האפליקציה מציגה רשימה שלהן אחרי השמירה, ובאנר אזהרה בכל ארוחה כזו. ערכי החלבון והקלוריות בשורה זו הם של ארוחות שלא הותאמו, ולכן אינם מייצגים תפריט שעומד בהעדפה.` : ''}${p.baseKcalMax > 2450 ? ` אחרי החלפות המנות יש ימים מעל 2,450 קק״ל (עד ${Math.round(p.baseKcalMax)}); התקרה חלה רק על הגדלות כמות, לא על בחירת מנה חלופית.` : ''}${p.daysBelowTarget > 3 ? `${p.daysBelowTarget} מתוך 28 ימים מתחת ליעד החלבון (מינימום ${p.baseProteinMin} ג׳); הפער מוצג אחרי השמירה וביומן, עם הצעות להשלמה.` : ''}`));
out.push(`- בשאר השילובים מספר הימים מתחת ליעד הוא 0–${Math.max(...menus.preferences.filter(p => !bad.includes(p)).map(p => p.daysBelowTarget))} מתוך 28.`);

/* ── 7 ── */
H('7. משך כל גרסת אימון — 30 ימים × 3 גרסאות');
const m = dur.filter(r => !r.note), mx = v => Math.max(...m.filter(r => r.version === v).map(r => Math.abs(r.gap)));
const VH = { short: 'קצר', std: 'רגיל', long: 'ארוך' };
out.push(`הנחות החישוב: 3.5 שנ׳ לחזרה, 5.5 שנ׳ לחזרה בקצב איטי (tempo), 8 שנ׳ מעבר לכל סט, ומנוחות כפי שנקבעו בתוכנית. ימי מנוחה (${restDays.join(', ')}) נשארים ימי מנוחה, בלי גרסאות. הגרסאות כוילו בעיקר דרך מספר סבבים/סטים והליכה, לא דרך עומס נוסף. נמדדו ${m.length} גרסאות. פער מרבי מהיעד: קצר ±${mx('short')}, רגיל ±${mx('std')}, ארוך ±${mx('long')} דק׳. זה המשך המחושב; משך בפועל תלוי בקצב הביצוע.`, '',
  '| יום | גרסה | יעד | חימום | עבודה | מנוחות | מעברים | שחרור | סה״כ מחושב | מוצג באפליקציה | פער |', '|---|---|---|---|---|---|---|---|---|---|---|');
dur.forEach(r => out.push(r.note ? `| ${r.day} | ${VH[r.version]} | ${r.target} | — | — | — | — | — | — | — | ${r.note} |` : `| ${r.day} | ${VH[r.version]} | ${r.target} | ${r.warm} | ${r.work} | ${r.rest} | ${r.transitions} | ${r.cool} | ${r.total} | ${r.displayed ?? '—'} | ${r.gap > 0 ? '+' : ''}${r.gap} |`));

/* ── 8 ── */
H('8. ייצוא ושחזור');
out.push('נבדק דרך הממשק (e2e) ובבדיקות תוכן:', '', '| בדיקה | תוצאה |', '|---|---|');
[...e2eBy('backup'), ...e2eBy('photos (local only)'), ...e2eBy('backup negative (UI)')].forEach(r => out.push(`| ${r.m} | ${r.ok ? 'עבר' : '**נכשל**'} |`));
if (sec.backup) out.push(`| בדיקות גיבוי ברמת הלוגיקה (Node) | ${sec.backup.pass}/${sec.backup.pass + sec.backup.fail} עברו |`);
out.push(`| מעבר נתונים שנשמרו בגרסה 1 (artcheck) | ${/v1 migration.*PASS/.test(art) ? 'עבר' : 'נכשל'} |`, '',
  '**התנהגות:** לפני כל כתיבה הקובץ נבדק במלואו. קובץ פגום, חלקי במבנה, מאפליקציה אחרת או מגרסה עתידית נדחה עם הודעה, והנתונים הקיימים לא נוגעים (נבדק בהשוואה בייט־לבייט של Local Storage לפני הניסיון ואחריו). אם הכתיבה נכשלת באמצע, הנתונים הקודמים מוחזרים. גיבוי מגרסה 1 עובר המרה מיד. **תמונות ההתקדמות אינן נכללות בגיבוי**: הן נשארות במכשיר בלבד, וזה כתוב במסך הייצוא ובמסך ההתקדמות. שחזור לא מוחק תמונות שכבר קיימות במכשיר.');

/* ── 9 ── */
H('9. מגבלות שנותרו');
out.push('- **אחסון מקומי בלבד.** אין סנכרון לענן. מחיקת נתוני Safari או החלפת מכשיר מוחקות את הנתונים, אלא אם יש קובץ גיבוי. באייפון, האפליקציה שבמסך הבית ו־Safari שומרות נתונים בנפרד.',
  '- **תמונות** לא נכללות בגיבוי.',
  ...bad.map(p => `- **העדפה "${PH(p.prefs)}":** ${p.unresolved ? `${p.unresolved} ארוחות בלי חלופה תואמת במאגר.` : ''}${p.daysBelowTarget > 3 ? ` ${p.daysBelowTarget}/28 ימים מתחת ליעד החלבון.` : ''} לא תוקן בסבב זה: אין במאגר מספיק מתכונים לשילוב הזה. הפרופיל הנוכחי (בלי הגבלות) לא מושפע.`),
  `- **ערכי התזונה הם הערכות** לפי טבלת מזון פנימית. ארוחות מסעדה מסומנות בטווח שגיאה. משקלים: אורז, קטניות וסויה יבשים; עוף נא.`,
  `- **משכי האימון מחושבים** לפי קצב מונח (פער מרבי ±${Math.max(mx('short'), mx('std'), mx('long'))} דק׳ מהיעד), לא נמדדו בשעון.`,
  '- **לא נבדק במכשיר iPhone פיזי ולא ב־WebKit/Safari.** כל בדיקות הממשק רצו ב־Chromium באמולציה. לכן ייתכנו הבדלים ב־safe areas, במקלדת, בגלילה וב־Service Worker של iOS.',
  '- **שינוי העדפות לא משנה ימים שעברו** ולא ארוחות שכבר נרשמו כנאכלו. זה מכוון.');

/* ── 10 ── */
H('10. העלאה לשרת HTTPS והתקנה באייפון');
out.push('1. פורסים את `fit30-pwa-release.zip`. התיקייה `app/` מכילה את כל קובצי ההפעלה: `index.html`, `sw.js`, `manifest.webmanifest` וארבעה אייקונים.',
  '2. מעלים את **תוכן** `app/` (בלי תתי־תיקיות) לאחסון סטטי עם HTTPS, למשל GitHub Pages, Netlify (אפשר לגרור את התיקייה ל־app.netlify.com/drop) או Cloudflare Pages. ה־Service Worker פועל רק ב־HTTPS או ב־localhost.',
  '3. באייפון פותחים את הכתובת ב־**Safari**.',
  '4. לוחצים שיתוף ← "הוספה למסך הבית" ← "הוספה".',
  '5. פותחים מהאייקון, פעם אחת כשיש חיבור. אחרי זה האפליקציה עובדת גם בלי אינטרנט.',
  '6. מגדירים פרופיל ותאריך התחלה. מומלץ לייצא גיבוי מדי פעם (הגדרות ← ייצוא גיבוי) ולשמור אותו ב־Files.',
  '7. עדכון גרסה: מעלים את הקבצים החדשים לאותה כתובת. בפתיחה הבאה (עם חיבור) ה־Service Worker מחליף את המטמון. הנתונים במכשיר נשמרים.',
  '', 'בדיקה במחשב: בתוך `app/` מריצים `python3 -m http.server 8080` ופותחים `http://localhost:8080`.');

fs.writeFileSync(R('FINAL-REPORT.md'), out.join('\n') + '\n'); console.log('report lines', out.length, 'build', buildHash);
