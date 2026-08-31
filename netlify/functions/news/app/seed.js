/**
 * Sample content, so a fresh checkout has a feed to look at and the layout can
 * be judged with something in it.
 *
 * Everything below is FICTIONAL DEMO DATA written for local development. The
 * companies do not exist, the rounds did not happen, the links are
 * illustrative, and none of it should be read as reporting. In a real
 * deployment the morning ingest fills this role instead — see ingest.js.
 * Run `npm run reset` to wipe and re-seed.
 */
import { getDb, closeDb } from './db.js';
import { hashPassword } from './auth.js';
import * as db from './models.js';
import { nowSeconds } from './util.js';

const HOUR = 3600;

/** Deterministic PRNG so repeat seeds produce the same feed. */
function makeRandom(seed = 42) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const USERS = [
  ['nora_bench', 'Founder, protein design. Second company; the first one taught me about COGS.'],
  ['sam_scaleup', 'Process development. I make things work at 500 L that worked at 5 L.'],
  ['dr_ravindra', 'Translational oncology. Formerly clinic, now company side.'],
  ['tessa_seed', 'Seed investor in tools and platforms. I read every deck, badly.'],
  ['ken_assay', 'Assay development and reproducibility. Ask me why your CV is 40%.'],
  ['marta_reg', 'Regulatory affairs consultant. CMC is where timelines go to die.'],
  ['iheanyi_bio', 'Biomanufacturing in Lagos and Lisbon. Fermentation, mostly food.'],
  ['june_hardware', 'Open lab hardware. Everything I ship is documented.'],
  ['paolo_gtm', 'Commercial lead. I have sold to core facilities, which is its own sport.'],
  ['ann_neuro', 'Neurotech founder. Organoids, electrodes, and the ethics thereof.'],
];

