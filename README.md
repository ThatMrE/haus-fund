# Haus — Website

The public marketing site for Haus, the live-in biotech accelerator. Static HTML, no build step.

```
site/
├── index.html        # Home — hero, thesis, program, nodes, ecosystem
├── expansion.html    # Global Nodes — node protocol + candidate cities
├── assets/
│   ├── logo-mark.svg
│   └── logo-white.svg
└── netlify.toml       # publish dir, redirects, headers
```

Fonts load from Google Fonts over CDN; everything else is self-contained.

## Push to GitHub

From inside this `site/` folder:

```bash
git init
git add .
git commit -m "Haus website"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

## Deploy to Netlify

**Option A — connect the repo (auto-deploys on push):**
1. Netlify → Add new site → Import an existing project → pick the GitHub repo.
2. Build command: *(none)* · Publish directory: `.`
3. Deploy.

**Option B — drag & drop:** drop this `site/` folder onto https://app.netlify.com/drop.

**Option C — CLI:**
```bash
npm i -g netlify-cli
netlify deploy --prod --dir .
```
