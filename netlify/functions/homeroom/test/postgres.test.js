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
 *   - BEGIN/COMMIT really is one transaction
 *   - and that the capacity race holds with accepts genuinely in flight at
 *     once, which is the only version of that question production asks
 *
 * Run it with:
 *   HOMEROOM_TEST_DATABASE_URL=postgres://user@host:5432/throwaway npm test
 *
 * It DROPs and recreates its own tables, so never point it at anything real.
 */

const URL_ = process.env.HOMEROOM_TEST_DATABASE_URL || '';
process.env.HOMEROOM_DATABASE_URL = URL_;
process.env.HOMEROOM_SECRET = 'pg-test';
// The app defaults to a pool of 2, which is right for one serverless instance
// and useless for testing a race: production's concurrency is many instances
// against one database, and this is how a single process imitates that.
process.env.HOMEROOM_PG_POOL = '8';

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

  /*
   * The same race, with the accepts actually simultaneous.
   *
   * The test above answers a different question than its name suggests: it
   * awaits the first accept before starting the second, so it proves the
   * capacity check reads committed state, never that two accepts cannot both
   * win. Two mentors clicking their emails in the same second land on two
   * function instances, and that is the case that overbooks.
   *
   * It caught a real one. Counting accepted requests and comparing takes no
   * lock, and READ COMMITTED has no predicate lock on rows that do not exist
   * yet, so both transactions counted the same free slot and both took it --
   * five winners against a capacity of one, in a database with the atomic
   * transactions the test above verifies. The fix is FOR UPDATE on the mentor
   * row in answerRequest.
   *
   * Not flaky in the direction that matters: with the lock, exactly one winner
   * is guaranteed rather than likely, so a correct implementation always
   * passes. Only a broken one varies, and it varies often enough to catch.
   */
  test('simultaneous accepts cannot overbook a mentor', async () => {
    const N = 8;
    const mentorId = await hr.upsertMentor({
      name: 'Race Mentor', scheduler: 'https://cal.com/race/30min', source: 'test',
    });
    await sql.run(
      "UPDATE hr_mentors SET state = 'listed', email = 'race@example.org', capacity = 1 WHERE id = ?",
      mentorId);
    const mentor = await hr.getMentor(mentorId);

    const tokens = [];
    for (let i = 0; i < N; i++) {
      const id = `racer${i}`;
      await hr.createUser({ id, email: `${id}@example.org`, passwordHash: 'h' });
      await hr.ensureMember(id);
      tokens.push((await desk.createRequest({ mentor, memberId: id, need: 'z'.repeat(50) })).token);
    }

    // Released together: no await between them until they are all in flight.
    const results = await Promise.all(tokens.map(
      (token) => desk.answerRequest({ token, decision: 'accept' })));

    const won = results.filter((r) => r.ok);
    assert.equal(won.length, 1, `${won.length} of ${N} accepts won a single slot`);
    assert.equal(results.filter((r) => !r.ok && r.reason === 'at-capacity').length, N - 1,
      'every loser should be turned away for capacity, not for some other reason');

    // The rows are the real assertion: a mentor with capacity 1 who agreed to
    // one call must not find two bookings on their calendar.
    assert.equal(
      await sql.value(`SELECT COUNT(*) FROM hr_mentor_requests
           WHERE mentor_id = ? AND state = 'accepted'`, mentorId),
      1, 'accepted requests');
    assert.equal(
      await sql.value(`SELECT COUNT(*) FROM hr_mentor_grants g
           JOIN hr_mentor_requests r ON r.id = g.request_id
           WHERE r.mentor_id = ?`, mentorId),
      1, 'booking grants issued');
  });
}
