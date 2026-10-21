/* M11.2 · "שאלו את Sofit": every answer must equal the app's own numbers (targets, journal, water, steps), safety words must
   route to stopping + medical help, unknown questions must not get an invented answer, nothing is stored or sent.
   Usage: [BROWSER=webkit] node tools/e2e_m11_coach.js [URL] */
const pw = require('playwright'), { devices } = pw; const ENGINE = process.env.BROWSER || 'chromium';
const URL0 = process.argv[2] || 'http://localhost:8096/';
const res = []; let G = ''; const ok = (c, m, i) => res.push({ g: G, ok: !!c, m: m + (i !== undefined && !c ? ' → ' + JSON.stringify(i).slice(0, 500) : '') });
const BASICS = () => { Store.resetAll(); localStorage.clear(); const pr = Store.load('profile'); Object.assign(pr, { age: 34, height: 176, weight: 80, startWeight: 80, sex: 'm', experience: 'beginner', aims: { primary: 'general', secondary: [] } }); Store.save('profile'); };
(async () => {
  const b = await pw[ENGINE].launch(); console.log('engine: ' + ENGINE); const errs = [];
  for (const w of [320, 390]) {
    const ctx = await b.newContext({ ...devices['iPhone 13'], viewport: { width: w, height: 760 }, locale: 'he-IL', serviceWorkers: 'block' }); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    const reqs = []; p.on('request', r => { if (!/localhost|127\.0\.0\.1|fonts\.(googleapis|gstatic)\.com/.test(r.url())) reqs.push(r.url()); });
    await p.goto(URL0); await p.waitForTimeout(700); await p.evaluate(BASICS); await p.reload(); await p.waitForTimeout(800);
    await p.evaluate(() => { const d = Store.today(); Core.eatSlot ? Core.eatSlot(d, 'm1') : null; Core.addWater(d, 750); Activity.setUserSteps(d, 4321); });
    await p.evaluate(() => { location.hash = '#/coach'; }); await p.waitForTimeout(1200);
    const ask = async q => { await p.fill('#ask-q', q); await p.locator('[data-chat] [data-act=ask]').click(); await p.waitForTimeout(250); return p.evaluate(() => { const a = [...document.querySelectorAll('[data-ask-a]')].pop(); return a ? { id: a.dataset.askA, t: a.innerText } : null; }); };
    const before = await p.evaluate(() => JSON.stringify(Object.assign({}, localStorage)));

    G = `empty state + context @${w}px`;
    ok(await p.locator('[data-ask-empty]').count() === 1, 'no conversation yet → empty-state hint');
    await p.locator('[data-coach-ctx] summary').click(); const ctxT = await p.locator('[data-coach-ctx]').innerText();
    ok(/מטרה/.test(ctxT) && /לא הוזן/.test(ctxT) && /עריכה|הוספה/.test(ctxT), '"what Sofit knows": stored values, missing ones shown as "לא הוזן", with edit links', ctxT.slice(0, 300));
    await p.locator('[data-coach-ctx] summary').click();
    G = `topics @${w}px`;
    ok(await p.locator('[data-chat=local] [data-act=askT]').count() >= 8, 'topic chips shown');
    const truth = await p.evaluate(() => { const d = Store.today(), t = Core.targets(), e = Core.eatenTotals(d); return { tp: t.protein, ep: Math.round(e.p), tk: t.kcal, ek: Math.round(e.k), w: Core.fmtL(Core.daily(d).water || 0), wg: Core.fmtL(Core.waterGoalOn(d).ml) }; });
    let a = await ask('כמה חלבון נשאר לי היום?'); ok(a && a.id === 'protein' && a.t.includes(`${truth.ep} ג׳ חלבון מתוך יעד של ${truth.tp}`), 'protein answer = journal + target', { a, truth });
    a = await ask('כמה קלוריות נשארו'); ok(a && a.id === 'kcal' && a.t.includes(`${truth.ek} קק״ל מתוך יעד של ${truth.tk}`), 'calories answer = journal + target', { a, truth });
    a = await ask('כמה מים שתיתי'); ok(a && a.id === 'water' && a.t.includes(`${truth.w} ליטר מתוך ${truth.wg}`), 'water answer = water log + goal', { a, truth });
    const w0 = await p.evaluate(() => Core.daily(Store.today()).water); await p.locator('[data-ask-a=water] [data-act=water]').click(); await p.waitForTimeout(250);
    ok(await p.evaluate(() => Core.daily(Store.today()).water) === w0 + 250, 'the action button in the answer really adds water');
    a = await ask('כמה צעדים עשיתי היום'); ok(a && a.id === 'steps' && /4,321|4321/.test(a.t) && /ידני/.test(a.t), 'steps answer = logged steps with their source label', a);
    a = await ask('מה האימון שלי היום?'); ok(a && a.id === 'workout' && (/היום:/.test(a.t) || /אין אימון|כבר נרשם/.test(a.t)), 'workout answer from today\'s plan', a);
    a = await ask('אין לי כוח היום'); ok(a && a.id === 'tired' && /בלי אשמה/.test(a.t), 'tired → short version / skip without guilt', a);
    a = await ask('איך ההתקדמות שלי?'); ok(a && a.id === 'progress', 'progress answer', a);
    await p.locator('[data-act=askT][data-t=progress]').click(); await p.waitForTimeout(250); ok(await p.locator('[data-ask-a=progress] a[href="#/progress"]').count() >= 1, 'quick-suggestion chips answer too (with links)');
    a = await ask('איפה לאכול בחוץ'); ok(a && a.id === 'food' && await p.locator('[data-ask-a=food] a[href="#/nearby"]').count() >= 1, 'eating out → nearby food', a);

    G = `real actions @${w}px`;
    const prof0 = await p.evaluate(() => JSON.stringify(Core.profile().availability));
    a = await ask('יש לי רק 20 דקות היום'); ok(a && ['tired', 'build'].includes(a.id) && /20 דקות — לפי מה שכתבת עכשיו \(לא נשמר בפרופיל\)/.test(a.t) && await p.locator('[data-ask-a] [data-act=coachRun]').last().count() === 1, 'time from the chat used for this answer only, labelled as not saved; offers to open the workout', a);
    ok(await p.evaluate(() => JSON.stringify(Core.profile().availability)) === prof0, 'profile not changed by what was said in chat');
    const want = await p.locator('[data-ask-a] [data-act=coachRun]').last().getAttribute('data-v');
    await p.locator('[data-ask-a] [data-act=coachRun]').last().click(); await p.locator('.sheet [data-run-setup]').waitFor({ timeout: 5000 });
    ok(true, 'opens the existing pre-start sheet (manual/auto mode)'); await p.locator('.sheet [data-mode=manual]').click(); await p.locator('.sheet [data-act=go]').click(); await p.waitForTimeout(400);
    const ses = await p.evaluate(() => Store.load('session')); ok(await p.locator('.run').count() === 1 && ses && ses.version === want, 'workout opens in the existing runner with the suggested version', { want, v: ses && ses.version });
    await p.evaluate(() => { Store.clearSession(); document.querySelector('.run') && document.querySelector('.run').remove(); document.body.style.overflow = ''; location.hash = '#/home'; }); await p.waitForTimeout(300); await p.evaluate(() => { location.hash = '#/coach'; }); await p.waitForTimeout(600);
    const sq = await p.evaluate(() => EX_BY_ID.squat.he), alt0 = await p.evaluate(() => EX_BY_ID[EX_BY_ID.squat.alts[0]].he);
    a = await ask('חלופה ל' + sq); ok(a && a.id === 'alt' && a.t.includes(alt0), 'alternative exercise from the library', a);
    a = await ask('איך עושים ' + sq); ok(a && a.id === 'explain' && /נשימה/.test(a.t) && await p.locator(`[data-ask-a=explain] a[href="#/ex/squat"]`).count() >= 1, 'exercise explained from the library, link to its page', a);
    a = await ask('מה זה סט וחזרות'); ok(a && a.id === 'terms' && /סט = /.test(a.t), 'sets/reps/rest explained');
    a = await ask('תתאימי לי את הארוחות'); ok(a && a.id === 'meals' && /ההעדפות שנלקחות בחשבון/.test(a.t), 'meal adjustment uses the stored preferences', a);
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'long answer buttons wrap — no sideways scroll', await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth]));
    const sw = p.locator('[data-ask-a=meals] [data-act=coachSwap]').first();
    if (await sw.count()) { const slot = await sw.getAttribute('data-slot'), rid = await sw.getAttribute('data-rid'); await sw.click(); await p.locator('.sheet [data-act=ok]').last().click();  await p.waitForTimeout(300);
      ok(await p.evaluate(([sl, r]) => Core.plan(Store.today())[sl].rid === r && Core.conflicts(Logic.recipe(r), null).length === 0, [slot, rid]), 'swap is saved in today\'s menu (same path as the nutrition screen) and respects restrictions', { slot, rid });
      ok(await p.locator('[data-ask-a=done]').count() === 1, 'confirmation shown in the conversation'); }
    else ok(/לא מצאתי חלופה/.test(a.t), 'no fitting alternative → said plainly', a);
    a = await ask('סיכום האימון האחרון'); ok(a && a.id === 'summary' && /עוד לא נרשם|האימון האחרון/.test(a.t), 'summary only from the real workout log', a);
    G = `loading + error @${w}px`;
    await p.evaluate(() => { window.__p0 = CoachAsk.provider; CoachAsk.provider = { id: 't', label: 'בדיקה', ask: q => new Promise(r => setTimeout(() => r(CoachAsk.answer(q)), 600)) }; });
    await p.fill('#ask-q', 'כמה מים שתיתי'); await p.locator('[data-chat] [data-act=ask]').click(); await p.waitForTimeout(150);
    ok(await p.locator('[data-ask-busy]').count() === 1 && await p.locator('#ask-q').isDisabled(), 'loading state while the provider answers; input locked');
    await p.waitForTimeout(700); ok(await p.locator('[data-ask-busy]').count() === 0, 'loading state cleared');
    await p.evaluate(() => { CoachAsk.provider = { id: 't', label: 'בדיקה', ask: () => Promise.reject(new Error('down')) }; });
    await p.fill('#ask-q', 'כמה מים שתיתי'); await p.locator('[data-chat] [data-act=ask]').click(); await p.waitForTimeout(200);
    ok(await p.locator('[data-ask-err]').count() === 1 && !(await p.locator('#ask-q').isDisabled()), 'provider error → clear message, input usable again');
    await p.evaluate(() => { CoachAsk.provider = window.__p0; });
    G = `safety @${w}px`;
    for (const q of ['יש לי כאב בחזה', 'סחרחורת באמצע אימון', 'קוצר נשימה', 'כמה חלבון? יש לי לחץ בחזה']) { a = await ask(q); ok(a && a.id === 'safety' && /עוצרים/.test(a.t) && /עזרה רפואית/.test(a.t) && !/אבחנה:|יש לך /.test(a.t), `"${q}" → stop + medical help, no diagnosis`, a); }

    G = `honesty @${w}px`;
    a = await ask('מי ינצח במונדיאל?'); ok(a && a.id === 'none' && /אין לי תשובה מבוססת/.test(a.t), 'off-topic → no invented answer', a);
    ok(!(await p.evaluate(() => document.querySelector('main').innerText)).match(/AI אומר|בינה מלאכותית ענתה/), 'never presented as AI');
    const after = await p.evaluate(() => JSON.stringify(Object.assign({}, localStorage)));
    const diff = Object.keys(JSON.parse(after)).filter(k => JSON.parse(after)[k] !== JSON.parse(before)[k]);
    ok(diff.every(k => ['fit30.tracking', 'fit30.nutrition', 'fit30.profile', 'fit30.session'].includes(k)) && !/כמה חלבון|מונדיאל/.test(after), 'only the explicit actions (water, meal swap, runner prefs) changed data; the conversation is not stored', diff);
    ok(!reqs.length, 'no network requests to other hosts', reqs);
    await p.reload(); await p.waitForTimeout(900); await p.evaluate(() => { location.hash = '#/coach'; }); await p.waitForTimeout(900);
    ok(await p.locator('[data-ask-a]').count() === 0, 'conversation gone after reload (memory only)');
    G = `layout @${w}px`;
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no sideways scroll');
    const r = await p.evaluate(() => { const i = document.querySelector('#ask-q').getBoundingClientRect(), bt = document.querySelector('[data-chat] [data-act=ask]').getBoundingClientRect(); return { iw: i.width, bh: bt.height, same: Math.abs(i.top - bt.top) < 20 }; });
    ok(r.iw >= 140 && r.bh >= 40 && r.same, 'input and button on one row, usable size', r);
    await ctx.close();
  }
  G = 'errors'; ok(!errs.length, 'no JS errors', errs);
  await b.close();
  let pass = 0, fail = 0; for (const r of res) { console.log(`${r.ok ? 'PASS' : 'FAIL'} [${r.g}] ${r.m}`); r.ok ? pass++ : fail++; }
  console.log(`\nm11 coach tests: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
