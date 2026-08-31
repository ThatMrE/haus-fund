import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { extname, join, normalize } from 'node:path';
import { handle } from './app/app.js';
import { getDb, closeDb } from './app/db.js';
import { purgeExpiredSessions } from './app/auth.js';

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '0.0.0.0';

getDb(); // open the database (and run migrations) before accepting traffic

/* In production the site root and this app sit on one domain, so the
   stylesheet can import /tokens/*.css directly. Locally there is no CDN in
   front, so the dev server stands in for it. */
const SITE_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const SITE_PREFIXES = ['/tokens/', '/assets/'];
const SITE_FILES = ['/fonts.css', '/styles.css', '/favicon.svg'];
const MIME = { '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg' };

async function serveSiteFile(pathname, res) {
  const wanted = SITE_FILES.includes(pathname) || SITE_PREFIXES.some((p) => pathname.startsWith(p));
  if (!wanted) return false;
  const rel = normalize(pathname).replace(/^(\.\.[/\\])+/, '').replace(/^\//, '');
  const file = join(SITE_ROOT, rel);
  if (!file.startsWith(SITE_ROOT)) return false;
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(data);
    return true;
  } catch {
    return false;
  }
}

const server = createServer((req, res) => {
  const started = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    if (!req.url.startsWith('/static/')) {
      console.log(`${req.method} ${req.url} ${res.statusCode} ${ms.toFixed(1)}ms`);
    }
  });
  const pathname = (req.url || '/').split('?')[0];
  serveSiteFile(pathname, res)
    .then((served) => (served ? undefined : handle(req, res)))
    .catch((err) => {
    console.error('unhandled', err);
    if (!res.headersSent) res.writeHead(500, { 'content-type': 'text/plain' });
    res.end('server error');
  });
});

server.listen(PORT, HOST, () => {
  console.log(`\n  haus.fund/news listening on http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}\n`);
});

const sessionSweep = setInterval(purgeExpiredSessions, 60 * 60 * 1000);
sessionSweep.unref();

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    console.log(`\n${signal} — closing down.`);
    server.close(() => {
      closeDb();
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 3000).unref();
  });
}
