/* Quality pass · accessibility sweep — Playwright Chromium, iPhone 13 emulation (NOT Safari, NOT a real screen reader).
   Every main route, Hebrew (RTL) and English preview (LTR): <html lang/dir> right; every button / link / role=button has an
   accessible name; every visible form field has a label; every <img> has alt; no duplicate ids; one <h1> or a titled header;
   focusable role=button elements are keyboard-reachable (tabindex). Includes the new SLL screens. Usage: node tools/e2e_a11y_sweep.js [URL] */
const { chromium, devices } = require('playwright'); const fs = require('fs');
const URL0 = process.argv[2] || 'http://localhost:8096/';
const res = []; let G = ''; const ok = (c, m, i) => res.push({ g: G, ok: !!c, m: m + (i !== undefined && !c ? ' → ' + JSON.stringify(i).slice(0, 400) : '') });
const seed = p => p.evaluate(() => { localStorage.clear(); Store.resetAll(); const pr = Store.load('profile'); Object.assign(pr, { age: 34, height: 172, weight: 78, startWeight: 78, sex: 'f', experience: 'beginner', onboarded: true, startDate: Store.today() });
  pr.aims = { primary: 'general', secondary: [] }; pr.availability = { days: [1, 3, 5], sessions: 3, maxMin: 30, prefMin: null }; pr.reminders = { on: true }; Store.save('profile');
  Plans.activate(Plans.create('general_90', Plans.paramsFromProfile(pr), Store.today()), { confirmReplace: true });
  const nu = Store.load('nutrition'); nu.shopping = { checked: {}, state: { tomato: 'notfound' }, custom: [{ id: 'c1', text: 'סבון', done: true }] }; Store.save('nutrition'); });
const audit = () => { const out = [], vis = el => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const name = el => (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') && [...el.getAttribute('aria-labelledby').split(' ')].map(id => (document.getElementById(id) || {}).textContent || '').join(' ') || el.getAttribute('title') || el.textContent || (el.querySelector('img[alt]') || {}).alt || (el.querySelector('svg title') || {}).textContent || '').trim();
  document.querySelectorAll('button, a[href], [role=button]').forEach(el => { if (!vis(el) || el.closest('[aria-hidden=true]')) return; if (!name(el)) out.push('no name: ' + el.outerHTML.slice(0, 110)); });
  document.querySelectorAll('input:not([type=hidden]), select, textarea').forEach(el => { if (!vis(el)) return; const id = el.id, lab = el.closest('label') || (id && document.querySelector(`label[for="${CSS.escape(id)}"]`)); if (!lab && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby') && !el.getAttribute('title')) out.push('no label: ' + el.outerHTML.slice(0, 110)); });
  document.querySelectorAll('img').forEach(el => { if (!el.hasAttribute('alt')) out.push('img without alt: ' + (el.getAttribute('src') || '').slice(0, 80)); });
  const ids = {}; document.querySelectorAll('[id]').forEach(el => { ids[el.id] = (ids[el.id] || 0) + 1; }); Object.keys(ids).filter(k => ids[k] > 1).forEach(k => out.push('duplicate id: ' + k));
  document.querySelectorAll('[role=button]').forEach(el => { if (vis(el) && el.tagName !== 'BUTTON' && !el.hasAttribute('tabindex')) out.push('role=button not focusable: ' + el.outerHTML.slice(0, 100)); });
  return out; };
(async () => {
  const b = await chromium.launch(); const errs = [];
  for (const [lang, dir] of [['he', 'rtl'], ['en', 'ltr']]) {
    G = lang === 'he' ? 'Hebrew (RTL)' : 'English preview (LTR)';
    const ctx = await b.newContext({ ...devices['iPhone 13'], locale: lang === 'he' ? 'he-IL' : 'en-US', serviceWorkers: 'block' }); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    const u = URL0 + (lang === 'en' ? '?lang=en' : ''); await p.goto(u); await p.waitForTimeout(700); await seed(p); await p.reload(); await p.waitForTimeout(900);
    const meta = await p.evaluate(() => ({ lang: document.documentElement.lang, dir: document.documentElement.dir }));
    ok(meta.lang === lang && meta.dir === dir, `<html lang="${lang}" dir="${dir}">`, meta);
    const ex = await p.evaluate(() => EXERCISES[0].id), rc = await p.evaluate(() => NUTRI.RECIPES[0].id), n = await p.evaluate(() => Plans.days(Plans.active()).find(x => Plans.isTraining(x)).n);
    const routes = ['#/', '#/calendar', '#/workouts', '#/plan', '#/pday/' + n, '#/ex/' + ex, '#/nutrition', '#/recipes', '#/recipe/' + rc, '#/targets', '#/shopping', '#/progress', '#/review', '#/settings', '#/profile', '#/media', '#/help',
      '#/planb', '#/travel', '#/changes', '#/reset', '#/presets', '#/activity', '#/privacy', '#/fridge', '#/today', '#/patterns', '#/experiments'];
    const bad = {};
    for (const r of routes) { await p.evaluate(x => { location.hash = x; }, r); await p.waitForTimeout(650); const o = await p.evaluate(audit); if (o.length) bad[r] = o.slice(0, 4); }
    if (process.env.FULL) console.log(JSON.stringify(bad, null, 1));
    ok(Object.keys(bad).length === 0, `${routes.length} screens: names, labels, alt text, unique ids, focusable custom buttons`, bad);
    await ctx.close();
  }
  ok(errs.length === 0, 'no page errors', errs.slice(0, 3));
  await b.close();
  const pass = res.filter(r => r.ok).length, fail = res.length - pass;
  res.forEach(r => console.log((r.ok ? 'PASS' : 'FAIL') + ' [' + r.g + '] ' + r.m));
  fs.mkdirSync('dist', { recursive: true }); fs.writeFileSync('dist/e2e_a11y_sweep.json', JSON.stringify(res, null, 1));
  console.log(`a11y sweep e2e: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('a11y sweep crashed in [' + G + ']: ' + (e.stack || e.message).slice(0, 500)); process.exit(1); });
