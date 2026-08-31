process.env.BIOPUNK_DB = ':memory:';

import test from 'node:test';
import assert from 'node:assert/strict';
import { getDb } from '../app/db.js';
import { hashPassword, verifyPassword, csrfToken, checkCsrf, validateUsername, validatePassword } from '../app/auth.js';
import * as db from '../app/models.js';

getDb();

function user(id) {
  return db.getUser(id) ?? db.createUser({ id, passwordHash: hashPassword(`${id}-pw`) });
}

test('passwords hash and verify, and reject wrong input', () => {
  const stored = hashPassword('correct horse battery');
  assert.ok(verifyPassword('correct horse battery', stored));
  assert.ok(!verifyPassword('wrong', stored));
  assert.ok(!verifyPassword('correct horse battery', 'garbage'));
  assert.notEqual(stored, hashPassword('correct horse battery'), 'salted, so hashes differ');
});

test('CSRF tokens are bound to a session and constant-time compared', () => {
  const token = csrfToken('session-abc');
  assert.equal(token.length, 32);
  assert.ok(checkCsrf('session-abc', token));
  assert.ok(!checkCsrf('session-xyz', token));
  assert.ok(!checkCsrf('session-abc', 'short'));
  assert.ok(!checkCsrf('', ''));
});

test('handle and passphrase validation', () => {
  assert.equal(validateUsername('helix_witch'), null);
  assert.ok(validateUsername('a'));
  assert.ok(validateUsername('has spaces'));
  assert.ok(validateUsername('12345'));
  assert.equal(validatePassword('longenough1'), null);
  assert.ok(validatePassword('short'));
});

test('a new story starts at one point with a seed vote from its author', () => {
  user('ann');
  const id = db.createStory({ by: 'ann', title: 'A cheap turbidostat', url: 'https://example.org/t', topic: 'hardware' });
  const item = db.getItem(id);
  assert.equal(item.points, 1);
  assert.equal(item.domain, 'example.org');
  assert.equal(item.story_id, id);
  assert.ok(db.hasVoted('ann', id));
});

test('voting adds a point and karma; self-voting is refused', () => {
  user('ann');
  user('bob');
  const id = db.createStory({ by: 'ann', title: 'Base editing readout', url: 'https://example.org/be' });
  const before = db.getUser('ann').karma;

  assert.equal(db.vote('bob', id).points, 2);
  assert.equal(db.getUser('ann').karma, before + 1);

  const repeat = db.vote('bob', id);
  assert.equal(repeat.points, 2, 'voting twice is idempotent');

  const own = db.vote('ann', id);
  assert.equal(own.ok, false);
  assert.match(own.error, /own post/);
});

test('unvoting removes the point and the karma again', () => {
  user('ann');
  user('cat');
  const id = db.createStory({ by: 'ann', title: 'Droplet evolution', url: 'https://example.org/d' });
  db.vote('cat', id);
  const karma = db.getUser('ann').karma;

  const result = db.unvote('cat', id);
  assert.equal(result.points, 1);
  assert.equal(result.voted, false);
  assert.equal(db.getUser('ann').karma, karma - 1);
  assert.ok(!db.hasVoted('cat', id));
});

test('votedItemIds reports a page of votes in one call', () => {
  user('dee');
  const a = db.createStory({ by: 'ann', title: 'Story A for votes', url: 'https://example.org/a1' });
  const b = db.createStory({ by: 'ann', title: 'Story B for votes', url: 'https://example.org/b1' });
  db.vote('dee', a);
  const voted = db.votedItemIds('dee', [a, b]);
  assert.ok(voted.has(a));
  assert.ok(!voted.has(b));
  assert.equal(db.votedItemIds(null, [a, b]).size, 0);
});

test('comments nest, count against the story, and keep a story_id', () => {
  user('ann');
  user('bob');
  const story = db.createStory({ by: 'ann', title: 'Thread root story', url: 'https://example.org/root' });
  const top = db.createComment({ by: 'bob', parentId: story, text: 'first' });
  const reply = db.createComment({ by: 'ann', parentId: top, text: 'second' });

  assert.equal(db.getItem(story).comment_count, 2);
  assert.equal(db.getItem(reply).story_id, story);
  assert.equal(db.getItem(reply).depth, 1);

  const tree = db.commentTree(story);
  assert.deepEqual(tree.map((c) => c.id), [top, reply]);
  assert.deepEqual(tree.map((c) => c.depth), [0, 1]);
});

