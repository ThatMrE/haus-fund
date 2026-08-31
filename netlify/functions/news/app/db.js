import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const DEFAULT_PATH = resolve(process.cwd(), 'data/haus-news.db');

let db = null;

/** Open (or reuse) the SQLite handle and make sure the schema is present. */
export function getDb(path = process.env.BIOPUNK_DB || DEFAULT_PATH) {
  if (db) return db;
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');
  migrate(db);
  return db;
}

/** Point the process at a different database (used by the tests). */
export function setDb(instance) {
  db = instance;
  if (db) migrate(db);
  return db;
}

export function closeDb() {
  if (db) db.close();
  db = null;
}

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  email         TEXT,
  about         TEXT NOT NULL DEFAULT '',
  karma         INTEGER NOT NULL DEFAULT 1,
  created_at    INTEGER NOT NULL,
  is_admin      INTEGER NOT NULL DEFAULT 0,
  banned        INTEGER NOT NULL DEFAULT 0
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

CREATE TABLE IF NOT EXISTS votes (
  user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id   INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_votes_user ON votes(user_id, created_at DESC);

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
`;

function migrate(instance) {
  instance.exec(SCHEMA);
  addMissingColumns(instance);
}

/**
 * Columns added after the first release. CREATE TABLE IF NOT EXISTS leaves an
 * existing table alone, so new columns need an explicit ALTER.
 */
const LATER_COLUMNS = [
  ['items', 'source', "TEXT NOT NULL DEFAULT 'human'"],
];

function addMissingColumns(instance) {
  for (const [table, column, definition] of LATER_COLUMNS) {
    const present = instance
      .prepare(`SELECT COUNT(*) AS n FROM pragma_table_info(?) WHERE name = ?`)
      .get(table, column).n;
    if (!present) instance.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

/** Run a function inside a transaction, rolling back if it throws. */
export function transaction(fn) {
  const instance = getDb();
  instance.exec('BEGIN');
  try {
    const result = fn(instance);
    instance.exec('COMMIT');
    return result;
  } catch (err) {
    try {
      instance.exec('ROLLBACK');
    } catch {
      /* the outer error is the interesting one */
    }
    throw err;
  }
}
