# SoFitGo — סקירת Migration לאישור הבעלים (טרם הופעל על הפרויקט החי)

| | |
|---|---|
| פרויקט יעד | `dvrfzeojctnttdkznuqr` (Supabase, תוכנית Free) |
| קובץ | `supabase/migrations/20261020000100_sofitgo_beta_core.sql` |
| SHA-256 | ראה `supabase/SHA256SUMS` |
| מצב | **לא הופעל על הפרויקט החי.** נבדק רק על PostgreSQL 16 מקומי עם shim של Supabase. |
| דורש | אישור מפורש שלך לפני הפעלה (אפשרות A או B, בסוף המסמך) |

## 1. מה ה־migration עושה — בשורה אחת
יוצר 4 טבלאות ב־`public`, 3 פונקציות trigger, פונקציה אחת למחיקת חשבון עצמית, מפעיל RLS על כל הטבלאות עם 11 policies, ומצמצם הרשאות API. **לא מוחק דבר, לא משנה טבלאות קיימות, לא נוגע ב־`auth` מלבד foreign keys ל־`auth.users`.** ניתן להרצה חוזרת (idempotent) — נבדק.

## 2. טבלאות

| טבלה | תוכן | מפתח | מגבלות שנאכפות במסד |
|---|---|---|---|
| `profiles` | שם פרטי לתצוגה בלבד | `id` = `auth.users.id` (cascade) | שם 1–30 תווים |
| `user_state` | אזורי הנתונים של האפליקציה כמסמך JSON אחד לכל אזור: `profile`, `workouts`, `nutrition`, `tracking`, `plans` | (`user_id`, `section`) | `user_id` ברירת מחדל `auth.uid()`; section מרשימה סגורה; JSON object בלבד, עד 1MB; `rev` נשלט ע״י השרת; `client_build` hex |
| `bug_reports` | דיווחי באגים/רעיונות מהבודקים | `id` uuid; ייחודי (`user_id`,`client_report_id`) למניעת כפילויות | קטגוריה/חומרה מרשימה סגורה; אורכי שדות; status תמיד `received` בהכנסה; עד 20 דיווחים לשעה למשתמש |
| `app_config` | מתגים ציבוריים: `beta_open` (true), `notice` (null) | `key` | — |

אין טבלת סיסמאות — הסיסמאות מנוהלות רק ע״י Supabase Auth. אין Storage bucket — תמונות נשארות במכשיר בבטא.

## 3. RLS — כל 11 ה־policies

| טבלה | policy | פעולה | תפקיד | תנאי |
|---|---|---|---|---|
| profiles | `profiles_select_own` | SELECT | authenticated | `auth.uid() = id` |
| profiles | `profiles_insert_own` | INSERT | authenticated | check `auth.uid() = id` |
| profiles | `profiles_update_own` | UPDATE | authenticated | using+check `auth.uid() = id` |
| profiles | `profiles_delete_own` | DELETE | authenticated | `auth.uid() = id` |
| user_state | `user_state_select_own` | SELECT | authenticated | `auth.uid() = user_id` |
| user_state | `user_state_insert_own` | INSERT | authenticated | check `auth.uid() = user_id` |
| user_state | `user_state_update_own` | UPDATE | authenticated | using+check `auth.uid() = user_id` |
| user_state | `user_state_delete_own` | DELETE | authenticated | `auth.uid() = user_id` |
| bug_reports | `bug_reports_select_own` | SELECT | authenticated | `auth.uid() = user_id` |
| bug_reports | `bug_reports_insert_own` | INSERT | authenticated | check `auth.uid() = user_id` |
| app_config | `app_config_read` | SELECT | anon, authenticated | `true` |

- `auth.uid()` עטוף ב־`(select …)` (המלצת הביצועים של Supabase).
- ל־bug_reports אין UPDATE/DELETE לבודקים — הסטטוס מנוהל על ידך בלוח הבקרה.
- ל־app_config אין כתיבה דרך ה־API בכלל.

## 4. הרשאות (מעל RLS)
- `revoke all` מ־anon ו־authenticated על 4 הטבלאות, ואז:
  - authenticated: select/insert/update/delete על profiles, user_state; select/insert על bug_reports; select על app_config.
  - anon: select על app_config בלבד.
- פונקציות ה־trigger: execute נשלל מ־public/anon/authenticated.
- `delete_my_account()`: `SECURITY DEFINER`, `search_path=''`, פועלת רק על `auth.uid()` של הקורא; execute ל־authenticated בלבד. מוחקת את המשתמש מ־`auth.users`, וה־cascade מוחק את profiles/user_state/bug_reports שלו.

## 5. Triggers
| trigger | מה הוא מבטיח |
|---|---|
| `profiles_touch` | `updated_at` נקבע ע״י השרת; `created_at` לא ניתן לשינוי |
| `user_state_rev` | בהכנסה rev=1; בעדכון rev=ישן+1 (ערך מהלקוח מתעלם); אי אפשר להעביר שורה למשתמש/אזור אחר |
| `bug_reports_insert` | status נכפה ל־`received`; הגבלת קצב 20/שעה |

## 6. בדיקות קדם ובדיקות אחרי (קריאה בלבד)
- `supabase/checks/preflight_readonly.sql` — להריץ **לפני**: מוודא שאין טבלאות/פונקציות באותם שמות ושיש `auth.users`. בפרויקט ריק: אין שורות בשתי השאילתות הראשונות.
- `supabase/checks/postflight_readonly.sql` — להריץ **אחרי**: 4 טבלאות עם RLS, 11 policies, anon רק קורא app_config, `beta_open=true`.

