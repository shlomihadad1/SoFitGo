# SoFitGo — graphic asset readiness (M9)

**What was checked, and how:**
- Every image in the workspace was inspected on 19 October 2026:
  - the app source (`src/static`);
  - the brand workspace (`sofitgo-brand/`, `sofitgo-audit/`);
  - all images you have uploaded in this conversation.
- Format and pixel size were measured with Pillow, and each file was opened and looked at.

**Nothing was changed, replaced or integrated.**

**Rule for every row:**
- "Usable" means it can be used **as it is now**.
- "Approved" means **you** approved it.
- Nothing in the brand area is approved yet, except the decision that Sofit is a realistic woman.

## 1. In the app today (usable, not final)

| Asset | File | Size | Status |
|---|---|---|---|
| Sofit avatar | `src/static/brand/sofitgo/sofit/sofit-avatar-192.webp` | 192×192 WebP | **Usable, low resolution.** Cropped from the realistic design sheet (expression "Encouraging") and only downscaled. It is enough for 64 CSS px at 3× density, which is why the coach screen shows it at 64 px. A larger hero image would be upscaled, and therefore blurry |
| App icons (C2 candidate) | `src/static/brand/sofitgo/{apple-touch-icon 180, icon-192, icon-512, icon-maskable-512}.png` | 180–512 PNG | **Usable, provisional.** Generated from vector code and recoloured to the tokens in M8. **C2 is not approved** |
| Header mark (C2) | inline SVG in `src/js/main.js` | vector | **Usable, provisional** |
| Legacy Fit30 icons | `src/static/{apple-touch-icon, icon-*}.png` | 180–512 | Only used with `FIT30_BRAND=fit30`. Kept for rollback |
| Exercise illustrations, tutorials | `src/media/` (141 files) | WebP / MP4 | Original app media, recorded or drawn for the app. Not brand assets |

## 2. Brand workspace (exploration, not approved)

| Asset | Location | Size | Status |
|---|---|---|---|
| Candidates C1–C4 (icon, lockup, light and dark) | `sofitgo-brand/candidates-v2/` (55 files: SVG plus a PNG set) | vector, plus PNG up to 1024 | **Unapproved concepts.** C2 is used provisionally |
| Logo concept v1 | `sofitgo-audit/logo-concept-v1/` | SVG, plus PNG 1024 icons | **Unapproved.** Kept as the original |
| Sofit crops | `sofitgo-brand/sofit/sofit-encouraging-src-320.png`, `expr_col.png` (646×1200) | 320 px faces | **Low resolution.** Working crops from the design sheet |

## 3. Images you supplied (reference only)

| Image (upload id) | Size | What it is | Status |
|---|---|---|---|
| `ec03667c` | 2576×1438 JPEG | **Realistic Sofit design sheet** (turnaround, pose, 3 expressions) | **The only source for the realistic Sofit.** Each face is about 300 px, so it is **low resolution** for anything above about 100 CSS px |
| `a23480fb`, `ad5365df`, `b4c4491b` | 1536×1024 PNG | Concept collages: logos, realistic Sofit photos and app screens, **plus robot variants** | **Unapproved concepts.** The portraits are small cut-outs inside a collage, too small and flattened to extract |
| `0ffe8856`, `8a7c8579`, `f8f27ae4`, `07f9a952` | 795–2048 JPEG | App-icon and logo renders: an **italic, lightning-style S** and a slanted wordmark | **Not usable.** These are flattened renders with no transparency and no vector, and they are **generic italic-S marks**, which the brief rules out |
| `19caead7`, `692c604e` | 2576×1438 JPEG | Brand-identity boards: logo, palette, type, icons | **Unapproved concepts** (italic S). The palette on them is older |
| `3ef7e58e`, `f79b7dae`, `ad6b3387` | screen mockups | Dashboard and chat with a **robot coach**, "Online", **invented biometrics** ("Alex", rings, BPM) | **Reference only.** They conflict with the realistic-Sofit decision and the no-fake-data rule |
| `d59c717b` | 2576×1438 JPEG | "Sofit — The AI Coach" **robot** character sheet | **Not usable.** A robot coach is ruled out |
| `228acf1e`, `6cb79402`, `9e05a6bc` | screen mockups | Travel with a map and "You are here", food diary, active workout with "144 BPM" | **Reference only.** Useful for layout ideas; the data in them is invented |
| `3e248b66`, `adb18f94` | iPad photos | Your Files app, and Netlify settings | Not brand assets. `adb18f94` is evidence for the badge setting (see `NETLIFY-BADGE-CHECK.md`) |

The M8 originals are also copied read-only to `sofitgo-brand/references-m8/`, with `SHA256SUMS`.

## 4. Missing: needed before a premium beta

| # | Missing asset | Specification | Blocks |
|---|---|---|---|
| 1 | **Approved final logo** | Vector master (SVG or PDF): mark, wordmark and lockup, each in full-colour, one-colour and reversed versions, with a minimum size. **Not** a generic italic S or SG, dumbbell, heartbeat or runner | Header mark, store listing, launch screen |
| 2 | **1024×1024 app-icon master** | PNG with no transparency and no rounded corners (iOS adds them), plus an Android adaptive icon (foreground and background) that respects the safe zone | PWA and native icons, App Store |
| 3 | **High-resolution Sofit portraits** | The **same realistic woman** as the design sheet: 3–4 expressions or poses (welcome, encouraging, coaching, rest); **at least 1024×1024**; plain or transparent background | Coach screen at full size (96–160 px), onboarding, empty states |
| 4 | **Rights statement** | For every generated image: the tool, the account, the licence and the date | Any public release |
| 5 | Launch screen (native) | Vector mark, or 2732×2732 centred on `#0F1115` | Native app (M13) |

## 5. How a delivered asset is integrated

1. Save the original read-only under `sofitgo-brand/`, with its SHA-256.
2. Check its format, size, alpha channel and rights.
3. Make the mobile versions: WebP for portraits, a PNG set for icons, SVG for the mark.
4. Replace the file at the same path, so no code changes are needed.
5. Run `e2e_m8`. Its avatar check fails if an image would be shown upscaled.

## 6. Addendum: `SoFitGo_Logo_Assets.zip` (received later on 19 October 2026)

The full details are in `CHANGES-M9-IDENTITY.md` §1. In short:

- **Horizontal wordmark (transparent PNG, 694×173).** The white is clean. The lime parts are about 77% opaque and speckled.
  - In use as a **cleaned, provisional** raster: `sofitgo-wordmark-provisional.png` (394×84) and `sofitgo-symbol-provisional.png` (128×128).
- **Dark-background wordmark.** Not used, because it has no transparency.
- **App-icon "concept crop".** The crop misses the icon. Not used, and the app icon is unchanged.
- **3D icon and the two references.** Reference only. The two references are byte-identical to images from the M8 message.

**Still missing:** the vector logo master (SVG, PDF or AI), the 1024 px square app-icon master, and high-resolution Sofit portraits.
