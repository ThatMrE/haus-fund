import { resolve } from 'node:path';
import { openSqlite, wrapSqlite } from './sqlite.js';
import { openTurso } from './turso.js';
import { SCHEMA, LATER_COLUMNS, statements } from './schema.js';

export { SCHEMA, statements };

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
  const url = env.TURSO_DATABASE_URL || env.LIBSQL_URL || '';
  if (url) return { driver: 'turso', url, token: env.TURSO_AUTH_TOKEN || env.LIBSQL_AUTH_TOKEN || '' };
  return { driver: 'sqlite', path: env.BIOPUNK_DB || env.HAUS_NEWS_DB || DEFAULT_PATH };
}

/** Open the database and bring the schema up to date. Call once at boot. */
export async function initDb(options = {}) {
  if (store) return store;
  const target = options.target ?? describeTarget();
  store =
    target.driver === 'turso'
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

/** Run `fn` inside a transaction, rolling back if it throws. */
export function transaction(fn) {
  return getDb().transaction(fn);
}

async function migrate(instance) {
  for (const sql of statements(SCHEMA)) await instance.exec(sql);
  await addMissingColumns(instance);
}

async function addMissingColumns(instance) {
  for (const [table, column, definition] of LATER_COLUMNS) {
    const row = await instance.get(
      'SELECT COUNT(*) AS n FROM pragma_table_info(?) WHERE name = ?',
      table,
      column,
    );
    if (!row?.n) await instance.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
