/* Measures how many bytes Fit30 writes to localStorage after the soak scenarios (~1 year of simulated use), by installing a
   counting localStorage shim before the app code loads, then running the existing soak test. Read-only for the repo except
   the soak report it already writes (run against a scratch copy). */
const path = require('path'); const ROOT = process.argv[2]; const mem = new Map(); let peak = 0;
const size = () => { let n = 0; for (const [k, v] of mem) n += (k.length + v.length) * 2; return n; }; /* UTF-16 chars × 2 bytes */
globalThis.localStorage = { getItem: k => mem.has(k) ? mem.get(k) : null, setItem: (k, v) => { mem.set(k, String(v)); peak = Math.max(peak, size()); }, removeItem: k => mem.delete(k), key: i => [...mem.keys()][i], get length() { return mem.size; }, clear: () => mem.clear() };
process.on('exit', () => { const per = [...mem].map(([k, v]) => [k, (k.length + v.length) * 2]).sort((a, b) => b[1] - a[1]).slice(0, 6);
  console.log('STORAGE peak bytes (UTF-16):', peak, '| final:', size(), '| largest keys:', JSON.stringify(per)); });
process.chdir(ROOT); require(path.join(ROOT, 'tools/soak_test.js'));
