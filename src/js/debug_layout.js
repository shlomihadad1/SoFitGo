/* RC5 layout diagnostics — loaded ONLY when the URL has ?debug=layout (separate file, not part of the app bundle).
   Purpose: collect evidence on a real iPhone for the "header / top controls disappear at rest" report, which could not be
   reproduced in Chromium. It changes nothing unless a toggle below is switched on, and every toggle is undone on reload.
   Shows live: safe-area insets as the browser resolves them, viewport / visual viewport, scroll position, where the header is,
   what element is actually on top at the header's centre (hit test), display mode, and the Netlify badge frame if present. */
(function () {
  const st = document.createElement('style');
  st.textContent = `
  #dbg-lay { position: fixed; left: 8px; right: 8px; bottom: calc(var(--nav-h, 64px) + 10px + env(safe-area-inset-bottom, 0px)); z-index: 2147483646;
    background: rgba(0,0,0,.88); color: #e8ffd0; font: 11px/1.35 ui-monospace, Menlo, monospace; border: 1px solid #adff2f; border-radius: 10px; padding: 8px; direction: ltr; text-align: left; max-height: 46vh; overflow: auto; }
  #dbg-lay pre { margin: 0; white-space: pre-wrap; }
  #dbg-lay .r { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
  #dbg-lay button { font: inherit; background: #1b1e25; color: #e8ffd0; border: 1px solid #555; border-radius: 6px; padding: 6px 8px; min-height: 32px; }
  #dbg-lay button[aria-pressed="true"] { background: #adff2f; color: #0b0c10; }
  #dbg-probe { position: fixed; top: 0; left: 0; width: 0; height: 0; visibility: hidden; pointer-events: none;
    padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px); }
  html.dbg-no-blur .top { -webkit-backdrop-filter: none !important; backdrop-filter: none !important; background: #0b0c10 !important; }
  /* B restores the RC4 shell exactly, to compare on the device: fixed strip (z 30) above a sticky header offset by the inset */
  html.dbg-legacy body::before { content: ""; position: fixed; inset: 0 0 auto; height: env(safe-area-inset-top, 0px); z-index: 30; background: #0b0c10; }
  html.dbg-legacy .top { top: env(safe-area-inset-top, 0px) !important; padding-top: 0 !important; }
  html.dbg-osb body { overscroll-behavior-y: auto !important; }
  html.dbg-no-sticky .top { position: relative !important; }`;
  document.head.appendChild(st);
  const probe = document.createElement('div'); probe.id = 'dbg-probe'; document.body.appendChild(probe);
  const box = document.createElement('div'); box.id = 'dbg-lay'; box.setAttribute('aria-hidden', 'true');
  const TOG = [['dbg-no-blur', 'A: no backdrop-filter'], ['dbg-legacy', 'B: RC4 shell (strip over header)'], ['dbg-osb', 'C: overscroll auto'], ['dbg-no-sticky', 'D: header not sticky']];
  box.innerHTML = '<pre id="dbg-out"></pre><div class="r">' + TOG.map(([c, t]) => `<button type="button" data-c="${c}" aria-pressed="false">${t}</button>`).join('') + '<button type="button" data-x="min">hide</button></div>';
  document.body.appendChild(box);
  const out = box.querySelector('#dbg-out'); const log = []; let worst = null;
  box.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.x) { out.hidden = !out.hidden; return; }
    const on = document.documentElement.classList.toggle(b.dataset.c); b.setAttribute('aria-pressed', on); upd('toggle'); });
  const px = v => Math.round(parseFloat(v) || 0);
  function upd(why) {
    const cs = getComputedStyle(probe), top = document.getElementById('top'), r = top ? top.getBoundingClientRect() : null, vv = window.visualViewport;
    const strip = px(getComputedStyle(document.body, '::before').height);
    let hit = '—', covered = false;
    const h1 = top && top.querySelector('h1'), hr = h1 ? h1.getBoundingClientRect() : r; /* hit-test the title itself: since RC5 the header also contains the status-bar padding */
    if (r) { const el = document.elementFromPoint(Math.round(hr.left + hr.width / 2), Math.round(hr.top + hr.height / 2)); covered = !el || !top.contains(el); hit = el ? (el === document.body ? 'BODY (or body::before strip)' : el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : '')) : 'nothing (off-screen)'; }
    const insetTop = px(cs.paddingTop), visible = r ? Math.max(0, Math.round(Math.min(hr.bottom, vv ? vv.height : innerHeight) - Math.max(hr.top, strip, insetTop))) : 0;
    const nf = [...document.querySelectorAll('iframe')].filter(f => getComputedStyle(f).position === 'fixed').map(f => { const q = f.getBoundingClientRect(); return `${Math.round(q.left)},${Math.round(q.top)} ${Math.round(q.width)}x${Math.round(q.height)}`; });
    const row = { t: new Date().toISOString().slice(11, 19), why, scrollY: Math.round(scrollY), hdrTop: r && Math.round(r.top), hdrBottom: r && Math.round(r.bottom), visible, covered, hit };
    if (covered || visible < 10) { log.push(row); if (log.length > 6) log.shift(); worst = row; }
    out.textContent = [
      `build ${window.FIT30_BUILD || '?'} · ${(navigator.userAgent.match(/(iPhone|iPad|Android)[^;)]*|Version\/[\d.]+|CriOS\/[\d.]+|Chrome\/[\d.]+/g) || []).join(' ')}`,
      `display-mode standalone: ${matchMedia('(display-mode: standalone)').matches || navigator.standalone === true}`,
      `safe-area top/right/bottom/left: ${px(cs.paddingTop)}/${px(cs.paddingRight)}/${px(cs.paddingBottom)}/${px(cs.paddingLeft)}  · top strip (body::before): ${strip}px`,
      `inner ${innerWidth}x${innerHeight} · visualViewport ${vv ? Math.round(vv.width) + 'x' + Math.round(vv.height) + ' offTop ' + Math.round(vv.offsetTop) + ' pageTop ' + Math.round(vv.pageTop) : 'n/a'} · scrollY ${Math.round(scrollY)}`,
      `header rect top ${row.hdrTop} bottom ${row.hdrBottom} · title top ${hr ? Math.round(hr.top) : '?'} · title visible px ${visible} · position ${top ? getComputedStyle(top).position : '?'} padTop ${top ? px(getComputedStyle(top).paddingTop) : '?'}`,
      `on top at header centre: ${hit}${covered ? '  ← HEADER COVERED' : ''}`,
      `fixed iframes (e.g. host badge): ${nf.length ? nf.join(' | ') : 'none'}`,
      `toggles on: ${TOG.filter(([c]) => document.documentElement.classList.contains(c)).map(([, t]) => t[0]).join(',') || 'none'}`,
      log.length ? 'last header problems:\n' + log.map(x => `  ${x.t} ${x.why} y=${x.scrollY} top=${x.hdrTop} vis=${x.visible} hit=${x.hit}`).join('\n') : 'no header problem seen yet'
    ].join('\n');
  }
  let raf = 0; const sched = why => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; upd(why); }); };
  addEventListener('scroll', () => sched('scroll'), { passive: true }); addEventListener('resize', () => sched('resize'));
  addEventListener('hashchange', () => setTimeout(() => upd('route'), 300));
  if (window.visualViewport) { visualViewport.addEventListener('resize', () => sched('vv-resize')); visualViewport.addEventListener('scroll', () => sched('vv-scroll')); }
  addEventListener('touchend', () => setTimeout(() => upd('touchend+300ms'), 300), { passive: true });
  setInterval(() => upd('tick'), 1500); upd('load');
})();
