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

Two designs are specified but not built, both about reaching *outside* the
house under a double opt-in rule:

- [`docs/INTRO-ENGINE.md`](docs/INTRO-ENGINE.md) — partners and contacts in the
  broader Biopunk network, sourced through Happenstance. People who never
  agreed to anything.
- [`docs/MENTOR-ENGINE.md`](docs/MENTOR-ENGINE.md) — mentors onboarded through
  an Airtable form, with the booking link gated behind a per-request accept.
  People who did agree, which makes it a different problem. **Phase 1 of this
  one is built** — see below.

## The mentor desk

A mentor's booking link used to be visible to every signed-in member, and
downloadable in bulk from `/homeroom/api/mentors`, because `searchMentors()`
selected `m.*` and `scheduler` rode along. It no longer does: the column is not
in `MENTOR_FIELDS`, and `mentordesk.schedulerFor()` is the only reader.

A member now writes a short request; the mentor answers it from an email, with
no Homeroom account, through a tokenised link; and a yes mints a **grant** —
one member, one mentor, 14 days, revocable, logged — which
`/homeroom/mentor/:slug/book/:grant` resolves at click time. The URL never
appears in a page.

The mechanism protecting a mentor is **capacity, not privacy**: they filled in
a form and a member picked them off a list, so hiding a decline would be
theatre. What they need is to not be asked an eleventh time this month, so the
cap is checked *before* a request can be written and a mentor at their limit is
never asked at all.

| Variable | Default | Notes |
| --- | --- | --- |
| `HOMEROOM_MENTOR_GATE` | `1` | `0` restores the old behaviour — the link straight on the page. |
| `HOMEROOM_MENTOR_MAIL_FROM` | falls back to `HOMEROOM_MAIL_FROM` | Should be its own identity: mentor mail goes outside the house and a spam report must not land on password resets. |
| `HOMEROOM_MENTOR_CAPACITY_DEFAULT` | `2` | Sessions a month, when the mentor did not say. |
| `HOMEROOM_MENTOR_MAX_OPEN` | `3` | Open requests per member. |
| `HOMEROOM_MENTOR_MAX_MONTHLY` | `6` | New requests per member per month. |
| `HOMEROOM_MENTOR_REASK_DAYS` | `90` | Before asking the same mentor again after a decline. |
| `HOMEROOM_MENTOR_REQUEST_DAYS` | `10` | Before an unanswered request ages out. |
| `HOMEROOM_MENTOR_GRANT_DAYS` | `14` | How long a booking link works. |

### Onboarding, and the front door for mentors

Mentors self-onboard through a public Airtable form. `netlify/functions/
mentor-sync.mjs` pulls the table every six hours, and a steward can fire it
from `/homeroom/stewards/mentors`.

**A submission is listed nowhere until a steward rules on it.** Not in the
roster, not in the API, and not at its own URL — a pending profile 404s,
because a guessable slug should not serve an unvetted stranger's self-written
bio. `Vetted` being ticked in Airtable does not list anybody either; that
checkbox is somebody's note to themselves, and the gate is a steward here.

The sweep **fails closed**: Airtable unreachable, a timeout, or a table that
comes back empty all leave the roster exactly as it was and say so on the
steward page. An empty response and a wrong base id look identical, and one of
those must not empty the roster.

Rows match on the Airtable record id, so a mentor can be renamed without
splitting into two rows; the name slug remains the fallback for rows imported
before that column existed. A blank field never wipes a booking link or an
address — Airtable omitting a field must not remove the only way to reach
someone.

`app/mentorfields.js` holds the field mapping and the **scheduler host
allowlist** (cal.com, calendly.com, savvycal.com, lu.ma, zcal.co), shared with
`scripts/import-mentors.js` so the two cannot drift. It is the only thing
between a public form and a "book time" button that goes wherever a stranger
typed.

| Variable | Default | Notes |
| --- | --- | --- |
| `HOMEROOM_MENTOR_SYNC_TOKEN` | falls back to `AIRTABLE_TOKEN` | Read access to the Mentors base. Without it the sweep skips rather than failing. |
| `HOMEROOM_MENTORS_BASE` / `_TABLE` | the existing Mentors base | |

The form's field spec — what Airtable has to collect — is in
[`docs/MENTOR-ENGINE.md`](docs/MENTOR-ENGINE.md) §8.4. Turn on Airtable's own
rate-limiting and CAPTCHA before publishing the URL.

**No mentor imported by the old script has an email address**, so until the
form is live and synced, those rows are listed but cannot be asked — the
profile says so rather than sending a request nobody will receive.
`/homeroom/health` reports the gate, the roster by state, submissions awaiting
review, requests waiting on a mentor, and grants issued this month.

