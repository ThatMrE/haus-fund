/**
 * The mentor roster behind Office Hours.
 *
 * SAMPLE DATA. Like the rest of `seed.js`, the hundred people below are
 * invented — a plausible roster at the right shape and the right size, so the
 * directory, the search, the filters and the booking flow can be exercised
 * against a hundred rows rather than six.
 *
 * They are fictional on purpose. Publishing a hundred real names with
 * scheduling links nobody has agreed to would send founders to book time with
 * people who never opted in, which is worse than an empty list. The real roster
 * arrives through `scripts/import-mentors.js` (Airtable, or a CSV export of it)
 * and replaces every row here; set HOMEROOM_SEED=off once it has.
 *
 * The taxonomy is not invented. `track` follows the skill leads in the Fall
 * 2026 programme design — legal to Orrick, fundraising to VCs, commercialisation
 * to operators, technical to scientists, regulatory to FDA advisors, grants to
 * grant experts, immigration to visa experts, hiring to talent partners,
 * manufacturing to operators — so an imported roster drops straight in.
 *
 * `vetted` means a steward has met them and they have agreed to take bookings.
 * `scheduler` is their own booking link (Cal.com, Calendly, Luma, SavvyCal);
 * an empty one falls back to an intro request through the network, which is
 * what the profile page renders.
 */

export const MENTOR_TRACKS = [
  { slug: 'legal', label: 'Legal & IP' },
  { slug: 'fundraising', label: 'Fundraising & capital' },
  { slug: 'commercialization', label: 'Customers & commercialisation' },
  { slug: 'technical', label: 'Science & technical' },
  { slug: 'regulatory', label: 'Regulatory & quality' },
  { slug: 'grants', label: 'Grants & non-dilutive' },
  { slug: 'manufacturing', label: 'Manufacturing & scale-up' },
  { slug: 'hiring', label: 'Team & hiring' },
  { slug: 'immigration', label: 'Immigration & visas' },
  { slug: 'brand', label: 'Brand, media & community' },
  { slug: 'ops', label: 'Finance & operations' },
  { slug: 'founder', label: 'Founder judgment' },
];

