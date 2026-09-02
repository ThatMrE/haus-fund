# haus.fund/homeroom

The members-only side of Haus, served at `/homeroom` on the main site so it
shares the domain, the design system and the sign-in.

| Surface | What it is |
| --- | --- |
| **Chat** | Channels, polled not socketed. Unranked and unarchived on purpose. |
| **Forum** | The question whose answer should still be findable in a year. |
| **Yearbook** | The founder wall: every cohort, what they build, and signatures. |
| **Labs** | The Global Biolab Atlas plus the Core Facility Finder. |
| **Perks** | Every category of startup support, researched, with how to redeem it. |
| **Funders** | Rate My Funder — the capital map, rated on five axes, with replies. |
| **Mentors** | A searchable roster, vetted, bookable on their own calendars. |
| **Events** | A month calendar, with Luma sync for luma.com/biopunk. |
| **Library** | The Biopunk Founder Manual as a training system with deliverables. |
| **Publish** | A member sends a post to the public feed at haus.fund/news. |

Plus jobs, a fundraising pipeline, intro requests and messaging.

It started as a reskin of Bookface, Y Combinator's internal network. The idea it
copies is that the value comes from the room being closed: people say what a
thing actually cost, and which funder wasted three months of their life, only
when they know who is listening.

Zero npm dependencies, and no external service: `node:sqlite` for storage,
`node:http` for the server, `node:crypto` scrypt for passwords, tagged template
literals for views. Same shape as the sibling `news` function.

```bash
cd netlify/functions/homeroom
npm run seed          # the sample network, so there is something to look at
npm start             # http://localhost:8788/homeroom
npm test              # 68 tests, no network
```

Sample logins after seeding: any handle in the directory, password
`homeroom-sample-pass` — for example `ferment_or_die` / `homeroom-sample-pass`.
All of it is fictional.

## Layout

```
netlify/functions/homeroom/
├── index.mjs          Netlify entry point — claims /homeroom and /homeroom/*
├── server.js          local dev server, also serves the site root like Netlify does
├── app/
│   ├── app.js         sessions, the four pre-login pages, the dispatcher
│   ├── routes.js      every members-only surface
│   ├── models.js      data layer for all of it
│   ├── schema.js      the hr_ tables
│   ├── db.js          accounts, sessions, reset tokens, migrations, transactions
│   ├── auth.js        scrypt hashing, sessions, CSRF, password resets
│   ├── mail.js        the one message this app sends
│   ├── supabase.js    durable storage for publishing to /news (no SDK)
│   ├── luma.js        the luma.com/biopunk calendar sync
│   ├── seed.js        the sample network, plus the researched data sets
│   ├── http.js        send/redirect/body/rate-limit helpers
│   ├── util.js        escaping, html`` templating, time, URL handling
│   ├── data/          the researched data: perks, the capital map, the atlas,
│   │                  the mentor roster, the Founder Manual curriculum
│   └── views/         layout, components, pages, surfaces
├── scripts/
│   └── import-mentors.js   replace the sample roster from Airtable or a CSV
└── test/              unit and HTTP integration tests
```

Static assets live at the repo root in `homeroom-assets/` so the CDN serves
them; the stylesheet imports the site's own `tokens/*.css`, so Homeroom
inherits any change to the design system automatically.

## Accounts

Homeroom owns its own accounts rather than borrowing an identity provider —
one table, one scrypt hash, one signed cookie — which is what keeps it
deployable with nothing to sign up for.

- **Signup** takes a handle, an email and a password of at least 10 characters.
  The handle is permanent and public; the email is only ever used to sign in and
  to reset the password. The first account created is a steward.
- **Sign in** fails with one message whether the address is unknown or the
  password is wrong. A precise message tells a stranger which addresses have
  accounts here.
- **Forgot password** mints a single-use token that expires in an hour, stores
  only its hash, and mails the link. The page looks the same whether or not the
  address has an account, and the link is never shown to whoever asked for it —
  that would let anyone reset anyone's password.
- **Reset** replaces the password and drops every existing session, so it also
  works as a way to throw someone out.

Set a mail sender or resets cannot be delivered:

| Variable | Notes |
| --- | --- |
| `HOMEROOM_RESEND_KEY` | Resend API key. Without it the link is written to the function log and nothing is sent. |
| `HOMEROOM_MAIL_FROM` | The From address, e.g. `Homeroom <homeroom@haus.fund>`. |
| `HOMEROOM_SHOW_RESET_LINK` | `1` puts the link on screen instead of mailing it. Local development only — never set this in production. |

