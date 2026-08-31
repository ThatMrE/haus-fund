/**
 * A small RSS 2.0 / Atom parser.
 *
 * Feed XML in the wild is inconsistent but shallow: a flat list of entries with
 * a handful of well-known fields. That is tractable with careful string work,
 * and it keeps the project at zero dependencies. Anything it cannot understand
 * is skipped rather than guessed at.
 */

const ENTRY_RE = /<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi;

/** Pull the text out of the first matching tag, unwrapping CDATA. */
function tag(block, ...names) {
  for (const name of names) {
    const re = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, 'i');
    const match = re.exec(block);
    if (match) {
      const value = decode(stripCdata(match[1])).trim();
      if (value) return value;
    }
  }
  return '';
}

/** Atom puts the URL in an attribute rather than the element body. */
function linkFrom(block) {
  const rss = tag(block, 'link');
  if (rss && /^https?:/i.test(rss)) return rss;

  const alternate =
    /<link\b[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i.exec(block) ||
    /<link\b[^>]*href=["']([^"']+)["'][^>]*rel=["']alternate["']/i.exec(block) ||
    /<link\b[^>]*href=["']([^"']+)["']/i.exec(block);
  if (alternate) return decode(alternate[1]).trim();

  // Some feeds only carry a permalink guid.
  const guid = tag(block, 'guid', 'id');
  return /^https?:/i.test(guid) ? guid : '';
}

function stripCdata(value) {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
}

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'", nbsp: ' ',
  '#8217': '’', '#8216': '‘', '#8220': '“', '#8221': '”',
  '#8211': '–', '#8212': '—', '#822': '’',
};

export function decode(value) {
  return String(value)
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code) => {
      const key = code.toLowerCase();
      if (ENTITIES[key] !== undefined) return ENTITIES[key];
      if (key.startsWith('#x')) return codePoint(parseInt(key.slice(2), 16));
      if (key.startsWith('#')) return codePoint(parseInt(key.slice(1), 10));
      return whole;
    });
}

function codePoint(n) {
  return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '';
}

/** Drop any markup a summary field carries, leaving readable text. */
export function stripTags(value) {
  return decode(stripCdata(String(value)))
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDate(value) {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}

/**
 * Parse a feed document into entries.
 * @returns {Array<{title: string, link: string, publishedAt: number|null, summary: string}>}
 */
export function parseFeed(xml) {
  if (typeof xml !== 'string' || !xml.includes('<')) return [];
  const entries = [];

  for (const [, , block] of xml.matchAll(ENTRY_RE)) {
    const title = stripTags(tag(block, 'title'));
    const link = linkFrom(block);
    if (!title || !link) continue;

    entries.push({
      title,
      link,
      publishedAt: parseDate(
        tag(block, 'pubDate', 'published', 'updated', 'dc:date', 'date'),
      ),
      summary: stripTags(
        tag(block, 'description', 'summary', 'content:encoded', 'content'),
      ).slice(0, 600),
    });
  }
  return entries;
}
