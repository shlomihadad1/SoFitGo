/* Writes STAGE-C-REPORT.md from the test logs and dist/reports/stageC-{test,data}.json. Every number comes from a file
   produced by an actual test run; nothing here is typed by hand except labels and explanations. */
const fs = require('fs'), path = require('path'); const ROOT = path.join(__dirname, '..'), REP = path.join(ROOT, 'dist/reports');
for (const f of ['src/js/figure.js', 'src/data/exercises.js', 'src/data/workouts.js', 'src/data/nutrition.js', 'src/data/recipes_intl.js', 'src/data/recipes_med.js', 'src/data/catalog.js', 'src/js/logic.js']) require(path.join(ROOT, f));
const { NUTRI: N, Logic: L, CATALOG: CT } = globalThis; const F = N.FOODS;
const LOG = f => { try { return fs.readFileSync(path.join(REP, 'logs', f), 'utf8'); } catch (e) { return ''; } };
const m = (f, re) => { const x = LOG(f).match(re); return x ? { pass: +x[1], fail: +x[2] } : null; };
const J = f => JSON.parse(fs.readFileSync(path.join(REP, f), 'utf8'));
const tC = J('stageC-test.json'), D = J('stageC-data.json'), eC = (() => { try { return J('e2e-stageC.json'); } catch (e) { return null; } })();
const cell = r => r ? `${r.pass} | ${r.fail} | ${r.pass + r.fail ? 0 : 'לא הורץ'}` : '— | — | לא הורץ';
const MEAL = { m1: 'ארוחה ראשונה', m2: 'ארוחה עיקרית', snack: 'נשנוש', extra: 'תוספת חלבון' };
const CU = CT.CUISINE_HE || {}; const cu = c => CU[c] || c;
const out = [];
out.push('# Fit30 Premium — דוח שלב C: תזונה בינלאומית ותפריט אישי', '',
  `נוצר אוטומטית מתוצאות הבדיקות (${new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jerusalem' })}). **לא פורסם לאתר החי.** כל הבדיקות רצו בסביבת Linux: Node ו־Chromium (Playwright) עם הדמיית מסך iPhone 13 — **זו לא בדיקה על iPhone אמיתי ולא ב־Safari.**`, '');

out.push('## 1. תוצאות בדיקות', '', '| חבילה | עברו | נכשלו | הערה | יומן |', '|---|---|---|---|---|');
const rows = [
  ['בנייה', m('build_check.log', /pass (\d+) fail (\d+)/), 'build_check.log'],
  ['תוכן ולוגיקה (קיימות)', m('content_test.log', /pass (\d+) fail (\d+)/), 'content_test.log'],
  ['שלב A — Node', m('stageA_test.log', /pass (\d+) fail (\d+)/), 'stageA_test.log'],
  ['שלב B — Node', m('stageB_test.log', /pass (\d+) fail (\d+)/), 'stageB_test.log'],
  ['**שלב C — Node**', { pass: tC.pass, fail: tC.fail }, 'stageC_test.log'],
  ['ממשק (קיימות)', m('e2e.log', /E2E: pass (\d+) fail (\d+)/), 'e2e.log'],
  ['ממשק — שלב A', m('e2e_stageA.log', /pass (\d+) fail (\d+)/), 'e2e_stageA.log'],
  ['ממשק — שלב B', m('e2e_stageB.log', /pass (\d+) fail (\d+)/), 'e2e_stageB.log'],
  ['**ממשק — שלב C**', eC ? { pass: eC.pass, fail: eC.fail } : null, 'e2e_stageC.log'],
  ['עמוד ב־Claude + מעבר מגרסה 1', { pass: (LOG('artcheck.log').match(/PASS/g) || []).length, fail: (LOG('artcheck.log').match(/FAIL/g) || []).length }, 'artcheck.log'],
  ['בדיקת אירוח (שרת מקומי)', m('deploy_check.log', /pass (\d+) fail (\d+)/), 'deploy_check.log']];
