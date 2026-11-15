/*
 * The onboarding form, and the sweep that brings it in.
 *
 * The form is a PUBLIC Airtable URL, so every row here is untrusted input and
 * the assertions are mostly about what the sweep refuses to do with it:
 *
 *   - a submission is never listed. Not on arrival, not because Airtable says
 *     `Vetted`, not because it was edited. A steward rules, or nobody does.
 *   - a booking link that is not a booking link is dropped, by the same host
 *     allowlist the CSV importer uses — shared in mentorfields.js precisely so
 *     one of the two cannot quietly stop checking.
 *   - a failed fetch changes NOTHING. The roster standing still is the correct
 *     outcome of an outage; an empty roster is not.
 *
 * Airtable is stubbed by replacing globalThis.fetch. No network.
 */

process.env.HOMEROOM_DB = ':memory:';
process.env.HOMEROOM_SECRET = 'test-secret';
process.env.HOMEROOM_SEED = 'off';
process.env.HOMEROOM_MENTOR_SYNC_TOKEN = 'test-token';

import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { getDb } from '../app/db.js';
import * as sync from '../app/mentorsync.js';
import * as hr from '../app/models.js';
import * as desk from '../app/mentordesk.js';
import { normalize } from '../app/mentorfields.js';

getDb();

/** A steward, so the audit log's foreign key has somebody to point at. */
getDb().prepare(
  'INSERT OR IGNORE INTO users (id, email, password_hash, created_at, is_admin) VALUES (?, ?, ?, ?, 1)',
).run('steward1', 'steward1@fixture.test', 'not-a-real-hash', Math.floor(Date.now() / 1000));

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

beforeEach(() => {
  getDb().exec('DELETE FROM hr_mentors');
});

/** Airtable's response shape, with only the fields the sweep asked for. */
function airtable(records) {
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ records }),
  });
}

function record(id, fields = {}) {
  return {
    id,
    fields: {
      Name: 'Dana Okonkwo',
      Role: 'Regulatory affairs lead',
      Organization: 'Ferment Co',
      'Area of Expertise': 'Regulatory and quality',
      Tags: ['GRAS', 'CMC'],
      Bio: 'Twelve years of FDA filings.',
      Scheduler: 'https://cal.com/dana/30min',
      Email: 'dana@example.org',
      Capacity: 3,
      ...fields,
    },
  };
}

/* ============================================================== gate A */

test('a form submission arrives pending, and is listed nowhere', async () => {
  airtable([record('recAAA')]);
  const result = await sync.sync();
  assert.equal(result.ok, true);
  assert.equal(result.created, 1);

  const row = getDb().prepare('SELECT * FROM hr_mentors').get();
  assert.equal(row.state, 'pending');
  assert.equal(row.vetted, 0);
  assert.equal(row.source, 'form');

  // Not on the roster, not in the search, not askable.
  assert.equal((await hr.searchMentors({})).total, 0, 'searchMentors filters on active/state');
  assert.equal((await desk.canRequest({ mentor: await hr.getMentor(row.id), memberId: 'nobody' })).reason,
    'unlisted');
  assert.equal(await sync.pendingCount(), 1, 'it is in the steward queue instead');
});

test('Airtable saying Vetted does not list anybody', async () => {
  airtable([record('recAAA', { Vetted: true })]);
  await sync.sync();
  const row = getDb().prepare('SELECT * FROM hr_mentors').get();
  assert.equal(row.state, 'pending',
    'a checkbox in a spreadsheet is somebody note to themselves, not gate A');
  assert.equal(row.vetted, 0);
});

test('a steward listing them is what makes them askable', async () => {
  airtable([record('recAAA')]);
  await sync.sync();
  const row = getDb().prepare('SELECT * FROM hr_mentors').get();

  await sync.rule({ mentorId: row.id, decision: 'list', actorId: 'steward1' });
  const listed = await hr.getMentor(row.id);
  assert.equal(listed.state, 'listed');
  assert.equal(listed.vetted, 1);
  assert.equal((await hr.searchMentors({})).total, 1);
});

test('a rejection keeps the row so the next sweep does not re-add it', async () => {
  airtable([record('recAAA')]);
  await sync.sync();
  const row = getDb().prepare('SELECT * FROM hr_mentors').get();
  await sync.rule({ mentorId: row.id, decision: 'reject', actorId: 'steward1', note: 'not a real org' });

  await sync.sync();
  const after = getDb().prepare('SELECT * FROM hr_mentors').all();
  assert.equal(after.length, 1, 'still one row');
  assert.equal(after[0].state, 'rejected', 'and a sweep must not resurrect it as a new submission');
  assert.equal(await sync.pendingCount(), 0);
});

/* ========================================================= untrusted input */

test('a booking link that is not a booking page is dropped', async () => {
  airtable([record('recAAA', { Scheduler: 'https://linkedin.com/in/someone' })]);
  await sync.sync();
  const row = getDb().prepare('SELECT * FROM hr_mentors').get();
  assert.equal(row.scheduler, '', 'the host allowlist is the whole defence here');
});

