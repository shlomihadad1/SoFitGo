/* Stage A tests (Node): catalog, planner (30 / 90 / 365 days, custom, goal, equipment, time, determinism),
   media mapping, generated covers, ingest pipeline (valid + rejected inputs). Expected values are derived from the
   source data independently of the code under test where possible. Writes dist/reports/stageA-test.json */
const fs = require('fs'), path = require('path'), crypto = require('crypto'), { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
for (const f of ['src/js/figure.js', 'src/data/exercises.js', 'src/data/workouts.js', 'src/data/nutrition.js', 'src/data/recipes_intl.js', 'src/data/recipes_med.js', 'src/data/catalog.js', 'src/data/programs.js', 'src/data/media.js', 'src/js/logic.js', 'src/js/planner.js']) require(path.join(ROOT, f));
const { EXERCISES, NUTRI, CATALOG: CT, PROGRAMS: PG, Planner: PL, MEDIA } = globalThis;
let pass = 0, fail = 0; const fails = [], sec = {}; let cur = '';
const T = n => { cur = n; sec[n] = { pass: 0, fail: 0 }; };
const ok = (c, m) => { if (c) { pass++; sec[cur].pass++; } else { fail++; sec[cur].fail++; fails.push(cur + ': ' + m); } };
const sha = b => crypto.createHash('sha256').update(b).digest('hex');

T('catalog');
EXERCISES.forEach(e => { const m = CT.EX_META[e.id];
  ok(!!m, 'meta for ' + e.id); if (!m) return;
  ok(!!CT.PATTERN_HE[m.pattern], e.id + ' pattern known'); ok(!!CT.TYPE_HE[m.type], e.id + ' type known');
  ok(m.eq.every(t => CT.EQUIPMENT[t] && CT.EQUIPMENT[t].home), e.id + ' equipment is home equipment');
  ok([1, 2, 3].includes(m.d), e.id + ' difficulty 1–3');
  const f = CT.exFacts(e); ok(f.primary.length >= 1, e.id + ' has primary muscles');
  // independent: if the exercise text says it needs equipment, meta must list some equipment (and vice versa for 'none')
  ok(!!e.equip === m.eq.length > 0 || ['towel_curl'].includes(e.id), `${e.id}: equipment text (${!!e.equip}) agrees with meta (${m.eq.join(',') || 'none'})`);
});
ok(Object.keys(CT.EX_META).every(id => EXERCISES.some(e => e.id === id)), 'no meta for unknown exercise ids');
/* Stage C: lists extended with the new international foods (independent of catalog.js) */
const DAIRY = ['curd', 'hung_curd', 'milk', 'paneer', 'ghee', 'greek_yogurt', 'cottage', 'feta', 'mozzarella'], EGG = ['egg', 'egg_white'], MEAT = ['chicken_breast', 'chicken_thigh', 'chicken_mince', 'beef_lean', 'turkey', 'salmon', 'white_fish', 'tuna_can', 'sardines'], SOY = ['soya', 'tofu', 'edamame', 'soy_milk', 'soy_sauce'], PEANUT = ['peanuts', 'peanut_butter'];
NUTRI.RECIPES.forEach(r => { const f = CT.recipeFacts(r), fs_ = r.ing.map(x => x.f);
  ok(f.allergens.includes('egg') === fs_.some(x => EGG.includes(x)), r.id + ' egg allergen');
  ok(f.allergens.includes('milk') === fs_.some(x => DAIRY.includes(x)), r.id + ' milk allergen');
  ok(f.allergens.includes('soy') === fs_.some(x => SOY.includes(x)), r.id + ' soy allergen'); ok(f.allergens.includes('peanut') === fs_.some(x => PEANUT.includes(x)), r.id + ' peanut allergen');
  ok(f.diet.vegan === !fs_.some(x => [...DAIRY, ...EGG, ...MEAT].includes(x)), r.id + ' vegan flag');
  if (r.tags.includes('vegan')) ok(f.diet.vegan, r.id + ' tagged vegan is vegan by ingredients');
  ok(f.weightStates.every(s => ['raw', 'dry', 'ready'].includes(s)), r.id + ' weight states');
});
const cuisines = {}; NUTRI.RECIPES.forEach(r => { const c = CT.recipeFacts(r).cuisine; cuisines[c] = (cuisines[c] || 0) + 1; });

T('planner');
const START = '2026-10-19';
const TPL = PG.TEMPLATES.filter(t => !t.classic);
ok(PG.TEMPLATES.length >= 12 && TPL.length >= 11, 'catalog has the requested program lengths');
['start_7', 'habits_30', 'fatloss_30', 'strength_90', 'general_90', 'progress_6m', 'annual', 'custom'].forEach(id => ok(!!PG.byId(id), 'template ' + id));
const profiles = [
  { name: 'beginner 3×/wk 30′', p: { level: 'beginner', spw: 3, maxMin: 30 } },
  { name: 'intermediate 5×/wk 45′ chair+wall', p: { level: 'intermediate', spw: 5, maxMin: 45, equipment: ['chair', 'wall'] } },
  { name: 'advanced 6×/wk 20′ no jumping', p: { level: 'advanced', spw: 6, maxMin: 20, noJump: true } },
  { name: 'beginner Mon/Wed/Fri 15′ exclude squat', p: { level: 'beginner', days: [1, 3, 5], maxMin: 15, exclude: ['squat', 'pushup'] } }];
const rows = [];
for (const t of TPL) for (const pr of profiles) {
  const opts = { start: START, profile: pr.p }; if (t.custom) opts.end = '2027-01-16';
  const a = PL.build(t.id, opts), b = PL.build(t.id, opts), s = a.summary, L = `${t.id} / ${pr.name}`;
  ok(JSON.stringify(a) === JSON.stringify(b), L + ': deterministic');
  const exp = t.custom ? 90 : t.days; ok(a.days.length === exp, `${L}: ${a.days.length} days = ${exp}`);
  ok(a.days.every((d, i) => d.n === i + 1 && d.date === new Date(Date.parse(START + 'T12:00:00Z') + i * 864e5).toISOString().slice(0, 10)), L + ': consecutive dates');
  // phases contiguous and cover all days
  ok(s.phases[0].startDay === 1 && s.phases[s.phases.length - 1].endDay === exp && s.phases.every((p, i) => i === 0 || p.startDay === s.phases[i - 1].endDay + 1), L + ': phases contiguous');
  const have = ['none', ...(pr.p.equipment || [])];
  const items = a.days.flatMap(d => (d.main || []).concat(d.finisher || [], d.warm || [], d.cool || []));
  ok(items.every(x => EXERCISES.some(e => e.id === x.ex)), L + ': all exercise ids exist');
  ok(items.every(x => CT.exMeta(x.ex).eq.every(q => have.includes(q))), L + ': only exercises the equipment allows');
  ok(!items.some(x => (pr.p.exclude || []).includes(x.ex)), L + ': excluded exercises never used');
  if (pr.p.noJump) ok(!items.some(x => CT.exMeta(x.ex).impact === 'high'), L + ': no high-impact exercises');
  const weeks = {}; a.days.forEach(d => { weeks[d.week] = weeks[d.week] || []; weeks[d.week].push(d); });
  const full = Object.values(weeks).filter(w => w.length === 7);
  ok(full.every(w => w.filter(d => !['rest', 'active'].includes(d.type)).length <= Math.min(6, pr.p.spw || pr.p.days.length || t.spw)), L + ': sessions per week within limit');
  ok(full.every(w => w.some(d => d.type === 'rest' || d.type === 'active')), L + ': every full week has a rest/recovery day');
  if (pr.p.days) ok(a.days.filter(d => !['rest', 'active'].includes(d.type)).every(d => pr.p.days.includes(new Date(d.date + 'T12:00:00Z').getUTCDay())), L + ': trains only on available weekdays');
  const train = a.days.filter(d => !['rest', 'active', 'assess'].includes(d.type));
  ok(train.every(d => d.minutes <= pr.p.maxMin + 0.01 || d.notes.some(n => /מעל/.test(n))), L + ': sessions fit the time limit or say they do not');
  ok(a.days.filter(d => d.deload).every(d => s.phases.find(p => p.k === d.phase.k && d.n >= p.startDay && d.n <= p.endDay).weeks >= 4), L + ': deload only inside phases of ≥4 weeks');
  rows.push({ template: t.id, profile: pr.name, days: s.days, phases: s.phases.length, sessions: s.sessions, rest: s.rest, active: s.active, assess: s.assess, deloadWeeks: s.deloadWeeks, avgMin: s.avgMinutes, maxMin: s.maxMinutes, distinct: s.distinctSessions, mostRepeated: s.mostRepeated, exercises: s.exercisesUsed, trimmed: s.trimmed, gaps: s.gaps.length });
}
{ const a = PL.build('annual', { start: START, profile: { level: 'intermediate', spw: 4, maxMin: 40 } }), s = a.summary;
  ok(s.phases.length === 6, 'annual: 6 phases'); ok(s.days === 364, 'annual: 52 weeks');
  ok(s.distinctSessions / s.sessions >= 0.3, `annual: variety ${s.distinctSessions}/${s.sessions} distinct sessions`);
  ok(s.mostRepeated <= 15, 'annual: no session repeated more than 15 times (' + s.mostRepeated + ')');
  ok(s.deloadWeeks >= 8, 'annual: planned easy weeks (' + s.deloadWeeks + ')'); ok(s.assess >= 3, 'annual: assessments (' + s.assess + ')');
  const dAvg = k => { const ds = a.days.filter(d => d.phase.k === k && d.main && !['assess', 'active'].includes(d.type)).flatMap(d => d.main.map(x => CT.exMeta(x.ex).d)); return ds.reduce((x, y) => x + y, 0) / ds.length; };
  ok(dAvg('advanced') > dAvg('intro'), `annual: advanced phase harder than intro (${dAvg('advanced').toFixed(2)} > ${dAvg('intro').toFixed(2)})`);
  const months = []; for (let m = 0; m < 12; m++) months.push(JSON.stringify(a.days.slice(m * 28, m * 28 + 28).map(d => [d.type, (d.main || []).map(x => x.ex + (x.reps || x.sec) + x.sets)])));
  ok(new Set(months).size === 12, 'annual: no two 4-week blocks identical'); }
{ const a = PL.build('fatloss_30', { start: START, profile: { spw: 4 }, goal: 'fat_loss' }); ok(a.days.some(d => d.type === 'cond'), 'goal fat_loss → conditioning sessions');
  const b = PL.build('strength_90', { start: START, profile: { spw: 4, level: 'intermediate', maxMin: 60 }, goal: 'strength' }); ok(!b.days.some(d => d.type === 'cond'), 'goal strength (4×/wk) → no conditioning sessions');
  ok(b.days.filter(d => d.main && d.type !== 'assess' && d.type !== 'active').every(d => d.main.filter(x => x.reps).every(x => x.rest === 75)), 'goal strength → longer rests'); }
{ const t15 = PL.build('general_90', { start: START, profile: { maxMin: 15 } }), t60 = PL.build('general_90', { start: START, profile: { maxMin: 60, level: 'intermediate' } });
  ok(t15.summary.maxMinutes <= 15.01 || t15.days.some(d => d.notes.some(n => /מעל/.test(n))), 'time 15′ respected (' + t15.summary.maxMinutes + ')');
  ok(t60.summary.avgMinutes > t15.summary.avgMinutes, 'more time → more volume'); }
{ const noeq = PL.build('home_noequip', { start: START, profile: { equipment: ['chair', 'table', 'wall'] } }); ok(noeq.days.flatMap(d => d.main || []).every(x => CT.exMeta(x.ex).eq.length === 0), 'home_noequip ignores furniture even if available');
  const g = PL.build('gym', { start: START }); ok(g.summary.gaps.length > 0, 'gym template reports the library gap instead of pretending'); }
['2026-13-01', '', null].forEach(s => { let e = null; try { PL.build('annual', { start: s }); } catch (x) { e = x; } ok(!!e, 'invalid start rejected: ' + s); });
[0, 366].forEach(n => { let e = null; try { PL.build('custom', { start: START, days: n }); } catch (x) { e = x; } ok(!!e, 'custom length rejected: ' + n); });
{ const c1 = PL.build('custom', { start: START, days: 1 }); ok(c1.days.length === 1, 'custom 1 day'); const c365 = PL.build('custom', { start: START, days: 365 }); ok(c365.days.length === 365 && c365.summary.phases.length === 6, 'custom 365 days, 6 phases'); }
{ let e = null; try { PL.build('fit30_classic', { start: START }); } catch (x) { e = x; } ok(!!e, 'classic program is never regenerated'); }

T('media mapping');
const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'MEDIA-MANIFEST.json'), 'utf8'));
ok(Object.keys(MEDIA.ex).length === EXERCISES.length && EXERCISES.every(e => MEDIA.ex[e.id]), 'every exercise has a media record');
ok(Object.keys(MEDIA.rc).length === NUTRI.RECIPES.length && NUTRI.RECIPES.every(r => MEDIA.rc[r.id]), 'every recipe has a media record');
ok(man.items.length === EXERCISES.length * 2 + NUTRI.RECIPES.length * 3, 'manifest items = 2 per exercise + 3 per recipe');
ok(new Set(man.items.map(i => i.id)).size === man.items.length, 'manifest ids unique');
man.items.forEach(i => { ok(['available', 'missing'].includes(i.status), i.id + ' status'); ok(!!i.alt, i.id + ' alt text'); ok(!!i.fallback, i.id + ' fallback defined');
  if (i.status === 'available') { ok(!!i.path && !!i.source && !!i.license, i.id + ' available asset has path, source and license'); if (i.kind !== 'image-set') ok(fs.existsSync(path.join(ROOT, 'src', i.path)), i.id + ' file exists'); }
  else ok(i.path === null || i.path === undefined, i.id + ' missing asset has no path'); });
