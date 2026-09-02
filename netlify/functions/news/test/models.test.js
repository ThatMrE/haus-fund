process.env.BIOPUNK_DB = ':memory:';

import test from 'node:test';
import assert from 'node:assert/strict';
import { initDb, getDb } from '../app/db/index.js';
import { hashPassword, verifyPassword, csrfToken, checkCsrf, validateUsername, validatePassword } from '../app/auth.js';
import * as db from '../app/models.js';

await initDb();

async function user(id) {
  return (await db.getUser(id)) ?? (await db.createUser({ id, passwordHash: hashPassword(`${id}-pw`) }));
}

test('passwords hash and verify, and reject wrong input', async () => {
  const stored = hashPassword('correct horse battery');
  assert.ok(verifyPassword('correct horse battery', stored));
  assert.ok(!verifyPassword('wrong', stored));
  assert.ok(!verifyPassword('correct horse battery', 'garbage'));
  assert.notEqual(stored, hashPassword('correct horse battery'), 'salted, so hashes differ');
});

test('CSRF tokens are bound to a session and constant-time compared', async () => {
  const token = csrfToken('session-abc');
  assert.equal(token.length, 32);
  assert.ok(checkCsrf('session-abc', token));
  assert.ok(!checkCsrf('session-xyz', token));
  assert.ok(!checkCsrf('session-abc', 'short'));
  assert.ok(!checkCsrf('', ''));
});

test('handle and passphrase validation', async () => {
  assert.equal(validateUsername('helix_witch'), null);
  assert.ok(validateUsername('a'));
  assert.ok(validateUsername('has spaces'));
  assert.ok(validateUsername('12345'));
  assert.equal(validatePassword('longenough1'), null);
  assert.ok(validatePassword('short'));
});

test('a new story starts at one point with a seed vote from its author', async () => {
  await user('ann');
  const id = await db.createStory({ by: 'ann', title: 'A cheap turbidostat', url: 'https://example.org/t', topic: 'hardware' });
  const item = await db.getItem(id);
  assert.equal(item.points, 1);
  assert.equal(item.domain, 'example.org');
  assert.equal(item.story_id, id);
  assert.ok(await db.hasVoted('ann', id));
});

test('voting adds a point and karma; self-voting is refused', async () => {
  await user('ann');
  await user('bob');
  const id = await db.createStory({ by: 'ann', title: 'Base editing readout', url: 'https://example.org/be' });
  const before = (await db.getUser('ann')).karma;

  assert.equal((await db.vote('bob', id)).points, 2);
  assert.equal((await db.getUser('ann')).karma, before + 1);

  const repeat = await db.vote('bob', id);
  assert.equal(repeat.points, 2, 'voting twice is idempotent');

  const own = await db.vote('ann', id);
  assert.equal(own.ok, false);
  assert.match(own.error, /own post/);
});

test('unvoting removes the point and the karma again', async () => {
  await user('ann');
  await user('cat');
  const id = await db.createStory({ by: 'ann', title: 'Droplet evolution', url: 'https://example.org/d' });
  await db.vote('cat', id);
  const karma = (await db.getUser('ann')).karma;

  const result = await db.unvote('cat', id);
  assert.equal(result.points, 1);
  assert.equal(result.voted, false);
  assert.equal((await db.getUser('ann')).karma, karma - 1);
  assert.ok(!await db.hasVoted('cat', id));
});

test('votedItemIds reports a page of votes in one call', async () => {
  await user('dee');
  const a = await db.createStory({ by: 'ann', title: 'Story A for votes', url: 'https://example.org/a1' });
  const b = await db.createStory({ by: 'ann', title: 'Story B for votes', url: 'https://example.org/b1' });
  await db.vote('dee', a);
  const voted = await db.votedItemIds('dee', [a, b]);
  assert.ok(voted.has(a));
  assert.ok(!voted.has(b));
  assert.equal((await db.votedItemIds(null, [a, b])).size, 0);
});

test('comments nest, count against the story, and keep a story_id', async () => {
  await user('ann');
  await user('bob');
  const story = await db.createStory({ by: 'ann', title: 'Thread root story', url: 'https://example.org/root' });
  const top = await db.createComment({ by: 'bob', parentId: story, text: 'first' });
  const reply = await db.createComment({ by: 'ann', parentId: top, text: 'second' });

  assert.equal((await db.getItem(story)).comment_count, 2);
  assert.equal((await db.getItem(reply)).story_id, story);
  assert.equal((await db.getItem(reply)).depth, 1);

  const tree = await db.commentTree(story);
  assert.deepEqual(tree.map((c) => c.id), [top, reply]);
  assert.deepEqual(tree.map((c) => c.depth), [0, 1]);
});

