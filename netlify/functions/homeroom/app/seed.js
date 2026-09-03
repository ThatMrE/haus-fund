/**
 * Sample content for Homeroom.
 *
 * FICTIONAL DEMO DATA. The labs, funders, deals, reviews and people below are
 * invented for local development — no real vendor, fund or person is described,
 * and the discount codes are nonsense. Runs after the news seed, on the handles
 * that seed already created.
 */

import { getDb } from './db.js';
import { nowSeconds } from './util.js';
import { hashPassword } from './auth.js';
import * as bf from './models.js';
import { PERKS } from './data/perks.js';
// Aliased: this file already has fictional FUNDERS/LIBRARY constants of its own,
// and the researched data sets are a different thing entirely.
import { FUNDERS as CAPITAL_MAP } from './data/funders.js';
import { ATLAS_LABS } from './data/atlas.js';
import { MENTORS as MENTOR_ROSTER } from './data/mentors.js';
import { NETWORK_MENTORS } from './data/network.js';
import { TRACKS, LIBRARY_MODULES } from './data/curriculum.js';

const HOUR = 3600;
const DAY = 86400;

/** Shared by every sample account. Documented, and useless once they are gone. */
export const SAMPLE_PASSWORD = 'homeroom-sample-pass';

const SAMPLE_TABLES = [
  'hr_updates', 'hr_org_members', 'hr_orgs', 'hr_deal_claims',
  'hr_deals', 'hr_review_votes', 'hr_review_comments', 'hr_funder_reviews', 'hr_pipeline',
  'hr_funders', 'hr_bookings', 'hr_slots', 'hr_mentors',
  'hr_applications', 'hr_jobs', 'hr_rsvps', 'hr_event_sources', 'hr_events', 'hr_library',
  'hr_progress', 'hr_modules', 'hr_tracks', 'hr_intros',
  'hr_signatures', 'hr_yearbook', 'hr_atlas_reports', 'hr_atlas', 'hr_news_submissions',
  'hr_messages', 'hr_thread_members', 'hr_threads', 'hr_notifications', 'hr_expertise', 'hr_members',
];

/**
 * Founder-wall entries for the sample members.
 *
 * [handle, cohort, house, venture, one-liner, quote, building, before]
 */
const YEARBOOK = [
  ['helix_witch', 'S25', 'Punkhaus', 'Cultura Aberta',
    'A community lab in Lisbon that gets forty people through their first transformation.',
    'The institution was never the point. The bench was.',
    'Standing up a public wet lab without a university behind it: the lease, the insurance, the waste contract, and the conversation with the landlord that decides everything.',
    'Six years of molecular biology inside an institute that would not let the public through the door.'],
  ['pipette_punk', 'W25', 'Punkhaus', 'Openbench',
    'Open-hardware wet lab instruments a school can actually solder.',
    'If the BOM is not public, it is not a tool. It is a subscription.',
    'A thermocycler bill of materials under €150, and the thermal design work that makes the ramp rate honest.',
    'Hardware engineering in industrial automation, then two years reverse-engineering lab kit for fun.'],
  ['crispr_kid', 'S26', 'Punkhaus', 'Off-target',
    'A cheap off-target assay that does not need a sequencing core.',
    'Everyone cites the off-target rate. Almost nobody measures their own.',
    'Base editing with an honest off-target readout, at a cost a two-person company can run weekly.',
    'Mid-PhD, and increasingly convinced the assay is the product.'],
  ['ferment_or_die', 'S25', 'Femhaus', 'Loam Foods',
    'Single-cell protein that does not taste like a compromise.',
    'Scale-up is where the strain finds out what you actually selected for.',
    'Getting a food-grade single-cell protein from 5L to 500L without losing the strain or the flavour.',
    'Process engineering at a dairy CMO, which taught me more about food than any lab did.'],
  ['mycelium_max', 'W26', 'Punkhaus', 'Hyphae Works',
    'Mycelium composite panels that pass a commercial fire rating.',
    'Growing the material is the easy part. The notified body is the hard part.',
    'Fungal composites for interiors, and the EN 13501 certification path that decides whether any of it ships.',
    'Furniture design, then four years of contamination at increasing scale.'],
  ['garage_genome', 'W26', 'Safehaus', 'Kitchen Sequencing Club',
    'Metagenomics on a laptop and a €700 sequencer.',
    'The sequencer got cheap. Everything around it did not. That gap is the work.',
    'A nanopore metagenomics workflow that runs without a cluster, and the reagent logistics for places couriers dislike.',
    'Bioinformatics contracting, and a long argument with the price of flow cells.'],
  ['biosafety_bee', 'S24', 'Safehaus', 'Independent',
    'A risk assessment a two-person lab can actually complete.',
    'Containment is not paperwork. The paperwork is how you prove you meant it.',
    'Biosafety, dual-use review and export control for companies too small to have an officer.',
    'Institutional biosafety officer for eleven years, which is where the templates come from.'],
  ['open_assay', 'W25', 'Pharmhaus', 'Openbench',
    'A cell-free kit that survives a courier in August.',
    'A protocol nobody else can repeat is a hobby.',
    'Assay validation and lyophilisation, so an open protocol still works when it arrives somewhere hot.',
    'Assay development in diagnostics, and a growing intolerance for methods sections.'],
  ['wetware_ann', 'S24', 'Femhaus', 'Kowalczyk Group',
    'Cortical organoids with vasculature that survives past week twelve.',
    'The ethics section is not an obstacle. It is the part where you say what you are actually doing.',
    'Vascularised cortical organoids, and IRB submissions for human-derived material that do not get bounced.',
    'Principal investigator, still is, and unconvinced those are separate careers.'],
  ['plasmid_mule', 'S26', 'Punkhaus', 'Independent',
    'Taking six-week cloning backlogs off other people’s hands.',
    'Somebody has to do the cloning. It may as well be someone who is fast.',
    'Contract molecular biology, and the MTAs and customs paperwork that move constructs across borders.',
    'Ten years at the bench in three countries, and a strong view on shipping conditions.'],
];

