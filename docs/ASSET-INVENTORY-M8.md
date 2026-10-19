# SoFitGo — graphic asset inventory (M8)

- **Checked:** 19 October 2026. I opened every file, then measured its format and pixel size with Pillow.
- **Originals:** the 7 files from the M8 message are copied unchanged and read-only to `sofitgo-brand/references-m8/`.
  - `SHA256SUMS` sits next to them.
  - Nothing was recompressed or cropped.
- **Path names:** example paths such as `/assets/sofitgo_master_logo.png` and `/assets/sofit_realistic_avatar.jpg` **do not exist**. No such files were supplied.

## 1. Files received in the M8 message

| # | Saved as | Format | Size (px) | Alpha | What it is | Usable in the app? |
|---|---|---|---|---|---|---|
| 1 | `ref-logo-3d-chevron-s-2048.jpg` | JPEG | 2048×2048 | no | 3D render: a lime "S" built from two chevrons, plus the italic wordmark "SoFitGo" on a dark rounded tile | **No.** See note A |
| 2 | `ref-app-icon-presentation-2048.jpg` | JPEG | 2048×2048 | no | Presentation board ("Premium app icon, dark mode", "Creative agency presentation") showing an icon with the S mark and "SoFitGo" | **No.** See note A |
| 3 | `ref-mockup-dashboard.jpg` | JPEG | 1438×2576 | no | Dashboard concept: "Hello, Alex", activity rings, macros, "AI Coach Sofit online" with a robot avatar | **Reference only.** See notes B and C |
| 4 | `ref-mockup-ai-coach.jpg` | JPEG | 1438×2576 | no | Chat concept with a robot coach, "Online", and a scripted conversation | **Reference only.** See notes B and C |
| 5 | `ref-mockup-travel.jpg` | JPEG | 1438×2576 | no | Travel Mode concept: map, "You are here", "Travel Mode · Chicago, IL", hotel HIIT | **Reference only.** See notes B and D |
| 6 | `ref-mockup-food-diary.jpg` | JPEG | 1696×2528 | no | Food diary concept: a ring of 1,640 consumed out of 2,300, and a meal log | **Reference only.** See note B |
| 7 | `ref-mockup-active-workout.jpg` | JPEG | 1696×2528 | no | Active workout concept: barbell squat, 80 kg, "144 BPM", "184 kcal burned" | **Reference only.** See notes B and E |

### Notes

- **A — logo renders.**
  - These are flattened raster JPEGs. The mark, its bevel, the shadow and the background are all baked into one layer, with no transparency and no vector file.
  - Because of that, they cannot become an app icon, a favicon or a header mark without redrawing.
  - The mark is an italic, lightning-style "S". The M8 brief says not to introduce generic italic S or SG logos.
  - The owner has **not approved** a final logo. So I did not integrate them, did not trace them, and did not replace the temporary C2 candidate with them.
- **B — concept mockups.**
  - These are pictures of screens, not working code. I used them only for direction: hierarchy, a consumed-calories ring, per-meal logging, compact travel options and the active-set focus.
  - All the numbers in them are made up (1,640 kcal, 144 BPM, 184 kcal, 8/10 reps, "Alex"). None of them appears in the app.
- **C — robot coach.**
  - Mockups 3 and 4 show Sofit as a robot with an "Online" status. That conflicts with two decisions:
    1. The owner decided Sofit is a **realistic woman** ("תשתמש בשמות ריאליסטית בלבד").
    2. The app has **no live AI** (decision D-4 is open).
  - The coach screen therefore uses the approved realistic avatar. It is labelled "rule-based, not an AI chat", and the chat box is disabled.
- **D — travel map.** "You are here" and "Chicago, IL" imply automatic location. The app never reads location. The destination is a text label that the user types.
- **E — biometrics.** Heart rate and burned calories need a measured source. The app has none, so the dashboard says "לא נמדד" (not measured) instead of showing a number.

## 2. Brand assets the app uses today (unchanged unless stated)

| Asset | Location | Size | Status |
|---|---|---|---|
| Sofit avatar | `src/static/brand/sofitgo/sofit/sofit-avatar-192.webp` | 192×192 | **Approved source** is the realistic design sheet (`ec03667c-image.jpg`, 2576×1438). The avatar is a crop of the "Encouraging" expression, downscaled only. At 3× pixel density, 192 px is enough for 64 CSS px. That is why the M8 coach screen shows it at 64 px and not 96 px |
| C2 candidate mark (header) | inline SVG in `main.js` | vector | Temporary exploration; **not final** |
| App icons (C2) | `src/static/brand/sofitgo/{icon-192, icon-512, icon-maskable-512, apple-touch-icon}.png` | 192, 512, 512, 180 | **Recoloured in M8:** background `#0F1115`, mark `#CCFF00` to match the tokens. The M7 originals are backed up in `fitapp/backups/sofitgo-icons-before-M8-*.tgz`. The shape is unchanged |
| C1–C4 candidates, v1 originals | `sofitgo-brand/candidates-v2/`, `sofitgo-audit/logo-concept-v1/` | SVG/PNG | Kept, untouched |

## 3. Mapping (where approved assets would go)

| App location | Needs | Today |
|---|---|---|
| Header mark, 28 px | Vector mark (SVG), single colour | C2 candidate |
| PWA / iOS icons | 1024×1024 master without transparency, plus a maskable safe-zone version | C2 icons (180–512) |
| Launch / splash (native) | Vector or 2732×2732 centred mark | Missing |
| NOW card avatar, 48 px | Square portrait at 144 px or more | Present (192) |
| Coach screen, 64 px now, 96–120 px wanted | Square portrait at 360 px or more, the same woman | **192 px only**, which limits the size |
| Onboarding / empty states | 2–4 poses of the same realistic Sofit (welcome, encouraging, resting, cooking) | Missing |
| Store screenshots / marketing | Real app screenshots, made after the logo is approved | Not started |

## 4. Missing — needed from the owner or the design team

1. **An approved final logo** as a vector master (SVG or PDF):
   - full-colour, one-colour and reversed versions;
   - the minimum size;
   - a confirmation that the shape is not a generic italic S or SG.
2. **An app-icon master**, 1024×1024 PNG without transparency, plus a maskable version (Android) with the safe zone respected.
3. **Sofit portraits**, all of the same realistic woman:
   - at least 512×512;
   - transparent or plain background;
   - 3–4 expressions or poses;
   - usage rights confirmed.
4. **A rights statement** for every generated image, covering who generated it, with which tool, and the licence terms.

## 5. How a delivered asset gets integrated

1. Inspect it: format, size and alpha.
2. Save the original read-only under `sofitgo-brand/` with its SHA-256.
3. Produce mobile derivatives: WebP for photos, a PNG set for icons, SVG for the mark.
4. Swap the file at the path in §2 (same name), so no code changes are needed.
5. Rebuild and re-run `e2e_m8`, whose avatar check verifies the image is not upscaled.
