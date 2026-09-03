/**
 * Pull luma.com/biopunk into the Homeroom calendar, on a schedule.
 *
 * Runs every six hours. Cheap and idempotent: the sweep upserts on the Luma
 * event id via `hr_event_sources`, so a repeated fire updates rows rather than
 * duplicating evenings, and a fire with nothing new does one API call.
 *
 * WHERE THIS WRITES. The same Postgres the web containers read, which is what
 * makes a scheduled sync worth having: this runs in its own container, and
 * before the database moved off /tmp anything it imported was invisible to
 * every other one.
 *
 * Set LUMA_API_KEY to enable it. Without one it logs and exits, rather than
 * failing the scheduled run.
 */
export default async function lumaSyncHandler() {

  const { getDb } = await import('./homeroom/app/db.js');
  const luma = await import('./homeroom/app/luma.js');

  if (!luma.configured()) {
    console.log('[luma] skipped — LUMA_API_KEY is not set');
    return json({ ok: true, ran: false, reason: 'not configured' });
  }

  const db = await getDb();
  // Imported events need a local owner. Prefer the configured importer, then
  // the first steward, then the first account: an event with no host cannot be
  // written, and failing the whole sweep over it would be worse than picking.
  const host = process.env.LUMA_IMPORT_AS
    || (await db.prepare('SELECT id FROM users WHERE is_admin = 1 ORDER BY created_at LIMIT 1').get())?.id
    || (await db.prepare('SELECT id FROM users ORDER BY created_at LIMIT 1').get())?.id;

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
