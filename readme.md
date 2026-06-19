# Haus Fund Design System

## Overview

**Haus Fund** is a $20M deeptech investment fund that backs early-stage founders emerging from structured residency programs. The fund sits at the intersection of scientific rigor and hands-on mentorship — providing capital, community, and infrastructure to help deeptech founders move fast.

The name and mark draw from the German *haus* (house) and the spirit of the Bauhaus: the idea that a building is not just structure, but a gathering place, a system, a way of working. Haus Fund is not just a check — it is a home for the companies it backs.

**Sources provided:**
- Brand mark: `assets/logo.png` — AI-generated logo image (Gemini). Bold geometric house mark + "HAUS" wordmark in heavy grotesque.
- No codebase or Figma files were attached. This system was built from the logo asset and company description. Provide access to production code or Figma for higher fidelity.

---

## Products

| Product | Description |
|---|---|
| **Fund Website** | Public-facing marketing site for investors, founders, and press. Communicates thesis, portfolio, and approach. |
| **Investor Portal** | Internal dashboard for the Haus team and LPs. Tracks portfolio companies, deal flow, fund metrics, and LP comms. |

---

## Content Fundamentals

### Voice & Tone
- **Authoritative, not corporate.** Direct, plain language. No jargon for its own sake.
- **First-person plural.** "We back founders at the earliest stage" — not "Haus Fund backs founders."
- **Precise and data-forward.** Specific numbers always. "$20M fund, 14 companies" — not "a substantial portfolio."
- **Understated confidence.** The portfolio speaks for itself. No hype, no exclamation marks.
- **Technically literate.** Writing respects the intelligence of deeptech founders without excluding newcomers.

### Casing Rules
| Context | Case |
|---|---|
| Primary display headlines | ALL CAPS |
| Subheadings, UI section titles | Sentence case |
| Navigation items | Title Case |
| Metric labels | UPPERCASE + tight tracking |
| Body copy | Sentence case, full punctuation |
| Button labels | Sentence case (not Title Case) |

### Copy Patterns
- Numbers always as digits: `$20M`, `14 companies`, `3 exits` — never spelled out
- Em dashes (—), not double hyphens (--)
- Oxford comma always
- No exclamation marks in formal or product UI
- No emoji — ever

### Examples
```
✓  "We focus on deeptech companies with a long view — battery chemistry,
    synthetic biology, novel manufacturing."

✓  "12 portfolio companies across 4 sectors. $18.4M deployed."

✓  "Apply to the residency — applications close March 31."

✗  "We're SUPER excited about our amazing portfolio!! 🚀"
✗  "Haus Fund has invested millions of dollars in cutting-edge startups."
```

---

## Visual Foundations

### Color
A restrained palette: near-black on warm off-white, with deep forest green as primary accent and warm bronze as secondary. No gradients; no glass.

| Role | Token | Hex |
|---|---|---|
| Primary text | `--ink-1` | `#0D0D0D` |
| Secondary text | `--ink-2` | `#3A3A3A` |
| Page background | `--canvas-1` | `#F8F7F3` |
| Card surface | `--canvas-0` | `#FFFFFF` |
| Primary accent | `--forest-2` | `#1C3B2D` |
| Secondary accent | `--bronze-3` | `#B8924A` |
| Tertiary accent | `--steel-2` | `#1A3D5C` |

### Typography
- **Display / wordmark:** `--font-display` → Barlow Condensed ExtraBold/Black — for large impact headlines and the HAUS mark treatment
- **Headings:** `--font-heading` → Barlow Bold/SemiBold — section titles, card headings, nav
- **Body / UI:** `--font-body` → DM Sans — all interface text, body copy, labels
- **Mono / data:** `--font-mono` → DM Mono — financial figures, data tables, timestamps

> ⚠️ **Font substitution notice:** Barlow and DM Sans are the closest Google Fonts matches to the visual weight and geometry of the HAUS wordmark. Provide original .ttf/.woff2 font files to achieve exact brand fidelity.

### Backgrounds & Surfaces
- Three levels: warm off-white page (`--canvas-1`) → white card (`--canvas-0`) → modal/popup (white + shadow)
- No gradients; no texture; no glass morphism
- One dark surface: `--forest-2` sidebar — the only inverted background in the system

