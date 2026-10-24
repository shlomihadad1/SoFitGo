/* Build: bundles sources into (1) a standalone PWA folder and (2) a single-file artifact page. */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const R = p => path.join(__dirname, '..', p);
const read = p => fs.readFileSync(R(p), 'utf8');
const JS = ['src/js/i18n.js', 'src/js/figure.js', 'src/data/exercises.js', 'src/data/workouts.js', 'src/data/nutrition.js', 'src/data/recipes_intl.js', 'src/data/recipes_med.js', 'src/data/catalog.js', 'src/data/programs.js', 'src/data/media.js', 'src/js/logic.js', 'src/js/planner.js', 'src/js/plans.js', 'src/js/mealplanner.js', 'src/js/store.js', 'src/js/core.js', 'src/js/cms_content.js', 'src/js/activity.js', 'src/js/insights.js', 'src/js/adapt.js', 'src/js/signature.js', 'src/js/ui.js', 'src/js/mediaui.js', 'src/js/screens_home.js', 'src/js/screens_workout.js', 'src/js/screens_nutrition.js', 'src/js/screens_progress.js', 'src/js/screens_plan.js', 'src/js/screens_signature.js', 'src/js/run.js', 'src/js/main.js'];
/* RC1: help & tutorials are a separate chunk (help.js) — fetched only when the help screen opens and precached by the
   service worker for offline use; the single-file artifact inlines it. Keeps the first-load budget (700 KB) intact. */
const LAZY = ['src/data/tutorials.js', 'src/data/tutorials_media.js', 'src/js/screens_help.js'];
/* RC5: second on-demand chunk for screens that are not needed on first load (precached for offline like help.js) */
const EXTRA = ['src/js/activity_more.js', 'src/js/screens_activity.js', 'src/js/screens_shopping.js', 'src/js/screens_fridge.js', 'src/js/screens_beta.js', 'src/js/screens_signature_more.js', 'src/js/screens_m8.js', 'src/js/screens_programs.js', 'src/js/screens_install.js', 'src/js/screens_travel_sheet.js', 'src/js/screens_profile.js', 'src/js/screens_pday.js', 'src/js/screens_recipes.js', 'src/js/screens_food_near.js', 'src/js/run_setup.js', 'src/js/coach_ask.js', 'src/js/meal_options.js', 'src/js/sync_tools.js', 'src/js/gate.js', 'src/js/gate_ui.js', 'src/js/food_prefs_ui.js'];
/* M10: accounts + sync + legal drafts — loaded only when the user opens the account screen or already has a session */
const ACCOUNT = ['src/js/account.js', 'src/js/screens_account.js'];
const ADMIN = ['src/js/admin.js']; /* Admin CMS chunk (route #/admin), loaded after account.js */
/* M10: backend configuration comes from the environment at build time (never from files in the repository).
   Only the Supabase PROJECT URL and the PUBLISHABLE (anon) key may be embedded — both are public by design; data is protected
   by the database's Row Level Security. A secret / service-role key is refused so it can never reach a browser. */
const BACKEND = (() => {
  const url = (process.env.SOFITGO_SUPABASE_URL || '').trim().replace(/\/+$/, ''), key = (process.env.SOFITGO_SUPABASE_PUBLISHABLE_KEY || '').trim();
  if (!url && !key) return null;
  if (!url || !key) throw new Error('Set BOTH SOFITGO_SUPABASE_URL and SOFITGO_SUPABASE_PUBLISHABLE_KEY, or neither.');
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) && !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(url)) throw new Error('SOFITGO_SUPABASE_URL must be https://<project>.supabase.co (or a localhost test server).');
  if (/^sb_secret_/.test(key)) throw new Error('Refusing to build: that is a SECRET key. Use the publishable key (sb_publishable_…).');
  if (/^eyJ/.test(key)) { let role = ''; try { role = JSON.parse(Buffer.from(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()).role; } catch (e) { } if (role !== 'anon') throw new Error('Refusing to build: legacy JWT key with role "' + role + '" — only the anon key is allowed in the browser.'); }
  else if (!/^sb_publishable_[A-Za-z0-9_-]{8,}$/.test(key)) throw new Error('SOFITGO_SUPABASE_PUBLISHABLE_KEY does not look like a publishable key.');
  return { url, key, channel: (process.env.FIT30_CHANNEL || 'beta').replace(/[^a-z0-9-]/g, '').slice(0, 20) };
})();
/* M10 · runtime switch for cloud accounts WITHOUT rebuilding: sofitgo-config.js sits next to index.html. Empty (default) = device-only.
   The owner fills in the project URL + PUBLISHABLE key and redeploys the folder. The loader below accepts only a *.supabase.co URL and a
   publishable key (sb_publishable_… or a legacy JWT whose role is "anon"); anything else — e.g. a secret key — is ignored and never used.
   A build made with SOFITGO_SUPABASE_* env vars has its config inline and ignores the file. */
