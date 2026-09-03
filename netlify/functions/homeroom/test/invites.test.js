/**
 * Onboarding by invite.
 *
 * The interesting assertions are the ones about a link being a credential: it
 * works once, it stops working when revoked, it cannot be guessed from what is
 * stored, and two people racing for the same one get exactly one account.
 *
 * Runs against the local fallback backend. `invites-supabase.test.js` runs the
 * same flow against a PostgREST stub, so both storage paths are covered.
 */

process.env.HOMEROOM_SECRET = 'test-secret';
process.env.HOMEROOM_ACCESS = 'closed';

import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { getDb } from '../app/db.js';
import { handle } from '../app/app.js';
import { resetRateLimits } from '../app/http.js';
import * as hr from '../app/models.js';
import * as invites from '../app/invites.js';
import { hashPassword, verifyPassword } from '../app/auth.js';

await getDb();

let server;
let base;

before(async () => {
  server = createServer((req, res) => handle(req, res));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());
beforeEach(() => resetRateLimits());

function agent() {
  const jar = new Map();
  return async function call(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (jar.size) headers.set('cookie', [...jar].map(([k, v]) => `${k}=${v}`).join('; '));
    const res = await fetch(base + path, { ...options, headers, redirect: 'manual' });
    for (const cookie of res.headers.getSetCookie?.() ?? []) {
      const [pair] = cookie.split(';');
      const i = pair.indexOf('=');
      if (pair.slice(i + 1)) jar.set(pair.slice(0, i), pair.slice(i + 1));
      else jar.delete(pair.slice(0, i));
    }
    return res;
  };
}

const form = (fields) => ({
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams(fields).toString(),
});

async function csrfFor(call, path) {
  const html = await (await call(path)).text();
  return /name="csrf-token" content="([a-f0-9]*)"/.exec(html)?.[1] ?? '';
}

let n = 0;
const uniq = () => ++n;

/** A steward with a session, since only they can mint an invite. */
async function steward(id) {
  await hr.createUser({ id, email: `${id}@haus.fund`, passwordHash: hashPassword('a-good-passphrase'), isAdmin: true });
  await hr.ensureMember(id, { name: id });
  const { createSession } = await import('../app/auth.js');
  const token = await createSession(id);
  const call = agent();
  await call('/homeroom', { headers: { cookie: `homeroom_session=${token}` } });
  // The agent's jar starts empty, so carry the cookie explicitly.
  const wrapped = async (path, options = {}) => {
    const headers = new Headers(options.headers || {});
    headers.set('cookie', `homeroom_session=${token}`);
    return fetch(base + path, { ...options, headers, redirect: 'manual' });
  };
  const html = await (await wrapped('/homeroom')).text();
  return { call: wrapped, csrf: /name="csrf-token" content="([a-f0-9]*)"/.exec(html)?.[1] ?? '' };
}

/** Mint an invite through the module, which is what the route does. */
async function inviteFor(email, invitedBy = 'thesteward') {
  const created = await invites.create({ email, invitedBy, note: 'test' });
  assert.ok(created.ok, created.error);
  return created.token;
}

/* ======================================================== the invite itself */

test('the token is never stored — only its hash', async () => {
  const token = await inviteFor(`hash${uniq()}@example.org`);
  const rows = (await (await getDb()).prepare('SELECT token_hash FROM hr_invites').all());
  for (const row of rows) {
    assert.notEqual(row.token_hash, token, 'the raw token must never reach the table');
    assert.match(row.token_hash, /^[0-9a-f]{64}$/);
  }
  assert.equal(invites.hashToken(token), rows.find((r) => r.token_hash === invites.hashToken(token))?.token_hash);
});

test('peek finds a live invite and reports who sent it', async () => {
  const email = `peek${uniq()}@example.org`;
  const token = await inviteFor(email, 'thesteward');
  const looked = await invites.peek(token);
  assert.ok(looked.ok);
  assert.equal(looked.invite.email, email);
  assert.equal(looked.invite.invitedBy, 'thesteward');
  assert.equal(looked.invite.live, true);
});

test('a token nobody minted finds nothing', async () => {
  const looked = await invites.peek(invites.mintToken());
  assert.ok(looked.ok);
  assert.equal(looked.invite, null);
});

test('re-inviting the same address revokes the first link', async () => {
  const email = `again${uniq()}@example.org`;
  const first = await inviteFor(email);
  const second = await inviteFor(email);

  assert.equal((await invites.peek(first)).invite.live, false, 'the old link must stop working');
  assert.equal((await invites.peek(second)).invite.live, true);
});

test('an expired invite is not live', async () => {
  const email = `stale${uniq()}@example.org`;
  const token = await inviteFor(email);
  (await (await getDb()).prepare('UPDATE hr_invites SET expires_at = 1 WHERE token_hash = ?')
    .run(invites.hashToken(token)));
  assert.equal((await invites.peek(token)).invite.live, false);
});

test('redeeming works once', async () => {
  const token = await inviteFor(`once${uniq()}@example.org`);
  const first = await invites.redeem(token, 'firstclaimer');
  const second = await invites.redeem(token, 'secondclaimer');

  assert.ok(first.invite, 'the first redemption should succeed');
  assert.equal(second.invite, null, 'the second must not');
});

test('a revoked invite cannot be redeemed', async () => {
  const email = `revoked${uniq()}@example.org`;
  const token = await inviteFor(email);
  const row = (await (await getDb()).prepare('SELECT id FROM hr_invites WHERE token_hash = ?')
    .get(invites.hashToken(token)));

  await invites.revoke(row.id);
  assert.equal((await invites.redeem(token, 'toolate')).invite, null);
});

/* ============================================================== joining */

test('a live invite renders the join page with the address fixed', async () => {
  const email = `join${uniq()}@example.org`;
  const token = await inviteFor(email);
  const res = await agent()(`/homeroom/join/${token}`);

  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, new RegExp(email.replace('.', '\\.')), 'should show whose invite it is');
  assert.match(html, /disabled/, 'the address should not be editable');
});

