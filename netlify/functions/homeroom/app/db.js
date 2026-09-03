/**
 * The database.
 *
 * WHY THIS STOPPED BEING SQLITE
 *
 * Homeroom ran on a SQLite file in the function container's /tmp. That is a
 * per-container scratch disk: every cold start began with an empty database and
 * every recycle threw away whatever was in it. Accounts, perk claims, bookings,
 * reviews, module progress — all of it lasted until the container did. Two
 * pieces were rescued one at a time (credentials into Supabase Auth, invites
 * into a Supabase table) precisely because losing them was intolerable, but
 * that was patching around the problem. This moves the whole thing.
 *
 * It is now Postgres, which is what Supabase already gives this project.
 *
 * TWO DRIVERS, ONE DIALECT
 *
 *   pg      talks to Supabase in production and to any Postgres locally.
 *   PGlite  is Postgres compiled to WebAssembly, running in this process.
 *
 * The tests use PGlite so `npm test` still needs nothing installed and no
 * server running — the property that keeps a suite being run — while executing
 * against real Postgres rather than a lookalike. There is exactly one SQL
 * dialect in this codebase, which is the whole point: two would drift, and the
 * drift would be found in production.
 *
 * WHY THERE ARE NOW DEPENDENCIES
 *
 * This app was written with none, deliberately, and that was the right call
 * while the store was a file the standard library could open. It is not worth
 * keeping at the price of losing every member's data on every deploy. Two
 * packages, both only a database driver.
 *
 * CONNECTIONS, AND WHY THE PORT MATTERS
 *
 * A serverless function scales out to many containers, and Postgres counts
 * connections. Point HOMEROOM_DATABASE_URL at Supabase's TRANSACTION POOLER
 * (port 6543), not at the database directly (5432): the pooler is built for
 * exactly this shape of traffic. It does not support named prepared statements,
 * which is why every query here is sent unnamed.
 *
 * PLACEHOLDERS
 *
 * Callers still write `?`. `prepare()` rewrites them to $1..$n, skipping
 * quoted strings and comments so a literal question mark inside a LIKE pattern
 * survives. Keeping `?` at the call sites is not nostalgia: it made this port a
 * change of plumbing rather than a rewrite of two hundred queries, and a query
 * you can still read against the old one is a query you can still review.
 */

import { HOMEROOM_SCHEMA } from './schema.js';

let pool = null;      // the driver, whichever it is
let ready = null;     // in-flight (or finished) migration
let driverName = '';

export function databaseUrl() {
  return (
    process.env.HOMEROOM_DATABASE_URL
    || process.env.DATABASE_URL
    || process.env.SUPABASE_DB_URL
    || ''
  ).trim();
}

/** `pg` against a real server, or PGlite in this process. */
export function driver() {
  return driverName;
}

/* ==========================================================================
 * Placeholders
 * ======================================================================== */

/**
 * Rewrite `?` placeholders as $1..$n.
 *
 * Walks the string rather than running a regex over it, because a `?` inside a
 * quoted literal is data and must not be renumbered — `LIKE '%?%'` is a real
 * query, and a regex would quietly break it.
 */
export function toPositional(sql) {
  let out = '';
  let n = 0;
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];

    if (c === "'") {                       // '...''...' string literal
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === "'" && sql[j + 1] === "'") { j += 2; continue; }
        if (sql[j] === "'") break;
        j++;
      }
      out += sql.slice(i, j + 1);
      i = j;
      continue;
    }
    if (c === '"') {                       // "quoted identifier"
      const j = sql.indexOf('"', i + 1);
      const end = j === -1 ? sql.length - 1 : j;
      out += sql.slice(i, end + 1);
      i = end;
      continue;
    }
    if (c === '-' && sql[i + 1] === '-') { // -- line comment
      const j = sql.indexOf('\n', i);
      const end = j === -1 ? sql.length : j;
      out += sql.slice(i, end);
      i = end - 1;
      continue;
    }
    if (c === '/' && sql[i + 1] === '*') { // /* block comment */
      const j = sql.indexOf('*/', i + 2);
      const end = j === -1 ? sql.length : j + 2;
      out += sql.slice(i, end);
      i = end - 1;
      continue;
    }
    if (c === '?') { out += `$${++n}`; continue; }
    out += c;
  }
  return out;
}

