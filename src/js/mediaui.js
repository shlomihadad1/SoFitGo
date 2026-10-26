/* Media components (Stage A). Metadata comes from window.MEDIA (src/data/media.js, generated); files live in media/.
   States: images  → data-mstate = loading | ready | error   (+ 'missing' when there is no asset at all)
           video   → data-mstate = idle | loading | ready | playing | paused | error
   Rules: nothing is preloaded (poster <img loading=lazy>, the <video> element is created only on the first tap);
   when an asset is missing or fails, a clearly labelled illustration is shown — never presented as a photo/video. */
(function (root) {
  'use strict';
  const { esc, icon } = root.UI;
  const BASE = 'media/';
  const M = () => root.MEDIA || { ex: {}, rc: {}, credits: {} };
  const on = () => root.FIT30_ENV !== 'artifact' && root.FIT30_MEDIA !== false; // the single-file artifact has no media folder
  const prefs = (() => { let p = { loop: true }; try { Object.assign(p, JSON.parse(localStorage.getItem('fit30.mediaPrefs') || '{}')); } catch (e) { } return p; })();
  const savePrefs = () => { try { localStorage.setItem('fit30.mediaPrefs', JSON.stringify(prefs)); } catch (e) { } };

  const exVideo = id => on() && M().ex[id] && M().ex[id].video || null;
  const exCover = id => on() && M().ex[id] && M().ex[id].poster || null;
  const rcPhoto = id => on() && M().rc[id] && M().rc[id].photo || null;
  const rcPrep = id => on() && M().rc[id] && M().rc[id].prep || null;
  const rcSteps = id => on() && M().rc[id] ? M().rc[id].steps : [];
  const credit = cid => M().credits[cid] || null;

  /* SLL-35 · data-saving mode. On when the user turned it on (profile.display.lowData === true), or automatically when the browser
     asks to save data (navigator.connection.saveData) and the user did not turn it off (lowData === false). While on:
     - photos are not downloaded; each shows "טעינת תמונה" and loads only its SMALL size on tap (no larger srcset); thumbnails inside
       a link (opts.inLink) show their illustration only, since a button inside a link is not allowed;
     - video posters are not downloaded (the play button still works; a video loads only after the user taps play, as always);
     - videos start with preload="metadata" instead of "auto".
     Nothing else changes: all text, plans and data work the same. lowData() returns 'on' | 'auto' | null. */
  function lowData() { try { const d = (root.Store && root.Store.load('profile').display) || {}; if (d.lowData === true) return 'on'; if (d.lowData === false) return null;
    return root.navigator && root.navigator.connection && root.navigator.connection.saveData ? 'auto' : null; } catch (e) { return null; } }
  /* responsive lazy image with built-in fallback */
  function image(p, alt, opts) {
    opts = opts || {}; const ar = opts.aspect || (p ? `${p.w}/${p.h}` : '4/3');
    if (!p) return `<div class="mimg ${opts.cls || ''}" data-mstate="missing" style="aspect-ratio:${ar}">${opts.fallback || ''}</div>`;
    if (lowData() && !opts.eager) {
      if (opts.inLink || /\bmp-poster\b/.test(opts.cls || '')) return /* inside a link (list thumbnails) or a video player: no button inside an interactive element; the illustration stays */ `<div class="mimg ${opts.cls}" data-mstate="lowdata" style="aspect-ratio:${ar}"><div class="mfb">${opts.fallback || ''}</div></div>`;
      return `<div class="mimg ${opts.cls || ''}" data-mstate="lowdata" data-low-s="${esc(BASE + p.s)}" data-low-w="${p.w}" data-low-h="${p.h}" data-low-alt="${esc(alt)}" style="aspect-ratio:${ar}"><button type="button" class="btn sm ghost mlow" data-lowimg-load>${icon('image')} טעינת תמונה</button><div class="mfb">${opts.fallback || ''}</div></div>`; }
    return `<div class="mimg ${opts.cls || ''}" data-mstate="loading" style="aspect-ratio:${ar}"><img src="${BASE + p.s}" srcset="${BASE + p.s} 480w, ${BASE + p.l} 960w" sizes="${opts.sizes || '(max-width: 520px) 100vw, 520px'}" width="${p.w}" height="${p.h}" loading="lazy" decoding="async" alt="${esc(alt)}" onload="this.parentNode.dataset.mstate='ready'" onerror="this.parentNode.dataset.mstate='error'"><div class="mfb">${opts.fallback || ''}</div></div>`;
  }
  /* video player; fallbackHtml is shown (and labelled) if the video cannot play */
  function player(v, o) {
    o = o || {}; const c = v.credit && credit(v.credit);
    const ar = v.poster && v.poster.w && v.poster.h ? `${v.poster.w}/${v.poster.h}` : '16/9', tall = v.poster && v.poster.h > v.poster.w;
    return `<figure class="mplayer${tall ? ' portrait' : ''}" style="--mp-ar:${ar}" data-mp data-mstate="idle" data-src-mp4="${v.mp4 ? BASE + v.mp4 : ''}" data-src-webm="${v.webm ? BASE + v.webm : ''}" aria-label="${esc(o.label || 'סרטון')}">
      <div class="mp-stage">${image(v.poster, (o.label || 'סרטון') + ' — תמונת שער', { aspect: ar, cls: 'mp-poster', sizes: '(max-width: 520px) 60vw, 360px' })}
        <button class="mp-big" data-mpa="play" aria-label="הפעלת הסרטון">${icon('play')}</button><div class="mp-spin" aria-hidden="true"></div>
        <div class="mp-err" role="alert"><div>${icon('info')} הסרטון לא נטען${navigator.onLine === false ? ' (אין חיבור — סרטונים לא נשמרים לשימוש ללא חיבור)' : ''}.</div>${o.fallback ? '<button class="btn sm" data-mpa="fallback">הצג אנימציית איור במקום</button>' : ''}</div>
        <div class="mp-fb" hidden>${o.fallback || ''}</div></div>
      <div class="mp-bar" role="group" aria-label="שליטה בסרטון">
        <button class="mp-b" data-mpa="toggle" aria-label="הפעלה/השהיה">${icon('play')}</button>
        <span class="mp-t num" aria-live="off">0:00${v.dur ? ' / ' + fmt(v.dur) : ''}</span>
        <button class="mp-b" data-mpa="loop" aria-pressed="${prefs.loop}" aria-label="חזרה אוטומטית">${icon('repeat')}</button>
        <button class="mp-b" data-mpa="mute" aria-pressed="false" aria-label="השתקה">${icon('volume')}</button>
        <input class="mp-vol" type="range" min="0" max="1" step="0.05" value="1" aria-label="עוצמת קול">
        <button class="mp-b" data-mpa="fs" aria-label="מסך מלא">${icon('expand')}</button>
      </div>
      <figcaption class="tiny faint">${esc(o.caption || 'סרטון')}${v.dur ? ' · ' + fmt(v.dur) : ''}${c ? ` · מקור: ${esc(c.author)} (${esc(c.license)})` : ''}</figcaption></figure>`;
  }
  const fmt = s => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  /* one delegated listener for all players (players are re-rendered with the screen) */
  function ensureVideo(fig) {
    let v = fig.querySelector('video'); if (v) return v;
    v = document.createElement('video'); v.setAttribute('playsinline', ''); v.setAttribute('webkit-playsinline', ''); v.preload = lowData() ? 'metadata' : 'auto'; v.loop = prefs.loop;
    for (const [t, k] of [['video/mp4', 'srcMp4'], ['video/webm', 'srcWebm']]) if (fig.dataset[k]) { const s = document.createElement('source'); s.src = fig.dataset[k]; s.type = t; v.appendChild(s); }
    const set = st => { fig.dataset.mstate = st; };
    const last = v.querySelector('source:last-of-type'); if (last) last.addEventListener('error', () => set('error'));
    v.addEventListener('error', () => set('error'));
    v.addEventListener('loadstart', () => { if (fig.dataset.mstate === 'idle') set('loading'); });
    v.addEventListener('waiting', () => set('loading'));
    v.addEventListener('canplay', () => { if (fig.dataset.mstate === 'loading') set('ready'); });
    v.addEventListener('playing', () => { set('playing'); fig.querySelector('[data-mpa=toggle]').innerHTML = icon('pause'); });
    v.addEventListener('pause', () => { if (fig.dataset.mstate !== 'error') set('paused'); fig.querySelector('[data-mpa=toggle]').innerHTML = icon('play'); });
    v.addEventListener('timeupdate', () => { fig.querySelector('.mp-t').textContent = fmt(v.currentTime) + (isFinite(v.duration) ? ' / ' + fmt(v.duration) : ''); });
    fig.querySelector('.mp-stage').insertBefore(v, fig.querySelector('.mp-big'));
    // iOS: volume is read-only (hardware buttons) — hide the slider when setting it has no effect
    try { v.volume = 0.5; if (v.volume !== 0.5) fig.querySelector('.mp-vol').hidden = true; v.volume = 1; } catch (e) { fig.querySelector('.mp-vol').hidden = true; }
    return v;
  }
  function onClick(e) {
    const b = e.target.closest('[data-mpa]'); if (!b) return; const fig = b.closest('[data-mp]'); if (!fig) return; e.preventDefault();
    const a = b.dataset.mpa;
    if (a === 'fallback') { const fb = fig.querySelector('.mp-fb'); fb.hidden = false; fig.dataset.mstate = 'fallback'; fb.querySelectorAll('[data-fig]').forEach(x => root.App && root.App.mountFig(x)); return; }
    const v = ensureVideo(fig);
    if (a === 'play' || a === 'toggle') { if (v.paused) { const p = v.play(); if (p && p.catch) p.catch(() => { if (v.error || !v.currentSrc) fig.dataset.mstate = 'error'; }); } else v.pause(); }
    else if (a === 'loop') { v.loop = !v.loop; prefs.loop = v.loop; savePrefs(); b.setAttribute('aria-pressed', v.loop); }
    else if (a === 'mute') { v.muted = !v.muted; b.setAttribute('aria-pressed', v.muted); b.innerHTML = icon(v.muted ? 'mute' : 'volume'); }
    else if (a === 'fs') { if (fig.requestFullscreen) fig.requestFullscreen().catch(() => v.webkitEnterFullscreen && v.webkitEnterFullscreen()); else if (v.webkitEnterFullscreen) v.webkitEnterFullscreen(); }
  }
  function onInput(e) { const r = e.target.closest('.mp-vol'); if (!r) return; const fig = r.closest('[data-mp]'); const v = ensureVideo(fig); v.volume = +r.value; v.muted = +r.value === 0; }
  if (typeof document !== 'undefined') { document.addEventListener('click', onClick); document.addEventListener('input', onInput); }

  /* counts for the status screen and reports — derived from MEDIA, never hard-coded */
  function stats() {
    const ex = Object.values(M().ex), rc = Object.values(M().rc);
    return { exercises: ex.length, covers: ex.filter(x => x.poster).length, videos: ex.filter(x => x.video).length, recipes: root.NUTRI ? root.NUTRI.RECIPES.length : rc.length, photos: rc.filter(x => x.photo).length, prep: rc.filter(x => x.prep).length, stepSets: rc.filter(x => x.steps && x.steps.length).length };
  }
  try { document.addEventListener('click', e => { const b = e.target && e.target.closest && e.target.closest('[data-lowimg-load]'); if (!b) return; e.preventDefault(); e.stopPropagation();
    const w = b.closest('[data-mstate=lowdata]'); if (!w) return; w.dataset.mstate = 'loading';
    w.innerHTML = `<img src="${w.dataset.lowS}" width="${w.dataset.lowW}" height="${w.dataset.lowH}" decoding="async" alt="${esc(w.dataset.lowAlt || '')}" onload="this.parentNode.dataset.mstate='ready'" onerror="this.parentNode.dataset.mstate='error'">`; }, true); } catch (e) { }
  root.Media = { lowData, BASE, image, player, exVideo, exCover, rcPhoto, rcPrep, rcSteps, credit, stats, prefs, enabled: on };
})(typeof window !== 'undefined' ? window : globalThis);
