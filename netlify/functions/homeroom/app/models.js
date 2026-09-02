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

/*
 * The capital map's own categories, not a generic investor-type list: a founder
 * looking for the first money asks "what kind of money is this", and a grant, a
 * fellowship and a studio are three different answers.
 */
export { CAPITAL_KINDS as FUNDER_KINDS } from './data/funders.js';

export const PIPELINE_STATUSES = [
  { slug: 'researching', label: 'Researching' },
  { slug: 'intro', label: 'Intro requested' },
  { slug: 'pitched', label: 'Pitched' },
  { slug: 'diligence', label: 'Diligence' },
  { slug: 'committed', label: 'Committed' },
  { slug: 'passed', label: 'Passed' },
  { slug: 'closed', label: 'Closed' },
];

/* Perks span every category of startup support, not just the lab bench. */
export { PERK_CATEGORIES as DEAL_CATEGORIES } from './data/perks.js';
export { MENTOR_TRACKS } from './data/mentors.js';
export { LAB_STATUSES, LAB_KINDS } from './data/atlas.js';

/** How a perk is actually redeemed, which is the field founders need first. */
export const PERK_ACCESS = [
  { slug: 'open', label: 'Free to all' },
  { slug: 'code', label: 'Discount code' },
  { slug: 'apply', label: 'Apply direct' },
  { slug: 'partner', label: 'Via a partner' },
];

/**
 * The tags a reviewer can put on a funder review.
 *
 * A fixed vocabulary rather than free text, because the value of the tag is
 * that three reviews carrying it become a countable pattern — which free text
 * never does.
 */
export const REVIEW_TAGS = [
  { slug: 'fast-decision', label: 'Fast decision' },
  { slug: 'slow-process', label: 'Slow process' },
  { slug: 'ghosted', label: 'Ghosted me' },
  { slug: 'deeply-technical', label: 'Deeply technical' },
  { slug: 'great-intros', label: 'Great intros' },
  { slug: 'hands-off', label: 'Hands off' },
  { slug: 'hands-on', label: 'Hands on' },
  { slug: 'clean-terms', label: 'Clean terms' },
  { slug: 'heavy-terms', label: 'Heavy terms' },
  { slug: 'free-consulting', label: 'Mined me for free consulting' },
  { slug: 'helpful-pass', label: 'Passed, and told me why' },
  { slug: 'kept-word', label: 'Kept their word' },
];

export const REVIEW_OUTCOMES = [
  { slug: 'invested', label: 'They invested' },
  { slug: 'passed', label: 'They passed' },
  { slug: 'no-answer', label: 'Never answered' },
  { slug: 'in-progress', label: 'Still in process' },
  { slug: 'i-passed', label: 'I passed on them' },
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
  worth = '', code = '', url = null, expiresAt = null, postedBy,
  access = 'code', requirement = '', checked = '' }) {
  const slug = uniqueSlug('hr_deals', `${vendor}-${title}`, 'deal');
  const info = getDb()
    .prepare(
      `INSERT INTO hr_deals (slug, vendor, title, category, summary, details, worth, code, url,
                             expires_at, posted_by, created_at, access, requirement, checked)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(slug, vendor, title, category, summary, details, worth, code, url,
      expiresAt, postedBy, nowSeconds(), access, requirement, checked);
  return Number(info.lastInsertRowid);
}

/** Steward-only: fill in the code once the partner agreement lands. */
export function setDealCode(dealId, code) {
  getDb().prepare('UPDATE hr_deals SET code = ? WHERE id = ?').run(String(code || ''), dealId);
  return getDeal(dealId);
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

/**
 * The five axes a founder actually compares funders on, plus the one number
 * that predicts the others: would you raise from them again.
 *
 * A single overall star is what Rate My Professor got wrong and then spent a
 * decade adding fields to fix. A fund can be a delight to talk to and take four
 * months to say no; those are different complaints and they deserve different
 * columns.
 */
export function funderRatings(funderId) {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS review_count, AVG(rating) AS avg_rating,
              AVG(speed) AS avg_speed, AVG(value_add) AS avg_value,
              AVG(founder_friendly) AS avg_friendly, AVG(terms) AS avg_terms,
              SUM(would_again) AS again_count, SUM(invested) AS invested_count
       FROM hr_funder_reviews WHERE funder_id = ?`,
    )
    .get(funderId);
  const round = (value) => (value ? Math.round(value * 10) / 10 : null);
  return {
    review_count: row.review_count,
    avg_rating: round(row.avg_rating),
    avg_speed: round(row.avg_speed),
    avg_value: round(row.avg_value),
    avg_friendly: round(row.avg_friendly),
    avg_terms: round(row.avg_terms),
    invested_count: row.invested_count || 0,
    // Withheld under three reviews: at one or two, the percentage identifies
    // the reviewer to anyone who knows who was in the room.
    would_again_pct: row.review_count >= 3
      ? Math.round((row.again_count / row.review_count) * 100)
      : null,
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
  founderFriendly = null, terms = null, wouldAgain = false, tags = '', stage = '', outcome = '',
  invested = false, anonymous = true, body = '' }) {
  getDb()
    .prepare(
      `INSERT INTO hr_funder_reviews
         (funder_id, user_id, rating, speed, value_add, founder_friendly, terms,
          would_again, tags, stage, outcome, invested, anonymous, body, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (funder_id, user_id) DO UPDATE SET
         rating = excluded.rating, speed = excluded.speed, value_add = excluded.value_add,
         founder_friendly = excluded.founder_friendly, terms = excluded.terms,
         would_again = excluded.would_again, tags = excluded.tags, stage = excluded.stage,
         outcome = excluded.outcome, invested = excluded.invested,
         anonymous = excluded.anonymous, body = excluded.body,
         created_at = excluded.created_at`,
    )
    .run(funderId, userId, rating, speed, valueAdd, founderFriendly, terms,
      int(wouldAgain), tags, stage, outcome, int(invested), int(anonymous), body, nowSeconds());
  return myReview(funderId, userId);
}

/**
 * Reviews, most-corroborated first.
 *
 * Sorting by helpful votes rather than recency is the whole design: the review
 * three other founders have said matches their experience is worth more than
 * the one posted this morning, and putting it first is what stops a single
 * angry account defining a fund's page.
 */
