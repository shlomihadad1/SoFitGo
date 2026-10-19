/* TEST FIXTURES ONLY — never shipped and never mapped to real content.
   test-clip.webm: 2 s synthetic clip (moving bar) recorded with Chromium MediaRecorder; test-photo.jpg: flat test card. */
const { chromium } = require('playwright'); const sharp = require('sharp'); const fs = require('fs'), path = require('path');
const D = path.join(__dirname, 'fixtures');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const b64 = await p.evaluate(async () => { const c = document.createElement('canvas'); c.width = 320; c.height = 180; const x = c.getContext('2d');
    const rec = new MediaRecorder(c.captureStream(25), { mimeType: 'video/webm;codecs=vp8' }); const parts = []; rec.ondataavailable = e => parts.push(e.data);
    let t0 = performance.now(); const draw = () => { const k = (performance.now() - t0) / 2000; x.fillStyle = '#123'; x.fillRect(0, 0, 320, 180); x.fillStyle = '#f2a33a'; x.fillRect(20 + k * 260, 70, 40, 40); x.fillStyle = '#fff'; x.font = '16px sans-serif'; x.fillText('TEST FIXTURE', 110, 30); if (k < 1) requestAnimationFrame(draw); };
    rec.start(); draw(); await new Promise(r => setTimeout(r, 2100)); rec.stop(); await new Promise(r => rec.onstop = r);
    const buf = await new Blob(parts, { type: 'video/webm' }).arrayBuffer(); let s = ''; new Uint8Array(buf).forEach(v => { s += String.fromCharCode(v); }); return btoa(s); });
  fs.writeFileSync(path.join(D, 'test-clip.webm'), Buffer.from(b64, 'base64')); await b.close();
  await sharp({ create: { width: 1200, height: 900, channels: 3, background: '#2d6a4f' } }).composite([{ input: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900"><rect x="100" y="100" width="1000" height="700" fill="none" stroke="#fff" stroke-width="20"/><text x="600" y="470" font-size="90" text-anchor="middle" fill="#fff" font-family="sans-serif">TEST FIXTURE</text></svg>') }]).jpeg({ quality: 80 }).toFile(path.join(D, 'test-photo.jpg'));
  console.log('fixtures', fs.readdirSync(D).map(f => f + ' ' + fs.statSync(path.join(D, f)).size).join(', '));
})();
