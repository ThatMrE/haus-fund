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

/* ------------------------------------------------------------------ forum */

CREATE TABLE IF NOT EXISTS hr_posts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  author_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL DEFAULT 'question'
                CHECK (kind IN ('question','discussion','intro','show','announce','poll','launch')),
  category      TEXT NOT NULL DEFAULT 'general',
  title         TEXT NOT NULL,
  body          TEXT NOT NULL DEFAULT '',
  org_id        INTEGER REFERENCES hr_orgs(id) ON DELETE SET NULL,
  anonymous     INTEGER NOT NULL DEFAULT 0,
  points        INTEGER NOT NULL DEFAULT 1,
  comment_count INTEGER NOT NULL DEFAULT 0,
  view_count    INTEGER NOT NULL DEFAULT 0,
  answer_id     INTEGER,
  pinned        INTEGER NOT NULL DEFAULT 0,
  locked        INTEGER NOT NULL DEFAULT 0,
  deleted       INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL,
  edited_at     INTEGER,
  last_active_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bf_posts_created  ON hr_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bf_posts_category ON hr_posts(category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bf_posts_author   ON hr_posts(author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bf_posts_active   ON hr_posts(last_active_at DESC);

CREATE TABLE IF NOT EXISTS hr_post_tags (
  post_id INTEGER NOT NULL REFERENCES hr_posts(id) ON DELETE CASCADE,
  tag     TEXT NOT NULL,
  PRIMARY KEY (post_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_bf_post_tags_tag ON hr_post_tags(tag);

CREATE TABLE IF NOT EXISTS hr_comments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id    INTEGER NOT NULL REFERENCES hr_posts(id) ON DELETE CASCADE,
  parent_id  INTEGER REFERENCES hr_comments(id) ON DELETE CASCADE,
  author_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  depth      INTEGER NOT NULL DEFAULT 0,
  points     INTEGER NOT NULL DEFAULT 1,
  anonymous  INTEGER NOT NULL DEFAULT 0,
  deleted    INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  edited_at  INTEGER
);

CREATE INDEX IF NOT EXISTS idx_bf_comments_post   ON hr_comments(post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_bf_comments_author ON hr_comments(author_id, created_at DESC);

/* One vote table for both, discriminated by target kind. */
CREATE TABLE IF NOT EXISTS hr_votes (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_kind TEXT NOT NULL CHECK (target_kind IN ('post','comment')),
  target_id   INTEGER NOT NULL,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (user_id, target_kind, target_id)
);

CREATE TABLE IF NOT EXISTS hr_saves (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_kind TEXT NOT NULL,
  target_id   TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (user_id, target_kind, target_id)
);

/* Follow a thread, a tag, a member or a lab; drives the notification fan-out. */
CREATE TABLE IF NOT EXISTS hr_follows (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_kind TEXT NOT NULL,
  target_id   TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (user_id, target_kind, target_id)
);

CREATE INDEX IF NOT EXISTS idx_bf_follows_target ON hr_follows(target_kind, target_id);

CREATE TABLE IF NOT EXISTS hr_poll_options (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL REFERENCES hr_posts(id) ON DELETE CASCADE,
  label   TEXT NOT NULL,
  votes   INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS hr_poll_votes (
  post_id   INTEGER NOT NULL REFERENCES hr_posts(id) ON DELETE CASCADE,
  user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  option_id INTEGER NOT NULL REFERENCES hr_poll_options(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (post_id, user_id)
);

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

/* ------------------------------------------------------------------- chat */

/* The forum is for things worth finding again. Chat is for the rest, which is
   most of what a room actually says to itself. Separate tables, separate
   ranking, separate expectations: nothing here is scored, and nothing here is
   the place to put the answer you want someone to find in a year. */
CREATE TABLE IF NOT EXISTS hr_channels (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  topic       TEXT NOT NULL DEFAULT '',
  kind        TEXT NOT NULL DEFAULT 'open'
              CHECK (kind IN ('open','cohort','house','project')),
  scope       TEXT NOT NULL DEFAULT '',
  position    INTEGER NOT NULL DEFAULT 0,
  archived    INTEGER NOT NULL DEFAULT 0,
  created_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at  INTEGER NOT NULL,
  last_at     INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_hr_channels_last ON hr_channels(archived, last_at DESC);

CREATE TABLE IF NOT EXISTS hr_chat (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id INTEGER NOT NULL REFERENCES hr_channels(id) ON DELETE CASCADE,
  author_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  reply_to   INTEGER REFERENCES hr_chat(id) ON DELETE SET NULL,
  deleted    INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  edited_at  INTEGER
);

CREATE INDEX IF NOT EXISTS idx_hr_chat_channel ON hr_chat(channel_id, id);

/* One row per member per channel. "last_read_id" rather than a timestamp: ids
   are monotonic here and a clock is not, so the unread count cannot drift. */
CREATE TABLE IF NOT EXISTS hr_channel_reads (
  channel_id   INTEGER NOT NULL REFERENCES hr_channels(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_id INTEGER NOT NULL DEFAULT 0,
  muted        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (channel_id, user_id)
);

CREATE TABLE IF NOT EXISTS hr_chat_reactions (
  message_id INTEGER NOT NULL REFERENCES hr_chat(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji      TEXT NOT NULL,
  PRIMARY KEY (message_id, user_id, emoji)
);

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
`;
