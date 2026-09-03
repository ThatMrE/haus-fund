/**
 * The Biopunk Accelerator Skill Tree — the graph layer.
 *
 * WHAT THIS FILE IS NOT. It is not a second copy of the curriculum. The tracks,
 * modules, summaries, outcomes, deliverables and the S26 sequence all come from
 * `netlify/functions/homeroom/app/data/curriculum.js` — the Founder Manual that
 * Homeroom already serves at /homeroom/library. `build_tree.mjs` imports that
 * file directly, so a wording change there reaches the tree on the next build
 * and cannot drift.
 *
 * WHAT THIS FILE IS. Everything the manual does not carry because a reading
 * list does not need it and a skill tree does:
 *
 *   TRACK_ORDER   the column order on the map
 *   TRACK_ROWS    the row order inside a column, which is also teaching order
 *   EXTRA_TRACK   the program spine, which is a tier rather than a track
 *   EXTRA_MODULES eight nodes the manual does not have — see below
 *   DEPENDENCIES  builds-on edges. Guidance, never gates. Nothing locks.
 *   MAIN_PATH     the 90-day calendar spine the map emphasises
 *   VIDEOS        one verified video per node, or none at all
 *   RESOURCES     3-5 authority links per node
 *
 * THE EIGHT ADDED NODES, and why each earns its place. The manual is the menu
 * of live sessions; these are the things a biotech founder is nevertheless
 * expected to know, drawn from the programmes the manual itself converged
 * (YC, Antler, HAX, IndieBio, Third Derivative) plus the standard translational
 * curricula — MIT's Disciplined Entrepreneurship, NSF/NIH I-Corps, and the
 * FDA/NIH pathway material:
 *
 *   orientation             a root. Where the tree starts and how to read it.
 *   primary-market-research the TAM/persona/end-user machinery between "pick a
 *                           beachhead" and "go interview people". Disciplined
 *                           Entrepreneurship steps 1-6; I-Corps' business model
 *                           canvas front half.
 *   target-product-profile  the TPP. The one document that makes a regulatory
 *                           strategy possible, and the artefact both FDA and
 *                           payers read backwards from. Absent from the manual.
 *   ind-and-clinical-path   the manual's regulatory module leans device and
 *                           diagnostic. Therapeutics teams need preclinical →
 *                           IND → phases as its own node.
 *   reimbursement-and-access named explicitly in the I-Corps@NIH curriculum as
 *                           the life-science-specific addition to Lean, and the
 *                           reason a technically superior product still fails.
 *   ai-founder-stack        Workshop 8 of the delivered S26 calendar, which the
 *                           library taxonomy never absorbed. Restored here.
 *   immigration-and-o1      the S26 flex session, and the reason haus.fund runs
 *                           a Visa Desk at all.
 *   showcase-capstone       a terminal node. The programme ends in an artefact.
 *
 * VIDEO POLICY. A node gets a video only when there is a specific, checkable
 * one from a source worth citing — Y Combinator, Stanford eCorner, MIT, NIH,
 * FDA-facing regulatory practitioners, bio investor panels, SOSV/IndieBio,
 * Nucleate, Strategyzer. Where no such video exists the field stays empty
 * rather than carrying something unvetted; those nodes lean on their reading
 * instead. `validate.mjs` enforces the URL shape and rejects a reused id.
 *
 * WHAT "VERIFIED" MEANS HERE, EXACTLY. Every id below was checked by searching
 * its title and confirming the id that came back matches — so no id is invented
 * or mistyped, and each resolves to the video its title claims. That pass found
 * and fixed four wrong labels: a pre-submission talk attributed to a summit
 * panel it was not from, two paraphrased titles, and an investor panel credited
 * to one of its three firms.
 *
 * It is NOT proof of playback. YouTube is unreachable from the environment this
 * is maintained in, so nobody has pressed play. Deletion, an embed being
 * disabled, and region locks would all pass the check above and still leave a
 * dead poster in the drawer. If you can reach YouTube, that is the one check
 * worth doing by hand — and the failure mode is contained: a dead video is one
 * `VIDEOS` entry plus a rebuild, and the node still has its reading.
 */

/* Column order on the map. The manual's own track order, left to right. */
export const TRACK_ORDER = [
  'program',
  'founder-fundamentals',
  'customers-and-commercialization',
  'fundraising-and-capital',
  'legal-ip-and-regulatory',
  'team-and-operations',
  'brand-network-and-life',
];

/* The programme spine is a tier, not one of the manual's six tracks. */
export const EXTRA_TRACK = {
  slug: 'program',
  title: 'The programme spine',
  focus: 'Where the ninety days start and what they end in',
  blurb: 'Two nodes: the orientation that opens the tree and the showcase that closes it. Everything else hangs between them.',
};

/*
 * Row order inside each column. This is teaching order, and it is also the
 * order the list view and the track rails use. A `null` is a spacer: it holds
 * a row empty on the map so a node lands where it belongs visually — the
 * showcase sits at the foot of the spine, not directly under orientation.
 */
export const TRACK_ROWS = {
  program: ['orientation', null, null, null, null, null, null, null, 'showcase-capstone'],
  'founder-fundamentals': [
    'risk-mapping',
    'beachhead-market-memo',
    'founder-scorecard',
    'decision-making',
    'study-the-greats',
    'capital-efficiency',
    'prioritization-map',
    'founder-wellbeing',
  ],
  'customers-and-commercialization': [
    'primary-market-research',
    'customer-discovery',
    'design-partner-pipeline',
    'founder-led-sales',
    'technoeconomics',
    'business-model',
    'category-design',
    'strategic-partnerships',
  ],
  'fundraising-and-capital': [
    'raising-on-an-idea',
    'venture-math',
    'grants-and-nondilutive',
    'investor-psychology',
    'fundraising-narrative',
    'diligence-room',
  ],
  'legal-ip-and-regulatory': [
    'company-formation',
    'ip-and-spinouts',
    'safes-and-mtas',
    'target-product-profile',
    'regulatory-strategy',
    'ind-and-clinical-path',
    'reimbursement-and-access',
    'biosafety-and-compliance',
    'hiring-and-governance',
  ],
  'team-and-operations': [
    'cofounders',
    'first-hires',
    'lab-operations',
    'operating-cadence',
    'ai-founder-stack',
    'manufacturing-scaleup',
    'founder-resources',
  ],
  'brand-network-and-life': [
    'credibility-stack',
    'scientific-communication',
    'relationship-systems',
    'community-building',
    'press-and-media',
    'immigration-and-o1',
    'demo-day',
  ],
};

