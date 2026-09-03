/*
 * Homeroom data layer. Same house rules as src/models.js: plain prepared
 * statements, transactions for anything that touches two tables, and no
 * ORM anywhere near it.
 */

import { getDb, transaction } from './db.js';
import { nowSeconds } from './util.js';

export const PAGE_SIZE = 20;

/* ------------------------------------------------------------ taxonomies */





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
async function uniqueSlug(table, text, fallback) {
  const base = slugify(text, fallback);
  const db = await getDb();
  let candidate = base;
  let n = 2;
  while (((await db.prepare(`SELECT 1 FROM ${table} WHERE slug = ?`).get(candidate)))) {
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

export async function createUser({ id, email, passwordHash, isAdmin = false }) {
  const now = nowSeconds();
  (await (await getDb())
    .prepare('INSERT INTO users (id, email, password_hash, karma, created_at, is_admin) VALUES (?, ?, ?, 1, ?, ?)')
    .run(id, email ? String(email).trim().toLowerCase() : null, passwordHash, now, isAdmin ? 1 : 0));
  return await getUser(id);
}

export async function getUser(id) {
  if (!id) return null;
  return (await (await getDb()).prepare('SELECT * FROM users WHERE lower(id) = lower(?)').get(id)) ?? null;
}

export async function getUserByEmail(email) {
  if (!email) return null;
  return (await (await getDb())
    .prepare('SELECT * FROM users WHERE email = ?')
    .get(String(email).trim().toLowerCase())) ?? null;
}

export async function setPassword(userId, passwordHash) {
  (await (await getDb()).prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, userId));
}

export async function userCount() {
  return (await (await getDb()).prepare('SELECT COUNT(*) AS n FROM users').get()).n;
}

/* ---- linking a local identity to a Supabase credential ---- */

export async function getUserBySupabaseId(supabaseId) {
  if (!supabaseId) return null;
  return (await (await getDb()).prepare('SELECT * FROM users WHERE supabase_id = ?').get(String(supabaseId))) ?? null;
}

export async function linkSupabaseId(userId, supabaseId) {
  (await (await getDb()).prepare('UPDATE users SET supabase_id = ? WHERE id = ?').run(String(supabaseId || ''), userId));
}

export async function setUserEmail(userId, email) {
  (await (await getDb())
    .prepare('UPDATE users SET email = ? WHERE id = ?')
    .run(email ? String(email).trim().toLowerCase() : null, userId));
}

/* ---------------------------------------------------------------- members */

const MEMBER_COLUMNS = `m.*, u.karma AS karma, u.created_at AS user_created_at, u.is_admin AS is_admin`;

/** Every logged-in user gets a Homeroom profile the first time they arrive. */
export async function ensureMember(userId, defaults = {}) {
  const existing = await getMember(userId);
  if (existing) return existing;
  const now = nowSeconds();
  (await (await getDb())
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
    ));
  return await getMember(userId);
}

export async function getMember(userId) {
  if (!userId) return null;
  const row = (await (await getDb())
    .prepare(
      `SELECT ${MEMBER_COLUMNS} FROM hr_members m
       JOIN users u ON u.id = m.user_id
       WHERE lower(m.user_id) = lower(?)`,
    )
    .get(userId));
  if (!row) return null;
  row.expertise = await memberExpertise(row.user_id);
  return row;
}

export async function memberExpertise(userId) {
  return (await (await getDb())
    .prepare('SELECT tag FROM hr_expertise WHERE user_id = ? ORDER BY tag')
    .all(userId))
    .map((r) => r.tag);
}

export async function updateMember(userId, patch) {
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
    (await (await getDb()).prepare(`UPDATE hr_members SET ${sets.join(', ')} WHERE user_id = ?`).run(...values));
  }
  if (Array.isArray(patch.expertise)) await setExpertise(userId, patch.expertise);
  return await getMember(userId);
}

export async function setExpertise(userId, tags) {
  await transaction(async (db) => {
    await db.prepare('DELETE FROM hr_expertise WHERE user_id = ?').run(userId);
    const insert = db.prepare(
      'INSERT INTO hr_expertise (user_id, tag) VALUES (?, ?) ON CONFLICT DO NOTHING',
    );
    for (const tag of tags.slice(0, 12)) if (tag) await insert.run(userId, tag);
  });
}

export async function touchMember(userId) {
  (await (await getDb()).prepare('UPDATE hr_members SET last_seen_at = ? WHERE user_id = ?').run(nowSeconds(), userId));
}

/**
 * The member directory. Every filter is optional and they compose, which is
 * the whole point of the thing: "protein-design people in Berlin open to
 * office hours" is one query, not a spreadsheet.
 */
export async function searchMembers({
  q = '', tag = '', cohort = '', location = '', open = '',
  limit = PAGE_SIZE, offset = 0,
} = {}) {
  const where = ['1 = 1'];
  const params = [];
  if (q) {
    where.push(`(m.user_id ILIKE ? ESCAPE '\\' OR m.name ILIKE ? ESCAPE '\\' OR m.headline ILIKE ? ESCAPE '\\'
                 OR m.bio ILIKE ? ESCAPE '\\' OR m.org ILIKE ? ESCAPE '\\' OR m.working_on ILIKE ? ESCAPE '\\'
                 OR m.ask_me_about ILIKE ? ESCAPE '\\')`);
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
    where.push(`m.location ILIKE ? ESCAPE '\\'`);
    params.push(like(location));
  }
  const openColumn = { intros: 'open_intros', hours: 'open_hours', collab: 'open_collab', hiring: 'open_hiring' }[open];
  if (openColumn) where.push(`m.${openColumn} = 1`);

  const clause = where.join(' AND ');
  const rows = (await (await getDb())
    .prepare(
      `SELECT ${MEMBER_COLUMNS} FROM hr_members m
       JOIN users u ON u.id = m.user_id
       WHERE ${clause}
       ORDER BY u.karma DESC, m.joined_at ASC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset));
  for (const row of rows) row.expertise = await memberExpertise(row.user_id);
  const { total } = (await (await getDb())
    .prepare(`SELECT COUNT(*) AS total FROM hr_members m JOIN users u ON u.id = m.user_id WHERE ${clause}`)
    .get(...params));
  return { members: rows, total };
}

export async function expertiseCloud(limit = 40) {
  return (await (await getDb())
    .prepare(
      `SELECT tag, COUNT(*) AS count FROM hr_expertise
       GROUP BY tag ORDER BY count DESC, tag ASC LIMIT ?`,
    )
    .all(limit));
}

export async function cohorts() {
  return (await (await getDb())
    .prepare(
      `SELECT cohort, COUNT(*) AS count FROM hr_members
       WHERE cohort IS NOT NULL AND cohort <> '' GROUP BY cohort ORDER BY cohort DESC`,
    )
    .all());
}

/* ------------------------------------------------------------------- labs */

export async function createOrg({ name, tagline = '', description = '', kind = 'startup', stage = 'idea',
  location = '', website = null, cohort = null, founded = null, headcount = null, tags = '', createdBy }) {
  const now = nowSeconds();
  return transaction(async (db) => {
    const slug = await uniqueSlug('hr_orgs', name, 'lab');
    const info = (await db
      .prepare(
        `INSERT INTO hr_orgs (slug, name, tagline, description, kind, stage, location, website,
                              cohort, founded, headcount, tags, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      )
      .get(slug, name, tagline, description, kind, stage, location, website, cohort,
        founded ?? null, headcount ?? null, tags, createdBy, now, now));
    const id = Number(info.id);
    (await db.prepare('INSERT INTO hr_org_members (org_id, user_id, role, admin, joined_at) VALUES (?, ?, ?, 1, ?)')
      .run(id, createdBy, 'founder', now));
    return id;
  });
}

export async function getOrg(idOrSlug) {
  const db = await getDb();
  const row = /^\d+$/.test(String(idOrSlug))
    ? ((await db.prepare('SELECT * FROM hr_orgs WHERE id = ?').get(Number(idOrSlug))))
    : ((await db.prepare('SELECT * FROM hr_orgs WHERE slug = ?').get(String(idOrSlug))));
  return row ?? null;
}

export async function updateOrg(id, patch) {
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
  if (!sets.length) return await getOrg(id);
  sets.push('updated_at = ?');
  values.push(nowSeconds(), id);
  (await (await getDb()).prepare(`UPDATE hr_orgs SET ${sets.join(', ')} WHERE id = ?`).run(...values));
  return await getOrg(id);
}

export async function orgTeam(orgId) {
  return (await (await getDb())
    .prepare(
      `SELECT om.role, om.admin, om.joined_at, m.*, u.karma
       FROM hr_org_members om
       JOIN users u ON u.id = om.user_id
       LEFT JOIN hr_members m ON m.user_id = om.user_id
       WHERE om.org_id = ? ORDER BY om.admin DESC, om.joined_at ASC`,
    )
    .all(orgId));
}

export async function joinOrg(orgId, userId, role = '') {
  (await (await getDb())
    .prepare('INSERT INTO hr_org_members (org_id, user_id, role, admin, joined_at) VALUES (?, ?, ?, 0, ?) ON CONFLICT DO NOTHING')
    .run(orgId, userId, role, nowSeconds()));
}

export async function leaveOrg(orgId, userId) {
  (await (await getDb()).prepare('DELETE FROM hr_org_members WHERE org_id = ? AND user_id = ?').run(orgId, userId));
}

export async function isOrgAdmin(orgId, userId) {
  if (!userId) return false;
  const row = (await (await getDb())
    .prepare('SELECT admin FROM hr_org_members WHERE org_id = ? AND user_id = ?')
    .get(orgId, userId));
  return !!row?.admin;
}

export async function isOrgMember(orgId, userId) {
  if (!userId) return false;
  return !!(await (await getDb()).prepare('SELECT 1 FROM hr_org_members WHERE org_id = ? AND user_id = ?').get(orgId, userId));
}

