/**
 * Assemble the standalone site from the repo.
 *
 * Netlify gives a project one base directory, and the app lives outside this
 * one, so the build copies what it needs in rather than keeping a second copy
 * of the app under version control. Everything it writes is gitignored.
 *
 * Run from this directory: `node build.mjs`.
 */
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');

const functions = join(here, 'functions');
const publish = join(here, 'public');

await rm(functions, { recursive: true, force: true });
await rm(publish, { recursive: true, force: true });
await mkdir(join(functions, 'news'), { recursive: true });
await mkdir(publish, { recursive: true });

const app = join(repo, 'netlify', 'functions', 'news');

// The app, minus its tests and any local database.
await cp(join(app, 'app'), join(functions, 'news', 'app'), { recursive: true });
await cp(join(app, 'serve.mjs'), join(functions, 'news', 'serve.mjs'));
await cp(join(repo, 'netlify', 'functions', 'news-ingest.mjs'), join(functions, 'news-ingest.mjs'));

// This site's mount, as the function's entry point.
await cp(join(here, 'entry.mjs'), join(functions, 'news', 'index.mjs'));

// The stylesheet reaches for /fonts.css and /tokens/*.css at the site root, so
// a standalone deployment has to carry them.
await cp(join(repo, 'news-assets'), join(publish, 'news-assets'), { recursive: true });
await cp(join(repo, 'tokens'), join(publish, 'tokens'), { recursive: true });
await cp(join(repo, 'fonts.css'), join(publish, 'fonts.css'));
await cp(join(repo, 'favicon.svg'), join(publish, 'favicon.svg'));

await writeFile(
  join(publish, 'robots.txt'),
  'User-agent: *\nAllow: /\nDisallow: /login\nDisallow: /submit\n',
);

console.log('Assembled the standalone feed: functions/news, functions/news-ingest.mjs, public/');
