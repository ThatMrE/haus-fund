# Connect haus.fund → GitHub (ThatMrE/haus-fund) → auto-deploy

One-time setup so every change to this `website/` folder deploys to **haus.fund** automatically. Run on your own machine (Git is flaky on the OneDrive mount from the sandbox, fine locally). Repo: https://github.com/ThatMrE/haus-fund

Already prepared in this folder:
- `.gitignore` (excludes local Netlify state, old `deploy-*.zip`, `*.bak`/backup HTML)
- `netlify.toml` (`publish = "."`, www→apex redirects, security headers)
- All site changes staged: Airtable Apply embed + links, Mentors page, nav/footer links.

## Step 0 — delete the stray .git folder
A partial repo was created during setup and the sandbox couldn't remove it. In the `website` folder, delete the hidden `.git` folder first:
```bash
rm -rf .git           # Windows: rmdir /s /q .git  (or delete in Explorer with hidden files shown)
```

## Step 1 — is the repo empty or does it already have files?
Open https://github.com/ThatMrE/haus-fund and check.

### Case A — repo is EMPTY → push this folder straight in
From inside the `website` folder:
```bash
git init
git branch -M main
git add -A
git commit -m "Haus website: Airtable application form, Mentors page, nav/footer"
git remote add origin https://github.com/ThatMrE/haus-fund.git
git push -u origin main
```

### Case B — repo ALREADY has content → merge cleanly (don't overwrite blindly)
Clone it next to this folder, copy the current website files in, then commit:
```bash
# in a scratch location
git clone https://github.com/ThatMrE/haus-fund.git haus-fund-repo
cp -R "<path to>/Biopunk VC/website/." haus-fund-repo/   # copies files incl. .gitignore & netlify.toml
cd haus-fund-repo
git add -A
git commit -m "Update site: Airtable application form, Mentors page, nav/footer"
git push origin main         # (or your default branch name)
```
Review the diff on GitHub before/after to make sure nothing important was clobbered.

## Step 2 — link the EXISTING haus-fund Netlify site to the repo (keeps haus.fund)
Netlify → open the **haus-fund** project → **Site configuration → Build & deploy → Continuous deployment → Link repository** → GitHub → select **ThatMrE/haus-fund**. Set:
- Branch to deploy: `main` (or your default)
- Build command: (empty — static site)
- Publish directory: `.`

Do NOT create a new Netlify site — linking the repo to the existing haus-fund site keeps the haus.fund domain and settings.

## Step 3 — from now on
```bash
git add -A && git commit -m "what changed" && git push
```
Netlify auto-builds + deploys in ~1 min; pull requests get preview URLs.

---
Tip: if you ever add a GitHub tool/connector in here, I can commit and push site changes directly — you'd never touch the terminal.
