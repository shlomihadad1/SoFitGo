/* Stage B screens: profile, step-by-step setup (profile → goal → equipment & availability → route → preview → confirm),
   active plan, plan day. Nothing is filled in for the user; every value shown was entered or confirmed by them. */
(function (root) {
const { esc, icon } = root.UI;
const S = root.Store, C = root.Core;
const Screens = root.Screens;
const PG = () => root.PROGRAMS, PL = () => root.Planner, CT = () => root.CATALOG, PS = () => root.Plans;
const DOW = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
const GOALS8 = ['fat_loss', 'weight_loss', 'muscle', 'strength', 'endurance', 'general', 'maintain', 'recomp'];
const XP = { beginner: ['מתחיל', 'פחות מ־3 חודשים של אימון קבוע, או חזרה אחרי הפסקה ארוכה'], intermediate: ['בינוני', '3–12 חודשים של אימון קבוע; טכניקה בסיסית טובה'], advanced: ['מתקדם', 'יותר משנה של אימון קבוע; מכיר את התרגילים'] };
const PLACE = { home: 'בבית', gym: 'חדר כושר', outdoor: 'בחוץ', mixed: 'משולב' };
const FURNITURE = ['chair', 'table', 'bench', 'step', 'wall', 'doorframe', 'towel'], OTHER_EQ = ['bands', 'dumbbells', 'pullup_bar', 'gym'];
const libCount = eq => root.EXERCISES.filter(e => CT().exMeta(e.id).eq.includes(eq)).length;
const num = (id, b) => { const v = (b || document).querySelector('#' + id); if (!v || v.value === '') return null; const n = +v.value; return isFinite(n) ? n : NaN; };
const why = t => `<p class="why tiny">${icon('info')} ${t}</p>`;
const chip = (act, v, on, label, extra) => `<button class="chip" data-act="${act}" data-v="${v}" aria-pressed="${!!on}" ${extra || ''}>${label}</button>`;
const P = () => C.profile();
const saveP = () => S.save('profile');
const err = (box, msg) => { const e = (box || document).querySelector('[data-err]'); if (e) { e.textContent = msg; e.hidden = !msg; } if (msg) root.UI.toast(msg); };

/* ---------- section renderers (shared by profile screen and setup steps) ---------- */
function secBasics() {
  const p = P(), u = p.units;
  return `<label class="field">שם פרטי (רשות — מופיע רק בברכה במסך הבית)<input type="text" id="pf-name" maxlength="30" autocomplete="given-name" value="${esc(p.name || '')}" placeholder="למשל: שלומי"></label>
    <div class="grid2"><label class="field">גיל<input type="number" id="pf-age" inputmode="numeric" min="14" max="100" value="${p.age ?? ''}"></label>
    <label class="field">גובה (ס״מ)<input type="number" id="pf-h" inputmode="numeric" min="120" max="230" value="${p.height ?? ''}"></label>
    <label class="field">משקל נוכחי (${root.UI.U.wl(u.w)})<input type="number" id="pf-w" inputmode="decimal" step="0.1" value="${p.weight != null ? root.UI.U.w(p.weight, u.w) : ''}"></label>
    <label class="field">משקל יעד (רשות — מוצג במעקב ובבדיקת סבירות; לא משנה את היעד הקלורי)<input type="number" id="pf-tw" inputmode="decimal" step="0.1" value="${p.targetWeight != null ? root.UI.U.w(p.targetWeight, u.w) : ''}"></label></div>
    <label class="field">מין לצורך הנוסחה (רשות)<select id="pf-sex"><option value="">לא לציין</option><option value="m" ${p.sex === 'm' ? 'selected' : ''}>זכר</option><option value="f" ${p.sex === 'f' ? 'selected' : ''}>נקבה</option></select></label>
    ${why('גיל, גובה ומשקל משמשים רק לחישוב הערכת הקלוריות והחלבון (נוסחת מיפלין–סנט ג׳ור). מין משנה את הנוסחה בכ־166 קק״ל ביום; בלי לציין — משתמשים בממוצע ומסמנים את ההערכה כפחות מדויקת. משקל יעד הוא שלך — המערכת לא מבטיחה קצב או תוצאה.')}
    <label class="field">רמת פעילות יומית (כולל עבודה, הליכה ואימונים)<select id="pf-act"><option value="">לא נבחר — הנחה: יושבני (1.55)</option>${Object.entries(C.ACTIVITY_HE).map(([k, [t, d]]) => `<option value="${k}" ${p.activity === k ? 'selected' : ''}>${t} — ${d} (${C.PAL[k]})</option>`).join('')}</select></label>
    <p class="tiny faint">רמת הפעילות משפיעה על הערכת הקלוריות בלבד, לא על האימונים. היא מתארת את כל היום — גם את האימונים — ולכן מספר האימונים לא מתווסף אליה בנפרד. הקטגוריות לפי FAO/WHO/UNU (2004).</p>
    ${p.legacy && !p.sex ? `<p class="tiny warn">החישוב הקודם הניח נוסחה לזכר ו־${Math.round(p.legacy.deficit * 100)}% גירעון. הוא נשמר עד שתבחרו אחרת.</p>` : ''}`;
}
function readBasics(b) {
  const p = P(), u = p.units; const age = num('pf-age', b), h = num('pf-h', b), w = num('pf-w', b), tw = num('pf-tw', b), sex = b.querySelector('#pf-sex').value || null;
  if (age != null && !(age >= 14 && age <= 100)) return 'גיל צריך להיות בין 14 ל־100.';
  if (h != null && !(h >= 120 && h <= 230)) return 'גובה צריך להיות בין 120 ל־230 ס״מ.';
  const wk = w == null ? null : root.UI.U.wIn(w, u.w), twk = tw == null ? null : root.UI.U.wIn(tw, u.w);
  if (wk != null && !(wk > 30 && wk < 300)) return 'משקל לא סביר.'; if (twk != null && !(twk > 30 && twk < 300)) return 'משקל היעד לא סביר.';
  const nmEl = b.querySelector('#pf-name'); if (nmEl) { const nm = nmEl.value.replace(/\s+/g, ' ').trim().slice(0, 30); p.name = nm || null; } /* M9: optional, never invented */
  const actEl = b.querySelector('#pf-act'); if (actEl) { if (actEl.value) p.activity = actEl.value; else delete p.activity; }
  Object.assign(p, { age, height: h, weight: wk, targetWeight: twk, sex }); if (p.startWeight == null && wk != null) p.startWeight = wk; if (sex) p.legacy = p.legacy ? Object.assign(p.legacy, { sex: null }) : null;
  saveP(); return null;
}
function secGoal() {
  const a = P().aims;
  return `<h4>מטרה ראשית</h4><div class="chips wrap">${GOALS8.map(g => chip('gp', g, a.primary === g, esc(PG().GOALS[g]))).join('')}</div>
    <h4>מטרות משניות (עד 2, רשות)</h4><div class="chips wrap">${GOALS8.filter(g => g !== a.primary).map(g => chip('gs', g, a.secondary.includes(g), esc(PG().GOALS[g]))).join('')}</div>
    ${why('המטרה הראשית קובעת את סוג האימונים ואת הערכת האנרגיה (גירעון, שימור או עודף). המשניות משפיעות על בחירת המסלול. מה שהמערכת מחשבת מסומן "הערכה".')}`;
}
const goalHandlers = { gp: el => { const a = P().aims; a.primary = el.dataset.v; a.secondary = a.secondary.filter(g => g !== a.primary); saveP(); root.App.render(); },
  gs: el => { const a = P().aims, g = el.dataset.v; a.secondary = a.secondary.includes(g) ? a.secondary.filter(x => x !== g) : a.secondary.concat(g).slice(-2); saveP(); root.App.render(); } };
function secExperience() { const x = P().experience; return `<div class="list">${Object.entries(XP).map(([k, [t, d]]) => `<button class="li li-btn opt" data-act="xp" data-v="${k}" aria-pressed="${x === k}"><div class="grow"><div class="t">${t}</div><div class="s">${d}</div></div>${x === k ? icon('check') : ''}</button>`).join('')}</div>${why('הרמה קובעת את קושי התרגילים ומספר החזרות בהתחלה. אפשר לשנות בכל רגע.')}`; }
function secAvailability() {
  const a = P().availability, nd = a.days.length;
  return `<h4>ימים שבהם אפשר להתאמן</h4><div class="chips dows">${DOW.map((d, i) => chip('dw', i, a.days.includes(i), d, `aria-label="יום ${S.HE_DAYS[i]}"`)).join('')}</div>
    <h4>כמה אימונים בשבוע</h4><div class="chips">${[1, 2, 3, 4, 5, 6].map(k => chip('ses', k, a.sessions === k, k, k > nd ? 'disabled' : '')).join('')}</div>
    <div class="grid2"><label class="field">זמן מועדף (דק׳)<select id="pf-pref"><option value="">—</option>${[15, 20, 25, 30, 40, 45, 60].map(m => `<option ${a.prefMin === m ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
      <label class="field">זמן מקסימלי (דק׳)<select id="pf-max"><option value="">—</option>${[15, 20, 25, 30, 40, 45, 60, 75, 90].map(m => `<option ${a.maxMin === m ? 'selected' : ''}>${m}</option>`).join('')}</select></label></div>
    ${why('תוכנית חדשה תתוזמן רק בימים שסימנת, ולא יותר מ־6 בשבוע — תמיד נשאר לפחות יום מנוחה. אימון לא יעבור את הזמן המקסימלי; אם מבחן כושר ארוך יותר, זה ייכתב במפורש. אם יש תוכנית פעילה, השינוי יחול עליה רק אחרי "עדכון התוכנית".')}`;
}
const availHandlers = { dw: el => { const a = P().availability, d = +el.dataset.v; a.days = a.days.includes(d) ? a.days.filter(x => x !== d) : a.days.concat(d).sort(); if (a.sessions > a.days.length) a.sessions = a.days.length || null; saveP(); root.App.render(); },
  ses: el => { P().availability.sessions = +el.dataset.v; saveP(); root.App.render(); } };
function readTimes(b) { const a = P().availability, pf = b.querySelector('#pf-pref'), mx = b.querySelector('#pf-max'); if (!pf) return null; const pv = pf.value ? +pf.value : null, mv = mx.value ? +mx.value : null; if (pv && mv && pv > mv) return 'הזמן המועדף לא יכול להיות ארוך מהמקסימלי.'; a.prefMin = pv; a.maxMin = mv; saveP(); return null; }
function secEquipment() {
  const env = P().environment, have = env.equipment;
  const row = e => { const n = libCount(e); return `<button class="li li-btn opt" data-act="eq" data-v="${e}" aria-pressed="${have.includes(e)}"><div class="grow"><div class="t">${esc(CT().EQUIPMENT[e].he)}</div><div class="s">${n ? n + ' תרגילים בספרייה משתמשים בזה' : '<span class="warn">אין עדיין תרגילים בספרייה לציוד הזה</span>'}</div></div>${have.includes(e) ? icon('check') : ''}</button>`; };
  return `<h4>סביבת אימון</h4><div class="chips">${Object.entries(PLACE).map(([k, v]) => chip('pl', k, env.place === k, v)).join('')}</div>
    <p class="tiny faint" data-place-note>הסביבה נשמרת לתיעוד בלבד ואינה משנה את התוכנית — את התרגילים קובעת רשימת הציוד למטה.${env.place === 'gym' && !env.equipment.some(e => OTHER_EQ.includes(e)) ? ' בחדר כושר: סמנו בציוד מה זמין לכם.' : ''}</p>
    <h4>ריהוט ביתי</h4><div class="list">${FURNITURE.map(row).join('')}</div>
    <h4>ציוד</h4><div class="list">${OTHER_EQ.map(row).join('')}</div>
    <div class="banner warn small">${icon('info')}<div>הספרייה כוללת כרגע <b>${root.EXERCISES.filter(e => CT().exMeta(e.id).eq.length === 0).length} תרגילים ללא ציוד</b> ו־${root.EXERCISES.filter(e => CT().exMeta(e.id).eq.length > 0).length} עם ריהוט ביתי. אין עדיין תרגילי משקולות, גומיות, מתח או מכונות — סימון שלהם נשמר, אבל האימונים ייבנו רק מתרגילים שקיימים.</div></div>
    <h4>ציוד נוסף שלך (רשות)</h4><div class="chips wrap">${env.custom.map((c, i) => `<button class="chip" data-act="rmcus" data-i="${i}" aria-label="הסרה ${esc(c)}">${esc(c)} ✕</button>`).join('') || '<span class="tiny faint">—</span>'}</div>
    <div class="row gap"><input id="pf-cus" class="grow" maxlength="40" placeholder="למשל: קטלבל 12 ק״ג"><button class="btn sm" data-act="addcus">הוספה</button></div>
    ${why('ציוד מותאם אישית נשמר כתיעוד בלבד — אין לו עדיין תרגילים, ולכן הוא לא ישמש בתוכנית.')}`;
}
const eqHandlers = { eq: el => { const env = P().environment, e = el.dataset.v; env.equipment = env.equipment.includes(e) ? env.equipment.filter(x => x !== e) : env.equipment.concat(e); saveP(); root.App.render(); },
  pl: el => { P().environment.place = el.dataset.v; saveP(); root.App.render(); },
  addcus: () => { const i = document.getElementById('pf-cus'), v = (i.value || '').trim(); if (!v) return; const env = P().environment; if (!env.custom.includes(v)) env.custom.push(v); saveP(); root.App.render(); },
  rmcus: el => { P().environment.custom.splice(+el.dataset.i, 1); saveP(); root.App.render(); } };
function secExercisePrefs() {
  const x = P().exercisePrefs;
  return `<label class="toggle"><input type="checkbox" id="pf-nojump" ${x.noJump ? 'checked' : ''} data-act="nojump"> בלי תרגילי קפיצה (אימפקט גבוה)</label>
    <h4>תרגילים מועדפים (${x.fav.length})</h4><div class="chips wrap">${x.fav.map(id => `<span class="pill gl">${esc(root.EX_BY_ID[id].he)}</span>`).join('') || '<span class="tiny faint">—</span>'}</div>
    <h4>תרגילים שלא לכלול (${x.exclude.length})</h4><div class="chips wrap">${x.exclude.map(id => `<span class="pill bad">${esc(root.EX_BY_ID[id].he)}</span>`).join('') || '<span class="tiny faint">—</span>'}</div>
    <button class="btn sm" data-act="pickex">בחירת תרגילים</button>${why('מועדפים נבחרים קודם כשיש כמה אפשרויות שוות. תרגילים מוחרגים לא ייכנסו לתוכנית; אם אין להם חלופה, המקום יישאר ריק עם הסבר.')}`;
}
const exPrefHandlers = { nojump: el => { P().exercisePrefs.noJump = el.checked; saveP(); },
  pickex: () => { const x = P().exercisePrefs; const rows = root.EXERCISES.map(e => `<div class="li"><div class="grow small">${esc(e.he)}</div><button class="chip" data-act="fv" data-id="${e.id}" aria-pressed="${x.fav.includes(e.id)}">מועדף</button><button class="chip" data-act="xc" data-id="${e.id}" aria-pressed="${x.exclude.includes(e.id)}">לא לכלול</button></div>`).join('');
    root.UI.sheet('העדפות תרגילים', `<div class="list">${rows}</div><button class="btn primary" data-act="done">סיום</button>`, {
      fv: el => { const id = el.dataset.id; x.fav = x.fav.includes(id) ? x.fav.filter(i => i !== id) : x.fav.concat(id); x.exclude = x.exclude.filter(i => i !== id); saveP(); el.setAttribute('aria-pressed', x.fav.includes(id)); el.nextElementSibling.setAttribute('aria-pressed', false); },
      xc: el => { const id = el.dataset.id; x.exclude = x.exclude.includes(id) ? x.exclude.filter(i => i !== id) : x.exclude.concat(id); x.fav = x.fav.filter(i => i !== id); saveP(); el.setAttribute('aria-pressed', x.exclude.includes(id)); el.previousElementSibling.setAttribute('aria-pressed', false); },
      done: (el, e, close) => { close(); root.App.render(); } }); } };
function secMedia() { const m = P().mediaPrefs; return `<label class="toggle"><input type="checkbox" data-act="mloop" ${m.loop ? 'checked' : ''}> חזרה אוטומטית בסרטוני הדגמה</label><label class="toggle"><input type="checkbox" data-act="mauto" ${m.autoplay ? 'checked' : ''}> הפעלה אוטומטית (מושתקת) כשיש סרטון</label>${why('כרגע אין עדיין סרטוני הדגמה בספרייה; ההעדפה תחול כשיתווספו.')}`; }
const mediaHandlers = { mloop: el => { P().mediaPrefs.loop = el.checked; saveP(); }, mauto: el => { P().mediaPrefs.autoplay = el.checked; saveP(); } };

/* ---------- profile screen ---------- */
Screens.profile = function () {
  const p = P(), t = C.targets(), ap = PS().active();
  const filled = [C.hasBasics(p), !!p.aims.primary, !!p.experience, p.availability.days.length > 0 && !!p.availability.maxMin];
  return { title: 'פרופיל', back: '#/settings', html: `
    <section class="card hero"><div class="card-h"><h2>הפרופיל שלי</h2><span class="pill ${filled.every(Boolean) ? 'good' : 'warn'}">${filled.filter(Boolean).length}/4 חלקים הושלמו</span></div>
      <p class="small muted">אפשר למלא חלק עכשיו ולהשלים אחר כך. הנתונים נשמרים רק במכשיר.</p>
      <div class="btns"><a class="btn primary" href="#/setup/1">${icon('route')} הגדרה שלב־אחר־שלב</a>${ap ? `<a class="btn" href="#/plan">לתוכנית הפעילה</a>` : ''}</div></section>
    ${ap ? Screens.syncBanner(ap) : ''}
    <section class="card" data-sec="photo"><h3>תמונת פרופיל (רשות)</h3><div class="row">${Screens.userAvatar('lg')}<div class="stack tight grow">
      <p class="tiny muted">${S.load('avatar').src ? 'התמונה שלך מוצגת בברכה במסך הבית.' : 'בלי תמונה מוצג הסמל של SoFitGo.'} התמונה נחתכת לריבוע, מוקטנת ל־256 פיקסלים ונשמרת רק במכשיר הזה. היא לא נכללת בגיבוי, בדיוק כמו תמונות ההתקדמות.</p>
      <div class="btns"><label class="btn sm" data-photo-pick>${icon('image')} ${S.load('avatar').src ? 'החלפת תמונה' : 'בחירת תמונה'}<input type="file" accept="image/*" id="pf-photo" class="sr-only"></label>${S.load('avatar').src ? '<button class="btn sm ghost" data-act="photoDel">הסרת התמונה</button>' : ''}</div></div></div></section>
    <section class="card" data-sec="basics"><h3>פרטים אישיים</h3>${secBasics()}<p class="tiny bad" data-err hidden></p><button class="btn" data-act="saveBasics">שמירה</button>
      ${t ? `<p class="tiny muted">הערכת המערכת: ${t.kcal} קק״ל · ${t.protein} ג׳ חלבון ביום. <a href="#/targets">איך חושב</a></p>${Screens.targetWarnings({ disclaimer: true })}` : ''}</section>
    <section class="card"><h3>מטרות</h3>${secGoal()}</section>
    <section class="card"><h3>רמת ניסיון</h3>${secExperience()}</section>
    <section class="card" data-sec="avail"><h3>זמינות</h3>${secAvailability()}<p class="tiny bad" data-err hidden></p><button class="btn" data-act="saveTimes">שמירת זמנים</button></section>
    <section class="card"><h3>סביבה וציוד</h3>${secEquipment()}</section>
    <section class="card"><h3>העדפות תרגילים</h3>${secExercisePrefs()}</section>
    <section class="card"><h3>העדפות מזון</h3><p class="small muted">ללא חלב / ביצים / עוף, צמחוני, החרגות — במסך ההגדרות.</p><a class="btn sm" href="#/settings">להעדפות המזון</a></section>
    <section class="card"><h3>מדיה</h3>${secMedia()}</section>
    ${ap ? `<section class="card"><h3>תאריך התחלה ומשך</h3><p class="small">התוכנית הפעילה: <b>${esc(PG().byId(ap.templateId).he)}</b>, מתחילה ${esc(S.fmtDate(ap.start))}, ${PS().stats(ap).total} ימים. שינוי מסלול או תאריך — דרך ההגדרה שלב־אחר־שלב.</p></section>` : ''}`,
    handlers: Object.assign({}, goalHandlers, availHandlers, eqHandlers, exPrefHandlers, mediaHandlers, Screens.syncHandlers(), {
      xp: el => { P().experience = el.dataset.v; saveP(); root.App.render(); },
      saveBasics: el => { const box = el.closest('section'); const e = readBasics(box); err(box, e); if (!e) { root.UI.toast('נשמר'); root.App.render(); } },
      saveTimes: el => { const box = el.closest('section'); const e = readTimes(box); err(box, e); if (!e) root.UI.toast('נשמר'); },
      photoDel: () => { const a = S.load('avatar'), prev = a.src; a.src = null; a.at = new Date().toISOString(); if (S.save('avatar')) root.UI.toast('התמונה הוסרה', 0, { label: 'ביטול', fn: () => { const b = S.load('avatar'); b.src = prev; S.save('avatar'); root.App.render(); } }); root.App.render(); } }),
    after: v => { const f = v.querySelector('#pf-photo'); if (f) f.addEventListener('change', async () => { const r = await Screens.avatarFromFile(f.files && f.files[0]); root.UI.toast(r === true ? 'התמונה נשמרה' : r === 'save' ? 'השמירה נכשלה — ייתכן שאין מקום באחסון' : 'לא ניתן לקרוא את הקובץ כתמונה'); root.App.render(); }); } };
};
/* M9 · profile photo: decode the chosen file, centre-crop to a square (never stretched), downscale to 256 px, JPEG 0.85,
   store as a data URL in Store 'avatar' (fit30.avatar). Nothing leaves the device. Returns true | 'save' | 'decode'. */
Screens.avatarFromFile = function (file) {
  return new Promise(res => {
    if (!file) { res('decode'); return; }
    let url; try { url = URL.createObjectURL(file); } catch (e) { res('decode'); return; }
    const img = new Image();
    img.onload = () => { try { const w = img.naturalWidth, h = img.naturalHeight, k = Math.min(w, h); if (!k) throw new Error('empty');
        const s = Math.min(256, k), c = document.createElement('canvas'); c.width = c.height = s; const x = c.getContext('2d');
        x.imageSmoothingQuality = 'high'; x.drawImage(img, (w - k) / 2, (h - k) / 2, k, k, 0, 0, s, s);
        const a = S.load('avatar'); a.src = c.toDataURL('image/jpeg', 0.85); a.at = new Date().toISOString(); res(S.save('avatar') ? true : 'save');
      } catch (e) { res('decode'); } finally { URL.revokeObjectURL(url); } };
    img.onerror = () => { URL.revokeObjectURL(url); res('decode'); };
    img.src = url;
  });
};

/* ---------- setup flow ---------- */
const STEPS = ['פרטים וניסיון', 'מטרה', 'ציוד וזמינות', 'מסלול', 'תצוגה מקדימה', 'אישור'];
const setupState = () => { const p = P(); p.setup = p.setup || { template: null, start: null, length: 84 }; return p.setup; };
function stepper(k) { return `<ol class="stepper-nav" aria-label="שלבי ההגדרה">${STEPS.map((s, i) => `<li class="${i + 1 === k ? 'cur' : i + 1 < k ? 'done' : ''}"><span>${i + 1}</span><b>${s}</b></li>`).join('')}</ol><p class="tiny muted">שלב ${k} מתוך ${STEPS.length}: ${STEPS[k - 1]}</p>`; }
const nav = (k, nextLabel, nextDisabled) => `<p class="tiny bad" data-err hidden></p><div class="btns setup-nav">${k > 1 ? `<a class="btn ghost" href="#/setup/${k - 1}">${icon('back')} חזרה</a>` : ''}<button class="btn primary" data-act="next" ${nextDisabled ? 'disabled' : ''}>${nextLabel || 'המשך'}</button></div>`;
function draftPlan() {
  const ss = setupState(); if (!ss.template) return { error: 'לא נבחר מסלול' };
  const params = PS().paramsFromProfile(P()); const m = PS().missing(params); if (m.length) return { error: 'חסר: ' + m.join(', '), missing: m };
  try { const plan = PS().create(ss.template, params, ss.start || S.today(), ss.length); return { plan, params, prev: PS().preview(plan) }; } catch (e) { return { error: e.message }; }
}
Screens.setup = function (arg) {
  const k = Math.max(1, Math.min(6, +arg || 1)), ss = setupState(), p = P();
  let body = '', next = null, nextLabel = 'המשך', disabled = false, extra = {};
  if (k === 1) { body = `<section class="card"><h3>פרטים אישיים</h3>${secBasics()}</section><section class="card"><h3>רמת ניסיון</h3>${secExperience()}</section>`;
    next = b => { const e = readBasics(b); if (e) return e; if (!P().experience) return 'בחרו רמת ניסיון — היא נחוצה לבניית התוכנית.'; return null; };
    extra = { xp: el => { readBasics(document.getElementById('view')); P().experience = el.dataset.v; saveP(); root.App.render(); } }; }
  if (k === 2) { body = `<section class="card">${secGoal()}</section>`; next = () => P().aims.primary ? null : 'בחרו מטרה ראשית.'; extra = goalHandlers; }
  if (k === 3 && p.mode === 'nutrition' && !PS().active()) { /* M10: nutrition-only — zero workouts is a valid choice */
    body = `<section class="card" data-nowo-on><h3>בלי אימונים כרגע</h3><p class="small">האפליקציה תציג תפריט, יומן אכילה, מים, צעדים ושינה — בלי אימונים ובלי תזכורות לאימון. כלום לא נמחק, ואפשר להוסיף אימונים בכל רגע.</p><button class="btn ghost" data-act="nowo">${icon('route')} בעצם, אני רוצה גם אימונים</button></section>`;
    nextLabel = 'סיום — תזונה בלבד';
    next = () => { p.onboarded = true; saveP(); location.hash = '#/'; root.UI.toast('נשמר: תזונה ומעקב, בלי אימונים'); return 'done'; };
    extra = { nowo: () => { delete P().mode; saveP(); root.App.render(); } };
  } else if (k === 3) { body = `${PS().active() ? '' : `<section class="card" data-nowo-off><div class="row between"><div class="grow small"><b>לא רוצים אימונים כרגע?</b><div class="muted tiny">אפשר להשתמש רק בתזונה ובמעקב.</div></div><button class="btn sm" data-act="nowo">תזונה בלבד</button></div></section>`}<section class="card"><h3>זמינות</h3>${secAvailability()}</section><section class="card"><h3>סביבה וציוד</h3>${secEquipment()}</section>`;
    next = b => { const e = readTimes(b); if (e) return e; const a = P().availability; if (!a.days.length) return 'סמנו לפחות יום אחד.'; if (!a.sessions) return 'בחרו כמה אימונים בשבוע.'; if (!a.maxMin) return 'בחרו זמן מקסימלי לאימון.'; return null; };
    const keep = f => el => { readTimes(document.getElementById('view')); f(el); }; /* keep the time selections when re-rendering */
    extra = Object.fromEntries(Object.entries(Object.assign({}, availHandlers, eqHandlers)).map(([k, f]) => [k, keep(f)]));
    extra.nowo = () => { P().mode = 'nutrition'; saveP(); root.App.render(); }; }
  if (k === 4) { const goal = p.aims.primary, list = PG().TEMPLATES.filter(t => !t.classic);
    const rec = t => (t.goals.includes(goal) ? 2 : 0) + (p.aims.secondary.some(g => t.goals.includes(g)) ? 1 : 0);
    const sorted = list.slice().sort((a, b) => rec(b) - rec(a));
    body = `<section class="card"><p class="small muted">מסלולים שמתאימים למטרה "${esc(PG().GOALS[goal] || '—')}" מופיעים ראשונים.</p><div class="list">${sorted.map(t => { const ok = PS().activatable(t), gaps = PS().templateGaps(t);
      return `<button class="li li-btn opt route" data-act="tpl" data-v="${t.id}" aria-pressed="${ss.template === t.id}" ${ok ? '' : 'disabled'}><div class="grow"><div class="t">${esc(t.he)} ${rec(t) >= 2 ? '<span class="pill good">מתאים למטרה</span>' : ''}</div><div class="s">${esc(t.audience)}</div><div class="kv tiny"><span>${t.days ? t.days + ' ימים' : 'אורך לבחירה'}</span><span>עד ${t.minutes} דק׳</span></div>${ok ? '' : `<div class="tiny warn">לא זמין עדיין: אין בספרייה תרגילים ל־${gaps.map(g => esc(CT().EQUIPMENT[g].he)).join(', ')}.</div>`}</div>${ss.template === t.id ? icon('check') : ''}</button>`; }).join('')}</div>
      ${ss.template && PG().byId(ss.template).custom ? `<label class="field">אורך התוכנית (ימים, 1–365)<input type="number" id="su-len" min="1" max="365" value="${ss.length || 84}"></label>` : ''}</section>`;
    next = b => { if (!ss.template) return 'בחרו מסלול.'; const l = b.querySelector('#su-len'); if (l) { const v = +l.value; if (!(v >= 1 && v <= 365)) return 'אורך: 1–365 ימים.'; ss.length = v; } saveP(); return null; };
    extra = { tpl: el => { ss.template = el.dataset.v; saveP(); root.App.render(); } }; }
  if (k === 5 || k === 6) {
    const d = draftPlan();
    if (d.error) body = `<div class="banner warn">${icon('info')}<div>${esc(d.error)}. <a href="#/setup/${d.missing ? (d.missing.includes('מטרה ראשית') ? 2 : d.missing.includes('רמת ניסיון') ? 1 : 3) : 4}">להשלמה</a></div></div>`, disabled = true;
    else {
      const t = PG().byId(ss.template), s = d.prev.summary, pr = d.params;
      const eqNames = ['ללא ציוד'].concat(pr.equipment.map(e => CT().EQUIPMENT[e].he));
      const usedEq = new Set(d.prev.days.flatMap(x => (x.main || []).flatMap(it => CT().exMeta(it.ex).eq)));
      const notes = [...new Set(d.prev.days.flatMap(x => x.notes || []).filter(n => !/יום רשות|מבחן כושר סטנדרטי:/.test(n)))];
      const summary = `${Screens.equipGap(null, pr)}<section class="card"><h3>סיכום הבחירות שלך</h3><dl class="pdl"><dt>מטרה</dt><dd>${esc(PG().GOALS[pr.goal])}${pr.secondary.length ? ' · משניות: ' + pr.secondary.map(g => esc(PG().GOALS[g])).join(', ') : ''}</dd><dt>רמה</dt><dd>${esc(XP[pr.level][0])}</dd><dt>ימים</dt><dd>${pr.days.map(i => S.HE_DAYS[i]).join(', ')} · ${pr.spw} אימונים בשבוע</dd><dt>זמן</dt><dd>${pr.prefMin ? 'מועדף ' + pr.prefMin + ' · ' : ''}מקסימום ${pr.maxMin} דק׳</dd><dt>ציוד</dt><dd>${esc(eqNames.join(', '))}</dd>${pr.exclude.length ? `<dt>לא לכלול</dt><dd>${pr.exclude.map(id => esc(root.EX_BY_ID[id].he)).join(', ')}</dd>` : ''}${pr.noJump ? '<dt>קפיצות</dt><dd>בלי</dd>' : ''}</dl><a class="tiny" href="#/setup/1">שינוי</a></section>`;
      const plan = `<section class="card"><h3>${esc(t.he)}</h3><div class="grid3 pstats"><div class="stat"><span class="v num">${s.days}</span><span class="l">ימים</span></div><div class="stat"><span class="v num">${s.sessionsPerWeek}</span><span class="l">אימונים בשבוע</span></div><div class="stat"><span class="v num">~${Math.round(s.avgMinutes)}</span><span class="l">דק׳ לאימון (הערכה)</span></div></div>
        <p class="tiny muted">משך מרבי מחושב: ${Math.round(s.maxMinutes)} דק׳ · ${s.sessions} אימונים · ${s.assess} מבחני כושר · ${s.deloadWeeks} שבועות קלים · ${s.exercisesUsed} תרגילים שונים · ציוד בשימוש: ${esc(['ללא ציוד'].concat([...usedEq].map(e => CT().EQUIPMENT[e].he)).join(', '))}</p>
        <h4>מבנה השלבים</h4><ol class="ptl-l">${s.phases.map(ph => `<li><i></i><div><b>${esc(ph.he)}</b> <span class="tiny muted">ימים ${ph.startDay}–${ph.endDay}</span><div class="tiny faint">${esc(ph.focus)}</div></div></li>`).join('')}</ol>
        <h4>מגבלות ידועות</h4><ul class="bul small">${[t.limits !== '—' ? t.limits : null].concat(s.gaps, notes.slice(0, 4), ['זמני האימון מחושבים לפי קצב מונח — הערכה.', 'ערכי התזונה מחושבים מטבלת מזון — הערכה.']).filter(Boolean).map(x => `<li>${esc(x)}</li>`).join('')}</ul></section>`;
      if (k === 5) {
        const mp = root.MealPlan.currentParams(), ng = root.MealPlan.generate(mp, d.plan.start, Math.min(28, s.days), d.plan.id + ':0') /* RC1: same seed as the activated menu (mealplanner menus()), so the preview shows exactly what will be served */, nd = ng.days.filter(x => x.totals);
        const avg = k => nd.length ? Math.round(nd.reduce((a, x) => a + x.totals[k], 0) / nd.length) : 0, gapsP = nd.filter(x => x.gap && x.gap.p).length;
        const nutri = `<section class="card" data-menu-preview><h3>תפריט אישי (${ng.days.length} הימים הראשונים)</h3>${mp.kcal ? `<div class="kv small"><span>יעד: <b>${mp.kcal}</b> קק״ל · <b>${mp.protein}</b> ג׳ חלבון</span><span>ממוצע מתוכנן: <b>${avg('k')}</b> קק״ל · <b>${avg('p')}</b> ג׳</span><span>ימים עם פער חלבון: <b>${gapsP}</b></span><span>מנות שונות: <b>${new Set(nd.flatMap(x => ['m1', 'm2', 'snack'].map(k => x.slots[k] && x.slots[k].rid).filter(Boolean))).size}</b></span></div>` : '<p class="small warn">אין יעדי תזונה (חסרים גיל/גובה/משקל) — התפריט יוצג בכמויות המתכון, בלי התאמה ליעד.</p>'}${ng.notes.length ? `<ul class="bul tiny warn">${ng.notes.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}<p class="tiny faint">${mp.meals === 2 ? '2 ארוחות ביום' : '3 ארוחות ביום'}${mp.maxPrep ? ' · עד ' + mp.maxPrep + ' דק׳ הכנה' : ''} · העדפות מהגדרות התזונה. תוספת החלבון נשארת רשות ולא נספרת.</p></section>`;
        body = summary + plan + nutri + `<section class="card"><h3>שבוע ראשון</h3><ol class="pdays">${d.prev.days.slice(0, 7).map(x => `<li class="pday t-${x.type}"><div class="pd-h"><span class="pd-n num">${S.fmtShort(x.date)}</span><b>${esc(x.title)}</b>${x.minutes ? `<span class="tiny muted">~${Math.round(x.minutes)} דק׳</span>` : ''}</div>${x.main && x.main.length ? `<div class="tiny muted">${x.main.map(it => esc(root.EX_BY_ID[it.ex].he)).join(' · ')}</div>` : ''}</li>`).join('')}</ol></section>
          <section class="card"><label class="field">תאריך התחלה<input type="date" id="su-start" min="${S.today()}" value="${ss.start && ss.start >= S.today() ? ss.start : S.today()}"></label>${why('אפשר להתחיל היום או בתאריך אחר. ההתחלה משפיעה על הימים בשבוע שבהם ייפלו האימונים.')}</section>`;
        next = b => { const v = b.querySelector('#su-start').value; if (!v || v < S.today()) return 'בחרו תאריך מהיום והלאה.'; ss.start = v; saveP(); return null; };
        extra = { };
        setTimeout(() => { const i = document.getElementById('su-start'); if (i) i.addEventListener('change', () => { if (i.value >= S.today()) { ss.start = i.value; saveP(); root.App.render(); } }); }, 0);
      } else {
        const cur = PS().active(), cs = cur ? PS().stats(cur) : null;
        body = summary + plan + `<section class="card"><h3>אישור</h3>${cur ? `<div class="banner warn small">${icon('info')}<div><b>יש תוכנית פעילה:</b> ${esc(PG().byId(cur.templateId).he)} — בוצעו ${cs.done} אימונים מתוך ${cs.sessions}. היא תסומן "הוחלפה"; ההיסטוריה שלה נשמרת ואפשר לראות אותה במסך התוכנית.</div></div><label class="toggle"><input type="checkbox" id="su-ok"> אני מאשר/ת להחליף את התוכנית הפעילה</label>` : ''}
          <p class="small">התוכנית תתחיל ב־<b>${esc(S.fmtDate(d.plan.start, true))}</b>. תוכנית 30 היום הקיימת וכל הרישומים שלה לא משתנים.</p></section>`;
        nextLabel = 'הפעלת התוכנית';
        next = b => { const ok = b.querySelector('#su-ok'); if (cur && !(ok && ok.checked)) return 'צריך לאשר את החלפת התוכנית הפעילה.'; try { PS().activate(d.plan, { confirmReplace: !!cur }); } catch (e) { return e.message; } ss.template = null; ss.start = null; saveP(); location.hash = '#/plan'; root.UI.toast('התוכנית הופעלה'); return 'done'; };
      }
    }
  }
  return { title: 'הגדרת תוכנית', back: k > 1 ? '#/setup/' + (k - 1) : '#/profile', html: stepper(k) + body + nav(k, nextLabel, disabled),
    handlers: Object.assign({}, extra, { next: () => { const box = document.getElementById('view'); const e = next ? next(box) : null; if (e === 'done') return; if (e) { err(box, e); return; } location.hash = '#/setup/' + (k + 1); },
      xp: extra.xp || (el => { P().experience = el.dataset.v; saveP(); root.App.render(); }) }) };
};

/* ---------- active plan ---------- */
const STATUS_HE = { done: 'בוצע', partial: 'חלקי', skipped: 'דילוג', missed: 'לא בוצע', today: 'היום', planned: 'מתוכנן', paused: 'מושהה' };
const STATUS_CLS = { done: 'good', partial: 'acc', skipped: '', missed: 'bad', today: 'gl', planned: '', paused: 'warn' };
const PLAN_ST = { active: 'פעילה', paused: 'מושהית', cancelled: 'בוטלה', replaced: 'הוחלפה', completed: 'הסתיימה', draft: 'טיוטה' };
function dayRow(d) { return `<a class="li pdrow st-${d.status}" href="#/pday/${d.n}"><div class="pd-date"><b class="num">${S.fmtShort(d.date)}</b><span class="tiny muted">${DOW[S.parse(d.date).getDay()]}</span></div><div class="grow"><div class="t">${esc(d.title)}${d.movedTo ? ' <span class="pill">הועבר</span>' : ''}${d.version && d.version !== 'std' ? ` <span class="pill">${esc(PL().VERSION_HE[d.version] || '')}</span>` : ''}</div>${PS().isTraining(d) ? `<div class="s">${(d.main || []).slice(0, 4).map(it => esc(root.EX_BY_ID[it.ex].he)).join(' · ')}</div>` : ''}</div>${PS().isTraining(d) || d.status === 'done' ? `<span class="pill ${STATUS_CLS[d.status]}">${STATUS_HE[d.status]}</span>` : ''}</a>`; }
Screens.planDayRow = dayRow;
Screens.plan = function () {
  const p = PS().active(), past = PS().list().filter(x => x !== p && x.status !== 'draft');
  const history = past.length ? `<section class="card"><h3>תוכניות קודמות</h3><div class="list">${past.map(x => { const s = PS().stats(x); return `<div class="li"><div class="grow"><div class="t">${esc(PG().byId(x.templateId).he)}</div><div class="s">${PLAN_ST[x.status]} · ${esc(S.fmtDate(x.start))} · בוצעו ${s.done} מתוך ${s.sessions}</div></div></div>`; }).join('')}</div><p class="tiny faint">ההיסטוריה של תוכניות שבוטלו או הוחלפו נשמרת ונכללת בגיבוי.</p></section>` : '';
  if (!p) return { title: 'התוכנית שלי', back: '#/workouts', html: `<section class="card"><h2>אין תוכנית אישית פעילה</h2><p class="small muted">תוכנית 30 היום הקיימת זמינה במסך האימונים. אפשר לבנות תוכנית אישית לפי מטרה, ציוד וזמינות.</p><a class="btn primary" href="#/setup/1">${icon('route')} בניית תוכנית</a></section>${history}`, handlers: {} };
  const t = PG().byId(p.templateId), ds = PS().days(p), s = PS().stats(p), td = PS().todayDay(p), tod = S.today();
  const from = ds.findIndex(d => d.date >= tod), weekDays = ds.slice(Math.max(0, from), Math.max(0, from) + 14).sort((a, b) => a.date < b.date ? -1 : 1);
  const ph = (ds.find(d => d.date >= tod) || ds[ds.length - 1]).phase;
  const changes = (p.changes || []).slice(-8).reverse();
  return { title: 'התוכנית שלי', back: '#/workouts', html: `${Screens.syncBanner(p)}${Screens.equipGap(p)}
    <section class="card hero"><div class="card-h"><h2>${esc(t.he)}</h2><span class="pill ${p.status === 'active' ? 'good' : 'warn'}">${PLAN_ST[p.status]}</span></div>
      <div class="kv"><span>יום <b class="num">${s.dayN}</b> מתוך ${s.total}</span><span>שלב: <b>${esc(ph.he)}</b></span><span>עד ${esc(S.fmtDate(s.end))}</span></div>
      <div class="meter good" aria-label="אימונים שבוצעו"><i style="width:${s.sessions ? Math.round(s.done / s.sessions * 100) : 0}%"></i></div>
      <div class="kv tiny"><span>בוצעו ${s.done}</span><span>חלקי ${s.partial}</span><span>דילוג ${s.skipped}</span><span>לא בוצעו ${s.missed}</span><span>סה״כ ${s.sessions}</span></div></section>
    ${p.status === 'paused' ? `<div class="banner warn">${icon('info')}<div class="grow">התוכנית מושהית. בהמשכה, הימים הבאים נדחים כך שלא יוחמץ אימון.</div><button class="btn sm" data-act="resume">המשך</button></div>`
      : td ? `<section class="card"><h3>היום</h3>${dayRow(td)}${PS().isTraining(td) && !td.log ? `<div class="btns"><button class="btn primary" data-act="start" data-n="${td.n}">${icon('play')} התחלת אימון</button><a class="btn" href="#/pday/${td.n}">פרטים, גרסה והחלפות</a></div>` : ''}</section>` : ''}
    ${Screens.travelCard(p)}${Screens.adaptCard(p, { history: true, always: true })}
    <section class="card"><h3>השבועיים הקרובים</h3><div class="list">${weekDays.map(dayRow).join('') || '<div class="empty">התוכנית הסתיימה</div>'}</div></section>
    <section class="card"><h3>שינויים</h3><div class="btns">${p.status === 'active' ? `<button class="btn" data-act="pause">השהיה</button>` : ''}<button class="btn" data-act="avail">שינוי ימים וזמן</button><button class="btn" data-act="equip">שינוי ציוד</button><button class="btn" data-act="travel">מצב נסיעה / בלי ציוד</button><a class="btn" href="#/explain">למה התוכנית כזו?</a><a class="btn" href="#/setup/4">מעבר לתוכנית אחרת</a><button class="btn danger ghost" data-act="cancel">ביטול התוכנית</button></div>
      <p class="tiny faint">כל שינוי חל מהיום הפתוח הבא והלאה, אחרי תצוגת הבדלים ואישור. אימונים שכבר נרשמו לא משתנים.</p></section>
    <section class="card"><h3>היסטוריית שינויים</h3>${changes.length ? `<ul class="bul small">${changes.map(c => `<li><span class="tiny muted">${esc(S.fmtShort(c.date))}</span> ${esc(c.text)}</li>`).join('')}</ul>` : '<p class="tiny faint">אין</p>'}</section>${history}`,
    handlers: {
      start: el => startDay(p, +el.dataset.n),
      pause: () => root.UI.confirmSheet('השהיית התוכנית', 'בזמן ההשהיה לא יתוזמנו אימונים. בהמשך, כל הימים שנותרו יידחו בהתאם — שום אימון לא יימחק.', 'השהיה', () => { PS().pause(p.id); root.App.render(); }),
      resume: () => { PS().resume(p.id); root.UI.toast('התוכנית ממשיכה'); root.App.render(); },
      cancel: () => root.UI.confirmSheet('ביטול התוכנית', 'התוכנית תסומן "בוטלה". האימונים שבוצעו והיסטוריית השינויים נשמרים. אפשר לבנות תוכנית חדשה בכל עת.', 'ביטול התוכנית', () => { PS().cancel(p.id); root.App.render(); }, true),
      avail: () => changeSheet(p, 'avail'), equip: () => changeSheet(p, 'equip'), ...Screens.adaptHandlers(p), ...Screens.syncHandlers(), travel: () => Screens.travelSheet ? Screens.travelSheet(p) : root.App.loadChunk('extra.js').then(() => Screens.travelSheet(p), () => root.UI.toast('לא ניתן לטעון כרגע. נסו שוב.')),
      travelOff: el => root.UI.confirmSheet('ביטול מצב נסיעה', 'התרגילים בטווח יחזרו לתוכנית הרגילה. אימונים שכבר נרשמו נשארים כפי שבוצעו.', 'ביטול', () => { try { root.Signature.Travel.revert(el.dataset.id); root.UI.toast('מצב נסיעה בוטל'); root.App.render(); } catch (e) { root.UI.toast(e.message); } }) } };
};
/* ---------- Stage H1: profile ↔ active plan sync ---------- */
const fmtVal = (k, v) => { if (v == null || (Array.isArray(v) && !v.length)) return '—'; if (k === 'goal') return PG().GOALS[v] || v; if (k === 'level') return XP[v] ? XP[v][0] : v; if (k === 'days') return v.map(d => DOW[d]).join(' '); if (k === 'maxMin' || k === 'prefMin') return v + ' דק׳';
  if (k === 'equipment') return v.map(e => CT().EQUIPMENT[e] ? CT().EQUIPMENT[e].he : e).join(', '); if (k === 'exclude' || k === 'fav') return v.length + ' תרגילים'; if (k === 'noJump') return v ? 'כן' : 'לא'; return String(v); };
Screens.syncBanner = function (p, opt) {
  p = p || PS().active(); if (!p) return ''; const d = PS().profileDiff(p.id); if (!d.length) return ''; opt = opt || {};
  const goal = d.find(x => x.key === 'goal');
  return `<div class="banner acc small" data-plan-sync>${icon('info')}<div class="grow"><b>הפרופיל השתנה — התוכנית הפעילה עדיין לפי ההגדרות הקודמות.</b> ${d.map(x => `${esc(x.he)}: ${esc(fmtVal(x.key, x.from))} ← <b>${esc(fmtVal(x.key, x.to))}</b>`).join(' · ')}.
    ${goal ? `<br>יעד התזונה כבר מחושב לפי המטרה החדשה (${esc(PG().GOALS[goal.to] || '')}), אבל האימונים עדיין בנויים למטרה "${esc(PG().GOALS[goal.from] || '')}" עד שתעדכנו.` : ''}
    <div class="btns"><button class="btn sm primary" data-act="syncPlan">עדכון התוכנית…</button>${opt.compact ? '' : '<a class="btn sm ghost" href="#/setup/4">בחירת מסלול אחר</a>'}</div></div></div>`;
};
/* Stage H1: equipment the user declared but the library cannot use yet — said explicitly, never shown as a full plan */
Screens.equipGap = function (p, params) {
  params = params || (p && p.segments[p.segments.length - 1].params); if (!params) return '';
  const unused = (params.equipment || []).filter(e => !libCount(e)); if (!unused.length) return '';
  return `<div class="banner warn small" data-equip-gap>${icon('info')}<div>הציוד שסימנת — <b>${unused.map(e => esc(CT().EQUIPMENT[e].he)).join(', ')}</b> — לא משמש בתוכנית: אין עדיין בספרייה תרגילים עם הציוד הזה. האימונים בנויים מתרגילי משקל גוף${(params.equipment || []).some(e => libCount(e)) ? ' וריהוט ביתי' : ''} בלבד, ולכן התוכנית לא מנצלת את כל מה שזמין לך.</div></div>`;
};
Screens.syncHandlers = function () { return { syncPlan: () => syncSheet(PS().active()) }; };
function syncSheet(p) {
  if (!p) return; const prof = P(), np = PS().paramsFromProfile(prof), miss = PS().missing(np), d = PS().profileDiff(p.id);
  if (miss.length) { root.UI.sheet('עדכון התוכנית', `<p class="small">כדי לעדכן חסר בפרופיל: ${esc(miss.join(', '))}.</p><a class="btn primary" href="#/profile">להשלמת הפרופיל</a>`, {}); return; }
  if (np.spw && np.days.length && np.spw > np.days.length) np.spw = np.days.length;
  const df = PS().diffParams(p.id, np), menu = root.MealPlan && root.MealPlan.pending(p);
  root.UI.sheet('עדכון התוכנית לפי הפרופיל', `<div class="diff" data-sync-diff><h4>מה ישתנה (מיום ${df.fromDay} בתוכנית, ${df.remainingDays} ימים)</h4><ul class="bul small">${d.map(x => `<li>${esc(x.he)}: ${esc(fmtVal(x.key, x.from))} ← <b>${esc(fmtVal(x.key, x.to))}</b></li>`).join('')}</ul>
    <div class="kv small"><span>אימונים בשבוע: <b>${df.before.perWeek} ← ${df.after.perWeek}</b></span><span>אימונים שנותרו: <b>${df.before.sessions} ← ${df.after.sessions}</b></span><span>דק׳ בממוצע: <b>${df.before.avgMin} ← ${df.after.avgMin}</b></span></div>
    ${menu ? '<p class="small">גם התפריט יעודכן ליעדים ולהעדפות הנוכחיים מאותו יום.</p>' : ''}<p class="tiny faint">המסלול (${esc(PG().byId(p.templateId).he)}) נשאר; אימונים שכבר נרשמו, היסטוריה ושיאים לא משתנים. לשינוי מסלול — "בחירת מסלול אחר".</p></div>
    <div class="btns"><button class="btn primary" data-act="ok">אישור העדכון</button><button class="btn ghost" data-act="no">לא עכשיו</button></div>`, {
    ok: (el, e, close) => { try { const f = PS().applyParams(p.id, np, 'עדכון לפי הפרופיל'); if (menu) root.MealPlan.applyChange(PS().get(p.id), 'עדכון לפי הפרופיל'); close(); root.UI.toast('התוכנית עודכנה מיום ' + f); root.App.render(); } catch (x) { root.UI.toast(x.message); } },
    no: (el, e, close) => { close(); root.UI.toast('ההודעה תישאר עד שהתוכנית והפרופיל יתאימו'); } });
}
function startDay(p, n) { const d = PS().dayOf(p, n); if (!d || !PS().isTraining(d)) return; root.Run.start(n, d.type === 'assess' ? 'test' : (d.version || 'std'), { id: p.id, n }); }
function changeSheet(p, kind) {
  const cur = p.segments[p.segments.length - 1].params, np = JSON.parse(JSON.stringify(cur));
  const body = () => kind === 'avail'
    ? `<h4>ימים</h4><div class="chips dows">${DOW.map((d, i) => chip('cdw', i, np.days.includes(i), d)).join('')}</div><h4>אימונים בשבוע</h4><div class="chips">${[1, 2, 3, 4, 5, 6].map(k => chip('cses', k, np.spw === k, k, k > np.days.length ? 'disabled' : '')).join('')}</div><h4>זמן מקסימלי</h4><div class="chips">${[15, 20, 30, 45, 60].map(m => chip('cmax', m, np.maxMin === m, m + '′')).join('')}</div>`
    : `<div class="list">${FURNITURE.concat(OTHER_EQ).map(e => `<button class="li li-btn opt" data-act="ceq" data-v="${e}" aria-pressed="${np.equipment.includes(e)}"><div class="grow"><div class="t">${esc(CT().EQUIPMENT[e].he)}</div><div class="s">${libCount(e) ? libCount(e) + ' תרגילים' : '<span class="warn">אין תרגילים בספרייה</span>'}</div></div></button>`).join('')}</div>`;
  const diffBox = () => { if (!np.days.length) return '<p class="warn small">סמנו לפחות יום אחד.</p>'; if (np.spw > np.days.length) np.spw = np.days.length; const d = PS().diffParams(p.id, np);
    return `<div class="diff"><h4>מה ישתנה (מיום ${d.fromDay}, ${d.remainingDays} ימים)</h4><div class="kv small"><span>אימונים בשבוע: <b>${d.before.perWeek} ← ${d.after.perWeek}</b></span><span>אימונים שנותרו: <b>${d.before.sessions} ← ${d.after.sessions}</b></span><span>דק׳ בממוצע: <b>${d.before.avgMin} ← ${d.after.avgMin}</b></span></div>${d.added.length ? `<p class="tiny">נכנסים: ${d.added.map(x => esc(root.EX_BY_ID[x].he)).join(', ')}</p>` : ''}${d.removed.length ? `<p class="tiny">יוצאים: ${d.removed.map(x => esc(root.EX_BY_ID[x].he)).join(', ')}</p>` : ''}<p class="tiny faint">אימונים שכבר נרשמו לא משתנים.</p></div>`; };
  const H = {
    cdw: el => { const i = +el.dataset.v; np.days = np.days.includes(i) ? np.days.filter(x => x !== i) : np.days.concat(i).sort(); redraw(); },
    cses: el => { np.spw = +el.dataset.v; redraw(); }, cmax: el => { np.maxMin = +el.dataset.v; redraw(); },
    ceq: el => { const e = el.dataset.v; np.equipment = np.equipment.includes(e) ? np.equipment.filter(x => x !== e) : np.equipment.concat(e); redraw(); },
    apply: (el, e, close) => { if (!np.days.length) { root.UI.toast('סמנו לפחות יום אחד'); return; } try { const f = PS().applyParams(p.id, np, kind === 'avail' ? 'שינוי ימים/זמן' : 'שינוי ציוד');
      const prof = P(); if (kind === 'avail') Object.assign(prof.availability, { days: np.days, sessions: np.spw, maxMin: np.maxMin }); else prof.environment.equipment = np.equipment.slice(); saveP(); close(); root.UI.toast('עודכן מיום ' + f); root.App.render(); } catch (x) { root.UI.toast(x.message); } } };
  const sh = root.UI.sheet(kind === 'avail' ? 'שינוי ימים וזמן' : 'שינוי ציוד', `<div id="cs-b">${body()}</div><div id="cs-d">${diffBox()}</div><button class="btn primary" data-act="apply">אישור השינוי</button>`, H);
  /* the sheet binds handlers per element, so re-bind after re-rendering the option buttons */
  function redraw() { const bx = sh.body.querySelector('#cs-b'); bx.innerHTML = body(); sh.body.querySelector('#cs-d').innerHTML = diffBox(); root.UI.bind(bx, Object.fromEntries(Object.entries(H).map(([k, f]) => [k, (el, e) => f(el, e, sh.close, sh.body)]))); }
}


/* ---------- Stage F: adaptive suggestions (rule-based; nothing applies without approval) ---------- */
Screens.adaptCard = function (p, opts) {
  opts = opts || {}; const A = root.Adapt, r = A.proposals(p), hist = opts.history ? A.history(p) : [];
  if (!r.list.length && !r.info && !hist.length && !opts.always) return '';
  const rows = r.list.map(x => `<div class="li adapt-item" data-adapt="${esc(x.key)}"><div class="grow"><span class="pill ${x.rule === 'down' || x.rule === 'recover' || x.rule === 'comeback' ? 'gl' : x.rule === 'up' ? 'good' : 'acc'}">${esc(A.RULE_HE[x.rule])}</span><div class="t">${esc(x.title)}</div><div class="s">${esc(x.why)}</div></div><button class="btn sm" data-act="adaptView" data-k="${esc(x.key)}">פרטים ואישור</button></div>`).join('');
  const hrows = hist.slice(0, 8).map(h => `<div class="li" data-adapt-hist="${h.status}"><div class="grow"><div class="t small">${esc(h.title)}</div><div class="s">${h.status === 'applied' ? 'אושרה' : 'בוטלה'} ב־${esc(S.fmtShort(h.status === 'applied' ? h.appliedOn : h.revertedOn))} · ${esc(A.RULE_HE[h.rule])}${h.keptDays && h.keptDays.length ? ' · ימים שכבר נרשמו נשארו כפי שהם' : ''}</div></div>${h.status === 'applied' ? `<button class="btn sm ghost" data-act="adaptRevert" data-id="${h.id}">ביטול ההתאמה</button>` : ''}</div>`).join('');
  return `<section class="card" data-adapt-card><div class="card-h"><h3>התאמות מוצעות לתוכנית</h3>${r.list.length ? `<span class="pill acc">${r.list.length}</span>` : ''}</div>
    ${r.info ? `<p class="small muted" data-adapt-info>${esc(r.info.text)}</p>` : ''}${rows ? `<div class="list">${rows}</div>` : (!r.info ? '<p class="small muted">אין כרגע הצעות. ההצעות נוצרות מהאימונים שנרשמו בפועל.</p>' : '')}
    ${hrows ? `<h4>התאמות שאושרו</h4><div class="list">${hrows}</div>` : ''}
    <details class="more"><summary>איך זה עובד?</summary><p class="tiny muted">מערכת כללים קבועים — לא בינה מלאכותית. היא בודקת רק את מה שנרשם: סטים וחזרות מול היעד, דירוג המאמץ (1–10), משך האימון, סימוני "קל מדי"/"קשה", אימונים שהוחמצו, האנרגיה שדיווחת היום והחלפות תרגילים. עלייה בעומס מוצעת רק אחרי שני אימונים רצופים ביעד המלא עם מאמץ עד 7/10 — לא רק כי אימון הושלם — ובצעד אחד בלבד. כל התאמה חלה רק על אימונים עתידיים, אחרי אישור, ואפשר לבטל אותה. אימונים שכבר נרשמו לא משתנים.</p></details></section>`;
};
Screens.adaptHandlers = function (p) {
  const A = root.Adapt;
  return {
    adaptView: el => { const x = A.proposals(p).list.find(q => q.key === el.dataset.k); if (!x) { root.UI.toast('ההצעה כבר לא בתוקף'); root.App.render(); return; }
      root.UI.sheet(x.title, `<p class="small">${esc(x.why)}</p><div class="diff" data-adapt-diff><h4>מה ישתנה</h4><ul class="bul small">${x.changes.map(c => `<li>${esc(A.changeText(c, p))}</li>`).join('')}</ul></div>
        <p class="tiny faint">${x.material ? 'שינוי מהותי בתוכנית — ' : ''}חל רק על הימים שברשימה. אימונים שכבר נרשמו לא משתנים, ואפשר לבטל את ההתאמה אחר כך.</p>
        <div class="btns"><button class="btn primary" data-act="ok">אישור ההתאמה</button><button class="btn ghost" data-act="no">לא עכשיו</button></div>`,
        { ok: (b, e, close) => { try { A.apply(x.key); close(); root.UI.toast('ההתאמה אושרה'); root.App.render(); } catch (er) { root.UI.toast(er.message); } },
          no: (b, e, close) => { A.dismiss(x.key); close(); root.UI.toast('ההצעה הוסתרה'); root.App.render(); } }); },
    adaptRevert: el => root.UI.confirmSheet('ביטול ההתאמה', 'הימים העתידיים יחזרו לתכנון שהיה לפני ההתאמה. ימים שכבר נרשמו או עברו לא משתנים.', 'ביטול ההתאמה', () => { try { const r = A.revert(el.dataset.id); root.UI.toast(r.kept.length ? 'בוטל (ימים שנרשמו נשארו)' : 'ההתאמה בוטלה'); root.App.render(); } catch (er) { root.UI.toast(er.message); } })
  };
};

/* ---------- plan day ---------- */
Screens.pday = function (arg) {
  const p = PS().active(), n = +arg; if (!p) { location.hash = '#/plan'; return { title: '', html: '', handlers: {} }; }
  const d = PS().dayOf(p, n); if (!d) return { title: 'לא נמצא', back: '#/plan', html: '<div class="empty">היום לא קיים בתוכנית</div>', handlers: {} };
  const editable = !d.log && (d.movedTo || d.date) >= S.today() && p.status === 'active', train = PS().isTraining(d);
  const vers = train && !['assess'].includes(d.type) ? ['short', 'std', 'long'].map(v => { const x = PL().versioned(PS().days(Object.assign({}, p, { overrides: Object.assign({}, p.overrides, { [n]: Object.assign({}, p.overrides[n] || {}, { version: undefined }) }) })).find(z => z.n === n), v); return `<button data-act="ver" data-v="${v}" aria-pressed="${(d.version || 'std') === v}" ${editable ? '' : 'disabled'}>${PL().VERSION_HE[v]}<small>~${Math.round(x.minutes || 0)} דק׳</small></button>`; }).join('') : '';
  const item = (it, i, sec) => `<div class="li">${Screens.thumb(it.ex)}<div class="grow"><a class="t" href="#/ex/${it.ex}">${esc(root.EX_BY_ID[it.ex].he)}</a><div class="s">${esc(Screens.target(it))}${it.rest ? ' · מנוחה ' + it.rest + ' שנ׳' : ''}${it.adjusted ? ` · <span class="pill gl" data-adjusted>מותאם${it.adjLvl ? ': רמה ' + esc(root.Core.LEVEL_HE[it.adjLvl]) : ''}</span>` : ''}</div></div>${sec === 'main' && editable ? `<button class="btn sm" data-act="swap" data-i="${i}">${icon('swap')} החלפה</button>` : ''}</div>`;
  return { title: 'יום ' + n, back: '#/plan', html: `
    <section class="card"><span class="eyebrow">${esc(S.fmtDate(d.date, true))} · ${esc(d.phase.he)}${d.deload ? ' · שבוע קל' : ''}</span><h2>${esc(d.title)}</h2>
      <div class="kv">${d.minutes ? `<span>~${Math.round(d.minutes)} דק׳ (הערכה)</span>` : ''}<span class="pill ${STATUS_CLS[d.status]}">${STATUS_HE[d.status]}</span>${d.movedTo ? `<span class="pill">הועבר מ־${esc(S.fmtShort(d.plannedDate))}</span>` : ''}</div>
      ${d.notes && d.notes.length ? `<ul class="bul tiny">${d.notes.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      ${vers ? `<div class="seg" role="group" aria-label="גרסה">${vers}</div>` : ''}
      ${d.log ? `<div class="banner info small"><div>נרשם ב־${esc(S.fmtDate(d.log.date))}: ${STATUS_HE[d.log.status]}${d.log.durationSec ? ' · ' + Math.round(d.log.durationSec / 60) + ' דק׳' : ''}${d.log.rpe ? ' · מאמץ ' + d.log.rpe + '/10' : ''}${d.log.notes ? ' · ' + esc(d.log.notes) : ''}. רישום שבוצע לא משתנה כשהתוכנית מתעדכנת.</div></div>` : ''}
      ${train && editable ? `<div class="btns"><button class="btn primary" data-act="start">${icon('play')} התחלת אימון</button><button class="btn" data-act="done">סימון כבוצע</button><button class="btn" data-act="move">העברה ליום אחר</button><button class="btn ghost" data-act="skip">דילוג</button></div>` : ''}
      ${d.status === 'skipped' && !d.log ? '<button class="btn sm" data-act="unskip">ביטול הדילוג</button>' : ''}
      <a class="btn sm ghost" href="#/nutrition/${d.movedTo || d.date}" data-day-menu>${icon('food')} התפריט של היום הזה</a></section>
    ${d.warm && d.warm.length ? `<section class="card"><h3>חימום</h3><div class="list">${d.warm.map((it, i) => item(it, i, 'warm')).join('')}</div></section>` : ''}
    ${d.main && d.main.length ? `<section class="card"><h3>${d.type === 'assess' ? 'מבחנים' : 'אימון'}</h3><div class="list">${d.main.map((it, i) => item(it, i, 'main')).join('')}</div>${d.finisher && d.finisher.length ? `<h4>סיום (אינטרוולים)</h4><div class="list">${d.finisher.map((it, i) => item(it, i, 'fin')).join('')}</div>` : ''}</section>` : `<section class="card"><p class="muted">יום מנוחה.</p></section>`}
    ${d.cool && d.cool.length ? `<section class="card"><h3>שחרור</h3><div class="list">${d.cool.map((it, i) => item(it, i, 'cool')).join('')}</div></section>` : ''}`,
    handlers: {
      start: () => startDay(p, n),
      ver: el => { try { PS().setVersion(p.id, n, el.dataset.v); root.App.render(); } catch (e) { root.UI.toast(e.message); } },
      skip: () => root.UI.confirmSheet('דילוג על האימון', 'האימון יסומן "דילוג". שאר התוכנית לא זזה. אפשר לבטל את הדילוג עד שהיום עובר.', 'דילוג', () => { PS().skip(p.id, n); root.App.render(); }),
      unskip: () => { PS().unskip(p.id, n); root.App.render(); },
      done: () => root.UI.sheet('סימון כבוצע', `<label class="field">סטטוס<select id="dn-st"><option value="done">הושלם</option><option value="partial">חלקית</option></select></label><label class="field">מאמץ (1–10, רשות)<input type="number" id="dn-r" min="1" max="10"></label><label class="field">הערות<textarea id="dn-n"></textarea></label><button class="btn primary" data-act="ok">שמירה</button>`,
        { ok: (el, e, close, b) => { const r = +b.querySelector('#dn-r').value; PS().logDay(p.id, n, { status: b.querySelector('#dn-st').value, version: d.version, rpe: r >= 1 && r <= 10 ? r : null, notes: b.querySelector('#dn-n').value.trim(), source: 'manual' }); close(); root.UI.toast('נשמר'); root.App.render(); } }),
      move: () => root.UI.sheet('העברת אימון', `<label class="field">לתאריך<input type="date" id="mv-d" min="${S.today()}" value="${S.today() > d.date ? S.today() : d.date}"></label><p class="tiny faint">אפשר להעביר רק ליום שאין בו אימון אחר.</p><p class="tiny bad" data-err hidden></p><button class="btn primary" data-act="ok">העברה</button>`,
        { ok: (el, e, close, b) => { try { PS().move(p.id, n, b.querySelector('#mv-d').value); close(); root.UI.toast('הועבר'); root.App.render(); } catch (x) { const m = b.querySelector('[data-err]'); m.textContent = x.message; m.hidden = false; } } }),
      swap: el => swapSheet(p, n, +el.dataset.i) } };
};
function swapSheet(p, n, i) {
  const a = PS().alternatives(p, n, i);
  const html = `<div class="banner info small"><div>נוכחי: <b>${esc(a.current.he)}</b> · קושי ${a.current.d}/3 · ${esc(a.current.eq.join(', ') || 'ללא ציוד')}</div></div>
    ${a.list.length ? `<div class="list">${a.list.map(x => `<div class="li"><div class="grow"><div class="t">${esc(x.he)}</div><div class="s">קושי ${x.d}/3 · ${esc(x.eq.join(', ') || 'ללא ציוד')} · ${esc(x.primary.join(', '))}</div>${x.diffs.length ? `<div class="tiny warn">${x.diffs.map(esc).join(' · ')}</div>` : '<div class="tiny good">ללא הבדל מהותי</div>'}<div class="btns"><button class="btn sm" data-act="day" data-id="${x.id}">רק ביום הזה</button><button class="btn sm ghost" data-act="fut" data-id="${x.id}">מעכשיו והלאה</button></div></div></div>`).join('')}</div>` : `<p class="warn small">${esc(a.reason)}</p><p class="tiny faint">לא מוצעים תרגילים או סרטונים שאינם בספרייה.</p>`}${a.hiddenByEquipment.length ? `<p class="tiny muted">עם ציוד נוסף היו זמינות גם: ${a.hiddenByEquipment.map(esc).join(', ')}.</p>` : ''}`;
  root.UI.sheet('החלפת תרגיל', html, { day: (el, e, close) => { PS().swap(p.id, n, i, el.dataset.id, 'day'); close(); root.UI.toast('הוחלף ביום הזה'); root.App.render(); },
    fut: (el, e, close) => { PS().swap(p.id, n, i, el.dataset.id, 'future'); close(); root.UI.toast('הוחלף מיום ' + n + ' והלאה'); root.App.render(); } });
}
})(window);
