/**
 * The introduction engine — double opt-in intros to people outside the house.
 *
 * A member searches the connector's network by keyword, finds someone, and
 * clicks "introduce me". Nothing is sent by that click. A steward reads the
 * request, supplies an address and sends a short permission ask to the target;
 * the target answers yes, no, or never, from an email, with no account; and
 * only on a yes does the actual introduction go out with both people on it.
 *
 * See docs/INTRO-ENGINE.md for the full design. What follows is the part that
 * is built, and the rules it enforces rather than merely displaying.
 *
 * ── WHY THE MEMBER SEARCHES BUT DOES NOT SEND ────────────────────────────
 *
 * The spec's Phase 1 gives the search to stewards only, on the grounds that a
 * search costs credits and a member cannot see the balance. That reasoning is
 * about money, and money has a cheaper answer than taking the feature away:
 * cache the search, cap the month, and refuse at zero. So members do get the
 * search box — it is the thing they actually asked for — and the gate stays
 * exactly where it does the work, which is the gap between finding someone and
 * contacting them.
 *
 * The rule that gap enforces, stated once because every function below serves
 * it: NOTHING LEAVES THIS BUILDING WITHOUT A STEWARD CLICKING. A member's
 * click writes a row. Only `sendPermission` puts a message in front of a
 * stranger, only a human steward session can call it, and only `introduce`
 * follows a recorded yes.
 *
 * ── WHAT PROTECTS THE TARGET ─────────────────────────────────────────────
 *
 * Three things, in the order they bite:
 *
 *   suppression   "never ask me again" is checked before a member ever sees a
 *                 result, so a suppressed person is not in the list to click.
 *   cooldowns     a no or a silence rests that person: 180 days from this
 *                 member, 45 days from everyone.
 *   caps          per member, and a house-wide weekly ceiling on permission
 *                 messages, because the failure mode here is not a bug — it is
 *                 this working correctly, at volume, until the network stops
 *                 answering.
 *
 * And one thing that protects the member from themselves: a decline is never
 * shown to them as a decline. `memberView()` collapses every state into four
 * strings, so a "no" costs the target nothing and is never something the
 * member can attribute. That function is the privacy boundary; the raw row is
 * steward-only.
 */

import { randomBytes, createHash, createCipheriv, createDecipheriv, scryptSync } from 'node:crypto';
import * as sql from './db.js';
import * as hs from './happenstance.js';
import { nowSeconds } from './util.js';

const DAY = 86400;

/* ----------------------------------------------------------------- config */

const num = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

/** Master switch. Off means the surfaces do not exist. */
export const enabled = () => process.env.HOMEROOM_INTRO_ENABLED === '1';

export const searchable = () => hs.configured();

export const maxOpen = () => num(process.env.HOMEROOM_INTRO_MAX_OPEN, 3);
export const maxMonthly = () => num(process.env.HOMEROOM_INTRO_MAX_MONTHLY, 5);
export const windowDays = () => num(process.env.HOMEROOM_INTRO_WINDOW_DAYS, 10);
export const cooldownDays = () => num(process.env.HOMEROOM_INTRO_COOLDOWN_DAYS, 180);
export const globalCooldownDays = () => num(process.env.HOMEROOM_INTRO_GLOBAL_COOLDOWN_DAYS, 45);
export const weeklyCap = () => num(process.env.HOMEROOM_INTRO_WEEKLY_CAP, 20);
export const creditBudget = () => num(process.env.HOMEROOM_INTRO_CREDIT_BUDGET, 40);
export const searchTtlDays = () => num(process.env.HOMEROOM_INTRO_SEARCH_TTL_DAYS, 30);

/* ------------------------------------------------------------------ audit */

export async function logEvent({ requestId = null, searchId = null, actorId = null,
  actorKind = 'system', event, detail = '' }) {
  await sql.run(`INSERT INTO hr_intro_events (request_id, search_id, actor_id, actor_kind, event, detail, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`, requestId, searchId, actorId, actorKind, event,
  String(detail || '').slice(0, 500), nowSeconds());
}

export async function eventsFor(requestId, { limit = 60 } = {}) {
  return await sql.all('SELECT * FROM hr_intro_events WHERE request_id = ? ORDER BY created_at ASC LIMIT ?',
    Number(requestId), limit);
}

/* ------------------------------------------------- the target's address */

