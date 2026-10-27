# netlify-live — what sofitgo.com serves

This branch holds only the prebuilt site that Netlify publishes. Source code, tests and docs are on `fix/default-cuisine`.

- `site/`: build `f015e15ed9`, from commit `9b4794a` of `fix/default-cuisine` (test release 27.10.2026; full regression on `9b4794a`: 99/99 suites exit 0, artcheck 2/2, 27,635 checks passed, 0 failed). Adds since `57f33cce03`: safe stop in workouts + captions, device error log, data-safety card, faster first load, optional skip reasons, "delete all data" privacy fix, nutrition-screen crash fix, security headers in report-only mode (`site/_headers`).
- `netlify.toml`: publish `site/`, no build step.
- `site/sofitgo-config.js` contains the Supabase project URL and the publishable key only; both are public by design.
- To roll back: Netlify → Deploys → an earlier deploy → **Publish deploy**.
