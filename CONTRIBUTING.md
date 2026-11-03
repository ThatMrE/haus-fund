# Contributing to haus.fund

Several people edit this site. These rules keep their work from overwriting
each other's.

## The one rule

**Every change reaches production through a pull request into `main`.**
Netlify deploys `main` automatically. Nothing else should publish to the
`haus-fund` Netlify project.

## How to make a change

1. Branch from `main`: `git checkout -b your-name/what-you-change`.
2. Edit. Each page is a single HTML file; design values live in `tokens/`.
3. Run the checks: `node scripts/check-site.mjs`. No install is needed.
4. Push and open a pull request. The template lists what to check.
5. Netlify posts a **deploy preview** link on the PR. Review the pages there.
6. A code owner (see `.github/CODEOWNERS`) reviews. When CI is green and the
   review is approved, merge. Netlify publishes within a minute.

## Do not

- **Do not run `netlify deploy --prod`.** It ships your local folder, skips git,
  and overwrites what `main` published. See `CONNECT-GIT.md`.
- **Do not connect another tool (Lovable, a second repo) to the `haus-fund`
  Netlify project.** Two sources publishing to one project overwrite each
  other. The last one to deploy wins, and the other's work silently goes away.
- **Do not commit secrets or private data.** `publish = "."` serves every file in
  this repo at haus.fund. Keys belong in Netlify environment variables.
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
- Netlify → `haus-fund` → Build & deploy: the linked repository is this repo,
  the production branch is `main`, and deploy previews are on.
