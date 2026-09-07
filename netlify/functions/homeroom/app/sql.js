/**
 * The database, behind one small asynchronous interface.
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────
 *
 * Homeroom's tables lived on the function container's /tmp, which meant a cold
 * container started empty. Accounts were rescued first (Supabase Auth), then
 * invites (Supabase, because an invite that works by luck is not an invite).
 * Everything else — 41 hr_ tables, including a mentor's booking grant and a
 * consent token someone was emailed — was still a coin flip.
 *
 * ── THE ONE FACT THAT SHAPED THIS ────────────────────────────────────────
 *
 * Node has no synchronous network I/O. Every durable store reachable over a
 * network is therefore async, and `node:sqlite` is synchronous, so there was no
 * version of this change that did not make the data layer async. That is the
 * whole cost of the move and it could not be avoided by choosing differently.
 *
 * What it did NOT have to cost is the SQL. All 203 queries are unchanged: the
 * Postgres adapter below translates placeholders and nothing else. Rewriting
 * them into PostgREST filter syntax was the alternative, and it is where the
 * regressions would have lived.
 *
 * ── TWO BACKENDS, ONE SURFACE ────────────────────────────────────────────
 *
 *   sqlite    node:sqlite, wrapped so it satisfies the async interface. Still
 *             the default, still what the tests run against, still what makes
 *             `npm start` work with nothing configured.
 *   postgres  `pg` against Supabase. Selected by DATABASE_URL.
 *
 * Keeping SQLite is not sentiment. It is what lets 232 tests exercise the real
 * query surface with no network and no credentials, and it is the reason this
 * refactor could be validated before the Postgres driver existed at all.
 *
 * ── WHY pg AND NOT THE SUPABASE REST API ─────────────────────────────────
 *
 * PostgREST exposes tables and `security definer` functions, not arbitrary SQL.
 * The queries here have joins, correlated subqueries and a ranking expression;
 * expressing those through PostgREST would mean rewriting every one of them, or
 * burying them in stored procedures. Neither is a contained change.
 *
 * It also cannot do a transaction across two calls, and 14 sites here depend on
 * one — including the mentor desk's "first accept wins", which is a real race
 * the moment it stops being atomic.
 *
 * So: the wire protocol, through Supabase's TRANSACTION POOLER (port 6543).
 * Not the direct connection — serverless functions open and abandon
 * connections faster than Postgres can reclaim them, and the pooler is the
 * thing that exists to absorb that.
 */

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { HOMEROOM_SCHEMA, ACCOUNT_SCHEMA, ADDED_COLUMNS } from './schema.js';

const DEFAULT_PATH = resolve(process.cwd(), 'data/homeroom.db');

export function databaseUrl() {
  return process.env.HOMEROOM_DATABASE_URL || process.env.DATABASE_URL || '';
}

/** Which backend is in play. `postgres` needs no flag beyond the URL itself. */
export function backend() {
  return databaseUrl() ? 'postgres' : 'sqlite';
}

export const durable = () => backend() === 'postgres';

/* ===================================================================== *
 * SQLite
 * ===================================================================== */

let sqliteHandle = null;

function openSqlite(path = process.env.HOMEROOM_DB || DEFAULT_PATH) {
  if (sqliteHandle) return sqliteHandle;
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  sqliteHandle = new DatabaseSync(path);
  sqliteHandle.exec('PRAGMA journal_mode = WAL');
  sqliteHandle.exec('PRAGMA foreign_keys = ON');
  sqliteHandle.exec('PRAGMA busy_timeout = 5000');
  // Migrate on open, which is what `getDb()` used to do implicitly and what a
  // hundred call sites still assume. SQLite's DDL is synchronous, so this can
  // stay inside the open rather than becoming something every caller has to
  // remember. Postgres migrates explicitly in db.js — there is no open to hang
  // it off, and a cold Lambda would run it on every request if there were.
  migrateSqlite(sqliteHandle);
  return sqliteHandle;
}

function migrateSqlite(instance) {
  instance.exec(ACCOUNT_SCHEMA);
  instance.exec(HOMEROOM_SCHEMA);
  for (const [table, column, type] of ADDED_COLUMNS) {
    try {
      instance.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
    } catch (err) {
      // "duplicate column name" is the expected outcome on every boot but the
      // first. Anything else is a real schema problem and should be seen.
      if (!/duplicate column/i.test(String(err?.message))) throw err;
    }
  }
}

