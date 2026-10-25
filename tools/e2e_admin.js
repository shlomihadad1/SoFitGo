/* Admin CMS · end to end (local only). App = beta build of THIS source pointed at tools/supa_local.js (real PostgreSQL 16 with all
   migrations; every request goes through the real RLS policies and role-checked functions). Browser: Playwright Chromium with
   iPhone 13 emulation and a 1280 px desktop context — NOT Safari, NOT a device. Not a test of the hosted project.
   Covers the acceptance list: non-admin blocked; admin enters, creates and edits; a new dish is stored in the DB; edit + publish is
   reflected in the app; adding an ingredient changes nutrition consistently; recipe steps and exercise instructions save; media
   upload shows the exact infrastructure blocker; drafts never reach users; mobile + desktop; no secrets in the bundle; history +
   rollback; "what changes?" before publishing; guides reachable from the screen; existing user screens still work.
   Usage: node tools/e2e_admin.js */
const { chromium, devices } = require('playwright'); const fs = require('fs'), path = require('path'), { spawn, execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..'), APP = 'http://localhost:8099/', API = 'http://localhost:54322', KEY = 'sb_publishable_LOCALTESTKEY_not_a_secret', PW = 'Admin-pass-2026';
const res = []; let G = ''; const ok = (c, m, i) => res.push({ g: G, ok: !!c, m: m + (i !== undefined && !c ? ' → ' + JSON.stringify(i).slice(0, 500) : '') });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const call = async (p, o, tok) => { const r = await fetch(API + p, Object.assign({ headers: Object.assign({ apikey: KEY, 'content-type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}) }, o || {})); const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) { } return { status: r.status, j }; };
const su = async q => (await fetch(API + '/__test/sql', { method: 'POST', body: q })).json();
const procs = [];
(async () => {
  try {
    execFileSync('sh', [path.join(ROOT, 'tools/pg_local.sh')], { stdio: 'ignore' });
    execFileSync('sh', [path.join(ROOT, 'tools/supa_local_db.sh')], { stdio: 'ignore', env: Object.assign({}, process.env, { SUPA_DB: 'sofitgo_cms_e2e' }) });
    execFileSync('node', [path.join(ROOT, 'tools/build.js')], { stdio: 'ignore', env: Object.assign({}, process.env, { SOFITGO_SUPABASE_URL: API, SOFITGO_SUPABASE_PUBLISHABLE_KEY: KEY, FIT30_OUT: 'dist/pwa-cms-local' }) });
    procs.push(spawn('node', [path.join(ROOT, 'tools/supa_local.js'), '54322'], { env: Object.assign({}, process.env, { SUPA_DB: 'sofitgo_cms_e2e' }), stdio: 'ignore' }));
    procs.push(spawn('python3', ['-m', 'http.server', '8099', '-d', path.join(ROOT, 'dist/pwa-cms-local')], { stdio: 'ignore' }));
    await sleep(1800);
  } catch (e) { console.error('setup failed: ' + e.message); procs.forEach(p => p.kill()); process.exit(2); }
  const b = await chromium.launch();
  const mk = async (dev) => { const ctx = await b.newContext(Object.assign(dev === 'desktop' ? { viewport: { width: 1280, height: 900 } } : { ...devices['iPhone 13'] }, { locale: 'he-IL', serviceWorkers: 'block' })); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); await p.goto(APP); await p.waitForTimeout(700); return { ctx, p, errs }; };
  const go = async (p, h, ms) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(ms || 500); };
  const waitFor = async (p, fn, arg, ms) => { const t0 = Date.now(); while (Date.now() - t0 < (ms || 8000)) { if (await p.evaluate(fn, arg).catch(() => false)) return true; await p.waitForTimeout(150); } return false; };
  const login = async (p, email) => { await go(p, '#/account/login', 700); await waitFor(p, () => !!window.Account && !!window.Screens.account); await p.evaluate(() => App.render()); await p.waitForTimeout(200);
    await p.fill('#ac-email', email); await p.fill('#ac-pw', PW); await p.locator('[data-act=login]').click(); await waitFor(p, () => !!(window.Account && Account.state().signedIn)); await p.waitForTimeout(400); await p.evaluate(() => document.querySelectorAll('.sheet [data-x]').forEach(x => x.click())); };
  const admin = async p => { await go(p, '#/admin', 600); await waitFor(p, () => !!window.Screens.admin); await waitFor(p, () => !document.querySelector('[data-cms-loading]'), null, 8000); await p.waitForTimeout(300); };
  const text = p => p.evaluate(() => document.getElementById('view').innerText);

  /* accounts (sign-up through the real auth endpoint), the owner row by the documented manual SQL, roles via the owner's token */
  const tok = {};
  for (const who of ['owner', 'admin', 'editor', 'user']) { const r = await call('/auth/v1/signup', { method: 'POST', body: JSON.stringify({ email: who + '@cms.test', password: PW }) }); tok[who] = r.j && r.j.access_token; }
  await su(`insert into public.cms_members (user_id, role) select id, 'owner' from auth.users where email = 'owner@cms.test';`);
  for (const [who, role] of [['admin', 'admin'], ['editor', 'editor']]) await call('/rest/v1/rpc/cms_set_role', { method: 'POST', body: JSON.stringify({ p_email: who + '@cms.test', p_role: role }) }, tok.owner);
  G = 'server-side roles';
  ok((await su(`select string_agg(u.email || ':' || m.role, ',' order by m.role) from public.cms_members m join auth.users u on u.id = m.user_id;`)).out === 'admin@cms.test:admin,editor@cms.test:editor,owner@cms.test:owner', 'owner granted admin and editor through the role function');
  ok((await call('/rest/v1/rpc/cms_set_role', { method: 'POST', body: JSON.stringify({ p_email: 'user@cms.test', p_role: 'admin' }) }, tok.user)).status === 403, 'a regular user calling the role API directly is refused by the server (403)');
  ok((await call('/rest/v1/rpc/cms_publish', { method: 'POST', body: JSON.stringify({ p_kind: 'recipe', p_item: 'x' }) }, tok.editor)).status === 403, 'an editor calling publish directly is refused by the server');

  G = 'build: no secrets';
  { const shipped = ['index.html', 'admin.js', 'account.js', 'extra.js'].map(f => fs.readFileSync(path.join(ROOT, 'dist/pwa-cms-local', f), 'utf8')).join('\n');
    ok(!/sb_secret_|service_role|SUPABASE_SERVICE|postgres:\/\//i.test(shipped), 'admin and app bundles contain no secret key, service-role reference or DB URL'); }

  G = '1 regular user cannot enter';
  { const { p, ctx } = await mk(); await login(p, 'user@cms.test'); await admin(p);
    ok(await p.locator('[data-cms-denied]').count() === 1 && !(await p.locator('[data-cms-tabs]').count()), 'a signed-in non-member sees "no admin permission" and no admin tools');
    const { p: q, ctx: c2 } = await mk(); await admin(q); ok(await q.locator('[data-cms-login]').count() === 1, 'signed out → asked to sign in'); await c2.close(); await ctx.close(); }

  G = '2–7 editor creates a recipe';
  { const { p, ctx, errs } = await mk(); await login(p, 'editor@cms.test'); await admin(p);
    ok(await p.locator('[data-cms-tabs]').count() === 1 && /עורך/.test(await p.locator('[data-cms-role]').innerText()), 'editor enters; role shown from the server');
    await p.locator('[data-cms-tabs] [data-t=recipes]').click(); await p.waitForTimeout(300);
    ok(+(await p.locator('[data-cms-total]').innerText()).match(/\d+/)[0] >= 340, 'the recipe list shows the real library (built-in + CMS)');
    await p.fill('#cms-q', 'עדשים'); await p.waitForTimeout(500); const n1 = await p.locator('[data-cms-list] .li').count(); ok(n1 > 0 && n1 <= 20, 'search filters the list (and pages by 20)', n1);
    await p.fill('#cms-q', ''); await p.waitForTimeout(400);
    await p.locator('[data-act=newRecipe]').click(); await p.waitForTimeout(300);
    ok(await p.locator('[data-cms-valid].bad').count() === 1, 'an empty new recipe shows what must be fixed, in plain Hebrew');
    await p.fill('#ed-id', 'cms_test_bowl'); await p.fill('#ed-he', 'קערת בדיקה עם עוף ובורגול'); await p.fill('#ed-en', 'CMS Test Bowl');
    await p.selectOption('#ed-meal', 'm2'); await p.selectOption('#ed-cu', 'israeli');
    await p.locator('[data-act=ingAdd]').click(); await p.waitForTimeout(200); await p.selectOption('[data-ing-f="1"]', 'bulgur'); await p.fill('[data-ing-g="1"]', '60'); await p.locator('[data-ing-g="1"]').dispatchEvent('change'); await p.waitForTimeout(250);
    const k1 = await p.evaluate(() => AdminCMS.state.edit && Logic.roundM(AdminCMS.state.edit.data.ing.reduce((s, x) => { const f = NUTRI.FOODS[x.f]; return { k: s.k + f.k * x.g / 100, p: s.p + f.p * x.g / 100, c: 0, f: 0, fb: 0 }; }, { k: 0, p: 0, c: 0, f: 0, fb: 0 })));
    const shown = await p.locator('[data-cms-preview] .kv span').first().innerText();
    ok(k1 && shown.includes(String(k1.k)), 'adding an ingredient updates the preview nutrition = sum of ingredients', { k1, shown });
    await p.locator('[data-act=ingAdd]').click(); await p.waitForTimeout(200); await p.selectOption('[data-ing-f="2"]', 'bulgur'); await p.locator('[data-ing-f="2"]').dispatchEvent('change'); await p.waitForTimeout(250);
    ok(/אותו מזון מופיע פעמיים/.test(await p.locator('[data-cms-valid]').innerText()), 'a duplicate ingredient is flagged (no double counting)');
    await p.locator('[data-act=ingDel][data-i="2"]').click(); await p.waitForTimeout(200);
    await p.fill('#ed-steps', 'לצלות את העוף.\nלהשרות בורגול במים רותחים.\nלהגיש יחד עם ירקות.'); await p.locator('#ed-steps').dispatchEvent('change'); await p.waitForTimeout(250);
    ok(await p.locator('[data-cms-valid].good').count() === 1 && await p.locator('[data-cms-preview] ol.steps li').count() === 3, 'valid recipe → numbered steps in the preview', await p.evaluate(() => ({ v: (document.querySelector('[data-cms-valid]') || {}).innerText, e: AdminCMS.state.edit && { id: AdminCMS.state.edit.id, d: AdminCMS.state.edit.data } })));
    ok(await p.locator('[data-act=review]').count() === 0, 'editor has no publish button (server would refuse anyway)');
    await p.locator('[data-act=impact]').click(); await p.waitForTimeout(1500); const imp = await p.locator('[data-cms-impact]').innerText();
    ok(/הדמיה של 4 פרופילים/.test(imp) && /ארוחות שכבר נרשמו/.test(imp), '"what changes?" explains real effects (simulation, history untouched)', imp.slice(0, 200));
    await p.evaluate(() => document.querySelectorAll('.sheet [data-x]').forEach(x => x.click())); await p.waitForTimeout(200);
    await p.locator('[data-act=saveDraft]').click(); await p.waitForTimeout(700);
    const dr = await su(`select data->>'he' from public.cms_drafts where item_id = 'cms_test_bowl';`); ok(dr.out === 'קערת בדיקה עם עוף ובורגול', 'the draft is stored in the database (cms_drafts)', dr);
    ok((await call('/rest/v1/cms_content?select=item_id&item_id=eq.cms_test_bowl')).j.length === 0, 'a draft is NOT published: the public content API does not return it');
    await p.reload(); await p.waitForTimeout(900); await admin(p); ok(await p.evaluate(() => !!(AdminCMS.state.edit && AdminCMS.state.edit.id === 'cms_test_bowl')), 'unsaved/ongoing work survives a reload (kept on the device)');
    /* exercise instructions */
    await p.evaluate(() => { AdminCMS.state.edit = null; AdminCMS.state.tab = 'exercises'; App.render(); }); await p.waitForTimeout(300);
    await p.locator('[data-act=open][data-k=exercise][data-id=squat]').click(); await p.waitForTimeout(300);
    const st0 = await p.inputValue('#ex-steps'); await p.fill('#ex-steps', st0 + '\nבדיקת CMS: לעצור שנייה למטה.'); await p.locator('#ex-steps').dispatchEvent('change'); await p.waitForTimeout(200);
    await p.locator('[data-act=saveDraft]').click(); await p.waitForTimeout(700);
    ok(/בדיקת CMS/.test((await su(`select data->>'steps' from public.cms_drafts where item_id = 'squat';`)).out || ''), 'exercise instructions saved as a draft');
    G = '8 media'; await p.evaluate(() => { AdminCMS.state.edit = null; AdminCMS.state.tab = 'media'; App.render(); }); await p.waitForTimeout(300);
    ok(await p.locator('[data-cms-upload-blocked]').count() === 1 && /Storage bucket/.test(await p.locator('[data-cms-upload-blocked]').innerText()), 'upload shows the exact infrastructure blocker (no fake upload)');
    ok(/סרטוני הדגמה: 0\/57/.test(await text(p)) && (await p.locator('[data-cms-broken]').innerText()) === '0', 'media inventory is honest (0 videos) and reports broken references (0)');
    G = 'guides'; await p.evaluate(() => { AdminCMS.state.tab = 'guide'; App.render(); }); await p.waitForTimeout(200);
    ok(await p.locator('[data-cms-guide] details').count() >= 10, 'admin guide: ≥10 step-by-step guides inside the CMS');
    await p.evaluate(() => { AdminCMS.state.tab = 'recipes'; App.render(); }); await p.waitForTimeout(200);
    ok(errs.length === 0, 'no JS errors (editor)', errs); await ctx.close(); }

  G = '3–5 admin publishes and the app reflects it';
  { const { p, ctx, errs } = await mk('desktop'); await login(p, 'admin@cms.test'); await admin(p);
    await p.evaluate(() => { AdminCMS.state.tab = 'dash'; App.render(); }); await p.waitForTimeout(200);
    ok(/טיוטות שמחכות/.test(await text(p)), 'admin dashboard lists the waiting drafts');
    await p.locator('[data-act=open][data-id=cms_test_bowl]').click(); await p.waitForTimeout(300);
    await p.locator('[data-act=review]').click(); await p.waitForTimeout(1500);
    ok(await p.locator('[data-cms-review]').count() === 1 && /מה השתנה/.test(await p.locator('[data-cms-review]').innerText()), 'before publishing: before/after comparison and known effects');
    await p.locator('.sheet [data-act=publish]').click(); await p.waitForTimeout(400);
    ok((await su(`select count(*) from public.cms_content where item_id = 'cms_test_bowl';`)).out === '0', 'publishing needs the explicit confirmation checkbox');
    await p.check('#pub-ok'); await p.locator('.sheet [data-act=publish]').click(); await p.waitForTimeout(1200);
    ok((await su(`select version from public.cms_content where item_id = 'cms_test_bowl';`)).out === '1', 'published v1 in cms_content');
    /* edit a built-in recipe: more chicken → more protein */
    await p.evaluate(() => { AdminCMS.state.edit = null; App.render(); }); await p.evaluate(() => { const b = document.querySelector('[data-cms-tabs] [data-t=recipes]'); b.click(); }); await p.waitForTimeout(300);
    await p.evaluate(() => { AdminCMS.state.q = ''; }); await p.evaluate(() => { const H = Screens.admin().handlers; H.open({ dataset: { k: 'recipe', id: 'md_chicken_rice_peas' } }); }); await p.waitForTimeout(300);
    const before = await p.evaluate(() => Logic.recipeMacros(Logic.recipe('md_chicken_rice_peas')));
    await p.fill('[data-ing-g="0"]', '170'); await p.locator('[data-ing-g="0"]').dispatchEvent('change'); await p.waitForTimeout(200);
    await p.locator('[data-act=saveDraft]').click(); await p.waitForTimeout(700); await p.locator('[data-act=review]').click(); await p.waitForTimeout(1500); await p.check('#pub-ok'); await p.locator('.sheet [data-act=publish]').click(); await p.waitForTimeout(1200);
    /* publish the editor's exercise draft too */
    await p.evaluate(() => { const H = Screens.admin().handlers; AdminCMS.state.edit = null; H.open({ dataset: { k: 'exercise', id: 'squat' } }); App.render(); }); await p.waitForTimeout(300);
    await p.locator('[data-act=review]').click(); await p.waitForTimeout(600); await p.check('#pub-ok'); await p.locator('.sheet [data-act=publish]').click(); await p.waitForTimeout(1200);
    /* the regular app, fresh device, signed out */
    const { p: u, ctx: uc, errs: uerr } = await mk(); await u.evaluate(() => CMS.refresh()); await u.waitForTimeout(500);
    const seen = await u.evaluate(() => { const r = Logic.recipe('cms_test_bowl'), c = Logic.recipe('md_chicken_rice_peas'); const P = MealPlan.pool({ kcal: 2400, protein: 140, prefs: Core.normPrefs({}), meals: 3, maxPrep: null, dislike: [] });
      return { has: !!r, inPool: P.m2.some(x => x.r.id === 'cms_test_bowl'), k: c && Logic.recipeMacros(c).k, p: c && Logic.recipeMacros(c).p, ex: EX_BY_ID.squat.steps.join(' ') }; });
    ok(seen.has && seen.inPool, 'the new dish reaches the app without a rebuild and can enter generated menus', seen);
    ok(seen.p > before.p + 4 && seen.k > before.k, /* +20 g raw chicken breast = +4.5 g protein (22.5 g/100 g) */ 'the edited built-in recipe is reflected in the app (more chicken → more protein), values from the ingredients', { before, seen });
    ok(/בדיקת CMS/.test(seen.ex), 'the edited exercise instructions are reflected in the app');
    await go(u, '#/recipe/cms_test_bowl', 600); ok(/קערת בדיקה עם עוף ובורגול/.test(await text(u)) && await u.locator('ol.steps li').count() === 3, 'the recipe page renders the new dish with its steps');
    await go(u, '#/ex/squat', 900); { const tx = await text(u); ok(/בדיקת CMS/.test(tx), 'the exercise page shows the new instruction', { hash: await u.evaluate(() => location.hash), tx: tx.slice(0, 200), steps: await u.evaluate(() => EX_BY_ID.squat.steps.length) }); }
    G = '9 history and rollback';
    await p.evaluate(() => { const H = Screens.admin().handlers; AdminCMS.state.edit = null; H.open({ dataset: { k: 'recipe', id: 'md_chicken_rice_peas' } }); App.render(); }); await p.waitForTimeout(300);
    await p.locator('[data-act=history]').click(); await p.waitForTimeout(700); ok(await p.locator('[data-cms-history] .li').count() >= 1, 'history lists published versions with who and when');
    /* publish a second edit, then roll back to v1 */
    await p.evaluate(() => document.querySelectorAll('.sheet [data-x]').forEach(x => x.click())); await p.fill('[data-ing-g="0"]', '120'); await p.locator('[data-ing-g="0"]').dispatchEvent('change'); await p.waitForTimeout(200);
    await p.locator('[data-act=saveDraft]').click(); await p.waitForTimeout(700); await p.locator('[data-act=review]').click(); await p.waitForTimeout(1500); await p.check('#pub-ok'); await p.locator('.sheet [data-act=publish]').click(); await p.waitForTimeout(1200);
    await p.locator('[data-act=history]').click(); await p.waitForTimeout(700); await p.locator('.sheet [data-act=rb][data-v="1"]').click(); await p.waitForTimeout(1200);
    ok((await su(`select version || ':' || (data->'ing'->0->>'g') from public.cms_content where item_id = 'md_chicken_rice_peas';`)).out === '3:170', 'rollback to v1 republished the old data as v3', (await su(`select version || ':' || (data->'ing'->0->>'g') from public.cms_content where item_id = 'md_chicken_rice_peas';`)).out);
    await u.evaluate(() => CMS.refresh()); await u.waitForTimeout(400); ok(await u.evaluate(() => Logic.recipe('md_chicken_rice_peas').ing[0].g) === 170, 'the app follows the rollback');
    G = 'archive';
    await p.evaluate(() => { const H = Screens.admin().handlers; AdminCMS.state.edit = null; H.open({ dataset: { k: 'recipe', id: 'cms_test_bowl' } }); App.render(); }); await p.waitForTimeout(300);
    await p.locator('[data-act=archive]').click(); await p.waitForTimeout(300); await p.check('#ar-ok'); await p.locator('.sheet [data-act=go]').click(); await p.waitForTimeout(1200);
    await u.evaluate(() => CMS.refresh()); await u.waitForTimeout(400);
    ok(await u.evaluate(() => { const P = MealPlan.pool({ kcal: 2400, protein: 140, prefs: Core.normPrefs({}), meals: 3, maxPrep: null, dislike: [] }); return !!Logic.recipe('cms_test_bowl') && !P.m2.some(x => x.r.id === 'cms_test_bowl'); }), 'archived: no longer offered in menus, still resolvable for history');
    G = '10 desktop + mobile layout';
    const ov = await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1); ok(ov, 'desktop (1280 px): no horizontal overflow');
    const { p: m, ctx: mc } = await mk(); await login(m, 'admin@cms.test'); await admin(m); await m.evaluate(() => { AdminCMS.state.tab = 'recipes'; App.render(); }); await m.waitForTimeout(300);
    ok(await m.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'mobile (iPhone 13 emulation): no horizontal overflow on the recipe list');
    await mc.close();
    G = '12 existing user screens';
    for (const h of ['#/', '#/nutrition', '#/workouts', '#/recipes', '#/progress', '#/settings']) { await go(u, h, 500); } ok(uerr.length === 0, 'user screens render without JS errors with CMS content applied', uerr);
    ok(errs.length === 0, 'no JS errors (admin)', errs); await uc.close(); await ctx.close(); }

  G = 'feedback review (migration 20261025000200)';
  { for (const [cid, title, sev] of [['fb-e2e-0001', 'הכפתור שמירה לא מגיב', 'high'], ['fb-e2e-0002', 'רעיון: מצב לילה', 'low']])
      await call('/rest/v1/bug_reports', { method: 'POST', headers: { apikey: KEY, 'content-type': 'application/json', Authorization: 'Bearer ' + tok.user, Prefer: 'return=minimal' }, body: JSON.stringify({ client_report_id: cid, category: sev === 'low' ? 'idea' : 'bug', title, description: 'נשלח מבדיקה', severity: sev, screen: 'home' }) }, tok.user);
    ok((await call('/rest/v1/rpc/cms_feedback_list', { method: 'POST', body: '{}' }, tok.user)).status === 403 && (await call('/rest/v1/rpc/cms_feedback_list', { method: 'POST', body: '{}' }, tok.editor)).status === 403, 'user and editor calling the feedback list directly are refused by the server (403)');
    const { p: e, ctx: ec } = await mk(); await login(e, 'editor@cms.test'); await admin(e); await e.evaluate(() => { AdminCMS.state.tab = 'feedback'; App.render(); }); await e.waitForTimeout(300);
    ok(await e.locator('[data-cms-fb-denied]').count() === 1 && await e.locator('[data-cms-fb-list]').count() === 0, 'editor: the feedback tab explains it is admin-only and shows no reports'); await ec.close();
    const { p, ctx, errs } = await mk(); await login(p, 'admin@cms.test'); await admin(p); await p.evaluate(() => { AdminCMS.state.tab = 'feedback'; App.render(); });
    await waitFor(p, () => !!document.querySelector('[data-cms-fb-list]'));
    ok(await p.locator('[data-cms-fb-list] [data-fb]').count() === 2 && /התקבל: 2/.test(await p.locator('[data-cms-fb-counts]').innerText()), 'admin sees both reports with counts per status');
    ok(!/user@cms\.test/.test(await text(p)), 'no reporter e-mail is shown');
    await p.locator('[data-act=fbOpen]', { hasText: 'הכפתור שמירה' }).click(); await p.waitForTimeout(300);
    await p.selectOption('#fb-new', 'in_progress'); await p.fill('#fb-note', 'שוחזר בגרסה האחרונה'); await p.locator('[data-act=fbSave]').click();
    await waitFor(p, () => !!document.querySelector('[data-cms-fb-list]') && /בטיפול: 1/.test((document.querySelector('[data-cms-fb-counts]') || {}).textContent || ''));
    ok(/בטיפול: 1/.test(await p.locator('[data-cms-fb-counts]').innerText()), 'status change saved on the server and the list reloads');
    const mine = await call('/rest/v1/bug_reports?select=title,status&order=created_at', {}, tok.user);
    ok(mine.j && mine.j.some(x => x.status === 'in_progress'), 'the reporter sees the new status of their own report', mine.j);
    await p.selectOption('#fb-st', 'in_progress'); await waitFor(p, () => document.querySelectorAll('[data-cms-fb-list] [data-fb]').length === 1);
    ok(await p.locator('[data-cms-fb-list] [data-fb]').count() === 1, 'filter by status');
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal scroll on a phone');
    await p.evaluate(() => { AdminCMS.state.tab = 'audit'; App.render(); }); await waitFor(p, () => !!document.querySelector('[data-cms-audit-list]'));
    ok(/שינוי סטטוס · דיווח משוב/.test(await p.locator('[data-cms-audit-list]').innerText()), 'the status change appears in the audit log');
    ok(errs.length === 0, 'no JS errors (feedback)', errs); await ctx.close(); }

  G = 'accounts overview (migration 20261025000300)';
  { ok((await call('/rest/v1/rpc/cms_accounts_overview', { method: 'POST', body: '{}' }, tok.user)).status === 403 && (await call('/rest/v1/rpc/cms_accounts_overview', { method: 'POST', body: '{}' }, tok.editor)).status === 403, 'user and editor calling the accounts overview directly are refused by the server');
    const { p: e, ctx: ec } = await mk(); await login(e, 'editor@cms.test'); await admin(e); await e.evaluate(() => { AdminCMS.state.tab = 'accounts'; App.render(); }); await e.waitForTimeout(300);
    ok(await e.locator('[data-cms-acc-denied]').count() === 1 && await e.locator('[data-cms-acc-list]').count() === 0, 'editor: the accounts tab explains it is admin-only and shows no numbers'); await ec.close();
    const { p, ctx, errs } = await mk(); await login(p, 'admin@cms.test'); await admin(p); await p.evaluate(() => { AdminCMS.state.tab = 'accounts'; App.render(); });
    await waitFor(p, () => !!document.querySelector('[data-cms-acc-list]'));
    const n = +(await p.locator('[data-acc=accounts_total]').innerText()); ok(n >= 4, 'admin sees the number of registered accounts', n);
    ok(!/@cms\.test/.test(await text(p)) && /אינו/.test(await p.locator('[data-cms-acc]').innerText()) && await p.locator('[data-cms-acc-subs]').count() === 1, 'no e-mail shown; "synced" is not presented as active users; subscriptions stated as not existing');
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal scroll on a phone (accounts)');
    ok(errs.length === 0, 'no JS errors (accounts)', errs); await ctx.close(); }

  await b.close(); procs.forEach(pr => pr.kill());
  let pass = 0, fail = 0; res.forEach(x => { console.log((x.ok ? 'PASS ' : 'FAIL ') + '[' + x.g + '] ' + x.m); x.ok ? pass++ : fail++; });
  console.log(`admin e2e: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { res.forEach(x => console.log((x.ok ? 'PASS ' : 'FAIL ') + '[' + x.g + '] ' + x.m)); console.error('admin e2e crashed in [' + G + ']: ' + e.message.split('\n')[0]); procs.forEach(pr => pr.kill()); process.exit(2); });
