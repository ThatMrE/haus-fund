/**
 * The Library — the Biopunk Founder Manual as a working training system.
 *
 * SOURCE. This is not invented. The six tracks and their modules are the
 * curriculum taxonomy from "Biopunk · Haus Fund — Fall 2026 Program Design"
 * (v2, 1 September 2026), which itself converged seven drafts and absorbed YC
 * Startup School, Antler, HAX, IndieBio, Third Derivative, New Energy Nexus and
 * 5050/50Y, plus operating experience from HQ, DRF and Biopunk. The workshop
 * sequence and deliverables are the S26 programming calendar reconciled against
 * the Fall 90-day calendar in the same document.
 *
 * The document's own framing is the design brief for this file: "the index for
 * the resource library and the menu from which live sessions are selected.
 * Nothing here is delivered in full in any single cohort." So the library is
 * the whole menu, the calendar picks from it, and a founder who misses a live
 * session can still work the module.
 *
 * WHAT MAKES IT A TRAINING SYSTEM RATHER THAN A DOCUMENT DUMP
 *   - `track` → `module` → the work, in a fixed order.
 *   - Every module states what you should be able to do afterwards, not what
 *     it covers.
 *   - `deliverable` is the artefact the programme actually asks for, and it is
 *     the same artefact the 90-day calendar asks for in that week.
 *   - Progress is per member and per module, so "done" means you produced the
 *     thing, not that you opened the page.
 */

export const TRACKS = [
  {
    slug: 'founder-fundamentals',
    title: 'Founder fundamentals and decision-making',
    focus: 'Decision-making, prioritisation, risk, founder psychology',
    blurb: 'The track that decides whether the other five matter. Most companies at this stage die of a decision, not of a technology.',
  },
  {
    slug: 'customers-and-commercialization',
    title: 'Customers, markets and commercialisation',
    focus: 'Customer discovery, beachhead markets, technoeconomics, partnerships',
    blurb: 'Translating science into something a named person will pay for, and finding out which named person before you build it.',
  },
  {
    slug: 'fundraising-and-capital',
    title: 'Fundraising, capital and investor relations',
    focus: 'Venture, grants, diligence, fundraising readiness',
    blurb: 'What can be proven with nothing, with $50K, with $500K and with $2M — and how to ask for each in turn.',
  },
  {
    slug: 'legal-ip-and-regulatory',
    title: 'Legal, IP, regulatory and company infrastructure',
    focus: 'Formation, IP, FDA, governance, contracts',
    blurb: 'Delivered live by Orrick across four workshops and standing office hours. The mistakes here are the expensive, unwindable kind.',
  },
  {
    slug: 'team-and-operations',
    title: 'Team building, operations and scale',
    focus: 'Hiring, manufacturing, scale-up, labs',
    blurb: 'From the first hire to the first pilot plant, plus the lab operations nobody teaches in a PhD.',
  },
  {
    slug: 'brand-network-and-life',
    title: 'Brand, network and founder life',
    focus: 'Communication, credibility, media, relationships',
    blurb: 'The scientific credibility stack, and what investors, customers, regulators, recruits and journalists each actually trust.',
  },
];

/*
 * [track, slug, title, kind, minutes, week, deliverable, summary, outcomes[], work[]]
 *
 * kind:  playbook | workshop | clinic | reference
 * week:  the 90-day calendar week it is delivered live in, or 0 for async
 */
