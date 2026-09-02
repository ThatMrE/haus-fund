import { fetchText, tidy, secondsFrom } from './util.js';
import { parseFeed } from '../feed-parser.js';

/**
 * ARPA-H announcements: programs, solicitations and awards.
 *
 * A new ARPA-H program is a standing invitation to a company that does not
 * exist yet, so it belongs on an early-stage feed even though it is not a
 * funding round.
 */
const FEEDS = [
  { url: 'https://arpa-h.gov/news-and-events/rss.xml', label: 'ARPA-H news' },
  { url: 'https://arpa-h.gov/research-and-funding/rss.xml', label: 'ARPA-H funding' },
];

export default {
  key: 'arpa-h',
  label: 'ARPA-H',
  about: 'ARPA-H programs, solicitations and awards.',
  selfEvident: true,
  weight: 1.2,

  async fetch({ fetchImpl, now, lookbackHours = 96 } = {}) {
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
        title: tidy(entry.title),
        link: entry.link,
        summary: tidy(entry.summary ?? '', 300),
        publishedAt: secondsFrom(entry.publishedAt) ?? now,
        topicHint: 'funding',
        note: entry.feed,
      }));
  },
};
