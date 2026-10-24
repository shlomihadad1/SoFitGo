/* Stage C: personal daily menus for the active plan (7–365 days, any length).
   Deterministic: the menu for every date is generated in sequence from the plan's first date, so a given date always
   gets the same meals for the same settings. Settings (targets, preferences, meals per day, prep time) are stored in the
   plan as dated segments: a change applies from a chosen date onward, never to earlier dates.
   Eating history is separate (nutrition.log by date) and is never touched here.
   Portions: weighable ingredients are scaled toward the user's calorie target; foods counted in units (eggs, slices,
   tortillas) keep the recipe amount so the preparation steps stay correct. Protein is then raised within per-food caps
   (same caps as the base menu). Remaining gaps are reported, not hidden. */
(function (root) {
  'use strict';
  const N = () => root.NUTRI, L = () => root.Logic, C = () => root.Core, S = () => root.Store, PS = () => root.Plans;
  const VERSION = 1;
  const GAP = { m1: 4, m2: 6, snack: 3 }; /* minimum days before the same recipe returns in a slot (when the pool allows) */
  const SLOTS3 = ['m1', 'm2', 'snack'];
  /* Nutrition DB v2: a dish keeps an ordinary serving — portions may move only between ×0.75 and ×1.35 of the recipe (BDA portion
     guidance); the day reaches its target by choosing whole dishes (2–3 meals as the user set + up to 2 snacks when needed), and a
     remaining shortfall is shown as a real gap instead of an oversized plate. */
  const LO = 0.75, HIof = T => Math.min(1.6, Math.max(1.35, (T || 2000) / 2000 * 1.15)); /* the upper limit grows with the energy need: a recipe serving is sized for an ordinary ≈2,000 kcal day (food-labelling reference), so a 3,000 kcal day may use up to ×1.6 servings — never more */
  const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const r5 = g => Math.max(5, Math.round(g / 5) * 5);

  /* recipes usable for these preferences; a recipe whose only conflicts are removable sides gets substitutes */
  function pool(params) {
    const pf = C().normPrefs(params.prefs), bl = C().blockedFoods(pf), out = { m1: [], m2: [], snack: [], extra: [], notes: [] };
    const fav = new Set((S().load('nutrition').favorites) || []), dis = new Set(params.dislike || []);
    for (const r of N().RECIPES) {
      if (r.est || r.archived || dis.has(r.id) || !out[r.meal]) continue; /* archived through the CMS: kept for history, not offered */
      const cs = C().conflicts(r, null, pf); let ov = null;
      if (cs.length) { if (!cs.every(c => c.side)) continue; ov = {}; let ok = true; cs.forEach(c => { const sub = C().subFor({ f: c.f, g: c.g }, pf); if (sub && !bl.has(sub.f)) ov[c.idx] = sub; else ok = false; }); if (!ok) continue; }
      const m = L().recipeMacros(r, 1, ov);
      /* Stage H1: calorie capacity = the most this dish can reach within the same portion caps portion() uses
         (unit foods fixed). Used only to avoid choosing dishes that cannot reach a high target. */
      const capK = L().recipeIngredients(r, ov).reduce((s, x) => { const f = N().FOODS[x.f]; const g = f.unit ? x.g : Math.min(capOf(x.f), x.g * HIof(params.kcal)); return s + f.k * g / 100; }, 0);
      out[r.meal].push({ r, ov, fav: fav.has(r.id), min: (r.prep || 0) + (r.cook || 0), protein: mainProtein(r), dens: m.k ? m.p / m.k * 100 : 0, capK });
    }
    /* cuisine & library. Default (no explicit cuisine): the v2 Mediterranean/Israeli library only (enough dishes per slot for the
       no-repeat rule, else other non-Indian dishes, else everything safe). Explicit cuisine (M10.4): keep dishes of the chosen
       cuisines from both libraries (v2 preferred in scoring); if too few, other safe dishes are added and the menu says so. */
    const cset = C().cuisineSet(params.prefs), explicit = (params.prefs.cuisines || []).length || (params.prefs.region && params.prefs.region.consent && params.prefs.region.group);
    const ind = C().CUISINE_GROUPS.indian ? new Set(C().CUISINE_GROUPS.indian.codes) : new Set();
    SLOTS3.concat('extra').forEach(k => {
      out[k].forEach(c => { c.cuOk = !cset || cset.has(C().cuisineOf(c.r)); c.cuMain = cset ? C().cuisineMainOk(c.r, params.prefs) : false; c.legacy = k !== 'extra' && !c.r.v2; });
      if (k === 'extra') { if (cset) { const ok = out[k].filter(c => c.cuOk); if (ok.length >= (explicit ? 1 : 2)) out[k] = ok; } return; }
      const enough = GAP[k] + 1;
      if (!explicit) { const v2 = out[k].filter(c => c.r.v2 && c.cuOk), nonInd = out[k].filter(c => !ind.has(C().cuisineOf(c.r)));
        out[k] = v2.length >= enough ? v2 : nonInd.length >= enough ? nonInd : out[k]; }
      else if (cset) { const ok = out[k].filter(c => c.cuOk); if (ok.length >= 3) out[k] = ok; else out.notes.push(`אין מספיק מנות מהמטבח שבחרת ל"${C().slotNames[k]}" (${ok.length}) — נוספו גם מנות ממטבחים אחרים, והן מסומנות בתפריט.`); } });
    if (params.maxPrep) SLOTS3.forEach(k => { const quick = out[k].filter(c => c.min <= params.maxPrep); if (quick.length >= 3) out[k] = quick; else out.notes.push(`אין מספיק מנות ל"${C().slotNames[k]}" שמוכנות תוך ${params.maxPrep} דק׳ — נכללו גם מנות ארוכות יותר.`); });
    return out;
  }
  const mainProtein = r => { const p = r.ing.filter(x => ['protein', 'legume', 'dairy'].includes(N().FOODS[x.f].grp)).sort((a, b) => N().FOODS[b.f].p * b.g - N().FOODS[a.f].p * a.g)[0]; return p ? p.f : null; };

  function scaleIngs(r, ov, s) { /* returns the full effective ingredient list scaled by s (unit foods unchanged) */
    return L().recipeIngredients(r, ov).map(x => N().FOODS[x.f].unit ? Object.assign({}, x) : Object.assign({}, x, { g: r5(x.g * s) }));
  }
  /* realistic single-serving maxima (g) for scalable protein foods; beyond these a gap is reported instead */
  const CAP = { chicken_breast: 300, chicken_thigh: 280, chicken_mince: 280, turkey: 300, beef_lean: 250, salmon: 220, white_fish: 300, tuna_can: 200, paneer: 200, tofu: 350, soya: 90, greek_yogurt: 400, hung_curd: 350, cottage: 350, curd: 400, milk: 500, soy_milk: 500, black_beans: 350, chickpeas_cooked: 300, edamame: 250, masoor: 130, moong: 130, toor: 130, rajma: 130, chana: 130, kala_chana: 130, besan: 120, sprouts: 300, roasted_chana: 70 };
  /* maxima for everything else in one serving (dry grains/legumes, potatoes, vegetables, fruit, fats) */
  const capOf = f => { if (CAP[f]) return CAP[f]; const x = N().FOODS[f]; if (x.grp === 'fat') return ['oil', 'olive_oil', 'ghee'].includes(f) ? 20 : f === 'avocado' ? 100 : 40; if (x.grp === 'carb') return x.st === 'dry' ? 150 : 450; if (x.grp === 'fruit') return 300; if (x.grp === 'veg') return 300; return 400; };
  const isProt = f => ['protein', 'legume', 'dairy'].includes(N().FOODS[f].grp) && f !== 'ghee';
  /* two scale factors solved together: sp for protein foods (→ protein target), sc for everything else (→ calories).
     Foods counted in units (eggs, slices, tortillas) stay as in the recipe so the steps remain correct. */
  function portion(day, present, T, Pt) {
    const orig = {}; present.forEach(k => { orig[k] = L().recipeIngredients(L().recipe(day.slots[k].rid), day.slots[k].ov); });
    const fixed = new Map(); /* key k:i → grams held fixed (unit foods, or foods that reached their cap) */
    present.forEach(k => orig[k].forEach((x, i) => { if (N().FOODS[x.f].unit) fixed.set(k + ':' + i, x.g); }));
    const P = (Pt || 0) * 1.03, K = T * 0.98, HI = HIof(T); let sp = 1, sc = 1;
    for (let it = 0; it < 4; it++) {
      let Fp = 0, Fk = 0, Pp = 0, Kp = 0, Po = 0, Ko = 0;
      present.forEach(k => orig[k].forEach((x, i) => { const key = k + ':' + i; const m = L().ingMacros(fixed.has(key) ? { f: x.f, g: fixed.get(key) } : x);
        if (fixed.has(key)) { Fp += m.p; Fk += m.k; } else if (isProt(x.f)) { Pp += m.p; Kp += m.k; } else { Po += m.p; Ko += m.k; } }));
      const D = Pp * Ko - Po * Kp; let ok = false;
      if (Pt && Math.abs(D) > 1e-6) { sp = ((P - Fp) * Ko - Po * (K - Fk)) / D; sc = (Pp * (K - Fk) - Kp * (P - Fp)) / D; ok = sp >= LO && sp <= HI && sc >= LO && sc <= HI; }
      if (!ok) { sp = Pt ? (Pp ? (P - Fp - Po) / Pp : 1) : (Kp + Ko ? (K - Fk) / (Kp + Ko) : 1); sp = Math.max(LO, Math.min(HI, sp)); sc = Pt ? (Ko ? Math.max(LO, Math.min(HI, (K - Fk - sp * Kp) / Ko)) : 1) : Math.max(LO, Math.min(HI, sp)); }
      let newly = 0; present.forEach(k => orig[k].forEach((x, i) => { const key = k + ':' + i; if (fixed.has(key)) return; const g = x.g * (isProt(x.f) ? sp : sc), c = capOf(x.f); if (g > c) { fixed.set(key, c); newly++; } }));
      if (!newly) break;
    }
    present.forEach(k => { const r = L().recipe(day.slots[k].rid);
      const ings = orig[k].map((x, i) => { const key = k + ':' + i; if (fixed.has(key)) return Object.assign({}, x, { g: fixed.get(key) }); let g = Math.min(r5(x.g * (isProt(x.f) ? sp : sc)), capOf(x.f)); return Object.assign({}, x, { g }); });
      day.slots[k].ov = toOv(r, ings); });
  }
  const toOv = (r, ings) => { const o = {}; ings.forEach((x, i) => { if (x.f !== r.ing[i].f || x.g !== r.ing[i].g) o[i] = { f: x.f, g: x.g }; }); return Object.keys(o).length ? o : null; };
  const tot = sl => L().roundM(L().sumMacros(Object.values(sl).flatMap(x => L().recipeIngredients(L().recipe(x.rid), x.ov)).map(L().ingMacros)));
  /* TD-21: the day total exactly as displayed — per dish via recipeMacros (= Core.slotMacros, scale 1 for generated slots), then
     summed and rounded (= Core.plannedTotals). */
  const shown = sl => L().roundM(L().sumMacros(Object.values(sl).map(x => L().recipeMacros(L().recipe(x.rid), 1, x.ov))));
  /* the single gap rule (thresholds unchanged: below 93 % / above 107 % of the calorie target; protein short by more than 0.5 g) */
  const gapOf = (t, T, Pt) => { const gp = {}; if (Pt && t.p < Pt - 0.5) gp.p = Math.round(Pt - t.p); if (t.k < T * 0.93) gp.kLow = Math.round(T - t.k); if (t.k > T * 1.07) gp.kHigh = Math.round(t.k - T); return Object.keys(gp).length ? gp : null; };

  /* generate menus for a continuous date range under one parameter set; `state` carries variety history across segments */
  function genRange(params, dates, state, seed) {
    const P = pool(params), mains = params.meals === 2 ? ['m1', 'm2'] : ['m1', 'm2', 'm3'], SN = ['snack', 'snack2'], notes = P.notes.slice(); const out = [];
    const PK = k => k === 'm3' ? 'm2' : k === 'snack2' ? 'snack' : k; /* dinner draws on the main-dish pool, the 2nd snack on the snack pool */
    mains.concat('snack').forEach(k => { if (!P[PK(k)].length) notes.push(`אין אף מנה מתאימה ל"${C().slotNames[k]}" עם ההעדפות שנבחרו.`); });
    const T = params.kcal, Pt = params.protein, all = !C().cuisineSet(params.prefs); /* 'מגוון בינלאומי' = the whole library, both generations, no preference */
    const SHARE = params.meals === 2 ? { m1: 0.38, m2: 0.45, snack: 0.1, snack2: 0.1 } : { m1: 0.25, m2: 0.3, m3: 0.27, snack: 0.1, snack2: 0.1 };
    for (const date of dates) {
      const day = { date, slots: {}, notes: [], gap: null, off: {} };
      const used = new Set(), lastOf = k => (state.last[PK(k)] = state.last[PK(k)] || {});
      const shortlist = (k, cand) => { const pk = PK(k), gap = Math.min(GAP[pk], Math.max(0, cand.length - 1)), last = lastOf(k);
        const fresh = cand.filter(c => last[c.r.id] == null || state.i - last[c.r.id] > gap); let list = fresh.length ? fresh : cand;
        /* Stage H1: with a high target, prefer dishes whose capacity (within the portion limits) reaches 75% of the slot's share */
        const nk = T ? T * SHARE[k] * 0.75 : 0; if (nk) { const able = list.filter(c => c.capK >= nk); if (able.length) list = able; else { const any = cand.filter(c => c.capK >= nk); if (any.length) list = any; } }
        return list; };
      const need = Pt && T ? Pt / T * 100 : 0;
      const score = (k, list) => c => (state.use[c.r.id] || 0) * 10 + Math.max(0, need - c.dens) * 8 + Math.max(0, (T ? T * SHARE[k] : 0) - c.capK) / 100 * 4 + (c.protein && c.protein === state.prevProt && k !== 'm1' && list.length > 3 ? 6 : 0)
        - (c.fav ? 3 : 0) + (c.cuOk === false ? 8 : 0) - (c.cuMain ? 2 : 0) + (c.legacy && !all ? 2 : 0) + (hash(seed + date + k + c.r.id) % 1000) / 1000;
      const take = (k, c) => { used.add(c.r.id); state.use[c.r.id] = (state.use[c.r.id] || 0) + 1; lastOf(k)[c.r.id] = state.i; day.slots[k] = { rid: c.r.id, ov: c.ov }; };
      for (const k of mains) {
        const cand = P[PK(k)].filter(c => !used.has(c.r.id)); if (!cand.length) { day.slots[k] = null; continue; }
        const list = shortlist(k, cand), pick = list.slice().sort((a, b) => score(k, list)(a) - score(k, list)(b))[0];
        take(k, pick); if (k !== 'm1') state.prevProt = pick.protein;
      }
      /* snacks: ranked now, added only if the day needs them (fewest snacks that put energy and protein within the rules) */
      const sc0 = P.snack.filter(c => !used.has(c.r.id)), sl = sc0.length ? shortlist('snack', sc0) : [], ranked = sl.slice().sort((a, b) => score('snack', sl)(a) - score('snack', sl)(b));
      const pair = r0 => [r0[0], r0.find(c => r0[0] && c.r.id !== r0[0].r.id && c.protein !== r0[0].protein) || r0[1]].filter(Boolean);
      const dense = sl.slice().sort((a, b) => b.dens - a.dens || score('snack', sl)(a) - score('snack', sl)(b));
      const variants = [pair(ranked), pair(dense)]; let snackPick = variants[0]; /* the denser pair is tried only if the usual one cannot meet protein */
      let present = mains.filter(k => day.slots[k]);
      if (T && present.length) {
        const shortP = t => Pt && t.p < Pt - 0.5, offK = t => t.k < T * 0.93 || t.k > T * 1.07, bad = t => shortP(t) || offK(t);
        const cur = () => tot(Object.fromEntries(present.map(k => [k, day.slots[k]])));
        const mains0 = JSON.parse(JSON.stringify(day.slots)); let best = null;
        for (const sp of variants) { for (let n = 0; n <= sp.length; n++) { if (n === 0 && sp !== variants[0]) continue;
          day.slots = JSON.parse(JSON.stringify(mains0)); for (let i = 0; i < n; i++) day.slots[SN[i]] = { rid: sp[i].r.id, ov: sp[i].ov };
          const pr = mains.filter(k => day.slots[k]).concat(SN.slice(0, n)); present = pr; portion(day, pr, T, Pt); const t = cur();
          const cost = Math.abs(t.k - T) / T + (shortP(t) ? (Pt - t.p) / Pt * 2 : 0);
          if (!bad(t)) { best = { n, sp, ok: true, slots: JSON.parse(JSON.stringify(day.slots)) }; break; }
          if (!best || cost < best.cost) best = { n, sp, cost, slots: JSON.parse(JSON.stringify(day.slots)) }; } if (best && best.ok) break; }
        snackPick = best.sp; day.slots = best.slots; present = mains.filter(k => day.slots[k]).concat(SN.slice(0, best.n));
        for (let i = 0; i < best.n; i++) { const c = snackPick[i]; used.add(c.r.id); state.use[c.r.id] = (state.use[c.r.id] || 0) + 1; lastOf(SN[i])[c.r.id] = state.i; }
        const base0 = JSON.parse(JSON.stringify(mains0)); for (let i = 0; i < best.n; i++) base0[SN[i]] = { rid: snackPick[i].r.id, ov: snackPick[i].ov }; /* UNSCALED dishes: every portion() call starts from the recipe serving, so limits never compound */
        /* repair: if protein is still short, or calories fall outside ±7%, try other candidates for the snacks, breakfast and
           dinner — denser ones for protein, lighter or richer ones for calories (same shortlist rules) */
        const adopt = (k, c) => { used.add(c.r.id); used.delete(base0[k].rid); state.use[base0[k].rid]--; state.use[c.r.id] = (state.use[c.r.id] || 0) + 1; lastOf(k)[c.r.id] = state.i; delete lastOf(k)[base0[k].rid]; base0[k] = { rid: c.r.id, ov: c.ov }; };
        const tryC = (k, c) => { Object.keys(base0).forEach(x => { day.slots[x] = JSON.parse(JSON.stringify(base0[x])); }); day.slots[k] = { rid: c.r.id, ov: c.ov }; portion(day, present, T, Pt); };
        const fresh = (k, c) => (lastOf(k)[c.r.id] == null || state.i - lastOf(k)[c.r.id] > Math.min(GAP[PK(k)], P[PK(k)].length - 1));
        const order = SN.concat('m1', 'm3', 'm2').filter(x => present.includes(x));
        for (const k of order) { const t0 = cur(); if (!bad(t0)) break;
          const byP = shortP(t0), dir = byP ? -1 : (t0.k < T * 0.93 ? 1 : -1);
          const tried = P[PK(k)].filter(c => !used.has(c.r.id) && fresh(k, c)).sort((x, y) => byP ? (y.dens - x.dens) : dir * (y.capK - x.capK)).slice(0, 6);
          for (const c of tried) { const save = JSON.parse(JSON.stringify(day.slots)); tryC(k, c);
            const t1 = cur(); if (!bad(t1) || (byP && !shortP(t1))) { adopt(k, c); break; }
            day.slots = save; }
        }
        /* fat balance: fat target as computeTargets (25% of energy; carbs are the remainder, so with energy, protein and fat on target
           carbs are too). If fat is >20% off, try other snack / breakfast candidates; keep one only if energy and protein stay within
           the rules AND fat moves clearly closer. */
        { const Ft = Math.round(T * 0.25 / 9 / 5) * 5, fo = t => Math.abs(t.f - Ft);
          for (const k of order.filter(x => x !== 'm3')) { const t0 = cur(); if (fo(t0) <= Ft * 0.2 || bad(t0)) break;
            const tried = P[PK(k)].filter(c => !used.has(c.r.id) && fresh(k, c));
            let bestC = null, bestF = fo(t0) - 3;
            for (const c of tried.slice(0, 12)) { const save = JSON.parse(JSON.stringify(day.slots)); tryC(k, c);
              const t1 = cur(); if (!bad(t1) && fo(t1) < bestF) { bestC = c; bestF = fo(t1); } day.slots = save; }
            if (bestC) { tryC(k, bestC); adopt(k, bestC); } } }
        /* TD-21: stored totals and the gap use the SAME sum the screen shows (C.plannedTotals: each dish rounded, then summed) */
        const t = shown(Object.fromEntries(present.map(k => [k, day.slots[k]])));
        day.totals = t; day.gap = gapOf(t, T, Pt); day.target = { k: T, p: Pt || null };
      } else if (present.length) { if (snackPick[0]) { day.slots.snack = { rid: snackPick[0].r.id, ov: snackPick[0].ov }; present.push('snack'); } day.totals = tot(Object.fromEntries(present.map(k => [k, day.slots[k]]))); }
      ['m3', 'snack', 'snack2'].forEach(k => { if (!day.slots[k] && !(k === 'm3' && mains.includes('m3'))) { day.off[k] = true; delete day.slots[k]; } });
      // optional protein add-on — suggested, never counted until the user selects it
      if (P.extra.length) { const ex = P.extra.slice().sort((a, b) => (hash(seed + date + a.r.id) % 97) - (hash(seed + date + b.r.id) % 97))[0]; day.slots.extra = { rid: ex.r.id, ov: ex.ov }; }
      state.i++; out.push(day);
    }
    return { days: out, notes };
  }

  /* ---------- plan binding ---------- */
  function currentParams() {
    const t = C().targets(), p = C().profile(), pf = C().normPrefs(p.prefs);
    return { kcal: t ? t.kcal : null, protein: t ? t.protein : null, prefs: pf, meals: pf.meals === 2 ? 2 : 3, maxPrep: pf.maxPrep || null, dislike: (p.nutritionDislike || []).slice() };
  }
  const sameParams = (a, b) => JSON.stringify([a.kcal, a.protein, a.prefs, a.meals, a.maxPrep, a.dislike]) === JSON.stringify([b.kcal, b.protein, b.prefs, b.meals, b.maxPrep, b.dislike]);
  /* plans created before Stage C get their nutrition segment (current settings) on first use */
  function ensure(plan) { if (plan && !plan.nutrition) { plan.nutrition = { v: VERSION, segments: [{ fromDate: plan.start, params: currentParams(), at: new Date().toISOString() }] }; S().save('plans'); } return plan; }
  function range(plan) { const ds = PS().days(plan); const first = plan.start, last = ds[ds.length - 1].plannedDate || ds[ds.length - 1].date; return { first, last }; }
  const memo = new Map();
  function menus(plan) {
    ensure(plan); const { first, last } = range(plan);
    const key = JSON.stringify([plan.id, first, last, plan.nutrition.segments, N().RECIPES.length, N().CMS_V || '', (S().load('nutrition').favorites || []).length]);
    if (memo.has(key)) return memo.get(key);
    const segs = plan.nutrition.segments.slice().sort((a, b) => a.fromDate < b.fromDate ? -1 : 1), state = { i: 0, use: {}, last: {}, prevProt: null };
    const byDate = {}; const notes = [];
    for (let i = 0; i < segs.length; i++) {
      const from = segs[i].fromDate < first ? first : segs[i].fromDate, to = i + 1 < segs.length ? S().addDays(segs[i + 1].fromDate, -1) : last;
      if (from > to) continue; const dates = []; for (let d = from; d <= to; d = S().addDays(d, 1)) dates.push(d);
      const g = genRange(segs[i].params, dates, state, plan.id + ':' + i); g.days.forEach(d => { d.seg = i; byDate[d.date] = d; }); notes.push(...g.notes.map(n => ({ seg: i, n })));
    }
    const r = { byDate, notes, first, last }; memo.set(key, r); if (memo.size > 12) memo.delete(memo.keys().next().value); return r;
  }
  /* which plan's menu applies to a date: the active plan from its start, earlier (replaced/cancelled) plans for their own dates */
  function planFor(date) {
    const list = PS().list().filter(p => p.status !== 'draft');
    /* an ended plan covers its dates up to the day before it ended; a replaced plan keeps covering the days until its
       successor starts (switching to a plan that starts tomorrow must not leave today without a personal menu) */
    const endOf = p => { const last = range(p).last; if (!['replaced', 'cancelled', 'completed'].includes(p.status) || !p.endedAt) return last;
      let end = S().addDays(p.endedAt, -1);
      if (p.status === 'replaced') { const nx = list.filter(q => q !== p && (q.activatedAt || '') >= (p.activatedAt || '') && q.start >= p.endedAt).map(q => S().addDays(q.start, -1)).sort()[0]; if (nx && nx > end) end = nx; }
      return end < last ? end : last; };
    const cover = p => date >= p.start && date <= endOf(p);
    const c = list.filter(cover).sort((a, b) => (a.activatedAt || '') < (b.activatedAt || '') ? 1 : -1); return c[0] || null;
  }
  function forDate(date) { if (!root.Plans) return null; const p = planFor(date); if (!p) return null; const m = menus(p).byDate[date]; return m ? Object.assign({ planId: p.id }, m) : null; }
  /* first date whose menu may still change: today unless something was already eaten today */
  function firstOpenDate() { const t = S().today(); return C().entries(t).length ? S().addDays(t, 1) : t; }
  function pending(plan) { ensure(plan); const cur = currentParams(), segs = plan.nutrition.segments, lastSeg = segs[segs.length - 1].params; return sameParams(cur, lastSeg) ? null : { from: lastSeg, to: cur, fromDate: firstOpenDate() }; }
  function summarize(plan, from, days) {
    const m = menus(plan), out = []; for (let d = from, i = 0; i < days; i++, d = S().addDays(d, 1)) if (m.byDate[d]) out.push(m.byDate[d]);
    const n = out.length || 1, avg = k => Math.round(out.reduce((s, x) => s + ((x.totals && x.totals[k]) || 0), 0) / n);
    return { days: out.length, kcal: avg('k'), protein: avg('p'), gaps: out.filter(x => x.gap && x.gap.p).length, distinct: new Set(out.flatMap(x => Object.entries(x.slots).filter(([k]) => k !== 'extra').map(([, v]) => v && v.rid))).size };
  }
  function previewChange(plan) { const pc = pending(plan); if (!pc) return null; const after = JSON.parse(JSON.stringify(plan)); after.nutrition.segments.push({ fromDate: pc.fromDate, params: pc.to }); return { fromDate: pc.fromDate, from: pc.from, to: pc.to, before: summarize(plan, pc.fromDate, 14), after: summarize(after, pc.fromDate, 14) }; }
  function applyChange(plan, label) { const pc = pending(plan); if (!pc) return null; plan.nutrition.segments = plan.nutrition.segments.filter(s => s.fromDate < pc.fromDate); plan.nutrition.segments.push({ fromDate: pc.fromDate, params: pc.to, at: new Date().toISOString() });
    plan.changes = plan.changes || []; plan.changes.push({ at: new Date().toISOString(), date: S().today(), type: 'nutrition', text: (label || 'עדכון יעדי תזונה/העדפות') + ' — התפריט עודכן מ־' + S().fmtDate(pc.fromDate) }); S().save('plans'); return pc.fromDate; }
  /* stand-alone generation (tests, previews) */
  function generate(params, start, days, seed) { const dates = []; for (let i = 0; i < days; i++) dates.push(S().addDays(start, i)); return genRange(params, dates, { i: 0, use: {}, last: {}, prevProt: null }, seed || 'preview'); }

  /* Default daily menu (no active personal plan): generated from the user's targets and preferences with the same engine, in
     deterministic 14-day blocks. History: the parameters in force are kept as dated segments (nutrition.autoSeg) written ONLY when the
     user's targets/preferences actually change (profile save) — never while rendering — so a past day is rebuilt with the parameters
     it was shown with, and a change affects today and later only. */
  const autoMemo = new Map(); let baseline = null;
  const pkey = q => JSON.stringify([q.kcal, q.protein, q.prefs, q.meals, q.maxPrep, q.dislike]);
  function paramsOn(date) { const nu = S().load('nutrition'), seg = nu.autoSeg, today = S().today();
    if (date < today && nu.autoSince && date < nu.autoSince) return null; /* days before this engine was in use keep the menu they had */
    if (!seg || !seg.length || date >= today) return currentParams();
    let cur = null; seg.forEach(x => { if (x.from <= date) cur = x.params; }); return cur || seg[0].params; }
  function autoFor(date) {
    const pr = C().profile(); if (pr.menuMode === 'fixed') return null;
    const params = paramsOn(date); if (!params || !params.kcal || !params.protein) return null;
    if (!baseline) baseline = currentParams();
    const nu = S().load('nutrition'), ed = Math.floor(Date.parse(date + 'T12:00:00Z') / 864e5), a0 = ed - (ed % 14), anchor = new Date(a0 * 864e5).toISOString().slice(0, 10);
    const key = JSON.stringify([anchor, pkey(params), N().RECIPES.length, N().CMS_V || '', (nu.favorites || []).length]);
    let g = autoMemo.get(key); if (!g) { if (autoMemo.size > 40) autoMemo.clear(); g = generate(params, anchor, 14, 'auto' + anchor); autoMemo.set(key, g); }
    const d = g.days.find(x => x.date === date); if (!d) return null;
    return { planId: null, auto: true, slots: d.slots, off: d.off, gap: d.gap, totals: d.totals, target: d.target, notes: g.notes };
  }
  /* record a parameter change (called after the profile is saved) */
  function noteParams() { const np = currentParams(); if (!np.kcal) return; const nu = S().load('nutrition'), seg = nu.autoSeg || [], today = S().today(), last = seg[seg.length - 1];
    if (!last) { if (!baseline || !baseline.kcal || pkey(baseline) === pkey(np)) { baseline = np; return; } nu.autoSeg = [{ from: '2000-01-01', params: baseline }, { from: today, params: np }]; }
    else if (pkey(last.params) === pkey(np)) return; else if (last.from === today) last.params = np; else seg.push({ from: today, params: np }), nu.autoSeg = seg;
    baseline = np; S().save('nutrition'); }
  function hook() { const st = root.Store; if (st && !st._autoWrap) { const sv = st.save; st.save = function (k) { const r = sv.apply(this, arguments);
        if (k === 'profile' || k === 'nutrition') { try { const nu = st.load('nutrition'); if (!nu.autoSince) { nu.autoSince = st.today(); sv.call(st, 'nutrition'); } if (k === 'profile') noteParams(); } catch (e) { /* never block a save */ } } return r; }; st._autoWrap = true; } }
  root.MealPlan = { VERSION, autoFor, hook, pool, generate, currentParams, ensure, menus, planFor, forDate, pending, previewChange, applyChange, summarize, firstOpenDate, gapOf };
})(typeof window !== 'undefined' ? window : globalThis);
