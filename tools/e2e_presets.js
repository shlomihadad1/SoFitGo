/* SLL-40 · Preference presets — Playwright Chromium, iPhone 13 emulation (NOT Safari).
   Each preset changes only existing settings, shows current → new before applying, never touches owned equipment, never changes
   the plan or the menu by itself (links to the existing approval flows), is recorded in the change log, and one undo restores the
   profile exactly. Usage: node tools/e2e_presets.js [URL] */
const { chromium, devices } = require('playwright'); const fs = require('fs');
const URL0 = process.argv[2] || 'http://localhost:8096/';
const res = []; let G = ''; const ok = (c, m, i) => res.push({ g: G, ok: !!c, m: m + (i !== undefined && !c ? ' → ' + JSON.stringify(i).slice(0, 240) : '') });
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'he-IL', serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const go = async h => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(700); };
  const prof = () => p.evaluate(() => localStorage.getItem('fit30.profile')), plans = () => p.evaluate(() => localStorage.getItem('fit30.plans'));
  await p.goto(URL0); await p.waitForTimeout(700); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(700);
  await p.evaluate(() => { const pr = Store.load('profile'); Object.assign(pr, { age: 34, height: 172, weight: 78, startWeight: 78, sex: 'f', experience: 'beginner', onboarded: true, aims: { primary: 'general', secondary: [] } });
    pr.availability = { days: [1, 3, 5], sessions: 3, prefMin: null, maxMin: 60 }; pr.environment = { place: 'home', equipment: ['chair', 'towel'], custom: [] }; Store.save('profile'); });

  G = 'preview';
  await go('#/settings'); ok(await p.locator('[data-presets-link]').count() === 1, 'Settings links to "ערכות העדפות"');
  const s0 = await prof(); await p.locator('[data-presets-link]').click(); await p.waitForTimeout(900);
  ok(await prof() === s0, 'opening the presets writes nothing');
  const n = await p.locator('[data-preset]').count(); ok(n === 5, 'five presets: workday, weekend, no-cooking, quiet, hotel', n);
  const wd = await p.locator('[data-preset=workday] [data-preset-row]').evaluateAll(a => a.map(x => x.dataset.presetRow + '|' + x.textContent));
  ok(wd.length === 2 && wd.some(x => /^availability.maxMin\|.*60.*30/.test(x)) && wd.some(x => /^prefs.maxPrep\|.*—.*20/.test(x)), '"יום עבודה" shows exactly what changes, current → new', wd);

  G = 'apply and undo';
  await p.locator('[data-act=presetGo][data-k=workday]').click(); await p.waitForTimeout(500);
  let pr = await p.evaluate(() => { const x = Store.load('profile'); return { max: x.availability.maxMin, prep: x.prefs.maxPrep, eq: x.environment.equipment, days: x.availability.days }; });
  ok(pr.max === 30 && pr.prep === 20 && JSON.stringify(pr.eq) === '["chair","towel"]' && JSON.stringify(pr.days) === '[1,3,5]', 'applied: only the two settings changed; equipment and days untouched', pr);
  ok(await p.locator('[data-preset=workday] [data-preset-same]').count() === 1, 'after applying, the preset says "כבר מוגדר כך"');
  const log = await p.evaluate(() => (Store.load('changelog').items || []).filter(x => x.src !== 'app').map(x => x.path));
  ok(log.includes('availability.maxMin') && log.includes('prefs.maxPrep'), 'each changed setting is recorded in the change log', log);
  await p.locator('.toast button').first().click(); await p.waitForTimeout(500);
  ok(JSON.parse(await prof()).availability.maxMin === 60 && JSON.parse(await prof()).prefs.maxPrep == null, '"ביטול" restores the settings');
  ok(await prof() === s0, '... exactly (storage comparison)');

  G = 'plan and menu are never changed here';
  await p.evaluate(() => { Plans.activate(Plans.create('general_90', Plans.paramsFromProfile(Store.load('profile')), Store.today())); });
  const pl0 = await plans(); await go('#/settings'); await go('#/presets');
  await p.locator('[data-act=presetGo][data-k=quiet]').click(); await p.waitForTimeout(600);
  ok(await p.evaluate(() => Store.load('profile').exercisePrefs.noJump) === true, '"שקט" turns on "no jumping"');
  ok(await plans() === pl0, 'the active plan is NOT changed by a preset (storage comparison)');
  ok(await p.locator('[data-presets-plan] a[href="#/plan"]').count() === 1, 'the screen points to the plan screen, where the update is previewed and approved');
  const hotel = await p.locator('[data-preset=hotel] [data-preset-row]').evaluateAll(a => a.map(x => x.dataset.presetRow));
  ok(JSON.stringify(hotel) === '["availability.maxMin"]' && await p.locator('[data-preset=hotel] a[href="#/travel"]').count() === 1, '"חדר במלון" lists only what is not already set, and links to travel mode', hotel);

  ok(errs.length === 0, 'no page errors', errs.slice(0, 3));
  await b.close();
  const pass = res.filter(r => r.ok).length, fail = res.length - pass;
  res.forEach(r => console.log((r.ok ? 'PASS' : 'FAIL') + ' [' + r.g + '] ' + r.m));
  fs.mkdirSync('dist', { recursive: true }); fs.writeFileSync('dist/e2e_presets.json', JSON.stringify(res, null, 1));
  console.log(`presets e2e: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('presets e2e crashed in [' + G + ']: ' + (e.stack || e.message).slice(0, 600)); process.exit(1); });
