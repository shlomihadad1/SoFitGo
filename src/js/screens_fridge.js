/* RC5 · #/fridge — Fridge-to-Meal (INN-03, first slice; on-demand chunk extra.js).
   The user marks what they have (foods from the app's own food database); recipes are ranked by how few ingredients are
   missing, using stable food ids — no image recognition, no guessing quantities. Oil / ghee / olive oil are assumed to be at
   home (shown, and can be switched off). The user's dietary restrictions and allergies exclude recipes exactly as in the menu
   (Core.conflicts); nothing here guarantees a dish is allergen-free. "Without shopping" = nothing missing.
   Equipment: recipes whose ONLY options need an oven / a blender are hidden when the user says they have none.
   Selection is stored in nutrition.fridge = { have: [foodId], noPantry: bool, noOven: bool, noBlender: bool, at }. */
(function (root) {
const { esc, icon } = root.UI; const S = root.Store, C = root.Core, L = root.Logic, N = root.NUTRI;
const Screens = root.Screens;
const PANTRY = ['oil', 'ghee', 'olive_oil'];
const GRP_HE = { protein: 'חלבון', dairy: 'מוצרי חלב', legume: 'קטניות', carb: 'פחמימות', veg: 'ירקות', fruit: 'פירות', fat: 'שומנים ואגוזים', condiment: 'רטבים' };
const st = { q: '', onlyNoShop: false };
function fr() { const nu = S.load('nutrition'); nu.fridge = Object.assign({ have: [], noPantry: false, noOven: false, noBlender: false }, nu.fridge || {}); return nu; }
/* equipment text → needs. An item with an alternative ("תנור או מחבת", "תנור/מחבת") is satisfied by the basic option. */
const needs = r => { const out = new Set(); (r.equip || []).forEach(e => { const alts = String(e).split(/\s*(?:\/|או)\s*/).filter(Boolean);
  const basic = alts.some(a => !/תנור|בלנדר|מטחנה|מעבד מזון/.test(a)); if (basic) return; if (alts.some(a => /תנור/.test(a))) out.add('oven'); if (alts.some(a => /בלנדר|מטחנה|מעבד מזון/.test(a))) out.add('blender'); }); return out; };
/* exported for tests: rank recipes for a set of available food ids */
function rank(have, opts) {
  const H = new Set(have); if (!opts.noPantry) PANTRY.forEach(f => H.add(f));
  const out = [];
  for (const r of N.RECIPES) {
    if (r.est) continue; /* restaurant estimates are not cooked at home */
    if (C.conflicts(r, null).length) continue; /* same rule as the menu: user restrictions/allergies */
    const nd = needs(r); if ((opts.noOven && nd.has('oven')) || (opts.noBlender && nd.has('blender'))) continue;
    const ing = [...new Set(r.ing.map(i => i.f))], missing = ing.filter(f => !H.has(f)), used = ing.filter(f => H.has(f) && !PANTRY.includes(f));
    if (!used.length) continue; /* nothing of what the user has */
    out.push({ r, missing, used, min: (r.prep || 0) + (r.cook || 0) });
  }
  return out.sort((a, b) => a.missing.length - b.missing.length || b.used.length - a.used.length || a.min - b.min);
}
/* SLL-14 · Smart Leftovers. Cooked leftovers the user marks (a cooked base: protein / grain / legume from the food database) with the
   day it was cooked. Same storage rule as the meal-prep planner (SLL-32): cooked food is used up to 3 days after cooking — after that
   the leftover is shown as "לא להשתמש" and is never suggested. Dishes that use a leftover come first, soonest to expire first; the
   user's restrictions apply exactly as in the menu (same rank()). Stored in nutrition.leftovers = [{ id, f, cooked }]; nothing is
   inferred automatically, and removing one is explicit (with undo). */
const KEEP = 3, LO_GRP = ['protein', 'carb', 'legume'];
function loList() { const nu = S.load('nutrition'), t = S.today(); return (nu.leftovers || []).map(x => Object.assign({}, x, { until: S.addDays(x.cooked, KEEP), ok: S.diffDays(x.cooked, t) <= KEEP })); }
function loSuggest(have, opts) { const live = loList().filter(x => x.ok); if (!live.length) return [];
  const exp = {}; live.forEach(x => { if (!exp[x.f] || x.until < exp[x.f]) exp[x.f] = x.until; });
  return rank([...new Set(have.concat(Object.keys(exp)))], opts).filter(x => x.used.some(f => exp[f])).map(x => Object.assign(x, { lo: x.used.filter(f => exp[f]), until: Math.min(...x.used.filter(f => exp[f]).map(f => +exp[f].replace(/-/g, ''))) }))
    .sort((a, b) => a.until - b.until || a.missing.length - b.missing.length).slice(0, 6); }
function loCard(f) { const F = N.FOODS, L0 = loList(), opts = Object.keys(F).filter(k => LO_GRP.includes(F[k].grp) && ['raw', 'dry'].includes(F[k].st)).sort((a, b) => F[a].he.localeCompare(F[b].he, 'he')), sug = loSuggest(f.have, f);
  return `<section class="card" data-leftovers><h3>שאריות מבושלות</h3>
    ${L0.length ? `<div class="list">${L0.map(x => `<div class="li" data-lo="${x.id}" data-lo-ok="${x.ok}"><div class="grow"><div class="t">${esc(F[x.f].he.split(' (')[0])} (מבושל)</div><div class="s">${x.ok ? `בושל ${esc(S.fmtShort(x.cooked))} · בטוח עד ${esc(S.fmtShort(x.until))}` : `<b class="bad">עברו יותר מ־${KEEP} ימים — לא להשתמש</b>`}</div></div><button class="btn sm ghost" data-act="loDel" data-id="${x.id}" aria-label="הסרה: ${esc(F[x.f].he)}">הסרה</button></div>`).join('')}</div>` : '<p class="small muted">אין שאריות שסימנת.</p>'}
    <div class="row wrap"><select id="lo-f" aria-label="מה נשאר מבושל"><option value="">מה נשאר?</option>${opts.map(k => `<option value="${k}">${esc(F[k].he.split(' (')[0])}</option>`).join('')}</select><select id="lo-d" aria-label="מתי בושל"><option value="0">בושל היום</option><option value="1">אתמול</option><option value="2">שלשום</option></select><button class="btn sm" data-act="loAdd">הוספה</button></div>
    ${sug.length ? `<h4>מנות עם השאריות</h4><div class="list" data-lo-sug>${sug.map(x => `<a class="li" href="#/recipe/${x.r.id}" data-lo-recipe="${x.r.id}"><div class="grow"><div class="t">${esc(x.r.he)}</div><div class="s">משתמש ב: ${x.lo.map(k => esc(F[k].he.split(' (')[0])).join(', ')}${x.missing.length ? ` · חסר: ${x.missing.map(k => esc(F[k].he.split(' (')[0])).join(', ')}` : ' · בלי קניות'}</div></div>${icon('chev')}</a>`).join('')}</div>` : ''}
    <p class="tiny faint">אוכל מבושל — עד ${KEEP} ימים במקרר אחרי הבישול (כמו בהכנה מראש). ההגבלות והאלרגיות שלך חלות גם כאן.</p></section>`; }
Screens.fridge = function () {
  const nu = fr(), f = nu.fridge, F = N.FOODS, used = new Set(); N.RECIPES.forEach(r => { if (!r.est) r.ing.forEach(i => used.add(i.f)); });
  const groups = {}; [...used].filter(k => F[k] && !PANTRY.includes(k)).forEach(k => { (groups[F[k].grp] = groups[F[k].grp] || []).push(k); });
  const all = rank(f.have, f), list = st.onlyNoShop ? all.filter(x => !x.missing.length) : all, top = list.slice(0, 12), q = st.q.trim();
  const chip = k => `<button class="chip" data-act="fh" data-f="${k}" aria-pressed="${f.have.includes(k)}" data-q="${esc(F[k].he)}">${esc(F[k].he)}</button>`;
  return { title: 'מה יש במקרר?', back: '#/nutrition', html: `
    ${loCard(f)}
    <section class="card"><p class="small">סמנו מה יש לכם, והאפליקציה תציע מנות מהמאגר שחסר להן הכי מעט. ההגבלות והאלרגיות שהגדרתם חלות כאן כמו בתפריט — אבל זה לא מבטיח שמנה נקייה מאלרגנים.</p>
      ${f.have.length ? `<div class="row between" data-fridge-summary><span class="small">נבחרו <b class="num">${f.have.length}</b> · <b class="num">${list.length}</b> הצעות</span><button class="btn sm secondary" data-act="toRes">לתוצאות ↓</button></div>` : ''}
      <label class="field">חיפוש רכיב<input id="fr-q" type="search" value="${esc(q)}" placeholder="למשל: ביצים"></label>
      ${Object.keys(GRP_HE).filter(g => groups[g]).map(g => `<h4>${GRP_HE[g]}</h4><div class="chips fr-chips" style="flex-wrap:wrap">${groups[g].sort((a, b) => F[a].he.localeCompare(F[b].he, 'he')).map(chip).join('')}</div>`).join('')}
      <div class="chips" style="flex-wrap:wrap;margin-top:8px"><button class="chip" data-act="ft" data-k="noPantry" aria-pressed="${!f.noPantry}">יש שמן / גהי / שמן זית</button><button class="chip" data-act="ft" data-k="noOven" aria-pressed="${f.noOven}">אין תנור</button><button class="chip" data-act="ft" data-k="noBlender" aria-pressed="${f.noBlender}">אין בלנדר</button><button class="chip" data-act="fns" aria-pressed="${st.onlyNoShop}">רק בלי קניות</button></div>
      ${f.have.length ? `<button class="btn sm ghost" data-act="fclr">ניקוי הבחירה (${f.have.length})</button>` : ''}</section>
    <section class="card" data-fridge-results><h3>${f.have.length ? (top.length ? `הצעות (${list.length})` : 'אין מנה מתאימה') : 'בחרו כמה רכיבים'}</h3>
      ${top.length ? `<div class="list">${top.map(x => `<a class="li" href="#/recipe/${x.r.id}" data-fr-recipe="${x.r.id}" data-missing="${x.missing.length}"><div class="grow"><div class="t">${esc(x.r.he)}</div><div class="s">${x.missing.length ? `חסר: ${x.missing.map(k => esc(F[k].he)).join(', ')}` : '<b class="good">בלי קניות — יש הכול</b>'} · ${x.min ? x.min + ' דק׳ בסך הכול' : 'בלי זמן הכנה'}</div></div>${icon('chev')}</a>`).join('')}</div>` : f.have.length ? `<p class="small muted">${st.onlyNoShop ? 'אין מנה שאפשר להכין בלי קניות. נסו לבטל "רק בלי קניות".' : 'לא נמצאה מנה עם הרכיבים האלה שמתאימה להגבלות שלכם.'}</p>` : ''}
      <p class="tiny faint">שאריות (למשל אורז מבושל) — סמנו את הרכיב עצמו. הכמויות במתכון הן למנה אחת; בדקו שיש מספיק.</p></section>`,
    handlers: {
      fh: el => { const n = fr(), h = n.fridge.have, k = el.dataset.f; n.fridge.have = h.includes(k) ? h.filter(x => x !== k) : h.concat(k); n.fridge.at = new Date().toISOString(); S.save('nutrition'); root.App.render(); },
      ft: el => { const n = fr(), k = el.dataset.k; n.fridge[k] = !n.fridge[k]; S.save('nutrition'); root.App.render(); },
      fns: () => { st.onlyNoShop = !st.onlyNoShop; root.App.render(); },
      toRes: () => { const r = document.querySelector('[data-fridge-results]'); if (!r) return; r.scrollIntoView({ behavior: document.documentElement.dataset.motion === 'reduce' ? 'auto' : 'smooth', block: 'start' }); const h = r.querySelector('h3'); if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); } },
      loAdd: () => { const fv = document.getElementById('lo-f').value, dv = +document.getElementById('lo-d').value || 0; if (!fv) { root.UI.toast('בחרו מה נשאר'); return; }
        const n = fr(); n.leftovers = (n.leftovers || []).concat({ id: 'l' + Date.now().toString(36), f: fv, cooked: S.addDays(S.today(), -dv) }); S.save('nutrition'); root.App.render(); },
      loDel: el => { const n = fr(), keep = JSON.stringify(n.leftovers || []); n.leftovers = (n.leftovers || []).filter(x => x.id !== el.dataset.id); S.save('nutrition'); root.App.render();
        root.UI.toast('הוסר', 0, { label: 'ביטול', fn: () => { const m = fr(); m.leftovers = JSON.parse(keep); S.save('nutrition'); root.App.render(); } }); },
      fclr: () => { const n = fr(); n.fridge.have = []; S.save('nutrition'); root.App.render(); } },
    after: v => { const i = v.querySelector('#fr-q'); if (!i) return; const flt = () => { st.q = i.value; const t = i.value.trim(); v.querySelectorAll('.fr-chips .chip').forEach(c => { c.hidden = !!t && !c.dataset.q.includes(t); }); }; i.addEventListener('input', flt); flt(); } };
};
Screens.fridge.rank = rank; Screens.fridge.needs = needs; Screens.fridge.leftovers = loList; Screens.fridge.loSuggest = loSuggest;
})(window);
