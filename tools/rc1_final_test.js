/* RC1 final-round tests (Node): hidden allergens in recipe text, gradual training load across all tracks, units, secrets,
   per-day honesty of high targets incl. the vegan/no-soy/no-peanut profile, data separation. Writes dist/reports/rc1-final-test.json */
const fs = require('fs'), path = require('path'); const ROOT = path.join(__dirname, '..');
for (const f of ['src/js/figure.js', 'src/data/exercises.js', 'src/data/workouts.js', 'src/data/nutrition.js', 'src/data/recipes_intl.js', 'src/data/recipes_med.js', 'src/data/catalog.js', 'src/data/programs.js', 'src/js/logic.js', 'src/js/planner.js', 'src/js/plans.js', 'src/js/mealplanner.js', 'src/js/store.js', 'src/js/core.js']) require(path.join(ROOT, f));
const { Store: S, Core: C, Plans: PS, MealPlan: MP, Logic: L, NUTRI: N, CATALOG: CT, PROGRAMS: PG, Planner: P } = globalThis; const F = N.FOODS;
let pass = 0, fail = 0; const fails = [], sec = {}; let cur = '';
const T = n => { cur = n; sec[n] = { pass: 0, fail: 0 }; }, ok = (c, m, info) => { if (c) { pass++; sec[cur].pass++; } else { fail++; sec[cur].fail++; if (fails.length < 60) fails.push(cur + ': ' + m + (info !== undefined ? ' → ' + JSON.stringify(info).slice(0, 300) : '')); } };
let NOW = '2026-10-19'; S.today = () => NOW;

