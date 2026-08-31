/*
 * Homeroom data layer. Same house rules as src/models.js: plain prepared
 * statements, transactions for anything that touches two tables, and no
 * ORM anywhere near it.
 */

import { getDb, transaction } from './db.js';
import { nowSeconds } from './util.js';

export const PAGE_SIZE = 20;

/* ------------------------------------------------------------ taxonomies */

export const CATEGORIES = [
  { slug: 'wetlab', label: 'Wet Lab', blurb: 'Protocols that fight back, reagents, contamination, the bench itself.' },
  { slug: 'dry', label: 'Dry Lab', blurb: 'Pipelines, models, sequence analysis, compute, data wrangling.' },
  { slug: 'hardware', label: 'Hardware', blurb: 'Builds, teardowns, sourcing, calibration, things that go in a rack.' },
  { slug: 'biosafety', label: 'Biosafety', blurb: 'Containment, risk assessment, IBC review, when to say no.' },
  { slug: 'regulatory', label: 'Regulatory', blurb: 'FDA, IRB, IACUC, export control, permits, customs.' },
  { slug: 'funding', label: 'Funding', blurb: 'Grants, SBIR, angels, prizes, terms, dilution.' },
  { slug: 'legal', label: 'Legal & IP', blurb: 'Patents, MTAs, incorporation, licensing, contracts.' },
  { slug: 'hiring', label: 'Hiring', blurb: 'Finding people, comp, contractors, first scientific hires.' },
  { slug: 'space', label: 'Space & Ops', blurb: 'Leases, community labs, waste, insurance, freezers.' },
  { slug: 'intros', label: 'Intros', blurb: 'Who knows whom. Ask for a warm path in.' },
  { slug: 'life', label: 'Founder Life', blurb: 'Burnout, cofounder trouble, the long middle. Talk plainly.' },
  { slug: 'general', label: 'General', blurb: 'Everything the other channels do not cover.' },
];

const CATEGORY_SLUGS = new Set(CATEGORIES.map((c) => c.slug));

export const POST_KINDS = [
  { slug: 'question', label: 'Question', hint: 'You need an answer. Others can mark one.' },
  { slug: 'discussion', label: 'Discussion', hint: 'Open-ended. No single right answer.' },
  { slug: 'intro', label: 'Intro request', hint: 'You want a warm path to a person or an org.' },
  { slug: 'show', label: 'Show', hint: 'Something you built or grew.' },
  { slug: 'announce', label: 'Announcement', hint: 'News from your lab the network should know.' },
  { slug: 'poll', label: 'Poll', hint: 'Count hands. Add options below.' },
  { slug: 'launch', label: 'Launch', hint: 'You are shipping. Ask for the first users.' },
];

const POST_KIND_SLUGS = new Set(POST_KINDS.map((k) => k.slug));

export const ORG_KINDS = [
  { slug: 'startup', label: 'Startup' },
  { slug: 'communitylab', label: 'Community lab' },
  { slug: 'academic', label: 'Academic lab' },
  { slug: 'foundry', label: 'Biofoundry' },
  { slug: 'nonprofit', label: 'Nonprofit' },
  { slug: 'collective', label: 'Collective' },
  { slug: 'solo', label: 'Solo / garage' },
];

export const ORG_STAGES = [
  { slug: 'idea', label: 'Idea' },
  { slug: 'bench', label: 'At the bench' },
  { slug: 'prototype', label: 'Prototype' },
  { slug: 'preclinical', label: 'Preclinical' },
  { slug: 'revenue', label: 'Revenue' },
  { slug: 'clinical', label: 'Clinical' },
  { slug: 'scaling', label: 'Scaling' },
];

export const FUNDER_KINDS = [
  { slug: 'vc', label: 'Venture fund' },
  { slug: 'angel', label: 'Angel' },
  { slug: 'grant', label: 'Grant programme' },
  { slug: 'foundation', label: 'Foundation' },
  { slug: 'prize', label: 'Prize' },
  { slug: 'accelerator', label: 'Accelerator' },
  { slug: 'dao', label: 'DAO / collective' },
];

export const PIPELINE_STATUSES = [
  { slug: 'researching', label: 'Researching' },
  { slug: 'intro', label: 'Intro requested' },
  { slug: 'pitched', label: 'Pitched' },
  { slug: 'diligence', label: 'Diligence' },
  { slug: 'committed', label: 'Committed' },
  { slug: 'passed', label: 'Passed' },
  { slug: 'closed', label: 'Closed' },
];

export const DEAL_CATEGORIES = [
  { slug: 'reagents', label: 'Reagents' },
  { slug: 'sequencing', label: 'Sequencing' },
  { slug: 'synthesis', label: 'DNA synthesis' },
  { slug: 'cloudlab', label: 'Cloud lab' },
  { slug: 'compute', label: 'Compute' },
  { slug: 'equipment', label: 'Equipment' },
  { slug: 'software', label: 'Software' },
  { slug: 'services', label: 'Legal & services' },
  { slug: 'other', label: 'Other' },
];

export const JOB_DISCIPLINES = [
  { slug: 'wetlab', label: 'Wet lab' },
  { slug: 'computational', label: 'Computational' },
  { slug: 'engineering', label: 'Software / hardware' },
  { slug: 'ops', label: 'Lab ops' },
  { slug: 'regulatory', label: 'Regulatory / QA' },
  { slug: 'bizdev', label: 'Business' },
  { slug: 'other', label: 'Other' },
];

export const EVENT_KINDS = [
  { slug: 'meetup', label: 'Meetup' },
  { slug: 'talk', label: 'Talk' },
  { slug: 'workshop', label: 'Workshop' },
  { slug: 'demoday', label: 'Demo day' },
  { slug: 'openlab', label: 'Open lab' },
  { slug: 'online', label: 'Online' },
];

export const LIBRARY_KINDS = [
  { slug: 'guide', label: 'Guide' },
  { slug: 'protocol', label: 'Protocol' },
  { slug: 'essay', label: 'Essay' },
  { slug: 'template', label: 'Template' },
];

export const EXPERTISE_SUGGESTIONS = [
  'crispr', 'cloning', 'protein-expression', 'cell-culture', 'microscopy', 'flow-cytometry',
  'ngs', 'nanopore', 'mass-spec', 'fermentation', 'bioreactors', 'microfluidics',
  'protein-design', 'ml-for-bio', 'structural-biology', 'metagenomics', 'plant-bio',
  'synthetic-genomics', 'biosafety', 'irb', 'fda', 'export-control', 'patents', 'mta',
  'grant-writing', 'sbir', 'fundraising', 'lab-buildout', 'freezer-ops', 'diybio-outreach',
];

export function categoryLabel(slug) {
  return CATEGORIES.find((c) => c.slug === slug)?.label ?? null;
}

export function normalizeCategory(slug) {
  return CATEGORY_SLUGS.has(slug) ? slug : 'general';
}

export function normalizeKind(slug) {
  return POST_KIND_SLUGS.has(slug) ? slug : 'question';
}

export function labelFor(list, slug, fallback = '') {
  return list.find((entry) => entry.slug === slug)?.label ?? fallback;
}

/* ---------------------------------------------------------------- helpers */

const int = (value) => (value ? 1 : 0);

export function slugify(text, fallback = 'x') {
  const base = String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return base || fallback;
}

/** Make `slugify` output unique inside a table, appending -2, -3, ... */
function uniqueSlug(table, text, fallback) {
  const base = slugify(text, fallback);
  const db = getDb();
  let candidate = base;
  let n = 2;
  while (db.prepare(`SELECT 1 FROM ${table} WHERE slug = ?`).get(candidate)) {
    candidate = `${base}-${n++}`;
    if (n > 500) return `${base}-${Date.now()}`;
  }
  return candidate;
}

/** Comma or space separated free tags, cleaned and capped. */
export function parseTags(input, max = 6) {
  if (!input) return [];
  const seen = new Set();
  for (const piece of String(input).split(/[,\n]+/)) {
    const tag = slugify(piece.trim(), '');
    if (tag && !seen.has(tag)) seen.add(tag);
    if (seen.size >= max) break;
  }
  return [...seen];
}

export function tagList(value) {
  return String(value || '').split(',').map((t) => t.trim()).filter(Boolean);
}

