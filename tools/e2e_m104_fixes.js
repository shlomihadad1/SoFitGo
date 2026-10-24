/* M10.4 · three beta fixes: (1) cuisine preferences wired into the menu, (2) "אוכל בקרבתי" (location only on tap, manual
   fallback, nothing stored, no in-app fake results), (3) the settings sticky stack (header + section index) and the bottom tab
   bar never cover a field or a heading. Playwright Chromium with device emulation — NOT Safari, NOT a real iPhone.
   Usage: [BROWSER=webkit] node tools/e2e_m104_fixes.js [URL] */
const pw = require('playwright'), { devices } = pw; const ENGINE = process.env.BROWSER || 'chromium'; /* BROWSER=webkit → Playwright WebKit (Safari's engine, still NOT Safari) */
const URL0 = process.argv[2] || 'http://localhost:8096/';
const res = []; let G = ''; const ok = (c, m, i) => res.push({ g: G, ok: !!c, m: m + (i !== undefined && !c ? ' → ' + JSON.stringify(i).slice(0, 500) : '') });
const BASICS = () => { Store.resetAll(); localStorage.clear(); const pr = Store.load('profile'); Object.assign(pr, { age: 34, height: 176, weight: 80, startWeight: 80, sex: 'm', experience: 'beginner', aims: { primary: 'general', secondary: [] } }); Store.save('profile'); };
(async () => {
  const b = await pw[ENGINE].launch(); console.log('engine: ' + ENGINE); const allErrs = [];
  const mk = async (w, h, extra) => { const ctx = await b.newContext({ ...devices['iPhone 13'], viewport: { width: w, height: h || 844 }, locale: 'he-IL', serviceWorkers: 'block', ...(extra || {}) }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); return { ctx, p, errs }; };
  const go = async (p, h, ms) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(ms || 500); };
  const boot = async (p) => { await p.goto(URL0); await p.waitForTimeout(700); await p.evaluate(BASICS); await p.reload(); await p.waitForTimeout(800); };

  /* ── 1 · cuisine preferences ── */
  let { ctx, p, errs } = await mk(390); await boot(p);
  G = 'cuisine: settings UI + persistence';
  await go(p, '#/settings', 700);
  await p.locator('[data-cuisine] [data-fp=cu]').first().waitFor({ timeout: 5000 });
  ok(await p.locator('[data-cuisine] [data-fp=cu]').count() === 6, 'six cuisine choices (Israeli, Mediterranean, Western, Indian, Asian, international mix)');
  const week = () => p.evaluate(() => { const out = []; const d0 = Store.today(); for (let i = 0; i < 7; i++) { const d = Store.addDays(d0, i); const pl = Core.plan(d);
    Core.DAY.forEach(k => { const s = pl[k]; if (s && s.rid) out.push({ d, k, rid: s.rid, cu: Core.cuisineOf(Logic.recipe(s.rid)), auto: s.auto, miss: !!s.cuisineMiss, conf: Core.conflicts(Logic.recipe(s.rid), s.ov).length }); }); } return out; });
  const before = await week(); const indBefore = before.filter(x => ['indian', 'himachali'].includes(x.cu)).length;
  ok(await p.locator('[data-cuisine] [aria-pressed=true]').count() === 0, 'nothing stored as a choice until the user chooses');
  await p.click('[data-fp=cu][data-v=israeli]'); await p.waitForTimeout(300); await p.click('[data-fp=cu][data-v=mediterranean]'); await p.waitForTimeout(300); await p.selectOption('[data-fp=main]', 'israeli'); await p.waitForTimeout(500); /* saved live — one state for chips and favourite */
  const pf = await p.evaluate(() => Core.normPrefs(Core.profile().prefs));
  ok(JSON.stringify(pf.cuisines) === '["israeli","mediterranean"]' && pf.cuisineMain === 'israeli', 'saved to the profile', pf);
  await p.reload(); await p.waitForTimeout(900); await go(p, '#/settings', 700); await p.locator('[data-cuisine] [data-fp=cu]').first().waitFor({ timeout: 5000 });
  ok((await p.locator('[data-cuisine] [aria-pressed=true]').evaluateAll(es => es.map(e => e.dataset.v))).join() === 'israeli,mediterranean' && await p.inputValue('[data-fp=main]') === 'israeli', 'still selected after a reload');
  G = 'cuisine: changes the menu';
  const isr = await week(); const allowed = ['israeli', 'middle_eastern', 'moroccan', 'mediterranean', 'greek', 'italian'];
  const isrOk = isr.filter(x => allowed.includes(x.cu)).length, miss = isr.filter(x => !allowed.includes(x.cu));
  ok(indBefore === 0, 'P0: no choice → default Israeli/Mediterranean/Western, NO Indian dishes in the week', { indBefore, n: before.length, cu: before.map(x => x.cu) });
  ok(before.every(x => ['israeli', 'middle_eastern', 'moroccan', 'mediterranean', 'greek', 'italian', 'american', 'international', 'mexican'].includes(x.cu) || x.miss), 'every default dish is from the default cuisines (or flagged)', before.filter(x => !x.miss).map(x => x.cu));
  ok(before.every(x => x.conf === 0), 'default menu respects restrictions');
  ok(isrOk >= Math.ceil(isr.length * 0.8), 'Israeli + Mediterranean chosen: ≥80% of the week\'s meals are from those cuisines', { isrOk, n: isr.length, miss: miss.slice(0, 5) });
  ok(miss.every(x => x.miss), 'every remaining other-cuisine dish is flagged to the user (no silent fallback)', miss.filter(x => !x.miss).slice(0, 5));
  ok(isr.every(x => x.conf === 0), 'no meal conflicts with restrictions');
  await go(p, '#/nutrition', 800);
  ok(await p.locator('[data-cuisine-swap], [data-cuisine-miss]').count() >= 1 || await p.evaluate(() => { const pl = Core.plan(Store.today()), pf = Core.normPrefs(Core.profile().prefs); return pl.source === 'auto' && ['m1', 'm2', 'snack'].filter(k => pl[k].rid).every(k => Core.cuisineAllowed(Logic.recipe(pl[k].rid), pf)); }), 'today\'s menu follows the chosen cuisine (built for it, or a changed dish is labelled)');
  ok(await p.locator('[data-cuisine-prompt]').count() === 0, 'no "choose a cuisine" prompt once chosen');
  /* Indian only → menu is Indian */
  await p.evaluate(() => { const pr = Core.profile(); pr.prefs = Object.assign(Core.normPrefs(pr.prefs), { cuisines: ['indian'] }); delete pr.prefs.cuisineMain; Store.save('profile'); });
  const ind = await week(); ok(ind.filter(x => ['indian', 'himachali'].includes(x.cu)).length >= Math.ceil(ind.length * 0.8), 'Indian chosen: ≥80% Indian', ind.map(x => x.cu));
  G = 'cuisine: nutrition kept';
  const tot = () => p.evaluate(() => { const ks = [], ps = []; for (let i = 0; i < 14; i++) { const d = Store.addDays(Store.today(), i), t = Core.plannedTotals(d, 'base'); ks.push(t.k); ps.push(t.p); } const a = x => Math.round(x.reduce((q, w) => q + w, 0) / x.length); return { k: a(ks), p: a(ps), minP: Math.min(...ps) }; });
  await p.evaluate(() => { const pr = Core.profile(); pr.prefs = Object.assign(Core.normPrefs(pr.prefs), { cuisines: ['international'] }); Store.save('profile'); Core.applyPrefs(pr.prefs); }); /* same path as saving in settings */
  const allC = await tot();
  await p.evaluate(() => { const pr = Core.profile(); const pf = Core.normPrefs(pr.prefs); delete pf.cuisines; delete pf.cuisineMain; pr.prefs = pf; Store.save('profile'); Core.applyPrefs(pf); });
  const defC = await tot();
  ok(Math.abs(defC.k - allC.k) <= allC.k * 0.08 && defC.p >= allC.p * 0.9, 'default-cuisine menu keeps calories (±8%) and protein (≥90%) of the original menu', { allC, defC });
  ok(await p.evaluate(() => { const ws = []; for (let i = 0; i < 7; i++) { const pl = Core.plan(Store.addDays(Store.today(), i)); Core.DAY.forEach(k => { if (pl[k] && pl[k].auto === 'cuisine') ws.push(pl[k].scale); }); } return ws.every(x => x >= 0.6 && x <= 1.8); }), 'replacements are portion-sized within 0.6–1.8×');
  G = 'cuisine: international = everything';
  await p.evaluate(() => { const pr = Core.profile(); pr.prefs = Object.assign(Core.normPrefs(pr.prefs), { cuisines: ['international'] }); Store.save('profile'); Core.applyPrefs(pr.prefs); }); /* same path as saving in settings */
  { const w = await week(); ok(w.filter(x => ['indian', 'himachali'].includes(x.cu)).length >= 2 && new Set(w.map(x => x.cu)).size >= 5, '"מגוון בינלאומי" chosen → dishes from the whole library (Indian included, ≥5 cuisines a week)', { ind: w.filter(x => ['indian', 'himachali'].includes(x.cu)).length, cu: [...new Set(w.map(x => x.cu))] }); }
  G = 'cuisine: location/travel do not decide';
  await p.evaluate(() => { const pr = Core.profile(); const pf = Core.normPrefs(pr.prefs); delete pf.cuisines; pr.prefs = pf; pr.travel = { dest: 'Manali', from: Store.today(), to: Store.addDays(Store.today(), 5), minutes: null, eq: [] }; Store.save('profile'); });
  ok((await week()).filter(x => ['indian', 'himachali'].includes(x.cu)).length === 0, 'a trip to Manali does not switch the menu to Indian');
  await p.evaluate(() => { const pr = Core.profile(); pr.travel = {}; Store.save('profile'); });
  G = 'cuisine: restrictions always win';
  await p.evaluate(() => { const pr = Core.profile(); pr.prefs = Object.assign(Core.normPrefs(pr.prefs), { cuisines: ['israeli'], dairy: false, egg: false, glutenFree: true }); Store.save('profile'); });
  const strict = await week();
  ok(strict.length > 0 && strict.every(x => x.conf === 0), 'Israeli + no dairy/eggs/gluten: zero meals with a restricted food (cuisine never overrides an allergy)', strict.filter(x => x.conf).slice(0, 5));
  G = 'cuisine: dislikes';
  const firstRid = (await week()).find(x => x.k === 'm1').rid;
  await p.evaluate(rid => { const pr = Core.profile(); pr.nutritionDislike = [rid]; Store.save('profile'); }, firstRid);
  const afterDis = await week(); ok(!afterDis.some(x => x.rid === firstRid), 'a dish marked "לא אוהב/ת" is not offered', firstRid);
  G = 'cuisine: no choice → prompt';
  await p.evaluate(() => { const pr = Core.profile(); pr.prefs = Core.normPrefs({}); pr.nutritionDislike = []; Store.save('profile'); });
  await go(p, '#/settings', 400); await go(p, '#/nutrition', 800);
  ok(await p.locator('[data-cuisine-prompt]').count() === 1 && /ישראלי, ים־תיכוני ומערבי/.test(await p.locator('[data-cuisine-prompt]').innerText()), 'no choice → the screen says which default cuisines are used');
  ok(await p.locator('[data-nearby-link]').count() === 1, 'an explicit "מצא אוכל בקרבתי" entry on the nutrition screen');
  allErrs.push(...errs); await ctx.close();

  /* ── 2 · אוכל בקרבתי ── */
  G = 'near: location only after a tap';
  ({ ctx, p, errs } = await mk(390, 844, { permissions: ['geolocation'], geolocation: { latitude: 32.08531, longitude: 34.78174 } }));
  await p.addInitScript(() => { window.__geoCalls = 0; const g = navigator.geolocation; const orig = g.getCurrentPosition.bind(g); g.getCurrentPosition = (...a) => { window.__geoCalls++; return orig(...a); }; g.watchPosition = () => { window.__geoCalls += 100; return 0; }; });
  await boot(p);
  await p.evaluate(() => { const pr = Core.profile(); pr.prefs = Object.assign(Core.normPrefs(pr.prefs), { cuisines: ['asian'] }); Store.save('profile'); });
  const snap = () => p.evaluate(() => { const o = []; for (let i = 0; i < 14; i++) { const d = Store.addDays(Store.today(), i), pl = Core.plan(d); ['m1', 'm2', 'snack', 'extra'].forEach(k => o.push(d + k + ':' + (pl[k].rid || '-') + JSON.stringify(pl[k].ov || null))); } return JSON.stringify(o) + localStorage.getItem(Object.keys(localStorage).find(k => /nutrition/.test(k)) || '') ; });
  const menu0 = await snap();
  await go(p, '#/nutrition', 600); await go(p, '#/home', 400);
  ok(await p.evaluate(() => window.__geoCalls) === 0, 'no location request on app start or on the nutrition screen');
  await go(p, '#/nearby', 1200);
  ok(await p.locator('[data-nearby]').count() === 1, 'screen loads (on demand, extra.js)');
  ok(await p.evaluate(() => window.__geoCalls) === 0, 'opening the screen does not ask for location');
  ok(/אין כרגע ב־SoFitGo שירות נתוני מסעדות/.test(await p.locator('[data-nearby]').innerText()), 'states honestly that there is no restaurant-data service');
  ok(await p.locator('[data-near-links]').count() === 0, 'no results before the user acts (nothing fake)');
  await p.selectOption('#near-kind', 'israeli'); await p.click('[data-act=nearGeo]'); await p.waitForTimeout(900);
  ok(await p.evaluate(() => window.__geoCalls) === 1, 'exactly one location request, after the tap');
  const href = await p.getAttribute('[data-near-google]', 'href'), osm = await p.getAttribute('[data-near-osm]', 'href');
  ok(href && href.startsWith('https://www.google.com/maps/search/?api=1&query=') && /32\.09%2C34\.78|32\.09,34\.78/.test(href) && /israeli/.test(href), 'Google Maps search link with coordinates rounded to ~1 km', href);
  ok(osm && osm.startsWith('https://www.openstreetmap.org/search?query='), 'OpenStreetMap link', osm);
  ok(/נפתחים אצל ספק חיצוני/.test(await p.locator('[data-near-external]').innerText()) && /אתר חיצוני/.test(await p.getAttribute('[data-near-google]', 'aria-label')), 'the user is told the links open at an external provider (text + accessible label)');
  ok(await p.getAttribute('[data-near-google]', 'rel') === 'noopener noreferrer', 'external links open with noopener/noreferrer');
  const stored = await p.evaluate(() => JSON.stringify(Object.assign({}, localStorage)) + JSON.stringify(Object.assign({}, sessionStorage)));
  ok(!/32\.0[89]|34\.78/.test(stored), 'no coordinates in localStorage/sessionStorage');
  ok(await snap() === menu0, 'the menu (14 days, every slot and portion) and the stored nutrition data are unchanged by the location search');
  ok(JSON.stringify(await p.evaluate(() => Core.normPrefs(Core.profile().prefs).cuisines)) === '["asian"]', 'cuisine preferences unchanged by location (Asian stays Asian, Israeli search does not change it)');
  allErrs.push(...errs); await ctx.close();

  G = 'near: permission denied → manual city';
  ({ ctx, p, errs } = await mk(390));
  await p.addInitScript(() => { navigator.geolocation.getCurrentPosition = (s, e) => setTimeout(() => e({ code: 1, message: 'denied' }), 50); });
  await boot(p); await go(p, '#/nearby', 1200);
  await p.click('[data-act=nearGeo]'); await p.waitForTimeout(500);
  ok(/ההרשאה למיקום נדחתה/.test(await p.locator('[data-near-status]').innerText()), 'clear denied message');
  ok(await p.locator('[data-near-links]').count() === 0, 'no results shown on denial');
  await p.click('[data-act=nearCity]'); await p.waitForTimeout(300);
  ok(await p.locator('[data-near-links]').count() === 0, 'empty city → no search (asks for a city)');
  await p.fill('#near-city', 'חיפה'); await p.click('[data-act=nearCity]'); await p.waitForTimeout(400);
  const h2 = await p.getAttribute('[data-near-google]', 'href'); ok(await p.evaluate(() => !Object.keys(localStorage).some(k => /near|geo|loc/i.test(k))), 'no location-related storage key'); ok(h2 && h2.includes(encodeURIComponent('חיפה')), 'manual city builds the search link', h2);
  ok(!/חיפה/.test(await p.evaluate(() => JSON.stringify(Object.assign({}, localStorage)))), 'the city is not stored either');
  allErrs.push(...errs); await ctx.close();

  G = 'near: browser without geolocation';
  ({ ctx, p, errs } = await mk(390)); await p.addInitScript(() => { Object.defineProperty(navigator, 'geolocation', { get: () => undefined }); });
  await boot(p); await go(p, '#/nearby', 1200);
  ok(await p.locator('[data-near-nogeo]').count() === 1 && await p.locator('[data-act=nearGeo]').count() === 0, 'no location button; manual field offered');
  allErrs.push(...errs); await ctx.close();

  /* ── 3 · sticky header/index and the bottom tab bar never cover fields or headings ── */
  for (const [w, h, dev] of [[320, 568, 'iPhone SE (1st gen) width'], [375, 667, 'iPhone 8/SE'], [390, 844, 'iPhone 13/14'], [430, 932, 'iPhone 15 Pro Max'], [820, 1180, 'iPad Air (tablet)']]) {
    ({ ctx, p, errs } = await mk(w, h)); await boot(p);
    for (const scr of ['#/settings', '#/profile']) {
      G = `overlap [${scr} @${w}px ${dev}]`;
      await go(p, scr, 1300); await p.evaluate(() => { document.documentElement.dataset.motion = 'reduce'; });
      /* headings via the section index chips */
      const nChips = await p.locator('[data-sec-index] a').count(); const badH = [];
      for (let i = 0; i < nChips; i++) { await p.locator('[data-sec-index] a').nth(i).click(); await p.waitForTimeout(350);
        const r = await p.evaluate(i => { const sec = document.querySelectorAll('#view section.card[id]')[i], hd = sec && sec.querySelector('h2,h3'); if (!hd) return null; const a = hd.getBoundingClientRect(), x = a.left + Math.min(a.width - 2, 20), y = a.top + a.height / 2; const hit = document.elementFromPoint(Math.max(1, x), y);
          const ix = document.querySelector('[data-sec-index]'), top = document.getElementById('top'); return { t: hd.textContent.trim().slice(0, 24), top: Math.round(a.top), stack: Math.round(Math.max(top.getBoundingClientRect().bottom, ix ? ix.getBoundingClientRect().bottom : 0)), hitOk: !!hit && (hd.contains(hit) || hit.contains(hd)), atEnd: Math.ceil(scrollY + innerHeight) >= document.documentElement.scrollHeight - 2 }; }, i);
        if (r && (!r.hitOk || r.top < r.stack - 1)) badH.push(r); }
      ok(nChips >= 5 || scr === '#/profile', 'section index present', nChips);
      ok(!badH.length, 'every section heading lands below the sticky header + index (not covered)', badH);
      /* every field: focus → visible, not under the header/index, not under the bottom tab bar */
      const ids = await p.evaluate(() => [...document.querySelectorAll('#view input:not([type=hidden]):not([type=file]), #view select, #view textarea')].filter(e => e.offsetParent).map((e, i) => { if (!e.id) e.id = '__f' + i; return '#' + e.id; }));
      const bad = [];
      for (const s of ids) { await p.focus(s); await p.waitForTimeout(260);
        const r = await p.evaluate(sel => { const el = document.querySelector(sel); const t = el.type === 'checkbox' || el.type === 'radio' ? (el.closest('label') || el) : el; const a = t.getBoundingClientRect(); const x = a.left + a.width / 2, y = a.top + Math.min(a.height / 2, 14);
          const hit = document.elementFromPoint(x, y), lab = el.closest('label'); const nav = document.querySelector('.nav'), nb = nav && getComputedStyle(nav).display !== 'none' ? nav.getBoundingClientRect().top : innerHeight;
          return { sel, inView: a.top >= 0 && a.bottom <= innerHeight, hitOk: !!hit && (t.contains(hit) || hit === el || (lab && lab.contains(hit))), aboveNav: a.top < nb }; }, s);
        if (!r.inView || !r.hitOk || !r.aboveNav) bad.push(r); }
      /* the app keeps body.kb (tab bar hidden, index static) for 400 ms after the last text field blurs (main.js focusout), so the bar
         does not flash between two fields; measuring inside that window reads the hidden bar as top 0. Wait for the real restore. */
      await p.evaluate(() => document.activeElement && document.activeElement.blur());
      ok(await p.waitForFunction(() => !document.body.classList.contains('kb') && getComputedStyle(document.querySelector('.nav')).display !== 'none', null, { timeout: 2000 }).then(() => true, () => false), 'after the keyboard closes, the tab bar comes back (within 2 s)');
      ok(ids.length >= (scr === '#/settings' ? 15 : 3), 'fields to test', ids.length);
      ok(!bad.length, `all ${ids.length} fields: focused field visible and not covered by the header, the index or the tab bar`, bad.slice(0, 6));
      /* bottom of the page reachable above the tab bar */
      const last = await p.evaluate(() => { scrollTo(0, document.documentElement.scrollHeight); const cards = [...document.querySelectorAll('#view section.card')]; const c = cards[cards.length - 1].getBoundingClientRect(); const nav = document.querySelector('.nav').getBoundingClientRect(); return { cb: Math.round(c.bottom), nt: Math.round(nav.top), kb: document.body.classList.contains('kb') }; });
      ok(!last.kb && last.nt > 0 && last.cb <= last.nt, 'the last card ends above the bottom tab bar', last);
    }
    allErrs.push(...errs); await ctx.close();
  }

  G = 'lazy screens'; ({ ctx, p, errs } = await mk(390)); const reqs = []; p.on('request', r => reqs.push(r.url()));
  await boot(p); ok(!reqs.some(u => /extra\.js/.test(u)), 'extra.js not part of the first load');
  await go(p, '#/recipes', 1500); ok(await p.locator('#view [data-extra-loading]').count() === 0 && (await p.locator('#view').innerText()).length > 50, 'recipes screen loads on demand');
  allErrs.push(...errs); await ctx.close();

  G = 'errors'; ok(!allErrs.length, 'no JS errors', allErrs);
  await b.close();
  let pass = 0, fail = 0; for (const r of res) { console.log(`${r.ok ? 'PASS' : 'FAIL'} [${r.g}] ${r.m}`); r.ok ? pass++ : fail++; }
  console.log(`\n${pass} passed, ${fail} failed\nm104 tests: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
