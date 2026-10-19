# Screen-by-screen audit and improvements (M8)

**How the screens were checked:**
- Every route in `main.js` (26 screens) was opened in Chromium with iPhone 13 emulation, with an active personal plan.
- Screenshots were taken and compared with the M7 build. Both builds were served locally, and every screenshot is labelled "Chromium emulation, not Safari".
- `e2e_m8` checks every screen automatically for:
  - buttons that have no action (UI.bind "no handler");
  - links to screens that don't exist;
  - page errors;
  - form fields smaller than 16 px.

**Result:** 0 dead buttons, 0 broken links and 0 page errors on all 26 screens.

**Legend:**
- **Fixed** = a defect that M8 confirmed and fixed.
- **Improved** = UX change.
- **OK** = no change needed.
- **Open** = needs an owner decision or a device.

| Screen | Route | M8 finding | Action | Status |
|---|---|---|---|---|
| Home / Dashboard | `#/` | No distinction between consumed and burned calories. Two lime "start workout" buttons stacked (NOW card and plan card). Lime glow on hero cards | Added the "נצרך היום (מהיומן)" (consumed today, from the journal) and "נשרף היום — לא נמדד" (burned today, not measured) block. The burned figure has no number because no source exists, and a link explains what would be needed. The plan card's button became secondary while NOW offers it. Glow removed | **Improved** |
| NOW card | `#/` | No way to reach the coach. No travel shortcut | The avatar and the name "Sofit" link to `#/coach`. Added the "נסיעה / שינוי בלו״ז" (travel / schedule change) chip | **Improved** |
| Sofit coach | `#/coach` (new) | SCR-4 was missing. The concept mockups show a robot that says "Online" | New screen: the approved realistic avatar; a message built from the NOW rules; today's status; links to existing help (Plan B, travel, fridge, review, explain); chat **disabled with the reason** (no AI service, D-4); what Sofit does not do (no credentials, no shame, stop rules) | **New (rule-based)** |
| Travel hub | `#/travel` (new) | SCR-12 was missing. Travel mode was hidden inside the plan screen | New hub: a destination label typed by the user (never detected); plan travel mode (an existing sheet); today's short version or skip; fridge and meal swaps; a **real offline-readiness check** | **New** |
| Plan B | `#/planb` | "I'm travelling" sent users to `#/plan` | Now opens the travel hub. The safe-stop notice stays first | **Improved** |
| Calendar | `#/calendar` | OK | — | OK |
| Workouts | `#/workouts` | OK | — | OK |
| Plan day | `#/pday` | With no day number the screen showed "לא נמצא" (not found) | Opens today's plan day | **Fixed** |
| Active workout | run overlay | At 664 px height the timer sat under the action bar. Two lime buttons ("start timer" and "set done") | The figure shrinks below 760 px height, so the timer is visible without scrolling. "Start timer" became an outline button | **Fixed / Improved** |
| Exercise | `#/ex/<id>` | OK. The figures are original illustrations | — | OK |
| Programs catalog | `#/programs` | **Every title wrapped one word per line**, because the plan calendar's `.pc-h` grid class also matched it (pre-existing since Stage D). The copy said the classic program was active while a personal plan was, and that activation "comes later" although setup already activates plans | Scoped the class. The copy names the real active plan and points to setup. A "פעילה" (active) pill marks the right program | **Fixed** |
| Program detail | `#/program/<id>` | The classic program said "זו התוכנית הפעילה" (this is the active plan) even when another plan was active | The wording depends on the real state | **Fixed** |
| Nutrition journal | `#/nutrition` | Calculations are unchanged. Duplicate marking is already prevented (one entry per slot; tap again to unmark, with undo) | — | OK |
| Recipes | `#/recipes` | The search field was unstyled (`type=search` was missing from the form styles) and under 16 px, so iOS would zoom on focus | Now uses the form style at 16 px or more | **Fixed** |
| Recipe | `#/recipe/<id>` | OK | — | OK |
| Shopping | `#/shopping` | M7 states and user items are kept | — | OK |
| Fridge-to-Meal | `#/fridge` | The search field was unstyled (it rendered as a light-grey browser box) and under 16 px. The results were far below a long chip list | Styled. Added a "נבחרו N · X הצעות" summary (N selected · X suggestions) with a "לתוצאות ↓" button (to results) that moves focus to the results | **Fixed / Improved** |
| Progress | `#/progress` | OK | — | OK |
| Steps and MoveScore | `#/activity` | No explanation of burned calories | Added a card saying the app does not show burned calories and why. Active energy from Apple Health is "not implemented yet" | **Improved** |
| Review / Records / Explain | `#/review`, `#/records`, `#/explain` | OK (lazy chunk) | — | OK |
| Settings / Profile / Targets | `#/settings`, `#/profile`, `#/targets` | Fields at 16 px. Section index works | — | OK |
| Feedback | `#/feedback` | OK. No personal data | — | OK |
| Media / Help / Install | `#/media`, `#/help`, `#/install` | `#/media` moved to the lazy chunk | — | OK |
| Setup | `#/setup/<n>` | OK | — | OK |
| All screens | — | Faint text was below AA. Form-field borders were under 3:1. There was no offline indicator. The bottom nav could float over a focused field on iOS | Token fixes. Offline bar. The nav steps aside while a field has focus | **Fixed / Improved (nav: unverified on device)** |

## Not changed on purpose

- **No invented numbers:**
  - burned calories, heart rate and live AI replies are not shown;
  - no location is detected;
  - no automatic "connected" state is shown.
- **No recipe, nutrition-target or training-content changes.** Those need owner approval and professional review.
- **No new logo or portrait.** The supplied renders are flattened JPEGs, and the mockups show a robot coach. See `docs/ASSET-INVENTORY-M8.md`.
- **No React or Tailwind.** Same vanilla architecture.

## Open, and needs a device or an owner decision

- **Real iPhone:** header, keyboard and nav behaviour, input zoom, offline from the home-screen icon, VoiceOver. See `SAFARI-DEVICE-CHECKLIST.md`.
- **Hosting badge (D-2).**
- **Real HealthKit (D-6 / Mac).**
- **AI chat (D-4).**
- **Final assets.**
