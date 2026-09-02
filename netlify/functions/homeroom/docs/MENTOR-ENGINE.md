# The Mentor Desk

Onboarding mentors through an Airtable form, syncing them into Homeroom, and
gating the booking link behind a double opt-in.

**Status:** proposed. Nothing here is built.

**Companion to** [`INTRO-ENGINE.md`](INTRO-ENGINE.md). That document handles
people who never agreed to anything. This one handles people who filled in a
form saying they want to help — which is a different problem with a different
answer, and the difference is the whole first half of this document.

---

## 1. The one-paragraph version

A mentor fills in a public Airtable form: who they are, what they help with,
how much time they have, and their booking link. A scheduled sync pulls new
submissions into Homeroom as `pending` — listed nowhere until a steward vets
them. Once listed, a member who wants time writes a short request. The mentor
gets one email with that request and three buttons. On accept, and only then,
the member gets a booking link — through a Homeroom redirect that expires,
rather than a URL rendered into the page. Capacity is enforced before a request
can even be sent, standing consent is re-confirmed every six months, and a
mentor who stops answering goes dormant rather than silently accumulating
requests.

---

## 2. What already exists

Worth being precise about, because most of the pieces are here and the gap is
narrower than it looks.

| Piece | State |
| --- | --- |
| `hr_mentors` table | Exists. Has `slug`, `name`, `role`, `org`, `track`, `tags`, `location`, `bio`, `format`, **`scheduler`**, `vetted`, `active`, `sessions`, `source`, `user_id`. |
| `scripts/import-mentors.js` | Exists. Imports from the Airtable Mentors table or a CSV, matches on a name slug so re-runs update in place, and `--replace-seed` drops sample rows only after a clean import. |
| Scheduler-link validation | Exists and is already correct. `SCHEDULER` in the importer is a **host allowlist** (`cal.com`, `calendly.com`, `savvycal.com`, `lu.ma`, `zcal.co`), and both the CSV and Airtable paths run through the same `normalize()`. A LinkedIn URL in that column does not become a "book time" button. |
| `netlify/edge-functions/mentors.js` | Exists. Server-side Airtable proxy for the **public** site, with a `PUBLIC_SHAPE` allowlist — and it correctly does **not** include the scheduler. |
| `/homeroom/mentors`, `/homeroom/mentor/:slug` | Exist. Search, tag cloud, profile, Homeroom office-hours slots. |
| `hr_slots` and office hours | Exist. Homeroom-native slots, separate from external schedulers. |
| A gate on the booking link | **Does not exist.** |

### 2.1 The actual gap, stated exactly

`searchMentors()` selects `m.*`. That row goes to `views.mentorPage`, which
renders the scheduler as a button, and to `/homeroom/api/mentors`, which returns
it as JSON. So today:

> Every mentor's booking link is visible to every signed-in member, and
> downloadable in bulk from one JSON endpoint.

That is not a bug — it is the current design, and for a roster of people a
steward personally recruited it is a reasonable one. It stops being reasonable
the moment mentors self-onboard through a public form, because the population
changes from "twelve people Elliot asked" to "whoever filled in the form", and
because a form that produces an immediately-bookable calendar is a form that
gets abused.

**The JSON endpoint is the part that will be forgotten.** A gate added to the
mentor page and not to `/homeroom/api/mentors` is not a gate. §7.3 makes the
column removal the fix rather than a filter at each call site.

---

## 3. Why this is a different double opt-in

The instinct is to reuse the intro engine's five gates. That would be wrong, and
understanding why is the design.

| | Intro engine | Mentor desk |
| --- | --- | --- |
| Has the target agreed to anything? | **No.** They are in a contact graph. | **Yes.** They filled in a form. |
| What is scarce? | The connector's credibility | The mentor's calendar |
| What does a "no" cost the target? | Social awkwardness with the connector | Nothing — declining a topic is normal |
| Can the requester see the decline? | Must not | Unavoidably yes; they chose the mentor |
| So the protection is… | **Invisibility** — veto-then-blind, §5 of the intro spec | **Volume** — capacity caps, §6 |

That last row is the point. The intro engine spends a lot of machinery making a
decline invisible, because a legible decline is a coerced yes. Here the member
picked a named volunteer off a list — of course they know who they asked. Making
that invisible would be theatre.

