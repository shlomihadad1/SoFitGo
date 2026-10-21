/* Food preferences component (on-demand chunk extra.js) — ONE state and ONE update function for the cuisine chips, the "favourite
   cuisine" field and the regional question, used in onboarding (setup step 2) and in Settings. Every change is saved at once
   (profile.prefs) and the menu is refreshed through the existing path (Core.applyPrefs + personal-plan regeneration).
   Priority (Core.cuisineChoice): restrictions & allergies (never bypassed) > explicit cuisines > regional match (only with
   consent) > default varied Israeli–Mediterranean menu. Location is used ONLY after the user says yes AND taps "use my
   location", only to pick a coarse region on the device (no service is called), and coordinates are never stored. */
(function (root) {
'use strict';
const { esc } = root.UI; const S = root.Store, C = root.Core;
const REG = { israel: ['ישראל', 'israeli'], india: ['הודו', 'indian'], med: ['אגן הים התיכון (יוון, איטליה, ספרד, טורקיה…)', 'mediterranean'], asia: ['מזרח ודרום־מזרח אסיה', 'asian'], west: ['צפון אמריקה / מערב ומרכז אירופה', 'western'], other: ['אחר — תפריט בסיסי', null] };
/* coarse boxes, checked in order (Israel before the Mediterranean, India before Asia) */
const BOX = [['israel', 29.4, 33.4, 34.2, 35.9], ['india', 6.5, 35.7, 68, 97.5], ['med', 30, 46.5, -10, 36.5], ['asia', -11, 54, 95, 150], ['west', 24, 72, -170, -50], ['west', 46, 72, -10, 40]];
function regionOf(lat, lon) { const b = BOX.find(x => lat >= x[1] && lat <= x[2] && lon >= x[3] && lon <= x[4]); return b ? b[0] : 'other'; }
const prefs = () => C.normPrefs(C.profile().prefs);
/* the single update function: patch → save → refresh the menu. Returns false when the write failed. */
function apply(patch, msg) {
  const pr = C.profile(), pf = Object.assign(prefs(), patch); Object.keys(patch).forEach(k => { if (patch[k] == null || (Array.isArray(patch[k]) && !patch[k].length)) delete pf[k]; });
  if (pf.cuisineMain && pf.cuisines && pf.cuisines.length && !pf.cuisines.includes(pf.cuisineMain)) pf.cuisines = pf.cuisines.concat(pf.cuisineMain); /* favourite is always one of the chosen */
  if (pf.cuisineMain && pf.cuisines && !pf.cuisines.length) delete pf.cuisineMain;
  pr.prefs = pf; if (S.save('profile') === false && S.storageOKAtStart) { root.UI.toast('השמירה נכשלה'); return false; }
  C.applyPrefs(pf); const ap = root.Plans && root.Plans.active(); if (ap && root.MealPlan && root.MealPlan.pending(ap)) root.MealPlan.applyChange(ap, 'עדכון העדפות מטבח');
  if (msg) root.UI.toast(msg); return true;
}
function html(where) {
  const pf = prefs(), cs = pf.cuisines || [], G = C.CUISINE_GROUPS, rg = pf.region || null, eff = C.cuisineChoice(pf);
  const effTxt = eff.map(k => (G[k] || {}).he || k).join(', ');
  const src = cs.length ? 'הבחירה שלך' : rg && rg.consent && rg.group ? `התאמה אזורית (${esc(REG[rg.code] ? REG[rg.code][0] : rg.code)})` : 'ברירת המחדל';
  return `<div class="stack tight" data-food-prefs="${where}">
    <p class="small" data-fp-effective>המטבחים בתפריט עכשיו: <b>${esc(effTxt)}</b> <span class="tiny muted">(${src})</span></p>
    <div class="chips wrap" role="group" aria-label="מטבחים">${Object.entries(G).map(([k, g]) => `<button class="chip" data-fp="cu" data-v="${k}" aria-pressed="${cs.includes(k)}">${esc(g.he)}</button>`).join('')}</div>
    <label class="field">מטבח מועדף (יוצע ראשון)<select data-fp="main"><option value="">ללא העדפה</option>${Object.entries(G).filter(([k]) => k !== 'international').map(([k, g]) => `<option value="${k}" ${pf.cuisineMain === k ? 'selected' : ''}>${esc(g.he)}</option>`).join('')}</select></label>
    <div class="stack tight" data-fp-region>${!rg || rg.consent == null ? `<p class="small"><b>רוצה שנתאים את התפריט למאכלים ולמרכיבים הנפוצים באזור שבו אתה נמצא?</b></p><div class="btns"><button class="btn sm" data-fp="regYes">כן, התאם לאזור שלי</button><button class="btn sm" data-fp="regNo">לא, השאר תפריט בסיסי</button></div>`
      : rg.consent ? `<p class="small">התאמה אזורית: <b>${rg.code ? esc(REG[rg.code][0]) : 'עוד לא נבחר אזור'}</b>${rg.src ? ` <span class="tiny muted">(${rg.src === 'gps' ? 'לפי מיקום, נשמר רק האזור' : 'נבחר ידנית'})</span>` : ''}${cs.length ? ' — <span class="tiny">הבחירה המפורשת שלך במטבחים גוברת עליה</span>' : ''}</p>
        <label class="field">אזור<select data-fp="region"><option value="">בחירה…</option>${Object.entries(REG).map(([k, v]) => `<option value="${k}" ${rg.code === k ? 'selected' : ''}>${esc(v[0])}</option>`).join('')}</select></label>
        ${navigator.geolocation ? `<button class="btn sm ghost" data-fp="geo">זיהוי האזור לפי מיקום</button><p class="tiny muted">המיקום נדרש רק כדי לזהות את האזור (מדינה או אזור גדול). הוא מעובד במכשיר ולא נשמר — נשמר רק שם האזור.</p>` : ''}<button class="btn sm ghost" data-fp="regNo">ביטול ההתאמה האזורית</button>`
      : `<p class="small">בחרת תפריט בסיסי ולא התאמה אזורית. <button class="btn sm ghost" data-fp="regYes">שינוי</button></p>`}
      <p class="tiny" data-fp-status role="status" aria-live="polite"></p></div>
    <p class="tiny faint">הגבלות ואלרגיות תמיד קודמות למטבח. בלי בחירה התפריט מגוון בסגנון ישראלי־ים־תיכוני.</p></div>`;
}
function mount(el, where) {
  if (!el) return; el.innerHTML = html(where); const st = () => el.querySelector('[data-fp-status]'), re = msg => { mount(el, where); if (msg && st()) st().textContent = msg; };
  el.querySelectorAll('[data-fp=cu]').forEach(b => b.addEventListener('click', () => { const cs = (prefs().cuisines || []).slice(), v = b.dataset.v, i = cs.indexOf(v); if (i >= 0) cs.splice(i, 1); else cs.push(v);
    const main = prefs().cuisineMain; if (apply({ cuisines: cs, cuisineMain: main && cs.includes(main) ? main : null }, 'התפריט עודכן')) re(); }));
  const ms = el.querySelector('[data-fp=main]'); if (ms) ms.addEventListener('change', () => { const v = ms.value, cs = (prefs().cuisines || []).slice(); if (v && !cs.includes(v)) cs.push(v);
    if (apply({ cuisines: cs, cuisineMain: v || null }, 'התפריט עודכן')) re(); });
  el.querySelectorAll('[data-fp=regYes]').forEach(b => b.addEventListener('click', () => { const r = Object.assign({}, prefs().region || {}, { consent: true, at: new Date().toISOString() }); if (apply({ region: r })) re('בחרו אזור, או זהו אותו לפי מיקום.'); }));
  el.querySelectorAll('[data-fp=regNo]').forEach(b => b.addEventListener('click', () => { if (apply({ region: { consent: false, at: new Date().toISOString() } }, 'נשאר תפריט בסיסי')) re(); }));
  const rs = el.querySelector('[data-fp=region]'); if (rs) rs.addEventListener('change', () => { const k = rs.value; if (!k) return; if (apply({ region: { consent: true, code: k, group: REG[k][1], src: 'manual', at: new Date().toISOString() } }, 'התפריט הותאם לאזור')) re(); });
  const gb = el.querySelector('[data-fp=geo]'); if (gb) gb.addEventListener('click', () => { if (st()) st().textContent = 'מבקשים מיקום…';
    navigator.geolocation.getCurrentPosition(pos => { const k = regionOf(pos.coords.latitude, pos.coords.longitude); /* coordinates are not kept */
      if (apply({ region: { consent: true, code: k, group: REG[k][1], src: 'gps', at: new Date().toISOString() } }, k === 'other' ? 'האזור לא מוכר — נשאר תפריט בסיסי' : 'התפריט הותאם לאזור')) re(); },
      err => { if (st()) st().textContent = err && err.code === 1 ? 'ההרשאה למיקום נדחתה. אפשר לבחור אזור מהרשימה או להמשיך עם התפריט הבסיסי.' : 'לא הצלחנו לקבל מיקום. אפשר לבחור אזור מהרשימה.'; },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 }); });
}
root.FoodPrefs = { html, mount, apply, regionOf, REG };
})(window);
