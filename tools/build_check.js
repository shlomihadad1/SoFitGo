/* Build checks: syntax of every source file, bundle parses, required PWA files present, no secrets/dev files. */
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const R = p => path.join(__dirname, '..', p); let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
for (const d of ['src/js', 'src/data', 'tools']) for (const f of fs.readdirSync(R(d)).filter(f => f.endsWith('.js'))) { try { execSync('node --check ' + JSON.stringify(R(d + '/' + f)), { stdio: 'pipe' }); ok(true); } catch (e) { ok(false, 'syntax ' + d + '/' + f); } }
const html = fs.readFileSync(R('dist/pwa/index.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
scripts.forEach((s, i) => { try { new Function(s); ok(true); } catch (e) { ok(false, 'bundle script ' + i + ' parses: ' + e.message); } });
for (const f of ['index.html', 'sw.js', 'manifest.webmanifest', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'README.txt']) ok(fs.existsSync(R('dist/pwa/' + f)), 'pwa file ' + f);
const man = JSON.parse(fs.readFileSync(R('dist/pwa/manifest.webmanifest'), 'utf8')); ok(man.start_url && man.display === 'standalone' && man.icons.length >= 3, 'manifest fields');
ok(/rel="manifest"/.test(html) && /apple-touch-icon/.test(html) && /viewport-fit=cover/.test(html), 'html links manifest/icons/viewport');
const files = fs.readdirSync(R('dist/pwa'), { recursive: true }).filter(f => fs.statSync(R('dist/pwa/' + f)).isFile()); // includes media/
const all = files.map(f => fs.readFileSync(R('dist/pwa/' + f)).toString('latin1')).join('\n');
/* M10: the account client legitimately names the GoTrue request fields (apikey header from the build config, password from the
   form variable). Only those exact usages are removed before the scan; any literal value is still caught, plus key/JWT checks. */
const LEGIT = /apikey:\s*CFG\.key|password:\s*pw\b|(weak|same)_password:|nothing secret in the browser|updatePassword|grant_type=password|(['"])password\2,\s*'autocomplete="(new|current)-password"|no password is ever stored|password reset|'text'\s*:\s*'password'|"text":"password"/g;
ok(!/(api[_-]?key|secret|password|BEGIN PRIVATE|sk-ant)/i.test(all.replace(LEGIT, '')), 'no secrets in build');
/* M10.1: the app has no location data, so the shipped bundle must not tell every user about a specific place (was: Manali tips) */
{ const allU = files.map(f => fs.readFileSync(R('dist/pwa/' + f), 'utf8')).join('\n'); /* UTF-8 here: `all` is latin1 and cannot match Hebrew */
  const loc = (allU.match(/מנאלי|manali|קולו\b|kullu|בגובה של כ־2,000/gi) || []); ok(loc.length === 0, 'no place-specific (Manali / Kullu / altitude) text anywhere in the shipped app', loc.slice(0, 5)); }
ok(!/sb_secret_[A-Za-z0-9]|sb_publishable_[A-Za-z0-9]|eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.|password\s*[:=]\s*["'`][^"'`]|postgres(ql)?:\/\//.test(all.replace(LEGIT, '')), 'standard build: no Supabase key, JWT, literal password or database URL');
ok(files.every(f => !/\.(map|log|json)$/.test(f) || f === 'manifest.webmanifest'), 'no dev files in build');
ok(files.filter(f => f.startsWith('media')).every(f => /\.(webp|mp4|webm)$/.test(f)), 'media folder holds only webp/mp4/webm');
ok(!files.some(f => /fixture|test-clip|test-photo/i.test(f)), 'no test fixtures in build');
const art = fs.readFileSync(R('dist/artifact/fit30.html'), 'utf8'); [...art.matchAll(/<script>([\s\S]*?)<\/script>/g)].forEach((m, i) => { try { new Function(m[1]); ok(true); } catch (e) { ok(false, 'artifact script parses'); } });
console.log(`build checks: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