What a mentor actually needs protecting from is not embarrassment. It is the
eleventh request this month, from someone who did not read their profile, about
a topic they do not cover. **A mentor churns from volume, not from visibility.**
So the mechanisms are capacity, specificity and expiry, and the double opt-in
here means something narrower and more useful:

- **Opt-in 1 — standing.** The form. *"I am willing to mentor, on these topics,
  in this format, this often."* Given once, re-confirmed periodically.
- **Opt-in 2 — per request.** *"Yes, I will take this founder, on this topic,
  now."* Given each time — unless the mentor has explicitly said not to ask.

Opt-in 1 is what the Happenstance flow spends five gates trying to manufacture.
Having it already is the entire advantage of this lane, and the design should
spend it rather than re-earning it.

### 3.1 The mentor may waive opt-in 2

The form asks how they want to be approached:

| Setting | Behaviour |
| --- | --- |
| `ask-me` | Every request goes to them first. **Default.** |
| `auto` | Vetted members get the booking link immediately; the mentor is notified, not asked. |
| `auto-track` | Auto for members on tracks they named; ask for everyone else. |

`auto` is not a weakening of consent — it *is* consent, given knowingly, by
someone who would rather see a calendar invite than an email asking whether they
would like one. Forcing a round trip on a mentor who said "just let them book"
wastes exactly the time the system exists to protect. It defaults to `ask-me`
because that is the safe assumption for someone who did not express a
preference.

---

## 4. Mentors do not get Homeroom accounts

This constrains everything downstream, so it comes before the flow.

`roster.js` admits accounts only for `Status = Accepted`, or a Resident/Alumni
lifecycle, or a listed resident type. **A mentor is none of those.** A mentor who
tried to sign up would hit the "Residents only" page, correctly.

So every mentor-facing action — accept, decline, pause, re-confirm, edit,
withdraw — happens through a **tokenised link in an email**, using the same
mechanism as password resets in `auth.js` and target consent in the intro
engine: 32 random bytes, stored as a SHA-256 hash, single-use where it should
be, expiring.

Three consequences:

1. **No mentor dashboard**, and there should not be one. A dashboard requires
   accounts, accounts require the roster gate to grow a third population, and
   the gate's failure modes were hard enough to get right for one. Every mentor
   action is one click from an email.
2. **The email is the product surface.** It gets the same care as the intro
   engine's permission ask (§11 there): the request must be answerable in
   fifteen seconds without logging in to anything.
3. **A mentor who is also an alum can have an account**, and `hr_mentors.user_id`
   already exists to link the two. That is a nice-to-have, not the path.

The alternative — a `mentor` verdict in `roster.js` with its own allowlist table
— is a real option and is rejected for now on the grounds that it puts
non-residents inside a room whose entire value proposition is that only
residents are in it. Recorded as **M-O-1**.

---

## 5. The flow

```
Airtable form
    │  public URL. Anyone can submit. Untrusted input.
    ▼
Airtable Mentors table          Status = Submitted
    │  scheduled sync, every 6h + a steward "sync now"
    ▼
hr_mentors                      state = pending      ← listed NOWHERE
    │  GATE A: a steward vets
    ▼
                                state = listed       ← appears in /homeroom/mentors
                                                       scheduler still not exposed
    │  a member writes a request
    ▼
hr_mentor_requests              state = sent         ← capacity checked BEFORE this
    │  GATE B: the mentor accepts        (skipped when consent_mode = auto)
    ▼
                                state = accepted
    │
    ▼
hr_mentor_grants                one member, one mentor, 14 days
    │  /homeroom/mentor/:slug/book/:grant  → 302 to the scheduler
    ▼
outcome logged by the member    sessions += 1
```

Two gates, not five, and each is doing something the other cannot:

**Gate A — vetting.** The form is public. Without a steward between the form and
the roster, the mentor list is a place anyone can advertise. This is the same
reason `hr_mentors.vetted` already exists; the change is that vetting becomes
load-bearing rather than a badge.

**Gate B — the request.** Per-request consent, waivable by the mentor (§3.1).

---

## 6. Capacity, specificity, expiry

