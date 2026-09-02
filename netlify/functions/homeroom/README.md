# haus.fund/homeroom

The members-only side of Haus, served at `/homeroom` on the main site so it
shares the domain, the design system and the sign-in.

| Surface | What it is |
| --- | --- |
| **Yearbook** | The founder wall: every cohort, what they build, and signatures. |
| **Labs** | The Global Biolab Atlas plus the Core Facility Finder. |
| **Perks** | Every category of startup support, researched, with how to redeem it. |
| **Funders** | Rate My Funder — the capital map, rated on five axes, with replies. |
| **Mentors** | A searchable roster, vetted, bookable on their own calendars. |
| **Events** | A month calendar, with Luma sync for luma.com/biopunk. |
| **Library** | The Biopunk Founder Manual as a training system with deliverables, and the same curriculum as a navigable skill tree. |
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
│   ├── app.js            sessions, the four pre-login pages, the dispatcher
│   ├── routes.js         every members-only surface
│   ├── models.js         data layer for all of it
│   ├── schema.js         the hr_ tables
│   ├── db.js             accounts, sessions, reset tokens, migrations, transactions
│   ├── auth.js           scrypt hashing, sessions, CSRF, password resets
│   ├── mail.js           the one message this app sends
│   ├── supabase.js       durable storage for publishing to /news (no SDK)
│   ├── supabase-auth.js  Supabase Auth as the credential store (no SDK)
│   ├── steward.js        the admin account, rebuilt from the environment
│   ├── invites.js        onboarding invites, stored in Supabase
│   ├── luma.js           the luma.com/biopunk calendar sync
│   ├── seed.js           the sample network, for reviewing the design
│   ├── seed-real.js      the researched data only — no accounts, no invented content
│   ├── http.js           send/redirect/body/rate-limit helpers
│   ├── util.js           escaping, html`` templating, time, URL handling
│   ├── data/             the researched data: perks, the capital map, the atlas,
│   │                     the mentor roster, the Founder Manual curriculum
│   └── views/            layout, components, pages, surfaces
├── scripts/
│   ├── import-mentors.js     replace the sample roster from Airtable or a CSV
│   ├── check-roster.js       what the front door would do, before switching it on
│   ├── make-steward.js       mint the steward environment variables
│   └── make-supabase-user.js create an account and prove it can sign in
└── test/              unit and HTTP integration tests
```

Static assets live at the repo root in `homeroom-assets/` so the CDN serves
them; the stylesheet imports the site's own `tokens/*.css`, so Homeroom
inherits any change to the design system automatically. There is no client-side
JavaScript bundle: every surface is a server-rendered page and a plain form, and
the one script left in the app is a dozen lines inline on the password-reset
page.

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
| `HOMEROOM_MAIL_FROM` | The From address, e.g. `Homeroom <hello@haus.fund>`. |
| `HOMEROOM_SHOW_RESET_LINK` | `1` puts the link on screen instead of mailing it. Local development only — never set this in production. |

## Onboarding: how a new resident gets in

`HOMEROOM_ACCESS=closed` is the right production setting — without a roster
token, open signup admits anyone who finds the URL. But closed on its own leaves
no route in at all, so the only way to make an account was a steward running a
script per person. Invites are the missing piece: **a steward vouches once, and
the invitee does the rest.**

```
steward                              invitee
───────                              ───────
/homeroom/stewards/invites
  enter an address
  roster is checked and recorded
  (not obeyed — see below)
  link shown ONCE, never stored
        │
        └── send it ──────────────►  /homeroom/join/<token>
                                       pick a handle + password
                                       (the address is fixed by the invite)
                                          │
                                          ▼
                                     /homeroom/welcome
                                       a six-step checklist,
                                       derived from what they have done
```

### What the roster does and does not decide here

At invite time the Airtable verdict is **recorded, not enforced**. A steward
inviting someone by name is itself an admission decision, often made precisely
because the roster is behind or the person applied under a different address.
Only a definite `deny` or `review` makes the steward tick an override box, and
the override is written onto the invite so the trail survives. `closed` — the
normal state — and an unreachable roster are treated as "no opinion", because
making those demand a tick would train stewards to tick it every time.

At redemption the roster gets one narrow power: a fresh, definite `deny` stops
someone whose place was rescinded between the invite and the click. Anything
else — unreachable, unconfigured, silent about this address — lets them through,
because the steward already made the call.

### Where invites live, and why it matters

In Supabase, when `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` and
`HOMEROOM_INVITE_SECRET` are all set. Homeroom's SQLite file is on the
container's `/tmp`, so an invite minted on one container is invisible to the
next — the link would work only if the person happened to click it while that
same container was still warm. An invite that works by luck is not an invite.

Without those, it falls back to a local `hr_invites` table, and the steward page
says so in a banner rather than pretending the links will last.

### What reaches Supabase

The token never does — only its SHA-256. A full dump of `homeroom_invites`
yields no working link, which is what makes it safe to keep the invited address
beside it.

The table has RLS on and **no policies at all**: the publishable key cannot
select, insert, update or delete a single row directly. Every operation goes
through a `security definer` function, each deliberately narrow:

| Function | Needs the secret | What it can do |
| --- | --- | --- |
| `homeroom_invite_peek` | no | one row, and only if you already know its token hash |
| `homeroom_invite_redeem` | no | the same, plus one atomic state change |
| `homeroom_invite_create` | **yes** | mint one |
| `homeroom_invite_list` | **yes** | read the list (which is a list of resident addresses) |
| `homeroom_invite_revoke` | **yes** | kill a pending one |

Possession of the token *is* the credential for the first two, so they need no
secret but cannot enumerate. The last three are admission and disclosure, so
holding the publishable key alone is not enough.

Set the secret in both places, and make it long and random:

```sql
alter database postgres set app.homeroom_invite_secret = '<a long random string>';
```

```
HOMEROOM_INVITE_SECRET   the same value, in Netlify
HOMEROOM_INVITE_DAYS     default link lifetime in days (default 14)
```

Redemption is atomic on both backends: two people opening one link get exactly
one account between them, and the loser is told the invite is spent rather than
handed a second one. The invite is claimed *before* the account is created, so a
failure part-way leaves a spent link and a page that says so — a stray Supabase
user is harder to clean up than a re-sent invite.

### The first run

`/homeroom/welcome` is a page with a URL, not a modal and not a skippable
wizard: someone who closed it on their first day can find it again in week
three, and the home page links back to it until the required steps are done.

Every step is **derived, never stored** — a headline on the profile, a row in
`hr_deal_claims`, a booking, a progress row. Storing a second copy would only
create a way for the two to disagree, and deriving means a member who did a step
before ever seeing the page gets credit for it.

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
  room. Only a definite, freshly-confirmed "no longer eligible" revokes access,
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

### The steward account

Homeroom's database lives on the function container's `/tmp`. Every cold
container starts empty, seeds itself and is thrown away again — so an admin
account created by hand through a form or a one-off script exists on exactly one
container and is gone by the next request. **The only account that survives a
redeploy is one rebuilt from configuration**, which is what these three do. They
are read on every boot, whatever `HOMEROOM_SEED` is set to.

| Variable | Notes |
| --- | --- |
| `HOMEROOM_STEWARD` | Handle of the admin account. Unset: no account is created, and nobody is an admin. |
| `HOMEROOM_STEWARD_EMAIL` | The sign-in address. Defaults to `<handle>@haus.fund`. |
| `HOMEROOM_STEWARD_PASSWORD_HASH` | A scrypt hash from `npm run steward`. Preferred: a hash in the dashboard is useless to anyone who reads it, a plaintext password is a working key. |
| `HOMEROOM_STEWARD_PASSWORD` | Plaintext fallback, honoured only when no hash is set. Subject to the same 10-character floor as the signup form. |

Generate a set:

```bash
npm run steward -- --handle <handle> --email you@example.org
```

It prints the three variables and shows the password once. Paste the variables
into Netlify and the password into a password manager; nothing else stores it.

If `HOMEROOM_STEWARD` is set but neither secret is, the boot logs an error and
creates nothing — an admin account nobody holds the key to is worse than none.
The same is true of a hash in the wrong format, a handle or address the signup
form would reject, and an address already belonging to a different account. None
of these are fatal: a misconfigured steward must not take the site down.

Two consequences of the storage worth knowing before you rely on it:

- **Changing the password inside Homeroom does not stick.** That change lives on
  one container. To rotate for real, re-run `npm run steward` and update
  `HOMEROOM_STEWARD_PASSWORD_HASH`.
- **Sessions do not survive a container either**, unless `HOMEROOM_SECRET` is
  set, and not across containers regardless — expect to sign in again.

An existing ordinary account named by `HOMEROOM_STEWARD` is promoted rather than
replaced, and its password is left alone. `npm run steward -- --apply --force`
resets a local account's password and ends its open sessions.

### Accounts (Supabase Auth)

By default Homeroom holds its own passwords, in the SQLite database on the
container's `/tmp` — which means an account lasts until the next cold start.
Setting `HOMEROOM_AUTH=supabase` moves the credential to Supabase, which is
durable, and brings the one piece of account management this app has never had:
a password-reset email that is actually sent.

| Variable | Notes |
| --- | --- |
| `HOMEROOM_AUTH` | `local` (default) or `supabase`. |
| `SUPABASE_URL` | `https://<project-ref>.supabase.co`. Shared with the publishing integration below. |
| `SUPABASE_PUBLISHABLE_KEY` | The publishable (anon) key. This is the key a browser would use; it is not a privileged one. |

`HOMEROOM_AUTH=supabase` with no project configured falls back to local accounts
rather than taking the front door off its hinges, and `/homeroom/health` says so
under `auth`.

**What moves and what does not.** Supabase owns the password, its hashing, the
reset tokens and the recovery email. It owns nothing else. Homeroom keeps its
own `users` row and its own session cookie, because every table in the schema
hangs off `users.id` by foreign key — profiles, reviews, progress, bookings.
`users.supabase_id` links the two. A Supabase access token is never stored or
put in a cookie: nothing here acts on a member's behalf at Supabase, so keeping
one would be liability without use.

Create a test account and prove it can sign in:

```bash
SUPABASE_URL=... SUPABASE_PUBLISHABLE_KEY=... \
  npm run supabase:user -- you@example.org --handle you
```

It reports whether signups are enabled and whether email confirmation is on,
creates the account with the handle in `user_metadata`, then immediately signs
in with the password it just set — so a misconfigured project fails there rather
than on the login page.

Two settings in the Supabase dashboard decide whether this works:

- **Authentication → URL Configuration → Redirect URLs** must include
  `https://your-site/homeroom/reset`, or the reset email sends people to the
  site root instead of the form.
- **Authentication → Sign In / Providers → Email → Confirm email.** With it on,
  a new account cannot sign in until the link is clicked; signup says so rather
  than failing a login mysteriously. Turn it off while testing.

**Password resets accept both link shapes.** Supabase's default template uses
the implicit flow and returns the token in the URL *fragment*, which a server
never sees — so `/homeroom/reset` carries a few lines of script that move it
into the form and wipe it from the address bar. A template that emits
`{{ .TokenHash }}` instead produces a `?token_hash=` the server verifies
directly, with no token ever touching client-side JavaScript. That one is
better; both work.

`POST /homeroom/password` changes a password from the settings page, in either
mode. It requires the current one — which is not ceremony: without it, a session
cookie left open on a shared laptop is enough to lock its owner out of their own
account. Every other session for that account ends; the one making the change
does not.

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

- **Deal codes** are only rendered to a member who has claimed the deal, and
  claims are counted so the community can renegotiate on real numbers.
- **Pipeline notes** are read back only for the member who wrote them.
- **Message threads** are readable only by their members; an intro request opens
  one with both people in it when it is accepted.
- **Applicant lists** are visible to the poster and lab admins, not to everyone.
- **Module notes** in the library are read back only for the member who wrote them.
- **Review replies** can be anonymous independently of the review itself.
- **The ICS feed** carries title, time and place — never the description or the
  attendee list, because a calendar file gets forwarded far more casually than
  a page does.
- **News submissions** are visible only to the member who made them.

`npm test` covers each of those as a separate assertion, because they are the
claims most likely to quietly stop being true.

## The surfaces, and why they are shaped that way

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

**The skill tree is the same curriculum, drawn as a graph.**
`/homeroom/library/tree` embeds the tool served at `haus.fund/skilltree`, with
`?embed=1` so it drops its own nav, hero and footer and Homeroom's chrome is the
only chrome — the same pattern as the Core Facility Finder at
`/homeroom/labs/cores`. It then calls `/homeroom/api/library` for the signed-in
member's progress, so a node reads as done exactly when the deliverable is
logged against its module. It deliberately cannot mark anything done: there is
one way to finish a module and it is the module's own form. Signed out, or if
that call fails, the tool falls back to browser-local progress and says nothing.

The tree draws 47 nodes to the manual's 39 modules; the extra eight are an
orientation, a showcase capstone, and six subjects the live calendar assumes but
never teaches. It is generated from `curriculum.js` rather than copying it — see
`tools/biopunk-skill-tree/README.md`.

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
