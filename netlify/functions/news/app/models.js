import { getDb, transaction } from './db.js';
import { rankStories } from './rank.js';
import { displayDomain, nowSeconds } from './util.js';

/** Editing / deleting / unvoting is only allowed for this long after posting. */
export const EDIT_WINDOW = 60 * 60 * 2;
/** How many flags before an item is auto-killed. */
export const FLAG_THRESHOLD = 4;
/** Candidate pool pulled from SQLite before the front page is ranked in JS. */
export const RANK_POOL = 600;
export const MAX_DEPTH = 12;
export const PAGE_SIZE = 30;

export const TOPICS = [
  { slug: 'synbio', label: 'Synthetic Biology' },
  { slug: 'crispr', label: 'Gene Editing' },
  { slug: 'longevity', label: 'Longevity' },
  { slug: 'neuro', label: 'Neurotech' },
  { slug: 'bioinformatics', label: 'Bioinformatics / AI' },
  { slug: 'diybio', label: 'DIYbio & Community Labs' },
  { slug: 'biosecurity', label: 'Biosecurity & Policy' },
  { slug: 'biomanufacturing', label: 'Biomanufacturing' },
  { slug: 'therapeutics', label: 'Therapeutics & Clinic' },
  { slug: 'hardware', label: 'Lab Hardware' },
  { slug: 'funding', label: 'Funding & Startups' },
  { slug: 'other', label: 'Other' },
];

const TOPIC_SLUGS = new Set(TOPICS.map((t) => t.slug));

export function topicLabel(slug) {
  return TOPICS.find((t) => t.slug === slug)?.label ?? null;
}

export function normalizeTopic(slug) {
  return TOPIC_SLUGS.has(slug) ? slug : null;
}

/* ------------------------------------------------------------------ users */

export function createUser({ id, passwordHash, email = null, isAdmin = false }) {
  const now = nowSeconds();
  getDb()
    .prepare(
      `INSERT INTO users (id, password_hash, email, about, karma, created_at, is_admin)
       VALUES (?, ?, ?, '', 1, ?, ?)`,
    )
    .run(id, passwordHash, email, now, isAdmin ? 1 : 0);
  return getUser(id);
}

export function getUser(id) {
  if (!id) return null;
  return getDb().prepare('SELECT * FROM users WHERE id = ? COLLATE NOCASE').get(id) ?? null;
}

export function updateUser(id, { about, email }) {
  getDb()
    .prepare('UPDATE users SET about = COALESCE(?, about), email = COALESCE(?, email) WHERE id = ?')
    .run(about ?? null, email ?? null, id);
  return getUser(id);
}

export function userStats(id) {
  return getDb()
    .prepare(
      `SELECT
         SUM(CASE WHEN type = 'story'   THEN 1 ELSE 0 END) AS stories,
         SUM(CASE WHEN type = 'comment' THEN 1 ELSE 0 END) AS comments
       FROM items WHERE by = ? AND deleted = 0`,
    )
    .get(id);
}

function bumpKarma(userId, delta) {
  getDb().prepare('UPDATE users SET karma = MAX(0, karma + ?) WHERE id = ?').run(delta, userId);
}

/* ------------------------------------------------------------------ items */

