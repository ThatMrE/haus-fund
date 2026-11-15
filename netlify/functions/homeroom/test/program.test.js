/*
 * The program layer: batches, groups, the weekly check-in, goals, sessions,
 * Demo Day, investors and milestones.
 *
 * Groundwork only, so these tests are about the tables, not the screens: that
 * they exist on both backends, that a row which should be refused is refused,
 * and that the rules written into the schema (one check-in a week, one
 * interest per investor per company, an investor's email counted once) hold
 * at the database rather than only in code that does not exist yet.
 */

process.env.HOMEROOM_DB = ':memory:';
// Runs on SQLite by default. With HOMEROOM_TEST_DATABASE_URL set it runs the
// same assertions against Postgres, which is the dialect production uses.
const PG_URL = process.env.HOMEROOM_TEST_DATABASE_URL || '';
if (PG_URL) process.env.HOMEROOM_DATABASE_URL = PG_URL;

import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as sql from '../app/sql.js';
import { migrate, schemaFor, toPostgres } from '../app/db.js';

if (PG_URL) after(async () => sql.close());

const PROGRAM_TABLES = [
  'hr_batches', 'hr_groups', 'hr_batch_companies', 'hr_batch_members',
  'hr_kpis', 'hr_checkins', 'hr_sessions', 'hr_session_attendance', 'hr_goals',
  'hr_lead_mentors', 'hr_demo_days', 'hr_demo_profiles', 'hr_investors',
  'hr_demo_access', 'hr_investor_interest', 'hr_milestones',
];

const now = 1_800_000_000;
let batch, group, org, kpi, demo, investor;

async function refused(statement, ...params) {
  await assert.rejects(() => sql.run(statement, ...params), /constraint|CHECK|UNIQUE/i);
}