const CONFIG_TEMPLATE = `/* SoFitGo — cloud accounts switch (beta)
   Empty values (default) = the app keeps all data on this device only; no account screens.
   To turn on accounts: Supabase dashboard → Project Settings → API Keys. Copy the Project URL and the PUBLISHABLE key
   (starts with sb_publishable_). Paste both below, save, and redeploy this folder.
   Paste ONLY the publishable key — never any other key (e.g. service_role): this file is public. The app ignores other keys, but they would still be exposed.
   Before turning this on, the database migration must be applied (see docs/SUPABASE-MIGRATION-REVIEW.md). */
window.SOFITGO_CONFIG = { supabaseUrl: '', publishableKey: '' };
`;
const RUNTIME_CFG = "(function(){var w=window,c=w.SOFITGO_CONFIG;if(w.FIT30_BACKEND||!c||!c.supabaseUrl||!c.publishableKey)return;var u=String(c.supabaseUrl).trim().replace(/\\/+$/,''),k=String(c.publishableKey).trim(),ok=(/^https:\\/\\/[a-z0-9-]+\\.supabase\\.co$/.test(u)||/^http:\\/\\/(localhost|127\\.0\\.0\\.1):\\d+$/.test(u))&&(/^sb_publishable_[A-Za-z0-9_-]{8,}$/.test(k)||(function(){try{return /^eyJ/.test(k)&&JSON.parse(atob(k.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).role==='anon'}catch(e){return false}})());if(!ok){console.warn('sofitgo-config.js ignored: needs https://<project>.supabase.co and a PUBLISHABLE key');return}w.FIT30_BACKEND={url:u,key:k,channel:'beta',source:'config'}})();";
const cssSrc = read('src/css/styles.css');
const jsSrc = JS.concat(LAZY, EXTRA, ACCOUNT, ADMIN).filter(f => f !== 'src/data/tutorials_media.js' /* generated FROM this build by tools/tutorials_build.js; excluded so recording does not change the id it records */).map(f => `/* ${f} */\n` + read(f)).join('\n');
const hash = crypto.createHash('sha1').update(cssSrc + jsSrc + read('src/js/debug_layout.js') + read('tools/build.js') + JSON.stringify(BACKEND) /* M10: a build for another backend/channel is a different build */ /* RC5: the service worker and manifest are generated here, so their changes must change the build id too */).digest('hex').slice(0, 10);
/* Size: whitespace + comments are stripped per file with esbuild (no identifier renaming, no syntax rewriting, UTF-8 kept),
   so the shipped code is the same program as src/. FIT30_NOMIN=1 builds the unminified version for debugging. */
