# NYT design system — colour + type

Extracted from `nytimes.com` production CSS (`global-*.css`, homepage inline styles),
2026‑09. Reference only — not wired into VXCard. NYT's four text faces
(Cheltenham, Imperial, Franklin, Karnak) are custom‑commissioned and **not
licensable**; only the fallback stacks below are reusable.

The site ships a three‑layer token system: `--tpl-size-*` / `--tpl-color-*`
primitives → `--tpl-typography-*` / `--color-*` semantic → `--tpl-theme-*`
component. Values below are the **light theme** (the homepage runs
`tpl-always-light`); the dark value is given as `light / dark`.

---

## 1. Typography

### 1.1 Font families (stack = NYT face first, then fallbacks)

| Token | Role | Stack |
|---|---|---|
| `cheltenham` | Headlines (serif) | `nyt-cheltenham, cheltenham-fallback-georgia, georgia, 'times new roman', times, serif` |
| `cheltenham-cond` | Opinion headlines | `nyt-cheltenham-cond, georgia, serif` |
| `cheltenham-sh` | Subheads / small headlines | `nyt-cheltenham-small, nyt-cheltenham, georgia, serif` |
| `imperial` | Body copy (serif) | `nyt-imperial, georgia, 'times new roman', times, serif` |
| `franklin` | UI, labels, buttons, bylines (sans) | `nyt-franklin, helvetica, arial, sans-serif` |
| `karnak` | Section fronts, feature titles (slab) | `nyt-karnak, georgia, serif` |

Masthead wordmark is *Engravers' Old English* (image/SVG, not in web CSS).

Closest free substitutes: Cheltenham → **Playfair Display** / Georgia; Imperial →
**Georgia** / Lora / Pт Serif; Franklin → **Libre Franklin** / Helvetica; Karnak →
**Zilla Slab** / Rokkitt.

### 1.2 Weights

| Name | Value |
|---|---|
| ultra-light | 100 |
| thin / extra-light | 200 |
| light | 300 |
| book / normal / regular / text | 400 |
| medium | 500 |
| semi-bold | 600 |
| bold / text-bold | 700 |
| extra-bold | 800 |
| black | 900 |

### 1.3 Size scale (rem, root 16px)

`10 .625` · `11 .6875` · `12 .75` · `14 .875` · `16 1` · `18 1.125` ·
`20 1.25` · `22 1.375` · `24 1.5` · `26 1.625` · `28 1.75` · `30 1.875` ·
`32 2` · `36 2.25` · `40 2.5` · `48 3` · `56 3.5` · `64 4` · `72 4.5`

### 1.4 Line height

`1` · `1.1` · `1.15` · `1.2` · `1.25` · `1.28` · `1.3` · `1.35` · `1.39` · `1.5`

### 1.5 Letter spacing (em)

`.0025` · `.01` · `.04` · `.05` · `.06` · `.08` · `.09` · `.1`

### 1.6 Composed text roles

| Role | Face | Weight | Size | LH | Tracking / case |
|---|---|---|---|---|---|
| Headline — news | Cheltenham | 700 | 16–48 | 1.1–1.2 | `.01em` ≤ 20px |
| Headline — feature | Cheltenham | 200 (light) | 24–56 | 1–1.15 | — |
| Headline — default | Cheltenham | 400–500 | 16–28 | 1.15–1.2 | `.01em` at 16–18 |
| Headline — opinion | Cheltenham Cond | 700 | 18–56 | 1.15 | `.0025em` |
| Body | Imperial | 400 | 16–20 | 1.39 compact / 1.5 regular | — |
| Text / UI | Franklin | 500 | 12–20 | 1.3 | — |
| Title / UI emphasis | Franklin | 600 | 12–56 | 1.2–1.3 | — |
| Section header | Franklin | 700 | 14–16 | 1.3 | — |
| Label / kicker / eyebrow | Franklin | 600–800 | 10–11 | 1.25 | `.1em`, **UPPERCASE** |
| Slab title | Karnak | 700 | 16–18 | 1.15 | — |

---

## 2. Colour (light / dark)

### 2.1 Primitives actually in use

Ink `#121212` · white `#fff` · greys `#f8f8f8` `#ebebeb` `#dfdfdf` `#c7c7c7`
`#8b8b8b` `#959595` `#727272` `#5a5a5a` `#363636` `#2a2a2a` `#424242`
· scrim `#12121299`

### 2.2 Content (text / icon)

| Token | Light | Dark |
|---|---|---|
| `content-primary` | `#121212` | `#f8f8f8` |
| `content-primary-dim` | `#363636` | `#dfdfdf` |
| `content-secondary` | `#5a5a5a` | `#bbbbbb` |
| `content-tertiary` | `#5a5a5a` | `#bbbbbb` |
| `content-quaternary` | `#727272` | `#a3a3a3` |
| `content-placeholder` | `#8b8b8b` | `#8b8b8b` |

### 2.3 Background

| Token | Light | Dark |
|---|---|---|
| `background-primary` | `#ffffff` | `#121212` |
| `background-secondary` | `#f8f8f8` | `#2a2a2a` |
| `background-tertiary` | `#ebebeb` | `#363636` |
| `background-elevated` | `#ffffff` | `#2a2a2a` |
| `background-highlight` | `#fefad1` | `#35352f` |
| `background-scrim` | `#12121299` | `#12121299` |

### 2.4 Stroke / divider

| Token | Light | Dark |
|---|---|---|
| `stroke-primary` | `#121212` | `#f8f8f8` |
| `stroke-secondary` | `#959595` | `#959595` |
| `stroke-tertiary` | `#dfdfdf` | `#424242` |

Rules: primary `2px solid ink` · secondary `1px solid ink` ·
tertiary `1px solid #dfdfdf` (the standard story divider).

### 2.5 Signal / accent

| Token | Light | Dark | Note |
|---|---|---|---|
| `accent` (link) | `#346eb7` | `#6ba1dd` | interactive blue |
| `accent-dim` / `editorial` | `#326891` | `#7ca7c8` | **the iconic "NYT blue"** |
| `breaking` | `#d0021b` | `#e14e5b` | breaking-news red |
| `negative` | `#a90111` | `#ea7980` | error |
| `positive` | `#267c30` | `#63a859` | success green |
| `developing` | `#e6540a` | `#f78145` | developing-story orange |
| `highlight` | `#fefad1` | `#35352f` | pale-yellow marker |

Legacy link blue `#567b95` still appears in older modules.

---

## 3. Spacing, radius, borders (bonus — same token file)

**Spacing** (rem): `.25 .5 .75 1 1.25 1.5 2 2.5 3 3.5 4 4.5 5`
(tokens `0.5`–`10`).

**Border width**: `1px` · `1.5px` (`.09375rem`) · `2px` · `3px`.

**Radius**: buttons / dialogs / toasts `3px`; tiles & story-list items `0`;
icon buttons `9999px` (pill). NYT is a **square-corner** system — 3px is the max.

**Button**: 44px standard height (32 compact / 24 x-compact / 56 expanded),
`3px` radius, `1px solid` ink border, Franklin 600 16/1.3, disabled `opacity: 40%`.
