/**
 * haus.fund/news — HTTP entry point.
 *
 * The app is an ordinary `node:http` handler (see ./app), so this file is only
 * a shim between Netlify's web-standard Request/Response and the Node req/res
 * pair the app expects. Plain JS to match the app, which has no build step and
 * no dependencies.
 *
 * Serverless containers have an ephemeral filesystem, so the SQLite file lives
 * in /tmp and is rebuilt when a cold container starts. Durable storage needs
 * the single-process deployment described in the README.
 */
import { Readable } from 'node:stream';

let ready = null;

/** Open the database and seed it once per container. */
async function boot() {
  if (ready) return ready;
  ready = (async () => {
    process.env.BIOPUNK_DB ||= '/tmp/haus-news.db';
    process.env.NEWS_BASE_PATH ||= '/news';
    process.env.NEWS_STATIC_BASE ||= '/news-assets';
    const { getDb } = await import('./app/db.js');
    const db = getDb();
    if (db.prepare('SELECT COUNT(*) AS n FROM users').get().n === 0) {
      const { seed } = await import('./app/seed.js');
      seed();
    }
    const { handle } = await import('./app/app.js');
    return handle;
  })();
  return ready;
}

/** Minimal ServerResponse stand-in that collects the reply. */
class ResponseCollector {
  constructor() {
    this.statusCode = 200;
    this.headers = {};
    this.headersSent = false;
    this.chunks = [];
    this.finished = new Promise((resolve) => {
      this.resolve = resolve;
    });
  }

  setHeader(name, value) {
    this.headers[String(name).toLowerCase()] = value;
    return this;
  }

  getHeader(name) {
    return this.headers[String(name).toLowerCase()];
  }

  removeHeader(name) {
    delete this.headers[String(name).toLowerCase()];
  }

  writeHead(status, headers) {
    this.statusCode = status;
    for (const [name, value] of Object.entries(headers || {})) this.setHeader(name, value);
    this.headersSent = true;
    return this;
  }

  write(chunk) {
    if (chunk) this.chunks.push(Buffer.from(chunk));
    return true;
  }

  end(chunk) {
    if (chunk) this.chunks.push(Buffer.from(chunk));
    this.headersSent = true;
    this.resolve();
    return this;
  }

  on() { return this; }
  once() { return this; }
  emit() { return true; }
}

export default async function newsHandler(request, context) {
  const handle = await boot();

  const requestUrl = new URL(request.url);
  const body = ['GET', 'HEAD'].includes(request.method)
    ? null
    : Buffer.from(await request.arrayBuffer());

  const req = Readable.from(body && body.length ? [body] : []);
  req.method = request.method;
  req.url = requestUrl.pathname + requestUrl.search;
  req.headers = Object.fromEntries(request.headers);
  req.socket = {
    remoteAddress:
      context?.ip || request.headers.get('x-nf-client-connection-ip') || '0.0.0.0',
  };

  const res = new ResponseCollector();
  await handle(req, res);
  await res.finished;

  const headers = new Headers();
  for (const [name, value] of Object.entries(res.headers)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) for (const v of value) headers.append(name, String(v));
    else headers.set(name, String(value));
  }
  // The byte count came from the Node response; let the platform recompute it.
  headers.delete('content-length');

  return new Response(res.chunks.length ? Buffer.concat(res.chunks) : null, {
    status: res.statusCode,
    headers,
  });
}

export const config = {
  path: ['/news', '/news/*'],
};