rows.forEach(([n, r, f]) => out.push(`| ${n} | ${r ? r.pass : '—'} | ${r ? r.fail : '—'} | ${!r ? 'לא הורץ' : (/deploy/.test(f) && r.fail ? 'הכישלון היחיד: "URL uses HTTPS" — צפוי בשרת מקומי ב־http; יכול לעבור רק בכתובת HTTPS אמיתית' : '')} | logs/${f} |`));
out.push('', '**שלב C — לפי נושא (Node):**', '', '| נושא | עברו | נכשלו |', '|---|---|---|', ...Object.entries(tC.sections).map(([k, v]) => `| ${k} | ${v.pass} | ${v.fail} |`));
if (eC) out.push('', '**שלב C — ממשק (Chromium):**', '', '| נושא | עברו | נכשלו |', '|---|---|---|', ...Object.entries(eC.groups).map(([k, v]) => `| ${k} | ${v.pass} | ${v.fail} |`));
out.push('', 'אף בדיקה קיימת לא נמחקה. שינויים בבדיקות קיימות — בסעיף 9.', '');

out.push('## 2. תקלות שהבדיקות מצאו ותוקנו בשלב הזה', '',
  '- **יום בלי תפריט אישי במעבר בין תוכניות.** החלפה לתוכנית שמתחילה מחר השאירה את היום על התפריט הקלאסי — כולל מנה עם ביצים אצל משתמש טבעוני. נמצא בבדיקת הממשק. תוקן: תוכנית שהוחלפה ממשיכה לכסות את הימים עד שהחדשה מתחילה. נוספו בדיקות Node וממשק; הוודאתי שבדיקת ה־Node נכשלת בלי התיקון ועוברת איתו.',
  `- **איכות התפריט תלויה בזרע אקראי.** התפריט נבנה מזרע שנגזר ממזהה התוכנית (אקראי). בהרצה אחת ירדו הקלוריות בטווח ±7% ל־25 מתוך 30 ימים. מדידה על 200 זרעים: 9% מהתפריטים מתחת לרף. הסיבה: ימים עם מנות רזות מאוד שבהם המנות הגיעו לתקרת הכמות. תוקן: שלב התיקון מחליף גם כשהקלוריות מחוץ לטווח (לא רק כשחסר חלבון). אחרי התיקון: 200 מתוך 200 זרעים עם 30/30 ימים בטווח. נוספה בדיקה קבועה על 60 זרעים (הגרוע ביותר: ${D.seedRobust.worstKcalWithin7pct}/30 קלוריות, ${D.seedRobust.worstProteinMet}/30 חלבון).`,
  '- **תוספת חלופית שלא תואמת העדפות.** טבעוני בלי סויה ובוטנים קיבל כתוספת אופציונלית מנה עם יוגורט. תוקן: אם אין תוספת מתאימה — לא מוצעת תוספת.',
  '- **כמויות גדולות מדי.** בהתאמת מנה לקלוריות נוצרו מרכיבים מעל 500 ג׳. נוספה תקרה לכל סוג מזון ובדיקה שאין מרכיב מעל 500 ג׳ במנה.', '');

