/**
 * The roster — deciding who is actually in the Biopunk programme.
 *
 * Homeroom is a members-only room whose whole value is that it is closed. Until
 * now anyone who found the URL could create an account. This module is the gate:
 * an address is checked against the Airtable People table before an account
 * exists, and re-checked periodically afterwards.
 *
 * ── WHAT THE AIRTABLE ACTUALLY SAYS ──────────────────────────────────────
 *
 * Two fields describe status and they do not always agree:
 *
 *   Status                     Applied · Interviewed · Ready to Reject ·
 *                              Accepted · Declined · Pending · Rescinded ·
 *                              Waitlist · Deferred
 *
 *   Lifecycle Status (Computed)  a formula: move-out in the past → Alumni;
 *                              move-in today or earlier → Resident; move-in in
 *                              the future → Applicant; otherwise the manual
 *                              lifecycle field, else derived from Status.
 *
 * At the time this was written, of 141 people, eight are "Resident" or "Alumni"
 * by the date formula while their Status says Rescinded, Declined or Deferred —
 * someone whose offer was pulled but whose move-in date was never cleared, or
 * who declined and later subletted. Those eight are the entire difficulty here,
 * because the two obvious rules both get them wrong:
 *
 *   trust Status only    → locks out people who genuinely live in the house
 *   trust lifecycle only → lets someone whose offer was rescinded into a
 *                          private room on the strength of a stale date
 *
 * So the rule below is deliberately three-valued. `allow` and `deny` cover the
 * cases the data answers cleanly. Anything where the two fields point in
 * opposite directions comes back `review`: no account is created, nothing is
 * silently rejected, and a steward sees the conflict on /homeroom/stewards/access
 * with both fields shown. Eight rows of human judgement beats a wrong guess in
 * either direction on day one.
 *
 * Rescinded is the one status that overrides everything, including an active
 * residency. It is the most explicit signal the table can carry that someone's
 * place was taken away, and an access gate should fail closed on it. If the date
 * is what is wrong, a steward fixes the date.
 *
 * ── PRIVACY ──────────────────────────────────────────────────────────────
 *
 * The People table also holds medical notes, allergies, emergency contacts,
 * home addresses, visa status and whether someone asked for financial help.
 * None of that has any business being in this process. `FIELDS` below is the
 * complete list of what is ever requested, in the same spirit as the mentors
 * edge function: add a field there to use it, and nothing else is ever fetched.
 *
 * Verdicts are cached against a SHA-256 of the address rather than the address
 * itself, so a copy of the Homeroom database is not also a copy of the resident
 * list.
 */

import { createHash } from 'node:crypto';

const BASE = process.env.HOMEROOM_ROSTER_BASE || 'app9STfjol4NHGEWj';
const TABLE = process.env.HOMEROOM_ROSTER_TABLE || 'tblC1nB717HfTDEaa';
const TIMEOUT_MS = 8000;

/** Everything this module is ever allowed to read. Nothing else leaves Airtable. */
const FIELDS = [
  'First Name', 'Last Name',
  'Email', 'Additional Email', 'Personal Email',
  'Status', 'Lifecycle Status (Computed)', 'Resident type',
  'Cohorts', 'House',
];

/* ----------------------------------------------------------------- config */

export function token() {
  // Falls back to the token the mentors proxy already uses, for the common case
  // where one personal access token covers both bases.
  return process.env.HOMEROOM_ROSTER_TOKEN || process.env.AIRTABLE_TOKEN || '';
}

export function configured() {
  return !!token();
}

/**
 * How the front door behaves.
 *
 *   roster  check Airtable; refuse if it cannot be reached (default when a
 *           token is set — an access gate that opens when the check fails is
 *           not a gate)
 *   open    anyone can sign up (the old behaviour; local development)
 *   closed  no self-signup at all; stewards create accounts
 */
export function accessMode() {
  const mode = String(process.env.HOMEROOM_ACCESS || '').toLowerCase();
  if (['roster', 'open', 'closed'].includes(mode)) return mode;
  return configured() ? 'roster' : 'open';
}

const listFrom = (value, fallback) => {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  return raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
};

/** Statuses that grant access on their own. */
const ACCEPTED_STATUSES = () =>
  listFrom(process.env.HOMEROOM_ROSTER_STATUSES, ['accepted']);

/** Lifecycles that grant access on their own. */
const ACCEPTED_LIFECYCLES = () =>
  listFrom(process.env.HOMEROOM_ROSTER_LIFECYCLES, ['resident', 'alumni']);