### Cards
- Background: `--canvas-0`
- Border: `1px solid var(--border-1)`
- Shadow: `--shadow-sm`
- Radius: `--radius-lg` (10px)
- Padding: 20–24px standard

### Hover & Interaction States
| State | Effect |
|---|---|
| Hover (light) | Background → `--canvas-2`; shadow lifts one step |
| Hover (dark) | Opacity 0.85 or background lightens one step |
| Active/pressed | `transform: scale(0.98)` + opacity 0.9 |
| Focus | `box-shadow: 0 0 0 3px var(--canvas-3)` |
| Disabled | `opacity: 0.45`, `cursor: not-allowed` |

### Animation
- Durations: 100ms (micro-interactions), 160ms (default), 280ms (page-level)
- Easing: `--ease-default` (`cubic-bezier(0.2, 0, 0, 1)`) — fast-out, crisp
- No bounce, no elastic, no looping decorative animations
- Transition only: `background-color`, `box-shadow`, `opacity`, `transform`

### Borders & Radii
- All borders: 1px, warm gray tones (`--border-1` through `--border-3`)
- Prefer whitespace over borders for separation
- Radii: 2px badges → 4px chips → 6px buttons/inputs → 10px cards → 16px modals → 9999px pills

### Imagery
- High-contrast B&W or warm-toned scientific photography where used
- Subject matter: lab equipment, materials close-ups, schematics
- Never stock-photo-style portrait photography
- Full-bleed only in hero sections of the website, never inside UI cards

---

## Iconography

**System:** Lucide icons — stroke style, 1.5px stroke weight, 24px base size.

| Usage | Size |
|---|---|
| Sidebar navigation | 20px |
| Card actions | 20px |
| Inline with body text | 16px |
| Hero/feature icons | 32px |

Icons are always `currentColor` — they inherit the surrounding text color. No colorful icons. See `ui_kits/fund-portal/Icons.jsx` for a self-contained React implementation of the core icon set.

**Core icon set used:**
`layout-dashboard` · `briefcase` · `git-branch` · `file-text` · `users` · `settings` · `plus` · `search` · `arrow-right` · `external-link` · `x` · `trending-up` · `trending-down` · `dollar-sign` · `activity` · `building-2` · `check` · `alert-circle` · `chevron-right`

---

---

## Sub-brand Architecture — Haus Houses

Haus Fund operates **12 geographically-anchored residency tracks**, each a specialist house at the intersection of a city's competitive advantage and a deeptech thesis. All share the unified HAUS house mark; each gets its own PREFIX, accent palette, and domain motif.

### Wordmark construction rule
> **[PREFIX 900]** + **[HAUS 400]** — Barlow ExtraBold prefix, Barlow Regular suffix, all caps, 0.04–0.08em tracking.

```
FABHAUS    → FAB (Barlow 900) + HAUS (Barlow 400)
CELLHAUS   → CELL (Barlow 900) + HAUS (Barlow 400)
SENSORHAUS → SENSOR (Barlow 900) + HAUS (Barlow 400)
```

### The 12 houses

| # | House | City | Thesis | Token |
|---|---|---|---|---|
| 1 | **CellHaus** | Kobe, Japan | Allogeneic Cell Therapy | `--house-cell-bg` `#C4D8E8` |
| 2 | **TrialHaus** | Australia | Clinical Trials | `--house-trial-bg` `#C0E0D0` |
| 3 | **OncHaus** | New York | Oncology | `--house-onc-bg` `#F0D890` |
| 4 | **ToolHaus** | Boston | Tools Development | `--house-tool-bg` `#C0CCD8` |
| 5 | **BioHaus** | Mexico | Industrial Biotech | `--house-bio-bg` `#A0D878` |
| 6 | **PharmHaus** | Puerto Rico | Pharma Manufacturing | `--house-pharm-bg` `#D4E8F4` |
| 7 | **DiagHaus** | United Kingdom | Diagnostics / Challenge Trials | `--house-diag-bg` `#E8C4C4` |
| 8 | **DeSciHaus** | Buenos Aires | DeSci / Agriculture | `--house-desci-bg` `#B8D898` |
| 9 | **LuxHaus** | Paris | Luxury Technology | `--house-lux-bg` `#F0E0B0` |
| 10 | **SensorHaus** | Zurich | Sensor Development | `--house-sensor-bg` `#D4D8E4` |
| 11 | **CROHaus** | Shanghai | Contract Research | `--house-cro-bg` `#F0C8C0` |
| 12 | **FabHaus** | Shenzhen | Fabrication | `--house-fab-bg` `#C8D4E4` |