test('joining creates the account, signs you in and lands on the welcome page', async () => {
  const email = `newbie${uniq()}@example.org`;
  const token = await inviteFor(email);
  const call = agent();
  const csrf = await csrfFor(call, `/homeroom/join/${token}`);

  const res = await call(`/homeroom/join/${token}`, form({
    csrf, handle: 'newbie', password: 'a-good-passphrase', confirm: 'a-good-passphrase',
  }));

  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), '/homeroom/welcome');
  const account = await hr.getUser('newbie');
  assert.ok(account, 'the account should exist');
  assert.equal(account.email, email, 'with the invited address, not one they typed');
  assert.equal(account.is_admin, 0, 'joining by invite never grants stewardship');
  assert.equal((await call('/homeroom/welcome')).status, 200);
});

test('signup is closed, but an invite still gets you in', async () => {
  // The whole reason invites exist: the front door is shut and this is the key.
  assert.equal((await agent()('/homeroom/signup')).status, 403);

  const token = await inviteFor(`closedroom${uniq()}@example.org`);
  assert.equal((await agent()(`/homeroom/join/${token}`)).status, 200);
});

test('the password has to be real, and the two have to match', async () => {
  const token = await inviteFor(`weak${uniq()}@example.org`);
  const call = agent();
  const csrf = await csrfFor(call, `/homeroom/join/${token}`);

  const short = await call(`/homeroom/join/${token}`, form({
    csrf, handle: 'shorty', password: 'short', confirm: 'short',
  }));
  assert.equal(short.status, 400);
  assert.match(await short.text(), /at least 10 characters/i);

  const mismatch = await call(`/homeroom/join/${token}`, form({
    csrf, handle: 'mismatch', password: 'a-good-passphrase', confirm: 'a-different-one',
  }));
  assert.equal(mismatch.status, 400);
  assert.match(await mismatch.text(), /do not match/i);

  assert.equal((await invites.peek(token)).invite.live, true, 'a failed attempt must not spend it');
});

test('a taken handle is refused without spending the invite', async () => {
  await hr.createUser({ id: 'incumbent2', email: 'incumbent2@haus.fund', passwordHash: hashPassword('x'.repeat(12)) });
  const token = await inviteFor(`taken${uniq()}@example.org`);
  const call = agent();
  const csrf = await csrfFor(call, `/homeroom/join/${token}`);

  const res = await call(`/homeroom/join/${token}`, form({
    csrf, handle: 'incumbent2', password: 'a-good-passphrase', confirm: 'a-good-passphrase',
  }));
  assert.equal(res.status, 400);
  assert.match(await res.text(), /handle is taken/i);
  assert.equal((await invites.peek(token)).invite.live, true);
});

test('a spent link says so rather than 500ing', async () => {
  const token = await inviteFor(`spent${uniq()}@example.org`);
  await invites.redeem(token, 'someoneelse');

  const res = await agent()(`/homeroom/join/${token}`);
  assert.equal(res.status, 410);
  assert.match(await res.text(), /has been used/i);
});

test('a token that was never minted is refused the same way', async () => {
  const res = await agent()(`/homeroom/join/${invites.mintToken()}`);
  assert.equal(res.status, 410);
  // Not "no such invite": a distinguishable answer turns this into an oracle.
  assert.match(await res.text(), /not usable|has been used/i);
});

test('the account you get can actually sign in afterwards', async () => {
  const email = `signin${uniq()}@example.org`;
  const token = await inviteFor(email);
  const call = agent();
  const csrf = await csrfFor(call, `/homeroom/join/${token}`);
  await call(`/homeroom/join/${token}`, form({
    csrf, handle: 'cansignin', password: 'the-chosen-passphrase', confirm: 'the-chosen-passphrase',
  }));

  assert.ok(verifyPassword('the-chosen-passphrase', (await hr.getUser('cansignin')).password_hash));
});

