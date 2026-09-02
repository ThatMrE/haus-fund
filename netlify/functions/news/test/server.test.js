process.env.BIOPUNK_DB = ':memory:';
process.env.BIOPUNK_SECRET = 'test-secret';

import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { initDb, getDb } from '../app/db/index.js';
import { handle } from '../app/app.js';
import { resetRateLimits } from '../app/http.js';

await initDb();

let server;
let base;

before(async () => {
  server = createServer((req, res) => handle(req, res));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

/** Minimal cookie-jar fetch. */
function agent() {
  const jar = new Map();
  return async function call(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (jar.size) headers.set('cookie', [...jar].map(([k, v]) => `${k}=${v}`).join('; '));
    const res = await fetch(base + path, { ...options, headers, redirect: 'manual' });
    for (const raw of res.headers.getSetCookie?.() ?? []) {
      const [pair] = raw.split(';');
      const idx = pair.indexOf('=');
      const value = pair.slice(idx + 1);
      if (value) jar.set(pair.slice(0, idx), value);
      else jar.delete(pair.slice(0, idx));
    }
    return res;
  };
}

function form(fields) {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields).toString(),
  };
}

async function csrfFor(call) {
  const html = await (await call('/')).text();
  return /name="csrf-token" content="([a-f0-9]*)"/.exec(html)?.[1] ?? '';
}

async function signUp(handleName, { trusted = true } = {}) {
  // Signups are IP rate limited and every test shares 127.0.0.1.
  resetRateLimits();
  const call = agent();
  const res = await call('/login', form({ mode: 'signup', id: handleName, password: 'a-good-passphrase', next: '/' }));
  assert.equal(res.status, 303);
  // Most tests are about submitting, voting and commenting, not about the
  // review gate; trusting the account keeps the gate out of their way. The
  // gate has its own tests below.
  if (trusted) await getDb().run('UPDATE users SET trusted = 1 WHERE id = ?', handleName);
  return { call, csrf: await csrfFor(call) };
}

/**
 * The id of a specific queued item. Taking the first id on the page would make
 * a test depend on what earlier tests left in the queue.
 */
function queuedId(queueHtml, titleFragment) {
  const blocks = queueHtml.split('<li class="queue-item">').slice(1);
  const block = blocks.find((b) => b.includes(titleFragment));
  assert.ok(block, `expected ${titleFragment} in the queue`);
  return Number(/name="id" value="(\d+)"/.exec(block)[1]);
}

async function makeReviewer(handleName) {
  const session = await signUp(handleName);
  await getDb().run('UPDATE users SET is_admin = 1 WHERE id = ?', handleName);
  return session;
}

test('public pages render', async () => {
  for (const path of ['/', '/newest', '/best', '/ask', '/show', '/comments', '/topics', '/about', '/guidelines', '/api', '/search', '/login']) {
    const res = await fetch(base + path);
    assert.equal(res.status, 200, `${path} should render`);
    assert.match(res.headers.get('content-type'), /text\/html/);
  }
});

test('unknown paths 404', async () => {
  assert.equal((await fetch(`${base}/no-such-page`)).status, 404);
});

test('anonymous users are redirected to log in before submitting', async () => {
  const res = await fetch(`${base}/submit`, { redirect: 'manual' });
  assert.equal(res.status, 303);
  assert.match(res.headers.get('location'), /^\/login\?next=/);
});

