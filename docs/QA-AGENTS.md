# SoFitGo — מערכת QA אוטומטית ("סוכני QA")

## מה זה
- **מריץ אחד** (`tools/qa/run_qa.js`) מפעיל את כל חבילות הבדיקה הקיימות בפרויקט.
- הוא מחלק אותן לשבעה תפקידים ומפיק **דו״ח יומי בעברית**.
- **אין בו מודל AI ואין שירות בתשלום.** כל תוצאה מגיעה מבדיקה שרצה בפועל.
- כל פריט מקבל אחד מארבעה מצבים: **עבר** (PASS), **נכשל** (FAIL), **חסום** (BLOCKED, עם הסיבה), **לא נבדק** (NOT TESTED, עם הסיבה).

| תפקיד | מה נבדק | חבילות |
|---|---|---|
| מנהל QA | תזמון, ריכוז תוצאות, חומרה (P0–P3) | המריץ עצמו |
| UI/UX | RTL ועברית, יישור שדות ב־6 רוחבים, מקלדת, כותרת וניווט, הבהוב, כפתורים שנעלמים, 7 מכשירים | `e2e_m10_ux`, `e2e_rc1_layout`, `e2e_shell`, `e2e_m9_identity`, `e2e_i18n` |
| אימות משתמשים | הרשמה, אימות סיסמה, כתובת כפולה, התחברות, יציאה, איפוס, session, מייל שנדחה (429), תפוגה | `e2e_account` (שרת Supabase מקומי מעל PostgreSQL אמיתי) |
| נתונים ואבטחה | RLS ובידוד בין משתמשים, rollback, סורקי סודות, טקסט תלוי מקום (מנאלי), כישלון שמירה | `rls_test`, `rollback_test`, `build_check`, `rc1_final_test`, `location_scan`, `e2e_savefail`; `live_check` מול השרת החי רק אם הופעל במפורש |
| פיצ׳רים | אימונים, צעדים, יעדים, תזונה, מתכונים, רישום כפול, סימוני "נאכל", מים (בליטרים, מקרי קצה), התקדמות, יומן, תוכניות | `e2e`, `e2e_stage*`, `e2e_meal_journal`, `e2e_now`, `e2e_activity`, `e2e_grocery`, `e2e_fridge`, `content_test`, `stage*_test`, `soak_test`… |
| ביצועים ותאימות | תקציב טעינה (712 KB), offline, שגיאות JS, קובץ יחיד, מנוע WebKit | `e2e_stageA`, `e2e_sw_shell`, `artcheck`, `tools/qa/webkit_smoke.js` |
| דו״ח | Markdown ו־JSON בעברית, וסיכום קצר לדף ה־CI | `dist/reports/qa/` |

## הפעלה
- **מקומית:** `npm install && npx playwright install chromium`. ואז:
  - `npm run qa`: הרצה מלאה, בערך 45–60 דקות;
  - `npm run qa:quick`: 11 חבילות מרכזיות, בערך 10 דקות.
- **בדיקות מסד הנתונים** צריכות PostgreSQL 16. מקומית: `tools/pg_local.sh`. ב־CI: מכולת שירות.
- **GitHub Actions** (`.github/workflows/qa-daily.yml`):
  - כל יום ב־08:00 שעון הודו (02:30 UTC): הרצה מלאה;
  - ידנית: Actions ← QA daily ← Run workflow (mode: full או quick);
  - בכל Pull Request ובכל push ל־main: הרצה מהירה;
  - הדו״ח נשמר כ־artifact בשם `qa-report` ל־14 יום, וסיכום מוצג בדף ההרצה.

