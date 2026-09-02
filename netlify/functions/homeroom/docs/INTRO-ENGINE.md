# The Introduction Engine

A specification for automated, double opt-in introductions from Homeroom into
the broader Biopunk network, sourced through Happenstance.

**Status:** proposed. Nothing here is built. This document exists to be argued
with before any of it is.

**Scope of this document:** the whole engine, including the parts deliberately
deferred. Phase 1 — individual searches through one connector's network — is
what gets built first. The Biopunk *group* on Happenstance is Phase 4 and is
specified here only far enough to prove the earlier phases do not have to be
rewritten to reach it.

---

## 1. The one-paragraph version

A member states an ask in Homeroom — "I need someone who has taken a
fermentation-derived ingredient through FDA GRAS self-affirmation." The engine
turns that into a Happenstance query against the connector's network, brings
back candidates, drafts a forwardable blurb from the member's own profile and
ask, and puts the whole thing in front of a steward. The steward shortlists a
few and shows the member, once, so they can strike anyone they are already
talking to. Then the steward picks one and clicks. That click sends a short
permission-ask to the target — not to the member — and the member is never told
who was approached or who declined, which is what keeps a "no" free. On yes, the
engine sends the actual introduction with both people on it and opens a Homeroom
thread. Every state change is logged, every target can opt out
of ever being asked again, and no message is ever sent without a human clicking
a button.

---

## 2. Why this, and why not just a search box

Homeroom already has an intro flow: `hr_intros` in `app/schema.js`, a request
form, an accept/decline, and a message thread opened on acceptance. It works,
and it is entirely *internal* — member to member, both of whom already have
accounts and both of whom already agreed to be in the room.

The thing members actually need is the thing that room does not contain. A
resident who needs a regulatory consultant, a contract manufacturer, or a
specific investor is asking about people who are not Homeroom members, will
never be Homeroom members, and have not agreed to anything. That graph exists —
it is in the connector's Happenstance account, in the calendar rows already
captured in `app/data/network.js`, and in the relationships that make a
residency worth joining. Today the only interface to it is asking Elliot in
Slack and hoping he remembers.

The naive product is a search box over that graph. That product is wrong, and
the reason is worth stating precisely because it drives every design decision
below:

> **The connector's network is not a directory. It is a list of people who
> trust one person, and every introduction spends a little of that trust.**

A search box hands 40 members the ability to spend it, in parallel, without
seeing the balance. `app/data/network.js` already refuses this, in as many
words: *"appearing in a calendar is evidence someone was met, not that they
agreed to take bookings."* The intro engine is the same sentence applied to a
much larger graph, so it inherits the same rule.

What follows is therefore not a search feature with a consent step bolted on.
It is a consent workflow that happens to have a search inside it.

---

## 3. The rule: five gates, in order

Double opt-in is usually described as two gates. It is really five, and the
three usually left implicit are the ones that decide whether the thing works.

| # | Gate | Who passes it | What it prevents |
| --- | --- | --- | --- |
| 1 | **The ask is written down** | The member | Vague asks. "Can you intro me to investors" is not an ask; it is a chore handed to the connector. |
| 2 | **The connector approves the ask** | A steward | The connector's name going on a request they would not have made themselves. |
| 3 | **The target is asked privately** | The target | The target being put on the spot in front of the requester. This is the gate everyone means by "double opt-in". |
| 4 | **The connector sends the intro** | A steward | An automated system emailing a real person on a human's behalf without that human in the loop. |
| 5 | **The outcome is recorded** | The member | The connector never learning that the last six intros went nowhere. |

Under the `shortlist` setting (§5, decided) there is a member veto step between
gates 2 and 3: the member strikes anyone they are already in conversation with,
before anyone is approached. It is not a sixth gate — it removes candidates, it
never approves one — and it is designed so that using it does not let the member
observe what happens to the rest.

Gate 3 has one non-negotiable property, and if any part of this is ever
rewritten it is the part to keep:

> **A "no" at gate 3 costs the target nothing and is never seen by the
> requester.** The requester is not on the permission message, is not told a
> specific person was asked, and is not told who declined. They are told the
> ask is still open.

This is what makes the target's yes worth anything. If declining is socially
expensive — if the requester is watching, or will find out — then the yes is
extracted, not given, and the introduction is worse than none. Every UI
decision below that looks over-cautious traces back to this line.

The corollary is that **silence is also a no.** A target who does not answer in
the configured window is aged out to `no_reply`, the member is told the ask is
still open, and the target is never chased more than once. Chasing is how a
warm network becomes a cold one.

---

## 4. What Happenstance actually gives us

Checked against the live account on 2026-09-02, so the numbers below are real
rather than assumed.

| Fact | Value | Consequence for this design |
| --- | --- | --- |
| Reachable graph | The connector's own connections, plus **37 friends** whose networks are shared | Big enough to be worth building against; entirely one person's social capital. |
| Groups on the account | **One**, `livetheresidency.com` | There is **no Biopunk group yet**. Phase 4 is genuinely future work, not a config change. |
| Search cost | **2 credits** per search, 2 per additional page | Searching is metered. This is a budget, not an afterthought. |
| Research cost | **1 credit** per person | Enrichment must be opt-in per candidate, never automatic per result. |
| Current balance | **0 credits** | The feature cannot run today. Top-up is a launch prerequisite. |
| Search shape | Asynchronous: `search-network` returns an id, results are polled | A request/response route cannot serve this. The engine needs a job row and a poll. |
| Result shape | Ranked people with summaries, matching evidence, **mutual connections**, affinity scores, and suggested intro paths | The mutual-connection field is what makes gate 4 possible: it names who should actually send the intro. |

Three design consequences fall straight out of that table.

**Searching is a steward action, not a member action.** At 2 credits a search
and a balance that a member cannot see, a member-triggered search is a member-
triggered invoice. Members write asks; stewards spend credits. A per-cohort
credit budget with a hard stop is in §10.

**Searches are cached and reused.** Two members asking for GRAS consultants in
the same month should cost 2 credits, not 4. The `hr_hs_searches` table keys on
a normalized query and is reusable within a TTL.

**Every result is a person who has not agreed to anything.** Happenstance
returns them because they are in someone's contact graph. Storing them makes
Homeroom a partial copy of a private social graph, which is a meaningful
liability. §9 caps what is stored and for how long.

---

## 5. Who can see a name, and when

This is the central product decision. **Decided: `shortlist`** — the member sees
the steward's shortlist before anyone is asked. §18 records the decision; this
section specifies what it costs and the four mechanisms that keep gate 3 alive
under it.

### 5.1 The cost, stated plainly

Gate 3 is only meaningful if the target's "no" is invisible. The obvious
implementation of `shortlist` breaks that: the member watches a name go onto the
list, no intro comes back, and the decline is legible. Some fraction of targets
will sense that and say yes to avoid the awkwardness, and the mechanism degrades
into a warm-looking cold email.

So `shortlist` is not implemented as "show the member the list and narrate what
happens to it." It is implemented as **veto-then-blind**: the member sees the
shortlist exactly once, to remove people, and learns nothing about it
afterwards.

### 5.2 Veto-then-blind

```
steward shortlists 5  →  member sees 5, vetoes 2  →  steward asks 1 of the
                         remaining 3  →  member is told only "asked, waiting"
```

