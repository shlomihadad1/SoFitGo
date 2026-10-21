/* M11.4 · activity & calendar sync tools (on-demand chunk extra.js).
   Steps import: a CSV/text file the user exports elsewhere (e.g. from a phone app) — "date,steps" per line. Parsed and previewed
   before anything is saved; saved through Activity.applyMeasured with source 'file' (labelled "מקובץ" everywhere), idempotent
   (re-importing replaces the same dates), never adds, never overwrites with 0, no future dates. The web app cannot read Apple
   Health / Health Connect; the native path stays in activity_more.js (unverified until tested on a device).
   Calendar: a one-way .ics export of the ACTIVE PERSONAL PLAN's upcoming training days (stable UIDs, so re-importing updates the
   same events in most calendar apps). Reading the user's calendar (Google/Apple) needs OAuth or a native app — not available. */
(function (root) {
'use strict';
const S = root.Store, A = root.Activity, L = root.Logic;
const MAX_ROWS = 400, MAX_STEPS = 100000;
function toISO(s) { s = s.trim(); let m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  if ((m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/))) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; /* DD/MM/YYYY (Israeli order) */
  return null; }
function valid(iso) { const d = new Date(iso + 'T12:00:00'); return !isNaN(d) && d.toISOString().slice(0, 10) === iso; }
/* returns { rows:[{date,steps}], errors:[{line, text, why}], dup:n } — the last value of a duplicated date wins */
function parseSteps(text) {
  const out = new Map(), errors = []; let dup = 0; const today = S.today();
  String(text || '').split(/\r?\n/).forEach((ln, i) => { const raw = ln.trim(); if (!raw) return;
    const dl = raw.includes('\t') ? '\t' : raw.includes(';') ? ';' : ','; /* ';' / tab files may use ',' as a thousands separator */
    const parts = (dl === ',' ? raw.match(/("[^"]*"|[^,]+)/g) || [] : raw.split(dl)).map(x => x.trim().replace(/^"|"$/g, '')); if (i === 0 && !/\d/.test(parts[0])) return; /* header */
    const date = toISO(parts[0] || ''), steps = Number(String(parts[1] || '').replace(/[\s,']/g, ''));
    const bad = !date || !valid(date) ? 'תאריך לא מזוהה' : date > today ? 'תאריך עתידי' : !(steps >= 0) || !isFinite(steps) || !parts[1] ? 'מספר צעדים לא תקין' : steps > MAX_STEPS ? 'יותר מ־100,000 צעדים' : steps === 0 ? 'אפס (לא מייבאים 0)' : null;
    if (bad) { if (errors.length < 50) errors.push({ line: i + 1, text: raw.slice(0, 40), why: bad }); return; }
    if (out.has(date)) dup++; out.set(date, Math.round(steps)); });
  const rows = [...out.entries()].sort((a, z) => a[0] < z[0] ? -1 : 1).slice(-MAX_ROWS).map(([date, steps]) => ({ date, steps }));
  return { rows, errors, dup, cut: out.size > MAX_ROWS ? out.size - MAX_ROWS : 0 };
}
function importSheet() {
  const { esc, icon } = root.UI; let parsed = null;
  root.UI.sheet('ייבוא צעדים מקובץ', `<div class="stack" data-steps-import><p class="small">קובץ CSV או טקסט עם שורה לכל יום: <b>תאריך, צעדים</b> (למשל <span dir="ltr">2026-10-20,8450</span> או <span dir="ltr">20/10/2026,8450</span>). שום דבר לא נשמר לפני האישור.</p>
    <label class="btn">${icon('plus')} בחירת קובץ<input type="file" id="si-f" accept=".csv,.txt,text/csv,text/plain" hidden></label>
    <label class="field">או הדבקה<textarea id="si-t" rows="4" dir="ltr" placeholder="2026-10-20,8450"></textarea></label>
    <button class="btn" data-act="check">בדיקת הנתונים</button><div data-si-preview aria-live="polite"></div></div>`, {
    check: (el, e, close, body) => { parsed = parseSteps(body.querySelector('#si-t').value); const pv = body.querySelector('[data-si-preview]'), r = parsed.rows, t = S.load('tracking');
      const manual = r.filter(x => t.daily[x.date] && typeof t.daily[x.date].steps === 'number').length;
      pv.innerHTML = r.length ? `<div class="banner info small"><div><b>${r.length}</b> ימים תקינים (${esc(S.fmtShort(r[0].date))}–${esc(S.fmtShort(r[r.length - 1].date))}).${manual ? ` ב־${manual} מהם יש גם רישום ידני: הוא נשמר, ויוצג הנתון מהקובץ (מסומן "מקובץ").` : ''}${parsed.dup ? ` ${parsed.dup} תאריכים כפולים — נלקח הערך האחרון.` : ''}${parsed.cut ? ` יובאו רק ${MAX_ROWS} הימים האחרונים.` : ''}</div></div>
        ${parsed.errors.length ? `<details class="more" data-si-errors><summary>${parsed.errors.length} שורות לא יובאו</summary><ul class="bul tiny">${parsed.errors.slice(0, 12).map(x => `<li>שורה ${x.line}: ${esc(x.text)} — ${esc(x.why)}</li>`).join('')}</ul></details>` : ''}
        <button class="btn primary" data-act="save">ייבוא ${r.length} ימים</button>` : `<p class="small warn" data-si-none>לא נמצאו שורות תקינות.${parsed.errors.length ? ' למשל: שורה ' + parsed.errors[0].line + ' — ' + esc(parsed.errors[0].why) : ''}</p>`;
      const sv = pv.querySelector('[data-act=save]'); if (sv) sv.addEventListener('click', () => { const n = A.applyMeasured(parsed.rows, 'file', new Date().toISOString());
        if (n < 0) { root.UI.toast('השמירה נכשלה — לא יובא דבר'); return; } close(); root.UI.toast(`יובאו ${n} ימים`); root.App.render(); }); } });
  const f = document.getElementById('si-f'); if (f) f.addEventListener('change', () => { const file = f.files[0]; if (!file) return; if (file.size > 200000) { root.UI.toast('הקובץ גדול מדי (עד 200KB)'); return; }
    const rd = new FileReader(); rd.onload = () => { document.getElementById('si-t').value = rd.result; const b = document.querySelector('[data-steps-import] [data-act=check]'); if (b) b.click(); }; rd.readAsText(file); });
}
/* ---- calendar: active personal plan → .ics ---- */
function planICS(time, alarm, now) {
  const P = root.Plans, ap = P && P.active(); if (!ap) return null;
  const [hh, mm] = String(time || '07:00').split(':').map(Number), pad = n => String(n).padStart(2, '0'), today = S.today(), stamp = now || new Date();
  const f = x => x.getFullYear() + pad(x.getMonth() + 1) + pad(x.getDate()) + 'T' + pad(x.getHours()) + pad(x.getMinutes()) + '00';
  const esc = s => String(s || '').replace(/\\/g, '\\\\').replace(/[,;]/g, m => '\\' + m).replace(/\n/g, ' ');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SoFitGo//HE', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:' + esc('SoFitGo — ' + (ap.name || 'תוכנית אישית'))];
  let n = 0;
  P.days(ap).filter(d => d.date >= today && P.isTraining(d) && !d.log).forEach(d => {
    const def = P.runDef(ap.id, d.n), v = d.version || 'std', mins = def ? Math.max(10, L.estimateMinutes(def, v)) : 30;
    const y = +d.date.slice(0, 4), mo = +d.date.slice(5, 7) - 1, da = +d.date.slice(8, 10), st = new Date(y, mo, da, hh || 0, mm || 0), en = new Date(st.getTime() + mins * 60000);
    lines.push('BEGIN:VEVENT', `UID:sofitgo-plan-${ap.id}-day${d.n}@sofitgo.local`, 'DTSTAMP:' + f(stamp), 'DTSTART:' + f(st), 'DTEND:' + f(en),
      'SUMMARY:' + esc(`SoFitGo · ${d.title || 'אימון'}`), 'DESCRIPTION:' + esc(`יום ${d.n} בתוכנית · כ־${mins} דק׳ (הערכה). פתיחה באפליקציה: מסך התוכנית.`));
    if (alarm > 0) lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + esc('אימון SoFitGo'), 'TRIGGER:-PT' + Math.round(alarm) + 'M', 'END:VALARM');
    lines.push('END:VEVENT'); n++; });
  lines.push('END:VCALENDAR'); return { text: lines.join('\r\n'), events: n };
}
function exportPlanICS(time, alarm) {
  const r = planICS(time, alarm); if (!r) { root.UI.toast('אין תוכנית אישית פעילה'); return; }
  if (!r.events) { root.UI.toast('אין אימונים קרובים בתוכנית לייצא'); return; }
  root.App.fileOut('sofitgo-plan.ics', r.text, 'text/calendar', `קובץ יומן — ${r.events} אימונים קרובים`, null, 'ייצוא חד־כיווני: אחרי שינוי בתוכנית מייצאים שוב — רוב היומנים יעדכנו את אותם אירועים. האפליקציה לא קוראת את היומן שלך.');
}
root.SyncTools = { parseSteps, importSheet, planICS, exportPlanICS };
})(window);
