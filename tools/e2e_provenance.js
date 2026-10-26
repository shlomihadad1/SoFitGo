/* SLL-28 · Data provenance labels — Playwright Chromium, iPhone 13 emulation (NOT Safari).
   One vocabulary (UI.SRC: user / measured / calc / est / rec / none) used for the labels on the main screens; each label explains
   itself on tap or Enter, never triggers a surrounding link; labels follow the real source (manual vs automatic targets, manual
   steps). Usage: node tools/e2e_provenance.js [URL] */
const { chromium, devices } = require('playwright'); const fs = require('fs');
const URL0 = process.argv[2] || 'http://localhost:8096/';
const res = []; let G = ''; const ok = (c, m, i) => res.push({ g: G, ok: !!c, m: m + (i !== undefined && !c ? ' → ' + JSON.stringify(i).slice(0, 240) : '') });
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'he-IL', serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const go = async h => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(700); };
  await p.goto(URL0); await p.waitForTimeout(700); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(700);
  await p.evaluate(() => { const pr = Store.load('profile'); Object.assign(pr, { age: 34, height: 172, weight: 78, startWeight: 78, sex: 'f', experience: 'beginner', onboarded: true, aims: { primary: 'general', secondary: [] } }); Store.save('profile'); });

  G = 'one vocabulary';
  const voc = await p.evaluate(() => Object.fromEntries(Object.entries(UI.SRC).map(([k, v]) => [k, v[0]])));
  ok(JSON.stringify(Object.keys(voc)) === JSON.stringify(['user', 'measured', 'calc', 'est', 'rec', 'none']) && Object.values(voc).every(Boolean), 'six kinds, each with a Hebrew label and an explanation', voc);
  const words = Object.values(voc);
  for (const h of ['#/', '#/nutrition', '#/targets', '#/settings', '#/activity']) {
    await go(h); const bare = await p.evaluate(ws => [...document.querySelectorAll('.pill')].filter(x => ws.includes(x.textContent.trim()) && !x.closest('[data-src][role=button]')).map(x => x.outerHTML.slice(0, 120)), words);
    ok(bare.length === 0, `${h}: no label uses a provenance word without the shared tag`, bare);
  }

  G = 'labels follow the real source';
  await go('#/targets'); ok(await p.locator('[data-targets-src][data-src=calc]').count() === 1, 'automatic nutrition targets → "לפי הנתונים שלך"');
  await p.evaluate(() => { const pr = Store.load('profile'); pr.targets = { kcal: 2100, protein: 140, carbs: 200, fat: 70 }; Store.save('profile'); }); await go('#/nutrition'); await go('#/targets');
  ok(await p.locator('[data-targets-src][data-src=user]').count() === 1, 'manual targets → "הוזן ידנית"');
  await p.evaluate(() => { const pr = Store.load('profile'); pr.targets = null; Store.save('profile'); });
  await go('#/'); const k0 = await p.locator('[data-steps-kind]').getAttribute('data-src').catch(() => null);
  await p.evaluate(() => Activity.setUserSteps(Store.today(), 4321)); await go('#/nutrition'); await go('#/');
  const k1 = await p.locator('[data-steps-kind]').getAttribute('data-src').catch(() => null);
  ok(k0 !== 'user' && k1 === 'user' && /הוזן ידנית/.test(await p.locator('[data-steps-kind]').textContent()), 'steps typed by hand → "הוזן ידנית" (before: not "user")', { k0, k1 });

  { const ids = await p.evaluate(() => { const all = Object.values(NUTRI.RECIPES || {}).concat(window.RECIPES_INTL || []); const R = (NUTRI.RECIPES && !Array.isArray(NUTRI.RECIPES) ? Object.values(NUTRI.RECIPES) : (NUTRI.RECIPES || [])); return { est: (R.find(r => r.est) || {}).id || null, calc: (R.find(r => !r.est) || {}).id || null }; });
    if (ids.calc) { await go('#/recipe/' + ids.calc); await p.waitForTimeout(800); ok(await p.locator('[data-recipe-src][data-src=calc]').count() === 1, 'a recipe summed from its ingredients → "לפי הנתונים שלך"', ids); }
    if (ids.est) { await go('#/recipe/' + ids.est); await p.waitForTimeout(800); ok(await p.locator('[data-recipe-src][data-src=est]').count() === 1, 'an estimated dish → "הערכה"', ids); }
    ok(ids.calc, 'test setup: recipes exist', ids); }
  G = 'each label explains itself'; await go('#/');
  const h0 = await p.evaluate(() => location.hash);
  await p.locator('[data-steps-kind]').click(); await p.waitForTimeout(500);
  ok(await p.locator('.sheet [data-src-explain=user]').count() === 1 && await p.locator('.sheet .list .li').count() === 6, 'tap → a sheet explains this label and lists all six');
  ok(await p.evaluate(() => location.hash) === h0, 'the tap does not navigate anywhere');
  await p.locator('.sheet [data-x]').first().click(); await p.waitForTimeout(400);
  await p.locator('[data-steps-kind]').focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(500);
  ok(await p.locator('.sheet [data-src-explain=user]').count() === 1, 'keyboard: Enter on a focused label opens the same explanation');
  await p.locator('.sheet [data-x]').first().click(); await p.waitForTimeout(300);
  const aria = await p.locator('[data-steps-kind]').getAttribute('aria-label'), role = await p.locator('[data-steps-kind]').getAttribute('role');
  ok(role === 'button' && /מה זה אומר/.test(aria || ''), 'screen readers hear it as a button with its meaning', { role, aria });
  const st0 = await p.evaluate(() => JSON.stringify(Object.fromEntries(Object.keys(localStorage).filter(k => k.startsWith('fit30.')).map(k => [k, localStorage.getItem(k)]))));
  await p.locator('[data-steps-kind]').click(); await p.waitForTimeout(300); await p.locator('.sheet [data-x]').first().click(); await p.waitForTimeout(300);
  ok(await p.evaluate(() => JSON.stringify(Object.fromEntries(Object.keys(localStorage).filter(k => k.startsWith('fit30.')).map(k => [k, localStorage.getItem(k)])))) === st0, 'explaining writes nothing');

  G = 'touch target';
  { await go('#/'); const sz = await p.locator('[data-steps-kind]').evaluate(x => { const r = x.getBoundingClientRect(); return [r.width, r.height]; }); /* unrounded: 39.98 must fail */
    ok(sz[0] >= 44 && sz[1] >= 44, 'each label is at least 44×44 px to tap (Apple HIG), while the visible label stays small', sz); }
  G = 'English (LTR developer preview)';
  { const pe = await ctx.newPage(); pe.on('pageerror', e => errs.push(e.message)); await pe.goto(URL0 + '?lang=en'); await pe.waitForTimeout(900);
    const en = await pe.evaluate(() => ({ dir: document.documentElement.dir, est: UI.SRC.est[0], user: UI.SRC.user[0], tag: UI.srcTag('calc') }));
    ok(en.dir === 'ltr' && en.est === 'Estimate' && en.user === 'Entered by you' && /From your data/.test(en.tag) && /what does this mean/.test(en.tag), 'labels and their explanations follow the language', en); await pe.close(); }
  ok(errs.length === 0, 'no page errors', errs.slice(0, 3));
  await b.close();
  const pass = res.filter(r => r.ok).length, fail = res.length - pass;
  res.forEach(r => console.log((r.ok ? 'PASS' : 'FAIL') + ' [' + r.g + '] ' + r.m));
  fs.mkdirSync('dist', { recursive: true }); fs.writeFileSync('dist/e2e_provenance.json', JSON.stringify(res, null, 1));
  console.log(`provenance e2e: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('provenance e2e crashed in [' + G + ']: ' + e.message); process.exit(1); });