/* ====================================================== the steward screen */

test('only a steward can see or mint invites', async () => {
  await hr.createUser({ id: 'ordinaryone', email: 'ordinaryone@haus.fund', passwordHash: hashPassword('x'.repeat(12)) });
  await hr.ensureMember('ordinaryone', { name: 'Ordinary' });
  const { createSession } = await import('../app/auth.js');
  const token = await createSession('ordinaryone');

  const res = await fetch(`${base}/homeroom/stewards/invites`, {
    headers: { cookie: `homeroom_session=${token}` }, redirect: 'manual',
  });
  assert.equal(res.status, 403);
});

test('a steward mints one and is shown the link exactly once', async () => {
  const { call, csrf } = await steward('thesteward');
  const email = `minted${uniq()}@example.org`;

  const res = await call('/homeroom/stewards/invites', form({ csrf, email, days: '14', note: 'S26' }));
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /\/homeroom\/join\//, 'the link should be on the page');
  assert.match(html, new RegExp(email.replace('.', '\\.')));

  // Re-opening the page must not show it again: it is not stored anywhere.
  const again = await (await call('/homeroom/stewards/invites')).text();
  assert.doesNotMatch(again, /\/homeroom\/join\//, 'the link is shown once, then gone');
  assert.match(again, new RegExp(email.replace('.', '\\.')), 'but the invite is still listed');
});

test('a steward cannot invite an address that already has an account', async () => {
  const { call, csrf } = await steward('steward2');
  await hr.createUser({ id: 'already', email: 'already@example.org', passwordHash: hashPassword('x'.repeat(12)) });

  const res = await call('/homeroom/stewards/invites', form({ csrf, email: 'already@example.org' }));
  assert.match(await res.text(), /already has an account/i);
});

test('the listing never carries a token hash', async () => {
  const { call } = await steward('steward3');
  await inviteFor(`listed${uniq()}@example.org`);
  const html = await (await call('/homeroom/stewards/invites')).text();
  assert.doesNotMatch(html, /[0-9a-f]{64}/, 'a hash on the page is a hash in a log');
});

test('revoking from the page kills the link', async () => {
  const { call, csrf } = await steward('steward4');
  const email = `killme${uniq()}@example.org`;
  const token = await inviteFor(email);
  const row = (await (await getDb()).prepare('SELECT id FROM hr_invites WHERE token_hash = ?')
    .get(invites.hashToken(token)));

  const res = await call(`/homeroom/stewards/invites/${row.id}/revoke`, form({ csrf }));
  assert.equal(res.status, 200);
  assert.match(await res.text(), /revoked/i);
  assert.equal((await agent()(`/homeroom/join/${token}`)).status, 410);
});

test('the page warns that local invites do not survive a restart', async () => {
  const { call } = await steward('steward5');
  const html = await (await call('/homeroom/stewards/invites')).text();
  assert.match(html, /stored locally/i);
  assert.match(html, /container/i, 'and should say why that matters');
});

/* ============================================================= first run */

test('the checklist is derived from what the member has actually done', async () => {
  const email = `checklist${uniq()}@example.org`;
  const token = await inviteFor(email);
  const call = agent();
  const csrf = await csrfFor(call, `/homeroom/join/${token}`);
  await call(`/homeroom/join/${token}`, form({
    csrf, handle: 'checklister', password: 'a-good-passphrase', confirm: 'a-good-passphrase',
  }));

  const before = await hr.onboardingProgress('checklister');
  assert.equal(before.complete, false);
  assert.equal(before.steps.find((s) => s.key === 'profile').done, false);

  const settingsCsrf = await csrfFor(call, '/homeroom/settings');
  await call('/homeroom/settings', form({
    csrf: settingsCsrf, headline: 'Directed evolution in a garage', expertise: 'crispr, ferment',
  }));

  const after = await hr.onboardingProgress('checklister');
  assert.equal(after.steps.find((s) => s.key === 'profile').done, true, 'doing the thing ticks it');
  assert.equal(after.done, before.done + 1);
});

test('optional steps do not hold the count back', async () => {
  const steps = await hr.onboardingSteps('checklister');
  const optional = steps.filter((s) => s.optional);
  assert.ok(optional.length, 'at least one step should be optional');
  assert.equal((await hr.onboardingProgress('checklister')).total, steps.length - optional.length);
});

test('the welcome page renders and links every step somewhere real', async () => {
  const { call } = await steward('steward6');
  const html = await (await call('/homeroom/welcome')).text();
  assert.match(html, /Welcome/);
  for (const step of await hr.onboardingSteps('steward6')) {
    assert.match(html, new RegExp(step.href.replace(/\//g, '\\/')), `${step.key} should link out`);
  }
});

test('health reports which invite backend is live', () => {
  const state = invites.health();
  assert.equal(state.backend, 'local');
  assert.equal(state.durable, false);
  assert.match(state.warning, /Supabase/);
});
