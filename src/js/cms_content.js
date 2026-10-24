/* Admin CMS · content loader (first load, small). Published recipes and exercise instructions come from Supabase table
   public.cms_content (readable by everyone, written only through the role-checked CMS functions). The app keeps working
   offline and without a backend: the last good copy is cached on the device and applied before the first render (main.js waits up to 1.5 s for this chunk when a cache exists, so the built-in content never flashes); a fresh copy
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
/* validation (shared with the admin editor). Returns problem CODES (empty = valid); the admin chunk turns them into Hebrew
   explanations, so the first-load copy stays small. 'ing_food:2' = ingredient #3, etc. */
function checkRecipe(id, d) {
  const e = [], F = N().FOODS;
  if (!ID.test(id || '')) e.push('id');
  if (!d || typeof d !== 'object') return e.concat('data');
  if (!str(d.he, 120)) e.push('he'); if (!str(d.en, 120)) e.push('en'); if (!MEALS.includes(d.meal)) e.push('meal'); if (!(CT() && CT().CUISINE_HE[d.cuisine])) e.push('cuisine');
  if (!Array.isArray(d.ing) || d.ing.length < 1 || d.ing.length > 20) e.push('ing_n');
  else { const seen = new Set(); d.ing.forEach((x, i) => { if (!x || !F[x.f]) e.push('ing_food:' + i); else if (!num(x.g, 1, 1000)) e.push('ing_g:' + i); if (x && seen.has(x.f)) e.push('ing_dup:' + i); if (x) seen.add(x.f); }); }
  if (!strs(d.steps, 15, 300, d.meal === 'extra' ? 1 : 2)) e.push('steps');
  if (Array.isArray(d.steps) && d.steps.some(t => /\d+\s*ג׳/.test(t || ''))) e.push('steps_grams');
  if (d.subs != null && !strs(d.subs, 10, 200)) e.push('subs'); if (d.equip != null && !strs(d.equip, 10, 40)) e.push('equip');
  if (!num(d.prep, 0, 600) || !num(d.cook, 0, 600)) e.push('time'); if (d.cost != null && ![1, 2, 3].includes(d.cost)) e.push('cost');
  if (d.tags != null && !strs(d.tags, 20, 30)) e.push('tags'); if (d.desc != null && d.desc !== '' && !str(d.desc, 300)) e.push('desc');
  return e;
}
function checkExercise(id, d) {
  const e = [];
  if (!(root.EX_BY_ID && root.EX_BY_ID[id])) e.push('ex_new');
  if (!d || typeof d !== 'object') return e.concat('data');
  if (!str(d.he, 120)) e.push('he'); if (!str(d.en, 120)) e.push('en'); if (!str(d.start, 600)) e.push('ex_start'); if (!strs(d.steps, 12, 300, 3)) e.push('ex_steps');
  if (!str(d.breath, 300)) e.push('ex_breath'); if (!strs(d.mistakes, 10, 200, 1)) e.push('ex_mistakes');
  ['muscles', 'dir', 'end'].forEach(k => { if (d[k] != null && d[k] !== '' && !str(d[k], 600)) e.push('ex_long'); }); if (d.bad != null && !strs(d.bad, 10, 300)) e.push('ex_bad');
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
/* ════════ Full app control: texts, screen layout, design tokens, app settings ════════
   All four are DATA, validated here (and again on the server); nothing is executed. Applied after every render:
   texts by exact match of a whole text node / label (app-owned strings only: never inside inputs, editable areas, [data-user]
   or the admin screens), layout by moving/hiding registered sections, design by CSS custom properties on <html>. */
const APPK = ['text', 'layout', 'theme', 'config'];
const APP = { text: {}, ntext: 0, layout: {}, config: null };
const fnv = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
const textId = orig => 't_' + fnv(orig) + '_' + orig.length; /* stable id for an app string */
const toks = s => (String(s).match(/\{[a-z0-9_]+\}|\$\{|%|\d+/gi) || []).sort().join('|'); /* interpolation tokens, % and numbers must survive an edit */
function checkText(id, d) {
  const e = []; if (!d || typeof d !== 'object') return ['data'];
  if (!str(d.orig, 300)) e.push('t_orig'); else if (id !== textId(d.orig)) e.push('t_id');
  ['he', 'en'].forEach(l => { if (d[l] == null || d[l] === '') return; if (!str(d[l], 600)) e.push('t_len'); else if (/[<>]/.test(d[l])) e.push('t_html'); else if (str(d.orig, 300) && toks(d[l]) !== toks(d.orig)) e.push('t_tok'); });
  if (!str(d.he, 600) && !str(d.en, 600)) e.push('t_empty');
  return e;
}
/* component registry: [id, selector, Hebrew name, can hide]. Anything not listed is code-defined and stays where it is. */
const REG = {
  home: { he: 'בית', secs: [['coach', '[data-coach]', 'כרטיס המאמן Sofit', 1], ['stats', '[data-plan-stats]', 'סיכום התוכנית', 1], ['now', '[data-now]', 'כרטיס "עכשיו" — הצעד הבא', 1],
    ['workout', '[data-sec=workout]', 'האימון של היום (תוכנית 30 הימים)', 1], ['suggest', '[data-sec=suggest]', 'התאמות מוצעות', 1], ['nutrition', '[data-sec=nutrition]', 'תזונה היום', 1],
    ['trackers', '[data-sec=trackers]', 'מעקב יומי: מים, צעדים, שינה, שקילה', 1], ['week', '[data-week-chart],[data-sec=week]', 'גרף השבוע', 1]],
    fixed: ['הודעות מערכת: אחסון חסום, אימון שלא הסתיים, סנכרון', 'מסך הפתיחה ובניית התוכנית', 'כרטיס התאמות האימון (מנוע ההתאמה)'] },
  nutrition: { he: 'תזונה', secs: [['summary', '[data-sec=summary]', 'סיכום היום', 1], ['flex', '[data-sec=flex]', 'ארוחה גמישה', 1], ['meals', '[data-day-meals]', 'הארוחות של היום', 0], ['extrafood', '[data-sec=extrafood]', 'מזון נוסף שנאכל', 1]],
    fixed: ['אזהרת חלבון/תפריט — בטיחות, תמיד מוצגת', 'בחירת תאריך ויעדים'] },
  nav: { he: 'סרגל הניווט התחתון', items: [['home', 'בית', 0], ['calendar', 'לוח', 1], ['workouts', 'אימונים', 1], ['nutrition', 'תזונה', 1], ['progress', 'מעקב', 1]] } };
const SPACE = ['normal', 'compact', 'roomy'], ALIGN = ['start', 'center'];
function checkLayout(id, d) {
  const R = REG[id]; if (!R) return ['l_screen']; if (!d || typeof d !== 'object') return ['data'];
  const ids = (R.secs || R.items).map(x => x[0]), e = [], hideOk = R.secs ? R.secs.filter(x => x[3]).map(x => x[0]) : R.items.filter(x => x[2]).map(x => x[0]);
  if (!Array.isArray(d.order) || d.order.some(x => !ids.includes(x)) || new Set(d.order).size !== d.order.length) e.push('l_order');
  if (d.hidden != null && (!Array.isArray(d.hidden) || d.hidden.some(x => !hideOk.includes(x)))) e.push('l_hide');
  if (d.space != null && (typeof d.space !== 'object' || Object.entries(d.space).some(([k, v]) => !ids.includes(k) || !SPACE.includes(v)))) e.push('l_space');
  if (d.align != null && (typeof d.align !== 'object' || Object.entries(d.align).some(([k, v]) => !ids.includes(k) || !ALIGN.includes(v)))) e.push('l_align');
  return e;
}
/* design tokens: [css variable, type, Hebrew name, default (as in styles.css), range] — the ONLY values the theme can set */
const FONTS = { heebo: "'Heebo', system-ui, -apple-system, 'Segoe UI', Arial, sans-serif", rubik: "'Rubik', 'Heebo', system-ui, -apple-system, 'Segoe UI', Arial, sans-serif", system: "system-ui, -apple-system, 'Segoe UI', Arial, sans-serif" };
const SHADOWS = { none: 'none', soft: '0 8px 24px rgb(0 0 0 / .4)', strong: '0 12px 32px rgb(0 0 0 / .6)' };
const TOKENS = [
  ['--bg', 'color', 'רקע האפליקציה', '#0F1115'], ['--surface', 'color', 'רקע כרטיסים וניווט', '#181B22'], ['--surface-2', 'color', 'רקע שדות וכפתורים משניים', '#1F232C'], ['--surface-3', 'color', 'מסילות, הודעות ומצב לחוץ', '#272C36'],
  ['--line', 'color', 'קווי הפרדה', '#2A2E39'], ['--line-strong', 'color', 'מסגרת מודגשת', '#3A3F4C'], ['--line-control', 'color', 'מסגרת שדה טופס', '#6B7180'],
  ['--text', 'color', 'טקסט ראשי', '#FFFFFF'], ['--muted', 'color', 'טקסט משני', '#9BA1A6'], ['--faint', 'color', 'טקסט חלש', '#8A9096'],
  ['--accent', 'color', 'צבע מותג / פעולה ראשית', '#CCFF00'], ['--accent-ink', 'color', 'טקסט על צבע המותג', '#0F1115'], ['--glacier', 'color', 'מים / חלבון', '#6cc3d5'],
  ['--good', 'color', 'הצלחה', '#5cc08a'], ['--warn', 'color', 'אזהרה', '#e8b04a'], ['--bad', 'color', 'שגיאה', '#F07A72'], ['--carb', 'color', 'פחמימות', '#c9a7ff'], ['--fat', 'color', 'שומן', '#e98a6b'], ['--media-bg', 'color', 'רקע איורים', '#12151B'],
  ['--font-body', 'font', 'גופן טקסט', 'heebo'], ['--font-display', 'font', 'גופן כותרות', 'rubik'], ['--fs', 'px', 'גודל טקסט בסיסי', '15px', [13, 20]], ['--fw-bold', 'weight', 'משקל טקסט מודגש', '600'],
  ['--r', 'px', 'עיגול פינות כרטיסים', '14px', [0, 28]], ['--r-sm', 'px', 'עיגול פינות כפתורים ושדות', '10px', [0, 20]], ['--r-lg', 'px', 'עיגול פינות גדול', '20px', [0, 32]],
  ['--sp-3', 'px', 'ריווח קטן', '12px', [6, 20]], ['--sp-4', 'px', 'ריווח בינוני (פנים כרטיס)', '16px', [8, 28]], ['--sp-5', 'px', 'ריווח גדול (בין כרטיסים)', '24px', [12, 40]],
  ['--tap', 'px', 'גובה כפתור (מינ׳ 44 לנגישות)', '46px', [44, 60]], ['--nav-h', 'px', 'גובה סרגל הניווט', '64px', [56, 80]], ['--shadow-1', 'shadow', 'צל כרטיסים', 'soft']];
const TOK = Object.fromEntries(TOKENS.map(t => [t[0], t]));
const RGB = { '--bg': '--bg-rgb', '--accent': '--accent-rgb', '--glacier': '--glacier-rgb', '--good': '--good-rgb', '--warn': '--warn-rgb', '--bad': '--bad-rgb' };
const hex = v => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
const lum = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(x => x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const PAIRS = [['--text', '--bg', 4.5], ['--text', '--surface', 4.5], ['--text', '--surface-2', 4.5], ['--muted', '--surface', 4.5], ['--faint', '--surface', 4.5], ['--accent-ink', '--accent', 4.5],
  ['--accent', '--surface', 3], ['--line-control', '--surface', 3], ['--bad', '--surface-3', 4.5], ['--good', '--surface', 3], ['--warn', '--surface', 3]];
function tokOk(t, v) { if (t[1] === 'color') return hex(v); if (t[1] === 'font') return !!FONTS[v]; if (t[1] === 'shadow') return !!SHADOWS[v]; if (t[1] === 'weight') return ['500', '600', '700', '800'].includes(String(v));
  const m = /^(\d{1,2})px$/.exec(v || ''); return !!m && +m[1] >= t[4][0] && +m[1] <= t[4][1]; }
const themeMerged = tokens => Object.fromEntries(TOKENS.map(t => [t[0], tokens && tokens[t[0]] != null ? tokens[t[0]] : t[3]]));
const contrastIssues = tokens => { const m = themeMerged(tokens); return PAIRS.filter(([a, b, min]) => hex(m[a]) && hex(m[b]) && contrast(m[a], m[b]) < min).map(([a, b, min]) => ({ a, b, min, v: Math.round(contrast(m[a], m[b]) * 10) / 10 })); };
function checkTheme(id, d) {
  if (!(id === 'active' || /^preset_[a-z0-9_]{1,40}$/.test(id))) return ['th_id']; if (!d || typeof d !== 'object') return ['data'];
  const e = []; if (!str(d.name, 40)) e.push('th_name'); if (!d.tokens || typeof d.tokens !== 'object' || Array.isArray(d.tokens)) return e.concat('th_tokens');
  Object.entries(d.tokens).forEach(([k, v]) => { if (!TOK[k]) e.push('th_unknown:' + k); else if (!tokOk(TOK[k], v)) e.push('th_value:' + k); });
  contrastIssues(d.tokens).forEach(x => e.push('th_contrast:' + x.a + '/' + x.b));
  return e;
}
/* app settings: modules that can be switched off (their entry links disappear, the screen says it is off), defaults, a notice */
const MODULES = { fridge: ['fridge'], shopping: ['shopping'], nearby: ['nearby'], travel: ['travel'], coach: ['coach'], programs: ['programs', 'program'], feedback: ['feedback'] };
const DEFAULTS = { meals: [2, 3], flex: [true, false] };
function checkConfig(id, d) {
  if (id !== 'app') return ['c_id']; if (!d || typeof d !== 'object') return ['data']; const e = [];
  if (d.off != null && (!Array.isArray(d.off) || d.off.some(x => !MODULES[x]))) e.push('c_off');
  if (d.defaults != null && (typeof d.defaults !== 'object' || Object.entries(d.defaults).some(([k, v]) => !DEFAULTS[k] || !DEFAULTS[k].includes(v)))) e.push('c_def');
  if (d.notice != null && d.notice !== '' && (typeof d.notice !== 'object' || !str(d.notice.text, 200) || /[<>]/.test(d.notice.text) || !['info', 'warn'].includes(d.notice.level))) e.push('c_notice');
  return e;
}
const CHECK = { text: checkText, layout: checkLayout, theme: checkTheme, config: checkConfig };
let themeSet = [];
function themeApply(tokens) {
  if (typeof document === 'undefined') return; const st = document.documentElement.style;
  themeSet.forEach(k => st.removeProperty(k)); themeSet = [];
  if (!tokens) return;
  Object.entries(tokens).forEach(([k, v]) => { const t = TOK[k]; if (!t || !tokOk(t, v)) return;
    const val = t[1] === 'font' ? FONTS[v] : t[1] === 'shadow' ? SHADOWS[v] : String(v); st.setProperty(k, val); themeSet.push(k);
    if (RGB[k]) { st.setProperty(RGB[k], [1, 3, 5].map(i => parseInt(v.slice(i, i + 2), 16)).join(' ')); themeSet.push(RGB[k]); } });
}
const isOff = route => !!(APP.config && (APP.config.off || []).some(m => MODULES[m].includes(route)));
const norm1 = s => s.replace(/\s+/g, ' ').trim();
const SKIP = 'textarea,input,select,script,style,[contenteditable],[data-user],[data-cms]';
function textApply(el) {
  if (!APP.ntext || !el || typeof document === 'undefined') return 0; const lang = (root.I18N && root.I18N.lang) || 'he'; let n = 0;
  const one = o => o && o[lang];
  if (el.nodeType === 3) { const p = el.parentElement; if (p && !p.closest(SKIP)) { const o = one(APP.text[norm1(el.data)]); if (o) { el.data = el.data.replace(/^(\s*)[\s\S]*?(\s*)$/, (m, a, b) => a + o + b); n++; } } return n; }
  if (el.nodeType !== 1 || el.closest(SKIP)) return 0;
  const w = document.createTreeWalker(el, 4, { acceptNode: x => (x.parentElement && x.parentElement.closest(SKIP) ? 2 : 1) });
  for (let x = w.nextNode(); x; x = w.nextNode()) { const o = one(APP.text[norm1(x.data)]); if (o) { x.data = x.data.replace(/^(\s*)[\s\S]*?(\s*)$/, (m, a, b) => a + o + b); n++; } }
  [el].concat([...el.querySelectorAll('[aria-label],[placeholder],[title]')]).forEach(x => { if (!x.getAttribute || x.closest('[data-user],[data-cms],[contenteditable]')) return; /* labels and placeholders only — never a value */
    ['aria-label', 'placeholder', 'title'].forEach(a => { const v = x.getAttribute(a); if (v) { const o = one(APP.text[norm1(v)]); if (o) { x.setAttribute(a, o); n++; } } }); });
  return n;
}
function layoutApply(view, screen) {
  const R = REG[screen], Lo = APP.layout[screen]; if (!R || !Lo || !view) return;
  const found = R.secs.map(([id, sel], i) => ({ id, i, el: view.querySelector(sel) })).filter(x => x.el && x.el.parentElement);
  const rank = x => { const k = (Lo.order || []).indexOf(x.id); return k < 0 ? 1000 + x.i : k; };
  const byParent = new Map(); found.forEach(x => { const p = x.el.parentElement; if (!byParent.has(p)) byParent.set(p, []); byParent.get(p).push(x); });
  byParent.forEach(list => { if (list.length < 2) return; list.sort((a, b) => (a.el.compareDocumentPosition(b.el) & 4) ? -1 : 1); /* marks in DOM order */ const marks = list.map(x => { const c = document.createComment('cms'); x.el.replaceWith(c); return c; });
    list.slice().sort((a, b) => rank(a) - rank(b)).forEach((x, k) => marks[k].replaceWith(x.el)); });
  found.forEach(x => { const hid = (Lo.hidden || []).includes(x.id) && R.secs.find(s => s[0] === x.id)[3]; x.el.hidden = !!hid; if (hid) x.el.dataset.cmsHidden = ''; else delete x.el.dataset.cmsHidden;
    const sp = Lo.space && Lo.space[x.id], al = Lo.align && Lo.align[x.id]; if (sp && sp !== 'normal') x.el.dataset.cmsSpace = sp; if (al && al !== 'start') x.el.dataset.cmsAlign = al; });
}
function navApply(nav) {
  const Lo = APP.layout.nav, inn = nav && nav.querySelector('.nav-in'); if (!Lo || !inn) return;
  const as = [...inn.querySelectorAll('a[data-nav]')], rank = a => { const k = (Lo.order || []).indexOf(a.dataset.nav); return k < 0 ? 1000 + as.indexOf(a) : k; };
  as.slice().sort((a, b) => rank(a) - rank(b)).forEach(a => inn.appendChild(a));
  as.forEach(a => { a.hidden = (Lo.hidden || []).includes(a.dataset.nav) && a.dataset.nav !== 'home'; });
}
/* called by App.render after the screen is in the DOM (main.js). Texts in sheets/toasts are handled by the observer below. */
function post(screen) {
  if (typeof document === 'undefined') return; const view = document.getElementById('view'), nav = document.getElementById('nav');
  layoutApply(view, screen); navApply(nav);
  const off = (APP.config && APP.config.off) || []; if (view && off.length) view.querySelectorAll('a[href^="#/"]').forEach(a => { const r = a.getAttribute('href').slice(2).split('/')[0]; if (off.some(m => MODULES[m].includes(r))) { a.hidden = true; a.dataset.cmsOff = ''; } });
  const nt = APP.config && APP.config.notice; if (view && nt && nt.text && screen === 'home' && !view.querySelector('[data-cms-notice]')) { const b = document.createElement('div'); b.className = 'banner ' + (nt.level === 'warn' ? 'warn' : 'info') + ' small'; b.dataset.cmsNotice = ''; b.setAttribute('role', 'status'); const t = document.createElement('div'); t.textContent = nt.text; b.appendChild(t); view.insertBefore(b, view.firstChild); }
  textApply(document.getElementById('top')); textApply(nav); textApply(view);
}
if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined') { /* sheets, toasts and anything inserted later */
  const start = () => new MutationObserver(ms => { if (!APP.ntext) return; ms.forEach(m => m.addedNodes.forEach(x => textApply(x))); }).observe(document.body, { childList: true, subtree: true });
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start); }
const BASE = { recipe: {}, exercise: {} }; /* built-in originals of items the CMS changed (to restore exactly if an override disappears) */
let applied = {}; /* "kind:id" → version currently applied */
/* admin preview: the CMS opens the app in an iframe with ?cmspreview=1; that copy shows the editor's unsaved rows on top of the
   published ones (read from the parent admin page, same origin). Nothing is stored or published from a preview. */
const PREVIEW = typeof window !== 'undefined' && typeof location !== 'undefined' && /[?&]cmspreview=1\b/.test(location.search) && window.parent !== window;
const previewRows = () => { try { return PREVIEW && window.parent.AdminCMS && window.parent.AdminCMS.previewRows ? window.parent.AdminCMS.previewRows() : null; } catch (e) { return null; } };
let lastRows = [];
function apply(rows) {
  if (!Array.isArray(rows)) return { applied: 0, rejected: 0 };
  lastRows = rows; const pv = previewRows();
  if (pv && pv.length) { const k = r => r.kind + ':' + r.item_id, m = new Map(rows.map(r => [k(r), r])); pv.forEach(r => m.set(k(r), r)); rows = [...m.values()]; }
  const NU = N(), seen = {}; let n = 0, bad = 0;
  const nx = { text: {}, layout: {}, theme: null, config: null }; /* app-control kinds: rebuilt from the full set on every apply */
  rows.forEach(row => {
    if (row && APPK.includes(row.kind)) { if (row.status !== 'published' || !ID.test(row.item_id || '') || !row.data) { if (row.status !== 'archived') bad++; return; }
      if (CHECK[row.kind](row.item_id, row.data).length) { bad++; return; }
      if (row.kind === 'text') nx.text[row.data.orig] = row.data; else if (row.kind === 'layout') nx.layout[row.item_id] = row.data;
      else if (row.kind === 'theme') { if (row.item_id === 'active') nx.theme = row.data; } else nx.config = row.data;
      seen[row.kind + ':' + row.item_id] = true; applied[row.kind + ':' + row.item_id] = row.version; n++; return; }
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
  Object.keys(applied).forEach(key => { if (seen[key]) return; const [kind, id] = key.split(':'); if (APPK.includes(kind)) { delete applied[key]; return; }
    if (kind === 'recipe') { const r = NU.RECIPES.find(x => x.id === id); if (r && BASE.recipe[id]) { Object.keys(r).forEach(k => delete r[k]); Object.assign(r, BASE.recipe[id]); } else if (r && r.cmsNew) r.archived = true; }
    else { const e = root.EX_BY_ID && root.EX_BY_ID[id]; if (e && BASE.exercise[id]) Object.assign(e, BASE.exercise[id]); delete e.cms; }
    delete applied[key]; });
  NU.CMS_V = Object.keys(applied).sort().map(k => k + '@' + applied[k]).join(',');
  APP.text = nx.text; APP.ntext = Object.keys(nx.text).length; APP.layout = nx.layout; APP.config = nx.config;
  root.FIT30_DEFAULTS = nx.config && nx.config.defaults ? pick(nx.config.defaults, Object.keys(DEFAULTS)) : null;
  themeApply(nx.theme && nx.theme.tokens);
  return { applied: n, rejected: bad };
}
const ls = { get() { try { return JSON.parse(localStorage.getItem(K) || 'null'); } catch (e) { return null; } }, set(v) { try { localStorage.setItem(K, JSON.stringify(v)); } catch (e) { } } };
const cached = ls.get(); if (cached && Array.isArray(cached.rows) && apply(cached.rows).applied && root.App && root.App.rendered) setTimeout(() => { try { root.App.render(); } catch (e) { } }, 0); /* boot waits for this chunk when a cache exists (no flash of built-in content) */
async function refresh() {
  const CFG = root.FIT30_BACKEND; if (!CFG) return { skipped: 'no backend' }; /* the publishable key only (same header as account.js) */
  let rows;
  try { const r = await fetch(CFG.url + '/rest/v1/cms_content?select=kind,item_id,status,data,version', { headers: { apikey: CFG.key }, cache: 'no-store', credentials: 'omit' });
    if (!r.ok) return { error: r.status }; rows = await r.json(); } catch (e) { return { error: 'network' }; }
  const sig = JSON.stringify(rows.map(x => [x.kind, x.item_id, x.version, x.status]).sort());
  const old = cached && cached.sig; const res = apply(rows); if (!PREVIEW) ls.set({ rows, sig, at: new Date().toISOString() });
  if (sig !== old && root.App && root.App.render) { try { root.App.render(); } catch (e) { } }
  return Object.assign({ changed: sig !== old }, res);
}
if (root.FIT30_BACKEND) setTimeout(() => { refresh(); }, 0);
if (PREVIEW) setTimeout(() => { if (!(cached && cached.rows)) apply([]); if (root.App && root.App.rendered) root.App.render(); }, 0);
const repreview = () => { apply(lastRows); if (root.App && root.App.render) root.App.render(); };
root.CMS = { apply, refresh, checkRecipe, checkExercise, derivedTags, RECIPE_FIELDS, EX_FIELDS, base: BASE, get applied() { return Object.assign({}, applied); },
  check: (kind, id, d) => kind === 'recipe' ? checkRecipe(id, d) : kind === 'exercise' ? checkExercise(id, d) : CHECK[kind] ? CHECK[kind](id, d) : ['kind'],
  textId, toks, REG, TOKENS, FONTS, SHADOWS, MODULES, DEFAULTS, contrast, contrastIssues, themeMerged, themeApply, isOff, post, textApply, repreview, preview: PREVIEW, app: APP };
})(typeof window !== 'undefined' ? window : globalThis);
