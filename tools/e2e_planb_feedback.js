/* RC5 · Plan B hub, NOW shortcuts and Beta Feedback — Playwright Chromium, iPhone 13 emulation (NOT Safari).
   Usage: node tools/e2e_planb_feedback.js [URL] */
const { chromium, devices } = require('playwright'); const fs = require('fs');
const URL0 = process.argv[2] || 'http://localhost:8096/';
const res = []; let G = ''; const ok = (c, m, i) => res.push({ g: G, ok: !!c, m: m + (i !== undefined && !c ? ' → ' + JSON.stringify(i).slice(0, 240) : '') });
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'he-IL', serviceWorkers: 'block', permissions: ['clipboard-read', 'clipboard-write'] }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const go = async h => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(600); };
  await p.goto(URL0); await p.waitForTimeout(700); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(700);
  await p.evaluate(() => { const pr = Store.load('profile'); Object.assign(pr, { age: 34, height: 172, weight: 78.4, startWeight: 78.4, sex: 'f', experience: 'beginner', onboarded: true }); Store.save('profile'); Core.eatSlot(Store.today(), 'm1', 1); });
  G = 'NOW shortcuts'; await go('#/'); const sc = await p.locator('[data-now-shortcuts] a').evaluateAll(a => a.map(x => x.getAttribute('href')));
  ok(['#/planb', '#/fridge', '#/activity'].every(h => sc.includes(h)), 'NOW card offers Plan B, fridge and steps shortcuts', sc);
  G = 'Plan B'; await go('#/planb');
  ok(await p.locator('[data-planb-stop]').count() === 1 && /עוצרים את האימון/.test(await p.locator('[data-planb-stop]').innerText()), 'safe-stop guidance shown first');
  const links = await p.locator('[data-planb]').evaluateAll(a => a.map(x => ({ k: x.dataset.planb, h: x.getAttribute('href') })));
  ok(links.length === 6, 'six situations offered', links);
  const before = await p.evaluate(() => localStorage.getItem('fit30.workouts') + localStorage.getItem('fit30.nutrition'));
  for (const l of links) { await go(l.h); const t = await p.locator('main').innerText(); ok(t.length > 40 && !/אירעה שגיאה/.test(t), `"${l.k}" opens a working screen (${l.h})`); }
  ok(await p.evaluate(() => localStorage.getItem('fit30.workouts') + localStorage.getItem('fit30.nutrition')) === before, 'visiting Plan B options changes no data');
  G = 'feedback'; await go('#/settings'); ok(await p.locator('[data-feedback-link]').count() === 1, 'feedback entry in settings');
  await go('#/feedback'); await p.fill('#fb-t', 'הכפתור לא מגיב'); await p.selectOption('#fb-s', 'תזונה'); await p.waitForTimeout(200);
  const pv = await p.locator('[data-fb-preview]').innerText();
  ok(/הכפתור לא מגיב/.test(pv) && /מסך: תזונה/.test(pv) && /גרסה: /.test(pv), 'preview shows the text, screen and build');
  const name = await p.evaluate(() => { const r = Core.entries(Store.today())[0]; return r ? r.name : ''; });
  ok(!/78[.,]4|78\.4/.test(pv) && !(name && pv.includes(name)) && !/גיל|משקל: \d/.test(pv), 'no personal data by default (no weight, no journal entries)', pv.slice(0, 200));
  await p.locator('#fb-tech').uncheck(); await p.waitForTimeout(150); ok(!/פרטים טכניים/.test(await p.locator('[data-fb-preview]').innerText()), 'technical details can be left out');
  await p.locator('[data-act=fcopy]').click(); await p.waitForTimeout(300);
  const clip = await p.evaluate(() => navigator.clipboard.readText()).catch(() => null);
  ok(clip === await p.locator('[data-fb-preview]').innerText(), 'copied text = exactly the preview');
  ok(errs.length === 0, 'no page errors', errs.slice(0, 3));
  await b.close(); const pass = res.filter(r => r.ok).length, fail = res.length - pass;
  fs.mkdirSync('dist/reports', { recursive: true }); fs.writeFileSync('dist/reports/e2e-planb-feedback.json', JSON.stringify({ url: URL0, at: new Date().toISOString(), pass, fail, results: res }, null, 1));
  res.forEach(r => console.log((r.ok ? 'PASS ' : 'FAIL ') + '[' + r.g + '] ' + r.m)); console.log(`planb/feedback e2e: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { res.forEach(r => console.log((r.ok ? 'PASS ' : 'FAIL ') + '[' + r.g + '] ' + r.m)); console.error('planb/feedback e2e crashed in [' + G + ']: ' + e.message.split('\n')[0]); process.exit(2); });
