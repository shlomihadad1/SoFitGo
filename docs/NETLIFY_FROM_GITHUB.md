# פריסת sofitgo.com מ־GitHub (בלי מחשב)

**הענף `netlify-live`:**
- מכיל רק את האתר הבנוי (`site/`, build ‏`74bdd9483f`) ואת הקובץ `netlify.toml`, שמגדיר לפרסם את `site/` ללא שלב בנייה.
- `site/` זהה בייט אחרי בייט ל־`sofitgo-deploy-74bdd9483f-4e23429.zip`.
- קוד המקור, הבדיקות והמסמכים נשארים ב־`fix/default-cuisine`. ‏`main` לא השתנה.

## חיבור חד־פעמי (Netlify, גם מהאייפון)
1. Netlify ← האתר של sofitgo.com ← **Site configuration ← Build & deploy ← Continuous deployment** ← **Link repository**.
2. **GitHub** ← מאשרים גישה ל־`shlomihadad1/SoFitGo`.
3. **Branch to deploy:** ‏`netlify-live`. משאירים את Base directory ואת Build command ריקים, ו־Publish directory: ‏`site`. הקובץ `netlify.toml` קובע את אותם ערכים.
4. **Deploy**.

## מעכשיו
- כל push לענף `netlify-live` מתפרסם. גרסה חדשה = החלפת `site/` בענף הזה, רק אחרי אישור.
- **ביטול:** Netlify ← Deploys ← פריסה קודמת ← **Publish deploy**.
