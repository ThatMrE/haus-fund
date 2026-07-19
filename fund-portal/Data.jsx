/* Shared data for Haus Fund UI Kit — 12 real residency houses */

const HOUSES = [
  { id: 'cell',   name: 'CellHaus',   city: 'Kobe, JP',      thesis: 'Allogeneic Cell Therapy',    bg: '#C4D8E8', color: '#2A587A',
    detail: "Beside the Kobe Biomedical Innovation Cluster — Japan's advanced cell-therapy regs + manufacturing." },
  { id: 'trial',  name: 'TrialHaus',  city: 'Australia',     thesis: 'Clinical Trials',             bg: '#C0E0D0', color: '#1A6850',
    detail: '43.5% R&D tax rebate + fast CTN approval for Phase I/II trials.' },
  { id: 'onc',    name: 'OncHaus',    city: 'New York',      thesis: 'Oncology',                   bg: '#F0D890', color: '#7A5010',
    detail: 'Memorial Sloan Kettering + Columbia KOL network; dense pharma M&A ecosystem.' },
  { id: 'tool',   name: 'ToolHaus',   city: 'Boston',        thesis: 'Tools Development',           bg: '#C0CCD8', color: '#283858',
    detail: 'MIT/Harvard pipeline + Flagship ecosystem — densest biotech VC on earth.' },
  { id: 'bio',    name: 'BioHaus',    city: 'Mexico',        thesis: 'Industrial Biotech',         bg: '#A0D878', color: '#286820',
    detail: 'Low-cost biomanufacturing scale-up; US nearshoring tailwind.' },
  { id: 'pharm',  name: 'PharmHaus', city: 'Puerto Rico',   thesis: 'Pharma Manufacturing',       bg: '#D4E8F4', color: '#2A5888',
    detail: 'Act 60 tax + J&J / Amgen / AbbVie infrastructure under US jurisdiction.' },
  { id: 'diag',   name: 'DiagHaus',   city: 'United Kingdom',thesis: 'Diagnostics',                bg: '#E8C4C4', color: '#782030',
    detail: 'Wellcome Trust + CEPI; progressive challenge-trial framework.' },
  { id: 'desci',  name: 'DeSciHaus',  city: 'Buenos Aires',  thesis: 'DeSci / Agriculture',        bg: '#B8D898', color: '#2A6018',
    detail: 'DeSci community + agri-biotech opportunity in Southern Cone.' },
  { id: 'lux',    name: 'LuxHaus',    city: 'Paris',         thesis: 'Luxury Technology',          bg: '#F0E0B0', color: '#7A5810',
    detail: 'LVMH ecosystem + French engineering grandes écoles.' },
  { id: 'sensor', name: 'SensorHaus', city: 'Zurich',        thesis: 'Sensor Development',         bg: '#D4D8E4', color: '#404858',
    detail: 'ETH Zurich precision-engineering pipeline.' },
  { id: 'cro',    name: 'CROHaus',    city: 'Shanghai',      thesis: 'Contract Research',          bg: '#F0C8C0', color: '#782820',
    detail: 'China CRO market + NMPA regulatory strategy.' },
  { id: 'fab',    name: 'FabHaus',    city: 'Shenzhen',      thesis: 'Fabrication',                bg: '#C8D4E4', color: '#3A4E6A',
    detail: 'Deep hardware supply chain + PCB/PCBA manufacturing density.' },
];

