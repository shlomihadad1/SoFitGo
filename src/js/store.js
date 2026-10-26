/* Local persistence. Separate keys per data domain. Everything stays on this device. */
(function (root) {
const KEYS = { profile: 'fit30.profile', workouts: 'fit30.workouts', session: 'fit30.session', nutrition: 'fit30.nutrition', tracking: 'fit30.tracking', meta: 'fit30.meta', plans: 'fit30.plans', avatar: 'fit30.avatar' /* M9: the user's own profile photo (small JPEG data URL); NOT in backups, like progress photos */, changelog: 'fit30.changelog' /* SLL-42: settings change log, this device only; not synced, not in backups */ };
const VERSION = 2; /* 2 = Stage B: profile schema 2 + plans */
let storageOK = true; const mem = {};
function rawGet(k) { try { return localStorage.getItem(k); } catch (e) { storageOK = false; return mem[k] || null; } }
function rawSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { storageOK = false; mem[k] = v; return false; } }
function rawDel(k) { try { localStorage.removeItem(k); } catch (e) { delete mem[k]; } }
try { const t = '__fit30_test'; localStorage.setItem(t, '1'); localStorage.removeItem(t); } catch (e) { storageOK = false; }

/* dates — local calendar dates as YYYY-MM-DD */
const pad = n => String(n).padStart(2, '0');
function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function parse(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function addDays(s, n) { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); }
function diffDays(a, b) { return Math.round((parse(b) - parse(a)) / 86400000); }
function today() { return iso(new Date()); }
const HE_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const HE_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
function fmtDate(s, withDay) { const d = parse(s); return (withDay ? 'יום ' + HE_DAYS[d.getDay()] + ', ' : '') + d.getDate() + ' ב' + HE_MONTHS[d.getMonth()]; }
function fmtShort(s) { const d = parse(s); return d.getDate() + '/' + (d.getMonth() + 1); }

const DEFAULTS = {
  /* A NEW profile is empty: no personal values are assumed. Each value is entered (and explained) in the profile flow. */
  profile: () => ({ v: VERSION, schema: 2, name: null /* M9: optional first name, only for the home greeting */, age: null, height: null, startWeight: null, weight: null, targetWeight: null, sex: null, startDate: today(), units: { w: 'kg', len: 'cm' },
    aims: { primary: null, secondary: [] }, experience: null,
    availability: { days: [], sessions: null, prefMin: null, maxMin: null },
    environment: { place: null, equipment: [], custom: [] },
    exercisePrefs: { fav: [], exclude: [], noJump: false },
    mediaPrefs: { loop: true, autoplay: false }, legacy: null,
    targets: null, goals: { steps: null /* RC5: no universal step target — the user sets one (MOV-2) */, water: 3000, sleep: 7.5 },
    prefs: { chicken: true, egg: true, dairy: true, veg: false, exclude: [], flex: true, flexName: 'ארוחה גמישה' },
    display: { size: 'normal', motion: 'auto', wake: true, sound: true }, onboarded: false, createdAt: new Date().toISOString() }),
  workouts: () => ({ v: VERSION, days: {}, levels: {}, swaps: {}, feedback: {}, tests: {} }),
  nutrition: () => ({ v: VERSION, plan: {}, log: {}, favorites: [], flexUsed: {} }),
  tracking: () => ({ v: VERSION, daily: {}, measures: [] }),
  meta: () => ({ v: VERSION, lastBackup: null, persisted: null }),
  plans: () => ({ v: VERSION, active: null, list: {} }),
  avatar: () => ({ v: VERSION, src: null, at: null }),
  changelog: () => ({ v: VERSION, items: [] })
};
const cache = {};
function load(name) {
  if (cache[name]) return cache[name];
  let val = null; const raw = rawGet(KEYS[name]);
  if (raw) { try { val = JSON.parse(raw); } catch (e) { val = null; } }
  if (!val && name !== 'session') val = DEFAULTS[name]();
  if (name === 'profile' && val) migrateProfile(val); /* must run BEFORE defaults are merged (defaults carry schema 2) */
  if (val && DEFAULTS[name]) { const d = DEFAULTS[name](); for (const k in d) if (val[k] === undefined) val[k] = d[k]; }
  if (name === 'plans' && val) { if (!val.list || typeof val.list !== 'object') val.list = {}; if (val.active && !val.list[val.active]) val.active = null; }
  if (name === 'workouts' && val) { // migrate v1: test results used to live inside the day-1/day-29 workout logs
    val.tests = val.tests || {};
    [1, 29].forEach(n => { const lg = val.days[n]; if (lg && lg.tests && Object.keys(lg.tests).length && !val.tests[n]) { val.tests[n] = { date: lg.date || null, results: Object.fromEntries(Object.entries(lg.tests).filter(([, v]) => v != null)), source: 'migrated' }; } if (lg && lg.tests) delete lg.tests; });
  }
  cache[name] = val; return val;
}
/* Profile schema 1 → 2. Nothing is deleted. A schema-1 profile that already holds body data belonged to an existing
   user whose targets were computed with the old fixed assumptions (Mifflin male formula, 20% deficit); those are kept
   in profile.legacy so the existing numbers do not change until the user sets sex/goal themselves. */
function migrateProfile(p) {
  const d = DEFAULTS.profile();
  if (p.schema !== 2) {
    if (p.legacy == null && (p.age != null || p.weight != null || p.height != null)) p.legacy = { sex: 'm', deficit: p.deficit != null ? p.deficit : 0.2, from: 1 };
    if (p.legacy === undefined) p.legacy = null;
    p.schema = 2;
  }
  for (const k of ['aims', 'availability', 'environment', 'exercisePrefs', 'mediaPrefs', 'units', 'goals', 'prefs', 'display']) {
    if (!p[k] || typeof p[k] !== 'object' || Array.isArray(p[k])) p[k] = d[k]; else for (const j in d[k]) if (p[k][j] === undefined) p[k][j] = d[k][j];
  }
  if (!Array.isArray(p.aims.secondary)) p.aims.secondary = [];
  ['days'].forEach(j => { if (!Array.isArray(p.availability[j])) p.availability[j] = []; });
  ['equipment', 'custom'].forEach(j => { if (!Array.isArray(p.environment[j])) p.environment[j] = []; });
  ['fav', 'exclude'].forEach(j => { if (!Array.isArray(p.exercisePrefs[j])) p.exercisePrefs[j] = []; });
  p.v = VERSION;
  return p;
}
/* F-8 (RC5): a failed write (e.g. storage full) is no longer silent. If storage worked when the app started, the in-memory
   copy is rolled back to what is actually stored — so the screen never shows a change that was not saved — and a
   'fit30:savefail' event names the data area; the app shows a specific error. save() returns true/false. */
const okAtStart = storageOK, lastSaved = {};
/* SLL-42 · Transparent Change Log: every saved change to a profile SETTING (goals, schedule, place and equipment, exercise and
   food exclusions, targets, display) is recorded with its time, old and new value, on this device only.
   - Body data and identity (age, height, weight, sex, name, photo) are NOT recorded.
   - Only changes after setup (the stored profile was already onboarded); setup itself and account sync (applyRemote) are not.
   - Several saves of the same setting within 2 minutes (typing a number) become one entry; a change back to the old value
     within that time removes it. At most 300 entries, oldest dropped. Nothing is ever recorded without a saved change.
   Part 2: recordEntry() also takes entries the APP generated (src: 'app', with a reason), e.g. Core.trackAuto() when the
   automatic calorie/protein targets change because the weight or goal changed. Entries without src are the user's. */
const CHANGE_FIELDS = ['aims.primary', 'aims.secondary', 'experience', 'availability.days', 'availability.sessions', 'availability.prefMin', 'availability.maxMin',
  'environment.place', 'environment.equipment', 'exercisePrefs.exclude', 'exercisePrefs.noJump', 'goals.steps', 'goals.water', 'goals.sleep', 'targetWeight',
  'prefs.chicken', 'prefs.egg', 'prefs.dairy', 'prefs.veg', 'prefs.exclude', 'prefs.flex', 'restrictionKinds', 'mode', 'units.w',
  'display.size', 'display.motion', 'display.sound', 'display.wake', 'display.lowData', 'mediaPrefs.autoplay', 'targets.kcal', 'targets.protein', 'targets.carbs', 'targets.fat', 'goals.waterMode'];
const CHANGE_MAX = 300, CHANGE_MERGE_MS = 120000;
const pathGet = (o, p) => p.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
function recordChanges(prevTxt, txt, now) {
  let a, b; try { a = JSON.parse(prevTxt); b = JSON.parse(txt); } catch (e) { return 0; }
  if (!a || !b || a.onboarded !== true) return 0;
  let n = 0; const t = now || Date.now();
  CHANGE_FIELDS.forEach(p => { const x = pathGet(a, p), y = pathGet(b, p); if (JSON.stringify(x === undefined ? null : x) !== JSON.stringify(y === undefined ? null : y)) n += addEntry({ path: p, from: x, to: y }, t); });
  if (n) save('changelog'); return n;
}
function addEntry(e, t) { /* merge rule shared by user and app entries; the caller saves */
  const cl = load('changelog'); if (!Array.isArray(cl.items)) cl.items = [];
  const xs = JSON.stringify(e.from === undefined ? null : e.from), ys = JSON.stringify(e.to === undefined ? null : e.to); if (xs === ys) return 0;
  const last = cl.items.filter(i => i.path === e.path && (i.src || 'user') === (e.src || 'user')).pop();
  if (last && t - Date.parse(last.at) < CHANGE_MERGE_MS && JSON.stringify(last.to) === xs) { last.to = JSON.parse(ys); last.at = new Date(t).toISOString(); if (e.why) last.why = e.why;
    if (JSON.stringify(last.from) === ys) cl.items.splice(cl.items.indexOf(last), 1); return 1; }
  const it = { at: new Date(t).toISOString(), path: e.path, from: JSON.parse(xs), to: JSON.parse(ys) }; if (e.src) it.src = e.src; if (e.why) it.why = String(e.why).slice(0, 300);
  cl.items.push(it); if (cl.items.length > CHANGE_MAX) cl.items.splice(0, cl.items.length - CHANGE_MAX); return 1;
}
function recordEntry(e, now) { const n = addEntry(e, now || Date.now()); if (n) save('changelog'); return n; }
function save(name) {
  if (name === 'session' && !cache.session) { rawDel(KEYS.session); return true; }
  const txt = JSON.stringify(cache[name]), prevProfile = name === 'profile' ? (lastSaved.profile !== undefined ? lastSaved.profile : rawGet(KEYS.profile)) : null;
  if (rawSet(KEYS[name], txt)) { const changed = lastSaved[name] !== txt; lastSaved[name] = txt;
    if (changed && name === 'profile' && prevProfile && prevProfile !== txt) { try { recordChanges(prevProfile, txt); } catch (e) { } }
    /* M10: account sync listens for this (marks the data area as not yet synced). Fired only after the local write succeeded. */
    if (changed) { try { root.dispatchEvent(new CustomEvent('fit30:saved', { detail: { name } })); } catch (e) { } } return true; }
  if (okAtStart) { storageOK = true; /* storage exists; this write failed */ let prev = null; try { prev = localStorage.getItem(KEYS[name]); } catch (e) { }
    delete cache[name]; delete mem[KEYS[name]]; if (prev == null) { cache[name] = name === 'session' ? null : DEFAULTS[name](); } else load(name);
    try { root.dispatchEvent(new CustomEvent('fit30:savefail', { detail: { name } })); } catch (e) { } }
  return false;
}
function set(name, val) { cache[name] = val; save(name); }
/* M10: replace one data area with the copy from the user's account (or defaults when obj is null), without firing
   'fit30:saved' (it is not a local edit). Runs through load(), so migrations and defaults apply as for any stored data. */
function applyRemote(name, obj) { if (!KEYS[name]) return false;
  if (obj == null) rawDel(KEYS[name]); else if (!rawSet(KEYS[name], JSON.stringify(obj))) return false;
  delete cache[name]; const v = load(name); lastSaved[name] = JSON.stringify(v); if (name !== 'session') rawSet(KEYS[name], lastSaved[name]); return true; }
/* M10: remove EVERYTHING this app stores on the device (all fit30.* keys, progress photos, profile photo). Used on sign-out and
   account deletion so the next person on the same device never sees the previous account's data. */
function wipeDevice() {
  try { const ks = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('fit30.')) ks.push(k); } ks.forEach(k => localStorage.removeItem(k)); } catch (e) { }
  Object.keys(cache).forEach(k => delete cache[k]); Object.keys(mem).forEach(k => delete mem[k]); Object.keys(lastSaved).forEach(k => delete lastSaved[k]);
  try { if (IDB.db) { IDB.db.close(); IDB.db = null; } } catch (e) { } /* our own open connection would block the deletion */
  return new Promise(res => { let done = false; const fin = v => { if (!done) { done = true; res(v); } };
    try { const r = indexedDB.deleteDatabase('fit30-photos'); r.onsuccess = () => fin(true); r.onerror = () => fin(false); r.onblocked = () => setTimeout(() => fin(false), 2000); } catch (e) { fin(false); } });
}
function clearSession() { cache.session = null; rawDel(KEYS.session); }

