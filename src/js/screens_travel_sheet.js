/* M10 · Travel mode sheet (G5), moved out of the first load into extra.js — same code as before (first-load size budget). */
(function (root) {
'use strict';
const { esc, icon } = root.UI; const S = root.Store, C = root.Core, G = () => root.Signature, PS = () => root.Plans;
const Screens = root.Screens;
Screens.travelSheet = function (p) {
  const t0 = S.today(); const st = { from: t0, to: S.addDays(t0, 6), short: false };
  const box = () => { let pv; try { pv = G().Travel.preview(p, st.from, st.to, { short: st.short }); } catch (e) { return `<p class="small bad" data-travel-err>${esc(e.message)}</p>`; }
    return `<div class="diff" data-travel-diff><h4>מה ישתנה</h4><p class="small">${pv.sessions} אימונים בטווח · ${pv.changes.length} תרגילים יוחלפו בחלופה ללא ציוד${pv.shortDays.length ? ` · ${pv.shortDays.length} אימונים בגרסה קצרה` : ''}</p>
      ${pv.changes.length ? `<ul class="bul tiny">${pv.changes.slice(0, 12).map(c => `<li>${esc(S.fmtShort(c.date))}: ${esc(root.EX_BY_ID[c.from].he)} ← ${esc(root.EX_BY_ID[c.to].he)}${c.diff ? (c.diff > 0 ? ' (קשה יותר)' : ' (קל יותר)') : ''}</li>`).join('')}${pv.changes.length > 12 ? `<li>ועוד ${pv.changes.length - 12}…</li>` : ''}</ul>` : '<p class="tiny muted">כל התרגילים בטווח כבר מתאימים לאימון בלי ציוד.</p>'}
      ${pv.stuck.length ? `<p class="tiny warn">ל־${pv.stuck.length} תרגילים אין חלופה ללא ציוד מאותו סוג; הם נשארים — אפשר לדלג עליהם באימון.</p>` : ''}</div>`; };
  const sh = root.UI.sheet('מצב נסיעה / בלי ציוד', `<p class="small muted">לתקופה זמנית (עד 4 שבועות): תרגילים שדורשים ציוד או רהיט מוחלפים בחלופה ללא ציוד מאותו סוג תנועה. אחרי התאריך התוכנית חוזרת לעצמה, ואפשר לבטל בכל רגע.</p>
    <div class="row"><label class="field grow">מתאריך<input type="date" id="tr-f" min="${t0}" value="${st.from}"></label><label class="field grow">עד<input type="date" id="tr-t" min="${t0}" value="${st.to}"></label></div>
    <label class="row small"><input type="checkbox" id="tr-s"> גם גרסה קצרה לאימונים בטווח</label><div id="tr-d">${box()}</div><button class="btn primary" data-act="ok">הפעלת מצב נסיעה</button>`,
    { ok: (el, e, close) => { try { const pv = G().Travel.preview(p, st.from, st.to, { short: st.short }); G().Travel.apply(pv); close(); root.UI.toast('מצב נסיעה הופעל'); root.App.render(); } catch (er) { root.UI.toast(er.message); } } });
  const upd = () => { st.from = sh.body.querySelector('#tr-f').value; st.to = sh.body.querySelector('#tr-t').value; st.short = sh.body.querySelector('#tr-s').checked; sh.body.querySelector('#tr-d').innerHTML = box(); };
  ['#tr-f', '#tr-t', '#tr-s'].forEach(s => sh.body.querySelector(s).addEventListener('change', upd));
};
})(window);
