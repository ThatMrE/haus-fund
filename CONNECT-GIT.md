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

## If builds fail at "preparing repo"

Symptom: deploys error with *"Unable to access repository … Host key verification
failed"*, while the repo itself is fine and your commits are on GitHub.

Cause: Netlify clones over SSH, and the repo had **no deploy key**. The site is
linked through the Netlify GitHub App (`installation_id` is set), which normally
clones over HTTPS — but when it falls back to SSH there must be a deploy key on
the repo for the clone to succeed.

Fix, in order:

```bash
# 1. Is there a deploy key on the repo? An empty list is the problem.
gh api repos/ThatMrE/haus-fund/keys

# 2. Get Netlify's public key (list keys first if the id differs)
netlify api listDeployKeys --data '{}'
netlify api getDeployKey --data '{"key_id":"<id>"}'

# 3. Add it to the repo, read-only
gh api repos/ThatMrE/haus-fund/keys -f title="Netlify deploy key" -f key="<public_key>" -F read_only=true

# 4. Point the site at it
netlify api updateSite --data '{"site_id":"<site_id>","body":{"build_settings":{"deploy_key_id":"<id>"}}}'

# 5. Trigger a build
netlify api createSiteBuild --data '{"site_id":"<site_id>"}'
```

The deploy key is read-only: it lets Netlify clone, never push.

Check [githubstatus.com](https://www.githubstatus.com) first — a GitHub incident
produces similar-looking failures and needs no config change at all.

## Subdomains

Each tool in this repo has its own hostname. All of them are **domain aliases
of the one Netlify project that deploys this repo**, not separate sites: every
hostname resolves to the same publish directory, and
`netlify/edge-functions/cores-host.js` rewrites `/` to the tool's page when the
Host matches. Every other path is left alone, so the shared assets, fonts and
data files work on every hostname.

| Hostname | Serves | Kind |
|---|---|---|
| `cores.haus.fund` | `/cores.html` — Core Facility Finder | static page |
| `visa.haus.fund` | `/visa.html` — Visa Desk | static page |
| `skilltree.haus.fund` | `/skilltree.html` — Biopunk Skill Tree | static page |
| `news.haus.fund` | `/news` — the Haus Feed | server-rendered app |
| `homeroom.haus.fund` | `/homeroom` — Homeroom, members only | server-rendered app |

The host map is `HOSTS` in `cores-host.js`. `node --test
netlify/edge-functions/*.test.js` checks it.

For the two apps only `/` is rewritten. The app renders its own links with its
path prefix, so the next request is `news.haus.fund/news/...`, and the function
that owns `/news/*` answers it on any hostname. The apex stays the canonical
address.

`/lp` is deliberately **not** in the map. The LP section sits behind the
`lp-auth` edge function, declared for `/lp` and `/lp/*`; a rewrite from `/`
would reach the files without passing through that check.

`_redirects` cannot branch on the Host header, only on path — that is why the
host check is an edge function rather than a redirect rule.

Note that `fightclub.haus.fund` uses the other pattern: its own Netlify project
(`pitch-fight-club`) with its own repo. Either is fine. The alias is right when
the page already lives in this repo and shares its design system; a separate
project is right when the thing is genuinely independent.

### Pointing a subdomain

Two steps, both outside this repo. Repeat them for each hostname in the table.

1. **Netlify** → the project that deploys this repo → *Domain management* →
   *Add a domain alias* → the hostname.
2. **DNS** — the `haus.fund` zone is on **Cloudflare** (nameservers
   `huxley.ns.cloudflare.com` and `kallie.ns.cloudflare.com`). Add a `CNAME`
   for the subdomain label (`cores`, `visa`, `skilltree`, `news`, `homeroom`)
   pointing at the project's `*.netlify.app` hostname, **DNS only** (grey
   cloud, not proxied), so Netlify can issue the certificate. Do not point it
   at an IP; Netlify's load balancer addresses change.

TLS is provisioned automatically once the record resolves, usually within a few
minutes. Until then the subdomain serves a certificate warning, which is
expected and clears on its own.

Check with `curl -sI https://cores.haus.fund/ | head -1` — a 200, and the
page title from `cores.html`, means the alias, the record and the rewrite all
agree.

### The project must deploy *this* repo

The aliases follow the Netlify project, and the project follows whichever
repository it is linked to under *Build settings*. If haus.fund serves pages
this repo does not contain, or every page in this repo answers 404 on the apex,
the project has been linked to a different repository. The deploy log names
the repo and commit for each deploy: a commit URL outside `ThatMrE/haus-fund`
is the sign. Relink the project, or attach the aliases to the project that does
deploy this repo.

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
