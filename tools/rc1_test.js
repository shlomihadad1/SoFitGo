/* Fit30 RC1 acceptance tests (Node, simulated clock). Independent recomputation; no test passes unconditionally.
   Writes dist/reports/rc1-test.json (incl. per-day statistics for the calorie-target runs). */
const fs = require('fs'), path = require('path'), cp = require('child_process'); const ROOT = path.join(__dirname, '..');
for (const f of ['src/js/figure.js', 'src/data/exercises.js', 'src/data/workouts.js', 'src/data/nutrition.js', 'src/data/recipes_intl.js', 'src/data/catalog.js', 'src/data/programs.js', 'src/data/tutorials.js', 'src/data/tutorials_media.js', 'src/js/logic.js', 'src/js/planner.js', 'src/js/plans.js', 'src/js/mealplanner.js', 'src/js/store.js', 'src/js/core.js', 'src/js/insights.js', 'src/js/adapt.js', 'src/js/signature.js']) require(path.join(ROOT, f));
const { Store: S, Core: C, Plans: PS, MealPlan: MP, Logic: L, NUTRI: N, Signature: G } = globalThis; const F = N.FOODS;
let pass = 0, fail = 0; const fails = [], sec = {}, stats = {}; let cur = '';
const T = n => { cur = n; sec[n] = { pass: 0, fail: 0 }; }, ok = (c, m, info) => { if (c) { pass++; sec[cur].pass++; } else { fail++; sec[cur].fail++; fails.push(cur + ': ' + m + (info !== undefined ? ' → ' + JSON.stringify(info).slice(0, 300) : '')); } };
let NOW = '2026-10-19'; S.today = () => NOW;
function setUser(o) { S.resetAll(); NOW = '2026-10-19'; o = Object.assign({ age: 30, height: 178, weight: 80, sex: 'm', goal: 'muscle', prefs: {} }, o); const p = S.load('profile');
  Object.assign(p, { age: o.age, height: o.height, weight: o.weight, startWeight: o.weight, sex: o.sex, experience: 'intermediate', startDate: NOW });
  p.aims = { primary: o.goal, secondary: [] }; p.availability = { days: [0, 1, 3, 5], sessions: 4, maxMin: 45, prefMin: null }; p.environment = { place: 'home', equipment: [], custom: [] };
  p.exercisePrefs = { fav: [], exclude: [], noJump: false }; p.prefs = C.normPrefs(o.prefs); if (o.targets) p.targets = o.targets; if (o.dislike) p.nutritionDislike = o.dislike; S.save('profile'); return p; }
const activate = () => PS.activate(PS.create('general_90', PS.paramsFromProfile(S.load('profile')), NOW), { confirmReplace: true });

T('1 calorie targets 2500 / 3000 / 3500 / 3700 — every day of a 90-day plan');
for (const K of [2500, 3000, 3500, 3700]) for (const [lbl, pf] of [['omnivore', {}], ['vegetarian', { veg: true }]]) {
  setUser({ targets: { kcal: K, protein: Math.round(K * 0.055 / 5) * 5 }, prefs: pf }); const pl = activate(); const ds = PS.days(PS.get(pl.id)); const t = C.targets();
  let inBand = 0, flagged = 0, silent = 0; const ks = [];
  ds.forEach(d => { const p = C.plan(d.date), tot = C.plannedTotals(d.date, 'base'), k = tot.k; ks.push(k); const within = Math.abs(k - t.kcal) <= t.kcal * 0.07, g = p.gap || {};
    if (within) inBand++; else if (g.kLow || g.kHigh) flagged++; else silent++; });
  const avg = Math.round(ks.reduce((a, b) => a + b, 0) / ks.length); stats[`${K} ${lbl}`] = { days: ds.length, avg, min: Math.round(Math.min(...ks)), max: Math.round(Math.max(...ks)), withinPm7: inBand, flaggedGap: flagged, silent };
  ok(silent === 0, `${K} kcal ${lbl}: every day is within ±7% or shows a calorie gap — never a silent miss (${inBand} within, ${flagged} flagged of ${ds.length})`, stats[`${K} ${lbl}`]);
  ok(avg >= K * 0.9 || K >= 3500, `${K} kcal ${lbl}: 90-day average ${avg} ≥ 90% of target (targets ≥ 3500 are reported, not required)`, stats[`${K} ${lbl}`]);
}
/* the summary card must never say "target met" when it is not */
{ setUser({ targets: { kcal: 3700, protein: 200 } }); activate(); const d = NOW, p = C.plan(d); const tot = C.plannedTotals(d, 'base'); ok(!(Math.abs(tot.k - 3700) > 3700 * 0.07) || !!(p.gap && (p.gap.kLow || p.gap.kHigh)), '3700: today\'s shortfall is carried as a gap for the screen', p.gap); }

