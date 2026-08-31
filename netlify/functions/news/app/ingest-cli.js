/**
 * Run the ingest by hand:
 *   npm run ingest -- --dry     show what would be posted, write nothing
 *   npm run ingest              fetch and post
 */
import { runIngest } from './ingest.js';
import { closeDb } from './db.js';

const dryRun = process.argv.includes('--dry');

const result = await runIngest({ dryRun });

if (dryRun) {
  console.log(`Would post ${result.posted.length} stories:\n`);
  for (const candidate of result.posted) {
    console.log(`  [${candidate.score}] ${candidate.title}`);
    console.log(`         ${candidate.url}`);
    console.log(`         ${candidate.source.name} · ${candidate.topic} · ${candidate.reasons.join(' | ')}\n`);
  }
} else {
  console.log(`Posted ${result.posted.length} stories:`);
  for (const item of result.posted) console.log(`  #${item.id} ${item.title} (${item.by})`);
}

if (result.errors.length) {
  console.log(`\n${result.errors.length} source(s) could not be read:`);
  for (const error of result.errors) console.log(`  ${error.source}: ${error.error}`);
}

closeDb();