let esb = null; try { esb = require('esbuild'); } catch (e) { /* esbuild not installed → unminified build */ }
const minJs = (code, f) => esb && !process.env.FIT30_NOMIN ? `/* ${f} */` + esb.transformSync(code, { loader: 'js', minifyWhitespace: true, minifySyntax: true, legalComments: 'none', charset: 'utf8', target: 'esnext' }).code : `/* ${f} */\n` + code;
const css = esb && !process.env.FIT30_NOMIN ? esb.transformSync(cssSrc, { loader: 'css', minifyWhitespace: true, charset: 'utf8' }).code : cssSrc;
/* first-load budget: recipe media records with no media at all are dropped from the shipped copy (Media.* treats a missing record as "none") */
const slim = (f, t) => f === 'src/data/media.js' ? t.replace(/"[a-z0-9_]+":\{"photo":null,"prep":null,"steps":\[\]\},?/g, '').replace(/,\}/g, '}').replace(/"[sl]Bytes":\d+,|"sha":"[0-9a-f]+",|,"origin":"generated"/g, '') : t; /* first-load copy: drop metadata the app never reads (sizes, hash, origin stay in src/data/media.js for the media tests) */
const js = JS.map(f => minJs(slim(f, read(f)), f)).join('\n');
const lazyJs = LAZY.map(f => minJs(read(f), f)).join('\n');
const extraJs = EXTRA.map(f => minJs(read(f), f)).join('\n');
const accountJs = ACCOUNT.map(f => minJs(read(f), f)).join('\n');
const adminJs = ADMIN.map(f => minJs(read(f), f)).join('\n');
const FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700&family=Rubik:wght@500;600;700&display=swap">';
const SHELL = '<header class="top" id="top"></header><main id="view" aria-live="polite"></main><nav class="nav" id="nav" aria-label="ניווט ראשי"></nav><noscript><p style="padding:20px">יש להפעיל JavaScript כדי להשתמש באפליקציה.</p></noscript>';
/* Brand (RC5): ONE switch for every user-facing app name. Technical identifiers (storage keys 'fit30.*', cache names
   'fit30-*', backup format app:'fit30', IndexedDB 'fit30-photos', file names) are deliberately NOT renamed, so existing
   user data, installed copies and backups keep working. Revert to the previous identity with FIT30_BRAND=fit30. */
const BRANDS = {
  sofitgo: { name: 'SoFitGo', short: 'SoFitGo', title: 'SoFitGo', full: 'SoFitGo — אימונים ותזונה', bg: '#0F1115', icons: 'src/static/brand/sofitgo/',
    /* coach images: swap the file (same name) to upgrade the art without touching code */ extra: ['sofit-avatar-192.webp'],
    /* M9: header wordmark + compact symbol. PROVISIONAL rasters cleaned from the supplied SoFitGo_Logo_Assets.zip extraction
       (sofitgo-brand/logo-assets-m9/clean_logo.py); replace with exports of the original vector logo when delivered (same names). */
    logo: { word: 'sofitgo-wordmark-provisional.png', sym: 'sofitgo-symbol-provisional.png' } },
  fit30: { name: 'כושר 30', short: 'כושר 30', title: 'כושר 30 · מנאלי', full: 'כושר 30 — אימונים ותזונה', bg: '#0d1114', icons: 'src/static/', extra: [] } };
const BRAND = BRANDS[process.env.FIT30_BRAND || 'sofitgo'];
const TITLE = BRAND.title;

