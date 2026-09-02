/**
 * The morning run, on a schedule.
 *
 * Scheduled hourly and gated on the configured timezone rather than pinned to a
 * UTC hour — see app/schedule.js for why. Set NEWS_RUN_HOUR / NEWS_TZ to move
 * it; NEWS_INGEST_FORCE=1 runs it regardless, which is useful right after a
 * deploy.
 *
 * Beyond the sweep it also builds the day's issues and pays out the vote
 * milestones. All three are idempotent, so a repeated fire costs nothing.
 */
export default async function ingestHandler() {
  process.env.BIOPUNK_DB ||= '/tmp/haus-news.db';
  process.env.NEWS_BASE_PATH ||= '/news';

  const { initDb } = await import('./news/app/db/index.js');
  const { shouldRunNow, localDateParts, isoWeekday, FIELD_NOTES_WEEKDAY, LIVE_WEEKDAY } =
    await import('./news/app/schedule.js');
  const { runIngest } = await import('./news/app/ingest.js');
  const { buildDigest } = await import('./news/app/digests.js');
  const { awardVoteMilestones } = await import('./news/app/points.js');

  const db = await initDb();
  const lastRun = (await db.get("SELECT MAX(created_at) AS at FROM items WHERE source = 'agent'")).at;

  const decision = shouldRunNow({ lastRunAt: lastRun });
  const forced = process.env.NEWS_INGEST_FORCE === '1';

  if (!decision.run && !forced) {
    console.log(`[ingest] skipped — ${decision.reason}`);
    return new Response(JSON.stringify({ ok: true, ran: false, reason: decision.reason }), {
      headers: { 'content-type': 'application/json' },
    });
  }

  const result = await runIngest();
  console.log(
    `[ingest] posted ${result.posted.length} stories` +
      (result.errors.length ? `; ${result.errors.length} agent(s) failed` : ''),
  );
  for (const row of result.agents) {
    console.log(`[ingest] ${row.agent}: fetched ${row.fetched}, posted ${row.selected}${row.error ? `, failed: ${row.error}` : ''}`);
  }

  // The issues run off the same wake-up, after the sweep, so the morning's
  // stories are in the day's Bench Notes.
  const built = [];
  const now = new Date();
  const bench = await buildDigest('bench-notes');
  if (bench.created) built.push(bench.digest.slug);

  const weekday = isoWeekday(now);
  if (weekday === FIELD_NOTES_WEEKDAY) {
    const field = await buildDigest('field-notes');
    if (field.created) built.push(`field-notes ${field.digest.slug}`);
  }
  if (weekday === LIVE_WEEKDAY) {
    const live = await buildDigest('live');
    if (live.created) built.push(`live ${live.digest.slug}`);
  }

  const paid = await awardVoteMilestones();
  console.log(`[ingest] issues: ${built.join(', ') || 'none new'}; ${paid} scout points awarded`);

  return new Response(
    JSON.stringify({
      ok: true,
      ran: true,
      posted: result.posted.length,
      agents: result.agents,
      issues: built,
      pointsAwarded: paid,
      date: localDateParts(now).iso,
      errors: result.errors,
    }),
    { headers: { 'content-type': 'application/json' } },
  );
}

export const config = {
  schedule: '0 * * * *',
};
