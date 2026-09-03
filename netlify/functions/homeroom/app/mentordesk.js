/**
 * The mentor desk — gating the booking link behind a per-request accept.
 *
 * ── WHAT CHANGED, AND WHY ────────────────────────────────────────────────
 *
 * Until now `searchMentors()` selected `m.*`, so every mentor's `scheduler`
 * went out with every mentor row — rendered as a button on the profile and
 * returned in bulk from /homeroom/api/mentors. Every signed-in member could
 * read, and download, every mentor's calendar link.
 *
 * That is defensible for a dozen people a steward personally recruited. It
 * stops being defensible the moment mentors onboard themselves through a form,
 * because the population changes from "twelve people we asked" to "whoever
 * filled it in".
 *
 * ── WHY THIS IS NOT THE INTRO ENGINE ─────────────────────────────────────
 *
 * The sibling design in docs/INTRO-ENGINE.md spends a lot of machinery making
 * a decline invisible, because there the target never agreed to anything and a
 * legible decline is a coerced yes.
 *
 * None of that applies here. A mentor filled in a form saying they want to
 * help — that is already an opt-in — and a member who picked them off a public
 * list obviously knows who they asked. Hiding the decline would be theatre.
 *
 * What a mentor actually needs protecting from is the eleventh request this
 * month, from someone who did not read their profile, about a topic they do
 * not cover. They churn from volume, not from visibility. So the mechanism
 * here is CAPACITY, and the ordering of it is the whole point:
 *
 *   capacity is checked BEFORE a request can be written, not when the mentor
 *   answers, so a mentor at their limit never has to decline at all.
 *
 * A decline costs a decision, a small guilt and thirty seconds. Ten a month is
 * how a willing mentor becomes an unresponsive one. The cheapest decline is
 * the one the system makes on their behalf, from a number they chose.
 *
 * ── MENTORS HAVE NO ACCOUNTS ─────────────────────────────────────────────
 *
 * roster.js admits Accepted / Resident / Alumni. A mentor is none of those and
 * would correctly hit "Residents only". So every mentor action here is a
 * tokenised link in an email, hashed at rest exactly like a password reset —
 * which is also why there is no mentor dashboard and should not be one.
 *
 * See docs/MENTOR-ENGINE.md for the full design.
 */

import { randomBytes, createHash } from 'node:crypto';
import { getDb, transaction } from './db.js';
import { nowSeconds } from './util.js';

/* ----------------------------------------------------------------- config */

const num = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

/**
 * The transition switch.
 *
 * `0` restores the old behaviour — the scheduler link straight on the page for
 * every member — so the gate can be turned off in one variable if it turns out
 * to be wrong, without a deploy that reverts code.
 */
export const gateEnabled = () => process.env.HOMEROOM_MENTOR_GATE !== '0';

export const defaultCapacity = () => num(process.env.HOMEROOM_MENTOR_CAPACITY_DEFAULT, 2);
export const maxOpen = () => num(process.env.HOMEROOM_MENTOR_MAX_OPEN, 3);
export const maxMonthly = () => num(process.env.HOMEROOM_MENTOR_MAX_MONTHLY, 6);
export const reaskDays = () => num(process.env.HOMEROOM_MENTOR_REASK_DAYS, 90);
export const requestDays = () => num(process.env.HOMEROOM_MENTOR_REQUEST_DAYS, 10);
export const grantDays = () => num(process.env.HOMEROOM_MENTOR_GRANT_DAYS, 14);

const DAY = 86400;

/* ------------------------------------------------------------------ audit */