/* ==========================================================================
 * Opening
 * ======================================================================== */

async function openPg(url) {
  const { default: pg } = await import('pg');

  /*
   * Postgres hands back bigint, numeric and int8 counts as strings, because
   * they can exceed what a JS number holds. Nothing in this schema does — the
   * ids are serials and the counts are counts — and code that has always seen
   * numbers would start comparing "0" to 0 and quietly get it wrong. So parse
   * them, once, here.
   */
  pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)));   // int8
  pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v))); // numeric

  const instance = new pg.Pool({
    connectionString: url,
    // A function container serves a handful of requests at a time, and every
    // container holds its own pool. Small is correct; the alternative is
    // exhausting the server's connection limit under a traffic spike.
    max: Number(process.env.HOMEROOM_DB_POOL || 3),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    // Supabase terminates TLS with its own chain. Verifying it needs the CA
    // bundle shipped to the function, which Netlify does not do, so the
    // connection is encrypted but the certificate is not pinned. Set
    // HOMEROOM_DB_SSL_STRICT=1 where you can supply the root.
    ssl: url.includes('localhost') || url.includes('127.0.0.1')
      ? false
      : { rejectUnauthorized: process.env.HOMEROOM_DB_SSL_STRICT === '1' },
  });
  // A pool that emits an unhandled 'error' takes the process with it; the
  // driver reconnects on the next query, so log and carry on.
  instance.on('error', (err) => console.error('[homeroom] idle client error:', err?.message));

  driverName = 'pg';
  return {
    query: (text, values) => instance.query(text, values),
    // pg runs a multi-statement string through the simple protocol as long as
    // no parameters come with it, which is exactly what a schema script is.
    script: (client, text) => (client || instance).query(text),
    connect: () => instance.connect(),
    end: () => instance.end(),
  };
}

async function openPglite() {
  /*
   * PGlite is a devDependency: 26MB of WebAssembly belongs in a test run, not
   * in a function bundle. Its absence therefore means production is running
   * without HOMEROOM_DATABASE_URL, which is a configuration mistake worth
   * saying out loud rather than a module resolution error to decipher.
   *
   * The specifier is assembled rather than written out because esbuild follows
   * a literal one even inside a try/catch: it would inline PGlite's 1.4MB of
   * JavaScript into the function while leaving the .wasm and .data files it
   * loads from its own package directory behind, so the fallback would fail
   * with a wasm error instead of the sentence below. Built at runtime, the
   * bundler cannot see it, and a deploy without a database says why.
   */
  let PGlite;
  try {
    ({ PGlite } = await import(['@electric-sql', 'pglite'].join('/')));
  } catch {
    throw new Error(
      'No database. Set HOMEROOM_DATABASE_URL to your Postgres connection string '
      + "(Supabase's transaction pooler, port 6543). The in-process fallback is a "
      + 'devDependency and is not installed here.',
    );
  }
  const instance = await PGlite.create();
  driverName = 'pglite';
  return {
    query: async (text, values) => instance.query(text, values),
    // PGlite's query() is the extended protocol and takes one statement at a
    // time; exec() is the one that runs a script. pg does not make the
    // distinction, so the adapter does.
    script: (_client, text) => instance.exec(text),
    // PGlite is a single in-process engine, so a "connection" is itself.
    connect: async () => ({
      query: (text, values) => instance.query(text, values),
      release: () => {},
    }),
    end: () => instance.close(),
  };
}

/**
 * Open the database and make sure the schema is there.
 *
 * Idempotent and concurrency-safe: the first caller does the work, everyone
 * else awaits the same promise.
 */