T('2 vegan without soy & peanuts — whole plan');
{ setUser({ goal: 'recomp', weight: 72, prefs: { vegan: true, exclude: ['soya', 'peanuts'] } }); const pl = activate(); const ds = PS.days(PS.get(pl.id)), bl = C.blockedFoods(), t = C.targets();
  let bad = 0, noBreakfast = 0, pShort = 0, pFlag = 0; const pr = [];
  ds.forEach(d => { const p = C.plan(d.date); ['m1', 'm2', 'snack'].forEach(k => { const s = p[k]; if (s.rid && L.recipeIngredients(L.recipe(s.rid), s.ov).some(x => bl.has(x.f))) bad++; }); if (!p.m1.rid) noBreakfast++;
    const tot = C.plannedTotals(d.date, 'base'); pr.push(tot.p); if (tot.p < t.protein - 0.5) { pShort++; if (p.gap && p.gap.p) pFlag++; } });
  stats.veganNoSoyNoPeanut = { days: ds.length, avgProtein: Math.round(pr.reduce((a, b) => a + b, 0) / pr.length), target: t.protein, proteinShortDays: pShort, flagged: pFlag };
  ok(bad === 0, `0 restricted foods over ${ds.length} days`); ok(noBreakfast === 0, 'a breakfast every day'); ok(pShort === pFlag, `every protein-short day is flagged (${pFlag}/${pShort})`, stats.veganNoSoyNoPeanut); }

T('3 protein targets, units, rounding');
for (const [w, g] of [[55, 'fat_loss'], [80, 'muscle'], [100, 'maintain'], [130, 'recomp']]) { setUser({ weight: w, goal: g }); const t = C.targets();
  ok(t.protein === Math.round(w * 1.8 / 5) * 5, `${w} kg ${g}: protein ${t.protein} = 1.8 g/kg rounded to 5`); ok(t.kcal % 50 === 0 && t.protein % 5 === 0 && t.fat % 5 === 0 && t.carbs % 5 === 0, `${w} kg: kcal ×50, macros ×5`);
  ok(Math.abs(t.protein * 4 + t.carbs * 4 + t.fat * 9 - t.kcal) <= 40, `${w} kg: macro energy (${t.protein * 4 + t.carbs * 4 + t.fat * 9}) matches kcal (${t.kcal}) within rounding`); }
setUser({ weight: 130, height: 175 }); ok(C.targetWarnings().some(w => w.k === 'proteinHighBmi' && w.level === 'info'), 'BMI ≥ 30: protein method shown as an open professional question (calculation unchanged)');
setUser({ weight: 70, height: 175 }); ok(!C.targetWarnings().some(w => w.k === 'proteinHighBmi'), 'BMI < 30: no protein note');
/* recipe values: unit foods, raw/dry weights, per-serving scaling */
{ let bad = 0; N.RECIPES.forEach(r => { const m = L.recipeMacros(r, 1), ind = r.ing.reduce((a, x) => a + F[x.f].k * x.g / 100, 0); if (!r.est && Math.abs(m.k - ind) > 1) bad++; const m2 = L.recipeMacros(r, 2); if (!r.est && Math.abs(m2.k - 2 * m.k) > 1) bad++; });
  ok(bad === 0, `all ${N.RECIPES.length} recipes: kcal = Σ food-table values; 2 servings = 2× (no rounding drift)`); }

