import { randomBytes, scryptSync, timingSafeEqual, createHmac, createHash } from 'node:crypto';
import { getDb } from './db.js';
import { nowSeconds } from './util.js';

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, keylen: 64 };
export const SESSION_COOKIE = 'homeroom_session';
export const SESSION_TTL = 60 * 60 * 24 * 30; // 30 days

/** Server secret used to derive CSRF tokens from session tokens. */
const SECRET = process.env.HOMEROOM_SECRET || randomBytes(32).toString('hex');

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, SCRYPT_PARAMS.keylen, SCRYPT_PARAMS).toString('hex');
  return `scrypt$${SCRYPT_PARAMS.N}$${SCRYPT_PARAMS.r}$${SCRYPT_PARAMS.p}$${salt}$${derived}`;
}

export function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, N, r, p, salt, expected] = parts;
  const expectedBuf = Buffer.from(expected, 'hex');
  let derived;
  try {
    derived = scryptSync(password, salt, expectedBuf.length, {
      N: Number(N),
      r: Number(r),
      p: Number(p),
    });
  } catch {
    return false;
  }
  return derived.length === expectedBuf.length && timingSafeEqual(derived, expectedBuf);
}

export async function createSession(userId) {
  const token = randomBytes(32).toString('hex');
  const now = nowSeconds();
  (await (await getDb())
    .prepare('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .run(token, userId, now, now + SESSION_TTL));
  return token;
}

export async function getSessionUser(token) {
  if (!token) return null;
  const row = (await (await getDb())
    .prepare(
      `SELECT u.* FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > ?`,
    )
    .get(token, nowSeconds()));
  if (!row || row.banned) return null;
  return row;
}

/**
 * End every session an account has on this container.
 *
 * The counterpart to changing a password: a credential change that leaves the
 * old cookie working has not actually taken the key back from anyone.
 */
export async function destroyAllSessions(userId) {
  return (await (await getDb()).prepare('DELETE FROM sessions WHERE user_id = ?').run(userId)).changes;
}

export async function destroySession(token) {
  if (!token) return;
  (await (await getDb()).prepare('DELETE FROM sessions WHERE token = ?').run(token));
}

export async function purgeExpiredSessions() {
  return (await (await getDb()).prepare('DELETE FROM sessions WHERE expires_at <= ?').run(nowSeconds())).changes;
}

/** CSRF token bound to the session, so it needs no extra storage. */
export function csrfToken(sessionToken) {
  if (!sessionToken) return '';
  return createHmac('sha256', SECRET).update(sessionToken).digest('hex').slice(0, 32);
}

export function checkCsrf(sessionToken, submitted) {
  const expected = csrfToken(sessionToken);
  if (!expected || typeof submitted !== 'string' || submitted.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(submitted));
}

export function sessionCookie(token, { secure = false } = {}) {
  const attrs = [
    `${SESSION_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${SESSION_TTL}`,
  ];
  if (secure) attrs.push('Secure');
  return attrs.join('; ');
}

export function clearCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

const USERNAME_RE = /^[A-Za-z0-9_-]{2,20}$/;
const EMAIL_RE = /^[^@\s]+@[^@\s.]+\.[^@\s]+$/;

export function validateUsername(id) {
  if (!id || !USERNAME_RE.test(id)) {
    return 'Handles are 2-20 characters: letters, numbers, dashes and underscores.';
  }
  if (/^\d+$/.test(id)) return 'Handles cannot be only digits.';
  return null;
}

export function validatePassword(password) {
  if (!password || password.length < 10) return 'Use at least 10 characters. Longer beats complicated.';
  if (password.length > 200) return 'That password is too long — 200 characters is the cap.';
  return null;
}

export function validateEmail(email) {
  if (!email || !EMAIL_RE.test(String(email).trim())) return 'That does not look like an email address.';
  if (String(email).length > 254) return 'That email address is too long.';
  return null;
}

/* ------------------------------------------------------- password resets */

export const RESET_TTL = 60 * 60; // one hour

/**
 * Mint a reset token. Only its hash is stored, so a copy of the database does
 * not let anyone take over an account; the token itself exists only in the
 * link that goes to the address on file.
 */
export async function createResetToken(userId) {
  const token = randomBytes(32).toString('hex');
  const now = nowSeconds();
  (await (await getDb())
    .prepare(
      `INSERT INTO password_resets (token_hash, user_id, created_at, expires_at)
       VALUES (?, ?, ?, ?)`,
    )
    .run(hashToken(token), userId, now, now + RESET_TTL));
  return token;
}

export function hashToken(token) {
  return createHash('sha256').update(String(token)).digest('hex');
}

/** Look a token up without spending it. */
export async function findResetToken(token) {
  if (!token) return null;
  const row = (await (await getDb())
    .prepare('SELECT * FROM password_resets WHERE token_hash = ?')
    .get(hashToken(token)));
  if (!row || row.used_at || row.expires_at <= nowSeconds()) return null;
  return row;
}

/**
 * Spend a token and set the new password, in one transaction, and drop every
 * existing session for that account: a reset is also how you throw someone out.
 */
export async function consumeResetToken(token, newPassword) {
  const row = await findResetToken(token);
  if (!row) return null;
  const now = nowSeconds();
  const db = await getDb();
  db.exec('BEGIN');
  try {
    const spent = (await db
      .prepare('UPDATE password_resets SET used_at = ? WHERE token_hash = ? AND used_at IS NULL')
      .run(now, row.token_hash));
    if (spent.changes !== 1) throw new Error('that link has already been used');
    ((await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(newPassword), row.user_id)));
    ((await db.prepare('DELETE FROM sessions WHERE user_id = ?').run(row.user_id)));
    db.exec('COMMIT');
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch { /* the outer error is the interesting one */ }
    throw err;
  }
  return row.user_id;
}

export async function purgeExpiredResets() {
  return (await (await getDb()).prepare('DELETE FROM password_resets WHERE expires_at <= ?').run(nowSeconds())).changes;
}
