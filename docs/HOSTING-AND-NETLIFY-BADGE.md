# P0-B — the Netlify element that covers buttons, and hosting options

**Updated in M8 (19 October 2026).** This replaces the M7 version. In particular, it corrects M7's claim that "the badge cannot be removed on the free plan" (§2).

## 1. What covers the buttons (unchanged, verified in M7)

These findings come from Chromium with iPhone 13 emulation, on the public RC4 site `regal-starlight-c10c8b.netlify.app`. `tools/e2e_shell.js` reproduces them.

| | |
|---|---|
| Element | `<iframe id="nl-badge-frame">`, built by `/.netlify/scripts/hud`, which Netlify injects into `index.html` |
| Position | `position: fixed; bottom: 0; right: 0`, 201×64 px, `z-index: 2147483645` |
| Effect | It sits on the Home, Calendar and Workouts tabs. `elementFromPoint` at their centres returns the iframe, not the app |
| In the app's code? | **No.** It is not in `src/` and not in the built files. Locally, every tab is on top: `e2e_shell` 85/0, and `e2e_m8` finds no dead controls |

**What the app does not do:** hide, move or cover the provider's element with CSS, or block it with a Content Security Policy.
- Netlify's own documentation says a CSP without `'unsafe-inline'` blocks the badge script.
- That would be hiding provider UI, which the brief forbids.
- It would also break this app, which relies on an inline script.

## 2. Correction to M7: Netlify documents a per-project badge setting

**What the current official page says** ([Powered by Netlify badge](https://docs.netlify.com/manage/projects/powered-by-netlify-badge/), read 19 October 2026):
- "If it doesn't suit a particular project you own … you can turn it off." The setting is under **Project configuration → General → Powered by Netlify badge**, and it applies "on the next request", with no redeploy.
- The badge is being rolled out on **Free plans** (legacy and credit-based) and on **credit-based Personal and Pro** plans. It does not exist on Enterprise.
- "The badge appears only on public projects." It does not appear on projects protected by team login or SSO.
- **The page does not say explicitly whether the toggle is available on a Free-plan project.** Netlify's [changelog (19 August 2026)](https://www.netlify.com/changelog/2026-08-19-pre-launch-toolbar-and-powered-by-netlify-badge/) says Personal and Pro users "can toggle it per project". For Free it says only that new Free projects show the badge by default.

**What M7 relied on instead:** a comment inside Netlify's script (`data-account-tier="free"`) saying the badge cannot be hidden. That is weaker evidence than the documentation. Possibly the script variant served to RC4 predates the setting.

**Conclusion:** whether the owner can switch the badge off on the current Free project is **unknown until someone looks at that setting in the Netlify UI**. I have no account access and did not change anything.

## 3. Options (owner decision D-2)

| Option | Cost | Private preview | Badge / overlay | What the owner does | Evidence |
|---|---|---|---|---|---|
| **A. Netlify, current project: switch the badge off** | 0 if the toggle is offered on Free | Free credit-based plans: "make it private" (team login). That is how the earlier private preview returned 401 | Off, if the setting exists for this project | Open Project configuration → General → Powered by Netlify badge. If the setting is there, turn it off. **This changes the public RC4 site, so it needs explicit approval** | Netlify docs §2. Toggle availability on Free is **not confirmed** |
| **B. Netlify Pro (credit-based)** | Paid. Check netlify.com/pricing | Shared password via "Project visibility" | Off by default on Personal/Pro | Upgrade | [Password protection docs](https://docs.netlify.com/manage/security/secure-access-to-sites/password-protection/): "Password protection isn't available on Credit-based Free and Personal plans" |
| **C. Cloudflare Pages** (direct upload of `app/`) | Free Pages plan | Pages "Enable access policy" protects **preview deployments only**, not the `*.pages.dev` production domain or a custom domain. Protecting the whole site needs a Cloudflare Access application in front of it | No injected badge was observed or documented | Create a Cloudflare account, upload, and configure Access | [Preview deployments docs](https://developers.cloudflare.com/pages/configuration/preview-deployments/). **Access seat limits / free tier are not confirmed** on an official page in this session (a third-party post says 50 users free). Check cloudflare.com before relying on it |
| D. Leave RC4 as is | 0 | — | Covers 3 tabs | Nothing | Not acceptable for testers |

**My recommendation (the decision is yours):** check option A first, since it is the cheapest and fastest.
- If the setting is there, turn the badge off, then run the acceptance check below.
- If it is not there, choose between B (stay on Netlify, paid) and C (free, more setup, verify the Access terms first).

## 4. The build is host-independent

- `app/` in the upload ZIP is static files only. There are no redirects, functions or provider-specific files, so any static host can serve it.
- The service worker uses relative paths (`./`, `index.html`), so the app works from a subfolder too.

## 5. Acceptance check after any change

```
node tools/e2e_shell.js https://<host>/ --proxy        # 0 failures: every bottom tab on top at its centre
sh sofitgo-plan/verify_private_preview.sh https://<host>/   # private previews only: anonymous access must be refused
```

Then tap every bottom tab on a real iPhone.