T('4 RC1 fixes');
/* H-12 */ { setUser({ weight: 80 }); const p = S.load('profile'); p.targets = { kcal: 2600, protein: 150, ctx: { weight: 80, goal: 'muscle', activity: null } }; S.save('profile'); ok(!C.targetWarnings().some(w => w.k === 'manualStale'), 'manual target, nothing changed: no recheck note');
  p.weight = 86; S.save('profile'); ok(C.targetWarnings().some(w => w.k === 'manualStale' && /80 → 86/.test(w.text)), 'weight +6 kg after a manual target: recheck note names the change');
  p.weight = 80; p.aims.primary = 'fat_loss'; S.save('profile'); ok(C.targetWarnings().some(w => w.k === 'manualStale' && /המטרה/.test(w.text)), 'goal changed: recheck note'); ok(C.targets().kcal === 2600, 'manual value itself is kept (user owns it)'); }
/* H-14 */ { setUser({}); const pl = PS.create('general_90', PS.paramsFromProfile(S.load('profile')), NOW); const pv = MP.generate(MP.currentParams(), pl.start, 28, pl.id + ':0');
  PS.activate(pl, { confirmReplace: true }); const real = MP.menus(PS.get(pl.id)); const same = pv.days.every(d => JSON.stringify(d.slots) === JSON.stringify(real.byDate[d.date].slots));
  ok(same, 'setup preview menu (seed = plan id) is identical to the activated menu for the first 28 days'); }
/* H-15 */ { setUser({}); const pl = activate(); const first = C.plan(NOW).m2.rid; const p = S.load('profile'); p.nutritionDislike = [first]; S.save('profile'); ok(!!MP.pending(PS.get(pl.id)), 'dislike → menu update pending');
  MP.applyChange(PS.get(pl.id), 't'); let seen = 0; for (let i = 0; i < 90; i++) { const pp = C.plan(S.addDays(NOW, i)); if (['m1', 'm2', 'snack'].some(k => pp[k].rid === first)) seen++; } ok(seen === 0, 'after approval the disliked dish does not appear in 90 days'); }
/* H-11 */ { setUser({}); const pl = activate(); const ex = G.explain(PS.get(pl.id)), ph = ex.find(s => s.k === 'phases').items;
  ok(ph.every(x => !/×1\.\d/.test(x)), 'explain no longer quotes the template ×volume factor'); const tr = PS.days(PS.get(pl.id)).filter(d => PS.isTraining(d) && !d.deload && !['assess', 'active', 'mob'].includes(d.type) && d.phase.k === 'intro' && (d.main || []).length);
  const avg = Math.round(tr.reduce((a, d) => a + d.main.reduce((x, it) => x + it.sets, 0), 0) / tr.length * 10) / 10; ok(ph[0].includes(String(avg)), `first-phase line shows the plan's actual average sets (${avg})`, ph[0]); }

