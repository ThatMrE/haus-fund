/**
 * Front page ranking.
 *
 * The base is the classic Hacker News formula — points decaying against age
 * raised to a gravity exponent — with two adjustments that suit a feed of
 * biotech links: a small bonus for stories that are actually being discussed,
 * and a penalty for stories that pile up flags or repeat a domain that is
 * already sitting on the front page.
 */

export const GRAVITY = 1.8;
export const AGE_OFFSET_HOURS = 2;
/** How much a comment is worth relative to an upvote when ranking. */
export const DISCUSSION_WEIGHT = 0.25;
/** Multiplier applied per extra story from the same domain in the candidate set. */
export const DOMAIN_DIVERSITY_PENALTY = 0.65;
export const FLAG_PENALTY = 0.5;

/**
 * How long a human submission sits above every machine-posted story,
 * regardless of votes. Long enough that a link posted in the morning is still
 * ahead of that day's ingest by evening.
 */
export const HUMAN_PRIORITY_HOURS = 24;
/**
 * After that window a human post no longer jumps the queue outright, but keeps
 * a thumb on the scale so curation still beats the firehose.
 */
export const HUMAN_BOOST = 3;

/** A story is machine-posted when the ingest agent filed it. */
export function isAgentPost(item) {
  return item?.source === 'agent';
}

/**
 * Tier 0 outranks tier 1 outright. Only fresh human posts are tier 0, so an
 * unvoted submission from last week cannot squat on the front page.
 */
export function priorityTier(item, now = Math.floor(Date.now() / 1000)) {
  if (isAgentPost(item)) return 1;
  return ageInHours(item.created_at ?? now, now) < HUMAN_PRIORITY_HOURS ? 0 : 1;
}

export function ageInHours(createdAt, now) {
  return Math.max(0, (now - createdAt) / 3600);
}

/**
 * Score a single item. `points` is the vote count, everything else optional.
 */
export function hotScore(item, now = Math.floor(Date.now() / 1000)) {
  const points = Math.max(0, (item.points ?? 1) - 1);
  const discussion = DISCUSSION_WEIGHT * (item.comment_count ?? 0);
  const hours = ageInHours(item.created_at ?? now, now);
  const decay = (hours + AGE_OFFSET_HOURS) ** GRAVITY;
  let score = (points + discussion) / decay;
  if (item.flag_count) score *= FLAG_PENALTY ** item.flag_count;
  if (!isAgentPost(item)) score *= HUMAN_BOOST;
  return score;
}

/**
 * Rank a candidate list. Returns a new array sorted by score, with repeated
 * domains progressively demoted so one outlet cannot own the front page.
 */
export function rankStories(items, now = Math.floor(Date.now() / 1000)) {
  const byScore = items
    .map((item) => ({ ...item, score: hotScore(item, now), tier: priorityTier(item, now) }))
    .sort(compareScore);

  // Walk the ranked list top-down so the *best* story from a domain keeps its
  // score and only the follow-ups get demoted.
  const seenDomain = new Map();
  for (const item of byScore) {
    if (!item.domain) continue;
    const seen = seenDomain.get(item.domain) ?? 0;
    item.score *= DOMAIN_DIVERSITY_PENALTY ** seen;
    seenDomain.set(item.domain, seen + 1);
  }
  return byScore.sort(compareScore);
}

/**
 * Tier first, then score. A human submission therefore enters above the day's
 * machine-posted stories and climbs within that group on votes alone.
 */
function compareScore(a, b) {
  return (
    (a.tier ?? 1) - (b.tier ?? 1) ||
    b.score - a.score ||
    b.created_at - a.created_at ||
    b.id - a.id
  );
}

/**
 * The share of the front page the agents are allowed to hold. The feed is
 * specified as roughly half machine-surfaced and half people-surfaced, so the
 * two streams are interleaved rather than left to fight it out on score — a
 * sweep of six agents would otherwise win on volume alone.
 */
export const AGENT_SHARE = 0.5;

/**
 * Compose a ranked list into the page that actually gets served.
 *
 * Fresh human submissions still lead outright — that is the promise made to
 * someone who posts something first. Below them the two streams alternate so
 * that any prefix of the page holds close to `agentShare` machine posts, with
 * each stream keeping its own ranked order.
 */
export function composeFrontPage(ranked, { agentShare = AGENT_SHARE } = {}) {
  const humans = ranked.filter((item) => !isAgentPost(item));
  const agents = ranked.filter(isAgentPost);
  const out = [];
  let h = 0;
  let a = 0;

  while (h < humans.length || a < agents.length) {
    if (h < humans.length && (humans[h].tier ?? 1) === 0) {
      out.push(humans[h++]);
      continue;
    }
    const takeAgent =
      a < agents.length && (h >= humans.length || a < out.length * agentShare);
    out.push(takeAgent ? agents[a++] : humans[h++]);
  }
  return out;
}

/** What the mix actually came out as — used by the stat line and the tests. */
export function mixOf(items) {
  const agent = items.filter(isAgentPost).length;
  return { agent, human: items.length - agent, total: items.length };
}
