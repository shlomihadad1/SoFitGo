# הפעלת מערכת הניהול והחשבונות באתר החי — הוראות מדויקות

**עודכן 25.10.2026.** הגרסה: build ‏`74bdd9483f`, קוד `d246052`.

**כל שלב כאן הוא שינוי בייצור, ודורש את אישורך ואת ביצועך.** לא בוצע אף אחד מהם.

**לפני שמתחילים, הסדר הוא:**
1. גיבוי.
2. בדיקה מקדימה.
3. migrations.
4. בדיקה אחרי.
5. הגדרת כתובות האתר.
6. פריסה.
7. הרשמה.
8. בעלים.
9. כניסה.

**נבדק מקומית, בלי השרת החי (`tools/migration_audit_test.js`, ‏35/35):**
- המסד המקומי משחזר את הסכמה החיה, עם נתוני משתמשים.
- שלושת ה־migrations נכנסים בלי לשנות שום שורה קיימת, והרצה כפולה לא משנה כלום.
- rollback בסדר הפוך מחזיר בדיוק את הסכמה, ההרשאות ומדיניות ה־RLS שהיו לפני כן.
- rollback בסדר שגוי נחסם, ולא משנה כלום.

הרשאות השרת נבדקות ב־`rls_cms_test` ‏(99/99) וב־`e2e_admin` ‏(56/56).

## 0. זיהוי הפרויקט
- **Supabase Dashboard:** הפרויקט שכתובתו מתחילה ב־`https://dvrf…supabase.co`. זו הכתובת שמופיעה ב־`sofitgo-config.js` שבחבילת הפריסה.
- **Netlify:** האתר שמגיש את `sofitgo.com`. ‏`www` מפנה אליו.
- **מצב נוכחי (נבדק בקריאה בלבד ב־25.10.2026):**
  - האתר מריץ את `74bdd9483f` בחבילה **בלי** שרת.
  - טבלאות החשבונות קיימות (`profiles`, ‏`user_state`, ‏`bug_reports`).
  - טבלאות הניהול **לא** קיימות.

## 1. גיבוי (חובה, ומבוצע אצלך)
לי אין גישה ל־Dashboard או לסיסמת המסד, ולכן **אין כרגע גיבוי שנעשה על ידי.**

**אפשרות א — מה־Dashboard:**
1. Database ← Backups.
2. אם התוכנית כוללת גיבויים, מוודאים שיש גיבוי מהיום. אחרת ממשיכים לאפשרות ב.

**אפשרות ב — קובץ גיבוי במחשב שלך** (Supabase CLI, חינמי):
```
brew install supabase/tap/supabase
supabase db dump --db-url "postgresql://postgres:<DB-PASSWORD>@db.<project-ref>.supabase.co:5432/postgres" -f sofitgo-schema.sql
supabase db dump --db-url "postgresql://postgres:<DB-PASSWORD>@db.<project-ref>.supabase.co:5432/postgres" --data-only -f sofitgo-data.sql
```
- את `<DB-PASSWORD>` ואת `<project-ref>` לוקחים מ־Project Settings ← Database.
- **הסיסמה מוקלדת רק אצלך, לא בצ'אט.**
- הנתונים במסד הזה כוללים את טבלאות `auth`, כלומר משתמשים ומיילים. לכן שומרים את הקבצים במקום מוצפן.

**בדיקה שהגיבוי תקין:**
- שני הקבצים לא ריקים;
- `grep -c "CREATE TABLE" sofitgo-schema.sql` מחזיר יותר מ־0;
- `grep -c "user_state" sofitgo-data.sql` מחזיר יותר מ־0.

## 2. בדיקה מקדימה (קריאה בלבד)
ב־SQL Editor:
```sql
select to_regclass('public.user_state') as accounts_table,   -- צפוי: user_state (קיים)
       to_regclass('public.cms_content') as cms_table,       -- צפוי: ריק (עוד לא הוחל)
       (select count(*) from auth.users) as accounts;        -- כמה חשבונות יש היום
```
**מה זה בודק:** שזה הפרויקט הנכון ושה־CMS עוד לא הוחל.
- אם `cms_table` לא ריק, עוצרים ומדווחים לי.

