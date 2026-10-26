# SoFitGo — Release Candidate, 26.10.2026

**Status:** a release candidate, verified locally on commit `de385b3` (build `57f33cce03`): **91/91 suites, 0 failed** (§8).
- **Not production-ready yet:** the live site still serves an older build, and the critical flows have not been checked on the live site.
- **Pushed earlier** to `origin/fix/default-cuisine` (approved): 49ce1e9..fedaf61 (23 commits).
- **Local only:** the commits after that, `fedaf61..HEAD`, are waiting for push approval.

## 1. What the product now does — the core journey
| Area | What works (built and tested) |
|---|---|
| **Onboarding and profile** | Profile, goals, availability and equipment. Equipment can be saved per place (home / gym / work / hotel) (SLL-17). Every settings change goes to a change log (SLL-42). |
| **Workouts** | 30-day program and personal plans. Versions: minimum (~5 min, logged as partial), short, regular and long (SLL-02). Adaptive proposals, swaps, travel mode. Workout by feeling, from energy, desired feel and place in one step (SLL-19 / SLL-01). |
| **My day** | "היום שלי": minimum / balanced / full for today, with undo (SLL-13). |
| **NOW card** | Contextual shortcuts (SLL-33): "5 minutes" from 17:00, the shopping day, evening water, tomorrow's workout. In-app reminders with quiet hours (SLL-21). Coach tone: regular / brief / encouraging (SLL-37). |
| **Plan B** | Signals already on the device, plus an optional "מה יש לך היום?", which recommends an existing version (SLL-07). |
| **Nutrition** | Menu engine with restrictions. Budget mode (relative cost only, SLL-16). Provenance labels everywhere (SLL-28). |
| **Shopping** | Alternatives for an item not found. "Usually at home". Carry-over of items not bought. Shopping day. Cost mix (SLL-08 / 16 / 33). Meal prep split into sessions of at most 3 days (SLL-32). Weekly reset (SLL-25). |
| **Fridge** | Fridge-to-meal (SLL-03). Cooked leftovers, safe for 3 days, with dishes that use them (SLL-14). |
| **Progress** | Weekly review: facts / interpretation / what got in the way (SLL-20). Life Score with every formula (SLL-10). Friction radar (SLL-12). Personal patterns, by consent (SLL-06 / 11). User-controlled experiments (SLL-29). |
| **Travel and offline** | Travel hub. Offline pack of photos, tested with a real outage (SLL-24). Data-saving mode (SLL-35). |
| **Settings, privacy, accessibility** | Preference presets (SLL-40). The change log. Privacy center, backup and restore. Accessibility sweep of 30 screens in Hebrew RTL and English LTR. 44 px touch targets for provenance labels. Double-tap guards. |

**SLL totals: 28 verified-complete · 9 partial · 1 missing · 5 blocked · 0 broken (43 in total).**

## 2. Important bugs fixed in this release
- **Workout by feeling:** the one-tap build re-read the form on screen and overwrote level and no-jump (SLL-19).
- **Intermittent layout failure:** a provenance label measured 39.98 px at iPad widths. The tap area is now 44 px, and the test measures unrounded sizes.
- **Found by the milestone regression on 803bbe0 (89/91), both fixed:**
  - First load was over budget (822,394 B > 820,000). Friction Radar and Life Score moved to the on-demand chunk → 816,448 B.
  - Any display change first logged a spurious "סגנון המאמנת" entry.
- **Earlier on 26.10:**
  - meal-prep batches spanning up to 14 days (food safety);
  - a double tap on "הוספה" deleting the new item;
  - five fields without labels;
  - the weekly-reset undo writing an untouched store;
  - offline-pack sizes stripped by the build;
  - the `e2e_food_global` timestamp false positive, with its root cause proven.