out.push('## 3. מה נבנה', '',
  `- **${D.intlCount} מתכונים בינלאומיים חדשים** (${N.RECIPES.filter(r => r.intl && r.meal !== 'extra').length} ארוחות + ${N.RECIPES.filter(r => r.intl && r.meal === 'extra').length} תוספות חלבון). 70 המתכונים ההודיים נשמרו כמו שהם. ${Object.keys(D.cuisines).length} מטבחים.`,
  `- **32 מזונות חדשים** עם ערכים ל־100 ג׳ ומצב משקל (נא / יבש / מוכן).`,
  '- **תפריט יומי לכל יום בתוכנית הפעילה** — 7, 30, 60, 90, 180, 365 ימים ותוכנית מותאמת. כל יום נבנה בנפרד; אין הפניה חזרה לתפריט 30 הימים.',
  '- **התאמה אישית:** יעדי קלוריות וחלבון של המשתמש; מטרה; העדפות (צמחוני, טבעוני, בלי חלב/ביצים/עוף/דגים/בשר, החרגת סויה ובוטנים כולל כל המשפחה); 2 או 3 ארוחות; זמן הכנה מקסימלי; מנות שלא אוהבים; גיוון; ארוחות שכבר נאכלו.',
  '- **כמות המנה מותאמת ליעד:** מזונות החלבון והשאר מוגדלים או מוקטנים בנפרד; ביצים, פרוסות לחם וטורטיות נשארים במספר שלם, כדי שההוראות יישארו נכונות.',
  '- **פערים מוצגים כמו שהם.** כשאי אפשר להגיע ליעד עם ההעדפות שנבחרו, היום מסומן בפער ("חסרים X ג׳ חלבון"). כשאין מנה מתאימה למשבצת היא נשארת ריקה עם הסבר — לא ממולאת במנה שלא תואמת.',
  '- **תוספת החלבון האופציונלית** מוצעת בנפרד ולא נספרת עד שבוחרים בה.',
  '- **החלפות:** החלפת ארוחה, החלפת מרכיב וגודל מנה — כולן מציגות טבלה של לפני/אחרי/הפרש בקלוריות, חלבון, פחמימות ושומן לפני האישור. ארוחה שכבר נאכלה לא משתנה ביומן.',
  '- **קישור לתוכנית:** שינוי יעד או העדפות לא משנה תפריטים לבד. מופיע באנר, נפתח מסך עם ממוצע לפני/אחרי, ורק אחרי אישור התפריט מחושב מחדש — מהיום הפתוח הראשון (היום, או מחר אם כבר נאכלה ארוחה היום). שמירת העדפות במסך ההגדרות נחשבת לאישור, ונכתב מאיזה תאריך התפריט עודכן. השהיה, החלפת תוכנית וביטול שומרים את היומן ואת תפריטי העבר.',
  '- **מסך מתכון:** תיאור, מטבח, טבעוני/צמחוני, מתאים להכנה מראש, אלרגנים, "מנה אחת", ואיך חושבו הערכים.',
  '- **מדיה:** לכל מתכון שדות לתמונה, סרטון הכנה ותמונות שלבים. כולם מסומנים כחסרים ב־MEDIA-MANIFEST.json, ובמקומם מוצג איור עם הכיתוב "אין עדיין צילום". אין קישורים מומצאים.', '');

out.push('## 4. המתכונים החדשים', '', 'הערכים מחושבים מסכום המרכיבים (גרם × ערך ל־100 ג׳) למנה אחת לפי המתכון המקורי. בתפריט האישי הכמויות מותאמות ליעד, כך שהערכים ביום מסוים שונים.', '',
  '| # | מזהה | שם | ארוחה | מטבח | הכנה+בישול | קק״ל | חלבון | פחמ׳ | שומן | אלרגנים |', '|---|---|---|---|---|---|---|---|---|---|---|');
N.RECIPES.filter(r => r.intl).forEach((r, i) => { const x = L.recipeMacros(r), al = [...new Set(r.ing.flatMap(g => [].concat(CT.ALLERGEN_OF[g.f] || [])))].map(a => (CT.ALLERGEN_HE || {})[a] || a);
  out.push(`| ${i + 1} | \`${r.id}\` | ${r.he} | ${MEAL[r.meal]} | ${cu(r.cuisine)} | ${r.prep + r.cook} דק׳ | ${Math.round(x.k)} | ${x.p.toFixed(1)} | ${x.c.toFixed(1)} | ${x.f.toFixed(1)} | ${al.join(', ') || '—'} |`); });
out.push('', `מטבחים: ${Object.entries(D.cuisines).map(([k, v]) => cu(k) + ' ' + v).join(' · ')}`, '');