const covers = EXERCISES.map(e => MEDIA.ex[e.id].poster);
ok(covers.every(Boolean), 'all exercises have a cover');
ok(new Set(covers.map(c => sha(fs.readFileSync(path.join(ROOT, 'src/media', c.l))))).size === covers.length, 'covers are unique per exercise (no shared image)');
ok(covers.every(c => fs.statSync(path.join(ROOT, 'src/media', c.s)).size <= 30000 && fs.statSync(path.join(ROOT, 'src/media', c.l)).size <= 60000), 'cover sizes ≤30 KB (480) / ≤60 KB (960)');
const vids = Object.values(MEDIA.ex).map(x => x.video).filter(Boolean); ok(new Set(vids.map(v => v.mp4 || v.webm)).size === vids.length, 'no video shared between exercises');
ok(man.summary.exerciseVideos.available === vids.length, 'manifest video count matches data');
const bundle = fs.readFileSync(path.join(ROOT, 'dist/pwa/index.html'));
ok(!/data:video|data:image\/webp/.test(bundle.toString()), 'no media bytes embedded in the app bundle');
ok(fs.statSync(path.join(ROOT, 'src/data/media.js')).size < 40000, 'media metadata small (' + fs.statSync(path.join(ROOT, 'src/data/media.js')).size + ' B)');