### Keeping the roster honest

A mentor list dies by rotting, not by emptying: someone says yes in March,
changes jobs in June, and is still listed the following March with a Calendly
that 404s. Three founders waste a week on them and stop trusting the list. This
is `atlas.js`'s rule applied to people — status is a first-class column, and a
directory that renders a live entry and a dead one identically is worse than a
shorter directory.

Three mechanisms, in the same six-hourly sweep as the sync and running before
it, whether or not Airtable is configured:

- **Auto-pause** after three *consecutive* unanswered requests. Not three in
  total — answering, missing one, answering again is a busy month. Three in a
  row usually means the address on file is not one they read.
- **Re-confirmation** every 180 days: one question, one click, two nudges 14
  days apart, then dormant.
- **Dormancy**, not deletion. Off the list, nothing lost, one click back.

All of it is quiet. A mentor who goes silent gets one note, never a sequence,
and the note leads with the button that brings them back. Withdrawing is a
single click with no confirmation step and no win-back flow — a volunteer who
wants out and meets a retention sequence instead does not come back, and tells
people.

Mentors still have no accounts, so these live at `/homeroom/me/:token`
(90-day tokens, hashed at rest). Anything that changes state is POST-only:
mail gateways pre-fetch every URL in a message, and a GET that withdraws
somebody would be fired by a scanner rather than by a mentor.

| Variable | Default | Notes |
| --- | --- | --- |
| `HOMEROOM_MENTOR_RECONFIRM_DAYS` | `180` | How long a standing yes is trusted. |
| `HOMEROOM_MENTOR_NUDGE_DAYS` | `14` | Gap between the two nudges, and then to dormancy. |
| `HOMEROOM_MENTOR_SILENCE_PAUSE` | `3` | Consecutive unanswered requests before auto-pause. |
| `HOMEROOM_MENTOR_OUTCOME_NAG_DAYS` | `14` | One reminder to log an outcome. Exactly one. |

The steward page carries seven numbers, and **the total number of mentors is
deliberately not one of them**. A roster of 200 where 60 answer is worse than a
roster of 60, and counting the first is how you get it. The honest version of
that question is the dormant share.

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
deployable with nothing to sign up for. Who is *allowed* an account is a
separate question, answered by the roster below.

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

## The front door: who gets in

Homeroom is members-only, and until the roster gate existed that meant "members
only once you are inside" — anyone who found the URL could create an account.
Signup is now checked against the Airtable People table, which is where the
programme's own record of who was accepted already lives.

### The rule

Two Airtable fields describe someone's standing and they do not always agree.
`Status` is the decision (Applied, Interviewed, Ready to Reject, Accepted,
Declined, Pending, Rescinded, Waitlist, Deferred). `Lifecycle Status (Computed)`
is a formula over the move-in and move-out dates (Alumni, Resident, Applicant,
Past applicant).

At the time this was built, of 141 people, **eight were `Resident` or `Alumni`
by the dates while their `Status` said Rescinded, Declined or Deferred** —
someone whose offer was pulled but whose move-in date was never cleared, or who
declined a residency and later subletted. Those eight are the whole problem,
because both obvious rules get them wrong: trusting `Status` alone locks out
people who genuinely live in the house, and trusting the dates alone lets
somebody whose offer was rescinded into a private room.

So the verdict is three-valued:

| Verdict | When | What happens |
| --- | --- | --- |
| `allow` | `Status = Accepted`, **or** lifecycle is Resident/Alumni, **or** resident type is Core resident / Subletter / RA / Alum / Co-founder | Account created, profile prefilled from the roster |
| `deny` | Rescinded or Ready to Reject (these override *everything*, including an active residency), or no positive signal at all | Turned away |
| `review` | The dates say resident and the status says Declined or Deferred | **Nobody is let in and nobody is turned away.** It lands in a steward queue at `/homeroom/stewards/access` with both fields shown |

Rescinded overriding an active residency is deliberate: it is the most explicit
signal the table can carry that someone's place was taken away, and an access
gate should fail closed on it. If the date is what is wrong, a steward fixes the
date.

### The two failure directions

This is the part to keep if any of it is ever rewritten:

- **Signup fails closed.** If Airtable cannot be reached we do not know whether
  this person belongs here, and creating an account on a guess is how a
  members-only room stops being one. They get "try again shortly" and a 503 —
  which is true — rather than "you are not a resident", which might not be.
- **Login fails open.** They already have an account; the roster said yes at
  least once. An Airtable outage must never lock the whole house out of its own
  forum. Only a definite, freshly-confirmed "no longer eligible" revokes access,
  and stewards are exempt entirely — the people who fix the roster have to be
  able to reach it.

