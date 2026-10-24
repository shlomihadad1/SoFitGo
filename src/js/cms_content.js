/* Admin CMS · content loader (first load, small). Published recipes and exercise instructions come from Supabase table
   public.cms_content (readable by everyone, written only through the role-checked CMS functions). The app keeps working
   offline and without a backend: the last good copy is cached on the device and applied before the first render; a fresh copy
   is fetched in the background and applied when it differs.
   Safety: every item is validated against the same rules as the admin editor (known foods, sensible grams, steps, meal type);
   an invalid item is ignored, never half-applied. Built-in content is the base: a published item overrides the built-in item
   with the same id or adds a new one; an archived item stays resolvable (history, logged meals) but is no longer offered.
   Logged meals keep their own stored values, so publishing never rewrites what a user already ate. */
(function (root) {
'use strict';
const K = 'fit30.cms', MEALS = ['m1', 'm2', 'snack', 'extra'], ID = /^[a-z0-9_]{2,64}$/;
const N = () => root.NUTRI, CT = () => root.CATALOG;
const str = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const strs = (a, maxN, maxL, min) => Array.isArray(a) && a.length >= (min || 0) && a.length <= maxN && a.every(s => str(s, maxL));
const num = (v, lo, hi) => typeof v === 'number' && isFinite(v) && v >= lo && v <= hi;
const RECIPE_FIELDS = ['he', 'en', 'meal', 'cuisine', 'ing', 'steps', 'subs', 'equip', 'prep', 'cook', 'cost', 'tags', 'desc', 'notes'];
const EX_FIELDS = ['he', 'en', 'muscles', 'start', 'steps', 'dir', 'end', 'mistakes', 'breath', 'bad'];
/* returns a list of problems in plain Hebrew (empty = valid). Shared with the admin editor. */
function checkRecipe(id, d) {
  const e = [], F = N().FOODS;
  if (!ID.test(id || '')) e.push('מזהה: אותיות לטיניות קטנות, ספרות וקו תחתון בלבד (2–64 תווים).');
  if (!d || typeof d !== 'object') return e.concat('אין נתונים.');
  if (!str(d.he, 120)) e.push('שם בעברית חסר (עד 120 תווים).');
  if (!str(d.en, 120)) e.push('שם באנגלית חסר (עד 120 תווים).');
  if (!MEALS.includes(d.meal)) e.push('סוג ארוחה לא תקין (בוקר / עיקרית / ביניים / תוספת).');
  if (!(CT() && CT().CUISINE_HE[d.cuisine])) e.push('מטבח לא מוכר.');
  if (!Array.isArray(d.ing) || d.ing.length < 1 || d.ing.length > 20) e.push('צריך 1–20 מרכיבים.');
  else { const seen = new Set(); d.ing.forEach((x, i) => { if (!x || !F[x.f]) e.push(`מרכיב ${i + 1}: מזון לא מוכר במאגר.`); else if (!num(x.g, 1, 1000)) e.push(`מרכיב ${i + 1} (${F[x.f].he}): כמות בגרמים בין 1 ל־1000.`); if (x && seen.has(x.f)) e.push(`מרכיב ${i + 1}: אותו מזון מופיע פעמיים — יש לאחד לשורה אחת.`); if (x) seen.add(x.f); }); }
  if (!strs(d.steps, 15, 300, d.meal === 'extra' ? 1 : 2)) e.push(d.meal === 'extra' ? 'צריך לפחות שלב הכנה אחד (עד 300 תווים לשלב).' : 'צריך 2–15 שלבי הכנה (עד 300 תווים לשלב).');
  if (Array.isArray(d.steps) && d.steps.some(s => /\d+\s*ג׳/.test(s || ''))) e.push('בשלבים לא כותבים גרמים — הכמויות מופיעות ברשימת המרכיבים (כך שינוי כמות לא יוצר סתירה).');
  if (d.subs != null && !strs(d.subs, 10, 200)) e.push('חלופות: עד 10 שורות, עד 200 תווים כל אחת.');
  if (d.equip != null && !strs(d.equip, 10, 40)) e.push('ציוד: עד 10 פריטים.');
  if (!num(d.prep, 0, 600) || !num(d.cook, 0, 600)) e.push('זמני הכנה ובישול בדקות (0–600).');
  if (d.cost != null && ![1, 2, 3].includes(d.cost)) e.push('עלות: 1 (זול), 2 או 3.');
  if (d.tags != null && !strs(d.tags, 20, 30)) e.push('תגיות לא תקינות.');
  if (d.desc != null && d.desc !== '' && !str(d.desc, 300)) e.push('תיאור עד 300 תווים.');
  return e;
}
function checkExercise(id, d) {
  const e = [];
  if (!(root.EX_BY_ID && root.EX_BY_ID[id])) e.push('אפשר לערוך רק תרגיל קיים (תרגיל חדש דורש איור תנועה בקוד).');
  if (!d || typeof d !== 'object') return e.concat('אין נתונים.');
  if (!str(d.he, 120)) e.push('שם בעברית חסר.'); if (!str(d.en, 120)) e.push('שם באנגלית חסר.');
  if (!str(d.start, 600)) e.push('תנוחת התחלה חסרה.'); if (!strs(d.steps, 12, 300, 3)) e.push('צריך 3–12 שלבי ביצוע.');
  if (!str(d.breath, 300)) e.push('הנחיית נשימה חסרה.'); if (!strs(d.mistakes, 10, 200, 1)) e.push('צריך לפחות טעות נפוצה אחת.');
  ['muscles', 'dir', 'end'].forEach(k => { if (d[k] != null && d[k] !== '' && !str(d[k], 600)) e.push(`שדה ${k} ארוך מדי.`); });
  if (d.bad != null && !strs(d.bad, 10, 300)) e.push('"מתי לעצור": רשימה של עד 10 שורות.');
  return e;
}
const pick = (o, keys) => { const r = {}; keys.forEach(k => { if (o[k] !== undefined) r[k] = o[k]; }); return r; };
const DIET = { chicken: ['chicken_breast', 'chicken_thigh', 'chicken_mince'], egg: ['egg', 'egg_white'], fish: ['salmon', 'white_fish', 'tuna_can', 'sardines'], meat: ['beef_lean', 'turkey'], dairy: ['curd', 'hung_curd', 'milk', 'paneer', 'ghee', 'greek_yogurt', 'cottage', 'feta', 'mozzarella'] };
function derivedTags(r) { /* diet tags always follow the ingredients (an editor cannot mislabel a dish) */
  const fs = r.ing.map(x => x.f), has = k => fs.some(f => DIET[k].includes(f)), keep = (r.tags || []).filter(t => !['chicken', 'egg', 'fish', 'meat', 'veg_base', 'vegan', 'veg'].includes(t));
  ['chicken', 'egg', 'fish', 'meat'].forEach(k => { if (has(k)) keep.push(k); });
  if (!has('chicken') && !has('fish') && !has('meat')) { keep.push('veg_base'); if (!has('egg') && !has('dairy')) keep.push('vegan'); }
  return keep;
}
const BASE = { recipe: {}, exercise: {} }; /* built-in originals of items the CMS changed (to restore exactly if an override disappears) */
let applied = {}; /* "kind:id" → version currently applied */
function apply(rows) {
  if (!Array.isArray(rows)) return { applied: 0, rejected: 0 };
  const NU = N(), seen = {}; let n = 0, bad = 0;
  rows.forEach(row => {
    if (!row || !['recipe', 'exercise'].includes(row.kind) || !ID.test(row.item_id || '') || !row.data) { bad++; return; }
    const key = row.kind + ':' + row.item_id; seen[key] = true;
    if (row.kind === 'recipe') {
      let r = NU.RECIPES.find(x => x.id === row.item_id);
      if (row.status === 'archived') { if (r) { r.archived = true; r.cms = row.version; n++; } return; }
      const probs = checkRecipe(row.item_id, row.data); if (probs.length) { bad++; return; }
      const d = pick(row.data, RECIPE_FIELDS); d.ing = d.ing.map(x => ({ f: x.f, g: +x.g, role: NU.FOODS[x.f].grp }));
      if (r && !BASE.recipe[r.id] && !r.cmsNew) BASE.recipe[r.id] = JSON.parse(JSON.stringify(r));
      if (!r) { r = { id: row.item_id, servings: 1, calc: 'ingredients', intl: true, v2: true, cmsNew: true, tags: [], subs: [], equip: [], notes: '', cost: 2 }; NU.RECIPES.push(r); }
      Object.assign(r, d, { archived: false, cms: row.version }); r.tags = derivedTags(r); if (!r.subs) r.subs = []; if (!r.equip) r.equip = []; if (r.desc == null) r.desc = '';
      if (root.Logic && root.Logic._resetRecipeIndex) root.Logic._resetRecipeIndex(); n++;
    } else {
      const e = root.EX_BY_ID && root.EX_BY_ID[row.item_id]; if (!e) { bad++; return; }
      if (row.status === 'archived') return; /* exercises are not archived through the CMS (plans reference them) */
      if (checkExercise(row.item_id, row.data).length) { bad++; return; }
      if (!BASE.exercise[e.id]) BASE.exercise[e.id] = JSON.parse(JSON.stringify(pick(e, EX_FIELDS)));
      Object.assign(e, pick(row.data, EX_FIELDS), { cms: row.version }); n++;
    }
    applied[key] = row.version;
  });
  /* an override that is no longer served goes back to the built-in original */
  Object.keys(applied).forEach(key => { if (seen[key]) return; const [kind, id] = key.split(':');
    if (kind === 'recipe') { const r = NU.RECIPES.find(x => x.id === id); if (r && BASE.recipe[id]) { Object.keys(r).forEach(k => delete r[k]); Object.assign(r, BASE.recipe[id]); } else if (r && r.cmsNew) r.archived = true; }
    else { const e = root.EX_BY_ID && root.EX_BY_ID[id]; if (e && BASE.exercise[id]) Object.assign(e, BASE.exercise[id]); delete e.cms; }
    delete applied[key]; });
  NU.CMS_V = Object.keys(applied).sort().map(k => k + '@' + applied[k]).join(',');
  return { applied: n, rejected: bad };
}
const ls = { get() { try { return JSON.parse(localStorage.getItem(K) || 'null'); } catch (e) { return null; } }, set(v) { try { localStorage.setItem(K, JSON.stringify(v)); } catch (e) { } } };
const cached = ls.get(); if (cached && Array.isArray(cached.rows)) apply(cached.rows); /* before the first render */
async function refresh() {
  const CFG = root.FIT30_BACKEND; if (!CFG) return { skipped: 'no backend' }; /* the publishable key only (same header as account.js) */
  let rows;
  try { const r = await fetch(CFG.url + '/rest/v1/cms_content?select=kind,item_id,status,data,version', { headers: { apikey: CFG.key }, cache: 'no-store', credentials: 'omit' });
    if (!r.ok) return { error: r.status }; rows = await r.json(); } catch (e) { return { error: 'network' }; }
  const sig = JSON.stringify(rows.map(x => [x.kind, x.item_id, x.version, x.status]).sort());
  const old = cached && cached.sig; const res = apply(rows); ls.set({ rows, sig, at: new Date().toISOString() });
  if (sig !== old && root.App && root.App.render) { try { root.App.render(); } catch (e) { } }
  return Object.assign({ changed: sig !== old }, res);
}
if (root.FIT30_BACKEND) setTimeout(() => { refresh(); }, 0);
root.CMS = { apply, refresh, checkRecipe, checkExercise, derivedTags, RECIPE_FIELDS, EX_FIELDS, base: BASE, get applied() { return Object.assign({}, applied); } };
})(typeof window !== 'undefined' ? window : globalThis);