/* [name, role, org, track, tags, location, format, vetted, scheduler] */
const ROWS = [
  ['Adaeze Nwankwo', 'Partner', 'Marlowe & Finch LLP', 'legal', ['formation', 'safes', 'cap-tables'], 'New York, US', 'one-on-one', 1, ''],
  ['Ravi Desai', 'Patent attorney', 'Sableworks IP', 'legal', ['patents', 'freedom-to-operate', 'publication-timing'], 'Boston, US', 'one-on-one', 1, ''],
  ['Ingrid Halvorsen', 'Counsel', 'Nordvik Legal', 'legal', ['university-ip', 'licensing', 'spinouts'], 'Oslo, NO', 'one-on-one', 1, ''],
  ['Marcus Bell', 'General counsel', 'Corvid Therapeutics', 'legal', ['mtas', 'ndas', 'pharma-negotiation'], 'San Diego, US', 'one-on-one', 1, ''],
  ['Sofia Marchetti', 'Associate', 'Ponte Legale', 'legal', ['eu-entities', 'gdpr', 'contracts'], 'Milan, IT', 'one-on-one', 0, ''],
  ['Terrence Oduya', 'Tech transfer director', 'Riverbend University', 'legal', ['licensing', 'sponsored-research', 'spinouts'], 'Chicago, US', 'group', 1, ''],
  ['Hana Kobayashi', 'IP counsel', 'Setouchi Patent Office', 'legal', ['jp-filing', 'pct', 'trade-secrets'], 'Kobe, JP', 'one-on-one', 1, ''],
  ['Daniel Wexler', 'Employment counsel', 'Wexler Ross', 'legal', ['contractors', 'employment', 'advisor-equity'], 'Austin, US', 'one-on-one', 0, ''],

  ['Priya Anand', 'General partner', 'Ostrich Capital', 'fundraising', ['pre-seed', 'safes', 'deck-review'], 'San Francisco, US', 'one-on-one', 1, ''],
  ['Jonas Meier', 'Principal', 'Alpspitz Ventures', 'fundraising', ['seed', 'eu-fundraising', 'valuation'], 'Munich, DE', 'one-on-one', 1, ''],
  ['Ruth Okonjo', 'Angel investor', 'Independent', 'fundraising', ['angels', 'syndicates', 'first-cheque'], 'London, UK', 'one-on-one', 1, ''],
  ['Cormac Byrne', 'Managing director', 'Tidewater Bio', 'fundraising', ['series-a', 'diligence', 'data-rooms'], 'Dublin, IE', 'one-on-one', 1, ''],
  ['Mei-Ling Chow', 'Partner', 'Camphor Fund', 'fundraising', ['deep-tech', 'milestone-fundraising', 'board-dynamics'], 'Singapore, SG', 'one-on-one', 1, ''],
  ['Alonso Rivera', 'Founder, twice raised', 'Cauldron Bio', 'fundraising', ['raising-on-an-idea', 'investor-updates', 'narrative'], 'Mexico City, MX', 'group', 1, ''],
  ['Béatrice Lemoine', 'Investment director', 'Verdier Partners', 'fundraising', ['climate-bio', 'pre-seed', 'term-sheets'], 'Paris, FR', 'one-on-one', 0, ''],
  ['Nikhil Raman', 'Solo GP', 'Third Slope', 'fundraising', ['pre-seed', 'technical-diligence', 'cold-outreach'], 'Bengaluru, IN', 'one-on-one', 1, ''],
  ['Erik Salonen', 'Former CFO', 'Northlight Diagnostics', 'fundraising', ['fund-economics', 'dilution', 'cap-tables'], 'Helsinki, FI', 'one-on-one', 1, ''],
  ['Georgia Papadaki', 'Venture partner', 'Aegean Deep', 'fundraising', ['seed', 'syndicates', 'investor-psychology'], 'Athens, GR', 'group', 0, ''],

  ['Tom Whitfield', 'VP commercial', 'Fenwick Assays', 'commercialization', ['customer-discovery', 'design-partners', 'lois'], 'Manchester, UK', 'one-on-one', 1, ''],
  ['Camila Duarte', 'Head of BD', 'Verano Biotools', 'commercialization', ['pharma-sales', 'procurement', 'pilots'], 'São Paulo, BR', 'one-on-one', 1, ''],
  ['Anders Holm', 'Founder', 'Kelpworks', 'commercialization', ['beachhead-markets', 'technoeconomics', 'pricing'], 'Copenhagen, DK', 'one-on-one', 1, ''],
  ['Yasmin Rahimi', 'Commercial lead', 'Solace Devices', 'commercialization', ['enterprise-sales', 'stakeholder-mapping', 'reimbursement'], 'Toronto, CA', 'one-on-one', 1, ''],
  ['Peter Nyandoro', 'Category strategist', 'Independent', 'commercialization', ['category-design', 'positioning', 'market-timing'], 'Nairobi, KE', 'group', 0, ''],
  ['Lucia Ferrante', 'Head of partnerships', 'Aurelia Foods', 'commercialization', ['strategic-partnerships', 'cdmos', 'food-industry'], 'Bologna, IT', 'one-on-one', 1, ''],
  ['Sean Mulvaney', 'Sales advisor', 'Independent', 'commercialization', ['founder-led-sales', 'first-customers', 'pilot-conversion'], 'Boston, US', 'one-on-one', 1, ''],
  ['Aiko Tanabe', 'Product lead', 'Sōra Instruments', 'commercialization', ['tools-market', 'user-research', 'pricing'], 'Tokyo, JP', 'one-on-one', 1, ''],
  ['Emeka Balogun', 'Director of markets', 'Continental Bio', 'commercialization', ['emerging-markets', 'distribution', 'localization'], 'Lagos, NG', 'group', 0, ''],
  ['Hilde Vos', 'Technoeconomic analyst', 'Delta Modeling', 'commercialization', ['tea', 'cost-curves', 'willingness-to-pay'], 'Rotterdam, NL', 'one-on-one', 1, ''],

  ['Dr Ana Solís', 'Principal scientist', 'Cerro Labs', 'technical', ['protein-engineering', 'directed-evolution', 'assay-design'], 'Barcelona, ES', 'one-on-one', 1, ''],
  ['Dr Wen Zhao', 'Group leader', 'Institute for Applied Genomics', 'technical', ['crispr', 'off-target', 'base-editing'], 'Shanghai, CN', 'one-on-one', 1, ''],
  ['Dr Fiona Achebe', 'Staff scientist', 'Harrow Institute', 'technical', ['ngs', 'metagenomics', 'bioinformatics'], 'London, UK', 'one-on-one', 1, ''],
  ['Dr Liam Costa', 'Fermentation lead', 'Bracken Bio', 'technical', ['fermentation', 'bioreactors', 'strain-engineering'], 'Lisbon, PT', 'one-on-one', 1, ''],
  ['Dr Maria Voronova', 'Cell biology lead', 'Meridian Organoids', 'technical', ['cell-culture', 'organoids', 'microscopy'], 'Tbilisi, GE', 'one-on-one', 1, ''],
  ['Dr Ishaan Kapoor', 'Computational lead', 'Foldwise', 'technical', ['ml-for-bio', 'structure-prediction', 'model-validation'], 'Bengaluru, IN', 'one-on-one', 1, ''],
  ['Dr Nora Lindgren', 'Analytical chemist', 'Vika Analytics', 'technical', ['mass-spec', 'method-development', 'qc'], 'Stockholm, SE', 'one-on-one', 1, ''],
  ['Dr Kwame Boateng', 'Enzyme engineer', 'Open reagent network', 'technical', ['enzymes', 'open-reagents', 'lyophilisation'], 'Kumasi, GH', 'group', 1, ''],
  ['Dr Rachel Stein', 'Immunologist', 'Talus Therapeutics', 'technical', ['immunology', 'in-vivo', 'study-design'], 'Philadelphia, US', 'one-on-one', 1, ''],
  ['Dr Hugo Almeida', 'Microfluidics lead', 'Riacho Devices', 'technical', ['microfluidics', 'device-design', 'prototyping'], 'Porto, PT', 'one-on-one', 0, ''],
  ['Dr Sunita Mehra', 'Head of biology', 'Kestrel Diagnostics', 'technical', ['diagnostics', 'assay-validation', 'sensitivity'], 'Pune, IN', 'one-on-one', 1, ''],
  ['Dr Olha Petrenko', 'Plant scientist', 'Chernozem Ag', 'technical', ['plant-bio', 'agronomy', 'field-trials'], 'Kyiv, UA', 'one-on-one', 0, ''],
  ['Dr Tobias Frey', 'Synthetic biologist', 'Helvetia SynBio', 'technical', ['synthetic-biology', 'cell-free', 'genetic-circuits'], 'Zurich, CH', 'one-on-one', 1, ''],
  ['Dr Amara Diallo', 'Bioprocess scientist', 'Sahel Bioworks', 'technical', ['downstream', 'purification', 'scale-down'], 'Dakar, SN', 'one-on-one', 1, ''],
  ['Dr Ben Harlow', 'Neurotech researcher', 'Cortical Instruments', 'technical', ['electrophysiology', 'implants', 'signal-processing'], 'Melbourne, AU', 'one-on-one', 0, ''],

  ['Dr Susan Ihejirika', 'Former FDA reviewer', 'Independent', 'regulatory', ['fda', 'devices', 'q-subs'], 'Washington DC, US', 'one-on-one', 1, ''],
  ['Marc Dubois', 'Regulatory consultant', 'Voie Réglementaire', 'regulatory', ['eu-mdr', 'ivdr', 'notified-bodies'], 'Lyon, FR', 'one-on-one', 1, ''],
  ['Dr Helen Park', 'Regulatory affairs director', 'Sable Therapeutics', 'regulatory', ['ind', 'therapeutics', 'clinical-strategy'], 'Seoul, KR', 'one-on-one', 1, ''],
  ['Grace Oyelowo', 'Quality systems lead', 'Meridian Quality', 'regulatory', ['qms', 'gmp', 'audit-readiness'], 'Manchester, UK', 'one-on-one', 1, ''],
  ['Dr Felix Braun', 'Diagnostics regulatory', 'Rheinweg Advisory', 'regulatory', ['clia', 'ldt', 'diagnostics'], 'Cologne, DE', 'one-on-one', 0, ''],
  ['Priya Raghavan', 'Biosafety officer', 'Independent', 'regulatory', ['biosafety', 'ibc', 'dual-use'], 'Toronto, CA', 'group', 1, ''],
  ['Dr Ken Adeyemi', 'GLP consultant', 'Adeyemi Compliance', 'regulatory', ['glp', 'documentation', 'validation'], 'Accra, GH', 'one-on-one', 1, ''],
  ['Yuki Nakamura', 'PMDA specialist', 'Kansai Regulatory', 'regulatory', ['pmda', 'japan-entry', 'reimbursement'], 'Osaka, JP', 'one-on-one', 1, ''],

  ['Dr Alan Whitcombe', 'Grant writer', 'Whitcombe Grants', 'grants', ['sbir', 'nih', 'specific-aims'], 'Bethesda, US', 'one-on-one', 1, ''],
  ['Rosa Jiménez', 'Non-dilutive strategist', 'Independent', 'grants', ['nsf', 'project-pitch', 'budgeting'], 'Madrid, ES', 'one-on-one', 1, ''],
  ['Dr Ngozi Umeh', 'Programme officer, former', 'Independent', 'grants', ['review-panels', 'resubmission', 'scoring'], 'Abuja, NG', 'group', 1, ''],
  ['Stefan Novak', 'EU funding consultant', 'Horizon Path', 'grants', ['horizon-europe', 'eic', 'consortium-building'], 'Prague, CZ', 'one-on-one', 1, ''],
  ['Dr Rebecca Lin', 'ARPA-H programme veteran', 'Independent', 'grants', ['arpa-h', 'milestones', 'contracts'], 'Austin, US', 'one-on-one', 1, ''],
  ['Tomás Herrera', 'Philanthropic capital advisor', 'Bridge Fund Advisory', 'grants', ['fast-grants', 'foundations', 'prizes'], 'Santiago, CL', 'one-on-one', 0, ''],
  ['Dr Aisha Karim', 'Global health funding', 'Independent', 'grants', ['gates', 'wellcome', 'global-health'], 'Karachi, PK', 'one-on-one', 1, ''],

  ['Jorge Salgado', 'VP manufacturing', 'Andes Bioworks', 'manufacturing', ['scale-up', 'pilot-plants', 'tech-transfer'], 'Lima, PE', 'one-on-one', 1, ''],
  ['Wei Chen', 'Sourcing lead', 'Pearl River Sourcing', 'manufacturing', ['shenzhen', 'oems', 'rfqs'], 'Shenzhen, CN', 'one-on-one', 1, ''],
  ['Dr Marta Kowal', 'CDMO relationship lead', 'Vistula Bio', 'manufacturing', ['cdmos', 'cmos', 'tech-transfer'], 'Warsaw, PL', 'one-on-one', 1, ''],
  ['Ola Bergström', 'Hardware manufacturing', 'Norrland Instruments', 'manufacturing', ['dfm', 'dft', 'supplier-qualification'], 'Gothenburg, SE', 'one-on-one', 1, ''],
  ['Ifeoma Chukwu', 'Supply chain director', 'Continental Bio', 'manufacturing', ['logistics', 'cold-chain', 'customs'], 'Lagos, NG', 'one-on-one', 0, ''],
  ['Dr Rahul Menon', 'Downstream processing', 'Konkan Bioprocess', 'manufacturing', ['purification', 'yield', 'cost-of-goods'], 'Mumbai, IN', 'one-on-one', 1, ''],
  ['Sam Whitaker', 'Contract manufacturing', 'Independent', 'manufacturing', ['moqs', 'quality-control', 'vendor-audits'], 'Portland, US', 'group', 1, ''],

  ['Dana Reinholt', 'Talent partner', 'Fernwood Search', 'hiring', ['scientific-hiring', 'first-hires', 'comp'], 'Berlin, DE', 'one-on-one', 1, ''],
  ['Miguel Santos', 'Head of people', 'Cauldron Bio', 'hiring', ['culture', 'onboarding', 'performance'], 'Lisbon, PT', 'one-on-one', 1, ''],
  ['Chioma Eze', 'Technical recruiter', 'Independent', 'hiring', ['ml-hiring', 'sourcing', 'work-trials'], 'London, UK', 'one-on-one', 1, ''],
  ['Jakob Lindqvist', 'Founder coach', 'Independent', 'hiring', ['cofounders', 'conflict', 'founder-breakups'], 'Malmö, SE', 'one-on-one', 1, ''],
  ['Renée Beaulieu', 'Compensation consultant', 'Beaulieu Advisory', 'hiring', ['equity', 'advisor-equity', 'benchmarks'], 'Montreal, CA', 'one-on-one', 0, ''],
  ['Tariq Haddad', 'Head of engineering', 'Levant Instruments', 'hiring', ['engineering-hiring', 'managing-scientists', 'firing'], 'Amman, JO', 'one-on-one', 1, ''],

  ['Elena Marchuk', 'Immigration attorney', 'Marchuk Immigration', 'immigration', ['o-1', 'eb-1a', 'evidence-building'], 'New York, US', 'one-on-one', 1, ''],
  ['Rahim Farooqi', 'Immigration counsel', 'Farooqi Law', 'immigration', ['h-1b', 'cap-exempt', 'transfers'], 'San Francisco, US', 'one-on-one', 1, ''],
  ['Sarah Coetzee', 'Global mobility', 'Independent', 'immigration', ['uk-global-talent', 'eu-blue-card', 'relocation'], 'Cape Town, ZA', 'one-on-one', 1, ''],
  ['Hiro Yamashita', 'Visa specialist', 'Kansai Mobility', 'immigration', ['japan-startup-visa', 'business-manager', 'residency'], 'Kobe, JP', 'one-on-one', 1, ''],
  ['Lucia Ferrari', 'Founder visa advisor', 'Independent', 'immigration', ['founder-visas', 'entity-setup', 'timelines'], 'Rome, IT', 'group', 0, ''],

  ['Nadia Osman', 'Science journalist', 'Freelance', 'brand', ['press', 'pitching-journalists', 'embargoes'], 'Cairo, EG', 'one-on-one', 1, ''],
  ['Callum Reid', 'Comms director', 'Northstar Communications', 'brand', ['messaging', 'crisis-comms', 'launches'], 'Edinburgh, UK', 'one-on-one', 1, ''],
  ['Ines Baptista', 'Community builder', 'Independent', 'brand', ['community', 'events', 'movement-building'], 'Lisbon, PT', 'group', 1, ''],
  ['Ryan Osei', 'Content strategist', 'Independent', 'brand', ['building-in-public', 'linkedin', 'founder-voice'], 'London, UK', 'one-on-one', 0, ''],
  ['Dr Petra Novotná', 'Science communicator', 'Vltava Media', 'brand', ['explaining-science', 'policymakers', 'public-talks'], 'Brno, CZ', 'one-on-one', 1, ''],
  ['Malia Kahale', 'Brand designer', 'Independent', 'brand', ['identity', 'decks', 'visual-language'], 'Honolulu, US', 'one-on-one', 1, ''],

  ['Owen Fitzgerald', 'Fractional CFO', 'Independent', 'ops', ['runway', 'burn', 'financial-models'], 'Dublin, IE', 'one-on-one', 1, ''],
  ['Sanaa Belkacem', 'Startup accountant', 'Atlas Books', 'ops', ['bookkeeping', 'rd-credit', 'tax'], 'Casablanca, MA', 'one-on-one', 1, ''],
  ['Victor Nkemelu', 'Operations lead', 'Meridian Organoids', 'ops', ['lab-ops', 'procurement', 'vendor-management'], 'Berlin, DE', 'one-on-one', 1, ''],
  ['Klara Svoboda', 'Insurance broker', 'Svoboda Risk', 'ops', ['d-and-o', 'lab-liability', 'landlord-requirements'], 'Vienna, AT', 'one-on-one', 0, ''],
  ['Nathan Cole', 'Data room specialist', 'Independent', 'ops', ['diligence', 'data-rooms', 'document-hygiene'], 'Denver, US', 'one-on-one', 1, ''],
  ['Amelia Reyes', 'Chief of staff', 'Tidewater Bio', 'ops', ['operating-cadence', 'okrs', 'board-reporting'], 'Barcelona, ES', 'one-on-one', 1, ''],

  ['Dr Idris Rahman', 'Three-time founder', 'Independent', 'founder', ['prioritisation', 'decision-making', 'risk-mapping'], 'Kuala Lumpur, MY', 'one-on-one', 1, ''],
  ['Bea Lindqvist', 'CEO', 'Loam Foods', 'founder', ['scale-up-decisions', 'when-to-pivot', 'saying-no'], 'Malmö, SE', 'one-on-one', 1, ''],
  ['Dr Tunde Bakare', 'Founder, exited', 'Independent', 'founder', ['acquisition', 'winding-down', 'end-of-life'], 'Lagos, NG', 'one-on-one', 1, ''],
  ['Hana Suzuki', 'Executive coach', 'Independent', 'founder', ['founder-wellbeing', 'burnout', 'routines'], 'Tokyo, JP', 'one-on-one', 1, ''],
  ['Marco Bianchi', 'Founder', 'Aurelia Foods', 'founder', ['capital-efficiency', 'burn-vs-learning', 'milestones'], 'Bologna, IT', 'group', 1, ''],
  ['Dr Leah Ndiaye', 'Founder & PI', 'Sahel Bioworks', 'founder', ['academia-to-company', 'faculty-founders', 'time-splitting'], 'Dakar, SN', 'one-on-one', 1, ''],
  ['Jasper Mwangi', 'Operator in residence', 'Independent', 'founder', ['study-the-greats', 'case-studies', 'pattern-recognition'], 'Nairobi, KE', 'group', 0, ''],
  ['Sylvie Aubert', 'Founder', 'Verano Biotools', 'founder', ['investor-advice-filtering', 'board-management', 'saying-no'], 'Geneva, CH', 'one-on-one', 1, ''],

  ['Dr Omar Haddadi', 'Bioinformatics consultant', 'Independent', 'technical', ['pipelines', 'reproducibility', 'cloud-genomics'], 'Tunis, TN', 'one-on-one', 1, ''],
  ['Freya Nilsen', 'Lab automation engineer', 'Nordbench', 'technical', ['automation', 'opentrons', 'protocol-code'], 'Bergen, NO', 'one-on-one', 1, ''],
  ['Dr Sanjay Iyer', 'Formulation scientist', 'Konkan Bioprocess', 'technical', ['formulation', 'stability', 'cold-chain'], 'Mumbai, IN', 'one-on-one', 1, ''],
  ['Zoe Karagianni', 'Open hardware engineer', 'Aegean Open Lab', 'technical', ['open-hardware', 'instrument-build', 'bom-cost'], 'Athens, GR', 'group', 1, ''],
  ['Dr Paulo Mendes', 'Biomaterials lead', 'Riacho Devices', 'technical', ['biomaterials', 'mechanical-testing', 'certification'], 'Porto, PT', 'one-on-one', 0, ''],
  ['Dr Ines Haddad', 'Clinical scientist', 'Levant Instruments', 'technical', ['clinical-validation', 'study-design', 'endpoints'], 'Beirut, LB', 'one-on-one', 1, ''],
  ['Ari Steinberg', 'Security engineer', 'Independent', 'ops', ['data-security', 'soc2', 'lab-it'], 'Tel Aviv, IL', 'one-on-one', 1, ''],
  ['Dr Chen Liang', 'Screening lead', 'Foldwise', 'technical', ['hts', 'screening-design', 'hit-triage'], 'Shanghai, CN', 'one-on-one', 1, ''],
  ['Nour Khalil', 'Grants project manager', 'Independent', 'grants', ['post-award', 'reporting', 'compliance'], 'Amman, JO', 'one-on-one', 0, ''],
  ['Dr Astrid Berg', 'Toxicology consultant', 'Nordvik Science', 'regulatory', ['tox', 'preclinical', 'safety-packages'], 'Oslo, NO', 'one-on-one', 1, ''],
  ['Gabriel Moreau', 'Procurement lead', 'Voie Industrielle', 'manufacturing', ['procurement', 'supplier-audits', 'contracts'], 'Lyon, FR', 'one-on-one', 1, ''],
  ['Dr Yara Nasser', 'Public health advisor', 'Independent', 'regulatory', ['global-health-regulation', 'who-prequalification', 'lmic-entry'], 'Cairo, EG', 'one-on-one', 1, ''],
  ['Linnea Ahonen', 'Design partner lead', 'Vika Analytics', 'commercialization', ['design-partners', 'pilot-design', 'feedback-loops'], 'Helsinki, FI', 'one-on-one', 1, ''],
  ['Dr Kofi Mensah', 'Open science advocate', 'Open reagent network', 'brand', ['open-science', 'licensing', 'community-labs'], 'Accra, GH', 'group', 1, ''],
  ['Ravi Shankar', 'Corporate development', 'Camphor Fund', 'fundraising', ['strategic-investors', 'corporate-vcs', 'partnerships'], 'Singapore, SG', 'one-on-one', 1, ''],
  ['Dr Emma Lindholm', 'Reproducibility researcher', 'Institute for Applied Genomics', 'technical', ['reproducibility', 'protocols', 'documentation'], 'Uppsala, SE', 'one-on-one', 0, ''],
  ['Andrés Peña', 'LatAm ecosystem lead', 'Independent', 'brand', ['latam-ecosystem', 'partnerships', 'community'], 'Bogotá, CO', 'group', 1, ''],
  ['Dr Mira Sethi', 'Ag-bio scientist', 'Chernozem Ag', 'technical', ['ag-bio', 'field-trials', 'regulatory-ag'], 'Delhi, IN', 'one-on-one', 1, ''],
  ['Peter Lindqvist', 'Freezer and lab logistics', 'Independent', 'ops', ['freezer-ops', 'sample-management', 'lab-moves'], 'Stockholm, SE', 'one-on-one', 1, ''],
  ['Dr Salma Bennani', 'Clinical trials operations', 'Atlas Clinical', 'regulatory', ['trial-ops', 'sites', 'recruitment'], 'Rabat, MA', 'one-on-one', 0, ''],
];

export const MENTORS = ROWS.map(([name, role, org, track, tags, location, format, vetted, scheduler]) => ({
  name, role, org, track, tags, location, format, vetted: !!vetted, scheduler,
  bio: `${name} is a ${role.toLowerCase()} at ${org}, working on ${tags.slice(0, 2).join(' and ').replace(/-/g, ' ')}. Sample mentor record — replace with the real roster before launch.`,
}));
