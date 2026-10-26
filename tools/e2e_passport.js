/* SLL-17 · Equipment per place — Playwright Chromium, iPhone 13 emulation (NOT Safari). Save the current equipment under a place, switch
   to another saved place with one tap and one undo; a never-saved place cannot be switched to; the plan is not rebuilt here; the change
   log shows readable values. Usage: node tools/e2e_passport.js [URL] */
const { chromium, devices } = require('playwright'); const fs = require('fs');
const URL0 = process.argv[2] || 'http://localhost:8096/';
const res = []; let G = ''; const ok = (c, m, i) => res.push({ g: G, ok: !!c, m: m + (i !== undefined && !c ? ' → ' + JSON.stringify(i).slice(0, 300) : '') });
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'he-IL', serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const go = async h => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(800); };
  const eq = () => p.evaluate(() => Store.load('profile').environment.equipment.slice().sort().join());
  await p.goto(URL0); await p.waitForTimeout(700); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(700);
  await p.evaluate(() => { const pr = Store.load('profile'); Object.assign(pr, { age: 34, height: 172, weight: 78, startWeight: 78, sex: 'f', experience: 'beginner', onboarded: true, aims: { primary: 'general', secondary: [] } }); pr.availability = { days: [1, 3, 5], sessions: 3, prefMin: null, maxMin: 30 }; pr.environment = { place: 'home', equipment: ['chair', 'towel'], custom: [] }; Store.save('profile');
    Plans.activate(Plans.create('general_90', Plans.paramsFromProfile(pr), Store.today())); });
  G = 'save and switch';
  await go('#/presets'); ok(await p.locator('[data-passport]').count() === 1 && await p.locator('[data-act=plGo]').count() === 0, '"הציוד לפי מקום": nothing to switch to before anything is saved');
  await p.locator('[data-act=plSave][data-k=home]').click(); await p.waitForTimeout(400);
  await p.evaluate(() => { const pr = Store.load('profile'); pr.environment.equipment = ['dumbbells', 'bench', 'chair']; Store.save('profile'); });
  await go('#/settings'); await go('#/presets'); await p.locator('[data-act=plSave][data-k=gym]').click(); await p.waitForTimeout(400);
  const pl = await p.evaluate(() => Store.load('profile').places);
  ok(pl.home.equipment.join() === 'chair,towel' && pl.gym.equipment.slice().sort().join() === 'bench,chair,dumbbells', 'two places saved with their own equipment', pl);
  const plans0 = await p.evaluate(() => localStorage.getItem('fit30.plans')), prof0 = await p.evaluate(() => localStorage.getItem('fit30.profile'));
  ok(await p.locator('[data-act=plGo][data-k=home]').count() === 1 && await p.locator('[data-act=plGo][data-k=gym]').count() === 0, 'only a saved place that differs from the current equipment can be switched to');
  await p.locator('[data-act=plGo][data-k=home]').click(); await p.waitForTimeout(500);
  ok(await eq() === 'chair,towel', 'switching to "בית" applies its equipment');
  ok(await p.evaluate(() => localStorage.getItem('fit30.plans')) === plans0 && await p.locator('[data-presets-plan]').count() === 0, 'the plan is not rebuilt here; "בית" matches the plan\'s own equipment, so no update is suggested');
  await p.locator('.toast button').first().click(); await p.waitForTimeout(500);
  ok(await p.locator('[data-presets-plan] a[href="#/plan"]').count() === 1, 'with the gym equipment (different from the plan) the screen points to the plan update');
  ok(await p.evaluate(() => localStorage.getItem('fit30.profile')) === prof0, '"ביטול" restores the profile exactly');
  ok(await p.locator('[data-act=plGo][data-k=work]').count() === 0, 'a never-saved place ("עבודה") cannot be switched to');
  G = 'change log';
  await go('#/changes'); const txt = await p.locator('main').innerText();
  ok(!/\[object Object\]/.test(txt) && /ציוד לפי מקום/.test(txt), 'the change log shows the saved places readably');
  ok(errs.length === 0, 'no page errors', errs.slice(0, 3));
  await b.close();
  const pass = res.filter(r => r.ok).length, fail = res.length - pass;
  res.forEach(r => console.log((r.ok ? 'PASS' : 'FAIL') + ' [' + r.g + '] ' + r.m));
  fs.mkdirSync('dist', { recursive: true }); fs.writeFileSync('dist/e2e_passport.json', JSON.stringify(res, null, 1));
  console.log(`passport e2e: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('passport e2e crashed in [' + G + ']: ' + (e.stack || e.message).slice(0, 600)); process.exit(1); });
