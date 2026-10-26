/* Workout Builder screens (on-demand chunk extra.js): #/builder (saved workouts + history), #/builder/new (choices → suggestion →
   edit → save), #/builder/<id> (a saved workout: edit, substitute, reorder, start, duplicate, revert, delete). Logic: builder.js.
   Every number shown as time is labelled as an estimate (computed from the runner's own steps), never as a measured duration. */
(function (root) {
'use strict';
const { esc, icon } = root.UI; const S = root.Store, Screens = root.Screens, B = () => root.Builder, CT = () => root.CATALOG;
const DK = 'fit30.builderDraft';
const st = Screens._builder = Screens._builder || { form: null, draft: null, err: null };
const keepDraft = () => { try { if (st.draft) localStorage.setItem(DK, JSON.stringify(st.draft)); else localStorage.removeItem(DK); } catch (e) { } };
try { if (!st.draft) { const d = JSON.parse(localStorage.getItem(DK) || 'null'); if (d && Array.isArray(d.main)) st.draft = d; } } catch (e) { }
const exName = id => (root.EX_BY_ID[id] || {}).he || id;
const dose = it => `${it.sets} × ${it.reps ? it.reps + ' חזרות' : it.sec ? it.sec + ' שנ׳' : '—'}${it.side ? ' לכל צד' : ''}${it.rest ? ' · מנוחה ' + it.rest + ' שנ׳' : ''}`;
const eqHe = k => (CT().EQUIPMENT[k] || {}).he || k;

function listScreen() {
  const ws = B().list(), hist = B().history().slice(0, 8);
  return { title: 'בניית אימון', back: '#/workouts', html: `
    <section class="card stack" data-builder-list><div class="row between"><h2>האימונים שבניתי</h2><a class="btn primary sm" href="#/builder/new" data-builder-new>${icon('plus')} אימון חדש</a></div>
      <p class="small muted">בונים אימון לפי מטרה, זמן, ציוד ורמה, עורכים ושומרים, ומתחילים אותו במצב אימון הרגיל. האימונים נשמרים במכשיר ונכללים בגיבוי (ובסנכרון, אם הוא מופעל).</p>
      ${ws.length ? `<div class="list">${ws.map(w => `<a class="li" href="#/builder/${esc(w.id)}" data-builder-item="${esc(w.id)}"><div class="grow"><div class="t">${w.fav ? '★ ' : ''}${esc(w.name)}</div><div class="s">${esc(B().GOALS[w.params.goal] || '')} · ~${B().minutes(w)} דק׳ (הערכה) · ${w.main.length} תרגילים</div></div>${icon('chev', 'chev')}</a>`).join('')}</div>`
        : `<p class="empty" data-builder-empty>עוד לא שמרת אימון. "אימון חדש" יציע אימון לפי מה שתבחרו, ואפשר לשנות בו כל דבר.</p>`}</section>
    ${hist.length ? `<section class="card stack" data-builder-history><h3>אימונים שבוצעו</h3><div class="list">${hist.map(r => `<div class="li"><div class="grow"><div class="t">${esc((r.snapshot && r.snapshot.name) || 'אימון')}</div><div class="s">${esc(S.fmtDate(r.date))} · ${r.status === 'partial' ? 'חלקי' : 'הושלם'} · ${Math.round((r.durationSec || 0) / 60)} דק׳ בפועל${r.snapshot ? ' · ' + r.snapshot.main.length + ' תרגילים' : ''}</div></div></div>`).join('')}</div><p class="tiny faint">כל אימון שבוצע נשמר כפי שבוצע — עריכה או מחיקה של האימון לא משנים את ההיסטוריה.</p></section>` : ''}`, handlers: {} };
}
/* SLL-19 + SLL-01 · "לפי ההרגשה" — readiness, desired feel and place in one step, mapped transparently onto the builder's EXISTING
   choices (goal, minutes, level, equipment, no-jump); the full form below stays editable before "הצעת אימון", and "לבנות עכשיו"
   does it in one tap. Mapping (shown on screen):
     energy  low → 15 min and one level easier · ok → minutes from the profile · high → +15 min (max 60), same level
     feel    להירגע → mobility · להזיע → endurance · להתחזק → strength · כללי → general
     place   בבית בלי ציוד → no equipment · עם הציוד שלי → the profile's equipment · חדר במלון → no equipment + no jumping
   Nothing is inferred about health; "low energy" never raises load. */
const FEEL = { energy: [['low', 'אנרגיה נמוכה'], ['ok', 'רגילה'], ['high', 'גבוהה']], feel: [['calm', 'להירגע'], ['sweat', 'להזיע'], ['strong', 'להתחזק'], ['any', 'כללי']], place: [['home', 'בבית בלי ציוד'], ['mine', 'עם הציוד שלי'], ['hotel', 'חדר במלון']] };
const FEEL_GOAL = { calm: 'mobility', sweat: 'endurance', strong: 'strength', any: 'general' }, LVL_DOWN = { advanced: 'intermediate', intermediate: 'beginner', beginner: 'beginner' };
function feelParams(sel) { const base = B().fromProfile(), pr = S.load('profile'), out = {};
  if (sel.feel) out.goal = FEEL_GOAL[sel.feel];
  if (sel.energy === 'low') { out.minutes = 15; out.level = LVL_DOWN[base.level || 'beginner']; } else if (sel.energy === 'high') { out.minutes = Math.min(60, (base.minutes || 30) + 15); out.level = base.level; } else if (sel.energy === 'ok') { out.minutes = base.minutes; out.level = base.level; }
  if (sel.place === 'home') { out.equipment = []; } else if (sel.place === 'mine') { out.equipment = ((pr.environment || {}).equipment || []).slice(); } else if (sel.place === 'hotel') { out.equipment = []; out.noJump = true; }
  return out; }
function feelCard(f) { const sel = st.feel = st.feel || {}, chip = (q, k, v) => `<button class="chip" data-act="feel" data-q="${q}" data-v="${k}" aria-pressed="${sel[q] === k}">${esc(v)}</button>`, ready = sel.energy && sel.feel && sel.place;
  return `<section class="card stack" data-feel><h3>לפי ההרגשה <span class="tiny muted">(בחירה מהירה)</span></h3>
    ${Object.entries(FEEL).map(([q, opts]) => `<div class="chips" data-feel-q="${q}">${opts.map(([k, v]) => chip(q, k, v)).join('')}</div>`).join('')}
    ${ready ? `<p class="small" data-feel-map>${(() => { const p = feelParams(sel); return `מטרה: ${esc(B().GOALS[p.goal])} · ${p.minutes} דק׳${p.level ? ' · רמה: ' + esc(B().LEVELS[p.level]) : ''} · ${p.equipment.length ? 'עם ' + p.equipment.map(eqHe).join(', ') : 'בלי ציוד'}${p.noJump ? ' · בלי קפיצות' : ''}`; })()}</p>
      <div class="btns"><button class="btn primary" data-act="feelGo">לבנות עכשיו</button><button class="btn" data-act="feelFill">למלא את הטופס ולערוך</button></div>` : '<p class="tiny muted">בוחרים אנרגיה, מה בא לך ואיפה — והאימון נבנה מהבחירות הקיימות למטה. אנרגיה נמוכה אף פעם לא מעלה עומס.</p>'}</section>`; }
function formScreen() {
  const f = st.form = st.form || Object.assign(B().fromProfile(), { name: '' }), pr = S.load('profile');
  const chip = (k, v, sel, act) => `<button class="chip" data-act="${act}" data-v="${k}" aria-pressed="${sel}">${esc(v)}</button>`;
  const exOpts = sel => root.EXERCISES.slice().sort((a, b) => a.he.localeCompare(b.he, 'he')).map(e => `<option value="${e.id}" ${sel === e.id ? 'selected' : ''}>${esc(e.he)}</option>`).join('');
  return { title: 'אימון חדש', back: '#/builder', html: `${feelCard(f)}<section class="card stack" data-builder-form>
    <fieldset class="stack"><legend>מטרה</legend><div class="chips">${Object.entries(B().GOALS).map(([k, v]) => chip(k, v, f.goal === k, 'fGoal')).join('')}</div></fieldset>
    <fieldset class="stack"><legend>זמן זמין</legend><div class="chips">${B().MINUTES.map(m => chip(m, m + ' דק׳', f.minutes === m, 'fMin')).join('')}</div>
      <label class="field">או זמן אחר (10–90 דק׳)<input id="bf-min" type="number" inputmode="numeric" min="10" max="90" value="${f.minutes}"></label></fieldset>
    <label class="field">רמת ניסיון<select id="bf-lvl"><option value="">לא הוגדרה (יוצעו תרגילים בסיסיים)</option>${Object.entries(B().LEVELS).map(([k, v]) => `<option value="${k}" ${f.level === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    <fieldset class="stack"><legend>ציוד זמין <span class="tiny faint">(בלי סימון = אימון בלי ציוד)</span></legend><div class="chips">${Object.keys(CT().EQUIPMENT).filter(k => !['none', 'gym', 'outdoor'].includes(k)).map(k => chip(k, eqHe(k), f.equipment.includes(k), 'fEq')).join('')}</div></fieldset>
    <fieldset class="stack"><legend>קבוצות שרירים להדגיש <span class="tiny faint">(עד 3, רשות)</span></legend><div class="chips">${Object.entries(B().FOCUS).map(([k, v]) => chip(k, v, f.focus.includes(k), 'fFocus')).join('')}</div></fieldset>
    <label class="field">כמה אימונים בשבוע <span class="tiny faint">(לעצה על חלוקה, רשות)</span><input id="bf-pw" type="number" inputmode="numeric" min="1" max="7" value="${f.perWeek || ''}"></label>
    <label class="switch"><span>בלי קפיצות</span><input type="checkbox" id="bf-nj" ${f.noJump ? 'checked' : ''}></label>
    <fieldset class="stack"><legend>תרגילים מועדפים</legend><div class="chips" data-bf-fav>${f.fav.map(id => `<button class="chip" data-act="fUnFav" data-v="${id}" aria-label="הסרת ${esc(exName(id))} מהמועדפים">${esc(exName(id))} ✕</button>`).join('') || '<span class="tiny muted">אין</span>'}</div>
      <div class="row"><select id="bf-favsel" aria-label="הוספת תרגיל מועדף"><option value="">בחירת תרגיל…</option>${exOpts('')}</select><button class="btn sm" data-act="fAddFav">הוספה</button></div></fieldset>
    <fieldset class="stack"><legend>תרגילים שלא מתאימים לי <span class="tiny faint">(לא יוצעו בכלל)</span></legend><div class="chips" data-bf-ex>${f.exclude.map(id => `<button class="chip" data-act="fUnEx" data-v="${id}" aria-label="הסרת ${esc(exName(id))} מהרשימה">${esc(exName(id))} ✕</button>`).join('') || '<span class="tiny muted">אין</span>'}</div>
      <div class="row"><select id="bf-exsel" aria-label="הוספת תרגיל לא מתאים"><option value="">בחירת תרגיל…</option>${exOpts('')}</select><button class="btn sm" data-act="fAddEx">הוספה</button></div></fieldset>
    <p class="tiny muted">הערכים מולאו מהפרופיל שלך כשהם קיימים (${pr.experience ? 'רמה' : 'בלי רמה'}, ${(pr.environment || {}).equipment && pr.environment.equipment.length ? 'ציוד' : 'בלי ציוד'}). שום מידע רפואי לא נדרש ולא מוסק.</p>
    <button class="btn primary big" data-act="fGen">הצעת אימון</button></section>`,
    handlers: Object.assign(formHandlers(), {}), after: v => { const n = v.querySelector('#bf-min'); if (n) n.addEventListener('change', () => { f.minutes = B().normParams({ minutes: n.value }).minutes; root.App.render(); }); } };
}
function readForm() { const f = st.form, v = id => document.getElementById(id); if (!f) return;
  if (v('bf-lvl')) f.level = v('bf-lvl').value || null; if (v('bf-pw')) f.perWeek = +v('bf-pw').value || null; if (v('bf-nj')) f.noJump = v('bf-nj').checked; }
function formHandlers() {
  const f = () => st.form, tog = (k, v, max) => { const a = f()[k], i = a.indexOf(v); if (i >= 0) a.splice(i, 1); else if (!max || a.length < max) a.push(v); else root.UI.toast(`אפשר לבחור עד ${max}`); };
  return {
    fGoal: el => { readForm(); f().goal = el.dataset.v; root.App.render(); }, fMin: el => { readForm(); f().minutes = +el.dataset.v; root.App.render(); },
    fEq: el => { readForm(); tog('equipment', el.dataset.v); root.App.render(); }, fFocus: el => { readForm(); tog('focus', el.dataset.v, 3); root.App.render(); },
    fAddFav: () => { readForm(); const x = document.getElementById('bf-favsel').value; if (x && !f().fav.includes(x)) { f().fav.push(x); f().exclude = f().exclude.filter(y => y !== x); } root.App.render(); },
    fUnFav: el => { readForm(); f().fav = f().fav.filter(x => x !== el.dataset.v); root.App.render(); },
    fAddEx: () => { readForm(); const x = document.getElementById('bf-exsel').value; if (x && !f().exclude.includes(x)) { f().exclude.push(x); f().fav = f().fav.filter(y => y !== x); } root.App.render(); },
    fUnEx: el => { readForm(); f().exclude = f().exclude.filter(x => x !== el.dataset.v); root.App.render(); },
    feel: el => { const s = st.feel = st.feel || {}; s[el.dataset.q] = s[el.dataset.q] === el.dataset.v ? undefined : el.dataset.v; root.App.render(); },
    feelFill: () => { readForm(); Object.assign(f(), feelParams(st.feel || {})); root.App.render(); root.UI.toast('הטופס מולא לפי הבחירה — אפשר לשנות כל דבר'); },
    feelGo: () => { readForm(); Object.assign(f(), feelParams(st.feel || {})); formHandlers().fGen(null, null, true); },
    fGen: (el, e, fromFeel) => { if (!fromFeel) readForm(); /* the quick choice already set the params; re-reading the on-screen form would undo them */ const g = B().generate(f()); st.draft = { id: null, name: (B().GOALS[g.params.goal] || 'אימון') + ' · ' + g.params.minutes + ' דק׳', params: g.params, warm: g.warm, main: g.main, cool: g.cool, notes: g.notes, original: null };
      keepDraft(); location.hash = '#/builder/draft'; }
  };
}
/* editor: a draft (new) or a working copy of a saved workout */
function editor(id) {
  if (id !== 'draft' && (!st.draft || st.draft.id !== id)) { const w = B().get(id); if (!w) return { title: 'בניית אימון', back: '#/builder', html: `<div class="banner warn">${icon('info')}<div>האימון לא נמצא (אולי נמחק). אימונים שכבר בוצעו נשמרו בהיסטוריה.</div></div><a class="btn" href="#/builder">לרשימה</a>`, handlers: {} };
    st.draft = JSON.parse(JSON.stringify(w)); keepDraft(); }
  const d = st.draft; if (!d) { location.hash = '#/builder/new'; return { title: 'בניית אימון', back: '#/builder', html: '', handlers: {} }; }
  const saved = d.id && B().get(d.id), dirty = saved && JSON.stringify(['name', 'warm', 'main', 'cool'].map(k => saved[k])) !== JSON.stringify(['name', 'warm', 'main', 'cool'].map(k => d[k]));
  const errs = B().validate(d), chk = B().check(d), br = B().breakdown(d), mins = B().minutes(d), p = d.params, pw = p.perWeek;
  const issues = (chk.issues || []).map(x => `<li data-issue="${x.kind}" class="${x.sev === 'block' ? 'warn' : ''}">${esc(x.text)}${x.why ? ' — ' + esc(x.why) : ''}</li>`).join('');
  const row = (it, i, ph) => `<div class="li stack tight" data-bi="${ph}:${i}"><div class="row between"><div class="grow"><b>${esc(exName(it.ex))}</b> <span class="tiny muted">${esc(dose(it))}</span></div>
      ${ph === 'main' ? `<button class="icon-btn" data-act="bMove" data-i="${i}" data-d="-1" aria-label="הזזה למעלה: ${esc(exName(it.ex))}" ${i === 0 ? 'disabled' : ''}>▲</button><button class="icon-btn" data-act="bMove" data-i="${i}" data-d="1" aria-label="הזזה למטה: ${esc(exName(it.ex))}" ${i === d.main.length - 1 ? 'disabled' : ''}>▼</button>` : ''}</div>
    ${ph === 'main' ? `<div class="row wrap tiny"><label>סטים <input type="number" min="1" max="8" data-bf="sets" data-i="${i}" value="${it.sets}" style="width:4.2em"></label>${it.reps != null ? `<label>חזרות <input type="number" min="1" max="50" data-bf="reps" data-i="${i}" value="${it.reps}" style="width:4.2em"></label>` : `<label>שניות <input type="number" min="5" max="600" data-bf="sec" data-i="${i}" value="${it.sec}" style="width:4.8em"></label>`}<label>מנוחה <input type="number" min="0" max="300" data-bf="rest" data-i="${i}" value="${it.rest || 0}" style="width:4.8em"></label></div>` : ''}
    ${it.why ? `<details class="tiny"><summary>למה התרגיל הזה?</summary><p class="muted" data-why>${esc(it.why)}</p></details>` : ''}
    <div class="btns">${ph === 'main' ? `<button class="btn sm" data-act="bAlt" data-ph="${ph}" data-i="${i}">החלפה</button><button class="btn sm ghost" data-act="bDel" data-i="${i}">הסרה</button>` : `<button class="btn sm ghost" data-act="bAlt" data-ph="${ph}" data-i="${i}">החלפה</button>`}<a class="btn sm ghost" href="#/ex/${it.ex}">הוראות</a></div></div>`;
  return { title: saved ? saved.name : 'אימון חדש', back: '#/builder', html: `
    <section class="card stack" data-builder-editor><label class="field">שם האימון<input id="be-name" value="${esc(d.name || '')}" maxlength="60"></label>
      <div class="kv" data-builder-time><span>משך משוער: <b>~${mins} דק׳</b> <span class="tiny faint">(הערכה)</span></span><span>זמן שבחרת: ${p.minutes} דק׳</span><span>${esc(B().GOALS[p.goal])}</span><span>${p.level ? esc(B().LEVELS[p.level]) : 'רמה לא הוגדרה'}</span></div>
      <details class="tiny"><summary>איך חושב המשך?</summary><p class="muted">חימום ${br.warm} · עבודה ${br.work} · מנוחות ${br.rest} · מעברים ${br.trans} · שחרור ${br.cool} דק׳. מחושב מהשלבים שמצב האימון ינגן (חזרות × 3.5 שנ׳, החזקות, מנוחות ומעברים) — זו הערכה, לא מדידה.</p></details>
      <p class="tiny muted">ציוד: ${p.equipment.length ? esc(p.equipment.map(eqHe).join(', ')) : 'בלי ציוד'}${[...new Set(d.main.flatMap(it => CT().exMeta(it.ex).eq))].length ? ' · נדרש באימון: ' + esc([...new Set(d.main.flatMap(it => CT().exMeta(it.ex).eq))].map(eqHe).join(', ')) : ''}</p>
      ${(d.notes || []).length ? `<ul class="bul small" data-builder-notes>${d.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
      ${issues ? `<div class="banner warn small" data-builder-gate>${icon('info')}<div><b>בדיקת התאמה:</b><ul class="bul">${issues}</ul></div></div>` : `<div class="banner good small" data-builder-gate="ok">${icon('check')}<div>נבדק: מתאים לציוד, להחרגות ולזמן שבחרת.</div></div>`}
      ${pw && pw >= 4 && !p.focus.length ? `<p class="small" data-builder-split>עם ${pw} אימונים בשבוע כדאי לחלק בין קבוצות שרירים (למשל רגליים וליבה / דחיפה ומשיכה) ולא לחזור על אותו אימון גוף מלא יומיים ברצף. <button class="btn sm" data-act="bSplit">יצירת אימון משלים</button></p>` : ''}
      ${errs.length ? `<div class="banner bad small" data-builder-errs>${icon('info')}<div><ul class="bul">${errs.map(e => `<li>${esc(e)}</li>`).join('')}</ul></div></div>` : ''}</section>
    <section class="card stack"><h3>חימום</h3><div class="list">${d.warm.map((it, i) => row(it, i, 'warm')).join('') || '<p class="tiny muted">אין</p>'}</div></section>
    <section class="card stack" data-builder-main><h3>האימון (${d.main.length})</h3><div class="list">${d.main.map((it, i) => row(it, i, 'main')).join('') || '<p class="empty">אין תרגילים. הוסיפו תרגיל.</p>'}</div><button class="btn sm" data-act="bAdd">${icon('plus')} הוספת תרגיל</button></section>
    <section class="card stack"><h3>שחרור</h3><div class="list">${d.cool.map((it, i) => row(it, i, 'cool')).join('') || '<p class="tiny muted">אין</p>'}</div></section>
    <section class="card stack"><div class="btns"><button class="btn primary" data-act="bSave" ${errs.length ? 'disabled' : ''}>${saved ? (dirty ? 'שמירת השינויים' : 'נשמר ✓') : 'שמירה'}</button>
      <button class="btn" data-act="bStart" ${errs.length || chk.ok === false ? 'disabled' : ''}>${icon('play')} התחלה</button>${!saved ? `<button class="btn ghost" data-act="bAgain">הצעה אחרת</button>` : ''}</div>
      ${chk.ok === false ? '<p class="tiny warn">יש תרגיל שסותר הגדרה (ציוד או החרגה) — החליפו אותו לפני ההתחלה.</p>' : ''}
      ${saved ? `<div class="btns"><button class="btn sm ghost" data-act="bFav">${saved.fav ? '★ מועדף' : '☆ סימון כמועדף'}</button><button class="btn sm ghost" data-act="bDup">שכפול</button><button class="btn sm ghost" data-act="bRevert">חזרה לגרסה המקורית</button><button class="btn sm danger ghost" data-act="bDelW">מחיקה</button>${dirty ? '<button class="btn sm ghost" data-act="bDiscard">ביטול השינויים</button>' : ''}</div>
        ${B().history(saved.id).length ? `<p class="tiny muted" data-builder-runs>בוצע ${B().history(saved.id).length} פעמים (אחרון: ${esc(S.fmtDate(B().history(saved.id)[0].date))}).</p>` : ''}` : '<p class="tiny muted">שמרו את האימון כדי לחזור אליו, לסמן כמועדף ולשמור היסטוריה.</p>'}</section>`,
    handlers: editHandlers(), after: v => {
      const nm = v.querySelector('#be-name'); if (nm) nm.addEventListener('input', () => { d.name = nm.value; keepDraft(); });
      v.querySelectorAll('[data-bf]').forEach(x => x.addEventListener('change', () => { const it = d.main[+x.dataset.i]; if (!it) return; const val = Math.round(+x.value); it[x.dataset.bf] = isFinite(val) ? val : it[x.dataset.bf]; keepDraft(); root.App.render(); }));
    } };
}
function editHandlers() {
  const d = () => st.draft, re = () => { keepDraft(); root.App.render(); };
  return {
    bMove: el => { B().move(d(), +el.dataset.i, +el.dataset.d); re(); const b = document.querySelector(`[data-act=bMove][data-i="${+el.dataset.i + +el.dataset.d}"][data-d="${el.dataset.d}"]`); if (b && !b.disabled) b.focus(); },
    bDel: el => { const it = d().main[+el.dataset.i]; root.UI.confirmSheet('הסרת תרגיל', `להסיר את "${exName(it.ex)}" מהאימון?`, 'הסרה', () => { d().main.splice(+el.dataset.i, 1); re(); }, true); },
    bAlt: el => { const ph = el.dataset.ph, i = +el.dataset.i, a = B().alternatives(d(), ph, i), cur = d()[ph][i];
      root.UI.sheet('החלפת ' + exName(cur.ex), `<div class="stack" data-builder-alts>${a.list.length ? a.list.map(x => `<div class="li stack tight" data-alt="${x.id}"><div class="row between"><b>${esc(x.he)}</b><button class="btn sm primary" data-act="pick" data-v="${x.id}">בחירה</button></div><p class="tiny muted">${esc(x.why.join(' · '))}</p>${x.diffs.length ? `<p class="tiny">שינויים: ${esc(x.diffs.join(', '))}</p>` : '<p class="tiny">אותו מינון (סטים, חזרות ומנוחה).</p>'}</div>`).join('')
        : `<div class="banner info small" data-alt-none>${icon('info')}<div>${esc(a.reason || 'אין חלופה מתאימה.')}</div></div>`}${(a.hiddenByEquipment || []).length ? `<p class="tiny faint">הוסתרו כי דורשים ציוד שלא סימנת: ${esc(a.hiddenByEquipment.join(', '))}.</p>` : ''}<p class="tiny faint">ההצעות מבוססות על נתוני ספריית התרגילים בלבד ואינן ייעוץ רפואי. כאב — עוצרים.</p></div>`,
        { pick: (x, ev, close) => { const r = B().substitute(d(), ph, i, x.dataset.v); close(); root.UI.toast(`הוחלף. משך משוער עכשיו ~${r.minutes} דק׳`); re(); } }); },
    bAdd: () => { const p = d().params, have = ['none', ...p.equipment]; let q = '';
      const listHtml = () => B().search(q, {}).filter(x => !d().main.some(it => it.ex === x.id)).slice(0, 40).map(x => { const usable = CT().usableWith(root.EX_BY_ID[x.id], have), ex = p.exclude.includes(x.id);
        return `<div class="li"><div class="grow"><div class="t">${esc(x.he)}</div><div class="s">${esc(root.EX_CATS[x.cat] || x.cat)} · קושי ${x.d}${x.eq.length ? ' · ' + esc(x.eq.map(eqHe).join(', ')) : ''}${!usable ? ' · <b>דורש ציוד שלא סימנת</b>' : ''}${ex ? ' · <b>ברשימת "לא מתאים לי"</b>' : ''}</div></div><button class="btn sm" data-act="add" data-v="${x.id}">הוספה</button></div>`; }).join('') || '<p class="empty">לא נמצאו תרגילים</p>';
      const sh = root.UI.sheet('הוספת תרגיל', `<div class="stack"><label class="field">חיפוש לפי שם, שריר או דפוס<input id="ba-q" type="search" placeholder="למשל: ישבן, שכיבות סמיכה"></label><div class="list" id="ba-list">${listHtml()}</div></div>`);
      const lst = sh.body.querySelector('#ba-list'); /* delegated: the list is re-rendered while typing */
      lst.addEventListener('click', ev => { const x = ev.target.closest('[data-act=add]'); if (!x) return; try { B().addExercise(d(), x.dataset.v); sh.close(); re(); } catch (e) { root.UI.toast(e.message); } });
      const inp = sh.body.querySelector('#ba-q'); inp.addEventListener('input', () => { q = inp.value; lst.innerHTML = listHtml(); }); },
    bSave: () => { try { const w = B().save(d()); st.draft = JSON.parse(JSON.stringify(w)); keepDraft(); root.UI.toast('האימון נשמר'); if (location.hash !== '#/builder/' + w.id) location.hash = '#/builder/' + w.id; else root.App.render(); } catch (e) { root.UI.toast(e.message); } },
    bStart: () => { let w; try { w = B().save(d()); } catch (e) { root.UI.toast(e.message); return; } st.draft = JSON.parse(JSON.stringify(w)); keepDraft(); if (location.hash !== '#/builder/' + w.id) history.replaceState(null, '', '#/builder/' + w.id); root.Run.start(0, 'std', null, { id: w.id }); },
    bAgain: () => { const g = B().generate(Object.assign({}, d().params, { variant: (d().params.variant || 0) + 1 })); Object.assign(d(), { params: g.params, warm: g.warm, main: g.main, cool: g.cool, notes: g.notes }); re(); },
    bSplit: () => { const p = d().params, have = new Set(p.focus), next = have.size ? [] : ['push', 'pull']; const g = B().generate(Object.assign({}, p, { focus: next.length ? next : ['legs', 'core'], variant: 0 }));
      st.draft = { id: null, name: 'אימון משלים · ' + g.params.minutes + ' דק׳', params: g.params, warm: g.warm, main: g.main, cool: g.cool, notes: g.notes.concat(['אימון משלים: מדגיש דחיפה ומשיכה כדי לגוון בין הימים.']), original: null }; keepDraft(); location.hash = '#/builder/draft'; root.App.render(); },
    bFav: () => { B().toggleFav(d().id); d().fav = B().get(d().id).fav; re(); },
    bDup: () => { const c = B().duplicate(d().id); root.UI.toast('נוצר עותק'); st.draft = JSON.parse(JSON.stringify(c)); keepDraft(); location.hash = '#/builder/' + c.id; },
    bRevert: () => root.UI.confirmSheet('חזרה לגרסה המקורית', 'האימון יחזור לגרסה שנשמרה לראשונה. היסטוריית האימונים שבוצעו לא משתנה.', 'חזרה למקור', () => { const w = B().revert(d().id); st.draft = JSON.parse(JSON.stringify(w)); re(); root.UI.toast('חזר לגרסה המקורית'); }),
    bDiscard: () => { st.draft = JSON.parse(JSON.stringify(B().get(d().id))); re(); },
    bDelW: () => root.UI.confirmSheet('מחיקת האימון', `למחוק את "${d().name}"? אימונים שכבר בוצעו יישארו בהיסטוריה.`, 'מחיקה', () => { B().remove(d().id); st.draft = null; keepDraft(); location.hash = '#/builder'; root.UI.toast('האימון נמחק'); }, true)
  };
}
Screens.builder = function (arg) {
  if (!arg) return listScreen();
  if (arg === 'new') return formScreen();
  return editor(arg);
};
})(window);
