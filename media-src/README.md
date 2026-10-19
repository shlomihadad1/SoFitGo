# media-src — מקור לנכסי מדיה

כאן מניחים קבצי מקור של צילומים וסרטונים שיש עליהם רישיון שימוש. אחר כך מריצים:

    node tools/media_build.js

הכלי מכווץ את הקבצים, נותן להם שמות עם hash, מעדכן את `src/data/media.js` ואת `MEDIA-MANIFEST.json`, ודוחה כל נכס שחסרים בו מקור, רישיון או אישור התאמה.

## credits.json

```json
{
  "exercises": {
    "squat": { "video": { "mp4": "ex/squat.mp4", "webm": "ex/squat.webm", "poster": "ex/squat.jpg",
      "source": "צילום עצמי / https://…", "author": "שם", "license": "original | CC0-1.0 | CC-BY-4.0 | CC-BY-SA-4.0 | Pexels | Unsplash | Pixabay | licensed",
      "licenseUrl": "https://…", "matches": true, "note": "" } }
  },
  "recipes": {
    "chicken_curry_rice": {
      "photo": { "file": "rc/chicken_curry_rice.jpg", "source": "…", "author": "…", "license": "…", "licenseUrl": "…", "matches": true },
      "prep":  { "mp4": "rc/chicken_curry_rice.mp4", "poster": "rc/chicken_curry_rice-prep.jpg", "source": "…", "author": "…", "license": "…", "licenseUrl": "…", "matches": true },
      "steps": [ { "step": 2, "file": "rc/ccr-step2.jpg", "source": "…", "author": "…", "license": "…", "licenseUrl": "…", "matches": true } ]
    }
  }
}
```

## כללים

- `matches: true` הוא אישור שהמדיה מציגה **בדיוק** את התרגיל או המנה הזו. אי אפשר להשתמש בסרטון אחד לכמה תרגילים.
- **סרטון:**
  - קובץ MP4 בקידוד H.264 או HEVC הוא חובה, כי Safari באייפון צריך אותו. קובץ WebM הוא רשות.
  - כל קובץ עד 6MB ועד 45 שניות.
  - חובה תמונת שער.
- **תמונה:** עד 8MB. הכלי מפיק ממנה WebP ברוחב 480 ו־960 פיקסלים: יחס 4:3 למנות ו־16:9 לשערי סרטונים.
- **רישיונות CC-BY ו־CC-BY-SA** מחייבים קרדיט, והוא מוצג במסך "מצב מדיה".
