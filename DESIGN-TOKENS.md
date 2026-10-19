# SoFitGo design tokens and components (M8)

**Single source:** the `:root` block at the top of `src/css/styles.css`.
- Components use the **semantic** tokens (layer 2), never raw hex values.
- To change the brand, edit layer 1.
- The M8 test `e2e_m8` reads the tokens from the running page and fails if they drift.

## Layer 1 — brand primitives (the M8 palette)

| Token | Value | Use |
|---|---|---|
| `--brand-bg` | `#0F1115` | Primary background |
| `--brand-surface` | `#181B22` | Cards, panels, navigation |
| `--brand-lime` | `#CCFF00` | Primary action, selected state, progress |
| `--brand-white` | `#FFFFFF` | Headlines and primary information |
| `--brand-grey` | `#9BA1A6` | Supporting text |
| `--brand-border` | `#2A2E39` | Dividers and card outlines |

## Layer 2 — semantic roles

| Token | Value | Notes |
|---|---|---|
| `--bg` / `--bg-rgb` | brand-bg / `15 17 21` | The RGB form is for the translucent header and nav: `rgb(var(--bg-rgb) / .92)` |
| `--surface` | brand-surface | Cards |
| `--surface-2` | `#1F232C` | Raised controls: inputs, secondary buttons, inner panels |
| `--surface-3` | `#272C36` | Tracks, pressed states, toasts |
| `--line` | brand-border | Decorative outline only |
| `--line-strong` | `#3A3F4C` | Hero and emphasised outline |
| `--line-control` | `#6B7180` | **Form-field boundary**, ≥ 3:1 on every surface (WCAG 1.4.11) |
| `--text` | brand-white | |
| `--muted` | brand-grey | |
| `--faint` | `#8A9096` | **Changed.** It was `#66757f` (3.6:1 on a card, below AA for the small text it is used for) |
| `--accent`, `--accent-rgb`, `--accent-ink`, `--accent-soft`, `--accent-line` | lime / `204 255 0` / brand-bg / 10% / 38% | |
| `--good`, `--warn`, `--bad`, `--glacier` (+ `-rgb`, `-soft`) | `#5cc08a`, `#e8b04a`, **`#F07A72`**, `#6cc3d5` | `--bad` was `#e5675f` and was raised to keep ≥ 4.5:1 on `--surface-3` |
| `--carb`, `--fat` | `#c9a7ff`, `#e98a6b` | Macro colours (unchanged) |
| `--c-tr` … `--c-wa` | session-type colours | `--c-tr` now follows `--accent` |
| `--scrim`, `--media-bg`, `--shadow-1` | | Sheet backdrop, figure and dish backgrounds, one elevation |

**Translucent colours** use the `rgb(var(--x-rgb) / a)` syntax rather than `color-mix()`, so older iOS versions (Safari 12.1 and later) keep them.

## Type, spacing, radius, motion

| Group | Tokens |
|---|---|
| Families | `--font-display` (Rubik, Heebo, system), `--font-body` (Heebo, system) |
| Base | `--fs` 15 px (17 px in "large text" mode) |
| Scale | `--fs-xs` .76em · `--fs-sm` .86em · `--fs-md` 1em · `--fs-lg` 1.12em · `--fs-xl` 1.5em · `--fs-2xl` 1.9em |
| Form text | `--fs-input: max(16px, 1em)`. iOS Safari zooms the page when a focused field is under 16 px |
| Weight | `--fw-regular` 400 · `--fw-medium` 500 · `--fw-bold` 600 |
| Spacing (4-pt) | `--sp-1` 4 · `--sp-2` 8 · `--sp-3` 12 · `--sp-4` 16 · `--sp-5` 24 · `--sp-6` 32 |
| Radius | `--r-sm` 10 · `--r` 14 · `--r-lg` 20 · `--r-pill` 999 |
| Sizing | `--tap` 46 · `--tap-sm` 44 (minimum touch target) · `--nav-h` 64 |
| Motion | `--dur-1` .18s · `--dur-2` .3s · `--ease`. All animation and transition is off under `prefers-reduced-motion` or the in-app "reduce motion" setting |

