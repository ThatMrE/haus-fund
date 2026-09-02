/**
 * Pull the mentor onboarding form into Homeroom, on a schedule.
 *
 * Runs every six hours. Idempotent: rows match on the Airtable record id, so a
 * repeated fire updates rather than duplicating, and a new submission arrives
 * as `pending` — listed nowhere until a steward rules on it at
 * /homeroom/stewards/mentors.
 *
 * The same caveat as luma-sync.mjs applies, and for the same reason: Homeroom's
 * SQLite file lives in /tmp, which is per-container, so what this writes is not
 * guaranteed to be the database the web container reads. It is wired up now
 * because the failure mode is harmless — a container re-syncs on its own next
 * boot — and because the alternative is remembering to come back for it after
 * the storage move.
 *
 * Fails closed and loud: with no token it logs and exits without touching the
 * roster, and a failed fetch changes nothing at all.
 */
export default async function mentorSyncHandler() {
  process.env.HOMEROOM_DB ||= '/tmp/haus-homeroom.db';

  const { getDb } = await import('./homeroom/app/db.js');
  const sync = await import('./homeroom/app/mentorsync.js');

  if (!sync.configured()) {
    console.log('[mentors] skipped — no Airtable token');
    return json({ ok: true, ran: false, reason: 'not configured' });
  }

  getDb();
  const result = await sync.sync();
  if (!result.ok) {
    console.error(`[mentors] ${result.error} Roster unchanged.`);
    return json({ ok: false, ...result }, 502);
  }

  console.log(`[mentors] ${result.seen} seen, ${result.created} new (pending review), ${result.updated} updated`);
  return json({ ok: true, ran: true, ...result });
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export const config = {
  schedule: '20 */6 * * *',
};
