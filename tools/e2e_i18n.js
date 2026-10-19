/* RC5 · i18n layer (first slice) — Playwright Chromium (NOT Safari). Hebrew default unchanged; ?lang=en dev preview switches
   dir/lang and the translated keys; both tables have the same keys; no sideways scroll in LTR. Usage: node tools/e2e_i18n.js [URL] */
const { chromium, devices } = require('playwright'); const fs = require('fs');
const URL0 = process.argv[2] || 'http://localhost:8096/';
const res = []; let G = ''; const ok = (c, m, i) => res.push({ g: G, ok: !!c, m: m + (i !== undefined && !c ? ' → ' + JSON.stringify(i).slice(0, 240) : '') });
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'he-IL', serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  G = 'Hebrew default'; await p.goto(URL0); await p.waitForTimeout(800);
  ok(await p.evaluate(() => document.documentElement.dir === 'rtl' && document.documentElement.lang === 'he' && getComputedStyle(document.body).direction === 'rtl'), 'default: Hebrew, RTL');
  ok(JSON.stringify(await p.locator('#nav a span').allInnerTexts()) === JSON.stringify(['בית', 'לוח', 'אימונים', 'תזונה', 'מעקב']), 'nav labels unchanged in Hebrew');
  const keys = await p.evaluate(() => { const T = I18N.TABLES; return { he: Object.keys(T.he).sort(), en: Object.keys(T.en).sort() }; });
  ok(JSON.stringify(keys.he) === JSON.stringify(keys.en), 'Hebrew and English tables have the same keys', keys);
  G = 'English dev preview'; await p.goto(URL0 + '?lang=en'); await p.waitForTimeout(800);
  ok(await p.evaluate(() => document.documentElement.dir === 'ltr' && document.documentElement.lang === 'en' && getComputedStyle(document.body).direction === 'ltr'), '?lang=en: LTR, lang=en');
  ok(JSON.stringify(await p.locator('#nav a span').allInnerTexts()) === JSON.stringify(['Home', 'Calendar', 'Workouts', 'Nutrition', 'Tracking']), 'nav labels translated');
  for (const w of [320, 390]) { await p.setViewportSize({ width: w, height: 800 }); await p.waitForTimeout(200); ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `no sideways scroll in LTR at ${w}px`); }
  ok(errs.length === 0, 'no page errors', errs.slice(0, 3));
  await b.close(); const pass = res.filter(r => r.ok).length, fail = res.length - pass;
  fs.mkdirSync('dist/reports', { recursive: true }); fs.writeFileSync('dist/reports/e2e-i18n.json', JSON.stringify({ url: URL0, at: new Date().toISOString(), pass, fail, results: res }, null, 1));
  res.forEach(r => console.log((r.ok ? 'PASS ' : 'FAIL ') + '[' + r.g + '] ' + r.m)); console.log(`i18n e2e: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('i18n e2e crashed: ' + e.message.split('\n')[0]); process.exit(2); });
