/* RC1 — records the 12 app-usage tutorials from THIS build (served at URL, default http://localhost:8096/) with Playwright,
   converts them to MP4 (H.264, no audio, faststart) with ffmpeg, makes a WebP poster, and writes
   src/media/tutorials/<id>-<hash>.mp4|webp + src/data/tutorials_media.js. Each flow performs the real actions in the app
   (no mock-ups); a small ring marks every tap. If a flow fails, that tutorial gets NO video (the help screen then shows
   text only) — nothing is faked. Re-run after UI changes so the recordings match the build.
   Usage: node tools/tutorials_build.js [URL]   (needs ffmpeg) */
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path'), crypto = require('crypto'), cp = require('child_process');
const ROOT = path.join(__dirname, '..'), URL0 = process.argv[2] || 'http://localhost:8096/';
const OUT = path.join(ROOT, 'src/media/tutorials'), TMP = path.join(ROOT, 'dist/tut-tmp');
const W = 390, H = 844;
const SEED = { age: 34, height: 172, weight: 78, startWeight: 78, sex: 'f', experience: 'beginner', onboarded: true };
const seedJs = (o) => `(() => { localStorage.clear(); Store.resetAll(); const pr = Store.load('profile'); Object.assign(pr, ${JSON.stringify(SEED)}, { startDate: Store.today() });
  pr.aims = { primary: 'general', secondary: [] }; pr.availability = { days: [1, 3, 5], sessions: 3, maxMin: 30, prefMin: null }; pr.environment = { place: 'home', equipment: ['chair', 'table'], custom: [] };
  pr.prefs = Core.normPrefs({}); Store.save('profile'); ${o && o.plan === false ? '' : "Plans.activate(Plans.create('general_90', Plans.paramsFromProfile(pr), Store.today()), { confirmReplace: true });"} ${(o && o.extra) || ''} })()`;
const RING = `(() => { const st = document.createElement('style'); st.textContent = '.tut-ring{position:fixed;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:3px solid #f0a33a;background:rgba(240,163,58,.25);pointer-events:none;z-index:99999;animation:tr .6s ease-out forwards}@keyframes tr{from{transform:scale(.4);opacity:1}to{transform:scale(1.4);opacity:0}}'; document.head.appendChild(st);
  window.__ring = (x, y) => { const d = document.createElement('div'); d.className = 'tut-ring'; d.style.left = x + 'px'; d.style.top = y + 'px'; document.body.appendChild(d); setTimeout(() => d.remove(), 700); }; })()`;

