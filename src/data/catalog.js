/* Content catalog (Stage A): taxonomy for the existing exercise library and derived facts for recipes.
   Exercise ids are the existing stable ids (src/data/exercises.js) — none renamed. Recipe facts (allergens, diet,
   cuisine) are DERIVED from ingredients at runtime, not stored twice. Text is Hebrew; English keys are stable codes
   so labels can be translated later (CAT_I18N). */
(function (root) {
  'use strict';
  /* pattern = movement pattern used by the planner; type = training quality; eq = equipment tags (empty = none);
     d = difficulty 1–3; uni = one side at a time; impact = high for jumping. */
  const EX_META = {
    squat: { pattern: 'squat', type: 'strength', eq: [], d: 1 },
    chair_squat: { pattern: 'squat', type: 'strength', eq: ['chair'], d: 1 },
    reverse_lunge: { pattern: 'lunge', type: 'strength', eq: [], d: 2, uni: true },
    split_squat: { pattern: 'lunge', type: 'strength', eq: [], d: 2, uni: true },
    bulgarian_split_squat: { pattern: 'lunge', type: 'strength', eq: ['bench'], d: 3, uni: true },
    step_up: { pattern: 'lunge', type: 'strength', eq: ['step'], d: 2, uni: true },
    glute_bridge: { pattern: 'bridge', type: 'strength', eq: [], d: 1 },
    sl_glute_bridge: { pattern: 'bridge', type: 'strength', eq: [], d: 2, uni: true },
    wall_sit: { pattern: 'squat', type: 'isometric', eq: ['wall'], d: 1 },
    calf_raise: { pattern: 'calf', type: 'strength', eq: [], d: 1 },
    sl_rdl: { pattern: 'hinge', type: 'strength', eq: [], d: 2, uni: true },
    hip_hinge: { pattern: 'hinge', type: 'strength', eq: [], d: 1 },
    lateral_lunge: { pattern: 'lunge', type: 'strength', eq: [], d: 2, uni: true },
    incline_pushup: { pattern: 'push_h', type: 'strength', eq: ['table'], d: 1 },
    knee_pushup: { pattern: 'push_h', type: 'strength', eq: [], d: 1 },
    pushup: { pattern: 'push_h', type: 'strength', eq: [], d: 2 },
    close_pushup: { pattern: 'push_h', type: 'strength', eq: [], d: 2 },
    pike_pushup: { pattern: 'push_v', type: 'strength', eq: [], d: 3 },
    decline_pushup: { pattern: 'push_h', type: 'strength', eq: ['bench'], d: 3 },
    chair_dip: { pattern: 'dip', type: 'strength', eq: ['chair'], d: 2 },
    doorframe_row: { pattern: 'pull_h', type: 'strength', eq: ['doorframe'], d: 1 },
    prone_ytw: { pattern: 'pull_scap', type: 'strength', eq: [], d: 1 },
    reverse_snow_angel: { pattern: 'pull_scap', type: 'strength', eq: [], d: 1 },
    towel_pull_apart: { pattern: 'pull_scap', type: 'strength', eq: ['towel'], d: 1 },
    towel_curl: { pattern: 'curl', type: 'strength', eq: ['towel', 'chair'], d: 1 },
    superman: { pattern: 'back_ext', type: 'strength', eq: [], d: 1 },
    breathing_90: { pattern: 'breathing', type: 'breathing', eq: [], d: 1 },
    dead_bug: { pattern: 'core_anti_ext', type: 'strength', eq: [], d: 1 },
    heel_taps: { pattern: 'core_anti_ext', type: 'strength', eq: [], d: 1 },
    hollow_hold: { pattern: 'core_anti_ext', type: 'isometric', eq: [], d: 3 },
    plank: { pattern: 'core_anti_ext', type: 'isometric', eq: [], d: 2 },
    bear_hold: { pattern: 'core_anti_ext', type: 'isometric', eq: [], d: 2 },
    bird_dog: { pattern: 'core_anti_rot', type: 'strength', eq: [], d: 1 },
    shoulder_tap: { pattern: 'core_anti_rot', type: 'strength', eq: [], d: 2 },
    side_plank: { pattern: 'core_lat', type: 'isometric', eq: [], d: 2 },
    crunch: { pattern: 'core_flex', type: 'strength', eq: [], d: 1 },
    leg_raise: { pattern: 'core_flex', type: 'strength', eq: [], d: 2 },
    bicycle_crunch: { pattern: 'core_rot', type: 'strength', eq: [], d: 2 },
    glute_bridge_march: { pattern: 'bridge', type: 'strength', eq: [], d: 2 },
    march: { pattern: 'cardio_low', type: 'cardio', eq: [], d: 1 },
    step_jack: { pattern: 'cardio_low', type: 'cardio', eq: [], d: 1 },
    squat_reach: { pattern: 'cardio_low', type: 'cardio', eq: [], d: 1 },
    shadow_boxing: { pattern: 'cardio_low', type: 'cardio', eq: [], d: 1 },
    slow_climber: { pattern: 'cardio_low', type: 'cardio', eq: ['table'], d: 1 },
    brisk_walk: { pattern: 'cardio_low', type: 'cardio', eq: [], d: 1, outdoor: true },
    mountain_climber: { pattern: 'cardio_high', type: 'cardio', eq: [], d: 2 },
    high_knees: { pattern: 'cardio_high', type: 'cardio', eq: [], d: 2, impact: 'high' },
    jumping_jack: { pattern: 'cardio_high', type: 'cardio', eq: [], d: 2, impact: 'high' },
    jump_squat: { pattern: 'cardio_high', type: 'plyometric', eq: [], d: 3, impact: 'high' },
    burpee: { pattern: 'cardio_high', type: 'cardio', eq: [], d: 3, impact: 'high' },
    wall_slide: { pattern: 'mobility', type: 'mobility', eq: ['wall'], d: 1 },
    arm_circles: { pattern: 'mobility', type: 'mobility', eq: [], d: 1 },
    cat_cow: { pattern: 'mobility', type: 'mobility', eq: [], d: 1 },
    childs_pose: { pattern: 'mobility', type: 'mobility', eq: [], d: 1 },
    hip_flexor_stretch: { pattern: 'mobility', type: 'mobility', eq: [], d: 1 },
    hamstring_stretch: { pattern: 'mobility', type: 'mobility', eq: ['towel'], d: 1 },
    chest_stretch: { pattern: 'mobility', type: 'mobility', eq: ['wall'], d: 1 }
  };
  /* Equipment the user can own. 'home' items are everyday furniture; the rest are not yet covered by the library
     (reported as a gap, filled in a later stage — never faked). */
  const EQUIPMENT = {
    none: { he: 'ללא ציוד', home: true }, chair: { he: 'כיסא יציב', home: true }, table: { he: 'שולחן/מיטה יציבים', home: true },
    bench: { he: 'ספה/מיטה נמוכה', home: true }, step: { he: 'מדרגה', home: true }, wall: { he: 'קיר', home: true },
    doorframe: { he: 'משקוף דלת', home: true }, towel: { he: 'מגבת', home: true },
    dumbbells: { he: 'משקולות יד' }, bands: { he: 'גומיות התנגדות' }, pullup_bar: { he: 'מוט מתח' }, gym: { he: 'חדר כושר' }, outdoor: { he: 'אימון בחוץ' }
  };
  const PATTERN_HE = { squat: 'סקוואט', lunge: 'לאנג׳/רגל אחת', hinge: 'כפיפת ירך', bridge: 'גשר ישבן', calf: 'שוקיים', push_h: 'דחיפה אופקית', push_v: 'דחיפה אנכית', dip: 'מקבילים', pull_h: 'משיכה אופקית', pull_scap: 'שכמות וגב עליון', curl: 'כפיפת מרפק', back_ext: 'פשיטת גב', breathing: 'נשימה', core_anti_ext: 'ליבה — נגד פשיטה', core_anti_rot: 'ליבה — נגד סיבוב', core_lat: 'ליבה צידית', core_flex: 'כפיפת בטן', core_rot: 'סיבוב גו', cardio_low: 'אירובי מתון', cardio_high: 'אירובי עצים', mobility: 'ניידות/מתיחה' };
  const TYPE_HE = { strength: 'כוח', isometric: 'החזקה', plyometric: 'פליומטרי', cardio: 'לב־ריאה', mobility: 'ניידות', breathing: 'נשימה' };

  /* Recipe facts derived from ingredients */
  const ALLERGEN_OF = { atta: 'gluten', maida: 'gluten', bread: 'gluten', noodles: 'gluten', oats: 'gluten_may', curd: 'milk', hung_curd: 'milk', milk: 'milk', paneer: 'milk', ghee: 'milk', egg: 'egg', egg_white: 'egg', soya: 'soy', peanuts: 'peanut',
    pasta: 'gluten', couscous: 'gluten', bulgur: 'gluten', tortilla: 'gluten', soy_sauce: ['soy', 'gluten'], tofu: 'soy', edamame: 'soy', soy_milk: 'soy', peanut_butter: 'peanut',
    salmon: 'fish', white_fish: 'fish', tuna_can: 'fish', greek_yogurt: 'milk', cottage: 'milk', feta: 'milk', mozzarella: 'milk', almonds: 'tree_nut', tahini: 'sesame' };
  const ALLERGEN_HE = { gluten: 'גלוטן', gluten_may: 'עלול להכיל גלוטן (שיבולת שועל)', milk: 'חלב', egg: 'ביצים', soy: 'סויה', peanut: 'בוטנים', fish: 'דגים', tree_nut: 'אגוזים (שקדים)', sesame: 'שומשום (טחינה)' };
  const MEAT = ['chicken_breast', 'chicken_thigh', 'chicken_mince', 'beef_lean', 'turkey'], FISH = ['salmon', 'white_fish', 'tuna_can'], EGG = ['egg', 'egg_white'], DAIRY = ['curd', 'hung_curd', 'milk', 'paneer', 'ghee', 'greek_yogurt', 'cottage', 'feta', 'mozzarella'];
  const CUISINE_BY_ID = { chicken_thukpa: 'tibetan', chicken_momos: 'tibetan', r_thukpa_momo: 'tibetan', madra_chicken: 'himachali', kala_chana_curry_rice: 'himachali', mushroom_matar_soya_roti: 'himachali' };
  const CUISINE_HE = { indian: 'הודי', himachali: 'הימאצ׳לי', tibetan: 'טיבטי', international: 'בינלאומי', mediterranean: 'ים־תיכוני', italian: 'איטלקי', mexican: 'מקסיקני', middle_eastern: 'מזרח תיכוני', american: 'אמריקאי', asian: 'אסייתי', greek: 'יווני', israeli: 'ישראלי', moroccan: 'מרוקאי' };
  function recipeFacts(r) {
    const fs = r.ing.map(x => x.f);
    const allergens = [...new Set(fs.flatMap(f => [].concat(ALLERGEN_OF[f] || [])))];
    if (allergens.includes('gluten')) { const i = allergens.indexOf('gluten_may'); if (i >= 0) allergens.splice(i, 1); }
    const meat = fs.some(f => MEAT.includes(f)), fish = fs.some(f => FISH.includes(f)), egg = fs.some(f => EGG.includes(f)), dairy = fs.some(f => DAIRY.includes(f));
    return {
      id: r.id, meal: r.meal, cuisine: CUISINE_BY_ID[r.id] || r.cuisine || 'indian', international: !!r.intl, restaurant: !!r.est,
      allergens, glutenFree: !allergens.includes('gluten') && !allergens.includes('gluten_may') ? 'by-ingredients' : false,
      diet: { vegan: !meat && !fish && !egg && !dairy, vegetarian: !meat && !fish && !egg, ovoLacto: !meat && !fish, pescatarian: !meat },
      minutes: (r.prep || 0) + (r.cook || 0), quick: !r.est && (r.prep || 0) + (r.cook || 0) <= 20,
      // the recipe stores weight state per food (FOODS.st): raw / dry / ready — list which states appear
      weightStates: [...new Set(fs.map(f => root.NUTRI.FOODS[f].st))]
    };
  }
  const exMeta = id => Object.assign({ pattern: null, type: null, eq: [], d: 1, uni: false, impact: 'low', outdoor: false }, EX_META[id] || {});
  function exFacts(e) {
    const m = exMeta(e.id); const parts = String(e.muscles || '').split(';');
    return Object.assign({ id: e.id, cat: e.cat, primary: parts[0].split(',').map(s => s.trim()).filter(Boolean), secondary: (parts[1] || '').split(',').map(s => s.trim()).filter(Boolean),
      home: m.eq.every(t => EQUIPMENT[t] && EQUIPMENT[t].home), noEquipment: m.eq.length === 0 }, m);
  }
  /* exercises usable with an equipment set (array of EQUIPMENT keys; 'none' implied) */
  const usableWith = (e, have) => exMeta(e.id).eq.every(t => have.includes(t));
  /* Stage E: technique-safety cues per movement pattern (general exercise technique — no medical assumptions about the
     user). Shown on every exercise page next to the exercise's own "signs of incorrect execution". */
  const SAFETY_ALL = ['תנועה איטית ומבוקרת; בלי לקפוץ לטווח שלא שולטים בו.', 'עוצרים את התרגיל אם מופיע כאב חד, סחרחורת או תחושה חריגה — ובוחרים גרסה קלה יותר.'];
  const SAFETY_BY_PATTERN = {
    squat: ['ברכיים בכיוון האצבעות; העקבים נשארים על הרצפה.', 'גב ניטרלי — יורדים רק לעומק שבו הגב לא מתעגל.'],
    lunge: ['משטח יציב ונעליים/רגל יחפה שלא מחליקים; ליד קיר אם האיזון חלש.', 'הברך הקדמית מעל כף הרגל, לא קורסת פנימה.'],
    hinge: ['התנועה מהירכיים, לא מהגב התחתון; עמוד שדרה ארוך.', 'מתחילים בטווח קצר ומגדילים רק כשהגב נשאר ניטרלי.'],
    bridge: ['דוחפים מהעקבים ומכווצים ישבן — לא מקשתים את הגב התחתון בחלק העליון.'],
    calf: ['אחיזה בקיר או כיסא לאיזון; ירידה איטית.'],
    push_h: ['גוף בקו אחד מהראש עד העקבים; מרפקים בזווית ~45° מהגוף.', 'משטח הגבהה (שולחן/מיטה) חייב להיות יציב ולא זז.'],
    push_v: ['ראש וצוואר רפויים; לא נופלים קדימה על הראש — יורדים לאט.'],
    dip: ['כיסא/ספה יציבים ונעולים; כתפיים רחוקות מהאוזניים, לא יורדים עמוק מדי.'],
    pull_h: ['בודקים שהשולחן/המשטח יציב ויכול לשאת את המשקל לפני כל סט.', 'גוף ישר; משיכה עם השכמות, לא רק עם הידיים.'],
    pull_scap: ['תנועה קטנה ומבוקרת של השכמות; צוואר רפוי.'],
    curl: ['מרפקים צמודים לגוף; בלי תנופה מהגב.'],
    back_ext: ['הרמה נמוכה ומבוקרת; מבט לרצפה, צוואר ארוך.'],
    breathing: ['בישיבה או בשכיבה נוחה; אם מופיעה סחרחורת — חוזרים לנשימה רגילה.'],
    core_anti_ext: ['אגן לא שוקע ולא מתרומם; אם הגב התחתון מתקשת — עוברים לגרסה קלה או מקצרים את הזמן.', 'נושמים לאורך כל ההחזקה — בלי לעצור נשימה.'],
    core_anti_rot: ['אגן וכתפיים נשארים מקבילים לרצפה; תנועה איטית.'],
    core_lat: ['גוף בקו אחד; כתף מעל המרפק.'],
    core_flex: ['הרמה מהבטן, לא משיכה בצוואר; ידיים לא מושכות את הראש.'],
    core_rot: ['הסיבוב מבית החזה; תנועה מבוקרת ולא בתנופה.'],
    cardio_low: ['קצב שמאפשר לדבר במשפטים קצרים; מגבירים בהדרגה.'],
    cardio_high: ['מקום פנוי ומשטח לא מחליק; נחיתה רכה על כריות כף הרגל עם ברכיים כפופות.', 'אם הקצב מאבד טכניקה — מאטים או עוברים לגרסה בלי קפיצה.'],
    mobility: ['מתיחה עד תחושת מתח נעימה — לא כאב; בלי קפיצות בסוף הטווח.']
  };
  const exSafety = e => { const f = exFacts(e); const l = (SAFETY_BY_PATTERN[f.pattern] || []).slice(); if (f.impact === 'high' && f.pattern !== 'cardio_high') l.push('התרגיל כולל קפיצה: נחיתה רכה ושקטה, משטח לא מחליק.'); return l.concat(SAFETY_ALL); };
  root.CATALOG = { EX_META, EQUIPMENT, PATTERN_HE, TYPE_HE, ALLERGEN_OF, ALLERGEN_HE, CUISINE_HE, recipeFacts, exFacts, exMeta, usableWith, SAFETY_BY_PATTERN, exSafety };
})(typeof window !== 'undefined' ? window : globalThis);