/** Resident types that grant access — people who physically live or worked there. */
const ACCEPTED_TYPES = () =>
  listFrom(process.env.HOMEROOM_ROSTER_TYPES,
    ['core resident', 'subletter', 'ra', 'alum', 'co-founder']);

/** Statuses that revoke access no matter what the date fields say. */
const BLOCKING_STATUSES = () =>
  listFrom(process.env.HOMEROOM_ROSTER_BLOCKED, ['rescinded', 'ready to reject']);

/** Statuses that conflict with an active residency rather than settling it. */
const AMBIGUOUS_STATUSES = () =>
  listFrom(process.env.HOMEROOM_ROSTER_AMBIGUOUS, ['declined', 'deferred']);

/** Addresses that always get in, for staff who are not in the People table. */
export function alwaysAllow() {
  return new Set(
    String(process.env.HOMEROOM_ALWAYS_ALLOW || '')
      .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
  );
}

/** How long a verdict is trusted before it is checked again, in seconds. */
export function verdictTtl() {
  const days = Number(process.env.HOMEROOM_ROSTER_TTL_DAYS);
  return (Number.isFinite(days) && days > 0 ? days : 7) * 86400;
}

/* ------------------------------------------------------------------ utils */

export function emailHash(email) {
  return createHash('sha256').update(normalizeEmail(email)).digest('hex');
}

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

/** Show a steward enough to recognise an address without printing it in full. */
export function maskEmail(email) {
  const value = normalizeEmail(email);
  const at = value.indexOf('@');
  if (at < 1) return '—';
  const local = value.slice(0, at);
  const shown = local.length <= 2 ? local[0] : local.slice(0, 2);
  return `${shown}${'*'.repeat(Math.max(1, local.length - shown.length))}${value.slice(at)}`;
}

/**
 * Only ever interpolate an address we have proved is an address.
 *
 * The lookup builds an Airtable formula by string concatenation, so anything
 * with a quote or a paren in it could change the formula's meaning. Rejecting
 * here rather than escaping is the safer of the two, because the set of valid
 * addresses is small and known.
 */
const SAFE_EMAIL = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

/* ------------------------------------------------------- linked-record names */

/*
 * Cohorts and House are linked records, so Airtable returns record ids. These
 * two tiny maps turn them into names for prefilling a profile. Strictly
 * best-effort: if either lookup fails the gate still works and the member just
 * types their own cohort in.
 */
const LINK_TABLES = {
  cohorts: process.env.HOMEROOM_ROSTER_COHORTS_TABLE || 'tblf3tH9obwWxrt8G',
  homes: process.env.HOMEROOM_ROSTER_HOMES_TABLE || 'tblqx7eQnVkPmTBFj',
};
const linkCache = new Map();

async function linkNames(which) {
  if (linkCache.has(which)) return linkCache.get(which);
  const names = new Map();
  try {
    const url = new URL(`https://api.airtable.com/v0/${BASE}/${LINK_TABLES[which]}`);
    url.searchParams.set('pageSize', '100');
    for (const field of ['Name', 'Abbreviation']) url.searchParams.append('fields[]', field);
    const res = await fetch(url, { headers: { authorization: `Bearer ${token()}` } });
    if (res.ok) {
      const data = await res.json();
      for (const record of data.records || []) {
        const label = record.fields?.Abbreviation || record.fields?.Name;
        if (label) names.set(record.id, String(label));
      }
    }
  } catch {
    // Best effort. An empty map means "no prefill", never "no access".
  }
  linkCache.set(which, names);
  return names;
}

/* ----------------------------------------------------------------- lookup */

/**
 * Ask Airtable about one address.
 *
 * Returns `{ ok: false, error }` for anything that went wrong, which callers
 * must treat as "unknown", never as "denied" — the difference between a
 * temporary Airtable outage and a rejection is the difference between a member
 * waiting five minutes and a member being told they do not belong here.
 */
