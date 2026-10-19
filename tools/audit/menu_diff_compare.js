/* node tools/audit/menu_diff_compare.js a.json b.json — dishes/portions must be identical; reports totals and gap differences */
const fs = require('fs'); const [a, b] = process.argv.slice(2).map(f => JSON.parse(fs.readFileSync(f, 'utf8')));
let slotDiff = 0, offDiff = 0, totK = 0, totP = 0, maxK = 0, maxP = 0, gapDiff = 0; const gapEx = [], gapKinds = {};
if (a.length !== b.length) { console.log('different day counts', a.length, b.length); process.exit(1); }
a.forEach((x, i) => { const y = b[i]; if (x.slots !== y.slots) slotDiff++; if (x.off !== y.off) offDiff++;
  if (x.totals && y.totals) { const dk = Math.abs(x.totals.k - y.totals.k), dp = Math.abs(x.totals.p - y.totals.p); if (dk) totK++; if (dp > 1e-9) totP++; maxK = Math.max(maxK, dk); maxP = Math.max(maxP, dp); }
  if (JSON.stringify(x.gap) !== JSON.stringify(y.gap)) { gapDiff++; const k = Object.keys(Object.assign({}, x.gap, y.gap)).filter(z => (x.gap || {})[z] !== (y.gap || {})[z]).join('+'); gapKinds[k] = (gapKinds[k] || 0) + 1; if (gapEx.length < 5) gapEx.push({ c: x.c, d: x.d, before: x.gap, after: y.gap, totalsBefore: x.totals, totalsAfter: y.totals }); } });
console.log(JSON.stringify({ days: a.length, daysWithDifferentDishesOrPortions: slotDiff, offDiff, daysTotalsKcalDiffer: totK, maxKcalDiff: maxK, daysTotalsProteinDiffer: totP, maxProteinDiff: +maxP.toFixed(2), daysGapDiffers: gapDiff, gapFieldsChanged: gapKinds, examples: gapEx }, null, 1));
