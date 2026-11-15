/*
 * The roster against Haus Fund OS / Founders.
 *
 * The Biopunk People table this gate used to read froze on Nov 9, 2026, and the
 * Spring 2027 cohort exists only in Fund OS. These tests pin the Fund OS
 * dialect: Active / Graduated / Departed statuses, a hand-set lifecycle that
 * the move-in and move-out dates override, and a house that comes from the
 * founder's cohort. Airtable is stubbed by replacing `globalThis.fetch`.
 */

process.env.HOMEROOM_DB = ':memory:';
process.env.HOMEROOM_SECRET = 'test-secret';
process.env.HOMEROOM_ROSTER_TOKEN = 'pat-test';
delete process.env.HOMEROOM_ROSTER_SOURCE;
delete process.env.HOMEROOM_ROSTER_BASE;
delete process.env.HOMEROOM_ROSTER_TABLE;

import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import * as roster from '../app/roster.js';

const TODAY = '2026-11-14';
const verdict = (fields) => roster.evaluate(fields, { today: TODAY }).verdict;
const sel = (name) => ({ id: 'selx', name });

/* --------------------------------------------------------------- the source */

test('the gate reads Fund OS Founders by default', () => {
  const t = roster.target();
  assert.equal(t.source, 'fundos');
  assert.equal(t.base, 'appxqPp1CYEDNLXHS');
  assert.equal(t.table, 'tblhZB88Ab2jQyVxS');
});

test('the archived Biopunk People table is still reachable on purpose', () => {
  process.env.HOMEROOM_ROSTER_SOURCE = 'biopunk';
  try {
    const t = roster.target();
    assert.equal(t.base, 'app9STfjol4NHGEWj');
    assert.ok(t.fields.includes('Lifecycle Status (Computed)'));
  } finally {
    delete process.env.HOMEROOM_ROSTER_SOURCE;
  }
});

test('nothing private is ever requested from Founders', () => {
  // Founders also holds emergency contacts, home addresses, visa details and
  // more. The field list is the whole of what this module may read.
  const fields = roster.target().fields;
  for (const field of fields) {
    assert.doesNotMatch(field, /emergency|address|visa|birthday|phone|medical|allerg|dietary|passport/i, field);
  }
  assert.deepEqual(fields.filter((f) => /mail/i.test(f)), ['Email', 'Additional Email', 'Personal Email']);
});

/* ---------------------------------------------------------------- the rule */

test('an admitted founder who has not moved in yet is let in by Status = Active', () => {
  assert.equal(verdict({ Status: sel('Active'), 'Move-in Date': '2027-01-15' }), 'allow');
});

test('the Accepted checkbox lets an admitted founder in before move-in', () => {
  assert.equal(verdict({ Accepted: true, 'Move-in Date': '2027-01-15' }), 'allow');
  assert.equal(verdict({ Accepted: false, 'Move-in Date': '2027-01-15' }), 'deny', 'unticked is no offer');
  assert.ok(roster.target().fields.includes('Accepted'));
});

test('a ticked box settles it even when Status says Departed', () => {
  assert.equal(verdict({ Accepted: true, Status: sel('Departed'), 'Lifecycle Status': sel('Applicant') }), 'allow',
    'Accepted settles it, as the Accepted status did; a steward unticks it to take an offer back');
});

test('without Active, a future move-in is still an applicant', () => {
  assert.equal(verdict({ 'Move-in Date': '2027-01-15' }), 'deny');
  assert.equal(verdict({ 'Lifecycle Status': sel('Applicant') }), 'deny');
  assert.equal(verdict({ 'Lifecycle Status': sel('Past applicant') }), 'deny');
  assert.equal(verdict({ 'Lifecycle Status': sel('Guest') }), 'deny');
});

test('the dates make a resident or an alum, as the old formula did', () => {
  assert.equal(roster.lifecycleOf({ 'Move-in Date': '2026-06-01' }, TODAY), 'Resident');
  assert.equal(roster.lifecycleOf({ 'Move-in Date': '2026-01-10', 'Move-out Date': '2026-04-06' }, TODAY), 'Alumni');
  assert.equal(verdict({ 'Move-in Date': '2026-01-10', 'Move-out Date': '2026-04-06' }), 'allow');
});

test('the dates outrank a stale hand-set lifecycle', () => {
  assert.equal(roster.lifecycleOf({ 'Lifecycle Status': sel('Applicant'), 'Move-in Date': '2026-06-08' }, TODAY), 'Resident');
});

test('with no dates, the hand-set lifecycle decides', () => {
  assert.equal(verdict({ 'Lifecycle Status': sel('Resident') }), 'allow');
  assert.equal(verdict({ 'Lifecycle Status': sel('Alumni') }), 'allow');
  assert.equal(verdict({ 'Lifecycle Status': sel('Subletter') }), 'allow');
});

test('a resident type is enough on its own', () => {
  assert.equal(verdict({ 'Resident type': sel('Core resident') }), 'allow');
  assert.equal(verdict({ 'Resident type': sel('RA') }), 'allow');
  assert.equal(verdict({ 'Resident type': sel('Guest') }), 'deny');
});

test('Graduated is let in: alumni keep the room', () => {
  assert.equal(verdict({ Status: sel('Graduated') }), 'allow');
});

test('Departed against a residency goes to a steward, not to a guess', () => {
  const r = roster.evaluate({ Status: sel('Departed'), 'Lifecycle Status': sel('Alumni') }, { today: TODAY });
  assert.equal(r.verdict, 'review');
  assert.match(r.reason, /departed/);
});

test('a founder with only a Name field still gets a name', () => {
  const r = roster.evaluate({ Name: 'Ada Lovelace', Status: sel('Active') }, { today: TODAY });
  assert.equal(r.person.name, 'Ada Lovelace');
});

/* ---------------------------------------------------- the lookup, end to end */

const realFetch = globalThis.fetch;
after(() => { globalThis.fetch = realFetch; });

test('a lookup names its fields, and finds the house through the cohort', async () => {
  const seen = [];
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    seen.push(url);
    const table = url.pathname.split('/').pop();
    const body = (records) => new Response(JSON.stringify({ records }), { status: 200 });
    if (table === 'tblhZB88Ab2jQyVxS') {
      return body([{ id: 'recF', fields: { 'First Name': 'Ada', Status: 'Active', 'Move-in Date': '2027-01-15', Cohort: ['recCohort'] } }]);
    }
    if (table === 'tblxqV3oNpYUmofHF') return body([{ id: 'recCohort', fields: { 'Cohort Name': 'Spring 2027', House: ['recHouse'] } }]);
    if (table === 'tblwD7b5yXUIXa5Kl') return body([{ id: 'recHouse', fields: { House: 'PunkHaus' } }]);
    return new Response('{}', { status: 404 });
  };

  const result = await roster.lookup('ada@example.org');
  assert.equal(result.verdict, 'allow');
  assert.equal(result.person.cohort, 'Spring 2027');
  assert.equal(result.person.house, 'PunkHaus');

  const founders = seen.find((u) => u.pathname.endsWith('/tblhZB88Ab2jQyVxS'));
  assert.ok(founders.pathname.startsWith('/v0/appxqPp1CYEDNLXHS/'));
  assert.deepEqual(founders.searchParams.getAll('fields[]'), roster.target().fields);
  assert.ok(!seen.some((u) => u.pathname.includes('app9STfjol4NHGEWj')), 'the archive is never read by default');
});