T('ingest pipeline');
const TMP = fs.mkdtempSync(path.join(require('os').tmpdir(), 'fit30-ingest-')); const FX = path.join(__dirname, 'fixtures');
fs.mkdirSync(path.join(TMP, 'src')); for (const f of ['test-clip.webm', 'test-photo.jpg']) fs.copyFileSync(path.join(FX, f), path.join(TMP, 'src', f));
// minimal MP4 headers: one H.264 with 4 s duration, one without a video codec
const box = (t, body) => { const b = Buffer.alloc(8 + body.length); b.writeUInt32BE(8 + body.length); b.write(t, 4, 'latin1'); body.copy(b, 8); return b; };
const mvhd = (ts, du) => { const b = Buffer.alloc(100); b.writeUInt32BE(ts, 12); b.writeUInt32BE(du, 16); return box('mvhd', b); };
fs.writeFileSync(path.join(TMP, 'src/ok.mp4'), Buffer.concat([box('ftyp', Buffer.from('isom0000isomavc1')), box('moov', Buffer.concat([mvhd(1000, 4000), box('avc1', Buffer.alloc(8))]))]));
fs.writeFileSync(path.join(TMP, 'src/nocodec.mp4'), Buffer.concat([box('ftyp', Buffer.from('isom0000isom')), box('moov', mvhd(1000, 4000))]));
const good = { source: 'test fixture', author: 'test', license: 'original', matches: true };
fs.writeFileSync(path.join(TMP, 'src/credits.json'), JSON.stringify({ exercises: {
  squat: { video: Object.assign({ mp4: 'ok.mp4', webm: 'test-clip.webm', poster: 'test-photo.jpg' }, good) },
  pushup: { video: Object.assign({ mp4: 'nocodec.mp4', poster: 'test-photo.jpg' }, good) },
  plank: { video: Object.assign({ mp4: 'ok.mp4', poster: 'test-photo.jpg' }, good, { license: 'free-on-internet' }) },
  lunge_typo: { video: Object.assign({ mp4: 'ok.mp4', poster: 'test-photo.jpg' }, good) },
  burpee: { video: Object.assign({ mp4: 'ok.mp4', poster: 'test-photo.jpg' }, good, { matches: false }) },
  calf_raise: { video: Object.assign({ mp4: 'ok.mp4' }, good) } },
  recipes: { chicken_curry_rice: { photo: Object.assign({ file: 'test-photo.jpg' }, good), steps: [Object.assign({ step: 2, file: 'test-photo.jpg' }, good)] },
    egg_curry_rice: { photo: Object.assign({ file: 'test-photo.jpg' }, good, { license: 'CC-BY-4.0' }) } } }));
