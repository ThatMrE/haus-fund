import { fetchText, tidy, secondsFrom } from './util.js';
import { parseFeed } from '../feed-parser.js';

/**
 * Form D filings — the paperwork a company files after a raise.
 *
 * This is the earliest public signal that money moved, often weeks before the
 * announcement, which is exactly the window this feed is for. EDGAR publishes
 * recent filings of a given type as Atom, so the existing feed parser handles
 * the response.
 *
 * EDGAR's fair-access policy requires a User-Agent that names the requester and
 * carries a contact address; a generic one is refused (it hangs, rather than
 * answering 403). `SEC_CONTACT` supplies it, e.g. "Haus Fund news@haus.fund".
 * Without it this agent stands down rather than hammering a government endpoint
 * with a request it has said it does not accept.
 */
const CURRENT =
  'https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=D&company=&dateb=&owner=include&count=100&output=atom';

/**
 * EDGAR is filed under SIC codes, but the "recent filings" feed does not carry
 * them, so the company name is the filter. These are the words a biotech puts
 * in its name; anything else is a real-estate fund or a rolled-up LLC.
 *
 * Each stem is anchored at a word start. As bare substrings these matched
 * inside unrelated names — "cell" put MONTICELLOAM SENIOR HOUSING DEBT FUND on
 * the board — which is the same trap the relevance rules hit with "ai" inside
 * "raises".
 */
const BIO_NAME = new RegExp(
  '\\b(?:' +
  [
    'bio', 'genom', 'genet', 'thera', 'pharma', 'medicin', 'medical', 'health',
    'diagnost', 'onco', 'immun', 'neuro', 'cell', 'protein', 'peptide', 'rna',
    'crispr', 'vaccin', 'microb', 'enzym', 'labs?\\b', 'sciences?\\b', 'clinic',
    'surg', 'device', 'molecul', 'antibod', 'stem', 'regen', 'longev',
  ].join('|') +
  ')',
  'i',
);

/**
 * Pooled investment vehicles file Form D constantly, and "BIO FUND I a Series of
 * FOG Ventures Fund III LLC" passes any name test built for operating
 * companies. A fund raising its own money is not a startup raise.
 */
const POOLED_VEHICLE = /\b(?:fund|ventures?|capital|partners|holdings|trust|reit|advisors|management)\b/i;

export default {
  key: 'form-d',
  label: 'Form D filings',
  about: 'New Form D filings from companies whose names read as life sciences — the first public sign of a raise.',
  selfEvident: true,
  weight: 1.4,

  async fetch({ fetchImpl, now, lookbackHours = 48, env = process.env } = {}) {
    const contact = String(env.SEC_CONTACT ?? '').trim();
    if (!contact) {
      throw new Error('SEC_CONTACT is not set — EDGAR requires a contact in the User-Agent');
    }

    // EDGAR answers this in roughly twenty seconds on a good day, and slower
    // while the other agents are competing for the same egress. The sweep runs
    // as a scheduled function, which has the budget for it.
    const xml = await fetchText(CURRENT, {
      fetchImpl,
      timeoutMs: 60_000,
      headers: { 'user-agent': contact },
    });
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
      .filter((entry) => !POOLED_VEHICLE.test(entry.company))
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