test('the allowlist is the one the importer uses, not a second copy', () => {
  const good = normalize({ name: 'A', scheduler: 'https://calendly.com/a/30min' });
  const bad = normalize({ name: 'B', scheduler: 'javascript:alert(1)' });
  const worse = normalize({ name: 'C', scheduler: 'https://evil.example.com/book' });
  assert.equal(good.scheduler, 'https://calendly.com/a/30min');
  assert.equal(bad.scheduler, '');
  assert.equal(worse.scheduler, '');
});

test('a malformed address is dropped rather than stored', async () => {
  airtable([record('recAAA', { Email: 'not an address' })]);
  await sync.sync();
  assert.equal(await desk.contactFor(getDb().prepare('SELECT id FROM hr_mentors').get().id), '');
});

test('an unrecognised consent mode falls back to ask-me', async () => {
  airtable([record('recAAA', { 'Consent Mode': 'whatever they like' })]);
  await sync.sync();
  assert.equal(getDb().prepare('SELECT consent_mode FROM hr_mentors').get().consent_mode, 'ask-me',
    'a form field nobody understood must not become a claim about consent');
});

/* ============================================================ idempotence */

test('re-running matches on the Airtable id and updates in place', async () => {
  airtable([record('recAAA')]);
  await sync.sync();
  airtable([record('recAAA', { Role: 'Head of regulatory' })]);
  const second = await sync.sync();

  assert.equal(second.created, 0);
  assert.equal(second.updated, 1);
  const rows = getDb().prepare('SELECT * FROM hr_mentors').all();
  assert.equal(rows.length, 1, 'one person, one row');
  assert.equal(rows[0].role, 'Head of regulatory');
});

test('a mentor who changes their name keeps their row', async () => {
  airtable([record('recAAA')]);
  await sync.sync();
  airtable([record('recAAA', { Name: 'Dana Okonkwo-Reed' })]);
  await sync.sync();
  const rows = getDb().prepare('SELECT * FROM hr_mentors').all();
  assert.equal(rows.length, 1, 'the record id survives a rename; a name slug would not');
  assert.equal(rows[0].name, 'Dana Okonkwo-Reed');
});

test('a row imported before this column existed is adopted, not duplicated', async () => {
  await hr.upsertMentor({ name: 'Dana Okonkwo', role: 'Old role', source: 'import' });
  airtable([record('recAAA')]);
  const result = await sync.sync();
  assert.equal(result.created, 0, 'matched on the name slug fallback');
  assert.equal(getDb().prepare('SELECT COUNT(*) AS n FROM hr_mentors').get().n, 1);
});

test('a listed mentor is not un-listed by a sweep', async () => {
  airtable([record('recAAA')]);
  await sync.sync();
  const id = getDb().prepare('SELECT id FROM hr_mentors').get().id;
  await sync.rule({ mentorId: id, decision: 'list', actorId: 'steward1' });

  await sync.sync();
  assert.equal((await hr.getMentor(id)).state, 'listed',
    'editing a form must not undo a steward');
});

test('a blank field does not wipe the link or the address', async () => {
  airtable([record('recAAA')]);
  await sync.sync();
  const id = getDb().prepare('SELECT id FROM hr_mentors').get().id;

  airtable([record('recAAA', { Scheduler: '', Email: '' })]);
  await sync.sync();
  assert.equal(await desk.schedulerFor(id), 'https://cal.com/dana/30min');
  assert.equal(await desk.contactFor(id), 'dana@example.org',
    'Airtable omitting a field must not remove the only way to reach them');
});

/* ============================================================ fail closed */

test('an Airtable outage changes nothing at all', async () => {
  airtable([record('recAAA')]);
  await sync.sync();
  const before = getDb().prepare('SELECT COUNT(*) AS n FROM hr_mentors').get().n;

  globalThis.fetch = async () => ({ ok: false, status: 503, json: async () => ({}) });
  const result = await sync.sync();

  assert.equal(result.ok, false);
  assert.match(result.error, /503/);
  assert.equal(getDb().prepare('SELECT COUNT(*) AS n FROM hr_mentors').get().n, before,
    'the roster standing still is the right outcome of an outage');
});

test('a timeout is an error, not an empty table', async () => {
  globalThis.fetch = async () => { const e = new Error('aborted'); e.name = 'AbortError'; throw e; };
  const result = await sync.sync();
  assert.equal(result.ok, false);
  assert.match(result.error, /timed out/);
});

test('an empty table is refused rather than believed', async () => {
  airtable([record('recAAA')]);
  await sync.sync();

  airtable([]);
  const result = await sync.sync();
  assert.equal(result.ok, false,
    'an empty table and a wrong base id look identical, and one of them must not empty the roster');
  assert.equal(getDb().prepare('SELECT COUNT(*) AS n FROM hr_mentors').get().n, 1);
});