The three mechanisms that replace the intro engine's invisibility work. Each
maps to a way mentor rosters die.

### 6.1 Capacity — how rosters die of success

The form asks: **how many sessions a month?** Default 2 if unanswered.

`capacity_per_month` is enforced **before the request form renders**, not when
the mentor answers. A mentor at capacity shows on their profile as *"Fully
booked this month — you can ask again from 1 March"*, and the request button is
gone. No request is created, no email is sent, and the mentor never has to
decline.

That ordering is the whole mechanism. A decline costs the mentor a decision, a
small guilt and thirty seconds; ten declines a month is how a willing mentor
becomes an unresponsive one. **The cheapest decline is the one the system makes
on their behalf, from a number they chose.**

Counted against capacity: accepted requests in the calendar month. Not
sent-and-declined, not expired — declining should never make a mentor look
busier and get them fewer requests next month, which would invert the incentive.

### 6.2 Specificity — how rosters die of noise

The request form is a real form, in the shape of the intro engine's ask
(§6.3 there): what you need, why this person specifically, what you have already
tried, what you are asking for (30 minutes, an async deck review, one
introduction). Minimum lengths enforced.

The profile-derived prompt matters more than the fields: the form is pre-headed
with *"Alex helps with regulatory strategy and CMC. If that is not what you
need, they are the wrong person and a steward can find you a better one."* A
mentor's most common reason for declining is being asked about something they do
not do, and that is a routing failure, not a mentor failure.

### 6.3 Expiry — how rosters die of rot

Every `HOMEROOM_MENTOR_RECONFIRM_DAYS` (default 180), a mentor gets one email:
*"Still up for this? Here is what we have on file."* One click for yes, one to
pause, one to update, one to withdraw.

No answer after two nudges (day 0, day 14) → `dormant`. Not deleted, not listed,
not searchable, and restorable in one click if they resurface.

This is `atlas.js`'s rule applied to people: **status is a first-class column,
and a directory that renders a live entry and a dead one identically is worse
than a shorter directory.** A mentor list where a third of the links go to
abandoned Calendly accounts teaches founders not to use the list at all, and
that lesson is very hard to unteach.

---

## 7. The booking link is a credential

### 7.1 Grants, not URLs

On accept, the member does not receive the scheduler URL. They receive a link to
`/homeroom/mentor/:slug/book/:grant`, which checks the grant and 302s.

| Property | Why |
| --- | --- |
| Never in page source | A rendered `href` is scrapeable by every member, forever, gate or no gate. |
| Expires (14 days) | Checked at click time, not render time. A stale email stops working. |
| Bound to one member and one request | A forwarded link does not work for someone else. |
| Revocable | A mentor who pauses kills outstanding grants in one click. |
| Logged | The click is the only signal Homeroom gets that a booking was attempted. |

This is not DRM: a member who clicks once can read the destination and keep it.
The claim is narrower and still worth it — the link is not *broadcast*, the
exposure is attributable, and revocation works for everyone who has not yet
clicked.

### 7.2 What a mentor is told about that

Plainly, on the form, because a mentor who thinks their link is private when it
is not has been misled:

> Your booking link is only shown to a member after you accept their request,
> and the link we give them expires. We cannot stop someone who has already
> opened it from saving it.

### 7.3 The column has to leave the shared query

The fix is not a filter at each call site. `scheduler` comes out of the row that
`searchMentors()` and `getMentor()` return, and is read by a separate
`schedulerFor(mentorId)` used only by the redirect handler. A `SELECT m.*` that
still carries the column will end up in a JSON response again the next time
someone adds an endpoint, and nobody will notice because nothing will look
broken.

The test asserts on the **rendered output** of `/homeroom/api/mentors` and the
mentor page — no `cal.com`, `calendly.com`, `savvycal.com`, `lu.ma` or `zcal.co`
string in either body, for a fixture mentor who has one on file.

---

## 8. Airtable: the form and the sync

### 8.1 The form is untrusted input

A public Airtable form URL is a public write endpoint. Assume submissions
include spam, competitors, people misrepresenting who they work for, and at
least one attempt at markup injection.

