/* M10 · Accounts and sync (on-demand chunk account.js).
   Supabase Auth (GoTrue v2) and PostgREST over plain fetch — no SDK, nothing secret in the browser. The build embeds only
   the project URL and the PUBLISHABLE key; every row is protected by Row Level Security (supabase/migrations).
   Model (docs/BACKEND-ARCHITECTURE.md):
   • The device copy (localStorage, existing app code) stays the working copy, so the app keeps working offline.
   • Each data area the app already backs up (profile, workouts, nutrition, tracking, plans) is one row in user_state with a
     server-controlled revision `rev`. A change is pushed with "update where rev = <last seen>"; if another device changed it
     first, nothing is overwritten — the user chooses which version to keep (a copy of the other one is kept on the device).
   • fit30.sync remembers which account owns the device data (owner). Device data is never attached to an account without
     the user's choice, never attached to a second account, and the device is wiped on sign-out.
   • "Synced" is shown only after the server confirmed the write.
   Photos (profile photo, progress photos) stay on the device and are not uploaded — the UI says so. */
(function (root) {
'use strict';
const CFG = root.FIT30_BACKEND || null, S = root.Store;
const K = { auth: 'fit30.auth', sync: 'fit30.sync', backup: 'fit30.premigration', redirect: 'fit30.authRedirect', homeHide: 'fit30.acctCardHidden' };
const SECTIONS = ['profile', 'workouts', 'nutrition', 'tracking', 'plans'];
const ls = { get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }, del(k) { try { localStorage.removeItem(k); } catch (e) { } } };
const emit = () => { try { root.dispatchEvent(new CustomEvent('fit30:account')); } catch (e) { } };
const nowS = () => Math.floor(Date.now() / 1000);
const freshSync = () => ({ owner: null, email: null, revs: {}, dirty: {}, status: 'idle', lastSyncAt: null, lastError: null, migration: null, conflict: null });
let sync = Object.assign(freshSync(), ls.get(K.sync) || {});
let sess = ls.get(K.auth); /* { access_token, refresh_token, expires_at, user: { id, email } } — no password is ever stored */
let remoteCfg = null, pendingRemote = null, pushTimer = null, pushing = null, refreshing = null;
const saveSync = () => ls.set(K.sync, sync);
const appUrl = () => location.origin + location.pathname;

/* ---------- errors ---------- */
class ApiError extends Error { constructor(kind, status, code, msg) { super(msg || code || kind); this.kind = kind; this.status = status || 0; this.code = code || ''; } }
const fromResponse = (status, j) => { j = j || {}; const code = j.error_code || j.code || ''; const msg = j.msg || j.message || j.error_description || '';
  const kind = status === 429 || /rate/.test(String(code)) ? 'rate' : status === 401 || status === 403 && /jwt|session/i.test(String(code) + msg) ? 'auth' : status === 409 ? 'conflict' : status >= 500 ? 'server' : 'request';
  return new ApiError(kind, status, String(code), msg); };
const HE = {
  invalid_credentials: 'האימייל או הסיסמה שגויים.', email_not_confirmed: 'צריך לאשר את כתובת האימייל. חפשו את המייל מ־SoFitGo (גם בתיקיית הספאם).',
  user_already_exists: 'כבר קיים חשבון עם האימייל הזה. אפשר להתחבר, או לאפס סיסמה.', weak_password: 'הסיסמה חלשה מדי — לפחות 8 תווים.',
  email_address_invalid: 'כתובת האימייל לא תקינה.', validation_failed: 'כתובת האימייל או הסיסמה לא תקינות.', signup_disabled: 'ההרשמה סגורה כרגע — הבטא פתוחה בהזמנה בלבד.',
  over_email_send_rate_limit: 'נשלחו יותר מדי מיילים לאחרונה. נסו שוב בעוד כמה דקות.', over_request_rate_limit: 'יותר מדי ניסיונות. נסו שוב בעוד כמה דקות.',
  same_password: 'הסיסמה החדשה זהה לקודמת.', otp_expired: 'הקישור פג תוקף או כבר נוצל. בקשו קישור חדש.', email_address_not_authorized: 'שליחת מייל לכתובת הזו לא מאושרת בשרת הבטא.' };
/* M10.3 · e-mail sending failures, worded for what actually happened (checked against the hosted project: a sign-up refused with
   429 over_email_send_rate_limit creates NO user; the built-in Supabase mailer allows 2 e-mails/hour per project and only to team
   addresses). Never "mail sent" unless the server accepted the request. */
const MAIL_HE = {
  signup: { rate: 'לא ניתן לשלוח כרגע מייל אישור — שרת המיילים של הבטא הגיע למגבלת השליחה שלו. החשבון לא נוצר ולא נשלח מייל. אפשר לנסות שוב מאוחר יותר.',
    blocked: 'שרת המיילים של הבטא עדיין לא מורשה לשלוח לכתובת הזו. החשבון לא נוצר ולא נשלח מייל.', fail: 'שליחת מייל האישור נכשלה בשרת. החשבון לא הושלם ולא נשלח מייל. נסו שוב מאוחר יותר.' },
  recover: { rate: 'לא ניתן לשלוח כרגע קישור לאיפוס — שרת המיילים של הבטא הגיע למגבלת השליחה. לא נשלח מייל; נסו שוב מאוחר יותר.',
    blocked: 'שרת המיילים של הבטא עדיין לא מורשה לשלוח לכתובת הזו. לא נשלח מייל.', fail: 'שליחת קישור האיפוס נכשלה בשרת. לא נשלח מייל; נסו שוב מאוחר יותר.' },
  resend: { rate: 'לא ניתן לשלוח שוב כרגע — שרת המיילים של הבטא הגיע למגבלת השליחה. נסו שוב מאוחר יותר.',
    blocked: 'שרת המיילים של הבטא עדיין לא מורשה לשלוח לכתובת הזו.', fail: 'השליחה החוזרת נכשלה בשרת. נסו שוב מאוחר יותר.' } };
function mailErr(e, what) {
  const m = MAIL_HE[what]; if (!e || e.he) return e;
  if (e.code === 'over_email_send_rate_limit') e.he = m.rate;
  else if (e.code === 'email_address_not_authorized') e.he = m.blocked;
  else if (e.status >= 500 || /sending .*email|smtp/i.test(e.message || '')) e.he = m.fail;
  return e;
}
function message(e) {
  if (!e) return ''; if (e.kind === 'network') return 'אין חיבור לשרת. בדקו את החיבור לאינטרנט ונסו שוב.'; if (e.kind === 'unavailable') return 'חשבונות לא זמינים בגרסה הזו.';
  if (e.kind === 'paused') return 'הבטא מושהית כרגע. הנתונים במכשיר נשמרים, ונמשיך כשהיא תחזור.';
  if (HE[e.code]) return HE[e.code]; if (e.kind === 'rate') return HE.over_request_rate_limit; if (e.kind === 'auth') return 'החיבור לחשבון פג. התחברו שוב.';
  if (/rate_limited/.test(e.message)) return 'נשלחו יותר מדי דיווחים בשעה האחרונה. נסו שוב מאוחר יותר.';
  return 'משהו השתבש (' + (e.code || e.status || 'שגיאה') + '). נסו שוב.';
}

/* ---------- HTTP ---------- */
async function http(path, o) {
  o = o || {}; if (!CFG) throw new ApiError('unavailable');
  const h = Object.assign({ apikey: CFG.key, 'content-type': 'application/json' }, o.headers || {});
  if (o.auth !== false) { const t = await accessToken(); if (!t) throw new ApiError('auth', 401, 'no_session'); h.Authorization = 'Bearer ' + t; }
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null, tm = setTimeout(() => ctl && ctl.abort(), o.timeout || 15000);
  let r; try { r = await fetch(CFG.url + path, { method: o.method || 'GET', headers: h, body: o.body != null ? JSON.stringify(o.body) : undefined, signal: ctl ? ctl.signal : undefined, cache: 'no-store', credentials: 'omit' }); }
  catch (e) { throw new ApiError('network'); } finally { clearTimeout(tm); }
  const txt = await r.text(); let j = null; try { j = txt ? JSON.parse(txt) : null; } catch (e) { }
  if (r.ok) return j;
  if (r.status === 401 && o.auth !== false && !o.retried && sess) { if (await refresh(true)) return http(path, Object.assign({}, o, { retried: true })); }
  throw fromResponse(r.status, j);
}
function setSession(s, user) {
  const u = user || s.user || {}, md = u.user_metadata || {};
  sess = { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at || (nowS() + (+s.expires_in || 3600)), user: { id: u.id, email: u.email, first_name: typeof md.first_name === 'string' ? md.first_name.slice(0, 30) : null } };
  ls.set(K.auth, sess); emit();
}
async function accessToken() { if (!sess) return null; if (sess.expires_at - nowS() < 60) { await refresh(false); } return sess ? sess.access_token : null; }
/* refresh tokens rotate: concurrent callers share one request. A rejected refresh token = the session ended (signed out
   elsewhere, revoked, expired): the device data stays, sync waits until the same account signs in again. */
function refresh(force) {
  if (!sess) return Promise.resolve(false); if (refreshing) return refreshing;
  refreshing = http('/auth/v1/token?grant_type=refresh_token', { method: 'POST', auth: false, body: { refresh_token: sess.refresh_token } })
    .then(s => { setSession(s); return true; })
    .catch(e => { if (e.kind === 'network') return !force && sess.expires_at > nowS(); sess = null; ls.del(K.auth); sync.status = 'expired'; sync.lastError = null; saveSync(); emit(); return false; })
    .finally(() => { refreshing = null; });
  return refreshing;
}

/* ---------- auth flows ---------- */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
function validate(email, pw) { if (!EMAIL_RE.test(String(email || '').trim())) return 'כתובת האימייל לא תקינה.'; if (pw != null && String(pw).length < 8) return 'הסיסמה צריכה להכיל לפחות 8 תווים.'; return null; }
async function guardOpen() { await loadConfig(); if (remoteCfg && remoteCfg.beta_open === false) throw new ApiError('paused'); }
async function signUp(email, pw, firstName) {
  const v = validate(email, pw); if (v) throw Object.assign(new ApiError('request', 0, 'client'), { he: v }); await guardOpen();
  const name = String(firstName || '').replace(/\s+/g, ' ').trim().slice(0, 30);
  let r; try { r = await http('/auth/v1/signup?redirect_to=' + encodeURIComponent(appUrl()), { method: 'POST', auth: false, body: { email: email.trim(), password: pw, data: name ? { first_name: name } : {} } }); } catch (e) { throw mailErr(e, 'signup'); }
  if (r && r.access_token) { setSession(r); const next = await afterLogin(); adoptName(); return { session: true, next }; }
  /* M10.1 (found against the real project): with e-mail confirmation ON, Supabase answers a sign-up for an ALREADY REGISTERED e-mail with
     a placeholder user whose identities list is empty, and sends no e-mail. Never report "mail sent" in that case. */
  const u = r && (r.user || r); if (u && Array.isArray(u.identities) && u.identities.length === 0) throw Object.assign(new ApiError('request', 422, 'user_already_exists'), { code: 'user_already_exists', he: HE.user_already_exists });
  return { session: false, confirm: true }; /* e-mail confirmation required: the link brings the user back signed in */
}
async function signIn(email, pw) {
  const v = validate(email, pw); if (v) throw Object.assign(new ApiError('request', 0, 'client'), { he: v }); await guardOpen();
  const r = await http('/auth/v1/token?grant_type=password', { method: 'POST', auth: false, body: { email: email.trim(), password: pw } });
  setSession(r); const next = await afterLogin(); adoptName(); return { next };
}
/* the first name given at sign-up (user metadata) fills an empty profile name — only once the device data belongs to this account */
function adoptName() { const fn = sess && sess.user && sess.user.first_name; if (!fn || sync.owner !== uid()) return; const p = S.load('profile'); if (!p.name) { p.name = String(fn).slice(0, 30); S.save('profile'); } }
const recover = email => { const v = validate(email); if (v) return Promise.reject(Object.assign(new ApiError('request', 0, 'client'), { he: v })); return http('/auth/v1/recover?redirect_to=' + encodeURIComponent(appUrl()), { method: 'POST', auth: false, body: { email: email.trim() } }).catch(e => { throw mailErr(e, 'recover'); }); };
const resend = email => http('/auth/v1/resend', { method: 'POST', auth: false, body: { type: 'signup', email: String(email).trim() } }).catch(e => { throw mailErr(e, 'resend'); });
const updatePassword = pw => { if (String(pw).length < 8) return Promise.reject(Object.assign(new ApiError('request', 0, 'client'), { he: 'הסיסמה צריכה להכיל לפחות 8 תווים.' })); return http('/auth/v1/user', { method: 'PUT', body: { password: pw } }); };
/* e-mail link return (captured by main.js): #access_token=…&refresh_token=…&expires_in=…&type=signup|recovery|invite|magiclink, or #error=… */
async function consumeRedirect() {
  let raw = null; try { raw = sessionStorage.getItem(K.redirect); sessionStorage.removeItem(K.redirect); } catch (e) { } if (!raw) return null;
  const q = new URLSearchParams(raw);
  if (q.get('error') || q.get('error_code')) return { error: HE[q.get('error_code')] || 'הקישור לא תקין או שפג תוקפו. בקשו קישור חדש.' };
  const at = q.get('access_token'), rt = q.get('refresh_token'); if (!at || !rt) return null;
  sess = { access_token: at, refresh_token: rt, expires_at: +(q.get('expires_at') || 0) || nowS() + (+q.get('expires_in') || 3600), user: { id: '', email: '' } };
  try { const u = await http('/auth/v1/user'); setSession({ access_token: sess.access_token, refresh_token: sess.refresh_token, expires_at: sess.expires_at }, u); }
  catch (e) { sess = null; ls.del(K.auth); return { error: message(e) }; }
  if (q.get('type') === 'recovery') return { recovery: true };
  const next = await afterLogin(); adoptName(); return { signedIn: true, next };
}

/* ---------- device data ownership, migration, sync ---------- */
function hasLocalData() {
  const p = S.load('profile'), w = S.load('workouts'), n = S.load('nutrition'), t = S.load('tracking'), pl = S.load('plans');
  return !!(p.name || p.age || p.weight || (p.aims && p.aims.primary) || Object.keys(w.days || {}).length || Object.keys(n.log || {}).length || (t.measures || []).length || Object.keys(t.daily || {}).length || Object.keys(pl.list || {}).length);
}
const uid = () => sess && sess.user && sess.user.id;
const fetchRemote = () => http('/rest/v1/user_state?select=section,data,rev,updated_at');
function applyRows(rows) { for (const r of rows) if (SECTIONS.includes(r.section)) { S.applyRemote(r.section, r.data); sync.revs[r.section] = r.rev; sync.dirty[r.section] = false; } }
function backupDevice(kind, extra) { ls.set(K.backup, Object.assign({ at: new Date().toISOString(), kind, account: sync.email || (sess && sess.user.email) || null, data: S.exportAll() }, extra || {})); }
async function afterLogin() {
  const me = uid(); if (!me) return 'none';
  sync.email = sess.user.email;
  if (sync.owner && sync.owner !== me) { sync.status = 'foreign'; saveSync(); emit(); return 'foreign'; }
  if (sync.status === 'expired' || sync.status === 'foreign') sync.status = 'idle';
  if (!sync.owner) {
    let rows; try { rows = await fetchRemote(); } catch (e) { sync.status = 'error'; sync.lastError = message(e); saveSync(); emit(); return 'error'; }
    if (!hasLocalData()) { applyRows(rows); sync.owner = me; sync.migration = { state: 'done', result: rows.length ? 'loaded-account' : 'new-account', at: new Date().toISOString() }; sync.status = 'synced'; sync.lastSyncAt = Date.now(); saveSync(); await ensureProfileRow(); emit(); return 'loaded'; }
    pendingRemote = rows; sync.migration = { state: 'pending', remoteHas: rows.length > 0, remoteSections: rows.map(r => r.section), at: new Date().toISOString() }; saveSync(); emit(); return 'migration';
  }
  await syncNow(); return 'synced';
}
async function ensureProfileRow() { const me = uid(); if (!me) return; const name = S.load('profile').name || null;
  try { const ex = await http('/rest/v1/profiles?select=id,first_name&id=eq.' + me); if (!ex.length) await http('/rest/v1/profiles', { method: 'POST', body: { id: me, first_name: name } }); else if (ex[0].first_name !== name) await http('/rest/v1/profiles?id=eq.' + me, { method: 'PATCH', body: { first_name: name } }); } catch (e) { /* display copy only; the profile section holds the source of truth */ } }
/* the user's choice when this device has data that belongs to no account yet */
async function migrate(choice) {
  const me = uid(); if (!me || !sync.migration || sync.migration.state === 'done') return null;
  const rows = pendingRemote || await fetchRemote(); pendingRemote = rows;
  if (choice === 'upload' && rows.length) throw new ApiError('request', 0, 'remote_has_data');
  backupDevice('device-before-' + choice, choice === 'replace-account' ? { remote: rows } : null);
  if (choice === 'upload' || choice === 'replace-account') {
    sync.owner = me; rows.forEach(r => { sync.revs[r.section] = r.rev; }); SECTIONS.forEach(s => { sync.dirty[s] = true; }); saveSync();
    const ok = await pushDirty(); sync.migration = { state: ok ? 'done' : 'failed', result: choice, at: new Date().toISOString() }; saveSync(); await ensureProfileRow(); emit(); return ok;
  }
  if (choice === 'use-account' || choice === 'fresh') {
    SECTIONS.forEach(s => S.applyRemote(s, null)); applyRows(choice === 'use-account' ? rows : []);
    sync.owner = me; sync.migration = { state: 'done', result: choice, at: new Date().toISOString() }; sync.status = 'synced'; sync.lastSyncAt = Date.now(); saveSync(); adoptName(); await ensureProfileRow(); emit(); return true;
  }
  return null;
}
function restoreBackup() { const b = ls.get(K.backup); if (!b || !b.data) return false; S.importAll(b.data); return true; } /* importAll validates; its saves mark every area for sync */
async function pullMerge() {
  const rows = await fetchRemote(), seen = new Set(), conflicts = [];
  for (const r of rows) { if (!SECTIONS.includes(r.section)) continue; seen.add(r.section);
    if (sync.revs[r.section] === r.rev) continue;
    if (sync.dirty[r.section]) conflicts.push(r); else { S.applyRemote(r.section, r.data); sync.revs[r.section] = r.rev; } }
  SECTIONS.forEach(s => { if (!seen.has(s) && !sync.revs[s]) sync.dirty[s] = true; }); /* areas the account does not have yet */
  if (conflicts.length) setConflict(conflicts);
  saveSync(); return conflicts.length === 0;
}
function setConflict(rows) { const c = sync.conflict || { sections: [], remote: {} }; rows.forEach(r => { if (!c.sections.includes(r.section)) c.sections.push(r.section); c.remote[r.section] = { data: r.data, rev: r.rev, updated_at: r.updated_at }; }); sync.conflict = c; sync.status = 'conflict'; }
function resolveConflict(keep) {
  const c = sync.conflict; if (!c) return;
  if (keep === 'account') { backupDevice('device-before-conflict'); c.sections.forEach(s => { S.applyRemote(s, c.remote[s].data); sync.revs[s] = c.remote[s].rev; sync.dirty[s] = false; }); }
  else c.sections.forEach(s => { sync.revs[s] = c.remote[s].rev; sync.dirty[s] = true; });
  sync.conflict = null; sync.status = 'idle'; saveSync(); emit(); if (keep !== 'account') pushDirty();
}
const deepEq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
async function pushSection(s) {
  const me = uid(), data = S.load(s), build = /^[0-9a-f]{6,20}$/.test(root.FIT30_BUILD || '') ? root.FIT30_BUILD : null, rev = sync.revs[s];
  if (rev) {
    const rows = await http(`/rest/v1/user_state?user_id=eq.${me}&section=eq.${s}&rev=eq.${rev}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: { data, client_build: build } });
    if (rows.length === 1) { sync.revs[s] = rows[0].rev; sync.dirty[s] = false; return true; }
    const cur = await http(`/rest/v1/user_state?select=section,data,rev,updated_at&section=eq.${s}`);
    if (!cur.length) { delete sync.revs[s]; return pushSection(s); } /* the account row is gone (e.g. deleted elsewhere): create it again */
    if (deepEq(cur[0].data, data)) { sync.revs[s] = cur[0].rev; sync.dirty[s] = false; return true; }
    setConflict(cur); return false;
  }
  try { const rows = await http('/rest/v1/user_state', { method: 'POST', headers: { Prefer: 'return=representation' }, body: { section: s, data, client_build: build } }); sync.revs[s] = rows[0].rev; sync.dirty[s] = false; return true; }
  catch (e) { if (e.kind !== 'conflict') throw e; /* the row exists already (another device, or an interrupted earlier attempt) */
    const cur = await http(`/rest/v1/user_state?select=section,data,rev,updated_at&section=eq.${s}`);
    if (cur.length && deepEq(cur[0].data, data)) { sync.revs[s] = cur[0].rev; sync.dirty[s] = false; return true; }
    if (cur.length) { setConflict(cur); return false; } throw e; }
}
function pushDirty() {
  if (pushing) return pushing.then(() => pushDirty());
  pushing = (async () => {
    if (!uid() || sync.owner !== uid()) return false; if (remoteCfg && remoteCfg.beta_open === false) { sync.status = 'paused'; saveSync(); emit(); return false; }
    const todo = SECTIONS.filter(s => sync.dirty[s] && !(sync.conflict && sync.conflict.sections.includes(s))); if (!todo.length) { if (!sync.conflict) { sync.status = 'synced'; sync.lastSyncAt = sync.lastSyncAt || Date.now(); saveSync(); emit(); } return !sync.conflict; }
    sync.status = 'syncing'; emit(); let ok = true;
    for (const s of todo) { try { ok = (await pushSection(s)) && ok; } catch (e) { ok = false; sync.lastError = message(e); sync.status = e.kind === 'network' ? 'offline' : e.kind === 'auth' ? 'expired' : 'error'; saveSync(); emit(); return false; } }
    if (sync.conflict) sync.status = 'conflict'; else if (ok) { sync.status = 'synced'; sync.lastSyncAt = Date.now(); sync.lastError = null; }
    saveSync(); emit(); return ok && !sync.conflict;
  })().finally(() => { pushing = null; });
  return pushing;
}
async function syncNow() {
  if (!uid() || sync.owner !== uid()) return false;
  try { await loadConfig(); if (remoteCfg && remoteCfg.beta_open === false) { sync.status = 'paused'; saveSync(); emit(); return false; } await pullMerge(); }
  catch (e) { sync.lastError = message(e); sync.status = e.kind === 'network' ? 'offline' : e.kind === 'auth' ? 'expired' : 'error'; saveSync(); emit(); return false; }
  const r = await pushDirty(); if (root.App && !document.querySelector('input:focus, textarea:focus, select:focus')) root.App.render(); return r;
}
function onSaved(e) {
  const name = e && e.detail && e.detail.name; if (!SECTIONS.includes(name) || !sync.owner) return;
  sync.dirty[name] = true; if (sync.status === 'synced') sync.status = 'pending'; saveSync();
  clearTimeout(pushTimer); if (uid() === sync.owner) pushTimer = setTimeout(() => { pushDirty(); }, 1200);
}

/* ---------- sign-out / account deletion ---------- */
const unsynced = () => SECTIONS.filter(s => sync.dirty[s]);
async function signOut(force) {
  if (uid() && unsynced().length) { try { await pushDirty(); } catch (e) { } }
  const left = unsynced(); if (left.length && !force) return { unsynced: left };
  if (sess) { try { await http('/auth/v1/logout', { method: 'POST', timeout: 6000 }); } catch (e) { /* the device is cleared anyway; the server session expires on its own */ } }
  await wipe(); return { ok: true };
}
async function deleteAccount() { await http('/rest/v1/rpc/delete_my_account', { method: 'POST', body: {} }); await wipe(); return true; }
async function wipe() { sess = null; sync = freshSync(); pendingRemote = null; await S.wipeDevice(); try { sessionStorage.removeItem(K.redirect); } catch (e) { } emit(); }
const photoCount = () => S.photoAll().then(l => l.length).catch(() => 0);

/* ---------- bug reports ---------- */
const rid = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
async function submitReport(r) {
  const body = { client_report_id: r.client_report_id || rid(), category: r.category, title: String(r.title || '').trim().slice(0, 120), description: String(r.description || '').trim().slice(0, 4000),
    steps: (r.steps || '').trim().slice(0, 4000) || null, expected: (r.expected || '').trim().slice(0, 2000) || null, actual: (r.actual || '').trim().slice(0, 2000) || null,
    severity: r.severity || 'medium', screen: (r.screen || '').slice(0, 60) || null, app_build: /^[0-9a-f]{6,20}$/.test(root.FIT30_BUILD || '') ? root.FIT30_BUILD : null, platform: (r.platform || '').slice(0, 300) || null };
  try { const rows = await http('/rest/v1/bug_reports', { method: 'POST', headers: { Prefer: 'return=representation' }, body }); return rows[0]; }
  catch (e) { if (e.kind !== 'conflict') throw e; /* the same report was already stored (retry after a lost response) */
    const rows = await http('/rest/v1/bug_reports?select=id,client_report_id,title,status,created_at&client_report_id=eq.' + encodeURIComponent(body.client_report_id)); if (rows.length) return rows[0]; throw e; }
}
const myReports = () => http('/rest/v1/bug_reports?select=id,client_report_id,category,title,severity,status,created_at&order=created_at.desc&limit=50');

/* ---------- public config (beta switch) ---------- */
async function loadConfig() { if (!CFG) return null; try { const rows = await http('/rest/v1/app_config?select=key,value', { auth: false, timeout: 8000 }); remoteCfg = Object.fromEntries(rows.map(r => [r.key, r.value])); } catch (e) { /* keep last known */ } return remoteCfg; }

/* ---------- state for the UI ---------- */
function state() {
  return { available: !!CFG, channel: CFG ? CFG.channel : null, signedIn: !!uid(), email: (sess && sess.user.email) || sync.email || null, userId: uid() || null,
    owner: sync.owner, status: sync.status, lastSyncAt: sync.lastSyncAt, lastError: sync.lastError, unsynced: unsynced(), migration: sync.migration, conflict: sync.conflict,
    backup: (ls.get(K.backup) || null) && { at: ls.get(K.backup).at, kind: ls.get(K.backup).kind }, config: remoteCfg };
}
async function handleRedirect() { const red = await consumeRedirect().catch(() => null); if (red) { root.Account.lastRedirect = red; emit(); } if (root.App) root.App.render(); }
let inited = false;
async function init() {
  if (inited || !CFG) return; inited = true;
  root.addEventListener('fit30:saved', onSaved); root.addEventListener('online', () => { if (uid()) syncNow(); });
  loadConfig().then(emit);
  const red = await consumeRedirect().catch(() => null); if (red) { root.Account.lastRedirect = red; emit(); if (root.App) root.App.render(); return; }
  if (sess) { await accessToken(); if (sess) { if (sync.owner === uid()) await syncNow(); else if (!sync.owner) await afterLogin(); } }
  emit();
}
root.Account = { available: !!CFG, api: (p, o) => http(p, o), SECTIONS, state, init, signUp, signIn, signOut, recover, resend, updatePassword, deleteAccount, migrate, resolveConflict, restoreBackup, syncNow, pushDirty,
  submitReport, myReports, loadConfig, handleRedirect, photoCount, message, validate, hasLocalData, lastRedirect: null, _debug: { http, refresh, get sync() { return sync; }, get sess() { return sess; } } };
init();
})(window);
