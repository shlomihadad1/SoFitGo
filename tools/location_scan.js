/* M10.2 · place-specific text scan (Manali regression). The app has no location data, so nothing shipped to users may name a
   specific place/altitude as if the user were there. Scans, as UTF-8:
     1. app source shipped to users: src/js, src/data, src/css (docs and tests are NOT shipped and may discuss the bug);
     2. the built app: dist/pwa (all text files);
     3. every release archive given on the command line (each text entry inside the ZIP, decoded as UTF-8).
   --self-test first proves the scanner catches injected Hebrew AND English text in each of the three kinds of input.
   Usage: node tools/location_scan.js [--self-test] [archive.zip ...] */
const fs = require('fs'), path = require('path'), os = require('os'), { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const PAT = /מנאלי|manali|קולו(?![א-ת])|kullu|בגובה של כ־?\s?2,?000|2,?000 ?(מ׳|מטר|m\b)/gi;
const TEXT = /\.(js|html|css|json|webmanifest|txt|md|svg)$/i;
const walk = d => fs.existsSync(d) ? fs.readdirSync(d).flatMap(f => { const p = path.join(d, f); return fs.statSync(p).isDirectory() ? walk(p) : [p]; }) : [];
function scanFiles(files) { const hits = []; for (const f of files) { if (!TEXT.test(f)) continue; const t = fs.readFileSync(f, 'utf8'); let m; PAT.lastIndex = 0; while ((m = PAT.exec(t))) hits.push(`${path.relative(ROOT, f)}: …${t.slice(Math.max(0, m.index - 30), m.index + 40).replace(/\s+/g, ' ')}…`); } return hits; }
function scanZip(z) { const hits = []; const list = execFileSync('unzip', ['-Z1', z], { encoding: 'utf8' }).split('\n').filter(n => n && TEXT.test(n) && !/(^|\/)(docs|tools|test|tests)\//.test(n) && !/\.md$/i.test(n));
  for (const n of list) { const t = execFileSync('unzip', ['-p', z, n], { maxBuffer: 64 << 20 }).toString('utf8'); let m; PAT.lastIndex = 0; while ((m = PAT.exec(t))) hits.push(`${path.basename(z)}!${n}: …${t.slice(Math.max(0, m.index - 30), m.index + 40).replace(/\s+/g, ' ')}…`); } return { hits, scanned: list.length }; }
const srcFiles = () => ['src/js', 'src/data', 'src/css'].flatMap(d => walk(path.join(ROOT, d)));
const res = []; const ok = (c, m, i) => res.push({ ok: !!c, m: m + (!c && i ? ' → ' + JSON.stringify(i).slice(0, 600) : '') });
const args = process.argv.slice(2), zips = args.filter(a => a.endsWith('.zip'));

if (args.includes('--self-test')) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'locscan-'));
  const he = path.join(tmp, 'a.js'), en = path.join(tmp, 'b.html'), clean = path.join(tmp, 'c.js');
  fs.writeFileSync(he, "const tip = 'בשבוע הראשון — מנאלי נמצאת גבוה';"); fs.writeFileSync(en, '<p>Welcome to Manali</p>'); fs.writeFileSync(clean, "const tip = 'מתחילים בקצב מתון. משקולות, גומיות.';");
  ok(scanFiles([he]).length === 1, 'self-test: injected HEBREW place name is caught (UTF-8)');
  ok(scanFiles([en]).length === 1, 'self-test: injected English place name is caught');
  ok(scanFiles([clean]).length === 0, 'self-test: ordinary Hebrew text (incl. "גומיות", "גובה") is not flagged');
  fs.writeFileSync(path.join(tmp, 'd.js'), "x='בגובה של כ־2,000 מ׳'"); ok(scanFiles([path.join(tmp, 'd.js')]).length >= 1, 'self-test: altitude claim is caught');
  const z = path.join(tmp, 'inj.zip'); execFileSync('zip', ['-qj', z, he, clean]); ok(scanZip(z).hits.length === 1, 'self-test: injected Hebrew inside a ZIP archive is caught');
  fs.rmSync(tmp, { recursive: true, force: true });
}
const s = scanFiles(srcFiles()); ok(s.length === 0, `shipped source (src/js, src/data, src/css — ${srcFiles().length} files, UTF-8): no place-specific text`, s);
const dist = walk(path.join(ROOT, 'dist/pwa')).filter(f => !f.includes(path.sep + 'reports' + path.sep));
if (dist.length) { const d = scanFiles(dist); ok(d.length === 0, `built app dist/pwa (${dist.filter(f => TEXT.test(f)).length} text files): no place-specific text`, d); }
for (const z of zips) { const r = scanZip(z); ok(r.scanned > 0 && r.hits.length === 0, `archive ${path.basename(z)} (${r.scanned} shipped text files): no place-specific text`, r.hits); }
const fail = res.filter(r => !r.ok); res.forEach(r => console.log((r.ok ? 'PASS ' : 'FAIL ') + r.m));
console.log(`location scan: pass ${res.length - fail.length} fail ${fail.length}`); process.exit(fail.length ? 1 : 0);
