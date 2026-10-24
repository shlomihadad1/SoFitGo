/* Content coverage: every exercise has full written instructions; every recipe has ingredients with amounts, equipment and numbered
   steps; media is counted as it really is (generated illustration / real photo / video) — nothing is counted as media that is not
   in the media manifest. Writes docs/CONTENT-COVERAGE.md. Usage: node tools/content_coverage.js [--write] */
const fs = require('fs'), path = require('path'); global.window = global;
const D = f => require(path.join(__dirname, '../src/data', f)); ['exercises.js', 'nutrition.js', 'recipes_intl.js', 'recipes_med.js', 'catalog.js', 'media.js'].forEach(D);
const E = EXERCISES, R = NUTRI.RECIPES, M = MEDIA; let pass = 0, fail = 0; const fails = [];
const ok = (c, m) => { if (c) pass++; else { fail++; fails.push(m); } };
const exRow = e => { const m = CATALOG.exMeta(e.id), md = M.ex[e.id] || {};
  const r = { id: e.id, he: e.he, muscles: e.muscles, eq: m.eq.length ? m.eq.map(k => CATALOG.EQUIPMENT[k].he).join(', ') : 'ללא ציוד', start: !!(e.start && e.start.length >= 10), steps: (e.steps || []).length, breath: !!(e.breath && e.breath.length >= 5), mistakes: (e.mistakes || []).length, beginner: !!(e.levels && e.levels.easy), easier: (e.alts || []).length, illus: md.poster ? md.poster.origin : null, video: md.video ? 'כן' : null };
  r.complete = r.start && r.steps >= 3 && r.breath && r.mistakes >= 1 && r.beginner && r.easier >= 1; return r; };
const rcRow = r => { const md = M.rc[r.id] || {}; const x = { id: r.id, he: r.he, est: !!r.est, ing: (r.ing || []).length, qty: (r.ing || []).every(i => i.g > 0), equip: (r.equip || []).length, steps: (r.steps || []).length, time: r.prep != null && r.cook != null, photo: !!md.photo, video: !!md.prep, stepPhotos: (md.steps || []).length };
  x.complete = x.ing > 0 && x.qty && x.time && (x.est ? x.steps >= 1 : x.steps >= 2 && x.equip >= 1); return x; };
const ex = E.map(exRow), rc = R.map(rcRow);
ex.forEach(r => ok(r.complete, `exercise ${r.id}: incomplete instructions ${JSON.stringify(r)}`));
rc.forEach(r => ok(r.complete, `recipe ${r.id}: incomplete ${JSON.stringify(r)}`));
Object.entries(M.ex).forEach(([k, v]) => { if (v.video) ok(v.video.origin && (v.video.origin === 'generated' || M.credits[v.video.src || k]), `exercise video ${k} has no source/credit`); });
Object.entries(M.rc).forEach(([k, v]) => ok(!(v.photo || v.prep) || M.credits[k], `recipe media ${k} has no source/credit`));
const n = (a, f) => a.filter(f).length;
const sum = { ex: E.length, exComplete: n(ex, r => r.complete), exIllus: n(ex, r => r.illus), exVideo: n(ex, r => r.video), rc: R.length, rcComplete: n(rc, r => r.complete), rcPhoto: n(rc, r => r.photo), rcVideo: n(rc, r => r.video), rcStepPhotos: n(rc, r => r.stepPhotos), rcEst: n(rc, r => r.est) };
console.log(JSON.stringify(sum));
if (process.argv.includes('--write')) {
  const md = `# SoFitGo — כיסוי תוכן הדרכה\n\nנוצר אוטומטית מ־\`tools/content_coverage.js\` (מהנתונים במאגר, לא מהערכה).\n\n## סיכום\n| | סה״כ | הוראות כתובות מלאות | איור | צילום | סרטון |\n|---|---|---|---|---|---|\n| תרגילים | ${sum.ex} | ${sum.exComplete} | ${sum.exIllus} (איורים מקוריים שנוצרו באפליקציה) | 0 | ${sum.exVideo} |\n| מתכונים | ${sum.rc} | ${sum.rcComplete} | — | ${sum.rcPhoto} | ${sum.rcVideo} (תמונות שלבים: ${sum.rcStepPhotos}) |\n\n"הוראות מלאות" לתרגיל = תנוחת התחלה, לפחות 3 שלבים, נשימה, טעויות נפוצות, רמת מתחילים וחלופה. למתכון = מרכיבים עם כמויות, ציוד, לפחות 2 שלבים ממוספרים וזמני הכנה ובישול (מנות מסעדה: המלצת הזמנה, ${sum.rcEst} מנות).\n\n**מדיה אמיתית (צילום/סרטון) עדיין חסרה לכל התרגילים והמתכונים.** לא נוספו קישורים או סרטונים שלא נבדקו.\n\n## תרגילים\n| מזהה | שם | שרירים | ציוד | התחלה | שלבים | נשימה | טעויות | מתחילים | חלופות | איור | סרטון |\n|---|---|---|---|---|---|---|---|---|---|---|---|\n${ex.map(r => `| ${r.id} | ${r.he} | ${String(r.muscles).replace(/\|/g, '/')} | ${r.eq} | ${r.start ? '✓' : '✗'} | ${r.steps} | ${r.breath ? '✓' : '✗'} | ${r.mistakes} | ${r.beginner ? '✓' : '✗'} | ${r.easier} | ${r.illus ? 'איור' : '—'} | ${r.video || '—'} |`).join('\n')}\n\n## מתכונים\n| מזהה | שם | מרכיבים | כמויות | ציוד | שלבים | זמנים | צילום | סרטון |\n|---|---|---|---|---|---|---|---|---|\n${rc.map(r => `| ${r.id} | ${r.he}${r.est ? ' (מסעדה)' : ''} | ${r.ing} | ${r.qty ? '✓' : '✗'} | ${r.equip || (r.est ? '—' : '✗')} | ${r.steps} | ${r.time ? '✓' : '✗'} | ${r.photo ? '✓' : '—'} | ${r.video ? '✓' : '—'} |`).join('\n')}\n`;
  fs.writeFileSync(path.join(__dirname, '../docs/CONTENT-COVERAGE.md'), md); console.log('wrote docs/CONTENT-COVERAGE.md'); }
fails.slice(0, 20).forEach(f => console.log('FAIL ' + f));
console.log(`content coverage: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