const MODULES = [
  /* ------------------------------------------- founder fundamentals */
  ['founder-fundamentals', 'risk-mapping', 'Technical risk, market risk and the risk map', 'workshop', 90, 1, 'Risk Map',
    'The first workshop of the programme, and the one everything else hangs off. Technical risk is what might not work. Market risk is what might work and still not matter. Most scientific founders are fluent in the first and blind to the second.',
    ['Separate scientific risk from engineering risk from market risk, and say which one is killing you now',
      'Name your highest-risk assumption in one sentence',
      'Design the smallest experiment that settles it',
      'Sequence technical milestones so each one unlocks the next round rather than the next paper'],
    ['Write every assumption your company depends on, one per line.',
      'Mark each one technical, market or execution.',
      'Rank by (cost if wrong) × (probability wrong). The top three are your Risk Map.',
      'For the top one, write the cheapest experiment that would change your mind, and what result would.']],

  ['founder-fundamentals', 'beachhead-market-memo', 'Beachhead markets and why superior products fail', 'workshop', 90, 1, 'Beachhead Market Memo',
    'A technically superior product losing to a worse one is the default outcome, not the exception. Usually because the better product asked the customer to change more than the improvement was worth.',
    ['Choose a beachhead you can dominate rather than a market you can enter',
      'State the switching cost you are asking a customer to bear',
      'Distinguish fastest path to revenue from fastest path to learning, and pick deliberately'],
    ['Name the single customer segment where you win outright, not narrowly.',
      'Estimate how many such customers exist. If it is more than a few hundred, narrow further.',
      'Write the memo: who, why them, why now, what they use today, what it costs them to switch.']],

  ['founder-fundamentals', 'founder-scorecard', 'The founder scorecard and goal setting', 'playbook', 45, 1, 'Founder Scorecard',
    'Orientation-week baseline. A scorecard exists so that in week 12 you can tell whether the ninety days moved anything, rather than reasoning from how tired you feel.',
    ['Set goals with a number and a date attached',
      'Distinguish leading from lagging indicators for a company with no revenue',
      'Build an accountability loop that survives a bad week'],
    ['Score yourself now on: science, customers, capital, team, and your own bandwidth.',
      'Set three goals for the ninety days. Each needs a number and a date.',
      'Name the one metric you would report weekly even if nobody asked.']],

  ['founder-fundamentals', 'decision-making', 'Deciding on incomplete information', 'playbook', 60, 0, '',
    'The completeness fallacy: waiting for the data that would make the decision obvious. In a startup that data arrives after the decision was needed, or never.',
    ['Decide at the point where more information stops being worth its delay',
      'Tell reversible decisions from unwindable ones and spend your deliberation accordingly',
      'Know when to listen to advice and when to ignore it'],
    ['List every decision you are currently deferring.',
      'Mark each reversible or not. Make every reversible one today.',
      'For each unwindable one, write what specific evidence would settle it and how you will get it.']],

  ['founder-fundamentals', 'prioritization-map', 'Founder judgment and the prioritisation map', 'workshop', 90, 10, 'Company Prioritization Map',
    'Biopunk workshop 2 in the medium case. By week 10 the problem is no longer what to do, it is what to stop.',
    ['Rank company activities by contribution to the next milestone',
      'Say no to good opportunities that are not this quarter’s opportunity',
      'Distinguish evidence from opinion in your own reasoning'],
    ['List everything the company is currently doing.',
      'Score each against the next funding or customer milestone.',
      'Kill or park the bottom third. Write down what you killed and why — you will be asked.']],

  ['founder-fundamentals', 'study-the-greats', 'Study the greats: case studies and pattern recognition', 'playbook', 60, 0, '',
    'A gap the programme review flagged explicitly: most accelerators skip this, and 5050 does not. Reverse-engineering companies that worked, and companies that did not, is cheaper than learning the same lessons live.',
    ['Reconstruct how a company you admire actually got its first customer and first cheque',
      'Identify the decision that made it, not the narrative told afterwards',
      'Recognise the failure patterns that most resemble your own position'],
    ['Pick two companies in your space: one that worked, one that did not.',
      'Reconstruct the first 24 months of each from primary sources — filings, interviews, archived sites.',
      'Write the one decision that separated them. Then ask whether you are about to make the wrong version of it.']],

  ['founder-fundamentals', 'capital-efficiency', 'Burn rate versus learning rate', 'playbook', 45, 0, '',
    'Capital efficiency is not frugality. It is the ratio of what you learned to what you spent, and expensive validation is the most common way to get it badly wrong.',
    ['Measure spend against assumptions retired, not against runway consumed',
      'Recognise the experiment that costs ten times more and proves the same thing',
      'Spend on the things investors actually reward'],
    ['Take last month’s spend and assign every line to an assumption it tested.',
      'Anything that tested nothing is either infrastructure or waste. Decide which.',
      'Design next month so the largest line item retires the largest risk.']],

  ['founder-fundamentals', 'founder-wellbeing', 'Founder wellbeing and sustainable ambition', 'playbook', 30, 0, '',
    'Carried in the curriculum taxonomy because the review found it missing from most comparable programmes. A founder who breaks in month nine has not made a trade-off, they have made a mistake.',
    ['Build routines that survive a fundraise',
      'Notice the difference between hard and unsustainable',
      'Use the cohort as a pressure release rather than a performance'],
    ['Write what your week looked like in the last bad month.',
      'Name the two things you dropped first. Those are your early-warning indicators.',
      'Put one non-negotiable back in the calendar this week.']],

  /* ------------------------------------ customers and commercialisation */
  ['customers-and-commercialization', 'customer-discovery', 'Customer discovery for scientists', 'workshop', 90, 4, 'Customer Discovery Plan',
    'Operator-led. Scientists are unusually good at interviews once they stop pitching — it is the same skill as not leading a witness.',
    ['Run an interview that produces information rather than encouragement',
      'Tell real demand from polite interest',
      'Build a design partner pipeline rather than a list of well-wishers'],
    ['Write your ideal customer profile with enough specificity that you could name ten.',
      'Name them. Find the actual humans.',
      'Draft the interview guide: past behaviour, not future intentions. No product mentioned in the first ten minutes.',
      'Target fifteen conversations a week. Log every one.']],

  ['customers-and-commercialization', 'design-partner-pipeline', 'Design partners, LOIs and pilots', 'playbook', 60, 4, 'Design Partner Pipeline',
    'A letter of intent is worth exactly what the person signing it risks by signing. Most are worth nothing. Some are worth a round.',
    ['Structure a design partnership that gets you data rather than a logo',
      'Write an LOI that a procurement department will actually let through',
      'Convert a pilot to a contract, which is a different sale from the pilot itself'],
    ['For each pipeline account: name the economic buyer and the technical buyer separately.',
      'Define what the pilot must show for them to buy, in their words.',
      'Agree the success criteria in writing before the pilot starts, not after.']],

  ['customers-and-commercialization', 'founder-led-sales', 'Founder-led sales for scientists', 'workshop', 90, 0, 'Early Sales Pipeline',
    'Selling before the product is finished is not dishonest, it is how anything hard gets built. The dishonest version is promising a date.',
    ['Map every stakeholder in a scientific purchase, including the one who can only say no',
      'Navigate procurement, vendor onboarding, insurance and compliance requirements',
      'Run an enterprise or pharma sales cycle without losing a year to it'],
    ['Draw the buying committee for your top account. Name each seat.',
      'Find out what their procurement process requires before you are in it.',
      'Write the one-page technical summary the internal champion will forward without editing.']],

  ['customers-and-commercialization', 'technoeconomics', 'Technoeconomics, cost curves and willingness to pay', 'playbook', 90, 0, '',
    'Flagged in the programme review as arguably as important as customer discovery for biotech and hard tech, and usually absent.',
    ['Build a technoeconomic analysis that survives a sceptical investor',
      'Find the cost threshold below which adoption becomes rational for the buyer',
      'Separate the economic buyer from the technical buyer and price to the former'],
    ['Model your unit cost at current scale and at 100×.',
      'Model the incumbent’s total cost of ownership, not its list price.',
      'Find the crossover. If it does not exist, say so now rather than in diligence.']],

  ['customers-and-commercialization', 'category-design', 'Category creation versus market entry', 'playbook', 60, 0, '',
    'Another gap the review identified. Many frontier science companies are creating a category and pricing as though they are entering one.',
    ['Tell whether you are entering a market or making one',
      'Budget for customer education as a real cost line',
      'Judge market timing — too early is indistinguishable from wrong'],
    ['Write the sentence a customer would use to describe what they bought.',
      'If no existing budget line covers it, you are creating a category. Plan accordingly.',
      'Name what has to become true in the world for you to be on time.']],

  ['customers-and-commercialization', 'business-model', 'Business model and pricing for science companies', 'playbook', 60, 0, '',
    'Platform, tool, service, therapeutic and product companies have irreconcilable economics. Choosing late is expensive.',
    ['Choose between platform, product and service deliberately',
      'Price against value delivered rather than cost incurred',
      'Recognise when a services business is funding a product business, and when it has replaced it'],
    ['Write your Lean Canvas in one sitting. Do not polish it.',
      'State your pricing and the value it captures as a percentage.',
      'Name the point at which services revenue would be a trap.']],

  ['customers-and-commercialization', 'strategic-partnerships', 'Partnerships, CROs and sponsored research', 'reference', 45, 0, '',
    'Partner or build is a capital allocation question disguised as a strategy question.',
    ['Diligence a partner before signing, including their incentive to stall',
      'Structure a sponsored research agreement that does not encumber your IP',
      'Know when a pharma partnership is validation and when it is a holding pattern'],
    ['List what you would have to build to not need this partner.',
      'Price it. Compare against what the partnership costs in equity, IP and time.',
      'Take the resulting term sheet to Orrick office hours before signing.']],

  /* -------------------------------------------- fundraising and capital */
  ['fundraising-and-capital', 'raising-on-an-idea', 'Raising on an idea', 'workshop', 90, 3, 'Fundraising Roadmap',
    'Delivered in week 3 alongside Reverse Demo Day. Proof-point fundraising: what you can credibly raise on before you have data.',
    ['State what can be proven with $0, $50K, $500K and $2M+, and raise against exactly that',
      'Understand what traction actually matters at pre-seed for a science company',
      'Avoid the common mistakes: raising too little, raising against the wrong milestone, raising in build mode'],
    ['Write the four proof points at the four budget levels.',
      'Identify which one your next round buys.',
      'Build the roadmap backwards from the round after that.']],

  ['fundraising-and-capital', 'venture-math', 'Venture capital, fund economics and venture math', 'workshop', 90, 0, 'Investor Strategy Memo',
    'Fund economics explain investor behaviour better than any conversation with an investor will. A fund that needs a $1B outcome cannot fund a $100M company, however good it is.',
    ['Read a fund’s size, vintage and ownership target and predict what it can say yes to',
      'Model dilution across three rounds without flinching',
      'Understand SAFEs, valuation caps, lead investors, syndicates and board dynamics'],
    ['Build the dilution model: this round, the next, the one after.',
      'For your ten target funds, write fund size, typical cheque and ownership target.',
      'Cut any fund whose model your company cannot satisfy. That list is your strategy memo.']],

  ['fundraising-and-capital', 'fundraising-narrative', 'The fundraising narrative and investor communication', 'workshop', 60, 11, 'Fundraising Narrative',
    'Investors fund a story that is consistent with the data, not a story instead of the data — and not the data instead of a story.',
    ['Write a narrative that survives a technical sceptic and a generalist in the same room',
      'Run monthly investor updates that make the next raise easier',
      'Balance credibility and ambition without sounding like either a paper or a pitch'],
    ['Write the narrative in five sentences. Problem, insight, why now, evidence, ask.',
      'Give it to a scientist and a generalist. Fix whatever both stumble on.',
      'Send the first investor update this month, even with no investors.']],

  ['fundraising-and-capital', 'grants-and-nondilutive', 'Grants and non-dilutive capital', 'workshop', 90, 7, 'Grant Pipeline',
    'Sponsor-led, with grants office hours the same week. SBIR, STTR, NIH, NSF, ARPA-H, DoD, DOE — and the registration steps that quietly eat a month.',
    ['Choose between grants and venture for a given milestone rather than pursuing both badly',
      'Time an application backwards from the deadline including registrations',
      'Write specific aims a reviewer can score without reading twice'],
    ['Complete SAM.gov, eRA Commons and SBA registration now, before you have a target.',
      'Build the pipeline: agency, mechanism, deadline, fit, effort. Twelve months out.',
      'Draft one specific aims page and take it to grants office hours.']],

  ['fundraising-and-capital', 'diligence-room', 'Diligence, data rooms and fundraising readiness', 'workshop', 60, 11, 'Starter Diligence Room',
    'Orrick 3 territory. Diligence readiness is credibility through documentation: what you have written down is what you are believed to have done.',
    ['Assemble a diligence folder before it is requested',
      'Anticipate scientific, technical and financial diligence separately',
      'Spot your own red flags before an investor does'],
    ['Build the folder: incorporation, cap table, IP, contracts, key data, financials.',
      'Have someone outside the company try to answer five diligence questions from it alone.',
      'Fix what they could not find.']],

  ['fundraising-and-capital', 'investor-psychology', 'Investor psychology and signalling', 'reference', 45, 0, '',
    'What a term sheet, a pass, a slow no and a party round each actually signal — to you and to the next investor.',
    ['Read a pass for the information it contains',
      'Manage signalling risk from an existing investor not following on',
      'Know when a process is live and when you are being optioned'],
    ['Log every investor conversation with date, stage and next step.',
      'After each pass, write the real reason as best you can infer it.',
      'Look at the log monthly. The pattern is the feedback.']],

  /* --------------------------------------- legal, IP and regulatory */
  ['legal-ip-and-regulatory', 'company-formation', 'Orrick 1: Formation and startup foundations', 'workshop', 90, 2, 'Legal Checklist',
    'Delivered live by Orrick with office hours the same week. Incorporation, Delaware C-corps, founder agreements, vesting, cap tables, 83(b) elections and choosing counsel.',
    ['Incorporate correctly, in the right jurisdiction, at the right time',
      'File the 83(b) inside the 30-day window, which is unforgiving and unwindable',
      'Set founder vesting before there is anything to argue about',
      'Know when to engage counsel and how to use a legal budget efficiently'],
    ['Confirm incorporation state, share authorisation and founder allocations.',
      'File 83(b) elections and keep proof of mailing.',
      'Set vesting with a cliff on every founder including yourself.',
      'Bring anything unresolved to Orrick office hours this week.']],

  ['legal-ip-and-regulatory', 'ip-and-spinouts', 'Orrick 2: IP, academic spinouts and research commercialisation', 'workshop', 90, 6, 'Commercialization Pathway Plan',
    'Patents, provisional patents, trade secrets, publication timing, university IP, licensing, sponsored research agreements, freedom to operate and advisor agreements. Followed by founder-specific IP review.',
    ['Decide patent versus trade secret for each piece of your technology',
      'Time a publication so it does not destroy patentability',
      'Negotiate a university licence you can actually build a company on',
      'Run a freedom-to-operate check before you commit to a route'],
    ['Inventory every piece of IP and who owns it. Check your employment and student agreements.',
      'Map publication dates against filing dates. Any publication before a filing is a decision, so make it deliberately.',
      'If a university has a claim, get the licence terms in writing before the next raise.',
      'Book the IP review slot.']],

  ['legal-ip-and-regulatory', 'safes-and-mtas', 'Orrick 3: SAFEs, MTAs and negotiating agreements', 'workshop', 90, 0, 'Contract Checklist',
    'A line-by-line SAFE walkthrough, plus side letters, MTAs, NDAs, consulting and advisor agreements, term sheet fundamentals, and negotiating with pharma, corporates and universities. Includes live document review.',
    ['Read a SAFE line by line and know which lines matter',
      'Recognise contract red flags, and know when to push back and when not to',
      'Handle an MTA without giving away rights to what you make with the material'],
    ['Bring your actual documents to the session. It is worth several times more with one on the table.',
      'Build the contract checklist: what you sign, who reviews it, what never gets signed same-day.',
      'Note: the resident agreement grants 1% advisory equity post-programme — confirm the instrument with Orrick.']],

  ['legal-ip-and-regulatory', 'hiring-and-governance', 'Orrick 4: Hiring, governance and legal pitfalls', 'workshop', 90, 12, 'Investor Data Room',
    'Run in the high case and in week 11 or 12. Contractors versus employees, international hiring, firing abroad, advisor equity, seed-stage governance, compliance, and diligence readiness.',
    ['Classify contractors and employees correctly, which is a real liability',
      'Hire and end relationships internationally without creating an entity problem',
      'Set governance that protects founder control without alarming investors'],
    ['Audit every current contractor against the classification tests.',
      'Document advisor equity with a standard agreement and a vesting schedule.',
      'Assemble the investor data room from the starter diligence room.']],

  ['legal-ip-and-regulatory', 'regulatory-strategy', 'Validation, regulatory pathways and quality systems', 'workshop', 90, 10, 'Regulatory Strategy',
    'Sponsor-led with regulatory office hours. FDA fundamentals across diagnostics, therapeutics, devices and software as a medical device; reimbursement, regulatory milestones, GLP, GMP, GCP and documentation culture.',
    ['Identify your regulatory pathway and its first gating milestone',
      'Use a Q-submission to get the agency’s view before you commit',
      'Build documentation habits now that an audit will not punish later'],
    ['Write your intended use statement. Everything regulatory follows from it.',
      'Identify pathway, predicate if any, and the first submission.',
      'Start the design history file now, even if it is a folder and a naming convention.']],

  ['legal-ip-and-regulatory', 'biosafety-and-compliance', 'Biosafety, EHS and dual-use review', 'reference', 45, 0, '',
    'The documented risk assessment a landlord, an insurer and a customer will each eventually ask for — and which is much easier to write before you need it.',
    ['Complete a risk assessment a two-person lab can actually maintain',
      'Know what triggers institutional or dual-use review',
      'Handle export control on biological materials and equipment'],
    ['Write the risk assessment. Haus biosafety mentors will review it in office hours at no cost.',
      'Confirm your BSL level matches your actual practice, not your intention.',
      'Check export control before shipping anything across a border.']],

  /* ---------------------------------------------- team and operations */
  ['team-and-operations', 'first-hires', 'First hires and scientific hiring', 'playbook', 60, 0, 'Hiring Plan',
    'The first three hires set the culture whether or not you meant them to. In a wet lab they also set the safety practice.',
    ['Decide PhD versus engineer, specialist versus generalist, for the work you actually have',
      'Run a work trial that tells you something a interview cannot',
      'End a hire that is not working, early and decently'],
    ['Write the first three roles as outcomes, not titles.',
      'Design a paid work trial: real work, scoped to a day or two.',
      'Agree in advance what six weeks of not working looks like.']],

  ['team-and-operations', 'cofounders', 'Cofounders: alignment, conflict and breakups', 'playbook', 45, 0, '',
    'Founder breakups kill more early companies than technology does, and almost all of them were visible months earlier.',
    ['Have the equity, role and exit conversation before it is urgent',
      'Recognise the drift that precedes a breakup',
      'Structure vesting so a departure is survivable'],
    ['Write down each founder’s decision rights. Compare answers.',
      'Confirm vesting and acceleration terms are documented and signed.',
      'Agree how a departure would be handled, in writing, now.']],

  ['team-and-operations', 'lab-operations', 'Startup labs versus academic labs', 'playbook', 60, 0, '',
    'A startup lab optimises for repeatability under time pressure. An academic lab optimises for novelty. The equipment looks identical and almost nothing else is.',
    ['Set up an ELN and a documentation culture people will actually keep',
      'Choose a BSL pathway and build to it rather than around it',
      'Make an experiment repeatable by someone who did not run it'],
    ['Choose an ELN this week. Any of them beats a notebook nobody can search.',
      'Write one protocol so completely that a new hire could run it unaided. Then have them.',
      'Audit your freezer. Unlabelled samples are a liability, not an asset.']],

  ['team-and-operations', 'manufacturing-scaleup', 'Manufacturing, biomanufacturing and scale-up', 'workshop', 90, 9, 'Manufacturing Roadmap',
    'Sponsor-led. OEMs, RFQs, supplier qualification, DFM, DFT, sourcing, logistics, domestic and Shenzhen manufacturing, pilot plants, CMOs, CDMOs and tech transfer.',
    ['Write an RFQ that gets comparable quotes back',
      'Qualify a supplier before you depend on one',
      'Plan a tech transfer to a CDMO as a project, not an email'],
    ['Build the bill of materials at pilot scale and at commercial scale.',
      'Send the same RFQ to three suppliers. Compare on total landed cost.',
      'Write the tech transfer package as though you were leaving the company.']],

  ['team-and-operations', 'operating-cadence', 'Founder-operator systems and operating cadence', 'playbook', 45, 0, '',
    'The weekly loop that makes the other tracks compound: what got done, what is blocked, what must happen next week.',
    ['Run a weekly operating review in under an hour',
      'Track scientific and business milestones in one place without conflating them',
      'Use the cohort check-in as accountability rather than reporting'],
    ['Set the weekly review. Same time, same five questions.',
      'Keep one milestone tracker with both scientific and commercial rows.',
      'Answer the Sunday check-in honestly, especially the procrastination question.']],

  ['team-and-operations', 'founder-resources', 'Founder resources and arbitrage', 'reference', 30, 0, '',
    'Startup, software, cloud and lab credits, university resources, shared equipment and incubators. The programme issues this as a playbook to every resident.',
    ['Stack credit programmes without duplicating applications',
      'Use a core facility instead of buying an instrument',
      'Find the equipment you were about to buy inside the network'],
    ['Work the Perks page category by category. Claim the free tiers today.',
      'Search the Core Facility Finder before any instrument purchase over $10K.',
      'Check the Biolab Atlas for a lab in your city before signing a lease.']],

  /* ---------------------------------------- brand, network, founder life */
  ['brand-network-and-life', 'credibility-stack', 'The scientific credibility stack', 'workshop', 90, 0, 'Scientific Credibility Map',
    'Publications, patents, grants, advisors, LOIs, pilots, validation studies, regulatory milestones, media and community reputation — and which audience trusts which.',
    ['Map which credibility signal each audience actually reads',
      'Build the cheapest signal that moves your specific blocker',
      'Avoid stacking signals that impress only your peers'],
    ['List your current credibility assets honestly.',
      'For each audience — investor, customer, regulator, recruit, journalist — name the one signal that would move them.',
      'Build the cheapest missing one this quarter.']],

  ['brand-network-and-life', 'scientific-communication', 'Explaining science to people who are not scientists', 'workshop', 60, 11, '2-minute explanation',
    'Delivered alongside Orrick 3 in week 11 and again in demo day preparation. Investors, customers, journalists, policymakers and patients each need a different version, and none of them need the abstract.',
    ['Explain your science in two minutes without analogy collapse',
      'Adapt the same explanation across five audiences',
      'Answer a hostile technical question without becoming defensive'],
    ['Write the two-minute version. Deliver it to someone outside biology.',
      'Write the thirty-second version. Then the one-sentence version.',
      'Have a scientist try to break it. Fix what breaks.']],

  ['brand-network-and-life', 'demo-day', 'Demo day preparation and pitch review', 'workshop', 120, 12, 'Demo Day Pitch',
    'Week 12. Pitch review, investor feedback, narrative refinement, Q&A preparation and media training, then the Final Showcase.',
    ['Deliver a pitch that holds a room that does not know your field',
      'Handle the Q&A, which is where the round is actually won or lost',
      'Follow up after demo day in a way that converts interest into capital'],
    ['Present to the cohort first. Take the hits there.',
      'Prepare the five questions you least want to be asked. Answer each in two sentences.',
      'Write the follow-up email before demo day, not after.']],

  ['brand-network-and-life', 'press-and-media', 'Press, personal brand and building in public', 'playbook', 45, 0, '',
    'When press matters — recruiting, fundraising, customers — and when it is a distraction dressed as progress.',
    ['Decide whether you need press at all this quarter',
      'Pitch a journalist without a press release',
      'Build in public without becoming a content creator'],
    ['Name what press would unlock. If you cannot, skip this module.',
      'Identify three journalists who have covered your specific area, not your sector.',
      'Send one, one paragraph, with a specific reason it is interesting now.']],

  ['brand-network-and-life', 'relationship-systems', 'Mentor networks and the personal board', 'playbook', 45, 0, '',
    'Relationship mapping, maintaining weak ties, giving before asking, and building a personal board of directors that is not your cap table.',
    ['Assemble five people you can ask a hard question without consequence',
      'Maintain weak ties at a sustainable cost',
      'Give before asking, consistently enough that it is not a tactic'],
    ['Name your five. If any seat is empty, find it in the mentor directory.',
      'Book one office-hours slot this week with someone outside your discipline.',
      'Do one unprompted useful thing for someone in the cohort.']],

  ['brand-network-and-life', 'community-building', 'Community as a moat', 'reference', 30, 0, '',
    'Building communities around ideas, convening people, and movement building — the thing this network is itself an instance of.',
    ['Convene people around a problem rather than a product',
      'Understand why a closed room produces different information from an open one',
      'Turn a community into a durable advantage rather than a marketing channel'],
    ['Host one thing. A dinner counts.',
      'Write down what you learned that you would not have learned otherwise.',
      'Post it in the forum. That is the loop.']],
];

