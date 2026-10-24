/* Admin CMS (on-demand chunk admin.js, route #/admin). Hebrew, RTL, mobile and desktop.
   Security is NOT decided here: every read and write goes to Supabase with the signed-in user's own token, and PostgreSQL
   row-level security + the role-checked functions (supabase/migrations/20261025000100_sofitgo_cms.sql) decide what is allowed.
   This screen only hides buttons the server would refuse anyway, and says why.
   Modules: dashboard · recipes · exercises · media (inventory; upload blocked until a Storage bucket exists) · roles · history ·
   guides · settings that still need code. Every change: draft → preview → "what changes?" → compare → explicit publish. */
(function (root) {
'use strict';
const { esc, icon } = root.UI; const N = () => root.NUTRI, L = root.Logic, C = root.Core, CT = () => root.CATALOG;
const Screens = root.Screens;
const ROLE_HE = { owner: 'בעלים', admin: 'מנהל/ת', editor: 'עורך/ת', reviewer: 'צופה (קריאה בלבד)' }, RANK = { owner: 4, admin: 3, editor: 2, reviewer: 1 };
const MEAL_HE = { m1: 'ארוחת בוקר', m2: 'ארוחה עיקרית (צהריים/ערב)', snack: 'ארוחת ביניים', extra: 'תוספת חלבון (רשות)' };
const GRP_HE = { protein: 'חלבון', legume: 'קטניות', dairy: 'מוצרי חלב', carb: 'פחמימות ודגנים', veg: 'ירקות', fruit: 'פירות', fat: 'שומנים ואגוזים', condiment: 'רטבים' };
const ST_HE = { builtin: 'מובנה (בקוד)', published: 'פורסם', draft: 'טיוטה', archived: 'בארכיון' };
const PER_PAGE = 20;
/* Hebrew explanations for the validation codes of cms_content.js */
const MSG = { id: 'מזהה: אותיות לטיניות קטנות, ספרות וקו תחתון בלבד (2–64 תווים).', data: 'אין נתונים.', he: 'שם בעברית חסר (עד 120 תווים).', en: 'שם באנגלית חסר (עד 120 תווים).',
  meal: 'סוג ארוחה לא תקין (בוקר / עיקרית / ביניים / תוספת).', cuisine: 'מטבח לא מוכר.', ing_n: 'צריך 1–20 מרכיבים.', ing_food: i => `מרכיב ${i + 1}: מזון לא מוכר במאגר.`,
  ing_g: i => `מרכיב ${i + 1}: כמות בגרמים בין 1 ל־1000.`, ing_dup: i => `מרכיב ${i + 1}: אותו מזון מופיע פעמיים — יש לאחד לשורה אחת.`,
  steps: 'צריך 2–15 שלבי הכנה (עד 300 תווים לשלב; בתוספת מספיק שלב אחד).', steps_grams: 'בשלבים לא כותבים גרמים — הכמויות מופיעות ברשימת המרכיבים (כך שינוי כמות לא יוצר סתירה).',
  subs: 'חלופות: עד 10 שורות, עד 200 תווים כל אחת.', equip: 'ציוד: עד 10 פריטים.', time: 'זמני הכנה ובישול בדקות (0–600).', cost: 'עלות: 1 (זול), 2 או 3.', tags: 'תגיות לא תקינות.', desc: 'תיאור עד 300 תווים.',
  ex_new: 'אפשר לערוך רק תרגיל קיים (תרגיל חדש דורש איור תנועה בקוד).', ex_start: 'תנוחת התחלה חסרה.', ex_steps: 'צריך 3–12 שלבי ביצוע.', ex_breath: 'הנחיית נשימה חסרה.', ex_mistakes: 'צריך לפחות טעות נפוצה אחת.', ex_long: 'אחד השדות ארוך מדי (עד 600 תווים).', ex_bad: '"מתי לעצור": רשימה של עד 10 שורות.' };
const EXT = { tabs: [], views: {}, open: {}, msg: {}, after: [], kindHe: { recipe: 'מתכון', exercise: 'תרגיל' } }; /* admin_app.js registers the app-control areas here */
const problems = (kind, id, d) => root.CMS.check(kind, id, d).map(c => { const [k, i] = c.split(':'), m = MSG[k] || EXT.msg[k]; return typeof m === 'function' ? m(isNaN(+i) ? i : +i) : m || c; });
const st = { tab: 'dash', role: null, loaded: false, loading: false, err: null, content: {}, drafts: {}, q: '', meal: '', cu: '', status: '', issuesOnly: false, sort: 'name', page: 0, edit: null, members: null };
const key = (k, id) => k + ':' + id;
const api = (p, o) => root.Account.api(p, o);
const rank = () => RANK[st.role] || 0;

/* ── data ── */
async function load() {
  st.loading = true; st.err = null;
  try {
    const A = root.Account.state(), me = A.signedIn ? { id: A.userId, email: A.email } : null; if (!me) { st.role = null; st.loaded = true; return; }
    const m = await api('/rest/v1/cms_members?select=role&user_id=eq.' + encodeURIComponent(me.id)); st.role = (m && m[0] && m[0].role) || null;
    if (st.role) { const [c, d] = await Promise.all([api('/rest/v1/cms_content?select=kind,item_id,status,data,version,updated_at'), api('/rest/v1/cms_drafts?select=kind,item_id,data,base_version,note,updated_at')]);
      st.content = {}; (c || []).forEach(x => { st.content[key(x.kind, x.item_id)] = x; }); st.drafts = {}; (d || []).forEach(x => { st.drafts[key(x.kind, x.item_id)] = x; }); }
    st.loaded = true;
  } catch (e) { st.err = errText(e); st.loaded = true; } finally { st.loading = false; }
}
const errText = e => { const m = String((e && (e.detail || e.message || e.code)) || e || '');
  if (/42501|admin role|permission|row-level/i.test(m)) return 'הפעולה דורשת הרשאה שאין לך. השרת סירב — שום דבר לא נשמר.';
  if (/older version/.test(m)) return 'מישהו פרסם גרסה חדשה מאז שהתחלת לערוך. טענו מחדש, בדקו את השינויים ונסו שוב.';
  if (/network|Failed to fetch/i.test(m)) return 'אין חיבור לשרת. העבודה שלך שמורה במכשיר — נסו שוב כשיש חיבור.';
  if (/no account with this e-mail/.test(m)) return 'אין חשבון עם הכתובת הזו. האדם צריך להירשם לאפליקציה קודם.';
  if (/own role/.test(m)) return 'אי אפשר לשנות את ההרשאה של עצמך.';
  return 'השרת החזיר שגיאה: ' + m.slice(0, 160); };

/* ── recipes: the list merges built-in recipes, published CMS items and drafts ── */
function recipeRows() {
  const out = [];
  N().RECIPES.filter(r => !r.est).forEach(r => { const c = st.content[key('recipe', r.id)], d = st.drafts[key('recipe', r.id)];
    out.push({ id: r.id, r, status: d ? 'draft' : c ? c.status : 'builtin', version: c ? c.version : 0, data: d ? d.data : toData(r) }); });
  Object.values(st.drafts).filter(d => d.kind === 'recipe' && !N().RECIPES.some(r => r.id === d.item_id)).forEach(d => out.push({ id: d.item_id, r: null, status: 'draft', version: 0, data: d.data, isNew: true }));
  return out;
}
const toData = r => ({ he: r.he, en: r.en, meal: r.meal, cuisine: r.cuisine || 'international', ing: r.ing.map(x => ({ f: x.f, g: x.g })), steps: (r.steps || []).slice(), subs: (r.subs || []).slice(), equip: (r.equip || []).slice(), prep: r.prep || 0, cook: r.cook || 0, cost: r.cost || 2, tags: (r.tags || []).filter(t => !['chicken', 'egg', 'fish', 'meat', 'veg_base', 'vegan', 'veg'].includes(t)), desc: r.descAuto ? '' : (r.desc || ''), notes: r.notes || '' });
const macros = d => { const F = N().FOODS; return L.roundM((d.ing || []).filter(x => F[x.f]).reduce((s, x) => { const f = F[x.f], k = (+x.g || 0) / 100; return { k: s.k + f.k * k, p: s.p + f.p * k, c: s.c + f.c * k, f: s.f + f.f * k, fb: s.fb + f.fb * k }; }, { k: 0, p: 0, c: 0, f: 0, fb: 0 })); };
/* realistic-serving warnings (same thresholds as tools/nutrition_v2_test.js) — warnings, not blockers */
const KC = { m1: [250, 650], m2: [350, 750], snack: [100, 350], extra: [40, 400] }, PMIN = { m1: 15, m2: 20, snack: 0, extra: 5 };
function warnRecipe(d) { const w = [], F = N().FOODS, m = macros(d);
  if (KC[d.meal] && (m.k < KC[d.meal][0] || m.k > KC[d.meal][1])) w.push(`קלוריות למנה ${m.k} — מחוץ לטווח הרגיל ל${MEAL_HE[d.meal] || 'ארוחה'} (${KC[d.meal][0]}–${KC[d.meal][1]}). המנוע ישנה כמות רק בטווח מוגבל, ולכן מנה חריגה תיצור פערים.`);
  if (PMIN[d.meal] && m.p < PMIN[d.meal]) w.push(`חלבון ${m.p} ג׳ — פחות מ־${PMIN[d.meal]} ג׳ שנדרשים לארוחה מסוג זה כדי שהתפריט יגיע ליעד החלבון.`);
  (d.ing || []).forEach(x => { const f = F[x.f]; if (!f) return; const max = ['chicken_breast', 'chicken_thigh', 'chicken_mince', 'turkey', 'beef_lean'].includes(x.f) ? 160 : ['salmon', 'white_fish'].includes(x.f) ? 180 : f.grp === 'fat' ? (['oil', 'olive_oil'].includes(x.f) ? 12 : 60) : f.grp === 'carb' && f.st === 'dry' ? 90 : 300;
    if (x.g > max) w.push(`${f.he}: ${x.g} ג׳ — יותר ממנה רגילה (עד ${max} ג׳).`); });
  const at = 4 * m.p + 4 * m.c + 9 * m.f; if (m.k && Math.abs(m.k - at) > m.k * 0.12) w.push('קלוריות לא תואמות לחלבון/פחמימות/שומן (בדיקת 4/4/9) — כנראה רכיב עם ערכים חריגים.');
  return w; }
function issuesOf(row) { return problems('recipe', row.id, row.data).length + warnRecipe(row.data).length; }

/* "What changes?" — computed from the real engine, never guessed */
function impact(kind, id, before, after) {
  const out = [];
  if (kind === 'recipe') {
    const menuDays = N().MENU.reduce((n, d) => n + (d.includes(id) ? 1 : 0), 0);
    if (menuDays) out.push(`המנה מופיעה ב־${menuDays} ימים בתפריט הקבוע של 30 יום (משמש רק להיסטוריה ולמצב "תפריט קבוע").`);
    const mb = before ? macros(before) : null, ma = macros(after);
    if (mb) { const dk = ma.k - mb.k, dp = Math.round((ma.p - mb.p) * 10) / 10; if (dk || dp) out.push(`למנה אחת: ${dk > 0 ? '+' : ''}${dk} קק״ל, ${dp > 0 ? '+' : ''}${dp} ג׳ חלבון. סיכומי היום מחושבים מהרכיבים, ולכן יתעדכנו בכל תפריט שבו המנה תופיע.`); }
    const cu = CT().CUISINE_HE[after.cuisine], def = (C.CUISINE_GROUPS.israeli.codes.concat(C.CUISINE_GROUPS.mediterranean.codes, C.CUISINE_GROUPS.western.codes)).includes(after.cuisine);
    out.push(def ? `מטבח ${cu}: המנה זמינה גם למשתמשים בלי בחירת מטבח (ברירת המחדל).` : `מטבח ${cu}: המנה תוצע רק למי שבחר מטבח זה או "מגוון בינלאומי".`);
    const sim = simulate(id, after); out.push(`בהדמיה של 4 פרופילים × 14 ימים: המנה נבחרת ${sim.after} פעמים${before ? ` (לפני השינוי: ${sim.before})` : ''}.${sim.oversize ? ` ${sim.oversize} מהבחירות הגדילו את המנה מעבר לפי 1.35.` : ''}`);
    out.push('מה לא משתנה: ארוחות שכבר נרשמו כ"נאכל" שומרות את הערכים שנרשמו; ימים שעברו לא נבנים מחדש; משתמשים יקבלו את השינוי בפתיחה הבאה של האפליקציה (עם חיבור).');
    if (before && before.meal !== after.meal) out.push('שינוי סוג ארוחה: המנה תעבור למשבצת אחרת בתפריטים הבאים. מומלץ לבדוק את ההדמיה.');
  } else {
    out.push('הטקסט יוצג בדף התרגיל, במסך "איך מבצעים" בזמן אימון ובהסברים של המאמן. תוכניות האימון, הסטים והזמנים לא משתנים.');
    const used = (root.WORKOUTS || []).filter(w => JSON.stringify(w).includes('"' + id + '"')).length; if (used) out.push(`התרגיל מופיע ב־${used} אימונים מובנים.`);
  }
  return out;
}
function simulate(id, data) { /* temporarily swap the recipe in, generate, restore — nothing is saved */
  const R = N().RECIPES, i = R.findIndex(r => r.id === id), orig = i >= 0 ? R[i] : null, F = N().FOODS;
  const cand = Object.assign({}, orig || { id, servings: 1, calc: 'ingredients', intl: true, v2: true, tags: [], subs: [], equip: [] }, data, { ing: data.ing.filter(x => F[x.f]).map(x => ({ f: x.f, g: +x.g, role: F[x.f].grp })) }, { archived: false });
  cand.tags = root.CMS.derivedTags(cand);
  const P = [{ sex: 'm', weight: 80, height: 176, age: 34 }, { sex: 'f', weight: 60, height: 163, age: 30 }, { sex: 'f', weight: 75, height: 165, age: 45 }, { sex: 'm', weight: 100, height: 182, age: 40 }];
  const run = () => { let n = 0, big = 0; P.forEach(pf => { const t = L.computeTargets(Object.assign({ deficit: 0 }, pf)); const prm = { kcal: t.kcal, protein: t.protein, prefs: C.normPrefs({}), meals: 3, maxPrep: null, dislike: [] };
    root.MealPlan.generate(prm, root.Store.today(), 14, 'cms-sim').days.forEach(d => Object.entries(d.slots).forEach(([k, s]) => { if (k === 'extra' || !s || s.rid !== id) return; n++; const r = L.recipe(id); if (L.recipeMacros(r, 1, s.ov).k > L.recipeMacros(r).k * 1.36) big++; })); }); return { n, big }; };
  const swap = r => { if (i >= 0) R[i] = r; else if (r) R.push(r); else R.pop(); L._resetRecipeIndex(); };
  let before = 0; if (orig) before = run().n;
  swap(cand); let res; try { res = run(); } finally { if (orig) swap(orig); else swap(null); }
  return { before, after: res.n, oversize: res.big };
}

/* ── screens ── */
const btn = (act, label, attrs, cls) => `<button class="btn sm ${cls || ''}" data-act="${act}" ${attrs || ''}>${label}</button>`;
const help = k => `<button class="icon-btn" data-act="help" data-k="${k}" aria-label="מה זה משנה?" title="מה זה משנה?">${icon('info')}</button>`;
const HELP = {
  meal: 'סוג הארוחה קובע לאיזו משבצת המנה נכנסת: בוקר, צהריים/ערב (עיקרית) או ביניים. המנוע לא ישים מנת ביניים כארוחה עיקרית.',
  cuisine: 'המטבח קובע למי המנה תוצע: ישראלי, ים־תיכוני ומערבי הם ברירת המחדל; הודי, אסייתי ושאר המטבחים מוצעים רק למי שבחר בהם.',
  ing: 'הערכים התזונתיים מחושבים מהגרמים של כל מרכיב לפי מאגר המזונות (ערכי USDA), ולא מוקלדים ידנית. שינוי כמות משנה את הקלוריות של המנה ואת סיכום היום בכל תפריט שבו היא מופיעה. "נא/יבש/מוכן" אומר באיזה מצב שוקלים את המזון.',
  steps: 'כל שורה היא שלב ממוספר. לא כותבים גרמים בשלבים — הכמויות ברשימת המרכיבים, כדי ששינוי כמות לא ייצור סתירה.',
  prep: 'זמני ההכנה משמשים לסינון "מהיר להכנה" ולהעדפת זמן ההכנה של המשתמש.',
  tags: 'תגיות כמו quick / cheap / mealprep עוזרות לסינון. תגיות התזונה (טבעוני, צמחוני, עוף, דגים, ביצים) נקבעות אוטומטית מהמרכיבים ולא ניתן לסמן אותן ידנית — כך מנה לא תסומן בטעות כטבעונית.',
  publish: 'פרסום שולח את הגרסה לכל המשתמשים. הם יקבלו אותה בפתיחה הבאה עם חיבור. כל פרסום נשמר בהיסטוריה ואפשר לחזור לגרסה קודמת.',
  archive: 'ארכוב מפסיק להציע את המנה בתפריטים חדשים ובחיפוש. היא לא נמחקת: ארוחות שכבר נרשמו ותפריטים ישנים ממשיכים להציג אותה. אפשר לשחזר.' };

function guard() {
  if (!root.Account || !root.Account.available) return `<div class="banner warn" data-cms-blocked>${icon('info')}<div><b>ממשק הניהול לא זמין בגרסה הזו.</b> אין חיבור לשרת (Supabase) מוגדר. כדי להפעיל: הגדרת sofitgo-config.js והחלת ה־migration של מערכת הניהול (docs/CMS.md).</div></div>`;
  if (!root.Account.state().signedIn) return `<div class="banner info" data-cms-login>${icon('info')}<div>כדי לנהל תוכן צריך להתחבר לחשבון שיש לו הרשאת ניהול.</div></div><a class="btn primary" href="#/account/login">התחברות</a>`;
  if (!st.loaded) { if (!st.loading) load().then(() => root.App.render()); return '<section class="card"><p class="small muted" data-cms-loading>טוען…</p></section>'; }
  if (st.err && !st.role) return `<div class="banner bad">${icon('info')}<div>${esc(st.err)}</div></div>${btn('reload', 'נסו שוב')}`;
  if (!st.role) return `<div class="banner warn" data-cms-denied>${icon('lock')}<div><b>אין לך הרשאת ניהול.</b> ההרשאה נבדקת בשרת. בעל/ת האפליקציה יכול/ה להוסיף אותך במסך "הרשאות". אי אפשר לבקש או להעניק הרשאה לעצמך.</div></div>`;
  return '';
}
const TABS = [['dash', 'סקירה'], ['recipes', 'מתכונים ותפריטים'], ['exercises', 'תרגילים'], ['media', 'מדיה'], ['roles', 'הרשאות'], ['guide', 'מדריך ניהול'], ['advanced', 'הגדרות שדורשות קוד']];
const tabs = () => { const t = TABS.slice(); EXT.tabs.forEach(([k, v, after]) => { const i = t.findIndex(x => x[0] === after); t.splice(i < 0 ? t.length : i + 1, 0, [k, v]); }); return t; };
function shell(inner) { return `<nav class="chips" data-cms-tabs aria-label="אזורי ניהול">${tabs().map(([k, v]) => `<button class="chip" data-act="tab" data-t="${k}" aria-pressed="${st.tab === k}">${v}</button>`).join('')}</nav>
  <p class="tiny faint" data-cms-role>מחובר/ת כ־${esc(ROLE_HE[st.role])}. ${rank() >= 3 ? 'אפשר לערוך ולפרסם.' : rank() === 2 ? 'אפשר לערוך ולשמור טיוטות; פרסום דורש מנהל/ת.' : 'קריאה בלבד.'}</p>${st.err ? `<div class="banner bad small" data-cms-error>${icon('info')}<div>${esc(st.err)}</div></div>` : ''}${inner}`; }

function dash() {
  const rows = recipeRows(), pub = Object.values(st.content), drafts = Object.values(st.drafts), iss = rows.filter(r => issuesOf(r)).length;
  return `<section class="card stack"><h3>מצב התוכן</h3><div class="kv" data-cms-counts><span>מתכונים: <b>${rows.length}</b></span><span>פורסמו דרך הניהול: <b>${pub.filter(x => x.status === 'published').length}</b></span><span>טיוטות: <b>${drafts.length}</b></span><span>בארכיון: <b>${pub.filter(x => x.status === 'archived').length}</b></span><span>מתכונים עם בעיות: <b>${iss}</b></span></div>
    <p class="small muted">התוכן המובנה (200 המתכונים החדשים ו־144 הישנים, 57 התרגילים) מגיע מהקוד. כל מה שמפורסם כאן גובר עליו ומגיע למשתמשים בלי בנייה מחדש.</p>
    <div class="btns">${btn('tab', 'למתכונים', 'data-t="recipes"', 'primary')}${btn('tab', 'מדריך: סיור ראשוני', 'data-t="guide"')}</div></section>
    ${drafts.length ? `<section class="card"><h3>טיוטות שמחכות</h3><div class="list">${drafts.map(d => `<button class="li li-btn" data-act="open" data-k="${d.kind}" data-id="${esc(d.item_id)}"><div class="grow"><div class="t">${esc(d.data.he || d.data.name || d.data.orig || d.item_id)}</div><div class="s">${EXT.kindHe[d.kind] || d.kind} · עודכן ${esc(String(d.updated_at).slice(0, 16).replace('T', ' '))}${d.note ? ' · ' + esc(d.note) : ''}</div></div></button>`).join('')}</div></section>` : ''}`;
}
function recipesList() {
  let rows = recipeRows(); const q = st.q.trim().toLowerCase(), F = N().FOODS;
  if (q) rows = rows.filter(r => [r.id, r.data.he, r.data.en].concat(r.data.ing.map(x => F[x.f] ? F[x.f].he : '')).join(' ').toLowerCase().includes(q));
  if (st.meal) rows = rows.filter(r => r.data.meal === st.meal); if (st.cu) rows = rows.filter(r => r.data.cuisine === st.cu); if (st.status) rows = rows.filter(r => r.status === st.status); if (st.issuesOnly) rows = rows.filter(r => issuesOf(r));
  const S = { name: (a, b) => a.data.he.localeCompare(b.data.he, 'he'), kcal: (a, b) => macros(b.data).k - macros(a.data).k, protein: (a, b) => macros(b.data).p - macros(a.data).p, status: (a, b) => a.status.localeCompare(b.status) }[st.sort] || ((a, b) => 0);
  rows.sort(S); const pages = Math.max(1, Math.ceil(rows.length / PER_PAGE)); st.page = Math.min(st.page, pages - 1); const pg = rows.slice(st.page * PER_PAGE, (st.page + 1) * PER_PAGE);
  const cus = [...new Set(N().RECIPES.map(r => r.cuisine).filter(Boolean))];
  return `<section class="card stack" data-cms-recipes><div class="row between"><h3>מתכונים</h3>${rank() >= 2 ? btn('newRecipe', icon('plus') + ' מתכון חדש', '', 'primary') : ''}</div>
    <label class="field">חיפוש (שם, מזהה או מרכיב)<input id="cms-q" type="search" value="${esc(st.q)}" placeholder="למשל: עדשים"></label>
    <div class="row wrap">
      <label class="field">סוג ארוחה<select id="cms-meal"><option value="">הכול</option>${Object.entries(MEAL_HE).map(([k, v]) => `<option value="${k}" ${st.meal === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label class="field">מטבח<select id="cms-cu"><option value="">הכול</option>${cus.map(c => `<option value="${c}" ${st.cu === c ? 'selected' : ''}>${esc(CT().CUISINE_HE[c] || c)}</option>`).join('')}</select></label>
      <label class="field">מצב<select id="cms-st"><option value="">הכול</option>${Object.entries(ST_HE).map(([k, v]) => `<option value="${k}" ${st.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label class="field">מיון<select id="cms-sort">${[['name', 'שם'], ['kcal', 'קלוריות'], ['protein', 'חלבון'], ['status', 'מצב']].map(([k, v]) => `<option value="${k}" ${st.sort === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label class="switch"><span>רק עם בעיות</span><input type="checkbox" id="cms-iss" ${st.issuesOnly ? 'checked' : ''}></label></div>
    <p class="tiny muted" data-cms-total>${rows.length} תוצאות · עמוד ${st.page + 1} מתוך ${pages}</p>
    <div class="list" data-cms-list>${pg.map(r => { const m = macros(r.data), n = issuesOf(r); return `<button class="li li-btn" data-act="open" data-k="recipe" data-id="${esc(r.id)}"><div class="grow"><div class="t">${esc(r.data.he)}</div><div class="s">${esc(MEAL_HE[r.data.meal] || r.data.meal)} · ${esc(CT().CUISINE_HE[r.data.cuisine] || '')} · ${m.k} קק״ל · ${m.p} ג׳ חלבון</div></div><span class="pill ${r.status === 'draft' ? 'acc' : r.status === 'archived' ? 'warn' : ''}" data-st="${r.status}">${ST_HE[r.status]}${r.version ? ' v' + r.version : ''}</span>${n ? `<span class="pill warn" data-iss>${n} בעיות</span>` : ''}</button>`; }).join('') || '<p class="small muted">אין תוצאות.</p>'}</div>
    <div class="btns">${btn('page', 'הקודם', `data-d="-1" ${st.page ? '' : 'disabled'}`)}${btn('page', 'הבא', `data-d="1" ${st.page < pages - 1 ? '' : 'disabled'}`)}</div></section>`;
}
function foodSelect(sel, i) { const F = N().FOODS, by = {}; Object.entries(F).forEach(([k, f]) => { (by[f.grp] = by[f.grp] || []).push([k, f]); });
  return `<select data-ing-f="${i}" aria-label="מרכיב ${i + 1}">${Object.entries(by).map(([g, list]) => `<optgroup label="${esc(GRP_HE[g] || g)}">${list.sort((a, b) => a[1].he.localeCompare(b[1].he, 'he')).map(([k, f]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${esc(f.he)} · ${f.st === 'raw' ? 'נא' : f.st === 'dry' ? 'יבש' : 'מוכן'}</option>`).join('')}</optgroup>`).join('')}</select>`; }
function preview(kind, d) {
  if (kind === 'exercise') return `<section class="card stack" data-cms-preview><span class="eyebrow">תצוגה מקדימה — כך זה ייראה בדף התרגיל</span><h3>${esc(d.he)}</h3><p class="small"><b>תנוחת התחלה:</b> ${esc(d.start || '')}</p><ol class="steps">${(d.steps || []).map(s => `<li>${esc(s)}</li>`).join('')}</ol><p class="small"><b>נשימה:</b> ${esc(d.breath || '')}</p><ul class="bul small">${(d.mistakes || []).map(s => `<li>${esc(s)}</li>`).join('')}</ul></section>`;
  const m = macros(d), F = N().FOODS, al = CT().recipeFacts({ id: 'x', ing: d.ing.filter(x => F[x.f]), meal: d.meal, cuisine: d.cuisine, tags: [] }).allergens;
  return `<section class="card stack" data-cms-preview><span class="eyebrow">תצוגה מקדימה — כך המנה תופיע בתפריט</span><div class="slot stack tight"><span class="eyebrow">${esc(MEAL_HE[d.meal] || '')}</span><h3>${esc(d.he)}</h3><span class="tiny faint ltr">${esc(d.en)}</span>
    <div class="kv"><span>${m.k} קק״ל</span><span>חלבון <b>${m.p}</b></span><span>פחמ׳ <b>${m.c}</b></span><span>שומן <b>${m.f}</b></span><span>סיבים <b>${m.fb}</b></span><span>⏱ ${(+d.prep || 0) + (+d.cook || 0)} דק׳</span></div>
    <div>${d.ing.filter(x => F[x.f]).map(x => `<div class="row between small"><span>${esc(F[x.f].he)}</span><span class="num">${x.g} ${['milk', 'soy_milk'].includes(x.f) ? 'מ״ל' : 'ג׳'}</span></div>`).join('')}</div>
    <ol class="steps">${(d.steps || []).map(s => `<li>${esc(s)}</li>`).join('')}</ol>
    <p class="tiny muted">אלרגנים (מחושב מהמרכיבים): ${al.length ? al.map(a => esc(CT().ALLERGEN_HE[a] || a)).join(', ') : 'אין מהרשימה המוכרת'} · תגיות תזונה: ${esc(root.CMS.derivedTags({ ing: d.ing.filter(x => F[x.f]), tags: [] }).join(', '))}</p></div></section>`;
}
function editor() {
  const e = st.edit, d = e.data, canEdit = rank() >= 2, isR = e.kind === 'recipe', errs = problems(e.kind, e.id, d), warns = isR ? warnRecipe(d) : [];
  const dis = canEdit ? '' : 'disabled', c = st.content[key(e.kind, e.id)];
  const fieldsR = !isR ? '' : `<fieldset class="stack" data-fs="details"><legend>פרטים <span class="tiny faint">(שדות עם * חובה)</span></legend>
      ${e.isNew ? `<label class="field">מזהה * <span class="tiny faint">(לטינית קטנה, ספרות וקו תחתון; לא ניתן לשנות אחרי פרסום)</span><input id="ed-id" value="${esc(e.id)}" ${dis}></label>` : `<p class="tiny faint">מזהה: <span class="ltr">${esc(e.id)}</span></p>`}
      <label class="field">שם בעברית *<input id="ed-he" value="${esc(d.he || '')}" ${dis}></label><label class="field">שם באנגלית *<input id="ed-en" class="ltr" value="${esc(d.en || '')}" ${dis}></label>
      <div class="row wrap"><label class="field">סוג ארוחה * ${help('meal')}<select id="ed-meal" ${dis}>${Object.entries(MEAL_HE).map(([k, v]) => `<option value="${k}" ${d.meal === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label class="field">מטבח * ${help('cuisine')}<select id="ed-cu" ${dis}>${Object.entries(CT().CUISINE_HE).map(([k, v]) => `<option value="${k}" ${d.cuisine === k ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label></div>
      <div class="row wrap"><label class="field">זמן הכנה (דק׳) * ${help('prep')}<input id="ed-prep" type="number" min="0" max="600" value="${+d.prep || 0}" ${dis}></label><label class="field">זמן בישול (דק׳) *<input id="ed-cook" type="number" min="0" max="600" value="${+d.cook || 0}" ${dis}></label>
      <label class="field">עלות יחסית<select id="ed-cost" ${dis}>${[[1, 'זול'], [2, 'בינוני'], [3, 'יקר']].map(([k, v]) => `<option value="${k}" ${+d.cost === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label></div>
      <label class="field">תיאור קצר<input id="ed-desc" value="${esc(d.desc || '')}" ${dis}></label></fieldset>
    <fieldset class="stack" data-fs="ing"><legend>מרכיבים וכמויות * ${help('ing')}</legend>${d.ing.map((x, i) => `<div class="row" data-ing-row="${i}">${foodSelect(x.f, i)}<input type="number" min="1" max="1000" data-ing-g="${i}" value="${+x.g || ''}" aria-label="גרמים" style="width:90px" ${dis}><span class="tiny faint">ג׳</span>${canEdit ? `<button class="icon-btn" data-act="ingDel" data-i="${i}" aria-label="הסרת מרכיב">${icon('trash')}</button>` : ''}</div>`).join('')}
      ${canEdit ? btn('ingAdd', icon('plus') + ' הוספת מרכיב') : ''}</fieldset>
    <fieldset class="stack" data-fs="steps"><legend>שלבי הכנה * ${help('steps')}</legend><label class="field">שלב בכל שורה<textarea id="ed-steps" rows="6" ${dis}>${esc((d.steps || []).join('\n'))}</textarea></label>
      <label class="field">חלופות למרכיבים (שורה לכל חלופה)<textarea id="ed-subs" rows="3" ${dis}>${esc((d.subs || []).join('\n'))}</textarea></label>
      <label class="field">ציוד (מופרד בפסיקים)<input id="ed-equip" value="${esc((d.equip || []).join(', '))}" ${dis}></label></fieldset>
    <fieldset class="stack" data-fs="tags"><legend>תגיות ${help('tags')}</legend><label class="field">תגיות סינון (מופרדות ברווח: quick cheap mealprep high_protein)<input id="ed-tags" class="ltr" value="${esc((d.tags || []).join(' '))}" ${dis}></label></fieldset>`;
  const fieldsE = isR ? '' : `<fieldset class="stack"><legend>הוראות ביצוע <span class="tiny faint">(* חובה)</span></legend><label class="field">שם בעברית *<input id="ex-he" value="${esc(d.he || '')}" ${dis}></label><label class="field">שם באנגלית *<input id="ex-en" class="ltr" value="${esc(d.en || '')}" ${dis}></label>
    <label class="field">שרירים<input id="ex-muscles" value="${esc(d.muscles || '')}" ${dis}></label><label class="field">תנוחת התחלה *<textarea id="ex-start" rows="2" ${dis}>${esc(d.start || '')}</textarea></label>
    <label class="field">שלבי ביצוע * (שורה לכל שלב)<textarea id="ex-steps" rows="6" ${dis}>${esc((d.steps || []).join('\n'))}</textarea></label><label class="field">כיוון התנועה<input id="ex-dir" value="${esc(d.dir || '')}" ${dis}></label>
    <label class="field">תנוחת סיום<input id="ex-end" value="${esc(d.end || '')}" ${dis}></label><label class="field">נשימה *<input id="ex-breath" value="${esc(d.breath || '')}" ${dis}></label>
    <label class="field">טעויות נפוצות * (שורה לכל טעות)<textarea id="ex-mistakes" rows="4" ${dis}>${esc((d.mistakes || []).join('\n'))}</textarea></label><label class="field">מתי לעצור / לא מתאים (שורה לכל סימן)<textarea id="ex-bad" rows="3" ${dis}>${esc((d.bad || []).join('\n'))}</textarea></label></fieldset>`;
  return `<section class="card stack" data-cms-editor="${e.kind}"><div class="row between"><h3>${e.isNew ? 'מתכון חדש' : esc(d.he || e.id)}</h3>${btn('closeEd', 'חזרה לרשימה', '', 'ghost')}</div>
    <p class="tiny muted">${c ? `גרסה מפורסמת ${c.version} (${c.status === 'archived' ? 'בארכיון' : 'פעילה'})` : e.kind === 'recipe' && !e.isNew ? 'תוכן מובנה מהקוד — עדיין לא נערך כאן' : 'לא פורסם'}${st.drafts[key(e.kind, e.id)] ? ' · יש טיוטה שמורה' : ''}. השינויים נשמרים במכשיר תוך כדי עבודה ולא יאבדו.</p>
    ${isR ? fieldsR : fieldsE}
    <div data-cms-live>${live(e)}</div>
        <div class="btns">${canEdit ? btn('saveDraft', 'שמירת טיוטה', '', 'primary') : ''}${rank() >= 3 ? btn('review', 'בדיקה ופרסום…', errs.length ? 'disabled' : '') : ''}${btn('impact', 'מה זה משנה?')}${isR && canEdit && !e.isNew ? btn('dup', 'שכפול') : ''}${canEdit ? btn('discard', 'ביטול השינויים', '', 'ghost') : ''}</div>
    <div class="btns">${!e.isNew ? btn('history', 'היסטוריה וגרסאות') : ''}${isR && rank() >= 3 && c ? (c.status === 'archived' ? btn('restore', 'שחזור מהארכיון') : btn('archive', 'העברה לארכיון', '', 'ghost')) : ''}</div>
    ${isR ? '' : `<p class="tiny faint">תרגיל חדש, איור התנועה והשיוך לתוכניות דורשים שינוי קוד (ראו "הגדרות שדורשות קוד").</p>`}</section><div data-cms-prevwrap>${preview(e.kind, d)}</div>`;
}
/* validation + warnings, recomputed on every field change WITHOUT re-rendering the form (focus and typing are never lost) */
function live(e) { const errs = problems(e.kind, e.id, e.data), warns = e.kind === 'recipe' ? warnRecipe(e.data) : [];
  return `<div class="banner ${errs.length ? 'bad' : 'good'} small" data-cms-valid>${icon('info')}<div>${errs.length ? `<b>יש לתקן לפני פרסום:</b><ul class="bul">${errs.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : 'כל שדות החובה תקינים.'}</div></div>
    ${warns.length ? `<div class="banner warn small" data-cms-warn>${icon('info')}<div><b>אזהרות (לא חוסמות):</b><ul class="bul">${warns.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div></div>` : ''}`; }
function refreshLive(v) { const e = st.edit; if (!e) return; const a = v.querySelector('[data-cms-live]'), b = v.querySelector('[data-cms-prevwrap]'); if (a) a.innerHTML = live(e); if (b) b.innerHTML = preview(e.kind, e.data);
  const errs = problems(e.kind, e.id, e.data); const rv = v.querySelector('[data-act=review]'); if (rv) rv.disabled = !!errs.length; }
function readForm() { /* form → st.edit.data (no network) */
  const e = st.edit; if (!e) return; const v = id => { const x = document.getElementById(id); return x ? x.value : null; }, lines = id => (v(id) || '').split('\n').map(s => s.trim()).filter(Boolean);
  if (e.kind === 'recipe') { const d = e.data; if (e.isNew && v('ed-id') != null) e.id = v('ed-id').trim();
    d.he = (v('ed-he') || '').trim(); d.en = (v('ed-en') || '').trim(); d.meal = v('ed-meal'); d.cuisine = v('ed-cu'); d.prep = +v('ed-prep') || 0; d.cook = +v('ed-cook') || 0; d.cost = +v('ed-cost') || 2; d.desc = (v('ed-desc') || '').trim();
    d.ing = d.ing.map((x, i) => { const f = document.querySelector(`[data-ing-f="${i}"]`), g = document.querySelector(`[data-ing-g="${i}"]`); return { f: f ? f.value : x.f, g: g ? +g.value : x.g }; });
    d.steps = lines('ed-steps'); d.subs = lines('ed-subs'); d.equip = (v('ed-equip') || '').split(',').map(s => s.trim()).filter(Boolean); d.tags = (v('ed-tags') || '').split(/\s+/).filter(Boolean); }
  else { const d = e.data; d.he = (v('ex-he') || '').trim(); d.en = (v('ex-en') || '').trim(); d.muscles = (v('ex-muscles') || '').trim(); d.start = (v('ex-start') || '').trim(); d.steps = lines('ex-steps'); d.dir = (v('ex-dir') || '').trim(); d.end = (v('ex-end') || '').trim(); d.breath = (v('ex-breath') || '').trim(); d.mistakes = lines('ex-mistakes'); d.bad = lines('ex-bad'); }
  try { localStorage.setItem('fit30.cmsEdit', JSON.stringify(e)); } catch (er) { }
}
function openItem(kind, id) {
  const d = st.drafts[key(kind, id)], c = st.content[key(kind, id)];
  let data, orig;
  if (kind === 'recipe') { const r = L.recipe(id), base = root.CMS.base.recipe[id] || r; orig = c ? JSON.parse(JSON.stringify(c.data)) : base ? toData(base) : null; data = d ? JSON.parse(JSON.stringify(d.data)) : r ? toData(r) : null; }
  else { const ex = root.EX_BY_ID[id]; orig = c ? JSON.parse(JSON.stringify(c.data)) : JSON.parse(JSON.stringify(Object.assign({}, root.CMS.base.exercise[id] || {}, pickEx(ex)))); data = d ? JSON.parse(JSON.stringify(d.data)) : pickEx(ex); }
  st.edit = { kind, id, data, orig, base: c ? c.version : 0, isNew: false };
}
const pickEx = ex => { const o = {}; root.CMS.EX_FIELDS.forEach(k => { if (ex[k] !== undefined) o[k] = Array.isArray(ex[k]) ? ex[k].slice() : ex[k]; }); return o; };
function diffRows(a, b) { const keys = [...new Set(Object.keys(a || {}).concat(Object.keys(b || {})))], F = N().FOODS, show = v => Array.isArray(v) ? v.map(x => x && x.f ? `${F[x.f] ? F[x.f].he : x.f} ${x.g}` : x).join(' | ') : v == null ? '' : String(v);
  return keys.filter(k => JSON.stringify((a || {})[k]) !== JSON.stringify((b || {})[k])).map(k => ({ k, before: show((a || {})[k]), after: show((b || {})[k]) })); }

function exercisesList() {
  const q = st.q.trim().toLowerCase(); let list = root.EXERCISES.filter(e => !q || (e.he + ' ' + e.en + ' ' + e.id).toLowerCase().includes(q));
  return `<section class="card stack" data-cms-exercises><h3>תרגילים</h3><p class="small muted">עריכת הוראות הביצוע של 57 התרגילים. איור התנועה, הסטים והחזרות בתוכניות נשארים בקוד.</p><label class="field">חיפוש<input id="cms-q" type="search" value="${esc(st.q)}"></label>
    <div class="list">${list.map(e => { const c = st.content[key('exercise', e.id)], d = st.drafts[key('exercise', e.id)]; return `<button class="li li-btn" data-act="open" data-k="exercise" data-id="${e.id}"><div class="grow"><div class="t">${esc(e.he)}</div><div class="s">${esc(e.muscles || '')}</div></div><span class="pill">${d ? 'טיוטה' : c ? 'פורסם v' + c.version : 'מובנה'}</span></button>`; }).join('')}</div></section>`;
}
function media() {
  const M = root.MEDIA || { ex: {}, rc: {} }, ex = root.EXERCISES, covers = ex.filter(e => M.ex[e.id] && M.ex[e.id].poster).length, vids = ex.filter(e => M.ex[e.id] && M.ex[e.id].video).length;
  const broken = Object.keys(M.ex || {}).filter(id => !root.EX_BY_ID[id]).concat(Object.keys(M.rc || {}).filter(id => !L.recipe(id))).length;
  return `<section class="card stack" data-cms-media><h3>ספריית מדיה</h3>
    <div class="kv"><span>תמונות שער לתרגילים: <b>${covers}/${ex.length}</b> (איורים מקוריים שנוצרו מהדמות — לא צילומים)</span><span>סרטוני הדגמה: <b>${vids}/${ex.length}</b></span><span>תמונות מנות: <b>0/${N().RECIPES.length}</b></span><span>הפניות שבורות: <b data-cms-broken>${broken}</b></span></div>
    <div class="banner warn small" data-cms-upload-blocked>${icon('lock')}<div><b>העלאת קבצים חסומה כרגע.</b> צריך Supabase Storage bucket בשם <span class="ltr">cms-media</span> עם הרשאות (קריאה לכולם, כתיבה לעורכים) — זו הגדרה בפרויקט החי ודורשת את אישורך. עד אז כל מדיה חדשה עוברת דרך <span class="ltr">tools/media_build.js</span> עם מקור ורישיון. לא מוצגים סרטונים או תמונות שאין להם קובץ ומקור.</div></div>
    <h4>איפה כל נכס משמש</h4><div class="list">${ex.slice(0, 57).map(e => { const m = M.ex[e.id] || {}; return `<div class="li"><div class="grow"><div class="t">${esc(e.he)}</div><div class="s">שער: ${m.poster ? 'איור שנוצר' : 'חסר'} · סרטון: ${m.video ? 'קיים' : 'אין'} · מוצג בדף התרגיל, באימון וברשימות</div></div></div>`; }).join('')}</div></section>`;
}
function roles() {
  if (rank() < 3) return `<section class="card"><h3>הרשאות</h3><p class="small muted">רק מנהלים ובעלים רואים את רשימת ההרשאות.</p></section>`;
  if (!st.members) { api('/rest/v1/rpc/cms_members_list', { method: 'POST', body: {} }).then(r => { st.members = r || []; root.App.render(); }, e => { st.err = errText(e); root.App.render(); }); return '<section class="card"><p class="small muted">טוען…</p></section>'; }
  return `<section class="card stack" data-cms-roles><h3>הרשאות</h3><p class="small muted">בעלים: מנהלים הרשאות. מנהל/ת: עורכים ומפרסמים. עורך/ת: טיוטות בלבד. צופה: קריאה בלבד. ההרשאה נאכפת בשרת; אי אפשר להעניק הרשאה לעצמך.</p>
    <div class="list">${st.members.map(m => `<div class="li"><div class="grow"><div class="t ltr">${esc(m.email)}</div><div class="s">${esc(ROLE_HE[m.role] || m.role)}</div></div>${st.role === 'owner' && m.role !== 'owner' ? btn('revoke', 'הסרה', `data-email="${esc(m.email)}"`, 'ghost') : ''}</div>`).join('')}</div>
    ${st.role === 'owner' ? `<div class="stack"><label class="field">כתובת דוא״ל של משתמש רשום<input id="rl-email" type="email" class="ltr"></label><label class="field">הרשאה<select id="rl-role"><option value="editor">עורך/ת</option><option value="admin">מנהל/ת</option><option value="reviewer">צופה</option></select></label>${btn('grant', 'הענקת הרשאה', '', 'primary')}</div>` : ''}</section>`;
}
const GUIDES = [
  ['סיור ראשוני', ['בחרו "מתכונים ותפריטים" — רואים את כל המתכונים, מובנים ומפורסמים.', 'פתחו מתכון: הטופס מחולק לפרטים, מרכיבים, שלבים ותגיות.', 'כל שינוי נבדק מיד: ירוק = תקין, אדום = חובה לתקן, כתום = אזהרה.', 'בצד מוצגת תצוגה מקדימה כמו באפליקציה.', '"שמירת טיוטה" לא משנה דבר למשתמשים. רק "פרסום" משנה.'], 'אחרי השמירה הטיוטה מופיעה בסקירה תחת "טיוטות שמחכות".', 'ביטול: "ביטול השינויים" מחזיר לגרסה האחרונה שנשמרה.'],
  ['יצירת מנה חדשה', ['"מתכון חדש" → מלאו שם בעברית ובאנגלית ומזהה (למשל lentil_salad_lemon).', 'בחרו סוג ארוחה ומטבח.', 'הוסיפו מרכיבים מהמאגר וכמות בגרמים לכל אחד.', 'כתבו שלבי הכנה, שורה לכל שלב, בלי גרמים.', 'שמרו טיוטה, בדקו "מה זה משנה?" ופרסמו.'], 'המנה תופיע לכל המשתמשים בפתיחה הבאה של האפליקציה, ויכולה להיכנס לתפריטים חדשים.', 'ביטול: "העברה לארכיון" מפסיקה להציע אותה; אפשר לשחזר.'],
  ['עריכת קלוריות וערכים תזונתיים', ['הערכים לא מוקלדים — הם מחושבים מהמרכיבים.', 'כדי לשנות קלוריות משנים כמויות או מחליפים מרכיב.', 'האזהרות מראות אם המנה חורגת ממנה רגילה.'], 'כל תפריט שבו המנה מופיעה יחשב את סיכום היום מחדש מהרכיבים.', 'ביטול: חזרה לגרסה קודמת דרך "היסטוריה וגרסאות".'],
  ['ניהול תפריטים', ['התפריט היומי נבנה אוטומטית מהמנות המפורסמות לפי היעדים וההעדפות של כל משתמש.', 'כדי לשנות מה מוצע: ערכו מנות, סוג ארוחה ומטבח, או העבירו מנות לארכיון.', '"מה זה משנה?" מריץ הדמיה של 4 פרופילים × 14 ימים ומראה כמה פעמים המנה נבחרת.'], 'שינויים חלים על תפריטים מהיום והלאה. ימים שעברו וארוחות שנרשמו לא משתנים.', 'ביטול: שחזור גרסה קודמת של המנה.'],
  ['ניהול תרגילים', ['"תרגילים" → בחרו תרגיל.', 'ערכו תנוחת התחלה, שלבים, נשימה וטעויות נפוצות.', 'שמרו טיוטה ופרסמו.'], 'הטקסט החדש יוצג בדף התרגיל ובמסך "איך מבצעים" באימון.', 'ביטול: שחזור גרסה קודמת. תרגיל חדש לגמרי דורש שינוי קוד.'],
  ['תמונות וסרטונים', ['"מדיה" מראה מה קיים, מה חסר ואיפה כל נכס משמש.', 'העלאה ישירה תופעל אחרי הגדרת Storage (דורש אישור).'], 'אין הצגה של מדיה בלי קובץ, מקור ורישיון.', '—'],
  ['פרסום, טיוטות ושחזור', ['טיוטה = עבודה פנימית. פרסום = נשלח למשתמשים.', 'לפני פרסום מוצגת השוואה "לפני/אחרי" ואזהרות, ונדרש אישור מפורש.', 'כל פרסום נשמר בהיסטוריה עם מי ומתי.', '"שחזור לגרסה זו" מפרסם את הגרסה הישנה כגרסה חדשה — שום דבר לא נמחק.'], 'המשתמשים מקבלים את הגרסה בפתיחה הבאה עם חיבור.', 'כל שחזור הוא עוד גרסה בהיסטוריה, כך שאפשר לחזור גם ממנו.'],
  ['מטבחים והעדפות', ['המטבח של כל מנה קובע למי היא מוצעת.', 'ברירת המחדל: ישראלי, ים־תיכוני ומערבי. מיקום המשתמש לא משנה את זה.', 'הגבלות תזונה ואלרגיות מחושבות מהמרכיבים — אין צורך לסמן ידנית.'], 'משתמש שבחר מטבח יקבל מנות ממנו; השאר יקבלו את ברירת המחדל.', '—'],
  ['פתרון שגיאות נפוצות', ['"הפעולה דורשת הרשאה" — אין לך הרשאת פרסום; בקשו ממנהל/ת.', '"מישהו פרסם גרסה חדשה" — טענו מחדש ובדקו לפני פרסום.', '"אין חיבור" — העבודה שמורה במכשיר; נסו שוב.', '"אותו מזון פעמיים" — אחדו לשורה אחת.'], '—', '—'],
  ['תוכן, הגדרות מערכת והרשאות', ['תוכן: מתכונים והוראות תרגילים — נערך כאן.', 'הגדרות מערכת: נוסחת היעדים, גבולות גודל מנה, איורים — בקוד (ראו הרשימה).', 'הרשאות: מי יכול לערוך ולפרסם — נקבע על ידי הבעלים ונאכף בשרת.'], '—', '—']];
function guide() { return `<section class="card stack" data-cms-guide><h3>מדריך ניהול</h3>${GUIDES.map(([t, steps, after, undo], i) => `<details class="more" ${i === 0 ? 'open' : ''}><summary>${i + 1}. ${esc(t)}</summary><ol class="steps">${steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol><p class="small"><b>מה קורה אחרי השמירה:</b> ${esc(after)}</p><p class="small"><b>ביטול:</b> ${esc(undo)}</p></details>`).join('')}</section>`; }
const CODE_ONLY = [['נוסחת יעדי קלוריות וחלבון (Mifflin–St Jeor, 1.8 ג׳/ק״ג)', 'משפיעה על כל המשתמשים ועל הבטיחות; שינוי דורש בדיקות רגרסיה.'], ['גבולות גודל מנה (×0.75–1.6) וחלוקת הארוחות', 'חלק מהמנוע; שינוי לא נכון יוצר מנות חריגות.'], ['מאגר המזונות (ערכים ל־100 ג׳)', 'כל ערך חדש צריך אימות מול USDA לפני שימוש; לא נפתח לעריכה כדי שלא יוקלדו ערכים לא מאומתים.'], ['איורי תנועה, תרגילים חדשים ותוכניות אימון', 'האיור הוא מודל תנועה בקוד; תוכניות תלויות בעומסים שנבדקו.'], ['לוגו, אייקון האפליקציה ואיורי המאמן', 'קבצים בבנייה (Storage להעלאה עדיין לא מוגדר). צבעים, גופנים, ריווח ועיגול פינות — נערכים בלשונית "עיצוב".'], ['סרטוני ההדרכה', 'מוקלטים אוטומטית מכל גרסה כדי שיתאימו לממשק.'], ['טקסטים שנבנים מערכים משתנים (למשל "3 ארוחות")', 'החלק הקבוע נערך בלשונית "טקסטים" רק כשהוא צומת טקסט שלם; משפט שמשולב בערך נשאר בקוד ומסומן ברשימה.'], ['מפתחות ושרתים', 'לעולם לא בממשק — רק בהגדרות הפרויקט.']];
function advanced() { return `<section class="card stack" data-cms-advanced><h3>הגדרות שדורשות שינוי קוד</h3><p class="small muted">אלה לא נפתחו לעריכה כאן, ולמה:</p><div class="list">${CODE_ONLY.map(([a, b]) => `<div class="li"><div class="grow"><div class="t">${esc(a)}</div><div class="s">${esc(b)}</div></div></div>`).join('')}</div></section>`; }

Screens.admin = function () {
  const g = guard();
  const body = g || shell(st.edit ? editor() : (Object.assign({ dash, recipes: recipesList, exercises: exercisesList, media, roles, guide, advanced }, EXT.views)[st.tab] || dash)());
  return { title: 'ניהול תוכן', back: '#/settings', html: `<div data-cms>${body}</div>`, handlers: H,
    after: v => { const on = (sel, ev, fn) => { const x = v.querySelector(sel); if (x) x.addEventListener(ev, fn); };
      on('#cms-q', 'input', ev => { st.q = ev.target.value; st.page = 0; clearTimeout(on.t); on.t = setTimeout(() => { root.App.render(); const x = document.getElementById('cms-q'); if (x) { x.focus(); x.setSelectionRange(x.value.length, x.value.length); } }, 250); });
      [['#cms-meal', 'meal'], ['#cms-cu', 'cu'], ['#cms-st', 'status'], ['#cms-sort', 'sort']].forEach(([s, k]) => on(s, 'change', ev => { st[k] = ev.target.value; st.page = 0; root.App.render(); }));
      on('#cms-iss', 'change', ev => { st.issuesOnly = ev.target.checked; st.page = 0; root.App.render(); });
      EXT.after.forEach(f => { try { f(v); } catch (e) { console.error(e); } });
      if (st.edit) v.querySelectorAll('[data-cms-editor] input, [data-cms-editor] select, [data-cms-editor] textarea').forEach(x => { x.addEventListener('input', () => { readForm(); refreshLive(v); }); x.addEventListener('change', () => { readForm(); refreshLive(v); }); }); } };
};
const H = {
  tab: el => { st.tab = el.dataset.t; st.edit = null; st.q = ''; root.App.render(); },
  reload: () => { st.loaded = false; st.err = null; root.App.render(); },
  page: el => { st.page += +el.dataset.d; root.App.render(); },
  help: el => root.UI.sheet('מה זה משנה?', `<p class="small">${esc(HELP[el.dataset.k] || '')}</p>`),
  open: el => { if (EXT.open[el.dataset.k]) { EXT.open[el.dataset.k](el.dataset.id); return; } openItem(el.dataset.k, el.dataset.id); root.App.render(); },
  newRecipe: () => { st.edit = { kind: 'recipe', id: '', data: { he: '', en: '', meal: 'm2', cuisine: 'israeli', ing: [{ f: 'chicken_breast', g: 140 }], steps: [], subs: [], equip: [], prep: 10, cook: 15, cost: 2, tags: [], desc: '' }, orig: null, base: 0, isNew: true }; root.App.render(); },
  dup: () => { readForm(); const e = st.edit; st.edit = { kind: 'recipe', id: e.id + '_copy', data: JSON.parse(JSON.stringify(e.data)), orig: null, base: 0, isNew: true }; st.edit.data.he += ' (עותק)'; root.UI.toast('נוצר עותק — שנו מזהה ושם ושמרו כטיוטה'); root.App.render(); },
  closeEd: () => { st.edit = null; try { localStorage.removeItem('fit30.cmsEdit'); } catch (e) { } root.App.render(); },
  discard: () => { const e = st.edit; if (e.isNew) { st.edit = null; } else openItem(e.kind, e.id); root.UI.toast('השינויים שלא נשמרו בוטלו'); root.App.render(); },
  ingAdd: () => { readForm(); st.edit.data.ing.push({ f: 'tomato', g: 100 }); root.App.render(); },
  ingDel: el => { readForm(); st.edit.data.ing.splice(+el.dataset.i, 1); root.App.render(); },
  saveDraft: async () => { readForm(); const e = st.edit, me = { id: root.Account.state().userId };
    if (!/^[a-z0-9_]{2,64}$/.test(e.id || '')) { st.err = 'כדי לשמור טיוטה צריך מזהה: אותיות לטיניות קטנות, ספרות וקו תחתון (2–64 תווים).'; root.App.render(); return; }
    if (e.isNew && (N().RECIPES.some(r => r.id === e.id) || st.content[key(e.kind, e.id)])) { st.err = 'המזהה כבר קיים — בחרו מזהה אחר.'; root.App.render(); return; }
    try { const row = { kind: e.kind, item_id: e.id, data: e.data, base_version: e.base, updated_by: me.id, updated_at: new Date().toISOString() };
      const ex = st.drafts[key(e.kind, e.id)];
      if (ex) await api(`/rest/v1/cms_drafts?kind=eq.${e.kind}&item_id=eq.${encodeURIComponent(e.id)}`, { method: 'PATCH', body: { data: e.data, updated_by: me.id, updated_at: row.updated_at } });
      else await api('/rest/v1/cms_drafts', { method: 'POST', body: row });
      st.drafts[key(e.kind, e.id)] = row; e.isNew = false; st.err = null; root.UI.toast('הטיוטה נשמרה בשרת. משתמשים עדיין לא רואים אותה.'); } catch (er) { st.err = errText(er); }
    root.App.render(); },
  impact: () => { readForm(); const e = st.edit; root.UI.sheet('מה זה משנה?', `<div class="stack" data-cms-impact><ul class="bul small">${impact(e.kind, e.id, e.orig, e.data).map(x => `<li>${esc(x)}</li>`).join('')}</ul><p class="tiny faint">מחושב מהמנוע האמיתי של האפליקציה, בלי לשמור דבר.</p></div>`); },
  review: () => { readForm(); const e = st.edit, errs = problems(e.kind, e.id, e.data); if (errs.length) return;
    if (!st.drafts[key(e.kind, e.id)] || JSON.stringify(st.drafts[key(e.kind, e.id)].data) !== JSON.stringify(e.data)) { root.UI.toast('קודם שמרו טיוטה — מפרסמים רק את מה שנשמר'); return; }
    const df = diffRows(e.orig, e.data), warns = e.kind === 'recipe' ? warnRecipe(e.data) : [], c = st.content[key(e.kind, e.id)];
    root.UI.sheet('בדיקה לפני פרסום', `<div class="stack" data-cms-review><h4>מה השתנה (${df.length} שדות)</h4><div class="list">${df.map(x => `<div class="li"><div class="grow"><div class="t">${esc(x.k)}</div><div class="s"><b>לפני:</b> ${esc(x.before || '—')}</div><div class="s"><b>אחרי:</b> ${esc(x.after || '—')}</div></div></div>`).join('') || '<p class="small muted">אין שינוי לעומת הגרסה הנוכחית.</p>'}</div>
      <h4>השפעות ידועות</h4><ul class="bul small">${impact(e.kind, e.id, e.orig, e.data).map(x => `<li>${esc(x)}</li>`).join('')}</ul>${warns.length ? `<div class="banner warn small"><div><b>אזהרות:</b><ul class="bul">${warns.map(w => `<li>${esc(w)}</li>`).join('')}</ul></div></div>` : ''}
      <p class="small">${esc(HELP.publish)}${c ? ` הגרסה הנוכחית (${c.version}) תישמר בהיסטוריה.` : ''}</p><label class="switch"><span>בדקתי את ההשוואה ואני מאשר/ת פרסום לכל המשתמשים</span><input type="checkbox" id="pub-ok"></label>
      <div class="btns"><button class="btn primary" data-act="publish">פרסום</button><button class="btn ghost" data-act="cancel">חזרה לעריכה</button></div></div>`, {
      cancel: (el, ev, close) => close(),
      publish: async (el, ev, close) => { if (!document.getElementById('pub-ok').checked) { root.UI.toast('צריך לסמן את האישור לפני פרסום'); return; }
        try { const r = await api('/rest/v1/rpc/cms_publish', { method: 'POST', body: { p_kind: e.kind, p_item: e.id } }); close(); await load(); await root.CMS.refresh(); openItem(e.kind, e.id); root.UI.toast(`פורסם (גרסה ${r && r.version}). המשתמשים יקבלו את השינוי בפתיחה הבאה.`); }
        catch (er) { close(); st.err = errText(er); } root.App.render(); } }); },
  archive: () => { const e = st.edit; root.UI.sheet('העברה לארכיון', `<div class="stack"><p class="small">${esc(HELP.archive)}</p><label class="switch"><span>אני מאשר/ת להפסיק להציע את המנה למשתמשים</span><input type="checkbox" id="ar-ok"></label><button class="btn primary" data-act="go">העברה לארכיון</button></div>`, {
      go: async (el, ev, close) => { if (!document.getElementById('ar-ok').checked) { root.UI.toast('צריך לסמן אישור'); return; } try { await api('/rest/v1/rpc/cms_set_status', { method: 'POST', body: { p_kind: e.kind, p_item: e.id, p_status: 'archived' } }); close(); await load(); await root.CMS.refresh(); openItem(e.kind, e.id); root.UI.toast('הועבר לארכיון'); } catch (er) { close(); st.err = errText(er); } root.App.render(); } }); },
  restore: async () => { const e = st.edit; try { await api('/rest/v1/rpc/cms_set_status', { method: 'POST', body: { p_kind: e.kind, p_item: e.id, p_status: 'published' } }); await load(); await root.CMS.refresh(); openItem(e.kind, e.id); root.UI.toast('שוחזר ופורסם שוב'); } catch (er) { st.err = errText(er); } root.App.render(); },
  history: async () => { const e = st.edit; let revs = [];
    try { revs = await api(`/rest/v1/cms_revisions?select=version,action,data,note,actor,at&kind=eq.${e.kind}&item_id=eq.${encodeURIComponent(e.id)}&order=version.desc`) || []; } catch (er) { st.err = errText(er); root.App.render(); return; }
    const me = { id: root.Account.state().userId }, A = { publish: 'פרסום', archive: 'ארכוב', restore: 'שחזור מהארכיון', rollback: 'חזרה לגרסה קודמת' }, cur = st.content[key(e.kind, e.id)];
    root.UI.sheet('היסטוריה וגרסאות', `<div class="stack" data-cms-history>${revs.length ? revs.map(r => `<div class="li"><div class="grow"><div class="t">גרסה ${r.version} · ${esc(A[r.action] || r.action)}</div><div class="s">${esc(String(r.at).slice(0, 16).replace('T', ' '))} · ${r.actor === (me && me.id) ? 'את/ה' : 'חבר/ת צוות'}${r.note ? ' · ' + esc(r.note) : ''}</div>
      <details class="more"><summary>השוואה לגרסה הנוכחית</summary>${diffRows(r.data, cur && cur.data).map(x => `<div class="s"><b>${esc(x.k)}:</b> ${esc(x.before)} ← ${esc(x.after)}</div>`).join('') || '<p class="tiny muted">זהה לגרסה הנוכחית.</p>'}</details></div>${rank() >= 3 && cur && r.version !== cur.version ? `<button class="btn sm" data-act="rb" data-v="${r.version}">שחזור לגרסה זו</button>` : ''}</div>`).join('') : '<p class="small muted">אין עדיין גרסאות מפורסמות. התוכן המובנה מגיע מהקוד.</p>'}<p class="tiny faint">שחזור מפרסם את הגרסה הישנה כגרסה חדשה; שום גרסה לא נמחקת.</p></div>`, {
      rb: async (el, ev, close) => { try { await api('/rest/v1/rpc/cms_rollback', { method: 'POST', body: { p_kind: e.kind, p_item: e.id, p_version: +el.dataset.v } }); close(); await load(); await root.CMS.refresh(); openItem(e.kind, e.id); root.UI.toast('שוחזר — פורסם כגרסה חדשה'); } catch (er) { close(); st.err = errText(er); } root.App.render(); } }); },
  grant: async () => { const em = document.getElementById('rl-email').value.trim(), ro = document.getElementById('rl-role').value; try { await api('/rest/v1/rpc/cms_set_role', { method: 'POST', body: { p_email: em, p_role: ro } }); st.members = null; st.err = null; root.UI.toast('ההרשאה נשמרה'); } catch (er) { st.err = errText(er); } root.App.render(); },
  revoke: async el => { try { await api('/rest/v1/rpc/cms_set_role', { method: 'POST', body: { p_email: el.dataset.email, p_role: null } }); st.members = null; root.UI.toast('ההרשאה הוסרה'); } catch (er) { st.err = errText(er); } root.App.render(); }
};
/* unsaved work survives a reload */
try { const s = JSON.parse(localStorage.getItem('fit30.cmsEdit') || 'null'); if (s && s.kind && s.data) st.edit = s; } catch (e) { }
root.AdminCMS = { state: st, load, impact, simulate, warnRecipe, diffRows, api, key, errText, btn, rank, problems, EXT, H, help, HELP, ROLE_HE, previewRows: () => [] };
})(typeof window !== 'undefined' ? window : globalThis);
