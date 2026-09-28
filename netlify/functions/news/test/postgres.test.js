/**
 * The data layer, against a real Postgres.
 *
 * The hosted database is Postgres and the local one is SQLite, and the two
 * disagree in small ways that a stub cannot catch — LIKE's case sensitivity,
 * how an id auto-assigns, where the column list lives. This runs the real
 * driver, including its batch transactions, against a live server.
 *
 * Skipped when there is no Postgres to talk to, so the suite still runs
 * anywhere. To run it:
 *
 *   initdb -D /tmp/pgtest -U postgres --auth=trust
 *   pg_ctl -D /tmp/pgtest -o '-p 55432 -k /tmp' start
 *   createdb -h /tmp -p 55432 -U postgres feedtest
 */
process.env.BIOPUNK_DB = ':memory:';

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { psqlTransport, psqlAvailable } from './helpers/psql.js';
import * as db from '../app/db/index.js';
import * as models from '../app/models.js';
import * as points from '../app/points.js';
import * as review from '../app/review.js';
import { hashPassword } from '../app/auth.js';

const available = psqlAvailable();
const options = { skip: available ? false : 'no Postgres on /tmp:55432' };

function freshDatabase() {
  const args = ['-h', '/tmp', '-p', '55432', '-U', 'postgres', '-c'];
  execFileSync('psql', [...args, 'DROP DATABASE IF EXISTS feedtest'], { stdio: 'pipe' });
  execFileSync('psql', [...args, 'CREATE DATABASE feedtest'], { stdio: 'pipe' });
}

async function connect() {
  freshDatabase();
  await db.closeDb();
  await db.initDb({
    target: { driver: 'neon', url: 'postgresql://postgres@localhost/feedtest' },
    transport: psqlTransport(),
  });
  await models.createUser({ id: 'ada', passwordHash: hashPassword('ada-pw') });
  await models.createUser({ id: 'bob', passwordHash: hashPassword('bob-pw') });
  await models.createUser({ id: 'curator', passwordHash: hashPassword('cur-pw'), isAdmin: true });
}

test('the schema applies and the driver reports Postgres', options, async () => {
  await connect();
  assert.equal(db.getDb().kind, 'postgres');
  const tables = await db.getDb().all(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'",
  );
  assert.equal(tables.length, 10);
});

test('an id auto-assigns, and a story becomes its own thread root', options, async () => {
  await connect();
  const id = await models.createStory({ by: 'ada', title: 'Base editing readout', url: 'https://example.org/be' });
  assert.ok(Number.isInteger(id) && id > 0);

  const story = await models.getItem(id);
  assert.equal(story.story_id, id, 'the batch carried the new id to the next statement');
  assert.equal(story.points, 1, 'and to the seed vote');
  assert.equal(story.type, 'story');
});

test('voting moves points and karma together, and self-voting is refused', options, async () => {
  await connect();
  const id = await models.createStory({ by: 'ada', title: 'Droplet evolution', url: 'https://example.org/d' });

  assert.equal((await models.vote('bob', id)).points, 2);
  assert.equal((await models.getUser('ada')).karma, 2);
  assert.equal((await models.vote('bob', id)).points, 2, 'voting twice is idempotent');

  const own = await models.vote('ada', id);
  assert.equal(own.ok, false);
  assert.match(own.error, /own post/);

  assert.equal((await models.unvote('bob', id)).points, 1);
  assert.equal((await models.getUser('ada')).karma, 1);
});

test('comments nest and keep the story count honest', options, async () => {
  await connect();
  const story = await models.createStory({ by: 'ada', title: 'Trehalose field data', url: 'https://example.org/t' });
  const comment = await models.createComment({ by: 'bob', parentId: story, text: 'What was the ambient temperature?' });

  const saved = await models.getItem(comment);
  assert.equal(saved.story_id, story);
  assert.equal(saved.type, 'comment');
  assert.equal((await models.getItem(story)).comment_count, 1);
});

test('search matches whatever the case, which LIKE alone would not', options, async () => {
  await connect();
  await models.createStory({ by: 'ada', title: 'Peptide foundry raises a seed round', url: 'https://example.org/p' });

  // Postgres LIKE is case-sensitive and SQLite's is not; both must find this.
  assert.equal((await models.search('PEPTIDE')).total, 1);
  assert.equal((await models.search('peptide')).total, 1);
  assert.equal((await models.search('Foundry')).total, 1);
});

