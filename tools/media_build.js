/* Media build (Stage A).
   1. GENERATED (original work): one cover image per exercise, rendered from the app's own figure model
      (start pose → end pose), WebP 480 w + 960 w, 16:9. No third-party rights involved.
   2. INGESTED (third-party or own photos/videos): read media-src/credits.json; every asset must declare source,
      author, license (allow-list), licenseUrl and an explicit confirmation that it shows exactly this exercise/dish.
      Images → WebP 480/960 (cover crop to the slot's aspect ratio). Videos → MP4 (H.264/HEVC, checked in the file
      header) required for iPhone, optional WebM; duration read from the MP4 header; size limits enforced.
   3. Writes src/media/** (content-hashed names), src/data/media.js (metadata only — no media bytes in the bundle)
      and MEDIA-MANIFEST.json (every exercise and recipe, including what is missing).
   Usage: node tools/media_build.js [--src media-src] [--out src/media] [--manifest MEDIA-MANIFEST.json] [--data src/data/media.js] [--allow-webm-only]
*/
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const sharp = require('sharp');
const ROOT = path.join(__dirname, '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const SRC = path.resolve(ROOT, arg('--src', 'media-src')), OUT = path.resolve(ROOT, arg('--out', 'src/media'));
const MANIFEST = path.resolve(ROOT, arg('--manifest', 'MEDIA-MANIFEST.json')), DATA = path.resolve(ROOT, arg('--data', 'src/data/media.js'));
const ALLOW_WEBM_ONLY = process.argv.includes('--allow-webm-only'); // test fixtures only (Chromium cannot play H.264)
for (const f of ['src/js/figure.js', 'src/data/exercises.js', 'src/data/workouts.js', 'src/data/nutrition.js', 'src/data/recipes_intl.js']) require(path.join(ROOT, f));
const { EXERCISES, NUTRI, Figure } = globalThis;

const LICENSES = { 'original': 'יצירה מקורית של בעל האפליקציה', 'CC0-1.0': 'Creative Commons Zero', 'CC-BY-4.0': 'Creative Commons Attribution 4.0', 'CC-BY-SA-4.0': 'Creative Commons Attribution-ShareAlike 4.0', 'Pexels': 'Pexels License', 'Unsplash': 'Unsplash License', 'Pixabay': 'Pixabay Content License', 'licensed': 'רישיון מסחרי שנרכש (חובה לצרף מספר רישיון/חשבונית)' };
const ATTRIB_REQUIRED = ['CC-BY-4.0', 'CC-BY-SA-4.0'];
const MAX = { image: 8e6, video: 6e6, videoSec: 45 };
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const rel = p => path.relative(OUT, p).split(path.sep).join('/');
const errors = [], warnings = [];

/* ---------- 1. generated exercise covers ---------- */
const CSS = `.fp-near,.fp-torso{stroke:#f2a33a;stroke-width:5.5;stroke-linecap:round}.fp-far{stroke:#6f7f89;stroke-width:4.5;stroke-linecap:round}.fp-head{fill:#f2a33a}.fp-floor{stroke:#2a3640;stroke-width:2}.fp-prop rect{fill:#2b3843}.fp-prop line{stroke:#2b3843;stroke-width:4;stroke-linecap:round}.fp-towel{stroke:#6cc3d5;stroke-width:2.5;fill:none;stroke-dasharray:3 3}`;
function coverSvg(ex) {
  const A = Figure.staticSvg(ex, 'A'), B = Figure.staticSvg(ex, 'B');
  const panel = (p, x) => `<g transform="translate(${x},70)"><rect width="400" height="360" rx="22" fill="#141a1f" stroke="#2a3640" stroke-width="2"/><svg x="10" y="20" width="380" height="317" viewBox="0 0 ${Figure.VW} ${Figure.VH}"><line class="fp-floor" x1="6" y1="${Figure.FLOOR}" x2="${Figure.VW - 6}" y2="${Figure.FLOOR}"/>${p.props}${p.fig}</svg></g>`;
  // RTL reading order: start pose on the right, end pose on the left, arrow pointing left
  return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#11181d"/><stop offset="1" stop-color="#0b0f12"/></linearGradient><style>${CSS}</style></defs>
<rect width="960" height="540" fill="url(#g)"/>${panel(A, 520)}${panel(B, 40)}
<g transform="translate(480,250)"><circle r="30" fill="#f2a33a"/><path d="M12,0 H-12 M-2,-10 L-12,0 L-2,10" stroke="#1b1204" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>
<rect x="520" y="452" width="400" height="8" rx="4" fill="#f2a33a" opacity=".85"/><rect x="40" y="452" width="400" height="8" rx="4" fill="#5cc08a" opacity=".85"/></svg>`;
}
async function writeImage(buf, base, aspect) {
  // aspect: [w,h]; returns {s, l, w, h, bytes, sha}
  const h = sha(buf).slice(0, 10), out = {};
  for (const [k, W] of [['s', 480], ['l', 960]]) {
    const Hh = Math.round(W * aspect[1] / aspect[0]);
    const img = await sharp(buf).resize(W, Hh, { fit: 'cover', position: 'attention' }).webp({ quality: 78, effort: 5 }).toBuffer();
    const file = path.join(OUT, `${base}-${h}-${W}.webp`); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, img);
    out[k] = rel(file); out[k + 'Bytes'] = img.length;
  }
  return Object.assign(out, { w: 960, h: Math.round(960 * aspect[1] / aspect[0]), sha: h });
}

/* ---------- 2. ingest helpers ---------- */
function mp4Info(buf) { // minimal ISO-BMFF walk: brand, codec presence, duration from mvhd
  const s = buf.toString('latin1'); const info = { mp4: s.slice(4, 8) === 'ftyp', h264: s.includes('avc1'), hevc: s.includes('hvc1') || s.includes('hev1'), dur: null };
  const i = s.indexOf('mvhd'); if (i > 0) { const v = buf[i + 4]; const ts = v === 1 ? buf.readUInt32BE(i + 24) : buf.readUInt32BE(i + 16); const du = v === 1 ? Number(buf.readBigUInt64BE(i + 28)) : buf.readUInt32BE(i + 20); if (ts) info.dur = Math.round(du / ts * 10) / 10; }
  return info;
}
const isWebm = buf => buf.readUInt32BE(0) === 0x1A45DFA3;
function checkCredit(c, where) {
  const miss = ['source', 'author', 'license'].filter(k => !c[k]);
  if (miss.length) { errors.push(`${where}: חסר ${miss.join(', ')}`); return false; }
  if (!LICENSES[c.license]) { errors.push(`${where}: רישיון "${c.license}" אינו ברשימה המותרת (${Object.keys(LICENSES).join(', ')})`); return false; }
  if (c.license !== 'original' && !c.licenseUrl) { errors.push(`${where}: חסר licenseUrl`); return false; }
  if (c.matches !== true) { errors.push(`${where}: חסר אישור matches:true שהמדיה מציגה בדיוק את הפריט`); return false; }
  return true;
}
const readSrc = f => { const p = path.join(SRC, f); if (!fs.existsSync(p)) { errors.push('קובץ חסר: ' + p); return null; } return fs.readFileSync(p); };

async function ingestVideo(v, where, base, creditId, media) {
  if (!checkCredit(v, where)) return null;
  const mp4 = v.mp4 && readSrc(v.mp4), webm = v.webm && readSrc(v.webm), poster = v.poster && readSrc(v.poster);
  if (!poster) { errors.push(where + ': חובה תמונת שער (poster)'); return null; }
  let info = null; if (mp4) { info = mp4Info(mp4); if (!info.mp4 || !(info.h264 || info.hevc)) { errors.push(where + ': קובץ MP4 חייב להיות H.264 או HEVC (לאייפון)'); return null; } }
  else if (!(ALLOW_WEBM_ONLY && webm)) { errors.push(where + ': חובה קובץ MP4 (H.264) — Safari באייפון'); return null; }
  if (webm && !isWebm(webm)) { errors.push(where + ': קובץ ה־WebM אינו תקין'); return null; }
  if ([mp4, webm].some(b => b && b.length > MAX.video)) { errors.push(where + `: קובץ גדול מ־${MAX.video / 1e6}MB — יש לכווץ`); return null; }
  if (info && info.dur > MAX.videoSec) { errors.push(where + `: אורך ${info.dur} שנ׳ — מעל ${MAX.videoSec}`); return null; }
  const out = { poster: await writeImage(poster, base + '-poster', [16, 9]), dur: info ? info.dur : (v.durationSec || null), origin: 'ingested' };
  for (const [k, b] of [['mp4', mp4], ['webm', webm]]) if (b) { const f = path.join(OUT, `${base}-${sha(b).slice(0, 10)}.${k}`); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, b); out[k] = rel(f); out[k + 'Bytes'] = b.length; }
  out.credit = creditId; media.credits[creditId] = { source: v.source, author: v.author, license: v.license, licenseUrl: v.licenseUrl || null, note: v.note || null };
  return out;
}
(async () => {
  fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
  const media = { v: 1, ex: {}, rc: {}, credits: {} };
  const covHashes = new Map();
  for (const ex of EXERCISES) {
    const svg = coverSvg(ex), h = sha(svg);
    if (covHashes.has(h)) warnings.push(`כיסוי זהה ל־${ex.id} ול־${covHashes.get(h)}`); covHashes.set(h, ex.id);
    const img = await writeImage(Buffer.from(svg), `exercises/${ex.id}`, [16, 9]);
    media.ex[ex.id] = { poster: Object.assign(img, { origin: 'generated' }), video: null };
  }
  NUTRI.RECIPES.forEach(r => { media.rc[r.id] = { photo: null, prep: null, steps: [] }; });

  const creditsFile = path.join(SRC, 'credits.json');
  const credits = fs.existsSync(creditsFile) ? JSON.parse(fs.readFileSync(creditsFile, 'utf8')) : { exercises: {}, recipes: {} };
  for (const [id, c] of Object.entries(credits.exercises || {})) {
    if (!media.ex[id]) { errors.push(`credits: תרגיל לא קיים "${id}"`); continue; }
    if (c.video) { const out = await ingestVideo(c.video, `exercise ${id} video`, `exercises/${id}`, 'ex:' + id + ':video', media); if (out) media.ex[id].video = out; }
  }
  for (const [id, c] of Object.entries(credits.recipes || {})) {
    if (!media.rc[id]) { errors.push(`credits: מתכון לא קיים "${id}"`); continue; }
    if (c.photo) { const where = `recipe ${id} photo`; if (checkCredit(c.photo, where)) { const b = readSrc(c.photo.file); if (b) { if (b.length > MAX.image) errors.push(where + ': תמונה גדולה מדי'); else { const img = await writeImage(b, `recipes/${id}`, [4, 3]); img.credit = 'rc:' + id + ':photo'; img.origin = 'ingested'; media.rc[id].photo = img; media.credits[img.credit] = { source: c.photo.source, author: c.photo.author, license: c.photo.license, licenseUrl: c.photo.licenseUrl || null }; } } } }
    (c.steps || []).forEach((st, i) => { const where = `recipe ${id} step ${i + 1}`; if (!checkCredit(st, where)) return; const b = readSrc(st.file); if (!b) return; media.rc[id].steps.push({ step: st.step, file: null, _b: b, credit: 'rc:' + id + ':step' + (i + 1), c: st }); });
    if (c.prep) { const out = await ingestVideo(c.prep, `recipe ${id} prep video`, `recipes/${id}-prep`, 'rc:' + id + ':prep', media); if (out) media.rc[id].prep = out; }
  }
  for (const r of Object.values(media.rc)) for (const s of r.steps) { const img = await writeImage(s._b, `recipes/steps/${s.credit.replace(/[:]/g, '_')}`, [4, 3]); Object.assign(s, img); media.credits[s.credit] = { source: s.c.source, author: s.c.author, license: s.c.license, licenseUrl: s.c.licenseUrl || null }; delete s._b; delete s.c; delete s.file; }

  /* ---------- 3. outputs ---------- */
  fs.mkdirSync(path.dirname(DATA), { recursive: true });
  fs.writeFileSync(DATA, `/* GENERATED by tools/media_build.js — do not edit. Metadata only; media files live in media/. */\n(function (root) { root.MEDIA = ${JSON.stringify(media)}; })(typeof window !== 'undefined' ? window : globalThis);\n`);
  const items = [];
  for (const ex of EXERCISES) { const m = media.ex[ex.id];
    items.push({ id: `ex:${ex.id}:cover`, kind: 'image', role: 'exercise-cover', target: { type: 'exercise', id: ex.id }, path: 'media/' + m.poster.l, sizes: { 480: 'media/' + m.poster.s, 960: 'media/' + m.poster.l }, bytes: m.poster.sBytes + m.poster.lBytes, alt: `איור: ${ex.he} — תנוחת התחלה ותנוחת סיום`, status: 'available', origin: 'generated', source: 'tools/media_build.js — רינדור ממודל הדמות של האפליקציה', license: 'original', loading: 'lazy', fallback: 'inline-figure-svg' });
    const v = m.video; items.push({ id: `ex:${ex.id}:video`, kind: 'video', role: 'exercise-demo', target: { type: 'exercise', id: ex.id }, path: v ? 'media/' + (v.mp4 || v.webm) : null, sources: v ? { mp4: v.mp4 ? 'media/' + v.mp4 : null, webm: v.webm ? 'media/' + v.webm : null } : null, poster: v ? 'media/' + v.poster.l : null, bytes: v ? (v.mp4Bytes || 0) + (v.webmBytes || 0) : null, durationSec: v ? v.dur : null, alt: `סרטון הדגמה: ${ex.he}`, status: v ? 'available' : 'missing', origin: v ? 'ingested' : null, source: v ? media.credits[v.credit].source : null, license: v ? media.credits[v.credit].license : null, loading: 'on-demand', fallback: 'figure-animation (מסומן "אנימציית איור", לא סרטון)' }); }
  for (const r of NUTRI.RECIPES) { const m = media.rc[r.id];
    items.push({ id: `rc:${r.id}:photo`, kind: 'image', role: 'recipe-photo', target: { type: 'recipe', id: r.id }, path: m.photo ? 'media/' + m.photo.l : null, sizes: m.photo ? { 480: 'media/' + m.photo.s, 960: 'media/' + m.photo.l } : null, bytes: m.photo ? m.photo.sBytes + m.photo.lBytes : null, alt: `צילום המנה: ${r.he}`, status: m.photo ? 'available' : 'missing', origin: m.photo ? 'ingested' : null, source: m.photo ? media.credits[m.photo.credit].source : null, license: m.photo ? media.credits[m.photo.credit].license : null, loading: 'lazy', fallback: 'dish-illustration (מסומן "איור", לא צילום)' });
    { const v = m.prep; items.push({ id: `rc:${r.id}:prep-video`, kind: 'video', role: 'recipe-prep', target: { type: 'recipe', id: r.id }, path: v ? 'media/' + (v.mp4 || v.webm) : null, sources: v ? { mp4: v.mp4 ? 'media/' + v.mp4 : null, webm: v.webm ? 'media/' + v.webm : null } : null, poster: v ? 'media/' + v.poster.l : null, bytes: v ? (v.mp4Bytes || 0) + (v.webmBytes || 0) : null, durationSec: v ? v.dur : null, status: v ? 'available' : 'missing', origin: v ? 'ingested' : null, source: v ? media.credits[v.credit].source : null, license: v ? media.credits[v.credit].license : null, alt: `סרטון הכנה: ${r.he}`, loading: 'on-demand', fallback: 'written steps' }); }
    items.push({ id: `rc:${r.id}:steps`, kind: 'image-set', role: 'recipe-steps', target: { type: 'recipe', id: r.id }, count: m.steps.length, status: m.steps.length ? 'available' : 'missing', alt: `תמונות שלבי הכנה: ${r.he}`, loading: 'lazy', fallback: 'written steps' }); }
  const count = (role, st) => items.filter(i => i.role === role && i.status === st).length;
  const summary = { exercises: EXERCISES.length, recipes: NUTRI.RECIPES.length,
    exerciseCovers: { available: count('exercise-cover', 'available'), missing: count('exercise-cover', 'missing') },
    exerciseVideos: { available: count('exercise-demo', 'available'), missing: count('exercise-demo', 'missing') },
    recipePhotos: { available: count('recipe-photo', 'available'), missing: count('recipe-photo', 'missing') },
    recipePrepVideos: { available: count('recipe-prep', 'available'), missing: count('recipe-prep', 'missing') },
    recipeStepSets: { available: count('recipe-steps', 'available'), missing: count('recipe-steps', 'missing') },
    bytes: fs.readdirSync(OUT, { recursive: true }).map(f => path.join(OUT, f)).filter(f => fs.statSync(f).isFile()).reduce((s, f) => s + fs.statSync(f).size, 0),
    duplicateCovers: warnings.filter(w => /כיסוי זהה/.test(w)).length };
  fs.writeFileSync(MANIFEST, JSON.stringify({ generated: 'tools/media_build.js', version: 1, licenses: LICENSES, attributionRequired: ATTRIB_REQUIRED, limits: MAX, summary, errors, warnings, items }, null, 1));
  console.log(JSON.stringify(summary)); if (warnings.length) console.log('WARN', warnings.join('\n')); if (errors.length) { console.log('ERRORS', errors.join('\n')); process.exitCode = 3; }
})().catch(e => { console.error(e); process.exit(2); });
