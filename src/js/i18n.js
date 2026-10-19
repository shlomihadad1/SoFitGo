/* RC5 · i18n layer (M8, first slice). Strings move here key by key; Hebrew stays the default and the only complete language.
   English is a DEVELOPER PREVIEW (?lang=en) — only the keys below are translated, so it is not offered in the UI yet.
   dir/lang follow the language, so LTR layout can be tested without breaking RTL. */
(function (root) {
'use strict';
const T = {
  he: { 'nav.home': 'בית', 'nav.calendar': 'לוח', 'nav.workouts': 'אימונים', 'nav.nutrition': 'תזונה', 'nav.progress': 'מעקב', 'nav.label': 'ניווט ראשי', 'top.settings': 'הגדרות', 'top.back': 'חזרה', 'now.title': 'עכשיו', 'now.next': 'הצעד הבא', 'now.done': 'כל מה שתוכנן להיום בוצע ✓' },
  en: { 'nav.home': 'Home', 'nav.calendar': 'Calendar', 'nav.workouts': 'Workouts', 'nav.nutrition': 'Nutrition', 'nav.progress': 'Tracking', 'nav.label': 'Main navigation', 'top.settings': 'Settings', 'top.back': 'Back', 'now.title': 'Now', 'now.next': 'Next step', 'now.done': 'Everything planned for today is done ✓' } };
let lang = 'he'; try { const q = /[?&]lang=(en|he)\b/.exec(root.location ? root.location.search : ''); if (q) lang = q[1]; } catch (e) { }
const t = (k, v) => { let s = (T[lang] && T[lang][k]) || T.he[k] || k; if (v) for (const x in v) s = s.replace('{' + x + '}', v[x]); return s; };
root.I18N = { t, get lang() { return lang; }, dir: () => (lang === 'he' ? 'rtl' : 'ltr'), TABLES: T };
})(typeof window !== 'undefined' ? window : globalThis);
