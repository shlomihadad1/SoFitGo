/* M8 · design tokens, real-functionality audit, coach and travel screens, offline state, mobile form behaviour.
   Playwright Chromium with iPhone 13 emulation — NOT Safari and NOT a real device. Anything that depends on WebKit (keyboard,
   safe areas, input zoom) is checked here only as CSS/DOM behaviour; real-iPhone confirmation is listed in SAFARI-DEVICE-CHECKLIST.md.
   Usage: node tools/e2e_m8.js [URL] */
const { chromium, devices } = require('playwright'); const fs = require('fs'), path = require('path');
const URL0 = process.argv[2] || 'http://localhost:8096/';
const res = []; let G = ''; const ok = (c, m, i) => res.push({ g: G, ok: !!c, m: m + (i !== undefined && !c ? ' → ' + JSON.stringify(i).slice(0, 400) : '') });
const ROUTE_NAMES = [...fs.readFileSync(path.join(__dirname, '../src/js/main.js'), 'utf8').matchAll(/case '([a-z]+)':/g)].map(m => m[1]);
const lum = c => { const v = c.match(/[\d.]+/g).slice(0, 3).map(x => +x / 255).map(x => x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const SEED = () => { Store.resetAll(); localStorage.clear(); const pr = Store.load('profile'); Object.assign(pr, { name: '', age: 32, height: 175, weight: 80, startWeight: 80, sex: 'f', experience: 'beginner', aims: { primary: 'fat_loss', secondary: [] } }); pr.availability = { days: [0, 1, 2, 3, 4, 5, 6], sessions: 3, prefMin: null, maxMin: 45 }; Store.save('profile');
  Plans.activate(Plans.create('general_90', Plans.paramsFromProfile(pr), Store.today()), { confirmReplace: true }); };
(async () => {
  const b = await chromium.launch();
  const mk = async (opts) => { const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'he-IL', serviceWorkers: 'block', ...(opts || {}) }); const p = await ctx.newPage(); const errs = [], warns = [];
    p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'warning' || m.type() === 'warn') warns.push(m.text()); }); return { ctx, p, errs, warns }; };
  const go = async (p, h, ms) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(ms || 450); };
  let { ctx, p, errs, warns } = await mk();
  await p.goto(URL0); await p.waitForTimeout(700); await p.evaluate(SEED); await p.reload(); await p.waitForTimeout(800);

  G = 'design tokens';
  const tok = await p.evaluate(() => { const cs = getComputedStyle(document.documentElement), g = n => cs.getPropertyValue(n).trim().toUpperCase();
    const card = document.querySelector('.card:not(.hero)'), prim = document.querySelector('.btn.primary');
    return { bg: g('--bg'), brandBg: g('--brand-bg'), surface: g('--brand-surface'), accent: g('--brand-lime'), text: g('--brand-white'), muted: g('--brand-grey'), border: g('--brand-border'),
      bodyBg: getComputedStyle(document.body).backgroundColor, cardBg: card && getComputedStyle(card).backgroundColor, cardBorder: card && getComputedStyle(card).borderTopColor,
      primBg: prim && getComputedStyle(prim).backgroundColor, bodyColor: getComputedStyle(document.body).color, theme: document.querySelector('meta[name=theme-color]').content }; });
  ok(tok.brandBg === '#0F1115' && tok.surface === '#181B22' && tok.accent === '#CCFF00' && tok.text === '#FFFFFF' && tok.muted === '#9BA1A6' && tok.border === '#2A2E39', 'the six M8 brand tokens are defined centrally on :root', tok);
  ok(tok.bodyBg === 'rgb(15, 17, 21)' && tok.cardBg === 'rgb(24, 27, 34)' && tok.cardBorder === 'rgb(42, 46, 57)' && tok.bodyColor === 'rgb(255, 255, 255)', 'background, card surface, card border and text resolve to the tokens', tok);
  ok(tok.primBg === 'rgb(204, 255, 0)', 'primary action uses the accent token', tok.primBg);
  ok(tok.theme.toUpperCase() === '#0F1115', 'browser theme colour = background token', tok.theme);
  const html = await (await p.context().request.get(URL0)).text(), css = (html.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';
  ok(!/#adff2f|173, ?255, ?47|#0b0c10/i.test(css), 'old palette literals (#adff2f, #0b0c10) are gone from the shipped CSS');
  const man = await (await p.context().request.get(new URL('manifest.webmanifest', URL0).href)).json();
  ok(man.theme_color.toUpperCase() === '#0F1115' && man.background_color.toUpperCase() === '#0F1115', 'manifest colours follow the token', man);

  G = 'contrast (computed in the page)';
  const cr = await p.evaluate(() => { const s = getComputedStyle(document.querySelector('.card:not(.hero)')).backgroundColor, mk = cls => { const e = document.createElement('span'); e.className = cls; e.textContent = 'x'; document.querySelector('.card:not(.hero)').appendChild(e); const c = getComputedStyle(e).color; e.remove(); return c; };
    return { surface: s, text: getComputedStyle(document.body).color, muted: mk('muted'), faint: mk('faint'), bad: mk('bad'), warn: mk('warn'), good: mk('good'), acc: mk('acc'),
      ink: getComputedStyle(document.querySelector('.btn.primary')).color, accBg: getComputedStyle(document.querySelector('.btn.primary')).backgroundColor }; });
  for (const k of ['text', 'muted', 'faint', 'bad', 'warn', 'good', 'acc']) ok(contrast(cr[k], cr.surface) >= 4.5, `${k} text on a card ≥ 4.5:1 (${contrast(cr[k], cr.surface).toFixed(2)})`, cr);
  ok(contrast(cr.ink, cr.accBg) >= 4.5, `text on the primary button ≥ 4.5:1 (${contrast(cr.ink, cr.accBg).toFixed(2)})`);
  const ctl = await p.evaluate(() => { const i = document.querySelector('#h-steps'); return { b: getComputedStyle(i).borderTopColor, card: getComputedStyle(i.closest('.card')).backgroundColor }; });
  ok(contrast(ctl.b, ctl.card) >= 3, `form-field border ≥ 3:1 against the card (non-text contrast, ${contrast(ctl.b, ctl.card).toFixed(2)})`, ctl);

  G = 'dashboard: consumed vs burned';
  await go(p, '#/');
  let en = await p.evaluate(() => { const c = document.querySelector('[data-consumed] .v'), bu = document.querySelector('[data-burned]'); return { c: c && c.textContent.trim(), real: Core.eatenTotals(Store.today()).k, burned: bu && bu.dataset.burned, bv: bu && bu.querySelector('.v').textContent.trim(), bt: bu && bu.innerText }; });
  ok(en.c === String(en.real) && en.real === 0, 'consumed = journal total (0 before anything is marked)', en);
  ok(en.burned === 'unavailable' && !/\d/.test(en.bv) && /לא נמדד/.test(en.bt), 'burned: no number, says "not measured" (no source exists)', en);
  await p.locator('[data-act=eat][data-slot=m1]').first().click(); await p.waitForTimeout(400);
  en = await p.evaluate(() => ({ c: document.querySelector('[data-consumed] .v').textContent.trim(), real: Core.eatenTotals(Store.today()).k }));
  ok(en.real > 0 && en.c === String(en.real), 'after marking a meal, consumed shows exactly the journal total', en);
  await p.locator('[data-act=eat][data-slot=m1]').first().click(); await p.waitForTimeout(300); /* unmark again (keeps later checks clean) */
  const lime = await p.evaluate(() => [...document.querySelectorAll('[data-now] .btn.primary, [data-coach] .btn.primary')].filter(e => e.offsetParent).length);
  const nowNext = await p.evaluate(() => (Screens.nowModel(Store.today()).next || {}).k);
  ok(nowNext !== 'workout' || lime === 1, 'only one lime "start workout" between the NOW card and the plan card', { lime, nowNext });

  G = 'Sofit coach screen';
  await go(p, '#/coach', 900);
  const co = await p.evaluate(() => { const r = document.querySelector('[data-coach-screen]'), ch = document.querySelector('[data-chat]'), img = r && r.querySelector('img');
    return { shown: !!r, method: (document.querySelector('[data-coach-method]') || {}).textContent, say: (document.querySelector('[data-coach-say]') || {}).innerText, next: (Screens.nowModel(Store.today()).next || {}).he,
      chat: ch && ch.dataset.chat, method2: (document.querySelector('[data-ask-method]') || {}).textContent, text: document.querySelector('main').innerText,
      img: img ? { nw: img.naturalWidth, w: img.getBoundingClientRect().width, dpr: devicePixelRatio, src: img.getAttribute('src') } : null }; });
  ok(co.shown && co.say && co.next && co.say.includes(co.next), 'coach message is built from the same rule as the NOW card (next step quoted)', co);
  ok(/לא צ׳אט AI/.test(co.method), 'labelled "rule-based, not an AI chat"', co.method);
  ok(co.chat === 'local' && /לא<\/b>? צ׳אט בינה מלאכותית|לא צ׳אט בינה מלאכותית/.test(co.method2.replace(/\s+/g, ' ')), 'M11.2: "ask Sofit" = fixed topics computed from local data, labelled "not an AI chat"', co.method2);
  ok(!/online|מחוברת|אונליין|מקוונת/i.test(co.text) && /לא דיאטנית, לא רופאה/.test(co.text), 'no "online"/live-AI claim; no professional credentials claimed');
  ok(co.img && co.img.src === 'sofit-avatar-192.webp' && co.img.nw >= co.img.w * co.img.dpr, 'uses the existing approved Sofit avatar, not upscaled', co.img);
  const before = await p.evaluate(() => localStorage.getItem('fit30.workouts') + localStorage.getItem('fit30.nutrition') + localStorage.getItem('fit30.plans'));
  await p.evaluate(() => document.querySelectorAll('.toast').forEach(t => t.remove())); /* toasts from the earlier mark/unmark (6 s) are not caused by this tap */
  await p.fill('#ask-q', 'מה דעתך על מניות טסלה?'); await p.locator('[data-chat] [data-act=ask]').click(); await p.waitForTimeout(250);
  ok(await p.locator('[data-ask-a=none]').count() === 1 && /אין לי תשובה מבוססת/.test(await p.locator('[data-ask-a=none]').innerText()), 'an off-topic question gets "no grounded answer" — nothing invented');
  ok(await p.evaluate(() => localStorage.getItem('fit30.workouts') + localStorage.getItem('fit30.nutrition') + localStorage.getItem('fit30.plans')) === before, 'asking changes no data and stores no conversation');
  await go(p, '#/'); await p.locator('[data-coach-link]').click(); await p.waitForTimeout(500);
  ok(await p.evaluate(() => location.hash) === '#/coach', 'tapping Sofit in the NOW card opens the coach screen');

  G = 'travel hub';
  await p.evaluate(() => { window.__geo = 0; const g = navigator.geolocation; if (g) { g.getCurrentPosition = () => { window.__geo++; }; g.watchPosition = () => { window.__geo++; return 0; }; } });
  const snap = () => p.evaluate(() => localStorage.getItem('fit30.plans') + '|' + localStorage.getItem('fit30.nutrition') + '|' + localStorage.getItem('fit30.workouts'));
  const s0 = await snap();
  await go(p, '#/travel', 900);
  const tv = await p.evaluate(() => ({ text: document.querySelector('main').innerText, dest: !!document.querySelector('[data-travel-dest]') }));
  ok(tv.dest && /לא מזהה מיקום/.test(tv.text), 'destination is a manual text field and the screen says location is not detected', tv.text.slice(0, 200));
  await p.fill('#tr-dest', 'כנס בברלין'); await p.locator('[data-act=destSave]').click(); await p.waitForTimeout(400);
  const dv = await p.evaluate(() => ({ d: (Store.load('profile').travel || {}).dest, lbl: (document.querySelector('[data-dest-label]') || {}).innerText }));
  ok(dv.d === 'כנס בברלין' && /הוזן ידנית/.test(dv.lbl), 'destination saved as a user-entered label', dv);
  ok(await snap() === s0, 'saving a destination changes no plan, menu or workout data');
  ok(await p.evaluate(() => window.__geo) === 0, 'no geolocation API call');
  ok(await p.locator('[data-act=travelMode]').count() === 1, 'plan travel mode (existing feature) is reachable from the hub');
  await p.locator('[data-act=travelMode]').click(); await p.waitForTimeout(400); ok(await p.locator('.sheet [data-travel-diff], .sheet [data-travel-err]').count() >= 1, 'it opens the existing travel-mode preview sheet');
  await p.evaluate(() => UI.closeAllSheets());
  await p.locator('[data-act=offCheck]').click(); await p.waitForTimeout(800);
  const oc = await p.evaluate(() => { const r = document.querySelector('[data-offline-result]'); return r ? { st: r.dataset.offlineResult, t: r.innerText } : null; });
  ok(oc && oc.st === 'not-ready' && !/מוכן לעבודה בלי אינטרנט/.test(oc.t), 'offline check without a service worker reports NOT ready (no false "ready")', oc);
  ok(await p.evaluate(() => [...document.querySelectorAll('[data-planb="travel"]')].length) === 0, '(sanity) hub is not the Plan B list');
  await go(p, '#/planb'); ok(await p.evaluate(() => document.querySelector('[data-planb="travel"]').getAttribute('href')) === '#/travel', 'Plan B "I am travelling" opens the travel hub');

  G = 'forms on mobile';
  const SMALL = [];
  for (const h of ['#/', '#/activity', '#/fridge', '#/shopping', '#/travel', '#/progress', '#/profile', '#/settings', '#/feedback', '#/nutrition', '#/recipes', '#/targets']) {
    await go(p, h, 700); const bad = await p.evaluate(() => [...document.querySelectorAll('main input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]), main select, main textarea')].filter(e => e.offsetParent).map(e => ({ id: e.id || e.name || e.type, fs: parseFloat(getComputedStyle(e).fontSize) })).filter(x => x.fs < 16));
    if (bad.length) SMALL.push({ h, bad }); }
  ok(SMALL.length === 0, 'every visible text field is ≥ 16px (iOS Safari zooms the page on smaller fields)', SMALL);
  await go(p, '#/fridge', 700);
  const fq = await p.evaluate(() => { const i = document.querySelector('#fr-q'), cs = getComputedStyle(i); return { bg: cs.backgroundColor, h: i.getBoundingClientRect().height, br: cs.borderTopColor }; });
  ok(fq.bg === 'rgb(31, 35, 44)' && fq.h >= 44, 'fridge search field uses the form style (was unstyled in M7)', fq);
  await p.locator('#fr-q').focus(); await p.waitForTimeout(150);
  const navHidden = await p.evaluate(() => getComputedStyle(document.getElementById('nav')).display);
  await p.locator('#fr-q').blur(); await p.waitForTimeout(600); /* nav returns 400 ms after blur (tap-safety delay) */
  const navBack = await p.evaluate(() => getComputedStyle(document.getElementById('nav')).display);
  ok(navHidden === 'none' && navBack !== 'none', 'bottom navigation steps aside while a text field is focused, and returns after (CSS only; keyboard not testable here)', { navHidden, navBack });
  /* regression for the first M8 attempt (pure CSS :has): blurring on pointer-down brought the nav back under the finger, so a tap on
     a button just above the nav landed on a tab. Put "save" exactly where the nav sits and tap it while the field is focused. */
  await go(p, '#/profile', 600); await p.fill('#pf-w', '81.3');
  await p.evaluate(() => { const bt = document.querySelector('[data-act=saveBasics]'), r = bt.getBoundingClientRect(); window.scrollBy(0, r.bottom - (innerHeight - 20)); });
  const under = await p.evaluate(() => { const bt = document.querySelector('[data-act=saveBasics]').getBoundingClientRect(), nv = document.getElementById('nav'); nv.style.display = 'block'; const n = nv.getBoundingClientRect(); nv.style.display = ''; return bt.bottom > n.top; });
  await p.locator('[data-act=saveBasics]').click(); await p.waitForTimeout(500);
  ok(under && await p.evaluate(() => location.hash) === '#/profile' && await p.evaluate(() => Store.load('profile').weight) === 81.3, 'tapping "save" where the nav would be (field focused) saves, and does not open a tab', { under });
  await go(p, '#/fridge', 700);
  await p.locator('[data-act=fh]').first().click(); await p.waitForTimeout(400);
  ok(await p.locator('[data-fridge-summary]').count() === 1, 'fridge: selection summary with a jump to results appears once something is selected');
  await p.locator('[data-act=toRes]').click(); await p.waitForTimeout(700);
  ok(await p.evaluate(() => { const r = document.querySelector('[data-fridge-results]').getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }), 'the jump brings the results into view');

  G = 'every control works or says it is unavailable';
  const DEAD = [], BADLINK = [];
  const routes = ['#/', '#/calendar', '#/workouts', '#/nutrition', '#/recipes', '#/progress', '#/settings', '#/profile', '#/targets', '#/plan', '#/pday', '#/programs', '#/media', '#/activity', '#/shopping', '#/fridge', '#/planb', '#/feedback', '#/coach', '#/travel', '#/review', '#/records', '#/explain', '#/help', '#/install', '#/day/1'];
  for (const h of routes) { warns.length = 0; await go(p, h, 900); await p.waitForTimeout(h === '#/help' ? 900 : 0);
    const nh = warns.filter(w => /no handler/.test(w)); if (nh.length) DEAD.push({ h, nh });
    const links = await p.evaluate(() => [...document.querySelectorAll('a[href^="#/"]')].map(a => a.getAttribute('href')));
    links.forEach(l => { const n = l.replace(/^#\/?/, '').split('/')[0]; if (n && !ROUTE_NAMES.includes(n)) BADLINK.push({ h, l }); }); }
  ok(DEAD.length === 0, `no button without an action on ${routes.length} screens (UI.bind "no handler" warnings)`, DEAD);
  ok(BADLINK.length === 0, 'no link points to a screen that does not exist', BADLINK);
  ok(errs.length === 0, 'no page errors while visiting all screens', errs.slice(0, 3));
  await go(p, '#/pday', 700);
  ok(await p.evaluate(() => !/לא נמצא/.test(document.querySelector('.top h1').textContent) && !!document.querySelector('main .card')), '#/pday without a day opens today (was "not found" in M7)');
  await go(p, '#/programs', 900);
  ok(await p.evaluate(() => !!Screens.programs && !document.querySelector('[data-extra-loading]') && /קטלוג מסלולים/.test(document.querySelector('main').innerText)), 'programs screen (moved to the on-demand chunk) renders');

  G = 'offline state';
  await go(p, '#/'); await ctx.setOffline(true); await p.waitForTimeout(300);
  const off1 = await p.evaluate(() => ({ on: navigator.onLine, bar: !!document.querySelector('[data-offline]'), t: (document.querySelector('[data-offline]') || {}).innerText }));
  await ctx.setOffline(false); await p.waitForTimeout(300);
  const off2 = await p.evaluate(() => !!document.querySelector('[data-offline]'));
  ok(!/שלא נשמרו/.test(off1.t || ''), 'M9: offline bar does not imply some videos were saved', off1.t);
  ok(off1.on === false && off1.bar && /ממשיכים לעבוד/.test(off1.t) && !off2, 'offline bar appears when the connection drops and disappears when it returns', { off1, off2 });

  G = 'reduced motion';
  await p.emulateMedia({ reducedMotion: 'reduce' }); await go(p, '#/');
  const rm = await p.evaluate(() => { const e = document.createElement('span'); e.className = 'skel'; document.body.appendChild(e); const a = getComputedStyle(e).animationName; e.remove(); UI.toast('x'); const t = getComputedStyle(document.querySelector('.toast')).animationName; return { a, t }; });
  ok(rm.a === 'none' && rm.t === 'none', 'loading shimmer and toast animation are off with reduced motion', rm);
  await ctx.close();

  G = 'offline readiness with a real service worker (Chromium)';
  ({ ctx, p, errs } = await mk({ serviceWorkers: 'allow' }));
  await p.goto(URL0); await p.waitForTimeout(1500); await p.reload(); await p.waitForTimeout(1500);
  await p.evaluate(SEED); await go(p, '#/travel', 1200);
  await p.locator('[data-act=offCheck]').click(); await p.waitForTimeout(1500);
  const oc2 = await p.evaluate(() => { const r = document.querySelector('[data-offline-result]'); return r ? { st: r.dataset.offlineResult, t: r.innerText, ctl: !!navigator.serviceWorker.controller } : null; });
  ok(oc2 && oc2.ctl && oc2.st === 'ready' && /5 מתוך 5/.test(oc2.t), 'with the shell cached and controlling the page, the check reports ready (5 of 5 files found)', oc2);
  ok(oc2 && /סרטוני הדרכה: נטענים רק עם חיבור/.test(oc2.t) && !/סרטוני הדרכה שמורים/.test(oc2.t), 'M9: never claims tutorial videos are saved offline (the service worker does not cache video)', oc2 && oc2.t);
  await ctx.close();

  G = 'native step sync: first-day boundary (SIMULATED bridge, not HealthKit)';
  const fake = `window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios', Plugins: { Health: {
      isAvailable: async () => ({ available: true, platform: 'ios' }), requestAuthorization: async () => ({}),
      checkAuthorization: async () => ({ readAuthorized: ['steps'], readDenied: [], writeAuthorized: [], writeDenied: [] }),
      queryAggregated: async (o) => { window.__q = o; const s = new Date(o.startDate), out = []; for (let i = 0; i < 16; i++) { const d = new Date(s.getFullYear(), s.getMonth(), s.getDate() + i); if (d > new Date(o.endDate)) break; out.push({ startDate: d.toISOString(), endDate: new Date(d.getTime() + 864e5).toISOString(), value: i === 0 ? 99999 : 5000 + i, unit: 'count' }); } return { samples: out }; } } } };`;
  ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'he-IL', serviceWorkers: 'block' }); await ctx.addInitScript(fake); p = await ctx.newPage();
  await p.goto(URL0); await p.waitForTimeout(700); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(700);
  await go(p, '#/activity', 1200); await p.locator('[data-act=hConnect]').click(); await p.waitForTimeout(900);
  const nb = await p.evaluate(() => { const q = window.__q, t = Store.today(), first = Store.addDays(t, -13), extra = Store.addDays(t, -14), m = Store.load('tracking').measured || {};
    const qs = new Date(q.startDate), loc = qs.getFullYear() + '-' + String(qs.getMonth() + 1).padStart(2, '0') + '-' + String(qs.getDate()).padStart(2, '0');
    return { qStart: loc, extra, first, extraImported: !!m[extra], firstImported: !!m[first], values: Object.values(m).map(x => x.steps) }; });
  ok(nb.qStart === nb.extra, 'query starts one day before the 14-day window (plugin uses strictStartDate)', nb);
  ok(!nb.extraImported && nb.firstImported && !nb.values.includes(99999), 'the extra day is discarded; the window\'s first day is imported', nb);
  await ctx.close();

  await b.close();
  const pass = res.filter(r => r.ok).length, fail = res.length - pass;
  fs.mkdirSync('dist/reports', { recursive: true }); fs.writeFileSync('dist/reports/e2e-m8.json', JSON.stringify({ url: URL0, env: 'Playwright Chromium, iPhone 13 emulation (not Safari, not a device)', at: new Date().toISOString(), pass, fail, results: res }, null, 1));
  res.forEach(r => console.log((r.ok ? 'PASS ' : 'FAIL ') + '[' + r.g + '] ' + r.m)); console.log(`m8 e2e: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { res.forEach(r => console.log((r.ok ? 'PASS ' : 'FAIL ') + '[' + r.g + '] ' + r.m)); console.error('m8 e2e crashed in [' + G + ']: ' + e.message.split('\n')[0]); process.exit(2); });