// PWA
const out = R(process.env.FIT30_OUT || 'dist/pwa'); /* M10: FIT30_OUT builds a variant (e.g. the beta build) without touching dist/pwa */ fs.mkdirSync(out, { recursive: true }); for (const f of fs.readdirSync(out)) fs.rmSync(path.join(out, f), { recursive: true, force: true });
fs.writeFileSync(path.join(out, 'index.html'), `<!doctype html>
<html lang="he" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${TITLE}</title>
<meta name="theme-color" content="${BRAND.bg}">
<meta name="description" content="תוכנית כושר ותזונה אישית ל־30 יום — אימונים בבית, תפריט הודי, מעקב התקדמות.">
<meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="${BRAND.short}">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<link rel="icon" href="icon-192.png" type="image/png">
${FONTS}
<style>${css}</style></head><body>${SHELL}
<script>window.FIT30_ENV='pwa';window.FIT30_BUILD='${hash}';window.FIT30_BRAND=${JSON.stringify(BRAND.name)};window.FIT30_COACH=${BRAND.extra.length ? JSON.stringify({ name: 'Sofit', avatar: BRAND.extra[0] }) : 'null'};window.FIT30_LOGO=${BRAND.logo ? JSON.stringify(BRAND.logo) : 'null'};${BACKEND ? 'window.FIT30_BACKEND=' + JSON.stringify(BACKEND).replace(/</g, '\\u003c') + ';' : ''}</script>
<script src="sofitgo-config.js"></script>
<script>${RUNTIME_CFG}</script>
<script>${js}</script></body></html>`);
fs.writeFileSync(path.join(out, 'manifest.webmanifest'), JSON.stringify({
  name: BRAND.full, short_name: BRAND.short, lang: 'he', dir: 'rtl', start_url: './', scope: './', display: 'standalone', orientation: 'portrait',
  background_color: BRAND.bg, theme_color: BRAND.bg,
  icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }, { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }]
}, null, 2));
fs.writeFileSync(path.join(out, 'sofitgo-config.js'), CONFIG_TEMPLATE);
fs.writeFileSync(path.join(out, 'sw.js'), `/* Service worker
   - app shell (index.html, manifest, icons) precached per build: 'fit30-<build>'; old shells deleted on activate
   - media images: cache on first view in 'fit30-media-v1', bounded to MEDIA_MAX entries (oldest removed first);
     media files are content-hashed, so a cached file can never be a stale version of another file
   - videos are NOT cached and not intercepted (range requests go straight to the network) — no offline video
   - fonts cached at runtime */
const CACHE = 'fit30-${hash}', MEDIA = 'fit30-media-v1', MEDIA_MAX = 160;
const ASSETS = ['./', 'index.html', 'help.js', 'extra.js', 'account.js', 'admin.js', 'sofitgo-config.js', 'manifest.webmanifest', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'${BRAND.extra.concat(BRAND.logo ? [BRAND.logo.word, BRAND.logo.sym] : []).map(f => `, '${f}'`).join('')}];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('fit30-') && k !== CACHE && k !== MEDIA && k !== 'fit30-fonts').map(k => caches.delete(k)))).then(() => self.clients.claim())); });
const trim = c => c.keys().then(ks => ks.length > MEDIA_MAX ? Promise.all(ks.slice(0, ks.length - MEDIA_MAX).map(k => c.delete(k))) : null);
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (u.origin === location.origin) {
    /* P0-F (RC5): only a real app shell may replace the cached one — never a login page (401/redirect), an error page or an
       opaque response; otherwise an expired host login or a 5xx would poison offline use. The live response is still shown. */
    if (e.request.mode === 'navigate') { e.respondWith(fetch(e.request).then(r => { if (r.ok && r.status === 200 && !r.redirected && r.type === 'basic' && /text\\/html/.test(r.headers.get('content-type') || '')) { const c = r.clone(); c.text().then(t => { if (t.includes('window.FIT30_BUILD=')) caches.open(CACHE).then(x => x.put('index.html', new Response(t, { headers: { 'content-type': 'text/html; charset=utf-8' } }))); }); } return r; }).catch(() => caches.match('index.html'))); return; }
    /* M10: the accounts switch is read network-first (an edited file takes effect on the next launch); offline or after 3 s → cached copy */
    if (u.pathname.endsWith('/sofitgo-config.js')) { const cfg = () => caches.match('sofitgo-config.js'); const net = fetch(e.request, { cache: 'no-store' }).then(r => { if (r.ok && r.status === 200 && !r.redirected && /javascript/.test(r.headers.get('content-type') || '')) { const c = r.clone(); caches.open(CACHE).then(x => x.put('sofitgo-config.js', c)); } return r; });
      e.respondWith(Promise.race([net, new Promise(res => setTimeout(() => cfg().then(h => { if (h) res(h); }), 3000))]).catch(() => cfg())); return; }
    if (u.pathname.includes('/media/')) {
      if (/\\.(mp4|webm|m4v|mov)$/i.test(u.pathname) || e.request.headers.has('range')) return; // video: network only
      e.respondWith(caches.open(MEDIA).then(c => c.match(e.request).then(hit => hit || fetch(e.request).then(r => { if (r.ok) { c.put(e.request, r.clone()).then(() => trim(c)); } return r; }))));
      return;
    }
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
  } else if (u.host.endsWith('fonts.googleapis.com') || u.host.endsWith('fonts.gstatic.com')) {
    e.respondWith(caches.open('fit30-fonts').then(c => c.match(e.request).then(r => { const f = fetch(e.request).then(n => { c.put(e.request, n.clone()); return n; }).catch(() => r); return r || f; })));
  }
});
`);