## Environment

| Variable | Default | Notes |
| --- | --- | --- |
| `HOMEROOM_DB` | `/tmp/haus-homeroom.db` | SQLite file. |
| `HOMEROOM_SECRET` | random per boot | Set in production, or CSRF tokens rotate on restart and every open form breaks. |
| `HOMEROOM_STATIC_BASE` | `/homeroom-assets` | Where the stylesheet and client script are served from. |
| `HOMEROOM_SEED` | — | `off` stops a cold container filling itself with the sample network. Set this once there is real content. |

### Publishing to /news (Supabase)

| Variable | Notes |
| --- | --- |
| `SUPABASE_URL` | `https://<project-ref>.supabase.co`. Without it, Publish renders a "not configured" notice rather than failing. |
| `SUPABASE_PUBLISHABLE_KEY` | The publishable (anon) key. Safe to set here **because** of the RLS policies in `supabase/migrations/` — see `supabase/README.md`. |
| `SUPABASE_NEWS_TABLE` | Defaults to `news_submissions`. |

The service-role key is never read by this app and must not be set on it.

### The Luma calendar

| Variable | Notes |
| --- | --- |
| `LUMA_API_KEY` | Scoped to one calendar; the key *is* the calendar selector. Requires a Luma Plus plan. Without it the events page links out to the public calendar instead of syncing. |
| `LUMA_CALENDAR_URL` | Defaults to `https://luma.com/biopunk`. |
| `LUMA_IMPORT_AS` | Handle to attribute imported events to. Defaults to the first steward. |

`netlify/functions/luma-sync.mjs` runs the sweep every six hours, and a steward
can fire it from the events page. Both are idempotent on the Luma event id, so a
repeated run updates rather than duplicating.

## What is private, and how

Every surface requires an account, and the pages carry `noindex`. Beyond that:

- **Anonymous posts** hide the handle in the page and in the JSON API. Stewards
  can still look it up — anonymity is for candour, not cover.
- **Deal codes** are only rendered to a member who has claimed the deal, and
  claims are counted so the community can renegotiate on real numbers.
- **Pipeline notes** are read back only for the member who wrote them.
- **Message threads** are readable only by their members; an intro request opens
  one with both people in it when it is accepted.
- **Applicant lists** are visible to the poster and lab admins, not to everyone.

- **Module notes** in the library are read back only for the member who wrote them.
- **Chat** is not searchable from the public API, not ranked, and not surfaced
  on any other page. Deleting your own message works; deleting someone else's
  does not, unless you are a steward.
- **Review replies** can be anonymous independently of the review itself.
- **The ICS feed** carries title, time and place — never the description or the
  attendee list, because a calendar file gets forwarded far more casually than
  a page does.
- **News submissions** are visible only to the member who made them.

`npm test` covers each of those as a separate assertion, because they are the
claims most likely to quietly stop being true.

## The surfaces, and why they are shaped that way

**Chat and the forum are separate on purpose.** The forum ranks, scores and
archives; that is what makes it useful in a year and what makes people hesitate
before posting. Chat does none of those things, which is what makes people type
in it. Keeping them in one table would have meant one set of expectations, and
the room would have lost whichever half it compromised.

Chat delivery is polling, not sockets: a Netlify function cannot hold a
connection open. The client polls every five seconds, stops entirely while the
tab is hidden, and backs off to thirty seconds after five empty polls. `since`
is the last message id the client holds, so the usual response is an empty array
and one indexed range scan.

**The atlas leads with whether a lab is open.** Every DIYbio directory on the
internet mixes live spaces with ones that closed in 2017 and renders them
identically. `status` is a first-class column here, member reports move it, and
active labs sort above dormant ones. A member who has stood in the room outranks
any list — which is the point of keeping an atlas rather than linking to one.

**Perks record how you redeem, not just what you get.** Almost every startup
programme is claimed by application or a partner referral, not a code. The
catalogue in `app/data/perks.js` ships with `code` empty and `how` populated,
and a steward fills in the real code once a partner agreement lands. Inventing
one would cost a founder an afternoon, which is worse than showing nothing.