The member knows *someone* was asked. They do not know **who**, and that is the
whole trick: a decline cannot be attributed to a person the member never learned
was approached. The member gets what `on-accept` denied them — the ability to
say "not that one, we already spoke" — and the target keeps a decline that
points at nobody in particular.

Four mechanisms make that hold. All four are requirements, not preferences; the
first one dropped takes the invisible decline with it.

**M-1. Selection is never disclosed.** After the veto window closes the ask page
shows aggregate state only: `asked · waiting`, then `introduced` or `still
open`. No per-candidate status is rendered to a member in HTML or JSON, ever,
including for candidates they saw on the shortlist. This is the load-bearing
one.

**M-2. The shortlist is shown once and then withdrawn.** Once the veto window
closes, the names are gone from the member's view of the ask. A member can of
course screenshot a page, and this does not pretend otherwise — it removes the
casual correlation, which is most of it.

**M-3. Order carries no signal.** The member-visible shortlist is shuffled per
render, with no affinity score, no ranking, no "top match" badge. A ranked list
tells the member which one was probably asked first, which re-attaches the
decline to a name.

**M-4. A shortlist of one or two is not shown at all.** Below
`HOMEROOM_INTRO_SHORTLIST_MIN` (default 3) there is nothing to hide behind:
showing a member two names and then asking one of them makes a decline a coin
flip, and showing one makes it a certainty. Under the minimum the ask silently
falls back to `on-accept` behaviour for that ask, and the steward is told why.

The veto screen says all of this to the member in plain words, because a
mechanism that works by managing what someone knows should not also be a
surprise:

> These people have not been asked yet, and some of them will say no. Tell us
> who to leave out. After that we will not tell you who we approached or who
> declined — that is what makes it safe for them to decline.

### 5.3 The settings

`HOMEROOM_INTRO_DISCLOSURE` stays configurable. The two alternatives are kept
because Phase 4 changes the calculus (§14) and because a connector may want to
tighten it after seeing real behaviour.

| Setting | Member sees | Notes |
| --- | --- | --- |
| `shortlist` | The shortlist once, to veto, under M-1 to M-4 | **Default.** |
| `on-accept` | Nothing until a target says yes | The strict reading. The automatic fallback whenever a shortlist is under the minimum. |
| `none` | Never a list — only the accepted intro | For a connector who does not want members learning the shape of their network at all. Makes the member a passenger in their own intro. |

Stewards always see everything. The audit log is steward-visible and never
member-visible.

### 5.4 The residual risk, unresolved

A determined member who screenshots every shortlist and correlates across
several asks can eventually infer who declines. Nothing in M-1 to M-4 stops
that, and no software mechanism will.

That is a **norm**, not a control, and it belongs in the same written policy as
P-4: a member who tries to work out who turned them down is misusing the room,
and it is a stewarding matter rather than an engineering one. Worth saying out
loud in the member-facing copy at least once, because the people who would do
it mostly have not thought about it.

---

## 6. Architecture

### 6.1 Where the code goes

Following the conventions already in this function — one module per external
service, `models.js` for the data layer, `routes.js` for surfaces, views
separate:

```
app/
├── happenstance.js     the client: search, poll, groups, research.
│                       Zero deps, fetch + AbortController, field allowlist.
│                       Same shape as roster.js.
├── introengine.js      the state machine: asks → candidates → permission →
│                       introduction → outcome. Pure-ish; no HTTP, no views.
├── blurbs.js           drafting. Template first, model second (§8).
├── intromail.js        the four message templates and the tokenised links.
│                       Splits from mail.js, which stays reset-only.
├── models.js           + the query surface for the new tables
├── schema.js           + the hr_intro_* tables (§6.3)
├── routes.js           + member, steward and API surfaces (§7)
└── views/
    └── intros.js       new file — the existing intro views in pages.js are
                        member-to-member and stay there
```

`introengine.js` holds every state transition and is the only module allowed to
write the candidate status column. Routes call it; it calls `intromail.js`. That
separation is what makes the transitions testable without a server, which is how
`roster.js` is tested today.

### 6.2 The state machine

An **ask** is the member's request. A **candidate** is one person, considered for
one ask. The lifecycle belongs to the candidate.

```
ask:        draft → open → sourcing → vetting → shortlisted → closed
                                 ↘ abandoned (member withdrew / aged out)

candidate:  suggested                       ← returned by Happenstance
              ├→ screened_out               ← steward rejects, with a reason
              └→ shortlisted                ← shown to the member (§5.2)
                   ├→ vetoed                ← MEMBER removed it. Terminal.
                   ├→ withdrawn             ← steward changes their mind
                   └→ permission_sent       ← GATE 4: a steward clicked
                        ├→ declined         ← target said no. Member never told.
                        ├→ no_reply         ← window expired. Member never told.
                        └→ agreed           ← GATE 3 passed
                             └→ introduced  ← the intro mail went out
                                  └→ outcome_logged   ← GATE 5
```

`vetting` is the window the `shortlist` disclosure setting creates: the
shortlist is visible to the member, and no permission may be sent out of it.
It closes on the member's submission or after `HOMEROOM_INTRO_VETO_HOURS`
(default 48), whichever comes first, and an ask does not stall on a member who
never looks — silence is "no vetoes", not a hold.

Rules the machine enforces, not the UI:

- `permission_sent` is reachable **only** from a route that carried a valid CSRF
  token and a steward session. No background job, no agent, no API token can
  reach it. This is gate 4 expressed as code.
- `permission_sent` is unreachable while the ask is `vetting`. A member who is
  still deciding who to exclude has not finished, and a permission sent in that
  window could land on someone they were about to veto.
- **No member-facing response ever renders a candidate's status.** Not on the
  ask page, not in the JSON API, not in a notification. Once `vetting` closes,
  members get aggregate state only (§5.2, M-1). This is the one rule in the
  whole engine that is asserted against rendered output rather than against the
  model, because it is a claim about bytes leaving the server.
- `vetoed` is terminal for that (ask, person) pair, and unlike a decline it is
  *not* a cooldown: the member excluded them, usually because a conversation
  is already happening, which says nothing about whether the target would have
  agreed. A veto never suppresses that person for anyone else.
- `introduced` is reachable **only** from `agreed`. There is no override, not
  even for a steward. A steward who wants to introduce someone who never
  answered can send their own email from their own client; the engine will not
  do it and will not pretend it did.
- `declined` and `no_reply` are terminal for that (ask, person) pair and write a
  cooldown row. The same person cannot be surfaced for the same member for
  `HOMEROOM_INTRO_COOLDOWN_DAYS` (default 180), or for any member for
  `HOMEROOM_INTRO_GLOBAL_COOLDOWN_DAYS` (default 45).
- A target who clicks "never ask me again" writes to `hr_intro_suppression` and
  is filtered out of every future search result, permanently, before a steward
  ever sees them.

### 6.3 Schema

New tables, all `hr_intro_*` except the search cache. Column notes explain the
non-obvious ones.

