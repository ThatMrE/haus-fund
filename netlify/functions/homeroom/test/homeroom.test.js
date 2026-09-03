process.env.HOMEROOM_SECRET = 'test-secret';

import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { getDb } from '../app/db.js';
import { handle } from '../app/app.js';
import { resetRateLimits } from '../app/http.js';
import * as hr from '../app/models.js';
import { relTime, stamp, parseWhen, toLocalInput } from '../app/views/components.js';

await getDb();

let server;
let base;

before(async () => {
  server = createServer((req, res) => handle(req, res));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

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

/** The page without its chrome: the masthead names the viewer on every page. */
function body(html) {
  return html.replace(/<header class="bar">[\s\S]*?<\/header>/, '')
    .replace(/<footer class="foot">[\s\S]*?<\/footer>/, '');
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

/** Sign a brand-new member up and hand back their logged-in agent. */
async function member(handleName) {
  resetRateLimits();
  const call = agent();
  const csrf = await csrfFor(call, '/homeroom/signup');
  const res = await call('/homeroom/signup', form({
    csrf, handle: handleName, email: `${handleName}@example.com`, password: 'a-good-passphrase',
  }));
  assert.equal(res.status, 303, 'signup should redirect');
  const token = await csrfFor(call);
  assert.ok(token, 'a signed-in member should get a CSRF token');
  return { call, csrf: token, id: handleName };
}

/* --------------------------------------------------------------- the gate */

test('logged out visitors get the gate, not the network', async () => {
  const res = await fetch(`${base}/homeroom`);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /Create an account/);
  assert.match(html, /noindex/, 'Bioface must never be indexed');
  assert.doesNotMatch(html, /Live in the forum/);
});

test('logged out members cannot read the directory or the API', async () => {
  const directory = await fetch(`${base}/homeroom/people`);
  assert.match(await directory.text(), /Create an account/);

  const api = await fetch(`${base}/homeroom/api/members`);
  assert.equal(api.status, 401);
  assert.equal((await api.json()).error, 'members only');
});

test('an unknown /homeroom path 404s in Bioface chrome, not the news layout', async () => {
  const res = await fetch(`${base}/homeroom/nope`);
  assert.equal(res.status, 404);
  assert.match(await res.text(), /Back to the network/);
});

/* -------------------------------------------------------------- the shell */

test('every members-only surface renders for a signed-in member', async () => {
  const { call } = await member('gatecheck');
  const paths = [
    '/homeroom', '/homeroom/settings',
    '/homeroom/yearbook', '/homeroom/yearbook/edit', '/homeroom/people',
    '/homeroom/labs', '/homeroom/labs/new', '/homeroom/labs/cores', '/homeroom/labs/member',
    '/homeroom/labs/member/new',
    '/homeroom/perks', '/homeroom/perks/new',
    '/homeroom/funders', '/homeroom/funders/new', '/homeroom/pipeline',
    '/homeroom/mentors', '/homeroom/hours', '/homeroom/hours/new',
    '/homeroom/jobs', '/homeroom/events', '/homeroom/events/list', '/homeroom/events/new',
    '/homeroom/library', '/homeroom/library/new', '/homeroom/library/notes',
    '/homeroom/publish',
    '/homeroom/intros', '/homeroom/messages',
    '/homeroom/messages/new', '/homeroom/notifications', '/homeroom/search',
    '/homeroom/about',
  ];
  for (const path of paths) {
    const res = await call(path);
    assert.equal(res.status, 200, `${path} should render`);
    assert.match(res.headers.get('content-type'), /text\/html/);
  }
});

test('the chat and forum surfaces are gone, not merely unlinked', async () => {
  const { call } = await member('goneseeker');
  // A removed feature that still answers on its old URL is a removed feature
  // people keep finding by bookmark.
  for (const path of ['/homeroom/forum', '/homeroom/ask', '/homeroom/post/1', '/homeroom/saved',
    '/homeroom/chat', '/homeroom/chat/general', '/homeroom/chat/new',
    '/homeroom/api/feed', '/homeroom/api/chat/general']) {
    assert.equal((await call(path)).status, 404, `${path} should be gone`);
  }
});

/* ------------------------------------------------------------------ forum */






/* ------------------------------------------------------------- directory */

test('the directory finds people by expertise, and profiles render', async () => {
  const { call, csrf, id } = await member('taggedup');
  await call('/homeroom/settings', form({
    csrf,
    name: 'Tag Person',
    headline: 'Fermentation at awkward scales',
    location: 'Porto, PT',
    cohort: 'S26',
    expertise: 'fermentation, bioreactors',
    open_intros: '1',
    open_hours: '1',
  }));

  const profile = await (await call(`/homeroom/p/${id}`)).text();
  assert.match(profile, /Fermentation at awkward scales/);
  assert.match(profile, /open to intros/);

  const filtered = await (await call('/homeroom/people?tag=fermentation')).text();
  assert.match(filtered, new RegExp(id));

  const missing = await (await call('/homeroom/people?tag=astrophysics')).text();
  assert.doesNotMatch(body(missing), new RegExp(`/homeroom/p/${id}"`));

  const api = await (await call(`/homeroom/api/member/${id}`)).json();
  assert.deepEqual(api.member.expertise, ['bioreactors', 'fermentation']);
  assert.equal(api.member.open.office_hours, true);
});

/* ------------------------------------------------------------------ labs */

test('creating a lab makes you its admin and lets you post updates', async () => {
  const { call, csrf, id } = await member('labfounder');
  const created = await call('/homeroom/labs/member/new', form({
    csrf, name: 'Test Foundry', tagline: 'A lab for the tests', kind: 'foundry', stage: 'bench',
    location: 'Nowhere', description: 'Exists only in memory.', tags: 'testing',
  }));
  assert.equal(created.status, 303);
  const slug = created.headers.get('location').split('/').pop();
  const org = await hr.getOrg(slug);
  assert.ok(await hr.isOrgAdmin(org.id, id));

  const posted = await call(`/homeroom/lab/${slug}/update`, form({
    csrf, period: 'Week 1', body: 'Nothing broke.', metrics: '0 incidents', asks: 'A second autoclave',
  }));
  assert.equal(posted.status, 303);
  const page = await (await call(`/homeroom/lab/${slug}`)).text();
  assert.match(page, /Nothing broke/);
  assert.match(page, /0 incidents/);
});

test('outsiders cannot edit a lab or post its updates', async () => {
  const owner = await member('labowner');
  const stranger = await member('labstranger');
  const created = await owner.call('/homeroom/labs/member/new', form({ csrf: owner.csrf, name: 'Closed Doors Lab' }));
  const slug = created.headers.get('location').split('/').pop();

  assert.equal((await stranger.call(`/homeroom/lab/${slug}/edit`)).status, 403);
  assert.equal((await stranger.call(`/homeroom/lab/${slug}/update`, form({
    csrf: stranger.csrf, body: 'I do not work here',
  }))).status, 403);
});

/* ----------------------------------------------------------------- deals */

test('a perk code stays hidden until you claim it', async () => {
  const poster = await member('dealposter');
  const claimer = await member('dealclaimer');
  const created = await poster.call('/homeroom/perks/new', form({
    csrf: poster.csrf, vendor: 'Testing Reagents', title: '40% off everything', category: 'wetlab',
    worth: '€900/yr', code: 'SECRET-CODE-42', summary: 'A discount that does not exist.',
  }));
  const slug = created.headers.get('location').split('/').pop();

  const before = await (await claimer.call(`/homeroom/perk/${slug}`)).text();
  assert.doesNotMatch(before, /SECRET-CODE-42/);
  assert.match(before, /Claim this perk/);

  await claimer.call(`/homeroom/perk/${slug}/claim`, form({ csrf: claimer.csrf }));
  const after = await (await claimer.call(`/homeroom/perk/${slug}`)).text();
  assert.match(after, /SECRET-CODE-42/);
});

test('the old /deals links still land on the perks page', async () => {
  const { call } = await member('dealbookmark');
  const redirect = await call('/homeroom/deals');
  assert.equal(redirect.status, 303);
  assert.equal(redirect.headers.get('location'), '/homeroom/perks');
});

/* --------------------------------------------------------------- funders */

test('funder reviews average, and anonymity is respected on the page', async () => {
  const author = await member('reviewer1');
  const second = await member('reviewer2');
  const created = await author.call('/homeroom/funders/new', form({
    csrf: author.csrf, name: 'Imaginary Capital', kind: 'vc', focus: 'Nothing real',
  }));
  const slug = created.headers.get('location').split('/').pop();
  const funderId = (await hr.getFunder(slug)).id;

  await author.call(`/homeroom/funder/${slug}/review`, form({
    csrf: author.csrf, rating: '5', speed: '5', value_add: '4', invested: '1', body: 'Fast and straight.',
  }));
  await second.call(`/homeroom/funder/${slug}/review`, form({
    csrf: second.csrf, rating: '2', body: 'Fourteen weeks then a pass.', anonymous: '1',
  }));

  assert.equal((await hr.getFunder(slug)).avg_rating, 3.5);
  assert.equal((await hr.getFunder(slug)).review_count, 2);

  const page = await (await author.call(`/homeroom/funder/${slug}`)).text();
  assert.match(page, /Fourteen weeks then a pass/);
  assert.doesNotMatch(body(page), /reviewer2/);

  // Re-reviewing updates in place rather than stacking.
  await author.call(`/homeroom/funder/${slug}/review`, form({ csrf: author.csrf, rating: '3' }));
  assert.equal((await hr.getFunder(slug)).review_count, 2);
});

test('the pipeline is private to its owner', async () => {
  const owner = await member('pipelineowner');
  const nosy = await member('pipelinenosy');
  const created = await owner.call('/homeroom/funders/new', form({ csrf: owner.csrf, name: 'Private Notes Fund' }));
  const slug = created.headers.get('location').split('/').pop();

  await owner.call(`/homeroom/funder/${slug}/track`, form({
    csrf: owner.csrf, status: 'diligence', amount: '€400k', notes: 'They asked for the cap table twice.',
  }));

  assert.match(await (await owner.call('/homeroom/pipeline')).text(), /cap table twice/);
  assert.doesNotMatch(await (await nosy.call('/homeroom/pipeline')).text(), /cap table twice/);
  assert.doesNotMatch(await (await nosy.call(`/homeroom/funder/${slug}`)).text(), /cap table twice/);
});

/* ----------------------------------------------------------- office hours */

test('office hours book, fill up and notify the host', async () => {
  const host = await member('hourhost');
  const first = await member('hourguest1');
  const second = await member('hourguest2');
  const slotId = await hr.createSlot({
    hostId: host.id, title: 'Half an hour on scale-up', startsAt: Math.floor(Date.now() / 1000) + 86400, capacity: 1,
  });

  const booked = await first.call(`/homeroom/hours/${slotId}/book`, form({
    csrf: first.csrf, question: 'Foam control above 300L?',
  }));
  assert.equal(booked.status, 303);
  assert.ok((await hr.notifications(host.id)).some((n) => n.kind === 'booking'));

  const full = await second.call(`/homeroom/hours/${slotId}/book`, form({ csrf: second.csrf }));
  assert.equal(full.status, 400);
  assert.equal((await hr.slotBookings(slotId)).length, 1);

  // Only the person who booked sees the question on the page; the host does too.
  assert.match(await (await host.call(`/homeroom/hours/${slotId}`)).text(), /Foam control above 300L/);

  await first.call(`/homeroom/hours/${slotId}/unbook`, form({ csrf: first.csrf }));
  assert.equal((await hr.slotBookings(slotId)).length, 0);
});

test('you cannot book your own session or one in the past', async () => {
  const host = await member('hourhost2');
  const now = Math.floor(Date.now() / 1000);
  const mine = await hr.createSlot({ hostId: host.id, title: 'My own slot', startsAt: now + 86400 });
  assert.equal((await hr.bookSlot(mine, host.id)).ok, false);

  const past = await hr.createSlot({ hostId: host.id, title: 'Yesterday', startsAt: now - 86400 });
  assert.equal((await hr.bookSlot(past, 'hourhost')).ok, false);
});

/* ------------------------------------------------------------------ jobs */

test('roles need a lab, and applications reach the poster', async () => {
  const founder = await member('jobfounder');
  const applicant = await member('jobapplicant');

  assert.equal((await applicant.call('/homeroom/jobs/new')).status, 400);

  const lab = await founder.call('/homeroom/labs/member/new', form({ csrf: founder.csrf, name: 'Hiring Lab' }));
  const orgId = (await hr.getOrg(lab.headers.get('location').split('/').pop())).id;
  const created = await founder.call('/homeroom/jobs/new', form({
    csrf: founder.csrf, org: String(orgId), title: 'Bench scientist', discipline: 'wetlab',
    employment: 'full-time', location: 'Lisbon', description: 'Do the science.',
  }));
  assert.equal(created.status, 303);
  const jobUrl = created.headers.get('location');

  await applicant.call(`${jobUrl}/apply`, form({ csrf: applicant.csrf, note: 'I have done this.' }));
  assert.ok((await hr.notifications(founder.id)).some((n) => n.kind === 'application'));

  // The poster sees applicants; a stranger does not.
  assert.match(await (await founder.call(jobUrl)).text(), /I have done this/);
  assert.doesNotMatch(await (await applicant.call(jobUrl)).text(), /Applicants \(/);
});

/* ---------------------------------------------------------------- events */

test('RSVPs respect capacity', async () => {
  const host = await member('eventhost');
  const guest = await member('eventguest');
  const spare = await member('eventspare');
  const created = await host.call('/homeroom/events/new', form({
    csrf: host.csrf, title: 'A very small meetup', kind: 'meetup',
    starts_at: toLocalInput(Math.floor(Date.now() / 1000) + 86400), minutes: '60', capacity: '2',
  }));
  const eventUrl = created.headers.get('location');
  const eventId = Number(eventUrl.split('/').pop());

  assert.equal(await hr.myRsvp(eventId, host.id), 'going', 'the host is going to their own event');
  await guest.call(`${eventUrl}/rsvp`, form({ csrf: guest.csrf, status: 'going' }));
  assert.equal((await hr.getEvent(eventId)).going, 2);

  const full = await spare.call(`${eventUrl}/rsvp`, form({ csrf: spare.csrf, status: 'going' }));
  assert.equal(full.status, 400);
  assert.equal((await hr.getEvent(eventId)).going, 2);
});

/* ---------------------------------------------------- intros and messages */

test('an accepted intro opens a thread both members can read', async () => {
  const asker = await member('introasker');
  const target = await member('introtarget');
  await hr.updateMember(target.id, { open_intros: true });

  const requested = await asker.call('/homeroom/intros/new', form({
    csrf: asker.csrf, to: target.id,
    reason: 'You have shipped the thing I am about to ship and I would like twenty minutes on it.',
  }));
  assert.equal(requested.status, 303);
  assert.equal(await hr.pendingIntroCount(target.id), 1);

  const [intro] = (await hr.introsFor(target.id)).incoming;
  const resolved = await target.call(`/homeroom/intros/${intro.id}/resolve`, form({
    csrf: target.csrf, decision: 'accepted',
  }));
  assert.equal(resolved.status, 303);
  const threadUrl = resolved.headers.get('location');
  assert.match(threadUrl, /^\/homeroom\/messages\/\d+$/);

  assert.equal((await target.call(threadUrl)).status, 200);
  assert.equal((await asker.call(threadUrl)).status, 200);

  const outsider = await member('introoutsider');
  assert.equal((await outsider.call(threadUrl)).status, 404, 'a thread you are not in does not exist for you');
});

test('a short intro request is rejected, and closed members cannot be asked', async () => {
  const asker = await member('introasker2');
  const closed = await member('introclosed');
  await hr.updateMember(closed.id, { open_intros: false });

  const short = await asker.call('/homeroom/intros/new', form({ csrf: asker.csrf, to: closed.id, reason: 'hi' }));
  assert.equal(short.status, 403, 'the closed door is checked before the length');

  const open = await member('introopen');
  const tooShort = await asker.call('/homeroom/intros/new', form({ csrf: asker.csrf, to: open.id, reason: 'hi' }));
  assert.equal(tooShort.status, 400);
});

test('direct threads are reused, and unread counts clear on read', async () => {
  const a = await member('msgsender');
  const b = await member('msgreceiver');

  const first = await a.call('/homeroom/messages/new', form({
    csrf: a.csrf, to: b.id, text: 'First message.',
  }));
  const threadUrl = first.headers.get('location');

  const second = await a.call('/homeroom/messages/new', form({
    csrf: a.csrf, to: b.id, text: 'Second message, same thread.',
  }));
  assert.equal(second.headers.get('location'), threadUrl, 'a second DM reuses the thread');

  assert.equal(await hr.unreadMessageCount(b.id), 2);
  await b.call(threadUrl);
  assert.equal(await hr.unreadMessageCount(b.id), 0);
  assert.equal(await hr.unreadMessageCount(a.id), 0, 'your own messages are never unread');
});

/* ---------------------------------------------------------------- search */

test('search covers every surface at once', async () => {
  const { call, csrf, id } = await member('searcher');
  await call('/homeroom/labs/member/new', form({ csrf, name: 'Chromatophore Works', tagline: 'We make them' }));
  await call('/homeroom/settings', form({ csrf, headline: 'Chromatophore obsessive' }));

  const results = await (await call('/homeroom/api/search?q=chromatophore')).json();
  assert.ok(results.results.orgs.length, 'labs should match');
  assert.ok(results.results.members.some((m) => m.user_id === id), 'members should match');

  const page = await (await call('/homeroom/search?q=chromatophore')).text();
  assert.match(page, /Chromatophore Works/);
});

/* ------------------------------------------------------------------ CSRF */

test('writes without a CSRF token are refused', async () => {
  const { call } = await member('csrfvictim');
  for (const [path, fields] of [
    ['/homeroom/settings', { headline: 'hijacked' }],
    ['/homeroom/labs/new', { name: 'Hijacked Lab' }],
  ]) {
    const res = await call(path, form(fields));
    assert.equal(res.status, 403, `${path} must reject a missing token`);
  }
  assert.equal((await hr.getMember('csrfvictim')).headline, '');
});


/* ------------------------------------------------------------- unit bits */

test('slugs are unique per table', async () => {
  const a = await hr.createFunder({ name: 'Same Name Fund' });
  const b = await hr.createFunder({ name: 'Same Name Fund' });
  assert.equal((await hr.getFunder(a)).slug, 'same-name-fund');
  assert.equal((await hr.getFunder(b)).slug, 'same-name-fund-2');
});

test('tags are normalised, deduplicated and capped', () => {
  assert.deepEqual(hr.parseTags('CRISPR, crispr, Protein Design, , ngs'), ['crispr', 'protein-design', 'ngs']);
  assert.equal(hr.parseTags('a,b,c,d,e,f,g,h', 3).length, 3);
});


test('time helpers read forwards and backwards, and round-trip through the form', () => {
  const now = Math.floor(Date.now() / 1000);
  assert.match(relTime(now + 3 * 86400, now), /^in 3 days$/);
  assert.match(relTime(now - 2 * 3600, now), /^2 hours ago$/);
  assert.match(relTime(now + 10, now), /starting now/);
  assert.match(stamp(1770000000), /UTC$/);

  const when = now - (now % 60);
  assert.equal(parseWhen(toLocalInput(when)), when, 'the datetime-local value survives a round trip as UTC');
  assert.equal(parseWhen('not a date'), null);
});


/* ------------------------------------------------------------- accounts */

test('signup validates the handle, the email and the password', async () => {
  resetRateLimits();
  const call = agent();
  const csrf = await csrfFor(call, '/homeroom/signup');
  const attempt = (fields) => call('/homeroom/signup', form({ csrf, ...fields }));

  const short = await attempt({ handle: 'x', email: 'a@example.com', password: 'a-good-passphrase' });
  assert.equal(short.status, 400);
  assert.match(await short.text(), /2-20 characters/);

  const badEmail = await attempt({ handle: 'validhandle', email: 'not-an-email', password: 'a-good-passphrase' });
  assert.equal(badEmail.status, 400);
  assert.match(await badEmail.text(), /email address/);

  const weak = await attempt({ handle: 'validhandle', email: 'a@example.com', password: 'short' });
  assert.equal(weak.status, 400);
  assert.match(await weak.text(), /at least 10 characters/);
});

test('a handle cannot be taken twice, and the email is not confirmed either way', async () => {
  const first = await member('takenhandle');
  assert.ok(first);

  resetRateLimits();
  const call = agent();
  const csrf = await csrfFor(call, '/homeroom/signup');
  const dupe = await call('/homeroom/signup', form({
    csrf, handle: 'takenhandle', email: 'someone-else@example.com', password: 'a-good-passphrase',
  }));
  assert.equal(dupe.status, 400);
  assert.match(await dupe.text(), /taken/);

  // A duplicate email must not be reported as such: that would confirm to a
  // stranger that the address has an account here.
  const csrf2 = await csrfFor(call, '/homeroom/signup');
  const sameEmail = await call('/homeroom/signup', form({
    csrf: csrf2, handle: 'otherhandle', email: 'takenhandle@example.com', password: 'a-good-passphrase',
  }));
  assert.equal(sameEmail.status, 400);
  assert.doesNotMatch(await sameEmail.text(), /already (registered|exists|has)/i);
});

test('the first account through the door is a steward, later ones are not', async () => {
  const stewards = (await (await getDb()).prepare('SELECT id FROM users WHERE is_admin = 1').all());
  assert.equal(stewards.length, 1, 'exactly one steward');
});

test('sign in refuses a wrong password without saying which half was wrong', async () => {
  const { id } = await member('signinuser');
  resetRateLimits();
  const call = agent();

  const wrong = await call('/homeroom/login', form({
    email: `${id}@example.com`, password: 'not-the-password',
  }));
  assert.equal(wrong.status, 401);
  const text = await wrong.text();
  assert.match(text, /do not match/);

  // The same answer for an address that has no account at all.
  const nobody = await call('/homeroom/login', form({
    email: 'nobody-at-all@example.com', password: 'not-the-password',
  }));
  assert.equal(nobody.status, 401);
  assert.equal(await nobody.text(), text.replace(`${id}@example.com`, 'nobody-at-all@example.com'));
});

test('a session signs you in, and signing out ends it', async () => {
  const { call, csrf, id } = await member('sessionuser');
  assert.match(await (await call('/homeroom')).text(), new RegExp(id));

  const out = await call('/homeroom/logout', form({ csrf }));
  assert.equal(out.status, 303);
  assert.match(await (await call('/homeroom')).text(), /Create an account/, 'back to the gate');
});

test('a reset link works once, changes the password, and drops every session', async () => {
  const { id } = await member('resetuser');
  const email = `${id}@example.com`;

  resetRateLimits();
  const call = agent();
  const csrf = await csrfFor(call, '/homeroom/forgot');
  const asked = await call('/homeroom/forgot', form({ csrf, email }));
  assert.equal(asked.status, 200);
  const sent = await asked.text();
  assert.match(sent, /Check your email/);
  assert.doesNotMatch(sent, /reset\?token=/, 'the link is never shown to whoever asked');

  // Read the token the way the mail would carry it.
  const row = (await (await getDb())
    .prepare('SELECT token_hash FROM password_resets WHERE user_id = ? ORDER BY created_at DESC')
    .get(id));
  assert.ok(row, 'a token was minted');

  // Only its hash is stored, so mint a fresh one here to drive the rest.
  const { createResetToken } = await import('../app/auth.js');
  const token = await createResetToken(id);

  assert.equal((await call(`/homeroom/reset?token=${token}`)).status, 200);
  assert.equal((await call('/homeroom/reset?token=deadbeef')).status, 410);

  const resetCsrf = await csrfFor(call, `/homeroom/reset?token=${token}`);
  const mismatch = await call('/homeroom/reset', form({
    csrf: resetCsrf, token, password: 'a-new-passphrase', confirm: 'something-else',
  }));
  assert.equal(mismatch.status, 400);

  const done = await call('/homeroom/reset', form({
    csrf: resetCsrf, token, password: 'a-new-passphrase', confirm: 'a-new-passphrase',
  }));
  assert.equal(done.status, 200);
  assert.match(await done.text(), /Password saved/);

  assert.equal((await call(`/homeroom/reset?token=${token}`)).status, 410, 'single use');

  const fresh = agent();
  const old = await fresh('/homeroom/login', form({ email, password: 'a-good-passphrase' }));
  assert.equal(old.status, 401, 'the old password is dead');
  const now = await fresh('/homeroom/login', form({ email, password: 'a-new-passphrase' }));
  assert.equal(now.status, 303, 'the new one works');
});

test('a reset request for an unknown address looks identical', async () => {
  resetRateLimits();
  const call = agent();
  const csrf = await csrfFor(call, '/homeroom/forgot');
  const res = await call('/homeroom/forgot', form({ csrf, email: 'stranger@example.com' }));
  assert.equal(res.status, 200);
  assert.match(await res.text(), /Check your email/);
  assert.equal(
    (await (await getDb()).prepare('SELECT COUNT(*) AS n FROM password_resets WHERE user_id = ?').get('stranger')).n,
    0,
    'and mints nothing',
  );
});

test('password hashes and reset tokens are never stored in the clear', async () => {
  const { id } = await member('hashcheck');
  const account = (await (await getDb()).prepare('SELECT password_hash FROM users WHERE id = ?').get(id));
  assert.match(account.password_hash, /^scrypt\$/);
  assert.doesNotMatch(account.password_hash, /a-good-passphrase/);

  const { createResetToken } = await import('../app/auth.js');
  const token = await createResetToken(id);
  const stored = (await (await getDb()).prepare('SELECT token_hash FROM password_resets WHERE user_id = ?').all(id));
  assert.ok(stored.length);
  for (const row of stored) assert.notEqual(row.token_hash, token, 'the row holds a hash, not the token');
});

test('the session cookie is Secure behind https, and not over plain http', async () => {
  resetRateLimits();
  const fields = new URLSearchParams({
    handle: 'securecookie', email: 'securecookie@example.com', password: 'a-good-passphrase',
  }).toString();

  const overHttps = await fetch(`${base}/homeroom/signup`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-forwarded-proto': 'https' },
    body: fields,
    redirect: 'manual',
  });
  const cookie = overHttps.headers.getSetCookie?.()[0] ?? '';
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Lax/i);
  assert.match(cookie, /Secure/, 'a members-only session must not travel over plain http');

  resetRateLimits();
  const overHttp = await fetch(`${base}/homeroom/signup`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-forwarded-proto': 'http' },
    body: new URLSearchParams({
      handle: 'plaincookie', email: 'plaincookie@example.com', password: 'a-good-passphrase',
    }).toString(),
    redirect: 'manual',
  });
  const plain = overHttp.headers.getSetCookie?.()[0] ?? '';
  assert.doesNotMatch(plain, /Secure/, 'but local development over http still works');
});

