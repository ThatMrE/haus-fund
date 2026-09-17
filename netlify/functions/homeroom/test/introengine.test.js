/*
 * The intro engine.
 *
 * Two things are being asserted here and they are not the same thing.
 *
 * The first is the PRIVACY CLAIM, and it is the reason the feature can exist
 * at all: a target's "no" is invisible to the member who asked. It is asserted
 * against the RENDERED BODY, not against the model, because the model is not
 * what leaks — a call site that forgets to collapse the status is. The three
 * closed-without-an-intro states must be indistinguishable in the bytes that
 * leave the server. If that assertion ever needs relaxing, the gate is gone.
 *
 * The second is the state machine: nothing sent without a steward's click,
 * `introduced` unreachable from anything but `agreed`, suppression checked
 * before a list is built rather than at send time, cooldowns at their
 * boundaries, and a token that cannot be spent twice.
 *
 * Happenstance and Resend are never called. No network.
 */

process.env.HOMEROOM_DB = ':memory:';
process.env.HOMEROOM_SECRET = 'test-secret';
process.env.HOMEROOM_SEED = 'off';
process.env.HOMEROOM_INTRO_ENABLED = '1';
process.env.HOMEROOM_HAPPENSTANCE_KEY = 'test-key';

import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { getDb } from '../app/db.js';
import { handle } from '../app/app.js';
import { resetRateLimits } from '../app/http.js';
import * as hr from '../app/models.js';
import * as intro from '../app/introengine.js';
import * as hs from '../app/happenstance.js';

getDb();

let server;
let base;
const realFetch = globalThis.fetch;

/* The account every fixture search is attributed to. `requested_by` is a real
   foreign key, because "who spent the credits" is not a free-text field. */
const SEEKER = 'seeker';

before(async () => {
  await user(SEEKER);
  await user('steward');
  server = createServer(async (req, res) => await handle(req, res));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  globalThis.fetch = realFetch;
  server.close();
});

/* --------------------------------------------------------------- the stub */

/* One search, shaped exactly as the live API returned it on 2026-09-16:
   results carry `weighted_traits_score`, per-trait evidence, and mutuals by
   index into a search-level list. No email address — which is the fact the
   whole engine is built around. */
const SEARCH_ID = '5a2a7a05-67af-4a92-8b75-fb383a7d2687';
let searchState = 'COMPLETED';
let outage = false;

const PAYLOAD = () => ({
  id: SEARCH_ID,
  status: searchState,
  mutuals: [
    { index: 0, name: 'Alec Brewer' },
    { index: 1, name: 'Elliot Roth' },
  ],
  results: searchState === 'COMPLETED' ? [
    {
      id: 'person-one',
      name: 'Branden Wolner',
      weighted_traits_score: 1.5,
      current_title: 'Principal Consultant',
      current_company: 'Recombinant DNA Technologies',
      summary: 'Achieved self-GRAS in four months for a fermentation-derived food product.',
      socials: { linkedin_url: 'https://www.linkedin.com/in/bwolner', happenstance_url: 'https://happenstance.ai/u/person-one' },
      mutuals: [{ index: 0, affinity_score: 3.5 }, { index: 1, affinity_score: 0 }],
      traits: [
        { index: 0, score: 1, evidence: 'Runs a **regulatory** consultancy.' },
        { index: 1, score: 0, evidence: 'Nothing here.' },
      ],
    },
    {
      id: 'person-two',
      name: 'Sandra Perryman',
      weighted_traits_score: 1.5,
      current_title: 'Principal Consultant',
      current_company: 'FSQR Consulting',
      summary: 'Food safety and regulatory consultant with self-affirmed GRAS experience.',
      socials: { linkedin_url: 'https://www.linkedin.com/in/sandra', happenstance_url: '' },
      mutuals: [{ index: 1, affinity_score: 1 }],
      traits: [{ index: 0, score: 1, evidence: 'Advises food brands on compliance.' }],
    },
    {
      id: 'person-three',
      name: 'Tomo Sato',
      weighted_traits_score: 1,
      current_title: 'Quality Consultant',
      current_company: 'Freelance',
      summary: 'Food biotechnology regulatory consultant.',
      socials: {},
      mutuals: [],
      traits: [{ index: 0, score: 1, evidence: 'FDA GRAS and EFSA experience.' }],
    },
  ] : null,
  has_more: false,
});

