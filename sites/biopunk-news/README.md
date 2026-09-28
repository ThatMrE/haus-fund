# biopunk-news.netlify.app

The Haus Feed, standalone: the same app that runs under `/news`, mounted at this
site's root instead.

This site is **deployed by hand**, on purpose. It is not connected to git.

## Deploying

```bash
cd sites/biopunk-news
node build.mjs --bundle
cd dist && npx -y @netlify/mcp@latest --site-id <site-id> --proxy-path <proxy>
```

`dist/` is self-contained and carries its own `netlify.toml` with **no build
command**, because the building already happened. That detail is the whole
reason this mode exists: a manual upload sends only the directory it is given,
so the committed `netlify.toml`'s `command = "node build.mjs"` would run without
the repo it copies from, and the deploy fails during the build stage. The first
attempt at this failed exactly that way.

## How it is wired

Netlify gives a project one base directory, and the app lives outside this one,
so `build.mjs` copies what it needs in. Nothing here is a second copy of the
app — `public/`, `functions/` and `dist/` are generated and gitignored.

| File | What it is |
| --- | --- |
| `netlify.toml` | build, functions and headers, for a git-connected build |
| `entry.mjs` | the mount: root paths, asset exclusions, `NEWS_SITE_ORIGIN` |
| `build.mjs` | assembles the site; `--bundle` writes a ready-to-upload `dist/` |

## If you ever connect it to git

Everything needed is already committed. Set the project's **base directory** to
`sites/biopunk-news` and leave build command, publish directory and functions
directory **blank** — `netlify.toml` sets all three, and a value typed into the
UI overrides the file and resolves against the repo root instead, which is the
usual reason a first build fails here.

## Environment

The same variables the feed takes everywhere else, documented in
`netlify/functions/news/README.md`. Environment variables do not come from git,
so this project needs its own — in particular `TURSO_DATABASE_URL`, without
which the feed runs on SQLite in `/tmp` and loses accounts, votes and scout
points whenever a container is recycled.
