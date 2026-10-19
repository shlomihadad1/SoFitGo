/* UX audit screenshots (Chromium emulation — not a real device). Usage: node tools/ux_shots.js OUTDIR [URL] [width,width…] [routes…] */
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const OUT = process.argv[2] || 'dist/reports/shots', URL0 = process.argv[3] || 'http://localhost:8096/';
const WIDTHS = (process.argv[4] || '390,820,1280').split(',').map(Number);
const ROUTES = process.argv.slice(5).length ? process.argv.slice(5) : ['#/', '#/plan', '#/calendar', '#/workouts', '#/nutrition', '#/recipes', '#/recipe/salmon_quinoa_edamame', '#/progress', '#/profile', '#/settings', '#/ex/pushup', '#/programs', '#/setup/1', 'NEW#/'];
(async () => {
  fs.mkdirSync(OUT, { recursive: true }); const b = await chromium.launch();
  for (const w of WIDTHS) {
    const ctx = await b.newContext({ viewport: { width: w, height: w < 700 ? 844 : (w < 1000 ? 1180 : 800) }, deviceScaleFactor: w < 700 ? 2 : 1, isMobile: w < 1000, hasTouch: w < 1000, locale: 'he-IL', serviceWorkers: 'block' });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(URL0); await p.waitForTimeout(500);
    const seed = () => p.evaluate(() => { Store.resetAll(); localStorage.clear(); const pr = Store.load('profile'); Object.assign(pr, { name: '', age: 32, height: 187, weight: 85, startWeight: 85, sex: 'm', experience: 'beginner', aims: { primary: 'fat_loss', secondary: [] } }); pr.availability = { days: [1, 3, 5], sessions: 3, prefMin: null, maxMin: 30 }; Store.save('profile'); Plans.activate(Plans.create('general_90', Plans.paramsFromProfile(pr), Store.today()), { confirmReplace: true });
      const t = Store.load('tracking'); for (let i = 9; i >= 0; i--) { const d = Store.addDays(Store.today(), -i); t.days = t.days || {}; } Store.save('tracking'); });
    for (const r of ROUTES) {
      const fresh = r.startsWith('NEW'); const h = r.replace(/^NEW/, '');
      if (fresh) await p.evaluate(() => { Store.resetAll(); localStorage.clear(); }); else await seed();
      await p.reload(); await p.waitForTimeout(300); await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(500);
      const name = `${w}-${(fresh ? 'new-' : '') + (h.replace(/[#\/]+/g, '_').replace(/^_|_$/g, '') || 'home')}.png`;
      await p.screenshot({ path: path.join(OUT, name), fullPage: true });
    }
    if (errs.length) console.log('errors at', w, errs.slice(0, 3)); await ctx.close();
  }
  await b.close(); console.log('shots in', OUT);
})();
