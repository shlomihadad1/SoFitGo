/* M10 · #/install moved out of the first load into extra.js (same code as before; size budget for the account hooks). */
(function (root) {
const { esc, icon } = root.UI; const S = root.Store, C = root.Core; const Screens = root.Screens;
Screens.install = function () {
  const standalone = window.matchMedia && (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone);
  const sw = root.App.swState;
  return { title: 'התקנה באייפון', back: '#/settings', html: `
    <section class="card"><div class="card-h"><h2>מצב נוכחי</h2></div><div class="list">
      <div class="li"><div class="grow">פתוחה כאפליקציה ממסך הבית</div><span class="pill ${standalone ? 'good' : ''}">${standalone ? 'כן' : 'לא'}</span></div>
      <div class="li"><div class="grow">עבודה ללא חיבור (Service Worker)</div><span class="pill ${sw === 'active' ? 'good' : sw === 'unsupported' ? 'bad' : ''}">${sw === 'active' ? 'פעיל' : sw === 'unsupported' ? 'לא זמין בסביבה הזו' : sw === 'pending' ? 'נטען…' : 'לא פעיל'}</span></div>
      <div class="li"><div class="grow">שמירת נתונים מקומית</div><span class="pill ${S.storageOK ? 'good' : 'bad'}">${S.storageOK ? 'פעילה' : 'חסומה'}</span></div></div>
      ${sw === 'unsupported' ? '<p class="small muted">בגרסה שפתוחה עכשיו (דף מתארח בתוך Claude) אין תמיכה ב־Service Worker. גרסת ה־PWA המלאה (קבצי האפליקציה שמתארחים בכתובת משלהם) כוללת עבודה ללא חיבור — ראו את דוח המסירה.</p>' : ''}</section>
    <section class="card"><h2>הוספה למסך הבית ב־Safari</h2><ol class="steps"><li>פתחו את כתובת האפליקציה ב־<b>Safari</b> (לא בדפדפן מתוך אפליקציה אחרת).</li><li>הקישו על כפתור השיתוף ${icon('share')} בסרגל התחתון.</li><li>גללו ובחרו <b>"הוספה למסך הבית"</b> (Add to Home Screen).</li><li>אשרו את השם ולחצו <b>"הוספה"</b>. האייקון יופיע במסך הבית.</li><li>מעכשיו פתחו את האפליקציה מהאייקון. היא נפתחת במסך מלא, בלי סרגלי דפדפן.</li></ol>
      <div class="banner warn small">${icon('info')}<div>באייפון, לאפליקציה שנוספה למסך הבית יש אחסון נפרד מ־Safari. אם כבר הזנתם נתונים ב־Safari, ייצאו גיבוי ושחזרו אותו באפליקציה שבמסך הבית.</div></div></section>
    <section class="card"><h2>מה עובד בלי אינטרנט</h2><ul class="bul small"><li>כל תוכן התוכנית, המתכונים, התרגילים וההדגמות (הכול כלול בקובץ האפליקציה).</li><li>רישום ושמירת נתונים — הם מקומיים ממילא.</li><li>הגופנים נטענים מ־Google Fonts; בלי חיבור יוצגו גופני המערכת.</li></ul></section>` , handlers: {} };
};
})(window);
