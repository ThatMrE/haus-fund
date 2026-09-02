/*
 * The front door.
 *
 * The rule is tested directly against the shapes the real Airtable produces —
 * including the eight-ish rows where the status field and the date formula
 * disagree, which are the whole reason this is three-valued rather than a
 * boolean. The HTTP tests then check the two policies that matter: signup fails
 * closed when the roster is unreachable, and login fails open.
 *
 * Airtable is stubbed by replacing `globalThis.fetch`. No network.
 */

process.env.HOMEROOM_DB = ':memory:';
process.env.HOMEROOM_SECRET = 'test-secret';
process.env.HOMEROOM_ROSTER_TOKEN = 'test-token';
process.env.HOMEROOM_ACCESS = 'roster';

import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { getDb } from '../app/db.js';
import { handle } from '../app/app.js';
import { resetRateLimits } from '../app/http.js';
import * as hr from '../app/models.js';
import * as roster from '../app/roster.js';
import * as access from '../app/access.js';

getDb();

let server;
let base;
const realFetch = globalThis.fetch;

before(async () => {
  server = createServer((req, res) => handle(req, res));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  globalThis.fetch = realFetch;
  server.close();
});

/* --------------------------------------------------------------- the stub */

/** Records keyed by the address they answer to. `null` means Airtable is down. */
let ROSTER = new Map();
let outage = false;
let calls = 0;

beforeEach(() => {
  outage = false;
  calls = 0;
  getDb().exec('DELETE FROM hr_roster');
});

globalThis.fetch = async (input, init) => {
  const url = String(input);
  if (!url.includes('api.airtable.com')) return realFetch(input, init);
  calls++;
  if (outage) throw new Error('network');

  // The linked-record name lookups; irrelevant to the verdict.
  if (!url.includes('filterByFormula')) {
    return new Response(JSON.stringify({ records: [] }), { status: 200 });
  }
  const match = /LOWER%28%7BEmail%7D%29\s*=\s*%27([^%]+)%27/.exec(url)
    || /'([^']+)'/.exec(decodeURIComponent(url));
  const email = match ? match[1] : '';
  const records = ROSTER.get(email) || [];
  return new Response(JSON.stringify({ records }), { status: 200 });
};

const record = (fields) => ({ id: `rec${Math.random().toString(36).slice(2, 10)}`, fields });

function form(fields) {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields).toString(),
  };
}