function exportAll() {
  const out = { app: 'fit30', version: VERSION, exportedAt: new Date().toISOString() };
  ['profile', 'workouts', 'nutrition', 'tracking', 'plans'].forEach(n => { out[n] = load(n); });
  return out;
}
/* Full structural check BEFORE anything is written. Returns an error message (Hebrew) or null. */
function validateBackup(o) {
  const isObj = x => x && typeof x === 'object' && !Array.isArray(x);
  if (!isObj(o) || o.app !== 'fit30') return 'הקובץ אינו גיבוי של האפליקציה.';
  if (o.version != null && (typeof o.version !== 'number' || o.version > VERSION)) return 'הגיבוי נוצר בגרסה חדשה יותר של האפליקציה (' + o.version + '). עדכנו את האפליקציה לפני השחזור.';
  for (const n of ['profile', 'workouts', 'nutrition', 'tracking']) if (!isObj(o[n])) return 'חלק בגיבוי חסר או פגום: ' + n;
  const p = o.profile;
  if (typeof p.startDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(p.startDate)) return 'תאריך תחילת התוכנית בגיבוי חסר או פגום.';
  if (p.weight != null && !(typeof p.weight === 'number' && p.weight > 20 && p.weight < 400)) return 'ערך המשקל בגיבוי אינו תקין.';
  if (p.name != null && !(typeof p.name === 'string' && p.name.length <= 60)) return 'השם בגיבוי אינו תקין.';
  if (p.mode != null && p.mode !== 'nutrition') return 'מצב השימוש בגיבוי אינו תקין.'; /* M10: optional nutrition-only mode */
  if (p.age != null && !(typeof p.age === 'number' && p.age >= 14 && p.age <= 100)) return 'ערך הגיל בגיבוי אינו תקין.';
  if (p.height != null && !(typeof p.height === 'number' && p.height >= 120 && p.height <= 230)) return 'ערך הגובה בגיבוי אינו תקין.';
  for (const k of ['aims', 'availability', 'environment', 'exercisePrefs']) if (p[k] != null && !isObj(p[k])) return 'שדה הפרופיל "' + k + '" בגיבוי פגום.';
  if (o.plans != null) { // optional: backups made before Stage B have no plans section
    const pl = o.plans; if (!isObj(pl) || (pl.list != null && !isObj(pl.list))) return 'התוכניות בגיבוי פגומות.';
    for (const id in (pl.list || {})) { const x = pl.list[id];
      if (!isObj(x) || typeof x.templateId !== 'string' || typeof x.start !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(x.start) || !Array.isArray(x.segments) || !x.segments.length || (x.log != null && !isObj(x.log))) return 'תוכנית פגומה בגיבוי (' + id + ').'; }
    if (pl.active != null && !(pl.list || {})[pl.active]) return 'התוכנית הפעילה בגיבוי חסרה.';
  }
  const w = o.workouts; if (w.days != null && !isObj(w.days)) return 'רישומי האימונים בגיבוי פגומים.';
  if (w.tests != null && !isObj(w.tests)) return 'תוצאות המבחנים בגיבוי פגומות.';
  const nu = o.nutrition; if (nu.plan != null && !isObj(nu.plan)) return 'התפריט בגיבוי פגום.';
  if (nu.log != null && !isObj(nu.log)) return 'יומן האכילה בגיבוי פגום.';
  if (nu.log) for (const d in nu.log) { const l = nu.log[d]; if (!isObj(l) || (l.entries != null && !Array.isArray(l.entries))) return 'יומן האכילה בגיבוי פגום (' + d + ').'; if (l.entries && l.entries.some(e => !isObj(e) || typeof e.k !== 'number')) return 'רשומת אכילה פגומה בגיבוי (' + d + ').'; }
  const t = o.tracking; if (t.daily != null && !isObj(t.daily)) return 'נתוני המעקב היומי בגיבוי פגומים.';
  if (t.measures != null && (!Array.isArray(t.measures) || t.measures.some(m => !isObj(m) || typeof m.date !== 'string'))) return 'המדידות בגיבוי פגומות.';
  return null;
}
/* Restore: validate fully, keep a copy of the current raw data, write all sections, then reload each section through
   load() so defaults and old-version migrations apply immediately. If anything fails, the previous data is put back. */
