#!/usr/bin/env node
// Static checks for haus.fund. No dependencies. Run: node scripts/check-site.mjs
//
// 1. Every committed .md file is blocked in _redirects.
//    publish = "." serves every file in the repo, so an unlisted .md goes live.
// 2. Every internal href/src in a published HTML page points at something that exists:
//    a file, a directory index, a _redirects source, or a function route.
//
// Exit code 1 on any failure, so CI blocks the merge.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n').filter(Boolean);
const errors = [];

// ── _redirects ──
const redirects = readFileSync(join(root, '_redirects'), 'utf8')
  .split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'))
  .map(l => l.split(/\s+/));
const redirectSources = redirects.map(r => r[0]);
const blockedPrefixes = redirects
  .filter(r => r[0].endsWith('/*') && r[1] === '/404.html')
  .map(r => r[0].slice(0, -1)); // "/netlify/*" -> "/netlify/"

const isBlocked = p => redirectSources.includes(p) || blockedPrefixes.some(pre => p.startsWith(pre));

// ── check 1: markdown must not be served ──
for (const f of tracked.filter(f => f.endsWith('.md'))) {
  const p = '/' + f;
  if (!isBlocked(p)) errors.push(`_redirects: ${f} is served publicly. Add "${p} /404.html 404!" to _redirects.`);
}

// ── check 2: internal links ──
const functionRoutes = ['/news', '/homeroom', '/lp', '/.netlify/'];
const pages = tracked.filter(f => f.endsWith('.html') && !f.startsWith('netlify/') && !f.startsWith('tools/') && !f.startsWith('sites/'));

function resolves(url) {
  const path = decodeURI(url.split(/[?#]/)[0]);
  if (path === '' || path === '/') return true;
  if (functionRoutes.some(r => path === r || path.startsWith(r.endsWith('/') ? r : r + '/'))) return true;
  if (redirectSources.includes(path)) return true;
  const fsPath = join(root, path);
  if (existsSync(fsPath)) return statSync(fsPath).isFile() || existsSync(join(fsPath, 'index.html'));
  // Netlify pretty URLs: /team -> team.html
  return existsSync(fsPath + '.html');
}

for (const page of pages) {
  const html = readFileSync(join(root, page), 'utf8');
  const base = '/' + page.split('/').slice(0, -1).join('/');
  for (const m of html.matchAll(/\s(?:href|src)=["']([^"']+)["']/g)) {
    const raw = m[1].trim();
    if (/^(https?:|mailto:|tel:|data:|javascript:|#|\/\/|\$\{|\{)/.test(raw) || raw.includes('${')) continue;
    const abs = raw.startsWith('/') ? raw : join(base, raw);
    if (!resolves(abs)) errors.push(`${page}: broken link "${raw}"`);
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  console.error(`\n${errors.length} problem(s) found.`);
  process.exit(1);
}
console.log(`OK: ${tracked.filter(f => f.endsWith('.md')).length} markdown files blocked, ${pages.length} pages link-checked.`);