- **Nothing is listed without gate A.** The only real defence.
- **Escaping is already handled** by the `html`` ` templating in `util.js`.
- **The scheduler host allowlist already exists** in the importer's `SCHEDULER`
  regex, and the sync must route through the same `normalize()` rather than
  reimplementing. Two code paths validating a URL is how one of them stops.
- **Rate-limit and CAPTCHA the form itself** in Airtable. Out of Homeroom's
  hands, and worth saying so in the runbook rather than discovering it.

### 8.2 Sync, not webhook — for now

Airtable automations can POST on form submit, which is faster and tempting.
Scheduled polling wins for Phase 1 on three grounds:

1. **The ephemeral-storage problem.** Until Homeroom has durable storage (P-1 in
   the intro engine spec, and the same blocker here), a webhook can arrive at a
   container that is about to be recycled, and the submission is gone with no
   retry. A poll re-reads the source of truth every time and is idempotent by
   construction.
2. **The pattern already exists.** `luma-sync.mjs` runs every six hours and a
   steward can fire it from the page; both are idempotent on an external id. The
   mentor sync is the same shape and should look like it.
3. **Latency does not matter here.** A mentor who submits a form waits for a
   human to vet them anyway. Six hours of sync delay is invisible next to gate A.

A webhook becomes worth it in Phase 3, when durable storage exists and a steward
wants submissions to appear while the applicant is still on the call.

Matching stays on the Airtable record id, not the name slug the importer uses
today — two mentors can share a name, and a mentor can change theirs. The name
slug remains the fallback for rows that predate the id column.

### 8.3 The field allowlist

Same discipline as `roster.js` and the mentors edge function, and for the same
documented reason: the Airtable token is scoped to a **base**, and this base also
holds LPs, Investments, Capital Flows, IC Reviews, Applications and Interview
Scorecards. The sync declares exactly what it requests:

```
Name · Role · Organization · Area of Expertise · Tags · Location · Bio ·
Scheduler · Format · Capacity · Consent Mode · Tracks · Email · Status ·
LinkedIn · Headshot
```

`Email` is new to this list relative to the public proxy, and it is the sensitive
one — it is how gate B reaches them. It is stored hashed for lookup and
encrypted or re-fetched for sending, following §9 of the intro engine spec.
Nothing outside the list is ever requested.

### 8.4 Failure direction

**The sync fails closed and silent.** Airtable unreachable means the existing
roster stands unchanged — no new mentors, no removals, an error on the steward
page. A sync that treats "could not fetch" as "the table is now empty" would
deactivate the entire mentor roster, and `--replace-seed` already encodes
exactly this lesson: destructive steps run **after** a successful fetch, never
before.

---

## 9. Schema

