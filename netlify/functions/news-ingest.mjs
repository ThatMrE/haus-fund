/**
 * The morning ingest, on a schedule.
 *
 * Scheduled hourly and gated on the configured timezone rather than pinned to a
 * UTC hour — see app/schedule.js for why. Set NEWS_RUN_HOUR / NEWS_TZ to move
 * it; NEWS_INGEST_FORCE=1 runs it regardless, which is useful right after a
 * deploy.
 */
export default async function ingestHandler() {
  process.env.BIOPUNK_DB ||= '/tmp/haus-news.db';
  process.env.NEWS_BASE_PATH ||= '/news';

  const { getDb } = await import('./news/app/db.js');
  const { shouldRunNow } = await import('./news/app/schedule.js');
  const { runIngest } = await import('./news/app/ingest.js');

  const db = getDb();
  const lastRun = db
    .prepare("SELECT MAX(created_at) AS at FROM items WHERE source = 'agent'")
    .get().at;

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
      (result.errors.length ? `; ${result.errors.length} source(s) failed` : ''),
  );
  for (const error of result.errors) console.warn(`[ingest] ${error.source}: ${error.error}`);

  return new Response(
    JSON.stringify({ ok: true, ran: true, posted: result.posted.length, errors: result.errors }),
    { headers: { 'content-type': 'application/json' } },
  );
}

export const config = {
  schedule: '0 * * * *',
};
