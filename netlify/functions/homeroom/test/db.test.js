/**
 * The database layer itself.
 *
 * Most of what matters about this port is invisible from the feature tests:
 * they would pass just as well against the old SQLite file, because they only
 * ever look at one process. The assertions here are the ones about the move —
 * that placeholders survive translation, that a transaction actually rolls
 * back, that concurrent boots do not race the schema, and that health() tells
 * the truth about whether the store outlives the container.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { getDb, toPositional, driver, health, transaction } from '../app/db.js';

await getDb();

/* ============================================================ placeholders */

test('? becomes $1..$n in order', () => {
  assert.equal(
    toPositional('SELECT * FROM t WHERE a = ? AND b = ? LIMIT ?'),
    'SELECT * FROM t WHERE a = $1 AND b = $2 LIMIT $3',
  );
});

test('a question mark inside a string literal is data, not a placeholder', () => {
  // The reason this is a walker rather than a regex: LIKE patterns and
  // punctuation in seeded copy both contain question marks.
  assert.equal(
    toPositional(`SELECT * FROM t WHERE body LIKE '%?%' AND id = ?`),
    `SELECT * FROM t WHERE body LIKE '%?%' AND id = $1`,
  );
  assert.equal(
    toPositional(`SELECT 'it''s a ?' AS q, ? AS p`),
    `SELECT 'it''s a ?' AS q, $1 AS p`,
  );
});

test('question marks in comments are left alone', () => {
  assert.equal(toPositional('SELECT ? -- why?\n, ?'), 'SELECT $1 -- why?\n, $2');
  assert.equal(toPositional('SELECT /* ? */ ?'), 'SELECT /* ? */ $1');
});

test('a quoted identifier is not scanned for placeholders', () => {
  assert.equal(toPositional('SELECT "odd?name", ? FROM t'), 'SELECT "odd?name", $1 FROM t');
});

/* ============================================================== the driver */

test('with no database URL it runs in process, and says so', {
  // This one is about the absence of a URL, so it cannot mean anything when
  // the suite is pointed at a real Postgres — which is worth doing, and which
  // should not produce a failure that reads like a defect.
  skip: process.env.HOMEROOM_DATABASE_URL ? 'HOMEROOM_DATABASE_URL is set' : false,
}, async () => {
  // This is what the test suite itself is using, so the assertion doubles as a
  // statement of how these tests get a Postgres without one being installed.
  assert.equal(driver(), 'pglite');
  const state = await health();
  assert.equal(state.reachable, true);
  assert.equal(state.durable, false);
  assert.match(state.warning, /HOMEROOM_DATABASE_URL/);
  assert.match(state.warning, /disappears with the container/);
});

test('the schema is there and countable', async () => {
  const db = await getDb();
  const row = await db
    .prepare(`SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = 'public'`)
    .get();
  assert.ok(row.n > 30, `expected the full schema, saw ${row.n} tables`);
});

test('counts come back as numbers, not strings', async () => {
  // Postgres returns int8 as a string by default, which would turn every
  // `count > 0` into a comparison against "0" and quietly pass.
  const db = await getDb();
  const row = await db.prepare('SELECT COUNT(*) AS n FROM users').get();
  assert.equal(typeof row.n, 'number');
});

/* ============================================================ transactions */

test('a transaction commits as one unit', async () => {
  const db = await getDb();
  await transaction(async (tx) => {
    await tx.prepare('INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)')
      .run('txcommit', 'txcommit@example.org', 'x', 1);
  });
  assert.ok(await db.prepare('SELECT id FROM users WHERE id = ?').get('txcommit'));
});

test('a transaction rolls back everything when it throws', async () => {
  const db = await getDb();
  await assert.rejects(transaction(async (tx) => {
    await tx.prepare('INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)')
      .run('txrollback', 'txrollback@example.org', 'x', 1);
    throw new Error('deliberate');
  }), /deliberate/);

  assert.equal(
    await db.prepare('SELECT id FROM users WHERE id = ?').get('txrollback'),
    null,
    'the insert must not survive the throw',
  );
});

/* ================================================================ statements */

test('run() reports how many rows it touched', async () => {
  const db = await getDb();
  await db.prepare('INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)')
    .run('counted', 'counted@example.org', 'x', 1);
  const result = await db.prepare('UPDATE users SET karma = ? WHERE id = ?').run(7, 'counted');
  assert.equal(result.changes, 1);
  const miss = await db.prepare('UPDATE users SET karma = ? WHERE id = ?').run(7, 'nobody-at-all');
  assert.equal(miss.changes, 0);
});

test('get() returns null rather than undefined when nothing matches', async () => {
  const db = await getDb();
  assert.equal(await db.prepare('SELECT id FROM users WHERE id = ?').get('nobody'), null);
});

test('all() returns an array, empty when nothing matches', async () => {
  const db = await getDb();
  const rows = await db.prepare('SELECT id FROM users WHERE id = ?').all('nobody');
  assert.ok(Array.isArray(rows));
  assert.equal(rows.length, 0);
});

test('RETURNING is how a new id comes back', async () => {
  // Postgres has no lastInsertRowid; every insert that needs its id asks for it.
  const db = await getDb();
  const row = await db
    .prepare(`INSERT INTO hr_atlas (slug, name, city, country, region, kind, status, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`)
    .get('returning-test', 'Returning Lab', 'Lisbon', 'PT', 'europe', 'community', 'active', 1);
  assert.equal(typeof row.id, 'number');
});

/* ================================================================ schema */

test('opening twice hands back the same handle without re-migrating', async () => {
  // Every request calls getDb(); if that re-ran the schema each time the app
  // would spend its life issuing CREATE TABLE IF NOT EXISTS.
  const a = await getDb();
  const b = await getDb();
  assert.equal(a, b);
});

test('concurrent opens do not race the schema', async () => {
  // Several cold containers start at once behind a deploy and all run migrate().
  const handles = await Promise.all(Array.from({ length: 8 }, () => getDb()));
  for (const h of handles) assert.equal(h, handles[0]);
});