const FLOWS = {
  async onboarding(t) { await t.seed({ plan: false, extra: "const p = Store.load('profile'); Object.assign(p, { age: null, height: null, weight: null, startWeight: null, sex: null, experience: null }); p.aims.primary = null; Store.save('profile');" }); await t.go('#/');
    await t.tap('.setup-cta a[href="#/setup/1"]'); await t.type('#pf-age', '34'); await t.type('#pf-h', '172'); await t.type('#pf-w', '78'); await t.tap('[data-act=xp][data-v=beginner]'); await t.tap('[data-act=next]');
    await t.tap('[data-act=gp][data-v=general]'); await t.tap('[data-act=next]'); await t.pause(700); await t.scroll(500);
    await t.pause(900); },
  async programs(t) { await t.seed({ plan: false }); await t.go('#/settings'); await t.tap('a[href="#/programs"]'); await t.pause(800); await t.tap('a[href^="#/program/"]'); await t.scroll(500); await t.pause(800); await t.scroll(500); await t.pause(900); },
  async runner(t) { await t.seed(); await t.clockTo(2); /* day 1 is the fitness test (different runner); day 3 is a regular workout */ await t.go('#/plan'); await t.tap('[data-act=start]');
    for (let i = 0; i < 3; i++) { if (await t.has('.run [data-a=skipRest]')) await t.tap('.run [data-a=skipRest]'); await t.tap('.run [data-a=done]'); }
    await t.tap('.run [data-a=exit]'); await t.tap('.sheet [data-act=finish]'); await t.pause(700);
    if (await t.has('.run [data-fb][data-v=ok]')) await t.tap('.run [data-fb][data-v=ok]'); if (await t.has('.run [data-r="6"]')) await t.tap('.run [data-r="6"]'); await t.tap('.run [data-a=save]'); await t.pause(900); },
  async 'log-meal'(t) { await t.seed(); await t.go('#/nutrition'); await t.scroll(420); await t.tap('[data-act=eat][data-slot=m1]'); await t.pause(800); await t.tap('.sheet [data-act=ok]'); await t.pause(600); await t.scrollTop(); await t.pause(1200); },
  async 'swap-meal'(t) { await t.seed(); await t.go('#/nutrition'); await t.scroll(420); await t.tap('[data-act=swapMeal][data-slot=m2]'); await t.pause(700);
    await t.tap('.sheet [data-act=pick], .sheet [data-pick], .sheet .li-btn'); await t.pause(800); if (await t.has('.sheet [data-act=ok]')) await t.tap('.sheet [data-act=ok]'); await t.pause(1000); },
  async adapt(t) { await t.seed({ extra: `const pl = Plans.active(); const tr = Plans.days(pl).filter(d => Plans.isTraining(d) && d.type !== 'assess' && d.type !== 'active');
      const ex = tr.flatMap(d => d.main.map(x => x.ex)).find((e, i, a) => a.filter(z => z === e).length >= 4); let NOW0 = Store.today();
      tr.filter(d => d.main.some(x => x.ex === ex)).slice(0, 2).forEach(d => { const sets = d.main.flatMap(it => Array.from({ length: it.sets }, (_, k) => Object.assign({ done: true, ex: it.ex, sec: 'main', set: k + 1 }, typeof it.reps === 'number' ? { reps: it.reps } : { secs: typeof it.sec === 'number' ? it.sec : 30 })));
        Plans.logDay(pl.id, d.n, { status: 'done', rpe: 6, sets, feedback: { [ex]: 'easy' }, source: 'run', date: d.date }); });` });
    await t.clockTo(14); await t.go('#/plan'); await t.scrollTo('[data-adapt-card]'); await t.pause(700); await t.tap('[data-adapt] [data-act=adaptView]'); await t.pause(1200); await t.tap('.sheet [data-act=ok]'); await t.pause(700); await t.scrollTo('[data-adapt-hist]'); await t.pause(1200); },
  async travel(t) { await t.seed({ extra: "const p = Store.load('profile'); p.environment.equipment = ['chair', 'table', 'step', 'wall']; Store.save('profile'); Plans.activate(Plans.create('general_90', Plans.paramsFromProfile(p), Store.today()), { confirmReplace: true });" });
    await t.go('#/plan'); await t.scrollTo('[data-act=travel]'); await t.tap('[data-act=travel]'); await t.pause(1500); await t.tap('.sheet [data-act=ok]'); await t.pause(800); await t.scrollTop(); await t.pause(1200); },
  async shopping(t) { await t.seed(); await t.go('#/nutrition'); await t.scrollTo('[data-shop-link]'); await t.tap('[data-shop-link]'); await t.pause(700); await t.tap('[data-act=days][data-d="3"]'); await t.pause(600);
    await t.tap('[data-shop]'); await t.pause(500); await t.scroll(400); await t.pause(900); },
  async progress(t) { await t.seed(); await t.go('#/progress'); await t.scrollTo('#m-w'); await t.type('#m-w', '77.4'); await t.tap('[data-act=saveM]'); await t.pause(900); await t.scrollTop(); await t.tap('a[href="#/review"]'); await t.pause(1500); },
  async backup(t) { await t.seed(); await t.go('#/settings'); await t.scrollTo('[data-act=export]'); await t.pause(800); await t.tap('[data-act=export]'); await t.pause(1500); await t.escape(); await t.pause(500); },
  async install(t) { await t.seed(); await t.go('#/install'); await t.pause(1200); await t.scroll(450); await t.pause(1200); await t.scroll(450); await t.pause(1000); },
  async explain(t) { await t.seed(); await t.go('#/'); await t.scrollTo('a[href="#/explain"]'); await t.tap('a[href="#/explain"]'); await t.pause(900); await t.scroll(500); await t.pause(800); await t.scroll(600); await t.pause(1000); }
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true }); fs.rmSync(TMP, { recursive: true, force: true }); fs.mkdirSync(TMP, { recursive: true });
  const prev = fs.readdirSync(OUT); const b = await chromium.launch(); const media = {}, log = [];
  const build = (fs.readFileSync(path.join(ROOT, 'dist/pwa/index.html'), 'utf8').match(/FIT30_BUILD='([0-9a-f]+)'/) || [])[1];
  for (const [id, flow] of Object.entries(FLOWS)) {
    const dir = path.join(TMP, id); fs.mkdirSync(dir);
    const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'he-IL', serviceWorkers: 'block', recordVideo: { dir, size: { width: W, height: H } } }); /* Playwright records at CSS-pixel size */ const t0 = Date.now(); let startAt = 0;
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.dismiss());
    await p.clock.install({ time: new Date('2026-10-19T08:30:00').getTime() });
    const t = {
      seed: async o => { await p.goto(URL0); await p.waitForTimeout(400); await p.evaluate(seedJs(o)); await p.reload(); await p.waitForTimeout(600); await p.evaluate(RING); startAt = (Date.now() - t0) / 1000; /* trim the data-seeding part */ },
      go: async h => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(900); },
      tap: async sel => { const l = p.locator(sel).first(); await l.waitFor({ state: 'visible', timeout: 5000 }); await l.scrollIntoViewIfNeeded(); await p.waitForTimeout(250); const bx = await l.boundingBox(); if (bx) await p.evaluate(([x, y]) => window.__ring && window.__ring(x, y), [bx.x + bx.width / 2, bx.y + bx.height / 2]); await p.waitForTimeout(350); await l.click(); await p.waitForTimeout(650); await p.evaluate(RING).catch(() => {}); },
      type: async (sel, v) => { const l = p.locator(sel).first(); await l.scrollIntoViewIfNeeded(); await l.click(); await l.fill(''); await l.type(v, { delay: 90 }); await p.waitForTimeout(250); },
      has: async sel => (await p.locator(sel).count()) > 0,
      pause: ms => p.waitForTimeout(ms), scroll: async y => { await p.mouse.wheel(0, y); await p.waitForTimeout(500); }, scrollTop: async () => { await p.evaluate(() => scrollTo({ top: 0, behavior: 'smooth' })); await p.waitForTimeout(600); },
      scrollTo: async sel => { await p.locator(sel).first().scrollIntoViewIfNeeded(); await p.waitForTimeout(500); }, escape: async () => { await p.keyboard.press('Escape'); if (await p.locator('.sheet [data-x]').count()) await p.locator('.sheet [data-x]').first().click(); },
      clockTo: async days => { await p.clock.setFixedTime(new Date(Date.parse('2026-10-19T08:30:00') + days * 864e5)); await p.reload(); await p.waitForTimeout(600); await p.evaluate(RING); startAt = (Date.now() - t0) / 1000; }
    };
    let ok = true, err = null; try { await flow(t); } catch (e) { ok = false; err = e.message.split('\n')[0]; }
    if (errs.length) { ok = false; err = (err ? err + '; ' : '') + 'page errors: ' + errs.slice(0, 2).join(' | '); }
    await ctx.close(); const raw = fs.readdirSync(dir).find(f => f.endsWith('.webm'));
    if (!ok || !raw) { log.push({ id, ok: false, err: err || 'no recording' }); continue; }
    const mp4 = path.join(dir, 'out.mp4'), poster = path.join(dir, 'poster.webp');
    cp.execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-ss', String(Math.max(0, startAt - 0.3)), '-i', path.join(dir, raw), '-vf', 'fps=24', '-c:v', 'libx264', '-profile:v', 'main', '-pix_fmt', 'yuv420p', '-crf', '30', '-preset', 'slow', '-movflags', '+faststart', '-an', mp4]);
    const dur = +cp.execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4]).toString().trim();
    cp.execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-ss', String(Math.min(2.5, dur / 2)), '-i', mp4, '-frames:v', '1', '-c:v', 'libwebp', '-quality', '75', poster]);
    const h = crypto.createHash('sha1').update(fs.readFileSync(mp4)).digest('hex').slice(0, 10), mName = `${id}-${h}.mp4`, pName = `${id}-${h}.webp`;
    fs.copyFileSync(mp4, path.join(OUT, mName)); fs.copyFileSync(poster, path.join(OUT, pName));
    const ph = +cp.execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=height', '-of', 'csv=p=0', poster]).toString().trim();
    media[id] = { mp4: 'tutorials/' + mName, poster: { s: 'tutorials/' + pName, l: 'tutorials/' + pName, w: W, h: ph }, dur: Math.round(dur * 10) / 10, bytes: fs.statSync(path.join(OUT, mName)).size, build, license: 'original', author: 'Fit30 (הקלטת מסך של האפליקציה)' };
    log.push({ id, ok: true, dur: media[id].dur, bytes: media[id].bytes });
  }
  await b.close();
  const keep = new Set(Object.values(media).flatMap(m => [path.basename(m.mp4), path.basename(m.poster.s)])); prev.forEach(f => { if (!keep.has(f)) fs.rmSync(path.join(OUT, f)); });
  fs.writeFileSync(path.join(ROOT, 'src/data/tutorials_media.js'), `/* generated by tools/tutorials_build.js from build ${build} — original screen recordings of this app (no third-party content, no audio) */\n(function (root) { root.TUTORIAL_MEDIA = ${JSON.stringify(media)}; })(typeof window !== 'undefined' ? window : globalThis);\n`);
  fs.mkdirSync(path.join(ROOT, 'dist/reports'), { recursive: true }); fs.writeFileSync(path.join(ROOT, 'dist/reports/tutorials-build.json'), JSON.stringify({ build, log }, null, 1));
  log.forEach(l => console.log(l.ok ? `OK   ${l.id} ${l.dur}s ${Math.round(l.bytes / 1024)}KB` : `FAIL ${l.id}: ${l.err}`)); console.log(`tutorials: ${log.filter(l => l.ok).length}/${log.length} recorded`);
})().catch(e => { console.error(e); process.exit(2); });