const MEMBERS = [
  ['helix_witch', 'Nadia Ferrer', 'Runs a community lab in Lisbon. Yeast, plasmids, and a deep dislike of paywalls.',
    'Cultura Aberta', 'Organiser', 'S25', 'Lisbon, PT', 'BSL-1',
    ['cloning', 'diybio-outreach', 'lab-buildout', 'biosafety'],
    'Getting forty people through a first transformation without an institution behind us.',
    'Standing up a community lab from an empty room: leases, insurance, waste contracts, and the conversation with the landlord.'],
  ['pipette_punk', 'Ilya Brandt', 'Open hardware for wet labs. Everything I make is CERN-OHL.',
    'Openbench', 'Founder', 'W25', 'Berlin, DE', 'BSL-1',
    ['microfluidics', 'bioreactors', 'lab-buildout'],
    'A thermocycler bill of materials under €150 that a school can actually solder.',
    'Sourcing Peltier stacks, thermal design, why your ramp rate lies, and CE marking as a small outfit.'],
  ['crispr_kid', 'Tomás Oyelaran', 'Base editors and off-target analysis. Grad student, unreasonable hours.',
    'Marek Lab', 'PhD student', 'S26', 'Cambridge, UK', 'BSL-2',
    ['crispr', 'ngs', 'ml-for-bio'],
    'A cheap off-target assay that does not need a sequencing core.',
    'Base editing, GUIDE-seq alternatives, and reading an off-target paper sceptically.'],
  ['wetware_ann', 'Ann Kowalczyk', 'Organoids and the ethics thereof.',
    'Kowalczyk Group', 'Principal investigator', 'S24', 'Kraków, PL', 'BSL-2',
    ['cell-culture', 'microscopy', 'irb'],
    'Cortical organoids with vasculature that survives past week twelve.',
    'IRB submissions for human-derived material, and how to write an ethics section that does not get bounced.'],
  ['garage_genome', 'Sam Oduya', 'Sequencing things that should not be sequenced. Kitchen, not cleanroom.',
    'Kitchen Sequencing Club', 'Solo', 'W26', 'Nairobi, KE', 'BSL-1',
    ['nanopore', 'metagenomics', 'freezer-ops'],
    'A metagenomics workflow that runs on a laptop and a €700 sequencer.',
    'Nanopore on a shoestring, flow cell economics, and shipping reagents to places couriers dislike.'],
  ['ferment_or_die', 'Bea Lindqvist', 'Precision fermentation, mostly for food.',
    'Loam Foods', 'CEO', 'S25', 'Malmö, SE', 'BSL-1',
    ['fermentation', 'bioreactors', 'sbir', 'fundraising'],
    'Getting a single-cell protein from 5L to 500L without losing the strain.',
    'Scale-up, foam control, CMO contracts, and what a food-grade audit actually asks for.'],
  ['biosafety_bee', 'Priya Raghavan', 'Biosafety officer by day. I flag things so you do not have to.',
    'Independent', 'Consultant', 'S24', 'Toronto, CA', 'BSL-3',
    ['biosafety', 'export-control', 'irb'],
    'A risk-assessment template a two-person lab can actually complete.',
    'Containment, dual-use review, export control, and how to say no to a collaborator gracefully.'],
  ['open_assay', 'Marcus Ilundáin', 'Assay development, open protocols, reproducibility crank.',
    'Openbench', 'Head of science', 'W25', 'Valencia, ES', 'BSL-1',
    ['protein-expression', 'mass-spec', 'cell-culture'],
    'A cell-free kit that survives a courier in August.',
    'Assay validation, lyophilisation, and writing a protocol someone else can repeat.'],
  ['mycelium_max', 'Max Trần', 'Fungal materials. Growing furniture, slowly.',
    'Hyphae Works', 'Founder', 'W26', 'Rotterdam, NL', 'BSL-1',
    ['fermentation', 'plant-bio', 'grant-writing'],
    'Mycelium composite panels that pass a commercial fire rating.',
    'Substrate sourcing, contamination at scale, and EU material certification.'],
  ['plasmid_mule', 'Jo Whitlock', 'Freelance molecular biologist for hire.',
    'Independent', 'Contractor', 'S26', 'Remote', 'BSL-1',
    ['cloning', 'protein-expression', 'mta'],
    'Taking six-week cloning backlogs off other people’s hands.',
    'MTAs, contracting rates, and getting constructs across borders without a customs hold.'],
];

const ORGS = [
  ['Cultura Aberta', 'A community lab in Lisbon, open four evenings a week.', 'communitylab', 'bench',
    'Lisbon, PT', 'https://example.org/cultura-aberta', 'S25', 2023, 6, 'community-lab,education,yeast', 'helix_witch',
    'Forty members, two incubators, one very tired autoclave. We teach a twelve-week practical course, host visiting projects, and keep a shared freezer that other Lisbon groups can rent space in. Everything we write up goes out under CC-BY.'],
  ['Openbench', 'Open-source lab hardware, sold as kits and given away as files.', 'startup', 'revenue',
    'Berlin, DE', 'https://example.org/openbench', 'W25', 2024, 5, 'hardware,open-source,kits', 'pipette_punk',
    'We design bench instruments — thermocyclers, plate readers, a turbidostat — publish every file under CERN-OHL, and sell assembled kits to people who would rather not solder. Kits pay for the design work. The design work is the point.'],
  ['Loam Foods', 'Single-cell protein from agricultural side streams.', 'startup', 'preclinical',
    'Malmö, SE', 'https://example.org/loam', 'S25', 2024, 9, 'fermentation,food,scale-up', 'ferment_or_die',
    'We ferment a food-grade strain on beet processing waste. Pilot runs at 500L, target cost under €3/kg dry. Currently working through a novel food dossier, which is slower than the science.'],
  ['Hyphae Works', 'Mycelium composites for building interiors.', 'startup', 'prototype',
    'Rotterdam, NL', null, 'W26', 2025, 3, 'materials,fungi,circular', 'mycelium_max',
    'Panels grown on hemp hurd and spent grain, pressed and heat-killed. Fire rating is the whole battle; everything else is logistics.'],
  ['Kitchen Sequencing Club', 'A distributed group doing environmental metagenomics on almost no money.', 'collective',
    'bench', 'Nairobi, KE', null, 'W26', 2025, 4, 'metagenomics,nanopore,open-data', 'garage_genome',
    'Nine people across four cities, one shared sequencing budget, and a standing rule that every dataset goes public within thirty days.'],
  ['Kowalczyk Group', 'Academic lab working on vascularised cortical organoids.', 'academic', 'preclinical',
    'Kraków, PL', null, 'S24', 2019, 11, 'organoids,neuro,ethics', 'wetware_ann',
    'Eleven people, two of whom are ethicists, which is deliberate. We publish protocols before results.'],
];