test('signup, submit, upvote and comment end to end', async () => {
  const author = await signUp('mycelium_test');

  const submit = await author.call(
    '/submit',
    form({ csrf: author.csrf, title: 'Show BN: a bench turbidostat', url: 'https://example.org/turbidostat', topic: 'hardware' }),
  );
  assert.equal(submit.status, 303);
  const id = Number(/id=(\d+)/.exec(submit.headers.get('location'))[1]);

  const itemPage = await (await author.call(`/item?id=${id}`)).text();
  assert.match(itemPage, /bench turbidostat/);
  assert.match(itemPage, /1 point/);
  assert.match(itemPage, /Show BN/);

  const voter = await signUp('voter_test');
  const vote = await voter.call('/api/vote', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-csrf-token': voter.csrf },
    body: JSON.stringify({ id, dir: 'up' }),
  });
  assert.deepEqual(await vote.json(), { ok: true, points: 2, voted: true });

  const unvote = await voter.call('/api/vote', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-csrf-token': voter.csrf },
    body: JSON.stringify({ id, dir: 'down' }),
  });
  assert.equal((await unvote.json()).points, 1);

  const comment = await voter.call('/comment', form({ csrf: voter.csrf, parent: id, text: 'What is the OD range?' }));
  assert.equal(comment.status, 303);
  assert.match(await (await fetch(`${base}/item?id=${id}`)).text(), /What is the OD range\?/);
});

test('a submission needs a URL or text, and rejects a bad URL', async () => {
  const me = await signUp('validator_test');
  const noBody = await me.call('/submit', form({ csrf: me.csrf, title: 'A title with nothing else' }));
  assert.equal(noBody.status, 400);
  assert.match(await noBody.text(), /Supply a URL or some text/);

  const badUrl = await me.call('/submit', form({ csrf: me.csrf, title: 'Definitely a bad URL', url: 'javascript:alert(1)' }));
  assert.equal(badUrl.status, 400);
  assert.match(await badUrl.text(), /does not parse/);

  const both = await me.call('/submit', form({ csrf: me.csrf, title: 'Both url and text', url: 'https://example.org/x', text: 'hi' }));
  assert.equal(both.status, 400);
});

test('a duplicate link redirects to the existing discussion', async () => {
  const first = await signUp('dupe_one_test');
  const url = 'https://example.org/the-same-preprint';
  const created = await first.call('/submit', form({ csrf: first.csrf, title: 'The original posting', url }));
  const id = Number(/id=(\d+)/.exec(created.headers.get('location'))[1]);

  const second = await signUp('dupe_two_test');
  const again = await second.call('/submit', form({ csrf: second.csrf, title: 'A reposted preprint', url }));
  assert.equal(again.headers.get('location'), `/item?id=${id}`);
});

test('form posts without a valid CSRF token are rejected', async () => {
  const me = await signUp('csrf_test');
  const res = await me.call('/submit', form({ csrf: 'not-the-token', title: 'Sneaky submission', url: 'https://example.org/csrf' }));
  assert.equal(res.status, 403);
});

test('the vote API refuses anonymous callers and self-votes', async () => {
  const anon = await fetch(`${base}/api/vote`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: 1, dir: 'up' }),
  });
  assert.equal(anon.status, 401);

  const me = await signUp('selfvote_test');
  const created = await me.call('/submit', form({ csrf: me.csrf, title: 'My own submission here', url: 'https://example.org/mine' }));
  const id = Number(/id=(\d+)/.exec(created.headers.get('location'))[1]);
  const res = await me.call('/api/vote', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-csrf-token': me.csrf },
    body: JSON.stringify({ id, dir: 'up' }),
  });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /own post/);
});

test('handles are unique and passphrases are checked', async () => {
  await signUp('taken_test');
  resetRateLimits();
  const dupe = agent();
  const res = await dupe('/login', form({ mode: 'signup', id: 'taken_test', password: 'another-passphrase' }));
  assert.equal(res.status, 400);
  assert.match(await res.text(), /handle is taken/);

  resetRateLimits();
  const wrong = agent();
  const bad = await wrong('/login', form({ mode: 'login', id: 'taken_test', password: 'wrong-passphrase' }));
  assert.equal(bad.status, 401);
});

test('the login next parameter cannot point off-site', async () => {
  const call = agent();
  const res = await call('/login', form({ mode: 'signup', id: 'redirect_test', password: 'a-good-passphrase', next: 'https://evil.example.com' }));
  assert.equal(res.headers.get('location'), '/');
});