let out = ''; try { out = execFileSync('node', [path.join(__dirname, 'media_build.js'), '--src', path.join(TMP, 'src'), '--out', path.join(TMP, 'out'), '--manifest', path.join(TMP, 'manifest.json'), '--data', path.join(TMP, 'media.js')], { env: process.env }).toString(); } catch (e) { out = e.stdout.toString(); ok(e.status === 3, 'ingest with invalid entries exits with code 3 (got ' + e.status + ')'); }
const tm = JSON.parse(fs.readFileSync(path.join(TMP, 'manifest.json'), 'utf8')); delete globalThis.MEDIA; require(path.join(TMP, 'media.js')); const TMED = globalThis.MEDIA;
ok(!!TMED.ex.squat.video && TMED.ex.squat.video.dur === 4 && TMED.ex.squat.video.mp4 && TMED.ex.squat.video.webm, 'valid video ingested (mp4 + webm, duration 4 s read from header)');
ok(!TMED.ex.pushup.video && tm.errors.some(e => /pushup/.test(e) && /H\.264/.test(e)), 'MP4 without H.264/HEVC rejected');
ok(!TMED.ex.plank.video && tm.errors.some(e => /plank/.test(e) && /רישיון/.test(e)), 'unknown license rejected');
ok(tm.errors.some(e => /lunge_typo/.test(e)), 'unknown exercise id rejected');
ok(!TMED.ex.burpee.video && tm.errors.some(e => /burpee/.test(e) && /matches/.test(e)), 'asset without match confirmation rejected');
ok(!TMED.ex.calf_raise.video && tm.errors.some(e => /calf_raise/.test(e) && /poster/.test(e)), 'video without poster rejected');
ok(tm.errors.some(e => /egg_curry_rice/.test(e) && /licenseUrl/.test(e)) && !TMED.rc.egg_curry_rice.photo, 'CC-BY without license URL rejected');
const ph = TMED.rc.chicken_curry_rice.photo; ok(!!ph && /\.webp$/.test(ph.s) && /\.webp$/.test(ph.l), 'photo converted to WebP');
ok(!!ph && fs.existsSync(path.join(TMP, 'out', ph.s)) && fs.existsSync(path.join(TMP, 'out', ph.l)), 'photo sizes 480/960 written');
ok(!!ph && ph.h / ph.w === 0.75, 'recipe photo cropped to 4:3');
ok(TMED.rc.chicken_curry_rice.steps.length === 1, 'step photo ingested');
ok(tm.summary.recipePhotos.available === 1 && tm.summary.exerciseVideos.available === 1, 'manifest counts reflect only accepted assets');
ok(!!TMED.credits['ex:squat:video'] && TMED.credits['ex:squat:video'].license === 'original', 'credit recorded');
fs.rmSync(TMP, { recursive: true, force: true });
delete globalThis.MEDIA; require(path.join(ROOT, 'src/data/media.js'));

fs.mkdirSync(path.join(ROOT, 'dist/reports'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'dist/reports/stageA-test.json'), JSON.stringify({ pass, fail, sections: sec, fails, plannerRows: rows, cuisines, media: man.summary }, null, 1));
console.log(JSON.stringify(sec)); console.log('cuisines', JSON.stringify(cuisines));
if (fails.length) console.log('FAILURES:\n' + fails.slice(0, 40).join('\n'));
console.log(`stage A tests: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
