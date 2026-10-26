/* SLL-37 · Coach tone — Playwright Chromium, iPhone 13 emulation (NOT Safari). The setting is in Settings → תצוגה, saved and logged; on the NOW
   card "תמציתי" keeps only the next action, "מעודד" adds one short neutral opener to the same text, "רגיל" is unchanged.
   Usage: node tools/e2e_tone.js [URL] */
const { chromium, devices } = require('playwright'); const fs = require('fs');
const URL0 = process.argv[2] || 'http://localhost:8096/';
const res = []; let G = ''; const ok = (c, m, i) => res.push({ g: G, ok: !!c, m: m + (i !== undefined && !c ? ' → ' + JSON.stringify(i).slice(0, 300) : '') });
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'he-IL', serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const go = async h => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(800); };
  await p.goto(URL0); await p.waitForTimeout(700); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(700);
  await p.evaluate(() => { const pr = Store.load('profile'); Object.assign(pr, { age: 34, height: 172, weight: 78, startWeight: 78, sex: 'f', experience: 'beginner', onboarded: true }); Store.save('profile'); });
  const now = async () => { await go('#/settings'); await go('#/'); return p.evaluate(() => ({ next: (document.querySelector('[data-now-next] span') || {}).textContent || '', small: !!document.querySelector('[data-now-small]') })); };
  const setTone = async v => { await go('#/settings'); await p.locator('#d-tone').selectOption(v); await p.waitForTimeout(500); };
  G = 'tone';
  const std = await now(); ok(std.next.length > 0 && std.small, 'test setup: the NOW card has a next step and a secondary line', std);
  await setTone('brief'); ok(await p.evaluate(() => Store.load('profile').display.tone) === 'brief' && await p.evaluate(() => (Store.load('changelog').items || []).some(x => x.path === 'display.tone' && x.to === 'brief')), 'saved from Settings and recorded in the change log');
  const brief = await now(); ok(brief.next === std.next && !brief.small, '"תמציתי": the same next step, without the secondary line', brief);
  await setTone('warm'); const warm = await now();
  ok(/^(כל צעד נחשב\.|ממשיכים בקצב שלך\.|גם צעד קטן הוא התקדמות\.) /.test(warm.next) && warm.next.endsWith(std.next) && warm.small, '"מעודד": one short opener + exactly the same text', warm);
  await setTone('std'); const back = await now(); ok(back.next === std.next && back.small, '"רגיל": unchanged');
  ok(errs.length === 0, 'no page errors', errs.slice(0, 3));
  await b.close();
  const pass = res.filter(r => r.ok).length, fail = res.length - pass;
  res.forEach(r => console.log((r.ok ? 'PASS' : 'FAIL') + ' [' + r.g + '] ' + r.m));
  fs.mkdirSync('dist', { recursive: true }); fs.writeFileSync('dist/e2e_tone.json', JSON.stringify(res, null, 1));
  console.log(`tone e2e: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('tone e2e crashed in [' + G + ']: ' + (e.stack || e.message).slice(0, 600)); process.exit(1); });