globalThis.fetch = async (input, init) => {
  const url = String(input);
  if (!url.includes('api.happenstance.ai') && !url.includes('api.resend.com')) {
    return realFetch(input, init);
  }
  if (outage) throw new Error('network');
  if (url.includes('api.resend.com')) return new Response('{}', { status: 200 });
  if (url.endsWith('/v1/usage')) {
    return new Response(JSON.stringify({ balance_credits: 44, has_credits: true }), { status: 200 });
  }
  if (url.endsWith('/v1/search')) {
    return new Response(JSON.stringify({ id: SEARCH_ID, status: 'RUNNING' }), { status: 200 });
  }
  if (url.includes('/v1/search/')) {
    return new Response(JSON.stringify(PAYLOAD()), { status: 200 });
  }
  return new Response('{}', { status: 404 });
};

beforeEach(() => {
  searchState = 'COMPLETED';
  outage = false;
  resetRateLimits();
  const db = getDb();
  for (const table of ['hr_intro_events', 'hr_intro_outcomes', 'hr_intro_cooldowns',
    'hr_intro_suppression', 'hr_intro_requests', 'hr_hs_people', 'hr_hs_searches']) {
    db.exec(`DELETE FROM ${table}`);
  }
});

/* -------------------------------------------------------------- fixtures */

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

async function csrfFor(call, path = '/homeroom') {
  const html = await (await call(path)).text();
  return /name="csrf-token" content="([a-f0-9]*)"/.exec(html)?.[1] ?? '';
}

let seq = 0;
async function member({ admin = false } = {}) {
  seq += 1;
  const id = `founder${seq}`;
  resetRateLimits();
  const call = agent();
  const csrf = await csrfFor(call, '/homeroom/signup');
  const res = await call('/homeroom/signup', form({
    csrf, handle: id, email: `${id}@example.com`, password: 'a-good-passphrase',
  }));
  assert.equal(res.status, 303, 'signup should redirect');
  if (admin) getDb().prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(id);
  return { call, csrf: await csrfFor(call), id, user: await hr.getUser(id) };
}

/** A member row and one stored search result, without the HTTP dance. */
async function user(id) {
  getDb().prepare(
    'INSERT OR IGNORE INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)',
  ).run(id, `${id}@fixture.test`, 'not-a-real-hash', Math.floor(Date.now() / 1000));
  await hr.ensureMember(id);
  return id;
}

async function searchAndPeople(actorId = SEEKER) {
  const started = await intro.runSearch({ query: 'GRAS self-affirmation consultants', actorId, force: true });
  assert.ok(started.ok, started.error);
  const collected = await intro.collect(started.search.id);
  assert.ok(collected.ok, collected.error);
  return collected.people;
}

const ASK = {
  need: 'We are six weeks from a GRAS self-affirmation filing and cannot tell whether the expert panel needs a toxicologist.',
  whyThem: 'You have taken a ferment-derived ingredient through this exact filing.',
  askingFor: '20 minutes on a call',
};

async function requestFor(memberId, person) {
  const created = await intro.createRequest({ person, memberId, ...ASK });
  assert.ok(created.ok, created.message);
  return created.id;
}

/* The steward every gate-4 click is attributed to. A real row: `sent_by` is a
   foreign key for the same reason. */
const steward = { id: 'steward', is_admin: 1 };

/* ================================================================ search */

test('a search stores only the allowlisted fields, and no address', async () => {
  const people = await searchAndPeople();
  assert.equal(people.length, 3);
  const first = people[0];
  assert.equal(first.name, 'Branden Wolner');
  assert.equal(first.org, 'Recombinant DNA Technologies');
  // Evidence for a trait that scored zero is not evidence; it is the model
  // saying it found nothing, and quoting it in a blurb would be a false claim
  // about a real person.
  assert.deepEqual(first.evidence, ['Runs a regulatory consultancy.']);
  assert.deepEqual(first.through, ['Alec Brewer', 'Elliot Roth']);

  const columns = Object.keys(first);
  for (const forbidden of ['email', 'phone', 'address', 'socials', 'traits']) {
    assert.ok(!columns.includes(forbidden), `${forbidden} must not be stored`);
  }
  const row = getDb().prepare('SELECT * FROM hr_hs_people LIMIT 1').get();
  assert.ok(!JSON.stringify(row).includes('@'), 'no address should reach the database');
});

