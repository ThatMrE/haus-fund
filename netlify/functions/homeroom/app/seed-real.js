/**
 * Seed only the real data. No sample accounts, no invented content.
 *
 *   npm run seed:real            load or refresh the reference data
 *   npm run seed:real -- --prune  ... and drop rows the data files no longer have
 *   npm run seed:real -- --as ada  attribute the rows to an existing account
 *
 * WHY THIS EXISTS SEPARATELY FROM seed.js
 *
 * `seed.js` fills an empty Homeroom with a fictional network so the design can
 * be reviewed: ten invented members sharing a documented password, invented
 * labs, threads, jobs, reviews and a hundred-odd invented mentors. That is the
 * right thing for a demo and exactly the wrong thing for production, where
 * those accounts are ten working keys and the invented content is indis-
 * tinguishable from the real content sitting next to it.
 *
 * This loads the other half — the parts of `app/data/` that are researched
 * rather than invented:
 *
 *   perks.js       69 real startup programmes, with codes left empty
 *   funders.js     the capital map, and deliberately no ratings
 *   atlas.js       46 real community and open-science labs
 *   curriculum.js  the six tracks and 39 modules from the programme design doc
 *   network.js     the five real people from the Haus network, unvetted
 *   channels.js    the six chat channels a room opens with
 *
 * It creates no members, no posts, no jobs, no events, no reviews and no
 * yearbook entries. Those are for actual people to write.
 *
 * IDEMPOTENT. Every row keys on a slug, so re-running refreshes rather than
 * duplicating — edit a data file, run it again. `--prune` additionally removes
 * rows the data files no longer contain, which is how you delete a perk.
 *
 * SAFE ON PRODUCTION. It never touches accounts, member-written content, or the
 * `code` column of a perk a steward has already filled in.
 */

import { getDb } from './db.js';
import { nowSeconds } from './util.js';
import { hashPassword } from './auth.js';
import * as hr from './models.js';
import { randomBytes } from 'node:crypto';

import { PERKS } from './data/perks.js';
import { FUNDERS as CAPITAL_MAP } from './data/funders.js';
import { ATLAS_LABS } from './data/atlas.js';
import { NETWORK_MENTORS } from './data/network.js';
import { TRACKS, LIBRARY_MODULES } from './data/curriculum.js';
import { CHANNELS } from './data/channels.js';

/**
 * The account real data is attributed to.
 *
 * Several tables require an owner — a perk has a `posted_by`, a channel has a
 * `created_by` — and on a fresh install there are no people yet. So the house
 * owns them. It is a real row with an unknowable password: nobody can sign in
 * as it, and the byline on a perk links somewhere that exists rather than 404ing.
 */
export const SYSTEM_HANDLE = process.env.HOMEROOM_SYSTEM_HANDLE || 'haus';

function ensureSystemAccount(handle = SYSTEM_HANDLE) {
  if (hr.getUser(handle)) return handle;
  hr.createUser({
    id: handle,
    email: process.env.HOMEROOM_SYSTEM_EMAIL || `${handle}@haus.fund`,
    // Random and immediately discarded. This account is a byline, not a login.
    passwordHash: hashPassword(randomBytes(32).toString('hex')),
    isAdmin: false,
  });
  hr.ensureMember(handle, {
    name: 'Haus',
    headline: 'The house account. Owns the reference data — perks, the capital map, the atlas and the manual.',
  });
  return handle;
}

/**
 * Load the reference data.
 *
 * @param {object}  options
 * @param {string}  options.as      handle to attribute rows to; defaults to the house account
 * @param {boolean} options.prune   remove rows the data files no longer contain
 * @param {boolean} options.quiet   suppress the per-set counts
 */
