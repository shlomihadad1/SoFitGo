/* RC1 — loaded on demand as help.js (PWA: precached by the service worker; artifact: inlined). */
/* RC1 — help & tutorials (#/help). Text steps always work (also offline); the original screen recording is optional and
   network-only, which is stated on the screen. */
(function (root) {
'use strict';
const { esc, icon } = root.UI; const Screens = root.Screens;
Screens.help = function () {
  const T = root.TUTORIALS || [], TM = root.TUTORIAL_MEDIA || {}, on = root.Media && root.Media.enabled();
  const n = T.filter(t => TM[t.id]).length;
  return { title: 'עזרה והדרכות', back: '#/settings', html: `<section class="card hero"><h2>איך משתמשים ב־${esc(root.FIT30_BRAND || 'כושר 30')}</h2><p class="small muted">${T.length} הדרכות קצרות. לכל אחת הוראות כתובות${n ? `, ול־${n} מהן גם הקלטת מסך מקורית של האפליקציה (ללא קול)` : ''}. צפייה בסרטון דורשת חיבור לאינטרנט — הסרטונים לא נשמרים לשימוש ללא חיבור; ההוראות הכתובות זמינות תמיד.</p></section>
    ${T.map(t => { const m = TM[t.id]; return `<section class="card" data-tut="${t.id}"><h3>${esc(t.t)}</h3><p class="small muted">${esc(t.d)}</p>
      ${m && on ? root.Media.player({ mp4: m.mp4, poster: m.poster, dur: m.dur }, { label: t.t, caption: 'הקלטת מסך מקורית של האפליקציה · ללא קול · דורש אינטרנט', fallback: '<p class="small">ההוראות הכתובות מופיעות מתחת לנגן.</p>' }) : `<p class="tiny faint" data-tut-novideo>${m ? 'הסרטון לא זמין בגרסה הזו של הקובץ.' : 'אין סרטון להדרכה הזו.'} ההוראות הכתובות:</p>`}
      <ol class="small" data-tut-steps>${t.s.map(x => `<li>${esc(x)}</li>`).join('')}</ol>${t.go ? `<a class="btn sm" href="${t.go}">${icon('chev')} למסך</a>` : ''}</section>`; }).join('')}`, handlers: {} };
};
})(window);
