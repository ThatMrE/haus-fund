/**
 * The morning run.
 *
 * Seven agents sweep their sources, the results are pooled, filtered,
 * de-duplicated and capped, and what survives is posted under per-agent
 * accounts. Everything posted here is marked `source = 'agent'`, which is what
 * holds it to its half of the front page and below fresh human submissions.
 *
 * The run is idempotent: a link already on the site is skipped, so a repeated
 * or overlapping run adds nothing twice. An agent that throws is recorded and
 * the rest of the run continues.
 */
import { AGENTS, agentHandle, agentAbout } from './agents/index.js';
import { scoreEntry, guessTopic } from './relevance.js';
import * as db from './models.js';
import { getDb } from './db/index.js';
import { hashPassword } from './auth.js';
import { normalizeUrl, nowSeconds } from './util.js';
import { randomBytes } from 'node:crypto';

/** Most stories to post in one run, so a busy news day cannot bury the page. */
export const MAX_PER_RUN = 24;
/** Most stories from any single agent in one run. */
export const MAX_PER_AGENT = 5;
/** Most stories from any single domain in one run. */
export const MAX_PER_DOMAIN = 3;
/**
 * A backstop on age. Each agent asks its source for a window, but a feed that
 * lies about its dates should not be able to put last month on the front page.
 */
export const MAX_AGE_HOURS = 96;

/**
 * Turn pooled agent output into ranked, de-duplicated candidates.
 *
 * Pure apart from the duplicate check, which is injected, so the whole
 * selection policy is testable without a database.
 */