function like(query) {
  return `%${String(query).trim().replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
}

function placeholders(n) {
  return Array.from({ length: n }, () => '?').join(',');
}

/* --------------------------------------------------------------- accounts */

export function createUser({ id, email, passwordHash, isAdmin = false }) {
  const now = nowSeconds();
  getDb()
    .prepare('INSERT INTO users (id, email, password_hash, karma, created_at, is_admin) VALUES (?, ?, ?, 1, ?, ?)')
    .run(id, email ? String(email).trim().toLowerCase() : null, passwordHash, now, isAdmin ? 1 : 0);
  return getUser(id);
}

export function getUser(id) {
  if (!id) return null;
  return getDb().prepare('SELECT * FROM users WHERE id = ? COLLATE NOCASE').get(id) ?? null;
}

export function getUserByEmail(email) {
  if (!email) return null;
  return getDb()
    .prepare('SELECT * FROM users WHERE email = ?')
    .get(String(email).trim().toLowerCase()) ?? null;
}

export function setPassword(userId, passwordHash) {
  getDb().prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, userId);
}

export function userCount() {
  return getDb().prepare('SELECT COUNT(*) AS n FROM users').get().n;
}

/* ---------------------------------------------------------------- members */

const MEMBER_COLUMNS = `m.*, u.karma AS karma, u.created_at AS user_created_at, u.is_admin AS is_admin`;

/** Every logged-in user gets a Homeroom profile the first time they arrive. */
export function ensureMember(userId, defaults = {}) {
  const existing = getMember(userId);
  if (existing) return existing;
  const now = nowSeconds();
  getDb()
    .prepare(
      `INSERT INTO hr_members (user_id, name, headline, org, role, cohort, location, bio,
                               working_on, ask_me_about, links, bsl, joined_at, updated_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      userId,
      defaults.name || '',
      defaults.headline || '',
      defaults.org || '',
      defaults.role || '',
      defaults.cohort || null,
      defaults.location || '',
      defaults.bio || '',
      defaults.working_on || '',
      defaults.ask_me_about || '',
      defaults.links || '',
      defaults.bsl || null,
      now,
      now,
      now,
    );
  return getMember(userId);
}

export function getMember(userId) {
  if (!userId) return null;
  const row = getDb()
    .prepare(
      `SELECT ${MEMBER_COLUMNS} FROM hr_members m
       JOIN users u ON u.id = m.user_id
       WHERE m.user_id = ? COLLATE NOCASE`,
    )
    .get(userId);
  if (!row) return null;
  row.expertise = memberExpertise(row.user_id);
  return row;
}

export function memberExpertise(userId) {
  return getDb()
    .prepare('SELECT tag FROM hr_expertise WHERE user_id = ? ORDER BY tag')
    .all(userId)
    .map((r) => r.tag);
}

export function updateMember(userId, patch) {
  const fields = [
    'name', 'headline', 'org', 'role', 'cohort', 'location', 'bio',
    'working_on', 'ask_me_about', 'links', 'bsl',
  ];
  const sets = [];
  const values = [];
  for (const field of fields) {
    if (patch[field] === undefined) continue;
    sets.push(`${field} = ?`);
    values.push(patch[field] === null ? null : String(patch[field]));
  }
  for (const flag of ['open_intros', 'open_hours', 'open_collab', 'open_hiring']) {
    if (patch[flag] === undefined) continue;
    sets.push(`${flag} = ?`);
    values.push(int(patch[flag]));
  }
  if (sets.length) {
    sets.push('updated_at = ?');
    values.push(nowSeconds(), userId);
    getDb().prepare(`UPDATE hr_members SET ${sets.join(', ')} WHERE user_id = ?`).run(...values);
  }
  if (Array.isArray(patch.expertise)) setExpertise(userId, patch.expertise);
  return getMember(userId);
}

export function setExpertise(userId, tags) {
  transaction((db) => {
    db.prepare('DELETE FROM hr_expertise WHERE user_id = ?').run(userId);
    const insert = db.prepare('INSERT OR IGNORE INTO hr_expertise (user_id, tag) VALUES (?, ?)');
    for (const tag of tags.slice(0, 12)) if (tag) insert.run(userId, tag);
  });
}

export function touchMember(userId) {
  getDb().prepare('UPDATE hr_members SET last_seen_at = ? WHERE user_id = ?').run(nowSeconds(), userId);
}

/**
 * The member directory. Every filter is optional and they compose, which is
 * the whole point of the thing: "protein-design people in Berlin open to
 * office hours" is one query, not a spreadsheet.
 */
export function searchMembers({
  q = '', tag = '', cohort = '', location = '', open = '',
  limit = PAGE_SIZE, offset = 0,
} = {}) {
  const where = ['1 = 1'];
  const params = [];
  if (q) {
    where.push(`(m.user_id LIKE ? ESCAPE '\\' OR m.name LIKE ? ESCAPE '\\' OR m.headline LIKE ? ESCAPE '\\'
                 OR m.bio LIKE ? ESCAPE '\\' OR m.org LIKE ? ESCAPE '\\' OR m.working_on LIKE ? ESCAPE '\\'
                 OR m.ask_me_about LIKE ? ESCAPE '\\')`);
    params.push(...Array(7).fill(like(q)));
  }
  if (tag) {
    where.push('EXISTS (SELECT 1 FROM hr_expertise e WHERE e.user_id = m.user_id AND e.tag = ?)');
    params.push(tag);
  }
  if (cohort) {
    where.push('m.cohort = ?');
    params.push(cohort);
  }
  if (location) {
    where.push(`m.location LIKE ? ESCAPE '\\'`);
    params.push(like(location));
  }
  const openColumn = { intros: 'open_intros', hours: 'open_hours', collab: 'open_collab', hiring: 'open_hiring' }[open];
  if (openColumn) where.push(`m.${openColumn} = 1`);

  const clause = where.join(' AND ');
  const rows = getDb()
    .prepare(
      `SELECT ${MEMBER_COLUMNS} FROM hr_members m
       JOIN users u ON u.id = m.user_id
       WHERE ${clause}
       ORDER BY u.karma DESC, m.joined_at ASC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset);
  for (const row of rows) row.expertise = memberExpertise(row.user_id);
  const { total } = getDb()
    .prepare(`SELECT COUNT(*) AS total FROM hr_members m JOIN users u ON u.id = m.user_id WHERE ${clause}`)
    .get(...params);
  return { members: rows, total };
}

export function expertiseCloud(limit = 40) {
  return getDb()
    .prepare(
      `SELECT tag, COUNT(*) AS count FROM hr_expertise
       GROUP BY tag ORDER BY count DESC, tag ASC LIMIT ?`,
    )
    .all(limit);
}

export function cohorts() {
  return getDb()
    .prepare(
      `SELECT cohort, COUNT(*) AS count FROM hr_members
       WHERE cohort IS NOT NULL AND cohort <> '' GROUP BY cohort ORDER BY cohort DESC`,
    )
    .all();
}

/* ------------------------------------------------------------------- labs */

export function createOrg({ name, tagline = '', description = '', kind = 'startup', stage = 'idea',
  location = '', website = null, cohort = null, founded = null, headcount = null, tags = '', createdBy }) {
  const now = nowSeconds();
  return transaction((db) => {
    const slug = uniqueSlug('hr_orgs', name, 'lab');
    const info = db
      .prepare(
        `INSERT INTO hr_orgs (slug, name, tagline, description, kind, stage, location, website,
                              cohort, founded, headcount, tags, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(slug, name, tagline, description, kind, stage, location, website, cohort,
        founded ?? null, headcount ?? null, tags, createdBy, now, now);
    const id = Number(info.lastInsertRowid);
    db.prepare('INSERT INTO hr_org_members (org_id, user_id, role, admin, joined_at) VALUES (?, ?, ?, 1, ?)')
      .run(id, createdBy, 'founder', now);
    return id;
  });
}

export function getOrg(idOrSlug) {
  const db = getDb();
  const row = /^\d+$/.test(String(idOrSlug))
    ? db.prepare('SELECT * FROM hr_orgs WHERE id = ?').get(Number(idOrSlug))
    : db.prepare('SELECT * FROM hr_orgs WHERE slug = ?').get(String(idOrSlug));
  return row ?? null;
}

