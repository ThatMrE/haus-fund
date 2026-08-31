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
`;
