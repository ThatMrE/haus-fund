---
name: haus-fund-design
description: Use this skill to generate well-branded interfaces and assets for Haus Fund, a $20M deeptech investment fund. Contains essential design guidelines, colors, typography, fonts, assets, and UI kit components for prototyping investor portals, fund websites, LP reports, and pitch materials.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, pitch decks, LP reports, etc), copy assets out and create static HTML files for the user to view. If working on production code, read the token CSS files and component source to become an expert in designing with this brand.

If the user invokes this skill without other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

## Key brand principles
- Near-black on warm off-white — no heavy gradients, no glass morphism
- Bauhaus-inspired geometry: precise, functional, minimal
- Forest green (--forest-2: #1C3B2D) as primary accent; warm bronze (--bronze-3: #B8924A) as secondary
- Barlow Condensed for impact headlines; DM Sans for all body/UI text
- ALL CAPS for primary display headlines; sentence case for everything else
- No emoji in formal materials; no exclamation marks
- Numbers always as digits ($20M, not "twenty million")

## Available components
Button · Badge · Tag · Avatar · Card · StatCard · Input · Select

## File structure
- `styles.css` — global CSS entry point
- `tokens/` — colors, typography, spacing, effects
- `assets/logo.png` — primary logomark
- `components/core/` — Button, Badge, Tag, Avatar, Card, StatCard
- `components/forms/` — Input, Select
- `ui_kits/fund-portal/` — full investor portal UI kit
- `guidelines/` — design specimen cards