export async function lookup(email) {
  const address = normalizeEmail(email);
  if (!SAFE_EMAIL.test(address)) return { ok: true, found: false, verdict: 'deny', reason: 'not-an-address' };
  if (!configured()) return { ok: false, error: 'The roster is not configured.', unconfigured: true };

  const clauses = ['Email', 'Additional Email', 'Personal Email']
    .map((field) => `LOWER({${field}}) = '${address}'`)
    .join(', ');

  const url = new URL(`https://api.airtable.com/v0/${BASE}/${TABLE}`);
  url.searchParams.set('filterByFormula', `OR(${clauses})`);
  url.searchParams.set('pageSize', '5');
  for (const field of FIELDS) url.searchParams.append('fields[]', field);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { authorization: `Bearer ${token()}` },
      signal: controller.signal,
    });
    if (!res.ok) {
      return { ok: false, error: `The roster returned ${res.status}.`, status: res.status };
    }
    const data = await res.json();
    const records = data.records || [];
    if (!records.length) return { ok: true, found: false, verdict: 'deny', reason: 'not-on-the-roster' };

    // Duplicates happen (an applicant record and a resident record for the same
    // person). Take the most permissive verdict, so a stale duplicate cannot
    // lock out someone who is genuinely in the house.
    const evaluated = records.map((record) => evaluate(record.fields || {}));
    const rank = { allow: 0, review: 1, deny: 2 };
    evaluated.sort((a, b) => rank[a.verdict] - rank[b.verdict]);
    const best = evaluated[0];

    if (best.verdict === 'allow' || best.verdict === 'review') {
      best.person = await decorate(best.person);
    }
    return { ok: true, found: true, ...best };
  } catch (err) {
    const error = err?.name === 'AbortError' ? 'The roster timed out.' : 'Could not reach the roster.';
    return { ok: false, error };
  } finally {
    clearTimeout(timer);
  }
}

async function decorate(person) {
  if (!person) return person;
  const [cohorts, homes] = await Promise.all([linkNames('cohorts'), linkNames('homes')]);
  return {
    ...person,
    cohort: (person.cohortIds || []).map((id) => cohorts.get(id)).filter(Boolean)[0] || '',
    house: (person.houseIds || []).map((id) => homes.get(id)).filter(Boolean)[0] || '',
  };
}

const nameOf = (value) => (typeof value === 'object' && value ? value.name : value);

/**
 * The rule, on one Airtable record.
 *
 * Order matters, and each step is here for a reason:
 *   1. a blocking status beats everything, including an active residency
 *   2. an explicit Accepted is enough on its own — someone accepted for the
 *      next cohort has not moved in yet and still belongs in the room
 *   3. a residency-shaped lifecycle or resident type is enough on its own
 *   4. except when a negative status contradicts it, which is a `review`
 */
export function evaluate(fields) {
  const status = String(nameOf(fields.Status) || '').trim().toLowerCase();
  const lifecycle = String(fields['Lifecycle Status (Computed)'] || '').trim().toLowerCase();
  const type = String(nameOf(fields['Resident type']) || '').trim().toLowerCase();

  const person = {
    name: [fields['First Name'], fields['Last Name']].filter(Boolean).join(' ').trim(),
    status: nameOf(fields.Status) || '',
    lifecycle: fields['Lifecycle Status (Computed)'] || '',
    residentType: nameOf(fields['Resident type']) || '',
    cohortIds: fields.Cohorts || [],
    houseIds: fields.House || [],
  };

  if (BLOCKING_STATUSES().includes(status)) {
    return { verdict: 'deny', reason: `status-${status.replace(/\s+/g, '-')}`, person };
  }

  const byStatus = ACCEPTED_STATUSES().includes(status);
  const byLifecycle = ACCEPTED_LIFECYCLES().includes(lifecycle);
  const byType = ACCEPTED_TYPES().includes(type);

  if (byStatus) return { verdict: 'allow', reason: 'accepted', person };

  if (byLifecycle || byType) {
    // Lived there by the dates, but the status says otherwise. Not our call.
    if (AMBIGUOUS_STATUSES().includes(status)) {
      return { verdict: 'review', reason: `conflict-${status}-vs-${lifecycle || type}`, person };
    }
    return { verdict: 'allow', reason: byLifecycle ? `lifecycle-${lifecycle}` : `type-${type}`, person };
  }

  return { verdict: 'deny', reason: status ? `status-${status.replace(/\s+/g, '-')}` : 'no-status', person };
}

/** Reachability probe for /homeroom/health. Never throws, never blocks a page. */
export async function health() {
  if (!configured()) return { configured: false, mode: accessMode() };
  const url = new URL(`https://api.airtable.com/v0/${BASE}/${TABLE}`);
  url.searchParams.set('pageSize', '1');
  url.searchParams.append('fields[]', 'Status');
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(url, {
      headers: { authorization: `Bearer ${token()}` },
      signal: controller.signal,
    });
    clearTimeout(timer);
    return { configured: true, mode: accessMode(), reachable: res.ok, status: res.status };
  } catch {
    return { configured: true, mode: accessMode(), reachable: false };
  }
}
