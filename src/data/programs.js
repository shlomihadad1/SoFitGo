/* Program templates (Stage A). A template is not a fixed plan: the planner (src/js/planner.js) turns it into a
   calendar for a specific profile (available days, minutes, equipment, level, goal, exclusions).
   phases[].w = relative length (weeks for fixed templates; scaled proportionally for other lengths).
   Every template states who it is for, goals, duration, sessions/week, minutes, equipment, nutrition principles,
   adaptation options and limitations, so the catalog screen can show them before anything is started. */
(function (root) {
  'use strict';
  const GOALS = {
    fat_loss: 'ירידה באחוזי שומן', weight_loss: 'ירידה במשקל', muscle: 'בניית שריר', gain: 'עלייה במשקל ובמסת שריר', recomp: 'חיטוב והרכב גוף',
    strength: 'שיפור כוח', endurance: 'שיפור סיבולת', general: 'כושר כללי', mobility: 'ניידות וגמישות', habits: 'הרגלי תזונה ואימון',
    maintain: 'שמירה על התוצאות', return: 'חזרה הדרגתית לאימונים', beginner: 'תוכנית למתחילים'
  };
  const PHASE_KINDS = {
    intro: { he: 'היכרות, בסיס והרגלים', vol: 0.8, dcap: 0, focus: 'טכניקה, הרגל קבוע, עומס נמוך' },
    base: { he: 'בניית בסיס כוח וסיבולת', vol: 1, dcap: 1, focus: 'נפח בינוני, התקדמות בחזרות' },
    volume: { he: 'הגדלת נפח', vol: 1.15, dcap: 1, focus: 'יותר סטים, מנוחות קצרות יותר' },
    advanced: { he: 'שלב מתקדם לפי המטרה', vol: 1.1, dcap: 2, focus: 'וריאציות קשות יותר, דגש על המטרה' },
    assess: { he: 'הערכה, התאמה ושינוי דגשים', vol: 0.8, dcap: 1, focus: 'מבחני כושר, שבוע קל, החלטה על המשך' },
    maintain: { he: 'שימור והמשך התקדמות', vol: 0.95, dcap: 2, focus: 'שימור תוצאות, גיוון, מעבר למטרה חדשה' }
  };
  const T = (o) => Object.assign({ equipment: ['none'], spw: 3, minutes: 30, level: 'beginner', available: true }, o);
  const TEMPLATES = [
    T({ id: 'fit30_classic', he: 'התוכנית הקלאסית — 30 יום (התוכנית הנוכחית)', days: 30, classic: true, goals: ['general', 'fat_loss'], spw: 6, minutes: 30, audience: 'מתחילים־בינוניים, בבית, ללא ציוד.', nutrition: 'התפריט היומי הקיים (30 יום) עם יעדי קלוריות וחלבון מהפרופיל.', adapt: 'גרסאות 15/30/60 דקות לכל יום, החלפת תרגילים, רמות קושי.', limits: 'תוכנית קבועה של 30 יום; לא מתארכת אוטומטית.' }),
    T({ id: 'start_7', he: '7 ימים — התחלה', days: 7, goals: ['beginner', 'habits'], spw: 3, minutes: 20, phases: [{ k: 'intro', w: 1 }], audience: 'מי שלא התאמן לאחרונה ורוצה להתחיל בקטן.', nutrition: 'יעדי קלוריות וחלבון בסיסיים; ארוחה מסודרת אחת נוספת ביום.', adapt: 'ימים זמינים, משך 15–30 דק׳.', limits: 'קצרה מכדי לשנות הרכב גוף — מטרתה הרגל.' }),
    T({ id: 'habits_30', he: '30 ימים — בניית הרגלים', days: 30, goals: ['habits', 'general'], spw: 3, minutes: 25, phases: [{ k: 'intro', w: 2 }, { k: 'base', w: 2.3 }], audience: 'מתחילים; מי שחוזר אחרי הפסקה.', nutrition: 'שגרת ארוחות קבועה, חלבון בכל ארוחה, שתייה.', adapt: '2–4 אימונים בשבוע, 15–40 דק׳.', limits: 'עומס מתון בכוונה.' }),
    T({ id: 'fatloss_30', he: '30 ימים — ירידה בשומן', days: 30, goals: ['fat_loss', 'weight_loss'], spw: 4, minutes: 35, phases: [{ k: 'intro', w: 1 }, { k: 'base', w: 2 }, { k: 'volume', w: 1.3 }], audience: 'בעלי ניסיון בסיסי שרוצים להאיץ ירידה בשומן.', nutrition: 'גירעון קלורי מתון (כ־15–20%), חלבון גבוה, צעדים יומיים.', adapt: 'ימים, משך, החלפת אימוני לב־ריאה בהליכה.', limits: 'קצב ירידה משתנה בין אנשים; אין הבטחת תוצאה.' }),
    T({ id: 'general_60', he: '60 ימים — בסיס והתקדמות', days: 60, goals: ['general', 'recomp', 'fat_loss'], spw: 4, minutes: 35, phases: [{ k: 'intro', w: 2 }, { k: 'base', w: 3 }, { k: 'volume', w: 3.6 }], audience: 'מי שרוצה יותר מחודש אחד אבל עדיין לא מחויבות ארוכה.', nutrition: 'לפי המטרה.', adapt: 'ימים, משך, ציוד.', limits: '—' }),
    T({ id: 'strength_90', he: '90 ימים — בניית כוח', days: 90, goals: ['strength', 'muscle'], spw: 4, minutes: 45, level: 'intermediate', phases: [{ k: 'base', w: 4 }, { k: 'volume', w: 4 }, { k: 'advanced', w: 4 }, { k: 'assess', w: 0.9 }], audience: 'מתאמנים עם בסיס של כמה חודשים.', nutrition: 'קלוריות סביב שימור או עודף קל, חלבון 1.6–2.2 ג׳/ק״ג.', adapt: 'ציוד, ימים, משך; שבוע קל כל 4 שבועות.', limits: 'בספרייה הנוכחית רק תרגילי משקל גוף וציוד ביתי — ההתקדמות בכוח מוגבלת בלי משקולות.' }),
    T({ id: 'general_90', he: '90 ימים — כושר כללי', days: 90, goals: ['general', 'endurance'], spw: 4, minutes: 35, phases: [{ k: 'intro', w: 2 }, { k: 'base', w: 4 }, { k: 'volume', w: 4 }, { k: 'assess', w: 2.9 }], audience: 'כל מי שרוצה כושר טוב יותר לחיי היום־יום.', nutrition: 'מאוזנת, יעד לפי המטרה המשנית.', adapt: 'ימים, משך, ציוד.', limits: '—' }),
    T({ id: 'progress_6m', he: '6 חודשים — התקדמות הדרגתית', days: 182, goals: ['recomp', 'general'], spw: 4, minutes: 40, phases: [{ k: 'intro', w: 4 }, { k: 'base', w: 6 }, { k: 'volume', w: 6 }, { k: 'advanced', w: 6 }, { k: 'assess', w: 4 }], audience: 'מי שמחויב לחצי שנה של שינוי הרכב גוף.', nutrition: 'מחזורים: גירעון מתון ↔ שימור, לפי ההתקדמות.', adapt: 'שינוי מטרה בתחילת כל שלב.', limits: 'ההמלצות לשינוי דורשות רישום משקל ואימונים.' }),
    T({ id: 'annual', he: '12 חודשים — תוכנית שנתית', days: 364, goals: ['general', 'strength', 'recomp'], spw: 4, minutes: 40, phases: [{ k: 'intro', w: 4 }, { k: 'base', w: 8 }, { k: 'volume', w: 10 }, { k: 'advanced', w: 12 }, { k: 'assess', w: 8 }, { k: 'maintain', w: 10 }], audience: 'מחויבות לשנה; מתאים גם למתחילים.', nutrition: 'מתעדכנת לפי שלב ומטרה.', adapt: 'כל שלב ניתן להתאמה מחדש לפני תחילתו.', limits: 'בנויה משלבים ווריאציות — לא 12 עותקים של אותו חודש.' }),
    T({ id: 'home_noequip', he: 'ביתית ללא ציוד — 30 יום', days: 30, goals: ['general', 'fat_loss'], spw: 4, minutes: 30, phases: [{ k: 'intro', w: 1.5 }, { k: 'base', w: 2.8 }], audience: 'בלי ציוד בכלל, גם בלי כיסא או משקוף.', nutrition: 'לפי המטרה.', adapt: 'ימים, משך.', limits: 'רק תרגילים ללא ציוד.', equipLock: ['none'] }),
    T({ id: 'basic_equipment', he: 'מתאמנים עם ציוד בסיסי', days: 60, goals: ['muscle', 'strength'], spw: 4, minutes: 40, equipment: ['dumbbells', 'bands'], phases: [{ k: 'base', w: 4 }, { k: 'volume', w: 4.6 }], audience: 'משקולות יד וגומיות.', nutrition: 'חלבון גבוה, שימור או עודף קל.', adapt: 'ציוד, ימים, משך.', limits: 'הספרייה עדיין לא כוללת תרגילי משקולות/גומיות — התבנית מוצגת אך התוכנית תיבנה מתרגילי בית עד שהספרייה תורחב.', needsLibrary: ['dumbbells', 'bands'] }),
    T({ id: 'gym', he: 'מתאמנים בחדר כושר', days: 84, goals: ['muscle', 'strength'], spw: 4, minutes: 60, level: 'intermediate', equipment: ['gym'], phases: [{ k: 'base', w: 4 }, { k: 'volume', w: 4 }, { k: 'advanced', w: 4 }], audience: 'גישה לחדר כושר.', nutrition: 'חלבון גבוה, קלוריות לפי מטרה.', adapt: 'ימים, משך.', limits: 'אין עדיין תרגילי מכונות/מוטות בספרייה — לא ניתן להפיק תוכנית חדר כושר אמיתית.', needsLibrary: ['gym'] }),
    T({ id: 'custom', he: 'תוכנית אישית', days: null, custom: true, goals: ['general'], spw: 4, minutes: 35, audience: 'תאריך התחלה וסיום לבחירתך (1–365 ימים).', nutrition: 'לפי המטרה.', adapt: 'הכול.', limits: 'השלבים מחושבים לפי האורך; מתחת ל־14 יום — שלב אחד.' })
  ];
  root.PROGRAMS = { GOALS, PHASE_KINDS, TEMPLATES, byId: id => TEMPLATES.find(t => t.id === id) };
})(typeof window !== 'undefined' ? window : globalThis);