/*
 * Addresses are encrypted at rest and deleted when the request closes.
 *
 * Happenstance does not return them, so every address here was typed by a
 * steward out of their own contacts. It has to survive between "send the
 * permission ask" and "send the introduction" — otherwise a yes cannot be
 * acted on — and it has no business outliving that. AES-256-GCM under a key
 * derived from HOMEROOM_SECRET, which is already the trust root for sessions
 * and CSRF, so this adds no new secret to manage and no dependency.
 *
 * With no HOMEROOM_SECRET set the key is random per process, which means a
 * restart loses the ability to read stored addresses. That is the honest
 * failure for a development default, and the README says to set it.
 */
let cachedKey = null;
function addressKey() {
  if (cachedKey) return cachedKey;
  const secret = process.env.HOMEROOM_SECRET || randomBytes(32).toString('hex');
  cachedKey = scryptSync(secret, 'homeroom-intro-address', 32);
  return cachedKey;
}

export function resetAddressKey() { cachedKey = null; }

export function encryptAddress(address) {
  if (!address) return '';
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', addressKey(), iv);
  const body = Buffer.concat([cipher.update(String(address), 'utf8'), cipher.final()]);
  return `v1.${iv.toString('base64')}.${cipher.getAuthTag().toString('base64')}.${body.toString('base64')}`;
}

