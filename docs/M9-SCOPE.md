# M9: proposed sprint scope, priorities, risks and dependencies

**Baseline:** M8 `cfd6df2f65`, plus the M9-prep corrections (build `377aa1b1cb`, see §5).

**Every item below:**
- builds on something that already exists, and is listed with it;
- is local only: no server, no account, no deploy;
- comes with automated tests in Chromium, plus a real-iPhone step where the behaviour depends on WebKit.

**Not in M9, because they need professional review of exercise content:**
- Minimum Mode (INN-02)
- Equipment Passport (INN-17/18)
- No-Shame Comeback load rules (INN-30)
- new Recovery routines (INN-22)
- Sofit Flex load changes (INN-01)

## 1. Prioritised backlog

**Size scale:** S = 1–2 days · M = about a week.

| Prio | Item | Exists today (don't duplicate) | M9 adds | Size | Acceptance criteria |
|---|---|---|---|---|---|
| **P1** | **M9-A11Y: accessibility and usability fixes** | Tokens, focus ring, 44 px targets, reduced motion, `≥16px` fields | (1) "Burned — not measured" gets visually hidden text instead of an `aria-label` on a plain `span` (A11Y-1). (2) **iOS text size:** support the system text-size setting (`-apple-system-body` scaling of `--fs`) as an opt-in, then the default (A11Y-2). (3) Nav labels 11.5 → 12.5 px. (4) Home is about 2,800 CSS px long, so let users collapse lower cards and remember the choice (per viewer) | M | No horizontal scroll at 320–430 px with system text at the largest non-accessibility size. Every control has an accessible name (automated axe-style check plus a VoiceOver step in the device checklist). Collapsing loses no data |
| **P1** | **Contextual Shortcuts v2** (INN-33) | NOW card with 4 fixed chips; next-step rule | The shortcuts are chosen from **state and local time**. Examples: after a logged workout → "log a meal"; evening with water below goal → "+250 ml"; plan day tomorrow → "tomorrow's workout"; empty shopping state on the user's chosen shopping day → "shopping list". At most 4 chips; the rule is shown under "why these?" | S–M | Each shortcut opens an existing working screen. **No shortcut changes data by itself** (test compares storage). Rules are deterministic for a given state and clock (test with a fixed clock). No location, no tracking |
| **P1** | **Smart Grocery Loop v3** (INN-08) | Grocery v2: bought / at home / not found; user items; dedupe; copy; clear keeps user items | (1) A "not found" item offers 1–3 swaps from the existing `SWAP` table, showing the macro difference; applying one uses the existing "swap ingredient" flow. (2) "Usually at home": the user can mark an item; it is suggested after 2 confirmations and can be undone. (3) "Carry over" unbought items to the next range | M | User items are never removed except by explicit delete. A swap shows its macro change before applying. No prices are invented. Undo restores exactly (storage comparison) |
| **P2** | **One-Tap Weekly Reset** (INN-25) | Weekly review screen; grocery clear; adapt suggestions with undo | One "start new week" action on the review screen, with a **preview** of every change: clear grocery checks and states (user items kept); open next week's list; show pending adapt suggestions (not applied automatically); reset NOW. Then **Undo** | S–M | The journal, logs and history are never touched. The preview lists every change. Undo restores storage byte for byte. Nothing is applied without the tap |
| **P2** | **Offline Travel Pack: preparation** (INN-24) | M8 offline readiness check (shell 5/5, image cache count); travel hub | "Prepare for travel": pre-cache the app chunks, recipe and exercise images, and **text versions** of tutorials; show the storage size before starting. **Videos:** the service worker does not cache video today (range requests go to the network). Offline video is a separate, riskier step (§3, R-5) | M (images and text) / M–L (video) | The check reports "ready" only for files actually found in the cache. Size is shown before download. Works with the network off in Chromium. Video is in scope only after a device spike on iOS |
| **P3** | Sofit coach screen v2 | `#/coach` (rule-based, chat unavailable) | Larger hero image **only when a ≥1024 px approved portrait arrives**. Tone stays no-shame | S | Avatar check: no upscaling. Still no AI claims |

**Explicitly not duplicated:**
- Plan B hub, fridge, travel hub, beta feedback, grocery v2 states, MoveScore v0. They already exist and are only extended above.

## 2. Suggested order

1. A11Y fixes (P1). These also protect every later screen.
2. Shortcuts v2.
3. Grocery v3.
4. Weekly Reset.
5. Travel Pack (images and text).
6. Video offline: only if the iOS spike passes.

Each step: build, full suite, re-record tutorials if the UI changed, then package.

## 3. Risks and dependencies

| # | Risk / dependency | Impact | Mitigation / owner action |
|---|---|---|---|
| R-1 | **No real-iPhone evidence yet** (header, keyboard, input zoom, offline, VoiceOver) | Could ship WebKit-only defects | Owner runs `SAFARI-DEVICE-CHECKLIST.md` (about 20 min) on a private HTTPS URL before M9 UI work lands |
| R-2 | **Netlify badge on the public RC4** (D-2) | 3 of 5 tabs blocked for testers | Owner checks the setting (`docs/NETLIFY-BADGE-CHECK.md`). Changing the public site needs explicit approval |
| R-3 | **No private HTTPS preview** for M8/M9 | Device tests can't start | Owner uploads `*-upload.zip` to a private project. I verify anonymous access is refused |
| R-4 | **Brand assets missing** (logo, 1024 icon master, ≥1024 Sofit portraits, rights) | No premium hero imagery; C2 stays provisional | Owner or Gemini delivers them per `docs/ASSET-INVENTORY-M9.md` §4. Nothing is substituted |
| R-5 | **Offline video on iOS** | Service-worker video caching with range requests is fragile in Safari | Spike on a real device first. Fallback: text tutorials offline |
| R-6 | **iOS text-size support** may reflow many screens | Layout regressions | Opt-in first; width tests at 4 sizes; device check |
| R-7 | **First-load budget** (712,000 B; now 700,797 B measured) | About 11 KB headroom | New screens go in `extra.js`; shortcuts and grocery logic stay small |
| R-8 | **Professional review** (DR-01/02/03) | Blocks Flex, Minimum Mode, Comeback, Equipment Passport | Owner engages a coach, physio or dietitian. Items remain proposals |
| R-9 | **AI service** (D-4) | Chat stays unavailable | Owner decides budget and privacy. The UI already shows "unavailable" honestly |
| R-10 | **No source control** (D-3) | History lives only in ZIPs and backups | Owner-owned private repo; push only with approval |
| R-11 | **Apple Health** unverified (Mac, Xcode 26+, Node 22+, bundle id) | Steps stay manual | `native/APPLE-HEALTH-VERIFICATION.md`. Simulator first (no paid account) |
| R-12 | **Safari storage eviction** (TD-15) and **separate storage** between Safari and the Home Screen app | Testers "lose" data | The device checklist §ד tells testers to use the installed app and to back up |

## 4. Recommended next steps

1. **Owner, about 3 minutes:** Netlify badge check. Screenshot the Configure panel; don't save anything yet.
2. **Owner, about 10 minutes:** upload `SoFitGo-RC5-M9prep-377aa1b1cb-upload.zip` to a **private** Netlify project and send me the URL. I verify the 401 or redirect.
3. **Owner, about 20 minutes:** run the device checklist in Safari and in the installed app. Send ✓/✗ and screenshots.
4. **Me, after your go-ahead:** M9 in the order of §2, with tests and packaging. No deploy.
5. **Owner, in parallel:** brand assets (R-4), professional-review contacts (R-8), decision D-4 when ready.

## 5. M9-prep changes (already made, small)

- **App copy fix (honesty):**
  - The offline bar used to say "videos that were not saved won't load". The travel offline check counted cached **images** as "tutorial videos saved offline".
  - The service worker never caches video, so both statements were wrong.
  - Corrected. `e2e_m8` has 2 new checks for this.
- **Docs:**
  - Device checklist rewritten.
  - Stale statements about the M8 keyboard mechanism fixed in `DESIGN-TOKENS.md` and `KNOWN-ISSUES.md`.
  - The VoiceOver expectation in `TEST-RESULTS-M8.md` corrected.
  - `<build>` placeholder filled in `OWNER-NEXT-STEPS-M8.md`.
  - The RC4-era `BETA-INSTALL.md` and `TESTING.md` are marked superseded.
- **New docs:** `docs/NETLIFY-BADGE-CHECK.md`, `docs/ASSET-INVENTORY-M9.md`, this file, and `M9-PREP-REPORT.md`.
