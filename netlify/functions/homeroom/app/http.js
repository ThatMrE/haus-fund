import { readFile } from 'node:fs/promises';
import { join, normalize, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { toString } from './util.js';

const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));
const MAX_BODY = 64 * 1024;

const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

export function sendHtml(res, body, { status = 200, headers = {} } = {}) {
  const payload = toString(body);
  res.writeHead(status, {
    'content-type': 'text/html; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
    ...headers,
  });
  res.end(payload);
}

export function sendJson(res, data, { status = 200, headers = {} } = {}) {
  const payload = JSON.stringify(data);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'access-control-allow-origin': '*',
    ...headers,
  });
  res.end(payload);
}

export function sendText(res, body, { status = 200, type = 'text/plain; charset=utf-8', headers = {} } = {}) {
  res.writeHead(status, {
    'content-type': type,
    'content-length': Buffer.byteLength(body),
    ...headers,
  });
  res.end(body);
}

export function redirect(res, location, { status = 303, headers = {} } = {}) {
  res.writeHead(status, { location, ...headers });
  res.end();
}

/** Read and parse a request body (form-encoded or JSON). Caps at 64 KB. */
export async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) {
      const err = new Error('payload too large');
      err.status = 413;
      throw err;
    }
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  const type = (req.headers['content-type'] || '').split(';')[0].trim();

  if (type === 'application/json') {
    try {
      return { fields: raw ? JSON.parse(raw) : {}, raw, json: true };
    } catch {
      const err = new Error('invalid JSON body');
      err.status = 400;
      throw err;
    }
  }
  const fields = {};
  for (const [key, value] of new URLSearchParams(raw)) fields[key] = value;
  return { fields, raw, json: false };
}

/** Serve a file from public/ under /static/. */
export async function serveStatic(req, res, pathname) {
  const rel = normalize(pathname.replace(/^\/static\//, '')).replace(/^(\.\.[/\\])+/, '');
  if (rel.includes('..')) {
    res.writeHead(403).end();
    return true;
  }
  const file = join(PUBLIC_DIR, rel);
  if (!file.startsWith(PUBLIC_DIR)) {
    res.writeHead(403).end();
    return true;
  }
  try {
    const data = await readFile(file);
    res.writeHead(200, {
      'content-type': MIME[extname(file)] || 'application/octet-stream',
      'content-length': data.length,
      'cache-control': 'public, max-age=3600',
    });
    res.end(data);
    return true;
  } catch {
    return false;
  }
}

/* --------------------------------------------------------- rate limiting */

const buckets = new Map();

/**
 * Sliding-window rate limit. Returns true when the request is allowed.
 * Purely in-memory: fine for a single process, swap for Redis behind a LB.
 */
export function rateLimit(key, { limit, windowMs }) {
  const now = Date.now();
  const entry = buckets.get(key);
  if (!entry || now - entry.start >= windowMs) {
    buckets.set(key, { start: now, count: 1 });
    return true;
  }
  entry.count += 1;
  return entry.count <= limit;
}

export function resetRateLimits() {
  buckets.clear();
}

setInterval(() => {
  const cutoff = Date.now() - 60 * 60 * 1000;
  for (const [key, entry] of buckets) if (entry.start < cutoff) buckets.delete(key);
}, 10 * 60 * 1000).unref?.();

export function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length) return forwarded.split(',')[0].trim();
  return req.socket.remoteAddress || 'unknown';
}
