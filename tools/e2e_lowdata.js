/* SLL-35 · Data-saving mode — Playwright Chromium, iPhone 13 emulation (NOT Safari).
   Checked on the NETWORK, not only in markup: with the mode on, opening a recipe downloads no photo and an exercise shows no
   poster; a photo downloads only after "טעינת תמונה", and only its small size. The mode follows the browser's Save-Data request
   unless the user chose otherwise; the choice is recorded in the change log. Usage: node tools/e2e_lowdata.js [URL] */
const { chromium, devices } = require('playwright'); const fs = require('fs');
const URL0 = process.argv[2] || 'http://localhost:8096/';
const res = []; let G = ''; const ok = (c, m, i) => res.push({ g: G, ok: !!c, m: m + (i !== undefined && !c ? ' → ' + JSON.stringify(i).slice(0, 240) : '') });
(async () => {
  const b = await chromium.launch(); const errs = [];
  const mk = async saveData => { const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'he-IL', serviceWorkers: 'block' });
    if (saveData) await ctx.addInitScript(() => { try { Object.defineProperty(navigator, 'connection', { configurable: true, get: () => ({ saveData: true, effectiveType: '3g' }) }); } catch (e) { } });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); const reqs = []; p.on('request', r => { if (/\/media\//.test(r.url())) reqs.push(r.url()); });
    await p.goto(URL0); await p.waitForTimeout(700); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(700);
    await p.evaluate(() => { const pr = Store.load('profile'); Object.assign(pr, { age: 34, height: 172, weight: 78, startWeight: 78, sex: 'f', experience: 'beginner', onboarded: true }); Store.save('profile'); });
    return { ctx, p, reqs }; };
  const go = async (p, h) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(900); };

  let { ctx, p, reqs } = await mk(false);
  /* real media today: generated exercise covers (shown as thumbnails in the media library, inside links); no recipe photos or
     videos yet. The tap-to-load button is checked with a real cover rendered by Media.image outside a link. */
  const exid = await p.evaluate(() => Object.keys(MEDIA.ex || {}).find(k => MEDIA.ex[k].poster));
  ok(!!exid, 'test setup: exercise covers exist', exid);
  const probe = id => p.evaluate(x => { const c = document.createElement('div'); c.id = 'lowprobe'; c.innerHTML = Media.image(MEDIA.ex[x].poster, 'בדיקה', { aspect: '16/9' }); document.querySelector('main, #app, body').prepend(c); }, id);

  G = 'off (default)';
  ok(await p.evaluate(() => Media.lowData()) === null, 'off by default when the browser does not ask to save data');
  reqs.length = 0; await go(p, '#/media'); await p.waitForTimeout(1000);
  ok(reqs.length >= 1 && await p.locator('.mimg[data-mstate=lowdata]').count() === 0, 'thumbnails load normally', reqs.length);

  G = 'turned on in Settings';
  await go(p, '#/settings'); await p.locator('#d-low').check(); await p.waitForTimeout(500);
  ok(await p.evaluate(() => Store.load('profile').display.lowData) === true, 'the switch stores the choice');
  ok(await p.evaluate(() => (Store.load('changelog').items || []).some(x => x.path === 'display.lowData' && x.to === true)), 'and it appears in the settings change log');
  await p.reload(); await p.waitForTimeout(800); reqs.length = 0; await go(p, '#/media'); await p.waitForTimeout(1000);
  const th = await p.locator('a .mimg[data-mstate=lowdata]').count(), btnInLink = await p.locator('a [data-lowimg-load]').count();
  ok(th >= 1 && reqs.length === 0, 'the media library downloads NO thumbnail (network checked); the illustration is shown instead', { th, reqs: reqs.slice(0, 3) });
  ok(btnInLink === 0, 'no button is placed inside a link');
  ok(await p.locator('a.li[href^="#/ex/"]').count() >= 1, 'the list itself still works (links to every exercise)');
  await probe(exid); await p.waitForTimeout(300);
  ok(reqs.length === 0 && await p.locator('#lowprobe [data-lowimg-load]').count() === 1, 'a photo outside a link shows "טעינת תמונה" and downloads nothing', reqs);
  await p.locator('#lowprobe [data-lowimg-load]').click(); await p.waitForTimeout(1200);
  ok(reqs.length === 1 && /-480\./.test(reqs[0]) && await p.locator('#lowprobe .mimg[data-mstate=ready] img').count() === 1, 'tap → exactly one image, its small (480) size, is downloaded and shown', reqs);
  await ctx.close();

  G = 'follows the browser (Save-Data)';
  ({ ctx, p, reqs } = await mk(true));
  ok(await p.evaluate(() => Media.lowData()) === 'auto', 'browser asks to save data → on automatically');
  await go(p, '#/settings'); ok(await p.locator('#d-low').isChecked() && await p.locator('[data-lowdata-auto]').count() === 1, 'Settings shows it as on, and says why');
  await p.locator('#d-mo').check(); await p.waitForTimeout(400);
  ok(await p.evaluate(() => Store.load('profile').display.lowData) == null, 'changing another display setting keeps "follow the browser" (not turned into a fixed choice)');
  await p.reload(); await p.waitForTimeout(800); reqs.length = 0; await go(p, '#/media'); await p.waitForTimeout(800); ok(reqs.length === 0, 'no thumbnail downloaded', reqs);
  await go(p, '#/settings'); await p.locator('#d-low').uncheck(); await p.waitForTimeout(400);
  ok(await p.evaluate(() => Store.load('profile').display.lowData) === false && await p.evaluate(() => Media.lowData()) === null, 'the user can turn it off even though the browser asks to save data');
  await p.reload(); await p.waitForTimeout(800); reqs.length = 0; await go(p, '#/media'); await p.waitForTimeout(1000); ok(reqs.length >= 1, 'thumbnails load again', reqs.length);
  await ctx.close();

  ok(errs.length === 0, 'no page errors', errs.slice(0, 3));
  await b.close();
  const pass = res.filter(r => r.ok).length, fail = res.length - pass;
  res.forEach(r => console.log((r.ok ? 'PASS' : 'FAIL') + ' [' + r.g + '] ' + r.m));
  fs.mkdirSync('dist', { recursive: true }); fs.writeFileSync('dist/e2e_lowdata.json', JSON.stringify(res, null, 1));
  console.log(`lowdata e2e: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('lowdata e2e crashed in [' + G + ']: ' + e.message); process.exit(1); });
