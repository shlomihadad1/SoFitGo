/* M10.4 · "אוכל בקרבתי" (#/nearby) — on-demand chunk extra.js.
   Honest scope: SoFitGo has NO restaurant-data service connected (no API key, no paid service). This screen therefore does not list
   restaurants itself; it hands a search to an external map site (OpenStreetMap or Google Maps) that returns real results there.
   Location: requested ONLY after the user taps "שימוש במיקום שלי" (browser permission prompt), rounded to 2 decimals (~1 km),
   used once to build the link, never stored. Denied/unavailable → a manual city/area field. Cuisine preferences are never
   read from or written by this screen's location logic (location ≠ taste). */
(function (root) {
  'use strict';
  const { esc, icon } = root.UI;
  const Screens = root.Screens;
  const KIND = [['healthy', 'אוכל בריא', 'healthy food'], ['israeli', 'מטבח ישראלי', 'israeli restaurant'], ['mediterranean', 'מטבח ים־תיכוני', 'mediterranean restaurant'], ['western', 'מטבח מערבי', 'restaurant'], ['indian', 'מטבח הודי', 'indian restaurant'], ['asian', 'מטבח אסייתי', 'asian restaurant'], ['salad', 'סלטים וקערות', 'salad bar']];
  const ui = { kind: 'healthy', state: 'idle', msg: '', coords: null, city: '' };
  const q = () => (KIND.find(k => k[0] === ui.kind) || KIND[0])[2];
  const links = (where) => { const t = encodeURIComponent(q() + ' ' + where);
    return `<div class="btns" data-near-links><a class="btn primary" href="https://www.google.com/maps/search/?api=1&query=${t}" target="_blank" rel="noopener noreferrer" data-near-google aria-label="חיפוש ב־Google Maps (נפתח באתר חיצוני)">חיפוש ב־Google Maps ↗</a><a class="btn" href="https://www.openstreetmap.org/search?query=${t}" target="_blank" rel="noopener noreferrer" data-near-osm aria-label="חיפוש ב־OpenStreetMap (נפתח באתר חיצוני)">חיפוש ב־OpenStreetMap ↗</a></div>
      <p class="tiny muted" data-near-external><b>הקישורים נפתחים אצל ספק חיצוני</b> (Google או OpenStreetMap), רק כשלוחצים עליהם, ובכפוף למדיניות הפרטיות שלו. הספק מקבל רק את מה שבקישור: סוג האוכל ו${where === ui.city ? 'העיר שהזנת' : 'המיקום המעוגל'}. SoFitGo לא בודקת את הערכים התזונתיים של מסעדות.</p>`; };
  Screens.foodNear = function () {
    const geo = !!(navigator.geolocation && navigator.geolocation.getCurrentPosition);
    const pre = (root.Core.normPrefs(root.Core.profile().prefs).cuisines || []);
    let res = '';
    if (ui.state === 'asking') res = `<p class="small" role="status" data-near-status>מבקשים את המיקום… הדפדפן יציג בקשת הרשאה.</p>`;
    else if (ui.state === 'ok') res = `<div class="banner info small" role="status" data-near-status>${icon('info')}<div>נמצא מיקום משוער (כ־1 ק״מ). לא נשמר באפליקציה.</div></div>${links(ui.coords)}`;
    else if (ui.state === 'denied' || ui.state === 'error') res = `<div class="banner warn small" role="alert" data-near-status>${icon('info')}<div>${esc(ui.msg)} אפשר להזין עיר או אזור למטה.</div></div>`;
    else if (ui.state === 'manual') res = links(ui.city);
    return { title: 'אוכל בקרבתי', back: '#/nutrition', html: `<section class="card" data-nearby><h2>אוכל בקרבתי</h2>
      <p class="small">חיפוש מסעדות ואוכל באזור שלך. <b>אין כרגע ב־SoFitGo שירות נתוני מסעדות</b>, ולכן החיפוש נפתח באתר מפות (OpenStreetMap או Google Maps) עם תוצאות אמיתיות משם.</p>
      <p class="tiny muted">המיקום משמש רק לבניית קישור החיפוש, מעוגל לכ־1 ק״מ, ולא נשמר. <b>העדפות המטבח שלך לא משתנות לפי המיקום</b>${pre.length ? ' (נבחר: ' + esc(pre.map(k => root.Core.CUISINE_GROUPS[k] ? root.Core.CUISINE_GROUPS[k].he : k).join(', ')) + ')' : ''} — מתכוני התפריט נקבעים לפי ההעדפות בהגדרות.</p>
      <label class="field">מה לחפש<select id="near-kind">${KIND.map(k => `<option value="${k[0]}" ${ui.kind === k[0] ? 'selected' : ''}>${esc(k[1])}</option>`).join('')}</select></label>
      ${geo ? `<button class="btn" data-act="nearGeo" ${ui.state === 'asking' ? 'disabled' : ''}>שימוש במיקום שלי</button>` : '<p class="small warn" data-near-nogeo>הדפדפן הזה לא תומך בשיתוף מיקום — אפשר להזין עיר.</p>'}
      ${res}
      <div class="stack tight" data-near-manual><label class="field">או עיר / אזור<input type="text" id="near-city" maxlength="60" value="${esc(ui.city)}" placeholder="למשל: תל אביב, פלורנטין"></label><button class="btn sm" data-act="nearCity">חיפוש לפי העיר</button></div></section>`,
      handlers: {
        nearGeo: () => { ui.kind = document.getElementById('near-kind').value; ui.state = 'asking'; root.App.render();
          navigator.geolocation.getCurrentPosition(pos => { const r2 = x => Math.round(x * 100) / 100; ui.coords = r2(pos.coords.latitude) + ',' + r2(pos.coords.longitude); ui.state = 'ok'; root.App.render(); },
            err => { ui.state = err && err.code === 1 ? 'denied' : 'error'; ui.msg = err && err.code === 1 ? 'ההרשאה למיקום נדחתה (אפשר לשנות בהגדרות הדפדפן).' : 'לא הצלחנו לקבל מיקום כרגע.'; root.App.render(); },
            { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 }); },
        nearCity: () => { const c = (document.getElementById('near-city').value || '').trim(); ui.kind = document.getElementById('near-kind').value; if (!c) { root.UI.toast('הזינו עיר או אזור'); return; } ui.city = c; ui.state = 'manual'; root.App.render(); }
      } };
  };
})(window);