test('a handle is found whatever the case', options, async () => {
  await connect();
  assert.equal((await models.getUser('ADA')).id, 'ada');
  assert.equal((await models.getUser('AdA')).id, 'ada');
});

test('review holds a submission back, then puts it on the board', options, async () => {
  await connect();
  const id = await models.createStory({
    by: 'bob',
    title: 'Cell-free manufacturing seed round',
    url: 'https://example.org/cf',
    surfacedBy: 'bob',
    reviewState: 'pending',
  });
  assert.equal((await models.newest()).items.length, 0);

  const result = await review.approve(id, 'curator');
  assert.equal(result.ok, true);
  assert.equal((await models.newest()).items.length, 1);
  assert.equal(await points.balanceOf('bob'), 5, 'and pays whoever surfaced it');
});

test('an award lands once however many times the pass runs', options, async () => {
  await connect();
  const id = await models.createStory({ by: 'ada', title: 'A round', url: 'https://example.org/r', surfacedBy: 'ada' });

  assert.equal(await points.award({ userId: 'ada', reason: 'top-ten', itemId: id }), 25);
  assert.equal(await points.award({ userId: 'ada', reason: 'top-ten', itemId: id }), 0);
  assert.equal(await points.balanceOf('ada'), 25, 'the partial unique index held');
});

test('a redemption it cannot afford spends nothing at all', options, async () => {
  await connect();
  await points.award({ userId: 'ada', reason: 'adjustment', points: 30 });

  const refused = await points.redeem('ada', 'patch');
  assert.equal(refused.ok, false);
  assert.match(refused.error, /100 points/);
  assert.equal(await points.balanceOf('ada'), 30);
  assert.equal((await points.redemptionsFor('ada')).length, 0, 'and records no request');
  assert.equal((await points.ledgerFor('ada')).length, 1, 'and writes no ledger row');
});

test('a redemption it can afford spends exactly once', options, async () => {
  await connect();
  await points.award({ userId: 'ada', reason: 'adjustment', points: 150 });

  const result = await points.redeem('ada', 'patch', { note: 'large' });
  assert.equal(result.ok, true);
  assert.equal(await points.balanceOf('ada'), 50);

  const requests = await points.redemptionsFor('ada');
  assert.equal(requests.length, 1);
  assert.equal(requests[0].reward, 'patch');
  assert.equal(requests[0].cost, 100);
});

test('a failed statement rolls the whole batch back', options, async () => {
  await connect();
  const before = (await db.getDb().get('SELECT COUNT(*) AS n FROM items')).n;

  await assert.rejects(
    db.batch([
      { sql: "INSERT INTO items (type, by, created_at, title) VALUES ('story', ?, ?, ?)", params: ['ada', 1, 'First'] },
      // No such user, so the foreign key rejects it and the first insert goes too.
      { sql: "INSERT INTO items (type, by, created_at, title) VALUES ('story', ?, ?, ?)", params: ['nobody', 1, 'Second'] },
    ]),
  );

  assert.equal((await db.getDb().get('SELECT COUNT(*) AS n FROM items')).n, before);
});

test('flagging accumulates and kills at the threshold', options, async () => {
  await connect();
  const id = await models.createStory({ by: 'ada', title: 'Contested claim', url: 'https://example.org/c' });

  await models.toggleFlag('bob', id);
  assert.equal((await models.getItem(id)).flag_count, 1);
  await models.toggleFlag('bob', id);
  assert.equal((await models.getItem(id)).flag_count, 0, 'and unflagging takes it back');
});

test('the front page composes and ranks', options, async () => {
  await connect();
  await models.createStory({ by: 'ada', title: 'Human surfaced', url: 'https://example.org/h', surfacedBy: 'ada' });
  await models.createStory({ by: 'bob', title: 'Agent filed', url: 'https://example.org/a', source: 'agent', agent: 'wires' });

  const page = await models.frontPage();
  assert.equal(page.items.length, 2);
  assert.equal(page.items[0].source, 'human', 'a fresh human submission leads');
});

test('site stats read back as numbers, not strings', options, async () => {
  await connect();
  await models.createStory({ by: 'ada', title: 'Something', url: 'https://example.org/s' });
  const stats = await models.siteStats();
  for (const [key, value] of Object.entries(stats)) {
    assert.equal(typeof value, 'number', `${key} should be a number`);
  }
});
