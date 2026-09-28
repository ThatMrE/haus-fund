import { fetchText, tidy, secondsFrom } from './util.js';
import { parseFeed } from '../feed-parser.js';

/**
 * ARPA-H announcements: programs, solicitations and awards.
 *
 * A new ARPA-H program is a standing invitation to a company that does not
 * exist yet, so it belongs on an early-stage feed even though it is not a
 * funding round.
 */
// Verified 2026-09-28. The per-section feeds this used to list (news-and-events,
// research-and-funding) both 404; the site publishes one feed at its root.
const FEEDS = [{ url: 'https://arpa-h.gov/rss.xml', label: 'ARPA-H' }];

export default {
  key: 'arpa-h',
  label: 'ARPA-H',
  about: 'ARPA-H programs, solicitations and awards.',
  selfEvident: true,
  weight: 1.2,
  // Low-volume by nature: ten posts span months, and a new program stays news
  // for weeks rather than days.
  maxAgeHours: 336,

  async fetch({ fetchImpl, now, lookbackHours = 336 } = {}) {
    const cutoff = now - lookbackHours * 3600;
    const batches = await Promise.all(
      FEEDS.map((feed) =>
        fetchText(feed.url, { fetchImpl })
          .then((xml) => parseFeed(xml).map((entry) => ({ ...entry, feed: feed.label })))
          .catch(() => []),
      ),
    );

    return batches
      .flat()
      .filter((entry) => entry.link && entry.title)
      .filter((entry) => !entry.publishedAt || entry.publishedAt >= cutoff)
      .map((entry) => ({
        // The feed titles are bare program names ("COSMOS"), which say nothing
        // on a mixed front page.
        title: `ARPA-H: ${tidy(entry.title, 120)}`,
        link: entry.link,
        summary: tidy(entry.summary ?? '', 300),
        publishedAt: secondsFrom(entry.publishedAt) ?? now,
        topicHint: 'funding',
        note: entry.feed,
      }));
  },
};
