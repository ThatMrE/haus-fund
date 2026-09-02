process.env.BIOPUNK_DB = ':memory:';

import test from 'node:test';
import assert from 'node:assert/strict';
import biorxiv from '../app/agents/biorxiv.js';
import formd from '../app/agents/formd.js';
import nih from '../app/agents/nih.js';
import calendars, { parseIcs, icsDate } from '../app/agents/calendars.js';
import accounts, { stripHtml, firstLink } from '../app/agents/accounts.js';
import { AGENTS, agentHandle } from '../app/agents/index.js';
import { money, tidy, isoDate } from '../app/agents/util.js';
import { runIngest } from '../app/ingest.js';
import { initDb } from '../app/db/index.js';

// The dry run still asks the database whether a link is already posted.
await initDb();

const NOW = 1_780_000_000;

/** A fetch stub that answers by URL substring. */
function routes(table) {
  return async (url, options = {}) => {
    const key = Object.keys(table).find((k) => String(url).includes(k));
    if (!key) return { ok: false, status: 404, async text() { return 'not found'; } };
    const value = typeof table[key] === 'function' ? table[key](url, options) : table[key];
    return {
      ok: true,
      status: 200,
      async json() { return typeof value === 'string' ? JSON.parse(value) : value; },
      async text() { return typeof value === 'string' ? value : JSON.stringify(value); },
    };
  };
}

/* ------------------------------------------------------------------ shared */

test('money reads the way a person writes it', () => {
  assert.equal(money(1_200_000), '$1.2M');
  assert.equal(money(850_000), '$850K');
  assert.equal(money(3_400_000_000), '$3.4B');
  assert.equal(money(0), null);
  assert.equal(money('nonsense'), null);
});

test('titles are stripped of markup and clipped', () => {
  assert.equal(tidy('<b>Hi</b>   there'), 'Hi there');
  assert.equal(tidy('x'.repeat(200)).length, 140);
});

test('every agent has a distinct key and its own posting handle', () => {
  const keys = AGENTS.map((a) => a.key);
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(agentHandle(AGENTS[0]), `agent-${AGENTS[0].key}`);
  assert.ok(AGENTS.every((a) => a.label && a.about && typeof a.fetch === 'function'));
});

/* ----------------------------------------------------------------- bioRxiv */

test('bioRxiv preprints come back as links to the versioned paper', async () => {
  const fetchImpl = routes({
    'api.biorxiv.org': {
      collection: [
        {
          doi: '10.1101/2026.08.30.123456',
          title: 'A compact base editor for delivery',
          category: 'Synthetic Biology',
          date: '2026-08-30',
          version: 2,
          author_corresponding_institution: 'ETH Zurich',
        },
        { doi: '10.1101/x', title: 'Something else', category: 'Paleontology', date: '2026-08-30' },
      ],
    },
  });

  const entries = await biorxiv.fetch({ fetchImpl, now: NOW });
  // Two servers are asked, and the off-topic category is dropped from both.
  assert.equal(entries.length, 2);
  assert.equal(entries[0].link, 'https://www.biorxiv.org/content/10.1101/2026.08.30.123456v2');
  assert.equal(entries[0].topicHint, 'synbio');
  assert.match(entries[0].note, /ETH Zurich/);
});

/* ------------------------------------------------------------------ Form D */

test('Form D filings are filtered to the life-science filers', async () => {
  const atom = `<?xml version="1.0"?>
  <feed xmlns="http://www.w3.org/2005/Atom">
    <entry>
      <title>D - HELIX THERAPEUTICS INC (0001234567) (Filer)</title>
      <link rel="alternate" href="https://www.sec.gov/filing/1"/>
      <updated>2026-08-30T10:00:00Z</updated>
    </entry>
    <entry>
      <title>D - MIDTOWN REAL ESTATE PARTNERS LP (0007654321) (Filer)</title>
      <link rel="alternate" href="https://www.sec.gov/filing/2"/>
      <updated>2026-08-30T10:00:00Z</updated>
    </entry>
  </feed>`;

  const entries = await formd.fetch({ fetchImpl: routes({ 'sec.gov': atom }), now: NOW });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].title, 'HELIX THERAPEUTICS INC filed a Form D');
  assert.equal(entries[0].topicHint, 'funding');
});

/* --------------------------------------------------------------------- NIH */

test('NIH awards name the company and the amount', async () => {
  const fetchImpl = routes({
    'reporter.nih.gov': {
      results: [
        {
          project_num: '1R43GM123456-01',
          project_title: 'Cell-free synthesis of membrane proteins',
          organization: { org_name: 'MEMBRANE BIO LLC' },
          award_amount: 1_950_000,
          award_notice_date: '2026-08-29',
        },
      ],
    },
  });

  const entries = await nih.fetch({ fetchImpl, now: NOW });
  assert.equal(entries.length, 1);
  assert.match(entries[0].title, /Membrane Bio LLC wins an NIH award/);
  assert.match(entries[0].note, /\$2M|\$1\.9M|\$1\.95M/);
});