## Contrast

Computed with the WCAG 2.x formula from the hex values. `e2e_m8` re-checks the colours computed in the page.

| Foreground | on `--bg` | on `--surface` | on `--surface-2` | on `--surface-3` |
|---|---|---|---|---|
| text `#FFFFFF` | 18.90 | 17.23 | 15.73 | 14.00 |
| muted `#9BA1A6` | 7.24 | 6.60 | 6.02 | 5.36 |
| faint `#8A9096` | 5.86 | 5.34 | 4.88 | 4.34¹ |
| accent `#CCFF00` | 16.08 | 14.66 | 13.39 | 11.92 |
| bad `#F07A72` | 6.96 | 6.34 | 5.79 | 5.16 |
| ink on accent | — | — | — | 16.08 (button text) |
| control border `#6B7180` | 3.87 | 3.53 | 3.22 | — (non-text, needs 3:1) |

¹ Faint text is not used on `--surface-3`.

## Components

| Component | Classes | Rule |
|---|---|---|
| Card | `.card`, `.card.hero`, `.card.flat` | Hero cards are a flat gradient from surface-2 to surface. **The decorative lime and teal glows were removed** |
| Buttons | `.btn` (secondary), `.btn.primary` (lime), `.btn.outline` (lime outline), `.btn.secondary`, `.btn.ghost`, `.btn.danger`, `.btn.good`; sizes `.sm`, `.big`, `.block` | **One lime primary per area.** On Home, the plan card's start button became secondary when the NOW card already offers it. In the workout, "start timer" became outline next to the lime "set done" |
| Disabled | `[disabled]`, `[aria-disabled=true]` | 45% opacity, not-allowed cursor. A disabled control always has visible text saying why |
| Focus | `:focus-visible` | 2 px lime outline, 2 px offset, on buttons, chips, segments, nav and fields |
| Forms | text, search, email, tel, url, number, date, time, select, textarea | surface-2, `--line-control` border, 16 px or larger, lime focus outline, `aria-invalid` turns the border red. **Search fields were unstyled in M7** (fridge, recipes) |
| Chips / segments / pills | `.chip`, `.seg`, `.pill.*` | 44×44 minimum touch target |
| Progress | `.meter`, `.ring`, `.stat` | Accent for progress, glacier for water and protein, good for steps |
| Bottom nav | `.nav` | Selected tab: lime icon and label plus a 2 px indicator. **Hidden while a text field has focus**: `main.js` adds `body.kb` on focus and removes it 400 ms after blur, so a tap just above the nav never lands on a tab (the first CSS-`:has` version did; corrected in M8). Unverified on iPhone |
| Header | `.top` | Sticky; paints its own status-bar padding (P0-E) |
| Sheet / modal | `.sheet-bg`, `.sheet` | Scrim token; `max-height: 88dvh` with a `vh` fallback; safe-area padding |
| Toast | `.toast` (+ `.toast-act` undo) | surface-3, `--shadow-1` |
| Loading | `[data-extra-loading]` ("טוען…"), `.skel` shimmer | Shimmer stops under reduced motion |
| Empty | `.empty`, `.state` | Dashed outline, an icon and one line |
| Error | `.state.error`, `.banner.bad`, screen-level error card | Error copy names the data area (F-8) |
| Offline | `.offline-bar[data-offline]` | Shown only when the browser reports offline; toggled without re-rendering |
| Unavailable | `.unavail` | Icon plus "לא נמדד" / "לא זמין" text, never a placeholder number |

## Theme colour

`tools/build.js` sets `theme-color` and the manifest colours to `#0F1115`. The C2 app icons were re-rendered on `#0F1115` with a `#CCFF00` mark by `sofitgo-brand/appicons.js`. The shape is unchanged, and C2 is still **not** an approved logo.
