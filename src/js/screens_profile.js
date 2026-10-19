/* M10 · profile screen (#/profile), moved out of the first load into extra.js — same code as before (first-load size budget).
   Shared section renderers come from screens_plan.js through Screens._pf. */
(function (root) {
'use strict';
const { esc, icon } = root.UI;
const S = root.Store, C = root.Core;
const Screens = root.Screens;
const PG = () => root.PROGRAMS, PS = () => root.Plans;
const { why, chip, P, saveP, err, secBasics, readBasics, secGoal, goalHandlers, secExperience, secAvailability, availHandlers, readTimes, secEquipment, eqHandlers } = Screens._pf;
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

})(window);
