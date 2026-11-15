/*
 * HOMEROOM — the members-only layer.
 *
 * Everything here is namespaced `hr_` and hangs off the shared `users` table,
 * so one handle logs you into both the news feed and the network. Written as
 * one idempotent DDL string for the same reason the news schema is: migrations
 * on a single-file database are a `CREATE TABLE IF NOT EXISTS` away.
 */

export const HOMEROOM_SCHEMA = `
/* ---------------------------------------------------------------- members */

CREATE TABLE IF NOT EXISTS hr_members (
  user_id      TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL DEFAULT '',
  headline     TEXT NOT NULL DEFAULT '',
  org          TEXT NOT NULL DEFAULT '',
  role         TEXT NOT NULL DEFAULT '',
  cohort       TEXT,
  location     TEXT NOT NULL DEFAULT '',
  bio          TEXT NOT NULL DEFAULT '',
  working_on   TEXT NOT NULL DEFAULT '',
  ask_me_about TEXT NOT NULL DEFAULT '',
  links        TEXT NOT NULL DEFAULT '',
  bsl          TEXT,
  open_intros  INTEGER NOT NULL DEFAULT 1,
  open_hours   INTEGER NOT NULL DEFAULT 0,
  open_collab  INTEGER NOT NULL DEFAULT 1,
  open_hiring  INTEGER NOT NULL DEFAULT 0,
  joined_at    INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_bf_members_cohort ON hr_members(cohort);

CREATE TABLE IF NOT EXISTS hr_expertise (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tag     TEXT NOT NULL,
  PRIMARY KEY (user_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_bf_expertise_tag ON hr_expertise(tag);

/* ------------------------------------------------------------------- labs */

CREATE TABLE IF NOT EXISTS hr_orgs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  tagline     TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  kind        TEXT NOT NULL DEFAULT 'startup',
  stage       TEXT NOT NULL DEFAULT 'idea',
  location    TEXT NOT NULL DEFAULT '',
  website     TEXT,
  cohort      TEXT,
  founded     INTEGER,
  headcount   INTEGER,
  tags        TEXT NOT NULL DEFAULT '',
  created_by  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bf_orgs_kind ON hr_orgs(kind);

CREATE TABLE IF NOT EXISTS hr_org_members (
  org_id  INTEGER NOT NULL REFERENCES hr_orgs(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role    TEXT NOT NULL DEFAULT '',
  admin   INTEGER NOT NULL DEFAULT 0,
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (org_id, user_id)
);

/* Weekly-ish progress notes, the "company update" of the reskin. */
CREATE TABLE IF NOT EXISTS hr_updates (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id     INTEGER NOT NULL REFERENCES hr_orgs(id) ON DELETE CASCADE,
  author_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period     TEXT NOT NULL DEFAULT '',
  body       TEXT NOT NULL,
  asks       TEXT NOT NULL DEFAULT '',
  metrics    TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bf_updates_org ON hr_updates(org_id, created_at DESC);

/* ------------------------------------------------------------------ deals */

CREATE TABLE IF NOT EXISTS hr_deals (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT NOT NULL UNIQUE,
  vendor      TEXT NOT NULL,
  title       TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'other',
  summary     TEXT NOT NULL DEFAULT '',
  details     TEXT NOT NULL DEFAULT '',
  worth       TEXT NOT NULL DEFAULT '',
  code        TEXT NOT NULL DEFAULT '',
  url         TEXT,
  expires_at  INTEGER,
  active      INTEGER NOT NULL DEFAULT 1,
  posted_by   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS hr_deal_claims (
  deal_id    INTEGER NOT NULL REFERENCES hr_deals(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (deal_id, user_id)
);

/* ---------------------------------------------------------------- funders */

CREATE TABLE IF NOT EXISTS hr_funders (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'vc',
  focus       TEXT NOT NULL DEFAULT '',
  stages      TEXT NOT NULL DEFAULT '',
  check_size  TEXT NOT NULL DEFAULT '',
  location    TEXT NOT NULL DEFAULT '',
  website     TEXT,
  description TEXT NOT NULL DEFAULT '',
  dilutive    INTEGER NOT NULL DEFAULT 1,
  added_by    TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bf_funders_kind ON hr_funders(kind);

/* Five stars and a written account, the way Bookface does it. One per member. */
CREATE TABLE IF NOT EXISTS hr_funder_reviews (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  funder_id   INTEGER NOT NULL REFERENCES hr_funders(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  speed       INTEGER,
  value_add   INTEGER,
  invested    INTEGER NOT NULL DEFAULT 0,
  anonymous   INTEGER NOT NULL DEFAULT 1,
  body        TEXT NOT NULL DEFAULT '',
  created_at  INTEGER NOT NULL,
  UNIQUE (funder_id, user_id)
);

/* The fundraising CRM: one row per funder you are tracking. */
CREATE TABLE IF NOT EXISTS hr_pipeline (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  funder_id  INTEGER NOT NULL REFERENCES hr_funders(id) ON DELETE CASCADE,
  org_id     INTEGER REFERENCES hr_orgs(id) ON DELETE SET NULL,
  status     TEXT NOT NULL DEFAULT 'researching',
  amount     TEXT NOT NULL DEFAULT '',
  notes      TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (user_id, funder_id)
);

/* ----------------------------------------------------------- office hours */

CREATE TABLE IF NOT EXISTS hr_slots (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  host_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  format      TEXT NOT NULL DEFAULT 'one-on-one' CHECK (format IN ('one-on-one','group')),
  starts_at   INTEGER NOT NULL,
  minutes     INTEGER NOT NULL DEFAULT 30,
  capacity    INTEGER NOT NULL DEFAULT 1,
  place       TEXT NOT NULL DEFAULT '',
  topics      TEXT NOT NULL DEFAULT '',
  canceled    INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bf_slots_start ON hr_slots(starts_at);

CREATE TABLE IF NOT EXISTS hr_bookings (
  slot_id    INTEGER NOT NULL REFERENCES hr_slots(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question   TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  PRIMARY KEY (slot_id, user_id)
);

/* ------------------------------------------------------------------- jobs */

CREATE TABLE IF NOT EXISTS hr_jobs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id      INTEGER NOT NULL REFERENCES hr_orgs(id) ON DELETE CASCADE,
  posted_by   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  discipline  TEXT NOT NULL DEFAULT 'other',
  employment  TEXT NOT NULL DEFAULT 'full-time',
  location    TEXT NOT NULL DEFAULT '',
  remote      INTEGER NOT NULL DEFAULT 0,
  comp        TEXT NOT NULL DEFAULT '',
  equity      TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  tags        TEXT NOT NULL DEFAULT '',
  closed      INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bf_jobs_org ON hr_jobs(org_id);

CREATE TABLE IF NOT EXISTS hr_applications (
  job_id     INTEGER NOT NULL REFERENCES hr_jobs(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note       TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  PRIMARY KEY (job_id, user_id)
);

/* ----------------------------------------------------------------- events */

CREATE TABLE IF NOT EXISTS hr_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  host_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  kind        TEXT NOT NULL DEFAULT 'meetup',
  starts_at   INTEGER NOT NULL,
  minutes     INTEGER NOT NULL DEFAULT 90,
  place       TEXT NOT NULL DEFAULT '',
  url         TEXT,
  capacity    INTEGER NOT NULL DEFAULT 0,
  canceled    INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bf_events_start ON hr_events(starts_at);

CREATE TABLE IF NOT EXISTS hr_rsvps (
  event_id   INTEGER NOT NULL REFERENCES hr_events(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'going',
  created_at INTEGER NOT NULL,
  PRIMARY KEY (event_id, user_id)
);

/* ---------------------------------------------------------------- library */

CREATE TABLE IF NOT EXISTS hr_library (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  slug       TEXT NOT NULL UNIQUE,
  title      TEXT NOT NULL,
  kind       TEXT NOT NULL DEFAULT 'guide',
  summary    TEXT NOT NULL DEFAULT '',
  body       TEXT NOT NULL DEFAULT '',
  tags       TEXT NOT NULL DEFAULT '',
  author_id  TEXT REFERENCES users(id) ON DELETE SET NULL,
  reads      INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

/* ----------------------------------------------------------------- intros */

CREATE TABLE IF NOT EXISTS hr_intros (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  requester_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason       TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','accepted','declined')),
  created_at   INTEGER NOT NULL,
  resolved_at  INTEGER
);

CREATE INDEX IF NOT EXISTS idx_bf_intros_target ON hr_intros(target_id, status);

/* --------------------------------------------------------------- messages */

CREATE TABLE IF NOT EXISTS hr_threads (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  subject    TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  last_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS hr_thread_members (
  thread_id    INTEGER NOT NULL REFERENCES hr_threads(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_at INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (thread_id, user_id)
);

CREATE TABLE IF NOT EXISTS hr_messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id  INTEGER NOT NULL REFERENCES hr_threads(id) ON DELETE CASCADE,
  sender_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bf_messages_thread ON hr_messages(thread_id, created_at);

/* ---------------------------------------------------------- notifications */

CREATE TABLE IF NOT EXISTS hr_notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,
  actor_id   TEXT REFERENCES users(id) ON DELETE SET NULL,
  text       TEXT NOT NULL DEFAULT '',
  href       TEXT NOT NULL DEFAULT '/homeroom',
  read_at    INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bf_notifications_user ON hr_notifications(user_id, created_at DESC);

/* --------------------------------------------------------------- yearbook */

/* The founder wall: the parts of a profile that belong to a cohort rather than
   to a directory row. Kept off hr_members so a yearbook entry can stand for a
   past cohort without implying the profile is still current. */
CREATE TABLE IF NOT EXISTS hr_yearbook (
  user_id     TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  cohort      TEXT NOT NULL DEFAULT '',
  house       TEXT NOT NULL DEFAULT '',
  venture     TEXT NOT NULL DEFAULT '',
  one_liner   TEXT NOT NULL DEFAULT '',
  quote       TEXT NOT NULL DEFAULT '',
  building    TEXT NOT NULL DEFAULT '',
  before_haus TEXT NOT NULL DEFAULT '',
  photo_url   TEXT NOT NULL DEFAULT '',
  site_url    TEXT NOT NULL DEFAULT '',
  featured    INTEGER NOT NULL DEFAULT 0,
  updated_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hr_yearbook_cohort ON hr_yearbook(cohort);

/* A signature in someone's yearbook. Short, visible to members, and not a DM —
   the point is that the rest of the cohort can read it. */
CREATE TABLE IF NOT EXISTS hr_signatures (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (user_id, author_id)
);

/* ------------------------------------------------------------------ atlas */

CREATE TABLE IF NOT EXISTS hr_atlas (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  slug         TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  city         TEXT NOT NULL DEFAULT '',
  country      TEXT NOT NULL DEFAULT '',
  region       TEXT NOT NULL DEFAULT '',
  kind         TEXT NOT NULL DEFAULT 'community',
  status       TEXT NOT NULL DEFAULT 'unknown'
               CHECK (status IN ('active','limited','dormant','unknown')),
  bsl          TEXT NOT NULL DEFAULT '',
  website      TEXT,
  capabilities TEXT NOT NULL DEFAULT '',
  note         TEXT NOT NULL DEFAULT '',
  source       TEXT NOT NULL DEFAULT '',
  confirmed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  confirmed_at INTEGER,
  created_at   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hr_atlas_region ON hr_atlas(region, status);

/* "I was there in March and it is open." Worth more than any directory. */
CREATE TABLE IF NOT EXISTS hr_atlas_reports (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  lab_id     INTEGER NOT NULL REFERENCES hr_atlas(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status     TEXT NOT NULL,
  body       TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hr_atlas_reports ON hr_atlas_reports(lab_id, created_at DESC);

/* ---------------------------------------------------------------- mentors */

CREATE TABLE IF NOT EXISTS hr_mentors (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT NOT NULL UNIQUE,
  user_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT '',
  org         TEXT NOT NULL DEFAULT '',
  track       TEXT NOT NULL DEFAULT 'founder',
  tags        TEXT NOT NULL DEFAULT '',
  location    TEXT NOT NULL DEFAULT '',
  bio         TEXT NOT NULL DEFAULT '',
  format      TEXT NOT NULL DEFAULT 'one-on-one',
  scheduler   TEXT NOT NULL DEFAULT '',
  vetted      INTEGER NOT NULL DEFAULT 0,
  active      INTEGER NOT NULL DEFAULT 1,
  sessions    INTEGER NOT NULL DEFAULT 0,
  source      TEXT NOT NULL DEFAULT 'seed',
  created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hr_mentors_track ON hr_mentors(track, vetted DESC);

/* ------------------------------------------------------------ mentor desk */

/*
 * Gating the booking link behind a per-request accept.
 *
 * The roster above says who is willing to mentor. These tables say whether a
 * particular member may have a particular mentor's calendar, which until now
 * was "everyone, always" — scheduler went out with every mentor row, to the
 * page and to /homeroom/api/mentors alike.
 *
 * The scarce thing here is not the mentor's privacy; they filled in a form
 * saying they want to help, and a member who picked them off a list obviously
 * knows who they asked. The scarce thing is their calendar. So the mechanism
 * is capacity — checked before a request can be written, so a mentor at their
 * limit never has to decline — rather than the invisibility the intro engine
 * needs. See docs/MENTOR-ENGINE.md §3.
 */

CREATE TABLE IF NOT EXISTS hr_mentor_requests (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  mentor_id     INTEGER NOT NULL REFERENCES hr_mentors(id) ON DELETE CASCADE,
  member_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  track         TEXT NOT NULL DEFAULT '',
  need          TEXT NOT NULL,
  why_them      TEXT NOT NULL DEFAULT '',
  tried         TEXT NOT NULL DEFAULT '',
  asking_for    TEXT NOT NULL DEFAULT '',
  state         TEXT NOT NULL DEFAULT 'sent'
                CHECK (state IN ('sent','accepted','declined','expired','withdrawn')),
  auto          INTEGER NOT NULL DEFAULT 0,  -- accepted without asking, per consent_mode
  decline_note  TEXT NOT NULL DEFAULT '',    -- the mentor's own words, passed through
  paused_mentor INTEGER NOT NULL DEFAULT 0,  -- the "not right now" button was used
  token_hash    TEXT NOT NULL DEFAULT '',    -- sha256; the token itself is never stored
  token_expires INTEGER,
  created_at    INTEGER NOT NULL,
  answered_at   INTEGER
);

CREATE INDEX IF NOT EXISTS idx_hr_mreq_mentor ON hr_mentor_requests(mentor_id, state, created_at);
CREATE INDEX IF NOT EXISTS idx_hr_mreq_member ON hr_mentor_requests(member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hr_mreq_token ON hr_mentor_requests(token_hash);

/*
 * The exposed booking link: one member, one mentor, one window.
 *
 * The member never receives the scheduler URL. They receive a link to
 * /homeroom/mentor/:slug/book/:grant, which checks this row and redirects. A
 * rendered href is scrapeable by every member forever; a grant expires, is
 * attributable, and can be revoked for anyone who has not yet clicked. It is
 * not DRM — whoever clicks once can read the destination — and the mentor is
 * told exactly that rather than left to assume otherwise.
 */
CREATE TABLE IF NOT EXISTS hr_mentor_grants (
  id          TEXT PRIMARY KEY,
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
CREATE INDEX IF NOT EXISTS idx_hr_grants_request ON hr_mentor_grants(request_id);

/* Did it happen, and was it any good. The only measure that matters. */
CREATE TABLE IF NOT EXISTS hr_mentor_outcomes (
  request_id INTEGER PRIMARY KEY REFERENCES hr_mentor_requests(id) ON DELETE CASCADE,
  met        INTEGER NOT NULL DEFAULT 0,
  useful     INTEGER,
  note       TEXT NOT NULL DEFAULT '',
  logged_at  INTEGER NOT NULL
);

/* Append-only. Answers "why did this member get this calendar link". */
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

CREATE INDEX IF NOT EXISTS idx_hr_mentor_events ON hr_mentor_events(request_id, created_at);

/*
 * Mentor-scoped links, for the actions that are not about one request.
 *
 * Re-confirming, pausing and withdrawing all have to work for someone with no
 * Homeroom account, from an email, on a phone. hr_mentor_requests already
 * carries a token for answering one request; this is the same idea for the
 * standing consent itself.
 *
 * Hashed at rest like every other token here. used_at rather than deletion,
 * so a mentor who clicks twice sees what they already did instead of an error
 * page telling them their link is broken.
 */
CREATE TABLE IF NOT EXISTS hr_mentor_tokens (
  token_hash TEXT PRIMARY KEY,
  mentor_id  INTEGER NOT NULL REFERENCES hr_mentors(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL DEFAULT 'standing'
             CHECK (kind IN ('standing','reconfirm')),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at    INTEGER
);

CREATE INDEX IF NOT EXISTS idx_hr_mentor_tokens ON hr_mentor_tokens(mentor_id, kind, created_at);

/* ------------------------------------------------------- funder reviews++ */

/* Rate My Funder: a review gets replies, because one bad experience is an
   anecdote and three replies saying the same thing is a pattern. */
CREATE TABLE IF NOT EXISTS hr_review_comments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  review_id  INTEGER NOT NULL REFERENCES hr_funder_reviews(id) ON DELETE CASCADE,
  author_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  anonymous  INTEGER NOT NULL DEFAULT 0,
  deleted    INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hr_review_comments ON hr_review_comments(review_id, created_at);

/* "This matches my experience" — the helpful vote, and the thing that sorts
   the review list. */
CREATE TABLE IF NOT EXISTS hr_review_votes (
  review_id  INTEGER NOT NULL REFERENCES hr_funder_reviews(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  helpful    INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (review_id, user_id)
);

/* ----------------------------------------------------------- the library+ */

CREATE TABLE IF NOT EXISTS hr_tracks (
  slug     TEXT PRIMARY KEY,
  title    TEXT NOT NULL,
  focus    TEXT NOT NULL DEFAULT '',
  blurb    TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS hr_modules (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT NOT NULL UNIQUE,
  track       TEXT NOT NULL REFERENCES hr_tracks(slug) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'playbook',
  summary     TEXT NOT NULL DEFAULT '',
  outcomes    TEXT NOT NULL DEFAULT '',
  work        TEXT NOT NULL DEFAULT '',
  deliverable TEXT NOT NULL DEFAULT '',
  minutes     INTEGER NOT NULL DEFAULT 45,
  week        INTEGER NOT NULL DEFAULT 0,
  position    INTEGER NOT NULL DEFAULT 0,
  reads       INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_hr_modules_track ON hr_modules(track, position);

/* Progress is per member and per module, and "done" means the deliverable
   exists — which is why there is a note and a link, not just a checkbox. */
CREATE TABLE IF NOT EXISTS hr_progress (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module_id  INTEGER NOT NULL REFERENCES hr_modules(id) ON DELETE CASCADE,
  state      TEXT NOT NULL DEFAULT 'started'
             CHECK (state IN ('started','done')),
  note       TEXT NOT NULL DEFAULT '',
  link       TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, module_id)
);

/* ------------------------------------------------------------ events sync */

/* Set on any event that came from a Luma calendar, so a re-sync updates the
   row it already created rather than adding a second copy of the same event. */
CREATE TABLE IF NOT EXISTS hr_event_sources (
  event_id    INTEGER PRIMARY KEY REFERENCES hr_events(id) ON DELETE CASCADE,
  source      TEXT NOT NULL DEFAULT 'luma',
  external_id TEXT NOT NULL,
  url         TEXT NOT NULL DEFAULT '',
  synced_at   INTEGER NOT NULL,
  UNIQUE (source, external_id)
);

/* ------------------------------------------------------- news via Supabase */

/* The local receipt for something a member sent to the public feed at
   haus.fund/news. The canonical row lives in Supabase; this one exists so a
   member can see the state of their own submission even when Supabase is
   unreachable, which on an ephemeral container it sometimes is. */
CREATE TABLE IF NOT EXISTS hr_news_submissions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  remote_id    TEXT,
  title        TEXT NOT NULL,
  url          TEXT NOT NULL DEFAULT '',
  body         TEXT NOT NULL DEFAULT '',
  topic        TEXT NOT NULL DEFAULT 'general',
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','queued','published','rejected','failed')),
  error        TEXT NOT NULL DEFAULT '',
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hr_news_user ON hr_news_submissions(user_id, created_at DESC);

/* ----------------------------------------------------------------- roster */

/* Who the Airtable said was in the programme, and when we last asked.
   The address is stored as a SHA-256 and never in the clear: a copy of this
   database should not also be a copy of the resident list. "masked" keeps
   enough for a steward to recognise a row ("el****@haus.fund") without it
   being a list of addresses. */
CREATE TABLE IF NOT EXISTS hr_roster (
  email_hash    TEXT PRIMARY KEY,
  masked        TEXT NOT NULL DEFAULT '',
  verdict       TEXT NOT NULL DEFAULT 'deny'
                CHECK (verdict IN ('allow','deny','review','error')),
  reason        TEXT NOT NULL DEFAULT '',
  name          TEXT NOT NULL DEFAULT '',
  cohort        TEXT NOT NULL DEFAULT '',
  house         TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT '',
  lifecycle     TEXT NOT NULL DEFAULT '',
  resident_type TEXT NOT NULL DEFAULT '',
  user_id       TEXT REFERENCES users(id) ON DELETE SET NULL,
  attempts      INTEGER NOT NULL DEFAULT 1,
  checked_at    INTEGER NOT NULL,
  /* A steward resolving a "review" by hand. Their decision outranks the rule
     until the Airtable itself changes. */
  decided_by    TEXT REFERENCES users(id) ON DELETE SET NULL,
  decided_at    INTEGER,
  decision      TEXT CHECK (decision IN ('allow','deny')),
  note          TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_hr_roster_verdict ON hr_roster(verdict, checked_at DESC);

/* ---------------------------------------------------------------- invites */

/* The local fallback for onboarding invites. The real store is Supabase, because
   this file lives on the container's /tmp and an invite minted on one container
   is invisible to the next — see app/invites.js. This table is what development
   uses, and what production degrades to if Supabase is not configured, with the
   steward page saying so rather than pretending the links will last.

   The token is never stored, only its SHA-256, so the rows here are as useless
   to a reader as the ones in Supabase. */
CREATE TABLE IF NOT EXISTS hr_invites (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash     TEXT NOT NULL UNIQUE,
  email          TEXT NOT NULL,
  invited_by     TEXT NOT NULL,
  note           TEXT NOT NULL DEFAULT '',
  roster_verdict TEXT NOT NULL DEFAULT '',
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','redeemed','revoked')),
  redeemed_by    TEXT,
  redeemed_at    INTEGER,
  expires_at     INTEGER NOT NULL,
  created_at     INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hr_invites_status ON hr_invites(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hr_invites_email  ON hr_invites(email);

/* ------------------------------------------------------- the intro engine */

/*
 * Introductions to people OUTSIDE the house, sourced through Happenstance.
 * See docs/INTRO-ENGINE.md for the design and app/introengine.js for the
 * rules. Two facts shape these tables:
 *
 *   1. Everyone in hr_hs_people is someone who never agreed to be here. Rows
 *      are the allowlisted slice of a search result, keyed by a hash, and are
 *      purged with the search that produced them.
 *   2. Happenstance returns no email addresses. A steward supplies one at send
 *      time, and it is stored encrypted for the life of the request only, so a
 *      copy of this database is not a copy of the connector's address book.
 */

/* One Happenstance search, cached. At 2 credits a call, two members asking the
   same question in the same month must not cost 4. */
CREATE TABLE IF NOT EXISTS hr_hs_searches (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  query_hash    TEXT NOT NULL UNIQUE,      -- sha256 of the normalised query + scope
  query         TEXT NOT NULL,
  scope         TEXT NOT NULL DEFAULT '',
  search_id     TEXT NOT NULL DEFAULT '',  -- the Happenstance uuid
  state         TEXT NOT NULL DEFAULT 'running'
                CHECK (state IN ('running','complete','failed')),
  credits       INTEGER NOT NULL DEFAULT 0,
  result_count  INTEGER NOT NULL DEFAULT 0,
  error         TEXT NOT NULL DEFAULT '',
  requested_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at    INTEGER NOT NULL,
  completed_at  INTEGER,
  expires_at    INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hr_hs_searches_by ON hr_hs_searches(requested_by, created_at DESC);

/* The allowlisted result rows. Nothing here that is not in happenstance.js's
   normalise(); no address, ever. */
CREATE TABLE IF NOT EXISTS hr_hs_people (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  search_id     INTEGER NOT NULL REFERENCES hr_hs_searches(id) ON DELETE CASCADE,
  person_hash   TEXT NOT NULL,
  name          TEXT NOT NULL,
  title         TEXT NOT NULL DEFAULT '',
  org           TEXT NOT NULL DEFAULT '',
  summary       TEXT NOT NULL DEFAULT '',
  evidence      TEXT NOT NULL DEFAULT '',  -- JSON array of strings
  score         REAL,
  through       TEXT NOT NULL DEFAULT '',  -- the mutuals, comma-separated names
  profile_url   TEXT NOT NULL DEFAULT '',
  position      INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hr_hs_people_search ON hr_hs_people(search_id, position);
CREATE INDEX IF NOT EXISTS idx_hr_hs_people_hash ON hr_hs_people(person_hash);

/* One member asking to be introduced to one person. The lifecycle lives here:
   requested → permission_sent → agreed → introduced, or off to the side into
   declined / no_reply / refused / withdrawn. Only introengine.js writes the
   status column. */
CREATE TABLE IF NOT EXISTS hr_intro_requests (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  person_hash   TEXT NOT NULL,
  search_id     INTEGER REFERENCES hr_hs_searches(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,             -- copied from the result, which is purged
  title         TEXT NOT NULL DEFAULT '',
  org           TEXT NOT NULL DEFAULT '',
  summary       TEXT NOT NULL DEFAULT '',
  evidence      TEXT NOT NULL DEFAULT '',
  through       TEXT NOT NULL DEFAULT '',
  profile_url   TEXT NOT NULL DEFAULT '',
  need          TEXT NOT NULL,             -- the ask, in the member's words
  why_them      TEXT NOT NULL DEFAULT '',
  asking_for    TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'requested'
                CHECK (status IN ('requested','permission_sent','agreed','introduced',
                                  'declined','no_reply','refused','withdrawn')),
  token_hash    TEXT NOT NULL DEFAULT '',  -- sha256; the token itself is never stored
  token_expires INTEGER,
  to_enc        TEXT NOT NULL DEFAULT '',  -- the target's address, encrypted; cleared when closed
  to_hash       TEXT NOT NULL DEFAULT '',  -- sha256 of the address, kept for the record
  sent_how      TEXT NOT NULL DEFAULT ''
                CHECK (sent_how IN ('','mail','manual')),
  sent_by       TEXT REFERENCES users(id) ON DELETE SET NULL,
  sent_at       INTEGER,
  answered_at   INTEGER,
  answer_note   TEXT NOT NULL DEFAULT '',  -- the target's own words, stewards only
  steward_note  TEXT NOT NULL DEFAULT '',  -- why a steward refused, member never sees it
  introduced_at INTEGER,
  closed_at     INTEGER,
  /* The member pressed withdraw. Separate from the status column because a
     member may press it on a request that has already quietly closed, and the
     page must look the same either way — see memberView() in introengine.js. */
  member_closed INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hr_intro_req_member ON hr_intro_requests(member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hr_intro_req_status ON hr_intro_requests(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_hr_intro_req_person ON hr_intro_requests(person_hash, status);
CREATE INDEX IF NOT EXISTS idx_hr_intro_req_token ON hr_intro_requests(token_hash);

/* "Never ask me again". Checked before a result is ever shown, not after. */
CREATE TABLE IF NOT EXISTS hr_intro_suppression (
  person_hash   TEXT PRIMARY KEY,
  reason        TEXT NOT NULL DEFAULT ''
                CHECK (reason IN ('','opted-out','bounced','steward','complaint')),
  created_at    INTEGER NOT NULL
);

/* A no, or a silence, buys a person a rest: from this member for a long while,
   from everyone for a shorter one. member_id '' is the house-wide row. */
CREATE TABLE IF NOT EXISTS hr_intro_cooldowns (
  person_hash   TEXT NOT NULL,
  member_id     TEXT NOT NULL DEFAULT '',
  until         INTEGER NOT NULL,
  created_at    INTEGER NOT NULL,
  PRIMARY KEY (person_hash, member_id)
);

CREATE TABLE IF NOT EXISTS hr_intro_outcomes (
  request_id    INTEGER PRIMARY KEY REFERENCES hr_intro_requests(id) ON DELETE CASCADE,
  met           INTEGER NOT NULL DEFAULT 0,
  useful        INTEGER,
  note          TEXT NOT NULL DEFAULT '',
  logged_at     INTEGER NOT NULL
);

/* Append-only. Answers "why did this person get an email". */
CREATE TABLE IF NOT EXISTS hr_intro_events (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id    INTEGER,
  search_id     INTEGER,
  actor_id      TEXT REFERENCES users(id) ON DELETE SET NULL,
  actor_kind    TEXT NOT NULL DEFAULT 'member'
                CHECK (actor_kind IN ('member','steward','target','system','agent')),
  event         TEXT NOT NULL,
  detail        TEXT NOT NULL DEFAULT '',
  created_at    INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hr_intro_events ON hr_intro_events(request_id, created_at);

/* The connector's LinkedIn connections export — a second place a member can
   find someone, next to Happenstance. See docs/INTRO-ENGINE.md §20.8.

   Every row is somebody who never agreed to be here, exactly like
   hr_hs_people. There is no LinkedIn ID in the export, so person_hash is a
   hash of the normalised name and company: stable across re-imports, and the
   same key the suppression list and cooldowns use. The few addresses the
   export carries are encrypted under the same key as a request's address. */
CREATE TABLE IF NOT EXISTS hr_li_connections (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  person_hash   TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  company       TEXT NOT NULL DEFAULT '',
  position      TEXT NOT NULL DEFAULT '',
  tracks        TEXT NOT NULL DEFAULT '',  -- comma-separated, from keyword rules
  haystack      TEXT NOT NULL DEFAULT '',  -- lowercased name, company, position, tracks
  connected_on  TEXT NOT NULL DEFAULT '',  -- YYYY-MM-DD
  email_enc     TEXT NOT NULL DEFAULT '',  -- encrypted; stewards only, never rendered to a member
  batch         INTEGER NOT NULL,          -- the import that last saw this person
  imported_at   INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hr_li_connections_batch ON hr_li_connections(batch);

/* ================================================== the program layer
 *
 * Everything above is the community: who is here and what they share. This is
 * the program that runs around it, the part YC calls a batch: a cohort as a
 * record rather than a text field, small groups with a lead, one number per
 * company every week, goals, group sessions, Demo Day, and what happens after.
 *
 * Groundwork only: tables, no surfaces yet. Each block names the screen that
 * will read it. Fund OS in Airtable stays the source of truth for people and
 * cohorts; 'airtable_id' columns are for the sync, never shown to anyone.
 *
 * Text cohort fields ('hr_members.cohort', 'hr_orgs.cohort') stay as they are.
 * They are what the yearbook and the roster already read, and a migration that
 * rewrote them would break both. New code reads batches; old code keeps working.
 */

/* ---------------------------------------------------------------- batches */

-- One residency cohort: Spring 2027 at PunkHaus is a batch. Screen: batch home.
CREATE TABLE IF NOT EXISTS hr_batches (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  program     TEXT NOT NULL DEFAULT '',
  house       TEXT NOT NULL DEFAULT '',
  starts_at   INTEGER NOT NULL,
  ends_at     INTEGER NOT NULL,
  status      TEXT NOT NULL DEFAULT 'planned'
              CHECK (status IN ('planned','active','alumni')),
  airtable_id TEXT NOT NULL DEFAULT '',
  created_at  INTEGER NOT NULL
);

-- The small group a company meets with every two weeks, and who leads it.
-- YC splits a batch by partner, then by vertical; a Haus group is a house or a
-- track. 'lead_id' is a member account: a house lead, a GP, a lead mentor.
CREATE TABLE IF NOT EXISTS hr_groups (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id   INTEGER NOT NULL REFERENCES hr_batches(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  focus      TEXT NOT NULL DEFAULT '',
  lead_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hr_groups_batch ON hr_groups(batch_id);

-- Which companies are in which batch, and in which group.
CREATE TABLE IF NOT EXISTS hr_batch_companies (
  batch_id  INTEGER NOT NULL REFERENCES hr_batches(id) ON DELETE CASCADE,
  org_id    INTEGER NOT NULL REFERENCES hr_orgs(id) ON DELETE CASCADE,
  group_id  INTEGER REFERENCES hr_groups(id) ON DELETE SET NULL,
  status    TEXT NOT NULL DEFAULT 'active'
            CHECK (status IN ('active','withdrawn','graduated')),
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (batch_id, org_id)
);

-- Which people are in which batch. 'alumni' is a status, never a deletion:
-- access does not expire when the batch ends, which is the YC rule.
CREATE TABLE IF NOT EXISTS hr_batch_members (
  batch_id    INTEGER NOT NULL REFERENCES hr_batches(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id      INTEGER REFERENCES hr_orgs(id) ON DELETE SET NULL,
  role        TEXT NOT NULL DEFAULT 'resident'
              CHECK (role IN ('resident','lead','staff')),
  status      TEXT NOT NULL DEFAULT 'active'
              CHECK (status IN ('active','withdrawn','alumni')),
  airtable_id TEXT NOT NULL DEFAULT '',
  joined_at   INTEGER NOT NULL,
  PRIMARY KEY (batch_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_hr_batch_members_user ON hr_batch_members(user_id);

/* ------------------------------------------------- the weekly number */

-- What a company counts. One is primary: the number the weekly check-in asks
-- for and the group session looks at. Screen: company settings.
CREATE TABLE IF NOT EXISTS hr_kpis (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id      INTEGER NOT NULL REFERENCES hr_orgs(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  unit        TEXT NOT NULL DEFAULT '',
  is_primary  INTEGER NOT NULL DEFAULT 0,
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hr_kpis_org ON hr_kpis(org_id, active);

-- The weekly check-in, one per company per week. Structured on purpose:
-- 'hr_updates' stays the free-text story, this is the row a chart can draw.
-- 'week' is the Monday it covers, 'YYYY-MM-DD'. Screen: weekly check-in.
CREATE TABLE IF NOT EXISTS hr_checkins (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id       INTEGER NOT NULL REFERENCES hr_orgs(id) ON DELETE CASCADE,
  batch_id     INTEGER REFERENCES hr_batches(id) ON DELETE SET NULL,
  author_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week         TEXT NOT NULL CHECK (length(week) = 10),
  kpi_id       INTEGER REFERENCES hr_kpis(id) ON DELETE SET NULL,
  kpi_value    REAL,
  morale       INTEGER CHECK (morale IS NULL OR (morale BETWEEN 1 AND 10)),
  users_talked INTEGER CHECK (users_talked IS NULL OR users_talked >= 0),
  shipped      TEXT NOT NULL DEFAULT '',
  blocker      TEXT NOT NULL DEFAULT '',
  ask          TEXT NOT NULL DEFAULT '',
  created_at   INTEGER NOT NULL,
  UNIQUE (org_id, week)
);

CREATE INDEX IF NOT EXISTS idx_hr_checkins_batch ON hr_checkins(batch_id, week);

/* ------------------------------------------------------ group sessions */

-- Group office hours: one group, every two weeks, notes kept by the lead.
-- Screen: group page. Declared before hr_goals, which points at it: Postgres
-- checks a reference when the table is created, SQLite only when a row is.
CREATE TABLE IF NOT EXISTS hr_sessions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id   INTEGER NOT NULL REFERENCES hr_groups(id) ON DELETE CASCADE,
  starts_at  INTEGER NOT NULL,
  minutes    INTEGER NOT NULL DEFAULT 60,
  place      TEXT NOT NULL DEFAULT '',
  notes      TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hr_sessions_group ON hr_sessions(group_id, starts_at DESC);

CREATE TABLE IF NOT EXISTS hr_session_attendance (
  session_id INTEGER NOT NULL REFERENCES hr_sessions(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attended   INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (session_id, user_id)
);

-- Goals set in a group session and checked at the next one.
CREATE TABLE IF NOT EXISTS hr_goals (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id     INTEGER NOT NULL REFERENCES hr_orgs(id) ON DELETE CASCADE,
  batch_id   INTEGER REFERENCES hr_batches(id) ON DELETE SET NULL,
  session_id INTEGER REFERENCES hr_sessions(id) ON DELETE SET NULL,
  title      TEXT NOT NULL,
  kpi_id     INTEGER REFERENCES hr_kpis(id) ON DELETE SET NULL,
  target     REAL,
  due_at     INTEGER,
  state      TEXT NOT NULL DEFAULT 'open'
             CHECK (state IN ('open','met','missed','dropped')),
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  closed_at  INTEGER
);

CREATE INDEX IF NOT EXISTS idx_hr_goals_org ON hr_goals(org_id, state);

-- Three to five mentors who stay with a company for the batch (Techstars'
-- lead mentors). Assigned by a steward; the mentor desk still gates booking.
CREATE TABLE IF NOT EXISTS hr_lead_mentors (
  org_id      INTEGER NOT NULL REFERENCES hr_orgs(id) ON DELETE CASCADE,
  mentor_id   INTEGER NOT NULL REFERENCES hr_mentors(id) ON DELETE CASCADE,
  batch_id    INTEGER NOT NULL REFERENCES hr_batches(id) ON DELETE CASCADE,
  assigned_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_at INTEGER NOT NULL,
  ended_at    INTEGER,
  PRIMARY KEY (org_id, mentor_id, batch_id)
);

/* ------------------------------------------------------------ Demo Day */

-- The investor day at the end of a batch. Investors see profiles only while
-- access is open. Screen: Demo Day site.
CREATE TABLE IF NOT EXISTS hr_demo_days (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id         INTEGER NOT NULL REFERENCES hr_batches(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  starts_at        INTEGER NOT NULL,
  place            TEXT NOT NULL DEFAULT '',
  access_opens_at  INTEGER,
  access_closes_at INTEGER,
  status           TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','open','closed')),
  created_at       INTEGER NOT NULL
);

-- A company's page on the Demo Day site. Every word is the founder's own,
-- 'raising' included: Haus publishes nothing about its own checks here.
-- Nothing shows until the founder publishes it.
CREATE TABLE IF NOT EXISTS hr_demo_profiles (
  demo_day_id     INTEGER NOT NULL REFERENCES hr_demo_days(id) ON DELETE CASCADE,
  org_id          INTEGER NOT NULL REFERENCES hr_orgs(id) ON DELETE CASCADE,
  one_liner       TEXT NOT NULL DEFAULT '',
  raising         TEXT NOT NULL DEFAULT '',
  deck_url        TEXT NOT NULL DEFAULT '',
  video_url       TEXT NOT NULL DEFAULT '',
  contact_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  published       INTEGER NOT NULL DEFAULT 0,
  updated_at      INTEGER NOT NULL,
  PRIMARY KEY (demo_day_id, org_id)
);

/* ----------------------------------------------------------- investors */

-- An investor who asked for access, and a steward's ruling on it. YC ties an
-- invite to a named person; so does this. 'user_id' is set once they have an
-- account. An investor account is NOT a member: access rules must keep them
-- out of every member surface before a single one is approved.
CREATE TABLE IF NOT EXISTS hr_investors (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  firm        TEXT NOT NULL DEFAULT '',
  email       TEXT NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'fund'
              CHECK (kind IN ('angel','fund','corporate','other')),
  focus       TEXT NOT NULL DEFAULT '',
  stages      TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'applied'
              CHECK (status IN ('applied','approved','declined','revoked')),
  vetted_by   TEXT REFERENCES users(id) ON DELETE SET NULL,
  vetted_at   INTEGER,
  note        TEXT NOT NULL DEFAULT '',
  airtable_id TEXT NOT NULL DEFAULT '',
  created_at  INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_hr_investors_email ON hr_investors(lower(email));

-- Which approved investors may see which Demo Day.
CREATE TABLE IF NOT EXISTS hr_demo_access (
  demo_day_id INTEGER NOT NULL REFERENCES hr_demo_days(id) ON DELETE CASCADE,
  investor_id INTEGER NOT NULL REFERENCES hr_investors(id) ON DELETE CASCADE,
  granted_by  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  granted_at  INTEGER NOT NULL,
  revoked     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (demo_day_id, investor_id)
);

-- An investor saying "I want to follow" or "I want a meeting". The founder
-- sees it and answers; nothing is sent to the investor until they say yes,
-- the same double opt-in the intro desk uses.
CREATE TABLE IF NOT EXISTS hr_investor_interest (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  demo_day_id  INTEGER NOT NULL REFERENCES hr_demo_days(id) ON DELETE CASCADE,
  investor_id  INTEGER NOT NULL REFERENCES hr_investors(id) ON DELETE CASCADE,
  org_id       INTEGER NOT NULL REFERENCES hr_orgs(id) ON DELETE CASCADE,
  level        TEXT NOT NULL DEFAULT 'following'
               CHECK (level IN ('following','meeting')),
  note         TEXT NOT NULL DEFAULT '',
  founder_reply TEXT NOT NULL DEFAULT 'pending'
               CHECK (founder_reply IN ('pending','accepted','declined')),
  replied_at   INTEGER,
  created_at   INTEGER NOT NULL,
  UNIQUE (demo_day_id, investor_id, org_id)
);

CREATE INDEX IF NOT EXISTS idx_hr_interest_org ON hr_investor_interest(org_id, founder_reply);

/* ---------------------------------------------------------------- alumni */

-- What happened after: a raise, a launch, a hire, a grant. Private to the
-- house unless the founder ticks 'public'. 'amount' is the founder's own
-- words, never a figure Haus fills in.
CREATE TABLE IF NOT EXISTS hr_milestones (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id      INTEGER NOT NULL REFERENCES hr_orgs(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL
              CHECK (kind IN ('raised','launched','hired','partnership','grant','exit','other')),
  title       TEXT NOT NULL,
  happened_on TEXT NOT NULL DEFAULT '',
  amount      TEXT NOT NULL DEFAULT '',
  public      INTEGER NOT NULL DEFAULT 0,
  posted_by   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hr_milestones_org ON hr_milestones(org_id, created_at DESC);
`;