T('1 hidden allergens in recipe text');
{ const tg = f => [].concat(CT.ALLERGEN_OF[f] || []);
  /* steps are instructions: an allergen-bearing food named in a step must be in the ingredient list (otherwise the restriction
     guard cannot see it). Notes may mention foods only as negations ("ללא…/בלי…") or restaurant remarks. */
  const KW = { soy: /רוטב סויה|סויה|טופו|אדממה/, peanut: /בוטנ/, sesame: /טחינה|שומשום/, tree_nut: /שקד|אגוז|קשיו|פיסטוק/, fish: /(^|\s)(דג|דגים|טונה|סלמון)/, milk: /(^|[\s"'(])(חלב(?!ו)|יוגורט|גבינ|פניר|קוטג|דהי|שמנת|גהי)/, egg: /ביצה|ביצים/ };
  const hits = []; N.RECIPES.forEach(r => { const al = new Set(r.ing.flatMap(x => tg(x.f))); (r.steps || []).forEach(st => Object.entries(KW).forEach(([a, re]) => { const s2 = st.replace(/שטופ\S*/g, ''); if (re.test(s2) && !al.has(a) && !/ללא|בלי/.test(s2)) hits.push(r.id + ': ' + a + ' — ' + st.slice(0, 80)); })); });
  ok(hits.length === 0, `no recipe step names an allergen-bearing food that is missing from its ingredients (${N.RECIPES.length} recipes)`, hits);
  const efr = L.recipe('egg_fried_rice'); ok(efr.ing.some(x => x.f === 'soy_sauce') && C.conflicts(efr, null, { exclude: ['soya'] }).some(c => c.f === 'soy_sauce'), 'egg fried rice declares its soy sauce → blocked for a soy restriction');
  ok(C.conflicts(efr, null, { glutenFree: true }).some(c => c.f === 'soy_sauce'), '…and for gluten-free (soy sauce contains wheat)');
  ok(!/רוטב סויה/.test(L.recipe('chicken_mushroom_roti').steps.join(' ')), 'chicken & mushroom roti no longer suggests soy sauce in its steps');
  ok(Object.keys(F).every(f => F[f].he && typeof F[f].k === 'number'), 'every food has a name and values (mapping complete)');
  const named = { peanuts: 'peanut', peanut_butter: 'peanut', soya: 'soy', tofu: 'soy', soy_milk: 'soy', soy_sauce: 'soy', edamame: 'soy', almonds: 'tree_nut', tahini: 'sesame', salmon: 'fish', tuna_can: 'fish', white_fish: 'fish', egg: 'egg', egg_white: 'egg', milk: 'milk', paneer: 'milk', curd: 'milk', ghee: 'milk', bread: 'gluten', atta: 'gluten', pasta: 'gluten' };
  ok(Object.entries(named).every(([f, a]) => tg(f).includes(a)), 'key foods carry the expected allergen tag', Object.entries(named).filter(([f, a]) => !tg(f).includes(a))); }

T('2 gradual load (all tracks × levels × goals)');
{ const vol = d => d.main.reduce((s, x) => s + x.sets * (typeof x.reps === 'number' ? x.reps : typeof x.sec === 'number' ? x.sec / 3 : 1), 0); let pairs = 0, over = []; let ramped = 0;
  for (const t of PG.TEMPLATES.filter(t => !t.classic && !(t.needsLibrary || []).length)) for (const level of ['beginner', 'intermediate', 'advanced']) for (const goal of t.goals) for (const spw of [3, 5]) {
    const r = P.build(t.id, { start: NOW, days: t.custom ? 90 : t.days, profile: { level, days: [0, 1, 2, 3, 4, 5, 6], spw, maxMin: 45, equipment: [] }, goal }); const last = {};
    r.days.forEach(d => { if (!d.main || !d.main.length || ['rest', 'active', 'assess'].includes(d.type) || d.deload) return; if (d.ramped) ramped++; if (last[d.type]) { pairs++; const vr = vol(d) / last[d.type]; if (vr > 1.25 + 1e-9 && d.main.some(x => x.sets > 1 && !x.circuit)) over.push(`${t.id}/${level}/${goal}/${spw} day ${d.n}: ×${vr.toFixed(2)}`); } last[d.type] = vol(d); }); }
  ok(over.length === 0, `${pairs} consecutive same-type sessions: volume never rises more than 25% (where sets can be lowered)`, over.slice(0, 5));
  ok(ramped > 0, `the ramp is applied and explained where needed (${ramped} sessions carry a note)`);
  const r = P.build('general_90', { start: NOW, profile: { level: 'intermediate', days: [1, 3, 5], spw: 3, maxMin: 45, equipment: [] }, goal: 'general' }); const d = r.days.find(x => x.ramped);
  ok(!d || d.notes.some(n => /עלייה הדרגתית/.test(n)), 'a ramped session says so on the day'); }

T('3 units and rounding');
{ const U = { w: (kg, u) => u === 'lb' ? +(kg * 2.20462).toFixed(1) : +(+kg).toFixed(1), wIn: (v, u) => u === 'lb' ? +(v / 2.20462).toFixed(2) : +v };
  const src = fs.readFileSync(path.join(ROOT, 'src/js/ui.js'), 'utf8'); ok(src.includes("u === 'lb' ? +(kg * 2.20462).toFixed(1)") && src.includes("u === 'lb' ? +(v / 2.20462).toFixed(2)"), 'unit functions under test are the ones in ui.js');
  let worst = 0; for (let kg = 40; kg <= 200; kg += 0.1) { const back = U.wIn(U.w(kg, 'lb'), 'lb'); worst = Math.max(worst, Math.abs(back - kg)); } ok(worst < 0.03, `kg → lb → kg round trip error ≤ 0.03 kg (max ${worst.toFixed(3)})`);
  let bad = 0; N.RECIPES.forEach(r => { const m = L.recipeMacros(r), ind = r.ing.reduce((s, x) => { const f = F[x.f]; return { k: s.k + f.k * x.g / 100, p: s.p + f.p * x.g / 100 }; }, { k: 0, p: 0 }); if (Math.abs(m.k - ind.k) > 1 || Math.abs(m.p - ind.p) > 0.2) bad++; }); ok(bad === 0, `recipe values = Σ grams × per-100 g for all ${N.RECIPES.length} recipes`);
  const t = L.computeTargets({ weight: 80, height: 175, age: 32, sex: 'm', deficit: 0.2, activity: 1.55 }); ok(t.kcal % 50 === 0 && t.protein % 5 === 0 && t.fat % 5 === 0 && t.carbs % 5 === 0, 'targets rounded to 50 kcal / 5 g as documented');
  ok(Math.abs(t.protein * 4 + t.fat * 9 + t.carbs * 4 - t.kcal) <= 40, `macro energy ≈ kcal target (${t.protein * 4 + t.fat * 9 + t.carbs * 4} vs ${t.kcal})`); }

T('4 high targets & restricted profile — every day reported honestly');
{ const run = (o, pf) => { S.resetAll(); NOW = '2026-10-19'; const p = S.load('profile'); Object.assign(p, o); p.aims = { primary: o.goal, secondary: [] }; p.prefs = C.normPrefs(pf); S.save('profile');
    const prm = MP.currentParams(), g = MP.generate(prm, NOW, 90, 'rc1'); let silent = 0, within = 0, gapped = 0; g.days.forEach(x => { const t = x.totals; if (!t) return; const inK = Math.abs(t.k - prm.kcal) <= prm.kcal * 0.07, inP = t.p >= prm.protein - 0.5;
      if (inK && inP) within++; else if (x.gap && ((!inK && (x.gap.kLow || x.gap.kHigh)) || inK) && ((!inP && x.gap.p) || inP)) gapped++; else silent++; }); return { kcal: prm.kcal, protein: prm.protein, within, gapped, silent }; };
  const cases = [['2500', { age: 30, height: 178, weight: 75, sex: 'm', goal: 'maintain', activity: 'sedentary' }], ['3000', { age: 25, height: 185, weight: 82, sex: 'm', goal: 'maintain', activity: 'moderate' }], ['3500', { age: 24, height: 190, weight: 95, sex: 'm', goal: 'muscle', activity: 'moderate' }], ['3700', { age: 22, height: 195, weight: 105, sex: 'm', goal: 'muscle' }]];
  for (const [n, o] of cases) { const r = run(o, {}); ok(r.silent === 0, `≈${n} kcal (${r.kcal}): ${r.within}/90 days within ±7% and protein met, ${r.gapped} days with the gap reported, 0 silent`, r);
    const v = run(o, { vegan: true, exclude: ['soya', 'peanuts'] }); ok(v.silent === 0, `≈${n} kcal, vegan without soy and peanuts: ${v.within} within, ${v.gapped} reported, 0 silent`, v); } }

T('5 secrets, personal data, separation');
{ const files = []; const walk = d => fs.readdirSync(d).forEach(f => { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.(js|html|json|css)$/.test(f)) files.push(p); }); walk(path.join(ROOT, 'src')); walk(path.join(ROOT, 'dist/pwa'));
  const pat = /(api[_-]?key|secret|bearer\s+[a-z0-9]|sk-[a-z0-9]{10}|ghp_[a-z0-9]{10}|AKIA[0-9A-Z]{12}|privaterelay|@gmail\.com|password\s*[:=])/i; const LEGIT = /apikey:\s*CFG\.key|password:\s*pw\b|(weak|same)_password:|nothing secret in the browser|updatePassword|grant_type=password|(['"])password\2,\s*'autocomplete="(new|current)-password"|no password is ever stored|password reset|'text'\s*:\s*'password'|"text":"password"|input\[type="?password"?\]/g; /* M10: exact GoTrue field usages only — see build_check.js */
  const hit = files.filter(f => pat.test(fs.readFileSync(f, 'utf8').replace(LEGIT, '')));
  ok(!files.some(f => /sb_secret_[A-Za-z0-9]|eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.|password\s*[:=]\s*["'`][^"'`]/.test(fs.readFileSync(f, 'utf8').replace(LEGIT, ''))), 'no secret key, JWT or literal password value in source/build');
  ok(hit.length === 0, `no API keys, tokens, passwords or e-mail addresses in ${files.length} source/build files`, hit.map(f => path.relative(ROOT, f)));
  const KEYS = fs.readFileSync(path.join(ROOT, 'src/js/store.js'), 'utf8').match(/fit30\.\w+/g); ok(KEYS && KEYS.every(k => k.startsWith('fit30.')), 'all app data lives under fit30.* keys (M10: optional beta accounts sync these same sections; nothing else is stored)');
  S.resetAll(); const p = S.load('profile'); ok([p.age, p.height, p.weight, p.sex, p.aims.primary].every(v => v == null), 'a new profile starts empty (no shared or demo data)'); }

fs.mkdirSync(path.join(ROOT, 'dist/reports'), { recursive: true }); fs.writeFileSync(path.join(ROOT, 'dist/reports/rc1-final-test.json'), JSON.stringify({ pass, fail, sections: sec, fails }, null, 1));
if (fails.length) { console.log('FAILURES:'); fails.forEach(f => console.log(' - ' + f)); }
console.log(JSON.stringify(sec)); console.log(`rc1 final tests: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
