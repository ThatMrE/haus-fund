#!/usr/bin/env node
/**
 * Mint the environment variables for an admin account.
 *
 *   # Generate a password, print the three variables, show the password once
 *   node scripts/make-steward.js --handle erik
 *
 *   # Use a password you already chose
 *   node scripts/make-steward.js --handle erik --password 'correct horse battery'
 *
 *   # Apply it to the local database as well as printing it
 *   node scripts/make-steward.js --handle erik --apply
 *
 *   # Rotate a local account's password and end its sessions
 *   node scripts/make-steward.js --handle erik --apply --force
 *
 * WHY THE HASH AND NOT THE PASSWORD
 *
 * Netlify environment variables are readable by everyone with dashboard access
 * and are shown back to you in the UI. A scrypt hash sitting there is useless to
 * a reader — it cannot be replayed as a login — while the plaintext is a working
 * key to a steward account. So this prints the hash for the environment and the
 * password only to your terminal, once, for your password manager.
 *
 * HOMEROOM_STEWARD_PASSWORD (plaintext) is still honoured by app/steward.js,
 * because sometimes you want the two-minute version. It is the worse option.
 */

import { hashPassword, validateUsername, validateEmail, validatePassword } from '../app/auth.js';
import { randomBytes } from 'node:crypto';

const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const YELLOW = '\x1b[33m';
const OFF = '\x1b[0m';

const args = process.argv.slice(2);
const valueOf = (flag, fallback = null) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};

const handle = String(valueOf('--handle') || process.env.HOMEROOM_STEWARD || '').trim().toLowerCase();
const apply = args.includes('--apply');
const force = args.includes('--force');

/**
 * Five words beats a shorter string of punctuation: it is long, it survives
 * being read aloud, and it gets typed correctly the first time.
 */
const WORDS = [
  'agar', 'amber', 'anvil', 'basalt', 'beacon', 'bellows', 'bramble', 'bronze',
  'canyon', 'cedar', 'cinder', 'cobalt', 'compass', 'copper', 'cortex', 'crater',
  'delta', 'dogwood', 'ember', 'fathom', 'ferment', 'flint', 'fossil', 'gantry',
  'granite', 'harbor', 'helix', 'hollow', 'indigo', 'kelp', 'lantern', 'ledger',
  'lichen', 'lumen', 'marrow', 'meadow', 'mesa', 'mortar', 'nectar', 'obsidian',
  'orchard', 'peptide', 'pigment', 'plasmid', 'quarry', 'quartz', 'ribbon',
  'saffron', 'sandbar', 'sextant', 'shale', 'sifter', 'signal', 'slate', 'solder',
  'spindle', 'sprocket', 'stanza', 'sundial', 'talon', 'tannin', 'thicket',
  'tundra', 'vellum', 'verdant', 'walnut', 'willow', 'zephyr',
];

/** Rejection sampling, so the modulo does not favour the front of the list. */
function pick(list) {
  const limit = Math.floor(256 / list.length) * list.length;
  let byte;
  do { byte = randomBytes(1)[0]; } while (byte >= limit);
  return list[byte % list.length];
}

const generate = () => Array.from({ length: 5 }, () => pick(WORDS)).join('-');

async function main() {
  if (!handle) {
    console.error('\nUsage: node scripts/make-steward.js --handle <handle> [--password <password>] [--apply] [--force]\n');
    process.exitCode = 2;
    return;
  }
  const handleError = validateUsername(handle);
  if (handleError) {
    console.error(`\n${handleError}\n`);
    process.exitCode = 2;
    return;
  }

  const email = String(valueOf('--email') || process.env.HOMEROOM_STEWARD_EMAIL || `${handle}@haus.fund`)
    .trim().toLowerCase();
  const emailError = validateEmail(email);
  if (emailError) {
    console.error(`\n${emailError}\n`);
    process.exitCode = 2;
    return;
  }

  const given = valueOf('--password');
  if (given) {
    const passwordError = validatePassword(given);
    if (passwordError) {
      console.error(`\n${passwordError}\n`);
      process.exitCode = 2;
      return;
    }
  }
  const password = given || generate();
  const hash = hashPassword(password);

  console.log(`\n${BOLD}Set these three on the site (Netlify -> Site configuration -> Environment variables):${OFF}\n`);
  console.log(`  HOMEROOM_STEWARD               ${handle}`);
  console.log(`  HOMEROOM_STEWARD_EMAIL         ${email}`);
  console.log(`  HOMEROOM_STEWARD_PASSWORD_HASH ${hash}`);

  console.log(`\n${BOLD}Then sign in at /homeroom/login with:${OFF}\n`);
  console.log(`  email     ${email}`);
  console.log(`  password  ${YELLOW}${password}${OFF}`);
  console.log(`\n${DIM}This is the only time the password is shown; nothing stores it but your`);
  console.log('password manager. The hash is what goes in the environment, and it cannot be');
  console.log('turned back into the password or replayed as a login.');
  console.log('\nThe account is rebuilt from these variables on every cold start, so it');
  console.log('survives redeploys. Changing the password inside Homeroom does NOT: that');
  console.log('change lives on one container. To rotate for real, re-run this and update');
  console.log(`HOMEROOM_STEWARD_PASSWORD_HASH.${OFF}\n`);

  if (apply) {
    const { ensureSteward } = await import('../app/steward.js');
    const { closeDb } = await import('../app/db.js');
    const result = ensureSteward({
      env: {
        ...process.env,
        HOMEROOM_STEWARD: handle,
        HOMEROOM_STEWARD_EMAIL: email,
        HOMEROOM_STEWARD_PASSWORD_HASH: hash,
      },
      force,
      quiet: true,
    });
    closeDb();
    if (result.status === 'error') {
      console.error(`Local database: ${result.message}\n`);
      process.exitCode = 1;
      return;
    }
    if (result.status === 'present') {
      console.log(`${DIM}Local database: "${handle}" already exists and was left alone.`);
      console.log(`Re-run with --force to reset its password to the one above.${OFF}\n`);
    } else {
      console.log(`${DIM}Local database: "${handle}" ${result.status}.${OFF}\n`);
    }
  }
}

main();
