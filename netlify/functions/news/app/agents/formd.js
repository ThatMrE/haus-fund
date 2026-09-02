import { fetchText, tidy, secondsFrom } from './util.js';
import { parseFeed } from '../feed-parser.js';

/**
 * Form D filings — the paperwork a company files after a raise.
 *
 * This is the earliest public signal that money moved, often weeks before the
 * announcement, which is exactly the window this feed is for. EDGAR publishes
 * recent filings of a given type as Atom, so the existing feed parser handles
 * the response.
 */
const CURRENT =
  'https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=D&company=&dateb=&owner=include&count=100&output=atom';

/**
 * EDGAR is filed under SIC codes, but the "recent filings" feed does not carry
 * them, so the company name is the filter. These are the words a biotech puts
 * in its name; anything else is a real-estate fund or a rolled-up LLC.
 */
const BIO_NAME = new RegExp(
  [
    'bio', 'genom', 'genet', 'thera', 'pharma', 'medicin', 'medical', 'health',
    'diagnost', 'onco', 'immun', 'neuro', 'cell', 'protein', 'peptide', 'rna',
    'crispr', 'vaccin', 'microb', 'enzym', 'labs?\\b', 'sciences?\\b', 'clinic',
    'surg', 'device', 'molecul', 'antibod', 'stem', 'regen', 'longev',
  ].join('|'),
  'i',
);

export default {
  key: 'form-d',
  label: 'Form D filings',
  about: 'New Form D filings from companies whose names read as life sciences — the first public sign of a raise.',
  selfEvident: true,
  weight: 1.4,

  async fetch({ fetchImpl, now, lookbackHours = 48 } = {}) {
    const xml = await fetchText(CURRENT, { fetchImpl });
    const cutoff = now - lookbackHours * 3600;

    return parseFeed(xml)
      .map((entry) => {
        // EDGAR titles read "D - COMPANY NAME (0001234567) (Filer)".
        const name = tidy(
          String(entry.title ?? '')
            .replace(/^\s*D(?:\/A)?\s*-\s*/i, '')
            .replace(/\s*\(\d{7,}\)\s*\(Filer\)\s*$/i, '')
            .replace(/\s*\(Filer\)\s*$/i, ''),
          90,
        );
        return { ...entry, company: name };
      })
      .filter((entry) => entry.company && BIO_NAME.test(entry.company))
      .filter((entry) => !entry.publishedAt || entry.publishedAt >= cutoff)
      .map((entry) => ({
        title: `${entry.company} filed a Form D`,
        link: entry.link,
        summary: tidy(entry.summary ?? '', 300),
        publishedAt: secondsFrom(entry.publishedAt) ?? now,
        topicHint: 'funding',
        note: 'New Form D on EDGAR',
      }));
  },
};