/* =========================================================== the allowlist */

test('only the declared fields are ever requested, from each table', async () => {
  const asked = new Map();
  globalThis.fetch = async (url) => {
    const u = new URL(url);
    asked.set(u.pathname.split('/').pop(), u.searchParams.getAll('fields[]'));
    return { ok: true, json: async () => ({ records: [record('recAAA')] }) };
  };
  await sync.sync();
  assert.deepEqual(asked.get('tblnV5zn3t2aQHQaX'), sync.FIELDS);
  assert.deepEqual(asked.get('tblrHW0lkYSAonokn'), sync.APPLICATION_FIELDS);
  // The token is scoped to a base that also holds LPs, Investments and IC
  // Reviews, and the applications table holds CVs, headshots, diligence memos
  // and call notes. Nothing outside the lists leaves Airtable.
  const everything = [...asked.values()].flat();
  for (const forbidden of ['Notes', 'Investment', 'LP', 'Scorecard', 'CV / Resume', 'Headshot',
    'Diligence Memo', 'Call Notes', 'Referred By', 'Score', 'Reviewer']) {
    assert.ok(!everything.includes(forbidden), `${forbidden} must never be requested`);
  }
});

/* ================================================== Mentor Applications */

const application = (id, fields) => ({ id, fields: {
  'Full Name': 'Grace Hopper', Email: 'grace@example.org', 'Current Title': 'Rear Admiral',
  Organization: 'Navy', Location: 'San Francisco', 'Short Bio': 'Compilers.',
  Domains: ['Software'], 'Can Help With': ['Hiring'], Track: ['Residency (early-stage founders)'],
  'Review Status': 'Accepted', 'Privacy Consent': true, 'Show on Directory': true,
  ...fields,
} });

function twoTables({ mentors = [record('recAAA')], applications = [] } = {}) {
  globalThis.fetch = async (url) => {
    const table = new URL(url).pathname.split('/').pop();
    const records = table === 'tblrHW0lkYSAonokn' ? applications : mentors;
    return { ok: true, json: async () => ({ records }) };
  };
}

test('an accepted application with consent arrives pending, listed nowhere', async () => {
  twoTables({ applications: [application('recAPP1')] });
  const result = await sync.sync();
  assert.equal(result.ok, true);
  const row = getDb().prepare("SELECT state, name, email, role, org, airtable_id FROM hr_mentors WHERE airtable_id = 'recAPP1'").get();
  assert.ok(row, 'the application came in');
  assert.equal(row.state, 'pending', 'Airtable accepting them does not list them; a steward does');
  assert.equal(row.name, 'Grace Hopper');
  assert.equal(row.email, 'grace@example.org');
  assert.equal(row.org, 'Navy');
});

test('an application Airtable has not accepted stays out', async () => {
  for (const status of ['New', 'Memo Ready', 'Call Scheduled', 'Waitlist', 'Declined']) {
    assert.equal(sync.applicationEligible(application('x', { 'Review Status': status }).fields), false, status);
  }
  assert.equal(sync.applicationEligible(application('x', { 'Review Status': { name: 'Accepted' } }).fields), true,
    'a select may come back as an object');
});

test('no consent, or no wish to be listed, keeps an application out', async () => {
  assert.equal(sync.applicationEligible(application('x', { 'Privacy Consent': false }).fields), false);
  assert.equal(sync.applicationEligible(application('x', { 'Show on Directory': false }).fields), false);
});

test('an application already linked to a Mentors record is not synced twice', async () => {
  assert.equal(sync.applicationEligible(application('x', { 'Mentor Record': ['recMENTOR'] }).fields), false);
});

test('an unreadable applications table changes nothing at all', async () => {
  globalThis.fetch = async (url) => {
    const table = new URL(url).pathname.split('/').pop();
    if (table === 'tblrHW0lkYSAonokn') return { ok: false, status: 403, json: async () => ({}) };
    return { ok: true, json: async () => ({ records: [record('recZZZ')] }) };
  };
  const before = getDb().prepare('SELECT COUNT(*) AS n FROM hr_mentors').get().n;
  const result = await sync.sync();
  assert.equal(result.ok, false, 'half a roster is not a roster');
  assert.equal(getDb().prepare('SELECT COUNT(*) AS n FROM hr_mentors').get().n, before);
});

test('the applications source can be switched off', async () => {
  process.env.HOMEROOM_MENTOR_APPLICATIONS_TABLE = 'off';
  try {
    const tables = [];
    globalThis.fetch = async (url) => {
      tables.push(new URL(url).pathname.split('/').pop());
      return { ok: true, json: async () => ({ records: [record('recAAA')] }) };
    };
    await sync.sync();
    assert.deepEqual([...new Set(tables)], ['tblnV5zn3t2aQHQaX']);
  } finally {
    delete process.env.HOMEROOM_MENTOR_APPLICATIONS_TABLE;
  }
});