const sqliteDriver = {
  async all(sql, params) { return openSqlite().prepare(sql).all(...params); },
  async get(sql, params) { return openSqlite().prepare(sql).get(...params) ?? null; },
  async run(sql, params) {
    const info = openSqlite().prepare(sql).run(...params);
    return { changes: Number(info.changes || 0), id: Number(info.lastInsertRowid || 0) };
  },
  async exec(sql) { openSqlite().exec(sql); },
  async close() { if (sqliteHandle) sqliteHandle.close(); sqliteHandle = null; },
};

/* ===================================================================== *
 * Postgres
 * ===================================================================== */

let pool = null;

/**
 * Whether to negotiate TLS, and how strictly.
 *
 * Not a constant, because the two environments this runs in disagree. Supabase
 * requires TLS, and its transaction pooler terminates it itself — presenting a
 * certificate for the pooler host rather than the project host, so verifying
 * against the connection string's hostname fails even though the channel is
 * genuinely encrypted. A local Postgres, meanwhile, usually has no TLS at all
 * and refuses the connection outright if one is demanded.
 *
 * So: off for loopback and for an explicit `sslmode=disable`, on everywhere
 * else. Hardcoding it on made the code untestable against a real server, which
 * is the sort of thing that stays hidden until the first deploy.
 */
export function sslFor(url) {
  if (/[?&]sslmode=disable\b/.test(url)) return false;
  let host = '';
  try { host = new URL(url).hostname; } catch { /* fall through to secure */ }
  if (['localhost', '127.0.0.1', '::1'].includes(host)) return false;
  return { rejectUnauthorized: false };
}

async function getPool() {
  if (pool) return pool;
  const { default: pg } = await import('pg');

  /*
   * int8 comes back as a STRING by default.
   *
   * node-postgres does that because a 64-bit integer does not always fit a
   * JavaScript number, and it would rather hand back something lossless than
   * something subtly wrong. Here it would be the subtly wrong thing: every
   * INTEGER in the schema is widened to BIGINT (epoch seconds outgrow int4 in
   * 2038), so without this every timestamp, count and counter arrives as a
   * string. `nudges + 1` becomes "11", `COUNT(*)` renders as "2" in JSON, and
   * nothing throws.
   *
   * Every such column here is a count, a flag or an epoch second — all far
   * inside Number.MAX_SAFE_INTEGER — so parsing them as numbers is safe and
   * makes the two backends agree.
   */
  pg.types.setTypeParser(pg.types.builtins.INT8, (v) => (v === null ? null : Number(v)));
  pool = new pg.Pool({
    connectionString: databaseUrl(),
    ssl: sslFor(databaseUrl()),
    // Serverless: a function instance handles one request at a time, and a
    // large pool per instance multiplies across instances into pooler
    // exhaustion. One or two is the right number here, not ten.
    max: Number(process.env.HOMEROOM_PG_POOL || 2),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 8_000,
  });
  return pool;
}

/**
 * `?` to `$1`.
 *
 * The only translation this layer performs, and the reason all 203 queries
 * survived the move unedited. Question marks inside string literals are left
 * alone — 'what?' is a value, not a parameter — which is why this walks the
 * string rather than running a regex over it.
 */
export function toPgPlaceholders(sql) {
  let out = '';
  let quote = null;
  let n = 0;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (quote) {
      out += ch;
      if (ch === quote) {
        if (sql[i + 1] === quote) { out += sql[++i]; continue; }
        quote = null;
      }
      continue;
    }
    if (ch === "'" || ch === '"') { quote = ch; out += ch; continue; }
    if (ch === '?') { out += `$${++n}`; continue; }
    out += ch;
  }
  return out;
}

/**
 * Which tables can tell you the id of a row you just inserted.
 *
 * SQLite hands back `lastInsertRowid` for free. Postgres does not: the id has
 * to be asked for with RETURNING, and asking a table that has no `id` column
 * is an error rather than an empty answer. So the set is computed once from
 * the schema — the same schema the tables were created from, so it cannot
 * disagree with them — and `run()` appends RETURNING only for tables in it.
 *
 * Junction tables (hr_thread_members, hr_rsvps, hr_review_votes) are correctly
 * absent: they have composite keys and nothing ever asks for their id.
 */
let identityTables = null;

export function tablesWithId() {
  if (identityTables) return identityTables;
  identityTables = new Set();
  const ddl = ACCOUNT_SCHEMA + HOMEROOM_SCHEMA;
  const re = /CREATE TABLE IF NOT EXISTS (\w+)\s*\(([\s\S]*?)\n\);/g;
  let m;
  while ((m = re.exec(ddl))) {
    if (/^\s*id\s+INTEGER PRIMARY KEY AUTOINCREMENT/m.test(m[2])) identityTables.add(m[1]);
  }
  return identityTables;
}