export function logEvent({ mentorId = null, requestId = null, actorId = null,
  actorKind = 'system', event, detail = '' }) {
  getDb()
    .prepare(
      `INSERT INTO hr_mentor_events (mentor_id, request_id, actor_id, actor_kind, event, detail, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(mentorId, requestId, actorId, actorKind, event, detail, nowSeconds());
}

export function eventsFor(requestId, { limit = 50 } = {}) {
  return getDb()
    .prepare('SELECT * FROM hr_mentor_events WHERE request_id = ? ORDER BY created_at ASC LIMIT ?')
    .all(Number(requestId), limit);
}

/* --------------------------------------------------------------- capacity */

/**
 * The calendar month, in UTC.
 *
 * UTC rather than a local zone because the alternative is a mentor's cap
 * resetting at a different moment than the page says it does, depending on who
 * is looking. One arbitrary boundary that everyone shares beats a correct one
 * that nobody can predict.
 */
export function monthWindow(now = nowSeconds()) {
  const date = new Date(now * 1000);
  const start = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1) / 1000;
  const end = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1) / 1000;
  return { start, end };
}

/**
 * How much of this mentor's month is spent.
 *
 * Counts accepted requests only. A declined request must never make a mentor
 * look busier — that would mean saying no once quietly reduced how often they
 * were asked again, which inverts the incentive we want.
 */
export function capacityFor(mentor, now = nowSeconds()) {
  const { start, end } = monthWindow(now);
  const cap = mentor.capacity > 0 ? mentor.capacity : defaultCapacity();
  const { used } = getDb()
    .prepare(
      `SELECT COUNT(*) AS used FROM hr_mentor_requests
       WHERE mentor_id = ? AND state = 'accepted' AND answered_at >= ? AND answered_at < ?`,
    )
    .get(mentor.id, start, end);
  return { used, cap, full: used >= cap, resetsAt: end };
}

/* -------------------------------------------------------------- gatekeeping */

/**
 * Can this member ask this mentor right now, and if not, why not?
 *
 * Every reason is a sentence a member can act on. "No" with no explanation is
 * how a member concludes the feature is broken and stops using it.
 */
export function canRequest({ mentor, memberId, now = nowSeconds() }) {
  if (!mentor) return { ok: false, reason: 'unknown', message: 'No such mentor.' };

  if (mentor.state === 'paused' || (mentor.paused_until && mentor.paused_until > now)) {
    return { ok: false, reason: 'paused', message: `${mentor.name} has paused new requests.` };
  }
  if (mentor.state !== 'listed' || !mentor.active) {
    return { ok: false, reason: 'unlisted', message: `${mentor.name} is not taking requests.` };
  }
  if (!schedulerFor(mentor.id)) {
    return {
      ok: false, reason: 'no-scheduler',
      message: `${mentor.name} has no booking link on file yet. A steward is chasing it.`,
    };
  }
  // No address means the request would be written, never delivered, and expire
  // ten days later looking like a mentor who ignored it. Refusing up front is
  // both honest and the thing that makes the onboarding form worth building:
  // the roster imported today has no addresses at all.
  if (!hasContact(mentor.id) && mentor.consent_mode === 'ask-me') {
    return {
      ok: false, reason: 'no-contact',
      message: `${mentor.name} has no contact address on file yet, so we cannot ask them.`,
    };
  }

  const open = openRequest(mentor.id, memberId);
  if (open) {
    return {
      ok: false, reason: 'already-open', requestId: open.id,
      message: open.state === 'accepted'
        ? 'You already have a live booking link for them.'
        : 'You have already asked them, and they have not answered yet.',
    };
  }

  const recentDecline = getDb()
    .prepare(
      `SELECT answered_at FROM hr_mentor_requests
       WHERE mentor_id = ? AND member_id = ? AND state = 'declined'
       ORDER BY answered_at DESC LIMIT 1`,
    )
    .get(mentor.id, memberId);
  if (recentDecline?.answered_at && recentDecline.answered_at + reaskDays() * DAY > now) {
    return {
      ok: false, reason: 'cooldown',
      message: 'They passed on a recent request. You can ask again in a while.',
    };
  }

  const capacity = capacityFor(mentor, now);
  if (capacity.full) {
    return {
      ok: false, reason: 'at-capacity', capacity,
      message: `${mentor.name} is fully booked this month.`,
    };
  }

  const mine = memberLoad(memberId, now);
  if (mine.open >= maxOpen()) {
    return {
      ok: false, reason: 'member-open',
      message: `You have ${mine.open} requests still waiting. Close one out before asking again.`,
    };
  }
  if (mine.monthly >= maxMonthly()) {
    return {
      ok: false, reason: 'member-monthly',
      message: 'You have used this month’s mentor requests. They reset on the 1st.',
    };
  }

  return { ok: true, capacity };
}

/** A member's own load: what is outstanding, and what they have spent. */
export function memberLoad(memberId, now = nowSeconds()) {
  const { start, end } = monthWindow(now);
  const db = getDb();
  const { open } = db
    .prepare("SELECT COUNT(*) AS open FROM hr_mentor_requests WHERE member_id = ? AND state = 'sent'")
    .get(memberId);
  const { monthly } = db
    .prepare(
      `SELECT COUNT(*) AS monthly FROM hr_mentor_requests
       WHERE member_id = ? AND created_at >= ? AND created_at < ?`,
    )
    .get(memberId, start, end);
  return { open, monthly };
}

/** A live request between these two: still waiting, or accepted with time left. */
export function openRequest(mentorId, memberId, now = nowSeconds()) {
  return getDb()
    .prepare(
      `SELECT r.* FROM hr_mentor_requests r
       WHERE r.mentor_id = ? AND r.member_id = ?
         AND (r.state = 'sent'
              OR (r.state = 'accepted'
                  AND EXISTS (SELECT 1 FROM hr_mentor_grants g
                              WHERE g.request_id = r.id AND g.revoked = 0 AND g.expires_at > ?)))
       ORDER BY r.created_at DESC LIMIT 1`,
    )
    .get(mentorId, memberId, now) ?? null;
}

/* ------------------------------------------------------------- the secret */

/**
 * The booking link, read on its own.
 *
 * This is the ONLY place `scheduler` is selected. `searchMentors()` and
 * `getMentor()` deliberately do not return the column, so a new endpoint
 * cannot leak it by accident — which is exactly how it leaked before, through
 * a `SELECT m.*` that nobody re-read when /homeroom/api/mentors was added.
 */
export function schedulerFor(mentorId) {
  const row = getDb().prepare('SELECT scheduler FROM hr_mentors WHERE id = ?').get(Number(mentorId));
  return row?.scheduler || '';
}

/**
 * The mentor's address, read the same deliberate way and for the same reason.
 *
 * A mentor's personal contact address has no business travelling inside a row
 * that ends up in a template or a JSON response — that is the exact mistake
 * `scheduler` made. It is not in MENTOR_FIELDS, so asking for it is a decision.
 */
export function contactFor(mentorId) {
  const row = getDb().prepare('SELECT email FROM hr_mentors WHERE id = ?').get(Number(mentorId));
  return row?.email || '';
}

export function hasContact(mentorId) {
  return !!contactFor(mentorId);
}

/* -------------------------------------------------------------- requests */

const hashToken = (token) => createHash('sha256').update(String(token)).digest('hex');

/**
 * Write the request, and decide whether it needs asking at all.
 *
 * `consent_mode` is the mentor's own answer to "how do you want to be
 * approached", given on the onboarding form:
 *
 *   ask-me      every request goes to them first (the default, and the right
 *               assumption for anyone who did not express a preference)
 *   auto        vetted members get the link straight away; the mentor is told,
 *               not asked
 *   auto-track  auto for the tracks they named, ask for everything else
 *
 * `auto` is not weakened consent. It IS consent, given knowingly, by someone
 * who would rather see a calendar invite than an email asking whether they
 * would like one. Forcing the round trip on them wastes the exact thing this
 * system exists to protect.
 */
export function createRequest({ mentor, memberId, track = '', need, whyThem = '',
  tried = '', askingFor = '' }) {
  const now = nowSeconds();
  const token = randomBytes(32).toString('hex');

  return transaction((db) => {
    const auto = autoAccepts(mentor, track);
    const info = db
      .prepare(
        `INSERT INTO hr_mentor_requests
           (mentor_id, member_id, track, need, why_them, tried, asking_for,
            state, auto, token_hash, token_expires, created_at, answered_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(mentor.id, memberId, track, need, whyThem, tried, askingFor,
        auto ? 'accepted' : 'sent', auto ? 1 : 0,
        hashToken(token), now + requestDays() * DAY, now, auto ? now : null);
    const id = Number(info.lastInsertRowid);

    let grant = null;
    if (auto) grant = insertGrant(db, { requestId: id, mentorId: mentor.id, memberId, now });

    return { id, token, auto, grant };
  });
}