export function updateOrg(id, patch) {
  const fields = ['name', 'tagline', 'description', 'kind', 'stage', 'location', 'website', 'cohort', 'tags'];
  const sets = [];
  const values = [];
  for (const field of fields) {
    if (patch[field] === undefined) continue;
    sets.push(`${field} = ?`);
    values.push(patch[field] === null ? null : String(patch[field]));
  }
  for (const field of ['founded', 'headcount']) {
    if (patch[field] === undefined) continue;
    sets.push(`${field} = ?`);
    values.push(patch[field] === null || patch[field] === '' ? null : Number(patch[field]));
  }
  if (!sets.length) return getOrg(id);
  sets.push('updated_at = ?');
  values.push(nowSeconds(), id);
  getDb().prepare(`UPDATE hr_orgs SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  return getOrg(id);
}

export function orgTeam(orgId) {
  return getDb()
    .prepare(
      `SELECT om.role, om.admin, om.joined_at, m.*, u.karma
       FROM hr_org_members om
       JOIN users u ON u.id = om.user_id
       LEFT JOIN hr_members m ON m.user_id = om.user_id
       WHERE om.org_id = ? ORDER BY om.admin DESC, om.joined_at ASC`,
    )
    .all(orgId);
}

export function joinOrg(orgId, userId, role = '') {
  getDb()
    .prepare('INSERT OR IGNORE INTO hr_org_members (org_id, user_id, role, admin, joined_at) VALUES (?, ?, ?, 0, ?)')
    .run(orgId, userId, role, nowSeconds());
}

export function leaveOrg(orgId, userId) {
  getDb().prepare('DELETE FROM hr_org_members WHERE org_id = ? AND user_id = ?').run(orgId, userId);
}

export function isOrgAdmin(orgId, userId) {
  if (!userId) return false;
  const row = getDb()
    .prepare('SELECT admin FROM hr_org_members WHERE org_id = ? AND user_id = ?')
    .get(orgId, userId);
  return !!row?.admin;
}

export function isOrgMember(orgId, userId) {
  if (!userId) return false;
  return !!getDb().prepare('SELECT 1 FROM hr_org_members WHERE org_id = ? AND user_id = ?').get(orgId, userId);
}

export function userOrgs(userId) {
  return getDb()
    .prepare(
      `SELECT o.*, om.role, om.admin FROM hr_org_members om
       JOIN hr_orgs o ON o.id = om.org_id
       WHERE om.user_id = ? ORDER BY om.joined_at DESC`,
    )
    .all(userId);
}

export function searchOrgs({ q = '', kind = '', stage = '', tag = '', limit = PAGE_SIZE, offset = 0 } = {}) {
  const where = ['1 = 1'];
  const params = [];
  if (q) {
    where.push(`(name LIKE ? ESCAPE '\\' OR tagline LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\' OR location LIKE ? ESCAPE '\\')`);
    params.push(...Array(4).fill(like(q)));
  }
  if (kind) { where.push('kind = ?'); params.push(kind); }
  if (stage) { where.push('stage = ?'); params.push(stage); }
  if (tag) { where.push(`(',' || replace(tags, ' ', '') || ',') LIKE ? ESCAPE '\\'`); params.push(`%,${tag},%`); }
  const clause = where.join(' AND ');
  const orgs = getDb()
    .prepare(
      `SELECT o.*, (SELECT COUNT(*) FROM hr_org_members om WHERE om.org_id = o.id) AS team_count
       FROM hr_orgs o WHERE ${clause} ORDER BY o.created_at DESC LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset);
  const { total } = getDb().prepare(`SELECT COUNT(*) AS total FROM hr_orgs WHERE ${clause}`).get(...params);
  return { orgs, total };
}

/* ---------------------------------------------------------------- updates */

export function createUpdate({ orgId, authorId, period = '', body, asks = '', metrics = '' }) {
  const info = getDb()
    .prepare(
      `INSERT INTO hr_updates (org_id, author_id, period, body, asks, metrics, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(orgId, authorId, period, body, asks, metrics, nowSeconds());
  return Number(info.lastInsertRowid);
}

export function orgUpdates(orgId, { limit = 10, offset = 0 } = {}) {
  return getDb()
    .prepare('SELECT * FROM hr_updates WHERE org_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?')
    .all(orgId, limit, offset);
}

export function recentUpdates(limit = 8) {
  return getDb()
    .prepare(
      `SELECT up.*, o.name AS org_name, o.slug AS org_slug FROM hr_updates up
       JOIN hr_orgs o ON o.id = up.org_id ORDER BY up.created_at DESC LIMIT ?`,
    )
    .all(limit);
}

/* ------------------------------------------------------------------ posts */

export function createPost({ authorId, kind = 'question', category = 'general', title, body = '',
  orgId = null, anonymous = false, tags = [], options = [] }) {
  const now = nowSeconds();
  return transaction((db) => {
    const info = db
      .prepare(
        `INSERT INTO hr_posts (author_id, kind, category, title, body, org_id, anonymous,
                               points, comment_count, created_at, last_active_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?)`,
      )
      .run(authorId, kind, category, title, body, orgId, int(anonymous), now, now);
    const id = Number(info.lastInsertRowid);
    db.prepare('INSERT INTO hr_votes (user_id, target_kind, target_id, created_at) VALUES (?, ?, ?, ?)')
      .run(authorId, 'post', id, now);
    const insertTag = db.prepare('INSERT OR IGNORE INTO hr_post_tags (post_id, tag) VALUES (?, ?)');
    for (const tag of tags) insertTag.run(id, tag);
    if (kind === 'poll') {
      const insertOption = db.prepare('INSERT INTO hr_poll_options (post_id, label, position) VALUES (?, ?, ?)');
      options.slice(0, 8).forEach((label, i) => insertOption.run(id, label, i));
    }
    db.prepare('INSERT OR IGNORE INTO hr_follows (user_id, target_kind, target_id, created_at) VALUES (?, ?, ?, ?)')
      .run(authorId, 'post', String(id), now);
    return id;
  });
}

const POST_COLUMNS = `p.*, o.name AS org_name, o.slug AS org_slug`;

export function getPost(id) {
  const numeric = Number(id);
  if (!Number.isInteger(numeric)) return null;
  const row = getDb()
    .prepare(`SELECT ${POST_COLUMNS} FROM hr_posts p LEFT JOIN hr_orgs o ON o.id = p.org_id WHERE p.id = ?`)
    .get(numeric);
  if (!row) return null;
  row.tags = getDb().prepare('SELECT tag FROM hr_post_tags WHERE post_id = ? ORDER BY tag').all(row.id).map((r) => r.tag);
  return row;
}

export function bumpViews(postId) {
  getDb().prepare('UPDATE hr_posts SET view_count = view_count + 1 WHERE id = ?').run(postId);
}

export function editPost(id, { title, body, category, tags }) {
  transaction((db) => {
    db.prepare('UPDATE hr_posts SET title = ?, body = ?, category = ?, edited_at = ? WHERE id = ?')
      .run(title, body, category, nowSeconds(), id);
    if (Array.isArray(tags)) {
      db.prepare('DELETE FROM hr_post_tags WHERE post_id = ?').run(id);
      const insert = db.prepare('INSERT OR IGNORE INTO hr_post_tags (post_id, tag) VALUES (?, ?)');
      for (const tag of tags) insert.run(id, tag);
    }
  });
  return getPost(id);
}

export function deletePost(id) {
  getDb().prepare('UPDATE hr_posts SET deleted = 1 WHERE id = ?').run(id);
}

export function setPinned(id, pinned) {
  getDb().prepare('UPDATE hr_posts SET pinned = ? WHERE id = ?').run(int(pinned), id);
}

export function setLocked(id, locked) {
  getDb().prepare('UPDATE hr_posts SET locked = ? WHERE id = ?').run(int(locked), id);
}

export function markAnswer(postId, commentId) {
  getDb().prepare('UPDATE hr_posts SET answer_id = ? WHERE id = ?').run(commentId, postId);
}

/**
 * Forum ranking. Same gravity idea as the news feed, but discussion is worth
 * much more here — an answered question is the product — and a question with
 * no answers yet floats so it does not die unseen.
 */
export function postScore(post, now = nowSeconds()) {
  const ageHours = Math.max(0, (now - post.created_at) / 3600);
  const base = (post.points - 1) + 0.75 * post.comment_count;
  let score = (base + 1) / (ageHours + 2) ** 1.5;
  if (post.kind === 'question' && post.comment_count === 0 && ageHours < 48) score *= 1.6;
  if (post.answer_id) score *= 1.15;
  return score;
}

export function feed({ sort = 'hot', category = '', kind = '', tag = '', unanswered = false,
  author = '', orgId = 0, limit = PAGE_SIZE, offset = 0 } = {}) {
  const where = ['p.deleted = 0'];
  const params = [];
  if (category) { where.push('p.category = ?'); params.push(category); }
  if (kind) { where.push('p.kind = ?'); params.push(kind); }
  if (author) { where.push('p.author_id = ? COLLATE NOCASE'); params.push(author); }
  if (orgId) { where.push('p.org_id = ?'); params.push(orgId); }
  if (unanswered) where.push('p.comment_count = 0');
  if (tag) {
    where.push('EXISTS (SELECT 1 FROM hr_post_tags t WHERE t.post_id = p.id AND t.tag = ?)');
    params.push(tag);
  }
  const clause = where.join(' AND ');
  const db = getDb();
  const { total } = db.prepare(`SELECT COUNT(*) AS total FROM hr_posts p WHERE ${clause}`).get(...params);

  if (sort === 'hot') {
    // Rank a recent candidate pool in JS, exactly like the news front page.
    const pool = db
      .prepare(
        `SELECT ${POST_COLUMNS} FROM hr_posts p LEFT JOIN hr_orgs o ON o.id = p.org_id
         WHERE ${clause} ORDER BY p.last_active_at DESC LIMIT 400`,
      )
      .all(...params);
    const now = nowSeconds();
    pool.sort((a, b) => (b.pinned - a.pinned) || (postScore(b, now) - postScore(a, now)));
    return { posts: withTags(pool.slice(offset, offset + limit)), total };
  }

  const order = {
    new: 'p.created_at DESC',
    active: 'p.last_active_at DESC',
    top: 'p.points DESC, p.created_at DESC',
    discussed: 'p.comment_count DESC, p.created_at DESC',
  }[sort] || 'p.created_at DESC';

  const posts = db
    .prepare(
      `SELECT ${POST_COLUMNS} FROM hr_posts p LEFT JOIN hr_orgs o ON o.id = p.org_id
       WHERE ${clause} ORDER BY p.pinned DESC, ${order} LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset);
  return { posts: withTags(posts), total };
}

/** One extra query for a whole page of tags instead of one per row. */
function withTags(posts) {
  if (!posts.length) return posts;
  const ids = posts.map((p) => p.id);
  const rows = getDb()
    .prepare(`SELECT post_id, tag FROM hr_post_tags WHERE post_id IN (${placeholders(ids.length)}) ORDER BY tag`)
    .all(...ids);
  const byPost = new Map(ids.map((id) => [id, []]));
  for (const row of rows) byPost.get(row.post_id)?.push(row.tag);
  for (const post of posts) post.tags = byPost.get(post.id) || [];
  return posts;
}

export function tagCloud(limit = 30) {
  return getDb()
    .prepare(
      `SELECT t.tag, COUNT(*) AS count FROM hr_post_tags t
       JOIN hr_posts p ON p.id = t.post_id AND p.deleted = 0
       GROUP BY t.tag ORDER BY count DESC, t.tag ASC LIMIT ?`,
    )
    .all(limit);
}

export function categoryCounts() {
  const rows = getDb()
    .prepare('SELECT category, COUNT(*) AS count FROM hr_posts WHERE deleted = 0 GROUP BY category')
    .all();
  return Object.fromEntries(rows.map((r) => [r.category, r.count]));
}

/* --------------------------------------------------------------- comments */

export function createComment({ postId, parentId = null, authorId, body, anonymous = false }) {
  const now = nowSeconds();
  return transaction((db) => {
    let depth = 0;
    if (parentId) {
      const parent = db.prepare('SELECT depth, post_id FROM hr_comments WHERE id = ?').get(parentId);
      if (!parent || parent.post_id !== postId) throw new Error('parent comment does not belong to this post');
      depth = Math.min(parent.depth + 1, 12);
    }
    const info = db
      .prepare(
        `INSERT INTO hr_comments (post_id, parent_id, author_id, body, depth, points, anonymous, created_at)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
      )
      .run(postId, parentId, authorId, body, depth, int(anonymous), now);
    const id = Number(info.lastInsertRowid);
    db.prepare('INSERT INTO hr_votes (user_id, target_kind, target_id, created_at) VALUES (?, ?, ?, ?)')
      .run(authorId, 'comment', id, now);
    db.prepare('UPDATE hr_posts SET comment_count = comment_count + 1, last_active_at = ? WHERE id = ?')
      .run(now, postId);
    return id;
  });
}

export function getComment(id) {
  const numeric = Number(id);
  if (!Number.isInteger(numeric)) return null;
  return getDb().prepare('SELECT * FROM hr_comments WHERE id = ?').get(numeric) ?? null;
}

/** Flat, pre-ordered comment tree: best-scoring subtree first, then oldest. */
export function commentTree(postId) {
  const rows = getDb()
    .prepare('SELECT * FROM hr_comments WHERE post_id = ? ORDER BY points DESC, created_at ASC')
    .all(postId);
  const byParent = new Map();
  for (const row of rows) {
    const key = row.parent_id ?? 0;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(row);
  }
  const out = [];
  const walk = (parent) => {
    for (const row of byParent.get(parent) || []) {
      out.push(row);
      walk(row.id);
    }
  };
  walk(0);
  return out;
}

export function editComment(id, body) {
  getDb().prepare('UPDATE hr_comments SET body = ?, edited_at = ? WHERE id = ?').run(body, nowSeconds(), id);
}

export function deleteComment(id) {
  getDb().prepare("UPDATE hr_comments SET deleted = 1, body = '' WHERE id = ?").run(id);
}

export function userComments(userId, { limit = PAGE_SIZE, offset = 0 } = {}) {
  return getDb()
    .prepare(
      `SELECT c.*, p.title AS post_title FROM hr_comments c
       JOIN hr_posts p ON p.id = c.post_id
       WHERE c.author_id = ? COLLATE NOCASE AND c.deleted = 0
       ORDER BY c.created_at DESC LIMIT ? OFFSET ?`,
    )
    .all(userId, limit, offset);
}

/* ------------------------------------------------------------------ votes */

export function hasVoted(userId, kind, targetId) {
  if (!userId) return false;
  return !!getDb()
    .prepare('SELECT 1 FROM hr_votes WHERE user_id = ? AND target_kind = ? AND target_id = ?')
    .get(userId, kind, targetId);
}

export function votedIds(userId, kind, ids) {
  if (!userId || !ids.length) return new Set();
  const rows = getDb()
    .prepare(
      `SELECT target_id FROM hr_votes
       WHERE user_id = ? AND target_kind = ? AND target_id IN (${placeholders(ids.length)})`,
    )
    .all(userId, kind, ...ids);
  return new Set(rows.map((r) => r.target_id));
}

const VOTE_TABLES = { post: 'hr_posts', comment: 'hr_comments' };
const VOTE_AUTHOR = { post: 'author_id', comment: 'author_id' };

export function vote(userId, kind, targetId) {
  const table = VOTE_TABLES[kind];
  if (!table) return { ok: false, error: 'unknown target' };
  const row = getDb().prepare(`SELECT ${VOTE_AUTHOR[kind]} AS author_id, points, deleted FROM ${table} WHERE id = ?`).get(targetId);
  if (!row || row.deleted) return { ok: false, error: 'no such item' };
  if (row.author_id === userId) return { ok: false, error: 'you cannot upvote your own post', points: row.points };
  if (hasVoted(userId, kind, targetId)) return { ok: true, points: row.points, voted: true };
  const points = transaction((db) => {
    db.prepare('INSERT INTO hr_votes (user_id, target_kind, target_id, created_at) VALUES (?, ?, ?, ?)')
      .run(userId, kind, targetId, nowSeconds());
    db.prepare(`UPDATE ${table} SET points = points + 1 WHERE id = ?`).run(targetId);
    db.prepare('UPDATE users SET karma = karma + 1 WHERE id = ?').run(row.author_id);
    return db.prepare(`SELECT points FROM ${table} WHERE id = ?`).get(targetId).points;
  });
  return { ok: true, points, voted: true };
}

export function unvote(userId, kind, targetId) {
  const table = VOTE_TABLES[kind];
  if (!table) return { ok: false, error: 'unknown target' };
  const row = getDb().prepare(`SELECT ${VOTE_AUTHOR[kind]} AS author_id, points FROM ${table} WHERE id = ?`).get(targetId);
  if (!row) return { ok: false, error: 'no such item' };
  if (!hasVoted(userId, kind, targetId)) return { ok: true, points: row.points, voted: false };
  const points = transaction((db) => {
    db.prepare('DELETE FROM hr_votes WHERE user_id = ? AND target_kind = ? AND target_id = ?')
      .run(userId, kind, targetId);
    db.prepare(`UPDATE ${table} SET points = MAX(points - 1, 0) WHERE id = ?`).run(targetId);
    db.prepare('UPDATE users SET karma = MAX(karma - 1, 0) WHERE id = ?').run(row.author_id);
    return db.prepare(`SELECT points FROM ${table} WHERE id = ?`).get(targetId).points;
  });
  return { ok: true, points, voted: false };
}

/* -------------------------------------------------- saves, follows, polls */

function toggleRow(table, userId, kind, targetId) {
  const db = getDb();
  const existing = db
    .prepare(`SELECT 1 FROM ${table} WHERE user_id = ? AND target_kind = ? AND target_id = ?`)
    .get(userId, kind, String(targetId));
  if (existing) {
    db.prepare(`DELETE FROM ${table} WHERE user_id = ? AND target_kind = ? AND target_id = ?`)
      .run(userId, kind, String(targetId));
    return false;
  }
  db.prepare(`INSERT INTO ${table} (user_id, target_kind, target_id, created_at) VALUES (?, ?, ?, ?)`)
    .run(userId, kind, String(targetId), nowSeconds());
  return true;
}

export const toggleSave = (userId, kind, targetId) => toggleRow('hr_saves', userId, kind, targetId);
export const toggleFollow = (userId, kind, targetId) => toggleRow('hr_follows', userId, kind, targetId);

export function isSaved(userId, kind, targetId) {
  if (!userId) return false;
  return !!getDb()
    .prepare('SELECT 1 FROM hr_saves WHERE user_id = ? AND target_kind = ? AND target_id = ?')
    .get(userId, kind, String(targetId));
}

export function isFollowing(userId, kind, targetId) {
  if (!userId) return false;
  return !!getDb()
    .prepare('SELECT 1 FROM hr_follows WHERE user_id = ? AND target_kind = ? AND target_id = ?')
    .get(userId, kind, String(targetId));
}

export function followers(kind, targetId) {
  return getDb()
    .prepare('SELECT user_id FROM hr_follows WHERE target_kind = ? AND target_id = ?')
    .all(kind, String(targetId))
    .map((r) => r.user_id);
}

export function savedPosts(userId, { limit = PAGE_SIZE, offset = 0 } = {}) {
  const posts = getDb()
    .prepare(
      `SELECT ${POST_COLUMNS} FROM hr_saves s
       JOIN hr_posts p ON p.id = CAST(s.target_id AS INTEGER)
       LEFT JOIN hr_orgs o ON o.id = p.org_id
       WHERE s.user_id = ? AND s.target_kind = 'post' AND p.deleted = 0
       ORDER BY s.created_at DESC LIMIT ? OFFSET ?`,
    )
    .all(userId, limit, offset);
  return withTags(posts);
}

export function pollOptions(postId) {
  return getDb().prepare('SELECT * FROM hr_poll_options WHERE post_id = ? ORDER BY position, id').all(postId);
}

export function castPollVote(postId, userId, optionId) {
  return transaction((db) => {
    const option = db.prepare('SELECT * FROM hr_poll_options WHERE id = ? AND post_id = ?').get(optionId, postId);
    if (!option) return { ok: false, error: 'no such option' };
    const previous = db.prepare('SELECT option_id FROM hr_poll_votes WHERE post_id = ? AND user_id = ?').get(postId, userId);
    if (previous?.option_id === optionId) return { ok: true, changed: false };
    if (previous) {
      db.prepare('UPDATE hr_poll_options SET votes = MAX(votes - 1, 0) WHERE id = ?').run(previous.option_id);
      db.prepare('UPDATE hr_poll_votes SET option_id = ?, created_at = ? WHERE post_id = ? AND user_id = ?')
        .run(optionId, nowSeconds(), postId, userId);
    } else {
      db.prepare('INSERT INTO hr_poll_votes (post_id, user_id, option_id, created_at) VALUES (?, ?, ?, ?)')
        .run(postId, userId, optionId, nowSeconds());
    }
    db.prepare('UPDATE hr_poll_options SET votes = votes + 1 WHERE id = ?').run(optionId);
    return { ok: true, changed: true };
  });
}

export function myPollVote(postId, userId) {
  if (!userId) return null;
  return getDb().prepare('SELECT option_id FROM hr_poll_votes WHERE post_id = ? AND user_id = ?').get(postId, userId)?.option_id ?? null;
}

/* ------------------------------------------------------------------ deals */

export function createDeal({ vendor, title, category = 'other', summary = '', details = '',
  worth = '', code = '', url = null, expiresAt = null, postedBy }) {
  const slug = uniqueSlug('hr_deals', `${vendor}-${title}`, 'deal');
  const info = getDb()
    .prepare(
      `INSERT INTO hr_deals (slug, vendor, title, category, summary, details, worth, code, url, expires_at, posted_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(slug, vendor, title, category, summary, details, worth, code, url, expiresAt, postedBy, nowSeconds());
  return Number(info.lastInsertRowid);
}

export function getDeal(idOrSlug) {
  const db = getDb();
  return (/^\d+$/.test(String(idOrSlug))
    ? db.prepare('SELECT * FROM hr_deals WHERE id = ?').get(Number(idOrSlug))
    : db.prepare('SELECT * FROM hr_deals WHERE slug = ?').get(String(idOrSlug))) ?? null;
}

export function listDeals({ category = '', q = '', limit = 100, offset = 0 } = {}) {
  const where = ['active = 1'];
  const params = [];
  if (category) { where.push('category = ?'); params.push(category); }
  if (q) {
    where.push(`(vendor LIKE ? ESCAPE '\\' OR title LIKE ? ESCAPE '\\' OR summary LIKE ? ESCAPE '\\')`);
    params.push(...Array(3).fill(like(q)));
  }
  const clause = where.join(' AND ');
  const deals = getDb()
    .prepare(
      `SELECT d.*, (SELECT COUNT(*) FROM hr_deal_claims c WHERE c.deal_id = d.id) AS claim_count
       FROM hr_deals d WHERE ${clause} ORDER BY d.created_at DESC LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset);
  const { total } = getDb().prepare(`SELECT COUNT(*) AS total FROM hr_deals WHERE ${clause}`).get(...params);
  return { deals, total };
}

export function claimDeal(dealId, userId) {
  getDb()
    .prepare('INSERT OR IGNORE INTO hr_deal_claims (deal_id, user_id, created_at) VALUES (?, ?, ?)')
    .run(dealId, userId, nowSeconds());
  return getDeal(dealId);
}

export function dealClaimCount(dealId) {
  return getDb().prepare('SELECT COUNT(*) AS n FROM hr_deal_claims WHERE deal_id = ?').get(dealId).n;
}

export function hasClaimed(dealId, userId) {
  if (!userId) return false;
  return !!getDb().prepare('SELECT 1 FROM hr_deal_claims WHERE deal_id = ? AND user_id = ?').get(dealId, userId);
}

export function myClaims(userId) {
  return getDb()
    .prepare(
      `SELECT d.*, c.created_at AS claimed_at FROM hr_deal_claims c
       JOIN hr_deals d ON d.id = c.deal_id WHERE c.user_id = ? ORDER BY c.created_at DESC`,
    )
    .all(userId);
}

/* ---------------------------------------------------------------- funders */

export function createFunder({ name, kind = 'vc', focus = '', stages = '', checkSize = '',
  location = '', website = null, description = '', dilutive = true, addedBy = null }) {
  const slug = uniqueSlug('hr_funders', name, 'funder');
  const info = getDb()
    .prepare(
      `INSERT INTO hr_funders (slug, name, kind, focus, stages, check_size, location, website, description, dilutive, added_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(slug, name, kind, focus, stages, checkSize, location, website, description, int(dilutive), addedBy, nowSeconds());
  return Number(info.lastInsertRowid);
}

export function getFunder(idOrSlug) {
  const db = getDb();
  const row = /^\d+$/.test(String(idOrSlug))
    ? db.prepare('SELECT * FROM hr_funders WHERE id = ?').get(Number(idOrSlug))
    : db.prepare('SELECT * FROM hr_funders WHERE slug = ?').get(String(idOrSlug));
  if (!row) return null;
  return { ...row, ...funderRatings(row.id) };
}

export function funderRatings(funderId) {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS review_count, AVG(rating) AS avg_rating,
              AVG(speed) AS avg_speed, AVG(value_add) AS avg_value
       FROM hr_funder_reviews WHERE funder_id = ?`,
    )
    .get(funderId);
  return {
    review_count: row.review_count,
    avg_rating: row.avg_rating ? Math.round(row.avg_rating * 10) / 10 : null,
    avg_speed: row.avg_speed ? Math.round(row.avg_speed * 10) / 10 : null,
    avg_value: row.avg_value ? Math.round(row.avg_value * 10) / 10 : null,
  };
}

export function listFunders({ q = '', kind = '', stage = '', minRating = 0, sort = 'rating',
  limit = PAGE_SIZE, offset = 0 } = {}) {
  const where = ['1 = 1'];
  const params = [];
  if (q) {
    where.push(`(f.name LIKE ? ESCAPE '\\' OR f.focus LIKE ? ESCAPE '\\' OR f.description LIKE ? ESCAPE '\\' OR f.location LIKE ? ESCAPE '\\')`);
    params.push(...Array(4).fill(like(q)));
  }
  if (kind) { where.push('f.kind = ?'); params.push(kind); }
  if (stage) { where.push(`f.stages LIKE ? ESCAPE '\\'`); params.push(like(stage)); }
  const clause = where.join(' AND ');
  const order = {
    rating: 'avg_rating DESC NULLS LAST, review_count DESC',
    reviews: 'review_count DESC, avg_rating DESC NULLS LAST',
    name: 'name ASC',
    new: 'created_at DESC',
  }[sort] || 'avg_rating DESC NULLS LAST, review_count DESC';
  // The rating filter has to sit outside, where the correlated averages exist.
  const scored = `SELECT f.*,
            (SELECT COUNT(*) FROM hr_funder_reviews r WHERE r.funder_id = f.id) AS review_count,
            (SELECT ROUND(AVG(rating), 1) FROM hr_funder_reviews r WHERE r.funder_id = f.id) AS avg_rating
     FROM hr_funders f WHERE ${clause}`;
  const funders = getDb()
    .prepare(`SELECT * FROM (${scored}) WHERE COALESCE(avg_rating, 0) >= ? ORDER BY ${order} LIMIT ? OFFSET ?`)
    .all(...params, minRating, limit, offset);
  const { total } = getDb()
    .prepare(`SELECT COUNT(*) AS total FROM (${scored}) WHERE COALESCE(avg_rating, 0) >= ?`)
    .get(...params, minRating);
  return { funders, total };
}

export function upsertReview({ funderId, userId, rating, speed = null, valueAdd = null,
  invested = false, anonymous = true, body = '' }) {
  getDb()
    .prepare(
      `INSERT INTO hr_funder_reviews (funder_id, user_id, rating, speed, value_add, invested, anonymous, body, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (funder_id, user_id) DO UPDATE SET
         rating = excluded.rating, speed = excluded.speed, value_add = excluded.value_add,
         invested = excluded.invested, anonymous = excluded.anonymous, body = excluded.body,
         created_at = excluded.created_at`,
    )
    .run(funderId, userId, rating, speed, valueAdd, int(invested), int(anonymous), body, nowSeconds());
}

export function funderReviews(funderId) {
  return getDb()
    .prepare('SELECT * FROM hr_funder_reviews WHERE funder_id = ? ORDER BY created_at DESC')
    .all(funderId);
}

export function myReview(funderId, userId) {
  if (!userId) return null;
  return getDb().prepare('SELECT * FROM hr_funder_reviews WHERE funder_id = ? AND user_id = ?').get(funderId, userId) ?? null;
}

/* --------------------------------------------------------------- pipeline */

export function upsertPipeline({ userId, funderId, orgId = null, status = 'researching', amount = '', notes = '' }) {
  const now = nowSeconds();
  getDb()
    .prepare(
      `INSERT INTO hr_pipeline (user_id, funder_id, org_id, status, amount, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id, funder_id) DO UPDATE SET
         org_id = excluded.org_id, status = excluded.status, amount = excluded.amount,
         notes = excluded.notes, updated_at = excluded.updated_at`,
    )
    .run(userId, funderId, orgId, status, amount, notes, now, now);
}

export function removePipeline(userId, funderId) {
  getDb().prepare('DELETE FROM hr_pipeline WHERE user_id = ? AND funder_id = ?').run(userId, funderId);
}

export function pipeline(userId) {
  return getDb()
    .prepare(
      `SELECT pl.*, f.name AS funder_name, f.slug AS funder_slug, f.kind AS funder_kind,
              (SELECT ROUND(AVG(rating), 1) FROM hr_funder_reviews r WHERE r.funder_id = f.id) AS avg_rating
       FROM hr_pipeline pl JOIN hr_funders f ON f.id = pl.funder_id
       WHERE pl.user_id = ? ORDER BY pl.updated_at DESC`,
    )
    .all(userId);
}

export function pipelineEntry(userId, funderId) {
  if (!userId) return null;
  return getDb().prepare('SELECT * FROM hr_pipeline WHERE user_id = ? AND funder_id = ?').get(userId, funderId) ?? null;
}

/* ----------------------------------------------------------- office hours */

export function createSlot({ hostId, title, description = '', format = 'one-on-one',
  startsAt, minutes = 30, capacity = 1, place = '', topics = '' }) {
  const info = getDb()
    .prepare(
      `INSERT INTO hr_slots (host_id, title, description, format, starts_at, minutes, capacity, place, topics, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(hostId, title, description, format, startsAt, minutes, Math.max(1, capacity), place, topics, nowSeconds());
  return Number(info.lastInsertRowid);
}

export function getSlot(id) {
  const row = getDb().prepare('SELECT * FROM hr_slots WHERE id = ?').get(Number(id));
  if (!row) return null;
  row.booked = getDb().prepare('SELECT COUNT(*) AS n FROM hr_bookings WHERE slot_id = ?').get(row.id).n;
  return row;
}

export function listSlots({ upcoming = true, hostId = '', limit = 60 } = {}) {
  const where = ['canceled = 0'];
  const params = [];
  if (upcoming) { where.push('starts_at > ?'); params.push(nowSeconds() - 3600); }
  if (hostId) { where.push('host_id = ?'); params.push(hostId); }
  return getDb()
    .prepare(
      `SELECT s.*, (SELECT COUNT(*) FROM hr_bookings b WHERE b.slot_id = s.id) AS booked
       FROM hr_slots s WHERE ${where.join(' AND ')}
       ORDER BY s.starts_at ${upcoming ? 'ASC' : 'DESC'} LIMIT ?`,
    )
    .all(...params, limit);
}

export function bookSlot(slotId, userId, question = '') {
  return transaction((db) => {
    const slot = db.prepare('SELECT * FROM hr_slots WHERE id = ?').get(slotId);
    if (!slot || slot.canceled) return { ok: false, error: 'no such slot' };
    if (slot.host_id === userId) return { ok: false, error: 'you are hosting this one' };
    if (slot.starts_at < nowSeconds()) return { ok: false, error: 'that slot has already happened' };
    const { n } = db.prepare('SELECT COUNT(*) AS n FROM hr_bookings WHERE slot_id = ?').get(slotId);
    const mine = db.prepare('SELECT 1 FROM hr_bookings WHERE slot_id = ? AND user_id = ?').get(slotId, userId);
    if (mine) return { ok: true, already: true };
    if (n >= slot.capacity) return { ok: false, error: 'that slot is full' };
    db.prepare('INSERT INTO hr_bookings (slot_id, user_id, question, created_at) VALUES (?, ?, ?, ?)')
      .run(slotId, userId, question, nowSeconds());
    return { ok: true, hostId: slot.host_id };
  });
}

export function cancelBooking(slotId, userId) {
  getDb().prepare('DELETE FROM hr_bookings WHERE slot_id = ? AND user_id = ?').run(slotId, userId);
}

export function cancelSlot(slotId) {
  getDb().prepare('UPDATE hr_slots SET canceled = 1 WHERE id = ?').run(slotId);
}

export function slotBookings(slotId) {
  return getDb().prepare('SELECT * FROM hr_bookings WHERE slot_id = ? ORDER BY created_at').all(slotId);
}

export function myBookings(userId) {
  return getDb()
    .prepare(
      `SELECT s.*, b.question, b.created_at AS booked_at FROM hr_bookings b
       JOIN hr_slots s ON s.id = b.slot_id
       WHERE b.user_id = ? AND s.canceled = 0 ORDER BY s.starts_at ASC`,
    )
    .all(userId);
}

/* ------------------------------------------------------------------- jobs */

export function createJob({ orgId, postedBy, title, discipline = 'other', employment = 'full-time',
  location = '', remote = false, comp = '', equity = '', description = '', tags = '' }) {
  const info = getDb()
    .prepare(
      `INSERT INTO hr_jobs (org_id, posted_by, title, discipline, employment, location, remote, comp, equity, description, tags, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(orgId, postedBy, title, discipline, employment, location, int(remote), comp, equity, description, tags, nowSeconds());
  return Number(info.lastInsertRowid);
}

export function getJob(id) {
  return getDb()
    .prepare(
      `SELECT j.*, o.name AS org_name, o.slug AS org_slug, o.kind AS org_kind
       FROM hr_jobs j JOIN hr_orgs o ON o.id = j.org_id WHERE j.id = ?`,
    )
    .get(Number(id)) ?? null;
}

export function listJobs({ q = '', discipline = '', remote = false, orgId = 0, limit = 60, offset = 0 } = {}) {
  const where = ['j.closed = 0'];
  const params = [];
  if (q) {
    where.push(`(j.title LIKE ? ESCAPE '\\' OR j.description LIKE ? ESCAPE '\\' OR o.name LIKE ? ESCAPE '\\')`);
    params.push(...Array(3).fill(like(q)));
  }
  if (discipline) { where.push('j.discipline = ?'); params.push(discipline); }
  if (remote) where.push('j.remote = 1');
  if (orgId) { where.push('j.org_id = ?'); params.push(orgId); }
  const clause = where.join(' AND ');
  const jobs = getDb()
    .prepare(
      `SELECT j.*, o.name AS org_name, o.slug AS org_slug,
              (SELECT COUNT(*) FROM hr_applications a WHERE a.job_id = j.id) AS applicant_count
       FROM hr_jobs j JOIN hr_orgs o ON o.id = j.org_id
       WHERE ${clause} ORDER BY j.created_at DESC LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset);
  const { total } = getDb()
    .prepare(`SELECT COUNT(*) AS total FROM hr_jobs j JOIN hr_orgs o ON o.id = j.org_id WHERE ${clause}`)
    .get(...params);
  return { jobs, total };
}

export function applyToJob(jobId, userId, note = '') {
  getDb()
    .prepare('INSERT OR IGNORE INTO hr_applications (job_id, user_id, note, created_at) VALUES (?, ?, ?, ?)')
    .run(jobId, userId, note, nowSeconds());
}

export function hasApplied(jobId, userId) {
  if (!userId) return false;
  return !!getDb().prepare('SELECT 1 FROM hr_applications WHERE job_id = ? AND user_id = ?').get(jobId, userId);
}

export function jobApplicants(jobId) {
  return getDb()
    .prepare(
      `SELECT a.*, m.name, m.headline FROM hr_applications a
       LEFT JOIN hr_members m ON m.user_id = a.user_id
       WHERE a.job_id = ? ORDER BY a.created_at DESC`,
    )
    .all(jobId);
}

export function closeJob(id, closed = true) {
  getDb().prepare('UPDATE hr_jobs SET closed = ? WHERE id = ?').run(int(closed), id);
}

/* ----------------------------------------------------------------- events */

export function createEvent({ hostId, title, description = '', kind = 'meetup', startsAt,
  minutes = 90, place = '', url = null, capacity = 0 }) {
  const info = getDb()
    .prepare(
      `INSERT INTO hr_events (host_id, title, description, kind, starts_at, minutes, place, url, capacity, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(hostId, title, description, kind, startsAt, minutes, place, url, capacity, nowSeconds());
  return Number(info.lastInsertRowid);
}

export function getEvent(id) {
  const row = getDb().prepare('SELECT * FROM hr_events WHERE id = ?').get(Number(id));
  if (!row) return null;
  row.going = getDb().prepare("SELECT COUNT(*) AS n FROM hr_rsvps WHERE event_id = ? AND status = 'going'").get(row.id).n;
  return row;
}

export function listEvents({ upcoming = true, kind = '', limit = 60 } = {}) {
  const where = ['canceled = 0'];
  const params = [];
  if (upcoming) { where.push('starts_at > ?'); params.push(nowSeconds() - 7200); }
  else { where.push('starts_at <= ?'); params.push(nowSeconds()); }
  if (kind) { where.push('kind = ?'); params.push(kind); }
  return getDb()
    .prepare(
      `SELECT e.*, (SELECT COUNT(*) FROM hr_rsvps r WHERE r.event_id = e.id AND r.status = 'going') AS going
       FROM hr_events e WHERE ${where.join(' AND ')}
       ORDER BY e.starts_at ${upcoming ? 'ASC' : 'DESC'} LIMIT ?`,
    )
    .all(...params, limit);
}

export function rsvp(eventId, userId, status = 'going') {
  const now = nowSeconds();
  if (status === 'none') {
    getDb().prepare('DELETE FROM hr_rsvps WHERE event_id = ? AND user_id = ?').run(eventId, userId);
    return;
  }
  getDb()
    .prepare(
      `INSERT INTO hr_rsvps (event_id, user_id, status, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (event_id, user_id) DO UPDATE SET status = excluded.status`,
    )
    .run(eventId, userId, status, now);
}

export function myRsvp(eventId, userId) {
  if (!userId) return null;
  return getDb().prepare('SELECT status FROM hr_rsvps WHERE event_id = ? AND user_id = ?').get(eventId, userId)?.status ?? null;
}

export function eventAttendees(eventId) {
  return getDb()
    .prepare(
      `SELECT r.user_id, r.status, m.name, m.headline FROM hr_rsvps r
       LEFT JOIN hr_members m ON m.user_id = r.user_id
       WHERE r.event_id = ? ORDER BY r.created_at`,
    )
    .all(eventId);
}

export function cancelEvent(id) {
  getDb().prepare('UPDATE hr_events SET canceled = 1 WHERE id = ?').run(id);
}

/* ---------------------------------------------------------------- library */

export function createLibraryEntry({ title, kind = 'guide', summary = '', body = '', tags = '', authorId = null }) {
  const now = nowSeconds();
  const slug = uniqueSlug('hr_library', title, 'entry');
  const info = getDb()
    .prepare(
      `INSERT INTO hr_library (slug, title, kind, summary, body, tags, author_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(slug, title, kind, summary, body, tags, authorId, now, now);
  return Number(info.lastInsertRowid);
}

export function getLibraryEntry(idOrSlug) {
  const db = getDb();
  return (/^\d+$/.test(String(idOrSlug))
    ? db.prepare('SELECT * FROM hr_library WHERE id = ?').get(Number(idOrSlug))
    : db.prepare('SELECT * FROM hr_library WHERE slug = ?').get(String(idOrSlug))) ?? null;
}

export function listLibrary({ q = '', kind = '', limit = 60, offset = 0 } = {}) {
  const where = ['1 = 1'];
  const params = [];
  if (q) {
    where.push(`(title LIKE ? ESCAPE '\\' OR summary LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\' OR tags LIKE ? ESCAPE '\\')`);
    params.push(...Array(4).fill(like(q)));
  }
  if (kind) { where.push('kind = ?'); params.push(kind); }
  const clause = where.join(' AND ');
  const entries = getDb()
    .prepare(`SELECT * FROM hr_library WHERE ${clause} ORDER BY updated_at DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset);
  const { total } = getDb().prepare(`SELECT COUNT(*) AS total FROM hr_library WHERE ${clause}`).get(...params);
  return { entries, total };
}

export function bumpReads(id) {
  getDb().prepare('UPDATE hr_library SET reads = reads + 1 WHERE id = ?').run(id);
}

/* ----------------------------------------------------------------- intros */

export function requestIntro({ requesterId, targetId, reason }) {
  const existing = getDb()
    .prepare("SELECT id FROM hr_intros WHERE requester_id = ? AND target_id = ? AND status = 'pending'")
    .get(requesterId, targetId);
  if (existing) return { ok: false, error: 'you already have a pending request to this member', id: existing.id };
  const info = getDb()
    .prepare('INSERT INTO hr_intros (requester_id, target_id, reason, created_at) VALUES (?, ?, ?, ?)')
    .run(requesterId, targetId, reason, nowSeconds());
  return { ok: true, id: Number(info.lastInsertRowid) };
}

export function getIntro(id) {
  return getDb().prepare('SELECT * FROM hr_intros WHERE id = ?').get(Number(id)) ?? null;
}

/**
 * Accepting an intro opens a message thread with both members in it — the
 * request is only useful if it ends in a conversation.
 */
export function resolveIntro(id, status) {
  const intro = getIntro(id);
  if (!intro || intro.status !== 'pending') return null;
  getDb().prepare('UPDATE hr_intros SET status = ?, resolved_at = ? WHERE id = ?').run(status, nowSeconds(), id);
  if (status !== 'accepted') return { intro, threadId: null };
  const threadId = createThread({
    createdBy: intro.target_id,
    subject: `Intro: ${intro.requester_id} ↔ ${intro.target_id}`,
    memberIds: [intro.requester_id, intro.target_id],
  });
  sendMessage({ threadId, senderId: intro.target_id, body: `Happy to talk. Context from the request:\n\n${intro.reason}` });
  return { intro, threadId };
}

export function introsFor(userId) {
  const db = getDb();
  return {
    incoming: db.prepare('SELECT * FROM hr_intros WHERE target_id = ? ORDER BY created_at DESC LIMIT 50').all(userId),
    outgoing: db.prepare('SELECT * FROM hr_intros WHERE requester_id = ? ORDER BY created_at DESC LIMIT 50').all(userId),
  };
}

export function pendingIntroCount(userId) {
  return getDb()
    .prepare("SELECT COUNT(*) AS n FROM hr_intros WHERE target_id = ? AND status = 'pending'")
    .get(userId).n;
}

/* --------------------------------------------------------------- messages */

export function createThread({ createdBy, subject = '', memberIds = [] }) {
  const now = nowSeconds();
  return transaction((db) => {
    const info = db
      .prepare('INSERT INTO hr_threads (subject, created_by, created_at, last_at) VALUES (?, ?, ?, ?)')
      .run(subject, createdBy, now, now);
    const id = Number(info.lastInsertRowid);
    const insert = db.prepare('INSERT OR IGNORE INTO hr_thread_members (thread_id, user_id, last_read_at) VALUES (?, ?, ?)');
    for (const member of new Set([createdBy, ...memberIds])) insert.run(id, member, member === createdBy ? now : 0);
    return id;
  });
}

/** One-to-one threads are reused so a DM list does not sprout duplicates. */
export function findDirectThread(a, b) {
  return getDb()
    .prepare(
      `SELECT t.id FROM hr_threads t
       JOIN hr_thread_members m1 ON m1.thread_id = t.id AND m1.user_id = ?
       JOIN hr_thread_members m2 ON m2.thread_id = t.id AND m2.user_id = ?
       WHERE (SELECT COUNT(*) FROM hr_thread_members m WHERE m.thread_id = t.id) = 2
       ORDER BY t.id LIMIT 1`,
    )
    .get(a, b)?.id ?? null;
}

export function openDirectThread(a, b) {
  return findDirectThread(a, b) ?? createThread({ createdBy: a, subject: '', memberIds: [b] });
}

export function sendMessage({ threadId, senderId, body }) {
  const now = nowSeconds();
  return transaction((db) => {
    const member = db.prepare('SELECT 1 FROM hr_thread_members WHERE thread_id = ? AND user_id = ?').get(threadId, senderId);
    if (!member) throw new Error('not a member of this thread');
    const info = db
      .prepare('INSERT INTO hr_messages (thread_id, sender_id, body, created_at) VALUES (?, ?, ?, ?)')
      .run(threadId, senderId, body, now);
    db.prepare('UPDATE hr_threads SET last_at = ? WHERE id = ?').run(now, threadId);
    db.prepare('UPDATE hr_thread_members SET last_read_at = ? WHERE thread_id = ? AND user_id = ?')
      .run(now, threadId, senderId);
    return Number(info.lastInsertRowid);
  });
}

export function threadsFor(userId) {
  const rows = getDb()
    .prepare(
      `SELECT t.*, tm.last_read_at,
              (SELECT COUNT(*) FROM hr_messages m WHERE m.thread_id = t.id AND m.created_at > tm.last_read_at
                AND m.sender_id <> ?) AS unread,
              (SELECT body FROM hr_messages m WHERE m.thread_id = t.id ORDER BY m.created_at DESC LIMIT 1) AS last_body,
              (SELECT sender_id FROM hr_messages m WHERE m.thread_id = t.id ORDER BY m.created_at DESC LIMIT 1) AS last_sender
       FROM hr_thread_members tm JOIN hr_threads t ON t.id = tm.thread_id
       WHERE tm.user_id = ? ORDER BY t.last_at DESC LIMIT 100`,
    )
    .all(userId, userId);
  for (const row of rows) row.members = threadMembers(row.id);
  return rows;
}

export function threadMembers(threadId) {
  return getDb()
    .prepare('SELECT user_id FROM hr_thread_members WHERE thread_id = ?')
    .all(threadId)
    .map((r) => r.user_id);
}

export function getThread(threadId, userId) {
  const thread = getDb().prepare('SELECT * FROM hr_threads WHERE id = ?').get(Number(threadId));
  if (!thread) return null;
  const members = threadMembers(thread.id);
  if (userId && !members.includes(userId)) return null;
  thread.members = members;
  thread.messages = getDb()
    .prepare('SELECT * FROM hr_messages WHERE thread_id = ? ORDER BY created_at ASC LIMIT 500')
    .all(thread.id);
  return thread;
}

export function markThreadRead(threadId, userId) {
  getDb()
    .prepare('UPDATE hr_thread_members SET last_read_at = ? WHERE thread_id = ? AND user_id = ?')
    .run(nowSeconds(), threadId, userId);
}

export function unreadMessageCount(userId) {
  return getDb()
    .prepare(
      `SELECT COUNT(*) AS n FROM hr_messages m
       JOIN hr_thread_members tm ON tm.thread_id = m.thread_id AND tm.user_id = ?
       WHERE m.created_at > tm.last_read_at AND m.sender_id <> ?`,
    )
    .get(userId, userId).n;
}

/* ---------------------------------------------------------- notifications */

export function notify({ userId, kind, actorId = null, text, href = '/homeroom' }) {
  if (!userId || userId === actorId) return null;
  const info = getDb()
    .prepare('INSERT INTO hr_notifications (user_id, kind, actor_id, text, href, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(userId, kind, actorId, text, href, nowSeconds());
  return Number(info.lastInsertRowid);
}

/** Fan a thread reply out to everyone following the post. */
export function notifyFollowers({ postId, actorId, text, href }) {
  for (const userId of followers('post', postId)) {
    notify({ userId, kind: 'reply', actorId, text, href });
  }
}

export function notifications(userId, { limit = 50 } = {}) {
  return getDb()
    .prepare('SELECT * FROM hr_notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?')
    .all(userId, limit);
}

export function unreadNotificationCount(userId) {
  return getDb()
    .prepare('SELECT COUNT(*) AS n FROM hr_notifications WHERE user_id = ? AND read_at IS NULL')
    .get(userId).n;
}

export function markNotificationsRead(userId) {
  getDb().prepare('UPDATE hr_notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL')
    .run(nowSeconds(), userId);
}

/* ------------------------------------------------------- search and stats */

/** One box over posts, members, labs, funders, deals and the library. */
export function globalSearch(query, { limit = 8 } = {}) {
  const q = String(query || '').trim();
  if (!q) return { posts: [], members: [], orgs: [], funders: [], deals: [], library: [] };
  const needle = like(q);
  const db = getDb();
  return {
    posts: withTags(
      db
        .prepare(
          `SELECT ${POST_COLUMNS} FROM hr_posts p LEFT JOIN hr_orgs o ON o.id = p.org_id
           WHERE p.deleted = 0 AND (p.title LIKE ? ESCAPE '\\' OR p.body LIKE ? ESCAPE '\\')
           ORDER BY p.points DESC, p.created_at DESC LIMIT ?`,
        )
        .all(needle, needle, limit),
    ),
    members: searchMembers({ q, limit }).members,
    orgs: searchOrgs({ q, limit }).orgs,
    funders: listFunders({ q, limit }).funders,
    deals: listDeals({ q, limit }).deals,
    library: listLibrary({ q, limit }).entries,
  };
}

export function networkStats() {
  const db = getDb();
  const one = (sql, ...params) => db.prepare(sql).get(...params);
  return {
    members: one('SELECT COUNT(*) AS n FROM hr_members').n,
    orgs: one('SELECT COUNT(*) AS n FROM hr_orgs').n,
    posts: one('SELECT COUNT(*) AS n FROM hr_posts WHERE deleted = 0').n,
    comments: one('SELECT COUNT(*) AS n FROM hr_comments WHERE deleted = 0').n,
    deals: one('SELECT COUNT(*) AS n FROM hr_deals WHERE active = 1').n,
    funders: one('SELECT COUNT(*) AS n FROM hr_funders').n,
    reviews: one('SELECT COUNT(*) AS n FROM hr_funder_reviews').n,
    jobs: one('SELECT COUNT(*) AS n FROM hr_jobs WHERE closed = 0').n,
    slots: one('SELECT COUNT(*) AS n FROM hr_slots WHERE canceled = 0 AND starts_at > ?', nowSeconds()).n,
    events: one('SELECT COUNT(*) AS n FROM hr_events WHERE canceled = 0 AND starts_at > ?', nowSeconds()).n,
    library: one('SELECT COUNT(*) AS n FROM hr_library').n,
  };
}

/** Small leaderboard for the home rail: who is actually answering things. */
export function topAnswerers(limit = 6, sinceDays = 30) {
  const since = nowSeconds() - sinceDays * 86400;
  return getDb()
    .prepare(
      `SELECT c.author_id AS user_id, COUNT(*) AS answers, SUM(c.points) AS points
       FROM hr_comments c
       WHERE c.deleted = 0 AND c.anonymous = 0 AND c.created_at > ?
       GROUP BY c.author_id ORDER BY points DESC, answers DESC LIMIT ?`,
    )
    .all(since, limit);
}
