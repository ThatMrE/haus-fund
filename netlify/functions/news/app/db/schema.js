/**
 * The schema, as SQL that both drivers accept.
 *
 * SQLite and libSQL share a dialect, so one definition serves local
 * development, the tests, and the hosted database.
 */

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  email         TEXT,
  about         TEXT NOT NULL DEFAULT '',
  karma         INTEGER NOT NULL DEFAULT 1,
  created_at    INTEGER NOT NULL,
  is_admin      INTEGER NOT NULL DEFAULT 0,
  banned        INTEGER NOT NULL DEFAULT 0,
  role          TEXT NOT NULL DEFAULT 'member',
  trusted       INTEGER NOT NULL DEFAULT 0,
  points        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS items (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  type          TEXT NOT NULL CHECK (type IN ('story', 'comment')),
  by            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    INTEGER NOT NULL,
  title         TEXT,
  url           TEXT,
  domain        TEXT,
  text          TEXT,
  topic         TEXT,
  kind          TEXT NOT NULL DEFAULT 'link' CHECK (kind IN ('link', 'ask', 'show', 'comment')),
  source        TEXT NOT NULL DEFAULT 'human' CHECK (source IN ('human', 'agent')),
  agent         TEXT,
  surfaced_by   TEXT REFERENCES users(id) ON DELETE SET NULL,
  channel       TEXT,
  review_state  TEXT NOT NULL DEFAULT 'approved'
                  CHECK (review_state IN ('pending', 'approved', 'rejected')),
  reviewed_by   TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at   INTEGER,
  review_note   TEXT,
  parent_id     INTEGER REFERENCES items(id) ON DELETE CASCADE,
  story_id      INTEGER REFERENCES items(id) ON DELETE CASCADE,
  depth         INTEGER NOT NULL DEFAULT 0,
  points        INTEGER NOT NULL DEFAULT 1,
  comment_count INTEGER NOT NULL DEFAULT 0,
  flag_count    INTEGER NOT NULL DEFAULT 0,
  dead          INTEGER NOT NULL DEFAULT 0,
  deleted       INTEGER NOT NULL DEFAULT 0,
  edited_at     INTEGER
);

CREATE INDEX IF NOT EXISTS idx_items_type_created ON items(type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_story        ON items(story_id, created_at);
CREATE INDEX IF NOT EXISTS idx_items_parent       ON items(parent_id);
CREATE INDEX IF NOT EXISTS idx_items_by           ON items(by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_domain       ON items(domain);
CREATE INDEX IF NOT EXISTS idx_items_topic        ON items(topic, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_source       ON items(source, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_review       ON items(review_state, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_surfaced     ON items(surfaced_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_agent        ON items(agent, created_at DESC);

CREATE TABLE IF NOT EXISTS votes (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id    INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_votes_user ON votes(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_votes_item ON votes(item_id, created_at DESC);

CREATE TABLE IF NOT EXISTS flags (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id    INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, item_id)
);

CREATE TABLE IF NOT EXISTS favorites (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id    INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, item_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- Every point a scout holds is a row here; the balance on users is a cache of
-- the sum, so a disputed balance can always be recomputed from the ledger.
CREATE TABLE IF NOT EXISTS points_ledger (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delta      INTEGER NOT NULL,
  reason     TEXT NOT NULL,
  item_id    INTEGER REFERENCES items(id) ON DELETE SET NULL,
  note       TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_points_user ON points_ledger(user_id, created_at DESC);
-- One award per (user, reason, item): the guard that keeps a re-run of the
-- awarding pass from paying twice for the same event.
CREATE UNIQUE INDEX IF NOT EXISTS idx_points_once
  ON points_ledger(user_id, reason, item_id) WHERE item_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS redemptions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reward     TEXT NOT NULL,
  cost       INTEGER NOT NULL,
  state      TEXT NOT NULL DEFAULT 'requested'
               CHECK (state IN ('requested', 'fulfilled', 'cancelled')),
  note       TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_redemptions_user  ON redemptions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_redemptions_state ON redemptions(state, created_at DESC);

-- Bench Notes (daily), Field Notes (weekly) and Biopunk Live (weekly) are all
-- the same shape: a dated issue over a window of items.
CREATE TABLE IF NOT EXISTS digests (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  kind       TEXT NOT NULL CHECK (kind IN ('bench-notes', 'field-notes', 'live')),
  slug       TEXT NOT NULL,
  title      TEXT NOT NULL,
  intro      TEXT,
  body       TEXT NOT NULL,
  item_ids   TEXT NOT NULL DEFAULT '[]',
  covers_from INTEGER NOT NULL,
  covers_to   INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_digests_slug ON digests(kind, slug);
CREATE INDEX IF NOT EXISTS idx_digests_kind ON digests(kind, created_at DESC);

-- One row per agent, so a run can ask "what did I already see?" without
-- walking the whole items table.
CREATE TABLE IF NOT EXISTS agent_runs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  agent      TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  posted     INTEGER NOT NULL DEFAULT 0,
  skipped    INTEGER NOT NULL DEFAULT 0,
  error      TEXT
);

CREATE INDEX IF NOT EXISTS idx_agent_runs ON agent_runs(agent, started_at DESC);
`;

/**
 * Columns added after a release. CREATE TABLE IF NOT EXISTS leaves an existing
 * table alone, so anything added later needs an explicit ALTER.
 */
export const LATER_COLUMNS = [
  ['items', 'source', "TEXT NOT NULL DEFAULT 'human'"],
  ['items', 'agent', 'TEXT'],
  ['items', 'surfaced_by', 'TEXT'],
  ['items', 'channel', 'TEXT'],
  ['items', 'review_state', "TEXT NOT NULL DEFAULT 'approved'"],
  ['items', 'reviewed_by', 'TEXT'],
  ['items', 'reviewed_at', 'INTEGER'],
  ['items', 'review_note', 'TEXT'],
  ['users', 'role', "TEXT NOT NULL DEFAULT 'member'"],
  ['users', 'trusted', 'INTEGER NOT NULL DEFAULT 0'],
  ['users', 'points', 'INTEGER NOT NULL DEFAULT 0'],
];

/** Split a multi-statement script into statements a driver can send one by one. */
export function statements(sql) {
  // Strip comments before splitting: a `;` inside a comment would otherwise
  // cut a statement in half.
  const bare = sql
    .split('\n')
    .filter((line) => !/^\s*--/.test(line))
    .join('\n');
  return bare
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}