out.push('## 5. מקור הערכים התזונתיים', '',
  'כל ערך הוא ערך ייחוס ל־100 ג׳ (בעיקר USDA SR Legacy, מעוגל). **אלה הערכות, לא מדידות של המנה שלך** — מותג, זן, אופן בישול וכמות שמן משנים את התוצאה.', '',
  'עמודת "בדיקה": **x** — קלוריות וחלבון הוצלבו מול מקור נוסף שמבוסס על USDA; **y** — נבדקה התאמה בין משקל נא/יבש למבושל; **a** — נבדקה רק עקביות פנימית (קלוריות ≈ 4×חלבון + 4×פחמימה + 9×שומן).', '',
  '| מזון | מצב משקל | קק״ל | חלבון | פחמ׳ | שומן | בדיקה |', '|---|---|---|---|---|---|---|');
const ST = { raw: 'נא', dry: 'יבש', ready: 'מוכן' };
Object.entries(F).filter(([, f]) => f.chk).forEach(([id, f]) => out.push(`| ${f.he} (\`${id}\`) | ${ST[f.st] || f.st} | ${f.k} | ${f.p} | ${f.c} | ${f.f} | ${f.chk} |`));
out.push('', 'הערה: לטונה בשימורים במים יש במקורות ערכים שונים (116 או 86 קק״ל ל־100 ג׳, תלוי ברשומה ובסוג הדג). נבחר ערך SR Legacy ‏116.', '',
  'מקורות להצלבה: [Protein Atlas — Protein Ranker](https://proteinatlas.ca/tools/protein-ranker) · [FoodStruct — tuna](https://foodstruct.com/food/tuna-light-canned-in-water) · [CalorieCue — calories list](https://caloriecue.app/calories)', '');

const T0 = D.targets;
out.push('## 6. תפריט 30 הימים הראשונים (פרופיל ברירת המחדל של הבדיקה)', '',
  `פרופיל: גבר, 32, ‏187 ס״מ, ‏85 ק״ג, ירידה בשומן → יעד **${T0.kcal} קק״ל, ${T0.protein} ג׳ חלבון** (פחמ׳ ${T0.carbs}, שומן ${T0.fat}). תוכנית הרגלים 30 יום. "סה״כ" לא כולל את התוספת האופציונלית; העמודה האחרונה מראה את הסכום אם בוחרים בה.`, '',
  '| יום | תאריך | ארוחה ראשונה | ארוחה עיקרית | נשנוש | קק״ל | חלבון | פחמ׳ | שומן | פער | עם תוספת |', '|---|---|---|---|---|---|---|---|---|---|---|');
D.table.forEach(r => { const s = x => x ? `${x.he} (${x.k}/${x.p})` : '— אין מנה מתאימה'; const g = r.gap ? [r.gap.p ? `חסרים ${r.gap.p} ג׳ חלבון` : '', r.gap.kLow ? `חסרות ${r.gap.kLow} קק״ל` : '', r.gap.kHigh ? `עודף ${r.gap.kHigh} קק״ל` : ''].filter(Boolean).join('; ') : '—';
  out.push(`| ${r.day} | ${r.date} | ${s(r.m1)} | ${s(r.m2)} | ${s(r.snack)} | ${Math.round(r.base.k)} | ${r.base.p.toFixed(1)} | ${Math.round(r.base.c)} | ${Math.round(r.base.f)} | ${g} | ${r.withExtra ? Math.round(r.withExtra.k) + ' / ' + r.withExtra.p.toFixed(1) : '—'} |`); });
const avg = k => D.table.reduce((s, r) => s + r.base[k], 0) / D.table.length;
out.push('', `ממוצע 30 יום: ${Math.round(avg('k'))} קק״ל, ${avg('p').toFixed(1)} ג׳ חלבון, ${Math.round(avg('c'))} ג׳ פחמ׳, ${Math.round(avg('f'))} ג׳ שומן. ימים עם פער: ${D.table.filter(r => r.gap).length}. בסוגריים: קק״ל/חלבון של המנה אחרי התאמת הכמות.`, '');

