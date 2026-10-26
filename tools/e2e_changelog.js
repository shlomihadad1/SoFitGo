/* SLL-42 · Transparent Change Log — Playwright Chromium, iPhone 13 emulation (NOT Safari).
   Settings changes after setup are recorded (time, old, new); setup, body data and identity are not; same-setting edits within
   2 minutes merge; a change back removes the entry; cap 300; #/changes lists them with Hebrew labels; clearing empties only the
   log, with exact undo; the log is not in backups. Usage: node tools/e2e_changelog.js [URL] */
const { chromium, devices } = require('playwright'); const fs = require('fs');
const URL0 = process.argv[2] || 'http://localhost:8096/';
const res = []; let G = ''; const ok = (c, m, i) => res.push({ g: G, ok: !!c, m: m + (i !== undefined && !c ? ' → ' + JSON.stringify(i).slice(0, 240) : '') });
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'he-IL', serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const go = async h => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(600); };
  const items = () => p.evaluate(() => (JSON.parse(localStorage.getItem('fit30.changelog') || '{"items":[]}').items || []));
  const userItems = async () => (await items()).filter(x => x.src !== 'app'), appItems = async () => (await items()).filter(x => x.src === 'app');
  const setP = fn => p.evaluate(f => { const pr = Store.load('profile'); (new Function('p', f))(pr); Store.save('profile'); }, fn);
  await p.goto(URL0); await p.waitForTimeout(700); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(700);

  G = 'what is recorded';
  await setP("Object.assign(p, { age: 34, height: 172, weight: 78, startWeight: 78, sex: 'f', experience: 'beginner' }); p.goals.water = 2800;");
  ok((await items()).length === 0, 'changes during setup (profile not yet onboarded) are not recorded');
  await setP('p.onboarded = true;');
  ok((await items()).length === 0, 'finishing setup itself is not recorded (the automatic targets only get a baseline)');
  await setP('p.goals.water = 2500;');
  let it = await items();
  ok(it.length === 1 && it[0].path === 'goals.water' && it[0].from === 2800 && it[0].to === 2500 && !isNaN(Date.parse(it[0].at)), 'a settings change after setup → one entry with time, old and new value', it);
  await setP('p.goals.water = 2000;'); it = await items();
  ok(it.length === 1 && it[0].from === 2800 && it[0].to === 2000, 'another change of the same setting within 2 minutes merges into the same entry', it);
  await setP('p.goals.water = 2800;');
  ok((await items()).length === 0, 'changing it back within 2 minutes removes the entry (nothing actually changed)');
  const t0 = await p.evaluate(() => { const a = Core.autoTargets(); return { kcal: a.kcal, protein: a.protein }; });
  await setP("p.weight = 74; p.name = 'דנה';");
  ok((await userItems()).length === 0, 'body data and identity (weight, name) are never recorded as a user setting');
  const t1 = await p.evaluate(() => { const a = Core.autoTargets(); return { kcal: a.kcal, protein: a.protein }; }); let ap = await appItems();
  const ak = ap.find(x => x.path === 'auto.kcal'), apr = ap.find(x => x.path === 'auto.protein');
  ok(ak && ak.from === t0.kcal && ak.to === t1.kcal && t0.kcal !== t1.kcal, 'APP change: the automatic calorie target moved because the weight changed → one app entry, old → new', { ak, t0, t1 });
  ok(ak && /משקל 78 ק״ג → 74 ק״ג/.test(ak.why) && (!apr || apr.from === t0.protein && apr.to === t1.protein), 'the app entry says why (the input that changed, with its values)', { ak, apr });
  await setP("p.age = 35; p.height = 173; p.sex = 'm';");
  ok((await userItems()).length === 0, 'age, height and sex are never recorded as user settings');
  ap = await appItems(); ok(/גיל 34 → 35/.test((ap.find(x => x.path === 'auto.kcal') || {}).why || '') && /מין נקבה → זכר/.test((ap.find(x => x.path === 'auto.kcal') || {}).why || ''), 'a later recalculation within 2 minutes merges into the same app entry, with the newest reason', ap);
  await setP("p.targets = { kcal: 2100, protein: 140, carbs: 200, fat: 70 };"); const nApp = (await appItems()).length;
  ok((await userItems()).some(x => x.path === 'targets.kcal' && x.from === null && x.to === 2100), 'setting a manual target is the user\'s change (recorded as a setting)');
  await setP('p.weight = 72;');
  ok((await appItems()).length === nApp, 'while a manual target is in use, weight changes create no app entry (the manual target did not move)');
  await setP('p.targets = null;'); await setP('p.weight = 74;');
  await p.evaluate(() => { const cl = Store.load('changelog'); cl.items = []; Store.save('changelog'); }); /* the rest of this group checks user settings only */
  await setP("p.prefs.exclude = ['tomato']; p.availability.days = [1, 3]; p.display.sound = false;");
  it = await items(); ok(it.length === 3 && ['prefs.exclude', 'availability.days', 'display.sound'].every(k => it.some(x => x.path === k)), 'one save that changes three settings → three entries', it.map(x => x.path));
  const sep = await p.evaluate(() => { const before = Store.load('changelog').items.length, a = JSON.stringify(Object.assign({}, Store.load('profile'), { goals: { steps: 6000, water: 2800, sleep: 7.5 } })), b2 = JSON.stringify(Object.assign(JSON.parse(a), { goals: { steps: 7000, water: 2800, sleep: 7.5 } })), c2 = JSON.stringify(Object.assign(JSON.parse(a), { goals: { steps: 8000, water: 2800, sleep: 7.5 } }));
    const t0 = Date.now() + 3600e3; Store.recordChanges(a, b2, t0); Store.recordChanges(b2, c2, t0 + 3 * 60e3); return Store.load('changelog').items.length - before; });
  ok(sep === 2, 'the same setting changed again after more than 2 minutes → a separate entry', sep);

  G = 'the screen';
  await go('#/settings'); ok(await p.locator('[data-changes-link]').count() === 1, 'Settings links to "יומן שינויים בהגדרות"');
  const s0 = await p.evaluate(() => localStorage.getItem('fit30.changelog'));
  await p.locator('[data-changes-link]').click(); await p.waitForTimeout(900);
  ok(await p.evaluate(() => localStorage.getItem('fit30.changelog')) === s0, 'opening the log writes nothing');
  const rows = await p.locator('[data-ch]').evaluateAll(a => a.map(x => ({ k: x.dataset.ch, t: x.querySelector('.t').textContent, from: x.querySelector('[data-ch-from]').textContent, to: x.querySelector('[data-ch-to]').textContent })));
  const ex = rows.find(r => r.k === 'prefs.exclude'), dy = rows.find(r => r.k === 'availability.days'), sd = rows.find(r => r.k === 'display.sound');
  ok(ex && ex.t === 'מזונות מוחרגים' && ex.from === '—' && /עגבני/.test(ex.to), 'excluded foods shown by Hebrew name, empty shown as "—"', ex);
  ok(dy && /א׳|ב׳|ג׳|ד׳|ה׳|ו׳|ש׳/.test(dy.to) && sd && sd.from === 'כן' && sd.to === 'לא', 'days shown as day letters, on/off as כן/לא', { dy, sd });
  const newestFirst = await p.evaluate(() => { const at = [...document.querySelectorAll('[data-ch-day]')].map(x => x.dataset.chDay); return at.join() === at.slice().sort().reverse().join(); });
  ok(newestFirst, 'newest day first');

  { await p.evaluate(() => { const cl = Store.load('changelog'); cl.items.push({ at: new Date().toISOString(), path: 'auto.kcal', from: 2300, to: 2200, src: 'app', why: 'חושב מחדש כי השתנה: משקל 78 ק״ג → 74 ק״ג' }); Store.save('changelog'); });
    await go('#/settings'); await go('#/changes'); const row = p.locator('[data-ch="auto.kcal"][data-ch-src=app]').first();
    ok(await row.locator('[data-ch-app]').count() === 1 && /משקל 78/.test(await row.locator('[data-ch-why]').textContent()) && /יעד קלוריות אוטומטי/.test(await row.locator('.t').textContent()), 'an app entry is labelled "האפליקציה" and shows its reason'); }
  G = 'plan changes in the same log';
  { const miss = await p.evaluate(() => { const pr = Store.load('profile'); pr.aims = { primary: 'general', secondary: [] }; pr.experience = 'beginner'; pr.availability = { days: [1, 3, 5], sessions: 3, prefMin: null, maxMin: 30 }; Store.save('profile');
      const pl = Plans.activate(Plans.create('general_90', Plans.paramsFromProfile(Store.load('profile')), Store.today())); return (Plans.get(pl.id).changes || []).length; });
    await go('#/settings'); await go('#/changes');
    const pc = await p.locator('[data-plan-changes] [data-pch]').evaluateAll(a => a.map(x => ({ k: x.dataset.pch, s: x.querySelector('.s').textContent })));
    ok(miss >= 1 && pc.length === miss && pc.some(x => x.k === 'activated' && x.s === 'שינוי שלך'), 'the active plan\'s change history is listed with who initiated each change', { miss, pc }); }
  G = 'a real settings control';
  await go('#/settings'); const nBefore = (await items()).length;
  await p.locator('#d-mo').check(); await p.waitForTimeout(500);
  it = await items(); const mo = it.filter(x => x.path === 'display.motion').pop();
  ok(it.length === nBefore + 1 && mo && mo.from === 'auto' && mo.to === 'reduce', '"הפחתת אנימציות" in Settings → recorded once', { n: it.length, nBefore, mo });

  G = 'clearing, limits and privacy';
  await go('#/changes'); const keep = await p.evaluate(() => localStorage.getItem('fit30.changelog')), prof = await p.evaluate(() => localStorage.getItem('fit30.profile'));
  await p.locator('[data-act=chClear]').click(); await p.waitForTimeout(500);
  ok(await p.locator('[data-ch-empty]').count() === 1 && (await items()).length === 0 && await p.evaluate(() => localStorage.getItem('fit30.profile')) === prof, '"מחיקת היומן" empties only the log — no setting changes');
  await p.locator('.toast button').first().click(); await p.waitForTimeout(500);
  ok(await p.evaluate(() => localStorage.getItem('fit30.changelog')) === keep, '"ביטול" restores the log exactly');
  const cap = await p.evaluate(() => { const base = Store.load('profile'); let prev = JSON.stringify(base), t = Date.now() + 7200e3;
    for (let i = 0; i < 320; i++) { const nx = JSON.stringify(Object.assign(JSON.parse(prev), { goals: Object.assign({}, base.goals, { sleep: 6 + (i % 2) }) })); Store.recordChanges(prev, nx, t + i * 180e3); prev = nx; }
    return Store.load('changelog').items.length; });
  ok(cap === 300, 'at most 300 entries (oldest dropped)', cap);
  ok(await p.evaluate(() => !('changelog' in Store.exportAll())), 'the log is not part of the JSON backup (device-only, like the profile photo)');
  ok(await p.evaluate(() => Store.KEYS.changelog === 'fit30.changelog'), 'stored under its own key, so "delete all data on this device" removes it');

  ok(errs.length === 0, 'no page errors', errs.slice(0, 3));
  await b.close();
  const pass = res.filter(r => r.ok).length, fail = res.length - pass;
  res.forEach(r => console.log((r.ok ? 'PASS' : 'FAIL') + ' [' + r.g + '] ' + r.m));
  fs.mkdirSync('dist', { recursive: true }); fs.writeFileSync('dist/e2e_changelog.json', JSON.stringify(res, null, 1));
  console.log(`changelog e2e: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('changelog e2e crashed in [' + G + ']: ' + e.message); process.exit(1); });