test('deleting a comment soft-deletes it and decrements the story count', async () => {
  await user('ann');
  const story = await db.createStory({ by: 'ann', title: 'Deletion test story', url: 'https://example.org/del' });
  const comment = await db.createComment({ by: 'ann', parentId: story, text: 'oops' });
  await db.deleteItem(comment);
  assert.equal((await db.getItem(comment)).deleted, 1);
  assert.equal((await db.getItem(story)).comment_count, 0);
});

test('edits are allowed inside the window and blocked outside it', async () => {
  const author = await user('ann');
  const stranger = await user('bob');
  const id = await db.createStory({ by: 'ann', title: 'Editable story here', url: 'https://example.org/e' });
  const item = await db.getItem(id);

  assert.ok(db.canEdit(item, author));
  assert.ok(!db.canEdit(item, stranger));
  assert.ok(!db.canEdit(item, null));

  const stale = { ...item, created_at: item.created_at - db.EDIT_WINDOW - 10 };
  assert.ok(!db.canEdit(stale, author));

  await db.editItem(id, { title: 'Edited title here', text: 'new body' });
  assert.equal((await db.getItem(id)).title, 'Edited title here');
  assert.ok((await db.getItem(id)).edited_at);
});

test('flags accumulate and kill an item at the threshold', async () => {
  await user('ann');
  const id = await db.createStory({ by: 'ann', title: 'Flaggable submission', url: 'https://example.org/f' });
  for (let i = 0; i < db.FLAG_THRESHOLD; i++) {
    const flagger = `flagger${i}`;
    await user(flagger);
    await db.toggleFlag(flagger, id);
  }
  assert.equal((await db.getItem(id)).flag_count, db.FLAG_THRESHOLD);
  assert.equal((await db.getItem(id)).dead, 1);

  await db.toggleFlag('flagger0', id);
  assert.equal((await db.getItem(id)).dead, 0, 'unflagging back below the line revives it');
});

test('dead and deleted stories stay off the ranked front page', async () => {
  await user('ann');
  const live = await db.createStory({ by: 'ann', title: 'Live front page story', url: 'https://example.org/live' });
  const killed = await db.createStory({ by: 'ann', title: 'Killed front page story', url: 'https://example.org/dead' });
  await getDb().run('UPDATE items SET dead = 1 WHERE id = ?', killed);

  const ids = (await db.frontPage({ limit: 100 })).items.map((s) => s.id);
  assert.ok(ids.includes(live));
  assert.ok(!ids.includes(killed));
});

test('findByUrl catches a recent duplicate submission', async () => {
  await user('ann');
  const url = 'https://example.org/unique-link';
  const id = await db.createStory({ by: 'ann', title: 'Original submission', url });
  assert.equal((await db.findByUrl(url)).id, id);
  assert.equal(await db.findByUrl('https://example.org/never-posted'), null);
});

test('search matches titles, text and domains', async () => {
  await user('ann');
  await db.createStory({ by: 'ann', title: 'Mycelium composite panels', url: 'https://fungi-example.org/panels' });
  assert.ok((await db.search('mycelium')).total >= 1);
  assert.ok((await db.search('fungi-example.org')).total >= 1);
  assert.equal((await db.search('zzz-no-such-token')).total, 0);
});

test('search treats LIKE wildcards as literals', async () => {
  assert.equal((await db.search('%')).total, 0);
  assert.equal((await db.search('_')).total, 0);
});

test('favorites toggle on and off', async () => {
  await user('ann');
  await user('bob');
  const id = await db.createStory({ by: 'ann', title: 'Favourite this story', url: 'https://example.org/fav' });
  assert.equal((await db.toggleFavorite('bob', id)).favorited, true);
  assert.equal(await db.countFavorites('bob'), 1);
  assert.equal((await db.toggleFavorite('bob', id)).favorited, false);
  assert.equal(await db.countFavorites('bob'), 0);
});

test('topic slugs are validated against the channel list', async () => {
  assert.equal(db.normalizeTopic('synbio'), 'synbio');
  assert.equal(db.normalizeTopic('nonsense'), null);
  assert.equal(db.topicLabel('crispr'), 'Gene Editing');
});
