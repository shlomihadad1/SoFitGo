/* #/shopping[/days] — shopping list & meal prep (moved from screens_signature.js in RC5; on-demand chunk extra.js).
   RC5 Smart Grocery v2 (INN-08, first slice):
   - each planned item has a state: to buy / bought ✓ / at home / not found. "bought" keeps the old `checked` map (backward
     compatible); `state[f]` holds 'home' | 'notfound'. Items "at home" leave the to-buy count; "not found" stays visible.
   - the user can add their own items (shopping.custom). Duplicates are prevented: the same text twice, or text equal to a
     planned item's name, is not added again (the user is told which one already exists).
   - "clear" resets checks and states but KEEPS the user's own items (only explicit delete removes them).
   Data: nutrition.shopping = { checked: {f: date}, state: {f: 'home'|'notfound'}, custom: [{ id, text, done }] }. */
(function (root) {
const { esc, icon } = root.UI; const S = root.Store, C = root.Core, G = () => root.Signature;
const Screens = root.Screens;
const shopSt = { days: 7 };
const fmtN = n => n == null ? '—' : Number(n).toLocaleString('he-IL');
const norm = t => String(t || '').trim().replace(/\s+/g, ' ').toLowerCase();
const ST_HE = { home: 'יש בבית', notfound: 'לא נמצא' };
function data() { const nu = S.load('nutrition'); nu.shopping = nu.shopping || { checked: {} }; nu.shopping.state = nu.shopping.state || {}; nu.shopping.custom = nu.shopping.custom || []; return nu; }
function setState(f, st) { const nu = data(); if (st) { nu.shopping.state[f] = st; delete nu.shopping.checked[f]; } else delete nu.shopping.state[f]; return S.save('nutrition'); }
function addCustom(text, planned) {
  const t = String(text || '').trim().slice(0, 80); if (!t) return { ok: false, why: 'empty' };
  const nu = data(), n = norm(t), dup = nu.shopping.custom.find(c => norm(c.text) === n) || planned.find(i => norm(i.he) === n);
  if (dup) return { ok: false, why: 'dup', name: dup.text || dup.he };
  nu.shopping.custom.push({ id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), text: t, done: false });
  return S.save('nutrition') ? { ok: true } : { ok: false, why: 'save' };
}
Screens.shopping = function (arg) {
  if (arg && [3, 7, 14].includes(+arg)) shopSt.days = +arg;
  const sh = G().shopping(S.today(), shopSt.days), nu = data(), ck = nu.shopping.checked || {}, stt = nu.shopping.state, custom = nu.shopping.custom;
  const all = sh.groups.flatMap(g => g.items), toBuy = all.filter(i => stt[i.f] !== 'home'), total = toBuy.length, done = toBuy.filter(i => ck[i.f]).length;
  const atHome = all.filter(i => stt[i.f] === 'home');
  const row = i => `<div class="li shop-i" data-shop-row="${i.f}" data-state="${ck[i.f] ? 'bought' : stt[i.f] || 'buy'}"><label class="grow shop-l"><input type="checkbox" data-shop="${i.f}" aria-label="נקנה: ${esc(i.he)}" ${ck[i.f] ? 'checked' : ''}><div class="grow"><div class="t">${esc(i.he)}${i.blocked ? ` <span class="pill bad" data-shop-blocked="${i.f}">${esc(C.KIND_HE[i.kind])} — מוחרג אצלך</span>` : ''}${stt[i.f] === 'notfound' ? ' <span class="pill warn" data-notfound>לא נמצא</span>' : ''}</div><div class="s">${i.units ? `${i.units} × ${esc(i.unitHe || 'יח׳')} · ` : ''}${fmtN(i.g)} ג׳ (${esc(i.st)}) · ב־${i.recipes} מנות</div>${stt[i.f] === 'notfound' ? '<div class="tiny muted">אפשר להחליף את הרכיב במנה: ביומן התזונה ← "החלף רכיב".</div>' : ''}</div></label><div class="shop-st">${['home', 'notfound'].map(s => `<button class="chip sm" data-act="st" data-f="${i.f}" data-s="${s}" aria-pressed="${stt[i.f] === s}">${ST_HE[s]}</button>`).join('')}</div></div>`;
  return { title: 'רשימת קניות', back: '#/nutrition', html: `
    <div class="seg" role="group" aria-label="טווח">${[3, 7, 14].map(d => `<button data-act="days" data-d="${d}" aria-pressed="${shopSt.days === d}">${d} ימים</button>`).join('')}</div>
    <p class="small muted">${esc(S.fmtDate(sh.from))} – ${esc(S.fmtDate(sh.to))}: ${sh.recipeCount} מנות שונות מהתפריט${C.plan(S.today()).source === 'plan' ? ' האישי' : ''}. ארוחות שכבר נאכלו ותוספות שלא נבחרו לא נכללות.</p>
    ${sh.blocked ? `<div class="banner bad small" data-shop-warn>${icon('info')}<div>${sh.blocked === 1 ? 'פריט אחד ברשימה מוחרג' : sh.blocked + ' פריטים ברשימה מוחרגים'} אצלך. הם מופיעים רק כי בחרת בעצמך מנה שמכילה אותם — כדאי להחליף את המנה.</div></div>` : ''}${all.length ? `<section class="card"><div class="card-h"><h3>מה לקנות</h3><span class="pill" data-shop-progress>${done}/${total}</span></div>
      ${sh.groups.map(g => { const its = g.items.filter(i => stt[i.f] !== 'home'); return its.length ? `<h4>${esc(g.he)}</h4><div class="list">${its.map(row).join('')}</div>` : ''; }).join('')}
      ${atHome.length ? `<h4>יש בבית (לא נספר)</h4><div class="list" data-at-home>${atHome.map(row).join('')}</div>` : ''}
      <p class="tiny faint">משקל "נא" = לפני בישול, "יבש" = לפני השריה או בישול (אורז, קטניות, פסטה), "מוכן" = כפי שקונים. הכמויות הן סכום המנות המתוכננות, בלי עודף לפחת.</p></section>` : '<div class="empty" data-empty-state>אין ארוחות מתוכננות בטווח הזה.</div>'}
    <section class="card" data-custom><h3>פריטים שלי</h3>${custom.length ? `<div class="list">${custom.map(c => `<div class="li shop-i" data-custom-row="${c.id}"><label class="grow shop-l"><input type="checkbox" data-cdone="${c.id}" aria-label="נקנה: ${esc(c.text)}" ${c.done ? 'checked' : ''}><span class="grow t">${esc(c.text)}</span></label><button class="btn sm ghost" data-act="cdel" data-id="${c.id}" aria-label="מחיקה: ${esc(c.text)}">מחיקה</button></div>`).join('')}</div>` : '<p class="tiny muted">אין עדיין. פריטים שתוסיפו כאן נשמרים גם כשמנקים סימונים.</p>'}
      <div class="row"><input id="c-add" type="text" maxlength="80" placeholder="למשל: נייר אפייה"><button class="btn sm" data-act="cadd">${icon('plus')} הוספה</button></div></section>
    <div class="btns"><button class="btn" data-act="copy">${icon('share')} העתקת הרשימה</button>${done || Object.keys(stt).length || custom.some(c => c.done) ? '<button class="btn ghost" data-act="clear">ניקוי סימונים ומצבים</button>' : ''}</div>
    ${sh.batch.length || sh.prep.length ? `<section class="card" data-mealprep><h3>הכנה מראש — לבשל פעם אחת</h3><ul class="bul small">${sh.batch.map(b => `<li><b>${esc(b.he)}</b>: ${fmtN(b.g)} ג׳ (${esc(b.st)}) ל־${b.meals} ארוחות — ${b.dates.map(d => esc(S.fmtShort(d))).join(', ')}.</li>`).join('')}${sh.prep.map(r => `<li><a href="#/recipe/${r.id}">${esc(r.he)}</a> מופיעה ${r.n} פעמים (${r.dates.map(d => esc(S.fmtShort(d))).join(', ')}) — אפשר להכין ${r.n} מנות יחד.</li>`).join('')}</ul><p class="tiny faint">אוכל מבושל נשמר במקרר בדרך כלל 3–4 ימים; לטווח ארוך יותר — הקפאה במנות.</p></section>` : ''}`,
    handlers: { days: el => { location.hash = '#/shopping/' + el.dataset.d; },
      st: el => { const cur = data().shopping.state[el.dataset.f]; setState(el.dataset.f, cur === el.dataset.s ? null : el.dataset.s); root.App.render(); },
      cadd: () => { const r = addCustom(document.getElementById('c-add').value, all); if (r.ok) { root.UI.toast('נוסף'); root.App.render(); } else if (r.why === 'dup') root.UI.toast(`"${r.name}" כבר ברשימה — לא נוסף שוב`); else if (r.why === 'empty') root.UI.toast('כתבו מה להוסיף'); },
      cdel: el => { const nu = data(); const c = nu.shopping.custom.find(x => x.id === el.dataset.id); nu.shopping.custom = nu.shopping.custom.filter(x => x.id !== el.dataset.id); if (S.save('nutrition')) root.UI.toast('נמחק', 0, { label: 'ביטול', fn: () => { const n2 = data(); if (c && !n2.shopping.custom.some(x => x.id === c.id)) { n2.shopping.custom.push(c); S.save('nutrition'); } root.App.render(); } }); root.App.render(); },
      copy: () => { const st0 = data().shopping; const txt = G().shoppingText(Object.assign({}, sh, { groups: sh.groups.map(g => Object.assign({}, g, { items: g.items.filter(i => st0.state[i.f] !== 'home').map(i => Object.assign({}, i, { st: i.st + (st0.state[i.f] === 'notfound' ? ' · לא נמצא' : '') })) })) }), st0.checked) + (st0.custom.length ? '\n\nפריטים שלי:\n' + st0.custom.map(c => `${c.done ? '✓' : '☐'} ${c.text}`).join('\n') : '');
        try { navigator.clipboard.writeText(txt).then(() => root.UI.toast('הרשימה הועתקה'), () => root.UI.toast('ההעתקה לא זמינה כאן')); } catch (e) { root.UI.toast('ההעתקה לא זמינה כאן'); } },
      clear: () => { const nu = data(); nu.shopping.checked = {}; nu.shopping.state = {}; nu.shopping.custom.forEach(c => { c.done = false; }); S.save('nutrition'); root.App.render(); } },
    after: v => { v.querySelectorAll('[data-shop]').forEach(cb => cb.addEventListener('change', () => { G().toggleCheck(cb.dataset.shop, cb.checked); if (cb.checked) setState(cb.dataset.shop, null); const n = v.querySelectorAll('[data-shop-row]:not([data-state="home"]) [data-shop]:checked').length, pr = v.querySelector('[data-shop-progress]'); if (pr) pr.textContent = `${n}/${total}`; }));
      v.querySelectorAll('[data-cdone]').forEach(cb => cb.addEventListener('change', () => { const nu = data(), c = nu.shopping.custom.find(x => x.id === cb.dataset.cdone); if (c) { c.done = cb.checked; S.save('nutrition'); } })); } };
};
Screens.shopping.addCustom = addCustom; Screens.shopping.setState = setState;
})(window);
