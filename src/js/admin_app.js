/* Admin CMS · full app control (part of the admin.js chunk): texts, screens & layout, design tokens, app settings, audit log.
   Every area uses the same server workflow as recipes: draft (editor) → validate → preview → publish with confirmation (admin) →
   history → rollback / reset. Permissions are enforced by PostgreSQL (RLS + SECURITY DEFINER functions, see the CMS migration);
   the buttons only mirror them. Content is DATA validated by cms_content.js and again on the server (cms_valid): no HTML, no CSS
   text, no scripts — the design area can only set the listed tokens to checked values. */
(function (root) {
'use strict';
const A = root.AdminCMS, C = root.CMS; if (!A || !C) return;
const { esc, icon } = root.UI, st = A.state, key = A.key, btn = A.btn, api = A.api, EXT = A.EXT;
const S = st.app = st.app || { tq: '', tarea: '', tst: '', tpage: 0, tsel: null, lscreen: 'home', ldraft: {}, theme: null, cfg: null, audit: null, akind: '', bulk: null, pv: 'mobile' };
Object.assign(EXT.kindHe, { text: 'טקסט', layout: 'פריסת מסך', theme: 'עיצוב', config: 'הגדרות אפליקציה' });
Object.assign(EXT.msg, {
  t_orig: 'הטקסט המקורי חסר.', t_id: 'מזהה הטקסט לא תואם לטקסט המקורי.', t_len: 'טקסט ארוך מדי (עד 600 תווים).', t_html: 'אסור להשתמש בתגיות או בסימנים < >.',
  t_tok: 'צריך לשמור על המספרים, סימני האחוז ומשתנים כמו {name} בדיוק כמו במקור — הם ממולאים על ידי האפליקציה.', t_empty: 'צריך למלא נוסח חדש בעברית (או באנגלית).',
  l_screen: 'מסך לא נתמך.', l_order: 'סדר הרכיבים לא תקין.', l_hide: 'אחד הרכיבים שסומנו להסתרה לא ניתן להסתרה (רכיב חובה או בטיחות).', l_space: 'ריווח לא תקין.', l_align: 'יישור לא תקין.',
  th_id: 'שם ערכה לא תקין.', th_name: 'צריך שם לערכה (עד 40 תווים).', th_tokens: 'אין ערכים.', th_unknown: k => `ערך לא מוכר: ${k}.`, th_value: k => `ערך לא תקין ב־${tokHe(k)}.`,
  th_contrast: k => { const [a, b] = String(k).split('/'); return `ניגודיות נמוכה מדי: ${tokHe(a)} על ${tokHe(b)} — קשה לקרוא.`; },
  c_id: 'הגדרות לא מזוהות.', c_off: 'מודול לא מוכר.', c_def: 'ערך ברירת מחדל לא תקין.', c_notice: 'הודעה: עד 200 תווים, בלי < >, וסוג מידע או אזהרה.' });
const tokHe = k => (C.TOKENS.find(t => t[0] === k) || [k, '', k])[2];
const cur = (kind, id) => ({ pub: st.content[key(kind, id)], draft: st.drafts[key(kind, id)] });
const pill = (kind, id) => { const { pub, draft } = cur(kind, id); return draft ? '<span class="pill acc" data-st="draft">טיוטה</span>' : pub ? (pub.status === 'archived' ? '<span class="pill" data-st="reset">אופס לברירת המחדל</span>' : `<span class="pill good" data-st="published">פורסם v${pub.version}</span>`) : '<span class="pill" data-st="builtin">מקורי</span>'; };
const live = (kind, id) => { const { pub } = cur(kind, id); return pub && pub.status === 'published' ? pub.data : null; };
const working = (kind, id) => { const { pub, draft } = cur(kind, id); return draft ? draft.data : pub && pub.status === 'published' ? pub.data : null; };
const me = () => root.Account.state().userId;
const canEdit = () => A.rank() >= 2, canPub = () => A.rank() >= 3;
function errList(kind, id, d) { const e = A.problems(kind, id, d); return `<div class="banner ${e.length ? 'bad' : 'good'} small" data-cms-valid>${icon('info')}<div>${e.length ? `<b>יש לתקן לפני פרסום:</b><ul class="bul">${e.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : 'תקין — אפשר לשמור ולפרסם.'}</div></div>`; }

/* ── shared server actions (same RPCs and tables as recipes) ── */
async function saveDraft(kind, id, data, note) {
  const ex = st.drafts[key(kind, id)], p = st.content[key(kind, id)], now = new Date().toISOString();
  const row = { kind, item_id: id, data, base_version: ex ? ex.base_version : p ? p.version : 0, updated_by: me(), updated_at: now, note: note || null };
  if (ex) await api(`/rest/v1/cms_drafts?kind=eq.${kind}&item_id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: { data, updated_by: me(), updated_at: now } });
  else await api('/rest/v1/cms_drafts', { method: 'POST', body: row });
  st.drafts[key(kind, id)] = Object.assign({}, ex || row, { data, updated_at: now });
}
async function after(msg) { await A.load(); await C.refresh(); st.err = null; if (msg) root.UI.toast(msg); root.App.render(); }
function publishSheet(kind, id, diffHtml, extra) {
  const { pub, draft } = cur(kind, id); if (!draft) { root.UI.toast('קודם שומרים טיוטה — מפרסמים רק את מה שנשמר'); return; }
  const e = A.problems(kind, id, draft.data); if (e.length) { root.UI.toast('יש שגיאות — אי אפשר לפרסם'); return; }
  root.UI.sheet('בדיקה לפני פרסום', `<div class="stack" data-cms-review>${diffHtml}${extra || ''}
    <p class="small">הפרסום נשלח לכל המשתמשים בפתיחה הבאה של האפליקציה עם חיבור, בלי בנייה מחדש.${pub ? ` הגרסה הנוכחית (${pub.version}) נשמרת בהיסטוריה.` : ''} נתונים שהמשתמשים הזינו לא משתנים.</p>
    <label class="switch"><span>בדקתי ואני מאשר/ת פרסום לכל המשתמשים</span><input type="checkbox" id="pub-ok"></label>
    <div class="btns"><button class="btn primary" data-act="go">פרסום</button><button class="btn ghost" data-act="no">חזרה</button></div></div>`, {
    no: (el, ev, close) => close(),
    go: async (el, ev, close) => { if (!document.getElementById('pub-ok').checked) { root.UI.toast('צריך לסמן את האישור לפני פרסום'); return; }
      try { const r = await api('/rest/v1/rpc/cms_publish', { method: 'POST', body: { p_kind: kind, p_item: id } }); close(); await after(`פורסם (גרסה ${r && r.version}).`); } catch (er) { close(); st.err = A.errText(er); root.App.render(); } } });
}
function resetSheet(kind, id, what) {
  root.UI.sheet('חזרה לברירת המחדל', `<div class="stack"><p class="small">${esc(what)} יחזור לנוסח/לערכים המובנים של האפליקציה. הגרסה שפורסמה לא נמחקת — היא נשמרת בהיסטוריה ואפשר לשחזר אותה.</p>
    <label class="switch"><span>אני מאשר/ת חזרה לברירת המחדל לכל המשתמשים</span><input type="checkbox" id="rs-ok"></label><button class="btn primary" data-act="go">חזרה לברירת המחדל</button></div>`, {
    go: async (el, ev, close) => { if (!document.getElementById('rs-ok').checked) { root.UI.toast('צריך לסמן אישור'); return; }
      try { await api('/rest/v1/rpc/cms_set_status', { method: 'POST', body: { p_kind: kind, p_item: id, p_status: 'archived' } }); close(); await after('חזר לברירת המחדל'); } catch (er) { close(); st.err = A.errText(er); root.App.render(); } } });
}
async function historySheet(kind, id, show) {
  let revs = []; try { revs = await api(`/rest/v1/cms_revisions?select=version,action,data,note,actor,at&kind=eq.${kind}&item_id=eq.${encodeURIComponent(id)}&order=version.desc`) || []; } catch (er) { st.err = A.errText(er); root.App.render(); return; }
  const AH = { publish: 'פרסום', archive: 'חזרה לברירת המחדל', restore: 'שחזור', rollback: 'חזרה לגרסה קודמת' }, pub = st.content[key(kind, id)];
  root.UI.sheet('היסטוריה וגרסאות', `<div class="stack" data-cms-history>${revs.length ? revs.map(r => `<div class="li"><div class="grow"><div class="t">גרסה ${r.version} · ${esc(AH[r.action] || r.action)}</div><div class="s">${esc(String(r.at).slice(0, 16).replace('T', ' '))} · ${r.actor === me() ? 'את/ה' : 'חבר/ת צוות'}</div><div class="s">${show(r.data)}</div></div>${canPub() && pub && r.version !== pub.version && r.action !== 'archive' ? `<button class="btn sm" data-act="rb" data-v="${r.version}">שחזור לגרסה זו</button>` : ''}</div>`).join('') : '<p class="small muted">אין עדיין גרסאות. מוצג הנוסח המובנה של האפליקציה.</p>'}<p class="tiny faint">שחזור מפרסם את הגרסה הישנה כגרסה חדשה; שום גרסה לא נמחקת.</p></div>`, {
    rb: async (el, ev, close) => { try { await api('/rest/v1/rpc/cms_rollback', { method: 'POST', body: { p_kind: kind, p_item: id, p_version: +el.dataset.v } }); close(); await after('שוחזר — פורסם כגרסה חדשה'); } catch (er) { close(); st.err = A.errText(er); root.App.render(); } } });
}
const actions = (kind, id, valid, resetWhat) => { const { pub, draft } = cur(kind, id); return `<div class="btns">${canEdit() ? btn('apSave', 'שמירת טיוטה', `data-k="${kind}" data-id="${esc(id)}"`, 'primary') : ''}${canPub() ? btn('apPub', 'בדיקה ופרסום…', `data-k="${kind}" data-id="${esc(id)}" ${draft && valid ? '' : 'disabled'}`) : ''}${pub ? btn('apHist', 'היסטוריה', `data-k="${kind}" data-id="${esc(id)}"`) : ''}${canPub() && pub && pub.status === 'published' ? btn('apReset', 'חזרה לברירת המחדל', `data-k="${kind}" data-id="${esc(id)}" data-what="${esc(resetWhat)}"`, 'ghost') : ''}${draft && canEdit() ? btn('apDrop', 'מחיקת הטיוטה', `data-k="${kind}" data-id="${esc(id)}"`, 'ghost') : ''}</div>${canEdit() ? '' : '<p class="tiny faint">יש לך הרשאת צפייה בלבד.</p>'}`; };

