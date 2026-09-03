/**
 * Pulling the mentor onboarding form into Homeroom.
 *
 * A mentor fills in a public Airtable form; the row lands in the Mentors table;
 * this sweep brings it in as `state = 'pending'`, which is listed NOWHERE until
 * a steward vets it at /homeroom/stewards/mentors.
 *
 * ── THE FORM IS A PUBLIC WRITE ENDPOINT ──────────────────────────────────
 *
 * Anyone with the URL can submit. Assume spam, competitors, people
 * misrepresenting who they work for, and at least one attempt at markup
 * injection. Three things stand between that and a member:
 *
 *   1. Gate A — a steward vets every submission. The only real defence, and
 *      the reason nothing here writes `state = 'listed'`.
 *   2. The scheduler host allowlist in mentorfields.js, shared with the
 *      importer so the two cannot drift.
 *   3. The html`` templating in util.js, which escapes on the way out.
 *
 * Rate-limiting and CAPTCHA on the form itself are Airtable's job, not this
 * module's. Worth doing before publishing the URL; see the README.
 *
 * ── WHY POLLING AND NOT A WEBHOOK ────────────────────────────────────────
 *
 * Airtable automations can POST on submit, which is faster and tempting. Three
 * reasons this polls instead, at least until storage is durable:
 *
 *   1. A webhook can arrive at a container that is about to be recycled, and
 *      the submission is gone with no retry. A poll re-reads the source of
 *      truth every time and is idempotent by construction.
 *   2. luma-sync.mjs is already this shape — every six hours, plus a button —
 *      and one pattern in a codebase beats two.
 *   3. Latency does not matter. A mentor waits for a human to vet them anyway,
 *      so six hours of sync delay is invisible next to gate A.
 *
 * ── THE FAILURE DIRECTION ────────────────────────────────────────────────
 *
 * Closed and silent. Airtable unreachable means the existing roster stands
 * unchanged: no additions, no removals, an error on the steward page. A sync
 * that read "could not fetch" as "the table is empty" would deactivate the
 * whole roster — which is the lesson `--replace-seed` already encodes in the
 * importer, where the destructive step runs only after a clean fetch.
 */

import { getDb, transaction } from './db.js';
import { nowSeconds } from './util.js';
import { normalize } from './mentorfields.js';
import * as hr from './models.js';
import { logEvent, contactFor } from './mentordesk.js';
import * as life from './mentorlife.js';
import * as mentormail from './mentormail.js';

const BASE = () => process.env.HOMEROOM_MENTORS_BASE || 'appisCTsCCcBCMSk0';
const TABLE = () => process.env.HOMEROOM_MENTORS_TABLE || 'tblwHSlwNLXIfXFX9';
const TIMEOUT_MS = 12_000;

/**
 * Everything this module is ever allowed to read.
 *
 * The token is scoped to a BASE, not a table, and this base also holds LPs,
 * Investments, Capital Flows, IC Reviews, Applications and Interview
 * Scorecards — the mentors edge function says so in its own header. Nothing
 * outside this list is ever requested. Adding a field is a code change.
 */
export const FIELDS = [
  'Name', 'Role', 'Title', 'Organization', 'Company',
  'Area of Expertise', 'Tags', 'Location', 'Bio',
  'Scheduler', 'Calendly', 'Booking Link', 'Format',
  'Email', 'Capacity', 'Consent Mode', 'Tracks',
  'Vetted', 'Status',
];

export function token() {
  return process.env.HOMEROOM_MENTOR_SYNC_TOKEN || process.env.AIRTABLE_TOKEN || '';
}

export function configured() {
  return !!token();
}

