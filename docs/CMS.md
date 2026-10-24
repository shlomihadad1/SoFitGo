# SoFitGo Admin CMS

## Status

- **Built and tested only against the local emulator** (real PostgreSQL 16 with RLS):
  - `tools/rls_cms_test.js`: server-side authorization.
  - `tools/e2e_admin.js`: the full flow in the browser (Chromium with iPhone 13 emulation, plus a 1280 px desktop context).
- **Not applied to the live Supabase project.** Applying the migration requires the owner's approval.
- **Media upload is blocked.** It needs a Storage bucket in the live project, which is also an owner decision.

## What can be managed without code

| Area | Actions |
|---|---|
| Recipes and menus | **Create, edit, duplicate**: <ul><li>Hebrew and English name, meal type, cuisine</li><li>ingredients from the food table, with grams</li><li>numbered steps, ingredient swaps, equipment, times, relative cost, filter tags</li></ul> **Nutrition and tags:** <ul><li>nutrition is calculated from the ingredients, never typed in</li><li>diet tags and allergens are derived from the ingredients</li></ul> **Lifecycle:** <ul><li>draft, then publish (with confirmation)</li><li>archive and restore</li><li>history, comparison with the current version, rollback</li></ul> Daily menus are rebuilt automatically from the published dishes, using each user's targets and preferences. |
| Exercises | Edit the instructions of the 57 exercises: name, muscles, start position, steps, direction, end position, breathing, common mistakes, when to stop. Then draft, publish, history and rollback. |
| Media | Read-only inventory: what exists, what is missing, where each asset is used, broken references. **Upload is blocked** (see Status). |
| Roles | The owner grants and revokes admin, editor and reviewer roles by e-mail. Admins can see the member list. |
| Guides | 10 step-by-step guides inside the CMS, plus contextual "?" help next to fields. |
| Settings that need code | Listed in the CMS with the reason for each: <ul><li>target formula</li><li>portion limits</li><li>food table values (only USDA-verified values)</li><li>motion figures and new exercises</li><li>brand</li><li>tutorial videos</li><li>UI texts and translations</li><li>keys</li></ul> |

Before every publish the CMS shows:
- the fields that changed (before and after);
- the known effects, computed by running the real menu engine for 4 sample profiles × 14 days;
- warnings about unrealistic portions or inconsistent values;
- what does **not** change: logged meals, past days, and users who have not reopened the app yet.

## Security (enforced by the server)

| Role | Can do |
|---|---|
| owner | Everything an admin can, plus manage roles. There is no API path that creates an owner; the first owner is added once by hand (see Activation, step 2). |
| admin | Publish, archive, restore, roll back, see the member list |
| editor | Write drafts |
| reviewer | Read drafts and history |

- **Public content:** anyone may read published and archived items in `cms_content`. Writes happen only through SECURITY DEFINER functions that check the caller's role and pin `search_path`.
- **Private tables:** drafts, history and members are readable by members only.
- **No self-grant:** nobody can grant a role to themselves or change their own role.
- **No stale overwrite:** publishing a draft that was based on an older version is refused.
- **No service key:** neither the app nor the CMS uses a service-role key. Every request carries the signed-in user's own token.

## How content reaches users

`src/js/cms_content.js` is part of the first load and works like this:
1. Before the first screen, it applies the last good copy cached on the device. This also works offline.
2. In the background it fetches a fresh copy from `cms_content`. If something changed, it applies it and re-renders.
3. It validates every item with the same rules as the editor. An invalid item is ignored, never half-applied.
4. For each item:
   - A **published** item replaces the built-in item with the same id, or is added as a new one.
   - An **archived** item stays resolvable (for history and logged meals) but is not offered any more.
   - If an override is no longer served, the built-in original comes back.

## Activation (owner, after review)

1. In the Supabase dashboard, open the SQL editor and run `supabase/migrations/20261025000100_sofitgo_cms.sql`. To undo it, run `supabase/rollback/20261025000100_rollback.sql`.
2. **The single manual step.** Sign up in the app with the owner's e-mail, then run:
   `insert into public.cms_members (user_id, role) select id, 'owner' from auth.users where email = 'YOUR-EMAIL';`
3. Open `#/admin` in the app (Settings → ניהול תוכן) and grant roles to the team.
4. Optional (media upload): create a Storage bucket `cms-media`, publicly readable, writable by editors. This is not built yet.

## Known limits

- **Rollout timing:** changes reach a user the next time they open the app with a connection; until then they see the cached copy.
- **Past days:**
  - The planned (not eaten) menu of a past day is regenerated from the current dishes, so it can change after a publish.
  - Logged meals keep their stored values, so what a user already ate never changes.
- **Still in code:** new exercises (they need a motion figure) and new foods (they need verified values).
