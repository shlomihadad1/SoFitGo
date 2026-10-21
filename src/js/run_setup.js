/* M11 · workout setup (#run pre-start sheet + in-workout settings) — on-demand chunk extra.js. Logic and state stay in run.js. */
(function (root) {
'use strict';
const { icon } = root.UI; const C = root.Core, S = root.Store;
const R = () => root.Run._;
const REST_OPT = [[null, 'לפי התוכנית'], [30, '30 שנ׳'], [45, '45 שנ׳'], [60, 'דקה'], [90, 'דקה וחצי'], [120, '2 דק׳'], [180, '3 דק׳']];
function restSelect(id, v) { return `<select id="${id}">${REST_OPT.map(([k, l]) => `<option value="${k == null ? '' : k}" ${String(k) === String(v) ? 'selected' : ''}>${l}</option>`).join('')}</select>`; }
function readCfg(b) { const g = id => b.querySelector('#' + id), n = x => x === '' ? null : +x;
  return { mode: b.querySelector('[data-mode][aria-pressed=true]') ? b.querySelector('[data-mode][aria-pressed=true]').dataset.mode : 'manual', setRest: n(g('rs-set').value), exRest: n(g('rs-ex').value), countdown: +g('rs-cd').value, voice: g('rs-voice').checked }; }
function cfgHtml(c, all, withMode) {
  const est = m => Math.round(R().estimateSec(all, c, m) / 60);
  return `${withMode ? `<div class="stack tight"><span class="small muted">איך מתקדמים בין הסטים?</span><div class="chips" role="group" aria-label="מצב אימון">
      <button class="chip" data-act="mode" data-mode="manual" aria-pressed="${c.mode !== 'auto'}">ידני — לוחצים "סיימתי סט"</button>
      <button class="chip" data-act="mode" data-mode="auto" aria-pressed="${c.mode === 'auto'}">אוטומטי ורציף — בלי לגעת במסך</button></div>
    <p class="tiny muted" data-mode-help>${c.mode === 'auto' ? 'האפליקציה מפעילה ספירה לאחור, זמן עבודה ומנוחה ועוברת לבד לסט הבא. בסט חזרות הזמן הוא הערכה (כ־3 שניות לחזרה) — אם סיימתם מוקדם לוחצים "סיימתי", ובמנוחה אפשר לתקן כמה חזרות ביצעתם. סט "מקסימום" ומבדקים מחכים לאישור שלכם.' : 'כל סט מסתיים בלחיצה. טיימר המנוחה מתחיל אוטומטית.'}</p></div>` : ''}
    <div class="grid2"><label class="field">מנוחה בין סטים${restSelect('rs-set', c.setRest)}</label><label class="field">מנוחה בין תרגילים${restSelect('rs-ex', c.exRest)}</label></div>
    <label class="field">ספירה לאחור לפני סט (במצב אוטומטי)<select id="rs-cd">${[0, 3, 5, 10].map(v => `<option value="${v}" ${c.countdown === v ? 'selected' : ''}>${v ? v + ' שניות' : 'ללא'}</option>`).join('')}</select></label>
    <label class="switch"><span>הנחיות קוליות (אם הדפדפן תומך)</span><input type="checkbox" id="rs-voice" ${c.voice ? 'checked' : ''}></label>
    <p class="small" data-est>משך משוער: <b>כ־${est(c.mode === 'auto')} דק׳</b> <span class="tiny muted">(הערכה לפי זמני העבודה והמנוחה שנבחרו; המשך בפועל נמדד באימון)</span></p>`; }
function setupSheet(st, go) {
  const c = R().runPrefs(), all = st;
  const upd = b => { const v = readCfg(b); b.querySelector('[data-est] b').textContent = 'כ־' + Math.round(R().estimateSec(all, v, v.mode === 'auto') / 60) + ' דק׳'; };
  root.UI.sheet('לפני שמתחילים', `<div class="stack" data-run-setup>${cfgHtml(c, all, true)}<button class="btn primary big" data-act="go">${icon('play')} התחלת אימון</button></div>`, {
    mode: (b, e, cl, body) => { body.querySelectorAll('[data-mode]').forEach(x => x.setAttribute('aria-pressed', x === b)); const auto = b.dataset.mode === 'auto';
      body.querySelector('[data-mode-help]').textContent = auto ? 'האפליקציה מפעילה ספירה לאחור, זמן עבודה ומנוחה ועוברת לבד לסט הבא. בסט חזרות הזמן הוא הערכה (כ־3 שניות לחזרה) — אם סיימתם מוקדם לוחצים "סיימתי", ובמנוחה אפשר לתקן כמה חזרות ביצעתם. סט "מקסימום" ומבדקים מחכים לאישור שלכם.' : 'כל סט מסתיים בלחיצה. טיימר המנוחה מתחיל אוטומטית.'; upd(body); },
    go: (b, e, cl, body) => { const v = readCfg(body); const p = C.profile(); p.display = Object.assign({}, p.display, { run: v }); S.save('profile'); cl(); go(v); } });
  const b = document.querySelector('[data-run-setup]'); if (b) b.addEventListener('change', () => upd(b));
}
function settingsSheet() {
  const s = R().sess(); if (!s) return; const wasPaused = s.paused; if (!wasPaused) R().act('pause');
  const c = Object.assign({}, R().RUN_DEF, s.cfg || {}, { mode: s.mode || 'manual' });
  root.UI.sheet('הגדרות האימון', `<div class="stack" data-run-setup>${cfgHtml(c, R().steps(s), true)}<button class="btn primary" data-act="apply">שמירה והמשך</button></div>`, {
    mode: (b, e, cl, body) => body.querySelectorAll('[data-mode]').forEach(x => x.setAttribute('aria-pressed', x === b)),
    apply: (b, e, cl, body) => { const v = readCfg(body), ss = R().sess(); ss.mode = v.mode; ss.cfg = { setRest: v.setRest, exRest: v.exRest, countdown: v.countdown, voice: v.voice };
      if (ss.mode !== 'auto') { ss.cd = null; ss.hold = null; if (ss.work && ss.work.auto) ss.work = null; }
      R().saveSess(ss); cl(); if (!wasPaused) R().act('resume'); else R().render(); } }, { onClose: () => { const ss = R().sess(); if (ss && ss.paused && !wasPaused && document.querySelector('.run')) { R().act('resume'); } } });
}
root.RunSetup = { setupSheet, settingsSheet };
})(window);
