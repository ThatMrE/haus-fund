/**
 * The Happenstance client — the connector's network, searched by keyword.
 *
 * Same shape as roster.js: zero dependencies, fetch plus an AbortController,
 * and a field allowlist at the boundary. Everything this module hands back is
 * a person who has not agreed to anything, so what it keeps is the smallest
 * set that lets a member decide whether to ask and a steward decide whether
 * to send. Nothing else leaves the API response.
 *
 * ── THE API, AS OBSERVED ─────────────────────────────────────────────────
 *
 *   POST /v1/search                { text, include_my_connections,
 *                                    include_friends_connections, group_ids }
 *                                  → { id, status }            2 credits
 *   GET  /v1/search/:id[?page_id]  → { status: RUNNING | COMPLETED | FAILED,
 *                                      results: [...], mutuals: [...],
 *                                      has_more, next_page }
 *   POST /v1/search/:id/find-more  → { page_id, parent_search_id }  2 credits
 *   GET  /v1/usage                 → { balance_credits, has_credits }
 *
 * Bearer auth. A 402 means no credits; a 429 means too many searches running
 * at once. Searching is asynchronous — the POST returns an id and the results
 * arrive on a later GET, usually within 30 to 60 seconds.
 *
 * A result carries a name, current title and company, a summary, one line of
 * evidence per trait the query was split into, and the *mutuals* through whom
 * the person is reachable, by index into a search-level list. It does not
 * carry an email address. That fact shapes the whole engine: a steward has to
 * supply the address, so no message can go out on a member's click alone.
 */

import { createHash } from 'node:crypto';

const TIMEOUT_MS = 10_000;

export const BASE = () => (process.env.HOMEROOM_HAPPENSTANCE_BASE || 'https://api.happenstance.ai').replace(/\/+$/, '');

export function key() {
  return process.env.HOMEROOM_HAPPENSTANCE_KEY || '';
}

export function configured() {
  return !!key();
}

/** What a search costs, in credits, as observed on the account. */
export const SEARCH_CREDITS = 2;

/* ---------------------------------------------------------------- transport */