export function decryptAddress(stored) {
  if (!stored || !stored.startsWith('v1.')) return '';
  const [, iv, tag, body] = stored.split('.');
  try {
    const decipher = createDecipheriv('aes-256-gcm', addressKey(), Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(body, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}

export const hashValue = (value) => createHash('sha256').update(String(value)).digest('hex');
const normaliseAddress = (value) => String(value || '').trim().toLowerCase();

/* ------------------------------------------------------------ the search */

/**
 * Search the connector's network.
 *
 * Reuses a cached search for the same normalised query inside the TTL, which
 * is what makes a member-facing search box affordable: the second person to
 * ask about GRAS consultants this month spends nothing.
 *
 * Fails closed. Happenstance unreachable is an error, never an empty list — a
 * steward or a member would read an empty list as "nobody in the network can
 * help", which may be false.
 */
export async function runSearch({ query, actorId, actorKind = 'member', force = false }) {
  const text = String(query || '').trim();
  if (text.length < 8) return { ok: false, error: 'Say a bit more about who you are looking for.' };
  if (!hs.configured()) return { ok: false, error: 'Network search is not configured yet.' };

  const now = nowSeconds();
  const hash = hs.queryHash(text, 'network');
  const cached = await sql.get('SELECT * FROM hr_hs_searches WHERE query_hash = ?', hash);

  if (cached && !force && cached.expires_at > now && cached.state !== 'failed') {
    return { ok: true, search: cached, cached: true };
  }

  const budget = await creditsThisMonth(now);
  if (budget.spent + hs.SEARCH_CREDITS > budget.budget) {
    return { ok: false, error: `The network search budget for this month is spent (${budget.spent} of ${budget.budget} credits).` };
  }

  const balance = await hs.credits();
  if (balance.ok && balance.balance < hs.SEARCH_CREDITS) {
    return { ok: false, error: 'The Happenstance account is out of credits. A steward needs to top it up.' };
  }

  const started = await hs.search({ query: text });
  if (!started.ok) return { ok: false, error: started.error };

  // One row per normalised query, replaced when it expires or is forced, so the
  // cache cannot grow a second row for the same question.
  if (cached) {
    await sql.run(`UPDATE hr_hs_searches SET query = ?, search_id = ?, state = 'running', credits = ?,
         result_count = 0, error = '', requested_by = ?, created_at = ?, completed_at = NULL, expires_at = ?
         WHERE id = ?`, text, started.searchId, hs.SEARCH_CREDITS, actorId, now,
    now + searchTtlDays() * DAY, cached.id);
    await sql.run('DELETE FROM hr_hs_people WHERE search_id = ?', cached.id);
  } else {
    await sql.run(`INSERT INTO hr_hs_searches (query_hash, query, scope, search_id, state, credits,
         requested_by, created_at, expires_at)
       VALUES (?, ?, 'network', ?, 'running', ?, ?, ?, ?)`, hash, text, started.searchId,
    hs.SEARCH_CREDITS, actorId, now, now + searchTtlDays() * DAY);
  }

  const row = await sql.get('SELECT * FROM hr_hs_searches WHERE query_hash = ?', hash);
  await logEvent({ searchId: row.id, actorId, actorKind, event: 'search-started', detail: text });
  return { ok: true, search: row, cached: false };
}

/**
 * Poll a running search and store what came back.
 *
 * Suppressed people are dropped here, before the rows exist, rather than
 * filtered at render time: a filter that lives at a call site is what fails
 * silently the next time somebody adds an endpoint.
 */
export async function collect(searchRowId) {
  const row = await sql.get('SELECT * FROM hr_hs_searches WHERE id = ?', Number(searchRowId));
  if (!row) return { ok: false, error: 'No such search.' };
  if (row.state === 'complete') return { ok: true, search: row, people: await peopleFor(row.id) };

  const polled = await hs.results(row.search_id);
  if (!polled.ok) {
    await sql.run("UPDATE hr_hs_searches SET state = 'failed', error = ? WHERE id = ?",
      String(polled.error).slice(0, 300), row.id);
    return { ok: false, error: polled.error };
  }
  if (polled.running) return { ok: true, running: true, search: row, people: [] };

  const now = nowSeconds();
  const suppressed = await suppressedSet(polled.people.map((p) => p.personHash));
  const keep = polled.people.filter((p) => !suppressed.has(p.personHash));

  await sql.tx(async (db) => {
    await db.run('DELETE FROM hr_hs_people WHERE search_id = ?', row.id);
    for (const person of keep) {
      await db.run(`INSERT INTO hr_hs_people (search_id, person_hash, name, title, org, summary,
           evidence, score, through, profile_url, position, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, row.id, person.personHash, person.name,
      person.title, person.org, person.summary, JSON.stringify(person.evidence), person.score,
      person.through.join(', '), person.profileUrl, person.position, now);
    }
    await db.run(`UPDATE hr_hs_searches SET state = 'complete', result_count = ?, completed_at = ?
       WHERE id = ?`, keep.length, now, row.id);
  });

  await logEvent({ searchId: row.id, actorKind: 'system', event: 'search-complete',
    detail: `${keep.length} shown, ${polled.people.length - keep.length} suppressed` });
  return { ok: true, search: await sql.get('SELECT * FROM hr_hs_searches WHERE id = ?', row.id),
    people: await peopleFor(row.id) };
}

export async function getSearch(id) {
  return await sql.get('SELECT * FROM hr_hs_searches WHERE id = ?', Number(id)) ?? null;
}

export async function peopleFor(searchRowId) {
  const rows = await sql.all('SELECT * FROM hr_hs_people WHERE search_id = ? ORDER BY position ASC', Number(searchRowId));
  return rows.map((row) => ({
    ...row,
    evidence: parseList(row.evidence),
    through: String(row.through || '').split(',').map((s) => s.trim()).filter(Boolean),
  }));
}

export async function getPerson(id) {
  const row = await sql.get('SELECT * FROM hr_hs_people WHERE id = ?', Number(id));
  if (!row) return null;
  return {
    ...row,
    evidence: parseList(row.evidence),
    through: String(row.through || '').split(',').map((s) => s.trim()).filter(Boolean),
  };
}

function parseList(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export async function recentSearches({ limit = 20 } = {}) {
  return await sql.all('SELECT * FROM hr_hs_searches ORDER BY created_at DESC LIMIT ?', limit);
}

/** Credits spent this calendar month, against the budget. */
export async function creditsThisMonth(now = nowSeconds()) {
  const { start, end } = monthWindow(now);
  const row = await sql.get(`SELECT COALESCE(SUM(credits), 0) AS spent FROM hr_hs_searches
       WHERE created_at >= ? AND created_at < ?`, start, end);
  return { spent: Number(row?.spent || 0), budget: creditBudget(), resetsAt: end };
}

export function monthWindow(now = nowSeconds()) {
  const date = new Date(now * 1000);
  return {
    start: Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1) / 1000,
    end: Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1) / 1000,
  };
}

/* ------------------------------------------------------------ gatekeeping */

async function suppressedSet(hashes) {
  if (!hashes.length) return new Set();
  const placeholders = hashes.map(() => '?').join(',');
  const rows = await sql.all(`SELECT person_hash FROM hr_intro_suppression WHERE person_hash IN (${placeholders})`, hashes);
  return new Set(rows.map((r) => r.person_hash));
}

export async function isSuppressed(personHash) {
  return !!await sql.get('SELECT person_hash FROM hr_intro_suppression WHERE person_hash = ?', personHash);
}

export async function suppress(personHash, reason = 'opted-out') {
  await sql.run(`INSERT INTO hr_intro_suppression (person_hash, reason, created_at) VALUES (?, ?, ?)
     ON CONFLICT(person_hash) DO UPDATE SET reason = excluded.reason`, personHash, reason, nowSeconds());
  // They are out of every future list, and out of the ones already cached.
  await sql.run('DELETE FROM hr_hs_people WHERE person_hash = ?', personHash);
}

async function setCooldown(personHash, memberId, days) {
  if (!days) return;
  const until = nowSeconds() + days * DAY;
  await sql.run(`INSERT INTO hr_intro_cooldowns (person_hash, member_id, until, created_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(person_hash, member_id) DO UPDATE SET until = excluded.until`,
  personHash, memberId || '', until, nowSeconds());
}

export async function cooldownFor(personHash, memberId, now = nowSeconds()) {
  const row = await sql.get(`SELECT MAX(until) AS until FROM hr_intro_cooldowns
       WHERE person_hash = ? AND (member_id = ? OR member_id = '') AND until > ?`,
  personHash, memberId, now);
  return row?.until ? Number(row.until) : 0;
}

/** A member's own load: open requests, and this month's total. */
export async function memberLoad(memberId, now = nowSeconds()) {
  const { start, end } = monthWindow(now);
  const open = await sql.get(`SELECT COUNT(*) AS n FROM hr_intro_requests
       WHERE member_id = ? AND member_closed = 0
         AND status IN ('requested','permission_sent','agreed')`, memberId);
  const monthly = await sql.get(`SELECT COUNT(*) AS n FROM hr_intro_requests
       WHERE member_id = ? AND created_at >= ? AND created_at < ?`, memberId, start, end);
  return { open: Number(open.n), monthly: Number(monthly.n) };
}

/** Permission messages sent house-wide in the last seven days. */
export async function weekLoad(now = nowSeconds()) {
  const row = await sql.get('SELECT COUNT(*) AS n FROM hr_intro_requests WHERE sent_at IS NOT NULL AND sent_at > ?',
    now - 7 * DAY);
  return { sent: Number(row.n), cap: weeklyCap() };
}

/**
 * Can this member ask to be introduced to this person right now?
 *
 * Every refusal is a sentence a member can act on. A flat "no" is how somebody
 * concludes the feature is broken and stops using it.
 */
export async function canRequest({ personHash, memberId, now = nowSeconds() }) {
  if (await isSuppressed(personHash)) {
    return { ok: false, reason: 'suppressed', message: 'That person has asked not to be contacted through us.' };
  }

  const existing = await sql.get(`SELECT * FROM hr_intro_requests
       WHERE member_id = ? AND person_hash = ?
         AND status IN ('requested','permission_sent','agreed','introduced')
       ORDER BY created_at DESC LIMIT 1`, memberId, personHash);
  if (existing) {
    return {
      ok: false, reason: 'already-open', requestId: existing.id,
      message: existing.status === 'introduced'
        ? 'You have already been introduced to them.'
        : 'You have already asked for this introduction.',
    };
  }

  const until = await cooldownFor(personHash, memberId, now);
  if (until) {
    return { ok: false, reason: 'cooldown', until,
      message: 'They were asked recently. We leave a gap before asking again.' };
  }

  const mine = await memberLoad(memberId, now);
  if (mine.open >= maxOpen()) {
    return { ok: false, reason: 'member-open',
      message: `You have ${mine.open} introductions in flight. Close one out before asking for another.` };
  }
  if (mine.monthly >= maxMonthly()) {
    return { ok: false, reason: 'member-monthly',
      message: 'You have used this month’s introduction requests. They reset on the 1st.' };
  }

  return { ok: true };
}

/* ------------------------------------------------------------- the request */

/**
 * The member's click. Writes a row and nothing else.
 *
 * The person's details are copied onto the request rather than referenced,
 * because the search rows are purged after 30 days and a request has to stay
 * answerable long after the search that found them is gone.
 */
export async function createRequest({ person, memberId, need, whyThem = '', askingFor = '' }) {
  const now = nowSeconds();
  const verdict = await canRequest({ personHash: person.person_hash, memberId, now });
  if (!verdict.ok) return { ok: false, ...verdict };

  const info = await sql.run(`INSERT INTO hr_intro_requests
       (member_id, person_hash, search_id, name, title, org, summary, evidence, through, profile_url,
        need, why_them, asking_for, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'requested', ?, ?)`,
  memberId, person.person_hash, person.search_id || null, person.name, person.title || '',
  person.org || '', person.summary || '', JSON.stringify(person.evidence || []),
  (person.through || []).join(', '), person.profile_url || '',
  need, whyThem, askingFor, now, now);

  await logEvent({ requestId: info.id, actorId: memberId, actorKind: 'member', event: 'requested',
    detail: person.name });
  return { ok: true, id: info.id };
}

export async function getRequest(id) {
  const row = await sql.get('SELECT * FROM hr_intro_requests WHERE id = ?', Number(id));
  return row ? hydrate(row) : null;
}

function hydrate(row) {
  return {
    ...row,
    evidence: parseList(row.evidence),
    through: String(row.through || '').split(',').map((s) => s.trim()).filter(Boolean),
  };
}

/* ------------------------------------------------------------- gate 2 and 4 */

/**
 * Gate 4, and the only function in this app that puts a message in front of a
 * stranger.
 *
 * Every precondition is checked here rather than by the caller, because there
 * are two callers (a steward's click and, later, anything else) and a
 * precondition enforced at one call site is a precondition that will be missed
 * at the next one.
 */
export async function sendPermission({ requestId, actor, address, now = nowSeconds() }) {
  if (!actor?.is_admin) return { ok: false, reason: 'not-steward', message: 'Only a steward can send a permission ask.' };

  const to = normaliseAddress(address);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    return { ok: false, reason: 'bad-address', message: 'That does not look like an email address.' };
  }

  const request = await getRequest(requestId);
  if (!request) return { ok: false, reason: 'unknown', message: 'No such request.' };
  if (request.status !== 'requested') {
    return { ok: false, reason: 'wrong-state', message: `That request is already ${request.status.replace('_', ' ')}.` };
  }

  // Consent fails closed, permanently. There is no circumstance in which "we
  // could not check whether this person asked never to be contacted" resolves
  // to contacting them.
  let suppressed;
  try {
    suppressed = await isSuppressed(request.person_hash);
  } catch {
    return { ok: false, reason: 'check-failed', message: 'Could not check the do-not-ask list. Nothing was sent.' };
  }
  if (suppressed) {
    return { ok: false, reason: 'suppressed', message: 'They have asked not to be contacted through us.' };
  }

  const until = await cooldownFor(request.person_hash, request.member_id, now);
  if (until) return { ok: false, reason: 'cooldown', until, message: 'They were asked recently. Leave the gap.' };

  const week = await weekLoad(now);
  if (week.sent >= week.cap) {
    return { ok: false, reason: 'weekly-cap',
      message: `${week.sent} permission asks have gone out this week, which is the cap. This one waits.` };
  }

  const token = randomBytes(32).toString('hex');
  const updated = await sql.run(`UPDATE hr_intro_requests
       SET status = 'permission_sent', token_hash = ?, token_expires = ?, to_enc = ?, to_hash = ?,
           sent_how = 'mail', sent_by = ?, sent_at = ?, updated_at = ?
       WHERE id = ? AND status = 'requested'`,
  hashValue(token), now + windowDays() * DAY, encryptAddress(to), hashValue(to),
  actor.id, now, now, request.id);
  // Two stewards clicking at once: the status predicate makes the second a
  // no-op rather than a second email.
  if (!updated.changes) return { ok: false, reason: 'raced', message: 'Someone else just sent that one.' };

  await logEvent({ requestId: request.id, actorId: actor.id, actorKind: 'steward',
    event: 'permission-sent', detail: `to ${hashValue(to).slice(0, 12)}` });
  return { ok: true, token, request: await getRequest(request.id), to };
}

/** Gate 2 in the other direction: a steward declines to forward the ask at all. */
export async function refuse({ requestId, actor, note = '' }) {
  if (!actor?.is_admin) return { ok: false, message: 'Only a steward can do that.' };
  const request = await getRequest(requestId);
  if (!request || request.status !== 'requested') return { ok: false, message: 'Not in a state to refuse.' };
  const now = nowSeconds();
  await sql.run(`UPDATE hr_intro_requests SET status = 'refused', steward_note = ?, closed_at = ?, updated_at = ?
     WHERE id = ?`, String(note).slice(0, 500), now, now, request.id);
  await logEvent({ requestId: request.id, actorId: actor.id, actorKind: 'steward', event: 'refused', detail: note });
  return { ok: true };
}

/* ----------------------------------------------------- the target's answer */

/** Look a token up without spending it. */
export async function findByToken(token) {
  if (!token) return null;
  const row = await sql.get('SELECT * FROM hr_intro_requests WHERE token_hash = ?', hashValue(token));
  return row ? hydrate(row) : null;
}

/**
 * Gate 3. The target answers, from an email, with no account.
 *
 * Three answers, and the third is the important one: "never" writes a
 * suppression row that no member and no steward can undo from a UI, and takes
 * effect before anyone sees a list again.
 *
 * A late yes is honoured rather than refused. Someone who says yes on day 11
 * has done the right thing slowly, and turning that into an error page is how
 * you lose a contact for good.
 */
export async function answer({ token, decision, note = '' }) {
  const now = nowSeconds();
  const hash = hashValue(token);

  const result = await sql.tx(async (db) => {
    const row = await db.get('SELECT * FROM hr_intro_requests WHERE token_hash = ?', hash);
    if (!row) return { ok: false, reason: 'unknown' };
    // A double-click on an email button is not a mistake worth punishing: show
    // them what they already said.
    if (row.status !== 'permission_sent') {
      return { ok: false, reason: 'already', answered: row.status, request: row };
    }

    const late = !!row.token_expires && row.token_expires < now;
    const status = decision === 'yes' ? 'agreed' : 'declined';

    await db.run(`UPDATE hr_intro_requests SET status = ?, answered_at = ?, answer_note = ?,
         token_hash = '', updated_at = ? WHERE id = ?`,
    status, now, String(note || '').slice(0, 500), now, row.id);

    // The address is kept only while it is still needed. A yes needs it for the
    // introduction; a no and a never do not.
    if (status !== 'agreed') {
      await db.run("UPDATE hr_intro_requests SET to_enc = '', closed_at = ? WHERE id = ?", now, row.id);
    }
    return { ok: true, decision, request: row, late };
  });

  if (!result.ok) return result;

  if (decision === 'never') {
    await suppress(result.request.person_hash, 'opted-out');
  }
  if (decision !== 'yes') {
    await setCooldown(result.request.person_hash, result.request.member_id, cooldownDays());
    await setCooldown(result.request.person_hash, '', globalCooldownDays());
  }

  await logEvent({ requestId: result.request.id, actorKind: 'target',
    event: decision === 'yes' ? 'agreed' : decision === 'never' ? 'opted-out' : 'declined',
    detail: result.late ? 'answered after the window closed' : '' });

  return { ...result, request: await getRequest(result.request.id) };
}

/* ------------------------------------------------------- the introduction */

/**
 * Send the introduction. The most consequential call in this app: it puts two
 * real people in a thread on the connector's name.
 *
 * Reachable only from `agreed`. There is no override, not even for a steward.
 * A steward who wants to introduce someone who never answered can send their
 * own email from their own client; this will not do it and will not pretend it
 * did.
 */
export async function introduce({ requestId, actor, now = nowSeconds() }) {
  if (!actor?.is_admin) return { ok: false, reason: 'not-steward', message: 'Only a steward can send an introduction.' };

  const request = await getRequest(requestId);
  if (!request) return { ok: false, reason: 'unknown', message: 'No such request.' };
  if (request.status !== 'agreed') {
    return { ok: false, reason: 'not-agreed',
      message: 'An introduction can only follow a yes. Nothing else unlocks this.' };
  }
  if (await isSuppressed(request.person_hash)) {
    return { ok: false, reason: 'suppressed', message: 'They have since asked not to be contacted.' };
  }

  const to = decryptAddress(request.to_enc);
  if (!to) return { ok: false, reason: 'no-address', message: 'The stored address could not be read. Send it by hand.' };

  const updated = await sql.run(`UPDATE hr_intro_requests
       SET status = 'introduced', introduced_at = ?, updated_at = ?, to_enc = ''
       WHERE id = ? AND status = 'agreed'`, now, now, request.id);
  if (!updated.changes) return { ok: false, reason: 'raced', message: 'Someone else just sent that one.' };

  await logEvent({ requestId: request.id, actorId: actor.id, actorKind: 'steward', event: 'introduced' });
  return { ok: true, to, request: await getRequest(request.id) };
}

/**
 * The member pulls out. Cannot recall a permission ask already sent.
 *
 * `member_closed` is always set and `status` only when the request was
 * genuinely still live. A member may press withdraw on something that quietly
 * closed days ago — they cannot tell the difference, by design — and the
 * button has to do the same visible thing either way, without rewriting what
 * the audit trail says actually happened.
 */
export async function withdraw({ requestId, memberId }) {
  const now = nowSeconds();
  const request = await getRequest(requestId);
  if (!request || request.member_id !== memberId) return { ok: false, message: 'Not yours to withdraw.' };
  if (request.status === 'introduced') return { ok: false, message: 'That introduction has already gone out.' };

  const live = ['requested', 'permission_sent', 'agreed'].includes(request.status);
  await sql.run(`UPDATE hr_intro_requests
       SET member_closed = 1, status = ?, closed_at = COALESCE(closed_at, ?), updated_at = ?,
           to_enc = '', token_hash = ''
       WHERE id = ?`, live ? 'withdrawn' : request.status, now, now, request.id);
  await logEvent({ requestId: request.id, actorId: memberId, actorKind: 'member',
    event: 'withdrawn', detail: live ? '' : `after it closed as ${request.status}` });
  return { ok: true, request: await getRequest(request.id) };
}

/**
 * Age out permission asks nobody answered.
 *
 * Lazy rather than scheduled, exactly as the mentor desk does it and for the
 * same reason: a cold container has no cron of its own, so anything that only
 * runs on a timer does not run. Silence is a no, and it buys the same cooldown
 * a spoken no does.
 */
export async function expireStale(now = nowSeconds()) {
  const stale = await sql.all(`SELECT * FROM hr_intro_requests
       WHERE status = 'permission_sent' AND token_expires IS NOT NULL AND token_expires < ?`, now);
  for (const row of stale) {
    await sql.run(`UPDATE hr_intro_requests SET status = 'no_reply', closed_at = ?, updated_at = ?,
         to_enc = '', token_hash = '' WHERE id = ?`, now, now, row.id);
    await setCooldown(row.person_hash, row.member_id, cooldownDays());
    await setCooldown(row.person_hash, '', globalCooldownDays());
    await logEvent({ requestId: row.id, actorKind: 'system', event: 'no-reply' });
  }
  return stale.length;
}

/* -------------------------------------------------------------- reading */

/**
 * What a member is allowed to know about their own request.
 *
 * THE PRIVACY BOUNDARY, and the one place this engine departs from its own
 * design document — deliberately, because the member picks the person here and
 * the document's member never learns who was approached.
 *
 * Once a member has named a target, ANY status that moves is a disclosure. The
 * obvious vocabulary — "with a steward", then "asked, waiting", then "still
 * open" — hands them a decline by timing alone: the label changes on the day
 * that specific person said no. Some fraction of targets will sense that and
 * say yes to avoid the awkwardness, and an extracted yes is worse than no
 * introduction at all.
 *
 * So there are exactly three things a member is ever told:
 *
 *   still open   from the moment they ask until an introduction happens. It
 *                covers waiting on a steward, waiting on the target, a no, a
 *                silence, and a steward who decided not to forward it.
 *   introduced   a yes, and the mail has gone.
 *   withdrawn    the member pulled out.
 *
 * "Still open" is honest about the ask rather than vague about the person: the
 * ask IS still open, and a steward may find somebody else for it. What it
 * deliberately refuses to be is a progress bar that the member can watch a
 * decline land on. The ask form and the list both say this in plain words,
 * because a mechanism that works by managing what somebody knows should not
 * also be a surprise.
 *
 * This is a separate function rather than the steward view with fields hidden,
 * because hiding fields in a shared template is how a field comes back six
 * months later in an endpoint nobody re-checked.
 */
export function memberView(request) {
  const stage = ['agreed', 'introduced'].includes(request.status) ? 'introduced'
    : (request.member_closed || request.status === 'withdrawn') ? 'withdrawn'
      : 'still open';
  return {
    id: request.id,
    name: request.name,
    title: request.title,
    org: request.org,
    need: request.need,
    asking_for: request.asking_for,
    created_at: request.created_at,
    stage,
    open: !['withdrawn'].includes(request.status) && stage !== 'introduced',
    introduced: stage === 'introduced',
    // Offered on every open-looking row, including the ones that have quietly
    // closed. A button that disappears the day a target declines is a decline
    // told in pixels rather than in words.
    canWithdraw: stage === 'still open',
  };
}

export async function requestsFor(memberId, { limit = 50, now = nowSeconds() } = {}) {
  await expireStale(now);
  const rows = await sql.all('SELECT * FROM hr_intro_requests WHERE member_id = ? ORDER BY created_at DESC LIMIT ?',
    memberId, limit);
  return rows.map((row) => memberView(hydrate(row)));
}

/** The steward's queue. Full rows: a connector who cannot see a no cannot do the job. */
export async function queue({ now = nowSeconds() } = {}) {
  await expireStale(now);
  const rows = await sql.all(`SELECT * FROM hr_intro_requests
       WHERE status IN ('requested','permission_sent','agreed') ORDER BY created_at ASC LIMIT 100`);
  return rows.map(hydrate);
}

export async function recentlyClosed({ limit = 20 } = {}) {
  const rows = await sql.all(`SELECT * FROM hr_intro_requests
       WHERE status IN ('introduced','declined','no_reply','refused','withdrawn')
       ORDER BY updated_at DESC LIMIT ?`, limit);
  return rows.map(hydrate);
}

export async function logOutcome({ requestId, memberId, met, useful = null, note = '' }) {
  const request = await getRequest(requestId);
  if (!request || request.member_id !== memberId) return { ok: false };
  await sql.run(`INSERT INTO hr_intro_outcomes (request_id, met, useful, note, logged_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(request_id) DO UPDATE SET met = excluded.met, useful = excluded.useful,
       note = excluded.note, logged_at = excluded.logged_at`,
  Number(requestId), met ? 1 : 0, useful, String(note || '').slice(0, 500), nowSeconds());
  await logEvent({ requestId: Number(requestId), actorId: memberId, actorKind: 'member', event: 'outcome-logged' });
  return { ok: true };
}

export async function outcomeFor(requestId) {
  return await sql.get('SELECT * FROM hr_intro_outcomes WHERE request_id = ?', Number(requestId)) ?? null;
}

/**
 * The numbers for /homeroom/health and the steward page.
 *
 * Intro volume is deliberately not one of them. The yes rate and the
 * never-ask-again count are the health of the network; how many intros went
 * out is how you talk yourself into sending more.
 */
export async function stats(now = nowSeconds()) {
  const one = async (q, ...params) => Number(Object.values(await sql.get(q, ...params))[0] || 0);
  const asked = await one("SELECT COUNT(*) FROM hr_intro_requests WHERE sent_at IS NOT NULL");
  const agreed = await one("SELECT COUNT(*) FROM hr_intro_requests WHERE status IN ('agreed','introduced')");
  return {
    enabled: enabled(),
    configured: hs.configured(),
    waitingOnSteward: await one("SELECT COUNT(*) FROM hr_intro_requests WHERE status = 'requested'"),
    waitingOnTarget: await one("SELECT COUNT(*) FROM hr_intro_requests WHERE status = 'permission_sent'"),
    // The alarm: somebody said yes and the introduction never went out.
    stuckAfterYes: await one("SELECT COUNT(*) FROM hr_intro_requests WHERE status = 'agreed'"),
    introduced: await one("SELECT COUNT(*) FROM hr_intro_requests WHERE status = 'introduced'"),
    yesRate: asked ? Math.round((agreed / asked) * 100) : null,
    neverAskAgain: await one('SELECT COUNT(*) FROM hr_intro_suppression'),
    thisWeek: (await weekLoad(now)).sent,
    weeklyCap: weeklyCap(),
    credits: await creditsThisMonth(now),
  };
}

/**
 * Purge what nobody needs any more.
 *
 * Search results are people who never asked to be in this database, so an
 * expired search takes its rows with it. Requests are the accountability
 * record and are kept.
 */
export async function purge(now = nowSeconds()) {
  const info = await sql.run('DELETE FROM hr_hs_searches WHERE expires_at < ?', now);
  await sql.run('DELETE FROM hr_intro_cooldowns WHERE until < ?', now - 30 * DAY);
  return Number(info.changes || 0);
}
