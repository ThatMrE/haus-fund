/**
 * Local dev server. The Netlify function wraps the same handler; this just
 * gives it a port and serves the static assets the CDN serves in production.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.HOMEROOM_STATIC_BASE ||= '/homeroom-assets';

const SITE = fileURLToPath(new URL('../../../', import.meta.url));
const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.json': 'application/json; charset=utf-8',
};

const { getDb } = await import('./app/db.js');
const db = await getDb();
if ((await db.prepare('SELECT COUNT(*) AS n FROM users').get()).n === 0) {
  const { seedHomeroom } = await import('./app/seed.js');
  const result = await seedHomeroom();
  if (result?.stats) console.log('Seeded the sample network.');
}
const { handle } = await import('./app/app.js');

/**
 * Netlify publishes the repository root, so the stylesheet's `@import` of
 * /tokens/*.css and /fonts.css resolves there in production. Serve the same
 * way locally, or the whole design system is missing and every page renders
 * unstyled — which looks like an app bug and is not one.
 */
async function serveFromSite(path, res) {
  const rel = normalize(decodeURIComponent(path).replace(/^\/+/, ''));
  if (!rel || rel.startsWith('..')) return false;
  const file = join(SITE, rel);
  if (!file.startsWith(SITE)) return false;
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(data);
    return true;
  } catch {
    return false;
  }
}

const port = Number(process.env.PORT || 8788);

createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;

  if (path === '/') {
    res.writeHead(302, { location: '/homeroom' });
    return res.end();
  }
  if (!path.startsWith('/homeroom') || path.startsWith('/homeroom-assets/')) {
    if (await serveFromSite(path, res)) return;
  }
  await handle(req, res);
}).listen(port, () => {
  console.log(`Homeroom on http://localhost:${port}/homeroom`);
});
