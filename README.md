# netlify-live — what sofitgo.com serves

This branch holds only the prebuilt site that Netlify publishes. Source code, tests and docs are on `fix/default-cuisine`.

- `site/`: build `f1248e1201`, from commit `73ff796` (adds the "ניהול מערכת" button for owner/admin).
- `netlify.toml`: publish `site/`, no build step.
- `site/sofitgo-config.js` contains the Supabase project URL and the publishable key only; both are public by design.
- To roll back: Netlify → Deploys → an earlier deploy → **Publish deploy**.
