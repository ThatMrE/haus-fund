import { getDb, transaction } from './db/index.js';
import { rankStories, composeFrontPage } from './rank.js';
import { displayDomain, nowSeconds } from './util.js';

/** Editing / deleting / unvoting is only allowed for this long after posting. */
export const EDIT_WINDOW = 60 * 60 * 2;
/** How many flags before an item is auto-killed. */
export const FLAG_THRESHOLD = 4;
/** Candidate pool pulled from the database before the front page is ranked in JS. */
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

export async function createUser({
  id,
  passwordHash,
  email = null,
  isAdmin = false,
  role = 'member',
  trusted = false,
}) {
  const now = nowSeconds();
  await getDb().run(
    `INSERT INTO users (id, password_hash, email, about, karma, created_at, is_admin, role, trusted)
     VALUES (?, ?, ?, '', 1, ?, ?, ?, ?)`,
    id,
    passwordHash,
    email,
    now,
    isAdmin ? 1 : 0,
    role,
    trusted ? 1 : 0,
  );
  return getUser(id);
}

export async function getUser(id) {
  if (!id) return null;
  return getDb().get('SELECT * FROM users WHERE id = ? COLLATE NOCASE', id);
}

export async function updateUser(id, { about, email }) {
  await getDb().run(
    'UPDATE users SET about = COALESCE(?, about), email = COALESCE(?, email) WHERE id = ?',
    about ?? null,
    email ?? null,
    id,
  );
  return getUser(id);
}

export async function setUserRole(id, { role, trusted, isAdmin }) {
  await getDb().run(
    `UPDATE users SET role = COALESCE(?, role), trusted = COALESCE(?, trusted),
            is_admin = COALESCE(?, is_admin) WHERE id = ?`,
    role ?? null,
    trusted === undefined ? null : trusted ? 1 : 0,
    isAdmin === undefined ? null : isAdmin ? 1 : 0,
    id,
  );
  return getUser(id);
}

export async function userStats(id) {
  return getDb().get(
    `SELECT
       SUM(CASE WHEN type = 'story'   THEN 1 ELSE 0 END) AS stories,
       SUM(CASE WHEN type = 'comment' THEN 1 ELSE 0 END) AS comments
     FROM items WHERE by = ? AND deleted = 0`,
    id,
  );
}

async function bumpKarma(userId, delta) {
  await getDb().run('UPDATE users SET karma = MAX(0, karma + ?) WHERE id = ?', delta, userId);
}

/* ------------------------------------------------------------------ items */

