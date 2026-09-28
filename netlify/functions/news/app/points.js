/**
 * Scout points.
 *
 * Points are earned by putting things on the board that turn out to matter, and
 * they convert into things that exist in the world — a patch, a ticket to the
 * unconference. Because they buy something real, the ledger is the record and
 * `users.points` is only a cached sum: a disputed balance can always be
 * recomputed from the rows.
 *
 * Every award is idempotent. The unique index on (user_id, reason, item_id)
 * means a re-run of the awarding pass cannot pay twice for the same event, which
 * matters because that pass runs on a schedule.
 */
import { getDb, batch } from './db/index.js';
import { nowSeconds } from './util.js';

/** What each kind of event is worth. */
export const AWARDS = {
  'surfaced-approved': { points: 5, label: 'Surfaced a story that cleared review' },
  'upvotes-10': { points: 5, label: 'A surfaced story reached 10 points' },
  'upvotes-25': { points: 10, label: 'A surfaced story reached 25 points' },
  'upvotes-50': { points: 20, label: 'A surfaced story reached 50 points' },
  'top-ten': { points: 25, label: 'A surfaced story opened Biopunk Live' },
  'field-notes': { points: 15, label: 'A surfaced story led Field Notes' },
  adjustment: { points: 0, label: 'Manual adjustment' },
};

/** What points convert into. */
export const REWARDS = [
  {
    key: 'patch',
    label: 'Scout patch',
    cost: 100,
    blurb: 'The woven patch. Posted to you.',
  },
  {
    key: 'unconference',
    label: 'Unconference ticket',
    cost: 400,
    blurb: 'One ticket to the next Biopunk unconference.',
  },
  {
    key: 'unconference-plus',
    label: 'Unconference ticket, plus a guest',
    cost: 700,
    blurb: 'Two tickets, for you and someone you think should be there.',
  },
];

export function rewardByKey(key) {
  return REWARDS.find((r) => r.key === key) ?? null;
}

/**
 * Record an award. Returns the number of points actually granted — zero when
 * this exact award already existed, which is the normal case on a re-run.
 */
export async function award({ userId, reason, itemId = null, points = null, note = null }) {
  if (!userId) return 0;
  const delta = points ?? AWARDS[reason]?.points ?? 0;
  if (!delta) return 0;

  const [inserted] = await batch([
    {
      sql: `INSERT INTO points_ledger (user_id, delta, reason, item_id, note, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT DO NOTHING`,
      params: [userId, delta, reason, itemId, note, nowSeconds()],
    },
    // Recompute rather than increment. The balance is a cache of the ledger, so
    // deriving it is both correct when the insert was a no-op and self-healing
    // if a balance ever drifts.
    {
      sql: `UPDATE users SET points =
              (SELECT COALESCE(SUM(delta), 0) FROM points_ledger WHERE user_id = ?)
            WHERE id = ?`,
      params: [userId, userId],
    },
  ]);
  return inserted.changes ? delta : 0;
}