```sql
/* ------------------------------------------------------------------ asks */

CREATE TABLE IF NOT EXISTS hr_intro_asks (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  headline      TEXT NOT NULL,             -- "GRAS self-affirmation, precision ferm"
  need          TEXT NOT NULL,             -- what they need, in their words
  why_now       TEXT NOT NULL DEFAULT '',  -- timing. Goes in the blurb verbatim.
  ask_of_target TEXT NOT NULL DEFAULT '',  -- "30 minutes" — the specific request
  exclusions    TEXT NOT NULL DEFAULT '',  -- people/orgs already in conversation
  keywords      TEXT NOT NULL DEFAULT '',  -- steward-editable search terms
  status        TEXT NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','open','sourcing','vetting','shortlisted','closed','abandoned')),
  veto_opened   INTEGER,                   -- when the member was shown the shortlist
  veto_closes   INTEGER,                   -- +HOMEROOM_INTRO_VETO_HOURS; no permission before this
  veto_done     INTEGER NOT NULL DEFAULT 0,-- member submitted, so close early
  disclosure    TEXT NOT NULL DEFAULT 'shortlist'
                CHECK (disclosure IN ('shortlist','on-accept','none')),
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  closed_at     INTEGER
);

CREATE INDEX IF NOT EXISTS idx_hr_intro_asks_status ON hr_intro_asks(status, updated_at DESC);

/* `disclosure` is stamped per ask at creation from HOMEROOM_INTRO_DISCLOSURE,
   not read live. Changing the setting must not retroactively expose names on
   asks whose members were told something different — and, in the other
   direction, must not hide a shortlist a member has already seen. */

/* --------------------------------------------------------- search cache */

/* One Happenstance search. Cached and reusable: at 2 credits a call, two
   members asking the same question in the same month must not cost 4. */
CREATE TABLE IF NOT EXISTS hr_hs_searches (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  query_hash    TEXT NOT NULL,             -- sha256 of the normalised query + scope
  query         TEXT NOT NULL,
  scope         TEXT NOT NULL DEFAULT '',  -- JSON: {groups, includeFriends, ...}
  search_id     TEXT NOT NULL DEFAULT '',  -- Happenstance uuid
  page_id       TEXT NOT NULL DEFAULT '',  -- for find-more-results pages
  state         TEXT NOT NULL DEFAULT 'running'
                CHECK (state IN ('running','complete','failed')),
  credits       INTEGER NOT NULL DEFAULT 0,
  result_count  INTEGER NOT NULL DEFAULT 0,
  error         TEXT NOT NULL DEFAULT '',
  requested_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at    INTEGER NOT NULL,
  completed_at  INTEGER,
  expires_at    INTEGER NOT NULL           -- hard TTL; see §9
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_hr_hs_searches_hash ON hr_hs_searches(query_hash, page_id);

/* ------------------------------------------------------------ candidates */

CREATE TABLE IF NOT EXISTS hr_intro_candidates (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ask_id        INTEGER NOT NULL REFERENCES hr_intro_asks(id) ON DELETE CASCADE,
  search_id     INTEGER REFERENCES hr_hs_searches(id) ON DELETE SET NULL,
  person_hash   TEXT NOT NULL,             -- sha256 of the identity key. The join key.
  name          TEXT NOT NULL,
  headline      TEXT NOT NULL DEFAULT '',  -- role + org, as returned
  evidence      TEXT NOT NULL DEFAULT '',  -- why Happenstance matched them
  affinity      REAL,                      -- as returned, 0..1
  connector     TEXT NOT NULL DEFAULT '',  -- the mutual who should actually send it
  profile_url   TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'suggested'
                CHECK (status IN ('suggested','screened_out','shortlisted','vetoed',
                                  'withdrawn','permission_sent','declined','no_reply',
                                  'agreed','introduced','outcome_logged')),
  screen_reason TEXT NOT NULL DEFAULT '',  -- steward's note, member never sees it
  veto_reason   TEXT NOT NULL DEFAULT '',  -- member's, from a fixed vocabulary (§7.1)
  shown_at      INTEGER,                   -- when the member saw this name, if ever
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  expires_at    INTEGER NOT NULL           -- purged unless promoted; see §9
);

CREATE INDEX IF NOT EXISTS idx_hr_intro_cand_ask ON hr_intro_candidates(ask_id, status);
CREATE INDEX IF NOT EXISTS idx_hr_intro_cand_person ON hr_intro_candidates(person_hash, status);

/* ---------------------------------------------------------------- blurbs */

/* Versioned, because the member edits the draft and the steward edits it again,
   and "what did we actually send" must be answerable a year later. */
CREATE TABLE IF NOT EXISTS hr_intro_blurbs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ask_id        INTEGER NOT NULL REFERENCES hr_intro_asks(id) ON DELETE CASCADE,
  candidate_id  INTEGER REFERENCES hr_intro_candidates(id) ON DELETE CASCADE,
  version       INTEGER NOT NULL DEFAULT 1,
  body          TEXT NOT NULL,
  source        TEXT NOT NULL DEFAULT 'template'
                CHECK (source IN ('template','model','member','steward')),
  model         TEXT NOT NULL DEFAULT '',
  edited_by     TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at    INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hr_intro_blurbs ON hr_intro_blurbs(ask_id, candidate_id, version DESC);

/* -------------------------------------------------------------- outreach */

/* One message actually sent to a person outside Homeroom, and the token that
   lets them answer it without an account. */
CREATE TABLE IF NOT EXISTS hr_intro_outreach (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  candidate_id  INTEGER NOT NULL REFERENCES hr_intro_candidates(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL
                CHECK (kind IN ('permission','reminder','introduction','closing')),
  to_hash       TEXT NOT NULL,             -- sha256 of the address
  subject       TEXT NOT NULL DEFAULT '',
  body          TEXT NOT NULL DEFAULT '',
  token_hash    TEXT NOT NULL DEFAULT '',  -- sha256; the token itself is never stored
  token_expires INTEGER,
  sent_by       TEXT REFERENCES users(id) ON DELETE SET NULL,
  sent_at       INTEGER,
  answered_at   INTEGER,
  answer        TEXT NOT NULL DEFAULT ''
                CHECK (answer IN ('','yes','no','never')),
  provider_id   TEXT NOT NULL DEFAULT '',  -- Resend message id, for support
  error         TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_hr_intro_outreach_cand ON hr_intro_outreach(candidate_id, kind);
CREATE INDEX IF NOT EXISTS idx_hr_intro_outreach_token ON hr_intro_outreach(token_hash);

/* ----------------------------------------------------------- suppression */

/* "Never ask me again", plus cooldowns. Checked before a steward sees a list,
   not after. Hash-keyed so a database copy is not a mailing list. */
CREATE TABLE IF NOT EXISTS hr_intro_suppression (
  person_hash   TEXT PRIMARY KEY,
  reason        TEXT NOT NULL DEFAULT ''
                CHECK (reason IN ('','opted-out','bounced','steward','complaint')),
  until         INTEGER,                   -- NULL = forever
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS hr_intro_cooldowns (
  person_hash   TEXT NOT NULL,
  member_id     TEXT REFERENCES users(id) ON DELETE CASCADE,  -- NULL = global
  until         INTEGER NOT NULL,
  created_at    INTEGER NOT NULL,
  PRIMARY KEY (person_hash, member_id)
);

/* --------------------------------------------------------------- outcome */

CREATE TABLE IF NOT EXISTS hr_intro_outcomes (
  candidate_id  INTEGER PRIMARY KEY REFERENCES hr_intro_candidates(id) ON DELETE CASCADE,
  met           INTEGER NOT NULL DEFAULT 0,
  useful        INTEGER,                   -- 1..5, member's rating
  note          TEXT NOT NULL DEFAULT '',  -- member-visible to stewards only
  logged_at     INTEGER NOT NULL
);

/* ----------------------------------------------------------------- audit */

/* Append-only. Every transition, who caused it, and what the engine knew.
   This is the table that answers "why did this person get an email". */
CREATE TABLE IF NOT EXISTS hr_intro_events (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ask_id        INTEGER,
  candidate_id  INTEGER,
  actor_id      TEXT REFERENCES users(id) ON DELETE SET NULL,  -- NULL = the target or the system
  actor_kind    TEXT NOT NULL DEFAULT 'member'
                CHECK (actor_kind IN ('member','steward','target','system','agent')),
  event         TEXT NOT NULL,
  detail        TEXT NOT NULL DEFAULT '',
  created_at    INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hr_intro_events ON hr_intro_events(candidate_id, created_at);
```