export async function createStory({
  by,
  title,
  url = null,
  text = null,
  topic = null,
  kind = 'link',
  source = 'human',
  agent = null,
  surfacedBy = null,
  channel = null,
  reviewState = 'approved',
}) {
  const now = nowSeconds();
  return transaction(async (db) => {
    const info = await db.run(
      `INSERT INTO items
         (type, by, created_at, title, url, domain, text, topic, kind, source,
          agent, surfaced_by, channel, review_state, points)
       VALUES ('story', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      by,
      now,
      title,
      url,
      url ? displayDomain(url) : null,
      text,
      topic,
      kind,
      source,
      agent,
      surfacedBy ?? (source === 'human' ? by : null),
      channel,
      reviewState,
    );
    const id = Number(info.lastInsertRowid);
    await db.run('UPDATE items SET story_id = ? WHERE id = ?', id, id);
    await db.run('INSERT INTO votes (user_id, item_id, created_at) VALUES (?, ?, ?)', by, id, now);
    return id;
  });
}

export async function createComment({ by, parentId, text }) {
  const parent = await getItem(parentId);
  if (!parent) throw new Error('parent not found');
  const storyId = parent.type === 'story' ? parent.id : parent.story_id;
  const depth = Math.min(parent.depth + (parent.type === 'story' ? 0 : 1), MAX_DEPTH);
  const now = nowSeconds();
  return transaction(async (db) => {
    const info = await db.run(
      `INSERT INTO items (type, by, created_at, text, parent_id, story_id, depth, kind, points)
       VALUES ('comment', ?, ?, ?, ?, ?, ?, 'comment', 1)`,
      by,
      now,
      text,
      parent.id,
      storyId,
      depth,
    );
    const id = Number(info.lastInsertRowid);
    await db.run('UPDATE items SET comment_count = comment_count + 1 WHERE id = ?', storyId);
    await db.run('INSERT INTO votes (user_id, item_id, created_at) VALUES (?, ?, ?)', by, id, now);
    return id;
  });
}

export async function getItem(id) {
  const numeric = Number(id);
  if (!Number.isInteger(numeric)) return null;
  return getDb().get('SELECT * FROM items WHERE id = ?', numeric);
}

export async function editItem(id, { title, text, url, topic }) {
  const item = await getItem(id);
  if (!item) return null;
  await getDb().run(
    `UPDATE items SET title = COALESCE(?, title), text = ?, url = COALESCE(?, url),
            domain = COALESCE(?, domain), topic = COALESCE(?, topic), edited_at = ?
     WHERE id = ?`,
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
export async function deleteItem(id) {
  const item = await getItem(id);
  if (!item) return false;
  await transaction(async (db) => {
    await db.run('UPDATE items SET deleted = 1 WHERE id = ?', id);
    if (item.type === 'comment' && item.story_id) {
      await db.run(
        'UPDATE items SET comment_count = MAX(0, comment_count - 1) WHERE id = ?',
        item.story_id,
      );
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

export async function hasVoted(userId, itemId) {
  if (!userId) return false;
  return Boolean(await getDb().get('SELECT 1 AS x FROM votes WHERE user_id = ? AND item_id = ?', userId, itemId));
}

/** Which of `itemIds` the user has already upvoted — one query for a whole page. */
export async function votedItemIds(userId, itemIds) {
  if (!userId || itemIds.length === 0) return new Set();
  const placeholders = itemIds.map(() => '?').join(',');
  const rows = await getDb().all(
    `SELECT item_id FROM votes WHERE user_id = ? AND item_id IN (${placeholders})`,
    userId,
    ...itemIds,
  );
  return new Set(rows.map((r) => r.item_id));
}

/**
 * Upvote an item. Returns `{ ok, points, voted, error }`. Voting is idempotent:
 * a second call from the same user is a no-op rather than an error.
 */
export async function vote(userId, itemId) {
  const item = await getItem(itemId);
  if (!item || item.deleted) return { ok: false, error: 'no such item' };
  if (item.by === userId) {
    return { ok: false, error: 'you cannot upvote your own post', points: item.points };
  }
  if (await hasVoted(userId, itemId)) return { ok: true, points: item.points, voted: true };
  const points = await transaction(async (db) => {
    await db.run(
      'INSERT INTO votes (user_id, item_id, created_at) VALUES (?, ?, ?)',
      userId,
      itemId,
      nowSeconds(),
    );
    await db.run('UPDATE items SET points = points + 1 WHERE id = ?', itemId);
    await db.run('UPDATE users SET karma = karma + 1 WHERE id = ?', item.by);
    return (await db.get('SELECT points FROM items WHERE id = ?', itemId)).points;
  });
  return { ok: true, points, voted: true };
}

/** Remove an upvote. The submitter's own seed vote cannot be removed. */
export async function unvote(userId, itemId) {
  const item = await getItem(itemId);
  if (!item || item.deleted) return { ok: false, error: 'no such item' };
  if (item.by === userId) {
    return { ok: false, error: 'you cannot unvote your own post', points: item.points };
  }
  if (!(await hasVoted(userId, itemId))) return { ok: true, points: item.points, voted: false };
  const points = await transaction(async (db) => {
    await db.run('DELETE FROM votes WHERE user_id = ? AND item_id = ?', userId, itemId);
    await db.run('UPDATE items SET points = MAX(0, points - 1) WHERE id = ?', itemId);
    return (await db.get('SELECT points FROM items WHERE id = ?', itemId)).points;
  });
  await bumpKarma(item.by, -1);
  return { ok: true, points, voted: false };
}

/* ------------------------------------------------------------------ flags */

/** Flagged / favorited lookups for a whole page, one query each. */
export async function markedItemIds(table, userId, itemIds) {
  if (!userId || itemIds.length === 0) return new Set();
  const placeholders = itemIds.map(() => '?').join(',');
  const rows = await getDb().all(
    `SELECT item_id FROM ${table === 'flags' ? 'flags' : 'favorites'}
     WHERE user_id = ? AND item_id IN (${placeholders})`,
    userId,
    ...itemIds,
  );
  return new Set(rows.map((r) => r.item_id));
}

export async function hasFlagged(userId, itemId) {
  if (!userId) return false;
  return Boolean(await getDb().get('SELECT 1 AS x FROM flags WHERE user_id = ? AND item_id = ?', userId, itemId));
}

export async function toggleFlag(userId, itemId) {
  const item = await getItem(itemId);
  if (!item || item.deleted) return { ok: false, error: 'no such item' };
  const flagged = await hasFlagged(userId, itemId);
  await transaction(async (db) => {
    if (flagged) {
      await db.run('DELETE FROM flags WHERE user_id = ? AND item_id = ?', userId, itemId);
      await db.run('UPDATE items SET flag_count = MAX(0, flag_count - 1) WHERE id = ?', itemId);
    } else {
      await db.run(
        'INSERT INTO flags (user_id, item_id, created_at) VALUES (?, ?, ?)',
        userId,
        itemId,
        nowSeconds(),
      );
      await db.run('UPDATE items SET flag_count = flag_count + 1 WHERE id = ?', itemId);
    }
    await db.run(
      'UPDATE items SET dead = CASE WHEN flag_count >= ? THEN 1 ELSE 0 END WHERE id = ?',
      FLAG_THRESHOLD,
      itemId,
    );
  });
  return { ok: true, flagged: !flagged };
}

/* -------------------------------------------------------------- favorites */

export async function toggleFavorite(userId, itemId) {
  const existing = await getDb().get(
    'SELECT 1 AS x FROM favorites WHERE user_id = ? AND item_id = ?',
    userId,
    itemId,
  );
  if (existing) {
    await getDb().run('DELETE FROM favorites WHERE user_id = ? AND item_id = ?', userId, itemId);
    return { ok: true, favorited: false };
  }
  await getDb().run(
    'INSERT INTO favorites (user_id, item_id, created_at) VALUES (?, ?, ?)',
    userId,
    itemId,
    nowSeconds(),
  );
  return { ok: true, favorited: true };
}

export async function countFavorites(userId) {
  const row = await getDb().get(
    `SELECT COUNT(*) AS n FROM favorites f JOIN items i ON i.id = f.item_id
     WHERE f.user_id = ? AND i.deleted = 0`,
    userId,
  );
  return row.n;
}

export async function listFavorites(userId, { limit = PAGE_SIZE, offset = 0 } = {}) {
  return getDb().all(
    `SELECT i.* FROM favorites f JOIN items i ON i.id = f.item_id
     WHERE f.user_id = ? AND i.deleted = 0
     ORDER BY f.created_at DESC LIMIT ? OFFSET ?`,
    userId,
    limit,
    offset,
  );
}

/* --------------------------------------------------------------- listings */

const STORY_COLUMNS =
  'id, type, by, created_at, title, url, domain, text, topic, kind, source, agent, ' +
  'surfaced_by, channel, review_state, points, comment_count, flag_count, dead, ' +
  'deleted, edited_at, story_id, parent_id, depth';

/** Only items that cleared review belong on a public listing. */
const PUBLIC = "review_state = 'approved'";

/**
 * The front page: a ranked pool, composed so that neither the agents nor the
 * people are drowned out. See `composeFrontPage`.
 */
export async function frontPage({ limit = PAGE_SIZE, offset = 0, topic = null, now = nowSeconds() } = {}) {
  const cutoff = now - 60 * 60 * 24 * 14;
  const params = [cutoff];
  let where = `type = 'story' AND deleted = 0 AND dead = 0 AND ${PUBLIC} AND created_at > ?`;
  if (topic) {
    where += ' AND topic = ?';
    params.push(topic);
  }
  const candidates = await getDb().all(
    `SELECT ${STORY_COLUMNS} FROM items WHERE ${where} ORDER BY created_at DESC LIMIT ${RANK_POOL}`,
    ...params,
  );
  const ranked = composeFrontPage(rankStories(candidates, now));
  return { items: ranked.slice(offset, offset + limit), total: ranked.length };
}

export async function newest({ limit = PAGE_SIZE, offset = 0, topic = null } = {}) {
  const params = [];
  let where = `type = 'story' AND deleted = 0 AND ${PUBLIC}`;
  if (topic) {
    where += ' AND topic = ?';
    params.push(topic);
  }
  const items = await getDb().all(
    `SELECT ${STORY_COLUMNS} FROM items WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    ...params,
    limit,
    offset,
  );
  const { total } = await getDb().get(`SELECT COUNT(*) AS total FROM items WHERE ${where}`, ...params);
  return { items, total };
}

export async function byKind(kind, { limit = PAGE_SIZE, offset = 0, now = nowSeconds() } = {}) {
  const candidates = await getDb().all(
    `SELECT ${STORY_COLUMNS} FROM items
     WHERE type = 'story' AND kind = ? AND deleted = 0 AND dead = 0 AND ${PUBLIC}
     ORDER BY created_at DESC LIMIT ${RANK_POOL}`,
    kind,
  );
  const ranked = rankStories(candidates, now);
  return { items: ranked.slice(offset, offset + limit), total: ranked.length };
}

export async function byDomain(domain, { limit = PAGE_SIZE, offset = 0 } = {}) {
  const items = await getDb().all(
    `SELECT ${STORY_COLUMNS} FROM items
     WHERE type = 'story' AND domain = ? AND deleted = 0 AND ${PUBLIC}
     ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    domain,
    limit,
    offset,
  );
  const { total } = await getDb().get(
    `SELECT COUNT(*) AS total FROM items WHERE type = 'story' AND domain = ? AND deleted = 0 AND ${PUBLIC}`,
    domain,
  );
  return { items, total };
}

/** Every story an agent has posted, newest first. */
export async function byAgent(agent, { limit = PAGE_SIZE, offset = 0 } = {}) {
  const items = await getDb().all(
    `SELECT ${STORY_COLUMNS} FROM items
     WHERE type = 'story' AND agent = ? AND deleted = 0 AND ${PUBLIC}
     ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    agent,
    limit,
    offset,
  );
  const { total } = await getDb().get(
    `SELECT COUNT(*) AS total FROM items WHERE type = 'story' AND agent = ? AND deleted = 0 AND ${PUBLIC}`,
    agent,
  );
  return { items, total };
}

/** Everything a given person put on the board, whoever posted it for them. */
export async function surfacedBy(userId, { limit = PAGE_SIZE, offset = 0 } = {}) {
  const items = await getDb().all(
    `SELECT ${STORY_COLUMNS} FROM items
     WHERE type = 'story' AND surfaced_by = ? COLLATE NOCASE AND deleted = 0 AND ${PUBLIC}
     ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    userId,
    limit,
    offset,
  );
  const { total } = await getDb().get(
    `SELECT COUNT(*) AS total FROM items
     WHERE type = 'story' AND surfaced_by = ? COLLATE NOCASE AND deleted = 0 AND ${PUBLIC}`,
    userId,
  );
  return { items, total };
}

/** Duplicate detection: has this exact link been posted recently? */
export async function findByUrl(url, { withinDays = 14 } = {}) {
  return getDb().get(
    `SELECT ${STORY_COLUMNS} FROM items
     WHERE type = 'story' AND url = ? AND deleted = 0 AND created_at > ?
     ORDER BY created_at DESC LIMIT 1`,
    url,
    nowSeconds() - withinDays * 86400,
  );
}

export async function bestStories({ limit = PAGE_SIZE, offset = 0, days = 30 } = {}) {
  const cutoff = nowSeconds() - days * 86400;
  const items = await getDb().all(
    `SELECT ${STORY_COLUMNS} FROM items
     WHERE type = 'story' AND deleted = 0 AND dead = 0 AND ${PUBLIC} AND created_at > ?
     ORDER BY points DESC, created_at DESC LIMIT ? OFFSET ?`,
    cutoff,
    limit,
    offset,
  );
  const { total } = await getDb().get(
    `SELECT COUNT(*) AS total FROM items
     WHERE type = 'story' AND deleted = 0 AND dead = 0 AND ${PUBLIC} AND created_at > ?`,
    cutoff,
  );
  return { items, total };
}

/** The window's highest-scoring stories — what Biopunk Live opens with. */
export async function topInWindow({ from, to, limit = 10 }) {
  return getDb().all(
    `SELECT ${STORY_COLUMNS} FROM items
     WHERE type = 'story' AND deleted = 0 AND dead = 0 AND ${PUBLIC}
       AND created_at >= ? AND created_at < ?
     ORDER BY points DESC, comment_count DESC, created_at ASC LIMIT ?`,
    from,
    to,
    limit,
  );
}

export async function userSubmissions(userId, { limit = PAGE_SIZE, offset = 0 } = {}) {
  const items = await getDb().all(
    `SELECT ${STORY_COLUMNS} FROM items
     WHERE type = 'story' AND by = ? COLLATE NOCASE AND deleted = 0
     ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    userId,
    limit,
    offset,
  );
  const { total } = await getDb().get(
    "SELECT COUNT(*) AS total FROM items WHERE type = 'story' AND by = ? COLLATE NOCASE AND deleted = 0",
    userId,
  );
  return { items, total };
}

export async function userComments(userId, { limit = PAGE_SIZE, offset = 0 } = {}) {
  const items = await getDb().all(
    `SELECT ${STORY_COLUMNS} FROM items
     WHERE type = 'comment' AND by = ? COLLATE NOCASE AND deleted = 0
     ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    userId,
    limit,
    offset,
  );
  const { total } = await getDb().get(
    "SELECT COUNT(*) AS total FROM items WHERE type = 'comment' AND by = ? COLLATE NOCASE AND deleted = 0",
    userId,
  );
  return { items, total };
}

export async function recentComments({ limit = PAGE_SIZE, offset = 0 } = {}) {
  const items = await getDb().all(
    `SELECT ${STORY_COLUMNS} FROM items
     WHERE type = 'comment' AND deleted = 0 AND dead = 0
     ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    limit,
    offset,
  );
  const { total } = await getDb().get(
    "SELECT COUNT(*) AS total FROM items WHERE type = 'comment' AND deleted = 0 AND dead = 0",
  );
  return { items, total };
}

export async function search(query, { limit = PAGE_SIZE, offset = 0 } = {}) {
  const needle = `%${String(query).trim().replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  const where = `deleted = 0 AND dead = 0 AND ${PUBLIC} AND (
      title LIKE ? ESCAPE '\\' OR text LIKE ? ESCAPE '\\' OR domain LIKE ? ESCAPE '\\'
    )`;
  const items = await getDb().all(
    `SELECT ${STORY_COLUMNS} FROM items WHERE ${where}
     ORDER BY (type = 'story') DESC, points DESC, created_at DESC LIMIT ? OFFSET ?`,
    needle,
    needle,
    needle,
    limit,
    offset,
  );
  const { total } = await getDb().get(
    `SELECT COUNT(*) AS total FROM items WHERE ${where}`,
    needle,
    needle,
    needle,
  );
  return { items, total };
}

/* ----------------------------------------------------------- comment tree */

/** All comments on a story, ordered as a depth-first tree by score then time. */
export async function commentTree(storyId) {
  const rows = await getDb().all(
    `SELECT ${STORY_COLUMNS} FROM items
     WHERE type = 'comment' AND story_id = ?
     ORDER BY points DESC, created_at ASC`,
    storyId,
  );

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
export async function withStoryTitles(comments) {
  const ids = [...new Set(comments.map((c) => c.story_id).filter(Boolean))];
  if (ids.length === 0) return comments;
  const rows = await getDb().all(
    `SELECT id, title FROM items WHERE id IN (${ids.map(() => '?').join(',')})`,
    ...ids,
  );
  const titles = new Map(rows.map((r) => [r.id, r.title]));
  for (const comment of comments) comment.story_title = titles.get(comment.story_id) ?? null;
  return comments;
}

/** Parents of a comment, oldest ancestor first — used for breadcrumbs. */
export async function ancestors(item) {
  const chain = [];
  let current = item;
  while (current?.parent_id) {
    current = await getItem(current.parent_id);
    if (!current) break;
    chain.unshift(current);
  }
  return chain;
}

/** Story counts by origin since a cutoff — used by the standing stat line. */
export async function postedSince(cutoff) {
  const row = await getDb().get(
    `SELECT
       SUM(CASE WHEN source = 'agent' THEN 1 ELSE 0 END) AS agent,
       SUM(CASE WHEN source != 'agent' THEN 1 ELSE 0 END) AS human
     FROM items WHERE type = 'story' AND deleted = 0 AND ${PUBLIC} AND created_at >= ?`,
    cutoff,
  );
  return { agent: row.agent ?? 0, human: row.human ?? 0 };
}

export async function siteStats() {
  const db = getDb();
  const [users, stories, comments, votes, scouts] = await Promise.all([
    db.get('SELECT COUNT(*) AS n FROM users'),
    db.get(`SELECT COUNT(*) AS n FROM items WHERE type = 'story' AND deleted = 0 AND ${PUBLIC}`),
    db.get("SELECT COUNT(*) AS n FROM items WHERE type = 'comment' AND deleted = 0"),
    db.get('SELECT COUNT(*) AS n FROM votes'),
    db.get("SELECT COUNT(*) AS n FROM users WHERE role = 'scout'"),
  ]);
  return {
    users: users.n,
    stories: stories.n,
    comments: comments.n,
    votes: votes.n,
    scouts: scouts.n,
  };
}
