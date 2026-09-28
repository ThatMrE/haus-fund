/**
 * Feeds the wires agent reads each morning.
 *
 * The list is deliberately editable: add a source here and the next run picks
 * it up, creating its posting account on first use. `weight` nudges the
 * relevance score — outlets that cover early-stage financing closely start
 * slightly ahead of general science press.
 *
 * The URLs are the publishers' advertised feed endpoints. They are fetched at
 * runtime and were not reachable from the build sandbox, so treat a source that
 * logs "no entries" as one to verify rather than a bug in the parser — the run
 * skips a failing feed and carries on with the rest.
 */

export const SOURCES = [
  {
    slug: 'labiotech',
    name: 'Labiotech',
    url: 'https://www.labiotech.eu/feed/',
    site: 'labiotech.eu',
    weight: 1.1,
  },
  {
    slug: 'crunchbase-news',
    name: 'Crunchbase News',
    url: 'https://news.crunchbase.com/feed/',
    site: 'news.crunchbase.com',
    weight: 1.0,
  },
  {
    slug: 'techcrunch-biotech',
    name: 'TechCrunch — Biotech',
    url: 'https://techcrunch.com/tag/biotech/feed/',
    site: 'techcrunch.com',
    weight: 1.05,
  },
  {
    slug: 'stat-news',
    name: 'STAT',
    url: 'https://www.statnews.com/feed/',
    site: 'statnews.com',
    weight: 0.95,
  },
  {
    slug: 'nature-biotech',
    name: 'Nature Biotechnology',
    url: 'https://www.nature.com/nbt.rss',
    site: 'nature.com',
    weight: 1.05,
  },
  {
    slug: 'medcity',
    name: 'MedCity News',
    url: 'https://medcitynews.com/feed/',
    site: 'medcitynews.com',
    weight: 1.15,
  },
  {
    slug: 'biopharmadive',
    name: 'BioPharma Dive',
    url: 'https://www.biopharmadive.com/feeds/news/',
    site: 'biopharmadive.com',
    weight: 1.1,
  },
  {
    slug: 'genengnews',
    name: 'Genetic Engineering News',
    url: 'https://www.genengnews.com/feed/',
    site: 'genengnews.com',
    weight: 1.0,
  },
];

/** The account an ingested story is posted under. */
export function botHandle(source) {
  return `feed-${source.slug}`.slice(0, 20);
}

/** Profile copy for that account. Plain, factual, no marketing voice. */
export function botAbout(source) {
  return [
    `Automated feed agent for ${source.name} (${source.site}).`,
    'Posts early-stage biotech items each morning for haus.fund/news.',
    'Machine-selected — read the source before you act on it.',
  ].join(' ');
}
