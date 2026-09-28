import { resolve } from 'node:path';
import { openSqlite, wrapSqlite } from './sqlite.js';
import { openTurso } from './turso.js';
import { openNeon } from './neon.js';
import { SCHEMA, LATER_COLUMNS, statements, schemaFor } from './schema.js';

export { SCHEMA, statements, schemaFor };

const DEFAULT_PATH = resolve(process.cwd(), 'data/haus-news.db');

let store = null;

/**
 * Which database this process talks to.
 *
 * A libSQL URL in the environment wins: that is the durable, shared database,
 * and it is what production runs against. Without one the app falls back to a
 * local SQLite file, which is right for development and the tests but resets
 * on a serverless cold start — see the README.
 */
export function describeTarget(env = process.env) {
  const postgres = env.NETLIFY_DATABASE_URL || env.DATABASE_URL || env.NEON_DATABASE_URL || '';
  if (/^postgres(ql)?:\/\//.test(postgres)) return { driver: 'neon', url: postgres };

  const libsql = env.TURSO_DATABASE_URL || env.LIBSQL_URL || '';
  if (libsql) {
    return { driver: 'turso', url: libsql, token: env.TURSO_AUTH_TOKEN || env.LIBSQL_AUTH_TOKEN || '' };
  }
  return { driver: 'sqlite', path: env.BIOPUNK_DB || env.HAUS_NEWS_DB || DEFAULT_PATH };
}

/** Open the database and bring the schema up to date. Call once at boot. */
export async function initDb(options = {}) {
  if (store) return store;
  const target = options.target ?? describeTarget();
  store =
    target.driver === 'neon'
      ? openNeon({
          connectionString: target.url,
          fetchImpl: options.fetchImpl,
          transport: options.transport,
        })
      : target.driver === 'turso'
        ? openTurso({ url: target.url, token: target.token, fetchImpl: options.fetchImpl })
        : openSqlite(target.path);
  await migrate(store);
  return store;
}

/** The open store. Throws rather than silently opening a second database. */
export function getDb() {
  if (!store) throw new Error('database not initialised — call initDb() first');
  return store;
}

export function hasDb() {
  return store !== null;
}

/** Point the process at another store. The tests hand in an in-memory SQLite. */
export async function setDb(instance) {
  store = instance && instance.kind ? instance : instance ? wrapSqlite(instance) : null;
  if (store) await migrate(store);
  return store;
}

export async function closeDb() {
  if (store) await store.close();
  store = null;
}

/**
 * Run `fn` inside a transaction, rolling back if it throws.
 *
 * Only the local driver offers this: it needs a session held open, which the
 * hosted one has no way to do. Anything that must be atomic on both engines
 * uses `batch` instead.
 */
export function transaction(fn) {
  const store = getDb();
  if (!store.transaction) throw new Error(`${store.kind} has no interactive transactions — use batch()`);
  return store.transaction(fn);
}

/**
 * Apply a list of statements atomically. `{{LAST_ID}}` in any statement stands
 * for the id the previous insert generated.
 */
export function batch(statements) {
  return getDb().batch(statements);
}

async function migrate(instance) {
  const dialect = instance.kind === 'postgres' ? 'postgres' : 'sqlite';
  for (const sql of statements(schemaFor(dialect))) await instance.exec(sql);
  await addMissingColumns(instance, dialect);
}

async function addMissingColumns(instance, dialect) {
  for (const [table, column, definition] of LATER_COLUMNS) {
    // Each engine keeps its column list somewhere different; the question is
    // the same either way.
    const row =
      dialect === 'postgres'
        ? await instance.get(
            `SELECT COUNT(*) AS n FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = ? AND column_name = ?`,
            table,
            column,
          )
        : await instance.get(
            'SELECT COUNT(*) AS n FROM pragma_table_info(?) WHERE name = ?',
            table,
            column,
          );
    if (!Number(row?.n)) {
      await instance.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  }
}
