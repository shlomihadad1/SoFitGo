/* RC5 · Steps, data provenance, health-source connection and MoveScore (pure parts first, UI in screens_activity.js).
   Rules (SOFITGO-MASTER-BACKLOG §4.5/§4.6/§5):
   - Every daily step value carries its kind: 'measured' (read from Apple Health / Health Connect on this device),
     'user' (typed in), never 'estimated' unless a future estimator labels it so. Demo/test values are never scored.
   - A source is "connected" only after a real read returned successfully; until then it is 'never' / 'denied' / 'error'.
   - Web (Safari / PWA) cannot read Apple Health. The app says so plainly and keeps manual entry.
   - Measured totals come from the platform's own daily aggregation (HealthKit HKStatisticsCollectionQuery cumulativeSum /
     Health Connect aggregateGroupByPeriod — both merge overlapping phone + watch data), and a re-sync REPLACES a day's value,
     so repeated syncs or phone + watch cannot add up twice. Manual values are kept but a measured value wins for that day.
   - No universal 10,000 default: a new profile has no step target until the user sets one (a suggestion needs ≥ 7 days of data).
   Storage (backward compatible, inside 'fit30.tracking'): daily[date].steps (+ stepsSrc 'user'), measured[date] =
   { steps, src, syncedAt }, health = { state, src, lastOkAt, lastError, at }. Old daily.steps without stepsSrc = typed in. */
(function (root) {
'use strict';
const S = () => root.Store;
const SRC_HE = { healthkit: 'Apple Health', healthconnect: 'Health Connect', file: 'קובץ' };
const KIND_HE = { measured: 'נמדד', user: 'הוזן ידנית', estimated: 'הערכה', none: 'אין נתון' };

/* ---- environment ---- */
function env() {
  const cap = root.Capacitor, native = !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
  const platform = native && typeof cap.getPlatform === 'function' ? cap.getPlatform() : 'web';
  let standalone = false; try { standalone = (root.matchMedia && root.matchMedia('(display-mode: standalone)').matches) || root.navigator.standalone === true; } catch (e) { }
  const plugin = native && cap.Plugins && cap.Plugins.Health ? cap.Plugins.Health : null;
  return { native, platform, standalone, plugin: !!plugin, src: platform === 'ios' ? 'healthkit' : platform === 'android' ? 'healthconnect' : null, _plugin: plugin };
}
function envText(e) {
  e = e || env();
  if (!e.native) return e.standalone ? 'האפליקציה פועלת כאפליקציית רשת שהותקנה למסך הבית (PWA). ל־PWA אין גישה ל־Apple Health — זו מגבלה של iOS, לא תקלה. הצעדים מוזנים ידנית.'
    : 'האפליקציה פועלת בדפדפן. לדפדפן אין גישה ל־Apple Health או ל־Health Connect. הצעדים מוזנים ידנית.';
  if (!e.plugin) return 'אפליקציה מקורית, אבל רכיב הבריאות לא נכלל בגרסה הזו.';
  return e.platform === 'ios' ? 'אפליקציית iPhone — אפשר לחבר את Apple Health (קריאת צעדים בלבד).' : 'אפליקציית Android — אפשר לחבר את Health Connect (קריאת צעדים בלבד).';
}

/* ---- per-day value with provenance ---- */
function tracking() { return S().load('tracking'); }
function day(date, t) {
  t = t || tracking(); const m = t.measured && t.measured[date], d = t.daily[date] || {};
  if (m && typeof m.steps === 'number') return { value: m.steps, kind: 'measured', src: m.src, syncedAt: m.syncedAt || null, user: typeof d.steps === 'number' ? d.steps : null };
  if (typeof d.steps === 'number' && d.steps >= 0) return { value: d.steps, kind: d.stepsSrc === 'estimated' ? 'estimated' : 'user', src: null, syncedAt: null, user: d.steps };
  return { value: null, kind: 'none', src: null, syncedAt: null, user: null };
}
function label(v) { return v.kind === 'measured' && v.src === 'file' ? 'יובא מקובץ' : v.kind === 'measured' ? `${KIND_HE.measured} · ${SRC_HE[v.src] || v.src}` : KIND_HE[v.kind]; }
function setUserSteps(date, steps) { /* manual entry: always labelled 'user' */
  const t = tracking(); t.daily[date] = Object.assign({}, t.daily[date] || {}, { steps: Math.max(0, Math.round(steps)), stepsSrc: 'user' }); return S().save('tracking');
}
function health() { const t = tracking(); return Object.assign({ state: 'never', src: null, lastOkAt: null, lastError: null }, t.health || {}); }
/* ---- personal step target (no universal default). goals.steps = current target or null; goals.stepsHistory = [{ from, steps }]
   so a change applies from its date onward and earlier days keep the target they had. An existing user's old single value
   (e.g. 10,000 set before RC5) counts as their target from the beginning — it is NOT changed silently. */
function targetOn(date, prof) {
  const g = (prof || S().load('profile')).goals || {}, h = (g.stepsHistory || []).filter(x => x.from <= date).sort((a, b) => a.from < b.from ? -1 : 1);
  if (h.length) return h[h.length - 1].steps; if ((g.stepsHistory || []).length) return null; return g.steps > 0 ? g.steps : null;
}
function setTarget(steps, from) {
  const p = S().load('profile'); p.goals = p.goals || {}; const today = from || S().today();
  const h = (p.goals.stepsHistory || []).filter(x => x.from !== today);
  if (!h.length && p.goals.steps > 0 && today > '0000') h.push({ from: '0000-01-01', steps: p.goals.steps }); /* keep the old value for earlier days */
  const v = steps > 0 ? Math.round(steps) : null; h.push({ from: today, steps: v }); p.goals.stepsHistory = h; p.goals.steps = v; return S().save('profile');
}
root.Activity = { env, envText, day, label, setUserSteps, targetOn, setTarget, health, SRC_HE, KIND_HE, _localDate: null };
})(typeof window !== 'undefined' ? window : globalThis);
