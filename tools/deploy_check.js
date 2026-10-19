/* Post-deployment check for a hosted copy of the PWA. Usage: node tools/deploy_check.js <URL> [label]
   Checks: HTTPS (reported, required for real hosting), main page, manifest + icons, service worker registration
   and control, reload, offline reload, console errors / failed requests, Hebrew RTL, main screens, no sample data on a
   fresh profile, backup screen warns that photos are not included. Writes dist/reports/deploy-check-<label>.json */
const { chromium, devices } = require('playwright'); const fs = require('fs');
const URL0 = process.argv[2]; const label = process.argv[3] || 'run';
if (!URL0) { console.error('usage: node tools/deploy_check.js <URL> [label]'); process.exit(2); }
const res = []; const ok = (c, m, info) => res.push({ ok: !!c, m, info: info === undefined ? null : info });
(async () => {
  const PX = process.env.HTTPS_PROXY && !/localhost|127\.0\.0\.1/.test(process.argv[2] || '') ? { server: process.env.HTTPS_PROXY } : undefined; /* RC5: honour the environment's outbound proxy for remote URLs */ const b = await chromium.launch(PX ? { proxy: PX } : {}); const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'he-IL' }); const p = await ctx.newPage();
  const errs = [], failed = [], fontFails = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('requestfailed', r => { if (/fonts\.(googleapis|gstatic)/.test(r.url())) fontFails.push(r.url()); else failed.push(r.url() + ' ' + (r.failure() || {}).errorText); });
  p.on('response', r => { if (r.status() >= 400) failed.push(r.url() + ' HTTP ' + r.status()); });
  const u = new URL(URL0);
  ok(u.protocol === 'https:', 'URL uses HTTPS', u.protocol);
  const resp = await p.goto(URL0, { waitUntil: 'load' }); await p.waitForTimeout(1200);
  ok(resp && resp.status() === 200, 'main page loads (HTTP 200)', resp && resp.status());
  ok(await p.evaluate(() => isSecureContext), 'page is a secure context (required for service worker)');
  /* RC5: a host login/redirect page (e.g. Netlify visitor access, HTTP 401) used to crash here (null link) — report it as a failure instead. */
  const landed = await p.evaluate(() => ({ url: location.href, app: !!document.querySelector('link[rel=manifest]') }));
  ok(landed.app && new URL(landed.url).host === new URL(URL0).host, 'page is the Fit30 app (not a host login/redirect)', landed.url);
  if (!landed.app) { res.push({ ok: false, m: 'remaining checks skipped — the URL does not serve the app', info: (await p.evaluate(() => document.title)) }); await b.close(); return report(); }
  const manHref = await p.evaluate(() => { const l = document.querySelector('link[rel=manifest]'); return l ? l.href : null; }) || new URL('manifest.webmanifest', URL0).href;
  const manR = await p.request.get(manHref); let man = null; try { man = await manR.json(); } catch (e) { }
  ok(manR.status() === 200 && !!man, 'manifest reachable and valid JSON', manR.status() + ' ' + (manR.headers()['content-type'] || ''));
  ok(man && man.display === 'standalone' && man.dir === 'rtl' && man.lang === 'he' && man.start_url === './' && man.scope === './', 'manifest: standalone, Hebrew RTL, relative start_url/scope');
  for (const ic of [...((man && man.icons) || []).map(i => new URL(i.src, manHref).href), new URL('apple-touch-icon.png', URL0).href]) {
    const r = await p.request.get(ic); ok(r.status() === 200 && /image\/png/.test(r.headers()['content-type'] || ''), 'icon loads ' + ic.split('/').pop(), r.status() + ' ' + r.headers()['content-type']);
  }
  const swr = await p.request.get(new URL('sw.js', URL0).href); ok(swr.status() === 200 && /javascript/.test(swr.headers()['content-type'] || ''), 'sw.js served as JavaScript', swr.status() + ' ' + swr.headers()['content-type']);
  ok(await p.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return !!r; }), 'service worker registered');
  await p.reload(); await p.waitForTimeout(1000);
  ok(await p.evaluate(() => !!navigator.serviceWorker.controller), 'service worker controls page after reload');
  ok((await p.locator('main').innerText()).length > 50, 'app renders after reload');
  ok(await p.evaluate(() => document.documentElement.lang === 'he' && getComputedStyle(document.body).direction === 'rtl'), 'Hebrew + RTL');
  // fresh profile: no sample data presented as personal
  ok(await p.evaluate(() => { const t = JSON.parse(localStorage.getItem('fit30.tracking') || 'null'); const n = JSON.parse(localStorage.getItem('fit30.nutrition') || 'null'); return (!t || (!t.measures.length && !Object.keys(t.daily).length)) && (!n || !Object.keys(n.log || {}).length); }), 'fresh install has no logged measurements, meals or daily data');
  for (const h of ['#/', '#/calendar', '#/workouts', '#/day/1', '#/nutrition', '#/recipes', '#/targets', '#/progress', '#/settings', '#/install']) {
    await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(300);
    ok((await p.locator('main').innerText()).length > 30 && await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'screen loads ' + h);
  }
  await p.evaluate(() => { location.hash = '#/progress'; }); await p.waitForTimeout(300);
  ok(!/\d{2}\.\d ק״ג/.test(await p.locator('main').innerText()) || await p.evaluate(() => JSON.parse(localStorage.getItem('fit30.tracking') || '{"measures":[]}').measures.length > 0), 'progress screen shows no invented weight entries');
  await p.evaluate(() => { location.hash = '#/settings'; }); await p.waitForTimeout(300); await p.locator('[data-act=export]').click(); await p.waitForTimeout(400);
  ok((await p.locator('.sheet').innerText()).includes('לא נכללות בגיבוי'), 'backup screen warns photos are not included');
  await ctx.setOffline(true); await p.reload(); await p.waitForTimeout(1000); ok((await p.locator('main').innerText()).length > 50, 'reloads offline from service worker cache'); await ctx.setOffline(false);
  // Chromium logs one 'Failed to load resource' console error per failed request without the URL; those matching
  // font requests that failed are attributed to the (optional) Google Fonts, everything else counts.
  let fontBudget = fontFails.length; const realErrs = errs.filter(e => { if (/^Failed to load resource/.test(e) && fontBudget > 0) { fontBudget--; return false; } return true; });
  ok(realErrs.length === 0, 'no console / page errors (excluding failed optional font requests: ' + fontFails.length + ')', realErrs.slice(0, 5));
  ok(failed.length === 0, 'no failed requests (Google Fonts excluded — optional)', failed.slice(0, 5));
  await b.close(); return report();
  function report() {
  const pass = res.filter(r => r.ok).length, fail = res.length - pass;
  fs.mkdirSync('dist/reports', { recursive: true }); fs.writeFileSync('dist/reports/deploy-check-' + label + '.json', JSON.stringify({ url: URL0, at: new Date().toISOString(), pass, fail, results: res }, null, 1));
  res.forEach(r => console.log((r.ok ? 'PASS ' : 'FAIL ') + r.m + (r.info != null && !r.ok ? '  → ' + JSON.stringify(r.info) : '')));
  console.log(`deploy check: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
  }
})().catch(e => { console.error('deploy check crashed', e.message); process.exit(2); });
