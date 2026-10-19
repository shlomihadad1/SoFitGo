/* Writes MEDIA-QUEUE.md: the work queue for every missing media asset, with a shot specification taken from the
   exercise/recipe data (start position, movement, end position, key cues; dish, quantities, key steps). */
const fs = require('fs'), path = require('path'); const ROOT = path.join(__dirname, '..');
for (const f of ['src/js/figure.js', 'src/data/exercises.js', 'src/data/workouts.js', 'src/data/nutrition.js', 'src/data/recipes_intl.js', 'src/data/catalog.js']) require(path.join(ROOT, f));
const { EXERCISES, NUTRI, CATALOG: CT } = globalThis;
const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'MEDIA-MANIFEST.json'), 'utf8'));
const miss = (role, id) => man.items.find(i => i.role === role && i.target.id === id && i.status === 'missing');
const usage = {}; require(path.join(ROOT, 'src/js/logic.js')); try { Object.assign(usage, globalThis.Logic.exerciseUsage()); } catch (e) { }
const out = ['# תור עבודה למדיה חסרה', '', `נוצר אוטומטית מ־MEDIA-MANIFEST.json (${new Date().toISOString().slice(0, 10)}). כל שורה היא נכס שעדיין **לא קיים**. אחרי שמשיגים או מצלמים נכס: מוסיפים אותו ל־media-src/credits.json (ראו media-src/README.md) ומריצים node tools/media_build.js.`, '',
  '## סדר עדיפויות', '', '1. סרטוני הדגמה לתרגילים שמופיעים בתוכנית 30 הימים — לפי מספר הימים שבהם הם מופיעים.', '2. צילומי מנות לתפריט הבסיס.', '3. סרטוני הכנה למנות המרכזיות; תמונות שלבים.', '',
  '## מפרט צילום אחיד לסרטוני תרגילים', '', '- 6–15 שניות, לולאה של חזרה אחת או שתיים: תנוחת התחלה (שנייה אחת) → תנועה → תנוחת סיום (שנייה אחת) → חזרה.', '- זווית לפי "מבט" שבטבלה (צד/חזית), מצלמה בגובה המותן, כל הגוף בפריים, רקע נקי וניטרלי.', '- MP4 בקידוד H.264, ‏720p, עד 6MB, בלי מוזיקה (אופציונלי: קול הדרכה). חובה תמונת שער.', '- אדם אמיתי או אנימציה תלת־ממדית — אבל כל סרטון מציג רק את התרגיל שלו.', ''];
const ex = EXERCISES.filter(e => miss('exercise-demo', e.id)).sort((a, b) => (usage[b.id] || []).length - (usage[a.id] || []).length);
out.push(`## סרטוני הדגמה לתרגילים — חסרים ${ex.length} מתוך ${EXERCISES.length}`, '', '| # | מזהה | תרגיל | מבט | ימים בתוכנית | תנוחת התחלה | דגשים לצילום |', '|---|---|---|---|---|---|---|');
ex.forEach((e, i) => out.push(`| ${i + 1} | \`${e.id}\` | ${e.he} (${e.en}) | ${e.view === 'front' ? 'חזית' : 'צד'} | ${(usage[e.id] || []).length} | ${e.start.replace(/\|/g, '/')} | ${(e.steps || []).slice(0, 3).join(' ← ').replace(/\|/g, '/')}; להימנע מ: ${(e.mistakes || []).slice(0, 2).join(', ')} |`));
const rcs = NUTRI.RECIPES.filter(r => miss('recipe-photo', r.id)); const inMenu = new Set(NUTRI.MENU.flat());
out.push('', `## צילומי מנות — חסרים ${rcs.length} מתוך ${NUTRI.RECIPES.length}`, '', 'מפרט: המנה המוכנה בכמות של מנה אחת לפי רשימת המרכיבים, צלחת על רקע כהה וניטרלי, אור טבעי, זווית 45° (או מלמעלה לקערות), 4:3, לפחות 1600 פיקסלים ברוחב. בלי תוספות שלא נמצאות במתכון.', '', '| # | מזהה | מנה | בתפריט הבסיס | מרכיבים עיקריים |', '|---|---|---|---|---|');
rcs.sort((a, b) => (inMenu.has(b.id) ? 1 : 0) - (inMenu.has(a.id) ? 1 : 0)).forEach((r, i) => out.push(`| ${i + 1} | \`${r.id}\` | ${r.he} | ${inMenu.has(r.id) ? 'כן' : '—'} | ${r.ing.filter(x => !x.side).slice(0, 5).map(x => NUTRI.FOODS[x.f].he.split(' (')[0] + ' ' + x.g + 'ג׳').join(', ')} |`));
const prep = NUTRI.RECIPES.filter(r => miss('recipe-prep', r.id) && !r.est && r.meal !== 'extra');
out.push('', `## סרטוני הכנה — חסרים ${NUTRI.RECIPES.filter(r => miss('recipe-prep', r.id)).length} מתוך ${NUTRI.RECIPES.length} (מתוכם ${prep.length} מתכונים ביתיים מלאים)`, '', 'מפרט: 30–90 שניות. מרכיבים עם כמויות ← שלבי בישול עם זמנים ← התוצאה הסופית. המנות של מסעדה והתוספות הקטנות לא דורשות סרטון.', '', ...prep.map(r => `- \`${r.id}\` ${r.he} — ${r.steps.length} שלבים, ${r.prep + r.cook} דק׳`));
fs.writeFileSync(path.join(ROOT, 'MEDIA-QUEUE.md'), out.join('\n') + '\n'); console.log('queue: videos', ex.length, 'photos', rcs.length, 'prep', prep.length);
