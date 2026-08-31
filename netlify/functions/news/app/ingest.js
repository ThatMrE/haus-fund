/**
 * The morning ingest.
 *
 * Reads the curated feeds, keeps what reads as early-stage biotech, and files
 * the survivors under per-source accounts. Everything it posts is marked
 * `source = 'agent'`, which is what keeps it below human submissions on the
 * front page.
 *
 * The run is idempotent: a link already on the site is skipped, so a repeated
 * or overlapping run adds nothing twice.
 */
import { SOURCES, botHandle, botAbout } from './sources.js';
import { parseFeed } from './feed-parser.js';
import { scoreEntry, guessTopic } from './relevance.js';
import * as db from './models.js';
import { hashPassword } from './auth.js';
import { normalizeUrl, nowSeconds } from './util.js';
import { randomBytes } from 'node:crypto';

/** Most stories to post in one run, so a busy news day cannot bury the page. */
export const MAX_PER_RUN = 12;
/** Most stories from any single source in one run. */
export const MAX_PER_SOURCE = 3;
/** Ignore anything older than this. */
export const MAX_AGE_HOURS = 36;
const FETCH_TIMEOUT_MS = 8000;

/** Fetch one feed. A source that fails is reported, never fatal. */
async function fetchFeed(source, { fetchImpl = fetch } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetchImpl(source.url, {
      signal: controller.signal,
      headers: {
        'user-agent': 'haus-fund-news-ingest/1.0 (+https://haus.fund/news)',
        accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml',
      },
    });
    if (!res.ok) return { source, entries: [], error: `HTTP ${res.status}` };
    return { source, entries: parseFeed(await res.text()), error: null };
  } catch (err) {
    return { source, entries: [], error: err?.name === 'AbortError' ? 'timeout' : String(err?.message || err) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Turn raw feed entries into ranked, de-duplicated candidates.
 * Pure apart from the duplicate check, so it is straightforward to test.
 */
export function selectCandidates(results, { now = nowSeconds(), isDuplicate = () => false } = {}) {
  const candidates = [];
  const seenUrls = new Set();
  const seenTitles = new Set();

  for (const { source, entries } of results) {
    for (const entry of entries) {
      const url = normalizeUrl(entry.link);
      if (!url) continue;

      const ageHours = entry.publishedAt ? (now - entry.publishedAt) / 3600 : 0;
      if (ageHours > MAX_AGE_HOURS || ageHours < -6) continue;

      const key = dedupeKey(url);
      const titleKey = normalizeTitle(entry.title);
      if (seenUrls.has(key) || seenTitles.has(titleKey)) continue;
      if (isDuplicate(url, entry.title)) continue;

      const verdict = scoreEntry(entry, { weight: source.weight });
      if (!verdict.keep) continue;

      seenUrls.add(key);
      seenTitles.add(titleKey);
      candidates.push({
        source,
        title: tidyTitle(entry.title),
        url,
        topic: guessTopic(entry),
        score: verdict.score,
        reasons: verdict.reasons,
        publishedAt: entry.publishedAt,
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score || (b.publishedAt ?? 0) - (a.publishedAt ?? 0));

  // Cap each source before capping the run, so one prolific feed cannot take
  // every slot on the page.
  const perSource = new Map();
  const chosen = [];
  for (const candidate of candidates) {
    const used = perSource.get(candidate.source.slug) ?? 0;
    if (used >= MAX_PER_SOURCE) continue;
    perSource.set(candidate.source.slug, used + 1);
    chosen.push(candidate);
    if (chosen.length >= MAX_PER_RUN) break;
  }
  return chosen;
}

function dedupeKey(url) {
  try {
    const parsed = new URL(url);
    parsed.search = '';
    parsed.hash = '';
    return `${parsed.hostname.replace(/^www\./, '')}${parsed.pathname.replace(/\/+$/, '')}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

function normalizeTitle(title) {
  return String(title).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Feed titles often carry the outlet name; the site is shown separately here. */
function tidyTitle(title) {
  const trimmed = String(title)
    .replace(/\s*[|–—-]\s*(Fierce Biotech|Endpoints News|BioSpace|Labiotech|STAT|TechCrunch|GEN)\s*$/i, '')
    .trim();
  return trimmed.length > 120 ? `${trimmed.slice(0, 117).trimEnd()}...` : trimmed;
}

/** Create the posting account for a source if it does not exist yet. */
export function ensureBotAccount(source) {
  const id = botHandle(source);
  const existing = db.getUser(id);
  if (existing) return existing;
  // No one logs into these; the passphrase is random and thrown away.
  const user = db.createUser({ id, passwordHash: hashPassword(randomBytes(24).toString('hex')) });
  db.updateUser(id, { about: botAbout(source) });
  return user;
}

/**
 * Run the ingest end to end.
 * @returns {Promise<{posted: Array, skipped: number, errors: Array}>}
 */
export async function runIngest({
  sources = SOURCES,
  fetchImpl = fetch,
  now = nowSeconds(),
  dryRun = false,
} = {}) {
  const results = await Promise.all(sources.map((source) => fetchFeed(source, { fetchImpl })));
  const errors = results.filter((r) => r.error).map((r) => ({ source: r.source.slug, error: r.error }));

  const chosen = selectCandidates(results, {
    now,
    isDuplicate: (url) => Boolean(db.findByUrl(url, { withinDays: 30 })),
  });

  if (dryRun) return { posted: chosen, skipped: 0, errors, dryRun: true };

  const posted = [];
  for (const candidate of chosen) {
    const account = ensureBotAccount(candidate.source);
    const id = db.createStory({
      by: account.id,
      title: candidate.title,
      url: candidate.url,
      topic: candidate.topic,
      kind: 'link',
      source: 'agent',
    });
    posted.push({ id, title: candidate.title, url: candidate.url, by: account.id, score: candidate.score });
  }

  return { posted, skipped: chosen.length - posted.length, errors };
}
