/**
 * The three recurring issues.
 *
 *   Bench Notes   daily      what landed yesterday, both halves of the feed
 *   Field Notes   weekly     the week, with the scouts who surfaced it
 *   Biopunk Live  weekly     the ten items the show opens with
 *
 * All three are the same shape — a dated issue over a window of items — so they
 * share one table and one builder. An issue stores the ids it covered, so it
 * stays the issue that went out even as the items keep moving.
 */
import { getDb } from './db/index.js';
import * as db from './models.js';
import { award } from './points.js';
import { nowSeconds, displayDomain } from './util.js';
import { localDateParts, isoWeek, DEFAULT_TIMEZONE } from './schedule.js';

export const KINDS = {
  'bench-notes': {
    key: 'bench-notes',
    title: 'Bench Notes',
    blurb: 'What landed on the board yesterday.',
    cadence: 'daily',
    size: 12,
  },
  'field-notes': {
    key: 'field-notes',
    title: 'Field Notes',
    blurb: 'The week in early-stage biotech, and who found it.',
    cadence: 'weekly',
    size: 20,
  },
  live: {
    key: 'live',
    title: 'Biopunk Live',
    blurb: 'The ten items the show opens with.',
    cadence: 'weekly',
    size: 10,
  },
};

/** The window an issue of `kind` covers if it were built at `now`. */
export function windowFor(kind, { now = nowSeconds(), timeZone = process.env.NEWS_TZ || DEFAULT_TIMEZONE } = {}) {
  const at = new Date(now * 1000);
  if (kind === 'bench-notes') {
    const from = now - 86400;
    return { from, to: now, slug: localDateParts(at, timeZone).iso };
  }
  const { year, week } = isoWeek(at);
  return { from: now - 7 * 86400, to: now, slug: `${year}-w${String(week).padStart(2, '0')}` };
}

/**
 * Build an issue, or return the one that already exists for this slug. Building
 * twice in a day is a no-op, which is what makes it safe on an hourly cron.
 */
export async function buildDigest(kind, { now = nowSeconds(), timeZone, force = false } = {}) {
  const spec = KINDS[kind];
  if (!spec) throw new Error(`unknown digest: ${kind}`);

  const { from, to, slug } = windowFor(kind, { now, timeZone });
  const existing = await getDigest(kind, slug);
  if (existing && !force) return { digest: existing, created: false };

  const items = await db.topInWindow({ from, to, limit: spec.size });
  if (items.length === 0) return { digest: existing ?? null, created: false, empty: true };

  const title = issueTitle(spec, slug, now, timeZone);
  const intro = introFor(kind, items);
  const body = renderBody(items);
  const itemIds = JSON.stringify(items.map((i) => i.id));

  if (existing) {
    await getDb().run(
      'UPDATE digests SET title = ?, intro = ?, body = ?, item_ids = ? WHERE id = ?',
      title,
      intro,
      body,
      itemIds,
      existing.id,
    );
  } else {
    await getDb().run(
      `INSERT INTO digests (kind, slug, title, intro, body, item_ids, covers_from, covers_to, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      kind,
      slug,
      title,
      intro,
      body,
      itemIds,
      from,
      to,
      now,
    );
  }

  await awardForIssue(kind, items);
  return { digest: await getDigest(kind, slug), created: !existing, items };
}

/** Leading an issue is worth something to whoever surfaced it. */
async function awardForIssue(kind, items) {
  if (kind === 'live') {
    for (const item of items) {
      if (item.surfaced_by) await award({ userId: item.surfaced_by, reason: 'top-ten', itemId: item.id });
    }
    return;
  }
  if (kind === 'field-notes' && items[0]?.surfaced_by) {
    await award({ userId: items[0].surfaced_by, reason: 'field-notes', itemId: items[0].id });
  }
}

function issueTitle(spec, slug, now, timeZone) {
  if (spec.cadence === 'daily') {
    const parts = localDateParts(new Date(now * 1000), timeZone || DEFAULT_TIMEZONE);
    return `${spec.title} — ${parts.iso}`;
  }
  return `${spec.title} — ${slug.replace('-w', ', week ')}`;
}

function introFor(kind, items) {
  const human = items.filter((i) => i.source !== 'agent').length;
  const agent = items.length - human;
  if (kind === 'live') {
    return `Ten items, ${human} surfaced by people and ${agent} by the agents.`;
  }
  const scouts = [...new Set(items.map((i) => i.surfaced_by).filter(Boolean))];
  const who = scouts.length ? `, surfaced by ${scouts.slice(0, 5).join(', ')}` : '';
  return `${items.length} items — ${human} from members, ${agent} from the morning run${who}.`;
}

/** A plain-text rendering, for the RSS body and anywhere without markup. */
function renderBody(items) {
  return items
    .map((item, i) => {
      const where = item.url ? ` (${displayDomain(item.url)})` : '';
      const credit = item.surfaced_by ? ` — surfaced by ${item.surfaced_by}` : '';
      return `${i + 1}. ${item.title}${where}${credit}`;
    })
    .join('\n');
}

export async function getDigest(kind, slug) {
  return getDb().get('SELECT * FROM digests WHERE kind = ? AND slug = ?', kind, slug);
}

export async function latestDigest(kind) {
  return getDb().get(
    'SELECT * FROM digests WHERE kind = ? ORDER BY covers_to DESC, id DESC LIMIT 1',
    kind,
  );
}

export async function listDigests(kind, { limit = 30 } = {}) {
  return getDb().all(
    'SELECT * FROM digests WHERE kind = ? ORDER BY covers_to DESC, id DESC LIMIT ?',
    kind,
    limit,
  );
}

/** The items an issue covered, in the order it listed them. */
export async function itemsOf(digest) {
  let ids = [];
  try {
    ids = JSON.parse(digest.item_ids ?? '[]');
  } catch {
    ids = [];
  }
  if (ids.length === 0) return [];
  const rows = await getDb().all(
    `SELECT * FROM items WHERE id IN (${ids.map(() => '?').join(',')})`,
    ...ids,
  );
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}
