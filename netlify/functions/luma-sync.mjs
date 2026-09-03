/**
 * Pull luma.com/biopunk into the Homeroom calendar, on a schedule.
 *
 * Runs every six hours. Cheap and idempotent: the sweep upserts on the Luma
 * event id via `hr_event_sources`, so a repeated fire updates rows rather than
 * duplicating evenings, and a fire with nothing new does one API call.
 *
 * A NOTE ON WHERE THIS WRITES. Homeroom's SQLite file lives in `/tmp`, which is
 * per-container. A scheduled function runs in its own container, so what this
 * writes is not guaranteed to be the same database the web container is reading
 * from — the sync is genuinely useful only once Homeroom's storage moves
 * somewhere durable (see the storage section of the Homeroom README). It is
 * wired up now because the failure mode is harmless (a container re-syncs on
 * its own next boot) and because leaving the schedule until after the storage
 * move would mean remembering to come back for it.
 *
 * Set LUMA_API_KEY to enable it. Without one it logs and exits, rather than
 * failing the scheduled run.
 */
export default async function lumaSyncHandler() {
  process.env.HOMEROOM_DB ||= '/tmp/haus-homeroom.db';

  const { getDb } = await import('./homeroom/app/db.js');
  const luma = await import('./homeroom/app/luma.js');

  if (!luma.configured()) {
    console.log('[luma] skipped — LUMA_API_KEY is not set');
    return json({ ok: true, ran: false, reason: 'not configured' });
  }

  const db = getDb();
  // Imported events need a local owner. Prefer the configured importer, then
  // the first steward, then the first account: an event with no host cannot be
  // written, and failing the whole sweep over it would be worse than picking.
  const host = process.env.LUMA_IMPORT_AS
    || db.prepare('SELECT id FROM users WHERE is_admin = 1 ORDER BY created_at LIMIT 1').get()?.id
    || db.prepare('SELECT id FROM users ORDER BY created_at LIMIT 1').get()?.id;

  if (!host) {
    console.log('[luma] skipped — no account to attribute imported events to');
    return json({ ok: true, ran: false, reason: 'no host account' });
  }

  const result = await luma.sync({ hostId: host });
  if (!result.ok) {
    console.error(`[luma] ${result.error}${result.partial ? ' (partial import kept)' : ''}`);
    return json({ ok: false, error: result.error, ...result }, result.partial ? 200 : 502);
  }

  console.log(`[luma] ${result.created} added, ${result.updated} updated, ${result.seen} seen`);
  return json({ ok: true, ran: true, ...result });
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export const config = {
  schedule: '0 */6 * * *',
};
