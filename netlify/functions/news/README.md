# haus.fund/news — the Haus Feed

The front page of early-stage biotech: roughly half the board surfaced by agents
watching the primary sources, half by founders, scouts and the Discord, with a
review step in between and credit on every row.

Server-rendered, no build step, **no npm dependencies**. Node 22.5 or newer.

```bash
npm test                 # 134 tests, no network
npm start                # http://localhost:8787
npm run seed             # fictional sample content to look at
npm run ingest -- --dry  # what every agent returns, writing nothing
```

## Where the board comes from

### The agents — about half the page

Seven of them, in `app/agents/`. Each watches one kind of source, normalises
what it finds, and hands it back; it does not decide what gets posted. That is
`ingest.js`, which pools everything, filters, de-duplicates and caps — so the
policy lives in one place and each agent stays small.

| Agent | Watches | Why it is here |
| --- | --- | --- |
| `biorxiv` | bioRxiv and medRxiv, in the categories companies get founded out of | the science before the company |
| `form-d` | new Form D filings from life-science filers | the first public sign that money moved, often weeks before the announcement |
| `nih` | NIH SBIR and STTR awards | the grants that go to companies rather than campus labs |
| `arpa-h` | ARPA-H programs, solicitations and awards | a new program is an invitation to a company that does not exist yet |
| `wires` | the biotech trade press (`app/sources.js`) | the announcements themselves |
| `calendars` | city meetups, talks and open lab nights | what is happening, and where |
| `accounts` | Bluesky, Mastodon and X (`app/accounts-list.js`) | what the field is posting about right now |

Two kinds of agent, and the difference matters. A Form D filing or an NIH award
is on-topic because of where it came from, so it skips the text filter. The
wires and the accounts carry everything, so their output goes through the
early-stage relevance rules in `relevance.js` and most of it is thrown away.

Caps: 5 per agent, 3 per domain, 24 per run. An agent that throws is recorded
and the run carries on.

### The people — the other half

Members submit at `/submit`; the Discord and any other channel post to
`/api/surface`. Both land in the same review queue.

**The review step.** A new account's submissions wait for a reviewer at
`/review`. A fresh database has no users, so set `NEWS_ADMINS` to the handles
that should be able to clear the queue before anyone signs up — otherwise the
first member is untrusted and nobody can approve them. After three cleared submissions the account is trusted and posts
straight to the board. Approving dates the item from the moment it cleared, so
its day at the top is a day of actually being seen.

**Credit.** Every row says who surfaced it. When the byline is the credit, it is
not repeated; it shows when they differ — posted on someone's behalf, or carried
in from a channel.

### The mix

`composeFrontPage` in `rank.js` interleaves the two streams so any prefix of the
page holds close to half machine posts. Without it a sweep of seven agents would
win on volume alone. Fresh member submissions still lead outright, and each
stream keeps its own ranked order underneath.

```
score = (points - 1 + 0.25 × comments) / (age_hours + 2) ^ 1.8
        × 0.5 ^ flags
        × 0.65 ^ (earlier stories from the same domain)
        × 3 if surfaced by a person
```

## Scout points

Points are earned by putting things on the board that turn out to matter, and
they convert into a patch or a ticket to the unconference. Because they buy
something real, `points_ledger` is the record and `users.points` is a cached sum
— `recomputeBalance` rebuilds it from the rows.

| Event | Points |
| --- | --- |
| A submission clears review | 5 |
| It reaches 10 / 25 / 50 points | 5 / 10 / 20 |
| It opens Biopunk Live | 25 |
| It leads Field Notes | 15 |

| Redeems for | Cost |
| --- | --- |
| Scout patch | 100 |
| Unconference ticket | 400 |
| Unconference ticket, plus a guest | 700 |

Awards are idempotent: a unique index on `(user_id, reason, item_id)` means the
awarding pass can run as often as it likes without paying twice.

## The issues

