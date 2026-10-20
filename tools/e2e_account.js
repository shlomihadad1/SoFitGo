/* M10 · Accounts, sync, migration, isolation, bug reports — end to end in the app.
   Environment (all local, all labelled in the report):
   • the app: a beta build of THIS source with SOFITGO_SUPABASE_URL=http://localhost:54321 (built here, served on 8098);
   • the backend: tools/supa_local.js — the Supabase Auth/PostgREST API surface over a REAL PostgreSQL 16 with the migration
     applied; every data request is checked by the real RLS policies;
   • the browser: Playwright Chromium with iPhone emulation (NOT Safari, NOT a device).
   It does NOT test the hosted Supabase project — tools/live_check.js does that after the owner applies the migration.
   Usage: node tools/e2e_account.js */
const { chromium, devices } = require('playwright'); const fs = require('fs'), path = require('path'), { spawn, execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..'), APP = 'http://localhost:8098/', API = 'http://localhost:54321', KEY = 'sb_publishable_LOCALTESTKEY_not_a_secret', STD = process.argv[2] || 'http://localhost:8096/';
const res = []; let G = ''; const ok = (c, m, i) => res.push({ g: G, ok: !!c, m: m + (i !== undefined && !c ? ' → ' + JSON.stringify(i).slice(0, 400) : '') });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const api = async (p, o) => { const r = await fetch(API + p, Object.assign({ headers: { apikey: KEY, 'content-type': 'application/json' } }, o || {})); const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) { } return { status: r.status, j }; };
const su = async q => (await fetch(API + '/__test/sql', { method: 'POST', body: q })).json(); /* superuser SQL — test inspection only */
const ctl = p => fetch(API + p);
const PW = 'Beta-pass-2026';
const procs = []; /* child servers started by this test; always stopped, also after a crash */
(async () => {
  try {
    execFileSync('sh', [path.join(ROOT, 'tools/pg_local.sh')], { stdio: 'ignore' });
    execFileSync('sh', [path.join(ROOT, 'tools/supa_local_db.sh')], { stdio: 'ignore', env: Object.assign({}, process.env, { SUPA_DB: 'sofitgo_e2e' }) });
    execFileSync('node', [path.join(ROOT, 'tools/build.js')], { stdio: 'ignore', env: Object.assign({}, process.env, { SOFITGO_SUPABASE_URL: API, SOFITGO_SUPABASE_PUBLISHABLE_KEY: KEY, FIT30_OUT: 'dist/pwa-beta-local' }) });
    try { await fetch(API + '/__test/offline?on=0'); console.error('port 54321 busy — stop the other emulator first'); process.exit(2); } catch (e) { }
    procs.push(spawn('node', [path.join(ROOT, 'tools/supa_local.js'), '54321'], { env: Object.assign({}, process.env, { SUPA_DB: 'sofitgo_e2e' }), stdio: 'ignore' }));
    let up = false; try { up = (await fetch(APP)).ok; } catch (e) { }
    if (!up) { procs.push(spawn('python3', ['-m', 'http.server', '8098', '-d', path.join(ROOT, 'dist/pwa-beta-local')], { stdio: 'ignore' })); }
    await sleep(1500);
  } catch (e) { console.error('setup failed: ' + e.message); procs.forEach(p => p.kill()); process.exit(2); }
  const b = await chromium.launch();
  const mk = async () => { const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'he-IL', serviceWorkers: 'block' }); const p = await ctx.newPage(); const errs = [], warns = [];
    p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'warning' && /no handler/.test(m.text())) warns.push(m.text()); }); return { ctx, p, errs, warns }; };
  const go = async (p, h, ms) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(ms || 500); };
  const acct = p => p.evaluate(() => window.Account ? window.Account.state() : null);
  const waitFor = async (p, fn, arg, ms) => { const t0 = Date.now(); while (Date.now() - t0 < (ms || 8000)) { if (await p.evaluate(fn, arg).catch(() => false)) return true; await p.waitForTimeout(150); } return false; };
  const ready = p => waitFor(p, () => !!window.Account && !!window.Screens.account);
  const fill = async (p, sel, v) => { await p.fill(sel, v); };
  const signup = async (p, email, name) => { await go(p, '#/account/signup', 700); await ready(p); await p.evaluate(() => App.render()); await p.waitForTimeout(200);
    if (name) await fill(p, '#ac-name', name); await fill(p, '#ac-email', email); await fill(p, '#ac-pw', PW); await fill(p, '#ac-pw2', PW); await p.check('#ac-ok'); await p.locator('[data-act=signup]').click(); await waitFor(p, () => !document.querySelector('[data-act=signup][disabled]')); await p.waitForTimeout(400); };
  const login = async (p, email, pw) => { await go(p, '#/account/login', 700); await ready(p); await p.evaluate(() => App.render()); await p.waitForTimeout(200); await fill(p, '#ac-email', email); await fill(p, '#ac-pw', pw || PW); await p.locator('[data-act=login]').click(); await waitFor(p, () => !document.querySelector('[data-act=login][disabled]')); await p.waitForTimeout(500); };
  const lsKeys = p => p.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('fit30.')).sort());
  const seedData = p => p.evaluate(() => { const pr = Store.load('profile'); Object.assign(pr, { age: 33, height: 170, weight: 71.5, startWeight: 73, sex: 'f' }); pr.aims = { primary: 'fat_loss', secondary: [] }; Store.save('profile');
    const t = Store.load('tracking'); t.measures.push({ id: 'm1', date: Store.today(), weight: 71.5, waist: null, note: '' }); Store.save('tracking'); Core.setDaily(Store.today(), { water: 750 }); });
  let A_ID = null;

  /* ── 0. build safety ── */
  G = 'build: no secrets reach the browser';
  const bad = k => { try { execFileSync('node', [path.join(ROOT, 'tools/build.js')], { stdio: 'pipe', env: Object.assign({}, process.env, { SOFITGO_SUPABASE_URL: 'https://abcdefgh.supabase.co', SOFITGO_SUPABASE_PUBLISHABLE_KEY: k, FIT30_OUT: 'dist/pwa-refused' }) }); return false; } catch (e) { return /Refusing|does not look/.test(String(e.stderr)); } };
  ok(bad('sb_secret_0123456789abcdef'), 'build refuses an sb_secret_ key');
  const fakeSR = 'eyJhbGciOiJIUzI1NiJ9.' + Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64').replace(/=+$/, '') + '.sig';
  ok(bad(fakeSR), 'build refuses a legacy service_role JWT');
  fs.rmSync(path.join(ROOT, 'dist/pwa-refused'), { recursive: true, force: true });
  const shipped = ['index.html', 'account.js', 'extra.js', 'sw.js'].map(f => fs.readFileSync(path.join(ROOT, 'dist/pwa-beta-local', f), 'utf8')).join('\n');
  ok(!/sb_secret_|service_role|SUPABASE_SERVICE|postgres:\/\//i.test(shipped), 'beta build contains no secret key, service-role reference or DB URL');
  ok(/"key":"sb_publishable_/.test(shipped), 'only the publishable key is embedded (public by design)');

  /* ── 1. no backend: honest ── */
  G = 'standard build (no backend configured)';
  { const { ctx, p } = await mk(); await p.goto(STD); await p.waitForTimeout(800); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(700);
    /* M10 P0 (owner report): sign-up / sign-in must be visible from the first screen even before the server is switched on.
       Replaces the old "no account prompt without a backend" check; the honesty requirement is kept and made stricter. */
    ok(await p.locator('[data-welcome] [data-welcome-signup]').count() === 1 && await p.locator('[data-welcome] [data-welcome-login]').count() === 1, 'first launch: welcome card with הרשמה and התחברות');
    ok(await p.locator('[data-account-prompt]').count() === 0, 'no second (duplicate) account prompt');
    await p.locator('[data-welcome-signup]').click(); await p.waitForTimeout(1500);
    const un = await p.evaluate(() => ({ un: !!document.querySelector('[data-acct="unavailable"]'), txt: document.querySelector('#view').innerText, form: !!document.querySelector('#ac-email, #ac-pw') }));
    ok(un.un && /עוד לא הופעלו/.test(un.txt) && /לא נוצר חשבון/.test(un.txt) && !un.form, 'הרשמה without a server: says plainly accounts are not switched on; no form, no fake account', un);
    await p.locator('[data-act=noAcct]').click(); await p.waitForTimeout(600);
    ok(await p.evaluate(() => location.hash === '#/' || location.hash === '') && await p.locator('[data-welcome]').count() === 0, '"להמשיך בלי חשבון" returns Home; the welcome card is gone');
    await go(p, '#/settings', 600); ok(await p.locator('[data-account-off] a[href="#/account"]').count() === 1, 'Settings always has an account area (honest "לא הופעל")');
    ok(!(await p.evaluate(() => Object.keys(localStorage).some(k => /auth|sync/.test(k)))), 'no session or sync state was created'); await ctx.close(); }

  G = 'runtime switch: sofitgo-config.js';
  { const cfg = body => async c => { await c.route('**/sofitgo-config.js', r => r.fulfill({ status: 200, contentType: 'application/javascript', body })); };
    let x = await mk(); await cfg("window.SOFITGO_CONFIG={supabaseUrl:'https://abcdefgh.supabase.co',publishableKey:'sb_secret_0123456789abcdef'};")(x.ctx);
    await x.p.goto(STD); await x.p.waitForTimeout(800); ok(await x.p.evaluate(() => !window.FIT30_BACKEND), 'a SECRET key in the config file is ignored (app stays device-only)'); await x.ctx.close();
    x = await mk(); await cfg("window.SOFITGO_CONFIG={supabaseUrl:'https://evil.example.com',publishableKey:'sb_publishable_abcdefghijkl'};")(x.ctx);
    await x.p.goto(STD); await x.p.waitForTimeout(800); ok(await x.p.evaluate(() => !window.FIT30_BACKEND), 'a non-Supabase URL is ignored'); await x.ctx.close();
    x = await mk(); await cfg(`window.SOFITGO_CONFIG={supabaseUrl:'${API}',publishableKey:'${KEY}'};`)(x.ctx);
    await x.p.goto(STD); await x.p.waitForTimeout(800); await x.p.evaluate(() => localStorage.clear()); await x.p.reload(); await ready(x.p);
    ok(await x.p.evaluate(() => window.FIT30_BACKEND && window.FIT30_BACKEND.source === 'config'), 'the STANDARD deploy build turns accounts on from the config file (no rebuild)');
    await x.p.locator('[data-welcome-signup]').click(); await x.p.waitForTimeout(900); await ready(x.p);
    ok(await x.p.locator('#ac-email').count() === 1 && await x.p.locator('#ac-pw2').count() === 1, 'welcome → הרשמה opens the real form (email, password, confirmation)');
    await signup(x.p, 'cfg-user@test.invalid', 'דנה'); const cs = await x.p.evaluate(() => window.Account.state());
    ok(cs.signedIn && /^[0-9a-f-]{36}$/.test(cs.userId), 'sign-up through the config-file build creates a real account on the (local) auth server', cs);
    await x.p.reload(); await ready(x.p); ok((await x.p.evaluate(() => window.Account.state())).signedIn, 'session restored after reopening the app'); await x.ctx.close(); }

  /* ── 2. sign-up, validation, session ── */
  G = 'sign-up and validation';
  let { ctx, p, errs, warns } = await mk();
  await p.goto(APP); await p.waitForTimeout(900); await p.evaluate(() => localStorage.clear()); await p.reload(); await ready(p); await p.waitForTimeout(500);
  ok(await p.locator('[data-welcome] [data-welcome-signup]').count() === 1 && await p.locator('[data-welcome] [data-welcome-login]').count() === 1 && await p.locator('[data-account-prompt]').count() === 0, 'beta build, first launch: welcome with הרשמה / התחברות (not forced; no duplicate prompt)');
  await p.locator('[data-welcome-login]').click(); await p.waitForTimeout(800); ok(await p.locator('[data-form=login] #ac-email').count() === 1, 'welcome → התחברות opens the login form'); await go(p, '#/', 500);
  await go(p, '#/settings', 600); ok(await p.locator('[data-account-card]').count() === 1 && /לא מחובר/.test(await p.locator('[data-account-card]').innerText()), 'Settings shows the account card with the honest state');
  await go(p, '#/account/signup', 700); await fill(p, '#ac-email', 'alma@test.invalid'); await fill(p, '#ac-pw', PW); await fill(p, '#ac-pw2', PW + 'x'); await p.check('#ac-ok'); await p.locator('[data-act=signup]').click(); await p.waitForTimeout(500);
  ok(/הסיסמאות לא תואמות/.test(await p.locator('[data-acct-error]').innerText().catch(() => '')), 'password confirmation mismatch → Hebrew error, nothing sent');
  await fill(p, '#ac-email', 'not-an-email'); await fill(p, '#ac-pw', PW); await fill(p, '#ac-pw2', PW); await p.check('#ac-ok'); await p.locator('[data-act=signup]').click(); await p.waitForTimeout(500);
  ok(/כתובת האימייל לא תקינה/.test(await p.locator('[data-acct-error]').innerText().catch(() => '')), 'invalid e-mail → Hebrew error, nothing sent');
  await fill(p, '#ac-email', 'alma@test.invalid'); await fill(p, '#ac-pw', 'short'); await fill(p, '#ac-pw2', 'short'); await p.check('#ac-ok'); await p.locator('[data-act=signup]').click(); await p.waitForTimeout(500);
  ok(/לפחות 8 תווים/.test(await p.locator('[data-acct-error]').innerText().catch(() => '')), 'short password → Hebrew error');
  await fill(p, '#ac-email', 'alma@test.invalid'); await fill(p, '#ac-pw', PW); await fill(p, '#ac-pw2', PW); await p.locator('[data-act=signup]').click(); await p.waitForTimeout(400);
  ok(/לאשר את הודעת הפרטיות/.test(await p.locator('[data-acct-error]').innerText().catch(() => '')), 'consent to the privacy notice is required');
  await signup(p, 'alma@test.invalid', 'עלמה');
  let st = await acct(p); A_ID = st.userId;
  ok(await p.evaluate(() => location.hash) === '#/setup/1', 'new account without a profile → straight into onboarding (setup step 1)');
  ok(st.signedIn && /^[0-9a-f-]{36}$/.test(st.userId) && st.owner === st.userId, 'account created: unique id from the auth server, device data owned by it', st);
  ok(!JSON.stringify(await p.evaluate(() => ({ ...localStorage }))).includes(PW), 'the password is not stored anywhere in localStorage');
  await go(p, '#/', 600); ok(/שלום, עלמה/.test(await p.locator('[data-greeting-text]').innerText()), 'greeting uses the first name given at sign-up');
  { const c2 = await mk(); await c2.p.goto(APP); await c2.p.waitForTimeout(700); await c2.p.evaluate(() => localStorage.clear()); await c2.p.reload(); await ready(c2.p);
    await signup(c2.p, 'alma@test.invalid'); ok(/כבר קיים חשבון/.test(await c2.p.locator('[data-acct-error]').innerText().catch(() => '')), 'duplicate e-mail → "account already exists"'); await c2.ctx.close(); }

  G = 'save → server, and only then "synced"';
  await seedData(p); await waitFor(p, () => Account.state().status === 'synced' && !Account.state().unsynced.length, null, 8000);
  let rows = (await su(`select section, rev, data->>'weight' as w from public.user_state where user_id = '${A_ID}' order by section`)).out;
  ok(/profile\|\d+\|71\.5/.test(rows) && /tracking\|/.test(rows), 'profile and tracking stored in the account (checked in the database)', rows);
  st = await acct(p); ok(st.status === 'synced' && !st.unsynced.length, 'status "synced" only after the server confirmed', st);
  await go(p, '#/account', 600); ok(await p.locator('[data-sync-status="synced"]').count() === 1, 'account screen shows the synced state');
  await ctl('/__test/offline?on=1'); await p.evaluate(() => { const t = Store.load('tracking'); t.measures[0].weight = 71.2; Store.save('tracking'); }); await p.waitForTimeout(2500);
  st = await acct(p); ok(st.status === 'offline' && st.unsynced.includes('tracking'), 'server unreachable → "offline", change kept and marked unsynced (no false success)', st);
  await ctl('/__test/offline?on=0'); await p.evaluate(() => Account.syncNow()); await p.waitForTimeout(800);
  ok((await su(`select data->'measures'->0->>'weight' from public.user_state where user_id = '${A_ID}' and section = 'tracking'`)).out === '71.2', 'after reconnecting the pending change reaches the server');
  await p.reload(); await ready(p); await p.waitForTimeout(1200); st = await acct(p);
  ok(st.signedIn && st.userId === A_ID, 'session restored after reload'); ok(await p.evaluate(() => Store.load('profile').weight) === 71.5, 'data intact after reload');

  G = 'sign-out wipes the device';
  await p.evaluate(() => Store.photoPut({ id: 'ph1', date: Store.today(), blob: 'x' })).catch(() => null);
  await go(p, '#/account', 700); await p.locator('[data-act=logout]').click(); await waitFor(p, () => !Account.state().signedIn, null, 6000); await p.waitForTimeout(500);
  ok((await lsKeys(p)).filter(k => k !== 'fit30.meta').length === 0, 'no fit30.* data left on the device after sign-out', await lsKeys(p));
  ok(await p.evaluate(() => Store.photoAll().then(l => l.length)) === 0, 'progress photos removed from the device too');
  await go(p, '#/', 500); ok(/שלום, בוא נתחיל/.test(await p.locator('[data-greeting-text]').innerText()), 'Home shows no trace of the previous account');
  ok((await su(`select count(*) from auth.refresh_tokens where user_id = '${A_ID}' and not revoked`)).out === '0', 'server session revoked on sign-out');

  G = 'sign-in on another device restores the data';
  { const d2 = await mk(); await d2.p.goto(APP); await d2.p.waitForTimeout(700); await d2.p.evaluate(() => localStorage.clear()); await d2.p.reload(); await ready(d2.p);
    await login(d2.p, 'alma@test.invalid', 'wrong-password-1'); ok(/האימייל או הסיסמה שגויים/.test(await d2.p.locator('[data-acct-error]').innerText().catch(() => '')), 'wrong password → Hebrew error');
    await login(d2.p, 'alma@test.invalid'); await d2.p.waitForTimeout(800);
    const s2 = await acct(d2.p); ok(s2.signedIn && s2.owner === A_ID, 'signed in on device 2', s2);
    ok(await d2.p.evaluate(() => location.hash) === '#/', 'returning user with a completed profile lands on the main screen (no onboarding again)');
    ok(await d2.p.evaluate(() => [Store.load('profile').weight, Store.load('profile').name, Store.load('tracking').measures[0].weight].join('|')) === '71.5|עלמה|71.2', 'device 2 has the same profile, name and latest measurement');
    await go(d2.p, '#/', 500); ok(/שלום, עלמה/.test(await d2.p.locator('[data-greeting-text]').innerText()), 'greeting restored on device 2');

  G = 'conflict between two devices';
    await login(p, 'alma@test.invalid'); await p.waitForTimeout(800);
    await d2.p.evaluate(() => { const t = Store.load('tracking'); t.measures[0].note = 'מכשיר 2'; Store.save('tracking'); }); await waitFor(d2.p, () => Account.state().status === 'synced', null, 6000);
    await ctl('/__test/offline?on=1'); await p.evaluate(() => { const t = Store.load('tracking'); t.measures[0].note = 'מכשיר 1'; Store.save('tracking'); }); await p.waitForTimeout(2000); await ctl('/__test/offline?on=0');
    await p.evaluate(() => Account.syncNow()); await p.waitForTimeout(800); st = await acct(p);
    ok(st.status === 'conflict' && st.conflict && st.conflict.sections.includes('tracking'), 'concurrent edits detected as a conflict (nothing overwritten)', st);
    ok((await su(`select data->'measures'->0->>'note' from public.user_state where user_id = '${A_ID}' and section = 'tracking'`)).out === 'מכשיר 2', 'server still holds device 2\'s version until the user decides');
    await go(p, '#/account', 600); ok(await p.locator('[data-acct-conflict]').count() === 1, 'conflict choice shown');
    await p.locator('[data-act=cDevice]').click(); await waitFor(p, () => Account.state().status === 'synced', null, 6000);
    ok((await su(`select data->'measures'->0->>'note' from public.user_state where user_id = '${A_ID}' and section = 'tracking'`)).out === 'מכשיר 1', 'choosing "keep this device" writes it to the account');
    await d2.p.evaluate(() => Account.syncNow()); await d2.p.waitForTimeout(800);
    ok(await d2.p.evaluate(() => Store.load('tracking').measures[0].note) === 'מכשיר 1', 'device 2 picks up the decision on its next sync');
    await d2.ctx.close(); }

  G = 'session expiry';
  await ctl('/__test/jwt_exp?s=2'); await p.evaluate(() => Account._debug.refresh(true)); await p.waitForTimeout(2500);
  await p.evaluate(() => { const pr = Store.load('profile'); pr.weight = 71; Store.save('profile'); }); await waitFor(p, () => Account.state().status === 'synced', null, 6000);
  ok((await su(`select data->>'weight' from public.user_state where user_id = '${A_ID}' and section = 'profile'`)).out === '71', 'expired access token is refreshed automatically and the save goes through');
  await ctl('/__test/jwt_exp?s=3600'); await su(`update auth.refresh_tokens set revoked = true where user_id = '${A_ID}'`);
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('fit30.auth')); s.expires_at = 1; localStorage.setItem('fit30.auth', JSON.stringify(s)); }); await p.reload(); await ready(p); await p.waitForTimeout(1500);
  st = await acct(p); ok(!st.signedIn && st.status === 'expired' && st.owner === A_ID, 'revoked session → "expired": signed out, device data kept, owner remembered', st);
  ok(await p.evaluate(() => Store.load('profile').weight) === 71, 'device data still there after expiry');
  await go(p, '#/', 600); ok(await p.locator('[data-account-expired]').count() === 1, 'Home tells the user to sign in again');
  await login(p, 'alma@test.invalid'); st = await acct(p); ok(st.signedIn && st.status === 'synced' && !st.migration || st.migration.state === 'done', 'same account signs back in: sync resumes, no migration prompt', st);

  G = 'bug reports';
  await go(p, '#/feedback', 1200); ok(await p.locator('[data-fb-online]').count() === 1, 'signed in: structured report form');
  await fill(p, '#rf-title', 'ab'); await fill(p, '#rf-desc', 'x'); await p.locator('[data-act=rfSend]').click(); await p.waitForTimeout(300);
  ok(/3 תווים/.test(await p.locator('[data-fb-error]').innerText().catch(() => '')), 'title too short → error, nothing sent');
  await ctl('/__test/offline?on=1'); await fill(p, '#rf-title', 'הכפתור לא מגיב'); await fill(p, '#rf-desc', 'לחצתי על שמירה'); await p.selectOption('#rf-sev', 'high'); await p.locator('[data-act=rfSend]').click(); await p.waitForTimeout(1200);
  ok(await p.locator('[data-fb-sent]').count() === 0 && /אין חיבור/.test(await p.locator('[data-fb-error]').innerText().catch(() => '')), 'offline → clear error, no success message');
  await ctl('/__test/offline?on=0'); await p.locator('[data-act=rfSend]').click(); await p.locator('[data-act=rfSend]').click({ force: true }).catch(() => null); await p.waitForTimeout(1500);
  ok(await p.locator('[data-fb-sent]').count() === 1, 'success shown after the server stored it');
  ok((await su(`select count(*) || '|' || min(status) || '|' || min(severity) from public.bug_reports where user_id = '${A_ID}'`)).out === '1|received|high', 'exactly one report stored (retry + double tap did not duplicate), status "received"');
  await p.waitForTimeout(800); ok(await p.locator('[data-my-reports] [data-report]').count() === 1 && /התקבל/.test(await p.locator('[data-my-reports]').innerText()), '"My reports" lists it with its status');
  const pf = (await su(`select platform from public.bug_reports where user_id = '${A_ID}'`)).out; ok(/גרסה:/.test(pf) && !/@|Beta-pass/.test(pf), 'technical details attached, no e-mail or password', pf);

  G = 'isolation through the API (second account)';
  const B = await api('/auth/v1/signup', { method: 'POST', body: JSON.stringify({ email: 'bina@test.invalid', password: PW }) }); const BT = B.j.access_token, B_ID = B.j.user.id;
  const asB = (pth, o) => api(pth, Object.assign({}, o || {}, { headers: { apikey: KEY, 'content-type': 'application/json', Authorization: 'Bearer ' + BT, Prefer: 'return=representation' } }));
  let r = await asB('/rest/v1/user_state?select=section,user_id'); ok(r.status === 200 && r.j.length === 0, 'B reads user_state: sees nothing of A', r.j);
  r = await asB(`/rest/v1/user_state?user_id=eq.${A_ID}`); ok(r.j.length === 0, 'B asking for A\'s user_id gets nothing');
  r = await asB(`/rest/v1/user_state?user_id=eq.${A_ID}&section=eq.profile`, { method: 'PATCH', body: JSON.stringify({ data: { pwned: true } }) }); ok(r.status === 200 && r.j.length === 0, 'B PATCH on A\'s row changes 0 rows', r);
  r = await asB(`/rest/v1/user_state?user_id=eq.${A_ID}`, { method: 'DELETE' }); ok(r.j.length === 0, 'B DELETE on A\'s rows deletes nothing');
  r = await asB('/rest/v1/user_state', { method: 'POST', body: JSON.stringify({ user_id: A_ID, section: 'plans', data: {} }) }); ok(r.status === 403, 'B cannot create a row in A\'s name (403 RLS)', r);
  r = await asB('/rest/v1/bug_reports?select=title'); ok(r.j.length === 0, 'B cannot read A\'s bug reports');
  r = await asB('/rest/v1/profiles?select=first_name'); ok(r.j.length === 0, 'B cannot read A\'s profile');
  r = await api('/rest/v1/user_state?select=section'); ok(r.status >= 400, 'no session (publishable key only) → refused', r.status);
  r = await api('/rest/v1/user_state?select=section', { headers: { apikey: KEY, Authorization: 'Bearer ' + BT.slice(0, -4) + 'AAAA' } }); ok(r.status === 401, 'forged/altered token → 401', r.status);
  ok((await su(`select data->>'weight' from public.user_state where user_id = '${A_ID}' and section = 'profile'`)).out === '71', 'A\'s data unchanged after all of B\'s attempts');

  G = 'migration of device data';
  { const d3 = await mk(); await d3.p.goto(APP); await d3.p.waitForTimeout(700); await d3.p.evaluate(() => localStorage.clear()); await d3.p.reload(); await ready(d3.p);
    await seedData(d3.p); await d3.p.evaluate(() => { const pr = Store.load('profile'); pr.name = 'מקומי'; pr.weight = 88; Store.save('profile'); });
    await login(d3.p, 'alma@test.invalid'); let s3 = await acct(d3.p);
    ok(s3.migration && s3.migration.state === 'pending' && s3.migration.remoteHas && !s3.owner, 'device with own data + account with data → asks, attaches nothing yet', s3);
    ok((await su(`select data->>'weight' from public.user_state where user_id = '${A_ID}' and section = 'profile'`)).out === '71', 'account untouched while the question is open');
    await go(d3.p, '#/account', 600); ok(await d3.p.locator('[data-acct-migration="pending"] [data-c="use-account"]').count() === 1, 'choices shown (use account / replace account)');
    await d3.p.locator('[data-c="use-account"]').click(); await d3.p.waitForTimeout(1200); s3 = await acct(d3.p);
    ok(s3.owner === A_ID && await d3.p.evaluate(() => Store.load('profile').weight) === 71, '"use account" loads the account data', s3);
    ok(s3.backup && await d3.p.evaluate(() => JSON.parse(localStorage.getItem('fit30.premigration')).data.profile.weight) === 88, 'previous device data kept as a local backup');
    await d3.ctx.close();
    const d4 = await mk(); await d4.p.goto(APP); await d4.p.waitForTimeout(700); await d4.p.evaluate(() => localStorage.clear()); await d4.p.reload(); await ready(d4.p);
    await seedData(d4.p); await signup(d4.p, 'chen@test.invalid', 'חן'); let s4 = await acct(d4.p);
    ok(s4.migration && s4.migration.state === 'pending' && !s4.migration.remoteHas, 'new account + device data → asks before attaching', s4);
    await ctl('/__test/offline?on=1'); await go(d4.p, '#/account', 600); await d4.p.locator('[data-c="upload"]').click(); await d4.p.waitForTimeout(2500); s4 = await acct(d4.p);
    ok(s4.migration.state === 'failed' && await d4.p.evaluate(() => Store.load('profile').weight) === 71.5, 'interrupted upload → "failed", nothing deleted on the device', s4);
    await ctl('/__test/offline?on=0'); await d4.p.evaluate(() => Account.syncNow()); await d4.p.waitForTimeout(1200); s4 = await acct(d4.p);
    const cId = s4.userId, cnt = (await su(`select count(*) from public.user_state where user_id = '${cId}'`)).out;
    ok(s4.status === 'synced' && +cnt === 5, 'retry completes: all 5 data areas uploaded once (no duplicates)', { s4, cnt });
    await d4.ctx.close(); }

  G = 'password reset link';
  { const tok = await api('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email: 'bina@test.invalid', password: PW }) });
    const d5 = await mk(); await d5.p.goto(APP); await d5.p.waitForTimeout(600); await d5.p.evaluate(() => localStorage.clear());
    await d5.p.goto(APP + `?from=mail#access_token=${tok.j.access_token}&refresh_token=${tok.j.refresh_token}&expires_in=3600&token_type=bearer&type=recovery`); await ready(d5.p); await d5.p.waitForTimeout(1500);
    ok(await d5.p.evaluate(() => location.hash) === '#/account' && !(await d5.p.evaluate(() => location.href)).includes('access_token'), 'tokens removed from the address bar; lands on the account screen');
    ok(await d5.p.locator('[data-acct-recovery]').count() === 1, 'recovery link opens "choose a new password"');
    await fill(d5.p, '#ac-newpw', 'New-pass-2026'); await d5.p.locator('[data-act=setpw]').click(); await d5.p.waitForTimeout(800);
    const relog = await api('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email: 'bina@test.invalid', password: 'New-pass-2026' }) });
    ok(relog.status === 200, 'new password works'); await d5.ctx.close(); }

  G = 'e-mail confirmation required';
  { await ctl('/__test/confirm_required?on=1'); const d6 = await mk(); await d6.p.goto(APP); await d6.p.waitForTimeout(600); await d6.p.evaluate(() => localStorage.clear()); await d6.p.reload(); await ready(d6.p);
    await signup(d6.p, 'dana@test.invalid', 'דנה'); ok(/נשלח אליך מייל לאישור/.test(await d6.p.locator('[data-acct-info]').innerText().catch(() => '')) && !(await acct(d6.p)).signedIn, 'sign-up says "check your e-mail", not signed in');
    await login(d6.p, 'dana@test.invalid'); ok(/לאשר את כתובת האימייל/.test(await d6.p.locator('[data-acct-error]').innerText().catch(() => '')) && await d6.p.locator('[data-act=resend]').count() === 1, 'unconfirmed → explanation + resend');
    { const d7 = await mk(); await d7.p.goto(APP); await d7.p.waitForTimeout(600); await d7.p.evaluate(() => localStorage.clear()); await d7.p.reload(); await ready(d7.p);
      await signup(d7.p, 'alma@test.invalid'); const t7 = { err: await d7.p.locator('[data-acct-error]').innerText().catch(() => ''), info: await d7.p.locator('[data-acct-info]').innerText().catch(() => '') };
      ok(/כבר קיים חשבון/.test(t7.err) && !/נשלח אליך מייל/.test(t7.info), 'confirmation ON (hosted behaviour): repeat sign-up of a registered e-mail → "account already exists", never a false "mail sent"', t7); await d7.ctx.close(); }
    await ctl('/__test/confirm?email=dana%40test.invalid'); await login(d6.p, 'dana@test.invalid'); ok((await acct(d6.p)).signedIn, 'after confirming, sign-in works'); await ctl('/__test/confirm_required?on=0'); await d6.ctx.close(); }

  G = 'beta switch';
  { await su(`update public.app_config set value = 'false' where key = 'beta_open'`); const d7 = await mk(); await d7.p.goto(APP); await d7.p.waitForTimeout(600); await d7.p.evaluate(() => localStorage.clear()); await d7.p.reload(); await ready(d7.p);
    await login(d7.p, 'bina@test.invalid', 'New-pass-2026'); ok(!(await acct(d7.p)).signedIn && /הבטא מושהית/.test(await d7.p.locator('[data-acct-error]').innerText().catch(() => '')), 'beta paused by the owner → sign-in refused with a clear message');
    await su(`update public.app_config set value = 'true' where key = 'beta_open'`); await d7.ctx.close(); }

  /* ── the complete first-time journey, through the real UI (local auth server + real PostgreSQL RLS) ── */
  G = 'journey: new user → onboarding → reload → logout → login → data restored';
  { const j = await mk(); const q = j.p; await q.goto(APP); await q.waitForTimeout(700); await q.evaluate(() => localStorage.clear()); await q.reload(); await ready(q); await q.waitForTimeout(400);
    ok(await q.locator('[data-welcome-signup]').count() === 1, 'first screen: welcome with הרשמה');
    await q.locator('[data-welcome-signup]').click(); await q.waitForTimeout(800); await ready(q);
    await fill(q, '#ac-name', 'יעל'); await fill(q, '#ac-email', 'journey@test.invalid'); await fill(q, '#ac-pw', PW); await fill(q, '#ac-pw2', PW);
    await q.locator('[data-act=pwShow]').first().click(); ok(await q.evaluate(() => document.getElementById('ac-pw').type === 'text' && document.getElementById('ac-pw2').type === 'text'), 'show-password reveals both fields');
    await q.locator('[data-act=pwShow]').first().click(); ok(await q.evaluate(() => document.getElementById('ac-pw').type === 'password'), 'and hides them again');
    await q.check('#ac-ok'); await q.locator('[data-act=signup]').click();
    ok(await waitFor(q, () => location.hash === '#/setup/1', null, 8000), 'sign-up → onboarding step 1');
    const uid = (await acct(q)).userId;
    await q.waitForTimeout(400); await q.fill('#pf-age', '29'); await q.fill('#pf-h', '165'); await q.fill('#pf-w', '58'); await q.fill('#pf-tw', '55');
    await q.locator('[data-act=xp][data-v=beginner]').click(); await q.locator('[data-act=next]').click(); await q.waitForTimeout(500);
    await q.locator('[data-act=gp]').first().click(); await q.waitForTimeout(300); await q.locator('[data-act=next]').click(); await q.waitForTimeout(500);
    for (const d of [0, 2, 4]) await q.locator(`[data-act=dw][data-v="${d}"]`).click();
    await q.locator('[data-act=ses][data-v="3"]').click(); await q.selectOption('#pf-max', '45'); await q.locator('[data-act=next]').click(); await q.waitForTimeout(500);
    await q.locator('[data-act=tpl]:not([disabled])').first().click(); await q.waitForTimeout(300); await q.locator('[data-act=next]').click(); await q.waitForTimeout(900);
    await q.locator('[data-act=next]').click(); await q.waitForTimeout(900); await q.locator('[data-act=next]').click(); await q.waitForTimeout(900);
    ok(await q.evaluate(() => location.hash === '#/plan' && !!Plans.active()), 'onboarding completed → plan screen with an active plan');
    ok(await waitFor(q, () => Account.state().status === 'synced' && !Account.state().unsynced.length, null, 10000), 'everything synced to the server (status "synced")', await acct(q));
    const srv = await su(`select string_agg(section, ',' order by section) from public.user_state where user_id = '${uid}'`);
    ok(/plans/.test(srv.out) && /profile/.test(srv.out), 'server holds the profile and the plan for THIS account', srv.out);
    const pAge = await su(`select data->>'age' || '|' || (data->'availability'->>'sessions') from public.user_state where user_id = '${uid}' and section = 'profile'`);
    ok(pAge.out === '29|3', 'server copy has the onboarding answers (age 29, 3 sessions)', pAge.out);
    await q.reload(); await ready(q); await q.waitForTimeout(600);
    ok((await acct(q)).signedIn && await q.evaluate(() => Store.load('profile').age === 29 && !!Plans.active()), 'reload: still signed in, profile and plan intact');
    await go(q, '#/', 500); ok(await q.locator('[data-welcome]').count() === 0, 'returning user is not shown the welcome again');
    await go(q, '#/account', 700); await q.locator('[data-act=logout]').click(); await waitFor(q, () => !Account.state().signedIn, null, 6000); await q.waitForTimeout(400);
    await go(q, '#/', 500); ok(await q.locator('[data-welcome]').count() === 1 && await q.evaluate(() => Store.load('profile').age == null && !Plans.active()), 'logout: device cleared, welcome shown again');
    await login(q, 'journey@test.invalid'); await q.waitForTimeout(1200);
    ok(await q.evaluate(() => location.hash) === '#/', 'login of a completed account → main screen (no onboarding again)');
    ok(await q.evaluate(() => Store.load('profile').age === 29 && Store.load('profile').targetWeight === 55 && !!Plans.active() && JSON.stringify(Store.load('profile').availability.days) === '[0,2,4]'), 'data restored from the server: profile, target weight, training days, plan');
    await j.ctx.close(); }

  /* ── M10.3: the hosted mailer refuses (2 e-mails/hour, team-only) — honest messages, no account created ── */
  G = 'e-mail sending refused by the server';
  { await ctl('/__test/confirm_required?on=1'); const m = await mk(); const q = m.p; await q.goto(APP); await q.waitForTimeout(600); await q.evaluate(() => localStorage.clear()); await q.reload(); await ready(q);
    const errTxt = () => q.locator('[data-acct-error]').innerText().catch(() => ''), infoTxt = () => q.locator('[data-acct-info]').innerText().catch(() => '');
    await ctl('/__test/mail_fail?mode=rate'); await signup(q, 'ratelimited@test.invalid');
    let t = { err: await errTxt(), info: await infoTxt() };
    ok(/הגיע למגבלת השליחה/.test(t.err) && /החשבון לא נוצר/.test(t.err) && !/נשלח אליך/.test(t.info), '429 over_email_send_rate_limit on sign-up → "the account was NOT created, no e-mail sent" (never "mail sent")', t);
    ok((await su(`select count(*) from auth.users where email = 'ratelimited@test.invalid'`)).out === '0', 'no user row was created');
    ok(!(await acct(q)).signedIn && await q.evaluate(() => location.hash.startsWith('#/account')), 'stays on the sign-up form, nothing faked');
    await ctl('/__test/mail_fail?mode=blocked'); await signup(q, 'outsider@test.invalid'); t = { err: await errTxt() };
    ok(/לא מורשה לשלוח לכתובת הזו/.test(t.err) && /החשבון לא נוצר/.test(t.err), 'address not authorised by the beta mailer → clear Hebrew explanation', t);
    await ctl('/__test/mail_fail?mode=rate'); await go(q, '#/account/forgot', 700); await fill(q, '#ac-email', 'alma@test.invalid'); await q.locator('[data-act=forgot]').click(); await q.waitForTimeout(800);
    t = { err: await errTxt(), info: await infoTxt() }; ok(/לא נשלח מייל/.test(t.err) && !/נשלח אליה קישור/.test(t.info), 'password reset refused → "no e-mail was sent" (no false success)', t);
    await ctl('/__test/mail_fail?mode='); await signup(q, 'ratelimited@test.invalid'); t = { err: await errTxt(), info: await infoTxt() };
    ok(!t.err && /נשלח אליך מייל לאישור/.test(t.info) && (await su(`select count(*) from auth.users where email = 'ratelimited@test.invalid'`)).out === '1', 'when the mailer accepts again, the same address signs up normally — exactly one user', t);
    await ctl('/__test/confirm_required?on=0'); await m.ctx.close(); }

  G = 'password fields look and work like the other fields';
  { const m = await mk(); const q = m.p; await q.goto(APP); await q.waitForTimeout(600); await q.evaluate(() => localStorage.clear()); await q.reload(); await ready(q); await go(q, '#/account/signup', 800); await ready(q); await q.evaluate(() => App.render()); await q.waitForTimeout(200);
    const cs = await q.evaluate(() => { const g = id => { const c = getComputedStyle(document.getElementById(id)); return { bg: c.backgroundColor, border: c.borderTopColor + ' ' + c.borderTopWidth, h: Math.round(document.getElementById(id).getBoundingClientRect().height), pad: c.paddingInlineStart, color: c.color, radius: c.borderTopLeftRadius }; }; return { email: g('ac-email'), pw: g('ac-pw'), pw2: g('ac-pw2') }; });
    ok(JSON.stringify(cs.pw) === JSON.stringify(cs.email) && JSON.stringify(cs.pw2) === JSON.stringify(cs.email), 'password + confirmation fields have the same background, border, height, padding, text colour and radius as the e-mail field', cs);
    await fill(q, '#ac-pw', 'Abc-12345'); await q.locator('[data-act=pwShow]').first().click();
    ok(await q.evaluate(() => document.getElementById('ac-pw').value === 'Abc-12345' && document.getElementById('ac-pw').type === 'text'), 'typing works and "הצגת הסיסמה" shows the typed text');
    ok(await q.evaluate(() => { const st = document.querySelector('style').textContent; return /input\[type="password"\]/.test(st) || /input\[type=password\]/.test(st); }), 'the shipped stylesheet styles input[type=password] explicitly (WebKit draws unstyled password inputs black in dark mode)');
    await m.ctx.close(); }

  G = 'account deletion';
  await go(p, '#/account', 700); await p.locator('[data-act=delete]').click(); await p.waitForTimeout(300); await fill(p, '#del-ok', 'מחיקה'); await p.locator('.sheet [data-act=yes]').click(); await waitFor(p, () => !Account.state().signedIn, null, 6000); await p.waitForTimeout(500);
  ok((await su(`select (select count(*) from auth.users where id = '${A_ID}') || ',' || (select count(*) from public.user_state where user_id = '${A_ID}') || ',' || (select count(*) from public.bug_reports where user_id = '${A_ID}')`)).out === '0,0,0', 'account, data and bug reports deleted on the server');
  ok((await lsKeys(p)).filter(k => k !== 'fit30.meta').length === 0, 'device wiped after deletion');
  ok(errs.length === 0, 'no page errors in the main session', errs.slice(0, 3)); ok(warns.length === 0, 'no button without a handler', warns.slice(0, 3));
  await ctx.close();

  await b.close(); procs.forEach(pr => pr.kill());
  const pass = res.filter(x => x.ok).length, fail = res.length - pass;
  fs.mkdirSync(path.join(ROOT, 'dist/reports'), { recursive: true }); fs.writeFileSync(path.join(ROOT, 'dist/reports/e2e-account.json'), JSON.stringify({ env: 'beta build → tools/supa_local.js (Supabase API emulation) → PostgreSQL 16 with the migration + RLS; Playwright Chromium iPhone emulation', at: new Date().toISOString(), pass, fail, results: res }, null, 1));
  res.forEach(x => console.log((x.ok ? 'PASS ' : 'FAIL ') + '[' + x.g + '] ' + x.m)); console.log(`account e2e: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { res.forEach(x => console.log((x.ok ? 'PASS ' : 'FAIL ') + '[' + x.g + '] ' + x.m)); console.error('account e2e crashed in [' + G + ']: ' + e.message.split('\n')[0]); procs.forEach(pr => pr.kill()); process.exit(2); });