/** Spend points. Refuses rather than letting a balance go negative. */
export async function redeem(userId, rewardKey, { note = null } = {}) {
  const reward = rewardByKey(rewardKey);
  if (!reward) return { ok: false, error: 'no such reward' };

  const user = await getDb().get('SELECT points FROM users WHERE id = ?', userId);
  if (!user) return { ok: false, error: 'no such user' };

  const now = nowSeconds();
  // Every write carries the affordability check, so the balance is re-tested
  // inside the transaction rather than trusted from the read above: two
  // redemptions racing cannot both succeed on one balance.
  //
  // The deduction goes last on purpose. It is the only statement that changes
  // the balance, so while it runs last every guard still sees the balance the
  // caller had, and either all three writes happen or none do.
  const affordable = '(SELECT points FROM users WHERE id = ?) >= ?';
  const [ledger, requested] = await batch([
    {
      sql: `INSERT INTO points_ledger (user_id, delta, reason, item_id, note, created_at)
            SELECT ?, ?, ?, NULL, ?, ?
            WHERE ${affordable}`,
      params: [userId, -reward.cost, `redeem:${reward.key}`, note, now, userId, reward.cost],
    },
    {
      sql: `INSERT INTO redemptions (user_id, reward, cost, state, note, created_at)
            SELECT ?, ?, ?, 'requested', ?, ?
            WHERE ${affordable}`,
      params: [userId, reward.key, reward.cost, note, now, userId, reward.cost],
    },
    {
      sql: `UPDATE users SET points = points - ? WHERE id = ? AND ${affordable}`,
      params: [reward.cost, userId, userId, reward.cost],
    },
  ]);

  if (!ledger.changes) {
    return { ok: false, error: `That costs ${reward.cost} points; you have ${user.points}.` };
  }
  return {
    ok: true,
    redemption: {
      id: Number(requested.lastInsertRowid),
      reward,
      remaining: user.points - reward.cost,
    },
  };
}

export async function setRedemptionState(id, state, { note = null } = {}) {
  await getDb().run(
    'UPDATE redemptions SET state = ?, note = COALESCE(?, note), updated_at = ? WHERE id = ?',
    state,
    note,
    nowSeconds(),
    id,
  );
  return getDb().get('SELECT * FROM redemptions WHERE id = ?', id);
}

export async function balanceOf(userId) {
  const row = await getDb().get('SELECT points FROM users WHERE id = ?', userId);
  return row?.points ?? 0;
}

export async function ledgerFor(userId, { limit = 50 } = {}) {
  return getDb().all(
    `SELECT l.*, i.title AS item_title FROM points_ledger l
     LEFT JOIN items i ON i.id = l.item_id
     WHERE l.user_id = ? ORDER BY l.created_at DESC, l.id DESC LIMIT ?`,
    userId,
    limit,
  );
}

export async function redemptionsFor(userId) {
  return getDb().all(
    'SELECT * FROM redemptions WHERE user_id = ? ORDER BY created_at DESC',
    userId,
  );
}

export async function pendingRedemptions() {
  return getDb().all(
    "SELECT * FROM redemptions WHERE state = 'requested' ORDER BY created_at ASC",
  );
}

/** The standings. Scouts only — the agents do not collect points. */
export async function leaderboard({ limit = 25 } = {}) {
  return getDb().all(
    `SELECT id, points, karma, role FROM users
     WHERE points > 0 AND role != 'agent'
     ORDER BY points DESC, karma DESC, id ASC LIMIT ?`,
    limit,
  );
}

/**
 * Award the vote milestones. Runs on the schedule rather than on every vote:
 * one pass over recent stories is cheaper than a check inside the hot path, and
 * the unique index makes running it repeatedly harmless.
 */
export async function awardVoteMilestones({ days = 30 } = {}) {
  const since = nowSeconds() - days * 86400;
  const rows = await getDb().all(
    `SELECT id, surfaced_by, points FROM items
     WHERE type = 'story' AND deleted = 0 AND surfaced_by IS NOT NULL
       AND created_at >= ? AND points >= 10`,
    since,
  );

  let granted = 0;
  for (const row of rows) {
    for (const [threshold, reason] of [[10, 'upvotes-10'], [25, 'upvotes-25'], [50, 'upvotes-50']]) {
      if (row.points >= threshold) {
        granted += await award({ userId: row.surfaced_by, reason, itemId: row.id });
      }
    }
  }
  return granted;
}

/** Recompute a balance from the ledger. The ledger is the truth. */
export async function recomputeBalance(userId) {
  const row = await getDb().get(
    'SELECT COALESCE(SUM(delta), 0) AS total FROM points_ledger WHERE user_id = ?',
    userId,
  );
  const total = Math.max(0, row.total);
  await getDb().run('UPDATE users SET points = ? WHERE id = ?', total, userId);
  return total;
}
