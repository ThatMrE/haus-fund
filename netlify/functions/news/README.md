# haus.fund/news

A community-ranked feed of early-stage biotech startup news — seed and Series A
rounds, spinouts, launches out of stealth, and the tools behind them. Served at
`/news` on the main site, so it shares the domain, the design system, and the
navigation.

Zero npm dependencies: `node:sqlite` for storage, `node:http` for the server,
`node:crypto` scrypt for passwords, tagged template literals for views.

```bash
cd netlify/functions/news
npm run seed          # sample content, so there is something to look at
npm start             # http://localhost:8787
npm test              # 83 tests, no network
npm run ingest -- --dry   # show what the morning run would post
```

## Layout

```
netlify/functions/
├── news/
│   ├── index.mjs         Netlify entry point — claims /news and /news/*
│   ├── server.js         local dev server
│   ├── app/
│   │   ├── app.js        routing, page handlers, JSON API, RSS
│   │   ├── models.js     data layer: items, votes, comments, feeds, search
│   │   ├── db.js         SQLite schema, migrations, transactions
│   │   ├── rank.js       the ranking formula
│   │   ├── ingest.js     the morning feed sweep
│   │   ├── sources.js    the feeds it reads
│   │   ├── relevance.js  what counts as early-stage biotech
│   │   ├── feed-parser.js  RSS/Atom, no dependencies
│   │   ├── schedule.js   when the run happens
│   │   ├── auth.js       scrypt hashing, sessions, CSRF
│   │   └── views/        layout, components, pages
│   └── test/             unit and HTTP integration tests
└── news-ingest.mjs       the scheduled function
```

Static assets live at the repo root in `news-assets/` so the CDN serves them;
the stylesheet imports the site's own `tokens/*.css`, so the feed inherits any
change to the design system automatically.

## Where stories come from

**The morning run.** `news-ingest.mjs` is scheduled hourly and runs the sweep
when the clock reaches `NEWS_RUN_HOUR` (default 7) in `NEWS_TZ` (default
`America/New_York`). Netlify's cron is UTC only, so a fixed UTC hour would drift
by an hour at each daylight-saving change; the hourly-plus-guard arrangement
keeps 7am meaning 7am year round.

Each run reads the feeds in `sources.js`, keeps entries that read as early-stage
*and* biotech, drops anything already on the site, caps each source at 3 and the
run at 12, and posts what survives under a per-source account (`feed-endpoints`,
`feed-fierce-biotech`, and so on) created on first use. A source that times out
or 404s is logged and skipped; it never fails the run. Posting is idempotent, so
a repeated run adds nothing twice.

**Members.** Anything a person submits. A member submission sits above every
machine-posted story for 24 hours and then rises or falls on votes, keeping a
smaller boost thereafter — someone who saw it first should beat a crawler that
saw it second. Machine posts carry an `Auto` tag on the row.

Tune the behaviour in `rank.js` (`HUMAN_PRIORITY_HOURS`, `HUMAN_BOOST`) and
`ingest.js` (`MAX_PER_RUN`, `MAX_PER_SOURCE`, `MAX_AGE_HOURS`).

### Adding a source

Append to `SOURCES` in `sources.js`. The account, the tagging, and the caps
follow automatically. `weight` nudges the relevance score for outlets that cover
financing closely.

The feed URLs are the publishers' advertised endpoints and were not reachable
from the sandbox this was built in, so verify them against a live run —
`npm run ingest -- --dry` prints what each source returned without writing
anything.

## Ranking

```
score = (points - 1 + 0.25 × comments) / (age_hours + 2) ^ 1.8
        × 0.5 ^ flags
        × 0.65 ^ (earlier stories from the same domain on the page)
        × 3 if posted by a member rather than the ingest

member submissions under 24 hours old sort above everything else
```

## Environment

| Variable | Default | Notes |
| --- | --- | --- |
| `NEWS_BASE_PATH` | `/news` | Mount point. Set to empty to serve at a domain root. |
| `NEWS_STATIC_BASE` | `/news-assets` | Where the stylesheet and client script are served from. |
| `NEWS_TZ` | `America/New_York` | Timezone the run hour is measured in. |
| `NEWS_RUN_HOUR` | `7` | Hour of day for the morning run. |
| `NEWS_INGEST_FORCE` | — | `1` runs the sweep on every invocation, ignoring the schedule. |
| `BIOPUNK_DB` | `/tmp/haus-news.db` | SQLite file. |
| `BIOPUNK_SECRET` | random per boot | Set in production, or CSRF tokens rotate on restart. |

## Storage: read this before launching

Netlify functions have an ephemeral filesystem. The database lives in `/tmp`,
which means **a cold container starts from nothing**: accounts, votes, comments,
and member submissions do not survive, and two concurrent containers do not
share state. The morning run re-populates stories from the live feeds, so the
page looks right, which is exactly what makes this easy to miss.

That is fine for reviewing the design and the flows. It is not fine for a site
people are asked to post to. Before launch, storage has to move to something
durable — either run the app as a single process against a real volume (it is
one Node process and one SQLite file; the `Dockerfile` pattern from the original
repo still applies), or swap `db.js` for a hosted Postgres or Turso instance.
Everything above `db.js` is written against a small query surface, so the second
option is a contained change.
