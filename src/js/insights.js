/* Stage D/F/G — plan-aware read-only computations shared by the dashboard, calendar, progress, adaptation and
   signature features. Everything here is DERIVED from stored data (plan calendar + logs + tracking); nothing is
   written, and nothing is estimated beyond what the inputs support. Every function returns enough context for the
   UI to explain itself ("why"), and returns null/[] when the data is insufficient instead of guessing. */
(function (root) {
  'use strict';
  const S = () => root.Store, PS = () => root.Plans, C = () => root.Core;
  const isTr = d => PS().isTraining(d);
  const TYPE_CLS = { fb: 'tr', upper: 'tr', lower: 'tr', cond: 'cd', mob: 'mb', active: 'mb', assess: 'as', rest: 'rs' };
  const TYPE_HE = { fb: 'גוף מלא', upper: 'פלג עליון', lower: 'פלג תחתון', cond: 'לב־ריאה', mob: 'ניידות', active: 'התאוששות', assess: 'מבחן', rest: 'מנוחה' };

  /* greeting by local hour — purely cosmetic, no personal data */
  function greeting(h) { h = h == null ? new Date().getHours() : h; return h < 5 ? 'לילה טוב' : h < 12 ? 'בוקר טוב' : h < 17 ? 'צהריים טובים' : h < 21 ? 'ערב טוב' : 'לילה טוב'; }

  /* the plan day(s) that fall on a date (a moved workout appears on its new date) */
  function daysOn(plan, date, ds) { return (ds || PS().days(plan)).filter(d => d.date === date); }
  function mainOn(plan, date, ds) { const l = daysOn(plan, date, ds); return l.find(isTr) || l[0] || null; }

  /* Sunday-start calendar week containing `date` (Israeli week), 7 cells with the plan day on each date */
  function weekStrip(plan, date) {
    const d0 = S().parse(date), start = S().addDays(date, -d0.getDay()), ds = PS().days(plan), out = [];
    for (let i = 0; i < 7; i++) { const dt = S().addDays(start, i), d = mainOn(plan, dt, ds); out.push({ date: dt, dow: i, day: d, cls: d ? TYPE_CLS[d.type] || 'rs' : 'out', status: d ? d.status : 'out', isToday: dt === S().today() }); }
    return out;
  }
  /* plan weeks (plan.week numbers from the planner): planned vs done, minutes, average reported effort */
  function planWeeks(plan) {
    const ds = PS().days(plan), by = new Map();
    ds.forEach(d => { const w = d.week; if (!by.has(w)) by.set(w, []); by.get(w).push(d); });
    const t = S().today();
    return [...by.entries()].sort((a, b) => a[0] - b[0]).map(([w, list]) => {
      const tr = list.filter(isTr), done = tr.filter(d => d.status === 'done'), partial = tr.filter(d => d.status === 'partial');
      const rpes = list.map(d => d.log && d.log.rpe).filter(Boolean), mins = list.map(d => d.log && d.log.durationSec).filter(Boolean);
      const from = list.reduce((m, d) => d.date < m ? d.date : m, list[0].date), to = list.reduce((m, d) => d.date > m ? d.date : m, list[0].date);
      return { w, from, to, past: to < t, current: from <= t && t <= to, planned: tr.filter(d => d.status !== 'skipped').length, sessions: tr.length, done: done.length, partial: partial.length,
        skipped: tr.filter(d => d.status === 'skipped').length, missed: tr.filter(d => d.status === 'missed').length,
        minutes: mins.length ? Math.round(mins.reduce((a, b) => a + b, 0) / 60) : 0, rpe: rpes.length ? +(rpes.reduce((a, b) => a + b, 0) / rpes.length).toFixed(1) : null, deload: list.some(d => d.deload), phase: list[0].phase };
    });
  }
  /* Consistency (transparent): a finished plan week counts as "kept" when at least 2/3 of its planned sessions were
     done or partially done. Skipped sessions are removed from "planned" (a deliberate skip is not a failure);
     rest days never count. Current week is shown as "in progress" and never breaks the streak. */
  function consistency(plan) {
    const ws = planWeeks(plan).filter(w => w.planned > 0), past = ws.filter(w => w.past);
    const kept = w => (w.done + w.partial) >= Math.ceil(w.planned * 2 / 3);
    let streak = 0; for (let i = past.length - 1; i >= 0; i--) { if (kept(past[i])) streak++; else break; }
    const cur = ws.find(w => w.current) || null;
    return { weeksPast: past.length, weeksKept: past.filter(kept).length, streak, current: cur ? { done: cur.done + cur.partial, planned: cur.planned } : null,
      rule: 'שבוע נספר כ"נשמר" כשבוצעו לפחות 2/3 מהאימונים המתוכננים בו (כולל ביצוע חלקי). דילוג מכוון לא נספר ככישלון, וימי מנוחה לא נספרים.' };
  }
  function nextTraining(plan, fromDate) {
    const f = fromDate || S().today(); return PS().days(plan).filter(d => isTr(d) && !d.log && d.status !== 'skipped' && d.date >= f).sort((a, b) => a.date < b.date ? -1 : 1)[0] || null;
  }
  function lastLogged(plan) { return PS().days(plan).filter(d => d.log).sort((a, b) => (a.log.date || a.date) < (b.log.date || b.date) ? 1 : -1)[0] || null; }
  /* Month grid for the plan calendar: weeks (Sun–Sat) covering a calendar month, cells with the plan day */
  function monthGrid(plan, ym) {
    const [y, m] = ym.split('-').map(Number), first = `${ym}-01`, last = S().iso(new Date(y, m, 0));
    const start = S().addDays(first, -S().parse(first).getDay()), ds = PS().days(plan), rows = [];
    for (let d = start; d <= last || S().parse(d).getDay() !== 0; d = S().addDays(d, 1)) {
      if (S().parse(d).getDay() === 0) rows.push([]);
      const pd = mainOn(plan, d, ds); rows[rows.length - 1].push({ date: d, inMonth: d.slice(0, 7) === ym, day: pd, cls: pd ? TYPE_CLS[pd.type] || 'rs' : 'out', status: pd ? pd.status : 'out', isToday: d === S().today() });
      if (rows.length > 6) break;
    }
    return rows;
  }
  function planMonths(plan) { const ds = PS().days(plan); const a = ds[0].date.slice(0, 7), b = ds.reduce((m, d) => d.date > m ? d.date : m, ds[0].date).slice(0, 7); const out = []; let [y, m] = a.split('-').map(Number);
    for (let k = 0; k < 40; k++) { const ym = `${y}-${String(m).padStart(2, '0')}`; out.push(ym); if (ym === b) break; m++; if (m > 12) { m = 1; y++; } } return out; }

  /* plan fitness tests: first vs latest logged assessment day of this plan */
  function planTests(plan) {
    const logged = PS().days(plan).filter(d => d.type === 'assess' && d.log && d.log.tests && Object.keys(d.log.tests).length).sort((a, b) => a.n - b.n);
    if (!logged.length) return null; const a = logged[0], b = logged[logged.length - 1];
    return { first: { n: a.n, date: a.log.date, r: a.log.tests, v: a.log.pushVar }, last: logged.length > 1 ? { n: b.n, date: b.log.date, r: b.log.tests, v: b.log.pushVar } : null };
  }
  root.Insights = { greeting, weekStrip, planWeeks, consistency, nextTraining, lastLogged, monthGrid, planMonths, planTests, mainOn, TYPE_CLS, TYPE_HE };
})(typeof window !== 'undefined' ? window : globalThis);
