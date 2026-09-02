/**
 * Shared plumbing for the agents.
 *
 * Every agent reaches the network through here so that timeouts, the user
 * agent, and error handling are the same everywhere: one agent hitting a dead
 * endpoint must never take down the morning run.
 */

export const USER_AGENT = 'haus-fund-news/1.0 (+https://haus.fund/news)';
export const TIMEOUT_MS = 8000;

export class AgentFetchError extends Error {
  constructor(message, { status } = {}) {
    super(message);
    this.name = 'AgentFetchError';
    this.status = status;
  }
}

async function request(url, { fetchImpl = fetch, headers = {}, timeoutMs = TIMEOUT_MS, ...rest } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      signal: controller.signal,
      ...rest,
      headers: { 'user-agent': USER_AGENT, ...headers },
    });
    if (!res.ok) throw new AgentFetchError(`HTTP ${res.status} from ${hostOf(url)}`, { status: res.status });
    return res;
  } catch (err) {
    if (err?.name === 'AbortError') throw new AgentFetchError(`timeout after ${timeoutMs}ms`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJson(url, options = {}) {
  const res = await request(url, {
    ...options,
    headers: { accept: 'application/json', ...(options.headers ?? {}) },
  });
  return res.json();
}

export async function fetchText(url, options = {}) {
  const res = await request(url, {
    ...options,
    headers: {
      accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, text/calendar, */*',
      ...(options.headers ?? {}),
    },
  });
  return res.text();
}

export function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return String(url).slice(0, 40);
  }
}

/** YYYY-MM-DD, in UTC — the format every one of these APIs wants. */
export function isoDate(seconds) {
  return new Date(seconds * 1000).toISOString().slice(0, 10);
}

export function secondsFrom(value) {
  if (value == null) return null;
  if (typeof value === 'number') return value > 1e12 ? Math.floor(value / 1000) : Math.floor(value);
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : Math.floor(parsed / 1000);
}

/** Collapse whitespace and trim a title to something a row can hold. */
export function tidy(text, max = 140) {
  const clean = String(text ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return clean.length > max ? `${clean.slice(0, max - 3).trimEnd()}...` : clean;
}

/** Money, as a person would write it: $1.2M, $850K, $3.4B. */
export function money(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1).replace(/\.0$/, '')}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1e3) return `$${Math.round(n / 1e3)}K`;
  return `$${n}`;
}