const POSTS = [
  ['helix_witch', 'question', 'space', 'What does a community lab actually pay for insurance in the EU?',
    'We are quoted €4,200/yr for public liability plus contents at BSL-1, forty members, one autoclave. That feels high but I have nothing to compare it to. If you run a space in the EU: what are you paying, what is covered, and did anyone underwrite you without an institutional parent?',
    ['insurance', 'community-lab', 'eu'], 34, 6 * HOUR, false],
  ['ferment_or_die', 'question', 'wetlab', 'Foam control at 500L without antifoam ruining downstream',
    'Silicone antifoam is wrecking our membrane filtration downstream. Mechanical foam breaker on the 500L is not keeping up above 0.6 vvm. Has anyone gone to a rotating disc breaker at this scale, and did it actually earn its footprint?',
    ['fermentation', 'scale-up'], 41, 20 * HOUR, false],
  ['plasmid_mule', 'question', 'regulatory', 'Shipping plasmids into Brazil — who has done it recently?',
    'Two shipments held at customs in the last four months, both released eventually, both after five weeks. I am now quoting clients timelines I cannot keep. If you have moved DNA into Brazil in the past year: which courier, what paperwork, and did a local importer of record help?',
    ['shipping', 'customs', 'mta'], 28, 2 * DAY, false],
  ['biosafety_bee', 'discussion', 'biosafety', 'The risk assessment template I wish someone had given me',
    'Most templates are written for institutions with a committee. Here is a one-page version for a two-person lab: agent, route, worst credible outcome, control, residual risk, who says no. Tear it apart — I would rather it be right than mine.',
    ['biosafety', 'templates'], 62, 3 * DAY, false],
  ['pipette_punk', 'show', 'hardware', 'Show: thermocycler mk3, €148 BOM, 3.1 °C/s ramp',
    'Third revision. Peltier stack is now two stages, the lid heater is a resistive film instead of a cartridge, and the firmware does proper PID with feed-forward on the ramp. Files are up. What I want from you: tell me where the thermal design is wrong before a school buys forty of them.',
    ['hardware', 'open-source'], 88, 4 * DAY, false],
  ['crispr_kid', 'question', 'dry', 'Cheapest defensible off-target assay in 2026?',
    'No sequencing core, £3k of budget, need something a reviewer will accept. CHANGE-seq is out on cost. Is amplicon panel plus rhAmpSeq enough these days, or will I get asked for genome-wide?',
    ['crispr', 'ngs'], 37, 5 * DAY, false],
  ['garage_genome', 'discussion', 'funding', 'Grants that will fund a collective with no legal entity',
    'We are nine people and a shared bank account. Every grant portal wants a registered organisation. Who has found funders that will pay a fiscal sponsor, or an individual, and actually released the money?',
    ['grants', 'fiscal-sponsor'], 45, 6 * DAY, false],
  ['open_assay', 'question', 'wetlab', 'Lyophilised cell-free: what is your actual shelf life at 40 °C?',
    'Trehalose plus a sucrose bulking agent gets us six weeks at 40 °C with 70% activity retained. Published numbers are better than ours and I do not believe all of them. What are you seeing in a real courier, not a stability chamber?',
    ['cell-free', 'lyophilisation'], 33, 7 * DAY, false],
  ['wetware_ann', 'discussion', 'life', 'The middle of a PhD is a management problem, not a science one',
    'Three of my students hit the same wall at month eighteen and I keep giving the same speech. Writing it down here in case it is useful, and because I would like to hear how other PIs handle it without being condescending about it.',
    ['founder-life', 'mentoring'], 57, 8 * DAY, false],
  ['mycelium_max', 'intro', 'intros', 'Looking for anyone who has taken a material through EN 13501 fire testing',
    'We have a panel that passes internal testing and a notified body quoting €18k and four months. Before I sign that, I would like twenty minutes with someone who has been through it. Happy to trade everything I know about substrate contamination at 200L.',
    ['materials', 'certification'], 22, 9 * DAY, false],
  ['ferment_or_die', 'poll', 'funding', 'Poll: how long did your last raise actually take, first meeting to wire?',
    'Every founder I talk to says "six weeks" and then it is five months. Let us get a real distribution.',
    ['fundraising'], 51, 10 * DAY, false],
  ['helix_witch', 'announce', 'general', 'Cultura Aberta is opening its freezer to other Lisbon groups',
    'We have -80 capacity we are not using. €25/month per shelf, you get a key and a slot on the shared inventory. Three groups already signed up. If you are in Lisbon and paying for storage you barely use, stop.',
    ['community-lab', 'freezer'], 29, 11 * DAY, false],
  ['plasmid_mule', 'question', 'hiring', 'What do freelance molecular biologists charge in Europe right now?',
    'I have been quoting €55/hr and I suspect I am well under. Anonymous replies welcome — this is the number nobody publishes.',
    ['contracting', 'rates'], 44, 12 * DAY, true],
  ['crispr_kid', 'question', 'legal', 'Do I need an MTA for a plasmid I made from parts that were all Addgene?',
    'The parts came with different licences. Two are academic-only. My supervisor says do not worry about it, which is exactly the sentence that ends up in a deposition.',
    ['mta', 'ip'], 31, 13 * DAY, false],
  ['biosafety_bee', 'discussion', 'biosafety', 'A short list of things I will not help you with',
    'People ask me for review and occasionally for cover. Here is where the line is, why it is there, and what I will happily help with instead. Nothing in this thread should be read as an invitation to negotiate it.',
    ['biosafety', 'norms'], 73, 14 * DAY, false],
];

const POLL_OPTIONS = ['Under 6 weeks', '6–12 weeks', '3–5 months', 'Over 5 months', 'Still going'];

const REPLIES = [
  ['biosafety_bee', 'We pay €3,100 for a comparable setup in Ontario, but the autoclave is what moves the number — ours is inspected annually and that inspection is written into the policy. Ask them to quote with and without it.'],
  ['pipette_punk', 'Berlin, 30 members, BSL-1: €2,800. The broker who found it specialises in makerspaces, not labs, which turned out to matter more than the biology.'],
  ['open_assay', 'Rotating disc breaker earned it for us at 300L, but only after we dropped to 0.45 vvm and accepted the longer batch. The footprint is real and so is the cleaning time.'],
  ['ferment_or_die', 'That matches what our CMO said. We are going to try the lower sparge rate first because it costs nothing to test.'],
  ['garage_genome', 'Brazil: DHL Medical Express, importer of record was a local university contact, three days. Without the IOR it was five weeks both times. The paperwork is not the bottleneck, the local counterparty is.'],
  ['plasmid_mule', 'That is the answer I did not want and needed. Thank you.'],
  ['wetware_ann', 'The "who says no" row is the one every institutional template leaves out and it is the only row that matters at 11pm on a Friday.'],
  ['helix_witch', 'Stealing this for our onboarding. Will send back edits rather than a fork.'],
  ['open_assay', 'Your lid heater will be the failure point at forty units. Resistive film delaminates when the adhesive sees 110 °C repeatedly — we lost six that way. Spec the adhesive, not the film.'],
  ['crispr_kid', 'Ramp rate on the datasheet is with an empty block. Publish yours with 96 filled wells or a school will measure it and be upset.'],
  ['biosafety_bee', 'Amplicon panel plus a good rhAmpSeq design has cleared review for two groups I know this year, both with a stated limitation. Reviewers ask for genome-wide when the claim is therapeutic. Match the assay to your claim and say so explicitly.'],
  ['garage_genome', 'Fiscal sponsor worked for us — a registered nonprofit takes 7% and signs as the grantee. Two funders released money, one refused on principle. Ask before you write.'],
  ['mycelium_max', 'Six weeks at 40 °C with 70% retained is honestly good. The published numbers I have tried to reproduce were stability chamber data with a sealed foil pouch, not a van in August.'],
  ['helix_witch', 'Month eighteen is when the project stops being someone else’s idea and has not yet become theirs. The speech that works for us is about scope, not resilience.'],
  ['ferment_or_die', 'We went through EN 13501 for a different material. €18k and four months is the going rate and the four months is optimistic. Book the slot before your sample is ready.'],
  ['plasmid_mule', '€75–95/hr in Western Europe for anything requiring a named person on a report. You are under.'],
  ['open_assay', 'Anonymous because of who I work for: we pay contractors €80/hr and consider it cheap.'],
  ['biosafety_bee', 'Academic-only means academic-only. If the resulting construct is used commercially you need permission from every upstream depositor, and "my supervisor said" is not a defence anyone has ever won with.'],
  ['wetware_ann', 'Thank you for writing this down. It should be pinned.'],
  ['crispr_kid', 'Agreed on all of it, and the last line especially.'],
];

