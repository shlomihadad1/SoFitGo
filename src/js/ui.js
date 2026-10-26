/* DOM helpers, icons, sheets, toasts and small SVG charts. */
(function (root) {
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const I = {
  repeat: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
  volume: '<path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/>',
  mute: '<path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M22 9l-6 6"/><path d="M16 9l6 6"/>',
  expand: '<path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
  route: '<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>',
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  dumbbell: '<path d="M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12"/>',
  food: '<path d="M4 3v8a3 3 0 0 0 6 0V3M7 3v18M17 3c-2 2-3 5-3 8h3v10"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  back: '<path d="M9 6l6 6-6 6"/>',
  chev: '<path d="M15 6l-6 6 6 6"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12l5 5L20 7"/>',
  play: '<path d="M7 5l12 7-12 7z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  swap: '<path d="M7 7h12l-3-3M17 17H5l3 3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  star: '<path d="M12 3l2.8 5.8 6.2.9-4.5 4.4 1 6.2L12 17.4 6.5 20.3l1-6.2L3 9.7l6.2-.9z"/>',
  drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  steps: '<path d="M8 3c2 0 3 2 3 5s-1 5-3 5-3-2-3-5 1-5 3-5zM16 9c2 0 3 2 3 5s-1 5-3 5-3-2-3-5 1-5 3-5zM6 15h4v4H6zM14 21h4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  book: '<path d="M4 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4zM20 4h-5a3 3 0 0 0-3 3"/><path d="M20 4v14h-6"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  flame: '<path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-9z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4"/>',
  share: '<path d="M12 3v12M7 8l5-5 5 5M5 14v6h14v-6"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  next: '<path d="M15 6l-6 6 6 6M19 6v12"/>',
  prev: '<path d="M9 6l6 6-6 6M5 6v12"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  phone: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>'
};
const icon = (n, cls) => `<svg class="${cls || ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n] || ''}</svg>`;

function bind(rootEl, handlers) {
  rootEl.querySelectorAll('[data-act]').forEach(el => {
    const act = el.getAttribute('data-act'); const fn = handlers[act];
    if (!fn) { console.warn('no handler', act); return; }
    const ev = (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') && el.type !== 'button' && el.type !== 'checkbox' ? 'change' : 'click';
    el.addEventListener(ev, e => { if (ev === 'click' && el.tagName === 'A' && el.getAttribute('href') === '#') e.preventDefault(); fn(el, e); });
  });
}
/* RC5: optional action button (e.g. "ביטול" to undo the step that was just saved). The action runs at most once. */
function toast(msg, ms, action) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
  if (action) { const b = document.createElement('button'); b.className = 'toast-act'; b.type = 'button'; b.textContent = action.label; b.dataset.toastAct = '1';
    b.addEventListener('click', () => { t.remove(); action.fn(); }, { once: true }); t.appendChild(b); }
  document.body.appendChild(t);
  setTimeout(() => t.remove(), ms || (action ? 6000 : 2400));
}
let sheetStack = [];
function sheet(title, html, handlers, opts) {
  const bg = document.createElement('div'); bg.className = 'sheet-bg';
  bg.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="sheet-h"><h3>${esc(title)}</h3><button class="icon-btn" data-x aria-label="סגירה">${icon('close')}</button></div><div class="sheet-b">${html}</div></div>`;
  const close = () => { bg.remove(); sheetStack = sheetStack.filter(x => x !== bg); if (opts && opts.onClose) opts.onClose(); };
  bg.addEventListener('click', e => { if (e.target === bg) close(); });
  bg.querySelector('[data-x]').addEventListener('click', close);
  document.body.appendChild(bg); sheetStack.push(bg);
  const body = bg.querySelector('.sheet-b');
  if (handlers) bind(body, Object.fromEntries(Object.entries(handlers).map(([k, f]) => [k, (el, e) => f(el, e, close, body)])));
  return { close, body, el: bg };
}
function closeAllSheets() { sheetStack.forEach(b => b.remove()); sheetStack = []; }
/* in-page confirmation (confirm() is not available inside artifacts) */
function confirmSheet(title, text, okLabel, onOk, danger) {
  sheet(title, `<p>${esc(text)}</p><div class="btns"><button class="btn ${danger ? 'danger' : 'primary'}" data-act="ok">${esc(okLabel)}</button><button class="btn ghost" data-act="no">ביטול</button></div>`,
    { ok: (el, e, close) => { close(); onOk(); }, no: (el, e, close) => close() });
}
function ring(val, max, label, sub, color) {
  const r = 36, c = 2 * Math.PI * r, p = max > 0 ? Math.min(1, val / max) : 0;
  return `<svg class="ring" viewBox="0 0 86 86" role="img" aria-label="${esc(label)} ${val} מתוך ${max}"><circle class="bg" cx="43" cy="43" r="${r}"/><circle class="fg" cx="43" cy="43" r="${r}" style="stroke:${color || 'var(--accent)'}" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - p)).toFixed(1)}" transform="rotate(-90 43 43)"/><text x="43" y="44" text-anchor="middle">${esc(label)}</text><text class="sub" x="43" y="58" text-anchor="middle">${esc(sub || '')}</text></svg>`;
}
const meter = (v, max, cls) => `<div class="meter ${cls || ''}"><i style="width:${max > 0 ? Math.min(100, v / max * 100).toFixed(1) : 0}%"></i></div>`;
const dots = (n, max) => `<span class="dots" aria-label="קושי ${n} מתוך ${max}">${Array.from({ length: max }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`;

