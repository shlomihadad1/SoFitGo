/* Service worker
   - app shell (index.html, manifest, icons) precached per build: 'fit30-<build>'; old shells deleted on activate
   - media images: cache on first view in 'fit30-media-v1', bounded to MEDIA_MAX entries (oldest removed first);
     media files are content-hashed, so a cached file can never be a stale version of another file
   - videos are NOT cached and not intercepted (range requests go straight to the network) — no offline video
   - fonts cached at runtime */
const CACHE = 'fit30-f015e15ed9', MEDIA = 'fit30-media-v1', MEDIA_MAX = 160;
const ASSETS = ['./', 'index.html', 'help.js', 'extra.js', 'account.js', 'cms.js', 'admin.js', 'sofitgo-config.js', 'manifest.webmanifest', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'sofit-avatar-192.webp', 'sofitgo-wordmark-provisional.png', 'sofitgo-symbol-provisional.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('fit30-') && k !== CACHE && k !== MEDIA && k !== 'fit30-fonts').map(k => caches.delete(k)))).then(() => self.clients.claim())); });
const trim = c => c.keys().then(ks => ks.length > MEDIA_MAX ? Promise.all(ks.slice(0, ks.length - MEDIA_MAX).map(k => c.delete(k))) : null);
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (u.origin === location.origin) {
    /* P0-F (RC5): only a real app shell may replace the cached one — never a login page (401/redirect), an error page or an
       opaque response; otherwise an expired host login or a 5xx would poison offline use. The live response is still shown. */
    if (e.request.mode === 'navigate') { e.respondWith(fetch(e.request).then(r => { if (r.ok && r.status === 200 && !r.redirected && r.type === 'basic' && /text\/html/.test(r.headers.get('content-type') || '')) { const c = r.clone(); c.text().then(t => { if (t.includes('window.FIT30_BUILD=')) caches.open(CACHE).then(x => x.put('index.html', new Response(t, { headers: { 'content-type': 'text/html; charset=utf-8' } }))); }); } return r; }).catch(() => caches.match('index.html'))); return; }
    /* M10: the accounts switch is read network-first (an edited file takes effect on the next launch); offline or after 3 s → cached copy */
    if (u.pathname.endsWith('/sofitgo-config.js')) { const cfg = () => caches.match('sofitgo-config.js'); const net = fetch(e.request, { cache: 'no-store' }).then(r => { if (r.ok && r.status === 200 && !r.redirected && /javascript/.test(r.headers.get('content-type') || '')) { const c = r.clone(); caches.open(CACHE).then(x => x.put('sofitgo-config.js', c)); } return r; });
      e.respondWith(Promise.race([net, new Promise(res => setTimeout(() => cfg().then(h => { if (h) res(h); }), 3000))]).catch(() => cfg())); return; }
    if (u.pathname.includes('/media/')) {
      if (/\.(mp4|webm|m4v|mov)$/i.test(u.pathname) || e.request.headers.has('range')) return; // video: network only
      e.respondWith(caches.open(MEDIA).then(c => c.match(e.request).then(hit => hit || fetch(e.request).then(r => { if (r.ok) { c.put(e.request, r.clone()).then(() => trim(c)); } return r; }))));
      return;
    }
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
  } else if (u.host.endsWith('fonts.googleapis.com') || u.host.endsWith('fonts.gstatic.com')) {
    e.respondWith(caches.open('fit30-fonts').then(c => c.match(e.request).then(r => { const f = fetch(e.request).then(n => { c.put(e.request, n.clone()); return n; }).catch(() => r); return r || f; })));
  }
});