const DEALS = [
  ['Helvex Reagents', '30% off enzymes and buffers, no minimum order', 'reagents', '~€2,400/yr',
    'BIOPUNK-HLX-30', 'https://example.com/helvex/biopunk',
    'Applies to the full catalogue except custom synthesis. Ships from Utrecht; three-day delivery across the EU, ten days elsewhere.'],
  ['Sonder Sequencing', 'Whole genome at €19/sample for the first 200 samples', 'sequencing', '€3,800 saved',
    'BPC-SONDER-200', 'https://example.com/sonder',
    'Illumina short read, 30x, 10-day turnaround. Community labs get the same price as startups, which is the point of the deal.'],
  ['Codon Foundry', '50 kb of free DNA synthesis, then 25% off', 'synthesis', '€5,000 credit',
    'FOUNDRY-BP-50K', 'https://example.com/codonfoundry',
    'Screened against the standard biosecurity baseline before synthesis; some sequences will be refused and that is deliberate.'],
  ['Remote Bench', '€4,000 of cloud lab credit', 'cloudlab', '€4,000 credit',
    'REMOTEBENCH-BIOPUNK', 'https://example.com/remotebench',
    'Liquid handling, plate reading and imaging. Credit expires twelve months after activation.'],
  ['Northwind Compute', '$5,000 GPU credit for protein and sequence models', 'compute', '$5,000 credit',
    'NW-BIOPUNK-5K', 'https://example.com/northwind',
    'A100 and H100 pools. No expiry, but unused credit does not transfer between organisations.'],
  ['Second Bench', '20% off refurbished lab equipment plus free freight in the EU', 'equipment', '15–25% per order',
    'SECONDBENCH-BP', 'https://example.com/secondbench',
    'Centrifuges, incubators, biosafety cabinets. Twelve-month warranty on anything over €2,000.'],
  ['Meridian Legal', 'Fixed-fee incorporation and a free MTA review', 'services', '€1,800 saved',
    'MERIDIAN-BIOPUNK', 'https://example.com/meridian',
    'Covers NL, DE, PT and EE incorporation. The MTA review is one document, not a retainer.'],
  ['Benchbook', 'Free electronic lab notebook for teams under ten', 'software', '€1,200/yr',
    'BENCHBOOK-COMMUNITY', 'https://example.com/benchbook',
    'Full export to plain files at any time, which is the only reason we listed it.'],
];

const FUNDERS = [
  ['Trellis Bio', 'vc', 'Tooling, instruments, biomanufacturing', 'pre-seed, seed', '€250k–1.5M', 'Amsterdam, NL',
    'https://example.com/trellis', true, 'Small fund, two partners, both ex-bench. Known for fast noes.'],
  ['Cold Chain Capital', 'vc', 'Therapeutics and platform biology', 'seed, series A', '$2M–8M', 'Boston, US',
    'https://example.com/coldchain', true, 'Large fund. Long diligence, deep technical bench.'],
  ['Substrate Fund', 'vc', 'Food, materials, fermentation', 'pre-seed', '€100k–500k', 'Copenhagen, DK',
    'https://example.com/substrate', true, 'Writes the first cheque and helps with the second.'],
  ['Open Science Foundation Grants', 'foundation', 'Open tools, reproducibility, community infrastructure',
    'any', '€20k–150k', 'Geneva, CH', 'https://example.com/osfg', false,
    'Non-dilutive. Requires everything funded to be published openly, enforced in the grant agreement.'],
  ['EU BioForward', 'grant', 'Biomanufacturing scale-up within the EU', 'seed, growth', '€200k–2M', 'Brussels, BE',
    'https://example.com/bioforward', false, 'Heavy paperwork, real money, eighteen-month cycle.'],
  ['Ferment Prize', 'prize', 'Precision fermentation for food', 'any', '€75k', 'Remote',
    'https://example.com/fermentprize', false, 'Annual, no equity, one page to apply.'],
  ['Sandra Voss', 'angel', 'Anything with a bench', 'pre-seed', '€25k–100k', 'Zurich, CH', null, true,
    'Former founder. Answers email within a day.'],
  ['Hyphal Collective', 'dao', 'Community labs and open hardware', 'any', '€5k–60k', 'Remote',
    'https://example.com/hyphal', false, 'Member-voted grants, monthly cycle, minimal reporting.'],
];

const REVIEWS = [
  ['Trellis Bio', 'ferment_or_die', 5, 5, 4, true, false,
    'Two meetings, term sheet in nine days, and the partner had read the actual patent application. Passed on our follow-on with a clear reason. I would take their money again.'],
  ['Trellis Bio', 'pipette_punk', 4, 5, 3, false, true,
    'Fast, honest no. Told me on the call why hardware margins scared them rather than ghosting. That is worth a lot.'],
  ['Cold Chain Capital', 'wetware_ann', 2, 1, 3, false, true,
    'Fourteen weeks, four calls, two of which were with associates who had not read the deck, then a pass on "stage". Ask them upfront what their minimum traction is and hold them to the answer.'],
  ['Cold Chain Capital', 'crispr_kid', 3, 2, 5, true, true,
    'Slow, and I nearly walked. But after the wire they made three introductions that mattered and one of them became our CSO. Mixed, and I would still do it.'],
  ['Substrate Fund', 'mycelium_max', 5, 4, 5, true, false,
    'They funded us before we had a panel that worked. Monthly check-ins are optional and they mean it.'],
  ['Open Science Foundation Grants', 'helix_witch', 5, 3, 4, true, false,
    'Sixteen weeks from application to money, which for non-dilutive is fine. The open-publication requirement is real and enforced; do not apply if you plan to file first.'],
  ['EU BioForward', 'ferment_or_die', 3, 1, 3, true, true,
    'The money is real. The paperwork consumed roughly a quarter of one person for six months. Budget for that or do not apply.'],
  ['Sandra Voss', 'garage_genome', 5, 5, 4, true, false,
    'Replied in four hours, wired in a week, has never once asked for a board seat. The bar.'],
  ['Hyphal Collective', 'helix_witch', 4, 4, 3, true, false,
    'Small cheques, fast, and the reporting is a paragraph. Good for equipment. Not a substitute for a grant.'],
  ['Ferment Prize', 'mycelium_max', 4, 3, 2, false, true,
    'One page to apply, so the expected value is good even when you lose. No feedback on rejection, which is the only complaint.'],
];

