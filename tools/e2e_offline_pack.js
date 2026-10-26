/* SLL-24 · Offline travel pack — Playwright Chromium (NOT Safari) with the service worker ON and a real network outage.
   Own Node server over dist/pwa with a switch (ok / down: sockets destroyed, as the service worker sees a failed network).
   Flow: install (SW controls the page) → travel screen lists exactly the photos of the next 14 days' workouts, with size →
   nothing is downloaded before the tap → tap "שמירת החבילה" → every listed photo is fetched once → network DOWN → the photos
   still load from the device. Usage: node tools/e2e_offline_pack.js */
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const DIR = path.resolve(path.join(__dirname, '../dist/pwa')); const PORT = 8194; let mode = 'ok'; const media = [];
const types = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json' };
const srv = http.createServer((q, r) => {
  const u = new URL(q.url, 'http://x'); let p = decodeURIComponent(u.pathname); if (p === '/') p = '/index.html';
  if (mode === 'down') return q.socket.destroy();
  if (p.startsWith('/media/')) media.push(p);
  const f = path.join(DIR, p); if (!f.startsWith(DIR) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end('nf'); }
  r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
}).listen(PORT);
const res = []; let G = ''; const ok = (c, m, i) => res.push({ g: G, ok: !!c, m: m + (i !== undefined && !c ? ' → ' + JSON.stringify(i).slice(0, 240) : '') });
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'he-IL' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); const URL0 = `http://localhost:${PORT}/`;
  const go = async h => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(900); };
  G = 'install';
  await p.goto(URL0); await p.evaluate(async () => { await navigator.serviceWorker.ready; }); await p.reload(); await p.waitForTimeout(900);
  await p.evaluate(() => { const pr = Store.load('profile'); Object.assign(pr, { age: 34, height: 172, weight: 78, startWeight: 78, sex: 'f', experience: 'beginner', onboarded: true, startDate: Store.today() }); Store.save('profile'); });
  ok(await p.evaluate(() => !!navigator.serviceWorker.controller), 'service worker controls the page');
  G = 'the pack';
  media.length = 0; await go('#/travel');
  const pk = await p.evaluate(() => Screens.travel.packList());
  ok(pk.exercises >= 1 && pk.files.length >= 1 && pk.bytes > 0 && !pk.trip, 'no trip set → the next 14 days: exercises found, photos listed with their size', { ex: pk.exercises, files: pk.files.length, bytes: pk.bytes });
  ok(await p.locator('[data-pack-size]').count() === 1 && new RegExp(String(pk.files.length)).test(await p.locator('[data-pack-size]').textContent()), 'the screen shows how many photos and how much data');
  ok(media.length === 0, 'opening the travel screen downloads nothing', media.slice(0, 3));
  await p.locator('[data-act=packGo]').click(); await p.waitForTimeout(400);
  for (let i = 0; i < 40 && !(await p.locator('[data-pack-result]').count()); i++) await p.waitForTimeout(250);
  const txt = await p.locator('[data-pack-result]').textContent();
  ok(new RegExp(`נשמרו ${pk.files.length} מתוך ${pk.files.length}`).test(txt), 'tap → every listed photo saved, reported', txt);
  const uniq = [...new Set(media)];
  ok(uniq.length === pk.files.length && pk.files.every(f => uniq.includes('/' + f.url)), 'exactly the listed photos were downloaded (each once)', { got: uniq.length, want: pk.files.length });
  G = 'offline';
  mode = 'down';
  const off = await p.evaluate(async urls => { let ok = 0; for (const u of urls) { try { const r = await fetch(u); if (r.ok && (await r.blob()).size > 0) ok++; } catch (e) { } } return ok; }, pk.files.map(f => f.url));
  ok(off === pk.files.length, 'network down → all packed photos still load from the device', { off, want: pk.files.length });
  const notPacked = await p.evaluate(async () => { const all = Object.values(MEDIA.ex).map(x => x.poster && 'media/' + x.poster.l).filter(Boolean); try { const r = await fetch(all[0]); return r.ok; } catch (e) { return false; } });
  ok(notPacked === false, 'a photo that was not in the pack is NOT available offline (the test really is offline)');
  mode = 'ok';
  ok(errs.length === 0, 'no page errors', errs.slice(0, 3));
  await b.close(); srv.close();
  const pass = res.filter(r => r.ok).length, fail = res.length - pass;
  res.forEach(r => console.log((r.ok ? 'PASS' : 'FAIL') + ' [' + r.g + '] ' + r.m)); console.log(`offline pack e2e: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { srv.close(); res.forEach(r => console.log((r.ok ? 'PASS' : 'FAIL') + ' [' + r.g + '] ' + r.m)); console.log('offline pack e2e crashed in [' + G + ']: ' + (e.stack || e.message).slice(0, 500)); process.exit(2); });
