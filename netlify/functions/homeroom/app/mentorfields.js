/**
 * Turning a row of mentor data into a mentor.
 *
 * Shared by two callers that must never disagree: `scripts/import-mentors.js`,
 * the one-shot CSV/Airtable importer, and `app/mentorsync.js`, the scheduled
 * pull from the onboarding form's table.
 *
 * It lives here rather than in either of them because of one rule in
 * particular. SCHEDULER below is a HOST ALLOWLIST, and it is the only thing
 * standing between a public form and a "book time" button that goes wherever
 * a stranger typed. Two code paths validating that URL is how one of them
 * stops validating it, six months from now, quietly.
 */

import { MENTOR_TRACKS } from './data/mentors.js';

const TRACK_SLUGS = new Set(MENTOR_TRACKS.map((t) => t.slug));

/**
 * Best-guess a track from free text.
 *
 * The onboarding form offers a fixed list, but the existing Airtable column is
 * free text and a CSV export can hold anything. An unrecognised value lands on
 * `founder`, which is the honest "we do not know" bucket rather than a wrong
 * specific claim.
 */
export function trackFor(value) {
  const text = String(value || '').toLowerCase();
  if (TRACK_SLUGS.has(text)) return text;
  const rules = [
    [/legal|counsel|attorney|patent|\bip\b|licens/, 'legal'],
    [/invest|venture|\bvc\b|fundrais|capital|angel/, 'fundraising'],
    [/customer|commercial|sales|market|business develop|\bbd\b|partnership/, 'commercialization'],
    [/regulat|\bfda\b|quality|clinical|\bgmp\b|\bglp\b|biosafety|compliance/, 'regulatory'],
    [/grant|sbir|sttr|non-?dilutive|nih|nsf/, 'grants'],
    [/manufactur|supply|scale-?up|sourcing|cdmo|\bcmo\b|hardware/, 'manufacturing'],
    [/hiring|recruit|talent|people|\bhr\b/, 'hiring'],
    [/visa|immigration|\bo-?1\b|relocation/, 'immigration'],
    [/brand|media|press|communicat|community|marketing/, 'brand'],
    [/finance|account|\bcfo\b|bookkeep|operations|insurance/, 'ops'],
    [/scien|research|technical|\bphd\b|bio|chem|engineer|comput|\bml\b/, 'technical'],
  ];
  for (const [pattern, slug] of rules) if (pattern.test(text)) return slug;
  return 'founder';
}

/**
 * The scheduler host allowlist.
 *
 * Only links that are actually a booking page. A LinkedIn URL in this column
 * would render a "book time" button that goes to a profile; anything else in
 * it, from a public form, could go somewhere worse. Adding a host here is a
 * code change and therefore a reviewed one, which is the point.
 */
export const SCHEDULER = /^https?:\/\/(cal\.com|calendly\.com|savvycal\.com|lu\.ma|luma\.com|[\w.-]*zcal\.co)/i;

/** Somewhere between a plausible address and a definite one. Cheap and strict. */
const EMAIL = /^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/;

const CONSENT_MODES = new Set(['ask-me', 'auto', 'auto-track']);

export function normalize(row) {
  const get = (...keys) => {
    for (const key of keys) {
      const value = row[key] ?? row[key.toLowerCase()];
      if (value !== undefined && String(value).trim()) return String(value).trim();
    }
    return '';
  };

  const name = get('name', 'full name', 'mentor');
  if (!name) return null;

  const expertise = get('area of expertise', 'expertise', 'focus');
  const scheduler = get('scheduler', 'booking', 'booking link', 'calendly', 'cal.com', 'calendar');
  const email = get('email', 'email address', 'contact').toLowerCase();
  const consent = get('consent mode', 'how should we ask', 'consent').toLowerCase()
    .replace(/\s+/g, '-');
  const capacity = Number(get('capacity', 'sessions per month', 'sessions a month'));

  return {
    name,
    role: get('role', 'title', 'position'),
    org: get('org', 'organisation', 'organization', 'company', 'firm'),
    track: trackFor(get('track') || expertise),
    tags: get('tags', 'topics', 'skills')
      .split(/[,;|]/).map((t) => t.trim().toLowerCase().replace(/\s+/g, '-')).filter(Boolean),
    location: get('location', 'city', 'based'),
    bio: get('bio', 'about', 'summary'),
    format: /group/i.test(get('format')) ? 'group' : 'one-on-one',
    scheduler: SCHEDULER.test(scheduler) ? scheduler : '',
    vetted: /^(1|true|yes|y|vetted)$/i.test(get('vetted', 'approved', 'confirmed')),
    // Below here is what the onboarding form added. Everything has a safe
    // default, because a form field a mentor skipped must not become a claim
    // about what they agreed to.
    email: EMAIL.test(email) ? email : '',
    consentMode: CONSENT_MODES.has(consent) ? consent : 'ask-me',
    capacity: Number.isFinite(capacity) && capacity > 0 ? Math.min(capacity, 30) : 0,
    tracks: get('tracks', 'auto tracks', 'auto-accept tracks')
      .split(/[,;|]/).map((t) => trackFor(t.trim())).filter(Boolean),
    airtableId: get('airtable id', 'record id', '__record_id'),
    source: 'import',
  };
}
