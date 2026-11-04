# Contributing to this repo

**This repo does not deploy haus.fund.** haus.fund is the Lovable app. This repo
holds `/news`, `/homeroom`, the program pages, the design system and the tools.
Until they get their own Netlify project, they are not live on haus.fund.

## The one rule

**Every change goes through a pull request into `main`.** CI checks every PR.
Do not connect this repo to the `haus-fund` Netlify project: only the Lovable
app publishes there.

## How to make a change

1. Branch from `main`: `git checkout -b your-name/what-you-change`.
2. Edit. Each page is a single HTML file; design values live in `tokens/`.
3. Run the checks: `node scripts/check-site.mjs`. No install is needed.
4. Push and open a pull request. The template lists what to check.
5. Once this repo has its own Netlify project, Netlify posts a **deploy
   preview** link on each PR. Review the pages there.
6. A code owner (see `.github/CODEOWNERS`) reviews. When CI is green and the
   review is approved, merge.

## Do not

- **Do not run `netlify deploy --prod`.** It ships your local folder, skips git,
  and overwrites what `main` published. See `CONNECT-GIT.md`.
- **Do not connect this repo to the `haus-fund` Netlify project.** Two sources
  publishing to one project overwrite each other.
- **Do not commit secrets or private data.** `publish = "."` serves every file in
  this repo on whatever site deploys it. Keys belong in Netlify environment variables.
- **Do not push straight to `main`.** Branch protection should block it.

## What CI checks

The `Site checks` workflow runs on every PR:

| Job | What it catches |
|-----|-----------------|
| Links and public files | Broken internal links and images. A `.md` file that `_redirects` does not block, which would go live. |
| News app tests | Regressions in `/news`. |
| Homeroom app tests | Regressions in `/homeroom`. |

## Repo settings an admin must turn on

These live in GitHub and Netlify settings, not in files:

- GitHub → Settings → Branches → protect `main`: require a pull request,
  one approval, review from Code Owners, and the three `Site checks` jobs.
  Block force pushes.
- GitHub → Settings → Collaborators: add each contributor with **Write** access.
- Netlify: to bring `/news` and `/homeroom` back, create a separate Netlify
  project for this repo with its own subdomain (for example `news.haus.fund`),
  production branch `main`, deploy previews on.