export function funderReviews(funderId, { sort = 'helpful' } = {}) {
  const order = sort === 'recent' ? 'r.created_at DESC' : 'helpful DESC, r.created_at DESC';
  return getDb()
    .prepare(
      `SELECT r.*,
              (SELECT COUNT(*) FROM hr_review_votes v WHERE v.review_id = r.id AND v.helpful = 1) AS helpful,
              (SELECT COUNT(*) FROM hr_review_comments c WHERE c.review_id = r.id AND c.deleted = 0) AS reply_count
       FROM hr_funder_reviews r WHERE r.funder_id = ? ORDER BY ${order}`,
    )
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
  startsAt, minutes = 30, capacity = 1, place = '', topics = '', mentorId = null, url = '' }) {
  const info = getDb()
    .prepare(
      `INSERT INTO hr_slots (host_id, title, description, format, starts_at, minutes, capacity,
                             place, topics, created_at, mentor_id, url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(hostId, title, description, format, startsAt, minutes, Math.max(1, capacity),
      place, topics, nowSeconds(), mentorId, url);
  return Number(info.lastInsertRowid);
}

export function getSlot(id) {
  const row = getDb()
    .prepare(
      `SELECT s.*, n.name AS mentor_name, n.slug AS mentor_slug, n.org AS mentor_org,
              n.role AS mentor_role, n.track AS mentor_track, n.vetted AS mentor_vetted
       FROM hr_slots s LEFT JOIN hr_mentors n ON n.id = s.mentor_id WHERE s.id = ?`,
    )
    .get(Number(id));
  if (!row) return null;
  row.booked = getDb().prepare('SELECT COUNT(*) AS n FROM hr_bookings WHERE slot_id = ?').get(row.id).n;
  return row;
}

export function listSlots({ upcoming = true, hostId = '', mentorId = 0, track = '', limit = 60 } = {}) {
  const where = ['s.canceled = 0'];
  const params = [];
  if (upcoming) { where.push('s.starts_at > ?'); params.push(nowSeconds() - 3600); }
  if (hostId) { where.push('s.host_id = ?'); params.push(hostId); }
  if (mentorId) { where.push('s.mentor_id = ?'); params.push(mentorId); }
  if (track) { where.push('n.track = ?'); params.push(track); }
  return getDb()
    .prepare(
      `SELECT s.*, (SELECT COUNT(*) FROM hr_bookings b WHERE b.slot_id = s.id) AS booked,
              n.name AS mentor_name, n.slug AS mentor_slug, n.track AS mentor_track,
              n.org AS mentor_org, n.vetted AS mentor_vetted
       FROM hr_slots s LEFT JOIN hr_mentors n ON n.id = s.mentor_id
       WHERE ${where.join(' AND ')}
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
    mentors: one('SELECT COUNT(*) AS n FROM hr_mentors WHERE active = 1').n,
    vetted: one('SELECT COUNT(*) AS n FROM hr_mentors WHERE active = 1 AND vetted = 1').n,
    atlas: one('SELECT COUNT(*) AS n FROM hr_atlas').n,
    atlasActive: one(`SELECT COUNT(*) AS n FROM hr_atlas WHERE status = 'active'`).n,
    modules: one('SELECT COUNT(*) AS n FROM hr_modules').n,
    channels: one('SELECT COUNT(*) AS n FROM hr_channels WHERE archived = 0').n,
    chat: one('SELECT COUNT(*) AS n FROM hr_chat WHERE deleted = 0').n,
    yearbook: one('SELECT COUNT(*) AS n FROM hr_yearbook').n,
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

/* ==========================================================================
 * CHAT
 *
 * The forum is where a question goes when the answer should be findable in a
 * year. Chat is everything else — and everything else is most of what a room
 * says to itself. Keeping them in separate tables keeps them at separate
 * stakes: nothing here is scored, ranked or surfaced on the home page, which is
 * exactly what makes people willing to type in it.
 *
 * Delivery is polling, not sockets. A Netlify function cannot hold a socket
 * open, and a five-second poll against an indexed integer range is cheap enough
 * that the complexity of anything else would buy nothing.
 * ======================================================================== */

export const CHANNEL_KINDS = [
  { slug: 'open', label: 'Open' },
  { slug: 'cohort', label: 'Cohort' },
  { slug: 'house', label: 'House' },
  { slug: 'project', label: 'Project' },
];

export function createChannel({ slug, name, topic = '', kind = 'open', scope = '',
  position = 0, createdBy = null }) {
  const unique = slug ? slugify(slug, 'channel') : uniqueSlug('hr_channels', name, 'channel');
  const info = getDb()
    .prepare(
      `INSERT OR IGNORE INTO hr_channels (slug, name, topic, kind, scope, position, created_by, created_at, last_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(unique, name, topic, kind, scope, position, createdBy, nowSeconds(), nowSeconds());
  return Number(info.lastInsertRowid) || getChannel(unique)?.id || 0;
}

export function getChannel(idOrSlug) {
  const db = getDb();
  return (/^\d+$/.test(String(idOrSlug))
    ? db.prepare('SELECT * FROM hr_channels WHERE id = ?').get(Number(idOrSlug))
    : db.prepare('SELECT * FROM hr_channels WHERE slug = ?').get(String(idOrSlug))) ?? null;
}

/**
 * Every channel with this member's unread count attached.
 *
 * The unread count is a range count over an indexed integer column, which is
 * why `last_read_id` is an id and not a timestamp: two messages posted in the
 * same second cannot confuse it, and a clock that drifts cannot either.
 */
export function channelsFor(userId, { includeArchived = false } = {}) {
  const clause = includeArchived ? '' : 'WHERE c.archived = 0';
  return getDb()
    .prepare(
      `SELECT c.*,
              COALESCE(r.last_read_id, 0) AS last_read_id,
              COALESCE(r.muted, 0) AS muted,
              (SELECT COUNT(*) FROM hr_chat m
                WHERE m.channel_id = c.id AND m.deleted = 0
                  AND m.id > COALESCE(r.last_read_id, 0)
                  AND m.author_id <> ?) AS unread,
              (SELECT COUNT(*) FROM hr_chat m WHERE m.channel_id = c.id AND m.deleted = 0) AS message_count
       FROM hr_channels c
       LEFT JOIN hr_channel_reads r ON r.channel_id = c.id AND r.user_id = ?
       ${clause}
       ORDER BY c.position, c.name`,
    )
    .all(userId, userId);
}

export function unreadChatCount(userId) {
  if (!userId) return 0;
  return getDb()
    .prepare(
      `SELECT COUNT(*) AS n FROM hr_chat m
       JOIN hr_channels c ON c.id = m.channel_id AND c.archived = 0
       LEFT JOIN hr_channel_reads r ON r.channel_id = m.channel_id AND r.user_id = ?
       WHERE m.deleted = 0 AND m.author_id <> ?
         AND COALESCE(r.muted, 0) = 0
         AND m.id > COALESCE(r.last_read_id, 0)`,
    )
    .get(userId, userId).n;
}

const CHAT_PAGE = 60;

/**
 * A window of messages.
 *
 * `after` powers the poll (everything newer than what I have), `before` powers
 * scrollback (the page above what I have). Both are id comparisons so a client
 * never has to reason about time.
 */
export function chatMessages(channelId, { after = 0, before = 0, limit = CHAT_PAGE } = {}) {
  const db = getDb();
  if (after) {
    return db
      .prepare(
        `SELECT * FROM hr_chat WHERE channel_id = ? AND id > ? AND deleted = 0
         ORDER BY id LIMIT ?`,
      )
      .all(channelId, after, limit);
  }
  const rows = db
    .prepare(
      `SELECT * FROM hr_chat WHERE channel_id = ? AND deleted = 0 ${before ? 'AND id < ?' : ''}
       ORDER BY id DESC LIMIT ?`,
    )
    .all(...(before ? [channelId, before, limit] : [channelId, limit]));
  return rows.reverse();
}

export function postChat({ channelId, authorId, body, replyTo = null }) {
  const text = String(body || '').trim();
  if (!text) return { ok: false, error: 'Nothing to say.' };
  return transaction((db) => {
    const now = nowSeconds();
    const info = db
      .prepare('INSERT INTO hr_chat (channel_id, author_id, body, reply_to, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(channelId, authorId, text.slice(0, 4000), replyTo || null, now);
    db.prepare('UPDATE hr_channels SET last_at = ? WHERE id = ?').run(now, channelId);
    const id = Number(info.lastInsertRowid);
    // Posting is also reading: your own message must not come back as unread.
    db.prepare(
      `INSERT INTO hr_channel_reads (channel_id, user_id, last_read_id) VALUES (?, ?, ?)
       ON CONFLICT (channel_id, user_id) DO UPDATE SET last_read_id = MAX(last_read_id, excluded.last_read_id)`,
    ).run(channelId, authorId, id);
    return { ok: true, id };
  });
}

export function deleteChat(id, userId, { isAdmin = false } = {}) {
  const row = getDb().prepare('SELECT * FROM hr_chat WHERE id = ?').get(id);
  if (!row) return false;
  if (row.author_id !== userId && !isAdmin) return false;
  getDb().prepare('UPDATE hr_chat SET deleted = 1, body = ? WHERE id = ?').run('', id);
  return true;
}

export function markChannelRead(channelId, userId, upToId = null) {
  const top = upToId ?? (getDb()
    .prepare('SELECT MAX(id) AS m FROM hr_chat WHERE channel_id = ?')
    .get(channelId).m ?? 0);
  getDb()
    .prepare(
      `INSERT INTO hr_channel_reads (channel_id, user_id, last_read_id) VALUES (?, ?, ?)
       ON CONFLICT (channel_id, user_id) DO UPDATE SET last_read_id = MAX(last_read_id, excluded.last_read_id)`,
    )
    .run(channelId, userId, top);
  return top;
}

export function toggleMute(channelId, userId) {
  const db = getDb();
  db.prepare(
    `INSERT INTO hr_channel_reads (channel_id, user_id, last_read_id, muted) VALUES (?, ?, 0, 1)
     ON CONFLICT (channel_id, user_id) DO UPDATE SET muted = 1 - muted`,
  ).run(channelId, userId);
  return !!db.prepare('SELECT muted FROM hr_channel_reads WHERE channel_id = ? AND user_id = ?')
    .get(channelId, userId)?.muted;
}

export function toggleReaction(messageId, userId, emoji) {
  const db = getDb();
  const clean = String(emoji || '').slice(0, 8);
  if (!clean) return false;
  const existing = db.prepare('SELECT 1 FROM hr_chat_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?')
    .get(messageId, userId, clean);
  if (existing) {
    db.prepare('DELETE FROM hr_chat_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?')
      .run(messageId, userId, clean);
    return false;
  }
  db.prepare('INSERT INTO hr_chat_reactions (message_id, user_id, emoji) VALUES (?, ?, ?)')
    .run(messageId, userId, clean);
  return true;
}

export function reactionsFor(messageIds) {
  if (!messageIds.length) return {};
  const rows = getDb()
    .prepare(
      `SELECT message_id, emoji, COUNT(*) AS n, GROUP_CONCAT(user_id) AS who
       FROM hr_chat_reactions WHERE message_id IN (${placeholders(messageIds.length)})
       GROUP BY message_id, emoji ORDER BY n DESC`,
    )
    .all(...messageIds);
  const out = {};
  for (const row of rows) {
    (out[row.message_id] ||= []).push({
      emoji: row.emoji, n: row.n, who: String(row.who || '').split(','),
    });
  }
  return out;
}

export function searchChat(query, { limit = 40 } = {}) {
  if (!query) return [];
  return getDb()
    .prepare(
      `SELECT m.*, c.slug AS channel_slug, c.name AS channel_name
       FROM hr_chat m JOIN hr_channels c ON c.id = m.channel_id
       WHERE m.deleted = 0 AND m.body LIKE ? ESCAPE '\\'
       ORDER BY m.id DESC LIMIT ?`,
    )
    .all(like(query), limit);
}

/* ==========================================================================
 * YEARBOOK
 * ======================================================================== */

export function getYearbook(userId) {
  return getDb().prepare('SELECT * FROM hr_yearbook WHERE user_id = ?').get(userId) ?? null;
}

export function upsertYearbook(userId, patch = {}) {
  const current = getYearbook(userId) || {};
  const value = (key, fallback = '') => (patch[key] === undefined ? (current[key] ?? fallback) : patch[key]);
  getDb()
    .prepare(
      `INSERT INTO hr_yearbook (user_id, cohort, house, venture, one_liner, quote, building,
                                before_haus, photo_url, site_url, featured, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id) DO UPDATE SET
         cohort = excluded.cohort, house = excluded.house, venture = excluded.venture,
         one_liner = excluded.one_liner, quote = excluded.quote, building = excluded.building,
         before_haus = excluded.before_haus, photo_url = excluded.photo_url,
         site_url = excluded.site_url, featured = excluded.featured, updated_at = excluded.updated_at`,
    )
    .run(userId, value('cohort'), value('house'), value('venture'), value('one_liner'),
      value('quote'), value('building'), value('before_haus'), value('photo_url'),
      value('site_url'), int(value('featured', 0)), nowSeconds());
  return getYearbook(userId);
}

/**
 * The wall. One row per member who has a yearbook entry or a cohort, ordered so
 * that the people who filled theirs in come first — the alternative is a grid
 * of blank cards, which is how every founder wall dies.
 */
export function yearbookWall({ cohort = '', house = '', q = '', tag = '',
  limit = 200, offset = 0 } = {}) {
  const where = ['1 = 1'];
  const params = [];
  if (cohort) { where.push('COALESCE(NULLIF(y.cohort, \'\'), m.cohort) = ?'); params.push(cohort); }
  if (house) { where.push('y.house = ?'); params.push(house); }
  if (tag) { where.push('EXISTS (SELECT 1 FROM hr_expertise e WHERE e.user_id = m.user_id AND e.tag = ?)'); params.push(tag); }
  if (q) {
    where.push(`(m.name LIKE ? ESCAPE '\\' OR m.user_id LIKE ? ESCAPE '\\' OR m.headline LIKE ? ESCAPE '\\'
                 OR y.venture LIKE ? ESCAPE '\\' OR y.one_liner LIKE ? ESCAPE '\\' OR m.org LIKE ? ESCAPE '\\')`);
    params.push(...Array(6).fill(like(q)));
  }
  const clause = where.join(' AND ');
  const rows = getDb()
    .prepare(
      `SELECT m.*, u.karma,
              COALESCE(y.cohort, '') AS y_cohort, COALESCE(y.house, '') AS house,
              COALESCE(y.venture, '') AS venture, COALESCE(y.one_liner, '') AS one_liner,
              COALESCE(y.quote, '') AS quote, COALESCE(y.building, '') AS building,
              COALESCE(y.before_haus, '') AS before_haus, COALESCE(y.photo_url, '') AS photo_url,
              COALESCE(y.site_url, '') AS site_url, COALESCE(y.featured, 0) AS featured,
              (y.user_id IS NOT NULL) AS has_entry,
              (SELECT COUNT(*) FROM hr_signatures s WHERE s.user_id = m.user_id) AS signatures
       FROM hr_members m
       JOIN users u ON u.id = m.user_id
       LEFT JOIN hr_yearbook y ON y.user_id = m.user_id
       WHERE ${clause}
       ORDER BY featured DESC, has_entry DESC, m.name COLLATE NOCASE, m.user_id
       LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset);
  const { total } = getDb()
    .prepare(
      `SELECT COUNT(*) AS total FROM hr_members m
       LEFT JOIN hr_yearbook y ON y.user_id = m.user_id WHERE ${clause}`,
    )
    .get(...params);
  for (const row of rows) {
    row.cohort = row.y_cohort || row.cohort || '';
    row.expertise = memberExpertise(row.user_id);
  }
  return { members: rows, total };
}

/** Cohorts as the wall sees them: the yearbook value wins over the profile. */
export function wallCohorts() {
  return getDb()
    .prepare(
      `SELECT cohort, COUNT(*) AS n FROM (
         SELECT COALESCE(NULLIF(y.cohort, ''), m.cohort) AS cohort
         FROM hr_members m LEFT JOIN hr_yearbook y ON y.user_id = m.user_id
       ) WHERE cohort IS NOT NULL AND cohort <> '' GROUP BY cohort ORDER BY cohort DESC`,
    )
    .all();
}

export function houses() {
  return getDb()
    .prepare(`SELECT house, COUNT(*) AS n FROM hr_yearbook WHERE house <> '' GROUP BY house ORDER BY house`)
    .all();
}

export function signatures(userId) {
  return getDb()
    .prepare('SELECT * FROM hr_signatures WHERE user_id = ? ORDER BY created_at DESC')
    .all(userId);
}

export function signYearbook({ userId, authorId, body }) {
  const text = String(body || '').trim().slice(0, 600);
  if (!text) return { ok: false, error: 'Write something first.' };
  if (userId === authorId) return { ok: false, error: 'You cannot sign your own yearbook.' };
  getDb()
    .prepare(
      `INSERT INTO hr_signatures (user_id, author_id, body, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (user_id, author_id) DO UPDATE SET body = excluded.body, created_at = excluded.created_at`,
    )
    .run(userId, authorId, text, nowSeconds());
  return { ok: true };
}

/* ==========================================================================
 * BIOLAB ATLAS
 * ======================================================================== */

export function upsertLab(lab) {
  const slug = slugify(`${lab.name}-${lab.city}`, 'lab');
  const existing = getDb().prepare('SELECT id FROM hr_atlas WHERE slug = ?').get(slug);
  const capabilities = Array.isArray(lab.capabilities) ? lab.capabilities.join(',') : (lab.capabilities || '');
  if (existing) {
    getDb()
      .prepare(
        `UPDATE hr_atlas SET name = ?, city = ?, country = ?, region = ?, kind = ?, status = ?,
                bsl = ?, website = ?, capabilities = ?, note = ?, source = ? WHERE id = ?`,
      )
      .run(lab.name, lab.city, lab.country, lab.region, lab.kind, lab.status,
        lab.bsl || '', lab.website || null, capabilities, lab.note || '', lab.source || '', existing.id);
    return existing.id;
  }
  const info = getDb()
    .prepare(
      `INSERT INTO hr_atlas (slug, name, city, country, region, kind, status, bsl, website,
                             capabilities, note, source, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(slug, lab.name, lab.city, lab.country, lab.region, lab.kind, lab.status,
      lab.bsl || '', lab.website || null, capabilities, lab.note || '', lab.source || '', nowSeconds());
  return Number(info.lastInsertRowid);
}

export function getLab(idOrSlug) {
  const db = getDb();
  const row = (/^\d+$/.test(String(idOrSlug))
    ? db.prepare('SELECT * FROM hr_atlas WHERE id = ?').get(Number(idOrSlug))
    : db.prepare('SELECT * FROM hr_atlas WHERE slug = ?').get(String(idOrSlug))) ?? null;
  if (!row) return null;
  return { ...row, capabilities: tagList(row.capabilities) };
}

/**
 * The atlas query.
 *
 * Default sort puts active labs first, because the single most common reason a
 * directory of community labs is useless is that the dead entries are mixed in
 * with the live ones and look identical.
 */
export function searchLabs({ q = '', region = '', country = '', status = '', kind = '',
  capability = '', limit = 300, offset = 0 } = {}) {
  const where = ['1 = 1'];
  const params = [];
  if (region) { where.push('region = ?'); params.push(region); }
  if (country) { where.push('country = ?'); params.push(country); }
  if (status) { where.push('status = ?'); params.push(status); }
  if (kind) { where.push('kind = ?'); params.push(kind); }
  if (capability) { where.push(`capabilities LIKE ? ESCAPE '\\'`); params.push(like(capability)); }
  if (q) {
    where.push(`(name LIKE ? ESCAPE '\\' OR city LIKE ? ESCAPE '\\' OR country LIKE ? ESCAPE '\\'
                 OR note LIKE ? ESCAPE '\\' OR capabilities LIKE ? ESCAPE '\\')`);
    params.push(...Array(5).fill(like(q)));
  }
  const clause = where.join(' AND ');
  const rows = getDb()
    .prepare(
      `SELECT *, (SELECT COUNT(*) FROM hr_atlas_reports r WHERE r.lab_id = hr_atlas.id) AS reports
       FROM hr_atlas WHERE ${clause}
       ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'limited' THEN 1 WHEN 'unknown' THEN 2 ELSE 3 END,
                country, city, name
       LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset);
  const { total } = getDb().prepare(`SELECT COUNT(*) AS total FROM hr_atlas WHERE ${clause}`).get(...params);
  return {
    labs: rows.map((row) => ({ ...row, capabilities: tagList(row.capabilities) })),
    total,
  };
}

export function atlasFacets() {
  const db = getDb();
  return {
    regions: db.prepare(`SELECT region AS slug, region AS label, COUNT(*) AS count FROM hr_atlas
                         WHERE region <> '' GROUP BY region ORDER BY count DESC`).all(),
    countries: db.prepare(`SELECT country AS slug, country AS label, COUNT(*) AS count FROM hr_atlas
                           WHERE country <> '' GROUP BY country ORDER BY country`).all(),
    statuses: db.prepare(`SELECT status AS slug, status AS label, COUNT(*) AS count FROM hr_atlas
                          GROUP BY status`).all(),
  };
}

/**
 * A member reporting what they actually found. The report also moves the lab's
 * status, because a first-hand account from last month outranks any directory —
 * that is the entire premise of keeping an atlas rather than linking to one.
 */
export function reportLab({ labId, userId, status, body = '' }) {
  const valid = ['active', 'limited', 'dormant', 'unknown'];
  if (!valid.includes(status)) return { ok: false, error: 'Unknown status.' };
  return transaction((db) => {
    const now = nowSeconds();
    db.prepare('INSERT INTO hr_atlas_reports (lab_id, user_id, status, body, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(labId, userId, status, String(body || '').slice(0, 2000), now);
    db.prepare('UPDATE hr_atlas SET status = ?, confirmed_by = ?, confirmed_at = ? WHERE id = ?')
      .run(status, userId, now, labId);
    return { ok: true };
  });
}

export function labReports(labId) {
  return getDb()
    .prepare('SELECT * FROM hr_atlas_reports WHERE lab_id = ? ORDER BY created_at DESC LIMIT 20')
    .all(labId);
}

/* ==========================================================================
 * MENTORS
 * ======================================================================== */

export function upsertMentor(mentor) {
  const slug = slugify(mentor.name, 'mentor');
  const tags = Array.isArray(mentor.tags) ? mentor.tags.join(',') : (mentor.tags || '');
  const existing = getDb().prepare('SELECT id FROM hr_mentors WHERE slug = ?').get(slug);
  if (existing) {
    getDb()
      .prepare(
        `UPDATE hr_mentors SET name = ?, role = ?, org = ?, track = ?, tags = ?, location = ?,
                bio = ?, format = ?, scheduler = ?, vetted = ?, user_id = ?, source = ? WHERE id = ?`,
      )
      .run(mentor.name, mentor.role || '', mentor.org || '', mentor.track || 'founder', tags,
        mentor.location || '', mentor.bio || '', mentor.format || 'one-on-one',
        mentor.scheduler || '', int(mentor.vetted), mentor.userId || null,
        mentor.source || 'seed', existing.id);
    return existing.id;
  }
  const info = getDb()
    .prepare(
      `INSERT INTO hr_mentors (slug, user_id, name, role, org, track, tags, location, bio,
                               format, scheduler, vetted, source, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(slug, mentor.userId || null, mentor.name, mentor.role || '', mentor.org || '',
      mentor.track || 'founder', tags, mentor.location || '', mentor.bio || '',
      mentor.format || 'one-on-one', mentor.scheduler || '', int(mentor.vetted),
      mentor.source || 'seed', nowSeconds());
  return Number(info.lastInsertRowid);
}

/*
 * Everything about a mentor EXCEPT the booking link.
 *
 * `scheduler` is named column-by-column out of these two queries rather than
 * filtered afterwards, and there is no `SELECT *` on hr_mentors anywhere in
 * this file any more. The link used to travel inside `m.*` and reached
 * /homeroom/api/mentors that way — nothing looked broken, so nobody noticed.
 * A filter at each call site would have the same failure mode the next time
 * an endpoint is added; a column that is never selected does not.
 *
 * Read it deliberately, one mentor at a time, with mentordesk.schedulerFor().
 */
const MENTOR_FIELDS = ['id', 'slug', 'user_id', 'name', 'role', 'org', 'track', 'tags',
  'location', 'bio', 'format', 'vetted', 'active', 'sessions', 'source', 'created_at',
  'state', 'consent_mode', 'capacity', 'tracks', 'confirmed_at', 'paused_until', 'synced_at',
  'reconfirm_sent_at', 'reconfirm_nudges'];

const MENTOR_COLUMNS = MENTOR_FIELDS.join(', ');
const MENTOR_COLUMNS_M = MENTOR_FIELDS.map((f) => `m.${f}`).join(', ');

export function getMentor(idOrSlug) {
  const db = getDb();
  const row = (/^\d+$/.test(String(idOrSlug))
    ? db.prepare(`SELECT ${MENTOR_COLUMNS} FROM hr_mentors WHERE id = ?`).get(Number(idOrSlug))
    : db.prepare(`SELECT ${MENTOR_COLUMNS} FROM hr_mentors WHERE slug = ?`).get(String(idOrSlug))) ?? null;
  if (!row) return null;
  return { ...row, tags: tagList(row.tags) };
}

/**
 * The searchable roster.
 *
 * Vetted first by default: a vetted mentor has been met by a steward and has
 * agreed to take bookings, and an unvetted one is a name. Sorting them together
 * would make the list longer and less useful, which is the trade every mentor
 * directory gets wrong.
 */
export function searchMentors({ q = '', track = '', tag = '', vetted = false, format = '',
  limit = 60, offset = 0 } = {}) {
  /*
   * `state` gates the roster, not just `active`.
   *
   * Listed and paused are the two states a member should see: paused means
   * "here, but not taking requests right now", which the profile explains.
   * Everything else — pending review, rejected, dormant, withdrawn — is
   * invisible, and it is an allowlist rather than a list of exclusions so a
   * state added later is hidden by default rather than accidentally published.
   */
  const where = ["active = 1", "state IN ('listed','paused')"];
  const params = [];
  if (track) { where.push('track = ?'); params.push(track); }
  if (format) { where.push('format = ?'); params.push(format); }
  if (vetted) where.push('vetted = 1');
  if (tag) { where.push(`(',' || tags || ',') LIKE ? ESCAPE '\\'`); params.push(`%,${tag},%`); }
  if (q) {
    where.push(`(name LIKE ? ESCAPE '\\' OR org LIKE ? ESCAPE '\\' OR role LIKE ? ESCAPE '\\'
                 OR tags LIKE ? ESCAPE '\\' OR location LIKE ? ESCAPE '\\' OR bio LIKE ? ESCAPE '\\')`);
    params.push(...Array(6).fill(like(q)));
  }
  const clause = where.join(' AND ');
  const rows = getDb()
    .prepare(
      `SELECT ${MENTOR_COLUMNS_M},
              (SELECT COUNT(*) FROM hr_slots s
                WHERE s.mentor_id = m.id AND s.canceled = 0 AND s.starts_at > ?) AS open_slots
       FROM hr_mentors m WHERE ${clause}
       ORDER BY m.vetted DESC, open_slots DESC, m.name COLLATE NOCASE LIMIT ? OFFSET ?`,
    )
    .all(nowSeconds(), ...params, limit, offset);
  const { total } = getDb().prepare(`SELECT COUNT(*) AS total FROM hr_mentors WHERE ${clause}`).get(...params);
  return { mentors: rows.map((row) => ({ ...row, tags: tagList(row.tags) })), total };
}

export function mentorTagCloud(limit = 40) {
  const rows = getDb().prepare('SELECT tags FROM hr_mentors WHERE active = 1').all();
  const counts = new Map();
  for (const row of rows) {
    for (const tag of tagList(row.tags)) counts.set(tag, (counts.get(tag) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([slug, count]) => ({ slug, label: slug, count }));
}

export function mentorSlots(mentorId) {
  return getDb()
    .prepare(
      `SELECT s.*, (SELECT COUNT(*) FROM hr_bookings b WHERE b.slot_id = s.id) AS booked
       FROM hr_slots s WHERE s.mentor_id = ? AND s.canceled = 0 AND s.starts_at > ?
       ORDER BY s.starts_at`,
    )
    .all(mentorId, nowSeconds());
}

export function bumpMentorSessions(mentorId) {
  getDb().prepare('UPDATE hr_mentors SET sessions = sessions + 1 WHERE id = ?').run(mentorId);
}

/* ==========================================================================
 * FUNDER REVIEW REPLIES AND VOTES
 * ======================================================================== */

export function getReview(id) {
  return getDb().prepare('SELECT * FROM hr_funder_reviews WHERE id = ?').get(id) ?? null;
}

export function addReviewComment({ reviewId, authorId, body, anonymous = false }) {
  const text = String(body || '').trim();
  if (!text) return { ok: false, error: 'Nothing to add.' };
  const info = getDb()
    .prepare('INSERT INTO hr_review_comments (review_id, author_id, body, anonymous, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(reviewId, authorId, text.slice(0, 4000), int(anonymous), nowSeconds());
  return { ok: true, id: Number(info.lastInsertRowid) };
}

export function reviewComments(reviewIds) {
  if (!reviewIds.length) return {};
  const rows = getDb()
    .prepare(
      `SELECT * FROM hr_review_comments
       WHERE review_id IN (${placeholders(reviewIds.length)}) AND deleted = 0
       ORDER BY created_at`,
    )
    .all(...reviewIds);
  const out = {};
  for (const row of rows) (out[row.review_id] ||= []).push(row);
  return out;
}

export function deleteReviewComment(id, userId, { isAdmin = false } = {}) {
  const row = getDb().prepare('SELECT * FROM hr_review_comments WHERE id = ?').get(id);
  if (!row || (row.author_id !== userId && !isAdmin)) return false;
  getDb().prepare('UPDATE hr_review_comments SET deleted = 1 WHERE id = ?').run(id);
  return true;
}

/** "This matches my experience." Toggles, so it can be taken back. */
export function toggleReviewHelpful(reviewId, userId) {
  const db = getDb();
  const existing = db.prepare('SELECT 1 FROM hr_review_votes WHERE review_id = ? AND user_id = ?')
    .get(reviewId, userId);
  if (existing) {
    db.prepare('DELETE FROM hr_review_votes WHERE review_id = ? AND user_id = ?').run(reviewId, userId);
    return false;
  }
  db.prepare('INSERT INTO hr_review_votes (review_id, user_id, helpful, created_at) VALUES (?, ?, 1, ?)')
    .run(reviewId, userId, nowSeconds());
  return true;
}

export function helpfulIds(userId, reviewIds) {
  if (!userId || !reviewIds.length) return new Set();
  const rows = getDb()
    .prepare(`SELECT review_id FROM hr_review_votes WHERE user_id = ? AND review_id IN (${placeholders(reviewIds.length)})`)
    .all(userId, ...reviewIds);
  return new Set(rows.map((row) => row.review_id));
}

/** The tags reviewers reach for most on one funder — the shape of the pattern. */
export function funderTagCloud(funderId, limit = 8) {
  const rows = getDb().prepare('SELECT tags FROM hr_funder_reviews WHERE funder_id = ?').all(funderId);
  const counts = new Map();
  for (const row of rows) {
    for (const tag of tagList(row.tags)) counts.set(tag, (counts.get(tag) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit)
    .map(([slug, count]) => ({ slug, label: slug.replace(/-/g, ' '), count }));
}

/* ==========================================================================
 * THE LIBRARY AS A TRAINING SYSTEM
 * ======================================================================== */

export function upsertTrack(track, position = 0) {
  getDb()
    .prepare(
      `INSERT INTO hr_tracks (slug, title, focus, blurb, position) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (slug) DO UPDATE SET title = excluded.title, focus = excluded.focus,
         blurb = excluded.blurb, position = excluded.position`,
    )
    .run(track.slug, track.title, track.focus || '', track.blurb || '', position);
}

export function upsertModule(module, position = 0) {
  getDb()
    .prepare(
      `INSERT INTO hr_modules (slug, track, title, kind, summary, outcomes, work, deliverable,
                               minutes, week, position)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (slug) DO UPDATE SET track = excluded.track, title = excluded.title,
         kind = excluded.kind, summary = excluded.summary, outcomes = excluded.outcomes,
         work = excluded.work, deliverable = excluded.deliverable, minutes = excluded.minutes,
         week = excluded.week, position = excluded.position`,
    )
    .run(module.slug, module.track, module.title, module.kind, module.summary,
      (module.outcomes || []).join('\n'), (module.work || []).join('\n'),
      module.deliverable || '', module.minutes || 45, module.week || 0, position);
}

const splitLines = (value) => String(value || '').split('\n').map((s) => s.trim()).filter(Boolean);

function hydrateModule(row) {
  if (!row) return null;
  return { ...row, outcomes: splitLines(row.outcomes), work: splitLines(row.work) };
}

export function tracks() {
  return getDb().prepare('SELECT * FROM hr_tracks ORDER BY position, title').all();
}

export function getTrack(slug) {
  return getDb().prepare('SELECT * FROM hr_tracks WHERE slug = ?').get(slug) ?? null;
}

export function getModule(idOrSlug) {
  const db = getDb();
  return hydrateModule(/^\d+$/.test(String(idOrSlug))
    ? db.prepare('SELECT * FROM hr_modules WHERE id = ?').get(Number(idOrSlug))
    : db.prepare('SELECT * FROM hr_modules WHERE slug = ?').get(String(idOrSlug)));
}

export function listModules({ track = '', kind = '', q = '', week = 0, userId = '',
  limit = 200, offset = 0 } = {}) {
  const where = ['1 = 1'];
  const params = [];
  if (track) { where.push('m.track = ?'); params.push(track); }
  if (kind) { where.push('m.kind = ?'); params.push(kind); }
  if (week) { where.push('m.week = ?'); params.push(week); }
  if (q) {
    where.push(`(m.title LIKE ? ESCAPE '\\' OR m.summary LIKE ? ESCAPE '\\'
                 OR m.outcomes LIKE ? ESCAPE '\\' OR m.work LIKE ? ESCAPE '\\'
                 OR m.deliverable LIKE ? ESCAPE '\\')`);
    params.push(...Array(5).fill(like(q)));
  }
  const clause = where.join(' AND ');
  const rows = getDb()
    .prepare(
      `SELECT m.*, t.title AS track_title,
              (SELECT p.state FROM hr_progress p WHERE p.module_id = m.id AND p.user_id = ?) AS state
       FROM hr_modules m JOIN hr_tracks t ON t.slug = m.track
       WHERE ${clause} ORDER BY t.position, m.position LIMIT ? OFFSET ?`,
    )
    .all(userId || '', ...params, limit, offset);
  const { total } = getDb()
    .prepare(`SELECT COUNT(*) AS total FROM hr_modules m WHERE ${clause}`)
    .get(...params);
  return { modules: rows.map(hydrateModule), total };
}

export function setProgress({ userId, moduleId, state = 'started', note = '', link = '' }) {
  if (state === 'none') {
    getDb().prepare('DELETE FROM hr_progress WHERE user_id = ? AND module_id = ?').run(userId, moduleId);
    return null;
  }
  getDb()
    .prepare(
      `INSERT INTO hr_progress (user_id, module_id, state, note, link, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id, module_id) DO UPDATE SET state = excluded.state,
         note = excluded.note, link = excluded.link, updated_at = excluded.updated_at`,
    )
    .run(userId, moduleId, state, String(note || '').slice(0, 4000), String(link || '').slice(0, 500), nowSeconds());
  return getProgress(userId, moduleId);
}

export function getProgress(userId, moduleId) {
  if (!userId) return null;
  return getDb().prepare('SELECT * FROM hr_progress WHERE user_id = ? AND module_id = ?')
    .get(userId, moduleId) ?? null;
}

/**
 * Where a member is across the whole manual.
 *
 * "Done" counts modules whose deliverable exists, not modules that were opened,
 * which is the difference between a training system and a reading list.
 */
export function progressSummary(userId) {
  const db = getDb();
  const total = db.prepare('SELECT COUNT(*) AS n FROM hr_modules').get().n;
  const rows = db
    .prepare(
      `SELECT m.track, t.title AS track_title, COUNT(m.id) AS total,
              SUM(CASE WHEN p.state = 'done' THEN 1 ELSE 0 END) AS done,
              SUM(CASE WHEN p.state = 'started' THEN 1 ELSE 0 END) AS started
       FROM hr_modules m
       JOIN hr_tracks t ON t.slug = m.track
       LEFT JOIN hr_progress p ON p.module_id = m.id AND p.user_id = ?
       GROUP BY m.track ORDER BY t.position`,
    )
    .all(userId || '');
  const done = rows.reduce((sum, row) => sum + (row.done || 0), 0);
  const started = rows.reduce((sum, row) => sum + (row.started || 0), 0);
  return { total, done, started, percent: total ? Math.round((done / total) * 100) : 0, byTrack: rows };
}

/** Deliverables the member has produced, which is the actual portfolio. */
export function deliverables(userId) {
  return getDb()
    .prepare(
      `SELECT m.slug, m.title, m.deliverable, m.week, p.state, p.note, p.link, p.updated_at
       FROM hr_progress p JOIN hr_modules m ON m.id = p.module_id
       WHERE p.user_id = ? AND m.deliverable <> '' ORDER BY m.week, m.position`,
    )
    .all(userId);
}

export function bumpModuleReads(id) {
  getDb().prepare('UPDATE hr_modules SET reads = reads + 1 WHERE id = ?').run(id);
}

/* ==========================================================================
 * EVENTS: CALENDAR AND EXTERNAL SOURCES
 * ======================================================================== */

/**
 * Events in a window, for the month grid.
 *
 * Includes cancelled events rather than hiding them: a cancelled event still
 * needs to appear on the day it would have been, or the people who had it in
 * their diary never find out.
 */
export function eventsBetween(startsAt, endsAt) {
  return getDb()
    .prepare(
      `SELECT e.*,
              (SELECT COUNT(*) FROM hr_rsvps r WHERE r.event_id = e.id AND r.status = 'going') AS going,
              s.source AS external_source, s.url AS external_url
       FROM hr_events e
       LEFT JOIN hr_event_sources s ON s.event_id = e.id
       WHERE e.starts_at >= ? AND e.starts_at < ? ORDER BY e.starts_at`,
    )
    .all(startsAt, endsAt);
}

export function eventSource(eventId) {
  return getDb().prepare('SELECT * FROM hr_event_sources WHERE event_id = ?').get(eventId) ?? null;
}

/**
 * Create or update an event that came from an external calendar.
 *
 * Idempotent on (source, external_id), so a sweep that runs twice does not
 * produce two copies of the same evening.
 */
export function upsertExternalEvent({ source = 'luma', externalId, hostId, title, description = '',
  kind = 'meetup', startsAt, minutes = 90, place = '', url = null, capacity = 0, canceled = false }) {
  return transaction((db) => {
    const now = nowSeconds();
    const existing = db.prepare('SELECT event_id FROM hr_event_sources WHERE source = ? AND external_id = ?')
      .get(source, externalId);
    if (existing) {
      db.prepare(
        `UPDATE hr_events SET title = ?, description = ?, kind = ?, starts_at = ?, minutes = ?,
                place = ?, url = ?, capacity = ?, canceled = ? WHERE id = ?`,
      ).run(title, description, kind, startsAt, minutes, place, url, capacity, int(canceled), existing.event_id);
      db.prepare('UPDATE hr_event_sources SET url = ?, synced_at = ? WHERE event_id = ?')
        .run(url || '', now, existing.event_id);
      return { id: existing.event_id, created: false };
    }
    const info = db
      .prepare(
        `INSERT INTO hr_events (host_id, title, description, kind, starts_at, minutes, place, url,
                                capacity, canceled, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(hostId, title, description, kind, startsAt, minutes, place, url, capacity, int(canceled), now);
    const id = Number(info.lastInsertRowid);
    db.prepare('INSERT INTO hr_event_sources (event_id, source, external_id, url, synced_at) VALUES (?, ?, ?, ?, ?)')
      .run(id, source, externalId, url || '', now);
    return { id, created: true };
  });
}

export function lastSync(source = 'luma') {
  return getDb().prepare('SELECT MAX(synced_at) AS at, COUNT(*) AS n FROM hr_event_sources WHERE source = ?')
    .get(source);
}

/* ==========================================================================
 * NEWS SUBMISSIONS
 * ======================================================================== */

export function recordNewsSubmission({ userId, title, url = '', body = '', topic = 'general',
  status = 'pending', remoteId = null, error = '' }) {
  const now = nowSeconds();
  const info = getDb()
    .prepare(
      `INSERT INTO hr_news_submissions (user_id, remote_id, title, url, body, topic, status, error, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(userId, remoteId, title, url, body, topic, status, error, now, now);
  return Number(info.lastInsertRowid);
}

export function updateNewsSubmission(id, { status, remoteId, error = '' }) {
  getDb()
    .prepare('UPDATE hr_news_submissions SET status = ?, remote_id = COALESCE(?, remote_id), error = ?, updated_at = ? WHERE id = ?')
    .run(status, remoteId ?? null, error, nowSeconds(), id);
}

export function newsSubmissions(userId, { limit = 30 } = {}) {
  return getDb()
    .prepare('SELECT * FROM hr_news_submissions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?')
    .all(userId, limit);
}

/* ==========================================================================
 * THE ROSTER
 *
 * Cached Airtable verdicts. The address is only ever a SHA-256 here — see
 * roster.js for why — so every function takes a hash, not an email.
 * ======================================================================== */

export function recordVerdict({ hash, masked, verdict, reason, person = {} }) {
  const now = nowSeconds();
  getDb()
    .prepare(
      `INSERT INTO hr_roster (email_hash, masked, verdict, reason, name, cohort, house,
                              status, lifecycle, resident_type, attempts, checked_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
       ON CONFLICT (email_hash) DO UPDATE SET
         masked = excluded.masked, verdict = excluded.verdict, reason = excluded.reason,
         name = excluded.name, cohort = excluded.cohort, house = excluded.house,
         status = excluded.status, lifecycle = excluded.lifecycle,
         resident_type = excluded.resident_type,
         attempts = hr_roster.attempts + 1, checked_at = excluded.checked_at`,
    )
    .run(hash, masked, verdict, reason, person.name || '', person.cohort || '', person.house || '',
      person.status || '', person.lifecycle || '', person.residentType || '', now);
  return rosterRow(hash);
}

export function rosterRow(hash) {
  return getDb().prepare('SELECT * FROM hr_roster WHERE email_hash = ?').get(hash) ?? null;
}

export function linkRosterUser(hash, userId) {
  getDb().prepare('UPDATE hr_roster SET user_id = ? WHERE email_hash = ?').run(userId, hash);
}

export function setUserRoster(userId, status) {
  getDb()
    .prepare('UPDATE users SET roster_status = ?, roster_checked_at = ? WHERE id = ?')
    .run(status, nowSeconds(), userId);
}

/**
 * A steward's decision on a conflict.
 *
 * Stored separately from `verdict`, not overwriting it, so the next Airtable
 * check does not silently erase a human judgement — and so the steward view can
 * still show what the data said when they overrode it.
 */
export function decideRoster({ hash, userId, decision, note = '' }) {
  getDb()
    .prepare('UPDATE hr_roster SET decision = ?, decided_by = ?, decided_at = ?, note = ? WHERE email_hash = ?')
    .run(decision, userId, nowSeconds(), String(note || '').slice(0, 500), hash);
  return rosterRow(hash);
}

/** Conflicts a steward has not ruled on yet. This is the queue that matters. */
export function pendingRoster() {
  return getDb()
    .prepare(`SELECT * FROM hr_roster WHERE verdict = 'review' AND decision IS NULL
              ORDER BY checked_at DESC LIMIT 100`)
    .all();
}

export function recentRoster({ limit = 60 } = {}) {
  return getDb()
    .prepare('SELECT * FROM hr_roster ORDER BY checked_at DESC LIMIT ?')
    .all(limit);
}

export function rosterCounts() {
  const rows = getDb()
    .prepare('SELECT verdict, COUNT(*) AS n FROM hr_roster GROUP BY verdict')
    .all();
  const out = { allow: 0, deny: 0, review: 0, error: 0 };
  for (const row of rows) out[row.verdict] = row.n;
  out.pending = pendingRoster().length;
  return out;
}

/* ==========================================================================
 * IDEMPOTENT UPSERTS FOR THE REAL DATA SETS
 *
 * `createDeal` and `createFunder` mint a unique slug, which is right when a
 * member adds one by hand and wrong when a script re-runs the catalogue: the
 * second run would produce aws-activate-credits-2. These two key on the plain
 * slug instead, so re-running seed-real.js refreshes rows rather than
 * multiplying them.
 * ======================================================================== */

export function upsertDeal(deal) {
  const slug = slugify(`${deal.vendor}-${deal.title}`, 'deal');
  const db = getDb();
  const existing = db.prepare('SELECT id FROM hr_deals WHERE slug = ?').get(slug);
  if (existing) {
    db.prepare(
      `UPDATE hr_deals SET vendor = ?, title = ?, category = ?, summary = ?, details = ?,
              worth = ?, url = ?, access = ?, requirement = ?, checked = ? WHERE id = ?`,
    ).run(deal.vendor, deal.title, deal.category, deal.summary || '', deal.details || '',
      deal.worth || '', deal.url || null, deal.access || 'code', deal.requirement || '',
      deal.checked || '', existing.id);
    // `code` is deliberately not overwritten: a steward may have entered the
    // real one, and the data file ships with it empty by design.
    return { id: existing.id, slug, created: false };
  }
  const info = db
    .prepare(
      `INSERT INTO hr_deals (slug, vendor, title, category, summary, details, worth, code, url,
                             posted_by, created_at, access, requirement, checked)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(slug, deal.vendor, deal.title, deal.category, deal.summary || '', deal.details || '',
      deal.worth || '', deal.code || '', deal.url || null, deal.postedBy, nowSeconds(),
      deal.access || 'code', deal.requirement || '', deal.checked || '');
  return { id: Number(info.lastInsertRowid), slug, created: true };
}

export function upsertFunder(funder) {
  const slug = slugify(funder.name, 'funder');
  const db = getDb();
  const existing = db.prepare('SELECT id FROM hr_funders WHERE slug = ?').get(slug);
  if (existing) {
    db.prepare(
      `UPDATE hr_funders SET name = ?, kind = ?, focus = ?, stages = ?, check_size = ?,
              location = ?, website = ?, description = ?, dilutive = ? WHERE id = ?`,
    ).run(funder.name, funder.kind, funder.focus || '', funder.stages || '',
      funder.checkSize || '', funder.location || '', funder.website || null,
      funder.description || '', int(funder.dilutive), existing.id);
    return { id: existing.id, slug, created: false };
  }
  const info = db
    .prepare(
      `INSERT INTO hr_funders (slug, name, kind, focus, stages, check_size, location, website,
                               description, dilutive, added_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(slug, funder.name, funder.kind, funder.focus || '', funder.stages || '',
      funder.checkSize || '', funder.location || '', funder.website || null,
      funder.description || '', int(funder.dilutive), funder.addedBy || null, nowSeconds());
  return { id: Number(info.lastInsertRowid), slug, created: true };
}

/** Remove rows of a real data set that the data file no longer contains. */
export function pruneBySlug(table, keep) {
  if (!keep.length) return 0;
  const rows = getDb().prepare(`SELECT slug FROM ${table}`).all();
  const stale = rows.map((r) => r.slug).filter((slug) => !keep.includes(slug));
  if (!stale.length) return 0;
  const stmt = getDb().prepare(`DELETE FROM ${table} WHERE slug = ?`);
  for (const slug of stale) stmt.run(slug);
  return stale.length;
}