test('deleting a comment soft-deletes it and decrements the story count', () => {
  user('ann');
  const story = db.createStory({ by: 'ann', title: 'Deletion test story', url: 'https://example.org/del' });
  const comment = db.createComment({ by: 'ann', parentId: story, text: 'oops' });
  db.deleteItem(comment);
  assert.equal(db.getItem(comment).deleted, 1);
  assert.equal(db.getItem(story).comment_count, 0);
});

test('edits are allowed inside the window and blocked outside it', () => {
  const author = user('ann');
  const stranger = user('bob');
  const id = db.createStory({ by: 'ann', title: 'Editable story here', url: 'https://example.org/e' });
  const item = db.getItem(id);

  assert.ok(db.canEdit(item, author));
  assert.ok(!db.canEdit(item, stranger));
  assert.ok(!db.canEdit(item, null));

  const stale = { ...item, created_at: item.created_at - db.EDIT_WINDOW - 10 };
  assert.ok(!db.canEdit(stale, author));

  db.editItem(id, { title: 'Edited title here', text: 'new body' });
  assert.equal(db.getItem(id).title, 'Edited title here');
  assert.ok(db.getItem(id).edited_at);
});

test('flags accumulate and kill an item at the threshold', () => {
  user('ann');
  const id = db.createStory({ by: 'ann', title: 'Flaggable submission', url: 'https://example.org/f' });
  for (let i = 0; i < db.FLAG_THRESHOLD; i++) {
    const flagger = `flagger${i}`;
    user(flagger);
    db.toggleFlag(flagger, id);
  }
  assert.equal(db.getItem(id).flag_count, db.FLAG_THRESHOLD);
  assert.equal(db.getItem(id).dead, 1);

  db.toggleFlag('flagger0', id);
  assert.equal(db.getItem(id).dead, 0, 'unflagging back below the line revives it');
});

test('dead and deleted stories stay off the ranked front page', () => {
  user('ann');
  const live = db.createStory({ by: 'ann', title: 'Live front page story', url: 'https://example.org/live' });
  const killed = db.createStory({ by: 'ann', title: 'Killed front page story', url: 'https://example.org/dead' });
  getDb().prepare('UPDATE items SET dead = 1 WHERE id = ?').run(killed);

  const ids = db.frontPage({ limit: 100 }).items.map((s) => s.id);
  assert.ok(ids.includes(live));
  assert.ok(!ids.includes(killed));
});

test('findByUrl catches a recent duplicate submission', () => {
  user('ann');
  const url = 'https://example.org/unique-link';
  const id = db.createStory({ by: 'ann', title: 'Original submission', url });
  assert.equal(db.findByUrl(url).id, id);
  assert.equal(db.findByUrl('https://example.org/never-posted'), null);
});

test('search matches titles, text and domains', () => {
  user('ann');
  db.createStory({ by: 'ann', title: 'Mycelium composite panels', url: 'https://fungi-example.org/panels' });
  assert.ok(db.search('mycelium').total >= 1);
  assert.ok(db.search('fungi-example.org').total >= 1);
  assert.equal(db.search('zzz-no-such-token').total, 0);
});

test('search treats LIKE wildcards as literals', () => {
  assert.equal(db.search('%').total, 0);
  assert.equal(db.search('_').total, 0);
});

test('favorites toggle on and off', () => {
  user('ann');
  user('bob');
  const id = db.createStory({ by: 'ann', title: 'Favourite this story', url: 'https://example.org/fav' });
  assert.equal(db.toggleFavorite('bob', id).favorited, true);
  assert.equal(db.countFavorites('bob'), 1);
  assert.equal(db.toggleFavorite('bob', id).favorited, false);
  assert.equal(db.countFavorites('bob'), 0);
});

test('topic slugs are validated against the channel list', () => {
  assert.equal(db.normalizeTopic('synbio'), 'synbio');
  assert.equal(db.normalizeTopic('nonsense'), null);
  assert.equal(db.topicLabel('crispr'), 'Gene Editing');
});