```sql
/* Extends the existing hr_mentors rather than replacing it. */
ALTER TABLE hr_mentors ADD COLUMN airtable_id  TEXT NOT NULL DEFAULT '';
ALTER TABLE hr_mentors ADD COLUMN email_hash   TEXT NOT NULL DEFAULT '';
ALTER TABLE hr_mentors ADD COLUMN state        TEXT NOT NULL DEFAULT 'listed';
       /* pending · listed · paused · dormant · withdrawn · rejected */
ALTER TABLE hr_mentors ADD COLUMN consent_mode TEXT NOT NULL DEFAULT 'ask-me';
       /* ask-me · auto · auto-track */
ALTER TABLE hr_mentors ADD COLUMN capacity     INTEGER NOT NULL DEFAULT 2;
ALTER TABLE hr_mentors ADD COLUMN tracks       TEXT NOT NULL DEFAULT '';
ALTER TABLE hr_mentors ADD COLUMN confirmed_at INTEGER;
ALTER TABLE hr_mentors ADD COLUMN paused_until INTEGER;
ALTER TABLE hr_mentors ADD COLUMN synced_at    INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS idx_hr_mentors_airtable
  ON hr_mentors(airtable_id) WHERE airtable_id != '';
CREATE INDEX IF NOT EXISTS idx_hr_mentors_state ON hr_mentors(state, vetted DESC);

/* `vetted` is kept and now means what it always claimed: a steward has checked
   them. `state` carries availability. The two were conflated because there was
   no lifecycle; now there is. */

CREATE TABLE IF NOT EXISTS hr_mentor_requests (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  mentor_id    INTEGER NOT NULL REFERENCES hr_mentors(id) ON DELETE CASCADE,
  member_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  need         TEXT NOT NULL,
  why_them     TEXT NOT NULL DEFAULT '',
  tried        TEXT NOT NULL DEFAULT '',
  asking_for   TEXT NOT NULL DEFAULT '',   -- 30 min · async review · intro
  state        TEXT NOT NULL DEFAULT 'sent'
               CHECK (state IN ('sent','accepted','declined','expired','withdrawn')),
  decline_note TEXT NOT NULL DEFAULT '',   -- optional, mentor's own words
  token_hash   TEXT NOT NULL DEFAULT '',
  token_expires INTEGER,
  created_at   INTEGER NOT NULL,
  answered_at  INTEGER
);

CREATE INDEX IF NOT EXISTS idx_hr_mreq_mentor ON hr_mentor_requests(mentor_id, state, created_at);
CREATE INDEX IF NOT EXISTS idx_hr_mreq_member ON hr_mentor_requests(member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hr_mreq_token  ON hr_mentor_requests(token_hash);

/* The exposed booking link. One member, one mentor, one window. */
CREATE TABLE IF NOT EXISTS hr_mentor_grants (
  id          TEXT PRIMARY KEY,            -- random, appears in the URL
  request_id  INTEGER NOT NULL REFERENCES hr_mentor_requests(id) ON DELETE CASCADE,
  mentor_id   INTEGER NOT NULL REFERENCES hr_mentors(id) ON DELETE CASCADE,
  member_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  INTEGER NOT NULL,
  revoked     INTEGER NOT NULL DEFAULT 0,
  clicks      INTEGER NOT NULL DEFAULT 0,
  first_click INTEGER,
  created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hr_grants_member ON hr_mentor_grants(member_id, expires_at);

/* Did it happen, and was it any good. Gate 5, borrowed wholesale. */
CREATE TABLE IF NOT EXISTS hr_mentor_outcomes (
  request_id  INTEGER PRIMARY KEY REFERENCES hr_mentor_requests(id) ON DELETE CASCADE,
  met         INTEGER NOT NULL DEFAULT 0,
  useful      INTEGER,                     -- 1..5
  note        TEXT NOT NULL DEFAULT '',
  logged_at   INTEGER NOT NULL
);

/* Append-only, same reasoning as hr_intro_events. */
CREATE TABLE IF NOT EXISTS hr_mentor_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  mentor_id  INTEGER,
  request_id INTEGER,
  actor_id   TEXT REFERENCES users(id) ON DELETE SET NULL,
  actor_kind TEXT NOT NULL DEFAULT 'member'
             CHECK (actor_kind IN ('member','steward','mentor','system','agent')),
  event      TEXT NOT NULL,
  detail     TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
```

---

## 10. Surfaces

### 10.1 Member

| Route | What it is |
| --- | --- |
| `GET /homeroom/mentors` | Unchanged, plus: `state = 'listed'` only, capacity shown, and no scheduler in the row. |
| `GET /homeroom/mentor/:slug` | Profile. The booking section becomes a request button, a "fully booked this month" notice, or a live grant if one exists. |
| `GET/POST /homeroom/mentor/:slug/request` | The request form (§6.2). Refuses at capacity, refuses when a live request already exists for this pair. |
| `GET /homeroom/mentor/:slug/book/:grant` | The redirect. Validates, increments, 302s. 410s on expiry or revocation, with a "ask again" link. |
| `GET /homeroom/mentors/requests` | The member's own requests and their state. |
| `POST /homeroom/mentor/request/:id/outcome` | Did you meet, was it useful, one line. |

### 10.2 Mentor — no account, all tokenised

| Link | What it does |
| --- | --- |
| `/homeroom/m/:token/accept` | Gate B. Creates the grant, mails the member. |
| `/homeroom/m/:token/decline` | Declines. Optional one-line note, passed on verbatim. |
| `/homeroom/m/:token/later` | Declines *and* pauses them for 30 days. The honest button for "not now", and the one that prevents a burnt-out mentor from having to keep saying no. |
| `/homeroom/m/:token/confirm` | The six-monthly re-confirmation. |
| `/homeroom/m/:token/pause` | Pause for a chosen window. Revokes outstanding grants. |
| `/homeroom/m/:token/withdraw` | Remove me. Immediate, no confirmation email, no win-back sequence. |

