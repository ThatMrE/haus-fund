/*
 * The connector's LinkedIn network as an intro source (INTRO-ENGINE.md §20.8).
 *
 * The negative assertions are the point, and like the intro engine's they are
 * made against rendered bytes where a member could see them:
 *
 *   - an address from the export never reaches a member, only a steward's
 *     compose field;
 *   - someone who said "never" is not written at import and not found after;
 *   - searching the network spends no Happenstance credits;
 *   - only a steward can import.
 *
 * The fixture is synthetic. The real export never belongs in this repository.
 */

process.env.HOMEROOM_DB = ':memory:';
process.env.HOMEROOM_SECRET = 'test-secret';
process.env.HOMEROOM_SEED = 'off';
process.env.HOMEROOM_INTRO_ENABLED = '1';
process.env.HOMEROOM_HAPPENSTANCE_KEY = 'test-key';
process.env.HOMEROOM_INTRO_CONNECTOR = 'Elliot';

import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { getDb } from '../app/db.js';
import { handle } from '../app/app.js';
import { resetRateLimits } from '../app/http.js';
import * as hr from '../app/models.js';
import * as intro from '../app/introengine.js';
import * as network from '../app/network.js';

getDb();

let server;
let base;
const realFetch = globalThis.fetch;

/* Any call to Happenstance is counted. Searching the network must make none. */
let happenstanceCalls = 0;
globalThis.fetch = async (input, init) => {
  const url = String(input);
  if (url.includes('api.happenstance.ai')) {
    happenstanceCalls += 1;
    return new Response(JSON.stringify({ balance_credits: 44, has_credits: true }), { status: 200 });
  }
  if (url.includes('api.resend.com')) return new Response('{}', { status: 200 });
  return realFetch(input, init);
};

before(async () => {
  server = createServer(async (req, res) => await handle(req, res));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  getDb().prepare('INSERT OR IGNORE INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)')
    .run('steward', 'steward@fixture.test', 'x', Math.floor(Date.now() / 1000));
});

after(() => {
  globalThis.fetch = realFetch;
  server.close();
});

beforeEach(() => {
  happenstanceCalls = 0;
  resetRateLimits();
  const db = getDb();
  for (const table of ['hr_intro_events', 'hr_intro_cooldowns', 'hr_intro_suppression',
    'hr_intro_requests', 'hr_li_connections']) {
    db.exec(`DELETE FROM ${table}`);
  }
});

/* -------------------------------------------------------------- fixtures */

const EXPORT = `Notes:
"When exporting your connection data, you may notice that some of the email addresses are missing."

First Name,Last Name,Email Address,Company,Position,Connected On
Ada,Okafor,ada.okafor@example.org,"Ferment Labs, Inc.","Director, Regulatory Affairs",04 May 2017
Ben,Ruiz,,Seed Capital,Partner,12 Jan 2019
Cara,Lind,,State University,Assistant Professor of Food Science,30 Sep 2016
,,,Nowhere,Nobody,01 Jan 2020
Dev,Patel,,Scale Co LLC,Head of Fermentation Scale-Up,15 Mar 2022
ada,  okafor,,Ferment Labs,"Director, Regulatory Affairs",04 May 2017
Erin,Shaw,,Brightline Bio,Director of Product,02 Feb 2021
`;

const steward = { id: 'steward', is_admin: 1 };

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
  const id = `netfounder${seq}`;
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

async function imported(text = EXPORT) {
  const result = await network.importExport(text, { actor: steward });
  assert.ok(result.ok, result.error);
  return result;
}

const idOf = async (name) => Number(getDb().prepare('SELECT id FROM hr_li_connections WHERE name = ?').get(name)?.id);

/* ================================================================ parsing */

