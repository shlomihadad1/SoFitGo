/* CSV export of the user's own data — built on this device from the local store only (no server request, no AI, nothing uploaded).
   One file per category, each with stable English column names (a schema line is in README). Rules:
     - RFC 4180 quoting: a field with a comma, quote, CR or LF is quoted and quotes are doubled; rows end with CRLF;
     - UTF-8 with a byte-order mark, so Hebrew opens correctly in Excel / Numbers / Google Sheets;
     - formula-injection guard: a text value that starts with = + - @ TAB or CR gets a leading apostrophe (numbers are left as numbers);
     - dates are the app's local calendar dates (YYYY-MM-DD, the same day the app shows); timestamps stay ISO-8601 UTC ('Z');
     - only what is actually stored: an empty category gives a file with the header row only — nothing is invented;
     - never included: account tokens / session, the CMS cache, internal ids of other systems, data of any other user. */
(function (root) {
'use strict';
const S = () => root.Store;
const BOM = '﻿';
function cell(v) {
  if (v == null) return '';
  if (typeof v === 'number') return isFinite(v) ? String(v) : '';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  let s = Array.isArray(v) ? v.join('; ') : typeof v === 'object' ? JSON.stringify(v) : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; /* spreadsheet formula injection guard (OWASP) */
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
const toCsv = (cols, rows) => BOM + [cols.join(',')].concat(rows.map(r => cols.map(c => cell(r[c])).join(','))).join('\r\n') + '\r\n';
const r1 = x => x == null || x === '' ? null : Math.round(+x * 10) / 10;
function files() {
  const pr = S().load('profile'), w = S().load('workouts'), nu = S().load('nutrition'), tr = S().load('tracking'), pl = S().load('plans');
  const out = [];
  const add = (name, he, cols, rows) => out.push({ name, he, cols, rows, n: rows.length, csv: toCsv(cols, rows) });
  /* profile & preferences: key / value (only fields the user entered or chose) */
  const P = [], put = (k, v) => { if (v != null && v !== '' && !(Array.isArray(v) && !v.length)) P.push({ field: k, value: v }); };
  put('name', pr.name); put('age', pr.age); put('sex', pr.sex); put('height_cm', pr.height); put('start_weight_kg', pr.startWeight); put('weight_kg', pr.weight); put('target_weight_kg', pr.targetWeight); put('start_date', pr.startDate);
  put('goal', (pr.aims || {}).primary); put('secondary_goals', (pr.aims || {}).secondary); put('experience', pr.experience);
  const a = pr.availability || {}; put('training_days', (a.days || []).map(d => S().HE_DAYS[d])); put('sessions_per_week', a.sessions); put('preferred_minutes', a.prefMin); put('max_minutes', a.maxMin);
  put('equipment', (pr.environment || {}).equipment); put('favourite_exercises', (pr.exercisePrefs || {}).fav); put('excluded_exercises', (pr.exercisePrefs || {}).exclude); put('no_jumping', (pr.exercisePrefs || {}).noJump || null);
  const np = pr.prefs || {}; ['chicken', 'egg', 'dairy', 'fish', 'meat'].forEach(k => { if (np[k] === false) put('avoid_' + k, true); }); put('vegetarian', np.veg || null); put('vegan', np.vegan || null); put('excluded_foods', np.exclude); put('cuisines', np.cuisines); put('meals_per_day', np.meals);
  const g = pr.goals || {}; put('goal_water_ml', g.water); put('goal_steps', g.steps); put('goal_sleep_h', g.sleep); put('units_weight', (pr.units || {}).w);
  add('profile.csv', 'פרופיל, העדפות ויעדים', ['field', 'value'], P);
  /* workouts: the 30-day program log, personal-plan logs, Workout Builder runs */
  add('workouts_30day.csv', 'אימוני תוכנית 30 הימים', ['day', 'date', 'status', 'version', 'duration_min', 'sets_done', 'rpe', 'mode', 'notes'],
    Object.entries(w.days || {}).filter(([, x]) => x && x.status).map(([n, x]) => ({ day: +n, date: x.date, status: x.status, version: x.version, duration_min: r1((x.durationSec || 0) / 60), sets_done: (x.sets || []).filter(s => s && s.done).length, rpe: x.rpe, mode: x.mode, notes: x.notes })).sort((a, b) => a.day - b.day));
  const PR = []; Object.values(pl.list || {}).forEach(p => Object.entries(p.log || {}).forEach(([n, x]) => PR.push({ plan_id: p.id, plan_template: p.templateId, plan_start: p.start, day: +n, date: x.date, status: x.status, title: x.snapshot && x.snapshot.title, duration_min: r1((x.durationSec || 0) / 60), sets_done: (x.sets || []).filter(s => s && s.done).length, rpe: x.rpe, notes: x.notes })));
  add('workouts_plans.csv', 'אימוני התוכניות האישיות', ['plan_id', 'plan_template', 'plan_start', 'day', 'date', 'status', 'title', 'duration_min', 'sets_done', 'rpe', 'notes'], PR.sort((a, b) => String(a.date).localeCompare(String(b.date))));
  add('workouts_builder_runs.csv', 'אימונים שבניתי — ביצועים', ['date', 'workout', 'status', 'duration_min', 'exercises', 'sets_done', 'rpe', 'notes'],
    (w.customLog || []).map(x => ({ date: x.date, workout: x.snapshot && x.snapshot.name, status: x.status, duration_min: r1((x.durationSec || 0) / 60), exercises: x.snapshot ? x.snapshot.main.map(it => (root.EX_BY_ID[it.ex] || {}).he || it.ex) : null, sets_done: (x.sets || []).filter(s => s && s.done).length, rpe: x.rpe, notes: x.notes })));
  add('workouts_builder_saved.csv', 'אימונים שבניתי — שמורים', ['name', 'goal', 'minutes_chosen', 'exercises', 'favourite', 'created_at', 'updated_at'],
    Object.values(w.custom || {}).map(x => ({ name: x.name, goal: x.params && x.params.goal, minutes_chosen: x.params && x.params.minutes, exercises: (x.main || []).map(it => ((root.EX_BY_ID[it.ex] || {}).he || it.ex) + ' ' + it.sets + 'x' + (it.reps || (it.sec ? it.sec + 's' : ''))), favourite: !!x.fav, created_at: x.createdAt, updated_at: x.updatedAt })));
  /* nutrition journal */
  const NL = []; Object.keys(nu.log || {}).sort().forEach(d => ((nu.log[d] || {}).entries || []).forEach(e => NL.push({ date: d, meal_slot: e.slot, name: e.name, source: e.source, portion: e.portion != null ? e.portion : e.scale, grams: e.grams, kcal: r1(e.k), protein_g: r1(e.p), carbs_g: r1(e.c), fat_g: r1(e.f), fiber_g: r1(e.fb), repeat: e.repeat || null, logged_at: e.at })));
  add('nutrition_journal.csv', 'יומן אכילה', ['date', 'meal_slot', 'name', 'source', 'portion', 'grams', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'repeat', 'logged_at'], NL);
  /* daily tracking: water, steps, sleep, energy */
  const DL = Object.keys(tr.daily || {}).sort().map(d => { const x = tr.daily[d] || {}, m = (tr.measured || {})[d]; return { date: d, water_ml: x.water, water_goal_ml: x.waterGoal, steps: m && m.steps != null ? m.steps : x.steps, steps_source: m && m.steps != null ? (m.src || 'measured') : x.steps != null ? 'manual' : null, sleep_h: x.sleep, energy_1_5: x.energy }; })
    .filter(r => ['water_ml', 'steps', 'sleep_h', 'energy_1_5'].some(k => r[k] != null));
  add('daily_tracking.csv', 'מים, צעדים, שינה ואנרגיה', ['date', 'water_ml', 'water_goal_ml', 'steps', 'steps_source', 'sleep_h', 'energy_1_5'], DL);
  /* body measures (every field the user recorded) */
  const ms = (tr.measures || []).slice().sort((a, b) => String(a.date).localeCompare(String(b.date))), mcols = ['date'].concat([...new Set(ms.flatMap(m => Object.keys(m)))].filter(k => !['date', 'id', 'at'].includes(k)).sort());
  add('body_measures.csv', 'מדידות גוף ומשקל', mcols, ms);
  return out;
}
const summary = fs => fs.map(f => ({ name: f.name, he: f.he, rows: f.n }));
root.ExportCSV = { cell, toCsv, files, summary, BOM };
})(typeof window !== 'undefined' ? window : globalThis);