export async function userOrgs(userId) {
  return (await (await getDb())
    .prepare(
      `SELECT o.*, om.role, om.admin FROM hr_org_members om
       JOIN hr_orgs o ON o.id = om.org_id
       WHERE om.user_id = ? ORDER BY om.joined_at DESC`,
    )
    .all(userId));
}

export async function searchOrgs({ q = '', kind = '', stage = '', tag = '', limit = PAGE_SIZE, offset = 0 } = {}) {
  const where = ['1 = 1'];
  const params = [];
  if (q) {
    where.push(`(name ILIKE ? ESCAPE '\\' OR tagline ILIKE ? ESCAPE '\\' OR description ILIKE ? ESCAPE '\\' OR location ILIKE ? ESCAPE '\\')`);
    params.push(...Array(4).fill(like(q)));
  }
  if (kind) { where.push('kind = ?'); params.push(kind); }
  if (stage) { where.push('stage = ?'); params.push(stage); }
  if (tag) { where.push(`(',' || replace(tags, ' ', '') || ',') ILIKE ? ESCAPE '\\'`); params.push(`%,${tag},%`); }
  const clause = where.join(' AND ');
  const orgs = (await (await getDb())
    .prepare(
      `SELECT o.*, (SELECT COUNT(*) FROM hr_org_members om WHERE om.org_id = o.id) AS team_count
       FROM hr_orgs o WHERE ${clause} ORDER BY o.created_at DESC LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset));
  const { total } = (await (await getDb()).prepare(`SELECT COUNT(*) AS total FROM hr_orgs WHERE ${clause}`).get(...params));
  return { orgs, total };
}

/* ---------------------------------------------------------------- updates */

export async function createUpdate({ orgId, authorId, period = '', body, asks = '', metrics = '' }) {
  const info = (await (await getDb())
    .prepare(
      `INSERT INTO hr_updates (org_id, author_id, period, body, asks, metrics, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    )
    .get(orgId, authorId, period, body, asks, metrics, nowSeconds()));
  return Number(info.id);
}

export async function orgUpdates(orgId, { limit = 10, offset = 0 } = {}) {
  return (await (await getDb())
    .prepare('SELECT * FROM hr_updates WHERE org_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?')
    .all(orgId, limit, offset));
}

export async function recentUpdates(limit = 8) {
  return (await (await getDb())
    .prepare(
      `SELECT up.*, o.name AS org_name, o.slug AS org_slug FROM hr_updates up
       JOIN hr_orgs o ON o.id = up.org_id ORDER BY up.created_at DESC LIMIT ?`,
    )
    .all(limit));
}

/* ------------------------------------------------------------------ deals */

export async function createDeal({ vendor, title, category = 'other', summary = '', details = '',
  worth = '', code = '', url = null, expiresAt = null, postedBy,
  access = 'code', requirement = '', checked = '' }) {
  const slug = await uniqueSlug('hr_deals', `${vendor}-${title}`, 'deal');
  const info = (await (await getDb())
    .prepare(
      `INSERT INTO hr_deals (slug, vendor, title, category, summary, details, worth, code, url,
                             expires_at, posted_by, created_at, access, requirement, checked)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    )
    .get(slug, vendor, title, category, summary, details, worth, code, url,
      expiresAt, postedBy, nowSeconds(), access, requirement, checked));
  return Number(info.id);
}

/** Steward-only: fill in the code once the partner agreement lands. */
export async function setDealCode(dealId, code) {
  (await (await getDb()).prepare('UPDATE hr_deals SET code = ? WHERE id = ?').run(String(code || ''), dealId));
  return await getDeal(dealId);
}

export async function getDeal(idOrSlug) {
  const db = await getDb();
  return (/^\d+$/.test(String(idOrSlug))
    ? ((await db.prepare('SELECT * FROM hr_deals WHERE id = ?').get(Number(idOrSlug))))
    : ((await db.prepare('SELECT * FROM hr_deals WHERE slug = ?').get(String(idOrSlug))))) ?? null;
}

export async function listDeals({ category = '', q = '', limit = 100, offset = 0 } = {}) {
  const where = ['active = 1'];
  const params = [];
  if (category) { where.push('category = ?'); params.push(category); }
  if (q) {
    where.push(`(vendor ILIKE ? ESCAPE '\\' OR title ILIKE ? ESCAPE '\\' OR summary ILIKE ? ESCAPE '\\')`);
    params.push(...Array(3).fill(like(q)));
  }
  const clause = where.join(' AND ');
  const deals = (await (await getDb())
    .prepare(
      `SELECT d.*, (SELECT COUNT(*) FROM hr_deal_claims c WHERE c.deal_id = d.id) AS claim_count
       FROM hr_deals d WHERE ${clause} ORDER BY d.created_at DESC LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset));
  const { total } = (await (await getDb()).prepare(`SELECT COUNT(*) AS total FROM hr_deals WHERE ${clause}`).get(...params));
  return { deals, total };
}

export async function claimDeal(dealId, userId) {
  (await (await getDb())
    .prepare('INSERT INTO hr_deal_claims (deal_id, user_id, created_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING')
    .run(dealId, userId, nowSeconds()));
  return await getDeal(dealId);
}

export async function dealClaimCount(dealId) {
  return (await (await getDb()).prepare('SELECT COUNT(*) AS n FROM hr_deal_claims WHERE deal_id = ?').get(dealId)).n;
}

export async function hasClaimed(dealId, userId) {
  if (!userId) return false;
  return !!(await (await getDb()).prepare('SELECT 1 FROM hr_deal_claims WHERE deal_id = ? AND user_id = ?').get(dealId, userId));
}

export async function myClaims(userId) {
  return (await (await getDb())
    .prepare(
      `SELECT d.*, c.created_at AS claimed_at FROM hr_deal_claims c
       JOIN hr_deals d ON d.id = c.deal_id WHERE c.user_id = ? ORDER BY c.created_at DESC`,
    )
    .all(userId));
}

/* ---------------------------------------------------------------- funders */

export async function createFunder({ name, kind = 'vc', focus = '', stages = '', checkSize = '',
  location = '', website = null, description = '', dilutive = true, addedBy = null }) {
  const slug = await uniqueSlug('hr_funders', name, 'funder');
  const info = (await (await getDb())
    .prepare(
      `INSERT INTO hr_funders (slug, name, kind, focus, stages, check_size, location, website, description, dilutive, added_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    )
    .get(slug, name, kind, focus, stages, checkSize, location, website, description, int(dilutive), addedBy, nowSeconds()));
  return Number(info.id);
}

export async function getFunder(idOrSlug) {
  const db = await getDb();
  const row = /^\d+$/.test(String(idOrSlug))
    ? ((await db.prepare('SELECT * FROM hr_funders WHERE id = ?').get(Number(idOrSlug))))
    : ((await db.prepare('SELECT * FROM hr_funders WHERE slug = ?').get(String(idOrSlug))));
  if (!row) return null;
  return { ...row, ...(await funderRatings(row.id)) };
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
export async function funderRatings(funderId) {
  const row = (await (await getDb())
    .prepare(
      `SELECT COUNT(*) AS review_count, AVG(rating) AS avg_rating,
              AVG(speed) AS avg_speed, AVG(value_add) AS avg_value,
              AVG(founder_friendly) AS avg_friendly, AVG(terms) AS avg_terms,
              SUM(would_again) AS again_count, SUM(invested) AS invested_count
       FROM hr_funder_reviews WHERE funder_id = ?`,
    )
    .get(funderId));
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

export async function listFunders({ q = '', kind = '', stage = '', minRating = 0, sort = 'rating',
  limit = PAGE_SIZE, offset = 0 } = {}) {
  const where = ['1 = 1'];
  const params = [];
  if (q) {
    where.push(`(f.name ILIKE ? ESCAPE '\\' OR f.focus ILIKE ? ESCAPE '\\' OR f.description ILIKE ? ESCAPE '\\' OR f.location ILIKE ? ESCAPE '\\')`);
    params.push(...Array(4).fill(like(q)));
  }
  if (kind) { where.push('f.kind = ?'); params.push(kind); }
  if (stage) { where.push(`f.stages ILIKE ? ESCAPE '\\'`); params.push(like(stage)); }
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
  const funders = (await (await getDb())
    .prepare(`SELECT * FROM (${scored}) WHERE COALESCE(avg_rating, 0) >= ? ORDER BY ${order} LIMIT ? OFFSET ?`)
    .all(...params, minRating, limit, offset));
  const { total } = (await (await getDb())
    .prepare(`SELECT COUNT(*) AS total FROM (${scored}) WHERE COALESCE(avg_rating, 0) >= ?`)
    .get(...params, minRating));
  return { funders, total };
}

export async function upsertReview({ funderId, userId, rating, speed = null, valueAdd = null,
  founderFriendly = null, terms = null, wouldAgain = false, tags = '', stage = '', outcome = '',
  invested = false, anonymous = true, body = '' }) {
  (await (await getDb())
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
      int(wouldAgain), tags, stage, outcome, int(invested), int(anonymous), body, nowSeconds()));
  return await myReview(funderId, userId);
}

/**
 * Reviews, most-corroborated first.
 *
 * Sorting by helpful votes rather than recency is the whole design: the review
 * three other founders have said matches their experience is worth more than
 * the one posted this morning, and putting it first is what stops a single
 * angry account defining a fund's page.
 */
export async function funderReviews(funderId, { sort = 'helpful' } = {}) {
  const order = sort === 'recent' ? 'r.created_at DESC' : 'helpful DESC, r.created_at DESC';
  // `helpful` here is the computed vote count aliased below, not a column.
  return (await (await getDb())
    .prepare(
      `SELECT r.*,
              (SELECT COUNT(*) FROM hr_review_votes v WHERE v.review_id = r.id AND v.helpful = 1) AS helpful,
              (SELECT COUNT(*) FROM hr_review_comments c WHERE c.review_id = r.id AND c.deleted = 0) AS reply_count
       FROM hr_funder_reviews r WHERE r.funder_id = ? ORDER BY ${order}`,
    )
    .all(funderId));
}

export async function myReview(funderId, userId) {
  if (!userId) return null;
  return (await (await getDb()).prepare('SELECT * FROM hr_funder_reviews WHERE funder_id = ? AND user_id = ?').get(funderId, userId)) ?? null;
}

/* --------------------------------------------------------------- pipeline */

export async function upsertPipeline({ userId, funderId, orgId = null, status = 'researching', amount = '', notes = '' }) {
  const now = nowSeconds();
  (await (await getDb())
    .prepare(
      `INSERT INTO hr_pipeline (user_id, funder_id, org_id, status, amount, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id, funder_id) DO UPDATE SET
         org_id = excluded.org_id, status = excluded.status, amount = excluded.amount,
         notes = excluded.notes, updated_at = excluded.updated_at`,
    )
    .run(userId, funderId, orgId, status, amount, notes, now, now));
}

export async function removePipeline(userId, funderId) {
  (await (await getDb()).prepare('DELETE FROM hr_pipeline WHERE user_id = ? AND funder_id = ?').run(userId, funderId));
}

export async function pipeline(userId) {
  return (await (await getDb())
    .prepare(
      `SELECT pl.*, f.name AS funder_name, f.slug AS funder_slug, f.kind AS funder_kind,
              (SELECT ROUND(AVG(rating), 1) FROM hr_funder_reviews r WHERE r.funder_id = f.id) AS avg_rating
       FROM hr_pipeline pl JOIN hr_funders f ON f.id = pl.funder_id
       WHERE pl.user_id = ? ORDER BY pl.updated_at DESC`,
    )
    .all(userId));
}

export async function pipelineEntry(userId, funderId) {
  if (!userId) return null;
  return (await (await getDb()).prepare('SELECT * FROM hr_pipeline WHERE user_id = ? AND funder_id = ?').get(userId, funderId)) ?? null;
}

/* ----------------------------------------------------------- office hours */

export async function createSlot({ hostId, title, description = '', format = 'one-on-one',
  startsAt, minutes = 30, capacity = 1, place = '', topics = '', mentorId = null, url = '' }) {
  const info = (await (await getDb())
    .prepare(
      `INSERT INTO hr_slots (host_id, title, description, format, starts_at, minutes, capacity,
                             place, topics, created_at, mentor_id, url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    )
    .get(hostId, title, description, format, startsAt, minutes, Math.max(1, capacity),
      place, topics, nowSeconds(), mentorId, url));
  return Number(info.id);
}

export async function getSlot(id) {
  const row = (await (await getDb())
    .prepare(
      `SELECT s.*, n.name AS mentor_name, n.slug AS mentor_slug, n.org AS mentor_org,
              n.role AS mentor_role, n.track AS mentor_track, n.vetted AS mentor_vetted
       FROM hr_slots s LEFT JOIN hr_mentors n ON n.id = s.mentor_id WHERE s.id = ?`,
    )
    .get(Number(id)));
  if (!row) return null;
  row.booked = (await (await getDb()).prepare('SELECT COUNT(*) AS n FROM hr_bookings WHERE slot_id = ?').get(row.id)).n;
  return row;
}

export async function listSlots({ upcoming = true, hostId = '', mentorId = 0, track = '', limit = 60 } = {}) {
  const where = ['s.canceled = 0'];
  const params = [];
  if (upcoming) { where.push('s.starts_at > ?'); params.push(nowSeconds() - 3600); }
  if (hostId) { where.push('s.host_id = ?'); params.push(hostId); }
  if (mentorId) { where.push('s.mentor_id = ?'); params.push(mentorId); }
  if (track) { where.push('n.track = ?'); params.push(track); }
  return (await (await getDb())
    .prepare(
      `SELECT s.*, (SELECT COUNT(*) FROM hr_bookings b WHERE b.slot_id = s.id) AS booked,
              n.name AS mentor_name, n.slug AS mentor_slug, n.track AS mentor_track,
              n.org AS mentor_org, n.vetted AS mentor_vetted
       FROM hr_slots s LEFT JOIN hr_mentors n ON n.id = s.mentor_id
       WHERE ${where.join(' AND ')}
       ORDER BY s.starts_at ${upcoming ? 'ASC' : 'DESC'} LIMIT ?`,
    )
    .all(...params, limit));
}

export async function bookSlot(slotId, userId, question = '') {
  return transaction(async (db) => {
    const slot = ((await db.prepare('SELECT * FROM hr_slots WHERE id = ?').get(slotId)));
    if (!slot || slot.canceled) return { ok: false, error: 'no such slot' };
    if (slot.host_id === userId) return { ok: false, error: 'you are hosting this one' };
    if (slot.starts_at < nowSeconds()) return { ok: false, error: 'that slot has already happened' };
    const { n } = ((await db.prepare('SELECT COUNT(*) AS n FROM hr_bookings WHERE slot_id = ?').get(slotId)));
    const mine = ((await db.prepare('SELECT 1 FROM hr_bookings WHERE slot_id = ? AND user_id = ?').get(slotId, userId)));
    if (mine) return { ok: true, already: true };
    if (n >= slot.capacity) return { ok: false, error: 'that slot is full' };
    (await db.prepare('INSERT INTO hr_bookings (slot_id, user_id, question, created_at) VALUES (?, ?, ?, ?)')
      .run(slotId, userId, question, nowSeconds()));
    return { ok: true, hostId: slot.host_id };
  });
}

export async function cancelBooking(slotId, userId) {
  (await (await getDb()).prepare('DELETE FROM hr_bookings WHERE slot_id = ? AND user_id = ?').run(slotId, userId));
}

export async function cancelSlot(slotId) {
  (await (await getDb()).prepare('UPDATE hr_slots SET canceled = 1 WHERE id = ?').run(slotId));
}

export async function slotBookings(slotId) {
  return (await (await getDb()).prepare('SELECT * FROM hr_bookings WHERE slot_id = ? ORDER BY created_at').all(slotId));
}

export async function myBookings(userId) {
  return (await (await getDb())
    .prepare(
      `SELECT s.*, b.question, b.created_at AS booked_at FROM hr_bookings b
       JOIN hr_slots s ON s.id = b.slot_id
       WHERE b.user_id = ? AND s.canceled = 0 ORDER BY s.starts_at ASC`,
    )
    .all(userId));
}

/* ------------------------------------------------------------------- jobs */

export async function createJob({ orgId, postedBy, title, discipline = 'other', employment = 'full-time',
  location = '', remote = false, comp = '', equity = '', description = '', tags = '' }) {
  const info = (await (await getDb())
    .prepare(
      `INSERT INTO hr_jobs (org_id, posted_by, title, discipline, employment, location, remote, comp, equity, description, tags, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    )
    .get(orgId, postedBy, title, discipline, employment, location, int(remote), comp, equity, description, tags, nowSeconds()));
  return Number(info.id);
}

export async function getJob(id) {
  return (await (await getDb())
    .prepare(
      `SELECT j.*, o.name AS org_name, o.slug AS org_slug, o.kind AS org_kind
       FROM hr_jobs j JOIN hr_orgs o ON o.id = j.org_id WHERE j.id = ?`,
    )
    .get(Number(id))) ?? null;
}

export async function listJobs({ q = '', discipline = '', remote = false, orgId = 0, limit = 60, offset = 0 } = {}) {
  const where = ['j.closed = 0'];
  const params = [];
  if (q) {
    where.push(`(j.title ILIKE ? ESCAPE '\\' OR j.description ILIKE ? ESCAPE '\\' OR o.name ILIKE ? ESCAPE '\\')`);
    params.push(...Array(3).fill(like(q)));
  }
  if (discipline) { where.push('j.discipline = ?'); params.push(discipline); }
  if (remote) where.push('j.remote = 1');
  if (orgId) { where.push('j.org_id = ?'); params.push(orgId); }
  const clause = where.join(' AND ');
  const jobs = (await (await getDb())
    .prepare(
      `SELECT j.*, o.name AS org_name, o.slug AS org_slug,
              (SELECT COUNT(*) FROM hr_applications a WHERE a.job_id = j.id) AS applicant_count
       FROM hr_jobs j JOIN hr_orgs o ON o.id = j.org_id
       WHERE ${clause} ORDER BY j.created_at DESC LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset));
  const { total } = (await (await getDb())
    .prepare(`SELECT COUNT(*) AS total FROM hr_jobs j JOIN hr_orgs o ON o.id = j.org_id WHERE ${clause}`)
    .get(...params));
  return { jobs, total };
}

export async function applyToJob(jobId, userId, note = '') {
  (await (await getDb())
    .prepare('INSERT INTO hr_applications (job_id, user_id, note, created_at) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING')
    .run(jobId, userId, note, nowSeconds()));
}

export async function hasApplied(jobId, userId) {
  if (!userId) return false;
  return !!(await (await getDb()).prepare('SELECT 1 FROM hr_applications WHERE job_id = ? AND user_id = ?').get(jobId, userId));
}

export async function jobApplicants(jobId) {
  return (await (await getDb())
    .prepare(
      `SELECT a.*, m.name, m.headline FROM hr_applications a
       LEFT JOIN hr_members m ON m.user_id = a.user_id
       WHERE a.job_id = ? ORDER BY a.created_at DESC`,
    )
    .all(jobId));
}

export async function closeJob(id, closed = true) {
  (await (await getDb()).prepare('UPDATE hr_jobs SET closed = ? WHERE id = ?').run(int(closed), id));
}

/* ----------------------------------------------------------------- events */

export async function createEvent({ hostId, title, description = '', kind = 'meetup', startsAt,
  minutes = 90, place = '', url = null, capacity = 0 }) {
  const info = (await (await getDb())
    .prepare(
      `INSERT INTO hr_events (host_id, title, description, kind, starts_at, minutes, place, url, capacity, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    )
    .get(hostId, title, description, kind, startsAt, minutes, place, url, capacity, nowSeconds()));
  return Number(info.id);
}

export async function getEvent(id) {
  const row = (await (await getDb()).prepare('SELECT * FROM hr_events WHERE id = ?').get(Number(id)));
  if (!row) return null;
  row.going = (await (await getDb()).prepare("SELECT COUNT(*) AS n FROM hr_rsvps WHERE event_id = ? AND status = 'going'").get(row.id)).n;
  return row;
}

export async function listEvents({ upcoming = true, kind = '', limit = 60 } = {}) {
  const where = ['canceled = 0'];
  const params = [];
  if (upcoming) { where.push('starts_at > ?'); params.push(nowSeconds() - 7200); }
  else { where.push('starts_at <= ?'); params.push(nowSeconds()); }
  if (kind) { where.push('kind = ?'); params.push(kind); }
  return (await (await getDb())
    .prepare(
      `SELECT e.*, (SELECT COUNT(*) FROM hr_rsvps r WHERE r.event_id = e.id AND r.status = 'going') AS going
       FROM hr_events e WHERE ${where.join(' AND ')}
       ORDER BY e.starts_at ${upcoming ? 'ASC' : 'DESC'} LIMIT ?`,
    )
    .all(...params, limit));
}

export async function rsvp(eventId, userId, status = 'going') {
  const now = nowSeconds();
  if (status === 'none') {
    (await (await getDb()).prepare('DELETE FROM hr_rsvps WHERE event_id = ? AND user_id = ?').run(eventId, userId));
    return;
  }
  (await (await getDb())
    .prepare(
      `INSERT INTO hr_rsvps (event_id, user_id, status, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (event_id, user_id) DO UPDATE SET status = excluded.status`,
    )
    .run(eventId, userId, status, now));
}

export async function myRsvp(eventId, userId) {
  if (!userId) return null;
  return (await (await getDb()).prepare('SELECT status FROM hr_rsvps WHERE event_id = ? AND user_id = ?').get(eventId, userId))?.status ?? null;
}

export async function eventAttendees(eventId) {
  return (await (await getDb())
    .prepare(
      `SELECT r.user_id, r.status, m.name, m.headline FROM hr_rsvps r
       LEFT JOIN hr_members m ON m.user_id = r.user_id
       WHERE r.event_id = ? ORDER BY r.created_at`,
    )
    .all(eventId));
}

export async function cancelEvent(id) {
  (await (await getDb()).prepare('UPDATE hr_events SET canceled = 1 WHERE id = ?').run(id));
}

/* ---------------------------------------------------------------- library */

export async function createLibraryEntry({ title, kind = 'guide', summary = '', body = '', tags = '', authorId = null }) {
  const now = nowSeconds();
  const slug = await uniqueSlug('hr_library', title, 'entry');
  const info = (await (await getDb())
    .prepare(
      `INSERT INTO hr_library (slug, title, kind, summary, body, tags, author_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    )
    .get(slug, title, kind, summary, body, tags, authorId, now, now));
  return Number(info.id);
}

export async function getLibraryEntry(idOrSlug) {
  const db = await getDb();
  return (/^\d+$/.test(String(idOrSlug))
    ? ((await db.prepare('SELECT * FROM hr_library WHERE id = ?').get(Number(idOrSlug))))
    : ((await db.prepare('SELECT * FROM hr_library WHERE slug = ?').get(String(idOrSlug))))) ?? null;
}

export async function listLibrary({ q = '', kind = '', limit = 60, offset = 0 } = {}) {
  const where = ['1 = 1'];
  const params = [];
  if (q) {
    where.push(`(title ILIKE ? ESCAPE '\\' OR summary ILIKE ? ESCAPE '\\' OR body ILIKE ? ESCAPE '\\' OR tags ILIKE ? ESCAPE '\\')`);
    params.push(...Array(4).fill(like(q)));
  }
  if (kind) { where.push('kind = ?'); params.push(kind); }
  const clause = where.join(' AND ');
  const entries = (await (await getDb())
    .prepare(`SELECT * FROM hr_library WHERE ${clause} ORDER BY updated_at DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset));
  const { total } = (await (await getDb()).prepare(`SELECT COUNT(*) AS total FROM hr_library WHERE ${clause}`).get(...params));
  return { entries, total };
}

export async function bumpReads(id) {
  (await (await getDb()).prepare('UPDATE hr_library SET reads = reads + 1 WHERE id = ?').run(id));
}

/* ----------------------------------------------------------------- intros */

export async function requestIntro({ requesterId, targetId, reason }) {
  const existing = (await (await getDb())
    .prepare("SELECT id FROM hr_intros WHERE requester_id = ? AND target_id = ? AND status = 'pending'")
    .get(requesterId, targetId));
  if (existing) return { ok: false, error: 'you already have a pending request to this member', id: existing.id };
  const info = (await (await getDb())
    .prepare('INSERT INTO hr_intros (requester_id, target_id, reason, created_at) VALUES (?, ?, ?, ?) RETURNING id')
    .get(requesterId, targetId, reason, nowSeconds()));
  return { ok: true, id: Number(info.id) };
}

export async function getIntro(id) {
  return (await (await getDb()).prepare('SELECT * FROM hr_intros WHERE id = ?').get(Number(id))) ?? null;
}

/**
 * Accepting an intro opens a message thread with both members in it — the
 * request is only useful if it ends in a conversation.
 */
export async function resolveIntro(id, status) {
  const intro = await getIntro(id);
  if (!intro || intro.status !== 'pending') return null;
  (await (await getDb()).prepare('UPDATE hr_intros SET status = ?, resolved_at = ? WHERE id = ?').run(status, nowSeconds(), id));
  if (status !== 'accepted') return { intro, threadId: null };
  const threadId = await createThread({
    createdBy: intro.target_id,
    subject: `Intro: ${intro.requester_id} ↔ ${intro.target_id}`,
    memberIds: [intro.requester_id, intro.target_id],
  });
  await sendMessage({ threadId, senderId: intro.target_id, body: `Happy to talk. Context from the request:\n\n${intro.reason}` });
  return { intro, threadId };
}

export async function introsFor(userId) {
  const db = await getDb();
  return {
    incoming: ((await db.prepare('SELECT * FROM hr_intros WHERE target_id = ? ORDER BY created_at DESC LIMIT 50').all(userId))),
    outgoing: ((await db.prepare('SELECT * FROM hr_intros WHERE requester_id = ? ORDER BY created_at DESC LIMIT 50').all(userId))),
  };
}

export async function pendingIntroCount(userId) {
  return (await (await getDb())
    .prepare("SELECT COUNT(*) AS n FROM hr_intros WHERE target_id = ? AND status = 'pending'")
    .get(userId)).n;
}

/* --------------------------------------------------------------- messages */

export async function createThread({ createdBy, subject = '', memberIds = [] }) {
  const now = nowSeconds();
  return transaction(async (db) => {
    const created = await db
      .prepare(`INSERT INTO hr_threads (subject, created_by, created_at, last_at)
                VALUES (?, ?, ?, ?) RETURNING id`)
      .get(subject, createdBy, now, now);
    const id = Number(created.id);
    const insert = db.prepare(
      `INSERT INTO hr_thread_members (thread_id, user_id, last_read_at)
       VALUES (?, ?, ?) ON CONFLICT DO NOTHING`,
    );
    for (const member of new Set([createdBy, ...memberIds])) {
      await insert.run(id, member, member === createdBy ? now : 0);
    }
    return id;
  });
}

/** One-to-one threads are reused so a DM list does not sprout duplicates. */
export async function findDirectThread(a, b) {
  return (await (await getDb())
    .prepare(
      `SELECT t.id FROM hr_threads t
       JOIN hr_thread_members m1 ON m1.thread_id = t.id AND m1.user_id = ?
       JOIN hr_thread_members m2 ON m2.thread_id = t.id AND m2.user_id = ?
       WHERE (SELECT COUNT(*) FROM hr_thread_members m WHERE m.thread_id = t.id) = 2
       ORDER BY t.id LIMIT 1`,
    )
    .get(a, b))?.id ?? null;
}

export async function openDirectThread(a, b) {
  return await findDirectThread(a, b) ?? await createThread({ createdBy: a, subject: '', memberIds: [b] });
}

export async function sendMessage({ threadId, senderId, body }) {
  const now = nowSeconds();
  return transaction(async (db) => {
    const member = ((await db.prepare('SELECT 1 FROM hr_thread_members WHERE thread_id = ? AND user_id = ?').get(threadId, senderId)));
    if (!member) throw new Error('not a member of this thread');
    const info = (await db
      .prepare('INSERT INTO hr_messages (thread_id, sender_id, body, created_at) VALUES (?, ?, ?, ?) RETURNING id')
      .get(threadId, senderId, body, now));
    ((await db.prepare('UPDATE hr_threads SET last_at = ? WHERE id = ?').run(now, threadId)));
    (await db.prepare('UPDATE hr_thread_members SET last_read_at = ? WHERE thread_id = ? AND user_id = ?')
      .run(now, threadId, senderId));
    return Number(info.id);
  });
}

export async function threadsFor(userId) {
  const rows = (await (await getDb())
    .prepare(
      `SELECT t.*, tm.last_read_at,
              (SELECT COUNT(*) FROM hr_messages m WHERE m.thread_id = t.id AND m.created_at > tm.last_read_at
                AND m.sender_id <> ?) AS unread,
              (SELECT body FROM hr_messages m WHERE m.thread_id = t.id ORDER BY m.created_at DESC LIMIT 1) AS last_body,
              (SELECT sender_id FROM hr_messages m WHERE m.thread_id = t.id ORDER BY m.created_at DESC LIMIT 1) AS last_sender
       FROM hr_thread_members tm JOIN hr_threads t ON t.id = tm.thread_id
       WHERE tm.user_id = ? ORDER BY t.last_at DESC LIMIT 100`,
    )
    .all(userId, userId));
  for (const row of rows) row.members = await threadMembers(row.id);
  return rows;
}

export async function threadMembers(threadId) {
  return (await (await getDb())
    .prepare('SELECT user_id FROM hr_thread_members WHERE thread_id = ?')
    .all(threadId))
    .map((r) => r.user_id);
}

export async function getThread(threadId, userId) {
  const thread = (await (await getDb()).prepare('SELECT * FROM hr_threads WHERE id = ?').get(Number(threadId)));
  if (!thread) return null;
  const members = await threadMembers(thread.id);
  if (userId && !members.includes(userId)) return null;
  thread.members = members;
  thread.messages = (await (await getDb())
    .prepare('SELECT * FROM hr_messages WHERE thread_id = ? ORDER BY created_at ASC LIMIT 500')
    .all(thread.id));
  return thread;
}

export async function markThreadRead(threadId, userId) {
  (await (await getDb())
    .prepare('UPDATE hr_thread_members SET last_read_at = ? WHERE thread_id = ? AND user_id = ?')
    .run(nowSeconds(), threadId, userId));
}

export async function unreadMessageCount(userId) {
  return (await (await getDb())
    .prepare(
      `SELECT COUNT(*) AS n FROM hr_messages m
       JOIN hr_thread_members tm ON tm.thread_id = m.thread_id AND tm.user_id = ?
       WHERE m.created_at > tm.last_read_at AND m.sender_id <> ?`,
    )
    .get(userId, userId)).n;
}

/* ---------------------------------------------------------- notifications */

export async function notify({ userId, kind, actorId = null, text, href = '/homeroom' }) {
  if (!userId || userId === actorId) return null;
  const info = (await (await getDb())
    .prepare('INSERT INTO hr_notifications (user_id, kind, actor_id, text, href, created_at) VALUES (?, ?, ?, ?, ?, ?) RETURNING id')
    .get(userId, kind, actorId, text, href, nowSeconds()));
  return Number(info.id);
}

/** Fan a thread reply out to everyone following the post. */
export async function notifyFollowers({ postId, actorId, text, href }) {
  for (const userId of followers('post', postId)) {
    await notify({ userId, kind: 'reply', actorId, text, href });
  }
}

export async function notifications(userId, { limit = 50 } = {}) {
  return (await (await getDb())
    .prepare('SELECT * FROM hr_notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?')
    .all(userId, limit));
}

export async function unreadNotificationCount(userId) {
  return (await (await getDb())
    .prepare('SELECT COUNT(*) AS n FROM hr_notifications WHERE user_id = ? AND read_at IS NULL')
    .get(userId)).n;
}

export async function markNotificationsRead(userId) {
  (await (await getDb()).prepare('UPDATE hr_notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL')
    .run(nowSeconds(), userId));
}

/* ------------------------------------------------------- search and stats */

/** One box over members, labs, funders, perks and the library. */
export async function globalSearch(query, { limit = 8 } = {}) {
  const q = String(query || '').trim();
  if (!q) return { members: [], orgs: [], funders: [], deals: [], library: [] };
  return {
    members: (await searchMembers({ q, limit })).members,
    orgs: (await searchOrgs({ q, limit })).orgs,
    funders: (await listFunders({ q, limit })).funders,
    deals: (await listDeals({ q, limit })).deals,
    library: (await listLibrary({ q, limit })).entries,
  };
}

/**
 * The counts behind the home page and /homeroom/health.
 *
 * One query with eighteen scalar subselects rather than eighteen queries. On
 * SQLite that was a stylistic preference; with the database on the other end of
 * a network it is eighteen round trips against one, on a page every signed-in
 * member loads.
 */
export async function networkStats() {
  const db = await getDb();
  const now = nowSeconds();
  const row = (await db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM hr_members)                                   AS members,
      (SELECT COUNT(*) FROM hr_orgs)                                      AS orgs,
      (SELECT COUNT(*) FROM hr_deals WHERE active = 1)                    AS deals,
      (SELECT COUNT(*) FROM hr_funders)                                   AS funders,
      (SELECT COUNT(*) FROM hr_funder_reviews)                            AS reviews,
      (SELECT COUNT(*) FROM hr_jobs WHERE closed = 0)                     AS jobs,
      (SELECT COUNT(*) FROM hr_slots
        WHERE canceled = 0 AND starts_at > ?)                             AS slots,
      (SELECT COUNT(*) FROM hr_events
        WHERE canceled = 0 AND starts_at > ?)                             AS events,
      (SELECT COUNT(*) FROM hr_library)                                   AS library,
      (SELECT COUNT(*) FROM hr_mentors WHERE active = 1)                  AS mentors,
      (SELECT COUNT(*) FROM hr_mentors WHERE active = 1 AND vetted = 1)   AS vetted,
      (SELECT COUNT(*) FROM hr_atlas)                                     AS atlas,
      (SELECT COUNT(*) FROM hr_atlas WHERE status = 'active')             AS "atlasActive",
      (SELECT COUNT(*) FROM hr_modules)                                   AS modules,
      (SELECT COUNT(*) FROM hr_yearbook)                                  AS yearbook
  `).get(now, now));
  return row;
}

/* ==========================================================================
 * ONBOARDING
 *
 * The first-run checklist is DERIVED, never stored. Every step is already
 * recorded somewhere as a side effect of doing the thing — a headline on the
 * profile, a row in hr_deal_claims, a booking, a progress row — so storing a
 * second copy would only create a way for the two to disagree. It also means a
 * member who did a step before ever seeing this page gets credit for it.
 * ======================================================================== */

export async function onboardingSteps(userId) {
  const db = await getDb();
  const member = await getMember(userId) || {};
  // One query for all five, for the same reason as networkStats: this renders
  // on the home page and on /homeroom/welcome.
  const done = (await db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM hr_yearbook    WHERE user_id = ?) AS yearbook,
      (SELECT COUNT(*) FROM hr_deal_claims WHERE user_id = ?) AS perk,
      (SELECT COUNT(*) FROM hr_progress    WHERE user_id = ?) AS manual,
      (SELECT COUNT(*) FROM hr_bookings    WHERE user_id = ?) AS hours,
      (SELECT COUNT(*) FROM hr_org_members WHERE user_id = ?) AS lab
  `).get(userId, userId, userId, userId, userId));

  return [
    {
      key: 'profile',
      title: 'Fill in your profile',
      why: 'The directory is the whole point, and it only works if people can find you. '
        + 'A headline and a few expertise tags is enough to start.',
      href: '/homeroom/settings',
      action: 'Edit your profile',
      done: !!(member.headline && (member.expertise || []).length),
    },
    {
      key: 'yearbook',
      title: 'Add yourself to the yearbook',
      why: 'The founder wall is how a cohort remembers itself. What you are building, '
        + 'and what you were before.',
      href: '/homeroom/yearbook/edit',
      action: 'Write your entry',
      done: done.yearbook > 0,
    },
    {
      key: 'perk',
      title: 'Claim a perk',
      why: 'Cloud credits, gene synthesis, legal, accounting — most of it is free or nearly '
        + 'free to a resident who asks.',
      href: '/homeroom/perks',
      action: 'Browse the perks',
      done: done.perk > 0,
    },
    {
      key: 'manual',
      title: 'Start a track in the manual',
      why: 'Six tracks, each module ending in something you actually produced rather than '
        + 'something you read.',
      href: '/homeroom/library',
      action: 'Open the manual',
      done: done.manual > 0,
    },
    {
      key: 'hours',
      title: 'Book office hours or find a mentor',
      why: 'The fastest way through a problem someone here has already solved.',
      href: '/homeroom/mentors',
      action: 'Find a mentor',
      done: done.hours > 0,
    },
    {
      key: 'lab',
      title: 'Add your lab',
      why: 'So collaborators, hires and the rest of the network can find what you are '
        + 'building. Skip it if you are not building under a name yet.',
      href: '/homeroom/labs/new',
      action: 'Add a lab',
      optional: true,
      done: done.lab > 0,
    },
  ];
}

/** Where a member is up to. Optional steps do not count against them. */
export async function onboardingProgress(userId) {
  const steps = await onboardingSteps(userId);
  const required = steps.filter((s) => !s.optional);
  return {
    steps,
    done: required.filter((s) => s.done).length,
    total: required.length,
    complete: required.every((s) => s.done),
  };
}

/* ==========================================================================
 * YEARBOOK
 * ======================================================================== */

export async function getYearbook(userId) {
  return (await (await getDb()).prepare('SELECT * FROM hr_yearbook WHERE user_id = ?').get(userId)) ?? null;
}

export async function upsertYearbook(userId, patch = {}) {
  const current = await getYearbook(userId) || {};
  const value = (key, fallback = '') => (patch[key] === undefined ? (current[key] ?? fallback) : patch[key]);
  (await (await getDb())
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
      value('site_url'), int(value('featured', 0)), nowSeconds()));
  return await getYearbook(userId);
}

/**
 * The wall. One row per member who has a yearbook entry or a cohort, ordered so
 * that the people who filled theirs in come first — the alternative is a grid
 * of blank cards, which is how every founder wall dies.
 */
export async function yearbookWall({ cohort = '', house = '', q = '', tag = '',
  limit = 200, offset = 0 } = {}) {
  const where = ['1 = 1'];
  const params = [];
  if (cohort) { where.push('COALESCE(NULLIF(y.cohort, \'\'), m.cohort) = ?'); params.push(cohort); }
  if (house) { where.push('y.house = ?'); params.push(house); }
  if (tag) { where.push('EXISTS (SELECT 1 FROM hr_expertise e WHERE e.user_id = m.user_id AND e.tag = ?)'); params.push(tag); }
  if (q) {
    where.push(`(m.name ILIKE ? ESCAPE '\\' OR m.user_id ILIKE ? ESCAPE '\\' OR m.headline ILIKE ? ESCAPE '\\'
                 OR y.venture ILIKE ? ESCAPE '\\' OR y.one_liner ILIKE ? ESCAPE '\\' OR m.org ILIKE ? ESCAPE '\\')`);
    params.push(...Array(6).fill(like(q)));
  }
  const clause = where.join(' AND ');
  const rows = (await (await getDb())
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
       ORDER BY featured DESC, has_entry DESC, lower(m.name), m.user_id
       LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset));
  const { total } = (await (await getDb())
    .prepare(
      `SELECT COUNT(*) AS total FROM hr_members m
       LEFT JOIN hr_yearbook y ON y.user_id = m.user_id WHERE ${clause}`,
    )
    .get(...params));
  for (const row of rows) {
    row.cohort = row.y_cohort || row.cohort || '';
    row.expertise = await memberExpertise(row.user_id);
  }
  return { members: rows, total };
}

/** Cohorts as the wall sees them: the yearbook value wins over the profile. */
export async function wallCohorts() {
  return (await (await getDb())
    .prepare(
      `SELECT cohort, COUNT(*) AS n FROM (
         SELECT COALESCE(NULLIF(y.cohort, ''), m.cohort) AS cohort
         FROM hr_members m LEFT JOIN hr_yearbook y ON y.user_id = m.user_id
       ) WHERE cohort IS NOT NULL AND cohort <> '' GROUP BY cohort ORDER BY cohort DESC`,
    )
    .all());
}

export async function houses() {
  return (await (await getDb())
    .prepare(`SELECT house, COUNT(*) AS n FROM hr_yearbook WHERE house <> '' GROUP BY house ORDER BY house`)
    .all());
}

export async function signatures(userId) {
  return (await (await getDb())
    .prepare('SELECT * FROM hr_signatures WHERE user_id = ? ORDER BY created_at DESC')
    .all(userId));
}

export async function signYearbook({ userId, authorId, body }) {
  const text = String(body || '').trim().slice(0, 600);
  if (!text) return { ok: false, error: 'Write something first.' };
  if (userId === authorId) return { ok: false, error: 'You cannot sign your own yearbook.' };
  (await (await getDb())
    .prepare(
      `INSERT INTO hr_signatures (user_id, author_id, body, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (user_id, author_id) DO UPDATE SET body = excluded.body, created_at = excluded.created_at`,
    )
    .run(userId, authorId, text, nowSeconds()));
  return { ok: true };
}

/* ==========================================================================
 * BIOLAB ATLAS
 * ======================================================================== */

export async function upsertLab(lab) {
  const slug = slugify(`${lab.name}-${lab.city}`, 'lab');
  const existing = (await (await getDb()).prepare('SELECT id FROM hr_atlas WHERE slug = ?').get(slug));
  const capabilities = Array.isArray(lab.capabilities) ? lab.capabilities.join(',') : (lab.capabilities || '');
  if (existing) {
    (await (await getDb())
      .prepare(
        `UPDATE hr_atlas SET name = ?, city = ?, country = ?, region = ?, kind = ?, status = ?,
                bsl = ?, website = ?, capabilities = ?, note = ?, source = ? WHERE id = ?`,
      )
      .run(lab.name, lab.city, lab.country, lab.region, lab.kind, lab.status,
        lab.bsl || '', lab.website || null, capabilities, lab.note || '', lab.source || '', existing.id));
    return existing.id;
  }
  const info = (await (await getDb())
    .prepare(
      `INSERT INTO hr_atlas (slug, name, city, country, region, kind, status, bsl, website,
                             capabilities, note, source, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    )
    .get(slug, lab.name, lab.city, lab.country, lab.region, lab.kind, lab.status,
      lab.bsl || '', lab.website || null, capabilities, lab.note || '', lab.source || '', nowSeconds()));
  return Number(info.id);
}

export async function getLab(idOrSlug) {
  const db = await getDb();
  const row = (/^\d+$/.test(String(idOrSlug))
    ? ((await db.prepare('SELECT * FROM hr_atlas WHERE id = ?').get(Number(idOrSlug))))
    : ((await db.prepare('SELECT * FROM hr_atlas WHERE slug = ?').get(String(idOrSlug))))) ?? null;
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
export async function searchLabs({ q = '', region = '', country = '', status = '', kind = '',
  capability = '', limit = 300, offset = 0 } = {}) {
  const where = ['1 = 1'];
  const params = [];
  if (region) { where.push('region = ?'); params.push(region); }
  if (country) { where.push('country = ?'); params.push(country); }
  if (status) { where.push('status = ?'); params.push(status); }
  if (kind) { where.push('kind = ?'); params.push(kind); }
  if (capability) { where.push(`capabilities ILIKE ? ESCAPE '\\'`); params.push(like(capability)); }
  if (q) {
    where.push(`(name ILIKE ? ESCAPE '\\' OR city ILIKE ? ESCAPE '\\' OR country ILIKE ? ESCAPE '\\'
                 OR note ILIKE ? ESCAPE '\\' OR capabilities ILIKE ? ESCAPE '\\')`);
    params.push(...Array(5).fill(like(q)));
  }
  const clause = where.join(' AND ');
  const rows = (await (await getDb())
    .prepare(
      `SELECT *, (SELECT COUNT(*) FROM hr_atlas_reports r WHERE r.lab_id = hr_atlas.id) AS reports
       FROM hr_atlas WHERE ${clause}
       ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'limited' THEN 1 WHEN 'unknown' THEN 2 ELSE 3 END,
                country, city, name
       LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset));
  const { total } = (await (await getDb()).prepare(`SELECT COUNT(*) AS total FROM hr_atlas WHERE ${clause}`).get(...params));
  return {
    labs: rows.map((row) => ({ ...row, capabilities: tagList(row.capabilities) })),
    total,
  };
}

export async function atlasFacets() {
  const db = await getDb();
  return {
    regions: ((await db.prepare(`SELECT region AS slug, region AS label, COUNT(*) AS count FROM hr_atlas
                         WHERE region <> '' GROUP BY region ORDER BY count DESC`).all())),
    countries: ((await db.prepare(`SELECT country AS slug, country AS label, COUNT(*) AS count FROM hr_atlas
                           WHERE country <> '' GROUP BY country ORDER BY country`).all())),
    statuses: ((await db.prepare(`SELECT status AS slug, status AS label, COUNT(*) AS count FROM hr_atlas
                          GROUP BY status`).all())),
  };
}

/**
 * A member reporting what they actually found. The report also moves the lab's
 * status, because a first-hand account from last month outranks any directory —
 * that is the entire premise of keeping an atlas rather than linking to one.
 */
export async function reportLab({ labId, userId, status, body = '' }) {
  const valid = ['active', 'limited', 'dormant', 'unknown'];
  if (!valid.includes(status)) return { ok: false, error: 'Unknown status.' };
  return transaction(async (db) => {
    const now = nowSeconds();
    (await db.prepare('INSERT INTO hr_atlas_reports (lab_id, user_id, status, body, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(labId, userId, status, String(body || '').slice(0, 2000), now));
    (await db.prepare('UPDATE hr_atlas SET status = ?, confirmed_by = ?, confirmed_at = ? WHERE id = ?')
      .run(status, userId, now, labId));
    return { ok: true };
  });
}

export async function labReports(labId) {
  return (await (await getDb())
    .prepare('SELECT * FROM hr_atlas_reports WHERE lab_id = ? ORDER BY created_at DESC LIMIT 20')
    .all(labId));
}

/* ==========================================================================
 * MENTORS
 * ======================================================================== */

export async function upsertMentor(mentor) {
  const slug = slugify(mentor.name, 'mentor');
  const tags = Array.isArray(mentor.tags) ? mentor.tags.join(',') : (mentor.tags || '');
  const existing = (await (await getDb()).prepare('SELECT id FROM hr_mentors WHERE slug = ?').get(slug));
  if (existing) {
    (await (await getDb())
      .prepare(
        `UPDATE hr_mentors SET name = ?, role = ?, org = ?, track = ?, tags = ?, location = ?,
                bio = ?, format = ?, scheduler = ?, vetted = ?, user_id = ?, source = ? WHERE id = ?`,
      )
      .run(mentor.name, mentor.role || '', mentor.org || '', mentor.track || 'founder', tags,
        mentor.location || '', mentor.bio || '', mentor.format || 'one-on-one',
        mentor.scheduler || '', int(mentor.vetted), mentor.userId || null,
        mentor.source || 'seed', existing.id));
    return existing.id;
  }
  const info = (await (await getDb())
    .prepare(
      `INSERT INTO hr_mentors (slug, user_id, name, role, org, track, tags, location, bio,
                               format, scheduler, vetted, source, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    )
    .get(slug, mentor.userId || null, mentor.name, mentor.role || '', mentor.org || '',
      mentor.track || 'founder', tags, mentor.location || '', mentor.bio || '',
      mentor.format || 'one-on-one', mentor.scheduler || '', int(mentor.vetted),
      mentor.source || 'seed', nowSeconds()));
  return Number(info.id);
}

export async function getMentor(idOrSlug) {
  const db = await getDb();
  const row = (/^\d+$/.test(String(idOrSlug))
    ? ((await db.prepare('SELECT * FROM hr_mentors WHERE id = ?').get(Number(idOrSlug))))
    : ((await db.prepare('SELECT * FROM hr_mentors WHERE slug = ?').get(String(idOrSlug))))) ?? null;
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
export async function searchMentors({ q = '', track = '', tag = '', vetted = false, format = '',
  limit = 60, offset = 0 } = {}) {
  const where = ['active = 1'];
  const params = [];
  if (track) { where.push('track = ?'); params.push(track); }
  if (format) { where.push('format = ?'); params.push(format); }
  if (vetted) where.push('vetted = 1');
  if (tag) { where.push(`(',' || tags || ',') ILIKE ? ESCAPE '\\'`); params.push(`%,${tag},%`); }
  if (q) {
    where.push(`(name ILIKE ? ESCAPE '\\' OR org ILIKE ? ESCAPE '\\' OR role ILIKE ? ESCAPE '\\'
                 OR tags ILIKE ? ESCAPE '\\' OR location ILIKE ? ESCAPE '\\' OR bio ILIKE ? ESCAPE '\\')`);
    params.push(...Array(6).fill(like(q)));
  }
  const clause = where.join(' AND ');
  const rows = (await (await getDb())
    .prepare(
      `SELECT m.*,
              (SELECT COUNT(*) FROM hr_slots s
                WHERE s.mentor_id = m.id AND s.canceled = 0 AND s.starts_at > ?) AS open_slots
       FROM hr_mentors m WHERE ${clause}
       ORDER BY vetted DESC, open_slots DESC, lower(name) LIMIT ? OFFSET ?`,
    )
    .all(nowSeconds(), ...params, limit, offset));
  const { total } = (await (await getDb()).prepare(`SELECT COUNT(*) AS total FROM hr_mentors WHERE ${clause}`).get(...params));
  return { mentors: rows.map((row) => ({ ...row, tags: tagList(row.tags) })), total };
}

export async function mentorTagCloud(limit = 40) {
  const rows = (await (await getDb()).prepare('SELECT tags FROM hr_mentors WHERE active = 1').all());
  const counts = new Map();
  for (const row of rows) {
    for (const tag of tagList(row.tags)) counts.set(tag, (counts.get(tag) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([slug, count]) => ({ slug, label: slug, count }));
}

export async function mentorSlots(mentorId) {
  return (await (await getDb())
    .prepare(
      `SELECT s.*, (SELECT COUNT(*) FROM hr_bookings b WHERE b.slot_id = s.id) AS booked
       FROM hr_slots s WHERE s.mentor_id = ? AND s.canceled = 0 AND s.starts_at > ?
       ORDER BY s.starts_at`,
    )
    .all(mentorId, nowSeconds()));
}

export async function bumpMentorSessions(mentorId) {
  (await (await getDb()).prepare('UPDATE hr_mentors SET sessions = sessions + 1 WHERE id = ?').run(mentorId));
}

/* ==========================================================================
 * FUNDER REVIEW REPLIES AND VOTES
 * ======================================================================== */

export async function getReview(id) {
  return (await (await getDb()).prepare('SELECT * FROM hr_funder_reviews WHERE id = ?').get(id)) ?? null;
}

export async function addReviewComment({ reviewId, authorId, body, anonymous = false }) {
  const text = String(body || '').trim();
  if (!text) return { ok: false, error: 'Nothing to add.' };
  const info = (await (await getDb())
    .prepare('INSERT INTO hr_review_comments (review_id, author_id, body, anonymous, created_at) VALUES (?, ?, ?, ?, ?) RETURNING id')
    .get(reviewId, authorId, text.slice(0, 4000), int(anonymous), nowSeconds()));
  return { ok: true, id: Number(info.id) };
}

export async function reviewComments(reviewIds) {
  if (!reviewIds.length) return {};
  const rows = (await (await getDb())
    .prepare(
      `SELECT * FROM hr_review_comments
       WHERE review_id IN (${placeholders(reviewIds.length)}) AND deleted = 0
       ORDER BY created_at`,
    )
    .all(...reviewIds));
  const out = {};
  for (const row of rows) (out[row.review_id] ||= []).push(row);
  return out;
}

export async function deleteReviewComment(id, userId, { isAdmin = false } = {}) {
  const row = (await (await getDb()).prepare('SELECT * FROM hr_review_comments WHERE id = ?').get(id));
  if (!row || (row.author_id !== userId && !isAdmin)) return false;
  (await (await getDb()).prepare('UPDATE hr_review_comments SET deleted = 1 WHERE id = ?').run(id));
  return true;
}

/** "This matches my experience." Toggles, so it can be taken back. */
export async function toggleReviewHelpful(reviewId, userId) {
  const db = await getDb();
  const existing = (await db.prepare('SELECT 1 FROM hr_review_votes WHERE review_id = ? AND user_id = ?')
    .get(reviewId, userId));
  if (existing) {
    ((await db.prepare('DELETE FROM hr_review_votes WHERE review_id = ? AND user_id = ?').run(reviewId, userId)));
    return false;
  }
  (await db.prepare('INSERT INTO hr_review_votes (review_id, user_id, helpful, created_at) VALUES (?, ?, 1, ?)')
    .run(reviewId, userId, nowSeconds()));
  return true;
}

export async function helpfulIds(userId, reviewIds) {
  if (!userId || !reviewIds.length) return new Set();
  const rows = (await (await getDb())
    .prepare(`SELECT review_id FROM hr_review_votes WHERE user_id = ? AND review_id IN (${placeholders(reviewIds.length)})`)
    .all(userId, ...reviewIds));
  return new Set(rows.map((row) => row.review_id));
}

/** The tags reviewers reach for most on one funder — the shape of the pattern. */
export async function funderTagCloud(funderId, limit = 8) {
  const rows = (await (await getDb()).prepare('SELECT tags FROM hr_funder_reviews WHERE funder_id = ?').all(funderId));
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

export async function upsertTrack(track, position = 0) {
  (await (await getDb())
    .prepare(
      `INSERT INTO hr_tracks (slug, title, focus, blurb, position) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (slug) DO UPDATE SET title = excluded.title, focus = excluded.focus,
         blurb = excluded.blurb, position = excluded.position`,
    )
    .run(track.slug, track.title, track.focus || '', track.blurb || '', position));
}

export async function upsertModule(module, position = 0) {
  (await (await getDb())
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
      module.deliverable || '', module.minutes || 45, module.week || 0, position));
}

const splitLines = (value) => String(value || '').split('\n').map((s) => s.trim()).filter(Boolean);

function hydrateModule(row) {
  if (!row) return null;
  return { ...row, outcomes: splitLines(row.outcomes), work: splitLines(row.work) };
}

export async function tracks() {
  return (await (await getDb()).prepare('SELECT * FROM hr_tracks ORDER BY position, title').all());
}

export async function getTrack(slug) {
  return (await (await getDb()).prepare('SELECT * FROM hr_tracks WHERE slug = ?').get(slug)) ?? null;
}

export async function getModule(idOrSlug) {
  const db = await getDb();
  return hydrateModule(/^\d+$/.test(String(idOrSlug))
    ? ((await db.prepare('SELECT * FROM hr_modules WHERE id = ?').get(Number(idOrSlug))))
    : ((await db.prepare('SELECT * FROM hr_modules WHERE slug = ?').get(String(idOrSlug)))));
}

export async function listModules({ track = '', kind = '', q = '', week = 0, userId = '',
  limit = 200, offset = 0 } = {}) {
  const where = ['1 = 1'];
  const params = [];
  if (track) { where.push('m.track = ?'); params.push(track); }
  if (kind) { where.push('m.kind = ?'); params.push(kind); }
  if (week) { where.push('m.week = ?'); params.push(week); }
  if (q) {
    where.push(`(m.title ILIKE ? ESCAPE '\\' OR m.summary ILIKE ? ESCAPE '\\'
                 OR m.outcomes ILIKE ? ESCAPE '\\' OR m.work ILIKE ? ESCAPE '\\'
                 OR m.deliverable ILIKE ? ESCAPE '\\')`);
    params.push(...Array(5).fill(like(q)));
  }
  const clause = where.join(' AND ');
  const rows = (await (await getDb())
    .prepare(
      `SELECT m.*, t.title AS track_title,
              (SELECT p.state FROM hr_progress p WHERE p.module_id = m.id AND p.user_id = ?) AS state
       FROM hr_modules m JOIN hr_tracks t ON t.slug = m.track
       WHERE ${clause} ORDER BY t.position, m.position LIMIT ? OFFSET ?`,
    )
    .all(userId || '', ...params, limit, offset));
  const { total } = (await (await getDb())
    .prepare(`SELECT COUNT(*) AS total FROM hr_modules m WHERE ${clause}`)
    .get(...params));
  return { modules: rows.map(hydrateModule), total };
}

export async function setProgress({ userId, moduleId, state = 'started', note = '', link = '' }) {
  if (state === 'none') {
    (await (await getDb()).prepare('DELETE FROM hr_progress WHERE user_id = ? AND module_id = ?').run(userId, moduleId));
    return null;
  }
  (await (await getDb())
    .prepare(
      `INSERT INTO hr_progress (user_id, module_id, state, note, link, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id, module_id) DO UPDATE SET state = excluded.state,
         note = excluded.note, link = excluded.link, updated_at = excluded.updated_at`,
    )
    .run(userId, moduleId, state, String(note || '').slice(0, 4000), String(link || '').slice(0, 500), nowSeconds()));
  return await getProgress(userId, moduleId);
}

export async function getProgress(userId, moduleId) {
  if (!userId) return null;
  return (await (await getDb()).prepare('SELECT * FROM hr_progress WHERE user_id = ? AND module_id = ?')
    .get(userId, moduleId)) ?? null;
}

/**
 * Where a member is across the whole manual.
 *
 * "Done" counts modules whose deliverable exists, not modules that were opened,
 * which is the difference between a training system and a reading list.
 */
export async function progressSummary(userId) {
  const db = await getDb();
  const total = ((await db.prepare('SELECT COUNT(*) AS n FROM hr_modules').get())).n;
  const rows = (await db
    .prepare(
      /* t.title and t.position are grouped as well as selected: SQLite let a
         bare column ride along with GROUP BY and pick an arbitrary row,
         Postgres does not. Grouping by the track's own key columns is what was
         meant all along — one row per track. */
      `SELECT m.track, t.title AS track_title, COUNT(m.id) AS total,
              SUM(CASE WHEN p.state = 'done' THEN 1 ELSE 0 END) AS done,
              SUM(CASE WHEN p.state = 'started' THEN 1 ELSE 0 END) AS started
       FROM hr_modules m
       JOIN hr_tracks t ON t.slug = m.track
       LEFT JOIN hr_progress p ON p.module_id = m.id AND p.user_id = ?
       GROUP BY m.track, t.title, t.position ORDER BY t.position`,
    )
    .all(userId || ''));
  const done = rows.reduce((sum, row) => sum + (row.done || 0), 0);
  const started = rows.reduce((sum, row) => sum + (row.started || 0), 0);
  return { total, done, started, percent: total ? Math.round((done / total) * 100) : 0, byTrack: rows };
}

/** Deliverables the member has produced, which is the actual portfolio. */
export async function deliverables(userId) {
  return (await (await getDb())
    .prepare(
      `SELECT m.slug, m.title, m.deliverable, m.week, p.state, p.note, p.link, p.updated_at
       FROM hr_progress p JOIN hr_modules m ON m.id = p.module_id
       WHERE p.user_id = ? AND m.deliverable <> '' ORDER BY m.week, m.position`,
    )
    .all(userId));
}

export async function bumpModuleReads(id) {
  (await (await getDb()).prepare('UPDATE hr_modules SET reads = reads + 1 WHERE id = ?').run(id));
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
export async function eventsBetween(startsAt, endsAt) {
  return (await (await getDb())
    .prepare(
      `SELECT e.*,
              (SELECT COUNT(*) FROM hr_rsvps r WHERE r.event_id = e.id AND r.status = 'going') AS going,
              s.source AS external_source, s.url AS external_url
       FROM hr_events e
       LEFT JOIN hr_event_sources s ON s.event_id = e.id
       WHERE e.starts_at >= ? AND e.starts_at < ? ORDER BY e.starts_at`,
    )
    .all(startsAt, endsAt));
}

export async function eventSource(eventId) {
  return (await (await getDb()).prepare('SELECT * FROM hr_event_sources WHERE event_id = ?').get(eventId)) ?? null;
}

/**
 * Create or update an event that came from an external calendar.
 *
 * Idempotent on (source, external_id), so a sweep that runs twice does not
 * produce two copies of the same evening.
 */
export async function upsertExternalEvent({ source = 'luma', externalId, hostId, title, description = '',
  kind = 'meetup', startsAt, minutes = 90, place = '', url = null, capacity = 0, canceled = false }) {
  return transaction(async (db) => {
    const now = nowSeconds();
    const existing = (await db.prepare('SELECT event_id FROM hr_event_sources WHERE source = ? AND external_id = ?')
      .get(source, externalId));
    if (existing) {
      ((await db.prepare(
        `UPDATE hr_events SET title = ?, description = ?, kind = ?, starts_at = ?, minutes = ?,
                place = ?, url = ?, capacity = ?, canceled = ? WHERE id = ?`,
      ).run(title, description, kind, startsAt, minutes, place, url, capacity, int(canceled), existing.event_id)));
      (await db.prepare('UPDATE hr_event_sources SET url = ?, synced_at = ? WHERE event_id = ?')
        .run(url || '', now, existing.event_id));
      return { id: existing.event_id, created: false };
    }
    const info = (await db
      .prepare(
        `INSERT INTO hr_events (host_id, title, description, kind, starts_at, minutes, place, url,
                                capacity, canceled, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      )
      .get(hostId, title, description, kind, startsAt, minutes, place, url, capacity, int(canceled), now));
    const id = Number(info.id);
    (await db.prepare('INSERT INTO hr_event_sources (event_id, source, external_id, url, synced_at) VALUES (?, ?, ?, ?, ?)')
      .run(id, source, externalId, url || '', now));
    return { id, created: true };
  });
}

export async function lastSync(source = 'luma') {
  return (await (await getDb()).prepare('SELECT MAX(synced_at) AS at, COUNT(*) AS n FROM hr_event_sources WHERE source = ?')
    .get(source));
}

/* ==========================================================================
 * NEWS SUBMISSIONS
 * ======================================================================== */

export async function recordNewsSubmission({ userId, title, url = '', body = '', topic = 'general',
  status = 'pending', remoteId = null, error = '' }) {
  const now = nowSeconds();
  const info = (await (await getDb())
    .prepare(
      `INSERT INTO hr_news_submissions (user_id, remote_id, title, url, body, topic, status, error, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    )
    .get(userId, remoteId, title, url, body, topic, status, error, now, now));
  return Number(info.id);
}

export async function updateNewsSubmission(id, { status, remoteId, error = '' }) {
  (await (await getDb())
    .prepare('UPDATE hr_news_submissions SET status = ?, remote_id = COALESCE(?, remote_id), error = ?, updated_at = ? WHERE id = ?')
    .run(status, remoteId ?? null, error, nowSeconds(), id));
}

export async function newsSubmissions(userId, { limit = 30 } = {}) {
  return (await (await getDb())
    .prepare('SELECT * FROM hr_news_submissions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?')
    .all(userId, limit));
}

/* ==========================================================================
 * THE ROSTER
 *
 * Cached Airtable verdicts. The address is only ever a SHA-256 here — see
 * roster.js for why — so every function takes a hash, not an email.
 * ======================================================================== */

export async function recordVerdict({ hash, masked, verdict, reason, person = {} }) {
  const now = nowSeconds();
  (await (await getDb())
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
      person.status || '', person.lifecycle || '', person.residentType || '', now));
  return await rosterRow(hash);
}

export async function rosterRow(hash) {
  return (await (await getDb()).prepare('SELECT * FROM hr_roster WHERE email_hash = ?').get(hash)) ?? null;
}

export async function linkRosterUser(hash, userId) {
  (await (await getDb()).prepare('UPDATE hr_roster SET user_id = ? WHERE email_hash = ?').run(userId, hash));
}

export async function setUserRoster(userId, status) {
  (await (await getDb())
    .prepare('UPDATE users SET roster_status = ?, roster_checked_at = ? WHERE id = ?')
    .run(status, nowSeconds(), userId));
}

/**
 * A steward's decision on a conflict.
 *
 * Stored separately from `verdict`, not overwriting it, so the next Airtable
 * check does not silently erase a human judgement — and so the steward view can
 * still show what the data said when they overrode it.
 */
export async function decideRoster({ hash, userId, decision, note = '' }) {
  (await (await getDb())
    .prepare('UPDATE hr_roster SET decision = ?, decided_by = ?, decided_at = ?, note = ? WHERE email_hash = ?')
    .run(decision, userId, nowSeconds(), String(note || '').slice(0, 500), hash));
  return await rosterRow(hash);
}

/** Conflicts a steward has not ruled on yet. This is the queue that matters. */
export async function pendingRoster() {
  return (await (await getDb())
    .prepare(`SELECT * FROM hr_roster WHERE verdict = 'review' AND decision IS NULL
              ORDER BY checked_at DESC LIMIT 100`)
    .all());
}

export async function recentRoster({ limit = 60 } = {}) {
  return (await (await getDb())
    .prepare('SELECT * FROM hr_roster ORDER BY checked_at DESC LIMIT ?')
    .all(limit));
}

export async function rosterCounts() {
  const rows = (await (await getDb())
    .prepare('SELECT verdict, COUNT(*) AS n FROM hr_roster GROUP BY verdict')
    .all());
  const out = { allow: 0, deny: 0, review: 0, error: 0 };
  for (const row of rows) out[row.verdict] = row.n;
  out.pending = (await pendingRoster()).length;
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

export async function upsertDeal(deal) {
  const slug = slugify(`${deal.vendor}-${deal.title}`, 'deal');
  const db = await getDb();
  const existing = ((await db.prepare('SELECT id FROM hr_deals WHERE slug = ?').get(slug)));
  if (existing) {
    ((await db.prepare(
      `UPDATE hr_deals SET vendor = ?, title = ?, category = ?, summary = ?, details = ?,
              worth = ?, url = ?, access = ?, requirement = ?, checked = ? WHERE id = ?`,
    ).run(deal.vendor, deal.title, deal.category, deal.summary || '', deal.details || '',
      deal.worth || '', deal.url || null, deal.access || 'code', deal.requirement || '',
      deal.checked || '', existing.id)));
    // `code` is deliberately not overwritten: a steward may have entered the
    // real one, and the data file ships with it empty by design.
    return { id: existing.id, slug, created: false };
  }
  const info = (await db
    .prepare(
      `INSERT INTO hr_deals (slug, vendor, title, category, summary, details, worth, code, url,
                             posted_by, created_at, access, requirement, checked)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    )
    .get(slug, deal.vendor, deal.title, deal.category, deal.summary || '', deal.details || '',
      deal.worth || '', deal.code || '', deal.url || null, deal.postedBy, nowSeconds(),
      deal.access || 'code', deal.requirement || '', deal.checked || ''));
  return { id: Number(info.id), slug, created: true };
}

export async function upsertFunder(funder) {
  const slug = slugify(funder.name, 'funder');
  const db = await getDb();
  const existing = ((await db.prepare('SELECT id FROM hr_funders WHERE slug = ?').get(slug)));
  if (existing) {
    ((await db.prepare(
      `UPDATE hr_funders SET name = ?, kind = ?, focus = ?, stages = ?, check_size = ?,
              location = ?, website = ?, description = ?, dilutive = ? WHERE id = ?`,
    ).run(funder.name, funder.kind, funder.focus || '', funder.stages || '',
      funder.checkSize || '', funder.location || '', funder.website || null,
      funder.description || '', int(funder.dilutive), existing.id)));
    return { id: existing.id, slug, created: false };
  }
  const info = (await db
    .prepare(
      `INSERT INTO hr_funders (slug, name, kind, focus, stages, check_size, location, website,
                               description, dilutive, added_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    )
    .get(slug, funder.name, funder.kind, funder.focus || '', funder.stages || '',
      funder.checkSize || '', funder.location || '', funder.website || null,
      funder.description || '', int(funder.dilutive), funder.addedBy || null, nowSeconds()));
  return { id: Number(info.id), slug, created: true };
}

/** Remove rows of a real data set that the data file no longer contains. */
export async function pruneBySlug(table, keep) {
  if (!keep.length) return 0;
  const rows = (await (await getDb()).prepare(`SELECT slug FROM ${table}`).all());
  const stale = rows.map((r) => r.slug).filter((slug) => !keep.includes(slug));
  if (!stale.length) return 0;
  const stmt = (await getDb()).prepare(`DELETE FROM ${table} WHERE slug = ?`);
  for (const slug of stale) await stmt.run(slug);
  return stale.length;
}