/*
 * The eight added nodes, in the manual's own module shape so they merge with
 * LIBRARY_MODULES without a special case:
 *   { track, slug, title, kind, minutes, week, deliverable, summary,
 *     outcomes[], work[] }
 */
export const EXTRA_MODULES = [
  {
    track: 'program',
    slug: 'orientation',
    title: 'Orientation: how to read this tree',
    kind: 'playbook',
    minutes: 20,
    week: 1,
    deliverable: 'Your first three nodes',
    summary:
      'Forty-seven nodes across six tracks and a spine. Nothing here locks: the dependencies are guidance about what a node reads better after, never a gate. Week one is for picking the three you will actually finish.',
    outcomes: [
      'Read a node as a piece of work with an artefact at the end, not as a page to open',
      'Tell the twelve live-workshop nodes from the async ones and plan around both',
      'Pick the three nodes that retire your largest risk this month',
    ],
    work: [
      'Walk the spine first — orientation, risk map, beachhead, formation, first raise, customers — and read only the summaries.',
      'Mark every node whose deliverable you already have. Most founders have two or three.',
      'Pick three to finish in the first fortnight. Write them where your cohort can see them.',
      'Log each one in Homeroom as you go, so the deliverable and the note live with the module.',
    ],
  },
  {
    track: 'customers-and-commercialization',
    slug: 'primary-market-research',
    title: 'Primary market research, personas and market sizing',
    kind: 'playbook',
    minutes: 75,
    week: 0,
    deliverable: 'End User Profile and TAM',
    summary:
      'Between choosing a beachhead and interviewing anyone sits the machinery that makes both defensible: who the end user actually is, how many of them exist, and what a bottom-up market size looks like when it is not a slide. MIT teaches this as the first six of the twenty-four steps; I-Corps teaches it as the front half of the canvas.',
    outcomes: [
      'Segment a market from primary evidence rather than from an analyst report',
      'Write an end-user profile specific enough that you could recognise the person in a room',
      'Build a bottom-up TAM you can defend line by line, and say why top-down is not one',
      'Separate the end user, the economic buyer and the champion, who are usually three people',
    ],
    work: [
      'List six to twelve candidate segments. For each: who uses it, who pays, what breaks today.',
      'Score them on reachability, urgency, and whether you can serve them with what you have.',
      'Write one persona from a real named person you have actually spoken to.',
      'Build the TAM bottom-up: number of end users × annual spend. Show the arithmetic.',
    ],
  },
  {
    track: 'legal-ip-and-regulatory',
    slug: 'target-product-profile',
    title: 'The target product profile',
    kind: 'playbook',
    minutes: 75,
    week: 0,
    deliverable: 'Target Product Profile',
    summary:
      'A TPP states what the product must be to be worth approving, buying and reimbursing — population, dose or use, endpoints, effect size, safety, and the label you intend to earn. It is the document a regulatory strategy is derived from, and the one that tells you which experiment is worth running.',
    outcomes: [
      'Write a TPP with a minimum acceptable and a target column, and defend both',
      'Derive your preclinical and clinical plan from the label you intend to earn',
      'Use the TPP to kill experiments that cannot change what the label would say',
      'Keep it a living document that development and commercial both edit',
    ],
    work: [
      'Write the intended-use statement in one sentence. Everything else follows from it.',
      'Fill the TPP: population, comparator, endpoints, effect size, safety, route, setting.',
      'Add the minimum acceptable column. If minimum acceptable is not commercially viable, stop and say so.',
      'Map each planned experiment to the TPP row it moves. Cut the ones that move none.',
    ],
  },
  {
    track: 'legal-ip-and-regulatory',
    slug: 'ind-and-clinical-path',
    title: 'Preclinical, IND and the clinical path',
    kind: 'reference',
    minutes: 60,
    week: 0,
    deliverable: '',
    summary:
      'The therapeutics counterpart to the regulatory workshop, which leans device and diagnostic. IND-enabling work, the pre-IND meeting, what phase 1 actually costs and how long each gate really takes — because the gates, not the science, set your financing plan.',
    outcomes: [
      'Sequence IND-enabling work — tox, CMC, pharmacology — and know which is on the critical path',
      'Use a pre-IND meeting to get the agency’s view before committing to the package',
      'Read phase 1/2/3 as financing milestones rather than as scientific stages',
      'Estimate the money and the calendar to first-in-human honestly, including CRO and CDMO queues',
    ],
    work: [
      'Write your route to first-in-human as a gantt with the three longest-lead items marked.',
      'Draft the pre-IND briefing questions. Three good questions beat twelve vague ones.',
      'Price the IND-enabling package with a real CRO quote, not a benchmark.',
      'Check the number against what the round you are raising can actually buy.',
    ],
  },
  {
    track: 'legal-ip-and-regulatory',
    slug: 'reimbursement-and-access',
    title: 'Reimbursement, payers and market access',
    kind: 'reference',
    minutes: 45,
    week: 0,
    deliverable: '',
    summary:
      'Approval is permission to sell; reimbursement is permission to be bought. The I-Corps life-science curriculum treats this as a first-class subject for a reason — coding, coverage and payment are decided by people who never read your paper, and the evidence they want is not the evidence the agency wanted.',
    outcomes: [
      'Tell coding, coverage and payment apart, and know which is your blocker',
      'Identify who actually pays in your setting, which is rarely the user',
      'Design a health-economic study alongside the pivotal one rather than after it',
      'Recognise when there is no existing payment mechanism, which is a company-shaping fact',
    ],
    work: [
      'Name the payer. Then name the budget line your product would come out of.',
      'Find whether a code exists. If it does not, price the years it takes to create one.',
      'Write the economic argument in the payer’s units — cost per avoided event, not per test.',
      'Decide what evidence the payer needs and whether the pivotal trial can carry it.',
    ],
  },
  {
    track: 'team-and-operations',
    slug: 'ai-founder-stack',
    title: 'The AI founder stack',
    kind: 'workshop',
    minutes: 90,
    week: 0,
    deliverable: 'Founder Automation Map',
    summary:
      'Workshop 8 of the delivered S26 calendar, restored here. Where a two-person company should spend model tokens instead of headcount — literature triage, protocol drafting, diligence prep, grant boilerplate, customer research synthesis — and where using a model is how you get something confidently wrong.',
    outcomes: [
      'Pick the three tasks in your week worth automating first, by hours rather than novelty',
      'Build a retrieval workflow over your own protocols, papers and notes',
      'Know which outputs need a human check before they leave the building, and enforce it',
      'Keep confidential science, unpublished data and patient information out of the wrong tools',
    ],
    work: [
      'Log a week. Mark every task repetitive, judgment, or bench.',
      'Automate the top three repetitive ones. Measure the hours back next week.',
      'Write the review rule: what never ships without a named human reading it.',
      'Write the data rule: what never goes into a third-party tool, and where that is recorded.',
    ],
  },
  {
    track: 'brand-network-and-life',
    slug: 'immigration-and-o1',
    title: 'Immigration, the O-1 and building from abroad',
    kind: 'reference',
    minutes: 45,
    week: 0,
    deliverable: '',
    summary:
      'The S26 flex session, and the reason this network runs a Visa Desk. For a foreign founder the visa is on the critical path of the company, not beside it — and the evidence an O-1 wants is evidence you can start accumulating in week one.',
    outcomes: [
      'Read the O-1A criteria as a checklist you can deliberately build toward',
      'Know which programme artefacts — showcase, press, judging, mentorship — count as evidence',
      'Plan the petition timeline against your cohort dates and your raise',
      'Understand what a support letter needs to say to be worth requesting',
    ],
    work: [
      'Audit yourself against the O-1A criteria. Name the three you are closest to satisfying.',
      'For each gap, name the artefact this programme could produce and when.',
      'Request letters from mentors and partners while you are in front of them, not afterwards.',
      'Draft the letters through the Visa Desk and take the package to counsel.',
    ],
  },
  {
    track: 'program',
    slug: 'showcase-capstone',
    title: 'The showcase and what you leave with',
    kind: 'workshop',
    minutes: 120,
    week: 12,
    deliverable: 'Showcase Package',
    summary:
      'Not a pitch night — an immersive demonstration of the company, the data and the raise. The capstone is the assembly: everything the other forty-six nodes produced, in one package a stranger can evaluate without you in the room.',
    outcomes: [
      'Assemble the deck, the data room, the demo and the follow-up into one package',
      'Present science to a room that does not share your field and hold it',
      'Convert showcase interest into scheduled meetings inside a week',
      'Leave with the artefacts, not just the memory of the twelve weeks',
    ],
    work: [
      'Assemble the package: narrative, deck, data room, TPP or roadmap, and the ask.',
      'Have someone outside your field evaluate it with you silent in the room.',
      'Rehearse the five questions you least want. Two sentences each.',
      'Write the follow-up email before the showcase. Send it within 48 hours.',
    ],
  },
];

