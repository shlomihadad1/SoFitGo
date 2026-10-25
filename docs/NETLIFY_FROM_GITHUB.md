# פריסת sofitgo.com מ־GitHub (בלי מחשב)

**הענף `netlify-live`** (מצב 25.10.2026):
- עומד על `0c4d08e`, ‏build ‏`f1248e1201`, שנבנה מ־`73ff796`.
- הוא קודם במקום `910d927` (build ‏`74bdd9483f`).
- מכיל רק את האתר הבנוי (`site/`) ואת `netlify.toml`, שמגדיר לפרסם את `site/` ללא שלב בנייה.
- **האתר החי מגיש היום `74bdd9483f`, זהה בייט אחרי בייט ל־`910d927`.** ב־GitHub אין אף סטטוס Netlify על `910d927` ועל `0c4d08e`. לכן ההנחה היא שהאתר הועלה ידנית ולא מחובר למאגר. **זו הנחה; רק לוח הבקרה של Netlify יכול לאשר אותה.**
- קוד המקור, הבדיקות והמסמכים נשארים ב־`fix/default-cuisine`. ‏`main` לא השתנה.

## חיבור חד־פעמי בטוח (Netlify, גם מהאייפון)
**חשוב:** חיבור המאגר מפעיל פריסה מיד מהקצה של `netlify-live`. אם הפרסום האוטומטי פעיל, `f1248e1201` עולה לאוויר מיד. לכן נועלים קודם.

1. Netlify ← האתר של sofitgo.com ← **Deploys** ← **Stop auto publishing** (או "Lock to stop auto publishing").
   - מעכשיו פריסות נבנות, אבל **לא** מתפרסמות עד שלוחצים **Publish deploy**.
2. **Site configuration ← Build & deploy ← Continuous deployment** ← **Link repository** ← **GitHub** ← מאשרים גישה ל־`shlomihadad1/SoFitGo` בלבד.
3. **ערכי ההגדרה:**
   - Branch to deploy: ‏`netlify-live`
   - Base directory: ריק
   - Build command: ריק
   - Publish directory: ‏`site`
   - הקובץ `netlify.toml` קובע את אותם ערכים.
4. **באותו מסך:**
   - **Branch deploys:** ‏"Deploy only the production branch".
   - **Deploy Previews:** ‏"None". ב־PR מענפי הקוד אין `site/`, ולכן תצוגה מקדימה הייתה נכשלת.
5. **Deploy**, ואז כותבים לי "חיברתי".
   - אני בודק את הפריסה החדשה בכתובת הייחודית שלה, לפי `PRODUCTION_VERIFICATION.md`.
   - אחרי אישורך לוחצים עליה **Publish deploy**.

**עלות:** תוכנית חינמית. שלב הבנייה הוא `echo` בלבד, שניות בודדות של דקות בנייה.

## מעכשיו
- כל push לענף `netlify-live` מתפרסם. גרסה חדשה = החלפת `site/` בענף הזה, רק אחרי אישור.
- **ביטול:** Netlify ← Deploys ← פריסה קודמת ← **Publish deploy**.
