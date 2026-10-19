# Checking the "Powered by Netlify" badge setting (owner only, about 3 minutes)

I have no access to your Netlify account and changed nothing. This page tells you how to look, and what each answer means.

## What we already know

- **Netlify's documentation**, re-read on 19 October 2026 ([Powered by Netlify badge](https://docs.netlify.com/manage/projects/powered-by-netlify-badge/)):
  - The setting path is **Project configuration → General → Powered by Netlify badge**. You then switch it on or off and press **Save**.
  - The change applies "on the next request", with no redeploy.
  - The setting belongs to one project. Changing it on one project does not affect your other projects.
  - The badge shows **only on public projects**. It does not show on projects protected by team login or SSO.
  - Free-plan projects created on or after 19 August 2026 have the badge **on** by default.
  - The docs do **not** say whether a Free-plan project is allowed to switch it off.
- **Your own iPad photo from earlier today:**
  - It shows this section in your account: "Powered by Netlify badge — *The badge is shown on this project.* — **Configure**".
  - The project in that photo was **Private** (production and deploy previews), so it was probably the private preview, not the public RC4 site.
  - So the section exists in your account. What we don't know yet is what **Configure** lets you do.

## Steps

1. Open `https://app.netlify.com/projects/regal-starlight-c10c8b/configuration/general#powered-by-netlify-badge`. That is the public RC4 project.
   - Or: Netlify → Projects → **regal-starlight-c10c8b** → **Project configuration** → **General** → **Powered by Netlify badge** (in the left menu).
2. Tap **Configure**.
3. **Don't save anything yet.** Take a screenshot of what appears, and send it to me.

## What the screenshot will tell us

| What you see after Configure | Meaning | Next step |
|---|---|---|
| A switch, or options that include "off" / "hidden", with **Save** | Free plan can turn it off | **If you approve changing the public RC4 site**, switch it off and save. I then check all 5 tabs with `node tools/e2e_shell.js https://regal-starlight-c10c8b.netlify.app/ --proxy` |
| An upgrade message, or the switch is disabled | Free plan can't turn it off | Choose between Netlify Personal or Pro (paid), Cloudflare Pages (free, more setup), or leaving RC4 as it is. See `HOSTING-AND-NETLIFY-BADGE.md` |
| The section is missing on the RC4 project | The rollout hasn't reached it, or the badge isn't active for it | Tell me. I re-check the live site for `#nl-badge-frame` |

**Important:**
- Turning the badge off **changes the public RC4 site**, so it needs your explicit decision.
- Making RC4 **private** would also hide the badge. But then every tester would need a Netlify team login, which isn't practical for a beta.
- Don't try to hide the badge from inside the app (CSS, scripts, security headers). The brief forbids it, and it would break the app.