### Competitive advantages
- **CellHaus (Kobe):** Kobe Biomedical Innovation Cluster, Japan's advanced cell-therapy regs + manufacturing
- **TrialHaus (AU):** 43.5% R&D tax rebate + fast CTN approval for Phase I/II trials
- **OncHaus (NY):** MSK + Columbia KOL network; dense pharma M&A ecosystem
- **ToolHaus (Boston):** MIT/Harvard pipeline + Flagship ecosystem — densest biotech VC on earth
- **BioHaus (Mexico):** Low-cost biomanufacturing scale-up; US nearshoring tailwind
- **PharmHaus (PR):** Act 60 tax + J&J / Amgen / AbbVie infrastructure under US jurisdiction
- **DiagHaus (UK):** Wellcome Trust + CEPI; progressive challenge-trial framework
- **DeSciHaus (BA):** DeSci community + agri-biotech opportunity in Southern Cone
- **LuxHaus (Paris):** LVMH ecosystem + French engineering grandes écoles
- **SensorHaus (Zurich):** ETH Zurich precision-engineering pipeline
- **CROHaus (Shanghai):** China CRO market + NMPA regulatory strategy
- **FabHaus (Shenzhen):** Deep hardware supply chain + PCB/PCBA manufacturing density

### How to extend
1. Identify a city with a structural competitive advantage for a specific deeptech thesis
2. Name the house: `[DOMAIN]HAUS` — prefix should be 2–6 characters, all caps
3. Derive a `--house-{name}-bg` color that signals the domain and geography
4. Apply the wordmark rule: prefix at Barlow 900, HAUS at Barlow 400

---

## File Index

```
styles.css                     ← Global CSS entry (imports only)
fonts.css                      ← Google Fonts CDN imports
tokens/
  colors.css                   ← Ink, canvas, forest, bronze, steel, semantic
  typography.css               ← Font families, type scale, weights, tracking
  spacing.css                  ← Spacing scale + layout containers
  effects.css                  ← Shadows, radii, easing, transitions
assets/
  logo.png                     ← Primary logomark + wordmark (black on off-white)
  brand-concepts.png           ← Sub-brand reference sheet (source material)
guidelines/
  colors-ink.card.html         ← Foreground color swatches
  colors-canvas.card.html      ← Background color swatches
  colors-forest.card.html      ← Forest accent palette
  colors-bronze.card.html      ← Bronze accent palette
  colors-steel.card.html       ← Steel accent palette
  colors-semantic.card.html    ← Status / semantic colors
  type-display.card.html       ← Display type specimens
  type-body.card.html          ← Body & UI type specimens
  type-scale.card.html         ← Full type scale table
  spacing-tokens.card.html     ← Spacing token visualization
  effects-shadows.card.html    ← Shadow scale
  effects-radii.card.html      ← Border radius scale
  brand-logo.card.html         ← Logo usage: light + dark
  brand-wordmark.card.html     ← Wordmark + clear space
components/
  core/                        ← Button, Badge, Tag, Avatar, Card, StatCard
  forms/                       ← Input, Select
ui_kits/
  fund-portal/                 ← Investor portal UI kit (interactive prototype)
    index.html                 ← Full portal prototype
    Dashboard.jsx              ← Fund overview + portfolio highlights
    Portfolio.jsx              ← Portfolio company list
    CompanyDetail.jsx          ← Individual company view
    DealFlow.jsx               ← Incoming deal pipeline
    Sidebar.jsx                ← Navigation sidebar
    Icons.jsx                  ← Lucide icon components
readme.md                      ← This file
SKILL.md                       ← Claude Code skill definition
```
