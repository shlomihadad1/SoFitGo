/* M10 · LOCAL Supabase API emulator for automated tests (never shipped, never used by the app in production).
   Implements the subset of the Supabase HTTP API that SoFitGo uses, with the same paths, headers, status codes and error
   shapes as Supabase Auth (GoTrue v2) and PostgREST v12, on top of a REAL PostgreSQL 16 database that has the migration
   applied (via the shim). Every /rest/v1 request runs as role anon or authenticated with request.jwt.claims set, so all
   data access goes through the real RLS policies. JWTs are HS256 with a local random secret.
   What it does NOT prove: hosted Supabase behaviour (email delivery, rate limits, key formats). tools/live_check.js covers
   the hosted project once the owner has applied the migration.
   Usage: node tools/supa_local.js [port] (env: PGHOST, PGPORT, SUPA_DB, SUPA_JWT_EXP=seconds, SUPA_CONFIRM=1 to require e-mail confirmation) */
const http = require('http'), crypto = require('crypto'), { execFile } = require('child_process'), fs = require('fs'), path = require('path');
const PORT = +(process.argv[2] || 54321), DB = process.env.SUPA_DB || 'sofitgo_local', KEY = 'sb_publishable_LOCALTESTKEY_not_a_secret';
const PG = ['-h', process.env.PGHOST || '/tmp', '-p', process.env.PGPORT || '54329', '-U', 'postgres', '-d', DB, '-v', 'ON_ERROR_STOP=1', '-Atq', '-X'];
const SECRET = crypto.randomBytes(32); let JWT_EXP = +(process.env.SUPA_JWT_EXP || 3600); let CONFIRM = process.env.SUPA_CONFIRM === '1'; let MAILFAIL = ''; /* '', 'rate' or 'blocked' — reproduces the hosted mailer's refusals */
const TABLES = ['profiles', 'user_state', 'bug_reports', 'app_config'], RPCS = ['delete_my_account'];
let offline = false; /* test hook: simulate a network failure (requests are dropped) */
const lit = s => "'" + String(s).replace(/'/g, "''") + "'";
const dq = s => { const t = '$j' + crypto.randomBytes(4).toString('hex') + '$'; return t + s + t; };
const ident = s => { if (!/^[a-z_][a-z0-9_]*$/.test(s)) throw Object.assign(new Error('bad identifier'), { http: 400, code: 'PGRST100' }); return s; };
function sql(stmt) { return new Promise(res => { const p = execFile('psql', PG, { encoding: 'utf8', maxBuffer: 1 << 26 }, (e, out, err) => res(e ? { err: String(err || e.message) } : { out: out.trim() })); p.stdin.end('\\set VERBOSITY verbose\n' + stmt); }); }
const b64u = b => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
function sign(claims) { const h = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' })), p = b64u(JSON.stringify(claims)); return h + '.' + p + '.' + b64u(crypto.createHmac('sha256', SECRET).update(h + '.' + p).digest()); }
function verify(tok) { const [h, p, s] = String(tok).split('.'); if (!s) return { bad: 'malformed' }; if (b64u(crypto.createHmac('sha256', SECRET).update(h + '.' + p).digest()) !== s) return { bad: 'signature' };
  const c = JSON.parse(Buffer.from(p.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()); if (c.exp * 1000 < Date.now()) return { bad: 'expired', c }; return { c }; }
const hashPw = pw => { const salt = crypto.randomBytes(16).toString('hex'); return 'scrypt$' + salt + '$' + crypto.scryptSync(pw, salt, 32).toString('hex'); };
const checkPw = (pw, h) => { const [, salt, k] = String(h).split('$'); return !!k && crypto.timingSafeEqual(Buffer.from(k, 'hex'), crypto.scryptSync(pw, salt, 32)); };
const userJson = u => ({ id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, email_confirmed_at: u.email_confirmed_at, user_metadata: u.raw_user_meta_data || {}, identities: [{ provider: 'email', user_id: u.id }], created_at: u.created_at }); /* real users have one identity (see the repeat sign-up case) */
async function session(u) { const now = Math.floor(Date.now() / 1000), rt = crypto.randomBytes(24).toString('hex');
  await sql(`insert into auth.refresh_tokens (token, user_id) values (${lit(rt)}, ${lit(u.id)});`);
  return { access_token: sign({ sub: u.id, role: 'authenticated', aud: 'authenticated', email: u.email, iat: now, exp: now + JWT_EXP, session_id: rt.slice(0, 8) }), token_type: 'bearer', expires_in: JWT_EXP, expires_at: now + JWT_EXP, refresh_token: rt, user: userJson(u) }; }
const getUser = async where => { const r = await sql(`select row_to_json(u) from auth.users u where ${where};`); return r.out ? JSON.parse(r.out) : null; };
const authErr = (res, status, error_code, msg) => send(res, status, { code: status, error_code, msg });
function send(res, status, body, headers) { res.writeHead(status, Object.assign({ 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' }, headers || {})); res.end(body == null ? '' : JSON.stringify(body)); }
const pgErr = err => { const m = String(err).match(/ERROR:\s+([0-9A-Z]{5}):\s+([^\n]*)/) || []; const code = m[1] || 'XX000', message = (m[2] || String(err)).trim();
  const status = code === '42501' ? 403 : code === '23505' ? 409 : /^(23|22)/.test(code) ? 400 : code === 'P0001' ? 400 : 500; return { status, body: { code, message, details: null, hint: null } }; };

async function handle(req, res, body) {
  const u = new URL(req.url, 'http://x'), p = u.pathname;
  if (req.method === 'OPTIONS') return send(res, 204);
  if (p.startsWith('/__test/')) { /* test-only controls, local emulator only */
    if (p === '/__test/offline') { offline = u.searchParams.get('on') === '1'; return send(res, 200, { offline }); }
    if (p === '/__test/jwt_exp') { JWT_EXP = +u.searchParams.get('s'); return send(res, 200, { JWT_EXP }); }
    if (p === '/__test/mail_fail') { MAILFAIL = u.searchParams.get('mode') || ''; return send(res, 200, { MAILFAIL }); }
    if (p === '/__test/confirm_required') { CONFIRM = u.searchParams.get('on') === '1'; return send(res, 200, { CONFIRM }); }
    if (p === '/__test/confirm') { await sql(`update auth.users set email_confirmed_at = now() where email = ${lit(u.searchParams.get('email'))};`); return send(res, 200, {}); }
    if (p === '/__test/sql') { const r = await sql(body); return send(res, r.err ? 500 : 200, r); }
    return send(res, 404, {});
  }
  if (req.headers.apikey !== KEY) return send(res, 401, { message: 'No API key found in request', hint: 'No `apikey` request header or url param was found.' });
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  let J = null; try { J = body ? JSON.parse(body) : {}; } catch (e) { return send(res, 400, { code: 'PGRST102', message: 'Empty or invalid json' }); }
  /* ── Auth (GoTrue v2 subset) ── */
  /* hosted behaviour (verified 2026-10-20): when the mailer refuses, the request fails and NO user is created */
  const mailRefusal = () => MAILFAIL === 'rate' ? authErr(res, 429, 'over_email_send_rate_limit', 'email rate limit exceeded') : MAILFAIL === 'blocked' ? authErr(res, 400, 'email_address_not_authorized', 'Email address not authorized') : null;
  if (p === '/auth/v1/signup' && req.method === 'POST' && CONFIRM && MAILFAIL) return mailRefusal();
  if ((p === '/auth/v1/recover' || p === '/auth/v1/resend') && req.method === 'POST' && MAILFAIL) return mailRefusal();
  if (p === '/auth/v1/signup' && req.method === 'POST') {
    const email = String(J.email || '').trim().toLowerCase(), pw = String(J.password || '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return authErr(res, 400, 'email_address_invalid', 'Unable to validate email address: invalid format');
    if (pw.length < 8) return authErr(res, 422, 'weak_password', 'Password should be at least 8 characters.');
    { const ex = await getUser(`email = ${lit(email)}`); /* like hosted Supabase: with e-mail confirmation ON a repeat sign-up is NOT an error
         (no account enumeration) — it returns an obfuscated user with an EMPTY identities list and sends no mail. Confirmation OFF → 422. */
      if (ex && CONFIRM) return send(res, 200, { id: '00000000-0000-4000-8000-' + String(Date.now()).slice(-12).padStart(12, '0'), aud: 'authenticated', role: 'authenticated', email, phone: '', confirmation_sent_at: new Date().toISOString(), app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, identities: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString(), is_anonymous: false });
      if (ex) return authErr(res, 422, 'user_already_exists', 'User already registered'); }
    const meta = JSON.stringify(J.data || {}), ins = await sql(`insert into auth.users (email, encrypted_password, email_confirmed_at, raw_user_meta_data) values (${lit(email)}, ${lit(hashPw(pw))}, ${CONFIRM ? 'null' : 'now()'}, ${dq(meta)}::jsonb) returning row_to_json(users);`);
    if (ins.err) return send(res, 500, { code: 500, msg: 'Database error saving new user' }); const nu = JSON.parse(ins.out);
    return send(res, 200, CONFIRM ? Object.assign(userJson(nu), { confirmation_sent_at: new Date().toISOString() }) : await session(nu));
  }
  if (p === '/auth/v1/token' && req.method === 'POST') {
    const gt = u.searchParams.get('grant_type');
    if (gt === 'password') { const usr = await getUser(`email = ${lit(String(J.email || '').trim().toLowerCase())}`);
      if (!usr || !checkPw(String(J.password || ''), usr.encrypted_password)) return authErr(res, 400, 'invalid_credentials', 'Invalid login credentials');
      if (!usr.email_confirmed_at) return authErr(res, 400, 'email_not_confirmed', 'Email not confirmed');
      return send(res, 200, await session(usr)); }
    if (gt === 'refresh_token') { const r = await sql(`select row_to_json(t) from auth.refresh_tokens t where token = ${lit(String(J.refresh_token || ''))};`); const t = r.out ? JSON.parse(r.out) : null;
      if (!t || t.revoked) return authErr(res, 400, 'refresh_token_not_found', 'Invalid Refresh Token: Refresh Token Not Found');
      await sql(`update auth.refresh_tokens set revoked = true where token = ${lit(t.token)};`); const usr = await getUser(`id = ${lit(t.user_id)}`);
      if (!usr) return authErr(res, 400, 'user_not_found', 'User not found'); return send(res, 200, await session(usr)); }
    return authErr(res, 400, 'unsupported_grant_type', 'unsupported grant_type');
  }
  if (p === '/auth/v1/recover' && req.method === 'POST') return send(res, 200, {}); /* Supabase answers 200 whether or not the address exists */
  if (p === '/auth/v1/resend' && req.method === 'POST') return send(res, 200, {});
  if (p.startsWith('/auth/v1/')) { /* endpoints that need a valid access token */
    const v = verify(bearer); if (v.bad) return authErr(res, 403, 'bad_jwt', v.bad === 'expired' ? 'invalid JWT: unable to parse or verify signature, token has invalid claims: token is expired' : 'invalid JWT');
    const usr = await getUser(`id = ${lit(v.c.sub)}`); if (!usr) return authErr(res, 403, 'user_not_found', 'User from sub claim in JWT does not exist');
    if (p === '/auth/v1/user' && req.method === 'GET') return send(res, 200, userJson(usr));
    if (p === '/auth/v1/user' && req.method === 'PUT') { if (J.password) { if (String(J.password).length < 8) return authErr(res, 422, 'weak_password', 'Password should be at least 8 characters.'); await sql(`update auth.users set encrypted_password = ${lit(hashPw(String(J.password)))} where id = ${lit(usr.id)};`); } return send(res, 200, userJson(usr)); }
    if (p === '/auth/v1/logout' && req.method === 'POST') { await sql(`update auth.refresh_tokens set revoked = true where user_id = ${lit(usr.id)};`); return send(res, 204); }
    return send(res, 404, { code: 404, msg: 'not found' });
  }
  /* ── REST (PostgREST v12 subset) ── */
  let claims = '';
  if (bearer && bearer !== KEY) { const v = verify(bearer); if (v.bad === 'expired') return send(res, 401, { code: 'PGRST301', message: 'JWT expired', details: null, hint: null }); if (v.bad) return send(res, 401, { code: 'PGRST301', message: 'JWSError JWSInvalidSignature', details: null, hint: null }); claims = JSON.stringify({ sub: v.c.sub, role: 'authenticated' }); }
  const role = claims ? 'authenticated' : 'anon', pre = `begin;\nset local role ${role};\nset local request.jwt.claims to ${lit(claims)};\n`;
  const prefer = String(req.headers.prefer || ''), rep = /return=representation/.test(prefer);
  try {
    let m;
    if ((m = p.match(/^\/rest\/v1\/rpc\/([a-z_]+)$/)) && req.method === 'POST') { if (!RPCS.includes(m[1])) return send(res, 404, { code: 'PGRST202', message: 'function not found' });
      const r = await sql(pre + `select public.${ident(m[1])}();\ncommit;`); if (r.err) { const e = pgErr(r.err); return send(res, e.status, e.body); } return send(res, 204); }
    if (!(m = p.match(/^\/rest\/v1\/([a-z_]+)$/)) || !TABLES.includes(m[1])) return send(res, 404, { code: 'PGRST205', message: 'table not found' });
    const t = ident(m[1]), conds = [], skip = new Set(['select', 'order', 'limit', 'on_conflict']);
    for (const [k, v] of u.searchParams) { if (skip.has(k)) continue; const mm = String(v).match(/^eq\.(.*)$/s); if (!mm) return send(res, 400, { code: 'PGRST100', message: 'only eq. filters are supported by the local emulator' }); conds.push(`public.${t}.${ident(k)} = ${lit(mm[1])}`); }
    const where = conds.length ? ' where ' + conds.join(' and ') : '';
    const cols = (u.searchParams.get('select') || '*').split(',').map(c => c === '*' ? '*' : ident(c)).join(', ');
    const ord = u.searchParams.get('order') ? ' order by ' + u.searchParams.get('order').split(',').map(o => { const [c, d] = o.split('.'); return ident(c) + (d === 'desc' ? ' desc' : ' asc'); }).join(', ') : '';
    const lim = u.searchParams.get('limit') ? ' limit ' + Math.min(1000, Math.max(0, parseInt(u.searchParams.get('limit'), 10) || 0)) : '';
    let q, status = 200;
    if (req.method === 'GET') q = `select coalesce(json_agg(t), '[]') from (select ${cols} from public.${t}${where}${ord}${lim}) t;`;
    else if (req.method === 'POST') { const rows = Array.isArray(J) ? J : [J]; const keys = [...new Set(rows.flatMap(Object.keys))].map(ident).join(', '); status = 201;
      q = `with w as (insert into public.${t} (${keys}) select ${keys} from json_populate_recordset(null::public.${t}, ${dq(JSON.stringify(rows))}::json) returning *) select coalesce(json_agg(w), '[]') from w;`; }
    else if (req.method === 'PATCH') { const keys = Object.keys(J).map(ident); if (!keys.length) return send(res, 400, { code: 'PGRST100', message: 'empty body' });
      q = `with w as (update public.${t} set ${keys.map(k => `${k} = r.${k}`).join(', ')} from (select * from json_populate_record(null::public.${t}, ${dq(JSON.stringify(J))}::json)) r${where} returning public.${t}.*) select coalesce(json_agg(w), '[]') from w;`; }
    else if (req.method === 'DELETE') q = `with w as (delete from public.${t}${where} returning *) select coalesce(json_agg(w), '[]') from w;`;
    else return send(res, 405, { message: 'method not allowed' });
    const r = await sql(pre + q + '\ncommit;'); if (r.err) { const e = pgErr(r.err); return send(res, e.status, e.body); }
    const out = JSON.parse(r.out || '[]');
    if (req.method === 'GET') return send(res, 200, out);
    return rep ? send(res, status, out) : send(res, req.method === 'POST' ? 201 : 204);
  } catch (e) { return send(res, e.http || 500, { code: e.code || 'XX000', message: e.message }); }
}
http.createServer((req, res) => { let b = ''; req.on('data', d => { b += d; }); req.on('end', () => { if (offline && !req.url.startsWith('/__test/')) { req.socket.destroy(); return; } handle(req, res, b).catch(e => send(res, 500, { message: String(e.message) })); }); })
  .listen(PORT, () => console.log('supa_local listening on ' + PORT + ' db ' + DB));
module.exports = { KEY };
