/* SoFitGo QA "agents" — one runner, seven roles. No AI model and no paid service: every role is a group of REAL test suites that
   already exist in tools/, run here and judged only by their own output.
     QA Manager      → this script: schedules the suites, collects results, assigns severity
     UI/UX           → RTL, screens, forms, keyboard, alignment, header/nav, flicker
     Authentication  → sign-up / login / logout / reset / session (local auth emulator over real PostgreSQL); live = opt-in
     Data & Security → RLS on real PostgreSQL, rollback, secret scans, place-text scan, save-failure handling; live isolation = opt-in
     Feature         → workouts, steps, goals, nutrition, recipes, water, progress, journal, plans
     Performance     → first-load budget, offline/service worker, single-file build, WebKit engine smoke test
     Report          → writes the Hebrew report (Markdown + JSON) and a short summary for the CI page
   Status per item: PASS · FAIL · BLOCKED (a precondition is missing — said why) · NOT TESTED (cannot be tested here — said why).
   A failure is never "fixed" automatically: auto-fix is BLOCKED until an approved AI model is configured; every failure is
   marked NEEDS HUMAN REVIEW. Nothing here deploys, changes DNS/SMTP/Supabase settings, or runs SQL on the live project.
   Usage: node tools/qa/run_qa.js [--mode full|quick] [--out dist/reports/qa]
   Live checks run only when QA_LIVE=1 AND the test-account variables are present (GitHub secrets); otherwise BLOCKED. */
