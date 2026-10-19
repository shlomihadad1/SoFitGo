# SoFitGo — M10 Beta · build `e11ee266ea`

## מה יש בחבילות
| קובץ | מה זה |
|---|---|
| `SoFitGo-M10-beta-e11ee266ea-deploy.zip` | האתר הבנוי (`index.html` ו־`sw.js` ברמה העליונה). גרסה סטנדרטית: נתונים במכשיר בלבד, בלי חשבונות. |
| `SoFitGo-M10-beta-e11ee266ea-source.zip` | כל קוד המקור, הבדיקות, `supabase/` (migration, rollback, checks), התיעוד וה־CHANGELOG. ללא סודות. |

## בדיקה מהירה ב־iPhone (Safari) — בלי GitHub ובלי חשבון
1. ב־Netlify: **Add new site → Deploy manually**. גוררים את `…-deploy.zip` (או את התיקייה אחרי פריסה). **צרו אתר חדש**. לא RC4 ולא admirable-lokum.
2. פותחים את הכתובת החדשה ב־Safari באייפון. אפשר להוסיף למסך הבית דרך שיתוף ← "הוסף למסך הבית".
3. לבדוק:
   - הגדרה ראשונה: להקליד בשדות ולוודא שכפתור "המשך" לא מכסה אותם;
   - האפשרות "תזונה בלבד" בשלב 3;
   - בתפריט התזונה: "החלף מנה";
   - דיווח באג דרך הגדרות ← משוב.

## בדיקה מקומית במחשב
```
unzip SoFitGo-M10-beta-e11ee266ea-deploy.zip -d sofitgo-beta && cd sofitgo-beta && python3 -m http.server 8080
# פותחים http://localhost:8080
```

## הפעלת חשבונות ענן (אחרי אישור ה־SQL — עדיין לא בוצע)
1. מריצים ב־Supabase SQL Editor:
   - `supabase/checks/preflight_readonly.sql`;
   - `supabase/migrations/20261020000100_sofitgo_beta_core.sql`;
   - `supabase/checks/postflight_readonly.sql`.

   פירוט ב־`docs/SUPABASE-MIGRATION-REVIEW.md`.
2. Authentication → URL Configuration: מגדירים את Site URL ואת Redirect URLs לכתובת אתר הבטא החדש. Email: confirm email פעיל, אורך סיסמה מינימלי 8.
3. בונים גרסת בטא עם ענן (Node 18 ומעלה, `npm i esbuild`):
   ```
   SOFITGO_SUPABASE_URL=https://dvrfzeojctnttdkznuqr.supabase.co \
   SOFITGO_SUPABASE_PUBLISHABLE_KEY=<publishable key מ-Settings → API Keys> \
   FIT30_OUT=dist/pwa-beta node tools/build.js
   ```
   ואז פורסים את `dist/pwa-beta`. ה־build מסרב למפתח `sb_secret_` או `service_role`.
4. בדיקה חיה:
   ```
   SOFITGO_SUPABASE_URL=… SOFITGO_SUPABASE_PUBLISHABLE_KEY=… node tools/live_check.js
   ```
   להרצה מלאה מוסיפים את `LIVE_A_EMAIL`, `LIVE_A_PASSWORD`, `LIVE_B_EMAIL`, `LIVE_B_PASSWORD` של שני משתמשי בדיקה, כמשתני סביבה אצלך בלבד.

## Rollback
- **אפליקציה:** פורסים מחדש את ה־upload ZIP הקודם (M9 `e81b508e27`). הנתונים במכשירים נשמרים, כי מפתחות `fit30.*` לא השתנו.
- **מסד נתונים:** `supabase/rollback/20261020000100_rollback.sql`:
  - רמה 1: השהיה;
  - רמה 2: נעילת API, בלי לאבד נתונים;
  - רמה 3: מחיקה, רק אחרי ייצוא.

## הרצת הבדיקות (למפתחים)
`sh tools/run_all.sh` דורש:
- Playwright עם Chromium;
- שרתים על 8096 ו־8091 שמגישים את `dist/pwa`;
- PostgreSQL 16 לבדיקות RLS.

תוצאות: `TEST-RESULTS-M10.md`.
