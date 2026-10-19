/* RC5 · unit tests for src/js/activity.js (provenance, idempotent sync, targets, MoveScore v0, dates/time zones).
   Node only, real Store + Activity code in a VM with an in-memory localStorage. Runs itself again under several TZ values
   (Asia/Jerusalem with DST change, America/New_York, Pacific/Kiritimati +14, Pacific/Pago_Pago −11) for the date tests.
   Usage: node tools/activity_test.js */
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const ROOT = path.join(__dirname, '..');
if (!process.env.__ACT_CHILD) {
  let fail = 0, pass = 0; const out = [];
  for (const tz of ['UTC', 'Asia/Jerusalem', 'America/New_York', 'Pacific/Kiritimati', 'Pacific/Pago_Pago']) {
    const r = cp.spawnSync(process.execPath, [__filename], { env: Object.assign({}, process.env, { __ACT_CHILD: '1', TZ: tz }), encoding: 'utf8' });
    const m = /RESULT pass (\d+) fail (\d+)/.exec(r.stdout || ''); if (!m) { fail++; out.push(`FAIL [${tz}] crashed: ${(r.stderr || '').slice(0, 300)}`); continue; }
    pass += +m[1]; fail += +m[2]; (r.stdout.match(/^FAIL .*$/mg) || []).forEach(l => out.push(l.replace('FAIL ', `FAIL [${tz}] `)));
  }
  out.forEach(l => console.log(l)); fs.mkdirSync(path.join(ROOT, 'dist/reports'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'dist/reports/activity-test.json'), JSON.stringify({ at: new Date().toISOString(), pass, fail, failures: out }, null, 1));
  console.log(`activity tests: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
}
const res = []; const ok = (c, m, i) => res.push({ ok: !!c, m: m + (i !== undefined && !c ? ' → ' + JSON.stringify(i).slice(0, 200) : '') });
const mem = {}; const ls = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
const ctx = { console, localStorage: ls, Date, Math, JSON, setTimeout, CustomEvent: class { constructor(t, o) { this.type = t; this.detail = o && o.detail; } }, dispatchEvent: () => true };
ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx; vm.createContext(ctx);
for (const f of ['src/js/store.js', 'src/js/activity.js', 'src/js/activity_more.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
const S = ctx.Store, A = ctx.Activity, today = S.today();

/* defaults: no universal 10,000 for a NEW profile; an existing profile keeps its value */
ok(S.load('profile').goals.steps == null, 'new profile: no default step target');
mem['fit30.profile'] = JSON.stringify(Object.assign(JSON.parse(JSON.stringify(S.load('profile'))), { goals: { steps: 10000, water: 3000, sleep: 7.5 } }));
vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/js/store.js'), 'utf8'), ctx); vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/js/activity.js'), 'utf8'), ctx); vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/js/activity_more.js'), 'utf8'), ctx);
const S2 = ctx.Store, A2 = ctx.Activity;
ok(S2.load('profile').goals.steps === 10000 && A2.targetOn(today) === 10000, 'existing profile with 10,000 keeps it (no silent change)');
A2.setTarget(7000, S2.addDays(today, -3));
ok(A2.targetOn(S2.addDays(today, -10)) === 10000 && A2.targetOn(S2.addDays(today, -3)) === 7000 && A2.targetOn(today) === 7000, 'target change applies from its date onward; earlier days keep 10,000');

/* provenance */
ok(A2.day(today).kind === 'none' && A2.day(today).value === null, 'no data → kind none, value null (not zero)');
A2.setUserSteps(today, 4321); ok(A2.day(today).kind === 'user' && A2.day(today).value === 4321 && A2.label(A2.day(today)) === 'הוזן ידנית', 'manual entry labelled "הוזן ידנית"');
const legacy = S2.load('tracking'); legacy.daily[S2.addDays(today, -1)] = { steps: 5000 }; S2.save('tracking');
ok(A2.day(S2.addDays(today, -1)).kind === 'user', 'pre-RC5 value without a source counts as typed in (the only path that existed)');
const now = new Date().toISOString();
ok(A2.applyMeasured([{ date: today, steps: 8000 }], 'healthkit', now) === 1, 'measured row stored');
ok(A2.day(today).kind === 'measured' && A2.day(today).value === 8000 && A2.day(today).user === 4321 && /Apple Health/.test(A2.label(A2.day(today))), 'measured wins for that day; the typed value is kept and labelled source shown');
A2.applyMeasured([{ date: today, steps: 8000 }], 'healthkit', now); A2.applyMeasured([{ date: today, steps: 8200 }], 'healthkit', now);
ok(A2.day(today).value === 8200, 're-sync replaces the day (no adding up): 8000 → 8200, not 16000/24200');
ok(A2.applyMeasured([{ date: S2.addDays(today, -2), steps: 0 }], 'healthkit', now) === 0 && A2.day(S2.addDays(today, -2)).kind === 'none', 'a 0 bucket is ignored (iOS: denied and no-data look the same)');
ok(A2.applyMeasured([{ date: 'bad', steps: 5 }, { date: today, steps: NaN }, { date: today, steps: -3 }], 'healthkit', now) === 0, 'invalid rows ignored');
let threw = false; try { A2.applyMeasured([{ date: today, steps: 1 }], 'demo', now); } catch (e) { threw = true; } ok(threw, 'unknown/demo source rejected');
ok(A2.health().state === 'never', 'health source not "connected" before any real read');
A2.setHealth({ state: 'error', lastError: 'x' }); ok(A2.health().state === 'error', 'error state stored');

/* MoveScore v0 */
const mk = (arr, extra) => arr.map((s, i) => Object.assign({ date: 'd' + i, steps: s, kind: s == null ? 'none' : 'user', rest: false }, extra && extra[i]));
ok(A2.moveScore(mk([8000, 8000, 8000, 8000, 8000, 8000, 8000]), null).reason === 'no-target', 'no target → no score');
ok(A2.moveScore(mk([8000, 8000, 8000, null, null, null, null]), 8000).score === null, '3 days of data, 4 missing → no score (missing is not zero)');
const four = A2.moveScore(mk([8000, null, 8000, null, 8000, null, 8000]), 8000);
ok(four.score != null && four.parts.consistency === 100, '4 days with data → score; missing days not counted as inactive', four);
const full = A2.moveScore(mk([20000, 20000, 20000, 20000, 20000, 20000, 20000]), 8000);
ok(full.score === 100 && full.parts.progress === 100 && full.parts.trend === null && full.weightsUsed.progress === 0.63, 'ceiling: capped at 100; no trend history → weights renormalised and reported', full);
ok(A2.moveScore(mk([0, 0, 0, 0, 0, 0, 0]), 8000).score === 0, 'floor: 0 steps every day → 0');
const withRest = A2.moveScore(mk([8000, 0, 8000, 8000, 0, 8000, 8000], [{}, { rest: true }, {}, {}, { rest: true }, {}, {}]), 8000);
const noRest = A2.moveScore(mk([8000, null, 8000, 8000, null, 8000, 8000]), 8000);
ok(withRest.score === noRest.score && withRest.restDays === 2, 'rest days are not punished (same score as if they were absent)', { withRest, noRest });
ok(A2.moveScore(mk([8000, 8000, 8000, 8000, 8000, 8000, 8000]).map(d => Object.assign(d, { kind: 'demo' })), 8000).score === null, 'demo data never scored');
ok(A2.moveScore(mk([8000, 8000, 8000, 8000, 8000, 8000, 8000]).map(d => Object.assign(d, { kind: 'test' })), 8000).score === null, 'test data never scored');
const prev = Array(28).fill(5000), up = A2.moveScore(mk(prev.concat([7500, 7500, 7500, 7500, 7500, 7500, 7500])), 8000), down = A2.moveScore(mk(prev.concat([2500, 2500, 2500, 2500, 2500, 2500, 2500])), 8000);
ok(up.parts.trend === 100 && down.parts.trend === 0, 'trend: +50% → 100 (capped at +20%), −50% → 0', { up: up.parts, down: down.parts });
const perDay = A2.moveScore(mk([5000, 5000, 5000, 5000, 5000, 5000, 5000], [{ target: 10000 }, { target: 10000 }, { target: 10000 }, { target: 5000 }, { target: 5000 }, { target: 5000 }, { target: 5000 }]), 5000);
ok(perDay.parts.consistency === 57, 'per-day targets: days before a target change use the old target (4/7 active)', perDay.parts);
ok(A2.suggestTarget(mk([6000, 6200, 5800, 7000, 6100, 5900, null])) === null, 'target suggestion needs ≥ 7 days of data');
ok(A2.suggestTarget(mk([6000, 6200, 5800, 7000, 6100, 5900, 6050])) === 6500, 'suggestion = median × 1.05 rounded to 500 (6050 → 6352 → 6500)');

/* dates: platform day buckets start at local midnight; mapping back must give the same local date in every TZ, incl. DST days */
const ld = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
let dateOk = true, bad = null;
for (const ymd of ['2026-03-26', '2026-03-27', '2026-03-28', '2026-10-24', '2026-10-25', '2026-10-26', '2026-11-01', '2026-03-08', '2026-12-31', '2027-01-01']) {
  const [y, m, d] = ymd.split('-').map(Number); const startLocal = new Date(y, m - 1, d, 0, 0, 0); const iso = startLocal.toISOString(); const back = ld(new Date(iso));
  if (back !== ymd) { dateOk = false; bad = { ymd, iso, back }; }
  const late = new Date(y, m - 1, d, 23, 59, 0); if (ld(new Date(late.toISOString())) !== ymd) { dateOk = false; bad = { ymd, late: late.toISOString() }; } }
ok(dateOk, 'local-midnight buckets and 23:59 samples map to the right local date (DST and new-year days)', bad);
const days35 = []; let dd = '2026-03-01'; for (let i = 0; i < 40; i++) { days35.push(dd); dd = S2.addDays(dd, 1); }
ok(new Set(days35).size === 40 && days35[26] === '2026-03-27' && days35[27] === '2026-03-28' && days35[29] === '2026-03-30', 'calendar day sequence has no gaps or repeats across DST');
res.forEach(r => { if (!r.ok) console.log('FAIL ' + r.m); });
console.log(`RESULT pass ${res.filter(r => r.ok).length} fail ${res.filter(r => !r.ok).length}`);
