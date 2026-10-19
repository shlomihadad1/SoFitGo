/* Stick-figure kinematics for exercise illustrations.
   Angles in degrees: 0 = pointing down, 90 = forward (right), 180 = up, -90 = backward (left).
   Pose: { t: torso angle (hip→shoulder), hd: head offset, a:[nearUpper, nearFore, farUpper, farFore], l:[nearThigh, nearShin, farThigh, farShin], ft:[nearFoot, farFoot] (optional) } */
(function (root) {
  const L = { torso: 52, neck: 15, head: 9, ua: 25, fa: 23, th: 32, sh: 31, foot: 9 };
  const VW = 240, VH = 200, FLOOR = 186;
  const rad = d => d * Math.PI / 180;
  const dir = (a, len) => [Math.sin(rad(a)) * len, Math.cos(rad(a)) * len];
  const add = (p, v) => [p[0] + v[0], p[1] + v[1]];

  function joints(p) {
    const j = {};
    j.hip = [0, 0];
    j.sh = add(j.hip, dir(p.t, L.torso));
    j.head = add(j.sh, dir(p.t + (p.hd || 0), L.neck + L.head * 0.6));
    j.re = add(j.sh, dir(p.a[0], L.ua)); j.rh = add(j.re, dir(p.a[1], L.fa));
    j.le = add(j.sh, dir(p.a[2], L.ua)); j.lh = add(j.le, dir(p.a[3], L.fa));
    j.rk = add(j.hip, dir(p.l[0], L.th)); j.rf = add(j.rk, dir(p.l[1], L.sh));
    j.lk = add(j.hip, dir(p.l[2], L.th)); j.lf = add(j.lk, dir(p.l[3], L.sh));
    const ft = p.ft || [p.l[1] + 90, p.l[3] + 90];
    j.rt = add(j.rf, dir(ft[0], L.foot)); j.lt = add(j.lf, dir(ft[1], L.foot));
    return j;
  }
  function lerpPose(A, B, k) {
    const m = (x, y) => x + (y - x) * k;
    return {
      t: m(A.t, B.t), hd: m(A.hd || 0, B.hd || 0), air: m(A.air || 0, B.air || 0),
      a: A.a.map((v, i) => m(v, B.a[i])), l: A.l.map((v, i) => m(v, B.l[i])),
      ft: (A.ft || B.ft) ? [0, 1].map(i => m((A.ft || [A.l[1] + 90, A.l[3] + 90])[i], (B.ft || [B.l[1] + 90, B.l[3] + 90])[i])) : null
    };
  }
  function bbox(j) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const k in j) { const [x, y] = j[k]; const r = k === 'head' ? L.head : 3; x0 = Math.min(x0, x - r); x1 = Math.max(x1, x + r); y0 = Math.min(y0, y - r); y1 = Math.max(y1, y + r); }
    return { x0, y0, x1, y1 };
  }
  /* Placement: the anchor joint stays fixed. 'snap' = horizontal by hip, vertical so lowest point touches floor (per frame). */
  function placement(ex) {
    const jA = joints(ex.A), jB = joints(ex.B);
    const anc = ex.anchor || 'snap';
    if (anc === 'snap') {
      const bA = bbox(jA), bB = bbox(jB);
      const x0 = Math.min(bA.x0, bB.x0), x1 = Math.max(bA.x1, bB.x1);
      return { mode: 'snap', hx: VW / 2 - (x0 + x1) / 2 };
    }
    // align both frames on the anchor, then center union & put lowest point of frame A on floor
    const off = j => [-j[anc][0], -j[anc][1]];
    const shift = (j, o) => { const r = {}; for (const k in j) r[k] = add(j[k], o); return r; };
    const a = shift(jA, off(jA)), b = shift(jB, off(jB));
    const bA = bbox(a), bB = bbox(b);
    const x0 = Math.min(bA.x0, bB.x0), x1 = Math.max(bA.x1, bB.x1);
    const yLow = Math.max(bA.y1, bB.y1) - 2;
    return { mode: 'anchor', anc, target: [VW / 2 - (x0 + x1) / 2, FLOOR - yLow + (ex.lift || 0)] };
  }
  function place(ex, pl, pose) {
    const j = joints(pose);
    let o;
    const air = pose.air || 0;
    if (pl.mode === 'snap') { const b = bbox(j); o = [pl.hx, FLOOR - b.y1 + 2 - (ex.lift || 0) - air]; }
    else o = [pl.target[0] - j[pl.anc][0], pl.target[1] - j[pl.anc][1] - air];
    const r = {}; for (const k in j) r[k] = add(j[k], o); return r;
  }
  function anchorPoint(ex, pl) {
    if (pl.mode === 'anchor') return pl.target;
    const j = place(ex, pl, ex.A); return [j.hip[0], FLOOR];
  }
  const f1 = n => n.toFixed(1);
  const line = (p, q, cls) => `<line class="${cls}" x1="${f1(p[0])}" y1="${f1(p[1])}" x2="${f1(q[0])}" y2="${f1(q[1])}"/>`;
  function propSvg(pr, ap) {
    const x = ap[0] + (pr.dx || 0), y = FLOOR + (pr.dy || 0);
    switch (pr.type) {
      case 'chair': { const h = pr.h || 36, w = pr.w || 30, flip = pr.flip ? -1 : 1;
        return `<g class="fp-prop"><rect x="${f1(x - w / 2)}" y="${f1(y - h)}" width="${w}" height="5" rx="1.5"/><line x1="${f1(x - w / 2 + 3)}" y1="${f1(y - h + 5)}" x2="${f1(x - w / 2 + 3)}" y2="${y}"/><line x1="${f1(x + w / 2 - 3)}" y1="${f1(y - h + 5)}" x2="${f1(x + w / 2 - 3)}" y2="${y}"/><line x1="${f1(x - flip * (w / 2 - 2))}" y1="${f1(y - h)}" x2="${f1(x - flip * (w / 2 - 2))}" y2="${f1(y - h - 34)}"/></g>`; }
      case 'step': { const h = pr.h || 16, w = pr.w || 46; return `<g class="fp-prop"><rect x="${f1(x - w / 2)}" y="${f1(y - h)}" width="${w}" height="${h}" rx="2"/></g>`; }
      case 'bed': { const h = pr.h || 34, w = pr.w || 70; return `<g class="fp-prop"><rect x="${f1(x - w / 2)}" y="${f1(y - h)}" width="${w}" height="${h}" rx="4"/></g>`; }
      case 'wall': return `<g class="fp-prop"><rect x="${f1(x - 3)}" y="10" width="6" height="${f1(y - 10)}"/></g>`;
      case 'door': return `<g class="fp-prop"><rect x="${f1(x - 4)}" y="16" width="8" height="${f1(y - 16)}"/></g>`;
      case 'towel': return '';
      default: return '';
    }
  }
  function figureSvg(p, extra) {
    const far = 'fp-far', near = 'fp-near';
    return `${line(p.sh, p.le, far)}${line(p.le, p.lh, far)}${line(p.hip, p.lk, far)}${line(p.lk, p.lf, far)}${line(p.lf, p.lt, far)}` +
      `${line(p.hip, p.sh, 'fp-torso')}` +
      `${line(p.hip, p.rk, near)}${line(p.rk, p.rf, near)}${line(p.rf, p.rt, near)}${line(p.sh, p.re, near)}${line(p.re, p.rh, near)}` +
      `<circle class="fp-head" cx="${f1(p.head[0])}" cy="${f1(p.head[1])}" r="${L.head}"/>` + (extra || '');
  }
  function towelSvg(ex, p) {
    if (!ex.towel) return '';
    const [a, b] = ex.towel; return `<path class="fp-towel" d="M${f1(p[a][0])},${f1(p[a][1])} L${f1(p[b][0])},${f1(p[b][1])}"/>`;
  }
  function frameSvg(ex, k) {
    const pl = ex._pl || (ex._pl = placement(ex));
    const pose = lerpPose(ex.A, ex.B, k);
    const p = place(ex, pl, pose);
    return figureSvg(p, towelSvg(ex, p));
  }
  function staticSvg(ex, which) {
    const pl = ex._pl || (ex._pl = placement(ex));
    const ap = anchorPoint(ex, pl);
    const props = (ex.props || []).map(pr => propSvg(pr, ap)).join('');
    const p = place(ex, pl, which === 'B' ? ex.B : ex.A);
    return { props, fig: figureSvg(p, towelSvg(ex, p)) };
  }
  function svgShell(inner, label) {
    return `<svg class="fig" viewBox="0 0 ${VW} ${VH}" role="img" aria-label="${label || ''}"><line class="fp-floor" x1="6" y1="${FLOOR}" x2="${VW - 6}" y2="${FLOOR}"/>${inner}</svg>`;
  }
  /* Mounts an animated illustration into el; returns stop() */
  function mount(el, ex, opts) {
    opts = opts || {};
    const pl = ex._pl || (ex._pl = placement(ex));
    const ap = anchorPoint(ex, pl);
    const props = (ex.props || []).map(pr => propSvg(pr, ap)).join('');
    el.innerHTML = svgShell(`${props}<g class="fp-fig"></g>`, ex.he);
    const g = el.querySelector('.fp-fig');
    const phase = el.querySelector('[data-phase]') || (opts.phaseEl || null);
    const period = ex.period || 2600;
    let raf = 0, t0 = performance.now(), stopped = false;
    const reduce = opts.reduceMotion;
    function draw(now) {
      if (stopped) return;
      let k;
      if (reduce) k = (Math.floor((now - t0) / 1800) % 2) ? 1 : 0;
      else {
        const u = ((now - t0) % period) / period; // 0..1
        // hold at ends: 0-0.15 hold A, 0.15-0.5 move, 0.5-0.65 hold B, 0.65-1 return
        if (u < 0.15) k = 0; else if (u < 0.5) k = (u - 0.15) / 0.35; else if (u < 0.65) k = 1; else k = 1 - (u - 0.65) / 0.35;
        k = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      }
      g.innerHTML = frameSvg(ex, k);
      if (phase) phase.textContent = k < 0.2 ? 'תנוחת התחלה' : k > 0.8 ? 'תנוחת סיום' : 'בתנועה';
      raf = requestAnimationFrame(draw);
    }
    if (opts.still) { g.innerHTML = frameSvg(ex, opts.still === 'B' ? 1 : 0); }
    else raf = requestAnimationFrame(draw);
    return () => { stopped = true; cancelAnimationFrame(raf); };
  }
  root.Figure = { joints, placement, place, mount, staticSvg, svgShell, frameSvg, FLOOR, VW, VH, L };
})(typeof window !== 'undefined' ? window : globalThis);