Withdraw is deliberately a single click with no friction. A volunteer who wants
out and finds a retention flow instead does not come back, and tells people.

### 10.3 Steward

`/homeroom/stewards/mentors`:

- **The vetting queue** — gate A. New submissions with everything the form
  captured, an accept/reject, and a required note on reject.
- **Sync status** — last run, rows seen, rows changed, errors, and a "sync now".
- **The roster by state** — listed, paused, dormant, withdrawn, with counts.
- **Stuck requests** — sent more than N days ago and unanswered. These are the
  early warning that a mentor has gone quiet, before the re-confirmation cycle
  catches it.
- **Capacity pressure** — mentors hitting their cap, which is a recruiting
  signal rather than a problem.

---

## 11. The messages

Four, in `mentormail.js`. Same discipline as the intro engine: house style from
`SKILL.md`, no emoji, no exclamation marks, digits for numbers.

**1. The request.** Mentor to decide, member's words carried verbatim.

> Subject: 30 minutes on GRAS timelines?
>
> [Name] — a Biopunk resident asked for time with you.
>
> **[Member], [what they build]**
> They need: [need]
> Why you: [why_them]
> Already tried: [tried]
> Asking for: [asking_for]
>
> [Yes, send them my link] · [Not this one] · [Not right now — pause me 30 days]
>
> You are at [n] of [capacity] sessions this month.
> — Homeroom, for Biopunk

The capacity line is there so an accept is an informed one. A mentor who can see
they are at 2 of 2 will make a better decision than one who cannot.

**2. The link.** Member, on accept. Carries the mentor's decline note if they
left one, the grant link, the expiry, and the "before you book" guidance already
on the profile.

**3. Not this one.** Member, on decline. The mentor's note if given, otherwise
*"not available for this one."* No reason is invented, and the member is pointed
at two other mentors with overlapping tags — a decline should end in a next step,
not a dead end.

**4. Still up for this?** The six-monthly re-confirmation, with what is on file
so an update is one click rather than a form.

---

## 12. Guardrails

| Guardrail | Default | Env |
| --- | --- | --- |
| Sessions per mentor per month | From the form, 2 if unset | `HOMEROOM_MENTOR_CAPACITY_DEFAULT` |
| Open requests per member | 3 | `HOMEROOM_MENTOR_MAX_OPEN` |
| Requests per member per month | 6 | `HOMEROOM_MENTOR_MAX_MONTHLY` |
| Same member, same mentor | 1 per 90 days after a decline | `HOMEROOM_MENTOR_REASK_DAYS` |
| Request expiry (unanswered) | 10 days | `HOMEROOM_MENTOR_REQUEST_DAYS` |
| Reminder to the mentor | 1, at day 5 | `HOMEROOM_MENTOR_REMINDER_DAYS` |
| Grant lifetime | 14 days | `HOMEROOM_MENTOR_GRANT_DAYS` |
| Re-confirmation cycle | 180 days | `HOMEROOM_MENTOR_RECONFIRM_DAYS` |
| Auto-pause after silence | 3 unanswered in a row | `HOMEROOM_MENTOR_SILENCE_PAUSE` |

The last one matters more than it looks. Three unanswered requests is a mentor
who has moved on, changed jobs, or is buried. Continuing to send them requests
wastes members' asks on someone who will not answer, and makes the roster look
functional when it is not. Auto-pause is quiet: they get one note saying they
have been paused and one click to come back.

---

## 13. Metrics

| Metric | Why |
| --- | --- |
| Request → accept rate | Routing quality. Falling means members are asking the wrong people, which is §6.2's job. |
| Median time to answer | Mentor engagement, and the leading indicator of churn. |
| Unanswered rate | Feeds auto-pause; the polite version of gone. |
| Grant → click rate | Whether an accepted request turned into an attempted booking. |
| Met rate, and useful rating | The only measure of whether any of this worked. |
| Mentors at capacity | A recruiting signal, not a problem. |
| Dormant share of the roster | The rot number. Rising means re-confirmation is not working. |

Not measured, deliberately: total mentors. A roster of 200 where 60 answer is
worse than a roster of 60, and counting the first number is how you get it.