export function getDb() {
  if (ready) return ready;
  ready = (async () => {
    const url = databaseUrl();
    pool = url ? await openPg(url) : await openPglite();
    await migrate();
    return api;
  })();
  return ready;
}

/** For tests and scripts that want a clean slate. */
export async function closeDb() {
  if (pool) await pool.end().catch(() => {});
  pool = null;
  ready = null;
  driverName = '';
}

/* ==========================================================================
 * The query API
 *
 * Deliberately the same shape the SQLite code used — prepare().get/all/run —
 * so the call sites read as they did. The difference is that every one of them
 * is now awaited, which is the honest cost of the store being on the network.
 * ======================================================================== */

function statement(sql, runner) {
  const text = toPositional(sql);
  return {
    text,
    async get(...params) {
      const result = await runner(text, params);
      return result.rows[0] ?? null;
    },
    async all(...params) {
      const result = await runner(text, params);
      return result.rows;
    },
    async run(...params) {
      const result = await runner(text, params);
      return {
        changes: result.rowCount ?? 0,
        // Only meaningful when the caller asked for it with RETURNING.
        row: result.rows[0] ?? null,
      };
    },
  };
}

export const api = {
  prepare(sql) {
    return statement(sql, (text, values) => pool.query(text, values));
  },

  async exec(sql) {
    await pool.script(null, sql);
  },

  /**
   * Run a function inside one transaction, on one connection.
   *
   * The connection matters as much as the transaction: with a pooler in front,
   * BEGIN on one connection and COMMIT on another is not a transaction at all,
   * it is two statements that happen to rhyme. Everything inside gets a handle
   * whose prepare() is pinned to the same client.
   */
  async transaction(fn) {
    const client = await pool.connect();
    const scoped = {
      prepare: (sql) => statement(sql, (text, values) => client.query(text, values)),
      exec: async (sql) => { await pool.script(client, sql); },
      transaction: (inner) => inner(scoped),   // already in one; do not nest
    };
    try {
      await client.query('BEGIN');
      const result = await fn(scoped);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch { /* the original error is the interesting one */ }
      throw err;
    } finally {
      client.release();
    }
  },
};

/** Run a function inside a transaction. Kept as a free function for callers. */
export async function transaction(fn) {
  const db = await getDb();
  return db.transaction(fn);
}

/* ==========================================================================
 * Schema
 * ======================================================================== */

/**
 * Accounts and sessions. Homeroom owns its own, rather than borrowing an
 * identity provider wholesale: one table, one hash or one Supabase id, and one
 * signed cookie. Every other table in the schema points at users.id.
 */
export const ACCOUNT_SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  karma         INTEGER NOT NULL DEFAULT 1,
  created_at    BIGINT NOT NULL,
  is_admin      INTEGER NOT NULL DEFAULT 0,
  banned        INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

/* Password resets. The row stores a hash of the token, never the token, so a
   copy of the database does not let anyone take over an account. */
CREATE TABLE IF NOT EXISTS password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL,
  used_at    BIGINT
);

