/**
 * haus.fund/homeroom — HTTP entry point.
 *
 * The app is an ordinary `node:http` handler (see ./app), so this file is only
 * a shim between Netlify's web-standard Request/Response and the Node req/res
 * pair the app expects. Same shape as the sibling `news` function, and plain
 * JS for the same reason: no build step, no dependencies.
 *
 * Serverless containers have an ephemeral filesystem, so the SQLite file lives
 * in /tmp and a cold container starts from the sample content. Accounts do not
 * survive that — read the storage section of the README before inviting anyone.
 */
import { Readable } from 'node:stream';

let ready = null;

/** Open the database and seed it once per container. */
async function boot() {
  if (ready) return ready;
  ready = (async () => {
    process.env.HOMEROOM_DB ||= '/tmp/haus-homeroom.db';
    process.env.HOMEROOM_STATIC_BASE ||= '/homeroom-assets';
    const { getDb } = await import('./app/db.js');
    const db = getDb();
    // An empty Homeroom is indistinguishable from a broken one, so a fresh
    // container fills itself. What with, depends:
    //
    //   (unset)  the full sample network — ten invented accounts sharing a
    //            documented password, plus invented labs, threads and mentors.
    //            Right for reviewing the design, wrong for production, where
    //            those accounts are ten working keys.
    //   real     only the researched reference data: perks, the capital map,
    //            the atlas, the manual and the channels. No accounts, no posts,
    //            nothing invented. This is the production setting while storage
    //            is still ephemeral — every cold container rebuilds the
    //            catalogue and nobody inherits a fake login.
    //   off      nothing at all.
    //
    // NOTE that `real` creates the house account, so userCount is 1 afterwards
    // and the first person to sign up is NOT made a steward. With `off` the
    // count stays 0 and they would be — which is why `off` should be paired
    // with HOMEROOM_ACCESS=closed or a roster token.
    const seedMode = process.env.HOMEROOM_SEED;
    if (seedMode !== 'off' && db.prepare('SELECT COUNT(*) AS n FROM users').get().n === 0) {
      if (seedMode === 'real') {
        const { seedReal } = await import('./app/seed-real.js');
        seedReal();
      } else {
        const { seedHomeroom } = await import('./app/seed.js');
        seedHomeroom();
      }
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

export default async function homeroomHandler(request, context) {
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
  path: ['/homeroom', '/homeroom/*'],
};