---

## 14. Failure directions

| Situation | Direction | Behaviour |
| --- | --- | --- |
| Airtable unreachable during sync | **Closed, silent** | Existing roster stands. Never interpreted as "the table is empty". |
| A form submission arrives malformed | **Closed** | Stays `pending`, flagged on the vetting queue with what failed. |
| Scheduler URL fails the host allowlist | **Listed, unbookable** | The mentor is listed with no grant path and a steward is asked to chase the link. Better than dropping a willing volunteer. |
| Mail down when a mentor accepts | **Open, retried** | The grant exists and is on the member's requests page regardless. The accept must never be lost. |
| Mentor accepts after the request expired | **Honoured, with a note** | A mentor who answers on day 11 has done the right thing slowly. Re-open, grant, and tell the member it was late. |
| Two members race the last capacity slot | **First accept wins** | Checked inside the transaction on accept, not at request time. The second gets the "fully booked" message. |
| Mentor clicks accept twice | **Idempotent** | One grant, second click shows the same link. |
| A mentor is deleted from Airtable | **Withdrawn, not deleted** | Rows are kept for the audit trail; state goes `withdrawn` and they vanish from every member surface. |

---

## 15. Phases

**Prerequisite:** durable storage, the same P-1 as the intro engine. Grants and
request tokens outlive a container recycle by design, and a mentor clicking
accept into a 500 is the same failure as a target clicking yes into one.

**Phase 1 — the gate, on the roster that already exists. BUILT.**
`state`, `capacity`, `consent_mode`; requests and grants; the redirect; the
`scheduler` column out of the shared query and its test; the four messages.
Mentors are still imported by the existing script.

*Done when:* no member-facing response contains a scheduler URL, and a booking
link is reachable only through a grant. Both are asserted in
`test/mentordesk.test.js` against rendered bodies.

Shipped as `app/mentordesk.js` (the state machine), `app/mentormail.js`,
`app/views/mentordesk.js`, and the `hr_mentor_*` tables. Five things came out
differently from the sketch above, each for a reason found while building:

| Change | Why |
| --- | --- |
| **One link in the request email, not three** | Mail gateways fetch every URL in a message before delivering it. Three GET links — yes, no, not now — means a corporate link scanner can accept on a mentor's behalf. One link to a page with three POST buttons costs one tap and removes that entirely. |
| **Pausing does not revoke outstanding grants** | §10.2 said it should. It should not: a mentor hitting "not right now" is saying *stop sending me requests*, not *take back the yes I already gave someone else*, and the member holding that grant did nothing wrong. |
| **A mentor with no address cannot be asked at all** | New refusal, `no-contact`. Without it the request is written, never delivered, and expires ten days later looking like a mentor who ignored it. It also makes the state of the current roster visible: **no imported mentor has an address**, so nobody is askable until Phase 2 collects one. |
| **`email` is read the same deliberate way as `scheduler`** | It is not in `MENTOR_FIELDS` either, so it cannot ride a row into a template or the JSON API. `contactFor(id)` is the only way to get it. |
| **`email` is stored in plaintext, not hashed** | §8.3 proposed a hash plus a re-fetch at send time. There is nothing to re-fetch from until the Airtable sync exists, and a hash cannot be mailed. Revisit in Phase 2, when the sync is the source of truth — noted as **M-O-6**. |

Also lazy rather than scheduled: `expireStale()` runs when request pages are
read, not on a cron. A container in `/tmp` has no cron of its own, so anything
that only runs on a timer does not run.

**Phase 2 — the form and the sync.** (~3 days)
The Airtable form, the field allowlist, the scheduled sync plus "sync now", the
vetting queue, `airtable_id` matching.

*Done when:* a form submission appears in the vetting queue within six hours and
nowhere else until a steward acts.

**Phase 3 — keeping it alive.** (~3 days)
Re-confirmation, auto-pause, dormancy, outcomes, the metrics, the steward
roster-by-state view.

*Done when:* a mentor who ignores everything for six months is dormant rather
than listed.

**Phase 4 — optional.** Airtable webhook for instant submissions; Cal.com or
Calendly webhooks to learn a booking actually happened rather than asking the
member; mentor-facing accounts if M-O-1 is ever answered the other way.