test('logging out clears the session cookie', async () => {
  const me = await signUp('logout_test');
  const res = await me.call('/logout', form({ csrf: me.csrf }));
  assert.equal(res.status, 303);
  const page = await (await me.call('/')).text();
  assert.match(page, /Log in/);
});

test('titles are escaped rather than rendered as HTML', async () => {
  const me = await signUp('xss_test');
  const created = await me.call(
    '/submit',
    form({ csrf: me.csrf, title: '<img src=x onerror=alert(1)> exploit attempt', url: 'https://example.org/xss' }),
  );
  const id = Number(/id=(\d+)/.exec(created.headers.get('location'))[1]);
  const page = await (await fetch(`${base}/item?id=${id}`)).text();
  assert.match(page, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(page, /<img src=x onerror/);
});

test('the JSON API exposes stories, items, users and topics', async () => {
  const stories = await (await fetch(`${base}/api/stories?limit=5`)).json();
  assert.equal(stories.ok, true);
  assert.ok(Array.isArray(stories.stories));

  const first = stories.stories[0];
  const item = await (await fetch(`${base}/api/item/${first.id}`)).json();
  assert.equal(item.item.id, first.id);
  assert.ok(Array.isArray(item.item.comments));

  const user = await (await fetch(`${base}/api/user/${first.by}`)).json();
  assert.equal(user.user.id, first.by);
  assert.equal(user.user.password_hash, undefined, 'never leak the hash');

  const topics = await (await fetch(`${base}/api/topics`)).json();
  assert.ok(topics.topics.length > 0);

  assert.equal((await fetch(`${base}/api/item/999999`)).status, 404);
  assert.equal((await fetch(`${base}/api/search`)).status, 400);
});

test('RSS is well formed and served with the right type', async () => {
  const res = await fetch(`${base}/rss`);
  assert.match(res.headers.get('content-type'), /application\/rss\+xml/);
  const xml = await res.text();
  assert.match(xml, /<rss version="2\.0"/);
  assert.match(xml, /<title>Haus News<\/title>/);
});

test('static assets are served and traversal is refused', async () => {
  const css = await fetch(`${base}/static/style.css`);
  assert.equal(css.status, 200);
  assert.match(css.headers.get('content-type'), /text\/css/);

  const escape = await fetch(`${base}/static/../server.js`);
  assert.ok([403, 404].includes(escape.status), `expected a refusal, got ${escape.status}`);
});

test('write endpoints are rate limited', async () => {
  resetRateLimits();
  const me = await signUp('flood_test');
  let limited = false;
  for (let i = 0; i < 60; i++) {
    const res = await me.call('/api/vote', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csrf-token': me.csrf },
      body: JSON.stringify({ id: 1, dir: 'up' }),
    });
    if (res.status === 429) {
      limited = true;
      break;
    }
  }
  assert.ok(limited, 'the write rate limit should trip');
  resetRateLimits();
});

/* ------------------------------------------------------------ the review gate */

test('a new account’s submission waits for review instead of hitting the board', async () => {
  const newcomer = await signUp('fresh_scout', { trusted: false });

  const submit = await newcomer.call(
    '/submit',
    form({ csrf: newcomer.csrf, title: 'Peptide foundry spins out of Utrecht', url: 'https://example.org/utrecht' }),
  );
  assert.equal(submit.status, 303);
  assert.match(submit.headers.get('location'), /\/queue/, 'sent to their queue, not to the item');

  const front = await (await fetch(`${base}/newest`)).text();
  assert.doesNotMatch(front, /Utrecht/, 'a pending submission is not on the board');

  const queue = await (await newcomer.call('/queue')).text();
  assert.match(queue, /Utrecht/, 'but they can see it waiting');
});