Note `actor_kind = 'agent'`. An agent calling the tool surface in §7.3 is logged
as an agent, not as the steward whose token it used. A log that cannot
distinguish "Elliot clicked" from "something with Elliot's token called" is not
an audit log.

### 6.4 The Happenstance client

`app/happenstance.js` mirrors `roster.js` deliberately — same shape, same
failure semantics, same allowlist discipline.

```
configured()                       → is a key set
search({ query, scope })           → { ok, searchId } | { ok: false, error }
results(searchId, { pageId })      → { ok, running, people[], complete }
groups()                           → [{ id, name }]
research(description)              → { ok, researchId }   (Phase 4, opt-in)
credits()                          → { balance, hasCredits }
```

**The field allowlist.** Exactly as `roster.js` does with Airtable's People
table, `happenstance.js` declares the complete set of fields it ever reads off a
result and drops everything else at the boundary:

```
name · headline/role · org · evidence · affinity · mutual connections ·
profile url · location
```

Nothing else is persisted, ever. Not phone numbers, not personal email
addresses, not employment history, not whatever the API adds next year. Adding a
field to that list is a code change and therefore a reviewed one — which is the
whole point of writing it down.

**Failure semantics, in the same two-directions form as the roster gate:**

- **Sourcing fails closed.** Happenstance unreachable means the steward sees
  "could not reach Happenstance", not an empty list. An empty list and a failed
  search look identical otherwise, and a steward would reasonably read the
  empty list as "nobody in the network can help", which may be false.
- **Consent fails closed, permanently.** If the suppression check cannot run —
  database error, anything — no permission message is sent. There is no
  circumstance in which "we could not check whether this person asked never to
  be contacted" resolves to contacting them.
- **An in-flight introduction fails open.** Once a target has said yes, the
  introduction mail must go out even if Happenstance, the roster and the model
  are all down. Everything needed is already stored.

---

## 7. The surfaces

### 7.1 Member surfaces

| Route | What it is |
| --- | --- |
| `GET /homeroom/intros/asks/new` | The ask form: headline, need, why now, what you want from them, exclusions. Minimum lengths enforced — gate 1 is a real gate. |
| `POST /homeroom/intros/asks/new` | Creates the ask in `draft`, drafts a blurb, shows it for editing. |
| `POST /homeroom/intros/asks/:id/submit` | `draft → open`. This is the member's opt-in, and the form says so: *"A steward will read this and may forward it, with your name, to someone outside Homeroom."* |
| `GET /homeroom/intros/asks/:id/veto` | **The veto screen.** Live only while the ask is `vetting`. Shuffled names, no scores, no ranking, and the §5.2 copy above the list. 404s before and after the window — a member cannot re-open it to check. |
| `POST /homeroom/intros/asks/:id/veto` | Records vetoes and closes the window early. Each veto takes a reason from a fixed list: *already talking · previous bad experience · conflict of interest · not relevant · rather not say*. Free text is not offered; a steward should not be reading a member's private opinion of a third party. |
| `GET /homeroom/intros/asks/:id` | Status. **Aggregate only**, in every disclosure mode: open · with a steward · your turn to review · asked, waiting · introduced · still open. Never a per-person status, never a count of declines, never the name of anyone asked. |
| `POST /homeroom/intros/asks/:id/withdraw` | `→ abandoned`. Cancels anything not yet sent. Cannot recall a sent permission ask. |
| `POST /homeroom/intros/candidates/:id/outcome` | Gate 5. Did you meet, was it useful, one line. Nagged once at 14 days, then never again. |

The status vocabulary on the ask page is deliberately short and deliberately
vague after the veto window. **"Asked, waiting" covers one target and three**,
and it is the same string whether two people have already declined or nobody
has answered yet. A progress bar, a count, or a "2 of 4 responded" is the same
leak as a name — it lets a member watch declines accumulate. `still open` is
what a member sees when everyone said no, and it is honest: the ask is still
open, and a steward is still on it.

The existing member-to-member flow at `/homeroom/intros` is untouched. The new
work lives under `/homeroom/intros/asks`, and the index page grows a second
section. Two things called "intros" in one place is a naming smell, so the page
labels them **In the house** and **Outside the house**, which is also the
distinction members care about.

### 7.2 Steward surfaces

`/homeroom/stewards/intros`, gated by the existing `stewardsOnly(ctx)`.

| Route | What it is |
| --- | --- |
| `GET /homeroom/stewards/intros` | The queue: open asks, running searches, shortlists awaiting a click, permissions awaiting a reply, and anything aged out. Plus the credit balance, because the steward is the one spending it. |
| `POST /homeroom/stewards/intros/:ask/source` | Spends 2 credits. Confirmation shows the exact query and the current balance. Refuses at zero rather than failing mid-flight. |
| `POST /homeroom/stewards/intros/candidates/:id/screen` | `suggested → screened_out` with a required reason. Reasons are the training data for better queries later. |
| `POST /homeroom/stewards/intros/candidates/:id/shortlist` | `suggested → shortlisted`. Not yet visible to the member. |
| `POST /homeroom/stewards/intros/:ask/release` | Opens the veto window: `sourcing → vetting`, stamps `veto_closes`, notifies the member. Refuses below `HOMEROOM_INTRO_SHORTLIST_MIN` and says why, offering the `on-accept` fallback for that ask instead. |
| `POST /homeroom/stewards/intros/candidates/:id/permission` | **Gate 4.** Disabled while the ask is `vetting`, and on any candidate the member vetoed. Shows the exact outgoing text, editable, then sends. |
| `POST /homeroom/stewards/intros/candidates/:id/introduce` | **The one-click introduction.** Only enabled on `agreed`. |
| `GET /homeroom/stewards/intros/audit/:candidate` | The `hr_intro_events` trail for one candidate, in English. |

The steward's own view of an ask shows each candidate's real status, including
who declined — stewards are the connector, and a connector who cannot see who
said no cannot do their job. The member-facing renderer is a **separate view
function** that takes the ask and returns aggregate state, rather than the
steward view with fields hidden. Hiding fields in a shared template is how a
field comes back six months later in a JSON endpoint nobody re-checked.

The permission and introduce screens both render the **complete outgoing
message** before sending, not a preview of a template. A steward who cannot read
the exact words that will arrive in someone's inbox is not meaningfully
consenting on the connector's behalf, and gate 4 becomes decorative.

### 7.3 The tool function

