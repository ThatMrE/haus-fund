process.env.BIOPUNK_DB = ':memory:';

import test from 'node:test';
import assert from 'node:assert/strict';
import { initDb, getDb } from '../app/db/index.js';
import * as db from '../app/models.js';
import * as points from '../app/points.js';
import * as review from '../app/review.js';
import { hashPassword } from '../app/auth.js';

await initDb();

// A reviewer has to exist: reviewed_by is a real foreign key.
await initReviewer();

async function initReviewer() {
  await db.createUser({ id: 'curator', passwordHash: hashPassword('curator-pw'), isAdmin: true });
}

let seq = 0;
async function scout(id, { trusted = false } = {}) {
  return (
    (await db.getUser(id)) ??
    (await db.createUser({ id, passwordHash: hashPassword(`${id}-pw`), role: 'scout', trusted }))
  );
}

async function story(by, { reviewState = 'approved' } = {}) {
  seq += 1;
  return db.createStory({
    by,
    title: `Story ${seq}`,
    url: `https://example.org/${seq}`,
    surfacedBy: by,
    reviewState,
  });
}

test('an award lands once, however many times the pass runs', async () => {
  await scout('ada');
  const id = await story('ada');

  assert.equal(await points.award({ userId: 'ada', reason: 'surfaced-approved', itemId: id }), 5);
  assert.equal(await points.award({ userId: 'ada', reason: 'surfaced-approved', itemId: id }), 0);
  assert.equal(await points.balanceOf('ada'), 5);
});

test('the same reason on a different item pays again', async () => {
  await scout('bea');
  await points.award({ userId: 'bea', reason: 'surfaced-approved', itemId: await story('bea') });
  await points.award({ userId: 'bea', reason: 'surfaced-approved', itemId: await story('bea') });
  assert.equal(await points.balanceOf('bea'), 10);
});

test('vote milestones pay at each threshold and no further', async () => {
  await scout('cyd');
  const id = await story('cyd');
  await getDb().run('UPDATE items SET points = 27 WHERE id = ?', id);

  await points.awardVoteMilestones();
  // 5 for reaching 10, 10 for reaching 25 — not the 50 tier.
  assert.equal(await points.balanceOf('cyd'), 15);

  await points.awardVoteMilestones();
  assert.equal(await points.balanceOf('cyd'), 15, 'a second pass pays nothing');
});

test('redeeming spends points and records the request', async () => {
  await scout('dot');
  await points.award({ userId: 'dot', reason: 'adjustment', points: 150, note: 'seed' });

  const result = await points.redeem('dot', 'patch', { note: 'large' });
  assert.equal(result.ok, true);
  assert.equal(result.redemption.remaining, 50);
  assert.equal(await points.balanceOf('dot'), 50);

  const requests = await points.redemptionsFor('dot');
  assert.equal(requests.length, 1);
  assert.equal(requests[0].reward, 'patch');
  assert.equal(requests[0].state, 'requested');
});

test('a balance cannot go negative', async () => {
  await scout('eli');
  await points.award({ userId: 'eli', reason: 'adjustment', points: 30 });

  const result = await points.redeem('eli', 'unconference');
  assert.equal(result.ok, false);
  assert.match(result.error, /400 points/);
  assert.equal(await points.balanceOf('eli'), 30, 'a refused redemption spends nothing');
});

test('the ledger is the record, and a balance can be rebuilt from it', async () => {
  await scout('fay');
  await points.award({ userId: 'fay', reason: 'adjustment', points: 40 });
  await points.redeem('fay', 'patch');

  // Corrupt the cached balance the way a half-finished write would.
  await getDb().run('UPDATE users SET points = 999 WHERE id = ?', 'fay');
  assert.equal(await points.recomputeBalance('fay'), 40, 'the patch was refused, so only the 40 earned stands');
});

test('a submission from an untrusted account waits; a trusted one does not', async () => {
  const newcomer = await scout('gus');
  const regular = await scout('hal', { trusted: true });

  assert.equal(review.initialReviewState(newcomer), 'pending');
  assert.equal(review.initialReviewState(regular), 'approved');
  assert.equal(review.initialReviewState({ is_admin: 1 }), 'approved');
});

test('approving dates the item from the moment it cleared', async () => {
  await scout('ivy');
  const id = await story('ivy', { reviewState: 'pending' });
  await getDb().run('UPDATE items SET created_at = ? WHERE id = ?', 1000, id);

  const before = await db.getItem(id);
  assert.equal(before.created_at, 1000);

  await review.approve(id, 'curator');
  const after = await db.getItem(id);
  assert.equal(after.review_state, 'approved');
  assert.ok(after.created_at > 1000, 'the clock on its day at the top starts now');
});

test('a pending story is off every public listing', async () => {
  await scout('jan');
  const id = await story('jan', { reviewState: 'pending' });

  const front = await db.frontPage();
  const fresh = await db.newest();
  assert.ok(!front.items.some((i) => i.id === id));
  assert.ok(!fresh.items.some((i) => i.id === id));

  await review.approve(id, 'curator');
  const after = await db.newest();
  assert.ok(after.items.some((i) => i.id === id), 'and on it once cleared');
});

test('clearing enough submissions earns trust', async () => {
  await scout('kim');
  for (let i = 0; i < review.TRUST_THRESHOLD; i++) {
    await review.approve(await story('kim', { reviewState: 'pending' }), 'curator');
  }
  assert.equal((await db.getUser('kim')).trusted, 1);
});

test('a handle named in NEWS_ADMINS can run the queue on a fresh database', async () => {
  const env = { NEWS_ADMINS: 'ada, elliot ' };
  assert.equal(review.isFoundingAdmin('ada', env), true);
  assert.equal(review.isFoundingAdmin('Elliot', env), true, 'handles are compared case-insensitively');
  assert.equal(review.isFoundingAdmin('stranger', env), false);
  assert.deepEqual(review.adminHandles({}), [], 'and nobody is an admin by default');
});