/*
 * Builds-on edges. Guidance about reading order, never a gate: every node is
 * open on day one. `validate.mjs` rejects an unresolved id or a cycle.
 */
export const DEPENDENCIES = {
  orientation: [],

  /* founder fundamentals */
  'risk-mapping': ['orientation'],
  'beachhead-market-memo': ['risk-mapping'],
  'founder-scorecard': ['orientation'],
  'decision-making': ['orientation'],
  'study-the-greats': ['orientation'],
  'capital-efficiency': ['risk-mapping'],
  'prioritization-map': ['decision-making', 'risk-mapping'],
  'founder-wellbeing': ['orientation'],

  /* customers and commercialisation */
  'primary-market-research': ['beachhead-market-memo'],
  'customer-discovery': ['primary-market-research'],
  'design-partner-pipeline': ['customer-discovery'],
  'founder-led-sales': ['design-partner-pipeline'],
  technoeconomics: ['customer-discovery'],
  'business-model': ['technoeconomics'],
  'category-design': ['beachhead-market-memo'],
  'strategic-partnerships': ['business-model'],

  /* fundraising and capital */
  'raising-on-an-idea': ['risk-mapping', 'company-formation'],
  'venture-math': ['raising-on-an-idea'],
  'grants-and-nondilutive': ['raising-on-an-idea'],
  'investor-psychology': ['venture-math'],
  'fundraising-narrative': ['raising-on-an-idea', 'credibility-stack'],
  'diligence-room': ['company-formation', 'ip-and-spinouts', 'venture-math'],

  /* legal, IP and regulatory */
  'company-formation': ['orientation'],
  'ip-and-spinouts': ['company-formation'],
  'safes-and-mtas': ['company-formation'],
  'target-product-profile': ['risk-mapping', 'beachhead-market-memo'],
  'regulatory-strategy': ['target-product-profile'],
  'ind-and-clinical-path': ['regulatory-strategy'],
  'reimbursement-and-access': ['regulatory-strategy', 'technoeconomics'],
  'biosafety-and-compliance': ['company-formation'],
  'hiring-and-governance': ['company-formation', 'first-hires'],

  /* team and operations */
  cofounders: ['company-formation'],
  'first-hires': ['company-formation'],
  'lab-operations': ['biosafety-and-compliance'],
  'operating-cadence': ['founder-scorecard'],
  'ai-founder-stack': ['operating-cadence'],
  'manufacturing-scaleup': ['technoeconomics', 'lab-operations'],
  'founder-resources': ['orientation'],

  /* brand, network and founder life */
  'credibility-stack': ['risk-mapping'],
  'scientific-communication': ['credibility-stack'],
  'relationship-systems': ['orientation'],
  'community-building': ['relationship-systems'],
  'press-and-media': ['scientific-communication'],
  'immigration-and-o1': ['company-formation'],
  'demo-day': ['fundraising-narrative', 'scientific-communication'],

  'showcase-capstone': ['demo-day', 'diligence-room', 'customer-discovery'],
};