A rescinded place therefore takes effect at the member's next login after the
cached verdict expires, not instantly. That is the right trade for a hand-
maintained roster.

### Denied and not-found look identical

The "Residents only" page is the same whether the address was rejected, held for
review, or simply absent. A precise message would turn signup into a way to test
whether any given person is a resident, and handles are public. The page tells a
real resident the two things actually worth checking — the address they applied
with, and how recently they were accepted — and gives them somewhere to write.

### Privacy

The People table also holds medical notes, allergies, emergency contacts, home
addresses, visa status and whether someone asked for financial help. `FIELDS` in
`roster.js` is the complete list of what is ever requested, in the same spirit as
the mentors edge function: nothing outside it is fetched, ever.

Verdicts are cached against a **SHA-256 of the address**, never the address, so a
copy of the Homeroom database is not also a copy of the resident list. The
steward view shows `el****@haus.fund`, which is enough to recognise a row and not
enough to be a mailing list.

### Configuration

| Variable | Default | Notes |
| --- | --- | --- |
| `HOMEROOM_ROSTER_TOKEN` | falls back to `AIRTABLE_TOKEN` | Airtable PAT with read access to the People base. **Without it every signup is refused** when the mode is `roster`. |
| `HOMEROOM_ACCESS` | `roster` with a token, `open` without | `roster` · `open` (anyone, for local development) · `closed` (no self-signup at all). |
| `HOMEROOM_ALWAYS_ALLOW` | — | Comma-separated addresses that always get in, for staff who are not in the People table. |
| `HOMEROOM_ROSTER_TTL_DAYS` | `7` | How long a verdict is trusted before login re-checks it. |
| `HOMEROOM_ROSTER_BASE` / `_TABLE` | the People base | Override to point at a different base. |
| `HOMEROOM_ROSTER_STATUSES` | `accepted` | Statuses that grant access on their own. |
| `HOMEROOM_ROSTER_LIFECYCLES` | `resident,alumni` | Lifecycles that grant access on their own. |
| `HOMEROOM_ROSTER_TYPES` | `core resident,subletter,ra,alum,co-founder` | Resident types that grant access. |
| `HOMEROOM_ROSTER_BLOCKED` | `rescinded,ready to reject` | Statuses that revoke regardless of the dates. |
| `HOMEROOM_ROSTER_AMBIGUOUS` | `declined,deferred` | Statuses that conflict with a residency rather than settling it. |

`/homeroom/health` reports the mode, whether the token is set, whether Airtable
answers, and how many decisions are waiting on a steward — so "is the door
wired up" is one curl rather than a deploy and a guess.

### Check it before you switch it on

The gate is the one part of Homeroom whose failure is invisible until a cohort is
standing outside it, so there is a script that runs the *same* `evaluate()` the
live gate runs — imported, not reimplemented, so the two cannot drift — against
the real table and prints what would happen.

```bash
export HOMEROOM_ROSTER_TOKEN=pat...

npm run roster:check -- --audit            # what the gate would do to everyone
npm run roster:check -- --audit --emails   # ... with addresses shown
npm run roster:check someone@example.org   # one person: "why can't they sign in?"
```

The audit prints the verdict split, the reason breakdown, every conflict needing
a steward — and, separately, **anyone who would be allowed but has no email
address on file.** Those are a silent lockout: they cannot sign up, and because
they never reach the door they never appear in the review queue either. Fix
those in Airtable before the cohort arrives.

It writes nothing, to Airtable or to Homeroom, and it needs only
`data.records:read` on the People base.

### The steward page

`/homeroom/stewards/access` is the queue of conflicts, a live "check this
address" lookup for when somebody says they cannot get in, and a log of recent
decisions. A steward's ruling is stored separately from the computed verdict and
outranks it, so the next weekly re-check does not quietly undo their work.

## Environment

| Variable | Default | Notes |
| --- | --- | --- |
| `HOMEROOM_DB` | `/tmp/haus-homeroom.db` | SQLite file. |
| `HOMEROOM_SECRET` | random per boot | Set in production, or CSRF tokens rotate on restart and every open form breaks. |
| `HOMEROOM_STATIC_BASE` | `/homeroom-assets` | Where the stylesheet and client script are served from. |
| `HOMEROOM_SEED` | — | What a cold container fills itself with. Unset: the full sample network, including ten invented accounts sharing a documented password — for reviewing the design, never for production. `real`: only the researched reference data (perks, capital map, atlas, manual, channels) and no accounts. `off`: nothing, in which case pair it with `HOMEROOM_ACCESS=closed` or a roster token, because with no accounts the first signup is made a steward. |

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
| `perks.js` | 64 startup programmes across 17 categories | Real programmes and terms; `checked` records when. Codes are left empty rather than invented. |
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
