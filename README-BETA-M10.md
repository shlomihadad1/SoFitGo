# SoFitGo — M10.1 Beta · build `a3701822bf`

## מה יש בחבילות
| קובץ | מה זה |
|---|---|
| `SoFitGo-M10.1-beta-a3701822bf-deploy.zip` | האתר הבנוי (`index.html` ו־`sw.js` ברמה העליונה). גרסה סטנדרטית: נתונים במכשיר בלבד, בלי חשבונות. |
| `SoFitGo-M10.1-beta-a3701822bf-source.zip` | כל קוד המקור, הבדיקות, `supabase/` (migration, rollback, checks), התיעוד וה־CHANGELOG. ללא סודות. |

## עדכון אתר הבטא הקיים (sprightly-taffy-5379f0)
1. פותחים את ה־ZIP של הפריסה למחשב. נוצרת תיקייה עם `index.html` ו־`sofitgo-config.js`.
2. Netlify ← האתר **sprightly-taffy-5379f0** ← Deploys ← גוררים את **התיקייה** לאזור "Drag and drop your site output folder here". לא נוגעים ב־RC4 ולא ב־admirable-lokum.
3. מוודאים: בכתובת האתר ← הגדרות ← בתחתית "חשבון" מופיע, ובקוד המקור של הדף מופיע `FIT30_BUILD='a3701822bf'`.

## הפעלת חשבונות באתר שכבר עלה (אחרי אישור ה־SQL והרצתו)
פותחים את `sofitgo-config.js` בתיקייה, ממלאים את `supabaseUrl` (`https://dvrfzeojctnttdkznuqr.supabase.co`) ואת `publishableKey` (מפתח `sb_publishable_…` מ־Project Settings ← API Keys; **לא** מפתח secret), ופורסים שוב את התיקייה. אין צורך בבנייה מחדש.

## בדיקה מהירה ב־iPhone (Safari)
1. ב־Netlify, או לאתר חדש: **Add new site → Deploy manually**. לא RC4 ולא admirable-lokum.
2. פותחים את הכתובת החדשה ב־Safari באייפון. אפשר להוסיף למסך הבית דרך שיתוף ← "הוסף למסך הבית".
3. לבדוק:
   - הגדרה ראשונה: להקליד בשדות ולוודא שכפתור "המשך" לא מכסה אותם;
   - האפשרות "תזונה בלבד" בשלב 3;
   - בתפריט התזונה: "החלף מנה";
   - דיווח באג דרך הגדרות ← משוב.

## בדיקה מקומית במחשב
```
unzip SoFitGo-M10.1-beta-a3701822bf-deploy.zip -d sofitgo-beta && cd sofitgo-beta && python3 -m http.server 8080
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

## Tests against the real server (live) — test accounts only
Two dedicated test users, created in Supabase with Auto Confirm. Credentials are passed **only** as environment variables. The scripts print no password, write nothing to the source, and refuse any account whose name doesn't start with `test`.
```
# API: anonymous checks, two-user isolation, profile persistence across a new session, logout/login
SOFITGO_SUPABASE_URL=https://dvrfzeojctnttdkznuqr.supabase.co SOFITGO_SUPABASE_PUBLISHABLE_KEY=sb_publishable_… \
LIVE_A_EMAIL=… LIVE_A_PASSWORD=… LIVE_B_EMAIL=… LIVE_B_PASSWORD=… node tools/live_check.js
# The real app in a browser against the real server (deploy folder with a filled sofitgo-config.js)
APP_DIR=<deploy folder> LIVE_A_EMAIL=… LIVE_A_PASSWORD=… LIVE_B_EMAIL=… LIVE_B_PASSWORD=… node tools/live_app_check.js
```
Behind a proxy, Node needs `NODE_USE_ENV_PROXY=1`.

## Location-text scan (Manali regression)
`node tools/location_scan.js --self-test <archive.zip …>` scans the shipped source, `dist/pwa` and archives as UTF-8. The self-test injects Hebrew and English text to prove that it catches them.
