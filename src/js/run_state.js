/* Workout session state machine (on-demand chunk with the runner). ONE source of truth: the session record in Store 'session'
   (localStorage 'fit30.session'); the state is DERIVED from it, never stored twice:
     not_started  no session record
     ready        session created, nothing done yet (step 0, no set logged, no timer running)
     in_progress  a set is current (optionally its work timer / countdown runs)
     resting      a rest timer runs between sets
     paused       paused by the user, or parked ("save and exit — continue later")
     interrupted  the app was closed / reloaded while the workout was running; time stopped at the last moment the app was seen
     completed    summary shown (finished); becomes a log entry on "save" and the session record is removed
     abandoned    the user discarded the session: the record is removed, nothing is logged (terminal, not stored)
   Events and the states they are allowed from (anything else is ignored — logged to the console, never thrown at the user): */
(function (root) {
'use strict';
const STATES = ['not_started', 'ready', 'in_progress', 'resting', 'paused', 'interrupted', 'completed', 'abandoned'];
const ACTIVE = ['ready', 'in_progress', 'resting'];
const ALLOWED = {
  begin: ['not_started'],                                         /* setup sheet "go" → ready */
  set_done: ['ready', 'in_progress', 'resting', 'paused'],        /* completing a set also resumes a paused workout (existing behaviour) */
  set_skip: ['ready', 'in_progress', 'resting', 'paused'],
  rest_end: ['resting'], rest_adjust: ['resting'],
  timer_start: ['ready', 'in_progress', 'resting'], timer_stop: ['in_progress'],
  navigate: ['ready', 'in_progress', 'resting', 'paused'],       /* previous / next exercise */
  pause: ACTIVE, resume: ['paused', 'interrupted'],
  park: ['ready', 'in_progress', 'resting', 'paused', 'interrupted'],
  finish: ['ready', 'in_progress', 'resting', 'paused', 'interrupted'], /* "finish now" → summary */
  back_to_workout: ['completed'], save: ['completed'],
  discard: ['ready', 'in_progress', 'resting', 'paused', 'interrupted', 'completed'],
  interrupt: ['ready', 'in_progress', 'resting'] };
const INTERRUPT_MS = 60000; /* not seen for > 60 s while running → the app was closed or reloaded (a hidden but alive tab keeps updating seenAt) */
function of(s) {
  if (!s) return 'not_started';
  if (s.finished) return 'completed';
  if (s.hold === 'interrupted') return 'interrupted';
  if (s.paused) return 'paused';
  if (s.rest) return 'resting';
  if (s.stepIdx === 0 && !Object.keys(s.log || {}).length && !s.work && !s.cd) return 'ready';
  return 'in_progress';
}
const can = (s, ev) => !!ALLOWED[ev] && ALLOWED[ev].includes(of(s));
/* Recovery on reopen. Running sessions not seen for longer than INTERRUPT_MS are frozen at the last time the app was seen: the
   active time stops there (closed-app time is never counted as workout time), a running rest / work timer keeps what was left,
   and nothing is marked as done. Returns true when the record changed. */
function recover(s, now) {
  if (!s || s.finished || s.paused || s.hold === 'interrupted') return false;
  const seen = s.seenAt || s.lastResume; if (!seen || now - seen <= INTERRUPT_MS) return false;
  const last = Math.max(seen, s.lastResume || seen);
  s.activeMs = (s.activeMs || 0) + Math.max(0, last - (s.lastResume || last)); s.lastResume = null; s.paused = true; s.hold = 'interrupted'; s.interruptedAt = last;
  if (s.rest) s.rest.left = Math.max(0, s.rest.endsAt - last);
  if (s.work) s.work.pausedAt = last;
  s.cd = null; return true;
}
root.RunState = { STATES, ALLOWED, INTERRUPT_MS, of, can, recover };
})(typeof window !== 'undefined' ? window : globalThis);
