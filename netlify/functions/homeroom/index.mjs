/**
 * haus.fund/homeroom — HTTP entry point.
 *
 * The app is an ordinary `node:http` handler (see ./app), so this file is only
 * a shim between Netlify's web-standard Request/Response and the Node req/res
 * pair the app expects. Same shape as the sibling `news` function, and plain
 * JS for the same reason: no build step, no dependencies.
 *
 * The database is Postgres (Supabase), reached over the network, so a cold
 * container finds the data already there rather than seeding a fresh copy of
 * it. Set HOMEROOM_DATABASE_URL; without it the app falls back to an in-process
 * database that does not outlive the container, and /homeroom/health says so.
 */
import { Readable } from 'node:stream';

let ready = null;

/** Open the database, seed a genuinely empty one, and cache the handler. */
async function boot() {
  if (ready) return ready;
  ready = (async () => {
    process.env.HOMEROOM_STATIC_BASE ||= '/homeroom-assets';
    const { getDb } = await import('./app/db.js');
    const db = await getDb();

    /*
     * Seeding used to run on every cold container, because every cold container
     * started with an empty database. It no longer does: the store is Postgres
     * and survives the container, so this fires once on a genuinely new
     * database and never again.
     *
     *   (unset)  the full sample network — ten invented accounts sharing a
     *            documented password, plus invented labs and mentors. Right for
     *            reviewing the design, wrong for production, where those
     *            accounts are ten working keys.
     *   real     only the researched reference data: perks, the capital map,
     *            the atlas and the manual. No accounts, nothing invented.
     *   off      nothing at all.
     *
     * NOTE that `real` creates the house account, so userCount is 1 afterwards
     * and the first person to sign up is NOT made a steward. With `off` the
     * count stays 0 and they would be — which is why `off` should be paired
     * with HOMEROOM_ACCESS=closed or a roster token.
     */
    const seedMode = process.env.HOMEROOM_SEED;
    const empty = (await db.prepare('SELECT COUNT(*) AS n FROM users').get()).n === 0;
    if (seedMode !== 'off' && empty) {
      if (seedMode === 'real') {
        const { seedReal } = await import('./app/seed-real.js');
        await seedReal();
      } else {
        const { seedHomeroom } = await import('./app/seed.js');
        await seedHomeroom();
      }
    }

    // On every boot, so a steward's credentials are configuration rather than a
    // row somebody has to remember to create. A no-op unless HOMEROOM_STEWARD
    // is set; now that the database is durable it usually finds the account
    // already there and does nothing.
    const { ensureSteward } = await import('./app/steward.js');
    await ensureSteward();

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