const STORIES = [
  ['Aria Bio raises $18M Series A to put protein design under a wet-lab loop', 'https://www.example-wire.com/aria-series-a', 'crispr', 'nora_bench', 214, 4],
  ['Show: the seed-stage CMC checklist we wish someone had handed us', 'https://www.example-notes.org/cmc-checklist', 'therapeutics', 'marta_reg', 187, 9],
  ['Ask: what did your first Series A diligence actually dig into?', null, 'funding', 'tessa_seed', 156, 6],
  ['Halden Therapeutics emerges from stealth with $7M seed for oral biologics', 'https://www.example-wire.com/halden-seed', 'therapeutics', 'dr_ravindra', 143, 12],
  ['The reproducibility problem in early-stage data rooms', 'https://www.example-journal.org/data-room-reproducibility', 'bioinformatics', 'ken_assay', 138, 16],
  ['Show: an open turbidostat that costs $900 and logs to a plain CSV', 'https://github.com/example/open-turbidostat', 'hardware', 'june_hardware', 129, 8],
  ['Precision fermentation hits $2/kg at pilot scale — what it means for seed-stage food', 'https://www.example-biomanufacturing.org/scp-cost-curve', 'biomanufacturing', 'iheanyi_bio', 118, 14],
  ['Spinout terms are getting worse: 8 university deals, compared', 'https://www.example-analysis.org/spinout-terms-2026', 'funding', 'tessa_seed', 112, 22],
  ['Vantage Neuro raises $11M seed to grow cortical organoids on custom arrays', 'https://www.example-wire.com/vantage-seed', 'neuro', 'ann_neuro', 104, 11],
  ['Ask: how are you pricing a platform deal at pre-clinical stage?', null, 'funding', 'paolo_gtm', 97, 31],
  ['DNA synthesis screening: the baseline every seed-stage company should meet', 'https://www.example-policy.org/synthesis-screening', 'biosecurity', 'marta_reg', 94, 19],
  ['Two founders, one bioreactor: what our first 500 L run actually cost', 'https://www.example-notes.org/first-500l', 'biomanufacturing', 'sam_scaleup', 88, 7],
  ['Show: a benchtop assay rig we built for $4k after three vendor quotes', 'https://github.com/example/benchtop-assay', 'hardware', 'june_hardware', 83, 13],
  ['Seed-stage oncology is crowded — here is where it is not', 'https://www.example-analysis.org/oncology-whitespace', 'therapeutics', 'dr_ravindra', 79, 27],
  ['Kestrel Bio closes an oversubscribed $9M seed for enzyme discovery', 'https://www.example-wire.com/kestrel-seed', 'synbio', 'nora_bench', 76, 9],
  ['Ask: what killed your first company — the science or the burn rate?', null, 'funding', 'sam_scaleup', 71, 44],
  ['Structure prediction is solved. Function, and the assay, are not.', 'https://www.example-journal.org/function-gap', 'bioinformatics', 'ken_assay', 68, 18],
  ['Residency programs produced 41 biotech spinouts last year', 'https://www.example-analysis.org/residency-census', 'funding', 'tessa_seed', 64, 5],
  ['Contract manufacturing quotes, unredacted: 6 CDMOs for the same molecule', 'https://www.example-notes.org/cdmo-quotes', 'biomanufacturing', 'sam_scaleup', 61, 10],
  ['Show: our lab notebook is plain text files and a Makefile', 'https://github.com/example/plaintext-lab', 'bioinformatics', 'ken_assay', 58, 25],
  ['Gene therapy pricing is a manufacturing problem, not a science problem', 'https://www.example-analysis.org/gene-therapy-cogs', 'therapeutics', 'ann_neuro', 54, 21],
  ['The FDA draft guidance on decentralised manufacturing, annotated', 'https://www.example-policy.org/decentralised-manufacturing', 'biosecurity', 'marta_reg', 49, 12],
  ['Ask: anyone building a company entirely on second-hand equipment?', null, 'hardware', 'june_hardware', 46, 33],
  ['Meridian Labs spins out of ETH with $5M to industrialise directed evolution', 'https://www.example-wire.com/meridian-spinout', 'synbio', 'nora_bench', 44, 8],
  ['A dye-free viability assay cheap enough for a seed-stage budget', 'https://www.example-protocols.org/viability-assay', 'bioinformatics', 'ken_assay', 41, 6],
  ['Longevity clinics are selling interventions with no endpoint', 'https://www.example-journal.org/clinic-critique', 'longevity', 'dr_ravindra', 38, 29],
  ['Show: bioreactor firmware rewritten in Rust, now open source', 'https://github.com/example/ferment-rs', 'hardware', 'iheanyi_bio', 35, 9],
  ['Neural organoid recordings released as an open dataset (2.4 TB)', 'https://www.example-datasets.org/organoid-mea', 'neuro', 'ann_neuro', 31, 4],
  ['What a biotech seed round actually looks like in 2026', 'https://www.example-analysis.org/seed-terms-2026', 'funding', 'tessa_seed', 27, 15],
  ['Ask: first commercial hire at a 6-person biotech — who, and when?', null, 'funding', 'paolo_gtm', 24, 17],
  ['Cold chain without the cold: trehalose stabilisation for field diagnostics', 'https://www.example-journal.org/trehalose-field', 'therapeutics', 'dr_ravindra', 21, 5],
  ['A benchtop sequencer teardown, with schematics', 'https://www.example-teardown.org/benchtop-sequencer', 'hardware', 'june_hardware', 18, 11],
];

const LURKER_STEMS = [
  'agar', 'anneal', 'blot', 'buffer', 'clone', 'ferment', 'gel', 'incubate',
  'ligase', 'lysate', 'micron', 'primer', 'sterile', 'vector',
];

