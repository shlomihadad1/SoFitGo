/* RC5 · Recipe Quality Gate (INN-41 / REC-7). Checks EVERY recipe and writes a report:
   dist/reports/recipe-quality-gate.json and .md. FAIL = structurally wrong (blocks a release); WARN = missing or uncertain
   information that is shown to the user honestly or still needs content work; nothing is invented or auto-fixed.
   Usage: node tools/recipe_gate.js */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const ctx = { console }; ctx.window = ctx; ctx.self = ctx; vm.createContext(ctx);
for (const f of ['src/data/nutrition.js', 'src/data/recipes_intl.js', 'src/data/catalog.js', 'src/js/logic.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
const N = ctx.NUTRI, F = N.FOODS, R = N.RECIPES, L = ctx.Logic;
const rows = [], byName = {}, bySet = {};
for (const r of R) {
  const fail = [], warn = [];
  if (!r.id || !r.he || !r.en) fail.push('חסר מזהה/שם');
  if (!['m1', 'm2', 'snack', 'extra'].includes(r.meal)) fail.push('סוג ארוחה לא תקין: ' + r.meal);
  if (!Array.isArray(r.ing) || !r.ing.length) fail.push('אין רכיבים');
  (r.ing || []).forEach((x, i) => { if (!F[x.f]) fail.push(`רכיב ${i + 1}: מזון לא מוכר "${x.f}"`); if (!(x.g > 0)) fail.push(`רכיב ${i + 1}: כמות לא תקינה (${x.g})`); });
  /* one step is legitimate for no-cook items (add-ons, snacks that are assembled); a cooked dish with one step is flagged */
  if (!r.est) { if (!Array.isArray(r.steps) || !r.steps.length) fail.push('אין שלבי הכנה'); else if (r.steps.some(s => !String(s).trim())) fail.push('שלב הכנה ריק'); else if (r.steps.length < 2 && r.cook > 0) warn.push('מנה מבושלת עם שלב הכנה אחד בלבד'); }
  if (typeof r.prep !== 'number' || typeof r.cook !== 'number' || r.prep < 0 || r.cook < 0) fail.push('זמן הכנה/בישול חסר או שלילי');
  else if (!r.prep && !r.cook && !r.est) warn.push('אין זמן הכנה ובישול (0/0) למנה ביתית');
  if (r.servings !== 1) (r.servings > 0 ? warn : fail).push('מספר מנות: ' + r.servings + (r.servings > 0 ? ' (האפליקציה מניחה מנה אחת)' : ''));
  if (!r.est && (!Array.isArray(r.equip) || !r.equip.length)) warn.push('לא צוין ציוד');
  let m = null; try { m = L.recipeMacros(r); } catch (e) { fail.push('חישוב ערכים נכשל: ' + e.message); }
  if (m) { if (!(m.k > 0) || !isFinite(m.k)) fail.push('קלוריות לא תקינות'); else { if (m.k < 80 || m.k > 1600) warn.push(`קלוריות חריגות למנה: ${m.k}`); const pk = (m.p * 4 + m.c * 4 + m.f * 9) / m.k; if (pk < 0.85 || pk > 1.15) warn.push(`מאקרו לא מתיישבים עם הקלוריות (${Math.round(pk * 100)}%)`); } }
  if (r.est && !(r.range > 0)) fail.push('מנת מסעדה בלי טווח הערכה');
  warn.push('אין שדה מקור/זכויות למתכון (TD-17) — המתכונים נכתבו לאפליקציה; לא אומת מול מקור חיצוני');
  (byName[r.he] = byName[r.he] || []).push(r.id);
  const key = [...new Set((r.ing || []).map(x => x.f))].sort().join('+'); (bySet[key] = bySet[key] || []).push(r.id);
  rows.push({ id: r.id, he: r.he, meal: r.meal, est: !!r.est, kcal: m && m.k, protein: m && m.p, prep: r.prep, cook: r.cook, steps: (r.steps || []).length, ing: (r.ing || []).length, fail, warn });
}
Object.values(byName).filter(a => a.length > 1).forEach(a => a.forEach(id => rows.find(x => x.id === id).fail.push('שם כפול עם: ' + a.filter(x => x !== id).join(', '))));
Object.values(bySet).filter(a => a.length > 1).forEach(a => a.forEach(id => rows.find(x => x.id === id).warn.push('אותם רכיבים בדיוק כמו: ' + a.filter(x => x !== id).join(', '))));
const nFail = rows.filter(x => x.fail.length).length, nWarnOnly = rows.filter(x => !x.fail.length && x.warn.length > 1).length;
const sum = { at: new Date().toISOString(), recipes: rows.length, failed: nFail, withExtraWarnings: nWarnOnly, sourceFieldMissing: rows.length, rows };
fs.mkdirSync(path.join(ROOT, 'dist/reports'), { recursive: true }); fs.writeFileSync(path.join(ROOT, 'dist/reports/recipe-quality-gate.json'), JSON.stringify(sum, null, 1));
const md = ['# Recipe Quality Gate', '', `${rows.length} מתכונים · נכשלו: **${nFail}** · עם אזהרות נוספות (מעבר לחוסר שדה מקור): ${nWarnOnly}`, '', 'כל המתכונים מסומנים "אין שדה מקור/זכויות" — האפליקציה לא טוענת מקור שאין לה.', '',
  '| מתכון | ארוחה | קק״ל | חלבון | הכנה+בישול | שלבים | רכיבים | כשלים | אזהרות |', '|---|---|---|---|---|---|---|---|---|',
  ...rows.map(x => `| ${x.he} (${x.id}) | ${x.meal}${x.est ? ' · מסעדה' : ''} | ${x.kcal ?? '—'} | ${x.protein ?? '—'} | ${x.prep}+${x.cook} | ${x.steps} | ${x.ing} | ${x.fail.join('; ') || '—'} | ${x.warn.filter(w => !/TD-17/.test(w)).join('; ') || '—'} |`)].join('\n');
fs.writeFileSync(path.join(ROOT, 'dist/reports/recipe-quality-gate.md'), md);
rows.filter(x => x.fail.length).forEach(x => console.log('FAIL ' + x.id + ': ' + x.fail.join('; ')));
console.log(`recipe gate: pass ${rows.length - nFail} fail ${nFail} (warnings beyond missing source field: ${nWarnOnly})`); process.exit(nFail ? 1 : 0);
