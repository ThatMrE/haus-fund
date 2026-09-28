/**
 * Assemble the standalone site from the repo.
 *
 * Netlify gives a project one base directory, and the app lives outside this
 * one, so the build copies what it needs in rather than keeping a second copy
 * of the app under version control. Everything it writes is gitignored.
 *
 *   node build.mjs            assemble in place, for a git-connected build
 *   node build.mjs --bundle   also write dist/, ready to upload by hand
 *
 * The two differ in one thing that matters. A git build runs this script, so
 * the committed netlify.toml names it as the build command. A manual upload
 * sends only the directory it is given, so that command would run without the
 * repo it copies from and fail — which is exactly what happened the first time.
 * `dist/` therefore carries its own netlify.toml with no build command at all,
 * because by then the building is done.
 */
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');

const bundle = process.argv.includes('--bundle');
const out = bundle ? join(here, 'dist') : here;
const functions = join(out, 'functions');
const publish = join(out, 'public');

if (bundle) await rm(out, { recursive: true, force: true });
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

if (bundle) {
  // The same settings as the committed netlify.toml, minus the build command:
  // these files are already assembled.
  const toml = (await readFile(join(here, 'netlify.toml'), 'utf8'))
    .split('\n')
    .filter((line) => !/^\s*command\s*=/.test(line))
    .join('\n');
  await writeFile(join(out, 'netlify.toml'), toml);
}

const where = bundle ? 'dist/' : '';
console.log(`Assembled the standalone feed: ${where}functions/news, ${where}functions/news-ingest.mjs, ${where}public/`);
if (bundle) console.log('Upload dist/ to deploy by hand — see README.md.');