/* Charts — RTL time axis: oldest on the right */
function niceRange(lo, hi, pad) { if (lo === hi) { lo -= 1; hi += 1; } const p = (hi - lo) * (pad || 0.12); return [lo - p, hi + p]; }
function lineChart(points, opts) {
  opts = opts || {}; const W = 340, H = opts.h || 150, ml = 34, mr = 10, mt = 12, mb = 22;
  if (!points.length) return `<div class="empty">${esc(opts.empty || 'אין עדיין נתונים')}</div>`;
  const xs = points.map(p => p.x), ys = points.map(p => p.y).concat(opts.target != null ? [opts.target] : []);
  const x0 = Math.min(...xs), x1 = Math.max(...xs) === x0 ? x0 + 1 : Math.max(...xs);
  const [y0, y1] = niceRange(Math.min(...ys), Math.max(...ys));
  const X = x => W - mr - (x - x0) / (x1 - x0) * (W - ml - mr), Y = y => mt + (1 - (y - y0) / (y1 - y0)) * (H - mt - mb);
  const ticks = [y0 + (y1 - y0) * 0.1, (y0 + y1) / 2, y1 - (y1 - y0) * 0.1];
  const cls = opts.cls || '';
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.label || 'גרף')}">`;
  ticks.forEach(t => { s += `<line class="grid" x1="${ml}" x2="${W - mr}" y1="${Y(t).toFixed(1)}" y2="${Y(t).toFixed(1)}"/><text x="${ml - 4}" y="${(Y(t) + 3).toFixed(1)}" text-anchor="end">${(opts.fmt || (v => v.toFixed(1)))(t)}</text>`; });
  if (opts.target != null) s += `<line class="tg" x1="${ml}" x2="${W - mr}" y1="${Y(opts.target).toFixed(1)}" y2="${Y(opts.target).toFixed(1)}"/>`;
  const pts = points.map(p => `${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`);
  if (points.length > 1) s += `<path class="ar ${cls}" d="M${pts.join(' L')} L${X(points[points.length - 1].x).toFixed(1)},${H - mb} L${X(points[0].x).toFixed(1)},${H - mb} Z"/><path class="ln ${cls}" d="M${pts.join(' L')}"/>`;
  points.forEach((p, i) => { const last = i === points.length - 1; s += `<circle class="pt ${cls}" cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="${last ? 4.5 : 2.5}"/>`; });
  const lp = points[points.length - 1]; s += `<text x="${X(lp.x).toFixed(1)}" y="${(Y(lp.y) - 8).toFixed(1)}" text-anchor="middle" style="fill:var(--text);font-weight:600">${(opts.fmt || (v => v.toFixed(1)))(lp.y)}</text>`;
  const lbl = opts.xlabels || []; lbl.forEach(l => { s += `<text x="${X(l.x).toFixed(1)}" y="${H - 6}" text-anchor="middle">${esc(l.t)}</text>`; });
  return s + '</svg>';
}
function barChart(bars, opts) {
  opts = opts || {}; const W = 340, H = opts.h || 140, ml = 34, mr = 6, mt = 12, mb = 22;
  if (!bars.length || bars.every(b => !b.v)) return `<div class="empty">${esc(opts.empty || 'אין עדיין נתונים')}</div>`;
  const max = Math.max(...bars.map(b => b.v || 0), opts.target || 0) * 1.12 || 1;
  const n = bars.length, bw = (W - ml - mr) / n;
  const Y = v => mt + (1 - v / max) * (H - mt - mb);
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.label || 'גרף עמודות')}">`;
  [0.5, 1].forEach(f => { const v = max / 1.12 * f; s += `<line class="grid" x1="${ml}" x2="${W - mr}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/><text x="${ml - 4}" y="${(Y(v) + 3).toFixed(1)}" text-anchor="end">${(opts.fmt || (v => Math.round(v)))(v)}</text>`; });
  bars.forEach((b, i) => {
    const x = W - mr - (i + 1) * bw + bw * 0.18, w = bw * 0.64, v = b.v || 0;
    s += `<rect class="bar ${b.cls || opts.cls || ''}" x="${x.toFixed(1)}" y="${Y(v).toFixed(1)}" width="${w.toFixed(1)}" height="${(H - mb - Y(v)).toFixed(1)}" rx="3"/>`;
    if (b.t && (n <= 10 || i % Math.ceil(n / 8) === 0)) s += `<text x="${(x + w / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle">${esc(b.t)}</text>`;
  });
  if (opts.target) s += `<line class="tg" x1="${ml}" x2="${W - mr}" y1="${Y(opts.target).toFixed(1)}" y2="${Y(opts.target).toFixed(1)}"/>`;
  return s + '</svg>';
}
/* units */
const U = {
  w: (kg, u) => u === 'lb' ? +(kg * 2.20462).toFixed(1) : +(+kg).toFixed(1),
  wIn: (v, u) => u === 'lb' ? +(v / 2.20462).toFixed(2) : +v,
  wl: u => u === 'lb' ? 'lb' : 'ק״ג',
  len: (cm, u) => u === 'in' ? +(cm / 2.54).toFixed(1) : +(+cm).toFixed(1),
  lenIn: (v, u) => u === 'in' ? +(v * 2.54).toFixed(1) : +v,
  ll: u => u === 'in' ? 'אינץ׳' : 'ס״מ'
};
/* dish illustration (schematic, not a photo) */
function dishArt(r) {
  const F = root.NUTRI.FOODS; const col = { protein: '#e9b48a', legume: '#c98b4a', carb: '#efe3c2', veg: '#6fbf73', fruit: '#f0c84a', dairy: '#f4f1ea', fat: '#e8b04a' };
  const items = r.ing.filter(x => F[x.f].grp !== 'fat').slice(0, 7); const total = items.reduce((s, x) => s + x.g, 0) || 1;
  let a0 = -Math.PI / 2, seg = '';
  items.forEach(x => { const a1 = a0 + x.g / total * Math.PI * 2; const R = 46, cx = 80, cy = 50; const large = a1 - a0 > Math.PI ? 1 : 0;
    seg += `<path d="M${cx},${cy} L${(cx + R * Math.cos(a0)).toFixed(1)},${(cy + R * Math.sin(a0)).toFixed(1)} A${R},${R} 0 ${large} 1 ${(cx + R * Math.cos(a1)).toFixed(1)},${(cy + R * Math.sin(a1)).toFixed(1)} Z" fill="${col[F[x.f].grp] || '#999'}" opacity=".9" stroke="#12181c" stroke-width="1.5"/>`; a0 = a1; });
  return `<svg viewBox="0 0 160 100" role="img" aria-label="איור צלחת: ${esc(r.he)}"><rect width="160" height="100" fill="#141b20"/><circle cx="80" cy="50" r="52" fill="#20292f"/><circle cx="80" cy="50" r="49" fill="#2a343b"/>${seg}<circle cx="80" cy="50" r="12" fill="#2a343b" opacity=".7"/></svg>`;
}
/* SLL-28 · Data provenance labels — ONE vocabulary for where a number comes from, used everywhere a source is shown.
   srcTag(kind, text?) renders a small label; tapping it (or Enter/Space) explains what the label means, with the full legend.
   The tag is a span with role=button so it can sit inside a link or a label without nesting interactive elements; the tap
   never triggers the surrounding link. Kinds:
     user     — a value you entered yourself
     measured — read from a device or an imported file
     calc     — computed by a stated rule or formula from your own data (targets, plan checks, recipe totals from ingredients)
     est      — an estimate with real uncertainty (general assumptions, ranges, durations)
     rec      — a suggestion; nothing changes until you choose
     none     — no data; nothing is invented */
