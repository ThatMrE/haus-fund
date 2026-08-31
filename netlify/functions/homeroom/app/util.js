/* Small helpers shared by the server, the models and the views. */

const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escape a value for interpolation into HTML text or an attribute. */
export function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (c) => ENTITIES[c]);
}

/**
 * Tagged template that escapes every interpolation. Values wrapped in
 * `raw()` (or arrays of them) are passed through untouched, which is how
 * views compose fragments without double-escaping.
 */
export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) {
    out += render(values[i]) + strings[i + 1];
  }
  return raw(out);
}

const RAW = Symbol('raw-html');

export function raw(str) {
  return { [RAW]: true, toString: () => str, value: str };
}

function render(value) {
  if (value === null || value === undefined || value === false) return '';
  if (Array.isArray(value)) return value.map(render).join('');
  if (typeof value === 'object' && value[RAW]) return value.value;
  return esc(value);
}

/** Unwrap an html`` fragment down to a plain string. */
export function toString(fragment) {
  return typeof fragment === 'object' && fragment && fragment[RAW] ? fragment.value : String(fragment ?? '');
}

/** "3 hours ago" style relative timestamps, HN-flavoured. */
export function timeAgo(seconds, now = Math.floor(Date.now() / 1000)) {
  const delta = Math.max(0, now - seconds);
  if (delta < 60) return `${delta || 0} second${delta === 1 ? '' : 's'} ago`;
  const units = [
    ['minute', 60],
    ['hour', 3600],
    ['day', 86400],
    ['month', 2592000],
    ['year', 31536000],
  ];
  let label = 'minute';
  let size = 60;
  for (const [unit, unitSeconds] of units) {
    if (delta >= unitSeconds) {
      label = unit;
      size = unitSeconds;
    }
  }
  const n = Math.floor(delta / size);
  return `${n} ${label}${n === 1 ? '' : 's'} ago`;
}

export function plural(n, word, wordPlural = `${word}s`) {
  return `${n} ${n === 1 ? word : wordPlural}`;
}

/** Display domain for a submitted link: "www.nature.com/articles/x" -> "nature.com". */
export function displayDomain(url) {
  if (!url) return '';
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.replace(/^www\d?\./, '');
  } catch {
    return '';
  }
}

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

/** Normalise a submitted URL, or return null when it is not a usable http(s) link. */
export function normalizeUrl(input) {
  if (!input) return null;
  let candidate = String(input).trim();
  if (!candidate) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(candidate)) candidate = `https://${candidate}`;
  let url;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) return null;
  if (!url.hostname.includes('.')) return null;
  url.hash = '';
  return url.toString();
}

/**
 * Turn user text into safe HTML: paragraphs on blank lines, bare links
 * linkified, everything else escaped.
 */
export function formatText(text) {
  if (!text) return raw('');
  const paragraphs = String(text)
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const body = paragraphs
    .map((p) => `<p>${linkify(p).replace(/\n/g, '<br />')}</p>`)
    .join('');
  return raw(body);
}

function linkify(text) {
  const pattern = /(https?:\/\/[^\s<>"')]+)/g;
  let out = '';
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    out += esc(text.slice(last, match.index));
    const url = match[0].replace(/[.,;:!?]+$/, '');
    const trailing = match[0].slice(url.length);
    const label = url.length > 60 ? `${url.slice(0, 57)}...` : url;
    out += `<a href="${esc(url)}" rel="nofollow noopener ugc" target="_blank">${esc(label)}</a>${esc(trailing)}`;
    last = match.index + match[0].length;
  }
  out += esc(text.slice(last));
  return out;
}

export function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

export function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function parseCookies(header = '') {
  const jar = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    if (!key) continue;
    jar[key] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return jar;
}
