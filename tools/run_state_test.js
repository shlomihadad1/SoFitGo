/* Workout session state machine — unit tests (Node). Usage: node tools/run_state_test.js */
const path = require('path'); require(path.join(__dirname, '..', 'src/js/run_state.js'));
const R = globalThis.RunState; let pass = 0, fail = 0; const ok = (c, m, i) => { if (c) pass++; else { fail++; console.log('FAIL ' + m + (i !== undefined ? ' → ' + JSON.stringify(i) : '')); } };
const base = o => Object.assign({ day: 1, version: 'std', stepIdx: 0, total: 10, log: {}, startedAt: 0, activeMs: 0, lastResume: 1000, seenAt: 1000, paused: false, rest: null, work: null, cd: null, finished: false }, o || {});
/* derivation */
ok(R.of(null) === 'not_started', 'no record → not_started');
ok(R.of(base()) === 'ready', 'new session → ready');
ok(R.of(base({ stepIdx: 1, log: { 0: { done: true } } })) === 'in_progress', 'after a set → in_progress');
ok(R.of(base({ work: { startedAt: 1 } })) === 'in_progress', 'timer running → in_progress');
ok(R.of(base({ stepIdx: 1, log: { 0: {} }, rest: { endsAt: 9 } })) === 'resting', 'rest timer → resting');
ok(R.of(base({ paused: true })) === 'paused' && R.of(base({ paused: true, parked: true })) === 'paused', 'paused / parked → paused');
ok(R.of(base({ paused: true, hold: 'interrupted' })) === 'interrupted', 'interrupted');
ok(R.of(base({ finished: true, paused: true, hold: 'interrupted' })) === 'completed', 'finished wins → completed');
ok(R.STATES.length === 8 && R.STATES.includes('abandoned'), 'eight states documented (abandoned is terminal: record removed)');
/* transitions */
ok(R.can(null, 'begin') && !R.can(base(), 'begin'), 'begin only when nothing is open');
ok(R.can(base(), 'set_done') && R.can(base({ paused: true }), 'set_done') && !R.can(base({ finished: true }), 'set_done'), 'set_done from active/paused, never from completed');
ok(!R.can(base(), 'resume') && R.can(base({ paused: true }), 'resume') && R.can(base({ paused: true, hold: 'interrupted' }), 'resume'), 'resume only from paused / interrupted');
ok(R.can(base(), 'pause') && !R.can(base({ paused: true }), 'pause') && !R.can(base({ finished: true }), 'pause'), 'pause only while active (no double pause)');
ok(R.can(base({ finished: true }), 'save') && !R.can(base(), 'save') && !R.can(null, 'save'), 'save only from completed (no completion without a summary; none twice once the record is gone)');
ok(R.can(base({ stepIdx: 1, log: { 0: {} }, rest: { endsAt: 9 } }), 'rest_end') && !R.can(base(), 'rest_end'), 'rest_end only while resting');
ok(R.can(base({ finished: true }), 'discard') && !R.can(null, 'discard'), 'discard (abandon) from any open state');
ok(!R.can(base(), 'nonsense'), 'unknown event refused');
/* interruption recovery */
{ const s = base({ stepIdx: 3, log: { 0: {}, 1: {}, 2: {} }, activeMs: 300000, lastResume: 1000000, seenAt: 1100000 }); const now = 1100000 + 2 * 3600e3;
  ok(R.recover(s, now) === true && s.hold === 'interrupted' && s.paused && s.lastResume === null, 'closed for 2 h while running → interrupted, paused');
  ok(s.activeMs === 300000 + 100000, 'active time stops at the last moment the app was seen (closed time never counted)', s.activeMs);
  ok(Object.keys(s.log).length === 3, 'nothing marked as done by the recovery');
  ok(R.recover(s, now + 1000) === false, 'recovery is idempotent'); }
{ const s = base({ stepIdx: 2, log: { 0: {}, 1: {} }, rest: { endsAt: 1130000, startedAt: 1090000 }, lastResume: 1000000, seenAt: 1100000 }); R.recover(s, 1100000 + 600000);
  ok(s.rest.left === 30000, 'a rest that was running keeps the time it had left', s.rest); }
{ const s = base({ stepIdx: 1, log: { 0: {} }, lastResume: 1000000, seenAt: 1000000 + 10000 }); ok(R.recover(s, 1000000 + 10000 + 30000) === false && !s.paused, 'a short gap (reload within 60 s) is not an interruption'); }
{ const s = base({ paused: true, activeMs: 5000, lastResume: null, seenAt: 1 }); ok(R.recover(s, 1e12) === false && s.activeMs === 5000, 'a paused / parked session is left as it is'); }
{ const s = base({ finished: true, seenAt: 1 }); ok(R.recover(s, 1e12) === false, 'a completed (summary) session is left as it is'); }
{ const mk = () => base({ stepIdx: 1, log: { 0: {} }, activeMs: 0, lastResume: 1000000, seenAt: 1000000 });
  const a = mk(); ok(R.recover(a, 1000000 + 5 * 60000, R.SUSPEND_MS) === false && !a.paused, 'back from the background after 5 min (screen locked between sets) → keeps running');
  const b = mk(); ok(R.recover(b, 1000000 + 2 * 3600e3, R.SUSPEND_MS) === true && b.hold === 'interrupted' && b.activeMs === 0, 'back from the background after 2 h → interrupted, time stops when it was last seen');
  ok(R.SUSPEND_MS === 15 * 60000 && R.SUSPEND_MS > R.INTERRUPT_MS, 'background limit 15 min (reload limit stays 60 s)'); }
console.log(`run state tests: pass ${pass} fail ${fail}`); process.exit(fail ? 1 : 0);
