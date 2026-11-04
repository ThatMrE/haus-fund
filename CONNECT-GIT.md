# Deploying haus.fund

**Continuous deployment is live.** Push to `main` and Netlify builds and publishes
haus.fund automatically, usually in well under a minute.

```bash
git add -A
git commit -m "what changed"
git push
```

That's the whole workflow. No zip uploads, no CLI deploy.

> **Changed (2026-11-04): this repo now deploys to `news.haus.fund`, not haus.fund.**
> haus.fund is the Lovable app. This repo moves to its own Netlify project,
> `haus-homeroom`, on `news.haus.fund`. There, `/` redirects to `/news`, and
> `/homeroom`, `/biopunk`, `/skilltree`, `/lp` and the tool pages keep their paths.
> See "news.haus.fund setup" below. The rest of this file describes the old
> haus.fund setup.

## news.haus.fund setup

One-time steps. Each needs an admin of the named service.

0. **GitHub: move this repo into the org.** Settings → General → Danger Zone →
   Transfer → `Haus-Fund`. Netlify then links to `Haus-Fund/haus-fund`.
1. **Netlify: link the repo.** Use the existing `haus-homeroom` project: it
   already runs this repo's functions (uploaded 2026-11-03). Delete the empty
   `haus-news` project, which duplicates it. In `haus-homeroom` → Project
   configuration → Build & deploy → Link repository → this repo, branch `main`.
   `netlify.toml` sets the publish directory and functions. Turn deploy
   previews on. Turn off team login for production (Access & security), or
   the feed stays private.
2. **Netlify: check the environment variables.** `haus-homeroom` needs every
   variable the functions read: the `HOMEROOM_*`, `NEWS_*`, `BIOPUNK_*`,
   `SUPABASE_*`, `AIRTABLE_TOKEN`, `LUMA_*`, `DATABASE_URL` and `LP_PASSWORD`
   keys. Copy any that are missing from the `haus-fund` project. Set
   `HOMEROOM_BASE_URL=https://news.haus.fund` (mail links use it).
3. **Netlify: add the domain.** `haus-homeroom` → Domain management → add
   `news.haus.fund`.
4. **Cloudflare: add the DNS record.** Zone `haus.fund` → DNS → `CNAME news →
   haus-homeroom.netlify.app`, proxy **off** (DNS only), so Netlify can issue
   the TLS certificate. `cores` and `visa` can point at the same target; the
   edge function already serves them.
5. **Supabase: allow the new origin.** Authentication → URL configuration → add
   `https://news.haus.fund/**` to the redirect URLs.
6. **Lovable app: forward old links.** Add 301 redirects on haus.fund:
   `/news/*` → `https://news.haus.fund/news/:splat` and `/homeroom/*` →
   `https://news.haus.fund/homeroom/:splat`.
7. **Check.** `https://news.haus.fund/` lands on the feed. `/homeroom/login`
   loads. A sign-in round trip works.

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

`cores.haus.fund` serves the Core Facility Finder. It is a **domain alias of
this same Netlify project**, not a separate site — both hostnames resolve to the
same publish directory, and `netlify/edge-functions/cores-host.js` rewrites `/`
to `/cores.html` when the Host is `cores.haus.fund`. Every other path is left
alone, so the shared assets, fonts and data files work on both hostnames.

`_redirects` cannot branch on the Host header, only on path — that is why the
host check is an edge function rather than a redirect rule.

Note that `fightclub.haus.fund` uses the other pattern: its own Netlify project
(`pitch-fight-club`) with its own repo. Either is fine. The alias is right when
the page already lives in this repo and shares its design system; a separate
project is right when the thing is genuinely independent.

### Pointing a new subdomain

Two steps, both outside this repo:

1. **Netlify** → [Domain management](https://app.netlify.com/projects/haus-fund/configuration/domain)
   → *Add a domain alias* → `cores.haus.fund`. Netlify then tells you which
   record it wants.
2. **DNS** — wherever haus.fund's zone is hosted:
   - *If the zone is on Netlify DNS*, adding the alias creates the record for
     you. Nothing else to do.
   - *If the zone is at an external registrar*, add a `CNAME` for `cores`
     pointing at `haus-fund.netlify.app`. Do not point it at an IP; Netlify's
     load balancer addresses change.

TLS is provisioned automatically once the record resolves, usually within a few
minutes. Until then the subdomain serves a certificate warning, which is
expected and clears on its own.

To add another tool subdomain later, add a line to `HOSTS` in
`netlify/edge-functions/cores-host.js` and repeat the two steps above.

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