## הפעלה ב־GitHub (חסום כרגע)
**אין עדיין מאגר GitHub ל־SoFitGo**, ולכן התזמון לא פעיל. כדי להפעיל:
1. ליצור מאגר **פרטי** ב־GitHub, למשל `sofitgo`.
2. לדחוף את הענף `qa-agents`, יחד עם ההיסטוריה (מצורפת ב־ZIP המקור כ־`sofitgo-m10-history.gitbundle`), ולפתוח Pull Request ל־main.
3. Settings ← Actions ← לאשר הרצת workflows.
4. בדיקות מול Supabase החי הן **רשות ומושבתות כברירת מחדל**. כדי להפעיל אותן:
   - Settings ← Secrets and variables ← Actions;
   - **Variables:** `QA_LIVE=1`, `SOFITGO_SUPABASE_URL`, `SOFITGO_SUPABASE_PUBLISHABLE_KEY`;
   - **Secrets:** `LIVE_A_EMAIL`, `LIVE_A_PASSWORD`, `LIVE_B_EMAIL`, `LIVE_B_PASSWORD`, של **שני משתמשי בדיקה ייעודיים** בלבד.

## עלות
**0 ₪ במסגרת החינמית.**
- ב־GitHub Free יש למאגר פרטי 2,000 דקות Linux בחודש, ולמאגר ציבורי אין הגבלה.
- הרצה מלאה יומית לוקחת בערך 50 דקות, כלומר כ־1,500 דקות בחודש. הרצה מהירה ב־PR לוקחת כ־12 דקות.
- עם יותר מכ־40 PR בחודש אפשר לחרוג. בלי אמצעי תשלום, GitHub פשוט עוצר הרצות ולא מחייב.
- אפשר לחסוך: להריץ את המלא כל יומיים, או להשאיר רק `workflow_dispatch` ל־PR.

## מגבלות (מוצגות בכל דו״ח)
- **Safari אמיתי ומכשירים: לא נבדקים.** Chromium הוא אמולציה. WebKit של Playwright הוא המנוע של Safari, לא Safari, והוא רץ רק ב־CI כי לא זמין בסביבה המקומית הנוכחית.
- **משלוח מיילים אמיתי וקישורי אימות: לא נבדקים.** אין תיבת דואר, וה־SMTP המובנה מוגבל ל־2 מיילים בשעה. הבדיקות לא שולחות מיילים.
- **תיקון אוטומטי: חסום.** אין מודל AI מאושר. כל כישלון מסומן NEEDS HUMAN REVIEW, בלי PR אוטומטי, בלי merge ובלי פריסה.

## הגנות
המערכת **לא**:
- פורסת לאתר;
- משנה DNS, SMTP או הגדרות Supabase;
- מריצה SQL על הפרויקט החי;
- מוחקת או משנה נתוני משתמשים אמיתיים.

הסקריפטים החיים:
- מסרבים לחשבון ששמו לא מתחיל ב־`test`;
- לא מדפיסים סיסמאות;
- מוחקים רק שורות שסומנו בהרצה הנוכחית.

## פתרון תקלות
| תסמין | סיבה ופתרון |
|---|---|
| `rls_test` / `e2e_account` = חסום | PostgreSQL לא זמין. מקומית: `sh tools/pg_local.sh`. ב־CI: לבדוק את מכולת `postgres`. |
| `rc1_test` נכשל: "recorded from this build" | הקוד השתנה והמדריכים לא הוקלטו מחדש. מריצים `node tools/tutorials_build.js`, ואז build. זה חלק מנוהל השחרור, לא באג. |
| `webkit_smoke` = חסום | WebKit לא מותקן. ב־CI מותקן אוטומטית. מקומית: `npx playwright install webkit`. |
| `e2e_stageA` נכשל בתקציב | הטעינה הראשונה עברה 712,000 בייט. בודקים מה גדל (`index.html`) ומעבירים מסך נדיר לטעינה לפי דרישה (`extra.js`). |
| כל ה־e2e נכשלים מהר | השרתים על 8096 ו־8091 לא עלו. המריץ מעלה אותם בעצמו; לבדוק ש־`python3` קיים. |
