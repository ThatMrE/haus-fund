/**
 * The same invite flow, with Supabase as the store.
 *
 * WHY THIS IS A SEPARATE FILE. The backend is chosen from the environment at
 * call time, and the local suite deliberately runs with Supabase unset. Running
 * both in one process would mean mutating the environment between tests and
 * hoping nothing cached it.
 *
 * The stub below implements the five RPCs the migration defines, with the same
 * semantics that matter: the secret gates minting, listing and revoking; peek
 * and redeem need only the token hash; redemption is atomic; and re-inviting an
 * address revokes the previous link. What this proves is that `app/invites.js`
 * speaks the protocol correctly and reads the answers right — not that a
 * particular Supabase project has the functions installed, which is what
 * /homeroom/health reports at runtime.
 */

process.env.HOMEROOM_DB = ':memory:';
process.env.HOMEROOM_SECRET = 'test-secret';
process.env.HOMEROOM_ACCESS = 'closed';
process.env.HOMEROOM_INVITE_SECRET = 'a-long-random-invite-secret';

import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { getDb } from '../app/db.js';
import { handle } from '../app/app.js';
import { resetRateLimits } from '../app/http.js';
import * as hr from '../app/models.js';
import * as invites from '../app/invites.js';
import { hashPassword, createSession } from '../app/auth.js';

getDb();

/* ============================================================== the stub */

const SECRET = 'a-long-random-invite-secret';
const rows = new Map(); // token_hash -> row

function reset() {
  rows.clear();
}

function postgrest(req, res) {
  let raw = '';
  req.on('data', (chunk) => { raw += chunk; });
  req.on('end', () => {
    const send = (status, payload) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(payload));
    };
    const name = req.url.replace('/rest/v1/rpc/', '').split('?')[0];
    const a = raw ? JSON.parse(raw) : {};
    const now = Date.now();

    const gated = () => {
      if (a.p_secret !== SECRET) {
        send(400, { message: 'not authorised' });
        return false;
      }
      return true;
    };

    if (name === 'homeroom_invite_create') {
      if (!gated()) return undefined;
      for (const row of rows.values()) {
        if (row.email === String(a.p_email).toLowerCase() && row.status === 'pending') {
          row.status = 'revoked';
        }
      }
      const id = randomUUID();
      rows.set(a.p_token_hash, {
        id,
        token_hash: a.p_token_hash,
        email: String(a.p_email).toLowerCase(),
        invited_by: a.p_invited_by,
        note: a.p_note || '',
        roster_verdict: a.p_roster_verdict || '',
        status: 'pending',
        redeemed_by: null,
        redeemed_at: null,
        expires_at: new Date(now + Math.max(1, a.p_ttl_days || 14) * 86400_000).toISOString(),
        created_at: new Date(now).toISOString(),
      });
      return send(200, id);
    }

    if (name === 'homeroom_invite_peek') {
      const row = rows.get(a.p_token_hash);
      if (!row) return send(200, []);
      return send(200, [{
        email: row.email,
        invited_by: row.invited_by,
        status: row.status,
        roster_verdict: row.roster_verdict,
        expires_at: row.expires_at,
        live: row.status === 'pending' && Date.parse(row.expires_at) > now,
      }]);
    }

    if (name === 'homeroom_invite_redeem') {
      const row = rows.get(a.p_token_hash);
      // The atomic UPDATE ... WHERE status = 'pending' of the real function.
      if (!row || row.status !== 'pending' || Date.parse(row.expires_at) <= now) return send(200, []);
      row.status = 'redeemed';
      row.redeemed_by = a.p_handle;
      row.redeemed_at = new Date(now).toISOString();
      return send(200, [{
        email: row.email, invited_by: row.invited_by, roster_verdict: row.roster_verdict,
      }]);
    }

    if (name === 'homeroom_invite_list') {
      if (!gated()) return undefined;
      // Note what is absent: token_hash is never returned, as in the migration.
      return send(200, [...rows.values()]
        .sort((x, y) => Date.parse(y.created_at) - Date.parse(x.created_at))
        .map(({ token_hash, ...rest }) => rest));
    }

    if (name === 'homeroom_invite_revoke') {
      if (!gated()) return undefined;
      for (const row of rows.values()) {
        if (row.id === a.p_id && row.status === 'pending') {
          row.status = 'revoked';
          return send(200, true);
        }
      }
      return send(200, false);
    }

    return send(404, { message: `Could not find the function public.${name}` });
  });
}

/* ============================================================= harness */

let rest;
let server;
let base;

before(async () => {
  rest = createServer(postgrest);
  await new Promise((r) => rest.listen(0, '127.0.0.1', r));
  process.env.SUPABASE_URL = `http://127.0.0.1:${rest.address().port}`;
  process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';

  server = createServer((req, res) => handle(req, res));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  rest.close();
  server.close();
});

beforeEach(() => {
  reset();
  resetRateLimits();
});

const form = (fields) => ({
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams(fields).toString(),
});

let n = 0;
const uniq = () => ++n;

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

async function csrfFor(call, path) {
  const html = await (await call(path)).text();
  return /name="csrf-token" content="([a-f0-9]*)"/.exec(html)?.[1] ?? '';
}

/* ================================================================ tests */

test('with the secret set, the backend is Supabase and durable', () => {
  const state = invites.health();
  assert.equal(state.backend, 'supabase');
  assert.equal(state.durable, true);
  assert.equal(state.warning, undefined);
});

