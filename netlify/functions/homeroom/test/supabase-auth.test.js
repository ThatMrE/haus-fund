/**
 * Homeroom's login, password reset and password change, with Supabase holding
 * the credential.
 *
 * WHY A STUB AND NOT THE REAL PROJECT
 *
 * These run against a local stand-in for GoTrue rather than a live Supabase
 * project, because a test suite that needs a network and somebody's API key is
 * a test suite that stops being run. The stub speaks the same wire protocol the
 * client speaks — the same paths, the same request bodies, the same error
 * shapes — so what is being proved here is that Homeroom's half is right: that
 * a wrong password fails, an outage is not mistaken for a wrong password, a
 * reset link actually invalidates old sessions, and a Supabase identity is
 * matched to the correct local row.
 *
 * What it cannot prove is that a particular project is configured correctly.
 * That is what /homeroom/health reports at runtime.
 */

process.env.HOMEROOM_DB = ':memory:';
process.env.HOMEROOM_SECRET = 'test-secret';
process.env.HOMEROOM_ACCESS = 'open';
process.env.HOMEROOM_AUTH = 'supabase';

import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { getDb } from '../app/db.js';
import { handle } from '../app/app.js';
import { resetRateLimits } from '../app/http.js';
import * as hr from '../app/models.js';
import * as sbAuth from '../app/supabase-auth.js';

getDb();

/* ========================================================== the GoTrue stub */

/**
 * Enough of GoTrue to exercise every path Homeroom takes through it.
 *
 * `state` is reachable from the tests so a scenario can switch confirmation on,
 * take the service offline, or read back what was actually stored.
 */
const state = {
  users: new Map(),        // email -> {id, email, password, handle, confirmed}
  tokens: new Map(),       // access token -> email
  recoveries: new Map(),   // token_hash -> email
  sent: [],                // recovery emails, for asserting on
  confirmationRequired: false,
  down: false,
  status: 500,
};

function reset() {
  state.users.clear();
  state.tokens.clear();
  state.recoveries.clear();
  state.sent.length = 0;
  state.confirmationRequired = false;
  state.down = false;
  state.status = 500;
}

const issue = (email) => {
  const token = `at-${randomUUID()}`;
  state.tokens.set(token, email);
  return token;
};

const publicUser = (u) => ({
  id: u.id,
  email: u.email,
  user_metadata: { handle: u.handle },
  email_confirmed_at: u.confirmed ? new Date().toISOString() : null,
  created_at: new Date().toISOString(),
});

const sessionFor = (u) => ({
  access_token: issue(u.email),
  refresh_token: `rt-${randomUUID()}`,
  expires_in: 3600,
  user: publicUser(u),
});

function bearer(req) {
  return String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
}

