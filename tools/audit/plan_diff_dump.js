/* Dumps, for a fixed deterministic matrix of plan inputs, a hash of every generated day list and the full summary.
   Usage: node tools/audit/plan_diff_dump.js <root> > out.json   — run on two copies and compare with plan_diff_compare.js.
   Matrix: (a) all 126 standard cases; (b) 3,000 seeded random cases over every non-classic template (incl. the two that need
   a missing library), levels, goals, 1–6 sessions/week, day sets, 10–120 min, equipment sets, exclusions, no-jump, custom
   lengths 1–365 and pauses. */
const path = require('path'), crypto = require('crypto'), ROOT = path.resolve(process.argv[2]);
for (const f of ['src/js/figure.js', 'src/data/exercises.js', 'src/data/workouts.js', 'src/data/nutrition.js', 'src/data/recipes_intl.js', 'src/data/recipes_med.js', 'src/data/catalog.js', 'src/data/programs.js', 'src/js/logic.js', 'src/js/planner.js']) require(path.join(ROOT, f));
const { PROGRAMS: PG, Planner: P, EXERCISES: EX } = globalThis; const H = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
let seed = 20261018; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648, pick = a => a[Math.floor(rnd() * a.length)];
const T = PG.TEMPLATES.filter(t => !t.classic), cases = [];
for (const t of T.filter(t => !(t.needsLibrary || []).length)) for (const level of ['beginner', 'intermediate', 'advanced']) for (const goal of t.goals) for (const spw of [3, 5])
  cases.push({ t: t.id, o: { start: '2026-10-19', days: t.custom ? 90 : t.days, profile: { level, days: [0, 1, 2, 3, 4, 5, 6], spw, maxMin: 45, equipment: [] }, goal } });
const EQ = [[], ['chair', 'table', 'bench', 'step', 'wall', 'doorframe', 'towel'], ['dumbbells', 'bands', 'pullup_bar', 'gym'], ['chair', 'wall'], ['none']];
const DAYS = [[1, 3, 5], [0, 1, 2, 3, 4, 5, 6], [2, 4], [0, 1, 2, 3, 4, 5], [6], [1, 2, 4, 5]];
for (let i = 0; i < 3000; i++) { const t = pick(T), ex = EX.filter(() => rnd() < 0.05).map(e => e.id);
  cases.push({ t: t.id, o: { start: pick(['2026-10-19', '2026-01-01', '2027-02-28']), days: t.custom ? pick([1, 7, 28, 30, 90, 180, 365]) : undefined,
    profile: { level: pick(['beginner', 'intermediate', 'advanced']), days: pick(DAYS), spw: pick([null, 1, 2, 3, 4, 5, 6]), maxMin: pick([10, 15, 20, 30, 45, 60, 90, 120]), equipment: pick(EQ), exclude: ex, noJump: rnd() < 0.3 },
    goal: pick(t.goals), shifts: rnd() < 0.15 ? [{ fromDay: 1 + Math.floor(rnd() * 20), add: 1 + Math.floor(rnd() * 10) }] : undefined } }); }
const out = cases.map((c, i) => { try { const r = P.build(c.t, c.o); const m = new Map(); r.days.filter(d => d.main && d.type !== 'active').forEach(d => { const k = d.type + ':' + d.main.map(x => x.ex + (x.reps || x.sec) + 'x' + x.sets).join(','); m.set(k, (m.get(k) || 0) + 1); });
  return { i, t: c.t, days: H(JSON.stringify(r.days)), summary: r.summary, summaryMatchesDays: m.size === r.summary.distinctSessions && (m.size ? Math.max(...m.values()) : 0) === r.summary.mostRepeated }; } catch (e) { return { i, t: c.t, err: e.message }; } });
process.stdout.write(JSON.stringify(out));
