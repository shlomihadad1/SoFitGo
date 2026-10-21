/* Stage A browser tests (Playwright Chromium; iPhone-13 viewport emulation — NOT a physical iPhone, NOT Safari).
   Media "available" states use TEST FIXTURES injected at runtime (tools/fixtures) — they are not shipped content.
   Usage: node tools/e2e_stageA.js [URL]   (default http://localhost:8096/) — writes dist/reports/e2e-stageA.json */
const { chromium, devices } = require('playwright'); const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const URL0 = process.argv[2] || 'http://localhost:8096/';
const FX = path.join(__dirname, 'fixtures'); const clip = fs.readFileSync(path.join(FX, 'test-clip.webm')), photo = fs.readFileSync(path.join(FX, 'test-photo.jpg'));
const res = []; let G = ''; const ok = (c, m, info) => res.push({ g: G, ok: !!c, m: m + (info !== undefined && !c ? ' → ' + JSON.stringify(info) : '') });
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch();
  const mk = async (opts) => { const ctx = await b.newContext(Object.assign({ ...devices['iPhone 13'], locale: 'he-IL' }, opts || {})); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); return { ctx, p, errs }; };
  const go = async (p, h) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(350); };

  /* ── 1. media components with injected fixtures (service worker blocked so routes apply) ── */
  { const { ctx, p, errs } = await mk({ serviceWorkers: 'block' });
    await ctx.route('**/media/test/**', r => { const u = r.request().url(); if (/missing/.test(u)) return r.fulfill({ status: 404, body: 'nope' }); if (/\.webm$/.test(u)) return r.fulfill({ status: 200, contentType: 'video/webm', body: clip }); return r.fulfill({ status: 200, contentType: 'image/jpeg', body: photo }); });
    await p.goto(URL0); await p.waitForTimeout(700);
    G = 'fallback (missing media)';
    await go(p, '#/ex/squat');
    ok(await p.locator('.demo[data-fig]').count() === 1, 'exercise without video shows the figure animation');
    ok(/אנימציית איור/.test(await p.locator('.demo .tag').innerText()), 'animation is labelled as an illustration, not a video');
    ok(await p.locator('[data-media-status=missing]').count() === 1 && /אין סרטון/.test(await p.locator('[data-media-status=missing]').innerText()), 'missing video stated explicitly');
    ok(await p.locator('video, [data-mp]').count() === 0, 'no video player shown when there is no video');
    await go(p, '#/recipe/chicken_curry_rice');
    ok(/אין עדיין צילום/.test(await p.locator('.dish-art .tag').first().innerText()), 'recipe without photo shows labelled illustration');
    ok(await p.locator('.mimg img').count() === 0, 'no photo <img> when the photo is missing');

    G = 'video player (fixture)';
    await p.evaluate(() => { MEDIA.ex.squat.video = { webm: 'test/clip.webm', mp4: null, poster: { s: 'test/p-480.jpg', l: 'test/p-960.jpg', w: 960, h: 540 }, dur: 2 }; });
    await go(p, '#/'); await go(p, '#/ex/squat');
    ok(await p.locator('[data-mp]').count() === 1, 'player rendered when a video exists');
    ok(await p.locator('[data-mp] .mp-poster img').getAttribute('loading') === 'lazy', 'cover image is lazy');
    ok(await p.locator('[data-mp] video').count() === 0, 'no <video> element before the first tap (nothing preloaded)');
    ok(await p.locator('[data-mp]').getAttribute('data-mstate') === 'idle', 'initial state idle');
    for (const a of ['play', 'toggle', 'loop', 'mute', 'fs']) ok(await p.locator(`[data-mp] [data-mpa=${a}]`).count() === 1, 'control present: ' + a);
    ok(await p.locator('[data-mp] .mp-vol').count() === 1, 'volume control present');
    await p.locator('[data-mp] [data-mpa=play]').click(); await p.waitForTimeout(900);
    const st1 = await p.evaluate(() => ({ s: document.querySelector('[data-mp]').dataset.mstate, t: document.querySelector('[data-mp] video').currentTime, paused: document.querySelector('[data-mp] video').paused, loop: document.querySelector('[data-mp] video').loop }));
    ok(st1.s === 'playing' && !st1.paused && st1.t > 0, 'tap plays the video (state playing, time advancing)', st1);
    ok(st1.loop === true, 'auto-repeat on by default');
    await p.locator('[data-mp] [data-mpa=loop]').click(); ok(await p.evaluate(() => document.querySelector('[data-mp] video').loop) === false && await p.locator('[data-mp] [data-mpa=loop]').getAttribute('aria-pressed') === 'false', 'auto-repeat can be turned off');
    await p.locator('[data-mp] [data-mpa=mute]').click(); ok(await p.evaluate(() => document.querySelector('[data-mp] video').muted), 'mute works');
    await p.locator('[data-mp] .mp-vol').fill('0.3'); ok(Math.abs(await p.evaluate(() => document.querySelector('[data-mp] video').volume) - 0.3) < 0.01, 'volume slider sets volume');
    await p.locator('[data-mp] [data-mpa=toggle]').click(); await p.waitForTimeout(200); ok(await p.evaluate(() => document.querySelector('[data-mp] video').paused) && await p.locator('[data-mp]').getAttribute('data-mstate') === 'paused', 'pause works');
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'player fits the mobile width');
    G = 'video error → fallback';
    await p.evaluate(() => { MEDIA.ex.squat.video = { webm: 'test/missing.webm', mp4: null, poster: { s: 'test/p-480.jpg', l: 'test/p-960.jpg', w: 960, h: 540 }, dur: 2 }; });
    await go(p, '#/'); await go(p, '#/ex/squat'); await p.locator('[data-mp] [data-mpa=play]').click(); await p.waitForTimeout(900);
    ok(await p.locator('[data-mp]').getAttribute('data-mstate') === 'error', 'unplayable video → error state');
    ok(await p.locator('[data-mp] .mp-err').isVisible(), 'error message visible');
    await p.locator('[data-mp] [data-mpa=fallback]').click(); await p.waitForTimeout(400);
    ok(await p.locator('[data-mp] .mp-fb .demo svg').count() >= 1 && /אנימציית איור/.test(await p.locator('[data-mp] .mp-fb .tag').innerText()), 'fallback shows the labelled animation');
    G = 'recipe photo (fixture)';
    await p.evaluate(() => { const rec = id => (MEDIA.rc[id] = MEDIA.rc[id] || { photo: null, prep: null, steps: [] }); /* the shipped copy omits empty recipe records */ rec('chicken_curry_rice').photo = { s: 'test/rc-480.jpg', l: 'test/rc-960.jpg', w: 960, h: 720 }; rec('egg_curry_rice').photo = { s: 'test/missing-480.jpg', l: 'test/missing-960.jpg', w: 960, h: 720 }; });
    await go(p, '#/'); await go(p, '#/recipe/chicken_curry_rice'); await p.waitForTimeout(400);
    const img = p.locator('.hero-photo img');
    ok(await img.getAttribute('loading') === 'lazy' && /480w/.test(await img.getAttribute('srcset')) && /960w/.test(await img.getAttribute('srcset')), 'photo lazy with 480/960 srcset');
    ok(!!(await img.getAttribute('alt')), 'photo has alt text');
    ok(await p.locator('.hero-photo').getAttribute('data-mstate') === 'ready', 'photo loaded → ready');
    await go(p, '#/recipe/egg_curry_rice'); await p.waitForTimeout(500);
    ok(await p.locator('.hero-photo').getAttribute('data-mstate') === 'error' && await p.locator('.hero-photo .mfb .dish-art').isVisible(), 'broken photo → labelled illustration fallback');
    await go(p, '#/recipes'); ok(await p.locator('.rcard .mimg img').count() === 2, 'recipe list shows photos only where they exist');
    ok(errs.length === 0, 'no page errors', errs.slice(0, 3));
    await ctx.close(); }

  /* ── 2. lazy loading, offline, cache (real service worker, real generated covers) ── */
  { const { ctx, p, errs } = await mk(); const seen = []; ctx.on('request', r => { if (/\/media\/exercises\//.test(r.url())) seen.push(r.url()); });
    await p.goto(URL0); await p.waitForTimeout(1200); await p.reload(); await p.waitForTimeout(800);
    G = 'lazy loading';
    ok(seen.length === 0, 'home screen loads no media files', seen.length);
    await go(p, '#/media'); await p.waitForTimeout(900);
    const n = await p.locator('.mthumb img').count(); ok(n === 57, '57 cover thumbnails on the media screen', n);
    ok(await p.locator('.mthumb img[loading=lazy]').count() === n, 'all thumbnails lazy');
    const first = new Set(seen).size; ok(first > 0 && first < n * 2, `only visible covers requested before scrolling (${first} files)`);
    for (let i = 0; i < 25; i++) { await p.mouse.wheel(0, 900); await p.waitForTimeout(80); } await p.waitForTimeout(700);
    ok(new Set(seen).size > first, `scrolling loads more (${new Set(seen).size})`);
    ok(await p.locator('.mthumb[data-mstate=ready]').count() >= 50, 'covers render (ready state)', await p.locator('.mthumb[data-mstate=ready]').count());
    G = 'offline + media cache';
    const cacheInfo = await p.evaluate(async () => { const ks = await caches.keys(); const m = ks.includes('fit30-media-v1') ? (await (await caches.open('fit30-media-v1')).keys()).length : -1; return { ks, m }; });
    ok(cacheInfo.ks.includes('fit30-media-v1') && cacheInfo.m > 0 && cacheInfo.m <= 160, 'viewed images cached in the bounded media cache', cacheInfo);
    ok(cacheInfo.ks.filter(k => /^fit30-[0-9a-f]{10}$/.test(k)).length === 1, 'exactly one app-shell cache', cacheInfo.ks);
    await ctx.setOffline(true); await p.reload(); await p.waitForTimeout(1000);
    ok((await p.locator('main').innerText()).length > 50, 'app loads offline');
    await go(p, '#/media'); await p.waitForTimeout(800);
    ok(await p.locator('.mthumb[data-mstate=ready]').count() >= 5, 'previously viewed covers shown offline from cache');
    await go(p, '#/ex/squat'); ok(await p.locator('.demo svg').count() >= 1, 'exercise animation works offline (no media needed)');
    await go(p, '#/program/annual'); ok(await p.locator('.ptl-s').count() === 6, 'program preview works offline');
    await ctx.setOffline(false);
    ok(errs.length === 0, 'no page errors', errs.slice(0, 3)); await ctx.close(); }

  /* ── 3. programs: preview never changes saved data ── */
  { const { ctx, p, errs } = await mk({ serviceWorkers: 'block' }); await p.goto(URL0); await p.waitForTimeout(600);
    G = 'programs';
    const before = await p.evaluate(() => JSON.stringify(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])));
    await go(p, '#/programs'); { const nT = await p.evaluate(() => PROGRAMS.TEMPLATES.length); ok(await p.locator('.pcard').count() === nT && nT >= 12, nT + ' program templates listed'); }
    ok(/תצוגה מקדימה בלבד/.test(await p.locator('main').innerText()), 'catalog says preview only');
    for (const id of ['start_7', 'habits_30', 'fatloss_30', 'strength_90', 'general_90', 'progress_6m', 'annual', 'home_noequip', 'basic_equipment', 'gym', 'custom']) { await go(p, '#/program/' + id); ok(await p.locator('.ptl-s').count() >= 1 && await p.locator('.pday').count() >= 7, 'preview renders: ' + id); }
    await go(p, '#/program/annual'); ok(await p.locator('.ptl-s').count() === 6, 'annual shows 6 phases');
    const s4 = await p.locator('.pstats .stat .v').first().innerText(); await p.locator('[data-act=pd][data-v="2"]').click(); await p.waitForTimeout(300); const s2 = await p.locator('.pstats .stat .v').first().innerText();
    ok(+s2 < +s4, `fewer days per week → fewer sessions (${s4} → ${s2})`);
    await p.locator('[data-act=pm][data-v="15"]').click(); await p.waitForTimeout(300);
    const rowsT = await p.$$eval('.pday', xs => xs.map(x => { const t = x.querySelector('.pd-h .tiny'); return { m: t ? parseFloat(t.textContent.replace(/[^\d.]/g, '')) : 0, exempt: x.classList.contains('t-assess') || x.classList.contains('t-active'), noted: !!x.querySelector('.warn') }; }));
    ok(rowsT.every(r => r.m <= 15.05 || (r.exempt && r.noted)), '15-minute limit respected in preview; longer days are tests/recovery and say so', rowsT.filter(r => r.m > 15));
    await go(p, '#/program/gym'); ok(/אין עדיין בספרייה/.test(await p.locator('main').innerText()), 'gym template shows the library gap');
    await go(p, '#/program/fit30_classic'); ok(await p.locator('a[href="#/workouts"]').count() >= 1, 'classic template links to the active program');
    const after = await p.evaluate(() => JSON.stringify(Object.keys(localStorage).sort().filter(k => k !== 'fit30.mediaPrefs').map(k => [k, localStorage.getItem(k)])));
    ok(before === after, 'previewing programs did not change saved data');
    await go(p, '#/workouts'); ok(await p.locator('a.seg-link[href="#/programs"]').count() === 1, 'workouts screen links to programs');
    await go(p, '#/settings'); ok(await p.locator('a[href="#/media"]').count() === 1 && await p.locator('a[href="#/programs"]').count() === 1, 'settings links to programs and media status');
    ok(errs.length === 0, 'no page errors', errs.slice(0, 3)); await ctx.close(); }

  /* ── 4. widths 320 / 375 / 390 / 430 + RTL ── */
  G = 'widths + RTL';
  for (const w of [320, 375, 390, 430]) { const ctx = await b.newContext({ viewport: { width: w, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'he-IL', serviceWorkers: 'block' }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(URL0); await p.waitForTimeout(500); const bad = [];
    for (const h of ['#/', '#/workouts', '#/ex/squat', '#/recipe/chicken_curry_rice', '#/recipes', '#/programs', '#/program/annual', '#/program/custom', '#/media', '#/settings', '#/nutrition', '#/progress']) { await go(p, h); if (!(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth))) bad.push(h); }
    ok(!bad.length, `no horizontal scroll at ${w}px`, bad); ok(await p.evaluate(() => document.dir === 'rtl' || getComputedStyle(document.body).direction === 'rtl'), `RTL at ${w}px`); ok(!errs.length, `no errors at ${w}px`, errs); await ctx.close(); }

  /* ── 5. version upgrade: old data kept, one shell cache, new code served ── */
  G = 'version upgrade';
  { const SRC = path.resolve(__dirname, '../dist/pwa'), TMP = fs.mkdtempSync(path.join(require('os').tmpdir(), 'fit30-up-'));
    fs.cpSync(SRC, TMP, { recursive: true }); const srv = spawn('python3', ['-m', 'http.server', '8097'], { cwd: TMP, stdio: 'ignore' }); await sleep(800);
    const { ctx, p, errs } = await mk(); await p.goto('http://localhost:8097/'); await p.waitForTimeout(1200);
    await p.evaluate(() => { const t = Store.load('tracking'); t.measures.push({ date: '2026-10-01', weight: 85 }); Store.save('tracking'); const w = Store.load('workouts'); w.days[1] = { status: 'done', version: 'std', date: '2026-10-01' }; Store.save('workouts'); });
    const oldBuild = await p.evaluate(() => window.FIT30_BUILD);
    for (const f of ['index.html', 'sw.js']) { const fp = path.join(TMP, f); fs.writeFileSync(fp, fs.readFileSync(fp, 'utf8').split(oldBuild).join('upgradetst')); }
    await p.evaluate(() => navigator.serviceWorker.getRegistration().then(r => r.update())); await p.waitForTimeout(1500); await p.reload(); await p.waitForTimeout(1200);
    ok(await p.evaluate(() => window.FIT30_BUILD) === 'upgradetst', 'new version served after update + reload');
    const ks = await p.evaluate(() => caches.keys()); ok(ks.filter(k => /^fit30-(?!media|fonts)/.test(k)).length === 1 && ks.includes('fit30-upgradetst'), 'old app-shell cache removed, one shell cache left', ks);
    ok(await p.evaluate(() => Store.load('tracking').measures.some(m => m.date === '2026-10-01') && Store.load('workouts').days[1].status === 'done'), 'measurements and completed workouts kept across the upgrade');
    ok(errs.length === 0, 'no page errors', errs.slice(0, 3)); await ctx.close(); srv.kill(); fs.rmSync(TMP, { recursive: true, force: true }); }

  /* ── 6. load performance (local server, Chromium) ── */
  G = 'performance (local)';
  const perf = {};
  { const { ctx, p } = await mk({ serviceWorkers: 'block' }); let bytes = 0, reqs = 0; const bodies = []; /* M10.2: the body sizes are read asynchronously — they are now awaited before the total is checked
       (before, the check could run before index.html's body was counted: it reported 4,469 B while the real first load was 713,404 B) */
    p.on('response', r => { if (/fonts\./.test(r.url())) return; reqs++; bodies.push(r.body().then(x => { bytes += x.length; }, () => { })); });
    await p.goto(URL0, { waitUntil: 'load' }); await p.waitForTimeout(500); await Promise.all(bodies);
    ok(bytes > 500000, 'first-load measurement includes the app shell (sanity: > 500 KB measured)', bytes);
    Object.assign(perf, await p.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; return { domContentLoadedMs: Math.round(n.domContentLoadedEventEnd), loadMs: Math.round(n.loadEventEnd) }; }), { firstLoadRequests: reqs, firstLoadBytes: bytes });
    ok(perf.loadMs < 3000, 'first load < 3 s on local server (' + perf.loadMs + ' ms)'); /* RC5: budget raised 700,000 → 712,000 B (uncompressed). Why the old limit no longer applies: the user approved on 2026-10-19 a
       10–20 KB *compressed* allowance for SoFitGo branding; RC5 adds +8.1 KB raw / +2.6 KB gzip to index.html (brand mark, P0 fixes,
       NOW card). The new limit keeps ~8.5 KB raw headroom; anything beyond it must be justified again. */
    ok(bytes < 712000, 'first load < 712 KB excluding fonts (' + bytes + ' B)');
    const t0 = Date.now(); await go(p, '#/program/annual'); perf.annualPreviewMs = Date.now() - t0; ok(perf.annualPreviewMs < 1500, 'annual plan preview renders < 1.5 s (' + perf.annualPreviewMs + ' ms incl. 350 ms wait)');
    await ctx.close(); }

  await b.close();
  const pass = res.filter(r => r.ok).length, fail = res.length - pass; const groups = {}; res.forEach(r => { groups[r.g] = groups[r.g] || { pass: 0, fail: 0 }; groups[r.g][r.ok ? 'pass' : 'fail']++; });
  fs.mkdirSync(path.join(__dirname, '../dist/reports'), { recursive: true }); fs.writeFileSync(path.join(__dirname, '../dist/reports/e2e-stageA.json'), JSON.stringify({ url: URL0, pass, fail, groups, perf, results: res }, null, 1));
  res.filter(r => !r.ok).forEach(r => console.log('FAIL [' + r.g + '] ' + r.m)); console.log(JSON.stringify(groups)); console.log('perf', JSON.stringify(perf)); console.log(`stage A e2e: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('crashed', e.stack); process.exit(2); });
