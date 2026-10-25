/* M11.3 · meal personalisation & swap (on-demand chunk extra.js). Replaces the old inline swap sheet of the nutrition screen and is
   also used by Sofit, so there is ONE swap path: options() ranks candidates, sheet() lets the user choose, confirmSwap() previews and
   saves through Core.setPlanSlot (the existing storage) and reports success only after the write succeeded.
   Rules: restrictions (Core.conflicts) are never bypassed; dishes marked "לא אוהב/ת" are hidden; the chosen cuisines come first (other
   cuisines stay available, labelled); maxPrep from the preferences marks slow dishes. Values are computed from the ingredients
   (restaurant dishes are labelled estimates). Goals/targets are only read — never changed here. */
(function (root) {
'use strict';
const { esc, icon } = root.UI; const S = root.Store, C = root.Core, L = root.Logic, N = () => root.NUTRI, Screens = root.Screens;
const U = () => Screens._nu; /* shared helpers of the nutrition screen: fmt, diffTable, timeShort, COST_HE */
const mins = r => (r.prep || 0) + (r.cook || 0);
const SORTS = { close: 'הכי קרוב בערכים', protein: 'יותר חלבון', quick: 'מהיר להכנה', light: 'פחות קלוריות' };
function defaultSort() { if (root.Gate && root.Gate.trip && root.Gate.trip()) return 'quick'; /* traveling: quick dishes first */ const g = (C.profile().aims || {}).primary; return ['fat_loss', 'weight_loss'].includes(g) ? 'light' : ['muscle', 'gain', 'strength'].includes(g) ? 'protein' : 'close'; }
/* returns { cur, base, list:[{r,m,flags,cuOk,main,slow,est}], other:[...] (other cuisines), hidden:{blocked,disliked} } */
function options(date, slot, sort) {
  const s = C.plan(date)[slot], empty = !s.rid || s.off || s.missing, pf = C.normPrefs(C.profile().prefs), dis = new Set(C.profile().nutritionDislike || []);
  const cur = empty ? null : L.recipe(s.rid), base = empty ? { k: 0, p: 0, c: 0, f: 0, fb: 0 } : C.slotMacros(s);
  const all = empty ? N().RECIPES.filter(x => x.meal === C.mealOf(slot) && !x.est).map(x => ({ r: x, m: L.recipeMacros(x), flags: [], score: 0 })) : L.swapCandidates(cur, N().RECIPES);
  /* dishes already planned in the day's OTHER slots are not offered (since v2, lunch and dinner share one pool, so the dinner dish
     could appear as the top lunch option and the day would repeat a dish) */
  const day = C.plan(date), inDay = new Set(C.DAY.filter(k => k !== slot && day[k] && day[k].rid && !day[k].off).map(k => day[k].rid));
  let blocked = 0, disliked = 0, same = 0; const keep = [];
  all.forEach(o => { if (dis.has(o.r.id)) { disliked++; return; } if (inDay.has(o.r.id)) { same++; return; } if (root.Gate ? !root.Gate.checkMeal(o.r, null).ok : C.conflicts(o.r, null).length) { blocked++; return; } /* M12: the Plan Integrity Gate decides */
    keep.push(Object.assign(o, { cuOk: C.cuisineAllowed(o.r, pf), main: C.cuisineMainOk(o.r, pf), slow: !!(pf.maxPrep && mins(o.r) > pf.maxPrep), est: !!o.r.est })); });
  sort = SORTS[sort] ? sort : defaultSort();
  const key = { close: o => (o.flags.length ? 100 : 0) + o.score, protein: o => -o.m.p + (empty || o.m.k <= base.k * 1.25 + 50 ? 0 : 1000), quick: o => mins(o.r), light: o => o.m.k + (empty || o.m.p >= base.p * 0.8 ? 0 : 1000) }[sort];
  const ord = (a, z) => (z.main - a.main) || (key(a) - key(z));
  let list = keep.filter(o => o.cuOk).sort(ord), other = keep.filter(o => !o.cuOk).sort(ord);
  if (sort === 'quick') { const lim = pf.maxPrep || 20; const q = list.filter(o => mins(o.r) <= lim); if (q.length) list = q.concat(list.filter(o => mins(o.r) > lim)); }
  return { s, empty, cur, base, list, other, hidden: { blocked, disliked, same }, sort, pf };
}
function card(o, base) { const F = N().FOODS, nu = U(); const main = o.r.ing.filter(x => F[x.f].grp !== 'fat').slice(0, 4).map(x => `${F[x.f].he.split(' (')[0]} ${x.g}ג׳`).join(' · ');
  const dk = o.m.k - base.k, dp = Math.round(o.m.p - base.p);
  return `<button class="li li-btn" data-act="pick" data-id="${o.r.id}"><div class="grow stack tight"><div class="t">${esc(o.r.he)}${o.est ? ' <span class="pill acc">הערכה ±' + Math.round((o.r.range || 0.2) * 100) + '%</span>' : ''}${o.main ? ' <span class="pill">המטבח המועדף</span>' : ''}${!o.cuOk ? ' <span class="pill">מטבח אחר</span>' : ''}</div><div class="s">${esc(main)}</div>
    <div class="kv">${nu.fmt(o.m)}<span>⏱ ${nu.timeShort(o.r)}${o.slow ? ' <b class="warn">ארוך מהזמן שהגדרת</b>' : ''}</span><span>${nu.COST_HE[o.r.cost]}</span></div>${base.k ? `<div class="tiny ${o.flags.length ? 'warn' : 'muted'}">${dk > 0 ? '+' : ''}${dk} קק״ל, ${dp > 0 ? '+' : ''}${dp} ג׳ חלבון לעומת הנוכחית</div>` : ''}</div></button>`; }
function sheet(date, slot, sort) {
  const o = options(date, slot, sort), nu = U(), locked = !!C.slotEntry(date, slot);
  const html = `<div class="stack" data-meal-opts><div class="banner info small"><div>${o.empty ? 'אין כרגע מנה במקום הזה.' : `נוכחי: <b>${esc(o.cur.he)}</b> · ${o.base.k} קק״ל · ${o.base.p} ג׳ חלבון`}</div></div>
    <div class="chips" role="group" aria-label="סדר החלופות">${Object.entries(SORTS).map(([k, v]) => `<button class="chip" data-act="sort" data-s="${k}" aria-pressed="${o.sort === k}">${v}</button>`).join('')}</div>
    <div class="row">${o.s.changed ? '<button class="btn sm" data-act="reset">חזרה לארוחה המקורית</button>' : ''}${o.empty ? '' : `<button class="btn sm ghost" data-act="dislike" data-id="${o.cur.id}">לא אוהב/ת את המנה הזו</button>`}</div>
    <div class="list" data-opt-list>${o.list.slice(0, 8).map(x => card(x, o.base)).join('') || '<p class="muted small" data-opt-none>אין חלופה מהמטבח שבחרת — ראו מטבחים אחרים למטה, או שנו את העדפות המטבח בהגדרות.</p>'}</div>
    ${o.list.length > 8 ? `<details class="more"><summary>עוד ${o.list.length - 8} חלופות</summary><div class="list">${o.list.slice(8).map(x => card(x, o.base)).join('')}</div></details>` : ''}
    ${o.other.length ? `<details class="more" data-opt-other><summary>מטבחים אחרים (${o.other.length})</summary><div class="list">${o.other.map(x => card(x, o.base)).join('')}</div></details>` : ''}
    ${o.hidden.same ? `<p class="tiny faint" data-opt-same>${o.hidden.same === 1 ? 'מנה אחת הוסתרה כי היא כבר בתפריט של היום.' : o.hidden.same + ' מנות הוסתרו כי הן כבר בתפריט של היום.'}</p>` : ''}${o.hidden.blocked || o.hidden.disliked ? `<p class="tiny faint" data-opt-hidden>${o.hidden.blocked ? `${o.hidden.blocked} מנות הוסתרו כי אינן תואמות להגבלות התזונה שלך. ` : ''}${o.hidden.disliked ? `${o.hidden.disliked} מנות שסימנת "לא אוהב/ת" הוסתרו.` : ''}</p>` : ''}
    <p class="tiny faint">הערכים מחושבים מהמרכיבים ומעוגלים; "עלות" היא דירוג יחסי בלבד ולא מחיר.${locked ? ' הרישום של מה שכבר נאכל לא ישתנה.' : ''}</p></div>`;
  root.UI.sheet('החלפת ' + C.slotNames[slot], html, {
    sort: (el, e, close) => { close(); sheet(date, slot, el.dataset.s); },
    pick: (el, e, close) => { close(); confirmSwap(date, slot, el.dataset.id, null, o); },
    dislike: (el, e, close) => { if (!dislike(date, slot, el.dataset.id)) { root.UI.toast('השמירה נכשלה — הסימון לא נשמר'); return; } close(); root.UI.toast('סומן "לא אוהב/ת" — המנה לא תוצע יותר. אפשר לבחור חלופה:'); root.App.render(); sheet(date, slot, o.sort); },
    reset: (el, e, close) => { const nu2 = S.load('nutrition'); if (nu2.plan[date]) delete nu2.plan[date][slot]; S.save('nutrition'); close(); root.App.render(); } });
}
/* mark a dish "לא אוהב/ת" (profile.nutritionDislike) and, if it is in this slot today because the user had picked it, drop that pick so
   the menu guard can replace it. Returns false when the profile could not be saved. */
function dislike(date, slot, rid) {
  const pr = C.profile(); pr.nutritionDislike = (pr.nutritionDislike || []).filter(x => x !== rid).concat(rid);
  if (S.save('profile') === false && S.storageOKAtStart) return false;
  const nu = S.load('nutrition'), cur = nu.plan[date] && nu.plan[date][slot]; if (cur && cur.rid === rid && !C.slotEntry(date, slot)) { delete nu.plan[date][slot]; S.save('nutrition'); }
  return true;
}
/* preview → save. done(saved:boolean) is called after the write (Sofit uses it to report only a real save). */
function confirmSwap(date, slot, rid, done, o) {
  o = o || options(date, slot); const nr = L.recipe(rid); if (!nr) return done && done(false);
  const gm = root.Gate ? root.Gate.checkMeal(nr, null) : { ok: !C.conflicts(nr, null).length, issues: [] };
  if (!gm.ok) { root.UI.toast('המנה לא תואמת להגבלות התזונה שלך'); return done && done(false); }
  const nu = U(), m1 = L.recipeMacros(nr), base = o.base, empty = o.empty;
  const sc = !empty && !!C.plan(date).source && slot !== 'extra' && m1.k ? Math.max(0.6, Math.min(1.8, Math.round(base.k / m1.k * 20) / 20)) : 1, m2 = L.recipeMacros(nr, sc);
  const t = C.targets(), day0 = C.plannedTotals(date, 'selected'), cur = slot === 'extra' && !C.plan(date).extra.on ? { k: 0, p: 0, c: 0, f: 0 } : base;
  const day1 = { k: Math.round(day0.k - cur.k + m2.k), p: Math.round(day0.p - cur.p + m2.p) }, eaten = C.eatenTotals(date);
  const gapP = t ? t.protein - day1.p : 0, free = C.DAY.filter(k => k !== slot && !C.slotEntry(date, k) && C.plan(date)[k].rid && !C.plan(date)[k].off);
  root.UI.sheet('אישור החלפה', `<div class="stack" data-swap-confirm><p class="small">${empty ? '' : `<b>${esc(o.cur.he)}</b> ← `}<b>${esc(nr.he)}</b>${sc !== 1 ? ` <span class="pill">כמות ×${sc} כדי להתאים לגודל הארוחה</span>` : ''}${nr.est ? ' <span class="pill acc">ערכים משוערים</span>' : ''}</p>${nu.diffTable(base, m2)}
    <div class="kv small" data-day-impact>${t ? `<span>תכנון היום אחרי ההחלפה: <b>${day1.k}</b>/${t.kcal} קק״ל · <b>${day1.p}</b>/${t.protein} ג׳ חלבון</span>` : '<span>אין יעדים (חסרים גיל, גובה או משקל בפרופיל) — מוצג רק השינוי במנה.</span>'}<span>נאכל בפועל עד עכשיו: ${Math.round(eaten.k)} קק״ל · ${Math.round(eaten.p)} ג׳ חלבון</span></div>
    ${t && gapP >= 10 && free.length ? `<label class="switch" data-rebalance><span>להגדיל מנות חלבון בשאר הארוחות של היום כדי להשלים כ־${Math.round(gapP)} ג׳ (בגבולות המתכונים; אפשר לבטל ב"חזרה לארוחה המקורית")</span><input type="checkbox" id="sw-reb"></label>` : ''}
    <div class="small" data-why-meal><b>למה המנה הזו:</b> ${[gm.issues.some(x => x.kind === 'restriction') ? null : 'מתאימה להגבלות התזונה שלך', C.cuisineAllowed(nr, o.pf) ? ((o.pf.cuisines || []).length ? 'מהמטבח שבחרת' : null) : 'ממטבח אחר מזה שבחרת', m2.p >= base.p ? `חלבון ${Math.round(m2.p)} ג׳ (${Math.round(m2.p - base.p) >= 0 ? '+' : ''}${Math.round(m2.p - base.p)})` : `פחות חלבון (${Math.round(m2.p - base.p)} ג׳)`, ((nr.prep || 0) + (nr.cook || 0)) ? `~${(nr.prep || 0) + (nr.cook || 0)} דק׳ הכנה` : null].filter(Boolean).map(esc).join(' · ')} ${root.GateUI ? root.GateUI.tag('data') : ''} ${nr.est ? (root.GateUI ? root.GateUI.tag('est') : '') : ''}${gm.issues.filter(x => x.sev === 'warn').map(x => `<br><span class="warn tiny">${esc(x.text)}</span>`).join('')}</div>
    <p class="tiny faint">${C.slotEntry(date, slot) ? 'הרישום של מה שכבר נאכל לא ישתנה. ' : ''}היעדים והפרופיל לא משתנים.</p>
    <button class="btn primary" data-act="ok">אישור ההחלפה</button><button class="btn ghost" data-act="no">ביטול</button></div>`,
    { ok: (b2, e2, close2) => { const reb = document.getElementById('sw-reb'), doReb = !!(reb && reb.checked);
        const saved = C.setPlanSlot(date, slot, Object.assign({ rid: nr.id, ov: null, scale: sc, auto: false }, slot === 'extra' ? { on: true } : {}));
        close2(); if (saved === false) { root.UI.toast('השמירה נכשלה — ההחלפה לא נשמרה'); root.App.render(); return done && done(false); }
        let msg = 'הארוחה הוחלפה והסיכום עודכן';
        if (doReb) { const pl = C.plan(date), fr = free.filter(k => pl[k].rid), res = C.boostDay(Object.fromEntries(fr.map(k => [k, { rid: pl[k].rid, ov: pl[k].ov }])), t.protein - C.slotMacros(pl[slot]).p, C.normPrefs(C.profile().prefs), { kMin: 0, kMax: t.kcal + 100 - C.slotMacros(pl[slot]).k }); /* targets for the OTHER free meals; no carb top-up */
          const pNow = fr.reduce((a, k) => a + C.slotMacros(pl[k]).p, 0), pNew = fr.reduce((a, k) => a + C.slotMacros(Object.assign({}, pl[k], res.ov[k] ? { ov: res.ov[k] } : {})).p, 0);
          const ch = pNew > pNow + 0.5 ? Object.keys(res.ov) : []; /* applied only if it really adds protein (never shrinks other meals) */ ch.forEach(k => C.setPlanSlot(date, k, { rid: pl[k].rid, ov: res.ov[k], scale: pl[k].scale || 1, auto: false }));
          msg = ch.length ? `הארוחה הוחלפה, והוגדלו מנות ב־${ch.length} ארוחות נוספות` : 'הארוחה הוחלפה; לא היה מקום להגדיל מנות בשאר הארוחות'; }
        root.UI.toast(msg); root.App.render(); return done && done(true); },
      no: (b2, e2, close2) => { close2(); return done && done(false); } });
}
root.MealOpt = { options, sheet, confirmSwap, dislike, SORTS, defaultSort };
})(window);
