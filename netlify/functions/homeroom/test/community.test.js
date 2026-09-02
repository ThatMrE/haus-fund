/*
 * The community surfaces: chat, the yearbook, the atlas, perks, Rate My Funder,
 * mentors, the calendar, the training library and publishing.
 *
 * Same shape as homeroom.test.js — a real HTTP server against an in-memory
 * database, no network. What is asserted here is deliberately weighted toward
 * the claims most likely to quietly stop being true: unread counts, who can see
 * whose review, whether a re-sync duplicates events, and whether publishing
 * fails safely when Supabase is not configured.
 */

process.env.HOMEROOM_DB = ':memory:';
process.env.HOMEROOM_SECRET = 'test-secret';

import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { getDb } from '../app/db.js';
import { handle } from '../app/app.js';
import { resetRateLimits } from '../app/http.js';
import * as hr from '../app/models.js';
import { normalizeEvent, configured as lumaConfigured } from '../app/luma.js';
import { configured as supabaseConfigured } from '../app/supabase.js';
import { TRACKS, LIBRARY_MODULES } from '../app/data/curriculum.js';
import { PERKS, PERK_CATEGORIES } from '../app/data/perks.js';
import { FUNDERS as CAPITAL_MAP } from '../app/data/funders.js';
import { ATLAS_LABS } from '../app/data/atlas.js';
import { MENTORS } from '../app/data/mentors.js';
import { NETWORK_MENTORS } from '../app/data/network.js';
import { seedHomeroom } from '../app/seed.js';

getDb();

let server;
let base;

