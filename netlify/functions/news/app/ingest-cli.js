/**
 * Run the sweep by hand:
 *   npm run ingest -- --dry     show what each agent returned, write nothing
 *   npm run ingest              fetch and post
 *
 * The dry run is the way to verify the agents against live servers: it prints
 * what every one of them fetched and selected, including the ones that failed.
 */
import { runIngest } from './ingest.js';
import { closeDb, initDb, describeTarget } from './db/index.js';

const dryRun = process.argv.includes('--dry');

const target = describeTarget();
console.log(`Database: ${target.driver}${target.driver === 'sqlite' ? ` (${target.path})` : ''}\n`);

await initDb();
const result = await runIngest({ dryRun });

console.log('Agent                fetched  selected  status');
for (const row of result.agents) {
  const status = row.error ? `failed: ${row.error}` : 'ok';
  console.log(
    `${row.agent.padEnd(20)} ${String(row.fetched).padStart(7)} ${String(row.selected).padStart(9)}  ${status}`,
  );
}
console.log('');

if (dryRun) {
  console.log(`Would post ${result.posted.length} stories:\n`);
  for (const candidate of result.posted) {
    console.log(`  [${candidate.score.toFixed(1)}] ${candidate.title}`);
    console.log(`         ${candidate.url}`);
    console.log(`         ${candidate.agent.label} · ${candidate.topic}${candidate.note ? ` · ${candidate.note}` : ''}\n`);
  }
} else {
  console.log(`Posted ${result.posted.length} stories:`);
  for (const item of result.posted) console.log(`  #${item.id} ${item.title} (${item.by})`);
}

if (result.errors.length) {
  console.log(`\n${result.errors.length} agent(s) could not be read:`);
  for (const error of result.errors) console.log(`  ${error.agent}: ${error.error}`);
}

await closeDb();