/* ── preview: a live copy of the app in an iframe (?cmspreview=1) that applies the rows being edited ── */
let pvRows = [];
A.previewRows = () => pvRows;
const setPreview = rows => { pvRows = rows.filter(Boolean); const f = document.querySelector('[data-cms-frame]'); try { if (f && f.contentWindow && f.contentWindow.CMS) f.contentWindow.CMS.repreview(); } catch (e) { } };
const frame = (hash) => { const w = S.pv === 'desktop' ? 1024 : 390, sc = S.pv === 'desktop' ? 0.34 : 0.62;
  return `<div class="stack tight" data-cms-pv><div class="row wrap"><span class="small"><b>תצוגה מקדימה חיה</b> — העותק שלך של האפליקציה עם השינויים שעדיין לא פורסמו</span>${btn('pvSize', 'נייד', `data-v="mobile" aria-pressed="${S.pv === 'mobile'}"`)}${btn('pvSize', 'מחשב', `data-v="desktop" aria-pressed="${S.pv === 'desktop'}"`)}</div>
    <div style="width:${Math.round(w * sc)}px;height:${Math.round(720 * sc)}px;overflow:hidden;border:1px solid var(--line);border-radius:var(--r-sm);background:var(--bg)"><iframe data-cms-frame title="תצוגה מקדימה" src="./?cmspreview=1${hash}" style="width:${w}px;height:720px;border:0;transform:scale(${sc});transform-origin:top right" tabindex="-1"></iframe></div>
    <p class="tiny faint">אמולציה בדפדפן הזה בלבד — לא מחליפה בדיקה במכשיר אמיתי.</p></div>`; };

