import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { HOMEROOM_SCHEMA } from './schema.js';

const DEFAULT_PATH = resolve(process.cwd(), 'data/homeroom.db');

let db = null;

/** Open (or reuse) the SQLite handle and make sure the schema is present. */
export function getDb(path = process.env.HOMEROOM_DB || DEFAULT_PATH) {
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

/**
 * Accounts and sessions. Homeroom owns its own, rather than borrowing an
 * identity provider: it is one table, one scrypt hash, and one signed cookie,
 * and it keeps the whole thing deployable with nothing to sign up for.
 */
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
 * Columns added after the first release.
 *
 * CREATE TABLE IF NOT EXISTS is enough for a new table and does nothing for a
 * new column, so added columns are listed here and applied one at a time.
 * SQLite has no ADD COLUMN IF NOT EXISTS, and it is cheaper to attempt the
 * ALTER and ignore the duplicate-column error than to parse table_info on
 * every boot.
 */
const ADDED_COLUMNS = [
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
  ['hr_mentors', 'synced_at', 'INTEGER'],
  // Phase 3: keeping the roster honest. `confirmed_at` is when they last said
  // yes to being here at all; the two nudge columns are how a silence becomes
  // dormancy rather than a listing nobody ever checks again.
  ['hr_mentors', 'reconfirm_sent_at', 'INTEGER'],
  ['hr_mentors', 'reconfirm_nudges', 'INTEGER NOT NULL DEFAULT 0'],
];

function addColumns(instance) {
  for (const [table, column, type] of ADDED_COLUMNS) {
    try {
      instance.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
    } catch (err) {
      // "duplicate column name" is the expected outcome on every boot but the
      // first. Anything else is a real schema problem and should be seen.
      if (!/duplicate column/i.test(String(err?.message))) throw err;
    }
  }
}

function migrate(instance) {
  instance.exec(ACCOUNT_SCHEMA);
  instance.exec(HOMEROOM_SCHEMA);
  addColumns(instance);
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