## 3. החלת ה־migrations (שינוי בייצור)
ב־SQL Editor פותחים New query, מדביקים את **כל** תוכן הקובץ ולוחצים Run. מריצים לפי הסדר:

| # | קובץ | מה הוא עושה | נוגע בנתונים קיימים? |
|---|---|---|---|
| 1 | `20261025000100_sofitgo_cms.sql` | יוצר 4 טבלאות: `cms_members` (תפקידים), `cms_content` (תוכן שפורסם), `cms_drafts` (טיוטות), `cms_revisions` (היסטוריה ויומן). מפעיל RLS על כולן. יוצר פונקציות פרסום שבודקות תפקיד בשרת. נותן קריאה ציבורית רק לתוכן שפורסם | לא |
| 2 | `20261025000200_sofitgo_admin_feedback.sql` | מוסיף ל־`bug_reports` שלוש עמודות ריקות לטיפול הצוות: `admin_note`, ‏`handled_at`, ‏`handled_by`. יוצר שתי פונקציות למנהלים בלבד: רשימת דיווחים ושינוי סטטוס | מוסיף עמודות ריקות. שורות קיימות לא משתנות |
| 3 | `20261025000300_sofitgo_admin_accounts.sql` | יוצר פונקציה אחת למנהלים בלבד, שמחזירה מספרים מצטברים בלבד | לא |

- **אף אחד מהם לא יוצר משתמש, סיסמה או בעלים.**
- **אם הרצה נכשלת באמצע:** כל קובץ אפשר להריץ שוב, והרצה חוזרת נבדקה ובטוחה. מתקנים את הסיבה ומריצים שוב את אותו קובץ.

## 4. בדיקה אחרי (קריאה בלבד)
```sql
select to_regclass('public.cms_content') is not null as cms_ok,                                  -- true
       (select bool_and(relrowsecurity) from pg_class
         where relnamespace = 'public'::regnamespace
           and relname in ('cms_content','cms_drafts','cms_revisions','cms_members')) as rls_on, -- true
       (select count(*) from public.cms_members) as members,                                    -- 0 (עוד אין בעלים)
       to_regprocedure('public.cms_feedback_list(text, text, integer, integer)') is not null as feedback_ok,  -- true
       to_regprocedure('public.cms_accounts_overview()') is not null as accounts_ok,             -- true
       (select count(*) from auth.users) as accounts;                                            -- אותו מספר כמו בשלב 2
```

## 5. כתובות האתר באימות (Authentication)
Authentication ← URL Configuration:
- **Site URL:** `https://sofitgo.com`.
- **Redirect URLs:** להוסיף `https://sofitgo.com/**`.

**למה:** קישור אימות המייל ואיפוס הסיסמה צריכים לחזור לאתר הנכון. את ההגדרה הזו לא יכולתי לבדוק מכאן.

## 6. פריסה ל־Netlify (שינוי בייצור)
1. מורידים את `sofitgo-deploy-74bdd9483f-d246052.zip`, החבילה הנקייה. בודקים:
   - `shasum -a 256` מחזיר את הערך שב־`docs/release/`.
   - היא **לא** כוללת `serve_beta.py`, מדריכים או `README.txt`.
2. פורקים את החבילה. נוצרת תיקייה `sofitgo`.
3. ב־Netlify: האתר ← **Deploys** ← גוררים את התיקייה `sofitgo` לאזור "Drag and drop your site output folder here".
4. **בדיקה אחרי הפריסה:**
   - `https://sofitgo.com/sw.js` מכיל `fit30-74bdd9483f`.
   - `https://sofitgo.com/sofitgo-config.js` מכיל כתובת `supabaseUrl` שאינה ריקה.
   - `https://sofitgo.com/serve_beta.py` מחזיר 404.
5. **הנתונים של משתמשים** נשמרים: הכתובת לא השתנתה.