/* ════════ 1. texts ════════ */
let CAT = null;
const loadCat = () => CAT ? Promise.resolve(CAT) : root.App.loadChunk('cms-catalog.js').then(() => { CAT = (root.CMS_CATALOG || []).map(([s, f, a, n, p]) => ({ s, f, a, n, p, id: C.textId(s) })); return CAT; });
const tRow = id => working('text', id), tLive = id => live('text', id);
function texts() {
  if (!CAT) { loadCat().then(() => root.App.render(), () => { st.err = 'לא ניתן לטעון את רשימת הטקסטים (נדרש חיבור).'; root.App.render(); }); return '<section class="card"><p class="small muted" data-cms-loading>טוען את רשימת הטקסטים…</p></section>'; }
  const q = S.tq.trim().toLowerCase(), areas = [...new Set(CAT.flatMap(e => e.a))].sort((a, b) => a.localeCompare(b, 'he'));
  let rows = CAT;
  if (q) rows = rows.filter(e => (e.s + ' ' + e.id + ' ' + e.f.join(' ') + ' ' + e.a.join(' ') + ' ' + ((tRow(e.id) || {}).he || '') + ' ' + ((tRow(e.id) || {}).en || '')).toLowerCase().includes(q));
  if (S.tarea) rows = rows.filter(e => e.a.includes(S.tarea));
  if (S.tst === 'edited') rows = rows.filter(e => cur('text', e.id).pub || cur('text', e.id).draft); else if (S.tst === 'multi') rows = rows.filter(e => e.n > 1); else if (S.tst === 'partial') rows = rows.filter(e => e.p); else if (S.tst === 'noen') rows = rows.filter(e => !(tRow(e.id) || {}).en);
  const pages = Math.max(1, Math.ceil(rows.length / 20)); S.tpage = Math.min(S.tpage, pages - 1); const pg = rows.slice(S.tpage * 20, S.tpage * 20 + 20);
  const known = new Set(CAT.map(e => e.id)), orphans = Object.values(st.content).filter(x => x.kind === 'text' && x.status === 'published' && !known.has(x.item_id));
  const edited = Object.values(st.content).filter(x => x.kind === 'text' && x.status === 'published').length, drafts = Object.values(st.drafts).filter(x => x.kind === 'text');
  const sel = S.tsel && CAT.find(e => e.id === S.tsel);
  return `<section class="card stack" data-cms-texts><h3>טקסטים בממשק</h3>
    <p class="small muted">${CAT.length} טקסטים קבועים מכל מסכי האפליקציה. שינוי חל על כל המקומות שבהם אותו טקסט מופיע בדיוק. טקסטים שהמשתמש הקליד, ערכים מחושבים ושמות מתכונים/תרגילים לא נערכים כאן.</p>
    <div class="kv" data-cms-tcounts><span>שונו ופורסמו: <b>${edited}</b></span><span>טיוטות: <b>${drafts.length}</b></span><span>בשימוש ביותר ממקום אחד: <b>${CAT.filter(e => e.n > 1).length}</b></span><span>משולבים בערך משתנה: <b>${CAT.filter(e => e.p).length}</b></span><span>בלי נוסח אנגלי: <b>${CAT.filter(e => !(tRow(e.id) || {}).en).length}</b></span></div>
    <label class="field">חיפוש (טקסט, מזהה, קובץ או מסך)<input id="ap-tq" type="search" value="${esc(S.tq)}" placeholder="למשל: סמן שאכלתי"></label>
    <div class="row wrap"><label class="field">מסך<select id="ap-tarea"><option value="">כל המסכים</option>${areas.map(a => `<option ${S.tarea === a ? 'selected' : ''}>${esc(a)}</option>`).join('')}</select></label>
      <label class="field">סינון<select id="ap-tst">${[['', 'הכול'], ['edited', 'ששונו'], ['multi', 'בשימוש ביותר ממקום אחד'], ['partial', 'משולבים בערך משתנה'], ['noen', 'בלי נוסח אנגלי']].map(([k, v]) => `<option value="${k}" ${S.tst === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label></div>
    <p class="tiny muted" data-cms-ttotal>${rows.length} תוצאות · עמוד ${S.tpage + 1} מתוך ${pages}</p>
    <div class="list" data-cms-tlist>${pg.map(e => { const w = tRow(e.id); return `<button class="li li-btn" data-act="tOpen" data-id="${e.id}"><div class="grow"><div class="t">${esc(w && w.he ? w.he : e.s)}</div><div class="s">${w && w.he ? `במקור: ${esc(e.s)} · ` : ''}${esc(e.a.join(', '))} · ${e.n} שימושים${e.p ? ' · משולב בערך משתנה' : ''}</div></div>${pill('text', e.id)}</button>`; }).join('') || '<p class="small muted">אין תוצאות.</p>'}</div>
    <div class="btns">${btn('tPage', 'הקודם', `data-d="-1" ${S.tpage ? '' : 'disabled'}`)}${btn('tPage', 'הבא', `data-d="1" ${S.tpage < pages - 1 ? '' : 'disabled'}`)}</div></section>
    ${sel ? textEditor(sel) : ''}
    ${canEdit() ? bulkCard() : ''}
    ${canPub() && drafts.length ? `<section class="card stack" data-cms-tpuball><h3>פרסום טיוטות טקסט (${drafts.length})</h3><div class="list">${drafts.slice(0, 30).map(d => `<div class="li small"><div class="grow"><div class="t">${esc(d.data.he || d.data.en || '')}</div><div class="s">במקור: ${esc(d.data.orig)}</div></div></div>`).join('')}</div>${btn('tPubAll', `פרסום ${drafts.length} הטיוטות…`, '', 'primary')}</section>` : ''}
    ${orphans.length ? `<section class="card stack" data-cms-orphans><h3>טקסטים שלא נמצאים יותר באפליקציה (${orphans.length})</h3><p class="small muted">המקור שלהם שונה בקוד, ולכן השינוי לא מוצג בשום מקום. כדאי להחזיר אותם לברירת המחדל.</p><div class="list">${orphans.map(o => `<div class="li small"><div class="grow">${esc(o.data.orig)} → ${esc(o.data.he || '')}</div>${canPub() ? btn('apReset', 'ניקוי', `data-k="text" data-id="${o.item_id}" data-what="הטקסט"`, 'ghost') : ''}</div>`).join('')}</div></section>` : ''}`;
}
function textEditor(e) {
  const w = tRow(e.id) || { orig: e.s, he: '', en: '' }, d = { orig: e.s, he: w.he || '', en: w.en || '' }, dis = canEdit() ? '' : 'disabled', valid = !A.problems('text', e.id, d).length;
  return `<section class="card stack" data-cms-teditor data-id="${e.id}"><div class="row between"><h3>עריכת טקסט</h3>${btn('tClose', 'סגירה', '', 'ghost')}</div>
    <div class="field"><span class="small muted">הנוסח המקורי (בקוד)</span><div class="slot small" data-t-orig>${esc(e.s)}</div></div>
    <label class="field">נוסח חדש בעברית<input id="ap-the" value="${esc(d.he)}" ${dis} maxlength="600"></label>
    <label class="field">נוסח באנגלית <span class="tiny faint">(תצוגת פיתוח בלבד, ?lang=en)</span><input id="ap-ten" class="ltr" value="${esc(d.en)}" ${dis} maxlength="600"></label>
    <div data-t-live>${errList('text', e.id, d)}</div>
    <div class="slot stack tight small" data-t-prev><span class="eyebrow">תצוגה מקדימה</span><div><b>לפני:</b> ${esc(e.s)}</div><div><b>אחרי:</b> <span data-t-after>${esc(d.he || e.s)}</span></div></div>
    <p class="tiny muted" data-t-where>מופיע ב: ${esc(e.a.join(', '))} (${e.n} מקומות בקוד: ${esc(e.f.join(', '))}). ${e.n > 1 ? '<b>שינוי יחול על כל המקומות.</b> ' : ''}${e.p ? '<b>שימו לב:</b> הטקסט משולב בקוד בערך משתנה (למשל מספר), ולכן ייתכן שהוא לא יוחלף בכל מקום — בדקו בתצוגה המקדימה.' : ''}</p>
    ${actions('text', e.id, valid, 'הטקסט')}</section>`;
}
function bulkCard() {
  const b = S.bulk || { find: '', rep: '' }, hits = b.find.length >= 2 && CAT ? CAT.filter(e => e.s.includes(b.find)).slice(0, 50) : [];
  return `<section class="card stack" data-cms-bulk><h3>החלפה בכמה טקסטים</h3><p class="small muted">מחפש מילה או ביטוי בכל הטקסטים ויוצר <b>טיוטות</b> בלבד. שום דבר לא מתפרסם עד אישור.</p>
    <div class="row wrap"><label class="field">לחפש<input id="ap-bf" value="${esc(b.find)}"></label><label class="field">להחליף ב<input id="ap-br" value="${esc(b.rep)}"></label></div>
    <p class="tiny muted" data-bulk-n>${b.find.length >= 2 ? `${hits.length} טקסטים יושפעו${hits.length === 50 ? ' (מוצגים 50 הראשונים — אפשר לחזור על הפעולה)' : ''}` : 'הקלידו לפחות 2 תווים.'}</p>
    ${hits.length ? `<div class="list" data-bulk-list>${hits.slice(0, 8).map(e => `<div class="li small"><div class="grow"><div>${esc(e.s)}</div><div class="s">→ ${esc(e.s.split(b.find).join(b.rep))}</div></div></div>`).join('')}</div>${btn('tBulk', `יצירת ${hits.length} טיוטות`, '', 'primary')}` : ''}</section>`;
}
function readText() { const e = CAT && CAT.find(x => x.id === S.tsel); if (!e) return null; const v = id => (document.getElementById(id) || {}).value || ''; return { e, d: { orig: e.s, he: v('ap-the').trim(), en: v('ap-ten').trim() } }; }

/* ════════ 2. screens & layout ════════ */
const regList = sc => C.REG[sc].secs || C.REG[sc].items;
function layoutData(sc) { const d = S.ldraft[sc] || working('layout', sc); const ids = regList(sc).map(x => x[0]); const o = d ? JSON.parse(JSON.stringify(d)) : { order: ids.slice(), hidden: [], space: {}, align: {} };
  ids.forEach(i => { if (!o.order.includes(i)) o.order.push(i); }); o.hidden = o.hidden || []; o.space = o.space || {}; o.align = o.align || {}; return o; }
function layout() {
  const sc = S.lscreen, R = C.REG[sc], d = layoutData(sc), items = regList(sc), nav = sc === 'nav', valid = !A.problems('layout', sc, d).length, dis = canEdit() ? '' : 'disabled';
  setPreview([{ kind: 'layout', item_id: sc, status: 'published', version: 0, data: d }]);
  return `<section class="card stack" data-cms-layout><h3>מסכים ופריסה</h3><p class="small muted">סידור, הסתרה וריווח של רכיבים במסכים הנתמכים. רכיבים שלא ברשימה מוגדרים בקוד ונשארים במקומם. אין כאן עריכת קוד או HTML.</p>
    <label class="field">מסך<select id="ap-ls">${Object.entries(C.REG).map(([k, v]) => `<option value="${k}" ${k === sc ? 'selected' : ''}>${esc(v.he)}</option>`).join('')}</select></label>
    <ol class="list" data-cms-comps>${d.order.map((id, i) => { const it = items.find(x => x[0] === id), canHide = nav ? it[2] : it[3]; return `<li class="li" data-comp="${id}"><div class="grow"><div class="t">${esc(nav ? it[1] : it[2])}</div>${nav ? '' : `<div class="row wrap tiny"><label>ריווח <select data-sp="${id}" ${dis}>${[['normal', 'רגיל'], ['compact', 'צפוף'], ['roomy', 'מרווח']].map(([k, v]) => `<option value="${k}" ${(d.space[id] || 'normal') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label><label>יישור <select data-al="${id}" ${dis}>${[['start', 'לימין'], ['center', 'למרכז']].map(([k, v]) => `<option value="${k}" ${(d.align[id] || 'start') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label></div>`}</div>
      ${canHide ? `<label class="switch tiny"><span>מוצג</span><input type="checkbox" data-show="${id}" ${d.hidden.includes(id) ? '' : 'checked'} ${dis}></label>` : '<span class="pill" title="רכיב חובה">חובה</span>'}
      <button class="icon-btn" data-act="lMove" data-id="${id}" data-d="-1" aria-label="הזזה למעלה: ${esc(nav ? it[1] : it[2])}" ${i === 0 || !canEdit() ? 'disabled' : ''}>▲</button><button class="icon-btn" data-act="lMove" data-id="${id}" data-d="1" aria-label="הזזה למטה: ${esc(nav ? it[1] : it[2])}" ${i === d.order.length - 1 || !canEdit() ? 'disabled' : ''}>▼</button></li>`; }).join('')}</ol>
    ${R.fixed ? `<details class="more"><summary>רכיבים שמוגדרים בקוד (לא ניתנים לעריכה כאן)</summary><ul class="bul small">${R.fixed.map(x => `<li>${esc(x)}</li>`).join('')}</ul></details>` : ''}
    <p class="tiny muted">כותרות ותיאורים של רכיבים נערכים בלשונית "טקסטים". שינוי חל אחרי רענון התוכן באפליקציה (בפתיחה הבאה עם חיבור).</p>
    ${errList('layout', sc, d)}${actions('layout', sc, valid, 'סידור המסך')}</section>
    <section class="card">${frame(nav ? '#/' : sc === 'home' ? '#/' : '#/' + sc)}</section>`;
}

/* ════════ 3. design ════════ */
function themeData() { if (!S.theme) { const w = working('theme', 'active'); S.theme = w ? JSON.parse(JSON.stringify(w)) : { name: 'ערכה מותאמת', tokens: {} }; } return S.theme; }
function design() {
  const d = themeData(), m = C.themeMerged(d.tokens), dis = canEdit() ? '' : 'disabled', valid = !A.problems('theme', 'active', d).length, issues = C.contrastIssues(d.tokens);
  setPreview([{ kind: 'theme', item_id: 'active', status: 'published', version: 0, data: d }]);
  const presets = Object.values(st.content).filter(x => x.kind === 'theme' && x.status === 'published' && x.item_id !== 'active');
  const group = (title, types) => `<fieldset class="stack" data-tg="${types.join(',')}"><legend>${title}</legend>${C.TOKENS.filter(t => types.includes(t[1])).map(t => { const v = m[t[0]], set = d.tokens[t[0]] != null;
    const inp = t[1] === 'color' ? `<input type="color" data-tok="${t[0]}" value="${esc(v)}" ${dis} aria-label="${esc(t[2])}"><input class="ltr" data-tokx="${t[0]}" value="${esc(v)}" style="width:7em" ${dis} aria-label="${esc(t[2])} (hex)">`
      : t[1] === 'font' ? `<select data-tok="${t[0]}" ${dis}>${Object.keys(C.FONTS).map(k => `<option value="${k}" ${v === k ? 'selected' : ''}>${{ heebo: 'Heebo', rubik: 'Rubik', system: 'גופן המערכת' }[k]}</option>`).join('')}</select>`
      : t[1] === 'shadow' ? `<select data-tok="${t[0]}" ${dis}>${[['none', 'בלי'], ['soft', 'רך'], ['strong', 'חזק']].map(([k, l]) => `<option value="${k}" ${v === k ? 'selected' : ''}>${l}</option>`).join('')}</select>`
      : t[1] === 'weight' ? `<select data-tok="${t[0]}" ${dis}>${['500', '600', '700', '800'].map(k => `<option ${String(v) === k ? 'selected' : ''}>${k}</option>`).join('')}</select>`
      : `<input type="number" data-tok="${t[0]}" data-px min="${t[4][0]}" max="${t[4][1]}" value="${parseInt(v, 10)}" ${dis} style="width:6em"><span class="tiny faint">px (${t[4][0]}–${t[4][1]})</span>`;
    return `<div class="row between" data-trow="${t[0]}"><span class="small">${esc(t[2])}${set ? ' <span class="pill acc tiny">שונה</span>' : ''}</span><span class="row">${inp}${set && canEdit() ? `<button class="icon-btn" data-act="dTokReset" data-t="${t[0]}" aria-label="ברירת מחדל: ${esc(t[2])}">↺</button>` : ''}</span></div>`; }).join('')}</fieldset>`;
  const sample = Object.entries(m).map(([k, v]) => { const t = C.TOKENS.find(x => x[0] === k); return `${k}:${t[1] === 'font' ? C.FONTS[v] : t[1] === 'shadow' ? C.SHADOWS[v] : v}`; }).join(';');
  return `<section class="card stack" data-cms-design><h3>עיצוב ומיתוג</h3><p class="small muted">כל הצבעים, הגופנים, הריווח ועיגול הפינות מוגדרים כמשתנים מרכזיים (design tokens). מה שנקבע כאן מחליף אותם בכל האפליקציה. האפליקציה בנויה כערכה כהה; ערכה בהירה אפשרית רק אם כל בדיקות הניגודיות עוברות.</p>
    <label class="field">שם הערכה<input id="ap-dname" value="${esc(d.name || '')}" ${dis} maxlength="40"></label>
    ${group('צבעים', ['color'])}${group('טיפוגרפיה', ['font', 'weight'])}${group('צורה, ריווח וגדלים', ['px', 'shadow'])}
    <div data-d-live>${contrastTable(d)}${errList('theme', 'active', d)}</div>
    <div class="stack" data-cms-sample style="${esc(sample)};background:var(--bg);padding:var(--sp-4);border-radius:var(--r);font-family:var(--font-body)"><div style="background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:var(--sp-4);box-shadow:var(--shadow-1)"><b style="font-family:var(--font-display);color:var(--text)">כרטיס לדוגמה</b><p style="color:var(--muted);margin:4px 0">טקסט משני לדוגמה</p><span style="background:var(--accent);color:var(--accent-ink);border-radius:var(--r-sm);padding:6px 12px;display:inline-block;min-height:var(--tap);line-height:calc(var(--tap) - 12px)">כפתור ראשי</span></div></div>
    ${actions('theme', 'active', valid, 'העיצוב')}
    <div class="btns">${canEdit() ? btn('dSavePreset', 'שמירה כערכה בשם…') : ''}${canEdit() ? btn('dAllReset', 'איפוס כל הערכים בטיוטה', '', 'ghost') : ''}</div>
    ${presets.length ? `<h4>ערכות שמורות</h4><div class="list" data-cms-presets>${presets.map(p => `<div class="li"><div class="grow"><div class="t">${esc(p.data.name)}</div><div class="s">${Object.keys(p.data.tokens || {}).length} ערכים</div></div>${canEdit() ? btn('dUsePreset', 'טעינה לעריכה', `data-id="${p.item_id}"`) : ''}</div>`).join('')}</div>` : ''}</section>
    <section class="card">${frame('#/')}</section>`;
}
function contrastTable(d) { const m = C.themeMerged(d.tokens), PAIRS = [['--text', '--bg', 4.5], ['--text', '--surface', 4.5], ['--muted', '--surface', 4.5], ['--faint', '--surface', 4.5], ['--accent-ink', '--accent', 4.5], ['--accent', '--surface', 3], ['--line-control', '--surface', 3], ['--bad', '--surface-3', 4.5]];
  return `<div class="list" data-cms-contrast>${PAIRS.map(([a, b, min]) => { const r = Math.round(C.contrast(m[a], m[b]) * 10) / 10; return `<div class="row between small" data-pair="${a}|${b}"><span>${esc(tokHe(a))} על ${esc(tokHe(b))}</span><span class="pill ${r >= min ? 'good' : 'warn'}">${r}:1 ${r >= min ? '✓' : `(נדרש ${min})`}</span></div>`; }).join('')}</div>`; }
function readTheme(v) { const d = themeData(); const nm = v.querySelector('#ap-dname'); if (nm) d.name = nm.value.trim();
  v.querySelectorAll('[data-tok]').forEach(x => { const k = x.dataset.tok, t = C.TOKENS.find(y => y[0] === k); let val = x.value; if (x.dataset.px != null) val = (parseInt(val, 10) || 0) + 'px';
    if (String(val) === String(t[3]) || (t[1] === 'color' && val.toLowerCase() === t[3].toLowerCase())) delete d.tokens[k]; else d.tokens[k] = val; }); return d; }

/* ════════ 4. app settings ════════ */
const MOD_HE = { fridge: 'מה יש במקרר', shopping: 'רשימת קניות', nearby: 'אוכל בקרבתי', travel: 'מצב נסיעה', coach: 'מסך המאמן Sofit', programs: 'מסלולים מוכנים', feedback: 'משוב ודיווח תקלות' };
function cfgData() { if (!S.cfg) { const w = working('config', 'app'); S.cfg = w ? JSON.parse(JSON.stringify(w)) : { off: [], defaults: {}, notice: null }; } return S.cfg; }
function settings() {
  const d = cfgData(), dis = canEdit() ? '' : 'disabled', valid = !A.problems('config', 'app', d).length, def = d.defaults || {};
  setPreview([{ kind: 'config', item_id: 'app', status: 'published', version: 0, data: d }]);
  const TIMING = [['מיידי בפתיחה הבאה עם חיבור (בלי עדכון גרסה)', 'מודולים, ברירות מחדל, הודעה למשתמשים, טקסטים, פריסה, עיצוב, מתכונים, תרגילים'], ['דורש בנייה ועדכון גרסה', 'נוסחת היעדים, גבולות המנות, מאגר המזונות, איורי תנועה, לוגו ואייקון, מסכים חדשים'], ['דורש שירות חיצוני או אפליקציה נייטיב — לא פעיל', 'העלאת מדיה (Storage), Apple Health / Health Connect, מאמן AI, תשלומים ומנויים, התראות push']];
  return `<section class="card stack" data-cms-settings><h3>הגדרות אפליקציה</h3><p class="small muted">הגדרות שהאפליקציה תומכת בהן בבטחה. אף הגדרה כאן לא עוקפת התחברות, הרשאות או בדיקות תזונה.</p>
    <fieldset class="stack" data-cms-modules><legend>מודולים</legend>${Object.keys(C.MODULES).map(k => `<label class="switch"><span>${esc(MOD_HE[k] || k)}</span><input type="checkbox" data-mod="${k}" ${(d.off || []).includes(k) ? '' : 'checked'} ${dis}></label>`).join('')}
      <p class="tiny muted">כיבוי מסתיר את הקישורים למודול, והמסך עצמו מציג "האזור כבוי". נתוני המשתמשים לא נמחקים.</p></fieldset>
    <fieldset class="stack"><legend>ברירות מחדל למשתמשים שלא בחרו בעצמם</legend>
      <label class="field">מספר ארוחות עיקריות ביום<select id="ap-cmeals" ${dis}><option value="">ללא שינוי (3)</option><option value="3" ${def.meals === 3 ? 'selected' : ''}>3</option><option value="2" ${def.meals === 2 ? 'selected' : ''}>2</option></select></label>
      <label class="field">ארוחה גמישה שבועית<select id="ap-cflex" ${dis}><option value="">ללא שינוי (פעילה)</option><option value="1" ${def.flex === true ? 'selected' : ''}>פעילה</option><option value="0" ${def.flex === false ? 'selected' : ''}>כבויה</option></select></label>
      <p class="tiny muted">חל רק על מי שלא קבע/ה זאת בעצמו/ה. תפריטים נבנים מחדש מהיום והלאה; ימים שעברו וארוחות שנרשמו לא משתנים. יעדי הקלוריות והחלבון לא מושפעים.</p></fieldset>
    <fieldset class="stack"><legend>הודעה למשתמשים (במסך הבית)</legend><label class="field">טקסט ההודעה (ריק = אין הודעה)<input id="ap-cnt" value="${esc((d.notice && d.notice.text) || '')}" maxlength="200" ${dis}></label>
      <label class="field">סוג<select id="ap-cnl" ${dis}><option value="info" ${(d.notice || {}).level !== 'warn' ? 'selected' : ''}>מידע</option><option value="warn" ${(d.notice || {}).level === 'warn' ? 'selected' : ''}>אזהרה</option></select></label></fieldset>
    ${errList('config', 'app', d)}${actions('config', 'app', valid, 'הגדרות האפליקציה')}
    <h4>מתי שינוי נכנס לתוקף</h4><div class="list" data-cms-timing>${TIMING.map(([a, b]) => `<div class="li"><div class="grow"><div class="t">${esc(a)}</div><div class="s">${esc(b)}</div></div></div>`).join('')}</div></section>
    <section class="card">${frame('#/')}</section>`;
}
function readCfg(v) { const d = cfgData(); d.off = [...v.querySelectorAll('[data-mod]')].filter(x => !x.checked).map(x => x.dataset.mod);
  const ml = v.querySelector('#ap-cmeals').value, fx = v.querySelector('#ap-cflex').value; d.defaults = {}; if (ml) d.defaults.meals = +ml; if (fx) d.defaults.flex = fx === '1';
  const t = v.querySelector('#ap-cnt').value.trim(); d.notice = t ? { text: t, level: v.querySelector('#ap-cnl').value } : null; return d; }

/* ════════ 5. audit log ════════ */
function audit() {
  if (!S.audit) { api('/rest/v1/rpc/cms_audit_list', { method: 'POST', body: { p_limit: 200 } }).then(r => { S.audit = r || []; root.App.render(); }, e => { st.err = A.errText(e); S.audit = []; root.App.render(); }); return '<section class="card"><p class="small muted">טוען…</p></section>'; }
  const AH = { publish: 'פרסום', archive: 'ארכוב / חזרה לברירת מחדל', restore: 'שחזור', rollback: 'חזרה לגרסה קודמת', grant: 'הענקת הרשאה', revoke: 'הסרת הרשאה' }, KH = Object.assign({ role: 'הרשאות' }, EXT.kindHe);
  const rows = S.audit.filter(x => !S.akind || x.kind === S.akind);
  return `<section class="card stack" data-cms-audit><h3>יומן שינויים</h3><p class="small muted">כל פרסום, ארכוב, שחזור ושינוי הרשאה — מי, מה ומתי. היומן נכתב בשרת ואי אפשר לערוך או למחוק אותו מכאן. שמירת טיוטה לא נרשמת ביומן.</p>
    <label class="field">סוג<select id="ap-ak"><option value="">הכול</option>${Object.entries(KH).map(([k, v]) => `<option value="${k}" ${S.akind === k ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label>
    <div class="list" data-cms-audit-list>${rows.map(x => `<div class="li"><div class="grow"><div class="t">${esc(AH[x.action] || x.action)} · ${esc(KH[x.kind] || x.kind)}${x.kind === 'role' ? '' : ' · ' + esc(x.item_id)}${x.version ? ' v' + x.version : ''}</div><div class="s">${esc(String(x.at).slice(0, 16).replace('T', ' '))} · <span class="ltr">${esc(x.actor_email || 'לא ידוע')}</span>${x.note ? ' · ' + esc(x.note) : ''}</div></div></div>`).join('') || '<p class="small muted">אין עדיין פעולות.</p>'}</div>${btn('auReload', 'רענון')}</section>`;
}

/* ── registration ── */
EXT.tabs.push(['texts', 'טקסטים', 'exercises'], ['layout', 'מסכים ופריסה', 'texts'], ['design', 'עיצוב', 'layout'], ['settings', 'הגדרות אפליקציה', 'design'], ['audit', 'יומן שינויים', 'roles']);
Object.assign(EXT.views, { texts, layout, design, settings, audit });
EXT.open.text = id => { st.tab = 'texts'; S.tsel = id; loadCat().then(() => root.App.render()); };
EXT.open.layout = id => { st.tab = 'layout'; S.lscreen = id; root.App.render(); };
EXT.open.theme = () => { st.tab = 'design'; S.theme = null; root.App.render(); };
EXT.open.config = () => { st.tab = 'settings'; S.cfg = null; root.App.render(); };
const DATA = { text: id => { const r = readText(); return r && r.e.id === id ? r.d : working('text', id); }, layout: id => layoutData(id), theme: () => readTheme(document.getElementById('view')), config: () => readCfg(document.getElementById('view')) };
const SHOW = { text: d => esc((d.he || '') + (d.en ? ' / ' + d.en : '')), layout: d => esc('סדר: ' + (d.order || []).join(' › ') + ((d.hidden || []).length ? ' · מוסתר: ' + d.hidden.join(', ') : '')),
  theme: d => esc(`${d.name || ''} · ${Object.keys(d.tokens || {}).length} ערכים`), config: d => esc(`כבוי: ${(d.off || []).map(k => MOD_HE[k]).join(', ') || 'אין'}${d.notice ? ' · הודעה: ' + d.notice.text : ''}`) };
function diffFor(kind, id, d) { const p = live(kind, id);
  if (kind === 'text') return `<h4>שינוי טקסט</h4><div class="slot small"><div><b>מקור:</b> ${esc(d.orig)}</div><div><b>נוסח פעיל עכשיו:</b> ${esc((p && p.he) || d.orig)}</div><div><b>נוסח חדש:</b> ${esc(d.he || d.orig)}</div>${d.en ? `<div class="ltr"><b>EN:</b> ${esc(d.en)}</div>` : ''}</div>`;
  if (kind === 'theme') { const m0 = C.themeMerged(p && p.tokens), m1 = C.themeMerged(d.tokens), ch = C.TOKENS.filter(t => String(m0[t[0]]) !== String(m1[t[0]]));
    return `<h4>מה משתנה (${ch.length} ערכים)</h4><div class="list">${ch.map(t => `<div class="row between small"><span>${esc(t[2])}</span><span class="ltr">${esc(m0[t[0]])} → ${esc(m1[t[0]])}</span></div>`).join('') || '<p class="small muted">אין שינוי.</p>'}</div>`; }
  return `<h4>מה משתנה</h4><div class="slot small"><div><b>עכשיו:</b> ${p ? SHOW[kind](p) : 'ברירת המחדל של האפליקציה'}</div><div><b>אחרי:</b> ${SHOW[kind](d)}</div></div>`; }
Object.assign(A.H, {
  apSave: async el => { const kind = el.dataset.k, id = el.dataset.id, d = DATA[kind](id); if (!d) return;
    try { await saveDraft(kind, id, d); if (kind === 'layout') delete S.ldraft[id]; st.err = null; root.UI.toast('הטיוטה נשמרה בשרת. משתמשים עדיין לא רואים אותה.'); } catch (er) { st.err = A.errText(er); } root.App.render(); },
  apPub: el => { const kind = el.dataset.k, id = el.dataset.id, d = (st.drafts[key(kind, id)] || {}).data; if (!d) return; publishSheet(kind, id, diffFor(kind, id, d), kind === 'config' && (d.defaults || {}).meals ? '<p class="small warn">שינוי מספר הארוחות בונה מחדש את התפריטים מהיום והלאה למי שלא בחר בעצמו.</p>' : ''); },
  apHist: el => historySheet(el.dataset.k, el.dataset.id, SHOW[el.dataset.k]),
  apReset: el => resetSheet(el.dataset.k, el.dataset.id, el.dataset.what || 'הפריט'),
  apDrop: async el => { const kind = el.dataset.k, id = el.dataset.id; try { await api(`/rest/v1/cms_drafts?kind=eq.${kind}&item_id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' }); delete st.drafts[key(kind, id)]; if (kind === 'theme') S.theme = null; if (kind === 'config') S.cfg = null; delete S.ldraft[id]; root.UI.toast('הטיוטה נמחקה'); } catch (er) { st.err = A.errText(er); } root.App.render(); },
  pvSize: el => { S.pv = el.dataset.v; root.App.render(); },
  tOpen: el => { S.tsel = el.dataset.id; root.App.render(); const x = document.querySelector('[data-cms-teditor]'); if (x) x.scrollIntoView({ block: 'start' }); },
  tClose: () => { S.tsel = null; root.App.render(); },
  tPage: el => { S.tpage += +el.dataset.d; root.App.render(); },
  tBulk: () => { const b = S.bulk; if (!b || b.find.length < 2) return; const hits = CAT.filter(e => e.s.includes(b.find)).slice(0, 50).map(e => ({ e, d: { orig: e.s, he: e.s.split(b.find).join(b.rep), en: (tRow(e.id) || {}).en || '' } }));
    const bad = hits.filter(h => A.problems('text', h.e.id, h.d).length);
    root.UI.sheet('יצירת טיוטות', `<div class="stack"><p class="small">${hits.length - bad.length} טיוטות ייווצרו.${bad.length ? ` ${bad.length} דולגו כי ההחלפה שוברת מספרים או משתנים.` : ''} שום דבר לא מתפרסם עד אישור.</p><button class="btn primary" data-act="go">יצירה</button></div>`, {
      go: async (x, ev, close) => { close(); let n = 0; try { for (const h of hits) { if (A.problems('text', h.e.id, h.d).length) continue; await saveDraft('text', h.e.id, h.d, 'החלפה: ' + b.find); n++; } root.UI.toast(`נוצרו ${n} טיוטות`); } catch (er) { st.err = A.errText(er) + ` (נוצרו ${n} לפני השגיאה)`; } root.App.render(); } }); },
  tPubAll: () => { const ds = Object.values(st.drafts).filter(x => x.kind === 'text');
    root.UI.sheet('פרסום טיוטות טקסט', `<div class="stack"><p class="small">${ds.length} שינויי טקסט יפורסמו לכל המשתמשים. כל אחד נשמר בהיסטוריה וניתן לשחזור.</p><label class="switch"><span>בדקתי ואני מאשר/ת</span><input type="checkbox" id="pa-ok"></label><button class="btn primary" data-act="go">פרסום</button></div>`, {
      go: async (x, ev, close) => { if (!document.getElementById('pa-ok').checked) { root.UI.toast('צריך לסמן אישור'); return; } close(); let n = 0;
        try { for (const d of ds) { if (A.problems('text', d.item_id, d.data).length) continue; await api('/rest/v1/rpc/cms_publish', { method: 'POST', body: { p_kind: 'text', p_item: d.item_id } }); n++; } await after(`פורסמו ${n} טקסטים`); } catch (er) { st.err = A.errText(er) + ` (פורסמו ${n} לפני השגיאה)`; await A.load(); root.App.render(); } } }); },
  lMove: el => { const sc = S.lscreen, d = layoutData(sc), i = d.order.indexOf(el.dataset.id), j = i + +el.dataset.d; if (j < 0 || j >= d.order.length) return; [d.order[i], d.order[j]] = [d.order[j], d.order[i]]; S.ldraft[sc] = d; root.App.render(); const b = document.querySelector(`[data-act=lMove][data-id="${el.dataset.id}"][data-d="${el.dataset.d}"]`); if (b && !b.disabled) b.focus(); },
  dTokReset: el => { const d = themeData(); readTheme(document.getElementById('view')); delete d.tokens[el.dataset.t]; root.App.render(); },
  dAllReset: () => { const d = themeData(); d.tokens = {}; root.App.render(); },
  dUsePreset: el => { const p = st.content[key('theme', el.dataset.id)]; if (!p) return; S.theme = { name: p.data.name, tokens: JSON.parse(JSON.stringify(p.data.tokens || {})) }; root.UI.toast('הערכה נטענה לעריכה — שמרו טיוטה ופרסמו כדי להחיל'); root.App.render(); },
  dSavePreset: () => { const d = readTheme(document.getElementById('view')); root.UI.sheet('שמירה כערכה', `<div class="stack"><label class="field">מזהה הערכה (לטינית קטנה, ספרות וקו תחתון)<input id="ps-id" class="ltr" value="${esc((d.name || '').toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '') || 'my_theme')}"></label><p class="tiny muted">הערכה נשמרת כטיוטה ופורסמת כמו כל תוכן. היא לא מוחלת על האפליקציה — רק "העיצוב הפעיל" מוחל.</p><button class="btn primary" data-act="go">שמירת טיוטה</button></div>`, {
    go: async (x, ev, close, b) => { const id = 'preset_' + b.querySelector('#ps-id').value.trim(); if (A.problems('theme', id, d).length) { root.UI.toast(A.problems('theme', id, d)[0]); return; } try { await saveDraft('theme', id, JSON.parse(JSON.stringify(d))); close(); root.UI.toast('הערכה נשמרה כטיוטה'); } catch (er) { close(); st.err = A.errText(er); } root.App.render(); } }); },
  auReload: () => { S.audit = null; root.App.render(); }
});
EXT.after.push(v => {
  const on = (sel, ev, fn) => v.querySelectorAll(sel).forEach(x => x.addEventListener(ev, fn));
  if (st.tab === 'texts') {
    on('#ap-tq', 'input', ev => { S.tq = ev.target.value; S.tpage = 0; clearTimeout(on.t); on.t = setTimeout(() => { root.App.render(); const x = document.getElementById('ap-tq'); if (x) { x.focus(); x.setSelectionRange(x.value.length, x.value.length); } }, 250); });
    on('#ap-tarea', 'change', ev => { S.tarea = ev.target.value; S.tpage = 0; root.App.render(); }); on('#ap-tst', 'change', ev => { S.tst = ev.target.value; S.tpage = 0; root.App.render(); });
    const upd = () => { const r = readText(); if (!r) return; const box = v.querySelector('[data-t-live]'), af = v.querySelector('[data-t-after]'), pb = v.querySelector('[data-act=apPub]'); if (box) box.innerHTML = errList('text', r.e.id, r.d); if (af) af.textContent = r.d.he || r.e.s; if (pb) pb.disabled = !st.drafts[key('text', r.e.id)] || !!A.problems('text', r.e.id, r.d).length;
      setPreview([{ kind: 'text', item_id: r.e.id, status: 'published', version: 0, data: r.d }]); };
    on('#ap-the', 'input', upd); on('#ap-ten', 'input', upd);
    const bu = () => { S.bulk = { find: (v.querySelector('#ap-bf') || {}).value || '', rep: (v.querySelector('#ap-br') || {}).value || '' }; clearTimeout(on.b); on.b = setTimeout(() => { const f = document.activeElement && document.activeElement.id; root.App.render(); const x = f && document.getElementById(f); if (x) { x.focus(); x.setSelectionRange(x.value.length, x.value.length); } }, 300); };
    on('#ap-bf', 'input', bu); on('#ap-br', 'input', bu);
  }
  if (st.tab === 'layout') { on('#ap-ls', 'change', ev => { S.lscreen = ev.target.value; root.App.render(); });
    const rd = () => { const sc = S.lscreen, d = layoutData(sc); v.querySelectorAll('[data-show]').forEach(x => { const id = x.dataset.show; d.hidden = d.hidden.filter(h => h !== id); if (!x.checked) d.hidden.push(id); });
      v.querySelectorAll('[data-sp]').forEach(x => { d.space[x.dataset.sp] = x.value; }); v.querySelectorAll('[data-al]').forEach(x => { d.align[x.dataset.al] = x.value; }); S.ldraft[sc] = d; root.App.render(); };
    on('[data-show]', 'change', rd); on('[data-sp]', 'change', rd); on('[data-al]', 'change', rd); }
  if (st.tab === 'design') { const rd = ev => { const x = ev.target; if (x.dataset.tokx) { const c = v.querySelector(`input[type=color][data-tok="${x.dataset.tokx}"]`); if (/^#[0-9a-fA-F]{6}$/.test(x.value) && c) c.value = x.value; else return; }
      if (x.type === 'color') { const t = v.querySelector(`[data-tokx="${x.dataset.tok}"]`); if (t) t.value = x.value; }
      const d = readTheme(v), box = v.querySelector('[data-d-live]'); if (box) box.innerHTML = contrastTable(d) + errList('theme', 'active', d);
      const sm = v.querySelector('[data-cms-sample]'); if (sm) Object.entries(C.themeMerged(d.tokens)).forEach(([k, val]) => { const t = C.TOKENS.find(y => y[0] === k); sm.style.setProperty(k, t[1] === 'font' ? C.FONTS[val] : t[1] === 'shadow' ? C.SHADOWS[val] : val); });
      const pb = v.querySelector('[data-act=apPub]'); if (pb) pb.disabled = !st.drafts[key('theme', 'active')] || !!A.problems('theme', 'active', d).length;
      setPreview([{ kind: 'theme', item_id: 'active', status: 'published', version: 0, data: d }]); };
    on('[data-tok]', 'input', rd); on('[data-tok]', 'change', rd); on('[data-tokx]', 'input', rd); on('#ap-dname', 'input', () => readTheme(v)); }
  if (st.tab === 'settings') { const rd = () => { const d = readCfg(v); setPreview([{ kind: 'config', item_id: 'app', status: 'published', version: 0, data: d }]); const box = v.querySelector('[data-cms-valid]'); if (box) box.outerHTML = errList('config', 'app', d); };
    on('[data-mod]', 'change', rd); on('#ap-cmeals', 'change', rd); on('#ap-cflex', 'change', rd); on('#ap-cnt', 'input', rd); on('#ap-cnl', 'change', rd); }
  if (st.tab === 'audit') on('#ap-ak', 'change', ev => { S.akind = ev.target.value; root.App.render(); });
  if (!['layout', 'design', 'settings', 'texts'].includes(st.tab)) setPreview([]);
});
root.AdminApp = { texts: () => CAT, loadCat, setPreview, saveDraft, layoutData, themeData, cfgData };
})(typeof window !== 'undefined' ? window : globalThis);