/** Append RETURNING id to an INSERT that will be asked for one. */
export function withReturning(sql) {
  const m = /^\s*INSERT\s+INTO\s+(\w+)/i.exec(sql);
  if (!m || /\bRETURNING\b/i.test(sql)) return sql;
  if (!tablesWithId().has(m[1])) return sql;
  return `${sql.replace(/;\s*$/, '')} RETURNING id`;
}

const pgDriver = {
  async all(sql, params) {
    const client = await getPool();
    const { rows } = await client.query(toPgPlaceholders(sql), params);
    return rows;
  },
  async get(sql, params) {
    const rows = await pgDriver.all(sql, params);
    return rows[0] ?? null;
  },
  async run(sql, params) {
    const client = await getPool();
    const result = await client.query(toPgPlaceholders(withReturning(sql)), params);
    return {
      changes: result.rowCount || 0,
      id: Number(result.rows?.[0]?.id ?? 0),
    };
  },
  async exec(sql) {
    const client = await getPool();
    await client.query(sql);
  },
  async close() { if (pool) await pool.end(); pool = null; },
};

/* ===================================================================== *
 * The surface everything above this file uses
 * ===================================================================== */

const driver = () => (backend() === 'postgres' ? pgDriver : sqliteDriver);

export const all = (sql, ...params) => driver().all(sql, params.flat());
export const get = (sql, ...params) => driver().get(sql, params.flat());
export const run = (sql, ...params) => driver().run(sql, params.flat());
export const exec = (sql) => driver().exec(sql);
export const close = () => driver().close();

/** One value out of a one-column, one-row query. */
export async function value(sql, ...params) {
  const row = await get(sql, ...params);
  return row ? Object.values(row)[0] : null;
}

/**
 * A transaction.
 *
 * The callback receives an object with the same all/get/run surface, bound to
 * one connection so the statements actually share a transaction. Fourteen
 * places depend on this; the mentor desk's capacity check is the one where
 * losing it is a race rather than an inconvenience.
 */
export async function tx(fn) {
  if (backend() !== 'postgres') {
    const db = openSqlite();
    db.exec('BEGIN');
    try {
      const result = await fn(await sqliteDriverBound());
      db.exec('COMMIT');
      return result;
    } catch (err) {
      try { db.exec('ROLLBACK'); } catch { /* the outer error is the interesting one */ }
      throw err;
    }
  }

  const client = await (await getPool()).connect();
  try {
    await client.query('BEGIN');
    const result = await fn(await pgBound(client));
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* ditto */ }
    throw err;
  } finally {
    client.release();
  }
}

async function sqliteDriverBound() {
  return {
    all: (sql, ...p) => sqliteDriver.all(sql, p.flat()),
    get: (sql, ...p) => sqliteDriver.get(sql, p.flat()),
    run: (sql, ...p) => sqliteDriver.run(sql, p.flat()),
    value: async (sql, ...p) => {
      const row = await sqliteDriver.get(sql, p.flat());
      return row ? Object.values(row)[0] : null;
    },
  };
}

async function pgBound(client) {
  const query = async (sql, params) => client.query(toPgPlaceholders(sql), params);
  return {
    all: async (sql, ...p) => (await query(sql, p.flat())).rows,
    get: async (sql, ...p) => (await query(sql, p.flat())).rows[0] ?? null,
    run: async (sql, ...p) => {
      const r = await client.query(toPgPlaceholders(withReturning(sql)), p.flat());
      return { changes: r.rowCount || 0, id: Number(r.rows?.[0]?.id ?? 0) };
    },
    value: async (sql, ...p) => {
      const row = (await query(sql, p.flat())).rows[0];
      return row ? Object.values(row)[0] : null;
    },
  };
}

/**
 * The raw SQLite handle.
 *
 * Only meaningful on the sqlite backend, and it throws on Postgres rather than
 * returning something that half works. It exists for the two callers that are
 * legitimately synchronous and legitimately local: test fixtures, and the
 * seed/import scripts that run in a terminal against a file.
 *
 * Nothing in the request path may use it. That is the rule that keeps the
 * async surface honest — a sync escape hatch used in a route would work
 * perfectly in tests and fail only in production.
 */
export function rawSqlite() {
  if (backend() === 'postgres') {
    throw new Error('rawSqlite() is not available on Postgres — use the async surface.');
  }
  return openSqlite();
}

/** Used by the tests to start from nothing. */
export function resetSqlite() {
  if (sqliteHandle) sqliteHandle.close();
  sqliteHandle = null;
}