test('a second search for the same question is free', async () => {
  await searchAndPeople();
  const before = (await intro.creditsThisMonth()).spent;
  const again = await intro.runSearch({ query: 'GRAS SELF-AFFIRMATION consultants!', actorId: SEEKER });
  assert.ok(again.ok);
  assert.equal(again.cached, true);
  assert.equal((await intro.creditsThisMonth()).spent, before, 'a cached search spends nothing');
});

test('sourcing fails closed: an outage is an error, never an empty list', async () => {
  const started = await intro.runSearch({ query: 'GRAS consultants for fermentation', actorId: SEEKER, force: true });
  assert.ok(started.ok);
  outage = true;
  const collected = await intro.collect(started.search.id);
  assert.equal(collected.ok, false);
  assert.match(collected.error, /Could not reach Happenstance/);
  assert.ok(!('people' in collected) || !collected.people?.length);
});

test('the credit budget refuses rather than overspending', async () => {
  process.env.HOMEROOM_INTRO_CREDIT_BUDGET = '2';
  try {
    await searchAndPeople();
    const second = await intro.runSearch({ query: 'contract manufacturers in the midwest', actorId: SEEKER });
    assert.equal(second.ok, false);
    assert.match(second.error, /budget/);
  } finally {
    delete process.env.HOMEROOM_INTRO_CREDIT_BUDGET;
  }
});

/* =========================================================== suppression */

test('a suppressed person is filtered before a list is built, not at send time', async () => {
  const people = await searchAndPeople();
  await intro.suppress(people[0].person_hash, 'opted-out');

  const again = await intro.runSearch({ query: 'GRAS self-affirmation consultants', actorId: SEEKER, force: true });
  const collected = await intro.collect(again.search.id);
  const names = collected.people.map((p) => p.name);
  assert.ok(!names.includes('Branden Wolner'), 'the suppressed person is not in the list at all');
  assert.equal(collected.people.length, 2);
});

test('suppression also removes them from lists already cached', async () => {
  const people = await searchAndPeople();
  await intro.suppress(people[1].person_hash, 'opted-out');
  const remaining = await intro.peopleFor(people[1].search_id);
  assert.equal(remaining.length, 2);
});

test('a member cannot request a suppressed person', async () => {
  const people = await searchAndPeople();
  const id = await user('supp-member');
  await intro.suppress(people[0].person_hash);
  const created = await intro.createRequest({ person: people[0], memberId: id, ...ASK });
  assert.equal(created.ok, false);
  assert.equal(created.reason, 'suppressed');
});

/* ========================================================= the two gates */

test('a member request sends nothing; only a steward click does', async () => {
  const people = await searchAndPeople();
  const id = await user('gate-member');
  const requestId = await requestFor(id, people[0]);

  const request = await intro.getRequest(requestId);
  assert.equal(request.status, 'requested');
  assert.equal(request.sent_at, null);
  assert.equal(request.token_hash, '');
  assert.equal(request.to_enc, '');
});

test('only a steward session can send a permission ask', async () => {
  const people = await searchAndPeople();
  const id = await user('not-a-steward');
  const requestId = await requestFor(id, people[0]);

  for (const actor of [null, { id, is_admin: 0 }, { id: 'agent', is_admin: undefined }]) {
    const sent = await intro.sendPermission({ requestId, actor, address: 'them@example.org' });
    assert.equal(sent.ok, false);
    assert.equal(sent.reason, 'not-steward');
  }
  assert.equal((await intro.getRequest(requestId)).status, 'requested');
});

test('two stewards clicking at once send one message', async () => {
  const people = await searchAndPeople();
  const id = await user('race-member');
  const requestId = await requestFor(id, people[0]);

  const [a, b] = await Promise.all([
    intro.sendPermission({ requestId, actor: steward, address: 'them@example.org' }),
    intro.sendPermission({ requestId, actor: steward, address: 'them@example.org' }),
  ]);
  assert.equal([a.ok, b.ok].filter(Boolean).length, 1, 'exactly one send wins');
});

