# SoFitGo RC5 (dev) — בעיות ידועות

> **עודכן ל־RC5 M8:**
> - B-4: תוקן תיאור הממצא. לפי התיעוד של Netlify יש הגדרה לכיבוי התג.
> - B-6: נוסף מלאי נכסים גרפיים.
> - נוספו B-9 ו־B-10.
> - TD-11: הגודל קטן.
>
> מזהה הבנייה נמצא ב־`TEST-RESULTS-M8.md`.

**סולם החומרה:**
- **P0** — בטיחות או נתונים
- **P1** — התאמה אישית או חישוב
- **P2** — תוכן או שימושיות
- **P3** — ליטוש

אין בעיות P0 פתוחות שידועות לנו.

## חוסמים לשחרור
| # | בעיה | מה נדרש |
|---|---|---|
| B-1 | **לא נבדק במכשיר אמיתי.** לא נבדקו iPhone, ‏iPad, ‏Safari ו־VoiceOver. כל הבדיקות רצו ב־Chromium שמדמה מכשיר | כתובת HTTPS ואדם עם מכשיר — ראו `BETA-INSTALL.md` |
| B-2 | **אין כתובת HTTPS.** בלעדיה אין התקנה למסך הבית, ואין עבודה בלי אינטרנט ב־iPhone | פעולה אחת שלך — `BETA-INSTALL.md` §1 |
| B-3 | **ניגון סרטוני ההדרכה (H.264) לא נבדק.** ה־Chromium בסביבה לא מפענח H.264 | בדיקה ב־Safari |
| B-4 | **התג של Netlify מכסה 3 מתוך 5 הלשוניות בסרגל התחתון** — בית, לוח ואימונים. הוא גם תופס את הלחיצות עליהן. מאומת ב־Chromium באתר החי. **תיקון ב־M8:** התיעוד הרשמי של Netlify מתאר הגדרה לכיבוי התג בכל פרויקט בנפרד (Project configuration → General → Powered by Netlify badge). לא ידוע אם ההגדרה זמינה בתוכנית החינמית | החלטה שלך (D-2): לבדוק את ההגדרה בממשק של Netlify, לעבור לתוכנית בתשלום, או לעבור ל־Cloudflare Pages. הפירוט ב־`docs/HOSTING-AND-NETLIFY-BADGE.md`. אסור לי להסתיר את התג ב־CSS |
| B-5 | **הכותרת שנעלמת ב־iPhone Safari (P0-E):** ב־M7 בוצע תיקון מבני (הכותרת צובעת בעצמה את אזור שורת המצב). לא אומת במכשיר | בדיקה במכשיר לפי `SAFARI-DEVICE-CHECKLIST.md` |
| B-6 | **הלוגו לא אושר. אין תמונות של Sofit ברזולוציה גבוהה.** קובצי הלוגו שהתקבלו ב־M8 הם תמונות JPEG שטוחות של S נטוי, ואי אפשר להשתמש בהם כאייקון | לוגו וקטורי מאושר, אייקון בגודל 1024, ודיוקנאות של Sofit ברזולוציה של 512 פיקסלים לפחות. הפירוט ב־`docs/ASSET-INVENTORY-M8.md` |
| B-6a | **הלוגו בכותרת זמני.** הקובץ נוקה מתוך תמונה שחולצה מלוח מצגת, ואינו הקובץ המקורי. לא סופק קובץ וקטורי, וגם לא אייקון ריבועי נקי לאפליקציה | הקובץ הווקטורי המקורי של הלוגו (SVG, PDF או AI) ואייקון ריבועי ברזולוציה 1024×1024. הפירוט ב־`CHANGES-M9-IDENTITY.md` |
| B-9 | **צ׳אט עם Sofit:** מוצג כלא זמין, כי אין שירות AI | החלטה D-4 |
| B-10 | **קלוריות שנשרפו:** מוצגות כ"לא נמדד", כי אין מקור מדידה | אפליקציה מקורית ואישור לקריאת "אנרגיה פעילה" (עתידי) |
| B-7 | **Apple Health / Health Connect:** הקוד מוכן ונבדק רק בהדמיה. אין עדיין אפליקציה מקורית וחיבור אמיתי | Mac עם Xcode, מכשיר, וחשבון מפתח (D-6). ראו `native/README-NATIVE.md` |
| B-8 | **Minimum Mode, Equipment Passport:** לא מומשו — דורשים תוכן אימון שעבר סקירה מקצועית | DR-01, DR-03, TD-03 |