test('the export is read past its preamble, with quoted commas and messy rows handled', () => {
  const read = network.readExport(EXPORT);
  assert.ok(read.ok);
  assert.equal(read.noName, 1, 'the row with no name is skipped');
  assert.equal(read.duplicate, 1, 'the same person twice, with different case and suffix, is one person');
  assert.equal(read.people.length, 5);

  const ada = read.people.find((p) => p.name.toLowerCase() === 'ada okafor');
  assert.equal(ada.company, 'Ferment Labs', 'the legal suffix is stripped');
  assert.equal(ada.position, 'Director, Regulatory Affairs', 'a comma inside quotes stays in the field');
  assert.equal(ada.connected_on, '2017-05-04');
  assert.deepEqual(ada.tracks, ['regulatory']);

  assert.ok(read.people.find((p) => p.name === 'Ben Ruiz').tracks.includes('investor'), 'a capital firm says investor');
  assert.ok(read.people.find((p) => p.name === 'Cara Lind').tracks.includes('academic'));
  assert.ok(read.people.find((p) => p.name === 'Dev Patel').tracks.includes('manufacturing'));
  assert.deepEqual(read.people.find((p) => p.name === 'Erin Shaw').tracks, [],
    '"director" contains "cto" and must not read as engineering');

  assert.equal(network.readExport('name,company\nA,B').ok, false, 'a file that is not the export is refused');

  const merged = network.readExport('First Name,Last Name,Email Address,Company,Position,Connected On\n'
    + 'Fay,Moss,,Acme,CEO,01 Jan 2020\nFay,Moss,fay@example.org,Acme Inc.,CEO,01 Jan 2020\n');
  assert.equal(merged.people.length, 1);
  assert.equal(merged.people[0].email, 'fay@example.org', 'an address on the duplicate is kept');
});

test('a person keeps the same key whatever the case, spacing or legal suffix', () => {
  assert.equal(network.personHash('Ada Okafor', 'Ferment Labs, Inc.'), network.personHash('ada  okafor', 'Ferment Labs'));
  assert.notEqual(network.personHash('Ada Okafor', 'Ferment Labs'), network.personHash('Ada Okafor', 'Other Co'));
});

/* ================================================================= import */

test('importing twice updates in place, and someone missing from the newer file drops out of search', async () => {
  const first = await imported();
  assert.equal(first.imported, 5);
  assert.equal(first.withEmail, 1);
  const before = await idOf('Dev Patel');

  const second = await imported();
  assert.equal(second.imported, 5);
  assert.equal(Number(getDb().prepare('SELECT COUNT(*) AS n FROM hr_li_connections').get().n), 5, 'no duplicate rows');
  assert.equal(await idOf('Dev Patel'), before, 'a re-import keeps the same row');

  const withoutDev = EXPORT.split('\n').filter((l) => !l.startsWith('Dev,')).join('\n');
  const third = await imported(withoutDev);
  assert.equal(third.dropped, 1);
  assert.equal((await network.search('fermentation')).people.length, 0, 'not in the newest export, not searchable');
});

test('the address is encrypted at rest and survives a re-import that lacks it', async () => {
  await imported();
  const row = getDb().prepare("SELECT email_enc FROM hr_li_connections WHERE name = 'Ada Okafor'").get();
  assert.ok(row.email_enc.startsWith('v1.'));
  assert.ok(!row.email_enc.includes('ada.okafor'));

  await imported(EXPORT.replace('ada.okafor@example.org', ''));
  const hash = network.personHash('Ada Okafor', 'Ferment Labs');
  assert.equal(await network.addressFor(hash), 'ada.okafor@example.org');
});

test('someone who said never is not written at import, and not found if they say it after', async () => {
  await intro.suppress(network.personHash('Ben Ruiz', 'Seed Capital'));
  const result = await imported();
  assert.equal(result.suppressed, 1);
  assert.equal(getDb().prepare("SELECT COUNT(*) AS n FROM hr_li_connections WHERE name = 'Ben Ruiz'").get().n, 0);

  assert.equal((await network.search('regulatory')).people.length, 1);
  await intro.suppress(network.personHash('Ada Okafor', 'Ferment Labs'));
  assert.equal((await network.search('regulatory')).people.length, 0);
  assert.equal(await network.getConnection(await idOf('Ada Okafor')), null, 'and cannot be asked for by id');
});

test('only a steward can import', async () => {
  assert.equal((await network.importExport(EXPORT, { actor: { id: 'x', is_admin: 0 } })).ok, false);
  const who = await member();
  const res = await who.call('/homeroom/stewards/intros/network', form({ csrf: who.csrf, csv: EXPORT }));
  assert.equal(res.status, 403);
  assert.equal(Number(getDb().prepare('SELECT COUNT(*) AS n FROM hr_li_connections').get().n), 0);

  const admin = await member({ admin: true });
  const ok = await admin.call('/homeroom/stewards/intros/network', form({ csrf: admin.csrf, csv: EXPORT }));
  assert.equal(ok.status, 200);
  assert.match(await ok.text(), /Imported 5 people/);
});

