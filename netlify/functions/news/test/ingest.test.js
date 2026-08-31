process.env.BIOPUNK_DB = ':memory:';

import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFeed, stripTags, decode } from '../app/feed-parser.js';
import { scoreEntry, guessTopic, MIN_SCORE } from '../app/relevance.js';
import { selectCandidates, MAX_PER_SOURCE, MAX_PER_RUN } from '../app/ingest.js';

const SOURCE = { slug: 'test-feed', name: 'Test Feed', site: 'test.example', weight: 1 };

const RSS = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <title>Test Feed</title>
  <item>
    <title><![CDATA[Aria Bio raises $18M Series A for protein design]]></title>
    <link>https://test.example/aria-series-a</link>
    <pubDate>Wed, 02 Apr 2025 09:00:00 GMT</pubDate>
    <description>The startup emerges from stealth with a platform for antibody discovery.</description>
  </item>
  <item>
    <title>Big Pharma wins FDA approval for phase 3 oncology drug</title>
    <link>https://test.example/approval</link>
    <pubDate>Wed, 02 Apr 2025 08:00:00 GMT</pubDate>
    <description>The company reported quarterly results alongside the approval.</description>
  </item>
</channel></rss>`;

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Helix Labs spins out of MIT with seed funding for CRISPR delivery</title>
    <link rel="alternate" href="https://atom.example/helix"/>
    <published>2025-04-02T07:30:00Z</published>
    <summary>A $6M seed round backs the gene editing spinout.</summary>
  </entry>
</feed>`;

/* ------------------------------------------------------------- parsing */

test('parses RSS items', () => {
  const entries = parseFeed(RSS);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].title, 'Aria Bio raises $18M Series A for protein design');
  assert.equal(entries[0].link, 'https://test.example/aria-series-a');
  assert.ok(entries[0].publishedAt > 0);
  assert.match(entries[0].summary, /emerges from stealth/);
});

test('parses Atom entries, taking the href off the link element', () => {
  const entries = parseFeed(ATOM);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].link, 'https://atom.example/helix');
  assert.match(entries[0].title, /spins out of MIT/);
});

test('skips entries with no title or no link', () => {
  const xml = '<rss><channel><item><title>Orphan</title></item></channel></rss>';
  assert.deepEqual(parseFeed(xml), []);
});

test('survives junk input', () => {
  assert.deepEqual(parseFeed(''), []);
  assert.deepEqual(parseFeed(null), []);
  assert.deepEqual(parseFeed('not xml at all'), []);
});

test('decodes entities and strips markup', () => {
  assert.equal(decode('AI &amp; biology &#8212; a note'), 'AI & biology — a note');
  assert.equal(stripTags('<p>Hello <b>world</b></p>'), 'Hello world');
});

/* ------------------------------------------------------------- scoring */

const entryOf = (title, summary = '') => ({ title, summary });

test('an early-stage biotech round scores well above the threshold', () => {
  const verdict = scoreEntry(entryOf(
    'Aria Bio raises $18M Series A for protein design',
    'The biotech startup emerges from stealth.',
  ));
  assert.equal(verdict.keep, true);
  assert.ok(verdict.score >= MIN_SCORE);
});

test('late-stage pharma news is rejected', () => {
  const verdict = scoreEntry(entryOf(
    'Big Pharma wins FDA approval for phase 3 oncology drug',
    'The company reported quarterly results.',
  ));
  assert.equal(verdict.keep, false);
});

test('an early-stage round outside biology is rejected', () => {
  const verdict = scoreEntry(entryOf('Fintech startup raises $12M Series A to modernise invoicing'));
  assert.equal(verdict.keep, false, 'no life-science subject matter');
});

test('biotech with no stage signal is rejected', () => {
  const verdict = scoreEntry(entryOf('Researchers describe a new antibody structure in Nature'));
  assert.equal(verdict.keep, false);
});

test('a billion-dollar figure pushes a story down', () => {
  const small = scoreEntry(entryOf('Biotech startup raises $20M seed round for gene therapy'));
  const large = scoreEntry(entryOf('Biotech startup raises $2.4 billion in growth round for gene therapy'));
  assert.ok(large.score < small.score);
});

test('source weight scales the score', () => {
  const entry = entryOf('Biotech startup raises $10M seed round for CRISPR work');
  const plain = scoreEntry(entry, { weight: 1 });
  const favoured = scoreEntry(entry, { weight: 1.2 });
  assert.ok(favoured.score > plain.score);
});

test('topics come from the wording', () => {
  assert.equal(guessTopic(entryOf('Startup raises seed for CRISPR delivery')), 'crispr');
  assert.equal(guessTopic(entryOf('Spinout builds a benchtop sequencer', 'new instrument')), 'hardware');
  assert.equal(guessTopic(entryOf('Company closes seed round')), 'funding');
});

/* ----------------------------------------------------------- selection */

const now = Math.floor(Date.parse('2025-04-02T12:00:00Z') / 1000);
const hoursAgo = (h) => now - h * 3600;

function feedEntry(title, link, hours = 2, summary = 'biotech startup seed round') {
  return { title, link, publishedAt: hoursAgo(hours), summary };
}

test('selects the qualifying entries and drops the rest', () => {
  const chosen = selectCandidates(
    [{ source: SOURCE, entries: parseFeed(RSS) }],
    { now },
  );
  assert.equal(chosen.length, 1);
  assert.match(chosen[0].title, /Aria Bio/);
  assert.equal(chosen[0].topic, 'funding');
});

