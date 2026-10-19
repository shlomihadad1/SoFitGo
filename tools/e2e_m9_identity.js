/* M9 · header logo (supplied logo package, provisional rasters), personal greeting, user avatar with brand fallback, and the
   Sofit coach card kept separate from the user. Playwright Chromium, iPhone emulation — NOT Safari, NOT a real device.
   The "profile photo" used here is a generated test pattern (no person), created inside the test.
   Usage: node tools/e2e_m9_identity.js [URL] */
const { chromium, devices } = require('playwright'); const fs = require('fs');
const URL0 = process.argv[2] || 'http://localhost:8096/';
const res = []; let G = ''; const ok = (c, m, i) => res.push({ g: G, ok: !!c, m: m + (i !== undefined && !c ? ' → ' + JSON.stringify(i).slice(0, 400) : '') });
const SEED_PLAN = () => { Store.resetAll(); localStorage.clear(); const pr = Store.load('profile'); Object.assign(pr, { age: 34, height: 176, weight: 80, startWeight: 80, sex: 'm', experience: 'beginner', aims: { primary: 'general', secondary: [] } }); pr.availability = { days: [0, 1, 2, 3, 4, 5, 6], sessions: 3, prefMin: null, maxMin: 45 }; Store.save('profile');
  Plans.activate(Plans.create('general_90', Plans.paramsFromProfile(pr), Store.today()), { confirmReplace: true }); };
