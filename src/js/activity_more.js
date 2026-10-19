/* RC5 · Activity, part 2 (on-demand chunk extra.js): measured-data import, health-source connection, MoveScore v0.
   Extends root.Activity from activity.js. See the rules at the top of activity.js. */
(function (root) {
'use strict';
const S = () => root.Store, A = root.Activity, env = A.env, health = A.health, day = A.day, targetOn = A.targetOn, SRC_HE = A.SRC_HE;
const tracking = () => S().load('tracking');
/* rows: [{ date:'YYYY-MM-DD', steps:number }] from the platform's daily aggregation. Idempotent: replaces, never adds. */
function applyMeasured(rows, src, syncedAt) {
  if (!SRC_HE[src]) throw new Error('unknown source ' + src);
  const t = tracking(); t.measured = t.measured || {}; let n = 0;
  /* a 0 bucket is skipped: on iOS 'no permission' and 'no data' both read as 0/empty, so a 0 must never overwrite a typed-in value */
  for (const r of rows || []) { if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date) || !(r.steps > 0) || !isFinite(r.steps)) continue; t.measured[r.date] = { steps: Math.round(r.steps), src, syncedAt }; n++; }
  return S().save('tracking') ? n : -1;
}
function setHealth(patch) { const t = tracking(); t.health = Object.assign(health(), patch, { at: new Date().toISOString() }); return S().save('tracking'); }
function disconnect() { /* stop using the source in the app; measured history stays (labelled) unless the user deletes it */ return setHealth({ state: 'never', lastError: null }); }
function deleteMeasured() { const t = tracking(); t.measured = {}; return S().save('tracking'); }

/* ---- native connection (runs only inside the native app; unverified until tested on a device) ---- */
const localDate = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
async function connect(opts) {
  const e = env(); if (!e.native) return { ok: false, reason: 'web' }; if (!e.plugin) return { ok: false, reason: 'no-plugin' };
  const H = e._plugin;
  try {
    const av = await H.isAvailable(); if (!av || !av.available) { setHealth({ state: 'error', src: e.src, lastError: 'unavailable:' + ((av && av.reason) || '') }); return { ok: false, reason: 'unavailable' }; }
    if (!(opts && opts.skipPrompt)) await H.requestAuthorization({ read: ['steps'], write: [] });
    return await sync(e);
  } catch (err) { setHealth({ state: 'error', src: e.src, lastError: String(err && err.message || err).slice(0, 200) }); return { ok: false, reason: 'error' }; }
}
async function sync(e, days) {
  e = e || env(); if (!e.native || !e.plugin) return { ok: false, reason: e.native ? 'no-plugin' : 'web' };
  const H = e._plugin, end = new Date(), start = new Date(end); start.setDate(start.getDate() - ((days || 14) - 1)); start.setHours(0, 0, 0, 0);
  try {
    /* HealthKit does not reveal read denial (privacy): an empty result can mean "denied" or "no data". On Android the status is reported. */
    const au = H.checkAuthorization ? await H.checkAuthorization({ read: ['steps'], write: [] }) : null;
    if (au && Array.isArray(au.readDenied) && au.readDenied.includes('steps') && e.platform === 'android') { setHealth({ state: 'denied', src: e.src, lastError: null }); return { ok: false, reason: 'denied' }; }
    /* M8: the iOS plugin (8.7.0, Health.swift) filters with HKQuery .strictStartDate, so a sample that crosses midnight into the
       first day is dropped and that first day reads low. Ask for one extra day before the window and discard it. */
    const qStart = new Date(start); qStart.setDate(qStart.getDate() - 1); const first = localDate(start);
    const r = await H.queryAggregated({ dataType: 'steps', startDate: qStart.toISOString(), endDate: end.toISOString(), bucket: 'day', aggregation: 'sum' });
    const rows = (r && r.samples || []).map(s => ({ date: localDate(new Date(s.startDate)), steps: Number(s.value) })).filter(x => x.date >= first);
    const now = new Date().toISOString(), n = applyMeasured(rows, e.src, now);
    if (n < 0) return { ok: false, reason: 'save' };
    const empty = rows.every(x => !x.steps);
    setHealth({ state: empty ? 'connected-empty' : 'connected', src: e.src, lastOkAt: now, lastError: null, lastRows: n });
    return { ok: true, rows: rows.length };
  } catch (err) { setHealth({ state: 'error', src: e.src, lastError: String(err && err.message || err).slice(0, 200) }); return { ok: false, reason: 'error' }; }
}

