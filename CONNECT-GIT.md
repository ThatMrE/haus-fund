# Deploying haus.fund

**Continuous deployment is live.** Push to `main` and Netlify builds and publishes
haus.fund automatically, usually in well under a minute.

```bash
git add -A
git commit -m "what changed"
git push
```

That's the whole workflow. No zip uploads, no CLI deploy.

## The setup

| | |
|---|---|
| Repo | [ThatMrE/haus-fund](https://github.com/ThatMrE/haus-fund) |
| Deploy branch | `main` |
| Build command | *(none — static site)* |
| Publish directory | `.` (set by `netlify.toml`) |
| Netlify project | [haus-fund](https://app.netlify.com/projects/haus-fund) |
| Domain | haus.fund (www redirects to apex) |

Pull requests get their own preview URL automatically.

## Don't use `netlify deploy --prod`

It still works, but it uploads your local folder directly and **bypasses git**. The
result is a deploy Netlify records as `manual`, with no commit attached, which
overrides whatever CD just published.

That matters because a manual deploy ships your working directory — including any
uncommitted or half-finished edits — with nothing in git recording what went live.
If the site later looks out of step with `main`, a stray manual deploy is the first
thing to check.

Use it only to recover when CD itself is broken.

## Checking a deploy

```bash
# recent deploys — entries with a commit hash came from git, "manual" ones did not
netlify api listSiteDeploys --data '{"site_id":"b85de1d6-8226-4c4b-b269-8e0a82e66b37"}'

# what is published right now
netlify status
```

Build logs: https://app.netlify.com/projects/haus-fund/deploys

## What gets published

`netlify.toml` sets `publish = "."`, so **every file in the repo is served**, not just
the pages. That includes the design-system bundle (`_ds_bundle.js`, `_ds_manifest.json`,
`SKILL.md`, `DESIGN-SYSTEM.md`, `HAUS Houses.html`). Treat anything you commit here as
public.

Local-only files listed in `.gitignore` — the old `deploy-*.zip` archives, `*.bak`, and
`index.legacy-backup.html` — stay out of the repo and off the site. The `/*` catch-all in
`_redirects` sends unknown paths to the homepage.
