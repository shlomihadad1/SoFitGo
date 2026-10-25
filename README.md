# netlify-live — what sofitgo.com serves

This branch holds only the prebuilt site that Netlify publishes. Source code, tests and docs are on `fix/default-cuisine`.

- `site/`: build `74bdd9483f`, from commit `4e23429` (identical to `sofitgo-deploy-74bdd9483f-4e23429.zip`).
- `netlify.toml`: publish `site/`, no build step.
- `site/sofitgo-config.js` contains the Supabase project URL and the publishable key only; both are public by design.
- To roll back: Netlify → Deploys → an earlier deploy → **Publish deploy**.