export function createStory({ by, title, url = null, text = null, topic = null, kind = 'link', source = 'human' }) {
  const now = nowSeconds();
  return transaction((db) => {
    const info = db
      .prepare(
        `INSERT INTO items (type, by, created_at, title, url, domain, text, topic, kind, source, points)
         VALUES ('story', ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      )
      .run(by, now, title, url, url ? displayDomain(url) : null, text, topic, kind, source);
    const id = Number(info.lastInsertRowid);
    db.prepare('UPDATE items SET story_id = ? WHERE id = ?').run(id, id);
    db.prepare('INSERT INTO votes (user_id, item_id, created_at) VALUES (?, ?, ?)').run(by, id, now);
    return id;
  });
}

export function createComment({ by, parentId, text }) {
  const parent = getItem(parentId);
  if (!parent) throw new Error('parent not found');
  const storyId = parent.type === 'story' ? parent.id : parent.story_id;
  const depth = Math.min(parent.depth + (parent.type === 'story' ? 0 : 1), MAX_DEPTH);
  const now = nowSeconds();
  return transaction((db) => {
    const info = db
      .prepare(
        `INSERT INTO items (type, by, created_at, text, parent_id, story_id, depth, kind, points)
         VALUES ('comment', ?, ?, ?, ?, ?, ?, 'comment', 1)`,
      )
      .run(by, now, text, parent.id, storyId, depth);
    const id = Number(info.lastInsertRowid);
    db.prepare('UPDATE items SET comment_count = comment_count + 1 WHERE id = ?').run(storyId);
    db.prepare('INSERT INTO votes (user_id, item_id, created_at) VALUES (?, ?, ?)').run(by, id, now);
    return id;
  });
}

export function getItem(id) {
  const numeric = Number(id);
  if (!Number.isInteger(numeric)) return null;
  return getDb().prepare('SELECT * FROM items WHERE id = ?').get(numeric) ?? null;
}

export function editItem(id, { title, text, url, topic }) {
  const item = getItem(id);
  if (!item) return null;
  getDb()
    .prepare(
      `UPDATE items SET title = COALESCE(?, title), text = ?, url = COALESCE(?, url),
              domain = COALESCE(?, domain), topic = COALESCE(?, topic), edited_at = ?
       WHERE id = ?`,
    )
    .run(
      title ?? null,
      text ?? null,
      url ?? null,
      url ? displayDomain(url) : null,
      topic ?? null,
      nowSeconds(),
      id,
    );
  return getItem(id);
}

/** Soft delete: the row stays so the comment tree keeps its shape. */
export function deleteItem(id) {
  const item = getItem(id);
  if (!item) return false;
  transaction((db) => {
    db.prepare('UPDATE items SET deleted = 1 WHERE id = ?').run(id);
    if (item.type === 'comment' && item.story_id) {
      db.prepare('UPDATE items SET comment_count = MAX(0, comment_count - 1) WHERE id = ?').run(item.story_id);
    }
  });
  return true;
}

export function canEdit(item, user) {
  if (!item || !user || item.deleted) return false;
  if (user.is_admin) return true;
  if (item.by !== user.id) return false;
  return nowSeconds() - item.created_at < EDIT_WINDOW;
}

/* ------------------------------------------------------------------ votes */

export function hasVoted(userId, itemId) {
  if (!userId) return false;
  return Boolean(
    getDb().prepare('SELECT 1 FROM votes WHERE user_id = ? AND item_id = ?').get(userId, itemId),
  );
}

/** Which of `itemIds` the user has already upvoted — one query for a whole page. */
export function votedItemIds(userId, itemIds) {
  if (!userId || itemIds.length === 0) return new Set();
  const placeholders = itemIds.map(() => '?').join(',');
  const rows = getDb()
    .prepare(`SELECT item_id FROM votes WHERE user_id = ? AND item_id IN (${placeholders})`)
    .all(userId, ...itemIds);
  return new Set(rows.map((r) => r.item_id));
}

/**
 * Upvote an item. Returns `{ ok, points, voted, error }`. Voting is idempotent:
 * a second call from the same user is a no-op rather than an error.
 */
export function vote(userId, itemId) {
  const item = getItem(itemId);
  if (!item || item.deleted) return { ok: false, error: 'no such item' };
  if (item.by === userId) return { ok: false, error: 'you cannot upvote your own post', points: item.points };
  if (hasVoted(userId, itemId)) return { ok: true, points: item.points, voted: true };
  const points = transaction((db) => {
    db.prepare('INSERT INTO votes (user_id, item_id, created_at) VALUES (?, ?, ?)').run(
      userId,
      itemId,
      nowSeconds(),
    );
    db.prepare('UPDATE items SET points = points + 1 WHERE id = ?').run(itemId);
    db.prepare('UPDATE users SET karma = karma + 1 WHERE id = ?').run(item.by);
    return db.prepare('SELECT points FROM items WHERE id = ?').get(itemId).points;
  });
  return { ok: true, points, voted: true };
}

/** Remove an upvote. The submitter's own seed vote cannot be removed. */
export function unvote(userId, itemId) {
  const item = getItem(itemId);
  if (!item || item.deleted) return { ok: false, error: 'no such item' };
  if (item.by === userId) return { ok: false, error: 'you cannot unvote your own post', points: item.points };
  if (!hasVoted(userId, itemId)) return { ok: true, points: item.points, voted: false };
  const points = transaction((db) => {
    db.prepare('DELETE FROM votes WHERE user_id = ? AND item_id = ?').run(userId, itemId);
    db.prepare('UPDATE items SET points = MAX(0, points - 1) WHERE id = ?').run(itemId);
    return db.prepare('SELECT points FROM items WHERE id = ?').get(itemId).points;
  });
  bumpKarma(item.by, -1);
  return { ok: true, points, voted: false };
}

/* ------------------------------------------------------------------ flags */

/** Flagged / favorited lookups for a whole page, one query each. */
export function markedItemIds(table, userId, itemIds) {
  if (!userId || itemIds.length === 0) return new Set();
  const placeholders = itemIds.map(() => '?').join(',');
  const rows = getDb()
    .prepare(`SELECT item_id FROM ${table === 'flags' ? 'flags' : 'favorites'} WHERE user_id = ? AND item_id IN (${placeholders})`)
    .all(userId, ...itemIds);
  return new Set(rows.map((r) => r.item_id));
}

export function hasFlagged(userId, itemId) {
  if (!userId) return false;
  return Boolean(
    getDb().prepare('SELECT 1 FROM flags WHERE user_id = ? AND item_id = ?').get(userId, itemId),
  );
}

export function toggleFlag(userId, itemId) {
  const item = getItem(itemId);
  if (!item || item.deleted) return { ok: false, error: 'no such item' };
  const flagged = hasFlagged(userId, itemId);
  transaction((db) => {
    if (flagged) {
      db.prepare('DELETE FROM flags WHERE user_id = ? AND item_id = ?').run(userId, itemId);
      db.prepare('UPDATE items SET flag_count = MAX(0, flag_count - 1) WHERE id = ?').run(itemId);
    } else {
      db.prepare('INSERT INTO flags (user_id, item_id, created_at) VALUES (?, ?, ?)').run(
        userId,
        itemId,
        nowSeconds(),
      );
      db.prepare('UPDATE items SET flag_count = flag_count + 1 WHERE id = ?').run(itemId);
    }
    db.prepare('UPDATE items SET dead = CASE WHEN flag_count >= ? THEN 1 ELSE 0 END WHERE id = ?').run(
      FLAG_THRESHOLD,
      itemId,
    );
  });
  return { ok: true, flagged: !flagged };
}

/* -------------------------------------------------------------- favorites */

export function toggleFavorite(userId, itemId) {
  const existing = getDb()
    .prepare('SELECT 1 FROM favorites WHERE user_id = ? AND item_id = ?')
    .get(userId, itemId);
  if (existing) {
    getDb().prepare('DELETE FROM favorites WHERE user_id = ? AND item_id = ?').run(userId, itemId);
    return { ok: true, favorited: false };
  }
  getDb()
    .prepare('INSERT INTO favorites (user_id, item_id, created_at) VALUES (?, ?, ?)')
    .run(userId, itemId, nowSeconds());
  return { ok: true, favorited: true };
}

export function countFavorites(userId) {
  return getDb()
    .prepare(
      `SELECT COUNT(*) AS n FROM favorites f JOIN items i ON i.id = f.item_id
       WHERE f.user_id = ? AND i.deleted = 0`,
    )
    .get(userId).n;
}

export function listFavorites(userId, { limit = PAGE_SIZE, offset = 0 } = {}) {
  return getDb()
    .prepare(
      `SELECT i.* FROM favorites f JOIN items i ON i.id = f.item_id
       WHERE f.user_id = ? AND i.deleted = 0
       ORDER BY f.created_at DESC LIMIT ? OFFSET ?`,
    )
    .all(userId, limit, offset);
}

/* --------------------------------------------------------------- listings */

const STORY_COLUMNS = 'id, type, by, created_at, title, url, domain, text, topic, kind, source, points, comment_count, flag_count, dead, deleted, edited_at, story_id, parent_id, depth';

/** Ranked front page. Ranking happens in JS over a recent candidate pool. */
export function frontPage({ limit = PAGE_SIZE, offset = 0, topic = null, now = nowSeconds() } = {}) {
  const cutoff = now - 60 * 60 * 24 * 14;
  const params = [cutoff];
  let where = "type = 'story' AND deleted = 0 AND dead = 0 AND created_at > ?";
  if (topic) {
    where += ' AND topic = ?';
    params.push(topic);
  }
  const candidates = getDb()
    .prepare(`SELECT ${STORY_COLUMNS} FROM items WHERE ${where} ORDER BY created_at DESC LIMIT ${RANK_POOL}`)
    .all(...params);
  const ranked = rankStories(candidates, now);
  return { items: ranked.slice(offset, offset + limit), total: ranked.length };
}

export function newest({ limit = PAGE_SIZE, offset = 0, topic = null } = {}) {
  const params = [];
  let where = "type = 'story' AND deleted = 0";
  if (topic) {
    where += ' AND topic = ?';
    params.push(topic);
  }
  const items = getDb()
    .prepare(`SELECT ${STORY_COLUMNS} FROM items WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset);
  const { total } = getDb().prepare(`SELECT COUNT(*) AS total FROM items WHERE ${where}`).get(...params);
  return { items, total };
}

export function byKind(kind, { limit = PAGE_SIZE, offset = 0, now = nowSeconds() } = {}) {
  const candidates = getDb()
    .prepare(
      `SELECT ${STORY_COLUMNS} FROM items
       WHERE type = 'story' AND kind = ? AND deleted = 0 AND dead = 0
       ORDER BY created_at DESC LIMIT ${RANK_POOL}`,
    )
    .all(kind);
  const ranked = rankStories(candidates, now);
  return { items: ranked.slice(offset, offset + limit), total: ranked.length };
}

export function byDomain(domain, { limit = PAGE_SIZE, offset = 0 } = {}) {
  const items = getDb()
    .prepare(
      `SELECT ${STORY_COLUMNS} FROM items
       WHERE type = 'story' AND domain = ? AND deleted = 0
       ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    )
    .all(domain, limit, offset);
  const { total } = getDb()
    .prepare("SELECT COUNT(*) AS total FROM items WHERE type = 'story' AND domain = ? AND deleted = 0")
    .get(domain);
  return { items, total };
}

/** Duplicate detection: has this exact link been posted recently? */
export function findByUrl(url, { withinDays = 14 } = {}) {
  return (
    getDb()
      .prepare(
        `SELECT ${STORY_COLUMNS} FROM items
         WHERE type = 'story' AND url = ? AND deleted = 0 AND created_at > ?
         ORDER BY created_at DESC LIMIT 1`,
      )
      .get(url, nowSeconds() - withinDays * 86400) ?? null
  );
}

export function bestStories({ limit = PAGE_SIZE, offset = 0, days = 30 } = {}) {
  const cutoff = nowSeconds() - days * 86400;
  const items = getDb()
    .prepare(
      `SELECT ${STORY_COLUMNS} FROM items
       WHERE type = 'story' AND deleted = 0 AND dead = 0 AND created_at > ?
       ORDER BY points DESC, created_at DESC LIMIT ? OFFSET ?`,
    )
    .all(cutoff, limit, offset);
  const { total } = getDb()
    .prepare(
      "SELECT COUNT(*) AS total FROM items WHERE type = 'story' AND deleted = 0 AND dead = 0 AND created_at > ?",
    )
    .get(cutoff);
  return { items, total };
}

export function userSubmissions(userId, { limit = PAGE_SIZE, offset = 0 } = {}) {
  const items = getDb()
    .prepare(
      `SELECT ${STORY_COLUMNS} FROM items
       WHERE type = 'story' AND by = ? COLLATE NOCASE AND deleted = 0
       ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    )
    .all(userId, limit, offset);
  const { total } = getDb()
    .prepare("SELECT COUNT(*) AS total FROM items WHERE type = 'story' AND by = ? COLLATE NOCASE AND deleted = 0")
    .get(userId);
  return { items, total };
}

export function userComments(userId, { limit = PAGE_SIZE, offset = 0 } = {}) {
  const items = getDb()
    .prepare(
      `SELECT ${STORY_COLUMNS} FROM items
       WHERE type = 'comment' AND by = ? COLLATE NOCASE AND deleted = 0
       ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    )
    .all(userId, limit, offset);
  const { total } = getDb()
    .prepare("SELECT COUNT(*) AS total FROM items WHERE type = 'comment' AND by = ? COLLATE NOCASE AND deleted = 0")
    .get(userId);
  return { items, total };
}

export function recentComments({ limit = PAGE_SIZE, offset = 0 } = {}) {
  const items = getDb()
    .prepare(
      `SELECT ${STORY_COLUMNS} FROM items
       WHERE type = 'comment' AND deleted = 0 AND dead = 0
       ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    )
    .all(limit, offset);
  const { total } = getDb()
    .prepare("SELECT COUNT(*) AS total FROM items WHERE type = 'comment' AND deleted = 0 AND dead = 0")
    .get();
  return { items, total };
}

export function search(query, { limit = PAGE_SIZE, offset = 0 } = {}) {
  const needle = `%${String(query).trim().replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  const where = `deleted = 0 AND dead = 0 AND (
      title LIKE ? ESCAPE '\\' OR text LIKE ? ESCAPE '\\' OR domain LIKE ? ESCAPE '\\'
    )`;
  const items = getDb()
    .prepare(
      `SELECT ${STORY_COLUMNS} FROM items WHERE ${where}
       ORDER BY (type = 'story') DESC, points DESC, created_at DESC LIMIT ? OFFSET ?`,
    )
    .all(needle, needle, needle, limit, offset);
  const { total } = getDb()
    .prepare(`SELECT COUNT(*) AS total FROM items WHERE ${where}`)
    .get(needle, needle, needle);
  return { items, total };
}

/* ----------------------------------------------------------- comment tree */

/** All comments on a story, ordered as a depth-first tree by score then time. */
export function commentTree(storyId) {
  const rows = getDb()
    .prepare(
      `SELECT ${STORY_COLUMNS} FROM items
       WHERE type = 'comment' AND story_id = ?
       ORDER BY points DESC, created_at ASC`,
    )
    .all(storyId);

  const children = new Map();
  for (const row of rows) {
    const key = row.parent_id;
    if (!children.has(key)) children.set(key, []);
    children.get(key).push(row);
  }

  const ordered = [];
  const walk = (parentId, depth) => {
    for (const node of children.get(parentId) ?? []) {
      ordered.push({ ...node, depth: Math.min(depth, MAX_DEPTH) });
      walk(node.id, depth + 1);
    }
  };
  walk(storyId, 0);
  return ordered;
}

/** Attach the parent story's title to a flat list of comments (one query). */
export function withStoryTitles(comments) {
  const ids = [...new Set(comments.map((c) => c.story_id).filter(Boolean))];
  if (ids.length === 0) return comments;
  const rows = getDb()
    .prepare(`SELECT id, title FROM items WHERE id IN (${ids.map(() => '?').join(',')})`)
    .all(...ids);
  const titles = new Map(rows.map((r) => [r.id, r.title]));
  for (const comment of comments) comment.story_title = titles.get(comment.story_id) ?? null;
  return comments;
}

/** Parents of a comment, oldest ancestor first — used for breadcrumbs. */
export function ancestors(item) {
  const chain = [];
  let current = item;
  while (current?.parent_id) {
    current = getItem(current.parent_id);
    if (!current) break;
    chain.unshift(current);
  }
  return chain;
}

/** Story counts by origin since a cutoff — used by the standing stat line. */
export function postedSince(cutoff) {
  const row = getDb()
    .prepare(
      `SELECT
         SUM(CASE WHEN source = 'agent' THEN 1 ELSE 0 END) AS agent,
         SUM(CASE WHEN source != 'agent' THEN 1 ELSE 0 END) AS human
       FROM items WHERE type = 'story' AND deleted = 0 AND created_at >= ?`,
    )
    .get(cutoff);
  return { agent: row.agent ?? 0, human: row.human ?? 0 };
}

export function siteStats() {
  const db = getDb();
  return {
    users: db.prepare('SELECT COUNT(*) AS n FROM users').get().n,
    stories: db.prepare("SELECT COUNT(*) AS n FROM items WHERE type = 'story' AND deleted = 0").get().n,
    comments: db.prepare("SELECT COUNT(*) AS n FROM items WHERE type = 'comment' AND deleted = 0").get().n,
    votes: db.prepare('SELECT COUNT(*) AS n FROM votes').get().n,
  };
}
