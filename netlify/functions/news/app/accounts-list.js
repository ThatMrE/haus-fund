/**
 * The accounts the feed watches.
 *
 * The brief calls for around 300. What is here is a starter set, not that list:
 * outbound network was blocked in the sandbox this was built in, so **none of
 * these handles were verified against the live platforms**. Treat a handle that
 * returns nothing as one to correct rather than a bug — `readAccount` swallows a
 * failing account so a bad handle costs the run nothing.
 *
 * To load the real list without editing code, set one of:
 *
 *   NEWS_ACCOUNTS       a JSON array of account objects
 *   NEWS_ACCOUNTS_FILE  a path to a JSON file holding the same
 *
 * Shape:
 *   { platform: 'bluesky',  handle: 'example.com' }
 *   { platform: 'mastodon', handle: 'someone', instance: 'https://fediscience.org' }
 *   { platform: 'x',        handle: 'someone' }        // needs X_BEARER_TOKEN
 */

import { readFileSync } from 'node:fs';

/** Domain handles are Bluesky's own convention, so an org's handle is its site. */
const STARTER = [
  { platform: 'bluesky', handle: 'statnews.com' },
  { platform: 'bluesky', handle: 'endpts.com' },
  { platform: 'bluesky', handle: 'nature.com' },
  { platform: 'bluesky', handle: 'science.org' },
  { platform: 'bluesky', handle: 'biorxiv.org' },
  { platform: 'bluesky', handle: 'arstechnica.com' },
  { platform: 'bluesky', handle: 'technologyreview.com' },
  { platform: 'mastodon', handle: 'arpah', instance: 'https://fediscience.org' },
  { platform: 'mastodon', handle: 'synbio', instance: 'https://mstdn.science' },
  { platform: 'mastodon', handle: 'biology', instance: 'https://fediscience.org' },
];

function fromEnv(env) {
  const raw = env.NEWS_ACCOUNTS;
  if (raw) return parse(raw, 'NEWS_ACCOUNTS');
  const path = env.NEWS_ACCOUNTS_FILE;
  if (!path) return null;
  try {
    return parse(readFileSync(path, 'utf8'), path);
  } catch (err) {
    console.warn(`[accounts] could not read ${path}: ${err.message}`);
    return null;
  }
}

function parse(text, label) {
  try {
    const list = JSON.parse(text);
    if (!Array.isArray(list)) throw new Error('expected a JSON array');
    return list.filter(isValid);
  } catch (err) {
    console.warn(`[accounts] ignoring ${label}: ${err.message}`);
    return null;
  }
}

export function isValid(account) {
  if (!account || typeof account.handle !== 'string' || !account.handle.trim()) return false;
  if (!['bluesky', 'mastodon', 'x'].includes(account.platform)) return false;
  if (account.platform === 'mastodon' && !/^https?:\/\//.test(account.instance ?? '')) return false;
  return true;
}

export function loadAccounts(env = process.env) {
  return fromEnv(env) ?? STARTER;
}

export const ACCOUNTS = loadAccounts();