export const LIBRARY_MODULES = MODULES.map(
  ([track, slug, title, kind, minutes, week, deliverable, summary, outcomes, work]) => ({
    track, slug, title, kind, minutes, week, deliverable, summary, outcomes, work,
  }),
);

/**
 * The delivered S26 sequence, kept as the reference schedule. Sixteen workshops
 * plus orientation and the Orrick series, Mondays and Wednesdays 6:30–8:00pm PT,
 * 29 June to 19 August. Straight from the S26 Programming Calendar.
 */
export const S26_SEQUENCE = [
  ['Jun 25', 'Resident orientation', 'Program expectations, community norms, founder introductions, resources and ecosystem map, office hours structure, goal-setting, accountability'],
  ['Jun 26', 'Orrick 1: Company formation and startup foundations', 'Incorporation, Delaware C-corps, founder agreements, vesting, cap tables, 83(b), entity selection, choosing counsel'],
  ['Jun 29', 'Workshop 1: Technical risk, market risk and commercialization', 'Risk mapping, beachhead markets, design partners, sequencing technical milestones'],
  ['Jul 1', 'Workshop 2: Scientific credibility stack', 'Publications, patents, grants, advisors, LOIs, pilots, validation, signalling'],
  ['Jul 6', 'Workshop 3: Customer discovery for scientists', 'Interviews, design partners, translating science into value, segmentation'],
  ['Jul 8', 'Workshop 4: Founder-led sales for scientists', 'Technical sales, stakeholder mapping, procurement, pilot-to-contract'],
  ['Jul 13', 'Workshop 5: Raising on an idea', 'Milestone fundraising, investor psychology, pre-product and pre-revenue raising'],
  ['Jul 15', 'Workshop 6: Venture capital, fund economics and fundraising strategy', 'Dilution, ownership targets, SAFEs, valuation, leads, syndicates, board dynamics'],
  ['Jul 20', 'Orrick 2: IP, academic spinouts and research commercialization', 'Patents, publication timing, university IP, licensing, FTO, advisor agreements'],
  ['Jul 22', 'Workshop 8: AI founder stack', 'AI tooling, founder workflows, automation, agents, research acceleration'],
  ['Jul 27', 'Workshop 9: Grants and non-dilutive capital', 'SBIR, STTR, NIH, NSF, ARPA-H, DoD, DOE, grant strategy and timing'],
  ['Jul 29', 'Workshop 10: Validation, regulatory, quality systems and compliance', 'FDA pathways, reimbursement, GLP, GMP, GCP, documentation'],
  ['Aug 3', 'Workshop 11: Manufacturing and biomanufacturing scale-up', 'OEMs, RFQs, DFM, sourcing, pilot plants, CMOs, CDMOs, tech transfer'],
  ['Aug 5', 'Orrick 3: SAFEs, MTAs and negotiating agreements', 'SAFE walkthrough, side letters, MTAs, NDAs, term sheets, contract red flags'],
  ['Aug 10', 'Workshop 13: Founder judgment, scientific communication and demo day prep', 'Prioritisation, decision-making under uncertainty, communicating science, storytelling'],
  ['Aug 12', 'Workshop 14: Demo day workshop, pitch reviews and media training', 'Pitch review, investor feedback, narrative refinement, Q&A preparation'],
  ['Aug 15', 'Biopunk Showcase', 'The cohort presents'],
  ['Aug 17', 'Orrick 4: Scaling, hiring and founder legal pitfalls', 'Recruiting scientists, compensation, advisor equity, contractors, O-1, governance, data rooms'],
  ['Aug 19', 'Flex session', 'Closing a round, post-demo-day follow-up, O-1 deep dive, media strategy, banking, accounting, cap table management, cloud credits'],
];