test('drops stale entries', () => {
  const chosen = selectCandidates(
    [{ source: SOURCE, entries: [feedEntry('Biotech startup raises seed round', 'https://a.example/1', 200)] }],
    { now },
  );
  assert.equal(chosen.length, 0);
});

test('de-duplicates the same link across sources, ignoring tracking params', () => {
  const other = { ...SOURCE, slug: 'other' };
  const chosen = selectCandidates(
    [
      { source: SOURCE, entries: [feedEntry('Biotech startup raises seed round', 'https://a.example/story')] },
      { source: other, entries: [feedEntry('A different headline entirely', 'https://a.example/story?utm_source=x')] },
    ],
    { now },
  );
  assert.equal(chosen.length, 1);
});

test('de-duplicates repeated headlines', () => {
  const other = { ...SOURCE, slug: 'other' };
  const chosen = selectCandidates(
    [
      { source: SOURCE, entries: [feedEntry('Biotech startup raises seed round', 'https://a.example/1')] },
      { source: other, entries: [feedEntry('Biotech Startup Raises Seed Round', 'https://b.example/2')] },
    ],
    { now },
  );
  assert.equal(chosen.length, 1);
});

test('respects an existing story in the database', () => {
  const chosen = selectCandidates(
    [{ source: SOURCE, entries: [feedEntry('Biotech startup raises seed round', 'https://a.example/1')] }],
    { now, isDuplicate: () => true },
  );
  assert.equal(chosen.length, 0);
});

test('caps how much one source can take', () => {
  const entries = Array.from({ length: 8 }, (_, i) =>
    feedEntry(`Biotech startup ${i} raises a seed round for gene therapy`, `https://a.example/${i}`),
  );
  const chosen = selectCandidates([{ source: SOURCE, entries }], { now });
  assert.equal(chosen.length, MAX_PER_SOURCE);
});

test('caps the whole run', () => {
  const results = Array.from({ length: 10 }, (_, s) => ({
    source: { ...SOURCE, slug: `s${s}` },
    entries: Array.from({ length: 3 }, (_, i) =>
      feedEntry(`Biotech startup s${s}n${i} raises a seed round`, `https://s${s}.example/${i}`),
    ),
  }));
  assert.equal(selectCandidates(results, { now }).length, MAX_PER_RUN);
});

test('ranks the strongest candidate first', () => {
  const chosen = selectCandidates(
    [{
      source: SOURCE,
      entries: [
        feedEntry('Biotech company unveils a partnership', 'https://a.example/weak', 2, 'therapeutics startup'),
        feedEntry('Gene therapy startup raises $8M seed round, emerges from stealth', 'https://a.example/strong', 2,
                  'The biotech spinout closes an oversubscribed seed financing.'),
      ],
    }],
    { now },
  );
  assert.match(chosen[0].title, /Gene therapy startup/);
});

/* ------------------------------------------------------------ scheduling */

import { shouldRunNow, localHour } from '../app/schedule.js';

const at = (iso) => new Date(iso);

test('7am local is the run hour on both sides of a DST change', () => {
  // 11:00 UTC is 07:00 in New York during EDT; 12:00 UTC is 07:00 during EST.
  assert.equal(localHour(at('2025-07-01T11:00:00Z'), 'America/New_York'), 7);
  assert.equal(localHour(at('2025-01-15T12:00:00Z'), 'America/New_York'), 7);

  assert.equal(shouldRunNow({ now: at('2025-07-01T11:00:00Z'), timeZone: 'America/New_York', runHour: 7 }).run, true);
  assert.equal(shouldRunNow({ now: at('2025-01-15T12:00:00Z'), timeZone: 'America/New_York', runHour: 7 }).run, true);
});

test('a fixed UTC hour would have drifted — the guard does not', () => {
  // The same wall-clock UTC hour is 8am in New York in summer, so it must not run.
  assert.equal(shouldRunNow({ now: at('2025-07-01T12:00:00Z'), timeZone: 'America/New_York', runHour: 7 }).run, false);
});

test('any other hour is skipped', () => {
  const decision = shouldRunNow({ now: at('2025-07-01T15:00:00Z'), timeZone: 'America/New_York', runHour: 7 });
  assert.equal(decision.run, false);
  assert.match(decision.reason, /not the scheduled hour/);
});

test('a second fire in the same window is refused', () => {
  const now = at('2025-07-01T11:00:00Z');
  const decision = shouldRunNow({
    now,
    timeZone: 'America/New_York',
    runHour: 7,
    lastRunAt: Math.floor(now.getTime() / 1000) - 3600,
  });
  assert.equal(decision.run, false);
  assert.match(decision.reason, /last run was/);
});

test('yesterday’s run does not block today’s', () => {
  const now = at('2025-07-02T11:00:00Z');
  const decision = shouldRunNow({
    now,
    timeZone: 'America/New_York',
    runHour: 7,
    lastRunAt: Math.floor(now.getTime() / 1000) - 24 * 3600,
  });
  assert.equal(decision.run, true);
});

test('an unknown timezone falls back to UTC instead of stopping the feed', () => {
  assert.equal(localHour(at('2025-07-01T09:00:00Z'), 'Not/AZone'), 9);
});
