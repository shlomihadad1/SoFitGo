/* RC5 app-shell checks (P0-E). Playwright Chromium, iPhone 13 emulation — NOT Safari, NOT a real device.
   Chromium cannot reproduce WebKit-specific behaviour, so a pass here does NOT prove the iPhone report is fixed.
   What it does check, on every main tab + shopping list, at rest and after scrolling, with the top safe-area inset
   simulated as 0 / 47 / 59 px (env() replaced in the live stylesheet):
   - the header is inside the viewport, below the status-bar strip, and ≥ 50 px of it is visible
   - the element on top at the header centre and at the settings button belongs to the header (nothing covers it)
   - every bottom-nav tab is the topmost element at its own centre (nothing — e.g. a host badge — covers it)
   - ?debug=layout loads the diagnostics panel; a normal URL never requests debug-layout.js
   Usage: node tools/e2e_shell.js [URL] [--proxy] */
const { chromium, devices } = require('playwright'); const fs = require('fs');
const URL0 = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'http://localhost:8096/';
const PROXY = process.argv.includes('--proxy') && process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY } } : {};
const res = []; let G = ''; const ok = (c, m, i) => res.push({ g: G, ok: !!c, m: m + (i !== undefined && !c ? ' → ' + JSON.stringify(i).slice(0, 300) : '') });
const ROUTES = ['#/', '#/calendar', '#/workouts', '#/nutrition', '#/progress', '#/shopping'];
(async () => {
  const b = await chromium.launch(PROXY); const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'he-IL', serviceWorkers: 'block' }); const p = await ctx.newPage();
  const reqs = []; p.on('request', r => reqs.push(r.url())); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const go = async h => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(400); };
  await p.goto(URL0); await p.waitForTimeout(1500);
  /* RC5 P0-E: measured on the header TITLE (h1), not the header box. Why the RC4 assertion ("header.top ≥ inset") was wrong for
     RC5: it encoded RC4's structure (header pushed down by the inset under a separate strip). The requirement is that the header
     content sits below the status-bar area, fully visible and not covered — RC5's header starts at 0 and pads itself. */
  const probe = () => p.evaluate(() => { const top = document.getElementById('top'), r0 = top.getBoundingClientRect(), r = (location.hash === '#/' || location.hash === '' ? top.querySelector('.brand') || top.querySelector('h1') : top.querySelector('h1')).getBoundingClientRect(), /* M10: on Home the visible header content is the logo — the redundant "בית" title was removed at the owner's request (it stays for screen readers); same rules applied to the logo */ strip = parseFloat(getComputedStyle(document.body, '::before').height) || 0;
    const hitIn = (x, y, root) => { const el = document.elementFromPoint(Math.round(x), Math.round(y)); return { inside: !!el && root.contains(el), el: el ? el.tagName + (el.id ? '#' + el.id : '') : null }; };
    const gear = top.querySelector('a[href="#/settings"]'), g = gear && gear.getBoundingClientRect();
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), boxTop: Math.round(r0.top), strip: Math.round(strip), visible: Math.round(r.bottom - Math.max(r.top, strip)), centre: hitIn(r.left + r.width / 2, r.top + r.height / 2, top), gear: g ? hitIn(g.left + g.width / 2, g.top + g.height / 2, gear) : null,
      nav: [...document.querySelectorAll('#nav a')].map(a => { const q = a.getBoundingClientRect(); return { t: a.textContent.trim(), ...hitIn(q.left + q.width / 2, q.top + q.height / 2, a) }; }), scrollY: Math.round(scrollY) }; });
  for (const inset of [0, 47, 59]) {
    G = `inset ${inset}px (simulated)`;
    await p.evaluate(v => { document.querySelectorAll('style').forEach(s => { s.dataset.orig = s.dataset.orig || s.textContent; s.textContent = s.dataset.orig.replace(/env\(safe-area-inset-top,\s*0px\)/g, v + 'px'); }); }, inset);
    for (const r of ROUTES) { await go(r);
      for (const y of [0, 400]) { await p.evaluate(v => scrollTo(0, v), y); await p.waitForTimeout(150); const q = await probe(); const at = `${r} y=${q.scrollY}`;
        ok(q.top >= inset - 1 && q.visible >= q.bottom - q.top - 1 && q.bottom - q.top >= 16, `${at}: header title below the ${inset}px status-bar area and fully visible`, q);
        ok(q.centre.inside && (!q.gear || q.gear.inside), `${at}: nothing covers the header or the settings button`, { c: q.centre, g: q.gear });
        if (inset === 0 && y === 0) { const bad = q.nav.filter(n => !n.inside); ok(!bad.length, `${r}: every bottom-nav tab is on top at its centre`, bad); } } }
  }
  G = 'env() mismatch (simulated WebKit failure mode)';
  /* fixed elements see inset 59 px, sticky `top` sees 0 — if a fixed layer above the header depends on the inset, it covers the
     header at rest (RC4's strip). RC5 has no such layer, so the title must stay visible and uncovered. */
  for (const r of ['#/', '#/progress', '#/shopping']) { await go(r);
    await p.evaluate(() => { document.querySelectorAll('style').forEach(s => { s.dataset.orig = s.dataset.orig || s.textContent; s.textContent = s.dataset.orig.replace(/(position:\s*fixed;[^}]*?height:\s*)env\(safe-area-inset-top,\s*0px\)/g, '$159px').replace(/env\(safe-area-inset-top,\s*0px\)/g, '0px'); }); });
    await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(150); const q = await probe();
    ok(q.centre.inside && q.visible >= 16 && q.top >= q.strip - 1, `${r}: title visible and on top even when a fixed layer and the sticky header disagree on the inset`, q); }
  G = 'diagnostics';
  ok(!reqs.some(u => /debug-layout\.js/.test(u)), 'normal URL never requests debug-layout.js');
  const sep = URL0.includes('?') ? '&' : '?'; await p.goto(URL0 + sep + 'debug=layout#/progress'); await p.waitForTimeout(1500);
  const d = await p.evaluate(() => { const o = document.getElementById('dbg-out'); return o ? o.textContent : null; });
  ok(d && /safe-area top\/right\/bottom\/left/.test(d) && /on top at header centre: /.test(d), '?debug=layout shows the diagnostics panel', d && d.slice(0, 200));
  if (d) { await p.locator('#dbg-lay button[data-c=dbg-no-blur]').click(); ok(await p.evaluate(() => document.documentElement.classList.contains('dbg-no-blur') && getComputedStyle(document.getElementById('top')).backdropFilter === 'none'), 'toggle A removes the header backdrop-filter'); }
  ok(errs.length === 0, 'no page errors', errs.slice(0, 3));
  await b.close(); const pass = res.filter(r => r.ok).length, fail = res.length - pass;
  fs.mkdirSync('dist/reports', { recursive: true }); fs.writeFileSync(`dist/reports/e2e-shell${/localhost/.test(URL0) ? '' : '-remote'}.json`, JSON.stringify({ url: URL0, at: new Date().toISOString(), pass, fail, results: res }, null, 1));
  res.filter(r => !r.ok).forEach(r => console.log('FAIL [' + r.g + '] ' + r.m)); console.log(`shell e2e: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { res.filter(r => !r.ok).forEach(r => console.log('FAIL [' + r.g + '] ' + r.m)); console.error('shell e2e crashed in [' + G + ']: ' + e.message.split('\n')[0]); process.exit(2); });