| Issue | Cadence | Page |
| --- | --- | --- |
| Bench Notes | daily | `/news/bench-notes` |
| Field Notes | weekly | `/news/field-notes` |
| Biopunk Live | weekly | `/news/live` |

All three are the same shape — a dated issue over a window of items — so they
share one table and one builder. An issue records the ids it covered, so it stays
the issue that went out even as the board keeps moving. `?i=all` lists the back
issues; `?i=<slug>` is one of them.

## Schedule

`netlify/functions/news-ingest.mjs` is scheduled hourly and gated on the hour in
a configured timezone. Netlify's cron is UTC only, so a fixed UTC hour would
drift by an hour at each daylight-saving change and 7am would quietly become 6am
for half the year. There is a test that pins both sides of a DST boundary.

Each firing that passes the gate runs the sweep, builds the day's issues, and
pays out the vote milestones. All three are idempotent.

## Storage

Three drivers behind one small async interface (`app/db/`), chosen by what is in
the environment:

| Driver | Selected by | What it is |
| --- | --- | --- |
| `neon` | `NETLIFY_DATABASE_URL` / `DATABASE_URL` | Postgres over Neon's SQL-over-HTTP endpoint |
| `turso` | `TURSO_DATABASE_URL` | libSQL over its HTTP pipeline API |
| `sqlite` | neither | `node:sqlite`, for development and the tests |

All three speak `fetch` or a built-in, so the app keeps a durable shared database
without a native client — the property everything else here is built on.

Without a hosted URL the app falls back to a local file, and on Netlify that file
is in `/tmp`, which a recycled container wipes. **A deploy without a database URL
loses accounts, votes, comments, points and the review queue on every cold
start**, while the morning run repopulates the stories so the page still looks
healthy. Set the URL before anyone is asked to post.

### Transactions

SQLite and libSQL hold a session open, so they offer an interactive
`transaction(fn)`. Neon's HTTP endpoint cannot: a request is a session. So
anything that must be atomic on every engine is written as `batch([...])` — a
list of statements decided up front and applied in one transaction.

The one thing a list cannot otherwise carry is the id an insert just generated,
so `{{LAST_ID}}` stands in for it: the engine's own `last_insert_rowid()` on
SQLite, `lastval()` on Postgres.

### Dialect

The two engines agree on almost everything and disagree quietly, which is worse
than disagreeing loudly. The differences that bit, and where they are handled:

- **`LIKE` is case-insensitive in SQLite and case-sensitive in Postgres.** Search
  lowercases both sides; without it, search silently stops matching once hosted.
- **`COLLATE NOCASE`** is SQLite's alone — handle lookups use `lower()`.
- **`MAX(a, b)`** is SQLite's two-argument form and Postgres's `GREATEST`; the
  code uses `CASE`, which is neither and both.
- **Auto-assigned ids** differ in syntax, so `schemaFor(dialect)` swaps that one
  token and leaves the schema otherwise identical.
- **The column list** lives in `pragma_table_info` or `information_schema`.

`test/postgres.test.js` runs the data layer against a real Postgres to keep this
honest, and skips when there is no server to talk to.

## Environment