export const ACCOUNT_SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  karma         INTEGER NOT NULL DEFAULT 1,
  created_at    INTEGER NOT NULL,
  is_admin      INTEGER NOT NULL DEFAULT 0,
  banned        INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

/* Password resets. The row stores a hash of the token, never the token, so a
   copy of the database does not let anyone take over an account. */
CREATE TABLE IF NOT EXISTS password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at    INTEGER
);

CREATE INDEX IF NOT EXISTS idx_resets_user ON password_resets(user_id);
`;

/*
 * Columns added after the first release. Kept beside the schema they extend
 * so there is one file to read when asking what shape a table actually is.
 */
export const ADDED_COLUMNS = [
  // The program layer: an event can belong to a batch's calendar.
  ['hr_events', 'batch_id', 'INTEGER REFERENCES hr_batches(id) ON DELETE SET NULL'],
  // Rate My Funder: the axes a founder actually compares funders on.
  ['hr_funder_reviews', 'founder_friendly', 'INTEGER'],
  ['hr_funder_reviews', 'terms', 'INTEGER'],
  ['hr_funder_reviews', 'would_again', "INTEGER NOT NULL DEFAULT 0"],
  ['hr_funder_reviews', 'tags', "TEXT NOT NULL DEFAULT ''"],
  ['hr_funder_reviews', 'stage', "TEXT NOT NULL DEFAULT ''"],
  ['hr_funder_reviews', 'outcome', "TEXT NOT NULL DEFAULT ''"],
  ['hr_funder_reviews', 'helpful', "INTEGER NOT NULL DEFAULT 0"],
  // Office hours held by a mentor rather than by a member.
  ['hr_slots', 'mentor_id', 'INTEGER'],
  ['hr_slots', 'url', "TEXT NOT NULL DEFAULT ''"],
  // Which roster verdict let this account in, and when it was last confirmed.
  ['users', 'roster_status', "TEXT NOT NULL DEFAULT ''"],
  ['users', 'roster_checked_at', 'INTEGER NOT NULL DEFAULT 0'],
  // Perks: how you actually redeem the thing.
  ['hr_deals', 'access', "TEXT NOT NULL DEFAULT 'code'"],
  ['hr_deals', 'requirement', "TEXT NOT NULL DEFAULT ''"],
  ['hr_deals', 'checked', "TEXT NOT NULL DEFAULT ''"],
  // Mentor desk: standing consent, availability and how much of it there is.
  // `state` defaults to 'listed' so every existing row keeps behaving as it
  // did — a migration that quietly unlisted the whole roster would be worse
  // than no gate at all.
  ['hr_mentors', 'state', "TEXT NOT NULL DEFAULT 'listed'"],
  ['hr_mentors', 'consent_mode', "TEXT NOT NULL DEFAULT 'ask-me'"],
  ['hr_mentors', 'capacity', 'INTEGER NOT NULL DEFAULT 2'],
  ['hr_mentors', 'tracks', "TEXT NOT NULL DEFAULT ''"],
  ['hr_mentors', 'email', "TEXT NOT NULL DEFAULT ''"],
  ['hr_mentors', 'airtable_id', "TEXT NOT NULL DEFAULT ''"],
  ['hr_mentors', 'confirmed_at', 'INTEGER'],
  ['hr_mentors', 'paused_until', 'INTEGER'],
  // Intro engine: a note an agent leaves for the steward on a waiting request.
  // Stewards only; memberView() and agentView() are allowlists, and only the
  // second carries it.
  ['hr_intro_requests', 'agent_note', "TEXT NOT NULL DEFAULT ''"],
  ['hr_intro_requests', 'staged_at', 'INTEGER'],
  // Where the member found the person: a Happenstance search, or the
  // connector's own LinkedIn network (§20.8). Existing rows were all the former.
  ['hr_intro_requests', 'source', "TEXT NOT NULL DEFAULT 'happenstance'"],
  ['hr_mentors', 'synced_at', 'INTEGER'],
  // Phase 3: keeping the roster honest. `confirmed_at` is when they last said
  // yes to being here at all; the two nudge columns are how a silence becomes
  // dormancy rather than a listing nobody ever checks again.
  ['hr_mentors', 'reconfirm_sent_at', 'INTEGER'],
  ['hr_mentors', 'reconfirm_nudges', 'INTEGER NOT NULL DEFAULT 0'],
  // Which Supabase credential this account signs in with, when HOMEROOM_AUTH
  // is supabase. Empty for a local account, so the two can coexist.
  ['users', 'supabase_id', "TEXT NOT NULL DEFAULT ''"],
];