async function call(method, path, body = null) {
  if (!configured()) return { ok: false, error: 'Happenstance is not configured.', status: 0 };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${BASE()}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${key()}`,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal,
    });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    if (!response.ok) {
      return { ok: false, status: response.status, error: describe(response.status, data) };
    }
    return { ok: true, status: response.status, data };
  } catch (error) {
    const timedOut = error?.name === 'AbortError';
    return { ok: false, status: 0, error: timedOut ? 'Happenstance timed out.' : 'Could not reach Happenstance.' };
  } finally {
    clearTimeout(timer);
  }
}

function describe(status, data) {
  const detail = data?.detail || data?.error || data?.message || '';
  if (status === 401 || status === 403) return 'Happenstance rejected the API key.';
  if (status === 402) return 'The Happenstance account has no credits left.';
  if (status === 429) return 'Too many searches are running at once. Wait for one to finish.';
  return `Happenstance returned ${status}${detail ? `: ${String(detail).slice(0, 140)}` : ''}.`;
}

/* ------------------------------------------------------------------- calls */

/**
 * Start a search. Spends credits.
 *
 * Scope is the connector's own connections plus friends' shared networks and
 * no groups, unless told otherwise — groups are Phase 4 in the design doc and
 * the account has none that matter yet.
 */
export async function search({ query, includeGroups = false, groups = [] }) {
  const body = {
    text: String(query || '').trim(),
    include_my_connections: true,
    include_friends_connections: true,
  };
  if (includeGroups && groups.length) body.group_ids = groups;
  const result = await call('POST', '/v1/search', body);
  if (!result.ok) return result;
  const id = result.data?.id || result.data?.searchId || '';
  if (!id) return { ok: false, status: result.status, error: 'Happenstance did not return a search id.' };
  return { ok: true, searchId: id };
}

/**
 * Poll a search.
 *
 * Returns `{ ok, running, complete, people, hasMore }`. People are already
 * reduced to the allowlist below; the raw payload is not returned.
 */
export async function results(searchId, { pageId = '' } = {}) {
  const suffix = pageId ? `?page_id=${encodeURIComponent(pageId)}` : '';
  const result = await call('GET', `/v1/search/${encodeURIComponent(searchId)}${suffix}`);
  if (!result.ok) return result;
  const data = result.data || {};
  const status = String(data.status || '').toUpperCase();
  if (status.startsWith('FAILED')) {
    return { ok: false, status: result.status, error: 'Happenstance could not complete that search.', failed: true };
  }
  const complete = status === 'COMPLETED';
  return {
    ok: true,
    running: !complete,
    complete,
    people: complete ? normalise(data) : [],
    hasMore: !!data.has_more,
    nextPage: data.next_page || '',
  };
}

/** Ask for another page of distinct results. Spends credits. */
export async function findMore(searchId) {
  const result = await call('POST', `/v1/search/${encodeURIComponent(searchId)}/find-more`);
  if (!result.ok) return result;
  const pageId = result.data?.page_id || '';
  if (!pageId) return { ok: false, status: result.status, error: 'Happenstance did not return a page id.' };
  return { ok: true, pageId };
}

/** The balance. Free to call. */
export async function credits() {
  const result = await call('GET', '/v1/usage');
  if (!result.ok) return { ok: false, error: result.error, balance: null };
  return {
    ok: true,
    balance: Number(result.data?.balance_credits ?? 0),
    hasCredits: !!result.data?.has_credits,
  };
}

/* --------------------------------------------------------------- allowlist */

/**
 * The complete set of fields ever read off a result.
 *
 * Exactly as roster.js does with Airtable, this is the whole list: name, what
 * they do now, the one-paragraph summary, the evidence lines, a score, the
 * mutuals through whom they are reachable, and one public profile URL. Not
 * phone numbers, not addresses, not employment history, not whatever the API
 * adds next year. Adding a field here is a code change and therefore a
 * reviewed one.
 */
export function normalise(data) {
  const mutuals = Array.isArray(data.mutuals) ? data.mutuals : [];
  const nameOf = (index) => mutuals.find((m) => m.index === index)?.name || '';
  const list = Array.isArray(data.results) ? data.results : [];
  return list.map((row, position) => {
    const traits = Array.isArray(row.traits) ? row.traits : [];
    const evidence = traits
      .filter((t) => t && t.evidence && Number(t.score) > 0)
      .map((t) => String(t.evidence).replace(/\*\*/g, '').trim())
      .filter(Boolean);
    const through = (Array.isArray(row.mutuals) ? row.mutuals : [])
      .slice()
      .sort((a, b) => Number(b.affinity_score || 0) - Number(a.affinity_score || 0))
      .map((m) => nameOf(m.index))
      .filter(Boolean);
    const id = String(row.id || '');
    return {
      hsId: id,
      personHash: personHash(id || `${row.name}|${row.socials?.linkedin_url || ''}`),
      name: clean(row.name, 120),
      title: clean(row.current_title, 160),
      org: clean(row.current_company, 160),
      summary: clean(row.summary, 600),
      evidence: evidence.map((e) => e.slice(0, 400)).slice(0, 4),
      score: Number.isFinite(Number(row.weighted_traits_score)) ? Number(row.weighted_traits_score) : null,
      through: [...new Set(through)].slice(0, 4),
      profileUrl: publicUrl(row.socials?.linkedin_url) || publicUrl(row.socials?.happenstance_url) || '',
      position,
    };
  }).filter((p) => p.name);
}

function clean(value, max) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function publicUrl(value) {
  if (!value) return '';
  try {
    const url = new URL(String(value));
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    return url.toString();
  } catch {
    return '';
  }
}

/**
 * The join key for one person across searches, suppression and cooldowns.
 *
 * A hash of the Happenstance id rather than the id itself, so a copy of the
 * suppression table is a list of opaque strings and not a list of people.
 */
export function personHash(identity) {
  return createHash('sha256').update(`hs:${identity}`).digest('hex');
}

/** One normalised form of a query, so two members typing the same thing share a search. */
export function normaliseQuery(text) {
  return String(text || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}

export function queryHash(text, scope = '') {
  return createHash('sha256').update(`${normaliseQuery(text)}|${scope}`).digest('hex');
}