export function seedReal({ as = null, prune = false, quiet = true } = {}) {
  const db = getDb();
  const owner = as && hr.getUser(as) ? as : ensureSystemAccount();
  const stats = { owner, channels: 0, perks: 0, funders: 0, labs: 0, mentors: 0, tracks: 0, modules: 0, pruned: 0 };

  /* ---- chat channels ---- */
  for (const [index, [slug, name, topic, kind]] of CHANNELS.entries()) {
    hr.createChannel({ slug, name, topic, kind, position: index, createdBy: owner });
    stats.channels++;
  }

  /* ---- perks ---- */
  const perkSlugs = [];
  for (const perk of PERKS) {
    const { slug } = hr.upsertDeal({ ...perk, postedBy: owner });
    if (perkSlugs.includes(slug)) {
      throw new Error(`Two perks slugify to "${slug}" — one would overwrite the other. `
        + `Rename one of them in app/data/perks.js.`);
    }
    perkSlugs.push(slug);
    stats.perks++;
  }

  /* ---- the capital map. No ratings: those come from members, only. ---- */
  const funderSlugs = [];
  for (const funder of CAPITAL_MAP) {
    const { slug } = hr.upsertFunder({ ...funder, addedBy: owner });
    if (funderSlugs.includes(slug)) {
      throw new Error(`Two funders slugify to "${slug}". Rename one in app/data/funders.js.`);
    }
    funderSlugs.push(slug);
    stats.funders++;
  }

  /* ---- the biolab atlas ---- */
  for (const [name, city, country, region, kind, status, bsl, website, capabilities, note, source] of ATLAS_LABS) {
    hr.upsertLab({ name, city, country, region, kind, status, bsl, website, capabilities, note, source });
    stats.labs++;
  }

  /* ---- mentors: the real ones only. The 116-strong sample roster is not
         loaded here; it lives in seed.js and is replaced by the importer. ---- */
  for (const mentor of NETWORK_MENTORS) {
    hr.upsertMentor(mentor);
    stats.mentors++;
  }

  /* ---- the founder manual ---- */
  for (const [index, track] of TRACKS.entries()) {
    hr.upsertTrack(track, index);
    stats.tracks++;
  }
  for (const [index, module] of LIBRARY_MODULES.entries()) {
    hr.upsertModule(module, index);
    stats.modules++;
  }

  /*
   * Pruning is opt-in and narrow. Perks, funders and atlas labs are keyed to
   * their data file, so anything not in it is stale. Mentors are NOT pruned:
   * that table mixes seeded, calendar-sourced and imported rows, and dropping
   * the ones this file does not know about would delete an imported roster.
   * Modules are not pruned either — a member's progress hangs off them.
   */
  if (prune) {
    stats.pruned += hr.pruneBySlug('hr_deals', perkSlugs);
    stats.pruned += hr.pruneBySlug('hr_funders', funderSlugs);
    stats.pruned += hr.pruneBySlug(
      'hr_atlas',
      db.prepare('SELECT slug FROM hr_atlas').all().map((r) => r.slug)
        .filter((slug) => ATLAS_LABS.some(([name, city]) => hr.slugify(`${name}-${city}`, 'lab') === slug)),
    );
  }

  if (!quiet) {
    console.log(`Attributed to "${owner}".`);
    console.log(`  ${stats.perks} perks, ${stats.funders} funders, ${stats.labs} atlas labs,`);
    console.log(`  ${stats.mentors} network mentors, ${stats.tracks} tracks, ${stats.modules} modules,`);
    console.log(`  ${stats.channels} chat channels.`);
    if (stats.pruned) console.log(`  ${stats.pruned} stale rows removed.`);
    console.log('No accounts, posts, jobs, events, reviews or yearbook entries were created.');
  }
  return stats;
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const args = process.argv.slice(2);
  const asIndex = args.indexOf('--as');
  const { closeDb } = await import('./db.js');
  try {
    seedReal({
      as: asIndex >= 0 ? args[asIndex + 1] : null,
      prune: args.includes('--prune'),
      quiet: false,
    });
  } catch (err) {
    console.error(`\n${err.message}\n`);
    process.exitCode = 1;
  }
  closeDb();
}