function gotrue(req, res) {
  const url = new URL(req.url, 'http://gotrue.local');
  const reply = (status, payload) => {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(payload));
  };

  if (state.down) return reply(state.status, { msg: 'upstream is unhappy' });

  let raw = '';
  req.on('data', (chunk) => { raw += chunk; });
  req.on('end', () => {
    const body = raw ? JSON.parse(raw) : {};
    const path = url.pathname.replace('/auth/v1', '');

    if (path === '/settings') {
      return reply(200, { disable_signup: false, mailer_autoconfirm: !state.confirmationRequired });
    }

    if (path === '/signup') {
      const email = String(body.email || '').toLowerCase();
      if (state.users.has(email)) return reply(422, { msg: 'User already registered' });
      if (String(body.password || '').length < 6) {
        return reply(422, { msg: 'Password should be at least 6 characters' });
      }
      const user = {
        id: randomUUID(),
        email,
        password: body.password,
        handle: body.data?.handle || '',
        confirmed: !state.confirmationRequired,
      };
      state.users.set(email, user);
      // With confirmation on, GoTrue returns the user and no session.
      return reply(200, state.confirmationRequired ? publicUser(user) : sessionFor(user));
    }

    if (path === '/token' && url.searchParams.get('grant_type') === 'password') {
      const user = state.users.get(String(body.email || '').toLowerCase());
      if (!user || user.password !== body.password) {
        return reply(400, { msg: 'Invalid login credentials' });
      }
      if (!user.confirmed) return reply(400, { msg: 'Email not confirmed' });
      return reply(200, sessionFor(user));
    }

    if (path === '/recover') {
      const email = String(body.email || '').toLowerCase();
      // Answers 200 whether or not the address exists — the behaviour Homeroom
      // relies on to keep this form from being an account-existence oracle.
      if (state.users.has(email)) {
        const tokenHash = `th-${randomUUID()}`;
        state.recoveries.set(tokenHash, email);
        state.sent.push({ email, tokenHash, redirectTo: url.searchParams.get('redirect_to') });
      }
      return reply(200, {});
    }

    if (path === '/verify') {
      const email = state.recoveries.get(body.token_hash);
      if (!email) return reply(401, { msg: 'Token has expired or is invalid' });
      state.recoveries.delete(body.token_hash); // single use, as the real one is
      return reply(200, sessionFor(state.users.get(email)));
    }

    if (path === '/user' && req.method === 'PUT') {
      const email = state.tokens.get(bearer(req));
      if (!email) return reply(401, { msg: 'invalid claim' });
      const user = state.users.get(email);
      if (body.password) user.password = body.password;
      return reply(200, publicUser(user));
    }

    if (path === '/user') {
      const email = state.tokens.get(bearer(req));
      if (!email) return reply(401, { msg: 'invalid claim' });
      return reply(200, publicUser(state.users.get(email)));
    }

    if (path === '/logout') {
      state.tokens.delete(bearer(req));
      return reply(204, {});
    }

    return reply(404, { msg: `stub has no ${req.method} ${path}` });
  });
}

/* ============================================================== the harness */

let gotrueServer;
let homeroom;
let base;

