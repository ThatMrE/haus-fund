import { randomBytes, scryptSync, timingSafeEqual, createHmac } from 'node:crypto';
import { getDb } from './db/index.js';
import { nowSeconds } from './util.js';

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, keylen: 64 };
export const SESSION_COOKIE = 'haus_news_session';
export const SESSION_TTL = 60 * 60 * 24 * 30; // 30 days

/** Server secret used to derive CSRF tokens from session tokens. */
const SECRET = process.env.BIOPUNK_SECRET || randomBytes(32).toString('hex');

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
  await getDb().run(
    'INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
    token,
    userId,
    now,
    now + SESSION_TTL,
  );
  return token;
}

export async function getSessionUser(token) {
  if (!token) return null;
  const row = await getDb().get(
    `SELECT u.* FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND s.expires_at > ?`,
    token,
    nowSeconds(),
  );
  if (!row || row.banned) return null;
  return row;
}

export async function destroySession(token) {
  if (!token) return;
  await getDb().run('DELETE FROM sessions WHERE token = ?', token);
}

export async function purgeExpiredSessions() {
  const info = await getDb().run('DELETE FROM sessions WHERE expires_at <= ?', nowSeconds());
  return info.changes;
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

export function validateUsername(id) {
  if (!id || !USERNAME_RE.test(id)) {
    return 'Handles are 2-20 characters: letters, numbers, dashes and underscores.';
  }
  if (/^\d+$/.test(id)) return 'Handles cannot be only digits.';
  return null;
}

export function validatePassword(password) {
  if (!password || password.length < 8) return 'Passphrase must be at least 8 characters.';
  if (password.length > 200) return 'Passphrase must be under 200 characters.';
  return null;
}