"One-click introduction as a tool function in the backend" has two readings and
this spec serves both, because they are the same function with two callers.

**The function** lives in `introengine.js`:

```js
/**
 * Send the introduction. The single most consequential call in this app:
 * it puts two real people in an email thread on the connector's name.
 *
 * Preconditions, all enforced here and not by the caller:
 *   - candidate.status === 'agreed'      (gate 3 passed, verifiably)
 *   - not suppressed, not in cooldown    (re-checked at send time)
 *   - a human actor with is_admin        (gate 4)
 *   - the blurb version is pinned        (what was approved is what is sent)
 */
export async function makeIntroduction({ candidateId, actor, blurbVersion, note })
```

**Caller one — the button.** `POST /homeroom/stewards/intros/candidates/:id/introduce`,
CSRF-checked, session-authenticated, `stewardsOnly`. One click.

**Caller two — the agent.** A JSON tool surface under `/homeroom/api/intros/*`,
authenticated by `HOMEROOM_INTRO_TOKEN` rather than a session, so a Claude skill
or an MCP server can drive the pipeline. Four tools:

| Tool | Effect | Sends mail |
| --- | --- | --- |
| `homeroom_list_asks` | Open asks and their state | No |
| `homeroom_source_candidates` | Runs or reuses a Happenstance search, writes candidates | No — spends credits |
| `homeroom_draft_blurb` | Drafts or redrafts a blurb, stores a version | No |
| `homeroom_stage_introduction` | Shortlists a candidate and **stages** the permission message for a steward | No |

There is deliberately **no agent-callable tool that sends anything.** The agent
can do all the work and put the result one click away; the click is a human's.
This is not a hedge about model reliability — it is that gate 4 means a person
took responsibility for spending the connector's credibility, and a token in an
environment variable cannot take responsibility. `makeIntroduction()` rejects
any actor whose session is not an interactive steward session, and the API
routes for `permission` and `introduce` return 405 with that sentence as the
error body.

The `/homeroom/api/intros/*` routes are additionally IP-rate-limited through the
existing helper in `http.js` and are refused entirely when
`HOMEROOM_INTRO_TOKEN` is unset — an unset token means the surface does not
exist, not that it is open.

---

## 8. Drafting the blurb

### 8.1 What a good forwardable blurb is

The permission message is the entire product surface for the target. It has one
job: let a busy person decide in fifteen seconds, and forward it without editing
if they say yes. The constraints follow from that:

- **Under 120 words**, in the member's voice, not the engine's.
- **Names the specific ask** — "30 minutes on GRAS timelines", not "connect".
- **States why this person**, from the search evidence. A blurb that would fit
  anyone reads as a mail merge, which it nearly is, which is exactly the
  impression to avoid.
- **States what the member brings**, if anything. Reciprocity is what separates
  an introduction from a favour.
- **No superlatives about the target.** Flattery reads as automated.
- **An explicit, cost-free out**, in the connector's own words: *"No is a
  completely fine answer and I won't mention it."*

House style from `SKILL.md` applies: no emoji, no exclamation marks, digits for
numbers, sentence case.

### 8.2 How it is produced

**Template first, always.** `blurbs.js` composes a structurally complete blurb
from the ask fields and the member profile with no model call at all. The
feature must work with no API key, exactly as `mail.js` still mints a reset
token with no mail provider configured. The member and the steward can edit it,
and the version history says who wrote what.

**Model second, optional.** With `HOMEROOM_ANTHROPIC_KEY` set, the template is
passed to Claude for a rewrite in the member's voice, using their profile bio
and recent forum posts as a voice sample. `source = 'model'` and the model id
are recorded on the version.

**The call is raw `fetch`, not the SDK.** Decided in §18; the reasoning is that
this repository has no root `package.json`, no lockfile, an empty Netlify build
command, and `"dependencies": {}` in both function packages. Adding
`@anthropic-ai/sdk` is not a line in a manifest here — it is the repo's first
install step, first lockfile and first supply-chain surface, and that is a
change to make deliberately and on its own, not folded into a feature. One POST
is the smaller thing to own, and `supabase.js`, `roster.js` and `mail.js` are
already exactly this shape.

```
POST https://api.anthropic.com/v1/messages
  x-api-key: $HOMEROOM_ANTHROPIC_KEY
  anthropic-version: 2023-06-01
  content-type: application/json

  model:        claude-opus-5
  max_tokens:   1500                     non-streaming; the output is 120 words
  system:       [the style rules, byte-identical every call]
  messages:     [the ask, the member profile, the candidate evidence]
  output_config:
    effort:     low                      short-form rewriting against a supplied
                                         skeleton, not a reasoning task
    format:     { blurb, subject, why_this_person }
```

Notes on the parameters, since a hand-rolled client has to get them right
without a type checker:

- **`anthropic-version` is required** on raw HTTP and is the one header the SDK
  would have supplied silently. Omitting it is a 400 that reads like an auth
  problem.
- **Structured output** via `output_config.format` so the response is a fixed
  object rather than prose to be parsed. Worth more here than usual: the
  fact-checks in the next subsection run against named fields.
- **Effort `low`, thinking left alone.** Thinking is on by default on this
  model; explicitly disabling it is a known way to get reasoning leaking into
  the visible text, which for a 120-word blurb is the whole output. Lower effort
  is the correct cost lever.
- **The system prompt is frozen and identical across calls**, which is the ideal
  shape for prompt caching if volume ever justifies turning it on. Nothing
  per-request goes in it.

What the SDK would have given us and `blurbs.js` therefore has to write, in
about thirty lines:

| Lost | Replacement |
| --- | --- |
| Typed exception classes | Branch on `res.status`: 401 → unconfigured, 400 → terminal and logged loudly (it means we built a bad request, and retrying will not fix it), 429/5xx → retry. |
| Automatic retries | One retry, on 429 and 5xx only, after the `retry-after` header or 2s. Not more: this is a convenience feature and the template is already on screen. |
| Request timeout | `AbortController` at 15s, the same pattern `roster.js` uses. |
| Version pinning | `anthropic-version` is pinned in one constant with a comment saying what to check when it moves. |

At $5/$25 per MTok and roughly 2K in / 400 out per draft, a draft costs about
**$0.02**. A hundred drafts a month is $2. This is not a cost centre; the
Happenstance credits are.

If the repo ever grows real dependency infrastructure for another reason, this
is the first thing that should move onto the SDK, and the seam is one function.

**Three things the model is never allowed to do**, enforced in `blurbs.js`
rather than the prompt:

1. **Invent facts about the target.** The blurb may only reference evidence
   returned by the search, and the draft is checked for organisation and role
   strings that do not appear in the candidate row. This is the same rule
   `perks.js` follows by shipping `code` empty rather than inventing one, and
   the same reasoning as `network.js` on job titles: a wrong claim about a real
   person is a real error.
2. **Write the subject line of the introduction itself.** That is the
   connector's voice and it is a fixed template.
3. **Address the target by name in the permission message body.** The greeting
   is templated from the candidate row so a hallucinated name is impossible.

If the model call fails, times out, or returns something failing those checks,
the template version stands and the steward sees a quiet note. A missing model
never blocks an introduction.

---

## 9. What is stored, and for how long

Candidates are people who never asked to be in this database.

