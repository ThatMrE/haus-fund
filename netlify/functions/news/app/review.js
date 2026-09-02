/**
 * The review step.
 *
 * A human-surfaced submission does not go straight onto the board. It waits in
 * a queue until a reviewer clears it, and only then does it get the placement
 * the feed promises people-surfaced items. That order matters: the promise is
 * that what a person surfaces leads the page, which is only worth making if
 * someone has looked at it first.
 *
 * Trusted accounts — scouts and staff who have cleared review often enough —
 * skip the queue. Their posts are still reviewable after the fact.
 */
import { getDb, transaction } from './db/index.js';
import { nowSeconds } from './util.js';
import { award } from './points.js';

/** How many cleared submissions before an account stops needing review. */
export const TRUST_THRESHOLD = 3;

/**
 * Handles that get the review queue on sight.
 *
 * A fresh database has no users at all, so without this the first person to
 * sign up is untrusted and there is nobody who can clear the queue — the feed
 * would open with no way to run it. Listing handles in `NEWS_ADMINS` makes
 * those accounts reviewers the moment they are created.
 */
export function adminHandles(env = process.env) {
  return String(env.NEWS_ADMINS ?? '')
    .split(',')
    .map((handle) => handle.trim().toLowerCase())
    .filter(Boolean);
}

export function isFoundingAdmin(id, env = process.env) {
  return adminHandles(env).includes(String(id ?? '').toLowerCase());
}

/** Does this person's submission need to wait? */
export function needsReview(user) {
  if (!user) return true;
  if (user.is_admin) return false;
  if (user.trusted) return false;
  return true;
}

export function initialReviewState(user) {
  return needsReview(user) ? 'pending' : 'approved';
}

export async function pendingQueue({ limit = 50 } = {}) {
  return getDb().all(
    `SELECT * FROM items
     WHERE type = 'story' AND review_state = 'pending' AND deleted = 0
     ORDER BY created_at ASC LIMIT ?`,
    limit,
  );
}

export async function pendingCount() {
  const row = await getDb().get(
    "SELECT COUNT(*) AS n FROM items WHERE type = 'story' AND review_state = 'pending' AND deleted = 0",
  );
  return row.n;
}

/** Everything a given person has waiting, so they can see their own queue. */
export async function pendingFor(userId) {
  return getDb().all(
    `SELECT * FROM items
     WHERE type = 'story' AND review_state = 'pending' AND deleted = 0 AND by = ?
     ORDER BY created_at DESC`,
    userId,
  );
}

/**
 * Approve a submission: it joins the board, dated from the moment it cleared
 * rather than the moment it was submitted, so its 24 hours at the top are 24
 * hours of actually being visible.
 */
export async function approve(itemId, reviewerId, { note = null } = {}) {
  const item = await getDb().get('SELECT * FROM items WHERE id = ?', itemId);
  if (!item) return { ok: false, error: 'no such item' };
  if (item.review_state === 'approved') return { ok: true, item, already: true };

  const now = nowSeconds();
  await transaction(async (db) => {
    await db.run(
      `UPDATE items SET review_state = 'approved', reviewed_by = ?, reviewed_at = ?,
              review_note = ?, created_at = ?
       WHERE id = ?`,
      reviewerId,
      now,
      note,
      now,
      itemId,
    );
    await db.run(
      `UPDATE users SET trusted = CASE
         WHEN (SELECT COUNT(*) FROM items
               WHERE by = users.id AND review_state = 'approved' AND type = 'story') >= ?
         THEN 1 ELSE trusted END
       WHERE id = ?`,
      TRUST_THRESHOLD,
      item.by,
    );
  });

  if (item.surfaced_by) {
    await award({ userId: item.surfaced_by, reason: 'surfaced-approved', itemId });
  }

  return { ok: true, item: await getDb().get('SELECT * FROM items WHERE id = ?', itemId) };
}

export async function reject(itemId, reviewerId, { note = null } = {}) {
  const item = await getDb().get('SELECT * FROM items WHERE id = ?', itemId);
  if (!item) return { ok: false, error: 'no such item' };
  await getDb().run(
    `UPDATE items SET review_state = 'rejected', reviewed_by = ?, reviewed_at = ?, review_note = ?
     WHERE id = ?`,
    reviewerId,
    nowSeconds(),
    note,
    itemId,
  );
  return { ok: true, item: await getDb().get('SELECT * FROM items WHERE id = ?', itemId) };
}

/** Who may work the queue. */
export function canReview(user) {
  return Boolean(user && (user.is_admin || user.role === 'editor'));
}
