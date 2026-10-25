# Workout session state machine

**Implemented 25.10.2026.** Code: `src/js/run_state.js` (pure, testable) and `src/js/run.js` (the workout runner). Both live in the on-demand chunk `extra.js`; `main.js` holds a small `Run` stub that loads them.

## Single source of truth

The session record in Store `session` (localStorage `fit30.session`) is the only source of truth. The state is **derived** from it by `RunState.of(record)` and is never stored separately.

| State | Derived when |
|---|---|
| `not_started` | No record |
| `ready` | Record exists, step 0, no set logged, no timer or countdown |
| `in_progress` | A set is current (its work timer or countdown may run) |
| `resting` | `rest` timer present |
| `paused` | `paused` (user pause, or parked: "save and exit — continue later") |
| `interrupted` | `hold = 'interrupted'`: the app was closed or reloaded while running (see Recovery) |
| `completed` | `finished`: the summary is shown. **Save** turns it into one log entry and removes the record |
| `abandoned` | Terminal. The user discarded the session; the record is removed and nothing is logged |

## Events and allowed source states

Anything else is ignored: no change, a console warning, and a re-render.

| Event | Allowed from |
|---|---|
| begin (setup sheet "go") | not_started |
| set_done / set_skip | ready, in_progress, resting, paused (completing a set also resumes) |
| rest_end / rest_adjust | resting |
| timer_start | ready, in_progress, resting |
| timer_stop | in_progress |
| navigate (prev / next exercise) | ready, in_progress, resting, paused |
| pause | ready, in_progress, resting |
| resume | paused, interrupted |
| park (save and exit) | any open state except completed |
| finish (summary) | any open state except completed |
| back_to_workout / save | completed |
| discard (abandon) | any open state |
| interrupt (detected on reopen) | ready, in_progress, resting |

## Persistence

- The record is written after every action.
- While the workout is running, a heartbeat writes `seenAt` every 5 s, and again on `visibilitychange` and `pagehide`.
- Timers use absolute end times (`endsAt`), never tick counts. A hidden tab or a throttled timer therefore never changes durations.

## Recovery

On the first open after a page load, if the record was running and `now − seenAt > 60 s`, the session becomes **interrupted**:
- Active time stops at `seenAt`. The time the app was closed is never counted as workout time.
- A running rest or work timer keeps the time it had left.
- No set is marked as done.

The screen explains this, and **resume** continues from the same step. A reload within 60 s continues normally.

**Back from the background without a reload (since 0a3d469).** On `visibilitychange` → visible, on a `pageshow` from the back-forward cache and on the first timer tick, a running session that was last seen more than **15 min** ago (`SUSPEND_MS`, 5× the longest rest offered) is frozen the same way. Before, the return overwrote `seenAt`, so 2 h in the background showed 0:11 → 120:13 (reproduced with a frozen fake clock). Shorter gaps (a screen locked between sets) count as workout time, because people train with the screen locked. The 15-minute value is an implementation choice and can be changed.

Before 25.10.2026, a session reopened 2 h later showed 2 h 5 min of active time (verified in the browser). That defect is now fixed.

Automatic mode keeps its own guard: a work phase noticed more than 4 s late pauses at that set (`hold = 'late'`), which is unchanged.

## Completion and abandonment

**Completion**
- Recorded once. Save is allowed only from `completed`, and a second tap is ignored (`saving` flag), after which the record is gone.
- Where it is written:
  - 30-day program → `workouts.days[n]` (keyed by day);
  - personal plan → `Plans.logDay(id, n)` with a snapshot (keyed by day);
  - Workout Builder → `Builder.logRun` with `runId = 'r' + startedAt` (a duplicate `runId` is refused).

**Abandonment** removes the record and logs nothing. Earlier logs are untouched.

## Network

The runner works entirely on the device; nothing in a workout needs the network.
- The confirmation says where the result is: "במכשיר", or "במכשיר — יישלח לחשבון בסנכרון הבא" when signed in.
- Sync status and pending sections are shown on the account screen and in the Privacy Center.
- If workout mode was never loaded (first use) and there is no connection, a clear message is shown. The service worker precaches it for later offline use.

## Not verified

These cannot be reproduced in a desktop browser and need a device test:
- real screen lock;
- iOS / Android background suspension;
- a device restart.

There is **no background execution**: timers do not run while the app is suspended. On return they are re-evaluated from absolute times.

## Tests

- `tools/run_state_test.js`: background limit (5 min keeps running, 2 h interrupted), derivation, allowed and invalid events, interruption recovery including rest time left, idempotent recovery, short gap, paused and completed records.
- `tools/e2e_run_state.js`:
  - the stub loads on demand;
  - ready → in progress / resting → paused;
  - invalid transitions are ignored;
  - repeated taps;
  - quick reload, and a killed app after 2 h → interrupted with correct time;
  - offline set + save once;
  - discard;
  - first use offline;
  - back from the background after 2 h (interrupted, time not inflated) and after 5 min (keeps counting), simulated.
- `tools/e2e_m11_run.js`: automatic mode, guards, Safe Stop, and the reload rule follows the measured gap.
