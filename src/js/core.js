/* Domain helpers that combine static data with saved state. */
(function (root) {
const S = () => root.Store, L = () => root.Logic, P = () => root.PROGRAM, N = () => root.NUTRI;
const C = {};
C.profile = () => S().load('profile');
/* Energy balance per goal (system estimate, shown as such): share below maintenance; negative = surplus. */
C.GOAL_DEFICIT = { fat_loss: 0.2, weight_loss: 0.2, recomp: 0.1, muscle: -0.1, gain: -0.1, strength: 0, endurance: 0, general: 0, maintain: 0, mobility: 0, habits: 0, return: 0, beginner: 0 };
C.hasBasics = (p) => { p = p || C.profile(); return [p.age, p.height, p.weight].every(v => typeof v === 'number' && v > 0); };
/* inputs actually used for the estimate, and where each came from (user / legacy assumption / default) */
/* Activity (Stage H1): total daily physical activity level (PAL) incl. work, walking AND training, FAO/WHO/UNU 2004
   categories. Not set → 1.55, the midpoint of the "sedentary" range (1.40–1.69) — the value every earlier version used,
   so existing users' targets do not change until they choose a level. */
C.PAL = { low: 1.4, sedentary: 1.55, moderate: 1.85, vigorous: 2.2 };
C.ACTIVITY_HE = { low: ['יושבני מאוד', 'רוב היום בישיבה, כמעט בלי הליכה ובלי אימונים'], sedentary: ['יושבני', 'עבודה בישיבה, הליכה מעטה, אימונים קצרים כמה פעמים בשבוע'],
  moderate: ['פעיל', 'עבודה בעמידה ובתנועה, או כשעה של פעילות גופנית בכל יום'], vigorous: ['פעיל מאוד', 'עבודה פיזית קשה, או כשעתיים של ספורט בכל יום'] };
C.bmi = p => { p = p || C.profile(); return p.weight && p.height ? p.weight / Math.pow(p.height / 100, 2) : null; };
C.targetInputs = () => {
  const p = C.profile(), lg = p.legacy || null, goal = p.aims && p.aims.primary;
  const sex = p.sex || (lg && lg.sex) || null, sexFrom = p.sex ? 'user' : (lg && lg.sex) ? 'legacy' : 'unknown';
  let deficit = goal ? C.GOAL_DEFICIT[goal] : lg ? lg.deficit : 0, deficitFrom = goal ? 'goal' : lg ? 'legacy' : 'none';
  /* Stage H1 safety rules (conservative; the app is not a medical tool):
     - under 18: no automatic deficit or surplus — maintenance only (AAP 2016: talk about healthy eating, not dieting)
     - adult BMI < 18.5 (underweight): no automatic deficit */
  const minor = typeof p.age === 'number' && p.age < 18, bmi = C.bmi(p), under = !minor && bmi != null && bmi < 18.5;
  if (minor && deficit !== 0) { deficit = 0; deficitFrom = 'minor'; }
  else if (under && deficit > 0) { deficit = 0; deficitFrom = 'underweight'; }
  const activity = C.PAL[p.activity] ? p.activity : null;
  return { sex, sexFrom, deficit, deficitFrom, goal, minor, bmi: bmi != null ? Math.round(bmi * 10) / 10 : null, underweight: under, activity, af: activity ? C.PAL[activity] : 1.55, afFrom: activity ? 'user' : 'assumed' };
};
/* SLL-42 part 2 · app-generated changes: the AUTOMATIC calorie and protein targets are recalculated from the profile. When a saved
   profile change moves them, one app entry records old → new and why (which inputs changed). Manual targets are the user's own
   (recorded as settings), so nothing is logged while a manual target is in use. The first run after setup only stores a baseline.
   Water is not tracked here: its automatic value follows each day's workout, so it would log daily noise, not a change. */
const AUTO_IN = { weight: ['משקל', ' ק״ג'], height: ['גובה', ' ס״מ'], age: ['גיל', ''], sex: ['מין', ''], goal: ['מטרה', ''], activity: ['רמת פעילות', ''] };
const autoV = (k, v) => v == null ? '—' : k === 'sex' ? ({ m: 'זכר', f: 'נקבה' }[v] || v) : k === 'goal' ? ((root.PROGRAMS && root.PROGRAMS.GOALS[v]) || v) : k === 'activity' ? ((C.ACTIVITY_HE && C.ACTIVITY_HE[v] && C.ACTIVITY_HE[v][0]) || v) : v + AUTO_IN[k][1];
C.trackAuto = now => {
  const p = C.profile(); if (!p.onboarded) return 0; const a = C.autoTargets(); if (!a) return 0; const t = C.targets(), i = a.inputs;
  const cur = { kcal: a.kcal, protein: a.protein, custom: !!t.custom, in: { weight: p.weight, height: p.height, age: p.age, sex: i.sex, goal: i.goal || null, activity: i.activity || null } };
  const cl = S().load('changelog'), prev = cl.auto; if (prev && JSON.stringify(prev) === JSON.stringify(cur)) return 0; cl.auto = cur;
  if (!prev || !prev.in) { S().save('changelog'); return 0; }
  const why = Object.keys(AUTO_IN).filter(k => JSON.stringify(prev.in[k]) !== JSON.stringify(cur.in[k])).map(k => `${AUTO_IN[k][0]} ${autoV(k, prev.in[k])} → ${autoV(k, cur.in[k])}`);
  let n = 0; if (!prev.custom && !cur.custom) [['kcal', 'auto.kcal'], ['protein', 'auto.protein']].forEach(([k, path]) => { if (prev[k] !== cur[k]) n += S().recordEntry({ path, from: prev[k], to: cur[k], src: 'app', why: why.length ? 'חושב מחדש כי השתנה: ' + why.join('; ') : 'החישוב עודכן בגרסה חדשה של האפליקציה' }, now); });
  if (!n) S().save('changelog'); return n;
};
try { root.addEventListener('fit30:saved', e => { if (e && e.detail && e.detail.name === 'profile') { try { C.trackAuto(); } catch (x) { } } }); } catch (e) { }
C.autoTargets = () => { const p = C.profile(); if (!C.hasBasics(p)) return null; const i = C.targetInputs(); return Object.assign(L().computeTargets({ weight: p.weight, height: p.height, age: p.age, sex: i.sex, deficit: i.deficit, activity: i.af }), { inputs: i }); };
/* warnings shown with the targets (targets, profile, nutrition, explain). level: bad | warn | info. Sources are cited. */
C.targetWarnings = () => {
  const p = C.profile(), a = C.autoTargets(), t = C.targets(), out = []; if (!a) return out; const i = a.inputs;
  if (i.minor) out.push({ k: 'minor', level: 'warn', text: `גיל ${p.age}: לבני ובנות נוער האפליקציה לא מציעה גירעון או עודף קלורי — היעד הוא שימור והרגלי אכילה בריאים. ירידה או עלייה במשקל — רק בליווי רופא/ה או דיאטן/ית. (לפי המלצת האקדמיה האמריקאית לרפואת ילדים, AAP 2016: לדבר על אכילה בריאה, לא על דיאטות.)` });
  if (i.underweight) out.push({ k: 'underweight', level: 'warn', text: `BMI ${i.bmi} — מתחת ל־18.5, הטווח שמוגדר "תת־משקל" למבוגרים. ${C.GOAL_DEFICIT[i.goal] > 0 ? 'לכן לא מוצע גירעון קלורי, למרות המטרה שבחרת.' : ''} BMI הוא מדד גס ואינו אבחנה; כדאי להתייעץ עם רופא/ה.` });
  if (a.floored) out.push({ k: 'floor', level: 'warn', text: `לפי החישוב היעד היה ${a.kcalRaw} קק״ל. הוא הוגבל ל־${a.kcal}: האפליקציה לא מציעה פחות מ־1,200 קק״ל לנשים / 1,500 לגברים (או פחות מחילוף החומרים הבסיסי) בלי ליווי מקצועי (Harvard Health).` });
  if (t && t.custom) { const min = i.sex === 'f' ? 1200 : 1500;
    if (t.kcal < min || t.kcal < a.bmr) out.push({ k: 'manualLow', level: 'bad', text: `היעד שהזנת ידנית (${t.kcal} קק״ל) נמוך מ־${t.kcal < a.bmr ? 'חילוף החומרים הבסיסי המשוער (' + a.bmr + ')' : min + ' קק״ל'}. יעד כזה מומלץ רק בליווי מקצועי.` });
    if (i.minor && t.kcal < a.tdee * 0.95) out.push({ k: 'manualMinor', level: 'bad', text: 'הוזן ידנית יעד מתחת לשימור עבור גיל מתחת ל־18. מומלץ להתייעץ עם רופא/ה לפני הגבלת אכילה.' }); }
  if (t && t.custom && p.targets && p.targets.ctx) { const c = p.targets.ctx, ch = [];
    if (typeof c.weight === 'number' && typeof p.weight === 'number' && Math.abs(c.weight - p.weight) >= 2) ch.push(`המשקל ${c.weight} → ${p.weight} ק״ג`);
    if ((c.goal || null) !== ((p.aims && p.aims.primary) || null)) ch.push('המטרה');
    if ((c.activity || null) !== (p.activity || null)) ch.push('רמת הפעילות');
    if (ch.length) out.push({ k: 'manualStale', level: 'warn', text: `היעדים הידניים נקבעו לפני ששונו: ${ch.join(', ')}. הם לא מתעדכנים לבד — כדאי לבדוק אותם מחדש בהגדרות, או לחזור לחישוב האוטומטי (כעת ${a.kcal} קק״ל, ${a.protein} ג׳ חלבון).` }); }
  if (!i.minor && i.bmi != null && i.bmi >= 30 && !(t && t.custom && p.targets && p.targets.protein)) out.push({ k: 'proteinHighBmi', level: 'info', text: `יעד החלבון (${a.protein} ג׳) מחושב לפי המשקל הכולל, 1.8 ג׳ לק״ג. במשקל גוף גבוה (BMI ${i.bmi}) יש גישות מקצועיות שמחשבות לפי משקל מותאם, ויעד כזה עשוי להיות גבוה מהנדרש. זו שאלה מקצועית פתוחה באפליקציה — מומלץ לבדוק עם דיאטן/ית ואפשר לקבוע יעד ידני בהגדרות.` });
  if (p.targetWeight && p.height) { const tb = p.targetWeight / Math.pow(p.height / 100, 2); if (tb < 18.5) out.push({ k: 'targetBmi', level: 'warn', text: `משקל היעד (${p.targetWeight} ק״ג) מתאים ל־BMI ${tb.toFixed(1)} — מתחת ל־18.5. כדאי לבדוק את היעד עם איש/אשת מקצוע.` }); }
  return out;
};
C.DISCLAIMER = 'היעדים הם הערכה כללית לפי נוסחאות מקובלות. האפליקציה אינה כלי אבחון ואינה תחליף לייעוץ רפואי או תזונתי.';
C.targets = () => {
  const a = C.autoTargets(), o = C.profile().targets || {};
  if (!a) return null; /* no estimate without age, height and weight — screens ask the user to complete the profile */
  const t = Object.assign({}, a); ['kcal', 'protein', 'fat', 'carbs', 'fiber'].forEach(k => { if (o[k]) t[k] = +o[k]; });
  t.custom = !!(o.kcal || o.protein || o.fat || o.carbs); return t;
};
/* program calendar */
C.start = () => C.profile().startDate;
C.programDay = date => S().diffDays(C.start(), date) + 1;
C.dateOfDay = n => S().addDays(C.start(), n - 1);
C.todayN = () => C.programDay(S().today());
C.clampDay = n => Math.min(30, Math.max(1, n));
C.dayDef = n => P().DAYS[C.clampDay(n) - 1];
C.isTraining = n => C.dayDef(n).type !== 'rest';
C.log = n => S().load('workouts').days[n] || null;
C.status = n => {
  const d = C.dayDef(n), lg = C.log(n), t = C.todayN();
  if (lg && lg.status === 'done') return 'done';
  if (lg && lg.status === 'partial') return 'partial';
  if (d.type === 'rest') return 'rest';
  if (n < t) return 'missed';
  if (n === t) return 'today';
  return 'planned';
};
C.STATUS_HE = { done: 'הושלם', partial: 'הושלם חלקית', rest: 'מנוחה', missed: 'הוחמץ', today: 'היום', planned: 'מתוכנן' };
C.exFor = (n, exId) => { const sw = (S().load('workouts').swaps[n] || {}); return sw[exId] || exId; };
C.levelFor = (exId, item) => (item && item.adjLvl) || S().load('workouts').levels[exId] || (item && item.lvl) || 'normal'; /* an approved plan adaptation for that day wins */
C.LEVEL_HE = { easy: 'מתחיל', normal: 'בינוני', hard: 'מתקדם' };
C.trainingDays = () => P().DAYS.filter(d => d.type !== 'rest').map(d => d.day);
C.completion = () => {
  const td = C.trainingDays(); let done = 0;
  td.forEach(n => { const lg = C.log(n); if (lg && lg.status === 'done') done += 1; else if (lg && lg.status === 'partial') done += 0.5; });
  return { done, total: td.length, pct: Math.round(done / td.length * 100) };
};
C.streak = () => {
  let n = Math.min(30, C.todayN()); if (n < 1) return 0;
  const st = C.status(n); if (st !== 'done' && st !== 'partial') n -= 1; // today not finished yet doesn't break streak
  let s = 0;
  for (; n >= 1; n--) { const x = C.status(n); if (x === 'rest') continue; if (x === 'done' || x === 'partial') s++; else break; }
  return s;
};
/* nutrition */
C.menuIndex = date => { const n = C.programDay(date); return ((Math.max(1, n) - 1) % 30); };
C.slotNames = { m1: 'ארוחת בוקר', snack: 'ארוחת ביניים', m2: 'ארוחת צהריים', snack2: 'ארוחת ביניים נוספת', m3: 'ארוחת ערב', extra: 'נשנוש חלבון (רשות)' };
/* meal slots in the order of the day; dinner (m3) uses main-dish recipes, the 2nd snack uses snack recipes. Which of them a day has
   comes from the menu engine (meals per day as the user set + snacks only when needed); unused slots are 'off'. */
C.DAY = ['m1', 'snack', 'm2', 'snack2', 'm3']; C.ALL = C.DAY.concat('extra');
C.mealOf = k => k === 'm3' ? 'm2' : k === 'snack2' ? 'snack' : k; /* the model's meal types: breakfast dishes, the main meal (≈45% of the day in a 3-meal menu), a smaller meal (≈22%); the user chooses 2 or 3 meals */
/* main protein foods of a dish as planned (dairy/legume/protein groups) — used so an add-on never repeats what the day already has */
C.protFoods = s => { if (!s || !s.rid) return []; const r = L().recipe(s.rid); return r ? L().recipeIngredients(r, s.ov).map(x => x.f).filter(f => ['protein', 'legume', 'dairy'].includes(N().FOODS[f].grp)) : []; };
C.extraFoods = r => r.ing.map(x => x.f).filter(f => ['protein', 'legume', 'dairy'].includes(N().FOODS[f].grp));
C.extraRepeats = (r, p) => { const day = new Set(C.DAY.filter(k => p[k] && !p[k].off && !p[k].missing).flatMap(k => C.protFoods(p[k]))); return C.extraFoods(r).some(f => day.has(f)); };
/* where a date's default menu comes from: the personal plan's generated menu (Stage C) or the fixed 30-day menu */
/* Menu source per date: an active personal plan's menu; otherwise (nutrition-engine fix) the SAME generator builds the day from the
   user's own targets and preferences ('auto'); the authored 30-day menu ('classic') remains only for days without targets, for past days
   that were never computed (history is not rewritten), and when profile.menuMode === 'fixed'. */
C.planSource = date => { const g = root.MealPlan && root.MealPlan.forDate(date); if (g) return { kind: 'plan', gen: g };
  const a = root.MealPlan && root.MealPlan.autoFor && root.MealPlan.autoFor(date); return a ? { kind: 'auto', gen: a } : { kind: 'classic', i: C.menuIndex(date) }; };
C.plan = (date, opt) => {
  const src = C.planSource(date), ov = (S().load('nutrition').plan[date]) || {};
  let def, defOv, adj;
  if (src.gen) { const g = src.gen, fb = N().RECIPES.find(r => r.meal === 'snack');
    def = {}; C.ALL.forEach(k => { def[k] = g.slots[k] ? g.slots[k].rid : null; }); if (!g.slots.snack && !(g.off && g.off.snack)) def.snack = fb.id; /* older generated menus always had a snack */ /* no fitting add-on → none (never a non-matching default) */
    adj = {}; Object.keys(g.slots).forEach(k => { if (g.slots[k] && g.slots[k].ov) adj[k] = true; });
    defOv = k => g.slots[k] && g.slots[k].ov ? JSON.parse(JSON.stringify(g.slots[k].ov)) : null;
  } else { const i = src.i, base = N().MENU[i];
    def = { m1: base[0], m2: base[1], snack: base[2], m3: null, snack2: null, extra: N().EXTRA_DAY[i] }; /* the authored 30-day menu has 3 eating slots */
    adj = (N().BASE_ADJ && N().BASE_ADJ[i]) || {};
    defOv = k => { const a = adj[k]; if (!a) return null; const r = L().recipe(def[k]); const o = {}; Object.keys(a).forEach(idx => { o[idx] = { f: r.ing[idx].f, g: a[idx] }; }); return o; }; }
  const out = {};
  C.ALL.forEach(k => {
    const o1 = ov[k] || {}, o0 = o1.rid && (L().recipe(o1.rid) || {}).meal !== C.mealOf(k) ? {} : o1; /* P0: a stored dish of another meal type (e.g. a snack saved as lunch by an older build) is not shown in this meal */
    const o = src.gen && o0.auto === 'pref' ? {} : o0; /* automatic preference fixes were made for the classic menu; a personal plan builds its own menu from the same preferences */
    const rid = o.rid || def[k], same = rid === def[k];
    const eff = o.ov != null ? o.ov : (same ? defOv(k) : null);
    out[k] = { rid, scale: o.scale || 1, ov: eff, adjusted: same && o.ov == null && !!adj[k], auto: o.auto || false, from: o.from || null, cuisine: o.cuisine || false, /* M10.4: a stored fix made only for the cuisine preference */
      changed: !same || o.ov != null || (o.scale && o.scale !== 1), def: def[k] };
  });
  /* Stage H1 — restriction guard (P0). Every slot the user did not choose explicitly is checked against the CURRENT
     restrictions on every render, for any date: classic program day 31+ (the 30-day menu cycles), days after a personal
     plan ended, and personal-plan menus generated before a restriction was added. A conflicting slot is replaced by the
     same deterministic resolver used everywhere else; if nothing fits, the slot is left empty with an explanation —
     a forbidden food is never kept as a fallback. A dish the user picked explicitly is kept but flagged (never silent). */
  const avoid = [];
  ['m3', 'snack2'].forEach(k => { if (!out[k].rid) out[k].off = true; }); /* not part of this day's menu (a user can still add one) */
  if (src.gen && src.gen.off) Object.keys(src.gen.off).forEach(k => { if (out[k] && !(ov[k] && ov[k].rid)) out[k].off = true; });
  if (!(opt && opt.raw) && date >= S().today()) C.ALL.forEach(k => { /* past days are history — never rewritten */
    const o = ov[k] || {}, s0 = out[k], userChose = !!(o.rid && !o.auto) || (o.ov != null && !o.auto);
    if (!s0.rid || C.slotEntry(date, k)) { if (s0.rid) avoid.push(s0.rid); return; }
    const cs = C.conflicts(L().recipe(s0.rid), s0.ov);
    if (!cs.length && src.gen) { avoid.push(s0.rid); return; } /* personal plans: the generator already applied cuisine & dislikes (keeps variety, counts, targets) */
    if (!cs.length) { /* M10.4: cuisine preference / "לא אוהב/ת" — only for dishes the user did not choose; restrictions are handled below */
      const pfNow = C.normPrefs(C.profile().prefs), r0 = L().recipe(s0.rid);
      if (userChose || (C.cuisineAllowed(r0, pfNow) && !((C.profile().nutritionDislike) || []).includes(s0.rid))) { avoid.push(s0.rid); return; }
      const rc = C.resolveSlot(s0.rid, s0.ov, k, pfNow, avoid, C.rotOf(date));
      if (rc.action === 'meal') { /* P0 fix: size the replacement to the energy of the dish it replaces, so the day keeps its calories/protein (0.6–1.8×, 0.05 steps) */
        const sc = C.matchScale(C.slotMacros(s0), L().recipeMacros(L().recipe(rc.rid), 1, rc.ov));
        out[k] = Object.assign({}, s0, { rid: rc.rid, ov: rc.ov, scale: sc, adjusted: false, auto: 'cuisine', from: s0.rid, changed: true, disliked: !!rc.disliked, cuisineMiss: !!rc.cuisineMiss }); avoid.push(rc.rid); }
      else { if (rc.cuisineMiss) out[k].cuisineMiss = true; avoid.push(s0.rid); }
      return; }
    if (userChose) { s0.conflict = C.conflictText(cs); s0.conflictKind = C.worstKind(cs.map(c => c.f)); avoid.push(s0.rid); return; }
    const res = C.resolveSlot(s0.rid, s0.ov, k, C.normPrefs(C.profile().prefs), avoid, C.rotOf(date)); /* M10.4: same restrictions as before (current profile), plus cuisine/dislikes as soft order */
    const why = C.conflictText(cs), kind = C.worstKind(cs.map(c => c.f));
    if (res.action === 'ing' || res.action === 'meal') { out[k] = Object.assign({}, s0, { rid: res.rid, ov: res.ov, scale: 1, adjusted: false, auto: 'guard', from: s0.rid, guardWhy: why, guardKind: kind, changed: true }); avoid.push(res.rid); }
    else out[k] = Object.assign({}, s0, { rid: null, ov: null, missing: true, blockedNone: why, guardKind: kind, from: s0.rid });
  });
  out.extra.optional = true; out.extra.on = !!(ov.extra && ov.extra.on); // optional add-on: counted only when the user selects it
  /* P0: the suggested add-on must not repeat a protein food the day's meals already contain (no "cottage + cottage add-on");
     a user-chosen add-on is kept as chosen. */
  if (!(opt && opt.raw) && date >= S().today() && out.extra.rid && !(ov.extra && ov.extra.rid) && !C.slotEntry(date, 'extra') && C.extraRepeats(L().recipe(out.extra.rid), out)) {
    const alt = N().RECIPES.filter(r => r.meal === 'extra' && !C.conflicts(r, null).length && !C.extraRepeats(r, out)).sort((a, b) => ((C.rotOf(date) * 7 + a.id.length) % 13) - ((C.rotOf(date) * 7 + b.id.length) % 13))[0];
    if (alt) Object.assign(out.extra, { rid: alt.id, ov: null, scale: 1, def: alt.id }); }
  if (src.gen) { out.source = src.kind; out.planId = src.gen.planId || null; out.gap = src.gen.gap; C.ALL.forEach(k => { if (!src.gen.slots[k] && !(ov[k] && ov[k].rid) && !out[k].off) out[k].missing = true; });
    /* TD-22 (RC4): the gap is re-checked on the day AS IT IS NOW — after a meal swap, a portion change or a guard replacement —
       with the same rule (MealPlan.gapOf) and the same sum the screen shows (C.plannedTotals 'base'). For an unedited day this
       equals the generated gap (same sum, same rule). gapEdited tells the screen to word it as "after your changes". */
    if (src.gen.target && src.gen.target.k && root.MealPlan && root.MealPlan.gapOf) {
      const ks = C.DAY.filter(k => !out[k].off && !out[k].missing && out[k].rid);
      const tot = L().roundM(L().sumMacros(ks.map(k => C.slotMacros(out[k]))));
      out.gap = root.MealPlan.gapOf(tot, src.gen.target.k, src.gen.target.p);
      out.gapEdited = C.DAY.some(k => out[k].changed || !!out[k].auto || (out[k].missing && src.gen.slots[k])); } }
  else out.source = 'classic';
  return out;
};
C.slotMacros = s => s && s.rid ? L().recipeMacros(L().recipe(s.rid), s.scale, s.ov) : { k: 0, p: 0, c: 0, f: 0, fb: 0 };
/* Planned totals. mode: 'base' = 3 core meals only; 'selected' (default) = base + add-on only if the user selected it;
   'withExtra' = base + the suggested add-on (preview of "what if I add it"). */
C.plannedTotals = (date, mode) => {
  const p = C.plan(date); mode = mode || 'selected';
  const ks = C.DAY.filter(k => !p[k].off && !p[k].missing && p[k].rid); if ((mode === 'withExtra' || (mode === 'selected' && p.extra.on)) && p.extra.rid && !p.extra.missing) ks.push('extra'); /* a slot switched off (2 meals/day) or without a fitting recipe is not counted */
  return L().roundM(L().sumMacros(ks.map(k => C.slotMacros(p[k]))));
};
C.setExtraOn = (date, on) => C.setPlanSlot(date, 'extra', { on: !!on });
C.proteinGap = date => { const t = C.targets(); if (!t) return 0; const b = C.plannedTotals(date, 'selected'); return Math.round(t.protein - b.p); };
C.entries = date => ((S().load('nutrition').log[date] || {}).entries) || [];
C.eatenTotals = date => L().roundM(L().sumMacros(C.entries(date).map(e => ({ k: e.k, p: e.p, c: e.c, f: e.f, fb: e.fb || 0 }))));
C.slotEntry = (date, slot) => C.entries(date).find(e => e.slot === slot);
C.isPast = date => date < S().today();
C.unlocked = {};
C.locked = date => C.isPast(date) && !C.unlocked[date];
C.setPlanSlot = (date, slot, patch) => {
  const nu = S().load('nutrition'); nu.plan[date] = nu.plan[date] || {};
  const cur = nu.plan[date][slot] || {}; /* choosing a dish (rid) starts a fresh entry: an old automatic fix (auto/from/cuisine) must not stick to the user's choice */
  nu.plan[date][slot] = 'rid' in patch ? Object.assign(cur.on != null ? { on: cur.on } : {}, patch) : Object.assign({}, cur, patch);
  return S().save('nutrition') || (S().storageOKAtStart ? false : 'memory'); /* M11.3: false = the write failed (Store rolled the change back); 'memory' = no storage on this browser, kept for this session */
};
C.addEntry = (date, e) => { const nu = S().load('nutrition'); nu.log[date] = nu.log[date] || { entries: [] }; e.id = e.id || ('e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)); e.at = new Date().toISOString(); nu.log[date].entries.push(e); S().save('nutrition'); return e; };
C.removeEntry = (date, id) => { const nu = S().load('nutrition'); const l = nu.log[date]; if (!l) return; l.entries = l.entries.filter(x => x.id !== id); S().save('nutrition'); };
C.updateEntry = (date, id, patch) => { const nu = S().load('nutrition'); const l = nu.log[date]; if (!l) return; const e = l.entries.find(x => x.id === id); if (e) Object.assign(e, patch); S().save('nutrition'); };
C.eatSlot = (date, slot, portion) => {
  const s = C.plan(date)[slot], r = L().recipe(s.rid), m = L().recipeMacros(r, s.scale * portion, s.ov);
  if (slot === 'extra' && !s.on) C.setExtraOn(date, true); // eating the add-on means it was chosen
  const ex = C.slotEntry(date, slot); // never count the same slot twice
  const rec = { slot, rid: r.id, name: r.he, portion, scale: s.scale, ov: s.ov, k: m.k, p: m.p, c: m.c, f: m.f, fb: m.fb, source: 'plan', est: !!r.est };
  if (ex) { C.updateEntry(date, ex.id, rec); return ex; }
  return C.addEntry(date, rec);
};
C.isFlexWeek = date => { const n = C.programDay(date); return n >= 1 && n <= 30; };
C.flexUsedInWeek = date => { const n = C.programDay(date); const w = Math.ceil(n / 7); const nu = S().load('nutrition'); return Object.keys(nu.log).some(d => { const dn = C.programDay(d); return Math.ceil(dn / 7) === w && (nu.log[d].entries || []).some(e => e.source === 'flex'); }); };
/* tracking */
C.daily = date => { const t = S().load('tracking'); return t.daily[date] || {}; };
C.setDaily = (date, patch) => { const t = S().load('tracking'); t.daily[date] = Object.assign({}, t.daily[date] || {}, patch); S().save('tracking'); };
C.measures = () => S().load('tracking').measures.slice().sort((a, b) => a.date < b.date ? -1 : 1);
C.latestWeight = () => { const m = C.measures().filter(x => x.weight); return m.length ? m[m.length - 1].weight : C.profile().weight; };
/* M10 · hydration. Daily water stays stored in ml (no data change); everything the user reads is in liters.
   The suggested target is a transparent ESTIMATE for plain water/drinks, not a prescription:
   total fluids ≈ weight × 35/30/25 ml (age ≤55 / ≤65 / >65; 30 if age unknown), ~20% of fluids come from food → ×0.8 for drinks,
   + activity level (פעיל +0.25 L, פעיל מאוד +0.5 L) + today's workout (~0.5 L per hour, min 0.25 L). No weather adjustment
   (no reliable weather source). Without a weight: general estimate 2 L (women/unknown) or 2.5 L (men) of total fluids.
   Rounded to 0.25 L and kept within 1.5–4 L. A past day keeps the target that was in force when water was logged. */
C.fmtL = ml => String(Math.round((+ml || 0) / 10) / 100);
C.workoutMinutesOn = date => { try { const pl = root.MealPlan && root.Plans && root.MealPlan.planFor(date); if (pl) { const pd = root.Insights ? root.Insights.mainOn(pl, date) : null; return pd && root.Plans.isTraining(pd) && pd.status !== 'skipped' ? Math.round(pd.minutes || 45) : 0; }
  const n = C.programDay(date); if (n >= 1 && n <= 30 && C.isTraining(n) && !C.nutritionOnly()) return Math.round(L().estimateMinutes(C.dayDef(n), 'std') || 45); } catch (e) { } return 0; };
C.waterSuggest = date => {
  const p = C.profile(), parts = []; let total, est = false;
  const perKg = p.age == null ? 30 : p.age <= 55 ? 35 : p.age <= 65 ? 30 : 25;
  if (p.weight > 0) { total = p.weight * perKg; parts.push(`${p.weight} ק״ג × ${perKg} מ״ל${p.age == null ? ' (גיל לא ידוע)' : ''} ≈ ${C.fmtL(total)} ליטר נוזלים בסך הכול`); }
  else { est = true; total = p.sex === 'm' ? 2500 : 2000; parts.push(`אין משקל בפרופיל — הערכה כללית: ${C.fmtL(total)} ליטר נוזלים ליום`); }
  let drink = total * 0.8; parts.push(`כ־20% מהנוזלים מגיעים מהאוכל → כ־${C.fmtL(drink)} ליטר לשתייה`);
  const act = { moderate: 250, vigorous: 500 }[p.activity] || 0; if (act) { drink += act; parts.push(`רמת פעילות: +${C.fmtL(act)} ליטר`); }
  const wm = C.workoutMinutesOn(date || S().today()); if (wm) { const add = Math.max(250, Math.round(wm / 60 * 500 / 250) * 250); drink += add; parts.push(`אימון היום (כ־${wm} דק׳): +${C.fmtL(add)} ליטר`); }
  return { ml: Math.min(4000, Math.max(1500, Math.round(drink / 250) * 250)), est, parts };
};
C.waterManual = p => { const g = (p || C.profile()).goals || {}; return g.waterMode === 'manual' || (g.waterMode == null && g.water > 0 && g.water !== 3000); /* before M10 the target was always typed by hand; 3000 was the untouched default */ };
C.waterGoalOn = date => {
  date = date || S().today(); const dl = C.daily(date);
  if (dl.waterGoal > 0 && date < S().today()) return { ml: dl.waterGoal, manual: !!dl.waterGoalManual, past: true };
  const p = C.profile(); if (C.waterManual(p)) return { ml: p.goals.water, manual: true, suggested: C.waterSuggest(date) };
  const s = C.waterSuggest(date); return { ml: s.ml, manual: false, est: s.est, suggested: s };
};
C.addWater = (date, ml) => { const g = C.waterGoalOn(date), v = Math.max(0, (C.daily(date).water || 0) + ml); C.setDaily(date, { water: v, waterGoal: g.ml, waterGoalManual: g.manual }); };
/* M10: nutrition-only mode — the user chose no workouts for now. A personal plan, once activated, always wins. */
C.nutritionOnly = () => C.profile().mode === 'nutrition' && !(root.Plans && root.Plans.active());
C.dailyProgress = date => {
  const n = C.programDay(date), tasks = [], g = C.profile().goals, dl = C.daily(date);
  /* Stage D: a date covered by a personal plan counts THAT plan's workout (or none on its rest days), not the classic program's */
  const pl = root.MealPlan && root.Plans && root.MealPlan.planFor(date);
  if (pl) { const pd = root.Insights ? root.Insights.mainOn(pl, date) : null; if (pd && root.Plans.isTraining(pd) && pd.status !== 'skipped') tasks.push({ k: 'workout', he: 'אימון', v: pd.status === 'done' ? 1 : pd.status === 'partial' ? 0.5 : 0 }); }
  else if (n >= 1 && n <= 30 && C.isTraining(n) && !C.nutritionOnly()) { const st = C.status(n); tasks.push({ k: 'workout', he: 'אימון', v: st === 'done' ? 1 : st === 'partial' ? 0.5 : 0 }); }
  { const pl0 = C.plan(date); C.DAY.filter(s => (pl0[s].rid && !pl0[s].off) || C.slotEntry(date, s)).forEach(s => tasks.push({ k: s, he: C.slotNames[s], v: C.slotEntry(date, s) ? 1 : 0 })); }
  tasks.push({ k: 'water', he: 'מים', v: Math.min(1, (dl.water || 0) / C.waterGoalOn(date).ml) });
  { const A = root.Activity, tg = A ? A.targetOn(date) : (g.steps > 0 ? g.steps : null), sv = A ? A.day(date).value : dl.steps; /* RC5: no target → no steps task (nothing to fall short of) */
    if (tg) tasks.push({ k: 'steps', he: 'צעדים', v: Math.min(1, (sv || 0) / tg) }); }
  tasks.push({ k: 'sleep', he: 'שינה', v: dl.sleep ? 1 : 0 });
  const pct = Math.round(tasks.reduce((s, t) => s + t.v, 0) / tasks.length * 100);
  return { tasks, pct };
};
/* weekly aggregation (program weeks) */
C.weekRange = w => { const a = (w - 1) * 7 + 1, b = Math.min(30, w * 7 + (w === 4 ? 2 : 0)); return [a, b]; };
C.weekSummary = w => {
  const [a, b] = C.weekRange(w), t = S().load('tracking');
  let wDone = 0, wTot = 0, steps = [], sleep = [], kcal = [], prot = [], weights = [], rpe = [];
  for (let n = a; n <= b; n++) {
    const d = C.dateOfDay(n);
    if (C.isTraining(n)) { wTot++; const lg = C.log(n); if (lg && lg.status === 'done') wDone++; else if (lg && lg.status === 'partial') wDone += 0.5; if (lg && lg.rpe) rpe.push(lg.rpe); }
    const dl = t.daily[d] || {}, sv = root.Activity ? root.Activity.day(d, t).value : dl.steps; if (sv) steps.push(sv); if (dl.sleep) sleep.push(dl.sleep);
    const en = C.entries(d); if (en.length) { const tt = C.eatenTotals(d); kcal.push(tt.k); prot.push(tt.p); }
    t.measures.filter(m => m.date === d && m.weight).forEach(m => weights.push(m.weight));
  }
  const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
  return { w, a, b, wDone, wTot, steps: avg(steps), sleep: avg(sleep), kcal: avg(kcal), prot: avg(prot), weight: avg(weights), rpe: avg(rpe), daysLogged: kcal.length };
};
C.testRun = n => (S().load('workouts').tests || {})[n] || null;
C.testResults = () => { const out = {}; [1, 29].forEach(n => { const t = C.testRun(n); out[n] = t ? Object.assign({ _date: t.date, _var: t.pushVar }, t.results) : {}; }); return out; };
/* best set per exercise per logged session, from the classic 30-day log AND every personal plan (current, replaced,
   cancelled) — ordered by the date the session was logged. { ex: [{ date, v, unit: 'reps'|'sec', src: 'classic'|'plan', ref }] } */
C.exerciseHistory = () => {
  const w = S().load('workouts'), hist = {};
  const add = (sets, date, src, ref) => { const best = {}; (sets || []).forEach(s => { if (!s.done || s.sec !== 'main' || !root.EX_BY_ID[s.ex]) return; const v = s.reps != null ? s.reps : (s.secs || 0), u = s.reps != null ? 'reps' : 'sec'; if (!best[s.ex] || v > best[s.ex].v) best[s.ex] = { v, unit: u }; });
    Object.entries(best).forEach(([ex, b]) => { (hist[ex] = hist[ex] || []).push({ date, v: b.v, unit: b.unit, src, ref }); }); };
  Object.keys(w.days).forEach(n => { const lg = w.days[n]; add(lg.sets, lg.date || C.dateOfDay(+n), 'classic', 'יום ' + n); });
  if (root.Plans) root.Plans.list().filter(p => p.status !== 'draft').forEach(p => Object.entries(p.log || {}).forEach(([n, lg]) => add(lg.sets, lg.date, 'plan', p.id + ':' + n)));
  Object.values(hist).forEach(l => l.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return hist;
};
/* controlled adjustment suggestions — never auto-applied */
C.suggestions = () => {
  if (root.Plans && root.Plans.active()) return C.weightSuggestions(); /* Stage F: classic-program suggestions don't apply while a personal plan runs */
  const out = [], w = S().load('workouts'), today = S().today(), tn = C.todayN();
  Object.keys(w.feedback).forEach(ex => {
    const fb = w.feedback[ex] || []; const last = fb.slice(-2); const e = root.EX_BY_ID[ex]; if (!e) return;
    const cur = w.levels[ex] || 'normal';
    if (last.length === 2 && last.every(x => x === 'easy') && cur !== 'hard') out.push({ kind: 'up', ex, from: cur, to: cur === 'easy' ? 'normal' : 'hard', he: `"${e.he}" סומן "קל מדי" בשני אימונים רצופים. אפשר לעבור לרמת ${C.LEVEL_HE[cur === 'easy' ? 'normal' : 'hard']}: ${e.levels[cur === 'easy' ? 'normal' : 'hard']}` });
    if (fb.length && fb[fb.length - 1] === 'fail' && cur !== 'easy') out.push({ kind: 'down', ex, from: cur, to: cur === 'hard' ? 'normal' : 'easy', he: `לא הושלמו כל הסטים ב"${e.he}". מומלץ לעבור זמנית לגרסה: ${e.levels[cur === 'hard' ? 'normal' : 'easy']}` });
  });
  const dl = C.daily(today);
  if (dl.energy && dl.energy <= 2 && tn >= 1 && tn <= 30 && C.isTraining(tn)) out.push({ kind: 'fatigue', he: 'דיווחת על אנרגיה נמוכה היום. אפשר לבחור בגרסת 15 הדקות, להפחית סט בכל תרגיל, או להחליף את היום בהליכה וניידות.' });
  const lastDone = Object.keys(w.days).map(Number).filter(n => w.days[n].rpe).sort((a, b) => b - a)[0];
  if (lastDone && w.days[lastDone].rpe >= 9 && lastDone >= tn - 1) out.push({ kind: 'fatigue', he: `האימון האחרון דורג ${w.days[lastDone].rpe}/10. אם ההתאוששות לא מלאה — התחילו היום בגרסה הקצרה.` });
  const missed = []; for (let n = Math.max(1, tn - 6); n < Math.min(31, tn); n++) if (C.status(n) === 'missed') missed.push(n);
  if (missed.length) out.push({ kind: 'missed', days: missed, he: `ימים שהוחמצו השבוע: ${missed.join(', ')}. התוכנית ממשיכה מהיום בלי לאבד נתונים; אפשר להשלים אימון שהוחמץ במקום יום התאוששות.` });
  return out.concat(C.weightSuggestions());
};
C.weightSuggestions = () => {
  const out = [], ms = C.measures().filter(m => m.weight);
  if (ms.length >= 4) {
    const first = ms.slice(0, 3).reduce((s, m) => s + m.weight, 0) / 3, last = ms.slice(-3).reduce((s, m) => s + m.weight, 0) / 3;
    const p = C.profile();
    if (Math.abs(last - p.weight) >= 2) out.push({ kind: 'weight', he: `ממוצע 3 השקילות האחרונות (${last.toFixed(1)} ק״ג) שונה ב־2 ק״ג ומעלה מהמשקל שבחישוב היעדים (${p.weight}). כדאי לעדכן משקל בהגדרות ולחשב יעדים מחדש. השינוי לא מתבצע אוטומטית.` });
    else if (first - last > 0 && ms.length >= 6 && (first - last) / ms.length > 0.35) out.push({ kind: 'weight', he: 'קצב הירידה במשקל מהיר יחסית. אם יש עייפות או ירידה בביצועים, שקלו להעלות מעט את הקלוריות.' });
  }
  return out;
};
/* ── food preferences engine ──
   prefs: { dairy, egg, chicken } = allowed (true) / excluded (false); veg = vegetarian (no chicken, no eggs); exclude = [foodId, …].
   Planned (future, not-yet-eaten) slots that conflict are fixed: first by swapping removable sides (side: true) or ghee→oil,
   otherwise by replacing the meal with the closest compliant recipe of the same type. Fixes are marked auto:'pref' and
   reverted when preferences change. Food already logged as eaten is never touched. */
C.PREF_GROUPS = { dairy: ['curd', 'hung_curd', 'milk', 'paneer', 'ghee', 'greek_yogurt', 'cottage', 'feta', 'mozzarella'], egg: ['egg', 'egg_white'], chicken: ['chicken_breast', 'chicken_thigh', 'chicken_mince'],
  fish: ['salmon', 'white_fish', 'tuna_can', 'sardines'], meat: ['beef_lean', 'turkey'] };
C.PREF_HE = { dairy: 'מוצרי חלב', egg: 'ביצים', chicken: 'עוף', fish: 'דגים', meat: 'בשר בקר/הודו' };
/* veg = vegetarian as defined in this app: no chicken/meat/fish and no eggs (dairy allowed). vegan = also no dairy.
   meals = meals per day in generated menus (2 or 3); maxPrep = max prep+cook minutes for generated menus (null = any). */
C.normPrefs = p => Object.assign({ chicken: true, egg: true, dairy: true, fish: true, meat: true, veg: false, vegan: false, exclude: [], meals: 3, maxPrep: null, flex: true, flexName: 'ארוחה גמישה' }, root.FIT30_DEFAULTS || null /* Admin CMS app settings: defaults for what the user never set */, p || {});
/* excluding one food of an allergen family excludes the whole family (e.g. soya → tofu, soy milk, soy sauce) */
const FAMILY = ['peanut', 'soy', 'fish', 'tree_nut', 'sesame'];
C.familyOf = f => { const a = root.CATALOG && root.CATALOG.ALLERGEN_OF[f]; return [].concat(a || []).filter(x => FAMILY.includes(x)); };
const _blk = new Map();
C.blockedFoods = prefs => {
  const p = C.normPrefs(prefs || C.profile().prefs), key = JSON.stringify(p); if (_blk.has(key)) return _blk.get(key);
  const b = C._blocked(p); if (_blk.size > 50) _blk.clear(); _blk.set(key, b); return b;
};
/* Restriction kinds (Stage H1): allergy / intolerance / preference. Blocking is identical for all kinds — no restriction
   is ever bypassed silently — the kind only changes how warnings are worded. Stored in profile.restrictionKinds, outside
   prefs, so existing plan menu parameters do not change. Keys: a food id from the exclude list, or a group key
   (dairy, egg, chicken, fish, meat, glutenFree, veg, vegan). */
C.KIND_HE = { allergy: 'אלרגיה', intolerance: 'אי־סבילות', pref: 'העדפה', unset: 'הגבלה' };
C.restrictionKinds = () => C.profile().restrictionKinds || {};
C.kindOf = f => { /* why is food f blocked, and what kind of restriction is it */
  const p = C.normPrefs(C.profile().prefs), K = C.restrictionKinds(), out = [];
  (p.exclude || []).forEach(x => { if (x === f || (C.familyOf(x).length && C.familyOf(f).some(y => C.familyOf(x).includes(y)))) out.push(K[x] || 'unset'); });
  const g = Object.keys(C.PREF_GROUPS).find(k => C.PREF_GROUPS[k].includes(f));
  if (g && p[g] === false) out.push(K[g] || 'unset');
  if (g && (p.veg || p.vegan) && g !== 'dairy') out.push(K[p.vegan ? 'vegan' : 'veg'] || 'pref');
  if (g === 'dairy' && p.vegan) out.push(K.vegan || 'pref');
  if (p.glutenFree && root.CATALOG && [].concat(root.CATALOG.ALLERGEN_OF[f] || []).some(a => a === 'gluten' || a === 'gluten_may')) out.push(K.glutenFree || 'unset');
  return out;
};
const KIND_RANK = { allergy: 3, intolerance: 2, unset: 1, pref: 0 };
C.worstKind = foods => { let best = null; foods.forEach(f => C.kindOf(f).forEach(k => { if (best == null || KIND_RANK[k] > KIND_RANK[best]) best = k; })); return best || 'unset'; };
C._blocked = p => {
  const b = new Set();
  const veg = p.veg || p.vegan;
  if (!p.dairy || p.vegan) C.PREF_GROUPS.dairy.forEach(f => b.add(f));
  if (!p.egg || veg) C.PREF_GROUPS.egg.forEach(f => b.add(f));
  if (!p.chicken || veg) C.PREF_GROUPS.chicken.forEach(f => b.add(f));
  if (!p.fish || veg) C.PREF_GROUPS.fish.forEach(f => b.add(f));
  if (!p.meat || veg) C.PREF_GROUPS.meat.forEach(f => b.add(f));
  /* gluten-free (P07: "when the ingredients can be verified"): every food tagged gluten or may-contain-gluten (oats) in the
     catalog. Stored only when on (absent = off), so older saved plans keep identical menu parameters. */
  if (p.glutenFree && root.CATALOG) Object.keys(N().FOODS).forEach(f => { const a = [].concat(root.CATALOG.ALLERGEN_OF[f] || []); if (a.includes('gluten') || a.includes('gluten_may')) b.add(f); });
  (p.exclude || []).forEach(f => { b.add(f); const fam = C.familyOf(f); if (fam.length) Object.keys(N().FOODS).forEach(g => { if (C.familyOf(g).some(x => fam.includes(x))) b.add(g); }); });
  return b;
};
C.conflicts = (r, ov, prefs) => { const b = C.blockedFoods(prefs); return L().recipeIngredients(r, ov).map((x, idx) => ({ idx, f: x.f, side: !!x.side || x.f === 'ghee', g: x.g })).filter(x => b.has(x.f)); };
C.conflictText = cs => { const names = Array.from(new Set(cs.map(c => N().FOODS[c.f].he.split(' (')[0]))); return 'מכיל ' + names.join(', '); };
C.recipeOk = (r, prefs) => C.conflicts(r, null, prefs).length === 0;
const SUB_PROTEIN = ['soya', 'roasted_chana', 'egg_white', 'chicken_breast', 'egg', 'hung_curd', 'sprouts', 'paneer'];
const SUB_CAP = { soya: 60, roasted_chana: 50, egg_white: 200, chicken_breast: 200, egg: 200, hung_curd: 250, sprouts: 200, paneer: 120, kala_chana: 80 }; // grams per serving
C.subFor = (ing, prefs) => {
  const b = C.blockedFoods(prefs), F = N().FOODS;
  if (ing.f === 'ghee') return b.has('oil') ? null : { f: 'oil', g: ing.g };
  const grp = Object.keys(N().SWAP).find(k => N().SWAP[k].includes(ing.f)) || F[ing.f].grp;
  const proteinish = ['dairy', 'protein', 'legume'].includes(grp) || ['dairy', 'protein'].includes(F[ing.f].grp);
  const pool = proteinish ? SUB_PROTEIN : (N().SWAP[grp] || []);
  for (const to of pool) {
    if (to === ing.f || b.has(to)) continue;
    const g = L().suggestSwapGrams({ f: ing.f, g: ing.g, role: 'protein' }, to).g;
    if (!SUB_CAP[to] || g <= SUB_CAP[to]) return { f: to, g };
  }
  return null;
};
/* M10.4 · cuisine preferences — a SOFT preference, kept separate from restrictions (C.conflicts) and from location (never read).
   prefs.cuisines: chosen groups (none or 'international' = everything, balanced in the personal menu); prefs.cuisineMain: the favourite.
   A recipe's cuisine comes from CATALOG.recipeFacts (derived from the recipe data, not stored twice). */
C.CUISINE_GROUPS = { israeli: { he: 'ישראלי', codes: ['israeli', 'middle_eastern', 'moroccan'] }, mediterranean: { he: 'ים־תיכוני', codes: ['mediterranean', 'greek', 'italian', 'middle_eastern'] },
  western: { he: 'מערבי', codes: ['american', 'international', 'italian', 'mexican'] }, indian: { he: 'הודי', codes: ['indian', 'himachali'] }, asian: { he: 'אסייתי', codes: ['asian', 'tibetan'] }, international: { he: 'מגוון בינלאומי', codes: null } };
C.cuisineOf = r => (root.CATALOG && root.CATALOG.recipeFacts ? root.CATALOG.recipeFacts(r).cuisine : r.cuisine) || 'indian';
/* P0 fix: with no choice the menu used to stay the original (mostly Indian) 30-day menu. Default now = Israeli + Mediterranean + Western;
   Indian only when chosen (or 'international' = everything). Location never decides this. */
C.DEFAULT_CUISINES = ['israeli', 'mediterranean', 'western'];
C.cuisineChoice = prefs => { const pf = prefs || C.normPrefs(C.profile().prefs), cs = (pf.cuisines || []).filter(k => C.CUISINE_GROUPS[k]), rg = pf.region;
  return cs.length ? cs : rg && rg.consent && rg.group && C.CUISINE_GROUPS[rg.group] ? [rg.group] : C.DEFAULT_CUISINES; }; /* explicit choice > regional match (consent only) > default */
C.cuisineSet = prefs => { const cs = C.cuisineChoice(prefs); if (cs.includes('international')) return null; return new Set(cs.flatMap(k => C.CUISINE_GROUPS[k].codes)); };
C.cuisineAllowed = (r, prefs) => { const s = C.cuisineSet(prefs); return !s || s.has(C.cuisineOf(r)); };
C.cuisineMainOk = (r, prefs) => !!(prefs && prefs.cuisineMain && C.CUISINE_GROUPS[prefs.cuisineMain] && C.CUISINE_GROUPS[prefs.cuisineMain].codes && C.CUISINE_GROUPS[prefs.cuisineMain].codes.includes(C.cuisineOf(r)));
/* returns {action:'ok'|'ing'|'meal'|'none', rid, ov, conflicts, cuisineMiss?}. Restrictions always win: a cuisine is only preferred
   among dishes that are already safe; if no safe dish of the chosen cuisine exists, a safe dish of another cuisine is used and
   flagged (cuisineMiss) — never the other way round. */
/* portion for a replacement dish: keep the replaced meal's protein (and at least its energy), but never more than +15% energy; 0.6–1.8×, 0.05 steps */
C.matchScale = (a, b) => { if (!(a.k > 0 && b.k > 0)) return 1; let sc = Math.max(a.k / b.k, b.p > 0 ? a.p / b.p : 0); sc = Math.min(sc, a.k * 1.15 / b.k); return Math.max(0.6, Math.min(1.8, Math.round(sc * 20) / 20)); };
/* variety: replacements rotate through the closest few candidates by date, so a week is not the same dish every day */
C.rotOf = date => Math.floor(Date.parse(date + 'T12:00:00Z') / 864e5);
const rotate = (arr, rot) => { if (rot == null || arr.length < 2) return arr; const best = arr[0].pscore || 0, near = arr.filter(o => (o.pscore || 0) <= best + 1.5).length; /* only near-equivalent dishes take turns */
  const k = Math.min(5, Math.max(1, near)), i = rot % k; return arr.slice(i, k).concat(arr.slice(0, i), arr.slice(k)); };
C.resolveSlot = (rid, ov, mealType, prefs, avoid, rot) => {
  const r = L().recipe(rid), cs = C.conflicts(r, ov, prefs), cuOk = C.cuisineAllowed(r, prefs), disliked = ((C.profile().nutritionDislike) || []).includes(rid);
  if (!cs.length && cuOk && !disliked) return { action: 'ok', rid, ov };
  if (!cs.length) { /* safe, but not the chosen cuisine or marked "לא אוהב/ת" */ /* safe but not the chosen cuisine → look for a safe dish of the chosen cuisine */
    const baseM = L().recipeMacros(r, 1, ov), dis = new Set((C.profile().nutritionDislike) || []);
    /* a disliked dish may fall back to a safe dish of ANOTHER cuisine (flagged cuisineMiss); a merely other-cuisine dish is only
       swapped for a dish of the chosen cuisine (swapping it for another other-cuisine dish would change nothing for the user) */
    const cands = L().swapCandidates(r, N().RECIPES).filter(o => !o.r.est && !dis.has(o.r.id) && (!avoid || !avoid.includes(o.r.id)) && (disliked || C.cuisineAllowed(o.r, prefs)))
      .map(o => Object.assign(o, { cu: C.cuisineAllowed(o.r, prefs), pscore: Math.abs(o.m.k - baseM.k) / 100 + Math.max(0, baseM.p - o.m.p) / 4 + (C.cuisineAllowed(o.r, prefs) ? 0 : 1000) - (C.cuisineMainOk(o.r, prefs) ? 1.5 : 0) })).sort((a, z) => a.pscore - z.pscore);
    const okC = cands.filter(o => o.cu), restC = cands.filter(o => !o.cu);
    for (const o of rotate(okC, rot).concat(restC)) { const c2 = C.conflicts(o.r, null, prefs), extra = o.cu ? {} : { cuisineMiss: true }; if (!c2.length) return Object.assign({ action: 'meal', rid: o.r.id, ov: null, conflicts: [], cuisine: true, disliked }, extra);
      if (c2.every(c => c.side)) { const nov = {}; let ok = true; c2.forEach(c => { const sub = C.subFor({ f: c.f, g: c.g }, prefs); if (sub) nov[c.idx] = sub; else ok = false; }); if (ok) return Object.assign({ action: 'meal', rid: o.r.id, ov: nov, conflicts: [], cuisine: true, disliked }, extra); } }
    return { action: 'ok', rid, ov, cuisineMiss: !cuOk, dislikedKept: disliked };
  }
  let ingRes = null;
  if (cs.every(c => c.side)) {
    const nov = Object.assign({}, ov || {}); let ok = true;
    cs.forEach(c => { const sub = C.subFor({ f: c.f, g: c.g }, prefs); if (sub) nov[c.idx] = sub; else ok = false; });
    if (ok) { ingRes = { action: 'ing', rid, ov: nov, conflicts: cs }; if (C.cuisineAllowed(r, prefs) && !((C.profile().nutritionDislike) || []).includes(rid)) return ingRes; } /* fixed in place only when the dish itself is still wanted */
  }
  const baseM = L().recipeMacros(r, 1, ov);
  const disR = new Set((C.profile().nutritionDislike) || []);
  const cands = L().swapCandidates(r, N().RECIPES).filter(o => !o.r.est && (!avoid || !avoid.includes(o.r.id)))
    .map(o => Object.assign(o, { pscore: Math.abs(o.m.k - baseM.k) / 100 + Math.max(0, baseM.p - o.m.p) / 4 + (C.cuisineAllowed(o.r, prefs) ? 0 : 1000) + (disR.has(o.r.id) ? 5000 : 0) - (C.cuisineMainOk(o.r, prefs) ? 1.5 : 0) })).sort((a, z) => a.pscore - z.pscore); /* M10.4: chosen cuisine first, any SAFE dish after; a "לא אוהב/ת" dish only if nothing else is safe */
  const good = cands.filter(o => o.pscore < 1000), tryList = list => { for (const o of list) {
    const c2 = C.conflicts(o.r, null, prefs);
    if (!c2.length) return { action: 'meal', rid: o.r.id, ov: null, conflicts: cs };
    if (c2.every(c => c.side)) { const nov = {}; let ok = true; c2.forEach(c => { const sub = C.subFor({ f: c.f, g: c.g }, prefs); if (sub) nov[c.idx] = sub; else ok = false; }); if (ok) return { action: 'meal', rid: o.r.id, ov: nov, conflicts: cs }; }
  } return null; };
  /* order: a safe dish of the wanted cuisines > the same dish with a substitute > a safe dish of another cuisine */
  return tryList(rotate(good, rot)) || ingRes || tryList(cands.filter(o => o.pscore >= 1000)) || { action: 'none', rid, ov, conflicts: cs };
};
/* Per-day protein top-up used after preference changes: raises lean protein portions in the day's 3 base meals
   (same rules as the authored base menu: no eggs/egg whites/roti/bread/oil; ≤ cap per food; ≤2450 kcal), then simple carbs if <2200 kcal. */
const PRO_ADJ = { chicken_breast: [10, 1.35, 320], chicken_thigh: [10, 1.35, 320], chicken_mince: [10, 1.35, 320], soya: [5, 1.5, 75], masoor: [5, 1.4, 115], moong: [5, 1.4, 115], toor: [5, 1.4, 115], rajma: [5, 1.4, 115], chana: [5, 1.4, 115], kala_chana: [5, 1.4, 115], besan: [5, 1.3, 110], hung_curd: [25, 1.4, 300], roasted_chana: [5, 1.4, 70], sprouts: [20, 1.5, 260], paneer: [10, 1.25, 180],
  tofu: [10, 1.4, 320], tuna_can: [10, 1.4, 220], salmon: [10, 1.25, 220], white_fish: [10, 1.35, 300], turkey: [10, 1.35, 300], beef_lean: [10, 1.3, 250], greek_yogurt: [25, 1.5, 350], cottage: [25, 1.5, 300], black_beans: [20, 1.4, 320], chickpeas_cooked: [20, 1.4, 300], edamame: [10, 1.4, 250] };
const CARB_ADJ = { rice: [5, 1.4, 150], oats: [5, 1.4, 95], poha: [5, 1.4, 110], potato: [20, 1.5, 320], banana: [20, 1.8, 200], apple: [25, 1.7, 250], orange: [30, 1.6, 220], guava: [25, 1.6, 220], sweet_potato: [20, 1.5, 270], noodles: [5, 1.4, 140], peas: [10, 1.5, 130], pasta: [5, 1.4, 140], quinoa: [5, 1.4, 110], bulgur: [5, 1.4, 110], couscous: [5, 1.4, 120], corn: [10, 1.5, 150], berries: [20, 1.6, 200], strawberries: [25, 1.6, 250] };
C.boostDay = (slots, prot, prefs, opt) => { const kMin = (opt && opt.kMin) || 2200, kMax = (opt && opt.kMax) || 2450; /* defaults = the original 30-day menu bounds */ // slots: {m1:{rid,ov}, …} → returns {slotKey: ov} for changed slots
  const b = C.blockedFoods(prefs), cur = {}; Object.keys(slots).forEach(k => { cur[k] = L().recipeIngredients(L().recipe(slots[k].rid), slots[k].ov).map(x => ({ f: x.f, g: x.g })); });
  const base = {}; Object.keys(slots).forEach(k => { base[k] = L().recipe(slots[k].rid).ing.map(x => x.g); });
  const tot = () => L().roundM(L().sumMacros(Object.values(cur).flat().map(L().ingMacros)));
  const opts = T => Object.keys(cur).flatMap(k => cur[k].map((x, i) => ({ k, i, x })).filter(o => T[o.x.f] && !b.has(o.x.f)));
  let changed = {}, guard = 0;
  while (tot().p < prot && guard++ < 300) {
    const c = opts(PRO_ADJ).filter(o => { const [st, mul, cap] = PRO_ADJ[o.x.f]; return o.x.g + st <= Math.min(cap, Math.round(base[o.k][o.i] * mul)) && tot().k + L().ingMacros({ f: o.x.f, g: st }).k <= kMax; })
      .sort((a, z) => (N().FOODS[z.x.f].p / N().FOODS[z.x.f].k) - (N().FOODS[a.x.f].p / N().FOODS[a.x.f].k));
    if (!c.length) break; c[0].x.g += PRO_ADJ[c[0].x.f][0]; changed[c[0].k] = true;
  }
  guard = 0;
  while (tot().k < kMin && guard++ < 300) {
    const c = opts(CARB_ADJ).filter(o => { const [st, mul, cap] = CARB_ADJ[o.x.f]; return o.x.g + st <= Math.min(cap, Math.round(base[o.k][o.i] * mul)); }).sort((a, z) => a.x.g / base[a.k][a.i] - z.x.g / base[z.k][z.i]);
    if (!c.length) break; c[0].x.g += CARB_ADJ[c[0].x.f][0]; changed[c[0].k] = true;
  }
  const out = {}; Object.keys(changed).forEach(k => { const r = L().recipe(slots[k].rid), ov = {}; cur[k].forEach((x, i) => { if (x.f !== r.ing[i].f || x.g !== r.ing[i].g) ov[i] = { f: x.f, g: x.g }; }); out[k] = ov; });
  return { ov: out, p: tot().p, k: tot().k };
};
C.applyPrefs = prefs => {
  const nu = S().load('nutrition'), out = { days: 0, checked: 0, ing: 0, meal: 0, reverted: 0, none: [], short: [], boosted: 0 };
  const start = C.start(), today = S().today();
  for (let n = 1; n <= 30; n++) {
    const date = S().addDays(start, n - 1); if (date < today) continue;
    if (C.planSource(date).kind !== 'classic') { out.planDays = (out.planDays || 0) + 1; continue; } /* personal-plan dates: menus are regenerated from the plan's own preferences */
    out.days++;
    const used = [];
    ['m1', 'm2', 'snack', 'extra'].forEach(slot => {
      if (C.slotEntry(date, slot)) { used.push(C.plan(date, { raw: true })[slot].rid); return; } // eaten: leave as logged
      const cur = nu.plan[date] && nu.plan[date][slot];
      if (cur && cur.auto === 'pref') { // revert previous automatic fix first
        out.reverted++;
        if (cur.prev) nu.plan[date][slot] = cur.prev; else { const keepOn = cur.on; delete nu.plan[date][slot]; if (slot === 'extra' && keepOn) nu.plan[date].extra = { on: true }; }
      }
      const p = C.plan(date, { raw: true })[slot]; out.checked++; if (!p.rid) return;
      const res = C.resolveSlot(p.rid, p.ov, slot, prefs, used, C.rotOf(date));
      if (res.action === 'ok') { used.push(p.rid); return; }
      if (res.action === 'none') { out.none.push({ date, n, slot, name: L().recipe(p.rid).he, why: C.conflictText(res.conflicts) }); used.push(p.rid); return; }
      nu.plan[date] = nu.plan[date] || {};
      const prev = nu.plan[date][slot] ? JSON.parse(JSON.stringify(nu.plan[date][slot])) : null;
      let sc = res.action === 'meal' ? 1 : p.scale;
      if (res.action === 'meal' && res.cuisine) sc = C.matchScale(C.slotMacros(p), L().recipeMacros(L().recipe(res.rid), 1, res.ov)); /* P0 fix: cuisine swaps keep the meal's energy and protein */
      nu.plan[date][slot] = { rid: res.rid, ov: res.ov, scale: sc, auto: 'pref', prev, on: slot === 'extra' ? p.on : undefined, from: p.rid, cuisine: res.cuisine ? (res.disliked ? 'disliked' : 'cuisine') : undefined };
      out[res.action]++; used.push(res.rid);
    });
    // protein top-up for the 3 base meals when replacements lowered the day below target
    const pl = C.plan(date), tt = C.targets(), tp = tt ? tt.protein : null; /* guarded view: never boosts a slot that is empty */
    if (tp != null && C.plannedTotals(date, 'base').p < tp) {
      const free = ['m1', 'm2', 'snack'].filter(k => !C.slotEntry(date, k) && pl[k].rid);
      const bres = C.boostDay(Object.fromEntries(free.map(k => [k, { rid: pl[k].rid, ov: pl[k].ov }])), tp, prefs);
      Object.entries(bres.ov).forEach(([k, ov]) => { nu.plan[date] = nu.plan[date] || {}; const cur = nu.plan[date][k];
        if (cur && cur.auto === 'pref') cur.ov = ov; else nu.plan[date][k] = { rid: pl[k].rid, ov, scale: pl[k].scale, auto: 'pref', prev: cur ? JSON.parse(JSON.stringify(cur)) : null, from: pl[k].rid, boost: true };
        out.boosted = (out.boosted || 0) + 1; });
      if (bres.p < tp) out.short.push({ date, n, p: Math.round(bres.p) });
    }
  }
  S().save('nutrition'); return out;
};
root.Core = C;
if (root.MealPlan && root.MealPlan.hook) root.MealPlan.hook(); /* nutrition engine: record target/preference changes so past days keep their menu */
})(typeof window !== 'undefined' ? window : globalThis);