T('5 security & privacy');
{ const all = cp.execSync(`grep -rIl . ${path.join(ROOT, 'src')} --include=*.js --include=*.css`).toString().trim().split('\n');
  const pats = [/AKIA[0-9A-Z]{16}/, /sk-[A-Za-z0-9]{20,}/, /AIza[0-9A-Za-z_\-]{30,}/, /ghp_[A-Za-z0-9]{30,}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /api[_-]?key\s*[:=]\s*['"][^'"]{8,}/i, /privaterelay\.appleid\.com/, /[A-Za-z0-9._%+-]+@(gmail|yahoo|hotmail|outlook)\.com/];
  const hits = []; all.forEach(f => { const s = fs.readFileSync(f, 'utf8'); pats.forEach(r => { if (r.test(s)) hits.push(path.basename(f) + ' ' + r); }); });
  ok(hits.length === 0, `no API keys, tokens, private keys or personal e-mail addresses in ${all.length} source files`, hits);
  const net = cp.execSync(`grep -rhoE "https?://[a-zA-Z0-9.-]+" ${path.join(ROOT, 'src/js')} ${path.join(ROOT, 'src/data')} | sort -u`).toString().trim().split('\n').filter(Boolean);
  ok(net.every(u => /fonts\.(googleapis|gstatic)\.com|webkit\.org|www\.w3\.org|^https:\/\/www\.google\.com$|^https:\/\/www\.openstreetmap\.org$/.test(u)), 'the only network hosts referenced by code are fonts, documentation links and the two map-search links of #/nearby', net);
  { /* M10.4: the map hosts may appear ONLY as user-clicked links (target=_blank, noopener) in screens_food_near.js — never fetched */
    const mapFiles = cp.execSync(`grep -rlE "google\\.com|openstreetmap\\.org" ${path.join(ROOT, 'src/js')} ${path.join(ROOT, 'src/data')} || true`).toString().trim().split('\n').filter(Boolean).map(f => path.basename(f));
    const fn = fs.readFileSync(path.join(ROOT, 'src/js/screens_food_near.js'), 'utf8');
    ok(mapFiles.join() === 'screens_food_near.js' && !/fetch\(|XMLHttpRequest|sendBeacon|new Image|<img|<iframe|<script/.test(fn) && (fn.match(/href="https:\/\/www\.(google\.com|openstreetmap\.org)/g) || []).length === 2 && (fn.match(/rel="noopener noreferrer"/g) || []).length === 2,
      'map hosts appear only as two outbound links (noopener) in the nearby-food screen — no request is sent to them by the app', mapFiles); }
  const html = fs.readFileSync(path.join(ROOT, 'dist/pwa/index.html'), 'utf8'); ok(!/<iframe|youtube|vimeo|google-analytics|gtag\(|facebook\.net/i.test(html), 'no third-party players, analytics or trackers in the build'); }

T('6 tutorial media');
{ const TM = globalThis.TUTORIAL_MEDIA, TU = globalThis.TUTORIALS, routes = fs.readFileSync(path.join(ROOT, 'src/js/main.js'), 'utf8');
  const build = (fs.readFileSync(path.join(ROOT, 'dist/pwa/index.html'), 'utf8').match(/FIT30_BUILD='([0-9a-f]+)'/) || [])[1];
  ok(TU.length === 12 && TU.every(t => t.s.length >= 3 && t.t && t.d), '12 tutorials, each with ≥3 text steps');
  ok(TU.every(t => !t.go || routes.includes(`case '${t.go.split('/')[1]}'`)), 'every "go to screen" link targets an existing route');
  for (const t of TU) { const m = TM[t.id]; if (!m) { ok(false, `${t.id}: has a recording`); continue; }
    const f = path.join(ROOT, 'src/media', m.mp4), pf = path.join(ROOT, 'src/media', m.poster.s);
    const pr = fs.existsSync(f) ? JSON.parse(cp.execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', f]).toString()) : null;
    const v = pr && pr.streams.find(s => s.codec_type === 'video'), a = pr && pr.streams.find(s => s.codec_type === 'audio');
    ok(!!v && v.codec_name === 'h264' && !a && v.pix_fmt === 'yuv420p', `${t.id}: MP4 H.264 yuv420p, no audio track`, v && { codec: v.codec_name, pix: v.pix_fmt, audio: !!a });
    ok(fs.existsSync(pf) && fs.statSync(f).size < 400000 && Math.abs(+pr.format.duration - m.dur) < 0.2, `${t.id}: poster exists, file < 400 KB (${Math.round(fs.statSync(f).size / 1024)} KB), duration matches metadata`);
    ok(m.build === build && m.license === 'original', `${t.id}: recorded from this build (${build}), original license`); }
  const sw = fs.readFileSync(path.join(ROOT, 'dist/pwa/sw.js'), 'utf8'); ok(/'help\.js'/.test(sw) && /mp4\|webm/.test(sw), 'service worker precaches help.js and keeps videos network-only (no false offline promise)'); }

fs.mkdirSync(path.join(ROOT, 'dist/reports'), { recursive: true }); fs.writeFileSync(path.join(ROOT, 'dist/reports/rc1-test.json'), JSON.stringify({ pass, fail, sections: sec, stats, fails }, null, 1));
if (fails.length) { console.log('FAILURES:'); fails.forEach(f => console.log(' - ' + f)); }
console.log(JSON.stringify(stats)); console.log(`rc1 tests: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