const PORTFOLIO_COMPANIES = [
  {
    id: 'quantum-arc', name: 'Quantum Arc', initials: 'QA',
    tagline: 'Quantum error correction for near-term QPUs',
    sector: 'Quantum Computing', stage: 'Seed', invested: '$1.5M',
    valuation: '$12M', multiple: '1.2×', date: 'Mar 2023', house: 'SensorHaus',
    status: 'active', founders: 'Dr. Maya Chen, Amir Siddiqui', location: 'Zurich, CH',
    description: 'Quantum Arc develops fault-tolerant error correction protocols for near-term quantum processors. Their surface code compiler reduces logical error rates by 40× on current hardware.',
    accent: '#D4D8E4', accentText: '#404858',
    metrics: [{ label: 'Patents', value: '3' }, { label: 'QPU partners', value: '2' }, { label: 'ARR', value: '$0.8M' }],
  },
  {
    id: 'biofab-systems', name: 'Biofab Systems', initials: 'BF',
    tagline: 'Automated cell-free protein synthesis at scale',
    sector: 'Synthetic Biology', stage: 'Series A', invested: '$2.2M',
    valuation: '$28M', multiple: '2.8×', date: 'Aug 2022', house: 'CellHaus',
    status: 'active', founders: 'Dr. Priya Nair, Leo Svensson', location: 'Kobe, JP',
    description: 'Biofab Systems automates protein synthesis using cell-free expression systems, enabling rapid prototyping of novel biologics at 10× lower cost than traditional bioreactors.',
    accent: '#C4D8E8', accentText: '#2A587A',
    metrics: [{ label: 'Lab partners', value: '14' }, { label: 'Proteins synth.', value: '2,400+' }, { label: 'ARR', value: '$3.2M' }],
  },
  {
    id: 'ceramesh', name: 'CeraMesh', initials: 'CM',
    tagline: 'Structural ceramics with embedded sensor networks',
    sector: 'Advanced Materials', stage: 'Seed', invested: '$1.2M',
    valuation: '$8M', multiple: '1.4×', date: 'Jan 2023', house: 'FabHaus',
    status: 'active', founders: 'Dr. Yuki Tanaka, Felix Meyer', location: 'Shenzhen, CN',
    description: 'CeraMesh embeds micro-sensor networks into structural ceramics during sintering, enabling real-time stress and temperature monitoring in industrial environments without external sensors.',
    accent: '#C8D4E4', accentText: '#3A4E6A',
    metrics: [{ label: 'Pilot installs', value: '7' }, { label: 'Temp. range', value: '1400°C' }, { label: 'ARR', value: '$0.4M' }],
  },
  {
    id: 'novacatalyst', name: 'NovaCatalyst', initials: 'NC',
    tagline: 'AI-designed catalysts for green chemistry',
    sector: 'Green Chemistry', stage: 'Pre-seed', invested: '$0.6M',
    valuation: '$3M', multiple: '1.1×', date: 'Jun 2023', house: 'BioHaus',
    status: 'active', founders: 'Dr. Inês Ribeiro', location: 'Mexico City, MX',
    description: 'NovaCatalyst uses generative AI to design novel transition metal catalysts that replace rare earth materials in hydrogenation reactions, reducing catalyst costs by up to 80%.',
    accent: '#A0D878', accentText: '#286820',
    metrics: [{ label: 'Catalyst designs', value: '340' }, { label: 'Selectivity gain', value: '+22%' }, { label: 'Pilots', value: '2' }],
  },
  {
    id: 'axiom-robotics', name: 'Axiom Robotics', initials: 'AR',
    tagline: 'Adaptive robotic arms for unstructured environments',
    sector: 'Robotics', stage: 'Seed', invested: '$1.4M',
    valuation: '$11M', multiple: '1.6×', date: 'Nov 2022', house: 'ToolHaus',
    status: 'active', founders: 'Jana Kovač, Dr. Samuel Obi', location: 'Boston, MA',
    description: 'Axiom builds robotic manipulation systems that adapt to unstructured environments using real-time force feedback and vision. Deployed in 3 tier-1 auto suppliers.',
    accent: '#C0CCD8', accentText: '#283858',
    metrics: [{ label: 'Units deployed', value: '12' }, { label: 'Uptime', value: '99.1%' }, { label: 'ARR', value: '$1.6M' }],
  },
  {
    id: 'luminary-energy', name: 'Luminary Energy', initials: 'LE',
    tagline: 'Solid-state batteries using sulfide electrolytes',
    sector: 'Energy Storage', stage: 'Seed', invested: '$1.3M',
    valuation: '$9M', multiple: '1.3×', date: 'May 2023', house: 'TrialHaus',
    status: 'active', founders: 'Dr. Clara Wolff, Remy Durand', location: 'Sydney, AU',
    description: 'Luminary Energy produces solid-state batteries achieving 400 Wh/kg energy density — 2× current lithium-ion — using a proprietary dry electrode process compatible with existing lines.',
    accent: '#C0E0D0', accentText: '#1A6850',
    metrics: [{ label: 'Energy density', value: '400 Wh/kg' }, { label: 'Cycles tested', value: '1,200' }, { label: 'Pilots', value: '3' }],
  },
];

const DEAL_FLOW = [
  { id: 'df1', name: 'Helion Materials',  sector: 'Advanced Materials', stage: 'submitted',  date: 'Jun 10', lead: 'Sarah K.', house: 'FabHaus' },
  { id: 'df2', name: 'ColdFusion Labs',   sector: 'Energy',             stage: 'submitted',  date: 'Jun 8',  lead: 'Mark T.',  house: 'TrialHaus' },
  { id: 'df3', name: 'Auxetic Bio',       sector: 'Synthetic Biology',  stage: 'screening',  date: 'May 28', lead: 'Sarah K.', house: 'CellHaus' },
  { id: 'df4', name: 'PhotonPath',        sector: 'Photonics',          stage: 'screening',  date: 'May 20', lead: 'James L.', house: 'SensorHaus' },
  { id: 'df5', name: 'CrystalMind',       sector: 'Quantum Computing',  stage: 'diligence',  date: 'May 5',  lead: 'Mark T.',  house: 'SensorHaus' },
  { id: 'df6', name: 'Celluform',         sector: 'Biotech',            stage: 'diligence',  date: 'Apr 18', lead: 'Sarah K.', house: 'CellHaus' },
  { id: 'df7', name: 'Ferronika',         sector: 'Materials',          stage: 'term-sheet', date: 'Apr 2',  lead: 'James L.', house: 'FabHaus' },
];

const ACTIVITY = [
  { icon: 'trending-up',  text: 'Biofab Systems (CellHaus) closed Series A — $2.2M invested', time: '2 days ago',   color: 'var(--positive)' },
  { icon: 'dollar-sign',  text: 'Monthly LP report sent for May 2024',                         time: '5 days ago',   color: 'var(--bronze-3)' },
  { icon: 'check',        text: 'Quantum Arc (SensorHaus): first QPU partnership signed',      time: '1 week ago',   color: 'var(--forest-3)' },
  { icon: 'building-2',   text: 'Luminary Energy (TrialHaus) achieved 400 Wh/kg milestone',   time: '2 weeks ago',  color: 'var(--steel-3)' },
  { icon: 'calendar',     text: 'FabHaus Shenzhen cohort applications closed — 7 submitted',   time: '3 weeks ago',  color: 'var(--ink-3)' },
];

window.HOUSES               = HOUSES;
window.PORTFOLIO_COMPANIES  = PORTFOLIO_COMPANIES;
window.DEAL_FLOW            = DEAL_FLOW;
window.ACTIVITY             = ACTIVITY;