CREATE INDEX IF NOT EXISTS idx_resets_user ON password_resets(user_id);
`;

/*
 * Columns added after a table already existed somewhere.
 *
 * Postgres has ADD COLUMN IF NOT EXISTS, so unlike the SQLite version this
 * needs no error swallowing — which is the better kind of migration: one that
 * cannot hide a real failure behind an expected one.
 */
const ADDED_COLUMNS = [
  ['hr_funder_reviews', 'founder_friendly', 'INTEGER'],
  ['hr_funder_reviews', 'terms', 'INTEGER'],
  ['hr_funder_reviews', 'would_again', 'INTEGER NOT NULL DEFAULT 0'],
  ['hr_funder_reviews', 'tags', "TEXT NOT NULL DEFAULT ''"],
  ['hr_funder_reviews', 'stage', "TEXT NOT NULL DEFAULT ''"],
  ['hr_funder_reviews', 'outcome', "TEXT NOT NULL DEFAULT ''"],
  ['hr_slots', 'mentor_id', 'INTEGER'],
  ['hr_slots', 'url', "TEXT NOT NULL DEFAULT ''"],
  ['users', 'roster_status', "TEXT NOT NULL DEFAULT ''"],
  ['users', 'roster_checked_at', 'BIGINT NOT NULL DEFAULT 0'],
  ['hr_deals', 'access', "TEXT NOT NULL DEFAULT 'code'"],
  ['hr_deals', 'requirement', "TEXT NOT NULL DEFAULT ''"],
  ['hr_deals', 'checked', "TEXT NOT NULL DEFAULT ''"],
  // Mentor desk: standing consent, availability and how much of it there is.
  // `state` defaults to 'listed' so every existing row keeps behaving as it
  // did — a migration that quietly unlisted the whole roster would be worse
  // than no gate at all.
  ['hr_mentors', 'state', "TEXT NOT NULL DEFAULT 'listed'"],
  ['hr_mentors', 'consent_mode', "TEXT NOT NULL DEFAULT 'ask-me'"],
  ['hr_mentors', 'capacity', 'INTEGER NOT NULL DEFAULT 2'],
  ['hr_mentors', 'tracks', "TEXT NOT NULL DEFAULT ''"],
  ['hr_mentors', 'email', "TEXT NOT NULL DEFAULT ''"],
  ['hr_mentors', 'airtable_id', "TEXT NOT NULL DEFAULT ''"],
  // BIGINT, like every other timestamp here: INTEGER is 32 bits and runs out
  // in 2038. These arrived on main while this branch was moving to Postgres.
  ['hr_mentors', 'confirmed_at', 'BIGINT'],
  ['hr_mentors', 'paused_until', 'BIGINT'],
  ['hr_mentors', 'synced_at', 'BIGINT'],
  // Phase 3: keeping the roster honest. `confirmed_at` is when they last said
  // yes to being here at all; the two nudge columns are how a silence becomes
  // dormancy rather than a listing nobody ever checks again.
  ['hr_mentors', 'reconfirm_sent_at', 'BIGINT'],
  ['hr_mentors', 'reconfirm_nudges', 'INTEGER NOT NULL DEFAULT 0'],
  // Which Supabase credential this account signs in with, when HOMEROOM_AUTH
  // is supabase. Empty for a local account, so the two can coexist.
  ['users', 'supabase_id', "TEXT NOT NULL DEFAULT ''"],
];

/**
 * Create the schema if it is not there.
 *
 * Wrapped in an advisory lock because every cold container runs this, and
 * several of them can start at once behind a deploy. CREATE TABLE IF NOT
 * EXISTS is not immune to two sessions racing it — one of them gets a
 * duplicate-object error — so they queue instead.
 */
async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(4133741337)');
    await pool.script(client, ACCOUNT_SCHEMA);
    await pool.script(client, HOMEROOM_SCHEMA);
    for (const [table, column, type] of ADDED_COLUMNS) {
      await client.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} ${type}`);
    }
    await client.query('COMMIT');
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* as above */ }
    throw err;
  } finally {
    client.release();
  }
}

/* ==========================================================================
 * Reporting
 * ======================================================================== */

/** For /homeroom/health: where the data actually lives, and can we reach it. */
export async function health() {
  const url = databaseUrl();
  const configured = !!url;
  try {
    const db = await getDb();
    const row = await db.prepare('SELECT COUNT(*) AS n FROM users').get();
    return {
      driver: driver(),
      durable: configured,
      reachable: true,
      accounts: row.n,
      ...(configured ? {} : {
        warning: 'HOMEROOM_DATABASE_URL is not set, so this is an in-process database '
          + 'that disappears with the container. Point it at Supabase.',
      }),
    };
  } catch (err) {
    return {
      driver: driver() || (configured ? 'pg' : 'pglite'),
      durable: configured,
      reachable: false,
      error: String(err?.message || err).slice(0, 300),
    };
  }
}
