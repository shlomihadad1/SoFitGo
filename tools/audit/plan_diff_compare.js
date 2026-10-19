/* Compares two plan_diff_dump outputs: node tools/audit/plan_diff_compare.js a.json b.json */
const fs = require('fs'); const [a, b] = process.argv.slice(2).map(f => JSON.parse(fs.readFileSync(f, 'utf8')));
if (a.length !== b.length) { console.log('different case counts'); process.exit(1); }
let dayDiff = 0, errDiff = 0, errs = 0; const fieldDiff = {}, ex = [];
a.forEach((x, i) => { const y = b[i]; if (x.err || y.err) { errs++; if (x.err !== y.err) errDiff++; return; } if (x.days !== y.days) dayDiff++;
  for (const k of new Set([...Object.keys(x.summary), ...Object.keys(y.summary)])) if (JSON.stringify(x.summary[k]) !== JSON.stringify(y.summary[k])) { fieldDiff[k] = (fieldDiff[k] || 0) + 1; if (ex.length < 4) ex.push(`${x.t}#${i} ${k}: ${JSON.stringify(x.summary[k])} → ${JSON.stringify(y.summary[k])}`); } });
console.log(JSON.stringify({ cases: a.length, errorsBoth: errs, errorDifferences: errDiff, casesWithDifferentDays: dayDiff, summaryFieldsThatDiffer: fieldDiff, examples: ex }, null, 1));
