/* QA · Performance & Compatibility agent — WebKit smoke test.
   Playwright's WebKit is the engine Safari is built on, NOT Safari itself and NOT an iPhone: results are reported as "WebKit (Playwright)".
   Exit codes: 0 = pass, 1 = failures, 3 = BLOCKED (WebKit not installed here; CI installs it with `npx playwright install --with-deps webkit`).
   Usage: node tools/qa/webkit_smoke.js [URL] */
const URL0 = process.argv[2] || 'http://localhost:8096/';
let webkit, devices; try { ({ webkit, devices } = require('playwright')); } catch (e) { console.log('BLOCKED: playwright not installed'); process.exit(3); }
const res = []; const ok = (c, m, i) => { res.push(!!c); console.log((c ? 'PASS ' : 'FAIL ') + m + (!c && i !== undefined ? ' → ' + JSON.stringify(i).slice(0, 300) : '')); };
(async () => {
  let b; try { b = await webkit.launch(); } catch (e) { console.log('BLOCKED: WebKit browser not installed in this environment (' + e.message.split('\n')[0].slice(0, 120) + ')'); process.exit(3); }
  console.log('engine: WebKit ' + b.version() + ' (Playwright) — not Safari, not a real device');
  for (const dev of ['iPhone SE', 'iPhone 13', 'iPad Mini']) {
    const ctx = await b.newContext({ ...devices[dev], locale: 'he-IL', serviceWorkers: 'block' }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(URL0); await p.waitForTimeout(1200); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(1000);
    for (const h of ['#/', '#/nutrition', '#/workouts', '#/progress', '#/settings', '#/setup/1']) {
      await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(900);
      const v = await p.evaluate(() => { const els = [...document.querySelectorAll('#view h1, #view h2, #view h3, #view .btn, #top .brand, #nav a')].filter(e => e.offsetParent !== null || e.closest('#nav'));
        const hidden = els.filter(e => { let o = 1; for (let n = e; n && n !== document.documentElement; n = n.parentElement) o *= +getComputedStyle(n).opacity; return o < 0.95 || getComputedStyle(e).visibility === 'hidden'; }).map(e => e.tagName + ':' + (e.textContent || '').trim().slice(0, 20));
        return { n: els.length, hidden, overflow: document.documentElement.scrollWidth > innerWidth + 1 }; });
      ok(v.n > 3 && !v.hidden.length && !v.overflow, `${dev} ${h}: headings/buttons/tabs visible, no sideways scroll`, v);
    }
    await p.evaluate(() => { location.hash = '#/setup/1'; }); await p.waitForTimeout(900);
    const al = await p.evaluate(() => { const r = id => document.getElementById(id).getBoundingClientRect(); const a = r('pf-age'), h = r('pf-h'), w = r('pf-w'), t = r('pf-tw'); return { row1: Math.abs(a.top - h.top), row2: Math.abs(w.top - t.top), sameW: new Set([a.width, h.width, w.width, t.width].map(Math.round)).size === 1 }; });
    ok(al.row1 < 1 && al.row2 < 1 && al.sameW, `${dev}: profile fields aligned (age/height, current/target weight)`, al);
    ok(!errs.length, `${dev}: no JavaScript errors`, errs);
    await ctx.close();
  }
  await b.close();
  const f = res.filter(x => !x).length; console.log(`webkit smoke: pass ${res.length - f} fail ${f}`); process.exit(f ? 1 : 0);
})().catch(e => { console.log('webkit smoke crashed: ' + e.message.split('\n')[0]); process.exit(1); });
