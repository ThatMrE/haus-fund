/**
 * The hosted driver: libSQL over its HTTP pipeline API.
 *
 * Talking to the database over HTTP with `fetch` is what lets this app keep a
 * durable, shared database without taking on a native client — the property the
 * rest of the code is built on. The SQL dialect is SQLite's, so the schema and
 * every query are the same ones the local driver runs.
 *
 * Protocol: POST {base}/v2/pipeline with a list of requests. A response carries
 * a `baton` that continues the same server-side session, which is how a
 * multi-statement transaction stays on one connection.
 */

const DEFAULT_TIMEOUT_MS = 10_000;

/** Turso hands out libsql:// URLs; the pipeline API is the https:// twin. */
export function httpUrl(url) {
  const trimmed = String(url).trim().replace(/\/+$/, '');
  if (trimmed.startsWith('libsql://')) return `https://${trimmed.slice('libsql://'.length)}`;
  if (trimmed.startsWith('ws://')) return `http://${trimmed.slice('ws://'.length)}`;
  if (trimmed.startsWith('wss://')) return `https://${trimmed.slice('wss://'.length)}`;
  return trimmed;
}

/** JS value -> the protocol's tagged value. */
export function encodeValue(value) {
  if (value === null || value === undefined) return { type: 'null' };
  if (typeof value === 'boolean') return { type: 'integer', value: value ? '1' : '0' };
  if (typeof value === 'bigint') return { type: 'integer', value: value.toString() };
  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? { type: 'integer', value: String(value) }
      : { type: 'float', value };
  }
  if (value instanceof Uint8Array) {
    return { type: 'blob', base64: Buffer.from(value).toString('base64') };
  }
  return { type: 'text', value: String(value) };
}

/** The protocol's tagged value -> a JS value. */
export function decodeValue(cell) {
  if (!cell || cell.type === 'null') return null;
  switch (cell.type) {
    case 'integer': {
      const n = Number(cell.value);
      // Beyond 2^53 a Number would silently lose digits; hand back the string
      // rather than a wrong number.
      return Number.isSafeInteger(n) ? n : cell.value;
    }
    case 'float':
      return typeof cell.value === 'number' ? cell.value : Number(cell.value);
    case 'blob':
      return Buffer.from(cell.base64 ?? '', 'base64');
    default:
      return cell.value ?? null;
  }
}

function rowsToObjects(result) {
  const cols = (result.cols ?? []).map((c, i) => c.name ?? `col${i}`);
  return (result.rows ?? []).map((row) => {
    const out = {};
    row.forEach((cell, i) => {
      out[cols[i]] = decodeValue(cell);
    });
    return out;
  });
}

class TursoError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'TursoError';
    this.code = code;
  }
}

/**
 * One server-side session. A fresh session is stateless — execute and close in
 * a single round trip. A session held open by a baton is how transactions work.
 */
class Session {
  constructor({ base, token, fetchImpl, timeoutMs }) {
    this.base = base;
    this.token = token;
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.baton = null;
    this.closed = false;
  }

  async pipeline(requests, { keepAlive = false } = {}) {
    const body = {
      baton: this.baton,
      requests: keepAlive ? requests : [...requests, { type: 'close' }],
    };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let res;
    try {
      res = await this.fetchImpl(`${this.base}/v2/pipeline`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new TursoError(
        `libsql HTTP ${res.status}${detail ? `: ${detail.slice(0, 400)}` : ''}`,
        `HTTP_${res.status}`,
      );
    }

    const payload = await res.json();
    this.baton = keepAlive ? (payload.baton ?? null) : null;
    if (!keepAlive) this.closed = true;
    // The server can move a session to another node mid-flight.
    if (payload.base_url) this.base = payload.base_url.replace(/\/+$/, '');

    const results = [];
    for (const entry of payload.results ?? []) {
      if (entry.type === 'error') {
        throw new TursoError(entry.error?.message ?? 'libsql error', entry.error?.code);
      }
      if (entry.response?.type === 'execute') results.push(entry.response.result);
    }
    return results;
  }
}

/**
 * Open the hosted store.
 *
 * `fetchImpl` is injectable so the tests can drive the protocol without a
 * network.
 */
export function openTurso({
  url,
  token,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  const base = httpUrl(url);
  const opts = { base, token, fetchImpl, timeoutMs };

  /** Run statements on a throwaway session (one round trip). */
  async function once(stmts) {
    const session = new Session(opts);
    return session.pipeline(
      stmts.map((stmt) => ({ type: 'execute', stmt })),
    );
  }

  function stmt(sql, params) {
    return { sql, args: params.map(encodeValue), want_rows: true };
  }

  /** A store bound to an open session, used inside a transaction. */
  function boundStore(session) {
    return {
      kind: 'turso',
      async all(sql, ...params) {
        const [result] = await session.pipeline(
          [{ type: 'execute', stmt: stmt(sql, params) }],
          { keepAlive: true },
        );
        return rowsToObjects(result);
      },
      async get(sql, ...params) {
        const rows = await this.all(sql, ...params);
        return rows[0] ?? null;
      },
      async run(sql, ...params) {
        const [result] = await session.pipeline(
          [{ type: 'execute', stmt: stmt(sql, params) }],
          { keepAlive: true },
        );
        return {
          changes: Number(result.affected_row_count ?? 0),
          lastInsertRowid: Number(result.last_insert_rowid ?? 0),
        };
      },
      async exec(sql) {
        await session.pipeline([{ type: 'execute', stmt: stmt(sql, []) }], { keepAlive: true });
      },
    };
  }

  const store = {
    kind: 'turso',
    base,

    async all(sql, ...params) {
      const [result] = await once([stmt(sql, params)]);
      return rowsToObjects(result);
    },

    async get(sql, ...params) {
      const rows = await store.all(sql, ...params);
      return rows[0] ?? null;
    },

    async run(sql, ...params) {
      const [result] = await once([stmt(sql, params)]);
      return {
        changes: Number(result.affected_row_count ?? 0),
        lastInsertRowid: Number(result.last_insert_rowid ?? 0),
      };
    },

    async exec(sql) {
      await once([stmt(sql, [])]);
    },

    /** Several statements in one round trip, applied in order. */
    async batch(sqls) {
      return once(sqls.map((s) => (typeof s === 'string' ? stmt(s, []) : stmt(s.sql, s.params ?? []))));
    },

    /**
     * A real transaction: BEGIN, the caller's work, COMMIT — all on one
     * server-side session held open by the baton.
     */
    async transaction(fn) {
      const session = new Session(opts);
      const bound = boundStore(session);
      await bound.exec('BEGIN');
      try {
        const result = await fn(bound);
        await bound.exec('COMMIT');
        // Release the session now that the work is done.
        await session.pipeline([]).catch(() => {});
        return result;
      } catch (err) {
        try {
          await bound.exec('ROLLBACK');
          await session.pipeline([]).catch(() => {});
        } catch {
          /* the original error is the interesting one */
        }
        throw err;
      }
    },

    async close() {
      /* sessions are closed per request */
    },
  };

  return store;
}