| Data | Retention | Why |
| --- | --- | --- |
| Search results not shortlisted | **30 days**, then purged | They exist to let a steward pick. After a month the ask is stale and the rows are a liability with no use. |
| Screened-out candidates | Hash + reason retained, name purged at 30 days | The reason improves future queries; the name is not needed for that. |
| Vetoed candidates | Hash + veto reason retained, name purged at 30 days | Same as screened-out. The hash is what stops the same person being shortlisted for that member again; the veto reason is a signal about the query, not about the person. |
| Shortlisted but never contacted | **90 days** | Long enough for a slow ask, short enough to matter. |
| Contacted (permission sent onward) | Retained while the ask is live, then 2 years | This is the record of who was emailed and why. Deleting it would delete the accountability. |
| Suppression rows | **Forever** | A "never ask me again" that expires is not a never. |
| `hr_intro_events` | 2 years | The audit trail. |
| Email addresses | **Never stored in plaintext.** `to_hash` only | Same rule as `roster.js`: a copy of the Homeroom database must not be a copy of the connector's contact list. |

That last row has a consequence worth naming: to send the second message
(the introduction) the engine needs the address again, which means it must be
re-fetched from Happenstance at send time rather than cached. That is slower and
occasionally fails, and it is the right trade. `HOMEROOM_INTRO_ADDRESS_CACHE=1`
exists as an escape hatch that caches addresses encrypted at rest for the life
of the ask, and it is off by default and documented as a downgrade.

A purge sweep runs in the existing scheduled-function slot alongside
`luma-sync.mjs`. It is idempotent and logs counts.

---

## 10. Guardrails

The failure mode this engine has is not a bug. It is working correctly, at
volume, until the connector's network stops answering. Every limit below is
about that.

| Guardrail | Default | Env |
| --- | --- | --- |
| Open asks per member | 3 | `HOMEROOM_INTRO_MAX_OPEN` |
| New asks per member per month | 5 | `HOMEROOM_INTRO_MAX_MONTHLY` |
| Permission messages per target per period | 1 per 45 days, any member | `HOMEROOM_INTRO_GLOBAL_COOLDOWN_DAYS` |
| Same target, same member | 1 per 180 days | `HOMEROOM_INTRO_COOLDOWN_DAYS` |
| Permission messages sent house-wide per week | 20 | `HOMEROOM_INTRO_WEEKLY_CAP` |
| Reminders per permission ask | **1**, at 5 days | `HOMEROOM_INTRO_REMINDER_DAYS` |
| Permission window before `no_reply` | 10 days | `HOMEROOM_INTRO_WINDOW_DAYS` |
| Happenstance credits per calendar month | 40 (= 20 searches) | `HOMEROOM_INTRO_CREDIT_BUDGET` |

The weekly house-wide cap is the important one and it is deliberately low. It is
a rate limit on the connector's reputation, and 20 a week is already more cold-
ish outreach than most personal networks absorb. When the cap is hit the steward
queue says so plainly and asks wait; it does not silently queue.

**On the law and the etiquette.** These messages are 1:1, from a named human, to
someone in that human's own network, about a specific person — not bulk
commercial mail. That is the right side of CAN-SPAM and of GDPR's legitimate-
interest reading, and it stays that way only while the volume caps hold. Three
things are non-negotiable regardless: a real physical sender identity on every
message, a one-click "never contact me about this again" that works without a
login and takes effect before any human sees the list again, and **no tracking
pixels or click tracking on the permission message.** Measuring whether someone
opened an email you sent to ask a favour is exactly the behaviour that makes a
warm network feel like a CRM.

---

## 11. The messages

Four templates, in `intromail.js`. Sketched here because the wording *is* the
product; final copy is a review item, not an implementation detail.

**1. Permission ask** — connector to target. The member is not a recipient.