function importAll(o) {
  const err = validateBackup(o); if (err) throw new Error(err);
  const names = ['profile', 'workouts', 'nutrition', 'tracking', 'plans'];
  const prev = {}; names.forEach(n => { prev[n] = rawGet(KEYS[n]); });
  try {
    names.forEach(n => { if (o[n] == null) rawDel(KEYS[n]); else rawSet(KEYS[n], JSON.stringify(o[n])); delete cache[n]; }); // a section missing from an old backup starts from its defaults
    names.forEach(n => { load(n); save(n); });
    clearSession();
  } catch (e) {
    names.forEach(n => { if (prev[n] == null) rawDel(KEYS[n]); else rawSet(KEYS[n], prev[n]); delete cache[n]; });
    throw new Error('השחזור נכשל והנתונים הקודמים הוחזרו: ' + e.message);
  }
}
function resetAll() { Object.keys(KEYS).forEach(k => { rawDel(KEYS[k]); delete cache[k]; }); }
function usageBytes() { let t = 0; Object.values(KEYS).forEach(k => { const v = rawGet(k); if (v) t += v.length * 2; }); return t; }

/* Photos: IndexedDB (optional) */
const IDB = { db: null };
function idb() {
  return new Promise((res, rej) => {
    if (IDB.db) return res(IDB.db);
    try {
      const r = indexedDB.open('fit30-photos', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('photos', { keyPath: 'id' });
      r.onsuccess = () => { IDB.db = r.result; res(IDB.db); };
      r.onerror = () => rej(r.error);
    } catch (e) { rej(e); }
  });
}
async function photoAll() { const db = await idb(); return new Promise((res, rej) => { const q = db.transaction('photos').objectStore('photos').getAll(); q.onsuccess = () => res(q.result.sort((a, b) => a.date < b.date ? 1 : -1)); q.onerror = () => rej(q.error); }); }
async function photoPut(p) { const db = await idb(); return new Promise((res, rej) => { const t = db.transaction('photos', 'readwrite'); t.objectStore('photos').put(p); t.oncomplete = res; t.onerror = () => rej(t.error); }); }
async function photoDel(id) { const db = await idb(); return new Promise((res, rej) => { const t = db.transaction('photos', 'readwrite'); t.objectStore('photos').delete(id); t.oncomplete = res; t.onerror = () => rej(t.error); }); }

root.Store = { KEYS, VERSION, CHANGE_FIELDS, recordChanges, recordEntry, migrateProfile, load, save, get storageOKAtStart() { return okAtStart; }, set, clearSession, exportAll, importAll, validateBackup, resetAll, applyRemote, wipeDevice, usageBytes, get storageOK() { return storageOK; },
  iso, parse, addDays, diffDays, today, fmtDate, fmtShort, HE_DAYS, photoAll, photoPut, photoDel };
})(typeof window !== 'undefined' ? window : globalThis);
