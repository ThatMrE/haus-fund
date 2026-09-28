# biopunk-news.netlify.app

The Haus Feed, standalone: the same app that runs at haus.fund/news, mounted at
this site's root instead.

## How it is wired

Netlify gives a project one base directory, and the app lives outside this one,
so `build.mjs` copies what it needs in at build time. Nothing here is a second
copy of the app — `functions/` and `public/` are generated and gitignored.

| File | What it is |
| --- | --- |
| `netlify.toml` | the site's build, functions and headers |
| `entry.mjs` | the mount: root paths, asset exclusions, `NEWS_SITE_ORIGIN` |
| `build.mjs` | assembles `functions/` and `public/` from the repo |

## Netlify setup

Set the project's **base directory** to `sites/biopunk-news`. Everything else
comes from `netlify.toml`.

Environment variables: the same ones the feed takes everywhere else, documented
in `netlify/functions/news/README.md`. In particular this site needs its own
`TURSO_DATABASE_URL` — otherwise it runs on SQLite in `/tmp` and loses accounts,
votes and scout points whenever a container is recycled.

## Build it locally

```bash
cd sites/biopunk-news && node build.mjs
```
