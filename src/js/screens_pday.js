/* M10.2 · plan day (#/pday) + exercise swap sheet, moved out of the first load into extra.js — same code as before (first-load budget).
   Shared helpers come from screens_plan.js through Screens._pf. */
(function (root) {
'use strict';
const { esc, icon } = root.UI;
const S = root.Store;
const Screens = root.Screens;
const PL = () => root.Planner, PS = () => root.Plans;
const { err, STATUS_HE, STATUS_CLS, startDay } = Screens._pf;
/* ---------- plan day ---------- */
Screens.pday = function (arg) {
  const p = PS().active(), n = +arg; if (!p) { location.hash = '#/plan'; return { title: '', html: '', handlers: {} }; }
  const d = PS().dayOf(p, n); if (!d) return { title: 'לא נמצא', back: '#/plan', html: '<div class="empty">היום לא קיים בתוכנית</div>', handlers: {} };
  const editable = !d.log && (d.movedTo || d.date) >= S.today() && p.status === 'active', train = PS().isTraining(d);
  const vers = train && !['assess'].includes(d.type) ? ['short', 'std', 'long'].map(v => { const x = PL().versioned(PS().days(Object.assign({}, p, { overrides: Object.assign({}, p.overrides, { [n]: Object.assign({}, p.overrides[n] || {}, { version: undefined }) }) })).find(z => z.n === n), v); return `<button data-act="ver" data-v="${v}" aria-pressed="${(d.version || 'std') === v}" ${editable ? '' : 'disabled'}>${PL().VERSION_HE[v]}<small>~${Math.round(x.minutes || 0)} דק׳</small></button>`; }).join('') : '';
  const item = (it, i, sec) => `<div class="li">${Screens.thumb(it.ex)}<div class="grow"><a class="t" href="#/ex/${it.ex}">${esc(root.EX_BY_ID[it.ex].he)}</a><div class="s">${esc(Screens.target(it))}${it.rest ? ' · מנוחה ' + it.rest + ' שנ׳' : ''}${it.adjusted ? ` · <span class="pill gl" data-adjusted>מותאם${it.adjLvl ? ': רמה ' + esc(root.Core.LEVEL_HE[it.adjLvl]) : ''}</span>` : ''}</div></div>${sec === 'main' && editable ? `<button class="btn sm" data-act="swap" data-i="${i}">${icon('swap')} החלפה</button>` : ''}</div>`;
  return { title: 'יום ' + n, back: '#/plan', html: `
    <section class="card"><span class="eyebrow">${esc(S.fmtDate(d.date, true))} · ${esc(d.phase.he)}${d.deload ? ' · שבוע קל' : ''}</span><h2>${esc(d.title)}</h2>
      <div class="kv">${d.minutes ? `<span data-duration>~${Math.round(d.minutes)} דק׳ בסך הכול (הערכה, כולל חימום ומנוחות)</span>` : ''}<span class="pill ${STATUS_CLS[d.status]}">${STATUS_HE[d.status]}</span>${d.movedTo ? `<span class="pill">הועבר מ־${esc(S.fmtShort(d.plannedDate))}</span>` : ''}</div>
      ${d.notes && d.notes.length ? `<ul class="bul tiny">${d.notes.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      ${vers ? `<div class="seg" role="group" aria-label="גרסה">${vers}</div>` : ''}
      ${d.log ? `<div class="banner info small"><div>נרשם ב־${esc(S.fmtDate(d.log.date))}: ${STATUS_HE[d.log.status]}${d.log.durationSec ? ' · ' + Math.round(d.log.durationSec / 60) + ' דק׳' : ''}${d.log.rpe ? ' · מאמץ ' + d.log.rpe + '/10' : ''}${d.log.notes ? ' · ' + esc(d.log.notes) : ''}. רישום שבוצע לא משתנה כשהתוכנית מתעדכנת.</div></div>` : ''}
      ${train && editable ? `<div class="btns"><button class="btn primary" data-act="start">${icon('play')} התחלת אימון</button><button class="btn" data-act="done">סימון כבוצע</button><button class="btn" data-act="move">העברה ליום אחר</button><button class="btn ghost" data-act="skip">דילוג</button></div>` : ''}
      ${d.status === 'skipped' && !d.log ? '<button class="btn sm" data-act="unskip">ביטול הדילוג</button>' : ''}
      <a class="btn sm ghost" href="#/nutrition/${d.movedTo || d.date}" data-day-menu>${icon('food')} התפריט של היום הזה</a></section>
    ${d.warm && d.warm.length ? `<section class="card"><h3>חימום</h3><div class="list">${d.warm.map((it, i) => item(it, i, 'warm')).join('')}</div></section>` : ''}
    ${d.main && d.main.length ? `<section class="card"><h3>${d.type === 'assess' ? 'מבחנים' : 'אימון'}</h3><div class="list">${d.main.map((it, i) => item(it, i, 'main')).join('')}</div>${d.finisher && d.finisher.length ? `<h4>סיום (אינטרוולים)</h4><div class="list">${d.finisher.map((it, i) => item(it, i, 'fin')).join('')}</div>` : ''}</section>` : `<section class="card"><p class="muted">יום מנוחה.</p></section>`}
    ${d.cool && d.cool.length ? `<section class="card"><h3>שחרור</h3><div class="list">${d.cool.map((it, i) => item(it, i, 'cool')).join('')}</div></section>` : ''}`,
    handlers: {
      start: () => startDay(p, n),
      ver: el => { try { PS().setVersion(p.id, n, el.dataset.v); root.App.render(); } catch (e) { root.UI.toast(e.message); } },
      skip: () => root.UI.confirmSheet('דילוג על האימון', 'האימון יסומן "דילוג". שאר התוכנית לא זזה. אפשר לבטל את הדילוג עד שהיום עובר.', 'דילוג', () => { PS().skip(p.id, n); root.App.render(); }),
      unskip: () => { PS().unskip(p.id, n); root.App.render(); },
      done: () => root.UI.sheet('סימון כבוצע', `<label class="field">סטטוס<select id="dn-st"><option value="done">הושלם</option><option value="partial">חלקית</option></select></label><label class="field">מאמץ (1–10, רשות)<input type="number" id="dn-r" min="1" max="10"></label><label class="field">הערות<textarea id="dn-n"></textarea></label><button class="btn primary" data-act="ok">שמירה</button>`,
        { ok: (el, e, close, b) => { const r = +b.querySelector('#dn-r').value; PS().logDay(p.id, n, { status: b.querySelector('#dn-st').value, version: d.version, rpe: r >= 1 && r <= 10 ? r : null, notes: b.querySelector('#dn-n').value.trim(), source: 'manual' }); close(); root.UI.toast('נשמר'); root.App.render(); } }),
      move: () => root.UI.sheet('העברת אימון', `<label class="field">לתאריך<input type="date" id="mv-d" min="${S.today()}" value="${S.today() > d.date ? S.today() : d.date}"></label><p class="tiny faint">אפשר להעביר רק ליום שאין בו אימון אחר.</p><p class="tiny bad" data-err hidden></p><button class="btn primary" data-act="ok">העברה</button>`,
        { ok: (el, e, close, b) => { try { PS().move(p.id, n, b.querySelector('#mv-d').value); close(); root.UI.toast('הועבר'); root.App.render(); } catch (x) { const m = b.querySelector('[data-err]'); m.textContent = x.message; m.hidden = false; } } }),
      swap: el => swapSheet(p, n, +el.dataset.i) } };
};
function swapSheet(p, n, i) {
  const a = PS().alternatives(p, n, i);
  const html = `<div class="banner info small"><div>נוכחי: <b>${esc(a.current.he)}</b> · קושי ${a.current.d}/3 · ${esc(a.current.eq.join(', ') || 'ללא ציוד')}</div></div>
    ${a.list.length ? `<div class="list">${a.list.map(x => `<div class="li"><div class="grow"><div class="t">${esc(x.he)}</div><div class="s">קושי ${x.d}/3 · ${esc(x.eq.join(', ') || 'ללא ציוד')} · ${esc(x.primary.join(', '))}</div>${x.diffs.length ? `<div class="tiny warn">${x.diffs.map(esc).join(' · ')}</div>` : '<div class="tiny good">ללא הבדל מהותי</div>'}<div class="btns"><button class="btn sm" data-act="day" data-id="${x.id}">רק ביום הזה</button><button class="btn sm ghost" data-act="fut" data-id="${x.id}">מעכשיו והלאה</button></div></div></div>`).join('')}</div>` : `<p class="warn small">${esc(a.reason)}</p><p class="tiny faint">לא מוצעים תרגילים או סרטונים שאינם בספרייה.</p>`}${a.hiddenByEquipment.length ? `<p class="tiny muted">עם ציוד נוסף היו זמינות גם: ${a.hiddenByEquipment.map(esc).join(', ')}.</p>` : ''}`;
  root.UI.sheet('החלפת תרגיל', html, { day: (el, e, close) => { PS().swap(p.id, n, i, el.dataset.id, 'day'); close(); root.UI.toast('הוחלף ביום הזה'); root.App.render(); },
    fut: (el, e, close) => { PS().swap(p.id, n, i, el.dataset.id, 'future'); close(); root.UI.toast('הוחלף מיום ' + n + ' והלאה'); root.App.render(); } });
}
})(window);