before(async () => {
  gotrueServer = createServer(gotrue);
  await new Promise((r) => gotrueServer.listen(0, '127.0.0.1', r));
  process.env.SUPABASE_URL = `http://127.0.0.1:${gotrueServer.address().port}`;
  process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';

  homeroom = createServer((req, res) => handle(req, res));
  await new Promise((r) => homeroom.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${homeroom.address().port}`;
});

after(() => {
  gotrueServer.close();
  homeroom.close();
});

beforeEach(() => {
  reset();
  resetRateLimits();
});

function agent() {
  const jar = new Map();
  return async function call(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (jar.size) headers.set('cookie', [...jar].map(([k, v]) => `${k}=${v}`).join('; '));
    const res = await fetch(base + path, { ...options, headers, redirect: 'manual' });
    for (const cookie of res.headers.getSetCookie?.() ?? []) {
      const [pair] = cookie.split(';');
      const idx = pair.indexOf('=');
      const value = pair.slice(idx + 1);
      if (value) jar.set(pair.slice(0, idx), value);
      else jar.delete(pair.slice(0, idx));
    }
    return res;
  };
}

const form = (fields) => ({
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams(fields).toString(),
});

async function csrfFor(call, path = '/homeroom/login') {
  const html = await (await call(path)).text();
  return /name="csrf-token" content="([a-f0-9]*)"/.exec(html)?.[1] ?? '';
}

/** A distinct address per test, since one database is shared across them. */
let n = 0;
const addressFor = (name) => `${name}${++n}@example.org`;

async function signUp(call, { email, password = 'a-good-passphrase', handle: h }) {
  const csrf = await csrfFor(call, '/homeroom/signup');
  return call('/homeroom/signup', form({
    csrf, handle: h || `u${n}`, email, password,
  }));
}

async function signIn(call, { email, password }) {
  const csrf = await csrfFor(call, '/homeroom/login');
  return call('/homeroom/login', form({ csrf, email, password }));
}

/* ================================================================== signup */

test('signup creates the Supabase credential and a local row linked to it', async () => {
  const call = agent();
  const email = addressFor('ada');

  const res = await signUp(call, { email, handle: 'ada' });
  assert.equal(res.status, 303, 'should sign in straight away');

  assert.ok(state.users.has(email), 'Supabase should hold the credential');
  const account = hr.getUserByEmail(email);
  assert.ok(account, 'Homeroom should hold the identity');
  assert.equal(account.supabase_id, state.users.get(email).id, 'the two should be linked');
});

test('the password is never stored in Homeroom', async () => {
  const call = agent();
  const email = addressFor('nostore');
  await signUp(call, { email, handle: 'nostore' });

  const account = hr.getUserByEmail(email);
  const { verifyPassword } = await import('../app/auth.js');
  assert.ok(!verifyPassword('a-good-passphrase', account.password_hash),
    'the local hash must not be the real password');
});

test('the handle chosen at signup rides along to Supabase', async () => {
  const call = agent();
  const email = addressFor('handled');
  await signUp(call, { email, handle: 'handled' });
  assert.equal(state.users.get(email).handle, 'handled');
});

test('an address Supabase already knows is refused, without confirming it exists', async () => {
  const email = addressFor('twice');
  await signUp(agent(), { email, handle: 'twicea' });

  // A second Homeroom account, same address. Homeroom's own check catches this
  // first; the point is that the message gives nothing away either way.
  const res = await signUp(agent(), { email, handle: 'twiceb' });
  const html = await res.text();
  assert.equal(res.status, 400);
  assert.match(html, /cannot be used/i);
  assert.doesNotMatch(html, /already registered/i);
});

test('with confirmation required, signup says so instead of failing a login', async () => {
  state.confirmationRequired = true;
  const call = agent();
  const email = addressFor('unconfirmed');

  const res = await signUp(call, { email, handle: 'unconf' });
  assert.equal(res.status, 200);
  assert.match(await res.text(), /Confirm your email/i);

  // The account exists on both sides; it simply has no key yet.
  assert.ok(state.users.has(email));
  assert.ok(hr.getUserByEmail(email));
});

/* =================================================================== login */

test('the right password signs in', async () => {
  const email = addressFor('gooduser');
  await signUp(agent(), { email, handle: 'gooduser' });

  const call = agent();
  const res = await signIn(call, { email, password: 'a-good-passphrase' });
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), '/homeroom');
});

test('the wrong password does not', async () => {
  const email = addressFor('baduser');
  await signUp(agent(), { email, handle: 'baduser' });

  const res = await signIn(agent(), { email, password: 'not-the-passphrase' });
  assert.equal(res.status, 401);
  assert.match(await res.text(), /email or password is wrong|do not match/i);
});

test('an unknown address fails the same way as a wrong password', async () => {
  const res = await signIn(agent(), { email: 'nobody@example.org', password: 'a-good-passphrase' });
  assert.equal(res.status, 401);
  assert.doesNotMatch(await res.text(), /no such|not found|unknown/i);
});

test('an outage is reported as an outage, not as a wrong password', async () => {
  const email = addressFor('outage');
  await signUp(agent(), { email, handle: 'outage' });

  state.down = true;
  const res = await signIn(agent(), { email, password: 'a-good-passphrase' });

  assert.equal(res.status, 503, 'a 500 from Supabase must not read as bad credentials');
  assert.match(await res.text(), /temporarily unavailable/i);
});

test('an unconfirmed account is told why it cannot sign in', async () => {
  state.confirmationRequired = true;
  const email = addressFor('waiting');
  await signUp(agent(), { email, handle: 'waiting' });

  const res = await signIn(agent(), { email, password: 'a-good-passphrase' });
  assert.equal(res.status, 401);
  assert.match(await res.text(), /not been confirmed/i);
});

/* ================================================== linking to a local row */

test('a credential made outside Homeroom gets a local row on first login', async () => {
  // The dashboard case: somebody creates the user in Supabase directly.
  const email = addressFor('dashboard');
  state.users.set(email, {
    id: randomUUID(), email, password: 'a-good-passphrase', handle: '', confirmed: true,
  });
  assert.equal(hr.getUserByEmail(email), null, 'no local row yet');

  const res = await signIn(agent(), { email, password: 'a-good-passphrase' });
  assert.equal(res.status, 303);

  const account = hr.getUserByEmail(email);
  assert.ok(account, 'the login should have created one');
  assert.equal(account.supabase_id, state.users.get(email).id);
  assert.ok(account.id.startsWith('dashboard'), `handle derived from the address, got ${account.id}`);
});

test('an account that predates Supabase adopts the credential once', async () => {
  const email = addressFor('legacy');
  const { hashPassword } = await import('../app/auth.js');
  hr.createUser({ id: 'legacyfolk', email, passwordHash: hashPassword('the-old-local-password') });
  hr.ensureMember('legacyfolk', { name: 'Legacy' });

  state.users.set(email, {
    id: randomUUID(), email, password: 'the-new-supabase-password', handle: '', confirmed: true,
  });

  const res = await signIn(agent(), { email, password: 'the-new-supabase-password' });
  assert.equal(res.status, 303);
  assert.equal(hr.getUser('legacyfolk').supabase_id, state.users.get(email).id,
    'should link rather than create a second account');
});

test('a Supabase identity never takes over a row that is already claimed', async () => {
  const email = addressFor('contested');
  const { hashPassword } = await import('../app/auth.js');
  hr.createUser({ id: 'incumbent', email, passwordHash: hashPassword('whatever-it-was') });
  hr.linkSupabaseId('incumbent', 'some-other-supabase-uuid');

  state.users.set(email, {
    id: randomUUID(), email, password: 'a-good-passphrase', handle: '', confirmed: true,
  });

  const res = await signIn(agent(), { email, password: 'a-good-passphrase' });
  assert.equal(res.status, 409, 'the collision must be refused, not resolved by guessing');
  assert.equal(hr.getUser('incumbent').supabase_id, 'some-other-supabase-uuid', 'unchanged');
});

test('a taken handle is derived around rather than colliding', async () => {
  const first = addressFor('samename');
  const second = addressFor('samename');
  for (const email of [first, second]) {
    state.users.set(email, {
      id: randomUUID(), email, password: 'a-good-passphrase', handle: 'twins', confirmed: true,
    });
  }
  await signIn(agent(), { email: first, password: 'a-good-passphrase' });
  await signIn(agent(), { email: second, password: 'a-good-passphrase' });

  assert.equal(hr.getUserByEmail(first).id, 'twins');
  assert.equal(hr.getUserByEmail(second).id, 'twins2');
});

/* ========================================================= password resets */

test('forgot asks Supabase to send the email, and points it back at Homeroom', async () => {
  const email = addressFor('forgetful');
  await signUp(agent(), { email, handle: 'forgetful' });

  const call = agent();
  const csrf = await csrfFor(call, '/homeroom/forgot');
  const res = await call('/homeroom/forgot', form({ csrf, email }));

  assert.equal(res.status, 200);
  assert.equal(state.sent.length, 1);
  assert.equal(state.sent[0].email, email);
  assert.match(state.sent[0].redirectTo, /\/homeroom\/reset$/);
});

test('forgot says the same thing for an address that has no account', async () => {
  const known = addressFor('known');
  await signUp(agent(), { email: known, handle: 'known' });

  const seen = [];
  for (const email of [known, 'stranger@example.org']) {
    const call = agent();
    const csrf = await csrfFor(call, '/homeroom/forgot');
    const res = await call('/homeroom/forgot', form({ csrf, email }));
    seen.push({ status: res.status, hasCheck: /Check your email/i.test(await res.text()) });
  }
  assert.deepEqual(seen[0], seen[1], 'the two must be indistinguishable');
  assert.equal(state.sent.length, 1, 'only the real one is actually mailed');
});

test('a reset completes through the token_hash link', async () => {
  const email = addressFor('resetme');
  await signUp(agent(), { email, handle: 'resetme' });

  const call = agent();
  let csrf = await csrfFor(call, '/homeroom/forgot');
  await call('/homeroom/forgot', form({ csrf, email }));
  const { tokenHash } = state.sent[0];

  csrf = await csrfFor(call, `/homeroom/reset?token_hash=${tokenHash}&type=recovery`);
  const res = await call('/homeroom/reset', form({
    csrf, token_hash: tokenHash, password: 'a-brand-new-passphrase', confirm: 'a-brand-new-passphrase',
  }));

  assert.equal(res.status, 200);
  assert.match(await res.text(), /Password saved/i);
  assert.equal(state.users.get(email).password, 'a-brand-new-passphrase');
});

test('a reset completes through the fragment link', async () => {
  // The implicit flow: the browser lifts the token out of location.hash and
  // posts it as a field, because a fragment never reaches the server.
  const email = addressFor('fragment');
  await signUp(agent(), { email, handle: 'fragment' });
  const accessToken = issue(email);

  const call = agent();
  const csrf = await csrfFor(call, '/homeroom/reset');
  const res = await call('/homeroom/reset', form({
    csrf, access_token: accessToken,
    password: 'through-the-fragment-door', confirm: 'through-the-fragment-door',
  }));

  assert.equal(res.status, 200);
  assert.equal(state.users.get(email).password, 'through-the-fragment-door');
});

test('the reset page carries the script that reads the fragment', async () => {
  const html = await (await agent()('/homeroom/reset')).text();
  assert.match(html, /access_token=/, 'should look for the token in the hash');
  assert.match(html, /history\.replaceState/, 'and wipe it from the address bar afterwards');
});

test('a reset with neither half of the link is refused', async () => {
  const call = agent();
  const csrf = await csrfFor(call, '/homeroom/reset');
  const res = await call('/homeroom/reset', form({
    csrf, password: 'no-token-at-all-here', confirm: 'no-token-at-all-here',
  }));
  assert.equal(res.status, 410);
});

test('a recovery token works once', async () => {
  const email = addressFor('once');
  await signUp(agent(), { email, handle: 'once' });

  const call = agent();
  let csrf = await csrfFor(call, '/homeroom/forgot');
  await call('/homeroom/forgot', form({ csrf, email }));
  const { tokenHash } = state.sent[0];

  csrf = await csrfFor(call, '/homeroom/reset');
  const first = await call('/homeroom/reset', form({
    csrf, token_hash: tokenHash, password: 'first-new-passphrase', confirm: 'first-new-passphrase',
  }));
  assert.equal(first.status, 200);

  const second = await call('/homeroom/reset', form({
    csrf, token_hash: tokenHash, password: 'second-new-passphrase', confirm: 'second-new-passphrase',
  }));
  assert.equal(second.status, 410, 'a replayed link must not work');
  assert.equal(state.users.get(email).password, 'first-new-passphrase');
});

test('a reset signs out the sessions that were already open', async () => {
  const email = addressFor('kicked');
  const signedIn = agent();
  await signUp(signedIn, { email, handle: 'kicked' });
  assert.equal((await signedIn('/homeroom/settings')).status, 200, 'signed in to begin with');

  const other = agent();
  let csrf = await csrfFor(other, '/homeroom/forgot');
  await other('/homeroom/forgot', form({ csrf, email }));
  const { tokenHash } = state.sent[0];
  csrf = await csrfFor(other, '/homeroom/reset');
  await other('/homeroom/reset', form({
    csrf, token_hash: tokenHash, password: 'someone-changed-this', confirm: 'someone-changed-this',
  }));

  const after = await signedIn('/homeroom/settings');
  assert.match(await after.text(), /Members only/i, 'the old session must be dead');
});

test('the two new passwords have to match, and have to be long enough', async () => {
  const call = agent();
  const csrf = await csrfFor(call, '/homeroom/reset');

  const mismatch = await call('/homeroom/reset', form({
    csrf, token_hash: 'anything', password: 'a-long-enough-one', confirm: 'a-different-one',
  }));
  assert.equal(mismatch.status, 400);
  assert.match(await mismatch.text(), /do not match/i);

  const short = await call('/homeroom/reset', form({
    csrf, token_hash: 'anything', password: 'short', confirm: 'short',
  }));
  assert.equal(short.status, 400);
  assert.match(await short.text(), /at least 10 characters/i);
});

/* ======================================================= changing it later */

test('a member can change their own password', async () => {
  const call = agent();
  const email = addressFor('rotator');
  await signUp(call, { email, handle: 'rotator' });

  const csrf = await csrfFor(call, '/homeroom/settings');
  const res = await call('/homeroom/password', form({
    csrf, current: 'a-good-passphrase',
    password: 'the-replacement-phrase', confirm: 'the-replacement-phrase',
  }));

  assert.equal(res.status, 303);
  assert.equal(state.users.get(email).password, 'the-replacement-phrase');
});

test('changing it needs the current one', async () => {
  const call = agent();
  const email = addressFor('guesser');
  await signUp(call, { email, handle: 'guesser' });

  const csrf = await csrfFor(call, '/homeroom/settings');
  const res = await call('/homeroom/password', form({
    csrf, current: 'not-the-current-one',
    password: 'the-replacement-phrase', confirm: 'the-replacement-phrase',
  }));

  assert.equal(res.status, 400);
  assert.match(await res.text(), /current password is wrong/i);
  assert.equal(state.users.get(email).password, 'a-good-passphrase', 'unchanged');
});

test('changing it leaves you signed in but ends every other session', async () => {
  const email = addressFor('staysin');
  const mine = agent();
  await signUp(mine, { email, handle: 'staysin' });

  const elsewhere = agent();
  await signIn(elsewhere, { email, password: 'a-good-passphrase' });
  assert.equal((await elsewhere('/homeroom/settings')).status, 200);

  const csrf = await csrfFor(mine, '/homeroom/settings');
  await mine('/homeroom/password', form({
    csrf, current: 'a-good-passphrase',
    password: 'a-fresh-new-passphrase', confirm: 'a-fresh-new-passphrase',
  }));

  assert.equal((await mine('/homeroom/settings')).status, 200, 'I stay signed in');
  assert.match(await (await elsewhere('/homeroom/settings')).text(), /Members only/i,
    'the other session does not');
});

test('a Supabase outage does not silently fail a password change', async () => {
  const call = agent();
  const email = addressFor('downed');
  await signUp(call, { email, handle: 'downed' });

  const csrf = await csrfFor(call, '/homeroom/settings');
  state.down = true;
  const res = await call('/homeroom/password', form({
    csrf, current: 'a-good-passphrase',
    password: 'the-replacement-phrase', confirm: 'the-replacement-phrase',
  }));

  assert.equal(res.status, 400);
  assert.match(await res.text(), /unreachable/i);
});

/* ================================================================== wiring */

test('configured() needs both the mode and a project', () => {
  assert.equal(sbAuth.configured(), true);

  const url = process.env.SUPABASE_URL;
  delete process.env.SUPABASE_URL;
  assert.equal(sbAuth.configured(), false, 'a missing project must fall back to local auth');
  process.env.SUPABASE_URL = url;

  process.env.HOMEROOM_AUTH = 'local';
  assert.equal(sbAuth.configured(), false);
  process.env.HOMEROOM_AUTH = 'supabase';
});

test('health reports the mode, reachability and whether confirmation is on', async () => {
  const ok = await sbAuth.health();
  assert.equal(ok.mode, 'supabase');
  assert.equal(ok.configured, true);
  assert.equal(ok.reachable, true);
  assert.equal(ok.confirmationRequired, false);

  state.confirmationRequired = true;
  assert.equal((await sbAuth.health()).confirmationRequired, true);

  state.down = true;
  const bad = await sbAuth.health();
  assert.equal(bad.reachable, false);
  assert.ok(bad.error, 'an unreachable project should say so');
});

test('health explains a mode set without a project, rather than just failing', async () => {
  const url = process.env.SUPABASE_URL;
  delete process.env.SUPABASE_URL;
  const result = await sbAuth.health();
  process.env.SUPABASE_URL = url;

  assert.equal(result.configured, false);
  assert.match(result.error, /SUPABASE_URL/);
  assert.match(result.error, /local accounts/);
});