/* ---- MoveScore (proposal v0 — weights are a product proposal, NOT a scientific standard; owner decision D-5) ---- */
const W = { progress: 0.5, consistency: 0.3, trend: 0.2 };
/* days: [{ date, steps (number|null), kind ('measured'|'user'|'estimated'|'demo'|'test'|'none'), rest (bool) }] ending today; target: number|null */
function moveScore(days, target) {
  const usable = d => d && typeof d.steps === 'number' && d.steps >= 0 && d.kind !== 'demo' && d.kind !== 'test' && d.kind !== 'none';
  const T = d => (d.target > 0 ? d.target : target);
  if (!(target > 0)) return { score: null, reason: 'no-target' };
  const last7 = days.slice(-7), prev28 = days.slice(-35, -7);
  const data7 = last7.filter(usable);
  if (data7.length < 4) return { score: null, reason: 'not-enough-data', have: data7.length, need: 4 };
  const active7 = data7.filter(d => !d.rest);
  const progress = active7.length ? active7.reduce((s, d) => s + Math.min(d.steps / T(d), 1.2), 0) / active7.length / 1.2 * 100 : null;
  const consistency = active7.length ? active7.filter(d => d.steps >= 0.6 * T(d)).length / active7.length * 100 : null;
  const prevData = prev28.filter(usable).filter(d => !d.rest);
  let trend = null;
  if (prevData.length >= 7 && active7.length) { const a7 = active7.reduce((s, d) => s + d.steps, 0) / active7.length, a28 = prevData.reduce((s, d) => s + d.steps, 0) / prevData.length;
    const rel = a28 > 0 ? (a7 - a28) / a28 : 0; trend = (Math.max(-0.2, Math.min(0.2, rel)) + 0.2) / 0.4 * 100; }
  if (progress == null) return { score: null, reason: 'only-rest-days' };
  const parts = { progress, consistency, trend }; let wsum = 0, acc = 0;
  for (const k in W) if (parts[k] != null) { wsum += W[k]; acc += W[k] * parts[k]; }
  const kinds = new Set(data7.map(d => d.kind));
  return { score: Math.round(acc / wsum), parts: { progress: Math.round(progress), consistency: Math.round(consistency), trend: trend == null ? null : Math.round(trend) }, weightsUsed: Object.fromEntries(Object.keys(W).filter(k => parts[k] != null).map(k => [k, Math.round(W[k] / wsum * 100) / 100])), daysWithData: data7.length, restDays: data7.length - active7.length, kinds: [...kinds] };
}
/* suggestion only — the user decides. Median of the last 14 days with data × 1.05, rounded to 500; needs ≥ 7 days. */
function suggestTarget(days) {
  const v = days.slice(-14).filter(d => d && typeof d.steps === 'number' && d.kind !== 'demo' && d.kind !== 'test' && d.kind !== 'none' && !d.rest).map(d => d.steps).sort((a, b) => a - b);
  if (v.length < 7) return null; const m = v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2;
  return Math.max(1000, Math.round(m * 1.05 / 500) * 500);
}
/* the app's own history as MoveScore input; restDays = set of dates the user's plan marks as rest */
function history(today, n, restDays) {
  const t = tracking(), out = [];
  const prof = S().load('profile'); for (let i = n - 1; i >= 0; i--) { const d = S().addDays(today, -i), v = day(d, t); out.push({ date: d, steps: v.value, kind: v.kind, rest: !!(restDays && restDays.has(d)), target: targetOn(d, prof) }); }
  return out;
}
Object.assign(A, { applyMeasured, setHealth, disconnect, deleteMeasured, connect, sync, moveScore, suggestTarget, history, W });
})(typeof window !== 'undefined' ? window : globalThis);
