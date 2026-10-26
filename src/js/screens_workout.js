/* Workouts: 30-day program list, day detail, exercise library and exercise detail */
(function (root) {
const { esc, icon, dots } = root.UI;
const S = root.Store, C = root.Core, L = root.Logic, P = root.PROGRAM;
const Screens = root.Screens;
const st = { tab: null, week: 0, cat: 'all', q: '', dayVer: {} };

function target(it) {
  const amt = it.reps === 'max' ? 'מקסימום' : it.sec === 'max' ? 'מקס׳ זמן' : it.reps ? `${it.reps} חזרות` : it.sec >= 120 ? `${Math.round(it.sec / 60)} דק׳` : `${it.sec} שנ׳`;
  return `${it.sets > 1 ? it.sets + ' × ' : ''}${amt}${it.side ? ' לכל צד' : ''}`;
}
Screens.target = target;

Screens.workouts = function () {
  const tn = C.todayN(), ap = root.Plans.active();
  const tab = st.tab === 'plan' && !ap ? 'program' : (st.tab || (ap ? 'plan' : 'program'));
  let body = '';
  if (tab === 'plan') { /* Stage D: with an active plan, the Workouts tab opens on THIS plan, not on the classic program */
    const I = root.Insights, cells = I.weekStrip(ap, S.today()), days = cells.map(c => c.day).filter(Boolean), nx = I.nextTraining(ap);
    const tpl = root.PROGRAMS.byId(ap.templateId), s = root.Plans.stats(ap);
    body = `<a class="card plan-link" href="#/plan"><span class="eyebrow">התוכנית האישית הפעילה · ${ap.status === 'paused' ? 'מושהית' : 'פעילה'}</span><b>${esc(tpl.he)}</b><span class="tiny muted">יום ${Math.min(s.dayN, s.total)} מתוך ${s.total} · בוצעו ${s.done}/${s.sessions} · לחצו לניהול התוכנית</span></a>
      <section class="card">${nx ? `<div class="next-up"><span class="eyebrow">האימון הבא</span><b>${esc(nx.title)}</b><span class="small muted">${esc(S.fmtDate(nx.date, true))}${nx.minutes ? ' · ~' + Math.round(nx.minutes) + ' דק׳' : ''}</span><a class="btn sm primary" href="#/pday/${nx.n}">פתיחה</a></div>` : '<p class="small muted">אין אימונים נוספים מתוכננים.</p>'}</section>
      <section class="card"><div class="card-h"><h3>השבוע</h3><a class="btn sm ghost" href="#/calendar">${icon('cal')} לוח מלא</a></div>${Screens.weekStrip(ap)}<div class="list">${days.map(Screens.planDayRow).join('') || '<div class="empty">אין ימי תוכנית בשבוע הזה</div>'}</div></section>
      <section class="card"><div class="btns"><a class="btn" href="#/plan">${icon('route')} ניהול התוכנית</a><button class="btn" data-act="tab" data-t="library">${icon('book')} ספריית תרגילים</button></div></section>`;
  } else if (tab === 'program') {
    const wi = st.week || Math.min(4, Math.max(1, Math.ceil(Math.min(30, Math.max(1, tn)) / 7)));
    const w = P.WEEKS[wi - 1], [a, b] = C.weekRange(wi);
    body = `<div class="seg" role="group" aria-label="שבוע">${P.WEEKS.map(x => `<button data-act="week" data-w="${x.n}" aria-pressed="${x.n === wi}">שבוע ${x.n}</button>`).join('')}</div>
      <section class="card"><span class="eyebrow">שבוע ${w.n}</span><h2>${esc(w.name)}</h2><p class="small">${esc(w.focus)}</p><p class="small muted"><b>מה השתנה:</b> ${esc(w.change)}</p></section>
      <section class="card"><div class="list">${P.DAYS.slice(a - 1, b).map(d => { const s0 = C.status(d.day), s = ap && ['missed', 'today'].includes(s0) ? 'planned' : s0; /* classic program is inactive while a personal plan runs */ return `<a class="li" href="#/day/${d.day}"><span class="num" style="width:34px;font-size:1.2em;color:${d.day === tn && !ap ? 'var(--accent)' : 'var(--muted)'}">${d.day}</span><div class="grow"><div class="t">${esc(d.title)}</div><div class="s">${esc(P.TYPE_LABEL[d.type])}${d.main.length ? ' · ~' + L.estimateMinutes(d, 'std') + ' דק׳' : ''}${L.hasVersions(d) ? ' · 3 גרסאות' : ''}</div></div><span class="pill ${s === 'done' ? 'good' : s === 'missed' ? 'bad' : s === 'partial' ? 'acc' : ''}">${C.STATUS_HE[s]}</span>${icon('chev', 'chev')}</a>`; }).join('')}</div></section>
      <section class="card flat"><h3>כללי עבודה</h3><ul class="bul small">${P.GENERAL_RULES.map(r => `<li>${esc(r)}</li>`).join('')}</ul></section>`;
  } else {
    const usage = L.exerciseUsage();
    /* Stage D: extra library filters (P07): equipment, difficulty, movement type, no-jump, favourites, with video */
    const CT = root.CATALOG, xp = C.profile().exercisePrefs || {}, fav = new Set(xp.fav || []), lf = st.lf = st.lf || {};
    const LF = { noeq: ['ללא ציוד', f => !f.eq.length], home: ['ריהוט ביתי', f => f.eq.length > 0 && CT.usableWith(root.EX_BY_ID[f.id], Object.keys(CT.EQUIPMENT).filter(k => CT.EQUIPMENT[k].home))], d1: ['קל', f => f.d === 1], d2: ['בינוני', f => f.d === 2], d3: ['מאתגר', f => f.d === 3], str: ['כוח', f => f.type === 'strength'], iso: ['החזקה', f => f.type === 'isometric'], car: ['לב־ריאה', f => ['cardio', 'plyometric'].includes(f.type)], mob: ['ניידות', f => ['mobility', 'breathing'].includes(f.type)], nojump: ['בלי קפיצות', f => f.impact !== 'high'], fav: ['מועדפים', f => fav.has(f.id)], video: ['עם סרטון', f => !!root.Media.exVideo(f.id)] };
    const on = Object.keys(LF).filter(k => lf[k]), grp = { eq: ['noeq', 'home'], d: ['d1', 'd2', 'd3'], t: ['str', 'iso', 'car', 'mob'] };
    const passF = f => Object.values(grp).every(g => { const a = g.filter(k => lf[k]); return !a.length || a.some(k => LF[k][1](f)); }) && ['nojump', 'fav', 'video'].every(k => !lf[k] || LF[k][1](f));
    const list = root.EXERCISES.filter(e => (st.cat === 'all' || e.cat === st.cat) && passF(CT.exFacts(e)));
    body = `<input type="text" id="lib-q" placeholder="חיפוש תרגיל בעברית או באנגלית" value="${esc(st.q)}" aria-label="חיפוש תרגיל">
      <div class="chips" role="group" aria-label="קטגוריה"><button class="chip" data-act="cat" data-c="all" aria-pressed="${st.cat === 'all'}">הכל (${root.EXERCISES.length})</button>${Object.entries(root.EX_CATS).map(([k, v]) => `<button class="chip" data-act="cat" data-c="${k}" aria-pressed="${st.cat === k}">${esc(v)}</button>`).join('')}</div>
      <div class="chips lib-filters" role="group" aria-label="סינון נוסף" data-lib-filters>${Object.entries(LF).map(([k, [t]]) => `<button class="chip" data-act="lf" data-f="${k}" aria-pressed="${!!lf[k]}">${esc(t)}</button>`).join('')}${on.length ? '<button class="chip" data-act="lfclear">ניקוי</button>' : ''}</div>
      <p class="small muted" data-lib-count>${list.length} תרגילים${on.length ? ' בסינון' : ''}${lf.video && !list.length ? ' — אין עדיין סרטוני הדגמה בספרייה' : ''}</p>
      <section class="card"><div class="list" id="lib-list">${list.map(e => `<a class="li" href="#/ex/${e.id}" data-q="${esc((e.he + ' ' + e.en).toLowerCase())}">${Screens.thumb(e.id)}<div class="grow"><div class="t">${esc(e.he)}</div><div class="s ltr">${esc(e.en)}</div><div class="s">${esc(root.EX_CATS[e.cat])} · ${(usage[e.id] || []).length ? 'ב־' + usage[e.id].length + ' ימים' : 'חלופה'}</div></div>${icon('chev', 'chev')}</a>`).join('')}</div><p class="empty" id="lib-empty" ${list.length ? 'hidden' : ''}>לא נמצאו תרגילים בסינון הזה</p></section>
      <p class="tiny faint">כל ההדגמות הן איורי המחשה סכמטיים שנוצרו לאפליקציה (לא צילומים ולא סרטונים).</p>`;
  }
  return {
    title: 'אימונים', html: `<div class="seg" role="group" aria-label="תצוגה">${ap ? `<button data-act="tab" data-t="plan" aria-pressed="${tab === 'plan'}">התוכנית שלי</button>` : ''}<button data-act="tab" data-t="program" aria-pressed="${tab === 'program'}">${ap ? '30 יום (קלאסית)' : 'תוכנית 30 יום'}</button><button data-act="tab" data-t="library" aria-pressed="${tab === 'library'}">ספריית תרגילים</button><a class="seg-link" href="#/programs">מסלולים</a><a class="seg-link" href="#/builder" data-builder-link>בניית אימון</a></div>${ap ? (tab === 'program' ? `<div class="banner info small">${icon('info')}<div>זו תוכנית 30 היום הקלאסית. היא לא פעילה כרגע — התוכנית האישית שלך היא שמתוזמנת. אפשר לעיין ולבצע ממנה אימונים בנפרד.</div></div>` : '') : `<a class="card plan-link" href="#/setup/1"><span class="eyebrow">תוכנית אישית</span><b>בניית תוכנית לפי מטרה, ציוד וזמינות</b><span class="tiny muted">תוכנית 30 היום למטה ממשיכה לעבוד כרגיל</span></a>`}${body}`,
    handlers: { tab: el => { st.tab = el.dataset.t; root.App.render(); }, week: el => { st.week = +el.dataset.w; root.App.render(); }, cat: el => { st.cat = el.dataset.c; root.App.render(); }, lf: el => { st.lf = st.lf || {}; st.lf[el.dataset.f] = !st.lf[el.dataset.f]; root.App.render(); }, lfclear: () => { st.lf = {}; root.App.render(); } },
    after: v => { const q = v.querySelector('#lib-q'); if (!q) return; const f = () => { st.q = q.value; const s = q.value.trim().toLowerCase(); let any = 0; v.querySelectorAll('#lib-list .li').forEach(a => { const ok = !s || a.dataset.q.includes(s); a.hidden = !ok; if (ok) any++; }); v.querySelector('#lib-empty').hidden = !!any; }; q.addEventListener('input', f); f(); }
  };
};

function exItem(n, it, k, sec, logged) {
  const id = C.exFor(n, it.ex), e = root.EX_BY_ID[id], swapped = id !== it.ex, lvl = C.levelFor(id, it);
  const showLvl = sec === 'main' && !it.test;
  return `<div class="ex-card">
    <a href="#/ex/${id}" aria-label="פרטי ${esc(e.he)}">${Screens.thumb(id)}</a>
    <div class="stack tight" style="min-width:0">
      <div class="row between top-al"><div class="grow"><a href="#/ex/${id}" style="color:inherit;text-decoration:none"><b>${esc(e.he)}</b></a> <span class="tiny faint ltr">${esc(e.en)}</span>${swapped ? ` <span class="pill acc">הוחלף</span>` : ''}${it.test ? ' <span class="pill gl">מבחן</span>' : ''}</div>
      ${sec === 'main' && !it.test ? `<button class="btn sm ghost" data-act="swap" data-ex="${it.ex}" aria-label="החלף תרגיל">${icon('swap')}</button>` : ''}</div>
      <div class="ex-meta"><span class="pill acc">${esc(target(it))}</span>${it.rest ? `<span class="pill">מנוחה ${it.rest} שנ׳</span>` : ''}${e.equip ? `<span class="pill">${icon('info')} ציוד ביתי</span>` : ''}${logged ? `<span class="pill good">${esc(logged)}</span>` : ''}</div>
      ${it.note ? `<p class="small">${esc(it.note)}</p>` : ''}
      ${showLvl ? `<div class="lvl" role="group" aria-label="רמת קושי">${['easy', 'normal', 'hard'].map(l => `<button data-act="lvl" data-ex="${id}" data-l="${l}" aria-pressed="${lvl === l}"><b>${C.LEVEL_HE[l]}</b>${esc(e.levels[l])}</button>`).join('')}</div>` : ''}
      <details class="more"><summary>טכניקה, נשימה וטעויות</summary><div class="stack tight small">
        <p><b>התחלה:</b> ${esc(e.start)}</p><ol class="steps">${e.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
        <p><b>נשימה:</b> ${esc(e.breath)}</p><p><b>טעויות נפוצות:</b> ${esc(e.mistakes.join(' · '))}</p>
        <p><b>קל יותר:</b> ${esc(e.levels.easy)}</p><p><b>קשה יותר:</b> ${esc(e.levels.hard)}</p>
        ${e.equip ? `<p><b>ציוד ביתי:</b> ${esc(e.equip)}</p>` : ''}
        <p><b>חלופה:</b> ${e.alts.map(a => `<a href="#/ex/${a}">${esc(root.EX_BY_ID[a].he)}</a>`).join(' · ')}</p></div></details>
    </div></div>`;
}

Screens.day = function (n) {
  n = C.clampDay(+n); const d = C.dayDef(n), date = C.dateOfDay(n), status = C.status(n), lg = C.log(n), wk = P.WEEKS[d.week - 1];
  const v = L.hasVersions(d) ? (st.dayVer[n] || 'std') : 'std';
  const parts = L.versionParts(d, v);
  const loggedMap = {}; if (lg && lg.sets) lg.sets.forEach(s => { if (s.done && s.sec === 'main') { const kk = s.ex; loggedMap[kk] = (loggedMap[kk] || 0) + 1; } });
  const totalSets = parts.main.reduce((s, it) => s + it.sets, 0);
  const html = [];
  html.push(`<section class="card hero"><div class="row between top-al"><div class="stack tight grow"><span class="eyebrow">יום ${n} · שבוע ${d.week} · ${esc(S.fmtDate(date, true))}</span><h1>${esc(d.title)}</h1></div><span class="pill ${status === 'done' ? 'good' : status === 'missed' ? 'bad' : status === 'partial' ? 'acc' : ''}">${C.STATUS_HE[status]}</span></div>
    <p class="small"><b>מטרה:</b> ${esc(d.goal)}</p><div class="kv"><span>${esc(P.TYPE_LABEL[d.type])}</span><span>שרירים: <b>${esc(d.muscles)}</b></span>${d.diff ? `<span>קושי ${dots(d.diff, 5)}</span>` : ''}</div>
    ${d.type !== 'rest' ? Screens.versionSeg(d, v, 'ver') + `${(() => { const bd = L.durationBreakdown(d, v), m = x => Math.round(x / 60 * 10) / 10; return `<div class="kv"><span>זמן מתוכנן: <b>~${Math.round(bd.total / 60)} דק׳</b></span><span>יעד הגרסה: <b>${L.VERSION_TARGET[v] || "—"} דק׳</b></span></div><div class="kv small"><span>חימום <b>${m(bd.warm)}</b></span><span>עבודה <b>${m(bd.work)}</b></span><span>מנוחות <b>${m(bd.rest)}</b></span><span>שחרור <b>${m(bd.cool)}</b></span><span>מעברים <b>${m(bd.trans)}</b> דק׳</span></div><p class="tiny faint">הזמן המתוכנן הוא הערכה: 3.5 שנ׳ לחזרה, 5.5 שנ׳ לחזרה בקצב איטי, 8 שנ׳ מעבר לכל סט, ומנוחות כפי שנקבעו. משך הביצוע בפועל משתנה לפי הקצב שלכם ונמדד במצב אימון.</p>`; })()}<div class="kv"><span>משך מתוכנן: <b>~${L.estimateMinutes(d, v)} דק׳</b></span><span>סטים באימון: <b>${totalSets}</b></span>${parts.circuit ? `<span>מעגל: <b>${parts.circuit} סבבים</b></span>` : ''}</div>
    <button class="btn primary big" data-act="start">${icon('play')} ${lg ? 'אימון חוזר' : 'התחל אימון'}</button>
    <div class="btns"><button class="btn sm" data-act="manual">${icon('edit')} רישום ידני</button><a class="btn sm" href="#/nutrition/${date}">${icon('food')} תפריט היום</a></div>` : `<a class="btn" href="#/nutrition/${date}">${icon('food')} תפריט היום</a>`}
  </section>`);
  if (d.testDay) {
    const tr = C.testRun(n), T = P.TEST_PROTOCOL;
    html.push(`<section class="card"><div class="card-h"><div class="stack tight"><span class="eyebrow">שלב 1 — לפני האימון</span><h2>${esc(T.title)}</h2></div><span class="pill ${tr ? 'good' : ''}">${tr ? 'נרשם ' + esc(S.fmtShort(tr.date || date)) : 'טרם בוצע'}</span></div>
      <p class="small">${n === 1 ? 'מבחן הפתיחה קובע נקודת השוואה.' : 'אותו מבחן בדיוק כמו ביום 1 — אותו סדר, אותן מנוחות, אותה גרסת שכיבות סמיכה.'} משך משוער: ~${L.estimateMinutes(d, 'test')} דק׳. המבחן נפרד מהאימון ולא נכלל בזמני האימון.</p>
      <ol class="steps small">${Object.values(P.TESTS).map(t => `<li><b>${esc(t.name)}:</b> ${esc(t.how)}</li>`).join('')}</ol>
      <details class="more"><summary>תנאי המבחן</summary><ul class="bul small">${T.rules.map(r => `<li>${esc(r)}</li>`).join('')}</ul></details>
      ${tr ? `<div class="kv">${Object.entries(P.TESTS).map(([k, t]) => `<span>${esc(t.name)}: <b>${tr.results[k] != null ? tr.results[k] + ' ' + esc(t.unit) : 'לא בוצע'}</b></span>`).join('')}</div>` : ''}
      <div class="btns"><button class="btn primary" data-act="startTest">${icon('timer')} ${tr ? 'ביצוע מבחן מחדש' : 'התחל מבחן'}</button><button class="btn" data-act="manualTest">${icon('edit')} רישום תוצאות ידני</button></div></section>`);
  }
  if (lg) html.push(`<section class="card"><div class="card-h"><h3>ביצוע בפועל</h3><span class="pill ${lg.status === 'done' ? 'good' : 'acc'}">${lg.status === 'done' ? 'הושלם' : 'חלקי'}</span></div>
    <div class="kv"><span>תאריך: <b>${esc(S.fmtShort(lg.date || date))}</b></span><span>משך: <b>${Math.round((lg.durationSec || 0) / 60)} דק׳</b></span><span>גרסה: <b>${esc(L.VERSIONS[lg.version] || '—')}</b></span>${lg.rpe ? `<span>קושי: <b>${lg.rpe}/10</b></span>` : ''}<span>סטים שהושלמו: <b>${(lg.sets || []).filter(s => s.done && s.sec === 'main').length}</b></span></div>
    ${lg.notes ? `<p class="small">"${esc(lg.notes)}"</p>` : ''}
    ${(lg.sets || []).some(s => s.done && s.sec === 'main') ? `<details class="more"><summary>פירוט סטים</summary><div class="tbl-wrap"><table class="tbl"><tr><th>תרגיל</th><th>סט</th><th>ביצוע</th></tr>${lg.sets.filter(s => s.done && s.sec === 'main').map(s => `<tr><td>${esc(root.EX_BY_ID[s.ex].he)}</td><td class="n">${s.set}</td><td class="n">${s.reps != null ? s.reps + ' חז׳' : s.secs != null ? s.secs + ' שנ׳' : '✓'}</td></tr>`).join('')}</table></div></details>` : ''}
    <div class="btns"><button class="btn sm" data-act="manual">עריכה</button><button class="btn sm danger" data-act="delLog">מחיקת הרישום</button></div></section>`);
  if (d.type === 'rest') {
    html.push(`<section class="card"><h3>יום מנוחה מתוכנן</h3><p>${esc(d.goal)}</p>${d.tip ? `<p class="small muted">${esc(d.tip)}</p>` : ''}<ul class="bul small"><li>הליכה רגילה לפי תחושה ויעד הצעדים.</li><li>אפשר 5–10 דקות ניידות קלה (חתול–פרה, תנוחת הילד, מתיחות).</li><li>הקפידו על חלבון, מים ושינה — ההתאוששות קורית היום.</li></ul></section>`);
  } else {
    const sec = (title, items, key, sub) => items.length ? `<section class="card"><div class="card-h"><h3>${title}</h3>${sub ? `<span class="muted small">${sub}</span>` : ''}</div><div>${items.map((it, k) => exItem(n, it, k, key, key === 'main' && loggedMap[C.exFor(n, it.ex)] ? loggedMap[C.exFor(n, it.ex)] + ' סטים בוצעו' : '')).join('')}</div></section>` : '';
    html.push(sec('חימום', parts.warm, 'warm', 'סט אחד מכל תרגיל, ברצף'));
    html.push(sec(parts.circuit ? `תרגילים — מעגל של ${parts.circuit} סבבים` : 'תרגילים לפי הסדר', parts.main, 'main', parts.circuit ? `מנוחה ${parts.roundRest || 90} שנ׳ בין סבבים` : ''));
    html.push(sec('שחרור והרפיה', parts.cool, 'cool'));
    html.push(`<section class="card flat"><h3>סיכום האימון</h3><ul class="bul small"><li>${parts.main.length} תרגילים, ${totalSets} סטים, ~${L.estimateMinutes(d, v)} דקות כולל חימום ושחרור.</li><li>שבוע ${d.week}: ${esc(wk.change)}</li>${d.tip ? `<li>${esc(d.tip)}</li>` : ''}<li>רישום הביצועים: במצב אימון מסמנים כל סט ומזינים חזרות בפועל; אפשר גם רישום ידני.</li></ul></section>`);
  }
  html.push(`<div class="btns">${n > 1 ? `<a class="btn ghost" href="#/day/${n - 1}">${icon('back')} יום ${n - 1}</a>` : ''}${n < 30 ? `<a class="btn ghost" href="#/day/${n + 1}">יום ${n + 1} ${icon('chev')}</a>` : ''}</div>`);
  return {
    title: 'יום ' + n, back: '#/workouts', html: html.join(''), handlers: {
      ver: el => { st.dayVer[n] = el.dataset.v; root.App.render(); },
      start: () => root.Run.start(n, v),
      lvl: el => { const w = S.load('workouts'); w.levels[el.dataset.ex] = el.dataset.l; S.save('workouts'); root.UI.toast('הרמה נשמרה לתרגיל בכל התוכנית'); root.App.render(); },
      swap: el => Screens.swapExercise(n, el.dataset.ex),
      manual: () => Screens.manualLog(n, v),
      startTest: () => root.Run.start(n, 'test'),
      manualTest: () => Screens.manualTest(n),
      delLog: () => root.UI.confirmSheet('מחיקת רישום', 'למחוק את רישום הביצוע של יום ' + n + '? אי אפשר לבטל.', 'מחיקה', () => { const w = S.load('workouts'); delete w.days[n]; S.save('workouts'); root.App.render(); }, true)
    }
  };
};
Screens.swapExercise = function (n, orig) {
  const e = root.EX_BY_ID[orig], cur = C.exFor(n, orig);
  const opts = [orig].concat(e.alts).filter((x, i, a) => a.indexOf(x) === i);
  root.UI.sheet('החלפת תרגיל', `<p class="small muted">ההחלפה חלה על יום ${n} בלבד. התוכנית המקורית נשמרת.</p><div class="list">${opts.map(id => { const x = root.EX_BY_ID[id]; return `<button class="li li-btn" data-act="pick" data-id="${id}">${Screens.thumb(id)}<div class="grow"><div class="t">${esc(x.he)}${id === orig ? ' <span class="pill">מקורי</span>' : ''}${id === cur ? ' <span class="pill acc">נבחר</span>' : ''}</div><div class="s">${esc(x.muscles)}</div>${x.equip ? `<div class="s">${esc(x.equip)}</div>` : ''}</div></button>`; }).join('')}</div>`,
    { pick: (el, ev, close) => { const w = S.load('workouts'); w.swaps[n] = w.swaps[n] || {}; if (el.dataset.id === orig) delete w.swaps[n][orig]; else w.swaps[n][orig] = el.dataset.id; S.save('workouts'); close(); root.UI.toast('התרגיל הוחלף'); root.App.render(); } });
};
Screens.manualTest = function (n) {
  const tr = C.testRun(n) || { results: {} };
  root.UI.sheet('תוצאות מבחן — יום ' + n, `<p class="small muted">מלאו רק מבחנים שבוצעו בפועל. שדה ריק = לא בוצע.</p>
    <label class="field">תאריך ביצוע<input type="date" id="mt-d" value="${tr.date || S.today()}"></label>
    ${Object.entries(P.TESTS).map(([k, t]) => `<label class="field">${esc(t.name)} (${esc(t.unit)})<input type="number" inputmode="numeric" min="0" id="mt-${k}" value="${tr.results[k] != null ? tr.results[k] : ''}"></label>`).join('')}
    <label class="field">גרסת שכיבות הסמיכה<select id="mt-var"><option value="full" ${tr.pushVar !== 'knee' ? 'selected' : ''}>מלאות</option><option value="knee" ${tr.pushVar === 'knee' ? 'selected' : ''}>על הברכיים</option></select></label>
    <label class="field">הערות<textarea id="mt-n">${esc(tr.notes || '')}</textarea></label>
    <div class="btns"><button class="btn primary" data-act="save">שמירה</button>${C.testRun(n) ? '<button class="btn danger" data-act="del">מחיקת התוצאות</button>' : ''}</div>`,
    { save: (el, ev, close, b) => { const w = S.load('workouts'); w.tests = w.tests || {}; const results = {};
        Object.keys(P.TESTS).forEach(k => { const v = b.querySelector('#mt-' + k).value; if (v !== '' && +v >= 0) results[k] = +v; });
        w.tests[n] = { date: b.querySelector('#mt-d').value || S.today(), results, pushVar: b.querySelector('#mt-var').value, notes: b.querySelector('#mt-n').value.trim(), source: 'manual' };
        S.save('workouts'); close(); root.UI.toast('תוצאות המבחן נשמרו'); root.App.render(); },
      del: (el, ev, close) => { close(); root.UI.confirmSheet('מחיקת תוצאות', 'למחוק את תוצאות המבחן של יום ' + n + '?', 'מחיקה', () => { const w = S.load('workouts'); delete w.tests[n]; S.save('workouts'); root.App.render(); }, true); } });
};
Screens.manualLog = function (n, v) {
  const lg = C.log(n) || {}, d = C.dayDef(n);
  const vv = lg.version || v;
  root.UI.sheet('רישום ידני — יום ' + n, `
    <p class="small muted">לשימוש כשהאימון בוצע בלי מצב אימון פעיל. שום דבר לא מסומן אוטומטית.</p>
    <label class="field">סטטוס<select id="ml-st"><option value="done" ${lg.status !== 'partial' ? 'selected' : ''}>הושלם</option><option value="partial" ${lg.status === 'partial' ? 'selected' : ''}>הושלם חלקית</option></select></label>
    ${L.hasVersions(d) ? `<label class="field">גרסה<select id="ml-v">${['min', 'short', 'std', 'long'].map(x => `<option value="${x}" ${vv === x ? 'selected' : ''}>${L.VERSIONS[x]} (~${L.estimateMinutes(d, x)} דק׳)</option>`).join('')}</select></label>` : ''}
    <div class="grid2"><label class="field">תאריך ביצוע<input type="date" id="ml-d" value="${lg.date || (C.dateOfDay(n) <= S.today() ? C.dateOfDay(n) : S.today())}"></label><label class="field">משך (דקות)<input type="number" id="ml-m" inputmode="numeric" min="1" max="240" value="${lg.durationSec ? Math.round(lg.durationSec / 60) : L.estimateMinutes(d, vv)}"></label></div>
    <label class="field">קושי כללי (1–10)<input type="number" id="ml-r" inputmode="numeric" min="1" max="10" value="${lg.rpe || ''}"></label>
    <label class="field">הערות<textarea id="ml-n">${esc(lg.notes || '')}</textarea></label>
    <button class="btn primary" data-act="save">שמירה</button>`,
    { save: (el, ev, close, b) => { const w = S.load('workouts');
        const rv = +b.querySelector('#ml-r').value;
        const mv = b.querySelector('#ml-v') ? b.querySelector('#ml-v').value : 'std'; /* SLL-02: a minimum session is always partial */
        w.days[n] = Object.assign({}, lg, { status: mv === 'min' && b.querySelector('#ml-st').value === 'done' ? 'partial' : b.querySelector('#ml-st').value, version: mv, date: b.querySelector('#ml-d').value, durationSec: (+b.querySelector('#ml-m').value || 0) * 60, rpe: rv >= 1 && rv <= 10 ? rv : null, notes: b.querySelector('#ml-n').value.trim(), sets: lg.sets || [], manual: true });
        S.save('workouts'); close(); root.UI.toast('הרישום נשמר'); root.App.render(); } });
};

Screens.exercise = function (id) {
  const e = root.EX_BY_ID[id]; if (!e) return { title: 'לא נמצא', html: '<div class="empty">התרגיל לא נמצא</div>', handlers: {} };
  const usage = L.exerciseUsage()[id] || [];
  const lvl = C.levelFor(id);
  return {
    title: e.he, back: '#/workouts', html: `
    ${(() => { const demo = `<div class="demo" data-fig="${id}"><span class="tag pill">אנימציית איור · ${e.view === 'front' ? 'מבט מלפנים' : 'מבט מהצד'}</span><span class="phase" data-phase>תנוחת התחלה</span></div>`;
      const v = root.Media.exVideo(id);
      return v ? root.Media.player(v, { label: 'סרטון הדגמה: ' + e.he, caption: 'סרטון הדגמה', fallback: demo }) + '<p class="tiny faint">אנימציית האיור מוצגת למטה בלחיצה על "התחלה"/"סיום".</p>'
        : demo + `<div class="mstatus" data-media-status="missing">${icon('info')}<span>הדגמה באנימציית איור (תנוחת התחלה וסיום) והוראות ביצוע מלאות למטה. אין סרטון צילום לתרגיל הזה — לא מוצג סרטון שלא נבדק.</span></div>`; })()}
    <div class="seg" role="group" aria-label="הצגה"><button data-act="figmode" data-m="anim" aria-pressed="true">הנפשה</button><button data-act="figmode" data-m="A" aria-pressed="false">התחלה</button><button data-act="figmode" data-m="B" aria-pressed="false">סיום</button></div>
    <section class="card"><div><h1>${esc(e.he)}</h1><span class="muted ltr">${esc(e.en)}</span></div>
      <div class="kv"><span>${esc(root.EX_CATS[e.cat])}</span><span>שרירים: <b>${esc(e.muscles)}</b></span></div>
      ${e.equip ? `<div class="banner info small">${icon('info')}<div><b>ציוד ביתי:</b> ${esc(e.equip)}</div></div>` : ''}</section>
    ${(() => { const CT = root.CATALOG, f = CT.exFacts(e), D = ['', 'קל', 'בינוני', 'מאתגר'];
      return `<section class="card" data-ex-facts><h3>פרטי התרגיל</h3><div class="facts"><span class="l">שרירים עיקריים</span><span>${esc(f.primary.join(', '))}</span>${f.secondary.length ? `<span class="l">שרירים משניים</span><span>${esc(f.secondary.join(', '))}</span>` : ''}
        <span class="l">דפוס תנועה</span><span>${esc(CT.PATTERN_HE[f.pattern] || '')} · ${esc(CT.TYPE_HE[f.type] || '')}${f.uni ? ' · כל צד בנפרד' : ''}</span>
        <span class="l">ציוד</span><span>${f.eq.length ? esc(f.eq.map(x => CT.EQUIPMENT[x].he).join(', ')) : 'ללא ציוד'}${e.equip ? ' · ' + esc(e.equip.split(' (')[0]) : ''}</span>
        <span class="l">רמת קושי בסיסית</span><span>${D[f.d] || '—'}</span><span class="l">עצימות נחיתה</span><span>${f.impact === 'high' ? 'כולל קפיצות' : 'ללא קפיצות'}</span></div></section>
      <section class="card" data-ex-safety><h3>דגשי בטיחות</h3><ul class="bul">${CT.exSafety(e).map(s => `<li>${esc(s)}</li>`).join('')}</ul><p class="tiny faint">דגשי טכניקה כלליים לפי סוג התנועה. ההוראות, הדגשים והאיורים באפליקציה לא נבדקו ולא אושרו על ידי מאמן או פיזיותרפיסט — אין לראות בהם הדרכה מקצועית מאושרת, והם לא מחליפים הנחיה אישית.</p></section>`; })()}
    <section class="card"><h3>ביצוע</h3><p><b>תנוחת התחלה:</b> ${esc(e.start)}</p><ol class="steps">${e.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol><p><b>כיוון התנועה:</b> ${esc(e.dir)}</p><p><b>תנוחת סיום:</b> ${esc(e.end)}</p><p><b>נשימה:</b> ${esc(e.breath)}</p></section>
    <section class="card"><h3>טעויות נפוצות</h3><ul class="bul">${e.mistakes.map(s => `<li>${esc(s)}</li>`).join('')}</ul><h3>סימנים שהביצוע לא תקין</h3><ul class="bul">${e.bad.map(s => `<li>${esc(s)}</li>`).join('')}</ul></section>
    <section class="card"><div class="card-h"><h3>רמות</h3><span class="muted small">הרמה שלך: ${C.LEVEL_HE[lvl]}</span></div><div class="lvl" role="group" aria-label="רמת קושי">${['easy', 'normal', 'hard'].map(l => `<button data-act="lvl" data-l="${l}" aria-pressed="${lvl === l}"><b>${C.LEVEL_HE[l]}</b>${esc(e.levels[l])}</button>`).join('')}</div><p class="small"><b>מתי עוברים רמה:</b> ${esc(e.progress)}</p></section>
    <section class="card"><h3>חלופות</h3><div class="list">${e.alts.map(a => `<a class="li" href="#/ex/${a}">${Screens.thumb(a)}<div class="grow"><div class="t">${esc(root.EX_BY_ID[a].he)}</div><div class="s">${esc(root.EX_BY_ID[a].muscles)}</div></div>${icon('chev', 'chev')}</a>`).join('')}</div></section>
    <section class="card"><h3>מופיע באימונים</h3>${usage.length ? `<div class="chips" style="flex-wrap:wrap">${usage.map(n => `<a class="chip" href="#/day/${n}">יום ${n}</a>`).join('')}</div>` : '<p class="muted small">לא מופיע בתוכנית הבסיס — משמש כחלופה.</p>'}</section>`,
    handlers: {
      lvl: el => { const w = S.load('workouts'); w.levels[id] = el.dataset.l; S.save('workouts'); root.App.render(); },
      figmode: el => { const m = el.dataset.m; el.parentNode.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b === el)); const box = document.querySelector('[data-fig]'); root.App.mountFig(box, m === 'anim' ? null : m); }
    }
  };
};
})(window);
