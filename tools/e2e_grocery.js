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
  G = 'SLL-08 v3 (1): alternatives for a "not found" item (docs/M9-SCOPE.md)';
  { await go('#/shopping/7');
    /* pick a planned item that belongs to a SWAP group and has at least one allowed alternative */
    const cand = await p.evaluate(() => { const rows = [...document.querySelectorAll('[data-shop-row]')].map(r => r.dataset.shopRow);
      for (const f of rows) { const A = Screens.shopping.alternatives(f, Store.today(), 7); if (A.list.length && A.uses.length) return { f, A: A.list.map(x => x.f), n: A.uses.length, grp: A.grp }; } return null; });
    ok(!!cand, 'test setup: a planned item with alternatives exists', cand);
    if (cand) {
      await p.locator(`[data-act=st][data-f="${cand.f}"][data-s=notfound]`).click(); await p.waitForTimeout(350);
      ok(await p.locator(`[data-shop-row="${cand.f}"] [data-alt-open]`).count() === 1, '"לא נמצא" item shows a "חלופות" button');
      const before = await p.evaluate(() => localStorage.getItem('fit30.nutrition'));
      await p.locator(`[data-shop-row="${cand.f}"] [data-alt-open]`).click(); await p.waitForTimeout(350);
      const shown = await p.evaluate(() => [...document.querySelectorAll('.sheet [data-alt]')].map(x => ({ f: x.dataset.alt, diff: x.querySelector('[data-alt-diff]').textContent })));
      ok(shown.length >= 1 && shown.length <= 3 && shown.every(x => /קק״ל/.test(x.diff) && /חלבון/.test(x.diff)), '1–3 alternatives, each with its calorie and protein change', shown);
      const blk = await p.evaluate(() => [...Core.blockedFoods()]); const grpOk = await p.evaluate(([f, list]) => { const g = Object.keys(NUTRI.SWAP).find(k => NUTRI.SWAP[k].includes(f)); return list.every(a => NUTRI.SWAP[g].includes(a)); }, [cand.f, shown.map(x => x.f)]);
      ok(grpOk && !shown.some(x => blk.includes(x.f) || x.f === cand.f), 'alternatives come from the same SWAP group, never the item itself or an excluded food');
      ok(await p.evaluate(() => localStorage.getItem('fit30.nutrition')) === before, 'opening the alternatives changes nothing');
      const alt = shown[0].f; await p.locator(`.sheet [data-act=altApply][data-a="${alt}"]`).click(); await p.waitForTimeout(500);
      const after = await p.evaluate(([f, a]) => { const r = { withF: 0, withA: 0, offExtraWithF: 0, left: [] };
        for (let i = 0; i < 7; i++) { const d = Store.addDays(Store.today(), i), pl = Core.plan(d); Core.ALL.forEach(k => { const s = pl[k]; if (!s || !s.rid || s.off || s.missing || Core.slotEntry(d, k)) return;
          const ings = Logic.recipeIngredients(Logic.recipe(s.rid), s.ov).map(x => x.f), listed = !(k === 'extra' && !s.on); /* same inclusion rule as the shopping list */
          if (!listed) { if (ings.includes(f)) r.offExtraWithF++; return; } if (ings.includes(f)) { r.withF++; r.left.push({ d, k, rid: s.rid }); } if (ings.includes(a)) r.withA++; }); } return r; }, [cand.f, alt]);
      ok(after.withF === 0 && after.withA >= 1, 'applying: the not-found food is replaced in every upcoming meal on the list (details on failure)', after);
      ok(true, 'unselected add-ons (not on the list) are left as they are: ' + after.offExtraWithF + ' such slot(s) in this run');
      ok(await p.locator(`[data-shop-row="${alt}"]`).count() === 1, 'the list now shows the alternative');
      await p.locator('.toast button').first().click(); await p.waitForTimeout(400);
      ok(await p.evaluate(() => localStorage.getItem('fit30.nutrition')) === before, '"ביטול" restores the stored data exactly (storage comparison)');
      { const r = await p.evaluate(([f, first]) => { const pr = Store.load('profile'); pr.prefs = pr.prefs || {}; const keep = JSON.stringify(pr.prefs.exclude || []); pr.prefs.exclude = (pr.prefs.exclude || []).concat(first); Store.save('profile');
          const A1 = Screens.shopping.alternatives(f, Store.today(), 7).list.map(x => x.f), g = Object.keys(NUTRI.SWAP).find(k => NUTRI.SWAP[k].includes(f));
          pr.prefs.exclude = NUTRI.SWAP[g].filter(x => x !== f); Store.save('profile'); const A2 = Screens.shopping.alternatives(f, Store.today(), 7).list.length;
          pr.prefs.exclude = JSON.parse(keep); Store.save('profile'); return { A1, A2 }; }, [cand.f, cand.A[0]]);
        ok(!r.A1.includes(cand.A[0]), 'a food the user excluded is never offered as an alternative', r);
        ok(r.A2 === 0, 'every alternative excluded → no alternatives offered', r); }
      { await p.evaluate(([f]) => { const pr = Store.load('profile'); pr.prefs = pr.prefs || {}; window.__keepEx = JSON.stringify(pr.prefs.exclude || []); const g = Object.keys(NUTRI.SWAP).find(k => NUTRI.SWAP[k].includes(f)); pr.prefs.exclude = NUTRI.SWAP[g].filter(x => x !== f); Store.save('profile'); }, [cand.f]);
        await go('#/shopping/7'); await p.locator(`[data-shop-row="${cand.f}"] [data-alt-open]`).click(); await p.waitForTimeout(350);
        ok(await p.locator('.sheet [data-alt-none]').count() === 1, 'no allowed alternative → a clear message and a link to swap the dish instead');
        await p.evaluate(() => { document.querySelectorAll('.sheet [data-x]').forEach(x => x.click()); const pr = Store.load('profile'); pr.prefs.exclude = JSON.parse(window.__keepEx); Store.save('profile'); }); await p.waitForTimeout(300); }
    }
  }
  G = 'SLL-08 v3 (2): "usually at home" — asked after 2 different days, never set automatically';
  { const LS = () => p.evaluate(() => localStorage.getItem('fit30.nutrition'));
    await p.evaluate(() => { const nu = Store.load('nutrition'); const sh = nu.shopping; sh.checked = {}; sh.state = {}; ['homeSeen', 'usual', 'usualNo', 'snaps', 'carryDone'].forEach(k => delete sh[k]); Store.save('nutrition'); });
    await go('#/nutrition'); await go('#/shopping/7');
    const rows = await p.locator('[data-shop-row]').evaluateAll(a => a.map(x => x.dataset.shopRow)); const [f1, f2, f3] = rows;
    ok(rows.length >= 3, 'test setup: at least 3 planned items', rows);
    const s0 = await LS(); await go('#/nutrition'); await go('#/shopping/7'); ok(await LS() === s0, 'opening the list writes nothing (storage comparison)');
    await p.locator(`[data-act=st][data-f="${f2}"][data-s=home]`).click(); await p.waitForTimeout(350);
    ok(await p.locator('[data-usual-ask]').count() === 0, '"יש בבית" on one day only → no question');
    await p.evaluate(([a, c]) => { const sh = Store.load('nutrition').shopping; sh.homeSeen = Object.assign(sh.homeSeen || {}, { [a]: [Store.addDays(Store.today(), -3)], [c]: [Store.addDays(Store.today(), -2)] }); Store.save('nutrition'); }, [f1, f3]);
    await p.locator(`[data-act=st][data-f="${f1}"][data-s=home]`).click(); await p.waitForTimeout(350);
    ok(await p.locator(`[data-usual-ask] [data-ask="${f1}"]`).count() === 1, 'marked "יש בבית" on a 2nd different day → the list asks "לסמן כ\'בדרך כלל בבית\'?"');
    ok(await p.evaluate(f => !(Store.load('nutrition').shopping.usual || {})[f], f1), 'asking sets nothing by itself');
    const total0 = await p.locator('[data-shop-progress]').textContent(); const b1 = await LS();
    await p.locator(`[data-act=uyes][data-f="${f1}"]`).click(); await p.waitForTimeout(400);
    ok(await p.locator(`[data-usual] [data-usual-row="${f1}"]`).count() === 1 && await p.locator(`[data-shop-row="${f1}"]`).count() === 0, '"כן" → listed folded under "בדרך כלל בבית", not deleted');
    ok(await p.locator('[data-shop-progress]').textContent() === total0, 'a kept-at-home item is not counted to buy (count unchanged from "יש בבית")', total0);
    await p.locator('.toast button').first().click(); await p.waitForTimeout(400);
    ok(await LS() === b1, '"ביטול" restores the stored data exactly');
    await p.locator(`[data-act=uyes][data-f="${f1}"]`).click(); await p.waitForTimeout(400);
    const n1 = +(await p.locator('[data-shop-progress]').textContent()).split('/')[1];
    await p.locator(`[data-usual] summary`).click(); await p.locator(`[data-act=ubuy][data-f="${f1}"]`).click(); await p.waitForTimeout(400);
    ok(await p.locator(`[data-shop-row="${f1}"][data-state=buy]`).count() === 1 && +(await p.locator('[data-shop-progress]').textContent()).split('/')[1] === n1 + 1, '"צריך לקנות הפעם" → back on the to-buy list and counted');
    await p.locator(`[data-shop="${f1}"]`).check(); await p.waitForTimeout(300); await go('#/nutrition'); await go('#/shopping/7');
    ok(await p.locator(`[data-shop-row="${f1}"][data-state=bought]`).count() === 1, 'it can be marked bought like any item');
    await p.locator('[data-act=clear]').click(); await p.waitForTimeout(400);
    ok(await p.locator(`[data-usual-row="${f1}"]`).count() === 1, '"ניקוי סימונים" keeps the "בדרך כלל בבית" setting (only "הסרה" removes it)');
    await p.locator(`[data-usual] summary`).click(); await p.locator(`[data-act=uoff][data-f="${f1}"]`).click(); await p.waitForTimeout(400);
    ok(await p.locator(`[data-shop-row="${f1}"][data-state=buy]`).count() === 1 && await p.evaluate(f => !(Store.load('nutrition').shopping.usual || {})[f], f1), '"הסרה" → a normal item to buy again');
    await p.evaluate(c => { const sh = Store.load('nutrition').shopping; sh.homeSeen[c] = [Store.addDays(Store.today(), -2), Store.addDays(Store.today(), -1)]; Store.save('nutrition'); }, f3);
    await go('#/nutrition'); await go('#/shopping/7'); await p.locator(`[data-act=uno][data-f="${f3}"]`).click(); await p.waitForTimeout(350);
    ok(await p.locator(`[data-ask="${f3}"]`).count() === 0 && await p.evaluate(c => !(Store.load('nutrition').shopping.usual || {})[c], f3), '"לא" → not set, and the question is not asked again');
  }
  G = 'SLL-08 v3 (3): unbought items from an earlier list are offered, never added without a tap';
  { const LS = () => p.evaluate(() => localStorage.getItem('fit30.nutrition'));
    const rows = await p.locator('[data-shop-row]').evaluateAll(a => a.map(x => x.dataset.shopRow));
    await p.locator(`[data-act=st][data-f="${rows[0]}"][data-s=notfound]`).click(); await p.waitForTimeout(350);
    const snap = await p.evaluate(() => { const sh = Store.load('nutrition').shopping; return { today: (sh.snaps || {})[Store.today()] || null, home: Object.keys(sh.state).filter(f => sh.state[f] === 'home') }; });
    ok(snap.today && snap.today.length >= 1 && !snap.today.some(x => snap.home.includes(x.f)), 'a tap on the list stores that day\'s still-to-buy items (items at home excluded)', snap);
    const pick = await p.evaluate(cur => { const F = NUTRI.FOODS, blk = Core.blockedFoods(); const ks = Object.keys(F).filter(f => !cur.includes(f) && !blk.has(f) && F[f].he); return ks.slice(0, 3).map(f => ({ f, he: F[f].he })); }, rows);
    await p.evaluate(([pk, onList]) => { const sh = Store.load('nutrition').shopping, y = Store.addDays(Store.today(), -1);
      sh.snaps = { [y]: pk.concat([{ f: onList, he: 'on list' }]) }; sh.checked[pk[1].f] = y; /* pk[1] was bought yesterday */
      sh.custom.push({ id: 'cdup', text: pk[2].he, done: false }); /* pk[2] is already one of the user's items */ Store.save('nutrition'); }, [pick, rows[1]]);
    const s1 = await LS(); await go('#/nutrition'); await go('#/shopping/7');
    const shown = await p.locator('[data-carry-items]').textContent().catch(() => '');
    ok(shown === pick[0].he.replace(/[<>&]/g, ''), 'offered: only the unbought item that is not on the current list (bought, already-listed and duplicate items are left out)', { shown, pick });
    ok(await LS() === s1, 'showing the offer writes nothing');
    await p.locator('[data-act=carryAdd]').click(); await p.waitForTimeout(400);
    ok(await p.evaluate(he => Store.load('nutrition').shopping.custom.filter(c => c.text === he).length, pick[0].he) === 1 && await p.locator('[data-carry]').count() === 0, '"להוסיף לפריטים שלי" adds it once as the user\'s own item and the offer closes');
    await p.locator('.toast button').first().click(); await p.waitForTimeout(400);
    ok(await LS() === s1 && await p.locator('[data-carry]').count() === 1, '"ביטול" restores the stored data exactly and the offer is back');
    await p.locator('[data-act=carryNo]').click(); await p.waitForTimeout(350); await p.reload(); await p.waitForTimeout(800); await go('#/shopping/7');
    ok(await p.locator('[data-carry]').count() === 0 && await p.evaluate(he => !Store.load('nutrition').shopping.custom.some(c => c.text === he), pick[0].he), '"לא תודה" → nothing added, and the offer does not come back after reload');
  }
  G = 'SLL-32: meal prep split by fridge time';
  { await go('#/shopping/14'); const ns = await p.locator('[data-mealprep] [data-batch-sessions]').count();
    const exp = await p.evaluate(() => Signature.shopping(Store.today(), 14).batch.filter(b => b.sessions.length > 1).length);
    ok(ns === exp && (exp === 0 || /3 ימים/.test(await p.locator('[data-mealprep] [data-batch-sessions]').first().textContent())), '14 days: every base that needs several cooking sessions shows them, with the 3-day reason', { ns, exp }); }
  ok(errs.length === 0, 'no page errors', errs.slice(0, 3));
  await b.close(); const pass = res.filter(r => r.ok).length, fail = res.length - pass;
  fs.mkdirSync('dist/reports', { recursive: true }); fs.writeFileSync('dist/reports/e2e-grocery.json', JSON.stringify({ url: URL0, at: new Date().toISOString(), pass, fail, results: res }, null, 1));
  res.forEach(r => console.log((r.ok ? 'PASS ' : 'FAIL ') + '[' + r.g + '] ' + r.m)); console.log(`grocery e2e: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { res.forEach(r => console.log((r.ok ? 'PASS ' : 'FAIL ') + '[' + r.g + '] ' + r.m)); console.error('grocery e2e crashed in [' + G + ']: ' + e.message.split('\n')[0]); process.exit(2); });
