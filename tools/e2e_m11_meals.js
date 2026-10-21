/* M11.3 · meal personalisation & swaps: one swap path (nutrition screen + Sofit), preview before saving, restrictions / dislikes /
   cuisine / prep time respected, sort by goal, day impact (planned vs eaten kept apart), optional protein rebalance, failed write
   reported as failure, no change to targets/profile. Usage: [BROWSER=webkit] node tools/e2e_m11_meals.js [URL] */
const pw = require('playwright'), { devices } = pw; const ENGINE = process.env.BROWSER || 'chromium';
const URL0 = process.argv[2] || 'http://localhost:8096/';
const res = []; let G = ''; const ok = (c, m, i) => res.push({ g: G, ok: !!c, m: m + (i !== undefined && !c ? ' → ' + JSON.stringify(i).slice(0, 500) : '') });
const BASICS = () => { Store.resetAll(); localStorage.clear(); const pr = Store.load('profile'); Object.assign(pr, { age: 34, height: 176, weight: 80, startWeight: 80, sex: 'm', experience: 'beginner', aims: { primary: 'muscle', secondary: [] } }); Store.save('profile'); };
(async () => {
  const b = await pw[ENGINE].launch(); console.log('engine: ' + ENGINE); const errs = [];
  const ctx = await b.newContext({ ...devices['iPhone 13'], viewport: { width: 375, height: 740 }, locale: 'he-IL', serviceWorkers: 'block' }); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  const reqs = []; p.on('request', r => reqs.push(r.url()));
  await p.goto(URL0); await p.waitForTimeout(700); await p.evaluate(BASICS); await p.reload(); await p.waitForTimeout(800);
  const go = async (h, ms) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(ms || 600); };
  const plan = () => p.evaluate(() => { const d = Store.today(), pl = Core.plan(d); return Object.fromEntries(['m1', 'm2', 'snack'].map(k => [k, pl[k].rid])); });
  const targets0 = await p.evaluate(() => JSON.stringify([Core.profile().targets, Core.profile().aims, Core.targets()]));

  G = 'swap sheet (nutrition screen)';
  await go('#/nutrition', 900); ok(!reqs.some(u => /extra\.js/.test(u)), 'swap code not in the first load');
  await p.locator('[data-act=swapMeal][data-slot=m2]').click(); await p.locator('.sheet [data-meal-opts]').waitFor({ timeout: 5000 });
  ok(await p.locator('.sheet [data-act=sort]').count() === 4, 'sort choices: closest / more protein / quick / lighter');
  ok(await p.locator('.sheet [data-act=sort][data-s=protein][aria-pressed=true]').count() === 1, 'goal "muscle" → "more protein" first by default');
  const prot = await p.evaluate(() => [...document.querySelectorAll('.sheet [data-opt-list] [data-act=pick]')].slice(0, 4).map(b => +b.querySelector('.kv b').textContent));
  ok(prot.length >= 2 && prot.every((v, i) => i === 0 || prot[i - 1] >= v), 'sorted by protein (high → low)', prot);
  await p.locator('.sheet [data-act=sort][data-s=quick]').click(); await p.waitForTimeout(250);
  const q = await p.evaluate(() => [...document.querySelectorAll('.sheet [data-opt-list] [data-act=pick]')].slice(0, 4).map(b => Logic.recipe(b.dataset.id)).map(r => (r.prep || 0) + (r.cook || 0)));
  ok(q.length >= 2 && q.every((v, i) => i === 0 || q[i - 1] <= v), '"quick" sorted by prep+cook time', q);
  const before = await plan(), pickId = await p.locator('.sheet [data-opt-list] [data-act=pick]').first().getAttribute('data-id');
  await p.locator('.sheet [data-opt-list] [data-act=pick]').first().click(); await p.waitForTimeout(250);
  ok(await p.locator('.sheet [data-swap-confirm] [data-diff]').count() === 1 && /תכנון היום אחרי ההחלפה/.test(await p.locator('.sheet [data-day-impact]').innerText()) && /נאכל בפועל עד עכשיו/.test(await p.locator('.sheet [data-day-impact]').innerText()), 'preview before saving: meal diff + planned day vs target + eaten so far (kept apart)');
  ok((await plan()).m2 === before.m2, 'nothing saved before confirming');
  await p.locator('.sheet [data-act=ok]').click(); await p.waitForTimeout(300);
  ok((await plan()).m2 === pickId, 'saved through the existing plan storage');
  await p.reload(); await p.waitForTimeout(900); ok((await plan()).m2 === pickId, 'persists after reload');
  ok(await p.evaluate(() => JSON.stringify([Core.profile().targets, Core.profile().aims, Core.targets()])) === targets0, 'targets and goal unchanged');

  G = 'restrictions, dislikes, cuisine';
  await p.evaluate(() => { const pr = Core.profile(); pr.prefs = Object.assign(Core.normPrefs(pr.prefs), { dairy: false, cuisines: ['israeli', 'mediterranean'], maxPrep: 15 }); Store.save('profile'); });
  await go('#/nutrition', 900); await p.locator('[data-act=swapMeal][data-slot=m1]').click(); await p.locator('.sheet [data-meal-opts]').waitFor();
  const ids = await p.evaluate(() => [...document.querySelectorAll('.sheet [data-act=pick]')].map(b => b.dataset.id));
  ok(ids.length > 0 && await p.evaluate(ids => ids.every(id => Core.conflicts(Logic.recipe(id), null).length === 0), ids), 'no option contains a restricted food (dairy off)');
  const top = await p.evaluate(() => [...document.querySelectorAll('.sheet [data-opt-list] > [data-act=pick]')].map(b => Core.cuisineAllowed(Logic.recipe(b.dataset.id), Core.normPrefs(Core.profile().prefs))));
  ok(top.length === 0 || top.every(Boolean), 'main list = chosen cuisines; others only under "מטבחים אחרים"', top);
  const curM1 = (await plan()).m1; await p.locator('.sheet [data-act=dislike]').click(); await p.waitForTimeout(400);
  ok(await p.evaluate(id => (Core.profile().nutritionDislike || []).includes(id), curM1), '"לא אוהב/ת" saved to the profile');
  const shTxt = await p.locator('.sheet').last().innerText();
  ok(/שסימנת "לא אוהב\/ת" הוסתרו/.test(shTxt), 'hidden dislikes explained in the sheet', shTxt.slice(-300));
  ok((await plan()).m1 !== curM1, 'the disliked dish is replaced in today\'s menu');
  await p.evaluate(() => document.querySelectorAll('.sheet-bg').forEach(x => x.remove()));
  await p.locator('[data-act=swapMeal][data-slot=m1]').click(); await p.locator('.sheet [data-meal-opts]').waitFor();
  ok(!(await p.evaluate(id => [...document.querySelectorAll('.sheet [data-act=pick]')].some(b => b.dataset.id === id), curM1)), 'disliked dish no longer offered');
  ok(await p.evaluate(() => [...document.querySelectorAll('.sheet [data-act=pick]')].every(b => { const r = Logic.recipe(b.dataset.id), m = (r.prep || 0) + (r.cook || 0); return m <= 15 || /ארוך מהזמן שהגדרת/.test(b.textContent); })), 'every option longer than maxPrep (15) is flagged');
  await p.evaluate(() => document.querySelectorAll('.sheet-bg').forEach(x => x.remove()));

  G = 'rebalance (explicit)';
  await p.evaluate(() => { const pr = Core.profile(); pr.prefs = Core.normPrefs({}); pr.nutritionDislike = []; pr.targets = { protein: 300 }; Store.save('profile'); }); /* a manual protein target the menu cannot reach → a real gap */
  const targets1 = await p.evaluate(() => JSON.stringify([Core.profile().targets, Core.profile().aims, Core.targets()]));
  await go('#/nutrition', 800); await p.locator('[data-act=swapMeal][data-slot=m2]').click(); await p.locator('.sheet [data-meal-opts]').waitFor();
  await p.locator('.sheet [data-act=sort][data-s=light]').click(); await p.waitForTimeout(250);
  /* pick the lowest-protein option so a gap appears */
  const lowId = await p.evaluate(() => { const bs = [...document.querySelectorAll('.sheet [data-opt-list] > [data-act=pick]')]; bs.sort((a, z) => +a.querySelector('.kv b').textContent - +z.querySelector('.kv b').textContent); return bs[0].dataset.id; });
  await p.locator(`.sheet [data-act=pick][data-id="${lowId}"]`).first().click(); await p.waitForTimeout(250);
  if (await p.locator('.sheet [data-rebalance]').count()) {
    const e0 = await p.evaluate(() => Core.entries(Store.today()).length), pp0 = await p.evaluate(() => Core.plannedTotals(Store.today(), 'selected').p);
    await p.locator('.sheet #sw-reb').check(); await p.locator('.sheet [data-act=ok]').click(); await p.waitForTimeout(300);
    const after = await p.evaluate(() => ({ p: Core.plannedTotals(Store.today(), 'selected').p, e: Core.entries(Store.today()).length, ok: ['m1', 'snack'].every(k => Core.conflicts(Logic.recipe(Core.plan(Store.today())[k].rid), Core.plan(Store.today())[k].ov).length === 0) }));
    ok(after.p > pp0 - 1 && after.e === e0 && after.ok, 'other meals scaled up only when asked; journal untouched; still no restricted food', { pp0, after });
  } else { ok(false, 'rebalance offered when the planned day is ≥10 g below the protein target'); await p.locator('.sheet [data-act=no]').click(); }
  ok(await p.evaluate(() => JSON.stringify([Core.profile().targets, Core.profile().aims, Core.targets()])) === targets1, 'targets still unchanged by swapping/rebalancing');

  G = 'failed write';
  const p0 = await plan(); await p.locator('[data-act=swapMeal][data-slot=snack]').click(); await p.locator('.sheet [data-meal-opts]').waitFor();
  await p.locator('.sheet [data-opt-list] [data-act=pick]').first().click(); await p.waitForTimeout(200);
  await p.evaluate(() => { window.__si = Storage.prototype.setItem; Storage.prototype.setItem = function () { throw new Error('QuotaExceeded'); }; });
  await p.locator('.sheet [data-act=ok]').click(); await p.waitForTimeout(300);
  const toast = await p.evaluate(() => [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | '));
  await p.evaluate(() => { Storage.prototype.setItem = window.__si; });
  ok(/השמירה נכשלה/.test(toast) && !/הוחלפה/.test(toast), 'storage failure → "not saved", never "replaced"', toast);
  ok((await plan()).snack === p0.snack, 'menu unchanged after the failed write');

  G = 'no targets';
  await p.evaluate(() => { const pr = Core.profile(); pr.age = null; Store.save('profile'); });
  await go('#/nutrition', 800); await p.locator('[data-act=swapMeal][data-slot=m1]').click(); await p.locator('.sheet [data-meal-opts]').waitFor();
  await p.locator('.sheet [data-opt-list] [data-act=pick]').first().click(); await p.waitForTimeout(200);
  ok(/אין יעדים/.test(await p.locator('.sheet [data-day-impact]').innerText()) && await p.locator('.sheet [data-rebalance]').count() === 0, 'missing profile data → says what is missing, no invented targets');
  await p.locator('.sheet [data-act=no]').click();
  await p.evaluate(() => { const pr = Core.profile(); pr.age = 34; Store.save('profile'); });

  G = 'Sofit → meals';
  await go('#/coach', 1200);
  const ask = async t => { await p.fill('#ask-q', t); await p.locator('[data-chat] [data-act=ask]').click(); await p.waitForTimeout(300); return p.evaluate(() => { const a = [...document.querySelectorAll('[data-ask-a]')].pop(); return a ? { id: a.dataset.askA, t: a.innerText } : null; }); };
  let a = await ask('אני רוצה ארוחה עם יותר חלבון');
  ok(a && a.id === 'meals' && /יותר חלבון/.test(a.t) && await p.locator('[data-ask-a=meals] [data-act=coachSwap]').count() >= 1, '"more protein" → protein-sorted swap actions', a);
  const sw = p.locator('[data-ask-a=meals] [data-act=coachSwap]').last(), sl = await sw.getAttribute('data-slot'), rid = await sw.getAttribute('data-rid');
  await sw.click(); await p.waitForTimeout(250);
  ok(await p.locator('.sheet [data-swap-confirm]').count() === 1, 'same preview sheet as the nutrition screen');
  ok(await p.locator('[data-ask-a=done]').count() === 0, 'no "saved" message before confirming');
  await p.locator('.sheet [data-act=ok]').click(); await p.waitForTimeout(350);
  ok(await p.evaluate(([s, r]) => Core.plan(Store.today())[s].rid === r, [sl, rid]) && await p.locator('[data-ask-a=done]').count() === 1, 'saved, then confirmed in the conversation');
  a = await ask('אין לי זמן לבשל'); ok(a && a.id === 'meals' && /מהיר להכנה/.test(a.t), '"no time to cook" → quick options', a);
  a = await ask('אני לא אוהב את המנה הזאת'); ok(a && a.id === 'meals' && await p.locator('[data-ask-a=meals] [data-act=coachDislike]').count() >= 1, '"I don\'t like this dish" → offers to mark it', a);
  const dl = p.locator('[data-ask-a=meals] [data-act=coachDislike]').last(), dSlot = await dl.getAttribute('data-slot'), dRid = await dl.getAttribute('data-rid');
  await dl.click(); await p.locator('.sheet [data-act=ok]').last().click(); await p.waitForTimeout(350);
  ok(await p.evaluate(r => (Core.profile().nutritionDislike || []).includes(r), dRid) && await p.evaluate(([s, r]) => Core.plan(Store.today())[s].rid !== r, [dSlot, dRid]), 'marked, saved, and today\'s dish replaced');
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no sideways scroll');

  G = 'errors'; ok(!errs.length, 'no JS errors', errs);
  await b.close();
  let pass = 0, fail = 0; for (const r of res) { console.log(`${r.ok ? 'PASS' : 'FAIL'} [${r.g}] ${r.m}`); r.ok ? pass++ : fail++; }
  console.log(`\nm11 meals tests: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
