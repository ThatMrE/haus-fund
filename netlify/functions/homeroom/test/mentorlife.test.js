/*
 * Keeping the mentor roster honest.
 *
 * The thing being tested is a claim about time: that a mentor who stops
 * answering stops being listed, without anybody noticing they needed to look.
 * So most of these tests move the clock rather than the data — they pass a
 * `now` far enough forward that the sweep has to make a decision.
 *
 * The assertion the whole phase rests on is the last one in the re-confirmation
 * block: a mentor who ignores everything for six months is DORMANT, not
 * listed. A directory that renders a live entry and a dead one identically is
 * worse than a shorter directory.
 *
 * No network: mail has no provider configured, so mentormail logs and returns.
 */

process.env.HOMEROOM_DB = ':memory:';
process.env.HOMEROOM_SECRET = 'test-secret';
process.env.HOMEROOM_SEED = 'off';

import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { getDb } from '../app/db.js';
import * as hr from '../app/models.js';
import * as desk from '../app/mentordesk.js';
import * as life from '../app/mentorlife.js';
import * as sync from '../app/mentorsync.js';

getDb();

const DAY = 86400;
const NOW = 1800000000;

function user(id) {
  getDb().prepare(
    'INSERT OR IGNORE INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)',
  ).run(id, `${id}@fixture.test`, 'x', NOW);
  hr.ensureMember(id);
  return id;
}

let seq = 0;
function mentor(overrides = {}) {
  seq += 1;
  const id = hr.upsertMentor({
    name: `Lifecycle Mentor ${seq}`, role: 'Adviser', track: 'regulatory',
    scheduler: 'https://cal.com/x/30min', vetted: true, source: 'test',
  });
  getDb().prepare(
    `UPDATE hr_mentors SET state = ?, email = ?, capacity = ?, confirmed_at = ?,
            created_at = ?, active = 1 WHERE id = ?`,
  ).run(overrides.state || 'listed', overrides.email ?? 'm@example.org',
    overrides.capacity ?? 5, overrides.confirmedAt ?? NOW, overrides.createdAt ?? NOW, id);
  return hr.getMentor(id);
}

/** An expired request, as the ten-day window would eventually produce. */
function expiredRequest(mentorId, memberId, at) {
  const r = desk.createRequest({
    mentor: hr.getMentor(mentorId), memberId, need: 'x'.repeat(50), whyThem: 'y'.repeat(30),
  });
  getDb().prepare("UPDATE hr_mentor_requests SET state = 'expired', created_at = ?, answered_at = ? WHERE id = ?")
    .run(at, at + 10 * DAY, r.id);
  return r;
}

beforeEach(() => {
  getDb().exec('DELETE FROM hr_mentor_requests; DELETE FROM hr_mentors; DELETE FROM hr_mentor_tokens;');
  user('m1'); user('m2'); user('m3');
});

/* ============================================================= auto-pause */

test('three unanswered in a row pauses a mentor', () => {
  const m = mentor();
  expiredRequest(m.id, 'm1', NOW);
  expiredRequest(m.id, 'm2', NOW + DAY);
  assert.equal(life.autoPauseSilent(NOW + 2 * DAY).length, 0, 'two is not a pattern');

  expiredRequest(m.id, 'm3', NOW + 2 * DAY);
  const paused = life.autoPauseSilent(NOW + 3 * DAY);
  assert.equal(paused.length, 1);
  assert.equal(hr.getMentor(m.id).state, 'paused');
});

test('answering breaks the run', () => {
  const m = mentor();
  expiredRequest(m.id, 'm1', NOW);
  expiredRequest(m.id, 'm2', NOW + DAY);

  // An answer in between: engaged, not gone.
  const live = desk.createRequest({ mentor: hr.getMentor(m.id), memberId: 'm3', need: 'x'.repeat(50) });
  desk.answerRequest({ token: live.token, decision: 'decline' });

  assert.equal(life.autoPauseSilent(NOW + 3 * DAY).length, 0,
    'three expiries that are not consecutive is a busy month, not a departure');
});

test('a paused mentor is off the roster but not deleted', () => {
  const m = mentor();
  for (const [i, who] of [['m1'], ['m2'], ['m3']].entries()) expiredRequest(m.id, who[0], NOW + i * DAY);
  life.autoPauseSilent(NOW + 4 * DAY);
  assert.equal(desk.canRequest({ mentor: hr.getMentor(m.id), memberId: 'm1' }).reason, 'paused');
  assert.ok(hr.getMentor(m.id), 'the row is still there');
});

/* ========================================================= re-confirmation */

test('nobody is asked before the cycle is up', () => {
  mentor({ confirmedAt: NOW });
  assert.equal(life.reconfirmDue(NOW + 90 * DAY).due.length, 0);
});

test('a mentor who ignores everything for six months goes dormant', () => {
  const m = mentor({ confirmedAt: NOW });

  // 180 days: the first ask.
  let at = NOW + 181 * DAY;
  let { due } = life.reconfirmDue(at);
  assert.equal(due.length, 1, 'due at six months');
  life.markNudged(m.id, at);

  // 14 days later: the second, and only the second.
  at += 15 * DAY;
  ({ due } = life.reconfirmDue(at));
  assert.equal(due.length, 1, 'one nudge, once');
  life.markNudged(m.id, at);

  // 14 more: out.
  at += 15 * DAY;
  const { dormant, due: stillDue } = life.reconfirmDue(at);
  assert.equal(stillDue.length, 0, 'no third ask — two is the whole sequence');
  assert.equal(dormant.length, 1);

  life.makeDormant(m.id, at);
  assert.equal(hr.getMentor(m.id).state, 'dormant');
  assert.equal(hr.searchMentors({}).total, 0, 'and off the roster members see');
});

