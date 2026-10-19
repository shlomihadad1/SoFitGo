/* Stage G screens: Explain My Plan (#/explain), Weekly Review (#/review[/w]), Shopping list & meal prep (#/shopping[/days]),
   Records & milestones (#/records), Travel mode (sheet opened from the plan screen). Logic lives in signature.js. */
(function (root) {
'use strict';
const { esc, icon } = root.UI; const S = root.Store, C = root.Core, G = () => root.Signature, PS = () => root.Plans;
const Screens = root.Screens;
/* noPlan / fmtN moved with the screens that use them (screens_signature_more.js) */

/* G1 */
/* RC5: explain / review / records moved to screens_signature_more.js (on-demand chunk extra.js) */

/* G5 — opened from the plan screen */
/* M10: Screens.travelSheet moved to screens_travel_sheet.js (on-demand chunk extra.js) — first-load budget */
Screens.travelCard = function (p) {
  const l = G().Travel.list(p).filter(x => x.status === 'active'); if (!l.length) return '';
  return `<section class="card" data-travel-active>${l.map(x => `<div class="banner info small">${icon('info')}<div class="grow">מצב נסיעה ${esc(S.fmtShort(x.from))}–${esc(S.fmtShort(x.to))}: ${x.swaps.length} תרגילים הוחלפו בחלופות ללא ציוד${x.versions.length ? `, ${x.versions.length} אימונים בגרסה קצרה` : ''}.</div><button class="btn sm" data-act="travelOff" data-id="${x.id}">ביטול</button></div>`).join('')}</section>`;
};
Screens.signatureLinks = function () {
  return `<nav class="chips sig-links" aria-label="כלים">${[['#/explain', 'info', 'למה ככה?'], ['#/review', 'cal', 'סיכום שבועי'], ['#/records', 'star', 'שיאים'], ['#/shopping', 'food', 'רשימת קניות'], ['#/help', 'book', 'הדרכות']].map(([h, i, t]) => `<a class="chip" href="${h}">${icon(i)} ${t}</a>`).join('')}</nav>`;
};
})(window);