test('the NIH request asks only for the company grant codes', async () => {
  let sent = null;
  const fetchImpl = routes({
    'reporter.nih.gov': (url, options) => {
      sent = JSON.parse(options.body);
      return { results: [] };
    },
  });
  await nih.fetch({ fetchImpl, now: NOW });
  assert.deepEqual(sent.criteria.activity_codes, ['R41', 'R42', 'R43', 'R44', 'U43', 'U44']);
  assert.equal(sent.criteria.award_notice_date.to_date, isoDate(NOW));
});

/* --------------------------------------------------------------- calendars */

test('iCalendar folding, escapes and bare dates are all handled', () => {
  const ics = [
    'BEGIN:VEVENT',
    'SUMMARY:Open lab night\\, all welcome',
    'DTSTART;VALUE=DATE:20260904',
    'URL:https://example.org/e/1',
    'END:VEVENT',
  ].join('\r\n');
  const [event] = parseIcs(ics);
  assert.equal(event.summary, 'Open lab night, all welcome');
  assert.equal(event.startsAt, icsDate('20260904'));
});

test('calendars only surface events that have not happened yet', async () => {
  const past = new Date((NOW - 5 * 86400) * 1000).toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const soon = new Date((NOW + 3 * 86400) * 1000).toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const ics = ['past', 'soon']
    .map((name, i) => `BEGIN:VEVENT\r\nSUMMARY:${name}\r\nDTSTART:${i ? soon : past}\r\nURL:https://e.example/${name}\r\nEND:VEVENT`)
    .join('\r\n');

  const entries = await calendars.fetch({
    fetchImpl: routes({ 'e.example/cal': ics }),
    now: NOW,
    calendars: [{ city: 'Boston', url: 'https://e.example/cal.ics', format: 'ics' }],
  });
  assert.equal(entries.length, 1);
  assert.match(entries[0].title, /Boston: soon/);
  assert.match(entries[0].note, /in 3 days/);
});

/* ---------------------------------------------------------------- accounts */

test('a post only counts when it links somewhere', async () => {
  const fetchImpl = routes({
    'app.bsky.feed.getAuthorFeed': {
      feed: [
        {
          post: {
            uri: 'at://did:plc:x/app.bsky.feed.post/abc',
            embed: { external: { uri: 'https://example.org/round' } },
            record: { text: 'Our seed round is closed', createdAt: new Date(NOW * 1000).toISOString() },
          },
        },
      ],
    },
  });

  const entries = await accounts.fetch({
    fetchImpl,
    now: NOW,
    accounts: [{ platform: 'bluesky', handle: 'lab.example' }],
    env: {},
  });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].link, 'https://example.org/round');
  assert.match(entries[0].note, /@lab.example/);
});

test('X is skipped rather than failing when no token is configured', async () => {
  let called = false;
  const fetchImpl = routes({ 'api.twitter.com': () => { called = true; return { data: [] }; } });
  const entries = await accounts.fetch({
    fetchImpl,
    now: NOW,
    accounts: [{ platform: 'x', handle: 'someone' }],
    env: {},
  });
  assert.equal(called, false);
  assert.deepEqual(entries, []);
});

test('mastodon markup is reduced to text and its link found', () => {
  const html = '<p>New preprint <a href="https://example.org/p">here</a></p>';
  assert.equal(stripHtml(html), 'New preprint here');
  assert.equal(firstLink(html), 'https://example.org/p');
});

/* ------------------------------------------------------------------- a run */

test('one broken agent does not stop the run', async () => {
  const good = {
    key: 'good', label: 'Good', about: 'x', selfEvident: true, weight: 1,
    fetch: async () => [
      { title: 'A seed round for a spinout', link: 'https://example.org/a', publishedAt: NOW - 600 },
    ],
  };
  const broken = {
    key: 'broken', label: 'Broken', about: 'x', selfEvident: true, weight: 1,
    fetch: async () => { throw new Error('endpoint moved'); },
  };

  const result = await runIngest({ agents: [good, broken], now: NOW, dryRun: true });
  assert.equal(result.posted.length, 1);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].agent, 'broken');

  const summary = Object.fromEntries(result.agents.map((a) => [a.agent, a]));
  assert.equal(summary.good.fetched, 1);
  assert.equal(summary.broken.error, 'endpoint moved');
});

test('a self-evident agent skips the text filter that the open sources need', async () => {
  const entry = { title: 'Quarterly results and a dividend', link: 'https://example.org/z', publishedAt: NOW - 600 };
  const asSelfEvident = await runIngest({
    agents: [{ key: 'a', label: 'A', about: '', selfEvident: true, weight: 1, fetch: async () => [entry] }],
    now: NOW, dryRun: true,
  });
  const asOpenSource = await runIngest({
    agents: [{ key: 'b', label: 'B', about: '', selfEvident: false, weight: 1, fetch: async () => [entry] }],
    now: NOW, dryRun: true,
  });
  assert.equal(asSelfEvident.posted.length, 1);
  assert.equal(asOpenSource.posted.length, 0, 'the wires would have thrown this away');
});
