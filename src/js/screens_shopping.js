/* #/shopping[/days] — shopping list & meal prep (moved from screens_signature.js in RC5; on-demand chunk extra.js).
   RC5 Smart Grocery v2 (INN-08, first slice):
   - each planned item has a state: to buy / bought ✓ / at home / not found. "bought" keeps the old `checked` map (backward
     compatible); `state[f]` holds 'home' | 'notfound'. Items "at home" leave the to-buy count; "not found" stays visible.
   - the user can add their own items (shopping.custom). Duplicates are prevented: the same text twice, or text equal to a
     planned item's name, is not added again (the user is told which one already exists).
   - "clear" resets checks and states but KEEPS the user's own items (only explicit delete removes them).
   Data: nutrition.shopping = { checked: {f: date}, state: {f: 'home'|'notfound'|'buy'}, custom: [{ id, text, done }],
     homeSeen: {f: [date, date]}, usual: {f: date}, usualNo: {f: date}, snaps: {date: [{f, he}]}, carryDone: {date: 1} }
   ('buy' = "צריך לקנות הפעם" for an item the user keeps at home; the last five keys are SLL-08 v3 (2)/(3), see below). */
(function (root) {
const { esc, icon } = root.UI; const S = root.Store, C = root.Core, G = () => root.Signature;
const Screens = root.Screens;
const shopSt = { days: 7 };
const fmtN = n => n == null ? '—' : Number(n).toLocaleString('he-IL');
const norm = t => String(t || '').trim().replace(/\s+/g, ' ').toLowerCase();
const ST_HE = { home: 'יש בבית', notfound: 'לא נמצא' };
function data() { const nu = S.load('nutrition'); nu.shopping = nu.shopping || { checked: {} }; nu.shopping.state = nu.shopping.state || {}; nu.shopping.custom = nu.shopping.custom || []; return nu; }
const R = (sh, k) => sh[k] || {}, W = (sh, k) => sh[k] || (sh[k] = {}); /* v3 maps: read without creating (rendering never writes), create only on a tap */
/* SLL-08 · Smart Grocery v3 (2) "usually at home" and (3) carry-over (docs/M9-SCOPE.md, docs/SOFITGO_PRODUCT_DECISIONS.md).
   (2) Marking "יש בבית" records the day. After it was marked on 2 different days the list ASKS "לסמן כ'בדרך כלל בבית'?" —
       nothing is set automatically. A kept-at-home item is listed folded under "בדרך כלל בבית" (never deleted), with
       "צריך לקנות הפעם" (state 'buy', cleared with the other marks) and "הסרה" (removes the setting). "לא" stops the question.
   (3) A user action on the list (bought / at home / not found) stores that day's still-to-buy planned items. On a later day,
       items from the most recent earlier day that are not on the current list and were never bought are OFFERED once:
       "להוסיף לפריטים שלי" adds them as the user's own items (same duplicate prevention), "לא תודה" drops the offer. Rendering
       never writes; only taps do. Excluded foods are never carried. */
const USUAL_AFTER = 2;
const eff = (sh, f) => (sh.state || {})[f] || (R(sh, 'usual')[f] ? 'usual' : null); /* effective state: an explicit mark wins over the kept-at-home setting */
function snapshot(all) { const nu = data(), sh = nu.shopping, t = S.today();
  const sn = W(sh, 'snaps'), cd = R(sh, 'carryDone'); sn[t] = all.filter(i => !sh.checked[i.f] && !i.blocked && !['home', 'usual'].includes(eff(sh, i.f))).map(i => ({ f: i.f, he: i.he }));
  Object.keys(sn).sort().slice(0, -2).forEach(d => { delete sn[d]; }); /* keep the two latest days */
  Object.keys(cd).filter(d => !sn[d]).forEach(d => { delete cd[d]; }); }
function setState(f, st, all) { const nu = data(), sh = nu.shopping;
  if (st) { sh.state[f] = st; delete sh.checked[f]; } else delete sh.state[f];
  if (st === 'home') { const hs = W(sh, 'homeSeen'), a = hs[f] || [], t = S.today(); if (!a.includes(t)) hs[f] = a.concat(t).slice(-5); }
  if (all) snapshot(all); return S.save('nutrition'); }
function usualAsk(all) { const sh = data().shopping; /* items the user marked "at home" on 2+ different days, not yet decided */
  return all.filter(i => !R(sh, 'usual')[i.f] && !R(sh, 'usualNo')[i.f] && (R(sh, 'homeSeen')[i.f] || []).length >= USUAL_AFTER); }
function setUsual(f, on) { const before = JSON.stringify(S.load('nutrition')), sh = data().shopping;
  if (on === true) { W(sh, 'usual')[f] = S.today(); delete R(sh, 'usualNo')[f]; if (sh.state[f] === 'home') delete sh.state[f]; }
  else if (on === 'no') W(sh, 'usualNo')[f] = S.today();
  else { delete R(sh, 'usual')[f]; delete R(sh, 'homeSeen')[f]; if (sh.state[f] === 'buy') delete sh.state[f]; }
  S.save('nutrition'); return { undo: () => restore(before) }; }
function restore(json) { const cur = S.load('nutrition'); Object.keys(cur).forEach(k => delete cur[k]); Object.assign(cur, JSON.parse(json)); S.save('nutrition'); }
function carry(all) { const sh = data().shopping, t = S.today(), sn = R(sh, 'snaps'), src = Object.keys(sn).filter(d => d < t && !R(sh, 'carryDone')[d]).sort().pop();
  if (!src) return null; const cur = new Set(all.map(i => i.f)), blk = C.blockedFoods(), have = new Set(sh.custom.map(c => norm(c.text)));
  const items = sn[src].filter(x => !cur.has(x.f) && !(sh.checked || {})[x.f] && !blk.has(x.f) && !R(sh, 'usual')[x.f] && sh.state[x.f] !== 'home' && !have.has(norm(x.he)));
  return items.length ? { from: src, items } : null; }
function carryApply(all) { const c = carry(all); if (!c) return { n: 0 }; const before = JSON.stringify(S.load('nutrition'));
  let n = 0; c.items.forEach(x => { if (addCustom(x.he, all).ok) n++; }); W(data().shopping, 'carryDone')[c.from] = 1; S.save('nutrition');
  return { n, undo: () => restore(before) }; }
function carryDrop(all) { const c = carry(all); if (!c) return; W(data().shopping, 'carryDone')[c.from] = 1; S.save('nutrition'); }
function addCustom(text, planned) {
  const t = String(text || '').trim().slice(0, 80); if (!t) return { ok: false, why: 'empty' };
  const nu = data(), n = norm(t), dup = nu.shopping.custom.find(c => norm(c.text) === n) || planned.find(i => norm(i.he) === n);
  if (dup) return { ok: false, why: 'dup', name: dup.text || dup.he };
  nu.shopping.custom.push({ id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), text: t, done: false });
  return S.save('nutrition') ? { ok: true } : { ok: false, why: 'save' };
}
/* SLL-08 · Smart Grocery v3, part (1) (docs/M9-SCOPE.md): a "not found" item offers 1–3 alternatives from the existing SWAP
   table (same group, never a food the user excluded), each with its macro change summed over the planned servings in the range.
   Applying uses the existing ingredient-swap mechanism (C.setPlanSlot with an `ov` override, the same as "החלפת רכיב" in a meal),
   only for meals in the range that are not eaten yet. Nothing changes before "החלפה"; "ביטול" restores the stored data exactly.
   (2) and (3): see above. */
const FD = () => root.NUTRI.FOODS, SW = () => root.NUTRI.SWAP, L = root.Logic;
function uses(f, from, days) { /* every planned, not-eaten slot in the range whose dish contains food f, with the ingredient indexes */
  const out = [];
  for (let i = 0; i < days; i++) { const d = S.addDays(from, i), p = C.plan(d);
    C.ALL.forEach(k => { const s = p[k]; if (!s || !s.rid || s.off || s.missing || (k === 'extra' && !s.on) || C.slotEntry(d, k)) return;
      const r = L.recipe(s.rid); if (!r || r.est) return; const ings = L.recipeIngredients(r, s.ov), idx = ings.map((x, j) => x.f === f ? j : -1).filter(j => j >= 0);
      if (idx.length) out.push({ d, k, s, r, ings, idx }); }); }
  return out;
}
function alternatives(f, from, days) {
  const F = FD(), grp = Object.keys(SW()).find(g => SW()[g].includes(f)) || (F[f] || {}).grp, blk = C.blockedFoods(), nf = data().shopping.state;
  const pool = (SW()[grp] || []).filter(a => a !== f && F[a] && !blk.has(a) && nf[a] !== 'notfound'), u = uses(f, from, days);
  return { grp, uses: u, list: pool.map(a => { let dk = 0, dp = 0;
      u.forEach(x => { const ov = Object.assign({}, x.s.ov || {}); x.idx.forEach(j => { ov[j] = { f: a, g: L.suggestSwapGrams(x.ings[j], a).g }; });
        const b0 = L.recipeMacros(x.r, x.s.scale, x.s.ov), b1 = L.recipeMacros(x.r, x.s.scale, ov); dk += b1.k - b0.k; dp += b1.p - b0.p; });
      return { f: a, he: F[a].he.split(' (')[0], dk: Math.round(dk), dp: Math.round(dp * 10) / 10 }; })
    .sort((x, y) => Math.abs(x.dk) + 10 * Math.abs(x.dp) - (Math.abs(y.dk) + 10 * Math.abs(y.dp))).slice(0, 3) };
}
function applyAlt(f, a, from, days) {
  const before = JSON.parse(JSON.stringify(S.load('nutrition'))), u = uses(f, from, days);
  u.forEach(x => { const ov = Object.assign({}, x.s.ov || {}); x.idx.forEach(j => { ov[j] = { f: a, g: L.suggestSwapGrams(x.ings[j], a).g }; }); C.setPlanSlot(x.d, x.k, { rid: x.s.rid, ov }); });
  return { n: u.length, undo: () => { const cur = S.load('nutrition'); Object.keys(cur).forEach(k => delete cur[k]); Object.assign(cur, JSON.parse(JSON.stringify(before))); S.save('nutrition'); } };
}
function altSheet(i, from, days) {
  const A = alternatives(i.f, from, days), sg = v => (v > 0 ? '+' : '') + v;
  root.UI.sheet('חלופות ל' + i.he, A.list.length ? `<p class="small muted">"${esc(i.he)}" מופיע ב־${A.uses.length} ארוחות מתוכננות בטווח שעוד לא נאכלו. בחירה בחלופה מחליפה את הרכיב רק בארוחות האלה, באותו אופן כמו "החלפת רכיב" בתפריט. השינוי בערכים מחושב לכל הארוחות יחד:</p>
    <div class="list" data-alt-list>${A.list.map(x => `<div class="li" data-alt="${x.f}"><div class="grow"><div class="t">${esc(x.he)}</div><div class="s" data-alt-diff>${sg(x.dk)} קק״ל · ${sg(x.dp)} ג׳ חלבון</div></div><button class="btn sm primary" data-act="altApply" data-a="${x.f}">החלפה</button></div>`).join('')}</div>
    <p class="tiny faint">רק רכיבים מאותה קבוצה, ואף פעם לא מזון שהחרגת. הכמות מוצעת כדי לשמור על ערך דומה; אפשר לכוונן במנה עצמה.</p>`
    : `<p data-alt-none>אין חלופה מתאימה מאותה קבוצה שתואמת להעדפות שלך. אפשר להחליף את המנה עצמה בתפריט.</p><a class="btn" href="#/nutrition">לתפריט</a>`,
    { altApply: (el, e, close) => { const r = applyAlt(i.f, el.dataset.a, from, days); close(); root.App.render();
        root.UI.toast(`הוחלף ב־${r.n} ארוחות`, 0, { label: 'ביטול', fn: () => { r.undo(); root.App.render(); } }); } });
}
Screens.shopping = function (arg) {
  if (arg && [3, 7, 14].includes(+arg)) shopSt.days = +arg;
  const sh = G().shopping(S.today(), shopSt.days), nu = data(), ck = nu.shopping.checked || {}, stt = nu.shopping.state, custom = nu.shopping.custom;
  const sx = nu.shopping, E = f => eff(sx, f), out = i => ['home', 'usual'].includes(E(i.f));
  const all = sh.groups.flatMap(g => g.items), toBuy = all.filter(i => !out(i)), total = toBuy.length, done = toBuy.filter(i => ck[i.f]).length;
  const atHome = all.filter(i => E(i.f) === 'home'), usualL = all.filter(i => E(i.f) === 'usual'), ask = usualAsk(all), cy = carry(all);
  const row = i => `<div class="li shop-i" data-shop-row="${i.f}" data-state="${ck[i.f] ? 'bought' : stt[i.f] || 'buy'}"><label class="grow shop-l"><input type="checkbox" data-shop="${i.f}" aria-label="נקנה: ${esc(i.he)}" ${ck[i.f] ? 'checked' : ''}><div class="grow"><div class="t">${esc(i.he)}${i.blocked ? ` <span class="pill bad" data-shop-blocked="${i.f}">${esc(C.KIND_HE[i.kind])} — מוחרג אצלך</span>` : ''}${stt[i.f] === 'notfound' ? ' <button class="btn sm ghost" data-act="alt" data-f="' + i.f + '" data-alt-open>חלופות</button>' : ''}${stt[i.f] === 'notfound' ? ' <span class="pill warn" data-notfound>לא נמצא</span>' : ''}</div><div class="s">${i.units ? `${i.units} × ${esc(i.unitHe || 'יח׳')} · ` : ''}${fmtN(i.g)} ג׳ (${esc(i.st)}) · ב־${i.recipes} מנות</div>${stt[i.f] === 'notfound' ? '<div class="tiny muted">אפשר להחליף את הרכיב במנה: ביומן התזונה ← "החלף רכיב".</div>' : ''}</div></label><div class="shop-st">${['home', 'notfound'].map(s => `<button class="chip sm" data-act="st" data-f="${i.f}" data-s="${s}" aria-pressed="${stt[i.f] === s}">${ST_HE[s]}</button>`).join('')}</div></div>`;
  return { title: 'רשימת קניות', back: '#/nutrition', html: `
    ${(() => { const sd = C.profile().shopDay, DOW = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']; return `<label class="field" data-shopday>יום קניות קבוע (רשות)<select id="shop-day" data-act="shopDay"><option value="" ${sd == null || sd === '' ? 'selected' : ''}>אין</option>${DOW.map((d, i) => `<option value="${i}" ${sd !== '' && sd != null && +sd === i ? 'selected' : ''}>יום ${d}</option>`).join('')}</select></label><p class="tiny muted">אם תבחרו יום, בכרטיס "עכשיו" יופיע קיצור לרשימה ביום הזה וביום שלפניו.</p>`; })()}
    <div class="seg" role="group" aria-label="טווח">${[3, 7, 14].map(d => `<button data-act="days" data-d="${d}" aria-pressed="${shopSt.days === d}">${d} ימים</button>`).join('')}</div>
    <p class="small muted">${esc(S.fmtDate(sh.from))} – ${esc(S.fmtDate(sh.to))}: ${sh.recipeCount} מנות שונות מהתפריט${C.plan(S.today()).source === 'plan' ? ' האישי' : ''}. ארוחות שכבר נאכלו ותוספות שלא נבחרו לא נכללות.</p>
    ${cy ? `<section class="card" data-carry><h3>מהרשימה של ${esc(S.fmtShort(cy.from))}</h3><p class="small">${cy.items.length === 1 ? 'פריט אחד' : cy.items.length + ' פריטים'} לא ${cy.items.length === 1 ? 'סומן' : 'סומנו'} כנקנה ו${cy.items.length === 1 ? 'אינו' : 'אינם'} ברשימה הנוכחית: <span data-carry-items>${cy.items.map(x => esc(x.he)).join(', ')}</span>.</p><div class="btns"><button class="btn sm primary" data-act="carryAdd">להוסיף לפריטים שלי</button><button class="btn sm ghost" data-act="carryNo">לא תודה</button></div></section>` : ''}
    ${ask.length ? `<section class="card" data-usual-ask>${ask.map(i => `<div class="li" data-ask="${i.f}"><div class="grow"><div class="t">לסמן "${esc(i.he)}" כ"בדרך כלל בבית"?</div><div class="s">סימנת שיש בבית ב־${(R(sx, 'homeSeen')[i.f] || []).length} ימים שונים. אם כן, הוא יופיע מקופל בתחתית ולא ייספר; תמיד אפשר "צריך לקנות הפעם" או להסיר.</div></div><button class="btn sm primary" data-act="uyes" data-f="${i.f}">כן</button><button class="btn sm ghost" data-act="uno" data-f="${i.f}">לא</button></div>`).join('')}</section>` : ''}
    ${sh.blocked ? `<div class="banner bad small" data-shop-warn>${icon('info')}<div>${sh.blocked === 1 ? 'פריט אחד ברשימה מוחרג' : sh.blocked + ' פריטים ברשימה מוחרגים'} אצלך. הם מופיעים רק כי בחרת בעצמך מנה שמכילה אותם — כדאי להחליף את המנה.</div></div>` : ''}${all.length ? `<section class="card"><div class="card-h"><h3>מה לקנות</h3><span class="pill" data-shop-progress>${done}/${total}</span></div>
      ${sh.groups.map(g => { const its = g.items.filter(i => !out(i)); return its.length ? `<h4>${esc(g.he)}</h4><div class="list">${its.map(row).join('')}</div>` : ''; }).join('')}
      ${atHome.length ? `<h4>יש בבית (לא נספר)</h4><div class="list" data-at-home>${atHome.map(row).join('')}</div>` : ''}
      ${usualL.length ? `<details data-usual><summary>בדרך כלל בבית (${usualL.length}, לא נספר)</summary><div class="list">${usualL.map(i => `<div class="li" data-usual-row="${i.f}"><div class="grow"><div class="t">${esc(i.he)}</div><div class="s">${fmtN(i.g)} ג׳ (${esc(i.st)}) · סימנת שבדרך כלל יש בבית</div></div><button class="btn sm" data-act="ubuy" data-f="${i.f}">צריך לקנות הפעם</button><button class="btn sm ghost" data-act="uoff" data-f="${i.f}">הסרה</button></div>`).join('')}</div></details>` : ''}
      <p class="tiny faint">משקל "נא" = לפני בישול, "יבש" = לפני השריה או בישול (אורז, קטניות, פסטה), "מוכן" = כפי שקונים. הכמויות הן סכום המנות המתוכננות, בלי עודף לפחת.</p></section>` : '<div class="empty" data-empty-state>אין ארוחות מתוכננות בטווח הזה.</div>'}
    <section class="card" data-custom><h3>פריטים שלי</h3>${custom.length ? `<div class="list">${custom.map(c => `<div class="li shop-i" data-custom-row="${c.id}"><label class="grow shop-l"><input type="checkbox" data-cdone="${c.id}" aria-label="נקנה: ${esc(c.text)}" ${c.done ? 'checked' : ''}><span class="grow t">${esc(c.text)}</span></label><button class="btn sm ghost" data-act="cdel" data-id="${c.id}" aria-label="מחיקה: ${esc(c.text)}">מחיקה</button></div>`).join('')}</div>` : '<p class="tiny muted">אין עדיין. פריטים שתוסיפו כאן נשמרים גם כשמנקים סימונים.</p>'}
      <div class="row"><input id="c-add" aria-label="פריט להוספה לרשימה" type="text" maxlength="80" placeholder="למשל: נייר אפייה"><button class="btn sm" data-act="cadd">${icon('plus')} הוספה</button></div></section>
    <div class="btns"><button class="btn" data-act="copy">${icon('share')} העתקת הרשימה</button>${done || Object.keys(stt).length || custom.some(c => c.done) ? '<button class="btn ghost" data-act="clear">ניקוי סימונים ומצבים</button>' : ''}<a class="btn ghost" href="#/reset" data-reset-link>איפוס שבועי</a></div>
    ${sh.batch.length || sh.prep.length ? `<section class="card" data-mealprep><h3>הכנה מראש — לבשל פעם אחת</h3><ul class="bul small">${sh.batch.map(b => `<li data-batch="${b.f}"><b>${esc(b.he)}</b>: ${fmtN(b.g)} ג׳ (${esc(b.st)}) ל־${b.meals} ארוחות${b.sessions.length > 1 ? ` — <span data-batch-sessions="${b.sessions.length}">${b.sessions.length} בישולים, כדי שלא יישאר במקרר יותר מ־3 ימים:</span> ${b.sessions.map(s => `${esc(S.fmtShort(s.cook))}: ${fmtN(s.g)} ג׳ ל־${s.meals === 1 ? 'ארוחה אחת' : s.meals + ' ארוחות'}`).join(' · ')}` : ` — ${b.dates.map(d => esc(S.fmtShort(d))).join(', ')}`}.</li>`).join('')}${sh.prep.map(r => `<li data-prep="${r.id}"><a href="#/recipe/${r.id}">${esc(r.he)}</a> מופיעה ${r.n} פעמים (${r.dates.map(d => esc(S.fmtShort(d))).join(', ')}) — ${r.sessions.length > 1 ? `<span data-prep-sessions="${r.sessions.length}">${r.sessions.map(s => `${esc(S.fmtShort(s.cook))}: ${s.meals} מנות`).join(' · ')}</span> (עד 3 ימים במקרר).` : `אפשר להכין ${r.n} מנות יחד.`}</li>`).join('')}</ul><p class="tiny faint">אוכל מבושל נשמר במקרר בדרך כלל 3–4 ימים, לכן ההצעות מחולקות לבישולים של עד 3 ימים קדימה; לטווח ארוך יותר — הקפאה במנות. נשאר משהו מבושל? <a href="#/fridge" data-prep-leftovers>סמנו שאריות</a> ותקבלו מנות שמשתמשות בהן.</p></section>` : ''}`,
    handlers: { days: el => { location.hash = '#/shopping/' + el.dataset.d; },
      shopDay: el => { const p = S.load('profile'); p.shopDay = el.value === '' ? null : +el.value; S.save('profile'); root.UI.toast(el.value === '' ? 'אין יום קניות קבוע' : 'יום הקניות נשמר'); },
      alt: el => { const it = all.find(x => x.f === el.dataset.f); if (it) altSheet(it, sh.from, sh.days); },
      st: el => { const cur = data().shopping.state[el.dataset.f]; setState(el.dataset.f, cur === el.dataset.s ? null : el.dataset.s, all); root.App.render(); },
      uyes: el => { const r = setUsual(el.dataset.f, true); root.App.render(); root.UI.toast('סומן כ"בדרך כלל בבית"', 0, { label: 'ביטול', fn: () => { r.undo(); root.App.render(); } }); },
      uno: el => { setUsual(el.dataset.f, 'no'); root.App.render(); },
      ubuy: el => { setState(el.dataset.f, 'buy', all); root.App.render(); },
      uoff: el => { const r = setUsual(el.dataset.f, false); root.App.render(); root.UI.toast('הוסר מ"בדרך כלל בבית"', 0, { label: 'ביטול', fn: () => { r.undo(); root.App.render(); } }); },
      carryAdd: () => { const r = carryApply(all); root.App.render(); root.UI.toast(`נוספו ${r.n} פריטים`, 0, r.undo ? { label: 'ביטול', fn: () => { r.undo(); root.App.render(); } } : undefined); },
      carryNo: () => { carryDrop(all); root.App.render(); },
      cadd: () => { const r = addCustom(document.getElementById('c-add').value, all); if (r.ok) { root.UI.toast('נוסף'); root.App.render(); } else if (r.why === 'dup') root.UI.toast(`"${r.name}" כבר ברשימה — לא נוסף שוב`); else if (r.why === 'empty') root.UI.toast('כתבו מה להוסיף'); },
      cdel: el => { const nu = data(); const c = nu.shopping.custom.find(x => x.id === el.dataset.id); nu.shopping.custom = nu.shopping.custom.filter(x => x.id !== el.dataset.id); if (S.save('nutrition')) root.UI.toast('נמחק', 0, { label: 'ביטול', fn: () => { const n2 = data(); if (c && !n2.shopping.custom.some(x => x.id === c.id)) { n2.shopping.custom.push(c); S.save('nutrition'); } root.App.render(); } }); root.App.render(); },
      copy: () => { const st0 = data().shopping; const txt = G().shoppingText(Object.assign({}, sh, { groups: sh.groups.map(g => Object.assign({}, g, { items: g.items.filter(i => !['home', 'usual'].includes(eff(st0, i.f))).map(i => Object.assign({}, i, { st: i.st + (st0.state[i.f] === 'notfound' ? ' · לא נמצא' : '') })) })) }), st0.checked) + (st0.custom.length ? '\n\nפריטים שלי:\n' + st0.custom.map(c => `${c.done ? '✓' : '☐'} ${c.text}`).join('\n') : '');
        try { navigator.clipboard.writeText(txt).then(() => root.UI.toast('הרשימה הועתקה'), () => root.UI.toast('ההעתקה לא זמינה כאן')); } catch (e) { root.UI.toast('ההעתקה לא זמינה כאן'); } },
      clear: () => { const nu = data(); nu.shopping.checked = {}; nu.shopping.state = {}; /* keeps "usually at home" and the user's items */ nu.shopping.custom.forEach(c => { c.done = false; }); S.save('nutrition'); root.App.render(); } },
    after: v => { v.querySelectorAll('[data-shop]').forEach(cb => cb.addEventListener('change', () => { G().toggleCheck(cb.dataset.shop, cb.checked); if (cb.checked && data().shopping.state[cb.dataset.shop] !== 'buy') setState(cb.dataset.shop, null); snapshot(all); S.save('nutrition'); const n = v.querySelectorAll('[data-shop-row]:not([data-state="home"]) [data-shop]:checked').length, pr = v.querySelector('[data-shop-progress]'); if (pr) pr.textContent = `${n}/${total}`; }));
      v.querySelectorAll('[data-cdone]').forEach(cb => cb.addEventListener('change', () => { const nu = data(), c = nu.shopping.custom.find(x => x.id === cb.dataset.cdone); if (c) { c.done = cb.checked; S.save('nutrition'); } })); } };
};
Screens.shopping.addCustom = addCustom; Screens.shopping.setState = setState; Screens.shopping.alternatives = alternatives; Screens.shopping.applyAlt = applyAlt; Screens.shopping.carry = carry; Screens.shopping.usualAsk = usualAsk;
})(window);