const LIBRARY = [
  ['Standing up a community lab: the boring twelve months', 'guide',
    'Leases, insurance, waste, autoclave validation and the landlord conversation — in the order they actually happen.',
    `Most guides to starting a community lab talk about the science. The science is the easy part.\n\nThe order that works: find the space before the members, get the waste contract before the equipment, and get insurance quotes before you sign anything, because the quote depends on the lease and the lease is hard to change.\n\nWaste is the item people forget. A licensed clinical waste contractor will want a site visit, a named responsible person and a minimum monthly volume you almost certainly will not hit in year one. Negotiate the minimum down rather than the rate.\n\nAutoclave validation matters more than autoclave purchase. A second-hand unit with a current validation certificate is worth more than a newer one without.\n\nThe landlord conversation goes better if you bring the risk assessment with you. Say BSL-1 out loud, explain what it means in terms of what could leave the room, and offer the fire service a walkthrough. Nobody has ever refused that offer.`,
    'community-lab,operations,biosafety', 'helix_witch'],
  ['Off-target analysis on a £3,000 budget', 'guide',
    'What a reviewer will accept, what they will not, and how to phrase the limitation.',
    `Genome-wide methods are the gold standard and are out of reach on a small budget. That does not mean you cannot publish.\n\nMatch the assay to the claim. If your claim is "this edit works in this cell line", a well-designed amplicon panel across predicted sites plus an unbiased spot check is defensible. If your claim touches therapeutic use, you need genome-wide and no amount of phrasing will substitute.\n\nDesign the panel from at least two prediction tools, not one, and include the sites they disagree on — those are the interesting ones.\n\nState the limitation in the methods, not just the discussion, in one sentence: "Off-target analysis was limited to N predicted sites; genome-wide unbiased detection was not performed." Reviewers object to hidden limitations far more than to stated ones.`,
    'crispr,ngs,publishing', 'crispr_kid'],
  ['A one-page risk assessment for a two-person lab', 'template',
    'Agent, route, worst credible outcome, control, residual risk, and who says no.',
    `Institutional templates assume a committee. Here is the version that fits on one page.\n\nFor each procedure, six columns. Agent or material. Route of exposure. Worst credible outcome — not worst imaginable, credible. Control that reduces it. Residual risk after the control. And the name of the person who can stop the work.\n\nThe last column is the one institutional templates omit and it is the one that matters. If nobody is named, nobody stops anything.\n\nReview it when the procedure changes, when someone new joins, or every twelve months, whichever comes first. Keep the old versions; the diff is the useful artefact.\n\nThis template covers BSL-1 work and low-risk BSL-2. It is not sufficient for anything on a control list, and if you are unsure whether your work is on one, that uncertainty is itself the finding.`,
    'biosafety,templates,operations', 'biosafety_bee'],
  ['Reading a term sheet when you have never seen one', 'essay',
    'The four terms that decide everything, and the twenty that do not.',
    `Liquidation preference, board composition, option pool timing, and pro-rata. Those four decide what happens to you. Almost everything else is noise you should not spend a lawyer's hours on.\n\nOption pool timing is the one that gets first-time founders. A pool created pre-money is paid for entirely by you. Ask for it post-money, accept a smaller pool if you must, and know that the argument is about your dilution and not about hiring.\n\nBoard composition at seed should not give investors control. Two founders, one investor, one independent both sides agree on is normal. Two investors and one founder at seed is not.\n\nRead the reviews on this network before your first call. Someone has probably already been through diligence with them and written down what it was like.`,
    'fundraising,terms', 'ferment_or_die'],
  ['Shipping biological material across borders without losing six weeks', 'protocol',
    'Paperwork, couriers, importers of record, and the two mistakes that cause every hold.',
    `Two mistakes cause almost every customs hold: an incomplete commercial invoice, and no local importer of record.\n\nThe invoice must state that the material is non-infectious, non-hazardous, of no commercial value if that is true, and give an HS code. "Research samples" is not a description. Write the actual contents.\n\nAn importer of record is a local entity that accepts responsibility on arrival. A university contact, a partner lab, a freight agent — anyone registered locally. Shipments with one clear in days; shipments without one clear in weeks or come back.\n\nUse a courier's medical or clinical service, not the standard one. It costs more and routes through people who have seen a UN3373 label before.\n\nNone of this applies to controlled material, which needs a licence, and if you are not certain whether yours is controlled, ask before you pack.`,
    'shipping,customs,operations', 'plasmid_mule'],
];

const JOBS = [
  ['Loam Foods', 'ferment_or_die', 'Fermentation scientist, 500L pilot', 'wetlab', 'full-time', 'Malmö, SE', false,
    '€58–72k', '0.25–0.6%', 'fermentation,scale-up,food',
    'You will own the 500L pilot line: batch design, foam and sparge control, sampling, and the handover to the CMO. We would rather hire someone who has broken a fermenter than someone who has read about one.'],
  ['Openbench', 'pipette_punk', 'Firmware engineer (instruments)', 'engineering', 'full-time', 'Berlin, DE / remote', true,
    '€55–70k', '0.3–0.8%', 'firmware,embedded,open-source',
    'STM32, C, and a bench full of instruments that need to be right rather than fast. Everything you write is published under CERN-OHL, which some people love and some people cannot accept. Know which you are.'],
  ['Kowalczyk Group', 'wetware_ann', 'Postdoc — vascularised organoids', 'wetlab', 'full-time', 'Kraków, PL', false,
    'Institutional scale', '—', 'organoids,neuro,microscopy',
    'Three-year position. You will run the vascularisation arm and co-supervise one PhD student. We publish protocols before results and expect you to be comfortable with that.'],
  ['Hyphae Works', 'mycelium_max', 'Materials engineer, part time', 'engineering', 'part-time', 'Rotterdam, NL', false,
    '€30/hr', '—', 'materials,testing,certification',
    'Two days a week to take our panels through mechanical and fire testing. Ideal if you have been through EN 13501 before and remember what it did to you.'],
  ['Cultura Aberta', 'helix_witch', 'Lab manager (part time, community lab)', 'ops', 'part-time', 'Lisbon, PT', false,
    '€1,400/month', '—', 'lab-ops,community,teaching',
    'Twenty hours a week keeping forty members safe and the autoclave working. Teaching experience matters more than research experience.'],
];