/* ================================================================= search */

test('a member searches the network for free, and never sees an address', async () => {
  await imported();
  const who = await member();
  const page = await (await who.call('/homeroom/intros/search?q=regulatory')).text();
  assert.match(page, /Ada Okafor/);
  assert.match(page, /Elliot’s network/);
  assert.match(page, /since 2017/);
  assert.ok(!page.includes('ada.okafor@example.org'), 'the address is not on the member’s page');
  assert.ok(!page.includes('v1.'), 'nor its ciphertext');
  assert.equal(happenstanceCalls, 0, 'searching the network spends no credits');

  // A position hit outranks a company or a name that merely contains the word.
  const ranked = await network.search('fermentation');
  assert.equal(ranked.people[0].name, 'Dev Patel');
  assert.equal(ranked.loose, false);

  // Nobody matches every word: fall back to some, and say so.
  const partial = await network.search('fermentation astrophysics');
  assert.equal(partial.loose, true);
  assert.equal(partial.people[0].name, 'Dev Patel');
  assert.match(await (await who.call('/homeroom/intros/search?q=fermentation+astrophysics')).text(),
    /Nobody matched every word/);

  // A Happenstance-style sentence is not ten thousand partial matches.
  const sentence = await network.search('someone who has taken a fermentation ingredient through FDA');
  assert.deepEqual(sentence.terms, ['taken', 'fermentation', 'ingredient', 'through', 'fda']);
  assert.ok(sentence.people.every((p) => p.name === 'Dev Patel'), 'only the fermentation hit, not everyone');

  const ask = await (await who.call(`/homeroom/intros/network/${await idOf('Ada Okafor')}`)).text();
  assert.ok(!ask.includes('ada.okafor@example.org'), 'nor on the ask page');
  assert.match(ask, /may have changed/);
});

test('an ask from the network needs a longer why, then becomes an ordinary request', async () => {
  await imported();
  const who = await member();
  const path = `/homeroom/intros/network/${await idOf('Ada Okafor')}`;
  const need = 'We are six weeks from a GRAS self-affirmation filing and cannot tell whether the panel needs a toxicologist.';

  const short = await who.call(path, form({ csrf: who.csrf, need, why_them: 'Regulatory person.', asking_for: '20 minutes on a call' }));
  assert.equal(short.status, 200);
  assert.match(await short.text(), /at least 60 characters/);
  assert.equal(Number(getDb().prepare('SELECT COUNT(*) AS n FROM hr_intro_requests').get().n), 0);

  const ok = await who.call(path, form({ csrf: who.csrf, need,
    why_them: 'She runs regulatory affairs at a fermentation company, which is the exact path we are on.',
    asking_for: '20 minutes on a call' }));
  assert.equal(ok.status, 303);
  const row = getDb().prepare('SELECT * FROM hr_intro_requests').get();
  assert.equal(row.source, 'linkedin');
  assert.equal(row.status, 'requested');
  assert.equal(row.through, 'Elliot');
  assert.equal(row.to_enc, '', 'no address is attached until a steward sends');

  // The steward sees the address on file prefilled, and the member still does not.
  const admin = await member({ admin: true });
  const queue = await (await admin.call('/homeroom/stewards/intros')).text();
  assert.match(queue, /value="ada.okafor@example.org"/);
  const mine = await (await who.call('/homeroom/intros/mine')).text();
  assert.ok(!mine.includes('ada.okafor@example.org'));
  assert.match(mine, /still open/);
});

test('a decline on a network request reads exactly like one still waiting', async () => {
  await imported();
  const who = await member();
  const make = async (name) => {
    const created = await intro.createRequest({
      person: network.asPerson(await network.getConnection(await idOf(name)), 'Elliot'), memberId: who.id,
      need: 'A real need, long enough to pass the minimum the form enforces on members.',
      whyThem: 'A real reason that is long enough to pass the network source minimum length.',
    });
    assert.ok(created.ok, created.message);
    return created.id;
  };
  await make('Cara Lind');
  const declined = await make('Dev Patel');
  const sent = await intro.sendPermission({ requestId: declined, actor: steward, address: 'dev@example.org' });
  await intro.answer({ token: sent.token, decision: 'no', note: 'Too busy.' });

  const views = await intro.requestsFor(who.id);
  assert.deepEqual([...new Set(views.map((v) => v.stage))], ['still open']);
});
