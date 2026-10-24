/* Stage G — signature features (logic only; screens in screens_signature.js). Everything is computed from data the user
   entered or the plan/menu generated; nothing is estimated beyond the inputs, and every function returns null/empty
   structures (never invented numbers) when data is missing.
     explain(plan)          G1 Explain My Plan — why the plan, sessions, progression and targets look the way they do
     weeks(plan)/review()   G2 Weekly Review — one plan week: training, nutrition actually logged, daily tracking, weight
     shopping(from, days)   G3 Shopping list + meal-prep suggestions from the planned menu
     records()/milestones() G4 Personal records (per exercise AND level) and verifiable milestones
     Travel.*               G5 Travel / no-equipment mode — temporary, reversible exercise swaps for a date range */
(function (root) {
  'use strict';
  const S = () => root.Store, C = () => root.Core, PS = () => root.Plans, L = () => root.Logic, N = () => root.NUTRI, CT = () => root.CATALOG, PG = () => root.PROGRAMS, PL = () => root.Planner, I = () => root.Insights;
  const r1 = x => Math.round(x * 10) / 10;

  /* ---------- G1 Explain My Plan ---------- */
  function explain(plan) {
    plan = plan || PS().active(); if (!plan) return null;
    const t = PG().byId(plan.templateId), seg = plan.segments[plan.segments.length - 1], prm = seg.params, pv = PS().preview(plan), sm = pv.summary;
    const ds = PS().days(plan), tr = ds.filter(PS().isTraining), out = [];
    const DOW = S().HE_DAYS, eq = (prm.equipment || []).map(e => CT().EQUIPMENT[e] ? CT().EQUIPMENT[e].he : e);
    out.push({ k: 'template', h: 'המסלול', items: [
      `${t.he}: ${t.audience || ''}`.trim(),
      `נבחר לפי המטרה שלך: ${PG().GOALS[prm.goal] || '—'}${prm.secondary && prm.secondary.length ? ' (משניות: ' + prm.secondary.map(g => PG().GOALS[g]).join(', ') + ')' : ''}.`,
      `${plan.days || sm.days} ימים, מ־${S().fmtDate(plan.start)} עד ${S().fmtDate(ds[ds.length - 1].date)}.`] });
    out.push({ k: 'phases', h: 'השלבים — למה התוכנית משתנה לאורך הזמן', items: sm.phases.map(ph => { const K = PG().PHASE_KINDS[ph.k] || {}; /* RC1 (H-11): the actual plan, not the template multiplier — for beginners the ×vol factor can round away */
      const inPh = tr.filter(d => d.n >= ph.startDay && d.n <= ph.endDay && !d.deload && !['assess', 'active', 'mob'].includes(d.type) && (d.main || []).length);
      const avgSets = inPh.length ? Math.round(inPh.reduce((a, d) => a + d.main.reduce((x, it) => x + (it.sets || 0), 0), 0) / inPh.length * 10) / 10 : null;
      const avgD = inPh.length ? Math.round(inPh.reduce((a, d) => a + d.main.reduce((x, it) => x + (root.CATALOG.exFacts(root.EX_BY_ID[it.ex]).d || 1), 0) / d.main.length, 0) / inPh.length * 10) / 10 : null;
      return `שבועות ${Math.ceil(ph.startDay / 7)}–${Math.ceil(ph.endDay / 7)} · ${ph.he}: ${K.focus || ''}${avgSets != null ? ` — בתוכנית שלך: ממוצע ${avgSets} סטים באימון, רמת קושי ממוצעת של התרגילים ${avgD} מתוך 3` : ''}.`; })
      .concat(sm.deloadWeeks ? [`${sm.deloadWeeks} שבועות קלים מתוכננים (פחות סטים) כדי לאפשר התאוששות לפני שלב תובעני יותר.`] : []) });
    out.push({ k: 'schedule', h: 'ימים וזמן', items: [
      `בחרת ${(prm.days || []).map(d => DOW[d]).join(', ')} ו־${prm.spw} אימונים בשבוע, לכן ${sm.sessions} אימונים בתוכנית${sm.assess ? ` (כולל ${sm.assess} ימי מבחן)` : ''}.`,
      `זמן מקסימלי שהגדרת: ${prm.maxMin} דק׳. אורך אימון מחושב: ממוצע ${r1(sm.avgMinutes)} דק׳, הארוך ביותר ${r1(sm.maxMinutes)} דק׳${sm.trimmed ? ` — ב־${sm.trimmed} אימונים הורדו סטים כדי לא לעבור את הזמן` : ''}.`,
      `${sm.rest} ימי מנוחה${sm.active ? ` ו־${sm.active} ימי התאוששות פעילה (הליכה, ניידות)` : ''}. אותן קבוצות שרירים לא עובדות בעצימות גבוהה ביומיים רצופים.`,
      'הזמן הוא הערכה: חימום, עבודה, מנוחות ושחרור לפי קצב ממוצע. בפועל זה תלוי בקצב שלך.'] });
    const exs = new Set(tr.flatMap(d => (d.main || []).map(it => it.ex)));
    out.push({ k: 'exercises', h: 'בחירת התרגילים', items: [
      `${exs.size} תרגילים שונים בתוכנית, מתוך ${root.EXERCISES.length} בספרייה.`,
      eq.length ? `רק תרגילים שמתאימים לציוד שסימנת: ללא ציוד, ${eq.join(', ')}.` : 'רק תרגילים בלי ציוד.',
      prm.exclude && prm.exclude.length ? `לא נכללים תרגילים שהחרגת: ${prm.exclude.map(x => (root.EX_BY_ID[x] || { he: x }).he).join(', ')}.` : 'לא החרגת תרגילים.',
      prm.noJump ? 'ביקשת בלי קפיצות — תרגילי קפיצה לא נכללים.' : 'תרגילי קפיצה יכולים להופיע; אפשר להחריג אותם בפרופיל.',
      `רמת הניסיון שבחרת (${({ beginner: 'מתחיל', intermediate: 'בינוני', advanced: 'מתקדם' })[prm.level] || prm.level}) קובעת את טווח הקושי ואת מספר הסטים ההתחלתי.`] });
    const tg = C().targets(), au = C().autoTargets(), ti = C().targetInputs(), pr = C().profile();
    if (tg && au) {
      const SEXT = { user: '', legacy: ' (הנחה מגרסה קודמת)', unknown: ' (לא צוין מין — נעשה שימוש בערך אמצע)' };
      out.push({ k: 'targets', h: 'יעדי התזונה — איך חושבו', items: [
        `קצב בסיסי (Mifflin–St Jeor): 10×${pr.weight} + 6.25×${pr.height} − 5×${pr.age} ${au.sexK >= 0 ? '+ ' + au.sexK : '− ' + Math.abs(au.sexK)}${SEXT[ti.sexFrom] || ''} = ${au.bmr} קק״ל.`,
        `× ${au.af} (${au.inputs.afFrom === 'user' ? 'רמת הפעילות שבחרת: ' + C().ACTIVITY_HE[au.inputs.activity][0] : 'הנחה — לא נבחרה רמת פעילות; אמצע הטווח "יושבני"'}; כולל את האימונים) = ${au.tdee} קק״ל לשימור (טווח סביר ${au.tdeeLow}–${au.tdeeHigh}).`,
        `${au.deficit > 0 ? `גירעון ${Math.round(au.deficit * 100)}%` : au.deficit < 0 ? `עודף ${Math.round(-au.deficit * 100)}%` : 'בלי גירעון או עודף'} ${au.inputs.deficitFrom === 'minor' ? '(גיל מתחת ל־18 — שימור בלבד)' : au.inputs.deficitFrom === 'underweight' ? '(BMI מתחת ל־18.5 — ללא גירעון)' : 'לפי המטרה'} → ${au.floored ? `${au.kcalRaw}, הוגבל ל־` : ''}${au.kcal} קק״ל.`,
        ...C().targetWarnings().map(w => '⚠ ' + w.text), C().DISCLAIMER,
        `חלבון: 1.8 ג׳ × ${pr.weight} ק״ג ≈ ${au.protein} ג׳. שומן: 25% מהקלוריות ≈ ${au.fat} ג׳. פחמימות: היתרה ≈ ${au.carbs} ג׳.`,
        tg.custom ? `שינית ידנית חלק מהיעדים; התפריט משתמש בערכים שלך: ${tg.kcal} קק״ל, ${tg.protein} ג׳ חלבון.` : 'אלה הערכות. כדאי לבדוק מגמה של כמה שבועות לפני שמשנים — לא יום בודד.'] });
    }
    if (root.MealPlan && plan.nutrition) {
      const np = plan.nutrition.segments[plan.nutrition.segments.length - 1].params, pf = np.prefs || {}, s14 = root.MealPlan.summarize(plan, S().today(), 14);
      const no = []; if (pf.vegan) no.push('טבעוני'); else if (pf.veg) no.push('צמחוני'); ['dairy', 'egg', 'chicken', 'fish', 'meat'].forEach(k => { if (pf[k] === false) no.push('בלי ' + C().PREF_HE[k]); }); (pf.exclude || []).forEach(x => no.push('בלי ' + ((N().FOODS[x] || {}).he || x).split(' (')[0]));
      out.push({ k: 'menu', h: 'התפריט', items: [
        `תפריט נפרד לכל יום בתוכנית, ${np.meals || 3} ארוחות ביום, מכוון ל־${np.kcal} קק״ל ו־${np.protein} ג׳ חלבון.${no.length ? ' העדפות: ' + no.join(', ') + '.' : ''}${np.maxPrep ? ` הכנה עד ${np.maxPrep} דק׳.` : ''}`,
        'גיוון: אותה מנה לא חוזרת יומיים ברצף באותה ארוחה, ומקור החלבון של הארוחה העיקרית מתחלף.',
        'הכמויות מותאמות ליעד: מזונות החלבון והשאר מוגדלים או מוקטנים בנפרד; ביצים ופרוסות נשארים במספר שלם.',
        s14.days ? `ב־14 הימים הקרובים: ממוצע ${s14.kcal} קק״ל ו־${s14.protein} ג׳ חלבון, ${s14.distinct} מנות שונות${s14.gaps ? `, ${s14.gaps} ימים עם פער חלבון (מוצג ביום עצמו)` : ', בלי פער חלבון'}.` : 'אין ימים קרובים בתוכנית.'] });
    }
    out.push({ k: 'adapt', h: 'מה ישנה את התוכנית', items: [
      'רק את מה שאישרת: שינוי ימים, זמן או ציוד, החלפת תרגיל, דילוג או העברה, והתאמות מוצעות לפי ביצועים (כללים קבועים, אחרי אישור).',
      'אימונים וארוחות שכבר נרשמו לא משתנים אף פעם.'] });
    if (plan.segments.length > 1) out.push({ k: 'changes', h: 'עדכונים', items: plan.segments.slice(1).map(sg => `מיום ${sg.fromDay}: הגדרות עודכנו (${S().fmtDate((sg.at || '').slice(0, 10) || plan.start)}).`) });
    return out;
  }

  /* ---------- G2 Weekly Review ---------- */
  function review(plan, w) {
    plan = plan || PS().active(); if (!plan) return null;
    const weeks = I().planWeeks(plan), t = S().today(); if (!weeks.length) return null;
    const done = weeks.filter(x => x.from <= t), wk = w != null ? weeks.find(x => x.w === w) : (done.filter(x => x.past).pop() || done.pop() || weeks[0]); if (!wk) return null;
    const dates = []; for (let d = wk.from; d <= wk.to; d = S().addDays(d, 1)) dates.push(d);
    const past = dates.filter(d => d <= t), tg = C().targets();
    const eat = past.map(d => ({ d, e: C().eatenTotals(d), n: C().entries(d).length })).filter(x => x.n > 0);
    const avg = (arr, f) => arr.length ? Math.round(arr.reduce((s, x) => s + f(x), 0) / arr.length) : null;
    const dl = past.map(d => C().daily(d)), num = k => dl.map(x => x[k]).filter(v => typeof v === 'number' && v > 0);
    const steps = root.Activity ? past.map(d => root.Activity.day(d).value).filter(v => typeof v === 'number' && v > 0) : num('steps'), sleep = num('sleep'), water = num('water');
    const ms = C().measures().filter(m => m.weight && m.date >= wk.from && m.date <= wk.to);
    const prevMs = C().measures().filter(m => m.weight && m.date < wk.from);
    const hist = C().exerciseHistory(), newBest = [];
    Object.entries(hist).forEach(([ex, l]) => { const inW = l.filter(x => x.src === 'plan' && x.ref.startsWith(plan.id + ':') && x.date >= wk.from && x.date <= wk.to), before = l.filter(x => x.date < wk.from);
      if (inW.length && before.length) { const b = Math.max(...inW.map(x => x.v)), a = Math.max(...before.map(x => x.v)); if (b > a) newBest.push({ ex, from: a, to: b, unit: inW[0].unit }); } });
    const next = weeks.find(x => x.w === wk.w + 1) || null, nds = next ? PS().days(plan).filter(d => d.week === next.w && PS().isTraining(d)) : [];
    return { w: wk.w, from: wk.from, to: wk.to, past: wk.past, current: wk.current, phase: wk.phase, deload: wk.deload, weeks: weeks.map(x => x.w),
      training: { planned: wk.planned, done: wk.done, partial: wk.partial, skipped: wk.skipped, missed: wk.missed, minutes: wk.minutes, rpe: wk.rpe },
      nutrition: { daysLogged: eat.length, ofDays: past.length, kcal: avg(eat, x => x.e.k), protein: avg(eat, x => x.e.p), target: tg ? { kcal: tg.kcal, protein: tg.protein } : null },
      tracking: { steps: steps.length ? { avg: avg(steps, x => x), days: steps.length } : null, sleep: sleep.length ? { avg: r1(sleep.reduce((a, b) => a + b, 0) / sleep.length), days: sleep.length } : null, water: water.length ? { avg: avg(water, x => x), days: water.length } : null },
      weight: ms.length ? { n: ms.length, last: ms[ms.length - 1].weight, prev: prevMs.length ? prevMs[prevMs.length - 1].weight : null } : null,
      bests: newBest, next: next ? { w: next.w, from: next.from, sessions: nds.length, deload: next.deload, phase: next.phase, minutes: nds.length ? Math.round(nds.reduce((s, d) => s + (d.minutes || 0), 0)) : 0 } : null,
      adapt: root.Adapt ? root.Adapt.proposals(plan).list.length : 0 };
  }

  /* ---------- G3 Shopping list & meal prep ---------- */
  const GRP_HE = { protein: 'חלבון: עוף, דגים, בשר, ביצים', dairy: 'מוצרי חלב', legume: 'קטניות, טופו וסויה', carb: 'דגנים, לחם ותפוחי אדמה', veg: 'ירקות', fruit: 'פירות', fat: 'שמנים, אגוזים וזרעים', condiment: 'תבלינים ורטבים' };
  const ST_HE = { raw: 'נא', dry: 'יבש', ready: 'מוכן' };
  function shopping(from, days) {
    from = from || S().today(); days = days || 7; const F = N().FOODS, items = {}, recipes = {}, dates = [];
    for (let i = 0; i < days; i++) {
      const d = S().addDays(from, i), p = C().plan(d); dates.push(d);
      C().ALL.forEach(k => { const s = p[k]; if (!s || !s.rid || s.off || s.missing) return; if (k === 'extra' && !s.on) return; if (C().slotEntry && C().slotEntry(d, k)) return; /* already eaten */
        const r = L().recipe(s.rid); if (!r || r.est) return; /* restaurant estimates have no shopping list */
        (recipes[r.id] = recipes[r.id] || { id: r.id, he: r.he, n: 0, dates: [], mealprep: (r.tags || []).includes('mealprep') }); recipes[r.id].n++; recipes[r.id].dates.push(d);
        L().recipeIngredients(r, s.ov).forEach(x => { const g = x.g * (s.scale || 1), f = F[x.f]; if (!f) return; const it = items[x.f] = items[x.f] || { f: x.f, he: f.he, grp: f.grp, st: f.st, g: 0, uses: 0, recipes: new Set(), dates: new Set() }; it.g += g; it.uses++; it.recipes.add(r.id); it.dates.add(d); }); });
    }
    let blockedN = 0; const groups = {}; Object.values(items).forEach(it => { const f = F[it.f]; const o = { f: it.f, he: it.he.split(' (')[0], st: ST_HE[it.st] || it.st, g: Math.round(it.g), units: f.unit ? Math.ceil(it.g / f.unit - 0.05) : null, unitHe: f.unitHe || null, uses: it.uses, recipes: it.recipes.size };
      /* Stage H1: an item that conflicts with the user's restrictions can only come from a dish the user chose explicitly
         (the menu guard replaces everything else) — it is flagged, never listed silently */
      if (C().blockedFoods().has(it.f)) { o.blocked = true; o.kind = C().worstKind([it.f]); blockedN++; }
      (groups[it.grp] = groups[it.grp] || []).push(o); });
    Object.values(groups).forEach(l => l.sort((a, b) => b.g - a.g));
    const order = ['protein', 'dairy', 'legume', 'carb', 'veg', 'fruit', 'fat', 'condiment'];
    /* meal prep: (a) the same recipe on ≥2 days → cook once; (b) a base that needs cooking (raw/dry protein, grains, legumes)
       used in ≥2 different meals → cook the total in one batch. Amounts are the sums of the planned servings. */
    const prep = Object.values(recipes).filter(r => r.n >= 2).sort((a, b) => b.n - a.n).map(r => ({ kind: 'recipe', id: r.id, he: r.he, n: r.n, dates: r.dates, mealprep: r.mealprep }));
    const batch = Object.values(items).filter(it => ['raw', 'dry'].includes(it.st) && ['protein', 'carb', 'legume'].includes(it.grp) && it.recipes.size >= 2 && !F[it.f].unit)
      .sort((a, b) => b.g - a.g).map(it => ({ kind: 'batch', f: it.f, he: it.he.split(' (')[0], st: ST_HE[it.st], g: Math.round(it.g), meals: it.uses, dates: [...it.dates].sort() }));
    return { from, days, to: dates[dates.length - 1], groups: order.filter(k => groups[k]).map(k => ({ k, he: GRP_HE[k], items: groups[k] })), prep, batch, blocked: blockedN, recipeCount: Object.keys(recipes).length, itemCount: Object.keys(items).length };
  }
  const shopKey = (from, days) => from + '+' + days;
  function shoppingChecks() { const nu = S().load('nutrition'); nu.shopping = nu.shopping || { checked: {} }; return nu.shopping; }
  function toggleCheck(f, on) { const nu = S().load('nutrition'); nu.shopping = nu.shopping || { checked: {} }; if (on) nu.shopping.checked[f] = S().today(); else delete nu.shopping.checked[f]; S().save('nutrition'); }
  function clearChecks() { const nu = S().load('nutrition'); const custom = (nu.shopping && nu.shopping.custom || []).map(c => Object.assign({}, c, { done: false })); nu.shopping = { checked: {}, state: {}, custom }; S().save('nutrition'); } /* RC5: the user's own items survive a clear */
  function shoppingText(sh, checked) { return [`רשימת קניות · ${S().fmtDate(sh.from)}–${S().fmtDate(sh.to)} (${sh.days} ימים)`].concat(sh.groups.flatMap(g => ['', g.he + ':'].concat(g.items.map(i => `${checked && checked[i.f] ? '✓' : '☐'} ${i.blocked ? '⚠ [' + C().KIND_HE[i.kind] + '] ' : ''}${i.he} — ${i.units ? i.units + ' × ' + (i.unitHe || 'יח׳') + ' (' + i.g + ' ג׳)' : i.g + ' ג׳'} (${i.st})`)))).join('\n'); }

  /* ---------- G4 Personal records & milestones ---------- */
  function records() {
    const w = S().load('workouts'), out = {};
    const add = (sets, items, date, src, ref) => { const lvl = {}; (items || []).forEach(it => { lvl[it.ex] = lvl[it.ex] || it.adjLvl || it.lvl || null; });
      (sets || []).forEach(s => { if (!s.done || s.sec !== 'main' || !root.EX_BY_ID[s.ex]) return; const v = s.reps != null ? s.reps : s.secs; if (v == null || v <= 0) return; const u = s.reps != null ? 'reps' : 'sec', L0 = src === 'plan' ? (lvl[s.ex] || 'normal') : null, key = s.ex + '|' + (L0 || 'classic') + '|' + u;
        const cur = out[key]; if (!cur || v > cur.v) out[key] = { ex: s.ex, lvl: L0, unit: u, v, date, src, ref, first: cur ? cur.first : { v, date } }; else if (cur && date < cur.first.date) cur.first = { v, date }; }); };
    Object.entries(w.days).forEach(([n, lg]) => add(lg.sets, null, lg.date || C().dateOfDay(+n), 'classic', 'יום ' + n + ' (קלאסית)'));
    PS().list().filter(p => p.status !== 'draft').forEach(p => Object.entries(p.log || {}).forEach(([n, lg]) => add(lg.sets, lg.snapshot && lg.snapshot.main, lg.date, 'plan', PG().byId(p.templateId).he + ' · יום ' + n)));
    return Object.values(out).sort((a, b) => b.date < a.date ? -1 : 1);
  }
  function milestones() {
    const logs = []; const w = S().load('workouts');
    Object.entries(w.days).forEach(([n, lg]) => { if (['done', 'partial'].includes(lg.status)) logs.push({ date: lg.date || C().dateOfDay(+n), min: (lg.durationSec || 0) / 60 }); });
    PS().list().forEach(p => Object.values(p.log || {}).forEach(lg => { if (['done', 'partial'].includes(lg.status)) logs.push({ date: lg.date, min: (lg.durationSec || 0) / 60 }); }));
    logs.sort((a, b) => a.date < b.date ? -1 : 1); const out = [];
    [1, 5, 10, 25, 50, 100, 200].forEach(k => { if (logs.length >= k) out.push({ k: 'sessions' + k, he: k === 1 ? 'האימון הראשון שנרשם' : `${k} אימונים שנרשמו`, date: logs[k - 1].date }); });
    let acc = 0; const minT = [60, 300, 600, 1500, 3000]; let mi = 0; for (const l of logs) { acc += l.min; while (mi < minT.length && acc >= minT[mi]) { out.push({ k: 'min' + minT[mi], he: `${minT[mi] >= 60 ? Math.round(minT[mi] / 60) + ' שעות' : minT[mi] + ' דק׳'} אימון מצטבר (לפי זמן שנמדד בנגן)`, date: l.date }); mi++; } }
    const ap = PS().active(); if (ap) { const ws = I().planWeeks(ap).filter(x => x.past && x.planned > 0); let run = 0, best = 0; ws.forEach(x => { run = (x.done + x.partial) >= Math.ceil(x.planned * 2 / 3) ? run + 1 : 0; [2, 4, 8, 12].forEach(k => { if (run === k && k > best) { best = k; out.push({ k: 'weeks' + k, he: `${k} שבועות רצופים שנשמרו בתוכנית`, date: x.to }); } }); }); }
    const tests = []; Object.values(w.tests || {}).forEach(t => { if (t && t.results) tests.push({ date: t.date, r: t.results }); });
    PS().list().forEach(p => Object.values(p.log || {}).forEach(lg => { if (lg.tests && Object.keys(lg.tests).length) tests.push({ date: lg.date, r: lg.tests }); }));
    tests.sort((a, b) => a.date < b.date ? -1 : 1);
    if (tests.length >= 2) { const a = tests[0], b = tests[tests.length - 1]; const imp = Object.keys(root.PROGRAM.TESTS).filter(k => a.r[k] != null && b.r[k] != null && b.r[k] > a.r[k]); if (imp.length) out.push({ k: 'tests', he: `שיפור במבחן כושר: ${imp.map(k => root.PROGRAM.TESTS[k].name).join(', ')}`, date: b.date }); }
    return out.sort((a, b) => a.date < b.date ? 1 : -1);
  }

  /* ---------- G5 Travel / no-equipment mode ---------- */
  const usableNone = id => CT().usableWith(root.EX_BY_ID[id], ['none']);
  function travelPreview(plan, from, to, opts) {
    plan = plan || PS().active(); if (!plan) throw new Error('אין תוכנית פעילה'); opts = opts || {};
    if (!from || !to || to < from) throw new Error('בחרו טווח תאריכים תקין'); if (from < S().today()) throw new Error('הטווח מתחיל בעבר'); if (S().diffDays(from, to) > 27) throw new Error('מצב נסיעה מוגבל ל־4 שבועות');
    const ds = PS().days(plan).filter(d => PS().isTraining(d) && !d.log && d.status !== 'skipped' && (d.movedTo || d.date) >= from && (d.movedTo || d.date) <= to), exclude = new Set(plan.segments[plan.segments.length - 1].params.exclude || []), changes = [], stuck = [];
    ds.forEach(d => { const used = new Set((d.main || []).map(x => x.ex));
      (d.main || []).forEach((it, i) => { if (usableNone(it.ex)) return; const m0 = CT().exFacts(root.EX_BY_ID[it.ex]);
        const cands = root.EXERCISES.map(e => CT().exFacts(e)).filter(m => m.id !== it.ex && !used.has(m.id) && !exclude.has(m.id) && usableNone(m.id) && (m.pattern === m0.pattern || (m.cat === m0.cat && m.type === m0.type)))
          .sort((a, b) => (b.pattern === m0.pattern) - (a.pattern === m0.pattern) || Math.abs(a.d - m0.d) - Math.abs(b.d - m0.d));
        if (cands.length) { used.add(cands[0].id); changes.push({ n: d.n, date: d.movedTo || d.date, idx: i, from: it.ex, to: cands[0].id, diff: cands[0].d - m0.d }); } else stuck.push({ n: d.n, date: d.movedTo || d.date, ex: it.ex }); }); });
    return { from, to, sessions: ds.length, changes, stuck, short: !!opts.short, shortDays: opts.short ? ds.filter(d => (d.version || 'std') !== 'short' && d.type !== 'assess').map(d => d.n) : [] };
  }
  function travelApply(pv) {
    const plan = PS().active(); const rec = { id: 't' + Date.now().toString(36), from: pv.from, to: pv.to, at: new Date().toISOString(), status: 'active', swaps: [], versions: [] };
    PS().update(plan.id, p => { pv.changes.forEach(c => { const ov = p.overrides[c.n] = p.overrides[c.n] || {}; ov.swaps = ov.swaps || {}; rec.swaps.push({ n: c.n, idx: c.idx, from: c.from, to: c.to, prev: ov.swaps[c.idx] || null }); ov.swaps[c.idx] = c.to; });
      pv.shortDays.forEach(n => { const ov = p.overrides[n] = p.overrides[n] || {}; rec.versions.push({ n, prev: ov.version || null }); ov.version = 'short'; });
      (p.travel = p.travel || []).push(rec); (p.changes = p.changes || []).push({ at: rec.at, date: S().today(), type: 'travel', text: `מצב נסיעה ${S().fmtShort(pv.from)}–${S().fmtShort(pv.to)}: ${pv.changes.length} תרגילים הוחלפו בחלופות ללא ציוד${pv.shortDays.length ? `, ${pv.shortDays.length} אימונים בגרסה קצרה` : ''}` }); });
    return rec;
  }
  function travelRevert(id) {
    const plan = PS().active(); const kept = [];
    PS().update(plan.id, p => { const rec = (p.travel || []).find(x => x.id === id); if (!rec || rec.status !== 'active') throw new Error('אין מצב נסיעה פעיל לביטול');
      rec.swaps.forEach(s => { if ((p.log || {})[s.n]) { kept.push(s.n); return; } const ov = p.overrides[s.n] || {}; if (ov.swaps && ov.swaps[s.idx] === s.to) { if (s.prev) ov.swaps[s.idx] = s.prev; else delete ov.swaps[s.idx]; } });
      rec.versions.forEach(v => { if ((p.log || {})[v.n]) { kept.push(v.n); return; } const ov = p.overrides[v.n] || {}; if (v.prev) ov.version = v.prev; else delete ov.version; });
      rec.status = 'reverted'; rec.revertedAt = new Date().toISOString(); (p.changes = p.changes || []).push({ at: rec.revertedAt, date: S().today(), type: 'travel-revert', text: 'מצב נסיעה בוטל' + (kept.length ? ' (אימונים שנרשמו נשארו כפי שבוצעו)' : '') }); });
    return { kept: [...new Set(kept)] };
  }
  const travelList = plan => ((plan || PS().active() || {}).travel || []).slice().reverse();

  root.Signature = { explain, review, shopping, shoppingChecks, toggleCheck, clearChecks, shoppingText, shopKey, records, milestones, Travel: { preview: travelPreview, apply: travelApply, revert: travelRevert, list: travelList }, GRP_HE };
})(typeof window !== 'undefined' ? window : globalThis);
