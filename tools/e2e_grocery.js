/* RC5 · Smart Grocery v2 (first slice) — Playwright Chromium, iPhone 13 emulation (NOT Safari).
   States (to buy / bought / at home / not found), user items with duplicate prevention, clear keeps user items, persistence.
   Usage: node tools/e2e_grocery.js [URL] */
const { chromium, devices } = require('playwright'); const fs = require('fs');
const URL0 = process.argv[2] || 'http://localhost:8096/';
const res = []; let G = ''; const ok = (c, m, i) => res.push({ g: G, ok: !!c, m: m + (i !== undefined && !c ? ' → ' + JSON.stringify(i).slice(0, 240) : '') });
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'he-IL', serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const go = async h => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(600); };
  const next = async () => { await p.locator('[data-act=next]').click(); await p.waitForTimeout(350); };
  await p.goto(URL0); await p.waitForTimeout(700); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(700);
  await go('#/setup/1'); await p.fill('#pf-age', '34'); await p.fill('#pf-h', '172'); await p.fill('#pf-w', '78'); await p.locator('[data-act=xp][data-v=beginner]').click(); await p.waitForTimeout(250); await next();
  await p.locator('[data-act=gp][data-v=general]').click(); await p.waitForTimeout(200); await next();
  for (const d of [1, 3, 5]) { await p.locator(`[data-act=dw][data-v="${d}"]`).click(); await p.waitForTimeout(120); }
  await p.locator('[data-act=ses][data-v="3"]').click(); await p.waitForTimeout(150); await p.selectOption('#pf-pref', '30'); await p.selectOption('#pf-max', '45'); await next();
  await p.locator('[data-act=tpl][data-v=general_90]').click(); await p.waitForTimeout(200); await next(); await next(); await next(); await p.waitForTimeout(400);
  const stored = () => p.evaluate(() => JSON.parse(localStorage.getItem('fit30.nutrition')).shopping || {});
  const prog = async () => (await p.locator('[data-shop-progress]').innerText()).split('/').map(Number);
  G = 'states';
  await go('#/shopping/7'); ok(await p.locator('[data-shop-row]').count() > 3, 'shopping list loads (on-demand chunk) with planned items');
  const [d0, t0] = await prog(); const f1 = await p.locator('[data-shop-row]').nth(0).getAttribute('data-shop-row'), f2 = await p.locator('[data-shop-row]').nth(1).getAttribute('data-shop-row');
  await p.locator(`[data-act=st][data-f="${f1}"][data-s=home]`).click(); await p.waitForTimeout(350);
  ok((await prog())[1] === t0 - 1 && await p.locator(`[data-at-home] [data-shop-row="${f1}"]`).count() === 1, '"יש בבית" moves the item out of the to-buy count into "יש בבית"');
  await p.locator(`[data-act=st][data-f="${f2}"][data-s=notfound]`).click(); await p.waitForTimeout(350);
  ok(await p.locator(`[data-shop-row="${f2}"] [data-notfound]`).count() === 1 && (await stored()).state[f2] === 'notfound', '"לא נמצא" shown and stored');
  await p.locator(`[data-shop="${f2}"]`).check(); await p.waitForTimeout(300);
  const s1 = await stored(); ok(s1.checked[f2] && !s1.state[f2], 'buying an item clears its "not found" state');
  await p.locator(`[data-act=st][data-f="${f1}"][data-s=home]`).click(); await p.waitForTimeout(350);
  ok(!(await stored()).state[f1] && (await prog())[1] === t0, 'tapping "יש בבית" again returns it to the list');
  G = 'user items';
  await p.fill('#c-add', 'נייר אפייה'); await p.locator('[data-act=cadd]').click(); await p.waitForTimeout(350);
  ok((await stored()).custom.length === 1 && await p.locator('[data-custom-row]').count() === 1, 'user item added');
  await p.fill('#c-add', '  נייר   אפייה '); await p.locator('[data-act=cadd]').click(); await p.waitForTimeout(350);
  ok((await stored()).custom.length === 1 && /כבר ברשימה/.test(await p.evaluate(() => (document.querySelector('.toast') || {}).textContent || '')), 'same item again (spacing differs) → not added, user told');
  const plannedName = await p.locator('[data-shop-row] .t').nth(2).evaluate(e => e.childNodes[0].textContent.trim());
  await p.fill('#c-add', plannedName); await p.locator('[data-act=cadd]').click(); await p.waitForTimeout(350);
  ok((await stored()).custom.length === 1, 'a planned item\'s name is not added twice', plannedName);
  await p.locator('[data-cdone]').first().check(); await p.waitForTimeout(250);
  G = 'clear and persistence';
  await p.locator('[data-act=clear]').click(); await p.waitForTimeout(350);
  const s2 = await stored(); ok(!Object.keys(s2.checked).length && !Object.keys(s2.state).length && s2.custom.length === 1 && !s2.custom[0].done, 'clear resets checks and states, keeps the user item (unchecked)');
  await p.reload(); await p.waitForTimeout(900); ok(await p.locator('[data-custom-row]').count() === 1, 'user item persists after reload');
  await p.locator('[data-act=cdel]').click(); await p.waitForTimeout(300); ok((await stored()).custom.length === 0, 'delete removes it'); await p.locator('.toast [data-toast-act]').click(); await p.waitForTimeout(400);
  ok((await stored()).custom.length === 1, 'undo restores the deleted item');
  ok(errs.length === 0, 'no page errors', errs.slice(0, 3));
  await b.close(); const pass = res.filter(r => r.ok).length, fail = res.length - pass;
  fs.mkdirSync('dist/reports', { recursive: true }); fs.writeFileSync('dist/reports/e2e-grocery.json', JSON.stringify({ url: URL0, at: new Date().toISOString(), pass, fail, results: res }, null, 1));
  res.forEach(r => console.log((r.ok ? 'PASS ' : 'FAIL ') + '[' + r.g + '] ' + r.m)); console.log(`grocery e2e: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { res.forEach(r => console.log((r.ok ? 'PASS ' : 'FAIL ') + '[' + r.g + '] ' + r.m)); console.error('grocery e2e crashed in [' + G + ']: ' + e.message.split('\n')[0]); process.exit(2); });
