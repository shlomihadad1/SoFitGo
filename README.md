# netlify-live — what sofitgo.com serves

This branch holds only the prebuilt site that Netlify publishes. Source code, tests and docs are on `fix/default-cuisine`.

- `site/`: build `57f33cce03`, from commit `02f92f7` of `fix/default-cuisine` (release candidate 26.10.2026; full regression 91/91 on `de385b3`, code identical).
- `netlify.toml`: publish `site/`, no build step.
- `site/sofitgo-config.js` contains the Supabase project URL and the publishable key only; both are public by design.
- To roll back: Netlify → Deploys → an earlier deploy → **Publish deploy**.