## 7. תוכנית Rollback — `supabase/rollback/20261020000100_rollback.sql`
| רמה | מה קורה | נתונים | הפיך |
|---|---|---|---|
| 1 — השהיה | `beta_open=false`: האפליקציה עוצרת התחברות וסנכרון ומציגה הודעה | נשמרים | כן, להחזיר ל־true |
| 2 — נעילת API | הסרת כל הרשאות ה־API + השהיה | נשמרים, גלויים לך בלוח הבקרה | כן, הרצה חוזרת של ה־migration |
| 3 — הסרה | מחיקת הטבלאות והפונקציות | **נמחקים** (לא כולל משתמשי Auth) | לא — רק אחרי ייצוא; חסום ב־guard שצריך לערוך ידנית |

אפליקציה: חזרה לגרסה הסטנדרטית (ללא backend) = פריסה מחדש של ה־upload ZIP הקודם; הנתונים המקומיים במכשירים לא נמחקים בהחלפת גרסה (מפתחות `fit30.*` נשמרו).

## 8. מה נבדק ואיפה — הפרדה ברורה

| יכולת | PostgreSQL 16 מקומי (RLS אמיתי) | אמולטור API מקומי + דפדפן (Chromium) | פרויקט Supabase החי |
|---|---|---|---|
| RLS / בידוד A↔B (select/insert/update/delete/forged id/re-key) | ✅ `rls_test` 55/55 | ✅ `e2e_account` (API של B) | ⏳ `live_check` מוכן, לא הורץ |
| הרשמה (ולידציה, הסכמה, אימות מייל נדרש) | — | ✅ | ⏳ |
| התחברות / סיסמה שגויה | — | ✅ | ⏳ |
| התנתקות (מחיקת נתוני מכשיר, ביטול refresh token) | — | ✅ | ⏳ |
| סשן מתמשך (refresh, תפוגה, טוקן שבוטל) | — | ✅ | ⏳ |
| סנכרון (שמירה לשרת, offline→online, מכשיר שני, קונפליקט rev) | ✅ (rev) | ✅ | ⏳ |
| מיגרציית נתונים מקומיים (העלאה/התחלה נקייה/שימוש בחשבון/החלפה, גיבוי, כשל ושחזור) | — | ✅ | ⏳ |
| דיווח באגים (idempotency, הגבלת קצב, status) | ✅ | ✅ | ⏳ |
| מחיקת חשבון (cascade) | ✅ | ✅ | ⏳ |
| מתג השהיית בטא | ✅ | ✅ | ⏳ |
| Rollback 1/2/3 | ✅ `rollback_test` 28/28 | — | ⏳ |
| שליחת מיילים בפועל (אימות/איפוס) | — | מדומה | ⏳ תלוי בהגדרות Auth/SMTP |
| Safari ב־iPhone אמיתי | — | ❌ (Chromium בלבד) | ⏳ |

✅ עבר · ⏳ ממתין לאישור/הרשאה · ❌ לא נבדק בסביבה זו

**האמולטור המקומי אינו Supabase.** הוא מממש את אותם endpoints (GoTrue/PostgREST) מעל PostgreSQL אמיתי עם אותן הרשאות ו־RLS, כדי שהקוד ייבדק מקצה לקצה. הבדלים אפשריים מול השירות האמיתי (פורמט הודעות שגיאה, מגבלות מיילים, rate limits של Auth) ייבדקו רק ב־`live_check` ובבדיקה ידנית.

## 9. הגדרות Auth שצריך לקבוע בלוח הבקרה (לא דרך SQL)
1. Authentication → URL Configuration: **Site URL** = כתובת אתר הבטא החדש (לא RC4 ולא admirable-lokum); **Redirect URLs** = אותה כתובת.
2. Authentication → Providers → Email: Email enabled; **Confirm email = ON**; Minimum password length = **8**.
3. בטא סגורה: להשאיר הרשמה פתוחה רק לבודקים — או לכבות "Allow new users to sign up" ולהזמין ידנית (Users → Invite).
4. מגבלת מיילים ב־Free עם ה־SMTP המובנה נמוכה מאוד (מספר מיילים בודד לשעה, ולכתובות של חברי הצוות בלבד לפי מדיניות Supabase העדכנית). לבטא עם יותר מבודקים בודדים: Custom SMTP (למשל ספק מייל קיים שלך) או יצירת משתמשים ידנית עם Auto Confirm. **יש לאמת את המגבלה העדכנית בלוח הבקרה** — היא משתנה.

## 10. אפשרויות הפעלה — הבחירה שלך
- **A (מומלץ, בלי לתת לי גישה):** אתה מריץ בעצמך ב־SQL Editor: preflight → migration → postflight, ושולח לי רק את הפלט של postflight (אין בו סודות).
- **B:** אתה מאמת את Supabase MCP (`/mcp` → supabase → Authenticate) בסשן חדש של Claude Code; אני מריץ preflight (קריאה בלבד), מציג לך את הפלט, ורק אחרי "מאשר" מפורש מפעיל את ה־migration ומריץ postflight.

בשתי האפשרויות, אחר כך: `live_check` (חלק 1 דורש רק URL + publishable key; חלק 2 דורש שני משתמשי בדיקה שאתה יוצר, עם סיסמאות שנשארות אצלך כ־env vars).