/* -------------------------------------------- changing a local password */

test('a member can change their own local password', async () => {
  const { call, csrf } = await member('localrotate');
  const res = await call('/homeroom/password', form({
    csrf, current: 'a-good-passphrase',
    password: 'the-replacement-phrase', confirm: 'the-replacement-phrase',
  }));
  assert.equal(res.status, 303);

  const { verifyPassword } = await import('../app/auth.js');
  assert.ok(verifyPassword('the-replacement-phrase', (await hr.getUser('localrotate')).password_hash));
});

test('the current local password has to be right', async () => {
  const { call, csrf } = await member('localguess');
  const res = await call('/homeroom/password', form({
    csrf, current: 'not-what-it-was',
    password: 'the-replacement-phrase', confirm: 'the-replacement-phrase',
  }));

  assert.equal(res.status, 400);
  assert.match(await res.text(), /current password is wrong/i);
  const { verifyPassword } = await import('../app/auth.js');
  assert.ok(verifyPassword('a-good-passphrase', (await hr.getUser('localguess')).password_hash), 'unchanged');
});

test('changing a local password ends the other sessions and keeps mine', async () => {
  const { call, csrf } = await member('localkick');

  // A second session for the same account, as if from another machine.
  resetRateLimits();
  const elsewhere = agent();
  const loginCsrf = await csrfFor(elsewhere, '/homeroom/login');
  await elsewhere('/homeroom/login', form({
    csrf: loginCsrf, email: 'localkick@example.com', password: 'a-good-passphrase',
  }));
  assert.equal((await elsewhere('/homeroom/settings')).status, 200);

  await call('/homeroom/password', form({
    csrf, current: 'a-good-passphrase',
    password: 'a-fresh-new-passphrase', confirm: 'a-fresh-new-passphrase',
  }));

  assert.equal((await call('/homeroom/settings')).status, 200, 'I stay signed in');
  assert.match(await (await elsewhere('/homeroom/settings')).text(), /Members only/i);
});
