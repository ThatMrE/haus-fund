/**
 * The Postgres driver: Neon's SQL-over-HTTP endpoint, spoken with `fetch`.
 *
 * Neon accepts SQL over plain HTTP, which is what lets this app keep a durable
 * Postgres without a native client — the property the rest of the code is built
 * on. One request carries either a single statement or a list, and a list runs
 * inside a transaction, which is how `transaction` below stays atomic.
 *
 * What that endpoint cannot do is hold a session open across requests, so there
 * are no interactive transactions: a transaction is a list of statements
 * decided up front. `LAST_ID` bridges the one case that needs a value from
 * mid-flight — see `db/index.js`.
 */

const DEFAULT_TIMEOUT_MS = 15_000;

/** Tables whose id is assigned by the database, so an INSERT can return it. */
export const IDENTITY_TABLES = new Set([
  'items',
  'points_ledger',
  'redemptions',
  'digests',
  'agent_runs',
]);

/**
 * Postgres numbers its placeholders. Quoted strings are stepped over so a `?`
 * inside a literal is left alone.
 */
export function toNumberedPlaceholders(sql) {
  let out = '';
  let index = 0;
  let quote = null;

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    if (quote) {
      out += char;
      if (char === quote) {
        // '' and "" are escaped quotes, not the end of the literal.
        if (sql[i + 1] === quote) {
          out += sql[++i];
        } else {
          quote = null;
        }
      }
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      out += char;
      continue;
    }
    if (char === '?') {
      out += `$${++index}`;
      continue;
    }
    out += char;
  }
  return out;
}

/** The table an INSERT targets, or null for anything else. */
export function insertTarget(sql) {
  const match = /^\s*INSERT\s+INTO\s+"?([a-z_]+)"?/i.exec(sql);
  return match ? match[1].toLowerCase() : null;
}

/**
 * Postgres has no `last_insert_rowid()`, so an INSERT that the caller wants an
 * id back from asks for it explicitly.
 */
export function withReturningId(sql) {
  if (/\bRETURNING\b/i.test(sql)) return sql;
  const table = insertTarget(sql);
  if (!table || !IDENTITY_TABLES.has(table)) return sql;
  return `${sql.replace(/;\s*$/, '')} RETURNING id`;
}

class NeonError extends Error {
  constructor(message, { code, detail } = {}) {
    super(message);
    this.name = 'NeonError';
    this.code = code;
    this.detail = detail;
  }
}

/** The default transport: one HTTPS request to Neon's /sql endpoint. */
function httpTransport({ connectionString, fetchImpl, timeoutMs }) {
  const host = new URL(connectionString).hostname;
  const endpoint = `https://${host}/sql`;

  return async function send(queries, { transaction = false } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res;
    try {
      res = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'neon-connection-string': connectionString,
          // Ask for one array per row rather than objects keyed by column, so
          // duplicate column names in a join cannot silently collapse.
          'neon-raw-text-output': 'true',
          'neon-array-mode': 'true',
          ...(transaction ? { 'neon-batch-isolation-level': 'ReadCommitted' } : {}),
        },
        body: JSON.stringify(transaction ? { queries } : queries[0]),
        signal: controller.signal,
      });
    } catch (err) {
      if (err?.name === 'AbortError') throw new NeonError(`timeout after ${timeoutMs}ms`);
      throw err;
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      let parsed = null;
      try {
        parsed = JSON.parse(body);
      } catch {
        /* the status line is still useful on its own */
      }
      throw new NeonError(parsed?.message ?? `HTTP ${res.status}: ${body.slice(0, 300)}`, {
        code: parsed?.code,
        detail: parsed?.detail,
      });
    }

    const payload = await res.json();
    return transaction ? payload.results ?? [] : [payload];
  };
}

/** Raw text from Postgres -> the JS value the app expects. */
export function decodeCell(text, type) {
  if (text === null || text === undefined) return null;
  // Postgres OIDs: 20/21/23 are the integer widths, 16 is boolean, 700/701/1700
  // the floats and numeric.
  if (type === 16) return text === 't' ? 1 : 0;
  if (type === 20 || type === 21 || type === 23) {
    const n = Number(text);
    return Number.isSafeInteger(n) ? n : text;
  }
  if (type === 700 || type === 701 || type === 1700) return Number(text);
  return text;
}

function toObjects(result) {
  const fields = result.fields ?? [];
  return (result.rows ?? []).map((row) => {
    const out = {};
    row.forEach((cell, i) => {
      const field = fields[i] ?? {};
      out[field.name ?? `col${i}`] = decodeCell(cell, field.dataTypeID);
    });
    return out;
  });
}

export function openNeon({
  connectionString,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  transport,
} = {}) {
  const send =
    transport ?? httpTransport({ connectionString, fetchImpl, timeoutMs });

  /**
   * One statement in the shape the endpoint reads: `query` and `params`, with
   * placeholders numbered.
   */
  function prepare(sql, params, { wantId = false } = {}) {
    return {
      query: toNumberedPlaceholders(wantId ? withReturningId(sql) : sql),
      params: params.map(normalize),
    };
  }

  const store = {
    kind: 'postgres',

    async all(sql, ...params) {
      const [result] = await send([prepare(sql, params)]);
      return toObjects(result);
    },

    async get(sql, ...params) {
      const rows = await store.all(sql, ...params);
      return rows[0] ?? null;
    },

    async run(sql, ...params) {
      const [result] = await send([prepare(sql, params, { wantId: true })]);
      const rows = toObjects(result);
      return {
        changes: Number(result.rowCount ?? 0),
        lastInsertRowid: rows[0]?.id ?? 0,
      };
    },

    async exec(sql) {
      await send([{ query: sql, params: [] }]);
    },

    /**
     * A list of statements, applied in order inside one transaction. This is
     * the whole of what the HTTP endpoint offers, and it is enough: the app
     * decides a transaction's statements before it starts one.
     */
    async batch(statements) {
      const queries = statements.map((s) =>
        // Postgres carries the previous insert's id in the session, which the
        // whole batch shares because it is one transaction.
        prepare(String(s.sql).replaceAll('{{LAST_ID}}', 'lastval()'), s.params ?? [], {
          wantId: true,
        }),
      );
      const results = await send(queries, { transaction: true });
      return results.map((result) => {
        const rows = toObjects(result);
        return {
          rows,
          changes: Number(result.rowCount ?? 0),
          lastInsertRowid: rows[0]?.id ?? 0,
        };
      });
    },

    async close() {
      /* each request is its own connection */
    },
  };

  return store;
}

/** Postgres wants text, numbers and null; booleans and dates are neither. */
function normalize(value) {
  if (value === undefined) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value instanceof Date) return Math.floor(value.getTime() / 1000);
  return value;
}