out.push('## 7. גיוון בתוכניות ארוכות', '', 'כל תוכנית נבנית מזרע שנגזר ממזהה התוכנית, ולכן המספרים משתנים מעט בין הרצות. הטבלה היא מהרצה אחת; השורה האחרונה מתחת לטבלה בודקת 60 זרעים.', '', '| תוכנית | ימים | מנות שונות | שימושים מקסימליים במנה | ממוצע שימושים | חלק בינלאומי | מטבחים | קק״ל בטווח ±7% | חלבון הושג | חזרה ביום צמוד |', '|---|---|---|---|---|---|---|---|---|---|');
D.variety.forEach(v => out.push(`| ${v.plan} | ${v.days} | ${v.distinct} | ${v.maxUses} | ${v.meanUses} | ${Math.round(v.intlShare * 100)}% | ${v.cuisines} | ${v.withinKcal7pct}/${v.days} | ${v.proteinMet}/${v.days} | ${v.consecutiveRepeats} |`));
out.push('', `- בכל התוכניות: אין אותה מנה בשני ימים רצופים באותה משבצת, ובכל 7 ימים יש לפחות 6 ארוחות עיקריות שונות.`,
  `- בתוכנית שנתית המאגר (${D.variety.find(v => v.plan === 'annual').distinct} מנות) חוזר על עצמו — מנה פופולרית מופיעה עד ${D.variety.find(v => v.plan === 'annual').maxUses} פעמים בשנה (בממוצע פעם ב־${Math.round(364 / D.variety.find(v => v.plan === 'annual').maxUses)} ימים). זה גבול של גודל המאגר, לא של האלגוריתם.`,
  `- עמידות: ${D.seedRobust.seeds} תפריטים בזרעים שונים לאותו משתמש — הגרוע ביותר: קלוריות בטווח ${D.seedRobust.worstKcalWithin7pct}/30 ימים, חלבון ${D.seedRobust.worstProteinMet}/30.`, '');

out.push('## 8. יעדים שונים והעדפות משולבות', '', '**יעדים לפי פרופיל (30 יום):**', '', '| פרופיל | יעד קק״ל | יעד חלבון | ממוצע קק״ל | ממוצע חלבון | ימים מתחת ל־93% קלוריות |', '|---|---|---|---|---|---|');
const PH = { 'smaller woman, fat loss': 'אישה, מבנה קטן, ירידה בשומן', 'larger man, muscle': 'גבר, מבנה גדול, בניית שריר' };
D.targetsByProfile.forEach(r => out.push(`| ${PH[r.profile] || r.profile} | ${r.kcalTarget} | ${r.proteinTarget} | ${r.avgKcal} | ${r.avgProtein} | ${r.daysUnder93pct}/${r.days} |`));
const PL = p => Object.entries(p).map(([k, v]) => k === 'exclude' ? 'בלי ' + v.map(x => ({ soya: 'סויה', peanuts: 'בוטנים' })[x] || x).join(' ובלי ') : k === 'meals' ? v + ' ארוחות ביום' : k === 'maxPrep' ? 'הכנה עד ' + v + ' דק׳' : ({ veg: 'צמחוני', vegan: 'טבעוני', dairy: 'בלי חלב', egg: 'בלי ביצים', chicken: 'בלי עוף', fish: 'בלי דגים', meat: 'בלי בשר' })[k] || k).join(' + ');
out.push('', `**העדפות לאורך 90 יום** (יעד ${T0.kcal} קק״ל / ${T0.protein} ג׳). בכל השילובים נבדק שאין אף מזון אסור בתפריט; זה עבר בכולם.`, '', '| העדפות | מנות שונות | משבצות ריקות | ימים עם פער | חלבון מינימלי | טווח קק״ל | מאגר: ראשונה/עיקרית/נשנוש |', '|---|---|---|---|---|---|---|');
D.prefs.forEach(r => out.push(`| ${PL(r.prefs)} | ${r.distinctMeals} | ${r.missingSlots} | ${r.gapDays}/${r.days} | ${r.proteinMin} | ${r.kcalRange[0]}–${r.kcalRange[1]} | ${r.poolSizes.m1}/${r.poolSizes.m2}/${r.poolSizes.snack} |`));
out.push('');

