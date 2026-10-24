/* Dashboard + calendar */
(function (root) {
const { esc, icon, ring, meter, dots, barChart } = root.UI;
const S = root.Store, C = root.Core, L = root.Logic, P = root.PROGRAM;
const Screens = root.Screens = root.Screens || {};
/* shown wherever a calculation needs age, height and weight that the user has not entered yet */
Screens.needProfile = (what) => `<section class="card need-profile" data-need="profile"><h3>${root.UI.icon('info')} ${what}</h3><p class="small muted">כדי לחשב יעדי קלוריות וחלבון צריך גיל, גובה ומשקל. לא ממלאים אותם בשבילך — כל ערך מוזן ומאושר על ידך.</p><div class="btns"><a class="btn primary" href="#/setup/1">התחלת הגדרה</a><a class="btn ghost" href="#/profile">פרופיל</a></div></section>`;

Screens.thumb = (exId, pose) => { const e = root.EX_BY_ID[exId]; const s = root.Figure.staticSvg(e, pose || 'B'); return `<div class="thumb">${root.Figure.svgShell(s.props + s.fig, e.he)}</div>`; };
Screens.versionSeg = (d, sel, act) => {
  if (!L.hasVersions(d)) return '';
  return `<div class="seg" role="group" aria-label="משך האימון">${['short', 'std', 'long'].map(v => `<button data-act="${act}" data-v="${v}" aria-pressed="${sel === v}">${v === 'short' ? 'קצר' : v === 'std' ? 'רגיל' : 'ארוך'}<small>~${L.estimateMinutes(d, v)} דק׳ (הערכה)</small></button>`).join('')}</div>`;
};
Screens.selectedVersion = { v: 'std' };

/* M10 · first launch: a visible welcome with הרשמה / התחברות (also when this build has no account server — the account screen
   then says so plainly; nothing is faked). Hidden after "להמשיך בלי חשבון", once signed in, or once a profile exists. */
const lsPeek = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
/* M10 · water: liters on screen (stored in ml), personal target, remaining amount; quick-add stays in ml */
Screens.waterBlock = function (date) {
  const w = C.daily(date).water || 0, wg = C.waterGoalOn(date), left = Math.max(0, wg.ml - w);
  return `<div class="stack tight" data-water><div class="row between"><span class="row">${icon('drop')} <b>מים</b></span><span class="num" data-water-total><bdi>${C.fmtL(w)}</bdi> מתוך <bdi>${C.fmtL(wg.ml)}</bdi> ליטר</span></div>${meter(w, wg.ml, 'gl')}
    <div class="row between tiny muted"><span data-water-left>${left ? `נותרו <bdi>${C.fmtL(left)}</bdi> ליטר` : w > wg.ml ? `הגעת ליעד · <bdi>${C.fmtL(w - wg.ml)}</bdi> ליטר מעל היעד` : 'הגעת ליעד היום'}</span><a href="#/settings" data-water-goal-kind>${wg.manual ? 'יעד שקבעת' : wg.est ? 'הצעה כללית (הערכה)' : 'הצעה אישית (הערכה)'}</a></div>
    <div class="btns"><button class="btn sm" data-act="water" data-ml="250" aria-label="הוספת 0.25 ליטר">+0.25 ל׳</button><button class="btn sm" data-act="water" data-ml="500" aria-label="הוספת 0.5 ליטר">+0.5 ל׳</button><button class="btn sm" data-act="water" data-ml="750" aria-label="הוספת 0.75 ליטר">+0.75 ל׳</button><button class="btn sm ghost" data-act="water" data-ml="-250" aria-label="הפחתת 0.25 ליטר">−0.25 ל׳</button></div></div>`;
};
Screens.welcomeVisible = () => !lsPeek('fit30.welcomeDone') && !lsPeek('fit30.auth') && !C.hasBasics(C.profile()) && !root.Plans.active();
Screens.welcomeCard = function () {
  if (!Screens.welcomeVisible()) return '';
  const on = !!root.FIT30_BACKEND;
  return `<section class="card hero" data-welcome><span class="eyebrow">ברוכים הבאים ל־SoFitGo</span><h2>אימון, תזונה ומעקב — במקום אחד</h2><p class="small">Sofit, המאמנת שלך באפליקציה, מראה בכל יום מה הצעד הבא — אימון, ארוחה או מים — לפי התוכנית והיומן שלך.</p>
    <p class="small muted">${on ? 'עם חשבון, ההתקדמות שלך נשמרת בשרת ומחכה לך גם בטלפון חדש. אפשר גם להתחיל בלי חשבון — הכול יישמר במכשיר הזה.' : 'אפשר להתחיל מיד. בגרסת הבטא הזו חשבונות הענן עוד לא הופעלו, ולכן הנתונים נשמרים במכשיר הזה.'}</p>
    <div class="btns"><a class="btn primary" href="#/account/signup" data-welcome-signup>הרשמה</a><a class="btn" href="#/account/login" data-welcome-login>התחברות</a></div>
    <button class="btn ghost sm" data-act="welcomeSkip">להמשיך בלי חשבון</button></section>`;
};
Screens.home = function () {
  const today = S.today(), n = C.todayN(), p = C.profile(), t = C.targets(), sess = S.load('session');
  const html = [Screens.greeting(), Screens.welcomeCard(), Screens.accountPrompt ? Screens.accountPrompt() : '']; /* M10: from the account.js chunk (beta builds load it after first paint) */ /* M9: the user is greeted first; Sofit's card comes after the dashboard (hierarchy: user → progress → coach) */
  if (!S.storageOK) html.push(`<div class="banner bad">${icon('info')}<div>האחסון המקומי חסום בדפדפן הזה (למשל גלישה פרטית). הנתונים יישמרו רק עד סגירת הדף. פתחו את האפליקציה בחלון רגיל.</div></div>`);
  if (sess) { const d = sess.plan ? (root.Plans.runDef(sess.plan.id, sess.plan.n) || { title: '' }) : C.dayDef(sess.day); html.push(`<div class="banner acc">${icon('timer')}<div class="grow"><b>אימון בתהליך:</b> יום ${sess.day} — ${esc(d.title)}. ${sess.stepIdx + 1}/${sess.total} שלבים.</div><button class="btn sm primary" data-act="resume">המשך</button></div>`); }
  if (!p.onboarded && C.hasBasics(p) && !root.Plans.active()) html.push(`<div class="banner info">${icon('info')}<div class="grow stack tight"><b>ברוך הבא.</b><span class="small">התוכנית מתחילה היום (${S.fmtDate(p.startDate)}). אפשר לשנות תאריך התחלה, יעדים והעדפות בהגדרות. כל הנתונים נשמרים רק במכשיר הזה — מומלץ לגבות מדי פעם.</span><div class="btns"><a class="btn sm" href="#/settings">להגדרות</a><button class="btn sm ghost" data-act="dismissOnb">הבנתי</button></div></div></div>`);

  const ap = root.Plans.active();
  if (!ap && !C.hasBasics(p)) html.push(`<section class="card hero setup-cta"><span class="eyebrow">התחלה</span><h2>בונים תוכנית אישית</h2><p class="small muted">6 שלבים קצרים: פרטים, מטרה, ציוד וזמינות, מסלול, תצוגה מקדימה ואישור. אפשר לעצור ולחזור.</p><a class="btn primary" href="#/setup/1">${icon('route')} להתחלה</a><a class="btn ghost" href="#/workouts">או: תוכנית 30 היום הקיימת</a></section>`);
  if (ap) html.push(Screens.syncBanner(ap, { compact: true }), Screens.coachCard(ap), Screens.planStatsCard(ap), Screens.nowCard(today, { secondaryStart: true }), Screens.signatureLinks());
  if (!ap && C.nutritionOnly()) { /* M10: nutrition-only mode — no workout cards, no workout task */
    const pr = C.dailyProgress(today);
    html.push(`<section class="card hero" data-nutrition-only><div class="row between top-al"><div class="stack tight grow"><span class="eyebrow">תזונה ומעקב · בלי אימונים</span><h2>${S.fmtDate(today, true)}</h2><span class="muted small">ארוחות, מים, צעדים ושינה נספרים כרגיל.</span></div>${ring(pr.pct, 100, pr.pct + '%', 'היום', 'var(--accent)')}</div><a class="btn ghost sm" href="#/setup/3" data-add-workouts>${icon('route')} להוסיף אימונים</a></section>`, Screens.nowCard(today));
  } else if (!ap) {
  if (n < 1) {
    html.push(`<section class="card hero"><span class="eyebrow">התוכנית טרם התחילה</span><h1>מתחילים ב${S.fmtDate(p.startDate, true)}</h1><p class="muted">עוד ${1 - n} ימים. אפשר לצפות בתוכנית ובתפריט כבר עכשיו.</p><div class="btns"><a class="btn" href="#/day/1">אימון יום 1</a><button class="btn primary" data-act="startToday">להתחיל היום</button></div></section>`);
  } else if (n > 30) {
    const comp = C.completion();
    html.push(`<section class="card hero"><span class="eyebrow">התוכנית הסתיימה</span><h1>30 הימים הושלמו</h1><p class="muted">השלמת ${comp.done} מתוך ${comp.total} ימי אימון. סיכום מלא והשוואה ליום 1 במסך המעקב.</p><div class="btns"><a class="btn primary" href="#/progress">לסיכום</a><button class="btn" data-act="newCycle">מחזור חדש מהיום</button></div><p class="tiny faint">מחזור חדש משנה רק את תאריך ההתחלה. ההיסטוריה נשמרת; כדאי לגבות לפני כן.</p></section>`);
  }
  const dn = C.clampDay(n), d = C.dayDef(dn), wk = P.WEEKS[d.week - 1], comp = C.completion(), prog = C.dailyProgress(today), st = C.status(dn);
  if (n >= 1 && n <= 30) {
    html.push(`<section class="card hero">
      <div class="row between top-al"><div class="stack tight grow"><span class="eyebrow">שבוע ${d.week} · ${esc(wk.name)}</span><h1><span class="num">יום ${n}</span> <span class="muted" style="font-weight:400">מתוך 30</span></h1><span class="muted small">${S.fmtDate(today, true)}</span></div>${ring(prog.pct, 100, prog.pct + '%', 'היום', 'var(--accent)')}</div>
      <div class="grid3"><div class="stat"><span class="v">${comp.pct}%</span><span class="l">השלמת התוכנית</span></div><div class="stat"><span class="v">${C.streak()}</span><span class="l">רצף ימי אימון</span></div><div class="stat"><span class="v">${comp.done}/${comp.total}</span><span class="l">אימונים</span></div></div>
      ${meter(comp.pct, 100)}
    </section>`);
    // workout card
    if (d.type === 'rest') {
      html.push(`<section class="card"><div class="card-h"><h2>${esc(d.title)}</h2><span class="pill">מנוחה</span></div><p class="muted">${esc(d.goal)}</p>${d.tip ? `<p class="small">${esc(d.tip)}</p>` : ''}<a class="btn" href="#/day/${dn}">פרטי היום</a></section>`);
    } else {
      const lg = C.log(dn); const v = Screens.selectedVersion.v; const vv = L.hasVersions(d) ? v : 'std';
      html.push(`<section class="card"><div class="card-h"><div class="stack tight grow"><span class="eyebrow">האימון של היום · ${esc(P.TYPE_LABEL[d.type])}</span><h2>${esc(d.title)}</h2></div><span class="pill ${st === 'done' ? 'good' : st === 'partial' ? 'acc' : ''}">${C.STATUS_HE[st]}</span></div>
        <p class="muted small">${esc(d.goal)}</p>
        <div class="kv"><span data-duration>משך כולל: <b>~${L.estimateMinutes(d, vv)} דק׳</b> (הערכה, כולל חימום, מנוחות ושחרור)</span><span>קושי: ${dots(d.diff, 5)}</span><span>${esc(d.muscles)}</span></div>
        ${Screens.versionSeg(d, vv, 'ver')}
        ${lg ? `<div class="banner ${lg.status === 'done' ? 'info' : 'warn'} small">${icon('check')}<div>נרשם: ${lg.status === 'done' ? 'הושלם' : 'הושלם חלקית'} · ${Math.round((lg.durationSec || 0) / 60)} דק׳ · גרסה ${esc(L.VERSIONS[lg.version] || '')}${lg.rpe ? ' · קושי ' + lg.rpe + '/10' : ''}</div></div>` : ''}
        <button class="btn primary big" data-act="start" data-day="${dn}">${icon('play')} ${lg ? 'אימון חוזר' : 'התחל אימון'}</button>
        <a class="btn ghost" href="#/day/${dn}">כל פרטי האימון והתרגילים</a></section>`);
    }
    html.push(Screens.nowCard(today, { secondaryStart: true })); /* M9: Sofit's card after the day's dashboard */
  }
  } /* classic 30-day cards only when no personal plan is active */
  // suggestions
  const sug = C.suggestions(); /* with an active plan only plan-independent suggestions remain (weight); plan suggestions come from Adapt */
  if (ap) { const ac = Screens.adaptCard(ap); if (ac) html.push(ac); }
  if (sug.length) html.push(`<section class="card"><div class="card-h"><h3>התאמות מוצעות</h3><span class="pill acc">${sug.length}</span></div><div class="list">${sug.map((s, i) => `<div class="li"><div class="grow small">${esc(s.he)}</div>${s.kind === 'up' || s.kind === 'down' ? `<button class="btn sm" data-act="applySug" data-i="${i}">החל</button>` : s.kind === 'weight' ? '<a class="btn sm" href="#/settings">להגדרות</a>' : ''}</div>`).join('')}</div><p class="tiny faint">ההצעות לא מוחלות אוטומטית.</p></section>`);
  // nutrition
  const plan = C.plan(today), eaten = C.eatenTotals(today), planned = C.plannedTotals(today, 'selected'), base = C.plannedTotals(today, 'base');
  if (!t) html.push(Screens.needProfile('יעדי התזונה עוד לא חושבו'));
  else { const protOk = eaten.p >= t.protein, kcalNear = eaten.k >= t.kcal * 0.95;
  html.push(`<section class="card"><div class="card-h"><h2>תזונה היום</h2><a class="btn sm ghost" href="#/nutrition">ליומן ${icon('chev')}</a></div>
    ${Screens.energyBlock(today, eaten)}
    <div class="ring-wrap">${ring(eaten.k, t.kcal, eaten.k, 'נצרך / ' + t.kcal + ' קק״ל')}${ring(Math.round(eaten.p), t.protein, Math.round(eaten.p) + 'ג׳', 'חלבון / ' + t.protein, 'var(--glacier)')}
    <div class="stack tight small grow"><span class="muted" data-home-planned>מתוכנן (${C.DAY.filter(k => plan[k] && plan[k].rid && !plan[k].off && !plan[k].missing).length} ארוחות${plan.extra.on ? ' + תוספת' : ''}): <b class="num">${planned.k}</b> קק״ל · <b class="num">${Math.round(planned.p)}</b> ג׳ חלבון${plan.gap && (plan.gap.p || plan.gap.kLow || plan.gap.kHigh) ? ' · <span class="warn" data-home-gap>התפריט לא מגיע ליעד הקלוריות/החלבון היום — פירוט בתזונה</span>' : ''}</span><span class="muted" data-home-left>${(() => { const kl = t.kcal - eaten.k, pl = Math.round(t.protein - eaten.p); /* M10.2: target, eaten, remaining and "over" are named explicitly — never a silent 0 when the target is exceeded */
      return `נאכל היום: <b class="num">${eaten.k}</b> מתוך יעד <b class="num">${t.kcal}</b> קק״ל · ${kl >= 0 ? `נשארו <b class="num">${kl}</b> קק״ל` : `<span class="warn" data-over>מעל היעד ב־<b class="num">${-kl}</b> קק״ל</span>`} · חלבון: ${pl > 0 ? `נשארו <b class="num">${pl}</b> ג׳` : 'היעד הושג'}`; })()}</span>${protOk ? '<span class="good">✓ יעד החלבון הושג (לפי מה שנרשם)</span>' : ''}${kcalNear && !protOk ? '' : ''}</div></div>
    ${planned.p < t.protein ? `<div class="banner warn small">${icon('info')}<div class="grow">התפריט המתוכנן מספק ${Math.round(planned.p)} ג׳ חלבון — חסרים ${Math.round(t.protein - planned.p)} ג׳ ליעד. <a href="#/nutrition">אפשרויות להשלמה</a></div></div>` : ''}
    <div class="list">${C.DAY.filter(k => !plan[k].off && !plan[k].missing && plan[k].rid).map(k => { const s = plan[k], r = L.recipe(s.rid), m = C.slotMacros(s), e = C.slotEntry(today, k); return `<div class="li"><button class="check ${e ? 'on' : ''}" data-act="eat" data-slot="${k}" aria-label="${e ? 'בטל סימון' : 'סמן כנאכל'}: ${esc(r.he)}" aria-pressed="${!!e}">${icon('check')}</button><a class="grow" href="#/nutrition" style="color:inherit;text-decoration:none"><div class="s">${C.slotNames[k]}</div><div class="t">${esc(r.he)}</div></a><span class="num small muted">${m.k}</span></div>`; }).join('')}
    ${(() => { const s = plan.extra, r = L.recipe(s.rid), m = C.slotMacros(s), e = C.slotEntry(today, 'extra'); return s.on || e ? `<div class="li"><button class="check ${e ? 'on' : ''}" data-act="eat" data-slot="extra" aria-label="${e ? 'בטל סימון' : 'סמן כנאכל'}: ${esc(r.he)}" aria-pressed="${!!e}">${icon('check')}</button><div class="grow"><div class="s">${C.slotNames.extra} · הוספת</div><div class="t">${esc(r.he)}</div></div><span class="num small muted">${m.k}</span></div>` : ''; })()}</div></section>`);
  }
  // trackers
  const dl = C.daily(today), g = p.goals;
  html.push(`<section class="card"><h2>מעקב יומי</h2>
    ${Screens.waterBlock(today)}
    <div class="divider"></div>
    ${(() => { const A = root.Activity, v = A.day(today), tg = A.targetOn(today), e = A.env(); return `<div class="stack tight" data-steps-card><div class="row between"><span class="row">${icon('steps')} <b>צעדים</b> <span class="pill" data-steps-kind="${v.kind}">${esc(A.label(v))}</span></span><span class="num">${v.value != null ? v.value.toLocaleString('he-IL') : '—'}${tg ? ' / ' + tg.toLocaleString('he-IL') : ''}</span></div>${tg ? meter(v.value || 0, tg, 'good') : '<p class="tiny muted">יעד אישי לא נקבע — אין יעד אחד שמתאים לכולם. <a href="#/activity">לקביעת יעד</a></p>'}
      <div class="row"><input id="h-steps" type="number" inputmode="numeric" min="0" max="80000" placeholder="הזנה ידנית" value="${v.user != null ? v.user : ''}"><button class="btn sm" data-act="saveSteps">שמירה</button></div><p class="tiny faint" data-steps-env>${esc(e.native ? A.envText(e) : 'הזנה ידנית. בדפדפן אין גישה ל־Apple Health.')} <a href="#/activity">פרטים</a></p></div>`; })()}
    <div class="divider"></div>
    <div class="grid2"><label class="field">שינה אתמול בלילה (שעות)<input id="h-sleep" type="number" inputmode="decimal" step="0.25" min="0" max="16" value="${dl.sleep || ''}" data-act="saveSleep"></label>
      <label class="field">אנרגיה היום (1–5)<select id="h-energy" data-act="saveEnergy"><option value="">—</option>${[1, 2, 3, 4, 5].map(x => `<option ${dl.energy == x ? 'selected' : ''}>${x}</option>`).join('')}</select></label></div>
    <div class="divider"></div>
    ${(() => { const u = p.units, mw = C.measures().find(m => m.date === today && m.weight); return `<div class="stack tight" data-quick-weight><div class="row between"><b>שקילה היום</b>${mw ? `<span class="small good">נרשם: ${root.UI.U.w(mw.weight, u.w)} ${root.UI.U.wl(u.w)}</span>` : '<span class="tiny muted">רשות</span>'}</div><div class="row"><input id="h-w" type="number" inputmode="decimal" step="0.1" min="30" max="400" placeholder="משקל (${root.UI.U.wl(u.w)})" value="${mw ? root.UI.U.w(mw.weight, u.w) : ''}" aria-label="משקל היום"><button class="btn sm" data-act="saveWeight">שמירה</button></div><p class="tiny faint">נשמר כמדידה של היום במסך המעקב. שינוי יומי במשקל אינו שינוי בשומן.</p></div>`; })()}
  </section>`);
  // weekly chart
  if (ap) { /* Stage D: plan users see the current calendar week (Sun–Sat) — never the classic program's days */
    const cells = root.Insights.weekStrip(ap, today), DOW = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
    const bars = cells.map(c => ({ v: c.date > today ? 0 : C.dailyProgress(c.date).pct, t: DOW[c.dow], cls: c.isToday ? '' : 'gl' }));
    html.push(`<section class="card" data-week-chart><div class="card-h"><h3>השבוע: השלמת משימות יומית</h3><span class="muted small">${S.fmtShort(cells[0].date)}–${S.fmtShort(cells[6].date)}</span></div>${barChart(bars, { label: 'אחוז השלמת משימות לכל יום בשבוע', fmt: v => Math.round(v) + '%', empty: 'הנתונים יופיעו כשתסמנו משימות' })}<p class="tiny faint">משימות: אימון מהתוכנית (בימי אימון), ארוחות, מים, צעדים ושינה.</p></section>`);
  } else if (n >= 1) {
    const w = Math.min(4, Math.ceil(Math.min(30, n) / 7)), [a, b] = C.weekRange(w);
    const bars = []; for (let k = a; k <= b; k++) { const dd = C.dateOfDay(k); const pr = C.dailyProgress(dd); bars.push({ v: k > n ? 0 : pr.pct, t: String(k), cls: k === n ? '' : 'gl' }); }
    html.push(`<section class="card"><div class="card-h"><h3>השבוע: השלמת משימות יומית</h3><span class="muted small">ימים ${a}–${b}</span></div>${barChart(bars, { label: 'אחוז השלמת משימות לכל יום בשבוע', fmt: v => Math.round(v) + '%', empty: 'הנתונים יופיעו כשתסמנו משימות' })}<p class="tiny faint">משימות: אימון (בימי אימון), 3 ארוחות, מים, צעדים ושינה.</p></section>`);
  }
  return {
    title: 'בית', html: html.join(''), handlers: { ...(ap ? Screens.adaptHandlers(ap) : {}), ...Screens.syncHandlers(),
      resume: () => root.Run.open(),
      hideAcct: () => { try { localStorage.setItem('fit30.acctCardHidden', 'true'); } catch (e) { } root.App.render(); },
      planStart: el => { const n2 = +el.dataset.n, d2 = root.Plans.dayOf(ap, n2); root.Run.start(n2, d2.type === 'assess' ? 'test' : (d2.version || 'std'), { id: ap.id, n: n2 }); },
      welcomeSkip: () => { try { localStorage.setItem('fit30.welcomeDone', '1'); } catch (e) { } root.App.render(); },
      dismissOnb: () => { p.onboarded = true; S.save('profile'); root.App.render(); },
      startToday: () => { p.startDate = today; S.save('profile'); root.App.render(); },
      newCycle: () => root.UI.confirmSheet('מחזור חדש', 'תאריך ההתחלה יוגדר להיום. רישומי האימונים הקודמים (לפי מספר יום) יוחלפו כשתבצעו את אותו יום שוב. מומלץ לגבות קודם.', 'להתחיל מחזור חדש', () => { const w = S.load('workouts'); w.archive = (w.archive || []).concat([{ start: p.startDate, days: w.days }]); w.days = {}; S.save('workouts'); p.startDate = today; S.save('profile'); root.App.render(); }),
      ver: el => { Screens.selectedVersion.v = el.dataset.v; root.App.render(); },
      start: el => root.Run.start(+el.dataset.day, L.hasVersions(C.dayDef(+el.dataset.day)) ? Screens.selectedVersion.v : 'std'),
      applySug: el => { const s = C.suggestions()[+el.dataset.i]; if (!s) return; const w = S.load('workouts'); w.levels[s.ex] = s.to; w.feedback[s.ex] = []; S.save('workouts'); root.UI.toast('הרמה עודכנה ל' + C.LEVEL_HE[s.to]); root.App.render(); },
      eat: el => Screens.toggleEat(today, el.dataset.slot),
      extraOn: () => { C.setExtraOn(today, true); root.UI.toast('התוספת נוספה לתפריט והסיכום עודכן'); root.App.render(); },
      water: el => { C.addWater(today, +el.dataset.ml); root.App.render(); },
      saveSteps: () => { const raw = document.getElementById('h-steps').value, v = +raw; if (raw === '' || !(v >= 0)) return; if (root.Activity.setUserSteps(today, v)) root.UI.toast('הצעדים נשמרו (הוזן ידנית)'); root.App.render(); },
      saveWeight: () => { const u = p.units, v = parseFloat(document.getElementById('h-w').value); if (!(v > 0)) { root.UI.toast('הזינו משקל'); return; } const kg = root.UI.U.wIn(v, u.w); if (!(kg > 30 && kg < 300)) { root.UI.toast('משקל לא סביר'); return; }
        const tt = S.load('tracking'), prev = tt.measures.find(m => m.date === today); tt.measures = tt.measures.filter(m => m.date !== today); tt.measures.push(Object.assign({ id: 'm' + Date.now().toString(36), date: today, waist: null, note: '' }, prev || {}, { weight: kg })); S.save('tracking'); root.UI.toast('השקילה נשמרה'); root.App.render(); },
      saveSleep: el => { const v = +el.value; C.setDaily(today, { sleep: v > 0 ? v : null }); root.UI.toast('השינה נשמרה'); root.App.render(); },
      saveEnergy: el => { C.setDaily(today, { energy: el.value ? +el.value : null }); root.App.render(); }
    }
  };
};
/* ── Stage D: plan-aware dashboard pieces ── */
const DOW1 = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
const ST_HE = { done: 'בוצע', partial: 'חלקי', skipped: 'דילוג', missed: 'לא בוצע', today: 'היום', planned: 'מתוכנן', paused: 'מושהה', out: 'מחוץ לתוכנית' };
Screens.weekStrip = function (ap, date) {
  const I = root.Insights, cells = I.weekStrip(ap, date || S.today());
  return `<div class="wstrip" role="list" aria-label="השבוע בתוכנית">${cells.map(c => { const d = c.day, tr = d && root.Plans.isTraining(d);
    const lbl = `${S.HE_DAYS[c.dow]} ${S.fmtShort(c.date)}: ${d ? esc(d.title) : 'מחוץ לתוכנית'}${tr ? ', ' + ST_HE[c.status] : ''}`;
    return `<a role="listitem" class="ws-d t-${c.cls} s-${c.status}${c.isToday ? ' today' : ''}" ${d ? `href="#/pday/${d.n}"` : ''} aria-label="${lbl}"><span class="ws-dow">${DOW1[c.dow]}</span><span class="ws-n num">${S.parse(c.date).getDate()}</span><i class="ws-dot"></i></a>`; }).join('')}</div>`;
};
/* RC5 · SofitGo NOW (first slice). One card that answers: what is done today, what is the next step, what is the smallest
   useful step. Rule-based and transparent — computed from the plan and the journal on this device; nothing is changed until
   the user taps, and no load or plan is altered. Order: unfinished workout → first planned meal not yet marked → water. */
Screens.nowModel = function (date) {
  const tasks = C.dailyProgress(date).tasks || [], by = k => tasks.find(t => t.k === k), plan = C.plan(date), ap = root.Plans.active(), wgoal = C.waterGoalOn(date).ml, water = C.daily(date).water || 0;
  const done = [];
  const w = by('workout'); if (w) done.push({ k: 'workout', he: 'אימון', ok: w.v >= 1, part: w.v > 0 && w.v < 1 });
  C.DAY.filter(k => plan[k] && plan[k].rid && !plan[k].off && !plan[k].missing).forEach(k => done.push({ k, he: C.slotNames[k], ok: !!C.slotEntry(date, k) }));
  done.push({ k: 'water', he: `מים ${C.fmtL(water)}/${C.fmtL(wgoal)} ל׳`, ok: water >= wgoal });
  let next = null, small = null;
  if (w && w.v < 1) {
    const td = ap ? root.Plans.todayDay(ap) : null, n = ap ? (td && td.n) : C.clampDay(C.todayN());
    const dayHref = ap ? '#/pday/' + n : '#/day/' + n;
    next = { k: 'workout', he: w.v > 0 ? 'להשלים את האימון של היום' : 'האימון של היום', btn: ap ? `<button class="btn primary" data-act="planStart" data-n="${n}">${icon('play')} התחלת אימון</button>` : `<button class="btn primary" data-act="start" data-day="${n}">${icon('play')} התחלת אימון</button>` };
    small = { he: 'אין זמן לאימון המלא? גרסה קצרה, או דילוג בלי אשמה — גם מנוחה היא בחירה לגיטימית.', href: dayHref, link: 'לגרסה הקצרה' };
  } else { const m = done.find(d => C.DAY.includes(d.k) && !d.ok);
    if (m) { const r = L.recipe(plan[m.k].rid); next = { k: m.k, he: `${C.slotNames[m.k]}: ${r.he}`, btn: `<button class="btn primary" data-act="eat" data-slot="${m.k}">סמן שאכלתי</button>` };
      small = { he: 'אכלת רק חלק? אפשר לסמן כמות ביומן — גם חצי מנה נספרת.', href: '#/nutrition', link: 'ליומן התזונה' }; }
    else if (water < wgoal) { next = { k: 'water', he: `מים: ${C.fmtL(water)} מתוך ${C.fmtL(wgoal)} ליטר`, btn: `<button class="btn primary" data-act="water" data-ml="250" aria-label="הוספת 0.25 ליטר">+0.25 ל׳</button>` }; small = { he: 'כוס אחת עכשיו מספיקה כצעד הבא.' }; } }
  return { done, next, small };
};
Screens.nowCard = function (date, opts) {
  const m = Screens.nowModel(date), coach = root.FIT30_COACH;
  /* M9: on Home the dashboard card above already has the lime "start workout"; here it is secondary (one lime action per area) */
  if (opts && opts.secondaryStart && m.next && m.next.k === 'workout') m.next.btn = m.next.btn.replace('class="btn primary"', 'class="btn secondary"');
  return `<section class="card now" data-now><div class="row now-h">${coach ? `<a href="#/coach" class="now-coach" data-coach-link aria-label="${esc(coach.name)} — מסך המאמנת"><img class="coach-av" src="${esc(coach.avatar)}" alt="" width="48" height="48" loading="lazy"></a>` : ''}<div class="stack tight grow"><span class="eyebrow" data-coach-label>${coach ? `<a href="#/coach" class="now-name">${esc(coach.name)}</a> — המאמנת הדיגיטלית` : 'המאמן הדיגיטלי'}</span><b class="now-q">${m.next ? 'הצעד הבא' : 'כל מה שתוכנן להיום בוצע ✓'}</b></div></div>
    ${m.next ? `<div class="now-next" data-now-next="${m.next.k}"><span>${esc(m.next.he)}</span>${m.next.btn}</div>` : '<p class="small muted">אפשר לנוח. מחר ממשיכים מאותה נקודה.</p>'}
    ${m.small ? `<p class="small muted" data-now-small>${esc(m.small.he)}${m.small.href ? ` <a href="${m.small.href}">${m.small.link}</a>` : ''}</p>` : ''}
    <nav class="chips now-sc" aria-label="קיצורי דרך" data-now-shortcuts><a class="chip" href="#/planb">Plan B — משהו לא מסתדר</a><a class="chip" href="#/fridge">מה לאכול ממה שיש?</a><a class="chip" href="#/activity">צעדים</a><a class="chip" href="#/travel">נסיעה / שינוי בלו״ז</a></nav>
    <div class="chips now-done" aria-label="מה כבר בוצע היום">${m.done.map(d => `<span class="chip" data-done="${d.k}" aria-pressed="${d.ok}">${d.ok ? '✓ ' : d.part ? '◐ ' : ''}${esc(d.he)}</span>`).join('')}</div>
    <details class="more tiny"><summary>איך נבחר הצעד הבא?</summary><p class="tiny muted">לפי הסדר: אימון שטרם בוצע, ואחריו הארוחה המתוכננת הראשונה שעוד לא סומנה, ואחריהם מים. ${coach ? esc(coach.name) + ' היא המאמנת הדיגיטלית של האפליקציה (כושר ותזונה) — לא דיאטנית או רופאה. ' : ''}ההצעה מחושבת מהתוכנית והיומן שבמכשיר, לא על ידי מודל בינה מלאכותית, ולא משנה את התוכנית.</p></details></section>`;
};
Screens.coachCard = function (ap) {
  const I = root.Insights, PS = root.Plans, p = C.profile(), td = PS.todayDay(ap), stt = PS.stats(ap), tpl = root.PROGRAMS.byId(ap.templateId);
  const goal = p.aims && p.aims.primary ? root.PROGRAMS.GOALS[p.aims.primary] : null, nx = I.nextTraining(ap, S.addDays(S.today(), 1));
  const train = td && PS.isTraining(td), canStart = train && !td.log && ap.status === 'active' && td.status !== 'skipped';
  let head, body = '';
  if (ap.status === 'paused') { head = 'התוכנית מושהית'; body = `<p class="small muted">אין אימונים מתוזמנים עד שתמשיכו. שום רישום לא נמחק.</p><a class="btn primary" href="#/plan">${icon('play')} להמשך התוכנית</a>`; }
  else if (canStart) { head = esc(td.title); body = `<div class="kv"><span class="pill t-${I.TYPE_CLS[td.type]}">${esc(I.TYPE_HE[td.type] || '')}</span>${td.minutes ? `<span data-duration>~${Math.round(td.minutes)} דק׳ בסך הכול (הערכה, כולל חימום ומנוחות)</span>` : ''}<span>${(td.main || []).length} תרגילים</span></div>
      <p class="tiny muted">${(td.main || []).slice(0, 5).map(it => esc(root.EX_BY_ID[it.ex].he)).join(' · ')}</p>
      <button class="btn primary big" data-act="planStart" data-n="${td.n}">${icon('play')} התחלת אימון</button><a class="btn sm ghost" href="#/pday/${td.n}">גרסה קצרה / החלפת תרגיל / דילוג</a>`; }
  else if (td && td.log) { head = 'האימון של היום נרשם ✓'; body = `<p class="small good">${esc(td.title)} · ${td.log.status === 'partial' ? 'חלקי' : 'הושלם'}${td.log.durationSec ? ' · ' + Math.round(td.log.durationSec / 60) + ' דק׳' : ''}${td.log.rpe ? ' · מאמץ ' + td.log.rpe + '/10' : ''}</p>${nx ? `<p class="small muted">הבא: <b>${esc(nx.title)}</b> · ${esc(S.fmtDate(nx.date, true))}</p>` : ''}`; }
  else { head = td && td.type === 'active' ? 'התאוששות פעילה (רשות)' : td && td.status === 'skipped' ? 'האימון של היום דולג' : 'יום מנוחה';
    body = `<p class="small muted">${td && td.type === 'active' ? 'הליכה, ניידות קלה ומתיחות — לפי תחושה.' : 'ההתאוששות היא חלק מהתוכנית. צעדים, מים ושינה ממשיכים להיספר.'}</p>${nx ? `<div class="next-up"><span class="eyebrow">האימון הבא</span><b>${esc(nx.title)}</b><span class="small muted">${esc(S.fmtDate(nx.date, true))}${nx.minutes ? ' · ~' + Math.round(nx.minutes) + ' דק׳' : ''}</span><a class="btn sm" href="#/pday/${nx.n}">פרטים</a></div>` : ''}`; }
  return `<section class="card hero coach plan-today" data-coach><div class="card-h"><span class="eyebrow">${esc(I.greeting())}${goal ? ' · מטרה: ' + esc(goal) : ''}</span><span class="pill ${ap.status === 'active' ? 'good' : 'warn'}">${ap.status === 'active' ? 'פעילה' : 'מושהית'}</span></div>
    <span class="tiny muted">${esc(tpl.he)} · יום <b class="num">${Math.min(stt.dayN, stt.total)}</b> מתוך ${stt.total}${td && td.phase ? ' · ' + esc(td.phase.he) : ''}</span>
    <h2 class="coach-h">${head}</h2>${body}
    ${Screens.weekStrip(ap)}
    <a class="btn ghost sm" href="#/plan">לתוכנית המלאה ${icon('chev')}</a></section>`;
};
Screens.planStatsCard = function (ap) {
  const I = root.Insights, s = root.Plans.stats(ap), cs = I.consistency(ap), pct = s.sessions ? Math.round((s.done + s.partial) / s.sessions * 100) : 0;
  return `<section class="card" data-plan-stats><div class="grid3"><div class="stat"><span class="v num">${pct}%</span><span class="l">מהאימונים בתוכנית בוצעו</span></div>
    <div class="stat"><span class="v num">${cs.current ? cs.current.done + '/' + cs.current.planned : '—'}</span><span class="l">אימונים השבוע</span></div>
    <div class="stat"><span class="v num">${cs.streak}</span><span class="l">שבועות רצופים שנשמרו</span></div></div>
    ${ring2(s.done + s.partial, s.sessions)}
    <details class="more"><summary>איך נספר "שבוע נשמר"?</summary><p class="tiny muted">${esc(cs.rule)} עד עכשיו: ${cs.weeksKept} מתוך ${cs.weeksPast} שבועות שהסתיימו.</p></details></section>`;
};
const ring2 = (v, max) => root.UI.meter(v, max, 'good');
/* M9 · personal greeting and the user's avatar.
   Name: profile.name (optional, typed by the user) — never invented; no name → "שלום, בוא נתחיל".
   Avatar: the user's own photo (Store 'avatar', set in Profile) shown with object-fit: cover; with no photo, the SoFitGo
   brand symbol (provisional raster from the supplied logo package) on --surface. Same box in both states → no layout shift.
   Decorative (aria-hidden): the greeting text carries the meaning; the avatar is not a control. Sofit's portrait is never used here. */
Screens.userAvatar = function (cls) {
  const a = S.load('avatar'), L = root.FIT30_LOGO, c = 'u-av' + (cls ? ' ' + cls : '');
  if (a && a.src) return `<span class="${c}" data-avatar="photo" aria-hidden="true"><img src="${esc(a.src)}" alt="" width="44" height="44"></span>`;
  return `<span class="${c} u-av-brand" data-avatar="brand" aria-hidden="true">${L ? `<img src="${esc(L.sym)}" alt="" width="44" height="44">` : ''}</span>`;
};
Screens.greeting = function () {
  const n = String(C.profile().name || '').trim();
  return `<section class="hello" data-greeting>${Screens.userAvatar()}<div class="stack tight grow"><h2 class="hello-t" data-greeting-text>${n ? 'שלום, ' + esc(n) : 'שלום, בוא נתחיל'}</h2><span class="small muted">${esc(S.fmtDate(S.today(), true))}</span></div></section>`;
};
/* M8 · consumed vs burned. "Consumed" = what the user marked in the journal (estimates from recipes). "Burned" is shown
   ONLY from a measured source; the app has none today (no active-energy reading, no wearable), so it says so instead of
   estimating. No MET/heart-rate guess is made here. */
Screens.energyBlock = function (date, eaten) {
  const logged = eaten.k > 0;
  return `<div class="energy" data-energy><div data-consumed><span class="l">נצרך היום (מהיומן)</span><span class="v">${eaten.k}</span><span class="l">${logged ? 'קק״ל · הערכה לפי המתכונים שסומנו' : 'קק״ל · עוד לא סומנו ארוחות היום'}</span></div>
    <div data-burned="unavailable"><span class="l">נשרף היום</span><span class="v muted" aria-label="לא זמין">—</span><span class="unavail">${icon('info')}לא נמדד — אין מקור מדידה מחובר</span><a class="tiny" href="#/activity">מה צריך כדי למדוד?</a></div></div>`;
};
Screens.toggleEat = function (date, slot) {
  const e = C.slotEntry(date, slot);
  if (C.locked(date)) { root.UI.toast('יום שעבר נעול לעריכה. פתחו אותו ביומן התזונה ובחרו "ערוך יום".'); return; }
  const undo = fn => ({ label: 'ביטול', fn: () => { fn(); root.App.render(); root.UI.toast('בוטל'); } });
  if (e) { C.removeEntry(date, e.id); root.App.render(); root.UI.toast('הסימון בוטל', 0, undo(() => { if (!C.slotEntry(date, slot)) C.addEntry(date, Object.assign({}, e)); })); }
  else { const ne = C.eatSlot(date, slot, 1); root.App.render(); root.UI.toast('סומן כנאכל ✓ (100%). אפשר לערוך כמות ביומן.', 0, undo(() => C.removeEntry(date, ne.id))); }
};

const calSt = { ym: null, classic: false };
Screens.calendar = function () {
  const ap = root.Plans.active();
  if (ap && !calSt.classic) return Screens.planCalendar(ap);
  const tn = C.todayN();
  const cells = P.DAYS.map(d => {
    const st = C.status(d.day), date = C.dateOfDay(d.day), pr = C.dailyProgress(date);
    const showPr = date <= S.today() && pr.pct > 0;
    return `<a class="cal-d ${st} ${d.day === tn ? 'today' : ''}" href="#/day/${d.day}" aria-label="יום ${d.day}, ${esc(P.TYPE_LABEL[d.type])}, ${C.STATUS_HE[st]}"><span class="n">${d.day}</span><span class="ty">${esc(P.TYPE_LABEL[d.type])}</span>${showPr ? `<span class="pr num">${pr.pct}%</span>` : ''}<span class="st"></span></a>`;
  });
  const rows = [];
  P.WEEKS.forEach(w => { const [a, b] = C.weekRange(w.n); rows.push(`<div class="stack tight"><div class="section-title"><h2>שבוע ${w.n} · ${esc(w.name)}</h2><span class="muted small">${S.fmtShort(C.dateOfDay(a))}–${S.fmtShort(C.dateOfDay(b))}</span></div><div class="cal">${cells.slice(a - 1, b).join('')}</div></div>`); });
  return { title: 'לוח 30 יום', html: `${ap ? `<div class="banner info small">${icon('info')}<div class="grow">זה הלוח של תוכנית 30 היום הקלאסית. התוכנית הפעילה שלך מוצגת בלוח הראשי.</div><button class="btn sm" data-act="toPlan">ללוח התוכנית</button></div>` : ''}<section class="card"><div class="legend"><span><i style="background:var(--good)"></i>הושלם</span><span><i style="background:var(--warn)"></i>חלקי</span><span><i style="background:var(--bad)"></i>הוחמץ</span><span><i style="background:var(--faint)"></i>מנוחה</span><span><i style="background:var(--surface-3)"></i>מתוכנן</span><span><i style="background:var(--glacier)"></i>% משימות</span></div><p class="tiny faint">לחיצה על יום פותחת את האימון, התפריט וההתקדמות שלו — גם לימים שעברו. מעבר בין ימים לא משנה ולא מוחק נתונים, ולא מסמן אימון כבוצע.</p></section>${rows.join('')}`,
    handlers: { toPlan: () => { calSt.classic = false; root.App.render(); } } };
};
/* Stage D: calendar of the ACTIVE personal plan — month by month, real dates, type colour + status */
Screens.planCalendar = function (ap) {
  const I = root.Insights, months = I.planMonths(ap), today = S.today(), tm = today.slice(0, 7);
  let ym = calSt.ym && months.includes(calSt.ym) ? calSt.ym : (months.includes(tm) ? tm : months[0]); calSt.ym = ym;
  const k = months.indexOf(ym), [y, m] = ym.split('-').map(Number), HE_M = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
  const rows = I.monthGrid(ap, ym), tpl = root.PROGRAMS.byId(ap.templateId), s = root.Plans.stats(ap);
  const cell = c => { const d = c.day; if (!c.inMonth) return '<span class="pc-d out" aria-hidden="true"></span>';
    const dn = S.parse(c.date).getDate(), pr = c.date <= today ? C.dailyProgress(c.date).pct : 0;
    if (!d) return `<span class="pc-d none"><span class="n num">${dn}</span></span>`;
    return `<a class="pc-d t-${c.cls} s-${c.status}${c.isToday ? ' today' : ''}" href="#/pday/${d.n}" aria-label="${esc(S.fmtDate(c.date, true))}: ${esc(d.title)}, ${ST_HE[c.status] || ''}"><span class="n num">${dn}</span><span class="ty">${esc(I.TYPE_HE[d.type] || '')}</span>${pr > 0 ? `<span class="pr num">${pr}%</span>` : ''}<i class="st"></i></a>`; };
  return { title: 'לוח התוכנית', html: `
    <section class="card hero"><span class="eyebrow">${esc(tpl.he)}</span><div class="kv"><span>${esc(S.fmtDate(ap.start))} – ${esc(S.fmtDate(s.end))}</span><span>יום <b class="num">${Math.min(s.dayN, s.total)}</b> מתוך ${s.total}</span><span>בוצעו <b class="num">${s.done}</b>/${s.sessions}</span></div>
      <div class="legend"><span><i class="lg-tr"></i>כוח</span><span><i class="lg-cd"></i>לב־ריאה</span><span><i class="lg-mb"></i>ניידות/התאוששות</span><span><i class="lg-as"></i>מבחן</span><span><i class="lg-rs"></i>מנוחה</span></div>
      <div class="legend"><span><i style="background:var(--good)"></i>בוצע</span><span><i style="background:var(--warn)"></i>חלקי</span><span><i style="background:var(--bad)"></i>לא בוצע</span><span><i style="background:var(--muted)"></i>דילוג</span></div></section>
    <div class="row between month-nav"><button class="btn sm" data-act="mprev" ${k <= 0 ? 'disabled' : ''} aria-label="החודש הקודם">${icon('back')}</button><h2 class="num">${HE_M[m - 1]} ${y}</h2><button class="btn sm" data-act="mnext" ${k >= months.length - 1 ? 'disabled' : ''} aria-label="החודש הבא">${icon('chev')}</button></div>
    <div class="pcal" role="grid" aria-label="לוח ${HE_M[m - 1]}"><div class="pc-h">${['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'].map(x => `<span>${x}</span>`).join('')}</div>${rows.map(r => `<div class="pc-r">${r.map(cell).join('')}</div>`).join('')}</div>
    <p class="tiny faint">חודש ${k + 1} מתוך ${months.length} בתוכנית. לחיצה על יום פותחת את האימון שלו; התפריט של אותו יום — מתוך מסך היום. מעבר בין חודשים לא משנה נתונים.</p>
    <button class="btn ghost sm" data-act="classic">לוח תוכנית 30 היום הקלאסית</button>`,
    handlers: { mprev: () => { calSt.ym = months[Math.max(0, k - 1)]; root.App.render(); }, mnext: () => { calSt.ym = months[Math.min(months.length - 1, k + 1)]; root.App.render(); }, classic: () => { calSt.classic = true; root.App.render(); } } };
};
})(window);
