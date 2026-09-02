/**
 * The capital map — the seed roster behind Rate My Funder.
 *
 * Mirrors the shape of the Biopunk early-stage biotech capital map: an open
 * directory of the *earliest* financing available to a biotech founder —
 * grants, accelerators, pre-seed and seed funds, venture studios, fellowships,
 * angels, prizes and non-dilutive capital.
 *
 * Every row here is a real, publicly listed programme, and every field is
 * public information from the funder's own site. What is NOT here is any
 * rating: ratings and reviews come from members and only from members. A
 * seeded review would be a lie about a real organisation, which is the one
 * thing a review site cannot survive.
 */

export const CAPITAL_KINDS = [
  { slug: 'grant', label: 'Grants' },
  { slug: 'accelerator', label: 'Accelerators' },
  { slug: 'preseed', label: 'Pre-seed funds' },
  { slug: 'seed', label: 'Seed funds' },
  { slug: 'studio', label: 'Venture studios' },
  { slug: 'fellowship', label: 'Fellowships' },
  { slug: 'angel', label: 'Angels & syndicates' },
  { slug: 'prize', label: 'Prizes & challenges' },
  { slug: 'revenue', label: 'Revenue-based & debt' },
];

export const FUNDERS = [
  /* ------------------------------------------------------------- grants */
  {
    name: 'NIH SBIR/STTR', kind: 'grant', dilutive: false,
    focus: 'Health and life science, all modalities',
    stages: 'Concept to clinical', checkSize: '$300K Phase I / $2M Phase II',
    location: 'United States', website: 'https://seed.nih.gov/',
    description: 'The largest non-dilutive source in US life science. Three standard receipt dates a year on the omnibus, plus institute-specific calls. Registration across SAM.gov, eRA Commons and SBA takes weeks — start it before you have a project.',
  },
  {
    name: 'NSF America’s Seed Fund', kind: 'grant', dilutive: false,
    focus: 'Deep technology across all sectors',
    stages: 'Pre-product', checkSize: 'Up to $305K Phase I',
    location: 'United States', website: 'https://seedfund.nsf.gov/',
    description: 'The project pitch is three pages and gets a yes or no in weeks. Highest-leverage first step in non-dilutive fundraising.',
  },
  {
    name: 'ARPA-H', kind: 'grant', dilutive: false,
    focus: 'Health moonshots, biosecurity, tools',
    stages: 'Any', checkSize: '$500K–$10M+',
    location: 'United States', website: 'https://arpa-h.gov/',
    description: 'Open BAA plus focused programmes. Faster decisions than NIH and a higher tolerance for approaches that have not been tried.',
  },
  {
    name: 'DOE SBIR', kind: 'grant', dilutive: false,
    focus: 'Energy, bioenergy, biomanufacturing, materials',
    stages: 'Pre-product', checkSize: '$250K Phase I',
    location: 'United States', website: 'https://science.osti.gov/sbir',
    description: 'Topic-driven: the annual topics document decides whether you are eligible at all. Requires a letter of intent ahead of the full proposal.',
  },
  {
    name: 'DoD CDMRP', kind: 'grant', dilutive: false,
    focus: 'Disease-specific congressionally directed research',
    stages: 'Research through translation', checkSize: '$100K–$2M+',
    location: 'United States', website: 'https://cdmrp.health.mil/',
    description: 'Disease-area programmes with their own LOI and full-proposal cycles. Reviewers include patient advocates, which changes how the significance section should be written.',
  },
  {
    name: 'Wellcome Trust', kind: 'grant', dilutive: false,
    focus: 'Health research, climate and health, discovery',
    stages: 'Discovery to translation', checkSize: '£100K–£5M',
    location: 'United Kingdom / global', website: 'https://wellcome.org/grant-funding',
    description: 'Open to non-UK applicants on several schemes. Translation Awards specifically fund the gap between a finding and a product.',
  },
  {
    name: 'Wellcome Leap', kind: 'grant', dilutive: false,
    focus: 'Bounded, time-limited health programmes',
    stages: 'Any', checkSize: 'Programme-dependent, often $1M+',
    location: 'Global', website: 'https://wellcomeleap.org/',
    description: 'Programme-based rather than investigator-based, on aggressive timelines. Contracts, not grants, with milestone payments.',
  },
  {
    name: 'Gates Foundation Grand Challenges', kind: 'grant', dilutive: false,
    focus: 'Global health and development',
    stages: 'Concept to scale', checkSize: '$100K Phase I, $1M+ later',
    location: 'Global', website: 'https://gcgh.grandchallenges.org/',
    description: 'Phase I is deliberately small and fast and open to companies. One award materially improves the odds on later calls.',
  },
  {
    name: 'Chan Zuckerberg Initiative', kind: 'grant', dilutive: false,
    focus: 'Imaging, single cell, open science tools',
    stages: 'Tool development', checkSize: '$100K–$1M',
    location: 'Global', website: 'https://chanzuckerberg.com/rfa/',
    description: 'Funds open-source scientific software and imaging tools that no commercial funder will touch. Requires open licensing.',
  },
  {
    name: 'Renaissance Philanthropy', kind: 'grant', dilutive: false,
    focus: 'Science acceleration, metascience, new institutions',
    stages: 'Early', checkSize: 'Programme-dependent',
    location: 'United States', website: 'https://renaissancephilanthropy.org/',
    description: 'Runs and funds fast-grant style programmes for approaches that fall between the established funders.',
  },
  {
    name: 'Astera Institute', kind: 'grant', dilutive: false,
    focus: 'Open science, scientific tooling, neglected problems',
    stages: 'Any', checkSize: '$100K–$1M+',
    location: 'United States', website: 'https://astera.org/',
    description: 'Residency and open-science grants for work that is hard to fund conventionally. Strong bias toward open outputs.',
  },
  {
    name: 'Schmidt Futures / Schmidt Sciences', kind: 'grant', dilutive: false,
    focus: 'AI for science, scientific talent',
    stages: 'Any', checkSize: 'Programme-dependent',
    location: 'Global', website: 'https://www.schmidtsciences.org/',
    description: 'Fellowship and programme funding at the intersection of AI and the physical and life sciences.',
  },

  /* ------------------------------------------------------ accelerators */
  {
    name: 'IndieBio', kind: 'accelerator', dilutive: true,
    focus: 'Biology-based companies, all sectors',
    stages: 'Pre-seed / seed', checkSize: '$525K',
    location: 'San Francisco / New York', website: 'https://indiebio.co/',
    description: 'The reference biotech accelerator. Wet lab access is the real product; the cheque is secondary. Four-month programme, then a demo day.',
  },
  {
    name: 'Y Combinator', kind: 'accelerator', dilutive: true,
    focus: 'Sector agnostic, growing bio cohort',
    stages: 'Idea to seed', checkSize: '$125K + $375K SAFE',
    location: 'San Francisco', website: 'https://www.ycombinator.com/',
    description: 'Standard deal, no negotiation. Bio companies increasingly fit; the batch dynamics reward companies with a shippable product more than a long research programme.',
  },
  {
    name: 'HAX (SOSV)', kind: 'accelerator', dilutive: true,
    focus: 'Hard tech, robotics, industrial biology hardware',
    stages: 'Pre-seed', checkSize: '$250K–$500K',
    location: 'Newark NJ / global', website: 'https://hax.co/',
    description: 'The hardware sibling of IndieBio. Prototyping, manufacturing and supply chain support that no software accelerator can offer.',
  },
  {
    name: 'Petri', kind: 'accelerator', dilutive: true,
    focus: 'Bio-engineering, tools, platforms',
    stages: 'Pre-seed', checkSize: '~$1M',
    location: 'Boston / San Francisco', website: 'https://petri.bio/',
    description: 'Bio-focused pre-seed fund and programme with a strong operator and scientist bench.',
  },
  {
    name: 'Nucleate Activator', kind: 'accelerator', dilutive: false,
    focus: 'Academic bio ventures',
    stages: 'Pre-company', checkSize: 'No cheque, no equity',
    location: 'Global chapters', website: 'https://nucleate.xyz/',
    description: 'Free and non-dilutive, student and postdoc led. The best first programme for a founder still inside a university.',
  },
  {
    name: 'Creative Destruction Lab', kind: 'accelerator', dilutive: false,
    focus: 'Deep tech streams including health and matter',
    stages: 'Seed', checkSize: 'No direct cheque',
    location: 'Toronto and global sites', website: 'https://creativedestructionlab.com/',
    description: 'Objective-setting programme run by investor mentors. Takes no equity for participation; mentors may invest separately.',
  },
  {
    name: 'Techstars', kind: 'accelerator', dilutive: true,
    focus: 'Sector agnostic with life science verticals',
    stages: 'Pre-seed', checkSize: '$120K',
    location: 'Global', website: 'https://www.techstars.com/',
    description: 'Quality varies enormously by programme and by managing director. Diligence the specific programme, not the brand.',
  },
  {
    name: 'Illumina Accelerator', kind: 'accelerator', dilutive: true,
    focus: 'Genomics',
    stages: 'Seed', checkSize: 'Investment plus sequencing credit',
    location: 'Bay Area / Cambridge UK', website: 'https://www.illumina.com/company/about-us/accelerator.html',
    description: 'Sequencing capacity and lab space alongside the investment, which for a genomics company is most of the value.',
  },
  {
    name: 'Y Combinator Bio / Alix / RebelBio alumni networks', kind: 'accelerator', dilutive: true,
    focus: 'Life science, European emphasis',
    stages: 'Pre-seed', checkSize: 'Varies',
    location: 'Europe', website: 'https://sosv.com/',
    description: 'SOSV’s European life science lineage. Programme names have changed repeatedly; the network behind them has not.',
  },

  /* ---------------------------------------------------------- pre-seed */
  {
    name: 'Haus Ventures Fund I', kind: 'preseed', dilutive: true,
    focus: 'Frontier biology, community-built companies',
    stages: 'Pre-seed', checkSize: '$10K SAFE + 1% advisory, post-programme',
    location: 'San Francisco / global houses', website: 'https://haus.fund/',
    description: 'Nothing is taken during the residency; the grant is on completion. Listed here so members can review their own programme as candidly as any other funder.',
  },
  {
    name: 'Age1', kind: 'preseed', dilutive: true,
    focus: 'Longevity and aging biology',
    stages: 'Pre-seed', checkSize: '$500K–$2M',
    location: 'San Francisco', website: 'https://age1.com/',
    description: 'Dedicated longevity pre-seed fund with an associated fellowship for pre-company founders.',
  },
  {
    name: 'Cantos', kind: 'preseed', dilutive: true,
    focus: 'Deep tech and bio at the earliest stage',
    stages: 'Pre-seed', checkSize: '$250K–$1M',
    location: 'United States', website: 'https://www.cantos.vc/',
    description: 'Writes very early, including pre-incorporation, into technically hard companies.',
  },
  {
    name: '50 Years', kind: 'preseed', dilutive: true,
    focus: 'Science companies solving large problems',
    stages: 'Pre-seed / seed', checkSize: '$500K–$3M',
    location: 'San Francisco', website: 'https://5050.vc/',
    description: 'Runs a founder programme alongside the fund. Explicitly studies successful company patterns with founders, which few funds do.',
  },
  {
    name: 'Compound', kind: 'preseed', dilutive: true,
    focus: 'Frontier technology including bio',
    stages: 'Pre-seed / seed', checkSize: '$500K–$3M',
    location: 'New York', website: 'https://compound.vc/',
    description: 'Research-driven, comfortable with long technical timelines.',
  },
  {
    name: 'Refactor', kind: 'preseed', dilutive: true,
    focus: 'Bio, climate, industrial',
    stages: 'Pre-seed', checkSize: '$250K–$1.5M',
    location: 'United States', website: 'https://refactor.com/',
    description: 'Early cheques into technically differentiated companies with a clear commercial wedge.',
  },
  {
    name: 'Pillar VC', kind: 'preseed', dilutive: true,
    focus: 'Bio and frontier tech, Boston ecosystem',
    stages: 'Pre-seed / seed', checkSize: '$500K–$3M',
    location: 'Boston', website: 'https://www.pillar.vc/',
    description: 'Deeply connected to the Boston academic ecosystem; runs founder programming for pre-company scientists.',
  },
  {
    name: 'Prima Materia / Boom / regional pre-seed', kind: 'preseed', dilutive: true,
    focus: 'Regional deep tech',
    stages: 'Pre-seed', checkSize: 'Varies',
    location: 'Europe', website: 'https://www.dealroom.co/',
    description: 'Regional pre-seed funds move faster on local companies than any US fund will. Map yours before flying to San Francisco.',
  },

  /* -------------------------------------------------------------- seed */
  {
    name: 'Lux Capital', kind: 'seed', dilutive: true,
    focus: 'Frontier science and technology',
    stages: 'Seed to growth', checkSize: '$1M–$20M+',
    location: 'New York / San Francisco', website: 'https://luxcapital.com/',
    description: 'Comfortable with scientific risk and long horizons. Writes seed cheques into companies that look unfinanceable elsewhere.',
  },
  {
    name: 'Founders Fund', kind: 'seed', dilutive: true,
    focus: 'Hard technology including bio',
    stages: 'Seed to growth', checkSize: '$1M–$50M+',
    location: 'San Francisco', website: 'https://foundersfund.com/',
    description: 'Concentrated, conviction-driven. A fast no or a fast yes, which is more useful than a slow maybe.',
  },
  {
    name: 'a16z Bio + Health', kind: 'seed', dilutive: true,
    focus: 'Bio, health, computational biology',
    stages: 'Seed to growth', checkSize: '$1M–$50M+',
    location: 'Menlo Park', website: 'https://a16z.com/bio-health/',
    description: 'Large platform with substantial operating support. Process is heavier than a small fund; plan for it.',
  },
  {
    name: 'Playground Global', kind: 'seed', dilutive: true,
    focus: 'Deep tech, bio-manufacturing, tools',
    stages: 'Seed / Series A', checkSize: '$2M–$20M',
    location: 'Palo Alto', website: 'https://playground.global/',
    description: 'Technical diligence is genuinely technical. Expect your data to be read closely.',
  },
  {
    name: 'Khosla Ventures', kind: 'seed', dilutive: true,
    focus: 'Science-heavy companies across sectors',
    stages: 'Seed to growth', checkSize: '$500K–$50M',
    location: 'Menlo Park', website: 'https://www.khoslaventures.com/',
    description: 'Explicitly seeks technical improbability. Seed programme writes small cheques into very early science.',
  },
  {
    name: 'DCVC Bio', kind: 'seed', dilutive: true,
    focus: 'Computational biology and bio-manufacturing',
    stages: 'Seed / Series A', checkSize: '$2M–$15M',
    location: 'San Francisco', website: 'https://www.dcvc.com/',
    description: 'Data-driven biology thesis. Strong fit where the differentiation is the computational layer.',
  },
  {
    name: 'Bee Partners', kind: 'seed', dilutive: true,
    focus: 'Pre-seed and seed deep tech',
    stages: 'Pre-seed / seed', checkSize: '$500K–$3M',
    location: 'San Francisco', website: 'https://beepartners.vc/',
    description: 'Works with founders coming directly out of research settings.',
  },
  {
    name: 'Freeflow / Boost / operator syndicates', kind: 'seed', dilutive: true,
    focus: 'Sector agnostic, operator-led',
    stages: 'Seed', checkSize: '$100K–$1M',
    location: 'Global', website: 'https://angellist.com/',
    description: 'Syndicates fill a round quickly once a lead is committed. Useless as a lead, excellent as a fill.',
  },

  /* ------------------------------------------------------------ studio */
  {
    name: 'Flagship Pioneering', kind: 'studio', dilutive: true,
    focus: 'Company creation in life science',
    stages: 'Pre-company', checkSize: 'Funds the newco entirely',
    location: 'Cambridge MA', website: 'https://www.flagshippioneering.com/',
    description: 'Creates companies internally rather than investing in yours. The route in is as a scientist or entrepreneur in residence.',
  },
  {
    name: 'Arch Venture Partners', kind: 'studio', dilutive: true,
    focus: 'Company creation from academic breakthroughs',
    stages: 'Pre-company / seed', checkSize: '$5M–$50M+',
    location: 'Chicago / Seattle / San Francisco', website: 'https://www.archventure.com/',
    description: 'Co-founds companies out of university science with very large early rounds.',
  },
  {
    name: 'Deep Science Ventures', kind: 'studio', dilutive: true,
    focus: 'Founder-led company creation in health, climate, agriculture',
    stages: 'Pre-company', checkSize: 'Salary plus founding equity',
    location: 'London', website: 'https://deepscienceventures.com/',
    description: 'Recruits scientists as founders and builds the company around a defined problem. You join as a founder rather than arriving with a company.',
  },
  {
    name: 'Ignition / Curie.Bio', kind: 'studio', dilutive: true,
    focus: 'Therapeutics seed creation',
    stages: 'Seed', checkSize: '$2M–$20M',
    location: 'Boston', website: 'https://curie.bio/',
    description: 'Seed financing plus embedded drug development expertise for therapeutics companies specifically.',
  },
  {
    name: 'Homeworld Collective', kind: 'studio', dilutive: false,
    focus: 'Climate biotechnology field building',
    stages: 'Pre-company', checkSize: 'Grants and fellowships',
    location: 'United States', website: 'https://www.homeworld.bio/',
    description: 'Funds and convenes climate biotech research that is too early for a company. Non-dilutive.',
  },

  /* ------------------------------------------------------- fellowships */
  {
    name: 'Activate Fellowship', kind: 'fellowship', dilutive: false,
    focus: 'Hard technology, including biology',
    stages: 'Pre-company', checkSize: '2 years salary + expenses + lab access',
    location: 'Berkeley, Boston, Houston, NY, distributed', website: 'https://www.activate.org/',
    description: 'Two years paid, no equity, with national lab access. Among the best deals available to a hard-tech founder anywhere.',
  },
  {
    name: 'Schmidt Science Fellows', kind: 'fellowship', dilutive: false,
    focus: 'Interdisciplinary postdoctoral science',
    stages: 'Postdoc', checkSize: '$110K+ stipend',
    location: 'Global', website: 'https://schmidtsciencefellows.org/',
    description: 'Funds a deliberate pivot into a new discipline. Nominated through institutions rather than applied to directly.',
  },
  {
    name: 'Life Sciences Research Foundation', kind: 'fellowship', dilutive: false,
    focus: 'Postdoctoral life science research',
    stages: 'Postdoc', checkSize: '3-year fellowship',
    location: 'United States', website: 'https://lsrf.org/',
    description: 'Postdoctoral fellowship that can be held at a non-profit host institution, which matters for founders straddling academia and a company.',
  },
  {
    name: 'Emergent Ventures', kind: 'fellowship', dilutive: false,
    focus: 'High-variance individuals and projects',
    stages: 'Any', checkSize: '$10K–$100K',
    location: 'Global', website: 'https://www.mercatus.org/emergent-ventures',
    description: 'Fast, small, no strings. Application is short and decisions arrive in weeks. Ideal for the first thousand dollars.',
  },
  {
    name: 'Thiel Fellowship', kind: 'fellowship', dilutive: false,
    focus: 'Under-23 founders leaving formal education',
    stages: 'Pre-company', checkSize: '$100K over 2 years',
    location: 'Global', website: 'https://thielfellowship.org/',
    description: 'No equity. Age-limited and explicitly requires stepping away from a degree.',
  },
  {
    name: 'Open Philanthropy Career Development', kind: 'fellowship', dilutive: false,
    focus: 'Biosecurity, pandemic preparedness',
    stages: 'Any', checkSize: 'Varies',
    location: 'Global', website: 'https://www.openphilanthropy.org/',
    description: 'Funds people rather than projects in biosecurity and adjacent fields.',
  },

  /* ------------------------------------------------------------ angels */
  {
    name: 'BioAngels / life science angel groups', kind: 'angel', dilutive: true,
    focus: 'Regional life science angel investing',
    stages: 'Pre-seed / seed', checkSize: '$25K–$500K aggregate',
    location: 'Regional', website: 'https://www.angelcapitalassociation.org/',
    description: 'Slower and more diligence-heavy per dollar than a fund, but often the only local capital that understands a wet lab.',
  },
  {
    name: 'AngelList syndicates', kind: 'angel', dilutive: true,
    focus: 'Sector agnostic',
    stages: 'Pre-seed / seed', checkSize: '$50K–$1M',
    location: 'Global', website: 'https://www.angellist.com/syndicates',
    description: 'Fills a round after a lead is set. Watch the carry stacking if several syndicates participate.',
  },
  {
    name: 'Scientist-operator angels', kind: 'angel', dilutive: true,
    focus: 'Domain-specific',
    stages: 'Pre-seed', checkSize: '$10K–$100K',
    location: 'Global', website: '/homeroom/mentors',
    description: 'The most useful early money in biology usually comes from someone who has run the assay you are running. Several are in this network — check the mentor directory.',
  },

  /* ------------------------------------------------------------ prizes */
  {
    name: 'J&J JLABS QuickFire Challenges', kind: 'prize', dilutive: false,
    focus: 'Rotating themes across health',
    stages: 'Any', checkSize: '$100K–$500K + residency',
    location: 'Global', website: 'https://jlabs.jnjinnovation.com/quickfire-challenges',
    description: 'Short applications relative to the cheque, with JLABS lab space attached. Unusually good expected value.',
  },
  {
    name: 'XPRIZE', kind: 'prize', dilutive: false,
    focus: 'Grand-challenge competitions including health and longevity',
    stages: 'Any', checkSize: '$1M–$100M pools',
    location: 'Global', website: 'https://www.xprize.org/',
    description: 'Milestone prizes along the way matter more than the grand prize for a startup’s cash flow.',
  },
  {
    name: 'Hello Tomorrow', kind: 'prize', dilutive: false,
    focus: 'Deep tech global challenge',
    stages: 'Early', checkSize: '€100K prize pool + visibility',
    location: 'Paris / global', website: 'https://hello-tomorrow.org/',
    description: 'The European deep tech convening. The prize is small; the introductions are the point.',
  },
  {
    name: 'CSIRO ON Accelerate', kind: 'prize', dilutive: false,
    focus: 'Australian research commercialisation',
    stages: 'Pre-company / early', checkSize: 'Programme funding',
    location: 'Australia', website: 'https://www.csiro.au/en/work-with-us/funding-programs/programs/on-innovation-program',
    description: 'The route for Australian research teams into commercialisation, with non-dilutive support attached.',
  },
  {
    name: 'NEDO', kind: 'prize', dilutive: false,
    focus: 'Japanese deep tech and energy',
    stages: 'Early to scale', checkSize: '¥10M–¥300M',
    location: 'Japan', website: 'https://www.nedo.go.jp/english/',
    description: 'Substantial non-dilutive support for companies operating in Japan, including foreign-founded ones with a Japanese entity.',
  },

  /* ----------------------------------------------------------- revenue */
  {
    name: 'Lighter Capital / revenue-based financing', kind: 'revenue', dilutive: false,
    focus: 'Companies with recurring revenue',
    stages: 'Post-revenue', checkSize: '$50K–$4M',
    location: 'United States', website: 'https://www.lightercapital.com/',
    description: 'Only relevant once revenue is recurring, which for a tools company can be earlier than founders assume.',
  },
  {
    name: 'Venture debt (SVB / Bridge Bank / HSBC Innovation)', kind: 'revenue', dilutive: false,
    focus: 'Venture-backed companies extending runway',
    stages: 'Post Series A', checkSize: '20–30% of last equity round',
    location: 'United States / UK', website: 'https://www.svb.com/',
    description: 'Cheap relative to equity and dangerous relative to nothing. Read the covenants and the material-adverse-change clause with counsel.',
  },
];
