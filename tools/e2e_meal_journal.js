/* RC5 meal-journal regression (P0-A..D). Playwright Chromium, iPhone 13 emulation — NOT Safari, NOT a real device.
   Checks the journal UI against what is actually stored:
   A  fresh day: neutral "סמן שאכלתי" buttons (no green, no ✓), nothing stored, nothing shown as eaten
   A  mark → "נאכל ✓"; repeated taps on save → one record; reload / new tab / offline (service worker) keep the state
   A  undo from the toast and "ביטול סימון" (+ its undo) restore the exact previous records and totals
   B  "מזון נוסף ← ממתכון" and the recipe page's "רישום כנאכל היום" ask before adding a recipe already in the day's journal;
      "לא להוסיף" adds nothing; "כן, אכלתי מנה נוספת" adds one record marked repeat; a recipe not yet logged adds directly
   C  adjusted-portion label uses the new wording; the old wording is gone
   D  time label = the recipe's own prep/cook numbers
   Usage: node tools/e2e_meal_journal.js [URL]  — needs the PWA served (default http://localhost:8096/) */
const { chromium, devices } = require('playwright'); const fs = require('fs'), path = require('path');
const URL0 = process.argv[2] || 'http://localhost:8096/';
const res = []; let G = ''; const ok = (c, m, i) => res.push({ g: G, ok: !!c, m: m + (i !== undefined && !c ? ' → ' + JSON.stringify(i).slice(0, 300) : '') });
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'he-IL' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const go = async h => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(400); };
  const next = async () => { await p.locator('[data-act=next]').click(); await p.waitForTimeout(350); };
  await p.goto(URL0); await p.waitForTimeout(800); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(700);
  await go('#/setup/1'); await p.fill('#pf-age', '34'); await p.fill('#pf-h', '172'); await p.fill('#pf-w', '78'); await p.locator('[data-act=xp][data-v=beginner]').click(); await p.waitForTimeout(250); await next();
  await p.locator('[data-act=gp][data-v=general]').click(); await p.waitForTimeout(200); await next();
  for (const d of [1, 3, 5]) { await p.locator(`[data-act=dw][data-v="${d}"]`).click(); await p.waitForTimeout(120); }
  await p.locator('[data-act=ses][data-v="3"]').click(); await p.waitForTimeout(150); await p.selectOption('#pf-pref', '30'); await p.selectOption('#pf-max', '45'); await next();
  await p.locator('[data-act=tpl][data-v=general_90]').click(); await p.waitForTimeout(200); await next(); await next(); await next(); await p.waitForTimeout(400);
  const today = await p.evaluate(() => Store.today());
  const stored = () => p.evaluate(d => Core.entries(d).map(e => ({ id: e.id, slot: e.slot, rid: e.rid, k: e.k, repeat: !!e.repeat })), today);
  const sumK = async () => (await stored()).reduce((a, e) => a + e.k, 0);

  G = 'A · fresh day is neutral';
  await go('#/nutrition');
  const btns = await p.evaluate(() => [...document.querySelectorAll('[data-act=eat]')].map(x => ({ t: x.textContent.trim(), good: x.classList.contains('good'), svg: !!x.querySelector('svg'), pressed: x.getAttribute('aria-pressed') })));
  ok(btns.length >= 3, 'eat buttons rendered for the planned meals', btns.length);
  ok(btns.every(x => x.t === 'סמן שאכלתי'), 'every unconsumed meal says "סמן שאכלתי"', btns.map(x => x.t));
  ok(btns.every(x => !x.good && !x.svg), 'no green style and no ✓ icon before marking', btns);
  ok(btns.every(x => x.pressed === 'false'), 'aria-pressed="false" before marking');
  ok((await stored()).length === 0 && await p.locator('[data-eaten]').count() === 0, 'nothing stored and nothing shown as eaten');
  ok(!/אכלתי<\/button>/.test(await p.content()) || btns.every(x => x.t !== 'אכלתי'), 'old "אכלתי" button label gone');

  G = 'A · mark, repeated taps, persistence';
  await p.locator('[data-act=eat][data-slot=m1]').click(); await p.waitForTimeout(300);
  const save = p.locator('.sheet [data-act=ok]'); await save.click(); await save.click({ timeout: 600 }).catch(() => {}); await save.click({ timeout: 600 }).catch(() => {}); await p.waitForTimeout(400);
  let st = await stored();
  ok(st.length === 1 && st[0].slot === 'm1', 'three taps on save → exactly one record for the meal', st);
  const pill = (await p.locator('[data-eaten]').allInnerTexts()).join('|');
  ok(/^נאכל ✓/.test(pill), 'eaten meal shows "נאכל ✓"', pill);
  ok(await p.locator('[data-act=eat][data-slot=m1]').count() === 0 && await p.locator('[data-act=uneat][data-slot=m1]').count() === 1, 'eaten meal offers "ביטול סימון" instead of the mark button');
  ok(await p.locator('.toast [data-toast-act]').count() === 1, 'toast offers an undo action');
  await p.locator('[data-act=eat][data-slot=m2]').click(); await p.waitForTimeout(300); await p.locator('.sheet [data-act=p][data-p="50"]').click(); await p.locator('.sheet [data-act=ok]').click(); await p.waitForTimeout(400);
  ok(/נאכל ✓ · 50%/.test((await p.locator('[data-eaten]').allInnerTexts()).join('|')), 'partial portion shown as "נאכל ✓ · 50%"');
  const before = await stored(); const kBefore = await sumK();
  await p.reload(); await p.waitForTimeout(800); await go('#/nutrition');
  ok(JSON.stringify(await stored()) === JSON.stringify(before) && await p.locator('[data-eaten]').count() === 2, 'after reload: same records, both meals still shown as eaten');
  const p2 = await ctx.newPage(); await p2.goto(URL0 + '#/nutrition'); await p2.waitForTimeout(900);
  ok(await p2.locator('[data-eaten]').count() === 2 && await p2.locator('[data-act=eat][data-slot=m1]').count() === 0, 'new tab shows the same eaten state'); await p2.close();
  const swOn = await p.evaluate(async () => { if (!navigator.serviceWorker) return false; await navigator.serviceWorker.ready; return !!navigator.serviceWorker.controller; });
  if (swOn) { await ctx.setOffline(true); await p.reload(); await p.waitForTimeout(900); await go('#/nutrition');
    ok(await p.locator('[data-eaten]').count() === 2 && (await stored()).length === 2, 'offline reload (service worker): eaten state kept'); await ctx.setOffline(false); }
  else ok(false, 'service worker controls the page (needed for the offline check)');

  G = 'A · undo and unmark';
  await p.locator('[data-act=uneat][data-slot=m2]').click(); await p.waitForTimeout(300);
  ok((await stored()).length === 1 && await p.locator('[data-act=eat][data-slot=m2]').count() === 1, '"ביטול סימון" removes the record and shows the neutral button again');
  await p.locator('.toast [data-toast-act]').click(); await p.waitForTimeout(350);
  ok(JSON.stringify(await stored()) === JSON.stringify(before) && await sumK() === kBefore, 'undo of "ביטול סימון" restores the same record (same id, same calories)');
  await p.locator('[data-act=eat][data-slot=snack]').click(); await p.waitForTimeout(300); await p.locator('.sheet [data-act=ok]').click(); await p.waitForTimeout(350);
  ok((await stored()).length === 3, 'snack marked'); await p.locator('.toast [data-toast-act]').click(); await p.waitForTimeout(350);
  ok(JSON.stringify(await stored()) === JSON.stringify(before) && await sumK() === kBefore, 'undo of marking removes only the new record; totals back to before');
  await go('#/'); const homeCheck = p.locator('button.check[data-act=eat][data-slot=snack]');
  ok(await homeCheck.getAttribute('aria-pressed') === 'false', 'home: unconsumed meal check is not pressed');
  await homeCheck.click(); await p.waitForTimeout(350); ok((await stored()).length === 3 && await p.locator('button.check[data-slot=snack]').getAttribute('aria-pressed') === 'true', 'home: tap marks the meal');
  await p.locator('.toast [data-toast-act]').click(); await p.waitForTimeout(350); ok(JSON.stringify(await stored()) === JSON.stringify(before), 'home: undo restores the journal exactly');

  G = 'B · same recipe through other paths';
  await go('#/nutrition'); const m1rid = (await stored()).find(e => e.slot === 'm1').rid;
  const addRecipe = async rid => { await p.locator('[data-act=addFood]').click(); await p.waitForTimeout(250); await p.locator('.sheet [data-act=m][data-m=recipe]').click(); await p.waitForTimeout(200); await p.selectOption('#rc-r', rid); await p.locator('#rc-ok').click(); await p.waitForTimeout(350); };
  await addRecipe(m1rid);
  ok(await p.locator('[data-dup-warning]').count() === 1, 'adding a recipe already eaten today asks first');
  await p.locator('.sheet [data-act=no]').click(); await p.waitForTimeout(250);
  ok(JSON.stringify(await stored()) === JSON.stringify(before), '"לא להוסיף" adds nothing');
  await addRecipe(m1rid); await p.locator('.sheet [data-act=again]').click(); await p.waitForTimeout(300);
  st = await stored(); ok(st.length === 3 && st.filter(e => e.rid === m1rid).length === 2 && st.find(e => e.rid === m1rid && !e.slot).repeat, '"כן, אכלתי מנה נוספת" adds one second serving, marked as intentional', st);
  await p.locator('.toast [data-toast-act]').click(); await p.waitForTimeout(300); ok(JSON.stringify(await stored()) === JSON.stringify(before), 'undo removes the extra serving');
  const fresh = await p.evaluate(ids => NUTRI.RECIPES.find(r => !ids.includes(r.id) && !r.est).id, (await stored()).map(e => e.rid));
  await addRecipe(fresh); ok(await p.locator('[data-dup-warning]').count() === 0 && (await stored()).length === 3, 'a recipe not yet in the journal is added directly (no prompt)');
  await p.locator('.toast [data-toast-act]').click(); await p.waitForTimeout(300);
  await go('#/recipe/' + m1rid); await p.locator('[data-act=logNow]').click(); await p.waitForTimeout(350);
  ok(await p.locator('[data-dup-warning]').count() === 1, 'recipe page "רישום כנאכל היום" also asks when the recipe is already logged');
  await p.locator('.sheet [data-act=no]').click(); await p.waitForTimeout(250); ok(JSON.stringify(await stored()) === JSON.stringify(before), 'and adds nothing on "לא להוסיף"');

  G = 'C/D · wording and time labels';
  await go('#/nutrition'); const html = await p.content();
  ok(!/כמויות מותאמות ליעדים שלך|כמות מותאמת ליעד היומי/.test(html), 'old adjusted-portion wording is gone');
  const adj = await p.locator('[data-adjusted]').allInnerTexts();
  ok(adj.length > 0 && adj.every(t => t === 'כמות המנה חושבה בהתאם לתכנון התזונתי היומי'), 'adjusted-portion label uses the new wording', adj);
  const times = await p.evaluate(() => [...document.querySelectorAll('.slot')].filter(s => s.querySelector('[data-time]')).map(s => ({ t: s.querySelector('[data-time]').textContent, href: (s.querySelector('a[href^="#/recipe/"]') || {}).getAttribute && s.querySelector('a[href^="#/recipe/"]').getAttribute('href') })));
  const chk = await p.evaluate(ts => ts.map(x => { const id = x.href.split('/')[2]; const r = Logic.recipe(id); const exp = !r.prep && !r.cook ? null : !r.cook ? `${r.prep} דקות הכנה · בלי בישול` : !r.prep ? `${r.cook} דקות בישול` : `${r.prep + r.cook} דקות בסך הכול · ${r.prep} דקות הכנה + ${r.cook} דקות בישול`; return { ok: exp === null || x.t.includes(exp), t: x.t, exp }; }), times);
  ok(chk.length > 0 && chk.every(x => x.ok), 'meal-card time label equals the recipe\'s prep + cook data', chk);
  G = 'flex meal';
  /* go to the first upcoming day on which the flex meal is offered, mark its second meal through the UI, then open the flex sheet */
  const fd = await p.evaluate(t => { for (let i = 0; i < 30; i++) { const d = Store.addDays(t, i); const n = Core.programDay(d); if (n >= 1 && n <= 30 && NUTRI.FLEX_DAYS.includes(n) && !Core.locked(d)) return d; } return null; }, today);
  if (fd) { await go('#/nutrition/' + fd); if (await p.locator('[data-act=eat][data-slot=m2]').count()) { await p.locator('[data-act=eat][data-slot=m2]').click(); await p.waitForTimeout(250); await p.locator('.sheet [data-act=ok]').click(); await p.waitForTimeout(350); } }
  const flexBtn = p.locator('[data-act=flex]');
  if (await flexBtn.count()) { await flexBtn.click(); await p.waitForTimeout(250); await p.locator('.sheet [data-act=pick]').first().click(); await p.waitForTimeout(250);
    ok(await p.locator('[data-flex-m2]').count() === 1, 'flex meal warns that the eaten second meal will also count'); await p.keyboard.press('Escape'); }
  else console.log('SKIP [flex meal] not offered on this date — warning not exercised (no result recorded)');

  ok(errs.length === 0, 'no page errors', errs.slice(0, 3));
  await b.close();
  const pass = res.filter(r => r.ok).length, fail = res.length - pass;
  fs.mkdirSync('dist/reports', { recursive: true }); fs.writeFileSync('dist/reports/e2e-meal-journal.json', JSON.stringify({ url: URL0, at: new Date().toISOString(), pass, fail, results: res }, null, 1));
  res.forEach(r => console.log((r.ok ? 'PASS ' : 'FAIL ') + '[' + r.g + '] ' + r.m));
  console.log(`meal journal e2e: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { res.forEach(r => console.log((r.ok ? 'PASS ' : 'FAIL ') + '[' + r.g + '] ' + r.m)); console.error('meal journal e2e crashed in [' + G + ']: ' + e.message.split('\n')[0]); process.exit(2); });
