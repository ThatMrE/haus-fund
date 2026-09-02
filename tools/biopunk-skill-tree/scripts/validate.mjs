#!/usr/bin/env node
/**
 * validate.mjs — integrity checks for the Biopunk Accelerator Skill Tree.
 *
 *   node tools/biopunk-skill-tree/scripts/validate.mjs
 *
 * Fails on:
 *   - a dependency that names a node which does not exist
 *   - a dependency cycle
 *   - a locked node (nothing in this tree ever locks)
 *   - a main-path entry that is not a node
 *   - a malformed video URL or a duplicated video across nodes
 *   - a node with no resources, or a resource with no title or no usable URL
 *   - a track with no nodes, or a node in a track that does not exist
 *   - generated output that is stale relative to the manual or the graph layer
 *
 * The staleness check is the important one: the site is static, so the
 * committed skilltree-data.js is what gets served. If it disagrees with the
 * Founder Manual, the manual wins and the build has not been re-run.
 */

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const HERE = dirname(fileURLToPath(import.meta.url));
const TOOL = resolve(HERE, '..');
const ROOT = resolve(TOOL, '..', '..');
const require = createRequire(import.meta.url);

const problems = [];
const fail = (msg) => problems.push(msg);

const tree = JSON.parse(await readFile(resolve(TOOL, 'data', 'tree.json'), 'utf8'));
const data = require(resolve(ROOT, 'skilltree-data.js'));

const byId = new Map(data.nodes.map((n) => [n.id, n]));
const trackSlugs = new Set(data.tracks.map((t) => t.slug));

/* ── graph ───────────────────────────────────────────────────────────────── */

for (const node of data.nodes) {
  for (const dep of node.dependencies) {
    if (!byId.has(dep)) fail(`${node.id}: depends on "${dep}", which is not a node`);
  }
  if (node.defaultStatus === 'locked' || node.isUnlocked === false) {
    fail(`${node.id}: is locked. Nothing in this tree locks.`);
  }
  if (!trackSlugs.has(node.track)) fail(`${node.id}: is in unknown track "${node.track}"`);
  if (!node.overview.description) fail(`${node.id}: has no summary`);
  if (!node.steps.instructions.length) fail(`${node.id}: has no work steps`);
  if (!node.overview.objectives.length) fail(`${node.id}: has no outcomes`);
}

/* Cycle detection: an iterative depth-first walk with an explicit stack, so a
   cycle is reported with the path that closes it rather than blowing the
   JavaScript stack. */
const WHITE = 0; const GREY = 1; const BLACK = 2;
const colour = new Map(data.nodes.map((n) => [n.id, WHITE]));
for (const start of byId.keys()) {
  if (colour.get(start) !== WHITE) continue;
  const stack = [[start, 0]];
  const path = [];
  colour.set(start, GREY);
  path.push(start);
  while (stack.length) {
    const frame = stack[stack.length - 1];
    const deps = byId.get(frame[0]).dependencies;
    if (frame[1] >= deps.length) {
      colour.set(frame[0], BLACK);
      stack.pop();
      path.pop();
      continue;
    }
    const next = deps[frame[1]];
    frame[1] += 1;
    if (!byId.has(next)) continue;
    if (colour.get(next) === GREY) {
      fail(`dependency cycle: ${[...path, next].join(' → ')}`);
      continue;
    }
    if (colour.get(next) === WHITE) {
      colour.set(next, GREY);
      path.push(next);
      stack.push([next, 0]);
    }
  }
}

for (const id of data.mainPath) {
  if (!byId.has(id)) fail(`main path names "${id}", which is not a node`);
}

for (const track of data.tracks) {
  if (!data.nodes.some((n) => n.track === track.slug)) fail(`track "${track.slug}" has no nodes`);
}

/* ── videos and resources ────────────────────────────────────────────────── */

const YOUTUBE = /^https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}$/;
const seenVideo = new Map();
for (const node of data.nodes) {
  if (!node.video) continue;
  const { url, title, source } = node.video;
  if (!YOUTUBE.test(url)) fail(`${node.id}: video URL is not a canonical YouTube watch URL: ${url}`);
  if (!title || !source) fail(`${node.id}: video is missing a title or a source`);
  if (seenVideo.has(url)) fail(`${node.id}: reuses the video already on ${seenVideo.get(url)}`);
  seenVideo.set(url, node.id);
}

for (const node of data.nodes) {
  if (!node.resources.length) fail(`${node.id}: has no resources`);
  for (const r of node.resources) {
    if (!r.title) fail(`${node.id}: a resource has no title`);
    if (!/^(https:\/\/|\/)/.test(r.url || '')) {
      fail(`${node.id}: resource "${r.title}" needs an https:// or site-relative URL`);
    }
  }
}

/* ── staleness ───────────────────────────────────────────────────────────── */

const manual = await import('../../../netlify/functions/homeroom/app/data/curriculum.js');
for (const m of manual.LIBRARY_MODULES) {
  const node = byId.get(m.slug);
  if (!node) {
    fail(`the manual has module "${m.slug}" but the tree does not — re-run build_tree.mjs`);
    continue;
  }
  if (node.title.name !== m.title || node.overview.description !== m.summary) {
    fail(`${m.slug}: the manual and the generated tree disagree — re-run build_tree.mjs`);
  }
}
if (tree.counts.nodes !== data.nodes.length) {
  fail('tree.json and skilltree-data.js disagree on node count — re-run build_tree.mjs');
}

/* Homeroom's /homeroom/library/tree page states the node count in prose, and
   cannot import it: the tree is not in that function's bundle. Check it here
   instead, so the number in the copy cannot quietly go stale. */
const routes = await readFile(
  resolve(ROOT, 'netlify', 'functions', 'homeroom', 'app', 'routes.js'), 'utf8');
const stated = /const SKILL_TREE_NODES = (\d+);/.exec(routes);
if (!stated) {
  fail('homeroom routes.js no longer declares SKILL_TREE_NODES — the tree page needs it');
} else if (Number(stated[1]) !== data.nodes.length) {
  fail(`homeroom routes.js says SKILL_TREE_NODES = ${stated[1]}, but the tree draws `
    + `${data.nodes.length} — update it`);
}

/* ── report ──────────────────────────────────────────────────────────────── */

if (problems.length) {
  console.error(`${problems.length} problem${problems.length === 1 ? '' : 's'}:`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

console.log(
  `ok — ${data.nodes.length} nodes, ${data.tracks.length} tracks, ` +
  `${seenVideo.size} videos, ` +
  `${data.nodes.reduce((n, x) => n + x.resources.length, 0)} resources, no cycles, nothing locked`);