export function selectCandidates(batches, { now = nowSeconds(), isDuplicate = () => false } = {}) {
  const candidates = [];
  const seenUrls = new Set();
  const seenTitles = new Set();

  for (const { agent, entries } of batches) {
    for (const entry of entries) {
      const url = normalizeUrl(entry.link);
      if (!url || !entry.title) continue;

      const ageHours = entry.publishedAt ? (now - entry.publishedAt) / 3600 : 0;
      if (ageHours > MAX_AGE_HOURS || ageHours < -6) continue;

      const key = dedupeKey(url);
      const titleKey = normalizeTitle(entry.title);
      if (seenUrls.has(key) || seenTitles.has(titleKey)) continue;
      if (isDuplicate(url, entry.title)) continue;

      // An agent whose source is itself the signal — a Form D filing, an NIH
      // award — skips the text filter that the open-ended sources need.
      let score = (entry.weight ?? agent.weight ?? 1) * 5;
      let topic = entry.topicHint ?? null;
      if (!agent.selfEvident) {
        const verdict = scoreEntry(entry, { weight: entry.weight ?? agent.weight ?? 1 });
        if (!verdict.keep) continue;
        score = verdict.score;
        topic = topic ?? guessTopic(entry);
      }

      seenUrls.add(key);
      seenTitles.add(titleKey);
      candidates.push({
        agent,
        title: entry.title,
        url,
        topic: topic ?? guessTopic(entry) ?? 'other',
        note: entry.note ?? null,
        score,
        publishedAt: entry.publishedAt ?? now,
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score || (b.publishedAt ?? 0) - (a.publishedAt ?? 0));

  // Cap per agent and per domain before capping the run, so neither one
  // prolific agent nor one prolific outlet takes every slot.
  const perAgent = new Map();
  const perDomain = new Map();
  const chosen = [];

  for (const candidate of candidates) {
    const agentUsed = perAgent.get(candidate.agent.key) ?? 0;
    if (agentUsed >= MAX_PER_AGENT) continue;
    const host = hostOf(candidate.url);
    const domainUsed = perDomain.get(host) ?? 0;
    if (domainUsed >= MAX_PER_DOMAIN) continue;

    perAgent.set(candidate.agent.key, agentUsed + 1);
    perDomain.set(host, domainUsed + 1);
    chosen.push(candidate);
    if (chosen.length >= MAX_PER_RUN) break;
  }
  return chosen;
}

function dedupeKey(url) {
  try {
    const parsed = new URL(url);
    parsed.search = '';
    parsed.hash = '';
    return `${parsed.hostname.replace(/^www\./, '')}${parsed.pathname.replace(/\/+$/, '')}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return url;
  }
}

function normalizeTitle(title) {
  return String(title).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Create an agent's posting account if it does not exist yet. */
export async function ensureAgentAccount(agent) {
  const id = agentHandle(agent);
  const existing = await db.getUser(id);
  if (existing) return existing;
  // No one logs into these; the passphrase is random and thrown away.
  const user = await db.createUser({
    id,
    passwordHash: hashPassword(randomBytes(24).toString('hex')),
    role: 'agent',
  });
  await db.updateUser(id, { about: agentAbout(agent) });
  return user;
}

/** Run one agent, catching anything it throws. */
async function runAgent(agent, ctx) {
  const startedAt = nowSeconds();
  try {
    const entries = await agent.fetch(ctx);
    return { agent, entries: Array.isArray(entries) ? entries : [], error: null, startedAt };
  } catch (err) {
    return { agent, entries: [], error: String(err?.message || err), startedAt };
  }
}

/**
 * Run the whole sweep.
 * @returns {Promise<{posted: Array, skipped: number, errors: Array, agents: Array}>}
 */
export async function runIngest({
  agents = AGENTS,
  fetchImpl = fetch,
  now = nowSeconds(),
  dryRun = false,
  env = process.env,
} = {}) {
  const batches = await Promise.all(
    agents.map((agent) => runAgent(agent, { fetchImpl, now, env })),
  );

  const errors = batches
    .filter((b) => b.error)
    .map((b) => ({ agent: b.agent.key, error: b.error }));

  const chosen = selectCandidates(batches, {
    now,
    isDuplicate: () => false,
  });

  // The duplicate check needs the database, so it runs as a second pass rather
  // than inside the pure selector.
  const fresh = [];
  for (const candidate of chosen) {
    if (await db.findByUrl(candidate.url, { withinDays: 30 })) continue;
    fresh.push(candidate);
  }

  const summary = batches.map((b) => ({
    agent: b.agent.key,
    label: b.agent.label,
    fetched: b.entries.length,
    selected: fresh.filter((c) => c.agent.key === b.agent.key).length,
    error: b.error,
  }));

  if (dryRun) return { posted: fresh, skipped: 0, errors, agents: summary, dryRun: true };

  const posted = [];
  for (const candidate of fresh) {
    const account = await ensureAgentAccount(candidate.agent);
    const id = await db.createStory({
      by: account.id,
      title: candidate.title,
      url: candidate.url,
      topic: candidate.topic,
      kind: 'link',
      source: 'agent',
      agent: candidate.agent.key,
      reviewState: 'approved',
    });
    posted.push({
      id,
      title: candidate.title,
      url: candidate.url,
      by: account.id,
      agent: candidate.agent.key,
      score: candidate.score,
    });
  }

  await recordRun({ batches, posted, now });

  return { posted, skipped: chosen.length - fresh.length, errors, agents: summary };
}

async function recordRun({ batches, posted, now }) {
  const store = getDb();
  for (const batch of batches) {
    await store.run(
      `INSERT INTO agent_runs (agent, started_at, finished_at, posted, skipped, error)
       VALUES (?, ?, ?, ?, ?, ?)`,
      batch.agent.key,
      batch.startedAt,
      now,
      posted.filter((p) => p.agent === batch.agent.key).length,
      Math.max(0, batch.entries.length - posted.filter((p) => p.agent === batch.agent.key).length),
      batch.error,
    );
  }
}

/** When each agent last completed, for the status page. */
export async function agentStatus() {
  return getDb().all(
    `SELECT agent, MAX(finished_at) AS last_run, SUM(posted) AS posted
     FROM agent_runs GROUP BY agent ORDER BY agent`,
  );
}