test('confirming resets the clock', () => {
  const m = mentor({ confirmedAt: NOW });
  const at = NOW + 181 * DAY;
  life.markNudged(m.id, at);

  const token = life.mintToken(m.id, { kind: 'reconfirm', now: at });
  const result = life.confirm(token, at + DAY);
  assert.equal(result.ok, true);

  const after = hr.getMentor(m.id);
  assert.equal(after.reconfirm_nudges, 0);
  assert.equal(life.reconfirmDue(at + 2 * DAY).due.length, 0, 'not due again for another six months');
});

test('confirming brings a dormant mentor back in one click', () => {
  const m = mentor({ state: 'dormant' });
  getDb().prepare('UPDATE hr_mentors SET active = 0 WHERE id = ?').run(m.id);
  assert.equal(hr.searchMentors({}).total, 0);

  const result = life.confirm(life.mintToken(m.id, { now: NOW }), NOW);
  assert.equal(result.cameBack, true);
  assert.equal(hr.getMentor(m.id).state, 'listed');
  assert.equal(hr.searchMentors({}).total, 1);
});

/* ============================================================== withdrawal */

test('withdrawing is immediate, and takes the live links with it', () => {
  const m = mentor();
  const r = desk.createRequest({ mentor: hr.getMentor(m.id), memberId: 'm1', need: 'x'.repeat(50) });
  const { grant } = desk.answerRequest({ token: r.token, decision: 'accept' });

  const result = life.withdraw(life.mintToken(m.id, { now: NOW }), NOW);
  assert.equal(result.ok, true);
  assert.equal(hr.getMentor(m.id).state, 'withdrawn');
  assert.equal(hr.searchMentors({}).total, 0);
  assert.equal(desk.redeemGrant({ grantId: grant.id, memberId: 'm1' }).reason, 'revoked',
    'unlike a pause, this is somebody saying they are gone');
});

test('an open request is closed out rather than left hanging', () => {
  const m = mentor();
  const r = desk.createRequest({ mentor: hr.getMentor(m.id), memberId: 'm1', need: 'x'.repeat(50) });
  life.withdraw(life.mintToken(m.id, { now: NOW }), NOW);
  assert.equal(desk.getRequest(r.id).state, 'expired',
    'a member should not wait ten days on somebody who has left');
});

/* =================================================================== tokens */

test('a mentor token is hashed, single-purpose and expiring', () => {
  const m = mentor();
  const token = life.mintToken(m.id, { days: 1, now: NOW });
  assert.equal(getDb().prepare('SELECT COUNT(*) AS n FROM hr_mentor_tokens WHERE token_hash = ?')
    .get(token).n, 0, 'the raw token is never what is stored');
  assert.ok(life.findToken(token, NOW));
  assert.equal(life.findToken(token, NOW + 2 * DAY), null, 'expiry is checked on read');
  assert.equal(life.findToken('not-a-token', NOW), null);
});

test('clicking confirm twice is not an error', () => {
  const m = mentor();
  const token = life.mintToken(m.id, { now: NOW });
  assert.equal(life.confirm(token, NOW).ok, true);
  assert.equal(life.confirm(token, NOW).ok, true, 'a double tap on an email button is not a mistake');
});

/* ================================================================= the sweep */

test('the sweep is idempotent: a second run mails nobody twice', async () => {
  const m = mentor({ confirmedAt: NOW - 200 * DAY, createdAt: NOW - 200 * DAY });
  const first = await sync.lifecycle({ now: NOW });
  assert.equal(first.reconfirmed, 1);
  const second = await sync.lifecycle({ now: NOW });
  assert.equal(second.reconfirmed, 0, 'the nudge counter is the guard against a double fire');
  assert.equal(hr.getMentor(m.id).reconfirm_nudges, 1);
});

test('a mentor with no address still moves through the lifecycle', async () => {
  const m = mentor({ email: '', confirmedAt: NOW - 200 * DAY, createdAt: NOW - 200 * DAY });
  const result = await sync.lifecycle({ now: NOW });
  assert.equal(result.reconfirmed, 1,
    'not being reachable is a reason to prune them, not a reason to skip them');
  assert.equal(hr.getMentor(m.id).reconfirm_nudges, 1);
});

/* =================================================================== metrics */

test('metrics report rates and the denominators behind them', () => {
  const m = mentor({ capacity: 10 });
  const a = desk.createRequest({ mentor: hr.getMentor(m.id), memberId: 'm1', need: 'x'.repeat(50) });
  desk.answerRequest({ token: a.token, decision: 'accept' });
  const b = desk.createRequest({ mentor: hr.getMentor(m.id), memberId: 'm2', need: 'x'.repeat(50) });
  desk.answerRequest({ token: b.token, decision: 'decline' });

  const stats = life.metrics(NOW);
  assert.equal(stats.acceptRate, 50);
  assert.equal(stats.sample.answered, 2, 'the denominator is reported so 50% is not read as a trend');
  assert.equal(stats.unansweredRate, 0);
});

test('metrics do not count the roster size', () => {
  mentor(); mentor(); mentor();
  const stats = life.metrics(NOW);
  assert.ok(!('total' in stats) && !('mentors' in stats),
    'a roster of 200 where 60 answer is worse than a roster of 60');
  assert.equal(stats.dormantShare, 0, 'the rot number is the honest version of that question');
});

test('dormant share rises as the roster rots', () => {
  const a = mentor(); mentor();
  life.makeDormant(a.id, NOW);
  assert.equal(life.metrics(NOW).dormantShare, 50);
});
