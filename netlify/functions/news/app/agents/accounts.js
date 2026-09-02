import { fetchJson, tidy, secondsFrom } from './util.js';
import { ACCOUNTS } from '../accounts-list.js';

/**
 * The accounts agent: what the field is posting about right now.
 *
 * Three platforms, because the field is split across them. Bluesky and Mastodon
 * both answer unauthenticated public reads, so they run out of the box. X needs
 * a paid API token; without `X_BEARER_TOKEN` in the environment that platform is
 * skipped rather than failing the run.
 *
 * A post only becomes a feed item if it carries a link. An opinion with nothing
 * to click is a fine post and a bad row on a link aggregator.
 */

const BLUESKY_API = 'https://public.api.bsky.app/xrpc';
const X_API = 'https://api.twitter.com/2';

export default {
  key: 'accounts',
  label: 'Accounts',
  about: 'Bio accounts on Bluesky, Mastodon and X, kept to posts that link somewhere.',
  // Anyone can post anything; the early-stage filter still applies.
  selfEvident: false,
  weight: 0.95,

  async fetch({ fetchImpl, now, lookbackHours = 24, accounts = ACCOUNTS, env = process.env } = {}) {
    const cutoff = now - lookbackHours * 3600;
    const wanted = accounts.filter((a) => a.platform !== 'x' || env.X_BEARER_TOKEN);

    const batches = await Promise.all(
      wanted.map((account) =>
        readAccount(account, { fetchImpl, env }).catch(() => []),
      ),
    );

    return batches
      .flat()
      .filter((post) => post.link && post.text)
      .filter((post) => !post.publishedAt || post.publishedAt >= cutoff)
      .map((post) => ({
        title: tidy(post.text, 130),
        link: post.link,
        summary: tidy(post.text, 400),
        publishedAt: post.publishedAt ?? now,
        note: `via ${post.author}`,
      }));
  },
};

function readAccount(account, ctx) {
  if (account.platform === 'bluesky') return readBluesky(account, ctx);
  if (account.platform === 'mastodon') return readMastodon(account, ctx);
  if (account.platform === 'x') return readX(account, ctx);
  return Promise.resolve([]);
}

/* -------------------------------------------------------------- bluesky */

async function readBluesky(account, { fetchImpl }) {
  const url = `${BLUESKY_API}/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(account.handle)}&limit=20&filter=posts_no_replies`;
  const payload = await fetchJson(url, { fetchImpl });

  return (payload?.feed ?? []).map(({ post }) => {
    const record = post?.record ?? {};
    return {
      author: `@${account.handle}`,
      text: record.text ?? '',
      link: blueskyLink(post) ?? postPermalink(account.handle, post?.uri),
      publishedAt: secondsFrom(record.createdAt),
    };
  });
}

/** Prefer whatever the post is pointing at over the post itself. */
function blueskyLink(post) {
  const embed = post?.embed;
  if (embed?.external?.uri) return embed.external.uri;
  if (embed?.media?.external?.uri) return embed.media.external.uri;
  const facets = post?.record?.facets ?? [];
  for (const facet of facets) {
    for (const feature of facet.features ?? []) {
      if (feature.uri) return feature.uri;
    }
  }
  return null;
}

function postPermalink(handle, uri) {
  const rkey = String(uri ?? '').split('/').pop();
  return rkey ? `https://bsky.app/profile/${handle}/post/${rkey}` : null;
}

/* ------------------------------------------------------------- mastodon */

async function readMastodon(account, { fetchImpl }) {
  const instance = account.instance.replace(/\/+$/, '');
  const lookup = await fetchJson(
    `${instance}/api/v1/accounts/lookup?acct=${encodeURIComponent(account.handle)}`,
    { fetchImpl },
  );
  if (!lookup?.id) return [];

  const statuses = await fetchJson(
    `${instance}/api/v1/accounts/${lookup.id}/statuses?limit=20&exclude_replies=true&exclude_reblogs=true`,
    { fetchImpl },
  );

  return (Array.isArray(statuses) ? statuses : []).map((status) => ({
    author: `@${account.handle}`,
    text: stripHtml(status.content ?? ''),
    link: status.card?.url ?? firstLink(status.content ?? '') ?? status.url,
    publishedAt: secondsFrom(status.created_at),
  }));
}

/* -------------------------------------------------------------------- x */

async function readX(account, { fetchImpl, env }) {
  const query = encodeURIComponent(`from:${account.handle} -is:retweet has:links`);
  const payload = await fetchJson(
    `${X_API}/tweets/search/recent?query=${query}&max_results=20&tweet.fields=created_at,entities`,
    { fetchImpl, headers: { authorization: `Bearer ${env.X_BEARER_TOKEN}` } },
  );

  return (payload?.data ?? []).map((tweet) => ({
    author: `@${account.handle}`,
    text: tweet.text ?? '',
    link:
      tweet.entities?.urls?.find((u) => u.expanded_url && !u.expanded_url.includes('twitter.com'))
        ?.expanded_url ?? `https://x.com/${account.handle}/status/${tweet.id}`,
    publishedAt: secondsFrom(tweet.created_at),
  }));
}

/* ---------------------------------------------------------------- shared */

export function stripHtml(html) {
  return String(html)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function firstLink(html) {
  const match = /href="(https?:\/\/[^"]+)"/i.exec(String(html));
  return match ? match[1] : null;
}
