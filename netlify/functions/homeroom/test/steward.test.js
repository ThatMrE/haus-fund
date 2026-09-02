/**
 * The environment-driven admin account.
 *
 * The behaviour worth pinning down is mostly the refusals: this thing creates an
 * account with full privileges from environment variables, so every path that
 * could produce one nobody chose is a test.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.HOMEROOM_DB = ':memory:';

const { ensureSteward, stewardFromEnv } = await import('../app/steward.js');
const { hashPassword, verifyPassword } = await import('../app/auth.js');
const hr = await import('../app/models.js');
const { getDb } = await import('../app/db.js');

const HASH = hashPassword('five-word-pass-phrase');

/** A distinct handle per test, since the database is shared across them. */
let n = 0;
const uniq = (prefix) => `${prefix}${++n}`;

const envFor = (handle, extra = {}) => ({
  HOMEROOM_STEWARD: handle,
  HOMEROOM_STEWARD_PASSWORD_HASH: HASH,
  ...extra,
});

/* ------------------------------------------------------------ reading env */

test('does nothing at all when HOMEROOM_STEWARD is unset', () => {
  const result = ensureSteward({ env: {} });
  assert.equal(result.status, 'skipped');
});

test('defaults the email to handle@haus.fund', () => {
  const config = stewardFromEnv(envFor('rosalind'));
  assert.equal(config.email, 'rosalind@haus.fund');
});

test('accepts an explicit email, lowercased', () => {
  const config = stewardFromEnv(envFor('rosalind', { HOMEROOM_STEWARD_EMAIL: 'R.Franklin@Kings.ac.uk' }));
  assert.equal(config.email, 'r.franklin@kings.ac.uk');
});

test('hashes a plaintext password rather than storing it', () => {
  const config = stewardFromEnv({
    HOMEROOM_STEWARD: 'barbara',
    HOMEROOM_STEWARD_PASSWORD: 'jumping-genes-of-maize',
  });
  assert.match(config.hash, /^scrypt\$/);
  assert.ok(verifyPassword('jumping-genes-of-maize', config.hash));
});

test('prefers the hash when both are set', () => {
  const config = stewardFromEnv(envFor('both', { HOMEROOM_STEWARD_PASSWORD: 'something-else-entirely' }));
  assert.equal(config.hash, HASH);
});

/* -------------------------------------------------------------- refusals */

test('refuses a steward with no secret at all', () => {
  const config = stewardFromEnv({ HOMEROOM_STEWARD: 'nokey' });
  assert.ok(config.error, 'should be an error, not a silent account');
  assert.match(config.error, /Refusing/);
});

test('refuses an empty password', () => {
  const config = stewardFromEnv({ HOMEROOM_STEWARD: 'blank', HOMEROOM_STEWARD_PASSWORD: '' });
  assert.ok(config.error);
});

test('refuses a password below the signup floor', () => {
  const config = stewardFromEnv({ HOMEROOM_STEWARD: 'weak', HOMEROOM_STEWARD_PASSWORD: 'short' });
  assert.match(config.error, /at least 10 characters/);
});

test('refuses a hash that is not one of ours', () => {
  const config = stewardFromEnv({
    HOMEROOM_STEWARD: 'bogus',
    HOMEROOM_STEWARD_PASSWORD_HASH: '$2b$10$abcdefghijklmnopqrstuv',
  });
  assert.match(config.error, /not a hash this build produces/);
});

test('refuses an unusable handle', () => {
  const config = stewardFromEnv(envFor('a'));
  assert.match(config.error, /HOMEROOM_STEWARD is not a usable handle/);
});

test('refuses an unusable email', () => {
  const config = stewardFromEnv(envFor('fine', { HOMEROOM_STEWARD_EMAIL: 'not-an-address' }));
  assert.match(config.error, /HOMEROOM_STEWARD_EMAIL is not usable/);
});

test('a misconfigured steward is an error, not a thrown exception', () => {
  // The site must still boot. A steward nobody can use beats a site nobody can.
  const result = ensureSteward({ env: { HOMEROOM_STEWARD: 'nosecret' } });
  assert.equal(result.status, 'error');
  assert.ok(!hr.getUser('nosecret'), 'no account should have been created');
});

/* -------------------------------------------------------------- creating */

test('creates the account as an admin, with a profile', () => {
  const handle = uniq('steward');
  const result = ensureSteward({ env: envFor(handle) });

  assert.equal(result.status, 'created');
  const user = hr.getUser(handle);
  assert.equal(user.is_admin, 1);
  assert.equal(user.email, `${handle}@haus.fund`);
  assert.ok(verifyPassword('five-word-pass-phrase', user.password_hash));
  assert.ok(hr.getMember(handle), 'should have a member row, so the byline resolves');
});

test('running twice is a no-op the second time', () => {
  const handle = uniq('twice');
  assert.equal(ensureSteward({ env: envFor(handle) }).status, 'created');
  assert.equal(ensureSteward({ env: envFor(handle) }).status, 'present');
});

test('promotes an existing ordinary account instead of failing', () => {
  const handle = uniq('promoted');
  hr.createUser({ id: handle, email: `${handle}@haus.fund`, passwordHash: hashPassword('an-existing-password') });
  assert.equal(hr.getUser(handle).is_admin, 0);

  assert.equal(ensureSteward({ env: envFor(handle) }).status, 'promoted');
  assert.equal(hr.getUser(handle).is_admin, 1);
});

test('promoting leaves the existing password alone', () => {
  const handle = uniq('keeps');
  hr.createUser({ id: handle, email: `${handle}@haus.fund`, passwordHash: hashPassword('an-existing-password') });
  ensureSteward({ env: envFor(handle) });

  const user = hr.getUser(handle);
  assert.ok(verifyPassword('an-existing-password', user.password_hash), 'must not clobber a password set by hand');
  assert.ok(!verifyPassword('five-word-pass-phrase', user.password_hash));
});

test('refuses when the email belongs to a different account', () => {
  const other = uniq('owner');
  hr.createUser({ id: other, email: 'shared@haus.fund', passwordHash: hashPassword('an-existing-password') });

  const result = ensureSteward({ env: envFor(uniq('claimant'), { HOMEROOM_STEWARD_EMAIL: 'shared@haus.fund' }) });
  assert.equal(result.status, 'error');
  assert.match(result.message, new RegExp(other));
});

/* -------------------------------------------------------------- rotating */

test('--force resets the password and ends open sessions', async () => {
  const handle = uniq('rotate');
  ensureSteward({ env: envFor(handle) });

  const { createSession } = await import('../app/auth.js');
  createSession(handle);
  const open = () => getDb().prepare('SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?').get(handle).n;
  assert.equal(open(), 1);

  const next = hashPassword('a-completely-different-phrase');
  const result = ensureSteward({
    env: envFor(handle, { HOMEROOM_STEWARD_PASSWORD_HASH: next }),
    force: true,
  });

  assert.equal(result.status, 'reset');
  assert.ok(verifyPassword('a-completely-different-phrase', hr.getUser(handle).password_hash));
  assert.equal(open(), 0, 'rotating a password must not leave the old session working');
});
