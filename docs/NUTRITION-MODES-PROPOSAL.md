# M11 — Nutrition modes: what exists, and a practical rebalancing proposal

Status: **PROPOSAL.** No recipe was deleted or changed, and no mode selector is live.

## Facts (counted from `src/data`, 19 Oct 2026)

**The recipe pool:** 144 recipes.

| Group | Recipes |
|---|---|
| Indian | 68 |
| Himalayan (Himachali 3, Tibetan 2) | 5 |
| Restaurant estimates | 4 |
| International | 21 |
| Mexican | 9 |
| Middle-Eastern | 7 |
| American | 6 |
| Mediterranean | 6 |
| Asian | 6 |
| Israeli | 5 |
| Italian | 5 |
| Greek | 1 |
| Moroccan | 1 |

**What decides the menu today:**
- **Personal plans:** the menu generator (`mealplanner.pool`) uses every non-restaurant recipe that fits the user's restrictions, allergies, prep time and meals per day. It never uses location, nationality or culture; there is no geolocation code. But because half the pool is Indian, the menus lean Indian.
- **The classic 30-day program:** a fixed Manali menu (`NUTRI.MENU`), the product's original purpose.

## The three modes (brief §8)

| Mode | Default? | How it is chosen | What it may use | Status |
|---|---|---|---|---|
| **A. Base menu** | Yes | Always, unless the user picks another mode | Goal, targets, activity, preferences, allergies, prep time, equipment, budget class. **Never** location or culture | PARTIAL — engine exists, pool is skewed |
| **B. Destination / travel menu** | No | User picks a destination or turns on Travel Mode | Only real, locally available ingredients for that destination, with substitutions | MISSING — needs curated destination data |
| **C. Restaurants** | No | User explicitly opens restaurant mode for a destination or an approved location | Real places and menus (an external source), clearly labelled as verified or estimated | BLOCKED — external data source and cost (M15) |

**Rule for all three:** switching or leaving a mode never rewrites the base menu or the journal. Test: changing the destination leaves `MealPlan` output for the base mode byte-identical.

## Rebalancing proposal for A (needs D-1, plus a nutrition review)

1. **Keep every recipe.** Tag the Manali/Indian set as available in a future **"Manali / India" destination pack** for mode B, as well as staying in the base pool where it fits.
2. **Make the base pool cuisine-neutral by default.** The target is roughly even meal coverage across cuisine families. It should come from **new** recipes in the under-represented families, not from deleting anything:

   | Slot | Under-represented families |
   |---|---|
   | Breakfast | Mediterranean, generic "everyday" |
   | Lunch / dinner | Mediterranean, Asian, Latin |
   | Snack | Mixed |

   Estimate: about 40–60 new recipes.
3. **Optional per-user preference:** "favourite cuisines" (multi-select). This is chosen by the user and never inferred.
4. **Every new recipe** passes `tools/recipe_gate.js` (0 FAIL), the content tests (ingredient amounts, allergens) and the menu-quality tests (stageC / H1). Nutrition values are computed from the food database; they are not typed in.
5. **Quality first:** a dietitian reviews the base-pool principles (portion caps, protein distribution) before release. The app keeps saying "estimates".

**Work estimate:** recipe writing and data entry (largest), a cuisine-family field, a pool-weighting change in `mealplanner.pool`, plus tests. **Nothing ships before D-1.**