test('introduced is unreachable from anything but agreed, including for a steward', async () => {
  const people = await searchAndPeople();
  const id = await user('order-member');
  const requestId = await requestFor(id, people[0]);

  let attempt = await intro.introduce({ requestId, actor: steward });
  assert.equal(attempt.ok, false, 'not from requested');

  const sent = await intro.sendPermission({ requestId, actor: steward, address: 'them@example.org' });
  assert.ok(sent.ok);
  attempt = await intro.introduce({ requestId, actor: steward });
  assert.equal(attempt.ok, false, 'not from permission_sent — silence is not consent');
  assert.equal(attempt.reason, 'not-agreed');

  await intro.answer({ token: sent.token, decision: 'yes' });
  attempt = await intro.introduce({ requestId, actor: steward });
  assert.equal(attempt.ok, true, 'only from agreed');
  assert.equal(attempt.to, 'them@example.org');
});

test('the address is stored encrypted and cleared once it is spent', async () => {
  const people = await searchAndPeople();
  const id = await user('address-member');
  const requestId = await requestFor(id, people[0]);
  const sent = await intro.sendPermission({ requestId, actor: steward, address: 'Them@Example.org' });

  const row = getDb().prepare('SELECT * FROM hr_intro_requests WHERE id = ?').get(requestId);
  assert.ok(!JSON.stringify(row).includes('them@example.org'), 'no plaintext address at rest');
  assert.equal(intro.decryptAddress(row.to_enc), 'them@example.org');

  await intro.answer({ token: sent.token, decision: 'yes' });
  await intro.introduce({ requestId, actor: steward });
  const after = getDb().prepare('SELECT to_enc, to_hash FROM hr_intro_requests WHERE id = ?').get(requestId);
  assert.equal(after.to_enc, '', 'the address is deleted once the introduction is out');
  assert.ok(after.to_hash, 'the hash stays, so the record of who was written to survives');
});

test('a declined request drops the address immediately', async () => {
  const people = await searchAndPeople();
  const id = await user('decline-address');
  const requestId = await requestFor(id, people[0]);
  const sent = await intro.sendPermission({ requestId, actor: steward, address: 'them@example.org' });
  await intro.answer({ token: sent.token, decision: 'no' });
  assert.equal((await intro.getRequest(requestId)).to_enc, '');
});

/* ============================================================ the target */

test('a token cannot be spent twice', async () => {
  const people = await searchAndPeople();
  const id = await user('token-member');
  const requestId = await requestFor(id, people[0]);
  const sent = await intro.sendPermission({ requestId, actor: steward, address: 'them@example.org' });

  const first = await intro.answer({ token: sent.token, decision: 'no' });
  assert.ok(first.ok);
  const second = await intro.answer({ token: sent.token, decision: 'yes' });
  assert.equal(second.ok, false, 'first answer wins');
  assert.equal((await intro.getRequest(requestId)).status, 'declined');
});

test('never means never: a suppression row, and off every future list', async () => {
  const people = await searchAndPeople();
  const id = await user('never-member');
  const requestId = await requestFor(id, people[0]);
  const sent = await intro.sendPermission({ requestId, actor: steward, address: 'them@example.org' });

  await intro.answer({ token: sent.token, decision: 'never' });
  assert.equal(await intro.isSuppressed(people[0].person_hash), true);

  const stored = getDb().prepare('SELECT * FROM hr_intro_suppression').all();
  assert.equal(stored.length, 1);
  assert.ok(!JSON.stringify(stored).includes('Branden'), 'a suppression row is a hash, not a person');
});

test('a no and a silence both buy the same rest', async () => {
  const people = await searchAndPeople();
  const said = await user('cooldown-said');
  const silent = await user('cooldown-silent');

  const one = await requestFor(said, people[0]);
  const sentOne = await intro.sendPermission({ requestId: one, actor: steward, address: 'a@example.org' });
  await intro.answer({ token: sentOne.token, decision: 'no' });
  assert.ok(await intro.cooldownFor(people[0].person_hash, said) > 0);
  // And house-wide, for a shorter while: a different member is blocked too.
  assert.ok(await intro.cooldownFor(people[0].person_hash, silent) > 0);

  const two = await requestFor(silent, people[1]);
  const sentTwo = await intro.sendPermission({ requestId: two, actor: steward, address: 'b@example.org' });
  // Ten days and a minute later, nobody answered.
  const later = Math.floor(Date.now() / 1000) + 11 * 86400;
  assert.equal(await intro.expireStale(later), 1);
  assert.equal((await intro.getRequest(two)).status, 'no_reply');
  assert.ok(await intro.cooldownFor(people[1].person_hash, silent, later) > 0);
  assert.ok(sentTwo.ok);
});

