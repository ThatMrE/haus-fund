/*
 * The two translations that let one set of SQL serve both backends.
 *
 * These are pure functions and they are tested as such, because everything
 * else about the Postgres path needs a Postgres to be honest about. What can
 * be verified without a server is verified here; what cannot is said plainly
 * in the README rather than implied by a green tick.
 *
 * The placeholder walker is the one to be paranoid about. It rewrites `?` to
 * `$1`, and a question mark inside a string literal is a value, not a
 * parameter — getting that wrong would silently corrupt a query rather than
 * fail it.
 */

process.env.HOMEROOM_DB = ':memory:';

import test from 'node:test';
import assert from 'node:assert/strict';
import { toPgPlaceholders, backend } from '../app/sql.js';
import { toPostgres, schemaFor } from '../app/db.js';

/* ------------------------------------------------------- placeholders */

test('positional placeholders are numbered in order', () => {
  assert.equal(
    toPgPlaceholders('SELECT * FROM t WHERE a = ? AND b = ? AND c = ?'),
    'SELECT * FROM t WHERE a = $1 AND b = $2 AND c = $3',
  );
});

test('a question mark inside a string literal is left alone', () => {
  assert.equal(
    toPgPlaceholders("SELECT * FROM t WHERE label = 'what?' AND id = ?"),
    "SELECT * FROM t WHERE label = 'what?' AND id = $1",
    'a literal question mark is a value, not a parameter',
  );
});

test('an escaped quote does not end the literal early', () => {
  assert.equal(
    toPgPlaceholders("SELECT 'it''s a ?' , ?"),
    "SELECT 'it''s a ?' , $1",
  );
});

test('double-quoted identifiers are respected too', () => {
  assert.equal(
    toPgPlaceholders('SELECT "odd?column" FROM t WHERE x = ?'),
    'SELECT "odd?column" FROM t WHERE x = $1',
  );
});

test('a query with no parameters is unchanged', () => {
  const sql = 'SELECT COUNT(*) AS n FROM hr_members';
  assert.equal(toPgPlaceholders(sql), sql);
});

/* -------------------------------------------------------------- schema */

test('autoincrementing keys become identity columns', () => {
  assert.equal(
    toPostgres('id INTEGER PRIMARY KEY AUTOINCREMENT'),
    'id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY',
  );
});

test('integers widen, because epoch seconds outgrow int4 in 2038', () => {
  assert.match(toPostgres('created_at INTEGER NOT NULL'), /BIGINT NOT NULL/);
});

test('NOCASE collation is dropped rather than faked', () => {
  assert.equal(
    toPostgres('ORDER BY name COLLATE NOCASE'),
    'ORDER BY name',
    'Postgres has no NOCASE; pretending otherwise would be a silent behaviour change',
  );
});

test('the generated Postgres schema carries every table and no SQLite-isms', () => {
  const ddl = schemaFor('postgres');
  const sqlite = schemaFor('sqlite');

  const tablesIn = (s) => (s.match(/CREATE TABLE IF NOT EXISTS (\w+)/g) || [])
    .map((m) => m.replace('CREATE TABLE IF NOT EXISTS ', '')).sort();

  assert.deepEqual(tablesIn(ddl), tablesIn(sqlite),
    'the two dialects must describe the same tables — drift here is invisible until production');
  assert.ok(tablesIn(ddl).length >= 40, 'every hr_ table should be present');

  for (const leftover of ['AUTOINCREMENT', 'COLLATE NOCASE']) {
    assert.ok(!ddl.includes(leftover), `${leftover} would not parse on Postgres`);
  }
});

test('added columns reach Postgres as IF NOT EXISTS, which SQLite cannot do', () => {
  const ddl = schemaFor('postgres');
  assert.match(ddl, /ALTER TABLE hr_mentors ADD COLUMN IF NOT EXISTS state/);
});

/* ------------------------------------------------------------- backend */

test('the backend is chosen by the presence of a connection string, not a flag', () => {
  assert.equal(backend(), 'sqlite', 'no DATABASE_URL in the tests, so SQLite');
});
