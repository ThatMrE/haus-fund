/*
 * The mentor desk.
 *
 * Two things are being asserted here and they are not the same thing.
 *
 * The first is the leak. Before this feature, `searchMentors()` selected `m.*`
 * and the scheduler URL travelled with every mentor row — onto the profile as
 * a button and out of /homeroom/api/mentors in bulk. The fix was to stop
 * selecting the column at all, and the test for it asserts on the RENDERED
 * BODY rather than on the model, because a filter that lives at a call site is
 * exactly what fails silently the next time an endpoint is added. If either of
 * these two assertions ever needs relaxing, the gate has been removed.
 *
 * The second is the state machine: capacity checked before a request is
 * written, first accept winning a contested last slot, a token that cannot be
 * spent twice, and a grant that expires at click time rather than at render
 * time.
 *
 * Airtable and Resend are never called. No network.
 */

process.env.HOMEROOM_DB = ':memory:';
process.env.HOMEROOM_SECRET = 'test-secret';
process.env.HOMEROOM_SEED = 'off';

import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { getDb } from '../app/db.js';
import { handle } from '../app/app.js';
import { resetRateLimits } from '../app/http.js';
import * as hr from '../app/models.js';
import * as desk from '../app/mentordesk.js';
import { createHash } from 'node:crypto';

getDb();

let server;
let base;

