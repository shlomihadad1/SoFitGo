/* Global food defaults: new users get a varied Israeli–Mediterranean menu (never Indian by default); regional match only with
   consent; explicit cuisine beats region; restrictions always win; chips and "favourite" share one state; prefs survive reload;
   no location permission never blocks. Checks the DISPLAYED dishes, not just the stored setting.
   Usage: [BROWSER=webkit] node tools/e2e_food_global.js [URL] */
const pw = require('playwright'), { devices } = pw; const ENGINE = process.env.BROWSER || 'chromium';
const URL0 = process.argv[2] || 'http://localhost:8096/';
const res = []; let G = ''; const ok = (c, m, i) => res.push({ g: G, ok: !!c, m: m + (i !== undefined && !c ? ' → ' + JSON.stringify(i).slice(0, 500) : '') });
const BASICS = () => { Store.resetAll(); localStorage.clear(); const pr = Store.load('profile'); Object.assign(pr, { age: 34, height: 176, weight: 80, startWeight: 80, sex: 'm', experience: 'beginner', aims: { primary: 'general', secondary: [] } }); Store.save('profile'); };
const IND = ['indian', 'himachali'], ISR = ['israeli', 'middle_eastern', 'moroccan'], MED = ['mediterranean', 'greek', 'italian', 'middle_eastern'];
(async () => {
  const b = await pw[ENGINE].launch(); console.log('engine: ' + ENGINE); const errs = [];
  const mk = async (geo) => { const ctx = await b.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, locale: 'he-IL', serviceWorkers: 'block' }); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(g => { window.__geoCalls = 0; if (!navigator.geolocation) return; navigator.geolocation.getCurrentPosition = (ok, bad) => { window.__geoCalls++; setTimeout(() => g ? ok({ coords: { latitude: g[0], longitude: g[1], accuracy: 50 } }) : bad({ code: 1, message: 'denied' }), 30); }; }, geo);
    await p.goto(URL0); await p.waitForTimeout(700); await p.evaluate(BASICS); await p.reload(); await p.waitForTimeout(800); return { ctx, p }; };
  const week = p => p.evaluate(() => { const o = []; for (let i = 0; i < 7; i++) { const d = Store.addDays(Store.today(), i), pl = Core.plan(d); Core.DAY.forEach(k => { if (pl[k] && pl[k].rid) o.push({ rid: pl[k].rid, cu: Core.cuisineOf(Logic.recipe(pl[k].rid)), conf: Core.conflicts(Logic.recipe(pl[k].rid), pl[k].ov).length }); }); } return o; });
  const shown = async p => { await p.evaluate(() => { location.hash = '#/home'; }); await p.waitForTimeout(200); await p.evaluate(() => { location.hash = '#/nutrition'; }); await p.waitForTimeout(800);
    return p.evaluate(() => { const pl = Core.plan(Store.today()), txt = document.querySelector('main').innerText; return Core.DAY.filter(k => pl[k] && pl[k].rid).map(k => ({ he: Logic.recipe(pl[k].rid).he, onScreen: txt.includes(Logic.recipe(pl[k].rid).he), cu: Core.cuisineOf(Logic.recipe(pl[k].rid)) })); }); };
  const share = (w, set) => w.filter(x => set.includes(x.cu)).length / w.length;
  const mountSettings = async p => { await p.evaluate(() => { location.hash = '#/home'; }); await p.waitForTimeout(150); await p.evaluate(() => { location.hash = '#/settings'; }); await p.locator('[data-cuisine] [data-fp=cu]').first().waitFor({ timeout: 5000 }); };

  /* 1 · new user, no preferences, no location, nothing external */
  let { ctx, p } = await mk(null);
  G = 'new user (no prefs)';
  let w = await week(p), s = await shown(p);
  ok(w.filter(x => IND.includes(x.cu)).length === 0, 'no Indian dish in the first week', w.map(x => x.cu));
  ok(new Set(w.map(x => x.rid)).size >= 8 && new Set(w.map(x => x.cu)).size >= 3, 'varied: ≥8 different dishes and ≥3 cuisines in a week (no single-cuisine menu)', { dishes: new Set(w.map(x => x.rid)).size, cu: [...new Set(w.map(x => x.cu))] });
  ok(s.length && s.every(x => x.onScreen && !IND.includes(x.cu)), 'the dishes ON SCREEN today are the default (not Indian)', s);
  ok(await p.evaluate(() => window.__geoCalls) === 0, 'no location request without consent');
  ok(/ישראלי, ים־תיכוני/.test(await p.locator('[data-cuisine-prompt]').innerText()), 'screen says which default is used, without forcing a choice');
  G = 'onboarding';
  await p.evaluate(() => { location.hash = '#/setup/2'; }); await p.locator('[data-ob-food] [data-fp-region]').waitFor({ timeout: 5000 });
  ok(/נתאים את התפריט למאכלים ולמרכיבים הנפוצים באזור/.test(await p.locator('[data-ob-food]').innerText()) && await p.locator('[data-ob-food] [data-fp=regYes]').count() === 1 && await p.locator('[data-ob-food] [data-fp=regNo]').count() === 1, 'optional food step: cuisines + the regional question (yes / keep basic)');
  await p.locator('[data-act=goal]').first().click().catch(() => {}); await p.waitForTimeout(200);
  if (!(await p.evaluate(() => Core.profile().aims.primary))) await p.evaluate(() => { const pr = Core.profile(); pr.aims = { primary: 'general', secondary: [] }; Store.save('profile'); });
  await p.locator('#ob-d').check(); await p.locator('[data-act=next]').click(); await p.waitForTimeout(500);
  ok(await p.evaluate(() => location.hash) === '#/setup/3', 'can continue without choosing a cuisine (skippable)');
  w = await week(p); ok(await p.evaluate(() => Core.normPrefs(Core.profile().prefs).dairy === false) && w.every(x => x.conf === 0) && w.filter(x => IND.includes(x.cu)).length === 0, 'restriction from onboarding (no dairy) saved and applied; still default cuisines', { dairy: await p.evaluate(() => Core.normPrefs(Core.profile().prefs).dairy), conf: w.filter(x => x.conf), ind: w.filter(x => IND.includes(x.cu)).map(x => x.rid) });
  await ctx.close();

  /* 2 · user in India who declines regional matching */
  ({ ctx, p } = await mk([28.6, 77.2]));
  G = 'India, declines';
  await mountSettings(p); await p.locator('[data-fp=regNo]').click(); await p.waitForTimeout(500);
  w = await week(p); ok(w.filter(x => IND.includes(x.cu)).length === 0 && await p.evaluate(() => window.__geoCalls) === 0, 'basic (non-Indian) menu; location never requested');
  ok(await p.evaluate(() => Core.normPrefs(Core.profile().prefs).region.consent === false), 'refusal stored separately');
  await ctx.close();

  /* 3 · user in India who consents and uses location */
  ({ ctx, p } = await mk([28.6, 77.2]));
  G = 'India, consents';
  await mountSettings(p); const before = await shown(p); await mountSettings(p);
  await p.locator('[data-fp=regYes]').click(); await p.locator('[data-fp=geo]').waitFor(); ok(/נדרש רק כדי לזהות את האזור/.test(await p.locator('[data-fp-region]').innerText()), 'location purpose explained before asking');
  await p.locator('[data-fp=geo]').click(); await p.waitForTimeout(800);
  const rg = await p.evaluate(() => Core.normPrefs(Core.profile().prefs).region);
  ok(rg.consent && rg.code === 'india' && rg.src === 'gps' && rg.group === 'indian', 'region detected on the device → India', rg);
  /* Root cause of an intermittent failure (reproduced with a frozen clock): ISO timestamps already stored by the app (region.at,
     profile.createdAt) read "…:28.6xxZ" when the seconds are 28 and the milliseconds 600–699, which the plain /28\.6/ check took
     for the latitude. The ORIGINAL check is kept as it was; only ISO timestamps are removed from the text before it runs, so any
     stored coordinate in any form (28.6, 28.60, 28.6139, "77.2") is still caught. */
  const noTs = s => s.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?/g, '');
  const leaks = s => /28\.6|77\.2/.test(noTs(s));
  ok(['{"lat":28.6}', '{"lat":28.60}', '{"lat":28.6139,"lng":77.209}', '"77.2"'].every(leaks) && !leaks('"at":"2026-10-26T10:00:28.650Z"'), 'coordinate check: still catches a stored position in any precision, ignores ISO timestamps (control)');
  ok(!leaks(await p.evaluate(() => JSON.stringify(Object.assign({}, localStorage)))), 'coordinates not stored');
  w = await week(p); ok(share(w, IND) >= 0.8, 'regional recommendations: menu mostly Indian now', w.map(x => x.cu));
  const after = await shown(p); ok(after.every(x => x.onScreen) && after.map(x => x.he).join() !== before.map(x => x.he).join(), 'the dishes on screen actually changed', { before, after });
  G = 'explicit cuisine beats region';
  await mountSettings(p); await p.click('[data-fp=cu][data-v=israeli]'); await p.waitForTimeout(600);
  w = await week(p); ok(share(w, ISR) >= 0.7 && w.filter(x => IND.includes(x.cu)).length === 0, 'Israeli chosen → Israeli dishes even though the region is India', w.map(x => x.cu));
  const isrShown = await shown(p); ok(isrShown.every(x => x.onScreen && ISR.includes(x.cu)), 'Israeli dishes on screen', isrShown);
  G = 'allergies always win';
  await p.evaluate(() => { const pr = Core.profile(); pr.prefs = Object.assign(Core.normPrefs(pr.prefs), { dairy: false, egg: false, glutenFree: true }); Store.save('profile'); Core.applyPrefs(pr.prefs); });
  w = await week(p); ok(w.length && w.every(x => x.conf === 0), 'no restricted food with Israeli + no dairy/eggs/gluten', w.filter(x => x.conf));
  await p.evaluate(() => { const pr = Core.profile(); const pf = Core.normPrefs(pr.prefs); delete pf.cuisines; Store.save('profile'); Core.applyPrefs(pf); pr.prefs = pf; Store.save('profile'); });
  w = await week(p); ok(w.every(x => x.conf === 0), 'Indian region + restrictions → still no restricted food', w.filter(x => x.conf));
  await ctx.close();

  /* regression for the intermittent failure: the same consent flow with the clock frozen where timestamps read "…:28.650Z" */
  G = 'India, consents — timestamp at 28.650 s';
  { const c2 = await b.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, locale: 'he-IL', serviceWorkers: 'block' }); const q = await c2.newPage(); q.on('pageerror', e => errs.push(e.message));
    await q.addInitScript(g => { navigator.geolocation.getCurrentPosition = ok2 => setTimeout(() => ok2({ coords: { latitude: g[0], longitude: g[1], accuracy: 50 } }), 30); }, [28.6, 77.2]);
    await q.clock.setFixedTime(new Date('2026-10-26T10:00:28.650'));
    await q.goto(URL0); await q.waitForTimeout(700); await q.evaluate(BASICS); await q.reload(); await q.waitForTimeout(800); await mountSettings(q);
    await q.locator('[data-fp=regYes]').click(); await q.locator('[data-fp=geo]').waitFor(); await q.locator('[data-fp=geo]').click(); await q.waitForTimeout(900);
    const all = await q.evaluate(() => JSON.stringify(Object.assign({}, localStorage))), rg2 = await q.evaluate(() => Core.normPrefs(Core.profile().prefs).region);
    ok(rg2.consent && rg2.code === 'india' && /28\.6/.test(all), 'the risky case is really exercised (stored timestamps contain "28.6", region detected)', rg2);
    ok(!leaks(all), 'coordinates still not stored, and the check does not mistake the timestamp for the latitude');
    await c2.close(); }

  /* 4 · location denied */
  ({ ctx, p } = await mk(null));
  G = 'no location permission';
  await mountSettings(p); await p.locator('[data-fp=regYes]').click(); await p.locator('[data-fp=geo]').waitFor(); await p.locator('[data-fp=geo]').click(); await p.waitForTimeout(500);
  ok(/ההרשאה למיקום נדחתה/.test(await p.locator('[data-fp-status]').innerText()) && await p.locator('[data-fp=region]').count() === 1, 'denied → clear message + manual region list');
  w = await week(p); ok(w.filter(x => IND.includes(x.cu)).length === 0, 'menu stays the basic default');
  await p.evaluate(() => { location.hash = '#/workouts'; }); await p.waitForTimeout(500); ok(await p.locator('main').innerText().then(t => t.length > 50), 'app still fully usable');
  await mountSettings(p); await p.selectOption('[data-fp=region]', 'med'); await p.waitForTimeout(600);
  w = await week(p); ok(share(w, MED) >= 0.7, 'manual region (Mediterranean) applied', w.map(x => x.cu));
  await ctx.close();

  /* 5 · chips vs favourite field = one state; reload keeps it */
  ({ ctx, p } = await mk(null));
  G = 'chips vs field';
  await mountSettings(p); await p.selectOption('[data-fp=main]', 'asian'); await p.waitForTimeout(600);
  const viaField = { pf: await p.evaluate(() => Core.normPrefs(Core.profile().prefs)), w: (await week(p)).map(x => x.rid) };
  ok(await p.locator('[data-fp=cu][data-v=asian][aria-pressed=true]').count() === 1, 'choosing the favourite turns its chip on');
  await p.evaluate(() => { const pr = Core.profile(); const pf = Core.normPrefs(pr.prefs); delete pf.cuisines; delete pf.cuisineMain; pr.prefs = pf; Store.save('profile'); Core.applyPrefs(pf); });
  await mountSettings(p); await p.click('[data-fp=cu][data-v=asian]'); await p.waitForTimeout(600);
  const viaChip = { pf: await p.evaluate(() => Core.normPrefs(Core.profile().prefs)), w: (await week(p)).map(x => x.rid) };
  ok(JSON.stringify(viaField.pf.cuisines) === JSON.stringify(viaChip.pf.cuisines) && viaField.w.join() === viaChip.w.join(), 'field and chips give the same cuisines and the same menu', { f: viaField.pf.cuisines, c: viaChip.pf.cuisines });
  await p.click('[data-fp=cu][data-v=asian]'); await p.waitForTimeout(500); await p.selectOption('[data-fp=main]', 'israeli'); await p.waitForTimeout(500);
  await p.reload(); await p.waitForTimeout(900); await mountSettings(p);
  ok((await p.locator('[data-fp=cu][aria-pressed=true]').evaluateAll(es => es.map(e => e.dataset.v))).join() === 'israeli' && await p.inputValue('[data-fp=main]') === 'israeli', 'after reload: same chips and favourite');
  const exp = await p.evaluate(() => Store.exportAll ? JSON.stringify(Store.exportAll()) : null);
  if (exp) { await p.evaluate(() => { Store.resetAll(); localStorage.clear(); }); await p.reload(); await p.waitForTimeout(800); await p.evaluate(x => Store.importAll(JSON.parse(x)), exp); await p.reload(); await p.waitForTimeout(800);
    ok(await p.evaluate(() => JSON.stringify(Core.normPrefs(Core.profile().prefs).cuisines)) === '["israeli"]', 'restoring the user\'s data (backup / new device) keeps the cuisine choice'); }
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no sideways scroll');
  await ctx.close();

  G = 'errors'; ok(!errs.length, 'no JS errors', errs);
  await b.close();
  let pass = 0, fail = 0; for (const r of res) { console.log(`${r.ok ? 'PASS' : 'FAIL'} [${r.g}] ${r.m}`); r.ok ? pass++ : fail++; }
  console.log(`\nfood global tests: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
