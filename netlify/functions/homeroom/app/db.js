import * as sql from './sql.js';
import { HOMEROOM_SCHEMA, ACCOUNT_SCHEMA, ADDED_COLUMNS } from './schema.js';

export { ACCOUNT_SCHEMA, ADDED_COLUMNS };

export * from './sql.js';

/**
 * Schema, migrations, and the SQLite dialect made portable.
 *
 * `schema.js` stays the single source of truth and stays written in SQLite, so
 * `npm start` and 232 tests keep working with nothing configured. `toPostgres`
 * below translates it on the way out. Generating the Postgres DDL rather than
 * maintaining a second copy is the whole point: two schemas drift, and the
 * drift is silent until a column is missing in production only.
 */

/**
 * SQLite DDL to Postgres DDL.
 *
 * Deliberately small. It handles exactly the constructs `schema.js` uses, and
 * throws nothing away silently — anything it does not recognise passes through
 * and Postgres complains loudly, which is the failure mode to want.
 */
export function toPostgres(ddl) {
  return ddl
    // Autoincrementing keys. IDENTITY over SERIAL: it is the standard spelling
    // and it does not leave a stray sequence with its own permissions.
    .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/g,
             'BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY')
    // Epoch seconds in INTEGER columns overflow int4 in 2038. Everything here
    // is a timestamp or a small counter, so widening all of them is safe and
    // cheaper than auditing which is which.
    .replace(/\bINTEGER\b/g, 'BIGINT')
    .replace(/\bREAL\b/g, 'DOUBLE PRECISION')
    // Postgres has no NOCASE collation. The four query sites that wanted it now
    // say lower() instead, which both engines speak — so this is a safety net
    // for DDL rather than the actual fix. A COLLATE that reached Postgres at
    // runtime would fail inside a query, where no schema translation can help.
    .replace(/ COLLATE NOCASE/g, '');
}

/** The whole schema, in the dialect the configured backend speaks. */
export function schemaFor(backend) {
  const ddl = ACCOUNT_SCHEMA + HOMEROOM_SCHEMA + addedColumnsDdl();
  return backend === 'postgres' ? toPostgres(ddl) : ddl;
}

/**
 * Accounts and sessions. Homeroom owns its own, rather than borrowing an
 * identity provider: it is one table, one scrypt hash, and one signed cookie,
 * and it keeps the whole thing deployable with nothing to sign up for.
 */


/*
 * Columns added after the first release.
 *
 * CREATE TABLE IF NOT EXISTS is enough for a new table and does nothing for a
 * new column, so added columns are listed here and applied one at a time.
 * SQLite has no ADD COLUMN IF NOT EXISTS, and it is cheaper to attempt the
 * ALTER and ignore the duplicate-column error than to parse table_info on
 * every boot.
 */



/**
 * Added columns, as DDL rather than as attempted ALTERs.
 *
 * SQLite has no ADD COLUMN IF NOT EXISTS and Postgres does, so the old
 * try-and-swallow-the-error loop becomes one statement per column on Postgres
 * and stays a loop on SQLite.
 */
function addedColumnsDdl() {
  return ADDED_COLUMNS
    .map(([table, column, type]) => `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} ${type};`)
    .join('\n');
}

let migrated = false;

/**
 * The synchronous handle, migrated, for tests and terminal scripts.
 *
 * SQLite's migration is genuinely synchronous, so this can keep the old
 * contract exactly: call it, get a migrated database. On Postgres it throws —
 * see `rawSqlite`.
 */
export function getDb() {
  return sql.rawSqlite();
}

/**
 * Bring the database up to the current schema.
 *
 * Idempotent and safe to call on every boot, which is what a serverless
 * container needs — there is no deploy step to hang a migration off.
 */
export async function migrate({ force = false } = {}) {
  if (migrated && !force) return;
  const backend = sql.backend();
  if (backend === 'postgres') {
    await sql.exec(schemaFor('postgres'));
  } else {
    await sql.exec(ACCOUNT_SCHEMA);
    await sql.exec(HOMEROOM_SCHEMA);
    for (const [table, column, type] of ADDED_COLUMNS) {
      try {
        await sql.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
      } catch (err) {
        // "duplicate column name" is the expected outcome on every boot but
        // the first. Anything else is a real schema problem and should be seen.
        if (!/duplicate column/i.test(String(err?.message))) throw err;
      }
    }
  }
  migrated = true;
}

/** Used by the tests to start from nothing. */
export function resetMigrations() {
  migrated = false;
}

export async function closeDb() {
  await sql.close();
  migrated = false;
}