| Variable | Default | Notes |
| --- | --- | --- |
| `NETLIFY_DATABASE_URL` / `DATABASE_URL` | — | Postgres connection string (Neon). Set one of these in production |
| `TURSO_DATABASE_URL` | — | libSQL URL, the alternative to the above |
| `TURSO_AUTH_TOKEN` | — | token for the libSQL URL |
| `BIOPUNK_DB` | `./data/haus-news.db` | local SQLite path when there is no libSQL URL |
| `BIOPUNK_SECRET` | random per boot | set it, or CSRF tokens rotate on restart |
| `NEWS_BASE_PATH` | `/news` | where the app is mounted |
| `NEWS_TZ` / `NEWS_RUN_HOUR` | `America/New_York` / `7` | when the morning run happens |
| `NEWS_INGEST_FORCE` | — | `1` runs the sweep on any invocation |
| `NEWS_ACCOUNTS` / `NEWS_ACCOUNTS_FILE` | — | the real watched-account list, as JSON |
| `X_BEARER_TOKEN` | — | without it the X half of the accounts agent is skipped |
| `NEWS_INTAKE_TOKEN` | — | shared secret for `/api/surface` |
| `NEWS_ADMINS` | — | comma-separated handles that become reviewers on signup |
| `SEC_CONTACT` | — | `"Name contact@example.com"`. EDGAR refuses requests without it, so the Form D agent stands down when it is unset |
| `NEWS_SITE_ORIGIN` | — | where the rest of haus.fund is. Empty when mounted at `/news`; set on a standalone deployment |
| `NEWS_CALENDARS` | — | override the watched calendars, as JSON |

## Channel intake

```bash
curl -X POST https://haus.fund/news/api/surface \
  -H "authorization: Bearer $NEWS_INTAKE_TOKEN" \
  -H "content-type: application/json" \
  -d '{"url":"https://…","title":"…","handle":"scout-handle","channel":"Discord"}'
```

Token-authenticated rather than session-authenticated, because the caller is a
bot. `handle` credits a member if the handle is one here, otherwise the channel
carries the credit and a reviewer can reassign it. Everything enters the review
queue: a channel is a shortcut for people, not a way around review.

## Layout

```
app/
├── app.js          routing, page handlers, JSON API, RSS
├── models.js       data layer
├── db/             schema, the sqlite driver, the libsql driver
├── rank.js         the ranking formula and the front page mix
├── ingest.js       the orchestrator: pool, filter, cap, post
├── agents/         one file per agent
├── relevance.js    what counts as early-stage biotech
├── review.js       the queue, trust, approvals
├── points.js       the ledger, awards, redemptions
├── digests.js      Bench Notes, Field Notes, Biopunk Live
├── intake.js       channel intake
├── schedule.js     when the run happens, and issue dating
└── views/          layout, components, pages
```

## Where it runs

| Deployment | Mount | Config |
| --- | --- | --- |
| haus.fund/news | `/news`, inside the main site | root `netlify.toml`, `netlify/functions/news/index.mjs` |
| biopunk-news.netlify.app | the site root | `sites/biopunk-news/` — deployed by hand, see its README |

Both import the same handler from `netlify/functions/news/serve.mjs`; they
differ only in the mount. The standalone site's `build.mjs` assembles its
publish and functions directories from this repo, so there is one copy of the
app rather than two.

## Verified against live servers, 2026-09-28

Every endpoint was called for the first time on this date, and several were
wrong. What changed:

- **Fierce Biotech and Endpoints News** answer 403 to any non-browser client and
  **BioSpace** has no feed at any documented path — all three removed. MedCity
  News, BioPharma Dive and Nature Biotechnology added in their place.
- **ARPA-H**'s per-section feeds 404; the site publishes one feed at its root.
- **EDGAR** requires a contact in the User-Agent (`SEC_CONTACT`) and takes about
  twenty seconds to answer, which the shared 8-second budget was cutting off.
- **The calendars** pointed at meetup.com group feeds that no longer exist. The
  source is now the community's own Luma calendar.
- **NIH awards** were being fetched and then discarded by a global 96-hour age
  backstop; agents whose sources publish in batches now set their own window.
- **Three of the ten starter accounts** did not resolve and were removed.

A run now returns from all seven agents. `npm run ingest -- --dry` re-checks the
whole set without writing anything.

**Still open:** the watched-account list is six verified handles, not the 300 the
brief calls for — point `NEWS_ACCOUNTS_FILE` at the real list. And the wires
agent contributes little: the outlets that cover seed and Series A biotech
closely are the two that block us.

## Guidelines

Site rules are at `/news/guidelines`. The one with no discussion attached: no
protocols, sequences or acquisition routes for agents that could cause mass harm.