test('a reviewer clears the queue and the item joins the board', async () => {
  const newcomer = await signUp('waiting_scout', { trusted: false });
  await newcomer.call(
    '/submit',
    form({ csrf: newcomer.csrf, title: 'Cell-free manufacturing seed round closes', url: 'https://example.org/cellfree' }),
  );

  const reviewer = await makeReviewer('editor_test');
  const queuePage = await (await reviewer.call('/review')).text();
  assert.match(queuePage, /Cell-free manufacturing/);

  const id = queuedId(queuePage, 'Cell-free manufacturing');
  const verdict = await reviewer.call('/review', form({ csrf: reviewer.csrf, id, verdict: 'approve' }));
  assert.equal(verdict.status, 303);

  const front = await (await fetch(`${base}/newest`)).text();
  assert.match(front, /Cell-free manufacturing/, 'approved items are on the board');
});

test('the queue is closed to members who are not reviewers', async () => {
  const member = await signUp('nosy_member');
  assert.equal((await member.call('/review')).status, 403);
});

test('clearing review pays the scout who surfaced it', async () => {
  const scout = await signUp('paid_scout', { trusted: false });
  await scout.call(
    '/submit',
    form({ csrf: scout.csrf, title: 'Enzymatic DNA synthesis startup emerges', url: 'https://example.org/enzymatic' }),
  );

  const reviewer = await makeReviewer('editor_two');
  const queuePage = await (await reviewer.call('/review')).text();
  const id = queuedId(queuePage, 'Enzymatic DNA synthesis');
  await reviewer.call('/review', form({ csrf: reviewer.csrf, id, verdict: 'approve' }));

  const ledger = await (await scout.call('/points')).text();
  assert.match(ledger, /cleared review/i);
  assert.match(ledger, /\+5/);
});

test('scouts and agents pages render', async () => {
  for (const path of ['/scouts', '/agents', '/bench-notes', '/field-notes', '/live']) {
    const res = await fetch(base + path);
    assert.equal(res.status, 200, `${path} should render`);
  }
});

/* ------------------------------------------------------------ channel intake */

test('channel intake refuses a wrong or missing token', async () => {
  process.env.NEWS_INTAKE_TOKEN = 'intake-secret';
  const body = JSON.stringify({ url: 'https://example.org/discord-1', title: 'A link from the Discord' });

  const anon = await fetch(`${base}/api/surface`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  });
  assert.equal(anon.status, 401);

  const wrong = await fetch(`${base}/api/surface`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer nope' },
    body,
  });
  assert.equal(wrong.status, 401);
});

test('a link from a channel enters the review queue with its credit intact', async () => {
  process.env.NEWS_INTAKE_TOKEN = 'intake-secret';
  await signUp('discord_scout');

  const res = await fetch(`${base}/api/surface`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer intake-secret' },
    body: JSON.stringify({
      url: 'https://example.org/from-discord',
      title: 'Bioreactor teardown posted in the Discord',
      handle: 'discord_scout',
      channel: 'Discord',
    }),
  });
  const payload = await res.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.state, 'pending', 'a channel is a shortcut for people, not around review');

  const item = await getDb().get('SELECT * FROM items WHERE id = ?', payload.id);
  assert.equal(item.surfaced_by, 'discord_scout');
  assert.equal(item.channel, 'Discord');
  assert.equal(item.source, 'human', 'a person found it, a bot only carried it');

  const front = await (await fetch(`${base}/newest`)).text();
  assert.doesNotMatch(front, /Bioreactor teardown/);
});

test('the same link twice from a channel is not two stories', async () => {
  process.env.NEWS_INTAKE_TOKEN = 'intake-secret';
  const send = () =>
    fetch(`${base}/api/surface`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer intake-secret' },
      body: JSON.stringify({ url: 'https://example.org/dupe-link', title: 'Posted twice in the channel' }),
    }).then((r) => r.json());

  const first = await send();
  const second = await send();
  assert.equal(second.id, first.id);
  assert.equal(second.state, 'duplicate');
});