> Subject: Quick one — worth an intro?
>
> [Name] — one of the founders at Biopunk is working on [ask headline], and
> your work on [evidence, one clause] is the closest thing I know to what they
> need. Their note is below.
>
> [blurb, ≤120 words, member's voice]
>
> They are asking for [specific ask]. Want me to introduce you?
>
> [Yes, introduce us] · [Not right now] · [Don't ask me about this again]
>
> No is a completely fine answer and I won't mention it to them.
> — [connector]

**2. Reminder** — once, at 5 days, three lines, same links, then silence.

**3. The introduction** — connector to both, on yes.

> Subject: Intro: [member] ↔ [target]
>
> [Target], meet [member] — [one line]. [Member], meet [target] — [one line].
>
> [blurb]
>
> [Target] has said they are happy to talk. [Member], over to you — take it
> from here.
>
> Moving myself to bcc.

The "moving to bcc" line is not a flourish. It is the connector leaving, which
is what makes the introduction a connection rather than a mediated conversation,
and it sets the expectation that the member follows up rather than waiting.

**4. Closing the loop** — to the target, once, 30 days later, only if the member
logged an outcome: two lines saying what came of it. This is the message that
makes a target say yes the next time, and it is the one every intro system
forgets to send.

Links are tokenised: a 32-byte random token, stored as a SHA-256 hash exactly as
password resets are in `auth.js`, single-use, expiring with the window. A target
answers without an account and without Homeroom learning anything about them
beyond the answer.

---

## 12. Failure directions

The table `roster.js` earned by being wrong in both directions once. Same
format, because the same discipline applies.

| Situation | Direction | Behaviour |
| --- | --- | --- |
| Happenstance unreachable during sourcing | **Closed** | "Could not reach Happenstance." Never an empty list. |
| Suppression check fails | **Closed** | No message sent, at all, ever, on a failed check. |
| Model unavailable for drafting | **Open** | Template blurb stands. Drafting is a convenience. |
| Mail provider down after a target said yes | **Open, retried** | The yes is recorded and the introduction is queued; a steward sees it stuck. Losing a yes is the worst outcome in the system. |
| Credit balance is zero | **Closed, loudly** | Sourcing is refused with the balance shown and a top-up link. Never a silent empty result. |
| Target clicks a token twice | **Idempotent** | First answer wins, second shows what they already said. |
| Two stewards click introduce at once | **Idempotent** | Guarded by candidate status inside a transaction. One email. |
| A member never opens the veto screen | **Proceeds** | The window closes at `veto_closes` and the steward continues. Silence is "no vetoes", not a hold — an ask must not stall on a member who is busy. |
| Shortlist is under the minimum | **Falls back, and says so** | That ask runs `on-accept` and the steward is told why (§5.2, M-4). It never shows a member a list of two. |
| Disclosure setting changes mid-ask | **No effect on live asks** | `disclosure` is stamped per ask at creation. Neither tightening nor loosening the setting rewrites what a member was already told. |
| A member deletes their account mid-ask | **Cascade, then stop** | Ask and candidates cascade. If a permission was already sent and a yes comes back, the target gets one short "no longer needed" note, not silence. |

---

## 13. Metrics

Six numbers on the steward page. The choice of which six is a policy statement,
so it is worth being explicit that **intro volume is not one of them.**

| Metric | Why it is here |
| --- | --- |
| Permission → yes rate | The health of the network. A falling number means asks are getting worse or the network is tiring. Below 50% is a stop-and-think. |
| Median time to answer | Rising means fatigue before the yes rate shows it. |
| No-reply rate | The polite version of no. Counts against the same budget. |
| Introduced → met rate | Whether an accepted intro turned into anything. |
| Outcome-logged rate | Gate 5 compliance. Below 60% and every other number is guesswork. |
| Veto rate | New with the `shortlist` default. A high rate means the queries are wrong, and it is the *cheap* place to find that out — a veto costs nothing, a permission ask costs reputation. Rising veto rate is a prompt to fix sourcing, not a problem in itself. |
| Never-ask-again count | The only one that should be zero. Any non-zero value is a review. |

---

## 14. Plan of action

### Prerequisites — these block Phase 1, not Phase 4

**P-1. Durable storage.** The function's README is explicit that
`HOMEROOM_DB` lives in `/tmp` and a cold container starts from nothing. That is
survivable for a forum. It is **not** survivable for this: a pending permission
token that evaporates when a container recycles means a target clicks "yes,
introduce us" and gets an error, having done the one thing that was asked of
them. This engine must not ship on ephemeral storage. Postgres (the Supabase
project already linked here) or a real volume — the README already names both
and notes that everything above `db.js` is written against a small query
surface. **This is the single largest piece of work in the plan and it is not
in the estimates below**, because it is Homeroom-wide work this feature merely
forces.

**P-2. Happenstance credits.** Balance is 0. 40 credits covers a month of the
budget in §10.

**P-3. A mail sender.** `HOMEROOM_RESEND_KEY` and `HOMEROOM_MAIL_FROM` are
already read by `mail.js` but are for resets. Outreach to people outside the
house wants its own domain identity, SPF/DKIM aligned, and a real physical
address in the footer. Sharing the reset sender risks reset deliverability,
which is a much worse thing to break.

**P-4. A written policy the connector signs off on.** Who may be asked, how
often, in whose name, and who apologises when it goes wrong. The engine encodes
this policy; it cannot substitute for having one.

### Phases

**Phase 0 — the loop, with no Happenstance.** (~1 week after P-1)

Asks, blurb templates, steward queue, permission/introduction messages,
suppression, cooldowns, audit log, outcomes. Candidates are entered **by hand**
by a steward, or picked from the existing `hr_mentors` and `network.js` rows.

This phase is the whole point of the sequencing. It proves the consent workflow,
the message copy and the failure modes against a graph we already have, with no
credits spent and no new external dependency. If the double opt-in loop does not
work with hand-entered candidates, it will not work with two hundred of them.
*Ship this and run it manually for a month before Phase 1.*

Done when: a steward can take an ask from written to introduced without touching
a mail client, a target can decline invisibly and opt out permanently, and
`npm test` covers every transition.

**Phase 1 — Happenstance for individuals.** (~1 week)

`happenstance.js`, the search cache, the async job and poll, the field
allowlist, the candidate list on the steward queue, credit budget and refusal at
zero. Search scope is the connector's own connections and friends
(`includeGroups: false`).

Done when: a steward types keywords, gets ranked candidates with evidence and a
named mutual, and every result is filtered against suppression before display.

**Phase 2 — model-drafted blurbs.** (~3 days)

`blurbs.js` model path, structured output, the three prohibitions and their
checks, version history, member editing.

Done when: the model path can be switched off by unsetting one variable and
nothing else changes.

**Phase 3 — the tool surface and the metrics.** (~4 days)

`/homeroom/api/intros/*`, the four read/stage tools, token auth, `actor_kind =
'agent'` logging, the six metrics, the purge sweep, the closing-the-loop
message.

Done when: an agent can take an ask to one-click-away and provably cannot send
anything.

**Phase 4 — the Biopunk group.** (unscheduled; blocked on the group existing)

There is no Biopunk group on Happenstance today — the account has exactly one
group, `livetheresidency.com`. Phase 4 begins when partners and mentors have
joined one, which is a community-building task rather than an engineering one.

What changes when it exists is smaller than it sounds, which is the point of
the schema above:

- `hr_hs_searches.scope` carries the group id; `includeGroups: true`.
- Multiple connectors. `hr_intro_candidates.connector` already stores the
  mutual; Phase 4 makes it a routing decision — the permission ask is sent by
  **the person who actually knows the target**, which is what makes it warm.
  That requires those connectors to have Homeroom steward accounts and to have
  agreed to have mail sent in their name.
- Group members are a materially different population from a private contact
  graph: they joined a Biopunk group, which is a weak but real opt-in to being
  found. With `shortlist` now the default everywhere (§18, O-1), the Phase 4
  question inverts — it is no longer whether to relax for the group, but whether
  the **private-graph** side should tighten to `on-accept` once there is a
  looser-feeling group path sitting next to it in the same UI. Worth deciding
  with Phase 0 data in hand rather than now. The setting is per ask, so either
  answer is a conditional at ask creation, not a migration.
- `research-person` (1 credit) becomes worth offering as an explicit steward
  action on a single shortlisted candidate. Never automatic, never batched.

---

## 15. Test plan

Following the convention in `test/access.test.js` — the external service stubbed
by replacing `globalThis.fetch`, no network, `:memory:` database.

**Transition tests** (`test/introengine.test.js`), against `introengine.js`
directly:

- Every legal transition, and that every illegal one throws.
- `introduced` is unreachable from anything but `agreed`, including for a
  steward, including via the API surface.
- A suppressed person is filtered before a steward-visible list is built —
  asserted on the list, not on the send.
- Cooldowns, per-member and global, at the boundaries.
- Idempotency: a token used twice, two stewards introducing at once.
- A failing suppression check sends nothing.

**Privacy tests** (extending the existing pattern in `test/homeroom.test.js`,
which already asserts each privacy claim separately because those are the claims
most likely to quietly stop being true):

- **The M-1 assertion.** No candidate *status* appears in any member-facing HTML
  or JSON response, in any disclosure mode, in any state — asserted by rendering
  the ask page against a fixture where the same shortlist contains one
  `declined`, one `permission_sent` and one `no_reply`, and checking the three
  are indistinguishable in the output. This is the single most important test in
  the suite and it should be the first one written.
- A decline is invisible: the member's ask page is byte-identical before and
  after a `declined` transition, apart from timestamps.
- Under `shortlist`, names appear on the veto screen **only** while the ask is
  `vetting`, and the same route 404s for that member before and after.
- The member-visible shortlist is shuffled and carries no affinity score
  (M-3): two renders of the same fixture differ in order, and no rendered body
  contains the affinity value.
- A shortlist below the minimum never reaches a member (M-4): the ask runs
  `on-accept` and the veto route 404s throughout.
- `disclosure` is read from the ask row, not the environment: changing
  `HOMEROOM_INTRO_DISCLOSURE` mid-test does not change what an existing ask
  renders.
- No permission can be sent while an ask is `vetting`, and none to a `vetoed`
  candidate — asserted through the route, not just the model.
- No plaintext address in any table after a full run.
- The audit trail distinguishes `steward` from `agent` for the same token.

**Copy tests:** the permission message contains an opt-out link, no tracking
URL, and no candidate fact absent from the candidate row.

**Drafting tests:** with the model stubbed to return a hallucinated employer,
the check rejects it and the template version stands.

---

## 16. Configuration

| Variable | Default | Notes |
| --- | --- | --- |
| `HOMEROOM_HAPPENSTANCE_KEY` | — | Without it, sourcing is unavailable and the steward page says so. The rest of the engine still works. |
| `HOMEROOM_INTRO_ENABLED` | `0` | Master switch. Off means the surfaces do not exist. |
| `HOMEROOM_INTRO_DISCLOSURE` | `shortlist` | `shortlist` · `on-accept` · `none`. Stamped per ask at creation, never read live. See §5. |
| `HOMEROOM_INTRO_VETO_HOURS` | `48` | How long the member has to exclude people before the steward proceeds. |
| `HOMEROOM_INTRO_SHORTLIST_MIN` | `3` | Below this, the shortlist is never shown and the ask falls back to `on-accept`. See §5.2, M-4. |
| `HOMEROOM_INTRO_TOKEN` | — | Bearer token for `/homeroom/api/intros/*`. Unset means the surface 404s. |
| `HOMEROOM_ANTHROPIC_KEY` | — | Blurb drafting. Without it, template blurbs only. |
| `HOMEROOM_INTRO_MODEL` | `claude-opus-5` | Called over raw HTTP; `anthropic-version` is pinned in code, not configurable. |
| `HOMEROOM_INTRO_MAIL_FROM` | falls back to `HOMEROOM_MAIL_FROM` | Should be its own identity — see P-3. |
| `HOMEROOM_INTRO_CONNECTOR` | first steward | Whose name is on the messages. |
| `HOMEROOM_INTRO_WINDOW_DAYS` | `10` | |
| `HOMEROOM_INTRO_REMINDER_DAYS` | `5` | |
| `HOMEROOM_INTRO_COOLDOWN_DAYS` | `180` | Same member, same target. |
| `HOMEROOM_INTRO_GLOBAL_COOLDOWN_DAYS` | `45` | Any member, same target. |
| `HOMEROOM_INTRO_WEEKLY_CAP` | `20` | House-wide permission messages per week. |
| `HOMEROOM_INTRO_MAX_OPEN` | `3` | Open asks per member. |
| `HOMEROOM_INTRO_MAX_MONTHLY` | `5` | New asks per member per month. |
| `HOMEROOM_INTRO_CREDIT_BUDGET` | `40` | Happenstance credits per calendar month. |
| `HOMEROOM_INTRO_ADDRESS_CACHE` | `0` | `1` caches target addresses for the life of an ask. A documented downgrade — see §9. |

`/homeroom/health` grows four fields: whether Happenstance is configured and
answering, the credit balance, permissions awaiting a reply, and introductions
stuck after a yes. The last one is the alarm.

---

## 17. What this deliberately does not do

- **It does not let members search.** §4 and §5.
- **It does not tell a member who was asked, or who said no.** Members see a
  shortlist once, to veto; after that, aggregate state only. §5.2.
- **It does not send anything without a human click.** §7.3.
- **It does not chase.** One reminder, then the ask ages out.
- **It does not track opens or clicks on the permission message.** §10.
- **It does not import Happenstance into a directory.** No browsable page of
  the connector's network exists at any point, for anyone, including stewards.
  Candidates are only ever visible in the context of a specific ask.
- **It does not do double opt-in for the introduction thread itself.** Once both
  people have agreed, the engine gets out of the way — the conversation happens
  in email, not in Homeroom, because that is where the target already is and
  they do not have an account.
- **It does not score members.** No trust tiers, no earned intro budgets. The
  caps in §10 are flat and identical for everyone.

---

## 18. Decisions, and what is still open

### Decided

**O-1. Disclosure default → `shortlist`.** Members see the steward's shortlist
once, to veto, before anyone is asked.

The trade taken: a member's own knowledge of who they are already talking to is
better than a steward's guess, and finding that out *before* a permission goes
out saves both a credit and a piece of the connector's reputation. The
exclusions field on the ask form was never going to cover it — a member cannot
list everyone they have not yet been offered.

What it costs, and what pays for it: the naive form of `shortlist` makes a
decline legible, which would quietly break gate 3. §5.2 is the answer —
veto-then-blind, with four mechanisms (selection never disclosed, list withdrawn
after the window, order carries no signal, no list under three names). M-1 is
load-bearing: **no member-facing response ever renders a candidate's status.**
If a later change makes per-candidate state visible to members, this decision
has been silently reversed and gate 3 is gone.

§5.4 records what none of that fixes: a member who screenshots shortlists across
several asks can correlate. That is a norm for P-4's written policy, not a
control.

**O-5. Blurb drafting → raw `fetch`.** One POST to `/v1/messages`, in the shape
`supabase.js`, `roster.js` and `mail.js` already use.

The deciding fact is not aesthetic. This repository has **no root
`package.json`, no lockfile, and an empty Netlify build command**; both function
packages declare `"dependencies": {}`. Taking `@anthropic-ai/sdk` here would be
the repo's first install step and first supply-chain surface, introduced as a
side effect of a blurb feature. That is a change worth making deliberately and
on its own — and if it is ever made, §8.2 says this is the first thing that
should move onto the SDK, and the seam is one function.

What it costs: typed errors, retries, and a maintained client against an API
whose surface does move. §8.2 specifies the replacements — status branching, one
retry on 429/5xx, an `AbortController` timeout, and a pinned
`anthropic-version` constant with a comment saying what to check when it moves.
This is the deviation from the usual guidance, taken with the reason written
down.

### Still open

These are decisions for the connector, not for the implementation. None blocks
Phase 0.

- **O-2. Who signs the messages** once there is more than one connector. The
  person who knows the target is the right answer and requires their consent to
  have mail sent in their name.
- **O-3. Should the member ever learn a decline happened**, in aggregate — "two
  people were asked and it did not work out"? Now sharper than when it was
  written: under `shortlist` the member already knows roughly who *might* have
  been asked, so an aggregate count is a much bigger hint than it was under
  `on-accept`. **Current answer, and the one §7.1 specifies: no.** "Asked,
  waiting" means one target or three, and "still open" is what a member sees
  when everyone said no. Revisit only with evidence that members find it
  dishonest rather than merely opaque.
- **O-4. Mentors already in Homeroom.** A `vetted` mentor with a scheduler has
  already opted in and does not need gate 3 at all; the engine should route
  those straight to the existing booking link. Where exactly is the line — does
  a `network.js` row with `source = 'calendar'` count? (Current answer: no. It
  goes through the full flow, per that file's own rules.)
- **O-6. Retention on contacted candidates.** Two years is proposed in §9. It is
  the accountability record and also the largest store of other people's data
  this repository would hold. Shorter is defensible.
- **O-7. Whether `shortlist` survives contact with real members.** New, and the
  one to watch. The veto step adds a round trip and up to 48 hours to every ask,
  and Phase 0 will show whether members actually use it or let the window lapse.
  A high lapse rate means the friction bought nothing and `on-accept` was right
  after all — which is cheap to switch back to, because the setting is per ask.

---

## 19. Appendix: the account, as observed

Recorded so the numbers in §4 can be re-checked rather than trusted.

```
get-user     → Elliot Roth, 37 friends whose networks are shared
get-groups   → 1 group: livetheresidency.com (216fc3be-…)
                No Biopunk group exists yet.
get-credits  → balance 0; 120 credits purchased to date, all spent
                61 searches at 2 credits each
Costs        → search-network 2 · find-more-results 2 · research-person 1
Async        → search-network returns an id; get-search-results polls until
                complete and reports whether another page exists
```
