/* Active workout mode (on-demand chunk extra.js; main.js holds a stub that loads it). State is saved after every action so a closed
   app resumes where it stopped. States and allowed transitions: run_state.js (derived from the one session record). */
(function (root) {
if (root.Run && root.Run.real) return; /* loaded once — a second copy would run a second timer */
const { esc, icon } = root.UI;
const S = root.Store, C = root.Core, L = root.Logic, P = root.PROGRAM;
let el = null, tick = null, figStop = null, wake = null, audioCtx = null, lastRestBeep = null;

function sess() { return S.load('session'); }
function saveSess(s) { S.set('session', s); }
/* a session belongs either to the fixed 30-day program (s.day) or to a personal plan day (s.plan = {id, n}) */
function defOf(s) { return s.custom ? (root.Builder ? root.Builder.runDef(s.custom.id) : s.custom.def || null) : s.plan ? root.Plans.runDef(s.plan.id, s.plan.n) : C.dayDef(s.day); } /* s.custom = {id, def}: a Workout Builder workout (def kept so a reopened session runs without the chunk) */
function steps(s) { const d = defOf(s); return L.buildSteps(d, s.version).map(st => Object.assign({}, st, { ex: s.plan || s.custom ? st.ex : C.exFor(s.day, st.ex) })); }
const backHash = s => s.custom ? '#/builder/' + s.custom.id : s.plan ? '#/pday/' + s.plan.n : '#/day/' + s.day;
function elapsed(s) { return s.activeMs + (s.paused || !s.lastResume ? 0 : Date.now() - s.lastResume); }
const mmss = ms => { const t = Math.max(0, Math.round(ms / 1000)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
const PH = { warm: 'חימום', main: 'אימון', cool: 'שחרור' };
/* where a saved workout lives right now: always on the device first; with a signed-in account it is sent on the next sync */
const savedWhere = () => root.Account && root.Account.state && root.Account.state().signedIn ? ' במכשיר — יישלח לחשבון בסנכרון הבא' : ' במכשיר';

function start(day, version, plan, custom) {
  const ex = sess(), ck = c => c ? c.id : null;
  if (ex && (ex.day !== day || ex.version !== version || JSON.stringify(ex.plan || null) !== JSON.stringify(plan || null) || ck(ex.custom) !== ck(custom))) {
    /* fixed 25.10.2026: restarting used to drop the plan (it opened the 30-day day instead of the plan day) */
    root.UI.confirmSheet('יש אימון פתוח', `קיים אימון בתהליך (${ex.custom ? 'אימון שבניתי' : ex.plan ? 'יום ' + ex.plan.n + ' בתוכנית' : 'יום ' + ex.day}). להתחיל אימון חדש ולמחוק את ההתקדמות של הפתוח?`, 'התחלה מחדש', () => { S.clearSession(); start(day, version, plan, custom); }, true);
    return;
  }
  if (!ex) {
    const st = L.buildSteps(defOf({ day, plan, custom }), version);
    if (!st.length) { root.UI.toast('אין תרגילים ביום הזה'); return; }
    const begin = cfg => {
      saveSess({ plan: plan || null, custom: custom ? { id: custom.id, def: defOf({ custom }) } : null, day, version, stepIdx: 0, total: st.length, log: {}, startedAt: Date.now(), activeMs: 0, lastResume: Date.now(), seenAt: Date.now(), paused: false, rest: null, work: null, notes: '', rpe: null, tests: {}, feedback: {}, finished: false,
        mode: cfg.mode, cfg: { setRest: cfg.setRest, exRest: cfg.exRest, countdown: cfg.countdown, voice: cfg.voice }, cd: null, hold: null, restPlanMs: 0, restActualMs: 0 });
      open();
    };
    /* the setup sheet lives in the on-demand chunk (first-load budget); offline before it was ever loaded → last choices */
    const meta = { def: defOf({ day, plan, custom }), day, version, plan, custom };
    if (root.RunSetup) return root.RunSetup.setupSheet(st, begin, meta);
    return root.App.loadChunk('extra.js').then(() => root.RunSetup ? root.RunSetup.setupSheet(st, begin, meta) : begin(runPrefs()), () => { root.UI.toast('מתחילים לפי ההגדרות האחרונות'); begin(runPrefs()); });
  }
  open();
}
/* M11 · pre-start choices: manual vs. hands-free automatic mode, rest between sets / between exercises (null = the plan's own
   rest), countdown before each set, spoken cues. Remembered for next time (profile.display.run). Planned rest, actual rest and
   the estimated total are kept separate. */
const RUN_DEF = { mode: 'manual', setRest: null, exRest: null, countdown: 5, voice: false };
function runPrefs() { const d = C.profile().display || {}; return Object.assign({}, RUN_DEF, d.run || {}); }
/* estimated seconds of one set when the app cannot see the reps: ~3 s per rep (both sides if one-sided) + 5 s to get set */
const estSetSec = it => typeof it.reps === 'number' ? Math.max(15, Math.round(it.reps * (it.side ? 2 : 1) * 3 + 5)) : null;
function restAfter(all, i, cfg) { const a = all[i], b = all[i + 1]; if (!b) return 0; const same = b.sec === a.sec && b.idx === a.idx;
  if (a.sec !== 'main' || b.sec !== 'main') return a.rest || 0; /* warm-up / cool-down keep their own (short) transitions */
  const v = same ? cfg.setRest : cfg.exRest; return v != null ? v : (a.rest || 0); }
function estimateSec(all, cfg, auto) { let t = 0; all.forEach((x, i) => { const it = x.item; t += typeof it.sec === 'number' ? it.sec : (estSetSec(it) || 40); t += restAfter(all, i, cfg); if (auto) t += cfg.countdown || 0; }); return t; }
let opened = false; /* first open in this page life → check for an interrupted session */
function open() {
  const s = sess(); if (!s) return;
  if (!opened) { opened = true; if (root.RunState && root.RunState.recover(s, Date.now())) saveSess(s); }
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
/* fixed 25.10.2026: an open page returning from the background / a locked screen used to overwrite seenAt, so 2 h in the
   background counted as 2 h of workout (reproduced: 0:11 → 120:13). Now a gap > SUSPEND_MS freezes the session as interrupted. */
function checkSuspend() { const s = sess(); if (!el || !s || !root.RunState) return false;
  if (!root.RunState.recover(s, Date.now(), root.RunState.SUSPEND_MS)) return false; saveSess(s); render(); return true; }
window.addEventListener('pageshow', e => { if (e.persisted) checkSuspend(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && el) { requestWake(); if (checkSuspend()) return; } const s = sess(); if (el && s && !s.paused && !s.finished) { s.seenAt = Date.now(); saveSess(s); } });
window.addEventListener('pagehide', () => { const s = sess(); if (el && s && !s.paused && !s.finished) { s.seenAt = Date.now(); saveSess(s); } });
function beep() {
  if (!C.profile().display.sound) return;
  try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.frequency.value = 880; g.gain.value = 0.15; o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + 0.25); } catch (e) { }
  try { if (navigator.vibrate) navigator.vibrate([120, 60, 120]); } catch (e) { }
}
function say(t) { const s = sess(); if (!s || !s.cfg || !s.cfg.voice) return; try { if (!window.speechSynthesis) return; speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(t); u.lang = 'he-IL'; u.rate = 1.05; speechSynthesis.speak(u); } catch (e) { } }
/* M11 · automatic mode. Every phase has an absolute end time (endsAt), so time is never counted by setInterval ticks: after a
   locked screen or a background tab the elapsed time is still right. A phase that ended while the app was hidden is NOT
   completed retroactively — a work phase noticed >4 s late pauses the workout at that set (the set is not marked), so the
   user never "finishes" sets they did not see. */
const LATE = 4000;
function autoBegin(s, now, noCd) { /* start the current step: countdown → work, or wait for the user when the app cannot time it */
  const all = steps(s), st = all[s.stepIdx], it = st.item;
  if (it.test || it.sec === 'max' || it.reps === 'max') { s.hold = 'input'; s.cd = null; return; }
  const cd = (s.cfg && s.cfg.countdown) || 0;
  if (cd > 0 && !noCd) { s.cd = { endsAt: now + cd * 1000, idx: s.stepIdx }; say(`${root.EX_BY_ID[st.ex].he}. סט ${st.set} מתוך ${st.sets}`); return; }
  s.cd = null; const dur = typeof it.sec === 'number' ? it.sec : estSetSec(it);
  s.work = { startedAt: now, auto: true, dur, est: typeof it.sec !== 'number', idx: s.stepIdx }; if (!cd) say(`${root.EX_BY_ID[st.ex].he}. סט ${st.set} מתוך ${st.sets}`);
}
function autoStep(s) { /* returns true when the screen must re-render */
  const now = Date.now();
  if (s.mode !== 'auto' || s.paused || s.finished || s.hold) return false;
  if (s.rest) { if (now < s.rest.endsAt) return false; endRest(s, now); autoBegin(s, now); return true; }
  if (s.cd) { if (s.cd.idx !== s.stepIdx) { s.cd = null; return true; } if (now < s.cd.endsAt) return false; s.cd = null; autoBegin(s, now, true); beep(); return true; }
  if (s.work) { if (!s.work.auto || s.work.dur == null) return false; const end = s.work.startedAt + s.work.dur * 1000; if (now < end) return false;
    if (now - end > LATE) { s.activeMs = elapsed(s); s.paused = true; s.lastResume = null; s.hold = 'late'; s.work = null; return true; }
    complete(s, 'done', { auto: true }); return true; }
  autoBegin(s, now); return true;
}
function endRest(s, now) { if (!s.rest) return; s.restActualMs = (s.restActualMs || 0) + Math.max(0, Math.min(now, s.rest.endsAt + LATE) - s.rest.startedAt); s.rest = null; }
function onTick() {
  const s = sess(); if (!s || !el) return;
  if (!s.paused && !s.finished && root.RunState && Date.now() - (s.seenAt || 0) > root.RunState.SUSPEND_MS && checkSuspend()) return;
  if (!s.paused && !s.finished && Date.now() - (s.seenAt || 0) > 5000) { s.seenAt = Date.now(); saveSess(s); } /* heartbeat: the last moment the running app was seen */
  const e1 = el.querySelector('[data-el]'); if (e1) e1.textContent = mmss(elapsed(s));
  if (s.mode === 'auto') { if (s.rest && !s.paused && s.rest.endsAt - Date.now() <= 0 && lastRestBeep !== s.rest.endsAt) { lastRestBeep = s.rest.endsAt; beep(); }
    if (autoStep(s)) { saveSess(s); render(); return; }
    const c = el.querySelector('[data-cd]'); if (c && s.cd) c.textContent = Math.max(1, Math.ceil((s.cd.endsAt - Date.now()) / 1000)); }
  if (s.rest && !s.paused) {
    const left = s.rest.endsAt - Date.now(); const t = el.querySelector('[data-rest]'); if (t) t.textContent = mmss(left);
    if (left <= 0) { if (lastRestBeep !== s.rest.endsAt) { lastRestBeep = s.rest.endsAt; beep(); } endRest(s, Date.now()); saveSess(s); render(); }
  }
  if (s.work && !s.paused) {
    const st = steps(s)[s.stepIdx]; const dur = s.work.dur != null ? s.work.dur : st.item.sec === 'max' ? null : setDur(st.item);
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
  const auto = s.mode === 'auto';
  if (s.rest) { const pi = s.rest.after != null ? s.rest.after : s.stepIdx - 1, pr = s.log[pi], SFB = { easy: 'קל', ok: 'מתאים', hard: 'קשה', fail: 'לא הושלם' };
    const fbBlock = pr && pr.done && pr.sec === 'main' && !(all[pi] && all[pi].item.test) ? `<div class="stack tight" data-set-fb style="width:100%"><span class="small">איך היה הסט הקודם (${esc(root.EX_BY_ID[pr.ex].he)}, סט ${pr.set})? <span class="tiny muted">רשות — הטיימר ממשיך</span></span>
      <div class="chips">${Object.entries(SFB).map(([k, v]) => `<button class="chip" data-sfb="${k}" data-i="${pi}" aria-pressed="${pr.fb === k}">${v}</button>`).join('')}</div>
      ${pr.reps != null ? `<div class="row between small"><span>חזרות שבוצעו${pr.assumed ? ' <span class="tiny muted">(לפי היעד — אפשר לתקן)</span>' : ''}</span><span class="row"><button class="btn sm" data-srep="-1" data-i="${pi}" aria-label="פחות חזרות">−</button><b class="num" data-srv="${pi}">${pr.reps}</b><button class="btn sm" data-srep="1" data-i="${pi}" aria-label="יותר חזרות">+</button></span></div>` : ''}</div>` : '';
    restBlock = `<div class="rest-panel" data-rest-panel><span class="phase-tag">מנוחה${s.rest.planned ? ' · מתוכנן ' + s.rest.planned + ' שנ׳' : ''}</span><div class="timer" data-rest>${mmss(s.rest.endsAt - Date.now())}</div><div class="btns" style="width:100%"><button class="btn sm" data-a="restM15">−15 שנ׳</button><button class="btn sm" data-a="rest15">+15 שנ׳</button><button class="btn sm primary" data-a="skipRest">דלג על המנוחה</button></div><p class="small">הבא: <b>${esc(root.EX_BY_ID[st.ex].he)}</b> · סט ${st.set}/${st.sets}${auto ? ' · מתחיל אוטומטית' : ''}</p>${fbBlock}</div>`; }
  let autoBlock = '';
  if (auto && !s.rest) {
    if (s.hold === 'interrupted') autoBlock = '';
    else if (s.hold === 'late') autoBlock = `<div class="banner warn" data-auto-late>${icon('pause')}<div class="grow">האימון הושהה כי האפליקציה הייתה ברקע או שהמסך ננעל. הסט הזה <b>לא</b> סומן כבוצע.</div><button class="btn sm primary" data-a="resume">המשך מהסט הזה</button></div>`;
    else if (s.hold === 'input') autoBlock = `<div class="banner info small" data-auto-hold>${icon('info')}<div class="grow">${it.test ? 'מבדק — הזינו את התוצאה ולחצו "סיימתי סט".' : 'סט "מקסימום" — האפליקציה לא יודעת מתי סיימתם.'} המצב האוטומטי ממשיך אחרי הלחיצה.</div>${timed && it.sec === 'max' && !s.work ? `<button class="btn sm primary" data-a="go">התחלה</button>` : ''}</div>`;
    else if (s.cd) autoBlock = `<div class="rest-panel" data-auto-cd><span class="phase-tag">מתחילים בעוד</span><div class="timer" data-cd>${Math.max(1, Math.ceil((s.cd.endsAt - Date.now()) / 1000))}</div><p class="small"><b>${esc(e.he)}</b> · סט ${st.set}/${st.sets}</p></div>`;
    else if (s.work && s.work.auto) autoBlock = `<div class="card" data-auto-work><span class="phase-tag">${s.work.est ? 'זמן משוער לסט' : 'זמן עבודה'}</span><div class="timer" data-work>${mmss(s.work.startedAt + s.work.dur * 1000 - Date.now())}</div>${s.work.est ? '<p class="tiny muted">הערכה של כ־3 שניות לחזרה. סיימתם קודם? לחצו "סיימתי סט".</p>' : ''}</div>`;
  }
  el.innerHTML = `
    <div class="run-top"><button class="icon-btn" data-a="exit" aria-label="יציאה">${icon('close')}</button><div class="grow"><h3>${esc(d.title)}</h3><span class="tiny muted">${s.custom ? 'אימון שבניתי' : 'יום ' + s.day} · גרסה ${esc(L.VERSIONS[s.version])} (~${L.estimateMinutes(d, s.version)} דק׳) · <span class="num" data-el>${mmss(elapsed(s))}</span>${s.paused ? ' · <b class="warn">מושהה</b>' : ''} · <span data-run-mode>${auto ? 'אוטומטי' : 'ידני'}</span></span></div><button class="icon-btn" data-a="settings" aria-label="הגדרות אימון: מצב ומנוחה">${icon('gear')}</button><button class="icon-btn" data-a="${s.paused ? 'resume' : 'pause'}" aria-label="${s.paused ? 'המשך' : 'השהיה'}">${icon(s.paused ? 'play' : 'pause')}</button></div>
    <div class="run-prog"><i style="width:${(s.stepIdx / all.length * 100).toFixed(1)}%"></i></div>
    <div class="run-body">
      ${s.hold === 'interrupted' ? `<div class="banner warn" data-run-interrupted>${icon('pause')}<div class="grow">האימון נקטע — האפליקציה נסגרה, נטענה מחדש או הייתה ברקע זמן רב${s.interruptedAt ? ' (ב־' + new Date(s.interruptedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) + ')' : ''}. הזמן נעצר באותו רגע ושום סט לא סומן מעצמו. ההתקדמות נשמרה.</div><button class="btn sm primary" data-a="resume">המשך מכאן</button></div>` : s.paused ? `<div class="banner warn">${icon('pause')}<div class="grow">האימון מושהה. הזמן לא נספר.</div><button class="btn sm primary" data-a="resume">המשך</button></div>` : ''}
      ${restBlock}${autoBlock}
      <div class="row between"><span class="phase-tag">${PH[st.sec]}${roundInfo} · שלב ${s.stepIdx + 1}/${all.length}</span><span class="set-dots" aria-label="סטים">${sameItem.map(o => `<i class="${s.log[o.i] && s.log[o.i].done ? 'done' : o.i === s.stepIdx ? 'cur' : ''}"></i>`).join('')}</span></div>
      <div class="run-ex">${esc(e.he)}</div>
      <div class="demo" id="run-fig"><span class="tag pill">איור המחשה</span><span class="phase" data-phase></span></div>
      <div class="run-target"><span class="big">${tg.big}</span><span class="muted">${esc(tg.unit)}</span><span class="pill">סט ${st.set}/${st.sets}</span>${it.rest && st.sec === 'main' ? `<span class="pill">מנוחה ${st.rest} שנ׳</span>` : ''}</div>
      ${st.sec === 'main' && !it.test ? `<p class="small"><b>רמה ${C.LEVEL_HE[lvl]}:</b> ${esc(e.levels[lvl])}</p>` : ''}
      ${it.note && !it.test ? `<p class="small acc">${esc(it.note)}</p>` : ''}
      ${timed && !(auto && (s.work && s.work.auto || s.cd || s.hold === 'late')) ? `<div class="card"><div class="timer" data-work>${s.work ? '' : mmss((it.sec === 'max' ? 0 : it.sec) * 1000)}</div><button class="btn ${s.work ? '' : 'outline'}" data-a="${s.work ? 'stopWork' : 'startWork'}">${s.work ? 'עצירת טיימר' : icon('timer') + ' הפעלת טיימר'}</button></div>` : ''}
      ${it.test ? `<div class="banner info small"><div><b>${esc(P.TESTS[it.test].name)}</b><br>${esc(P.TESTS[it.test].how)}</div></div><label class="field">התוצאה שלך (${esc(P.TESTS[it.test].unit)}) — השאירו ריק אם לא בוצע<input type="number" id="run-test" inputmode="numeric" min="0" value="${s.tests[it.test] != null ? s.tests[it.test] : ''}"></label>` : ''}
      <details class="more" ${(C.profile().display || {}).explain === 'detail' ? 'open' : ''} data-howto><summary>איך מבצעים</summary><div class="stack tight small"><p>${esc(e.start)}</p><ol class="steps">${e.steps.map(x => `<li>${esc(x)}</li>`).join('')}</ol><p><b>נשימה:</b> ${esc(e.breath)}</p><p><b>להימנע:</b> ${esc(e.mistakes.join(' · '))}</p></div></details>
    </div>
    <div class="run-bot">
      ${!timed && !it.test && st.sec === 'main' ? `<div class="row between"><span class="small muted">חזרות בפועל</span><div class="stepper"><button data-a="rm" aria-label="פחות">−</button><input type="number" id="run-reps" inputmode="numeric" value="${lg && lg.reps != null ? lg.reps : (it.reps || 0)}" aria-label="חזרות בפועל"><button data-a="rp" aria-label="יותר">+</button></div></div>` : ''}
      <button class="btn primary big" data-a="done" data-idx="${s.stepIdx}">${icon('check')} ${lg && lg.done ? 'עדכון סט' : 'סיימתי סט'}</button>
      <div class="btns"><button class="btn sm" data-a="prevEx" ${s.stepIdx === 0 ? 'disabled' : ''}>${icon('prev')} תרגיל קודם</button><button class="btn sm" data-a="skip" data-idx="${s.stepIdx}">דלג על סט</button><button class="btn sm" data-a="nextEx" ${!next ? 'disabled' : ''}>תרגיל הבא ${icon('next')}</button></div>
    </div>`;
  const fig = el.querySelector('#run-fig'); figStop = root.App.mountFig(fig, null, true);
  el.querySelectorAll('[data-a]').forEach(b => b.addEventListener('click', () => act(b.dataset.a, b.dataset.idx != null ? { idx: +b.dataset.idx } : null)));
  { const wait = ARM - (Date.now() - lastAdvance); if (wait > 0) { const bs = [...el.querySelectorAll('[data-a=done],[data-a=skip]')]; bs.forEach(b => { b.disabled = true; }); setTimeout(() => bs.forEach(b => { b.disabled = false; }), wait); } }
  /* per-set quick feedback during the rest — never blocks or pauses the timer; stored with the set it belongs to */
  el.querySelectorAll('[data-sfb]').forEach(b => b.addEventListener('click', () => { const ss = sess(), i = +b.dataset.i, r = ss.log[i]; if (!r) return; r.fb = r.fb === b.dataset.sfb ? null : b.dataset.sfb;
    if (r.fb === 'fail' && !ss.feedback[r.ex]) ss.feedback[r.ex] = 'fail'; saveSess(ss); el.querySelectorAll(`[data-sfb][data-i="${i}"]`).forEach(x => x.setAttribute('aria-pressed', x.dataset.sfb === r.fb)); }));
  el.querySelectorAll('[data-srep]').forEach(b => b.addEventListener('click', () => { const ss = sess(), i = +b.dataset.i, r = ss.log[i]; if (!r || r.reps == null) return; r.reps = Math.max(0, r.reps + (+b.dataset.srep)); r.assumed = false; saveSess(ss); const o = el.querySelector(`[data-srv="${i}"]`); if (o) o.textContent = r.reps; }));
  const ti = el.querySelector('#run-test'); if (ti) ti.addEventListener('change', () => { const ss = sess(); ss.tests[it.test] = ti.value === '' ? null : +ti.value; saveSess(ss); });
}
function firstOfItem(all, i) { const a = all[i]; let j = i; while (j > 0 && all[j - 1].sec === a.sec && all[j - 1].idx === a.idx) j--; return j; }
/* M11 · one place that completes or skips the current set — used by the buttons and by the automatic mode. Guards against a
   double advance: a click carries the step index it was rendered for (stale → ignored), and right after an advance the new
   "done"/"skip" buttons stay disabled for ARM ms, so a double tap (or a tap racing the auto timer) completes one set only. */
let lastAdvance = 0; const ARM = 450;
function complete(s, a, opt) {
  const all = steps(s), st = all[s.stepIdx], it = st.item, now = Date.now();
  if (opt && opt.idx != null && opt.idx !== s.stepIdx) return false;
  if (!(opt && opt.auto) && now - lastAdvance < ARM) return false; lastAdvance = now;
  if (s.paused) { s.paused = false; s.lastResume = now; }
  const rec = { done: a === 'done', ex: st.ex, sec: st.sec, set: st.set };
  if (a === 'done') {
    const ri = el ? el.querySelector('#run-reps') : null;
    if (it.test) { const ti = el && el.querySelector('#run-test'); if (ti && ti.value !== '') { s.tests[it.test] = +ti.value; rec.reps = +ti.value; } }
    else if (ri) { rec.reps = +ri.value || 0; if (opt && opt.auto && rec.reps === it.reps) rec.assumed = true; } /* automatic mode cannot count reps: an untouched target is marked "assumed" and stays editable during the rest */
    else if (typeof it.reps === 'number' && opt && opt.auto) { rec.reps = it.reps; rec.assumed = true; }
    else if (it.sec) rec.secs = s.work ? Math.min(Math.round((now - s.work.startedAt) / 1000), it.sec === 'max' ? 1e9 : it.sec) : (s.workSecs != null ? s.workSecs : (it.sec === 'max' ? null : it.sec));
    if (it.reps && typeof it.reps === 'number' && rec.reps != null && rec.reps < it.reps * 0.7 && st.sec === 'main') { const fb = s.feedback[st.ex] || null; if (!fb) s.feedback[st.ex] = 'fail'; }
    if (opt && opt.auto) rec.auto = true;
  }
  s.log[s.stepIdx] = rec; s.work = null; s.workSecs = null; s.cd = null; s.hold = null;
  if (s.stepIdx >= all.length - 1) { s.activeMs = elapsed(s); s.lastResume = null; s.finished = true; s.rest = null; }
  else { const restSec = a === 'done' ? restAfter(all, s.stepIdx, Object.assign({}, RUN_DEF, s.cfg || {})) : 0; s.stepIdx++;
    s.rest = restSec > 0 ? { endsAt: now + restSec * 1000, startedAt: now, planned: restSec, after: s.stepIdx - 1 } : null;
    if (s.rest) { s.restPlanMs = (s.restPlanMs || 0) + restSec * 1000; if (s.mode === 'auto') say('מנוחה ' + restSec + ' שניות'); } }
  return true;
}
const EV = { done: 'set_done', skip: 'set_skip', pause: 'pause', resume: 'resume', rest15: 'rest_adjust', restM15: 'rest_adjust', skipRest: 'rest_end', go: 'timer_start', startWork: 'timer_start', stopWork: 'timer_stop', nextEx: 'navigate', prevEx: 'navigate' };
function act(a, opt) {
  const s = sess(); if (!s) return; const all = steps(s), st = all[s.stepIdx], it = st.item;
  if (EV[a] && root.RunState && !root.RunState.can(s, EV[a])) { console.warn('run: ignored "' + a + '" in state ' + root.RunState.of(s)); return render(); } /* invalid transition: no change */
  const now = Date.now();
  if (a === 'pause') { s.activeMs = elapsed(s); s.paused = true; s.lastResume = null; if (s.rest) s.rest.left = s.rest.endsAt - now; if (s.work) s.work.pausedAt = now; if (s.cd) s.cd = null; }
  else if (a === 'resume') { s.paused = false; s.lastResume = now; s.seenAt = now; if (s.rest && s.rest.left != null) { s.rest.endsAt = now + s.rest.left; delete s.rest.left; } if (s.work && s.work.pausedAt) { s.work.startedAt += now - s.work.pausedAt; delete s.work.pausedAt; } if (s.hold === 'late' || s.hold === 'interrupted') { s.hold = null; delete s.interruptedAt; } }
  else if (a === 'rest15') { if (s.rest) { s.rest.endsAt += 15000; s.restPlanMs = (s.restPlanMs || 0) + 15000; } }
  else if (a === 'restM15') { if (s.rest) { s.rest.endsAt = Math.max(now + 3000, s.rest.endsAt - 15000); } }
  else if (a === 'skipRest') { endRest(s, now); if (s.mode === 'auto' && !s.paused) autoBegin(s, now); }
  else if (a === 'go') { if (s.hold === 'input') { s.hold = null; s.work = { startedAt: now, idx: s.stepIdx }; } }
  else if (a === 'settings') { return root.RunSetup ? root.RunSetup.settingsSheet() : root.App.loadChunk('extra.js').then(() => root.RunSetup && root.RunSetup.settingsSheet(), () => root.UI.toast('ההגדרות זמינות עם חיבור לאינטרנט')); }
  else if (a === 'startWork') { s.work = { startedAt: now }; s.rest = null; }
  else if (a === 'stopWork') { const secs = Math.round((now - s.work.startedAt) / 1000); s.workSecs = it.sec === 'max' ? secs : Math.min(it.sec, secs); s.work = null; if (it.test && it.sec === 'max') s.tests[it.test] = Math.min(180, s.workSecs); }
  else if (a === 'rm' || a === 'rp') { const i = el.querySelector('#run-reps'); i.value = Math.max(0, (+i.value || 0) + (a === 'rp' ? 1 : -1)); return; }
  else if (a === 'done' || a === 'skip') { if (!complete(s, a, opt)) return; }
  else if (a === 'nextEx') { let j = s.stepIdx + 1; while (j < all.length && all[j].sec === st.sec && all[j].idx === st.idx) j++; if (j < all.length) { endRest(s, now); s.stepIdx = j; s.work = null; s.cd = null; s.hold = null; } }
  else if (a === 'prevEx') { const f = firstOfItem(all, s.stepIdx); const j = f > 0 ? firstOfItem(all, f - 1) : 0; endRest(s, now); s.stepIdx = s.stepIdx !== f ? f : j; s.work = null; s.cd = null; s.hold = null; }
  else if (a === 'exit') { if (s.mode === 'auto' && !s.paused) { s.activeMs = elapsed(s); s.paused = true; s.lastResume = null; if (s.rest) s.rest.left = s.rest.endsAt - now; if (s.work) s.work.pausedAt = now; s.cd = null; } saveSess(s); return exitSheet(); } /* Safe Stop: the auto timers never keep running behind the exit sheet */
  saveSess(s); render();
}
function exitSheet() {
  root.UI.sheet('יציאה ממצב אימון', `<p class="small muted">ההתקדמות נשמרת אוטומטית.</p><div class="stack"><button class="btn primary" data-act="keep">שמירה ויציאה — אמשיך אחר כך</button><button class="btn" data-act="finish">סיום האימון עכשיו (סיכום)</button><button class="btn danger" data-act="discard">ביטול האימון ומחיקת ההתקדמות</button></div>`,
    { keep: (b, e, cl) => { cl(); const s = sess(); s.activeMs = elapsed(s); s.paused = true; s.lastResume = null; s.parked = true; saveSess(s); close(); },
      finish: (b, e, cl) => { cl(); const s = sess(); s.activeMs = elapsed(s); s.lastResume = null; s.finished = true; s.rest = null; s.work = null; s.hold = null; delete s.interruptedAt; saveSess(s); render(); },
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
  exIds.forEach(id => { if (s.feedback[id]) return; const last = main.filter(o => o.x.ex === id && s.log[o.i] && s.log[o.i].fb).pop(); if (last) s.feedback[id] = s.log[last.i].fb; }); /* prefill from the per-set answers; still only a suggestion input */
  el.innerHTML = `<div class="run-top"><div class="grow"><h3>סיכום אימון</h3><span class="tiny muted">${s.custom ? 'אימון שבניתי' : 'יום ' + s.day} · ${esc(d.title)}</span></div></div>
    <div class="run-body">
      <div class="grid3"><div class="stat"><span class="v">${mmss(s.activeMs)}</span><span class="l">משך בפועל</span></div><div class="stat"><span class="v">${doneMain}/${main.length}</span><span class="l">סטים שהושלמו</span></div><div class="stat"><span class="v">${Math.round(ratio * 100)}%</span><span class="l">השלמה</span></div></div>
      ${(() => { const assumed = main.filter(o => s.log[o.i] && s.log[o.i].assumed).length, fbs = main.map(o => s.log[o.i] && s.log[o.i].fb).filter(Boolean), FBS = { easy: 'קל', ok: 'מתאים', hard: 'קשה', fail: 'לא הושלם' };
        return `<div class="kv small" data-run-stats><span>מצב: <b>${s.mode === 'auto' ? 'אוטומטי ורציף' : 'ידני'}</b></span>${s.restPlanMs ? `<span>מנוחה מתוכננת: <b>${mmss(s.restPlanMs)}</b> · בפועל: <b>${mmss(s.restActualMs || 0)}</b></span>` : ''}${assumed ? `<span>${assumed} סטים נרשמו לפי היעד (לא נספרו חזרות)</span>` : ''}${fbs.length ? `<span>משוב סטים: ${Object.entries(FBS).map(([k, v]) => [v, fbs.filter(x => x === k).length]).filter(x => x[1]).map(x => x[0] + ' ' + x[1]).join(' · ')}</span>` : ''}</div>`; })()}
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
  el.querySelector('[data-a=back]').addEventListener('click', () => { const ss = sess(); ss.finished = false; ss.lastResume = Date.now(); ss.seenAt = Date.now(); ss.paused = false; ss.hold = null; ss.stepIdx = Math.min(ss.stepIdx, all.length - 1); saveSess(ss); render(); });
  el.querySelector('[data-a=save]').addEventListener('click', () => {
    const ss = sess(), w = S.load('workouts'); if (!ss || !ss.finished || ss.saving) return; ss.saving = true; /* completion is recorded once */
    const sets = all.map((x, i) => Object.assign({ key: i }, ss.log[i] || { done: false, ex: x.ex, sec: x.sec, set: x.set }));
    if (ss.custom) { /* Workout Builder: logged with a frozen snapshot; the 30-day log and plans are not touched */
      const rec = { runId: 'r' + ss.startedAt, status: el.querySelector('#sm-st').value, durationSec: Math.round(ss.activeMs / 1000), sets, rpe: ss.rpe, mode: ss.mode || 'manual', notes: (ss.notes || '').trim() };
      if (root.Builder) root.Builder.logRun(ss.custom.id, rec); else { w.customLog = (w.customLog || []).concat([Object.assign({ wid: ss.custom.id, date: S.today(), at: new Date().toISOString(), snapshot: ss.custom.def }, rec)]); }
      Object.entries(ss.feedback).forEach(([ex, v]) => { w.feedback[ex] = (w.feedback[ex] || []).concat([v]).slice(-6); }); S.save('workouts');
      S.clearSession(); close(); location.hash = backHash(ss); root.UI.toast('האימון נשמר בהיסטוריה' + savedWhere()); return;
    }
    if (ss.plan) { /* personal plan: log into the plan (with a snapshot), never into the 30-day log */
      root.Plans.logDay(ss.plan.id, ss.plan.n, { status: el.querySelector('#sm-st').value, version: ss.version, durationSec: Math.round(ss.activeMs / 1000), sets, rpe: ss.rpe, mode: ss.mode || 'manual', restPlannedSec: Math.round((ss.restPlanMs || 0) / 1000), restActualSec: Math.round((ss.restActualMs || 0) / 1000), notes: (ss.notes || '').trim(), source: 'run', feedback: Object.assign({}, ss.feedback) });
      Object.entries(ss.feedback).forEach(([ex, v]) => { w.feedback[ex] = (w.feedback[ex] || []).concat([v]).slice(-6); }); S.save('workouts');
      S.clearSession(); close(); location.hash = backHash(ss); root.UI.toast('האימון נשמר בתוכנית' + savedWhere()); return;
    }
    const prev = w.days[ss.day];
    w.days[ss.day] = { status: el.querySelector('#sm-st').value, version: ss.version, date: S.today(), durationSec: Math.round(ss.activeMs / 1000), sets, rpe: ss.rpe, mode: ss.mode || 'manual', restPlannedSec: Math.round((ss.restPlanMs || 0) / 1000), restActualSec: Math.round((ss.restActualMs || 0) / 1000), notes: (ss.notes || '').trim(), tests: Object.assign({}, prev && prev.tests || {}, Object.fromEntries(Object.entries(ss.tests).filter(([, v]) => v != null))), feedback: ss.feedback, startedAt: new Date(ss.startedAt).toISOString() };
    Object.entries(ss.feedback).forEach(([ex, v]) => { w.feedback[ex] = (w.feedback[ex] || []).concat([v]).slice(-6); });
    S.save('workouts'); S.clearSession(); close(); location.hash = '#/day/' + ss.day; root.UI.toast('האימון נשמר' + savedWhere());
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
    const ss = sess(), w = S.load('workouts'); if (!ss || !ss.finished || ss.saving) return; ss.saving = true; w.tests = w.tests || {};
    const results = {}; el.querySelectorAll('[data-t]').forEach(i => { if (i.value !== '' && +i.value >= 0) results[i.dataset.t] = +i.value; });
    if (ss.plan) { root.Plans.logDay(ss.plan.id, ss.plan.n, { status: 'done', version: 'test', tests: results, pushVar: el.querySelector('#ts-var').value, notes: el.querySelector('#ts-n').value.trim(), durationSec: Math.round(ss.activeMs / 1000), source: 'test-mode' });
      S.clearSession(); close(); location.hash = backHash(ss); root.UI.toast(Object.keys(results).length ? 'תוצאות המבחן נשמרו בתוכנית' : 'נשמר ללא תוצאות'); return; }
    w.tests[ss.day] = { date: S.today(), results, pushVar: el.querySelector('#ts-var').value, notes: el.querySelector('#ts-n').value.trim(), durationSec: Math.round(ss.activeMs / 1000), source: 'test-mode' };
    S.save('workouts'); S.clearSession(); close(); location.hash = '#/day/' + ss.day; root.UI.toast(Object.keys(results).length ? 'תוצאות המבחן נשמרו' : 'נשמר ללא תוצאות');
  });
}
root.Run = { real: true, start, open, close, state: () => root.RunState ? root.RunState.of(sess()) : null, _: { RUN_DEF, runPrefs, estimateSec, sess, saveSess, steps, act: (a, o) => act(a, o), render: () => render() } };
})(window);
