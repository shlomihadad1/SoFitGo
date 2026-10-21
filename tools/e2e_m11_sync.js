/* M11.4 · steps import from a file (parse → preview → save, labelled, idempotent, manual entries kept, failure reported) and the
   personal-plan calendar export (.ics, stable UIDs, upcoming unlogged training days only). Usage: [BROWSER=webkit] node tools/e2e_m11_sync.js [URL] */
const pw = require('playwright'), { devices } = pw; const ENGINE = process.env.BROWSER || 'chromium';
const URL0 = process.argv[2] || 'http://localhost:8096/';
const res = []; let G = ''; const ok = (c, m, i) => res.push({ g: G, ok: !!c, m: m + (i !== undefined && !c ? ' → ' + JSON.stringify(i).slice(0, 500) : '') });
const BASICS = () => { Store.resetAll(); localStorage.clear(); const pr = Store.load('profile'); Object.assign(pr, { age: 34, height: 176, weight: 80, startWeight: 80, sex: 'm', experience: 'beginner', aims: { primary: 'general', secondary: [] } }); Store.save('profile'); };
(async () => {
  const b = await pw[ENGINE].launch(); console.log('engine: ' + ENGINE); const errs = [];
  const ctx = await b.newContext({ ...devices['iPhone 13'], viewport: { width: 375, height: 760 }, locale: 'he-IL', serviceWorkers: 'block' }); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL0); await p.waitForTimeout(700); await p.evaluate(BASICS); await p.reload(); await p.waitForTimeout(800);
  const go = async (h, ms) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(ms || 900); };
  await go('#/activity', 1300);
  const day = (o) => p.evaluate(o => Store.addDays(Store.today(), o), o);
  const d1 = await day(-1), d2 = await day(-2), d3 = await day(-3), fut = await day(2);

  G = 'parser';
  const pr = await p.evaluate(([d1, d2, d3, fut]) => { const dmy = d => d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4);
    return SyncTools.parseSteps(`date,steps\n${d1},8450\n${dmy(d2)};6,100\n${d3},0\n${fut},5000\nhello,12\n${d3}\t120000\n${d1},9000`); }, [d1, d2, d3, fut]);
  ok(pr.rows.length === 2 && pr.rows.find(r => r.date === d1).steps === 9000 && pr.rows.find(r => r.date === d2).steps === 6100, 'ISO + DD/MM/YYYY, header skipped, thousands separator, last duplicate wins', pr);
  ok(pr.errors.length === 4 && ['אפס', 'עתידי', 'תאריך לא מזוהה', '100,000'].every(w => pr.errors.some(e => e.why.includes(w))), 'zero, future date, bad date and >100k rejected with reasons', pr.errors);
  ok(pr.dup === 1, 'duplicate counted');

  G = 'import flow';
  await p.evaluate(d => Activity.setUserSteps(d, 3000), d1);
  const before = await p.evaluate(() => localStorage.getItem('fit30.tracking'));
  await p.locator('[data-act=stepsFile]').click(); await p.locator('.sheet [data-steps-import]').waitFor();
  await p.fill('.sheet #si-t', `${d1},8450\n${d2},6100\nxx,1`); await p.locator('.sheet [data-act=check]').click(); await p.waitForTimeout(200);
  const pv = await p.locator('.sheet [data-si-preview]').innerText();
  ok(/2/.test(pv) && /רישום ידני/.test(pv) && await p.locator('.sheet [data-si-errors]').count() === 1, 'preview: valid days, manual-entry overlap explained, rejected lines listed', pv);
  ok(await p.evaluate(() => localStorage.getItem('fit30.tracking')) === before, 'nothing saved before confirming');
  await p.locator('.sheet [data-si-preview] [data-act=save]').click(); await p.waitForTimeout(400);
  const v1 = await p.evaluate(d => ({ v: Activity.day(d), l: Activity.label(Activity.day(d)), manual: Store.load('tracking').daily[d].steps }), d1);
  ok(v1.v.value === 8450 && v1.v.kind === 'measured' && v1.v.src === 'file' && v1.l === 'יובא מקובץ' && v1.manual === 3000, 'saved as "יובא מקובץ"; the manual value is kept', v1);
  ok(/יובא מקובץ/.test(await p.locator('[data-steps-list]').innerText()), 'source shown in the 14-day list');
  await p.locator('[data-act=stepsFile]').click(); await p.locator('.sheet [data-steps-import]').waitFor();
  await p.fill('.sheet #si-t', `${d1},8800`); await p.locator('.sheet [data-act=check]').click(); await p.waitForTimeout(150); await p.locator('.sheet [data-si-preview] [data-act=save]').click(); await p.waitForTimeout(300);
  const t2 = await p.evaluate(() => Store.load('tracking').measured);
  ok(t2[d1].steps === 8800 && Object.keys(t2).length === 2, 're-import replaces the same date, does not add', t2);
  G = 'file input';
  await p.locator('[data-act=stepsFile]').click(); await p.locator('.sheet [data-steps-import]').waitFor();
  await p.setInputFiles('.sheet #si-f', { name: 'steps.csv', mimeType: 'text/csv', buffer: Buffer.from(`date,steps\n${d3},4321\n`) }); await p.waitForTimeout(400);
  ok(/1/.test(await p.locator('.sheet [data-si-preview]').innerText()) && await p.locator('.sheet [data-si-preview] [data-act=save]').count() === 1, 'choosing a file fills and checks it');
  await p.evaluate(() => { window.__si = Storage.prototype.setItem; Storage.prototype.setItem = function () { throw new Error('Quota'); }; });
  await p.locator('.sheet [data-si-preview] [data-act=save]').click(); await p.waitForTimeout(300);
  const toast = await p.evaluate(() => [...document.querySelectorAll('.toast')].map(t => t.textContent).join('|')); await p.evaluate(() => { Storage.prototype.setItem = window.__si; });
  ok(/השמירה נכשלה/.test(toast) && !(await p.evaluate(d => !!(Store.load('tracking').measured || {})[d], d3)), 'storage failure → "not imported", nothing kept', toast);
  await p.evaluate(() => document.querySelectorAll('.sheet-bg').forEach(x => x.remove()));
  G = 'Sofit sees the source';
  await p.evaluate(() => Activity.setUserSteps(Store.today(), 1234)); await go('#/coach', 1200); await p.fill('#ask-q', 'כמה צעדים עשיתי'); await p.locator('[data-chat] [data-act=ask]').click(); await p.waitForTimeout(300);
  ok(/מבוסס על: הוזן ידנית|מבוסס על: יובא מקובץ/.test(await p.locator('[data-ask-a=steps]').innerText()), 'coach answer names the data source');
  G = 'delete imported';
  await go('#/activity', 1100); await p.locator('[data-act=hDel]').click(); await p.locator('.sheet [data-act=ok]').last().click(); await p.waitForTimeout(300);
  ok(await p.evaluate(d => Object.keys(Store.load('tracking').measured || {}).length === 0 && Store.load('tracking').daily[d].steps === 3000, d1), 'deleting imported steps keeps manual entries');

  G = 'calendar export';
  await go('#/settings', 900);
  ok(/30 הימים/.test(await p.locator('[data-act=ics]').innerText()), 'no active plan → the existing 30-day export');
  await p.evaluate(() => { const pr = Store.load('profile'); pr.availability = { days: [0, 1, 2, 3, 4, 5, 6], sessions: 3, prefMin: null, maxMin: 45 }; Store.save('profile'); Plans.activate(Plans.create('general_90', Plans.paramsFromProfile(pr), Store.today()), { confirmReplace: true }); });
  await go('#/home', 500); await go('#/settings', 900);
  ok(/לתוכנית האישית/.test(await p.locator('[data-act=ics]').innerText()), 'active plan → plan export', [await p.locator('[data-act=ics]').innerText(), await p.evaluate(() => !!Plans.active())]);
  const ics = await p.evaluate(() => { const a = SyncTools ? SyncTools.planICS('18:30', 15, new Date('2026-10-21T10:00:00')) : null, b2 = SyncTools.planICS('18:30', 15, new Date('2026-10-22T10:00:00')), ap = Plans.active(), today = Store.today();
    const want = Plans.days(ap).filter(d => d.date >= today && Plans.isTraining(d) && !d.log).length; const uids = (a.text.match(/UID:[^\r]+/g) || []);
    return { events: a.events, want, uniq: new Set(uids).size === uids.length, sameUids: JSON.stringify(uids) === JSON.stringify(b2.text.match(/UID:[^\r]+/g)), t1830: /DTSTART:\d{8}T183000/.test(a.text), alarm: /TRIGGER:-PT15M/.test(a.text), crlf: a.text.includes('\r\n'), begin: a.text.startsWith('BEGIN:VCALENDAR') && a.text.endsWith('END:VCALENDAR') }; }).catch(e => ({ err: String(e) }));
  ok(ics.events > 0 && ics.events === ics.want, 'one event per upcoming, not-yet-logged training day', ics);
  ok(ics.uniq && ics.sameUids, 'UIDs unique and stable between exports (re-import updates the same events)', ics);
  ok(ics.t1830 && ics.alarm && ics.crlf && ics.begin, 'chosen time, reminder, valid iCalendar framing', ics);
  await p.fill('#ics-t', '18:30'); await p.locator('[data-act=ics]').click(); await p.waitForTimeout(800);
  ok(await p.locator('.sheet').count() >= 1 && /אימונים קרובים/.test(await p.locator('.sheet').last().innerText()) && /חד־כיווני/.test(await p.locator('.sheet').last().innerText()), 'export sheet opens; says it is one-way');
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no sideways scroll');

  G = 'errors'; ok(!errs.length, 'no JS errors', errs);
  await b.close();
  let pass = 0, fail = 0; for (const r of res) { console.log(`${r.ok ? 'PASS' : 'FAIL'} [${r.g}] ${r.m}`); r.ok ? pass++ : fail++; }
  console.log(`\nm11 sync tests: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