function agent() {
  const jar = new Map();
  return async function call(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (jar.size) headers.set('cookie', [...jar].map(([k, v]) => `${k}=${v}`).join('; '));
    const res = await realFetch(base + path, { ...options, headers, redirect: 'manual' });
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

async function csrfFor(call, path) {
  const html = await (await call(path)).text();
  return /name="csrf-token" content="([a-f0-9]*)"/.exec(html)?.[1] ?? '';
}

/** Sign in from a clean browser, which is what a returning member actually is. */
async function trySignin(email, password = 'a-good-passphrase') {
  resetRateLimits();
  const call = agent();
  const csrf = await csrfFor(call, '/homeroom/login');
  return call('/homeroom/login', form({ csrf, email, password }));
}

async function trySignup(handleName, email) {
  resetRateLimits();
  const call = agent();
  const csrf = await csrfFor(call, '/homeroom/signup');
  const res = await call('/homeroom/signup', form({
    csrf, handle: handleName, email, password: 'a-good-passphrase',
  }));
  return { call, res };
}

/* ================================================================ the rule */

test('an accepted place opens the door, even before move-in', () => {
  const result = roster.evaluate({
    'First Name': 'Ada', 'Last Name': 'Fell',
    Status: { name: 'Accepted' },
    'Lifecycle Status (Computed)': 'Applicant',
  });
  assert.equal(result.verdict, 'allow');
  assert.equal(result.reason, 'accepted');
  assert.equal(result.person.name, 'Ada Fell');
});

test('living there opens the door on its own', () => {
  assert.equal(roster.evaluate({ 'Lifecycle Status (Computed)': 'Resident' }).verdict, 'allow');
  assert.equal(roster.evaluate({ 'Lifecycle Status (Computed)': 'Alumni' }).verdict, 'allow');
  assert.equal(
    roster.evaluate({ 'Resident type': { name: 'Core resident' } }).verdict, 'allow',
  );
  assert.equal(roster.evaluate({ 'Resident type': { name: 'Subletter' } }).verdict, 'allow');
});

test('an applicant is not a resident', () => {
  for (const status of ['Applied', 'Interviewed', 'Pending', 'Waitlist']) {
    const result = roster.evaluate({
      Status: { name: status }, 'Lifecycle Status (Computed)': 'Applicant',
    });
    assert.equal(result.verdict, 'deny', `${status} should not open the door`);
  }
  assert.equal(roster.evaluate({}).verdict, 'deny', 'a record with no status at all is a deny');
});

test('rescinded overrides an active residency', () => {
  // The real table has rows exactly like this: the offer was pulled and the
  // move-in date was never cleared. The explicit signal has to win.
  const result = roster.evaluate({
    Status: { name: 'Rescinded' },
    'Lifecycle Status (Computed)': 'Resident',
    'Resident type': { name: 'Core resident' },
  });
  assert.equal(result.verdict, 'deny');
  assert.equal(result.reason, 'status-rescinded');

  assert.equal(
    roster.evaluate({
      Status: { name: 'Ready to Reject' }, 'Lifecycle Status (Computed)': 'Resident',
    }).verdict,
    'deny',
  );
});

test('declined or deferred against a residency is a conflict, not a guess', () => {
  for (const status of ['Declined', 'Deferred']) {
    const result = roster.evaluate({
      Status: { name: status }, 'Lifecycle Status (Computed)': 'Resident',
    });
    assert.equal(result.verdict, 'review', `${status} + Resident should go to a steward`);
    assert.match(result.reason, /^conflict-/);
  }
  // A subletter who declined the residency but did live there — same shape.
  const subletter = roster.evaluate({
    Status: { name: 'Declined' },
    'Lifecycle Status (Computed)': 'Alumni',
    'Resident type': { name: 'Subletter' },
  });
  assert.equal(subletter.verdict, 'review');
});

test('declined with no residency is simply a deny', () => {
  assert.equal(
    roster.evaluate({ Status: { name: 'Declined' }, 'Lifecycle Status (Computed)': 'Past applicant' }).verdict,
    'deny',
  );
});

/* ============================================================ the plumbing */

test('an address is never stored in the clear', async () => {
  ROSTER = new Map([['ada@example.org', [record({
    'First Name': 'Ada', Status: { name: 'Accepted' },
  })]]]);
  await access.assess('ada@example.org');

  const row = hr.rosterRow(roster.emailHash('ada@example.org'));
  assert.ok(row, 'the verdict should be cached');
  assert.equal(row.verdict, 'allow');
  assert.doesNotMatch(JSON.stringify(row), /ada@example\.org/, 'never the address itself');
  assert.match(row.masked, /^ad\*+@example\.org$/);
});

test('a verdict is cached, so the door does not hammer Airtable', async () => {
  ROSTER = new Map([['cache@example.org', [record({ Status: { name: 'Accepted' } })]]]);
  await access.assess('cache@example.org');
  const first = calls;
  await access.assess('cache@example.org');
  assert.equal(calls, first, 'the second look is answered from cache');
});

test('duplicate records take the most permissive verdict', async () => {
  // One applicant row and one resident row for the same person is normal.
  ROSTER = new Map([['dupe@example.org', [
    record({ Status: { name: 'Applied' }, 'Lifecycle Status (Computed)': 'Applicant' }),
    record({ Status: { name: 'Accepted' }, 'Lifecycle Status (Computed)': 'Resident' }),
  ]]]);
  const result = await access.assess('dupe@example.org');
  assert.equal(result.verdict, 'allow', 'a stale duplicate must not lock out a real resident');
});

test('an address that is not an address never reaches Airtable', async () => {
  const before = calls;
  const result = await roster.lookup("no'); DROP--@x");
  assert.equal(result.verdict, 'deny');
  assert.equal(calls, before, 'nothing is interpolated into a formula');
});

test('a steward decision outranks the rule, and survives a re-check', async () => {
  ROSTER = new Map([['conflict@example.org', [record({
    Status: { name: 'Declined' }, 'Lifecycle Status (Computed)': 'Resident',
  })]]]);
  const first = await access.assess('conflict@example.org');
  assert.equal(first.verdict, 'review');

  const hash = roster.emailHash('conflict@example.org');
  assert.equal(hr.pendingRoster().length, 1, 'it lands in the steward queue');

  if (!hr.getUser('thedecider')) {
    hr.createUser({ id: 'thedecider', email: 'thedecider@example.org', passwordHash: 'x', isAdmin: true });
  }
  hr.decideRoster({ hash, userId: 'thedecider', decision: 'allow', note: 'Subletted all summer.' });
  const after = await access.assess('conflict@example.org');
  assert.equal(after.verdict, 'allow');
  assert.equal(after.reason, 'steward-allow');
  assert.equal(hr.pendingRoster().length, 0, 'and leaves the queue');
});

/* ================================================================= signup */

test('an accepted resident can create an account, and it prefills their profile', async () => {
  ROSTER = new Map([['resident@example.org', [record({
    'First Name': 'Bea', 'Last Name': 'Lindqvist',
    Status: { name: 'Accepted' }, 'Lifecycle Status (Computed)': 'Resident',
  })]]]);

  const { res } = await trySignup('goodresident', 'resident@example.org');
  assert.equal(res.status, 303, 'signup should succeed');

  const member = hr.getMember('goodresident');
  assert.equal(member.name, 'Bea Lindqvist', 'the roster fills in the name');
  const user = hr.getUser('goodresident');
  assert.match(user.roster_status, /^allow:/);
});

test('an applicant is turned away, and no account is created', async () => {
  ROSTER = new Map([['applicant@example.org', [record({
    Status: { name: 'Waitlist' }, 'Lifecycle Status (Computed)': 'Applicant',
  })]]]);

  const { res } = await trySignup('nothere', 'applicant@example.org');
  assert.equal(res.status, 403);
  const page = await res.text();
  assert.match(page, /Residents only/);
  assert.equal(hr.getUser('nothere'), null, 'no account');
});

test('a stranger and a rejected applicant get the same page', async () => {
  ROSTER = new Map([['rejected@example.org', [record({ Status: { name: 'Ready to Reject' } })]]]);

  const rejected = await trySignup('rej1', 'rejected@example.org');
  const stranger = await trySignup('str1', 'nobody@example.org');

  assert.equal(rejected.res.status, stranger.res.status);
  const a = (await rejected.res.text()).replace(/rejected@example\.org/g, 'X');
  const b = (await stranger.res.text()).replace(/nobody@example\.org/g, 'X');
  assert.equal(a, b, 'signup must not be a way to test who is a resident');
});

test('a conflict is held, not admitted', async () => {
  ROSTER = new Map([['held@example.org', [record({
    Status: { name: 'Rescinded' }, 'Lifecycle Status (Computed)': 'Resident',
  })]]]);
  const { res } = await trySignup('heldback', 'held@example.org');
  assert.equal(res.status, 403);
  assert.equal(hr.getUser('heldback'), null);
});

test('signup fails CLOSED when the roster is unreachable', async () => {
  outage = true;
  const { res } = await trySignup('outaged', 'someone@example.org');
  assert.equal(res.status, 503, 'not a 403 — this is our failure, not their rejection');
  const page = await res.text();
  assert.match(page, /Try again shortly/);
  assert.doesNotMatch(page, /Residents only/, 'never tell someone they do not belong on a timeout');
  assert.equal(hr.getUser('outaged'), null, 'and never let them in on a guess');
});

/* ================================================================== login */

test('login fails OPEN: an outage does not lock the house out', async () => {
  ROSTER = new Map([['staysin@example.org', [record({ Status: { name: 'Accepted' } })]]]);
  await trySignup('staysin', 'staysin@example.org');
  assert.ok(hr.getUser('staysin'));

  // Age the account past the TTL so login re-checks, then take Airtable away.
  getDb().prepare('UPDATE users SET roster_checked_at = 0 WHERE id = ?').run('staysin');
  getDb().exec('DELETE FROM hr_roster');
  outage = true;

  const res = await trySignin('staysin@example.org');
  assert.equal(res.status, 303, 'an Airtable outage must not be a lockout');
});

test('a rescinded place revokes an existing account at the next login', async () => {
  ROSTER = new Map([['later@example.org', [record({ Status: { name: 'Accepted' } })]]]);
  await trySignup('laterrescinded', 'later@example.org');
  assert.ok(hr.getUser('laterrescinded'));

  // The offer is pulled, and the cached verdict expires.
  ROSTER = new Map([['later@example.org', [record({
    Status: { name: 'Rescinded' }, 'Lifecycle Status (Computed)': 'Resident',
  })]]]);
  getDb().prepare('UPDATE users SET roster_checked_at = 0 WHERE id = ?').run('laterrescinded');
  getDb().exec('DELETE FROM hr_roster');

  const res = await trySignin('later@example.org');
  assert.equal(res.status, 403);
  assert.match(await res.text(), /Access ended/);
});

test('a steward is never locked out by the roster', async () => {
  ROSTER = new Map([['boss@example.org', [record({ Status: { name: 'Accepted' } })]]]);
  await trySignup('thesteward', 'boss@example.org');
  getDb().prepare('UPDATE users SET is_admin = 1, roster_checked_at = 0 WHERE id = ?').run('thesteward');

  ROSTER = new Map();          // vanished from the roster entirely
  getDb().exec('DELETE FROM hr_roster');

  const res = await trySignin('boss@example.org');
  assert.equal(res.status, 303, 'the people who fix the roster must be able to reach it');
});

/* ============================================================== the modes */

test('the always-allow list covers staff who are not on the roster', async () => {
  process.env.HOMEROOM_ALWAYS_ALLOW = 'ops@haus.fund, contractor@example.org';
  try {
    ROSTER = new Map();
    const result = await access.assess('ops@haus.fund');
    assert.equal(result.verdict, 'allow');
    assert.equal(result.reason, 'allowlist');
  } finally {
    delete process.env.HOMEROOM_ALWAYS_ALLOW;
  }
});

test('closed mode turns self-signup off entirely', async () => {
  process.env.HOMEROOM_ACCESS = 'closed';
  try {
    resetRateLimits();
    const call = agent();
    const res = await call('/homeroom/signup');
    assert.equal(res.status, 403);
    assert.match(await res.text(), /Accounts are closed/);
  } finally {
    process.env.HOMEROOM_ACCESS = 'roster';
  }
});

test('with no token configured the mode is open, not silently closed', () => {
  const saved = process.env.HOMEROOM_ROSTER_TOKEN;
  const savedMode = process.env.HOMEROOM_ACCESS;
  delete process.env.HOMEROOM_ROSTER_TOKEN;
  delete process.env.HOMEROOM_ACCESS;
  try {
    assert.equal(roster.configured(), false);
    assert.equal(roster.accessMode(), 'open', 'local development still works out of the box');
  } finally {
    process.env.HOMEROOM_ROSTER_TOKEN = saved;
    process.env.HOMEROOM_ACCESS = savedMode;
  }
});

/* ============================================================ the steward */

test('the front-door page is stewards only', async () => {
  ROSTER = new Map([['nosy@example.org', [record({ Status: { name: 'Accepted' } })]]]);
  const { call } = await trySignup('nosysteward', 'nosy@example.org');
  const res = await call('/homeroom/stewards/access');
  assert.equal(res.status, 403);

  getDb().prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run('nosysteward');
  const allowed = await call('/homeroom/stewards/access');
  assert.equal(allowed.status, 200);
  assert.match(await allowed.text(), /Front door/);
});