(async () => {
  const b = await chromium.launch();
  const mk = async (w) => { const ctx = await b.newContext({ ...devices['iPhone 13'], viewport: { width: w || 390, height: 844 }, locale: 'he-IL', serviceWorkers: 'block' }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); return { ctx, p, errs }; };
  const go = async (p, h, ms) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(ms || 450); };
  const hello = p => p.evaluate(() => { const g = document.querySelector('[data-greeting]'), av = g && g.querySelector('.u-av'), im = av && av.querySelector('img'), r = av && av.getBoundingClientRect();
    return g ? { text: g.querySelector('[data-greeting-text]').textContent, kind: av.dataset.avatar, src: im ? im.getAttribute('src') : null, w: Math.round(r.width), h: Math.round(r.height), fit: im ? getComputedStyle(im).objectFit : null, hidden: av.getAttribute('aria-hidden'),
      bg: getComputedStyle(av).backgroundColor, border: getComputedStyle(av).borderTopColor, radius: getComputedStyle(av).borderTopLeftRadius, first: document.querySelector('#view').firstElementChild === g } : null; });

  let { ctx, p, errs } = await mk();
  await p.goto(URL0); await p.waitForTimeout(700); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(800);

  G = 'new user: generic greeting + brand fallback';
  let h = await hello(p);
  ok(h && h.text === 'שלום, בוא נתחיל', 'no name → "שלום, בוא נתחיל"', h);
  ok(h && h.first, 'greeting is the first element on Home', h);
  ok(h && h.kind === 'brand' && h.src === 'sofitgo-symbol-provisional.png', 'no photo → SoFitGo symbol from the logo package', h);
  ok(h && !/sofit-avatar/.test(h.src || ''), 'Sofit\'s portrait is never used as the user\'s avatar');
  ok(h && h.bg === 'rgb(24, 27, 34)' && h.border === 'rgb(42, 46, 57)' && h.radius === '50%', 'avatar: #181B22 background, #2A2E39 border, circular', h);
  ok(h && h.hidden === 'true', 'avatar is decorative (aria-hidden); the greeting text carries the meaning');
  const symNat = await p.evaluate(() => { const i = document.querySelector('[data-greeting] img'); return i ? { nw: i.naturalWidth, nh: i.naturalHeight, w: i.getBoundingClientRect().width, dpr: devicePixelRatio } : null; });
  ok(symNat && symNat.nw === symNat.nh && symNat.nw >= symNat.w * symNat.dpr, 'symbol is square and not upscaled at this density', symNat);

  G = 'name from the profile';
  await go(p, '#/profile', 700); await p.fill('#pf-name', '  שלומי  '); await p.locator('[data-act=saveBasics]').click(); await p.waitForTimeout(500);
  ok(await p.evaluate(() => Store.load('profile').name) === 'שלומי', 'name saved trimmed in the profile');
  await go(p, '#/'); h = await hello(p);
  ok(h && h.text === 'שלום, שלומי', 'greeting uses the saved name', h);
  await go(p, '#/profile', 700); await p.fill('#pf-name', '<img src=x onerror=alert(1)>'); await p.locator('[data-act=saveBasics]').click(); await p.waitForTimeout(400); await go(p, '#/');
  ok(await p.evaluate(() => !document.querySelector('[data-greeting] img[src="x"]') && document.querySelector('[data-greeting-text]').textContent.includes('<img')), 'name is shown as text, never as HTML');
  await go(p, '#/profile', 700); await p.fill('#pf-name', ''); await p.locator('[data-act=saveBasics]').click(); await p.waitForTimeout(400); await go(p, '#/');
  ok((await hello(p)).text === 'שלום, בוא נתחיל' && await p.evaluate(() => Store.load('profile').name) === null, 'clearing the name returns to the generic greeting');

  G = 'profile photo';
  const before = await hello(p);
  const png = await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 400; c.height = 200; const x = c.getContext('2d'); x.fillStyle = '#336699'; x.fillRect(0, 0, 400, 200); x.fillStyle = '#ffcc00'; x.fillRect(150, 50, 100, 100); return c.toDataURL('image/png').split(',')[1]; });
  await go(p, '#/profile', 700);
  ok(await p.locator('[data-sec=photo] [data-avatar=brand]').count() === 1, 'profile shows the same brand fallback before a photo is chosen');
  await p.setInputFiles('#pf-photo', { name: 'test-pattern.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') }); await p.waitForTimeout(900);
  const st = await p.evaluate(() => { const a = Store.load('avatar'); return { jpeg: /^data:image\/jpeg;base64,/.test(a.src || ''), len: (a.src || '').length, raw: localStorage.getItem('fit30.avatar') ? true : false }; });
  ok(st.jpeg && st.raw && st.len < 60000, 'photo stored on the device as a small JPEG (fit30.avatar)', st);
  await go(p, '#/'); h = await hello(p);
  ok(h && h.kind === 'photo' && h.fit === 'cover', 'with a photo: the photo replaces the fallback automatically, object-fit: cover', h);
  ok(h && h.w === before.w && h.h === before.h, 'same avatar box with and without photo (no layout shift)', { before, h });
  const dims = await p.evaluate(() => new Promise(r => { const i = new Image(); i.onload = () => r({ w: i.naturalWidth, h: i.naturalHeight }); i.src = Store.load('avatar').src; }));
  ok(dims.w === dims.h && dims.w === 200, 'non-square source is centre-cropped to a square (not stretched), never upscaled', dims);
  const exp = await p.evaluate(() => { const e = Store.exportAll(); return { hasAvatar: 'avatar' in e || JSON.stringify(e).includes('data:image/jpeg'), name: 'name' in e.profile }; });
  ok(!exp.hasAvatar && exp.name, 'backup includes the name field but not the photo (same rule as progress photos)', exp);
  ok(await p.evaluate(() => Store.validateBackup(Object.assign(Store.exportAll(), { profile: Object.assign({}, Store.load('profile'), { name: 42 }) }))) === 'השם בגיבוי אינו תקין.', 'restore rejects a corrupt name');
  await go(p, '#/profile', 700); await p.locator('[data-act=photoDel]').click(); await p.waitForTimeout(400);
  await go(p, '#/'); ok((await hello(p)).kind === 'brand', 'removing the photo brings the brand fallback back');
  await go(p, '#/profile', 600); await p.locator('[data-act=photoDel]').count(); await go(p, '#/');
  await p.evaluate(() => Store.resetAll()); await p.reload(); await p.waitForTimeout(700);
  ok(await p.evaluate(() => localStorage.getItem('fit30.avatar')) === null, 'deleting all data also deletes the photo');
  ok(errs.length === 0, 'no page errors', errs.slice(0, 3));
  await ctx.close();

  G = 'coach card stays separate from the user';
  ({ ctx, p, errs } = await mk());
  await p.goto(URL0); await p.waitForTimeout(700); await p.evaluate(SEED_PLAN); await p.evaluate(() => { const pr = Store.load('profile'); pr.name = 'שלומי'; Store.save('profile'); }); await p.reload(); await p.waitForTimeout(900);
  const order = await p.evaluate(() => { const v = document.querySelector('#view'), idx = s => { const e = v.querySelector(s); return e ? [...v.children].indexOf(e.closest('#view > *')) : -1; };
    return { greet: idx('[data-greeting]'), plan: idx('[data-coach]'), stats: idx('[data-plan-stats]'), now: idx('[data-now]'), label: (document.querySelector('[data-coach-label]') || {}).textContent, greetInNow: !!document.querySelector('[data-now] [data-greeting]'), greetText: document.querySelector('[data-greeting]').textContent }; });
  ok(order.greet === 0 && order.greet < order.plan && order.plan < order.now && order.stats < order.now, 'order: greeting → plan dashboard → progress → Sofit card', order);
  ok(/Sofit — המאמנת הדיגיטלית/.test(order.label || '') && !order.greetInNow && !/Sofit/.test(order.greetText), 'Sofit is labelled as the digital coach; the greeting never mentions Sofit', order);
  ok(await p.locator('[data-now] .coach-av').count() === 1 && await p.evaluate(() => (document.querySelector('[data-now] .now-q') || {}).textContent) !== '', 'coach card keeps Sofit\'s portrait and its "next step" heading');
  const home = await p.evaluate(() => document.querySelector('#view').innerText);
  ok(!/Online|מחוברת|אונליין/i.test(home), 'no live/online status anywhere on Home');
  const lime = await p.evaluate(() => [...document.querySelectorAll('[data-now] .btn.primary, [data-coach] .btn.primary')].filter(e => e.offsetParent).map(e => e.closest('[data-now]') ? 'now' : 'plan'));
  ok(lime.length <= 1, 'at most one lime action between the plan card and Sofit\'s card (today\'s plan day decides which)', lime);
  /* the day of the week decides whether today is a training day, so the workout case is rendered directly from the model */
  const sec = await p.evaluate(() => { const orig = Screens.nowModel; Screens.nowModel = d => { const m = orig(d); m.next = { k: 'workout', he: 'האימון של היום', btn: '<button class="btn primary" data-act="planStart" data-n="1">התחלת אימון</button>' }; return m; };
    try { const home = Screens.nowCard(Store.today(), { secondaryStart: true }), coach = Screens.nowCard(Store.today()); return { home: /class="btn secondary" data-act="planStart"/.test(home), coachPrimary: /class="btn primary" data-act="planStart"/.test(coach) }; } finally { Screens.nowModel = orig; } });
  ok(sec.home && sec.coachPrimary, 'when the next step is the workout, Sofit\'s card on Home shows "start" as secondary (the plan card has the lime one); elsewhere it stays primary', sec);
  ok(errs.length === 0, 'no page errors', errs.slice(0, 3));
  await ctx.close();

  G = 'header logo';
  for (const w of [430, 390, 360, 320]) {
    ({ ctx, p, errs } = await mk(w)); await p.goto(URL0); await p.waitForTimeout(900);
    for (const hsh of ['#/', '#/nutrition', '#/progress']) { await go(p, hsh, 500);
      const L = await p.evaluate(() => { const i = document.querySelector('.top .brand-logo'), t = document.querySelector('.top h1'), g = document.querySelector('.top a[href="#/settings"]'); if (!i) return null;
        const r = i.getBoundingClientRect(), tr = t.getBoundingClientRect(), gr = g.getBoundingClientRect(), x = (a, c) => !(a.right <= c.left || c.right <= a.left || a.bottom <= c.top || c.bottom <= a.top);
        return { src: (i.currentSrc || '').split('/').pop(), ratioShown: r.width / r.height, ratioNat: i.naturalWidth / i.naturalHeight, h: r.height, overlapTitle: x(r, tr), overlapGear: x(r, gr), titleW: Math.round(tr.width), scroll: document.documentElement.scrollWidth <= innerWidth, label: i.closest('.brand').getAttribute('aria-label') }; });
      const want = w < 360 ? 'sofitgo-symbol-provisional.png' : 'sofitgo-wordmark-provisional.png';
      ok(L && L.src === want, `${w}px ${hsh}: ${w < 360 ? 'symbol only' : 'wordmark'} shown`, L);
      ok(L && Math.abs(L.ratioShown - L.ratioNat) < 0.03, `${w}px ${hsh}: logo keeps its aspect ratio`, L);
      ok(L && !L.overlapTitle && !L.overlapGear && L.titleW > 20 && L.scroll, `${w}px ${hsh}: no collision with the title or settings; no sideways scroll`, L);
      ok(L && L.label === 'SoFitGo', `${w}px ${hsh}: logo has an accessible name`, L); }
    ok(errs.length === 0, `${w}px: no page errors`, errs.slice(0, 3)); await ctx.close(); }
  ({ ctx, p } = await mk()); const sw = await (await ctx.request.get(new URL('sw.js', URL0).href)).text();
  ok(/sofitgo-wordmark-provisional\.png/.test(sw) && /sofitgo-symbol-provisional\.png/.test(sw), 'logo files are precached for offline use');
  await ctx.close();

  await b.close();
  const pass = res.filter(r => r.ok).length, fail = res.length - pass;
  fs.mkdirSync('dist/reports', { recursive: true }); fs.writeFileSync('dist/reports/e2e-m9-identity.json', JSON.stringify({ url: URL0, env: 'Playwright Chromium, iPhone emulation (not Safari, not a device)', at: new Date().toISOString(), pass, fail, results: res }, null, 1));
  res.forEach(r => console.log((r.ok ? 'PASS ' : 'FAIL ') + '[' + r.g + '] ' + r.m)); console.log(`m9 identity e2e: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { res.forEach(r => console.log((r.ok ? 'PASS ' : 'FAIL ') + '[' + r.g + '] ' + r.m)); console.error('m9 identity e2e crashed in [' + G + ']: ' + e.message.split('\n')[0]); process.exit(2); });
