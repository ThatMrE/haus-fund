process.env.BIOPUNK_DB = ':memory:';
process.env.BIOPUNK_SECRET = 'test-secret';

import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { getDb } from '../app/db.js';
import { handle } from '../app/app.js';
import { resetRateLimits } from '../app/http.js';

getDb();

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

async function signUp(handleName) {
  // Signups are IP rate limited and every test shares 127.0.0.1.
  resetRateLimits();
  const call = agent();
  const res = await call('/login', form({ mode: 'signup', id: handleName, password: 'a-good-passphrase', next: '/' }));
  assert.equal(res.status, 303);
  return { call, csrf: await csrfFor(call) };
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