const TR = (k) => (root.I18N ? root.I18N.t(k) : k);
const SRC = {}; ['user', 'measured', 'calc', 'est', 'rec', 'none'].forEach(k => { Object.defineProperty(SRC, k, { enumerable: true, get: () => [TR('src.' + k), TR('src.' + k + '.why')] }); }); /* labels follow the language (i18n keys src.*) */
function srcTag(kind, text, attrs) { const s = SRC[kind] || SRC.none; return `<span class="pill src-tag src-${SRC[kind] ? kind : 'none'}" role="button" tabindex="0" data-src="${SRC[kind] ? kind : 'none'}"${attrs ? ' ' + attrs : ''} aria-label="${esc((text || s[0]) + ' — ' + TR('src.aria'))}">${esc(text || s[0])}</span>`; }
function srcExplain(kind) { const s = SRC[kind] || SRC.none;
  sheet(TR('src.title'), `<p data-src-explain="${SRC[kind] ? kind : 'none'}"><b>${esc(s[0])}</b> — ${esc(s[1])}</p><h4>${esc(TR('src.all'))}</h4><div class="list">${Object.keys(SRC).map(k => `<div class="li"><div class="grow"><div class="t">${esc(SRC[k][0])}</div><div class="s">${esc(SRC[k][1])}</div></div></div>`).join('')}</div>`); }
try { document.addEventListener('click', e => { const t = e.target && e.target.closest && e.target.closest('[data-src][role=button]'); if (!t) return; e.preventDefault(); e.stopPropagation(); srcExplain(t.dataset.src); }, true);
  document.addEventListener('keydown', e => { if (e.key !== 'Enter' && e.key !== ' ') return; const t = e.target && e.target.closest && e.target.closest('[data-src][role=button]'); if (!t) return; e.preventDefault(); srcExplain(t.dataset.src); }, true); } catch (e) { }
root.UI = { esc, icon, bind, toast, sheet, closeAllSheets, confirmSheet, ring, meter, dots, lineChart, barChart, U, dishArt, SRC, srcTag, srcExplain };
})(typeof window !== 'undefined' ? window : globalThis);
