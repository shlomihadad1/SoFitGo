# What you need to do next (M8)

The steps are in order. Each one says how long it takes and what it unblocks. None of them needs me to deploy, push or buy anything.

## Now (about 10 minutes, no cost)

1. **Check the Netlify badge setting (D-2).**
   - Open the RC4 project in Netlify. Go to **Project configuration → General → Powered by Netlify badge**.
   - Tell me whether the setting is there.
   - If it is there **and** you approve changing the public RC4 project, switch it off.
   - Afterwards I run `node tools/e2e_shell.js https://regal-starlight-c10c8b.netlify.app/ --proxy` to confirm that all 5 tabs respond.
   - If the setting is not there, choose Netlify Pro or Cloudflare Pages. See `docs/HOSTING-AND-NETLIFY-BADGE.md`.
2. **Upload the M8 build somewhere private**, either a private Netlify project or a protected Cloudflare preview.
   - Use `SoFitGo-RC5-M8-cfd6df2f65-upload.zip`, with the app at the root.
   - Send me the URL. I check with `verify_private_preview.sh` that anonymous visitors are refused, **before** you test on the phone.

## This week (15–20 minutes on your iPhone)

3. **Run `SAFARI-DEVICE-CHECKLIST.md`.**
   - It covers the header, keyboard and tabs, small screen, offline, and real content only.
   - Send screenshots of every step that **fails**, plus every step of §1 (header).
   - This is the only way to close P0-A.

## When you have a Mac (about 1 hour, no cost)

4. **Apple Health in the Simulator.** Follow `APPLE-HEALTH-VERIFICATION.md` §3.
   - You need Xcode 26+ and Node 22+.
   - First decide the **bundle id** (for example `com.<you>.sofitgo`). It is permanent once published.
5. **On your own iPhone** (§4). Try your free Apple ID first.
   - If Xcode refuses the HealthKit capability for a Personal Team, that is when the paid Apple Developer Program becomes necessary (D-6).

## Decisions only you can make

| # | Decision | What I need from you | What it unblocks |
|---|---|---|---|
| D-2 | Hosting | Option A, B or C in the hosting doc | Testers on the public beta |
| — | **Final logo and Sofit images** | A vector logo; a 1024 px icon master; Sofit portraits at least 512 px of the same realistic woman; a rights statement (`docs/ASSET-INVENTORY-M8.md` §4) | A larger coach image; launch screen; store assets |
| D-4 | AI service and budget | Yes or no to a real chat, a budget, and privacy limits (`docs/AI-ARCHITECTURE.md`) | Sofit chat. Today it is shown as unavailable |
| D-1 | Recipes | Approval for metadata clean-up: equipment field on 17 no-cook items and the duplicate edamame pair. Rebalancing needs a dietitian review | Recipe gate warnings → 0 |
| D-5 | Step target / MoveScore weights | Accept or change 50 / 30 / 20 | MoveScore beyond "proposal" |
| D-6 | Apple / Google developer accounts | When you want TestFlight or Play testing | Native beta |
| D-3 | Private GitHub repository | Create it and give me access, if you want version history | Source control (none today) |
| — | Professional review | A coach or physio for load rules and Minimum Mode; a dietitian for nutrition modes | Proposals 6–9 in `docs/INNOVATION-PROPOSALS-M8.md` |

## What I can do next without waiting (proposed M9)

These are local only and need no decisions:
1. Contextual Shortcuts v2
2. Smart Grocery Loop v3
3. One-Tap Weekly Reset
4. Offline Travel Pack "prepare"

Each comes with tests. Nothing gets deployed.