/*
 * The spine the map emphasises: the 90-day calendar in the order it is
 * actually delivered, orientation through showcase.
 */
export const MAIN_PATH = [
  'orientation',
  'risk-mapping',
  'beachhead-market-memo',
  'company-formation',
  'raising-on-an-idea',
  'customer-discovery',
  'ip-and-spinouts',
  'grants-and-nondilutive',
  'manufacturing-scaleup',
  'regulatory-strategy',
  'prioritization-map',
  'fundraising-narrative',
  'diligence-room',
  'scientific-communication',
  'hiring-and-governance',
  'demo-day',
  'showcase-capstone',
];

/*
 * One video per node, or none. Every entry is a real, located video from a
 * source worth naming; nodes with no such video are deliberately absent rather
 * than filled with something unvetted.
 */
export const VIDEOS = {
  orientation: {
    url: 'https://www.youtube.com/watch?v=bzxPVr9H8Kc',
    title: 'Everything We Teach at YC in 10 Minutes',
    source: 'Y Combinator',
  },
  'risk-mapping': {
    url: 'https://www.youtube.com/watch?v=S4nCY0H4598',
    title: 'The Principles of Lean — hypotheses, and testing them before you build',
    source: 'Steve Blank',
  },
  'beachhead-market-memo': {
    url: 'https://www.youtube.com/watch?v=FqmCN5Tt0Jo',
    title: 'Introduction to Disciplined Entrepreneurship',
    source: 'Bill Aulet, MIT',
  },
  'primary-market-research': {
    url: 'https://www.youtube.com/watch?v=GtWexnfPhKk',
    title: 'Disciplined Entrepreneurship — market segmentation to end-user profile',
    source: 'Bill Aulet, MIT',
  },
  'decision-making': {
    url: 'https://www.youtube.com/watch?v=D56QeyyQMLI',
    title: 'The Biggest Mistakes First-Time Founders Make',
    source: 'Michael Seibel, Y Combinator',
  },
  'prioritization-map': {
    url: 'https://www.youtube.com/watch?v=ZoKLofsp8u0',
    title: 'Lessons from working with 600+ YC startups',
    source: 'Gustaf Alströmer, Y Combinator',
  },
  'study-the-greats': {
    url: 'https://www.youtube.com/watch?v=beNfIxRSrFA',
    title: 'George Church on building biotech companies',
    source: 'Nucleate Virtual Summit',
  },
  'capital-efficiency': {
    url: 'https://www.youtube.com/watch?v=LBC16jhiwak',
    title: 'Managing Startup Finances',
    source: 'Kirsty Nathoo, Y Combinator',
  },
  'customer-discovery': {
    url: 'https://www.youtube.com/watch?v=z1iF1c8w5Lg',
    title: 'How To Talk To Users',
    source: 'Gustaf Alströmer, Y Combinator Startup School',
  },
  'design-partner-pipeline': {
    url: 'https://www.youtube.com/watch?v=hyYCn_kAngI',
    title: 'How to Get Your First Customers',
    source: 'Y Combinator Startup School',
  },
  'founder-led-sales': {
    url: 'https://www.youtube.com/watch?v=0fKYVl12VTA',
    title: 'Enterprise Sales',
    source: 'Pete Koomen, Y Combinator Startup School',
  },
  'business-model': {
    url: 'https://www.youtube.com/watch?v=QoAOzMTLP5s',
    title: 'Business Model Canvas Explained',
    source: 'Strategyzer',
  },
  'category-design': {
    url: 'https://www.youtube.com/watch?v=hdjlCLb9Hl8',
    title: 'How to nail your product positioning',
    source: 'April Dunford',
  },
  'raising-on-an-idea': {
    url: 'https://www.youtube.com/watch?v=zBUhQPPS9AY',
    title: 'How Startup Fundraising Works',
    source: 'Y Combinator Startup School',
  },
  'venture-math': {
    url: 'https://www.youtube.com/watch?v=Dk6JNTDec9I',
    title: 'Understanding SAFEs and Priced Equity Rounds',
    source: 'Kirsty Nathoo, Y Combinator',
  },
  'grants-and-nondilutive': {
    url: 'https://www.youtube.com/watch?v=aOC0ADPimE4',
    title: "America's Seed Fund: How to Fund Your Startup with an NIH SBIR Grant",
    source: 'NIH SEED',
  },
  'fundraising-narrative': {
    url: 'https://www.youtube.com/watch?v=17XZGUX_9iM',
    title: 'How to Pitch Your Startup',
    source: 'Kevin Hale, Y Combinator',
  },
  'diligence-room': {
    url: 'https://www.youtube.com/watch?v=3WUPVZ4onPw',
    title: 'How to Build a Data Room',
    source: 'Elizabeth Yin, Hustle Fund',
  },
  'investor-psychology': {
    url: 'https://www.youtube.com/watch?v=PLjxoqZOOl8',
    title: 'PhD to VC — how bio investors actually decide',
    source: 'a16z Bio + Health and 8VC, on BIOS',
  },
  'company-formation': {
    url: 'https://www.youtube.com/watch?v=EHzvmyMJEK4',
    title: 'Legal and Accounting Basics for Startups',
    source: 'Kirsty Nathoo and Carolynn Levy, Stanford CS183B',
  },
  'ip-and-spinouts': {
    url: 'https://www.youtube.com/watch?v=OprU1Z2bJS4',
    title: 'IP Strategies for Deep Tech',
    source: 'IP practitioner panel',
  },
  'safes-and-mtas': {
    url: 'https://www.youtube.com/watch?v=IQ9badFovnk',
    title: 'Material Transfer Agreements: the IP risks that can kill a startup',
    source: 'Technology transfer counsel',
  },
  'target-product-profile': {
    url: 'https://www.youtube.com/watch?v=p9BjiXVbopM',
    title: 'Anatomy of a Target Product Profile',
    source: 'Marta New',
  },
  'regulatory-strategy': {
    url: 'https://www.youtube.com/watch?v=hTJ2d3YH-DQ',
    title: "Navigating the FDA's Medical Device Pre-submission Process",
    source: '2024 Utah Life Sciences Summit panel',
  },
  cofounders: {
    url: 'https://www.youtube.com/watch?v=qhmvwOevsSo',
    title: "The Founder's Dilemmas [Entire Talk]",
    source: 'Noam Wasserman, Stanford eCorner',
  },
  'first-hires': {
    url: 'https://www.youtube.com/watch?v=AZidfpz9KfY',
    title: 'Building an Engineering Team',
    source: 'Ammon Bartram and Harj Taggar, Y Combinator',
  },
  'hiring-and-governance': {
    url: 'https://www.youtube.com/watch?v=CUZ6PKJZvXE',
    title: "Don't Make These Hiring Mistakes",
    source: 'Y Combinator',
  },
  'lab-operations': {
    url: 'https://www.youtube.com/watch?v=Lc8xWm5sarA',
    title: 'Lab Management Tools: Using Electronic Lab Notebooks to Support Data Management & Collaboration',
    source: 'Research data management seminar',
  },
  'credibility-stack': {
    url: 'https://www.youtube.com/watch?v=t1AHFTCj4yo',
    title: 'What VCs Look for When Investing in Bio and Healthcare',
    source: 'Venrock, a16z and Khosla — investor panel',
  },
  'scientific-communication': {
    url: 'https://www.youtube.com/watch?v=tmFwSntejpM',
    title: 'The Art of Communicating Science',
    source: 'Alan Alda, World Science Festival',
  },
  'demo-day': {
    url: 'https://www.youtube.com/watch?v=lw2X3PxKlAY',
    title: 'How to Perfectly Pitch Your Seed Stage Startup',
    source: 'Michael Seibel, Y Combinator',
  },
  'immigration-and-o1': {
    url: 'https://www.youtube.com/watch?v=ybgavFQ32pM',
    title: 'O-1 Visa Q&A with an Immigration Lawyer: Agent Petitions, Criteria, O-1A vs. O-1B',
    source: 'Nicole Gunara, Manifest Law',
  },
  'showcase-capstone': {
    url: 'https://www.youtube.com/watch?v=oElUqWybV-4',
    title: 'IndieBio Demo Day — what a biotech showcase actually looks like',
    source: 'SOSV / IndieBio',
  },
};

