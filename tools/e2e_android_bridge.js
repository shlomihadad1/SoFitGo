/* Android test app ↔ web build contract (native/android-webview). The Java side cannot run here (no device / emulator); this
   suite checks the WEB side against a stand-in window.SoFitGoAndroid with the same two functions:
     - no service worker inside the app (files are bundled);
     - CSV export and JSON backup are saved through saveFile (a WebView cannot save blob downloads), with the right content;
     - a failed native save is reported as a failure, never as "exported";
     - the workout asks to keep the screen on while it is open and releases it on close.
   Without the bridge (a normal browser) nothing changes — the rest of the regression covers that.
   Usage: node tools/e2e_android_bridge.js [URL]  (default http://localhost:8096/) */
const pw = require('playwright'); const { devices } = pw;
const URL0 = process.argv[2] || 'http://localhost:8096/', ENGINE = process.env.BROWSER === 'webkit' ? pw.webkit : pw.chromium;
const res = []; let G = ''; const ok = (c, m, i) => res.push({ g: G, ok: !!c, m: m + (i !== undefined && !c ? ' → ' + JSON.stringify(i).slice(0, 300) : '') });
(async () => {
  const b = await ENGINE.launch();
  const ctx = await b.newContext({ ...devices['Pixel 7'], locale: 'he-IL' });
  await ctx.addInitScript(() => { window.__nat = { files: [], screen: [], fail: false };
    window.SoFitGoAndroid = { saveFile: (name, mime, text) => { if (window.__nat.fail) return 'error:אין מקום'; window.__nat.files.push({ name, mime, text }); return 'ok:הורדות/' + name; }, keepScreenOn: on => { window.__nat.screen.push(!!on); } }; });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const W = ms => p.waitForTimeout(ms), nat = () => p.evaluate(() => window.__nat);
  await p.goto(URL0); await W(900);
  await p.evaluate(() => { localStorage.clear(); Store.resetAll(); const pr = Store.load('profile'); Object.assign(pr, { age: 34, height: 172, weight: 78, startWeight: 78, sex: 'f', experience: 'beginner', onboarded: true, startDate: Store.today() }); pr.display = Object.assign({}, pr.display, { wake: true }); Store.save('profile');
    Core.addEntry(Store.today(), { slot: 'm1', name: 'שקשוקה, "ביתית"', k: 420, p: 20, c: 30, f: 22, fb: 5 }); });
  await p.reload(); await W(900);

  G = 'inside the app';
  ok(await p.evaluate(() => App.swState) === 'native' && await p.evaluate(() => navigator.serviceWorker ? navigator.serviceWorker.getRegistrations().then(r => r.length) : 0) === 0, 'no service worker (files are bundled in the app)');

  G = 'CSV export through the bridge';
  await p.evaluate(() => { location.hash = '#/privacy'; }); await W(900);
  await p.locator('[data-export-list] .li', { hasText: 'יומן אכילה' }).locator('[data-act=csv1]').click(); await W(400);
  let n = await nat(); const f = n.files.find(x => x.name === 'sofitgo-nutrition_journal.csv');
  ok(f && f.mime === 'text/csv' && f.text.charCodeAt(0) === 0xFEFF && /"שקשוקה, ""ביתית"""/.test(f.text), 'the journal CSV is saved via saveFile with BOM and RFC 4180 quoting', f && f.text.slice(0, 120));
  ok(await p.locator('[data-export-ok]').count() === 1, 'success shown after the save');
  await p.locator('[data-act=csvAll]').click(); await W(800); n = await nat();
  ok(n.files.length >= 1 + 7 && n.files.every(x => /^sofitgo-[a-z0-9_]+\.csv$/.test(x.name)), 'export all → every category saved via the bridge', n.files.map(x => x.name));
  await p.evaluate(() => { window.__nat.fail = true; }); await p.locator('[data-export-list] .li', { hasText: 'יומן אכילה' }).locator('[data-act=csv1]').click(); await W(400);
  ok(await p.locator('[data-export-err]').count() === 1 && await p.locator('[data-export-ok]').count() === 0, 'a failed native save is shown as a failure, not as exported');
  await p.evaluate(() => { window.__nat.fail = false; });

  G = 'JSON backup through the bridge';
  await p.evaluate(() => App.exportBackup()); await W(500); await p.locator('.sheet [data-act=dl]').click(); await W(400); n = await nat();
  const bk = n.files.find(x => /^fit30-backup-\d{4}-\d{2}-\d{2}\.json$/.test(x.name));
  ok(bk && bk.mime === 'application/json' && JSON.parse(bk.text).profile && /נשמר ב/.test(await p.evaluate(() => (document.querySelector('.toast') || {}).textContent || '')), 'backup saved via saveFile and the toast says where', bk && bk.name);
  ok(await p.evaluate(() => !!Store.load('meta').lastBackup), 'last-backup date recorded only after a successful save');

  G = 'screen kept on during a workout';
  await p.evaluate(() => { location.hash = '#/day/1'; }); await W(400);
  await p.evaluate(() => Run.start(1, 'std')); await W(900); await p.locator('.sheet [data-act=go]').click(); await W(400);
  n = await nat(); ok(n.screen.includes(true), 'workout open → keepScreenOn(true)', n.screen);
  await p.evaluate(() => Run.close()); await W(200); n = await nat(); ok(n.screen[n.screen.length - 1] === false, 'workout closed → keepScreenOn(false)', n.screen);

  ok(errs.length === 0, 'no page errors', errs.slice(0, 3));
  await b.close();
  let pass = 0, fail = 0; for (const r of res) { console.log(`${r.ok ? 'PASS' : 'FAIL'} [${r.g}] ${r.m}`); r.ok ? pass++ : fail++; }
  console.log(`android bridge e2e${process.env.BROWSER === 'webkit' ? ' (webkit)' : ''}: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { res.forEach(r => console.log((r.ok ? 'PASS ' : 'FAIL ') + '[' + r.g + '] ' + r.m)); console.error('android bridge e2e crashed in [' + G + ']: ' + e.message.split('\n')[0]); process.exit(2); });
