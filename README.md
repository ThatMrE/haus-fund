# Haus — Website

The public marketing site for Haus, the live-in biotech accelerator. Static HTML,
no build step, no framework.

## Pages

| File | Purpose |
|---|---|
| `index.html` | Home — hero, thesis, program, what you get, nodes, ecosystem, apply |
| `sponsors.html` | Partnerships — audiences, sponsorship tiers, FAQ |
| `mentors.html` | Mentor roster and mentor signup |
| `expansion.html` | Global Nodes — node protocol, active nodes, candidate cities |
| `design-system.html` | Living style reference — tokens, type, components |
| `showcase.html` | 2050 Final Showcase — venue design brief for the Mabuhay Gardens event |
| `cores.html` | Core Facility Finder — served at `cores.haus.fund`, `noindex`, not in the nav |
| `visa.html` | Visa Desk — immigration support letters, served at `visa.haus.fund`, `noindex`, not in the nav |
| `fund-portal/` | Separate internal React portal (not linked from the public nav) |
| `homeroom/` | **Homeroom** — the members-only network, served at `/homeroom`, `noindex`. Forum, member and lab directories, deals, funder reviews, pipeline, office hours, jobs, events, library, intros, messaging. Runs on Supabase; see `homeroom/README.md` |

## Structure

```
website/
├── index.html · sponsors.html · mentors.html · expansion.html · showcase.html
├── cores.html · cores.js            # Core Facility Finder
├── visa.html · visa.js · visa-data.js  # Visa Desk (visa-data.js is the data layer)
├── design-system.html
├── fund-portal/          # internal portal (JSX)
├── homeroom/             # members-only network (static + Supabase)
├── assets/               # logos, photos (web/ and thumb/ variants)
├── tokens/               # colors, typography, spacing, effects
├── tools/                # tool docs (core-facility-finder/, visa-letter-generator/)
├── fonts.css · styles.css
├── netlify.toml          # publish dir, redirects, security headers
└── _redirects            # www → apex, catch-all to homepage
```

Each page embeds its own CSS in a `<style>` block. `tokens/` is the canonical
source for design values — see `design-system.html` for them rendered.

## Design

- **Canvas** `#F8F7F3` warm off-white · **Ink** `#0D0D0D` near-black
- **Forest** `#1C3B2D` primary CTA and dark sections · **Brass** `#B8924A` accent
- **Type**: Barlow and Barlow Condensed (headings), DM Sans (body), DM Mono (data)

Fonts load from Google Fonts; everything else is self-contained.

## Deploying

Continuous deployment is live from [ThatMrE/haus-fund](https://github.com/ThatMrE/haus-fund).
Push to `main` and the site builds and publishes automatically:

```bash
git add -A && git commit -m "what changed" && git push
```

See `CONNECT-GIT.md` for the full setup, how to inspect a deploy, and why
`netlify deploy --prod` should be avoided.

## Everything here is public

`netlify.toml` sets `publish = "."`, so **every file in this repo is served at
haus.fund**, including this README and the other markdown docs. Don't commit
anything here you wouldn't publish — internal numbers, personal contact details,
or credentials.

Local-only files are listed in `.gitignore` (old `deploy-*.zip` archives, `*.bak`,
`index.legacy-backup.html`) and stay off the site.

## Contact

elliot@haus.fund
