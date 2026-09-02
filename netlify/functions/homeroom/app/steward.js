/**
 * The one account that exists because the environment says so.
 *
 * WHY THIS IS NOT A ROUTE OR A ONE-OFF SCRIPT
 *
 * Homeroom's database lives on the function container's /tmp. Every cold
 * container starts from nothing, seeds itself, and is thrown away again. An
 * account created by hand — through a signup form, an admin route, a script run
 * once against production — exists on exactly one container and is gone by the
 * next request. There is no "create the admin once" on this storage.
 *
 * So the steward has to be derivable from configuration, and recreated
 * identically on every boot. That is what this does: given a handle and a
 * password (or better, a password hash) in the environment, it makes sure the
 * account is there, is a steward, and has the same password it had last time.
 *
 * It runs on every boot regardless of HOMEROOM_SEED, so turning seeding off
 * does not lock the stewards out of the room.
 *
 * WHAT IT DELIBERATELY WILL NOT DO
 *
 *   - Create an admin with no password. A blank or missing secret is a no-op
 *     with a line in the log, never an account anyone can walk into.
 *   - Overwrite the password of an account that already exists. On production
 *     the row is always freshly created so this never comes up; on a local
 *     database it means running this cannot silently undo a password you
 *     changed by hand. `scripts/make-steward.js --force` is the way to rotate.
 *   - Accept a password below the same floor the signup form enforces.
 *
 * SETTING IT UP
 *
 *   node scripts/make-steward.js --handle erik
 *
 * prints the three environment variables to paste into Netlify, with a
 * generated password shown once and stored only as a scrypt hash.
 */

import * as hr from './models.js';
import { getDb } from './db.js';
import { hashPassword, validateUsername, validateEmail, validatePassword } from './auth.js';

/** A stored hash, so the plaintext never has to live in the environment. */
const HASH_RE = /^scrypt\$\d+\$\d+\$\d+\$[0-9a-f]+\$[0-9a-f]+$/;

/**
 * Read the steward out of the environment.
 *
 * @returns {{handle: string, email: string, hash: string}|{skip: string}|{error: string}}
 */
export function stewardFromEnv(env = process.env) {
  const handle = String(env.HOMEROOM_STEWARD || '').trim().toLowerCase();
  if (!handle) return { skip: 'HOMEROOM_STEWARD is not set' };

  const handleError = validateUsername(handle);
  if (handleError) return { error: `HOMEROOM_STEWARD is not a usable handle. ${handleError}` };

  const email = String(env.HOMEROOM_STEWARD_EMAIL || `${handle}@haus.fund`).trim().toLowerCase();
  const emailError = validateEmail(email);
  if (emailError) return { error: `HOMEROOM_STEWARD_EMAIL is not usable. ${emailError}` };

  const stored = String(env.HOMEROOM_STEWARD_PASSWORD_HASH || '').trim();
  if (stored) {
    if (!HASH_RE.test(stored)) {
      return {
        error: 'HOMEROOM_STEWARD_PASSWORD_HASH is not a hash this build produces. '
          + 'Generate one with: node scripts/make-steward.js --handle <handle>',
      };
    }
    return { handle, email, hash: stored };
  }

  // The fallback. Works, but the plaintext then sits in the environment where
  // anyone with dashboard access can read it, which the hash avoids.
  const plain = String(env.HOMEROOM_STEWARD_PASSWORD || '');
  if (!plain) {
    return {
      error: `HOMEROOM_STEWARD is set to "${handle}" but neither `
        + 'HOMEROOM_STEWARD_PASSWORD_HASH nor HOMEROOM_STEWARD_PASSWORD is. '
        + 'Refusing to create an account nobody has the key to.',
    };
  }
  const passwordError = validatePassword(plain);
  if (passwordError) return { error: `HOMEROOM_STEWARD_PASSWORD is too weak. ${passwordError}` };

  return { handle, email, hash: hashPassword(plain) };
}

/**
 * Make sure the configured steward exists and is one.
 *
 * @param {object}  options
 * @param {object}  options.env    environment to read; defaults to process.env
 * @param {boolean} options.force  also reset the password of an existing account
 * @param {boolean} options.quiet  suppress the log line
 * @returns {{status: 'created'|'promoted'|'reset'|'present'|'skipped'|'error',
 *            handle?: string, message?: string}}
 */
export function ensureSteward({ env = process.env, force = false, quiet = true } = {}) {
  const config = stewardFromEnv(env);

  if (config.skip) return { status: 'skipped', message: config.skip };
  if (config.error) {
    // Loud, and non-fatal. A misconfigured steward must not take the site down;
    // it should be obvious in the log and fixed in the dashboard.
    console.error(`[homeroom] steward: ${config.error}`);
    return { status: 'error', message: config.error };
  }

  const { handle, email, hash } = config;
  const db = getDb();
  const existing = hr.getUser(handle);

  if (!existing) {
    // Guard the address as well as the handle: two rows sharing an email would
    // make "sign in with your email" ambiguous.
    const byEmail = hr.getUserByEmail(email);
    if (byEmail && byEmail.id !== handle) {
      const message = `${email} already belongs to "${byEmail.id}". `
        + 'Set HOMEROOM_STEWARD_EMAIL to a different address, or set HOMEROOM_STEWARD to that handle.';
      console.error(`[homeroom] steward: ${message}`);
      return { status: 'error', message };
    }
    hr.createUser({ id: handle, email, passwordHash: hash, isAdmin: true });
    hr.ensureMember(handle, { name: handle, headline: 'Steward.' });
    if (!quiet) console.log(`[homeroom] steward "${handle}" created.`);
    return { status: 'created', handle };
  }

  let status = 'present';
  if (!existing.is_admin) {
    db.prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(handle);
    status = 'promoted';
  }
  if (force) {
    db.prepare('UPDATE users SET password_hash = ?, email = ? WHERE id = ?').run(hash, email, handle);
    // Any session opened under the old password stops working, which is the
    // point of rotating one.
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(handle);
    status = 'reset';
  }
  hr.ensureMember(handle);
  if (!quiet) console.log(`[homeroom] steward "${handle}" ${status}.`);
  return { status, handle };
}
