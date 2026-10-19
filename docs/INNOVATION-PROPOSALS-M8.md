# Innovation proposals (M8): reviewed against the existing backlog

**Status vocabulary:**
- **Exists** means it is already in the app.
- **M8** means it was added in this batch.
- **Proposal** means nothing has been built.

**Rules:**
- A proposal never duplicates an existing feature. It extends one.
- Items that need professional content review are marked **REVIEW-GATED**. They are not built until a qualified reviewer signs off.

**Complexity scale:**
- S = 1–2 days
- M = about a week
- L = several weeks, or it needs external work

## Priority order

1. Contextual Shortcuts v2
2. Smart Grocery Loop v3
3. One-Tap Weekly Reset
4. Offline Travel Pack
5. Sofit Flex
6. No-Shame Comeback
7. Recovery Choice
8. Equipment Passport
9. Minimum Mode
10. User-Controlled Sofit Memory

The order favours reliability and reuse of what exists. Items 6–9 wait for review. Item 10 waits for D-4.

| # | Concept (backlog id) | Already in the app | User problem | Expected benefit | Complexity | Dependencies | Privacy / safety | Acceptance criteria |
|---|---|---|---|---|---|---|---|---|
| 1 | **Contextual Shortcuts v2** (INN-33) | NOW card with 4 shortcuts. **M8:** travel shortcut, coach link | The right action depends on time of day and state, and the user has to hunt for it | One-tap path to the likely next action | S | NOW model (exists) | None. Rules are local; no tracking | Shortcuts change only with stored state or the local clock. Every shortcut opens an existing working screen. `e2e` proves no shortcut changes data on its own |
| 2 | **Smart Grocery Loop v3** (INN-08) | Grocery v2: at home / not found / bought; user items | "Not found" items stay a dead end; the list doesn't learn what is usually at home | Fewer wasted purchases; faster lists | M | Grocery v2; substitution table (INN-15) | Local only. No prices are invented (INN-16 rule) | A "not found" item offers 1–3 swaps from the existing swap data, each showing the macro change. "Usually at home" needs 2 confirmations and can be undone. Custom items are never removed |
| 3 | **One-Tap Weekly Reset** (INN-25) | Weekly review screen | Monday starts with a stale plan and leftover checks | A clean week in one step, with a preview | S–M | Review screen; grocery clear; plan adapt suggestions | Shows exactly what will change. Nothing changes without a tap. Undo is available | The preview lists every change. After applying, the journal and history are untouched. Undo restores the prior state byte for byte (test compares storage) |
| 4 | **Offline Travel Pack** (INN-24) | **M8:** offline readiness check in the travel hub (real cache inspection) | Users don't know whether workout videos and the app will work on a flight | Confidence before travel; tutorials available offline | S–M | Media cache (`fit30-media-v1`); travel hub | Storage use is shown before downloading. Nothing is fetched without a tap | "Prepare" downloads only the selected tutorials and reports the size. The check reports "ready" only when the files are found in the cache. Works with networking off (Chromium plus a device test) |
| 5 | **Sofit Flex** (INN-01) | 15/30/60-minute versions, exercise swap, low-energy suggestion | "I have 12 minutes and a bad knee", with no single place to say so | A day adjusted in one step, using existing versions and swaps | M | Equipment model (TD-03), adapt engine | Swaps only to exercises already in the library. No new loads | Every adjusted day shows a diff before applying. Load never increases. Undo works. Covered by `load_guard_test` |
| 6 | **No-Shame Comeback** (INN-30) | Adapt R-DOWN after gaps | After a break, users face the same load and stale streaks, and drop out | Gentle re-entry with no guilt language | M | Adapt engine | **REVIEW-GATED:** the return-to-training load rules need a coach or physio to review them (DR-01). Copy review for no-shame language | The return after N days is preview-only until the user accepts. Copy has no "missed" or "failed" wording. The load reduction follows reviewed rules |
| 7 | **Recovery Choice** (INN-22) | Rest-day guidance | On rest days users don't know what is useful | Choose rest, a walk or mobility, all counted as legitimate | S | Existing mobility content | **REVIEW-GATED** for any new routine. Existing mobility days only, until review | A choice never marks a workout as done. A rest day never lowers any score. Text says rest is part of training |
| 8 | **Equipment Passport** (INN-17/18) | Plan setup equipment list; travel no-equipment swaps | The equipment differs by place (home, hotel, gym) | Plans adapt per place without re-setup | L | Exercise equipment metadata (TD-03), swap graph | **REVIEW-GATED:** new substitutions need exercise-content review | Switching place shows the diff. Only reviewed substitutions are offered. Location is a user-chosen place, **never detected** |
| 9 | **Minimum Mode** (INN-02) | Short version (about 15 min) | On the worst days even 15 minutes is too much | A 1/3/5/8-minute floor that still counts | M | Partial-completion logging | **REVIEW-GATED:** micro-workout content and the claims about its value need professional review (DR-03) | Logged as "minimum" (its own label, not "done"). No health claims. Content approved before shipping |
| 10 | **User-Controlled Sofit Memory** (INN-09) | None | Users repeat their preferences, injuries and dislikes | Coaching that remembers what the user chose to share | L | **D-4** (real AI service and budget), consent model (DAT-6) | Sensitive data. Opt-in per item, visible list, delete one or all, local by default. No medical data without explicit consent | Every remembered item is user-entered and visible. Deletion is immediate and verified. Nothing is used before consent. Works with no AI at all (rule-based use first) |

## Not proposed (already covered, or blocked)

- **Restaurant Copilot, Local Food Translator, Shared Household List.** They need external data, an AI or accounts (D-4, M15).
- **Live chat with Sofit.** It needs a real AI service (D-4). Until then the coach screen shows chat as unavailable. No simulated replies.
