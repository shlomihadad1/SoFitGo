# fit30-rc5-dev — עותק פיתוח לגרסה הבאה

- **נפתח מ־** RC4 (build `3144d19f68`), 2026-10-19. **RC4 הוא הגרסה היציבה** — `Fit30-Release-Candidate-4.zip`.
- לא פורסם, לא נפרס ולא ב־git.
- **הבא בתור (לפי עדיפות):**
  1. ממצאים מבדיקת המכשיר — אחרי שתהיה כתובת HTTPS (DR-11).
  2. DR-01 — ערך הגבול והמדד, אחרי תשובה מקצועית.
  3. TD-11 — תקציב הגודל (4,637 בתים פנויים) לפני כל תוספת קוד.

## 2026-10-19 12:08 — הכתובת מ־Netlify Drop
- `https://chipper-muffin-23b1e8.netlify.app` — כל הקבצים (index.html, ‏sw.js, ‏manifest) מחזירים **HTTP 401** ומפנים ל־app.netlify.com/edge-access, דף "Team protection — This site is private. Sign in".
- `deploy_check` על הכתובת: 2/3. האפליקציה עצמה לא נבדקה — היא לא נגישה.
- **תיקון בכלי (rc5-dev בלבד):** `deploy_check` קרס על דף התחברות (null). עכשיו הוא מדווח "page is the Fit30 app" כנכשל ועוצר. בנוסף הוא משתמש ב־proxy של הסביבה לכתובות מרוחקות. מקומית: 30/1 (רק HTTPS).