## פתוחות במוצר
| # | חומרה | בעיה | מצב |
|---|---|---|---|
| TD-03 | P1 | **ציוד מתקדם** (משקולות, גומיות, מתח, חדר כושר) לא משפיע על התוכנית. התוכנית אומרת זאת במפורש | ממתין לתוכן ולסקירה מקצועית (DR-04) |
| TD-04 | P1 | **פרופיל טבעוני בלי סויה ובוטנים:** ממוצע 111.6 מתוך 130 ג׳ חלבון. הפער מוצג בכל יום | DR-02 |
| TD-15 | P1 | **מחיקת נתונים ב־Safari:** כשהאפליקציה פתוחה מלשונית ולא הותקנה, Safari עלול למחוק את הנתונים אחרי 7 ימים בלי שימוש | להתקין למסך הבית ולגבות. DEC-008 |
| TD-05 | P2 | **יעדים גבוהים מאוד:** ב־3,700 קק״ל התפריט מגיע בממוצע ל־91.5%. הפער מוצג | מוצהר |
| TD-06 | P2 | **חלבון לפי משקל כולל** — שאלה מקצועית פתוחה במשקל גבוה | DR-02 |
| TD-07 | P2 | **מתחילים מקבלים 2 סטים בכל השלבים**, כולל השלב "הגדלת נפח" | DR-03 |
| TD-08 | P2 | **מדד העלייה ההדרגתית** — סטים × חזרות, וגבול של +25% — הוא ברירת מחדל הנדסית, לא כלל מקצועי מאומת | DR-01 |
| — | P2 | **תרגיל בודד יכול לקפוץ עד פי 3.75,** כשהאימון כולו בתוך הגבול | DR-01 |
| — | P2 | **אחרי יום מוקל** (R-DOWN), האימון הבא משווה לנקודת ייחוס נמוכה יותר | DR-01 |
| TD-16 | P2 | **אין סרטונים ל־57 תרגילים ול־140 מתכונים.** יש איורים ושלבים כתובים | DR-05 |
| TD-17 | P2 | **אין מקור לכל מזון בנפרד** — רק הערה כללית | — |
| TD-14 | P2 | **תזכורות:** יצוא ליומן (`.ics`) קיים רק לתוכנית הקלאסית | DR-14 |
| TD-11 | P3 | **תקציב הגודל:** 712,000 בתים. ב־M8 קובץ ה־index שוקל 696,683 בתים (ירידה מ־701,701). מסכי המסלולים, המדיה, Sofit והנסיעות נטענים בנפרד (`extra.js`) | DR-12 |
| M8-1 | P3 | **הסתרת התפריט התחתון בזמן הקלדה** לא נבדקה ב־iPhone. המנגנון הוא מחלקה `body.kb` שמתווספת ב־`main.js` וחוזרת 400 מילישניות אחרי היציאה מהשדה. (תיקון תיעוד ב־M9: נוסח קודם תיאר את גרסת `:has` שהוחלפה) | בדיקה במכשיר |
| M8-2 | P3 | **צעדים שנמחקו באפליקציית Health** נשארים בתוך האפליקציה עד שמוחקים את הצעדים שיובאו (יום עם 0 צעדים לא דורס ערך קיים) | מוצהר ב־`native/APPLE-HEALTH-VERIFICATION.md` |
| M8-3 | P2 | **מתכונים:** ל־144 אין שדה מקור, ל־17 לא צוין ציוד, ל־7 מבושלים יש שלב אחד בלבד, וזוג אחד כפול (`edamame_snack` = `x_edamame`) | לא שונה בלי אישור (D-1) |
| TD-13 | P3 | עברית בלבד; אין שכבת תרגום | — |

## שימו לב בבדיקת בטא
- **כתובת חדשה מתחילה בלי נתונים.** אפשר להעביר נתונים בגיבוי ושחזור (הגדרות).
- **תמונות התקדמות** לא נכללות בגיבוי. האפליקציה אומרת את זה כשמגבים.
- **סרטוני ההדרכה** נטענים מהרשת. בלי חיבור מוצג טקסט.

## M10 Beta (build e11ee266ea) — known issues
- **Cloud accounts are not live.** The migration has not been applied to Supabase project dvrfzeojctnttdkznuqr and no publishable key is configured. The deployable build stores data on the device only (as in M9).
- Account, sync and migration flows were verified only against a local emulator (real PostgreSQL + RLS) in Chromium, not against hosted Supabase. Email delivery (confirmation and reset) is untested; on the Free plan the built-in SMTP is heavily rate-limited.
- No real-iPhone or Safari verification of the M10 changes (keyboard behaviour in particular).
- Nutrition-only mode: the "אימונים" tab is still visible. Its screens remain usable but are not hidden.
- Photos (profile and progress) stay on the device and are not synced.
- Sofit AI remains unavailable (no paid API). The native iOS/Android apps have not been built.
- Privacy notice and beta terms (#/legal) are drafts with [להשלים] placeholders. Legal review is required.

## M10.1 (build a3701822bf)
- Accounts: the UI and the client are complete, but live sign-up is BLOCKED until the owner approves and applies the SQL and fills `sofitgo-config.js`. Until then, הרשמה/התחברות open an honest "not switched on" screen.
- Hydration target is an estimate (weight/age/activity/workout). There is no weather or location input, by design.
- Workout duration explanation (e.g. "22 דק׳") and the wording of "daily target": not re-audited in this release.
- Safari header stability: tested only in Chromium with simulated safe-area insets (e2e_shell). Needs real-device confirmation.