test('a cooldown blocks the next request and says why', async () => {
  const people = await searchAndPeople();
  const first = await user('cd-one');
  const second = await user('cd-two');
  const requestId = await requestFor(first, people[0]);
  const sent = await intro.sendPermission({ requestId, actor: steward, address: 'them@example.org' });
  await intro.answer({ token: sent.token, decision: 'no' });

  const blocked = await intro.canRequest({ personHash: people[0].person_hash, memberId: second });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, 'cooldown');
});

/* ============================================================= the caps */

test('the house-wide weekly cap refuses rather than queueing silently', async () => {
  process.env.HOMEROOM_INTRO_WEEKLY_CAP = '1';
  process.env.HOMEROOM_INTRO_MAX_OPEN = '5';
  try {
    const people = await searchAndPeople();
    const a = await user('cap-a');
    const b = await user('cap-b');
    const first = await requestFor(a, people[0]);
    const second = await requestFor(b, people[1]);
    assert.ok((await intro.sendPermission({ requestId: first, actor: steward, address: 'a@example.org' })).ok);

    const blocked = await intro.sendPermission({ requestId: second, actor: steward, address: 'b@example.org' });
    assert.equal(blocked.ok, false);
    assert.equal(blocked.reason, 'weekly-cap');
    assert.equal((await intro.getRequest(second)).status, 'requested', 'it waits, it is not lost');
  } finally {
    delete process.env.HOMEROOM_INTRO_WEEKLY_CAP;
    delete process.env.HOMEROOM_INTRO_MAX_OPEN;
  }
});

test('a member is capped on open requests', async () => {
  process.env.HOMEROOM_INTRO_MAX_OPEN = '2';
  try {
    const people = await searchAndPeople();
    const id = await user('open-cap');
    await requestFor(id, people[0]);
    await requestFor(id, people[1]);
    const third = await intro.createRequest({ person: people[2], memberId: id, ...ASK });
    assert.equal(third.ok, false);
    assert.equal(third.reason, 'member-open');
    assert.match(third.message, /in flight/);
  } finally {
    delete process.env.HOMEROOM_INTRO_MAX_OPEN;
  }
});

test('the same member cannot ask twice for the same person', async () => {
  const people = await searchAndPeople();
  const id = await user('dupe-member');
  await requestFor(id, people[0]);
  const again = await intro.createRequest({ person: people[0], memberId: id, ...ASK });
  assert.equal(again.ok, false);
  assert.equal(again.reason, 'already-open');
});

/* =========================================================== the privacy */

/*
 * The load-bearing assertion. A member's own page must not distinguish a
 * decline from a silence from a steward's refusal — in the model OR in the
 * rendered bytes. If this ever needs relaxing, the target's no has stopped
 * being free and the whole double opt-in is theatre.
 */
test('a decline, a silence and a refusal are indistinguishable to the member', async () => {
  const people = await searchAndPeople();
  const id = await user('privacy-member');

  const declined = await requestFor(id, people[0]);
  const sentA = await intro.sendPermission({ requestId: declined, actor: steward, address: 'a@example.org' });
  await intro.answer({ token: sentA.token, decision: 'no', note: 'Not my area at all.' });

  const silent = await requestFor(id, people[1]);
  const sentB = await intro.sendPermission({ requestId: silent, actor: steward, address: 'b@example.org' });
  assert.ok(sentB.ok);
  await intro.expireStale(Math.floor(Date.now() / 1000) + 11 * 86400);

  const refused = await requestFor(id, people[2]);
  await intro.refuse({ requestId: refused, actor: steward, note: 'Wrong person for this.' });

  const views = await intro.requestsFor(id);
  assert.equal(views.length, 3);
  const stages = new Set(views.map((v) => v.stage));
  assert.deepEqual([...stages], ['still open'], 'all three read identically');

  for (const view of views) {
    const json = JSON.stringify(view);
    for (const leak of ['declined', 'no_reply', 'refused', 'Not my area', 'Wrong person',
      'a@example.org', 'b@example.org']) {
      assert.ok(!json.includes(leak), `member view must not carry ${leak}`);
    }
  }
});

