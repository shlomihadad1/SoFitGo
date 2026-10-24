/* Release Evidence Bundle: one Markdown file per tested build, generated from the ACTUAL runner output (never typed by hand).
   Classifies every suite as PASS, FAIL (assertions failed), CRASH (runner crashed, exit 2), TIMEOUT (exit 124), or NOT_RUN
   (expected suite with no result line). It also records the commit, the build id, the first-load size and the ZIP check if given.
   Usage: node tools/release_evidence.js <run_all stdout file> [zip file]  → dist/reports/RELEASE-EVIDENCE-<build>.md */
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..'), [, , runFile, zipFile] = process.argv;
if (!runFile) { console.error('usage: node tools/release_evidence.js <run_all output> [zip]'); process.exit(2); }
const out = fs.readFileSync(runFile, 'utf8').split('\n');
const git = a => { try { return execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim(); } catch (e) { return '?'; } };
const build = (out.find(l => /^built [0-9a-f]{10}/.test(l)) || '').split(' ')[1] || '?';
const rows = [];
for (const l of out) {
  let m = /^(\S+) exit=(\d+) :: (.*)$/.exec(l); if (m) { const code = +m[2], res = m[3];
    const counts = /pass (\d+) fail (\d+)/.exec(res);
    const state = code === 0 ? 'PASS' : code === 124 ? 'TIMEOUT' : code === 2 || /crashed/.test(res) ? 'CRASH' : 'FAIL';
    rows.push({ suite: m[1], state, pass: counts ? +counts[1] : null, fail: counts ? +counts[2] : null, line: res.slice(0, 160) }); continue; }
  m = /^artcheck :: (\d+) PASS \/ (\d+) FAIL/.exec(l); if (m) rows.push({ suite: 'artcheck', state: +m[2] ? 'FAIL' : 'PASS', pass: +m[1], fail: +m[2], line: l });
}
const sh = fs.readFileSync(path.join(ROOT, 'tools/run_all.sh'), 'utf8'), expected = new Set();
for (const m of sh.matchAll(/for t in ([^;]+); do/g)) m[1].trim().split(/\s+/).forEach(t => expected.add(t));
for (const m of sh.matchAll(/node tools\/([a-z0-9_]+)\.js/g)) if (!['build', 'artcheck'].includes(m[1])) expected.add(m[1]);
expected.forEach(t => { if (fs.existsSync(path.join(ROOT, 'tools', t + '.js')) && !rows.some(r => r.suite === t)) rows.push({ suite: t, state: 'NOT_RUN', pass: null, fail: null, line: 'no result line in the runner output' }); });
const tot = s => rows.filter(r => r.state === s).length, checks = rows.reduce((a, r) => a + (r.pass || 0), 0), fails = rows.reduce((a, r) => a + (r.fail || 0), 0);
let zip = 'not given';
if (zipFile) { try { execFileSync('unzip', ['-tq', zipFile], { stdio: 'pipe' }); const sw = execFileSync('unzip', ['-p', zipFile, 'sofitgo/sw.js'], { encoding: 'utf8' }); zip = `${path.basename(zipFile)} · ${fs.statSync(zipFile).size} B · unzip -t OK · sw.js build ${/fit30-([0-9a-f]{10})/.exec(sw) ? /fit30-([0-9a-f]{10})/.exec(sw)[1] : '?'}`; } catch (e) { zip = 'ZIP check FAILED: ' + e.message.slice(0, 120); } }
const idx = path.join(ROOT, 'dist/pwa/index.html'), firstLoad = (() => { try { return ['index.html'].reduce((a, f) => a + fs.statSync(path.join(ROOT, 'dist/pwa', f)).size, 0); } catch (e) { return null; } })();
const md = `# Release Evidence: build ${build}

- Commit: \`${git(['rev-parse', 'HEAD'])}\` (${git(['rev-parse', '--abbrev-ref', 'HEAD'])}); working tree ${git(['status', '--porcelain']) ? '**not clean**' : 'clean'}
- Generated: ${new Date().toISOString()} from \`${path.basename(runFile)}\` (the actual runner output)
- Environment: local container, Node ${process.version}. Browsers are Playwright Chromium/WebKit **emulation**, not physical devices. The backend is a local PostgreSQL 16 emulator, not the hosted project.
- Command: \`sh tools/run_all.sh\`
- index.html size: ${firstLoad} B (the first-load budget, including network, is asserted by e2e_stageA)
- ZIP: ${zip}

| Result | Suites |
|---|---|
| PASS | ${tot('PASS')} |
| FAIL (assertions) | ${tot('FAIL')} |
| CRASH (runner crash) | ${tot('CRASH')} |
| TIMEOUT | ${tot('TIMEOUT')} |
| NOT_RUN | ${tot('NOT_RUN')} |

Checks counted from the suites' own summaries: ${checks} passed, ${fails} failed.

| Suite | Result | Pass | Fail | Runner line |
|---|---|---|---|---|
${rows.map(r => `| ${r.suite} | ${r.state} | ${r.pass ?? ''} | ${r.fail ?? ''} | ${r.line.replace(/\|/g, '/')} |`).join('\n')}

Manual tests still required: a physical iPhone (Safari) and an Android device; the live Supabase project after the owner applies the CMS migration.
`;
fs.mkdirSync(path.join(ROOT, 'dist/reports'), { recursive: true }); const f = path.join(ROOT, 'dist/reports', `RELEASE-EVIDENCE-${build}.md`); fs.writeFileSync(f, md);
console.log(`release evidence: ${f} · PASS ${tot('PASS')} FAIL ${tot('FAIL')} CRASH ${tot('CRASH')} TIMEOUT ${tot('TIMEOUT')} NOT_RUN ${tot('NOT_RUN')}`);
