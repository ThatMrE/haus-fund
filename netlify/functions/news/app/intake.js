/**
 * Channel intake.
 *
 * The Discord is one of the places things get surfaced, and asking someone to
 * stop, open the site and paste a link again is how you lose the link. A bot
 * posts here instead, and the item enters the same review queue as anything
 * else — a channel is a shortcut for people, not a way around review.
 *
 * Authenticated with a shared token rather than a session: the caller is a bot,
 * not a browser.
 */
import { timingSafeEqual } from 'node:crypto';
import * as db from './models.js';
import { hashPassword } from './auth.js';
import { normalizeUrl } from './util.js';
import { randomBytes } from 'node:crypto';

export const MAX_TITLE = 120;

/** Constant-time token check, so a wrong token leaks nothing by timing. */
export function tokenOk(supplied, expected) {
  if (!expected) return false;
  const a = Buffer.from(String(supplied ?? ''));
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function bearer(header) {
  const match = /^Bearer\s+(.+)$/i.exec(String(header ?? '').trim());
  return match ? match[1] : null;
}

/** The account a channel posts under when the person is not known here. */
export async function channelAccount(channel) {
  const id = `channel-${String(channel).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`.slice(0, 20);
  const existing = await db.getUser(id);
  if (existing) return existing;
  const user = await db.createUser({
    id,
    passwordHash: hashPassword(randomBytes(24).toString('hex')),
    role: 'channel',
  });
  await db.updateUser(id, { about: `Links surfaced in ${channel} and relayed here for review.` });
  return user;
}

/**
 * Take one link from a channel.
 * @returns {Promise<{ok: boolean, id?: number, state?: string, error?: string}>}
 */
export async function surface({ url, title, handle = null, channel = 'Discord', topic = null }) {
  const normalized = normalizeUrl(url);
  if (!normalized) return { ok: false, error: 'a valid http(s) url is required' };

  const cleanTitle = String(title ?? '').trim().slice(0, MAX_TITLE);
  if (cleanTitle.length < 6) return { ok: false, error: 'a title of at least 6 characters is required' };

  const existing = await db.findByUrl(normalized);
  if (existing) return { ok: true, id: existing.id, state: 'duplicate' };

  // Credit the person if their handle is one here; otherwise the channel
  // carries the credit and a moderator can reassign it.
  const surfacedBy = handle ? await db.getUser(handle) : null;
  const account = await channelAccount(channel);

  const id = await db.createStory({
    by: account.id,
    title: cleanTitle,
    url: normalized,
    topic: db.normalizeTopic(topic),
    kind: 'link',
    source: 'human',
    surfacedBy: surfacedBy?.id ?? null,
    channel,
    reviewState: 'pending',
  });

  return { ok: true, id, state: 'pending' };
}
