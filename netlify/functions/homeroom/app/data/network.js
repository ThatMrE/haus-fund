/**
 * Real people from the Haus network, drawn from Elliot's calendar.
 *
 * Kept in its own file rather than mixed into `mentors.js` so the provenance
 * line stays unambiguous: everything in `mentors.js` is invented sample data,
 * and everything here is a real person. Rows here carry `source: 'calendar'`,
 * which the mentor page renders as a visible caveat.
 *
 * THREE RULES THIS FILE FOLLOWS, AND WHY
 *
 * 1. **Nobody here is `vetted`.** Vetted means a steward has met them *and they
 *    have agreed to take bookings*. Appearing in a calendar is evidence of the
 *    first and none of the second. Marking them vetted would put a "book this
 *    person" button in front of members for people who never opted in.
 *
 * 2. **No scheduling links, no emails, no phone numbers.** The contact details
 *    are in the calendar; they do not belong in a git repository. The profile
 *    page falls back to an intro request through a steward, which is the right
 *    path for someone who has not confirmed anything.
 *
 * 3. **`role` is a job title only where it was verified from a public source**
 *    — noted per row. Everywhere else it describes what the person can help
 *    with, because a directory that states a wrong job title about a real
 *    person is a real error, not a formatting one.
 *
 * WHO IS NOT HERE. The calendar's other external contacts are inbound bookings
 * on Elliot's own office hours — founders who booked time *with* him, not
 * people offering time to the network. Several run substantial companies and
 * would make good peer mentors, but that is a decision for them and for a
 * steward, not an inference from a calendar invite. They are listed in the PR
 * discussion rather than added here.
 */

/* [name, role, org, track, tags, location, note] */
const ROWS = [
  ['Manish Chamoli',
    'Co-managing partner & Chief Scientific Officer',   // verified: longgame.vc/about
    'LongGame VC',
    'fundraising',
    ['longevity', 'pre-seed', 'scientific-diligence', 'aging-biology'],
    'United States',
    'Longevity-focused pre-seed and seed fund. Fifteen years of aging biology, previously at the Buck Institute — the person to take a scientific-merit argument to before an investor does.'],

  ['Meow-Ludo Meow-Meow',
    'Co-founder',                                        // verified: BioFoundry, widely reported
    'BioFoundry',
    'brand',
    ['community-labs', 'diybio', 'open-science', 'lab-buildout'],
    'Sydney, AU',
    'Founded Australia’s first open-access molecular biology lab in 2014. Ask about standing up a community lab and about the regulatory conversation that comes with it. BioFoundry is in the Biolab Atlas.'],

  ['PJ LaBarbera',
    'Startup banking',                                   // help offered, not a verified title
    'Rho',
    'ops',
    ['banking', 'spend-management', 'runway', 'finance-ops'],
    'United States',
    'Haus banking contact at Rho. Accounts, cards and spend controls for a company that has just incorporated.'],

  ['Jamie Rodota',
    'Accelerator programmes',                            // help offered, not a verified title
    'Parallel18',
    'commercialization',
    ['accelerators', 'program-design', 'latam', 'market-entry'],
    'San Juan, PR',
    'Parallel18 runs one of the larger accelerator programmes outside the mainland US. Ask about programme selection, and about entering the Latin American market.'],

  ['Joaquin Ortiz',
    'Molecular interaction models',                      // from the meeting record
    'LUCAI',
    'technical',
    ['ml-for-bio', 'molecular-modelling', 'cosmetics', 'pharma-applications'],
    'Remote',
    'Builds molecular interaction models and applies them in cosmetics and pharma. Ask about where a computational model actually earns its place in a wet-lab programme.'],
];

export const NETWORK_MENTORS = ROWS.map(([name, role, org, track, tags, location, bio]) => ({
  name, role, org, track, tags, location, bio,
  format: 'one-on-one',
  vetted: false,
  scheduler: '',
  source: 'calendar',
}));