## 3. Remaining — partial, missing or blocked
| SLL | Item | Why it is not done |
|---|---|---|
| 02 | Minimum Mode (partial) | 1 / 3 / 8-minute variants and a professional review of the minimum format |
| 05 | Travel Mode (partial) | flights, festivals and local food need external data |
| 15 | Substitution Graph (partial) | a function / flavour / texture graph is content work |
| 17 | Equipment Passport (partial) | exercises for more equipment (content) |
| 18 | Quiet & Small-Space (partial) | small space needs per-exercise space data (content) |
| 22 | Recovery Choice (partial) | new routines need content review |
| 27 | Accessible Coaching (partial) | captions/audio for coaching text; a real VoiceOver pass on a device |
| 30 | No-Shame Comeback (partial) | load rules need professional review (DR-01) |
| 39 | Safe Stop & Escalation (partial) | escalation guidance beyond workouts needs professional content |
| 38 | Micro-Learning Cards (missing) | sourced content that needs review |
| 04, 09, 23 | Restaurant Copilot, Sofit Memory, Local Food Translator (blocked) | need an AI or translation service: a cost and privacy decision |
| 31 | Shared Household List (blocked) | server-side lists and sharing permissions |
| 36 | Consent-Based Wearables (blocked) | a native app (HealthKit / Health Connect) |

## 4. Known limitations
- **What the tests cover:** they run in Chromium (Playwright) emulating iPhone and iPad sizes. That is not Safari, not a real device and not VoiceOver.
- **Accounts and admin:** tested against the local emulator and Postgres. Production login and owner access have not been verified.
- **English:** a developer preview. Some spoken labels are still in Hebrew.
- **Reminders:** in-app only. Alerts while the app is closed come from the calendar export.
- **First load:** 816,448 B as measured by `e2e_stageA` (budget 820,000 B). The headroom is only about 3.5 KB, so new first-load features must go to the on-demand chunk.

## 5. Verification
See §8.

## 6. Deployment checklist (owner)
1. **Approve the push** of the local commits (`fedaf61..HEAD`) to `fix/default-cuisine`.
2. **Approve building the release site** from that commit into `netlify-next`, and check it there.
3. **Netlify** (iPhone, app.netlify.com → the site):
   - Deploys → **Stop auto publishing**.
   - Site configuration → Build & deploy → Continuous deployment → **Link repository** → GitHub → `shlomihadad1/SoFitGo`.
   - Branch `netlify-live`, build command empty, publish directory `site`.
   - Branch deploys: production branch only. Deploy Previews: None.
   - **Before allowing a deployment, check that the production branch shown is `netlify-live`.**
4. **Approve the move of `netlify-live`** to the checked build. Netlify then builds a deploy that is not published.
5. **Verify** that deploy at its unique URL with the steps in §7, then **Publish deploy**.

## 7. iPhone verification (owner, Safari)
Full list: `docs/PRODUCTION_VERIFICATION.md`.
1. Settings → מידע טכני shows the expected build.
2. Without logging in: the home screen, a workout start, the menu, the shopping list, Plan B and "היום שלי" all work. There is no "ניהול מערכת" button.
3. Log in as the owner: "ניהול מערכת" appears and loads. Don't save anything.
4. Log out: the button disappears, and `#/admin` is blocked.
5. Scroll every main screen: the header and buttons aren't cut off. Airplane mode → reload → the app opens.

## 8. Final verification
| Item | Result |
|---|---|
| Commit tested | `de385b3` (code). The next commit adds only this report (docs). |
| Build | `57f33cce03` |
| Full regression | `bash tools/run_all.sh`: **91/91 suites exit 0**, artcheck 2/2, **27,467 checks passed, 0 failed**. The same commit and build were recorded at the start (09:08 UTC) and the end (09:58 UTC). |
| Previous milestone | 803bbe0: 89/91 → 2 defects found and fixed (see §2) |
| Remote | `fix/default-cuisine` = fedaf61 (the 23 approved commits); `main` / `netlify-live` / `netlify-next` unchanged |
| Live site | unchanged (74bdd9483f) |