/*
 * 3-5 links per node. The rule the tree is curated on: the canonical primary
 * source first — the regulator, the office, the standard-setter — then the best
 * practitioner treatment, then one thing specific to biology. No SEO pages, no
 * summaries of summaries.
 */
export const RESOURCES = {
  orientation: [
    { title: 'YC Startup Library — the whole free curriculum', url: 'https://www.ycombinator.com/library' },
    { title: 'Disciplined Entrepreneurship — the 24 steps, MIT', url: 'https://disciplinedentrepreneurship.com/' },
    { title: 'Steve Blank — tools and reading for founders', url: 'https://steveblank.com/tools-and-blogs-for-entrepreneurs/' },
    { title: 'LifeSciVC — a biotech VC writing in public since 2010', url: 'https://lifescivc.com/' },
  ],
  'risk-mapping': [
    { title: 'Steve Blank — the Lean LaunchPad and hypothesis testing', url: 'https://steveblank.com/category/lean-launchpad/' },
    { title: 'Bruce Booth — what kills early biotechs', url: 'https://lifescivc.com/category/biotech-startup-advice/' },
    { title: 'NCATS — the translational science gaps, named', url: 'https://ncats.nih.gov/about/about-translational-science' },
    { title: 'The Lean Approach: Getting Out of the Building', url: 'https://www.youtube.com/watch?v=lLEebbiYIkI' },
  ],
  'beachhead-market-memo': [
    { title: 'Disciplined Entrepreneurship — beachhead market selection', url: 'https://disciplinedentrepreneurship.com/' },
    { title: 'MIT Martin Trust Center — entrepreneurship resources', url: 'https://entrepreneurship.mit.edu/' },
    { title: 'April Dunford — positioning and market category', url: 'https://www.aprildunford.com/' },
    { title: 'YC — how to get startup ideas', url: 'https://www.ycombinator.com/library/8g-how-to-get-startup-ideas' },
  ],
  'primary-market-research': [
    { title: 'Disciplined Entrepreneurship — steps 1-6, market segmentation to persona', url: 'https://disciplinedentrepreneurship.com/' },
    { title: 'I-Corps at NIH — the customer discovery curriculum', url: 'https://seed.nih.gov/support-training/i-corps-at-nih' },
    { title: 'Strategyzer — the Business Model Canvas', url: 'https://www.strategyzer.com/library/the-business-model-canvas' },
    { title: 'The Mom Test — interviewing without leading the witness', url: 'https://www.momtestbook.com/' },
  ],
  'founder-scorecard': [
    { title: 'YC — essential startup advice', url: 'https://www.ycombinator.com/library/4D-yc-s-essential-startup-advice' },
    { title: 'Paul Graham — do things that don’t scale', url: 'https://www.paulgraham.com/ds.html' },
    { title: 'The module in Homeroom, with the deliverable form', url: '/homeroom/library/module/founder-scorecard' },
  ],
  'decision-making': [
    { title: 'Paul Graham — the essays, on judgement under uncertainty', url: 'https://www.paulgraham.com/articles.html' },
    { title: 'YC — early stage advice', url: 'https://www.ycombinator.com/library/carousel/Early%20Stage%20Advice' },
    { title: 'Kauffman Founders School — free founder curriculum', url: 'https://www.entrepreneurship.org/learning-paths' },
  ],
  'prioritization-map': [
    { title: 'YC — how to prioritise your time as a founder', url: 'https://www.ycombinator.com/library' },
    { title: 'Paul Graham — the top idea in your mind', url: 'https://www.paulgraham.com/top.html' },
    { title: 'Kauffman Founders School — founder judgement and focus', url: 'https://www.entrepreneurship.org/learning-paths' },
  ],
  'study-the-greats': [
    { title: 'LifeSciVC — biotech company formation, case by case', url: 'https://lifescivc.com/category/biotech-startup-advice/' },
    { title: 'Nature Biotechnology — the bioentrepreneur archive', url: 'https://www.nature.com/nbt/' },
    { title: 'SEC EDGAR — read the S-1 of a company you admire', url: 'https://www.sec.gov/edgar/search/' },
    { title: 'Nucleate — the next generation of bio founders', url: 'https://nucleate.org/' },
  ],
  'capital-efficiency': [
    { title: 'Paul Graham — default alive or default dead', url: 'https://www.paulgraham.com/aord.html' },
    { title: 'YC — how much runway should you target', url: 'https://www.ycombinator.com/library' },
    { title: 'Core Facility Finder — use an instrument instead of buying one', url: '/cores' },
  ],
  'founder-wellbeing': [
    { title: 'Kauffman Founders School — founder resilience', url: 'https://www.entrepreneurship.org/learning-paths' },
    { title: 'YC — advice on founder depression and burnout', url: 'https://www.ycombinator.com/library' },
    { title: 'The module in Homeroom, with the deliverable form', url: '/homeroom/library/module/founder-wellbeing' },
  ],
  'customer-discovery': [
    { title: 'I-Corps at NIH — 100+ interviews, and the method behind them', url: 'https://seed.nih.gov/support-training/i-corps-at-nih' },
    { title: 'Steve Blank — customer discovery, start to finish', url: 'https://steveblank.com/category/customer-development/' },
    { title: 'The Mom Test — questions that survive a polite answer', url: 'https://www.momtestbook.com/' },
    { title: 'The Lean Approach: Getting Out of the Building', url: 'https://www.youtube.com/watch?v=lLEebbiYIkI' },
  ],
  'design-partner-pipeline': [
    { title: 'YC — how to work with your first design partners', url: 'https://www.ycombinator.com/library' },
    { title: 'Orrick Tech Studio — pilot, LOI and evaluation agreement forms', url: 'https://www.orrick.com/en/tech-studio/resources/forms' },
    { title: 'Cooley GO — free startup document generators', url: 'https://www.cooleygo.com/documents/' },
  ],
  'founder-led-sales': [
    { title: 'How to Sell — Tyler Bosmeny, YC', url: 'https://www.youtube.com/watch?v=xZi4kTJG-LE' },
    { title: 'YC Startup Library — sales', url: 'https://www.ycombinator.com/library' },
    { title: 'NIH — selling into academic and clinical procurement', url: 'https://seed.nih.gov/' },
  ],
  technoeconomics: [
    { title: 'NREL — techno-economic analysis method and models', url: 'https://www.nrel.gov/analysis/techno-economic.html' },
    { title: 'The Bioprocess TEA Calculator (open tool and paper)', url: 'https://www.biorxiv.org/content/10.1101/2020.10.08.331272v1' },
    { title: 'DOE BETO — TEA in the technology development lifecycle', url: 'https://www.energy.gov/eere/bioenergy/techno-economic-analysis' },
    { title: 'LifeSciVC — cost of goods and the biotech business case', url: 'https://lifescivc.com/' },
  ],
  'business-model': [
    { title: 'Strategyzer — the Business Model Canvas', url: 'https://www.strategyzer.com/library/the-business-model-canvas' },
    { title: 'Strategyzer — the Value Proposition Canvas', url: 'https://www.strategyzer.com/library/the-value-proposition-canvas' },
    { title: 'Nature Biotechnology — platform versus asset company economics', url: 'https://www.nature.com/nbt/' },
  ],
  'category-design': [
    { title: 'April Dunford — Obviously Awesome, on positioning', url: 'https://www.aprildunford.com/' },
    { title: 'Strategyzer — Value Proposition Canvas', url: 'https://www.strategyzer.com/library/the-value-proposition-canvas' },
    { title: 'The Role of Market Category in Differentiation', url: 'https://www.youtube.com/watch?v=sQkSDNcinFE' },
  ],
  'strategic-partnerships': [
    { title: 'Orrick Tech Studio — sponsored research and collaboration forms', url: 'https://www.orrick.com/en/tech-studio/resources/forms' },
    { title: 'NIH — CRADAs and research collaboration agreements', url: 'https://www.techtransfer.nih.gov/policy/crada' },
    { title: 'LifeSciVC — when a pharma partnership is validation, and when it is a holding pattern', url: 'https://lifescivc.com/' },
  ],
  'raising-on-an-idea': [
    { title: 'YC — the SAFE, and the standard it set', url: 'https://www.ycombinator.com/safe' },
    { title: 'Geoff Ralston — fundraising fundamentals', url: 'https://www.youtube.com/watch?v=gcevHkNGrWQ' },
    { title: 'LifeSciVC — pitching a therapeutics startup to VCs', url: 'https://lifescivc.com/category/biotech-financing/' },
  ],
  'venture-math': [
    { title: 'YC — the SAFE documents and user guide', url: 'https://www.ycombinator.com/safe' },
    { title: 'Cooley GO — SAFE generator and dilution modelling', url: 'https://www.cooleygo.com/documents/y-combinator-safe-financing-document-generator/' },
    { title: 'LifeSciVC — biotech fund economics and ownership targets', url: 'https://lifescivc.com/category/biotech-financing/' },
  ],
  'grants-and-nondilutive': [
    { title: 'NIH SEED — small business funding, start here', url: 'https://seed.nih.gov/small-business-funding' },
    { title: 'Understanding SBIR and STTR — the difference that decides eligibility', url: 'https://seed.nih.gov/small-business-funding/small-business-program-basics/understanding-sbir-sttr' },
    { title: 'SBIR.gov — cross-agency solicitations and deadlines', url: 'https://www.sbir.gov/' },
    { title: 'SAM.gov — the registration that quietly eats a month', url: 'https://sam.gov/' },
    { title: 'eRA Commons — register before you have a target', url: 'https://public.era.nih.gov/commons/' },
  ],
  'investor-psychology': [
    { title: 'LifeSciVC — reading a pass, and what a slow no means', url: 'https://lifescivc.com/category/biotech-financing/' },
    { title: 'YC Startup Library — fundraising', url: 'https://www.ycombinator.com/library' },
    { title: 'a16z Bio + Health — what bio investors actually screen for', url: 'https://a16z.com/bio-health/' },
  ],
  'fundraising-narrative': [
    { title: 'YC — the standard 10-slide seed deck', url: 'https://www.ycombinator.com/library/4T-how-to-design-a-better-pitch-deck' },
    { title: 'Sequoia — writing a business plan', url: 'https://www.sequoiacap.com/article/writing-a-business-plan/' },
    { title: 'LifeSciVC — the biotech narrative that survives a sceptic', url: 'https://lifescivc.com/' },
  ],
  'diligence-room': [
    { title: 'Orrick Tech Studio — diligence checklist and startup forms', url: 'https://www.orrick.com/en/tech-studio/resources/forms' },
    { title: 'Cooley GO — the documents an investor will ask for', url: 'https://www.cooleygo.com/documents/' },
    { title: 'YC Startup Library — fundraising readiness', url: 'https://www.ycombinator.com/library' },
  ],
  'company-formation': [
    { title: 'Orrick — the Incorporation Toolkit', url: 'https://www.orrick.com/en/tech-studio/forms/Incorporation-Toolkit' },
    { title: 'Cooley GO — Delaware incorporation package', url: 'https://www.cooleygo.com/documents/incorporation-package-delaware/' },
    { title: 'IRS — the 83(b) election and its 30-day window', url: 'https://www.irs.gov/pub/irs-pdf/f15620.pdf' },
    { title: 'Orrick Startup Forms Library — founder stock, vesting, cap table', url: 'https://www.orrick.com/Total-Access/Tool-Kit/Start-Up-Forms' },
  ],
  'ip-and-spinouts': [
    { title: 'USPTO — provisional application for patent', url: 'https://www.uspto.gov/patents/basics/apply/provisional-application' },
    { title: 'USPTO — patent basics, including what publication costs you', url: 'https://www.uspto.gov/patents/basics' },
    { title: 'NIH Office of Technology Transfer — licensing from a federal lab', url: 'https://www.techtransfer.nih.gov/' },
    { title: 'AUTM — university licensing practice and norms', url: 'https://autm.net/' },
  ],
  'safes-and-mtas': [
    { title: 'YC — the SAFE, line by line', url: 'https://www.ycombinator.com/safe' },
    { title: 'The OpenMTA — a material transfer agreement built for exchange', url: 'https://biobricks.org/openmta/' },
    { title: 'Addgene — how an MTA actually moves material', url: 'https://www.addgene.org/mta/' },
    { title: 'Orrick Tech Studio — NDAs, advisor and consulting agreements', url: 'https://www.orrick.com/en/tech-studio/resources/forms' },
  ],
  'target-product-profile': [
    { title: 'FDA — guidance on target product profiles', url: 'https://www.fda.gov/regulatory-information/search-fda-guidance-documents/target-product-profile-strategic-development-process-tool' },
    { title: 'WHO — target product profiles and how they are written', url: 'https://www.who.int/observatories/global-observatory-on-health-research-and-development/analyses-and-syntheses/target-product-profile/who-target-product-profiles' },
    { title: 'Facilitating the use of the TPP in academic research (systematic review)', url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11288132/' },
  ],
  'regulatory-strategy': [
    { title: 'FDA — the Q-Submission Program, the free early meeting', url: 'https://www.fda.gov/regulatory-information/search-fda-guidance-documents/requests-feedback-and-meetings-medical-device-submissions-q-submission-program' },
    { title: 'FDA — how to determine your device classification and pathway', url: 'https://www.fda.gov/medical-devices/overview-device-regulation/classify-your-medical-device' },
    { title: 'FDA — Device Advice, the whole regulatory reference', url: 'https://www.fda.gov/medical-devices/device-advice-comprehensive-regulatory-assistance' },
    { title: 'CMS — CLIA, if a laboratory test is in scope', url: 'https://www.cms.gov/medicare/quality/clinical-laboratory-improvement-amendments' },
  ],
  'ind-and-clinical-path': [
    { title: 'FDA — the Investigational New Drug application', url: 'https://www.fda.gov/drugs/types-applications/investigational-new-drug-ind-application' },
    { title: 'FDA — pre-IND consultation, before you commit to the package', url: 'https://www.fda.gov/drugs/investigational-new-drug-ind-application/pre-investigational-new-drug-pind-consultation-program' },
    { title: 'FDA — the drug development process, phase by phase', url: 'https://www.fda.gov/patients/learn-about-drug-and-device-approvals/drug-development-process' },
    { title: 'FDA — formal meetings for CBER-regulated products', url: 'https://www.fda.gov/vaccines-blood-biologics/development-approval-process-cber/formal-meetings-and-requests-feedback-cber-regulated-products' },
  ],
  'reimbursement-and-access': [
    { title: 'CMS — coverage, coding and payment for new technology', url: 'https://www.cms.gov/medicare/coverage' },
    { title: 'AMA — CPT codes, and how one comes into existence', url: 'https://www.ama-assn.org/practice-management/cpt' },
    { title: 'CMS — the Medicare Coverage with Evidence Development pathway', url: 'https://www.cms.gov/medicare/coverage/evidence' },
    { title: 'Building payer perspective into development through a dynamic TPP', url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9340272/' },
  ],
  'biosafety-and-compliance': [
    { title: 'CDC/NIH — Biosafety in Microbiological and Biomedical Laboratories (BMBL)', url: 'https://www.cdc.gov/labs/BMBL.html' },
    { title: 'NIH Guidelines for research involving recombinant or synthetic nucleic acids', url: 'https://osp.od.nih.gov/policies/biosafety-and-biosecurity-policy' },
    { title: 'BIS — export control on biological materials and equipment', url: 'https://www.bis.doc.gov/' },
    { title: 'The Common Mechanism — DNA synthesis screening', url: 'https://ibbis.bio/common-mechanism/' },
  ],
  'hiring-and-governance': [
    { title: 'Orrick Tech Studio — employment, advisor and equity forms', url: 'https://www.orrick.com/en/tech-studio/resources/forms' },
    { title: 'IRS — employee or independent contractor, the actual test', url: 'https://www.irs.gov/businesses/small-businesses-self-employed/independent-contractor-self-employed-or-employee' },
    { title: 'Cooley GO — board, governance and option plan documents', url: 'https://www.cooleygo.com/documents/' },
  ],
  cofounders: [
    { title: 'Noam Wasserman — The Founder’s Dilemmas', url: 'https://www.founders-dilemmas.com/' },
    { title: 'Orrick — founder stock purchase and vesting forms', url: 'https://www.orrick.com/Total-Access/Tool-Kit/Start-Up-Forms/Founders-Stock-Purchase' },
    { title: 'YC — the cofounder relationship, and how it breaks', url: 'https://www.ycombinator.com/library' },
  ],
  'first-hires': [
    { title: 'YC Startup Library — hiring', url: 'https://www.ycombinator.com/library' },
    { title: 'Orrick Tech Studio — offer letters and employment agreements', url: 'https://www.orrick.com/en/tech-studio/resources/forms' },
    { title: 'Haus careers — how this network writes a role as an outcome', url: '/careers' },
  ],
  'lab-operations': [
    { title: 'Ten simple rules for implementing electronic lab notebooks', url: 'https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1008995' },
    { title: 'protocols.io — write a protocol someone else can run', url: 'https://www.protocols.io/' },
    { title: 'FAIR data principles — findable, accessible, interoperable, reusable', url: 'https://www.go-fair.org/fair-principles/' },
    { title: 'Core Facility Finder — the instrument you were about to buy', url: '/cores' },
  ],
  'operating-cadence': [
    { title: 'YC — the weekly operating review, and why it survives a bad week', url: 'https://www.ycombinator.com/library' },
    { title: 'Kauffman Founders School — founder operating systems', url: 'https://www.entrepreneurship.org/learning-paths' },
    { title: 'Homeroom — the Sunday check-in this node feeds', url: '/homeroom' },
  ],
  'ai-founder-stack': [
    { title: 'NIST — the AI Risk Management Framework, for what needs a human', url: 'https://www.nist.gov/itl/ai-risk-management-framework' },
    { title: 'Anthropic — building with Claude', url: 'https://docs.claude.com/' },
    { title: 'YC Startup Library — AI tooling for small teams', url: 'https://www.ycombinator.com/library' },
    { title: 'NIH — data sharing and privacy expectations that survive a model', url: 'https://sharing.nih.gov/' },
  ],
  'manufacturing-scaleup': [
    { title: 'FDA — current good manufacturing practice, and when it starts applying', url: 'https://www.fda.gov/drugs/pharmaceutical-quality-resources/current-good-manufacturing-practice-cgmp-regulations' },
    { title: 'NIIMBL — biopharmaceutical manufacturing training and standards', url: 'https://niimbl.my.site.com/' },
    { title: 'BioPhorum — tech transfer practice between sponsor and CDMO', url: 'https://www.biophorum.com/' },
    { title: 'Technology transfer and scale-down model development (review)', url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3981586/' },
  ],
  'founder-resources': [
    { title: 'Haus perks — the credit programmes, claimed', url: '/homeroom/perks' },
    { title: 'Core Facility Finder — 830+ cores by technique', url: '/cores' },
    { title: 'Visa Desk — immigration support letters', url: '/visa' },
    { title: 'NIH SEED — non-dilutive capital and training', url: 'https://seed.nih.gov/' },
  ],
  'credibility-stack': [
    { title: 'a16z Bio + Health — what each audience actually reads', url: 'https://a16z.com/bio-health/' },
    { title: 'Nature Biotechnology — the signals the field trusts', url: 'https://www.nature.com/nbt/' },
    { title: 'LifeSciVC — credibility before data', url: 'https://lifescivc.com/category/biotech-startup-advice/' },
  ],
  'scientific-communication': [
    { title: 'Alan Alda Center for Communicating Science', url: 'https://www.aldacenter.org/' },
    { title: 'AAAS — communication toolkit for scientists', url: 'https://www.aaas.org/resources/communication-toolkit' },
    { title: 'Kevin Hale — how to pitch, and why the explanation comes first', url: 'https://www.youtube.com/watch?v=17XZGUX_9iM' },
  ],
  'demo-day': [
    { title: 'YC — how to design a better pitch deck', url: 'https://www.ycombinator.com/library/4T-how-to-design-a-better-pitch-deck' },
    { title: 'IndieBio demo days — the biotech version of the format', url: 'https://sosv.com/' },
    { title: 'The 2050 Final Showcase — what this cohort is building toward', url: '/showcase' },
  ],
  'press-and-media': [
    { title: 'Nature Biotechnology — who covers this field, and how', url: 'https://www.nature.com/nbt/' },
    { title: 'YC Startup Library — press and launches', url: 'https://www.ycombinator.com/library' },
    { title: 'Haus Feed — the network’s own publishing surface', url: '/news' },
  ],
  'relationship-systems': [
    { title: 'Haus mentors — the directory this node draws on', url: '/mentors' },
    { title: 'Kauffman Founders School — networks and advisors', url: 'https://www.entrepreneurship.org/learning-paths' },
    { title: 'Homeroom office hours', url: '/homeroom/hours' },
  ],
  'community-building': [
    { title: 'Nucleate — a community built around a problem, not a product', url: 'https://nucleate.org/' },
    { title: 'iGEM — the longest-running example in synthetic biology', url: 'https://igem.org/' },
    { title: 'Homeroom events — convene the room, then write down what you learned', url: '/homeroom/events' },
  ],
  'immigration-and-o1': [
    { title: 'USCIS — O-1A, extraordinary ability in the sciences and business', url: 'https://www.uscis.gov/working-in-the-united-states/temporary-workers/o-1-visa-individuals-with-extraordinary-ability-or-achievement' },
    { title: 'USCIS — evidentiary criteria, and the STEM policy update', url: 'https://www.uscis.gov/policy-manual/volume-2-part-m-chapter-4' },
    { title: 'Haus Visa Desk — draft the support letters', url: '/visa' },
  ],
  'showcase-capstone': [
    { title: 'The 2050 Final Showcase', url: '/showcase' },
    { title: 'YC — the 10-slide deck the package is built around', url: 'https://www.ycombinator.com/library/4T-how-to-design-a-better-pitch-deck' },
    { title: 'Haus portfolio — companies that came out of the programme', url: '/portfolio' },
  ],
};