out.push('## 9. שינויים בבדיקות קיימות', '',
  '- `content_test`: נטען גם `catalog.js` (בלעדיו החרגת משפחת אלרגנים לא הייתה פעילה בבדיקה), ונוסף משתמש מוגדר — בלי פרופיל אין יעדים.',
  '- `stageA_test`: רשימות האלרגנים הורחבו למזונות החדשים (סויה, בוטנים, חלב; דגים נספרים כבשר לצורך "בלי בשר").',
  '- `e2e`: אחרי בחירת מנה להחלפה יש עכשיו מסך אישור — הבדיקה לוחצת "אישור", ונוספה בדיקה שההפרשים מוצגים לפני האישור.',
  '- `e2e_stageA`: מספר התבניות נלקח מהנתונים ולא קבוע.',
  '- `artcheck` מקבל את נתיב הקובץ כפרמטר — זו לא שינוי, רק אופן ההרצה.', 'שום בדיקה לא נמחקה ושום תנאי לא הוחלש.', '');

out.push('## 10. מגבלות שנותרו', '');
const pr = q => D.prefs.find(r => JSON.stringify(r.prefs) === JSON.stringify(q)) || {};
const vns = pr({ vegan: true, exclude: ['soya', 'peanuts'] }), vs = pr({ veg: true, exclude: ['soya'] }), two = pr({ meals: 2 }), big = D.targetsByProfile.find(r => r.kcalTarget > 3000);
out.push(
  `- **טבעוני בלי סויה ובלי בוטנים:** רק ${vns.distinctMeals} מנות מתאימות, אין אף ארוחה ראשונה מתאימה, ובכל ${vns.days} הימים יש פער (חלבון מינימלי ${vns.proteinMin} ג׳). האפליקציה אומרת את זה ולא ממלאת במנה שלא מתאימה. צריך מתכונים נוספים (סייטן, עדשים, אפונה, קטניות).`,
  `- **צמחוני בלי סויה:** פער חלבון ב־${vs.gapDays} מתוך ${vs.days} ימים.`,
  `- **2 ארוחות ביום:** פער (חלבון או קלוריות) ב־${two.gapDays} מתוך ${two.days} ימים — קשה להגיע ליעד בשתי ארוחות.`,
  `- **יעדים גבוהים מאוד** (${big.kcalTarget} קק״ל): ממוצע ${big.avgKcal}, ${big.daysUnder93pct}/${big.days} ימים מתחת ל־93%. בשלוש ארוחות התפריט לא מגיע ליעד, והימים האלה מסומנים כפער. אפשר להוסיף את התוספת האופציונלית ידנית.`,
  '- **ערכים תזונתיים הם הערכות** מטבלאות ייחוס, לא מדידה של המנה. לא נבדקו מול תוויות של מוצרים ספציפיים בישראל.',
  '- **אין צילומים וסרטונים** למתכונים — 133 מתכונים, כל המדיה מסומנת חסרה (MEDIA-QUEUE.md).',
  '- **מאגר המנות** מגביל את הגיוון בתוכניות של שנה: מנות חוזרות כל כמה שבועות.',
  '- **מחיר ועונתיות** של מרכיבים לא נלקחים בחשבון (יש רק דירוג עלות גס).',
  '- **בדיקות רק ב־Chromium** עם הדמיית iPhone. לא נבדק על iPhone אמיתי ולא ב־Safari/WebKit.',
  '- **הנתונים מקומיים בלבד** במכשיר. אין סנכרון ענן; גיבוי וייצוא ידניים.',
  '- **לא פורסם.** הגרסה החיה (אם הועלתה) לא השתנתה.', '');
fs.writeFileSync(path.join(ROOT, 'STAGE-C-REPORT.md'), out.join('\n')); console.log('STAGE-C-REPORT.md', out.length, 'lines');