## 7. הרשמה
1. `https://sofitgo.com/#/account` ← הרשמה עם המייל שלך.
2. מאשרים את המייל.
3. מתחברים.

## 8. מתן תפקיד בעלים (שינוי הרשאות בייצור, פעם אחת)
ב־SQL Editor. מחליפים את `YOUR-EMAIL` במייל שלך, פעמיים:
```sql
insert into public.cms_members (user_id, role)
select id, 'owner' from auth.users where email = 'YOUR-EMAIL'
on conflict (user_id) do nothing;

select u.email, m.role, m.granted_at
from public.cms_members m join auth.users u on u.id = m.user_id;   -- צפויה שורה אחת: המייל שלך · owner
```
**מה זה עושה:**
- מוסיף שורה אחת: המשתמש שלך מקבל את התפקיד `owner`.
- אם המייל לא קיים, לא נוסף כלום, והשאילתה השנייה תחזיר 0 שורות. במקרה כזה בודקים שההרשמה הושלמה.
- זו הדרך היחידה ליצור בעלים: אין דרך כזו דרך האפליקציה או ה־API.

## 9. כניסה לניהול
`https://sofitgo.com/#/admin`, או בתוך האפליקציה: הגדרות ← "ניהול תוכן (לצוות מורשה בלבד)".
- בראש המסך צריך להופיע **"מחובר/ת כ־בעלים"**.
- הסבר על כל לשונית: `docs/ADMIN_USER_GUIDE.md`.

## 10. ביטול (Rollback)
**לפני ביטול:** כל תוכן שפורסם דרך הניהול נמחק ב־rollback של 0100. לכן מייצאים או מתעדים אותו קודם.

**Supabase — בסדר הפוך בלבד:**
1. `supabase/rollback/20261025000300_rollback.sql`: מסיר את פונקציית הסקירה. אין אובדן נתונים.
2. `supabase/rollback/20261025000200_rollback.sql`: מסיר את פונקציות המשוב ואת עמודות הטיפול. הדיווחים והסטטוס שלהם נשארים. **הערות הצוות נמחקות.**
3. `supabase/rollback/20261025000100_rollback.sql`: מסיר את טבלאות הניהול. **תוכן שפורסם, תפקידים ויומן נמחקים.** האפליקציה חוזרת לתוכן המובנה שלה.
   - אם מריצים אותו לפני 1 ו־2, הוא מסרב ולא משנה כלום.

**Netlify:** Deploys ← בוחרים את הפריסה הקודמת ← **Publish deploy**.

## 11. בדיקה אחרי ההפעלה
| # | בדיקה | צפוי |
|---|---|---|
| P1 | חשבון שני, בלי תפקיד, נכנס ל־`#/admin` | "אין לך הרשאת ניהול" |
| P2 | הבעלים נותן לחשבון השני "עורך/ת" בלשונית הרשאות | העורך שומר טיוטה, ו**לא** יכול לפרסם |
| P3 | פרסום שינוי טקסט קטן, ואז "היסטוריה וגרסאות", ואז חזרה לגרסה הקודמת | שני הצעדים מופיעים ביומן השינויים |
| P4 | משתמש שולח דיווח (הגדרות ← משוב). המנהל מסמן אותו "בבדיקה" | המשתמש רואה את הסטטוס החדש |
| P5 | לשונית חשבונות | המספר כולל את שני החשבונות, ואין בה מיילים |
| P6 | התחברות, יציאה ואיפוס סיסמה | כל קישור במייל חוזר ל־`sofitgo.com` |
| P7 | סנכרון: אותו חשבון בשני מכשירים | הנתונים מופיעים בשניהם, ובמקרה של קונפליקט מוצגת בחירה |
| P8 | iPhone ו־Android | `docs/DEVICE_TEST_PLAN.md`, בדיקות T1–T19 |

## 12. פעולות שדורשות את אישורך
- שלב 3: migrations בייצור.
- שלב 5: הגדרות האימות.
- שלב 6: פריסה.
- שלב 8: יצירת בעלים.
- שלב 10: כל rollback.
- כל שינוי נתונים ידני.