**Rate My Funder has five axes because one star hides the thing you need.** A
fund can be a delight to talk to and take four months to say no. Speed,
value-add, founder-friendliness and terms are separate columns, reviews carry a
fixed tag vocabulary so three of them become a countable pattern, and
"would raise again" is withheld under three reviews — at one or two the
percentage identifies the reviewer to anyone who knows who was in the room.
Reviews sort by corroboration, not recency, which is what stops one angry
account defining a fund's page.

**The library is a training system, not a reading list.** Six tracks and their
modules come from the Fall 2026 program design document — the curriculum
taxonomy that converged seven drafts against YC, Antler, HAX, IndieBio, Third
Derivative, New Energy Nexus and 5050/50Y. Every module states what you should
be able to do afterwards and what work produces it, and `deliverable` is the
same artefact the 90-day calendar asks for in that week. Progress is per member
and "done" means the artefact exists, with a link to it.

## The data sets

`app/data/` holds four researched sets and one deliberately fictional one.

| File | What it is | Real? |
| --- | --- | --- |
| `perks.js` | Startup programmes across 17 categories | Real programmes and terms; `checked` records when. Codes are left empty rather than invented. |
| `funders.js` | The capital map: grants, accelerators, pre-seed, seed, studios, fellowships, angels, prizes | Real, publicly listed programmes. Deliberately carries **no** seeded ratings — a fabricated review of a real organisation is the one thing a review site cannot survive. |
| `atlas.js` | Community, DIYbio and open-science labs worldwide | Real labs, sourced from HTGAA nodes, DIYbio.org, DIYbiosphere and member submissions; `source` and `status` are per row. |
| `curriculum.js` | The six tracks, their modules and the S26 sequence | Straight from the Fall 2026 program design document. |
| `mentors.js` | The sample mentor roster | **Fictional**, like the rest of the sample network. Publishing a hundred real names with booking links nobody agreed to would send founders to book time with people who never opted in. |
| `network.js` | Real people from the Haus network | Real, from the calendar. Never `vetted`, never given a scheduling link, and no contact details — appearing in a calendar is evidence someone was met, not that they agreed to take bookings. The profile page says so in as many words. |

Replace the mentor roster with the real one before launch:

```bash
AIRTABLE_TOKEN=pat... npm run mentors:import -- --airtable --replace-seed
npm run mentors:import -- --csv mentors.csv --dry-run   # or from an export
```

Rows match on a slug of the name, so re-running updates in place.
`--replace-seed` drops the sample rows, and only after a clean import — a failed
fetch must not leave an empty directory. Set `HOMEROOM_SEED=off` at the same
time, or a cold container puts them back.

`--replace-seed` deletes only `source = 'seed'`, so the real rows from
`network.js` (`source = 'calendar'`) survive it. To promote one of them to
bookable, set `vetted` and a `scheduler` — which should happen only after the
person has actually said yes.

## Ranking

```
score = (points - 1 + 0.75 × replies + 1) / (age_hours + 2) ^ 1.5
        × 1.6 if it is a question with no replies and under 48 hours old
        × 1.15 if an answer has been accepted

pinned threads sort above everything
```

A reply is worth much more than a vote, because an answered question is the
product. The lift on an unanswered question is what stops one dying unseen.

## Storage: read this before inviting anyone

Netlify functions have an ephemeral filesystem. The database lives in `/tmp`,
which means **a cold container starts from nothing**: accounts, posts, replies
and bookings do not survive, and two concurrent containers do not share state.
The sample network is re-seeded automatically, so the page looks right, which is
exactly what makes this easy to miss.

That is fine for reviewing the design and the flows. It is not fine for a
network people are asked to put their fundraising notes into. Before launch,
storage has to move to something durable — either run the app as a single
process against a real volume (it is one Node process and one SQLite file), or
swap `db.js` for a hosted Postgres instance. Everything above `db.js` is written
against a small query surface, so the second option is a contained change, and
the Supabase project this repository is already linked to is the obvious target.

Two things in this build are affected by that and should be read as provisional
until it is done:

- **Publishing to /news already crosses the line**, which is why it is the one
  surface that writes to Supabase rather than SQLite. The local
  `hr_news_submissions` row is only a receipt.
- **The Luma sweep runs in its own container**, so what it writes is not
  guaranteed to be the database the web container reads. Harmless (a container
  re-syncs on its own next boot) but genuinely useful only after the move.

Set `HOMEROOM_SEED=off` at the same time, or the sample members will reappear
next to the real ones.