const EVENTS = [
  ['helix_witch', 'Open bench night, Lisbon', 'openlab', 3 * DAY + 18 * HOUR, 180,
    'Cultura Aberta, Rua do Século, Lisbon', 40,
    'Doors open at 18:00. Bring a project or borrow one. Two microscopes, one incubator and someone who will show you how to pour a plate.'],
  ['pipette_punk', 'Teardown: three plate readers, one afternoon', 'workshop', 9 * DAY + 13 * HOUR, 240,
    'Openbench workshop, Berlin', 20,
    'We open a €40k reader, a €4k reader and one we built, and compare the optical paths. Bring your own if you want it opened; we will not be gentle.'],
  ['ferment_or_die', 'Scale-up clinic: 5L to 500L', 'talk', 14 * DAY + 16 * HOUR, 90, 'Online', 0,
    'An hour on what actually breaks between the bench and the pilot: mixing, oxygen transfer, foam, and the strain quietly changing on you. Bring the failure you cannot explain.'],
  ['biosafety_bee', 'Risk assessment workshop for small labs', 'workshop', 21 * DAY + 15 * HOUR, 120, 'Online', 30,
    'We fill in the one-page template together, on your actual procedures. Come with one procedure you are unsure about.'],
  ['garage_genome', 'Nairobi metagenomics meetup', 'meetup', 28 * DAY + 17 * HOUR, 150, 'iHub, Nairobi', 50,
    'Sequencing on a budget, flow cell economics, and a shared run for anyone who brings a sample.'],
];

const SLOTS = [
  ['ferment_or_die', 'Scale-up, CMOs and food-grade audits', 'one-on-one', 4 * DAY + 14 * HOUR, 30, 1,
    'Video — link on booking', 'fermentation, scale-up, CMOs',
    'I have taken a strain from 5L to 500L and through a food-grade audit. Ask me the specific thing, not the general thing.'],
  ['biosafety_bee', 'Biosafety and dual-use review — group session', 'group', 6 * DAY + 16 * HOUR, 60, 8,
    'Video — link on booking', 'biosafety, dual-use, export control',
    'Bring one procedure or one question. I will not review anything that belongs in front of a real committee, and I will tell you when that is the case.'],
  ['pipette_punk', 'Open hardware: sourcing, thermal design, CE marking', 'one-on-one', 8 * DAY + 10 * HOUR, 45, 1,
    'Video — link on booking', 'hardware, sourcing, ce-marking', 'Bring your BOM.'],
  ['wetware_ann', 'IRB submissions for human-derived material', 'group', 11 * DAY + 15 * HOUR, 60, 6,
    'Video — link on booking', 'irb, ethics, organoids',
    'How to write an ethics section that does not get bounced. Bring a draft if you have one.'],
  ['helix_witch', 'Starting a community lab', 'one-on-one', 5 * DAY + 18 * HOUR, 30, 1,
    'Video — link on booking', 'community-lab, leases, insurance', 'The boring twelve months, compressed into half an hour.'],
];

/* --------------------------------------------------------------------- */