before(async () => {
  server = createServer((req, res) => handle(req, res));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

const SCHEDULER = 'https://cal.com/dr-quiet/30min';

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

async function member(handleName) {
  resetRateLimits();
  const call = agent();
  const csrf = await csrfFor(call, '/homeroom/signup');
  const res = await call('/homeroom/signup', form({
    csrf, handle: handleName, email: `${handleName}@example.com`, password: 'a-good-passphrase',
  }));
  assert.equal(res.status, 303, 'signup should redirect');
  return { call, csrf: await csrfFor(call), id: handleName };
}

let mentorSeq = 0;
function mentor(overrides = {}) {
  mentorSeq += 1;
  const id = hr.upsertMentor({
    name: overrides.name || `Quiet Mentor ${mentorSeq}`,
    role: 'Regulatory lead',
    org: 'Somewhere',
    track: 'regulatory',
    tags: ['gras', 'cmc'],
    scheduler: overrides.scheduler === undefined ? SCHEDULER : overrides.scheduler,
    vetted: true,
    source: 'test',
  });
  const patch = {
    state: overrides.state || 'listed',
    consent_mode: overrides.consent_mode || 'ask-me',
    capacity: overrides.capacity === undefined ? 2 : overrides.capacity,
    tracks: overrides.tracks || '',
    email: overrides.email === undefined ? 'mentor@example.org' : overrides.email,
  };
  getDb().prepare(
    `UPDATE hr_mentors SET state = ?, consent_mode = ?, capacity = ?, tracks = ?, email = ?
     WHERE id = ?`,
  ).run(patch.state, patch.consent_mode, patch.capacity, patch.tracks, patch.email, id);
  return hr.getMentor(id);
}

const ASK = {
  track: 'regulatory',
  need: 'We are six weeks from a GRAS self-affirmation filing and cannot tell whether the expert panel needs a toxicologist on it.',
  why_them: 'You have taken two ferment-derived ingredients through this exact filing.',
  tried: 'Read the FDA guidance and asked our lawyer, who deferred.',
  asking_for: '30 minutes on a call',
};

/**
 * A member row without the signup dance.
 *
 * The model-level tests below exercise the state machine directly, and going
 * through HTTP signup for each one would make them slow and would test the
 * roster gate over and over instead of the thing under test.
 */
function user(id) {
  getDb().prepare(
    'INSERT OR IGNORE INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)',
  ).run(id, `${id}@fixture.test`, 'not-a-real-hash', Math.floor(Date.now() / 1000));
  hr.ensureMember(id);
  return id;
}

const M1 = 'fixture-one';
const M2 = 'fixture-two';

beforeEach(() => {
  resetRateLimits();
  user(M1);
  user(M2);
});

/* ================================================================= the leak */

test('the scheduler URL never reaches a member-facing response', async () => {
  const m = mentor();
  const { call } = await member('leakcheck');

  const page = await (await call(`/homeroom/mentor/${m.slug}`)).text();
  assert.doesNotMatch(page, /cal\.com/, 'the profile must not render the booking link');
  assert.match(page, /Ask for time/, 'it should offer the request flow instead');

  const list = await (await call('/homeroom/mentors')).text();
  assert.doesNotMatch(list, /cal\.com/, 'the roster must not carry booking links');

  const api = await (await call('/homeroom/api/mentors')).text();
  assert.doesNotMatch(api, /cal\.com/, 'the JSON API is where this leaked before');
  assert.doesNotMatch(api, /"scheduler"/, 'the column should not be in the payload at all');
});

test('the model layer does not return the scheduler column', () => {
  const m = mentor();
  assert.ok(!('scheduler' in hr.getMentor(m.slug)), 'getMentor must not carry it');
  const { mentors } = hr.searchMentors({ q: m.name });
  assert.ok(mentors.length, 'the fixture should be findable');
  assert.ok(!('scheduler' in mentors[0]), 'searchMentors must not carry it');
  assert.equal(desk.schedulerFor(m.id), SCHEDULER, 'and it is still readable on purpose');
});

/* ============================================================ the happy path */

test('a request reaches the mentor, and their yes produces a working link', async () => {
  const m = mentor();
  const { call, csrf } = await member('asker1');

  const sent = await call(`/homeroom/mentor/${m.slug}/request`, form({ csrf, ...ASK }));
  assert.equal(sent.status, 303);

  const request = getDb().prepare('SELECT * FROM hr_mentor_requests WHERE mentor_id = ?').get(m.id);
  assert.equal(request.state, 'sent');
  assert.equal(request.member_id, 'asker1');
  assert.ok(request.token_hash, 'the token is stored hashed');

  // The mentor's page is reachable with no session at all. The real token is
  // only ever returned at creation and stored hashed, so the test plants a
  // known one the same way the app does.
  const token = plantToken(request.id);
  const anon = await fetch(`${base}/homeroom/m/${token}`);
  assert.equal(anon.status, 200);
  const mentorView = await anon.text();
  assert.match(mentorView, /GRAS self-affirmation/, 'they see what was asked');
  assert.doesNotMatch(mentorView, /cal\.com/, 'their own link is not echoed back at them');

  const accepted = await fetch(`${base}/homeroom/m/${token}/accept`, form({}));
  assert.equal(accepted.status, 200);
  assert.match(await accepted.text(), /Sent/);

  const grant = getDb().prepare('SELECT * FROM hr_mentor_grants WHERE request_id = ?').get(request.id);
  assert.ok(grant, 'accepting mints a grant');

  const redirect = await call(`/homeroom/mentor/${m.slug}/book/${grant.id}`);
  assert.equal(redirect.status, 302);
  assert.equal(redirect.headers.get('location'), SCHEDULER);
});

/* ================================================================= capacity */

test('a mentor at capacity is never asked at all', () => {
  const m = mentor({ capacity: 1 });
  const first = desk.createRequest({ mentor: m, memberId: M1, ...askArgs() });
  desk.answerRequest({ token: first.token, decision: 'accept' });

  const verdict = desk.canRequest({ mentor: hr.getMentor(m.id), memberId: M2 });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.reason, 'at-capacity');
  assert.match(verdict.message, /fully booked/);
});

test('two mentors racing the last slot: the first accept wins', () => {
  const m = mentor({ capacity: 1 });
  // Both requests are written before either is answered, which is the race.
  const a = desk.createRequest({ mentor: m, memberId: M1, ...askArgs() });
  const b = desk.createRequest({ mentor: m, memberId: M2, ...askArgs() });

  const first = desk.answerRequest({ token: a.token, decision: 'accept' });
  assert.equal(first.ok, true);

  const second = desk.answerRequest({ token: b.token, decision: 'accept' });
  assert.equal(second.ok, false);
  assert.equal(second.reason, 'at-capacity');
  assert.equal(desk.getRequest(b.id).state, 'sent', 'the loser is left answerable, not corrupted');
});

test('a decline does not spend capacity', () => {
  const m = mentor({ capacity: 1 });
  const a = desk.createRequest({ mentor: m, memberId: M1, ...askArgs() });
  desk.answerRequest({ token: a.token, decision: 'decline' });
  assert.equal(desk.capacityFor(hr.getMentor(m.id)).used, 0,
    'saying no must never make a mentor look busier');
});

/* ================================================================== tokens */

test('a token cannot be spent twice', () => {
  const m = mentor();
  const r = desk.createRequest({ mentor: m, memberId: M1, ...askArgs() });
  assert.equal(desk.answerRequest({ token: r.token, decision: 'accept' }).ok, true);
  const again = desk.answerRequest({ token: r.token, decision: 'decline' });
  assert.equal(again.ok, false);
  assert.equal(again.reason, 'already');
});

test('an unknown token is not an error page that leaks anything', async () => {
  const res = await fetch(`${base}/homeroom/m/deadbeef`);
  assert.equal(res.status, 404);
  const html = await res.text();
  assert.match(html, /not valid/);
  assert.doesNotMatch(html, /cal\.com/);
});

test('a late answer is honoured rather than refused', () => {
  const m = mentor();
  const r = desk.createRequest({ mentor: m, memberId: M1, ...askArgs() });
  getDb().prepare('UPDATE hr_mentor_requests SET token_expires = ? WHERE id = ?')
    .run(desk.monthWindow().start - 1, r.id);
  const result = desk.answerRequest({ token: r.token, decision: 'accept' });
  assert.equal(result.ok, true, 'a mentor who answers slowly did the right thing slowly');
  assert.equal(result.late, true);
});

/* ================================================================== grants */

test('a grant is bound to one member and expires at click time', () => {
  const m = mentor();
  const r = desk.createRequest({ mentor: m, memberId: M1, ...askArgs() });
  const { grant } = desk.answerRequest({ token: r.token, decision: 'accept' });

  assert.equal(desk.redeemGrant({ grantId: grant.id, memberId: M2 }).reason, 'not-yours');
  assert.equal(desk.redeemGrant({ grantId: grant.id, memberId: M1 }).ok, true);

  getDb().prepare('UPDATE hr_mentor_grants SET expires_at = 1 WHERE id = ?').run(grant.id);
  assert.equal(desk.redeemGrant({ grantId: grant.id, memberId: M1 }).reason, 'expired');
});

test('a revoked grant stops working', () => {
  const m = mentor();
  const r = desk.createRequest({ mentor: m, memberId: M1, ...askArgs() });
  const { grant } = desk.answerRequest({ token: r.token, decision: 'accept' });
  desk.revokeGrantsForMentor(m.id);
  assert.equal(desk.redeemGrant({ grantId: grant.id, memberId: M1 }).reason, 'revoked');
});

/* ============================================================ consent modes */

test('auto skips the ask and issues the link immediately', () => {
  const m = mentor({ consent_mode: 'auto' });
  const r = desk.createRequest({ mentor: m, memberId: M1, ...askArgs() });
  assert.equal(r.auto, true);
  assert.equal(desk.getRequest(r.id).state, 'accepted');
  assert.ok(r.grant, 'and the grant exists without anyone being emailed a question');
});

test('auto-track only auto-accepts the tracks the mentor named', () => {
  const m = mentor({ consent_mode: 'auto-track', tracks: 'regulatory,grants' });
  const inTrack = desk.createRequest({ mentor: m, memberId: M1, ...askArgs('regulatory') });
  assert.equal(inTrack.auto, true);

  const outOfTrack = desk.createRequest({ mentor: m, memberId: M2, ...askArgs('hiring') });
  assert.equal(outOfTrack.auto, false);
  assert.equal(desk.getRequest(outOfTrack.id).state, 'sent');
});

/* ================================================================ refusals */

test('an unlisted, paused or link-less mentor cannot be asked', () => {
  const paused = mentor({ state: 'paused' });
  assert.equal(desk.canRequest({ mentor: paused, memberId: M1 }).reason, 'paused');

  const unlisted = mentor({ state: 'pending' });
  assert.equal(desk.canRequest({ mentor: unlisted, memberId: M1 }).reason, 'unlisted');

  const linkless = mentor({ scheduler: '' });
  assert.equal(desk.canRequest({ mentor: linkless, memberId: M1 }).reason, 'no-scheduler');

  // The roster imported today has no addresses at all, so this is the common
  // case rather than the edge one. Writing a request that can never be
  // delivered would look, ten days later, like a mentor who ignored it.
  const unreachable = mentor({ email: '' });
  assert.equal(desk.canRequest({ mentor: unreachable, memberId: M1 }).reason, 'no-contact');
});

test('the mentor address is not in the shared row either', async () => {
  const m = mentor({ email: 'private@example.org' });
  assert.ok(!('email' in hr.getMentor(m.slug)), 'getMentor must not carry it');
  const { call } = await member('contactcheck');
  const api = await (await call('/homeroom/api/mentors')).text();
  assert.doesNotMatch(api, /private@example\.org/);
  const page = await (await call(`/homeroom/mentor/${m.slug}`)).text();
  assert.doesNotMatch(page, /private@example\.org/);
  assert.equal(desk.contactFor(m.id), 'private@example.org', 'read on purpose, not by default');
});

test('a member cannot ask the same mentor twice while one is open', () => {
  const m = mentor();
  desk.createRequest({ mentor: m, memberId: M1, ...askArgs() });
  const verdict = desk.canRequest({ mentor: hr.getMentor(m.id), memberId: M1 });
  assert.equal(verdict.reason, 'already-open');
});

test('the request form refuses a vague ask', async () => {
  const m = mentor();
  const { call, csrf } = await member('vague');
  const res = await call(`/homeroom/mentor/${m.slug}/request`,
    form({ csrf, ...ASK, need: 'help pls' }));
  assert.equal(res.status, 200, 'it re-renders rather than redirecting');
  assert.match(await res.text(), /Say more about what you need/);
  assert.equal(
    getDb().prepare('SELECT COUNT(*) AS n FROM hr_mentor_requests WHERE mentor_id = ?').get(m.id).n,
    0, 'and writes nothing');
});

/* ============================================================ vetting gate */

test('a pending submission is invisible to members, everywhere', async () => {
  const m = mentor({ state: 'pending', name: 'Unvetted Stranger' });
  const { call } = await member('vetgate');

  assert.equal((await call(`/homeroom/mentor/${m.slug}`)).status, 404,
    'not readable at a guessable URL either');
  assert.doesNotMatch(await (await call('/homeroom/mentors')).text(), /Unvetted Stranger/);
  assert.doesNotMatch(await (await call('/homeroom/api/mentors?limit=200')).text(),
    /Unvetted Stranger/);
});

test('the vetting queue is stewards only', async () => {
  const { call } = await member('notasteward');
  const res = await call('/homeroom/stewards/mentors');
  assert.equal(res.status, 403);
  assert.match(await res.text(), /Stewards only/);
});

/* =================================================================== gate off */

test('HOMEROOM_MENTOR_GATE=0 restores the direct link', async () => {
  const m = mentor();
  const { call } = await member('gateoff');
  process.env.HOMEROOM_MENTOR_GATE = '0';
  try {
    const page = await (await call(`/homeroom/mentor/${m.slug}`)).text();
    assert.match(page, /cal\.com/, 'the switch is the whole point of having it');
  } finally {
    delete process.env.HOMEROOM_MENTOR_GATE;
  }
});

/* ------------------------------------------------------------------ helper */

/** Swap in a token this test knows, hashed exactly as the app hashes it. */
function plantToken(requestId, token = `known-${requestId}`) {
  getDb().prepare('UPDATE hr_mentor_requests SET token_hash = ? WHERE id = ?')
    .run(createHash('sha256').update(token).digest('hex'), requestId);
  return token;
}

function askArgs(track = 'regulatory') {
  return {
    track,
    need: ASK.need,
    whyThem: ASK.why_them,
    tried: ASK.tried,
    askingFor: ASK.asking_for,
  };
}