before(async () => {
  // These surfaces are about a populated room — a hundred mentors, forty labs,
  // a whole catalogue — so the tests run against the seeded network rather than
  // building each fixture by hand. Same data a fresh deploy gets.
  seedHomeroom();
  server = createServer((req, res) => handle(req, res));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

/** The page without its chrome: the masthead names the viewer on every page. */
function body(html) {
  return html.replace(/<header class="bar">[\s\S]*?<\/header>/, '')
    .replace(/<footer class="foot">[\s\S]*?<\/footer>/, '');
}

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

/** This member's unread count for one channel, which is what the pip shows. */
function unreadIn(userId, slug) {
  return hr.channelsFor(userId).find((channel) => channel.slug === slug)?.unread ?? 0;
}

async function member(handleName) {
  resetRateLimits();
  const call = agent();
  const csrf = await csrfFor(call, '/homeroom/signup');
  const res = await call('/homeroom/signup', form({
    csrf, handle: handleName, email: `${handleName}@example.com`, password: 'a-good-passphrase',
  }));
  assert.equal(res.status, 303, 'signup should redirect');
  const token = await csrfFor(call);
  return { call, csrf: token, id: handleName };
}

/* =========================================================== the data sets */

test('the researched data sets are well formed', () => {
  const categories = new Set(PERK_CATEGORIES.map((c) => c.slug));
  for (const perk of PERKS) {
    assert.ok(perk.vendor && perk.title, 'every perk needs a vendor and a title');
    assert.ok(categories.has(perk.category), `${perk.vendor}: unknown category ${perk.category}`);
    assert.ok(['open', 'code', 'apply', 'partner'].includes(perk.access),
      `${perk.vendor}: unknown access ${perk.access}`);
  }
  // The catalogue has to actually span startup support, not just the bench.
  const covered = new Set(PERKS.map((p) => p.category));
  assert.ok(covered.size >= 15, 'perks should cover nearly every category');

  const kinds = new Set(CAPITAL_MAP.map((f) => f.kind));
  for (const kind of ['grant', 'accelerator', 'preseed', 'seed', 'studio', 'fellowship', 'angel', 'prize']) {
    assert.ok(kinds.has(kind), `the capital map is missing ${kind}`);
  }

  for (const [name, city, , region, kind, status] of ATLAS_LABS) {
    assert.ok(name && city, 'every lab needs a name and a place');
    assert.ok(['active', 'limited', 'dormant', 'unknown'].includes(status), `${name}: bad status`);
    assert.ok(region && kind, `${name}: needs a region and a kind`);
  }

  assert.ok(MENTORS.length >= 100, 'the mentor roster should be at least a hundred deep');
  const tracks = new Set(TRACKS.map((t) => t.slug));
  for (const module of LIBRARY_MODULES) {
    assert.ok(tracks.has(module.track), `${module.slug}: unknown track`);
    assert.ok(module.outcomes.length, `${module.slug}: a module without outcomes is a reading list`);
    assert.ok(module.work.length, `${module.slug}: a module without work is not a training system`);
  }
});

/* ================================================================ yearbook */

test('a yearbook entry appears on the wall and can be signed once', async () => {
  const founder = await member('wallfounder');
  const classmate = await member('wallclassmate');

  await founder.call('/homeroom/yearbook/edit', form({
    csrf: founder.csrf, cohort: 'S26', house: 'Punkhaus', venture: 'Testworks',
    one_liner: 'A company that exists only in a test.',
    quote: 'Ship the assay, not the abstract.',
  }));

  const wall = await (await classmate.call('/homeroom/yearbook?cohort=S26')).text();
  assert.match(wall, /Testworks/);
  assert.match(wall, /Ship the assay/);

  const first = await classmate.call(`/homeroom/yearbook/${founder.id}/sign`, form({
    csrf: classmate.csrf, body: 'Asked the best question in week one.',
  }));
  assert.equal(first.status, 303);
  await classmate.call(`/homeroom/yearbook/${founder.id}/sign`, form({
    csrf: classmate.csrf, body: 'Actually, the best two questions.',
  }));

  const signs = hr.signatures(founder.id);
  assert.equal(signs.length, 1, 'a second signature updates rather than stacks');
  assert.match(signs[0].body, /best two questions/);
});

test('you cannot sign your own yearbook', async () => {
  const alone = await member('wallalone');
  const result = hr.signYearbook({ userId: alone.id, authorId: alone.id, body: 'I was great.' });
  assert.equal(result.ok, false);
});

/* =============================================================== the atlas */

test('the atlas sorts live labs above dead ones and filters by status', async () => {
  const { call } = await member('atlasreader');
  const { labs } = hr.searchLabs({ limit: 500 });
  assert.ok(labs.length >= 40, 'the atlas should ship with a real list');

  const order = labs.map((lab) => lab.status);
  const firstDormant = order.indexOf('dormant');
  const lastActive = order.lastIndexOf('active');
  if (firstDormant >= 0 && lastActive >= 0) {
    assert.ok(lastActive < firstDormant, 'active labs sort above dormant ones');
  }

  const api = await (await call('/homeroom/api/atlas?status=active')).json();
  assert.ok(api.labs.length);
  assert.ok(api.labs.every((lab) => lab.status === 'active'));
});

test('a member report moves the lab status and is attributed', async () => {
  const visitor = await member('atlasvisitor');
  const { labs } = hr.searchLabs({ status: 'unknown', limit: 1 });
  const lab = labs[0];
  assert.ok(lab, 'there should be an unconfirmed lab to report on');

  const res = await visitor.call(`/homeroom/labs/at/${lab.slug}/report`, form({
    csrf: visitor.csrf, status: 'active', body: 'Went in March. Open, and the PCR machine works.',
  }));
  assert.equal(res.status, 303);

  const updated = hr.getLab(lab.slug);
  assert.equal(updated.status, 'active');
  assert.equal(updated.confirmed_by, visitor.id);
  assert.match(hr.labReports(lab.id)[0].body, /PCR machine works/);
});

/* ==================================================================== perks */

test('the perks catalogue is loaded and spans every category', async () => {
  const { call } = await member('perkbrowser');
  const page = await (await call('/homeroom/perks')).text();
  assert.match(page, /Perks/);

  const api = await (await call('/homeroom/api/perks')).json();
  assert.ok(api.total >= PERKS.length, 'the researched catalogue should be seeded');
  const categories = new Set(api.deals.map((d) => d.category));
  assert.ok(categories.has('nondilutive'), 'non-dilutive capital belongs in perks');
  assert.ok(categories.has('legal'));
  assert.ok(categories.has('wetlab'));
});

test('a perk with no code says how to redeem rather than showing a blank', async () => {
  const { call, csrf } = await member('perkclaimer');
  const { deals } = hr.listDeals({ limit: 500 });
  const apply = deals.find((d) => d.access === 'apply' && !d.code);
  assert.ok(apply, 'the catalogue should contain application-only perks');

  await call(`/homeroom/perk/${apply.slug}/claim`, form({ csrf }));
  const page = await (await call(`/homeroom/perk/${apply.slug}`)).text();
  assert.match(page, /Apply on the vendor/);
});

/* =========================================================== rate my funder */

test('a review carries every axis, and the funder page averages them', async () => {
  const author = await member('funderreviewer');
  const created = await author.call('/homeroom/funders/new', form({
    csrf: author.csrf, name: 'Axis Capital', kind: 'seed', focus: 'Nothing real',
  }));
  const slug = created.headers.get('location').split('/').pop();
  const funder = hr.getFunder(slug);

  hr.upsertReview({
    funderId: funder.id, userId: author.id, rating: 4, speed: 5, valueAdd: 3,
    founderFriendly: 5, terms: 4, wouldAgain: true, tags: 'fast-decision,clean-terms',
    outcome: 'passed', stage: 'pre-seed', body: 'Fast, clear, and told me why.',
  });

  const rated = hr.getFunder(slug);
  assert.equal(rated.avg_rating, 4);
  assert.equal(rated.avg_friendly, 5);
  assert.equal(rated.avg_terms, 4);
  assert.equal(rated.would_again_pct, null, 'the percentage is withheld under three reviews');

  const page = await (await author.call(`/homeroom/funder/${slug}`)).text();
  assert.match(page, /Founder-friendly/);
  assert.match(page, /fast decision/i, 'review tags surface as a countable pattern');
});

test('would-raise-again appears only once three reviews protect the reviewers', async () => {
  const owner = await member('againowner');
  const created = await owner.call('/homeroom/funders/new', form({
    csrf: owner.csrf, name: 'Threshold Fund', kind: 'seed',
  }));
  const slug = created.headers.get('location').split('/').pop();
  const funder = hr.getFunder(slug);

  for (const [index, handleName] of ['againa', 'againb', 'againc'].entries()) {
    await member(handleName);
    hr.upsertReview({
      funderId: funder.id, userId: handleName, rating: 4, wouldAgain: index !== 2,
    });
  }
  const rated = hr.getFunder(slug);
  assert.equal(rated.review_count, 3);
  assert.equal(rated.would_again_pct, 67);
});

test('reviews get replies and helpful votes, and you cannot vouch for your own', async () => {
  const author = await member('replyauthor');
  const reader = await member('replyreader');
  const created = await author.call('/homeroom/funders/new', form({
    csrf: author.csrf, name: 'Echo Ventures', kind: 'preseed',
  }));
  const slug = created.headers.get('location').split('/').pop();
  const funder = hr.getFunder(slug);
  const review = hr.upsertReview({
    funderId: funder.id, userId: author.id, rating: 2, body: 'Three months, then silence.',
  });

  const own = await author.call(`/homeroom/review/${review.id}/helpful`, form({
    csrf: author.csrf, goto: `/homeroom/funder/${slug}`,
  }));
  assert.equal(own.status, 403, 'you cannot vouch for your own review');

  await reader.call(`/homeroom/review/${review.id}/helpful`, form({
    csrf: reader.csrf, goto: `/homeroom/funder/${slug}`,
  }));
  await reader.call(`/homeroom/review/${review.id}/comment`, form({
    csrf: reader.csrf, body: 'Same here, a cohort later.', anonymous: '1',
    goto: `/homeroom/funder/${slug}`,
  }));

  const reviews = hr.funderReviews(funder.id);
  assert.equal(reviews[0].helpful, 1);
  assert.equal(reviews[0].reply_count, 1);

  const page = body(await (await reader.call(`/homeroom/funder/${slug}`)).text());
  assert.match(page, /Same here, a cohort later/);
  assert.doesNotMatch(page, new RegExp(`>${reader.id}<`), 'an anonymous reply hides its author');
});

test('a helpful vote toggles rather than stacking', async () => {
  const author = await member('togglea');
  const voter = await member('toggleb');
  const funderId = hr.createFunder({ name: 'Toggle Fund', kind: 'angel', addedBy: author.id });
  const review = hr.upsertReview({ funderId, userId: author.id, rating: 3 });

  assert.equal(hr.toggleReviewHelpful(review.id, voter.id), true);
  assert.equal(hr.toggleReviewHelpful(review.id, voter.id), false);
  assert.equal(hr.funderReviews(funderId)[0].helpful, 0);
});

/* ================================================================= mentors */

test('the mentor roster is searchable and puts vetted mentors first', async () => {
  const { call } = await member('mentorseeker');
  const all = await (await call('/homeroom/api/mentors?limit=200')).json();
  assert.ok(all.total >= 100, 'a hundred mentors should be in the list');

  const order = all.mentors.map((m) => m.vetted);
  const firstUnvetted = order.indexOf(0);
  if (firstUnvetted >= 0) {
    assert.ok(!order.slice(firstUnvetted).includes(1), 'vetted mentors sort first');
  }

  const legal = await (await call('/homeroom/api/mentors?track=legal')).json();
  assert.ok(legal.total > 0);
  assert.ok(legal.mentors.every((m) => m.track === 'legal'));

  const tagged = await (await call('/homeroom/api/mentors?tag=patents')).json();
  assert.ok(tagged.total > 0, 'expertise tags should be searchable');
  assert.ok(tagged.mentors.every((m) => m.tags.includes('patents')));
});

test('real people from the network are never presented as bookable', async () => {
  // The claim most likely to quietly stop being true: these are real people who
  // appeared in a calendar, not people who agreed to take bookings from members.
  assert.ok(NETWORK_MENTORS.length, 'the network roster should not be empty');
  for (const mentor of NETWORK_MENTORS) {
    assert.equal(mentor.vetted, false, `${mentor.name}: a calendar row is never vetted`);
    assert.equal(mentor.scheduler, '', `${mentor.name}: no invented scheduling link`);
    assert.equal(mentor.source, 'calendar');
    // Contact details live in the calendar, not in the repository.
    const blob = JSON.stringify(mentor);
    assert.doesNotMatch(blob, /@[a-z0-9-]+\.[a-z]{2,}/i, `${mentor.name}: no email addresses`);
    assert.doesNotMatch(blob, /\+?\d[\d\s().-]{8,}/, `${mentor.name}: no phone numbers`);
  }

  const { call } = await member('networkreader');
  const stored = hr.getMentor(NETWORK_MENTORS[0].name.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
  assert.ok(stored, 'the network roster should be seeded');
  assert.equal(stored.vetted, 0);

  const page = await (await call(`/homeroom/mentor/${stored.slug}`)).text();
  assert.match(page, /not<\/b> confirmed they/, 'the page says plainly that they have not opted in');
  assert.doesNotMatch(page, /booking page/, 'and offers no booking button');

  // Vetted mentors still sort above them.
  const api = await (await call('/homeroom/api/mentors?limit=200')).json();
  const index = api.mentors.findIndex((m) => m.slug === stored.slug);
  assert.ok(index > 0, 'an unvetted network row sorts below the vetted roster');
});

test('a mentor page offers a way to book, whether or not they publish a link', async () => {
  const { call } = await member('mentorbooker');
  const { mentors } = hr.searchMentors({ vetted: true, limit: 1 });
  const mentor = mentors[0];
  const page = await (await call(`/homeroom/mentor/${mentor.slug}`)).text();
  assert.match(page, /Book time/);
  // Either their own scheduler, or Homeroom slots, or the intro fallback —
  // never a dead end.
  assert.match(page, /booking page|Homeroom slots|office hours|intro/i);
});

/* ================================================================ calendar */

test('the calendar renders a month and groups events onto their day', async () => {
  const { call, id } = await member('calendarreader');
  const when = Math.floor(Date.UTC(2027, 2, 15, 18, 0) / 1000);
  hr.createEvent({ hostId: id, title: 'Calendar Smoke Test', kind: 'meetup', startsAt: when, minutes: 90 });

  const page = await (await call('/homeroom/events?y=2027&m=2')).text();
  assert.match(page, /March 2027/);
  assert.match(page, /Calendar Smoke Test/);

  const empty = await (await call('/homeroom/events?y=2027&m=3')).text();
  assert.doesNotMatch(empty, /Calendar Smoke Test/, 'an event belongs to one month');
});

test('the ics feed is members-only and never leaks the description', async () => {
  const { call, id } = await member('icsreader');
  hr.createEvent({
    hostId: id, title: 'Private Details Event', kind: 'meetup',
    startsAt: Math.floor(Date.now() / 1000) + 86400, minutes: 60,
    place: 'The house', description: 'Door code is 1234.',
  });

  const anonymous = await fetch(`${base}/homeroom/events.ics`, { redirect: 'manual' });
  assert.notEqual(anonymous.headers.get('content-type'), 'text/calendar; charset=utf-8');

  const res = await call('/homeroom/events.ics');
  assert.equal(res.status, 200);
  const ics = await res.text();
  assert.match(ics, /BEGIN:VCALENDAR/);
  assert.match(ics, /Private Details Event/);
  assert.doesNotMatch(ics, /Door code/, 'a calendar file gets forwarded; the description does not go in it');
});

test('a Luma re-sync updates the event it already imported', () => {
  const hostId = 'lumahost';
  if (!hr.getUser(hostId)) hr.createUser({ id: hostId, email: 'lumahost@example.com', passwordHash: 'x' });

  const startsAt = Math.floor(Date.now() / 1000) + 7 * 86400;
  const first = hr.upsertExternalEvent({
    source: 'luma', externalId: 'evt-abc', hostId, title: 'Biopunk Dinner',
    startsAt, minutes: 120, place: 'Punkhaus', url: 'https://luma.com/event/evt-abc',
  });
  assert.equal(first.created, true);

  const again = hr.upsertExternalEvent({
    source: 'luma', externalId: 'evt-abc', hostId, title: 'Biopunk Dinner (moved)',
    startsAt: startsAt + 3600, minutes: 120, place: 'Femhaus', url: 'https://luma.com/event/evt-abc',
  });
  assert.equal(again.created, false, 'the same Luma id must not become a second event');
  assert.equal(again.id, first.id);

  const event = hr.getEvent(first.id);
  assert.equal(event.title, 'Biopunk Dinner (moved)');
  assert.equal(event.place, 'Femhaus');
});

test('the Luma normalizer reads the field spellings the API has used', () => {
  const nested = normalizeEvent({
    event: {
      api_id: 'evt-1', name: 'Fermentation Workshop',
      start_at: '2027-04-01T18:00:00Z', end_at: '2027-04-01T20:00:00Z',
      geo_address_info: { city_state: 'San Francisco, CA' }, url: 'biopunk-ferment',
    },
  });
  assert.equal(nested.externalId, 'evt-1');
  assert.equal(nested.minutes, 120);
  assert.equal(nested.kind, 'workshop');
  assert.equal(nested.place, 'San Francisco, CA');
  assert.equal(nested.url, 'https://luma.com/biopunk-ferment');

  const flat = normalizeEvent({ id: 'evt-2', name: 'Demo Day', start_at_utc: '2027-05-01T17:00:00Z' });
  assert.equal(flat.externalId, 'evt-2');
  assert.equal(flat.kind, 'demoday');
  assert.equal(flat.minutes, 90, 'no end time falls back to a sane default');

  assert.equal(normalizeEvent({ name: 'No id, no start' }), null,
    'an event with no start cannot go on a calendar');
  assert.equal(lumaConfigured(), false, 'the tests never call Luma for real');
});

/* ================================================================= library */

test('the manual is a training system: tracks, modules, and a deliverable', async () => {
  const { call, id } = await member('manualreader');

  const index = await (await call('/homeroom/library')).text();
  assert.match(index, /Founder Manual/);
  assert.match(index, /Legal, IP, regulatory/);

  const track = await (await call('/homeroom/library/track/fundraising-and-capital')).text();
  assert.match(track, /Raising on an idea/);

  const module = await (await call('/homeroom/library/module/risk-mapping')).text();
  assert.match(module, /Risk Map/, 'the module names its deliverable');
  assert.match(module, /highest-risk assumption/, 'and what you should be able to do afterwards');

  const before = hr.progressSummary(id);
  assert.equal(before.done, 0);

  await call('/homeroom/library/module/risk-mapping/progress', form({
    csrf: (await csrfFor(call)), state: 'done', note: 'Three assumptions, ranked.',
    link: 'https://example.org/risk-map',
  }));

  const after = hr.progressSummary(id);
  assert.equal(after.done, 1);
  assert.ok(after.percent > 0);

  const deliverables = hr.deliverables(id);
  assert.equal(deliverables[0].deliverable, 'Risk Map');
  assert.equal(deliverables[0].link, 'https://example.org/risk-map');
});

test('module notes are private to the member who wrote them', async () => {
  const owner = await member('noteowner');
  const nosy = await member('notenosy');
  const module = hr.getModule('risk-mapping');

  hr.setProgress({
    userId: owner.id, moduleId: module.id, state: 'started',
    note: 'Our real risk is the strain, not the market.',
  });

  const page = await (await nosy.call('/homeroom/library/module/risk-mapping')).text();
  assert.doesNotMatch(page, /real risk is the strain/, 'another member never sees your notes');
  assert.equal(hr.getProgress(nosy.id, module.id), null);
});

test('the S26 sequence is on the library page', async () => {
  const { call } = await member('sequencereader');
  const page = await (await call('/homeroom/library')).text();
  assert.match(page, /Orrick 1: Company formation/);
  assert.match(page, /Biopunk Showcase/);
});

/* ================================================================ publishing */

test('publishing fails safely and visibly when Supabase is not configured', async () => {
  const { call, csrf, id } = await member('publisher');
  assert.equal(supabaseConfigured(), false, 'the tests never talk to Supabase');

  const page = await (await call('/homeroom/publish')).text();
  assert.match(page, /SUPABASE_URL/, 'the page says what is missing');

  const res = await call('/homeroom/publish', form({
    csrf, title: 'We made a thing', url: 'https://example.org/thing', topic: 'launch',
    body: 'And it works.',
  }));
  assert.equal(res.status, 400);

  // The attempt is still recorded, so nothing is silently lost.
  const [submission] = hr.newsSubmissions(id);
  assert.ok(submission, 'a failed submission still leaves a receipt');
  assert.equal(submission.status, 'failed');
  assert.equal(submission.title, 'We made a thing');
});

test('publishing validates before it records anything', async () => {
  const { call, csrf, id } = await member('publishvalidator');
  const before = hr.newsSubmissions(id).length;

  const noTitle = await call('/homeroom/publish', form({ csrf, title: '', body: 'x' }));
  assert.equal(noTitle.status, 400);
  const noContent = await call('/homeroom/publish', form({ csrf, title: 'Just a headline' }));
  assert.equal(noContent.status, 400);

  assert.equal(hr.newsSubmissions(id).length, before, 'a rejected form writes nothing');
});

test('a member only ever sees their own submissions', async () => {
  const mine = await member('subsmine');
  const theirs = await member('substheirs');
  hr.recordNewsSubmission({ userId: theirs.id, title: 'Their private draft' });

  const page = await (await mine.call('/homeroom/publish')).text();
  assert.doesNotMatch(page, /Their private draft/);
});

/* ================================================================ the nav */

test('the masthead names every section, and the retired ones are gone', async () => {
  const { call } = await member('navreader');
  const page = await (await call('/homeroom')).text();
  for (const label of ['Yearbook', 'Labs', 'Perks', 'Funders', 'Mentors', 'Events', 'Library']) {
    assert.match(page, new RegExp(`>${label}</a>`), `${label} should be in the nav`);
  }
  assert.match(page, /href="\/homeroom\/jobs">Jobs<\/a>/, 'Jobs moved to the footer, not away');
  assert.doesNotMatch(page, />Deals</, 'Deals became Perks');
  assert.doesNotMatch(page, />People</, 'People became the Yearbook');
  assert.doesNotMatch(page, />Chat</, 'chat was removed');
  assert.doesNotMatch(page, />Forum</, 'the forum was removed');
});