async function seedHomeroom({ reset = false } = {}) {
  const instance = await getDb();
  if (reset) {
    // One statement so the foreign keys between these tables never see a
    // half-emptied database, and RESTART IDENTITY so a reseed produces the
    // same ids as a first seed.
    await instance.exec(
      `TRUNCATE ${SAMPLE_TABLES.join(', ')} RESTART IDENTITY CASCADE`,
    );
  }
  if (((await instance.prepare('SELECT COUNT(*) AS n FROM hr_members').get())).n > 0) {
    return { skipped: true };
  }

  const now = nowSeconds();

  // Sample accounts, so a fresh deploy has a network to look at rather than an
  // empty shell. They all share one hash because scrypt is deliberately slow
  // and these are throwaway logins, listed in the README.
  const sampleHash = hashPassword(SAMPLE_PASSWORD);
  for (const [handle] of MEMBERS) {
    if (!await bf.getUser(handle)) {
      await bf.createUser({ id: handle, email: `${handle}@example.org`, passwordHash: sampleHash });
    }
  }

  const handles = ((await instance.prepare('SELECT id FROM users').all())).map((row) => row.id);
  if (!handles.length) return { skipped: true };
  const named = MEMBERS.map(([handle]) => handle).filter((handle) => handles.includes(handle));
  if (!named.length) return { skipped: true };

  let state = 90210;
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  const pick = (list) => list[Math.floor(random() * list.length)];

  /* ---- members ---- */
  for (const [handle, name, headline, org, role, cohort, location, bsl, expertise, workingOn, askMe] of MEMBERS) {
    if (!handles.includes(handle)) continue;
    await bf.ensureMember(handle);
    await bf.updateMember(handle, {
      name, headline, org, role, cohort, location, bsl,
      bio: headline,
      working_on: workingOn,
      ask_me_about: askMe,
      links: `https://example.org/${handle}`,
      expertise,
      open_intros: true,
      open_collab: true,
      open_hours: ['ferment_or_die', 'biosafety_bee', 'pipette_punk', 'wetware_ann', 'helix_witch'].includes(handle),
      open_hiring: ['plasmid_mule', 'crispr_kid', 'open_assay'].includes(handle),
    });
  }
  // Everyone else gets a bare profile so the directory is not a ghost town.
  for (const handle of handles) {
    if (await bf.getMember(handle)) continue;
    await bf.ensureMember(handle);
    await bf.updateMember(handle, { headline: 'Quiet member. Reads more than posts.', open_intros: false });
  }

  /* ---- labs ---- */
  const orgIds = new Map();
  for (const [name, tagline, kind, stage, location, website, cohort, founded, headcount, tags, createdBy, description] of ORGS) {
    if (!handles.includes(createdBy)) continue;
    const id = await bf.createOrg({
      name, tagline, description, kind, stage, location, website, cohort, founded, headcount, tags, createdBy,
    });
    orgIds.set(name, id);
  }
  // A couple of shared teams, so lab pages are not all one-person.
  const teamPairs = [['Openbench', 'open_assay', 'Head of science'], ['Cultura Aberta', 'plasmid_mule', 'Volunteer'],
    ['Loam Foods', 'open_assay', 'Advisor'], ['Kitchen Sequencing Club', 'crispr_kid', 'Member']];
  for (const [orgName, handle, role] of teamPairs) {
    const orgId = orgIds.get(orgName);
    if (orgId && handles.includes(handle)) await bf.joinOrg(orgId, handle, role);
  }

  const setCreatedAt = async (table, id, at) =>
    ((await instance.prepare(`UPDATE ${table} SET created_at = ? WHERE id = ?`).run(at, id)));

  /* ---- updates ---- */
  const UPDATES = [
    ['Loam Foods', 'ferment_or_die', 'Week of 3 Aug',
      'Two 500L runs, one clean, one lost to foam at hour 31. Downstream membrane fouling traced to the antifoam rather than the biomass, so we are testing a mechanical breaker next week. Novel food dossier is with the consultant.',
      '2 runs · 1 clean · 14 months runway', 'Anyone who has run a rotating disc foam breaker above 300L.'],
    ['Openbench', 'pipette_punk', 'Week of 3 Aug',
      'Thermocycler mk3 files published. 61 kits shipped this month, which is a record and also the limit of what two people can assemble. Hiring firmware so I can stop doing both.',
      '61 kits · €14.2k revenue · 4 months runway', 'Intros to schools buying instruments in bulk.'],
    ['Cultura Aberta', 'helix_witch', 'July',
      'Forty-one members. Freezer sharing launched with three external groups, which covers the electricity bill for the first time. Twelve-week course starts again in September, eighteen signed up.',
      '41 members · 3 freezer tenants · break-even on power', 'A second autoclave, cheap, Iberia.'],
  ];
  for (const [orgName, author, period, body, metrics, asks] of UPDATES) {
    const orgId = orgIds.get(orgName);
    if (!orgId || !handles.includes(author)) continue;
    const id = await bf.createUpdate({ orgId, authorId: author, period, body, metrics, asks });
    setCreatedAt('hr_updates', id, now - Math.floor(random() * 6 * DAY));
  }

  /* ---- perks ----
     The catalogue is researched rather than invented, so it goes in as-is and
     the fictional DEALS list below it only adds the community-negotiated ones
     that would not exist on a vendor's public page. */
  const steward = named.includes('helix_witch') ? 'helix_witch' : named[0];
  for (const perk of PERKS) {
    const id = await bf.createDeal({
      vendor: perk.vendor, title: perk.title, category: perk.category,
      summary: perk.summary, details: perk.details, worth: perk.worth,
      code: perk.code || '', url: perk.url || null, access: perk.access,
      requirement: perk.requirement || '', checked: perk.checked || '',
      postedBy: steward,
    });
    setCreatedAt('hr_deals', id, now - Math.floor(random() * 90 * DAY));
    for (const handle of handles.slice(0, Math.floor(random() * 8))) await bf.claimDeal(id, handle);
  }
  for (const [vendor, title, category, worth, code, url, details] of DEALS) {
    const id = await bf.createDeal({
      vendor, title, category, worth, code, url, details,
      summary: title, access: code ? 'code' : 'partner',
      postedBy: steward,
    });
    setCreatedAt('hr_deals', id, now - Math.floor(random() * 60 * DAY));
    for (const handle of handles.slice(0, Math.floor(random() * 14))) await bf.claimDeal(id, handle);
  }

  /* ---- the capital map ----
     Real, publicly listed programmes. Deliberately WITHOUT ratings: a seeded
     review would be an invented claim about a real organisation, which is the
     one thing a review site cannot come back from. The fictional funders below
     carry the sample reviews instead, so the UI still has something to show. */
  const funderIds = new Map();
  for (const funder of CAPITAL_MAP) {
    const id = await bf.createFunder({ ...funder, checkSize: funder.checkSize, addedBy: steward });
    funderIds.set(funder.name, id);
  }
  for (const [name, kind, focus, stages, checkSize, location, website, dilutive, description] of FUNDERS) {
    const id = await bf.createFunder({
      name, kind, focus, stages, checkSize, location, website, dilutive, description,
      addedBy: named[0],
    });
    funderIds.set(name, id);
  }
  for (const [funderName, user, rating, speed, valueAdd, invested, anonymous, body] of REVIEWS) {
    const funderId = funderIds.get(funderName);
    if (!funderId || !handles.includes(user)) continue;
    await bf.upsertReview({
      funderId, userId: user, rating, speed, valueAdd, invested, anonymous, body,
      founderFriendly: Math.max(1, Math.min(5, rating + (random() < 0.5 ? 0 : 1))),
      terms: Math.max(1, Math.min(5, rating)),
      wouldAgain: rating >= 4,
      outcome: invested ? 'invested' : 'passed',
      stage: pick(['pre-seed', 'seed', 'pre-revenue', 'one paper, no product']),
      tags: pick([
        'fast-decision,deeply-technical', 'slow-process,helpful-pass', 'great-intros,hands-on',
        'clean-terms,kept-word', 'ghosted', 'hands-off,clean-terms',
      ]),
    });
  }
  // A few reviews get corroborated, which is what makes the sort order legible.
  for (const review of ((await instance.prepare('SELECT id, user_id FROM hr_funder_reviews').all()))) {
    for (const handle of handles.filter((h) => h !== review.user_id).slice(0, Math.floor(random() * 5))) {
      await bf.toggleReviewHelpful(review.id, handle);
    }
    if (random() < 0.4) {
      const author = pick(handles.filter((h) => h !== review.user_id));
      if (author) {
        await bf.addReviewComment({
          reviewId: review.id, authorId: author, anonymous: random() < 0.6,
          body: 'Same experience here, a cohort later. Sample reply — fictional demo data.',
        });
      }
    }
  }
  // One worked-through pipeline so the board is not empty on first look.
  const pipelineRows = [
    ['ferment_or_die', 'Cold Chain Capital', 'diligence', '€2.5M Series A', 'Second partner meeting done. They want twelve months of pilot data.'],
    ['ferment_or_die', 'EU BioForward', 'pitched', '€1.1M grant', 'Submitted 14 July. Decision expected in the winter.'],
    ['ferment_or_die', 'Substrate Fund', 'committed', '€400k', 'Committed as follow-on. Paperwork with lawyers.'],
    ['ferment_or_die', 'Trellis Bio', 'researching', '—', 'Ex-bench partners. Warm path via pipette_punk.'],
    ['ferment_or_die', 'Ferment Prize', 'passed', '€75k', 'Did not shortlist. Reapply next cycle.'],
  ];
  for (const [user, funderName, status, amount, notes] of pipelineRows) {
    const funderId = funderIds.get(funderName);
    if (!funderId || !handles.includes(user)) continue;
    await bf.upsertPipeline({ userId: user, funderId, orgId: orgIds.get('Loam Foods') ?? null, status, amount, notes });
  }

  /* ---- library ---- */
  for (const [title, kind, summary, body, tags, authorId] of LIBRARY) {
    const id = await bf.createLibraryEntry({
      title, kind, summary, body, tags,
      authorId: handles.includes(authorId) ? authorId : null,
    });
    ((await instance.prepare('UPDATE hr_library SET reads = ? WHERE id = ?').run(20 + Math.floor(random() * 400), id)));
  }

  /* ---- jobs ---- */
  for (const [orgName, postedBy, title, discipline, employment, location, remote, comp, equity, tags, description] of JOBS) {
    const orgId = orgIds.get(orgName);
    if (!orgId || !handles.includes(postedBy)) continue;
    const id = await bf.createJob({
      orgId, postedBy, title, discipline, employment, location, remote, comp, equity, tags, description,
    });
    setCreatedAt('hr_jobs', id, now - Math.floor(random() * 20 * DAY));
    for (const handle of handles.slice(3, 3 + Math.floor(random() * 5))) {
      if (handle !== postedBy) await bf.applyToJob(id, handle, 'Sample application — fictional demo data.');
    }
  }

  /* ---- events ---- */
  for (const [hostId, title, kind, offset, minutes, place, capacity, description] of EVENTS) {
    if (!handles.includes(hostId)) continue;
    const id = await bf.createEvent({
      hostId, title, kind, startsAt: now + offset, minutes, place, capacity, description, url: null,
    });
    await bf.rsvp(id, hostId, 'going');
    for (const handle of handles.slice(0, 4 + Math.floor(random() * 14))) {
      if (handle !== hostId) await bf.rsvp(id, handle, random() < 0.75 ? 'going' : 'maybe');
    }
  }

  /* ---- office hours ---- */
  for (const [hostId, title, format, offset, minutes, capacity, place, topics, description] of SLOTS) {
    if (!handles.includes(hostId)) continue;
    const id = await bf.createSlot({
      hostId, title, format, startsAt: now + offset, minutes, capacity, place, topics, description,
    });
    const bookers = handles.filter((h) => h !== hostId).slice(0, Math.min(capacity, 1 + Math.floor(random() * capacity)));
    for (const handle of bookers) {
      await bf.bookSlot(id, handle, 'Sample booking question — fictional demo data.');
    }
  }

  /* ---- the biolab atlas ---- */
  for (const [name, city, country, region, kind, status, bsl, website, capabilities, note, source] of ATLAS_LABS) {
    await bf.upsertLab({ name, city, country, region, kind, status, bsl, website, capabilities, note, source });
  }
  // Two member reports, so the "been there?" loop is visibly a loop.
  const genspace = await bf.getLab('genspace-brooklyn-ny');
  if (genspace && handles.includes('garage_genome')) {
    await bf.reportLab({
      labId: genspace.id, userId: 'garage_genome', status: 'active',
      body: 'Sample report — fictional demo data. Membership was straightforward and the thermocyclers were free most evenings.',
    });
  }
  const paillasse = await bf.getLab('la-paillasse-paris');
  if (paillasse && handles.includes('open_assay')) {
    await bf.reportLab({
      labId: paillasse.id, userId: 'open_assay', status: 'dormant',
      body: 'Sample report — fictional demo data. The organisation answers email; there was no open bench when I asked.',
    });
  }

  /* ---- mentors ----
     The sample roster first, then the real people from the network on top of
     it. Real rows carry source 'calendar' and are never marked vetted — see
     data/network.js for why — so `npm run mentors:import -- --replace-seed`
     drops the sample rows and leaves these standing. */
  for (const mentor of MENTOR_ROSTER) await bf.upsertMentor(mentor);
  for (const mentor of NETWORK_MENTORS) await bf.upsertMentor(mentor);
  // A handful of the vetted ones publish Homeroom slots as well as their own
  // scheduler, so the booking flow has something to book.
  const vetted = (await instance
    .prepare('SELECT id, name, track FROM hr_mentors WHERE vetted = 1 ORDER BY id LIMIT 14')
    .all());
  for (const [index, mentor] of vetted.entries()) {
    const slotId = await bf.createSlot({
      hostId: steward,
      mentorId: mentor.id,
      title: `Office hours with ${mentor.name}`,
      description: 'Sample slot — fictional demo data. Send your question in advance.',
      format: index % 5 === 0 ? 'group' : 'one-on-one',
      startsAt: now + (2 + index) * DAY + 17 * HOUR,
      minutes: index % 5 === 0 ? 60 : 30,
      capacity: index % 5 === 0 ? 6 : 1,
      place: 'Video call',
      topics: mentor.track,
    });
    if (index % 3 === 0) {
      const booker = pick(handles.filter((h) => h !== steward));
      if (booker) await bf.bookSlot(slotId, booker, 'Sample booking question — fictional demo data.');
    }
  }

  /* ---- the yearbook ---- */
  for (const [handle, cohort, house, venture, oneLiner, quote, building, before] of YEARBOOK) {
    if (!handles.includes(handle)) continue;
    await bf.upsertYearbook(handle, {
      cohort, house, venture, one_liner: oneLiner, quote, building, before_haus: before,
    });
  }
  const signable = YEARBOOK.map(([handle]) => handle).filter((h) => handles.includes(h));
  for (const handle of signable) {
    for (const author of signable.filter((h) => h !== handle).slice(0, 2 + Math.floor(random() * 3))) {
      await bf.signYearbook({
        userId: handle, authorId: author,
        body: 'Sample signature — fictional demo data. Ask them about the thing they will not shut up about.',
      });
    }
  }

  /* ---- the founder manual ---- */
  for (const [index, track] of TRACKS.entries()) await bf.upsertTrack(track, index);
  for (const [index, module] of LIBRARY_MODULES.entries()) await bf.upsertModule(module, index);
  // One member part-way through, so the progress bars are not all at zero.
  if (handles.includes('ferment_or_die')) {
    const started = ((await instance.prepare('SELECT id, deliverable FROM hr_modules ORDER BY position LIMIT 7').all()));
    for (const [index, module] of started.entries()) {
      await bf.setProgress({
        userId: 'ferment_or_die',
        moduleId: module.id,
        state: index < 4 ? 'done' : 'started',
        note: 'Sample progress note — fictional demo data.',
        link: index < 4 ? 'https://example.org/deliverable' : '',
      });
    }
  }

  /* ---- intros and messages ---- */
  if (handles.includes('mycelium_max') && handles.includes('ferment_or_die')) {
    const request = await bf.requestIntro({
      requesterId: 'mycelium_max',
      targetId: 'ferment_or_die',
      reason: 'You have been through EN 13501 with a different material. Twenty minutes on the notified body and the sample prep would save me a month.',
    });
    if (request.ok) {
      const resolved = await bf.resolveIntro(request.id, 'accepted');
      if (resolved?.threadId) {
        await bf.sendMessage({
          threadId: resolved.threadId,
          senderId: 'mycelium_max',
          body: 'Thank you. Thursday afternoon works if it still does for you — I will send the panel spec beforehand.',
        });
      }
    }
  }
  if (handles.includes('crispr_kid') && handles.includes('biosafety_bee')) {
    await bf.requestIntro({
      requesterId: 'crispr_kid',
      targetId: 'biosafety_bee',
      reason: 'Trying to work out whether my construct needs institutional review before I publish the sequence. Would value fifteen minutes.',
    });
  }

  return {
    skipped: false,
    stats: await bf.networkStats(),
  };
}

export { seedHomeroom };

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const { closeDb } = await import('./db.js');
  const result = await seedHomeroom({ reset: process.argv.includes('--reset') });
  if (result.skipped) console.log('Already seeded. Use `npm run reset` to start over.');
  else {
    const s = result.stats;
    console.log(
      `Seeded ${s.members} members, ${s.orgs} labs, `
      + `${s.deals} perks, ${s.funders} funders (${s.reviews} reviews), ${s.jobs} roles, `
      + `${s.slots} office-hour slots, ${s.events} events, ${s.library} library entries, `
      + `${s.mentors} mentors, ${s.atlas} atlas labs, ${s.modules} manual modules.`,
    );
    console.log(`Sample logins: any handle above, password "${SAMPLE_PASSWORD}".`);
    console.log('All sample content is fictional.');
  }
  closeDb();
}