test('no member-facing page renders a candidate status, an address or a steward note', async () => {
  const people = await searchAndPeople();
  const who = await member();
  const id = who.id;

  const declined = await requestFor(id, people[0]);
  const sent = await intro.sendPermission({ requestId: declined, actor: steward, address: 'secret@example.org' });
  await intro.answer({ token: sent.token, decision: 'no', note: 'Too busy this quarter.' });
  const refused = await requestFor(id, people[1]);
  await intro.refuse({ requestId: refused, actor: steward, note: 'Not a fit.' });

  const body = await (await who.call('/homeroom/intros/mine')).text();
  assert.match(body, /still open/);
  for (const leak of ['declined', 'no_reply', 'refused', 'Too busy this quarter',
    'Not a fit', 'secret@example.org']) {
    assert.ok(!body.includes(leak), `the rendered page must not contain ${leak}`);
  }
});

test('a decline does not change the member page except for timestamps', async () => {
  const people = await searchAndPeople();
  const who = await member();
  const requestId = await requestFor(who.id, people[0]);
  const sent = await intro.sendPermission({ requestId, actor: steward, address: 'x@example.org' });

  const strip = (html) => html.replace(/name="csrf[^"]*" (content|value)="[^"]*"/g, '')
    .replace(/\d+ (second|minute|hour|day)s? ago/g, 'TIME');
  const before = strip(await (await who.call('/homeroom/intros/mine')).text());
  await intro.answer({ token: sent.token, decision: 'no' });
  const after = strip(await (await who.call('/homeroom/intros/mine')).text());

  assert.notEqual(before.length, 0);
  assert.equal(before, after, 'a decline is invisible to the requester');
});

test('the steward queue does show who said no', async () => {
  const people = await searchAndPeople();
  const id = await user('steward-view-member');
  const requestId = await requestFor(id, people[0]);
  const sent = await intro.sendPermission({ requestId, actor: steward, address: 'x@example.org' });
  await intro.answer({ token: sent.token, decision: 'no', note: 'Not this quarter.' });

  const closed = await intro.recentlyClosed();
  const row = closed.find((r) => r.id === requestId);
  assert.equal(row.status, 'declined');
  assert.equal(row.answer_note, 'Not this quarter.');
});

/* ================================================================ routes */

test('the member surfaces exist only when the engine is switched on', async () => {
  const who = await member();
  process.env.HOMEROOM_INTRO_ENABLED = '0';
  try {
    assert.equal((await who.call('/homeroom/intros/search')).status, 404);
    assert.equal((await who.call('/homeroom/intros/mine')).status, 404);
  } finally {
    process.env.HOMEROOM_INTRO_ENABLED = '1';
  }
  assert.equal((await who.call('/homeroom/intros/search')).status, 200);
});

test('the steward queue is stewards-only', async () => {
  const plain = await member();
  const res = await plain.call('/homeroom/stewards/intros');
  assert.equal(res.status, 403);

  const boss = await member({ admin: true });
  assert.equal((await boss.call('/homeroom/stewards/intros')).status, 200);
});

test('the permission route refuses a non-steward through HTTP, not just the model', async () => {
  const people = await searchAndPeople();
  const who = await member();
  const requestId = await requestFor(who.id, people[0]);

  const res = await who.call(`/homeroom/stewards/intros/${requestId}/permission`,
    form({ csrf: who.csrf, to: 'them@example.org' }));
  assert.equal(res.status, 403);
  assert.equal((await intro.getRequest(requestId)).status, 'requested');
});

test('the target page needs no account and every answer is a POST', async () => {
  const people = await searchAndPeople();
  const who = await member();
  const requestId = await requestFor(who.id, people[0]);
  const sent = await intro.sendPermission({ requestId, actor: steward, address: 'them@example.org' });

  const anon = agent();
  const page = await anon(`/homeroom/i/${sent.token}`);
  assert.equal(page.status, 200);
  const body = await page.text();
  assert.match(body, /Worth an introduction/);
  assert.ok(!body.includes('them@example.org'), 'the page does not echo the address');
  // A gateway pre-fetching the link must not answer on their behalf.
  assert.equal((await intro.getRequest(requestId)).status, 'permission_sent');

  const answered = await anon(`/homeroom/i/${sent.token}/yes`, form({}));
  assert.equal(answered.status, 200);
  assert.equal((await intro.getRequest(requestId)).status, 'agreed');
});

