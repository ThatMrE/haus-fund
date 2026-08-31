/**
 * Deciding whether a headline is early-stage biotech startup news.
 *
 * A story qualifies on two axes at once: it has to be about biology or the
 * tools around it, and it has to be about a company at the beginning of its
 * life. Either alone is noise here — a Phase 3 readout is biotech but not
 * early-stage; a fintech seed round is early-stage but not biotech.
 */

/** Life-science subject matter. */
const BIO_TERMS = [
  'biotech', 'biotechnology', 'therapeutic', 'therapy', 'drug', 'pharma',
  'genomic', 'genome', 'gene editing', 'crispr', 'synthetic biology', 'synbio',
  'protein', 'antibody', 'peptide', 'molecule', 'oncology', 'immunology',
  'vaccine', 'diagnostic', 'microbiome', 'cell therapy', 'rna', 'mrna', 'dna',
  'clinical-stage', 'preclinical', 'biologics', 'bioprocess', 'biomanufacturing',
  'life sciences', 'neurotech', 'medtech', 'lab automation', 'organoid',
  'sequencing', 'assay', 'biomarker', 'enzyme', 'fermentation', 'longevity',
];

/** Signals that a company is at the start of its life. */
const STAGE_TERMS = [
  'seed round', 'pre-seed', 'seed funding', 'seed financing',
  'series a', 'series b', 'first close', 'oversubscribed',
  'launches with', 'launched with', 'emerges from stealth', 'out of stealth',
  'spinout', 'spin-out', 'spins out', 'startup', 'start-up', 'newco',
  'founded', 'co-founder', 'incubator', 'accelerator', 'venture studio',
  'raises', 'raised', 'secures', 'closes', 'debuts', 'unveils',
  'new fund', 'backs', 'led the round', 'led by',
];

/** Late-stage or big-company news that does not belong on this page. */
const NEGATIVE_TERMS = [
  'phase 3', 'phase iii', 'fda approval', 'approved by the fda', 'ema approval',
  'ipo', 'files for ipo', 'public offering', 'earnings', 'quarterly results',
  'layoffs', 'restructuring', 'lawsuit', 'patent dispute', 'recall',
  'acquisition completed', 'completes acquisition', 'merger completed',
  'appoints', 'names new chief', 'board of directors', 'obituary',
];

/** Money mentioned at seed/Series A scale is a strong positive signal. */
const EARLY_MONEY_RE = /\$\s?(\d{1,3}(?:\.\d+)?)\s?(m|mm|million)\b/i;
/** Nine figures and up is somebody else's story. */
const LATE_MONEY_RE = /\$\s?(\d{1,3}(?:\.\d+)?)\s?(b|bn|billion)\b/i;

const EARLY_MONEY_CEILING = 60; // $M — above this it is rarely a first round.

/**
 * Terms match on word boundaries, never as bare substrings: "ai" must not fire
 * on "raises", and "rna" must not fire on "internal".
 */
const termCache = new Map();

function termRe(term) {
  let re = termCache.get(term);
  if (!re) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    re = new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, 'i');
    termCache.set(term, re);
  }
  return re;
}

export function hasTerm(haystack, term) {
  return termRe(term).test(haystack);
}

function countHits(haystack, terms) {
  let hits = 0;
  const matched = [];
  for (const term of terms) {
    if (hasTerm(haystack, term)) {
      hits += 1;
      matched.push(term);
    }
  }
  return { hits, matched };
}

/**
 * Score one candidate.
 * @returns {{score: number, keep: boolean, reasons: string[]}}
 */
export function scoreEntry(entry, { weight = 1 } = {}) {
  const haystack = `${entry.title} ${entry.summary || ''}`.toLowerCase();

  const bio = countHits(haystack, BIO_TERMS);
  const stage = countHits(haystack, STAGE_TERMS);
  const negative = countHits(haystack, NEGATIVE_TERMS);

  const reasons = [];
  let score = 0;

  // Subject matter and stage both have to be present; the first hit on each
  // axis carries most of the weight, extras add a little.
  if (bio.hits) {
    score += 2 + Math.min(bio.hits - 1, 3) * 0.4;
    reasons.push(`biotech: ${bio.matched.slice(0, 3).join(', ')}`);
  }
  if (stage.hits) {
    score += 2 + Math.min(stage.hits - 1, 3) * 0.4;
    reasons.push(`early-stage: ${stage.matched.slice(0, 3).join(', ')}`);
  }

  const early = EARLY_MONEY_RE.exec(haystack);
  if (early && Number(early[1]) <= EARLY_MONEY_CEILING) {
    score += 1.2;
    reasons.push(`round size: $${early[1]}M`);
  }
  if (LATE_MONEY_RE.test(haystack)) {
    score -= 2;
    reasons.push('billion-dollar figure');
  }
  if (negative.hits) {
    score -= 1.6 * negative.hits;
    reasons.push(`late-stage signal: ${negative.matched.slice(0, 2).join(', ')}`);
  }

  score *= weight;

  // Both axes required. A story about a Series A in logistics, or a preclinical
  // readout from a listed pharma, is not what this page is for.
  const keep = bio.hits > 0 && stage.hits > 0 && score >= MIN_SCORE;
  return { score: Number(score.toFixed(3)), keep, reasons };
}

export const MIN_SCORE = 4;

/** The channel an item is filed under, from its wording. */
const TOPIC_RULES = [
  ['crispr', ['crispr', 'gene editing', 'base editing', 'prime editing']],
  ['synbio', ['synthetic biology', 'synbio', 'enzyme', 'fermentation', 'strain']],
  ['longevity', ['longevity', 'aging', 'ageing', 'senolytic']],
  ['neuro', ['neuro', 'brain', 'neural', 'organoid intelligence']],
  ['bioinformatics', ['ai', 'machine learning', 'model', 'software', 'computational', 'algorithm']],
  ['diybio', ['community lab', 'diybio', 'biohacker']],
  ['biosecurity', ['biosecurity', 'biosafety', 'policy', 'regulation', 'screening']],
  ['biomanufacturing', ['manufacturing', 'bioprocess', 'cdmo', 'scale-up', 'plant']],
  ['therapeutics', ['therapeutic', 'therapy', 'drug', 'clinical', 'patient', 'oncology', 'vaccine']],
  ['hardware', ['instrument', 'device', 'robot', 'automation', 'sequencer', 'microscope']],
  ['funding', ['seed', 'series a', 'series b', 'raises', 'raised', 'fund', 'venture']],
];

export function guessTopic(entry) {
  const haystack = `${entry.title} ${entry.summary || ''}`.toLowerCase();
  for (const [topic, terms] of TOPIC_RULES) {
    if (terms.some((term) => hasTerm(haystack, term))) return topic;
  }
  return 'other';
}
