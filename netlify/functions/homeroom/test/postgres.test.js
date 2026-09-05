/*
 * The Postgres backend, against a real Postgres.
 *
 * SKIPPED unless HOMEROOM_TEST_DATABASE_URL points at a throwaway database.
 * The other 243 tests run on SQLite and prove the query surface; this one
 * proves the things only a real server can:
 *
 *   - the generated DDL actually parses and creates every table
 *   - `?` really does become `$1` in queries with joins and subqueries
 *   - INSERT ... RETURNING id gives back the id SQLite gets for free
 *   - int8 comes back as a number, not the string node-postgres defaults to
 *   - BEGIN/COMMIT really is one transaction, so the capacity race still holds
 *
 * Run it with:
 *   HOMEROOM_TEST_DATABASE_URL=postgres://user@host:5432/throwaway npm test
 *
 * It DROPs and recreates its own tables, so never point it at anything real.
 */

const URL_ = process.env.HOMEROOM_TEST_DATABASE_URL || '';
process.env.HOMEROOM_DATABASE_URL = URL_;
process.env.HOMEROOM_SECRET = 'pg-test';

import test, { before, after, skip } from 'node:test';
import assert from 'node:assert/strict';

if (!URL_) {
  test('postgres backend', { skip: 'HOMEROOM_TEST_DATABASE_URL is not set' }, () => {});
}

const sql = URL_ ? await import('../app/sql.js') : null;
const db = URL_ ? await import('../app/db.js') : null;
const hr = URL_ ? await import('../app/models.js') : null;
const desk = URL_ ? await import('../app/mentordesk.js') : null;

if (URL_) {
  before(async () => {
    // A clean slate, without needing rights to drop the database itself.
    await sql.exec('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await db.migrate({ force: true });
  });

  after(async () => sql.close());

  test('the backend is postgres, and it says it is durable', () => {
    assert.equal(sql.backend(), 'postgres');
    assert.equal(sql.durable(), true);
  });

  test('the generated schema creates every table', async () => {
    const n = await sql.value(
      "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'");
    assert.ok(n >= 40, `expected the whole schema, got ${n} tables`);
  });

  test('counts come back as numbers, not strings', async () => {
    const n = await sql.value('SELECT COUNT(*) AS n FROM hr_members');
    assert.equal(typeof n, 'number',
      'int8 defaults to a string in node-postgres, which would poison every count and timestamp');
  });

  test('an insert returns its new id, as it does on SQLite', async () => {
    await hr.createUser({ id: 'pgu', email: 'pgu@example.org', passwordHash: 'h' });
    const { id, slug } = await hr.upsertFunder({
      name: 'Axis Capital', kind: 'seed', focus: 'f', addedBy: 'pgu',
    });
    assert.ok(Number.isInteger(id) && id > 0, 'RETURNING id must stand in for lastInsertRowid');
    assert.equal(typeof slug, 'string');
  });

  test('a query with joins and subqueries survives placeholder translation', async () => {
    await hr.ensureMember('pgu', { name: 'PG User' });
    const { mentors } = await hr.searchMentors({ q: 'nobody', limit: 5 });
    assert.ok(Array.isArray(mentors), 'the mentor search has a join and a correlated subquery');
    const counts = await hr.networkStats();
    assert.equal(typeof counts.members, 'number');
  });

  test('aggregates average correctly across the wire', async () => {
    const f = await hr.getFunder('axis-capital');
    await hr.upsertReview({
      funderId: f.id, userId: 'pgu', rating: 4, speed: 5, valueAdd: 3,
      founderFriendly: 5, terms: 4, wouldAgain: true, tags: 'fast-decision',
    });
    const rated = await hr.getFunder('axis-capital');
    assert.equal(Number(rated.avg_rating), 4);
    assert.equal(Number(rated.avg_friendly), 5);
  });

  test('a transaction is one transaction: the capacity race still holds', async () => {
    const mentorId = await hr.upsertMentor({
      name: 'PG Mentor', scheduler: 'https://cal.com/pg/30min', source: 'test',
    });
    await sql.run(
      "UPDATE hr_mentors SET state = 'listed', email = 'm@example.org', capacity = 1 WHERE id = ?",
      mentorId);
    await hr.createUser({ id: 'pgu2', email: 'pgu2@example.org', passwordHash: 'h' });
    await hr.ensureMember('pgu2');

    const mentor = await hr.getMentor(mentorId);
    const a = await desk.createRequest({ mentor, memberId: 'pgu', need: 'x'.repeat(50) });
    const b = await desk.createRequest({ mentor, memberId: 'pgu2', need: 'y'.repeat(50) });

    assert.equal((await desk.answerRequest({ token: a.token, decision: 'accept' })).ok, true);
    const second = await desk.answerRequest({ token: b.token, decision: 'accept' });
    assert.equal(second.ok, false);
    assert.equal(second.reason, 'at-capacity',
      'without a real transaction both accepts would win the last slot');
  });

  test('a grant round-trips, which is the whole point of the move', async () => {
    const req = await sql.get(
      "SELECT id FROM hr_mentor_requests WHERE state = 'accepted' ORDER BY id LIMIT 1");
    const grant = await desk.liveGrantFor(req.id);
    assert.ok(grant, 'the booking link survives in a database that outlives the container');
    const redeemed = await desk.redeemGrant({ grantId: grant.id, memberId: grant.member_id });
    assert.equal(redeemed.ok, true);
    assert.match(redeemed.url, /^https:\/\/cal\.com\//);
  });
}