const fs = require('fs'), path = require('path'), { spawn, execFileSync, spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const MODE = arg('--mode', 'full'), OUT = path.resolve(ROOT, arg('--out', 'dist/reports/qa')), LOGS = path.join(OUT, 'logs');
fs.mkdirSync(LOGS, { recursive: true });
const env = Object.assign({}, process.env, { PGHOST: process.env.PGHOST || '/tmp', PGPORT: process.env.PGPORT || '54329' });
const T = (name, opts) => Object.assign({ name, cmd: ['node', `tools/${name}.js`], timeout: 900, needs: [] }, opts || {});
const AGENTS = [
  { k: 'ui', he: 'UI/UX', sev: 'P1', suites: [T('e2e_m10_ux'), T('e2e_rc1_layout'), T('e2e_shell'), T('e2e_m9_identity'), T('e2e_i18n')] },
  { k: 'auth', he: 'אימות משתמשים (Authentication)', sev: 'P0', suites: [T('e2e_account', { timeout: 1200, needs: ['pg'] })], live: ['auth'] },
  { k: 'data', he: 'נתונים ואבטחה (Data & Security)', sev: 'P0', suites: [T('rls_test', { needs: ['pg'] }), T('rollback_test', { needs: ['pg'] }), T('build_check'), T('rc1_final_test'), T('location_scan', { cmd: ['node', 'tools/location_scan.js', '--self-test'] }), T('e2e_savefail')], live: ['isolation'] },
  { k: 'feature', he: 'פיצ׳רים (Feature)', sev: 'P1', suites: [T('e2e'), T('e2e_stageB'), T('e2e_stageC'), T('e2e_stageD'), T('e2e_stageE'), T('e2e_stageF'), T('e2e_stageG'), T('e2e_stageH1'), T('e2e_rc1'), T('e2e_beta'), T('e2e_meal_journal'), T('e2e_now'), T('e2e_activity'), T('e2e_grocery'), T('e2e_fridge'), T('e2e_planb_feedback'), T('e2e_m8'),
    T('content_test'), T('stageA_test'), T('stageB_test'), T('stageC_test'), T('stageD_test'), T('stageE_test'), T('stageF_test'), T('stageG_test'), T('stageH1_test'), T('rc1_test', { full: true }), T('rc2_dev_test'), T('td21_test'), T('td22_test'), T('ramp_test'), T('load_guard_test'), T('activity_test'), T('recipe_gate'), T('soak_test', { timeout: 1200 })] },
  { k: 'perf', he: 'ביצועים ותאימות (Performance & Compatibility)', sev: 'P2', suites: [T('e2e_stageA'), T('e2e_sw_shell'), T('artcheck', { cmd: ['node', 'tools/artcheck.js', path.join(ROOT, 'dist/artifact/fit30.html')], parse: 'count' }), T('webkit_smoke', { cmd: ['node', 'tools/qa/webkit_smoke.js'], blockedExit: 3 })] }
];
const QUICK = new Set(['e2e_m10_ux', 'e2e_shell', 'e2e_account', 'rls_test', 'build_check', 'rc1_final_test', 'location_scan', 'e2e', 'e2e_meal_journal', 'content_test', 'e2e_stageA']);
const NOT_TESTABLE = [
  ['ui', 'Safari אמיתי על iPhone/iPad', 'אין מכשיר או Safari בסביבת ההרצה. WebKit של Playwright הוא המנוע של Safari, לא Safari עצמו. נדרשת בדיקה ידנית לפי SAFARI-DEVICE-CHECKLIST.md.'],
  ['auth', 'משלוח מייל אמיתי, קישור אימות ושחזור סיסמה בתיבת דואר', 'אין גישה לתיבת דואר. בנוסף, ה־SMTP המובנה של Supabase מוגבל ל־2 מיילים בשעה, ולכן הבדיקה לא שולחת מיילים.'],
  ['feature', 'מאמן AI (Sofit AI)', 'הפיצ׳ר לא מופעל בבטא, בכוונה: אין API בתשלום בלי אישור. נבדק רק שהממשק לא מציג תשובות מזויפות (e2e_now ו־e2e_m8).'],
  ['feature', 'תוכניות מנוי', 'אין תוכניות מנוי באפליקציה. אין מה לבדוק.']
];
const sh = (c, a) => { try { return execFileSync(c, a, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch (e) { return ''; } };
const meta = { startedAt: new Date(), mode: MODE, commit: sh('git', ['rev-parse', '--short', 'HEAD']) || process.env.GITHUB_SHA || '?', branch: sh('git', ['rev-parse', '--abbrev-ref', 'HEAD']) || process.env.GITHUB_REF_NAME || '?', build: null };
const servers = [];
async function up(port) { try { const r = await fetch(`http://localhost:${port}/`); return r.ok; } catch (e) { return false; } }
const pgOk = () => spawnSync('pg_isready', ['-h', env.PGHOST, '-p', env.PGPORT], { stdio: 'ignore' }).status === 0;
function runSuite(s) {
  return new Promise(resolve => {
    const logf = path.join(LOGS, s.name + '.log'), out = fs.openSync(logf, 'w'), t0 = Date.now();
    const ch = spawn(s.cmd[0], s.cmd.slice(1), { cwd: ROOT, env, stdio: ['ignore', out, out] });
    const timer = setTimeout(() => { ch.kill('SIGKILL'); }, s.timeout * 1000);
    ch.on('exit', (code, sig) => { clearTimeout(timer); fs.closeSync(out); const txt = fs.readFileSync(logf, 'utf8'); resolve({ code, sig, txt, sec: Math.round((Date.now() - t0) / 1000), log: path.relative(ROOT, logf) }); });
  });
}
function judge(s, r) {
  if (s.blockedExit !== undefined && r.code === s.blockedExit) return { status: 'BLOCKED', why: (r.txt.match(/BLOCKED: (.*)/) || [])[1] || 'precondition missing' };
  if (r.sig === 'SIGKILL') return { status: 'FAIL', why: `timeout after ${s.timeout}s`, fails: [] };
  let pass = 0, fail = 0;
  if (s.parse === 'count') { const ls = r.txt.split('\n'); fail = ls.filter(l => /\bFAIL\b/.test(l)).length; pass = ls.filter(l => !/\bFAIL\b/.test(l) && /\bPASS\b/.test(l)).length; } /* artcheck prints PASS/FAIL at the END of each line */
  else { const m = [...r.txt.matchAll(/pass (\d+) fail (\d+)/gi)].pop(); if (m) { pass = +m[1]; fail = +m[2]; } }
  const fails = r.txt.split('\n').filter(l => /^FAIL\b|^ - |crashed|Error:/.test(l)).slice(0, 12).map(l => l.slice(0, 400));
  if (r.code === 0 && fail === 0 && pass > 0) return { status: 'PASS', pass, fail };
  return { status: 'FAIL', pass, fail, fails, why: r.code !== 0 && !fail ? `exit code ${r.code} (crash or error before the summary line)` : `${fail} failed checks` };
}
(async () => {
  console.log(`QA run · mode ${MODE} · commit ${meta.commit} · branch ${meta.branch}`);
  const b = spawnSync('node', ['tools/build.js'], { cwd: ROOT, env, encoding: 'utf8' }); fs.writeFileSync(path.join(LOGS, 'build.log'), (b.stdout || '') + (b.stderr || ''));
  meta.build = ((b.stdout || '').match(/built ([0-9a-f]+) pwa (\d+)/) || [])[1] || null; meta.buildOk = b.status === 0;
  for (const port of [8096, 8091]) if (!(await up(port))) { servers.push(spawn('python3', ['-m', 'http.server', String(port), '-d', path.join(ROOT, 'dist/pwa')], { stdio: 'ignore' })); }
  await new Promise(r => setTimeout(r, 1200));
  spawnSync('sh', ['tools/pg_local.sh'], { cwd: ROOT, env, stdio: 'ignore' }); const pg = pgOk();
  const results = [];
  for (const a of AGENTS) for (const s of a.suites) {
    if (MODE === 'quick' && !QUICK.has(s.name)) { results.push({ agent: a.k, suite: s.name, status: 'NOT TESTED', why: 'quick mode (PR) — runs in the daily full run' }); continue; }
    if (s.full && MODE !== 'full') continue;
    if (!meta.buildOk) { results.push({ agent: a.k, suite: s.name, status: 'BLOCKED', why: 'build failed (see logs/build.log)' }); continue; }
    if (s.needs.includes('pg') && !pg) { results.push({ agent: a.k, suite: s.name, status: 'BLOCKED', why: `PostgreSQL not reachable at ${env.PGHOST}:${env.PGPORT}` }); continue; }
    process.stdout.write(`  ${a.k.padEnd(8)} ${s.name.padEnd(20)} `);
    const r = await runSuite(s), j = judge(s, r); console.log(`${j.status}${j.pass !== undefined ? ` (${j.pass}/${j.pass + j.fail})` : ''} ${r.sec}s`);
    results.push(Object.assign({ agent: a.k, suite: s.name, sec: r.sec, log: r.log, cmd: s.cmd.join(' ').replace(ROOT + '/', '') }, j));
  }
  /* live checks against the real project — opt-in, test accounts only, never SQL */
  const L = process.env, liveEnv = L.QA_LIVE === '1' && L.SOFITGO_SUPABASE_URL && L.SOFITGO_SUPABASE_PUBLISHABLE_KEY, twoUsers = L.LIVE_A_EMAIL && L.LIVE_A_PASSWORD && L.LIVE_B_EMAIL && L.LIVE_B_PASSWORD;
  if (liveEnv) {
    const r = await runSuite(T('live_check', { timeout: 300 })), j = judge({}, r);
    results.push(Object.assign({ agent: 'data', suite: 'live_check (Supabase החי' + (twoUsers ? ', שני משתמשי בדיקה' : ', אנונימי בלבד') + ')', sec: r.sec, log: r.log }, j));
    if (!twoUsers) results.push({ agent: 'auth', suite: 'live: התחברות, שמירה ובידוד בין משתמשים', status: 'BLOCKED', why: 'חסרים סודות LIVE_A_*/LIVE_B_* של שני משתמשי בדיקה מאושרים' });
  } else results.push({ agent: 'data', suite: 'live_check (Supabase החי)', status: 'BLOCKED', why: 'לא הופעל: נדרשים QA_LIVE=1 וסודות של שני משתמשי בדיקה ייעודיים (ב־GitHub Secrets). אין בדיקות על הפרויקט החי בלי אישור.' });
  for (const [a, s, why] of NOT_TESTABLE) results.push({ agent: a, suite: s, status: 'NOT TESTED', why });
  results.push({ agent: 'manager', suite: 'תיקון אוטומטי', status: 'BLOCKED', why: 'אין גישה מאושרת למודל AI ב־CI. כל כישלון מסומן NEEDS HUMAN REVIEW. לא מתבצע תיקון ולא נפתח PR אוטומטי.' });
  servers.forEach(s => s.kill());
  meta.finishedAt = new Date();
  /* ── Report agent ── */
  const he = { PASS: 'עבר', FAIL: 'נכשל', BLOCKED: 'חסום', 'NOT TESTED': 'לא נבדק' };
  const cnt = st => results.filter(r => r.status === st).length;
  const checks = results.reduce((a, r) => ({ pass: a.pass + (r.pass || 0), fail: a.fail + (r.fail || 0) }), { pass: 0, fail: 0 });
  const sevOf = r => (AGENTS.find(a => a.k === r.agent) || { sev: 'P2' }).sev;
  const fails = results.filter(r => r.status === 'FAIL').sort((x, y) => sevOf(x).localeCompare(sevOf(y)));
  const ist = d => new Date(d.getTime() + 330 * 60000).toISOString().replace('T', ' ').slice(0, 16) + ' (שעון הודו)';
  const ready = !fails.some(r => /P0|P1/.test(sevOf(r))) && meta.buildOk;
  let md = `# דו״ח QA יומי — SoFitGo\n\n| | |\n|---|---|\n| תאריך ושעה | ${ist(meta.startedAt)} |\n| commit / ענף | \`${meta.commit}\` · \`${meta.branch}\` |\n| build | \`${meta.build || 'נכשל'}\` |\n| מצב הרצה | ${MODE === 'full' ? 'מלא (יומי)' : 'מהיר (PR)'} · ${Math.round((meta.finishedAt - meta.startedAt) / 60000)} דק׳ |\n| סביבה | Chromium (Playwright) עם אמולציית iPhone/iPad · PostgreSQL ${pg ? 'זמין' : 'לא זמין'} · שרת Supabase מקומי (אמולטור) |\n\n`;
  md += `## סיכום\n- חבילות בדיקה: **${cnt('PASS')} עברו · ${cnt('FAIL')} נכשלו · ${cnt('BLOCKED')} חסומות · ${cnt('NOT TESTED')} לא נבדקו**\n- בדיקות בודדות: ${checks.pass} עברו · ${checks.fail} נכשלו\n- **המלצה:** ${ready ? 'גרסת הבדיקה מוכנה לבחינת אדם (זה לא אישור לפריסה).' : 'לא מוכנה. יש כישלונות בחומרה P0/P1, או שהבנייה נכשלה.'}\n\n`;
  md += `## תקלות לפי חומרה\n` + (fails.length ? fails.map(r => `### ${sevOf(r)} · ${r.suite} — NEEDS HUMAN REVIEW\n- סוכן: ${(AGENTS.find(a => a.k === r.agent) || {}).he}\n- תוצאה: ${r.why}${r.pass !== undefined ? ` (${r.pass} עברו, ${r.fail} נכשלו)` : ''}\n- שחזור: \`${r.cmd}\` (דורש שרתים על 8096 ו־8091 שמגישים את dist/pwa)\n- לוג: \`${r.log}\`\n- צפוי מול בפועל (מתוך הבדיקה; המסך ורוחב המסך מופיעים בסוגריים המרובעים):\n${(r.fails || []).map(f => '  - ' + f.replace(/\|/g, '/')).join('\n') || '  - (אין שורת FAIL. ראו בלוג)'}\n`).join('\n') : 'אין תקלות בהרצה הזו.\n');
  md += `\n## תוצאות לפי סוכן\n`;
  for (const a of [{ k: 'manager', he: 'מנהל QA' }].concat(AGENTS)) { const rs = results.filter(r => r.agent === a.k); if (!rs.length) continue;
    md += `\n### ${a.he}\n| בדיקה | מצב | פירוט |\n|---|---|---|\n` + rs.map(r => `| ${r.suite} | ${he[r.status]} | ${r.status === 'PASS' ? `${r.pass}/${r.pass + r.fail} · ${r.sec}s` : (r.why || '').replace(/\|/g, '/')} |`).join('\n') + '\n'; }
  md += `\n## תיקונים אוטומטיים\nלא בוצעו. **BLOCKED:** אין מודל AI מאושר ב־CI. תקלות מסומנות NEEDS HUMAN REVIEW. אין merge אוטומטי ואין פריסה.\n\n## בדיקות אבטחה שלא הושלמו או דורשות בדיקה ידנית\n- בידוד בין שני משתמשים מול Supabase החי: ${results.some(r => /live_check/.test(r.suite) && r.status === 'PASS' && /שני/.test(r.suite)) ? 'בוצע בהרצה הזו.' : 'לא בוצע (חסום, ראו למעלה). ה־RLS נבדק על PostgreSQL אמיתי עם ה־migration (rls_test) ודרך ה־API של האמולטור (e2e_account).'}\n- משלוח מיילים וקישורי אימות: בדיקה ידנית.\n\n## מגבלות\n- אין Safari אמיתי ואין מכשיר. Chromium הוא אמולציה; WebKit (אם רץ) הוא המנוע של Safari, לא Safari.\n- שרת ה־Supabase המקומי הוא אמולטור מעל PostgreSQL אמיתי, ולא השירות המתארח.\n- צילומי מסך: רק בדיקות שיוצרות אותם (בתיקיית הדו״חות).\n`;
  fs.writeFileSync(path.join(OUT, 'qa-report.md'), md);
  fs.writeFileSync(path.join(OUT, 'qa-report.json'), JSON.stringify({ meta, counts: { pass: cnt('PASS'), fail: cnt('FAIL'), blocked: cnt('BLOCKED'), notTested: cnt('NOT TESTED') }, checks, ready, results: results.map(r => Object.assign({}, r, { severity: r.status === 'FAIL' ? sevOf(r) : undefined })) }, null, 1));
  fs.writeFileSync(path.join(OUT, 'summary.md'), `## QA SoFitGo · \`${meta.build || 'build failed'}\` · ${MODE}\n**${cnt('PASS')} עברו · ${cnt('FAIL')} נכשלו · ${cnt('BLOCKED')} חסומות · ${cnt('NOT TESTED')} לא נבדקו** · ${checks.pass}/${checks.pass + checks.fail} בדיקות\n\n${fails.map(r => `- ❌ ${sevOf(r)} ${r.suite}: ${r.why}`).join('\n') || '- ✅ אין כישלונות'}\n\n${ready ? 'מוכן לבחינת אדם (לא אישור פריסה)' : 'לא מוכן'} · הדו״ח המלא ב־artifact \`qa-report\`.\n`);
  console.log(`\nreport: ${path.relative(ROOT, path.join(OUT, 'qa-report.md'))} · PASS ${cnt('PASS')} · FAIL ${cnt('FAIL')} · BLOCKED ${cnt('BLOCKED')} · NOT TESTED ${cnt('NOT TESTED')}`);
  process.exit(cnt('FAIL') || !meta.buildOk ? 1 : 0);
})().catch(e => { console.error('QA runner crashed: ' + e.stack); servers.forEach(s => s.kill()); process.exit(2); });