test('an invite round-trips through the RPCs', async () => {
  const email = `sb${uniq()}@example.org`;
  const created = await invites.create({ email, invitedBy: 'thesteward', note: 'S26' });
  assert.ok(created.ok, created.error);
  assert.equal(created.durable, true);

  const looked = await invites.peek(created.token);
  assert.equal(looked.invite.email, email);
  assert.equal(looked.invite.invitedBy, 'thesteward');
  assert.equal(looked.invite.live, true);
});

test('the token never leaves this process', async () => {
  const created = await invites.create({ email: `nosend${uniq()}@example.org`, invitedBy: 's' });
  for (const key of rows.keys()) {
    assert.notEqual(key, created.token, 'the store must only ever see the hash');
  }
  assert.ok(rows.has(invites.hashToken(created.token)));
});

test('redeeming is atomic across the RPC too', async () => {
  const created = await invites.create({ email: `race${uniq()}@example.org`, invitedBy: 's' });
  const [first, second] = await Promise.all([
    invites.redeem(created.token, 'racer-one'),
    invites.redeem(created.token, 'racer-two'),
  ]);
  const winners = [first, second].filter((r) => r.invite);
  assert.equal(winners.length, 1, 'exactly one of two simultaneous claims may win');
});

test('re-inviting revokes the previous link', async () => {
  const email = `replace${uniq()}@example.org`;
  const first = await invites.create({ email, invitedBy: 's' });
  const second = await invites.create({ email, invitedBy: 's' });
  assert.equal((await invites.peek(first.token)).invite.live, false);
  assert.equal((await invites.peek(second.token)).invite.live, true);
});

test('the listing comes back without token hashes', async () => {
  await invites.create({ email: `listed${uniq()}@example.org`, invitedBy: 's' });
  const listed = await invites.list();
  assert.ok(listed.ok);
  assert.ok(listed.invites.length);
  for (const row of listed.invites) {
    assert.equal(row.token_hash, undefined);
    assert.ok(row.expiresAt > 0, 'timestamps should be parsed into seconds');
  }
});

test('a wrong invite secret is reported as a mismatch, not a raw error', async () => {
  const real = process.env.HOMEROOM_INVITE_SECRET;
  process.env.HOMEROOM_INVITE_SECRET = 'the-wrong-secret-entirely';
  const created = await invites.create({ email: `wrong${uniq()}@example.org`, invitedBy: 's' });
  process.env.HOMEROOM_INVITE_SECRET = real;

  assert.equal(created.ok, false);
  assert.match(created.error, /HOMEROOM_INVITE_SECRET/);
  assert.match(created.error, /match/);
});

test('a project without the migration says which migration to run', async () => {
  const url = process.env.SUPABASE_URL;
  // Point at a server that answers 404 for every RPC name.
  const blank = createServer((req, res) => {
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ message: 'Could not find the function public.homeroom_invite_create' }));
  });
  await new Promise((r) => blank.listen(0, '127.0.0.1', r));
  process.env.SUPABASE_URL = `http://127.0.0.1:${blank.address().port}`;

  let created;
  try {
    created = await invites.create({ email: `nomigration${uniq()}@example.org`, invitedBy: 's' });
  } finally {
    // Without the finally, a throw here leaks a listening socket and the test
    // runner hangs forever instead of reporting the failure.
    process.env.SUPABASE_URL = url;
    blank.close();
  }

  assert.equal(created.ok, false);
  assert.match(created.error, /supabase\/migrations/);
});

test('the whole join flow works end to end on Supabase', async () => {
  const email = `endtoend${uniq()}@example.org`;
  const created = await invites.create({ email, invitedBy: 'thesteward' });
  const call = agent();
  const csrf = await csrfFor(call, `/homeroom/join/${created.token}`);

  const res = await call(`/homeroom/join/${created.token}`, form({
    csrf, handle: 'sbjoiner', password: 'a-good-passphrase', confirm: 'a-good-passphrase',
  }));

  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), '/homeroom/welcome');
  assert.equal(hr.getUser('sbjoiner').email, email);
  assert.equal((await invites.peek(created.token)).invite.status, 'redeemed');
});

test('the steward page does not warn when the store is durable', async () => {
  hr.createUser({ id: 'sbsteward', email: 'sbsteward@haus.fund', passwordHash: hashPassword('x'.repeat(12)), isAdmin: true });
  hr.ensureMember('sbsteward', { name: 'Steward' });
  const token = createSession('sbsteward');
  const html = await (await fetch(`${base}/homeroom/stewards/invites`, {
    headers: { cookie: `homeroom_session=${token}` },
  })).text();

  assert.doesNotMatch(html, /stored locally/i);
});

test('an outage leaves the invite unspent and says to try again', async () => {
  const created = await invites.create({ email: `outage${uniq()}@example.org`, invitedBy: 's' });
  const url = process.env.SUPABASE_URL;
  process.env.SUPABASE_URL = 'http://127.0.0.1:1';  // nothing listening

  const res = await agent()(`/homeroom/join/${created.token}`);
  process.env.SUPABASE_URL = url;

  assert.equal(res.status, 503);
  assert.match(await res.text(), /try again/i);
  assert.equal((await invites.peek(created.token)).invite.live, true, 'still usable afterwards');
});