const COMMENTS = [
  'The round size is doing a lot of work in this headline. $18M post-seed with a $60M pre is a very different company from $18M at $25M pre, and the release says neither.',
  'Pre was $52M. It is in the filing, not the release, which tells you something about who the release was for.',
  'We ran the same play two years ago and the wet-lab loop was the part that slipped. Budget twice the cycle time you think you need, then add the shipping.',
  'Agreed on cycle time. The thing nobody warns you about is that every external assay adds a week of scheduling, not a day of work.',
  'This checklist is the first one I have seen that puts stability studies before the pilot batch rather than after. That ordering alone saves a quarter.',
  'Because we did it in the wrong order and paid for it. The checklist is basically a list of our invoices.',
  'Diligence dug into three things: the assay, the freedom to operate, and whether the second employee would stay. In that order, and the third one nearly killed it.',
  'Seconding the FTO point. We lost six weeks to a patent search that should have taken two, because nobody owned it internally.',
  'Every "emerges from stealth" story is a company that has been talking to investors for eighteen months. Stealth is a press strategy, not a state.',
  'That is fair but uncharitable. Some of us were quiet because there was nothing to say yet.',
  'The reproducibility argument always ends at "we need better metadata" and never at "we need to fund replication". Metadata is cheap to advocate for.',
  'In a data room it is worse: nobody is checking, so the incentive runs the other way.',
  '$900 for a turbidostat is real, but the BOM excludes the pump, which is where the money is. Line 14 is a $22 board; the pump is $180 and fails first.',
  'Fair. Pump is in the enclosure BOM, not the electronics one. That is a documentation bug, not a pricing one — I will merge the two files.',
  'The $2/kg figure is at 500 L. Everything changes at 50,000 L and the report says so, to its credit. Foam control alone eats the margin.',
  'Having run the 50k L version: it is foam, then it is the sterilisation cycle, then it is the fact that your operators want weekends.',
  'University spinout terms have not got worse so much as the good deals stopped being publicised. The median was always this bad.',
  'Depends heavily on the institution. Two of the eight in that table will negotiate; the other six hand you a template and leave the room.',
  'Pricing a platform deal pre-clinical is mostly pricing optionality. We ended up on a small upfront and heavy milestones, which the board hated and I would do again.',
  'The milestone structure matters more than the number. Tie them to things you control, not to their internal timelines.',
  'Biosafety take: screening at the synthesis provider is necessary and nowhere near sufficient. The gap is benchtop devices, and nobody wants to regulate those yet.',
  'Which is the argument for making it a procurement requirement rather than a law. Funders move faster than legislatures.',
  'Publishing your first 500 L cost breakdown is genuinely useful and slightly reckless. Thank you for the second part.',
  'It stopped being a competitive advantage the moment three other people asked me for the same spreadsheet.',
  'Second-hand equipment is fine until you need a service contract for an audit. Buy from a closing pharma site, not a university surplus sale — the paperwork comes with it.',
  'This matches my experience. Also: never buy a -80 freezer sight unseen.',
  'Every time gene therapy pricing comes up, someone says manufacturing and then nobody funds manufacturing. It is the least glamorous line in every deck.',
  'We had a term sheet that explicitly cut the CMC budget to make the burn look better. We declined, and it took another five months to close.',
  'First commercial hire at six people is almost always too early unless you are selling to core facilities, where the sales cycle is so long you have to start now.',
  'Started at eight. Should have been twelve. The founder can do the first thirty conversations, and should.',
  'The trehalose field data is what makes this worth reading. 40 degrees for six weeks is a real number from a real place, not a stability chamber.',
  'The teardown is good. Note the flow cell is still proprietary, so "open" has a ceiling here.',
];

