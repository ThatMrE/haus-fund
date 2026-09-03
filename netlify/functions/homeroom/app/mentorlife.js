/**
 * Keeping the mentor roster honest.
 *
 * Phase 1 gated the booking link; Phase 2 got mentors in. This is the part
 * that stops the roster quietly becoming a graveyard, which is how every
 * mentor directory dies:
 *
 *   A mentor says yes in March, changes jobs in June, and is still listed in
 *   the following March with a Calendly that 404s. Three founders waste a week
 *   on them, conclude the list is decoration, and stop using it. Nothing in the
 *   system ever noticed, because nothing was watching.
 *
 * This is `atlas.js`'s rule applied to people: **status is a first-class
 * column, and a directory that renders a live entry and a dead one identically
 * is worse than a shorter directory.**
 *
 * Three mechanisms, in increasing order of how long they take to notice:
 *
 *   1. AUTO-PAUSE. Three requests in a row nobody answered. That is a mentor
 *      who has moved on, is buried, or never sees the address they gave us.
 *      Continuing to send them requests spends members' asks on someone who
 *      will not answer, and — worse — makes the roster look functional.
 *   2. RE-CONFIRMATION. Every six months, one question and one click. Two
 *      nudges, then dormant.
 *   3. DORMANCY. Not deleted, not listed, restorable in one click. Deleting
 *      would lose the audit trail and make a returning mentor start over.
 *
 * All three are quiet. A mentor who has gone silent gets one note, not a
 * sequence, and the note leads with the button that brings them back.
 */

import { randomBytes, createHash } from 'node:crypto';
import { getDb, transaction } from './db.js';
import { nowSeconds } from './util.js';
import { logEvent } from './mentordesk.js';

const DAY = 86400;

const num = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

export const reconfirmDays = () => num(process.env.HOMEROOM_MENTOR_RECONFIRM_DAYS, 180);
export const nudgeDays = () => num(process.env.HOMEROOM_MENTOR_NUDGE_DAYS, 14);
export const silencePause = () => num(process.env.HOMEROOM_MENTOR_SILENCE_PAUSE, 3);
export const outcomeNagDays = () => num(process.env.HOMEROOM_MENTOR_OUTCOME_NAG_DAYS, 14);

/* ---------------------------------------------------------------- tokens */

const hashToken = (token) => createHash('sha256').update(String(token)).digest('hex');

/**
 * A link a mentor can act on without an account.
 *
 * Long-lived on purpose — 90 days — because the thing it is attached to is a
 * six-monthly email that people answer late, and an expired "still up for
 * this?" link is a mentor who tried to stay and could not.
 */