before(async () => {
  if (PG_URL) await sql.exec('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await migrate({ force: true });
  for (const id of ['u-founder', 'u-lead', 'u-steward', 'u-investor']) {
    await sql.run('INSERT INTO users (id, email, password_hash, karma, created_at, is_admin) VALUES (?, ?, ?, 1, ?, 0)',
      id, `${id}@example.com`, 'x', now);
  }
  org = (await sql.run("INSERT INTO hr_orgs (slug, name, created_by, created_at, updated_at) VALUES ('acme-bio', 'Acme Bio', 'u-founder', ?, ?)", now, now)).id;
  batch = (await sql.run("INSERT INTO hr_batches (slug, name, program, house, starts_at, ends_at, status, created_at) VALUES ('spring-2027-punkhaus', 'Spring 2027', 'Residency', 'PunkHaus', ?, ?, 'planned', ?)", now, now + 90 * 86400, now)).id;
  group = (await sql.run("INSERT INTO hr_groups (batch_id, name, focus, lead_id, created_at) VALUES (?, 'Group A', 'therapeutics', 'u-lead', ?)", batch, now)).id;
  kpi = (await sql.run("INSERT INTO hr_kpis (org_id, name, unit, is_primary, created_at) VALUES (?, 'Pilot customers', 'customers', 1, ?)", org, now)).id;
  demo = (await sql.run("INSERT INTO hr_demo_days (batch_id, title, starts_at, created_at) VALUES (?, 'Spring 2027 showcase', ?, ?)", batch, now + 85 * 86400, now)).id;
  investor = (await sql.run("INSERT INTO hr_investors (name, firm, email, kind, created_at) VALUES ('Pat Investor', 'Example Ventures', 'pat@example.com', 'fund', ?)", now)).id;
});

test('every program table exists', async () => {
  const rows = PG_URL
    ? await sql.all("SELECT table_name AS name FROM information_schema.tables WHERE table_schema = 'public'")
    : await sql.all("SELECT name FROM sqlite_master WHERE type = 'table'");
  const names = new Set(rows.map((r) => r.name));
  for (const t of PROGRAM_TABLES) assert.ok(names.has(t), `${t} is missing`);
});

test('the Postgres schema describes the same program tables', () => {
  const pg = schemaFor('postgres');
  for (const t of PROGRAM_TABLES) assert.match(pg, new RegExp(`CREATE TABLE IF NOT EXISTS ${t} \\(`), `${t} is missing from the Postgres DDL`);
  assert.doesNotMatch(toPostgres('kpi_value REAL'), /\bREAL\b/, 'REAL must become DOUBLE PRECISION');
});

test('a table is never referenced before it is created, which Postgres refuses', () => {
  const ddl = schemaFor('postgres');
  const created = [];
  const re = /CREATE TABLE IF NOT EXISTS (\w+)\s*\(([\s\S]*?)\n\);/g;
  let m;
  while ((m = re.exec(ddl))) {
    for (const [, ref] of m[2].matchAll(/REFERENCES (\w+)\(/g)) {
      if (ref !== m[1]) assert.ok(created.includes(ref), `${m[1]} references ${ref} before ${ref} exists`);
    }
    created.push(m[1]);
  }
});

test('the batch status is a closed set', async () => {
  await refused("INSERT INTO hr_batches (slug, name, starts_at, ends_at, status, created_at) VALUES ('x', 'X', 1, 2, 'running', 1)");
});

test('a company joins a batch once, in one group', async () => {
  await sql.run('INSERT INTO hr_batch_companies (batch_id, org_id, group_id, joined_at) VALUES (?, ?, ?, ?)', batch, org, group, now);
  await refused('INSERT INTO hr_batch_companies (batch_id, org_id, group_id, joined_at) VALUES (?, ?, ?, ?)', batch, org, group, now);
});

test('alumni is a status a member moves to, not a deletion', async () => {
  await sql.run('INSERT INTO hr_batch_members (batch_id, user_id, org_id, joined_at) VALUES (?, ?, ?, ?)', batch, 'u-founder', org, now);
  await sql.run("UPDATE hr_batch_members SET status = 'alumni' WHERE batch_id = ? AND user_id = ?", batch, 'u-founder');
  const row = await sql.get('SELECT status FROM hr_batch_members WHERE batch_id = ? AND user_id = ?', batch, 'u-founder');
  assert.equal(row.status, 'alumni');
  await refused("UPDATE hr_batch_members SET status = 'deleted' WHERE user_id = 'u-founder'");
});

test('one check-in per company per week, and morale stays on its scale', async () => {
  await sql.run("INSERT INTO hr_checkins (org_id, batch_id, author_id, week, kpi_id, kpi_value, morale, users_talked, created_at) VALUES (?, ?, 'u-founder', '2027-01-18', ?, 3, 8, 12, ?)", org, batch, kpi, now);
  await refused("INSERT INTO hr_checkins (org_id, author_id, week, created_at) VALUES (?, 'u-founder', '2027-01-18', ?)", org, now);
  await refused("INSERT INTO hr_checkins (org_id, author_id, week, morale, created_at) VALUES (?, 'u-founder', '2027-01-25', 11, ?)", org, now);
  await refused("INSERT INTO hr_checkins (org_id, author_id, week, created_at) VALUES (?, 'u-founder', 'Jan 25', ?)", org, now);
  const back = await sql.get('SELECT kpi_value FROM hr_checkins WHERE org_id = ? AND week = ?', org, '2027-01-18');
  assert.equal(Number(back.kpi_value), 3);
});

test('a goal set in a session closes as met, missed or dropped', async () => {
  const session = (await sql.run("INSERT INTO hr_sessions (group_id, starts_at, created_by, created_at) VALUES (?, ?, 'u-lead', ?)", group, now, now)).id;
  await sql.run("INSERT INTO hr_session_attendance (session_id, user_id) VALUES (?, 'u-founder')", session);
  const goal = (await sql.run("INSERT INTO hr_goals (org_id, batch_id, session_id, title, kpi_id, target, created_by, created_at) VALUES (?, ?, ?, 'Sign 2 pilots', ?, 2, 'u-lead', ?)", org, batch, session, kpi, now)).id;
  await sql.run("UPDATE hr_goals SET state = 'met', closed_at = ? WHERE id = ?", now, goal);
  await refused("UPDATE hr_goals SET state = 'almost' WHERE id = ?", goal);
});

test('an investor email is counted once, whatever its case', async () => {
  await refused("INSERT INTO hr_investors (name, email, created_at) VALUES ('Pat Again', 'PAT@example.com', ?)", now);
});

test('an investor shows interest in a company once per Demo Day, and starts unanswered', async () => {
  await sql.run("INSERT INTO hr_demo_access (demo_day_id, investor_id, granted_by, granted_at) VALUES (?, ?, 'u-steward', ?)", demo, investor, now);
  await sql.run("INSERT INTO hr_investor_interest (demo_day_id, investor_id, org_id, level, created_at) VALUES (?, ?, ?, 'meeting', ?)", demo, investor, org, now);
  await refused("INSERT INTO hr_investor_interest (demo_day_id, investor_id, org_id, created_at) VALUES (?, ?, ?, ?)", demo, investor, org, now);
  const row = await sql.get('SELECT founder_reply FROM hr_investor_interest WHERE investor_id = ?', investor);
  assert.equal(row.founder_reply, 'pending', 'nothing reaches the investor until the founder answers');
});

test('a Demo Day profile is unpublished until the founder publishes it', async () => {
  await sql.run("INSERT INTO hr_demo_profiles (demo_day_id, org_id, one_liner, updated_at) VALUES (?, ?, 'Enzymes that eat PFAS', ?)", demo, org, now);
  const row = await sql.get('SELECT published FROM hr_demo_profiles WHERE demo_day_id = ? AND org_id = ?', demo, org);
  assert.equal(Number(row.published), 0);
});

test('a milestone is private unless the founder makes it public', async () => {
  await sql.run("INSERT INTO hr_milestones (org_id, kind, title, posted_by, created_at) VALUES (?, 'grant', 'Won an SBIR Phase I', 'u-founder', ?)", org, now);
  const row = await sql.get('SELECT public FROM hr_milestones WHERE org_id = ?', org);
  assert.equal(Number(row.public), 0);
  await refused("INSERT INTO hr_milestones (org_id, kind, title, posted_by, created_at) VALUES (?, 'ipo-rumour', 'x', 'u-founder', ?)", org, now);
});

test('an event can be pinned to a batch calendar', async () => {
  const cols = PG_URL
    ? await sql.all("SELECT column_name AS name FROM information_schema.columns WHERE table_name = 'hr_events'")
    : await sql.all("SELECT name FROM pragma_table_info('hr_events')");
  assert.ok(cols.some((c) => c.name === 'batch_id'));
});

test('on Postgres, every Homeroom table is closed to the public Data API', { skip: PG_URL ? false : 'Postgres only' }, async () => {
  const open = await sql.all(`SELECT c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity`);
  assert.deepEqual(open.map((r) => r.name), [], 'a table without RLS is readable with the publishable key on Supabase');
});

test('on Postgres, a role that is not the owner reads nothing, even when granted SELECT', { skip: PG_URL ? false : 'Postgres only' }, async () => {
  // Supabase grants the anon role SELECT on new public tables. Imitate that
  // and confirm RLS, not the grant, is what keeps the rows in.
  const rows = await sql.tx(async (q) => {
    await q.run("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon_probe') THEN CREATE ROLE anon_probe NOLOGIN; END IF; END $$;");
    await q.run('GRANT USAGE ON SCHEMA public TO anon_probe; GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon_probe;');
    await q.run('SET LOCAL ROLE anon_probe');
    const users = await q.all('SELECT id FROM users');
    const investors = await q.all('SELECT email FROM hr_investors');
    return { users: users.length, investors: investors.length };
  });
  assert.deepEqual(rows, { users: 0, investors: 0 });
  assert.ok(Number(await sql.value('SELECT COUNT(*) FROM users')) > 0, 'the owner still sees every row');
});
