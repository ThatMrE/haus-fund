/**
 * Luma — pulling luma.com/biopunk into the Homeroom calendar.
 *
 * The public API is `GET https://public-api.luma.com/v1/calendars/events/list`
 * with the key in an `x-luma-api-key` header. Keys are scoped to a single
 * calendar, which is why there is one variable and not a calendar id: the key
 * *is* the calendar selector.
 *
 * Two things about that API shape the code below.
 *
 * 1. It needs a Luma Plus subscription. Without a key this module reports
 *    `configured: false` and the events page renders the Luma calendar as a
 *    link-out instead of a grid. That is the honest fallback, and it is what
 *    most people running this will actually see.
 *
 * 2. Response field names have moved between revisions (`entries` vs `events`,
 *    nested `event` objects, `start_at` vs `start_at_utc`). `normalizeEvent`
 *    reads every shape it has been seen in rather than pinning one, because the
 *    failure mode of pinning is a sweep that silently imports nothing.
 *
 * Imports are idempotent on the Luma event id via `hr_event_sources`, so the
 * sweep can run as often as it likes and a re-run updates rather than
 * duplicates. Members RSVP in Homeroom *and* the row keeps its Luma URL, since
 * registration still happens on Luma.
 */

import * as hr from './models.js';

const API = 'https://public-api.luma.com/v1';
const TIMEOUT_MS = 12_000;

export function configured() {
  return !!process.env.LUMA_API_KEY;
}

/** The public calendar, for the link-out when there is no API key. */
export function calendarUrl() {
  return process.env.LUMA_CALENDAR_URL || 'https://luma.com/biopunk';
}

/** Who owns imported events locally. Falls back to the first steward. */
function importerId() {
  return process.env.LUMA_IMPORT_AS || '';
}

async function call(path, params = {}) {
  const key = process.env.LUMA_API_KEY;
  if (!key) return { ok: false, error: 'LUMA_API_KEY is not set.', unconfigured: true };

  const url = new URL(`${API}/${path}`);
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(name, String(value));
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { 'x-luma-api-key': key, accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) {
      // 401/403 almost always means the key is for a different calendar, or the
      // plan lapsed. Say which, because "Luma error 403" helps nobody.
      const hint = res.status === 401 || res.status === 403
        ? ' — check the key is for this calendar and the Luma Plus plan is active'
        : '';
      return { ok: false, error: `Luma returned ${res.status}${hint}.`, status: res.status };
    }
    return { ok: true, data: await res.json() };
  } catch (err) {
    return { ok: false, error: err?.name === 'AbortError' ? 'Luma timed out.' : 'Could not reach Luma.' };
  } finally {
    clearTimeout(timer);
  }
}

const seconds = (value) => {
  if (!value) return null;
  const ms = typeof value === 'number' ? value * (value > 1e11 ? 1 : 1000) : Date.parse(value);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
};

/** Map Luma's own categories onto ours; anything unknown is a meetup. */
function kindFor(event) {
  const text = `${event.name || ''} ${event.description || ''}`.toLowerCase();
  if (/demo\s*day|showcase/.test(text)) return 'demoday';
  if (/workshop|clinic|office hour/.test(text)) return 'workshop';
  if (/talk|panel|fireside|lecture|seminar/.test(text)) return 'talk';
  if (/open lab|lab tour|open house/.test(text)) return 'openlab';
  if (event.zoom_url || event.meeting_url || /virtual|online|zoom/.test(text)) return 'online';
  return 'meetup';
}

function place(event) {
  const geo = event.geo_address_info || event.geo_address || {};
  return [geo.city_state, geo.address, geo.full_address, event.location, event.timezone]
    .find((value) => typeof value === 'string' && value.trim()) || '';
}

/**
 * One Luma entry, in our shape.
 *
 * Returns null rather than a half-built row when the two fields that actually
 * matter — an id and a start time — are missing. An event with no start cannot
 * go on a calendar, and importing it would put a hole in the grid.
 */
export function normalizeEvent(entry) {
  const event = entry?.event || entry || {};
  const externalId = event.api_id || event.id || entry?.api_id || entry?.id;
  const startsAt = seconds(event.start_at || event.start_at_utc || event.start_time);
  if (!externalId || !startsAt) return null;

  const endsAt = seconds(event.end_at || event.end_at_utc || event.end_time);
  const minutes = endsAt && endsAt > startsAt
    ? Math.min(24 * 60, Math.round((endsAt - startsAt) / 60))
    : 90;

  return {
    externalId: String(externalId),
    title: String(event.name || event.title || 'Untitled event').slice(0, 200),
    description: String(event.description || event.description_md || '').slice(0, 8000),
    kind: kindFor(event),
    startsAt,
    minutes,
    place: place(event).slice(0, 200),
    url: event.url
      ? (String(event.url).startsWith('http') ? event.url : `https://luma.com/${event.url}`)
      : (externalId ? `https://luma.com/event/${externalId}` : null),
    capacity: Number(event.capacity) > 0 ? Number(event.capacity) : 0,
    canceled: /cancel/i.test(String(event.visibility || event.status || '')),
  };
}

/** One page of the calendar, already normalized. */
export async function fetchEvents({ after = null, before = null, limit = 100, cursor = null } = {}) {
  const result = await call('calendars/events/list', {
    // Luma has used both spellings across revisions; sending both is harmless.
    after: after ? new Date(after * 1000).toISOString() : undefined,
    before: before ? new Date(before * 1000).toISOString() : undefined,
    pagination_limit: limit,
    pagination_cursor: cursor || undefined,
  });
  if (!result.ok) return result;

  const payload = result.data || {};
  const rows = payload.entries || payload.events || payload.data || [];
  const events = (Array.isArray(rows) ? rows : []).map(normalizeEvent).filter(Boolean);
  return {
    ok: true,
    events,
    nextCursor: payload.next_cursor || payload.pagination_cursor || null,
    hasMore: !!payload.has_more,
  };
}

/**
 * Pull the calendar into `hr_events`.
 *
 * Walks the cursor to the end rather than taking one page, because a busy
 * cohort calendar runs past the page size and a half-imported month is worse
 * than none — the gaps look like nothing is scheduled.
 */
export async function sync({ hostId, windowDays = 180, maxPages = 10 } = {}) {
  if (!configured()) return { ok: false, error: 'LUMA_API_KEY is not set.', unconfigured: true };

  const host = hostId || importerId();
  if (!host) return { ok: false, error: 'No local account to attribute imported events to.' };

  const now = Math.floor(Date.now() / 1000);
  let cursor = null;
  let created = 0;
  let updated = 0;
  let seen = 0;

  for (let page = 0; page < maxPages; page++) {
    const result = await fetchEvents({
      after: now - 30 * 86400,
      before: now + windowDays * 86400,
      cursor,
    });
    if (!result.ok) {
      // Partial success is still success: report what landed alongside the error
      // rather than throwing away the pages that worked.
      return { ...result, created, updated, seen, partial: seen > 0 };
    }
    for (const event of result.events) {
      seen++;
      const outcome = hr.upsertExternalEvent({ source: 'luma', hostId: host, ...event });
      if (outcome.created) created++;
      else updated++;
    }
    cursor = result.nextCursor;
    if (!cursor || !result.hasMore || !result.events.length) break;
  }

  return { ok: true, created, updated, seen };
}