export async function mintToken(mentorId, { kind = 'standing', days = 90, now = undefined } = {}) {
  const token = randomBytes(32).toString('hex');
  const at = now ?? nowSeconds();
  (await (await getDb()).prepare(
    `INSERT INTO hr_mentor_tokens (token_hash, mentor_id, kind, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(hashToken(token), Number(mentorId), kind, at, at + days * DAY));
  return token;
}

export async function findToken(token, now = nowSeconds()) {
  if (!token) return null;
  const row = (await (await getDb()).prepare('SELECT * FROM hr_mentor_tokens WHERE token_hash = ?')
    .get(hashToken(token)));
  if (!row || row.expires_at <= now) return null;
  return row;
}

async function spend(tokenHash, now) {
  (await (await getDb()).prepare('UPDATE hr_mentor_tokens SET used_at = COALESCE(used_at, ?) WHERE token_hash = ?')
    .run(now, tokenHash));
}

/* ------------------------------------------------------- what a mentor does */

/**
 * "Still up for this." Resets the clock, and brings them back from paused or
 * dormant — that is the one-click return the whole design promises.
 */
export async function confirm(token, now = nowSeconds()) {
  const row = await findToken(token, now);
  if (!row) return { ok: false, reason: 'unknown' };
  return await transaction(async (db) => {
    const mentor = (await db.prepare('SELECT * FROM hr_mentors WHERE id = ?').get(row.mentor_id));
    if (!mentor) return { ok: false, reason: 'unknown' };
    const back = ['paused', 'dormant'].includes(mentor.state);
    (await db.prepare(
      `UPDATE hr_mentors SET confirmed_at = ?, reconfirm_sent_at = NULL, reconfirm_nudges = 0,
              state = CASE WHEN state IN ('paused','dormant') THEN 'listed' ELSE state END,
              active = CASE WHEN state IN ('paused','dormant') THEN 1 ELSE active END,
              paused_until = NULL
       WHERE id = ?`,
    ).run(now, mentor.id));
    await spend(row.token_hash, now);
    await logEvent({ mentorId: mentor.id, actorKind: 'mentor', event: 'confirmed', detail: back ? 'and came back' : '' });
    return { ok: true, mentor, cameBack: back };
  });
}

/** Pause for a window they chose. Grants already given survive; see mentordesk. */
export async function pause(token, { days = 30, now = nowSeconds() } = {}) {
  const row = await findToken(token, now);
  if (!row) return { ok: false, reason: 'unknown' };
  const mentor = (await (await getDb()).prepare('SELECT * FROM hr_mentors WHERE id = ?').get(row.mentor_id));
  if (!mentor) return { ok: false, reason: 'unknown' };
  (await (await getDb()).prepare(
    "UPDATE hr_mentors SET state = 'paused', paused_until = ?, reconfirm_nudges = 0, reconfirm_sent_at = NULL WHERE id = ?",
  ).run(now + days * DAY, mentor.id));
  await spend(row.token_hash, now);
  await logEvent({ mentorId: mentor.id, actorKind: 'mentor', event: 'paused', detail: `${days} days` });
  return { ok: true, mentor, days };
}

/**
 * "Take me off the list."
 *
 * Immediate, single click, no confirmation step and no win-back sequence. A
 * volunteer who wants out and meets a retention flow instead does not come
 * back, and tells people. Outstanding grants are revoked here — unlike a pause,
 * this is someone saying they are gone.
 */
export async function withdraw(token, now = nowSeconds()) {
  const row = await findToken(token, now);
  if (!row) return { ok: false, reason: 'unknown' };
  return await transaction(async (db) => {
    const mentor = (await db.prepare('SELECT * FROM hr_mentors WHERE id = ?').get(row.mentor_id));
    if (!mentor) return { ok: false, reason: 'unknown' };
    (await db.prepare("UPDATE hr_mentors SET state = 'withdrawn', active = 0 WHERE id = ?").run(mentor.id));
    (await db.prepare('UPDATE hr_mentor_grants SET revoked = 1 WHERE mentor_id = ? AND revoked = 0')
      .run(mentor.id));
    (await db.prepare("UPDATE hr_mentor_requests SET state = 'expired', answered_at = ? WHERE mentor_id = ? AND state = 'sent'")
      .run(now, mentor.id));
    await spend(row.token_hash, now);
    await logEvent({ mentorId: mentor.id, actorKind: 'mentor', event: 'withdrew' });
    return { ok: true, mentor };
  });
}

/* -------------------------------------------------------------- the sweep */

/**
 * Three unanswered in a row and we stop asking.
 *
 * "In a row" matters: a mentor who answers, misses one, answers again is
 * engaged. Three consecutive expiries is a pattern, and the pattern usually
 * means the address we have is not one they read.
 */
export async function autoPauseSilent(now = nowSeconds()) {
  const db = await getDb();
  const threshold = silencePause();
  const paused = [];

  const candidates = ((await db.prepare(
    `SELECT DISTINCT m.id, m.name FROM hr_mentors m
     JOIN hr_mentor_requests r ON r.mentor_id = m.id
     WHERE m.state = 'listed' AND r.state = 'expired'`,
  ).all()));

  for (const mentor of candidates) {
    const recent = ((await db.prepare(
      `SELECT state FROM hr_mentor_requests WHERE mentor_id = ?
       ORDER BY created_at DESC LIMIT ?`,
    ).all(mentor.id, threshold)));
    if (recent.length < threshold) continue;
    if (!recent.every((r) => r.state === 'expired')) continue;

    (await db.prepare("UPDATE hr_mentors SET state = 'paused', paused_until = ? WHERE id = ?")
      .run(now + 90 * DAY, mentor.id));
    await logEvent({
      mentorId: mentor.id, actorKind: 'system', event: 'auto-paused',
      detail: `${threshold} requests in a row went unanswered`,
    });
    paused.push(mentor);
  }
  return paused;
}

/**
 * Who is due a "still up for this?", and who has run out of nudges.
 *
 * Returns the work rather than doing the sending, so the caller owns the mail
 * and this stays testable without a provider.
 */
export async function reconfirmDue(now = nowSeconds()) {
  const db = await getDb();
  const cutoff = now - reconfirmDays() * DAY;
  const gap = nudgeDays() * DAY;

  const due = ((await db.prepare(
    `SELECT id, name, role, org, tags, capacity, reconfirm_nudges, reconfirm_sent_at
     FROM hr_mentors
     WHERE state = 'listed'
       AND COALESCE(confirmed_at, created_at) < ?
       AND (reconfirm_nudges = 0
            OR (reconfirm_nudges = 1 AND reconfirm_sent_at IS NOT NULL AND reconfirm_sent_at < ?))`,
  ).all(cutoff, now - gap)));

  const dormant = ((await db.prepare(
    `SELECT id, name FROM hr_mentors
     WHERE state = 'listed' AND reconfirm_nudges >= 2
       AND reconfirm_sent_at IS NOT NULL AND reconfirm_sent_at < ?`,
  ).all(now - 2 * gap)));

  return { due, dormant };
}

export async function markNudged(mentorId, now = nowSeconds()) {
  (await (await getDb()).prepare(
    `UPDATE hr_mentors SET reconfirm_nudges = reconfirm_nudges + 1,
            reconfirm_sent_at = COALESCE(reconfirm_sent_at, ?) WHERE id = ?`,
  ).run(now, Number(mentorId)));
}

/** Silence, twice over. Nothing is deleted; one click brings them back. */
export async function makeDormant(mentorId, now = nowSeconds()) {
  (await (await getDb()).prepare("UPDATE hr_mentors SET state = 'dormant', active = 0 WHERE id = ?")
    .run(Number(mentorId)));
  await logEvent({
    mentorId: Number(mentorId), actorKind: 'system', event: 'dormant',
    detail: 'no answer to two re-confirmations',
  });
}

/**
 * Members who met someone and never said how it went.
 *
 * Nagged once, at 14 days, then never again. Gate 5 is the only measure of
 * whether any of this worked, and it is also the thing a busy founder drops
 * first — so it gets exactly one reminder and no more, because a system that
 * nags is one people learn to ignore entirely.
 */
export async function outcomeNagsDue(now = nowSeconds()) {
  return (await (await getDb()).prepare(
    `SELECT r.id, r.member_id, m.name AS mentor_name
     FROM hr_mentor_requests r
     JOIN hr_mentors m ON m.id = r.mentor_id
     LEFT JOIN hr_mentor_outcomes o ON o.request_id = r.id
     WHERE r.state = 'accepted' AND o.request_id IS NULL AND r.answered_at < ?
       AND NOT EXISTS (SELECT 1 FROM hr_mentor_events e
                       WHERE e.request_id = r.id AND e.event = 'outcome-nagged')
     LIMIT 100`,
  ).all(now - outcomeNagDays() * DAY));
}

/* --------------------------------------------------------------- metrics */

const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
};

const rate = (part, whole) => (whole ? Math.round((part / whole) * 100) : null);

/**
 * The seven numbers on the steward page.
 *
 * Which seven is a policy statement, so it is worth saying what is NOT here:
 * **the total number of mentors.** A roster of 200 where 60 answer is worse
 * than a roster of 60, and counting the first number is exactly how you get
 * it. `dormantShare` is the honest version of the same question.
 */
export async function metrics(now = nowSeconds()) {
  const db = await getDb();
  const answered = ((await db.prepare(
    `SELECT state, created_at, answered_at FROM hr_mentor_requests
     WHERE state IN ('accepted','declined','expired')`,
  ).all()));

  const decided = answered.filter((r) => r.state !== 'expired');
  const accepted = answered.filter((r) => r.state === 'accepted');
  const times = decided
    .filter((r) => r.answered_at && r.answered_at > r.created_at)
    .map((r) => r.answered_at - r.created_at);

  const grants = ((await db.prepare('SELECT clicks FROM hr_mentor_grants').all()));
  const outcomes = ((await db.prepare('SELECT met, useful FROM hr_mentor_outcomes').all()));
  const useful = outcomes.map((o) => o.useful).filter((n) => Number.isFinite(n));

  /*
   * One query rather than one per listed mentor. This was a filter() with a
   * count inside it, which is a round trip per mentor on a page a steward
   * loads — and the count has to be a LEFT JOIN, because a mentor with no
   * accepted requests this month still belongs in the denominator.
   *
   * `capacity` falls back to 2 the same way the per-mentor path does; the
   * column defaults to 2 but an explicit 0 means "unset", not "none".
   */
  const { start, end } = monthBounds(now);
  const atCapacity = ((await db.prepare(
    `SELECT COUNT(*) AS n FROM (
       SELECT m.id, CASE WHEN m.capacity > 0 THEN m.capacity ELSE 2 END AS cap,
              COUNT(r.id) AS taken
       FROM hr_mentors m
       LEFT JOIN hr_mentor_requests r
         ON r.mentor_id = m.id AND r.state = 'accepted'
        AND r.answered_at >= ? AND r.answered_at < ?
       WHERE m.state = 'listed'
       GROUP BY m.id, m.capacity
     ) t WHERE t.taken >= t.cap`,
  ).get(start, end))).n;

  const roster = ((await db.prepare(
    "SELECT COUNT(*) AS n FROM hr_mentors WHERE state IN ('listed','paused','dormant')",
  ).get())).n;
  const dormant = ((await db.prepare("SELECT COUNT(*) AS n FROM hr_mentors WHERE state = 'dormant'").get())).n;

  return {
    acceptRate: rate(accepted.length, answered.length),
    medianAnswerHours: times.length ? Math.round(median(times) / 3600) : null,
    unansweredRate: rate(answered.filter((r) => r.state === 'expired').length, answered.length),
    clickRate: rate(grants.filter((g) => g.clicks > 0).length, grants.length),
    metRate: rate(outcomes.filter((o) => o.met).length, accepted.length),
    usefulAvg: useful.length ? Math.round((useful.reduce((a, b) => a + b, 0) / useful.length) * 10) / 10 : null,
    atCapacity,
    dormantShare: rate(dormant, roster),
    // Denominators, so a rate computed from four requests is not read as a trend.
    sample: { answered: answered.length, grants: grants.length, outcomes: outcomes.length },
  };
}

function monthBounds(now) {
  const d = new Date(now * 1000);
  return {
    start: Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / 1000,
    end: Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) / 1000,
  };
}