function autoAccepts(mentor, track) {
  if (mentor.consent_mode === 'auto') return true;
  if (mentor.consent_mode !== 'auto-track') return false;
  const tracks = String(mentor.tracks || '').split(',').map((t) => t.trim()).filter(Boolean);
  return !!track && tracks.includes(track);
}

function insertGrant(db, { requestId, mentorId, memberId, now }) {
  const id = randomBytes(18).toString('hex');
  db.prepare(
    `INSERT INTO hr_mentor_grants (id, request_id, mentor_id, member_id, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, requestId, mentorId, memberId, now + grantDays() * DAY, now);
  return { id, expiresAt: now + grantDays() * DAY };
}

export function getRequest(id) {
  return getDb().prepare('SELECT * FROM hr_mentor_requests WHERE id = ?').get(Number(id)) ?? null;
}

/** Look a mentor token up without spending it. */
export function findByToken(token) {
  if (!token) return null;
  const row = getDb()
    .prepare('SELECT * FROM hr_mentor_requests WHERE token_hash = ?')
    .get(hashToken(token));
  return row ?? null;
}

/**
 * The mentor's answer.
 *
 * Three outcomes, and one deliberate leniency: a mentor who answers after the
 * window has closed is HONOURED rather than refused. Someone who says yes on
 * day 11 has done the right thing slowly, and turning that into an error page
 * is the fastest way to lose a mentor. The member is told it was late.
 *
 * Capacity is re-checked here, inside the transaction, because two members can
 * race the last slot of the month between the requests being written and the
 * mentor working through their inbox. First accept wins.
 */
export function answerRequest({ token, decision, note = '', pauseDays = 0 }) {
  const now = nowSeconds();
  const hash = hashToken(token);

  return transaction((db) => {
    const request = db.prepare('SELECT * FROM hr_mentor_requests WHERE token_hash = ?').get(hash);
    if (!request) return { ok: false, reason: 'unknown' };

    // Already answered: show them what they said rather than an error. A
    // double-click on an email button is not a mistake worth punishing.
    if (request.state !== 'sent') {
      return { ok: false, reason: 'already', request, answered: request.state };
    }

    const mentor = db.prepare('SELECT * FROM hr_mentors WHERE id = ?').get(request.mentor_id);
    if (!mentor) return { ok: false, reason: 'unknown' };

    const late = !!request.token_expires && request.token_expires < now;

    if (decision === 'accept') {
      const { start, end } = monthWindow(now);
      const { used } = db
        .prepare(
          `SELECT COUNT(*) AS used FROM hr_mentor_requests
           WHERE mentor_id = ? AND state = 'accepted' AND answered_at >= ? AND answered_at < ?`,
        )
        .get(mentor.id, start, end);
      const cap = mentor.capacity > 0 ? mentor.capacity : defaultCapacity();
      if (used >= cap) return { ok: false, reason: 'at-capacity', request, mentor, used, cap };

      db.prepare("UPDATE hr_mentor_requests SET state = 'accepted', answered_at = ? WHERE id = ?")
        .run(now, request.id);
      const grant = insertGrant(db, {
        requestId: request.id, mentorId: mentor.id, memberId: request.member_id, now,
      });
      return { ok: true, decision: 'accept', request, mentor, grant, late };
    }

    const paused = decision === 'later' && pauseDays > 0;
    db.prepare(
      `UPDATE hr_mentor_requests
       SET state = 'declined', answered_at = ?, decline_note = ?, paused_mentor = ?
       WHERE id = ?`,
    ).run(now, String(note || '').slice(0, 500), paused ? 1 : 0, request.id);

    if (paused) {
      // "Not right now" pauses them as well as declining. The honest button for
      // a mentor who is buried, and the one that stops them having to keep
      // saying no. Outstanding grants survive — someone already told yes should
      // not lose their link because the mentor went quiet afterwards.
      db.prepare("UPDATE hr_mentors SET state = 'paused', paused_until = ? WHERE id = ?")
        .run(now + pauseDays * DAY, mentor.id);
    }

    return { ok: true, decision: paused ? 'later' : 'decline', request, mentor, late, paused };
  });
}

/** Withdrawn by the member. Kills the grant too, if one was issued. */
export function withdrawRequest(id, memberId) {
  const now = nowSeconds();
  return transaction((db) => {
    const request = db.prepare('SELECT * FROM hr_mentor_requests WHERE id = ?').get(Number(id));
    if (!request || request.member_id !== memberId) return null;
    if (!['sent', 'accepted'].includes(request.state)) return request;
    db.prepare("UPDATE hr_mentor_requests SET state = 'withdrawn', answered_at = ? WHERE id = ?")
      .run(now, request.id);
    db.prepare('UPDATE hr_mentor_grants SET revoked = 1 WHERE request_id = ?').run(request.id);
    return { ...request, state: 'withdrawn' };
  });
}

/**
 * Age out requests nobody answered.
 *
 * Lazy rather than a scheduled sweep: the database lives in /tmp and a cold
 * container has no cron of its own, so anything that only runs on a timer will
 * not run. Called on the pages that read requests, which is often enough for a
 * ten-day window.
 */
export function expireStale(now = nowSeconds()) {
  const info = getDb()
    .prepare(
      `UPDATE hr_mentor_requests SET state = 'expired', answered_at = ?
       WHERE state = 'sent' AND token_expires IS NOT NULL AND token_expires < ?`,
    )
    .run(now, now);
  return Number(info.changes || 0);
}

/* ---------------------------------------------------------------- grants */

export function getGrant(id) {
  return getDb().prepare('SELECT * FROM hr_mentor_grants WHERE id = ?').get(String(id)) ?? null;
}

export function liveGrantFor(requestId, now = nowSeconds()) {
  return getDb()
    .prepare(
      `SELECT * FROM hr_mentor_grants
       WHERE request_id = ? AND revoked = 0 AND expires_at > ?
       ORDER BY created_at DESC LIMIT 1`,
    )
    .get(Number(requestId), now) ?? null;
}

/**
 * Spend a grant: validate, count the click, hand back the destination.
 *
 * Expiry is checked HERE, at click time, not when the page was rendered. An
 * email from three weeks ago stops working even though its link still looks
 * fine, which is the property that makes the window mean anything.
 */
export function redeemGrant({ grantId, memberId, mentorId, now = nowSeconds() }) {
  const grant = getGrant(grantId);
  if (!grant) return { ok: false, reason: 'unknown' };
  if (grant.member_id !== memberId) return { ok: false, reason: 'not-yours' };
  if (mentorId && grant.mentor_id !== mentorId) return { ok: false, reason: 'not-yours' };
  if (grant.revoked) return { ok: false, reason: 'revoked' };
  if (grant.expires_at <= now) return { ok: false, reason: 'expired' };

  const url = schedulerFor(grant.mentor_id);
  if (!url) return { ok: false, reason: 'no-scheduler' };

  getDb()
    .prepare('UPDATE hr_mentor_grants SET clicks = clicks + 1, first_click = COALESCE(first_click, ?) WHERE id = ?')
    .run(now, grant.id);
  return { ok: true, url, grant };
}

export function revokeGrantsForMentor(mentorId) {
  const info = getDb()
    .prepare('UPDATE hr_mentor_grants SET revoked = 1 WHERE mentor_id = ? AND revoked = 0')
    .run(Number(mentorId));
  return Number(info.changes || 0);
}

/* --------------------------------------------------------------- reading */

/** A member's own requests, newest first, with the mentor and any live grant. */
export function requestsFor(memberId, { limit = 50, now = nowSeconds() } = {}) {
  expireStale(now);
  const rows = getDb()
    .prepare(
      `SELECT r.*, m.name AS mentor_name, m.slug AS mentor_slug, m.org AS mentor_org
       FROM hr_mentor_requests r
       JOIN hr_mentors m ON m.id = r.mentor_id
       WHERE r.member_id = ? ORDER BY r.created_at DESC LIMIT ?`,
    )
    .all(memberId, limit);
  return rows.map((row) => ({ ...row, grant: row.state === 'accepted' ? liveGrantFor(row.id, now) : null }));
}

export function outcomeFor(requestId) {
  return getDb().prepare('SELECT * FROM hr_mentor_outcomes WHERE request_id = ?')
    .get(Number(requestId)) ?? null;
}

export function logOutcome({ requestId, met, useful = null, note = '' }) {
  const now = nowSeconds();
  transaction((db) => {
    db.prepare(
      `INSERT INTO hr_mentor_outcomes (request_id, met, useful, note, logged_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(request_id) DO UPDATE SET met = excluded.met, useful = excluded.useful,
         note = excluded.note, logged_at = excluded.logged_at`,
    ).run(Number(requestId), met ? 1 : 0, useful, String(note || '').slice(0, 1000), now);
    if (met) {
      db.prepare(
        `UPDATE hr_mentors SET sessions = sessions + 1
         WHERE id = (SELECT mentor_id FROM hr_mentor_requests WHERE id = ?)`,
      ).run(Number(requestId));
    }
  });
}

/** For /homeroom/health: the numbers that say whether the desk is working. */
export function deskStats(now = nowSeconds()) {
  const db = getDb();
  const { start, end } = monthWindow(now);
  const one = (sql, ...params) => Object.values(db.prepare(sql).get(...params))[0];
  return {
    gate: gateEnabled(),
    listed: one("SELECT COUNT(*) FROM hr_mentors WHERE state = 'listed' AND active = 1"),
    paused: one("SELECT COUNT(*) FROM hr_mentors WHERE state = 'paused'"),
    waiting: one("SELECT COUNT(*) FROM hr_mentor_requests WHERE state = 'sent'"),
    pendingReview: one("SELECT COUNT(*) FROM hr_mentors WHERE state = 'pending'"),
    grantsThisMonth: one(
      'SELECT COUNT(*) FROM hr_mentor_grants WHERE created_at >= ? AND created_at < ?', start, end),
  };
}
