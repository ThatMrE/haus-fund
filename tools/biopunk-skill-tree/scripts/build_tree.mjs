#!/usr/bin/env node
/**
 * build_tree.mjs — regenerate the Biopunk Accelerator Skill Tree.
 *
 *   node tools/biopunk-skill-tree/scripts/build_tree.mjs
 *
 * Reads two inputs and writes three outputs.
 *
 * INPUTS
 *   netlify/functions/homeroom/app/data/curriculum.js   the Founder Manual —
 *       six tracks, thirty-nine modules, the S26 sequence. Imported, not
 *       parsed and not copied, so the tree cannot drift from the manual
 *       Homeroom serves at /homeroom/library.
 *   scripts/graph.mjs                                   the graph layer —
 *       dependencies, layout, the spine, videos, resources, and the eight
 *       added nodes.
 *
 * OUTPUTS
 *   tools/biopunk-skill-tree/data/tree.json             the node graph
 *   tools/biopunk-skill-tree/data/skill_nodes/<id>.json one file per node
 *   skilltree-data.js                                   the browser data layer
 *
 * The generated files are committed: the site is static and has no build step,
 * so what is in the repo is what is served. Do not hand-edit them — edit the
 * manual or graph.mjs and re-run. `validate.mjs` fails on any drift.
 */

import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { TRACKS, LIBRARY_MODULES, S26_SEQUENCE } from
  '../../../netlify/functions/homeroom/app/data/curriculum.js';
import {
  TRACK_ORDER, TRACK_ROWS, EXTRA_TRACK, EXTRA_MODULES,
  DEPENDENCIES, MAIN_PATH, VIDEOS, RESOURCES,
} from './graph.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const TOOL = resolve(HERE, '..');
const ROOT = resolve(TOOL, '..', '..');

const TREE_ID = 'biopunk-accelerator';

/* ── merge the manual with the graph layer ───────────────────────────────── */

const tracks = [EXTRA_TRACK, ...TRACKS];
const modules = [...LIBRARY_MODULES, ...EXTRA_MODULES];
const bySlug = new Map(modules.map((m) => [m.slug, m]));

/* Every module must be placed by hand: a node nobody positioned is a node
   nobody thought about, and it would land silently at the origin. */
const placed = new Set(Object.values(TRACK_ROWS).flat().filter(Boolean));
for (const m of modules) {
  if (!placed.has(m.slug)) {
    throw new Error(`module "${m.slug}" is not in TRACK_ROWS — add it to graph.mjs`);
  }
}
for (const slug of placed) {
  if (!bySlug.has(slug)) throw new Error(`TRACK_ROWS names "${slug}", which is not a module`);
}

const mainPath = new Set(MAIN_PATH);

/* Depth in the dependency graph. Used for the "level" field and to order the
   list view inside a week. Cycles are caught by validate.mjs; this walk is
   depth-capped so a cycle cannot hang the build. */
function depthOf(slug, seen = new Set()) {
  if (seen.has(slug)) return 0;
  seen.add(slug);
  const deps = DEPENDENCIES[slug] || [];
  if (!deps.length) return 0;
  return 1 + Math.max(...deps.map((d) => depthOf(d, new Set(seen))));
}

/* leads-to is the reverse of builds-on, computed rather than maintained. */
const leadsTo = new Map(modules.map((m) => [m.slug, []]));
for (const [slug, deps] of Object.entries(DEPENDENCIES)) {
  for (const dep of deps) {
    if (leadsTo.has(dep)) leadsTo.get(dep).push(slug);
  }
}

