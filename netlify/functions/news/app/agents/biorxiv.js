import { fetchJson, isoDate, secondsFrom, tidy } from './util.js';

/**
 * bioRxiv (and medRxiv) preprints.
 *
 * The details API returns everything posted in a date window; the interesting
 * part for this feed is the subset in categories a company gets founded out of,
 * which is what `CATEGORIES` filters to.
 */
const API = 'https://api.biorxiv.org/details';

const CATEGORIES = new Set([
  'synthetic biology',
  'bioengineering',
  'bioinformatics',
  'biophysics',
  'cell biology',
  'genetics',
  'genomics',
  'immunology',
  'microbiology',
  'molecular biology',
  'neuroscience',
  'systems biology',
  'cancer biology',
  'developmental biology',
  'pharmacology and toxicology',
]);

const TOPIC_BY_CATEGORY = {
  'synthetic biology': 'synbio',
  bioengineering: 'biomanufacturing',
  bioinformatics: 'bioinformatics',
  genomics: 'bioinformatics',
  genetics: 'crispr',
  neuroscience: 'neuro',
  'cancer biology': 'therapeutics',
  'pharmacology and toxicology': 'therapeutics',
  immunology: 'therapeutics',
};

async function server(name, { fetchImpl, from, to }) {
  const payload = await fetchJson(`${API}/${name}/${from}/${to}/0/json`, { fetchImpl });
  return Array.isArray(payload?.collection) ? payload.collection : [];
}

export default {
  key: 'biorxiv',
  label: 'bioRxiv',
  about: 'Preprints posted to bioRxiv and medRxiv, filtered to the categories companies get founded out of.',
  // A preprint is on-topic by virtue of being on bioRxiv; it will never read as
  // startup news, so the early-stage text filter would throw all of them away.
  selfEvident: true,
  weight: 1.1,

  async fetch({ fetchImpl, now, lookbackHours = 48 } = {}) {
    const from = isoDate(now - lookbackHours * 3600);
    const to = isoDate(now);
    const collections = await Promise.all(
      ['biorxiv', 'medrxiv'].map((name) =>
        server(name, { fetchImpl, from, to }).catch(() => []),
      ),
    );

    const entries = [];
    for (const paper of collections.flat()) {
      const category = String(paper.category ?? '').toLowerCase();
      if (CATEGORIES.size && !CATEGORIES.has(category)) continue;
      const doi = paper.doi;
      if (!doi || !paper.title) continue;
      entries.push({
        title: tidy(paper.title),
        link: `https://www.biorxiv.org/content/${doi}v${paper.version ?? 1}`,
        summary: tidy(paper.abstract ?? '', 400),
        publishedAt: secondsFrom(paper.date),
        topicHint: TOPIC_BY_CATEGORY[category] ?? 'other',
        note: paper.author_corresponding_institution
          ? `Preprint out of ${tidy(paper.author_corresponding_institution, 80)}`
          : 'Preprint',
      });
    }
    return entries;
  },
};
