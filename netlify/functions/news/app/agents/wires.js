import { fetchText, tidy, secondsFrom } from './util.js';
import { parseFeed } from '../feed-parser.js';
import { SOURCES } from '../sources.js';

/**
 * The trade press. Unlike the other agents this one reads outlets that cover
 * everything in biotech, most of it late-stage, so its output goes through the
 * full early-stage relevance filter.
 */
export default {
  key: 'wires',
  label: 'Wires',
  about: 'Biotech trade press, filtered down to the early-stage company news.',
  selfEvident: false,
  weight: 1,

  async fetch({ fetchImpl, now, lookbackHours = 36, sources = SOURCES } = {}) {
    const cutoff = now - lookbackHours * 3600;
    const batches = await Promise.all(
      sources.map((source) =>
        fetchText(source.url, { fetchImpl })
          .then((xml) => parseFeed(xml).map((entry) => ({ ...entry, source })))
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
        summary: tidy(entry.summary ?? '', 400),
        publishedAt: secondsFrom(entry.publishedAt) ?? now,
        weight: entry.source.weight,
        note: entry.source.name,
      }));
  },
};
