/* Active workout mode. State is saved after every action so a closed app resumes where it stopped. */
(function (root) {
const { esc, icon } = root.UI;
const S = root.Store, C = root.Core, L = root.Logic, P = root.PROGRAM;
let el = null, tick = null, figStop = null, wake = null, audioCtx = null, lastRestBeep = null;

function sess() { return S.load('session'); }
function saveSess(s) { S.set('session', s); }
/* a session belongs either to the fixed 30-day program (s.day) or to a personal plan day (s.plan = {id, n}) */
function defOf(s) { return s.plan ? root.Plans.runDef(s.plan.id, s.plan.n) : C.dayDef(s.day); }
function steps(s) { const d = defOf(s); return L.buildSteps(d, s.version).map(st => Object.assign({}, st, { ex: s.plan ? st.ex : C.exFor(s.day, st.ex) })); }
const backHash = s => s.plan ? '#/pday/' + s.plan.n : '#/day/' + s.day;
function elapsed(s) { return s.activeMs + (s.paused || !s.lastResume ? 0 : Date.now() - s.lastResume); }
const mmss = ms => { const t = Math.max(0, Math.round(ms / 1000)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
const PH = { warm: 'חימום', main: 'אימון', cool: 'שחרור' };

function start(day, version, plan) {
  const ex = sess();
  if (ex && (ex.day !== day || ex.version !== version || JSON.stringify(ex.plan || null) !== JSON.stringify(plan || null))) {
    root.UI.confirmSheet('יש אימון פתוח', `קיים אימון בתהליך (יום ${ex.day}). להתחיל אימון חדש ולמחוק את ההתקדמות של הפתוח?`, 'התחלה מחדש', () => { S.clearSession(); start(day, version); }, true);
    return;
  }
  if (!ex) {
    const st = L.buildSteps(defOf({ day, plan }), version);
    if (!st.length) { root.UI.toast('אין תרגילים ביום הזה'); return; }
    saveSess({ plan: plan || null, day, version, stepIdx: 0, total: st.length, log: {}, startedAt: Date.now(), activeMs: 0, lastResume: Date.now(), paused: false, rest: null, work: null, notes: '', rpe: null, tests: {}, feedback: {}, finished: false });
  }
  open();
}
function open() {
  const s = sess(); if (!s) return;
  if (s.parked) { s.parked = false; saveSess(s); }
  if (s.paused === false && !s.lastResume) { s.lastResume = Date.now(); saveSess(s); }
  if (!el) { el = document.createElement('div'); el.className = 'run'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'מצב אימון'); document.body.appendChild(el); document.body.style.overflow = 'hidden'; }
  requestWake();
  render();
  clearInterval(tick); tick = setInterval(onTick, 250);
}
function close() {
  clearInterval(tick); tick = null; if (figStop) figStop(); figStop = null;
  if (el) { el.remove(); el = null; } document.body.style.overflow = '';
  releaseWake(); root.App.render();
}
function requestWake() {
  if (!C.profile().display.wake) return;
  try { if ('wakeLock' in navigator && !wake) navigator.wakeLock.request('screen').then(w => { wake = w; w.addEventListener('release', () => { wake = null; }); }).catch(() => {}); } catch (e) { }
}
function releaseWake() { try { if (wake) wake.release(); } catch (e) { } wake = null; }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && el) requestWake(); });
function beep() {
  if (!C.profile().display.sound) return;
  try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.frequency.value = 880; g.gain.value = 0.15; o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + 0.25); } catch (e) { }
  try { if (navigator.vibrate) navigator.vibrate([120, 60, 120]); } catch (e) { }
}
function onTick() {
  const s = sess(); if (!s || !el) return;
  const e1 = el.querySelector('[data-el]'); if (e1) e1.textContent = mmss(elapsed(s));
  if (s.rest && !s.paused) {
    const left = s.rest.endsAt - Date.now(); const t = el.querySelector('[data-rest]'); if (t) t.textContent = mmss(left);
    if (left <= 0) { if (lastRestBeep !== s.rest.endsAt) { lastRestBeep = s.rest.endsAt; beep(); } s.rest = null; saveSess(s); render(); }
  }
  if (s.work && !s.paused) {
    const st = steps(s)[s.stepIdx]; const dur = st.item.sec === 'max' ? null : setDur(st.item);
    const t = el.querySelector('[data-work]');
    if (dur != null) { const left = s.work.startedAt + dur * 1000 - Date.now(); if (t) t.textContent = mmss(left); if (left <= 0 && !s.work.beeped) { s.work.beeped = true; saveSess(s); beep(); render(); } }
    else if (t) t.textContent = mmss(Date.now() - s.work.startedAt);
  }
}
const setDur = it => it.sec;
function targetText(it, ex) {
  const side = it.side ? ' לכל צד' : '';
  if (it.reps === 'max') return { big: 'מקס׳', unit: 'חזרות נקיות' };
  if (it.sec === 'max') return { big: 'מקס׳', unit: 'זמן' + side };
  if (it.reps) return { big: it.reps, unit: 'חזרות' + side };
  return it.sec >= 120 ? { big: Math.round(it.sec / 60), unit: 'דקות' } : { big: it.sec, unit: 'שניות' + side };
}
function render() {
  const s = sess(); if (!s || !el) return;
  if (figStop) { figStop(); figStop = null; }
  if (s.finished) return s.version === 'test' ? renderTestSummary(s) : renderSummary(s);
  const all = steps(s), st = all[s.stepIdx], d = defOf(s), e = root.EX_BY_ID[st.ex], it = st.item, lvl = C.levelFor(st.ex, it);
  const doneCount = Object.values(s.log).filter(x => x.done).length;
  const sameItem = all.map((x, i) => ({ x, i })).filter(o => o.x.sec === st.sec && o.x.idx === st.idx);
  const tg = targetText(it, e); const isTest = s.version === 'test';
  const lg = s.log[s.stepIdx];
  const timed = !!it.sec;
  const roundInfo = st.sec === 'main' && L.versionParts(d, s.version).circuit && st.idx < (L.versionParts(d, s.version).extraFrom || 999) ? ` · סבב ${st.set}` : '';
  const next = all[s.stepIdx + 1];
  let restBlock = '';
  if (s.rest) restBlock = `<div class="rest-panel"><span class="phase-tag">מנוחה</span><div class="timer" data-rest>${mmss(s.rest.endsAt - Date.now())}</div><div class="btns" style="width:100%"><button class="btn sm" data-a="rest15">+15 שנ׳</button><button class="btn sm primary" data-a="skipRest">דלג על המנוחה</button></div><p class="small">הבא: <b>${esc(root.EX_BY_ID[st.ex].he)}</b> · סט ${st.set}/${st.sets}</p></div>`;
  el.innerHTML = `
    <div class="run-top"><button class="icon-btn" data-a="exit" aria-label="יציאה">${icon('close')}</button><div class="grow"><h3>${esc(d.title)}</h3><span class="tiny muted">יום ${s.day} · גרסה ${esc(L.VERSIONS[s.version])} (~${L.estimateMinutes(d, s.version)} דק׳) · <span class="num" data-el>${mmss(elapsed(s))}</span>${s.paused ? ' · <b class="warn">מושהה</b>' : ''}</span></div><button class="icon-btn" data-a="${s.paused ? 'resume' : 'pause'}" aria-label="${s.paused ? 'המשך' : 'השהיה'}">${icon(s.paused ? 'play' : 'pause')}</button></div>
    <div class="run-prog"><i style="width:${(s.stepIdx / all.length * 100).toFixed(1)}%"></i></div>
    <div class="run-body">
      ${s.paused ? `<div class="banner warn">${icon('pause')}<div class="grow">האימון מושהה. הזמן לא נספר.</div><button class="btn sm primary" data-a="resume">המשך</button></div>` : ''}
      ${restBlock}
      <div class="row between"><span class="phase-tag">${PH[st.sec]}${roundInfo} · שלב ${s.stepIdx + 1}/${all.length}</span><span class="set-dots" aria-label="סטים">${sameItem.map(o => `<i class="${s.log[o.i] && s.log[o.i].done ? 'done' : o.i === s.stepIdx ? 'cur' : ''}"></i>`).join('')}</span></div>
      <div class="run-ex">${esc(e.he)}</div>
      <div class="demo" id="run-fig"><span class="tag pill">איור המחשה</span><span class="phase" data-phase></span></div>
      <div class="run-target"><span class="big">${tg.big}</span><span class="muted">${esc(tg.unit)}</span><span class="pill">סט ${st.set}/${st.sets}</span>${it.rest && st.sec === 'main' ? `<span class="pill">מנוחה ${st.rest} שנ׳</span>` : ''}</div>
      ${st.sec === 'main' && !it.test ? `<p class="small"><b>רמה ${C.LEVEL_HE[lvl]}:</b> ${esc(e.levels[lvl])}</p>` : ''}
      ${it.note && !it.test ? `<p class="small acc">${esc(it.note)}</p>` : ''}
      ${timed ? `<div class="card"><div class="timer" data-work>${s.work ? '' : mmss((it.sec === 'max' ? 0 : it.sec) * 1000)}</div><button class="btn ${s.work ? '' : 'outline'}" data-a="${s.work ? 'stopWork' : 'startWork'}">${s.work ? 'עצירת טיימר' : icon('timer') + ' הפעלת טיימר'}</button></div>` : ''}
      ${it.test ? `<div class="banner info small"><div><b>${esc(P.TESTS[it.test].name)}</b><br>${esc(P.TESTS[it.test].how)}</div></div><label class="field">התוצאה שלך (${esc(P.TESTS[it.test].unit)}) — השאירו ריק אם לא בוצע<input type="number" id="run-test" inputmode="numeric" min="0" value="${s.tests[it.test] != null ? s.tests[it.test] : ''}"></label>` : ''}
      <details class="more"><summary>איך מבצעים</summary><div class="stack tight small"><p>${esc(e.start)}</p><ol class="steps">${e.steps.map(x => `<li>${esc(x)}</li>`).join('')}</ol><p><b>נשימה:</b> ${esc(e.breath)}</p><p><b>להימנע:</b> ${esc(e.mistakes.join(' · '))}</p></div></details>
    </div>
    <div class="run-bot">
      ${!timed && !it.test && st.sec === 'main' ? `<div class="row between"><span class="small muted">חזרות בפועל</span><div class="stepper"><button data-a="rm" aria-label="פחות">−</button><input type="number" id="run-reps" inputmode="numeric" value="${lg && lg.reps != null ? lg.reps : (it.reps || 0)}" aria-label="חזרות בפועל"><button data-a="rp" aria-label="יותר">+</button></div></div>` : ''}
      <button class="btn primary big" data-a="done">${icon('check')} ${lg && lg.done ? 'עדכון סט' : 'סיימתי סט'}</button>
      <div class="btns"><button class="btn sm" data-a="prevEx" ${s.stepIdx === 0 ? 'disabled' : ''}>${icon('prev')} תרגיל קודם</button><button class="btn sm" data-a="skip">דלג על סט</button><button class="btn sm" data-a="nextEx" ${!next ? 'disabled' : ''}>תרגיל הבא ${icon('next')}</button></div>
    </div>`;
  const fig = el.querySelector('#run-fig'); figStop = root.App.mountFig(fig, null, true);
  el.querySelectorAll('[data-a]').forEach(b => b.addEventListener('click', () => act(b.dataset.a)));
  const ti = el.querySelector('#run-test'); if (ti) ti.addEventListener('change', () => { const ss = sess(); ss.tests[it.test] = ti.value === '' ? null : +ti.value; saveSess(ss); });
}
function firstOfItem(all, i) { const a = all[i]; let j = i; while (j > 0 && all[j - 1].sec === a.sec && all[j - 1].idx === a.idx) j--; return j; }
function act(a) {
  const s = sess(); if (!s) return; const all = steps(s), st = all[s.stepIdx], it = st.item;
  const now = Date.now();
  if (a === 'pause') { s.activeMs = elapsed(s); s.paused = true; s.lastResume = null; if (s.rest) s.rest.left = s.rest.endsAt - now; if (s.work) s.work.pausedAt = now; }
  else if (a === 'resume') { s.paused = false; s.lastResume = now; if (s.rest && s.rest.left != null) { s.rest.endsAt = now + s.rest.left; delete s.rest.left; } if (s.work && s.work.pausedAt) { s.work.startedAt += now - s.work.pausedAt; delete s.work.pausedAt; } }
  else if (a === 'rest15') { if (s.rest) s.rest.endsAt += 15000; }
  else if (a === 'skipRest') { s.rest = null; }
  else if (a === 'startWork') { s.work = { startedAt: now }; s.rest = null; }
  else if (a === 'stopWork') { const secs = Math.round((now - s.work.startedAt) / 1000); s.workSecs = it.sec === 'max' ? secs : Math.min(it.sec, secs); s.work = null; if (it.test && it.sec === 'max') s.tests[it.test] = Math.min(180, s.workSecs); }
  else if (a === 'rm' || a === 'rp') { const i = el.querySelector('#run-reps'); i.value = Math.max(0, (+i.value || 0) + (a === 'rp' ? 1 : -1)); return; }
  else if (a === 'done' || a === 'skip') {
    if (s.paused) { s.paused = false; s.lastResume = now; }
    const rec = { done: a === 'done', ex: st.ex, sec: st.sec, set: st.set };
    if (a === 'done') {
      const ri = el.querySelector('#run-reps');
      if (it.test) { const ti = el.querySelector('#run-test'); if (ti && ti.value !== '') { s.tests[it.test] = +ti.value; rec.reps = +ti.value; } }
      else if (ri) rec.reps = +ri.value || 0;
      else if (it.sec) rec.secs = s.work ? Math.round((now - s.work.startedAt) / 1000) : (s.workSecs != null ? s.workSecs : (it.sec === 'max' ? null : it.sec));
      if (it.reps && typeof it.reps === 'number' && rec.reps != null && rec.reps < it.reps * 0.7 && st.sec === 'main') { const fb = s.feedback[st.ex] || null; if (!fb) s.feedback[st.ex] = 'fail'; }
    }
    s.log[s.stepIdx] = rec; s.work = null; s.workSecs = null;
    if (s.stepIdx >= all.length - 1) { s.activeMs = elapsed(s); s.lastResume = null; s.finished = true; s.rest = null; }
    else { const restSec = a === 'done' ? st.rest : 0; s.stepIdx++; s.rest = restSec > 0 ? { endsAt: now + restSec * 1000 } : null; }
  }
  else if (a === 'nextEx') { let j = s.stepIdx + 1; while (j < all.length && all[j].sec === st.sec && all[j].idx === st.idx) j++; if (j < all.length) { s.stepIdx = j; s.rest = null; s.work = null; } }
  else if (a === 'prevEx') { const f = firstOfItem(all, s.stepIdx); const j = f > 0 ? firstOfItem(all, f - 1) : 0; s.stepIdx = s.stepIdx !== f ? f : j; s.rest = null; s.work = null; }
  else if (a === 'exit') { saveSess(s); return exitSheet(); }
  saveSess(s); render();
}
function exitSheet() {
  root.UI.sheet('יציאה ממצב אימון', `<p class="small muted">ההתקדמות נשמרת אוטומטית.</p><div class="stack"><button class="btn primary" data-act="keep">שמירה ויציאה — אמשיך אחר כך</button><button class="btn" data-act="finish">סיום האימון עכשיו (סיכום)</button><button class="btn danger" data-act="discard">ביטול האימון ומחיקת ההתקדמות</button></div>`,
    { keep: (b, e, cl) => { cl(); const s = sess(); s.activeMs = elapsed(s); s.paused = true; s.lastResume = null; s.parked = true; saveSess(s); close(); },
      finish: (b, e, cl) => { cl(); const s = sess(); s.activeMs = elapsed(s); s.lastResume = null; s.finished = true; s.rest = null; s.work = null; saveSess(s); render(); },
      discard: (b, e, cl) => { cl(); root.UI.confirmSheet('ביטול אימון', 'למחוק את ההתקדמות של האימון הנוכחי? רישומים קודמים לא יימחקו.', 'מחיקה', () => { S.clearSession(); close(); }, true); } });
}
function renderSummary(s) {
  const all = steps(s), d = defOf(s);
  const main = all.map((x, i) => ({ x, i })).filter(o => o.x.sec === 'main');
  const doneMain = main.filter(o => s.log[o.i] && s.log[o.i].done).length;
  const ratio = main.length ? doneMain / main.length : 1;
  const status = s.status || (ratio >= 0.8 ? 'done' : 'partial');
  const exIds = Array.from(new Set(main.filter(o => !o.x.item.test).map(o => o.x.ex)));
  const FB = { easy: 'קל מדי', ok: 'מתאים', hard: 'קשה', fail: 'לא הושלם' };
  el.innerHTML = `<div class="run-top"><div class="grow"><h3>סיכום אימון</h3><span class="tiny muted">יום ${s.day} · ${esc(d.title)}</span></div></div>
    <div class="run-body">
      <div class="grid3"><div class="stat"><span class="v">${mmss(s.activeMs)}</span><span class="l">משך בפועל</span></div><div class="stat"><span class="v">${doneMain}/${main.length}</span><span class="l">סטים שהושלמו</span></div><div class="stat"><span class="v">${Math.round(ratio * 100)}%</span><span class="l">השלמה</span></div></div>
      <label class="field">סטטוס<select id="sm-st"><option value="done" ${status === 'done' ? 'selected' : ''}>הושלם</option><option value="partial" ${status === 'partial' ? 'selected' : ''}>הושלם חלקית</option></select></label>
      <div class="stack tight"><span class="small muted">כמה קשה היה האימון? (1 = קל מאוד, 10 = מקסימלי)</span><div class="rpe">${Array.from({ length: 10 }, (_, i) => `<button data-r="${i + 1}" aria-pressed="${s.rpe === i + 1}">${i + 1}</button>`).join('')}</div></div>
      ${Object.keys(s.tests).length ? `<div class="kv">${Object.entries(s.tests).filter(([, v]) => v != null).map(([k, v]) => `<span>${esc(P.TESTS[k].name)}: <b>${v} ${esc(P.TESTS[k].unit)}</b></span>`).join('')}</div>` : ''}
      ${exIds.length ? `<div class="card"><h4>איך הרגישו התרגילים?</h4><p class="tiny muted">משמש להצעות התאמה (לא משנה אוטומטית).</p>${exIds.map(id => `<div class="stack tight" style="padding:6px 0;border-bottom:1px dashed var(--line)"><b class="small">${esc(root.EX_BY_ID[id].he)}</b><div class="chips">${Object.entries(FB).map(([k, v]) => `<button class="chip" data-fb="${id}" data-v="${k}" aria-pressed="${s.feedback[id] === k}">${v}</button>`).join('')}</div></div>`).join('')}</div>` : ''}
      <label class="field">הערות<textarea id="sm-n" placeholder="איך היה? כאבים, אנרגיה, מה לשפר">${esc(s.notes || '')}</textarea></label>
    </div>
    <div class="run-bot"><button class="btn primary big" data-a="save">${icon('check')} שמירת האימון</button><button class="btn ghost" data-a="back">חזרה לאימון</button></div>`;
  el.querySelectorAll('[data-r]').forEach(b => b.addEventListener('click', () => { const ss = sess(); ss.rpe = +b.dataset.r; saveSess(ss); el.querySelectorAll('[data-r]').forEach(x => x.setAttribute('aria-pressed', x === b)); }));
  el.querySelectorAll('[data-fb]').forEach(b => b.addEventListener('click', () => { const ss = sess(); ss.feedback[b.dataset.fb] = b.dataset.v; saveSess(ss); el.querySelectorAll(`[data-fb="${b.dataset.fb}"]`).forEach(x => x.setAttribute('aria-pressed', x === b)); }));
  el.querySelector('#sm-n').addEventListener('input', ev => { const ss = sess(); ss.notes = ev.target.value; saveSess(ss); });
  el.querySelector('#sm-st').addEventListener('change', ev => { const ss = sess(); ss.status = ev.target.value; saveSess(ss); });
  el.querySelector('[data-a=back]').addEventListener('click', () => { const ss = sess(); ss.finished = false; ss.lastResume = Date.now(); ss.paused = false; ss.stepIdx = Math.min(ss.stepIdx, all.length - 1); saveSess(ss); render(); });
  el.querySelector('[data-a=save]').addEventListener('click', () => {
    const ss = sess(), w = S.load('workouts');
    const sets = all.map((x, i) => Object.assign({ key: i }, ss.log[i] || { done: false, ex: x.ex, sec: x.sec, set: x.set }));
    if (ss.plan) { /* personal plan: log into the plan (with a snapshot), never into the 30-day log */
      root.Plans.logDay(ss.plan.id, ss.plan.n, { status: el.querySelector('#sm-st').value, version: ss.version, durationSec: Math.round(ss.activeMs / 1000), sets, rpe: ss.rpe, notes: (ss.notes || '').trim(), source: 'run', feedback: Object.assign({}, ss.feedback) });
      Object.entries(ss.feedback).forEach(([ex, v]) => { w.feedback[ex] = (w.feedback[ex] || []).concat([v]).slice(-6); }); S.save('workouts');
      S.clearSession(); close(); location.hash = backHash(ss); root.UI.toast('האימון נשמר בתוכנית'); return;
    }
    const prev = w.days[ss.day];
    w.days[ss.day] = { status: el.querySelector('#sm-st').value, version: ss.version, date: S.today(), durationSec: Math.round(ss.activeMs / 1000), sets, rpe: ss.rpe, notes: (ss.notes || '').trim(), tests: Object.assign({}, prev && prev.tests || {}, Object.fromEntries(Object.entries(ss.tests).filter(([, v]) => v != null))), feedback: ss.feedback, startedAt: new Date(ss.startedAt).toISOString() };
    Object.entries(ss.feedback).forEach(([ex, v]) => { w.feedback[ex] = (w.feedback[ex] || []).concat([v]).slice(-6); });
    S.save('workouts'); S.clearSession(); close(); location.hash = '#/day/' + ss.day; root.UI.toast('האימון נשמר');
  });
}
function renderTestSummary(s) {
  const T = P.TESTS;
  el.innerHTML = `<div class="run-top"><div class="grow"><h3>סיכום מבחן הכושר</h3><span class="tiny muted">יום ${s.day} · ${esc(S.fmtDate(S.today()))}</span></div></div>
    <div class="run-body"><p class="small muted">בדקו את התוצאות. שדה ריק = המבחן לא בוצע ולא תירשם תוצאה.</p>
      ${Object.entries(T).map(([k, t]) => `<label class="field">${esc(t.name)} (${esc(t.unit)})<input type="number" inputmode="numeric" min="0" data-t="${k}" value="${s.tests[k] != null ? s.tests[k] : ''}"></label>`).join('')}
      <label class="field">גרסת שכיבות הסמיכה שבוצעה<select id="ts-var"><option value="full" ${s.pushVar !== 'knee' ? 'selected' : ''}>מלאות</option><option value="knee" ${s.pushVar === 'knee' ? 'selected' : ''}>על הברכיים</option></select></label>
      <label class="field">הערות (תנאים, שעה, תחושה)<textarea id="ts-n">${esc(s.notes || '')}</textarea></label>
      <p class="tiny faint">שיפור בתוצאות משקף ביצוע במבחן. הוא לא מוכיח בהכרח עלייה במסת שריר או ירידה בשומן.</p></div>
    <div class="run-bot"><button class="btn primary big" data-a="saveTest">${icon('check')} שמירת תוצאות המבחן</button><button class="btn ghost" data-a="back">חזרה למבחן</button></div>`;
  el.querySelector('[data-a=back]').addEventListener('click', () => { const ss = sess(); ss.finished = false; ss.lastResume = Date.now(); ss.paused = false; saveSess(ss); render(); });
  el.querySelector('[data-a=saveTest]').addEventListener('click', () => {
    const ss = sess(), w = S.load('workouts'); w.tests = w.tests || {};
    const results = {}; el.querySelectorAll('[data-t]').forEach(i => { if (i.value !== '' && +i.value >= 0) results[i.dataset.t] = +i.value; });
    if (ss.plan) { root.Plans.logDay(ss.plan.id, ss.plan.n, { status: 'done', version: 'test', tests: results, pushVar: el.querySelector('#ts-var').value, notes: el.querySelector('#ts-n').value.trim(), durationSec: Math.round(ss.activeMs / 1000), source: 'test-mode' });
      S.clearSession(); close(); location.hash = backHash(ss); root.UI.toast(Object.keys(results).length ? 'תוצאות המבחן נשמרו בתוכנית' : 'נשמר ללא תוצאות'); return; }
    w.tests[ss.day] = { date: S.today(), results, pushVar: el.querySelector('#ts-var').value, notes: el.querySelector('#ts-n').value.trim(), durationSec: Math.round(ss.activeMs / 1000), source: 'test-mode' };
    S.save('workouts'); S.clearSession(); close(); location.hash = '#/day/' + ss.day; root.UI.toast(Object.keys(results).length ? 'תוצאות המבחן נשמרו' : 'נשמר ללא תוצאות');
  });
}
root.Run = { start, open, close };
})(window);
