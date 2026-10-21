/* M12 · Constraint Conflict Resolver UI (on-demand chunk extra.js) — renders Gate results with: what conflicts, why, and practical
   options that act through the EXISTING mechanisms (classic swap = workouts.swaps, plan swap = Plans.swap/alternatives, shorter
   version = Plans.setVersion or starting the short version, meals = MealOpt, profile/settings for goals). When the user has to
   decide (goal contradictions), ONE focused question is shown; nothing is changed silently.
   Explanation mode (profile.display.explain: 'short' | 'detail') controls how much "why" is shown; every line is tagged as
   based on your settings / estimate / recommendation. */
(function (root) {
'use strict';
const { esc, icon } = root.UI; const S = root.Store, C = root.Core, G = () => root.Gate;
const detail = () => ((C.profile().display || {}).explain === 'detail');
const TAG = { data: 'לפי ההגדרות שלך', est: 'הערכה', rec: 'המלצה' };
const tag = k => `<span class="pill tag-${k}" data-tag="${k}">${TAG[k]}</span>`;
const SEV = { block: 'סותר הגדרה', warn: 'שימו לב', info: 'לידיעה' };
/* alternatives for an exercise that pass the gate: classic → library alts; plan → Plans.alternatives (ranked) */
function altsFor(is, env) {
  const ctx = env.ctx || G().ctxFor(env.plan, env.n, env.date);
  if (env.plan && root.Plans) { const d = root.Plans.dayOf(env.plan, env.n), idx = d && (d.main || []).findIndex(x => x.ex === is.ex); if (idx == null || idx < 0) return [];
    return (root.Plans.alternatives(env.plan, env.n, idx).list || []).filter(a => !G().exIssues(a.id, ctx).some(x => x.sev === 'block')).slice(0, 3).map(a => ({ id: a.id, idx })); }
  const orig = env.origOf ? env.origOf(is.ex) : is.ex, e = root.EX_BY_ID[orig] || root.EX_BY_ID[is.ex];
  return [orig].concat((e && e.alts) || []).filter((x, i, a) => a.indexOf(x) === i && x !== is.ex && root.EX_BY_ID[x] && !G().exIssues(x, ctx).length).slice(0, 3).map(id => ({ id, orig }));
}
function fixes(is, env) {
  const b = (fix, label, data) => `<button class="btn sm" data-act="gateFix" data-fix="${fix}" ${Object.entries(data || {}).map(([k, v]) => `data-${k}="${esc(String(v))}"`).join(' ')}>${esc(label)}</button>`;
  if (['equipment', 'excluded', 'impact'].includes(is.kind) && is.ex) { const al = altsFor(is, env);
    return al.length ? al.map(a => b('swap', 'החלפה ב' + root.EX_BY_ID[a.id].he, { ex: is.ex, to: a.id, orig: a.orig || '', idx: a.idx != null ? a.idx : '' })).join('') : `<span class="small muted">אין חלופה שמתאימה לכל ההגדרות — ${env.plan ? 'אפשר לעדכן ציוד בתוכנית' : 'אפשר לעדכן ציוד בפרופיל'}.</span>${b('profile', 'לעדכון ההגדרות')}`; }
  if (is.kind === 'time') return (env.canShort ? b('short', 'גרסה קצרה') : '') + `<span class="tiny muted">או להתחיל ולעצור כשנגמר הזמן — מה שבוצע נשמר כ"חלקי".</span>`;
  if (['goal-weight', 'goal-mix', 'sessions', 'too-short'].includes(is.kind)) return b('profile', 'לעדכון בפרופיל');
  if (['no-valid-meal', 'restriction', 'dislike', 'prep'].includes(is.kind) && is.slot) return b('meal', 'בחירת מנה מתאימה', { slot: is.slot });
  return '';
}
function panel(res, env) {
  env = env || {}; const iss = (res.issues || []).filter(x => x.sev !== 'info' || env.showInfo), d = detail();
  if (!iss.length) return `<div class="banner good small" data-gate="ok">${icon('check')}<div>נבדק: מתאים ${env.what || 'להגדרות שלך'}. ${tag('data')}${(res.unknown || []).length ? `<br><span class="tiny muted">לא נבדק (לא הוגדר): ${esc(res.unknown.join(', '))}.</span>` : ''}</div></div>`;
  const ask = iss.find(x => x.ask);
  return `<div class="stack tight" data-gate="${G().worst(iss)}">${ask ? `<div class="banner warn small" data-gate-ask><div><b>שאלה אחת:</b> ${esc(ask.ask)} <span class="tiny muted">(לא משנים כלום בלי ההחלטה שלך)</span></div></div>` : ''}
    ${iss.map(x => `<div class="gate-i" data-gate-kind="${x.kind}" data-sev="${x.sev}"><div class="row between"><b class="small">${esc(x.text)}</b><span class="pill ${x.sev === 'block' ? 'bad' : ''}">${SEV[x.sev]}</span></div>
      ${x.why ? (d ? `<p class="tiny muted">למה: ${esc(x.why)}${x.days ? ` · ימים ${x.days.slice(0, 8).join(', ')}${x.days.length > 8 ? '…' : ''}` : ''} ${tag('data')}</p>` : `<details class="tiny"><summary>למה?</summary><p class="muted">${esc(x.why)}${x.days ? ` · ימים ${x.days.slice(0, 8).join(', ')}` : ''} ${tag('data')}</p></details>`) : ''}
      ${env.readOnly ? '' : `<div class="btns" data-gate-fix>${fixes(x, env)}</div>`}</div>`).join('')}${env.readOnly && env.fixHint ? `<p class="small" data-gate-hint>${env.fixHint}</p>` : ''}</div>`;
}
/* env: { date, plan, n, origOf, onShort, onDone } — returns UI.bind handlers */
function handlers(env) {
  return { gateFix: el => { const f = el.dataset.fix, done = msg => { if (msg) root.UI.toast(msg); if (env.onDone) env.onDone(); else root.App.render(); };
    try {
      if (f === 'swap') { if (env.plan) { root.Plans.swap(env.plan.id, env.n, +el.dataset.idx, el.dataset.to, 'day'); return done('התרגיל הוחלף ליום הזה'); }
        const w = S.load('workouts'), orig = el.dataset.orig || el.dataset.ex; w.swaps[env.n] = w.swaps[env.n] || {}; if (el.dataset.to === orig) delete w.swaps[env.n][orig]; else w.swaps[env.n][orig] = el.dataset.to;
        if (S.save('workouts') === false && S.storageOKAtStart) return root.UI.toast('השמירה נכשלה — לא הוחלף'); return done('התרגיל הוחלף ליום ' + env.n); }
      if (f === 'short') return env.onShort && env.onShort();
      if (f === 'profile') { root.UI.closeAllSheets && root.UI.closeAllSheets(); location.hash = '#/profile'; return; }
      if (f === 'meal') return root.MealOpt && root.MealOpt.sheet(env.date || S.today(), el.dataset.slot);
    } catch (e) { root.UI.toast(e.message || 'הפעולה לא הצליחה'); } } };
}
(function () { if (document.getElementById('gate-css')) return; const st = document.createElement('style'); st.id = 'gate-css';
  st.textContent = '.gate-i{border:1px solid var(--line);border-radius:var(--r);padding:8px 10px;display:flex;flex-direction:column;gap:6px}.gate-i[data-sev=block]{border-color:var(--bad,#d66)}.gate-i .btns .btn{white-space:normal;height:auto;min-height:40px}.pill.bad{color:var(--bad,#d66)}[data-tag]{font-size:.72em}';
  document.head.appendChild(st); })();
root.GateUI = { panel, handlers, tag, detail, altsFor };
})(window);