/** Airtable's shape, flattened to the keys `normalize()` understands. */
function toRow(record) {
  const f = record.fields || {};
  const list = (value) => (Array.isArray(value) ? value.join(',') : (value || ''));
  return {
    '__record_id': record.id,
    name: f.Name || '',
    role: f.Role || f.Title || '',
    org: f.Organization || f.Company || '',
    'area of expertise': f['Area of Expertise'] || '',
    tags: list(f.Tags),
    location: f.Location || '',
    bio: f.Bio || '',
    scheduler: f.Scheduler || f.Calendly || f['Booking Link'] || '',
    format: f.Format || '',
    email: f.Email || '',
    capacity: f.Capacity || '',
    'consent mode': list(f['Consent Mode']),
    tracks: list(f.Tracks),
    vetted: f.Vetted ? 'yes' : '',
    status: f.Status || '',
  };
}

/** Fetch every page. Throws rather than returning a short list on failure. */
export async function fetchRows() {
  if (!configured()) throw new Error('No Airtable token for the mentor sync.');

  const rows = [];
  let offset = null;
  do {
    const url = new URL(`https://api.airtable.com/v0/${BASE()}/${TABLE()}`);
    url.searchParams.set('pageSize', '100');
    if (offset) url.searchParams.set('offset', offset);
    for (const field of FIELDS) url.searchParams.append('fields[]', field);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        headers: { authorization: `Bearer ${token()}` },
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Airtable returned ${res.status}`);
      const data = await res.json();
      for (const record of data.records || []) rows.push(toRow(record));
      offset = data.offset;
    } catch (err) {
      throw new Error(err?.name === 'AbortError' ? 'Airtable timed out.' : (err?.message || 'Airtable unreachable.'));
    } finally {
      clearTimeout(timer);
    }
  } while (offset);

  return rows;
}

/**
 * Match an incoming row to a mentor already here.
 *
 * On the Airtable record id first, because two mentors can share a name and one
 * mentor can change theirs — the name slug the importer used cannot express
 * either. The slug stays as the fallback so rows imported before this column
 * existed are adopted rather than duplicated on the first sweep.
 */
async function findExisting(db, mentor) {
  if (mentor.airtableId) {
    const byId = ((await db.prepare('SELECT * FROM hr_mentors WHERE airtable_id = ?').get(mentor.airtableId)));
    if (byId) return byId;
  }
  const slug = hr.slugify(mentor.name, 'mentor');
  return ((await db.prepare('SELECT * FROM hr_mentors WHERE slug = ?').get(slug))) ?? null;
}

/**
 * Apply one row.
 *
 * The rules that matter, in order of how badly getting them wrong would hurt:
 *
 *   - a NEW row is always `pending`. Never listed, never vetted, whatever the
 *     Airtable columns say. `Vetted` in Airtable is somebody's note to
 *     themselves; gate A is a steward in Homeroom.
 *   - an EXISTING row keeps its state. A sweep must not un-list a mentor a
 *     steward listed, or re-list one they rejected, because a form was edited.
 *   - `scheduler` and `email` are only ever overwritten with a non-empty value.
 *     A mentor blanking a field by accident, or Airtable omitting it from a
 *     response, must not silently remove the only way to reach them.
 */
async function applyRow(db, mentor, now) {
  const existing = await findExisting(db, mentor);
  const tags = mentor.tags.join(',');
  const tracks = mentor.tracks.join(',');

  if (!existing) {
    // RETURNING rather than lastInsertRowid, which Postgres does not have.
    const row = ((await db.prepare(
      `INSERT INTO hr_mentors (slug, name, role, org, track, tags, location, bio, format,
                               scheduler, vetted, active, source, created_at,
                               state, consent_mode, capacity, tracks, email, airtable_id, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, 'form', ?, 'pending', ?, ?, ?, ?, ?, ?)
       RETURNING id`,
    ).get(hr.slugify(mentor.name, 'mentor'), mentor.name, mentor.role, mentor.org, mentor.track,
      tags, mentor.location, mentor.bio, mentor.format, mentor.scheduler, now,
      mentor.consentMode, mentor.capacity, tracks, mentor.email, mentor.airtableId, now)));
    return { id: Number(row.id), created: true };
  }

  ((await db.prepare(
    `UPDATE hr_mentors SET name = ?, role = ?, org = ?, track = ?, tags = ?, location = ?,
            bio = ?, format = ?,
            scheduler = CASE WHEN ? != '' THEN ? ELSE scheduler END,
            email     = CASE WHEN ? != '' THEN ? ELSE email     END,
            consent_mode = ?, capacity = CASE WHEN ? > 0 THEN ? ELSE capacity END,
            tracks = ?, airtable_id = CASE WHEN ? != '' THEN ? ELSE airtable_id END,
            synced_at = ?
     WHERE id = ?`,
  ).run(mentor.name, mentor.role, mentor.org, mentor.track, tags, mentor.location,
    mentor.bio, mentor.format,
    mentor.scheduler, mentor.scheduler,
    mentor.email, mentor.email,
    mentor.consentMode, mentor.capacity, mentor.capacity,
    tracks, mentor.airtableId, mentor.airtableId,
    now, existing.id)));
  return { id: existing.id, created: false };
}

/**
 * The sweep.
 *
 * Fetches everything first, then writes in one transaction. The order is the
 * whole safety property: nothing is touched until the fetch has completely
 * succeeded, so a partial read cannot half-update the roster.
 */
export async function sync() {
  let rows;
  try {
    rows = await fetchRows();
  } catch (err) {
    return { ok: false, error: err.message };
  }

  const mentors = rows.map(normalize).filter(Boolean);
  if (!mentors.length) {
    // An empty table is indistinguishable from a misconfigured base id, and
    // one of those two should not quietly become "we have no mentors".
    return { ok: false, error: 'The mentors table came back empty. Refusing to sync.' };
  }

  const now = nowSeconds();
  const result = await transaction(async (db) => {
    let created = 0;
    let updated = 0;
    const pending = [];
    for (const mentor of mentors) {
      const { id, created: isNew } = await applyRow(db, mentor, now);
      if (isNew) { created += 1; pending.push({ id, name: mentor.name }); }
      else updated += 1;
    }
    return { created, updated, pending };
  });

  for (const row of result.pending) {
    await logEvent({ mentorId: row.id, actorKind: 'system', event: 'submitted', detail: 'from the onboarding form' });
  }
  markSync({ ok: true, seen: mentors.length, ...result });
  return { ok: true, seen: mentors.length, ...result };
}

/* ------------------------------------------------------------ sync status */

/*
 * Where the last run is recorded.
 *
 * In hr_settings rather than a new table: this is one row of operational
 * state, and a steward asking "did the sync run" wants an answer, not a
 * migration.
 */
let lastRun = null;

export function markSync(state) {
  lastRun = { ...state, at: nowSeconds() };
  return lastRun;
}

export function lastSync() {
  return lastRun;
}

export async function status() {
  const db = await getDb();
  const counts = ((await db.prepare(
    `SELECT state, COUNT(*) AS n FROM hr_mentors GROUP BY state`,
  ).all()));
  return {
    configured: configured(),
    last: lastRun,
    byState: Object.fromEntries(counts.map((r) => [r.state, r.n])),
  };
}

/* ---------------------------------------------------------------- gate A */

/** The queue: submissions nobody has ruled on. */
export async function pendingSubmissions({ limit = 50 } = {}) {
  return (await (await getDb()).prepare(
    `SELECT id, slug, name, role, org, track, tags, location, bio, format,
            capacity, consent_mode, tracks, source, created_at, synced_at
     FROM hr_mentors WHERE state = 'pending' ORDER BY created_at ASC LIMIT ?`,
  ).all(limit));
}

export async function pendingCount() {
  return (await (await getDb()).prepare("SELECT COUNT(*) AS n FROM hr_mentors WHERE state = 'pending'").get()).n;
}

/**
 * A steward's ruling.
 *
 * `list` also sets `vetted`, because in this design they mean the same thing —
 * a steward has looked at this person and is willing to put them in front of
 * members. A rejection keeps the row so the next sweep does not re-add it as a
 * fresh submission, and requires a note so the next steward knows why.
 */
export async function rule({ mentorId, decision, actorId, note = '' }) {
  const state = decision === 'list' ? 'listed' : 'rejected';
  const db = await getDb();
  const mentor = ((await db.prepare('SELECT id, name, state FROM hr_mentors WHERE id = ?').get(Number(mentorId))));
  if (!mentor) return null;

  (await db.prepare('UPDATE hr_mentors SET state = ?, vetted = ?, active = ? WHERE id = ?')
    .run(state, state === 'listed' ? 1 : 0, state === 'listed' ? 1 : 0, mentor.id));
  await logEvent({
    mentorId: mentor.id, actorId, actorKind: 'steward',
    event: state === 'listed' ? 'listed' : 'rejected', detail: note.slice(0, 300),
  });
  return { ...mentor, state };
}

/** Requests a mentor has left sitting — the early warning before dormancy. */
export async function stuckRequests({ days = 5, limit = 30 } = {}) {
  const cutoff = nowSeconds() - days * 86400;
  return (await (await getDb()).prepare(
    `SELECT r.id, r.created_at, r.member_id, m.name AS mentor_name, m.slug AS mentor_slug
     FROM hr_mentor_requests r JOIN hr_mentors m ON m.id = r.mentor_id
     WHERE r.state = 'sent' AND r.created_at < ? ORDER BY r.created_at ASC LIMIT ?`,
  ).all(cutoff, limit));
}

/* ------------------------------------------------------------- the sweep */

/**
 * The lifecycle pass: auto-pause, re-confirm, dormancy, outcome nags.
 *
 * Runs in the same scheduled function as the Airtable pull, but BEFORE it and
 * unconditionally — the roster needs keeping honest whether or not an Airtable
 * token is configured, and a second scheduled function would be a second thing
 * to forget.
 *
 * Every step is idempotent and every send is recorded, so a double fire does
 * not double-mail anyone. Mail failures are swallowed on purpose: a mentor who
 * could not be told they were paused is still paused, and throwing here would
 * abandon the rest of the sweep partway through.
 */
export async function lifecycle({ now = undefined } = {}) {
  const at = now ?? nowSeconds();
  const result = { paused: 0, reconfirmed: 0, dormant: 0, nagged: 0 };

  for (const mentor of await life.autoPauseSilent(at)) {
    result.paused += 1;
    const to = await contactFor(mentor.id);
    if (to) {
      mentormail.deliver(mentormail.autoPausedMessage({
        mentor, to, token: await life.mintToken(mentor.id, { now: at }),
      })).catch(() => {});
    }
  }

  const { due, dormant } = await life.reconfirmDue(at);

  for (const mentor of due) {
    const to = await contactFor(mentor.id);
    await life.markNudged(mentor.id, at);
    result.reconfirmed += 1;
    if (!to) continue;
    mentormail.deliver(mentormail.reconfirmMessage({
      mentor, to, token: await life.mintToken(mentor.id, { kind: 'reconfirm', now: at }),
    })).catch(() => {});
  }

  for (const mentor of dormant) {
    await life.makeDormant(mentor.id, at);
    result.dormant += 1;
    const to = await contactFor(mentor.id);
    if (!to) continue;
    mentormail.deliver(mentormail.dormantMessage({
      mentor, to, token: await life.mintToken(mentor.id, { now: at }),
    })).catch(() => {});
  }

  for (const row of await life.outcomeNagsDue(at)) {
    await hr.notify({
      userId: row.member_id,
      kind: 'intro',
      text: `How did it go with ${row.mentor_name}?`,
      href: '/homeroom/mentors/requests',
    });
    await logEvent({ requestId: row.id, actorKind: 'system', event: 'outcome-nagged' });
    result.nagged += 1;
  }

  return result;
}