const nodes = [];
for (const [track, rows] of Object.entries(TRACK_ROWS)) {
  const column = TRACK_ORDER.indexOf(track);
  rows.forEach((slug, row) => {
    if (!slug) return; /* a spacer row, held empty on the map */
    const m = bySlug.get(slug);
    const video = VIDEOS[slug] || null;
    const resources = RESOURCES[slug] || [];
    nodes.push({
      treeId: TREE_ID,
      id: slug,
      title: { name: m.title, level: depthOf(slug) },
      track,
      kind: m.kind,
      week: m.week,
      minutes: m.minutes,
      deliverable: m.deliverable,
      /* Nothing locks. Every node is open from the first visit; the graph is a
         trajectory map, not a gate. */
      defaultStatus: 'inProgress',
      isUnlocked: true,
      onMainPath: mainPath.has(slug),
      link: `/homeroom/library/module/${slug}`,
      initialPosition: [column, row],
      dependencies: DEPENDENCIES[slug] || [],
      leadsTo: leadsTo.get(slug) || [],
      overview: {
        description: m.summary,
        objectives: m.outcomes,
        prerequisites: (DEPENDENCIES[slug] || []).map((d) => bySlug.get(d).title),
      },
      steps: {
        intro: m.summary,
        estimatedMinutes: m.minutes,
        instructions: m.work,
      },
      submission: {
        description: m.deliverable
          ? `Produce the ${m.deliverable} and log it against this module in Homeroom. Done means the artefact exists, not that you read the page.`
          : 'No named deliverable. Work the steps and keep the notes with the module in Homeroom.',
      },
      video,
      resources,
    });
  });
}

/* Order every emitted list the same way: column, then row. */
nodes.sort((a, b) =>
  a.initialPosition[0] - b.initialPosition[0] || a.initialPosition[1] - b.initialPosition[1]);

const withVideo = nodes.filter((n) => n.video).length;
const resourceCount = nodes.reduce((n, node) => n + node.resources.length, 0);
const deliverables = nodes.filter((n) => n.deliverable).length;

const meta = {
  treeId: TREE_ID,
  name: 'Biopunk Accelerator Skill Tree',
  subtitle: 'from a risk map to a company that can be diligenced',
  source: 'The Biopunk Founder Manual (Homeroom Library), Fall 2026 programme design',
  generated: 'tools/biopunk-skill-tree/scripts/build_tree.mjs',
  counts: {
    nodes: nodes.length,
    tracks: tracks.length,
    videos: withVideo,
    resources: resourceCount,
    deliverables,
    liveWeeks: 12,
  },
};

/* ── write ───────────────────────────────────────────────────────────────── */

const stamp = '/* GENERATED by tools/biopunk-skill-tree/scripts/build_tree.mjs — do not edit by hand. */';

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

const dataDir = resolve(TOOL, 'data');
const nodeDir = resolve(dataDir, 'skill_nodes');
await mkdir(nodeDir, { recursive: true });

/* Clear stale node files so a rename cannot leave an orphan behind. */
for (const file of await readdir(nodeDir)) {
  if (file.endsWith('.json')) await rm(resolve(nodeDir, file));
}

await writeJson(resolve(dataDir, 'tree.json'), {
  ...meta,
  tracks,
  mainPathNodes: MAIN_PATH,
  nodes: nodes.map((n) => ({
    id: n.id,
    title: n.title.name,
    track: n.track,
    kind: n.kind,
    week: n.week,
    description: n.overview.description,
    defaultStatus: n.defaultStatus,
    link: n.link,
    initialPosition: n.initialPosition,
    dependencies: n.dependencies,
  })),
});

for (const node of nodes) {
  await writeJson(resolve(nodeDir, `${node.id}.json`), node);
}

const browser = `${stamp}
/* Biopunk Accelerator Skill Tree — data layer for skilltree.html.

   Source of truth is the Founder Manual at
   netlify/functions/homeroom/app/data/curriculum.js plus the graph layer at
   tools/biopunk-skill-tree/scripts/graph.mjs. Regenerate with:

     node tools/biopunk-skill-tree/scripts/build_tree.mjs
*/
var SKILLTREE = ${JSON.stringify({ meta, tracks, mainPath: MAIN_PATH, sequence: S26_SEQUENCE, nodes }, null, 1)};

if (typeof module !== "undefined" && module.exports) { module.exports = SKILLTREE; }
`;
await writeFile(resolve(ROOT, 'skilltree-data.js'), browser, 'utf8');

console.log(
  `wrote ${nodes.length} nodes across ${tracks.length} tracks · ` +
  `${withVideo} videos · ${resourceCount} resources · ${deliverables} deliverables`);
