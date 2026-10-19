/* RC5 P0-F — the service worker must never replace the cached app shell with a login page or an error page.
   Own Node server over dist/pwa (or DIR=… for another build) with a switch: normal / 401 login page / 500 / 302 to a login host.
   Flow per bad mode: install app (SW controls page) → host starts answering navigations with the bad response → reload online
   (the live bad page may be shown — that is correct) → go offline → reload → the APP must come back from cache, not the bad page.
   Playwright Chromium (NOT Safari). Usage: node tools/e2e_sw_shell.js   (DIR=../fit30-rc4-dev/dist/pwa to test an older build) */
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const DIR = path.resolve(process.env.DIR || path.join(__dirname, '../dist/pwa')); const PORT = 8193;
let mode = 'ok';
const types = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json', '.mp4': 'video/mp4' };
const srv = http.createServer((q, r) => {
  const u = new URL(q.url, 'http://x'); let p = decodeURIComponent(u.pathname); if (p === '/') p = '/index.html';
  if (mode === 'down') return q.socket.destroy(); /* network failure as the service worker sees it (Playwright's setOffline does not reach SW fetches) */
  if (p === '/login.html') { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return r.end('<!doctype html><p>LOGIN-WALL</p>'); } /* the login page itself is never redirected (else a loop) */
  const nav = (q.headers['sec-fetch-mode'] === 'navigate') || p === '/index.html';
  if (nav && mode === '401') { r.writeHead(401, { 'content-type': 'text/html; charset=utf-8' }); return r.end('<!doctype html><title>Login Redirect</title><p>LOGIN-WALL</p>'); }
  if (nav && mode === '500') { r.writeHead(500, { 'content-type': 'text/html; charset=utf-8' }); return r.end('<!doctype html><p>SERVER-ERROR-PAGE</p>'); }
  if (nav && mode === '302') { r.writeHead(302, { location: '/login.html' }); return r.end(); }
  const f = path.join(DIR, p); if (!f.startsWith(DIR) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end('nf'); }
  r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
}).listen(PORT);
const res = []; let G = ''; const ok = (c, m, i) => res.push({ g: G, ok: !!c, m: m + (i !== undefined && !c ? ' → ' + JSON.stringify(i).slice(0, 200) : '') });
(async () => {
  const b = await chromium.launch();
  for (const bad of ['401', '500', '302']) {
    G = 'host answers ' + bad; mode = 'ok';
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const p = await ctx.newPage(); const URL0 = `http://localhost:${PORT}/`;
    await p.goto(URL0); await p.evaluate(async () => { await navigator.serviceWorker.ready; }); await p.reload(); await p.waitForTimeout(800);
    ok(await p.evaluate(() => !!navigator.serviceWorker.controller && !!window.FIT30_BUILD), 'app installed, service worker controls the page');
    mode = bad; await p.reload().catch(() => {}); await p.waitForTimeout(700);
    const live = await p.content().catch(e => 'ERR ' + e.message); if (process.env.DEBUG) console.log('LIVE', bad, p.url(), live.slice(0, 300)); ok(/LOGIN-WALL|SERVER-ERROR-PAGE/.test(live) || !!(await p.evaluate(() => window.FIT30_BUILD).catch(() => null)) || (bad === '302' && /login\.html/.test(p.url())), 'online: the host response (or the app) is shown — nothing hidden');
    mode = 'down'; await p.goto(URL0).catch(() => {}); await p.waitForTimeout(900);
    const off = await p.evaluate(() => ({ build: window.FIT30_BUILD || null, text: document.body ? document.body.innerText.slice(0, 80) : '' })).catch(e => ({ build: null, text: 'ERR ' + e.message }));
    ok(off.build && !/LOGIN-WALL|SERVER-ERROR-PAGE/.test(off.text), `offline after a ${bad}: the cached APP loads, not the ${bad} page`, off);
    await ctx.close();
  }
  await b.close(); srv.close();
  const pass = res.filter(r => r.ok).length, fail = res.length - pass;
  fs.mkdirSync(path.join(__dirname, '../dist/reports'), { recursive: true }); fs.writeFileSync(path.join(__dirname, '../dist/reports/e2e-sw-shell.json'), JSON.stringify({ dir: DIR, at: new Date().toISOString(), pass, fail, results: res }, null, 1));
  res.forEach(r => console.log((r.ok ? 'PASS ' : 'FAIL ') + '[' + r.g + '] ' + r.m)); console.log(`sw shell e2e: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { srv.close(); res.forEach(r => console.log((r.ok ? 'PASS ' : 'FAIL ') + '[' + r.g + '] ' + r.m)); console.error('sw shell e2e crashed in [' + G + ']: ' + e.message.split('\n')[0]); process.exit(2); });