function seed({ reset = false } = {}) {
  const instance = getDb();

  if (reset) {
    instance.exec('DELETE FROM votes; DELETE FROM flags; DELETE FROM favorites; DELETE FROM sessions; DELETE FROM items; DELETE FROM users;');
    instance.exec("DELETE FROM sqlite_sequence WHERE name = 'items'");
  }

  if (instance.prepare('SELECT COUNT(*) AS n FROM users').get().n > 0 && !reset) {
    console.log('Database already has content — nothing to seed. Use `npm run reset` to start over.');
    return;
  }

  const random = makeRandom(1312);
  const now = nowSeconds();

  for (const [id, about] of USERS) {
    db.createUser({ id, passwordHash: hashPassword(`${id}-demo-pass`) });
    db.updateUser(id, { about });
  }
  // A moderator handle, so admin paths are exercised too.
  db.createUser({ id: 'curator', passwordHash: hashPassword('curator-demo-pass'), isAdmin: true });
  db.updateUser('curator', { about: 'Moderation and cleanup. Flag things; I read the queue.' });

  const storyIds = [];
  STORIES.forEach(([title, url, topic, author, targetPoints, commentCount], index) => {
    // Spread submissions over the last five days, newest first in the list.
    const age = Math.floor((index * 3.4 + random() * 5) * HOUR);
    const id = db.createStory({
      by: author,
      title,
      url,
      text: url ? null : askText(title),
      topic,
      kind: url ? (title.startsWith('Show:') ? 'show' : 'link') : 'ask',
    });
    getDb().prepare('UPDATE items SET created_at = ? WHERE id = ?').run(now - age, id);
    storyIds.push({ id, author, targetPoints, commentCount, createdAt: now - age });
  });

  // A wider pool of quiet accounts so vote counts can actually differentiate
  // stories — every point on the site is a real row in the votes table.
  const lurkers = LURKER_STEMS.flatMap((stem, i) =>
    [1, 2, 3, 4, 5, 6].map((n) => `${stem}${(i + n * 7) % 97}`),
  ).slice(0, 72);
  // One shared hash for the quiet accounts: scrypt is deliberately slow, and
  // hashing 72 throwaway logins individually makes seeding take seconds.
  const lurkerHash = hashPassword('lurker-demo-pass');
  for (const id of lurkers) db.createUser({ id, passwordHash: lurkerHash });

  const handles = [...USERS.map(([id]) => id), 'curator', ...lurkers];

  // Votes: real rows in the votes table, so unvoting and karma both behave.
  for (const story of storyIds) {
    const voters = pickVoters(handles, story.author, story.targetPoints, random);
    for (const voter of voters) db.vote(voter, story.id);
  }

  // Comments, threaded: some replies attach to earlier comments on the same story.
  let commentCursor = 0;
  for (const story of storyIds) {
    const wanted = Math.min(story.commentCount, 6);
    const posted = [];
    for (let i = 0; i < wanted; i++) {
      const text = COMMENTS[commentCursor++ % COMMENTS.length];
      const author = handles[Math.floor(random() * handles.length)];
      if (author === story.author && i === 0) continue;
      const parent = posted.length && random() < 0.45 ? posted[Math.floor(random() * posted.length)] : story.id;
      const id = db.createComment({ by: author, parentId: parent, text });
      const age = Math.max(60, Math.floor((now - story.createdAt) * (0.15 + random() * 0.7)));
      getDb().prepare('UPDATE items SET created_at = ? WHERE id = ?').run(now - age, id);
      posted.push(id);
      for (const voter of pickVoters(handles, author, Math.floor(random() * 14) + 1, random)) {
        db.vote(voter, id);
      }
    }
    // Keep the story's cached comment count honest after the loop's skips.
    getDb()
      .prepare("UPDATE items SET comment_count = (SELECT COUNT(*) FROM items c WHERE c.story_id = ? AND c.type = 'comment' AND c.deleted = 0) WHERE id = ?")
      .run(story.id, story.id);
  }

  const stats = db.siteStats();
  console.log(`Seeded ${stats.stories} submissions, ${stats.comments} comments, ${stats.votes} votes, ${stats.users} handles.`);
  console.log('Demo logins: any named handle with password "<handle>-demo-pass" (e.g. nora_bench / nora_bench-demo-pass).');
  console.log('The quiet vote-only accounts all share the passphrase "lurker-demo-pass".');
  console.log('All seed content is fictional sample data.');
}

function pickVoters(handles, author, wanted, random) {
  const pool = handles.filter((h) => h !== author);
  const chosen = new Set();
  const count = Math.min(pool.length, Math.max(0, Math.round(wanted / 3)));
  while (chosen.size < count) chosen.add(pool[Math.floor(random() * pool.length)]);
  return [...chosen];
}

function askText(title) {
  return `${title.replace(/^Ask:\s*/, '')}\n\nContext, constraints and what I have already tried are below — replies with concrete numbers appreciated over general encouragement.`;
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  seed({ reset: process.argv.includes('--reset') });
  closeDb();
}

export { seed };