---

## 16. Configuration

| Variable | Default | Notes |
| --- | --- | --- |
| `HOMEROOM_MENTOR_SYNC_TOKEN` | falls back to `AIRTABLE_TOKEN` | Read access to the Mentors base. |
| `HOMEROOM_MENTORS_BASE` / `_TABLE` | the existing Mentors base | Already used by the importer. |
| `HOMEROOM_MENTOR_GATE` | `1` | `0` restores today's behaviour: link visible to all members. The switch for the transition. |
| `HOMEROOM_MENTOR_MAIL_FROM` | falls back to `HOMEROOM_MAIL_FROM` | Should be its own identity, as with the intro engine. |
| plus the guardrail variables in §12 | | |

`/homeroom/health` grows: sync configured, last successful sync, pending
vettings, requests unanswered past the window, and grants issued this month.

---

## 17. What this deliberately does not do

- **It does not put the booking link in a page.** §7.
- **It does not give mentors accounts.** §4.
- **It does not hide a decline from the member.** They chose the mentor; §3.
- **It does not chase a mentor more than once**, then it pauses them.
- **It does not run a win-back flow on withdrawal.** §10.2.
- **It does not rank mentors by rating.** Ratings inform stewards and routing;
  a public leaderboard of volunteers is how the top three get all the requests
  and quit. Same reasoning as `funders.js` withholding a percentage under three
  reviews.
- **It does not import a mentor as bookable.** Gate A, always, including for
  rows a steward added by hand.

---

## 18. Relationship to the intro engine

These are two lanes into the same room and should stay two lanes.

**This resolves O-4** in `INTRO-ENGINE.md`, which asked where the line sits for
mentors who have already opted in. The answer this design gives:

- A **listed mentor** never goes through the intro engine. They have standing
  consent, a stated capacity and a booking link; routing them through a
  permission ask would be asking a question they already answered on a form.
- A **`network.js` calendar row** still goes through the full intro flow, as
  that file's own rules require. Appearing in a calendar is not a form
  submission.
- The bridge is one-directional and manual: a steward who has taken someone
  through the intro engine, and who then says yes to mentoring, is sent the
  **onboarding form**. They become a mentor by filling it in, not by a steward
  ticking a box on their behalf.

Shared machinery worth building once, in Phase 1 of whichever ships first:
tokenised consent links, the append-only event log, the outcome-logging
pattern, and the "template first, model optional" drafting split. `intromail.js`
and `mentormail.js` stay separate — the two voices are genuinely different, and
one template file with a `kind` parameter is how a permission ask ends up
addressed to a mentor.

---

## 19. Open questions

- **M-O-1. Mentor accounts.** §4 rejects them and routes everything through
  tokenised links. If mentors later need to see their own history, edit a
  profile, or read a thread, that judgement should be revisited — but as a
  change to `roster.js` with its own review, not as a side effect.
- **M-O-2. Who vets.** Any steward, or a named mentor lead? Gate A is a
  judgement about a stranger's credibility, and "everyone can" often means
  nobody does.
- **M-O-3. Does a declined member learn the reason?** §11 passes the mentor's
  note verbatim when they leave one. Some mentors will write something blunter
  than they would say aloud. Options: pass through (proposed), steward review
  first, or never show it.
- **M-O-4. Should mentors see outcomes?** A mentor who learns their advice
  changed something stays a mentor. A mentor who learns their session was rated
  2 of 5 may not. Aggregate-only, once a year, is the likely answer.
- **M-O-6. Mentor addresses at rest.** Phase 1 stores them in plaintext because
  there is no sync to re-fetch from and a hash cannot be mailed. Once Phase 2
  makes Airtable the source of truth, the address can be a hash plus a
  send-time lookup, as §8.3 proposed. Until then `hr_mentors.email` is the most
  sensitive column this app holds and `contactFor()` is the only reader.
- **M-O-5. Capacity across lanes.** A mentor who is also reachable through the
  intro engine could be booked twice over. Simplest fix: once someone is a
  listed mentor, the intro engine stops surfacing them entirely — proposed in
  §18, but it means a member could be denied an intro to someone who is at
  mentor capacity, which may read as arbitrary.