test('an expired or unknown token is a dead end, not an error page', async () => {
  const anon = agent();
  const res = await anon('/homeroom/i/deadbeef');
  assert.equal(res.status, 404);
  assert.match(await res.text(), /expired/);
});

/* =============================================================== the mail */

test('the permission message carries an opt-out, no tracking, and no invented facts', async () => {
  const { permissionMessage } = await import('../app/intromail.js');
  const people = await searchAndPeople();
  const id = await user('mail-member');
  const requestId = await requestFor(id, people[0]);
  const request = await intro.getRequest(requestId);
  const message = permissionMessage({
    request, member: { user_id: id, name: 'A Founder', org: 'Ferment Co' },
    token: 'tok', to: 'them@example.org',
  });

  assert.match(message.text, /never ask me again/i);
  assert.match(message.text, /No is a completely fine answer/);
  assert.ok(!/<img|utm_|\/track\/|pixel/i.test(message.text), 'no tracking of any kind');
  // Nothing about the target that did not come off their own row.
  assert.ok(message.text.includes(request.evidence[0]));
  assert.match(message.text, /They do not know I wrote to you/);
});

test('the introduction names both people and hands over', async () => {
  const { introductionMessage } = await import('../app/intromail.js');
  const people = await searchAndPeople();
  const id = await user('intro-mail-member');
  const requestId = await requestFor(id, people[0]);
  const request = await intro.getRequest(requestId);
  const message = introductionMessage({
    request, member: { user_id: id, name: 'A Founder', org: 'Ferment Co' }, to: 'them@example.org',
  });
  assert.match(message.subject, /A Founder ↔ Branden Wolner/);
  assert.match(message.text, /over to you/);
  assert.match(message.text, /bcc/);
});

/* ============================================================== plumbing */

test('the health endpoint reports the engine, including the one alarming number', async () => {
  const people = await searchAndPeople();
  const id = await user('health-member');
  const requestId = await requestFor(id, people[0]);
  const sent = await intro.sendPermission({ requestId, actor: steward, address: 'them@example.org' });
  await intro.answer({ token: sent.token, decision: 'yes' });

  const res = await fetch(`${base}/homeroom/health`);
  const body = await res.json();
  assert.equal(body.intros.enabled, true);
  assert.equal(body.intros.stuckAfterYes, 1, 'a yes with no introduction is the alarm');
  assert.equal(body.intros.waitingOnTarget, 0);
});

test('the audit trail distinguishes a steward from a member from the target', async () => {
  const people = await searchAndPeople();
  const id = await user('audit-member');
  const requestId = await requestFor(id, people[0]);
  const sent = await intro.sendPermission({ requestId, actor: steward, address: 'them@example.org' });
  await intro.answer({ token: sent.token, decision: 'yes' });
  await intro.introduce({ requestId, actor: steward });

  const trail = await intro.eventsFor(requestId);
  assert.deepEqual(trail.map((e) => `${e.actor_kind}:${e.event}`), [
    'member:requested', 'steward:permission-sent', 'target:agreed', 'steward:introduced',
  ]);
});

test('purging takes the search results with the search', async () => {
  const people = await searchAndPeople();
  const searchId = people[0].search_id;
  getDb().prepare('UPDATE hr_hs_searches SET expires_at = 1 WHERE id = ?').run(searchId);
  assert.equal(await intro.purge(), 1);
  assert.equal((await intro.peopleFor(searchId)).length, 0, 'people who never agreed do not linger');
});

test('a purged search does not take the request that came out of it', async () => {
  const people = await searchAndPeople();
  const id = await user('purge-member');
  const requestId = await requestFor(id, people[0]);
  getDb().prepare('UPDATE hr_hs_searches SET expires_at = 1').run();
  await intro.purge();

  const request = await intro.getRequest(requestId);
  assert.ok(request, 'the accountability record survives');
  assert.equal(request.name, 'Branden Wolner');
  assert.equal(request.search_id, null);
});

test('the person hash is stable and reveals nothing', async () => {
  assert.equal(hs.personHash('person-one'), hs.personHash('person-one'));
  assert.notEqual(hs.personHash('person-one'), hs.personHash('person-two'));
  assert.ok(!hs.personHash('person-one').includes('person'));
});
