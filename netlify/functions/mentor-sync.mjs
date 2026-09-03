/**
 * Pull the mentor onboarding form into Homeroom, on a schedule.
 *
 * Runs every six hours. Idempotent: rows match on the Airtable record id, so a
 * repeated fire updates rather than duplicating, and a new submission arrives
 * as `pending` — listed nowhere until a steward rules on it at
 * /homeroom/stewards/mentors.
 *
 * WHERE THIS WRITES. The same Postgres the web containers read. This used to
 * carry a caveat — the SQLite file lived in /tmp, which is per-container, so
 * what a scheduled run imported was not guaranteed to be in the database
 * anybody browsing would see. That was written down as something to come back
 * to after the storage move; the store has moved, and this is that.
 *
 * Fails closed and loud: with no token it logs and exits without touching the
 * roster, and a failed fetch changes nothing at all.
 */
export default async function mentorSyncHandler() {
  const { getDb } = await import('./homeroom/app/db.js');
  const sync = await import('./homeroom/app/mentorsync.js');

  await getDb();

  // The lifecycle pass runs FIRST and unconditionally. Keeping the roster
  // honest — auto-pause, re-confirmation, dormancy — does not depend on
  // Airtable being configured, and a roster nobody prunes is the failure this
  // whole phase exists to prevent.
  const life = await sync.lifecycle();
  if (life.paused || life.reconfirmed || life.dormant || life.nagged) {
    console.log(`[mentors] lifecycle: ${life.paused} paused, ${life.reconfirmed} asked to reconfirm, `
      + `${life.dormant} made dormant, ${life.nagged} outcome nags`);
  }

  if (!sync.configured()) {
    console.log('[mentors] pull skipped — no Airtable token');
    return json({ ok: true, ran: false, reason: 'not configured', life });
  }

  const result = await sync.sync();
  if (!result.ok) {
    console.error(`[mentors] ${result.error} Roster unchanged.`);
    return json({ ok: false, ...result, life }, 502);
  }

  console.log(`[mentors] ${result.seen} seen, ${result.created} new (pending review), ${result.updated} updated`);
  return json({ ok: true, ran: true, ...result, life });
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
