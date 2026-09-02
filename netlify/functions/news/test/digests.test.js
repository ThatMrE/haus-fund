process.env.BIOPUNK_DB = ':memory:';

import test from 'node:test';
import assert from 'node:assert/strict';
import { initDb, getDb } from '../app/db/index.js';
import * as db from '../app/models.js';
import * as digests from '../app/digests.js';
import * as points from '../app/points.js';
import { hashPassword } from '../app/auth.js';
import { composeFrontPage, mixOf } from '../app/rank.js';

await initDb();

const NOW = 1_780_000_000;
let seq = 0;

async function member(id) {
  return (await db.getUser(id)) ?? (await db.createUser({ id, passwordHash: hashPassword(`${id}-pw`) }));
}

async function story(by, { points: score = 1, source = 'human', at = NOW - 3600 } = {}) {
  seq += 1;
  const id = await db.createStory({
    by,
    title: `Item ${seq}`,
    url: `https://example.org/${seq}`,
    source,
    surfacedBy: source === 'human' ? by : null,
    agent: source === 'agent' ? 'wires' : null,
  });
  await getDb().run('UPDATE items SET points = ?, created_at = ? WHERE id = ?', score, at, id);
  return id;
}

test('an issue covers its window and lists the top items in order', async () => {
  await member('nia');
  const top = await story('nia', { points: 90 });
  const mid = await story('nia', { points: 40 });
  await story('nia', { points: 2, at: NOW - 40 * 86400 });

  const { digest, created } = await digests.buildDigest('bench-notes', { now: NOW });
  assert.equal(created, true);
  const items = await digests.itemsOf(digest);
  assert.deepEqual(items.slice(0, 2).map((i) => i.id), [top, mid]);
  assert.ok(!items.some((i) => i.created_at < NOW - 86400), 'nothing from outside the window');
});

test('building the same issue twice does not make a second one', async () => {
  const first = await digests.buildDigest('bench-notes', { now: NOW });
  const second = await digests.buildDigest('bench-notes', { now: NOW });
  assert.equal(second.created, false);
  assert.equal(second.digest.id, first.digest.id);
});

test('weekly issues are slugged by ISO week, daily ones by date', async () => {
  const daily = digests.windowFor('bench-notes', { now: NOW, timeZone: 'UTC' });
  const weekly = digests.windowFor('field-notes', { now: NOW, timeZone: 'UTC' });
  assert.match(daily.slug, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(weekly.slug, /^\d{4}-w\d{2}$/);
  assert.equal(daily.to - daily.from, 86400);
  assert.equal(weekly.to - weekly.from, 7 * 86400);
});

test('opening Biopunk Live pays the scouts whose items made the ten', async () => {
  await member('oli');
  const id = await story('oli', { points: 120 });

  await digests.buildDigest('live', { now: NOW });
  const ledger = await points.ledgerFor('oli');
  const entry = ledger.find((row) => row.reason === 'top-ten' && row.item_id === id);
  assert.ok(entry, 'the scout is paid for the item');
  assert.equal(entry.delta, 25);

  await digests.buildDigest('live', { now: NOW, force: true });
  const again = (await points.ledgerFor('oli')).filter((r) => r.reason === 'top-ten' && r.item_id === id);
  assert.equal(again.length, 1, 'rebuilding the issue does not pay twice');
});

test('an empty window produces no issue at all', async () => {
  const result = await digests.buildDigest('field-notes', { now: NOW - 400 * 86400 });
  assert.equal(result.empty, true);
  assert.equal(result.digest, null);
});

/* ------------------------------------------------------------- the mix */

const mk = (id, source, tier = 1) => ({ id, source, tier, created_at: NOW, score: 1 });

test('the front page holds close to half agent items', async () => {
  const ranked = [
    ...Array.from({ length: 40 }, (_, i) => mk(100 + i, 'agent')),
    ...Array.from({ length: 40 }, (_, i) => mk(200 + i, 'human')),
  ];
  const page = composeFrontPage(ranked).slice(0, 30);
  const mix = mixOf(page);
  assert.equal(mix.agent, 15);
  assert.equal(mix.human, 15);
});

test('the agents do not take the page when few people have posted', async () => {
  const ranked = [
    ...Array.from({ length: 40 }, (_, i) => mk(100 + i, 'agent')),
    mk(200, 'human'),
    mk(201, 'human'),
  ];
  const page = composeFrontPage(ranked).slice(0, 10);
  assert.equal(mixOf(page).human, 2, 'both people-surfaced items are on the first page');
  assert.equal(page[0].source, 'human', 'and one of them opens it');
});

test('a fresh human submission still leads outright', async () => {
  const ranked = [
    mk(1, 'human', 0),
    mk(2, 'human', 0),
    ...Array.from({ length: 20 }, (_, i) => mk(100 + i, 'agent')),
  ];
  assert.deepEqual(composeFrontPage(ranked).slice(0, 2).map((i) => i.id), [1, 2]);
});

test('with nothing from people the page is still full', async () => {
  const ranked = Array.from({ length: 12 }, (_, i) => mk(100 + i, 'agent'));
  assert.equal(composeFrontPage(ranked).length, 12);
});