if (fs.existsSync(R('src/media'))) fs.cpSync(R('src/media'), path.join(out, 'media'), { recursive: true });
for (const f of ['apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png']) fs.copyFileSync(R(BRAND.icons + f), path.join(out, f));
for (const f of BRAND.extra) fs.copyFileSync(R(BRAND.icons + 'sofit/' + f), path.join(out, f));
if (BRAND.logo) for (const f of [BRAND.logo.word, BRAND.logo.sym]) fs.copyFileSync(R(BRAND.icons + 'logo/' + f), path.join(out, f));
fs.writeFileSync(path.join(out, 'help.js'), lazyJs);
fs.writeFileSync(path.join(out, 'extra.js'), extraJs);
fs.writeFileSync(path.join(out, 'account.js'), accountJs);
fs.writeFileSync(path.join(out, 'admin.js'), adminJs);
/* RC5: layout diagnostics, fetched only with ?debug=layout (not precached, not in the first-load budget) */
fs.writeFileSync(path.join(out, 'debug-layout.js'), minJs(read('src/js/debug_layout.js'), 'src/js/debug_layout.js'));
fs.writeFileSync(path.join(out, 'README.txt'), `${BRAND.name} — אפליקציית כושר ותזונה (PWA)
Build ${hash}

קבצים: index.html (כל האפליקציה), sw.js (עבודה ללא חיבור), manifest.webmanifest, אייקונים.

הפעלה באייפון:
1. מעלים את כל הקבצים מהתיקייה הזו (ללא תתי־תיקיות) לאחסון סטטי עם HTTPS:
   GitHub Pages / Netlify / Cloudflare Pages. ב־Netlify אפשר לגרור את התיקייה ל־app.netlify.com/drop.
2. פותחים את הכתובת ב־Safari באייפון.
3. שיתוף ← "הוספה למסך הבית" ← "הוספה".
4. פותחים מהאייקון. אחרי הפתיחה הראשונה האפליקציה עובדת גם בלי אינטרנט.

בדיקה במחשב: בתוך התיקייה מריצים  python3 -m http.server 8080  ופותחים http://localhost:8080
(פתיחה ישירה של index.html כקובץ עובדת, אבל בלי Service Worker).

נתונים: נשמרים רק במכשיר (Local Storage; תמונות ב־IndexedDB). אין שרת ואין ענן.
באייפון האפליקציה שבמסך הבית מקבלת אחסון נפרד מ־Safari — להעברה: הגדרות ← ייצוא גיבוי ← שחזור.
תמונות התקדמות לא נכללות בגיבוי.
`);

// Artifact (single file fragment; the host adds the document skeleton)
const art = R('dist/artifact'); fs.mkdirSync(art, { recursive: true });
fs.writeFileSync(path.join(art, 'fit30.html'), `<title>${BRAND.title}</title>
<meta name="claude:viewport-fit-sides" content="cover">
${FONTS}
<style>${css}
body { padding-left: 0; padding-right: 0; }</style>
${SHELL}
<script>window.FIT30_ENV='artifact';window.FIT30_MEDIA=false;window.FIT30_BUILD='${hash}';window.FIT30_BRAND=${JSON.stringify(BRAND.name)};window.FIT30_LOGO=${BRAND.logo ? JSON.stringify({ word: 'data:image/png;base64,' + fs.readFileSync(R(BRAND.icons + 'logo/' + BRAND.logo.word)).toString('base64'), sym: 'data:image/png;base64,' + fs.readFileSync(R(BRAND.icons + 'logo/' + BRAND.logo.sym)).toString('base64') }) : 'null'};</script>
<script>${js}
${lazyJs}
${extraJs}
${accountJs}</script>`);
console.log('built', hash, 'pwa', fs.statSync(path.join(out, 'index.html')).size, 'artifact', fs.statSync(path.join(art, 'fit30.html')).size);
